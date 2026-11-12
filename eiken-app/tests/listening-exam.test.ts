import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EIKEN_GRADES } from '../src/eiken/config';
import {
  LISTENING_BLUEPRINTS,
  normalizeEnglishWords,
  validateListeningGradeSeries,
} from '../src/eiken/listeningExamCore';
import {
  ALL_LISTENING_EXAMS,
  LISTENING_EXAMS_BY_GRADE,
} from '../src/eiken/materials/listening-booklets';
import { partsForGrade } from '../src/eiken/questions';

describe('Eiken Listening 120-Round Mock Exam Bank', () => {
  it('validates all 8 grades x 15 rounds (120 rounds, 3465 questions, 3285 audio units, 750 image prompts)', () => {
    expect(ALL_LISTENING_EXAMS).toHaveLength(120);
    let totalQuestions = 0;
    let totalAudio = 0;
    let totalImages = 0;

    for (const grade of EIKEN_GRADES) {
      const exams = LISTENING_EXAMS_BY_GRADE[grade.id];
      const bp = LISTENING_BLUEPRINTS[grade.id];
      expect(exams).toHaveLength(15);
      validateListeningGradeSeries(exams, grade.id);

      for (const exam of exams) {
        totalAudio += exam.units.length;
        for (const unit of exam.units) {
          totalQuestions += unit.questions.length;
          if (unit.image) totalImages++;
        }
      }

      const listeningPart = partsForGrade(grade.id).find(p => p.section === 'listening');
      expect(listeningPart).toBeTruthy();
      const roundChapters = listeningPart!.chapters.filter(c => c.id.includes('_listening_r'));
      expect(roundChapters).toHaveLength(15);
      for (const ch of roundChapters) {
        expect(ch.marks).toBe(bp.totalQuestions);
        expect(ch.practiceProblems).toHaveLength(bp.totalAudioFiles);
      }
    }

    expect(totalQuestions).toBe(3465);
    expect(totalAudio).toBe(3285);
    expect(totalImages).toBe(750);
  });

  it('has zero 8-gram overlap with retired legacy fingerprints', () => {
    const legacy = JSON.parse(readFileSync('../assets/legacy-fingerprints.json', 'utf8')) as {
      ngram: number;
      hashes: string[];
    };
    const hashSet = new Set(legacy.hashes);
    for (const exam of ALL_LISTENING_EXAMS) {
      for (const unit of exam.units) {
        const texts = [
          ...unit.turns.map(t => t.text),
          ...unit.questions.flatMap(q => [q.questionPrompt, ...q.choices]),
        ];
        for (const txt of texts) {
          const words = normalizeEnglishWords(txt);
          for (let i = 0; i + legacy.ngram <= words.length; i++) {
            const gram = words.slice(i, i + legacy.ngram).join(' ');
            const digest = createHash('sha256').update(gram).digest('hex').slice(0, 20);
            expect(hashSet.has(digest)).toBe(false);
          }
        }
      }
    }
  });
});
