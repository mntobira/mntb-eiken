// 英検（実用英語技能検定）本番までの残り日数を計算するユーティリティ
// 2026年度 第3回 検定は 一次試験 2027年1月24日(日) / 二次試験 2027年2月28日(日) 実施予定
// （マナトビ英検は特定の受験日程を保証しないため、表示は「予定」であることを前提に扱う）
//
// 画面側の見た目（dl.game-home-countdown の2枠・CountUp・アニメーション）は
// マナトビリスニング版と同一に保ち、日付と見出しだけを英検のものへ差し替えている。

// 一次試験の当日（この日を「当日」とし、それまでの残り日数をカウントする）
export const EXAM_DATE = new Date(2027, 0, 24); // 月は0始まりなので 0 = 1月
export const EXAM_DATE_LABEL = '2027年1月24日';
export const SECOND_EXAM_DATE = new Date(2027, 1, 28);
export const SECOND_EXAM_DATE_LABEL = '2027年2月28日';

const DAY_MS = 1000 * 60 * 60 * 24;

/** from から target（の日付）までの残り日数。当日以降は 0（マイナスにはしない） */
export function daysUntil(target: Date, from: Date = new Date()): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
}

/** 今日から一次試験当日までの残り日数を返す。 */
export function getDaysUntilExam(from: Date = new Date()): number {
  return daysUntil(EXAM_DATE, from);
}

/** 今日から二次試験当日までの残り日数を返す。 */
export function getDaysUntilSecondExam(from: Date = new Date()): number {
  return daysUntil(SECOND_EXAM_DATE, from);
}
