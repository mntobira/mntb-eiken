/**
 * 型の書き方見本（本番データではない）。各パート1セットずつ増やしていく。
 */
import type { Part5Set, Part2Set } from './types';

export const SAMPLE_P5: Part5Set = {
  id: 'toeic-p5-001',
  part: 5,
  band: 600,
  scene: 'office',
  source: { author: 'manatobi', createdAt: '2026-10-25' },
  questions: [{
    id: 'toeic-p5-001-q1',
    stem: {
      en: 'All employees are required to submit their expense reports ------- the end of the month.',
      ja: '全従業員は月末までに経費報告書を提出しなければならない。',
    },
    choices: [
      { label: 'A', en: 'by', ja: '〜までに' },
      { label: 'B', en: 'until', ja: '〜までずっと' },
      { label: 'C', en: 'within', ja: '〜以内に' },
      { label: 'D', en: 'since', ja: '〜以来' },
    ],
    answer: 'A',
    skill: 'preposition',
    explanation: {
      reason: '「期限（〜までに）」は by。提出は一度きりの動作なので「継続（〜までずっと）」の until は合わない。',
      distractors: { B: 'until は継続を表す', C: 'within の後ろは期間（a week など）', D: 'since は完了形と使う' },
    },
    vocabIds: ['toeic-w-expense-report'],
  }],
};

export const SAMPLE_P2: Part2Set = {
  id: 'toeic-p2-001',
  part: 2,
  band: 500,
  source: { author: 'manatobi', createdAt: '2026-10-25' },
  audio: { script: [{ speaker: 'W', accent: 'UK', en: 'Where should I put these boxes?', ja: 'この箱はどこに置けばいいですか。' }] },
  questions: [{
    id: 'toeic-p2-001-q1',
    choices: [
      { label: 'A', en: 'In the storage room, please.', ja: '倉庫にお願いします。' },
      { label: 'B', en: 'Yes, I put them there.', ja: 'はい、そこに置きました。' },
      { label: 'C', en: 'About ten boxes.', ja: '10箱くらいです。' },
    ],
    answer: 'A',
    skill: 'wh-where',
    explanation: {
      reason: 'Where（場所）に場所で答えている A が正解。',
      distractors: { B: '疑問詞の質問に Yes で答えている', C: 'boxes の繰り返しのワナ（数を答えている）' },
    },
  }],
};
