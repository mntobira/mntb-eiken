import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { EikenGrade } from '../src/eiken/config';
import {
  normalizeEnglishWords,
  validateListeningGradeSeries,
  type ListeningExamRound,
} from '../src/eiken/listeningExamCore';
import { GRADE_5_LISTENING_EXAMS } from '../src/eiken/materials/listening-g5';
import { GRADE_4_LISTENING_EXAMS } from '../src/eiken/materials/listening-g4';
import { GRADE_3_LISTENING_EXAMS, GRADE_PRE2_LISTENING_EXAMS } from '../src/eiken/materials/listening-g3-pre2';
import { GRADE_PRE2PLUS_LISTENING_EXAMS, GRADE_2_LISTENING_EXAMS } from '../src/eiken/materials/listening-pre2plus-g2';
import { GRADE_PRE1_LISTENING_EXAMS } from '../src/eiken/materials/listening-pre1';
import { GRADE_1_LISTENING_EXAMS } from '../src/eiken/materials/listening-g1';

const legacyRaw = JSON.parse(
  readFileSync(resolve(process.cwd(), '../assets/legacy-fingerprints.json'), 'utf-8'),
) as { ngram: number; hashes: string[] };
const legacyHashes = new Set<string>(legacyRaw.hashes);

export function verifyNoLegacyOverlap(exams: readonly ListeningExamRound[]): void {
  const n = legacyRaw.ngram || 8;
  for (const exam of exams) {
    for (const unit of exam.units) {
      const texts = [
        ...unit.turns.map(t => t.text),
        ...unit.questions.flatMap(q => [q.questionPrompt, ...q.choices]),
        ...(unit.material?.rows?.flat() ?? []),
        ...(unit.material?.notes ?? []),
      ];
      for (const txt of texts) {
        const words = normalizeEnglishWords(txt);
        for (let i = 0; i + n <= words.length; i++) {
          const gram = words.slice(i, i + n).join(' ');
          const digest = createHash('sha256').update(gram).digest('hex').slice(0, 20);
          if (legacyHashes.has(digest)) {
            throw new Error(`LEGACY_8GRAM_COLLISION:${unit.audioId}:${gram}`);
          }
        }
      }
    }
  }
}

const seriesList: Array<{ grade: EikenGrade; exams: readonly ListeningExamRound[] }> = [
  { grade: 'eiken_5', exams: GRADE_5_LISTENING_EXAMS },
  { grade: 'eiken_4', exams: GRADE_4_LISTENING_EXAMS },
  { grade: 'eiken_3', exams: GRADE_3_LISTENING_EXAMS },
  { grade: 'eiken_pre2', exams: GRADE_PRE2_LISTENING_EXAMS },
  { grade: 'eiken_pre2plus', exams: GRADE_PRE2PLUS_LISTENING_EXAMS },
  { grade: 'eiken_2', exams: GRADE_2_LISTENING_EXAMS },
  { grade: 'eiken_pre1', exams: GRADE_PRE1_LISTENING_EXAMS },
  { grade: 'eiken_1', exams: GRADE_1_LISTENING_EXAMS },
];

let totalRounds = 0;
let totalQuestions = 0;
let totalAudio = 0;
let totalImages = 0;
let failures = 0;

for (const { grade, exams } of seriesList) {
  try {
    validateListeningGradeSeries(exams, grade);
    verifyNoLegacyOverlap(exams);
    const qCount = exams.reduce((s, e) => s + e.units.reduce((su, u) => su + u.questions.length, 0), 0);
    const aCount = exams.reduce((s, e) => s + e.units.length, 0);
    const iCount = exams.reduce((s, e) => s + e.units.filter(u => u.image !== null).length, 0);
    totalRounds += exams.length;
    totalQuestions += qCount;
    totalAudio += aCount;
    totalImages += iCount;
    console.log(`[PASS] ${grade}: ${exams.length} rounds | ${qCount} questions | ${aCount} audio | ${iCount} images`);
  } catch (err) {
    failures++;
    console.error(`[FAIL] ${grade}:`, (err as Error).message);
  }
}

if (failures > 0) {
  process.exit(1);
}
console.log(`TOTAL VERIFIED: ${totalRounds} rounds | ${totalQuestions} questions | ${totalAudio} audio | ${totalImages} images`);
