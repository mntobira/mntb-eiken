import React, { useMemo } from 'react';

/**
 * ★D9（2026-10-30）季節で降るものが変わる★
 *   春（3〜5月）＝桜の花びら／夏（6〜8月）＝若葉／秋（9〜11月）＝紅葉／冬（12〜2月）＝雪。
 *   端末の日付で毎回決めるので、季節が変わると自動で切り替わる（設定・更新は要らない）。
 * - 純粋なCSSアニメーションで描画（パフォーマンス配慮）。形・色は CSS（surfaces.css の [data-season]）
 * - pointer-events-none で操作を妨げない
 * - prefers-reduced-motion 環境ではアニメーションを止めて隠す（surfaces.css）
 * 名前は呼び出し側（Home.tsx）との互換のため SakuraPetals のまま。
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** 月（1〜12）から季節を決める */
export function seasonOf(date: Date = new Date()): Season {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

/** 季節ごとの色・大きさ・落ちる速さ */
const LOOK: Record<Season, { colors: string[]; size: [number, number]; duration: [number, number] }> = {
  spring: { colors: ['#FBD0DC', '#F8C2D4', '#F4A9C4', '#FADCE6'], size: [8, 18], duration: [8, 17] },
  summer: { colors: ['#9ED36A', '#7CC05A', '#B8E08A', '#5FAE4E'], size: [10, 18], duration: [9, 16] },
  autumn: { colors: ['#E4572E', '#F08A24', '#D7263D', '#F2B134', '#C0392B'], size: [12, 22], duration: [9, 16] },
  winter: { colors: ['#FFFFFF', '#F4F8FF', '#E8F1FF'], size: [5, 11], duration: [11, 20] },
};

interface SakuraPetalsProps {
  /** 降らせる枚数（デフォルト18枚） */
  count?: number;
  className?: string;
  /** 季節（省略時は今日の日付から決める） */
  season?: Season;
}

export function SakuraPetals({ count = 18, className = '', season }: SakuraPetalsProps) {
  const current = season ?? seasonOf();
  const petals = useMemo(() => {
    const look = LOOK[current];
    const between = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo);
    return Array.from({ length: count }).map((_, i) => {
      const size = between(look.size);
      return {
        key: i,
        left: Math.random() * 100,
        size,
        duration: between(look.duration),
        delay: Math.random() * 12,
        sway: 20 + Math.random() * 40,
        opacity: current === 'winter' ? 0.65 + Math.random() * 0.35 : 0.55 + Math.random() * 0.4,
        color: look.colors[i % look.colors.length],
      };
    });
  }, [count, current]);

  return (
    <div className={`sakura-container pointer-events-none ${className}`} aria-hidden="true" data-season={current}>
      {petals.map((p) => (
        <span
          key={p.key}
          className="sakura-petal"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${current === 'winter' ? p.size : p.size * 0.85}px`,
            opacity: p.opacity,
            background: p.color,
            // CSS変数でアニメーションパラメータを渡す
            '--fall-duration': `${p.duration}s`,
            '--fall-delay': `${p.delay}s`,
            '--sway': `${p.sway}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
