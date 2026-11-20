import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  SUGOROKU_CURRICULUM_PDF_SHELF,
  SUGOROKU_GRADE2_12WEEK_PRESETS,
  SUGOROKU_BRIDGE_8STAGE_PRESETS,
  SUGOROKU_VOCAB_POOL_POLICY,
  evaluateSugorokuPlacement,
  getSugorokuGrade2WeekPreset,
  getSugorokuBridgeStagePreset,
  lookupB1B2ParaphraseHint,
} from '../src/sugoroku/curriculum';

describe('Sugoroku AI 5 (v2): Full 4-Skill CEFR Audit, 400-Word Test Bank & 50-Page B&W PDFs', () => {
  it('generates v2 CEFR audit report with 4-skill lexical coverage (Reading >=95%, Listening >=98%) and 400 curated items', () => {
    const reportPath = 'deliverables/sugoroku/vocab_cefr_audit_report.json';
    const summaryPath = 'deliverables/sugoroku/vocab_cefr_audit_summary.md';
    const filterPath = 'deliverables/sugoroku/sugoroku_foundation_vocab_filter.json';

    expect(existsSync(reportPath)).toBe(true);
    expect(existsSync(summaryPath)).toBe(true);
    expect(existsSync(filterPath)).toBe(true);

    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(report.schemaVersion).toBe('2.0.0');
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
    expect(report.listeningScriptLexicalCoverage.eiken_pre2plus.cumulativeCoveragePercent.upToB2).toBeGreaterThanOrEqual(98.0);
    expect(report.listeningScriptLexicalCoverage.eiken_pre2.cumulativeCoveragePercent.upToB2).toBeGreaterThanOrEqual(98.0);

    const summaryMd = readFileSync(summaryPath, 'utf8');
    expect(summaryMd).toContain('全技能横断監査レポート（v2）');
    expect(summaryMd).toContain('実戦語彙カバー率');

    const filter = JSON.parse(readFileSync(filterPath, 'utf8'));
    expect(filter.schemaVersion).toBe('2.0.0');
    expect(filter.excludedGeneralPoolChaptersForGrade2).toContain('lv4');
    expect(filter.grade2WeeklyVocabTests12Weeks).toHaveLength(12);
    expect(filter.pre2PlusBridgeVocabTests4Weeks).toHaveLength(4);
    expect(filter.pre2FoundationVocabTests4Weeks).toHaveLength(4);

    // Verify Grade 2 240 unique words + 4-choice cloze integrity
    const g2Words = new Set<string>();
    for (const wk of filter.grade2WeeklyVocabTests12Weeks) {
      expect(wk.items).toHaveLength(20);
      expect(wk.passingScore).toBe(16);
      for (const item of wk.items) {
        expect(item.clozeSentence).toContain('_');
        expect(item.choicesJa).toHaveLength(4);
        expect(item.choicesEn).toHaveLength(4);
        expect(item.choicesJa[item.answerIndexJa]).toBe(item.meaning);
        expect(item.choicesEn[item.answerIndexEn]).toBe(item.word);
        g2Words.add(item.word.toLowerCase());
      }
    }
    expect(g2Words.size).toBe(240);

    // Verify Pre-2 Plus (80 unique) & Pre-2 Foundation (80 unique) = 160 bridge items
    const p2pWords = new Set<string>();
    for (const wk of filter.pre2PlusBridgeVocabTests4Weeks) {
      expect(wk.items).toHaveLength(20);
      for (const item of wk.items) {
        expect(item.clozeSentence).toContain('_');
        expect(item.choicesEn[item.answerIndexEn]).toBe(item.word);
        p2pWords.add(item.word.toLowerCase());
      }
    }
    expect(p2pWords.size).toBe(80);

    const p2Words = new Set<string>();
    for (const wk of filter.pre2FoundationVocabTests4Weeks) {
      expect(wk.items).toHaveLength(20);
      for (const item of wk.items) {
        expect(item.clozeSentence).toContain('_');
        expect(item.choicesEn[item.answerIndexEn]).toBe(item.word);
        p2Words.add(item.word.toLowerCase());
      }
    }
    expect(p2Words.size).toBe(80);
  });

  it('generates all 3 B&W print-ready PDFs (50 pages total) and mirrors them to public/sugoroku/ with zero overlaps', () => {
    const pdfSpecs = [
      { file: 'sugoroku_eiken2_12week_curriculum_route.pdf', pages: 6 },
      { file: 'sugoroku_eiken2_weekly_vocab_tests_12w.pdf', pages: 26 },
      { file: 'sugoroku_pre2plus_bridge_4week_pack.pdf', pages: 18 },
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
    expect(manifest.schemaVersion).toBe('2.0.0');
    expect(manifest.totalWeeks).toBe(12);
    expect(manifest.bridgeTotalStages).toBe(8);
    expect(manifest.weeks).toHaveLength(12);
    expect(manifest.bridgeStages).toHaveLength(8);

    const validation = JSON.parse(readFileSync('deliverables/sugoroku/pdf_layout_validation.json', 'utf8'));
    expect(validation.status).toBe('PASS');
    expect(validation.totalDocuments).toBe(3);
    expect(validation.totalPagesVerified).toBe(50);
    expect(validation.zeroOverlapVerified).toBe(true);
    expect(validation.zeroOutOfBoundsVerified).toBe(true);
    expect(validation.grayscalePrintReady).toBe(true);
    expect(validation.documents.map((d: { pages: number }) => d.pages)).toEqual([6, 26, 18]);
  });

  it('exposes conflict-free TypeScript curriculum & placement helpers for AI 1 and AI 2', () => {
    expect(SUGOROKU_CURRICULUM_PDF_SHELF).toHaveLength(3);
    expect(SUGOROKU_GRADE2_12WEEK_PRESETS).toHaveLength(12);
    expect(SUGOROKU_BRIDGE_8STAGE_PRESETS).toHaveLength(8);
    expect(SUGOROKU_VOCAB_POOL_POLICY.excludedChaptersForGrade2ShortRoute).toEqual(['lv4', 'ilv3']);

    expect(evaluateSugorokuPlacement(62).band).toBe('A_STANDARD_GRADE2');
    expect(evaluateSugorokuPlacement(48).band).toBe('B_BRIDGE_PRE2PLUS_4W');
    expect(evaluateSugorokuPlacement(48).mergeIntoGrade2Week).toBe(3);
    expect(evaluateSugorokuPlacement(31).band).toBe('C_FOUNDATION_PRE2_8W');

    expect(getSugorokuGrade2WeekPreset(12)?.chapterIds).toContain('eiken_2_written_15_reading');
    expect(getSugorokuBridgeStagePreset(5)?.gradeId).toBe('eiken_pre2plus');
    expect(lookupB1B2ParaphraseHint('Stringent')).toContain('strict');
  });
});
