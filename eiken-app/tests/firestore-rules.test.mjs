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
  for (const path of ['eiken_study_progress/alice/notes/test', 'questions/q1', 'questionSets/q1', 'users/alice', 'progress/alice', 'attempts/a1', 'audio/a1', 'eiken_users/alice', 'eiken_user_data/alice']) {
    await assertFails(setDoc(doc(alice, path), progress()));
    await assertFails(getDoc(doc(alice, path)));
  }
});
