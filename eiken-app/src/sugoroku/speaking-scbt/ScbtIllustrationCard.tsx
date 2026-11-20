import type { ScbtIllustrationFrame } from './speakingTypes';

function esc(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function personSvg(cx: number, cy: number, label?: string): string {
  const lbl = label
    ? `<text x="${cx}" y="${cy + 37}" text-anchor="middle" font-size="8" font-weight="bold" fill="#334155">${esc(label)}</text>`
    : '';
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="9" fill="#ffffff" stroke="#1e293b" stroke-width="2" />
    <circle cx="${cx - 3}" cy="${cy - 1}" r="1" fill="#1e293b" />
    <circle cx="${cx + 3}" cy="${cy - 1}" r="1" fill="#1e293b" />
    <path d="M${cx - 8} ${cy + 26} Q${cx} ${cy + 10} ${cx + 8} ${cy + 26}" fill="#f1f5f9" stroke="#1e293b" stroke-width="2" />
    ${lbl}
  </g>`;
}

/**
 * 完全オリジナルのクリーンな白黒線画 SVG を構築する（全6セット対応・XSSエスケープ済）。
 * 大量の SVG JSX タグによる TypeScript 型検査ヒープ膨張を防ぎ、680MB 制限下で高速動作させる。
 */
export function buildFrameSvgMarkup(frame: ScbtIllustrationFrame): string {
  const label = esc(frame.frameLabel);

  if (frame.svgType === 'sports_locker') {
    if (frame.frameIndex === 0) {
      return `<svg viewBox="0 0 260 140" width="100%" role="img" aria-label="${label}">
        <rect x="6" y="6" width="248" height="128" rx="6" fill="#fff" stroke="#334155" stroke-width="2" />
        <line x1="30" y1="44" x2="30" y2="115" stroke="#1e293b" stroke-width="3" />
        <line x1="146" y1="44" x2="146" y2="115" stroke="#1e293b" stroke-width="3" />
        <path d="M30 50 Q88 76 146 50" fill="none" stroke="#1e293b" stroke-width="2" stroke-dasharray="5 4" />
        <text x="88" y="36" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#0f172a">Torn Practice Net</text>
        <rect x="168" y="20" width="74" height="58" rx="3" fill="#f8fafc" stroke="#1e293b" stroke-width="1.8" />
        <text x="205" y="35" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#0f172a">FREE REPAIR</text>
        <text x="205" y="48" text-anchor="middle" font-size="8" fill="#0f172a">WORKSHOP</text>
        <text x="205" y="62" text-anchor="middle" font-size="7.5" fill="#334155">Sat @ City Gym</text>
        ${personSvg(68, 84, 'Misaki')}
        ${personSvg(114, 80, 'Teacher')}
      </svg>`;
    }
    if (frame.frameIndex === 1) {
      return `<svg viewBox="0 0 260 140" width="100%" role="img" aria-label="${label}">
        <rect x="6" y="6" width="248" height="128" rx="6" fill="#fff" stroke="#334155" stroke-width="2" />
        <text x="130" y="24" text-anchor="middle" font-size="10" font-weight="bold" fill="#0f172a">CITY COMMUNITY GYM</text>
        <rect x="36" y="88" width="188" height="10" fill="#e2e8f0" stroke="#1e293b" stroke-width="1.8" />
        ${personSvg(72, 56, 'Volunteer')}
        ${personSvg(130, 58, 'Misaki')}
        <ellipse cx="178" cy="68" rx="15" ry="9" fill="none" stroke="#1e293b" stroke-width="2" />
        <line x1="193" y1="68" x2="215" y2="78" stroke="#1e293b" stroke-width="2.2" />
        <text x="130" y="122" text-anchor="middle" font-size="8.5" fill="#334155">Learning how to restring &amp; repair gear</text>
      </svg>`;
    }
    return `<svg viewBox="0 0 260 140" width="100%" role="img" aria-label="${label}">
      <rect x="6" y="6" width="248" height="128" rx="6" fill="#fff" stroke="#334155" stroke-width="2" />
      <line x1="38" y1="42" x2="38" y2="114" stroke="#1e293b" stroke-width="3" />
      <line x1="222" y1="42" x2="222" y2="114" stroke="#1e293b" stroke-width="3" />
      <rect x="38" y="46" width="184" height="22" fill="#f8fafc" stroke="#1e293b" stroke-width="1.8" />
      <line x1="38" y1="57" x2="222" y2="57" stroke="#64748b" stroke-width="1" />
      ${personSvg(76, 84, 'Misaki')}
      ${personSvg(130, 84, 'New Member')}
      ${personSvg(184, 84, 'New Member')}
      <text x="130" y="28" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#0f172a">Practicing Together with Repaired Net!</text>
    </svg>`;
  }

  if (frame.svgType === 'cafeteria_order') {
    const headers = ['12:35 PM — Cafeteria', '8:15 AM — Classroom', '12:15 PM — Express Counter'];
    const head = esc(headers[frame.frameIndex] || 'Cafeteria');
    const body =
      frame.frameIndex === 0
        ? `<rect x="34" y="54" width="96" height="52" fill="#f8fafc" stroke="#1e293b" stroke-width="2" />
           <text x="82" y="76" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#0f172a">Daily Set</text>
           <text x="82" y="94" text-anchor="middle" font-size="11" font-weight="bold" fill="#0f172a">[ SOLD OUT ]</text>
           ${personSvg(184, 72, 'Takumi')}`
        : frame.frameIndex === 1
        ? `${personSvg(68, 74, 'Friend')}
           <rect x="112" y="52" width="84" height="54" rx="6" fill="#fff" stroke="#1e293b" stroke-width="2.2" />
           <text x="154" y="74" text-anchor="middle" font-size="9" font-weight="bold" fill="#0f172a">[ Reserve Set A ]</text>
           <text x="154" y="91" text-anchor="middle" font-size="8" fill="#334155">Tap to Pre-Order</text>
           ${personSvg(222, 74, 'Takumi')}`
        : `${personSvg(90, 66, 'Takumi')}
           ${personSvg(170, 66, 'Friend')}
           <rect x="64" y="98" width="132" height="12" fill="#e2e8f0" stroke="#1e293b" stroke-width="1.8" />
           <ellipse cx="102" cy="94" rx="13" ry="4" fill="#fff" stroke="#1e293b" stroke-width="1.5" />
           <ellipse cx="158" cy="94" rx="13" ry="4" fill="#fff" stroke="#1e293b" stroke-width="1.5" />`;
    return `<svg viewBox="0 0 260 140" width="100%" role="img" aria-label="${label}">
      <rect x="6" y="6" width="248" height="128" rx="6" fill="#fff" stroke="#334155" stroke-width="2" />
      <rect x="24" y="16" width="212" height="22" rx="4" fill="#f1f5f9" stroke="#1e293b" stroke-width="1.5" />
      <text x="130" y="31" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#0f172a">${head}</text>
      ${body}
    </svg>`;
  }

  if (frame.svgType === 'station_umbrella') {
    const body =
      frame.frameIndex === 0
        ? `<text x="130" y="24" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#0f172a">STATION EXIT — Heavy Rain</text>
           <line x1="36" y1="36" x2="28" y2="56" stroke="#475569" stroke-width="1.5" />
           <line x1="60" y1="36" x2="52" y2="56" stroke="#475569" stroke-width="1.5" />
           <line x1="84" y1="36" x2="76" y2="56" stroke="#475569" stroke-width="1.5" />
           ${personSvg(116, 74, 'Hina')}
           <rect x="164" y="48" width="68" height="66" rx="4" fill="#f8fafc" stroke="#1e293b" stroke-width="2" />
           <text x="198" y="64" text-anchor="middle" font-size="8" font-weight="bold" fill="#0f172a">SHARED</text>
           <text x="198" y="76" text-anchor="middle" font-size="8" font-weight="bold" fill="#0f172a">UMBRELLA</text>
           <text x="198" y="94" text-anchor="middle" font-size="7.5" fill="#334155">[ IC Card OK ]</text>`
        : frame.frameIndex === 1
        ? `<line x1="40" y1="22" x2="32" y2="44" stroke="#475569" stroke-width="1.5" />
           <line x1="210" y1="22" x2="202" y2="44" stroke="#475569" stroke-width="1.5" />
           <path d="M88 54 Q130 22 172 54 Z" fill="#e2e8f0" stroke="#1e293b" stroke-width="2" />
           <line x1="130" y1="54" x2="130" y2="86" stroke="#1e293b" stroke-width="2" />
           ${personSvg(130, 78, 'Hina (Dry!)')}`
        : `<circle cx="48" cy="34" r="12" fill="#fff" stroke="#1e293b" stroke-width="2" />
           <text x="142" y="26" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#0f172a">SCHOOL STATION — Next Morning</text>
           ${personSvg(98, 74, 'Hina')}
           <path d="M126 78 L156 78" stroke="#1e293b" stroke-width="2" />
           <rect x="164" y="50" width="66" height="64" rx="4" fill="#f8fafc" stroke="#1e293b" stroke-width="2" />
           <text x="197" y="76" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#0f172a">RETURN</text>
           <text x="197" y="90" text-anchor="middle" font-size="8" fill="#334155">STAND</text>`;
    return `<svg viewBox="0 0 260 140" width="100%" role="img" aria-label="${label}">
      <rect x="6" y="6" width="248" height="128" rx="6" fill="#fff" stroke="#334155" stroke-width="2" />
      ${body}
    </svg>`;
  }

  if (frame.svgType === 'community_garden') {
    const body =
      frame.frameIndex === 0
        ? `${personSvg(72, 66, 'Farmer')}
           ${personSvg(176, 68, 'Ken')}
           <rect x="96" y="96" width="64" height="22" fill="#e2e8f0" stroke="#1e293b" stroke-width="1.8" />
           <path d="M116 96 L116 82 M140 96 L140 82" stroke="#1e293b" stroke-width="2" />
           <text x="130" y="26" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#0f172a">May: Planting Tomato Seedlings</text>`
        : frame.frameIndex === 1
        ? `${personSvg(74, 68, 'Ken')}
           ${personSvg(190, 68, 'Friend')}
           <rect x="104" y="92" width="56" height="26" fill="#e2e8f0" stroke="#1e293b" stroke-width="1.8" />
           <circle cx="120" cy="76" r="5" fill="#fff" stroke="#1e293b" stroke-width="1.8" />
           <circle cx="138" cy="72" r="5" fill="#fff" stroke="#1e293b" stroke-width="1.8" />
           <text x="130" y="26" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#0f172a">July: Watering After School</text>`
        : `${personSvg(68, 66, 'Farmer')}
           ${personSvg(130, 66, 'Ken')}
           ${personSvg(192, 66, 'Friend')}
           <rect x="52" y="98" width="156" height="12" fill="#e2e8f0" stroke="#1e293b" stroke-width="1.8" />
           <ellipse cx="130" cy="92" rx="22" ry="6" fill="#fff" stroke="#1e293b" stroke-width="1.8" />
           <text x="130" y="26" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#0f172a">August: Fresh Salad Party!</text>`;
    return `<svg viewBox="0 0 260 140" width="100%" role="img" aria-label="${label}">
      <rect x="6" y="6" width="248" height="128" rx="6" fill="#fff" stroke="#334155" stroke-width="2" />
      ${body}
    </svg>`;
  }

  if (frame.svgType === 'cycling_park') {
    return `<svg viewBox="0 0 360 158" width="100%" role="img" aria-label="${label}">
      <rect x="8" y="8" width="344" height="142" rx="6" fill="#fff" stroke="#334155" stroke-width="2" />
      <text x="180" y="25" text-anchor="middle" font-size="11" font-weight="bold" fill="#0f172a">PARK ENTRANCE &amp; BICYCLE RACK</text>
      <circle cx="44" cy="108" r="13" fill="none" stroke="#1e293b" stroke-width="2" />
      <circle cx="78" cy="108" r="13" fill="none" stroke="#1e293b" stroke-width="2" />
      <line x1="44" y1="108" x2="61" y2="90" stroke="#1e293b" stroke-width="2" />
      <line x1="61" y1="90" x2="78" y2="108" stroke="#1e293b" stroke-width="2" />
      <text x="62" y="138" text-anchor="middle" font-size="8.5" fill="#334155">① Boy (pumping air)</text>
      <rect x="124" y="94" width="80" height="10" fill="#e2e8f0" stroke="#1e293b" stroke-width="1.8" />
      ${personSvg(146, 66)}
      ${personSvg(182, 66)}
      <rect x="154" y="76" width="20" height="13" fill="#fff" stroke="#1e293b" stroke-width="1.5" />
      <text x="164" y="126" text-anchor="middle" font-size="8.5" fill="#334155">② Women (reading map)</text>
      <rect x="246" y="76" width="34" height="22" fill="#e2e8f0" stroke="#1e293b" stroke-width="2" />
      <text x="263" y="90" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#0f172a">FULL</text>
      ${personSvg(304, 68)}
      <rect x="316" y="84" width="22" height="24" fill="#fff" stroke="#1e293b" stroke-width="1.8" />
      <text x="292" y="138" text-anchor="middle" font-size="8.5" fill="#334155">③ Man (heavy bag / full basket)</text>
    </svg>`;
  }

  return `<svg viewBox="0 0 360 158" width="100%" role="img" aria-label="${label}">
    <rect x="8" y="8" width="344" height="142" rx="6" fill="#fff" stroke="#334155" stroke-width="2" />
    <text x="180" y="25" text-anchor="middle" font-size="11" font-weight="bold" fill="#0f172a">SCHOOL LIBRARY — 8:00 AM</text>
    <rect x="22" y="90" width="76" height="34" fill="#f1f5f9" stroke="#1e293b" stroke-width="1.8" />
    ${personSvg(60, 62)}
    <text x="60" y="109" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#0f172a">Return Counter</text>
    <rect x="134" y="74" width="44" height="28" fill="#fff" stroke="#1e293b" stroke-width="2" />
    <text x="156" y="92" text-anchor="middle" font-size="8" fill="#0f172a">Search PC</text>
    ${personSvg(156, 112)}
    <rect x="250" y="34" width="68" height="92" fill="#f8fafc" stroke="#1e293b" stroke-width="2" />
    <line x1="250" y1="56" x2="318" y2="56" stroke="#1e293b" stroke-width="1.8" />
    <line x1="250" y1="82" x2="318" y2="82" stroke="#1e293b" stroke-width="1.8" />
    <rect x="272" y="38" width="22" height="16" fill="#cbd5e1" stroke="#0f172a" stroke-width="1.4" />
    ${personSvg(228, 86)}
    <line x1="234" y1="98" x2="248" y2="68" stroke="#1e293b" stroke-width="2" />
    <text x="278" y="140" text-anchor="middle" font-size="8.5" fill="#334155">Top shelf too high!</text>
  </svg>`;
}

export function ScbtIllustrationCard({
  frames,
}: {
  frames: readonly ScbtIllustrationFrame[];
}) {
  return (
    <div className="scbt-illus-grid" aria-label="問題カードのイラスト">
      {frames.map((frame, idx) => (
        <figure key={`${frame.svgType}-${idx}`} className="scbt-illus-frame">
          <div className="scbt-illus-head">
            <span>{frame.frameLabel}</span>
            {frames.length > 1 && <span>({idx + 1}/{frames.length})</span>}
          </div>
          <div
            className="scbt-illus-canvas"
            dangerouslySetInnerHTML={{ __html: buildFrameSvgMarkup(frame) }}
          />
          {frame.captionEn && (
            <div lang="en" className="scbt-illus-caption-en">
              {frame.captionEn}
            </div>
          )}
          <figcaption className="scbt-illus-caption-jp">
            {frame.sceneDescriptionJp}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
