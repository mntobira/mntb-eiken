import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
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
import { LISTENING_AUDIO_URLS } from '../src/eiken/listeningAudio.generated';
import { LISTENING_IMAGE_URLS } from '../src/eiken/listeningImages.generated';
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
      expect(roundChapters).toHaveLength(15 * bp.parts.length);
      for (const pSpec of bp.parts) {
        const partChs = roundChapters.filter(c => c.id.endsWith(`_${pSpec.id}`));
        expect(partChs).toHaveLength(15);
        for (const ch of partChs) {
          expect(ch.marks).toBe(pSpec.questionCount);
          expect(ch.practiceProblems).toHaveLength(pSpec.audioUnitCount);
          for (const p of ch.practiceProblems) {
            expect(p.explanation).not.toContain('予定パス');
            for (const tr of p.audioTracks ?? []) {
              expect(tr.hint ?? '').not.toContain('ElevenLabs');
            }
          }
        }
      }
      expect(roundChapters.reduce((sum, ch) => sum + ch.marks, 0)).toBe(bp.totalQuestions * 15);
      expect(roundChapters.reduce((sum, ch) => sum + ch.practiceProblems.length, 0)).toBe(bp.totalAudioFiles * 15);
    }

    expect(totalQuestions).toBe(3465);
    expect(totalAudio).toBe(3285);
    expect(totalImages).toBe(750);
  });

  it('integrates 375/375 Grade 5 MP3 audio files and 721/750 illustrations across Grades 5, 4, 3, Pre-1, and 1', () => {
    // Audio check (Grade 5: all 375/375 MP3s)
    const g5AudioKeys = Object.keys(LISTENING_AUDIO_URLS).filter(k => k.startsWith('eiken_5_'));
    expect(g5AudioKeys).toHaveLength(375);
    for (const audioUrl of Object.values(LISTENING_AUDIO_URLS)) {
      expect(audioUrl.startsWith('/eiken_audio/')).toBe(true);
      expect(existsSync(`public${audioUrl}`)).toBe(true);
    }

    // Illustration check (Grade 4: 150/150, Grade 3: 150/150, Pre-1: 75/75, Grade 1: 75/75, Grade 5: 271+/300)
    expect(Object.keys(LISTENING_IMAGE_URLS).filter(k => k.startsWith('eiken_4_'))).toHaveLength(150);
    expect(Object.keys(LISTENING_IMAGE_URLS).filter(k => k.startsWith('eiken_3_'))).toHaveLength(150);
    expect(Object.keys(LISTENING_IMAGE_URLS).filter(k => k.startsWith('eiken_pre1_'))).toHaveLength(75);
    expect(Object.keys(LISTENING_IMAGE_URLS).filter(k => k.startsWith('eiken_1_'))).toHaveLength(75);
    expect(Object.keys(LISTENING_IMAGE_URLS).filter(k => k.startsWith('eiken_5_')).length).toBeGreaterThanOrEqual(271);

    for (const webUrl of Object.values(LISTENING_IMAGE_URLS)) {
      expect(webUrl.startsWith('/eiken_images/')).toBe(true);
      expect(existsSync(`public${webUrl}`)).toBe(true);
    }

    const g4Part1Chapters = partsForGrade('eiken_4')
      .find(p => p.section === 'listening')!
      .chapters.filter(c => c.id.endsWith('_part1'));
    expect(g4Part1Chapters).toHaveLength(15);
    for (const ch of g4Part1Chapters) {
      expect(ch.abstractTitle).toContain('イラスト完備');
      expect(ch.practiceProblems).toHaveLength(10);
      for (const p of ch.practiceProblems) {
        expect(Boolean(p.subQuestions[0]?.imageUrl)).toBe(true);
        expect(p.subQuestions[0].optionTexts).toEqual(['音声の選択肢 1', '音声の選択肢 2', '音声の選択肢 3']);
      }
    }

    const g5ListeningChapters = partsForGrade('eiken_5')
      .find(p => p.section === 'listening')!
      .chapters.filter(c => c.id.includes('_listening_r'));
    expect(g5ListeningChapters).toHaveLength(45);
    for (const ch of g5ListeningChapters) {
      expect(ch.abstractTitle).toContain('専用音声');
      for (const p of ch.practiceProblems) {
        expect(p.audioTracks?.[0]?.audioUrl).toMatch(/^\/eiken_audio\/eiken_5\/eiken_5_listening_r\d+_part[123]_\d+\.mp3$/);
      }
    }
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
