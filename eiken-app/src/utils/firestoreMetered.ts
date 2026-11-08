/**
 * Firestore の読み書き回数を数えるための薄い包み（運営用の使用量メーター）。
 *
 * ■ 目的
 *   「Firebase をどれぐらい使ったか」を運営者（FEEDBACK_ADMIN_EMAILS）だけが見られるようにする。
 *   Firebase コンソールの使用量はプロジェクト全体の合計しか分からないので、
 *   「どの機能が何回読んだか」をこの端末で数えて、運営パネル（UsageMeterPanel）に出す。
 *
 * ■ しくみ
 *   アプリの各ファイルは 'firebase/firestore' の代わりにここから import する。
 *   ここは本物の関数をそのまま呼び、結果の件数（getDocs なら取れた文書数）を足すだけ。
 *   ★通信は1回も増やしていない★（Firestore にも送らない。記録は localStorage のみ）。
 *
 * ■ 数え方（Firestore の課金単位に合わせた近似）
 *   読み取り … getDoc 1件＝1、getDocs は取れた文書数（0件でも最低1）、
 *              onSnapshot は受け取った変更の件数（初回は全件、以降は変わった件数）
 *   書き込み … setDoc / updateDoc / addDoc 1回＝1、writeBatch はコミットした操作数
 *   削除     … deleteDoc 1回＝1
 *   トランザクション内の get / set は runTransaction の中で数える。
 *   キャッシュから返った読み取り（fromCache）は課金されないので数えない。
 */
import * as fs from 'firebase/firestore';
import type { DocumentReference, Query, DocumentData, Firestore, Transaction, WriteBatch } from 'firebase/firestore';
import { safeLocalStorage } from './safeLocalStorage';

export * from 'firebase/firestore';

export type UsageKind = 'reads' | 'writes' | 'deletes';
export interface UsageDay { date: string; reads: number; writes: number; deletes: number; byArea: Record<string, { reads: number; writes: number; deletes: number }> }

const KEY = 'mntb_firestore_usage_v1';
const KEEP_DAYS = 14;
/** Spark（無料）プランの1日の上限（2026年時点の公開値） */
export const FREE_DAILY_LIMITS = { reads: 50_000, writes: 20_000, deletes: 20_000 } as const;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** コレクション名のいちばん上を「機能」として扱う（battle_rooms/xxx → battle_rooms） */
function areaOf(path: string): string {
  const top = String(path || '').split('/')[0] || 'other';
  return top.replace(/[^a-z0-9_]/gi, '').slice(0, 40) || 'other';
}

let pending: Record<string, { reads: number; writes: number; deletes: number }> = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  flushTimer = null;
  const storage = safeLocalStorage();
  if (!storage) { pending = {}; return; }
  try {
    const days = readUsage();
    const date = today();
    let day = days.find((d) => d.date === date);
    if (!day) { day = { date, reads: 0, writes: 0, deletes: 0, byArea: {} }; days.push(day); }
    for (const [area, c] of Object.entries(pending)) {
      const a = day.byArea[area] ?? (day.byArea[area] = { reads: 0, writes: 0, deletes: 0 });
      a.reads += c.reads; a.writes += c.writes; a.deletes += c.deletes;
      day.reads += c.reads; day.writes += c.writes; day.deletes += c.deletes;
    }
    pending = {};
    storage.setItem(KEY, JSON.stringify(days.sort((x, y) => x.date.localeCompare(y.date)).slice(-KEEP_DAYS)));
  } catch { pending = {}; }
}

export function recordUsage(path: string, kind: UsageKind, count = 1) {
  if (!Number.isFinite(count) || count <= 0) return;
  const area = areaOf(path);
  const c = pending[area] ?? (pending[area] = { reads: 0, writes: 0, deletes: 0 });
  c[kind] += count;
  // 1回ごとに localStorage へ書くと重いので、1秒まとめて書く
  if (!flushTimer) flushTimer = setTimeout(flush, 1000);
}

export function readUsage(): UsageDay[] {
  const storage = safeLocalStorage();
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((d) => d && typeof d.date === 'string') : [];
  } catch { return []; }
}
export function flushUsageNow() { if (flushTimer) { clearTimeout(flushTimer); } flush(); }
export function clearUsage() { safeLocalStorage()?.removeItem(KEY); pending = {}; }

const pathOfRef = (ref: { path?: string } | undefined) => String(ref?.path || '');
const pathOfQuery = (q: unknown) => {
  const anyQ = q as { path?: string; _query?: { path?: { segments?: string[] } } };
  return anyQ?.path || anyQ?._query?.path?.segments?.join('/') || 'query';
};

// ---- 読み取り ----
export async function getDoc<T = DocumentData>(ref: DocumentReference<T>) {
  const snap = await fs.getDoc(ref);
  if (!snap?.metadata?.fromCache) recordUsage(pathOfRef(ref), 'reads', 1);
  return snap;
}
export async function getDocs<T = DocumentData>(q: Query<T>) {
  const snap = await fs.getDocs(q);
  if (!snap?.metadata?.fromCache) recordUsage(pathOfQuery(q), "reads", Math.max(1, snap?.size ?? 0));
  return snap;
}

/** onSnapshot：受け取った変更ぶん（キャッシュからの通知は数えない） */
export const onSnapshot: typeof fs.onSnapshot = ((target: unknown, ...rest: unknown[]) => {
  const path = pathOfRef(target as { path?: string }) || pathOfQuery(target);
  const idx = rest.findIndex((r) => typeof r === 'function' || (r && typeof r === 'object' && 'next' in (r as object)));
  if (idx >= 0) {
    const orig = rest[idx];
    const count = (snap: { metadata?: { fromCache?: boolean }; docChanges?: () => unknown[]; exists?: () => boolean }) => {
      if (snap?.metadata?.fromCache) return;
      const n = typeof snap?.docChanges === 'function' ? snap.docChanges().length : 1;
      recordUsage(path, 'reads', Math.max(typeof snap?.docChanges === 'function' ? 0 : 1, n));
    };
    if (typeof orig === 'function') rest[idx] = (snap: never) => { count(snap); return (orig as (s: never) => void)(snap); };
    else {
      const o = orig as { next?: (s: never) => void };
      rest[idx] = { ...o, next: (snap: never) => { count(snap); o.next?.(snap); } };
    }
  }
  return (fs.onSnapshot as unknown as (...a: unknown[]) => () => void)(target, ...rest);
}) as typeof fs.onSnapshot;

// ---- 書き込み ----
export const setDoc: typeof fs.setDoc = ((ref: DocumentReference, ...rest: unknown[]) => {
  recordUsage(pathOfRef(ref), 'writes', 1);
  return (fs.setDoc as unknown as (...a: unknown[]) => Promise<void>)(ref, ...rest);
}) as typeof fs.setDoc;
export const updateDoc: typeof fs.updateDoc = ((ref: DocumentReference, ...rest: unknown[]) => {
  recordUsage(pathOfRef(ref), 'writes', 1);
  return (fs.updateDoc as unknown as (...a: unknown[]) => Promise<void>)(ref, ...rest);
}) as typeof fs.updateDoc;
export const addDoc: typeof fs.addDoc = ((ref: { path?: string }, data: unknown) => {
  recordUsage(pathOfRef(ref), 'writes', 1);
  return (fs.addDoc as unknown as (...a: unknown[]) => Promise<unknown>)(ref, data);
}) as typeof fs.addDoc;
export const deleteDoc: typeof fs.deleteDoc = ((ref: DocumentReference) => {
  recordUsage(pathOfRef(ref), 'deletes', 1);
  return fs.deleteDoc(ref);
}) as typeof fs.deleteDoc;

export function writeBatch(db: Firestore): WriteBatch {
  const batch = fs.writeBatch(db);
  const ops: { path: string; kind: UsageKind }[] = [];
  const wrap = <K extends 'set' | 'update' | 'delete'>(name: K, kind: UsageKind) => {
    const orig = (batch[name] as unknown as (...a: unknown[]) => WriteBatch).bind(batch);
    (batch as unknown as Record<string, unknown>)[name] = (ref: DocumentReference, ...rest: unknown[]) => { ops.push({ path: pathOfRef(ref), kind }); orig(ref, ...rest); return batch; };
  };
  wrap('set', 'writes'); wrap('update', 'writes'); wrap('delete', 'deletes');
  const commit = batch.commit.bind(batch);
  batch.commit = async () => { await commit(); for (const o of ops) recordUsage(o.path, o.kind, 1); };
  return batch;
}

export function runTransaction<T>(db: Firestore, fn: (tx: Transaction) => Promise<T>, options?: fs.TransactionOptions): Promise<T> {
  return fs.runTransaction(db, async (tx) => {
    const counted: { path: string; kind: UsageKind }[] = [];
    const proxy = new Proxy(tx, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;
        if (prop === 'get') return async (ref: DocumentReference) => { const s = await value.call(target, ref); counted.push({ path: pathOfRef(ref), kind: 'reads' }); return s; };
        if (prop === 'set' || prop === 'update') return (ref: DocumentReference, ...rest: unknown[]) => { counted.push({ path: pathOfRef(ref), kind: 'writes' }); value.call(target, ref, ...rest); return proxy; };
        if (prop === 'delete') return (ref: DocumentReference) => { counted.push({ path: pathOfRef(ref), kind: 'deletes' }); value.call(target, ref); return proxy; };
        return value.bind(target);
      },
    });
    const result = await fn(proxy);
    // 再試行されたトランザクションは本物も再度読むので、試行ごとに数える
    for (const c of counted) recordUsage(c.path, c.kind, 1);
    return result;
  }, options);
}

// English-test fork: a root reference can never address a university collection.
function eikenSegments(parent: unknown, segments: string[]): string[] {
  if ((parent as { type?: string })?.type !== 'firestore') return segments;
  const joined = segments.join('/');
  const [root, ...rest] = joined.split('/');
  if (!root || !/^[a-z][a-z0-9_]*$/.test(root)) throw new Error('Invalid Firestore root');
  return [(root.startsWith('eiken_') ? root : `eiken_${root}`), ...rest];
}
export const doc: typeof fs.doc = ((parent: unknown, ...segments: string[]) => {
  return (fs.doc as Function)(parent, ...eikenSegments(parent, segments));
}) as typeof fs.doc;
export const collection: typeof fs.collection = ((parent: unknown, ...segments: string[]) => {
  return (fs.collection as Function)(parent, ...eikenSegments(parent, segments));
}) as typeof fs.collection;
export const collectionGroup: typeof fs.collectionGroup = ((db: Firestore, id: string) => {
  if (!id.startsWith('eiken_')) throw new Error('Unprefixed collection groups are disabled');
  return fs.collectionGroup(db, id);
}) as typeof fs.collectionGroup;
