import { readFileSync } from 'node:fs';
import { test, after } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc, serverTimestamp } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Emulator required; never run against production.');
const env = await initializeTestEnvironment({
  projectId: 'demo-manatobi-eiken',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
});
after(() => env.cleanup());
const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const anon = env.unauthenticatedContext().firestore();
const progress = () => ({ uid: 'alice', solved: { eiken_3_listening_01: 1 }, reviewItems: [], solvedTotal: 1, reviewTotal: 0, lastStudiedAt: 1, updatedAt: serverTimestamp() });

test('owner can create, read and update actual studySync payload', async () => {
  await assertSucceeds(setDoc(doc(alice, 'eiken_study_progress/alice'), progress()));
  await assertSucceeds(getDoc(doc(alice, 'eiken_study_progress/alice')));
  await assertSucceeds(setDoc(doc(alice, 'eiken_study_progress/alice'), progress(), { merge: true }));
});
test('other users and anonymous visitors cannot read or write', async () => {
  for (const db of [bob, anon]) {
    await assertFails(getDoc(doc(db, 'eiken_study_progress/alice')));
    await assertFails(setDoc(doc(db, 'eiken_study_progress/alice'), progress()));
  }
});
test('owners cannot spoof uid, add fields, forge timestamp or mismatch counts', async () => {
  for (const extra of [{ uid: 'bob' }, { admin: true }, { updatedAt: 123 }, { solvedTotal: 99 }, { reviewTotal: 1 }, { lastStudiedAt: -1 }, { reviewItems: Array(601).fill({}) }]) {
    await assertFails(setDoc(doc(alice, 'eiken_study_progress/alice'), { ...progress(), ...extra }));
  }
});
test('list, deletion, subcollections and university collections remain denied', async () => {
  await assertFails(getDocs(collection(alice, 'eiken_study_progress')));
  await assertFails(deleteDoc(doc(alice, 'eiken_study_progress/alice')));
  for (const path of ['eiken_study_progress/alice/notes/test', 'questions/q1', 'questionSets/q1', 'users/alice', 'progress/alice', 'attempts/a1', 'audio/a1', 'eiken_users/alice']) {
    await assertFails(setDoc(doc(alice, path), progress()));
    await assertFails(getDoc(doc(alice, path)));
  }
});

test('shared growth, gacha and settings backups retain owner-only access', async () => {
  const payload = { uid: 'alice', s_growth: '{"coins":10}', s_profile: '{"name":"Alice"}', updatedAt: serverTimestamp() };
  const path = 'eiken_user_data/alice';
  await assertSucceeds(setDoc(doc(alice, path), payload));
  await assertSucceeds(getDoc(doc(alice, path)));
  for (const db of [bob, anon]) {
    await assertFails(getDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, path), payload));
  }
  for (const extra of [{ uid: 'bob' }, { admin: true }, { updatedAt: 123 }, { s_growth: 1 }, { s_growth: 'x'.repeat(200001) }]) {
    await assertFails(setDoc(doc(alice, path), { ...payload, ...extra }));
  }
  await assertFails(getDocs(collection(alice, 'eiken_user_data')));
  await assertFails(setDoc(doc(alice, 'user_data/alice'), payload));
});

test('shared friend profiles work without exposing another user or the university namespace', async () => {
  await assertSucceeds(setDoc(doc(alice, 'eiken_friend_profiles/alice'), { uid: 'alice', nickname: 'Alice' }));
  await assertSucceeds(getDoc(doc(alice, 'eiken_friend_profiles/alice')));
  await assertFails(getDoc(doc(bob, 'eiken_friend_profiles/alice')));
  await assertFails(getDocs(collection(alice, 'eiken_friend_profiles')));
  await assertFails(setDoc(doc(bob, 'eiken_friend_profiles/alice'), { uid: 'bob', nickname: 'Bob' }));
  await assertFails(setDoc(doc(alice, 'friend_profiles/alice'), { uid: 'alice', nickname: 'Alice' }));
});

test('shared classroom accepts available Eiken grades without letting teachers set paid privileges', async () => {
  const classroom = { teacherUid: 'alice', schoolName: 'School', className: 'Class', joinCode: 'ACDEFG', subject: 'eiken_3', joinOpen: true };
  await assertSucceeds(setDoc(doc(alice, 'eiken_classrooms/test'), classroom));
  await assertFails(setDoc(doc(bob, 'eiken_classrooms/test'), { ...classroom, teacherUid: 'bob' }));
  for (const extra of [{ plan: 'juku' }, { subject: 'english_listening' }, { subject: 'eiken_1' }]) {
    await assertFails(setDoc(doc(alice, 'eiken_classrooms/test2'), { ...classroom, ...extra }));
  }
  await assertFails(setDoc(doc(alice, 'classrooms/test'), classroom));
});

test('server-only clan, receipt and rating collections have no client-write bypass', async () => {
  for (const path of ['eiken_mana_clans/test', 'eiken_battle_ghost_receipts/test', 'eiken_league_receipts/test', 'eiken_battle_ranking/alice']) {
    for (const db of [alice, anon]) await assertFails(setDoc(doc(db, path), { uid: 'alice', rating: 99999 }));
  }
});
