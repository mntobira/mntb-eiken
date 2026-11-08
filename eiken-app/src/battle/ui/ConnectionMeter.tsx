/**
 * 電波のアンテナ表示（対戦中）。
 *
 * 市販の対戦ゲームと同じく、いまの通信の具合を常に小さく見せる。
 * 「負けたのは回線のせい？」を利用者が自分で判断できるようにする。
 * 往復時間は対戦の書き込みの応答から測っており、専用の通信は増やしていない。
 */
import type { ConnectionQuality } from '../core/connection';

const LABEL: Record<ConnectionQuality, string> = {
  good: '通信良好',
  fair: '通信やや遅め',
  poor: '通信が不安定',
  offline: '通信が切れています',
};
const BARS: Record<ConnectionQuality, number> = { good: 3, fair: 2, poor: 1, offline: 0 };
const COLOR: Record<ConnectionQuality, string> = { good: '#27AE60', fair: '#E0A800', poor: '#E67E22', offline: '#C0392B' };

export function ConnectionMeter({ quality, rttMs, sending }: { quality: ConnectionQuality; rttMs: number | null; sending?: boolean }) {
  const bars = BARS[quality];
  return (
    <div className="connection-meter" data-quality={quality} role="status" aria-label={`${LABEL[quality]}${rttMs != null ? `（応答 ${rttMs}ミリ秒）` : ''}`}>
      <span className="connection-meter-bars" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <i key={n} style={{ height: `${n * 4 + 2}px`, background: n <= bars ? COLOR[quality] : '#D5DBE1' }} />
        ))}
      </span>
      <span className="connection-meter-label">{LABEL[quality]}{rttMs != null && quality !== 'offline' ? ` · ${rttMs}ms` : ''}</span>
      {sending && <span className="connection-meter-sending">送信中…</span>}
    </div>
  );
}
