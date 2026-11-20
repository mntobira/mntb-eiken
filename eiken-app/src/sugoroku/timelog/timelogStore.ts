/**
 * ===================================================================
 * 分野別アクティブ学習時間の保存＆Firestore双方向同期（オフライン退避・復帰再送対応）
 * ===================================================================
 *
 * ■ 保存先（『03_AI並列開発指示書』第2章B＆AI 1 管理者ポータルと完全統一）
 *   1. ローカル主台帳 : localStorage['sugoroku_timelog_v1_<uid>']
 *   2. Firestore 日次 : users/{uid}/sugoroku_study_logs/{dateKey}
 *                       （※firestoreMetered により実体は eiken_users/{uid}/sugoroku_study_logs/{dateKey}）
 *   3. Firestore 集計 : study_summaries/{uid}
 *                       （※実体は eiken_study_summaries/{uid}）
 *
 * ■ オフライン耐性＆課金最適化
 *   - 校内Wi-Fiや移動中の電波断でも localStorage の `dirtyDateKeys` に未同期日を保持し、
 *     `window.addEventListener('online', ...)` や次回アクティブ時に自動再送する。
 *   - 15秒ごとの tick ではローカル台帳のみ即時更新し、Firestore 書き込みは最短 60 秒間隔の
 *     スロットリング（画面離脱・アンマウント時は即時フラッシュ）で Spark 無料枠を保護する。
 *   - ルール未反映環境（AI 4 マージ前）で `permission-denied` が返った場合は、そのセッション中の
 *     自動送信を静かに停止し、コンソール汚染と無駄なリトライをゼロにする。
 */

import { doc, setDoc } from '../../utils/firestoreMetered';
import { auth, db, FIREBASE_CONFIGURED } from '../../firebase';
import { isPlainObject, readStoredJson } from '../../utils/safeLocalStorage';
import { safeSetItem } from '../../utils/storageGuard';
import { loadJukuMemberships } from '../../utils/classAssignments';
import { readSolvedMap } from '../../utils/progress';
import {
  addSeconds,
  buildStudySummaryDoc,
  dayKeyOf,
  emptyLedger,
  labelOfBucket,
  markDatesSynced,
  OTHER_BUCKET,
  resolveStudyBucket,
  sumRecentDays,
  type BucketKey,
  type StudyContextInput,
  type TimelogDay,
  type TimelogLedger,
} from './timelogCore';
import { SUGOROKU_COLLECTIONS, type SugorokuSkillKey } from '../shared/types';

const KEY_PREFIX = 'sugoroku_timelog_v1_';
const SOLVED_SNAPSHOT_PREFIX = 'sugoroku_solved_snap_v1_';

/** Firestore への最短書き込み間隔（60秒スロットル：15秒tickの過剰課金防止） */
export const MIN_SYNC_INTERVAL_MS = 60_000;

export function timelogKey(uid: string | null | undefined): string {
  return `${KEY_PREFIX}${encodeURIComponent(uid || 'guest')}`;
}

function solvedSnapKey(uid: string | null | undefined): string {
  return `${SOLVED_SNAPSHOT_PREFIX}${encodeURIComponent(uid || 'guest')}`;
}

/** 端末から台帳を読む（壊れていれば空） */
export function readLedger(uid: string | null | undefined): TimelogLedger {
  const raw = readStoredJson<unknown>(timelogKey(uid), null, isPlainObject);
  if (!raw || !isPlainObject(raw)) return emptyLedger();
  const days = isPlainObject(raw.days) ? raw.days : {};
  const out: Record<string, TimelogDay> = {};
  Object.entries(days).forEach(([dateKey, value]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !isPlainObject(value)) return;
    const total = Number(value.totalActiveSeconds);
    const solved = Math.max(0, Math.floor(Number(value.solvedCount) || 0));
    if ((!Number.isFinite(total) || total <= 0) && solved <= 0) return;
    const byGradeSkill: Record<BucketKey, number> = {};
    if (isPlainObject(value.byGradeSkill)) {
      Object.entries(value.byGradeSkill).forEach(([k, v]) => {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) byGradeSkill[k] = Math.floor(n);
      });
    }
    let accuracyByGradeSkill: Record<BucketKey, { correct: number; total: number }> | undefined;
    if (isPlainObject(value.accuracyByGradeSkill)) {
      accuracyByGradeSkill = {};
      Object.entries(value.accuracyByGradeSkill).forEach(([k, v]) => {
        if (!isPlainObject(v)) return;
        const c = Math.max(0, Math.floor(Number(v.correct) || 0));
        const t = Math.max(0, Math.floor(Number(v.total) || 0));
        if (t > 0) accuracyByGradeSkill![k] = { correct: Math.min(c, t), total: t };
      });
      if (Object.keys(accuracyByGradeSkill).length === 0) accuracyByGradeSkill = undefined;
    }
    out[dateKey] = {
      dateKey,
      totalActiveSeconds: Math.max(0, Math.floor(Number.isFinite(total) ? total : 0)),
      byGradeSkill,
      solvedCount: solved,
      ...(accuracyByGradeSkill ? { accuracyByGradeSkill } : {}),
      lastTo: Number.isFinite(Number(value.lastTo)) ? Number(value.lastTo) : undefined,
      updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : 0,
    };
  });

  const dirtyDateKeys = Array.isArray(raw.dirtyDateKeys)
    ? raw.dirtyDateKeys
        .map((k) => String(k || '').trim())
        .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Boolean(out[k]))
    : [];

  return { days: out, dirtyDateKeys };
}

/** 端末へ書く（容量不足でも学習は止めない） */
export function writeLedger(uid: string | null | undefined, ledger: TimelogLedger): void {
  try {
    safeSetItem(timelogKey(uid), JSON.stringify(ledger));
  } catch {
    /* 保存失敗時も演習は止めない */
  }
}

/** 章ID → 振り分け先バケット（後方互換ヘルパー） */
export function bucketOfChapter(chapterId: string | null | undefined): BucketKey {
  return resolveStudyBucket({ chapterId });
}

/**
 * solved 台帳（`solved_problems_v1_<uid>`）の前回既知件数との差分から、
 * 今回新たに解いた問題数デルタを検出する（初回読み込み時は過去分を今日に誤計上しないようスナップショット初期化する）
 */
function consumeSolvedDelta(uid: string | null | undefined, now: number): number {
  const safeUid = uid || 'guest';
  try {
    const solvedMap = readSolvedMap(safeUid);
    const currentTotal = Object.keys(solvedMap || {}).length;
    const snap = readStoredJson<{ total?: number; dateKey?: string } | null>(
      solvedSnapKey(safeUid),
      null,
      isPlainObject,
    );
    const todayKey = dayKeyOf(now);
    if (!snap || typeof snap.total !== 'number') {
      // 初回は今日タイムスタンプを持つ問題のみを初期値から除外して正確に拾う
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const solvedTodayCount = Object.values(solvedMap || {}).filter(
        (ts) => typeof ts === 'number' && ts >= start.getTime() && ts <= now + 60_000,
      ).length;
      safeSetItem(solvedSnapKey(safeUid), JSON.stringify({ total: currentTotal, dateKey: todayKey }));
      const existingToday = readLedger(safeUid).days[todayKey]?.solvedCount || 0;
      return Math.max(0, solvedTodayCount - existingToday);
    }
    const delta = Math.max(0, currentTotal - snap.total);
    if (delta > 0 || snap.dateKey !== todayKey) {
      safeSetItem(solvedSnapKey(safeUid), JSON.stringify({ total: currentTotal, dateKey: todayKey }));
    }
    return delta;
  } catch {
    return 0;
  }
}

export interface RecordTickInput extends StudyContextInput {
  uid: string | null | undefined;
  /** 有効だった秒数（activeStudySeconds の結果） */
  seconds: number;
  /** 区間の終わり（ms） */
  to: number;
  /** 明示的に渡された解いた問題数（省略時は solved 台帳差分から自動算出） */
  solved?: number;
  /** オプション：正答数・解答数の増分 */
  accuracyDelta?: { correct: number; total: number };
}

const changeListeners = new Set<() => void>();
export function subscribeTimelogChanges(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => {
    changeListeners.delete(fn);
  };
}
function notifyTimelogChanged(): void {
  changeListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/**
 * 1 tick を台帳へ足して保存する。
 *   二重加算の判定は timelogCore.addSeconds（区間の末尾が同じなら捨てる）。
 */
export function recordTick(input: RecordTickInput): { added: number; bucket: BucketKey } {
  const bucket = resolveStudyBucket({
    chapterId: input.chapterId,
    screenKey: input.screenKey,
    subjectId: input.subjectId,
    foundationTab: input.foundationTab,
    mockKind: input.mockKind,
  });
  const solvedDelta =
    typeof input.solved === 'number' ? input.solved : consumeSolvedDelta(input.uid, input.to);

  const ledger = readLedger(input.uid);
  const result = addSeconds({
    ledger,
    seconds: input.seconds,
    to: input.to,
    bucket,
    solved: solvedDelta,
    accuracyDelta: input.accuracyDelta,
    dateKey: dayKeyOf(input.to),
  });
  if (result.changed) {
    writeLedger(input.uid, result.ledger);
    notifyTimelogChanged();
  }
  return { added: result.added, bucket };
}

// ===================================================================
// Firestore 同期（オフライン退避・オンライン復帰後再送・スロットル制御）
// ===================================================================

let syncDisabledForSession = false;
let lastSyncAttemptAt = 0;
let onlineListenerInstalled = false;

/**
 * Firestore 同期を行うべきか判定する。
 *   - 明示的に `VITE_EIKEN_SUGOROKU_TIMELOG_SYNC=false` のときは無効
 *   - 明示的に `VITE_EIKEN_SUGOROKU_TIMELOG_SYNC=true` のときは有効
 *   - 未設定時は「Firebase構成済み かつ 塾クラスに参加しているログイン生徒」に対して自動で有効化
 *     （一般の非塾生ユーザーの無駄な通信は増やさない）
 */
export function isSyncEnabled(uid?: string | null): boolean {
  try {
    const flag = (import.meta.env?.VITE_EIKEN_SUGOROKU_TIMELOG_SYNC as string | undefined)?.trim();
    if (flag === 'false') return false;
    if (flag === 'true') return true;
    if (!FIREBASE_CONFIGURED) return false;
    const targetUid = uid || auth.currentUser?.uid || '';
    if (!targetUid || targetUid === 'guest') return false;
    return loadJukuMemberships(targetUid).length > 0;
  } catch {
    return false;
  }
}

/** テスト用：送信ガードとスロットル時刻をリセット */
export function resetSyncGuardForTests(): void {
  syncDisabledForSession = false;
  lastSyncAttemptAt = 0;
}

/**
 * 未送信の日次ログ（dirtyDateKeys ＋ 当日分）と集計サマリー（study_summaries/{uid}）を
 * Firestore へ送信する。オフライン時は dirtyDateKeys に残したまま false を返し、
 * オンライン復帰時にまとめて再送する。
 */
export async function syncPendingLogs(
  uid: string | null | undefined,
  now = Date.now(),
  options?: { force?: boolean },
): Promise<boolean> {
  ensureOnlineRecoveryListener();
  if (syncDisabledForSession) return false;
  const me = auth.currentUser;
  if (!me || !uid || me.uid !== uid) return false;
  if (!isSyncEnabled(uid)) return false;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  if (!options?.force && now - lastSyncAttemptAt < MIN_SYNC_INTERVAL_MS) {
    return false;
  }
  lastSyncAttemptAt = now;

  const ledger = readLedger(uid);
  const todayKey = dayKeyOf(now);
  const candidateKeys = Array.from(
    new Set([...(ledger.dirtyDateKeys || []), todayKey]),
  ).filter((k) => {
    const d = ledger.days[k];
    return Boolean(d && (d.totalActiveSeconds > 0 || d.solvedCount > 0));
  });

  if (candidateKeys.length === 0) return false;

  const syncedKeys: string[] = [];
  try {
    // 直近最大7日分の未送信ログを順次送信（AI 1 の管理者ポータルが読む users/{uid}/sugoroku_study_logs/{dateKey}）
    for (const dateKey of candidateKeys.slice(-7)) {
      const day = ledger.days[dateKey];
      if (!day) continue;
      await setDoc(
        doc(db, `users/${uid}/${SUGOROKU_COLLECTIONS.sugorokuStudyLogs}`, dateKey),
        {
          uid,
          dateKey,
          totalActiveSeconds: Math.floor(day.totalActiveSeconds),
          byGradeSkill: day.byGradeSkill,
          solvedCount: Math.floor(day.solvedCount || 0),
          ...(day.accuracyByGradeSkill ? { accuracyByGradeSkill: day.accuracyByGradeSkill } : {}),
          updatedAt: Math.floor(day.updatedAt || now),
        },
        { merge: true },
      );
      syncedKeys.push(dateKey);
    }

    // 生徒ごとの高速一覧用サマリー（study_summaries/{uid}）も合わせて更新
    const summaryDoc = buildStudySummaryDoc(uid, ledger, now);
    await setDoc(
      doc(db, SUGOROKU_COLLECTIONS.studySummaries, uid),
      summaryDoc,
      { merge: true },
    ).catch(() => {
      /* study_summaries 側のみルール未反映の場合でも日次ログ同期は成功扱いとする */
    });

    if (syncedKeys.length > 0) {
      const latest = readLedger(uid);
      writeLedger(uid, markDatesSynced(latest, syncedKeys));
    }
    return syncedKeys.length > 0;
  } catch (error) {
    // 途中まで送れた分だけは dirty から外す
    if (syncedKeys.length > 0) {
      const latest = readLedger(uid);
      writeLedger(uid, markDatesSynced(latest, syncedKeys));
    }
    const code = (error as { code?: string } | null)?.code || '';
    if (code.includes('permission-denied') || code.includes('unauthenticated')) {
      syncDisabledForSession = true;
    }
    console.warn('[sugoroku/timelog] Firestore 同期保留（ローカル台帳に保全済み・復帰後再送）', error);
    return false;
  }
}

/** 後方互換エイリアス：当日＋未送信キューの同期 */
export async function syncToday(
  uid: string | null | undefined,
  now = Date.now(),
  force = false,
): Promise<boolean> {
  return syncPendingLogs(uid, now, { force });
}

/** ネットワーク復帰（online イベント）時に未送信ログを自動フラッシュする */
function ensureOnlineRecoveryListener(): void {
  if (onlineListenerInstalled || typeof window === 'undefined') return;
  onlineListenerInstalled = true;
  window.addEventListener('online', () => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      void syncPendingLogs(uid, Date.now(), { force: true });
    }
  });
}

// ===================================================================
// 表示用集計ヘルパー
// ===================================================================

export interface TimelogSummary {
  todaySeconds: number;
  weekSeconds: number;
  todaySolved: number;
  weekSolved: number;
  pendingSyncCount: number;
  /** 今週の内訳（秒）。多い順 */
  breakdown: Array<{ key: BucketKey; label: string; seconds: number }>;
}

/** 生徒の「今日・今週の分野別学習時間」要約 */
export function summarize(uid: string | null | undefined, now = Date.now()): TimelogSummary {
  const ledger = readLedger(uid);
  const today = ledger.days[dayKeyOf(now)];
  const week = sumRecentDays(ledger, now, 7);
  const breakdown = Object.entries(week.byGradeSkill)
    .filter(([, seconds]) => seconds > 0)
    .map(([key, seconds]) => ({ key, label: labelOfBucket(key), seconds }))
    .sort((a, b) => b.seconds - a.seconds);
  return {
    todaySeconds: Math.max(0, today?.totalActiveSeconds || 0),
    weekSeconds: week.totalSeconds,
    todaySolved: Math.max(0, today?.solvedCount || 0),
    weekSolved: week.solvedTotal,
    pendingSyncCount: (ledger.dirtyDateKeys || []).length,
    breakdown,
  };
}

/** 技能だけの合計（級をまたいだ「リスニングに何分」等） */
export function skillTotals(
  byGradeSkill: Record<BucketKey, number>,
): Record<SugorokuSkillKey | 'other', number> {
  const out: Record<string, number> = {
    reading: 0,
    listening: 0,
    vocab: 0,
    writing: 0,
    speaking: 0,
    other: 0,
  };
  Object.entries(byGradeSkill || {}).forEach(([key, seconds]) => {
    const skill = key === OTHER_BUCKET ? 'other' : key.split(':')[1] || 'other';
    out[skill] = (out[skill] || 0) + Math.max(0, seconds);
  });
  return out as Record<SugorokuSkillKey | 'other', number>;
}
