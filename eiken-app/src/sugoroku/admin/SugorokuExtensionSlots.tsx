/**
 * すごろく塾 管理者ポータル：英作文・スピーキング確認タブ（エッセンシャル設計）
 */

import { useState } from 'react';
import { Copy, Eye } from 'lucide-react';
import { ScoreRing } from '../../motion';
import { Card, PrimaryButton, SecondaryButton } from '../../components/ui';
import { getGradeLabel } from './adminAnalytics';
import { SugorokuBottomSheet, type ToastTone } from './SugorokuInteractiveUi';
import type {
  SugorokuAdminExtensionSlots,
  SugorokuSpeakingSubmissionDoc,
  SugorokuWritingSubmissionDoc,
} from '../shared/types';

export function buildAiRubricPromptForTeacher(sub: SugorokuWritingSubmissionDoc): string {
  return [
    `あなたは英検${getGradeLabel(sub.grade)}のライティング指導講師です。以下の生徒答案を英検4観点（内容・構成・語彙・文法、各4点＝16点満点）で採点し、簡潔な日本語フィードバックと改善例を作成してください。`,
    '',
    `【課題】${sub.taskTitle || sub.taskKey}`,
    `【生徒】${sub.studentName}（${sub.wordCount}語）`,
    sub.text,
  ].join('\n');
}

interface WritingExtensionHostProps {
  classId: string;
  isDemoMode: boolean;
  submissions: SugorokuWritingSubmissionDoc[];
  onSelectStudent?: (studentUid: string) => void;
  onToast?: (message: string, tone?: ToastTone) => void;
  customRender?: SugorokuAdminExtensionSlots['renderWritingReviewTab'];
}

export function SugorokuWritingExtensionSlot({
  classId,
  isDemoMode,
  submissions,
  onSelectStudent,
  onToast,
  customRender,
}: WritingExtensionHostProps) {
  const [inspectSub, setInspectSub] = useState<SugorokuWritingSubmissionDoc | null>(null);

  if (customRender) {
    return <>{customRender({ classId, isDemoMode, submissions, onSelectStudent })}</>;
  }

  const copyPrompt = async (sub: SugorokuWritingSubmissionDoc) => {
    try {
      await navigator.clipboard.writeText(buildAiRubricPromptForTeacher(sub));
      onToast?.('採点プロンプトをコピーしました', 'done');
    } catch {
      onToast?.('コピーに失敗しました', 'warn');
    }
  };

  if (submissions.length === 0) {
    return <Card className="slog-empty">提出された答案はありません</Card>;
  }

  return (
    <section aria-label="英作文提出" className="sg-stagger sg-grid-10">
      {submissions.map((sub) => (
        <Card key={sub.id} as="article" className="sg-grid-10">
          <div className="sg-toolbar">
            <div className="sg-row-head">
              <button
                type="button"
                className="mt-btn mt-btn-text sg-sub-name-btn"
                onClick={() => onSelectStudent?.(sub.studentUid)}
              >
                <strong className="sg-sub-name-strong">
                  {sub.studentName}
                </strong>
              </button>
              <span className="sg-grade-tag">
                {getGradeLabel(sub.grade).replace('英検', '')} · {sub.wordCount}語
              </span>
              {sub.status === 'submitted' && (
                <span className="sg-alert-text" data-warn="true">未添削</span>
              )}
            </div>

            <div className="sg-chip-group">
              <SecondaryButton
                onClick={() => setInspectSub(sub)}
                icon={<Eye size={14} aria-hidden="true" />}
              >
                全文
              </SecondaryButton>
              <PrimaryButton
                onClick={() => void copyPrompt(sub)}
                icon={<Copy size={14} aria-hidden="true" />}
              >
                採点用コピー
              </PrimaryButton>
            </div>
          </div>

          <p className="sg-sub-excerpt">
            {sub.text}
          </p>

          {sub.review && (
            <div className="sg-sub-review-row">
              <ScoreRing
                rate={sub.review.score / (sub.review.maxScore ?? 16)}
                size={28}
                stroke={4}
                tone="brand"
              />
              <b>
                {sub.review.score}/{sub.review.maxScore ?? 16}
              </b>
              <span className="sg-ink-2">{sub.review.comment}</span>
            </div>
          )}
        </Card>
      ))}

      <SugorokuBottomSheet
        open={!!inspectSub}
        title={inspectSub ? inspectSub.studentName : '答案'}
        onClose={() => setInspectSub(null)}
      >
        {inspectSub && (
          <div className="sg-grid-12">
            <div className="sg-row-head">
              <span className="sg-grade-tag">
                {getGradeLabel(inspectSub.grade).replace('英検', '')}
              </span>
              <span className="sg-sub-meta">
                {inspectSub.wordCount}語 · {inspectSub.taskTitle || inspectSub.taskKey}
              </span>
            </div>
            <div className="sg-sub-fulltext">
              {inspectSub.text}
            </div>
            <PrimaryButton
              block
              onClick={() => void copyPrompt(inspectSub)}
              icon={<Copy size={15} aria-hidden="true" />}
            >
              採点用プロンプトをコピー
            </PrimaryButton>
          </div>
        )}
      </SugorokuBottomSheet>
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
  reading_aloud: '音読',
  q1: 'No.1',
  q2: 'No.2',
  q3: 'No.3',
  q4: 'No.4',
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

  if (submissions.length === 0) {
    return <Card className="slog-empty">提出された録音はありません</Card>;
  }

  return (
    <section aria-label="スピーキング録音" className="sg-stagger sg-grid-10">
      {submissions.map((sub) => (
        <Card key={sub.id} as="article" className="sg-grid-10">
          <div className="sg-row-head">
            <button
              type="button"
              className="mt-btn mt-btn-text sg-sub-name-btn"
              onClick={() => onSelectStudent?.(sub.studentUid)}
            >
              <strong className="sg-sub-name-strong">
                {sub.studentName}
              </strong>
            </button>
            <span className="sg-grade-tag">
              {getGradeLabel(sub.grade).replace('英検', '')}
            </span>
            <span className="sg-sub-meta">
              {sub.setTitle || sub.setId}
            </span>
          </div>

          <div className="slog-rows">
            {sub.recordings.map((rec) => (
              <div key={rec.partId} className="slog-row">
                <span>
                  <strong>{SPEAKING_PART_LABELS[rec.partId] || rec.partId}</strong>
                </span>
                <b>{rec.durationSec}秒</b>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </section>
  );
}
