/**
 * ============================================================================
 * 管理者・先生向け「管理しているクラス一覧 ＋ クラス追加」セクション（設定 ＞ クラス内）
 * ============================================================================
 *
 * ■ A1 ご要望への対応 ＋ 品質強化版
 * - 1つの管理アカウントで「設定 ＞ クラス」を開いたとき、いきなりすごろく専用画面へ
 *   強制ロックするのではなく、
 *   1) 自分が管理・担当しているクラスの一覧（その1つとしてすごろくのクラスも表示）
 *   2) 「＋ 新しいクラスを追加する」ボタン
 *   をこの画面に表示し、選んだクラスの管理画面（生徒・チャット・教材PDF・添削）へ入る。
 * - 各クラスカードに「在籍人数」「新着トーク件数」を表示し、
 *   『👥 生徒・課題』『💬 トーク』『📄 教材PDF』『✍ 添削』へ1タップ直行できる。
 */

import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  Copy,
  FilePenLine,
  Loader2,
  MessageCircle,
  Plus,
  School,
  Sparkles,
  Users,
} from 'lucide-react';
import { auth, FIREBASE_CONFIGURED } from '../../firebase';
import { fetchClassMembers } from '../../utils/classroom';
import type { ClassroomDoc } from '../../utils/classroomCore';
import { subjectTheme } from '../../data/subjectTheme';
import { ClassFormModal, type ClassFormValues } from '../teacher/CreateClassModal';
import type { SugorokuAdminTabId } from '../../sugoroku/admin/SugorokuAdminApp';
import {
  createDefaultClassSettings,
  createManagedClassroom,
  fetchClassSettings,
  getExamSessionShortLabel,
  loadCachedClassSettings,
  loadLastOrgName,
  type JukuClassSettings,
} from '../../sugoroku/admin/classroomSettings';
import { fetchManageableClassrooms } from '../../sugoroku/admin/firestoreAdminService';
import { subscribeUserChatInbox } from '../../sugoroku/chat';

interface AdminClassHubSectionProps {
  /** 選んだクラスID（および開く初期タブ）の管理画面（SugorokuAdminApp）を開く */
  onOpenClassAdmin: (classId: string, initialTab?: SugorokuAdminTabId) => void;
}

export function AdminClassHubSection({ onOpenClassAdmin }: AdminClassHubSectionProps) {
  const [rooms, setRooms] = useState<ClassroomDoc[]>([]);
  const [settingsMap, setSettingsMap] = useState<Record<string, JukuClassSettings>>({});
  const [memberCountMap, setMemberCountMap] = useState<Record<string, number>>({});
  const [unreadByClassId, setUnreadByClassId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
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
        const [fetchedSettings, fetchedCounts] = await Promise.all([
          Promise.all(
            list.map(async (r) => [r.id, await fetchClassSettings(r.id)] as const),
          ),
          Promise.all(
            list.map(async (r) => {
              try {
                const members = await fetchClassMembers(r.id);
                return [r.id, members.length] as const;
              } catch {
                return [r.id, -1] as const;
              }
            }),
          ),
        ]);
        setSettingsMap(Object.fromEntries(fetchedSettings));
        const countsObj: Record<string, number> = {};
        for (const [cid, count] of fetchedCounts) {
          if (count >= 0) countsObj[cid] = count;
        }
        setMemberCountMap(countsObj);
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

  const handleCopyCode = async (e: React.MouseEvent, joinCode: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopiedCode(joinCode);
      window.setTimeout(() => {
        setCopiedCode((cur) => (cur === joinCode ? null : cur));
      }, 1800);
    } catch {
      /* ignore */
    }
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
      onOpenClassAdmin(created.id, 'students');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'クラスの作成に失敗しました。');
    } finally {
      setCreating(false);
    }
  };

  const defaults = createDefaultClassSettings('');

  return (
    <section
      className="bg-white border border-[#BFD5EC] rounded-2xl p-3.5 shadow-sm space-y-3"
      aria-label="管理しているクラス一覧"
      data-testid="admin-class-hub-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold tracking-wider text-[#2458A6]">
            <Sparkles size={12} />
            先生・管理者メニュー
          </span>
          <h3 className="text-sm font-extrabold text-[#1B2631]">
            自分が管理しているクラス一覧
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex min-h-[40px] items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2458A6] hover:bg-[#1D4888] text-white text-xs font-extrabold shadow-sm cursor-pointer"
        >
          <Plus size={14} />
          クラスを追加する
        </button>
      </div>

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
        <div className="rounded-xl bg-[#F5F9FD] border border-[#DCE8F5] p-3.5 text-xs text-[#3C5A6E] space-y-2">
          <p className="font-bold text-[#1B2631]">
            まだ管理しているクラスがありません。
          </p>
          <p className="leading-relaxed">
            右上の「＋ クラスを追加する」から、すごろく塾のクラスや学校・コース別のクラスをいくつでも作成できます。作成すると生徒招待用の6文字コードが発行されます。
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rooms.map((room) => {
            const theme = subjectTheme(room.subject);
            const st = settingsMap[room.id] ?? loadCachedClassSettings(room.id);
            const unread = unreadByClassId[room.id] || 0;
            const memberCount = memberCountMap[room.id];
            return (
              <li
                key={room.id}
                className="rounded-xl border border-[#D6E2EE] bg-[#F8FBFF] hover:border-[#ACC6E2] transition-colors p-3 space-y-2.5"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenClassAdmin(room.id, 'students')}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      onOpenClassAdmin(room.id, 'students');
                    }
                  }}
                  className="w-full flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2458A6]/10 text-[#2458A6] text-[11px] font-extrabold">
                        <School size={11} />
                        {room.schoolName || 'クラス'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${theme.chipTextClass} ${theme.chipBgClass}`}
                      >
                        {theme.label}
                      </span>
                      {typeof memberCount === 'number' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                          <Users size={11} />
                          生徒 {memberCount}名
                        </span>
                      )}
                      {room.joinOpen === false && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[11px] font-bold">
                          受付締切
                        </span>
                      )}
                      {unread > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#06C755] text-white text-[11px] font-extrabold">
                          <MessageCircle size={11} />
                          新着チャット {unread}件
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-extrabold text-[#1B2631] truncate">
                      {room.className}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-gray-500">
                      <span>
                        参加コード:{' '}
                        <strong className="text-[#1B2631] tracking-wider">{room.joinCode}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        目標 1日{st.dailyGoalMinutes}分×週{st.weeklyGoalDays}日
                      </span>
                      <span>·</span>
                      <span>{getExamSessionShortLabel(st.examSession)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => void handleCopyCode(e, room.joinCode)}
                      className="min-h-[36px] px-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-[11px] font-bold text-gray-700 inline-flex items-center gap-1"
                      title="生徒用の6文字参加コードをコピー"
                    >
                      <Copy size={12} />
                      {copiedCode === room.joinCode ? 'コピー済' : 'コード'}
                    </button>
                    <span className="inline-flex items-center gap-0.5 px-2.5 py-2 rounded-lg bg-[#2458A6] text-white text-xs font-extrabold">
                      開く
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </div>

                {/* 目的タブへのワンタップ直行バー */}
                <div
                  className="pt-2 border-t border-[#E3EDF7] flex flex-wrap items-center gap-1.5"
                  aria-label={`${room.className}のショートカット`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenClassAdmin(room.id, 'students')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#CEDCEB] hover:bg-[#EFF5FC] text-[11px] font-extrabold text-[#1E3A8A] cursor-pointer"
                  >
                    <Users size={12} />
                    生徒・課題管理
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenClassAdmin(room.id, 'chat')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold cursor-pointer ${
                      unread > 0
                        ? 'bg-[#06C755] text-white border-[#06C755] hover:bg-[#05b34c]'
                        : 'bg-white text-[#047857] border-[#BBE5CD] hover:bg-[#F0FDF4]'
                    }`}
                  >
                    <MessageCircle size={12} />
                    1対1トーク{unread > 0 ? ` (${unread})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenClassAdmin(room.id, 'pdf_shelf')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#CEDCEB] hover:bg-[#EFF5FC] text-[11px] font-bold text-slate-700 cursor-pointer"
                  >
                    <BookOpen size={12} />
                    教材PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenClassAdmin(room.id, 'writing_review')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#CEDCEB] hover:bg-[#EFF5FC] text-[11px] font-bold text-slate-700 cursor-pointer"
                  >
                    <FilePenLine size={12} />
                    添削
                  </button>
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
