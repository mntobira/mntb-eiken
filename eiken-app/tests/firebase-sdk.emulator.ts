import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, doc, getDocFromServer, setDoc, updateDoc, runTransaction, serverTimestamp, Timestamp, terminate } from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { emptyWriting, writingKey } from '../src/eiken/writingProgress';
import { reconcile, type KV } from '../src/utils/userDataSyncCore';

// Fail closed: this script must never contact a live Firebase project.
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
const projectId = 'demo-manatobi-eiken';
const env = await initializeTestEnvironment({ projectId, firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
const clients = ['device-a', 'device-b', 'outsider'].map(name => {
  const app = initializeApp({ projectId, apiKey: 'emulator-only', authDomain: `${projectId}.firebaseapp.com` }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = initializeFirestore(app, { experimentalForceLongPolling: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { app, auth, db };
});
class MemoryKV implements KV {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const [a, b, c] = clients;
const denied = (promise: Promise<unknown>) => assert.rejects(promise, (error: any) => error.code === 'permission-denied');
try {
  const email = `learner-${Date.now()}@example.test`, password = 'Emulator-only-12345';
  const { user } = await createUserWithEmailAndPassword(a.auth, email, password);
  await signInWithEmailAndPassword(b.auth, email, password);
  const { user: outsider } = await createUserWithEmailAndPassword(c.auth, `other-${Date.now()}@example.test`, password);
  const uid = user.uid, other = outsider.uid;
  assert.equal(b.auth.currentUser!.uid, uid);
  const left = new MemoryKV(), right = new MemoryKV();
  const task = 'eiken_3_writing_opinion';
  left.setItem(writingKey(uid), JSON.stringify({ ...emptyWriting(), drafts: { [task]: { text: 'I enjoy reading books.', checked: [], reviewed: false, updatedAt: 1 } } }));
  left.setItem(`eiken_vocab_quiz_v2_${uid}`, JSON.stringify({ version: 1, missed: ['test-word'], mastered: [], best: {} }));
  const first = reconcile(left, uid, null, {});
  await setDoc(doc(a.db, 'eiken_user_data', uid), { uid, ...first.upload, updatedAt: serverTimestamp() });
  const remote = (await getDocFromServer(doc(b.db, 'eiken_user_data', uid))).data()!;
  reconcile(right, uid, remote, {});
  assert.equal(right.getItem(writingKey(uid)), left.getItem(writingKey(uid)));
  const updated = JSON.parse(right.getItem(writingKey(uid))!);
  updated.drafts[task].text = 'I enjoy reading books with my friends.';
  updated.drafts[task].updatedAt = 2;
  right.setItem(writingKey(uid), JSON.stringify(updated));
  const back = reconcile(right, uid, remote, first.base);
  await setDoc(doc(b.db, 'eiken_user_data', uid), { uid, ...back.upload, updatedAt: serverTimestamp() }, { merge: true });
  reconcile(left, uid, (await getDocFromServer(doc(a.db, 'eiken_user_data', uid))).data()!, first.base);
  assert.equal(JSON.parse(left.getItem(writingKey(uid))!).drafts[task].text, updated.drafts[task].text);
  await denied(getDocFromServer(doc(c.db, 'eiken_user_data', uid)));
  await denied(setDoc(doc(c.db, 'eiken_user_data', uid), { uid, s_reading: '{}', updatedAt: serverTimestamp() }));
  await signOut(b.auth);
  await denied(getDocFromServer(doc(b.db, 'eiken_user_data', uid)));
  await signInWithEmailAndPassword(b.auth, email, password);
  console.log('PASS: real Auth emulator tokens, same-user two-device round trip, sign-out and cross-account denial');

  // Seed approved mutual friendship only; all room operations below enforce production rules.
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `eiken_friends/${uid}/items/${other}`), { uid: other });
    await setDoc(doc(db, `eiken_friends/${other}/items/${uid}`), { uid });
  });
  const roomId = `sdk-${Date.now()}`, code = 'ZKPH';
  const profile = (id: string) => ({ uid: id, nickname: 'Test', photoURL: '', rating: 1000 });
  await runTransaction(a.db, async tx => {
    const codeRef = doc(a.db, 'eiken_battle_codes', code);
    assert.equal((await tx.get(codeRef)).exists(), false);
    tx.set(doc(a.db, 'eiken_battle_rooms', roomId), {
      id: roomId, status: 'waiting', mode: 'friend', subject: 'eiken_3', joinCode: code, hostUid: uid,
      players: [uid], profiles: { [uid]: profile(uid) }, questionIds: ['eiken_3_listening_01', 'eiken_3_listening_02'],
      rules: { questionCount: 3, pointsCorrect: 100, pointsSpeedMax: 50, pointsStreak: 15, timeLimitOverride: 55 },
      currentIndex: 0, deadlineAt: null, answers: { [uid]: {} }, attest: {}, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    tx.set(codeRef, { roomId, hostUid: uid, subject: 'eiken_3', createdAt: serverTimestamp() });
  });
  await runTransaction(c.db, async tx => {
    const ref = doc(c.db, 'eiken_battle_rooms', roomId);
    const snapshot = await tx.get(ref), room = snapshot.data()!;
    tx.update(ref, { players: [...room.players, other], profiles: { ...room.profiles, [other]: profile(other) }, answers: { ...room.answers, [other]: {} }, updatedAt: serverTimestamp() });
  });
  const ref = doc(a.db, 'eiken_battle_rooms', roomId);
  await denied(updateDoc(doc(c.db, 'eiken_battle_rooms', roomId), { status: 'playing', currentIndex: 0, deadlineAt: Timestamp.fromMillis(Date.now() + 55000), startedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await updateDoc(ref, { status: 'playing', currentIndex: 0, deadlineAt: Timestamp.fromMillis(Date.now() + 55000), startedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  const answer = () => ({ index: 0, choice: 1, panel: [], answeredAt: serverTimestamp() });
  await updateDoc(ref, { [`answers.${uid}.q0`]: answer(), updatedAt: serverTimestamp() });
  await updateDoc(doc(c.db, 'eiken_battle_rooms', roomId), { [`answers.${other}.q0`]: answer(), updatedAt: serverTimestamp() });
  await denied(updateDoc(ref, { [`answers.${uid}.q0`]: { ...answer(), choice: 2 }, updatedAt: serverTimestamp() }));
  await denied(updateDoc(ref, { [`answers.${other}.q0`]: { ...answer(), choice: 2 }, updatedAt: serverTimestamp() }));
  await signOut(b.auth);
  await createUserWithEmailAndPassword(b.auth, `third-${Date.now()}@example.test`, password);
  await denied(getDocFromServer(doc(b.db, 'eiken_battle_rooms', roomId)));
  await denied(updateDoc(doc(b.db, 'eiken_battle_rooms', roomId), { players: [uid, b.auth.currentUser!.uid], updatedAt: serverTimestamp() }));
  console.log('PASS: friend room/code transaction, mutual-friend join, host-only start, both answers, rewrite and third-party denial');
} finally {
  await Promise.all(clients.map(async client => { await terminate(client.db); await deleteApp(client.app); }));
  await env.cleanup();
}
