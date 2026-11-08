/**
 * ===================================================================
 * F10（2026-11-05）対戦の部屋（battle_lobbies）
 * ===================================================================
 *   全国対戦で1回マッチしたら、2人は「対戦の部屋」に入る。
 *     1. それぞれが希望の単元（英単語・リスニング・英文法…どれでも）をえらぶ
 *     2. 2人ともえらんだら、部屋主（players[0]）の端末が2つのうちどちらかをランダムに選び、
 *        試合（battle_rooms・mode:'lobby'）を作る。部屋の round を1つ進め、えらんだ単元は空にする
 *     3. 試合が終わって「対戦の部屋に戻る」を押すと、同じ部屋に戻る → またえらんで再戦
 *   ルールは firestore.rules の battle_lobbies と battleLobbyStartOk（tests/battleLobby.rules.test.ts）。
 *
 * ★マッチの仕組みは全国対戦（findOrEnqueue）と同じ★
 *   待機列 battle_queue に subject:'lobby:v1' の票を置き、相手の票を消す書き込みと同じトランザクションで部屋を作る。
 *   部屋IDは「lb_＋待っていた側の検索ID」なので、待っている側はその1件を見張るだけで済む（一覧の購読が要らない）。
 */
import { auth, db } from '../../firebase';
import { deleteField, doc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from '../../utils/firestoreMetered';
import { arenaRule } from '../core/arenaRules';
import { normalizeRule } from '../core/battleRules';
import type { BattlePlayer } from '../core/types';
import { COL_QUEUE, COL_ROOMS, drawQuestionIds, fetchMyRating, friendlyError, myProfile, requireUid } from './battleShared';
import { loadRuleSync } from './battleRuleOverrides';
import { fetchWaitingQueue, leaveQueue } from './battleMatchmaking';
import { blockedUidSet } from '../../features/safety/userSafety';

export const COL_LOBBIES = 'battle_lobbies';
export const LOBBY_QUEUE_SUBJECT = 'lobby:v1';
export const lobbyIdFor = (sessionId: string) => `lb_${sessionId}`;

export type LobbyCount = 5 | 10 | 15;
export interface LobbyPick { subject: string; chapterId: string; count: LobbyCount; title: string }
export interface LobbyChosen extends LobbyPick { uid: string }
export interface BattleLobbyDoc {
  id: string;
  status: 'open' | 'closed';
  /** 全国対戦のマッチ部屋か、4文字コードで入るフレンド部屋か */
  kind?: 'national' | 'friend';
  /** フレンド部屋だけが持つ4文字コードとホスト */
  joinCode?: string;
  hostUid?: string;
  players: string[];
  profiles: Record<string, BattlePlayer>;
  picks: Record<string, LobbyPick>;
  /** 何戦目まで始めたか（0 = まだ1戦もしていない） */
  round: number;
  /** いちばん新しい試合の部屋ID（空 = まだ無い） */
  roomId: string;
  /** いちばん新しい試合で選ばれた単元（だれの希望か） */
  chosen: LobbyChosen | null;
  left?: Record<string, unknown>;
}

/** 2人の希望からどちらかを選ぶ（rand は 0〜1）。2人ともえらんでいなければ null */
export function chooseLobbyPick(lobby: Pick<BattleLobbyDoc, 'players' | 'picks'>, rand: number): LobbyChosen | null {
  const [a, b] = lobby.players;
  const pa = a ? lobby.picks[a] : undefined;
  const pb = b ? lobby.picks[b] : undefined;
  if (!a || !b || !pa || !pb) return null;
  return rand < 0.5 ? { uid: a, ...pa } : { uid: b, ...pb };
}

/** 2人とも単元をえらび終えたか */
export const bothPicked = (lobby: Pick<BattleLobbyDoc, 'players' | 'picks'>) =>
  lobby.players.length === 2 && lobby.players.every((u) => !!lobby.picks[u]);

/**
 * マッチ（全国対戦と同じ待機列）。相手を拾えたら部屋IDを返す。
 * 見つからなければ null（自分の票を置いたまま。watchLobbyCreated で拾われるのを待つ）。
 */
export async function findOrEnqueueLobby(sessionId: string, signal?: AbortSignal): Promise<string | null> {
  const uid = requireUid();
  const rating = await fetchMyRating();
  signal?.throwIfAborted();
  const ownRef = doc(db, COL_QUEUE, uid);
  try {
    await setDoc(ownRef, { uid, subject: LOBBY_QUEUE_SUBJECT, profile: { ...myProfile(rating), matchSessionId: sessionId }, createdAt: serverTimestamp() });
  } catch (error) {
    throw friendlyError(error, '待機列に入れませんでした。');
  }
  if (signal?.aborted) { await leaveQueue(sessionId, uid); signal.throwIfAborted(); }
  let waiting;
  try {
    waiting = await fetchWaitingQueue(LOBBY_QUEUE_SUBJECT);
  } catch (error) {
    void leaveQueue(sessionId, uid);
    throw friendlyError(error, 'マッチングに失敗しました。');
  }
  const blocked = blockedUidSet();
  for (const candidate of waiting.filter((d) => d.id !== uid && !blocked.has(d.id)).slice(0, 3)) {
    signal?.throwIfAborted();
    const otherRef = doc(db, COL_QUEUE, candidate.id);
    try {
      const made = await runTransaction(db, async (tx) => {
        const mine = await tx.get(ownRef);
        const other = await tx.get(otherRef);
        if (!mine.exists() || !other.exists()) return null;
        if (signal?.aborted || auth.currentUser?.uid !== uid) return null;
        if (mine.get('profile')?.matchSessionId !== sessionId) return null;
        if (mine.get('subject') !== LOBBY_QUEUE_SUBJECT || other.get('subject') !== LOBBY_QUEUE_SUBJECT) return null;
        const otherProfile = other.get('profile') as (BattlePlayer & { matchSessionId?: string }) | undefined;
        const otherSession = String(otherProfile?.matchSessionId || '');
        if (!otherSession) return null;
        const lobbyId = lobbyIdFor(otherSession);
        tx.delete(ownRef);
        tx.delete(otherRef);
        tx.set(doc(db, COL_LOBBIES, lobbyId), {
          id: lobbyId, status: 'open', players: [uid, other.id],
          profiles: {
            [uid]: myProfile(rating),
            [other.id]: { uid: other.id, nickname: otherProfile?.nickname || '対戦相手', photoURL: otherProfile?.photoURL || '', rating: otherProfile?.rating ?? 1500 },
          },
          picks: {}, round: 0, roomId: '', chosen: null,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        return lobbyId;
      });
      if (made) return made;
    } catch (error) {
      throw friendlyError(error, 'マッチングに失敗しました。');
    }
  }
  return null;
}

/** 待っている側：自分の部屋（lb_＋自分の検索ID）ができたら知らせる */
export function watchLobbyCreated(sessionId: string, onCreated: (lobbyId: string) => void, onError?: (e: unknown) => void): Unsubscribe {
  const id = lobbyIdFor(sessionId);
  return onSnapshot(doc(db, COL_LOBBIES, id), (snap) => {
    if (snap.exists() && snap.get('status') === 'open') onCreated(id);
  }, (e) => onError?.(e));
}

export function watchLobby(lobbyId: string, onChange: (lobby: BattleLobbyDoc | null) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(doc(db, COL_LOBBIES, lobbyId), (snap) => {
    const fromCache = snap.metadata.fromCache;
    if (!snap.exists()) { if (!fromCache) onChange(null); return; }
    onChange({ id: snap.id, ...(snap.data() as object) } as BattleLobbyDoc);
  }, (e) => onError?.(friendlyError(e, '対戦の部屋の通信が切れました。')));
}

/** 自分の希望の単元をえらぶ（null で取り消し） */
export async function setLobbyPick(lobbyId: string, pick: LobbyPick | null): Promise<void> {
  const uid = requireUid();
  try {
    await updateDoc(doc(db, COL_LOBBIES, lobbyId), {
      [`picks.${uid}`]: pick ? { subject: pick.subject, chapterId: pick.chapterId, count: pick.count, title: pick.title.slice(0, 80) } : deleteField(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw friendlyError(error, '単元を保存できませんでした。');
  }
}

/**
 * 部屋主：2人の希望からどちらかをランダムに選び、試合を作る。
 * 作った試合の部屋IDを返す（相手の端末は部屋の roomId が変わったのを見て入ってくる）。
 */
export async function startLobbyRound(lobby: BattleLobbyDoc, rand = randomUnit()): Promise<string> {
  const uid = requireUid();
  if (lobby.players[0] !== uid) throw new Error('試合を始めるのは部屋主の端末です。');
  const chosen = chooseLobbyPick(lobby, rand);
  if (!chosen) throw new Error('2人とも単元をえらぶと始まります。');
  const rules = arenaRule(normalizeRule(chosen.subject, { ...loadRuleSync(chosen.subject), questionCount: chosen.count }));
  const lobbyRef = doc(db, COL_LOBBIES, lobby.id);
  const roomRef = doc(db, COL_ROOMS, `${lobby.id}_r${lobby.round + 1}`);
  const questionIds = await drawQuestionIds(chosen.subject, rules, roomRef.id, chosen.chapterId || undefined);
  if (questionIds.length === 0) throw new Error('えらばれた単元に、対戦できる問題がまだ足りません。単元をえらび直してください。');
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(lobbyRef);
      const now = snap.data() as BattleLobbyDoc | undefined;
      if (!now || now.status !== 'open' || now.round !== lobby.round) throw new Error('LOBBY_MOVED');
      const still = now.picks?.[chosen.uid];
      if (!still || still.subject !== chosen.subject || still.chapterId !== chosen.chapterId || still.count !== chosen.count) throw new Error('LOBBY_MOVED');
      if (!bothPicked(now)) throw new Error('LOBBY_MOVED');
      const [a, b] = now.players as [string, string];
      tx.set(roomRef, {
        id: roomRef.id, status: 'waiting', mode: 'lobby', subject: chosen.subject, joinCode: '', hostUid: a,
        players: [a, b], profiles: { [a]: now.profiles[a], [b]: now.profiles[b] },
        questionIds, rules, currentIndex: 0, deadlineAt: null,
        answers: { [a]: {}, [b]: {} }, attest: {},
        lobbyId: lobby.id, lobbyRound: now.round + 1,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      tx.update(lobbyRef, { round: now.round + 1, picks: {}, roomId: roomRef.id, chosen, updatedAt: serverTimestamp() });
    });
  } catch (error) {
    if ((error as Error)?.message === 'LOBBY_MOVED') throw new Error('相手が単元をえらび直しました。もう一度抽選します。');
    throw friendlyError(error, '試合を始められませんでした。');
  }
  return roomRef.id;
}

/** 部屋を出る（部屋は閉じる。相手には「相手が部屋を出ました」と出る） */
export async function leaveLobby(lobbyId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, COL_LOBBIES, lobbyId);
      const snap = await tx.get(ref);
      if (!snap.exists() || snap.get('status') !== 'open' || snap.get('left')) return;
      const joinCode = String(snap.get('joinCode') || '');
      if (snap.get('kind') === 'friend' && joinCode) {
        const codeRef = doc(db, 'battle_codes', joinCode);
        const codeSnap = await tx.get(codeRef);
        if (codeSnap.exists() && codeSnap.get('lobbyId') === lobbyId) tx.delete(codeRef);
      }
      tx.update(ref, { status: 'closed', [`left.${uid}`]: serverTimestamp(), updatedAt: serverTimestamp() });
    });
  } catch {
    // 出る記録に失敗しても、自分の画面はメニューに戻る（相手は部屋に残るだけ）
  }
}

function randomUnit(): number {
  const v = new Uint32Array(1);
  crypto.getRandomValues(v);
  return v[0] / 4294967296;
}
