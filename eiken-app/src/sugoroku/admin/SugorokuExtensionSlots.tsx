/**
 * ===================================================================
 * すごろく塾管理者ポータル：AI 3 拡張スロット（ライティング添削・S-CBTスピーキング確認）
 * ===================================================================
 * マナトビ純正UI（Card / KineticText / ScoreRing / Bottom Sheet / Toast通知）で構築。
 * AI 3 の本格モジュール統合時は `customRender` でシームレスに差し替わる。
 */

import { useState } from 'react';
import { Copy, Eye, FileEdit, Mic, User } from 'lucide-react';
import { KineticText, ScoreRing } from '../../motion';
import { Badge, Card, PrimaryButton, SecondaryButton } from '../../components/ui';
import { getGradeLabel } from './adminAnalytics';
import { SugorokuBottomSheet, type ToastTone } from './SugorokuInteractiveUi';
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
      onToast?.('手元AI（Gemini/ChatGPT）用の英検4観点採点プロンプトをコピーしました！', 'done');
    } catch {
      onToast?.('クリップボードへのコピーに失敗しました', 'warn');
    }
  };

  return (
    <section
      aria-label="ライティング提出・添削スロット"
      className="sg-stagger"
      style={{ display: 'grid', gap: 12 }}
    >
      <Card tone="sky">
        <div className="sg-filter-bar">
          <div>
            <span className="mt-kicker">WRITING REVIEW SLOT (AI 3 READY)</span>
            <h2 className="mt-h2" style={{ margin: '2px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileEdit size={20} aria-hidden="true" />
              <KineticText text="英作文 提出答案・添削ボックス" />
            </h2>
            <p className="mt-small" style={{ margin: 0, color: 'var(--mt-ink-2)' }}>
              API課金ゼロで講師手元のAIを下書き補助に使える「4観点プロンプト1クリックコピー」搭載（AI 3統合時にA4白黒フィードバックPDF返却が接続されます）。
            </p>
          </div>
          <Badge>
            未添削 {submissions.filter((s) => s.status === 'submitted').length} / 全 {submissions.length} 件
          </Badge>
        </div>
      </Card>

      {submissions.length === 0 ? (
        <Card className="slog-empty">現在提出されているライティング答案はありません。</Card>
      ) : (
        <div className="sg-stagger" style={{ display: 'grid', gap: 10 }}>
          {submissions.map((sub) => (
            <Card key={sub.id} as="article" style={{ display: 'grid', gap: 10 }}>
              <div className="sg-filter-bar">
                <div className="sg-student-badges">
                  <span
                    className="mt-status"
                    data-status={sub.status === 'submitted' ? 'doing' : 'done'}
                  >
                    {sub.status === 'submitted' ? '未添削・要確認' : '添削返却済'}
                  </span>
                  <Badge>
                    {getGradeLabel(sub.grade)}・{sub.wordCount}語
                  </Badge>
                  <button
                    type="button"
                    className="mt-btn mt-btn-text"
                    style={{ minHeight: 34 }}
                    onClick={() => onSelectStudent?.(sub.studentUid)}
                  >
                    <User size={14} aria-hidden="true" />
                    {sub.studentName}
                  </button>
                </div>

                <div className="sg-chip-group">
                  <SecondaryButton
                    onClick={() => setInspectSub(sub)}
                    icon={<Eye size={15} aria-hidden="true" />}
                  >
                    全文シート
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={() => void copyPrompt(sub)}
                    icon={<Copy size={15} aria-hidden="true" />}
                  >
                    4観点採点プロンプトをコピー
                  </PrimaryButton>
                </div>
              </div>

              <strong style={{ font: '800 15px/1.35 var(--mt-font-display)', color: 'var(--mt-ink-warm)' }}>
                {sub.taskTitle || sub.taskKey}
              </strong>

              <p
                style={{
                  margin: 0,
                  padding: '10px 12px',
                  borderRadius: 'var(--mt-radius-md)',
                  background: 'var(--mt-bg-sunken)',
                  font: '500 13px/1.6 var(--mt-font-body)',
                  color: 'var(--mt-ink)',
                  overflowWrap: 'anywhere',
                }}
              >
                {sub.text}
              </p>

              {sub.review && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--mt-radius-md)',
                    background: 'var(--mt-done-soft)',
                    color: 'var(--mt-done)',
                  }}
                >
                  <ScoreRing
                    rate={sub.review.score / (sub.review.maxScore ?? 16)}
                    size={38}
                    stroke={5}
                    tone="done"
                  />
                  <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                    <b>
                      講師スコア {sub.review.score}/{sub.review.maxScore ?? 16}
                    </b>
                    ：{sub.review.comment}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <SugorokuBottomSheet
        open={!!inspectSub}
        kicker="WRITING SUBMISSION"
        title={inspectSub ? `${inspectSub.studentName}の提出答案` : '提出答案'}
        onClose={() => setInspectSub(null)}
      >
        {inspectSub && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="sg-student-badges">
              <Badge>{getGradeLabel(inspectSub.grade)}</Badge>
              <Badge tone="gold">{inspectSub.wordCount} words</Badge>
            </div>
            <strong style={{ font: '800 15px/1.4 var(--mt-font-display)', color: 'var(--mt-ink-warm)' }}>
              {inspectSub.taskTitle || inspectSub.taskKey}
            </strong>
            <div
              style={{
                padding: 14,
                borderRadius: 'var(--mt-radius-md)',
                border: '1px solid var(--mt-line)',
                background: '#fff',
                font: '500 14px/1.7 var(--mt-font-body)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {inspectSub.text}
            </div>
            <PrimaryButton
              block
              onClick={() => void copyPrompt(inspectSub)}
              icon={<Copy size={16} aria-hidden="true" />}
            >
              手元AI用の4観点採点プロンプトをコピーする
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
    <section
      aria-label="S-CBTスピーキング音声確認スロット"
      className="sg-stagger"
      style={{ display: 'grid', gap: 12 }}
    >
      <Card tone="lilac">
        <div className="sg-filter-bar">
          <div>
            <span className="mt-kicker">S-CBT SPEAKING SLOT (AI 3 READY)</span>
            <h2 className="mt-h2" style={{ margin: '2px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mic size={20} aria-hidden="true" />
              <KineticText text="S-CBT方式 スピーキング録音確認" />
            </h2>
            <p className="mt-small" style={{ margin: 0, color: 'var(--mt-ink-2)' }}>
              週2回のオンライン面接指導以外の自主練習（音読＋No.1〜No.4録音）を確認できます（AI 3統合時に連続再生・倍速プレイヤーが接続されます）。
            </p>
          </div>
          <Badge>提出 {submissions.length} 件</Badge>
        </div>
      </Card>

      {submissions.length === 0 ? (
        <Card className="slog-empty">現在提出されているスピーキング録音はありません。</Card>
      ) : (
        <div className="sg-stagger" style={{ display: 'grid', gap: 10 }}>
          {submissions.map((sub) => (
            <Card key={sub.id} as="article" style={{ display: 'grid', gap: 10 }}>
              <div className="sg-student-badges">
                <span
                  className="mt-status"
                  data-status={sub.status === 'submitted' ? 'doing' : 'done'}
                >
                  {sub.status === 'submitted' ? '未評価（録音5パート到着）' : '評価返却済'}
                </span>
                <Badge>{getGradeLabel(sub.grade)}</Badge>
                <button
                  type="button"
                  className="mt-btn mt-btn-text"
                  style={{ minHeight: 34 }}
                  onClick={() => onSelectStudent?.(sub.studentUid)}
                >
                  <User size={14} aria-hidden="true" />
                  {sub.studentName}
                </button>
              </div>

              <strong style={{ font: '800 15px/1.35 var(--mt-font-display)', color: 'var(--mt-ink-warm)' }}>
                {sub.setTitle || sub.setId}
              </strong>

              <div className="slog-rows">
                {sub.recordings.map((rec) => (
                  <div key={rec.partId} className="slog-row">
                    <span>
                      <strong>{SPEAKING_PART_LABELS[rec.partId] || rec.partId}</strong>
                      <small>
                        形式：{rec.mimeType.includes('mp4') ? 'iOS/Safari AAC' : 'WebM/Opus'}
                      </small>
                    </span>
                    <b>{rec.durationSec}秒</b>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
