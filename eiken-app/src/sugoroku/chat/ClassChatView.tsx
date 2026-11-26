/**
 * ============================================================================
 * LINE本格仕様 1対1 生徒×先生リアルタイムチャットビュー（埋め込み ＆ モーダル両対応）
 * ============================================================================
 *
 * ■ 主な機能
 * - LINEそのままの視覚体験：ブルーグレー背景・吹き出しのしっぽ・同一送信者の連続グルーピング・
 *   日付ピル・「ここから未読メッセージ」境界ライン・「既読」時刻表示
 * - メッセージタップ操作：👍👏🔥💡🙏 ワンタップリアクション、引用リプライ、コピー、送信取り消し
 * - 学習直結リッチ添付：
 *   1) 相談トピックタグ（質問・宿題相談・ペース調整・完了報告・声掛け）
 *   2) アプリ内の英検単元カード添付（相手がタップするとその単元の演習が即座に開く！）
 *   3) LINEスタンプ感覚のワンタップ学習スタンプ＆定型チップ
 * - 先生専用ツール：トーク上部にその生徒の今週学習時間・宿題消化率ミニカルテを表示し、
 *   「相談中 ⇄ 解決済み」ステータス切替、「ピン留め約束メモ」編集、その場での「課題配信」まで直結
 * - 通知＆サウンド制御：ブラウザ通知ON・着信チャイム音ON/OFF・会話内キーワード検索
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  Bell,
  BellRing,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  CornerUpLeft,
  MessageCircle,
  Pin,
  Plus,
  Search,
  Send,
  Smile,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { allEikenChapterCatalog, isValidEikenChapterId } from '../homework/chapterTotals';
import { checkClassChatSafety } from './chatSafety';
import {
  CLASS_CHAT_MAX_MESSAGE_LENGTH,
  getBrowserNotificationPermission,
  isChatSoundEnabled,
  loadLocalChatMessages,
  loadLocalChatThreads,
  markClassChatThreadRead,
  requestBrowserNotificationPermission,
  sendClassChatMessage,
  setChatSoundEnabled,
  subscribeClassChatConversation,
  toggleClassChatReaction,
  unsendClassChatMessage,
  updateClassChatThreadMeta,
} from './chatStore';
import {
  buildClassChatThreadId,
  CHAT_QUICK_STAMPS,
  CHAT_REACTIONS,
  CHAT_TOPIC_META,
  STUDENT_CHAT_QUICK_TEMPLATES,
  TEACHER_CHAT_QUICK_TEMPLATES,
  type ClassChatMessageDoc,
  type ClassChatReactionKey,
  type ClassChatSenderRole,
  type ClassChatThreadDoc,
  type ClassChatTopicTag,
} from './chatTypes';
import './class-chat.css';

export interface StudentPulseSummary {
  targetGradeLabel: string;
  weeklyTimeLabel: string;
  homeworkPct: number;
  homeworkCountLabel?: string;
}

export interface ClassChatViewProps {
  classId: string;
  className: string;
  schoolName?: string;
  teacherUid: string;
  studentUid: string;
  studentName: string;
  viewerRole: ClassChatSenderRole;
  viewerName: string;
  /** 対象級（単元カード添付の初期フィルタに使用） */
  defaultGrade?: string;
  /** 先生側に表示するこの生徒の学習状況ミニサマリー */
  studentPulse?: StudentPulseSummary;
  isDemoMode?: boolean;
  /** モバイル2ペイン時にトーク一覧へ戻るハンドラ */
  onBackToList?: () => void;
  /** 先生側：この生徒にそのまま課題を出すハンドラ */
  onIssueHomework?: () => void;
  /** 先生側：生徒詳細カルテを開くハンドラ */
  onOpenStudentDetail?: () => void;
  /** 添付された単元カードの「今すぐ解く」押下ハンドラ */
  onStartChapter?: (chapterId: string) => void;
  onClose?: () => void;
  embedded?: boolean;
}

function formatTimeHm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  ) {
    return '今日';
  }
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()] || '';
  return `${d.getMonth() + 1}月${d.getDate()}日(${w})`;
}

export function ClassChatView({
  classId,
  className,
  schoolName = '',
  teacherUid,
  studentUid,
  studentName,
  viewerRole,
  viewerName,
  defaultGrade = 'eiken_2',
  studentPulse,
  isDemoMode = false,
  onBackToList,
  onIssueHomework,
  onOpenStudentDetail,
  onStartChapter,
  onClose,
  embedded = false,
}: ClassChatViewProps) {
  const initialThreadId = buildClassChatThreadId(classId, studentUid);
  const [thread, setThread] = useState<ClassChatThreadDoc | null>(
    () => loadLocalChatThreads({ isDemoMode })[initialThreadId] ?? null,
  );
  const [messages, setMessages] = useState<ClassChatMessageDoc[]>(() =>
    loadLocalChatMessages(initialThreadId, { isDemoMode }),
  );

  // 開いた瞬間の自分の既読時刻を保持し、「ここから未読メッセージ」ラインを出す
  const initialViewerReadAtRef = useRef<number | null>(null);
  if (initialViewerReadAtRef.current === null) {
    const initialT = loadLocalChatThreads({ isDemoMode })[initialThreadId];
    initialViewerReadAtRef.current = initialT
      ? viewerRole === 'teacher'
        ? initialT.teacherLastReadAt
        : initialT.studentLastReadAt
      : Date.now();
  }

  const [draft, setDraft] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<ClassChatTopicTag | undefined>(undefined);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    senderName: string;
    text: string;
  } | null>(null);
  const [attachedChapter, setAttachedChapter] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'none' | 'stamps' | 'chapters' | 'pin'>('none');
  const [chapterGradeFilter, setChapterGradeFilter] = useState<string>(() =>
    defaultGrade.startsWith('eiken_') ? defaultGrade : 'eiken_2',
  );
  const [chapterQuery, setChapterQuery] = useState('');
  const [pinDraft, setPinDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState<boolean>(() => isChatSoundEnabled());
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    getBrowserNotificationPermission(),
  );

  const timelineRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const msgDomMapRef = useRef<Record<string, HTMLDivElement | null>>({});
  const composingRef = useRef(false);

  const shortStudentName = studentName.split('（')[0] || studentName;

  // 入力中リアルタイム安全性プレビュー（送信ボタンを押す前に優しく事前案内）
  const liveSafetyCheck = useMemo(() => {
    if (!draft.trim()) return { ok: true as const };
    return checkClassChatSafety(draft);
  }, [draft]);

  // 先生用：目の前の生徒の実データ（名前・今週学習時間・宿題消化率）を自動差し込みした個別声掛けチップ
  const personalizedCoachChips = useMemo<
    Array<{ label: string; topic: ClassChatTopicTag; text: string }>
  >(() => {
    if (viewerRole !== 'teacher' || !studentPulse) return [];
    const gradeClean = studentPulse.targetGradeLabel.replace(/^目標\s*/, '');
    const chips: Array<{ label: string; topic: ClassChatTopicTag; text: string }> = [];

    if (studentPulse.homeworkPct >= 80) {
      chips.push({
        label: `👏 ${studentPulse.homeworkPct}%達成を褒める`,
        topic: 'encourage',
        text: `${shortStudentName}さん、今週${studentPulse.weeklyTimeLabel}も学習を積み上げて、宿題も${studentPulse.homeworkPct}%まで進んでいて素晴らしいペースです！この調子で${gradeClean}合格へ向かって進めよう！`,
      });
    } else if (studentPulse.homeworkPct > 0) {
      chips.push({
        label: `🔥 今週${studentPulse.weeklyTimeLabel}を応援`,
        topic: 'encourage',
        text: `${shortStudentName}さん、今週${studentPulse.weeklyTimeLabel}しっかり取り組めているね！宿題も現在${studentPulse.homeworkPct}%${studentPulse.homeworkCountLabel ? `（${studentPulse.homeworkCountLabel}）` : ''}まで進んでいるので、今日はあと1パートだけ一緒に進めよう！`,
      });
    } else {
      chips.push({
        label: '🌱 最初の5分声掛け',
        topic: 'pace',
        text: `${shortStudentName}さん、部活や学校お疲れさま！今週の${gradeClean}の課題、まずは今日5分（短文語彙かリスニング第1部の最初の5問）だけ開いてみよう！`,
      });
    }
    return chips;
  }, [viewerRole, studentPulse, shortStudentName]);

  const jumpToQuotedMessage = (targetMsgId: string | undefined) => {
    if (!targetMsgId) return;
    const node = msgDomMapRef.current[targetMsgId];
    if (!node) return;
    if (typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightedMsgId(targetMsgId);
    window.setTimeout(() => {
      setHighlightedMsgId((cur) => (cur === targetMsgId ? null : cur));
    }, 1800);
  };

  // スレッド切替時の状態リセット
  useEffect(() => {
    const tid = buildClassChatThreadId(classId, studentUid);
    const localT = loadLocalChatThreads({ isDemoMode })[tid] ?? null;
    initialViewerReadAtRef.current = localT
      ? viewerRole === 'teacher'
        ? localT.teacherLastReadAt
        : localT.studentLastReadAt
      : Date.now();
    setThread(localT);
    setMessages(loadLocalChatMessages(tid, { isDemoMode }));
    setReplyTo(null);
    setAttachedChapter(null);
    setSelectedTopic(undefined);
    setActiveActionMsgId(null);
    setDrawerTab('none');
  }, [classId, studentUid, viewerRole, isDemoMode]);

  useEffect(() => {
    if (!classId || !studentUid) return;
    return subscribeClassChatConversation({
      classId,
      studentUid,
      isDemoMode,
      onUpdate: ({ thread: nextThread, messages: nextMsgs }) => {
        setThread(nextThread);
        setMessages(nextMsgs);
      },
    });
  }, [classId, studentUid, isDemoMode]);

  // 開いている間、相手からの未読があれば既読にする
  useEffect(() => {
    if (!classId || !studentUid) return;
    void markClassChatThreadRead({
      classId,
      studentUid,
      viewerRole,
      isDemoMode,
    });
  }, [classId, studentUid, viewerRole, isDemoMode, messages.length]);

  const scrollToBottom = (smooth = false) => {
    const el = timelineRef.current;
    if (!el) return;
    if (smooth && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
    setAtBottom(true);
  };

  useEffect(() => {
    if (atBottom) {
      scrollToBottom(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, studentUid]);

  // テキストエリアの高さ自動調整（1〜5行）
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(120, Math.max(38, ta.scrollHeight))}px`;
  }, [draft]);

  const handleTimelineScroll = () => {
    const el = timelineRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < 72);
  };

  const peerReadAt =
    viewerRole === 'teacher'
      ? (thread?.studentLastReadAt ?? 0)
      : (thread?.teacherLastReadAt ?? 0);

  const quickTemplates =
    viewerRole === 'teacher' ? TEACHER_CHAT_QUICK_TEMPLATES : STUDENT_CHAT_QUICK_TEMPLATES;

  const allChapters = useMemo(() => allEikenChapterCatalog(), []);
  const pickableChapters = useMemo(() => {
    const q = chapterQuery.trim().toLowerCase();
    return allChapters
      .filter((c) => {
        if (chapterGradeFilter !== 'all' && c.grade !== chapterGradeFilter) return false;
        if (q && !c.title.toLowerCase().includes(q)) return false;
        return true;
      })
      .slice(0, 36);
  }, [allChapters, chapterGradeFilter, chapterQuery]);

  const visibleMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) => !m.unsent && m.text.toLowerCase().includes(q),
    );
  }, [messages, searchQuery]);

  // 日付区切り・未読区切り・連続送信グルーピング付きのタイムライン構築
  const groupedTimeline = useMemo(() => {
    const items: Array<
      | { kind: 'date'; key: string; label: string }
      | { kind: 'unread'; key: string }
      | { kind: 'msg'; msg: ClassChatMessageDoc; groupedWithPrev: boolean }
    > = [];
    let lastDay = '';
    let prevSenderRole: ClassChatSenderRole | null = null;
    let prevCreatedAt = 0;
    let unreadInserted = false;
    const baseReadAt = initialViewerReadAtRef.current ?? Date.now();

    for (const msg of visibleMessages) {
      const dayLabel = formatDateLabel(msg.createdAt);
      if (dayLabel !== lastDay) {
        items.push({ kind: 'date', key: `date_${dayLabel}_${msg.id}`, label: dayLabel });
        lastDay = dayLabel;
        prevSenderRole = null;
      }
      if (
        !unreadInserted &&
        !searchQuery &&
        baseReadAt > 0 &&
        msg.senderRole !== viewerRole &&
        msg.createdAt > baseReadAt
      ) {
        items.push({ kind: 'unread', key: `unread_${msg.id}` });
        unreadInserted = true;
        prevSenderRole = null;
      }

      const groupedWithPrev =
        !msg.unsent &&
        prevSenderRole === msg.senderRole &&
        msg.createdAt - prevCreatedAt < 3 * 60_000;

      items.push({ kind: 'msg', msg, groupedWithPrev });
      prevSenderRole = msg.unsent ? null : msg.senderRole;
      prevCreatedAt = msg.createdAt;
    }
    return items;
  }, [visibleMessages, viewerRole, searchQuery]);

  const handleEnableNotifications = async () => {
    const perm = await requestBrowserNotificationPermission();
    setNotifPerm(perm);
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setChatSoundEnabled(next);
  };

  const handleSend = async (override?: {
    text: string;
    topic?: ClassChatTopicTag;
  }) => {
    const body = (override ? override.text : draft).trim();
    if (!body || sending) return;
    setSending(true);
    setSendError('');
    try {
      await sendClassChatMessage({
        classId,
        className,
        schoolName,
        teacherUid,
        studentUid,
        studentName,
        senderRole: viewerRole,
        senderName: viewerName,
        text: body,
        topic: override?.topic ?? selectedTopic,
        replyTo,
        linkedChapter: attachedChapter,
        isDemoMode,
      });
      if (!override) {
        setDraft('');
      }
      setReplyTo(null);
      setAttachedChapter(null);
      setSelectedTopic(undefined);
      setDrawerTab('none');
      setAtBottom(true);
      window.setTimeout(() => scrollToBottom(true), 30);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : '送信に失敗しました。');
    } finally {
      setSending(false);
    }
  };

  const handleToggleReaction = async (msgId: string, key: ClassChatReactionKey) => {
    setActiveActionMsgId(null);
    await toggleClassChatReaction({
      classId,
      studentUid,
      messageId: msgId,
      viewerRole,
      reaction: key,
      isDemoMode,
    });
  };

  const handleUnsend = async (msgId: string) => {
    setActiveActionMsgId(null);
    await unsendClassChatMessage({
      classId,
      studentUid,
      messageId: msgId,
      viewerRole,
      isDemoMode,
    });
  };

  const handleCopyText = async (msg: ClassChatMessageDoc) => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedId(msg.id);
      setActiveActionMsgId(null);
      window.setTimeout(() => setCopiedId((c) => (c === msg.id ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleToggleResolution = async () => {
    const next = thread?.resolutionStatus === 'open' ? 'resolved' : 'open';
    await updateClassChatThreadMeta({
      classId,
      studentUid,
      viewerRole,
      resolutionStatus: next,
      isDemoMode,
    });
  };

  const handleSavePinnedNotice = async () => {
    if (viewerRole !== 'teacher') return;
    await updateClassChatThreadMeta({
      classId,
      studentUid,
      viewerRole,
      pinnedNotice: pinDraft,
      isDemoMode,
    });
    setDrawerTab('none');
  };

  const peerTitle =
    viewerRole === 'teacher'
      ? studentName
      : `${schoolName ? `${schoolName} ` : ''}${className} 担当先生`;
  const peerInitial =
    viewerRole === 'teacher' ? (shortStudentName.trim()[0] || '生') : '先';

  const topicChoices: ClassChatTopicTag[] =
    viewerRole === 'teacher'
      ? ['encourage', 'homework', 'question', 'pace']
      : ['question', 'homework', 'pace', 'report'];

  return (
    <div
      className={embedded ? 'cchat-shell' : 'h-full flex flex-col relative'}
      data-testid="class-chat-view"
      onClick={() => setActiveActionMsgId(null)}
      onKeyDown={(ev) => {
        if (ev.key === 'Escape') {
          if (activeActionMsgId) {
            ev.stopPropagation();
            setActiveActionMsgId(null);
          } else if (drawerTab !== 'none') {
            ev.stopPropagation();
            setDrawerTab('none');
          } else if (searchOpen) {
            ev.stopPropagation();
            setSearchOpen(false);
            setSearchQuery('');
          } else if (onClose) {
            onClose();
          }
        }
      }}
    >
      {/* 1. LINE風ヘッダー */}
      <header className="cchat-header" onClick={(e) => e.stopPropagation()}>
        <div className="cchat-header-main">
          {onBackToList && (
            <button
              type="button"
              className="cchat-back-btn cchat-mobile-only"
              onClick={onBackToList}
              aria-label="トーク一覧へ戻る"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <span className="cchat-avatar" aria-hidden="true">
            {peerInitial}
            <i className="cchat-avatar-online" />
          </span>
          <div className="cchat-header-titles">
            <div className="cchat-header-title-row">
              <strong>{peerTitle}</strong>
              {thread?.resolutionStatus && (
                <span
                  className="cchat-status-pill"
                  data-status={thread.resolutionStatus}
                >
                  {thread.resolutionStatus === 'open' ? '相談中' : '解決済'}
                </span>
              )}
            </div>
            <small>
              {viewerRole === 'teacher'
                ? `${className} · 1対1個別トーク（他生徒には非公開・個人連絡先保護）`
                : '質問・宿題・ペース相談（他の生徒には一切見えません・個人連絡先の送信は自動保護）'}
            </small>
          </div>
        </div>

        <div className="cchat-header-actions">
          {viewerRole === 'teacher' && (
            <button
              type="button"
              className="cchat-head-btn"
              data-active={thread?.resolutionStatus === 'resolved' ? 'true' : undefined}
              onClick={() => void handleToggleResolution()}
              title="質問・相談の対応状態を切り替え"
            >
              <CheckCircle2 size={13} />
              <span className="hidden sm:inline">
                {thread?.resolutionStatus === 'open' ? '解決にする' : '相談中にする'}
              </span>
            </button>
          )}

          <button
            type="button"
            className="cchat-head-btn"
            data-active={searchOpen ? 'true' : undefined}
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setSearchQuery('');
            }}
            title="トーク履歴を検索"
            aria-label="トーク内検索"
          >
            <Search size={13} />
          </button>

          <button
            type="button"
            className="cchat-head-btn"
            data-active={soundOn ? 'true' : undefined}
            onClick={handleToggleSound}
            title={soundOn ? '着信チャイム音 ON' : '着信チャイム音 OFF'}
            aria-label="着信音の切り替え"
          >
            {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>

          {notifPerm !== 'unsupported' && (
            <button
              type="button"
              className="cchat-head-btn"
              data-active={notifPerm === 'granted' ? 'true' : undefined}
              onClick={() => void handleEnableNotifications()}
              title="メッセージ着信時のプッシュ通知設定"
            >
              {notifPerm === 'granted' ? (
                <>
                  <BellRing size={13} />
                  <span className="hidden sm:inline">通知ON</span>
                </>
              ) : (
                <>
                  <Bell size={13} />
                  <span>通知ONにする</span>
                </>
              )}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              className="cchat-head-btn"
              onClick={onClose}
              aria-label="チャットを閉じる"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {/* 2. サブバー：先生用生徒カルテ帯 ／ ピン留め約束アナウンス ／ トーク検索 */}
      {(studentPulse || thread?.pinnedNotice || viewerRole === 'teacher' || searchOpen) && (
        <div className="cchat-subbar" onClick={(e) => e.stopPropagation()}>
          {viewerRole === 'teacher' && studentPulse && (
            <div className="cchat-student-pulse">
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 800, color: '#1e3a8a' }}>
                  {studentPulse.targetGradeLabel}
                </span>
                <span>
                  今週の学習: <b>{studentPulse.weeklyTimeLabel}</b>
                </span>
                <span>
                  宿題消化: <b>{studentPulse.homeworkPct}%</b>
                  {studentPulse.homeworkCountLabel ? ` (${studentPulse.homeworkCountLabel})` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {onIssueHomework && (
                  <button
                    type="button"
                    onClick={onIssueHomework}
                    className="px-2.5 py-1 rounded-lg bg-[#2458A6] text-white text-[11px] font-extrabold hover:bg-[#1c4687] cursor-pointer"
                  >
                    ＋ この生徒に課題を出す
                  </button>
                )}
                {onOpenStudentDetail && (
                  <button
                    type="button"
                    onClick={onOpenStudentDetail}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-[11px] font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    詳細カルテ
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPinDraft(thread?.pinnedNotice || '');
                    setDrawerTab((cur) => (cur === 'pin' ? 'none' : 'pin'));
                  }}
                  className="px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Pin size={11} />
                  約束メモ
                </button>
              </div>
            </div>
          )}

          {thread?.pinnedNotice && (
            <div className="cchat-pinned-bar">
              <Pin size={13} className="text-amber-600 shrink-0" />
              <span className="flex-1 min-w-0 truncate font-bold text-[#1e293b]">
                {thread.pinnedNotice}
              </span>
              {viewerRole === 'teacher' && (
                <button
                  type="button"
                  onClick={() => {
                    setPinDraft(thread.pinnedNotice || '');
                    setDrawerTab('pin');
                  }}
                  className="text-[11px] font-bold text-[#2458A6] hover:underline shrink-0"
                >
                  編集
                </button>
              )}
            </div>
          )}

          {searchOpen && (
            <div className="cchat-search-bar">
              <Search size={13} className="text-slate-400 shrink-0" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="トーク内のメッセージを検索…"
                aria-label="トーク内検索キーワード"
              />
              {searchQuery && (
                <span className="text-[11px] font-bold text-slate-500">
                  {visibleMessages.length}件
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. LINEタイムライン本体 */}
      <div
        ref={timelineRef}
        onScroll={handleTimelineScroll}
        className="cchat-timeline"
        role="log"
        aria-live="polite"
      >
        {groupedTimeline.length === 0 ? (
          <div className="cchat-empty">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-[#06C755]" />
            <p className="font-extrabold text-sm text-[#1B2631] mb-1">
              {searchQuery
                ? '一致するメッセージが見つかりませんでした'
                : viewerRole === 'teacher'
                  ? `${shortStudentName}さんとの1対1トークルーム`
                  : '先生との1対1相談トークルーム'}
            </p>
            {!searchQuery && (
              <p>
                {viewerRole === 'teacher'
                  ? '声掛け・質問回答はもちろん、左下の「＋」から英検の演習単元カードを添付して送ると、生徒がチャットから1タップでその単元を解き始められます。'
                  : 'わからない問題・今週の宿題のやり方・部活やテスト期間のペース相談など、下のチップやスタンプからLINE感覚で気軽に送れます！'}
              </p>
            )}
          </div>
        ) : (
          groupedTimeline.map((entry) => {
            if (entry.kind === 'date') {
              return (
                <div key={entry.key} className="cchat-date-divider">
                  {entry.label}
                </div>
              );
            }
            if (entry.kind === 'unread') {
              return (
                <div key={entry.key} className="cchat-unread-divider">
                  <span>ここから未読メッセージ</span>
                </div>
              );
            }

            const m = entry.msg;
            if (m.unsent) {
              return (
                <div key={m.id} className="cchat-unsent-pill">
                  {m.senderRole === viewerRole
                    ? 'メッセージの送信を取り消しました'
                    : `${m.senderName || '相手'}がメッセージの送信を取り消しました`}
                </div>
              );
            }

            const isMine = m.senderRole === viewerRole;
            const isReadByPeer = isMine && peerReadAt >= m.createdAt;
            const topicMeta = m.topic ? CHAT_TOPIC_META[m.topic] : null;
            const reactionEntries = Object.entries(m.reactions || {}) as Array<
              [ClassChatSenderRole, ClassChatReactionKey]
            >;
            const menuOpen = activeActionMsgId === m.id;

            return (
              <div
                key={m.id}
                ref={(el) => {
                  msgDomMapRef.current[m.id] = el;
                }}
                className="cchat-msg-row"
                data-mine={isMine ? 'true' : 'false'}
                data-grouped={entry.groupedWithPrev ? 'true' : 'false'}
                data-highlighted={highlightedMsgId === m.id ? 'true' : undefined}
                onClick={(e) => e.stopPropagation()}
              >
                {!isMine &&
                  (entry.groupedWithPrev ? (
                    <span className="cchat-peer-spacer" aria-hidden="true" />
                  ) : (
                    <span className="cchat-peer-badge" aria-hidden="true">
                      {m.senderRole === 'teacher' ? '先' : (m.senderName.trim()[0] || '生')}
                    </span>
                  ))}

                <div className="cchat-bubble-wrap">
                  {!isMine && !entry.groupedWithPrev && (
                    <span className="cchat-sender-label">
                      {m.senderName || (m.senderRole === 'teacher' ? '担当先生' : shortStudentName)}
                    </span>
                  )}

                  <div className="cchat-bubble-line">
                    <div
                      className="cchat-bubble"
                      onClick={() =>
                        setActiveActionMsgId((cur) => (cur === m.id ? null : m.id))
                      }
                      title="タップしてリアクション・返信・メニューを表示"
                    >
                      {topicMeta && (
                        <span
                          className="cchat-topic-badge"
                          style={{
                            backgroundColor: topicMeta.bg,
                            color: topicMeta.fg,
                            borderColor: topicMeta.border,
                          }}
                        >
                          {topicMeta.shortLabel}
                        </span>
                      )}

                      {m.replyToText && (
                        <button
                          type="button"
                          className="cchat-reply-quote w-full text-left cursor-pointer hover:opacity-90"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            jumpToQuotedMessage(m.replyToId);
                          }}
                          title={m.replyToId ? 'タップして返信元のメッセージへ移動' : undefined}
                        >
                          <strong>↩ {m.replyToSenderName || '返信元'}</strong>
                          <span className="line-clamp-2">{m.replyToText}</span>
                        </button>
                      )}

                      <div>{m.text}</div>

                      {m.linkedChapterId && (isDemoMode || isValidEikenChapterId(m.linkedChapterId)) && (
                        <button
                          type="button"
                          data-testid="class-chat-chapter-card"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            if (!isDemoMode && !isValidEikenChapterId(m.linkedChapterId)) return;
                            onStartChapter?.(m.linkedChapterId!);
                          }}
                          className="cchat-chapter-card"
                        >
                          <div className="min-w-0">
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#2458A6]">
                              <BookOpen size={11} />
                              アプリ内演習リンク
                            </span>
                            <strong className="block text-xs font-extrabold text-[#1B2631] truncate">
                              {m.linkedChapterTitle || m.linkedChapterId}
                            </strong>
                          </div>
                          {onStartChapter && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg bg-[#2458A6] text-white text-[11px] font-extrabold">
                              解く
                              <ChevronRight size={12} />
                            </span>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="cchat-meta">
                      {isReadByPeer && <span className="cchat-read-flag">既読</span>}
                      <span>{copiedId === m.id ? 'コピー済' : formatTimeHm(m.createdAt)}</span>
                    </div>
                  </div>

                  {/* 付与済みリアクションピル */}
                  {reactionEntries.length > 0 && (
                    <div className="cchat-reaction-pills">
                      {reactionEntries.map(([role, rKey]) => {
                        const meta = CHAT_REACTIONS.find((r) => r.key === rKey);
                        if (!meta) return null;
                        return (
                          <button
                            key={`${m.id}_${role}`}
                            type="button"
                            className="cchat-reaction-pill"
                            onClick={() => void handleToggleReaction(m.id, rKey)}
                            title={`${role === 'teacher' ? '先生' : shortStudentName}: ${meta.label}`}
                          >
                            <span>{meta.emoji}</span>
                            <span style={{ fontSize: 10, color: '#64748b' }}>
                              {role === 'teacher' ? '先生' : '生徒'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* メッセージタップで開くLINE風クイックリアクション＆リプライバー */}
                  {menuOpen && (
                    <div className="cchat-action-popover" role="toolbar" aria-label="メッセージ操作">
                      {CHAT_REACTIONS.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          className="cchat-action-emoji-btn"
                          onClick={() => void handleToggleReaction(m.id, r.key)}
                          title={r.label}
                        >
                          {r.emoji}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="cchat-action-text-btn"
                        onClick={() => {
                          setReplyTo({
                            id: m.id,
                            senderName:
                              m.senderName ||
                              (m.senderRole === 'teacher' ? '先生' : shortStudentName),
                            text: m.text,
                          });
                          setActiveActionMsgId(null);
                          textareaRef.current?.focus();
                        }}
                      >
                        <CornerUpLeft size={11} />
                        返信
                      </button>
                      <button
                        type="button"
                        className="cchat-action-text-btn"
                        onClick={() => void handleCopyText(m)}
                      >
                        <Copy size={11} />
                        コピー
                      </button>
                      {isMine && (
                        <button
                          type="button"
                          className="cchat-action-text-btn"
                          onClick={() => void handleUnsend(m.id)}
                        >
                          <Trash2 size={11} />
                          送信取消
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 最新メッセージへ一気に降りるフローティングボタン */}
      {!atBottom && (
        <button
          type="button"
          className="cchat-JumpBottom"
          onClick={() => scrollToBottom(true)}
        >
          <ArrowDown size={13} />
          最新へ移動
        </button>
      )}

      {/* 4. コンポーザートレイ（返信プレビュー・単元添付・スタンプ・定型チップ・自動伸長入力） */}
      <div className="cchat-composer-tray" onClick={(e) => e.stopPropagation()}>
        {/* 返信引用中 / 単元添付中 / トピック選択中のステータスバー */}
        {(replyTo || attachedChapter || selectedTopic) && (
          <div className="cchat-active-AttachmentBar">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {selectedTopic && (
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-extrabold"
                  style={{
                    backgroundColor: CHAT_TOPIC_META[selectedTopic].bg,
                    color: CHAT_TOPIC_META[selectedTopic].fg,
                    border: `1px solid ${CHAT_TOPIC_META[selectedTopic].border}`,
                  }}
                >
                  #{CHAT_TOPIC_META[selectedTopic].shortLabel}
                </span>
              )}
              {replyTo && (
                <span className="truncate text-xs">
                  <b>↩ {replyTo.senderName}へ返信:</b> {replyTo.text}
                </span>
              )}
              {attachedChapter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-blue-200 text-xs font-bold text-[#2458A6]">
                  <BookOpen size={12} />
                  {attachedChapter.title}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                setAttachedChapter(null);
                setSelectedTopic(undefined);
              }}
              aria-label="添付・返信を解除"
              className="p-1 text-slate-500 hover:text-slate-800 shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* 拡張ドロワー：スタンプ / 単元カード添付 / ピン留め約束メモ編集 */}
        {drawerTab === 'stamps' && (
          <div className="cchat-tool-drawer" aria-label="ワンタップスタンプ">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-600">
              <span>ワンタップで送れる学習スタンプ（押すと即時送信）</span>
              <button type="button" onClick={() => setDrawerTab('none')} className="text-slate-400">
                閉じる
              </button>
            </div>
            <div className="cchat-stamp-grid">
              {CHAT_QUICK_STAMPS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  className="cchat-stamp-btn"
                  disabled={sending}
                  onClick={() => void handleSend({ text: st.text, topic: st.topic })}
                >
                  <span style={{ fontSize: 18 }}>{st.emoji}</span>
                  <span>{st.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {drawerTab === 'chapters' && (
          <div className="cchat-tool-drawer" aria-label="英検単元カードを添付">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#1e3a8a]">
                メッセージに添えるアプリ内単元を選択（相手が1タップで開けます）
              </span>
              <input
                type="search"
                value={chapterQuery}
                onChange={(e) => setChapterQuery(e.target.value)}
                placeholder="第1回 / リスニング…"
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'eiken_2', label: '2級' },
                { id: 'eiken_pre2plus', label: '準2+' },
                { id: 'eiken_pre2', label: '準2級' },
                { id: 'eiken_3', label: '3級' },
                { id: 'eiken_4', label: '4級' },
                { id: 'eiken_5', label: '5級' },
                { id: 'eiken_pre1', label: '準1級' },
                { id: 'eiken_1', label: '1級' },
              ].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setChapterGradeFilter(g.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                    chapterGradeFilter === g.id
                      ? 'bg-[#2458A6] text-white border-[#2458A6]'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pickableChapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setAttachedChapter({ id: ch.id, title: ch.title });
                    setDrawerTab('none');
                    textareaRef.current?.focus();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-[#2458A6] text-xs font-bold text-slate-800 text-left"
                >
                  {ch.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {drawerTab === 'pin' && viewerRole === 'teacher' && (
          <div className="cchat-tool-drawer" aria-label="ピン留め約束メモ設定">
            <span className="text-xs font-extrabold text-amber-900">
              トーク上部に常時ピン留めする「今週の約束・目標メモ」（生徒にも表示されます）
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={200}
                value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value)}
                placeholder="例：今週は部活後にリスニング第1部を毎日10問ずつ進めよう！"
                className="flex-1 min-w-0 px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-800"
              />
              <button
                type="button"
                onClick={() => void handleSavePinnedNotice()}
                className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-extrabold shrink-0"
              >
                ピン留め保存
              </button>
            </div>
          </div>
        )}

        {/* 相談トピック＆定型クイックバー */}
        <div className="cchat-quick-bar" aria-label="相談タグと定型メッセージ">
          {topicChoices.map((tp) => {
            const active = selectedTopic === tp;
            const meta = CHAT_TOPIC_META[tp];
            return (
              <button
                key={tp}
                type="button"
                onClick={() => setSelectedTopic((cur) => (cur === tp ? undefined : tp))}
                className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-extrabold border cursor-pointer"
                style={
                  active
                    ? { backgroundColor: meta.fg, color: '#ffffff', borderColor: meta.fg }
                    : { backgroundColor: meta.bg, color: meta.fg, borderColor: meta.border }
                }
              >
                #{meta.shortLabel}
              </button>
            );
          })}

          {personalizedCoachChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              data-testid="personalized-coach-chip"
              className="cchat-quick-chip cchat-quick-chip-personalized"
              onClick={() => {
                setSelectedTopic(chip.topic);
                setDraft(chip.text);
                textareaRef.current?.focus();
              }}
            >
              {chip.label}
            </button>
          ))}

          {quickTemplates.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              className="cchat-quick-chip"
              onClick={() => {
                setSelectedTopic(tpl.topic);
                setDraft((prev) => (prev ? `${prev}\n${tpl.text}` : tpl.text));
                textareaRef.current?.focus();
              }}
            >
              <Sparkles size={11} className="inline mr-1 text-[#2458A6]" />
              {tpl.label}
            </button>
          ))}
        </div>

        {/* 入力中リアルタイム安全ガイド（電話番号・外部SNS誘導等を送信前に優しく警告） */}
        {!liveSafetyCheck.ok && liveSafetyCheck.message && (
          <div
            role="status"
            data-testid="class-chat-safety-warning"
            className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-xs font-bold text-amber-800 flex items-start gap-1.5"
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
            <span>{liveSafetyCheck.message}</span>
          </div>
        )}

        {sendError && (
          <div className="px-3 py-1.5 bg-red-50 border-b border-red-200 text-xs font-bold text-red-600">
            {sendError}
          </div>
        )}

        {/* LINE風メイン入力バー（＋単元添付 / スタンプ / 自動伸長テキスト / 送信ボタン） */}
        <div className="cchat-composer">
          <button
            type="button"
            className="cchat-plus-btn"
            aria-expanded={drawerTab === 'chapters'}
            onClick={() =>
              setDrawerTab((cur) => (cur === 'chapters' ? 'none' : 'chapters'))
            }
            title="英検の単元カードを添付する"
            aria-label="単元カードを添付"
          >
            <Plus size={18} />
          </button>

          <button
            type="button"
            className="cchat-plus-btn"
            aria-expanded={drawerTab === 'stamps'}
            onClick={() => setDrawerTab((cur) => (cur === 'stamps' ? 'none' : 'stamps'))}
            title="ワンタップ学習スタンプを開く"
            aria-label="スタンプを開く"
          >
            <Smile size={18} />
          </button>

          <div className="flex-1 min-w-0 flex flex-col">
            <textarea
              ref={textareaRef}
              value={draft}
              rows={1}
              maxLength={CLASS_CHAT_MAX_MESSAGE_LENGTH}
              onCompositionStart={() => {
                composingRef.current = true;
              }}
              onCompositionEnd={() => {
                composingRef.current = false;
              }}
              onChange={(e) => {
                setDraft(e.target.value);
                if (sendError) setSendError('');
              }}
              onKeyDown={(e) => {
                if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) {
                  return;
                }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleSend();
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  const isCoarseTouch =
                    typeof window !== 'undefined' &&
                    typeof window.matchMedia === 'function' &&
                    window.matchMedia('(pointer: coarse)').matches;
                  if (!isCoarseTouch) {
                    e.preventDefault();
                    void handleSend();
                  }
                }
              }}
              placeholder={
                viewerRole === 'teacher'
                  ? `${shortStudentName}さんへメッセージ（Enterで送信・Shift+Enterで改行）`
                  : '先生に質問・相談メッセージを送る…'
              }
              className="cchat-textarea w-full"
              aria-label="メッセージ入力"
            />
            {draft.length >= CLASS_CHAT_MAX_MESSAGE_LENGTH - 120 && (
              <span
                className={`self-end text-[10px] font-bold pr-2 pt-0.5 ${
                  draft.length >= CLASS_CHAT_MAX_MESSAGE_LENGTH
                    ? 'text-red-500'
                    : 'text-slate-400'
                }`}
              >
                {draft.length} / {CLASS_CHAT_MAX_MESSAGE_LENGTH}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!draft.trim() || sending || !liveSafetyCheck.ok}
            onClick={() => void handleSend()}
            className="cchat-send-btn"
            aria-label="送信"
            title="送信"
          >
            {sending ? <Check size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/** モーダル表示ラッパー（生徒のホーム・クラス画面・通知バナーからワンタップで開く用） */
export function ClassChatModal(props: ClassChatViewProps & { open: boolean }) {
  const { open, onClose, ...rest } = props;
  if (!open) return null;
  return (
    <div
      className="cchat-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="クラスチャット"
      onClick={onClose}
    >
      <div className="cchat-modal-frame" onClick={(e) => e.stopPropagation()}>
        <ClassChatView {...rest} onClose={onClose} embedded={false} />
      </div>
    </div>
  );
}
