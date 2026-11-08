import type { BattleAnswerFormat, BattleQuestion } from '../core/types';
// University questions never enter this derivative. Online battle is not enabled.
export const POOL_COUNTS: Readonly<Record<string, number>> = {};
export const POOL_FORMAT_COUNTS: Readonly<Record<string, Readonly<Partial<Record<BattleAnswerFormat, number>>>>> = {};
export const ANSWER_COUNTS: Readonly<Record<string, number>> = {};
export function poolCountOf(_subject: string, _formats: readonly BattleAnswerFormat[]): number { return 0; }
export async function loadPool(_subject: string): Promise<readonly BattleQuestion[]> { return []; }
export function questionByIdSync(_subject: string, _id: string): BattleQuestion | undefined { return undefined; }
export async function poolIdsOf(_subject: string, _formats: readonly BattleAnswerFormat[]): Promise<string[]> { return []; }
export function loadedPool(_subject: string): readonly BattleQuestion[] { return []; }
export async function loadBattleAnswers(_subject: string): Promise<ReadonlyMap<string, string>> { return new Map(); }
