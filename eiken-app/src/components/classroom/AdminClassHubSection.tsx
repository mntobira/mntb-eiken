/**
 * ============================================================================
 * 管理者・先生向け「管理しているクラス一覧 ＋ クラス追加」ハブ（設定 ＞ クラス内）
 * ============================================================================
 *
 * ■ A1 ＋ クラスUIブラッシュアップ
 * - 1つの管理アカウントで「設定 ＞ クラス」を開いたとき、いきなり特定の専用画面へ
 *   固定ロックせず、自分が管理・担当している全クラス（すごろく塾・コース別・学校別）を
 *   俯瞰して切り替え・新規開設できるハブとして表示。
 * - 各クラスカードから 1タップで「管理画面を開く」「6文字コードコピー」「LINE案内文コピー」
 *   「A4招待シート印刷」を実行可能。3クラス以上のときはキーワード絞り込みも表示。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Clock,
  Copy,
  Loader2,
  MessageCircle,
  Plus,
  Printer,
  School,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { auth, FIREBASE_CONFIGURED } from '../../firebase';
import type { ClassroomDoc } from '../../utils/classroomCore';
import { subjectTheme } from '../../data/subjectTheme';
import { ClassFormModal, type ClassFormValues } from '../teacher/CreateClassModal';
import {
  buildClassInviteMessage,
  createDefaultClassSettings,
  createManagedClassroom,
  fetchClassSettings,
  getExamSessionShortLabel,
  loadCachedClassSettings,
  loadLastOrgName,
  type JukuClassSettings,
} from '../../sugoroku/admin/classroomSettings';
import { fetchManageableClassrooms } from '../../sugoroku/admin/firestoreAdminService';
import { openClassInviteSheetPrint } from '../../sugoroku/admin/printClassInviteSheet';
import { subscribeUserChatInbox } from '../../sugoroku/chat';

interface AdminClassHubSectionProps {
  /** 選んだクラスIDの管理画面（SugorokuAdminApp）を開く */
  onOpenClassAdmin: (classId: string) => void;
}

export function AdminClassHubSection({ onOpenClassAdmin }: AdminClassHubSectionProps) {
  const [rooms, setRooms] = useState<ClassroomDoc[]>([]);
  const [settingsMap, setSettingsMap] = useState<Record<string, JukuClassSettings>>({});
  const [unreadByClassId, setUnreadByClassId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const uid = auth.currentUser?.uid || '';

  const loadRooms = useCallback(async () => {
    if (!FIREBASE_CONFIGURED || !uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const list = await fetchManageableClassrooms();
      setRooms(list);
      const cached: Record<string, JukuClassSettings> = {};
      for (const r of list) {
        cached[r.id] = loadCachedClassSettings(r.id);
      }
      setSettingsMap(cached);
      if (list.length > 0) {
        const fetched = await Promise.all(
          list.map(async (r) => [r.id, await fetchClassSettings(r.id)] as const),
        );
        setSettingsMap(Object.fromEntries(fetched));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '管理クラスの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (!uid) return;
    return subscribeUserChatInbox({
      uid,
      onSummary: ({ teacherThreadsById }) => {
        const counts: Record<string, number> = {};
        for (const t of Object.values(teacherThreadsById)) {
          if (t.unreadByTeacher > 0) {
            counts[t.classId] = (counts[t.classId] || 0) + t.unreadByTeacher;
          }
        }
        setUnreadByClassId(counts);
      },
    });
  }, [uid]);

  const totalUnreadChats = useMemo(
    () => Object.values(unreadByClassId).reduce((sum, n) => sum + n, 0),
    [unreadByClassId],
  );

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        (r.className || '').toLowerCase().includes(q) ||
        (r.schoolName || '').toLowerCase().includes(q) ||
        (r.joinCode || '').toLowerCase().includes(q),
    );
  }, [rooms, searchQuery]);

  const copyWithFeedback = async (e: React.MouseEvent, text: string, token: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(token);
      window.setTimeout(() => {
        setCopiedToken((cur) => (cur === token ? null : cur));
      }, 1800);
    } catch {
      /* ignore */
    }
  };

  const handlePrintInvite = (
    e: React.MouseEvent,
    room: ClassroomDoc,
    settings: JukuClassSettings,
  ) => {
    e.stopPropagation();
    openClassInviteSheetPrint({ room, settings });
  };

  const handleCreateSubmit = async (values: ClassFormValues) => {
    setCreating(true);
    setError('');
    try {
      const { classroom: created } = await createManagedClassroom({
        schoolName: values.schoolName,
        className: values.className,
        subject: values.subject,
        enableJukuPlan: true,
        settings: {
          orgType: values.orgType,
          dailyGoalMinutes: values.dailyGoalMinutes,
          weeklyGoalDays: values.weeklyGoalDays,
          examSession: values.examSession,
          focusSkills: values.focusSkills,
          coachNote: values.coachNote,
        },
      });
      setCreateOpen(false);
      await loadRooms();
      onOpenClassAdmin(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'クラスの作成に失敗しました。');
    } finally {
      setCreating(false);
    }
  };

  const defaults = createDefaultClassSettings('');

  return (
    <section
      className="bg-gradient-to-b from-[#F5F9FF] to-white border border-[#BFD5EC] rounded-3xl p-4 shadow-xs space-y-3"
      aria-label="管理しているクラス一覧"
      data-testid="admin-class-hub-section"
    >
      {/* ヘッダー ＋ KPIバッジ ＋ 新規クラス開設ボタン */}
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold tracking-wider text-[#2458A6]">
              <Sparkles size={12} />
              先生・管理者ハブ
            </span>
            {rooms.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#2458A6]/10 text-[#2458A6] text-[10px] font-extrabold">
                管理中 {rooms.length}クラス
              </span>
            )}
            {totalUnreadChats > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#06C755] text-white text-[10px] font-extrabold">
                <MessageCircle size={10} />
                未読相談 {totalUnreadChats}件
              </span>
            )}
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-[#1B2631]">
            自分が管理しているクラス一覧
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex min-h-[40px] items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2458A6] hover:bg-[#1D4888] text-white text-xs font-extrabold shadow-xs transition-transform active:scale-95 cursor-pointer"
        >
          <Plus size={14} />
          クラスを追加する
        </button>
      </div>

      {/* 3クラス以上管理時のクイック検索バー */}
      {rooms.length >= 3 && (
        <label className="relative block">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="クラス名・塾名・6文字コードで絞り込み…"
            className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-xl border border-[#D4E1EE] bg-white text-xs font-semibold text-[#1B2631] placeholder:text-[#9BA3AE] focus:outline-none focus:border-[#2458A6]"
          />
        </label>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-5 text-xs text-gray-500">
          <Loader2 size={15} className="animate-spin" />
          <span>管理クラスを読み込んでいます…</span>
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#DCE8F5] p-4 text-xs text-[#3C5A6E] space-y-2">
          <p className="font-extrabold text-[#1B2631]">
            まだ管理しているクラスがありません。
          </p>
          <p className="leading-relaxed">
            右上の「＋ クラスを追加する」から、すごろく塾の全級一括コースや学校・学年別のクラスをいくつでも開設できます。作成すると生徒招待用の6文字コード・直行URL・A4招待シートが即時発行されます。
          </p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <p className="py-4 text-center text-xs text-[#6B7280]">
          「{searchQuery}」に一致するクラスはありません。
        </p>
      ) : (
        <ul className="space-y-2.5">
          {filteredRooms.map((room) => {
            const theme = subjectTheme(room.subject);
            const st = settingsMap[room.id] ?? loadCachedClassSettings(room.id);
            const unread = unreadByClassId[room.id] || 0;
            const isAllGrades = (room.className || '').includes('全級');

            return (
              <li key={room.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenClassAdmin(room.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      onOpenClassAdmin(room.id);
                    }
                  }}
                  className="w-full rounded-2xl border border-[#D4E1EE] bg-white hover:border-[#2458A6] hover:shadow-xs transition-all p-3.5 space-y-2.5 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2458A6]/10 text-[#2458A6] text-[11px] font-extrabold">
                          <School size={11} />
                          {room.schoolName || 'クラス'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${theme.chipTextClass} ${theme.chipBgClass}`}
                        >
                          {isAllGrades ? '5級〜1級 全級対応' : theme.label}
                        </span>
                        {room.plan === 'juku' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E8F6F4] text-[#1F635B] border border-[#BFE6E0] text-[10px] font-extrabold">
                            <ShieldCheck size={10} />
                            塾プラン・広告OFF
                          </span>
                        )}
                        {room.joinOpen === false && (
                          <span className="px-2 py-0.5 rounded-md bg-gray-200 text-gray-600 text-[10px] font-bold">
                            受付締切
                          </span>
                        )}
                        {unread > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#06C755] text-white text-[11px] font-extrabold shadow-2xs">
                            <MessageCircle size={11} />
                            新着チャット {unread}件
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-extrabold text-[#1B2631] leading-snug">
                        {room.className}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#5D6D7E] font-medium">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} className="text-[#2458A6]" />
                          1日{st.dailyGoalMinutes}分×週{st.weeklyGoalDays}日
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Target size={11} className="text-[#2458A6]" />
                          {getExamSessionShortLabel(st.examSession)}
                        </span>
                      </div>
                    </div>

                    <span className="shrink-0 inline-flex min-h-[38px] items-center gap-0.5 px-3 py-2 rounded-xl bg-[#2458A6] text-white text-xs font-extrabold shadow-2xs">
                      開く
                      <ChevronRight size={14} />
                    </span>
                  </div>

                  {/* 下段クイックツールバー：6文字コード・LINE案内文・A4招待シート */}
                  <div className="pt-2 border-t border-[#EEF2F6] flex flex-wrap items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={(e) =>
                        void copyWithFeedback(e, room.joinCode, `code:${room.id}`)
                      }
                      className="inline-flex min-h-[32px] items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#D8E1EB] bg-[#F8FAFC] hover:bg-[#EFF4F9] text-[11px] font-bold text-[#1B2631]"
                      title="生徒用の6文字参加コードをコピー"
                    >
                      {copiedToken === `code:${room.id}` ? (
                        <Check size={12} className="text-[#059669]" />
                      ) : (
                        <Copy size={12} className="text-[#64748B]" />
                      )}
                      <span>コード</span>
                      <strong className="font-mono tracking-[0.16em] text-[#2458A6]">
                        {room.joinCode}
                      </strong>
                    </button>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) =>
                          void copyWithFeedback(
                            e,
                            buildClassInviteMessage({ room, settings: st }),
                            `line:${room.id}`,
                          )
                        }
                        className="inline-flex min-h-[32px] items-center gap-1 px-2.5 py-1 rounded-lg border border-[#DCE7F3] bg-white hover:bg-[#F5F9FF] text-[11px] font-bold text-[#2458A6]"
                        title="LINE・保護者連絡用の招待文をコピー"
                      >
                        {copiedToken === `line:${room.id}` ? (
                          <>
                            <Check size={12} className="text-[#059669]" />
                            LINE文コピー済
                          </>
                        ) : (
                          <>
                            <MessageCircle size={12} />
                            LINE案内文
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handlePrintInvite(e, room, st)}
                        className="inline-flex min-h-[32px] items-center gap-1 px-2.5 py-1 rounded-lg border border-[#DCE7F3] bg-white hover:bg-[#F5F9FF] text-[11px] font-bold text-[#374151]"
                        title="教室配布・画面提示用のA4招待シートを開く"
                      >
                        <Printer size={12} className="text-[#2458A6]" />
                        招待シート
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {createOpen && (
        <ClassFormModal
          mode="create"
          submitting={creating}
          accent="#2458A6"
          isJukuPlanActive={true}
          initialValues={{
            schoolName: loadLastOrgName() || '',
            className: '',
            subject: 'eiken_2',
            joinOpen: true,
            orgType: defaults.orgType,
            dailyGoalMinutes: defaults.dailyGoalMinutes,
            weeklyGoalDays: defaults.weeklyGoalDays,
            examSession: defaults.examSession,
            focusSkills: defaults.focusSkills,
            coachNote: defaults.coachNote,
          }}
          onClose={() => setCreateOpen(false)}
          onSubmit={(vals) => void handleCreateSubmit(vals)}
        />
      )}
    </section>
  );
}
