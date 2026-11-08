/**
 * 「とびらバトル／ランキング」の切替（2026-10-29 B5）。
 *   ガチャの「装飾ガチャ／ショップ」切替と同じ形。対戦画面とランキング画面の両方で、この部品をそのまま同じ位置に置く
 *   （切り替えてもボタンの形・位置・並びは変わらず、押されている方だけが変わる）。
 *   右の44pxの枠は画面ごとの小さなボタン（対戦＝BGM、ランキング＝再読み込み）。幅がそろうので切替は動かない。
 */
import type { ReactNode } from 'react';
import { Swords, Trophy } from 'lucide-react';
import './battle-rank-switch.css';

export function BattleRankSwitch({ current, onBattle, onRanking, side }: {
  current: 'battle' | 'ranking'; onBattle?: () => void; onRanking?: () => void; side?: ReactNode;
}) {
  return <div className="battle-rank-bar" data-battle-rank-switch={current}>
    <nav className="battle-rank-switch" aria-label="対戦とランキングの切替">
      <button type="button" aria-current={current === 'battle' ? 'page' : undefined} onClick={current === 'battle' ? undefined : onBattle}><Swords size={18} aria-hidden="true" />とびらバトル</button>
      <button type="button" aria-current={current === 'ranking' ? 'page' : undefined} onClick={current === 'ranking' ? undefined : onRanking}><Trophy size={18} aria-hidden="true" />ランキング</button>
    </nav>
    <span className="battle-rank-side">{side}</span>
  </div>;
}
