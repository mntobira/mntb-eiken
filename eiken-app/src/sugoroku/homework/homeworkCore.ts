/**
 * ===================================================================
 * 宿題（ペースメーカー）の純粋ロジック
 * ===================================================================
 *
 * ■ 何をするファイルか
 *   「先生が配った宿題」＋「生徒が解いた記録」＋「今日の日付」から、
 *   生徒のホーム画面に出す1枚のカードの内容（残り問数・今日のノート・
 *   声掛けメッセージ）を計算する。Firestore も DOM も触らない。
 *
 * ■ なぜ純粋関数に切り出すのか
 *   この機能の価値は「数字が正しいこと」そのものである。
 *   ・残り問数が実際より少ない → 生徒は宿題をやったつもりになる
 *   ・今日のノートが多すぎる   → 生徒は初日で諦める
 *   どちらも現場では致命的なので、日付・境界・端数の扱いを
 *   テストで固定できる形（＝入出力だけの関数）にしておく。
 *
 * ■ 数え方の約束（誠実さのルール）
 *   1. 「解いた」は既存の solved 台帳（`章ID::大問ID` → 初回解答時刻ms）で数える。
 *      生徒に追加の書き込みをさせない（既存の classAssignmentsCore と同じ思想）。
 *   2. solved は「初回に解いた時刻」しか持たない。したがって
 *      「今日解いた数」は“初めて解いたのが今日”の分だけになる。
 *      解き直しは数えない＝少なめに出る（評価上は安全側）。
 *   3. 締切は「その日の 23:59:59.999」。残り日数は今日を含める
 *      （今日が締切なら daysLeft = 1）。
 *   4. 端数は切り上げる。「1日 3.2 問」と言われても実行できないため、
 *      必要数は必ず整数で「4問」と出す。
 *
 * ■ このファイルは他の src を import しない（葉モジュール）
 */

import type { SugorokuHomeworkPlan, SugorokuHomeworkTask, SugorokuSkill } from '../shared/types';

/** 1問あたりの目安時間（秒）。「あと何分」を出すためだけに使う概算。 */
export const ESTIMATED_SECONDS_PER_PROBLEM = 75;

/** 1日に出すノートの上限（これ以上は「今日はここまで」と切る） */
export const MAX_DAILY_QUOTA = 60;

/** 「停滞」と見なす無学習日数（先生画面のアラートと同じ基準に揃える） */
export const STALL_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// ===================================================================
// 章ID → 級・技能
// ===================================================================

/**
 * 章IDの形（data/chapterIndex.generated.ts の実データから確認した5系統）
 *
 *   eiken_2_listening_r01_part1   リスニング 第1回 第1部
 *   eiken_2_listening_01          リスニング（旧形式）
 *   eiken_2_reading_01            リーディング
 *   eiken_2_vocabulary_01         語彙・文法のウォームアップ
 *   eiken_2_written_01_short      筆記 大問1 短文の語句空所補充
 *   eiken_2_written_01_cloze      筆記 長文の語句空所補充
 *   eiken_2_written_01_reading    筆記 長文読解
 *   eiken_2_written_01_reorder    筆記 並べ替え
 *   eiken_2_written_01_conversation 筆記 会話文
 *
 * ★章IDの形が変わったらこの関数だけ直せばよい★（他の場所に正規表現を散らかさない）
 */
const CHAPTER_ID_RE = /^eiken_(pre2plus|pre2|pre1|[1-5])_([a-z]+)(?:_(.+))?$/;

export interface ChapterRef {
  /** 級ID（= 教科ID。'eiken_2' など） */
  grade: string;
  /** 技能。判別できなければ null */
  skill: SugorokuSkill | null;
  /** 章の系統（'listening' / 'written' / 'vocabulary' / 'reading'） */
  family: string;
  /** 大問の種類（'short' / 'cloze' / 'reading' など。無ければ空文字） */
  variant: string;
}

/** 章IDから級・技能を読む。読めなければ null（未知IDで落とさない） */
export function parseChapterRef(chapterId: string | null | undefined): ChapterRef | null {
  const id = String(chapterId || '').trim();
  if (!id) return null;
  const m = CHAPTER_ID_RE.exec(id);
  if (!m) return null;
  const grade = `eiken_${m[1]}`;
  const family = m[2];
  const tail = m[3] || '';
  // 大問の種類は末尾の英字（数字は回数なので落とす）
  const variant = (tail.match(/[a-z_]+$/) || [''])[0].replace(/^_+/, '');

  let skill: SugorokuSkill | null = null;
  if (family === 'listening') skill = 'listening';
  else if (family === 'vocabulary') skill = 'vocab';
  else if (family === 'reading') skill = 'reading';
  else if (family === 'written') {
    // 短文の語句空所補充（大問1）は語彙、それ以外の筆記はリーディング
    if (/short/.test(variant)) skill = 'vocab';
    else if (/reorder|cloze|reading|conversation/.test(variant)) skill = 'reading';
    else skill = 'reading';
  }
  return { grade, skill, family, variant };
}

/** 級×技能のキー（Firestore の map キー。例 'eiken_2:listening'） */
export function gradeSkillKey(grade: string, skill: SugorokuSkill): string {
  return `${grade}:${skill}`;
}

/** 章IDの並びから「技能別の大問数」を数える（先生画面の内訳表示用） */
export function countBySkill(
  chapterIds: readonly string[],
  totals: Record<string, number>,
): Record<SugorokuSkill, number> {
  const out: Record<SugorokuSkill, number> = { reading: 0, listening: 0, writing: 0, speaking: 0, vocab: 0 };
  chapterIds.forEach((id) => {
    const ref = parseChapterRef(id);
    if (!ref || !ref.skill) return;
    out[ref.skill] += Math.max(0, Math.floor(totals[id] || 0));
  });
  return out;
}

// ===================================================================
// 日付
// ===================================================================

/** 日付キー 'YYYY-MM-DD'（端末のローカル日付。既存 toDateKey と同じ式） */
export function toDayKey(time: number): string {
  const d = new Date(time);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** その日の 0 時（ローカル） */
export function startOfDay(time: number): number {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 'YYYY-MM-DD' → その日の 23:59:59.999（既存 dueDateToMs と同じ解釈） */
export function endOfDayKey(dayKey: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || '').trim());
  if (!m) return Number.NaN;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  return d.getTime();
}

/**
 * 締切までの残り日数（今日を含む）。
 *   今日が締切 → 1
 *   明日が締切 → 2
 *   締切を過ぎた → 0
 */
export function daysLeftIncludingToday(dueAt: number, now: number): number {
  const due = startOfDay(dueAt);
  const today = startOfDay(now);
  const diff = Math.round((due - today) / DAY_MS);
  return Math.max(0, diff + 1);
}

// ===================================================================
// 進み具合
// ===================================================================

/** solved 台帳から、指定した章の「解いた大問数」と「その日の解いた数」を数える */
export function countSolved(
  chapterIds: readonly string[],
  solved: Record<string, number> | null | undefined,
  now: number,
): { solved: number; solvedToday: number } {
  const targets = new Set(chapterIds);
  const todayStart = startOfDay(now);
  let count = 0;
  let today = 0;
  Object.entries(solved || {}).forEach(([key, at]) => {
    const chapterId = key.split('::')[0];
    if (!chapterId || !targets.has(chapterId)) return;
    count += 1;
    const t = Number(at);
    if (Number.isFinite(t) && t >= todayStart && t <= now) today += 1;
  });
  return { solved: count, solvedToday: today };
}

/** 章ごとの大問数（catalog の totalProblems）を合計する */
export function totalProblemsOf(chapterIds: readonly string[], totals: Record<string, number>): number {
  let sum = 0;
  chapterIds.forEach((id) => {
    sum += Math.max(0, Math.floor(totals[id] || 0));
  });
  return sum;
}

/**
 * 今日やるノート（問数）を決める。
 *
 *   優先順位
 *     1. 先生が dailyQuotaProblems を指定していれば、それ（上限 MAX_DAILY_QUOTA）
 *     2. 未指定なら「残り ÷ 残り日数」の切り上げ（＝そのまま進めば期限に間に合う量）
 *   ただし「今日すでにノート以上やった」場合は 0（もう十分）を返す。
 *
 *   ★「1日まとめ解き」を避けるのが目的なので、残りが少なくても最低1問は出す★
 *   （残り 0 のときだけ 0）
 */
export function computeTodayQuota(input: {
  remaining: number;
  daysLeft: number;
  plannedQuota?: number;
  doneToday: number;
}): number {
  const remaining = Math.max(0, Math.floor(input.remaining));
  if (remaining === 0) return 0;
  const days = Math.max(1, Math.floor(input.daysLeft));
  let quota: number;
  if (typeof input.plannedQuota === 'number' && Number.isFinite(input.plannedQuota) && input.plannedQuota > 0) {
    quota = Math.floor(input.plannedQuota);
  } else {
    quota = Math.ceil(remaining / days);
  }
  quota = Math.max(1, Math.min(MAX_DAILY_QUOTA, quota));
  // 今日もう十分やっているなら「残り 0」と出す（追い立てない）
  return Math.max(0, quota - Math.max(0, Math.floor(input.doneToday)));
}

/** 1日に必要な問数（残り ÷ 残り日数の切り上げ。表示用） */
export function computePerDayNeeded(remaining: number, daysLeft: number): number {
  const r = Math.max(0, Math.floor(remaining));
  if (r === 0) return 0;
  return Math.ceil(r / Math.max(1, Math.floor(daysLeft)));
}

/** あと何分か（概算）。0 なら「0分」 */
export function estimateMinutes(problems: number): number {
  const p = Math.max(0, Math.floor(problems));
  if (p === 0) return 0;
  return Math.max(1, Math.round((p * ESTIMATED_SECONDS_PER_PROBLEM) / 60));
}

// ===================================================================
// カード1枚ぶんの計算
// ===================================================================

export interface HomeworkInput {
  assignment: {
    id: string;
    classId: string;
    title: string;
    chapterIds: string[];
    dueAt: number;
  };
  className: string;
  plan?: SugorokuHomeworkPlan | null;
  /** 章ID → 大問数 */
  totals: Record<string, number>;
  /** solved 台帳（`章ID::大問ID` → 初回解答時刻ms） */
  solved: Record<string, number> | null | undefined;
  now: number;
}

/**
 * 生徒ホームのカード1枚を組み立てる。
 *   締切を過ぎていても消さない（「期限後に完了」として残す）。
 *   未完了の先頭の章を「次に開く単元」として返す（ワンタップ遷移の行き先）。
 */
export function buildHomeworkTask(input: HomeworkInput): SugorokuHomeworkTask {
  const { assignment, plan, totals, solved, now, className } = input;
  const chapterIds = Array.isArray(assignment.chapterIds) ? assignment.chapterIds : [];
  const total = totalProblemsOf(chapterIds, totals);
  const counted = countSolved(chapterIds, solved, now);
  // 章の大問数より多く数えない（データ入れ替えで古いキーが残っていても 100% を超えない）
  const solvedCount = total > 0 ? Math.min(counted.solved, total) : counted.solved;
  const remaining = Math.max(0, total - solvedCount);
  const daysLeft = daysLeftIncludingToday(assignment.dueAt, now);
  const overdue = assignment.dueAt < now && remaining > 0;
  const perDayNeeded = computePerDayNeeded(remaining, Math.max(1, daysLeft));

  // 今日のノート（先生指定があればそれ、無ければ自動）
  const quotaRaw = remaining === 0 ? 0 : (() => {
    const planned = plan?.dailyQuotaProblems;
    if (typeof planned === 'number' && planned > 0) return Math.floor(planned);
    return computePerDayNeeded(remaining, Math.max(1, daysLeft));
  })();
  const todayRemaining = computeTodayQuota({
    remaining,
    daysLeft: Math.max(1, daysLeft),
    plannedQuota: plan?.dailyQuotaProblems,
    doneToday: counted.solvedToday,
  });

  const percent = total > 0 ? Math.min(100, Math.round((solvedCount / total) * 100)) : 0;

  // 次に開く単元：未完了の先頭。全部終わっていれば先頭（復習として開ける）
  const nextChapterId = chapterIds.find((id) => {
    const one = countSolved([id], solved, now);
    const cap = Math.max(0, Math.floor(totals[id] || 0));
    return cap === 0 || one.solved < cap;
  }) || chapterIds[0] || '';

  let status: SugorokuHomeworkTask['status'];
  if (remaining === 0) status = assignment.dueAt < now ? 'late' : 'done';
  else if (solvedCount === 0) status = 'not_started';
  else if (todayRemaining === 0) status = 'on_track';
  else if (perDayNeeded > 0 && todayRemaining > perDayNeeded) status = 'behind';
  else status = 'ahead';

  return {
    assignmentId: assignment.id,
    classId: assignment.classId,
    className,
    title: assignment.title,
    chapterIds,
    dueAt: assignment.dueAt,
    nextChapterId,
    total,
    solved: solvedCount,
    remaining,
    percent,
    daysLeft,
    todayQuota: quotaRaw,
    todayDone: Math.min(counted.solvedToday, quotaRaw > 0 ? quotaRaw : counted.solvedToday),
    todayRemaining,
    status,
    overdue,
    perDayNeeded,
    message: paceMessage({ status, todayRemaining, remaining, daysLeft, overdue }),
  };
}

/**
 * 生徒への声掛け（1文）。
 *   ★責めない・急かしすぎない★ 運動部の生徒が「開くのが嫌になる」文言は失敗。
 *   事実（あと何問・あと何日）を短く出し、次の一歩だけを指す。
 */
export function paceMessage(input: {
  status: SugorokuHomeworkTask['status'];
  todayRemaining: number;
  remaining: number;
  daysLeft: number;
  overdue: boolean;
}): string {
  const { status, todayRemaining, remaining, daysLeft, overdue } = input;
  if (remaining === 0) return 'この宿題は全部おわったよ。よくがんばった！';
  if (overdue) return `締切を過ぎているけど、あと${remaining}問でおわる。今日中に1問だけでも進めよう。`;
  if (status === 'not_started' && todayRemaining <= 1) return 'まず1問だけ開いてみよう。1問でいい。';
  if (status === 'not_started') return `今日は${todayRemaining}問から。はじめの1問だけ開けば大丈夫。`;
  if (todayRemaining === 0) return '今日のノートは達成。この調子でキープしよう！';
  if (daysLeft <= 3) return `のこり${daysLeft}日。今日中にあと${todayRemaining}問で間に合うよ。`;
  return `今日はあと${todayRemaining}問。終われば今日はおしまい。`;
}

/** カードに出す並び順：締切が近い順（期限切れは後ろ） */
export function sortHomeworkTasks(tasks: SugorokuHomeworkTask[], now: number): SugorokuHomeworkTask[] {
  return [...tasks].sort((a, b) => {
    const ap = a.dueAt < now;
    const bp = b.dueAt < now;
    if (ap !== bp) return ap ? 1 : -1;
    if (a.remaining === 0 !== (b.remaining === 0)) return a.remaining === 0 ? 1 : -1;
    return a.dueAt - b.dueAt;
  });
}

/** 今日いちばん先に出す1件（無ければ null） */
export function pickPrimaryTask(tasks: SugorokuHomeworkTask[], now: number): SugorokuHomeworkTask | null {
  const open = sortHomeworkTasks(tasks.filter((t) => t.remaining > 0), now);
  if (open.length > 0) return open[0];
  return sortHomeworkTasks(tasks, now)[0] || null;
}

// ===================================================================
// 12週ルート（プリセット）
// ===================================================================

export interface WeeklyRoute {
  week: number;
  title: string;
  chapterIds: string[];
  /** その週の技能別 大問数 */
  bySkill: Record<SugorokuSkill, number>;
}

/**
 * 『英検2級 3か月（12週間）標準ルート』を、実際に存在する章IDから組み立てる。
 *
 * ■ 存在しない章は入れない
 *   級ごとに収録状況が違う（準2級プラスは筆記の回数が少ない等）。
 *   ここでは「候補のうち、available にあるものだけ」を拾う。
 *   これにより、データが増えれば自動で厚くなる。
 *
 * ■ 週の組み方（1週間で 語彙 → 短文 → 長文 → 空所補充 → リスニング）
 *   同じ大問番号（第N回）を週にまとめる。テスト直前に範囲が飛ばない。
 */
export function buildWeeklyRoute(
  grade: string,
  availableChapterIds: readonly string[],
  weeks = 12,
): WeeklyRoute[] {
  const set = new Set(availableChapterIds);
  const has = (id: string) => set.has(id);
  const pick = (...candidates: string[]) => candidates.filter((id) => has(id));

  const routes: WeeklyRoute[] = [];
  for (let week = 1; week <= weeks; week += 1) {
    // 12週に15回ぶんを割り当てるので、週によっては2回ぶん進む
    const rounds = week <= 3 ? [week] : [week + 2, week + 3].filter((n) => n <= 15);
    const ids: string[] = [];
    rounds.forEach((n) => {
      const nn = String(n).padStart(2, '0');
      ids.push(...pick(
        `${grade}_written_${nn}_short`,
        `${grade}_written_${nn}_cloze`,
        `${grade}_written_${nn}_reading`,
        `${grade}_listening_r${nn}_part1`,
        `${grade}_listening_r${nn}_part2`,
      ));
    });
    // 語彙は毎週うすく回す（同じ章を繰り返すのではなく、最初の週だけ入れる）
    if (week === 1) ids.push(...pick(`${grade}_vocabulary_01`, `${grade}_reading_01`));

    const bySkill: Record<SugorokuSkill, number> = { reading: 0, listening: 0, writing: 0, speaking: 0, vocab: 0 };
    ids.forEach((id) => {
      const ref = parseChapterRef(id);
      if (ref?.skill) bySkill[ref.skill] += 1;
    });
    routes.push({
      week,
      title: `第${week}週`,
      chapterIds: Array.from(new Set(ids)),
      bySkill,
    });
  }
  return routes;
}

/** プリセット定義（先生画面の選択肢）。id は plan.presetId に保存する。 */
export interface HomeworkPreset {
  id: string;
  label: string;
  grade: string;
  description: string;
}

export const HOMEWORK_PRESETS: readonly HomeworkPreset[] = [
  {
    id: 'eiken2-12w',
    label: '英検2級 3か月（12週間）標準ルート',
    grade: 'eiken_2',
    description: '語彙→短文→長文→空所補充→リスニングの順で、毎週同じ回をまとめて進めます。',
  },
  {
    id: 'eikenpre2-12w',
    label: '英検準2級 3か月（12週間）標準ルート',
    grade: 'eiken_pre2',
    description: '準2級の収録ぶんを同じ順序で割り当てます（足りない回は自動で飛ばします）。',
  },
];
