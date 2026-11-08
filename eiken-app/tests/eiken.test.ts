import { describe, it, expect, afterEach, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, collection as rawCollection } from 'firebase/firestore';
import { EIKEN_GRADES, validateEikenTarget, eikenCollection } from '../src/eiken/config';
import { EIKEN_QUESTIONS, partsForGrade, toProblem, validateQuestion } from '../src/eiken/questions';
import { eikenStorage } from '../src/eiken/storage';
import { doc, collection, collectionGroup } from '../src/utils/firestoreMetered';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(String(key), String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
afterEach(() => vi.unstubAllGlobals());

describe('Eiken isolation', () => {
  it('registers eight grades without relabeling university content', () => {
    expect(EIKEN_GRADES).toHaveLength(8);
    expect(EIKEN_QUESTIONS).toHaveLength(14);
    for (const q of EIKEN_QUESTIONS) {
      validateQuestion(q);
      expect(q.examType).toBe('eiken');
      expect(q.origin).toBe('manatobi-original');
      const p = toProblem(q);
      expect(p.subQuestions[0].optionTexts).toEqual(q.choices);
      expect(p.subQuestions[0].correctAnswer).toBe(String(q.correctAnswer + 1));
    }
    expect(partsForGrade('eiken_1')).toEqual([]);
    expect(() => validateQuestion({ ...EIKEN_QUESTIONS[0], examType: 'university' } as any)).toThrow();
    expect(() => validateQuestion({ ...EIKEN_QUESTIONS[0], audioUrl: '/university/audio.mp3' })).toThrow();
  });
  it('never reads, overwrites or clears university browser storage', () => {
    const backing = new MemoryStorage();
    vi.stubGlobal('localStorage', backing);
    backing.setItem('selected_grade', 'university');
    backing.setItem('users', 'original');
    expect(eikenStorage.getItem('selected_grade')).toBeNull();
    eikenStorage.setItem('selected_grade', 'eiken_3');
    expect(eikenStorage.length).toBe(1);
    expect(eikenStorage.key(0)).toBe('selected_grade');
    expect(backing.getItem('selected_grade')).toBe('university');
    eikenStorage.clear();
    expect(backing.length).toBe(2);
    expect(backing.getItem('users')).toBe('original');
  });
  it('rejects legacy Firebase and incomplete cloud settings', () => {
    expect(validateEikenTarget({}).enabled).toBe(false);
    expect(() => validateEikenTarget({ VITE_FIREBASE_PROJECT_ID: 'anything' })).toThrow();
    expect(() => validateEikenTarget({ VITE_EIKEN_FIREBASE_PROJECT_ID: 'mntb-listening' })).toThrow();
    expect(() => validateEikenTarget({ VITE_EIKEN_ENABLE_CLOUD: 'true' })).toThrow();
    const env = Object.fromEntries(['API_KEY','AUTH_DOMAIN','PROJECT_ID','STORAGE_BUCKET','MESSAGING_SENDER_ID','APP_ID'].map(k => ['VITE_EIKEN_FIREBASE_' + k, 'test']));
    Object.assign(env, { VITE_EIKEN_ENABLE_CLOUD: 'true', VITE_EIKEN_FIREBASE_PROJECT_ID: 'manatobi-eiken', VITE_EIKEN_FIREBASE_AUTH_DOMAIN: 'manatobi-eiken.firebaseapp.com', VITE_EIKEN_FIREBASE_STORAGE_BUCKET: 'manatobi-eiken.firebasestorage.app' });
    expect(validateEikenTarget(env).enabled).toBe(true);
    expect(() => validateEikenTarget({ ...env, VITE_EIKEN_FIREBASE_AUTH_DOMAIN: 'university.firebaseapp.com' })).toThrow();
    expect(eikenCollection('study_progress')).toBe('eiken_study_progress');
  });
  it('prefixes root Firestore references, including slash-separated paths', async () => {
    const app = initializeApp({ projectId: 'demo-manatobi-eiken' }, 'isolation-test');
    const db = getFirestore(app);
    expect(doc(db, 'study_progress', 'alice').path).toBe('eiken_study_progress/alice');
    expect(doc(db, 'users/alice').path).toBe('eiken_users/alice');
    expect(collection(db, 'questions').path).toBe('eiken_questions');
    expect(doc(rawCollection(db, 'eiken_users'), 'alice').path).toBe('eiken_users/alice');
    expect(() => collectionGroup(db, 'users')).toThrow();
    await deleteApp(app);
  });
});
