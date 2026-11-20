import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyWriting, parseWriting, writingKey } from '../src/eiken/writingProgress';
import {
  MAX_SPEAKING_AUDIO_BYTES,
  validateSpeakingAudioBlob,
} from '../src/sugoroku/shared/storageClient';
import { buildSpeakingStoragePath } from '../src/sugoroku/shared/types';
import {
  classifyMediaError,
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
} from '../src/sugoroku/speaking-scbt/speakingFeedbackSheet';
import {
  fetchStudentSpeakingSubmissions,
  saveSpeakingReview,
  submitSpeakingSession,
} from '../src/sugoroku/speaking-scbt/speakingStore';
import { validateSpeakingSet } from '../src/sugoroku/speaking-scbt/speakingTypes';
import { TeacherSpeakingReviewTab } from '../src/sugoroku/speaking-scbt/TeacherSpeakingReviewTab';
import { computeEnglishDiff } from '../src/sugoroku/writing-review/diffHighlight';
import { analyzeWritingFormat } from '../src/sugoroku/writing-review/formatCheck';
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

describe('AI 3: Writing self-check, word-diff, AI draft importer, submission & A4 feedback sheet', () => {
  it('detects word range, lowercase starts, lowercase "i", missing periods, fullwidth punctuation, misspellings, summary verbatim copy, and essay signposts', () => {
    const cleanText =
      'I think that students should read more books in school. First, reading helps us learn many useful expressions. Second, it broadens our ideas about society.';
    const okResult = analyzeWritingFormat(cleanText, [20, 35], 'essay');
    expect(okResult.passedAll).toBe(true);
    expect(okResult.inTargetRange).toBe(true);
    expect(okResult.sentenceCount).toBe(3);
    expect(okResult.formatWarnings).toEqual([]);

    const flawedText = 'first, i beleive enviroment is very importent。 Because it helps us';
    const warnResult = analyzeWritingFormat(flawedText, [80, 100], 'email');
    expect(warnResult.passedAll).toBe(false);
    expect(warnResult.inTargetRange).toBe(false);
    const codes = warnResult.issues.map(i => i.code);
    expect(codes).toContain('word_under');
    expect(codes).toContain('fullwidth_punctuation');
    expect(codes).toContain('missing_terminal_punctuation');
    expect(codes).toContain('sentence_start_lowercase');
    expect(codes).toContain('lowercase_pronoun_i');
    expect(codes).toContain('spelling_suspect');
    expect(codes).toContain('email_questions_shortage');

    // 要約問題の「原文8語以上の連続丸写し」検出テスト
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

    // 意見論述で理由の構成語が無い場合のヒント検出（30語以上）
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
Here is the draft evaluation:
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
主張と2つの理由が明確に書けていて素晴らしいです！単数主語（playing sports）に対応する三単現の -s を意識するとさらに得点が安定します。
[/COMMENT]
[STRENGTHS]
First / Second の構成がとても分かりやすい|具体例が説得力を持っている
[/STRENGTHS]
[NEXT_ACTIONS]
動名詞主語の三単現 -s を確認する|修正例を2回書き写して暗唱する
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

  it('builds a zero-API-cost AI grading prompt and an XSS-safe A4 monochrome diff feedback sheet without touching personal local writing format', async () => {
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
    expect(submitted.status).toBe('submitted');

    const prompt = buildWritingAiReviewPrompt(submitted, {
      grade: 'eiken_2',
      taskTitle: '英検2級 意見論述',
      instruction: 'Write 80-100 words.',
      targetWordsLabel: '80〜100語',
      modelAnswer: 'Sample model answer.',
    });
    expect(prompt).toContain('英検2級');
    expect(prompt).toContain('[SCORES]');
    expect(prompt).toContain('[CORRECTED]');
    expect(prompt).toContain('I agree with the idea because sports build teamwork.');

    const reviewed = await saveWritingReview(SUGOROKU_DEMO_CLASS_ID, submitted, {
      reviewerUid: 'teacher_fujisawa',
      reviewerName: '藤沢 講師',
      score: 13,
      maxScore: 16,
      rubricScores: { content: 4, structure: 3, vocabulary: 3, grammar: 3 },
      comment: '理由が明確でとても読みやすい英文です！',
      correctedText: 'I agree with this idea because playing sports builds strong teamwork.',
    });
    expect(reviewed.status).toBe('reviewed');
    expect(reviewed.review?.score).toBe(13);

    const studentHistory = await fetchStudentWritingSubmissions(
      SUGOROKU_DEMO_CLASS_ID,
      'student_01',
      'eiken_2_writing_opinion',
    );
    expect(studentHistory[0].status).toBe('reviewed');
    expect(studentHistory[0].review?.comment).toContain('理由が明確');

    const classAll = await fetchClassWritingSubmissions(SUGOROKU_DEMO_CLASS_ID);
    expect(classAll.some(item => item.id === reviewed.id)).toBe(true);

    const sheetHtml = buildFeedbackSheetHtml(reviewed, {
      taskTitle: '英検2級 意見論述',
      targetWordsLabel: '80〜100語',
    });
    expect(sheetHtml).toContain('@page');
    expect(sheetHtml).toContain('13 / 16');
    expect(sheetHtml).toContain('Before → After');
    expect(sheetHtml).toContain('diff-ins');
    expect(sheetHtml).toContain('diff-del');
    expect(sheetHtml).not.toContain('<script>alert(1)</script>');
    expect(sheetHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');

    expect(store.getItem(writingKey('student_01'))).toBe(personalRecord);
    expect(parseWriting(store.getItem(writingKey('student_01'))).drafts.eiken_2_writing_opinion.text).toBe(
      'My personal draft stays intact.',
    );
  });
});

describe('AI 3: S-CBT Speaking MIME branching, mic error handling, Storage contract & 6 original mock sets (incl. Pre-2 Plus)', () => {
  it('selects WebM/Opus on PC/Android Chrome and MP4/M4A on iPad/iPhone Safari', () => {
    const chromeMime = detectPreferredAudioMimeType(
      mime => mime === 'audio/webm;codecs=opus' || mime === 'audio/webm',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
    );
    expect(chromeMime.mimeType).toBe('audio/webm;codecs=opus');
    expect(chromeMime.extension).toBe('webm');

    const iosSafariMime = detectPreferredAudioMimeType(
      mime => mime === 'audio/mp4;codecs=mp4a.40.2' || mime === 'audio/mp4',
      'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    );
    expect(iosSafariMime.mimeType).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(iosSafariMime.extension).toBe('m4a');

    const iosFallback = detectPreferredAudioMimeType(
      () => false,
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile Safari/604.1',
    );
    expect(iosFallback.extension).toBe('m4a');
  });

  it('classifies microphone permission denied, missing device, and busy device errors into actionable Japanese guidance', () => {
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: async () => ({}) },
    });
    vi.stubGlobal('MediaRecorder', class {});

    const denied = classifyMediaError({ name: 'NotAllowedError', message: 'Permission denied' });
    expect(denied.code).toBe('permission_denied');
    expect(denied.guidance).toContain('許可');

    const notFound = classifyMediaError({ name: 'NotFoundError', message: 'Requested device not found' });
    expect(notFound.code).toBe('device_not_found');
    expect(notFound.guidance).toContain('マイク');

    const busy = classifyMediaError({ name: 'NotReadableError', message: 'Could not start audio source' });
    expect(busy.code).toBe('device_busy');
    expect(busy.guidance).toContain('他のアプリ');
  });

  it('enforces exact Storage path contract and 5MB audio size cap, and safely no-ops beep on SSR', () => {
    expect(() => playScbtBeep('start', false)).not.toThrow();
    expect(() => playScbtBeep('end', true)).not.toThrow();

    const pathWebm = buildSpeakingStoragePath('cls_01', 'uid_abc', 'sub_001', 'reading_aloud', 'webm');
    expect(pathWebm).toBe('sugoroku_speaking/cls_01/uid_abc/sub_001/reading_aloud.webm');

    const pathM4a = buildSpeakingStoragePath('cls_01', 'uid_abc', 'sub_001', 'q2', 'm4a');
    expect(pathM4a).toBe('sugoroku_speaking/cls_01/uid_abc/sub_001/q2.m4a');

    expect(() => buildSpeakingStoragePath('bad/id', 'uid', 'sub', 'q1', 'webm')).toThrow();
    expect(() => validateSpeakingAudioBlob({ size: 0, type: 'audio/webm' })).toThrow();
    expect(() =>
      validateSpeakingAudioBlob({ size: MAX_SPEAKING_AUDIO_BYTES + 1, type: 'audio/mp4' }),
    ).toThrow('5MB');
    expect(() =>
      validateSpeakingAudioBlob({ size: 2048, type: 'video/mp4' }),
    ).toThrow('未対応の音声形式');
    expect(() =>
      validateSpeakingAudioBlob({ size: 120_000, type: 'audio/mp4;codecs=mp4a.40.2' }),
    ).not.toThrow();
  });

  it('ships 6 original sets (Grade 2 x2, Grade Pre-2 Plus x2, Grade Pre-2 x2) with zero 8-gram overlap against legacy fingerprints', () => {
    expect(SCBT_SPEAKING_SETS).toHaveLength(6);
    expect(speakingSetsForGrade('eiken_2')).toHaveLength(2);
    expect(speakingSetsForGrade('eiken_pre2plus')).toHaveLength(2);
    expect(speakingSetsForGrade('eiken_pre2')).toHaveLength(2);

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

  it('submits a full 5-part speaking session, saves instructor review, and generates A4 monochrome speaking shadowing sheet & AI coach prompt', async () => {
    const store = new MemoryStorage();
    vi.stubGlobal('localStorage', store);

    const set = speakingSetsForGrade('eiken_pre2plus')[0];
    const dummyBlob = new Blob([new Uint8Array(512)], { type: 'audio/mp4' });

    const submitted = await submitSpeakingSession({
      classId: SUGOROKU_DEMO_CLASS_ID,
      studentUid: 'student_sp_01',
      studentName: '高橋 陸（高2）',
      grade: 'eiken_pre2plus',
      set,
      clips: {
        reading_aloud: {
          partId: 'reading_aloud',
          blob: dummyBlob,
          mimeType: 'audio/mp4',
          extension: 'm4a',
          durationSec: 32,
        },
        q1: { partId: 'q1', blob: dummyBlob, mimeType: 'audio/mp4', extension: 'm4a', durationSec: 12 },
        q2: { partId: 'q2', blob: dummyBlob, mimeType: 'audio/mp4', extension: 'm4a', durationSec: 38 },
        q3: { partId: 'q3', blob: dummyBlob, mimeType: 'audio/mp4', extension: 'm4a', durationSec: 26 },
        q4: { partId: 'q4', blob: dummyBlob, mimeType: 'audio/mp4', extension: 'm4a', durationSec: 29 },
      },
    });
    expect(submitted.recordings).toHaveLength(5);
    expect(submitted.recordings[0].storagePath).toMatch(
      /^sugoroku_speaking\/sugoroku_demo_class\/student_sp_01\/.+\/reading_aloud\.m4a$/,
    );

    const reviewed = await saveSpeakingReview(SUGOROKU_DEMO_CLASS_ID, submitted, {
      reviewerUid: 'teacher_fujisawa',
      reviewerName: '藤沢 講師',
      rubricScores: { reading_aloud: 5, q1: 5, q2: 8, q3: 4, q4: 4, attitude: 3 },
      comment: '全パート落ち着いて発話できています！',
    });
    expect(reviewed.status).toBe('reviewed');

    const coachPrompt = buildSpeakingAiCoachPrompt(
      reviewed,
      set,
      reviewed.review?.rubricScores,
      '過去形の語尾が明瞭',
    );
    expect(coachPrompt).toContain('準2級プラス');
    expect(coachPrompt).toContain('過去形の語尾が明瞭');

    const speakingSheetHtml = buildSpeakingFeedbackSheetHtml(reviewed, set);
    expect(speakingSheetHtml).toContain('@page');
    expect(speakingSheetHtml).toContain('29 / 33');
    expect(speakingSheetHtml).toContain(set.cardTitle);

    const myRows = await fetchStudentSpeakingSubmissions(
      SUGOROKU_DEMO_CLASS_ID,
      'student_sp_01',
      set.id,
    );
    expect(myRows[0].review?.comment).toContain('全パート落ち着いて');
  });

  it('renders student S-CBT speaking screen and teacher review tabs cleanly via SSR', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    const speakingHtml = renderToStaticMarkup(
      createElement(ScbtSpeakingPractice, {
        uid: 'guest',
        grade: 'eiken_pre2plus',
        onBack: () => {},
      }),
    );
    expect(speakingHtml).toContain('英検 S-CBT スピーキング模擬演習');
    expect(speakingHtml).toContain('英検準2級プラス');
    expect(speakingHtml).toContain('本番ノンストップ進行');

    const teacherWritingHtml = renderToStaticMarkup(
      createElement(TeacherWritingReviewTab, {
        classId: SUGOROKU_DEMO_CLASS_ID,
        demoMode: true,
      }),
    );
    expect(teacherWritingHtml).toContain('data-sugoroku-teacher-writing');

    const teacherSpeakingHtml = renderToStaticMarkup(
      createElement(TeacherSpeakingReviewTab, {
        classId: SUGOROKU_DEMO_CLASS_ID,
        demoMode: true,
      }),
    );
    expect(teacherSpeakingHtml).toContain('data-sugoroku-teacher-speaking');
  });
});
