/**
 * ===================================================================
 * すごろく塾管理者ポータル：AI 3 拡張スロット（ライティング添削・S-CBTスピーキング確認）
 * ===================================================================
 * AI 3（feat/ai3-writing-and-scbt-speaking）が実装する本格添削・音声再生モジュールを
 * `extensionSlots` Props 経由でそのまま差し込める拡張ホスト。
 *
 * AI 3 マージ前の単体動作時・試作デモ時にも、提出状況一覧・4観点AI採点補助プロンプトコピー・
 * S-CBTパート別録音メタデータ確認が完結して動作するフォールバックビューを内蔵する。
 */

import { useState } from 'react';
import { Check, Copy, FileEdit, Mic, User } from 'lucide-react';
import { getGradeLabel } from './adminAnalytics';
import type {
  SugorokuAdminExtensionSlots,
  SugorokuSpeakingSubmissionDoc,
  SugorokuWritingSubmissionDoc,
} from '../shared/types';

export function buildAiRubricPromptForTeacher(sub: SugorokuWritingSubmissionDoc): string {
  return [
    `あなたは英検${getGradeLabel(sub.grade)}のライティング指導講師です。以下の生徒答案を英検4観点（内容・構成・語彙・文法、各4点＝16点満点）で採点し、高校生の運動部生にも分かりやすい励まし付きの日本語フィードバックと自然な改善例を作成してください。`,
    '',
    `【課題】${sub.taskTitle || sub.taskKey}`,
    `【生徒名】${sub.studentName}`,
    `【語数】${sub.wordCount}語`,
    `【生徒の解答】`,
    sub.text,
  ].join('\n');
}

interface WritingExtensionHostProps {
  classId: string;
  isDemoMode: boolean;
  submissions: SugorokuWritingSubmissionDoc[];
  onSelectStudent?: (studentUid: string) => void;
  customRender?: SugorokuAdminExtensionSlots['renderWritingReviewTab'];
}

export function SugorokuWritingExtensionSlot({
  classId,
  isDemoMode,
  submissions,
  onSelectStudent,
  customRender,
}: WritingExtensionHostProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (customRender) {
    return <>{customRender({ classId, isDemoMode, submissions, onSelectStudent })}</>;
  }

  const copyPrompt = async (sub: SugorokuWritingSubmissionDoc) => {
    try {
      await navigator.clipboard.writeText(buildAiRubricPromptForTeacher(sub));
      setCopiedId(sub.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <section aria-label="ライティング提出・添削スロット" className="space-y-3">
      <div className="rounded-2xl border border-[#E2DDD2] bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#1B2631] flex items-center gap-2">
              <FileEdit className="w-5 h-5 text-[#1D58A8] shrink-0" />
              ライティング提出答案一覧（講師添削・AI補助プロンプト連携）
            </h2>
            <p className="text-xs sm:text-sm text-[#4B5563] mt-0.5">
              生徒から提出された英作文答案を確認できます（AI 3 モジュール統合時はA4添削フィードバックPDF出力が直接開きます）。
            </p>
          </div>
          <span className="rounded-full bg-[#EEF5FF] px-3 py-1 text-xs font-bold text-[#1D58A8]">
            提出 {submissions.length} 件（未添削 {submissions.filter((s) => s.status === 'submitted').length} 件）
          </span>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-2xl border border-[#E2DDD2] bg-white p-8 text-center text-sm text-[#6B7280]">
          現在提出されているライティング答案はありません。
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <article
              key={sub.id}
              className="rounded-2xl border border-[#E2DDD2] bg-white p-4 sm:p-5 space-y-3 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      sub.status === 'submitted'
                        ? 'bg-[#FEF3D6] text-[#945608] border border-[#F3D285]'
                        : 'bg-[#EAF7F0] text-[#16794F] border border-[#B5E2C9]'
                    }`}
                  >
                    {sub.status === 'submitted' ? '未添削（要確認）' : '添削返却済'}
                  </span>
                  <span className="rounded-md bg-[#F1EFE9] px-2 py-0.5 text-xs font-bold text-[#374151]">
                    {getGradeLabel(sub.grade)} / {sub.wordCount}語
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectStudent?.(sub.studentUid)}
                    className="inline-flex items-center gap-1 text-sm font-bold text-[#1D58A8] hover:underline"
                  >
                    <User className="w-3.5 h-3.5" />
                    {sub.studentName}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void copyPrompt(sub)}
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-[#1D58A8] bg-[#EEF5FF] px-3 py-1.5 text-xs font-bold text-[#1D58A8] hover:bg-[#DCEBFE]"
                >
                  {copiedId === sub.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      4観点採点プロンプトをコピーしました
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      手元AI用・4観点採点プロンプトをコピー
                    </>
                  )}
                </button>
              </div>

              <h3 className="text-sm font-bold text-[#1B2631]">
                {sub.taskTitle || sub.taskKey}
              </h3>

              <div className="rounded-xl bg-[#FDFBF7] border border-[#EAE6DC] p-3 text-xs sm:text-sm text-[#1B2631] font-mono leading-relaxed whitespace-pre-wrap break-words">
                {sub.text}
              </div>

              {sub.review && (
                <div className="rounded-xl bg-[#EAF7F0] border border-[#B5E2C9] p-3 text-xs sm:text-sm text-[#145337] space-y-1">
                  <p className="font-bold">
                    講師添削スコア：{sub.review.score} / {sub.review.maxScore ?? 16}{' '}
                    {sub.review.reviewerName ? `（担当：${sub.review.reviewerName}）` : ''}
                  </p>
                  <p className="leading-relaxed">{sub.review.comment}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

interface SpeakingExtensionHostProps {
  classId: string;
  isDemoMode: boolean;
  submissions: SugorokuSpeakingSubmissionDoc[];
  onSelectStudent?: (studentUid: string) => void;
  customRender?: SugorokuAdminExtensionSlots['renderSpeakingReviewTab'];
}

const SPEAKING_PART_LABELS: Record<string, string> = {
  reading_aloud: '音読（Reading Aloud）',
  q1: 'No.1 パッセージ質問',
  q2: 'No.2 イラスト状況描写',
  q3: 'No.3 受験者自身の意見①',
  q4: 'No.4 社会テーマ意見②',
};

export function SugorokuSpeakingExtensionSlot({
  classId,
  isDemoMode,
  submissions,
  onSelectStudent,
  customRender,
}: SpeakingExtensionHostProps) {
  if (customRender) {
    return <>{customRender({ classId, isDemoMode, submissions, onSelectStudent })}</>;
  }

  return (
    <section aria-label="S-CBTスピーキング音声確認スロット" className="space-y-3">
      <div className="rounded-2xl border border-[#E2DDD2] bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#1B2631] flex items-center gap-2">
              <Mic className="w-5 h-5 text-[#16794F] shrink-0" />
              S-CBT方式 スピーキング録音提出一覧
            </h2>
            <p className="text-xs sm:text-sm text-[#4B5563] mt-0.5">
              生徒が自主練習で録音したS-CBT模擬面接（音読＋No.1〜No.4）の提出状況を確認できます（AI 3 モジュール統合時は連続再生・速度変更プレイヤーが接続されます）。
            </p>
          </div>
          <span className="rounded-full bg-[#EAF7F0] px-3 py-1 text-xs font-bold text-[#16794F]">
            提出 {submissions.length} 件
          </span>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-2xl border border-[#E2DDD2] bg-white p-8 text-center text-sm text-[#6B7280]">
          現在提出されているスピーキング録音はありません。
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <article
              key={sub.id}
              className="rounded-2xl border border-[#E2DDD2] bg-white p-4 sm:p-5 space-y-3 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      sub.status === 'submitted'
                        ? 'bg-[#FEF3D6] text-[#945608] border border-[#F3D285]'
                        : 'bg-[#EAF7F0] text-[#16794F] border border-[#B5E2C9]'
                    }`}
                  >
                    {sub.status === 'submitted' ? '未評価（録音あり）' : '評価返却済'}
                  </span>
                  <span className="rounded-md bg-[#F1EFE9] px-2 py-0.5 text-xs font-bold text-[#374151]">
                    {getGradeLabel(sub.grade)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectStudent?.(sub.studentUid)}
                    className="inline-flex items-center gap-1 text-sm font-bold text-[#1D58A8] hover:underline"
                  >
                    <User className="w-3.5 h-3.5" />
                    {sub.studentName}
                  </button>
                </div>
              </div>

              <h3 className="text-sm font-bold text-[#1B2631]">
                {sub.setTitle || sub.setId}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {sub.recordings.map((rec) => (
                  <div
                    key={rec.partId}
                    className="rounded-xl border border-[#EAE6DC] bg-[#FDFBF7] px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-bold text-[#1B2631] truncate">
                      {SPEAKING_PART_LABELS[rec.partId] || rec.partId}
                    </span>
                    <span className="text-[#4B5563] shrink-0">
                      {rec.durationSec}秒 ({rec.mimeType.includes('mp4') ? 'AAC' : 'Opus'})
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
