import { afterEach, describe, expect, it, vi } from 'vitest';
import { EIKEN_UNITS } from '../src/eiken/questions';
import { emptyWriting, mergeWriting, parseWriting, wordCount, writingKey } from '../src/eiken/writingProgress';
import { migrateGuestData, reconcile, SYNC_SECTIONS, type KV } from '../src/utils/userDataSyncCore';
import { savePdf } from '../src/utils/pdfShare';

class MemoryKV implements KV {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const draft = (text: string, updatedAt = 1) => ({ text, checked: [], reviewed: false, updatedAt });
const task = 'eiken_3_writing_opinion';
afterEach(() => vi.unstubAllGlobals());

describe('Eiken integration contracts', () => {
  it('connects all ten independently authored writing tasks with usable rubrics and model answers', () => {
    const tasks = EIKEN_UNITS.flatMap(unit => unit.writing);
    expect(tasks).toHaveLength(10);
    expect(EIKEN_UNITS.filter(unit => unit.writing.length).map(unit => unit.grade)).toEqual(['3', 'pre-2', 'pre-2-plus', '2', 'pre-1']);
    for (const task of tasks) {
      expect(task.instruction.length).toBeGreaterThan(20);
      expect(wordCount(task.model)).toBeGreaterThan(20);
      expect(task.checklist).toHaveLength(4);
      expect(task.commentary.length).toBeGreaterThan(20);
    }
  });
  it('counts English contractions and hyphenated words without counting punctuation', () => {
    expect(wordCount("I don't send e-mails. I’m ready!")).toBe(6);
    expect(wordCount('  \n日本語 123 ... ')).toBe(0);
  });
  it('rejects broken and oversized drafts rather than overwriting them', () => {
    expect(parseWriting(null)).toEqual(emptyWriting());
    for (const raw of ['{', '{}', JSON.stringify({ version: 1, drafts: { bad: draft('text') }, conflicts: {} }), JSON.stringify({ version: 1, drafts: { [task]: draft('x'.repeat(4001)) }, conflicts: {} })]) expect(() => parseWriting(raw)).toThrow();
  });
  it('merges different tasks and preserves a recoverable copy of concurrently edited text', () => {
    const base = { ...emptyWriting(), drafts: { [task]: draft('Original', 1) } };
    const left = { ...emptyWriting(), drafts: { [task]: draft('Left edit', 2) } };
    const right = { ...emptyWriting(), drafts: { [task]: draft('Right edit', 3), eiken_2_writing_summary: draft('Summary', 4) } };
    const merged = mergeWriting(left, right, base)!;
    expect(merged.drafts[task].text).toBe('Right edit');
    expect(merged.conflicts[task][0].text).toBe('Left edit');
    expect(merged.drafts.eiken_2_writing_summary.text).toBe('Summary');
    expect(parseWriting(JSON.stringify(merged))).toEqual(merged);
  });
  it('takes an unchanged device forward without restoring its old text after a remote edit', () => {
    const base = { ...emptyWriting(), drafts: { [task]: draft('Original', 10) } };
    const remote = { ...emptyWriting(), drafts: { [task]: draft('Edited with a slower device clock', 2) } };
    const merged = mergeWriting(base, remote, base)!;
    expect(merged.drafts[task].text).toBe(remote.drafts[task].text);
    expect(merged.conflicts[task]).toEqual([]);
  });
  it('reads the exact same vocabulary keys as the new wordbook and preserves old records', () => {
    expect(SYNC_SECTIONS.find(section => section.id === 'vocabQuiz')!.keys('alice')).toEqual(['eiken_vocab_quiz_v2_alice']);
    expect(SYNC_SECTIONS.find(section => section.id === 'vocabPrefs')!.keys('alice')).toEqual(['eiken_vocab_quiz_prefs_v2_alice']);
    expect(SYNC_SECTIONS.find(section => section.id === 'reading')!.keys('alice')).toEqual([writingKey('alice')]);
    const store = new MemoryKV(); store.setItem('vocab_quiz_v1_alice', 'old-record');
    reconcile(store, 'alice', null, {});
    expect(store.getItem('vocab_quiz_v1_alice')).toBe('old-record');
  });
  it('round-trips wordbook, preferences, writing and owned PDF through two isolated device stores', () => {
    const a = new MemoryKV(), b = new MemoryKV();
    const record = { version: 1, missed: ['eiken-word-3-notice'], mastered: [], best: {} };
    a.setItem('eiken_vocab_quiz_v2_alice', JSON.stringify(record));
    a.setItem('eiken_vocab_quiz_prefs_v2_alice', JSON.stringify({ count: 10, ranges: { eiken_3: [1, 20] }, only: 'unlearned', order: 'number' }));
    a.setItem(writingKey('alice'), JSON.stringify({ ...emptyWriting(), drafts: { [task]: draft('My saved answer', 1) } }));
    a.setItem('battle_growth_local_v1_alice', JSON.stringify({ version: 1, progress: { uid: 'alice', coins: 100, owned: ['print_eiken_wordbook_3'], equipped: {} }, receipts: [], day: '' }));
    const first = reconcile(a, 'alice', null, {});
    expect(Object.keys(first.upload).sort()).toEqual(['s_growth', 's_reading', 's_vocabPrefs', 's_vocabQuiz']);
    reconcile(b, 'alice', first.upload, {});
    expect(JSON.parse(b.getItem('eiken_vocab_quiz_v2_alice')!)).toEqual(record);
    expect(parseWriting(b.getItem(writingKey('alice'))).drafts[task].text).toBe('My saved answer');
    expect(JSON.parse(b.getItem('battle_growth_local_v1_alice')!).progress.owned).toContain('print_eiken_wordbook_3');
    expect(b.getItem(writingKey('bob'))).toBeNull();
  });
  it('protects local and remote writing when the cloud contains malformed or legacy data', () => {
    for (const remote of ['{', JSON.stringify({ answers: { legacy: 'old reading record' } })]) {
      const store = new MemoryKV();
      const local = JSON.stringify({ ...emptyWriting(), drafts: { [task]: draft('Keep this answer') } });
      store.setItem(writingKey('alice'), local);
      const result = reconcile(store, 'alice', { s_reading: remote }, {});
      expect(result.invalidRemote).toContain('reading');
      expect(result.upload.s_reading).toBeUndefined();
      expect(store.getItem(writingKey('alice'))).toBe(local);
    }
  });
  it('moves guest writing and vocabulary into the signed-in account idempotently', () => {
    const store = new MemoryKV();
    store.setItem(writingKey('guest'), JSON.stringify({ ...emptyWriting(), drafts: { [task]: draft('Guest answer') } }));
    store.setItem('eiken_vocab_quiz_v2_guest', JSON.stringify({ version: 1, missed: [], best: {}, mastered: ['eiken-word-3-notice'] }));
    expect(migrateGuestData(store, 'alice').moved).toContain('reading');
    expect(parseWriting(store.getItem(writingKey('alice'))).drafts[task].text).toBe('Guest answer');
    expect(store.getItem(writingKey('guest'))).toBeNull();
    expect(migrateGuestData(store, 'alice').moved).toEqual([]);
  });
  it('rejects an HTML fallback response instead of downloading it as a PDF', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, blob: async () => new Blob(['<!doctype html>missing asset']) }));
    await expect(savePdf('/prints/missing.pdf', 'missing.pdf', 'Test')).rejects.toThrow('PDFの代わり');
  });
});
