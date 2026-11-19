import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Printer,
  Send,
  Sparkles,
} from 'lucide-react';
import { auth } from '../../firebase';
import { loadJukuMemberships } from '../../utils/classAssignments';
import { safeLocalStorage } from '../../utils/safeLocalStorage';
import type { EikenGrade } from '../../eiken/config';
import type { SugorokuWritingSubmissionDoc } from '../shared/types';
import { analyzeWritingFormat, type WritingTaskKind } from './formatCheck';
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
  targetWordsLabel: string;
  targetRange: [number, number] | null;
  text: string;
  onOpenTeacherPreview?: () => void;
}

export function StudentWritingSubmitPanel({
  uid,
  grade,
  taskKey,
  taskTitle,
  taskKind,
  instruction,
  targetWordsLabel,
  targetRange,
  text,
  onOpenTeacherPreview,
}: StudentWritingSubmitPanelProps) {
  const memberships = useMemo(() => loadJukuMemberships(uid), [uid]);
  const [selectedClassId, setSelectedClassId] = useState<string>(
    () => memberships[0]?.classId || SUGOROKU_DEMO_CLASS_ID,
  );
  const [studentName, setStudentName] = useState<string>(() => {
    const cached = safeLocalStorage()?.getItem(STUDENT_NAME_CACHE_KEY);
    if (cached) return cached;
    return auth.currentUser?.displayName || '';
  });
  const [history, setHistory] = useState<SugorokuWritingSubmissionDoc[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (memberships.length > 0 && selectedClassId === SUGOROKU_DEMO_CLASS_ID) {
      setSelectedClassId(memberships[0].classId);
    }
  }, [memberships, selectedClassId]);

  const check = useMemo(
    () => analyzeWritingFormat(text, targetRange, taskKind),
    [text, targetRange, taskKind],
  );

  const loadHistory = useCallback(async () => {
    const list = await fetchStudentWritingSubmissions(selectedClassId, uid, taskKey);
    setHistory(list);
  }, [selectedClassId, uid, taskKey]);

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
        classId: selectedClassId,
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
      setStatusMsg('先生へ答案を提出しました！添削が返却されるとこの下に表示されます。');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '提出に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const latest = history[0] ?? null;

  return (
    <section className="swr-panel" aria-label="すごろく塾 ライティング形式チェックと先生への提出">
      <div className="swr-panel-header">
        <span className="swr-badge">
          <Sparkles size={14} aria-hidden="true" />
          すごろく塾 添削提出＆セルフ形式チェック
        </span>
        {onOpenTeacherPreview && (
          <button
            type="button"
            onClick={onOpenTeacherPreview}
            style={{ fontSize: '12px', minHeight: '34px', padding: '4px 10px' }}
          >
            講師の添削画面を開く
          </button>
        )}
      </div>

      {/* 形式セルフチェック */}
      <div className="swr-check-box" data-sugoroku-format-check>
        <p className="swr-check-title">
          {check.passedAll ? (
            <CheckCircle2 size={16} color="#1f6b5c" aria-hidden="true" />
          ) : (
            <AlertCircle size={16} color="#b45309" aria-hidden="true" />
          )}
          提出前の形式・スペル自動チェック
        </p>
        {check.words === 0 ? (
          <p className="swr-check-ok" style={{ color: '#5c6b73' }}>
            上の入力欄に英文を書くと、語数範囲・文頭大文字・ピリオド・頻出スペルミスを自動点検します。
          </p>
        ) : check.passedAll ? (
          <p className="swr-check-ok">
            語数（{check.words}語）・文頭大文字・文末ピリオド・基本スペルすべてOKです！
          </p>
        ) : (
          <ul className="swr-check-list">
            {check.issues.map((issue, idx) => (
              <li key={`${issue.code}-${idx}`}>{issue.message}</li>
            ))}
          </ul>
        )}
      </div>

      {/* 提出操作 */}
      <div className="swr-submit-row">
        {memberships.length > 1 && (
          <select
            aria-label="提出先クラス"
            className="swr-class-select"
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
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
          {submitting ? '提出中…' : latest ? '書き直して再提出する' : '先生へ提出する'}
        </button>
      </div>

      {statusMsg && <p className="swr-status-msg" role="status">{statusMsg}</p>}
      {errorMsg && <p className="swr-error-msg" role="alert">{errorMsg}</p>}

      {/* 最新の提出・添削返却パネル */}
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
              <small style={{ color: '#54626f', fontWeight: 700 }}>
                提出：{latest.wordCount} words
              </small>
            )}
          </div>

          {latest.review ? (
            <>
              {latest.review.rubricScores && (
                <div className="swr-rubric-chips">
                  <span className="swr-rubric-chip">
                    内容 {latest.review.rubricScores.content}/4
                  </span>
                  <span className="swr-rubric-chip">
                    構成 {latest.review.rubricScores.structure}/4
                  </span>
                  <span className="swr-rubric-chip">
                    語彙 {latest.review.rubricScores.vocabulary}/4
                  </span>
                  <span className="swr-rubric-chip">
                    文法 {latest.review.rubricScores.grammar}/4
                  </span>
                </div>
              )}
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '13.5px' }}>
                {latest.review.comment}
              </p>
              {latest.review.correctedText && (
                <div>
                  <strong style={{ fontSize: '12.5px', color: '#1f5c51' }}>
                    先生の添削例・自然な書き直し案：
                  </strong>
                  <div className="swr-corrected-box" lang="en">
                    {latest.review.correctedText}
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
            <p style={{ margin: 0, fontSize: '12.5px', color: '#54626f' }}>
              提出日時：{new Date(latest.submittedAt).toLocaleString('ja-JP')} —
              次回の個別指導までに先生が確認・添削します。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
