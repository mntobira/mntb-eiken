import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  GitCompare,
  Printer,
  Send,
  Sparkles,
} from 'lucide-react';
import { auth } from '../../firebase';
import { loadJukuMemberships } from '../../utils/classAssignments';
import { safeLocalStorage } from '../../utils/safeLocalStorage';
import type { EikenGrade } from '../../eiken/config';
import type { SugorokuWritingSubmissionDoc } from '../shared/types';
import { computeEnglishDiff } from './diffHighlight';
import {
  analyzeWritingFormat,
  buildWritingIssueHighlights,
  type WritingTaskKind,
} from './formatCheck';
import { openFeedbackSheetPrintWindow } from './printFeedbackSheet';
import {
  fetchStudentWritingSubmissions,
  submitWritingToClass,
  SUGOROKU_DEMO_CLASS_ID,
} from './writingStore';
import './writing-review.css';

const STUDENT_NAME_CACHE_KEY = 'sugoroku_student_name_v1';

export interface StudentWritingSubmitPanelProps {
  uid: string;
  grade: EikenGrade;
  taskKey: string;
  taskTitle: string;
  taskKind: WritingTaskKind;
  instruction: string;
  sourceText?: string;
  targetWordsLabel: string;
  targetRange: [number, number] | null;
  text: string;
}

export function StudentWritingSubmitPanel({
  uid,
  grade,
  taskKey,
  taskTitle,
  taskKind,
  instruction,
  sourceText,
  targetWordsLabel,
  targetRange,
  text,
}: StudentWritingSubmitPanelProps) {
  const memberships = useMemo(() => loadJukuMemberships(uid), [uid]);
  const primaryClassId = memberships[0]?.classId || SUGOROKU_DEMO_CLASS_ID;
  const primaryJukuName = memberships[0]?.className || '';
  const [studentName, setStudentName] = useState<string>(() => {
    const cached = safeLocalStorage()?.getItem(STUDENT_NAME_CACHE_KEY);
    if (cached) return cached;
    return auth.currentUser?.displayName || '';
  });
  const [history, setHistory] = useState<SugorokuWritingSubmissionDoc[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showDiffMode, setShowDiffMode] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const check = useMemo(
    () => analyzeWritingFormat(text, targetRange, taskKind, sourceText),
    [text, targetRange, taskKind, sourceText],
  );

  const highlightSegments = useMemo(
    () => buildWritingIssueHighlights(text, taskKind, sourceText),
    [text, taskKind, sourceText],
  );
  const hasInlineHighlights = useMemo(
    () => highlightSegments.some(s => s.kind === 'issue'),
    [highlightSegments],
  );

  const loadHistory = useCallback(async () => {
    const list = await fetchStudentWritingSubmissions(primaryClassId, uid, taskKey);
    setHistory(list);
  }, [primaryClassId, uid, taskKey]);

  useEffect(() => {
    void loadHistory();
    setStatusMsg('');
    setErrorMsg('');
  }, [loadHistory]);

  const handleSubmit = async () => {
    if (!text.trim() || check.words === 0) {
      setErrorMsg('英文を入力してから提出してください。');
      return;
    }
    const cleanName = studentName.trim() || auth.currentUser?.displayName || 'すごろく塾生';
    safeLocalStorage()?.setItem(STUDENT_NAME_CACHE_KEY, cleanName);

    setSubmitting(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      await submitWritingToClass({
        classId: primaryClassId,
        studentUid: uid,
        studentName: cleanName,
        grade,
        taskKey,
        taskTitle,
        wordCount: check.words,
        text,
        formatWarnings: check.formatWarnings,
      });
      await loadHistory();
      setStatusMsg('塾の先生へ答案を一括提出しました！添削が返却されるとこの下に表示されます。');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '提出に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const latest = history[0] ?? null;
  const diffSegments = useMemo(() => {
    if (!latest?.review?.correctedText) return [];
    return computeEnglishDiff(latest.text, latest.review.correctedText);
  }, [latest]);

  const pacePercent = targetRange
    ? Math.min(100, Math.round((check.words / Math.max(1, targetRange[1])) * 100))
    : 0;
  const paceState: 'under' | 'ok' | 'over' = !targetRange
    ? 'ok'
    : check.words < targetRange[0]
    ? 'under'
    : check.words > targetRange[1]
    ? 'over'
    : 'ok';

  return (
    <section className="swr-panel" aria-label="すごろく塾 ライティング形式チェックと先生への提出">
      <div className="swr-panel-header">
        <span className="swr-badge">
          <Sparkles size={14} aria-hidden="true" />
          塾の先生へ一括提出 ＆ セルフ形式チェック
        </span>
        {primaryJukuName && (
          <small className="swr-muted-note">連携中：{primaryJukuName}</small>
        )}
      </div>

      <div className="swr-check-box" data-sugoroku-format-check>
        <p className="swr-check-title">
          {check.passedAll ? (
            <CheckCircle2 size={16} color="#1f6b5c" aria-hidden="true" />
          ) : (
            <AlertCircle size={16} color="#b45309" aria-hidden="true" />
          )}
          提出前の形式・スペル・課題ルール自動チェック
          {check.words > 0 && (
            <small className="swr-muted-note">
              （{check.words}語 ・ {check.sentenceCount}文）
            </small>
          )}
        </p>

        {targetRange && (
          <div className="swr-pace-wrap" aria-label="語数ペースゲージ">
            <div className="swr-pace-head">
              <span>
                目標語数：{targetRange[0]}〜{targetRange[1]}語
              </span>
              <span>
                {paceState === 'ok'
                  ? `適正レンジ内！（${check.words}語）`
                  : paceState === 'under'
                  ? `あと ${targetRange[0] - check.words}語で目安到達`
                  : `目安上限を +${check.words - targetRange[1]}語 超過`}
              </span>
            </div>
            <div className="swr-pace-track">
              <div
                className="swr-pace-fill"
                data-state={paceState}
                style={{ width: `${pacePercent}%` }}
              />
            </div>
          </div>
        )}

        {check.words === 0 ? (
          <p className="swr-muted-note">
            上の入力欄に英文を書くと、語数範囲・文頭大文字・ピリオド・頻出スペル・要約丸写し注意などを自動点検します。
          </p>
        ) : check.passedAll ? (
          <p className="swr-check-ok">
            語数（{check.words}語）・文頭大文字・文末ピリオド・基本スペルすべてOKです！
          </p>
        ) : (
          <>
            <ul className="swr-check-list">
              {check.issues.map((issue, idx) => (
                <li key={`${issue.code}-${idx}`}>{issue.message}</li>
              ))}
            </ul>
            {hasInlineHighlights && (
              <div className="swr-inline-highlight-box" lang="en" aria-label="要注意箇所プレビュー">
                <small lang="ja" className="twr-diff-caption">
                  見直し箇所ハイライト（黄色箇所にカーソル/タップでヒント表示）：
                </small>
                {highlightSegments.map((seg, i) =>
                  seg.kind === 'issue' ? (
                    <mark key={i} className="swr-issue-mark" title={seg.hint}>
                      {seg.text}
                    </mark>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="swr-submit-row">
        <input
          type="text"
          className="swr-name-input"
          aria-label="提出者氏名"
          placeholder="氏名（例：山田 太郎）"
          value={studentName}
          maxLength={40}
          onChange={e => setStudentName(e.target.value)}
        />
        <button
          type="button"
          className="swr-submit-btn"
          disabled={submitting || check.words === 0}
          onClick={() => void handleSubmit()}
          data-sugoroku-submit-writing
        >
          <Send size={15} aria-hidden="true" />
          {submitting ? '提出中…' : latest ? '書き直して再提出する' : '塾の先生へ提出する'}
        </button>
      </div>

      {statusMsg && (
        <p className="swr-status-msg" role="status">
          {statusMsg}
        </p>
      )}
      {errorMsg && (
        <p className="swr-error-msg" role="alert">
          {errorMsg}
        </p>
      )}

      {latest && (
        <div className="swr-review-card" data-sugoroku-writing-status={latest.status}>
          <div className="swr-review-top">
            <strong>
              {latest.status === 'reviewed'
                ? '先生から添削が返却されました！'
                : '提出済み（先生の添削待ち）'}
            </strong>
            {latest.review ? (
              <span className="swr-score-pill">
                スコア {latest.review.score} / {latest.review.maxScore ?? 16} 点
              </span>
            ) : (
              <small className="swr-muted-note">提出：{latest.wordCount} words</small>
            )}
          </div>

          {latest.review ? (
            <>
              {latest.review.rubricScores && (
                <div className="swr-rubric-chips">
                  <span className="swr-rubric-chip">
                    内容 {latest.review.rubricScores.content ?? '-'}/4
                  </span>
                  <span className="swr-rubric-chip">
                    構成 {latest.review.rubricScores.structure ?? latest.review.rubricScores.organization ?? '-'}/4
                  </span>
                  <span className="swr-rubric-chip">
                    語彙 {latest.review.rubricScores.vocabulary ?? '-'}/4
                  </span>
                  <span className="swr-rubric-chip">
                    文法 {latest.review.rubricScores.grammar ?? '-'}/4
                  </span>
                </div>
              )}
              <p className="swr-comment-body">{latest.review.comment}</p>
              {latest.review.correctedText && (
                <div>
                  <div className="twr-row-between">
                    <strong className="swr-check-ok">
                      {showDiffMode
                        ? '先生の添削比較（取り消し線＝削除 ／ 下線太字＝修正・追加）：'
                        : '完成版モデル英文（クリーン表示）：'}
                    </strong>
                    <button
                      type="button"
                      className="swr-mini-btn"
                      onClick={() => setShowDiffMode(v => !v)}
                    >
                      <GitCompare size={13} aria-hidden="true" />
                      {showDiffMode ? '完成文のみ表示' : '添削の変更箇所を表示'}
                    </button>
                  </div>
                  <div className="swr-corrected-box" lang="en">
                    {showDiffMode
                      ? diffSegments.map((seg, i) =>
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
                        )
                      : latest.review.correctedText}
                  </div>
                </div>
              )}
              <div>
                <button
                  type="button"
                  onClick={() =>
                    openFeedbackSheetPrintWindow(latest, {
                      taskTitle,
                      instruction,
                      targetWordsLabel,
                    })
                  }
                >
                  <Printer size={15} aria-hidden="true" />
                  添削フィードバックシートを印刷 ／ PDF保存
                </button>
              </div>
            </>
          ) : (
            <p className="swr-muted-note">
              提出日時：{new Date(latest.submittedAt).toLocaleString('ja-JP')} —
              次回の個別指導までに先生が確認・添削します。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
