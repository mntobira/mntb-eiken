/**
 * ===================================================================
 * 分野別学習時間の保存（localStorage 主・Firestore 従）
 * ===================================================================
 *
 * ■ 保存先
 *   localStorage['sugoroku_timelog_v1_<uid>'] = { days: { 'YYYY-MM-DD': TimelogDay } }
 *   Firestore  : eiken_sugoroku_study_logs/{uid}_{dateKey}
 *
 * ■ なぜ localStorage が主なのか
 *   ・電波が不安定な教室（iPad・校内Wi-Fi）でも計測が止まらない
 *   ・Firestore は書き込み回数で課金される。15秒ごとに書くと1授業で数百回になる
 *   そこで「端末に確実に残す」→「まとめて送る」の順にする（既存 studySync と同じ思想）。
 *
 * ■ Firestore への送信を既定で止めている理由（重要）
 *   送信先 eiken_sugoroku_study_logs のルールは AI 4 の担当で、まだ本番に入っていない。
 *   先に送ると全リクエストが permission-denied になり、コンソールが埋まり、
 *   通信量だけが増える。よって
 *     VITE_EIKEN_SUGOROKU_TIMELOG_SYNC === 'true'
 *   のときだけ送る。ルール反映後にこの環境変数を入れる（手順は docs に記載）。
 *   さらに、一度 permission-denied になったらその起動では送信を止める
 *   （設定ミスのまま毎分リトライしない）。
 *
 * ■ 送れなかったぶんは失われない
 *   ローカルに全日ぶんが残っているので、あとから「今日ぶん」を送り直せる。
 */

import { doc, setDoc } from '../../utils/firestoreMetered';
import { auth, db } from '../../firebase';
import { isPlainObject, readStoredJson } from '../../utils/safeLocalStorage';
import { safeSetItem } from '../../utils/storageGuard';
import {
  addSeconds,
  dayKeyOf,
  emptyLedger,
  labelOfBucket,
  OTHER_BUCKET,
  sumRecentDays,
  type BucketKey,
  type TimelogDay,
  type TimelogLedger,
} from './timelogCore';
import { parseChapterRef } from '../homework/homeworkCore';
import type { SugorokuSkill } from '../shared/types';

const KEY_PREFIX = 'sugoroku_timelog_v1_';

export function timelogKey(uid: string | null | undefined): string {
  return `${KEY_PREFIX}${encodeURIComponent(uid || 'guest')}`;
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
    if (!Number.isFinite(total) || total <= 0) return;
    const byGradeSkill: Record<BucketKey, number> = {};
    if (isPlainObject(value.byGradeSkill)) {
      Object.entries(value.byGradeSkill).forEach(([k, v]) => {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) byGradeSkill[k] = Math.floor(n);
      });
    }
    out[dateKey] = {
      dateKey,
      totalActiveSeconds: Math.floor(total),
      byGradeSkill,
      solvedCount: Math.max(0, Math.floor(Number(value.solvedCount) || 0)),
      lastTo: Number.isFinite(Number(value.lastTo)) ? Number(value.lastTo) : undefined,
      updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : 0,
    };
  });
  return { days: out };
}

/** 端末へ書く（容量不足でも学習は止めない） */
export function writeLedger(uid: string | null | undefined, ledger: TimelogLedger): void {
  try {
    safeSetItem(timelogKey(uid), JSON.stringify(ledger));
  } catch {
    /* 保存できなくても計測は続ける（次の tick でまた試す） */
  }
}

/** 章ID → 振り分け先バケット */
export function bucketOfChapter(chapterId: string | null | undefined): BucketKey {
  const ref = parseChapterRef(chapterId);
  if (!ref || !ref.skill) return OTHER_BUCKET;
  return `${ref.grade}:${ref.skill}`;
}

export interface RecordTickInput {
  uid: string | null | undefined;
  /** 有効だった秒数（activeStudySeconds の結果） */
  seconds: number;
  /** 区間の終わり（ms） */
  to: number;
  /** いま開いている章（級・技能の判定に使う） */
  chapterId?: string | null;
  /** 追加で「解いた」と分かっている数（不明なら省略） */
  solved?: number;
}

/**
 * 1 tick を台帳へ足して保存する。
 *   二重加算の判定は timelogCore.addSeconds（区間の末尾が同じなら捨てる）。
 */
export function recordTick(input: RecordTickInput): { added: number; bucket: BucketKey } {
  const bucket = bucketOfChapter(input.chapterId);
  const ledger = readLedger(input.uid);
  const result = addSeconds({
    ledger,
    seconds: input.seconds,
    to: input.to,
    bucket,
    solved: input.solved,
    dateKey: dayKeyOf(input.to),
  });
  if (result.changed) writeLedger(input.uid, result.ledger);
  return { added: result.added, bucket };
}

// ===================================================================
// Firestore 送信（任意）
// ===================================================================

/** 送信が許可されているか（環境変数で明示的に有効化したときだけ） */
export function isSyncEnabled(): boolean {
  try {
    return import.meta.env?.VITE_EIKEN_SUGOROKU_TIMELOG_SYNC === 'true';
  } catch {
    return false;
  }
}

/** この起動で送信を諦めたか（permission-denied の連打を防ぐ） */
let syncDisabledForSession = false;

/** テスト用：送信の停止フラグを戻す */
export function resetSyncGuardForTests(): void {
  syncDisabledForSession = false;
}

/**
 * 今日ぶんのログを Firestore へ送る。
 *   ★失敗しても例外を投げない★（呼び出し側は計測のついでに呼ぶだけ）。
 */
export async function syncToday(uid: string | null | undefined, now = Date.now()): Promise<boolean> {
  if (!isSyncEnabled() || syncDisabledForSession) return false;
  const me = auth.currentUser;
  if (!me || !uid || me.uid !== uid) return false;
  const dateKey = dayKeyOf(now);
  const day = readLedger(uid).days[dateKey];
  if (!day || day.totalActiveSeconds <= 0) return false;
  try {
    await setDoc(doc(db, 'sugoroku_study_logs', `${uid}_${dateKey}`), {
      uid,
      dateKey,
      totalActiveSeconds: Math.floor(day.totalActiveSeconds),
      byGradeSkill: day.byGradeSkill,
      solvedCount: Math.floor(day.solvedCount || 0),
      updatedAt: Math.floor(now),
    });
    return true;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code || '';
    if (code.includes('permission-denied') || code.includes('unauthenticated')) {
      syncDisabledForSession = true;
    }
    // 画面に出さない（計測はローカルで継続している）
    console.warn('[sugoroku/timelog] Firestore へ送れませんでした（ローカルには保存済み）', error);
    return false;
  }
}

// ===================================================================
// 表示用
// ===================================================================

export interface TimelogSummary {
  todaySeconds: number;
  weekSeconds: number;
  /** 今週の内訳（秒）。多い順 */
  breakdown: Array<{ key: BucketKey; label: string; seconds: number }>;
}

/** 生徒の「今週の内訳」表示（ホーム・マイページ用） */
export function summarize(uid: string | null | undefined, now = Date.now()): TimelogSummary {
  const ledger = readLedger(uid);
  const today = ledger.days[dayKeyOf(now)];
  const week = sumRecentDays(ledger, now, 7);
  const breakdown = Object.entries(week.byGradeSkill)
    .map(([key, seconds]) => ({ key, label: labelOfBucket(key), seconds }))
    .sort((a, b) => b.seconds - a.seconds);
  return {
    todaySeconds: Math.max(0, today?.totalActiveSeconds || 0),
    weekSeconds: week.totalSeconds,
    breakdown,
  };
}

/** 技能だけの合計（級をまたいだ「リスニングに何分」）。先生画面の要約に使う */
export function skillTotals(byGradeSkill: Record<BucketKey, number>): Record<SugorokuSkill | 'other', number> {
  const out: Record<string, number> = {};
  Object.entries(byGradeSkill || {}).forEach(([key, seconds]) => {
    const skill = key === OTHER_BUCKET ? 'other' : key.split(':')[1] || 'other';
    out[skill] = (out[skill] || 0) + Math.max(0, seconds);
  });
  return out as Record<SugorokuSkill | 'other', number>;
}
