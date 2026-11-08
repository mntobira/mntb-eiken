/**
 * ===================================================================
 * TOEIC® L&R Part 5（短文穴埋め）データ（2026-10-28）
 * ===================================================================
 *
 * 英文法（englishGrammarData.ts）・英語リスニングと同じ「parts → chapters → practiceProblems」の形。
 * 単元は1つ（tp5_1）で、その中に「第1回〜第15回」（1回30問）を並べる。
 * 単元一覧は英語リスニングと同じ「第N回演習」のカードで表示する（ChapterSelection の回一覧）。
 *
 * ■ 問題は音を出さない
 *   完成文・和訳・語句は解説の1画面表示用に文字だけ残す（英文法と同じ扱い）。
 *   完成文を読み上げると答えが聞こえるため。
 */
import type { Problem } from '../../types/curriculum';
import { applyListeningPostProcess } from '../listeningPostProcess';
import { countProblemsInChapters } from '../problemCount';
import { buildToeicRound, TOEIC_P5_CHAPTER_ID, type ToeicP5Item } from './toeicPart5Kit';
import { TOEIC_P5_ROUNDS } from './toeicPart5Rounds';

export interface ToeicChapter {
  id: string;
  abstractTitle: string;
  realTitle: string;
  questionGroup: string;
  topics: string[];
  practiceProblems: Problem[];
  miniTest: Problem[];
}

export interface ToeicPart {
  id: string;
  title: string;
  chapters: ToeicChapter[];
}

function buildProblems(rounds: readonly ToeicP5Item[][]): Problem[] {
  return rounds.map((items, i) => buildToeicRound({ round: i + 1 }, items) as unknown as Problem);
}

export const toeicPart5Data: { parts: ToeicPart[] } = {
  parts: [
    {
      id: 'tp5',
      title: 'TOEIC Part 5 短文穴埋め',
      chapters: [
        {
          id: TOEIC_P5_CHAPTER_ID,
          abstractTitle: 'Part 5 短文穴埋め',
          realTitle: 'Part 5',
          questionGroup: 'Part 5',
          topics: ['1回30問・4択', '品詞・動詞の形・前置詞・接続詞・代名詞・関係詞・語彙'],
          practiceProblems: buildProblems(TOEIC_P5_ROUNDS),
          miniTest: [],
        },
      ],
    },
  ],
};

/** 解説の整形（英文法と同じ経路）と、音を出さない設定 */
(() => {
  applyListeningPostProcess(toeicPart5Data, { decisive: false }); // C10：「解くカギ」の一覧は出さない（黄色いマーカーだけ残す）
  for (const c of toeicPart5Data.parts.flatMap((p) => p.chapters)) {
    for (const problem of c.practiceProblems) {
      if (Array.isArray(problem.audioTracks)) problem.explanationTracks = problem.audioTracks;
      delete problem.audioTracks;
      problem.stepwise = true;
      if (typeof problem.explanation === 'string') {
        problem.explanation = problem.explanation
          .replace(/SCRIPT ／ 実際に流れた英文/g, 'ANSWER ／ 完成した英文')
          .replace(/解答の道すじ/g, '解説');
      }
    }
  }
})();

export function getAllToeicPart5Chapters(): ToeicChapter[] {
  return toeicPart5Data.parts.flatMap((p) => p.chapters);
}

/** 収録状況（単元数・回数・問題数）。データから数える */
export function getToeicPart5Stats() {
  const chapters = getAllToeicPart5Chapters();
  const questions = countProblemsInChapters(chapters);
  const marks = chapters.reduce(
    (sum, c) => sum + c.practiceProblems.reduce((n, p) => n + (Array.isArray(p?.subQuestions) ? p.subQuestions.length : 0), 0),
    0,
  );
  return { chapters: chapters.length, questions, marks };
}
