/**
 * ===================================================================
 * すごろく塾 認証・招待コード承認・ロール判定・Ad-Free 連動の Firestore サービス層
 * ===================================================================
 * 既存の:
 *   - utils/googleAuth.ts（signInWithGoogle / consumeGoogleRedirectResult / isInAppBrowser）
 *   - authDomainPolicy.ts（shouldUseSameOriginAuth）
 *   - utils/classroom.ts（joinClassroomByCode / fetchMyMembershipDetails / fetchMyClassrooms）
 *   - ads/adFree.ts ＆ utils/classAssignments.ts（saveJukuMemberships / setAdFree）
 * を活用し、学校 iPad Safari ポップアップ制限のリダイレクト切替対応を含む
 * Googleログイン導線・招待コード参加・sugoroku_members デュアル同期・管理者ロール判定を提供する。
 */

import {
  browserPopupRedirectResolver,
  signInWithRedirect,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from '../../utils/firestoreMetered';
import {
  auth,
  db,
  provider,
  FIREBASE_CONFIGURED,
  USE_EMULATORS,
  AUTH_SAME_ORIGIN_ACTIVE,
} from '../../firebase';
import { shouldUseSameOriginAuth } from '../../authDomainPolicy';
import {
  signInWithGoogle,
  consumeGoogleRedirectResult,
  signOutGoogle,
  describeAuthError,
  isInAppBrowser,
  type GoogleSignInOutcome,
} from '../../utils/googleAuth';
import {
  joinClassroomByCode,
  fetchMyMembershipDetails,
  fetchMyClassrooms,
  createClassroom,
  CLASSROOMS_COLLECTION,
  type JoinResult,
  type MembershipDetail,
} from '../../utils/classroom';
import type { ClassroomDoc, ClassroomInput } from '../../utils/classroomCore';
import { loadJukuMemberships, saveJukuMemberships } from '../../utils/classAssignments';
import { setAdFree } from '../../ads/adFree';
import { safeGetItem, safeRemoveItem } from '../../utils/safeLocalStorage';
import { safeSetItem } from '../../utils/storageGuard';
import { isEikenGrade, type EikenGrade } from '../../eiken/config';
import { SUGOROKU_COLLECTIONS, type SugorokuMemberDoc } from '../shared/types';
import { purgeUserChatLocalCache } from '../chat/chatStore';
import {
  SUGOROKU_INVITE_DRAFT_KEY,
  SUGOROKU_MEMBERS_COLLECTION,
  SUGOROKU_MEMBER_CACHE_PREFIX,
  evaluateSugorokuAdminAccess,
  hasVerifiedPreAuthorizedInstructorEmail,
  isSafariOrIPadBrowser,
  isSuspendedSugorokuMember,
  normalizeSugorokuInviteCode,
  parseCachedSugorokuMember,
  parseSugorokuInviteDraft,
  shouldApplySugorokuAdFree,
  validateSugorokuInviteCode,
  type AdminAccessDecision,
  type SugorokuInviteDraft,
} from './sugorokuAuthCore';

function memberCacheKey(uid: string): string {
  return `${SUGOROKU_MEMBER_CACHE_PREFIX}${uid}`;
}

export function loadCachedSugorokuMember(uid: string | null | undefined): SugorokuMemberDoc | null {
  if (!uid) return null;
  return parseCachedSugorokuMember(safeGetItem(memberCacheKey(uid)), uid);
}

export function saveCachedSugorokuMember(member: SugorokuMemberDoc | null, uid?: string): void {
  const targetUid = member?.uid || uid || '';
  if (!targetUid) return;
  if (!member) {
    safeRemoveItem(memberCacheKey(targetUid));
    return;
  }
  safeSetItem(
    memberCacheKey(targetUid),
    JSON.stringify({
      uid: member.uid,
      role: member.role,
      active: member.active,
      adFree: member.adFree === true,
      targetGrade: member.targetGrade,
      classId: member.classId,
      classIds: member.classIds,
      displayName: member.displayName,
      consentAcceptedAt: member.consentAcceptedAt,
    }),
  );
}

/**
 * リダイレクトログインを挟んでも招待コード・ニックネーム入力を失わないための sessionStorage 退避。
 */
export function saveSugorokuInviteDraft(draft: SugorokuInviteDraft): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SUGOROKU_INVITE_DRAFT_KEY, JSON.stringify(draft));
    }
  } catch {
    // Safari プライベートモード等で失敗しても無視
  }
}

export function loadSugorokuInviteDraft(): SugorokuInviteDraft | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return parseSugorokuInviteDraft(sessionStorage.getItem(SUGOROKU_INVITE_DRAFT_KEY));
  } catch {
    return null;
  }
}

export function clearSugorokuInviteDraft(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SUGOROKU_INVITE_DRAFT_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * 現在の環境でリダイレクトログインへの切り替えが安全に動作するか判定する。
 */
export function canUseSugorokuRedirectSignIn(): boolean {
  if (AUTH_SAME_ORIGIN_ACTIVE || USE_EMULATORS) return true;
  if (typeof window === 'undefined') return false;
  const env = import.meta.env as Record<string, string | undefined>;
  return shouldUseSameOriginAuth(
    {
      sameOrigin: env.VITE_EIKEN_AUTH_SAME_ORIGIN,
      appleReady: env.VITE_EIKEN_AUTH_SAME_ORIGIN_APPLE_READY ?? 'true',
    },
    window.location,
    false,
  );
}

export interface SugorokuSignInResult extends GoogleSignInOutcome {
  popupBlockedOnSafari?: boolean;
  canSwitchToRedirect?: boolean;
}

/**
 * すごろく塾向け Google ログイン。
 *   1. 標準のポップアップ方式（signInWithGoogle）を試行
 *   2. 学校配布 iPad Safari 等でポップアップがブロックされた場合:
 *      - autoRedirectOnBlock=true かつリダイレクト可能な環境では自動的に signInWithRedirect へ切替
 *      - それ以外は「リダイレクト方式でログインする」ボタンとポップアップ許可手順を明示返却
 */
export async function signInSugorokuWithGoogle(options: {
  forceRedirect?: boolean;
  autoRedirectOnBlock?: boolean;
} = {}): Promise<SugorokuSignInResult> {
  if (!FIREBASE_CONFIGURED && !USE_EMULATORS) {
    return {
      ok: false,
      message:
        '現在この配信URLではクラウド認証が有効化されていません。本番URL（mntb-eiken.vercel.app）からアクセスしてください。',
      errorCode: 'firebase_unconfigured',
    };
  }

  if (isInAppBrowser()) {
    return {
      ok: false,
      message:
        'LINE や Instagram などのアプリ内ブラウザでは Google ログインが利用できません。右上のメニューから「ブラウザで開く」を選び、Safari または Chrome で開き直してください。',
      errorCode: 'in_app_browser',
    };
  }

  if (options.forceRedirect) {
    return triggerGoogleRedirectSignIn();
  }

  const outcome = await signInWithGoogle();
  if (outcome.ok || outcome.redirecting || outcome.cancelled) {
    return outcome;
  }

  const code = String(outcome.errorCode || '');
  const isBlocked =
    code.includes('popup-blocked') ||
    code.includes('operation-not-supported') ||
    code.includes('web-storage-unsupported');

  const safariLike = isSafariOrIPadBrowser();
  const redirectReady = canUseSugorokuRedirectSignIn();

  if (isBlocked && options.autoRedirectOnBlock && redirectReady) {
    return triggerGoogleRedirectSignIn();
  }

  return {
    ...outcome,
    popupBlockedOnSafari: isBlocked || safariLike,
    canSwitchToRedirect: isBlocked,
  };
}

/**
 * 学校 iPad Safari 等でポップアップがブロックされた際のリダイレクトログイン実行。
 */
export async function triggerGoogleRedirectSignIn(): Promise<SugorokuSignInResult> {
  if (!FIREBASE_CONFIGURED && !USE_EMULATORS) {
    return {
      ok: false,
      message: 'クラウド認証が未設定です。',
      errorCode: 'firebase_unconfigured',
    };
  }
  try {
    const started = signInWithRedirect(auth, provider, browserPopupRedirectResolver).then(
      () => ({ kind: 'started' as const }),
      (err: unknown) => ({ kind: 'failed' as const, err }),
    );
    const grace = new Promise<{ kind: 'pending' }>((resolve) => {
      setTimeout(() => resolve({ kind: 'pending' }), 1500);
    });
    const raced = await Promise.race([started, grace]);
    if (raced.kind === 'failed') {
      return {
        ok: false,
        message: describeAuthError(raced.err),
        errorCode: 'redirect_start_failed',
      };
    }
    return { ok: false, redirecting: true };
  } catch (error) {
    return {
      ok: false,
      message: describeAuthError(error),
      errorCode: 'redirect_start_failed',
    };
  }
}

export { consumeGoogleRedirectResult, signOutGoogle };

/**
 * 塾の共有iPad・学校の共有PCでログアウトまたはアカウント切替が行われた際、
 * 端末内に残る前の利用者の機密キャッシュ（チャット履歴・提出作文下書き・講師名簿キャッシュ）を完全消去する。
 */
export function purgeSugorokuSensitiveLocalCache(uid?: string | null): void {
  const targetUid = (uid || auth.currentUser?.uid || '').trim();
  if (targetUid) {
    saveCachedSugorokuMember(null, targetUid);
    purgeUserChatLocalCache(targetUid);
  }
  safeRemoveItem('eiken:v1:sugoroku_staff_invites');
  safeRemoveItem('sugoroku_writing_submissions_v1');
  safeRemoveItem('sugoroku_speaking_submissions_v1');
}

/**
 * Firestore から sugoroku_members/{uid} を取得し、ローカルキャッシュも更新する。
 */
export async function fetchSugorokuMemberDoc(uid?: string): Promise<SugorokuMemberDoc | null> {
  const targetUid = uid || auth.currentUser?.uid || '';
  if (!targetUid) return null;
  if (!FIREBASE_CONFIGURED && !USE_EMULATORS) {
    return loadCachedSugorokuMember(targetUid);
  }
  try {
    const snap = await getDoc(doc(db, SUGOROKU_MEMBERS_COLLECTION, targetUid));
    if (!snap.exists()) {
      saveCachedSugorokuMember(null, targetUid);
      return null;
    }
    const data = snap.data() as SugorokuMemberDoc;
    const normalized: SugorokuMemberDoc = {
      ...data,
      uid: targetUid,
      targetGrade: isEikenGrade(data.targetGrade) ? data.targetGrade : 'eiken_2',
      active: data.active === true,
      adFree: data.adFree === true,
    };
    saveCachedSugorokuMember(normalized, targetUid);
    return normalized;
  } catch {
    return loadCachedSugorokuMember(targetUid);
  }
}

/**
 * 塾生の在籍状態（class_members の plan==='juku' クラス ＋ sugoroku_members/{uid}）を同期し、
 * 有料塾生であれば広告完全非表示（setAdFree(true) + saveJukuMemberships）を確実に適用する。
 * 退塾・停止（active === false）されている場合は即座に Ad-Free を解除して再認証を求める。
 */
export interface SugorokuEnrollmentStatus {
  uid: string;
  isEnrolledInJuku: boolean;
  isSuspended: boolean;
  adFreeApplied: boolean;
  memberDoc: SugorokuMemberDoc | null;
  jukuMemberships: MembershipDetail[];
  allMemberships: MembershipDetail[];
}

/**
 * 事前承認済み講師アカウント（mntobira@gmail.com / hirokingz0927@gmail.com 等）が
 * 初回ログインした際、手動の Firebase コンソール投入を待たずに
 * sugoroku_members/{uid}（role: 'owner', active: true, adFree: true）を自動ブートストラップする。
 *
 * ※ 明示的に active === false に停止されている場合は絶対に上書きしない。
 */
export async function ensurePreAuthorizedInstructorMember(
  user?: User | null,
  existingMember?: SugorokuMemberDoc | null,
): Promise<SugorokuMemberDoc | null> {
  const currentUser = user ?? auth.currentUser;
  if (!currentUser?.uid) return existingMember ?? null;

  const providerIds = (currentUser.providerData || []).map((p) => p.providerId);
  const isPreAuthorized = hasVerifiedPreAuthorizedInstructorEmail({
    email: currentUser.email,
    emailVerified: currentUser.emailVerified,
    providerIds,
  });

  if (!isPreAuthorized) {
    return existingMember ?? null;
  }

  // 既に停止済みなら上書き禁止
  if (existingMember && existingMember.active === false) {
    return existingMember;
  }

  // 既に active な owner / staff ならそのまま返す
  if (
    existingMember &&
    existingMember.active === true &&
    (existingMember.role === 'owner' || existingMember.role === 'staff')
  ) {
    return existingMember;
  }

  const normalizedEmail = (currentUser.email || '').trim().toLowerCase();
  const safeDisplayName = (existingMember?.displayName || currentUser.displayName || '')
    .trim()
    .slice(0, 32);
  const nowMs = Date.now();

  const bootstrapped: SugorokuMemberDoc = {
    ...(existingMember ?? {}),
    uid: currentUser.uid,
    role: 'owner',
    targetGrade: existingMember?.targetGrade ?? 'eiken_2',
    active: true,
    adFree: true,
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    ...(safeDisplayName ? { displayName: safeDisplayName } : {}),
    updatedAt: nowMs,
  };

  if (FIREBASE_CONFIGURED || USE_EMULATORS) {
    try {
      await setDoc(
        doc(db, SUGOROKU_MEMBERS_COLLECTION, currentUser.uid),
        {
          uid: currentUser.uid,
          role: 'owner',
          active: true,
          adFree: true,
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
          ...(safeDisplayName ? { displayName: safeDisplayName } : {}),
          ...(existingMember?.classIds ? { classIds: existingMember.classIds } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch {
      // ルール未反映環境等でもインメモリ＆ローカルキャッシュで即時講師ログインを成立させる
    }
  }

  saveCachedSugorokuMember(bootstrapped, currentUser.uid);
  return bootstrapped;
}

export async function refreshSugorokuEnrollmentAndAdFree(user?: User | null): Promise<SugorokuEnrollmentStatus> {
  const currentUser = user ?? auth.currentUser;
  const uid = currentUser?.uid || '';
  if (!uid) {
    setAdFree(false);
    return {
      uid: '',
      isEnrolledInJuku: false,
      isSuspended: false,
      adFreeApplied: false,
      memberDoc: null,
      jukuMemberships: [],
      allMemberships: [],
    };
  }

  // まずローカルキャッシュから即時反映（一瞬でも広告が出るのを防ぐ）
  const cachedMember = loadCachedSugorokuMember(uid);
  const cachedJuku = loadJukuMemberships(uid);
  if (shouldApplySugorokuAdFree({ uid, memberDoc: cachedMember, jukuClassCount: cachedJuku.length })) {
    setAdFree(true);
  }

  if (!FIREBASE_CONFIGURED && !USE_EMULATORS) {
    const bootstrappedOffline = await ensurePreAuthorizedInstructorMember(currentUser, cachedMember);
    const suspended = isSuspendedSugorokuMember(bootstrappedOffline);
    const adFreeNow = shouldApplySugorokuAdFree({
      uid,
      memberDoc: bootstrappedOffline,
      jukuClassCount: cachedJuku.length,
    });
    setAdFree(adFreeNow);
    return {
      uid,
      isEnrolledInJuku: !suspended && (Boolean(bootstrappedOffline?.active) || cachedJuku.length > 0),
      isSuspended: suspended,
      adFreeApplied: adFreeNow,
      memberDoc: bootstrappedOffline,
      jukuMemberships: [],
      allMemberships: [],
    };
  }

  const [fetchedMember, allMemberships] = await Promise.all([
    fetchSugorokuMemberDoc(uid),
    fetchMyMembershipDetails().catch(() => [] as MembershipDetail[]),
  ]);

  const memberDoc = await ensurePreAuthorizedInstructorMember(currentUser, fetchedMember);

  const suspended = isSuspendedSugorokuMember(memberDoc);
  const jukuMemberships = suspended ? [] : allMemberships.filter((m) => m.plan === 'juku');

  // 既存の useJukuAdFree / classAssignments とも完全連動させる（退塾時は空配列でクリア）
  saveJukuMemberships(
    uid,
    jukuMemberships.map((r) => ({
      classId: r.classId,
      teacherUid: r.teacherUid,
      className: r.className,
      subject: r.subject,
    })),
  );

  const adFreeApplied = shouldApplySugorokuAdFree({
    uid,
    memberDoc,
    jukuClassCount: jukuMemberships.length,
  });
  setAdFree(adFreeApplied);

  const isEnrolledInJuku =
    !suspended && ((memberDoc?.active === true) || jukuMemberships.length > 0);

  return {
    uid,
    isEnrolledInJuku,
    isSuspended: suspended,
    adFreeApplied,
    memberDoc,
    jukuMemberships,
    allMemberships,
  };
}

/**
 * 初回「すごろく招待コード（クラス参加コード）」入力・同意承認を実行する。
 *   1. コード検証（6文字、全角英数・O/0・I/1 自動補正）
 *   2. 同意フラグ確認
 *   3. joinClassroomByCode により class_members / study_access を作成
 *   4. 参加先クラスが plan === 'juku' の場合:
 *      - ルート sugoroku_members/{uid} を作成/更新
 *      - クラス別サブコレ classrooms/{classId}/sugoroku_members/{uid} にも同期（AI 1 管理ポータル即時表示用）
 *   5. 即座に Ad-Free を有効化し、入力ドラフトをクリア
 */
export interface RedeemSugorokuInviteInput {
  rawCode: string;
  displayName: string;
  targetGrade?: EikenGrade;
  consentAccepted: boolean;
}

export interface RedeemSugorokuInviteResult {
  joinResult: JoinResult;
  memberDoc: SugorokuMemberDoc | null;
  adFreeApplied: boolean;
}

export async function redeemSugorokuInviteCode(
  input: RedeemSugorokuInviteInput,
): Promise<RedeemSugorokuInviteResult> {
  const user = auth.currentUser;
  if (!user?.uid) {
    throw new Error('先に Google アカウントでログインしてください。');
  }
  if (!input.consentAccepted) {
    throw new Error('学習記録・提出答案を担当講師へ共有することへの同意チェックが必要です。');
  }

  const codeCheck = validateSugorokuInviteCode(input.rawCode);
  if (!codeCheck.ok) {
    throw new Error(codeCheck.message);
  }
  const normalizedCode = normalizeSugorokuInviteCode(input.rawCode);
  const safeDisplayName = (input.displayName || user.displayName || '').trim().slice(0, 24);

  const joinResult = await joinClassroomByCode(normalizedCode, safeDisplayName);
  const classroom = joinResult.classroom;
  const targetGrade: EikenGrade = isEikenGrade(input.targetGrade)
    ? input.targetGrade
    : isEikenGrade(classroom.subject)
      ? classroom.subject
      : 'eiken_2';

  let memberDoc: SugorokuMemberDoc | null = await fetchSugorokuMemberDoc(user.uid);

  // 既に owner/staff の場合はロールを降格させない（講師が動作テストで参加した場合の保護）
  if (classroom.plan === 'juku' && (!memberDoc || memberDoc.role === 'student')) {
    const existingClassIds = (memberDoc?.classIds ?? []).filter((id) => id !== classroom.id);
    // 今参加した塾クラスを先頭 [0] に置くことで firestore.rules の sgIsJukuClass(classIds[0]) を確実に満たす
    const nextClassIds = [classroom.id, ...existingClassIds].slice(0, 10);
    const nowMs = Date.now();
    const rootPayload = {
      uid: user.uid,
      classId: classroom.id,
      role: 'student' as const,
      targetGrade,
      active: true,
      adFree: true as const,
      classIds: nextClassIds,
      ...(safeDisplayName ? { displayName: safeDisplayName } : {}),
      consentAcceptedAt: nowMs,
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, SUGOROKU_MEMBERS_COLLECTION, user.uid), rootPayload, { merge: true });
      memberDoc = {
        ...rootPayload,
        updatedAt: nowMs,
      };
      saveCachedSugorokuMember(memberDoc, user.uid);
    } catch {
      // ルール未反映環境等でも class_members 参加自体は成立しているため続行し Ad-Free を有効化する
    }

    // AI 1 の管理者ポータル（classrooms/{classId}/sugoroku_members/{uid}）にも同期書き込み
    try {
      await setDoc(
        doc(db, `${SUGOROKU_COLLECTIONS.classrooms}/${classroom.id}/${SUGOROKU_COLLECTIONS.sugorokuMembers}`, user.uid),
        {
          uid: user.uid,
          classId: classroom.id,
          role: 'student' as const,
          targetGrade,
          active: true,
          adFree: true as const,
          ...(safeDisplayName ? { displayName: safeDisplayName } : {}),
          consentAcceptedAt: nowMs,
          updatedAt: nowMs,
          serverUpdatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch {
      // サブコレクション未反映時でもエラーで止めない
    }
  }

  clearSugorokuInviteDraft();
  const status = await refreshSugorokuEnrollmentAndAdFree(user);
  return {
    joinResult,
    memberDoc: status.memberDoc ?? memberDoc,
    adFreeApplied: status.adFreeApplied,
  };
}

/**
 * 現在ログイン中のユーザーが管理者ポータル（SugorokuAdminApp）・生徒実名（rosterName）・提出物を
 * 扱える権限を持っているか Firestore 実データに基づいて判定する。
 */
export async function checkCurrentUserAdminAccess(
  user?: User | null,
  options?: { strictSpecifiedEmailsOnly?: boolean },
): Promise<AdminAccessDecision & {
  memberDoc: SugorokuMemberDoc | null;
  ownedClassIds: string[];
}> {
  const currentUser = user ?? auth.currentUser;
  if (!currentUser?.uid) {
    return {
      allowed: false,
      reason: 'unauthenticated',
      memberDoc: null,
      ownedClassIds: [],
    };
  }

  const strictSpecifiedEmailsOnly = options?.strictSpecifiedEmailsOnly === true;
  const providerIds = (currentUser.providerData || []).map((p) => p.providerId);

  if (!FIREBASE_CONFIGURED && !USE_EMULATORS) {
    const cached = loadCachedSugorokuMember(currentUser.uid);
    const decision = evaluateSugorokuAdminAccess({
      uid: currentUser.uid,
      email: currentUser.email,
      emailVerified: currentUser.emailVerified,
      providerIds: providerIds.length > 0 ? providerIds : ['google.com'],
      memberDoc: cached,
      ownedJukuClassIds: [],
      strictSpecifiedEmailsOnly,
    });
    return { ...decision, memberDoc: cached, ownedClassIds: [] };
  }

  const [fetchedMember, myClasses] = await Promise.all([
    fetchSugorokuMemberDoc(currentUser.uid),
    fetchMyClassrooms().catch(() => []),
  ]);

  const memberDoc = await ensurePreAuthorizedInstructorMember(currentUser, fetchedMember);

  const ownedClassIds = myClasses.map((c) => c.id);
  const decision = evaluateSugorokuAdminAccess({
    uid: currentUser.uid,
    email: currentUser.email,
    emailVerified: currentUser.emailVerified,
    providerIds: providerIds.length > 0 ? providerIds : ['google.com'],
    memberDoc,
    ownedJukuClassIds: ownedClassIds,
    strictSpecifiedEmailsOnly,
  });

  return {
    ...decision,
    memberDoc,
    ownedClassIds,
  };
}

/**
 * 事前承認済みオーナー講師または active な owner ロール保持者が、
 * コンソール作業なしで即座に `plan: 'juku'` のすごろく塾クラスを開設（または既存クラスを塾プラン化）する。
 */
export async function createSugorokuJukuClassroom(input: ClassroomInput): Promise<ClassroomDoc> {
  const created = await createClassroom(input);
  try {
    await setDoc(
      doc(db, CLASSROOMS_COLLECTION, created.id),
      {
        plan: 'juku',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { ...created, plan: 'juku' };
  } catch {
    return created;
  }
}
