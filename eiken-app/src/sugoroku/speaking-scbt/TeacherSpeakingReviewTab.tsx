import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  Clock,
  Copy,
  Download,
  FastForward,
  Pause,
  Play,
  Printer,
  RefreshCw,
  Send,
} from 'lucide-react';
import { EIKEN_GRADES } from '../../eiken/config';
import {
  buildSpeakingSubmissionsCsv,
  downloadUtf8BomCsv,
} from '../shared/csvExport';
import type {
  SugorokuAdminReviewTabProps,
  SugorokuSpeakingPartId,
  SugorokuSpeakingSubmissionDoc,
} from '../shared/types';
import { resolveSpeakingAudioUrl } from '../shared/storageClient';
import { SUGOROKU_DEMO_CLASS_ID } from '../writing-review/writingStore';
import { findSpeakingSetById } from './mockSpeakingSets';
import {
  buildSpeakingAiCoachPrompt,
  openSpeakingFeedbackPrintWindow,
  parseSpeakingAiReviewResponse,
} from './speakingFeedbackSheet';
import {
  fetchClassSpeakingSubmissions,
  saveSpeakingReview,
} from './speakingStore';
import { SCBT_PART_LABELS, SCBT_PART_ORDER } from './speakingTypes';
import '../writing-review/writing-review.css';
import './speaking-scbt.css';

const PLAYBACK_SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0] as const;

export function TeacherSpeakingReviewTab({
  classId,
  reviewerUid,
  reviewerName = 'すごろく英検担当講師',
  demoMode = false,
  submissions,
}: SugorokuAdminReviewTabProps & { submissions?: readonly SugorokuSpeakingSubmissionDoc[] }) {
  const effectiveClassId = classId || SUGOROKU_DEMO_CLASS_ID;
  const [items, setItems] = useState<SugorokuSpeakingSubmissionDoc[]>(() =>
    submissions ? [...submissions] : [],
  );
  const [loading, setLoading] = useState(() => !submissions);
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'reviewed'>('all');
  const [selectedId, setSelectedId] = useState<string>('');
  const [speed, setSpeed] = useState<number>(1.0);
  const [audioUrls, setAudioUrls] = useState<Partial<Record<SugorokuSpeakingPartId, string>>>({});
  const [continuousPlaying, setContinuousPlaying] = useState(false);
  const [activePart, setActivePart] = useState<SugorokuSpeakingPartId | null>(null);

  const [rubricScores, setRubricScores] = useState<Record<string, number>>({
    reading_aloud: 4,
    q1: 4,
    q2: 7,
    q3: 4,
    q4: 4,
    attitude: 3,
  });
  const [comment, setComment] = useState('');
  const [teacherNameInput, setTeacherNameInput] = useState(reviewerName);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showAiImporter, setShowAiImporter] = useState(false);
  const [aiPasteBuffer, setAiPasteBuffer] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const playerRef = useRef<HTMLAudioElement | null>(null);
  const continuousIndexRef = useRef<number>(-1);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchClassSpeakingSubmissions(effectiveClassId, {
        includeDemoSamples: demoMode || effectiveClassId === SUGOROKU_DEMO_CLASS_ID,
        fallbackSubmissions: submissions,
      });
      setItems(rows);
      setSelectedId(prev => {
        if (prev && rows.some(r => r.id === prev)) return prev;
        return rows[0]?.id || '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '提出音声一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [effectiveClassId, demoMode, submissions]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(
    () => items.filter(i => statusFilter === 'all' || i.status === statusFilter),
    [items, statusFilter],
  );

  const selected = useMemo(
    () => filtered.find(i => i.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const matchedSet = useMemo(
    () => (selected ? findSpeakingSetById(selected.setId) : undefined),
    [selected],
  );

  useEffect(() => {
    let cancelled = false;
    setContinuousPlaying(false);
    setActivePart(null);
    setNotice('');
    setShowAiImporter(false);
    setAiPasteBuffer('');
    if (playerRef.current) {
      playerRef.current.pause();
    }
    if (!selected) {
      setAudioUrls({});
      return;
    }

    if (selected.review) {
      const normalizedScores: Record<string, number> = {};
      for (const [k, v] of Object.entries(selected.review.rubricScores)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          normalizedScores[k] = v;
        }
      }
      setRubricScores(normalizedScores);
      setComment(selected.review.comment);
      if (selected.review.reviewerName) {
        setTeacherNameInput(selected.review.reviewerName);
      }
    } else {
      setRubricScores({
        reading_aloud: 4,
        q1: 4,
        q2: matchedSet?.questions[1]?.maxScore === 10 ? 7 : 4,
        q3: 4,
        q4: matchedSet?.questions[3]?.maxScore === 10 ? 7 : 4,
        attitude: 3,
      });
      setComment('');
    }

    void (async () => {
      const resolved: Partial<Record<SugorokuSpeakingPartId, string>> = {};
      for (const rec of selected.recordings) {
        try {
          resolved[rec.partId] = await resolveSpeakingAudioUrl(rec.storagePath);
        } catch {
          // ignore
        }
      }
      if (!cancelled) {
        setAudioUrls(resolved);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selected, matchedSet]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.playbackRate = speed;
    }
  }, [speed]);

  const playPartAtIndex = useCallback(
    async (index: number, autoAdvance: boolean) => {
      if (!selected) return;
      if (index < 0 || index >= SCBT_PART_ORDER.length) {
        setContinuousPlaying(false);
        setActivePart(null);
        continuousIndexRef.current = -1;
        return;
      }
      const partId = SCBT_PART_ORDER[index];
      const url = audioUrls[partId];
      if (!url) {
        if (autoAdvance) {
          void playPartAtIndex(index + 1, true);
        }
        return;
      }

      const audio = playerRef.current;
      if (!audio) return;
      continuousIndexRef.current = index;
      setActivePart(partId);
      setContinuousPlaying(autoAdvance);
      audio.src = url;
      audio.playbackRate = speed;
      audio.onended = () => {
        if (autoAdvance) {
          void playPartAtIndex(index + 1, true);
        } else {
          setActivePart(null);
        }
      };
      try {
        await audio.play();
      } catch {
        setContinuousPlaying(false);
        setActivePart(null);
      }
    },
    [selected, audioUrls, speed],
  );

  const stopContinuousPlayback = () => {
    if (playerRef.current) {
      playerRef.current.pause();
    }
    setContinuousPlaying(false);
    setActivePart(null);
    continuousIndexRef.current = -1;
  };

  const totalRubricScore = Object.values(rubricScores).reduce(
    (sum, n) => sum + (Number.isFinite(n) ? n : 0),
    0,
  );

  const handleCopySpeakingPrompt = async () => {
    if (!selected) return;
    const text = buildSpeakingAiCoachPrompt(selected, matchedSet, rubricScores, comment);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(true);
      setShowAiImporter(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      setError('クリップボードへのコピーに失敗しました。');
    }
  };

  const handleApplyAiDraft = () => {
    if (!aiPasteBuffer.trim()) {
      setError('Gemini / ChatGPT からの出力テキストを貼り付けてください。');
      return;
    }
    const parsed = parseSpeakingAiReviewResponse(
      aiPasteBuffer,
      matchedSet?.questions[1]?.maxScore ?? 10,
      matchedSet?.questions[3]?.maxScore ?? 5,
    );
    if (Object.keys(parsed.rubricScores).length > 0) {
      setRubricScores(prev => ({ ...prev, ...parsed.rubricScores }));
    }
    if (parsed.comment) {
      setComment(parsed.comment);
    }
    setShowAiImporter(false);
    setAiPasteBuffer('');
    setError('');
    setNotice('AI音声講評案を各スコア・コメント欄へ反映しました！');
  };

  const handleExportCsv = () => {
    const csv = buildSpeakingSubmissionsCsv(filtered);
    downloadUtf8BomCsv(csv, `sugoroku_speaking_${effectiveClassId}.csv`);
  };

  const handlePrintSpeakingSheet = () => {
    if (!selected) return;
    const draftDoc: SugorokuSpeakingSubmissionDoc = {
      ...selected,
      review: {
        reviewerUid: reviewerUid || 'sugoroku_staff',
        reviewerName: teacherNameInput.trim() || reviewerName,
        rubricScores,
        comment: comment.trim() || selected.review?.comment || '',
        reviewedAt: selected.review?.reviewedAt ?? Date.now(),
      },
    };
    const opened = openSpeakingFeedbackPrintWindow(draftDoc, matchedSet);
    if (!opened) {
      setError('ブラウザのポップアップブロックを解除して再度お試しください。');
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!comment.trim()) {
      setError('生徒へ返却する音声講評コメントを入力してください。');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await saveSpeakingReview(effectiveClassId, selected, {
        reviewerUid: reviewerUid || 'sugoroku_staff',
        reviewerName: teacherNameInput.trim() || reviewerName,
        rubricScores,
        comment,
      });
      setItems(prev => prev.map(row => (row.id === updated.id ? updated : row)));
      setNotice('スピーキング講評・スコアを保存して生徒へ返却しました！');
    } catch (err) {
      setError(err instanceof Error ? err.message : '評価の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = items.filter(i => i.status === 'submitted').length;

  return (
    <div className="twr-wrap" data-sugoroku-teacher-speaking>
      <audio ref={playerRef} hidden />

      <div className="twr-toolbar">
        <div className="twr-filters" role="group" aria-label="提出状態の絞り込み">
          <button
            type="button"
            className="twr-chip"
            data-active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          >
            すべて（{items.length}）
          </button>
          <button
            type="button"
            className="twr-chip"
            data-active={statusFilter === 'submitted'}
            onClick={() => setStatusFilter('submitted')}
          >
            未確認（{pendingCount}）
          </button>
          <button
            type="button"
            className="twr-chip"
            data-active={statusFilter === 'reviewed'}
            onClick={() => setStatusFilter('reviewed')}
          >
            講評済み（{items.length - pendingCount}）
          </button>
        </div>

        <div className="twr-row-wrap">
          <FastForward size={15} color="#475569" aria-hidden="true" />
          <small className="swr-muted-note">再生速度：</small>
          {PLAYBACK_SPEEDS.map(rate => (
            <button
              key={rate}
              type="button"
              className="scbt-speed-btn"
              data-active={speed === rate}
              onClick={() => setSpeed(rate)}
            >
              {rate}x
            </button>
          ))}
          <button
            type="button"
            className="twr-chip twr-refresh-btn"
            onClick={handleExportCsv}
            data-sugoroku-export-speaking-csv
          >
            <Download size={13} aria-hidden="true" />
            CSV出力
          </button>
          <button
            type="button"
            className="twr-chip twr-refresh-btn"
            onClick={() => void reload()}
          >
            <RefreshCw size={13} aria-hidden="true" />
            更新
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="twr-alert-error">
          {error}
        </div>
      )}

      {loading ? (
        <p className="twr-loading-msg">スピーキング録音データを読み込んでいます…</p>
      ) : filtered.length === 0 ? (
        <div className="twr-empty-box">該当するスピーキング提出はありません。</div>
      ) : (
        <div className="twr-grid">
          <div className="twr-list" role="list" aria-label="スピーキング提出一覧">
            {filtered.map(item => {
              const gLabel =
                EIKEN_GRADES.find(g => g.id === item.grade)?.shortLabel ?? item.grade;
              const isSelected = selected?.id === item.id;
              const totalSec = Math.round(
                item.recordings.reduce((s, r) => s + (r.durationSec || 0), 0),
              );
              return (
                <button
                  key={item.id}
                  type="button"
                  role="listitem"
                  className="twr-item-btn"
                  data-selected={isSelected}
                  onClick={() => setSelectedId(item.id || '')}
                >
                  <div className="twr-item-top">
                    <strong>{item.studentName}</strong>
                    {item.status === 'reviewed' ? (
                      <span className="twr-pill-done">
                        <CheckCircle2 size={12} /> 講評済
                      </span>
                    ) : (
                      <span className="twr-pill-pending">
                        <Clock size={12} /> 未確認
                      </span>
                    )}
                  </div>
                  <div className="twr-item-title">
                    [{gLabel}] {item.setTitle || item.setId}（計 {totalSec}秒）
                  </div>
                  <div className="twr-item-date">
                    {new Date(item.submittedAt).toLocaleString('ja-JP')}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <section className="twr-detail" aria-label="選択した提出の音声再生と評価">
              <div className="twr-row-between">
                <div className="twr-detail-head">
                  <h3>{selected.studentName} さんの S-CBT 録音</h3>
                  <p>{matchedSet?.title || selected.setTitle || selected.setId}</p>
                </div>

                <div className="twr-row-wrap">
                  {!continuousPlaying ? (
                    <button
                      type="button"
                      className="scbt-primary-btn"
                      onClick={() => void playPartAtIndex(0, true)}
                      data-sugoroku-play-all
                    >
                      <Play size={16} aria-hidden="true" />
                      全5パートを連続再生（{speed}x）
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="scbt-danger-btn"
                      onClick={stopContinuousPlayback}
                    >
                      <Pause size={16} aria-hidden="true" />
                      連続再生を停止（再生中：{activePart ? SCBT_PART_LABELS[activePart] : ''}）
                    </button>
                  )}
                  <button
                    type="button"
                    className="twr-copy-btn"
                    onClick={() => void handleCopySpeakingPrompt()}
                    data-sugoroku-copy-speaking-prompt
                  >
                    <Copy size={15} aria-hidden="true" />
                    {copiedPrompt ? 'コピー完了！' : '① AI講評プロンプト'}
                  </button>
                  <button
                    type="button"
                    className="twr-outline-blue-btn"
                    onClick={() => setShowAiImporter(v => !v)}
                  >
                    <ClipboardPaste size={15} aria-hidden="true" />
                    ② AI返答を一括反映
                  </button>
                </div>
              </div>

              {showAiImporter && (
                <div className="twr-importer-box">
                  <label htmlFor="sp-ai-paste">
                    Gemini / ChatGPT からの出力（[SCORES]..[/SCORES] / [COMMENT]..[/COMMENT]）を貼り付け：
                  </label>
                  <textarea
                    id="sp-ai-paste"
                    rows={4}
                    value={aiPasteBuffer}
                    onChange={e => setAiPasteBuffer(e.target.value)}
                    placeholder="AIの出力を貼り付けるとパート別スコアと講評コメントへ自動反映します"
                  />
                  <div className="twr-importer-actions">
                    <button
                      type="button"
                      className="twr-chip"
                      onClick={() => setShowAiImporter(false)}
                    >
                      閉じる
                    </button>
                    <button
                      type="button"
                      className="twr-copy-btn"
                      onClick={handleApplyAiDraft}
                    >
                      スコア・講評欄へ反映する
                    </button>
                  </div>
                </div>
              )}

              <div className="twr-list">
                {SCBT_PART_ORDER.map((partId, idx) => {
                  const rec = selected.recordings.find(r => r.partId === partId);
                  const url = audioUrls[partId];
                  const qSpec =
                    partId === 'reading_aloud'
                      ? null
                      : matchedSet?.questions.find(q => q.partId === partId);
                  const isPlayingThis = activePart === partId;
                  const longSilence =
                    typeof rec?.maxSilenceSec === 'number' && rec.maxSilenceSec >= 4.0;

                  return (
                    <div
                      key={partId}
                      className="scbt-review-part-row"
                      data-playing={isPlayingThis}
                    >
                      <div className="twr-row-between">
                        <div className="twr-row-wrap">
                          <strong>{SCBT_PART_LABELS[partId]}</strong>
                          {rec && (
                            <small className="swr-muted-note">
                              ({rec.durationSec}秒
                              {typeof rec.speechRatio === 'number'
                                ? ` ・ 発話率 ${rec.speechRatio}%`
                                : ''}
                              {typeof rec.maxSilenceSec === 'number'
                                ? ` ・ 最長無音 ${rec.maxSilenceSec}秒`
                                : ''}
                              )
                            </small>
                          )}
                          {longSilence && (
                            <span className="twr-pill-pending">4秒超ポーズ</span>
                          )}
                        </div>
                        <div className="twr-row-wrap">
                          {url ? (
                            <>
                              <button
                                type="button"
                                className="scbt-secondary-btn swr-mini-btn"
                                onClick={() => void playPartAtIndex(idx, false)}
                              >
                                <Play size={13} aria-hidden="true" />
                                {speed}x で再生
                              </button>
                              <audio
                                controls
                                src={url}
                                preload="metadata"
                                onPlay={e => {
                                  e.currentTarget.playbackRate = speed;
                                }}
                              />
                            </>
                          ) : (
                            <small className="swr-muted-note">音声読込中または未取得</small>
                          )}
                        </div>
                      </div>

                      {rec?.transcript && (
                        <div lang="en" className="swr-muted-note">
                          <strong>【音声認識参考テキスト】</strong> &ldquo;{rec.transcript}&rdquo;
                        </div>
                      )}

                      {matchedSet && (
                        <details className="twr-ref-details">
                          <summary>設問文・模範解答・採点基準を表示</summary>
                          <div className="twr-ref-body">
                            {partId === 'reading_aloud' ? (
                              <p lang="en">
                                <strong>【音読本文】</strong> {matchedSet.passage}
                              </p>
                            ) : (
                              qSpec && (
                                <>
                                  <p lang="en">
                                    <strong>【質問】</strong> {qSpec.promptAudioScript}
                                  </p>
                                  <p lang="en">
                                    <strong>【模範解答】</strong> {qSpec.modelAnswer}
                                  </p>
                                  <ul className="twr-warn-list">
                                    {qSpec.rubricPoints.map((pt, i) => (
                                      <li key={i}>{pt}</li>
                                    ))}
                                  </ul>
                                </>
                              )
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>

              <div>
                <div className="twr-row-between">
                  <strong>パート別評価スコア</strong>
                  <strong className="swr-check-ok">合計：{totalRubricScore} 点</strong>
                </div>
                <div className="scbt-rubric-auto-grid">
                  {(
                    [
                      ['reading_aloud', '音読', 5],
                      ['q1', 'No. 1', 5],
                      ['q2', 'No. 2', matchedSet?.questions[1]?.maxScore ?? 10],
                      ['q3', 'No. 3', 5],
                      ['q4', 'No. 4', matchedSet?.questions[3]?.maxScore ?? 5],
                      ['attitude', 'アティチュード', 3],
                    ] as const
                  ).map(([key, label, maxVal]) => (
                    <div key={key} className="twr-rubric-cell">
                      <label htmlFor={`sp-score-${key}`}>
                        {label} (/{maxVal})
                      </label>
                      <select
                        id={`sp-score-${key}`}
                        value={rubricScores[key] ?? 0}
                        onChange={e =>
                          setRubricScores(prev => ({
                            ...prev,
                            [key]: Number(e.target.value),
                          }))
                        }
                      >
                        {Array.from({ length: maxVal + 1 }, (_, i) => maxVal - i).map(v => (
                          <option key={v} value={v}>
                            {v} 点
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="twr-field">
                <label htmlFor="sp-teacher-name">担当講師名</label>
                <input
                  id="sp-teacher-name"
                  type="text"
                  value={teacherNameInput}
                  onChange={e => setTeacherNameInput(e.target.value)}
                />
              </div>

              <div className="twr-field">
                <label htmlFor="sp-comment">
                  先生からの音声講評・発音/構成アドバイス（生徒画面へ返却）
                </label>
                <textarea
                  id="sp-comment"
                  rows={4}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="発音の聞き取りやすさ、時制（過去形/現在進行形）、理由の述べ方などのフィードバックを入力してください（上の「① AI講評プロンプト」も活用できます）。"
                />
              </div>

              {notice && (
                <p role="status" className="twr-notice-ok">
                  {notice}
                </p>
              )}

              <div className="twr-actions">
                <button
                  type="button"
                  className="twr-save-btn"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  data-sugoroku-save-speaking-review
                >
                  <Send size={15} aria-hidden="true" />
                  {saving ? '保存中…' : '評価・講評コメントを保存して生徒へ返却'}
                </button>
                <button
                  type="button"
                  className="twr-print-btn"
                  onClick={handlePrintSpeakingSheet}
                  data-sugoroku-print-speaking-sheet
                >
                  <Printer size={15} aria-hidden="true" />
                  A4講評＆音読シート印刷 / PDF
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
