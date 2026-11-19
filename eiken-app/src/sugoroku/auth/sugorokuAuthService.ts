/**
 * すごろく塾 認証・招待コード承認・ロール判定・Ad-Free 連動の Firestore サービス層
 *
 * 既存の:
 *   - utils/googleAuth.ts（signInWithGoogle / consumeGoogleRedirectResult / isInAppBrowser）
 *   - authDomainPolicy.ts（shouldUseSameOriginAuth）
 *   - utils/classroom.ts（joinClassroomByCode / fetchMyMembershipDetails / fetchMyClassrooms）
 *   - ads/adFree.ts ＆ utils/classAssignments.ts（saveJukuMemberships / setAdFree）
 * を活用し、学校 iPad Safari ポップアップ制限のリダイレクト切替対応を含む
 * Googleログイン導線・招待コード参加・sugoroku_members 同期・管理者ロール判定を提供する。
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
  type JoinResult,
  type MembershipDetail,
} from '../../utils/classroom';
import { loadJukuMemberships, saveJukuMemberships } from '../../utils/classAssignments';
import { setAdFree } from '../../ads/adFree';
import { safeGetItem, safeRemoveItem } from '../../utils/safeLocalStorage';
import { safeSetItem } from '../../utils/storageGuard';
import { isEikenGrade, type EikenGrade } from '../../eiken/config';
import type { SugorokuMemberDoc } from '../shared/types';
import {
  SUGOROKU_MEMBERS_COLLECTION,
  SUGOROKU_MEMBER_CACHE_PREFIX,
  evaluateSugorokuAdminAccess,
  isSafariOrIPadBrowser,
  normalizeSugorokuInviteCode,
  parseCachedSugorokuMember,
  shouldApplySugorokuAdFree,
  validateSugorokuInviteCode,
  type AdminAccessDecision,
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
      classIds: member.classIds,
      displayName: member.displayName,
      consentAcceptedAt: member.consentAcceptedAt,
    }),
  );
}

/**
 * 現在の環境でリダイレクトログインへの切り替えが安全に動作するか判定する。
 * authDomainPolicy.ts の同一オリジン判定、またはローカルエミュレータ時に有効。
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
      message: 'クラウド認証が未設定です（デモ環境）。運営者が Firebase 環境変数を設定すると Google ログインが有効になります。',
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
 * signInWithRedirect はページ遷移完了まで解決しない Promise を返すため、
 * 開始直後の同期/即時エラーのみ捕捉し redirecting: true を返す。
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
 */
export interface SugorokuEnrollmentStatus {
  uid: string;
  isEnrolledInJuku: boolean;
  adFreeApplied: boolean;
  memberDoc: SugorokuMemberDoc | null;
  jukuMemberships: MembershipDetail[];
  allMemberships: MembershipDetail[];
}

export async function refreshSugorokuEnrollmentAndAdFree(user?: User | null): Promise<SugorokuEnrollmentStatus> {
  const currentUser = user ?? auth.currentUser;
  const uid = currentUser?.uid || '';
  if (!uid) {
    setAdFree(false);
    return {
      uid: '',
      isEnrolledInJuku: false,
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
    const adFreeNow = shouldApplySugorokuAdFree({
      uid,
      memberDoc: cachedMember,
      jukuClassCount: cachedJuku.length,
    });
    setAdFree(adFreeNow);
    return {
      uid,
      isEnrolledInJuku: Boolean(cachedMember?.active) || cachedJuku.length > 0,
      adFreeApplied: adFreeNow,
      memberDoc: cachedMember,
      jukuMemberships: [],
      allMemberships: [],
    };
  }

  const [memberDoc, allMemberships] = await Promise.all([
    fetchSugorokuMemberDoc(uid),
    fetchMyMembershipDetails().catch(() => [] as MembershipDetail[]),
  ]);

  const jukuMemberships = allMemberships.filter((m) => m.plan === 'juku');

  // 既存の useJukuAdFree / classAssignments とも完全連動させる
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
    (memberDoc?.active === true) || jukuMemberships.length > 0;

  return {
    uid,
    isEnrolledInJuku,
    adFreeApplied,
    memberDoc,
    jukuMemberships,
    allMemberships,
  };
}

/**
 * 初回「すごろく招待コード（クラス参加コード）」入力・同意承認を実行する。
 *   1. コード検証（6文字、O/0・I/1 自動補正）
 *   2. 同意フラグ確認
 *   3. joinClassroomByCode により class_members / study_access を作成
 *   4. 参加先クラスが plan === 'juku' の場合、sugoroku_members/{uid}（role: 'student', active: true, adFree: true）を作成/更新
 *   5. 即座に Ad-Free を有効化
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

  const joinResult = await joinClassroomByCode(normalizedCode, input.displayName);
  const classroom = joinResult.classroom;
  const targetGrade: EikenGrade = isEikenGrade(input.targetGrade)
    ? input.targetGrade
    : isEikenGrade(classroom.subject)
      ? classroom.subject
      : 'eiken_2';

  let memberDoc: SugorokuMemberDoc | null = await fetchSugorokuMemberDoc(user.uid);

  // 既に owner/staff の場合はロールを降格させない（講師が動作テストで参加した場合の保護）
  if (classroom.plan === 'juku' && (!memberDoc || memberDoc.role === 'student')) {
    const existingClassIds = memberDoc?.classIds ?? [];
    const nextClassIds = Array.from(new Set([...existingClassIds, classroom.id])).slice(0, 10);
    const payload = {
      uid: user.uid,
      role: 'student' as const,
      targetGrade,
      active: true,
      adFree: true as const,
      classIds: nextClassIds,
      consentAcceptedAt: Date.now(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, SUGOROKU_MEMBERS_COLLECTION, user.uid), payload, { merge: true });
      memberDoc = {
        ...payload,
        updatedAt: Date.now(),
      };
      saveCachedSugorokuMember(memberDoc, user.uid);
    } catch {
      // ルール未反映環境等でも class_members 参加自体は成立しているため続行し Ad-Free を有効化する
    }
  }

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
export async function checkCurrentUserAdminAccess(user?: User | null): Promise<AdminAccessDecision & {
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

  const providerIds = (currentUser.providerData || []).map((p) => p.providerId);

  if (!FIREBASE_CONFIGURED && !USE_EMULATORS) {
    const cached = loadCachedSugorokuMember(currentUser.uid);
    const decision = evaluateSugorokuAdminAccess({
      uid: currentUser.uid,
      emailVerified: currentUser.emailVerified,
      providerIds: providerIds.length > 0 ? providerIds : ['google.com'],
      memberDoc: cached,
      ownedJukuClassIds: [],
    });
    return { ...decision, memberDoc: cached, ownedClassIds: [] };
  }

  const [memberDoc, myClasses] = await Promise.all([
    fetchSugorokuMemberDoc(currentUser.uid),
    fetchMyClassrooms().catch(() => []),
  ]);

  const ownedClassIds = myClasses.map((c) => c.id);
  const decision = evaluateSugorokuAdminAccess({
    uid: currentUser.uid,
    emailVerified: currentUser.emailVerified,
    providerIds: providerIds.length > 0 ? providerIds : ['google.com'],
    memberDoc,
    ownedJukuClassIds: ownedClassIds,
  });

  return {
    ...decision,
    memberDoc,
    ownedClassIds,
  };
}
