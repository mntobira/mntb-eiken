import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Mic,
  Play,
  RotateCcw,
  Send,
  Square,
  Volume2,
} from 'lucide-react';
import { auth } from '../../firebase';
import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import { loadJukuMemberships } from '../../utils/classAssignments';
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
import { SCBT_SPEAKING_SETS } from './mockSpeakingSets';
import { ScbtIllustrationCard } from './ScbtIllustrationCard';
import {
  fetchStudentSpeakingSubmissions,
  submitSpeakingSession,
} from './speakingStore';
import {
  SCBT_PART_LABELS,
  SCBT_PART_ORDER,
  type ScbtSpeakingSet,
} from './speakingTypes';
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

const STUDENT_NAME_CACHE_KEY = 'sugoroku_student_name_v1';

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
    utter.onend = () => onEnd?.();
    utter.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utter);
  } catch {
    onEnd?.();
  }
}

export interface ScbtSpeakingPracticeProps {
  uid: string;
  grade: EikenGrade;
  onGrade?: (grade: EikenGrade) => void;
  onBack: () => void;
  onOpenTeacherReview?: () => void;
}

export function ScbtSpeakingPractice({
  uid,
  grade,
  onGrade,
  onBack,
  onOpenTeacherReview,
}: ScbtSpeakingPracticeProps) {
  const [gradeFilter, setGradeFilter] = useState<'all' | 'eiken_2' | 'eiken_pre2'>(() =>
    grade === 'eiken_pre2' ? 'eiken_pre2' : grade === 'eiken_2' ? 'eiken_2' : 'all',
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
  const [subPhase, setSubPhase] = useState<'idle' | 'prep' | 'recording' | 'done'>('idle');
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [testClip, setTestClip] = useState<RecordedClip | null>(null);
  const [clips, setClips] = useState<Partial<Record<SugorokuSpeakingPartId, RecordedClip>>>({});
  const [showScriptHint, setShowScriptHint] = useState(false);
  const [showModelAnswers, setShowModelAnswers] = useState(false);

  const memberships = useMemo(() => loadJukuMemberships(uid), [uid]);
  const [selectedClassId, setSelectedClassId] = useState<string>(
    () => memberships[0]?.classId || SUGOROKU_DEMO_CLASS_ID,
  );
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

  const loadMySubmissions = useCallback(async () => {
    const rows = await fetchStudentSpeakingSubmissions(
      selectedClassId,
      uid,
      selectedSet.id,
    );
    setHistory(rows);
  }, [selectedClassId, uid, selectedSet.id]);

  useEffect(() => {
    void loadMySubmissions();
  }, [loadMySubmissions]);

  const beginRecordingForPart = useCallback(
    async (target: SugorokuSpeakingPartId | 'mic_test', limitSeconds: number) => {
      clearTimers();
      setErrorMsg('');
      try {
        const handle = await startAudioRecording();
        activeHandleRef.current = handle;
        setSubPhase('recording');
        setSecondsLeft(limitSeconds);

        meterTimerRef.current = setInterval(() => {
          setMicLevel(handle.getLevel());
        }, 100);

        timerRef.current = setInterval(() => {
          setSecondsLeft(prev => {
            if (prev <= 1) {
              // 時間満了で自動停止
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
    [clearTimers],
  );

  const stopCurrentRecording = useCallback(
    async (target: SugorokuSpeakingPartId | 'mic_test') => {
      clearTimers();
      const handle = activeHandleRef.current;
      activeHandleRef.current = null;
      if (!handle) return;
      try {
        const clip = await handle.stop();
        if (target === 'mic_test') {
          setTestClip(clip);
        } else {
          setClips(prev => ({ ...prev, [target]: clip }));
        }
        setSubPhase('done');
      } catch (err) {
        setSubPhase('idle');
        setErrorMsg(err instanceof Error ? err.message : '録音の保存に失敗しました。');
      }
    },
    [clearTimers],
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

  const goToStep = (next: FlowStep) => {
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
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const currentQuestion = useMemo(() => {
    if (step === 'q1' || step === 'q2' || step === 'q3' || step === 'q4') {
      return selectedSet.questions.find(q => q.partId === step) ?? null;
    }
    return null;
  }, [selectedSet, step]);

  const handleSubmitAll = async () => {
    const cleanName = studentName.trim() || auth.currentUser?.displayName || 'すごろく塾生';
    safeLocalStorage()?.setItem(STUDENT_NAME_CACHE_KEY, cleanName);

    setSubmitting(true);
    setErrorMsg('');
    setSubmittedNotice('');
    try {
      await submitSpeakingSession({
        classId: selectedClassId,
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
      await loadMySubmissions();
      setSubmittedNotice(
        '全5パートの録音を先生へ提出しました！先生が聴取・評価するとこの画面にフィードバックが届きます。',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>
              英検 S-CBT スピーキング模擬演習
            </h1>
            <small style={{ color: '#54626f', fontWeight: 700 }}>
              本番準拠タイマー＆自動録音（形式：{detectedFormat.label}）
            </small>
          </div>
        </div>
        {onOpenTeacherReview && (
          <button
            type="button"
            className="scbt-secondary-btn"
            onClick={onOpenTeacherReview}
          >
            講師の音声確認画面を開く
          </button>
        )}
      </header>

      {errorMsg && (
        <div
          role="alert"
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#9f1239',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            fontSize: '13.5px',
            fontWeight: 700,
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step 0: セット選択画面 */}
      {step === 'select' && (
        <section className="scbt-card" aria-label="スピーキング模擬セット選択">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(
                [
                  ['all', 'すべて（2級・準2級）'],
                  ['eiken_2', '英検2級（S-CBT）'],
                  ['eiken_pre2', '英検準2級（S-CBT）'],
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
                  style={{ cursor: 'pointer' }}
                >
                  {label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: '12.5px', color: '#4b5563', fontWeight: 700 }}>
              完全オリジナル模擬課題（過去問・市販書流用なし）
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '12px',
            }}
          >
            {availableSets.map(item => {
              const gLabel =
                EIKEN_GRADES.find(g => g.id === item.grade)?.label ?? item.grade;
              const isCurrent = selectedSet.id === item.id;
              return (
                <div
                  key={item.id}
                  style={{
                    border: isCurrent ? '2px solid #1f6b5c' : '1.5px solid #d7d2c4',
                    borderRadius: '14px',
                    padding: '14px 16px',
                    background: isCurrent ? '#f1faf7' : '#fffefb',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        background: '#e1f4ee',
                        color: '#1f5c51',
                        borderRadius: '999px',
                        padding: '2px 9px',
                        marginBottom: '6px',
                      }}
                    >
                      {gLabel} ・ Set {item.setNumber}
                    </span>
                    <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800 }}>
                      {item.title}
                    </h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#4b5563' }}>
                      {item.themeSummaryJp}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="scbt-primary-btn"
                    onClick={() => {
                      setSelectedSet(item);
                      setClips({});
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

          {/* 返却済みの講師フィードバック表示 */}
          {history.length > 0 && (
            <div
              style={{
                marginTop: '6px',
                borderTop: '1px dashed #d5d0c3',
                paddingTop: '12px',
              }}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 800 }}>
                選択中セット（{selectedSet.title}）の提出・講師フィードバック履歴
              </h3>
              {history.slice(0, 3).map(sub => (
                <div
                  key={sub.id}
                  style={{
                    border: '1px solid #bcd8d1',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    background: '#f7fbfa',
                    marginBottom: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '6px',
                      fontWeight: 800,
                      fontSize: '13.5px',
                    }}
                  >
                    <span>
                      {sub.status === 'reviewed'
                        ? '先生から音声講評が届いています！'
                        : '提出済み（先生の音声確認待ち）'}
                    </span>
                    <small style={{ color: '#54626f' }}>
                      {new Date(sub.submittedAt).toLocaleString('ja-JP')}
                    </small>
                  </div>
                  {sub.review && (
                    <p style={{ margin: '6px 0 0', fontSize: '13.5px', whiteSpace: 'pre-wrap' }}>
                      {sub.review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 演習中プログレスステッパー */}
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
                style={{ cursor: 'pointer' }}
              >
                {label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Step 1: マイク音量チェック */}
      {step === 'mic_check' && (
        <section className="scbt-card" aria-label="マイク確認">
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
            Step 1：マイク音量・録音テスト（S-CBT本番形式）
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: 1.7 }}>
            本番の S-CBT と同じように、最初に声がしっかり録音されるかテストします。
            下のボタンを押して <strong>&ldquo;Hello, my name is ...&rdquo;</strong> と話してみてください。
          </p>

          <div className="scbt-timer-box" data-recording={subPhase === 'recording'}>
            <div>
              <strong style={{ display: 'block', fontSize: '13.5px' }}>
                {subPhase === 'recording'
                  ? 'テスト録音中… 声を出してバーが動くか確認してください'
                  : 'マイク入力レベル'}
              </strong>
              <div className="scbt-meter-track" style={{ marginTop: '6px' }}>
                <div
                  className="scbt-meter-fill"
                  style={{ width: `${micLevel}%` }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
            <div
              style={{
                padding: '12px 14px',
                background: '#f1faf7',
                border: '1px solid #9fd4c5',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1f5c51' }}>
                <CheckCircle2 size={16} style={{ verticalAlign: 'text-bottom' }} />{' '}
                テスト録音OK（{testClip.durationSec}秒・{Math.round(testClip.sizeBytes / 1024)}KB）
              </span>
              <audio controls src={testClip.objectUrl} preload="metadata" />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
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

      {/* Step 2 & 3: パッセージ黙読 ＆ 音読録音 */}
      {(step === 'silent_read' || step === 'read_aloud') && (
        <section className="scbt-card" aria-label="パッセージ黙読と音読">
          <div className="scbt-timer-box" data-recording={subPhase === 'recording'}>
            <div>
              <strong style={{ fontSize: '14.5px', display: 'block' }}>
                {step === 'silent_read'
                  ? '【黙読タイム】声に出さず、パッセージ全体に目を通してください'
                  : subPhase === 'recording'
                  ? '【音読録音中】タイトルから最後までハキハキと音読してください'
                  : '【音読パート】録音ボタンを押してタイトルから音読してください'}
              </strong>
              <small style={{ color: '#4b5563' }}>
                制限時間目安：{selectedSet.readAloudSeconds}秒（早く読み終えたら「録音完了」を押せます）
              </small>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {(step === 'silent_read' || subPhase === 'recording') && (
                <span className="scbt-timer-num">{secondsLeft}s</span>
              )}
              {step === 'silent_read' && (
                <button
                  type="button"
                  className="scbt-secondary-btn"
                  onClick={() => goToStep('read_aloud')}
                >
                  すぐ音読へ進む
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

          {clips.reading_aloud && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                padding: '10px 14px',
                background: '#f1faf7',
                borderRadius: '12px',
                border: '1px solid #9fd4c5',
              }}
            >
              <strong style={{ fontSize: '13.5px', color: '#1f5c51' }}>
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
          )}
        </section>
      )}

      {/* Step 4〜7: No.1 〜 No.4 質問＆録音 */}
      {currentQuestion && (
        <section className="scbt-card" aria-label={currentQuestion.numberLabel}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
              {currentQuestion.numberLabel}（準備 {currentQuestion.prepSeconds}秒 → 回答{' '}
              {currentQuestion.recordSeconds}秒）
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                面接官の質問音声を聞く
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

          {/* No.1〜No.3 では問題カード（パッセージ／イラスト）を表示 */}
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
            <div
              style={{
                padding: '10px 14px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '10px',
                fontSize: '14px',
              }}
            >
              <strong style={{ color: '#92400e', display: 'block', fontSize: '12px' }}>
                最初の文（この文に続けてストーリーを話してください）：
              </strong>
              <span lang="en" style={{ fontWeight: 800 }}>
                {currentQuestion.starterSentence}
              </span>
            </div>
          )}

          {(currentQuestion.showPromptOnScreenByDefault || showScriptHint) && (
            <div
              lang="en"
              style={{
                padding: '12px 14px',
                background: '#f8fafc',
                borderLeft: '4px solid #2f7c74',
                borderRadius: '0 10px 10px 0',
                fontSize: '15px',
                fontWeight: 700,
              }}
            >
              {currentQuestion.promptAudioScript}
            </div>
          )}

          {/* 準備タイマー＆録音バー */}
          <div className="scbt-timer-box" data-recording={subPhase === 'recording'}>
            <div>
              <strong style={{ fontSize: '14px', display: 'block' }}>
                {subPhase === 'prep'
                  ? '【準備カウントダウン】話す内容を頭の中で組み立ててください…'
                  : subPhase === 'recording'
                  ? '【回答録音中】英語で回答を話してください！'
                  : '質問音声を聞いたら「準備タイマー開始」または「すぐ録音」を押してください'}
              </strong>
              {subPhase === 'recording' && (
                <div className="scbt-meter-track" style={{ marginTop: '6px' }}>
                  <div className="scbt-meter-fill" style={{ width: `${micLevel}%` }} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {(subPhase === 'prep' || subPhase === 'recording') && (
                <span className="scbt-timer-num">{secondsLeft}s</span>
              )}
              {subPhase === 'idle' || subPhase === 'done' ? (
                <>
                  <button
                    type="button"
                    className="scbt-secondary-btn"
                    onClick={() =>
                      startCountdownThenRecord(
                        currentQuestion.partId,
                        currentQuestion.prepSeconds,
                        currentQuestion.recordSeconds,
                      )
                    }
                  >
                    <Play size={15} aria-hidden="true" />
                    本番通り準備（{currentQuestion.prepSeconds}秒）→自動録音
                  </button>
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

          {clips[currentQuestion.partId] && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                padding: '10px 14px',
                background: '#f1faf7',
                borderRadius: '12px',
                border: '1px solid #9fd4c5',
              }}
            >
              <strong style={{ fontSize: '13.5px', color: '#1f5c51' }}>
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
                onClick={() => {
                  const nextMap: Record<'q1' | 'q2' | 'q3' | 'q4', FlowStep> = {
                    q1: 'q2',
                    q2: 'q3',
                    q3: 'q4',
                    q4: 'review_submit',
                  };
                  goToStep(nextMap[currentQuestion.partId]);
                }}
              >
                {currentQuestion.partId === 'q4'
                  ? '自己再生確認・先生への提出へ →'
                  : '次の質問へ進む →'}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Step 8: 全5パート自己再生確認・模範解答・講師への提出 */}
      {step === 'review_submit' && (
        <section className="scbt-card" aria-label="自己再生確認と先生への提出">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                全パート自己再生確認 ＆ 先生へ提出
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4b5563' }}>
                自分の録音を聴き直し、気になるパートは何度でも録り直せます（録音済み：
                <strong> {recordedCount} / 5 パート</strong>）。
              </p>
            </div>
            <button
              type="button"
              className="scbt-secondary-btn"
              onClick={() => setShowModelAnswers(v => !v)}
            >
              {showModelAnswers ? '模範解答・ポイントを閉じる' : '模範解答・ポイントを見る'}
            </button>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
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
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '14px' }}>
                        {SCBT_PART_LABELS[partId]}
                      </strong>
                      {clip ? (
                        <span
                          style={{
                            marginLeft: '8px',
                            fontSize: '12px',
                            color: '#1f6b5c',
                            fontWeight: 800,
                          }}
                        >
                          録音済（{clip.durationSec}秒・{Math.round(clip.sizeBytes / 1024)}KB）
                        </span>
                      ) : (
                        <span
                          style={{
                            marginLeft: '8px',
                            fontSize: '12px',
                            color: '#b45309',
                            fontWeight: 800,
                          }}
                        >
                          未録音
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {clip && (
                        <audio controls src={clip.objectUrl} preload="metadata" />
                      )}
                      <button
                        type="button"
                        className="scbt-secondary-btn"
                        onClick={() => goToStep(targetStep)}
                      >
                        <RotateCcw size={14} aria-hidden="true" />
                        {clip ? '録り直す' : '録音する'}
                      </button>
                    </div>
                  </div>

                  {showModelAnswers && (
                    <div
                      style={{
                        borderTop: '1px dashed #d8d2c3',
                        paddingTop: '8px',
                        fontSize: '13px',
                        display: 'grid',
                        gap: '4px',
                      }}
                    >
                      {partId === 'reading_aloud' ? (
                        <>
                          <p style={{ margin: 0 }} lang="en">
                            <strong>【本文】</strong> {selectedSet.passage}
                          </p>
                          <p style={{ margin: 0, color: '#4b5563' }}>
                            <strong>【和訳】</strong> {selectedSet.passageTranslation}
                          </p>
                        </>
                      ) : (
                        qSpec && (
                          <>
                            <p style={{ margin: 0 }} lang="en">
                              <strong>【質問】</strong> {qSpec.promptAudioScript}
                            </p>
                            <p style={{ margin: 0, color: '#1f5c51' }} lang="en">
                              <strong>【模範解答例】</strong> {qSpec.modelAnswer}
                            </p>
                            <p style={{ margin: 0, color: '#4b5563' }}>
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

          <div
            style={{
              borderTop: '1.5px solid #e2ddd0',
              paddingTop: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            {memberships.length > 1 && (
              <select
                aria-label="提出先クラス"
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                style={{
                  minHeight: '40px',
                  borderRadius: '10px',
                  border: '1px solid #b8cec9',
                  padding: '6px 10px',
                  fontWeight: 700,
                }}
              >
                {memberships.map(m => (
                  <option key={m.classId} value={m.classId}>
                    {m.className}
                  </option>
                ))}
              </select>
            )}
            <input
              type="text"
              aria-label="提出者氏名"
              placeholder="氏名（例：山田 太郎）"
              value={studentName}
              maxLength={40}
              onChange={e => setStudentName(e.target.value)}
              style={{
                minHeight: '40px',
                borderRadius: '10px',
                border: '1px solid #b8cec9',
                padding: '6px 12px',
                fontSize: '14px',
              }}
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
                : '全5パートの録音を先生へ提出する'}
            </button>
          </div>

          {submittedNotice && (
            <p
              role="status"
              style={{
                margin: 0,
                fontSize: '13.5px',
                fontWeight: 800,
                color: '#1f6b5c',
              }}
            >
              {submittedNotice}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
