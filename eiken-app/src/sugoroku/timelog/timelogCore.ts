/**
 * ===================================================================
 * 分野別（級×技能）学習時間の計測 — 純粋ロジック
 * ===================================================================
 *
 * ■ 何をするファイルか
 *   既存の useStudyTimeTracker（15秒刻み・1分無操作除外・音声再生中は加算）が
 *   求めた「有効な秒数」を、
 *
 *      どの級の・どの技能に・何秒
 *
 *   へ振り分けて1日ぶんのログに足し込む。DOM も Firestore も触らない。
 *
 * ■ なぜ既存の studyTime.ts をそのまま使わないのか
 *   既存は「合計」と「日ごとの合計」しか持たない。
 *   すごろく様の要望は
 *     「誰が・英検何級の・どの分野（リスニング／リーディング／単語）を何分やったか」
 *   なので、合計だけでは足りない。ただし
 *   ★既存の合計（study_time_v1_）は1文字も変えない★
 *   （プロフィールカードの表示・先生画面の集計が既に依存している）。
 *   分野別は「追加の台帳」として別キーに持つ。
 *
 * ■ 二重計上の防止
 *   加算は既存と同じ「1 tick = 最大90秒」「1日 = 最大12時間」で頭打ちにする。
 *   タブを2枚開いても、各タブが自分の tick を送るので合計が増える。
 *   そこで tick には「端末ごとの通し番号」ではなく
 *   ★区間（from, to）を持たせ、同じ区間は1回しか足さない★。
 *   区間は [from, to) の半開区間で、既存の lastActive による切り詰めも同じ式を使う。
 *
 * ■ このファイルは他の src を import しない（葉モジュール）
 */

import type { SugorokuSkill } from '../shared/types';

/** 1 tick で足せる最大秒（既存 studyTime.ts の STEP_CAP と揃える） */
export const STEP_CAP_SECONDS = 90;
/** 1日の上限秒（既存の DAY_CAP と揃える） */
export const DAY_CAP_SECONDS = 12 * 3600;
/** 残す日数（既存の KEEP_DAYS と揃える） */
export const KEEP_DAYS = 60;
/** 学習とみなす操作の無い時間（既存 STUDY_IDLE_MS と揃える） */
export const IDLE_MS = 60 * 1000;

/** 級×技能キー（例 'eiken_2:listening'） */
export type BucketKey = string;

export interface TimelogDay {
  dateKey: string;
  totalActiveSeconds: number;
  byGradeSkill: Record<BucketKey, number>;
  solvedCount: number;
  /** 最後に足した区間の末尾（同じ区間の二重加算を防ぐ） */
  lastTo?: number;
  updatedAt: number;
}

export interface TimelogLedger {
  days: Record<string, TimelogDay>;
}

export function emptyLedger(): TimelogLedger {
  return { days: {} };
}

/** 端末のローカル日付キー 'YYYY-MM-DD' */
export function dayKeyOf(time: number): string {
  const d = new Date(time);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * 前回 from から今回 to までのうち「有効だった秒数」。
 *   既存 utils/studyTime.ts の activeStudySeconds と同じ式（切り詰めの考え方を揃える）。
 *   lastActive（最後の操作）から IDLE_MS を過ぎた分は捨てる。
 */
export function activeSeconds(from: number, to: number, lastActive: number, idleMs = IDLE_MS): number {
  const end = Math.min(to, lastActive + idleMs);
  return Math.max(0, (end - from) / 1000);
}

/**
 * 「どの級・どの技能か」が決まらない画面のぶんを入れるバケット。
 *   ★捨てない★：合計と内訳の差が説明できなくなるため、'other' として残す。
 */
export const OTHER_BUCKET = 'other';

/** 級×技能キーを作る */
export function bucketKey(grade: string | null | undefined, skill: SugorokuSkill | null | undefined): BucketKey {
  if (!grade || !skill) return OTHER_BUCKET;
  return `${grade}:${skill}`;
}

export interface AddSecondsInput {
  ledger: TimelogLedger;
  /** 加算する秒数（未加工。ここで頭打ちにする） */
  seconds: number;
  /** 区間の終わり（ms）。同じ値が前回の lastTo と同じなら二重加算とみなして捨てる */
  to: number;
  /** 振り分け先（決まらなければ OTHER_BUCKET） */
  bucket: BucketKey;
  /** その tick で解いた大問数（不明なら 0） */
  solved?: number;
  /** 'YYYY-MM-DD'。省略時は to から作る */
  dateKey?: string;
}

export interface AddSecondsResult {
  ledger: TimelogLedger;
  /** 実際に足した秒（頭打ち・二重加算の除外後） */
  added: number;
  /** 実際に足したか（保存の要否判定に使う） */
  changed: boolean;
}

/**
 * 1 tick ぶんを台帳へ足す（台帳は書き換えず、新しい台帳を返す）。
 *
 * 頭打ちの順序（ここが大事）
 *   1. 1 tick は最大 90 秒（通信が途切れて tick が飛んでも、まとめて数百秒にはしない）
 *   2. 1 日は最大 12 時間（置きっぱなしの端末で1日が埋まるのを防ぐ）
 *   3. 同じ区間（to が前回と同じ）は足さない（タブ2枚の二重計上を防ぐ）
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
  if (add <= 0) {
    // 上限に達していても lastTo だけは進める
    // （進めないと同じ区間判定が効かず、次の tick で古い区間を足してしまう）
    const base: TimelogDay = prev
      ? { ...prev, lastTo: input.to, updatedAt: input.to }
      : { dateKey, totalActiveSeconds: 0, byGradeSkill: {}, solvedCount: 0, lastTo: input.to, updatedAt: input.to };
    days[dateKey] = base;
    return { ledger: { days }, added: 0, changed: !!prev };
  }

  const byGradeSkill: Record<BucketKey, number> = { ...(prev?.byGradeSkill || {}) };
  byGradeSkill[input.bucket] = Math.max(0, Math.floor(byGradeSkill[input.bucket] || 0)) + add;

  days[dateKey] = {
    dateKey,
    totalActiveSeconds: dayTotal + add,
    byGradeSkill,
    solvedCount: Math.max(0, Math.floor(prev?.solvedCount || 0)) + Math.max(0, Math.floor(input.solved || 0)),
    lastTo: input.to,
    updatedAt: input.to,
  };

  return { ledger: { days: pruneDays(days) }, added: add, changed: true };
}

/** 古い日を落とす（KEEP_DAYS 日ぶんだけ残す）。容量が増え続けないように。 */
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
): { totalSeconds: number; byGradeSkill: Record<BucketKey, number> } {
  const out: Record<BucketKey, number> = {};
  let total = 0;
  for (let i = 0; i < days; i += 1) {
    const key = dayKeyOf(now - i * 86_400_000);
    const day = ledger.days[key];
    if (!day) continue;
    total += Math.max(0, day.totalActiveSeconds);
    Object.entries(day.byGradeSkill || {}).forEach(([k, v]) => {
      out[k] = (out[k] || 0) + Math.max(0, v);
    });
  }
  return { totalSeconds: total, byGradeSkill: out };
}

/** 秒 → 「1時間5分」「12分」「1分未満」（既存 formatStudyTime と同じ言い回し） */
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
  const gradeLabel = grade.replace(/^eiken_/, '').replace(/pre2plus/, '準2級プラス').replace(/^pre2$/, '準2級').replace(/^pre1$/, '準1級');
  const skillLabel: Record<string, string> = {
    listening: 'リスニング',
    reading: 'リーディング',
    writing: 'ライティング',
    speaking: 'スピーキング',
    vocab: '語彙',
  };
  const g = /^\d$/.test(gradeLabel) ? `${gradeLabel}級` : gradeLabel;
  return `${g} ${skillLabel[skill] || skill}`;
}
