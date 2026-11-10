import { perUserKey } from '../utils/userStorageKeys';

export interface WritingDraft { text: string; checked: number[]; reviewed: boolean; updatedAt: number }
export interface WritingProgress { version: 1; drafts: Record<string, WritingDraft>; conflicts: Record<string, WritingDraft[]> }
export const writingKey = (uid: string) => perUserKey('eiken_writing_v1_', uid);
export const emptyWriting = (): WritingProgress => ({ version: 1, drafts: {}, conflicts: {} });
export function wordCount(text: string): number { return text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0; }
const safeId = (id: string) => /^eiken_[a-z0-9]+_writing_[a-z]+$/.test(id);
function draft(value: unknown): WritingDraft {
  const d = value as WritingDraft;
  if (!d || typeof d.text !== 'string' || d.text.length > 4000 || !Array.isArray(d.checked) || d.checked.some(n => !Number.isInteger(n) || n < 0 || n > 20) || typeof d.reviewed !== 'boolean' || !Number.isFinite(d.updatedAt) || d.updatedAt < 0) throw new Error('英作文の保存記録を読み込めません。元の記録は上書きしません。');
  return { text: d.text, checked: [...new Set(d.checked)], reviewed: d.reviewed, updatedAt: d.updatedAt };
}
export function parseWriting(raw: string | null): WritingProgress {
  if (raw === null) return emptyWriting();
  const data = JSON.parse(raw);
  if (!data || data.version !== 1 || !data.drafts || typeof data.drafts !== 'object' || Array.isArray(data.drafts) || !data.conflicts || typeof data.conflicts !== 'object' || Array.isArray(data.conflicts)) throw new Error('英作文の保存形式を確認してください。元の記録は保護しています。');
  const out = emptyWriting();
  for (const [id, value] of Object.entries(data.drafts)) { if (!safeId(id)) throw new Error('不正な英作文IDです。'); out.drafts[id] = draft(value); }
  for (const [id, value] of Object.entries(data.conflicts)) {
    if (!safeId(id) || !Array.isArray(value)) throw new Error('英作文の競合記録が不正です。');
    out.conflicts[id] = value.slice(0, 2).map(draft);
  }
  return out;
}
/** Separate tasks merge independently. Concurrent edits retain the other text as a recoverable copy. */
export function mergeWriting(local: WritingProgress | null, remote: WritingProgress | null, base?: WritingProgress | null): WritingProgress | null {
  if (!local) return remote; if (!remote) return local;
  const out = emptyWriting();
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  for (const id of new Set([...Object.keys(local.drafts), ...Object.keys(remote.drafts)])) {
    const a = local.drafts[id], b = remote.drafts[id], previous = base?.drafts[id];
    const winner = !a ? b : !b ? a : same(a, previous) ? b : same(b, previous) ? a : a.updatedAt >= b.updatedAt ? a : b;
    out.drafts[id] = winner;
    const conflict = a && b && a.text !== b.text && !same(a, previous) && !same(b, previous) ? [winner === a ? b : a] : [];
    const copies = [...conflict, ...(local.conflicts[id] ?? []), ...(remote.conflicts[id] ?? [])];
    out.conflicts[id] = copies.filter((copy, index) => copy.text !== winner.text && copies.findIndex(other => same(copy, other)) === index).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 2);
  }
  return out;
}
