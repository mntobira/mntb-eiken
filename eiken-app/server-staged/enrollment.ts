/**
 * A6 domain code ONLY. Not an HTTP route, Firebase trigger, frontend gate or Hosted policy.
 * No production repository/auth adapter is installed. Defaults disabled. Never import in src/.
 * Rate limits, App Check, real Admin SDK transactions and operational review are required before activation.
 */
export type VerifiedIdentity = { uid: string; provider: string; emailVerified: boolean };
export type Tenant = { id: string; enabled: boolean; seatLimit: number; activeMembers: number };
export type Membership = { tenantId: string; uid: string; role: 'owner' | 'staff' | 'student'; status: 'active' | 'revoked'; expiresAt: number; inviteHash?: string };
export type Invite = { tenantId: string; hash: string; issuedBy: string; expiresAt: number; membershipExpiresAt: number; maxUses: number; uses: number; revoked: boolean };
export interface EnrollmentTransaction {
  getTenant(id: string): Promise<Tenant | null>;
  getMember(tenantId: string, uid: string): Promise<Membership | null>;
  getInvite(hash: string): Promise<Invite | null>;
  putTenant(tenant: Tenant): void;
  putMember(member: Membership): void;
  putInvite(invite: Invite): void;
}
export interface EnrollmentDependencies {
  // Must verify a Firebase ID token server-side, including revocation. Never decode/trust a client payload.
  verifyIdentity(idToken: string): Promise<VerifiedIdentity>;
  transaction<T>(work: (tx: EnrollmentTransaction) => Promise<T>): Promise<T>;
  hmacKey: CryptoKey;
  now(): number;
}
export async function importInviteHmacKey(secret: string): Promise<CryptoKey> {
  if (new TextEncoder().encode(secret).length < 32) throw new Error('SERVER_SECRET_TOO_SHORT');
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
const validId = (id: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(id);
const active = (member: Membership | null, now: number) => !!member && member.status === 'active' && member.expiresAt > now;
function codeBytes(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(20)), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}
async function digest(code: string, key: CryptoKey): Promise<string> {
  const normalized = code.replace(/-/g, '').toUpperCase();
  if (!/^[0-9A-F]{40}$/.test(normalized)) throw new Error('INVITE_REJECTED');
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`eiken-enrollment:v1:${normalized}`));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function createStagedEnrollmentService(deps: EnrollmentDependencies, options: { enabled?: boolean } = {}) {
  const identity = async (token: string) => {
    if (options.enabled !== true) throw new Error('ENROLLMENT_DISABLED');
    const user = await deps.verifyIdentity(token);
    if (!validId(user.uid) || user.provider !== 'google.com' || user.emailVerified !== true) throw new Error('GOOGLE_IDENTITY_REQUIRED');
    return user;
  };
  return {
    async issue(idToken: string, input: { tenantId: string; inviteExpiresAt: number; membershipExpiresAt: number }) {
      const user = await identity(idToken), now = deps.now();
      if (!validId(input.tenantId) || !Number.isSafeInteger(input.inviteExpiresAt) || !Number.isSafeInteger(input.membershipExpiresAt)
        || input.inviteExpiresAt <= now || input.inviteExpiresAt > now + 7 * 86400000 || input.membershipExpiresAt <= input.inviteExpiresAt) throw new Error('INVALID_INVITE_POLICY');
      const raw = codeBytes(), hash = await digest(raw, deps.hmacKey);
      await deps.transaction(async tx => {
        const tenant = await tx.getTenant(input.tenantId);
        const operator = await tx.getMember(input.tenantId, user.uid);
        const existing = await tx.getInvite(hash);
        if (!tenant?.enabled || !active(operator, now) || !['owner','staff'].includes(operator!.role)) throw new Error('NOT_TENANT_OPERATOR');
        if (existing) throw new Error('INVITE_COLLISION');
        tx.putInvite({ tenantId: input.tenantId, hash, issuedBy: user.uid, expiresAt: input.inviteExpiresAt,
          membershipExpiresAt: input.membershipExpiresAt, maxUses: 1, uses: 0, revoked: false });
      });
      // Return raw code ONCE to authorized issuer. Store only HMAC; never log the raw value.
      return { code: raw.match(/.{4}/g)!.join('-'), expiresAt: input.inviteExpiresAt };
    },
    async redeem(idToken: string, code: string) {
      const user = await identity(idToken), now = deps.now(), hash = await digest(code, deps.hmacKey);
      return deps.transaction(async tx => {
        const invite = await tx.getInvite(hash);
        if (!invite || invite.revoked || invite.expiresAt <= now || invite.membershipExpiresAt <= now) throw new Error('INVITE_REJECTED');
        const tenant = await tx.getTenant(invite.tenantId);
        const previous = await tx.getMember(invite.tenantId, user.uid);
        if (!tenant?.enabled) throw new Error('INVITE_REJECTED');
        // No privilege escalation, seat re-use or resurrection of explicitly revoked membership.
        if (previous?.status === 'revoked') throw new Error('INVITE_REJECTED');
        if (active(previous, now)) {
          if (previous!.inviteHash === hash && previous!.role === 'student') return previous!;
          throw new Error('INVITE_REJECTED');
        }
        if (invite.uses >= invite.maxUses || tenant.activeMembers >= tenant.seatLimit) throw new Error('INVITE_REJECTED');
        const member: Membership = { uid: user.uid, tenantId: invite.tenantId, role: 'student', status: 'active', expiresAt: invite.membershipExpiresAt, inviteHash: hash };
        tx.putMember(member);
        tx.putInvite({ ...invite, uses: invite.uses + 1 });
        tx.putTenant({ ...tenant, activeMembers: tenant.activeMembers + 1 });
        return member;
      });
    },
  };
}
