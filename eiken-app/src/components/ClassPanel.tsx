import { useCallback, useEffect, useRef, useState } from 'react';
import {
  School,
  Users,
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
} from 'lucide-react';
import { auth } from '../firebase';
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
import {
  fetchClassSettings,
  getExamSessionShortLabel,
  loadCachedClassSettings,
  type JukuClassSettings,
} from '../sugoroku/admin/classroomSettings';
import { extractInviteCodeFromSearch } from '../sugoroku/auth/sugorokuAuthCore';
import { StudentAssignments } from './classroom/StudentAssignments';
import { AdminClassHubSection } from './classroom/AdminClassHubSection';
import { ClassChatModal, subscribeUserChatInbox } from '../sugoroku/chat';
import { chapterSubjectOf } from '../sugoroku/homework/chapterTotals';

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
  /** 管理クラスの一覧から特定のクラス管理画面を開く */
  onOpenClassAdmin?: (classId: string) => void;
}

export function ClassPanel({
  defaultDisplayName = '',
  onStartChapter,
  showAdminHub = false,
  onOpenClassAdmin,
}: ClassPanelProps) {
  const [memberships, setMemberships] = useState<MembershipDetail[]>([]);
  const [settingsByClass, setSettingsByClass] = useState<Record<string, JukuClassSettings>>({});
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [codeFocused, setCodeFocused] = useState(false);
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
      saveJukuMemberships(
        uid,
        rows.map((row) => ({
          classId: row.classId,
          teacherUid: row.teacherUid,
          className: row.className,
          subject: row.subject,
        })),
      );

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

  if (!uid) {
    return (
      <div className="bg-white border border-[#E4E1D8] rounded-3xl p-5 text-center shadow-2xs space-y-3">
        <School className="w-9 h-9 mx-auto text-[#3E9C93]" />
        <div>
          <p className="text-sm font-extrabold text-[#1B2631] mb-1">
            クラス参加には Google ログインが必要です
          </p>
          <p className="text-xs text-[#5D6D7E] leading-relaxed">
            上の「アカウント」タブから Google アカウントを連携すると、塾や学校の6文字コードでクラスに参加できます。
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left pt-1">
          <div className="rounded-xl bg-[#FAF8F2] border border-[#ECE9E1] px-3 py-2 text-[11px] text-[#374151]">
            <strong className="flex items-center gap-1 font-extrabold text-[#1B2631] mb-0.5">
              <ClipboardList size={12} className="text-[#3E9C93]" />
              今日の課題が届く
            </strong>
            やるべき単元へ1タップで直行
          </div>
          <div className="rounded-xl bg-[#FAF8F2] border border-[#ECE9E1] px-3 py-2 text-[11px] text-[#374151]">
            <strong className="flex items-center gap-1 font-extrabold text-[#1B2631] mb-0.5">
              <MessageCircle size={12} className="text-[#06C755]" />
              先生にチャット相談
            </strong>
            わからない問題を1対1で質問
          </div>
          <div className="rounded-xl bg-[#FAF8F2] border border-[#ECE9E1] px-3 py-2 text-[11px] text-[#374151]">
            <strong className="flex items-center gap-1 font-extrabold text-[#1B2631] mb-0.5">
              <VolumeX size={12} className="text-[#2458A6]" />
              塾生は広告完全OFF
            </strong>
            集中を妨げない専用学習モード
          </div>
        </div>
      </div>
    );
  }

  const normalized = normalizeJoinCode(code);
  const canJoin = normalized.length === JOIN_CODE_LENGTH && !joining;

  return (
    <div className="space-y-3.5">
      {/* A1：管理者・先生アカウント向け「管理しているクラス一覧 ＋ クラスを追加する」 */}
      {showAdminHub && onOpenClassAdmin && (
        <AdminClassHubSection onOpenClassAdmin={onOpenClassAdmin} />
      )}

      {/* 完了通知・エラー通知（視認しやすい上部に配置） */}
      {notice && (
        <div className="flex items-start gap-2 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-[#065F46]">
          <Check size={14} className="shrink-0 mt-0.5 text-[#059669]" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-[#FDEDEC] border border-[#E74C3C]/40 px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-[#C0392B]"
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 参加中のクラス（学習目標・1対1チャット・今日の課題） */}
      <section className="bg-white border border-[#E2DFD6] rounded-3xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold text-[#1B2631] flex items-center gap-1.5">
            <School size={14} className="text-[#3E9C93]" />
            参加中のクラス
          </h3>
          {memberships.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#E8F6F4] text-[#1F635B] text-[11px] font-extrabold">
              {memberships.length}コース在籍中
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-[#6B7280] py-4 text-center">参加クラスを読み込んでいます…</p>
        ) : memberships.length === 0 ? (
          <div className="rounded-2xl bg-[#FAF8F2] border border-[#ECE9E1] px-3.5 py-3 text-xs text-[#5D6D7E] leading-relaxed">
            まだどのクラスにも参加していません。下の<strong>6文字コード入力欄</strong>から先生に案内されたコードを入力すると、宿題・学習ペース・先生との1対1チャットが届きます。
            <span className="block mt-1 text-[11px] text-[#7F8C8D]">
              ※ 参加するまで、あなたの学習記録は誰にも公開されません。
            </span>
          </div>
        ) : (
          <ul className="space-y-3">
            {memberships.map((membership) => {
              const theme = subjectTheme(membership.subject);
              const st =
                settingsByClass[membership.classId] ?? loadCachedClassSettings(membership.classId);
              const isAllGrades = (membership.className || '').includes('全級');
              const unread = unreadByClassId[membership.classId] || 0;

              return (
                <li
                  key={membership.classId}
                  className="rounded-2xl border border-[#DFDCD2] bg-gradient-to-b from-[#FDFCF9] to-white p-3.5 shadow-2xs space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
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

                      {/* コース目標・表示名チップ */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${theme.chipTextClass} ${theme.chipBgClass}`}
                        >
                          {isAllGrades ? '英検5級〜1級 全級対応' : theme.label}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4F6F8] text-[#374151] text-[11px] font-semibold">
                          <Clock size={11} className="text-[#3E9C93]" />
                          目安 1日{st.dailyGoalMinutes}分×週{st.weeklyGoalDays}日
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4F6F8] text-[#374151] text-[11px] font-semibold">
                          <Target size={11} className="text-[#3E9C93]" />
                          {getExamSessionShortLabel(st.examSession)}
                        </span>
                        <span className="text-[11px] text-[#6B7280]">
                          先生の画面での名前：<strong className="text-[#374151]">{membership.rosterName}</strong>
                        </span>
                      </div>

                      {st.coachNote && (
                        <p className="mt-1.5 text-xs text-[#374151] bg-[#FAF8F2] border border-[#ECE9E1] rounded-xl px-2.5 py-1.5 leading-relaxed">
                          先生より：{st.coachNote}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setChatMembership(membership)}
                        className="flex min-h-[40px] items-center gap-1.5 px-3.5 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-extrabold shadow-xs transition-transform active:scale-95 cursor-pointer"
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
                        className="shrink-0 flex min-h-[40px] items-center gap-1 px-2.5 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100/70 text-xs font-bold text-red-600 disabled:opacity-50 transition-colors"
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

                  {/* 今日の課題・今週の宿題 */}
                  <StudentAssignments membership={membership} onStartChapter={onStartChapter} />
                </li>
              );
            })}
          </ul>
        )}

        {/* 共有範囲・プライバシー説明（すっきり開閉できるアコーディオン） */}
        {memberships.length > 0 && (
          <details className="group rounded-2xl bg-[#F4F7FA] border border-[#D9E4EC] px-3.5 py-2.5 text-xs text-[#3C5A6E]">
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
            <div className="pt-2.5 mt-2 border-t border-[#D9E4EC] space-y-2 leading-relaxed">
              <div>
                <p className="font-bold mb-0.5">先生に見えるもの</p>
                <ul className="space-y-0.5">
                  <li>・学習した日・勉強時間・解いた単元の進捗と正答率</li>
                  <li>・復習リストの件数・提出した英作文やスピーキング録音・1対1チャット</li>
                  {memberships.some((m) => m.plan === 'juku') && (
                    <li>・解説画面で「先生に送る」を押した「選んだ理由」（送ったものだけ）</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="flex items-center gap-1 font-bold mb-0.5">
                  <Info size={12} />
                  公開されないもの
                </p>
                <ul className="space-y-0.5">
                  <li>・一般公開ランキング等に本名（名簿名）が出ることは一切ありません</li>
                  <li>・「抜ける」を押した時点で、先生からも見えなくなります</li>
                </ul>
              </div>
            </div>
          </details>
        )}
      </section>

      {/* 6スロット・クラスコード入力カード */}
      <section className="bg-white border border-[#E2DFD6] rounded-3xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-extrabold text-[#1B2631] flex items-center gap-1.5">
              <KeyRound size={14} className="text-[#3E9C93]" />
              新しいクラスに参加する（6文字コード）
            </h3>
            <p className="text-[11px] text-[#6B7280] mt-0.5">
              先生から届いた6文字のコード（または招待URLそのまま貼り付け）で参加できます
            </p>
          </div>
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
        </div>

        {/* タップしやすい6マス視覚スロット ＋ 透明ネイティブ入力 */}
        <div
          className="relative cursor-text"
          onClick={() => codeInputRef.current?.focus()}
        >
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
                  className={`h-12 sm:h-13 rounded-2xl border-2 flex items-center justify-center font-mono text-lg sm:text-xl font-extrabold transition-all ${
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
          className="w-full flex min-h-[46px] items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#1B2631] hover:bg-[#273746] text-white text-xs sm:text-sm font-extrabold shadow-xs transition-all disabled:opacity-40"
        >
          {joining ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
          {joining
            ? 'クラスを確認して参加中…'
            : canJoin
              ? `コード「${normalized}」でクラスに参加する`
              : `6文字のコードを入力してください（あと${JOIN_CODE_LENGTH - normalized.length}文字）`}
        </button>

        <p className="text-[11px] text-[#6B7280] leading-snug">
          ※ 見間違えやすい <strong>0 と O</strong>、<strong>1 と I</strong>、小文字や全角英数字は自動で補正されます。
        </p>

        {/* 16歳未満は保護者の同意が必要 */}
        <p
          data-testid="class-consent-notice"
          className="flex items-start gap-1.5 rounded-2xl bg-[#FFF8E6] border border-[#F2D58A] px-3 py-2 text-xs leading-snug text-[#7A5A12]"
        >
          <ShieldCheck size={13} className="shrink-0 mt-[1px]" />
          <span>
            <strong>16歳未満の人は、参加する前に保護者の方の同意をもらってください。</strong>
            参加すると、学習した日や単元の進捗などの記録が担当の先生に見えるようになります。
          </span>
        </p>
      </section>

      <p className="flex items-start gap-1.5 text-xs text-gray-400 leading-snug px-1">
        <Users size={11} className="shrink-0 mt-[1px]" />
        <span>
          先生の側からあなたを勝手にクラスへ追加することはできません。このコード入力があなたの「見せていいですよ」という意思表示になります。
        </span>
      </p>

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
