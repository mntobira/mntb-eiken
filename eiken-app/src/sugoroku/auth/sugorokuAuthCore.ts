/**
 * すごろく塾 認可・ロール判定・プライバシー保護（純粋ロジック層）
 *
 * Firebase SDK に直接依存しない純粋関数として定義し、
 * 単体テストで全ロール・境界ケースを高速かつ確実に検証できるようにする。
 */

import type { SugorokuMemberDoc, SugorokuRole } from '../shared/types';
import { maskNickname, displayNicknameForNational } from '../../utils/nicknamePrivacy';
import { resolveRosterName, normalizeJoinCode, validateJoinCodeInput } from '../../utils/classroomCore';

/** Firestore コレクション名（firestoreMetered.ts 経由で eiken_ プレフィックスが付与される） */
export const SUGOROKU_MEMBERS_COLLECTION = 'sugoroku_members';

/** ローカルキャッシュキー接頭辞（オフライン起動時の即時 Ad-Free / ゲート判定用） */
export const SUGOROKU_MEMBER_CACHE_PREFIX = 'eiken:v1:sugoroku_member_';

/** すごろく塾ゲートモード（URLクエリまたは環境変数で有効化） */
export type SugorokuPortalMode = 'standard' | 'juku' | 'admin';

/**
 * URL クエリまたは環境変数からポータルモードを判定する。
 *   - ?portal=admin または VITE_SUGOROKU_PORTAL=admin → 'admin'（講師専用管理ポータル）
 *   - ?portal=sugoroku / ?portal=juku または VITE_SUGOROKU_PORTAL=sugoroku|juku → 'juku'（塾生専用ログイン＋招待コード必須ゲート）
 *   - それ以外 → 'standard'（既存マナトビ英検の標準モード）
 */
export function resolveSugorokuPortalMode(
  search: string | null | undefined,
  envPortal?: string | null,
): SugorokuPortalMode {
  try {
    const params = new URLSearchParams(search || '');
    const queryPortal = (params.get('portal') || params.get('sugoroku') || '').trim().toLowerCase();
    if (queryPortal === 'admin') return 'admin';
    if (queryPortal === 'sugoroku' || queryPortal === 'juku' || queryPortal === '1' || queryPortal === 'true') {
      return 'juku';
    }
  } catch {
    // URLSearchParams が失敗しても環境変数を見る
  }
  const envVal = String(envPortal || '').trim().toLowerCase();
  if (envVal === 'admin') return 'admin';
  if (envVal === 'sugoroku' || envVal === 'juku') return 'juku';
  return 'standard';
}

/**
 * 管理者ロール（owner / staff）かどうかを判定する。
 */
export function isSugorokuStaffRole(role: SugorokuRole | string | null | undefined): role is 'owner' | 'staff' {
  return role === 'owner' || role === 'staff';
}

/**
 * sugoroku_members/{uid} が有効な管理者（owner / staff）か判定する。
 */
export function isActiveSugorokuStaff(member: Pick<SugorokuMemberDoc, 'role' | 'active'> | null | undefined): boolean {
  if (!member || member.active !== true) return false;
  return isSugorokuStaffRole(member.role);
}

/**
 * 管理者ポータル（SugorokuAdminApp）への入場・閲覧権限があるか判定する。
 *
 * 『03_AI並列開発指示書』AI 4 タスク2:
 *   「sugoroku_members/{uid} の role in ['owner', 'staff'] またはクラス teacherUid のみが
 *    管理者ポータル・生徒実名（rosterName）・提出物を扱える認可ヘルパーを提供する。」
 */
export interface AdminAccessContext {
  uid: string | null | undefined;
  emailVerified?: boolean;
  providerIds?: readonly string[];
  memberDoc?: Pick<SugorokuMemberDoc, 'uid' | 'role' | 'active'> | null;
  /** 担当しているクラスの classId または teacherUid 一覧 */
  ownedClassTeacherUids?: readonly string[];
  ownedJukuClassIds?: readonly string[];
}

export interface AdminAccessDecision {
  allowed: boolean;
  reason:
    | 'allowed_staff_role'
    | 'allowed_class_teacher'
    | 'unauthenticated'
    | 'google_required'
    | 'email_unverified'
    | 'insufficient_role';
}

/**
 * Google アカウント（確認済みメール）で認証されているか判定する。
 * 学校配布 iPad の Google Workspace アカウントおよび個人 Gmail の双方を受け入れる。
 */
export function hasVerifiedGoogleIdentity(input: {
  uid?: string | null;
  emailVerified?: boolean;
  providerIds?: readonly string[];
} | null | undefined): boolean {
  if (!input?.uid) return false;
  if (input.emailVerified !== true) return false;
  if (!input.providerIds || input.providerIds.length === 0) return false;
  return input.providerIds.includes('google.com');
}

export function evaluateSugorokuAdminAccess(ctx: AdminAccessContext): AdminAccessDecision {
  const uid = (ctx.uid || '').trim();
  if (!uid) {
    return { allowed: false, reason: 'unauthenticated' };
  }
  if (ctx.providerIds && !ctx.providerIds.includes('google.com')) {
    return { allowed: false, reason: 'google_required' };
  }
  if (ctx.emailVerified === false) {
    return { allowed: false, reason: 'email_unverified' };
  }

  if (ctx.memberDoc && ctx.memberDoc.uid === uid && isActiveSugorokuStaff(ctx.memberDoc)) {
    return { allowed: true, reason: 'allowed_staff_role' };
  }

  const ownsClass =
    (Array.isArray(ctx.ownedJukuClassIds) && ctx.ownedJukuClassIds.length > 0) ||
    (Array.isArray(ctx.ownedClassTeacherUids) && ctx.ownedClassTeacherUids.includes(uid));

  if (ownsClass) {
    return { allowed: true, reason: 'allowed_class_teacher' };
  }

  return { allowed: false, reason: 'insufficient_role' };
}

/**
 * 特定のクラス（classId）の生徒実名（rosterName）や提出物（ライティング・スピーキング）に
 * アクセスできる講師かどうかを判定する。
 *   - そのクラスの担当講師（classroom.teacherUid === uid）
 *   - または sugoroku_members/{uid} が active かつ role in ['owner', 'staff']
 *     （ただし classIds が指定されている staff は担当 classId に含まれる場合のみ、owner は全塾クラス可）
 */
export function canManageSugorokuClass(params: {
  uid: string | null | undefined;
  classId: string;
  classTeacherUid?: string | null;
  classPlan?: 'free' | 'juku';
  memberDoc?: Pick<SugorokuMemberDoc, 'uid' | 'role' | 'active' | 'classIds'> | null;
}): boolean {
  const uid = (params.uid || '').trim();
  if (!uid || !params.classId) return false;

  if (params.classTeacherUid && params.classTeacherUid === uid) {
    return true;
  }

  const m = params.memberDoc;
  if (!m || m.uid !== uid || m.active !== true) return false;
  if (m.role === 'owner') return true;
  if (m.role === 'staff') {
    if (!m.classIds || m.classIds.length === 0) return true;
    return m.classIds.includes(params.classId);
  }
  return false;
}

/**
 * 生徒のデータを閲覧できるか判定する（本人 または 担当クラス講師 / 塾スタッフ）。
 */
export function canReadStudentSugorokuData(params: {
  viewerUid: string | null | undefined;
  studentUid: string;
  classId?: string;
  classTeacherUid?: string | null;
  hasStudyAccess?: boolean;
  viewerMemberDoc?: Pick<SugorokuMemberDoc, 'uid' | 'role' | 'active' | 'classIds'> | null;
}): boolean {
  const viewer = (params.viewerUid || '').trim();
  if (!viewer || !params.studentUid) return false;
  if (viewer === params.studentUid) return true;
  if (params.hasStudyAccess === true) return true;
  if (params.classId) {
    return canManageSugorokuClass({
      uid: viewer,
      classId: params.classId,
      classTeacherUid: params.classTeacherUid,
      memberDoc: params.viewerMemberDoc,
    });
  }
  return isActiveSugorokuStaff(params.viewerMemberDoc);
}

/**
 * 塾生として広告完全非表示（Ad-Free）を適用すべきか判定する。
 *   1. sugoroku_members/{uid} が active === true かつ adFree === true
 *   2. または plan === 'juku' のクラスに1つ以上在籍している
 */
export function shouldApplySugorokuAdFree(params: {
  uid: string | null | undefined;
  memberDoc?: Pick<SugorokuMemberDoc, 'active' | 'adFree'> | null;
  jukuClassCount?: number;
}): boolean {
  if (!params.uid) return false;
  if (params.memberDoc?.active === true && params.memberDoc?.adFree === true) {
    return true;
  }
  return (params.jukuClassCount ?? 0) > 0;
}

/**
 * 実名プライバシー保護ヘルパー：
 *   - 管理者画面（surface === 'admin'）かつ権限ありの場合のみ rosterName（実名）を返す
 *   - 一般公開面（surface === 'public' / ランキング等）では必ず nicknamePrivacy でマスクし、
 *     絶対に rosterName を露出しない
 */
export function formatStudentDisplayName(params: {
  surface: 'admin' | 'student_self' | 'public';
  canViewRosterName: boolean;
  isMe?: boolean;
  nickname: string;
  rosterName?: string | null;
}): string {
  if (params.surface === 'admin' && params.canViewRosterName) {
    return resolveRosterName({
      displayName: params.nickname,
      rosterName: params.rosterName ?? undefined,
    });
  }
  if (params.surface === 'student_self' && params.isMe) {
    return (params.nickname || '').trim() || '（名前未設定）';
  }
  // 公開面では rosterName を一切参照せず、ニックネームを部分マスクする
  return params.isMe
    ? displayNicknameForNational(params.nickname, true)
    : maskNickname(params.nickname);
}

/**
 * iPad Safari / iOS Safari などポップアップが標準ブロックされやすい端末か判定する。
 * ポップアップ失敗時のリダイレクト切替案内に使用する。
 */
export function isSafariOrIPadBrowser(userAgent?: string, maxTouchPoints?: number): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
  const touch = maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0);
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1);
  const isSafari = /Safari\//i.test(ua) && !/Chrome\/|CriOS\/|Chromium\/|Edg\/|OPR\//i.test(ua);
  return isIOS || isSafari;
}

/**
 * すごろく招待コード（クラス参加コード）の検証（見間違えやすい 0/O, 1/I を自動補正）。
 * 例: "SUGOROKU-AB23CD" のようなプレフィックス付き表記も後半6文字へ安全に正規化する。
 */
export function normalizeSugorokuInviteCode(rawInput: string): string {
  const trimmed = (rawInput || '').trim().toUpperCase();
  const strippedPrefix = trimmed.replace(/^(?:SUGOROKU|MNTB|JUKU)[\s\-_]+/i, '');
  return normalizeJoinCode(strippedPrefix);
}

export function validateSugorokuInviteCode(rawInput: string): { ok: boolean; code: string; message: string } {
  const normalized = normalizeSugorokuInviteCode(rawInput);
  return validateJoinCodeInput(normalized);
}

/**
 * ローカルストレージからキャッシュ済みの SugorokuMemberDoc を安全にパースする。
 */
export function parseCachedSugorokuMember(raw: string | null | undefined, expectedUid: string): SugorokuMemberDoc | null {
  if (!raw || !expectedUid) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SugorokuMemberDoc>;
    if (!parsed || parsed.uid !== expectedUid) return null;
    if (parsed.role !== 'owner' && parsed.role !== 'staff' && parsed.role !== 'student') return null;
    if (typeof parsed.active !== 'boolean') return null;
    return {
      uid: parsed.uid,
      role: parsed.role,
      active: parsed.active,
      adFree: parsed.adFree === true,
      targetGrade: parsed.targetGrade,
      classIds: Array.isArray(parsed.classIds) ? parsed.classIds.filter((c): c is string => typeof c === 'string') : undefined,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : undefined,
      consentAcceptedAt: typeof parsed.consentAcceptedAt === 'number' ? parsed.consentAcceptedAt : undefined,
    };
  } catch {
    return null;
  }
}
