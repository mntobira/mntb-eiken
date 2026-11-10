/**
 * 志望校と、単語帳の「目標」（出題範囲のプリセット）の保存（2026-10-01 夜）。
 *
 * 単語帳（FoundationWords）と設定（ProfileModal）の両方から読み書きするので、
 * 重いデータを読み込まない小さなモジュールに分けた。保存先は以前と同じ localStorage のキー。
 */
import { safeLocalStorage, safeParseJson } from './safeLocalStorage';

export const VOCAB_PREF_KEY = 'eiken_wordbook_prefs_v2';

/** 単語帳の目標（ラベルは FoundationWords の PRESETS と同じ） */
export const GOAL_OPTIONS = [
  { id: 'eiken_5', label: '5級' }, { id: 'eiken_4', label: '4級' }, { id: 'eiken_3', label: '3級' },
  { id: 'eiken_pre2', label: '準2級' }, { id: 'eiken_pre2plus', label: '準2級プラス' },
  { id: 'eiken_2', label: '2級' }, { id: 'eiken_pre1', label: '準1級' }, { id: 'custom', label: '全級から選ぶ' },
] as const;
export type GoalId = typeof GOAL_OPTIONS[number]['id'];

function readRaw(): Record<string, unknown> {
  try {
    const v = safeParseJson<unknown>(safeLocalStorage()?.getItem(VOCAB_PREF_KEY), {});
    return v && typeof v === 'object' ? v as Record<string, unknown> : {};
  } catch { return {}; }
}

export function readGoal(): GoalId {
  const p = readRaw().preset;
  return GOAL_OPTIONS.some(o => o.id === p) ? (p as GoalId) : 'eiken_5';
}

/** 目標を変える（単語帳で選んだ「志望校別」のレベルなど、ほかの設定は残す） */
export function writeGoal(id: GoalId): void {
  try { safeLocalStorage()?.setItem(VOCAB_PREF_KEY, JSON.stringify({ ...readRaw(), preset: id })); } catch { /* 保存できなくても続ける */ }
}

/** 志望校名は名前と違って他人に見せないので、長さだけ整える */
export const TARGET_SCHOOL_MAX = 40;
export function normalizeTargetSchool(v: string): string {
  return v.replace(/\s+/g, ' ').trim().slice(0, TARGET_SCHOOL_MAX);
}
