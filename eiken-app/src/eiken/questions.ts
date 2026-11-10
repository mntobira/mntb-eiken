import type { OriginalQuestion } from './materials/original-types';
import type { Problem, Chapter, Part } from '../types/curriculum';
import { FOUNDATION_UNITS } from './materials/original-foundation';
import { INTERMEDIATE_UNITS } from './materials/original-intermediate';
import { BRIDGE_UNIT } from './materials/original-bridge';
import { UPPER_UNIT } from './materials/original-upper';
import { ADVANCED_UNIT } from './materials/original-advanced';
import { TRANSLATIONS } from './materials/translations';
import { EIKEN_GRADES, type EikenGrade } from './config';

export type EikenSection = 'response' | 'dialogue' | 'narration';
export interface EikenQuestion {
  id: string; examType: 'eiken'; grade: EikenGrade; section: EikenSection;
  questionNumber: number; title: string; instruction: string; audioUrl: string | null;
  transcript: string; translation: string; choices: string[]; correctAnswer: number;
  explanation: string; reasons: string[]; evidence: string; difficulty: number;
  tags: string[]; published: boolean; createdAt: string; updatedAt: string;
  playback: { readCount: 1 | 2; replayAllowed: boolean; source: 'browser-speech' | 'recorded' };
  origin: 'manatobi-original';
}
const units = [...FOUNDATION_UNITS, ...INTERMEDIATE_UNITS, BRIDGE_UNIT, UPPER_UNIT, ADVANCED_UNIT];
const gradeMap: Record<string, EikenGrade> = { '5': 'eiken_5', '4': 'eiken_4', '3': 'eiken_3', 'pre-2': 'eiken_pre2', 'pre-2-plus': 'eiken_pre2plus', '2': 'eiken_2', 'pre-1': 'eiken_pre1' };
export const EIKEN_QUESTIONS: EikenQuestion[] = units.flatMap((unit, difficulty) => unit.listenings.map((block, index) => ({
  id: `${gradeMap[unit.grade]}_listening_01_${index + 1}`, examType: 'eiken' as const, grade: gradeMap[unit.grade],
  section: block.script.length > 1 ? 'dialogue' as const : 'narration' as const,
  questionNumber: index + 1, title: block.title, instruction: block.question.prompt,
  audioUrl: null, transcript: block.script.join('\n'), translation: TRANSLATIONS[unit.grade].listenings[index],
  choices: [...block.question.choices], correctAnswer: block.question.answer,
  explanation: block.question.reasons[block.question.answer], reasons: [...block.question.reasons], evidence: block.question.evidence,
  difficulty: Math.min(5, Math.ceil((difficulty + 1) * 5 / 7)), tags: [block.question.skill], published: true,
  createdAt: '2026-11-08T00:00:00.000Z', updatedAt: '2026-11-08T00:00:00.000Z',
  playback: { readCount: 2 as const, replayAllowed: true, source: 'browser-speech' as const }, origin: 'manatobi-original' as const,
})));
export function validateQuestion(question: EikenQuestion) {
  if (question.examType !== 'eiken' || !EIKEN_GRADES.some(grade => grade.id === question.grade)) throw new Error('英検教材以外は登録できません。');
  if (!question.id.startsWith(question.grade + '_') || question.choices.length < 3 || question.choices.length > 4 || question.correctAnswer < 0 || question.correctAnswer >= question.choices.length) throw new Error('問題の識別子または選択肢が不正です。');
  if (!question.transcript || !question.explanation || !question.translation) throw new Error('原稿・解説・和訳が必要です。');
  if (question.audioUrl && !question.audioUrl.startsWith('/eiken_audio/')) throw new Error('音声は英検版専用の /eiken_audio/ に配置してください。');
}
EIKEN_QUESTIONS.forEach(validateQuestion);
export function toProblem(q: EikenQuestion): Problem {
  validateQuestion(q);
  const subId = `${q.id}_answer`;
  const turns = q.transcript.split('\n').map(line => {
    const match = line.match(/^([AB]):\s*(.*)$/);
    return { who: match?.[1] ?? '', text: match?.[2] ?? line };
  });
  return {
    ...q, category: q.section === 'dialogue' ? '会話の聞き取り' : q.section === 'response' ? '短い応答' : '説明文の聞き取り',
    text: q.instruction, readCount: q.playback.readCount, playOnce: !q.playback.replayAllowed, stepwise: true,
    subQuestions: [{ id: subId, label: q.instruction, type: 'multiple_choice', options: q.choices.map((_, i) => String(i + 1)), optionTexts: q.choices, correctAnswer: String(q.correctAnswer + 1), skill: q.tags[0], explainJa: q.explanation, detailedExplanation: { theme: q.tags[0], difficulty: q.difficulty, steps: [q.evidence, q.explanation] }, distractors: q.reasons.map((why, no) => ({ no: no + 1, why })) }],
    audioTracks: [{ subId, label: `問${q.questionNumber}`, hint: '音声を聞いて答えを選んでください。', audioUrl: q.audioUrl || undefined, script: `${q.transcript}\nQuestion. ${q.instruction}`, turns: [...turns, { who: '', text: `Question. ${q.instruction}` }], translation: q.translation, keyPhrases: [{ phrase: q.evidence, meaning: q.explanation }] }],
    surroundingKnowledge: [], deepDiveTopics: [],
  };
}
/** 語彙・文法と読解も共通の採点・間違い復習に登録する。音源とは混同しない。 */
function writtenSubQuestion(question: OriginalQuestion, id: string) {
  return { id, label: question.prompt, type: 'multiple_choice',
    options: question.choices.map((_, index) => String(index + 1)), optionTexts: [...question.choices],
    correctAnswer: String(question.answer + 1), skill: question.skill,
    explainJa: `${question.reasons[question.answer]}\n根拠：${question.evidence}`,
    detailedExplanation: { theme: question.skill, steps: [question.evidence, question.reasons[question.answer]] },
    distractors: question.reasons.map((why, index) => ({ no: index + 1, why })),
  };
}
export function partsForGrade(grade: EikenGrade): Part[] {
  const unit = units.find(unit => gradeMap[unit.grade] === grade);
  if (!unit) return [];
  const questions = EIKEN_QUESTIONS.filter(q => q.grade === grade && q.published);
  const label = EIKEN_GRADES.find(item => item.id === grade)!.label;
  const listening: Chapter = { id: `${grade}_listening_01`, title: 'リスニング練習', abstractTitle: 'リスニング練習', realTitle: 'リスニング練習', questionGroup: 'リスニング', topics: ['会話・説明の要点を聞き取る'], practiceProblems: questions.map(toProblem), miniTest: [], readCount: 2, marks: questions.length, speakers: '会話・説明' };
  const vocabulary: Chapter = { id: `${grade}_vocabulary_01`, title: '語彙・文法練習', abstractTitle: '語彙・文法練習', realTitle: '語彙・文法練習', questionGroup: '語彙・文法', topics: [unit.focus], marks: unit.vocabulary.length, miniTest: [],
    practiceProblems: unit.vocabulary.map((question, index): Problem => {
      const id = `${grade}_vocabulary_01_${index + 1}`;
      return { id, title: question.skill, category: '語彙・文法', text: question.prompt,
        subQuestions: [writtenSubQuestion(question, `${id}_answer`)], explanation: `根拠：${question.evidence}\n${question.reasons.map((reason, i) => `${i + 1}. ${question.choices[i]} — ${reason}`).join('\n')}`,
        surroundingKnowledge: [question.evidence], deepDiveTopics: [] };
    }) };
  const reading: Chapter = { id: `${grade}_reading_01`, title: 'リーディング練習', abstractTitle: 'リーディング練習', realTitle: 'リーディング練習', questionGroup: 'リーディング', topics: [unit.theme], marks: unit.readings.reduce((n, block) => n + block.questions.length, 0), miniTest: [],
    practiceProblems: unit.readings.map((block, index): Problem => {
      const id = `${grade}_reading_01_${index + 1}`;
      return { id, title: block.title, category: 'リーディング', text: `${block.title}\n\n${block.text}`,
        subQuestions: block.questions.map((question, i) => writtenSubQuestion(question, `${id}_answer_${i + 1}`)),
        explanation: `【全文和訳】\n${TRANSLATIONS[unit.grade].readings[index]}\n\n${block.questions.map(q => `根拠：${q.evidence}\n${q.reasons[q.answer]}`).join('\n\n')}`,
        surroundingKnowledge: [], deepDiveTopics: [] };
    }) };
  return [
    { id: `${grade}_listening`, title: `${label} リスニング`, section: 'listening', chapters: [listening] },
    { id: `${grade}_reading`, title: `${label} リーディング`, section: 'reading', chapters: [reading] },
    { id: `${grade}_vocabulary`, title: `${label} 語彙・文法`, section: 'vocabulary', chapters: [vocabulary] },
  ];
}
