import { useCallback, useEffect, useRef, useState } from 'react';
import {
  School,
  LogIn,
  Loader2,
  AlertTriangle,
  Check,
  Eye,
  Trash2,
  Info,
  ShieldCheck,
  MessageCircle,
  KeyRound,
  RotateCcw,
  Clock,
  Target,
  VolumeX,
  ChevronDown,
  ClipboardList,
  Plus,
} from 'lucide-react';
import { auth } from '../firebase';
import { GoogleMark } from './GoogleLinkBanner';
import {
  joinClassroomByCode,
  fetchMyMembershipDetails,
  leaveClassroom,
  type MembershipDetail,
} from '../utils/classroom';
import { normalizeJoinCode, JOIN_CODE_LENGTH } from '../utils/classroomCore';
import { subjectTheme } from '../data/subjectTheme';
import { confirmAction } from '../utils/dialog';
import { saveJukuMemberships } from '../utils/classAssignments';
import { expandJukuMembershipsForAllEikenGrades } from '../sugoroku/shared/studentClassSession';
import {
  fetchClassSettings,
  getExamSessionShortLabel,
  loadCachedClassSettings,
  type JukuClassSettings,
} from '../sugoroku/admin/classroomSettings';
import { extractInviteCodeFromSearch } from '../sugoroku/auth/sugorokuAuthCore';
import { StudentAssignments } from './classroom/StudentAssignments';
import { AdminClassHubSection } from './classroom/AdminClassHubSection';
import type { SugorokuAdminTabId } from '../sugoroku/admin/SugorokuAdminApp';
import { ClassChatModal, subscribeUserChatInbox } from '../sugoroku/chat';
import { chapterSubjectOf, isValidEikenChapterId } from '../sugoroku/homework/chapterTotals';

/**
 * URL全体（?sugoroku_invite=AB23CD 等）や案内文ごと貼り付けられた場合も
 * 6文字の参加コードだけを賢く抽出・正規化する。
 */
function smartNormalizeClassCode(raw: string): string {
  const trimmed = (raw || '').trim();
  if (trimmed.includes('?') || trimmed.includes('=')) {
    try {
      const qIndex = trimmed.indexOf('?');
      const queryPart = qIndex >= 0 ? trimmed.slice(qIndex) : `?${trimmed}`;
      const fromUrl = extractInviteCodeFromSearch(queryPart);
      if (fromUrl) return fromUrl;
    } catch {
      /* ignore */
    }
  }
  return normalizeJoinCode(trimmed).slice(0, JOIN_CODE_LENGTH);
}

interface ClassPanelProps {
  /** 先生の画面に出す既定の名前（プロフィールのニックネーム） */
  defaultDisplayName?: string;
  /** 課題の「解く」から演習を始める */
  onStartChapter?: (chapterId: string, subject: MembershipDetail['subject']) => void;
  /** 管理者・講師アカウントのとき、上部に「管理しているクラス一覧＋クラス追加」を表示する */
  showAdminHub?: boolean;
  /** 管理クラスの一覧から特定のクラス管理画面（および開く初期タブ）を開く */
  onOpenClassAdmin?: (classId: string, initialTab?: SugorokuAdminTabId) => void;
  /** 未ログイン時にその場で Google アカウント連携を実行する */
  onLinkGoogle?: () => void;
  /** Google 連携処理中フラグ */
  linkingGoogle?: boolean;
  /** Google 連携エラー文言 */
  authError?: string | null;
}

export function ClassPanel({
  defaultDisplayName = '',
  onStartChapter,
  showAdminHub = false,
  onOpenClassAdmin,
  onLinkGoogle,
  linkingGoogle = false,
  authError = null,
}: ClassPanelProps) {
  const [memberships, setMemberships] = useState<MembershipDetail[]>([]);
  const [settingsByClass, setSettingsByClass] = useState<Record<string, JukuClassSettings>>({});
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [codeFocused, setCodeFocused] = useState(false);
  const [showAdditionalJoinForm, setShowAdditionalJoinForm] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [leavingClassId, setLeavingClassId] = useState('');
  const [chatMembership, setChatMembership] = useState<MembershipDetail | null>(null);
  const [unreadByClassId, setUnreadByClassId] = useState<Record<string, number>>({});
  const codeInputRef = useRef<HTMLInputElement>(null);

  const uid = auth.currentUser?.uid || '';

  const load = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchMyMembershipDetails();
      setMemberships(rows);
      saveJukuMemberships(uid, expandJukuMembershipsForAllEikenGrades(rows));

      const initialSettings: Record<string, JukuClassSettings> = {};
      for (const r of rows) {
        initialSettings[r.classId] = loadCachedClassSettings(r.classId);
      }
      setSettingsByClass(initialSettings);

      if (rows.length > 0) {
        const fetched = await Promise.all(
          rows.map(async (r) => [r.classId, await fetchClassSettings(r.classId)] as const),
        );
        setSettingsByClass(Object.fromEntries(fetched));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '参加クラスの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!uid) return;
    return subscribeUserChatInbox({
      uid,
      onSummary: ({ studentThreadsByClassId }) => {
        const next: Record<string, number> = {};
        for (const [cid, t] of Object.entries(studentThreadsByClassId)) {
          if (t.unreadByStudent > 0) next[cid] = t.unreadByStudent;
        }
        setUnreadByClassId(next);
      },
    });
  }, [uid]);

  const handleJoin = async () => {
    setJoining(true);
    setError('');
    setNotice('');
    try {
      const result = await joinClassroomByCode(code, defaultDisplayName);
      setNotice(
        result.alreadyJoined
          ? `「${result.classroom.className}」にはすでに参加しています。`
          : `「${result.classroom.className}」に参加しました！先生からの宿題やチャットがこの画面に届きます。`,
      );
      setCode('');
      setShowAdditionalJoinForm(false);
      await load();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'クラスへの参加に失敗しました。');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async (membership: MembershipDetail) => {
    const confirmed = confirmAction(
      `「${membership.className}」から抜けます。\n先生からあなたの学習状況は見えなくなります。よろしいですか？`,
    );
    if (!confirmed) return;

    setLeavingClassId(membership.classId);
    setError('');
    setNotice('');
    try {
      await leaveClassroom(membership.classId, membership.teacherUid);
      setNotice(`「${membership.className}」から抜けました。`);
      await load();
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : 'クラスからの退出に失敗しました。');
    } finally {
      setLeavingClassId('');
    }
  };

  // ===================================================================
  // 1. 未ログイン時：タブを切り替えさせず、その場1画面でGoogleログイン＆理解完結
  // ===================================================================
  if (!uid) {
    return (
      <div className="bg-white border border-[#E4E1D8] rounded-3xl p-4 sm:p-5 text-center shadow-2xs space-y-3">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-[#E8F6F4] text-[#1F635B] mx-auto">
          <School className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-[#1B2631] mb-1">
            クラス参加には Google ログインが必要です
          </h3>
          <p className="text-xs text-[#5D6D7E] leading-relaxed">
            ログインすると、先生から届いた<strong>6文字コードでクラスに参加できます</strong>（今の学習記録もそのまま引き継がれます）。
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-left">
          <div className="rounded-xl bg-[#FAF8F2] border border-[#ECE9E1] px-2.5 py-2 text-[11px] text-[#374151]">
            <strong className="flex items-center gap-1 font-extrabold text-[#1B2631]">
              <ClipboardList size={12} className="text-[#3E9C93] shrink-0" />
              課題が届く
            </strong>
            <span className="text-[10px] text-[#6B7280]">単元へ1タップ直行</span>
          </div>
          <div className="rounded-xl bg-[#FAF8F2] border border-[#ECE9E1] px-2.5 py-2 text-[11px] text-[#374151]">
            <strong className="flex items-center gap-1 font-extrabold text-[#1B2631]">
              <MessageCircle size={12} className="text-[#06C755] shrink-0" />
              先生にチャット相談
            </strong>
            <span className="text-[10px] text-[#6B7280]">1対1で質問・報告</span>
          </div>
          <div className="rounded-xl bg-[#FAF8F2] border border-[#ECE9E1] px-2.5 py-2 text-[11px] text-[#374151]">
            <strong className="flex items-center gap-1 font-extrabold text-[#1B2631]">
              <VolumeX size={12} className="text-[#2458A6] shrink-0" />
              塾は広告OFF
            </strong>
            <span className="text-[10px] text-[#6B7280]">集中できる専用設計</span>
          </div>
        </div>

        {onLinkGoogle && (
          <button
            type="button"
            onClick={onLinkGoogle}
            disabled={linkingGoogle}
            className="w-full min-h-[46px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#1B2631] hover:bg-[#273746] text-white text-xs sm:text-sm font-extrabold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {linkingGoogle ? <Loader2 size={16} className="animate-spin" /> : <GoogleMark size={17} />}
            {linkingGoogle ? 'Google アカウントを確認中…' : 'Google でログインしてクラスへ進む'}
          </button>
        )}

        {authError && (
          <p role="alert" className="rounded-xl bg-[#FDEDEC] border border-[#E74C3C]/40 px-3 py-2 text-xs text-[#C0392B]">
            {authError}
          </p>
        )}
      </div>
    );
  }

  const normalized = normalizeJoinCode(code);
  const canJoin = normalized.length === JOIN_CODE_LENGTH && !joining;
  // 生徒が未参加かつ管理者ハブがない場合は、1画面完結で6文字コード入力カードを主役表示する。
  // 既にクラス参加中または管理者ハブ表示中は、画面を縦長にしないよう折りたたみトグルにする。
  const isJoinExpanded =
    (!showAdminHub && memberships.length === 0) || showAdditionalJoinForm || code.length > 0;

  return (
    <div className="space-y-3">
      {/* A1：管理者・先生アカウント向け「管理しているクラス一覧 ＋ クラスを追加する」（1画面俯瞰） */}
      {showAdminHub && onOpenClassAdmin && (
        <AdminClassHubSection onOpenClassAdmin={onOpenClassAdmin} />
      )}

      {/* 完了通知・エラー通知 */}
      {notice && (
        <div className="flex items-start gap-2 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] px-3.5 py-2 text-xs font-semibold leading-relaxed text-[#065F46]">
          <Check size={14} className="shrink-0 mt-0.5 text-[#059669]" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-[#FDEDEC] border border-[#E74C3C]/40 px-3.5 py-2 text-xs font-semibold leading-relaxed text-[#C0392B]"
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. 在籍中クラスがある場合：そのクラスの「先生とチャット」「今日の課題」を1画面の主役に表示 */}
      {loading ? (
        <div className="bg-white border border-[#E2DFD6] rounded-3xl p-5 text-center text-xs text-[#6B7280]">
          クラス情報を読み込んでいます…
        </div>
      ) : memberships.length > 0 ? (
        <section className="bg-white border border-[#E2DFD6] rounded-3xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold text-[#1B2631] flex items-center gap-1.5">
              <School size={14} className="text-[#3E9C93]" />
              参加中のクラス
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-[#E8F6F4] text-[#1F635B] text-[11px] font-extrabold">
              {memberships.length}コース在籍中
            </span>
          </div>

          <ul className="space-y-2.5">
            {memberships.map((membership) => {
              const theme = subjectTheme(membership.subject);
              const st =
                settingsByClass[membership.classId] ?? loadCachedClassSettings(membership.classId);
              const isAllGrades = (membership.className || '').includes('全級');
              const unread = unreadByClassId[membership.classId] || 0;

              return (
                <li
                  key={membership.classId}
                  className="rounded-2xl border border-[#DFDCD2] bg-gradient-to-b from-[#FDFCF9] to-white p-3 shadow-2xs space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#6B7280] truncate">
                          {membership.schoolName}
                        </span>
                        {membership.plan === 'juku' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E8F6F4] text-[#1F635B] border border-[#BFE6E0] text-[10px] font-extrabold">
                            <VolumeX size={10} />
                            塾生専用・広告OFF
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-extrabold text-[#1B2631] leading-snug">
                        {membership.className}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${theme.chipTextClass} ${theme.chipBgClass}`}
                        >
                          {isAllGrades ? '英検5級〜1級 全級対応' : theme.label}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4F6F8] text-[#374151] text-[11px] font-semibold">
                          <Clock size={11} className="text-[#3E9C93]" />
                          1日{st.dailyGoalMinutes}分×週{st.weeklyGoalDays}日
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4F6F8] text-[#374151] text-[11px] font-semibold">
                          <Target size={11} className="text-[#3E9C93]" />
                          {getExamSessionShortLabel(st.examSession)}
                        </span>
                        <span className="text-[11px] text-[#6B7280]">
                          表示名：<strong className="text-[#374151]">{membership.rosterName}</strong>
                        </span>
                      </div>

                      {st.coachNote && (
                        <p className="text-xs text-[#374151] bg-[#FAF8F2] border border-[#ECE9E1] rounded-xl px-2.5 py-1.5 leading-snug">
                          先生より：{st.coachNote}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setChatMembership(membership)}
                        className="flex min-h-[38px] items-center gap-1.5 px-3 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-extrabold shadow-xs transition-transform active:scale-95 cursor-pointer"
                      >
                        <MessageCircle size={13} />
                        先生とチャット
                        {unread > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-white text-[#06C755] text-[10px] font-extrabold leading-none">
                            {unread}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleLeave(membership)}
                        disabled={leavingClassId === membership.classId}
                        className="shrink-0 flex min-h-[38px] items-center gap-1 px-2.5 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100/70 text-xs font-bold text-red-600 disabled:opacity-50 transition-colors"
                      >
                        {leavingClassId === membership.classId ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        抜ける
                      </button>
                    </div>
                  </div>
                  {/* クラスに参加していれば「今日の課題・今週の宿題」を常に見やすく表示 */}
                  <StudentAssignments
                    membership={membership}
                    onStartChapter={onStartChapter}
                    onOpenChat={() => setChatMembership(membership)}
                  />
                </li>
              );
            })}
          </ul>

          {/* 共有範囲・プライバシー説明（コンパクト開閉） */}
          <details className="group rounded-xl bg-[#F4F7FA] border border-[#D9E4EC] px-3 py-2 text-xs text-[#3C5A6E]">
            <summary className="flex items-center justify-between gap-2 cursor-pointer font-bold list-none">
              <span className="inline-flex items-center gap-1.5">
                <Eye size={13} />
                先生に見えていること・プライバシー保護を確認
              </span>
              <ChevronDown
                size={14}
                className="transition-transform group-open:rotate-180 text-[#5A7A8E]"
              />
            </summary>
            <div className="pt-2 mt-1.5 border-t border-[#D9E4EC] space-y-1.5 leading-relaxed">
              <p>・学習日・勉強時間・単元の進捗と正答率・提出した英作文／録音・1対1チャットのみ担当の先生に共有されます。</p>
              <p className="flex items-center gap-1 font-semibold">
                <Info size={12} className="shrink-0" />
                公開ランキング等に本名が出ることは一切なく、「抜ける」でいつでも共有を停止できます。
              </p>
            </div>
          </details>
        </section>
      ) : null}

      {/* 3. 6文字コード参加セクション：未参加生徒には1画面完結カード、参加済/管理者にはすっきり開閉 */}
      {!isJoinExpanded ? (
        <button
          type="button"
          onClick={() => {
            setShowAdditionalJoinForm(true);
            window.setTimeout(() => codeInputRef.current?.focus(), 60);
          }}
          className="w-full min-h-[42px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl border border-dashed border-[#C7D2DE] bg-white/80 hover:bg-white text-xs font-extrabold text-[#3C5A6E] transition-colors cursor-pointer"
        >
          <Plus size={14} className="text-[#3E9C93]" />
          {showAdminHub && memberships.length === 0
            ? '生徒として別のクラスに参加する（6文字コード入力）'
            : '別のクラスコードを入力して追加参加する'}
        </button>
      ) : (
        <section className="bg-white border border-[#E2DFD6] rounded-3xl p-4 shadow-2xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#1B2631] flex items-center gap-1.5">
                  <KeyRound size={14} className="text-[#3E9C93]" />
                  6文字コードでクラスに参加
                </h3>
                {memberships.length === 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FAF8F2] border border-[#E6E2D6] text-[10px] font-bold text-[#6B7280]">
                    現在未参加（記録は非公開）
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                先生から案内された6文字コードを入力（招待URLそのまま貼り付けも可）
              </p>
            </div>

            <div className="flex items-center gap-1">
              {code.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCode('');
                    setError('');
                    codeInputRef.current?.focus();
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-[#6B7280] hover:bg-[#F5F3EE]"
                >
                  <RotateCcw size={11} />
                  クリア
                </button>
              )}
              {(showAdminHub || memberships.length > 0) && code.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowAdditionalJoinForm(false)}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-[#6B7280] hover:bg-[#F5F3EE]"
                >
                  閉じる
                </button>
              )}
            </div>
          </div>

          {/* 6マス視覚スロット ＋ 透明ネイティブ入力 */}
          <div className="relative cursor-text" onClick={() => codeInputRef.current?.focus()}>
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2" aria-hidden="true">
              {Array.from({ length: JOIN_CODE_LENGTH }).map((_, idx) => {
                const ch = normalized[idx] || '';
                const isActiveSlot =
                  codeFocused &&
                  (idx === normalized.length ||
                    (normalized.length === JOIN_CODE_LENGTH && idx === JOIN_CODE_LENGTH - 1));
                return (
                  <div
                    key={idx}
                    className={`h-11 sm:h-12 rounded-2xl border-2 flex items-center justify-center font-mono text-lg sm:text-xl font-extrabold transition-all ${
                      ch
                        ? 'bg-[#F2FAF8] border-[#3E9C93] text-[#1B2631] shadow-2xs'
                        : isActiveSlot
                          ? 'bg-white border-[#2458A6] ring-2 ring-[#2458A6]/15 text-[#1B2631]'
                          : 'bg-[#FAF8F2] border-[#E2DFD6] text-[#9BA3AE]'
                    }`}
                  >
                    {ch || '·'}
                  </div>
                );
              })}
            </div>

            <input
              ref={codeInputRef}
              value={code}
              onFocus={() => setCodeFocused(true)}
              onBlur={() => setCodeFocused(false)}
              onChange={(event) => setCode(smartNormalizeClassCode(event.target.value))}
              onPaste={(event) => {
                const pasted = event.clipboardData?.getData('text') || '';
                if (pasted) {
                  event.preventDefault();
                  setCode(smartNormalizeClassCode(pasted));
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && canJoin) void handleJoin();
              }}
              maxLength={64}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABC234"
              aria-label="参加コード"
              className="absolute inset-0 w-full h-full opacity-0 cursor-text"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={!canJoin}
            className="w-full flex min-h-[44px] items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-[#1B2631] hover:bg-[#273746] text-white text-xs sm:text-sm font-extrabold shadow-xs transition-all disabled:opacity-40"
          >
            {joining ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
            {joining
              ? 'クラスを確認して参加中…'
              : canJoin
                ? `コード「${normalized}」でクラスに参加する`
                : `6文字のコードを入力してください（あと${JOIN_CODE_LENGTH - normalized.length}文字）`}
          </button>

          <p
            data-testid="class-consent-notice"
            className="flex items-start gap-1.5 rounded-xl bg-[#FFF8E6] border border-[#F2D58A] px-2.5 py-1.5 text-[11px] leading-snug text-[#7A5A12]"
          >
            <ShieldCheck size={13} className="shrink-0 mt-[1px]" />
            <span>
              <strong>16歳未満の人は保護者の同意をもらってから参加してください。</strong>
              参加すると学習記録が担当の先生に共有されます（0/O・1/I自動補正・いつでも退出可）。
            </span>
          </p>
        </section>
      )}

      {/* A3：先生との1対1 LINE風トークモーダル */}
      {chatMembership && (
        <ClassChatModal
          open={true}
          classId={chatMembership.classId}
          className={chatMembership.className}
          schoolName={chatMembership.schoolName}
          teacherUid={chatMembership.teacherUid}
          studentUid={uid}
          studentName={
            chatMembership.rosterName ||
            defaultDisplayName ||
            auth.currentUser?.displayName ||
            '生徒'
          }
          viewerRole="student"
          viewerName={
            chatMembership.rosterName ||
            defaultDisplayName ||
            auth.currentUser?.displayName ||
            '生徒'
          }
          defaultGrade={chatMembership.subject}
          onStartChapter={
            onStartChapter
              ? (chapterId) => {
                  if (!isValidEikenChapterId(chapterId)) return;
                  const targetSubject =
                    (chapterSubjectOf(chapterId) as MembershipDetail['subject'] | null) ||
                    chatMembership.subject;
                  setChatMembership(null);
                  onStartChapter(chapterId, targetSubject);
                }
              : undefined
          }
          onClose={() => setChatMembership(null)}
        />
      )}
    </div>
  );
}
