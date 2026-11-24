/**
 * ============================================================================
 * アプリ常駐チャット着信通知ホスト（リアルタイム監視 ＋ LINE風ポップアップ通知）
 * ============================================================================
 *
 * - ログイン中の生徒・先生どちらに対しても、メッセージが届いた瞬間に画面上部へ
 *   LINE風の着信バナーを表示し、タップ1回でそのトーク画面へジャンプできる。
 * - 同時に未読件数の合計を親（`App.tsx`）へ返し、下部ナビ「設定」のバッジに反映する。
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { MessageCircle, X } from 'lucide-react';
import { auth, FIREBASE_CONFIGURED } from '../../firebase';
import {
  subscribeIncomingChatAlerts,
  subscribeUserChatInbox,
} from './chatStore';
import type { IncomingClassChatAlert } from './chatTypes';
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
      setUid(u?.uid || '');
    });
  }, []);

  useEffect(() => {
    const unsubInbox = subscribeUserChatInbox({
      uid,
      onSummary: ({ totalUnread }) => {
        onUnreadTotalChange?.(totalUnread);
      },
    });
    return unsubInbox;
  }, [uid, onUnreadTotalChange]);

  useEffect(() => {
    const unsubAlert = subscribeIncomingChatAlerts((alert) => {
      setActiveAlert(alert);
    });
    return unsubAlert;
  }, []);

  useEffect(() => {
    if (!activeAlert) return;
    const timer = window.setTimeout(() => {
      setActiveAlert((cur) => (cur?.id === activeAlert.id ? null : cur));
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [activeAlert]);

  if (!activeAlert) return null;

  const senderTitle =
    activeAlert.senderRole === 'teacher'
      ? `${activeAlert.className || 'クラス'}の先生から新着メッセージ`
      : `${activeAlert.studentName}さんから新着メッセージ`;

  return (
    <div
      className="cchat-arrival-banner"
      role="status"
      aria-live="polite"
      data-testid="class-chat-arrival-banner"
    >
      <span
        className="w-9 h-9 rounded-full bg-[#06C755] text-white flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        <MessageCircle size={18} />
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
        <strong className="block text-xs font-extrabold text-white truncate">
          {senderTitle}
        </strong>
        <span className="block text-xs text-white/85 truncate mt-0.5">
          {activeAlert.text}
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
