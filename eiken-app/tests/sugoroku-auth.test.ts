import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { User } from 'firebase/auth';
import {
  resolveSugorokuPortalMode,
  extractInviteCodeFromSearch,
  isSugorokuStaffRole,
  isActiveSugorokuStaff,
  isSuspendedSugorokuMember,
  getConfiguredSugorokuAdminEmails,
  isPreAuthorizedSugorokuInstructorEmail,
  hasVerifiedPreAuthorizedInstructorEmail,
  hasVerifiedGoogleIdentity,
  evaluateSugorokuAdminAccess,
  describeAdminDenyReason,
  canManageSugorokuClass,
  canReadStudentSugorokuData,
  shouldApplySugorokuAdFree,
  formatStudentDisplayName,
  isSafariOrIPadBrowser,
  toHalfWidthAlphanumeric,
  normalizeSugorokuInviteCode,
  validateSugorokuInviteCode,
  parseSugorokuInviteDraft,
  parseCachedSugorokuMember,
} from '../src/sugoroku/auth/sugorokuAuthCore';
import { SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS } from '../src/sugoroku/shared/types';
import { CLASSROOM_PREVIEW_EMAILS, isClassroomEnabledFor } from '../src/config/features';
import { SugorokuGateScreen } from '../src/sugoroku/auth/SugorokuAuthGate';
import { SugorokuAdminGuard } from '../src/sugoroku/auth/SugorokuAdminGuard';
import { SugorokuAdminApp } from '../src/sugoroku/admin/SugorokuAdminApp';
import {
  buildStudentDetailedTimeCsv,
  buildStudentDetailedTimeReport,
} from '../src/sugoroku/admin/timeAnalyticsDetail';
import { createSugorokuDemoBundle } from '../src/sugoroku/admin/demoData';
import { buildStudentOverview } from '../src/sugoroku/admin/adminAnalytics';
import { SugorokuStudentDetailView } from '../src/sugoroku/admin/SugorokuStudentDetailView';
import {
  buildClassInviteMessage,
  buildClassInviteUrl,
  CLASSROOM_ALLOWED_SUBJECTS,
  createDefaultClassSettings,
  normalizeClassSettings,
} from '../src/sugoroku/admin/classroomSettings';
import { CreateClassModal } from '../src/components/teacher/CreateClassModal';
import { EmptyState } from '../src/components/teacher/EmptyState';
import { StudentsTab } from '../src/components/teacher/StudentsTab';
import { ClassesTab } from '../src/components/teacher/ClassesTab';
import { DEFAULT_CLASS_SUBJECT } from '../src/components/teacher/teacherSubjects';
import { aggregateClass, type ClassroomDoc } from '../src/utils/classroomCore';
import { subjectTheme } from '../src/data/subjectTheme';
import { isAdminOnlyAppState, restoreAppState } from '../src/hooks/useAppPersistence';
import { STORAGE_KEYS } from '../src/utils/storageKeysCatalog';
import { safeSetItem } from '../src/utils/storageGuard';
import { safeRemoveItem } from '../src/utils/safeLocalStorage';
import { isAdFree, setAdFree } from '../src/ads/adFree';

describe('sugoroku/auth core logic & Manatobi UI gate (AI 4)', () => {
  beforeEach(() => {
    setAdFree(false);
  });

  it('resolves portal mode from URL query, invite link, and environment variable', () => {
    expect(resolveSugorokuPortalMode('?portal=admin', undefined)).toBe('admin');
    expect(resolveSugorokuPortalMode('?portal=sugoroku', undefined)).toBe('juku');
    expect(resolveSugorokuPortalMode('?portal=juku', undefined)).toBe('juku');
    expect(resolveSugorokuPortalMode('?sugoroku=1', undefined)).toBe('juku');
    expect(resolveSugorokuPortalMode('?sugoroku_invite=ACDEF2', undefined)).toBe('juku');
    expect(resolveSugorokuPortalMode('', 'admin')).toBe('admin');
    expect(resolveSugorokuPortalMode('', 'sugoroku')).toBe('juku');
    expect(resolveSugorokuPortalMode('', undefined)).toBe('standard');
  });

  it('normalizes full-width Japanese keyboard input, prefixes, and extracts URL invite codes', () => {
    expect(toHalfWidthAlphanumeric('ＡＣＤＥＦ２')).toBe('ACDEF2');
    expect(normalizeSugorokuInviteCode('ｓｕｇｏｒｏｋｕーａｃｄｅｆ２')).toBe('ACDEF2');
    expect(normalizeSugorokuInviteCode(' mntb_gh-jkm3 ')).toBe('GHJKM3');
    expect(extractInviteCodeFromSearch('?sugoroku_invite=ｓｕｇｏｒｏｋｕーａｃｄｅｆ２')).toBe('ACDEF2');
    expect(extractInviteCodeFromSearch('?invite=gh-jkm3')).toBe('GHJKM3');
    expect(validateSugorokuInviteCode('ACDEF2')).toEqual({ ok: true, message: '', code: 'ACDEF2' });

    // O/0, I/1 は誤読文字として正規化後に案内エラーを返す
    const invalidChar = validateSugorokuInviteCode('AB01CD');
    expect(invalidChar.ok).toBe(false);
    expect(invalidChar.message).toContain('似ている文字');

    const invalidLen = validateSugorokuInviteCode('ACD');
    expect(invalidLen.ok).toBe(false);
    expect(invalidLen.message).toContain('6文字');
  });

  it('detects iPadOS / iOS Safari browsers for popup-block redirect fallback guidance', () => {
    expect(
      isSafariOrIPadBrowser(
        'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        5,
      ),
    ).toBe(true);
    expect(
      isSafariOrIPadBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        5,
      ),
    ).toBe(true);
    expect(
      isSafariOrIPadBrowser(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        0,
      ),
    ).toBe(false);
  });

  it('enforces strict Google identity, owner/staff/teacher admin guard rules, and suspended revocation', () => {
    expect(isSugorokuStaffRole('owner')).toBe(true);
    expect(isSugorokuStaffRole('staff')).toBe(true);
    expect(isSugorokuStaffRole('student')).toBe(false);
    expect(isActiveSugorokuStaff({ role: 'staff', active: false })).toBe(false);
    expect(isActiveSugorokuStaff({ role: 'staff', active: true })).toBe(true);
    expect(isSuspendedSugorokuMember({ active: false })).toBe(true);
    expect(isSuspendedSugorokuMember({ active: true })).toBe(false);

    expect(
      hasVerifiedGoogleIdentity({ uid: 'u1', emailVerified: true, providerIds: ['google.com'] }),
    ).toBe(true);
    expect(
      hasVerifiedGoogleIdentity({ uid: 'u1', emailVerified: false, providerIds: ['google.com'] }),
    ).toBe(false);
    expect(
      hasVerifiedGoogleIdentity({ uid: 'u1', emailVerified: true, providerIds: ['password'] }),
    ).toBe(false);

    expect(evaluateSugorokuAdminAccess({ uid: null }).allowed).toBe(false);
    expect(evaluateSugorokuAdminAccess({ uid: null }).reason).toBe('unauthenticated');

    expect(
      evaluateSugorokuAdminAccess({
        uid: 'u1',
        emailVerified: true,
        providerIds: ['apple.com'],
      }),
    ).toEqual({ allowed: false, reason: 'google_required' });

    // Suspended staff is immediately blocked even if they own a classroom
    const suspendedDecision = evaluateSugorokuAdminAccess({
      uid: 'tutor_suspended',
      emailVerified: true,
      providerIds: ['google.com'],
      memberDoc: { uid: 'tutor_suspended', role: 'staff', active: false },
      ownedJukuClassIds: ['class_a'],
    });
    expect(suspendedDecision).toEqual({ allowed: false, reason: 'suspended_member' });
    expect(describeAdminDenyReason(suspendedDecision.reason)).toContain('停止');

    // Student cannot enter admin portal
    expect(
      evaluateSugorokuAdminAccess({
        uid: 'student_1',
        emailVerified: true,
        providerIds: ['google.com'],
        memberDoc: { uid: 'student_1', role: 'student', active: true },
        ownedJukuClassIds: [],
      }),
    ).toEqual({ allowed: false, reason: 'insufficient_role' });

    // Active staff can enter
    expect(
      evaluateSugorokuAdminAccess({
        uid: 'tutor_1',
        emailVerified: true,
        providerIds: ['google.com'],
        memberDoc: { uid: 'tutor_1', role: 'staff', active: true },
      }),
    ).toEqual({ allowed: true, reason: 'allowed_staff_role' });

    // Classroom teacher can enter
    expect(
      evaluateSugorokuAdminAccess({
        uid: 'teacher_1',
        emailVerified: true,
        providerIds: ['google.com'],
        ownedJukuClassIds: ['class_a'],
      }),
    ).toEqual({ allowed: true, reason: 'allowed_class_teacher' });
  });

  it('restricts class management and student data viewing to owner, assigned staff, or teacherUid', () => {
    expect(
      canManageSugorokuClass({
        uid: 'teacher_a',
        classId: 'class_a',
        classTeacherUid: 'teacher_a',
      }),
    ).toBe(true);

    expect(
      canManageSugorokuClass({
        uid: 'teacher_b',
        classId: 'class_a',
        classTeacherUid: 'teacher_a',
      }),
    ).toBe(false);

    const staffDoc = { uid: 'staff_a', role: 'staff' as const, active: true, classIds: ['class_a'] };
    expect(canManageSugorokuClass({ uid: 'staff_a', classId: 'class_a', memberDoc: staffDoc })).toBe(true);
    expect(canManageSugorokuClass({ uid: 'staff_a', classId: 'class_b', memberDoc: staffDoc })).toBe(false);

    const ownerDoc = { uid: 'owner_1', role: 'owner' as const, active: true };
    expect(canManageSugorokuClass({ uid: 'owner_1', classId: 'class_b', memberDoc: ownerDoc })).toBe(true);

    expect(canReadStudentSugorokuData({ viewerUid: 's1', studentUid: 's1' })).toBe(true);
    expect(canReadStudentSugorokuData({ viewerUid: 's2', studentUid: 's1' })).toBe(false);
    expect(
      canReadStudentSugorokuData({
        viewerUid: 'teacher_a',
        studentUid: 's1',
        hasStudyAccess: true,
      }),
    ).toBe(true);
  });

  it('applies Ad-Free for active Sugoroku juku members, revokes on suspension, and hides real roster names on public surfaces', () => {
    expect(shouldApplySugorokuAdFree({ uid: null })).toBe(false);
    expect(
      shouldApplySugorokuAdFree({
        uid: 'student_a',
        memberDoc: { active: true, adFree: true },
        jukuClassCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldApplySugorokuAdFree({
        uid: 'student_a',
        memberDoc: null,
        jukuClassCount: 1,
      }),
    ).toBe(true);

    // Suspended member MUST immediately lose Ad-Free even if stale jukuClassCount > 0
    expect(
      shouldApplySugorokuAdFree({
        uid: 'student_a',
        memberDoc: { active: false, adFree: true },
        jukuClassCount: 2,
      }),
    ).toBe(false);

    setAdFree(
      shouldApplySugorokuAdFree({
        uid: 'student_a',
        memberDoc: { active: true, adFree: true },
      }),
    );
    expect(isAdFree()).toBe(true);

    // Real-name privacy separation: rosterName is ONLY shown on authorized admin surface
    expect(
      formatStudentDisplayName({
        surface: 'admin',
        canViewRosterName: true,
        nickname: 'たくみ',
        rosterName: '佐藤 拓海',
      }),
    ).toBe('佐藤 拓海');

    // Public ranking surface NEVER reveals rosterName and masks nickname
    const publicName = formatStudentDisplayName({
      surface: 'public',
      canViewRosterName: false,
      isMe: false,
      nickname: 'たくみ',
      rosterName: '佐藤 拓海',
    });
    expect(publicName).not.toContain('佐藤');
    expect(publicName).not.toContain('拓海');
  });

  it('parses cached member & redirect invite drafts safely against malformed JSON or UID tampering', () => {
    const valid = JSON.stringify({
      uid: 'u_abc',
      role: 'student',
      active: true,
      adFree: true,
      classId: 'c1',
      classIds: ['c1'],
    });
    expect(parseCachedSugorokuMember(valid, 'u_abc')).toMatchObject({
      uid: 'u_abc',
      role: 'student',
      active: true,
      adFree: true,
      classId: 'c1',
      classIds: ['c1'],
    });
    expect(parseCachedSugorokuMember(valid, 'u_other')).toBeNull();
    expect(parseCachedSugorokuMember('{broken', 'u_abc')).toBeNull();

    const draft = parseSugorokuInviteDraft(
      JSON.stringify({
        inviteCode: 'ｓｕｇｏｒｏｋｕーａｃｄｅｆ２',
        displayName: 'たくみ',
        targetGrade: 'eiken_pre2plus',
        consentAccepted: true,
      }),
    );
    expect(draft).toEqual({
      inviteCode: 'ACDEF2',
      displayName: 'たくみ',
      targetGrade: 'eiken_pre2plus',
      consentAccepted: true,
    });
    expect(parseSugorokuInviteDraft('invalid')).toBeNull();
  });

  it('renders Manatobi-authentic SugorokuGateScreen and SugorokuAdminGuard with zero demo bypasses or leaked emails', () => {
    const step1Html = renderToStaticMarkup(
      createElement(SugorokuGateScreen, {
        user: null,
        loading: false,
        onlineReady: true,
        onEnrolled: async () => {},
      }),
    );
    expect(step1Html).toContain('sugoroku-auth-gate');
    expect(step1Html).toContain('Google アカウントでログイン');
    expect(step1Html).toContain('広告 100% 完全非表示');
    expect(step1Html).toContain('data-tobira-buddy');
    expect(step1Html).not.toContain('デモデータモード');
    expect(step1Html).not.toContain('試作デモ');
    expect(step1Html).not.toContain('mntobira@gmail.com');
    expect(step1Html).not.toContain('hirokingz0927@gmail.com');

    const mockUser = {
      uid: 'student_01',
      email: 'student01@school.ed.jp',
      displayName: 'Takumi',
    } as unknown as User;

    const step2Html = renderToStaticMarkup(
      createElement(SugorokuGateScreen, {
        user: mockUser,
        loading: false,
        isSuspended: true,
        onlineReady: true,
        onEnrolled: async () => {},
      }),
    );
    expect(step2Html).toContain('sugoroku-invite-input');
    expect(step2Html).toContain('sga-code-slot');
    expect(step2Html).toContain('student01@school.ed.jp');
    expect(step2Html).toContain('英検2級');
    expect(step2Html).toContain('現在このアカウントの塾在籍が停止されています');
    expect(step2Html).toContain('公開ランキング等に本名は一切表示されません');

    // SugorokuAdminGuard: must NOT expose 入場条件, pre-authorized instructor emails, internal role names, or demo bypass buttons
    const adminGuardHtml = renderToStaticMarkup(
      createElement(SugorokuAdminGuard, {
        onBackToStudentApp: () => {},
        children: createElement('div', { 'data-testid': 'protected-admin-child' }, 'SECRET'),
      }),
    );
    expect(adminGuardHtml).toContain('sugoroku-admin-guard');
    expect(adminGuardHtml).toContain('管理者ログイン');
    expect(adminGuardHtml).not.toContain('SECRET');
    expect(adminGuardHtml).not.toContain('入場条件');
    expect(adminGuardHtml).not.toContain('デモデータモード');
    expect(adminGuardHtml).not.toContain('試作デモ');
    expect(adminGuardHtml).not.toContain('mntobira@gmail.com');
    expect(adminGuardHtml).not.toContain('hirokingz0927@gmail.com');
    expect(adminGuardHtml).not.toContain('teacherUid');

    expect(describeAdminDenyReason('insufficient_role')).not.toContain('owner');
    expect(describeAdminDenyReason('insufficient_role')).not.toContain('staff');
  });

  it('allows zero-touch instructor login & classroom preview for mntobira@gmail.com and hirokingz0927@gmail.com while rejecting unverified or unlisted emails', () => {
    expect(SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS).toEqual([
      'mntobira@gmail.com',
      'hirokingz0927@gmail.com',
    ]);
    expect(CLASSROOM_PREVIEW_EMAILS).toContain('mntobira@gmail.com');
    expect(CLASSROOM_PREVIEW_EMAILS).toContain('hirokingz0927@gmail.com');

    // 環境変数に1件しか書かれていても既定の2アカウントは必ず維持される
    const mergedEmails = getConfiguredSugorokuAdminEmails('extra-tutor@example.com');
    expect(mergedEmails).toContain('mntobira@gmail.com');
    expect(mergedEmails).toContain('hirokingz0927@gmail.com');
    expect(mergedEmails).toContain('extra-tutor@example.com');

    for (const instructorEmail of ['mntobira@gmail.com', 'HIROKINGZ0927@gmail.com']) {
      expect(isPreAuthorizedSugorokuInstructorEmail(instructorEmail)).toBe(true);
      expect(
        hasVerifiedPreAuthorizedInstructorEmail({
          email: instructorEmail,
          emailVerified: true,
          providerIds: ['google.com'],
        }),
      ).toBe(true);

      // 設定画面「クラス」タブ先行解放も両アカウントで有効
      expect(isClassroomEnabledFor({ email: instructorEmail, emailVerified: true })).toBe(true);
      expect(isClassroomEnabledFor({ email: instructorEmail, emailVerified: false })).toBe(false);

      // 初回ログイン直後（memberDoc === null, ownedJukuClassIds === []）でも即時管理者ポータル入場可
      expect(
        evaluateSugorokuAdminAccess({
          uid: `first_login_${instructorEmail}`,
          email: instructorEmail,
          emailVerified: true,
          providerIds: ['google.com'],
          memberDoc: null,
          ownedJukuClassIds: [],
        }),
      ).toEqual({ allowed: true, reason: 'allowed_preauthorized_email' });

      // クラス管理・生徒ログ閲覧ヘルパーも即時許可
      expect(
        canManageSugorokuClass({
          uid: `first_login_${instructorEmail}`,
          email: instructorEmail,
          emailVerified: true,
          classId: 'class_juku_a',
        }),
      ).toBe(true);
      expect(
        canReadStudentSugorokuData({
          viewerUid: `first_login_${instructorEmail}`,
          viewerEmail: instructorEmail,
          viewerEmailVerified: true,
          studentUid: 'student_a',
        }),
      ).toBe(true);
    }

    // メール未確認トークンや無関係な Gmail アカウントは拒否
    expect(
      evaluateSugorokuAdminAccess({
        uid: 'spoof_unverified',
        email: 'hirokingz0927@gmail.com',
        emailVerified: false,
        providerIds: ['google.com'],
      }),
    ).toEqual({ allowed: false, reason: 'email_unverified' });

    expect(
      evaluateSugorokuAdminAccess({
        uid: 'random_user',
        email: 'random_student@gmail.com',
        emailVerified: true,
        providerIds: ['google.com'],
      }),
    ).toEqual({ allowed: false, reason: 'insufficient_role' });

    // 仮に事前承認メールでも明示的に active === false に停止された場合は遮断される
    expect(
      evaluateSugorokuAdminAccess({
        uid: 'suspended_instructor',
        email: 'hirokingz0927@gmail.com',
        emailVerified: true,
        providerIds: ['google.com'],
        memberDoc: { uid: 'suspended_instructor', role: 'owner', active: false },
      }),
    ).toEqual({ allowed: false, reason: 'suspended_member' });

    // strictSpecifiedEmailsOnly=true（管理者ログインゲートの既定値）：
    // hirokingz0927@gmail.com / mntobira@gmail.com は通過し、それ以外のメールはクラス作成者やstaffであっても必ず遮断される
    expect(
      evaluateSugorokuAdminAccess({
        uid: 'owner_hiro',
        email: 'hirokingz0927@gmail.com',
        emailVerified: true,
        providerIds: ['google.com'],
        strictSpecifiedEmailsOnly: true,
      }),
    ).toEqual({ allowed: true, reason: 'allowed_preauthorized_email' });

    expect(
      evaluateSugorokuAdminAccess({
        uid: 'owner_mntb',
        email: 'mntobira@gmail.com',
        emailVerified: true,
        providerIds: ['google.com'],
        strictSpecifiedEmailsOnly: true,
      }),
    ).toEqual({ allowed: true, reason: 'allowed_preauthorized_email' });

    expect(
      evaluateSugorokuAdminAccess({
        uid: 'other_teacher',
        email: 'other-teacher@school.ed.jp',
        emailVerified: true,
        providerIds: ['google.com'],
        memberDoc: { uid: 'other_teacher', role: 'staff', active: true },
        ownedJukuClassIds: ['class_any'],
        strictSpecifiedEmailsOnly: true,
      }),
    ).toEqual({ allowed: false, reason: 'insufficient_role' });
  });

  it('computes detailed student study-time metrics (today / 7d / 30d / total, skill share %, streak, 30d CSV) and renders rich detail view', () => {
    const fixedNow = new Date(2026, 10, 20, 21, 0, 0).getTime();
    const demo = createSugorokuDemoBundle(fixedNow);
    const mioMember = demo.members.find((m) => m.uid === 'stu_sato_mio')!;
    const mioLogs = demo.logsByUid.stu_sato_mio ?? [];
    const mioOverview = buildStudentOverview({
      member: mioMember,
      logs: mioLogs,
      assignments: demo.assignments,
      solvedByChapter: demo.solvedByUid.stu_sato_mio ?? {},
      nowMs: fixedNow,
    });

    const report = buildStudentDetailedTimeReport({
      uid: mioOverview.uid,
      logs: mioLogs,
      overview: mioOverview,
      nowMs: fixedNow,
    });

    expect(report.todaySeconds).toBe(2340);
    expect(report.weeklySeconds).toBeGreaterThan(0);
    expect(report.monthlySeconds).toBeGreaterThanOrEqual(report.weeklySeconds);
    expect(report.totalSeconds).toBeGreaterThanOrEqual(report.monthlySeconds);
    expect(report.daily30).toHaveLength(30);
    expect(report.currentStreakDays).toBeGreaterThanOrEqual(1);
    expect(report.skillShares.some((s) => s.skill === 'listening' && s.sharePct > 0)).toBe(true);

    const csv = buildStudentDetailedTimeCsv({
      rosterName: mioOverview.rosterName,
      targetGrade: mioOverview.targetGrade,
      report,
    });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('リスニング(分)');
    expect(csv).toContain('リーディング(分)');

    const html = renderToStaticMarkup(
      createElement(SugorokuStudentDetailView, {
        student: mioOverview,
        rawLogs: mioLogs,
        isDemoMode: false,
        onBack: () => {},
        onSaveProfile: () => {},
      }),
    );
    expect(html).toContain('student-time-kpi-grid');
    expect(html).toContain('本日の学習時間');
    expect(html).toContain('今週（直近7日）');
    expect(html).toContain('直近30日間');
    expect(html).toContain('累計有効学習時間');
    expect(html).toContain('分野別の学習時間・時間配分');
    expect(html).toContain('日別の学習ログ明細');
  });

  it('provides juku-first class creation modal, presets, invite URL/LINE message kit, and editable class settings UI', () => {
    expect(DEFAULT_CLASS_SUBJECT).toBe('eiken_2');
    // Firestore ルールで拒否される eiken_1 がクラス作成選択肢に混入しないこと
    expect(CLASSROOM_ALLOWED_SUBJECTS.some((s) => s.value === ('eiken_1' as never))).toBe(false);
    expect(CLASSROOM_ALLOWED_SUBJECTS[0]?.value).toBe('eiken_2');

    const modalHtml = renderToStaticMarkup(
      createElement(CreateClassModal, {
        schoolName: 'オンライン塾 すごろく',
        className: '英検2級 S-CBT突破コース',
        subject: 'eiken_2',
        creating: false,
        accent: '#3E9C93',
        onClose: () => {},
        onSubmit: () => {},
      }),
    );
    expect(modalHtml).toContain('新しいコース・クラスを開設');
    expect(modalHtml).toContain('学習塾・オンライン塾');
    expect(modalHtml).toContain('ワンタップ定番コース設定');
    expect(modalHtml).toContain('1日あたりの目標学習時間');
    expect(modalHtml).toContain('週の目標学習日数');
    expect(modalHtml).not.toContain('化学基礎');
    expect(modalHtml).not.toContain('〇〇県立〇〇高等学校');

    const emptyHtml = renderToStaticMarkup(
      createElement(EmptyState, {
        onCreate: () => {},
        onOpenSugorokuAdmin: () => {},
        accent: '#3E9C93',
      }),
    );
    expect(emptyHtml).toContain('最初のコース・クラスを開設しましょう');
    expect(emptyHtml).toContain('4技能添削・教材PDFポータルを開く');

    const sampleRoom: ClassroomDoc = {
      id: 'room_juku_1',
      teacherUid: 'owner_1',
      schoolName: 'オンライン塾 すごろく',
      className: '英検2級 S-CBT合格コース',
      joinCode: 'ACDEF2',
      subject: 'eiken_2',
      joinOpen: true,
      plan: 'juku',
    };
    const settings = normalizeClassSettings(
      {
        orgType: 'juku',
        dailyGoalMinutes: 30,
        weeklyGoalDays: 5,
        examSession: 'scbt_monthly',
        focusSkills: ['vocab', 'reading', 'listening', 'writing'],
        coachNote: '毎日30分コツコツ進めましょう！',
      },
      sampleRoom.id,
    );

    const inviteUrl = buildClassInviteUrl(sampleRoom.joinCode, 'https://manatobi-eiken.vercel.app');
    expect(inviteUrl).toBe('https://manatobi-eiken.vercel.app/?sugoroku_invite=ACDEF2');

    const inviteMsg = buildClassInviteMessage({
      room: sampleRoom,
      settings,
      origin: 'https://manatobi-eiken.vercel.app',
    });
    expect(inviteMsg).toContain('【オンライン塾 すごろく】');
    expect(inviteMsg).toContain('1日30分 × 週5日（週150分）');
    expect(inviteMsg).toContain(inviteUrl);
    expect(inviteMsg).toContain('広告完全非表示');

    const theme = subjectTheme('eiken_2');
    const studentsEmptyHtml = renderToStaticMarkup(
      createElement(StudentsTab, {
        students: [],
        aggregate: aggregateClass([]),
        loading: false,
        theme,
        activeClass: sampleRoom,
        classSettings: settings,
        copiedCode: '',
        editingUid: '',
        editingName: '',
        onCopyCode: () => {},
        onRefresh: () => {},
        onExportCsv: () => {},
        onStartEdit: () => {},
        onChangeEditingName: () => {},
        onSaveEdit: () => {},
        onCancelEdit: () => {},
      }),
    );
    expect(studentsEmptyHtml).toContain('招待URLをコピー');
    expect(studentsEmptyHtml).toContain('LINE・保護者案内文をコピー');
    expect(studentsEmptyHtml).toContain('塾生広告OFF');

    const classesHtml = renderToStaticMarkup(
      createElement(ClassesTab, {
        classrooms: [sampleRoom],
        activeClassId: sampleRoom.id,
        settingsMap: { [sampleRoom.id]: settings ?? createDefaultClassSettings(sampleRoom.id) },
        theme,
        copiedCode: '',
        onCopyCode: () => {},
        onToggleJoin: () => {},
        onEditRoom: () => {},
        onDeleteRoom: () => {},
      }),
    );
    expect(classesHtml).toContain('設定を編集');
    expect(classesHtml).toContain('LINE・保護者案内文コピー');

    // SugorokuAdminApp からも「デモ / 本番」スイッチやメールアドレス露出が消え、クラス管理導線が出ること
    const adminPortalHtml = renderToStaticMarkup(
      createElement(SugorokuAdminApp, {
        initialDataMode: 'demo',
        onOpenTeacherDashboard: () => {},
      }),
    );
    expect(adminPortalHtml).toContain('クラス管理・作成');
    expect(adminPortalHtml).not.toContain('sg-mode-pill');
    expect(adminPortalHtml).not.toContain('デモ表示');
  });

  it('keeps student orange Start flow completely isolated from Admin Login even after visiting admin screens', () => {
    expect(isAdminOnlyAppState('sugoroku_admin')).toBe(true);
    expect(isAdminOnlyAppState('teacher_dashboard')).toBe(true);
    expect(isAdminOnlyAppState('feedback_admin')).toBe(true);
    expect(isAdminOnlyAppState('onboarding')).toBe(false);
    expect(isAdminOnlyAppState('home')).toBe(false);

    const store = new Map<string, string>();
    const memoryStorage: Storage = {
      get length() {
        return store.size;
      },
      key(index: number) {
        return [...store.keys()][index] ?? null;
      },
      getItem(k: string) {
        return store.get(String(k)) ?? null;
      },
      setItem(k: string, v: string) {
        store.set(String(k), String(v));
      },
      removeItem(k: string) {
        store.delete(String(k));
      },
      clear() {
        store.clear();
      },
    };
    vi.stubGlobal('localStorage', memoryStorage);

    try {
      // 仮に localStorage に古い savedAppState = 'sugoroku_admin' / 'teacher_dashboard' が残っていても、
      // 起動時の restoreAppState は絶対に管理者画面を復元せず、通常の生徒導線（onboarding または home）に戻す
      safeSetItem(STORAGE_KEYS.appState, 'sugoroku_admin');
      safeRemoveItem(STORAGE_KEYS.hasCompletedOnboarding);
      expect(restoreAppState()).toBe('onboarding');

      safeSetItem(STORAGE_KEYS.appState, 'teacher_dashboard');
      safeSetItem(STORAGE_KEYS.hasCompletedOnboarding, 'true');
      expect(restoreAppState()).toBe('home');

      // 通常の学習画面（home / study など）は従来どおり復元される
      safeSetItem(STORAGE_KEYS.appState, 'study');
      expect(restoreAppState()).toBe('study');
    } finally {
      vi.unstubAllGlobals();
    }

    // 管理者ガード画面には「タイトルへ戻る」と「生徒用ログイン・学習画面へ進む」の両方が用意されていること
    const guardHtml = renderToStaticMarkup(
      createElement(
        SugorokuAdminGuard,
        {
          onBackToStudentApp: () => {},
          onSwitchToStudentApp: () => {},
        },
        createElement('div', null, 'SECRET_ADMIN_BODY'),
      ),
    );
    expect(guardHtml).not.toContain('SECRET_ADMIN_BODY');
    expect(guardHtml).toContain('タイトルへ戻る');
    expect(guardHtml).toContain('sugoroku-switch-to-student-btn');
  });
});
