/**
 * 英検「短文の語句空所補充（short）」「会話文の空所補充（conversation）」の
 * 1ページ5問ずつ・一括採点（「このページを採点する」）ページ計算・対話整形モデル。
 *
 * TOEIC Part 5（ToeicPageQuiz）と同じ見やすさ・テンポ感を英検の穴埋め大問向けに構築する。
 * 継承保護ファイル（ToeicPageQuiz.tsx / QuizScreens.tsx / ProblemPane.tsx 等）は一切変更しない。
 */
import type { Chapter, Problem, SubQuestion } from '../types/curriculum';
import type { EikenGrade } from '../eiken/config';

/** ご要望：「穴埋めのところの問題をさ、1ページに5問ずつ載せて一括で採点できるようにしよう」 */
export const EIKEN_CLOZE_PER_PAGE = 5;

/** 選択肢がこの文字数を超えたら、2×2ではなく1列にして折り返し崩れを防ぐ */
export const EIKEN_LONG_CHOICE_CHARS = 20;

/**
 * 英検の穴埋め大問（短文の語句空所補充・会話文の空所補充）の回別通し章かどうか。
 * 例: `eiken_2_written_04_short`, `eiken_3_written_01_conversation`
 * （基礎ウォームアップ `eiken_*_vocabulary_01` は2問のみで release.browser 等の既存テストが
 *   従来の1問ずつ表示を前提としているため対象外とし、冊子大問通し演習のみ対象にする）
 */
export function isEikenBatchClozeChapter(chapter: Pick<Chapter, 'id'> | null | undefined): boolean {
  if (!chapter?.id) return false;
  return /^eiken_[a-z0-9]+_written_\d+_(?:short|conversation)$/.test(chapter.id);
}

/**
 * 英検の長文読解・長文空所補充チャプターかどうか（1本文＋全設問を専用リーディングUIで表示）。
 * 例: `eiken_5_reading_01`, `eiken_2_written_04_reading`, `eiken_2_written_04_cloze`, `eiken_1_reading_extra_p1`
 */
export function isEikenPassageChapter(chapter: Pick<Chapter, 'id'> | null | undefined): boolean {
  if (!chapter?.id) return false;
  return /^eiken_[a-z0-9]+_(?:written_\d+_(?:reading|cloze)|reading_\d+|reading_extra_[a-z0-9_-]+)$/.test(
    chapter.id,
  );
}

/**
 * 英検の筆記・リーディング・語彙系チャプターかどうか（リスニング以外）。
 * 例: `eiken_5_written_01_short`, `eiken_3_written_02_reading`, `eiken_5_vocabulary_01`, `eiken_5_reading_01`, `eiken_1_reading_extra_p1`
 */
export function isEikenWrittenChapterId(chapterId: string | null | undefined): boolean {
  if (!chapterId) return false;
  return /^eiken_[a-z0-9]+_(?:written_\d+_[a-z0-9_]+|vocabulary_\d+|reading_\d+|reading_extra_[a-z0-9_-]+)$/.test(
    chapterId,
  );
}

/** 章ID（`eiken_2_written_04_short` / `eiken_5_vocabulary_01` 等）から級のキー（`eiken_2`）を取り出す */
export function extractEikenGradeFromChapterId(chapterId: string | undefined): EikenGrade | undefined {
  if (!chapterId) return undefined;
  const m = chapterId.match(
    /^(eiken_[a-z0-9]+)_(?:written_\d+_|vocabulary_\d+|reading_\d+|reading_extra_[a-z0-9_-]+)/,
  );
  return m ? (m[1] as EikenGrade) : undefined;
}

export interface EikenDialogueTurn {
  speaker: string;
  text: string;
}

/**
 * `A: ...\nB: ...` 形式の対話文であれば話者ターンの配列に分解する。
 * 通常の1文（話者ラベルなし）は null を返す。
 */
export function splitEikenDialogueTurns(text: string): EikenDialogueTurn[] | null {
  const lines = String(text || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const turns: EikenDialogueTurn[] = [];
  for (const line of lines) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9 .]{0,12}):\s*(.+)$/);
    if (!m) return null;
    turns.push({ speaker: m[1].trim(), text: m[2].trim() });
  }
  return turns.length >= 2 ? turns : null;
}

export interface EikenClozeEntry {
  problem: Problem;
  problemIndex: number;
  sq: SubQuestion;
  displayNo: number;
}

/** 対象範囲の Problem 配列を1問1エントリに展開し、5問ずつのページに分割する */
export function buildEikenClozePages(
  problems: readonly Problem[],
  rangeStart: number,
  rangeEnd: number,
  perPage = EIKEN_CLOZE_PER_PAGE,
): EikenClozeEntry[][] {
  const entries: EikenClozeEntry[] = [];
  const start = Math.max(0, rangeStart);
  const end = Math.min(problems.length - 1, rangeEnd);
  for (let i = start; i <= end; i += 1) {
    const p = problems[i];
    const sq = p?.subQuestions?.[0];
    if (!p || !sq) continue;
    const labelMatch = String(sq.label || p.title || '').match(/問\s*(\d+)/);
    const displayNo = labelMatch ? Number(labelMatch[1]) : entries.length + 1;
    entries.push({
      problem: p,
      problemIndex: i,
      sq,
      displayNo,
    });
  }
  const size = Math.max(1, Math.floor(perPage));
  const pages: EikenClozeEntry[][] = [];
  for (let i = 0; i < entries.length; i += size) {
    pages.push(entries.slice(i, i + size));
  }
  return pages;
}

/** 保存済みの問題インデックス（quizIndexKey）から開くべきページ番号を求める */
export function pageFromProblemIndex(
  pages: readonly (readonly EikenClozeEntry[])[],
  storedProblemIndex: number,
): number {
  if (pages.length === 0) return 0;
  const hit = pages.findIndex(page => page.some(e => e.problemIndex === storedProblemIndex));
  if (hit >= 0) return hit;
  return 0;
}

/** 選択肢を1列にするか（会話文の応答など長い英文選択肢がある場合） */
export function prefersSingleColumnChoices(texts: readonly string[] | undefined): boolean {
  return (texts || []).some(t => String(t).length > EIKEN_LONG_CHOICE_CHARS);
}

export interface ParsedEikenExplanation {
  why: string;
  translation: string;
  stem: string;
  correctWord: string;
  completedSentence: string;
  choices: {
    mark: string;
    text: string;
    correct: boolean;
    reason: string;
  }[];
}

/** Problem / SubQuestion から採点後アコーディオン用の解説データを抽出する */
export function parseEikenClozeExplanation(entry: EikenClozeEntry): ParsedEikenExplanation {
  const { problem, sq } = entry;
  const rawLines = String(problem.explanation || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  let translation = '';
  for (const line of rawLines) {
    if (line.startsWith('【訳】')) {
      translation = line.replace(/^【訳】\s*/, '').trim();
      break;
    }
  }

  const why = String(sq.explainJa || '').trim();
  const texts = sq.optionTexts || [];
  const distractors = sq.distractors || [];

  const choices = sq.options.map((mark, idx) => {
    const text = texts[idx] ?? mark;
    const correct = mark === sq.correctAnswer;
    const dReason = distractors.find(d => d.no === idx + 1)?.why ?? '';
    return {
      mark,
      text,
      correct,
      reason: dReason,
    };
  });

  // 空所に正解語を入れた完成文を組み立てる
  const correctIdx = Math.max(0, sq.options.indexOf(sq.correctAnswer));
  const correctWord = texts[correctIdx] ?? '';
  const stem = String(problem.text || '');
  const completedSentence = stem.replace(/\(\s*_{0,6}\s*\)/, correctWord);

  return {
    why,
    translation,
    stem,
    correctWord,
    completedSentence,
    choices,
  };
}
