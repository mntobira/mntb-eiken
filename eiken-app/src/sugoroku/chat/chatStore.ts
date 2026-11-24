/**
 * ============================================================================
 * クラス内 1対1 LINE風チャット — Firestoreリアルタイム同期＋ローカル即時ミラー＋通知制御
 * ============================================================================
 *
 * ■ 特徴
 * 1. Firestore `onSnapshot` によるリアルタイム双方向同期（メッセージ送受信・既読反映・未読件数）
 * 2. localStorage ミラー＆BroadcastChannel/CustomEvent により、デモモードやオフライン環境でも
 *    LINE風のトーク・既読・着信通知を完全動作
 * 3. 初回スナップショットは「既存履歴」として扱い通知を鳴らさず、購読開始後に相手から届いた
 *    新着メッセージ（`lastMessageAt` が増加かつ `lastSenderRole !== viewerRole`）のみ着信通知を発火
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
  type ClassChatMessageDoc,
  type ClassChatSenderRole,
  type ClassChatThreadDoc,
  type IncomingClassChatAlert,
} from './chatTypes';

export const CLASS_CHAT_THREADS_COLLECTION = 'class_chat_threads';
export const CLASS_CHAT_MESSAGES_SUBCOLLECTION = 'messages';
export const CLASS_CHAT_MAX_MESSAGE_LENGTH = 1000;

const LOCAL_THREADS_KEY = 'mntb_eiken_class_chat_threads_v1';
const LOCAL_MESSAGES_PREFIX = 'mntb_eiken_class_chat_msgs_v1:';
const LOCAL_EVENT_NAME = 'mntb:class-chat-updated';

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

type LocalChatEventDetail = {
  threadId?: string;
  incomingAlert?: IncomingClassChatAlert;
};

const alertSubscribers = new Set<(alert: IncomingClassChatAlert) => void>();

export function subscribeIncomingChatAlerts(
  listener: (alert: IncomingClassChatAlert) => void,
): () => void {
  alertSubscribers.add(listener);
  return () => {
    alertSubscribers.delete(listener);
  };
}

function emitIncomingAlert(alert: IncomingClassChatAlert): void {
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
    const title =
      alert.senderRole === 'teacher'
        ? `${alert.className || 'クラス'}の先生からメッセージ`
        : `${alert.studentName}さんからメッセージ（${alert.className || 'クラス'}）`;
    const n = new Notification(title, {
      body: alert.text.slice(0, 120),
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

function appendLocalChatMessage(msg: ClassChatMessageDoc): void {
  const existing = loadLocalChatMessages(msg.threadId);
  if (existing.some((m) => m.id === msg.id)) return;
  saveLocalChatMessages(msg.threadId, [...existing, msg]);
}

/** デモモード用：リアルな生徒×講師の相談サンプルスレッドを初期投入 */
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
    messages: Array<{
      senderRole: ClassChatSenderRole;
      senderName: string;
      text: string;
      offsetMin: number;
    }>;
  }> = [
    {
      studentUid: 'stu_yamamoto_riku',
      studentName: '山本 陸（高2・野球部）',
      unreadByTeacher: 1,
      teacherLastReadAt: now - 55 * 60_000,
      studentLastReadAt: now - 12 * 60_000,
      messages: [
        {
          senderRole: 'teacher',
          senderName: '西 講師',
          text: '陸くん、週末の遠征お疲れさま！今週の英検2級 第1回課題、まずはリスニング第1部だけでも今日10分開いてみよう！',
          offsetMin: -60,
        },
        {
          senderRole: 'student',
          senderName: '山本 陸',
          text: 'ありがとうございます！今日部活が19時に終わるので、帰りの電車で単語とリスニング第1部やります！大問3の長文の解き方も相談したいです。',
          offsetMin: -12,
        },
      ],
    },
    {
      studentUid: 'stu_takahashi_haruto',
      studentName: '高橋 陽斗（高2・サッカー部）',
      unreadByTeacher: 0,
      teacherLastReadAt: now - 90 * 60_000,
      studentLastReadAt: now - 85 * 60_000,
      messages: [
        {
          senderRole: 'student',
          senderName: '高橋 陽斗',
          text: '先生、今週分の第1回筆記とリスニング1周終わりました！間違えた語彙だけもう1周やります！',
          offsetMin: -120,
        },
        {
          senderRole: 'teacher',
          senderName: '西 講師',
          text: '陽斗くん素晴らしいペース！間違えた問題の2周目が一番スコアが伸びるから、その調子で進めよう！',
          offsetMin: -95,
        },
      ],
    },
  ];

  for (const item of sampleThreads) {
    const threadId = buildClassChatThreadId(params.classId, item.studentUid);
    const msgs: ClassChatMessageDoc[] = item.messages.map((m, idx) => ({
      id: `demo_msg_${item.studentUid}_${idx + 1}`,
      threadId,
      classId: params.classId,
      studentUid: item.studentUid,
      senderUid: m.senderRole === 'teacher' ? 'teacher_sugoroku_nishi' : item.studentUid,
      senderRole: m.senderRole,
      senderName: m.senderName,
      text: m.text,
      createdAt: now + m.offsetMin * 60_000,
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

function toMillisSafe(val: unknown, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return fallback;
}

function parseThreadDoc(id: string, raw: Record<string, unknown>): ClassChatThreadDoc | null {
  const classId = typeof raw.classId === 'string' ? raw.classId : '';
  const studentUid = typeof raw.studentUid === 'string' ? raw.studentUid : '';
  if (!classId || !studentUid) return null;
  const now = Date.now();
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
  };
}

// ============================================================================
// メッセージ送信 ＆ 既読処理
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
  isDemoMode?: boolean;
}

export async function sendClassChatMessage(
  input: SendClassChatMessageInput,
): Promise<ClassChatMessageDoc> {
  const trimmed = input.text.trim().slice(0, CLASS_CHAT_MAX_MESSAGE_LENGTH);
  if (!trimmed) {
    throw new Error('メッセージを入力してください。');
  }

  const now = Date.now();
  const threadId = buildClassChatThreadId(input.classId, input.studentUid);
  const senderUid =
    auth.currentUser?.uid ||
    (input.senderRole === 'teacher' ? input.teacherUid || 'teacher_demo' : input.studentUid);

  const localExisting = loadLocalChatThreads()[threadId];
  const prevUnreadTeacher = localExisting?.unreadByTeacher ?? 0;
  const prevUnreadStudent = localExisting?.unreadByStudent ?? 0;

  const nextThread: ClassChatThreadDoc = {
    id: threadId,
    classId: input.classId,
    className: input.className || localExisting?.className || 'クラス',
    schoolName: input.schoolName ?? localExisting?.schoolName ?? '',
    teacherUid: input.teacherUid || localExisting?.teacherUid || senderUid,
    studentUid: input.studentUid,
    studentName: input.studentName || localExisting?.studentName || '生徒',
    lastMessageText: trimmed,
    lastSenderRole: input.senderRole,
    lastSenderName: input.senderName,
    lastMessageAt: now,
    unreadByTeacher: input.senderRole === 'student' ? prevUnreadTeacher + 1 : 0,
    unreadByStudent: input.senderRole === 'teacher' ? prevUnreadStudent + 1 : 0,
    teacherLastReadAt:
      input.senderRole === 'teacher' ? now : (localExisting?.teacherLastReadAt ?? 0),
    studentLastReadAt:
      input.senderRole === 'student' ? now : (localExisting?.studentLastReadAt ?? 0),
    updatedAt: now,
  };

  const optimisticMsg: ClassChatMessageDoc = {
    id: `local_${now}_${Math.random().toString(36).slice(2, 8)}`,
    threadId,
    classId: input.classId,
    studentUid: input.studentUid,
    senderUid,
    senderRole: input.senderRole,
    senderName: input.senderName,
    text: trimmed,
    createdAt: now,
  };

  if (input.isDemoMode || !FIREBASE_CONFIGURED || !auth.currentUser) {
    upsertLocalChatThread(nextThread);
    appendLocalChatMessage(optimisticMsg);
    dispatchLocalChatUpdated({ threadId });
    return optimisticMsg;
  }

  const threadRef = doc(db, CLASS_CHAT_THREADS_COLLECTION, threadId);
  let remotePrevTeacherUnread = prevUnreadTeacher;
  let remotePrevStudentUnread = prevUnreadStudent;
  let remoteTeacherReadAt = nextThread.teacherLastReadAt;
  let remoteStudentReadAt = nextThread.studentLastReadAt;
  let remoteTeacherUid = nextThread.teacherUid;

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
      }
    }
  } catch {
    /* proceed with optimistic values */
  }

  const threadPayload: ClassChatThreadDoc = {
    ...nextThread,
    teacherUid: remoteTeacherUid,
    unreadByTeacher: input.senderRole === 'student' ? remotePrevTeacherUnread + 1 : 0,
    unreadByStudent: input.senderRole === 'teacher' ? remotePrevStudentUnread + 1 : 0,
    teacherLastReadAt: remoteTeacherReadAt,
    studentLastReadAt: remoteStudentReadAt,
  };

  await setDoc(threadRef, threadPayload);
  const messagesCol = collection(
    db,
    CLASS_CHAT_THREADS_COLLECTION,
    threadId,
    CLASS_CHAT_MESSAGES_SUBCOLLECTION,
  );
  const createdRef = await addDoc(messagesCol, {
    threadId,
    classId: input.classId,
    studentUid: input.studentUid,
    senderUid: auth.currentUser.uid,
    senderRole: input.senderRole,
    senderName: input.senderName.slice(0, 40),
    text: trimmed,
    createdAt: now,
  }) as { id?: string };

  const savedMsg: ClassChatMessageDoc = {
    ...optimisticMsg,
    id: createdRef?.id || optimisticMsg.id,
    senderUid: auth.currentUser.uid,
  };
  upsertLocalChatThread(threadPayload);
  appendLocalChatMessage(savedMsg);
  dispatchLocalChatUpdated({ threadId });
  return savedMsg;
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
    const updated: ClassChatThreadDoc =
      params.viewerRole === 'teacher'
        ? { ...cur, unreadByTeacher: 0, teacherLastReadAt: now, updatedAt: now }
        : { ...cur, unreadByStudent: 0, studentLastReadAt: now, updatedAt: now };
    localAll[threadId] = updated;
    saveLocalChatThreads(localAll);
    dispatchLocalChatUpdated({ threadId });
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
    limit(150),
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
