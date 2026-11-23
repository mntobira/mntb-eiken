import { useState } from 'react';
import {
  Copy,
  Check,
  Lock,
  Unlock,
  Settings2,
  Link2,
  MessageCircle,
  Trash2,
  ShieldCheck,
  Clock,
  Target,
  Sparkles,
} from 'lucide-react';
import { type ClassroomDoc } from '../../utils/classroomCore';
import { subjectTheme } from '../../data/subjectTheme';
import type { ThemeShape } from './teacherTheme';
import {
  buildClassInviteMessage,
  buildClassInviteUrl,
  createDefaultClassSettings,
  FOCUS_SKILL_OPTIONS,
  getExamSessionShortLabel,
  ORG_TYPE_OPTIONS,
  type JukuClassSettings,
} from '../../sugoroku/admin/classroomSettings';

// ============================================================================
// コース・クラス設定タブ（全設定編集・招待URL/LINE案内コピー・塾プラン有効化・削除）
// ============================================================================

interface ClassesTabProps {
  classrooms: ClassroomDoc[];
  activeClassId?: string;
  settingsMap: Record<string, JukuClassSettings>;
  theme: ThemeShape;
  copiedCode: string;
  onSelectClass?: (classId: string) => void;
  onCopyCode: (code: string) => void;
  onToggleJoin: (room: ClassroomDoc) => void;
  onEditRoom: (room: ClassroomDoc) => void;
  onDeleteRoom?: (room: ClassroomDoc) => void;
  onUpgradeToJuku?: (room: ClassroomDoc) => void;
}

export function ClassesTab({
  classrooms,
  activeClassId,
  settingsMap,
  theme,
  copiedCode,
  onSelectClass,
  onCopyCode,
  onToggleJoin,
  onEditRoom,
  onDeleteRoom,
  onUpgradeToJuku,
}: ClassesTabProps) {
  const [copiedToken, setCopiedToken] = useState<string>('');

  const copyWithFeedback = async (text: string, token: string, fallbackCode?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken((curr) => (curr === token ? '' : curr)), 2000);
    } catch {
      if (fallbackCode) onCopyCode(fallbackCode);
    }
  };

  return (
    <div className="space-y-4">
      {classrooms.map((room) => {
        const roomTheme = subjectTheme(room.subject);
        const settings = settingsMap[room.id] ?? createDefaultClassSettings(room.id);
        const orgLabel =
          ORG_TYPE_OPTIONS.find((o) => o.value === settings.orgType)?.label ?? '学習塾・オンライン塾';
        const weeklyTotalMin = settings.dailyGoalMinutes * settings.weeklyGoalDays;
        const isCurrent = activeClassId === room.id;
        const skillLabels = settings.focusSkills
          .map((k) => FOCUS_SKILL_OPTIONS.find((o) => o.key === k)?.label)
          .filter(Boolean);

        return (
          <div
            key={room.id}
            className={`bg-white rounded-3xl border p-5 transition-all ${
              isCurrent
                ? 'border-[#3E9C93] ring-1 ring-[#3E9C93]/25 shadow-xs'
                : 'border-[#E0E1DD]'
            }`}
          >
            {/* 上段：コース基本情報 ＋ 招待コード */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="text-xs font-bold text-[#6B7280]">{room.schoolName}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F5F3EE] text-[#4B5563]">
                    {orgLabel}
                  </span>
                  {room.plan === 'juku' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E8F6F4] text-[#236B63] border border-[#B5E2DC]">
                      <ShieldCheck className="w-3 h-3" />
                      塾プラン（広告OFF・宿題対応）
                    </span>
                  ) : (
                    onUpgradeToJuku && (
                      <button
                        type="button"
                        onClick={() => onUpgradeToJuku(room)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFF7ED] text-[#9A3412] border border-[#FED7AA] hover:bg-[#FFEDD5]"
                      >
                        <Sparkles className="w-3 h-3" />
                        塾プランを有効化する
                      </button>
                    )
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectClass?.(room.id)}
                    className="text-lg font-extrabold text-[#1B2631] hover:text-[#2F7C74] text-left"
                  >
                    {room.className}
                  </button>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold ${roomTheme.chipTextClass} ${roomTheme.chipBgClass}`}
                  >
                    {roomTheme.label}
                  </span>
                </div>

                {/* 学習目標サマリー */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-xs text-[#4B5563]">
                  <span className="inline-flex items-center gap-1 font-bold text-[#1B2631]">
                    <Clock className="w-3.5 h-3.5 text-[#3E9C93]" />
                    1日{settings.dailyGoalMinutes}分 × 週{settings.weeklyGoalDays}日（週{weeklyTotalMin}分）
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-[#3E9C93]" />
                    目標：{getExamSessionShortLabel(settings.examSession)}
                  </span>
                </div>

                {skillLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {skillLabels.map((lbl) => (
                      <span
                        key={lbl}
                        className="px-2 py-0.5 rounded-md bg-[#FAF8F2] border border-[#ECE9E1] text-[11px] text-[#4B5563]"
                      >
                        {lbl}
                      </span>
                    ))}
                  </div>
                )}

                {settings.coachNote && (
                  <p className="mt-2.5 text-xs text-[#4B5563] bg-[#FDFBF7] border border-[#ECE9E1] rounded-xl px-3 py-2 leading-relaxed">
                    💬 {settings.coachNote}
                  </p>
                )}
              </div>

              {/* 右側：6文字コードボックス */}
              <div className="shrink-0 bg-[#FDFBF7] border border-[#E6E3DA] rounded-2xl px-4 py-2.5 text-right">
                <p className="text-[11px] font-bold text-[#6B7280] mb-0.5">参加コード</p>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-xl font-extrabold tracking-[0.2em] text-[#1B2631] font-mono">
                    {room.joinCode}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void copyWithFeedback(room.joinCode, `code:${room.id}`, room.joinCode)
                    }
                    className="p-1.5 rounded-lg border border-[#E0E1DD] bg-white text-[#4B5563] hover:bg-[#FAF8F2] transition-colors"
                    aria-label="参加コードをコピー"
                  >
                    {copiedCode === room.joinCode || copiedToken === `code:${room.id}` ? (
                      <Check className="w-3.5 h-3.5 text-[#3E9C93]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 下段アクションバー：招待共有 ＆ 設定編集 ＆ 受付開閉 ＆ 削除 */}
            <div className="pt-3.5 border-t border-[#F0EDE6] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void copyWithFeedback(
                      buildClassInviteMessage({ room, settings }),
                      `line:${room.id}`,
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-white transition-transform active:scale-95"
                  style={{ backgroundColor: theme.accent }}
                >
                  {copiedToken === `line:${room.id}` ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      LINE案内文をコピー済
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-3.5 h-3.5" />
                      LINE・保護者案内文コピー
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void copyWithFeedback(buildClassInviteUrl(room.joinCode), `url:${room.id}`)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[#BFE6E0] bg-[#F2FAF8] text-[#1F635B] hover:bg-[#E4F5F1] transition-colors"
                >
                  {copiedToken === `url:${room.id}` ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      招待URLコピー済
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5" />
                      招待URLコピー
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEditRoom(room)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[#D8D5CC] bg-white text-[#1B2631] hover:bg-[#FAF8F2] transition-colors"
                >
                  <Settings2 className="w-3.5 h-3.5 text-[#3E9C93]" />
                  設定を編集
                </button>

                <button
                  type="button"
                  onClick={() => onToggleJoin(room)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    room.joinOpen
                      ? 'border-[#A9E0D8] bg-[#F5FCFA] text-[#2F7C74]'
                      : 'border-[#E0E1DD] bg-[#FAF8F2] text-[#6B7280]'
                  }`}
                >
                  {room.joinOpen ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      参加受付中（締切る）
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      受付締切中（再開する）
                    </>
                  )}
                </button>

                {onDeleteRoom && (
                  <button
                    type="button"
                    onClick={() => onDeleteRoom(room)}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold border border-[#F5C6C0] bg-white text-[#96342B] hover:bg-[#FDECEA] transition-colors"
                    title="このクラスを削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <p className="text-xs text-[#6B7280] leading-relaxed px-1">
        招待コードは <strong>O と 0</strong>、<strong>I と 1</strong> のような見間違えやすい文字を除外した6文字で発行されます。
        コース名・対象級・1日の目標分数・週の目標日数は、招待コードを変えずにいつでも「設定を編集」から変更できます。
      </p>
    </div>
  );
}
