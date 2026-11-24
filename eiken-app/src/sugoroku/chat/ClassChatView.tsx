/**
 * ============================================================================
 * LINE風 1対1 生徒×先生チャットビュー（埋め込み ＆ モーダル両対応）
 * ============================================================================
 *
 * - 生徒側：「先生に質問・ペース相談」として、課題・勉強法・部活との両立をすぐ相談できる
 * - 講師側：「生徒との1対1トーク」として、声掛け・宿題フォロー・質問回答をその場で完結できる
 * - 相手の既読時刻（`teacherLastReadAt` / `studentLastReadAt`）と照合し、LINEと同じ「既読」を表示
 * - 通知許可ボタンからワンタップでブラウザ着信通知をONにできる
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellRing, Check, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import {
  CLASS_CHAT_MAX_MESSAGE_LENGTH,
  getBrowserNotificationPermission,
  loadLocalChatMessages,
  loadLocalChatThreads,
  markClassChatThreadRead,
  requestBrowserNotificationPermission,
  sendClassChatMessage,
  subscribeClassChatConversation,
} from './chatStore';
import {
  buildClassChatThreadId,
  STUDENT_CHAT_QUICK_TEMPLATES,
  TEACHER_CHAT_QUICK_TEMPLATES,
  type ClassChatMessageDoc,
  type ClassChatSenderRole,
  type ClassChatThreadDoc,
} from './chatTypes';
import './class-chat.css';

export interface ClassChatViewProps {
  classId: string;
  className: string;
  schoolName?: string;
  teacherUid: string;
  studentUid: string;
  studentName: string;
  viewerRole: ClassChatSenderRole;
  viewerName: string;
  isDemoMode?: boolean;
  onClose?: () => void;
  embedded?: boolean;
}

function formatTimeHm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateLabel(ms: number): string {
  const d = new Date(ms);
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
  isDemoMode = false,
  onClose,
  embedded = false,
}: ClassChatViewProps) {
  const initialThreadId = buildClassChatThreadId(classId, studentUid);
  const [thread, setThread] = useState<ClassChatThreadDoc | null>(
    () => loadLocalChatThreads()[initialThreadId] ?? null,
  );
  const [messages, setMessages] = useState<ClassChatMessageDoc[]>(() =>
    loadLocalChatMessages(initialThreadId),
  );
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [showTemplates, setShowTemplates] = useState(true);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    getBrowserNotificationPermission(),
  );

  const timelineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!classId || !studentUid) return;
    const unsub = subscribeClassChatConversation({
      classId,
      studentUid,
      isDemoMode,
      onUpdate: ({ thread: nextThread, messages: nextMsgs }) => {
        setThread(nextThread);
        setMessages(nextMsgs);
      },
    });
    return unsub;
  }, [classId, studentUid, isDemoMode]);

  // 開いている間、相手からの未読があれば自動で既読にする
  useEffect(() => {
    if (!classId || !studentUid) return;
    void markClassChatThreadRead({
      classId,
      studentUid,
      viewerRole,
      isDemoMode,
    });
  }, [classId, studentUid, viewerRole, isDemoMode, messages.length]);

  // 新しいメッセージが追加されたら一番下へスクロール
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, studentUid]);

  const peerReadAt =
    viewerRole === 'teacher'
      ? (thread?.studentLastReadAt ?? 0)
      : (thread?.teacherLastReadAt ?? 0);

  const quickTemplates =
    viewerRole === 'teacher' ? TEACHER_CHAT_QUICK_TEMPLATES : STUDENT_CHAT_QUICK_TEMPLATES;

  const groupedTimeline = useMemo(() => {
    const items: Array<
      | { kind: 'date'; key: string; label: string }
      | { kind: 'msg'; msg: ClassChatMessageDoc }
    > = [];
    let lastDay = '';
    for (const msg of messages) {
      const dayLabel = formatDateLabel(msg.createdAt);
      if (dayLabel !== lastDay) {
        items.push({ kind: 'date', key: `date_${dayLabel}_${msg.id}`, label: dayLabel });
        lastDay = dayLabel;
      }
      items.push({ kind: 'msg', msg });
    }
    return items;
  }, [messages]);

  const handleEnableNotifications = async () => {
    const perm = await requestBrowserNotificationPermission();
    setNotifPerm(perm);
  };

  const handleSend = async (textOverride?: string) => {
    const body = (textOverride ?? draft).trim();
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
        isDemoMode,
      });
      if (textOverride === undefined) {
        setDraft('');
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : '送信に失敗しました。');
    } finally {
      setSending(false);
    }
  };

  const peerTitle =
    viewerRole === 'teacher'
      ? studentName
      : `${schoolName ? `${schoolName} ` : ''}${className} 担当先生`;

  const peerInitial =
    viewerRole === 'teacher'
      ? (studentName.trim()[0] || '生')
      : '先';

  return (
    <div
      className={embedded ? 'cchat-shell' : 'h-full flex flex-col'}
      data-testid="class-chat-view"
    >
      {/* ヘッダー */}
      <header className="cchat-header">
        <div className="cchat-header-main">
          <span className="cchat-avatar" aria-hidden="true">
            {peerInitial}
          </span>
          <div className="cchat-header-titles">
            <strong>{peerTitle}</strong>
            <small>
              {viewerRole === 'teacher'
                ? `${className} · 1対1個別トーク（他生徒には非公開）`
                : '宿題・勉強法・ペース相談（他の生徒には見えません）'}
            </small>
          </div>
        </div>

        <div className="cchat-header-actions">
          {notifPerm !== 'unsupported' && (
            <button
              type="button"
              className="cchat-head-btn"
              onClick={() => void handleEnableNotifications()}
              title="メッセージが届いたときに端末通知を受け取る"
            >
              {notifPerm === 'granted' ? (
                <>
                  <BellRing size={13} aria-hidden="true" />
                  通知ON
                </>
              ) : (
                <>
                  <Bell size={13} aria-hidden="true" />
                  着信通知をON
                </>
              )}
            </button>
          )}
          <button
            type="button"
            className="cchat-head-btn"
            onClick={() => setShowTemplates((v) => !v)}
            title="定型メッセージの表示切替"
          >
            <Sparkles size={13} aria-hidden="true" />
            定型文
          </button>
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

      {/* メッセージタイムライン */}
      <div ref={timelineRef} className="cchat-timeline" role="log" aria-live="polite">
        {groupedTimeline.length === 0 ? (
          <div className="cchat-empty">
            <MessageCircle className="w-7 h-7 mx-auto mb-1.5 text-[#2458A6]" />
            <p className="font-bold text-[#1B2631] mb-1">
              {viewerRole === 'teacher'
                ? `${studentName}さんとの1対1トークルームです`
                : '先生との1対1相談チャットです'}
            </p>
            <p>
              {viewerRole === 'teacher'
                ? '今週の宿題の声掛けや、学習ペース・質問へのアドバイスをそのまま送れます。メッセージを送ると生徒のアプリに通知が届きます。'
                : 'わからない問題・今週の宿題の進め方・部活やテスト期間のペース調整など、なんでも気軽にメッセージを送れます。'}
            </p>
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
            const m = entry.msg;
            const isMine = m.senderRole === viewerRole;
            const isReadByPeer = isMine && peerReadAt >= m.createdAt;
            return (
              <div
                key={m.id}
                className="cchat-msg-row"
                data-mine={isMine ? 'true' : 'false'}
              >
                {!isMine && (
                  <span className="cchat-peer-badge" aria-hidden="true">
                    {m.senderRole === 'teacher' ? '先' : (m.senderName.trim()[0] || '生')}
                  </span>
                )}
                <div className="cchat-bubble-wrap">
                  {!isMine && (
                    <span className="cchat-sender-label">
                      {m.senderName || (m.senderRole === 'teacher' ? '担当先生' : studentName)}
                    </span>
                  )}
                  <div className="cchat-bubble-line">
                    <div className="cchat-bubble">{m.text}</div>
                    <div className="cchat-meta">
                      {isReadByPeer && (
                        <span className="cchat-read-flag">
                          既読
                        </span>
                      )}
                      <span>{formatTimeHm(m.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ワンタップ定型チップ */}
      {showTemplates && (
        <div className="cchat-quick-bar" aria-label="クイック返信">
          {quickTemplates.map((tpl) => (
            <button
              key={tpl}
              type="button"
              className="cchat-quick-chip"
              onClick={() => setDraft((prev) => (prev ? `${prev}\n${tpl}` : tpl))}
            >
              ＋ {tpl.length > 22 ? `${tpl.slice(0, 22)}…` : tpl}
            </button>
          ))}
        </div>
      )}

      {sendError && (
        <div className="px-3 py-1.5 bg-red-50 border-t border-red-200 text-xs font-bold text-red-600">
          {sendError}
        </div>
      )}

      {/* 入力欄（Enterキー：Shift+Enterで改行、スマホ・PCどちらも送信ボタン対応） */}
      <div className="cchat-composer">
        <textarea
          value={draft}
          rows={1}
          maxLength={CLASS_CHAT_MAX_MESSAGE_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={
            viewerRole === 'teacher'
              ? `${studentName.split('（')[0]}さんへメッセージを入力…`
              : '先生に質問・相談メッセージを送る…'
          }
          className="cchat-textarea"
          aria-label="メッセージ入力"
        />
        <button
          type="button"
          disabled={!draft.trim() || sending}
          onClick={() => void handleSend()}
          className="cchat-send-btn"
          aria-label="送信"
          title="送信"
        >
          {sending ? <Check size={18} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}

/** モーダル表示ラッパー（生徒のクラス画面・通知バナーからワンタップで開く用） */
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
