import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyWriting, parseWriting, writingKey } from '../src/eiken/writingProgress';
import {
  buildSpeakingSubmissionsCsv,
  buildWritingSubmissionsCsv,
} from '../src/sugoroku/shared/csvExport';
import {
  MAX_SPEAKING_AUDIO_BYTES,
  validateSpeakingAudioBlob,
} from '../src/sugoroku/shared/storageClient';
import { buildSpeakingStoragePath } from '../src/sugoroku/shared/types';
import {
  classifyMediaError,
  computeVoiceActivityMetrics,
  detectPreferredAudioMimeType,
} from '../src/sugoroku/speaking-scbt/audioRecorder';
import {
  SCBT_SPEAKING_SETS,
  speakingSetsForGrade,
} from '../src/sugoroku/speaking-scbt/mockSpeakingSets';
import { playScbtBeep } from '../src/sugoroku/speaking-scbt/scbtBeep';
import { ScbtSpeakingPractice } from '../src/sugoroku/speaking-scbt/ScbtSpeakingPractice';
import {
  buildSpeakingAiCoachPrompt,
  buildSpeakingFeedbackSheetHtml,
  parseSpeakingAiReviewResponse,
} from '../src/sugoroku/speaking-scbt/speakingFeedbackSheet';
import {
  clearDraftSpeakingClips,
  fetchStudentSpeakingSubmissions,
  loadDraftSpeakingClips,
  saveDraftSpeakingClip,
  saveSpeakingReview,
  submitSpeakingSession,
} from '../src/sugoroku/speaking-scbt/speakingStore';
import { validateSpeakingSet } from '../src/sugoroku/speaking-scbt/speakingTypes';
import { TeacherSpeakingReviewTab } from '../src/sugoroku/speaking-scbt/TeacherSpeakingReviewTab';
import { computeEnglishDiff } from '../src/sugoroku/writing-review/diffHighlight';
import {
  analyzeWritingFormat,
  buildWritingIssueHighlights,
} from '../src/sugoroku/writing-review/formatCheck';
import { buildFeedbackSheetHtml } from '../src/sugoroku/writing-review/printFeedbackSheet';
import {
  buildWritingAiReviewPrompt,
  parseAiReviewResponse,
} from '../src/sugoroku/writing-review/promptBuilder';
import { TeacherWritingReviewTab } from '../src/sugoroku/writing-review/TeacherWritingReviewTab';
import {
  fetchClassWritingSubmissions,
  fetchStudentWritingSubmissions,
  saveWritingReview,
  SUGOROKU_DEMO_CLASS_ID,
  submitWritingToClass,
} from '../src/sugoroku/writing-review/writingStore';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(String(key), String(value));
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  clear() {
    this.values.clear();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AI 3: Writing self-check, inline highlights, word-diff, AI draft importer, CSV & A4 sheet', () => {
  it('detects format issues, builds inline issue highlight tokens, summary verbatim copy, and essay signposts', () => {
    const cleanText =
      'I think that students should read more books in school. First, reading helps us learn many useful expressions. Second, it broadens our ideas about society.';
    const okResult = analyzeWritingFormat(cleanText, [20, 35], 'essay');
    expect(okResult.passedAll).toBe(true);
    expect(okResult.inTargetRange).toBe(true);
    expect(okResult.sentenceCount).toBe(3);

    const flawedText = 'first, i beleive enviroment is very importent。 Because it helps us';
    const warnResult = analyzeWritingFormat(flawedText, [80, 100], 'email');
    const codes = warnResult.issues.map(i => i.code);
    expect(codes).toContain('word_under');
    expect(codes).toContain('fullwidth_punctuation');
    expect(codes).toContain('missing_terminal_punctuation');
    expect(codes).toContain('sentence_start_lowercase');
    expect(codes).toContain('lowercase_pronoun_i');
    expect(codes).toContain('spelling_suspect');
    expect(codes).toContain('email_questions_shortage');

    const highlights = buildWritingIssueHighlights(flawedText, 'email');
    const flaggedTexts = highlights.filter(h => h.kind === 'issue').map(h => h.text);
    expect(flaggedTexts).toContain('i');
    expect(flaggedTexts).toContain('beleive');
    expect(flaggedTexts).toContain('。');

    const sourcePassage =
      'Many municipal libraries have recently introduced quiet evening study rooms for high school students.';
    const copiedSummary =
      'Many municipal libraries have recently introduced quiet evening study rooms for teenagers, and students enjoy them.';
    const summaryResult = analyzeWritingFormat(
      copiedSummary,
      [12, 30],
      'summary',
      sourcePassage,
    );
    expect(summaryResult.issues.map(i => i.code)).toContain('summary_verbatim_copy');

    const noSignpostEssay =
      'I think school gardens are great for high school students today. Students can learn about growing fresh vegetables every week with classmates. Working outdoors makes everyone smile together after difficult classes.';
    const essayHintResult = analyzeWritingFormat(noSignpostEssay, [25, 40], 'essay');
    expect(essayHintResult.issues.map(i => i.code)).toContain('essay_signpost_hint');
  });

  it('computes word-level LCS diff and parses Gemini/ChatGPT structured AI review responses', () => {
    const diff = computeEnglishDiff(
      'I agree with the idea because sports build teamwork.',
      'I strongly agree with this idea because playing sports builds teamwork.',
    );
    expect(diff.some(seg => seg.kind === 'added' && seg.text.includes('strongly'))).toBe(true);
    expect(diff.some(seg => seg.kind === 'removed' && seg.text.includes('the'))).toBe(true);
    expect(diff.some(seg => seg.kind === 'added' && seg.text.includes('this'))).toBe(true);

    const sampleAiReply = `
[SCORES]
content: 4
structure: 3
vocabulary: 3
grammar: 4
[/SCORES]
[CORRECTED]
I strongly agree with this idea because playing team sports helps high school students cooperate with one another.
[/CORRECTED]
[COMMENT]
主張と2つの理由が明確に書けていて素晴らしいです！
[/COMMENT]
[STRENGTHS]
First / Second の構成がとても分かりやすい
[/STRENGTHS]
[NEXT_ACTIONS]
動名詞主語の三単現 -s を確認する
[/NEXT_ACTIONS]
`;
    const parsed = parseAiReviewResponse(sampleAiReply);
    expect(parsed.rubricScores).toEqual({
      content: 4,
      structure: 3,
      vocabulary: 3,
      grammar: 4,
    });
    expect(parsed.correctedText).toContain('I strongly agree with this idea');
    expect(parsed.comment).toContain('素晴らしいです');
    expect(parsed.strengths).toContain('First / Second');
    expect(parsed.nextActions).toContain('三単現');
  });

  it('exports UTF-8 BOM CSV and generates XSS-safe A4 monochrome diff feedback sheet without touching personal local writing format', async () => {
    const store = new MemoryStorage();
    vi.stubGlobal('localStorage', store);

    const personalRecord = JSON.stringify({
      ...emptyWriting(),
      drafts: {
        eiken_2_writing_opinion: {
          text: 'My personal draft stays intact.',
          checked: [0, 1],
          reviewed: false,
          updatedAt: 12345,
        },
      },
    });
    store.setItem(writingKey('student_01'), personalRecord);

    const submitted = await submitWritingToClass({
      classId: SUGOROKU_DEMO_CLASS_ID,
      studentUid: 'student_01',
      studentName: 'テスト生徒 <script>alert(1)</script>',
      grade: 'eiken_2',
      taskKey: 'eiken_2_writing_opinion',
      taskTitle: '英検2級 意見論述',
      wordCount: 82,
      text: 'I agree with the idea because sports build teamwork.',
      formatWarnings: ['語数が目安より少ない状態です'],
    });

    const prompt = buildWritingAiReviewPrompt(submitted, {
      grade: 'eiken_2',
      taskTitle: '英検2級 意見論述',
      instruction: 'Write 80-100 words.',
    });
    expect(prompt).toContain('[SCORES]');

    const reviewed = await saveWritingReview(SUGOROKU_DEMO_CLASS_ID, submitted, {
      reviewerUid: 'teacher_fujisawa',
      reviewerName: '藤沢 講師',
      score: 13,
      maxScore: 16,
      rubricScores: { content: 4, structure: 3, vocabulary: 3, grammar: 3 },
      comment: '理由が明確でとても読みやすい英文です！',
      correctedText: 'I agree with this idea because playing sports builds strong teamwork.',
    });

    const csv = buildWritingSubmissionsCsv([reviewed]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('13');
    expect(csv).toContain('藤沢 講師');

    const studentHistory = await fetchStudentWritingSubmissions(
      SUGOROKU_DEMO_CLASS_ID,
      'student_01',
      'eiken_2_writing_opinion',
    );
    expect(studentHistory[0].status).toBe('reviewed');

    const classAll = await fetchClassWritingSubmissions(SUGOROKU_DEMO_CLASS_ID);
    expect(classAll.some(item => item.id === reviewed.id)).toBe(true);

    const sheetHtml = buildFeedbackSheetHtml(reviewed, {
      taskTitle: '英検2級 意見論述',
      targetWordsLabel: '80〜100語',
    });
    expect(sheetHtml).toContain('Before → After');
    expect(sheetHtml).not.toContain('<script>alert(1)</script>');

    expect(store.getItem(writingKey('student_01'))).toBe(personalRecord);
    expect(parseWriting(store.getItem(writingKey('student_01'))).drafts.eiken_2_writing_opinion.text).toBe(
      'My personal draft stays intact.',
    );
  });
});

describe('AI 3: S-CBT Speaking MIME, voice telemetry, draft auto-recovery, 8 original sets & AI review parser', () => {
  it('selects WebM/Opus on Chrome and MP4/M4A on iPad/iPhone Safari, and computes speech ratio & max silence', () => {
    const chromeMime = detectPreferredAudioMimeType(
      mime => mime === 'audio/webm;codecs=opus' || mime === 'audio/webm',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36',
    );
    expect(chromeMime.extension).toBe('webm');

    const iosSafariMime = detectPreferredAudioMimeType(
      mime => mime === 'audio/mp4;codecs=mp4a.40.2' || mime === 'audio/mp4',
      'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) Version/18.1 Mobile/15E148 Safari/604.1',
    );
    expect(iosSafariMime.extension).toBe('m4a');

    // 10 frames active (20) + 15 frames silent (0 = 1.5s) + 15 frames active (25) => 25/40 = 63%
    const samples = [
      ...Array(10).fill(20),
      ...Array(15).fill(0),
      ...Array(15).fill(25),
    ];
    const metrics = computeVoiceActivityMetrics(samples, 100, 8);
    expect(metrics.speechRatio).toBe(63);
    expect(metrics.maxSilenceSec).toBe(1.5);
  });

  it('classifies mic errors and enforces exact Storage path contract and 5MB audio size cap', () => {
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: async () => ({}) },
    });
    vi.stubGlobal('MediaRecorder', class {});

    expect(classifyMediaError({ name: 'NotAllowedError' }).code).toBe('permission_denied');
    expect(classifyMediaError({ name: 'NotFoundError' }).code).toBe('device_not_found');
    expect(classifyMediaError({ name: 'NotReadableError' }).code).toBe('device_busy');

    expect(() => playScbtBeep('start', false)).not.toThrow();
    expect(
      buildSpeakingStoragePath('cls_01', 'uid_abc', 'sub_001', 'reading_aloud', 'webm'),
    ).toBe('sugoroku_speaking/cls_01/uid_abc/sub_001/reading_aloud.webm');
    expect(() =>
      validateSpeakingAudioBlob({ size: MAX_SPEAKING_AUDIO_BYTES + 1, type: 'audio/mp4' }),
    ).toThrow('5MB');
  });

  it('ships 8 original sets across 4 grades (G2 x2, Pre-2 Plus x2, Pre-2 x2, G3 x2) with zero 8-gram overlap against legacy fingerprints', () => {
    expect(SCBT_SPEAKING_SETS).toHaveLength(8);
    expect(speakingSetsForGrade('eiken_2')).toHaveLength(2);
    expect(speakingSetsForGrade('eiken_pre2plus')).toHaveLength(2);
    expect(speakingSetsForGrade('eiken_pre2')).toHaveLength(2);
    expect(speakingSetsForGrade('eiken_3')).toHaveLength(2);

    const legacy = JSON.parse(
      readFileSync(resolve(process.cwd(), '../assets/legacy-fingerprints.json'), 'utf8'),
    ) as { ngram: number; hashes: string[] };
    const forbidden = new Set(legacy.hashes);
    const words = (text: string) =>
      text.toLowerCase().replace(/[’]/g, "'").match(/[a-z]+(?:['-][a-z]+)*/g) ?? [];
    const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 20);

    for (const set of SCBT_SPEAKING_SETS) {
      validateSpeakingSet(set);
      const texts = [
        set.cardTitle,
        set.passage,
        ...set.questions.flatMap(q => [
          q.promptAudioScript,
          q.starterSentence ?? '',
          q.modelAnswer,
        ]),
      ];
      for (const t of texts) {
        const tokens = words(t);
        for (let i = 0; i + legacy.ngram <= tokens.length; i++) {
          const h = hash(tokens.slice(i, i + legacy.ngram).join(' '));
          expect(forbidden.has(h), `8-gram collision in ${set.id}`).toBe(false);
        }
      }
    }
  });

  it('auto-saves/restores mid-session draft clips, submits telemetry & transcripts, parses AI speaking reviews, and exports BOM CSV', async () => {
    const store = new MemoryStorage();
    vi.stubGlobal('localStorage', store);

    const set = speakingSetsForGrade('eiken_3')[0];
    const dummyBlob = new Blob([new Uint8Array(512)], { type: 'audio/mp4' });

    await saveDraftSpeakingClip('student_sp_01', set.id, 'reading_aloud', {
      blob: dummyBlob,
      objectUrl: '',
      mimeType: 'audio/mp4',
      extension: 'm4a',
      durationSec: 25,
      sizeBytes: 512,
      speechRatio: 80,
      maxSilenceSec: 1.2,
      transcript: 'Every October students hold an autumn music festival.',
    });
    const restored = await loadDraftSpeakingClips('student_sp_01', set.id);
    expect(restored.reading_aloud?.speechRatio).toBe(80);
    expect(restored.reading_aloud?.transcript).toContain('autumn music festival');

    const submitted = await submitSpeakingSession({
      classId: SUGOROKU_DEMO_CLASS_ID,
      studentUid: 'student_sp_01',
      studentName: '高橋 陸（高1）',
      grade: 'eiken_3',
      set,
      clips: {
        reading_aloud: {
          partId: 'reading_aloud',
          blob: dummyBlob,
          mimeType: 'audio/mp4',
          extension: 'm4a',
          durationSec: 25,
          speechRatio: 80,
          maxSilenceSec: 1.2,
          transcript: 'Every October students hold an autumn music festival.',
        },
        q1: { partId: 'q1', blob: dummyBlob, mimeType: 'audio/mp4', extension: 'm4a', durationSec: 9, speechRatio: 74, maxSilenceSec: 1.4, transcript: 'They hold it in the school gym.' },
        q2: { partId: 'q2', blob: dummyBlob, mimeType: 'audio/mp4', extension: 'm4a', durationSec: 10, speechRatio: 70, maxSilenceSec: 1.8, transcript: 'She is playing the guitar.' },
        q3: { partId: 'q3', blob: dummyBlob, mimeType: 'audio/mp4', extension: 'm4a', durationSec: 11, speechRatio: 68, maxSilenceSec: 2.1, transcript: 'He is going to put a poster on the wall.' },
        q4: { partId: 'q4', blob: dummyBlob, mimeType: 'audio/mp4', extension: 'm4a', durationSec: 16, speechRatio: 72, maxSilenceSec: 1.9, transcript: 'I like listening to pop music.' },
      },
    });
    // 提出完了後は途中退避データが自動クリアされる
    const afterSubmitDrafts = await loadDraftSpeakingClips('student_sp_01', set.id);
    expect(Object.keys(afterSubmitDrafts)).toHaveLength(0);
    await clearDraftSpeakingClips('student_sp_01', set.id);

    const coachPrompt = buildSpeakingAiCoachPrompt(submitted, set);
    expect(coachPrompt).toContain('英検3級');
    expect(coachPrompt).toContain('発話率 80%');
    expect(coachPrompt).toContain('She is playing the guitar.');

    const parsedAi = parseSpeakingAiReviewResponse(
      `[SCORES]\nreading_aloud: 5/5\nq1: 5/5\nq2: 5/5\nq3: 4/5\nq4: 5/5\nattitude: 3/3\n[/SCORES]\n[COMMENT]\n現在進行形がとても正確に言えています！\n[/COMMENT]`,
      5,
      5,
    );
    expect(parsedAi.rubricScores.reading_aloud).toBe(5);
    expect(parsedAi.rubricScores.q3).toBe(4);
    expect(parsedAi.comment).toContain('現在進行形');

    const reviewed = await saveSpeakingReview(SUGOROKU_DEMO_CLASS_ID, submitted, {
      reviewerUid: 'teacher_fujisawa',
      reviewerName: '藤沢 講師',
      rubricScores: parsedAi.rubricScores,
      comment: parsedAi.comment!,
    });

    const spCsv = buildSpeakingSubmissionsCsv([reviewed]);
    expect(spCsv.startsWith('\uFEFF')).toBe(true);
    expect(spCsv).toContain('英検3級');

    const speakingSheetHtml = buildSpeakingFeedbackSheetHtml(reviewed, set);
    expect(speakingSheetHtml).toContain('27 / 28');
    expect(speakingSheetHtml).toContain('She is playing the guitar.');

    const myRows = await fetchStudentSpeakingSubmissions(
      SUGOROKU_DEMO_CLASS_ID,
      'student_sp_01',
      set.id,
    );
    expect(myRows[0].review?.comment).toContain('現在進行形');
  });

  it('renders student S-CBT speaking screen and teacher review tabs cleanly via SSR', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    const speakingHtml = renderToStaticMarkup(
      createElement(ScbtSpeakingPractice, {
        uid: 'guest',
        grade: 'eiken_3',
        onBack: () => {},
      }),
    );
    expect(speakingHtml).toContain('英検3級');
    expect(speakingHtml).toContain('学校の秋の音楽フェスティバル');

    const teacherWritingHtml = renderToStaticMarkup(
      createElement(TeacherWritingReviewTab, {
        classId: SUGOROKU_DEMO_CLASS_ID,
        demoMode: true,
      }),
    );
    expect(teacherWritingHtml).toContain('data-sugoroku-export-writing-csv');

    const teacherSpeakingHtml = renderToStaticMarkup(
      createElement(TeacherSpeakingReviewTab, {
        classId: SUGOROKU_DEMO_CLASS_ID,
        demoMode: true,
      }),
    );
    expect(teacherSpeakingHtml).toContain('data-sugoroku-export-speaking-csv');
  });
});
