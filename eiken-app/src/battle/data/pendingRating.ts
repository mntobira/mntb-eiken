/**
 * B6（2026-10-29）フレンド戦・全国戦で「相手の申告が届く前に画面を閉じた」ときもレートを反映する。
 *   結果画面で「部屋に戻って次の問題を選ぶ」などをすぐ押すと、画面（useBattlePostMatch）が消えて
 *   相手の申告を待つ処理も消えていた → レートが動かない試合になっていた。
 *   画面が閉じたあとも部屋を最大2分見張り、両者の申告がそろって一致したら反映する。
 */
import { watchRoom } from './battleRoomActions';
import { applyRatingResult } from './battleRanking';
import type { BattleOutcome } from '../core/types';

const WATCH_MS = 120_000;
const watching = new Set<string>();

export function settleRatingLater(p: {
  roomId: string; uid: string; opponentUid: string; opponentRating: number; outcome: BattleOutcome;
}): void {
  if (!p.roomId || !p.opponentUid || watching.has(p.roomId)) return;
  watching.add(p.roomId);
  let done = false;
  let stop: (() => void) | null = null;
  const finish = () => { if (done) return; done = true; watching.delete(p.roomId); stop?.(); clearTimeout(timer); };
  const timer = setTimeout(finish, WATCH_MS);
  stop = watchRoom(p.roomId, (room) => {
    if (done || !room) { if (!room) finish(); return; }
    const mine = room.attest?.[p.uid];
    const theirs = room.attest?.[p.opponentUid];
    if (!mine || !theirs) return;
    const agreed = (mine.outcome === 'win' && theirs.outcome === 'lose') || (mine.outcome === 'lose' && theirs.outcome === 'win') || (mine.outcome === 'draw' && theirs.outcome === 'draw');
    finish();
    // applyRatingResult は同じ部屋を二重に反映しない（lastRoomId を見る）ので、画面側と重なっても安全
    if (agreed) void applyRatingResult(p.roomId, p.opponentRating, p.outcome, false, p.opponentUid);
  });
}
