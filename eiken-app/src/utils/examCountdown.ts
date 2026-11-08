// 共通テスト・2次試験（前期）までの残り日数を計算するユーティリティ
// 2027年度（令和9年度）大学入学共通テストは 2027年1月16日(土)・17日(日) 実施予定
// 国公立大学 2次試験（前期日程）は 2027年2月25日(木) から

// 試験初日（この日を「当日」とし、それまでの残り日数をカウントする）
export const EXAM_DATE = new Date(2027, 0, 16); // 月は0始まりなので 0 = 1月
export const EXAM_DATE_LABEL = '2027年1月16日・17日';
export const SECOND_EXAM_DATE = new Date(2027, 1, 25);
export const SECOND_EXAM_DATE_LABEL = '2027年2月25日〜';

const DAY_MS = 1000 * 60 * 60 * 24;

/** from から target（の日付）までの残り日数。当日以降は 0（マイナスにはしない） */
export function daysUntil(target: Date, from: Date = new Date()): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
}

/** 今日から共通テスト初日までの残り日数を返す。 */
export function getDaysUntilExam(from: Date = new Date()): number {
  return daysUntil(EXAM_DATE, from);
}

/** 今日から2次試験（前期）初日までの残り日数を返す。 */
export function getDaysUntilSecondExam(from: Date = new Date()): number {
  return daysUntil(SECOND_EXAM_DATE, from);
}
