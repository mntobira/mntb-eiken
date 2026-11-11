import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createStagedEnrollmentService, importInviteHmacKey, type EnrollmentDependencies, type EnrollmentTransaction, type Invite, type Membership, type Tenant } from '../server-staged/enrollment';

let now: number, tenants: Map<string,Tenant>, members: Map<string,Membership>, invites: Map<string,Invite>, queue: Promise<unknown>;
let dependencies: EnrollmentDependencies;
const memberKey = (tenant: string, uid: string) => `${tenant}/${uid}`;
beforeEach(async () => {
  now=1000; queue=Promise.resolve();
  tenants=new Map([['school-a',{id:'school-a',enabled:true,seatLimit:2,activeMembers:0}],['school-b',{id:'school-b',enabled:true,seatLimit:2,activeMembers:0}]]);
  members=new Map([['school-a/teacher',{tenantId:'school-a',uid:'teacher',role:'owner',status:'active',expiresAt:100000}]]);
  invites=new Map();
  dependencies={ now:()=>now, hmacKey:await importInviteHmacKey('test-only-not-production-secret-0123456789'),
    verifyIdentity:vi.fn(async token=>({uid:token,provider:'google.com',emailVerified:true})),
    transaction<T>(work:(tx:EnrollmentTransaction)=>Promise<T>):Promise<T> {
      const pending=queue.then(async()=>{
        // Test-only serial transaction with rollback. No production in-memory storage.
        const t=structuredClone(tenants),m=structuredClone(members),i=structuredClone(invites);
        const tx:EnrollmentTransaction={getTenant:async id=>t.get(id)??null,getMember:async(tenant,uid)=>m.get(memberKey(tenant,uid))??null,getInvite:async hash=>i.get(hash)??null,
          putTenant:tenant=>{t.set(tenant.id,tenant);},putMember:member=>{m.set(memberKey(member.tenantId,member.uid),member);},putInvite:invite=>{i.set(invite.hash,invite);}};
        const result=await work(tx); tenants=t;members=m;invites=i;return result;
      });queue=pending.catch(()=>{});return pending;
    },
  };
});
const input={tenantId:'school-a',inviteExpiresAt:10000,membershipExpiresAt:90000};
describe('staged enrollment domain, not a live access gate',()=>{
  it('defaults disabled without touching identity or storage',async()=>{
    const service=createStagedEnrollmentService(dependencies);
    await expect(service.issue('teacher',input)).rejects.toThrow('ENROLLMENT_DISABLED');
    await expect(service.redeem('alice','invalid')).rejects.toThrow('ENROLLMENT_DISABLED');
    expect(dependencies.verifyIdentity).not.toHaveBeenCalled();expect(invites.size).toBe(0);
  });
  it('requires verified Google identity and a live operator of the same tenant',async()=>{
    const service=createStagedEnrollmentService(dependencies,{enabled:true});
    await expect(service.issue('student',input)).rejects.toThrow('NOT_TENANT_OPERATOR');
    await expect(service.issue('teacher',{...input,tenantId:'school-b'})).rejects.toThrow('NOT_TENANT_OPERATOR');
    vi.mocked(dependencies.verifyIdentity).mockResolvedValueOnce({uid:'teacher',provider:'apple.com',emailVerified:true});
    await expect(service.issue('teacher',input)).rejects.toThrow('GOOGLE_IDENTITY_REQUIRED');
    vi.mocked(dependencies.verifyIdentity).mockResolvedValueOnce({uid:'teacher',provider:'google.com',emailVerified:false});
    await expect(service.issue('teacher',input)).rejects.toThrow('GOOGLE_IDENTITY_REQUIRED');
  });
  it('uses 160-bit random single-use codes and stores only a purpose-bound HMAC',async()=>{
    const service=createStagedEnrollmentService(dependencies,{enabled:true});
    const first=await service.issue('teacher',input),second=await service.issue('teacher',input);
    expect(first.code).toMatch(/^[A-F0-9]{4}(?:-[A-F0-9]{4}){9}$/);expect(first.code).not.toBe(second.code);
    expect([...invites.values()].every(item=>item.hash.length===64 && item.maxUses===1)).toBe(true);
    expect(JSON.stringify([...invites.values()])).not.toContain(first.code.replace(/-/g,''));
  });
  it('atomically binds only one student; retries by that uid are idempotent',async()=>{
    const service=createStagedEnrollmentService(dependencies,{enabled:true});const invite=await service.issue('teacher',input);
    const results=await Promise.allSettled([service.redeem('alice',invite.code),service.redeem('bob',invite.code)]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    const alice=members.get('school-a/alice')!;expect(alice.role).toBe('student');expect(alice.tenantId).toBe('school-a');
    await expect(service.redeem('alice',invite.code.toLowerCase())).resolves.toEqual(alice);
    expect(tenants.get('school-a')!.activeMembers).toBe(1);expect([...invites.values()][0].uses).toBe(1);expect(members.has('school-b/alice')).toBe(false);
  });
  it('rejects expired or revoked invites and will not reactivate a revoked student',async()=>{
    const service=createStagedEnrollmentService(dependencies,{enabled:true});const first=await service.issue('teacher',input);
    now=10000;await expect(service.redeem('alice',first.code)).rejects.toThrow('INVITE_REJECTED');now=1000;
    const stored=[...invites.values()][0];invites.set(stored.hash,{...stored,revoked:true});
    await expect(service.redeem('alice',first.code)).rejects.toThrow('INVITE_REJECTED');
    const second=await service.issue('teacher',input);members.set('school-a/alice',{tenantId:'school-a',uid:'alice',role:'student',status:'revoked',expiresAt:90000});
    await expect(service.redeem('alice',second.code)).rejects.toThrow('INVITE_REJECTED');
  });
  it('enforces tenant disablement, seat cap, deadline and server key requirements',async()=>{
    const service=createStagedEnrollmentService(dependencies,{enabled:true});const invite=await service.issue('teacher',input);
    tenants.set('school-a',{...tenants.get('school-a')!,activeMembers:2});await expect(service.redeem('alice',invite.code)).rejects.toThrow('INVITE_REJECTED');
    tenants.set('school-a',{...tenants.get('school-a')!,activeMembers:0,enabled:false});await expect(service.redeem('alice',invite.code)).rejects.toThrow('INVITE_REJECTED');
    await expect(service.issue('teacher',{...input,inviteExpiresAt:now})).rejects.toThrow('INVALID_INVITE_POLICY');
    await expect(importInviteHmacKey('short')).rejects.toThrow('SERVER_SECRET_TOO_SHORT');
  });
  it('has no route or frontend activation in the production entry files',()=>{
    for(const path of ['src/App.tsx','src/main.tsx','src/firebase.ts','vite.config.ts','vercel.json'])expect(readFileSync(path,'utf8')).not.toMatch(/server-staged|createStagedEnrollmentService/);
  });
});
