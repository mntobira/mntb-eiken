import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  resolveSugorokuPortalMode,
  isSugorokuStaffRole,
  isActiveSugorokuStaff,
  hasVerifiedGoogleIdentity,
  evaluateSugorokuAdminAccess,
  canManageSugorokuClass,
  canReadStudentSugorokuData,
  shouldApplySugorokuAdFree,
  formatStudentDisplayName,
  isSafariOrIPadBrowser,
  normalizeSugorokuInviteCode,
  validateSugorokuInviteCode,
  parseCachedSugorokuMember,
} from '../src/sugoroku/auth/sugorokuAuthCore';
import { SugorokuGateScreen } from '../src/sugoroku/auth/SugorokuAuthGate';
import { isAdFree, setAdFree } from '../src/ads/adFree';

describe('sugoroku/auth core logic (AI 4)', () => {
  beforeEach(() => {
    setAdFree(false);
  });

  it('resolves portal mode from URL query and environment variable', () => {
    expect(resolveSugorokuPortalMode('?portal=admin', undefined)).toBe('admin');
    expect(resolveSugorokuPortalMode('?portal=sugoroku', undefined)).toBe('juku');
    expect(resolveSugorokuPortalMode('?portal=juku', undefined)).toBe('juku');
    expect(resolveSugorokuPortalMode('?sugoroku=1', undefined)).toBe('juku');
    expect(resolveSugorokuPortalMode('', 'admin')).toBe('admin');
    expect(resolveSugorokuPortalMode('', 'sugoroku')).toBe('juku');
    expect(resolveSugorokuPortalMode('', undefined)).toBe('standard');
  });

  it('validates and normalizes Sugoroku invite codes including 0->O, 1->I and prefixes', () => {
    // 有効な6文字コード（ACDEFGHJKMNPQRSTWXYZ2345679）
    expect(normalizeSugorokuInviteCode('sugoroku-acdef2')).toBe('ACDEF2');
    expect(normalizeSugorokuInviteCode(' mntb_gh-jkm3 ')).toBe('GHJKM3');
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
    // iPadOS 13+ desktop-class UA (Macintosh + touch points > 1)
    expect(
      isSafariOrIPadBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        5,
      ),
    ).toBe(true);
    // Windows Chrome should not be flagged as Safari/iPad
    expect(
      isSafariOrIPadBrowser(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        0,
      ),
    ).toBe(false);
  });

  it('enforces strict Google identity and owner/staff/teacher admin guard rules', () => {
    expect(isSugorokuStaffRole('owner')).toBe(true);
    expect(isSugorokuStaffRole('staff')).toBe(true);
    expect(isSugorokuStaffRole('student')).toBe(false);
    expect(isActiveSugorokuStaff({ role: 'staff', active: false })).toBe(false);
    expect(isActiveSugorokuStaff({ role: 'staff', active: true })).toBe(true);

    expect(
      hasVerifiedGoogleIdentity({ uid: 'u1', emailVerified: true, providerIds: ['google.com'] }),
    ).toBe(true);
    expect(
      hasVerifiedGoogleIdentity({ uid: 'u1', emailVerified: false, providerIds: ['google.com'] }),
    ).toBe(false);
    expect(
      hasVerifiedGoogleIdentity({ uid: 'u1', emailVerified: true, providerIds: ['password'] }),
    ).toBe(false);

    // Unauthenticated
    expect(evaluateSugorokuAdminAccess({ uid: null }).allowed).toBe(false);
    expect(evaluateSugorokuAdminAccess({ uid: null }).reason).toBe('unauthenticated');

    // Non-Google provider
    expect(
      evaluateSugorokuAdminAccess({
        uid: 'u1',
        emailVerified: true,
        providerIds: ['apple.com'],
      }),
    ).toEqual({ allowed: false, reason: 'google_required' });

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
    // Assigned teacherUid
    expect(
      canManageSugorokuClass({
        uid: 'teacher_a',
        classId: 'class_a',
        classTeacherUid: 'teacher_a',
      }),
    ).toBe(true);

    // Other class teacher denied
    expect(
      canManageSugorokuClass({
        uid: 'teacher_b',
        classId: 'class_a',
        classTeacherUid: 'teacher_a',
      }),
    ).toBe(false);

    // Scoped staff: allowed on class_a, denied on class_b
    const staffDoc = { uid: 'staff_a', role: 'staff' as const, active: true, classIds: ['class_a'] };
    expect(canManageSugorokuClass({ uid: 'staff_a', classId: 'class_a', memberDoc: staffDoc })).toBe(true);
    expect(canManageSugorokuClass({ uid: 'staff_a', classId: 'class_b', memberDoc: staffDoc })).toBe(false);

    // Owner: allowed on any juku class
    const ownerDoc = { uid: 'owner_1', role: 'owner' as const, active: true };
    expect(canManageSugorokuClass({ uid: 'owner_1', classId: 'class_b', memberDoc: ownerDoc })).toBe(true);

    // Student data read access
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

  it('applies Ad-Free for active Sugoroku juku members and hides real roster names on public surfaces', () => {
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
    expect(publicName).toBe('た＊＊');
  });

  it('safely parses cached Sugoroku member records and rejects tampered uid/role', () => {
    const validRaw = JSON.stringify({
      uid: 'u1',
      role: 'student',
      active: true,
      adFree: true,
      targetGrade: 'eiken_2',
      classIds: ['class_a'],
    });
    expect(parseCachedSugorokuMember(validRaw, 'u1')?.adFree).toBe(true);
    expect(parseCachedSugorokuMember(validRaw, 'other_uid')).toBeNull();
    expect(parseCachedSugorokuMember('{"uid":"u1","role":"superadmin","active":true}', 'u1')).toBeNull();
    expect(parseCachedSugorokuMember('{broken_json', 'u1')).toBeNull();
  });

  it('renders SugorokuGateScreen login step and invite step without runtime error', () => {
    const loginHtml = renderToStaticMarkup(
      createElement(SugorokuGateScreen, {
        user: null,
        loading: false,
        onlineReady: true,
        allowDemoBypass: false,
        onDemoBypass: () => {},
        onEnrolled: async () => {},
      }),
    );
    expect(loginHtml).toContain('マナトビ英検 塾生ゲート');
    expect(loginHtml).toContain('Google アカウントでログイン');

    const inviteHtml = renderToStaticMarkup(
      createElement(SugorokuGateScreen, {
        user: { uid: 'student_a', email: 'student@school.ed.jp', displayName: 'たくみ' } as never,
        loading: false,
        onlineReady: true,
        allowDemoBypass: false,
        onDemoBypass: () => {},
        onEnrolled: async () => {},
      }),
    );
    expect(inviteHtml).toContain('すごろく招待コード');
    expect(inviteHtml).toContain('広告完全非表示');
    expect(inviteHtml).toContain('student@school.ed.jp');
  });
});
