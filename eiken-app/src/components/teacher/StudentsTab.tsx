import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  RefreshCw,
  Download,
  AlertTriangle,
  PenLine,
  Info,
  Link2,
  MessageCircle,
  Clock,
  Target,
  ShieldCheck,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { aggregateClass, type ClassroomDoc } from '../../utils/classroomCore';
import { type StudentSummary } from '../../utils/studySummary';
import type { ThemeShape } from './teacherTheme';
import {
  buildClassInviteMessage,
  buildClassInviteUrl,
  createDefaultClassSettings,
  FOCUS_SKILL_OPTIONS,
  getExamSessionShortLabel,
  type JukuClassSettings,
} from '../../sugoroku/admin/classroomSettings';
import { getGradeLabel } from '../../sugoroku/admin/adminAnalytics';

// ============================================================================
// 生徒の様子タブ（招待キット ＋ KPI ＋ 要声掛け生徒 ＋ 生徒一覧）
// ============================================================================

interface StudentsTabProps {
  students: StudentSummary[];
  aggregate: ReturnType<typeof aggregateClass>;
  loading: boolean;
  theme: ThemeShape;
  activeClass: ClassroomDoc | null;
  classSettings?: JukuClassSettings;
  copiedCode: string;
  editingUid: string;
  editingName: string;
  onCopyCode: (code: string) => void;
  onRefresh: () => void;
  onExportCsv: () => void;
  onStartEdit: (student: StudentSummary) => void;
  onChangeEditingName: (value: string) => void;
  onSaveEdit: (uid: string) => void;
  onCancelEdit: () => void;
  onOpenStudyTime?: () => void;
  onOpenHomework?: () => void;
  onOpenEditClass?: () => void;
}

export function StudentsTab(props: StudentsTabProps) {
  const { students, aggregate, loading, theme, activeClass } = props;
  const settings = props.classSettings ?? createDefaultClassSettings(activeClass?.id || '');
  const [copiedKey, setCopiedKey] = useState<'code' | 'url' | 'line' | ''>('');

  const copyText = async (text: string, key: 'code' | 'url' | 'line') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((curr) => (curr === key ? '' : curr)), 2000);
    } catch {
      if (key === 'code' && activeClass) {
        props.onCopyCode(activeClass.joinCode);
      }
    }
  };

  // 誰も参加していないクラス＝招待周知フェーズ。
  // コードだけでなく、ワンタップ招待URL・LINE送信文・設定済み目標を並べて即運用開始できる形にする。
  if (!loading && students.length === 0) {
    return (
      <div className="space-y-4">
        {activeClass && (
          <InviteKitCard
            room={activeClass}
            settings={settings}
            accent={theme.accent}
            prominent
            copiedKey={copiedKey}
            onCopyCode={() => void copyText(activeClass.joinCode, 'code')}
            onCopyUrl={() => void copyText(buildClassInviteUrl(activeClass.joinCode), 'url')}
            onCopyLine={() =>
              void copyText(buildClassInviteMessage({ room: activeClass, settings }), 'line')
            }
            onOpenEditClass={props.onOpenEditClass}
            onOpenHomework={props.onOpenHomework}
          />
        )}

        <div className="bg-white rounded-2xl border border-[#E0E1DD] p-6 text-center">
          <Users className="w-9 h-9 mx-auto mb-2.5 text-[#9BA3AE]" />
          <h3 className="text-base font-extrabold text-[#1B2631] mb-1.5">
            生徒の入室を待っています
          </h3>
          <p className="text-xs sm:text-sm text-[#4B5563] leading-relaxed max-w-lg mx-auto mb-4">
            上の「LINE案内文をコピー」または「招待URLをコピー」から生徒・保護者へ送ると、
            入室した瞬間から学習時間・復習状況・課題の進捗がこの画面にリアルタイム反映されます。
          </p>
          <button
            type="button"
            onClick={props.onRefresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-[#E0E1DD] bg-[#FAF8F2] text-[#374151] hover:bg-[#F1EFE9] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            参加状況を再確認する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 常設コンパクト招待バー ＋ コース目標バッジ */}
      {activeClass && (
        <InviteKitCard
          room={activeClass}
          settings={settings}
          accent={theme.accent}
          prominent={false}
          copiedKey={copiedKey}
          onCopyCode={() => void copyText(activeClass.joinCode, 'code')}
          onCopyUrl={() => void copyText(buildClassInviteUrl(activeClass.joinCode), 'url')}
          onCopyLine={() =>
            void copyText(buildClassInviteMessage({ room: activeClass, settings }), 'line')
          }
          onOpenEditClass={props.onOpenEditClass}
          onOpenHomework={props.onOpenHomework}
        />
      )}

      {/* 上段：4つの主要KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="在籍生徒" value={`${aggregate.memberCount}人`} sub={activeClass?.joinOpen ? '参加受付中' : '受付締切中'} accent={theme.accent} />
        <StatCard
          label="直近7日に学習"
          value={`${aggregate.activeIn7}人`}
          sub={
            aggregate.memberCount > 0
              ? `稼働率 ${Math.round((aggregate.activeIn7 / aggregate.memberCount) * 100)}%`
              : undefined
          }
          accent={theme.accent}
        />
        <StatCard
          label="平均クリア大問"
          value={`${aggregate.avgSolved}問`}
          sub={`目標 1日${settings.dailyGoalMinutes}分×週${settings.weeklyGoalDays}日`}
          accent={theme.accent}
        />
        <StatCard
          label="平均取り組み度"
          value={`${aggregate.avgEngagement}`}
          sub="継続・立て直し・未処理"
          accent={theme.accent}
        />
      </div>

      {/* 声を掛けたい生徒 */}
      {(aggregate.neverStudied > 0 || aggregate.needsAttention.length > 0) && (
        <div className="bg-[#FFFBEB] border border-[#F4D98C] rounded-2xl p-4">
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-[#8A6412] mb-2">
            <AlertTriangle className="w-4 h-4" />
            優先フォロー推奨の生徒
          </p>
          {aggregate.neverStudied > 0 && (
            <p className="text-xs sm:text-sm text-[#6B5410] mb-2 leading-relaxed">
              入室後まだ一度も演習していない生徒が <strong>{aggregate.neverStudied}人</strong> います。初回課題の案内が効果的です。
            </p>
          )}
          {aggregate.needsAttention.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {aggregate.needsAttention.map((student) => (
                <span
                  key={student.uid}
                  className="px-2.5 py-1 rounded-lg bg-white/90 border border-[#EBD9A4] text-xs text-[#6B5410]"
                >
                  {student.displayName}
                  <span className="ml-1 font-extrabold text-[#96342B]">期限切れ復習 {student.overdue}件</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* アクションバー */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={props.onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border border-[#E0E1DD] bg-white text-[#4B5563] hover:bg-[#FAF8F2] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            最新に更新
          </button>
          <button
            type="button"
            onClick={props.onExportCsv}
            disabled={students.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold text-white transition-transform active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: theme.accent }}
          >
            <Download className="w-4 h-4" />
            成績・進捗CSV出力
          </button>
        </div>

        {props.onOpenStudyTime && (
          <button
            type="button"
            onClick={props.onOpenStudyTime}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-[#F0FAF8] text-[#1F635B] border border-[#B5E2DC] hover:bg-[#E3F5F1] transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            分野別の勉強時間内訳を見る
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/*
        ⚠️ 教育的な安全装置（外してはいけない）
        「取り組み度」が評定として一人歩きすることを防ぐため、常時表示する。
      */}
      <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-[#F4F7FA] border border-[#D9E4EC] text-xs text-[#3C5A6E] leading-relaxed">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          「取り組み度」は<strong>継続（最大50）</strong>・<strong>立て直し（最大35）</strong>・
          <strong>未処理（最大15）</strong>の合計です。成績そのものではなく、
          先生の判断を助ける材料としてご覧ください。間違えた回数そのものは減点していません（挑戦を罰しないため）。
        </span>
      </div>

      {/* 生徒一覧 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-[#6B7280]">学習状況を集計しています…</div>
      ) : (
        <div className="space-y-2.5">
          {students.map((student) => (
            <StudentRow
              key={student.uid}
              student={student}
              theme={theme}
              isEditing={props.editingUid === student.uid}
              editingName={props.editingName}
              onStartEdit={() => props.onStartEdit(student)}
              onChangeEditingName={props.onChangeEditingName}
              onSave={() => props.onSaveEdit(student.uid)}
              onCancel={props.onCancelEdit}
              onOpenStudyTime={props.onOpenStudyTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 招待キット＆コース設定サマリーカード
// ============================================================================

function InviteKitCard({
  room,
  settings,
  accent,
  prominent,
  copiedKey,
  onCopyCode,
  onCopyUrl,
  onCopyLine,
  onOpenEditClass,
  onOpenHomework,
}: {
  room: ClassroomDoc;
  settings: JukuClassSettings;
  accent: string;
  prominent: boolean;
  copiedKey: 'code' | 'url' | 'line' | '';
  onCopyCode: () => void;
  onCopyUrl: () => void;
  onCopyLine: () => void;
  onOpenEditClass?: () => void;
  onOpenHomework?: () => void;
}) {
  const weeklyMin = settings.dailyGoalMinutes * settings.weeklyGoalDays;
  const skillLabels = settings.focusSkills
    .map((k) => FOCUS_SKILL_OPTIONS.find((o) => o.key === k)?.label)
    .filter(Boolean);

  return (
    <div className="bg-white rounded-3xl border border-[#E0E1DD] shadow-xs overflow-hidden">
      <div className={`p-4 sm:p-5 ${prominent ? 'bg-gradient-to-br from-[#F2FAF8] via-white to-[#FDFBF7]' : ''}`}>
        {/* コース目標バッジ帯 */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#EBF8F6] text-[#1F635B] border border-[#BFE6E0]">
              <Target className="w-3 h-3" />
              {getGradeLabel(room.subject)} / {getExamSessionShortLabel(settings.examSession)}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FAF8F2] text-[#374151] border border-[#E6E3DA]">
              <Clock className="w-3 h-3 text-[#3E9C93]" />
              1日{settings.dailyGoalMinutes}分×週{settings.weeklyGoalDays}日（週{weeklyMin}分）
            </span>
            {room.plan === 'juku' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EEF7FF] text-[#1E5685] border border-[#C6E0F7]">
                <ShieldCheck className="w-3 h-3" />
                塾生広告OFF
              </span>
            )}
          </div>

          {onOpenEditClass && (
            <button
              type="button"
              onClick={onOpenEditClass}
              className="text-xs font-bold text-[#4B5563] hover:text-[#1B2631] underline underline-offset-2"
            >
              コース目標・名前を編集
            </button>
          )}
        </div>

        {/* 招待コード ＋ ワンタップ共有ボタン群 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <div
              className="px-4 py-2 rounded-2xl border-2 bg-white"
              style={{ borderColor: accent }}
            >
              <span className="block text-[10px] font-bold text-[#6B7280] tracking-wider">
                招待コード（6文字）
              </span>
              <span className="block text-2xl font-extrabold tracking-[0.22em] text-[#1B2631] font-mono">
                {room.joinCode}
              </span>
            </div>
            {prominent && (
              <div className="text-xs text-[#4B5563] leading-relaxed">
                <p className="font-bold text-[#1B2631]">準備完了！生徒を招待できます</p>
                <p className="text-[11px] text-[#6B7280] mt-0.5">
                  招待リンクから開くとコード入力も自動化されます
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[#E0E1DD] bg-white text-[#374151] hover:bg-[#FAF8F2] transition-colors"
            >
              {copiedKey === 'code' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#3E9C93]" />
                  コードコピー済
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  コードのみ
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onCopyUrl}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[#BFE6E0] bg-[#F2FAF8] text-[#1F635B] hover:bg-[#E4F5F1] transition-colors"
            >
              {copiedKey === 'url' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#236B63]" />
                  招待URLコピー済
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  招待URLをコピー
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onCopyLine}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-white shadow-xs transition-transform active:scale-95"
              style={{ backgroundColor: accent }}
            >
              {copiedKey === 'line' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  LINE案内文をコピーしました！
                </>
              ) : (
                <>
                  <MessageCircle className="w-3.5 h-3.5" />
                  LINE・保護者案内文をコピー
                </>
              )}
            </button>
          </div>
        </div>

        {/* 重点スキル・初回課題ショートカット */}
        {(skillLabels.length > 0 || (prominent && onOpenHomework && room.plan === 'juku')) && (
          <div className="mt-3 pt-3 border-t border-[#F0EDE6] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-[#6B7280]">
              <span className="font-bold text-[#4B5563]">重点スキル：</span>
              {skillLabels.map((lbl) => (
                <span
                  key={lbl}
                  className="px-2 py-0.5 rounded-md bg-[#F6F5F0] text-[#374151] text-[11px]"
                >
                  {lbl}
                </span>
              ))}
            </div>
            {prominent && onOpenHomework && room.plan === 'juku' && (
              <button
                type="button"
                onClick={onOpenHomework}
                className="inline-flex items-center gap-1 text-xs font-extrabold text-[#236B63] hover:underline"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                生徒が入る前に最初の宿題をセットしておく →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E0E1DD] p-3.5">
      <p className="text-xs font-bold text-[#6B7280] mb-1">{label}</p>
      <p className="text-xl sm:text-2xl font-extrabold leading-tight" style={{ color: accent }}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-[#9BA3AE] mt-1 truncate">{sub}</p>}
    </div>
  );
}

// ============================================================================
// 生徒1人分のカード
// ============================================================================

interface StudentRowProps {
  student: StudentSummary;
  theme: ThemeShape;
  isEditing: boolean;
  editingName: string;
  onStartEdit: () => void;
  onChangeEditingName: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onOpenStudyTime?: () => void;
}

const StudentRow: React.FC<StudentRowProps> = ({
  student,
  theme,
  isEditing,
  editingName,
  onStartEdit,
  onChangeEditingName,
  onSave,
  onCancel,
  onOpenStudyTime,
}) => {
  const { engagement, review } = student;
  const hasOverdue = review.overdue > 0;

  return (
    <div className="bg-white rounded-2xl border border-[#E0E1DD] p-4 hover:border-[#C9D2DA] transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        {isEditing ? (
          <div className="flex-1 flex flex-wrap items-center gap-2">
            <input
              value={editingName}
              onChange={(event) => onChangeEditingName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSave();
                if (event.key === 'Escape') onCancel();
              }}
              autoFocus
              maxLength={24}
              placeholder="講師用の管理名（本名・学年など）"
              className="flex-1 min-w-[10rem] px-3 py-1.5 rounded-lg border border-[#C9D2DA] text-sm text-[#1B2631] focus:outline-none focus:border-[#3E9C93]"
            />
            <button
              type="button"
              onClick={onSave}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: theme.accent }}
            >
              保存
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-xs border border-[#E0E1DD] text-[#4B5563]"
            >
              やめる
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onStartEdit}
              className="flex items-center gap-1.5 text-left group"
              title="講師用の管理名（本名や生徒番号）を設定できます。公開画面には表示されません。"
            >
              <span className="text-sm font-extrabold text-[#1B2631]">{student.displayName}</span>
              <PenLine className="w-3.5 h-3.5 text-[#9BA3AE] group-hover:text-[#4B5563]" />
            </button>
            {onOpenStudyTime && (
              <button
                type="button"
                onClick={onOpenStudyTime}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#F4F7FA] text-[#3C5A6E] hover:bg-[#E7EFF6] transition-colors"
              >
                <Clock className="w-3 h-3" />
                時間内訳
              </button>
            )}
          </div>
        )}

        {!isEditing && (
          <div className="text-right shrink-0">
            <p className="text-lg font-extrabold leading-none" style={{ color: theme.accent }}>
              {engagement.score}
            </p>
            <p className="text-[11px] text-[#9BA3AE] mt-0.5">取り組み度</p>
          </div>
        )}
      </div>

      {/* 内訳バー（3分割） */}
      <div className="flex h-2 rounded-full overflow-hidden bg-[#F1EFE9] mb-2">
        <div
          className="bg-[#6FA8C5]"
          style={{ width: `${engagement.breakdown.continuity}%` }}
          title={`継続 ${engagement.breakdown.continuity}/50`}
        />
        <div
          className="bg-[#5BC0BE]"
          style={{ width: `${engagement.breakdown.recovery}%` }}
          title={`立て直し ${engagement.breakdown.recovery}/35`}
        />
        <div
          className="bg-[#F4D03F]"
          style={{ width: `${engagement.breakdown.upkeep}%` }}
          title={`未処理 ${engagement.breakdown.upkeep}/15`}
        />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#6B7280] mb-2.5">
        <span>継続 {engagement.breakdown.continuity}/50</span>
        <span>立て直し {engagement.breakdown.recovery}/35</span>
        <span>未処理 {engagement.breakdown.upkeep}/15</span>
      </div>

      {/* 実数 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 text-xs text-[#4B5563]">
        <span>
          解いた大問 <strong className="text-[#1B2631]">{student.solvedTotal}</strong>
        </span>
        <span>
          14日で <strong className="text-[#1B2631]">{student.activeDaysIn14}</strong> 日稼働
        </span>
        <span>
          最終学習{' '}
          <strong className="text-[#1B2631]">{student.lastStudiedAt || 'まだなし'}</strong>
        </span>
        <span className={hasOverdue ? 'text-[#96342B]' : undefined}>
          期限切れ復習{' '}
          <strong className={hasOverdue ? 'text-[#96342B]' : 'text-[#1B2631]'}>
            {review.overdue}
          </strong>
        </span>
        <span>
          復習リスト <strong className="text-[#1B2631]">{review.total}</strong>
        </span>
        <span>
          定着済み <strong className="text-[#1B2631]">{review.mastered}</strong>
        </span>
        <span>
          誤答挑戦 <strong className="text-[#1B2631]">{review.wrongCount}</strong> 回
        </span>
        <span>
          解き直し <strong className="text-[#1B2631]">{review.retryCount}</strong> 回
        </span>
      </div>
    </div>
  );
};
