/**
 * すごろく塾 認証・招待コード認可・Ad-Free 連動・ロール判定モジュール公開エントリ（AI 4）
 */

export {
  SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS,
} from '../shared/types';

export {
  SUGOROKU_MEMBERS_COLLECTION,
  SUGOROKU_MEMBER_CACHE_PREFIX,
  SUGOROKU_INVITE_DRAFT_KEY,
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
  type SugorokuPortalMode,
  type AdminAccessContext,
  type AdminAccessDecision,
  type SugorokuInviteDraft,
} from './sugorokuAuthCore';

export {
  loadCachedSugorokuMember,
  saveCachedSugorokuMember,
  saveSugorokuInviteDraft,
  loadSugorokuInviteDraft,
  clearSugorokuInviteDraft,
  canUseSugorokuRedirectSignIn,
  signInSugorokuWithGoogle,
  triggerGoogleRedirectSignIn,
  consumeGoogleRedirectResult,
  signOutGoogle,
  fetchSugorokuMemberDoc,
  ensurePreAuthorizedInstructorMember,
  refreshSugorokuEnrollmentAndAdFree,
  redeemSugorokuInviteCode,
  checkCurrentUserAdminAccess,
  createSugorokuJukuClassroom,
  type SugorokuSignInResult,
  type SugorokuEnrollmentStatus,
  type RedeemSugorokuInviteInput,
  type RedeemSugorokuInviteResult,
} from './sugorokuAuthService';

export {
  useSugorokuPortalMode,
  useBrowserOnline,
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
