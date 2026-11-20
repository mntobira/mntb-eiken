/**
 * ===================================================================
 * 分野別（級×技能）アクティブ学習時間の計測 — 純粋ロジック
 * ===================================================================
 *
 * ■ 役割
 *   既存の useStudyTimeTracker（15秒刻み・1分無操作除外・音声再生中は加算）が
 *   求めた「有効な秒数」を、現在の画面（screenKey）・選択級（subjectId）・単元（chapterId）から
 *
 *      どの級（eiken_5 〜 eiken_1）の・どの技能（reading / listening / writing / speaking / vocab）に・何秒
 *
 *   へ正確に振り分けて1日ぶんの台帳へ蓄積する。DOM も Firestore も触らない純粋関数層。
 *
 * ■ 既存資産保護
 *   既存の合計台帳（`study_time_v1_`）は1文字も変更しない。
 *   分野別ログは独立台帳として並置し、オフライン時は未送信日（dirtyDateKeys）を保持して
 *   オンライン復帰時に再送する。
 */

import type { SugorokuSkillKey, SugorokuStudyLogDoc, SugorokuStudySummaryDoc } from '../shared/types';
import { parseChapterRef } from '../homework/homeworkCore';

/** 1 tick で加算できる最大秒数（既存 studyTime.ts の STEP_CAP と同一） */
export const STEP_CAP_SECONDS = 90;
/** 1日の最大有効学習秒数（12時間＝置きっぱなし暴走防止） */
export const DAY_CAP_SECONDS = 12 * 3600;
/** ローカル台帳に保持する日数（既存の KEEP_DAYS と同一） */
export const KEEP_DAYS = 60;
/** 有効学習とみなす無操作許容時間（1分間無操作で自動停止） */
export const IDLE_MS = 60 * 1000;

/** 級×技能キー（例 'eiken_2:listening'） */
export type BucketKey = string;

/** 級・技能が特定できない場合のフォールバックバケット */
export const OTHER_BUCKET = 'other';

export interface TimelogDay extends SugorokuStudyLogDoc {
  /** 最後に加算した区間の終端タイムスタンプ（二重計上防止） */
  lastTo?: number;
}

export interface TimelogLedger {
  days: Record<string, TimelogDay>;
  /** オフライン等で Firestore 未同期の日付キー一覧（再接続時に優先再送） */
  dirtyDateKeys?: string[];
}

export function emptyLedger(): TimelogLedger {
  return { days: {}, dirtyDateKeys: [] };
}

/** 端末のローカル日付キー 'YYYY-MM-DD' */
export function dayKeyOf(time: number): string {
  const d = new Date(time);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * 前回 from から今回 to までのうち「有効だった秒数」を算出する。
 *   lastActive（最後の操作または音声再生時刻）から IDLE_MS（60秒）を過ぎた分は除外する。
 */
export function activeSeconds(from: number, to: number, lastActive: number, idleMs = IDLE_MS): number {
  const end = Math.min(to, lastActive + idleMs);
  return Math.max(0, (end - from) / 1000);
}

/** 級×技能キーを作る */
export function bucketKey(
  grade: string | null | undefined,
  skill: SugorokuSkillKey | null | undefined,
): BucketKey {
  const g = String(grade || '').trim();
  if (!g || !skill || !/^eiken_(pre2plus|pre2|pre1|[1-5])$/.test(g)) return OTHER_BUCKET;
  return `${g}:${skill}`;
}

/**
 * 現在の学習コンテキスト（単元ID・画面キー・選択中の級・補助タブ）から
 * 最も正確な「級×技能」バケットを解決する。
 *
 *   1. chapterId があれば parseChapterRef(chapterId) を最優先
 *   2. screenKey === 'writing' なら `${subjectId}:writing`
 *   3. screenKey === 'speaking' / 'speaking_scbt' なら `${subjectId}:speaking`
 *   4. screenKey === 'foundation' なら foundationTab に応じて vocab / reading
 *   5. screenKey === 'mock' なら mockKind に応じて listening / reading
 */
export interface StudyContextInput {
  chapterId?: string | null;
  screenKey?: string | null;
  subjectId?: string | null;
  foundationTab?: 'words' | 'quiz' | 'reading' | 'grammar' | 'more' | string | null;
  mockKind?: 'written' | 'listening' | 'full' | string | null;
}

export function resolveStudyBucket(ctx: StudyContextInput): BucketKey {
  // 1. 単元IDが明確にある場合（通常の4択・長文・リスニング・語彙演習）
  const ref = parseChapterRef(ctx.chapterId);
  if (ref && ref.skill) {
    return bucketKey(ref.grade, ref.skill);
  }

  const grade = String(ctx.subjectId || '').trim();
  const validGrade = /^eiken_(pre2plus|pre2|pre1|[1-5])$/.test(grade) ? grade : null;
  const screen = String(ctx.screenKey || '').trim();

  if (screen === 'writing') {
    return bucketKey(validGrade, 'writing');
  }
  if (screen === 'speaking' || screen === 'speaking_scbt') {
    return bucketKey(validGrade, 'speaking');
  }
  if (screen === 'foundation') {
    if (ctx.foundationTab === 'reading') return bucketKey(validGrade, 'reading');
    return bucketKey(validGrade, 'vocab');
  }
  if (screen === 'mock') {
    if (ctx.mockKind === 'listening') return bucketKey(validGrade, 'listening');
    return bucketKey(validGrade, 'reading');
  }

  return OTHER_BUCKET;
}

export interface AddSecondsInput {
  ledger: TimelogLedger;
  /** 加算する秒数（未加工。ここで90秒・12時間上限をかける） */
  seconds: number;
  /** 区間の終端（ms）。前回の lastTo 以下なら二重計上とみなして棄却する */
  to: number;
  /** 振り分け先（決まらなければ OTHER_BUCKET） */
  bucket: BucketKey;
  /** その tick で新規に解いた問題数（差分） */
  solved?: number;
  /** オプション：正答数・解答数の増分 */
  accuracyDelta?: { correct: number; total: number };
  /** 'YYYY-MM-DD'。省略時は to から算出 */
  dateKey?: string;
}

export interface AddSecondsResult {
  ledger: TimelogLedger;
  /** 実際に加算された秒数 */
  added: number;
  /** 台帳が更新されたか */
  changed: boolean;
}

/**
 * 1 tick ぶんを台帳へイミュータブルに加算する。
 *   - 1 tick 最大 90 秒
 *   - 1 日最大 12 時間
 *   - 同一終端（lastTo === to）は二重加算防止のためスキップ
 *   - 加算された日付は dirtyDateKeys に積まれ、Firestore 同期成功まで保持される
 */
export function addSeconds(input: AddSecondsInput): AddSecondsResult {
  const dateKey = input.dateKey || dayKeyOf(input.to);
  const days = { ...input.ledger.days };
  const prev = days[dateKey];

  if (prev && typeof prev.lastTo === 'number' && prev.lastTo === input.to) {
    return { ledger: input.ledger, added: 0, changed: false };
  }

  const dayTotal = prev ? Math.max(0, Math.floor(prev.totalActiveSeconds)) : 0;
  const room = Math.max(0, DAY_CAP_SECONDS - dayTotal);
  const want = Math.min(STEP_CAP_SECONDS, Math.max(0, Math.floor(input.seconds)));
  const add = Math.min(want, room);
  const solvedDelta = Math.max(0, Math.floor(input.solved || 0));

  if (add <= 0 && solvedDelta <= 0 && !input.accuracyDelta) {
    const base: TimelogDay = prev
      ? { ...prev, lastTo: input.to, updatedAt: input.to }
      : { dateKey, totalActiveSeconds: 0, byGradeSkill: {}, solvedCount: 0, lastTo: input.to, updatedAt: input.to };
    days[dateKey] = base;
    return {
      ledger: { days, dirtyDateKeys: input.ledger.dirtyDateKeys || [] },
      added: 0,
      changed: !!prev,
    };
  }

  const byGradeSkill: Record<BucketKey, number> = { ...(prev?.byGradeSkill || {}) };
  if (add > 0) {
    byGradeSkill[input.bucket] = Math.max(0, Math.floor(byGradeSkill[input.bucket] || 0)) + add;
  }

  let accuracyByGradeSkill = prev?.accuracyByGradeSkill ? { ...prev.accuracyByGradeSkill } : undefined;
  if (input.accuracyDelta && input.accuracyDelta.total > 0 && input.bucket !== OTHER_BUCKET) {
    accuracyByGradeSkill = accuracyByGradeSkill || {};
    const cur = accuracyByGradeSkill[input.bucket] || { correct: 0, total: 0 };
    accuracyByGradeSkill[input.bucket] = {
      correct: cur.correct + Math.max(0, Math.floor(input.accuracyDelta.correct)),
      total: cur.total + Math.max(0, Math.floor(input.accuracyDelta.total)),
    };
  }

  days[dateKey] = {
    dateKey,
    totalActiveSeconds: dayTotal + add,
    byGradeSkill,
    solvedCount: Math.max(0, Math.floor(prev?.solvedCount || 0)) + solvedDelta,
    ...(accuracyByGradeSkill ? { accuracyByGradeSkill } : {}),
    lastTo: input.to,
    updatedAt: input.to,
  };

  const prunedDays = pruneDays(days);
  const dirtySet = new Set(
    (input.ledger.dirtyDateKeys || []).filter((k) => Boolean(prunedDays[k])),
  );
  dirtySet.add(dateKey);

  return {
    ledger: {
      days: prunedDays,
      dirtyDateKeys: [...dirtySet].sort(),
    },
    added: add,
    changed: true,
  };
}

/** 同期完了した日付を dirtyDateKeys から外す */
export function markDatesSynced(ledger: TimelogLedger, syncedDateKeys: readonly string[]): TimelogLedger {
  if (!syncedDateKeys.length) return ledger;
  const done = new Set(syncedDateKeys);
  const nextDirty = (ledger.dirtyDateKeys || []).filter((k) => !done.has(k));
  return { ...ledger, dirtyDateKeys: nextDirty };
}

/** 古い日を落とす（KEEP_DAYS 日ぶんだけ残す） */
export function pruneDays(days: Record<string, TimelogDay>, keep = KEEP_DAYS): Record<string, TimelogDay> {
  const keys = Object.keys(days).sort();
  if (keys.length <= keep) return days;
  const keepKeys = keys.slice(-keep);
  const out: Record<string, TimelogDay> = {};
  keepKeys.forEach((k) => {
    out[k] = days[k];
  });
  return out;
}

/** 直近 N 日の合計（先生画面・生徒の「今週」表示用） */
export function sumRecentDays(
  ledger: TimelogLedger,
  now: number,
  days: number,
): { totalSeconds: number; byGradeSkill: Record<BucketKey, number>; solvedTotal: number } {
  const out: Record<BucketKey, number> = {};
  let total = 0;
  let solvedTotal = 0;
  for (let i = 0; i < days; i += 1) {
    const key = dayKeyOf(now - i * 86_400_000);
    const day = ledger.days[key];
    if (!day) continue;
    total += Math.max(0, day.totalActiveSeconds);
    solvedTotal += Math.max(0, day.solvedCount || 0);
    Object.entries(day.byGradeSkill || {}).forEach(([k, v]) => {
      out[k] = (out[k] || 0) + Math.max(0, v);
    });
  }
  return { totalSeconds: total, byGradeSkill: out, solvedTotal };
}

/**
 * 台帳全体から study_summaries/{uid} 用の集計ドキュメントを生成する
 */
export function buildStudySummaryDoc(
  uid: string,
  ledger: TimelogLedger,
  now: number,
): SugorokuStudySummaryDoc {
  const byGradeSkillTotal: Record<BucketKey, number> = {};
  let totalActiveSeconds = 0;
  let solvedTotal = 0;
  let lastActiveAt = 0;
  let lastDateKey = '';

  Object.values(ledger.days).forEach((day) => {
    if (!day || day.totalActiveSeconds <= 0) return;
    totalActiveSeconds += Math.max(0, Math.floor(day.totalActiveSeconds));
    solvedTotal += Math.max(0, Math.floor(day.solvedCount || 0));
    if ((day.updatedAt || 0) > lastActiveAt) lastActiveAt = day.updatedAt || 0;
    if (day.dateKey > lastDateKey) lastDateKey = day.dateKey;
    Object.entries(day.byGradeSkill || {}).forEach(([k, v]) => {
      if (v > 0) byGradeSkillTotal[k] = (byGradeSkillTotal[k] || 0) + Math.floor(v);
    });
  });

  const todayKey = dayKeyOf(now);
  const todayActiveSeconds = Math.max(0, Math.floor(ledger.days[todayKey]?.totalActiveSeconds || 0));
  const weekly = sumRecentDays(ledger, now, 7);

  return {
    uid,
    totalActiveSeconds,
    weeklyActiveSeconds: weekly.totalSeconds,
    todayActiveSeconds,
    byGradeSkillTotal,
    solvedTotal,
    lastActiveAt: lastActiveAt || now,
    lastDateKey: lastDateKey || todayKey,
    updatedAt: Math.floor(now),
  };
}

/** 秒 → 「1時間5分」「12分」「1分未満」 */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  if (m < 1) return s > 0 ? '1分未満' : '0分';
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}時間${m % 60 ? `${m % 60}分` : ''}` : `${m}分`;
}

/** 内訳キー → 表示（'eiken_2:listening' → '2級 リスニング'） */
export function labelOfBucket(key: BucketKey): string {
  if (key === OTHER_BUCKET) return 'その他';
  const [grade, skill] = key.split(':');
  const gradeLabel = (grade || '')
    .replace(/^eiken_/, '')
    .replace(/^pre2plus$/, '準2級プラス')
    .replace(/^pre2$/, '準2級')
    .replace(/^pre1$/, '準1級');
  const skillLabel: Record<string, string> = {
    listening: 'リスニング',
    reading: 'リーディング',
    writing: 'ライティング',
    speaking: 'スピーキング',
    vocab: '単語・語彙',
  };
  const g = /^\d$/.test(gradeLabel) ? `${gradeLabel}級` : gradeLabel;
  return `${g} ${skillLabel[skill] || skill}`.trim();
}
