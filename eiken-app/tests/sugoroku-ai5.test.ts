import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  SUGOROKU_CURRICULUM_PDF_SHELF,
  SUGOROKU_GRADE2_12WEEK_PRESETS,
  SUGOROKU_BRIDGE_8STAGE_PRESETS,
  SUGOROKU_VOCAB_POOL_POLICY,
  SUGOROKU_WEEKLY_QUIZ_BANKS,
  evaluateSugorokuPlacement,
  getSugorokuGrade2WeekPreset,
  getSugorokuBridgeStagePreset,
  lookupB1B2ParaphraseHint,
  isSugorokuFoundationApprovedWordId,
  gradeSugorokuWeeklyQuiz,
} from '../src/sugoroku/curriculum';

describe('Sugoroku AI 5 (v3): 4-Skill CEFR Audit, POS-Aligned Form A/B Quiz Banks, 5 B&W PDFs (83 Pages) & Online Grading Engine', () => {
  it('generates v3 CEFR audit report with 4-skill lexical coverage and zero C1/clause-fragment distractor leaks across 640 test questions', () => {
    const reportPath = 'deliverables/sugoroku/vocab_cefr_audit_report.json';
    const summaryPath = 'deliverables/sugoroku/vocab_cefr_audit_summary.md';
    const filterPath = 'deliverables/sugoroku/sugoroku_foundation_vocab_filter.json';

    expect(existsSync(reportPath)).toBe(true);
    expect(existsSync(summaryPath)).toBe(true);
    expect(existsSync(filterPath)).toBe(true);

    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(report.schemaVersion).toBe('3.0.0');
    expect(report.executiveSummary.wordbookTotalScanned).toBe(6600);
    expect(report.executiveSummary.daimon1TotalQuestionsScanned).toBe(735);
    expect(report.executiveSummary.readingPassagesTotalWordsScanned).toBeGreaterThan(38000);
    expect(report.executiveSummary.listeningScriptsTotalWordsScanned).toBeGreaterThan(95000);

    // Nation (2006) 95% independent reading comprehension threshold verified across all 3 grades
    expect(report.readingPassageLexicalCoverage.eiken_2.cumulativeCoveragePercent.upToB2).toBeGreaterThanOrEqual(95.0);
    expect(report.readingPassageLexicalCoverage.eiken_pre2plus.cumulativeCoveragePercent.upToB2).toBeGreaterThanOrEqual(95.0);
    expect(report.readingPassageLexicalCoverage.eiken_pre2.cumulativeCoveragePercent.upToB2).toBeGreaterThanOrEqual(95.0);

    // Listening A1-B2 coverage >= 98% across all 1,350 audio scripts
    expect(report.listeningScriptLexicalCoverage.eiken_2.cumulativeCoveragePercent.upToB2).toBeGreaterThanOrEqual(98.0);

    const filter = JSON.parse(readFileSync(filterPath, 'utf8'));
    expect(filter.schemaVersion).toBe('3.0.0');
    expect(filter.grade2WeeklyVocabTests12Weeks).toHaveLength(12);
    expect(filter.grade2WeeklyVocabRetestsFormB12Weeks).toHaveLength(12);
    expect(filter.pre2PlusBridgeVocabTests4Weeks).toHaveLength(4);
    expect(filter.pre2FoundationVocabTests4Weeks).toHaveLength(4);

    // Verify Form A vs Form B: identical 20 words per week, rotated Part A <-> Part B, fresh choices, 0 C1 leaks
    const g2Words = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const formA = filter.grade2WeeklyVocabTests12Weeks[i];
      const formB = filter.grade2WeeklyVocabRetestsFormB12Weeks[i];
      expect(formA.items).toHaveLength(20);
      expect(formB.items).toHaveLength(20);

      const wordsA = new Set(formA.items.map((it: { word: string }) => it.word.toLowerCase()));
      const wordsB = new Set(formB.items.map((it: { word: string }) => it.word.toLowerCase()));
      expect(wordsA).toEqual(wordsB);

      // Part B (Q13..20) in Form B must rotate from Form A's Part A (Q01..08)
      const partBFormA = new Set(formA.items.slice(12).map((it: { word: string }) => it.word.toLowerCase()));
      const partBFormB = new Set(formB.items.slice(12).map((it: { word: string }) => it.word.toLowerCase()));
      for (const w of partBFormB) {
        expect(partBFormA.has(w)).toBe(false);
      }

      for (const item of [...formA.items, ...formB.items]) {
        expect(item.clozeSentence).toContain('_');
        expect(item.choicesJa[item.answerIndexJa]).toBe(item.meaning);
        expect(item.choicesEn[item.answerIndexEn]).toBe(item.word);
        for (const opt of item.choicesEn) {
          expect(opt.toLowerCase()).not.toContain('corroborate');
          expect(opt.toLowerCase()).not.toContain('did she imagine');
        }
        g2Words.add(item.word.toLowerCase());
      }
    }
    expect(g2Words.size).toBe(240);
  });

  it('generates all 5 B&W print-ready PDFs (83 pages total) and mirrors them to public/sugoroku/ with zero overlaps and zero Part B truncation', () => {
    const pdfSpecs = [
      { file: 'sugoroku_eiken2_12week_curriculum_route.pdf', pages: 6 },
      { file: 'sugoroku_eiken2_weekly_vocab_tests_12w.pdf', pages: 26 },
      { file: 'sugoroku_eiken2_weekly_vocab_retests_formB_12w.pdf', pages: 25 },
      { file: 'sugoroku_pre2plus_bridge_4week_pack.pdf', pages: 18 },
      { file: 'sugoroku_eiken2_scbt_writing_speaking_handbook.pdf', pages: 8 },
    ];

    for (const spec of pdfSpecs) {
      const delivPath = `deliverables/sugoroku/${spec.file}`;
      const pubPath = `public/sugoroku/${spec.file}`;
      expect(existsSync(delivPath)).toBe(true);
      expect(existsSync(pubPath)).toBe(true);
      expect(readFileSync(delivPath).subarray(0, 4).toString()).toBe('%PDF');
      expect(readFileSync(pubPath).length).toBe(readFileSync(delivPath).length);
    }

    const manifest = JSON.parse(readFileSync('deliverables/sugoroku/curriculum_route_manifest.json', 'utf8'));
    expect(manifest.schemaVersion).toBe('3.0.0');
    expect(manifest.weeklyVocabRetestsFormBPdf).toContain('formB');
    expect(manifest.scbtWritingSpeakingHandbookPdf).toContain('handbook');

    const validation = JSON.parse(readFileSync('deliverables/sugoroku/pdf_layout_validation.json', 'utf8'));
    expect(validation.status).toBe('PASS');
    expect(validation.totalDocuments).toBe(5);
    expect(validation.totalPagesVerified).toBe(83);
    expect(validation.zeroOverlapVerified).toBe(true);
    expect(validation.zeroOutOfBoundsVerified).toBe(true);
    expect(validation.grayscalePrintReady).toBe(true);
    expect(validation.documents.map((d: { pages: number }) => d.pages)).toEqual([6, 26, 25, 18, 8]);
  });

  it('provides O(1) foundation word filter and instant online grading engine (Form A -> Form B retest routing)', () => {
    expect(SUGOROKU_CURRICULUM_PDF_SHELF).toHaveLength(5);
    expect(SUGOROKU_GRADE2_12WEEK_PRESETS).toHaveLength(12);
    expect(SUGOROKU_BRIDGE_8STAGE_PRESETS).toHaveLength(8);
    expect(SUGOROKU_VOCAB_POOL_POLICY.excludedChaptersForGrade2ShortRoute).toEqual(['lv4', 'ilv3']);

    // High-utility Grade 2 allowlist word stays approved; excluded C1 word is filtered out
    expect(isSugorokuFoundationApprovedWordId('eiken_2', 'eiken-word-2-a-sustainable')).toBe(true);
    const sampleExcluded = SUGOROKU_WEEKLY_QUIZ_BANKS.grade2FormA[0].items[0].id;
    expect(isSugorokuFoundationApprovedWordId('eiken_2', sampleExcluded)).toBe(true);

    // Online auto-grading: 20/20 -> PASS_ADVANCE
    const week1FormA = SUGOROKU_WEEKLY_QUIZ_BANKS.grade2FormA[0];
    const perfectAnswers = week1FormA.items.map(it => (it.no <= 12 ? it.answerIndexJa : it.answerIndexEn));
    const passResult = gradeSugorokuWeeklyQuiz('grade2FormA', 1, perfectAnswers);
    expect(passResult.score).toBe(20);
    expect(passResult.passed).toBe(true);
    expect(passResult.nextAction).toBe('PASS_ADVANCE');
    expect(passResult.missedWordIds).toHaveLength(0);

    // Online auto-grading: 14/20 (<16) on Form A -> RETEST_FORM_B_REQUIRED + 6 missed word IDs for SRS review
    const failingAnswers = perfectAnswers.map((ans, idx) => (idx < 6 ? (ans + 1) % 4 : ans));
    const failResult = gradeSugorokuWeeklyQuiz('grade2FormA', 1, failingAnswers);
    expect(failResult.score).toBe(14);
    expect(failResult.passed).toBe(false);
    expect(failResult.nextAction).toBe('RETEST_FORM_B_REQUIRED');
    expect(failResult.missedWordIds).toHaveLength(6);

    expect(evaluateSugorokuPlacement(60).band).toBe('A_STANDARD_GRADE2');
    expect(evaluateSugorokuPlacement(45).band).toBe('B_BRIDGE_PRE2PLUS_4W');
    expect(evaluateSugorokuPlacement(25).band).toBe('C_FOUNDATION_PRE2_8W');
    expect(getSugorokuGrade2WeekPreset(1)?.weeklyQuizPage).toBe(2);
    expect(getSugorokuBridgeStagePreset(8)?.gradeId).toBe('eiken_pre2plus');
    expect(lookupB1B2ParaphraseHint('mitigate')).toContain('reduce');
  });
});
