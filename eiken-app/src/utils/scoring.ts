/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * スコア & タイマー算出ロジック
 *
 * 設計方針:
 *   - タイマー時間は「読む時間 + 思考時間 + タップ/入力時間」を見積もって少し長めに設定
 *   - スコアは「正解基礎点 × 残り時間倍率 × 連続正解コンボ倍率 + 難易度ボーナス」で算出
 *   - 制限時間超過時は秒あたりペナルティ（ただし最低点は確保し続行可能）
 *   - 記述式（descriptive）は自動採点不可なので「参加点」を付与
 */

import { isCountedCorrect, isDescriptive } from './answerJudge';

export type SubQuestionType = 'multiple_choice' | 'sorting' | 'descriptive' | 'text' | string;

export interface ScoringSubQuestion {
  id: string;
  type?: SubQuestionType;
  label?: string;
  correctAnswer?: string;
  options?: string[];
  items?: string[];
  group?: string;
  /**
   * 完答グループ（英語リスニング 第4・5問）。
   * 同じ値の小問が全部正解のときだけ正解数に数える（answerJudge.isCountedCorrect）。
   */
  allOrNothingGroup?: string;
}

// ============================================================
// タイマー時間計算
// ============================================================

/**
 * 設問1つあたりの制限時間（秒）を算出する。
 * - 問題タイプ別に基礎秒数を設定（読む+考える+操作）
 * - 選択肢の数 / 入力文字数 / 設問グループサイズで補正
 * - 「少し長め」に倒している（タップ・入力・思考時間を含めて余裕を持たせる）
 */
export function calcSubQuestionTimeLimit(sq: ScoringSubQuestion): number {
  const type = sq.type || 'text';
  const labelLen = (sq.label || '').length;

  // ベース秒数（既に少し長めに設定）
  let base: number;
  switch (type) {
    case 'multiple_choice': {
      const optCount = sq.options?.length ?? 4;
      const optLen = (sq.options || []).reduce((s, o) => s + o.length, 0);
      // 選択肢を読む時間 + 判断 + タップ
      // 選択肢1つ平均5文字なら4選択肢で約25秒、長文選択肢ならさらに加算
      base = 22 + optCount * 4 + Math.min(optLen * 0.4, 30);
      break;
    }
    case 'sorting': {
      const itemCount = sq.items?.length ?? 4;
      // 並び替えはドラッグ操作分の余裕も含めて長めに
      base = 40 + itemCount * 8;
      break;
    }
    case 'descriptive': {
      const answerLen = (sq.correctAnswer || '').length || 25;
      // 記述は読む + 構成 + 入力。日本語タッチ入力1文字 ≒ 1.5秒で見積もり
      base = 90 + Math.min(answerLen * 3, 150);
      break;
    }
    case 'text':
    default: {
      // 短文記入（化学式・元素記号など）。化学記号パレット利用も考慮し少し余裕を
      const answerLen = (sq.correctAnswer || '').length || 4;
      base = 45 + Math.min(answerLen * 5, 90);
      break;
    }
  }

  // 問題文側のラベルが長ければ「読む時間」を加算
  if (labelLen > 40) base += Math.min((labelLen - 40) * 0.3, 20);

  // 最低20秒、最大240秒でクランプ（極端な設問対策）
  return Math.round(Math.min(Math.max(base, 20), 240));
}

/**
 * 問題（複数 subQuestion）の合計制限時間を算出する。
 * 同一 group の subQuestion はまとめて1つの操作と見なし係数を下げる。
 */
export function calcQuestionTimeLimit(subQuestions: ScoringSubQuestion[]): number {
  if (!subQuestions || subQuestions.length === 0) return 60;

  // group ごとにまとめる
  const groupBuckets = new Map<string, ScoringSubQuestion[]>();
  const ungrouped: ScoringSubQuestion[] = [];
  for (const sq of subQuestions) {
    if (sq.group) {
      const arr = groupBuckets.get(sq.group) || [];
      arr.push(sq);
      groupBuckets.set(sq.group, arr);
    } else {
      ungrouped.push(sq);
    }
  }

  let total = 0;
  for (const sq of ungrouped) {
    total += calcSubQuestionTimeLimit(sq);
  }
  for (const [, arr] of groupBuckets) {
    // 読む文が共通でも、入力操作は各小問で必要。入力式の時間は削らない。
    const sorted = [...arr];
    sorted.forEach((sq, idx) => {
      const t = calcSubQuestionTimeLimit(sq);
      const canShareReading = sq.type === 'multiple_choice';
      total += idx === 0 || !canShareReading ? t : Math.round(t * 0.6);
    });
  }

  return total;
}

// ============================================================
// スコア算出
// ============================================================

export interface ScoreBreakdown {
  /** 正解 sub_question 数 */
  correctCount: number;
  /** 自動採点可能な sub_question 数（記述を除く） */
  judgeableCount: number;
  /** 全 sub_question 数 */
  totalCount: number;
  /** 基礎点（正解1問あたり100点） */
  basePoints: number;
  /** 時間ボーナス（残り時間に応じた加点） */
  timeBonus: number;
  /** コンボボーナス（連続正解に応じた加点） */
  comboBonus: number;
  /** 記述参加点（記述式は自動採点不可なため定額付与） */
  descriptiveBonus: number;
  /** 制限時間オーバーペナルティ（秒あたり） */
  overtimePenalty: number;
  /** 最終スコア（floor、最低0） */
  finalScore: number;
  /** 全問正解時のパーフェクトボーナス */
  perfectBonus: number;
  /** その問題の最大コンボ数 */
  comboCount: number;
}

export interface ScoreContext {
  /** 制限時間（秒） */
  timeLimit: number;
  /** 使用時間（秒） */
  timeUsed: number;
  /** 最大連続正解数（その問題内） */
  maxCombo: number;
  /** 解答時点で記録された累積連続正解（章全体での進行コンボ） */
  runningCombo?: number;
}

/**
 * 1つの problem（複数 subQuestion）の採点をする。
 *
 * スコア構成:
 *   - 基礎点: 自動採点可能な subQuestion 1問正解につき +100
 *   - 記述参加点: 記述式 1問あたり +40（埋めた場合）
 *   - 時間ボーナス: 残り時間率に応じて 0〜80点。残り率 r とすると floor(80 * r * (correctRate))
 *       → 早く解いた×正答率が高い 程ボーナス大
 *   - コンボボーナス: その問題内で連続して正解した最大数 c に応じて floor(c * 15)（最大75点）
 *   - パーフェクトボーナス: 自動採点可能な問題を全問正解で +50
 *   - オーバータイムペナルティ: 制限時間超過1秒につき -2点（ただし合計スコアは0以下にしない）
 */
export function scoreProblem(
  subQuestions: ScoringSubQuestion[],
  answers: Record<string, string>,
  ctx: ScoreContext
): ScoreBreakdown {
  const judgeables = subQuestions.filter((sq) => !isDescriptive(sq));

  let correctCount = 0;
  for (const sq of judgeables) {
    // 完答グループを持つ小問は「グループ全員正解」のときだけ数える。
    // グループを持たない小問（化学・第1〜3問）は従来と完全に同じ判定。
    if (isCountedCorrect(sq, judgeables, answers)) {
      correctCount += 1;
    }
  }
  const correctRate = judgeables.length === 0 ? 0 : correctCount / judgeables.length;

  // 記述式：何か書いていたら参加点を付与
  const descriptiveBonus = 0;

  const basePoints = correctCount * 100;

  // 残り時間率（0〜1）
  const remainSec = Math.max(0, ctx.timeLimit - ctx.timeUsed);
  const remainRate = ctx.timeLimit > 0 ? remainSec / ctx.timeLimit : 0;
  const timeBonus = Math.floor(80 * remainRate * correctRate);

  // コンボボーナス
  const comboBonus = Math.floor(Math.min(ctx.maxCombo, 5) * 15);

  // パーフェクトボーナス
  const perfectBonus = judgeables.length > 0 && correctCount === judgeables.length ? 50 : 0;

  // オーバータイムペナルティ
  const overtimeSec = Math.max(0, ctx.timeUsed - ctx.timeLimit);
  const overtimePenalty = Math.floor(overtimeSec * 2);

  let finalScore =
    basePoints + descriptiveBonus + timeBonus + comboBonus + perfectBonus - overtimePenalty;
  if (finalScore < 0) finalScore = 0;

  return {
    correctCount,
    judgeableCount: judgeables.length,
    totalCount: subQuestions.length,
    basePoints,
    timeBonus,
    comboBonus,
    descriptiveBonus,
    overtimePenalty,
    perfectBonus,
    finalScore,
    comboCount: ctx.maxCombo,
  };
}

/**
 * 1問内の subQuestion を順番に走査して、最大連続正解数を求める。
 * 章全体の継続コンボは別途上位で管理する。
 */
export function calcMaxCombo(
  subQuestions: ScoringSubQuestion[],
  answers: Record<string, string>
): number {
  let max = 0;
  let cur = 0;
  const judgeables = subQuestions.filter((sq) => !isDescriptive(sq));
  for (const sq of subQuestions) {
    if (isDescriptive(sq)) {
      // 記述はコンボ計算から除外（中断もしない）
      continue;
    }
    if (isCountedCorrect(sq, judgeables, answers)) {
      cur += 1;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

/**
 * 連続正解コンボ倍率（章全体スコア用）。
 * 5問連続正解で1.1倍 / 10問で1.2倍 / 20問で1.3倍 を上限とする。
 */
export function comboMultiplier(runningCombo: number): number {
  if (runningCombo >= 20) return 1.3;
  if (runningCombo >= 10) return 1.2;
  if (runningCombo >= 5) return 1.1;
  return 1.0;
}

/**
 * ランキング1ページの最大表示件数
 */
export const LEADERBOARD_PAGE_SIZE = 50;
