/**
 * 章の満点で称号（C12・2026-10-29）。判定だけを持つ純粋な関数と、演習の終わりから呼ぶ入口。
 *
 * ■ 条件
 *   英文法の章の「全部の回」で、少なくとも1回ずつ満点をとったこと。
 *   回ごとの最高の正答率（stageRecords の b）が 100 なら、その回は満点をとったことがある。
 *   今回解いた回がちょうど満点で、それによって全部そろったときに称号を付ける。
 */
import { chapterTitleOf } from '../battle/core/chapterTitles';
import { readStageRecords, stageKey, type StageRecord } from './stageRecords';
import { logRejection } from './reportError';

/** その章の全部の回で、満点をとったことがあるか（純粋な関数） */
export function isChapterAllPerfect(
  records: Record<string, StageRecord | undefined>,
  chapterId: string,
  questionIds: readonly string[],
): boolean {
  if (questionIds.length === 0) return false;
  return questionIds.every((qid) => (records[stageKey(chapterId, qid)]?.b ?? 0) >= 100);
}

/**
 * 演習を1回解き終えたときに呼ぶ。条件がそろっていれば称号を付ける（付けたかどうかは growthStore が知らせる）。
 * 失敗しても学習は止めない。
 */
export function maybeAwardChapterTitle(uid: string, chapterId: string, questionIds: readonly string[], perfectThisRun: boolean): void {
  if (!perfectThisRun || !chapterTitleOf(chapterId)) return;
  if (!isChapterAllPerfect(readStageRecords(uid), chapterId, questionIds)) return;
  void import('../battle/data/growthStore')
    .then((m) => m.awardChapterTitle(chapterId))
    .catch(logRejection('growth.awardChapterTitle'));
}
