import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STUDY_CATALOG } from '../src/data/studyCatalog';
import { ListeningSubjectSelection } from '../src/components/ListeningSubjectSelection';
import { restoreSelectedSubject, restoreQuizRange } from '../src/hooks/useAppPersistence';
import { STORAGE_KEYS } from '../src/utils/storageKeysCatalog';
import { studyEntry } from '../src/utils/studyNavigation';
import { isSubjectEnabled } from '../src/config/features';
import { getSubjectStats, getChapterIndexOfSubject } from '../src/data/chapterIndex.generated';
import { getChaptersOfSubject } from '../src/data/allChapters';
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

describe('Shared Eiken shell', () => {
  it('boots App via the shared entry and checks the entire source tree', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('src="/src/main.tsx"');
    expect(html).not.toContain('/src/eiken/main.tsx');
    expect(JSON.parse(readFileSync('tsconfig.json', 'utf8')).include).toContain('src/**/*');
    const source = readFileSync('src/App.tsx', 'utf8');
    expect(source).not.toMatch(/openSubjectUnits\('english_(?:grammar|listening)'/);
    expect(source).not.toContain("setSelectedSubject('english_listening')");
  });
  it('uses only available grades for practice and the existing index matches real chapters', () => {
    const contents = STUDY_CATALOG.flatMap(subject => subject.contents);
    const units = contents.filter(content => content.action.kind === 'units');
    expect(units.map(unit => unit.id)).toEqual(EIKEN_GRADES.filter(grade => grade.available).map(grade => grade.id));
    for (const grade of EIKEN_GRADES) {
      expect(studyEntry(grade.id)).toBe('chapters');
      expect(isSubjectEnabled(grade.id)).toBe(grade.available);
      const chapters = getChaptersOfSubject(grade.id);
      expect(getChapterIndexOfSubject(grade.id).map(chapter => chapter.id)).toEqual(chapters.map(chapter => chapter.id));
      expect(getSubjectStats(grade.id).questions).toBe(chapters.reduce((sum, chapter) => sum + chapter.practiceProblems.length, 0));
    }
    expect(contents.some(content => ['english_listening', 'english_grammar', 'english_reading', 'english_toeic'].includes(content.id))).toBe(false);
  });
  it('renders eight grade cards with grade 1 unavailable and the current grade announced', () => {
    const html = renderToStaticMarkup(createElement(ListeningSubjectSelection, {
      currentSubject: 'eiken_3', isGuest: true, onSelectSubject: () => {},
    }));
    expect((html.match(/data-eiken-grade=/g) ?? [])).toHaveLength(8);
    expect(html).toMatch(/data-eiken-grade="eiken_1"[^>]*disabled/);
    expect(html).toMatch(/data-eiken-grade="eiken_3"[^>]*aria-current="true"/);
    expect(html).not.toContain('english_grammar');
  });
  it('migrates the previous Eiken grade but never restores disabled or university subjects', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    globalThis.localStorage.setItem(STORAGE_KEYS.selectedSubject, 'english_listening');
    eikenStorage.setItem('selected_grade', 'eiken_pre2');
    expect(restoreSelectedSubject()).toBe('eiken_pre2');
    eikenStorage.setItem(STORAGE_KEYS.selectedSubject, 'eiken_4');
    expect(restoreSelectedSubject()).toBe('eiken_4');
    for (const value of ['eiken_1', 'english_listening', 'english_grammar', 'toeic_part5', 'unknown']) {
      eikenStorage.setItem('selected_grade', value);
      eikenStorage.setItem(STORAGE_KEYS.selectedSubject, value);
      expect(restoreSelectedSubject()).toBe('eiken_5');
    }
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.selectedSubject)).toBe('english_listening');
  });
  it('retains valid round ranges and rejects corrupt persisted ranges', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    eikenStorage.setItem(STORAGE_KEYS.quizRange, JSON.stringify({ startIndex: 1, endIndex: 1 }));
    expect(restoreQuizRange()).toEqual({ startIndex: 1, endIndex: 1 });
    for (const raw of ['{', 'null', '{"startIndex":-1,"endIndex":1}', '{"startIndex":2,"endIndex":1}']) {
      eikenStorage.setItem(STORAGE_KEYS.quizRange, raw);
      expect(restoreQuizRange()).toBeNull();
    }
  });
  it('ships shared media without university question scripts or foreign cache lookups', () => {
    for (const asset of ['tanjou.mp3', 'bgm/battle', 'cinematics/title.mp4', 'data/vocabPron.json']) {
      expect(existsSync(`public/${asset}`)).toBe(true);
    }
    const vocabulary = JSON.parse(readFileSync('public/data/listeningVocabulary.json', 'utf8'));
    expect(vocabulary.wordCount).toBe(vocabulary.words.length);
    expect(vocabulary.words.every(word => word.examples.length === 0 && word.chapterIds.length === 0)).toBe(true);
    expect(JSON.parse(readFileSync('public/data/listeningTranslations.json', 'utf8'))).toEqual({});
    expect(JSON.parse(readFileSync('public/manifest.json', 'utf8')).id).toBe('/manatobi-eiken');
    const sw = readFileSync('public/sw.js', 'utf8');
    expect(sw).toContain("k.startsWith('manatobi-eiken-')");
    expect(sw).not.toContain('caches.match(');
  });
});

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
