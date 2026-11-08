/**
 * ===================================================================
 * 手動の学習記録・教材・目標・集計（2026-10-27「学習コミュニティ」第2・3段階）
 * ===================================================================
 * Firebase に依存しない純粋ロジック（テストで直接呼ぶ・端末どうしの合わせ方にも使う）。
 *
 * ■ 何を持つか（localStorage['manual_log_v1_<uid>']。user_data の s_manualLog で端末間同期）
 *   records   … 手動の学習記録（参考書・授業・塾など、アプリの外の勉強。自己申告）
 *   materials … 自分の教材（青チャート・学校の課題など。記録のときに選ぶ）
 *   goals     … 1日・1週間の目標（分）
 *
 * ■ アプリで計測した時間（studyTime.ts）とは混ぜない
 *   集計は「アプリで計測」と「自分で記録」を別々に持ち、合計も出す。
 *   手動記録はアプリの外の勉強なので、同じ時間が両方に入ることはない（二重計上しない）。
 *   手動記録は自己申告。ランキング・レート・公開プロフィールの「学習時間」には使わない。
 *
 * ■ 消したもの
 *   削除は「deleted: true」の印を残す（ほかの端末へ削除を伝えるため）。印は90日で捨てる。
 *   教材を消しても、過去の記録は教材名を持っているので名前は残る。
 *
 * ■ 日付
 *   端末の時刻で「YYYY-MM-DD」（アプリの学習時間と同じ決め方。UTC に直さない）。週は月曜はじまり。
 */

export const RECORD_MINUTES_MAX = 720;
export const DAY_MINUTES_MAX = 1440;
export const MATERIAL_NAME_MAX = 40;
export const COMMENT_MAX = 140;
export const MEMO_MAX = 140;
export const AMOUNT_UNIT_MAX = 8;
export const PAST_DAYS_MAX = 730;
export const RECORDS_KEEP = 700;
export const MATERIALS_KEEP = 120;
const TOMBSTONE_DAYS = 90;
const DAY_MS = 86_400_000;

export type Visibility = 'private' | 'friends';
export interface ManualRecord {
  id: string;
  /** 学習日 'YYYY-MM-DD' */
  day: string;
  createdAt: number;
  updatedAt: number;
  subject: string;
  materialId?: string;
  /** 記録したときの教材名（教材を消しても残る） */
  materialName: string;
  minutes: number;
  amount?: number;
  amountUnit?: string;
  comment?: string;
  kind: 'manual';
  visibility: Visibility;
  /** フレンドに共有した投稿のID */
  postId?: string;
  deleted?: true;
}
export interface Material {
  id: string;
  name: string;
  subject: string;
  type: string;
  goalMinutes?: number;
  memo?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: true;
}
export interface StudyGoals { dailyMinutes?: number; weeklyMinutes?: number; updatedAt?: number }
export interface ManualLogStore { version: 1; records: ManualRecord[]; materials: Material[]; goals: StudyGoals }

export const emptyStore = (): ManualLogStore => ({ version: 1, records: [], materials: [], goals: {} });

// ---------- 教科（アプリの外の勉強を広く分ける一覧） ----------
export interface SubjectDef { id: string; label: string; group: string }
export const STUDY_SUBJECTS: readonly SubjectDef[] = [
  { id: 'eng', label: '英語', group: '英語' },
  { id: 'math', label: '数学', group: '数学' },
  { id: 'jpn', label: '国語', group: '国語' },
  { id: 'phy', label: '物理', group: '理科' },
  { id: 'chem', label: '化学', group: '理科' },
  { id: 'bio', label: '生物', group: '理科' },
  { id: 'earth', label: '地学', group: '理科' },
  { id: 'sci', label: '理科その他', group: '理科' },
  { id: 'jhist', label: '日本史', group: '社会' },
  { id: 'whist', label: '世界史', group: '社会' },
  { id: 'geo', label: '地理', group: '社会' },
  { id: 'civ', label: '公民', group: '社会' },
  { id: 'info', label: '情報', group: '情報' },
  { id: 'other', label: 'その他', group: 'その他' },
];
const SUBJECT_IDS = new Set(STUDY_SUBJECTS.map(s => s.id));
export const isStudySubject = (id: unknown): id is string => typeof id === 'string' && SUBJECT_IDS.has(id);
export const subjectLabel = (id: string) => STUDY_SUBJECTS.find(s => s.id === id)?.label ?? 'その他';
export const MATERIAL_TYPES = ['参考書', '問題集', '学校の課題', '授業', '塾・予備校', '映像授業', 'アプリ', '模試', '自主学習', 'その他'] as const;
export const AMOUNT_UNITS = ['ページ', '問', '単元', '回', '語'] as const;

// ---------- 日付 ----------
export function dayOf(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** 'YYYY-MM-DD' → その日の正午（端末の時刻）。夏時間でも日がずれないよう正午 */
export function noonOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}
export const isDayKey = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && dayOf(noonOf(v)) === v;
export const addDays = (day: string, n: number) => dayOf(noonOf(day) + n * DAY_MS);
/** 月曜はじまりの週の初日 */
export function weekStart(day: string): string {
  const wd = new Date(noonOf(day)).getDay();
  return addDays(day, -((wd + 6) % 7));
}
export const monthOf = (day: string) => day.slice(0, 7);
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ---------- 入力の確かめ ----------
export interface RecordInput {
  day: string; subject: string; materialId?: string; materialName: string; minutes: number;
  amount?: number | null; amountUnit?: string; comment?: string; visibility?: Visibility;
}
export type RecordIssue = 'day' | 'future' | 'too_old' | 'subject' | 'minutes_low' | 'minutes_high' | 'day_total' | 'material' | 'amount' | 'comment';
export const RECORD_ISSUE_TEXT: Record<RecordIssue, string> = {
  day: '学習日を選んでください。',
  future: '未来の日付には記録できません。',
  too_old: '2年より前の日付には記録できません。',
  subject: '教科を選んでください。',
  minutes_low: '学習時間は1分以上にしてください。',
  minutes_high: `1回の記録は${RECORD_MINUTES_MAX / 60}時間までです。長いときは分けて記録してください。`,
  day_total: 'この日の記録が合計24時間をこえます。時間を確かめてください。',
  material: `教材・内容は${MATERIAL_NAME_MAX}文字までです。`,
  amount: '学習量は0〜99999の数で入れてください。',
  comment: `コメントは${COMMENT_MAX}文字までです。`,
};
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim().slice(0, max) : '');

export function validateRecord(input: RecordInput, store: ManualLogStore, now = Date.now(), editingId?: string): RecordIssue | null {
  if (!isDayKey(input.day)) return 'day';
  const today = dayOf(now);
  if (input.day > today) return 'future';
  if (input.day < addDays(today, -PAST_DAYS_MAX)) return 'too_old';
  if (!isStudySubject(input.subject)) return 'subject';
  const m = Number(input.minutes);
  if (!Number.isFinite(m) || Math.floor(m) < 1) return 'minutes_low';
  if (m > RECORD_MINUTES_MAX) return 'minutes_high';
  const sameDay = liveRecords(store).filter(r => r.day === input.day && r.id !== editingId).reduce((n, r) => n + r.minutes, 0);
  if (sameDay + Math.floor(m) > DAY_MINUTES_MAX) return 'day_total';
  if ((input.materialName ?? '').trim().length > MATERIAL_NAME_MAX) return 'material';
  if (input.amount != null && (!Number.isFinite(input.amount) || input.amount < 0 || input.amount > 99999)) return 'amount';
  if ((input.comment ?? '').trim().length > COMMENT_MAX) return 'comment';
  return null;
}

export function makeId(prefix: string, now = Date.now(), rand = Math.random): string {
  return `${prefix}${now.toString(36)}${Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0')}`;
}

// ---------- 作る・直す・消す ----------
export const liveRecords = (s: ManualLogStore) => s.records.filter(r => !r.deleted);
export const liveMaterials = (s: ManualLogStore) => s.materials.filter(m => !m.deleted);

/** 記録を作る／直す（validateRecord 済みのこと） */
export function upsertRecord(store: ManualLogStore, input: RecordInput, now = Date.now(), id?: string): { store: ManualLogStore; record: ManualRecord } {
  const prev = id ? store.records.find(r => r.id === id && !r.deleted) : undefined;
  const material = input.materialId ? store.materials.find(x => x.id === input.materialId && !x.deleted) : undefined;
  const unit = clean(input.amountUnit, AMOUNT_UNIT_MAX);
  const hasAmount = input.amount != null && Number.isFinite(input.amount);
  const record: ManualRecord = {
    id: prev?.id ?? makeId('r', now),
    day: input.day,
    createdAt: prev?.createdAt ?? now,
    updatedAt: Math.max(now, (prev?.updatedAt ?? 0) + 1),
    subject: input.subject,
    ...(material ? { materialId: material.id } : {}),
    materialName: clean(input.materialName, MATERIAL_NAME_MAX) || material?.name || '',
    minutes: Math.floor(input.minutes),
    ...(hasAmount ? { amount: Math.floor(input.amount as number) } : {}),
    ...(hasAmount && unit ? { amountUnit: unit } : {}),
    ...(clean(input.comment, COMMENT_MAX) ? { comment: clean(input.comment, COMMENT_MAX) } : {}),
    kind: 'manual',
    visibility: input.visibility === 'friends' ? 'friends' : 'private',
    ...(prev?.postId ? { postId: prev.postId } : {}),
  };
  return { store: prune({ ...store, records: [record, ...store.records.filter(r => r.id !== record.id)] }, now), record };
}

export function deleteRecord(store: ManualLogStore, id: string, now = Date.now()): ManualLogStore {
  const records = store.records.map(r => (r.id === id
    ? { id: r.id, day: r.day, createdAt: r.createdAt, updatedAt: Math.max(now, r.updatedAt + 1), subject: r.subject, materialName: '', minutes: 0, kind: 'manual' as const, visibility: 'private' as const, deleted: true as const }
    : r));
  return prune({ ...store, records }, now);
}

/** 投稿IDを付ける／外す（共有した・共有をやめた） */
export function setRecordPost(store: ManualLogStore, id: string, postId: string | undefined, now = Date.now()): ManualLogStore {
  return { ...store, records: store.records.map(r => {
    if (r.id !== id || r.deleted) return r;
    const { postId: _old, ...rest } = r; void _old;
    return { ...rest, ...(postId ? { postId, visibility: 'friends' as const } : { visibility: 'private' as const }), updatedAt: Math.max(now, r.updatedAt + 1) };
  }) };
}

export interface MaterialInput { name: string; subject: string; type?: string; goalMinutes?: number | null; memo?: string }
export type MaterialIssue = 'name' | 'name_long' | 'subject' | 'goal' | 'memo' | 'duplicate';
export const MATERIAL_ISSUE_TEXT: Record<MaterialIssue, string> = {
  name: '教材名を入れてください。',
  name_long: `教材名は${MATERIAL_NAME_MAX}文字までです。`,
  subject: '教科を選んでください。',
  goal: '目標時間は1〜99999分で入れてください。',
  memo: `メモは${MEMO_MAX}文字までです。`,
  duplicate: '同じ教科に同じ名前の教材があります。',
};
export function validateMaterial(input: MaterialInput, store: ManualLogStore, editingId?: string): MaterialIssue | null {
  const name = input.name.trim();
  if (!name) return 'name';
  if (name.length > MATERIAL_NAME_MAX) return 'name_long';
  if (!isStudySubject(input.subject)) return 'subject';
  if (input.goalMinutes != null && (!Number.isFinite(input.goalMinutes) || input.goalMinutes < 1 || input.goalMinutes > 99999)) return 'goal';
  if ((input.memo ?? '').trim().length > MEMO_MAX) return 'memo';
  if (liveMaterials(store).some(m => m.id !== editingId && m.name === name && m.subject === input.subject)) return 'duplicate';
  return null;
}
export function upsertMaterial(store: ManualLogStore, input: MaterialInput, now = Date.now(), id?: string): { store: ManualLogStore; material: Material } {
  const prev = id ? store.materials.find(m => m.id === id && !m.deleted) : undefined;
  const material: Material = {
    id: prev?.id ?? makeId('m', now),
    name: clean(input.name, MATERIAL_NAME_MAX),
    subject: input.subject,
    type: (MATERIAL_TYPES as readonly string[]).includes(input.type ?? '') ? (input.type as string) : 'その他',
    ...(input.goalMinutes != null && Number.isFinite(input.goalMinutes) ? { goalMinutes: Math.floor(input.goalMinutes) } : {}),
    ...(clean(input.memo, MEMO_MAX) ? { memo: clean(input.memo, MEMO_MAX) } : {}),
    createdAt: prev?.createdAt ?? now,
    updatedAt: Math.max(now, (prev?.updatedAt ?? 0) + 1),
  };
  // 名前を変えたら、その教材の過去の記録の名前もそろえる（一覧と記録がずれないように）
  let records = store.records;
  if (prev && prev.name !== material.name) {
    records = records.map(r => (r.materialId === material.id && !r.deleted ? { ...r, materialName: material.name, updatedAt: Math.max(now, r.updatedAt + 1) } : r));
  }
  return { store: prune({ ...store, records, materials: [material, ...store.materials.filter(m => m.id !== material.id)] }, now), material };
}
/** 教材を消す。過去の記録は消さず、教材名もそのまま残る */
export function deleteMaterial(store: ManualLogStore, id: string, now = Date.now()): ManualLogStore {
  const materials = store.materials.map(m => (m.id === id
    ? { id: m.id, name: m.name, subject: m.subject, type: m.type, createdAt: m.createdAt, updatedAt: Math.max(now, m.updatedAt + 1), deleted: true as const }
    : m));
  return prune({ ...store, materials }, now);
}

export function setGoals(store: ManualLogStore, goals: { dailyMinutes?: number | null; weeklyMinutes?: number | null }, now = Date.now()): ManualLogStore {
  const ok = (v: number | null | undefined, hi: number) => (v != null && Number.isFinite(v) && v >= 1 && v <= hi ? Math.floor(v) : undefined);
  const g: StudyGoals = { updatedAt: Math.max(now, (store.goals.updatedAt ?? 0) + 1) };
  const d = ok(goals.dailyMinutes, 1440); const w = ok(goals.weeklyMinutes, 10080);
  if (d) g.dailyMinutes = d;
  if (w) g.weeklyMinutes = w;
  return { ...store, goals: g };
}

/** 古い削除の印を捨て、件数を上限に収める（新しい学習日から残す） */
export function prune(store: ManualLogStore, now = Date.now()): ManualLogStore {
  const cut = now - TOMBSTONE_DAYS * DAY_MS;
  const records = store.records.filter(r => !r.deleted || r.updatedAt > cut)
    .sort((a, b) => (a.day === b.day ? b.createdAt - a.createdAt : a.day < b.day ? 1 : -1)).slice(0, RECORDS_KEEP);
  const materials = store.materials.filter(m => !m.deleted || m.updatedAt > cut).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MATERIALS_KEEP);
  return { ...store, records, materials };
}

// ---------- 読み込み（壊れた値は捨てる）と端末どうしの合わせ方 ----------
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
function parseRecord(v: unknown): ManualRecord | null {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id || v.id.length > 40 || !isDayKey(v.day)) return null;
  const createdAt = num(v.createdAt); const updatedAt = num(v.updatedAt);
  if (!(createdAt > 0) || !(updatedAt > 0)) return null;
  if (v.deleted === true) return { id: v.id, day: v.day, createdAt, updatedAt, subject: isStudySubject(v.subject) ? v.subject : 'other', materialName: '', minutes: 0, kind: 'manual', visibility: 'private', deleted: true };
  const minutes = Math.floor(num(v.minutes));
  if (!isStudySubject(v.subject) || !(minutes >= 1 && minutes <= RECORD_MINUTES_MAX)) return null;
  const amount = num(v.amount);
  return {
    id: v.id, day: v.day, createdAt, updatedAt, subject: v.subject,
    ...(typeof v.materialId === 'string' && v.materialId ? { materialId: v.materialId.slice(0, 40) } : {}),
    materialName: clean(v.materialName, MATERIAL_NAME_MAX),
    minutes,
    ...(amount >= 0 && amount <= 99999 ? { amount: Math.floor(amount) } : {}),
    ...(clean(v.amountUnit, AMOUNT_UNIT_MAX) ? { amountUnit: clean(v.amountUnit, AMOUNT_UNIT_MAX) } : {}),
    ...(clean(v.comment, COMMENT_MAX) ? { comment: clean(v.comment, COMMENT_MAX) } : {}),
    kind: 'manual',
    visibility: v.visibility === 'friends' ? 'friends' : 'private',
    ...(typeof v.postId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(v.postId) ? { postId: v.postId } : {}),
  };
}
function parseMaterial(v: unknown): Material | null {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id || v.id.length > 40) return null;
  const createdAt = num(v.createdAt); const updatedAt = num(v.updatedAt);
  const name = clean(v.name, MATERIAL_NAME_MAX);
  if (!(createdAt > 0) || !(updatedAt > 0) || !isStudySubject(v.subject)) return null;
  if (v.deleted === true) return { id: v.id, name, subject: v.subject, type: 'その他', createdAt, updatedAt, deleted: true };
  if (!name) return null;
  const goal = num(v.goalMinutes);
  return {
    id: v.id, name, subject: v.subject,
    type: (MATERIAL_TYPES as readonly string[]).includes(String(v.type)) ? String(v.type) : 'その他',
    ...(goal >= 1 && goal <= 99999 ? { goalMinutes: Math.floor(goal) } : {}),
    ...(clean(v.memo, MEMO_MAX) ? { memo: clean(v.memo, MEMO_MAX) } : {}),
    createdAt, updatedAt,
  };
}
export function parseStore(v: unknown): ManualLogStore {
  if (!isObj(v) || v.version !== 1) return emptyStore();
  const records = Array.isArray(v.records) ? v.records.map(parseRecord).filter((x): x is ManualRecord => !!x) : [];
  const materials = Array.isArray(v.materials) ? v.materials.map(parseMaterial).filter((x): x is Material => !!x) : [];
  const g = isObj(v.goals) ? v.goals : {};
  const goals: StudyGoals = {};
  const d = num(g.dailyMinutes); const w = num(g.weeklyMinutes); const u = num(g.updatedAt);
  if (d >= 1 && d <= 1440) goals.dailyMinutes = Math.floor(d);
  if (w >= 1 && w <= 10080) goals.weeklyMinutes = Math.floor(w);
  if (u > 0) goals.updatedAt = u;
  return { version: 1, records, materials, goals };
}

/** ID ごとに更新が新しい方を残す（削除の印も同じ決まり）。目標は新しく変えた方 */
export function mergeStores(local: unknown, remote: unknown, now = Date.now()): ManualLogStore {
  const l = parseStore(local); const r = parseStore(remote);
  const pick = <T extends { id: string; updatedAt: number }>(a: T[], b: T[]) => {
    const by = new Map<string, T>();
    for (const x of [...a, ...b]) { const p = by.get(x.id); if (!p || x.updatedAt > p.updatedAt) by.set(x.id, x); }
    return [...by.values()];
  };
  const goals = (l.goals.updatedAt ?? 0) >= (r.goals.updatedAt ?? 0) ? l.goals : r.goals;
  return prune({ version: 1, records: pick(l.records, r.records), materials: pick(l.materials, r.materials), goals }, now);
}

// ---------- 集計（秒で返す。手動記録は 分×60） ----------
/** アプリで計測した時間（studyTime.ts の形） */
export interface AppTime { total: number; days: Record<string, number> }
export interface Split { app: number; self: number; total: number }
export interface StudySummary {
  today: Split; week: Split; month: Split; all: Split;
  /** 今日を最後にした7日（古い→新しい） */
  last7: { day: string; app: number; self: number }[];
  /** 学習した日（アプリ60秒以上 or 手動記録あり） */
  activeDays: Set<string>;
  goals: StudyGoals;
}
const split = (app: number, self: number): Split => ({ app, self, total: app + self });
export function summarize(store: ManualLogStore, app: AppTime, now = Date.now()): StudySummary {
  const today = dayOf(now); const wk = weekStart(today); const mo = monthOf(today);
  const selfDays = new Map<string, number>();
  for (const r of liveRecords(store)) selfDays.set(r.day, (selfDays.get(r.day) ?? 0) + r.minutes * 60);
  const appDays = Object.entries(app.days);
  const sum = (src: Iterable<[string, number]>, test: (d: string) => boolean) => { let n = 0; for (const [d, s] of src) if (d <= today && test(d)) n += s; return n; };
  const span = (test: (d: string) => boolean) => split(sum(appDays, test), sum(selfDays, test));
  const selfAll = [...selfDays.values()].reduce((a, b) => a + b, 0);
  const last7 = Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i - 6); return { day: d, app: app.days[d] ?? 0, self: selfDays.get(d) ?? 0 }; });
  const activeDays = new Set<string>([...appDays.filter(([, s]) => s >= 60).map(([d]) => d), ...selfDays.keys()]);
  return { today: span(d => d === today), week: span(d => d >= wk), month: span(d => monthOf(d) === mo), all: split(app.total, selfAll), last7, activeDays, goals: store.goals };
}

/** 今日（または昨日）からさかのぼって続けて学習した日数。今日まだでも昨日まで続いていれば数える（記録を忘れた日に0と言わない） */
export function currentStreak(activeDays: Set<string>, now = Date.now()): number {
  let d = dayOf(now);
  if (!activeDays.has(d)) d = addDays(d, -1);
  let n = 0;
  while (activeDays.has(d) && n < 3650) { n += 1; d = addDays(d, -1); }
  return n;
}

export interface Breakdown { key: string; label: string; seconds: number; count: number }
/** 教科別（手動記録。アプリ内の時間は教科を持っていないので「マナトビ」として1つ） */
export function bySubject(store: ManualLogStore, appSeconds: number, range?: { from?: string; to?: string }): Breakdown[] {
  const m = new Map<string, Breakdown>();
  for (const r of liveRecords(store)) {
    if (range?.from && r.day < range.from) continue;
    if (range?.to && r.day > range.to) continue;
    const b = m.get(r.subject) ?? { key: r.subject, label: subjectLabel(r.subject), seconds: 0, count: 0 };
    b.seconds += r.minutes * 60; b.count += 1; m.set(r.subject, b);
  }
  const out = [...m.values()].sort((a, b) => b.seconds - a.seconds);
  if (appSeconds > 0) out.push({ key: 'app', label: 'マナトビ（アプリ内）', seconds: appSeconds, count: 0 });
  return out;
}
export interface MaterialStat extends Breakdown { materialId?: string; subject: string; goalMinutes?: number; lastDay: string; type?: string }
/** 教材別（教材IDがあればID、なければ教科＋名前でまとめる） */
export function byMaterial(store: ManualLogStore): MaterialStat[] {
  const mats = new Map(liveMaterials(store).map(x => [x.id, x]));
  const m = new Map<string, MaterialStat>();
  for (const r of liveRecords(store)) {
    const mat = r.materialId ? mats.get(r.materialId) : undefined;
    const key = mat ? `id:${mat.id}` : `name:${r.subject}:${r.materialName}`;
    const b = m.get(key) ?? { key, label: mat ? mat.name : r.materialName || '教材なし', seconds: 0, count: 0, subject: mat?.subject ?? r.subject, lastDay: r.day,
      ...(mat ? { materialId: mat.id, goalMinutes: mat.goalMinutes, type: mat.type } : {}) };
    b.seconds += r.minutes * 60; b.count += 1; if (r.day > b.lastDay) b.lastDay = r.day;
    m.set(key, b);
  }
  for (const mat of mats.values()) {
    const key = `id:${mat.id}`;
    if (!m.has(key)) m.set(key, { key, label: mat.name, seconds: 0, count: 0, subject: mat.subject, lastDay: '', materialId: mat.id, goalMinutes: mat.goalMinutes, type: mat.type });
  }
  return [...m.values()].sort((a, b) => (b.lastDay > a.lastDay ? 1 : b.lastDay < a.lastDay ? -1 : b.seconds - a.seconds));
}
/** その月のカレンダー（月曜はじまり・前後の空きは null） */
export function monthGrid(month: string): (string | null)[] {
  const first = `${month}-01`;
  const lead = (new Date(noonOf(first)).getDay() + 6) % 7;
  const out: (string | null)[] = Array(lead).fill(null);
  for (let d = first; monthOf(d) === month; d = addDays(d, 1)) out.push(d);
  while (out.length % 7) out.push(null);
  return out;
}
export function recordsOfDay(store: ManualLogStore, day: string): ManualRecord[] {
  return liveRecords(store).filter(r => r.day === day).sort((a, b) => b.createdAt - a.createdAt);
}
/** よく使う教科（直近の記録から・最大5） */
export function recentSubjects(store: ManualLogStore): string[] {
  const n = new Map<string, number>();
  liveRecords(store).slice(0, 60).forEach((r, i) => n.set(r.subject, (n.get(r.subject) ?? 0) + 60 - i));
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 5);
}
/** 目標の達成率（0〜1。目標が無ければ null） */
export const goalRatio = (seconds: number, goalMinutes?: number) => (goalMinutes ? Math.min(1, seconds / (goalMinutes * 60)) : null);

/** 教材名だけで記録していた分を、あとから登録した教材にひもづける（同じ教科・同じ名前の記録だけ） */
export function linkRecordsToMaterial(store: ManualLogStore, materialId: string, now = Date.now()): ManualLogStore {
  const mat = store.materials.find(m => m.id === materialId && !m.deleted);
  if (!mat) return store;
  return { ...store, records: store.records.map(r => (!r.deleted && !r.materialId && r.subject === mat.subject && r.materialName === mat.name
    ? { ...r, materialId: mat.id, updatedAt: Math.max(now, r.updatedAt + 1) } : r)) };
}

/** マイページの「今日の勉強記録」用（2026-10-28）：直近7日（古い→新しい）の教材ごとの時間。アプリ内の時間は「マナトビ（アプリ内）」1行 */
export interface WeekRow { key: string; label: string; subject: string; seconds: number[]; total: number; recordIds?: string[][] }
export function weekByMaterial(store: ManualLogStore, app: AppTime, now = Date.now()): { days: string[]; rows: WeekRow[] } {
  const today = dayOf(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return { days, rows: materialsByDays(store, app, days) };
}

/**
 * 指定した日ごとの「教材ごとの勉強時間」（C5 2026-10-29：カレンダーで選んだ日にも使う）。
 *   並び＝最後の日に多い順 → 合計の多い順。アプリ内の時間は最後に1行（マナトビ）。
 *   recordIds … そのマスに入っている自分の記録（押すと直す・消すの窓を開くため）
 */
export function materialsByDays(store: ManualLogStore, app: AppTime, days: readonly string[]): WeekRow[] {
  const idx = new Map(days.map((d, i) => [d, i]));
  const mats = new Map(liveMaterials(store).map(x => [x.id, x]));
  const rows = new Map<string, WeekRow>();
  for (const r of liveRecords(store)) {
    const i = idx.get(r.day);
    if (i == null) continue;
    const mat = r.materialId ? mats.get(r.materialId) : undefined;
    const key = mat ? `id:${mat.id}` : `name:${r.subject}:${r.materialName}`;
    const row = rows.get(key) ?? { key, label: mat?.name || r.materialName || subjectLabel(r.subject), subject: mat?.subject ?? r.subject, seconds: Array(days.length).fill(0), total: 0, recordIds: days.map(() => [] as string[]) };
    row.seconds[i] += r.minutes * 60; row.total += r.minutes * 60;
    row.recordIds?.[i].push(r.id);
    rows.set(key, row);
  }
  const last = days.length - 1;
  const out = [...rows.values()].sort((a, b) => b.seconds[last] - a.seconds[last] || b.total - a.total);
  const appSec = days.map(d => app.days[d] ?? 0);
  const appTotal = appSec.reduce((a, b) => a + b, 0);
  if (appTotal > 0) out.push({ key: 'app', label: 'マナトビ（アプリ内）', subject: 'app', seconds: appSec, total: appTotal });
  return out;
}
