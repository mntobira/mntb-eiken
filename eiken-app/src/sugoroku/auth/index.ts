/**
 * すごろく塾 認証・招待コード認可・Ad-Free 連動・ロール判定モジュール公開エントリ（AI 4）
 */

export {
  SUGOROKU_MEMBERS_COLLECTION,
  SUGOROKU_MEMBER_CACHE_PREFIX,
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
  type SugorokuPortalMode,
  type AdminAccessContext,
  type AdminAccessDecision,
} from './sugorokuAuthCore';

export {
  loadCachedSugorokuMember,
  saveCachedSugorokuMember,
  canUseSugorokuRedirectSignIn,
  signInSugorokuWithGoogle,
  triggerGoogleRedirectSignIn,
  consumeGoogleRedirectResult,
  signOutGoogle,
  fetchSugorokuMemberDoc,
  refreshSugorokuEnrollmentAndAdFree,
  redeemSugorokuInviteCode,
  checkCurrentUserAdminAccess,
  type SugorokuSignInResult,
  type SugorokuEnrollmentStatus,
  type RedeemSugorokuInviteInput,
  type RedeemSugorokuInviteResult,
} from './sugorokuAuthService';

export {
  useSugorokuPortalMode,
  useSugorokuAuthState,
  useSugorokuAdminGuard,
} from './useSugorokuAuth';

export {
  SugorokuAuthGate,
  SugorokuGateScreen,
  type SugorokuAuthGateProps,
} from './SugorokuAuthGate';

export {
  SugorokuAdminGuard,
  type SugorokuAdminGuardProps,
} from './SugorokuAdminGuard';
