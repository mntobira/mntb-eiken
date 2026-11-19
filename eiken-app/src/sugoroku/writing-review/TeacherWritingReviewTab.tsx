import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Printer,
  RefreshCw,
  Send,
} from 'lucide-react';
import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import { EIKEN_WRITING_TASKS } from '../../components/EikenWriting';
import type {
  SugorokuAdminReviewTabProps,
  SugorokuWritingRubricScores,
  SugorokuWritingSubmissionDoc,
} from '../shared/types';
import { buildWritingAiReviewPrompt } from './promptBuilder';
import { openFeedbackSheetPrintWindow } from './printFeedbackSheet';
import {
  fetchClassWritingSubmissions,
  saveWritingReview,
  SUGOROKU_DEMO_CLASS_ID,
} from './writingStore';
import './writing-review.css';

type StatusFilter = 'all' | 'submitted' | 'reviewed';

export function TeacherWritingReviewTab({
  classId,
  classNameLabel,
  reviewerUid,
  reviewerName = 'すごろく英検担当講師',
  demoMode = false,
}: SugorokuAdminReviewTabProps) {
  const effectiveClassId = classId || SUGOROKU_DEMO_CLASS_ID;
  const [items, setItems] = useState<SugorokuWritingSubmissionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [gradeFilter, setGradeFilter] = useState<EikenGrade | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // 添削フォーム状態
  const [rubric, setRubric] = useState<SugorokuWritingRubricScores>({
    content: 3,
    structure: 3,
    vocabulary: 3,
    grammar: 3,
  });
  const [comment, setComment] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [strengths, setStrengths] = useState('');
  const [nextActions, setNextActions] = useState('');
  const [teacherNameInput, setTeacherNameInput] = useState(reviewerName);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchClassWritingSubmissions(effectiveClassId, {
        includeDemoSamples: demoMode || effectiveClassId === SUGOROKU_DEMO_CLASS_ID,
      });
      setItems(rows);
      setSelectedId(prev => {
        if (prev && rows.some(r => r.id === prev)) return prev;
        return rows[0]?.id || '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '提出答案の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [effectiveClassId, demoMode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (gradeFilter !== 'all' && item.grade !== gradeFilter) return false;
      return true;
    });
  }, [items, statusFilter, gradeFilter]);

  const selected = useMemo(
    () => filtered.find(i => i.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  // 選択答案が変わったらフォームへ初期値をロード
  useEffect(() => {
    if (!selected) return;
    setNotice('');
    setCopiedPrompt(false);
    if (selected.review) {
      setRubric(
        selected.review.rubricScores ?? {
          content: 3,
          structure: 3,
          vocabulary: 3,
          grammar: 3,
        },
      );
      setComment(selected.review.comment || '');
      setCorrectedText(selected.review.correctedText || '');
      setStrengths(selected.review.strengths || '');
      setNextActions(selected.review.nextActions || '');
      if (selected.review.reviewerName) {
        setTeacherNameInput(selected.review.reviewerName);
      }
    } else {
      setRubric({ content: 3, structure: 3, vocabulary: 3, grammar: 3 });
      setComment('');
      setCorrectedText(selected.text);
      setStrengths('');
      setNextActions('');
    }
  }, [selected]);

  const matchedTask = useMemo(
    () => (selected ? EIKEN_WRITING_TASKS.find(t => t.key === selected.taskKey) : undefined),
    [selected],
  );

  const totalScore = rubric.content + rubric.structure + rubric.vocabulary + rubric.grammar;

  const handleCopyPrompt = async () => {
    if (!selected) return;
    const prompt = buildWritingAiReviewPrompt(selected, {
      grade: selected.grade,
      taskTitle: matchedTask?.title || selected.taskTitle || selected.taskKey,
      instruction: matchedTask?.instruction,
      sourceText: matchedTask?.source,
      targetWordsLabel: matchedTask?.target,
      modelAnswer: matchedTask?.model,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      setError('クリップボードへのコピーに失敗しました。ブラウザの権限を確認してください。');
    }
  };

  const handleSaveReview = async () => {
    if (!selected) return;
    if (!comment.trim()) {
      setError('生徒へ返却する講評コメントを入力してください。');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await saveWritingReview(effectiveClassId, selected, {
        reviewerUid: reviewerUid || 'sugoroku_staff',
        reviewerName: teacherNameInput.trim() || reviewerName,
        score: totalScore,
        maxScore: 16,
        rubricScores: rubric,
        comment,
        correctedText,
        strengths,
        nextActions,
      });
      setItems(prev => prev.map(row => (row.id === updated.id ? updated : row)));
      setNotice('添削結果を保存・返却しました！そのまま右のボタンからA4フィードバックシートを印刷/PDF保存できます。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '添削の保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintSheet = () => {
    if (!selected) return;
    const previewDoc: SugorokuWritingSubmissionDoc = {
      ...selected,
      review: {
        reviewerUid: reviewerUid || 'sugoroku_staff',
        reviewerName: teacherNameInput.trim() || reviewerName,
        score: totalScore,
        maxScore: 16,
        rubricScores: rubric,
        comment: comment || selected.review?.comment || '',
        correctedText: correctedText || selected.review?.correctedText || undefined,
        strengths: strengths || selected.review?.strengths || undefined,
        nextActions: nextActions || selected.review?.nextActions || undefined,
        reviewedAt: selected.review?.reviewedAt ?? Date.now(),
      },
    };
    openFeedbackSheetPrintWindow(previewDoc, {
      schoolName: classNameLabel
        ? `オンライン個別指導「すごろく」（${classNameLabel}）`
        : undefined,
      taskTitle: matchedTask?.title || selected.taskTitle || selected.taskKey,
      instruction: matchedTask?.instruction,
      targetWordsLabel: matchedTask?.target,
      modelAnswer: matchedTask?.model,
    });
  };

  const pendingCount = items.filter(i => i.status === 'submitted').length;

  return (
    <div className="twr-wrap" data-sugoroku-teacher-writing>
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
            未添削（{pendingCount}）
          </button>
          <button
            type="button"
            className="twr-chip"
            data-active={statusFilter === 'reviewed'}
            onClick={() => setStatusFilter('reviewed')}
          >
            添削済み（{items.length - pendingCount}）
          </button>
          <select
            aria-label="級で絞り込み"
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value as EikenGrade | 'all')}
            style={{
              minHeight: '36px',
              borderRadius: '10px',
              border: '1px solid #d2cec2',
              padding: '4px 10px',
              fontSize: '12.5px',
              fontWeight: 700,
              background: '#fff',
            }}
          >
            <option value="all">すべての級</option>
            {EIKEN_GRADES.map(g => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="twr-chip"
          onClick={() => void reload()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          更新
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: '#fdecea',
            border: '1px solid #f5c6c0',
            color: '#96342b',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
          提出答案を読み込んでいます…
        </p>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #dfd9c8',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: '#4b5563' }}>
            該当するライティング提出答案はありません。
          </p>
        </div>
      ) : (
        <div className="twr-grid">
          {/* 左：提出一覧 */}
          <div className="twr-list" role="list" aria-label="提出答案一覧">
            {filtered.map(item => {
              const gLabel =
                EIKEN_GRADES.find(g => g.id === item.grade)?.shortLabel ?? item.grade;
              const isSelected = selected?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="listitem"
                  className="twr-item-btn"
                  data-selected={isSelected}
                  onClick={() => setSelectedId(item.id || '')}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '6px',
                      width: '100%',
                    }}
                  >
                    <strong style={{ fontSize: '14px' }}>{item.studentName}</strong>
                    {item.status === 'reviewed' ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          color: '#1f6b5c',
                          background: '#e1f4ee',
                          padding: '2px 8px',
                          borderRadius: '999px',
                        }}
                      >
                        <CheckCircle2 size={12} /> 添削済 ({item.review?.score ?? '-'}
                        /16)
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          color: '#9a3412',
                          background: '#ffedd5',
                          padding: '2px 8px',
                          borderRadius: '999px',
                        }}
                      >
                        <Clock size={12} /> 未添削
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#374151', fontWeight: 700 }}>
                    [{gLabel}] {item.taskTitle || item.taskKey}（{item.wordCount}語）
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#6b7280' }}>
                    {new Date(item.submittedAt).toLocaleString('ja-JP')}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 右：詳細＆添削パネル */}
          {selected && (
            <section className="twr-detail" aria-label="選択した答案の添削">
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                      {selected.studentName} さんの提出答案
                    </h3>
                    <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#4b5563' }}>
                      {matchedTask?.title || selected.taskTitle || selected.taskKey} ・{' '}
                      <strong>{selected.wordCount} words</strong>
                      {matchedTask?.target ? `（${matchedTask.target}）` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* 1クリック AIプロンプトコピー（API課金ゼロ運用） */}
              <div className="twr-ai-box">
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <strong style={{ fontSize: '13px', color: '#1e3a8a', display: 'block' }}>
                    手元AI（Gemini / ChatGPT）下書き補助（API課金ゼロ）
                  </strong>
                  <span style={{ fontSize: '12px', color: '#3b4e6b' }}>
                    問題文・模範解答・生徒答案・英検4観点ルーブリックを1クリックでコピーできます。
                  </span>
                </div>
                <button
                  type="button"
                  className="twr-copy-btn"
                  onClick={() => void handleCopyPrompt()}
                  data-sugoroku-copy-ai-prompt
                >
                  {copiedPrompt ? (
                    <>
                      <Check size={15} aria-hidden="true" />
                      採点プロンプトをコピーしました！
                    </>
                  ) : (
                    <>
                      <ClipboardCopy size={15} aria-hidden="true" />
                      英検4観点採点プロンプトをコピー
                    </>
                  )}
                </button>
              </div>

              {matchedTask && (
                <details style={{ fontSize: '13px', color: '#374151' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 800, color: '#1f5c51' }}>
                    問題文・参考模範解答を確認する
                  </summary>
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '10px 12px',
                      background: '#f6f8f7',
                      borderRadius: '10px',
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      <strong>【指示文】</strong> {matchedTask.instruction}
                    </p>
                    {matchedTask.source && (
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }} lang="en">
                        <strong>【元文】</strong> {matchedTask.source}
                      </p>
                    )}
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }} lang="en">
                      <strong>【参考解答】</strong> {matchedTask.model}
                    </p>
                  </div>
                </details>
              )}

              <div>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  生徒の提出英文（{selected.wordCount} words）
                </strong>
                <div className="twr-student-text" lang="en">
                  {selected.text}
                </div>
                {selected.formatWarnings.length > 0 && (
                  <ul
                    style={{
                      margin: '8px 0 0',
                      paddingLeft: '18px',
                      fontSize: '12px',
                      color: '#92400e',
                    }}
                  >
                    {selected.formatWarnings.map((w, idx) => (
                      <li key={idx}>自動形式検出：{w}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 4観点スコア入力 */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <strong style={{ fontSize: '13.5px' }}>
                    英検4観点スコア（各0〜4点）
                  </strong>
                  <strong style={{ fontSize: '15px', color: '#1f5c51' }}>
                    合計：{totalScore} / 16 点
                  </strong>
                </div>
                <div className="twr-rubric-grid">
                  {(
                    [
                      ['content', '① 内容 (Content)'],
                      ['structure', '② 構成 (Structure)'],
                      ['vocabulary', '③ 語彙 (Vocabulary)'],
                      ['grammar', '④ 文法 (Grammar)'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="twr-rubric-cell">
                      <label htmlFor={`rubric-${key}`}>{label}</label>
                      <select
                        id={`rubric-${key}`}
                        value={rubric[key]}
                        onChange={e =>
                          setRubric(prev => ({
                            ...prev,
                            [key]: Number(e.target.value),
                          }))
                        }
                      >
                        {[4, 3, 2, 1, 0].map(v => (
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
                <label htmlFor="twr-reviewer-name">担当講師名（フィードバックシート記載用）</label>
                <input
                  id="twr-reviewer-name"
                  type="text"
                  value={teacherNameInput}
                  onChange={e => setTeacherNameInput(e.target.value)}
                  placeholder="例：藤沢 卓登（英検2級担当）"
                />
              </div>

              <div className="twr-field">
                <label htmlFor="twr-corrected">
                  添削英文・書き直し例（生徒の元の文をベースに修正）
                </label>
                <textarea
                  id="twr-corrected"
                  lang="en"
                  rows={5}
                  value={correctedText}
                  onChange={e => setCorrectedText(e.target.value)}
                  placeholder="生徒の英文を活かした自然な修正例を入力"
                />
              </div>

              <div className="twr-field">
                <label htmlFor="twr-comment">先生からの総合講評コメント（必須）</label>
                <textarea
                  id="twr-comment"
                  rows={4}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="良かった点と、最優先で直すと伸びるポイントを具体的に記入してください。"
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px',
                }}
              >
                <div className="twr-field">
                  <label htmlFor="twr-strengths">◎ 良かった点（任意・シート欄）</label>
                  <textarea
                    id="twr-strengths"
                    rows={2}
                    value={strengths}
                    onChange={e => setStrengths(e.target.value)}
                    placeholder="例：理由が2つ明確で語数も適正範囲内です！"
                  />
                </div>
                <div className="twr-field">
                  <label htmlFor="twr-next-actions">▶ 次回意識する点（任意・シート欄）</label>
                  <textarea
                    id="twr-next-actions"
                    rows={2}
                    value={nextActions}
                    onChange={e => setNextActions(e.target.value)}
                    placeholder="例：三人称単数の -s とスペル見直しを徹底しよう！"
                  />
                </div>
              </div>

              {notice && (
                <p
                  role="status"
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#1f6b5c',
                  }}
                >
                  {notice}
                </p>
              )}

              <div className="twr-actions">
                <button
                  type="button"
                  className="twr-save-btn"
                  disabled={saving}
                  onClick={() => void handleSaveReview()}
                  data-sugoroku-save-review
                >
                  <Send size={15} aria-hidden="true" />
                  {saving ? '保存中…' : '添削を保存して生徒へ返却する'}
                </button>
                <button
                  type="button"
                  className="twr-print-btn"
                  onClick={handlePrintSheet}
                  data-sugoroku-print-sheet
                >
                  <Printer size={15} aria-hidden="true" />
                  A4添削フィードバックシート印刷 ／ PDF保存
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
