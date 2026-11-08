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
export function partsForGrade(grade: EikenGrade): Part[] {
  const questions = EIKEN_QUESTIONS.filter(q => q.grade === grade && q.published);
  if (!questions.length) return [];
  const label = EIKEN_GRADES.find(item => item.id === grade)!.label;
  const chapter: Chapter = { id: `${grade}_listening_01`, abstractTitle: 'リスニング練習', realTitle: 'リスニング練習', questionGroup: 'リスニング', topics: ['会話・説明の要点を聞き取る'], practiceProblems: questions.map(toProblem), miniTest: [], readCount: 2, marks: questions.length, speakers: '会話・説明' };
  return [{ id: `${grade}_listening`, title: `${label} リスニング`, section: 'listening', chapters: [chapter] }];
}
