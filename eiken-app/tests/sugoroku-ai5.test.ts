import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('Sugoroku AI 5: Vocabulary CEFR Audit & 12-Week Curriculum PDFs', () => {
  it('generates valid CEFR audit report, markdown summary, and foundation vocabulary filter', () => {
    const reportPath = 'deliverables/sugoroku/vocab_cefr_audit_report.json';
    const summaryPath = 'deliverables/sugoroku/vocab_cefr_audit_summary.md';
    const filterPath = 'deliverables/sugoroku/sugoroku_foundation_vocab_filter.json';

    expect(existsSync(reportPath)).toBe(true);
    expect(existsSync(summaryPath)).toBe(true);
    expect(existsSync(filterPath)).toBe(true);

    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(report.executiveSummary.wordbookTotalScanned).toBe(6600);
    expect(report.executiveSummary.daimon1TotalQuestionsScanned).toBe(735); // 225 + 255 + 255
    expect(report.readingDaimon1Audit.eiken_2.totalQuestions).toBe(255);
    expect(report.readingDaimon1Audit.eiken_pre2plus.totalQuestions).toBe(255);
    expect(report.readingDaimon1Audit.eiken_pre2.totalQuestions).toBe(225);

    const summaryMd = readFileSync(summaryPath, 'utf8');
    expect(summaryMd).toContain('英検2級・準2級プラス・準2級 語彙CEFR／『パス単』基準 厳密監査レポート');
    expect(summaryMd).toContain('基礎重視モード');

    const filter = JSON.parse(readFileSync(filterPath, 'utf8'));
    expect(filter.excludedGeneralPoolChaptersForGrade2).toContain('lv4');
    expect(filter.grade2WeeklyVocabTests12Weeks).toHaveLength(12);
    const seenWords = new Set<string>();
    for (const wk of filter.grade2WeeklyVocabTests12Weeks) {
      expect(wk.items).toHaveLength(20);
      expect(wk.passingScore).toBe(16);
      for (const item of wk.items) {
        expect(item.word.length).toBeGreaterThan(1);
        expect(item.meaning.length).toBeGreaterThanOrEqual(2);
        expect(item.exampleSentence.length).toBeGreaterThan(10);
        seenWords.add(item.word.toLowerCase());
      }
    }
    expect(seenWords.size).toBe(240);
  });

  it('generates B&W print-ready 12-week curriculum route PDF and weekly vocab test PDF with zero overlaps', () => {
    const routePdfPath = 'deliverables/sugoroku/sugoroku_eiken2_12week_curriculum_route.pdf';
    const testsPdfPath = 'deliverables/sugoroku/sugoroku_eiken2_weekly_vocab_tests_12w.pdf';
    const manifestPath = 'deliverables/sugoroku/curriculum_route_manifest.json';
    const validationPath = 'deliverables/sugoroku/pdf_layout_validation.json';

    expect(existsSync(routePdfPath)).toBe(true);
    expect(existsSync(testsPdfPath)).toBe(true);
    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(validationPath)).toBe(true);

    expect(readFileSync(routePdfPath).subarray(0, 4).toString()).toBe('%PDF');
    expect(readFileSync(testsPdfPath).subarray(0, 4).toString()).toBe('%PDF');

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.totalWeeks).toBe(12);
    expect(manifest.weeks).toHaveLength(12);

    const validation = JSON.parse(readFileSync(validationPath, 'utf8'));
    expect(validation.status).toBe('PASS');
    expect(validation.zeroOverlapVerified).toBe(true);
    expect(validation.grayscalePrintReady).toBe(true);
    expect(validation.documents).toHaveLength(2);
    expect(validation.documents[0].pages).toBe(6);
    expect(validation.documents[1].pages).toBe(26);
  });
});
