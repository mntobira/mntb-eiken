/**
 * ============================================================================
 * クラス内 1対1 LINE品質リアルタイムチャット — セキュリティ強化版ストア
 * ============================================================================
 *
 * ■ セキュリティ設計（共有端末・なりすまし・改ざん・情報漏洩対策）
 * 1. UID完全分離ストレージ：
 *    塾の共有iPad・学校の共有PC・兄弟端末でも別アカウントのトーク履歴が一切見えないよう、
 *    localStorage キーを `auth.currentUser.uid` 単位で厳格に分離（未ログイン時は読み書き拒否、
 *    旧グローバルキーは起動時に自動パージ）。
 * 2. プロトタイプ汚染＆制御文字サニタイズ：
 *    `__proto__` / `constructor` / `prototype` キーを拒否し、NUL等の不可視制御文字を除去。
 * 3. Firestore ゼロトラスト整合：
 *    - スレッド作成時は `eiken_classrooms/{classId}.teacherUid` と一致する正規 `teacherUid` を解決
 *    - 送信取消（`unsendClassChatMessage`）時は `unsent: true` だけでなく、元テキスト・引用・
 *      添付単元・リアクションを Firestore ドキュメント上からも完全消去（DevTools覗き見防止）
 *    - 生徒側の受信トレイ監視は在籍中クラス（`loadJukuMemberships`）の個別スレッドのみ購読し、
 *      退会済みクラスへのアクセス拒否（permission-denied）にも完全対応
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from '../../utils/firestoreMetered';
import { auth, db, FIREBASE_CONFIGURED } from '../../firebase';
import { CLASSROOMS_COLLECTION } from '../../utils/classroomShared';
import { loadJukuMemberships, subscribeJukuMemberships } from '../../utils/classAssignments';
import { safeLocalStorage } from '../../utils/safeLocalStorage';
import { isValidEikenChapterId } from '../homework/chapterTotals';
import { checkClassChatSafety } from './chatSafety';
import {
  buildClassChatThreadId,
  CHAT_REACTIONS,
  CHAT_TOPIC_META,
  type ClassChatMessageDoc,
  type ClassChatReactionKey,
  type ClassChatResolutionStatus,
  type ClassChatSenderRole,
  type ClassChatThreadDoc,
  type ClassChatTopicTag,
  type IncomingClassChatAlert,
} from './chatTypes';

export const CLASS_CHAT_THREADS_COLLECTION = 'class_chat_threads';
export const CLASS_CHAT_MESSAGES_SUBCOLLECTION = 'messages';
export const CLASS_CHAT_MAX_MESSAGE_LENGTH = 1000;
export const UNSENT_TOMBSTONE_TEXT = 'メッセージの送信を取り消しました';

const LEGACY_UNSCOPED_THREADS_KEY = 'mntb_eiken_class_chat_threads_v1';
const SCOPED_THREADS_PREFIX = 'mntb_eiken_class_chat_threads_v2:';
const SCOPED_MESSAGES_PREFIX = 'mntb_eiken_class_chat_msgs_v2:';
const LOCAL_SOUND_PREF_KEY = 'mntb_eiken_class_chat_sound_v1';
const LOCAL_EVENT_NAME = 'mntb:class-chat-updated';

const SAFE_ID_RE = /^[A-Za-z0-9:._-]{1,210}$/;
// 改行・タブ以外の制御文字を除去
const UNSAFE_CTRL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

type LocalChatEventDetail = {
  threadId?: string;
  incomingAlert?: IncomingClassChatAlert;
};

export interface ChatStorageScopeOptions {
  isDemoMode?: boolean;
  ownerUid?: string;
}

function isSafeRecordKey(key: string): boolean {
  return (
    Boolean(key) &&
    key !== '__proto__' &&
    key !== 'constructor' &&
    key !== 'prototype' &&
    SAFE_ID_RE.test(key)
  );
}

function sanitizeChatText(raw: string, maxLen: number): string {
  return raw.replace(UNSAFE_CTRL_CHARS_RE, '').trim().slice(0, maxLen);
}

// Node(SSR/Vitest)環境など globalThis.localStorage が未定義の場合のメモリフォールバック
const memoryStore = new Map<string, string>();
function getChatStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
  keys: () => string[];
} {
  try {
    const raw = (globalThis as { localStorage?: Storage }).localStorage;
    if (raw && typeof raw.getItem === 'function' && typeof raw.setItem === 'function') {
      const ls = safeLocalStorage();
      if (ls) {
        return {
          getItem: (k: string) => ls.getItem(k),
          setItem: (k: string, v: string) => ls.setItem(k, v),
          removeItem: (k: string) => {
            try {
              ls.removeItem(k);
            } catch {
              /* ignore */
            }
          },
          keys: () => {
            const out: string[] = [];
            try {
              for (let i = 0; i < raw.length; i += 1) {
                const k = raw.key(i);
                if (k) out.push(k);
              }
            } catch {
              /* ignore */
            }
            return out;
          },
        };
      }
    }
  } catch {
    /* ignore */
  }
  return {
    getItem: (k: string) => memoryStore.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memoryStore.set(k, v);
    },
    removeItem: (k: string) => {
      memoryStore.delete(k);
    },
    keys: () => [...memoryStore.keys()],
  };
}

let legacyPurged = false;
function purgeLegacyUnscopedCacheOnce(): void {
  if (legacyPurged) return;
  legacyPurged = true;
  try {
    getChatStorage().removeItem(LEGACY_UNSCOPED_THREADS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 現在のストレージ分離スコープを解決する。
 * - `isDemoMode: true` または Firebase 未構成環境（単体テスト等）では `'demo'` スコープ
 * - 本番/実データ環境では `ownerUid || auth.currentUser?.uid`。未ログインなら `null`（読み書き禁止）
 */
function resolveChatStorageScope(opts?: ChatStorageScopeOptions): string | null {
  purgeLegacyUnscopedCacheOnce();
  if (opts?.isDemoMode) return 'demo';
  const explicitUid = opts?.ownerUid?.trim();
  if (explicitUid && isSafeRecordKey(explicitUid)) return `u_${explicitUid}`;
  const currentUid = auth.currentUser?.uid?.trim();
  if (currentUid && isSafeRecordKey(currentUid)) return `u_${currentUid}`;
  if (!FIREBASE_CONFIGURED) return 'demo';
  return null;
}

const alertSubscribers = new Set<(alert: IncomingClassChatAlert) => void>();
const recentlyEmittedAlertIds = new Set<string>();

/** ログアウト・アカウント切替時にランタイム通知履歴をクリアする */
export function clearChatRuntimeSessionCache(): void {
  recentlyEmittedAlertIds.clear();
}

/** 共有端末でのログアウト時に、指定UIDのローカルチャットキャッシュを完全消去する */
export function purgeUserChatLocalCache(uid: string | null | undefined): void {
  clearChatRuntimeSessionCache();
  const cleanUid = (uid || '').trim();
  if (!cleanUid || !isSafeRecordKey(cleanUid)) return;
  const storage = getChatStorage();
  const scope = `u_${cleanUid}`;
  const threadKey = `${SCOPED_THREADS_PREFIX}${scope}`;
  const msgPrefix = `${SCOPED_MESSAGES_PREFIX}${scope}:`;
  storage.removeItem(threadKey);
  storage.removeItem(LEGACY_UNSCOPED_THREADS_KEY);
  for (const k of storage.keys()) {
    if (k.startsWith(msgPrefix) || k.startsWith('mntb_eiken_class_chat_msgs_v1:')) {
      storage.removeItem(k);
    }
  }
}

export function subscribeIncomingChatAlerts(
  listener: (alert: IncomingClassChatAlert) => void,
): () => void {
  alertSubscribers.add(listener);
  return () => {
    alertSubscribers.delete(listener);
  };
}

export function isChatSoundEnabled(): boolean {
  try {
    return getChatStorage().getItem(LOCAL_SOUND_PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setChatSoundEnabled(enabled: boolean): void {
  try {
    getChatStorage().setItem(LOCAL_SOUND_PREF_KEY, enabled ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

/** Web Audio API による心地よい2音着信チャイム（再生後 AudioContext を確実にクローズしリーク防止） */
export function playChatArrivalChime(): void {
  if (typeof window === 'undefined' || !isChatSoundEnabled()) return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [
      { freq: 783.99, start: 0, dur: 0.11 }, // G5
      { freq: 1046.5, start: 0.09, dur: 0.18 }, // C6
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.start);
      gain.gain.setValueAtTime(0.0001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.085, now + n.start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    }
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 500);
  } catch {
    /* 自動再生制限時は静かにスキップ */
  }
}

function emitIncomingAlert(alert: IncomingClassChatAlert): void {
  if (recentlyEmittedAlertIds.has(alert.id)) return;
  recentlyEmittedAlertIds.add(alert.id);
  if (recentlyEmittedAlertIds.size > 100) {
    const first = recentlyEmittedAlertIds.values().next().value;
    if (first) recentlyEmittedAlertIds.delete(first);
  }

  playChatArrivalChime();
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([35, 45, 35]);
    }
  } catch {
    /* ignore */
  }

  for (const fn of alertSubscribers) {
    try {
      fn(alert);
    } catch {
      /* ignore listener errors */
    }
  }
  maybeFireBrowserNotification(alert);
}

/** ブラウザ通知の権限状態を安全に取得 */
export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

/** ユーザーのボタン操作からブラウザ通知の許可をリクエスト */
export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function maybeFireBrowserNotification(alert: IncomingClassChatAlert): void {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const topicPrefix = alert.topic ? `【${CHAT_TOPIC_META[alert.topic].shortLabel}】` : '';
    const title =
      alert.senderRole === 'teacher'
        ? `${sanitizeChatText(alert.className || 'クラス', 40)}の先生から新着メッセージ`
        : `${sanitizeChatText(alert.studentName, 30)}さんからメッセージ`;
    // ロック画面・共有画面での覗き見リスクを抑えるため60文字で安全に丸める
    const safeBody = sanitizeChatText(`${topicPrefix}${alert.text}`, 60);
    const n = new Notification(title, {
      body: safeBody,
      tag: `mntb-chat-${alert.threadId}`,
    });
    n.onclick = () => {
      try {
        window.focus();
        n.close();
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* Safari PWA / restricted context */
  }
}

function dispatchLocalChatUpdated(detail: LocalChatEventDetail = {}): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent<LocalChatEventDetail>(LOCAL_EVENT_NAME, { detail }));
  } catch {
    /* ignore */
  }
}

// ============================================================================
// UIDスコープ分離 LocalStorage ミラー（共有端末漏洩・プロトタイプ汚染防止）
// ============================================================================

export function loadLocalChatThreads(
  opts?: ChatStorageScopeOptions,
): Record<string, ClassChatThreadDoc> {
  const scope = resolveChatStorageScope(opts);
  if (!scope) return {};
  const storage = getChatStorage();
  try {
    const raw = storage.getItem(`${SCOPED_THREADS_PREFIX}${scope}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const safeOut: Record<string, ClassChatThreadDoc> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isSafeRecordKey(k) || !v || typeof v !== 'object') continue;
      const docParsed = parseThreadDoc(k, v as Record<string, unknown>);
      if (docParsed) safeOut[k] = docParsed;
    }
    return safeOut;
  } catch {
    return {};
  }
}

function saveLocalChatThreads(
  map: Record<string, ClassChatThreadDoc>,
  opts?: ChatStorageScopeOptions,
): void {
  const scope = resolveChatStorageScope(opts);
  if (!scope) return;
  const storage = getChatStorage();
  try {
    const clean: Record<string, ClassChatThreadDoc> = {};
    for (const [k, v] of Object.entries(map)) {
      if (isSafeRecordKey(k) && v) clean[k] = v;
    }
    storage.setItem(`${SCOPED_THREADS_PREFIX}${scope}`, JSON.stringify(clean));
  } catch {
    /* ignore quota */
  }
}

export function upsertLocalChatThread(
  thread: ClassChatThreadDoc,
  opts?: ChatStorageScopeOptions,
): void {
  if (!isSafeRecordKey(thread.id)) return;
  const all = loadLocalChatThreads(opts);
  all[thread.id] = thread;
  saveLocalChatThreads(all, opts);
}

export function loadLocalChatMessages(
  threadId: string,
  opts?: ChatStorageScopeOptions,
): ClassChatMessageDoc[] {
  if (!isSafeRecordKey(threadId)) return [];
  const scope = resolveChatStorageScope(opts);
  if (!scope) return [];
  const storage = getChatStorage();
  try {
    const raw = storage.getItem(`${SCOPED_MESSAGES_PREFIX}${scope}:${threadId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ClassChatMessageDoc[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const id = typeof rec.id === 'string' && isSafeRecordKey(rec.id) ? rec.id : '';
      if (!id) continue;
      const msg = parseMessageDoc(id, threadId, rec);
      if (msg) out.push(msg);
    }
    return out.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

function saveLocalChatMessages(
  threadId: string,
  messages: ClassChatMessageDoc[],
  opts?: ChatStorageScopeOptions,
): void {
  if (!isSafeRecordKey(threadId)) return;
  const scope = resolveChatStorageScope(opts);
  if (!scope) return;
  const storage = getChatStorage();
  try {
    const trimmed = [...messages]
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-200);
    storage.setItem(`${SCOPED_MESSAGES_PREFIX}${scope}:${threadId}`, JSON.stringify(trimmed));
  } catch {
    /* ignore quota */
  }
}

function upsertLocalChatMessage(
  msg: ClassChatMessageDoc,
  opts?: ChatStorageScopeOptions,
): void {
  if (!isSafeRecordKey(msg.threadId) || !isSafeRecordKey(msg.id)) return;
  const existing = loadLocalChatMessages(msg.threadId, opts);
  const idx = existing.findIndex((m) => m.id === msg.id);
  if (idx >= 0) {
    const next = [...existing];
    next[idx] = msg;
    saveLocalChatMessages(msg.threadId, next, opts);
  } else {
    saveLocalChatMessages(msg.threadId, [...existing, msg], opts);
  }
}

/** デモモード用：リアルな生徒×講師のLINE相談サンプルスレッドを初期投入（demoスコープ専用） */
export function ensureDemoChatSeed(params: {
  classId: string;
  className: string;
  schoolName: string;
  nowMs?: number;
}): void {
  const scopeOpts: ChatStorageScopeOptions = { isDemoMode: true };
  const all = loadLocalChatThreads(scopeOpts);
  const rikuThreadId = buildClassChatThreadId(params.classId, 'stu_yamamoto_riku');
  if (all[rikuThreadId]) return;

  const now = params.nowMs ?? Date.now();
  const sampleThreads: Array<{
    studentUid: string;
    studentName: string;
    unreadByTeacher: number;
    teacherLastReadAt: number;
    studentLastReadAt: number;
    resolutionStatus: ClassChatResolutionStatus;
    pinnedNotice?: string;
    messages: Array<{
      id: string;
      senderRole: ClassChatSenderRole;
      senderName: string;
      text: string;
      offsetMin: number;
      topic?: ClassChatTopicTag;
      replyToId?: string;
      replyToSenderName?: string;
      replyToText?: string;
      linkedChapterId?: string;
      linkedChapterTitle?: string;
      reactions?: Partial<Record<ClassChatSenderRole, ClassChatReactionKey>>;
    }>;
  }> = [
    {
      studentUid: 'stu_yamamoto_riku',
      studentName: '山本 陸（高2・野球部）',
      unreadByTeacher: 1,
      teacherLastReadAt: now - 55 * 60_000,
      studentLastReadAt: now - 10 * 60_000,
      resolutionStatus: 'open',
      pinnedNotice: '今週の約束：部活後はリスニング第1部を1日10分（10問）ずつ進める！',
      messages: [
        {
          id: 'demo_msg_stu_yamamoto_riku_1',
          senderRole: 'teacher',
          senderName: '西 講師',
          text: '陸くん、週末の遠征お疲れさま！今週の英検2級 第1回課題、まずは下のリスニング第1部だけでも今日10分開いてみよう！',
          offsetMin: -60,
          topic: 'encourage',
          linkedChapterId: 'eiken_2_listening_r01_part1',
          linkedChapterTitle: '英検2級 第1回 リスニング 第1部',
          reactions: { student: 'pray' },
        },
        {
          id: 'demo_msg_stu_yamamoto_riku_2',
          senderRole: 'student',
          senderName: '山本 陸',
          text: 'ありがとうございます！今日部活が19時に終わるので、帰りの電車でリスニング第1部やります！あと大問3の長文の時間配分も相談したいです。',
          offsetMin: -12,
          topic: 'question',
          replyToId: 'demo_msg_stu_yamamoto_riku_1',
          replyToSenderName: '西 講師',
          replyToText:
            '陸くん、週末の遠征お疲れさま！今週の英検2級 第1回課題、まずは下のリスニング第1部だけでも今日10分開いてみよう！',
        },
      ],
    },
    {
      studentUid: 'stu_takahashi_haruto',
      studentName: '高橋 陽斗（高2・サッカー部）',
      unreadByTeacher: 0,
      teacherLastReadAt: now - 90 * 60_000,
      studentLastReadAt: now - 85 * 60_000,
      resolutionStatus: 'resolved',
      pinnedNotice: '目標：5月S-CBTで2級合格（間違えた語彙は必ず2周目まで！）',
      messages: [
        {
          id: 'demo_msg_stu_takahashi_haruto_1',
          senderRole: 'student',
          senderName: '高橋 陽斗',
          text: '先生、今週分の第1回筆記とリスニング1周終わりました！間違えた語彙だけもう1周やります！',
          offsetMin: -120,
          topic: 'report',
          reactions: { teacher: 'clap' },
        },
        {
          id: 'demo_msg_stu_takahashi_haruto_2',
          senderRole: 'teacher',
          senderName: '西 講師',
          text: '陽斗くん素晴らしいペース！間違えた問題の2周目が一番スコアが伸びるから、その調子で進めよう！',
          offsetMin: -95,
          topic: 'encourage',
          replyToId: 'demo_msg_stu_takahashi_haruto_1',
          replyToSenderName: '高橋 陽斗',
          replyToText:
            '先生、今週分の第1回筆記とリスニング1周終わりました！間違えた語彙だけもう1周やります！',
          reactions: { student: 'fire' },
        },
      ],
    },
  ];

  for (const item of sampleThreads) {
    const threadId = buildClassChatThreadId(params.classId, item.studentUid);
    const msgs: ClassChatMessageDoc[] = item.messages.map((m) => ({
      id: m.id,
      threadId,
      classId: params.classId,
      studentUid: item.studentUid,
      senderUid: m.senderRole === 'teacher' ? 'teacher_sugoroku_nishi' : item.studentUid,
      senderRole: m.senderRole,
      senderName: m.senderName,
      text: m.text,
      createdAt: now + m.offsetMin * 60_000,
      ...(m.topic ? { topic: m.topic } : {}),
      ...(m.replyToId ? { replyToId: m.replyToId } : {}),
      ...(m.replyToSenderName ? { replyToSenderName: m.replyToSenderName } : {}),
      ...(m.replyToText ? { replyToText: m.replyToText } : {}),
      ...(m.linkedChapterId ? { linkedChapterId: m.linkedChapterId } : {}),
      ...(m.linkedChapterTitle ? { linkedChapterTitle: m.linkedChapterTitle } : {}),
      ...(m.reactions ? { reactions: m.reactions } : {}),
    }));
    const last = msgs[msgs.length - 1];
    const thread: ClassChatThreadDoc = {
      id: threadId,
      classId: params.classId,
      className: params.className,
      schoolName: params.schoolName,
      teacherUid: 'teacher_sugoroku_nishi',
      studentUid: item.studentUid,
      studentName: item.studentName,
      lastMessageText: last.text,
      lastSenderRole: last.senderRole,
      lastSenderName: last.senderName,
      lastMessageAt: last.createdAt,
      unreadByTeacher: item.unreadByTeacher,
      unreadByStudent: 0,
      teacherLastReadAt: item.teacherLastReadAt,
      studentLastReadAt: item.studentLastReadAt,
      resolutionStatus: item.resolutionStatus,
      ...(item.pinnedNotice ? { pinnedNotice: item.pinnedNotice } : {}),
      ...(last.topic ? { lastTopic: last.topic } : {}),
      updatedAt: last.createdAt,
    };
    all[threadId] = thread;
    saveLocalChatMessages(threadId, msgs, scopeOpts);
  }
  saveLocalChatThreads(all, scopeOpts);
}

// ============================================================================
// 正規化・検証ヘルパー
// ============================================================================

const VALID_TOPICS = new Set<string>(['question', 'homework', 'pace', 'report', 'encourage']);
const VALID_REACTIONS = new Set<string>(CHAT_REACTIONS.map((r) => r.key));
const SAFE_CHAPTER_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

function toMillisSafe(val: unknown, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (
    val &&
    typeof val === 'object' &&
    'toMillis' in val &&
    typeof (val as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (val as { toMillis: () => number }).toMillis();
  }
  return fallback;
}

function parseThreadDoc(id: string, raw: Record<string, unknown>): ClassChatThreadDoc | null {
  if (!isSafeRecordKey(id)) return null;
  const classId = typeof raw.classId === 'string' ? raw.classId : '';
  const studentUid = typeof raw.studentUid === 'string' ? raw.studentUid : '';
  if (!isSafeRecordKey(classId) || !isSafeRecordKey(studentUid)) return null;
  if (id !== `${classId}_${studentUid}`) return null;

  const now = Date.now();
  const resolutionStatus: ClassChatResolutionStatus | undefined =
    raw.resolutionStatus === 'open' || raw.resolutionStatus === 'resolved'
      ? raw.resolutionStatus
      : undefined;
  const lastTopic =
    typeof raw.lastTopic === 'string' && VALID_TOPICS.has(raw.lastTopic)
      ? (raw.lastTopic as ClassChatTopicTag)
      : undefined;
  const pinnedNotice =
    typeof raw.pinnedNotice === 'string' && sanitizeChatText(raw.pinnedNotice, 300)
      ? sanitizeChatText(raw.pinnedNotice, 300)
      : undefined;

  return {
    id,
    classId,
    className: typeof raw.className === 'string' ? sanitizeChatText(raw.className, 80) : '',
    schoolName: typeof raw.schoolName === 'string' ? sanitizeChatText(raw.schoolName, 80) : '',
    teacherUid: typeof raw.teacherUid === 'string' ? sanitizeChatText(raw.teacherUid, 128) : '',
    studentUid,
    studentName:
      typeof raw.studentName === 'string' && sanitizeChatText(raw.studentName, 40)
        ? sanitizeChatText(raw.studentName, 40)
        : '生徒',
    lastMessageText:
      typeof raw.lastMessageText === 'string'
        ? sanitizeChatText(raw.lastMessageText, CLASS_CHAT_MAX_MESSAGE_LENGTH)
        : '',
    lastSenderRole: raw.lastSenderRole === 'teacher' ? 'teacher' : 'student',
    lastSenderName:
      typeof raw.lastSenderName === 'string' ? sanitizeChatText(raw.lastSenderName, 40) : '',
    lastMessageAt: toMillisSafe(raw.lastMessageAt, now),
    unreadByTeacher:
      typeof raw.unreadByTeacher === 'number' ? Math.max(0, Math.min(9999, raw.unreadByTeacher)) : 0,
    unreadByStudent:
      typeof raw.unreadByStudent === 'number' ? Math.max(0, Math.min(9999, raw.unreadByStudent)) : 0,
    teacherLastReadAt: toMillisSafe(raw.teacherLastReadAt, 0),
    studentLastReadAt: toMillisSafe(raw.studentLastReadAt, 0),
    ...(resolutionStatus ? { resolutionStatus } : {}),
    ...(pinnedNotice ? { pinnedNotice } : {}),
    ...(lastTopic ? { lastTopic } : {}),
    updatedAt: toMillisSafe(raw.updatedAt, now),
  };
}

function parseMessageDoc(
  id: string,
  threadId: string,
  raw: Record<string, unknown>,
): ClassChatMessageDoc | null {
  if (!isSafeRecordKey(id) || !isSafeRecordKey(threadId)) return null;
  const isUnsent = raw.unsent === true;
  const rawText = typeof raw.text === 'string' ? sanitizeChatText(raw.text, CLASS_CHAT_MAX_MESSAGE_LENGTH) : '';
  const text = isUnsent ? UNSENT_TOMBSTONE_TEXT : rawText;
  if (!text) return null;

  const topic =
    typeof raw.topic === 'string' && VALID_TOPICS.has(raw.topic)
      ? (raw.topic as ClassChatTopicTag)
      : undefined;

  let reactions: Partial<Record<ClassChatSenderRole, ClassChatReactionKey>> | undefined;
  if (!isUnsent && raw.reactions && typeof raw.reactions === 'object' && !Array.isArray(raw.reactions)) {
    const rObj = raw.reactions as Record<string, unknown>;
    const cleaned: Partial<Record<ClassChatSenderRole, ClassChatReactionKey>> = {};
    if (typeof rObj.student === 'string' && VALID_REACTIONS.has(rObj.student)) {
      cleaned.student = rObj.student as ClassChatReactionKey;
    }
    if (typeof rObj.teacher === 'string' && VALID_REACTIONS.has(rObj.teacher)) {
      cleaned.teacher = rObj.teacher as ClassChatReactionKey;
    }
    if (Object.keys(cleaned).length > 0) reactions = cleaned;
  }

  const rawChapterId =
    !isUnsent && typeof raw.linkedChapterId === 'string' && SAFE_CHAPTER_ID_RE.test(raw.linkedChapterId)
      ? raw.linkedChapterId
      : undefined;

  return {
    id,
    threadId,
    classId: typeof raw.classId === 'string' ? sanitizeChatText(raw.classId, 80) : '',
    studentUid: typeof raw.studentUid === 'string' ? sanitizeChatText(raw.studentUid, 128) : '',
    senderUid: typeof raw.senderUid === 'string' ? sanitizeChatText(raw.senderUid, 128) : '',
    senderRole: raw.senderRole === 'teacher' ? 'teacher' : 'student',
    senderName: typeof raw.senderName === 'string' ? sanitizeChatText(raw.senderName, 40) : '',
    text,
    createdAt: toMillisSafe(raw.createdAt, Date.now()),
    ...(topic ? { topic } : {}),
    ...(!isUnsent && typeof raw.replyToId === 'string' && isSafeRecordKey(raw.replyToId)
      ? { replyToId: raw.replyToId.slice(0, 128) }
      : {}),
    ...(!isUnsent && typeof raw.replyToSenderName === 'string' && raw.replyToSenderName
      ? { replyToSenderName: sanitizeChatText(raw.replyToSenderName, 40) }
      : {}),
    ...(!isUnsent && typeof raw.replyToText === 'string' && raw.replyToText
      ? { replyToText: sanitizeChatText(raw.replyToText, 300) }
      : {}),
    ...(rawChapterId ? { linkedChapterId: rawChapterId } : {}),
    ...(rawChapterId && typeof raw.linkedChapterTitle === 'string' && raw.linkedChapterTitle
      ? { linkedChapterTitle: sanitizeChatText(raw.linkedChapterTitle, 120) }
      : {}),
    ...(reactions ? { reactions } : {}),
    ...(isUnsent ? { unsent: true } : {}),
  };
}

/** Firestore が undefined フィールドを拒否しないようクリーンアップする */
function stripUndefined<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v !== undefined && isSafeRecordKey(k)) out[k] = v;
  }
  return out as T;
}

// ============================================================================
// メッセージ送信・リアクション・送信取消・ステータス＆ピン留め・既読更新
// ============================================================================

export interface SendClassChatMessageInput {
  classId: string;
  className: string;
  schoolName?: string;
  teacherUid: string;
  studentUid: string;
  studentName: string;
  senderRole: ClassChatSenderRole;
  senderName: string;
  text: string;
  topic?: ClassChatTopicTag;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  } | null;
  linkedChapter?: {
    id: string;
    title: string;
  } | null;
  isDemoMode?: boolean;
}

export async function sendClassChatMessage(
  input: SendClassChatMessageInput,
): Promise<ClassChatMessageDoc> {
  const trimmed = sanitizeChatText(input.text, CLASS_CHAT_MAX_MESSAGE_LENGTH);
  if (!trimmed) {
    throw new Error('メッセージを入力してください。');
  }
  if (!isSafeRecordKey(input.classId) || !isSafeRecordKey(input.studentUid)) {
    throw new Error('不正なクラスまたは生徒IDです。');
  }
  const safety = checkClassChatSafety(trimmed);
  if (!safety.ok) {
    throw new Error(safety.message || '安全ガイドラインにより送信できません。');
  }

  const scopeOpts: ChatStorageScopeOptions = { isDemoMode: input.isDemoMode };
  const threadId = buildClassChatThreadId(input.classId, input.studentUid);
  const localExisting = loadLocalChatThreads(scopeOpts)[threadId];
  const now = Math.max(Date.now(), (localExisting?.lastMessageAt ?? 0) + 1);
  const senderUid =
    auth.currentUser?.uid ||
    (input.senderRole === 'teacher' ? input.teacherUid || 'teacher_demo' : input.studentUid);

  const prevUnreadTeacher = localExisting?.unreadByTeacher ?? 0;
  const prevUnreadStudent = localExisting?.unreadByStudent ?? 0;

  // 生徒が「質問」「宿題相談」「ペース調整」を送ったら自動で「相談中（open）」にして先生の対応漏れを防ぐ
  const nextResolution: ClassChatResolutionStatus | undefined =
    input.senderRole === 'student' &&
    (input.topic === 'question' || input.topic === 'homework' || input.topic === 'pace')
      ? 'open'
      : localExisting?.resolutionStatus;

  const safeLinkedChapterId =
    input.linkedChapter?.id &&
    SAFE_CHAPTER_ID_RE.test(input.linkedChapter.id) &&
    (input.isDemoMode || isValidEikenChapterId(input.linkedChapter.id))
      ? input.linkedChapter.id
      : undefined;

  const baseThread: ClassChatThreadDoc = stripUndefined({
    id: threadId,
    classId: input.classId,
    className: sanitizeChatText(input.className || localExisting?.className || 'クラス', 80),
    schoolName: sanitizeChatText(input.schoolName ?? localExisting?.schoolName ?? '', 80),
    teacherUid: sanitizeChatText(input.teacherUid || localExisting?.teacherUid || senderUid, 128),
    studentUid: input.studentUid,
    studentName: sanitizeChatText(input.studentName || localExisting?.studentName || '生徒', 40) || '生徒',
    lastMessageText: trimmed,
    lastSenderRole: input.senderRole,
    lastSenderName: sanitizeChatText(input.senderName, 40),
    lastMessageAt: now,
    unreadByTeacher: input.senderRole === 'student' ? prevUnreadTeacher + 1 : 0,
    unreadByStudent: input.senderRole === 'teacher' ? prevUnreadStudent + 1 : 0,
    teacherLastReadAt:
      input.senderRole === 'teacher' ? now : (localExisting?.teacherLastReadAt ?? 0),
    studentLastReadAt:
      input.senderRole === 'student' ? now : (localExisting?.studentLastReadAt ?? 0),
    resolutionStatus: nextResolution,
    pinnedNotice: localExisting?.pinnedNotice,
    lastTopic: input.topic,
    updatedAt: now,
  });

  const optimisticMsg: ClassChatMessageDoc = stripUndefined({
    id: `local_${now}_${Math.random().toString(36).slice(2, 8)}`,
    threadId,
    classId: input.classId,
    studentUid: input.studentUid,
    senderUid,
    senderRole: input.senderRole,
    senderName: sanitizeChatText(input.senderName, 40),
    text: trimmed,
    createdAt: now,
    topic: input.topic,
    replyToId:
      input.replyTo?.id && isSafeRecordKey(input.replyTo.id)
        ? input.replyTo.id.slice(0, 128)
        : undefined,
    replyToSenderName: input.replyTo?.senderName
      ? sanitizeChatText(input.replyTo.senderName, 40)
      : undefined,
    replyToText: input.replyTo?.text ? sanitizeChatText(input.replyTo.text, 280) : undefined,
    linkedChapterId: safeLinkedChapterId,
    linkedChapterTitle:
      safeLinkedChapterId && input.linkedChapter?.title
        ? sanitizeChatText(input.linkedChapter.title, 120)
        : undefined,
  });

  if (input.isDemoMode || !FIREBASE_CONFIGURED || !auth.currentUser) {
    upsertLocalChatThread(baseThread, scopeOpts);
    upsertLocalChatMessage(optimisticMsg, scopeOpts);
    dispatchLocalChatUpdated({ threadId });
    return optimisticMsg;
  }

  const threadRef = doc(db, CLASS_CHAT_THREADS_COLLECTION, threadId);
  let remotePrevTeacherUnread = prevUnreadTeacher;
  let remotePrevStudentUnread = prevUnreadStudent;
  let remoteTeacherReadAt = baseThread.teacherLastReadAt;
  let remoteStudentReadAt = baseThread.studentLastReadAt;
  let remoteTeacherUid = baseThread.teacherUid;
  let remotePinnedNotice = baseThread.pinnedNotice;
  let remoteResolution = baseThread.resolutionStatus;
  let remoteExists = false;

  try {
    const snap = await getDoc(threadRef);
    if (snap.exists()) {
      remoteExists = true;
      const existing = parseThreadDoc(snap.id, snap.data() as Record<string, unknown>);
      if (existing) {
        remotePrevTeacherUnread = existing.unreadByTeacher;
        remotePrevStudentUnread = existing.unreadByStudent;
        remoteTeacherReadAt =
          input.senderRole === 'teacher' ? now : existing.teacherLastReadAt;
        remoteStudentReadAt =
          input.senderRole === 'student' ? now : existing.studentLastReadAt;
        remoteTeacherUid = existing.teacherUid || remoteTeacherUid;
        remotePinnedNotice = existing.pinnedNotice ?? remotePinnedNotice;
        if (
          !(
            input.senderRole === 'student' &&
            (input.topic === 'question' || input.topic === 'homework' || input.topic === 'pace')
          )
        ) {
          remoteResolution = existing.resolutionStatus;
        }
      }
    } else {
      // 初回スレッド作成時：招待講師（staff）からの送信でも rules の `teacherUid == classroom.teacherUid` を満たすよう正規解決
      const roomSnap = await getDoc(doc(db, CLASSROOMS_COLLECTION, input.classId));
      if (roomSnap.exists()) {
        const roomData = roomSnap.data() as { teacherUid?: string };
        if (typeof roomData.teacherUid === 'string' && roomData.teacherUid) {
          remoteTeacherUid = roomData.teacherUid;
        }
      }
      if (input.senderRole === 'student') {
        remotePinnedNotice = undefined;
      }
    }
  } catch {
    /* proceed with optimistic values */
  }

  const effectiveNow = remoteExists ? now : Math.max(now, Date.now());
  const threadPayload: ClassChatThreadDoc = stripUndefined({
    ...baseThread,
    lastMessageAt: effectiveNow,
    updatedAt: effectiveNow,
    teacherUid: remoteTeacherUid,
    unreadByTeacher: input.senderRole === 'student' ? remotePrevTeacherUnread + 1 : 0,
    unreadByStudent: input.senderRole === 'teacher' ? remotePrevStudentUnread + 1 : 0,
    teacherLastReadAt:
      input.senderRole === 'teacher' ? effectiveNow : remoteTeacherReadAt,
    studentLastReadAt:
      input.senderRole === 'student' ? effectiveNow : remoteStudentReadAt,
    pinnedNotice: remotePinnedNotice,
    resolutionStatus: remoteResolution,
  });

  await setDoc(threadRef, threadPayload);
  const messagesCol = collection(
    db,
    CLASS_CHAT_THREADS_COLLECTION,
    threadId,
    CLASS_CHAT_MESSAGES_SUBCOLLECTION,
  );
  const firestoreMsgPayload = stripUndefined({
    threadId,
    classId: input.classId,
    studentUid: input.studentUid,
    senderUid: auth.currentUser.uid,
    senderRole: input.senderRole,
    senderName: sanitizeChatText(input.senderName, 40),
    text: trimmed,
    createdAt: effectiveNow,
    topic: optimisticMsg.topic,
    replyToId: optimisticMsg.replyToId,
    replyToSenderName: optimisticMsg.replyToSenderName,
    replyToText: optimisticMsg.replyToText,
    linkedChapterId: optimisticMsg.linkedChapterId,
    linkedChapterTitle: optimisticMsg.linkedChapterTitle,
  });

  const createdRef = (await addDoc(messagesCol, firestoreMsgPayload)) as { id?: string };

  const savedMsg: ClassChatMessageDoc = {
    ...optimisticMsg,
    id: createdRef?.id || optimisticMsg.id,
    senderUid: auth.currentUser.uid,
    createdAt: effectiveNow,
  };
  upsertLocalChatThread(threadPayload, scopeOpts);
  upsertLocalChatMessage(savedMsg, scopeOpts);
  dispatchLocalChatUpdated({ threadId });
  return savedMsg;
}

/** メッセージへのLINE風リアクション付与・トグル解除（自分のロール枠のみ変更可） */
export async function toggleClassChatReaction(params: {
  classId: string;
  studentUid: string;
  messageId: string;
  viewerRole: ClassChatSenderRole;
  reaction: ClassChatReactionKey;
  isDemoMode?: boolean;
}): Promise<void> {
  if (!VALID_REACTIONS.has(params.reaction)) return;
  const scopeOpts: ChatStorageScopeOptions = { isDemoMode: params.isDemoMode };
  const threadId = buildClassChatThreadId(params.classId, params.studentUid);
  const localMsgs = loadLocalChatMessages(threadId, scopeOpts);
  const target = localMsgs.find((m) => m.id === params.messageId);
  if (!target || target.unsent) return;

  const currentReactions: Partial<Record<ClassChatSenderRole, ClassChatReactionKey>> = {
    ...(target.reactions || {}),
  };
  if (currentReactions[params.viewerRole] === params.reaction) {
    delete currentReactions[params.viewerRole];
  } else {
    currentReactions[params.viewerRole] = params.reaction;
  }

  const nextReactions = Object.keys(currentReactions).length > 0 ? currentReactions : undefined;
  const updatedMsg: ClassChatMessageDoc = stripUndefined({
    ...target,
    reactions: nextReactions,
  });
  if (!nextReactions) {
    delete (updatedMsg as { reactions?: unknown }).reactions;
  }

  upsertLocalChatMessage(updatedMsg, scopeOpts);
  dispatchLocalChatUpdated({ threadId });

  if (
    params.isDemoMode ||
    !FIREBASE_CONFIGURED ||
    !auth.currentUser ||
    params.messageId.startsWith('local_') ||
    params.messageId.startsWith('demo_')
  ) {
    return;
  }

  try {
    const msgRef = doc(
      db,
      CLASS_CHAT_THREADS_COLLECTION,
      threadId,
      CLASS_CHAT_MESSAGES_SUBCOLLECTION,
      params.messageId,
    );
    await updateDoc(msgRef, { reactions: nextReactions ?? {} });
  } catch {
    /* ignore */
  }
}

/**
 * 自分のメッセージを「送信取り消し」にする
 * - 元テキスト・引用・単元添付・リアクションをローカルおよび Firestore ドキュメント上から完全消去する
 */
export async function unsendClassChatMessage(params: {
  classId: string;
  studentUid: string;
  messageId: string;
  viewerRole: ClassChatSenderRole;
  isDemoMode?: boolean;
}): Promise<void> {
  const scopeOpts: ChatStorageScopeOptions = { isDemoMode: params.isDemoMode };
  const threadId = buildClassChatThreadId(params.classId, params.studentUid);
  const localMsgs = loadLocalChatMessages(threadId, scopeOpts);
  const target = localMsgs.find((m) => m.id === params.messageId);
  if (!target || target.unsent || target.senderRole !== params.viewerRole) return;
  if (!params.isDemoMode && auth.currentUser?.uid && target.senderUid && target.senderUid !== auth.currentUser.uid) {
    return;
  }

  // 元テキスト・引用・添付・リアクションを完全消去したトゥームストーンを作成
  const scrubbedMsg: ClassChatMessageDoc = stripUndefined({
    id: target.id,
    threadId: target.threadId,
    classId: target.classId,
    studentUid: target.studentUid,
    senderUid: target.senderUid,
    senderRole: target.senderRole,
    senderName: target.senderName,
    text: UNSENT_TOMBSTONE_TEXT,
    createdAt: target.createdAt,
    topic: target.topic,
    unsent: true,
  });
  upsertLocalChatMessage(scrubbedMsg, scopeOpts);

  const threads = loadLocalChatThreads(scopeOpts);
  const curThread = threads[threadId];
  const wasLatest = Boolean(curThread && curThread.lastMessageAt === target.createdAt);
  if (curThread && wasLatest) {
    threads[threadId] = {
      ...curThread,
      lastMessageText: UNSENT_TOMBSTONE_TEXT,
      updatedAt: Date.now(),
    };
    saveLocalChatThreads(threads, scopeOpts);
  }
  dispatchLocalChatUpdated({ threadId });

  if (
    params.isDemoMode ||
    !FIREBASE_CONFIGURED ||
    !auth.currentUser ||
    params.messageId.startsWith('local_') ||
    params.messageId.startsWith('demo_')
  ) {
    return;
  }

  try {
    const msgRef = doc(
      db,
      CLASS_CHAT_THREADS_COLLECTION,
      threadId,
      CLASS_CHAT_MESSAGES_SUBCOLLECTION,
      params.messageId,
    );
    const firestoreTombstone = stripUndefined({
      threadId: scrubbedMsg.threadId,
      classId: scrubbedMsg.classId,
      studentUid: scrubbedMsg.studentUid,
      senderUid: scrubbedMsg.senderUid,
      senderRole: scrubbedMsg.senderRole,
      senderName: scrubbedMsg.senderName,
      text: UNSENT_TOMBSTONE_TEXT,
      createdAt: scrubbedMsg.createdAt,
      topic: scrubbedMsg.topic,
      unsent: true,
    });
    await setDoc(msgRef, firestoreTombstone);

    if (wasLatest) {
      const threadRef = doc(db, CLASS_CHAT_THREADS_COLLECTION, threadId);
      await updateDoc(threadRef, {
        lastMessageText: UNSENT_TOMBSTONE_TEXT,
        updatedAt: Date.now(),
      });
    }
  } catch {
    /* ignore */
  }
}

/** トークルーム上部の「ピン留め約束メモ（先生専用）」または「相談中 ⇄ 解決済み」を更新 */
export async function updateClassChatThreadMeta(params: {
  classId: string;
  studentUid: string;
  viewerRole?: ClassChatSenderRole;
  resolutionStatus?: ClassChatResolutionStatus;
  pinnedNotice?: string;
  isDemoMode?: boolean;
}): Promise<void> {
  const scopeOpts: ChatStorageScopeOptions = { isDemoMode: params.isDemoMode };
  const canEditPin = params.viewerRole !== 'student';
  const safePinInput =
    canEditPin && params.pinnedNotice !== undefined
      ? sanitizeChatText(params.pinnedNotice, 300)
      : undefined;

  const threadId = buildClassChatThreadId(params.classId, params.studentUid);
  const now = Date.now();
  const threads = loadLocalChatThreads(scopeOpts);
  const cur = threads[threadId];
  if (cur) {
    const next: ClassChatThreadDoc = stripUndefined({
      ...cur,
      resolutionStatus: params.resolutionStatus ?? cur.resolutionStatus,
      pinnedNotice: safePinInput !== undefined ? safePinInput || undefined : cur.pinnedNotice,
      updatedAt: now,
    });
    if (safePinInput !== undefined && !safePinInput) {
      delete (next as { pinnedNotice?: string }).pinnedNotice;
    }
    threads[threadId] = next;
    saveLocalChatThreads(threads, scopeOpts);
    dispatchLocalChatUpdated({ threadId });
  }

  if (params.isDemoMode || !FIREBASE_CONFIGURED || !auth.currentUser) return;

  try {
    const threadRef = doc(db, CLASS_CHAT_THREADS_COLLECTION, threadId);
    const snap = await getDoc(threadRef);
    if (!snap.exists()) return;
    const patch: Record<string, unknown> = { updatedAt: now };
    if (params.resolutionStatus) patch.resolutionStatus = params.resolutionStatus;
    if (safePinInput !== undefined) {
      patch.pinnedNotice = safePinInput;
    }
    await updateDoc(threadRef, patch);
  } catch {
    /* ignore */
  }
}

/** チャット画面を開いた際に自分の未読数を0にし、既読時刻を更新する */
export async function markClassChatThreadRead(params: {
  classId: string;
  studentUid: string;
  viewerRole: ClassChatSenderRole;
  isDemoMode?: boolean;
}): Promise<void> {
  const scopeOpts: ChatStorageScopeOptions = { isDemoMode: params.isDemoMode };
  const threadId = buildClassChatThreadId(params.classId, params.studentUid);
  const now = Date.now();
  const localAll = loadLocalChatThreads(scopeOpts);
  const cur = localAll[threadId];
  if (cur) {
    const alreadyClean =
      params.viewerRole === 'teacher'
        ? cur.unreadByTeacher === 0 && cur.teacherLastReadAt >= cur.lastMessageAt
        : cur.unreadByStudent === 0 && cur.studentLastReadAt >= cur.lastMessageAt;
    if (!alreadyClean) {
      localAll[threadId] =
        params.viewerRole === 'teacher'
          ? { ...cur, unreadByTeacher: 0, teacherLastReadAt: now, updatedAt: now }
          : { ...cur, unreadByStudent: 0, studentLastReadAt: now, updatedAt: now };
      saveLocalChatThreads(localAll, scopeOpts);
      dispatchLocalChatUpdated({ threadId });
    }
  }

  if (params.isDemoMode || !FIREBASE_CONFIGURED || !auth.currentUser) return;

  try {
    const threadRef = doc(db, CLASS_CHAT_THREADS_COLLECTION, threadId);
    const snap = await getDoc(threadRef);
    if (!snap.exists()) return;
    const data = snap.data() as Record<string, unknown>;
    const needUpdate =
      params.viewerRole === 'teacher'
        ? (typeof data.unreadByTeacher === 'number' && data.unreadByTeacher > 0) ||
          toMillisSafe(data.teacherLastReadAt, 0) < toMillisSafe(data.lastMessageAt, 0)
        : (typeof data.unreadByStudent === 'number' && data.unreadByStudent > 0) ||
          toMillisSafe(data.studentLastReadAt, 0) < toMillisSafe(data.lastMessageAt, 0);
    if (!needUpdate) return;

    await updateDoc(
      threadRef,
      params.viewerRole === 'teacher'
        ? { unreadByTeacher: 0, teacherLastReadAt: now, updatedAt: now }
        : { unreadByStudent: 0, studentLastReadAt: now, updatedAt: now },
    );
  } catch {
    /* ignore permission / missing doc */
  }
}

// ============================================================================
// リアルタイム購読（単一スレッド / クラス全スレッド / ユーザー着信監視）
// ============================================================================

export function subscribeClassChatConversation(params: {
  classId: string;
  studentUid: string;
  isDemoMode?: boolean;
  onUpdate: (state: {
    thread: ClassChatThreadDoc | null;
    messages: ClassChatMessageDoc[];
  }) => void;
}): () => void {
  const scopeOpts: ChatStorageScopeOptions = { isDemoMode: params.isDemoMode };
  const threadId = buildClassChatThreadId(params.classId, params.studentUid);

  const emitFromLocal = () => {
    const t = loadLocalChatThreads(scopeOpts)[threadId] ?? null;
    const msgs = loadLocalChatMessages(threadId, scopeOpts);
    params.onUpdate({ thread: t, messages: msgs });
  };

  emitFromLocal();

  const onLocal = (ev: Event) => {
    const detail = (ev as CustomEvent<LocalChatEventDetail>).detail;
    if (!detail?.threadId || detail.threadId === threadId) {
      emitFromLocal();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(LOCAL_EVENT_NAME, onLocal);
  }

  if (params.isDemoMode || !FIREBASE_CONFIGURED || !auth.currentUser) {
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(LOCAL_EVENT_NAME, onLocal);
      }
    };
  }

  let latestThread: ClassChatThreadDoc | null = loadLocalChatThreads(scopeOpts)[threadId] ?? null;
  let latestMessages: ClassChatMessageDoc[] = loadLocalChatMessages(threadId, scopeOpts);

  const threadRef = doc(db, CLASS_CHAT_THREADS_COLLECTION, threadId);
  const unsubThread = onSnapshot(
    threadRef,
    (snap) => {
      if (snap.exists()) {
        const parsed = parseThreadDoc(snap.id, snap.data() as Record<string, unknown>);
        if (parsed) {
          latestThread = parsed;
          upsertLocalChatThread(parsed, scopeOpts);
        }
      }
      params.onUpdate({ thread: latestThread, messages: latestMessages });
    },
    () => {
      /* fallback to local */
    },
  );

  const msgsQuery = query(
    collection(db, CLASS_CHAT_THREADS_COLLECTION, threadId, CLASS_CHAT_MESSAGES_SUBCOLLECTION),
    orderBy('createdAt', 'asc'),
    limit(200),
  );
  const unsubMsgs = onSnapshot(
    msgsQuery,
    (snap) => {
      const rows: ClassChatMessageDoc[] = [];
      snap.forEach((d) => {
        const m = parseMessageDoc(d.id, threadId, d.data() as Record<string, unknown>);
        if (m) rows.push(m);
      });
      rows.sort((a, b) => a.createdAt - b.createdAt);
      latestMessages = rows;
      saveLocalChatMessages(threadId, rows, scopeOpts);
      params.onUpdate({ thread: latestThread, messages: latestMessages });
    },
    () => {
      /* fallback to local */
    },
  );

  return () => {
    unsubThread();
    unsubMsgs();
    if (typeof window !== 'undefined') {
      window.removeEventListener(LOCAL_EVENT_NAME, onLocal);
    }
  };
}

/** 講師側：特定クラスの全生徒スレッド一覧をリアルタイム購読 */
export function subscribeClassThreadsForTeacher(params: {
  classId: string;
  isDemoMode?: boolean;
  onThreads: (threadsByStudentUid: Record<string, ClassChatThreadDoc>) => void;
}): () => void {
  const scopeOpts: ChatStorageScopeOptions = { isDemoMode: params.isDemoMode };

  const emitLocal = () => {
    const all = loadLocalChatThreads(scopeOpts);
    const map: Record<string, ClassChatThreadDoc> = {};
    for (const t of Object.values(all)) {
      if (t.classId === params.classId && isSafeRecordKey(t.studentUid)) {
        map[t.studentUid] = t;
      }
    }
    params.onThreads(map);
  };

  emitLocal();

  const onLocal = () => emitLocal();
  if (typeof window !== 'undefined') {
    window.addEventListener(LOCAL_EVENT_NAME, onLocal);
  }

  if (params.isDemoMode || !FIREBASE_CONFIGURED || !auth.currentUser || !params.classId) {
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(LOCAL_EVENT_NAME, onLocal);
      }
    };
  }

  let initialized = false;
  const prevLastAt = new Map<string, number>();

  const q = query(
    collection(db, CLASS_CHAT_THREADS_COLLECTION),
    where('classId', '==', params.classId),
  );
  const unsub = onSnapshot(
    q,
    (snap) => {
      const map: Record<string, ClassChatThreadDoc> = {};
      snap.forEach((d) => {
        const parsed = parseThreadDoc(d.id, d.data() as Record<string, unknown>);
        if (!parsed) return;
        map[parsed.studentUid] = parsed;
        upsertLocalChatThread(parsed, scopeOpts);

        const prev = prevLastAt.get(parsed.id) ?? 0;
        if (
          initialized &&
          parsed.lastMessageAt > prev &&
          parsed.lastSenderRole === 'student' &&
          parsed.unreadByTeacher > 0
        ) {
          emitIncomingAlert({
            id: `${parsed.id}_${parsed.lastMessageAt}`,
            threadId: parsed.id,
            classId: parsed.classId,
            className: parsed.className,
            studentUid: parsed.studentUid,
            studentName: parsed.studentName,
            senderRole: 'student',
            senderName: parsed.lastSenderName || parsed.studentName,
            text: parsed.lastMessageText,
            topic: parsed.lastTopic,
            createdAt: parsed.lastMessageAt,
          });
        }
        prevLastAt.set(parsed.id, parsed.lastMessageAt);
      });
      initialized = true;
      params.onThreads(map);
    },
    () => {
      emitLocal();
    },
  );

  return () => {
    unsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener(LOCAL_EVENT_NAME, onLocal);
    }
  };
}

/**
 * アプリ常駐用：ログイン中ユーザーの未読合計と新着着信をリアルタイム監視する。
 * - 生徒側：在籍中クラス（`loadJukuMemberships(uid)`）の個別スレッドのみをピンポイント購読
 *   （過去に退出したクラスが残っていても permission-denied を起こさず、退出と同時に即時遮断）
 * - 先生側：自分がオーナーの担当クラス（`where('teacherUid','==',uid)`）を購読
 */
export function subscribeUserChatInbox(params: {
  uid: string;
  onSummary: (summary: {
    unreadAsStudent: number;
    unreadAsTeacher: number;
    totalUnread: number;
    studentThreadsByClassId: Record<string, ClassChatThreadDoc>;
    teacherThreadsById: Record<string, ClassChatThreadDoc>;
  }) => void;
}): () => void {
  const { uid } = params;
  if (!uid || !isSafeRecordKey(uid)) {
    params.onSummary({
      unreadAsStudent: 0,
      unreadAsTeacher: 0,
      totalUnread: 0,
      studentThreadsByClassId: {},
      teacherThreadsById: {},
    });
    return () => {};
  }

  const scopeOpts: ChatStorageScopeOptions = { ownerUid: uid };
  let studentMap: Record<string, ClassChatThreadDoc> = {};
  let teacherMap: Record<string, ClassChatThreadDoc> = {};

  const recompute = () => {
    const unreadAsStudent = Object.values(studentMap).reduce(
      (sum, t) => sum + (t.unreadByStudent || 0),
      0,
    );
    const unreadAsTeacher = Object.values(teacherMap).reduce(
      (sum, t) => sum + (t.unreadByTeacher || 0),
      0,
    );
    params.onSummary({
      unreadAsStudent,
      unreadAsTeacher,
      totalUnread: unreadAsStudent + unreadAsTeacher,
      studentThreadsByClassId: { ...studentMap },
      teacherThreadsById: { ...teacherMap },
    });
  };

  const syncFromLocal = () => {
    const all = loadLocalChatThreads(scopeOpts);
    const enrolledSet = new Set(loadJukuMemberships(uid).map((m) => m.classId));
    const sNext: Record<string, ClassChatThreadDoc> = {};
    const tNext: Record<string, ClassChatThreadDoc> = {};
    for (const t of Object.values(all)) {
      if (t.studentUid === uid && ( enrolledSet.size === 0 || enrolledSet.has(t.classId) )) {
        sNext[t.classId] = t;
      }
      if (t.teacherUid === uid) {
        tNext[t.id] = t;
      }
    }
    studentMap = sNext;
    teacherMap = tNext;
    recompute();
  };

  syncFromLocal();

  const onLocal = () => syncFromLocal();
  if (typeof window !== 'undefined') {
    window.addEventListener(LOCAL_EVENT_NAME, onLocal);
  }

  if (!FIREBASE_CONFIGURED || !auth.currentUser || auth.currentUser.uid !== uid) {
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(LOCAL_EVENT_NAME, onLocal);
      }
    };
  }

  // 生徒側：在籍クラスごとの個別スレッド doc 購読（退出クラスは即座に購読解除）
  const studentDocUnsubs = new Map<string, () => void>();
  const prevStudentAt = new Map<string, number>();
  const initializedClasses = new Set<string>();

  const syncStudentSubscriptions = () => {
    const memberships = loadJukuMemberships(uid);
    const activeClassIds = new Set(memberships.map((m) => m.classId).filter(isSafeRecordKey));

    // 退出したクラスのリスナーを即解除
    for (const [cid, unsub] of studentDocUnsubs.entries()) {
      if (!activeClassIds.has(cid)) {
        unsub();
        studentDocUnsubs.delete(cid);
        delete studentMap[cid];
      }
    }

    for (const cid of activeClassIds) {
      if (studentDocUnsubs.has(cid)) continue;
      const tid = buildClassChatThreadId(cid, uid);
      const ref = doc(db, CLASS_CHAT_THREADS_COLLECTION, tid);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            const parsed = parseThreadDoc(snap.id, snap.data() as Record<string, unknown>);
            if (parsed && parsed.studentUid === uid) {
              studentMap = { ...studentMap, [cid]: parsed };
              upsertLocalChatThread(parsed, scopeOpts);

              const prev = prevStudentAt.get(parsed.id) ?? 0;
              if (
                initializedClasses.has(cid) &&
                parsed.lastMessageAt > prev &&
                parsed.lastSenderRole === 'teacher' &&
                parsed.unreadByStudent > 0
              ) {
                emitIncomingAlert({
                  id: `${parsed.id}_${parsed.lastMessageAt}`,
                  threadId: parsed.id,
                  classId: parsed.classId,
                  className: parsed.className,
                  studentUid: parsed.studentUid,
                  studentName: parsed.studentName,
                  senderRole: 'teacher',
                  senderName: parsed.lastSenderName || '先生',
                  text: parsed.lastMessageText,
                  topic: parsed.lastTopic,
                  createdAt: parsed.lastMessageAt,
                });
              }
              prevStudentAt.set(parsed.id, parsed.lastMessageAt);
            }
          } else if (studentMap[cid]) {
            const copy = { ...studentMap };
            delete copy[cid];
            studentMap = copy;
          }
          initializedClasses.add(cid);
          recompute();
        },
        () => {
          /* ignore */
        },
      );
      studentDocUnsubs.set(cid, unsub);
    }
    recompute();
  };

  syncStudentSubscriptions();
  const offJuku = subscribeJukuMemberships(syncStudentSubscriptions);

  // 先生側：自分が担任オーナーのクラス全スレッド購読
  let teacherInit = false;
  const prevTeacherAt = new Map<string, number>();
  const qTeacher = query(
    collection(db, CLASS_CHAT_THREADS_COLLECTION),
    where('teacherUid', '==', uid),
  );
  const unsubTeacher = onSnapshot(
    qTeacher,
    (snap) => {
      const next: Record<string, ClassChatThreadDoc> = {};
      snap.forEach((d) => {
        const parsed = parseThreadDoc(d.id, d.data() as Record<string, unknown>);
        if (!parsed) return;
        next[parsed.id] = parsed;
        upsertLocalChatThread(parsed, scopeOpts);

        const prev = prevTeacherAt.get(parsed.id) ?? 0;
        if (
          teacherInit &&
          parsed.lastMessageAt > prev &&
          parsed.lastSenderRole === 'student' &&
          parsed.unreadByTeacher > 0
        ) {
          emitIncomingAlert({
            id: `${parsed.id}_${parsed.lastMessageAt}`,
            threadId: parsed.id,
            classId: parsed.classId,
            className: parsed.className,
            studentUid: parsed.studentUid,
            studentName: parsed.studentName,
            senderRole: 'student',
            senderName: parsed.lastSenderName || parsed.studentName,
            text: parsed.lastMessageText,
            topic: parsed.lastTopic,
            createdAt: parsed.lastMessageAt,
          });
        }
        prevTeacherAt.set(parsed.id, parsed.lastMessageAt);
      });
      teacherInit = true;
      teacherMap = next;
      recompute();
    },
    () => {
      /* ignore */
    },
  );

  return () => {
    offJuku();
    for (const unsub of studentDocUnsubs.values()) {
      unsub();
    }
    studentDocUnsubs.clear();
    unsubTeacher();
    if (typeof window !== 'undefined') {
      window.removeEventListener(LOCAL_EVENT_NAME, onLocal);
    }
  };
}
