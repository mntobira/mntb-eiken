import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  WRITTEN_BLUEPRINTS,
  countEnglishWords,
  validateGradeSeries,
  validateReleasedBooklets,
  validateWrittenExam,
  type WrittenExam,
  type WrittenItem,
} from '../src/eiken/writtenExamCore';
import { GRADE_AUTHORING_SPECS, buildPrimaryBundleRef } from '../src/eiken/writtenAuthoringSpec';
import { WRITTEN_BOOKLETS } from '../src/eiken/materials/written-booklets';
import { bookletWritingTasks } from '../src/eiken/writtenPractice';
import { EIKEN_WRITING_TASKS } from '../src/components/EikenWriting';
import { createHash } from 'node:crypto';
import { partsForGrade } from '../src/eiken/questions';
import { WRITTEN_PRINTS } from '../src/data/writtenPrints.generated';
import { GACHA_PRINTS } from '../src/data/gachaPrints.generated';
import { gachaItems, gachaItemRate } from '../src/battle/core/arenaEconomy';
import type { EikenGrade } from '../src/eiken/config';

/** Synthetic TEST fixtures only; not learning materials. */
function fixture(grade: EikenGrade = 'eiken_3', round = 1): WrittenExam {
  const id = `${grade}_written_${String(round).padStart(2, '0')}`;
  const items = WRITTEN_BLUEPRINTS[grade]!.sections.flatMap((section) =>
    Array.from({ length: section.count }, (_, index): WrittenItem => ({
      id: `${id}_${section.id}_${index}`,
      section: section.id,
      kind: section.kind,
      prompt: `TEST ONLY ${section.id} ${index} round ${round}`,
      passage: { id: `p-${round}`, title: 'TEST ONLY', text: 'Synthetic test passage, not a released learning item.' },
      choices: ['1－3', 'B', 'C', 'D'],
      answer: 0,
      explanation: 'Test explanation',
      distractorReasons: ['correct', 'wrong', 'wrong', 'wrong'],
      model: 'A test answer.',
      rubric: ['Check content'],
      wordRange: [25, 35],
      orderTokens: ['one', 'two', 'three', 'four'],
      orderAnswer: [1, 2, 3, 4],
      orderPrefix: 'Test',
      completedSentence: 'Test one two three four.',
    })),
  );
  return { id, grade, round, revision: 'test-1', origin: 'manatobi-original', review: 'approved', items };
}

describe('written booklets — same original for print, field practice, and writing practice, no exam runner', () => {
  it('defines all seven verified written formats, authoring specs, and Hub Listening room bundle IDs', () => {
    expect(Object.values(WRITTEN_BLUEPRINTS).map((b) => b!.minutes)).toEqual([25, 35, 65, 80, 85, 85, 90]);
    expect(
      Object.values(WRITTEN_BLUEPRINTS).map((b) =>
        b!.sections.filter((s) => s.kind === 'choice').reduce((n, s) => n + s.count, 0),
      ),
    ).toEqual([25, 35, 30, 29, 31, 31, 31]);
    for (const grade of Object.keys(WRITTEN_BLUEPRINTS) as EikenGrade[]) {
      expect(() => validateWrittenExam(fixture(grade))).not.toThrow();
      expect(GRADE_AUTHORING_SPECS[grade]).toBeDefined();
    }
    expect(buildPrimaryBundleRef('eiken_3', 2)).toEqual({
      bundleId: 'eiken_3_primary_r02',
      grade: 'eiken_3',
      round: 2,
      writtenExamId: 'eiken_3_written_02',
      listeningExamId: 'eiken_3_listening_r02',
      writtenPrintBase: '/prints/print_eiken_3_written_02',
      expectedListeningPrintBase: '/prints/print_eiken_3_listening_r02',
    });
    expect(existsSync('docs/WRITTEN_AUTHORING_GUIDE.md')).toBe(true);
  });

  it('rejects incomplete, draft, AI-boilerplate, empty-passaged or unreviewable booklets', () => {
    const exam = fixture();
    expect(() => validateWrittenExam({ ...exam, review: 'draft' })).toThrow('EXAM_NOT_RELEASE_READY');
    expect(() => validateWrittenExam({ ...exam, items: exam.items.slice(1) })).toThrow('EXAM_COUNT');
    const empty = structuredClone(exam);
    empty.items.find((i) => i.section === 'reading')!.passage!.text = '';
    expect(() => validateWrittenExam(empty)).toThrow('PASSAGE_REQUIRED');
    const noAnswer = structuredClone(exam);
    noAnswer.items[0].answer = undefined;
    expect(() => validateWrittenExam(noAnswer)).toThrow('CHOICE_NOT_REVIEWABLE');
    const badRange = structuredClone(exam);
    badRange.items.at(-1)!.wordRange = [25, 35.5];
    expect(() => validateWrittenExam(badRange)).toThrow('WRITING_RUBRIC_REQUIRED');

    // Non-test revisions must reject AI prompt boilerplate and generic distractor filler
    const realBase = structuredClone(WRITTEN_BOOKLETS.find((b) => b.id === 'eiken_3_written_02')!);
    const badPrompt = structuredClone(realBase);
    badPrompt.items[0].prompt = 'Choose the best answer to fill in the blank.\n' + badPrompt.items[0].prompt;
    expect(() => validateWrittenExam(badPrompt)).toThrow('FORBIDDEN_PROMPT_FORMAT');

    const badReason = structuredClone(realBase);
    badReason.items[0].distractorReasons![1] = '文脈に合いません。';
    expect(() => validateWrittenExam(badReason)).toThrow('GENERIC_DISTRACTOR_REASON');
  });

  it('validates all 29 released full written booklets (874 choice + 50 writing = 924 items) with zero cross-round duplication', () => {
    expect(() => validateReleasedBooklets(WRITTEN_BOOKLETS)).not.toThrow();
    expect(WRITTEN_BOOKLETS.map((exam) => [exam.grade, exam.round, exam.items.length])).toEqual([
      ['eiken_5', 1, 25],
      ['eiken_5', 2, 25],
      ['eiken_4', 1, 35],
      ['eiken_4', 2, 35],
      ['eiken_3', 1, 32],
      ['eiken_3', 2, 32],
      ['eiken_3', 3, 32],
      ['eiken_3', 4, 32],
      ['eiken_3', 5, 32],
      ['eiken_3', 6, 32],
      ['eiken_3', 7, 32],
      ['eiken_3', 8, 32],
      ['eiken_3', 9, 32],
      ['eiken_3', 10, 32],
      ['eiken_3', 11, 32],
      ['eiken_3', 12, 32],
      ['eiken_3', 13, 32],
      ['eiken_3', 14, 32],
      ['eiken_3', 15, 32],
      ['eiken_pre2', 1, 31],
      ['eiken_pre2', 2, 31],
      ['eiken_pre2', 3, 31],
      ['eiken_pre2plus', 1, 33],
      ['eiken_pre2plus', 2, 33],
      ['eiken_2', 1, 33],
      ['eiken_2', 2, 33],
      ['eiken_2', 3, 33],
      ['eiken_pre1', 1, 33],
      ['eiken_pre1', 2, 33],
    ]);
    const choiceTotal = WRITTEN_BOOKLETS.reduce((n, exam) => n + exam.items.filter((i) => i.kind === 'choice').length, 0);
    const writingTotal = WRITTEN_BOOKLETS.reduce((n, exam) => n + exam.items.filter((i) => i.kind === 'writing').length, 0);
    expect(choiceTotal).toBe(874);
    expect(writingTotal).toBe(50);
    expect(choiceTotal + writingTotal).toBe(924);

    // Grade 3 now satisfies the complete 15-round full series validation on real authored items!
    expect(() =>
      validateGradeSeries(
        WRITTEN_BOOKLETS.filter((b) => b.grade === 'eiken_3'),
        'eiken_3',
      ),
    ).not.toThrow();

    for (const booklet of WRITTEN_BOOKLETS) {
      validateWrittenExam(booklet);
      expect(booklet.scope).toBeUndefined();
      for (const item of booklet.items.filter((i) => i.section === 'reorder')) {
        expect(item.choices![item.answer!]).toBe(`${item.orderAnswer![0]}－${item.orderAnswer![2]}`);
        expect(item.completedSentence!.replace(/[.?]$/, '')).toBe(
          `${item.orderPrefix} ${item.orderAnswer!.map((n) => item.orderTokens![n - 1]).join(' ')}`,
        );
      }
      for (const w of booklet.items.filter((i) => i.kind === 'writing')) {
        const words = countEnglishWords(w.model!);
        expect(words).toBeGreaterThanOrEqual(w.wordRange![0]);
        expect(words).toBeLessThanOrEqual(w.wordRange![1]);
      }
    }

    const exam = WRITTEN_BOOKLETS[0];
    for (const mutate of [
      (item: WrittenItem) => {
        item.orderAnswer = [1, 1, 3, 4];
      },
      (item: WrittenItem) => {
        item.answer = (item.answer! + 1) % 4;
      },
      (item: WrittenItem) => {
        item.completedSentence = 'Wrong.';
      },
    ]) {
      const bad = structuredClone(exam);
      mutate(bad.items[20]);
      expect(() => validateWrittenExam(bad)).toThrow(/ORDER_/);
    }
    expect(exam.items[4].choices).not.toContain('go');
    expect(JSON.stringify(WRITTEN_BOOKLETS)).not.toContain('\uFFFD');
  });

  it('connects all 50 booklet writing tasks into EikenWriting with cloud-safe storage IDs', () => {
    const tasks = bookletWritingTasks();
    expect(tasks).toHaveLength(50);
    expect(EIKEN_WRITING_TASKS.length).toBe(10 + 50);
    for (const task of tasks) {
      // Must satisfy s_reading cloud sync safeId regex /^[a-z0-9_]{3,80}$/
      expect(task.key).toMatch(/^[a-z0-9_]{3,80}$/);
      expect(task.modelTranslation).toBeTruthy();
      const words = countEnglishWords(task.model);
      const bookItem = WRITTEN_BOOKLETS.find((b) => b.id === task.bookletId)!.items.find(
        (i) => i.kind === 'writing' && task.id.endsWith(i.section),
      )!;
      expect(words).toBeGreaterThanOrEqual(bookItem.wordRange![0]);
      expect(words).toBeLessThanOrEqual(bookItem.wordRange![1]);
      expect(EIKEN_WRITING_TASKS.some((w) => w.key === task.key)).toBe(true);
    }
  });

  it('matches every field-practice answer and generated PDF audit to the same original', () => {
    const manifest = JSON.parse(readFileSync('deliverables/written-booklets.json', 'utf8'));
    expect(manifest.booklets).toEqual(WRITTEN_BOOKLETS);
    expect(manifest.progress).toMatchObject({
      target: 105,
      completed: 29,
      remaining: 76,
      questions: 874,
      writingTasks: 50,
      totalItems: 924,
      writingIncluded: true,
      listeningIncluded: false,
    });
    expect(manifest.primaryBundles).toHaveLength(29);
    expect(manifest.progress.grades).toHaveLength(7);
    const sourceHash = createHash('sha256').update(JSON.stringify(WRITTEN_BOOKLETS)).digest('hex');
    expect(manifest.sourceHash).toBe(sourceHash);

    const reports = JSON.parse(readFileSync('deliverables/written-pdf-validation.json', 'utf8'));
    expect(reports).toHaveLength(WRITTEN_BOOKLETS.length);
    for (const exam of WRITTEN_BOOKLETS) {
      const report = reports.find((r: { id: string }) => r.id === exam.id);
      const print = WRITTEN_PRINTS.find((p) => p.id === `print_${exam.id}`)!;
      const choiceItems = exam.items.filter((i) => i.kind === 'choice');
      const writingItems = exam.items.filter((i) => i.kind === 'writing');

      expect(report.sourceHash).toBe(sourceHash);
      expect(report.answers).toEqual(
        choiceItems.map((item, index) => ({
          id: item.id,
          number: index + 1,
          answer: item.answer! + 1,
          explanation: item.explanation,
        })),
      );
      expect(report.writingCount).toBe(writingItems.length);
      expect(report.checks).toEqual({
        allPromptsChoicesTranslationsAndExplanations: true,
        writingPromptsModelsAndRubrics: true,
        noSplitQuestions: true,
        noAnswerLeak: true,
        safeMargins: true,
        noLineOverlaps: true,
        grayscalePreviews: true,
      });
      expect(report.pdfSha256).toBe(createHash('sha256').update(readFileSync(`public${print.file}`)).digest('hex'));

      if (exam.grade === 'eiken_5') {
        expect(report.questionPages).toEqual([
          ...Array(7).fill(2),
          ...Array(8).fill(3),
          ...Array(5).fill(4),
          ...Array(5).fill(5),
        ]);
        expect(report.layout.choiceColumns).toEqual({ short: 4, conversation: 2, reorder: 4 });
        expect(report.layout.orderingAnswerBoxes).toBe(4);
        expect(report.layout.orderingMarkedPositions).toEqual([1, 3]);
      } else {
        const splits: Record<string, number[]> = {
          eiken_4: [8, 7],
          eiken_3: [7, 8],
          eiken_pre2: [8, 7],
          eiken_pre2plus: [6, 6, 5],
          eiken_2: [6, 6, 5],
          eiken_pre1: [6, 6, 6],
        };
        expect(report.layout.shortQuestionPages).toEqual(splits[exam.grade]);
        expect(report.layout.choiceColumns).toEqual({ short: 4, conversation: 2, cloze: 2, reading: 1 });
      }
      expect(report.questionPages).toHaveLength(choiceItems.length);
      expect(report.layout.officialArtworkCopied).toBe(false);
      expect(print.pages).toBe(report.pages);
      expect(print.variants).toHaveLength(3);
      expect(print.variants![1].pages).toBe(writingItems.length > 0 ? 2 : 1);
      expect(print.variants!.map((p) => p.label)).toEqual(['問題冊子', '解答用紙', '解答・解説']);
      for (const part of print.variants!) {
        expect(readFileSync(`public${part.file}`).subarray(0, 5).toString()).toBe('%PDF-');
      }

      const problems = partsForGrade(exam.grade)
        .flatMap((part) => part.chapters)
        .flatMap((chapter) => chapter.practiceProblems);
      for (const item of choiceItems) {
        const matches = problems.flatMap((problem) =>
          problem.subQuestions.filter((sub) => sub.id === `${item.id}_answer`).map((sub) => ({ problem, sub })),
        );
        expect(matches).toHaveLength(1);
        const { problem, sub } = matches[0];
        expect(sub.optionTexts).toEqual(item.choices);
        expect(sub.correctAnswer).toBe(String(item.answer! + 1));
        expect(sub.explainJa).toBe(item.explanation);
        expect(problem.audioTracks).toBeUndefined();
        if (item.passage) {
          expect(problem.text).toContain(item.passage.text);
          expect(problem.explanation).toContain(item.passage.translation);
          expect(problem.subQuestions).toHaveLength(
            choiceItems.filter((other) => other.passage?.id === item.passage!.id).length,
          );
        }
        for (const token of item.orderTokens || []) expect(problem.text).toContain(token);
      }

      expect(GACHA_PRINTS.some((p) => p.id === print.id)).toBe(true);
      const pool = ['eiken_pre2plus', 'eiken_2', 'eiken_pre1'].includes(exam.grade) ? 'niji' : 'kyotsu';
      const reward = gachaItems(pool).find((i) => i.id === print.id)!;
      expect(reward.rarity).toBe('UR');
      expect(gachaItemRate(reward, 'N', pool)).toBeGreaterThan(0);
      expect(gachaItems(pool === 'kyotsu' ? 'niji' : 'kyotsu').some((i) => i.id === print.id)).toBe(false);
    }
  });

  it('enforces passage translation/format consistency and cloze blank number alignment', () => {
    for (const exam of WRITTEN_BOOKLETS.filter((b) => b.grade !== 'eiken_5')) {
      const missing = structuredClone(exam);
      missing.items.find((item) => item.passage)!.passage!.translation = '';
      expect(() => validateWrittenExam(missing)).toThrow('PASSAGE_TRANSLATION_FORMAT_REQUIRED');

      const collision = structuredClone(exam);
      const shared = collision.items.filter((item) => item.kind === 'choice' && item.passage);
      shared[1].passage!.translation += ' inconsistent';
      expect(() => validateWrittenExam(collision)).toThrow('PASSAGE_ID_COLLISION');

      const cloze = structuredClone(exam);
      const index = cloze.items.findIndex((item) => item.section === 'cloze');
      if (index >= 0) {
        const id = cloze.items[index].passage!.id;
        cloze.items
          .filter((item) => item.passage?.id === id)
          .forEach((item) => {
            item.passage!.text = item.passage!.text.replace(new RegExp(`\\(\\s*${index + 1}\\s*\\)`), '(999)');
          });
        expect(() => validateWrittenExam(cloze)).toThrow('CLOZE_NUMBER_MISMATCH');
      }
    }
  });

  it('keeps timers, submitted attempts and a whole-exam AppState out of the app', () => {
    expect(existsSync('src/components/WrittenExamRunner.tsx')).toBe(false);
    expect(readFileSync('src/eiken/writtenExamCore.ts', 'utf8')).not.toMatch(/WrittenAttempt|startWrittenAttempt|deadlineAt/);
    expect(readFileSync('src/appState.ts', 'utf8')).not.toMatch(/writtenExam|written-exam/);
  });

  it('requires 15 distinct complete rounds rather than relabelled copies', () => {
    const exams = Array.from({ length: 15 }, (_, i) => fixture('eiken_5', i + 1));
    expect(() => validateGradeSeries(exams, 'eiken_5')).not.toThrow();
    expect(() => validateGradeSeries(exams.slice(1), 'eiken_5')).toThrow('FIFTEEN_EXAMS_REQUIRED');
    const repeated = exams.map((exam, index) =>
      index === 1
        ? {
            ...exam,
            items: exam.items.map((item, i) => ({
              ...item,
              prompt: exams[0].items[i].prompt,
              passage: exams[0].items[i].passage,
            })),
          }
        : exam,
    );
    expect(() => validateGradeSeries(repeated, 'eiken_5')).toThrow('DUPLICATE_EXAM_CONTENT');
    expect(() => validateGradeSeries(WRITTEN_BOOKLETS, 'eiken_5')).toThrow('FIFTEEN_EXAMS_REQUIRED');
  });
});
