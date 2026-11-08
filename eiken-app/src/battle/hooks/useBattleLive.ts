/**
 * ===================================================================
 * useBattleLive — 実況・演出・効果音を1か所で駆動するフック
 * ===================================================================
 *
 * ■ 責務
 *   useBattleRoom（人間戦）/ useAiBattle（AI戦）が返す「いまの様子」を受け取り、
 *     ・実況ログ（FeedEntry[]）
 *     ・トースト（「CORRECT!」「COMBO ×3」「逆転！」「追いついた！」）
 *     ・相手の状態（OpponentStatus）
 *     ・局面（normal / closing / final）
 *     ・効果音のトリガ
 *   を作る。★試合の進行・採点・同期には一切関与しない★（読むだけ）。
 *
 * ■ 人間戦と AI 戦で同じフックを使う
 *   2つのフックは返す値の形を揃えてあるので、
 *   ここは「index / total / answered / opponentAnswered / reveal / scores」
 *   だけを受け取れば両方に効く。実装を2つ持つと片方だけ壊れる。
 *
 * ■ 演出のタイミング
 *   正誤に関わる演出はすべて reveal（両者解答済み or 締切）を待つ。
 *   自分が答えた直後に「CORRECT!」を出すと、画面を見せ合える環境で
 *   相手に正解が渡る（既存の設計方針と同じ）。
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  diffFeed,
  initialFeedSnapshot,
  leadOf,
  opponentStatusOf,
  phaseOf,
  pruneFeed,
  streakThrough,
  type BattlePhase,
  type FeedEntry,
  type FeedSnapshot,
  type OpponentStatus,
} from '../core/battleLive';
import type { BattlePlayerScore } from '../core/types';
import type { BattleSfx } from '../audio/battleAudio';

export interface LiveInput {
  /** 試合中か（waiting / finished では実況を止める） */
  playing: boolean;
  index: number;
  total: number;
  answered: boolean;
  opponentAnswered: boolean;
  reveal: boolean;
  myScore: BattlePlayerScore | null;
  opponentScore: BattlePlayerScore | null;
  /** 効果音を鳴らす（useBattleAudio の play） */
  play: (sfx: BattleSfx) => void;
}

/** 画面中央に短く出す演出 */
export interface LiveToast {
  id: string;
  kind: 'correct' | 'wrong' | 'combo' | 'overtake' | 'overtaken' | 'caught-up' | 'caught' | 'opponent-correct';
  text: string;
  sub?: string;
}

export const TOAST_TTL_MS = 1400;

export interface LiveState {
  phase: BattlePhase;
  feed: FeedEntry[];
  toast: LiveToast | null;
  opponent: OpponentStatus;
  /** 自分の現在の連続正解数（見せてよい範囲） */
  myStreak: number;
  /** どちらがリードしているか（確定点で判定） */
  lead: 'me' | 'opponent' | 'tie';
}

export function useBattleLive(input: LiveInput): LiveState {
  const { playing, index, total, answered, opponentAnswered, reveal, myScore, opponentScore, play } = input;

  const snapRef = useRef<FeedSnapshot>(initialFeedSnapshot());
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [toast, setToast] = useState<LiveToast | null>(null);
  const toastTimer = useRef<number | null>(null);

  const phase = phaseOf(index, total);

  // ------------------------------------------------------------
  // 差分から実況・トースト・効果音を作る
  // ------------------------------------------------------------
  useEffect(() => {
    if (!playing) return;
    const now = Date.now();
    const { entries, snapshot } = diffFeed(snapRef.current, {
      index,
      total,
      myAnswered: answered,
      opponentAnswered,
      reveal,
      myScore,
      opponentScore,
      now,
    });
    snapRef.current = snapshot;
    if (entries.length === 0) return;

    setFeed((prev) => pruneFeed([...prev, ...entries], now));

    // 効果音とトースト。優先度の高い1つだけをトーストにする。
    let nextToast: LiveToast | null = null;
    const sfx: BattleSfx[] = [];
    for (const e of entries) {
      switch (e.kind) {
        case 'answered':
          sfx.push('opponent-answered');
          break;
        case 'correct':
          if (e.who === 'me') {
            sfx.push('correct');
            nextToast = nextToast ?? { id: e.id, kind: 'correct', text: 'CORRECT!' };
          } else {
            sfx.push('opponent-correct');
            nextToast = nextToast ?? { id: e.id, kind: 'opponent-correct', text: '相手が正解！' };
          }
          break;
        case 'streak':
          if (e.who === 'me') {
            sfx.push('combo');
            const n = streakThrough(myScore, index);
            nextToast = { id: e.id, kind: 'combo', text: `COMBO ×${n}`, sub: 'CORRECT!' };
          } else {
            sfx.push('opponent-correct');
            nextToast = nextToast ?? { id: e.id, kind: 'opponent-correct', text: e.text };
          }
          break;
        case 'wrong':
          if (e.who === 'me') {
            sfx.push('wrong');
            nextToast = nextToast ?? { id: e.id, kind: 'wrong', text: 'ざんねん…' };
          }
          break;
        case 'overtake':
          // 同点からの先行（「先行！」）はトーストにせず実況だけ。逆転のときだけ大きく出す
          if (e.text.startsWith('逆転')) {
            sfx.push('overtake');
            nextToast = { id: e.id, kind: 'overtake', text: '逆転！', sub: 'POSITION CHANGE' };
          }
          break;
        case 'overtaken':
          if (e.text.startsWith('相手が逆転')) {
            sfx.push('overtaken');
            nextToast = { id: e.id, kind: 'overtaken', text: '逆転された…！', sub: 'POSITION CHANGE' };
          }
          break;
        case 'caught-up':
          sfx.push('caught-up');
          nextToast = { id: e.id, kind: 'caught-up', text: '追いついた！' };
          break;
        case 'caught':
          nextToast = { id: e.id, kind: 'caught', text: '追いつかれた！' };
          break;
        case 'final':
          sfx.push('final');
          break;
        default:
          break;
      }
    }
    // 同じ瞬間に複数鳴ると濁るので、種類を絞って鳴らす（最大2つ）
    const unique = Array.from(new Set(sfx)).slice(0, 2);
    unique.forEach((s, i) => {
      if (i === 0) play(s);
      else window.setTimeout(() => play(s), 180);
    });

    if (nextToast) {
      setToast(nextToast);
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), TOAST_TTL_MS);
    }
  }, [playing, index, total, answered, opponentAnswered, reveal, myScore, opponentScore, play]);

  // 実況の自然消滅（下から上へ流れて消える）
  useEffect(() => {
    if (feed.length === 0) return;
    const timer = window.setInterval(() => {
      setFeed((prev) => {
        const next = pruneFeed(prev, Date.now());
        return next.length === prev.length ? prev : next;
      });
    }, 400);
    return () => window.clearInterval(timer);
  }, [feed.length]);

  useEffect(
    () => () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const opponent = useMemo(
    () => opponentStatusOf(index, opponentAnswered, reveal, opponentScore),
    [index, opponentAnswered, reveal, opponentScore],
  );
  const myStreak = useMemo(() => streakThrough(myScore, reveal ? index : index - 1), [myScore, reveal, index]);
  const lead = useMemo(() => {
    // 確定していない問題の点は入れない（見せてよい範囲で判定）
    const upTo = reveal ? index : index - 1;
    const sum = (s: BattlePlayerScore | null) =>
      s ? s.perQuestion.filter((q) => q.index <= upTo).reduce((a, q) => a + q.total, 0) : 0;
    return leadOf(sum(myScore), sum(opponentScore));
  }, [myScore, opponentScore, reveal, index]);

  return { phase, feed, toast, opponent, myStreak, lead };
}
