/**
 * ============================================================================
 * アプリ常駐チャット着信通知ホスト（リアルタイム監視 ＋ LINE風リッチポップアップ通知）
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { MessageCircle, X } from 'lucide-react';
import { auth, FIREBASE_CONFIGURED } from '../../firebase';
import {
  clearChatRuntimeSessionCache,
  subscribeIncomingChatAlerts,
  subscribeUserChatInbox,
} from './chatStore';
import { CHAT_TOPIC_META, type IncomingClassChatAlert } from './chatTypes';
import './class-chat.css';

interface ClassChatNotificationHostProps {
  onUnreadTotalChange?: (count: number) => void;
  onOpenAlertChat?: (alert: IncomingClassChatAlert) => void;
}

export function ClassChatNotificationHost({
  onUnreadTotalChange,
  onOpenAlertChat,
}: ClassChatNotificationHostProps) {
  const [uid, setUid] = useState<string>(() => auth.currentUser?.uid || '');
  const [activeAlert, setActiveAlert] = useState<IncomingClassChatAlert | null>(null);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) return;
    return onAuthStateChanged(auth, (u) => {
      const nextUid = u?.uid || '';
      setUid((prev) => {
        if (prev !== nextUid) {
          clearChatRuntimeSessionCache();
          setActiveAlert(null);
        }
        return nextUid;
      });
    });
  }, []);

  useEffect(() => {
    return subscribeUserChatInbox({
      uid,
      onSummary: ({ totalUnread }) => {
        onUnreadTotalChange?.(totalUnread);
      },
    });
  }, [uid, onUnreadTotalChange]);

  useEffect(() => {
    return subscribeIncomingChatAlerts((alert) => {
      if (!uid) return;
      if (alert.senderRole === 'teacher' && alert.studentUid !== uid) return;
      setActiveAlert(alert);
    });
  }, [uid]);

  useEffect(() => {
    if (!activeAlert) return;
    const timer = window.setTimeout(() => {
      setActiveAlert((cur) => (cur?.id === activeAlert.id ? null : cur));
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [activeAlert]);

  if (!activeAlert) return null;

  const senderTitle =
    activeAlert.senderRole === 'teacher'
      ? `${activeAlert.className || 'クラス'}の先生からメッセージ`
      : `${activeAlert.studentName}さんからメッセージ`;
  const topicMeta = activeAlert.topic ? CHAT_TOPIC_META[activeAlert.topic] : null;

  return (
    <div
      className="cchat-arrival-banner"
      role="status"
      aria-live="polite"
      data-testid="class-chat-arrival-banner"
    >
      <span
        className="w-10 h-10 rounded-full bg-[#06C755] text-white flex items-center justify-center shrink-0 shadow-md"
        aria-hidden="true"
      >
        <MessageCircle size={19} />
      </span>
      <button
        type="button"
        onClick={() => {
          const target = activeAlert;
          setActiveAlert(null);
          onOpenAlertChat?.(target);
        }}
        className="flex-1 min-w-0 text-left cursor-pointer"
      >
        <div className="flex items-center gap-1.5">
          <strong className="text-xs font-extrabold text-white truncate">
            {senderTitle}
          </strong>
          {topicMeta && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0"
              style={{ backgroundColor: topicMeta.bg, color: topicMeta.fg }}
            >
              {topicMeta.shortLabel}
            </span>
          )}
        </div>
        <span className="block text-xs text-white/90 truncate mt-0.5">
          {activeAlert.text}
        </span>
        <span className="block text-[10px] text-[#86EFAC] font-bold mt-0.5">
          タップして返信する →
        </span>
      </button>
      <button
        type="button"
        onClick={() => setActiveAlert(null)}
        aria-label="通知を閉じる"
        className="p-1.5 rounded-full text-white/75 hover:text-white hover:bg-white/10 shrink-0"
      >
        <X size={15} />
      </button>
    </div>
  );
}
