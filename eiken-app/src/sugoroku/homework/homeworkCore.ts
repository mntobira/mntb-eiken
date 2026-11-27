/**
 * ===================================================================
 * 宿題（ペースメーカー）の純粋ロジック
 * ===================================================================
 *
 * ■ 役割
 *   「先生が配信した宿題＋ペースメーカー設定」＋「生徒が解いた記録」＋「今日の日付」から、
 *   生徒のホーム画面最上部に出す「今日の宿題」カードの内容（残り問数・今日の推奨ノルマ・
 *   1日まとめ解きしすぎ警告・未着手/遅延声掛けメッセージ）を純粋関数で算出する。
 *   Firestore も DOM も一切触らないため、境界値テストで 100% 検証可能。
 *
 * ■ このファイルは他の実体モジュールを import しない（型のみの葉モジュール）
 */

import type {
  SugorokuHomeworkPlan,
  SugorokuHomeworkTask,
  SugorokuSkillBreakdown,
  SugorokuSkillKey,
} from '../shared/types';

/** 1問あたりの目安時間（秒）。「目安 ○分」算出用 */
export const ESTIMATED_SECONDS_PER_PROBLEM = 75;

/** 1日に出す推奨ノルマの上限（過負荷防止） */
export const MAX_DAILY_QUOTA = 60;

/** 「停滞」と見なす無学習日数（管理者画面のアラート基準と統一） */
export const STALL_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// ===================================================================
// 章ID → 級・技能の解決
// ===================================================================

const CHAPTER_ID_RE = /^eiken_(pre2plus|pre2|pre1|[1-5])_([a-z]+)(?:_(.+))?$/;

export interface ChapterRef {
  /** 級ID（'eiken_2' など） */
  grade: string;
  /** 技能（reading / listening / vocab / writing / speaking）。判別不能時は null */
  skill: SugorokuSkillKey | null;
  /** 章の系統（'listening' / 'written' / 'vocabulary' / 'reading' 等） */
  family: string;
  /** 大問の種類（'short' / 'cloze' / 'reading' など） */
  variant: string;
}

/** 章IDから級・技能を解析する。未知IDでも例外を投げず null を返す */
export function parseChapterRef(chapterId: string | null | undefined): ChapterRef | null {
  const id = String(chapterId || '').trim();
  if (!id) return null;
  const m = CHAPTER_ID_RE.exec(id);
  if (!m) return null;
  const grade = `eiken_${m[1]}`;
  const family = m[2];
  const tail = m[3] || '';
  const variant = (tail.match(/[a-z][a-z0-9]*$/) || [''])[0];

  let skill: SugorokuSkillKey | null = null;
  if (family === 'listening') skill = 'listening';
  else if (family === 'vocabulary' || family === 'vocab' || family === 'wordbook') skill = 'vocab';
  else if (family === 'writing') skill = 'writing';
  else if (family === 'speaking') skill = 'speaking';
  else if (family === 'reading') skill = 'reading';
  else if (family === 'written') {
    // 一次筆記 大問1（短文の語句空所補充）は語彙・熟語力、長文空所・長文読解・整序・会話はリーディングに分類
    if (/short/.test(variant)) skill = 'vocab';
    else skill = 'reading';
  }
  return { grade, skill, family, variant };
}

/** 級×技能のキー（Firestore の map キー。例 'eiken_2:listening'） */
export function gradeSkillKey(grade: string, skill: SugorokuSkillKey): string {
  return `${grade}:${skill}`;
}

/** 章IDの並びから「技能別の問題数内訳」を集計する（先生画面のプレビュー＆生徒カード表示用） */
export function countBySkill(
  chapterIds: readonly string[],
  totals: Record<string, number>,
): Record<SugorokuSkillKey, number> {
  const out: Record<SugorokuSkillKey, number> = {
    reading: 0,
    listening: 0,
    writing: 0,
    speaking: 0,
    vocab: 0,
  };
  chapterIds.forEach((id) => {
    const ref = parseChapterRef(id);
    if (!ref || !ref.skill) return;
    out[ref.skill] += Math.max(0, Math.floor(totals[id] || 0));
  });
  return out;
}

/** 0 より大きい項目だけを持つ SugorokuSkillBreakdown に整形する */
export function compactSkillBreakdown(
  counts: Partial<Record<SugorokuSkillKey, number>>,
): SugorokuSkillBreakdown {
  const out: SugorokuSkillBreakdown = {};
  (['reading', 'listening', 'vocab', 'writing', 'speaking'] as const).forEach((k) => {
    const v = Math.max(0, Math.floor(Number(counts[k]) || 0));
    if (v > 0) out[k] = v;
  });
  return out;
}

// ===================================================================
// 日付ユーティリティ
// ===================================================================

/** 日付キー 'YYYY-MM-DD'（端末のローカル日付） */
export function toDayKey(time: number): string {
  const d = new Date(time);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** その日の 00:00:00.000（ローカル） */
export function startOfDay(time: number): number {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 'YYYY-MM-DD' → その日の 23:59:59.999 */
export function endOfDayKey(dayKey: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || '').trim());
  if (!m) return Number.NaN;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  return d.getTime();
}

/**
 * 締切までの残り日数（今日を含む）。
 *   今日が締切 → 1 / 明日が締切 → 2 / 締切超過 → 0
 */
export function daysLeftIncludingToday(dueAt: number, now: number): number {
  const due = startOfDay(dueAt);
  const today = startOfDay(now);
  const diff = Math.round((due - today) / DAY_MS);
  return Math.max(0, diff + 1);
}

// ===================================================================
// 進捗＆日割りペース計算
// ===================================================================

/** solved 台帳から、指定した章の「解いた問題数」と「今日解いた問題数」を集計する */
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
    if (Number.isFinite(t) && t >= todayStart && t <= now + 60_000) today += 1;
  });
  return { solved: count, solvedToday: today };
}

/** 章ごとの問題数（catalog の totalProblems）を合算する */
export function totalProblemsOf(chapterIds: readonly string[], totals: Record<string, number>): number {
  let sum = 0;
  chapterIds.forEach((id) => {
    sum += Math.max(0, Math.floor(totals[id] || 0));
  });
  return sum;
}

/**
 * 今日あと解くべき推奨問数（残りノルマ）を決める。
 *   1. 先生が dailyQuotaProblems を指定していればその値（ただし残り総数を上限とする）
 *   2. 未指定なら「未消化問題数 ÷ 残り日数」の切り上げ
 *   3. 今日すでに目標数以上解いていれば 0（「今日のノルマ達成！」）を返す
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
  const doneToday = Math.max(0, Math.floor(input.doneToday));
  // 今日を始める時点での残り問題数 = 現在の残り + 今日解いた分
  const remainingAtStartOfToday = remaining + doneToday;
  let targetForToday: number;
  if (
    typeof input.plannedQuota === 'number' &&
    Number.isFinite(input.plannedQuota) &&
    input.plannedQuota > 0
  ) {
    targetForToday = Math.min(remainingAtStartOfToday, Math.floor(input.plannedQuota));
  } else {
    targetForToday = Math.ceil(remainingAtStartOfToday / days);
  }
  targetForToday = Math.max(1, Math.min(MAX_DAILY_QUOTA, targetForToday));
  return Math.max(0, Math.min(remaining, targetForToday - doneToday));
}

/** 1日に必要な平均問数（現在の残り ÷ 残り日数の切り上げ） */
export function computePerDayNeeded(remaining: number, daysLeft: number): number {
  const r = Math.max(0, Math.floor(remaining));
  if (r === 0) return 0;
  return Math.ceil(r / Math.max(1, Math.floor(daysLeft)));
}

/** 問題数 → 目安分数（0問なら 0分） */
export function estimateMinutes(problems: number): number {
  const p = Math.max(0, Math.floor(problems));
  if (p === 0) return 0;
  return Math.max(1, Math.round((p * ESTIMATED_SECONDS_PER_PROBLEM) / 60));
}

// ===================================================================
// カード1枚ぶんの表示モデル組み立て
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
  /** 章ID → 問題数 */
  totals: Record<string, number>;
  /** solved 台帳（`章ID::問題ID` → 初回解答時刻ms） */
  solved: Record<string, number> | null | undefined;
  now: number;
}

/**
 * 生徒ホーム最上部「今日の宿題」カード1枚を組み立てる。
 *   - 未完了の先頭の章を `nextChapterId` として返し、ワンタップ演習遷移を実現
 *   - 1日で推奨ペースの2倍以上（かつ12問以上）を一気に解いた場合は `overPacedToday` を立て、
 *     「1日まとめ解き」を防いで明日への分散定着を促す声掛けを行う
 */
export function buildHomeworkTask(input: HomeworkInput): SugorokuHomeworkTask {
  const { assignment, plan, totals, solved, now, className } = input;
  const chapterIds = Array.isArray(assignment.chapterIds) ? assignment.chapterIds : [];
  const rawTotal = totalProblemsOf(chapterIds, totals);
  const skillSum = plan?.skillBreakdown
    ? Object.values(plan.skillBreakdown).reduce<number>((acc, v) => acc + Math.max(0, Number(v) || 0), 0)
    : 0;
  const total = rawTotal > 0 ? rawTotal : skillSum;

  const counted = countSolved(chapterIds, solved, now);
  const solvedCount = total > 0 ? Math.min(counted.solved, total) : counted.solved;
  const remaining = Math.max(0, total - solvedCount);
  const daysLeft = daysLeftIncludingToday(assignment.dueAt, now);
  const overdue = assignment.dueAt < now && remaining > 0;
  const perDayNeeded = computePerDayNeeded(remaining, Math.max(1, daysLeft));

  const remainingAtStartOfToday = remaining + counted.solvedToday;
  const quotaTarget =
    remaining === 0 && counted.solvedToday === 0
      ? 0
      : typeof plan?.dailyQuotaProblems === 'number' && plan.dailyQuotaProblems > 0
        ? Math.min(MAX_DAILY_QUOTA, Math.floor(plan.dailyQuotaProblems))
        : Math.max(1, Math.min(MAX_DAILY_QUOTA, Math.ceil(remainingAtStartOfToday / Math.max(1, daysLeft))));

  const todayRemaining = computeTodayQuota({
    remaining,
    daysLeft: Math.max(1, daysLeft),
    plannedQuota: plan?.dailyQuotaProblems,
    doneToday: counted.solvedToday,
  });

  // 1日まとめ解き検知：推奨1日ノルマの2倍以上（かつ最低12問以上）を今日1日で詰め込んだ場合
  const overPacedToday =
    quotaTarget >= 5 &&
    counted.solvedToday >= Math.max(12, quotaTarget * 2) &&
    remaining > 0;

  const percent = total > 0 ? Math.min(100, Math.round((solvedCount / total) * 100)) : 0;

  // 次に開く単元：未完了の先頭。すべて完了時は復習用に先頭単元
  const nextChapterId =
    chapterIds.find((id) => {
      const one = countSolved([id], solved, now);
      const cap = Math.max(0, Math.floor(totals[id] || 0));
      return cap === 0 || one.solved < cap;
    }) ||
    chapterIds[0] ||
    '';

  const autoBreakdown = compactSkillBreakdown(countBySkill(chapterIds, totals));
  const skillBreakdown: SugorokuSkillBreakdown =
    plan?.skillBreakdown && Object.keys(plan.skillBreakdown).length > 0
      ? plan.skillBreakdown
      : autoBreakdown;

  const targetLaps =
    typeof plan?.targetLaps === 'number' && Number.isFinite(plan.targetLaps) && plan.targetLaps >= 1
      ? Math.min(10, Math.floor(plan.targetLaps))
      : undefined;
  const coachInstruction =
    typeof plan?.coachInstruction === 'string' && plan.coachInstruction.trim()
      ? plan.coachInstruction.trim().slice(0, 140)
      : undefined;
  const isPersonalized = Boolean(
    plan?.targetStudentUids && plan.targetStudentUids.length > 0,
  );

  let status: SugorokuHomeworkTask['status'];
  if (remaining === 0) status = assignment.dueAt < now ? 'late' : 'done';
  else if (overdue) status = 'behind';
  else if (solvedCount === 0) status = 'not_started';
  else if (todayRemaining === 0) status = 'on_track';
  else if (quotaTarget > 0 && perDayNeeded > quotaTarget) status = 'behind';
  else status = 'ahead';

  return {
    assignmentId: assignment.id,
    classId: assignment.classId,
    className,
    title: assignment.title,
    chapterIds,
    dueAt: assignment.dueAt,
    startAt: plan?.startAt,
    nextChapterId,
    total,
    solved: solvedCount,
    remaining,
    percent,
    daysLeft,
    todayQuota: quotaTarget,
    todayDone: counted.solvedToday,
    todayRemaining,
    targetLaps,
    coachInstruction,
    isPersonalized,
    overPacedToday,
    skillBreakdown,
    status,
    overdue,
    perDayNeeded,
    message: paceMessage({
      status,
      todayRemaining,
      todayDone: counted.solvedToday,
      remaining,
      daysLeft,
      overdue,
      overPacedToday,
    }),
  };
}

/**
 * 運動部生に寄り添うペースメーカー声掛け文。
 *   ・責めない・詰め込みすぎを優しく止める・最初の一歩を軽くする
 */
export function paceMessage(input: {
  status: SugorokuHomeworkTask['status'];
  todayRemaining: number;
  todayDone?: number;
  remaining: number;
  daysLeft: number;
  overdue: boolean;
  overPacedToday?: boolean;
}): string {
  const { status, todayRemaining, todayDone = 0, remaining, daysLeft, overdue, overPacedToday } = input;
  if (remaining === 0) {
    return '今週の宿題コンプリート！ 毎日コツコツ積み上げた成果だよ。';
  }
  if (overdue) {
    return `締切を過ぎているけれど大丈夫。まずは今日 ${Math.min(5, remaining)} 問だけ進めてペースを取り戻そう！`;
  }
  if (overPacedToday) {
    return `今日はもう ${todayDone} 問も進めたね！ 1日でまとめ解きするより、残りは明日以降に分けた方が記憶に定着するよ。`;
  }
  if (todayRemaining === 0) {
    return `今日の目標ペース（${todayDone}問）達成！ しっかり休んで、また明日つづけよう。`;
  }
  if (status === 'not_started' && todayRemaining <= 2) {
    return '部活おつかれさま！ まずは最初の1問だけ開いてみよう。';
  }
  if (status === 'not_started') {
    return `まとめ解きしなくてOK！ 今日は ${todayRemaining} 問だけ進めればバッチリ間に合うよ。`;
  }
  if (daysLeft <= 2) {
    return `締切まであと${daysLeft}日！ 今日あと ${todayRemaining} 問解けばゴールが見えてくるよ。`;
  }
  return `いいペース！ 今日はあと ${todayRemaining} 問で目標クリアだよ。`;
}

/** カードに出す並び順：未完了かつ締切が近い順（期限超過の未完了は最優先で気づかせる） */
export function sortHomeworkTasks(tasks: SugorokuHomeworkTask[], now: number): SugorokuHomeworkTask[] {
  return [...tasks].sort((a, b) => {
    const aDone = a.remaining === 0;
    const bDone = b.remaining === 0;
    if (aDone !== bDone) return aDone ? 1 : -1;
    const aOver = a.dueAt < now && !aDone;
    const bOver = b.dueAt < now && !bDone;
    if (aOver !== bOver) return aOver ? -1 : 1;
    return a.dueAt - b.dueAt;
  });
}

/** ホーム最上部にピン留めする主役宿題1件を選ぶ（開始日前の未来配信は除外） */
export function pickPrimaryTask(tasks: SugorokuHomeworkTask[], now: number): SugorokuHomeworkTask | null {
  const active = tasks.filter((t) => !t.startAt || t.startAt <= now);
  const pool = active.length > 0 ? active : tasks;
  const open = sortHomeworkTasks(pool.filter((t) => t.remaining > 0), now);
  if (open.length > 0) return open[0];
  return sortHomeworkTasks(pool, now)[0] || null;
}

// ===================================================================
// 『英検2級・準2級プラス・準2級 3か月（12週間）標準ルート』プリセット
// ===================================================================

export interface WeeklyRoute {
  week: number;
  title: string;
  subtitle: string;
  recommendedDailyQuota: number;
  chapterIds: string[];
  /** その週の技能別問題数（totals を渡した場合は実問題数、省略時は単元数） */
  bySkill: Record<SugorokuSkillKey, number>;
  totalProblems: number;
}

const WEEK_THEMES_12: readonly string[] = [
  '基礎語彙＆短文空所スタート',
  '頻出熟語＆会話リスニング導入',
  '長文空所補充の読み方マスター',
  '説明文長文＆リスニング第2部',
  '前半総復習＆弱点補強ステップ',
  '中盤実戦① 時間配分トレーニング',
  '中盤実戦② 長文読解スピード強化',
  '中盤実戦③ リスニング集中攻略',
  '後半応用① 合格ライン突破演習',
  '後半応用② 紛らわしい選択肢対策',
  'S-CBT・本試験直前通し演習①',
  '最終仕上げ・総点検ルート完結',
];

/**
 * 3か月（12週間）標準ルートを、実際に存在する単元カタログから安全に構築する。
 *   - `ASSIGNMENT_MAX_CHAPTERS`（最大10単元）以内に必ず収め、既存 Firestore ルールと 100% 互換にする
 *   - 週ごとに「大問1短文語彙 ＋ 長文読解/空所 ＋ リスニング第1部/第2部」をバランスよく配合する
 */
export function buildWeeklyRoute(
  grade: string,
  availableChapterIds: readonly string[],
  weeks = 12,
  totals: Record<string, number> = {},
): WeeklyRoute[] {
  const set = new Set(availableChapterIds);
  const has = (id: string) => set.has(id);
  const pick = (...candidates: string[]) => candidates.filter((id) => has(id));

  const routes: WeeklyRoute[] = [];
  for (let week = 1; week <= weeks; week += 1) {
    // 全15回を12週間に無理なく配分（W1〜W9は各1回＋補強、W10〜W12は直前2回分仕上げ）
    const primaryRound = Math.min(15, week);
    const extraRound = week >= 10 ? Math.min(15, 12 + (week - 9)) : null;
    const rounds = extraRound && extraRound !== primaryRound ? [primaryRound, extraRound] : [primaryRound];

    const ids: string[] = [];
    if (week === 1) {
      ids.push(...pick(`${grade}_vocabulary_01`));
    }
    rounds.forEach((n) => {
      const nn = String(n).padStart(2, '0');
      ids.push(
        ...pick(
          `${grade}_written_${nn}_short`,
          week % 2 === 1 ? `${grade}_written_${nn}_cloze` : `${grade}_written_${nn}_reading`,
          `${grade}_written_${nn}_reading`,
          `${grade}_listening_r${nn}_part1`,
          `${grade}_listening_r${nn}_part2`,
        ),
      );
    });
    // 旧形式の章IDや3級・4級・5級の整序・会話単元も自動対応
    const extraForLowerGrades: string[] = [];
    rounds.forEach((n) => {
      const nn = String(n).padStart(2, '0');
      extraForLowerGrades.push(
        ...pick(
          `${grade}_written_${nn}_conversation`,
          `${grade}_written_${nn}_reorder`,
          `${grade}_listening_r${nn}_part3`,
        ),
      );
    });
    ids.push(...extraForLowerGrades);

    if (ids.length === 0) {
      const nn = String(primaryRound).padStart(2, '0');
      ids.push(
        ...pick(
          `${grade}_vocabulary_${nn}`,
          `${grade}_reading_${nn}`,
          `${grade}_listening_${nn}`,
        ),
      );
    }

    // 既存 class_assignments の上限（10単元）を超えないよう重複排除＆スライス
    const uniqueIds = Array.from(new Set(ids)).slice(0, 10);

    const bySkill: Record<SugorokuSkillKey, number> = {
      reading: 0,
      listening: 0,
      writing: 0,
      speaking: 0,
      vocab: 0,
    };
    let totalProblems = 0;
    uniqueIds.forEach((id) => {
      const ref = parseChapterRef(id);
      const count = Math.max(1, Math.floor(totals[id] || 1));
      if (totals[id]) totalProblems += Math.floor(totals[id]);
      if (ref?.skill) bySkill[ref.skill] += count;
    });

    const effectiveTotal = totalProblems > 0 ? totalProblems : uniqueIds.length * 10;
    // 週6日稼働（日曜予備日）で無理なく終わる1日推奨問数
    const recommendedDailyQuota = Math.max(3, Math.min(20, Math.ceil(effectiveTotal / 6)));
    const themeLabel = WEEK_THEMES_12[(week - 1) % WEEK_THEMES_12.length];

    routes.push({
      week,
      title: `第${week}週：${themeLabel}`,
      subtitle: themeLabel,
      recommendedDailyQuota,
      chapterIds: uniqueIds,
      bySkill,
      totalProblems,
    });
  }
  return routes;
}

/** プリセット定義（講師画面のテンプレート選択肢） */
export interface HomeworkPreset {
  id: string;
  label: string;
  shortLabel: string;
  grade: string;
  description: string;
}

export const HOMEWORK_PRESETS: readonly HomeworkPreset[] = [
  {
    id: 'eiken2-12w',
    label: '英検2級 アプリ全15回 12週ルート',
    shortLabel: '英検2級 全15回ルート',
    grade: 'eiken_2',
    description: 'アプリ内の筆記第1回〜第15回＆リスニング第1回〜第15回を12週間で日割り配信します（毎日10〜15分）。',
  },
  {
    id: 'eikenpre2plus-12w',
    label: '英検準2級プラス アプリ全15回 12週ルート',
    shortLabel: '準2級プラス 全15回ルート',
    grade: 'eiken_pre2plus',
    description: 'アプリ内の準2級プラス筆記・リスニング全15回を段階的に攻略し、2級へつなげます。',
  },
  {
    id: 'eikenpre2-12w',
    label: '英検準2級 アプリ全15回 12週ルート',
    shortLabel: '英検準2級 全15回ルート',
    grade: 'eiken_pre2',
    description: 'アプリ内の準2級（大問1・会話・長文・リスニング第1〜3部）全15回を無理なく完走します。',
  },
  {
    id: 'eiken3-12w',
    label: '英検3級 アプリ全15回 ルート',
    shortLabel: '英検3級 全15回ルート',
    grade: 'eiken_3',
    description: 'アプリ内の3級（短文語彙・会話・読解・リスニング第1〜3部）全15回を日割りで配信します。',
  },
  {
    id: 'eiken4-12w',
    label: '英検4級 アプリ全15回 ルート',
    shortLabel: '英検4級 全15回ルート',
    grade: 'eiken_4',
    description: 'アプリ内の4級（短文・会話・語句整序・読解・リスニング）全15回をスモールステップで進めます。',
  },
  {
    id: 'eiken5-12w',
    label: '英検5級 アプリ全15回 ルート',
    shortLabel: '英検5級 全15回ルート',
    grade: 'eiken_5',
    description: 'アプリ内の5級（短文・会話・語句整序・リスニング第1〜3部）全15回を楽しく完走します。',
  },
  {
    id: 'eikenpre1-12w',
    label: '英検準1級 アプリ全15回 ルート',
    shortLabel: '英検準1級 全15回ルート',
    grade: 'eiken_pre1',
    description: 'アプリ内の準1級（大問1語彙18問・長文空所・読解・リスニング第1〜3部）全15回を攻略します。',
  },
  {
    id: 'eiken1-12w',
    label: '英検1級 アプリ全15回 ルート',
    shortLabel: '英検1級 全15回ルート',
    grade: 'eiken_1',
    description: 'アプリ内の1級（大問1語彙22問・長文・リスニング第1〜4部）全15回を計画的に進めます。',
  },
];

/**
 * アプリ内の「第N回」（1〜15回）を指定して、その回の全パート（筆記＋リスニング）の単元IDリストを返す。
 * 講師が「今週は第3回を2周！」のようにアプリ内の回数ベースで課題を設定するときに使用。
 */
export function chapterIdsOfAppRound(
  grade: string,
  roundNo: number,
  availableChapterIds: readonly string[],
): string[] {
  const set = new Set(availableChapterIds);
  const nn = String(Math.max(1, Math.min(15, Math.floor(roundNo)))).padStart(2, '0');
  const candidates = [
    `${grade}_written_${nn}_short`,
    `${grade}_written_${nn}_conversation`,
    `${grade}_written_${nn}_reorder`,
    `${grade}_written_${nn}_cloze`,
    `${grade}_written_${nn}_reading`,
    `${grade}_listening_r${nn}_part1`,
    `${grade}_listening_r${nn}_part2`,
    `${grade}_listening_r${nn}_part3`,
    `${grade}_listening_r${nn}_part4`,
  ];
  return candidates.filter((id) => set.has(id)).slice(0, 10);
}
