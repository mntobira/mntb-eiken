import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Mic,
  Play,
  Printer,
  RotateCcw,
  Send,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { auth } from '../../firebase';
import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import { loadJukuMemberships, subscribeJukuMemberships } from '../../utils/classAssignments';
import {
  ensureStudentJukuMemberships,
  uniqueJukuMembershipsByClass,
} from '../shared/studentClassSession';
import { safeLocalStorage } from '../../utils/safeLocalStorage';
import type {
  SugorokuSpeakingPartId,
  SugorokuSpeakingSubmissionDoc,
} from '../shared/types';
import { SUGOROKU_DEMO_CLASS_ID } from '../writing-review/writingStore';
import {
  detectPreferredAudioMimeType,
  startAudioRecording,
  type ActiveRecordingHandle,
  type RecordedClip,
} from './audioRecorder';
import { findSpeakingSetById, SCBT_SPEAKING_SETS } from './mockSpeakingSets';
import { playScbtBeep } from './scbtBeep';
import { ScbtIllustrationCard } from './ScbtIllustrationCard';
import { openSpeakingFeedbackPrintWindow } from './speakingFeedbackSheet';
import {
  clearDraftSpeakingClips,
  fetchStudentSpeakingSubmissions,
  loadDraftSpeakingClips,
  saveDraftSpeakingClip,
  submitSpeakingSession,
} from './speakingStore';
import {
  SCBT_PART_LABELS,
  SCBT_PART_ORDER,
  type ScbtSpeakingSet,
} from './speakingTypes';
import '../writing-review/writing-review.css';
import './speaking-scbt.css';

type FlowStep =
  | 'select'
  | 'mic_check'
  | 'silent_read'
  | 'read_aloud'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'review_submit';

type GradeFilterId = 'all' | 'eiken_2' | 'eiken_pre2plus' | 'eiken_pre2' | 'eiken_3';

const STUDENT_NAME_CACHE_KEY = 'sugoroku_student_name_v1';

const NEXT_STEP_AFTER_PART: Record<SugorokuSpeakingPartId, FlowStep> = {
  reading_aloud: 'q1',
  q1: 'q2',
  q2: 'q3',
  q3: 'q4',
  q4: 'review_submit',
};

function speakEnglishPrompt(script: string, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(script);
    utter.lang = 'en-US';
    utter.rate = 0.94;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      onEnd?.();
    };
    utter.onend = finish;
    utter.onerror = finish;
    window.speechSynthesis.speak(utter);
    const approxMs = Math.max(2500, Math.min(18000, script.length * 95));
    setTimeout(finish, approxMs);
  } catch {
    onEnd?.();
  }
}

function renderClipTelemetry(clip: RecordedClip | undefined) {
  if (!clip) return null;
  const hasRatio = typeof clip.speechRatio === 'number';
  const longPause = typeof clip.maxSilenceSec === 'number' && clip.maxSilenceSec >= 4.0;
  return (
    <div className="scbt-model-box">
      {hasRatio && (
        <div className="swr-muted-note">
          発話率：<strong>{clip.speechRatio}%</strong>
          {typeof clip.maxSilenceSec === 'number' && (
            <>
              {' '}
              ・ 最長ポーズ：<strong>{clip.maxSilenceSec}秒</strong>
            </>
          )}
          {longPause && (
            <span className="twr-pill-pending">
              {' '}
              4秒以上の無音あり（&ldquo;Well, let me see...&rdquo; 等のつなぎ語を使うと減点を防げます）
            </span>
          )}
        </div>
      )}
      {clip.transcript && (
        <p lang="en" className="swr-muted-note">
          <strong>【音声認識プレビュー】</strong> &ldquo;{clip.transcript}&rdquo;
        </p>
      )}
    </div>
  );
}

export interface ScbtSpeakingPracticeProps {
  uid: string;
  grade: EikenGrade;
  onGrade?: (grade: EikenGrade) => void;
  onBack: () => void;
}

export function ScbtSpeakingPractice({
  uid,
  grade,
  onGrade,
  onBack,
}: ScbtSpeakingPracticeProps) {
  const [gradeFilter, setGradeFilter] = useState<GradeFilterId>(() =>
    grade === 'eiken_3'
      ? 'eiken_3'
      : grade === 'eiken_pre2'
      ? 'eiken_pre2'
      : grade === 'eiken_pre2plus'
      ? 'eiken_pre2plus'
      : grade === 'eiken_2'
      ? 'eiken_2'
      : 'all',
  );
  const availableSets = useMemo(
    () =>
      SCBT_SPEAKING_SETS.filter(
        s => gradeFilter === 'all' || s.grade === gradeFilter,
      ),
    [gradeFilter],
  );
  const [selectedSet, setSelectedSet] = useState<ScbtSpeakingSet>(
    () => availableSets[0] ?? SCBT_SPEAKING_SETS[0],
  );
  const [step, setStep] = useState<FlowStep>('select');
  const [subPhase, setSubPhase] = useState<'idle' | 'listening' | 'prep' | 'recording' | 'done'>('idle');
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [testClip, setTestClip] = useState<RecordedClip | null>(null);
  const [clips, setClips] = useState<Partial<Record<SugorokuSpeakingPartId, RecordedClip>>>({});
  const [restoredDraftCount, setRestoredDraftCount] = useState<number>(0);
  const [showScriptHint, setShowScriptHint] = useState(false);
  const [showModelAnswers, setShowModelAnswers] = useState(false);
  const [autoExamMode, setAutoExamMode] = useState<boolean>(true);
  const [beepMuted, setBeepMuted] = useState<boolean>(false);

  const [membershipTick, setMembershipTick] = useState(0);
  useEffect(() => subscribeJukuMemberships(() => setMembershipTick((n) => n + 1)), []);
  useEffect(() => {
    if (!uid) return;
    void ensureStudentJukuMemberships(uid);
  }, [uid]);
  const memberships = useMemo(
    () => uniqueJukuMembershipsByClass(loadJukuMemberships(uid)),
    [uid, membershipTick],
  );
  const primaryClassId = memberships[0]?.classId || SUGOROKU_DEMO_CLASS_ID;
  const primaryJukuName = memberships[0]?.className || '';
  const [studentName, setStudentName] = useState<string>(() => {
    return (
      safeLocalStorage()?.getItem(STUDENT_NAME_CACHE_KEY) ||
      auth.currentUser?.displayName ||
      ''
    );
  });
  const [history, setHistory] = useState<SugorokuSpeakingSubmissionDoc[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const activeHandleRef = useRef<ActiveRecordingHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<boolean>(autoExamMode);
  autoAdvanceRef.current = autoExamMode;
  const beepMutedRef = useRef<boolean>(beepMuted);
  beepMutedRef.current = beepMuted;

  const detectedFormat = useMemo(() => detectPreferredAudioMimeType(), []);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (meterTimerRef.current) {
      clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
    }
    setMicLevel(0);
    setLiveTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      activeHandleRef.current?.cancel();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [clearTimers]);

  // セット切り替え時に IndexedDB 退避済みの途中録音があれば自動復元
  useEffect(() => {
    let cancelled = false;
    void loadDraftSpeakingClips(uid, selectedSet.id).then(drafts => {
      if (cancelled) return;
      const count = Object.keys(drafts).length;
      setClips(drafts);
      setRestoredDraftCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, selectedSet.id]);

  const loadMySubmissions = useCallback(async () => {
    const rows = await fetchStudentSpeakingSubmissions(
      primaryClassId,
      uid,
      selectedSet.id,
    );
    setHistory(rows);
  }, [primaryClassId, uid, selectedSet.id]);

  useEffect(() => {
    void loadMySubmissions();
  }, [loadMySubmissions]);

  const goToStepRef = useRef<(next: FlowStep) => void>(() => undefined);

  const stopCurrentRecording = useCallback(
    async (target: SugorokuSpeakingPartId | 'mic_test') => {
      clearTimers();
      const handle = activeHandleRef.current;
      activeHandleRef.current = null;
      if (!handle) return;
      try {
        const clip = await handle.stop();
        playScbtBeep('end', beepMutedRef.current);
        if (target === 'mic_test') {
          setTestClip(clip);
          setSubPhase('done');
        } else {
          setClips(prev => ({ ...prev, [target]: clip }));
          void saveDraftSpeakingClip(uid, selectedSet.id, target, clip);
          setSubPhase('done');
          if (autoAdvanceRef.current) {
            setTimeout(() => {
              goToStepRef.current(NEXT_STEP_AFTER_PART[target]);
            }, 650);
          }
        }
      } catch (err) {
        setSubPhase('idle');
        setErrorMsg(err instanceof Error ? err.message : '録音の保存に失敗しました。');
      }
    },
    [clearTimers, selectedSet.id, uid],
  );

  const beginRecordingForPart = useCallback(
    async (target: SugorokuSpeakingPartId | 'mic_test', limitSeconds: number) => {
      clearTimers();
      setErrorMsg('');
      try {
        playScbtBeep('start', beepMutedRef.current);
        const handle = await startAudioRecording();
        activeHandleRef.current = handle;
        setSubPhase('recording');
        setSecondsLeft(limitSeconds);

        meterTimerRef.current = setInterval(() => {
          setMicLevel(handle.getLevel());
          setLiveTranscript(handle.getTranscript());
        }, 120);

        timerRef.current = setInterval(() => {
          setSecondsLeft(prev => {
            if (prev <= 1) {
              void stopCurrentRecording(target);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } catch (err) {
        setSubPhase('idle');
        setErrorMsg(err instanceof Error ? err.message : 'マイクを起動できませんでした。');
      }
    },
    [clearTimers, stopCurrentRecording],
  );

  const startCountdownThenRecord = useCallback(
    (partId: SugorokuSpeakingPartId, prepSec: number, recSec: number) => {
      clearTimers();
      setErrorMsg('');
      setSubPhase('prep');
      setSecondsLeft(prepSec);
      timerRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearTimers();
            void beginRecordingForPart(partId, recSec);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [beginRecordingForPart, clearTimers],
  );

  const goToStep = useCallback(
    (next: FlowStep) => {
      clearTimers();
      activeHandleRef.current?.cancel();
      activeHandleRef.current = null;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setErrorMsg('');
      setShowScriptHint(false);
      setSubPhase('idle');
      setStep(next);

      if (next === 'silent_read') {
        setSubPhase('prep');
        setSecondsLeft(selectedSet.silentReadSeconds);
        timerRef.current = setInterval(() => {
          setSecondsLeft(prev => {
            if (prev <= 1) {
              clearTimers();
              setStep('read_aloud');
              setSubPhase('idle');
              if (autoAdvanceRef.current) {
                void beginRecordingForPart('reading_aloud', selectedSet.readAloudSeconds);
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return;
      }

      if (
        autoAdvanceRef.current &&
        (next === 'q1' || next === 'q2' || next === 'q3' || next === 'q4')
      ) {
        const q = selectedSet.questions.find(item => item.partId === next);
        if (q) {
          setSubPhase('listening');
          const script = [q.introAudioScript, q.promptAudioScript].filter(Boolean).join(' ');
          speakEnglishPrompt(script, () => {
            startCountdownThenRecord(q.partId, q.prepSeconds, q.recordSeconds);
          });
        }
      }
    },
    [beginRecordingForPart, clearTimers, selectedSet, startCountdownThenRecord],
  );

  goToStepRef.current = goToStep;

  const currentQuestion = useMemo(() => {
    if (step === 'q1' || step === 'q2' || step === 'q3' || step === 'q4') {
      return selectedSet.questions.find(q => q.partId === step) ?? null;
    }
    return null;
  }, [selectedSet, step]);

  const handleClearDrafts = async () => {
    await clearDraftSpeakingClips(uid, selectedSet.id);
    setClips({});
    setRestoredDraftCount(0);
  };

  const handleSubmitAll = async () => {
    const cleanName = studentName.trim() || auth.currentUser?.displayName || 'すごろく塾生';
    safeLocalStorage()?.setItem(STUDENT_NAME_CACHE_KEY, cleanName);

    setSubmitting(true);
    setErrorMsg('');
    setSubmittedNotice('');
    try {
      await submitSpeakingSession({
        classId: primaryClassId,
        studentUid: uid,
        studentName: cleanName,
        grade: selectedSet.grade,
        set: selectedSet,
        clips: {
          reading_aloud: clips.reading_aloud
            ? { partId: 'reading_aloud', ...clips.reading_aloud }
            : undefined,
          q1: clips.q1 ? { partId: 'q1', ...clips.q1 } : undefined,
          q2: clips.q2 ? { partId: 'q2', ...clips.q2 } : undefined,
          q3: clips.q3 ? { partId: 'q3', ...clips.q3 } : undefined,
          q4: clips.q4 ? { partId: 'q4', ...clips.q4 } : undefined,
        },
      });
      setRestoredDraftCount(0);
      await loadMySubmissions();
      setSubmittedNotice(
        '全5パートの録音を先生へ提出しました！先生が聴取・評価すると講評シートをA4印刷・PDF保存できます。',
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '提出に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const recordedCount = SCBT_PART_ORDER.filter(p => Boolean(clips[p])).length;

  return (
    <main className="scbt-page" data-sugoroku-speaking>
      <header className="scbt-header">
        <div className="twr-row-wrap">
          <button
            type="button"
            className="scbt-back-btn"
            onClick={() => {
              if (step === 'select') onBack();
              else goToStep('select');
            }}
          >
            <ArrowLeft size={17} aria-hidden="true" />
            {step === 'select' ? '学習へ戻る' : 'セット一覧へ'}
          </button>
          <div>
            <h1 className="srh-title">英検 S-CBT スピーキング模擬演習</h1>
            <small className="swr-muted-note">
              本番準拠タイマー・発話率計測・自動退避つき（形式：{detectedFormat.label}）
            </small>
          </div>
        </div>
        <div className="twr-row-wrap">
          <button
            type="button"
            className={
              autoExamMode
                ? 'scbt-secondary-btn scbt-auto-btn-active'
                : 'scbt-secondary-btn'
            }
            onClick={() => setAutoExamMode(v => !v)}
            title="ONにすると本番S-CBT同様に黙読→音読→質問音声→準備→録音まで自動で進みます"
            data-scbt-auto-mode={autoExamMode}
          >
            <Zap size={15} aria-hidden="true" />
            {autoExamMode ? '本番ノンストップ進行：ON' : '手動ステップ練習：ON'}
          </button>
          <button
            type="button"
            className="scbt-secondary-btn"
            onClick={() => setBeepMuted(v => !v)}
            title="録音開始時の「ピッ」という合図音のON/OFF"
          >
            {beepMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            {beepMuted ? '合図音OFF' : '合図音ON'}
          </button>
          {primaryJukuName && (
            <small className="swr-muted-note">連携中：{primaryJukuName}</small>
          )}
        </div>
      </header>

      {errorMsg && (
        <div role="alert" className="scbt-alert-box">
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {restoredDraftCount > 0 && step === 'select' && (
        <div className="scbt-ok-bar" role="status">
          <strong className="swr-check-ok">
            前回の途中録音（{selectedSet.title}：{restoredDraftCount}/5 パート）を端末から自動復元しました！
          </strong>
          <div className="twr-row-wrap">
            <button
              type="button"
              className="scbt-primary-btn swr-mini-btn"
              onClick={() => {
                setAutoExamMode(false);
                goToStep('review_submit');
              }}
            >
              復元した録音を確認・続きから再開 →
            </button>
            <button
              type="button"
              className="scbt-secondary-btn swr-mini-btn"
              onClick={() => void handleClearDrafts()}
            >
              <Trash2 size={13} aria-hidden="true" />
              破棄して最初から
            </button>
          </div>
        </div>
      )}

      {step === 'select' && (
        <section className="scbt-card" aria-label="スピーキング模擬セット選択">
          <div className="twr-row-between">
            <div className="twr-row-wrap">
              {(
                [
                  ['all', 'すべて（全8セット）'],
                  ['eiken_2', '英検2級（2）'],
                  ['eiken_pre2plus', '準2級プラス（2）'],
                  ['eiken_pre2', '英検準2級（2）'],
                  ['eiken_3', '英検3級（2）'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="scbt-step-pill"
                  data-active={gradeFilter === id}
                  onClick={() => {
                    setGradeFilter(id);
                    if (id !== 'all') onGrade?.(id);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <small className="swr-muted-note">
              完全オリジナル模擬課題（過去問・市販書流用なし／3級〜2級 全8セット）
            </small>
          </div>

          <div className="scbt-set-grid">
            {availableSets.map(item => {
              const gLabel =
                EIKEN_GRADES.find(g => g.id === item.grade)?.label ?? item.grade;
              const isCurrent = selectedSet.id === item.id;
              return (
                <div
                  key={item.id}
                  className="scbt-set-card"
                  data-current={isCurrent}
                  onClick={() => setSelectedSet(item)}
                >
                  <div>
                    <span className="scbt-set-badge">
                      {gLabel} ・ Set {item.setNumber}
                    </span>
                    <h2 className="scbt-set-title">{item.title}</h2>
                    <p className="scbt-set-desc">{item.themeSummaryJp}</p>
                  </div>
                  <button
                    type="button"
                    className="scbt-primary-btn"
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedSet(item);
                      setSubmittedNotice('');
                      setShowModelAnswers(false);
                      goToStep('mic_check');
                    }}
                    data-scbt-start-set={item.id}
                  >
                    <Mic size={16} aria-hidden="true" />
                    このセットでS-CBT演習を始める
                  </button>
                </div>
              );
            })}
          </div>

          {history.length > 0 && (
            <div className="scbt-history-wrap">
              <h3 className="scbt-set-title">
                選択中セット（{selectedSet.title}）の提出・講師フィードバック履歴
              </h3>
              {history.slice(0, 3).map(sub => (
                <div key={sub.id} className="scbt-history-card">
                  <div className="twr-row-between">
                    <strong>
                      {sub.status === 'reviewed'
                        ? '先生から音声講評が届いています！'
                        : '提出済み（先生の音声確認待ち）'}
                    </strong>
                    <div className="twr-row-wrap">
                      <small className="swr-muted-note">
                        {new Date(sub.submittedAt).toLocaleString('ja-JP')}
                      </small>
                      <button
                        type="button"
                        className="scbt-secondary-btn swr-mini-btn"
                        onClick={() =>
                          openSpeakingFeedbackPrintWindow(
                            sub,
                            findSpeakingSetById(sub.setId) ?? selectedSet,
                          )
                        }
                      >
                        <Printer size={13} aria-hidden="true" />
                        A4復習シート印刷/PDF
                      </button>
                    </div>
                  </div>
                  {sub.review && <p className="swr-comment-body">{sub.review.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {step !== 'select' && (
        <nav className="scbt-stepper" aria-label="S-CBT進行ステップ">
          {(
            [
              ['mic_check', '① マイク確認'],
              ['silent_read', '② 黙読 (20秒)'],
              ['read_aloud', '③ 音読録音'],
              ['q1', '④ No.1'],
              ['q2', '⑤ No.2'],
              ['q3', '⑥ No.3'],
              ['q4', '⑦ No.4'],
              ['review_submit', `⑧ 確認・提出 (${recordedCount}/5)`],
            ] as const
          ).map(([id, label]) => {
            const isPartDone =
              id === 'read_aloud'
                ? Boolean(clips.reading_aloud)
                : id === 'q1' || id === 'q2' || id === 'q3' || id === 'q4'
                ? Boolean(clips[id])
                : id === 'mic_check'
                ? Boolean(testClip)
                : false;
            return (
              <button
                key={id}
                type="button"
                className="scbt-step-pill"
                data-active={step === id}
                data-done={isPartDone}
                onClick={() => goToStep(id)}
              >
                {label}
              </button>
            );
          })}
        </nav>
      )}

      {step === 'mic_check' && (
        <section className="scbt-card" aria-label="マイク確認">
          <h2 className="scbt-set-title">Step 1：マイク音量・録音テスト（S-CBT本番形式）</h2>
          <p className="scbt-set-desc">
            本番の S-CBT と同じように、最初に声がしっかり録音されるかテストします。
            下のボタンを押して「ピッ」と鳴ったら{' '}
            <strong>&ldquo;Hello, I am ready for the speaking test.&rdquo;</strong>{' '}
            と話してみてください。
          </p>

          <div className="scbt-timer-box" data-recording={subPhase === 'recording'}>
            <div>
              <strong>
                {subPhase === 'recording'
                  ? 'テスト録音中… 声を出して緑のレベルバーが動くか確認してください'
                  : 'マイク入力レベル'}
              </strong>
              <div className="scbt-meter-track">
                <div className="scbt-meter-fill" style={{ width: `${micLevel}%` }} />
              </div>
              {subPhase === 'recording' && liveTranscript && (
                <small lang="en" className="swr-muted-note">
                  認識中: {liveTranscript}
                </small>
              )}
            </div>
            <div className="twr-row-wrap">
              {subPhase !== 'recording' ? (
                <button
                  type="button"
                  className="scbt-primary-btn"
                  onClick={() => void beginRecordingForPart('mic_test', 8)}
                >
                  <Mic size={16} aria-hidden="true" />
                  テスト録音を開始（最大8秒）
                </button>
              ) : (
                <button
                  type="button"
                  className="scbt-danger-btn"
                  onClick={() => void stopCurrentRecording('mic_test')}
                >
                  <Square size={15} aria-hidden="true" />
                  停止する（残り {secondsLeft}秒）
                </button>
              )}
            </div>
          </div>

          {testClip && (
            <div className="scbt-ok-bar">
              <strong className="swr-check-ok">
                <CheckCircle2 size={16} /> テスト録音OK（{testClip.durationSec}秒・
                {Math.round(testClip.sizeBytes / 1024)}KB）
              </strong>
              <audio controls src={testClip.objectUrl} preload="metadata" />
            </div>
          )}

          <div className="twr-importer-actions">
            <button
              type="button"
              className="scbt-primary-btn"
              onClick={() => goToStep('silent_read')}
            >
              問題カードを開いて黙読（20秒）へ進む →
            </button>
          </div>
        </section>
      )}

      {(step === 'silent_read' || step === 'read_aloud') && (
        <section className="scbt-card" aria-label="パッセージ黙読と音読">
          <div className="scbt-timer-box" data-recording={subPhase === 'recording'}>
            <div>
              <strong>
                {step === 'silent_read'
                  ? '【黙読タイム】声に出さず、パッセージ全体に目を通してください（終了後に音読へ移ります）'
                  : subPhase === 'recording'
                  ? '【音読録音中】タイトルから最後までハキハキと音読してください！'
                  : '【音読パート】録音ボタンを押してタイトルから音読してください'}
              </strong>
              <div className="swr-muted-note">
                制限時間目安：{selectedSet.readAloudSeconds}秒（読み終えたら「録音完了」を押せます）
              </div>
              {subPhase === 'recording' && (
                <div className="scbt-meter-track">
                  <div className="scbt-meter-fill" style={{ width: `${micLevel}%` }} />
                </div>
              )}
            </div>
            <div className="twr-row-wrap">
              {(step === 'silent_read' || subPhase === 'recording') && (
                <span className="scbt-timer-num">{secondsLeft}s</span>
              )}
              {step === 'silent_read' && (
                <button
                  type="button"
                  className="scbt-secondary-btn"
                  onClick={() => {
                    clearTimers();
                    setStep('read_aloud');
                    setSubPhase('idle');
                    if (autoExamMode) {
                      void beginRecordingForPart(
                        'reading_aloud',
                        selectedSet.readAloudSeconds,
                      );
                    }
                  }}
                >
                  すぐ音読録音へ進む
                </button>
              )}
              {step === 'read_aloud' && subPhase !== 'recording' && (
                <button
                  type="button"
                  className="scbt-primary-btn"
                  onClick={() =>
                    void beginRecordingForPart(
                      'reading_aloud',
                      selectedSet.readAloudSeconds,
                    )
                  }
                >
                  <Mic size={16} aria-hidden="true" />
                  {clips.reading_aloud ? '音読を録り直す' : '音読の録音を開始'}
                </button>
              )}
              {step === 'read_aloud' && subPhase === 'recording' && (
                <button
                  type="button"
                  className="scbt-danger-btn"
                  onClick={() => void stopCurrentRecording('reading_aloud')}
                >
                  <Square size={15} aria-hidden="true" />
                  録音完了
                </button>
              )}
            </div>
          </div>

          <article className="scbt-passage-card" lang="en">
            <h2 className="scbt-passage-title">{selectedSet.cardTitle}</h2>
            <p className="scbt-passage-text">{selectedSet.passage}</p>
          </article>

          {clips.reading_aloud && subPhase !== 'recording' && (
            <div className="scbt-review-part-row">
              <div className="twr-row-between">
                <strong className="swr-check-ok">
                  音読を録音しました（{clips.reading_aloud.durationSec}秒）
                </strong>
                <audio controls src={clips.reading_aloud.objectUrl} preload="metadata" />
                <button
                  type="button"
                  className="scbt-primary-btn"
                  onClick={() => goToStep('q1')}
                >
                  No. 1 の質問へ進む →
                </button>
              </div>
              {renderClipTelemetry(clips.reading_aloud)}
            </div>
          )}
        </section>
      )}

      {currentQuestion && (
        <section className="scbt-card" aria-label={currentQuestion.numberLabel}>
          <div className="twr-row-between">
            <h2 className="scbt-set-title">
              {currentQuestion.numberLabel}（準備 {currentQuestion.prepSeconds}秒 → 回答{' '}
              {currentQuestion.recordSeconds}秒）
            </h2>
            <div className="twr-row-wrap">
              <button
                type="button"
                className="scbt-secondary-btn"
                onClick={() =>
                  speakEnglishPrompt(
                    [currentQuestion.introAudioScript, currentQuestion.promptAudioScript]
                      .filter(Boolean)
                      .join(' '),
                  )
                }
              >
                <Volume2 size={16} aria-hidden="true" />
                面接官の質問音声をもう一度聞く
              </button>
              {!currentQuestion.showPromptOnScreenByDefault && (
                <button
                  type="button"
                  className="scbt-secondary-btn"
                  onClick={() => setShowScriptHint(v => !v)}
                >
                  {showScriptHint ? '質問文の英語表示を隠す' : '練習サポート：質問文を表示'}
                </button>
              )}
            </div>
          </div>

          {currentQuestion.partId === 'q1' && (
            <article className="scbt-passage-card" lang="en">
              <h3 className="scbt-passage-title">{selectedSet.cardTitle}</h3>
              <p className="scbt-passage-text">{selectedSet.passage}</p>
            </article>
          )}

          {(currentQuestion.partId === 'q2' ||
            (currentQuestion.partId === 'q3' &&
              currentQuestion.questionType === 'picture_action_state')) && (
            <ScbtIllustrationCard frames={selectedSet.illustrations} />
          )}

          {currentQuestion.starterSentence && (
            <div className="scbt-starter-box">
              <span className="scbt-starter-label">
                最初の文（この文を声に出してから続けて話してください）：
              </span>
              <strong lang="en">{currentQuestion.starterSentence}</strong>
            </div>
          )}

          {(currentQuestion.showPromptOnScreenByDefault || showScriptHint) && (
            <div lang="en" className="scbt-prompt-box">
              {currentQuestion.promptAudioScript}
            </div>
          )}

          <div className="scbt-timer-box" data-recording={subPhase === 'recording'}>
            <div>
              <strong>
                {subPhase === 'listening'
                  ? '【面接官の質問読み上げ中】よく聞いてください（終了後自動で準備タイマーが始まります）'
                  : subPhase === 'prep'
                  ? '【準備カウントダウン】話す内容を組み立ててください（0秒でピッと鳴り録音開始）'
                  : subPhase === 'recording'
                  ? '【回答録音中】英語でハキハキと回答を話してください！'
                  : '「準備→自動録音」または「すぐ回答を録音」を押してください'}
              </strong>
              {subPhase === 'recording' && (
                <>
                  <div className="scbt-meter-track">
                    <div className="scbt-meter-fill" style={{ width: `${micLevel}%` }} />
                  </div>
                  {liveTranscript && (
                    <small lang="en" className="swr-muted-note">
                      認識中: {liveTranscript}
                    </small>
                  )}
                </>
              )}
            </div>

            <div className="twr-row-wrap">
              {(subPhase === 'prep' || subPhase === 'recording') && (
                <span className="scbt-timer-num">{secondsLeft}s</span>
              )}
              {subPhase === 'idle' || subPhase === 'done' || subPhase === 'listening' ? (
                <>
                  <button
                    type="button"
                    className="scbt-secondary-btn"
                    onClick={() => {
                      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                      }
                      startCountdownThenRecord(
                        currentQuestion.partId,
                        currentQuestion.prepSeconds,
                        currentQuestion.recordSeconds,
                      );
                    }}
                  >
                    <Play size={15} aria-hidden="true" />
                    準備（{currentQuestion.prepSeconds}秒）→自動録音
                  </button>
                  <button
                    type="button"
                    className="scbt-primary-btn"
                    onClick={() => {
                      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                      }
                      void beginRecordingForPart(
                        currentQuestion.partId,
                        currentQuestion.recordSeconds,
                      );
                    }}
                  >
                    <Mic size={16} aria-hidden="true" />
                    {clips[currentQuestion.partId] ? '録り直す' : 'すぐ回答を録音'}
                  </button>
                </>
              ) : subPhase === 'prep' ? (
                <button
                  type="button"
                  className="scbt-primary-btn"
                  onClick={() =>
                    void beginRecordingForPart(
                      currentQuestion.partId,
                      currentQuestion.recordSeconds,
                    )
                  }
                >
                  準備をスキップして録音開始
                </button>
              ) : (
                <button
                  type="button"
                  className="scbt-danger-btn"
                  onClick={() => void stopCurrentRecording(currentQuestion.partId)}
                >
                  <Square size={15} aria-hidden="true" />
                  回答を完了する
                </button>
              )}
            </div>
          </div>

          {clips[currentQuestion.partId] && subPhase !== 'recording' && (
            <div className="scbt-review-part-row">
              <div className="twr-row-between">
                <strong className="swr-check-ok">
                  {currentQuestion.numberLabel} を録音しました（
                  {clips[currentQuestion.partId]!.durationSec}秒）
                </strong>
                <audio
                  controls
                  src={clips[currentQuestion.partId]!.objectUrl}
                  preload="metadata"
                />
                <button
                  type="button"
                  className="scbt-primary-btn"
                  onClick={() => goToStep(NEXT_STEP_AFTER_PART[currentQuestion.partId])}
                >
                  {currentQuestion.partId === 'q4'
                    ? '自己再生確認・先生への提出へ →'
                    : '次の質問へ進む →'}
                </button>
              </div>
              {renderClipTelemetry(clips[currentQuestion.partId])}
            </div>
          )}
        </section>
      )}

      {step === 'review_submit' && (
        <section className="scbt-card" aria-label="自己再生確認と先生への提出">
          <div className="twr-row-between">
            <div>
              <h2 className="scbt-set-title">全パート自己再生確認 ＆ 先生へ提出</h2>
              <p className="scbt-set-desc">
                自分の録音・発話率・認識プレビューを確認し、気になるパートだけ録り直せます（録音済み：
                <strong> {recordedCount} / 5 パート</strong>・自動退避済）。
              </p>
            </div>
            <div className="twr-row-wrap">
              <button
                type="button"
                className="scbt-secondary-btn"
                onClick={() => setShowModelAnswers(v => !v)}
              >
                {showModelAnswers ? '模範解答・ポイントを閉じる' : '模範解答・ポイントを見る'}
              </button>
              <button
                type="button"
                className="scbt-secondary-btn"
                onClick={() =>
                  openSpeakingFeedbackPrintWindow(
                    {
                      id: 'draft_preview',
                      classId: primaryClassId,
                      studentUid: uid,
                      studentName: studentName.trim() || 'すごろく塾生',
                      grade: selectedSet.grade,
                      setId: selectedSet.id,
                      setTitle: selectedSet.title,
                      recordings: SCBT_PART_ORDER.filter(p => Boolean(clips[p])).map(p => ({
                        partId: p,
                        storagePath: '',
                        mimeType: clips[p]!.mimeType,
                        durationSec: clips[p]!.durationSec,
                        speechRatio: clips[p]!.speechRatio,
                        maxSilenceSec: clips[p]!.maxSilenceSec,
                        transcript: clips[p]!.transcript,
                      })),
                      status: 'submitted',
                      submittedAt: Date.now(),
                    },
                    selectedSet,
                  )
                }
              >
                <Printer size={15} aria-hidden="true" />
                音読＆模範解答シート印刷
              </button>
            </div>
          </div>

          <div className="twr-list">
            {SCBT_PART_ORDER.map(partId => {
              const clip = clips[partId];
              const qSpec =
                partId === 'reading_aloud'
                  ? null
                  : selectedSet.questions.find(q => q.partId === partId);
              const targetStep: FlowStep =
                partId === 'reading_aloud' ? 'read_aloud' : partId;

              return (
                <div key={partId} className="scbt-review-part-row">
                  <div className="twr-row-between">
                    <div>
                      <strong>{SCBT_PART_LABELS[partId]}</strong>{' '}
                      {clip ? (
                        <span className="twr-pill-done">
                          録音済（{clip.durationSec}秒・{Math.round(clip.sizeBytes / 1024)}KB）
                        </span>
                      ) : (
                        <span className="twr-pill-pending">未録音</span>
                      )}
                    </div>
                    <div className="twr-row-wrap">
                      {clip && <audio controls src={clip.objectUrl} preload="metadata" />}
                      <button
                        type="button"
                        className="scbt-secondary-btn"
                        onClick={() => {
                          setAutoExamMode(false);
                          goToStep(targetStep);
                        }}
                      >
                        <RotateCcw size={14} aria-hidden="true" />
                        {clip ? 'このパートだけ録り直す' : '録音する'}
                      </button>
                    </div>
                  </div>

                  {renderClipTelemetry(clip)}

                  {showModelAnswers && (
                    <div className="scbt-model-box">
                      {partId === 'reading_aloud' ? (
                        <>
                          <p lang="en">
                            <strong>【本文】</strong> {selectedSet.passage}
                          </p>
                          <p className="swr-muted-note">
                            <strong>【和訳】</strong> {selectedSet.passageTranslation}
                          </p>
                        </>
                      ) : (
                        qSpec && (
                          <>
                            <p lang="en">
                              <strong>【質問】</strong> {qSpec.promptAudioScript}
                            </p>
                            <p lang="en" className="swr-check-ok">
                              <strong>【模範解答例】</strong> {qSpec.modelAnswer}
                            </p>
                            <p className="swr-muted-note">
                              <strong>【和訳】</strong> {qSpec.modelTranslation}
                            </p>
                          </>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="scbt-submit-footer">
            <input
              type="text"
              className="scbt-input"
              aria-label="提出者氏名"
              placeholder="氏名（例：山田 太郎）"
              value={studentName}
              maxLength={40}
              onChange={e => setStudentName(e.target.value)}
            />
            <button
              type="button"
              className="scbt-primary-btn"
              disabled={submitting || recordedCount < SCBT_PART_ORDER.length}
              onClick={() => void handleSubmitAll()}
              data-sugoroku-submit-speaking
            >
              <Send size={16} aria-hidden="true" />
              {submitting
                ? '音声をアップロード中…'
                : recordedCount < SCBT_PART_ORDER.length
                ? `全5パート録音すると提出できます（現在 ${recordedCount}/5）`
                : '全5パートの録音を塾の先生へ提出する'}
            </button>
          </div>

          {submittedNotice && (
            <p role="status" className="twr-notice-ok">
              {submittedNotice}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
