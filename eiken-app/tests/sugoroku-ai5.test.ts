import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SUGOROKU_CURRICULUM_PDF_SHELF,
  SUGOROKU_ENTRY_DIAGNOSTIC_TEST,
  SUGOROKU_GRADE2_12WEEK_PRESETS,
  SUGOROKU_BRIDGE_8STAGE_PRESETS,
  SUGOROKU_VOCAB_POOL_POLICY,
  SUGOROKU_WEEKLY_QUIZ_BANKS,
  SugorokuWeeklyVocabQuizWidget,
  buildSugorokuWeeklyAssignmentPayload,
  evaluateSugorokuPlacement,
  getSugorokuGrade2WeekPreset,
  getSugorokuBridgeStagePreset,
  lookupB1B2ParaphraseHint,
  isSugorokuFoundationApprovedWordId,
  gradeSugorokuWeeklyQuiz,
} from '../src/sugoroku/curriculum';

describe('Sugoroku AI 5 (v4): 4-Skill CEFR Audit, Entry Diagnostic + Form A/B Quiz Banks (665 Items), 6 B&W PDFs (89 Pages), AI 2 Assignment Builder & React Quiz Widget', () => {
  it('generates v4 CEFR audit & filter JSON with 25-item Entry Placement Diagnostic + 640 weekly quiz items and zero C1/fragment distractor leaks', () => {
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
    expect(report.readingPassageLexicalCoverage.eiken_2.cumulativeCoveragePercent.upToB2).toBeGreaterThanOrEqual(95.0);
    expect(report.listeningScriptLexicalCoverage.eiken_2.cumulativeCoveragePercent.upToB2).toBeGreaterThanOrEqual(98.0);

    const filter = JSON.parse(readFileSync(filterPath, 'utf8'));
    expect(filter.schemaVersion).toBe('4.0.0');
    expect(filter.entryPlacementDiagnosticTest25.items).toHaveLength(25);
    expect(filter.grade2WeeklyVocabTests12Weeks).toHaveLength(12);
    expect(filter.grade2WeeklyVocabRetestsFormB12Weeks).toHaveLength(12);
    expect(filter.pre2PlusBridgeVocabTests4Weeks).toHaveLength(4);
    expect(filter.pre2FoundationVocabTests4Weeks).toHaveLength(4);

    // Verify 3-layer balance in 25-item Entry Placement Diagnostic Test (8 Pre-2 + 8 Pre-2 Plus + 9 Grade 2)
    const diagItems = SUGOROKU_ENTRY_DIAGNOSTIC_TEST.items;
    expect(diagItems).toHaveLength(25);
    expect(diagItems.filter(i => i.tierLabel.startsWith('準2級基礎'))).toHaveLength(8);
    expect(diagItems.filter(i => i.tierLabel.startsWith('準2プラス'))).toHaveLength(8);
    expect(diagItems.filter(i => i.tierLabel.startsWith('2級コア'))).toHaveLength(9);

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

  it('generates all 6 B&W print-ready PDFs (89 pages total) and mirrors them to public/sugoroku/ with zero overlaps and pure grayscale', () => {
    const pdfSpecs = [
      { file: 'sugoroku_eiken2_placement_diagnostic_test.pdf', pages: 6 },
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
    expect(manifest.schemaVersion).toBe('4.0.0');
    expect(manifest.placementDiagnosticPdf).toContain('placement_diagnostic_test.pdf');
    expect(manifest.weeklyVocabRetestsFormBPdf).toContain('formB');
    expect(manifest.scbtWritingSpeakingHandbookPdf).toContain('handbook');

    const validation = JSON.parse(readFileSync('deliverables/sugoroku/pdf_layout_validation.json', 'utf8'));
    expect(validation.status).toBe('PASS');
    expect(validation.totalDocuments).toBe(6);
    expect(validation.totalPagesVerified).toBe(89);
    expect(validation.zeroOverlapVerified).toBe(true);
    expect(validation.zeroOutOfBoundsVerified).toBe(true);
    expect(validation.grayscalePrintReady).toBe(true);
    expect(validation.documents.map((d: { pages: number }) => d.pages)).toEqual([6, 6, 26, 25, 18, 8]);
  });

  it('grades 25-item Entry Placement Diagnostic into A/B/C bands and builds AI 2 compatible SugorokuAssignmentDoc payloads', () => {
    expect(SUGOROKU_CURRICULUM_PDF_SHELF).toHaveLength(6);
    expect(SUGOROKU_GRADE2_12WEEK_PRESETS).toHaveLength(12);
    expect(SUGOROKU_BRIDGE_8STAGE_PRESETS).toHaveLength(8);
    expect(SUGOROKU_VOCAB_POOL_POLICY.excludedChaptersForGrade2ShortRoute).toEqual(['lv4', 'ilv3']);
    expect(isSugorokuFoundationApprovedWordId('eiken_2', 'eiken-word-2-a-sustainable')).toBe(true);

    // 1) Entry Placement Diagnostic grading: 25/25 -> Band A (100%), 11/25 -> Band B (44%), 6/25 -> Band C (24%)
    const diagPerfect = SUGOROKU_ENTRY_DIAGNOSTIC_TEST.items.map(it =>
      it.no <= 12 ? it.answerIndexJa : it.answerIndexEn,
    );
    const diagResA = gradeSugorokuWeeklyQuiz('placementDiagnostic25', 0, diagPerfect);
    expect(diagResA.score).toBe(25);
    expect(diagResA.nextAction).toBe('PLACEMENT_DECIDED');
    expect(diagResA.diagnosticBreakdown?.placement.band).toBe('A_STANDARD_GRADE2');
    expect(diagResA.diagnosticBreakdown?.pre2FoundationCorrect).toBe(8);
    expect(diagResA.diagnosticBreakdown?.pre2PlusBridgeCorrect).toBe(8);
    expect(diagResA.diagnosticBreakdown?.grade2CoreCorrect).toBe(9);

    const diagAnswersB = diagPerfect.map((ans, idx) => (idx < 11 ? ans : (ans + 1) % 4));
    const diagResB = gradeSugorokuWeeklyQuiz('placementDiagnostic25', 0, diagAnswersB);
    expect(diagResB.score).toBe(11);
    expect(diagResB.diagnosticBreakdown?.placement.band).toBe('B_BRIDGE_PRE2PLUS_4W');

    const diagAnswersC = diagPerfect.map((ans, idx) => (idx < 6 ? ans : (ans + 1) % 4));
    const diagResC = gradeSugorokuWeeklyQuiz('placementDiagnostic25', 0, diagAnswersC);
    expect(diagResC.score).toBe(6);
    expect(diagResC.diagnosticBreakdown?.placement.band).toBe('C_FOUNDATION_PRE2_8W');

    // 2) Weekly Form A fail -> Form B retest routing
    const week1FormA = SUGOROKU_WEEKLY_QUIZ_BANKS.grade2FormA[0];
    const w1Perfect = week1FormA.items.map(it => (it.no <= 12 ? it.answerIndexJa : it.answerIndexEn));
    const failResult = gradeSugorokuWeeklyQuiz(
      'grade2FormA',
      1,
      w1Perfect.map((ans, idx) => (idx < 6 ? (ans + 1) % 4 : ans)),
    );
    expect(failResult.score).toBe(14);
    expect(failResult.nextAction).toBe('RETEST_FORM_B_REQUIRED');

    // 3) AI 2 compatible SugorokuAssignmentDoc pacemaker payload builder (4-day advance + 2-day buffer)
    const g2Week1Plan = buildSugorokuWeeklyAssignmentPayload({
      classId: 'sugoroku_class_1',
      teacherUid: 'coach_nishi',
      mode: 'grade2_12w',
      stepNumber: 1,
      startAtMs: 1_700_000_000_000,
    });
    expect(g2Week1Plan.presetId).toBe('eiken2-12w');
    expect(g2Week1Plan.presetWeek).toBe(1);
    expect(g2Week1Plan.chapterIds).toEqual([
      'eiken_2_written_01_short',
      'eiken_2_written_01_cloze',
      'eiken_2_listening_r01_part1',
    ]);
    expect(g2Week1Plan.skillBreakdown).toEqual({
      reading: 23,
      listening: 15,
      vocab: 20,
      writing: 1,
      speaking: 0,
    });
    expect(g2Week1Plan.dailyQuotaProblems).toBe(10); // ceil((23 + 15) / 4 advance days) = 10

    const bridgeStage5Plan = buildSugorokuWeeklyAssignmentPayload({
      classId: 'sugoroku_class_1',
      teacherUid: 'coach_nishi',
      mode: 'bridge_8stage',
      stepNumber: 5,
      startAtMs: 1_700_000_000_000,
      targetStudentUids: ['student_01'],
    });
    expect(bridgeStage5Plan.presetId).toBe('eikenpre2plus-bridge');
    expect(bridgeStage5Plan.targetStudentUids).toEqual(['student_01']);
    expect(bridgeStage5Plan.dailyQuotaProblems).toBe(10);

    // 4) SSR / React render smoke check for SugorokuWeeklyVocabQuizWidget
    const html = renderToStaticMarkup(
      React.createElement(SugorokuWeeklyVocabQuizWidget, {
        initialTrack: 'placementDiagnostic25',
        studentName: 'テスト生徒',
      }),
    );
    expect(html).toContain('テスト生徒');
    expect(html).toContain('スタートライン診断');
    expect(html).toContain('Q25.');

    expect(evaluateSugorokuPlacement(60).band).toBe('A_STANDARD_GRADE2');
    expect(getSugorokuGrade2WeekPreset(1)?.weeklyQuizPage).toBe(2);
    expect(getSugorokuBridgeStagePreset(8)?.gradeId).toBe('eiken_pre2plus');
    expect(lookupB1B2ParaphraseHint('mitigate')).toContain('reduce');
  });
});
