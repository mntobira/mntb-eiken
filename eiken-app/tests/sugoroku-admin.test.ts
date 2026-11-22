import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildStudentOverview,
  buildSugorokuStudentDetailCsv,
  buildSugorokuSummaryCsv,
  detectSugorokuPortalMode,
  formatDateKey,
  formatDurationJa,
  parseGradeSkillKey,
  sortStudentsByAlertPriority,
} from '../src/sugoroku/admin/adminAnalytics';
import { createSugorokuDemoBundle } from '../src/sugoroku/admin/demoData';
import { SugorokuAdminApp } from '../src/sugoroku/admin/SugorokuAdminApp';
import {
  SUGOROKU_DEDICATED_PDFS,
  classifyEikenMaterial,
} from '../src/sugoroku/admin/SugorokuPdfShelfTab';
import {
  buildLineEncourageMessage,
  SugorokuStudentDetailView,
} from '../src/sugoroku/admin/SugorokuStudentDetailView';
import {
  PortalSkeletonScreen,
  SugorokuBottomSheet,
  SugorokuToast,
} from '../src/sugoroku/admin/SugorokuInteractiveUi';
import { SugorokuStaffSheet } from '../src/sugoroku/admin/SugorokuStaffSheet';
import {
  buildStaffInviteId,
  getConfiguredAdminEmails,
  isEmailPreAuthorizedAdmin,
  isValidStaffEmail,
  normalizeStaffEmail,
} from '../src/sugoroku/admin/firestoreAdminService';
import {
  SUGOROKU_COLLECTIONS,
  SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS,
  SUGOROKU_SPEAKING_MAX_BYTES,
  buildSpeakingStoragePath,
} from '../src/sugoroku/shared/types';
import { GACHA_PRINTS } from '../src/data/gachaPrints.generated';

describe('AI 1: すごろく塾管理者ポータル（SugorokuAdminApp）', () => {
  it('URLクエリ ?portal=admin および VITE_SUGOROKU_PORTAL=admin を正しく判定する', () => {
    expect(detectSugorokuPortalMode('?portal=admin', undefined)).toBe(true);
    expect(detectSugorokuPortalMode('?foo=1&portal=ADMIN', undefined)).toBe(true);
    expect(detectSugorokuPortalMode('', 'admin')).toBe(true);
    expect(detectSugorokuPortalMode('?portal=student', '')).toBe(false);
    expect(detectSugorokuPortalMode('', undefined)).toBe(false);
  });

  it('級×技能キーのラベル整形・秒数の日本語時間フォーマットが正確である', () => {
    expect(parseGradeSkillKey('eiken_2:listening').label).toBe('英検2級 リスニング');
    expect(parseGradeSkillKey('eiken_pre2plus:vocab').label).toBe('英検準2級プラス 単語・語彙');
    expect(formatDurationJa(0)).toBe('0分');
    expect(formatDurationJa(45)).toBe('1分未満');
    expect(formatDurationJa(2700)).toBe('45分');
    expect(formatDurationJa(5100)).toBe('1時間25分');
  });

  it('デモデータ6名の集計で「未学習・宿題期限超過」の生徒が最上部にアラート優先ソートされる', () => {
    const fixedNow = new Date(2026, 10, 20, 21, 0, 0).getTime();
    const demo = createSugorokuDemoBundle(fixedNow);
    const overviews = sortStudentsByAlertPriority(
      demo.members.map((m) =>
        buildStudentOverview({
          member: m,
          logs: demo.logsByUid[m.uid] ?? [],
          assignments: demo.assignments,
          solvedByChapter: demo.solvedByUid[m.uid] ?? {},
          writingSubmissions: demo.writingSubmissions,
          speakingSubmissions: demo.speakingSubmissions,
          nowMs: fixedNow,
        }),
      ),
    );

    expect(overviews).toHaveLength(6);
    // 最上位2名は critical アラートを持つ 伊藤葵（初回未学習）と 山本陸（4日間未学習＋宿題期限超過）
    expect(overviews[0].uid).toBe('stu_ito_aoi');
    expect(overviews[0].alerts.some((a) => a.reason === 'never_studied')).toBe(true);

    expect(overviews[1].uid).toBe('stu_yamamoto_riku');
    expect(overviews[1].alerts.some((a) => a.reason === 'inactive_3days')).toBe(true);
    expect(overviews[1].alerts.some((a) => a.reason === 'homework_overdue')).toBe(true);

    // 3番目は明日締切で消化率50%未満の 小林颯太（warning: homework_behind_pace）
    expect(overviews[2].uid).toBe('stu_kobayashi_sota');
    expect(overviews[2].alerts.some((a) => a.reason === 'homework_behind_pace')).toBe(true);

    // 順調な佐藤美桜・高橋陽斗は級×技能別の有効学習時間と正答率が算出されている
    const mio = overviews.find((s) => s.uid === 'stu_sato_mio')!;
    expect(mio.alerts).toHaveLength(0);
    expect(mio.weeklyActiveSeconds).toBeGreaterThan(0);
    expect(mio.todayActiveSeconds).toBe(2340);
    const mioListening = mio.gradeSkillBreakdown.find((g) => g.key === 'eiken_2:listening')!;
    expect(mioListening.weeklySeconds).toBe(1500 + 1320 + 1440);
    expect(mioListening.accuracyPct).toBeGreaterThan(80);
  });

  it('面談・保護者共有用CSVがBOM付きCRLFで出力され、CSVインジェクションも無害化される', () => {
    const fixedNow = new Date(2026, 10, 20, 21, 0, 0).getTime();
    const overview = buildStudentOverview({
      member: {
        uid: 'stu_csv_test',
        role: 'student',
        rosterName: '=CMD|calc',
        targetGrade: 'eiken_2',
        active: true,
        adFree: true,
      },
      logs: [
        {
          dateKey: formatDateKey(fixedNow),
          totalActiveSeconds: 1800,
          byGradeSkill: { 'eiken_2:listening': 1800 },
          accuracyByGradeSkill: { 'eiken_2:listening': { correct: 12, total: 15 } },
          solvedCount: 15,
          updatedAt: fixedNow,
        },
      ],
      assignments: [],
      nowMs: fixedNow,
    });

    const summaryCsv = buildSugorokuSummaryCsv([overview], true);
    expect(summaryCsv.startsWith('\uFEFF')).toBe(true);
    expect(summaryCsv).toContain('\r\n');
    expect(summaryCsv).toContain("'=CMD|calc");
    expect(summaryCsv).toContain('英検2級 リスニング:30分');

    const detailCsv = buildSugorokuStudentDetailCsv(overview, true);
    expect(detailCsv.startsWith('\uFEFF')).toBe(true);
    expect(detailCsv).toContain('80%');
  });

  it('講師用PDF教材ダイレクト棚が全英検プリントを漏れなく分類できる', () => {
    const eikenPrints = GACHA_PRINTS.filter((p) => p.subject.startsWith('eiken_'));
    expect(eikenPrints.length).toBeGreaterThanOrEqual(138);
    for (const p of eikenPrints) {
      expect(classifyEikenMaterial(p)).not.toBeNull();
    }
  });

  it('SugorokuAdminApp がデモモードおよびAI 3拡張スロット付きでSSR描画できる', () => {
    const html = renderToStaticMarkup(
      createElement(SugorokuAdminApp, {
        initialDataMode: 'demo',
        extensionSlots: {
          renderWritingReviewTab: () => createElement('div', null, 'AI3_WRITING_CUSTOM'),
          renderSpeakingReviewTab: () => createElement('div', null, 'AI3_SPEAKING_CUSTOM'),
        },
      }),
    );
    expect(html).toContain('すごろく塾 管理');
    expect(html).toContain('全員（全級一括）');
    expect(html).toContain('宿題配信');
    expect(html).toContain('高橋 陽斗（高2・サッカー部）');
    expect(html).toContain('山本 陸（高2・野球部）');
    expect(html).toContain('教材PDF');
    // エッセンシャルUI・8大UX要素のマークアップ検証
    expect(html).toContain('class="kt');               // Kinetic Typography (KineticText)
    expect(html).toContain('class="mo-ring"');         // Infographic ScoreRing
    expect(html).toContain('class="mt-countup"');      // Infographic CountUp
    expect(html).toContain('study-doors');             // Infographic 7日間の学びの扉
    expect(html).toContain('data-ptr-host');           // Pull to Refresh ホスト
    expect(html).toContain('data-swipe-row');          // Swipe Action 行
  });

  it('Skeleton Screen・Toast・Bottom Sheet・個人詳細インフォグラフィック・LINE声掛け文生成が正しく動作する', () => {
    const fixedNow = new Date(2026, 10, 20, 21, 0, 0).getTime();
    const demo = createSugorokuDemoBundle(fixedNow);
    const riku = buildStudentOverview({
      member: demo.members.find((m) => m.uid === 'stu_yamamoto_riku')!,
      logs: demo.logsByUid.stu_yamamoto_riku ?? [],
      assignments: demo.assignments,
      solvedByChapter: demo.solvedByUid.stu_yamamoto_riku ?? {},
      nowMs: fixedNow,
    });
    const mio = buildStudentOverview({
      member: demo.members.find((m) => m.uid === 'stu_sato_mio')!,
      logs: demo.logsByUid.stu_sato_mio ?? [],
      assignments: demo.assignments,
      solvedByChapter: demo.solvedByUid.stu_sato_mio ?? {},
      nowMs: fixedNow,
    });

    // 停滞生徒向け／順調生徒向けの声掛けメッセージ出し分け
    expect(buildLineEncourageMessage(riku)).toContain('まずはリスニング第1部か単語10問');
    expect(buildLineEncourageMessage(mio)).toContain('素晴らしいペースです');

    // Skeleton Screen
    const skelHtml = renderToStaticMarkup(createElement(PortalSkeletonScreen, { rows: 3 }));
    expect(skelHtml).toContain('data-sugoroku-skeleton');
    expect(skelHtml).toContain('sg-skel-card');

    // Toast
    const toastHtml = renderToStaticMarkup(
      createElement(SugorokuToast, {
        toast: { id: 1, message: '最新データを同期しました', tone: 'done' },
        onDismiss: () => {},
      }),
    );
    expect(toastHtml).toContain('mt-toast');
    expect(toastHtml).toContain('最新データを同期しました');

    // Bottom Sheet
    const sheetHtml = renderToStaticMarkup(
      createElement(SugorokuBottomSheet, {
        open: true,
        title: 'クイックダイジェスト',
        kicker: 'QUICK DIGEST',
        onClose: () => {},
        children: createElement('p', null, 'ボトムシート本文'),
      }),
    );
    expect(sheetHtml).toContain('data-sugoroku-bottom-sheet');
    expect(sheetHtml).toContain('クイックダイジェスト');

    // 個人詳細インフォグラフィック画面
    const detailHtml = renderToStaticMarkup(
      createElement(SugorokuStudentDetailView, {
        student: mio,
        isDemoMode: true,
        onBack: () => {},
        onSaveProfile: () => {},
      }),
    );
    expect(detailHtml).toContain('佐藤 美桜');
    expect(detailHtml).toContain('sg-stack-bar');
    expect(detailHtml).toContain('mt-progress');
    expect(detailHtml).toContain('study-doors');
  });

  it('複数講師（owner / staff）招待ID生成・メール検証・講師管理ボトムシートが正しく描画される', () => {
    expect(normalizeStaffEmail('  Fujisawa@Sugoroku-Juku.jp ')).toBe('fujisawa@sugoroku-juku.jp');
    expect(isValidStaffEmail('fujisawa@sugoroku-juku.jp')).toBe(true);
    expect(isValidStaffEmail('invalid-email')).toBe(false);
    expect(buildStaffInviteId('cls_01', 'Fujisawa@Example.com')).toBe(
      'cls_01_fujisawa@example.com',
    );

    const demo = createSugorokuDemoBundle(new Date(2026, 10, 20, 21, 0, 0).getTime());
    expect(demo.staffInvites).toHaveLength(2);

    const ownerSheetHtml = renderToStaticMarkup(
      createElement(SugorokuStaffSheet, {
        open: true,
        onClose: () => {},
        viewerRole: 'owner',
        ownerName: demo.ownerName,
        ownerEmail: demo.ownerEmail,
        staffInvites: demo.staffInvites,
        onInviteStaff: () => {},
        onRevokeStaff: () => {},
      }),
    );
    expect(ownerSheetHtml).toContain('西 代表');
    expect(ownerSheetHtml).toContain('藤沢 卓登');
    expect(ownerSheetHtml).toContain('小松 講師');
    expect(ownerSheetHtml).toContain('講師を追加');

    // スタッフ（非オーナー）ログイン時は追加フォーム・削除ボタンが出ない（自分のUIDコピーのみ可）
    const staffSheetHtml = renderToStaticMarkup(
      createElement(SugorokuStaffSheet, {
        open: true,
        onClose: () => {},
        viewerRole: 'staff',
        viewerUid: 'staff_uid_12345',
        ownerName: demo.ownerName,
        staffInvites: demo.staffInvites,
        onInviteStaff: () => {},
        onRevokeStaff: () => {},
      }),
    );
    expect(staffSheetHtml).toContain('藤沢 卓登');
    expect(staffSheetHtml).toContain('自分のUIDをコピー');
    expect(staffSheetHtml).not.toContain('講師を追加');
  });

  it('AI 2 / AI 3 / AI 4 / AI 5 全PR連携の共通契約（事前承認オーナー2名・Storageパス・専用PDF6冊・homeworkPlans）を満たす', () => {
    expect(SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS).toEqual([
      'mntobira@gmail.com',
      'hirokingz0927@gmail.com',
    ]);
    expect(getConfiguredAdminEmails('')).toContain('mntobira@gmail.com');
    expect(getConfiguredAdminEmails('')).toContain('hirokingz0927@gmail.com');
    expect(isEmailPreAuthorizedAdmin('HIROKINGZ0927@GMAIL.COM')).toBe(true);
    expect(isEmailPreAuthorizedAdmin('MNTOBIRA@GMAIL.COM')).toBe(true);
    expect(isEmailPreAuthorizedAdmin('random@example.com')).toBe(false);

    expect(SUGOROKU_COLLECTIONS.homeworkPlans).toBe('sugoroku_homework_plans');
    expect(SUGOROKU_SPEAKING_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(buildSpeakingStoragePath('cls_01', 'stu_01', 'sub_01', 'q1', 'm4a')).toBe(
      'sugoroku_speaking/cls_01/stu_01/sub_01/q1.m4a',
    );
    expect(() => buildSpeakingStoragePath('cls/bad', 'stu_01', 'sub_01', 'q1', 'webm')).toThrow();

    expect(SUGOROKU_DEDICATED_PDFS).toHaveLength(6);
    for (const pdf of SUGOROKU_DEDICATED_PDFS) {
      expect(classifyEikenMaterial(pdf)).toBe('sugoroku_pack');
      expect(pdf.file.startsWith('/sugoroku/')).toBe(true);
    }
  });
});
