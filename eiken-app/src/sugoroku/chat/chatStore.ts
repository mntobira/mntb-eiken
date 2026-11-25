/**
 * ============================================================================
 * クラス内 1対1 LINE品質リアルタイムチャット — Firestore双方向同期・リアクション・既読・着信音・通知制御
 * ============================================================================
 *
 * ■ 特徴
 * 1. Firestore `onSnapshot` によるリアルタイム双方向同期（メッセージ送受信・引用リプライ・
 *    リアクション・送信取消・相談中/解決済みステータス・ピン留めアナウンス・既読時刻）
 * 2. Web Audio API による優しいLINE風2音チャイム着信音 ＋ 端末バイブレーション ＋
 *    ブラウザ通知（Web Notification API）＋ アプリ内スライドダウン着信バナー
 * 3. localStorage ミラー＆CustomEvent により、デモ環境・オフライン復帰時も即座に反映
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
import { safeLocalStorage } from '../../utils/safeLocalStorage';
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

const LOCAL_THREADS_KEY = 'mntb_eiken_class_chat_threads_v1';
const LOCAL_MESSAGES_PREFIX = 'mntb_eiken_class_chat_msgs_v1:';
const LOCAL_SOUND_PREF_KEY = 'mntb_eiken_class_chat_sound_v1';
const LOCAL_EVENT_NAME = 'mntb:class-chat-updated';

type LocalChatEventDetail = {
  threadId?: string;
  incomingAlert?: IncomingClassChatAlert;
};

// Node(SSR/Vitest)環境など globalThis.localStorage が未定義の場合のメモリフォールバック
const memoryStore = new Map<string, string>();
function getChatStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    const raw = (globalThis as { localStorage?: Storage }).localStorage;
    if (raw && typeof raw.getItem === 'function' && typeof raw.setItem === 'function') {
      const ls = safeLocalStorage();
      if (ls) return ls;
    }
  } catch {
    /* ignore */
  }
  return {
    getItem: (k: string) => memoryStore.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memoryStore.set(k, v);
    },
  };
}

const alertSubscribers = new Set<(alert: IncomingClassChatAlert) => void>();
const recentlyEmittedAlertIds = new Set<string>();

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

/** Web Audio API による心地よい2音着信チャイム（外部音源ファイル不要・超軽量） */
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
        ? `${alert.className || 'クラス'}の先生から新着メッセージ`
        : `${alert.studentName}さんからメッセージ（${alert.className || 'クラス'}）`;
    const n = new Notification(title, {
      body: `${topicPrefix}${alert.text}`.slice(0, 120),
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
// LocalStorage ミラー（オフライン・デモモード・即時UI反映用）
// ============================================================================

export function loadLocalChatThreads(): Record<string, ClassChatThreadDoc> {
  const storage = getChatStorage();
  try {
    const raw = storage.getItem(LOCAL_THREADS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ClassChatThreadDoc>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalChatThreads(map: Record<string, ClassChatThreadDoc>): void {
  const storage = getChatStorage();
  try {
    storage.setItem(LOCAL_THREADS_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

export function upsertLocalChatThread(thread: ClassChatThreadDoc): void {
  const all = loadLocalChatThreads();
  all[thread.id] = thread;
  saveLocalChatThreads(all);
}

export function loadLocalChatMessages(threadId: string): ClassChatMessageDoc[] {
  const storage = getChatStorage();
  try {
    const raw = storage.getItem(LOCAL_MESSAGES_PREFIX + threadId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClassChatMessageDoc[];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => a.createdAt - b.createdAt)
      : [];
  } catch {
    return [];
  }
}

function saveLocalChatMessages(threadId: string, messages: ClassChatMessageDoc[]): void {
  const storage = getChatStorage();
  try {
    const trimmed = [...messages]
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-200);
    storage.setItem(LOCAL_MESSAGES_PREFIX + threadId, JSON.stringify(trimmed));
  } catch {
    /* ignore quota */
  }
}

function upsertLocalChatMessage(msg: ClassChatMessageDoc): void {
  const existing = loadLocalChatMessages(msg.threadId);
  const idx = existing.findIndex((m) => m.id === msg.id);
  if (idx >= 0) {
    const next = [...existing];
    next[idx] = msg;
    saveLocalChatMessages(msg.threadId, next);
  } else {
    saveLocalChatMessages(msg.threadId, [...existing, msg]);
  }
}

/** デモモード用：リアルな生徒×講師のLINE相談サンプルスレッドを初期投入 */
export function ensureDemoChatSeed(params: {
  classId: string;
  className: string;
  schoolName: string;
  nowMs?: number;
}): void {
  const all = loadLocalChatThreads();
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
          replyToText: '陸くん、週末の遠征お疲れさま！今週の英検2級 第1回課題、まずは下のリスニング第1部だけでも今日10分開いてみよう！',
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
          replyToText: '先生、今週分の第1回筆記とリスニング1周終わりました！間違えた語彙だけもう1周やります！',
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
    saveLocalChatMessages(threadId, msgs);
  }
  saveLocalChatThreads(all);
}

// ============================================================================
// 正規化ヘルパー
// ============================================================================

const VALID_TOPICS = new Set<string>(['question', 'homework', 'pace', 'report', 'encourage']);
const VALID_REACTIONS = new Set<string>(CHAT_REACTIONS.map((r) => r.key));

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
  const classId = typeof raw.classId === 'string' ? raw.classId : '';
  const studentUid = typeof raw.studentUid === 'string' ? raw.studentUid : '';
  if (!classId || !studentUid) return null;
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
    typeof raw.pinnedNotice === 'string' && raw.pinnedNotice.trim()
      ? raw.pinnedNotice
      : undefined;

  return {
    id,
    classId,
    className: typeof raw.className === 'string' ? raw.className : '',
    schoolName: typeof raw.schoolName === 'string' ? raw.schoolName : '',
    teacherUid: typeof raw.teacherUid === 'string' ? raw.teacherUid : '',
    studentUid,
    studentName: typeof raw.studentName === 'string' ? raw.studentName : '生徒',
    lastMessageText: typeof raw.lastMessageText === 'string' ? raw.lastMessageText : '',
    lastSenderRole: raw.lastSenderRole === 'teacher' ? 'teacher' : 'student',
    lastSenderName: typeof raw.lastSenderName === 'string' ? raw.lastSenderName : '',
    lastMessageAt: toMillisSafe(raw.lastMessageAt, now),
    unreadByTeacher: typeof raw.unreadByTeacher === 'number' ? Math.max(0, raw.unreadByTeacher) : 0,
    unreadByStudent: typeof raw.unreadByStudent === 'number' ? Math.max(0, raw.unreadByStudent) : 0,
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
  const text = typeof raw.text === 'string' ? raw.text : '';
  if (!text) return null;
  const topic =
    typeof raw.topic === 'string' && VALID_TOPICS.has(raw.topic)
      ? (raw.topic as ClassChatTopicTag)
      : undefined;

  let reactions: Partial<Record<ClassChatSenderRole, ClassChatReactionKey>> | undefined;
  if (raw.reactions && typeof raw.reactions === 'object') {
    const rObj = raw.reactions as Record<string, unknown>;
    const parsedR: Partial<Record<ClassChatSenderRole, ClassChatReactionKey>> = {};
    if (typeof rObj.student === 'string' && VALID_REACTIONS.has(rObj.student)) {
      parsedR.student = rObj.student as ClassChatReactionKey;
    }
    if (typeof rObj.teacher === 'string' && VALID_REACTIONS.has(rObj.teacher)) {
      parsedR.teacher = rObj.teacher as ClassChatReactionKey;
    }
    if (Object.keys(parsedR).length > 0) reactions = parsedR;
  }

  return {
    id,
    threadId,
    classId: typeof raw.classId === 'string' ? raw.classId : '',
    studentUid: typeof raw.studentUid === 'string' ? raw.studentUid : '',
    senderUid: typeof raw.senderUid === 'string' ? raw.senderUid : '',
    senderRole: raw.senderRole === 'teacher' ? 'teacher' : 'student',
    senderName: typeof raw.senderName === 'string' ? raw.senderName : '',
    text,
    createdAt: toMillisSafe(raw.createdAt, Date.now()),
    ...(topic ? { topic } : {}),
    ...(typeof raw.replyToId === 'string' && raw.replyToId ? { replyToId: raw.replyToId } : {}),
    ...(typeof raw.replyToSenderName === 'string' && raw.replyToSenderName
      ? { replyToSenderName: raw.replyToSenderName }
      : {}),
    ...(typeof raw.replyToText === 'string' && raw.replyToText
      ? { replyToText: raw.replyToText }
      : {}),
    ...(typeof raw.linkedChapterId === 'string' && raw.linkedChapterId
      ? { linkedChapterId: raw.linkedChapterId }
      : {}),
    ...(typeof raw.linkedChapterTitle === 'string' && raw.linkedChapterTitle
      ? { linkedChapterTitle: raw.linkedChapterTitle }
      : {}),
    ...(reactions ? { reactions } : {}),
    ...(raw.unsent === true ? { unsent: true } : {}),
  };
}

/** Firestore が undefined フィールドを拒否しないようクリーンアップする */
function stripUndefined<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v !== undefined) out[k] = v;
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
  const trimmed = input.text.trim().slice(0, CLASS_CHAT_MAX_MESSAGE_LENGTH);
  if (!trimmed) {
    throw new Error('メッセージを入力してください。');
  }

  const threadId = buildClassChatThreadId(input.classId, input.studentUid);
  const localExisting = loadLocalChatThreads()[threadId];
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

  const baseThread: ClassChatThreadDoc = stripUndefined({
    id: threadId,
    classId: input.classId,
    className: input.className || localExisting?.className || 'クラス',
    schoolName: input.schoolName ?? localExisting?.schoolName ?? '',
    teacherUid: input.teacherUid || localExisting?.teacherUid || senderUid,
    studentUid: input.studentUid,
    studentName: input.studentName || localExisting?.studentName || '生徒',
    lastMessageText: trimmed,
    lastSenderRole: input.senderRole,
    lastSenderName: input.senderName.slice(0, 40),
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
    senderName: input.senderName.slice(0, 40),
    text: trimmed,
    createdAt: now,
    topic: input.topic,
    replyToId: input.replyTo?.id ? input.replyTo.id.slice(0, 128) : undefined,
    replyToSenderName: input.replyTo?.senderName
      ? input.replyTo.senderName.slice(0, 40)
      : undefined,
    replyToText: input.replyTo?.text ? input.replyTo.text.slice(0, 280) : undefined,
    linkedChapterId: input.linkedChapter?.id ? input.linkedChapter.id.slice(0, 100) : undefined,
    linkedChapterTitle: input.linkedChapter?.title
      ? input.linkedChapter.title.slice(0, 120)
      : undefined,
  });

  if (input.isDemoMode || !FIREBASE_CONFIGURED || !auth.currentUser) {
    upsertLocalChatThread(baseThread);
    upsertLocalChatMessage(optimisticMsg);
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

  try {
    const snap = await getDoc(threadRef);
    if (snap.exists()) {
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
    }
  } catch {
    /* proceed with optimistic values */
  }

  const threadPayload: ClassChatThreadDoc = stripUndefined({
    ...baseThread,
    teacherUid: remoteTeacherUid,
    unreadByTeacher: input.senderRole === 'student' ? remotePrevTeacherUnread + 1 : 0,
    unreadByStudent: input.senderRole === 'teacher' ? remotePrevStudentUnread + 1 : 0,
    teacherLastReadAt: remoteTeacherReadAt,
    studentLastReadAt: remoteStudentReadAt,
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
    senderName: input.senderName.slice(0, 40),
    text: trimmed,
    createdAt: now,
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
  };
  upsertLocalChatThread(threadPayload);
  upsertLocalChatMessage(savedMsg);
  dispatchLocalChatUpdated({ threadId });
  return savedMsg;
}

/** メッセージへのLINE風リアクション付与・トグル解除 */
export async function toggleClassChatReaction(params: {
  classId: string;
  studentUid: string;
  messageId: string;
  viewerRole: ClassChatSenderRole;
  reaction: ClassChatReactionKey;
  isDemoMode?: boolean;
}): Promise<void> {
  const threadId = buildClassChatThreadId(params.classId, params.studentUid);
  const localMsgs = loadLocalChatMessages(threadId);
  const target = localMsgs.find((m) => m.id === params.messageId);
  if (!target || target.unsent) return;

  const currentReactions = { ...(target.reactions || {}) };
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

  upsertLocalChatMessage(updatedMsg);
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

/** 自分のメッセージを「送信取り消し」にする（LINE同様の取り消し体験） */
export async function unsendClassChatMessage(params: {
  classId: string;
  studentUid: string;
  messageId: string;
  viewerRole: ClassChatSenderRole;
  isDemoMode?: boolean;
}): Promise<void> {
  const threadId = buildClassChatThreadId(params.classId, params.studentUid);
  const localMsgs = loadLocalChatMessages(threadId);
  const target = localMsgs.find((m) => m.id === params.messageId);
  if (!target || target.senderRole !== params.viewerRole) return;

  const updatedMsg: ClassChatMessageDoc = {
    ...target,
    unsent: true,
  };
  upsertLocalChatMessage(updatedMsg);

  const threads = loadLocalChatThreads();
  const curThread = threads[threadId];
  if (curThread && curThread.lastMessageAt === target.createdAt) {
    threads[threadId] = {
      ...curThread,
      lastMessageText: 'メッセージの送信を取り消しました',
      updatedAt: Date.now(),
    };
    saveLocalChatThreads(threads);
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
    await updateDoc(msgRef, { unsent: true });
  } catch {
    /* ignore */
  }
}

/** トークルーム上部の「ピン留め約束メモ」または「相談中 ⇄ 解決済み」を更新 */
export async function updateClassChatThreadMeta(params: {
  classId: string;
  studentUid: string;
  resolutionStatus?: ClassChatResolutionStatus;
  pinnedNotice?: string;
  isDemoMode?: boolean;
}): Promise<void> {
  const threadId = buildClassChatThreadId(params.classId, params.studentUid);
  const now = Date.now();
  const threads = loadLocalChatThreads();
  const cur = threads[threadId];
  if (cur) {
    const next: ClassChatThreadDoc = stripUndefined({
      ...cur,
      resolutionStatus: params.resolutionStatus ?? cur.resolutionStatus,
      pinnedNotice:
        params.pinnedNotice !== undefined
          ? params.pinnedNotice.trim().slice(0, 300) || undefined
          : cur.pinnedNotice,
      updatedAt: now,
    });
    if (params.pinnedNotice !== undefined && !params.pinnedNotice.trim()) {
      delete (next as { pinnedNotice?: string }).pinnedNotice;
    }
    threads[threadId] = next;
    saveLocalChatThreads(threads);
    dispatchLocalChatUpdated({ threadId });
  }

  if (params.isDemoMode || !FIREBASE_CONFIGURED || !auth.currentUser) return;

  try {
    const threadRef = doc(db, CLASS_CHAT_THREADS_COLLECTION, threadId);
    const snap = await getDoc(threadRef);
    if (!snap.exists()) return;
    const patch: Record<string, unknown> = { updatedAt: now };
    if (params.resolutionStatus) patch.resolutionStatus = params.resolutionStatus;
    if (params.pinnedNotice !== undefined) {
      patch.pinnedNotice = params.pinnedNotice.trim().slice(0, 300);
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
  const threadId = buildClassChatThreadId(params.classId, params.studentUid);
  const now = Date.now();
  const localAll = loadLocalChatThreads();
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
      saveLocalChatThreads(localAll);
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
  const threadId = buildClassChatThreadId(params.classId, params.studentUid);

  const emitFromLocal = () => {
    const t = loadLocalChatThreads()[threadId] ?? null;
    const msgs = loadLocalChatMessages(threadId);
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

  let latestThread: ClassChatThreadDoc | null = loadLocalChatThreads()[threadId] ?? null;
  let latestMessages: ClassChatMessageDoc[] = loadLocalChatMessages(threadId);

  const threadRef = doc(db, CLASS_CHAT_THREADS_COLLECTION, threadId);
  const unsubThread = onSnapshot(
    threadRef,
    (snap) => {
      if (snap.exists()) {
        const parsed = parseThreadDoc(snap.id, snap.data() as Record<string, unknown>);
        if (parsed) {
          latestThread = parsed;
          upsertLocalChatThread(parsed);
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
      saveLocalChatMessages(threadId, rows);
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
  const emitLocal = () => {
    const all = loadLocalChatThreads();
    const map: Record<string, ClassChatThreadDoc> = {};
    for (const t of Object.values(all)) {
      if (t.classId === params.classId) {
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
        upsertLocalChatThread(parsed);

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
 * アプリ常駐用：ログイン中ユーザー（生徒としての全参加クラス＋先生としての担当クラス）の
 * 未読合計と新着メッセージ着信をリアルタイム監視する。
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
  if (!uid) {
    params.onSummary({
      unreadAsStudent: 0,
      unreadAsTeacher: 0,
      totalUnread: 0,
      studentThreadsByClassId: {},
      teacherThreadsById: {},
    });
    return () => {};
  }

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
    const all = loadLocalChatThreads();
    const sNext: Record<string, ClassChatThreadDoc> = {};
    const tNext: Record<string, ClassChatThreadDoc> = {};
    for (const t of Object.values(all)) {
      if (t.studentUid === uid) sNext[t.classId] = t;
      if (t.teacherUid === uid) tNext[t.id] = t;
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

  let studentInit = false;
  const prevStudentAt = new Map<string, number>();
  const qStudent = query(
    collection(db, CLASS_CHAT_THREADS_COLLECTION),
    where('studentUid', '==', uid),
  );
  const unsubStudent = onSnapshot(
    qStudent,
    (snap) => {
      const next: Record<string, ClassChatThreadDoc> = {};
      snap.forEach((d) => {
        const parsed = parseThreadDoc(d.id, d.data() as Record<string, unknown>);
        if (!parsed) return;
        next[parsed.classId] = parsed;
        upsertLocalChatThread(parsed);

        const prev = prevStudentAt.get(parsed.id) ?? 0;
        if (
          studentInit &&
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
      });
      studentInit = true;
      studentMap = next;
      recompute();
    },
    () => {
      /* ignore */
    },
  );

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
        upsertLocalChatThread(parsed);

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
    unsubStudent();
    unsubTeacher();
    if (typeof window !== 'undefined') {
      window.removeEventListener(LOCAL_EVENT_NAME, onLocal);
    }
  };
}
