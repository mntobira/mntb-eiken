import { GACHA_PRINTS } from '../src/data/gachaPrints.generated';
import { GACHA_PREVIEWS } from '../src/data/gachaPreviews.generated';
import { gachaItems, gachaItemRate, pickGachaItem, rarityTable } from '../src/battle/core/arenaEconomy';
import { GACHA_POOLS } from '../src/battle/core/gachaPools';
import { weeklyHero, weeklyPickup } from '../src/components/gacha/GachaItemDetail';
import { pickupItems } from '../src/components/gacha/GachaPickupModal';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadPool, poolCountOf, loadBattleAnswers, loadBattleSpeech, POOL_COUNTS } from '../src/battle/data/battlePool';
import { defaultRuleOf, normalizeRule } from '../src/battle/core/battleRules';
import { arenaRule } from '../src/battle/core/arenaRules';
import { BattleQuestionView } from '../src/battle/ui/BattleQuestionView';
import { ITEMS, LEVEL_PRINTS, LEVEL_REWARD_ITEMS } from '../src/battle/core/growthItems';
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

describe('Listening parity', () => {
  it('keeps at least 579 inherited source files byte-identical with documented Eiken adaptations', () => {
    const baseline = JSON.parse(readFileSync('tests/listening-baseline.json', 'utf8'));
    expect(baseline.commit).toBe('ee648b2a961096724afbdc455d7da36a81284f44');
    expect(Object.keys(baseline.unchangedFiles).length).toBeGreaterThanOrEqual(579);
    for (const [path, hash] of Object.entries(baseline.unchangedFiles)) {
      const content = readFileSync(path);
      expect(createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex'), path).toBe(hash);
    }
  });
  it('keeps the shared logo and typography instead of a different visual theme', () => {
    expect(readFileSync('src/components/Home.tsx', 'utf8')).toContain('src="/brand/manatobi-logo.webp" width={1008} height={321}');
    expect(readFileSync('src/index.css', 'utf8')).toContain('@source "./data/subjects.ts";');
    expect(readFileSync('src/index.css', 'utf8')).toContain('@source "./App.tsx";');
    const css = readFileSync('public/fonts/shared.css', 'utf8');
    for (const family of ['Inter', 'Yomogi', 'Klee One', 'Kaisei Decol', 'M PLUS Rounded 1c']) expect(css).toContain(`font-family: '${family}'`);
    for (const match of css.matchAll(/url\(\/([^)]*)\)/g)) expect(existsSync(`public/${match[1]}`)).toBe(true);
  });
  it('keeps level reward mechanics but replaces the unavailable university PDF with Eiken content', () => {
    expect(LEVEL_REWARD_ITEMS.find(item => item.kind === 'print')?.unlock.level).toBe(15);
    for (const print of LEVEL_PRINTS) {
      expect(print.label).toContain('英検');
      expect(existsSync(`public${print.file}`)).toBe(true);
      expect(existsSync(`public${print.thumb}`)).toBe(true);
      expect(readFileSync(`public${print.file}`).subarray(0, 4).toString()).toBe('%PDF');
    }
  });
});

describe('Eiken battle corpus', () => {
  it('provides real grade-specific pools with the same listening scoring and timing', async () => {
    expect(Object.keys(POOL_COUNTS)).toEqual(EIKEN_GRADES.filter(grade => grade.available).map(grade => grade.id));
    for (const grade of EIKEN_GRADES.filter(grade => grade.available)) {
      const rule = arenaRule(normalizeRule(grade.id, {}));
      const pool = await loadPool(grade.id);
      expect(pool).toHaveLength(poolCountOf(grade.id, rule.formats));
      expect(pool).toHaveLength(2);
      expect(rule.pointsSpeedMax).toBe(20);
      expect(rule.timeLimitOverride).toBe(55);
      const answers = await loadBattleAnswers(grade.id);
      for (const question of pool) {
        expect(question.subject).toBe(grade.id);
        expect(question.id.startsWith(grade.id + '_')).toBe(true);
        expect(question.options[question.answerIndex]).toBeTruthy();
        expect(answers.get(question.id)).toContain(question.options[question.answerIndex]);
        expect(await loadBattleSpeech(question.id)).toContain('Question.');
        expect(question).not.toHaveProperty('transcript');
        expect(question).not.toHaveProperty('translation');
      }
    }
    expect(await loadPool('english_listening')).toEqual([]);
    expect(defaultRuleOf('eiken_1').enabled).toBe(false);
  });
  it('renders the same audio controls without exposing the Eiken script or explanations while answering', async () => {
    const question = (await loadPool('eiken_3'))[0];
    const html = renderToStaticMarkup(createElement(BattleQuestionView, {
      question, index: 0, total: 2, remainMs: 55000, answered: false, myChoice: -1, myPanel: [], reveal: false,
      onChoose: () => {}, onPushPanel: () => {}, onPopPanel: () => {}, onCyclePanel: () => {}, onCommitKana: () => {},
    }));
    expect(html).toContain('aria-label="対戦の音源"');
    expect(html).toContain('bqa-play');
    const source = EIKEN_QUESTIONS.find(item => `${item.id}_answer` === question.id)!;
    expect(html).not.toContain(source.transcript);
    expect(html).not.toContain(source.explanation);
  });
});

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
    expect(vocabulary.words.every(word => word.id.startsWith('eiken-word-') && word.exampleSentence && word.exampleTranslation)).toBe(true);
    expect(vocabulary.words.filter(word => word.examples.length > 0).length).toBeGreaterThan(40);
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


describe('Release content completeness', () => {
  it('keeps all 14 reading passages and their 28 questions, translations and choice explanations', () => {
    let readings = 0, marks = 0;
    const ids = new Set<string>();
    for (const grade of EIKEN_GRADES.filter(grade => grade.available)) {
      const parts = partsForGrade(grade.id);
      expect(parts.map(part => part.section)).toEqual(['listening', 'reading', 'vocabulary']);
      for (const chapter of parts.flatMap(part => part.chapters)) {
        expect(chapter.title).toBeTruthy();
        if (!chapter.id.includes('_written_')) expect(chapter.practiceProblems).toHaveLength(2);
        else expect(chapter.practiceProblems.reduce((n,problem)=>n+problem.subQuestions.length,0)).toBe(chapter.marks);
        for (const problem of chapter.practiceProblems) {
          expect(ids.has(problem.id)).toBe(false); ids.add(problem.id);
          for (const question of problem.subQuestions) {
            expect(question.optionTexts).toHaveLength(4);
            expect(question.optionTexts![Number(question.correctAnswer) - 1]).toBeTruthy();
            expect(question.distractors).toHaveLength(4);
            expect(question.explainJa).toBeTruthy();
          }
          if (chapter.questionGroup === 'リーディング') {
            readings++; marks += problem.subQuestions.length;
            expect(problem.text.length).toBeGreaterThan(80);
            expect(problem.explanation).toContain('【全文和訳】');
            expect(problem.audioTracks).toBeUndefined();
          }
        }
        expect(getChapterIndexOfSubject(grade.id).find(item => item.id === chapter.id)?.problemCount).toBe(chapter.practiceProblems.length);
      }
      expect(getSubjectStats(grade.id).marks).toBe(parts.flatMap(part => part.chapters).flatMap(chapter => chapter.practiceProblems).reduce((n, problem) => n + problem.subQuestions.length, 0));
    }
    expect(readings).toBe(14); expect(marks).toBe(28);
  });
  it('provides actual heroes, distinct pickups and mathematically accurate odds for both pools every week', () => {
    for (const pool of GACHA_POOLS) {
      expect(pool.title).toContain('英検');
      expect(pool.lrNote).not.toMatch(/共通テスト|大学|2次試験/);
      const items = gachaItems(pool.id);
      expect(items.length).toBeGreaterThan(20);
      expect(pickupItems(items).length).toBe(6);
      for (let week = 0; week < 104; week++) {
        const hero = weeklyHero(items, week, null)!;
        expect(items).toContain(hero);
        const pickup = weeklyPickup(items, week, hero.id);
        expect(pickup).toHaveLength(5);
        expect(new Set(pickup.map(item => item.id)).size).toBe(5);
        expect(pickup.some(item => item.id === hero.id)).toBe(false);
        expect(pickup.every(item => items.includes(item))).toBe(true);
      }
      expect(items.reduce((n, item) => n + gachaItemRate(item, 'N', pool.id), 0)).toBeCloseTo(1, 10);
      expect(rarityTable('N', pool.id).reduce((n, row) => n + row.rate, 0)).toBeCloseTo(1, 10);
      for (let i = 0; i < 1000; i++) expect(items).toContain(pickGachaItem(i / 1000, 'N', pool.id)?.item);
    }
    expect(GACHA_PRINTS.filter(print => print.id.startsWith('print_eiken_wordbook_'))).toHaveLength(7);
    expect(GACHA_PRINTS.filter(print => print.id.includes('_written_'))).toHaveLength(16);
    expect(GACHA_PRINTS).toHaveLength(23);
    for (const print of GACHA_PRINTS) {
      expect(print.subject).toMatch(/^eiken_/);
      expect(print.pages).toBe(print.variants ? print.variants.reduce((n, part) => n + part.pages, 0) : 5);
      expect(readFileSync(`public${print.file}`).subarray(0, 4).toString()).toBe('%PDF');
      expect(existsSync(`public${print.thumb}`)).toBe(true);
      expect(GACHA_PREVIEWS[print.id].every(path => existsSync(`public${path}`))).toBe(true);
      expect(GACHA_POOLS.filter(pool => gachaItems(pool.id).some(item => item.id === print.id))).toHaveLength(1);
    }
    for (const item of ITEMS.filter(item => item.kind === 'pose')) expect(existsSync(`public${item.value}`)).toBe(true);
  });
  it('provides seven real wordbooks, unique stable IDs, bilingual examples and valid exercise links', () => {
    const data = JSON.parse(readFileSync('public/data/listeningVocabulary.json', 'utf8'));
    expect(data.wordCount).toBe(420); expect(data.questionCount).toBe(840);
    expect(new Set(data.words.map(word => word.id)).size).toBe(data.words.length);
    for (const grade of EIKEN_GRADES.filter(grade => grade.available)) {
      const words = data.words.filter(word => word.level === grade.id);
      expect(words).toHaveLength(60);
      const chapters = partsForGrade(grade.id).flatMap(part => part.chapters);
      for (const word of words) {
        expect(word.exampleSentence).toMatch(/[a-z]/i); expect(word.exampleTranslation).toMatch(/[ぁ-んァ-ヶ一-龯]/);
        expect(word.questions).toHaveLength(2);
        for (const question of word.questions) {
          expect(new Set(question.options).size).toBe(4);
          expect(question.options[question.answerIndex]).toBe(question.id.endsWith(':e2j') ? word.meaning : word.word);
        }
        for (const example of word.examples) {
          const chapter = chapters.find(chapter => chapter.id === example.chapterId)!;
          expect(chapter).toBeTruthy();
          expect(chapter.practiceProblems[example.problemIndex].id).toBe(example.problemId);
          if (example.audioUrl) expect(existsSync(`public${example.audioUrl}`)).toBe(true);
        }
      }
    }
  });
});
