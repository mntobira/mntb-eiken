import type { BattleAnswerFormat, BattleQuestion } from '../core/types';
import { EIKEN_GRADES } from '../../eiken/config';
import { getSubjectStats } from '../../data/chapterIndex.generated';

// Same match/scoring/UI as listening; only the corpus and subject identifiers differ.
// Keep the full Eiken question bank out of the initial bundle.
export const POOL_COUNTS: Readonly<Record<string, number>> = Object.fromEntries(
  EIKEN_GRADES.filter(grade => grade.available).map(grade => [grade.id, getSubjectStats(grade.id).questions ?? 0]),
);
export const POOL_FORMAT_COUNTS: Readonly<Record<string, Readonly<Partial<Record<BattleAnswerFormat, number>>>>> =
  Object.fromEntries(Object.entries(POOL_COUNTS).map(([grade, count]) => [grade, { choice4: count }]));
export const ANSWER_COUNTS = POOL_COUNTS;
const cache = new Map<string, readonly BattleQuestion[]>();
const inflight = new Map<string, Promise<readonly BattleQuestion[]>>();

export function poolCountOf(subject: string, formats: readonly BattleAnswerFormat[]): number {
  return formats.reduce((count, format) => count + (POOL_FORMAT_COUNTS[subject]?.[format] ?? 0), 0);
}
export async function loadPool(subject: string): Promise<readonly BattleQuestion[]> {
  if (!(subject in POOL_COUNTS)) return [];
  const existing = cache.get(subject);
  if (existing) return existing;
  const running = inflight.get(subject);
  if (running) return running;
  const promise = import('../../eiken/questions').then(({ EIKEN_QUESTIONS }) => {
    const list: BattleQuestion[] = EIKEN_QUESTIONS.filter(question => question.grade === subject && question.published)
      .map((question): BattleQuestion => ({
        id: `${question.id}_answer`, subject, chapterId: `${subject}_listening_01`,
        problemId: question.id, subQuestionId: `${question.id}_answer`, format: 'choice4',
        prompt: '', label: question.instruction, options: [...question.choices],
        answerIndex: question.correctAnswer, panelOrder: [], timeLimit: 55, audioUrl: question.audioUrl || undefined,
      })).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    cache.set(subject, list);
    return list;
  }).finally(() => inflight.delete(subject));
  inflight.set(subject, promise);
  return promise;
}
export function questionByIdSync(subject: string, id: string): BattleQuestion | undefined {
  return cache.get(subject)?.find(question => question.id === id);
}
export async function poolIdsOf(subject: string, formats: readonly BattleAnswerFormat[]): Promise<string[]> {
  return (await loadPool(subject)).filter(question => formats.includes(question.format)).map(question => question.id);
}
export function loadedPool(subject: string): readonly BattleQuestion[] { return cache.get(subject) ?? []; }

/** Called only by the result screen; explanations do not enter the answering DOM. */
export async function loadBattleAnswers(subject: string): Promise<ReadonlyMap<string, string>> {
  if (!(subject in POOL_COUNTS)) return new Map();
  const { EIKEN_QUESTIONS } = await import('../../eiken/questions');
  return new Map(EIKEN_QUESTIONS.filter(question => question.grade === subject && question.published)
    .map(question => [`${question.id}_answer`, `${question.choices[question.correctAnswer]} — ${question.explanation}`]));
}

/** TTS fallback for the Eiken corpus, which has no recorded audio yet. Never render this as text. */
export async function loadBattleSpeech(id: string): Promise<string | undefined> {
  const { EIKEN_QUESTIONS } = await import('../../eiken/questions');
  const question = EIKEN_QUESTIONS.find(question => `${question.id}_answer` === id && question.published);
  return question ? `${question.transcript}\nQuestion. ${question.instruction}` : undefined;
}
