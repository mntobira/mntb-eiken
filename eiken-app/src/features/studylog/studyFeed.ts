/**
 * ===================================================================
 * 学習記録の共有（フレンドの学習フィード）とリアクション（2026-10-27 第5段階）
 * ===================================================================
 * ■ 保存先（Firestore）
 *   study_posts/{uid}_{recordId} = { uid, nickname, kind:'manual', day, subject, materialName, minutes,
 *                                    amount?, amountUnit?, comment?, createdAt, updatedAt }
 *   study_posts/{postId}/reactions/{reactorUid} = { uid, type:'cheer'|'nice', at }
 *
 * ■ だれが読めるか（firestore.rules で決める。画面で隠すだけにしない）
 *   投稿：本人と、本人のフレンドだけ。フレンドを解除すると読めなくなる。
 *   リアクション：投稿の本人とそのフレンドだけが読める。送れるのはフレンドだけ（1人1つ・付け替え可）。
 *
 * ■ 重複しない：投稿IDは「本人のuid_記録ID」。同じ記録は2回載らない（直すと同じ投稿が更新される）。
 *
 * ■ 安全
 *   ・共有は記録ごとに本人が選ぶ（初期は「自分だけ」）。
 *   ・自由入力（教材名・コメント）は送る前に端末で NG 語・連絡先を調べ、ルールでも URL・@・長い数字を拒否する。
 *   ・表示の直前にも伏せ字にする（displaySafePublicText）。ブロックした人の投稿は出さない。
 *   ・自己申告の記録であることを画面に出す。個別チャット・自由コメント欄は作らない（リアクションだけ）。
 */
import { auth, db } from '../../firebase';
import {
  collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, startAfter, where, Timestamp, writeBatch,
} from '../../utils/firestoreMetered';
import { toFriendlyFirestoreError } from '../../utils/firestoreErrors';
import { checkNickname, checkPublicText } from '../safety/nicknameFilter';
import { COMMENT_MAX, MATERIAL_NAME_MAX, isDayKey, isStudySubject, type ManualRecord } from './manualLogCore';

export const STUDY_POSTS = 'study_posts';
export const FEED_PAGE = 20;
export type ReactionType = 'cheer' | 'nice';
export const REACTIONS: { type: ReactionType; label: string }[] = [
  { type: 'cheer', label: 'ファイト' },
  { type: 'nice', label: 'いいね' },
];

export interface StudyPost {
  id: string; uid: string; nickname: string; kind: 'manual'; day: string; subject: string;
  materialName: string; minutes: number; amount?: number; amountUnit?: string; comment?: string; createdAt: number;
}
export interface ReactionSummary { counts: Record<ReactionType, number>; mine: ReactionType | null }

const ERRORS = {
  'permission-denied': 'この操作はできません（フレンドどうしだけ・サーバーの設定が更新前の可能性もあります）。',
  unavailable: '通信できませんでした。電波のよい所でもう一度お試しください。',
  'failed-precondition': 'サーバーの準備中です。少し時間をおいてお試しください。',
} as const;
const friendly = (e: unknown, fallback: string) => toFriendlyFirestoreError(e, fallback, ERRORS);

export const postIdOf = (uid: string, recordId: string) => `${uid}_${recordId}`;
const oneLine = (s: string | undefined) => (s || '').replace(/[\r\n]+/g, ' ').trim();
/** ルールと同じ形のチェック（URL・@・メール・7けた以上の数字の並び） */
export const looksLikeContact = (s: string) => /https?:|www\.|@|＠|[0-9０-９]{7,}|[0-9０-９]{2,4}[-ー－][0-9０-９]{2,4}[-ー－][0-9０-９]{3,4}/i.test(s);

/** 共有できる内容か（送る前に端末で確かめる）。だめなら理由の文 */
export function checkShareable(record: Pick<ManualRecord, 'materialName' | 'comment'>, nickname: string): string | null {
  if (!checkNickname(nickname).ok) return 'ニックネームに使えない言葉が含まれているため共有できません。マイページで名前を直してください。';
  const material = oneLine(record.materialName); const comment = oneLine(record.comment);
  if (!checkPublicText(material, MATERIAL_NAME_MAX).ok || looksLikeContact(material)) return '教材・内容に、共有できない言葉や連絡先が含まれています。';
  if (!checkPublicText(comment, COMMENT_MAX).ok || looksLikeContact(comment)) return 'コメントに、共有できない言葉や連絡先（URL・ID・電話番号など）が含まれています。';
  return null;
}

/** 記録をフレンドに共有する（同じ記録なら上書き）。投稿IDを返す */
export async function shareRecord(record: ManualRecord, nickname: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('共有にはGoogleログインが必要です。');
  const issue = checkShareable(record, nickname);
  if (issue) throw new Error(issue);
  const id = postIdOf(uid, record.id);
  const data: Record<string, unknown> = {
    uid, nickname: nickname.trim().slice(0, 24), kind: 'manual', day: record.day, subject: record.subject,
    materialName: oneLine(record.materialName).slice(0, MATERIAL_NAME_MAX), minutes: record.minutes,
    createdAt: Timestamp.fromMillis(record.createdAt), updatedAt: serverTimestamp(),
  };
  if (record.amount != null) data.amount = record.amount;
  if (record.amount != null && record.amountUnit) data.amountUnit = record.amountUnit;
  if (oneLine(record.comment)) data.comment = oneLine(record.comment).slice(0, COMMENT_MAX);
  try { await setDoc(doc(db, STUDY_POSTS, id), data); }
  catch (e) { throw friendly(e, '共有できませんでした。'); }
  return id;
}

/** 共有をやめる（投稿とリアクションを消す）。もう無ければ何もしない */
export async function unsharePost(postId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !postId.startsWith(`${uid}_`)) return;
  try {
    const reactions = await getDocs(collection(db, STUDY_POSTS, postId, 'reactions'));
    const batch = writeBatch(db);
    reactions.docs.forEach(r => batch.delete(r.ref));
    batch.delete(doc(db, STUDY_POSTS, postId));
    await batch.commit();
  } catch (e) {
    // 投稿がもう無い（ほかの端末で消した）ときはリアクションの読み取りが拒否される。投稿だけ消してみる
    try { await deleteDoc(doc(db, STUDY_POSTS, postId)); } catch { throw friendly(e, '共有をやめられませんでした。'); }
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const millis = (v: unknown) => (v && typeof (v as Timestamp).toMillis === 'function' ? (v as Timestamp).toMillis() : 0);
export function parsePost(id: string, v: unknown): StudyPost | null {
  if (!isObj(v) || typeof v.uid !== 'string' || typeof v.nickname !== 'string' || !isDayKey(v.day) || !isStudySubject(v.subject)) return null;
  if (typeof v.minutes !== 'number' || v.minutes < 1 || v.minutes > 720) return null;
  return {
    id, uid: v.uid, nickname: v.nickname.slice(0, 24), kind: 'manual', day: v.day, subject: v.subject,
    materialName: typeof v.materialName === 'string' ? v.materialName.slice(0, MATERIAL_NAME_MAX) : '',
    minutes: Math.floor(v.minutes),
    ...(typeof v.amount === 'number' ? { amount: v.amount } : {}),
    ...(typeof v.amountUnit === 'string' ? { amountUnit: v.amountUnit.slice(0, 8) } : {}),
    ...(typeof v.comment === 'string' && v.comment ? { comment: v.comment.slice(0, COMMENT_MAX) } : {}),
    createdAt: millis(v.createdAt),
  };
}

/** 1つのクエリが返した投稿の組を、新しい順に1ページへまとめる（重複は ID で除く） */
export function mergeFeedPages(pages: StudyPost[][], pageSize = FEED_PAGE): { posts: StudyPost[]; hasMore: boolean } {
  const by = new Map<string, StudyPost>();
  let more = false;
  for (const p of pages) {
    if (p.length > pageSize) more = true;
    for (const x of p.slice(0, pageSize)) by.set(x.id, x);
  }
  const all = [...by.values()].sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1));
  return { posts: all.slice(0, pageSize), hasMore: more || all.length > pageSize };
}

/**
 * フレンド（と自分）の投稿を新しい順に。before（ミリ秒）より古いものを FEED_PAGE 件。
 *   in 句は30人ずつ。人数が多いときは組ごとに読み、まとめて並べ直す。
 */
export async function fetchFeed(uids: readonly string[], before?: number): Promise<{ posts: StudyPost[]; hasMore: boolean }> {
  const ids = [...new Set(uids)].filter(Boolean);
  if (!ids.length) return { posts: [], hasMore: false };
  const groups: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) groups.push(ids.slice(i, i + 30));
  try {
    const snaps = await Promise.all(groups.map(g => getDocs(query(collection(db, STUDY_POSTS), where('uid', 'in', g), orderBy('createdAt', 'desc'),
      ...(before ? [startAfter(Timestamp.fromMillis(before))] : []), limit(FEED_PAGE + 1)))));
    return mergeFeedPages(snaps.map(s => s.docs.map(d => parsePost(d.id, d.data())).filter((p): p is StudyPost => !!p)));
  } catch (e) { throw friendly(e, 'フレンドの記録を読み込めませんでした。'); }
}

/** 1人の共有した記録（プロフィール用・新しい順に少しだけ）。読めなければ空 */
export async function fetchUserPosts(uid: string, max = 3): Promise<StudyPost[]> {
  try {
    const snap = await getDocs(query(collection(db, STUDY_POSTS), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(max)));
    return snap.docs.map(d => parsePost(d.id, d.data())).filter((p): p is StudyPost => !!p);
  } catch { return []; }
}

/** 投稿ごとのリアクションの数と、自分が押したもの（読めない投稿は 0） */
export async function fetchReactions(postIds: readonly string[]): Promise<Record<string, ReactionSummary>> {
  const me = auth.currentUser?.uid;
  const out: Record<string, ReactionSummary> = {};
  await Promise.all(postIds.map(async id => {
    const sum: ReactionSummary = { counts: { cheer: 0, nice: 0 }, mine: null };
    try {
      const snap = await getDocs(collection(db, STUDY_POSTS, id, 'reactions'));
      for (const d of snap.docs) {
        const t = d.data().type;
        if (t === 'cheer' || t === 'nice') { sum.counts[t] += 1; if (d.id === me) sum.mine = t; }
      }
    } catch { /* 読めない投稿は 0 のまま */ }
    out[id] = sum;
  }));
  return out;
}

/** リアクションを送る／取り消す（null）。フレンドの投稿だけ（自分の投稿には押せない） */
export async function setReaction(postId: string, type: ReactionType | null): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error('Googleログインが必要です。');
  const ref = doc(db, STUDY_POSTS, postId, 'reactions', me);
  try {
    if (type) await setDoc(ref, { uid: me, type, at: serverTimestamp() });
    else await deleteDoc(ref);
  } catch (e) { throw friendly(e, 'リアクションを送れませんでした。'); }
}

/** アカウント削除のとき：自分の投稿（とリアクション）を消す */
export async function deleteAllMyPosts(uid: string): Promise<void> {
  const snap = await getDocs(query(collection(db, STUDY_POSTS), where('uid', '==', uid), limit(500)));
  for (const d of snap.docs) await unsharePost(d.id).catch(() => { /* 1件消せなくても残りの削除は続ける */ });
}
