import type { ScbtIllustrationFrame } from './speakingTypes';

/**
 * 完全オリジナルのクリーンな白黒線画 SVG イラストカード。
 * 外部商用画像への依存ゼロ・通信負荷ゼロで S-CBT 問題カード（3コマ展開／場面描写）を明瞭に提示する。
 */
export function ScbtIllustrationCard({
  frames,
}: {
  frames: readonly ScbtIllustrationFrame[];
}) {
  return (
    <div className="scbt-illus-grid" aria-label="問題カードのイラスト">
      {frames.map((frame, idx) => (
        <figure key={`${frame.svgType}-${idx}`} className="scbt-illus-frame" style={{ margin: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 800,
              color: '#1e293b',
            }}
          >
            <span>{frame.frameLabel}</span>
            {frames.length > 1 && <span>({idx + 1}/{frames.length})</span>}
          </div>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {renderFrameSvg(frame)}
          </div>

          {frame.captionEn && (
            <div
              lang="en"
              style={{
                fontSize: '12.5px',
                fontWeight: 800,
                color: '#0f172a',
                textAlign: 'center',
                background: '#f1f5f9',
                borderRadius: '6px',
                padding: '3px 8px',
              }}
            >
              {frame.captionEn}
            </div>
          )}
          <figcaption style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.45 }}>
            {frame.sceneDescriptionJp}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function renderFrameSvg(frame: ScbtIllustrationFrame) {
  if (frame.svgType === 'sports_locker') {
    if (frame.frameIndex === 0) {
      return (
        <svg viewBox="0 0 260 135" width="100%" role="img" aria-label={frame.frameLabel}>
          <rect x="8" y="8" width="244" height="119" rx="6" fill="#fff" stroke="#334155" strokeWidth="2" />
          {/* Broken net */}
          <line x1="36" y1="45" x2="36" y2="112" stroke="#1e293b" strokeWidth="3" />
          <line x1="150" y1="45" x2="150" y2="112" stroke="#1e293b" strokeWidth="3" />
          <path d="M36 52 Q90 74 150 52" fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="5 4" />
          <text x="64" y="42" fontSize="10" fontWeight="bold" fill="#334155">Broken Net</text>
          {/* Poster */}
          <rect x="175" y="24" width="64" height="52" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.8" />
          <text x="183" y="40" fontSize="8.5" fontWeight="bold" fill="#0f172a">REPAIR</text>
          <text x="181" y="52" fontSize="8" fill="#0f172a">WORKSHOP</text>
          <text x="185" y="65" fontSize="7.5" fill="#334155">Saturday</text>
          {/* Two people */}
          <circle cx="72" cy="82" r="9" fill="none" stroke="#1e293b" strokeWidth="2" />
          <line x1="72" y1="91" x2="72" y2="116" stroke="#1e293b" strokeWidth="2" />
          <circle cx="118" cy="78" r="10" fill="none" stroke="#1e293b" strokeWidth="2" />
          <line x1="118" y1="88" x2="118" y2="116" stroke="#1e293b" strokeWidth="2" />
        </svg>
      );
    }
    if (frame.frameIndex === 1) {
      return (
        <svg viewBox="0 0 260 135" width="100%" role="img" aria-label={frame.frameLabel}>
          <rect x="8" y="8" width="244" height="119" rx="6" fill="#fff" stroke="#334155" strokeWidth="2" />
          <rect x="45" y="78" width="170" height="10" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.8" />
          <text x="72" y="28" fontSize="10.5" fontWeight="bold" fill="#0f172a">Community Gym</text>
          {/* Volunteer & students fixing rackets */}
          <circle cx="80" cy="54" r="10" fill="none" stroke="#1e293b" strokeWidth="2" />
          <line x1="80" y1="64" x2="80" y2="78" stroke="#1e293b" strokeWidth="2" />
          <circle cx="135" cy="56" r="9" fill="none" stroke="#1e293b" strokeWidth="2" />
          <line x1="135" y1="65" x2="135" y2="78" stroke="#1e293b" strokeWidth="2" />
          <ellipse cx="168" cy="64" rx="14" ry="9" fill="none" stroke="#1e293b" strokeWidth="2" />
          <line x1="182" y1="64" x2="202" y2="74" stroke="#1e293b" strokeWidth="2.2" />
          <text x="82" y="108" fontSize="9.5" fill="#334155">Fixing nets &amp; rackets</text>
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 260 135" width="100%" role="img" aria-label={frame.frameLabel}>
        <rect x="8" y="8" width="244" height="119" rx="6" fill="#fff" stroke="#334155" strokeWidth="2" />
        <line x1="45" y1="45" x2="45" y2="112" stroke="#1e293b" strokeWidth="3" />
        <line x1="215" y1="45" x2="215" y2="112" stroke="#1e293b" strokeWidth="3" />
        <rect x="45" y="50" width="170" height="22" fill="none" stroke="#1e293b" strokeWidth="2" />
        <circle cx="82" cy="84" r="9" fill="none" stroke="#1e293b" strokeWidth="2" />
        <circle cx="130" cy="84" r="9" fill="none" stroke="#1e293b" strokeWidth="2" />
        <circle cx="178" cy="84" r="9" fill="none" stroke="#1e293b" strokeWidth="2" />
        <text x="66" y="34" fontSize="10" fontWeight="bold" fill="#0f172a">Repaired Net &amp; Practice!</text>
      </svg>
    );
  }

  if (frame.svgType === 'cafeteria_order') {
    const labels = ['SOLD OUT', 'Morning Tablet Order', 'Express Pickup'];
    return (
      <svg viewBox="0 0 260 135" width="100%" role="img" aria-label={frame.frameLabel}>
        <rect x="8" y="8" width="244" height="119" rx="6" fill="#fff" stroke="#334155" strokeWidth="2" />
        <rect x="30" y="22" width="200" height="26" rx="4" fill="#f1f5f9" stroke="#1e293b" strokeWidth="1.6" />
        <text x="130" y="39" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0f172a">
          {labels[frame.frameIndex] || 'Cafeteria'}
        </text>
        {frame.frameIndex === 0 && (
          <>
            <rect x="46" y="62" width="84" height="44" fill="none" stroke="#1e293b" strokeWidth="2" />
            <text x="88" y="88" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">Lunch A: X</text>
            <circle cx="178" cy="74" r="11" fill="none" stroke="#1e293b" strokeWidth="2" />
            <line x1="178" y1="85" x2="178" y2="112" stroke="#1e293b" strokeWidth="2" />
          </>
        )}
        {frame.frameIndex === 1 && (
          <>
            <rect x="92" y="60" width="76" height="48" rx="6" fill="#fff" stroke="#1e293b" strokeWidth="2.2" />
            <text x="130" y="83" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#0f172a">[ Order Lunch ]</text>
            <text x="130" y="98" textAnchor="middle" fontSize="8.5" fill="#334155">8:15 AM</text>
          </>
        )}
        {frame.frameIndex === 2 && (
          <>
            <circle cx="95" cy="76" r="10" fill="none" stroke="#1e293b" strokeWidth="2" />
            <circle cx="165" cy="76" r="10" fill="none" stroke="#1e293b" strokeWidth="2" />
            <rect x="75" y="94" width="110" height="12" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.8" />
            <ellipse cx="110" cy="90" rx="12" ry="4" fill="#fff" stroke="#1e293b" strokeWidth="1.5" />
            <ellipse cx="150" cy="90" rx="12" ry="4" fill="#fff" stroke="#1e293b" strokeWidth="1.5" />
          </>
        )}
      </svg>
    );
  }

  if (frame.svgType === 'cycling_park') {
    return (
      <svg viewBox="0 0 360 155" width="100%" role="img" aria-label={frame.frameLabel}>
        <rect x="8" y="8" width="344" height="139" rx="6" fill="#fff" stroke="#334155" strokeWidth="2" />
        <text x="180" y="25" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0f172a">
          PARK ENTRANCE &amp; BICYCLE RACK
        </text>
        {/* Boy pumping air */}
        <circle cx="48" cy="108" r="14" fill="none" stroke="#1e293b" strokeWidth="2" />
        <circle cx="84" cy="108" r="14" fill="none" stroke="#1e293b" strokeWidth="2" />
        <line x1="48" y1="108" x2="66" y2="90" stroke="#1e293b" strokeWidth="2" />
        <line x1="66" y1="90" x2="84" y2="108" stroke="#1e293b" strokeWidth="2" />
        <text x="66" y="136" textAnchor="middle" fontSize="8.5" fill="#334155">① Boy (pumping air)</text>
        {/* Bench & two women with map */}
        <rect x="126" y="92" width="76" height="10" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.8" />
        <circle cx="148" cy="72" r="8" fill="none" stroke="#1e293b" strokeWidth="2" />
        <circle cx="178" cy="72" r="8" fill="none" stroke="#1e293b" strokeWidth="2" />
        <rect x="153" y="80" width="20" height="12" fill="#fff" stroke="#1e293b" strokeWidth="1.5" />
        <text x="164" y="122" textAnchor="middle" fontSize="8.5" fill="#334155">② Map on bench</text>
        {/* Man with full basket */}
        <rect x="248" y="76" width="32" height="22" fill="#e2e8f0" stroke="#1e293b" strokeWidth="2" />
        <text x="264" y="90" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#0f172a">FULL</text>
        <circle cx="305" cy="68" r="9" fill="none" stroke="#1e293b" strokeWidth="2" />
        <rect x="314" y="84" width="22" height="24" fill="#fff" stroke="#1e293b" strokeWidth="1.8" />
        <text x="292" y="136" textAnchor="middle" fontSize="8.5" fill="#334155">③ Man (heavy bag / full basket)</text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 360 155" width="100%" role="img" aria-label={frame.frameLabel}>
      <rect x="8" y="8" width="344" height="139" rx="6" fill="#fff" stroke="#334155" strokeWidth="2" />
      <text x="180" y="25" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0f172a">
        SCHOOL LIBRARY — 8:00 AM
      </text>
      {/* Counter */}
      <rect x="24" y="88" width="74" height="34" fill="#f1f5f9" stroke="#1e293b" strokeWidth="1.8" />
      <text x="61" y="109" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#0f172a">Counter</text>
      {/* Computer */}
      <rect x="132" y="74" width="42" height="28" fill="#fff" stroke="#1e293b" strokeWidth="2" />
      <text x="153" y="92" textAnchor="middle" fontSize="8" fill="#0f172a">Search PC</text>
      {/* Tall bookshelf */}
      <rect x="246" y="34" width="68" height="92" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
      <line x1="246" y1="56" x2="314" y2="56" stroke="#1e293b" strokeWidth="1.8" />
      <line x1="246" y1="82" x2="314" y2="82" stroke="#1e293b" strokeWidth="1.8" />
      <rect x="268" y="38" width="22" height="16" fill="#cbd5e1" stroke="#0f172a" strokeWidth="1.4" />
      <circle cx="228" cy="86" r="9" fill="none" stroke="#1e293b" strokeWidth="2" />
      <line x1="228" y1="95" x2="228" y2="124" stroke="#1e293b" strokeWidth="2" />
      <line x1="228" y1="100" x2="244" y2="70" stroke="#1e293b" strokeWidth="2" />
      <text x="275" y="140" textAnchor="middle" fontSize="8.5" fill="#334155">Too high to reach!</text>
    </svg>
  );
}
