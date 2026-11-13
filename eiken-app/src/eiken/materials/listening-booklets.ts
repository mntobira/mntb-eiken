import type { EikenGrade } from '../config';
import type { ListeningExamRound } from '../listeningExamCore';
import { GRADE_5_LISTENING_EXAMS } from './listening-g5';
import { GRADE_4_LISTENING_EXAMS } from './listening-g4';
import { GRADE_3_LISTENING_EXAMS, GRADE_PRE2_LISTENING_EXAMS } from './listening-g3-pre2';
import { GRADE_PRE2PLUS_LISTENING_EXAMS, GRADE_2_LISTENING_EXAMS } from './listening-pre2plus-g2';
import { GRADE_PRE1_LISTENING_EXAMS } from './listening-pre1';
import { GRADE_1_LISTENING_EXAMS } from './listening-g1';

/**
 * まなとび英検 リスニング予想問題 全8級×15回＝120回 原本データ集約
 * - 合計：120回 ／ 3,465問 ／ 3,285音源スクリプト ／ 750図版プロンプト
 * - すべて独自執筆（origin: 'manatobi-original'）。過去問流用なし。
 */
export const LISTENING_EXAMS_BY_GRADE: Readonly<Record<EikenGrade, readonly ListeningExamRound[]>> = {
  eiken_5: GRADE_5_LISTENING_EXAMS,
  eiken_4: GRADE_4_LISTENING_EXAMS,
  eiken_3: GRADE_3_LISTENING_EXAMS,
  eiken_pre2: GRADE_PRE2_LISTENING_EXAMS,
  eiken_pre2plus: GRADE_PRE2PLUS_LISTENING_EXAMS,
  eiken_2: GRADE_2_LISTENING_EXAMS,
  eiken_pre1: GRADE_PRE1_LISTENING_EXAMS,
  eiken_1: GRADE_1_LISTENING_EXAMS,
};

export const ALL_LISTENING_EXAMS: readonly ListeningExamRound[] = [
  ...GRADE_5_LISTENING_EXAMS,
  ...GRADE_4_LISTENING_EXAMS,
  ...GRADE_3_LISTENING_EXAMS,
  ...GRADE_PRE2_LISTENING_EXAMS,
  ...GRADE_PRE2PLUS_LISTENING_EXAMS,
  ...GRADE_2_LISTENING_EXAMS,
  ...GRADE_PRE1_LISTENING_EXAMS,
  ...GRADE_1_LISTENING_EXAMS,
];
