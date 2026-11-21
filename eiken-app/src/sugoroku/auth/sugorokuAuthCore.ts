/**
 * ===================================================================
 * すごろく塾 認可・ロール判定・プライバシー保護（純粋ロジック層）
 * ===================================================================
 * Firebase SDK に直接依存しない純粋関数として定義し、
 * 単体テストで全ロール・境界ケース・エッジケースを高速かつ確実に検証する。
 */

import {
  SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS,
  type SugorokuMemberDoc,
  type SugorokuRole,
} from '../shared/types';
import { isEikenGrade, type EikenGrade } from '../../eiken/config';
import { maskNickname, displayNicknameForNational } from '../../utils/nicknamePrivacy';
import {
  JOIN_CODE_LENGTH,
  resolveRosterName,
  normalizeJoinCode,
  validateJoinCodeInput,
} from '../../utils/classroomCore';

/** Firestore コレクション名（firestoreMetered.ts 経由で eiken_ プレフィックスが付与される） */
export const SUGOROKU_MEMBERS_COLLECTION = 'sugoroku_members';

/** ローカルキャッシュキー接頭辞（オフライン起動時の即時 Ad-Free / ゲート判定用） */
export const SUGOROKU_MEMBER_CACHE_PREFIX = 'eiken:v1:sugoroku_member_';

/** リダイレクトログイン前後のフォーム入力退避キー（sessionStorage） */
export const SUGOROKU_INVITE_DRAFT_KEY = 'eiken:v1:sugoroku_invite_draft';

/** すごろく塾ゲートモード（URLクエリまたは環境変数で有効化） */
export type SugorokuPortalMode = 'standard' | 'juku' | 'admin';

/**
 * URL クエリまたは環境変数からポータルモードを判定する。
 *   - ?portal=admin または VITE_SUGOROKU_PORTAL=admin → 'admin'（講師専用管理ポータル）
 *   - ?portal=sugoroku / ?portal=juku または ?invite=XXXXXX または VITE_SUGOROKU_PORTAL=sugoroku|juku → 'juku'
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
    // 招待リンク（?sugoroku_invite=AB23CD）から開いた場合も自動で塾生ゲートへ誘導
    if ((params.get('sugoroku_invite') || '').trim().length > 0) {
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
 * URL クエリ（?invite=AB23CD / ?code=AB23CD / ?sugoroku_invite=AB23CD）から
 * すごろく招待コードを安全に抽出・正規化する。
 */
export function extractInviteCodeFromSearch(search: string | null | undefined): string {
  try {
    const params = new URLSearchParams(search || '');
    const raw =
      params.get('sugoroku_invite') ||
      params.get('invite') ||
      params.get('code') ||
      '';
    if (!raw.trim()) return '';
    return normalizeSugorokuInviteCode(raw);
  } catch {
    return '';
  }
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
 * sugoroku_members/{uid} が明示的に退塾・停止（active === false）されているか判定する。
 */
export function isSuspendedSugorokuMember(member: Pick<SugorokuMemberDoc, 'active'> | null | undefined): boolean {
  return Boolean(member && member.active === false);
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
  email?: string | null;
  emailVerified?: boolean;
  providerIds?: readonly string[];
  memberDoc?: Pick<SugorokuMemberDoc, 'uid' | 'role' | 'active'> | null;
  /** 担当しているクラスの teacherUid 一覧または担当クラスID一覧 */
  ownedClassTeacherUids?: readonly string[];
  ownedJukuClassIds?: readonly string[];
  /**
   * true の場合、指定の事前承認済み管理者メールアドレス
   * （SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS + VITE_SUGOROKU_ADMIN_EMAILS）のみ入場を許可し、
   * それ以外のアカウント（一般教員・生徒・個人アカウント）はすべて遮断する。
   */
  strictSpecifiedEmailsOnly?: boolean;
}

export interface AdminAccessDecision {
  allowed: boolean;
  reason:
    | 'allowed_staff_role'
    | 'allowed_class_teacher'
    | 'allowed_preauthorized_email'
    | 'unauthenticated'
    | 'google_required'
    | 'email_unverified'
    | 'suspended_member'
    | 'insufficient_role';
}

/**
 * 環境変数（VITE_SUGOROKU_ADMIN_EMAILS）＋ 既定の事前承認講師メール一覧を返す。
 * AI 1 の firestoreAdminService.ts とも完全互換の関数シグネチャを維持する。
 */
export function getConfiguredSugorokuAdminEmails(envValue?: string | null): string[] {
  const rawEnv =
    envValue !== undefined
      ? envValue
      : (import.meta.env?.VITE_SUGOROKU_ADMIN_EMAILS as string | undefined);
  const custom = String(rawEnv || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS, ...custom]));
}

/**
 * 指定メールアドレスが事前承認済みの講師・オーナーメールに含まれるか判定する。
 */
export function isPreAuthorizedSugorokuInstructorEmail(
  email: string | null | undefined,
  envValue?: string | null,
): boolean {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return false;
  return getConfiguredSugorokuAdminEmails(envValue).includes(normalized);
}

/**
 * ログインユーザーが Google 確認済みメールで事前承認講師アカウントに該当するか判定する。
 * メール未確認（emailVerified !== true）のなりすましトークンは必ず拒否する。
 */
export function hasVerifiedPreAuthorizedInstructorEmail(
  input: {
    email?: string | null;
    emailVerified?: boolean;
    providerIds?: readonly string[];
  } | null | undefined,
  envValue?: string | null,
): boolean {
  if (!input) return false;
  if (input.emailVerified !== true) return false;
  if (input.providerIds && input.providerIds.length > 0 && !input.providerIds.includes('google.com')) {
    return false;
  }
  return isPreAuthorizedSugorokuInstructorEmail(input.email, envValue);
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

  // 明示的に active === false に停止されたアカウントは即時遮断
  if (ctx.memberDoc && ctx.memberDoc.uid === uid && ctx.memberDoc.active === false) {
    return { allowed: false, reason: 'suspended_member' };
  }

  // 厳格モード（管理者ログインゲート）：指定の事前承認済み管理者メール（hirokingz0927@gmail.com / mntobira@gmail.com）のみ通過させ、それ以外は必ずブロック
  if (ctx.strictSpecifiedEmailsOnly) {
    if (
      hasVerifiedPreAuthorizedInstructorEmail({
        email: ctx.email,
        emailVerified: ctx.emailVerified === true,
        providerIds: ctx.providerIds,
      })
    ) {
      return { allowed: true, reason: 'allowed_preauthorized_email' };
    }
    return { allowed: false, reason: 'insufficient_role' };
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

  // 初回講師ログイン対応：メール確認済みの事前承認講師（mntobira@gmail.com / hirokingz0927@gmail.com）
  if (
    hasVerifiedPreAuthorizedInstructorEmail({
      email: ctx.email,
      emailVerified: ctx.emailVerified === true,
      providerIds: ctx.providerIds,
    })
  ) {
    return { allowed: true, reason: 'allowed_preauthorized_email' };
  }

  return { allowed: false, reason: 'insufficient_role' };
}

/**
 * 管理者拒否理由コードを日本語の分かりやすい診断ラベルへ変換する。
 */
export function describeAdminDenyReason(reason: AdminAccessDecision['reason']): string {
  switch (reason) {
    case 'unauthenticated':
      return '未ログイン状態です。管理者用の Google アカウントでログインしてください。';
    case 'google_required':
      return 'Google アカウントでのログインが必要です。';
    case 'email_unverified':
      return 'Google アカウントのメールアドレス確認が完了していません。';
    case 'suspended_member':
      return 'このアカウントの管理者権限は現在停止されています。';
    case 'insufficient_role':
      return 'このアカウントでは管理者画面に入れません。指定された管理者用 Google アカウントでログインしてください。';
    default:
      return '';
  }
}

/**
 * 特定のクラス（classId）の生徒実名（rosterName）や提出物（ライティング・スピーキング）に
 * アクセスできる講師かどうかを判定する。
 */
export function canManageSugorokuClass(params: {
  uid: string | null | undefined;
  email?: string | null;
  emailVerified?: boolean;
  classId: string;
  classTeacherUid?: string | null;
  classPlan?: 'free' | 'juku';
  memberDoc?: Pick<SugorokuMemberDoc, 'uid' | 'role' | 'active' | 'classIds'> | null;
}): boolean {
  const uid = (params.uid || '').trim();
  if (!uid || !params.classId) return false;

  // 明示的に停止されたスタッフはクラス管理も不可
  if (params.memberDoc && params.memberDoc.uid === uid && params.memberDoc.active === false) {
    return false;
  }

  if (params.classTeacherUid && params.classTeacherUid === uid) {
    return true;
  }

  if (
    hasVerifiedPreAuthorizedInstructorEmail({
      email: params.email,
      emailVerified: params.emailVerified === true,
    })
  ) {
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
  viewerEmail?: string | null;
  viewerEmailVerified?: boolean;
  studentUid: string;
  classId?: string;
  classTeacherUid?: string | null;
  hasStudyAccess?: boolean;
  viewerMemberDoc?: Pick<SugorokuMemberDoc, 'uid' | 'role' | 'active' | 'classIds'> | null;
}): boolean {
  const viewer = (params.viewerUid || '').trim();
  if (!viewer || !params.studentUid) return false;
  if (viewer === params.studentUid) return true;
  if (params.viewerMemberDoc && params.viewerMemberDoc.uid === viewer && params.viewerMemberDoc.active === false) {
    return false;
  }
  if (params.hasStudyAccess === true) return true;
  if (
    hasVerifiedPreAuthorizedInstructorEmail({
      email: params.viewerEmail,
      emailVerified: params.viewerEmailVerified === true,
    })
  ) {
    return true;
  }
  if (params.classId) {
    return canManageSugorokuClass({
      uid: viewer,
      email: params.viewerEmail,
      emailVerified: params.viewerEmailVerified,
      classId: params.classId,
      classTeacherUid: params.classTeacherUid,
      memberDoc: params.viewerMemberDoc,
    });
  }
  return isActiveSugorokuStaff(params.viewerMemberDoc);
}

/**
 * 塾生として広告完全非表示（Ad-Free）を適用すべきか判定する。
 *   - sugoroku_members/{uid} が明示的に active === false（退塾・停止）の場合は必ず false（残留キャッシュによる不正利用防止）
 *   - sugoroku_members/{uid} が active === true かつ adFree === true なら true
 *   - または plan === 'juku' のクラスに1つ以上在籍していれば true
 */
export function shouldApplySugorokuAdFree(params: {
  uid: string | null | undefined;
  memberDoc?: Pick<SugorokuMemberDoc, 'active' | 'adFree'> | null;
  jukuClassCount?: number;
}): boolean {
  if (!params.uid) return false;
  if (params.memberDoc && params.memberDoc.active === false) {
    return false;
  }
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
 */
export function isSafariOrIPadBrowser(userAgent?: string, maxTouchPoints?: number): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
  const touch = maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0);
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1);
  const isSafari = /Safari\//i.test(ua) && !/Chrome\/|CriOS\/|Chromium\/|Edg\/|OPR\//i.test(ua);
  return isIOS || isSafari;
}

/**
 * 全角英数字・全角ハイフン・空白を半角英数字へ正規化する（iPad 日本語かなキーボード対策）。
 */
export function toHalfWidthAlphanumeric(input: string): string {
  return (input || '')
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[ー−―‐－_　\s]+/g, '-');
}

/**
 * すごろく招待コード（クラス参加コード）の正規化：
 *   - 全角英数字 → 半角大文字へ自動変換
 *   - "SUGOROKU-AB23CD" 等のプレフィックスを自動除去
 *   - 見間違えやすい 0→O, 1→I を自動補正し最大6文字に揃える
 */
export function normalizeSugorokuInviteCode(rawInput: string): string {
  const half = toHalfWidthAlphanumeric(rawInput).replace(/^-+|-+$/g, '').toUpperCase();
  const strippedPrefix = half.replace(/^(?:SUGOROKU|MNTB|JUKU)-+/i, '');
  const compact = strippedPrefix.replace(/[^A-Z0-9]/g, '');
  return normalizeJoinCode(compact).slice(0, JOIN_CODE_LENGTH);
}

export function validateSugorokuInviteCode(rawInput: string): { ok: boolean; code: string; message: string } {
  const normalized = normalizeSugorokuInviteCode(rawInput);
  return validateJoinCodeInput(normalized);
}

/**
 * リダイレクトログイン前後で保持する招待コード入力ドラフトの検証付きシリアライズ。
 */
export interface SugorokuInviteDraft {
  inviteCode: string;
  displayName: string;
  targetGrade: EikenGrade;
  consentAccepted: boolean;
}

export function parseSugorokuInviteDraft(raw: string | null | undefined): SugorokuInviteDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SugorokuInviteDraft>;
    if (!parsed || typeof parsed !== 'object') return null;
    const inviteCode = typeof parsed.inviteCode === 'string' ? normalizeSugorokuInviteCode(parsed.inviteCode) : '';
    const displayName = typeof parsed.displayName === 'string' ? parsed.displayName.slice(0, 24) : '';
    const targetGrade: EikenGrade = isEikenGrade(parsed.targetGrade) ? parsed.targetGrade : 'eiken_2';
    const consentAccepted = parsed.consentAccepted === true;
    return { inviteCode, displayName, targetGrade, consentAccepted };
  } catch {
    return null;
  }
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
      targetGrade: isEikenGrade(parsed.targetGrade) ? parsed.targetGrade : 'eiken_2',
      classId: typeof parsed.classId === 'string' ? parsed.classId : undefined,
      classIds: Array.isArray(parsed.classIds) ? parsed.classIds.filter((c): c is string => typeof c === 'string') : undefined,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : undefined,
      consentAcceptedAt: typeof parsed.consentAcceptedAt === 'number' ? parsed.consentAcceptedAt : undefined,
    };
  } catch {
    return null;
  }
}
