/**
 * とびら君に部位ごとのアクセサリ（帽子・メガネ・ほっぺ・オーラ）を重ねて描く。
 *
 * ★重ね方★ ポーズ画像と同じ箱に、画像と同じ大きさの viewBox を持つ SVG を置く。
 *   画像が object-fit: contain（中央・または下寄せ）で描かれるのと同じく、
 *   SVG も preserveAspectRatio="xMid(YMid|YMax) meet" で縮むので、どの大きさでも位置がずれない。
 */
import type { ReactNode } from 'react';
import type { GrowthProgress } from '../core/growth';
import { equippedAccessory, equippedPoseSrc } from '../core/growth';
import { anchorOf, parseAccessory, type AccessorySlot } from '../core/tobiraParts';

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
const star = (cx: number, cy: number, r: number, inner = 0.45, points = 5) => {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const a = (Math.PI / points) * i - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    out.push(`${(cx + Math.cos(a) * rr).toFixed(3)},${(cy + Math.sin(a) * rr).toFixed(3)}`);
  }
  return out.join(' ');
};
const heart = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy + s * 0.9} C${cx - s * 1.4} ${cy - s * 0.1} ${cx - s * 0.7} ${cy - s * 1.1} ${cx} ${cy - s * 0.35} C${cx + s * 0.7} ${cy - s * 1.1} ${cx + s * 1.4} ${cy - s * 0.1} ${cx} ${cy + s * 0.9}Z`;

/** 帽子（原点＝つばの中央、幅1、上がマイナス） */
function Hat({ style, c }: { style: string; c: string }) {
  const dark = shade(c, 0.72);
  const ol = { stroke: shade(c, 0.5), strokeWidth: 0.018, strokeLinejoin: 'round' as const };
  switch (style) {
    case 'beanie': return <g><path d="M-0.46 0 Q-0.47 -0.56 0 -0.58 Q0.47 -0.56 0.46 0Z" fill={c} {...ol} /><path d="M-0.2 -0.5 Q-0.22 -0.25 -0.2 -0.06 M0.02 -0.56 V-0.06 M0.22 -0.5 Q0.24 -0.25 0.22 -0.06" stroke={dark} strokeWidth={0.02} fill="none" opacity={0.6} /><rect x={-0.5} y={-0.1} width={1} height={0.16} rx={0.07} fill={dark} {...ol} /><circle cy={-0.63} r={0.1} fill="#fff" stroke="#ddd" strokeWidth={0.015} /></g>;
    case 'cap': return <g><path d="M-0.42 0 Q-0.42 -0.5 0 -0.52 Q0.42 -0.5 0.42 0Z" fill={c} {...ol} /><path d="M0.05 -0.02 Q0.5 -0.08 0.72 0.03 Q0.45 0.09 0.05 0.05Z" fill={dark} {...ol} /><circle cy={-0.52} r={0.04} fill={dark} /><circle cx={-0.05} cy={-0.28} r={0.1} fill="#fff" opacity={0.9} /><text x={-0.05} y={-0.24} fontSize={0.13} textAnchor="middle" fontWeight={900} fill={c}>M</text></g>;
    case 'crown': return <g><path d="M-0.4 0 L-0.46 -0.46 L-0.22 -0.22 L0 -0.56 L0.22 -0.22 L0.46 -0.46 L0.4 0Z" fill={c} stroke="#b7791f" strokeWidth={0.02} strokeLinejoin="round" /><rect x={-0.42} y={-0.1} width={0.84} height={0.1} fill={dark} /><circle cx={0} cy={-0.28} r={0.06} fill="#e74c3c" /><circle cx={-0.26} cy={-0.06} r={0.035} fill="#3498db" /><circle cx={0.26} cy={-0.06} r={0.035} fill="#2ecc71" /><circle cx={-0.46} cy={-0.47} r={0.04} fill="#fff6c2" /><circle cx={0} cy={-0.57} r={0.04} fill="#fff6c2" /><circle cx={0.46} cy={-0.47} r={0.04} fill="#fff6c2" /></g>;
    case 'wizard': return <g><path d="M-0.36 -0.02 Q0.02 -0.6 0.12 -1.02 Q0.2 -0.8 0.36 -0.02Z" fill={c} {...ol} /><ellipse cy={0} rx={0.58} ry={0.09} fill={dark} {...ol} /><polygon points={star(0.02, -0.38, 0.08)} fill="#ffe066" /><polygon points={star(0.14, -0.62, 0.05)} fill="#ffe066" /><circle cx={-0.12} cy={-0.18} r={0.025} fill="#ffe066" /></g>;
    case 'graduation': return <g><path d="M-0.32 -0.2 V0 Q0 0.06 0.32 0 V-0.2Z" fill="#2c3e50" /><polygon points="-0.62,-0.24 0,-0.44 0.62,-0.24 0,-0.06" fill="#34495e" stroke="#1b2631" strokeWidth={0.02} strokeLinejoin="round" /><circle cy={-0.25} r={0.03} fill={c} /><path d="M0 -0.25 L0.46 -0.18 L0.5 0.12" stroke={c} strokeWidth={0.025} fill="none" /><rect x={0.46} y={0.1} width={0.08} height={0.14} rx={0.02} fill={c} /></g>;
    case 'ribbon': return <g transform="translate(0.26 -0.04) rotate(12)"><path d="M0 0 L-0.3 -0.18 Q-0.36 0 -0.3 0.18Z" fill={c} {...ol} /><path d="M0 0 L0.3 -0.18 Q0.36 0 0.3 0.18Z" fill={c} {...ol} /><path d="M-0.02 0.02 L-0.14 0.3 M0.02 0.02 L0.12 0.3" stroke={dark} strokeWidth={0.05} strokeLinecap="round" /><circle r={0.07} fill={dark} /></g>;
    case 'flower': return <g transform="translate(0.26 -0.06)">{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx={0} cy={-0.12} rx={0.08} ry={0.13} fill={c} stroke={dark} strokeWidth={0.012} transform={`rotate(${a})`} />)}<circle r={0.07} fill="#ffd43b" /><path d="M-0.08 0.14 Q-0.3 0.2 -0.36 0.1" stroke="#40916c" strokeWidth={0.04} fill="none" strokeLinecap="round" /></g>;
    case 'bunny': return <g>{[-1, 1].map((s) => <g key={s} transform={`translate(${s * 0.2} -0.06) rotate(${s * 10})`}><ellipse cy={-0.4} rx={0.11} ry={0.38} fill={c} {...ol} /><ellipse cy={-0.4} rx={0.05} ry={0.28} fill="#ffb3c7" /></g>)}<path d="M-0.44 0.02 Q0 -0.16 0.44 0.02" stroke={dark} strokeWidth={0.07} fill="none" strokeLinecap="round" /></g>;
    case 'halo': return <g><ellipse cy={-0.3} rx={0.38} ry={0.09} fill="none" stroke={c} strokeWidth={0.07} /><ellipse cy={-0.3} rx={0.38} ry={0.09} fill="none" stroke="#fffbe6" strokeWidth={0.02} /></g>;
    case 'chef': return <g><circle cx={-0.24} cy={-0.36} r={0.22} fill="#fff" stroke="#d5d8dc" strokeWidth={0.018} /><circle cx={0.24} cy={-0.36} r={0.22} fill="#fff" stroke="#d5d8dc" strokeWidth={0.018} /><circle cy={-0.5} r={0.26} fill="#fff" stroke="#d5d8dc" strokeWidth={0.018} /><rect x={-0.4} y={-0.24} width={0.8} height={0.26} rx={0.04} fill="#fff" stroke="#d5d8dc" strokeWidth={0.018} /><rect x={-0.4} y={-0.08} width={0.8} height={0.06} fill={c} /></g>;
    case 'beret': return <g><ellipse cx={0.06} cy={-0.12} rx={0.54} ry={0.2} fill={c} {...ol} /><rect x={-0.4} y={-0.06} width={0.8} height={0.08} rx={0.04} fill={dark} /><path d="M0.06 -0.32 q0.02 -0.08 0.08 -0.1" stroke={dark} strokeWidth={0.04} fill="none" strokeLinecap="round" /></g>;
    case 'tiara': return <g><path d="M-0.4 0 Q0 -0.14 0.4 0" stroke={c} strokeWidth={0.05} fill="none" /><path d="M-0.28 -0.06 L-0.2 -0.24 L-0.1 -0.1 L0 -0.34 L0.1 -0.1 L0.2 -0.24 L0.28 -0.06" stroke={c} strokeWidth={0.04} fill="none" strokeLinejoin="round" /><circle cy={-0.36} r={0.05} fill="#ff6b9d" /><circle cx={-0.2} cy={-0.26} r={0.03} fill="#74c0fc" /><circle cx={0.2} cy={-0.26} r={0.03} fill="#74c0fc" /></g>;
    case 'headphones': return <g><path d="M-0.46 0.1 Q-0.5 -0.6 0 -0.62 Q0.5 -0.6 0.46 0.1" stroke={c} strokeWidth={0.07} fill="none" strokeLinecap="round" /><rect x={-0.58} y={-0.04} width={0.18} height={0.3} rx={0.08} fill={c} {...ol} /><rect x={0.4} y={-0.04} width={0.18} height={0.3} rx={0.08} fill={c} {...ol} /><circle cx={-0.49} cy={0.11} r={0.05} fill="#fff" opacity={0.7} /><circle cx={0.49} cy={0.11} r={0.05} fill="#fff" opacity={0.7} /></g>;
    case 'sprout': return <g><path d="M0 0 Q0.02 -0.22 0 -0.34" stroke="#2f9e44" strokeWidth={0.045} fill="none" strokeLinecap="round" /><path d="M0 -0.3 Q-0.24 -0.44 -0.3 -0.26 Q-0.14 -0.18 0 -0.3Z" fill={c} {...ol} /><path d="M0 -0.32 Q0.22 -0.5 0.3 -0.32 Q0.14 -0.22 0 -0.32Z" fill={c} {...ol} /></g>;
    case 'hachimaki': return <g><path d="M-0.47 -0.02 Q0 -0.16 0.47 -0.02 L0.47 0.08 Q0 -0.06 -0.47 0.08Z" fill={c} {...ol} /><circle cx={0} cy={-0.035} r={0.055} fill="#ffffff" stroke={dark} strokeWidth={0.012} /><path d="M0.44 0.0 Q0.6 0.05 0.72 0.2 L0.62 0.22 Q0.56 0.1 0.44 0.06Z" fill={c} {...ol} /><path d="M0.44 0.03 Q0.52 0.16 0.56 0.32 L0.47 0.3 Q0.46 0.16 0.42 0.06Z" fill={dark} {...ol} /></g>;
    default: return null;
  }
}

/** メガネ（原点＝両目の中心、幅1＝両目を覆う幅） */
function Glasses({ style, c }: { style: string; c: string }) {
  const w = 0.045;
  const lens = (x: number, node: (x: number) => ReactNode) => <g key={x}>{node(x)}</g>;
  const temples = <path d="M-0.49 -0.02 L-0.62 -0.06 M0.49 -0.02 L0.62 -0.06" stroke={c} strokeWidth={w} strokeLinecap="round" />;
  switch (style) {
    case 'round': return <g>{[-0.27, 0.27].map((x) => lens(x, (x) => <circle cx={x} r={0.22} fill="#ffffff26" stroke={c} strokeWidth={w} />))}<path d="M-0.05 -0.02 Q0 -0.07 0.05 -0.02" stroke={c} strokeWidth={w} fill="none" />{temples}</g>;
    case 'square': return <g>{[-0.27, 0.27].map((x) => lens(x, (x) => <rect x={x - 0.22} y={-0.17} width={0.44} height={0.34} rx={0.06} fill="#ffffff26" stroke={c} strokeWidth={w * 1.2} />))}<path d="M-0.05 -0.03 H0.05" stroke={c} strokeWidth={w} />{temples}</g>;
    case 'sun': return <g>{[-0.27, 0.27].map((x) => lens(x, (x) => <path d={`M${x - 0.23} -0.14 H${x + 0.23} Q${x + 0.24} 0.2 ${x} 0.2 Q${x - 0.24} 0.2 ${x - 0.23} -0.14Z`} fill="#1b2631" fillOpacity={0.88} stroke={c} strokeWidth={w} />))}<path d="M-0.05 -0.1 H0.05" stroke={c} strokeWidth={w} /><path d="M-0.4 -0.08 l0.08 0.1 M0.14 -0.08 l0.08 0.1" stroke="#fff" strokeWidth={0.025} opacity={0.6} />{temples}</g>;
    case 'star': return <g>{[-0.27, 0.27].map((x) => lens(x, (x) => <polygon points={star(x, 0, 0.26, 0.55)} fill={c} fillOpacity={0.35} stroke={c} strokeWidth={w} strokeLinejoin="round" />))}<path d="M-0.06 -0.02 H0.06" stroke={c} strokeWidth={w} />{temples}</g>;
    case 'heart': return <g>{[-0.27, 0.27].map((x) => lens(x, (x) => <path d={heart(x, 0.02, 0.2)} fill={c} fillOpacity={0.4} stroke={c} strokeWidth={w} />))}<path d="M-0.08 -0.04 H0.08" stroke={c} strokeWidth={w} />{temples}</g>;
    case 'monocle': return <g><circle cx={0.27} r={0.22} fill="#ffffff26" stroke={c} strokeWidth={w * 1.2} /><path d="M0.4 0.18 Q0.5 0.5 0.3 0.8" stroke={c} strokeWidth={0.02} fill="none" strokeDasharray="0.03 0.02" /></g>;
    case 'goggle': return <g><path d="M-0.62 -0.04 H0.62" stroke={shade(c, 0.6)} strokeWidth={0.09} /><rect x={-0.52} y={-0.2} width={1.04} height={0.4} rx={0.18} fill="#9bdcfd" fillOpacity={0.55} stroke={c} strokeWidth={w * 1.6} /><path d="M-0.36 -0.1 l0.12 0.14 M0.14 -0.1 l0.12 0.14" stroke="#fff" strokeWidth={0.03} opacity={0.8} /></g>;
    case 'science': return <g><path d="M-0.55 -0.14 Q0 -0.24 0.55 -0.14 L0.5 0.14 Q0.25 0.24 0.05 0.12 Q0 0.08 -0.05 0.12 Q-0.25 0.24 -0.5 0.14Z" fill="#e3fafc" fillOpacity={0.5} stroke={c} strokeWidth={w} strokeLinejoin="round" /></g>;
    case 'pixel': return <g><rect x={-0.54} y={-0.12} width={0.46} height={0.24} fill="#111" /><rect x={0.08} y={-0.12} width={0.46} height={0.24} fill="#111" /><rect x={-0.08} y={-0.12} width={0.16} height={0.06} fill="#111" /><rect x={-0.48} y={-0.08} width={0.08} height={0.06} fill="#fff" /><rect x={0.14} y={-0.08} width={0.08} height={0.06} fill="#fff" /><rect x={-0.62} y={-0.12} width={0.08} height={0.06} fill={c} /><rect x={0.54} y={-0.12} width={0.08} height={0.06} fill={c} /></g>;
    default: return null;
  }
}

/** ほっぺ（原点＝両目の中心、幅1＝両目を覆う幅） */
function Cheeks({ style, c }: { style: string; c: string }) {
  const at = [-0.44, 0.44];
  switch (style) {
    case 'blush': return <g>{at.map((x) => <ellipse key={x} cx={x} cy={0.4} rx={0.13} ry={0.08} fill={c} opacity={0.5} />)}</g>;
    case 'star': return <g>{at.map((x) => <polygon key={x} points={star(x, 0.4, 0.09)} fill={c} opacity={0.85} />)}</g>;
    case 'heart': return <g>{at.map((x) => <path key={x} d={heart(x, 0.4, 0.07)} fill={c} opacity={0.8} />)}</g>;
    case 'sticker': return <g transform="translate(0.44 0.42) rotate(-20)"><rect x={-0.13} y={-0.05} width={0.26} height={0.1} rx={0.04} fill={c} stroke={shade(c, 0.8)} strokeWidth={0.01} /><rect x={-0.04} y={-0.04} width={0.08} height={0.08} fill="#fff" opacity={0.6} /></g>;
    case 'whisker': return <g stroke={c} strokeWidth={0.02} strokeLinecap="round">{at.map((x) => { const s = Math.sign(x); return <g key={x}><path d={`M${x - s * 0.05} 0.36 l${s * 0.18} -0.04`} /><path d={`M${x - s * 0.05} 0.42 l${s * 0.19} 0.01`} /><path d={`M${x - s * 0.05} 0.48 l${s * 0.17} 0.05`} /></g>; })}</g>;
    case 'sparkle': return <g>{at.map((x) => <polygon key={x} points={star(x, 0.4, 0.1, 0.3, 4)} fill={c} opacity={0.9} />)}</g>;
    default: return null;
  }
}

const AURA_POINTS: readonly (readonly [number, number, number])[] = [[0.07, 0.18, 1], [0.93, 0.12, 0.8], [0.03, 0.55, 0.7], [0.97, 0.5, 1], [0.12, 0.88, 0.8], [0.9, 0.86, 0.9], [0.5, -0.02, 0.6]];
/** オーラ（画像全体のまわり。w,h は画像の大きさ） */
function Aura({ style, c, w, h }: { style: string; c: string; w: number; h: number }) {
  const u = Math.min(w, h) * 0.07;
  return <g className="tobira-aura">{AURA_POINTS.map(([px, py, s], i) => {
    const x = px * w, y = py * h, r = u * s;
    const key = `${style}${i}`;
    const delay = { animationDelay: `${(i * 0.37) % 1.8}s` };
    let el: ReactNode = null;
    switch (style) {
      case 'sparkle': el = <polygon points={star(x, y, r, 0.28, 4)} fill={c} />; break;
      case 'stars': el = <polygon points={star(x, y, r)} fill={c} />; break;
      case 'hearts': el = <path d={heart(x, y, r * 0.7)} fill={c} />; break;
      case 'notes': el = <text x={x} y={y} fontSize={r * 2} textAnchor="middle" fill={c} fontWeight={700}>{i % 2 ? '♫' : '♪'}</text>; break;
      case 'bubbles': el = <circle cx={x} cy={y} r={r * 0.7} fill={`${c}33`} stroke={c} strokeWidth={r * 0.12} />; break;
      case 'formula': el = <text x={x} y={y} fontSize={r * 1.3} textAnchor="middle" fill={c} fontWeight={800} fontStyle="italic">{['π', 'H₂O', '∫', 'Σ', 'e', 'CO₂', '√'][i]}</text>; break;
      case 'petals': el = <ellipse cx={x} cy={y} rx={r * 0.45} ry={r * 0.75} fill={c} transform={`rotate(${i * 47} ${x} ${y})`} />; break;
      case 'flame': el = <path d={`M${x} ${y - r} Q${x + r * 0.7} ${y} ${x} ${y + r * 0.7} Q${x - r * 0.7} ${y} ${x} ${y - r}Z`} fill={c} />; break;
      case 'snow': el = <g stroke={c} strokeWidth={r * 0.14} strokeLinecap="round">{[0, 60, 120].map((a) => <path key={a} d={`M${x} ${y - r * 0.8} V${y + r * 0.8}`} transform={`rotate(${a} ${x} ${y})`} />)}</g>; break;
      case 'abc': el = <text x={x} y={y} fontSize={r * 1.5} textAnchor="middle" fill={c} fontWeight={900}>{['A', 'b', 'C', 'e', 'S', 'w', '?'][i]}</text>; break;
      case 'bolt': el = <path d={`M${x + r * 0.2} ${y - r} L${x - r * 0.5} ${y + r * 0.1} H${x} L${x - r * 0.2} ${y + r} L${x + r * 0.5} ${y - r * 0.1} H${x}Z`} fill={c} />; break;
      case 'pencil': el = <g transform={`rotate(${i * 47 - 60} ${x} ${y})`}><rect x={x - r * 0.22} y={y - r} width={r * 0.44} height={r * 1.3} rx={r * 0.06} fill={c} /><rect x={x - r * 0.22} y={y - r} width={r * 0.44} height={r * 0.22} fill="#f28aa0" /><polygon points={`${x - r * 0.22},${y + r * 0.3} ${x + r * 0.22},${y + r * 0.3} ${x},${y + r}`} fill="#f5d6a8" /><polygon points={`${x - r * 0.07},${y + r * 0.76} ${x + r * 0.07},${y + r * 0.76} ${x},${y + r}`} fill="#333333" /></g>; break;
      default: return null;
    }
    return <g key={key} className="tobira-aura-bit" style={delay}>{el}</g>;
  })}</g>;
}

export function AccessoryLayer({ poseSrc, parts, align = 'center' }: {
  poseSrc: string;
  parts: Partial<Record<AccessorySlot, string>>;
  /** ポーズ画像の object-position（中央か下寄せ）に合わせる */
  align?: 'center' | 'bottom';
}) {
  const a = anchorOf(poseSrc);
  const hat = parts.hat ? parseAccessory('hat', parts.hat) : null;
  const glasses = parts.glasses ? parseAccessory('glasses', parts.glasses) : null;
  const cheek = parts.cheek ? parseAccessory('cheek', parts.cheek) : null;
  const aura = parts.aura ? parseAccessory('aura', parts.aura) : null;
  if (!hat && !glasses && !cheek && !aura) return null;
  const [hx, hy, hw, hr] = a.head;
  const [ex, ey, ew, er] = a.eyes;
  return <svg className="tobira-accessories" viewBox={`0 0 ${a.w} ${a.h}`} preserveAspectRatio={align === 'bottom' ? 'xMidYMax meet' : 'xMidYMid meet'} aria-hidden="true" focusable="false">
    {aura && <Aura style={aura.style} c={aura.color} w={a.w} h={a.h} />}
    {(cheek || glasses) && <g transform={`translate(${ex * a.w} ${ey * a.h}) rotate(${er}) scale(${ew * a.w})`}>
      {cheek && <Cheeks style={cheek.style} c={cheek.color} />}
      {glasses && <Glasses style={glasses.style} c={glasses.color} />}
    </g>}
    {hat && <g transform={`translate(${hx * a.w} ${hy * a.h}) rotate(${hr}) scale(${hw * a.w})`}><Hat style={hat.style} c={hat.color} /></g>}
  </svg>;
}

/** 装備中のアクセサリを、装備中のポーズに合わせて重ねる */
export function TobiraAccessories({ progress, align = 'center' }: { progress: GrowthProgress; align?: 'center' | 'bottom' }) {
  return <AccessoryLayer poseSrc={equippedPoseSrc(progress)} align={align}
    parts={{ hat: equippedAccessory(progress, 'hat'), glasses: equippedAccessory(progress, 'glasses'), cheek: equippedAccessory(progress, 'cheek'), aura: equippedAccessory(progress, 'aura') }} />;
}
