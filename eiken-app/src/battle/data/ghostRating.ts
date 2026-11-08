/**
 * B7（2026-10-29）全国対戦のボット戦もレートを動かす（サーバー関数 ghostMatch に結果を送る）。
 *   試合は端末内で進むのでルールではレートを書けない。サーバーが「1試合1回・1日30試合まで・小さめの変化（K=16）」で反映する。
 *   サーバーが未反映・圏外のときは null（結果画面は「反映されませんでした」を出す）。
 */
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { auth, FIREBASE_CONFIGURED, USE_EMULATORS } from '../../firebase';
import type { BattleOutcome } from '../core/types';

let fns: ReturnType<typeof getFunctions> | null = null;
function functions() {
  if (!fns) { fns = getFunctions(auth.app, 'asia-northeast1'); if (USE_EMULATORS) connectFunctionsEmulator(fns, '127.0.0.1', 5001); }
  return fns;
}

export async function applyGhostRating(input: {
  matchId: string; ghostRating: number; outcome: BattleOutcome; myScore: number; opponentScore: number;
}): Promise<{ before: number; after: number } | null> {
  if (!auth.currentUser || (!FIREBASE_CONFIGURED && !USE_EMULATORS)) return null;
  try {
    const res = await httpsCallable<typeof input, { before: number; after: number }>(functions(), 'ghostMatch')(input);
    const { before, after } = res.data ?? {};
    return Number.isFinite(before) && Number.isFinite(after) ? { before, after } : null;
  } catch { return null; }
}
