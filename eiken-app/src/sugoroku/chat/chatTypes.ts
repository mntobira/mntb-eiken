/**
 * ============================================================================
 * クラス内 1対1 LINE風チャット — データ型定義
 * ============================================================================
 *
 * ■ 設計方針
 * - 1クラス×1生徒ごとに決定論的ID `${classId}_${studentUid}` のトークルームを作成。
 * - Firestore 上は `eiken_class_chat_threads/${classId}_${studentUid}` とその配下
 *   `messages/${messageId}` に保存（`firestoreMetered.ts` が自動で `eiken_` を付与）。
 * - 同じクラスの他の生徒からは一切閲覧できない（本人＋担当講師/塾スタッフのみ）。
 * - 既読状態（`teacherLastReadAt` / `studentLastReadAt`）と未読件数（`unreadByTeacher` /
 *   `unreadByStudent`）により、LINE同様の「既読」表示と未読バッジ・着信通知を実現する。
 */

export type ClassChatSenderRole = 'student' | 'teacher';

export interface ClassChatThreadDoc {
  id: string;
  classId: string;
  className: string;
  schoolName: string;
  teacherUid: string;
  studentUid: string;
  studentName: string;
  lastMessageText: string;
  lastSenderRole: ClassChatSenderRole;
  lastSenderName: string;
  lastMessageAt: number;
  unreadByTeacher: number;
  unreadByStudent: number;
  teacherLastReadAt: number;
  studentLastReadAt: number;
  updatedAt: number;
}

export interface ClassChatMessageDoc {
  id: string;
  threadId: string;
  classId: string;
  studentUid: string;
  senderUid: string;
  senderRole: ClassChatSenderRole;
  senderName: string;
  text: string;
  createdAt: number;
}

export interface IncomingClassChatAlert {
  id: string;
  threadId: string;
  classId: string;
  className: string;
  studentUid: string;
  studentName: string;
  senderRole: ClassChatSenderRole;
  senderName: string;
  text: string;
  createdAt: number;
}

export function buildClassChatThreadId(classId: string, studentUid: string): string {
  return `${classId.trim()}_${studentUid.trim()}`;
}

export const STUDENT_CHAT_QUICK_TEMPLATES: readonly string[] = [
  '今週の宿題の進め方を相談したいです！',
  'わからない問題があるので教えてほしいです',
  '部活・テスト期間なので今週のペースを調整したいです',
  '今日のノルマ終わりました！確認お願いします！',
];

export const TEACHER_CHAT_QUICK_TEMPLATES: readonly string[] = [
  '今週もいいペースで進められていますね！この調子でいこう！',
  '部活お疲れさま！今日はまず単語かリスニング5分だけ開いてみよう！',
  '新しい課題をアプリに反映しました。ホーム画面から確認してみてね！',
  'わからない問題があれば、単元名かスクショの内容をここで気軽に聞いてね！',
];
