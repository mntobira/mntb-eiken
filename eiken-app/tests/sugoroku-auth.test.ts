import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { User } from 'firebase/auth';
import {
  resolveSugorokuPortalMode,
  extractInviteCodeFromSearch,
  isSugorokuStaffRole,
  isActiveSugorokuStaff,
  isSuspendedSugorokuMember,
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
import { SugorokuGateScreen } from '../src/sugoroku/auth/SugorokuAuthGate';
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

  it('renders Manatobi-authentic SugorokuGateScreen for both unauthenticated and signed-in code states', () => {
    const step1Html = renderToStaticMarkup(
      createElement(SugorokuGateScreen, {
        user: null,
        loading: false,
        onlineReady: true,
        allowDemoBypass: false,
        onDemoBypass: () => {},
        onEnrolled: async () => {},
      }),
    );
    expect(step1Html).toContain('sugoroku-auth-gate');
    expect(step1Html).toContain('Google アカウントでログイン');
    expect(step1Html).toContain('広告 100% 完全非表示');
    expect(step1Html).toContain('data-tobira-buddy');

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
        allowDemoBypass: false,
        onDemoBypass: () => {},
        onEnrolled: async () => {},
      }),
    );
    expect(step2Html).toContain('sugoroku-invite-input');
    expect(step2Html).toContain('sga-code-slot');
    expect(step2Html).toContain('student01@school.ed.jp');
    expect(step2Html).toContain('英検2級');
    expect(step2Html).toContain('現在このアカウントの塾在籍が停止されています');
    expect(step2Html).toContain('公開ランキング等に本名は一切表示されません');
  });
});
