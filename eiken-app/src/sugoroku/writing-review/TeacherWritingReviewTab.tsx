import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardCopy,
  ClipboardPaste,
  Clock,
  Download,
  Printer,
  RefreshCw,
  Send,
} from 'lucide-react';
import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import { EIKEN_WRITING_TASKS } from '../../components/EikenWriting';
import {
  buildWritingSubmissionsCsv,
  downloadUtf8BomCsv,
} from '../shared/csvExport';
import type {
  SugorokuAdminReviewTabProps,
  SugorokuWritingRubricScores,
  SugorokuWritingSubmissionDoc,
} from '../shared/types';
import { computeEnglishDiff } from './diffHighlight';
import {
  buildWritingAiReviewPrompt,
  parseAiReviewResponse,
} from './promptBuilder';
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
  submissions,
}: SugorokuAdminReviewTabProps & { submissions?: readonly SugorokuWritingSubmissionDoc[] }) {
  const effectiveClassId = classId || SUGOROKU_DEMO_CLASS_ID;
  const [items, setItems] = useState<SugorokuWritingSubmissionDoc[]>(() =>
    submissions ? [...submissions] : [],
  );
  const [loading, setLoading] = useState(() => !submissions);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [gradeFilter, setGradeFilter] = useState<EikenGrade | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showAiImporter, setShowAiImporter] = useState(false);
  const [aiPasteBuffer, setAiPasteBuffer] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

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
        fallbackSubmissions: submissions,
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
  }, [effectiveClassId, demoMode, submissions]);

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

  useEffect(() => {
    if (!selected) return;
    setNotice('');
    setCopiedPrompt(false);
    setShowAiImporter(false);
    setAiPasteBuffer('');
    if (selected.review) {
      const rs = selected.review.rubricScores;
      setRubric({
        content: rs?.content ?? 3,
        structure: rs?.structure ?? rs?.organization ?? 3,
        vocabulary: rs?.vocabulary ?? 3,
        grammar: rs?.grammar ?? 3,
      });
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

  const liveDiff = useMemo(() => {
    if (!selected || !correctedText.trim() || correctedText.trim() === selected.text.trim()) {
      return [];
    }
    return computeEnglishDiff(selected.text, correctedText);
  }, [selected, correctedText]);

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
      setShowAiImporter(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      setError('クリップボードへのコピーに失敗しました。ブラウザの権限を確認してください。');
    }
  };

  const handleApplyAiDraft = () => {
    if (!aiPasteBuffer.trim()) {
      setError('Gemini / ChatGPT からの出力テキストを貼り付けてください。');
      return;
    }
    const parsed = parseAiReviewResponse(aiPasteBuffer);
    setRubric(prev => ({
      content: parsed.rubricScores.content ?? prev.content,
      structure: parsed.rubricScores.structure ?? prev.structure,
      vocabulary: parsed.rubricScores.vocabulary ?? prev.vocabulary,
      grammar: parsed.rubricScores.grammar ?? prev.grammar,
    }));
    if (parsed.correctedText) setCorrectedText(parsed.correctedText);
    if (parsed.comment) setComment(parsed.comment);
    if (parsed.strengths) setStrengths(parsed.strengths);
    if (parsed.nextActions) setNextActions(parsed.nextActions);
    setShowAiImporter(false);
    setAiPasteBuffer('');
    setError('');
    setNotice('AI下書きを各欄へ自動反映しました！内容を確認・微調整して生徒へ返却してください。');
  };

  const handleExportCsv = () => {
    const csv = buildWritingSubmissionsCsv(filtered);
    downloadUtf8BomCsv(csv, `sugoroku_writing_${effectiveClassId}.csv`);
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
        rubricScores: { ...rubric, organization: rubric.structure },
        comment,
        correctedText,
        strengths,
        nextActions,
      });
      setItems(prev => prev.map(row => (row.id === updated.id ? updated : row)));
      setNotice(
        '添削結果を保存・返却しました！そのまま右のボタンからA4フィードバックシートを印刷/PDF保存できます。',
      );
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
            className="twr-grade-select"
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value as EikenGrade | 'all')}
          >
            <option value="all">すべての級</option>
            {EIKEN_GRADES.map(g => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="twr-row-wrap">
          <button
            type="button"
            className="twr-chip twr-refresh-btn"
            onClick={handleExportCsv}
            data-sugoroku-export-writing-csv
          >
            <Download size={14} aria-hidden="true" />
            CSV出力
          </button>
          <button
            type="button"
            className="twr-chip twr-refresh-btn"
            onClick={() => void reload()}
          >
            <RefreshCw size={14} aria-hidden="true" />
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
        <p className="twr-loading-msg">提出答案を読み込んでいます…</p>
      ) : filtered.length === 0 ? (
        <div className="twr-empty-box">該当するライティング提出答案はありません。</div>
      ) : (
        <div className="twr-grid">
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
                  <div className="twr-item-top">
                    <strong>{item.studentName}</strong>
                    {item.status === 'reviewed' ? (
                      <span className="twr-pill-done">
                        <CheckCircle2 size={12} /> 添削済 ({item.review?.score ?? '-'}/16)
                      </span>
                    ) : (
                      <span className="twr-pill-pending">
                        <Clock size={12} /> 未添削
                      </span>
                    )}
                  </div>
                  <div className="twr-item-title">
                    [{gLabel}] {item.taskTitle || item.taskKey}（{item.wordCount}語）
                  </div>
                  <div className="twr-item-date">
                    {new Date(item.submittedAt).toLocaleString('ja-JP')}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <section className="twr-detail" aria-label="選択した答案の添削">
              <div className="twr-detail-head">
                <h3>{selected.studentName} さんの提出答案</h3>
                <p>
                  {matchedTask?.title || selected.taskTitle || selected.taskKey} ・{' '}
                  <strong>{selected.wordCount} words</strong>
                  {matchedTask?.target ? `（${matchedTask.target}）` : ''}
                </p>
              </div>

              <div className="twr-ai-box">
                <div className="twr-ai-copy-info">
                  <strong>
                    手元AI（Gemini / ChatGPT）往復90秒ワークフロー（API課金ゼロ）
                  </strong>
                  <span>
                    ①プロンプトをコピーしてAIへ貼る → ②AIの返答を貼り付けると4観点スコア・添削文・講評へ一括反映します。
                  </span>
                </div>
                <div className="twr-row-wrap">
                  <button
                    type="button"
                    className="twr-copy-btn"
                    onClick={() => void handleCopyPrompt()}
                    data-sugoroku-copy-ai-prompt
                  >
                    {copiedPrompt ? (
                      <>
                        <Check size={15} aria-hidden="true" />
                        コピー完了！
                      </>
                    ) : (
                      <>
                        <ClipboardCopy size={15} aria-hidden="true" />
                        ① 採点プロンプトをコピー
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="twr-outline-blue-btn"
                    onClick={() => setShowAiImporter(v => !v)}
                  >
                    <ClipboardPaste size={15} aria-hidden="true" />
                    ② AIの返答を一括反映
                  </button>
                </div>
              </div>

              {showAiImporter && (
                <div className="twr-importer-box">
                  <label htmlFor="twr-ai-paste">
                    Gemini / ChatGPT の出力をそのままここに貼り付けてください：
                  </label>
                  <textarea
                    id="twr-ai-paste"
                    rows={5}
                    value={aiPasteBuffer}
                    onChange={e => setAiPasteBuffer(e.target.value)}
                    placeholder="[SCORES] ... [/SCORES] 形式のAI出力を貼り付けると、下の全入力欄へ自動で振り分けます"
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
                      各入力欄へ自動反映する
                    </button>
                  </div>
                </div>
              )}

              {matchedTask && (
                <details className="twr-ref-details">
                  <summary>問題文・参考模範解答を確認する</summary>
                  <div className="twr-ref-body">
                    <p>
                      <strong>【指示文】</strong> {matchedTask.instruction}
                    </p>
                    {matchedTask.source && (
                      <p lang="en">
                        <strong>【元文】</strong> {matchedTask.source}
                      </p>
                    )}
                    <p lang="en">
                      <strong>【参考解答】</strong> {matchedTask.model}
                    </p>
                  </div>
                </details>
              )}

              <div className="twr-field">
                <label>生徒の提出英文（{selected.wordCount} words）</label>
                <div className="twr-student-text" lang="en">
                  {selected.text}
                </div>
                {selected.formatWarnings.length > 0 && (
                  <ul className="twr-warn-list">
                    {selected.formatWarnings.map((w, idx) => (
                      <li key={idx}>自動形式検出：{w}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="twr-row-between">
                  <strong>英検4観点スコア（各0〜4点）</strong>
                  <strong className="swr-check-ok">合計：{totalScore} / 16 点</strong>
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
                  添削英文・書き直し例（生徒の元の文をベースに修正すると下に単語差分が自動表示されます）
                </label>
                <textarea
                  id="twr-corrected"
                  lang="en"
                  rows={5}
                  value={correctedText}
                  onChange={e => setCorrectedText(e.target.value)}
                  placeholder="生徒の英文を活かした自然な修正例を入力"
                />
                {liveDiff.length > 0 && (
                  <div className="twr-diff-preview" lang="en" aria-label="添削差分プレビュー">
                    <small lang="ja" className="twr-diff-caption">
                      リアルタイム添削差分プレビュー（A4シートにも白黒出力されます）：
                    </small>
                    {liveDiff.map((seg, i) =>
                      seg.kind === 'removed' ? (
                        <del key={i} className="swr-diff-del">
                          {seg.text}
                        </del>
                      ) : seg.kind === 'added' ? (
                        <ins key={i} className="swr-diff-ins">
                          {seg.text}
                        </ins>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </div>
                )}
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

              <div className="twr-two-col">
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
                <p role="status" className="twr-notice-ok">
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
