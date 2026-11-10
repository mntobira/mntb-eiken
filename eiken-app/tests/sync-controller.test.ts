import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'alice' } as { uid: string } | null },
  values: new Map<string, string>(),
  getDoc: vi.fn(), setDoc: vi.fn(),
}));
vi.mock('../src/firebase', () => ({ auth: mocked.auth, db: {}, FIREBASE_CONFIGURED: true, USE_EMULATORS: false }));
vi.mock('../src/utils/firestoreMetered', () => ({ doc: (_db: unknown, _collection: string, uid: string) => ({ uid }), getDoc: mocked.getDoc, setDoc: mocked.setDoc, serverTimestamp: () => 'server-time' }));
vi.mock('../src/utils/safeLocalStorage', () => ({ safeLocalStorage: () => ({
  getItem: (key: string) => mocked.values.get(key) ?? null,
  setItem: (key: string, value: string) => mocked.values.set(key, value),
  removeItem: (key: string) => mocked.values.delete(key),
}) }));
import { startUserDataSync, stopUserDataSync, syncUserData } from '../src/utils/userDataSync';
const snapshot = (data: Record<string, unknown> | null = null) => ({ metadata: { fromCache: false }, exists: () => data !== null, data: () => data });
const localDraft = (text: string) => JSON.stringify({ version: 1, drafts: { eiken_3_writing_opinion: { text, checked: [], reviewed: false, updatedAt: 1 } }, conflicts: {} });
beforeEach(() => {
  vi.useFakeTimers();
  stopUserDataSync(); mocked.values.clear(); mocked.auth.currentUser = { uid: 'alice' };
  mocked.getDoc.mockReset().mockResolvedValue(snapshot()); mocked.setDoc.mockReset().mockResolvedValue(undefined);
  mocked.values.set('eiken_writing_v1_alice', localDraft('First answer'));
});
afterEach(() => { stopUserDataSync(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('sync transport controller', () => {
  it('rejects manual sync without authentication instead of reporting success', async () => {
    mocked.auth.currentUser = null;
    await expect(syncUserData('manual')).rejects.toThrow('ログイン');
    expect(mocked.getDoc).not.toHaveBeenCalled();
  });
  it('does not treat cached reads or a denied upload as manual sync success', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocked.getDoc.mockResolvedValueOnce({ ...snapshot(), metadata: { fromCache: true } });
    await expect(syncUserData('manual')).rejects.toThrow('完了できません');
    mocked.setDoc.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(syncUserData('manual')).rejects.toThrow('完了できません');
    expect(mocked.values.get('eiken_writing_v1_alice')).toContain('First answer');
  });
  it('keeps input made during a slow upload dirty and sends it on the next periodic check', async () => {
    let finish!: () => void;
    mocked.setDoc.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    startUserDataSync('alice');
    await vi.waitFor(() => expect(mocked.setDoc).toHaveBeenCalledTimes(1));
    const firstPayload = mocked.setDoc.mock.calls[0][1];
    mocked.values.set('eiken_writing_v1_alice', localDraft('Typed while uploading'));
    finish();
    await syncUserData('auto');
    mocked.getDoc.mockResolvedValue(snapshot(firstPayload));
    await vi.advanceTimersByTimeAsync(200_001);
    expect(mocked.setDoc).toHaveBeenCalledTimes(2);
    expect(mocked.setDoc.mock.calls[1][1].s_reading).toContain('Typed while uploading');
  });
  it('rejects a manual sync whose account changes while the server read is pending', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let finish!: (value: ReturnType<typeof snapshot>) => void;
    mocked.getDoc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = syncUserData('manual');
    const result = expect(pending).rejects.toThrow('完了できません');
    mocked.auth.currentUser = { uid: 'bob' };
    finish(snapshot());
    await result;
    expect(mocked.setDoc).not.toHaveBeenCalled();
    expect(mocked.values.has('eiken_writing_v1_bob')).toBe(false);
  });
});
