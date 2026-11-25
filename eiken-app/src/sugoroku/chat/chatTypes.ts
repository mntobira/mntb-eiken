/**
 * ============================================================================
 * クラス内 1対1 LINE品質リアルタイムチャット — データ型・相談カテゴリ・リアクション定義
 * ============================================================================
 *
 * ■ LINE級の体験を支える拡張モデル
 * - 1クラス×1生徒ごとに決定論的ID `${classId}_${studentUid}` の非公開1対1トークルームを構築。
 * - メッセージ単位で以下をフルサポート：
 *   1) 相談トピックタグ（質問・宿題相談・ペース調整・学習報告・声掛け）
 *   2) 引用リプライ（`replyToId` / `replyToSenderName` / `replyToText`）
 *   3) 英検学習単元カードの添付（`linkedChapterId` / `linkedChapterTitle` → タップで演習へ直行）
 *   4) LINE風ワンタップリアクション（👍 / 👏 / 🔥 / 💡 / 🙏）
 *   5) 送信取り消し（`unsent: true`）
 *   6) スレッド単位の「要返信・相談中 ⇄ 解決済み」ステータス（先生の対応漏れゼロ）
 */

export type ClassChatSenderRole = 'student' | 'teacher';

export type ClassChatTopicTag =
  | 'question'
  | 'homework'
  | 'pace'
  | 'report'
  | 'encourage';

export type ClassChatReactionKey = 'thumbsup' | 'clap' | 'fire' | 'bulb' | 'pray';

export type ClassChatResolutionStatus = 'open' | 'resolved';

export const CHAT_TOPIC_META: Record<
  ClassChatTopicTag,
  { label: string; shortLabel: string; bg: string; fg: string; border: string }
> = {
  question: {
    label: '問題の質問',
    shortLabel: '質問',
    bg: '#EFF6FF',
    fg: '#1D4ED8',
    border: '#BFDBFE',
  },
  homework: {
    label: '宿題・やり方相談',
    shortLabel: '宿題相談',
    bg: '#F0FDF4',
    fg: '#15803D',
    border: '#BBF7D0',
  },
  pace: {
    label: '部活・ペース調整',
    shortLabel: 'ペース調整',
    bg: '#FFFBEB',
    fg: '#B45309',
    border: '#FDE68A',
  },
  report: {
    label: '完了・学習報告',
    shortLabel: '完了報告',
    bg: '#F5F3FF',
    fg: '#6D28D9',
    border: '#DDD6FE',
  },
  encourage: {
    label: '先生からの声掛け・連絡',
    shortLabel: '先生連絡',
    bg: '#ECFDF5',
    fg: '#047857',
    border: '#A7F3D0',
  },
};

export const CHAT_REACTIONS: ReadonlyArray<{
  key: ClassChatReactionKey;
  emoji: string;
  label: string;
}> = [
  { key: 'thumbsup', emoji: '👍', label: '了解！' },
  { key: 'clap', emoji: '👏', label: 'すごい！' },
  { key: 'fire', emoji: '🔥', label: 'ファイト！' },
  { key: 'bulb', emoji: '💡', label: 'なるほど！' },
  { key: 'pray', emoji: '🙏', label: 'ありがとう！' },
];

/** LINEスタンプ感覚でワンタップ送信できる学習リアクションスタンプ */
export const CHAT_QUICK_STAMPS: ReadonlyArray<{
  id: string;
  emoji: string;
  label: string;
  text: string;
  topic?: ClassChatTopicTag;
}> = [
  { id: 'done_today', emoji: '🎉', label: '今日分クリア！', text: '🎉 今日の宿題ノルマ終わりました！', topic: 'report' },
  { id: 'understood', emoji: '💡', label: 'わかりました！', text: '💡 解説ありがとうございました！スッキリわかりました！' },
  { id: 'help_q', emoji: '🙋', label: '質問があります', text: '🙋 わからない問題があるので質問させてください！', topic: 'question' },
  { id: 'club_busy', emoji: '🏃', label: '部活後にやります', text: '🏃 今日は部活が終わってから夜に取り組みます！', topic: 'pace' },
  { id: 'praise', emoji: '👏', label: 'ナイスファイト！', text: '👏 今週もコツコツ続けられていて素晴らしいペースです！', topic: 'encourage' },
  { id: 'check_ok', emoji: '✅', label: '確認しました！', text: '✅ 学習状況を確認しました！この調子で進めよう！', topic: 'encourage' },
];

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
  /** 質問・相談スレッドの対応状態（open: 相談中/要対応, resolved: 解決済み） */
  resolutionStatus?: ClassChatResolutionStatus;
  /** ピン留めされた大切な約束・今週の目標メッセージ */
  pinnedNotice?: string;
  /** 最新メッセージの相談種別 */
  lastTopic?: ClassChatTopicTag;
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
  /** 相談トピック（質問・宿題相談・ペース調整・完了報告・声掛け） */
  topic?: ClassChatTopicTag;
  /** 引用リプライ元メッセージ情報 */
  replyToId?: string;
  replyToSenderName?: string;
  replyToText?: string;
  /** 添付されたアプリ内学習単元リンク（ワンタップでその単元の演習を開ける） */
  linkedChapterId?: string;
  linkedChapterTitle?: string;
  /** 生徒・先生それぞれのリアクション（例: `{ student: 'pray', teacher: 'clap' }`） */
  reactions?: Partial<Record<ClassChatSenderRole, ClassChatReactionKey>>;
  /** 送信取り消し済みフラグ */
  unsent?: boolean;
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
  topic?: ClassChatTopicTag;
  createdAt: number;
}

export function buildClassChatThreadId(classId: string, studentUid: string): string {
  return `${classId.trim()}_${studentUid.trim()}`;
}

export const STUDENT_CHAT_QUICK_TEMPLATES: ReadonlyArray<{
  label: string;
  text: string;
  topic: ClassChatTopicTag;
}> = [
  {
    label: '今週の宿題の進め方を相談',
    text: '今週の宿題の進め方と優先順位を相談したいです！',
    topic: 'homework',
  },
  {
    label: 'わからない問題を質問',
    text: '解いていてわからなかった問題があるので、考え方を教えてほしいです！',
    topic: 'question',
  },
  {
    label: '部活・テストでペース調整',
    text: '今週は部活・定期テストがあるので、1日の問題数ペースを少し調整したいです。',
    topic: 'pace',
  },
  {
    label: '今日の課題完了を報告',
    text: '今日の目標分まで解き終わりました！間違えた問題は解説を読んで復習しました！',
    topic: 'report',
  },
];

export const TEACHER_CHAT_QUICK_TEMPLATES: ReadonlyArray<{
  label: string;
  text: string;
  topic: ClassChatTopicTag;
}> = [
  {
    label: '順調ペースを褒める',
    text: '今週もいいペースで進められていますね！間違えた問題の2周目までできるとさらに定着します！',
    topic: 'encourage',
  },
  {
    label: '5分だけ再開の声掛け',
    text: '部活お疲れさま！今日はまず単語かリスニング第1部を5分（5〜10問）だけ開いてみよう！',
    topic: 'encourage',
  },
  {
    label: '新しい課題反映のお知らせ',
    text: '新しい課題をセットしました！タイトル画面とホーム一番上からすぐ始められるので確認してね！',
    topic: 'homework',
  },
  {
    label: '質問への返信テンプレ',
    text: '質問ありがとう！まずは設問のキーワードに印をつけて、本文の言い換え表現を探すのがコツだよ。下の単元カードからもう一度1問だけ解き直してみよう！',
    topic: 'question',
  },
];
