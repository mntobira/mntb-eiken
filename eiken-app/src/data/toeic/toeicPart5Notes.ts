/** TOEIC Part 5 解説の追加項目の並び（第1回〜）。toeicPart5Rounds.ts と同じ順。回を足したらここにも1行足す */
import type { ToeicP5Note } from './toeicPart5NoteTypes';
import { NOTES_01 } from './toeicPart5NotesRound01';
import { NOTES_02 } from './toeicPart5NotesRound02';
import { NOTES_03 } from './toeicPart5NotesRound03';
import { NOTES_04 } from './toeicPart5NotesRound04';
import { NOTES_05 } from './toeicPart5NotesRound05';
import { NOTES_06 } from './toeicPart5NotesRound06';
import { NOTES_07 } from './toeicPart5NotesRound07';
import { NOTES_08 } from './toeicPart5NotesRound08';
import { NOTES_09 } from './toeicPart5NotesRound09';
import { NOTES_10 } from './toeicPart5NotesRound10';
import { NOTES_11 } from './toeicPart5NotesRound11';
import { NOTES_12 } from './toeicPart5NotesRound12';
import { NOTES_13 } from './toeicPart5NotesRound13';
import { NOTES_14 } from './toeicPart5NotesRound14';
import { NOTES_15 } from './toeicPart5NotesRound15';

export const TOEIC_P5_NOTES: readonly (readonly ToeicP5Note[])[] = [
  NOTES_01,
  NOTES_02,
  NOTES_03,
  NOTES_04,
  NOTES_05,
  NOTES_06,
  NOTES_07,
  NOTES_08,
  NOTES_09,
  NOTES_10,
  NOTES_11,
  NOTES_12,
  NOTES_13,
  NOTES_14,
  NOTES_15,
];

/** 第round回・問index（0始まり）の追加項目。無ければ空 */
export function toeicNoteAt(round: number, index: number): ToeicP5Note {
  return TOEIC_P5_NOTES[round - 1]?.[index] ?? {};
}
