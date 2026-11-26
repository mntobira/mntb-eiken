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
  SugorokuPdfShelfTab,
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
import {
  buildClassChatThreadId,
  checkClassChatSafety,
  ClassChatView,
  ensureDemoChatSeed,
  loadLocalChatMessages,
  loadLocalChatThreads,
  markClassChatThreadRead,
  sendClassChatMessage,
  TeacherClassChatBoard,
  toggleClassChatReaction,
  UNSENT_TOMBSTONE_TEXT,
  unsendClassChatMessage,
  updateClassChatThreadMeta,
  upsertLocalChatThread,
} from '../src/sugoroku/chat';
import {
  loadCachedSugorokuMember,
  purgeSugorokuSensitiveLocalCache,
  saveCachedSugorokuMember,
} from '../src/sugoroku/auth';
import { buildFeedbackSheetHtml } from '../src/sugoroku/writing-review/printFeedbackSheet';
import { buildSpeakingFeedbackSheetHtml } from '../src/sugoroku/speaking-scbt/speakingFeedbackSheet';
import { isValidEikenChapterId } from '../src/sugoroku/homework/chapterTotals';
import { AdminClassHubSection } from '../src/components/classroom/AdminClassHubSection';
import { buildClassInviteSheetHtml } from '../src/sugoroku/admin/printClassInviteSheet';
import { createDefaultClassSettings } from '../src/sugoroku/admin/classroomSettings';
import { ClassPanel } from '../src/components/ClassPanel';
import { Home } from '../src/components/Home';
import { ProfileModal } from '../src/components/ProfileModal';

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
    expect(html).toContain('生徒・課題');
    expect(html).toContain('チャット');
    expect(html).toContain('教材PDF');
    expect(html).toContain('全員（全級一括）');
    expect(html).toContain('クラス全員・指定生徒に課題を出す');
    expect(html).toContain('高橋 陽斗（高2・サッカー部）');
    expect(html).toContain('山本 陸（高2・野球部）');
    // 不要な右上のログアウトボタン（[->）はヘッダーに存在しないこと（修正点6）
    expect(html).not.toContain('aria-label="ログアウト"');
    expect(html).not.toContain('lucide-log-out');
    // エッセンシャルUI・8大UX要素のマークアップ検証
    expect(html).toContain('class="kt');               // Kinetic Typography (KineticText)
    expect(html).toContain('class="mo-ring"');         // Infographic ScoreRing
    expect(html).toContain('class="mt-countup"');      // Infographic CountUp
    expect(html).toContain('study-doors');             // Infographic 7日間の学びの扉
    expect(html).toContain('data-ptr-host');           // Pull to Refresh ホスト
    expect(html).toContain('data-swipe-row');          // Swipe Action 行

    // A2：教材PDFタブから過剰な一律カリキュラム図・診断ボタンが撤去され、探しやすい検索書庫になっていること
    const pdfShelfHtml = renderToStaticMarkup(
      createElement(SugorokuPdfShelfTab, {
        activeSubject: 'eiken_2',
      }),
    );
    expect(pdfShelfHtml).toContain('配布プリント・教材PDF書庫');
    expect(pdfShelfHtml).toContain('① 級で絞り込む');
    expect(pdfShelfHtml).toContain('② 種類で絞り込む');
    expect(pdfShelfHtml).not.toContain('アプリ内完結 段階別カリキュラム・回数ルート全体図');
    expect(pdfShelfHtml).not.toContain('初回15分診断で開始位置を判定');
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

    // 個人詳細インフォグラフィック画面（A2：個別目標・出題中の課題・反映先表示・個別出題・チャット導線）
    const detailHtml = renderToStaticMarkup(
      createElement(SugorokuStudentDetailView, {
        student: mio,
        assignments: demo.assignments,
        solvedByChapter: demo.solvedByUid.stu_sato_mio,
        isDemoMode: true,
        onBack: () => {},
        onSaveProfile: () => {},
        onCreateHomeworkForStudent: () => {},
        onOpenChat: () => {},
      }),
    );
    expect(detailHtml).toContain('佐藤 美桜');
    expect(detailHtml).toContain('この生徒に課題を出す');
    expect(detailHtml).toContain('生徒のタイトル・ホーム・クラス画面に反映中');
    expect(detailHtml).toContain('チャットで話す');
    expect(detailHtml).toContain('目標・メモ設定');
    expect(detailHtml).toContain('sg-stack-bar');
    expect(detailHtml).toContain('mt-progress');
    expect(detailHtml).toContain('study-doors');
  });

  it('A1・A3：管理クラス一覧ハブとLINE風1対1チャット（送受信・既読・未読カウント）が正しく動作する', async () => {
    const hubHtml = renderToStaticMarkup(
      createElement(AdminClassHubSection, {
        onOpenClassAdmin: () => {},
      }),
    );
    expect(hubHtml).toContain('自分が管理しているクラス一覧');
    expect(hubHtml).toContain('クラスを追加する');

    ensureDemoChatSeed({
      classId: 'cls_chat_test',
      className: '英検2級コース',
      schoolName: 'すごろく塾',
      nowMs: 1_760_000_000_000,
    });

    const stuMsg = await sendClassChatMessage({
      classId: 'cls_chat_test',
      className: '英検2級コース',
      schoolName: 'すごろく塾',
      teacherUid: 'teacher_1',
      studentUid: 'stu_test_1',
      studentName: '田中 蓮',
      senderRole: 'student',
      senderName: '田中 蓮',
      text: '大問3の長文の進め方を相談したいです！',
      topic: 'question',
      isDemoMode: true,
    });

    const tid = buildClassChatThreadId('cls_chat_test', 'stu_test_1');
    expect(loadLocalChatThreads({ isDemoMode: true })[tid]?.unreadByTeacher).toBe(1);
    expect(loadLocalChatThreads({ isDemoMode: true })[tid]?.resolutionStatus).toBe('open');
    expect(loadLocalChatMessages(tid, { isDemoMode: true }).at(-1)?.text).toContain(
      '大問3の長文の進め方',
    );

    // 先生からの引用リプライ＋単元カード添付送信
    const teacherReply = await sendClassChatMessage({
      classId: 'cls_chat_test',
      className: '英検2級コース',
      schoolName: 'すごろく塾',
      teacherUid: 'teacher_1',
      studentUid: 'stu_test_1',
      studentName: '田中 蓮',
      senderRole: 'teacher',
      senderName: '西 講師',
      text: 'まずは段落ごとに接続語に線を引いて、この単元から1題やってみよう！',
      replyTo: {
        id: stuMsg.id,
        senderName: '田中 蓮',
        text: stuMsg.text,
      },
      linkedChapter: {
        id: 'e2_reading_3b',
        title: '[2級] 長文内容一致 3B',
      },
      isDemoMode: true,
    });

    // リアクション付与・ピン留め約束メモ・解決ステータス更新
    await toggleClassChatReaction({
      classId: 'cls_chat_test',
      studentUid: 'stu_test_1',
      messageId: teacherReply.id,
      viewerRole: 'student',
      reaction: 'bulb',
      isDemoMode: true,
    });
    expect(
      loadLocalChatMessages(tid, { isDemoMode: true }).find((m) => m.id === teacherReply.id)
        ?.reactions?.student,
    ).toBe('bulb');

    await updateClassChatThreadMeta({
      classId: 'cls_chat_test',
      studentUid: 'stu_test_1',
      viewerRole: 'teacher',
      pinnedNotice: '毎週水曜までに2級リスニング第1部を20問クリアしよう！',
      resolutionStatus: 'resolved',
      isDemoMode: true,
    });
    expect(loadLocalChatThreads({ isDemoMode: true })[tid]?.pinnedNotice).toContain(
      '毎週水曜まで',
    );
    expect(loadLocalChatThreads({ isDemoMode: true })[tid]?.resolutionStatus).toBe('resolved');

    // セキュリティ検証1：生徒ロールからは先生専用の pinnedNotice を書き換えられないこと
    await updateClassChatThreadMeta({
      classId: 'cls_chat_test',
      studentUid: 'stu_test_1',
      viewerRole: 'student',
      pinnedNotice: '生徒による偽装ピン留め',
      isDemoMode: true,
    });
    expect(loadLocalChatThreads({ isDemoMode: true })[tid]?.pinnedNotice).toBe(
      '毎週水曜までに2級リスニング第1部を20問クリアしよう！',
    );

    await markClassChatThreadRead({
      classId: 'cls_chat_test',
      studentUid: 'stu_test_1',
      viewerRole: 'teacher',
      isDemoMode: true,
    });
    expect(loadLocalChatThreads({ isDemoMode: true })[tid]?.unreadByTeacher).toBe(0);

    const chatHtml = renderToStaticMarkup(
      createElement(ClassChatView, {
        classId: 'cls_chat_test',
        className: '英検2級コース',
        schoolName: 'すごろく塾',
        teacherUid: 'teacher_1',
        studentUid: 'stu_test_1',
        studentName: '田中 蓮',
        viewerRole: 'student',
        viewerName: '田中 蓮',
        isDemoMode: true,
        embedded: true,
        onStartChapter: () => {},
      }),
    );
    expect(chatHtml).toContain('他の生徒には一切見えません');
    expect(chatHtml).toContain('ここから未読メッセージ');
    expect(chatHtml).toContain('大問3の長文の進め方を相談したいです！');
    expect(chatHtml).toContain('class-chat-chapter-card');
    expect(chatHtml).toContain('[2級] 長文内容一致 3B');
    expect(chatHtml).toContain('毎週水曜までに2級リスニング第1部を20問クリアしよう！');
    expect(chatHtml).toContain('💡');

    // 送信取消（送信者本人のロールでのみ取り消し可能・取り消し後は元本文・引用・添付・リアクションが完全消去されること）
    await unsendClassChatMessage({
      classId: 'cls_chat_test',
      studentUid: 'stu_test_1',
      messageId: teacherReply.id,
      viewerRole: 'student',
      isDemoMode: true,
    });
    expect(
      loadLocalChatMessages(tid, { isDemoMode: true }).find((m) => m.id === teacherReply.id)
        ?.unsent,
    ).toBeUndefined();

    await unsendClassChatMessage({
      classId: 'cls_chat_test',
      studentUid: 'stu_test_1',
      messageId: teacherReply.id,
      viewerRole: 'teacher',
      isDemoMode: true,
    });
    const scrubbed = loadLocalChatMessages(tid, { isDemoMode: true }).find(
      (m) => m.id === teacherReply.id,
    );
    expect(scrubbed?.unsent).toBe(true);
    expect(scrubbed?.text).toBe(UNSENT_TOMBSTONE_TEXT);
    expect(scrubbed?.replyToText).toBeUndefined();
    expect(scrubbed?.linkedChapterId).toBeUndefined();
    expect(scrubbed?.reactions).toBeUndefined();

    // セキュリティ検証2：共有端末でのUID別ローカルストレージ完全分離＆プロトタイプ汚染防止＆不正単元ID拒否
    upsertLocalChatThread(
      {
        id: 'cls_sec_uid_alice',
        classId: 'cls_sec',
        className: 'セキュリティ検証クラス',
        schoolName: 'すごろく塾',
        teacherUid: 'teacher_1',
        studentUid: 'uid_alice',
        studentName: 'アリス',
        lastMessageText: 'アリスの秘密の相談です',
        lastSenderRole: 'student',
        lastSenderName: 'アリス',
        lastMessageAt: 1_760_000_100_000,
        unreadByTeacher: 1,
        unreadByStudent: 0,
        teacherLastReadAt: 0,
        studentLastReadAt: 1_760_000_100_000,
        updatedAt: 1_760_000_100_000,
      },
      { ownerUid: 'uid_alice' },
    );
    expect(loadLocalChatThreads({ ownerUid: 'uid_alice' })['cls_sec_uid_alice']?.lastMessageText).toBe(
      'アリスの秘密の相談です',
    );
    // 同じブラウザで別ユーザー（uid_bob）に切り替えた際、アリスのキャッシュが1件も見えないこと
    expect(loadLocalChatThreads({ ownerUid: 'uid_bob' })['cls_sec_uid_alice']).toBeUndefined();

    // 不正キー（__proto__ / パストラバーサル）での送信拒否・単元IDホワイトリスト検証
    await expect(
      sendClassChatMessage({
        classId: '__proto__',
        className: 'x',
        teacherUid: 'teacher_1',
        studentUid: 'stu_1',
        studentName: 'x',
        senderRole: 'student',
        senderName: 'x',
        text: 'test',
        isDemoMode: true,
      }),
    ).rejects.toThrow();
    expect(isValidEikenChapterId('javascript:alert(1)')).toBe(false);
    expect(isValidEikenChapterId('../../etc/passwd')).toBe(false);

    // セキュリティ検証3：アプリ内安全性ガード（青少年保護：電話番号・個人メール・外部SNS交換・深刻な暴言の送信遮断＆英検学習語の誤検知ゼロ）
    expect(checkClassChatSafety('090-1234-5678 に電話してください').ok).toBe(false);
    expect(checkClassChatSafety('０８０１２３４５６７８').violation).toBe('personal_contact');
    expect(checkClassChatSafety('secret.student@gmail.com に送って').violation).toBe(
      'personal_contact',
    );
    expect(checkClassChatSafety('LINEのID教えて！').violation).toBe('external_sns');
    expect(checkClassChatSafety('インスタ交換しよう').violation).toBe('external_sns');
    expect(checkClassChatSafety('https://lin.ee/abcdefg').violation).toBe('external_sns');
    expect(checkClassChatSafety('死ね').violation).toBe('severe_abuse');
    // 通常の英検学習文・指導文は一切誤検知しないこと
    expect(
      checkClassChatSafety(
        'Reading passage and listening skills studied today! 6th assignment passed.',
      ).ok,
    ).toBe(true);
    expect(checkClassChatSafety('スクショやLINE報告は不要でアプリ内で完結します！').ok).toBe(true);

    // 送信API自体も個人連絡先入りメッセージを拒否すること
    await expect(
      sendClassChatMessage({
        classId: 'cls_chat_test',
        className: '英検2級コース',
        teacherUid: 'teacher_1',
        studentUid: 'stu_test_1',
        studentName: '田中 蓮',
        senderRole: 'student',
        senderName: '田中 蓮',
        text: '僕の携帯 090-9876-5432 です！',
        isDemoMode: true,
      }),
    ).rejects.toThrow('電話番号');

    // セキュリティ検証4：共有端末ログアウト時の機密キャッシュ完全パージ
    const prevLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;
    const mockMap = new Map<string, string>();
    const mockStorage = {
      get length() {
        return mockMap.size;
      },
      clear: () => mockMap.clear(),
      getItem: (k: string) => mockMap.get(k) ?? null,
      key: (i: number) => [...mockMap.keys()][i] ?? null,
      removeItem: (k: string) => {
        mockMap.delete(k);
      },
      setItem: (k: string, v: string) => {
        mockMap.set(k, String(v));
      },
    } as Storage;
    (globalThis as { localStorage?: Storage }).localStorage = mockStorage;
    try {
      saveCachedSugorokuMember(
        {
          uid: 'uid_alice',
          role: 'student',
          active: true,
          adFree: true,
          displayName: 'アリス',
        },
        'uid_alice',
      );
      upsertLocalChatThread(
        {
          id: 'cls_sec2_uid_alice',
          classId: 'cls_sec2',
          className: '検証2',
          schoolName: 'すごろく塾',
          teacherUid: 'teacher_1',
          studentUid: 'uid_alice',
          studentName: 'アリス',
          lastMessageText: '共有iPad上の相談履歴',
          lastSenderRole: 'student',
          lastSenderName: 'アリス',
          lastMessageAt: 1_760_000_200_000,
          unreadByTeacher: 1,
          unreadByStudent: 0,
          teacherLastReadAt: 0,
          studentLastReadAt: 1_760_000_200_000,
          updatedAt: 1_760_000_200_000,
        },
        { ownerUid: 'uid_alice' },
      );
      expect(loadCachedSugorokuMember('uid_alice')?.displayName).toBe('アリス');
      expect(
        loadLocalChatThreads({ ownerUid: 'uid_alice' })['cls_sec2_uid_alice']?.lastMessageText,
      ).toBe('共有iPad上の相談履歴');

      purgeSugorokuSensitiveLocalCache('uid_alice');
      expect(loadCachedSugorokuMember('uid_alice')).toBeNull();
      expect(loadLocalChatThreads({ ownerUid: 'uid_alice' })['cls_sec2_uid_alice']).toBeUndefined();
    } finally {
      if (prevLocalStorage === undefined) {
        delete (globalThis as { localStorage?: Storage }).localStorage;
      } else {
        (globalThis as { localStorage?: Storage }).localStorage = prevLocalStorage;
      }
    }

    // セキュリティ検証5：印刷用フィードバックシートHTMLへのXSSペイロード無害化検証
    const xssWritingHtml = buildFeedbackSheetHtml({
      id: 'sub_xss',
      classId: 'cls_1',
      studentUid: 'stu_1',
      studentName: '<img src=x onerror=alert(1)>',
      grade: 'eiken_2',
      taskKey: 't1',
      wordCount: 12,
      text: '<script>alert("xss")</script>',
      formatWarnings: ['<b>warn</b>'],
      status: 'reviewed',
      submittedAt: 1_760_000_000_000,
      review: {
        reviewerUid: 'teacher_1',
        reviewerName: '<svg onload=alert(2)>',
        score: 14,
        maxScore: 16,
        comment: '"><script>alert(3)</script>',
        reviewedAt: 1_760_000_010_000,
      },
    });
    expect(xssWritingHtml).not.toContain('<script>alert');
    expect(xssWritingHtml).not.toContain('<img src=x');
    expect(xssWritingHtml).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');

    const xssSpeakingHtml = buildSpeakingFeedbackSheetHtml({
      id: 'spk_xss',
      classId: 'cls_1',
      studentUid: 'stu_1',
      studentName: '<script>alert(9)</script>',
      grade: 'eiken_2',
      setId: 's1',
      recordings: [],
      status: 'reviewed',
      submittedAt: 1_760_000_000_000,
      review: {
        reviewerUid: 'teacher_1',
        rubricScores: { reading_aloud: 4, q1: 4, q2: 8, q3: 4, q4: 4, attitude: 3 },
        comment: '<img src=x onerror=alert(9)>',
        reviewedAt: 1_760_000_010_000,
      },
    });
    expect(xssSpeakingHtml).not.toContain('<script>alert(9)');
    expect(xssSpeakingHtml).not.toContain('<img src=x');

    // 先生側LINE公式アカウント風トーク管理ボード（フィルタ・検索・生徒カルテストリップ）
    const demo = createSugorokuDemoBundle(1_760_000_000_000);
    const overviews = demo.members.map((member) =>
      buildStudentOverview({
        member,
        logs: demo.logsByUid[member.uid] ?? [],
        assignments: demo.assignments,
        solvedByChapter: demo.solvedByUid[member.uid] ?? {},
        nowMs: 1_760_000_000_000,
      }),
    );
    const boardHtml = renderToStaticMarkup(
      createElement(TeacherClassChatBoard, {
        classId: 'cls_chat_test',
        className: '英検2級コース',
        schoolName: 'すごろく塾',
        teacherUid: 'teacher_1',
        teacherName: '西 講師',
        students: overviews,
        isDemoMode: true,
        onIssueHomeworkForStudent: () => {},
        onOpenStudentDetail: () => {},
      }),
    );
    expect(boardHtml).toContain('data-testid="teacher-class-chat-board"');
    expect(boardHtml).toContain('相談中');
    expect(boardHtml).toContain('学習遅れ');
    expect(boardHtml).toContain('この生徒に課題を出す');
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

  it('A4招待シートHTML出力と生徒側クラス参加パネル（ClassPanel）が正しく描画される', () => {
    const inviteHtml = buildClassInviteSheetHtml({
      room: {
        id: 'cls_2026_2kyu',
        schoolName: '学習塾すごろく 自由が丘校',
        className: '2026夏 英検5級〜1級 全級合格コース',
        subject: 'eiken_2',
        joinCode: 'SG2026',
        teacherUid: 'teacher_1',
        joinOpen: true,
        plan: 'juku',
        createdAt: 1700000000000,
      },
      settings: {
        ...createDefaultClassSettings('cls_2026_2kyu'),
        dailyGoalMinutes: 35,
        weeklyGoalDays: 6,
        examSession: 'scbt_monthly',
        coachNote: '毎日リスニング15分＋単語20分を続けましょう！',
      },
      origin: 'https://eiken.manatobi.jp',
    });
    expect(inviteHtml).toContain('学習塾すごろく 自由が丘校');
    expect(inviteHtml).toContain('2026夏 英検5級〜1級 全級合格コース');
    expect(inviteHtml).toContain('https://eiken.manatobi.jp/?sugoroku_invite=SG2026');
    expect(inviteHtml).toContain('英検5級〜1級（全級一括対応）');
    expect(inviteHtml).toContain('1日35分 × 週6日');
    expect(inviteHtml).toContain('S-CBT受験');
    expect(inviteHtml).toContain('塾生専用クラス招待状（広告完全非表示）');
    expect(inviteHtml).toContain('毎日リスニング15分＋単語20分を続けましょう！');

    const unauthPanelHtml = renderToStaticMarkup(
      createElement(ClassPanel, {
        defaultDisplayName: 'たくと',
        onLinkGoogle: () => {},
      }),
    );
    expect(unauthPanelHtml).toContain('クラス参加には Google ログインが必要です');
    expect(unauthPanelHtml).toContain('6文字コードでクラスに参加できます');
    expect(unauthPanelHtml).toContain('先生にチャット相談');
    expect(unauthPanelHtml).toContain('Google でログインしてクラスへ進む');

    // ホーム画面から1タップで「クラス」へ直行できるボタン＋未読バッジが描画される
    const homeHtml = renderToStaticMarkup(
      createElement(Home, {
        onStart: () => {},
        onIntro: () => {},
        onNoteList: () => {},
        onOpenClass: () => {},
        unreadClassChatCount: 3,
        isGuest: true,
      }),
    );
    expect(homeHtml).toContain('data-open-class');
    expect(homeHtml).toContain('クラスを開く（未読チャット3件）');

    // 未ログイン状態でも「設定 ＞ クラス」タブが無効化されず、1画面でGoogleログイン案内が表示される
    const modalClassHtml = renderToStaticMarkup(
      createElement(ProfileModal, {
        initialTab: 'class',
        onClose: () => {},
        isBgmEnabled: false,
        setIsBgmEnabled: () => {},
        bgmVolume: 0.5,
        setBgmVolume: () => {},
      }),
    );
    expect(modalClassHtml).toContain('data-settings-tab="class"');
    expect(modalClassHtml).toContain('Google でログインしてクラスへ進む');
  });
});
