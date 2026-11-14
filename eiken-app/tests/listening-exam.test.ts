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
      expect(roundChapters).toHaveLength(15);
      for (const ch of roundChapters) {
        expect(ch.marks).toBe(bp.totalQuestions);
        expect(ch.practiceProblems).toHaveLength(bp.totalAudioFiles);
        for (const p of ch.practiceProblems) {
          expect(p.explanation).not.toContain('予定パス');
          for (const tr of p.audioTracks ?? []) {
            expect(tr.hint ?? '').not.toContain('ElevenLabs');
          }
        }
      }
    }

    expect(totalQuestions).toBe(3465);
    expect(totalAudio).toBe(3285);
    expect(totalImages).toBe(750);
  });

  it('integrates 375/375 Grade 5 MP3 audio files, 150/150 Grade 4 illustrations, and 271/300 Grade 5 illustrations', () => {
    // Audio check (Grade 5: all 375/375 MP3s)
    const g5AudioKeys = Object.keys(LISTENING_AUDIO_URLS).filter(k => k.startsWith('eiken_5_'));
    expect(g5AudioKeys).toHaveLength(375);
    for (const audioUrl of Object.values(LISTENING_AUDIO_URLS)) {
      expect(audioUrl.startsWith('/eiken_audio/')).toBe(true);
      expect(existsSync(`public${audioUrl}`)).toBe(true);
    }

    // Illustration check (Grade 4: 150/150, Grade 5: 271+/300)
    const g4ImgKeys = Object.keys(LISTENING_IMAGE_URLS).filter(k => k.startsWith('eiken_4_'));
    const g5ImgKeys = Object.keys(LISTENING_IMAGE_URLS).filter(k => k.startsWith('eiken_5_'));
    expect(g4ImgKeys).toHaveLength(150);
    expect(g5ImgKeys.length).toBeGreaterThanOrEqual(271);

    for (const webUrl of Object.values(LISTENING_IMAGE_URLS)) {
      expect(webUrl.startsWith('/eiken_images/')).toBe(true);
      expect(existsSync(`public${webUrl}`)).toBe(true);
    }

    const g4Chapters = partsForGrade('eiken_4')
      .find(p => p.section === 'listening')!
      .chapters.filter(c => c.id.includes('_listening_r'));
    for (const ch of g4Chapters) {
      expect(ch.title).toContain('イラスト完備');
      const withImg = ch.practiceProblems.filter(p => Boolean(p.subQuestions[0]?.imageUrl));
      expect(withImg).toHaveLength(10);
      for (const p of withImg) {
        expect(p.subQuestions[0].optionTexts).toEqual(['音声の選択肢 1', '音声の選択肢 2', '音声の選択肢 3']);
      }
    }

    const g5Chapters = partsForGrade('eiken_5')
      .find(p => p.section === 'listening')!
      .chapters.filter(c => c.id.includes('_listening_r'));
    for (const ch of g5Chapters) {
      expect(ch.title).toContain('専用音声');
      for (const p of ch.practiceProblems) {
        expect(p.audioTracks?.[0]?.audioUrl).toMatch(/^\/eiken_audio\/eiken_5\/eiken_5_listening_r\d+_part[123]_\d+\.mp3$/);
      }
    }
    for (const ch of g5Chapters.slice(0, 5)) {
      expect(ch.title).toContain('イラスト完備');
      const withImg = ch.practiceProblems.filter(p => Boolean(p.subQuestions[0]?.imageUrl));
      expect(withImg).toHaveLength(20);
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
