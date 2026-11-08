/**
 * TOEIC L&R 公開テストの形式（2016年5月〜の新形式）。模試の組み立てと構造チェックの基準。
 */
import type { ChoiceLabel, ToeicBand, ToeicPart, ToeicSection } from './types';

export interface PartSpec {
  part: ToeicPart;
  section: ToeicSection;
  nameJa: string;
  /** 本番の問題番号の範囲 */
  numbers: readonly [from: number, to: number];
  /** 1セットの設問数（Part 7 はシングル/ダブル/トリプルで異なる） */
  questionsPerSet: readonly number[];
  choices: readonly ChoiceLabel[];
  /** 選択肢が印刷されず、音声だけで流れる */
  audioOnlyChoices: boolean;
  /** アプリの練習での1問あたりの目安（秒）。リスニングは音声の長さに従う */
  targetSecPerQuestion?: number;
}

const ABCD = ['A', 'B', 'C', 'D'] as const;

export const TOEIC_PARTS: Record<ToeicPart, PartSpec> = {
  1: { part: 1, section: 'listening', nameJa: '写真描写問題', numbers: [1, 6], questionsPerSet: [1], choices: ABCD, audioOnlyChoices: true },
  2: { part: 2, section: 'listening', nameJa: '応答問題', numbers: [7, 31], questionsPerSet: [1], choices: ['A', 'B', 'C'], audioOnlyChoices: true },
  3: { part: 3, section: 'listening', nameJa: '会話問題', numbers: [32, 70], questionsPerSet: [3], choices: ABCD, audioOnlyChoices: false },
  4: { part: 4, section: 'listening', nameJa: '説明文問題', numbers: [71, 100], questionsPerSet: [3], choices: ABCD, audioOnlyChoices: false },
  5: { part: 5, section: 'reading', nameJa: '短文穴埋め問題', numbers: [101, 130], questionsPerSet: [1], choices: ABCD, audioOnlyChoices: false, targetSecPerQuestion: 20 },
  6: { part: 6, section: 'reading', nameJa: '長文穴埋め問題', numbers: [131, 146], questionsPerSet: [4], choices: ABCD, audioOnlyChoices: false, targetSecPerQuestion: 30 },
  7: { part: 7, section: 'reading', nameJa: '読解問題', numbers: [147, 200], questionsPerSet: [2, 3, 4, 5], choices: ABCD, audioOnlyChoices: false, targetSecPerQuestion: 60 },
};

/** 本番1回分のセット構成（模試の組み立てチェック用） */
export const MOCK_BLUEPRINT = {
  1: { sets: 6, questions: 6 },
  2: { sets: 25, questions: 25 },
  3: { sets: 13, questions: 39 },
  4: { sets: 10, questions: 30 },
  5: { sets: 30, questions: 30 },
  6: { sets: 4, questions: 16 },
  7: { sets: 15, questions: 54 },
} as const satisfies Record<ToeicPart, { sets: number; questions: number }>;

/** Part 7 の内訳：シングル29問（2〜4問×10セット）＋ダブル5問×2＋トリプル5問×3 */
export const PART7_BLUEPRINT = {
  single: { sets: 10, questions: 29 },
  double: { sets: 2, questions: 10 },
  triple: { sets: 3, questions: 15 },
} as const;

export const SECTION_MINUTES: Record<ToeicSection, number> = { listening: 45, reading: 75 };

export const BAND_LABEL: Record<ToeicBand, string> = {
  400: '〜400 はじめて',
  500: '500 基礎',
  600: '600 就活ライン',
  730: '730 中級',
  860: '860 上級',
  990: '990 満点',
};

export const sectionOf = (part: ToeicPart): ToeicSection => TOEIC_PARTS[part].section;
