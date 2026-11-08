/**
 * 数学記法エンジンと、添字・分数の HTML 部品（Phase 5 / A3 で textFormatter.tsx から移した）。
 *
 * ■ 中身は1文字も変えていない
 *   textFormatter.tsx の 170〜372 行目をそのまま移し、
 *   formatText が使う関数・定数にだけ export を付けた。
 *   移す前後で、全教科の文字列 15,742 件 × 3 モード（通常・prose・math）の
 *   描画結果が完全に一致することを確かめている。
 *
 * ■ なぜ分けたか
 *   textFormatter.tsx は 749 行あり、
 *   「数学のテキスト記法 → HTML」（このファイル）と
 *   「化学式・下線・ハイライトの組版と React 要素化」（formatText）が
 *   1ファイルに同居していた。数学記法だけを直したいときに
 *   化学式の処理まで読まなければならなかったので分けた。
 *
 * ■ 使う人
 *   formatText（textFormatter.tsx）だけ。外からは今までどおり
 *   textFormatter から convertMathNotation を import してよい（再エクスポートしている）。
 */
// 縦書き分数の HTML を生成するヘルパー。
// 分子・分母はそのまま埋め込み、後段の化学式処理で変数（w, M など）も適切にイタリック化される。
export function buildFractionHtml(numerator: string, denominator: string) {
  return (
    '<span class="inline-flex flex-col justify-center text-center mx-1" style="font-size:max(12px, 0.85em); vertical-align: middle; line-height: 1;">' +
      '<span class="border-b border-stone-400 pb-[1.5px] leading-none px-1 font-serif font-medium">' + numerator + '</span>' +
      '<span class="leading-none pt-[1.5px] px-1 font-serif font-medium">' + denominator + '</span>' +
    '</span>'
  );
}

// 分母（または分子）が「単位」を表す場合は分数化しない。
// 例: g/mol, mol/L, kJ/mol, g/cm3, L/mol などは横書きのまま残す。
const UNIT_TOKENS = new Set([
  'mol', 'L', 'mL', 'g', 'kg', 'mg', 'cm', 'cm2', 'cm3', 'm', 'm2', 'm3',
  'kJ', 'J', 'kcal', 'cal', 'K', 's', 'min', 'h', 'Pa', 'kPa', 'atm', 'N',
  'V', 'A', 'W', 'dm', 'dm3', 'mmol',
]);

export function isUnitToken(token: string) {
  return UNIT_TOKENS.has(token);
}

export const SUBSCRIPT_CLASS = 'text-[0.75em] font-sans align-sub leading-none';
export const SUPERSCRIPT_CLASS = 'text-[0.75em] font-sans align-super leading-none';

const SUBSCRIPT_CHAR_MAP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};
const SUPERSCRIPT_CHAR_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5',
  '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '−',
};

/** Unicode / TeX風の添字を semantic HTML に統一し、フォントに依存せず上下配置する。 */
export function normalizeScientificScripts(text: string) {
  return text
    .replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, (value) =>
      `<sub class="${SUBSCRIPT_CLASS}">${[...value].map((char) => SUBSCRIPT_CHAR_MAP[char]).join('')}</sub>`
    )
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (value) =>
      `<sup class="${SUPERSCRIPT_CLASS}">${[...value].map((char) => SUPERSCRIPT_CHAR_MAP[char]).join('')}</sup>`
    )
    // 問題データに残る H^+ / Fe^2+ / cm^3 / x_{1} も同じ表示へ揃える。
    .replace(/([A-Za-z0-9)])_\{?([0-9]+)\}?/g, `$1<sub class="${SUBSCRIPT_CLASS}">$2</sub>`)
    .replace(/([A-Za-z0-9)])\^\{?([0-9]*[+\-−]?|[+\-−])\}?/g, `$1<sup class="${SUPERSCRIPT_CLASS}">$2</sup>`)
    // 半反応式データ（redoxProblems.ts）で使われる MINUS SIGN(U+2212) の電荷を
    // ASCII の "-" に寄せて、下の化学式変換でイオンとして上付きにできるようにする。
    //   Cl−・e−・NO3− → 電荷なので変換する
    //   C−H・O−H・N−H → 構造式の結合線なので変換しない（直後が英大文字なら除外）
    .replace(/([A-Za-z][A-Za-z]?[0-9]*)\u2212(?![A-Za-z0-9(])/g, '$1-');
}

// ===================================================================
// 数学記法エンジン
// -------------------------------------------------------------------
// 数学の問題データ（mathIntegralProblems.ts など）は
//   ∫[0→π/2] / Σ[k=1→n] / lim[n→∞] / √(x²+y²) / x^(3/2) / x^5/5 / 7C3
// のようなテキスト記法で書かれている。これを「教科書と同じ見た目」
// （上下限付きの大きな∫Σ、真上に線が伸びる根号、上付き指数、縦書き分数、
//   下付きの nCr）へ変換する。
//
// ■ 化学・英語の本文を壊さないための設計
//   ・∫ Σ √ lim[ ^( はいずれも化学基礎・化学・リスニングのデータに
//     登場しないことを確認済み（登場する場合も数学的に正しい表示になる）
//   ・単位の g/mol・mol/L などは既存の isUnitToken で分数化を回避
//   ・変換で生成した記号は HTML 実体参照（&#8747; など）で埋め込み、
//     後段の正規表現に二重処理されないようにする
// ===================================================================

/** ∫・Σ など「上下限つきの大きな演算子」の HTML を組み立てる */
function buildBigOpHtml(symbolEntity: string, upper: string, lower: string) {
  return (
    `<span class="math-bigop" aria-hidden="false">` +
      `<span class="math-bigop-sym">${symbolEntity}</span>` +
      `<span class="math-bigop-lims"><span>${upper}</span><span>${lower}</span></span>` +
    `</span>`
  );
}

/** 根号（√の上に横線が伸びる形）の HTML を組み立てる */
function buildSqrtHtml(body: string) {
  return `<span class="math-sqrt">&#8730;<span class="math-sqrt-body">${body}</span></span>`;
}

/**
 * 数学記法をテキストから HTML へ変換する。
 * formatText の最初（添字正規化より前）に1回だけ通す。
 */
export function convertMathNotation(src: string): string {
  let t = src;

  // (1) 順列・組合せ 7C3 / nCr / 7P3 → ₇C₃（前後が英数字でないときだけ）。
  //     12C のような同位体表記は「C の後に数字が続かない」ため一致しない。
  t = t.replace(
    /(?<![A-Za-z0-9])([0-9]{1,2}|n)([CP])([0-9]{1,2}|[rk])(?![A-Za-z0-9])/g,
    (_m, n: string, cp: string, r: string) =>
      `<sub class="${SUBSCRIPT_CLASS}">${n}</sub>${cp}<sub class="${SUBSCRIPT_CLASS}">${r}</sub>`
  );

  // (2) 上下限つきの定積分 ∫[a→b]・∫[a,b]
  t = t.replace(
    /∫\s*\[([^\[\]]{1,24}?)\s*(?:→|,)\s*([^\[\]]{1,24}?)\]/g,
    (_m, lo: string, hi: string) => buildBigOpHtml('&#8747;', hi.trim(), lo.trim())
  );
  // 上下限のない ∫ も教科書サイズに拡大
  t = t.replace(/∫/g, '<span class="math-bigop-solo">&#8747;</span>');

  // (3) 上下限つきの総和 Σ[k=1→n]
  t = t.replace(
    /Σ\s*\[([^\[\]]{1,24}?)\s*(?:→|,)\s*([^\[\]]{1,24}?)\]/g,
    (_m, lo: string, hi: string) => buildBigOpHtml('&#931;', hi.trim(), lo.trim())
  );
  t = t.replace(/Σ/g, '<span class="math-bigop-solo">&#931;</span>');

  // (4) 極限 lim[n→∞] → lim の真下に n→∞
  t = t.replace(
    /lim\s*\[([^\[\]]{1,24})\]/g,
    (_m, cond: string) =>
      `<span class="math-lim"><span class="math-lim-main">lim</span><span class="math-lim-under">${cond.trim()}</span></span>`
  );

  // (4.5) 根号を含む分数 1/√x・√x/2・3/√(x+1) → 縦書き分数
  //     ★√ が (5) で HTML に変換される前に分数として拾う必要がある★
  //     （変換後は <span…>√</span> になり分数ルールが二度とマッチしないため。
  //       実際に「∫ 1/√x dx」が横書きのまま表示される不具合の原因だった）
  const SQRT_TOKEN = '√\\s*(?:\\([^()]{1,30}\\)|[0-9]+(?:\\.[0-9]+)?|[A-Za-z][0-9²³]*)';
  // 分母が √…（例: 1/√x, 2/√(x+1)）
  t = t.replace(
    new RegExp(`(?<![0-9A-Za-z_])(-?[0-9]{1,3}(?:\\.[0-9]+)?|[A-Za-z])\\s*\\/\\s*(${SQRT_TOKEN})(?![0-9A-Za-z])`, 'g'),
    (_m, num: string, den: string) => buildFractionHtml(num, den)
  );
  // 分子が √…（例: √x/2, √(x²+1)/3）
  t = t.replace(
    new RegExp(`(?<![0-9A-Za-z_])(${SQRT_TOKEN})\\s*\\/\\s*(-?[0-9]{1,3}(?:\\.[0-9]+)?|[A-Za-z](?:\\^[0-9]{1,2})?)(?![0-9A-Za-z])`, 'g'),
    (_m, num: string, den: string) => buildFractionHtml(num, den)
  );

  // (5) 根号 √(…)・√x・√25 → 中身の真上に線が伸びる根号
  //     √(4² + (-7)²) のような「1段だけ入れ子の括弧」にも対応する。
  t = t.replace(
    /√\s*\(((?:[^()]|\([^()]{0,30}\)){1,60}?)\)/g,
    (_m, body: string) => buildSqrtHtml(body.trim())
  );
  t = t.replace(
    /√\s*([0-9]+(?:\.[0-9]+)?[A-Za-z]?|[A-Za-z][0-9²³]*)/g,
    (_m, body: string) => buildSqrtHtml(body)
  );

  // (6) 括弧つき指数 x^(3/2)・e^(2x)・A^(a+) → 上付きに。
  //     指数の中の / は分数化せず「∕」（除算スラッシュ）でコンパクトに見せる
  //     （上付きの中にさらに縦書き分数を入れると小さすぎて読めないため）。
  t = t.replace(
    /([A-Za-z0-9)\]])\^\(([^()]{1,30})\)/g,
    (_m, base: string, exp: string) =>
      `${base}<sup class="${SUPERSCRIPT_CLASS}">${exp.replace(/\//g, '&#8725;')}</sup>`
  );
  // (7) 1文字の英字指数 e^x・2^n・10^k → 上付き
  t = t.replace(
    /([A-Za-z0-9)\]])\^([A-Za-z])(?![A-Za-z0-9])/g,
    `$1<sup class="${SUPERSCRIPT_CLASS}">$2</sup>`
  );

  // ---- 分数（数学でよく出る形を、単位を壊さない範囲で縦書き分数にする） ----
  // 数式として許可する中身（コンマ・スラッシュを含まない＝座標 (3, 1) や
  // 単位 g/mol、(3/5, 4/5) のような組は変換しない）
  const EXPR = "[A-Za-z0-9+\\-−·×*^√!'’ ._]";

  // (8) 三角関数の分数 sin^5 x/5・cos 2x/2 → 関数ごと分子に含める
  t = t.replace(
    new RegExp(`(?<![A-Za-z])((?:sin|cos|tan)(?:\\^[0-9]{1,2})?\\s?[0-9]?x)\\s*\\/\\s*([0-9]{1,3})(?![0-9A-Za-z])`, 'g'),
    (_m, num: string, den: string) => buildFractionHtml(num, den)
  );
  // (9) 累乗・階乗が分子の分数 x^5/5・6!/2
  t = t.replace(
    /(?<![A-Za-z0-9_])([A-Za-z]\^[0-9]{1,2}|[0-9]{1,3}!|[A-Za-z]!)\s*\/\s*([0-9]{1,3}(?:\.[0-9]+)?!?|[A-Za-z](?:\^[0-9]{1,2})?!?)(?![0-9A-Za-z])/g,
    (_m, num: string, den: string) => buildFractionHtml(num, den)
  );
  // (9.5) 累乗が分母の分数 1/x^3・2/x^2 → 分母に x^3 を丸ごと入れる。
  //     ★ここで拾わないと、後段の一般分数ルールが「1/x」だけを分数化し、
  //       ^3 が分数の右へはみ出す誤表示になる（∫ 1/x^3 dx で実際に発生）★
  t = t.replace(
    /(?<![A-Za-z0-9_])(-?[0-9]{1,3}(?:\.[0-9]+)?|[A-Za-z])\s*\/\s*([A-Za-z]\^[0-9]{1,2})(?![0-9A-Za-z])/g,
    (_m, num: string, den: string) => buildFractionHtml(num, den)
  );
  // (10) 括弧が分子の分数 (a + 2b)/3・(x+1)/(x-1)（数式文字だけの中身に限定）
  t = t.replace(
    new RegExp(`\\((${EXPR}{1,40})\\)\\s*\\/\\s*(?:\\((${EXPR}{1,40})\\)|([0-9]{1,3}(?:\\.[0-9]+)?!?|[A-Za-z](?:\\^[0-9]{1,2})?!?))(?![0-9A-Za-z])`, 'g'),
    (_m, num: string, denParen: string | undefined, denToken: string | undefined) =>
      buildFractionHtml(num.trim(), (denParen ?? denToken ?? '').trim())
  );
  // (11) 括弧が分母の分数 -1/(2x^2)・6!/(3!·2!·1!)
  t = t.replace(
    new RegExp(`(?<![A-Za-z0-9_])(-?[0-9]{1,3}(?:\\.[0-9]+)?!?|[A-Za-z]!?)\\s*\\/\\s*\\((${EXPR}{1,40})\\)`, 'g'),
    (_m, num: string, den: string) => {
      if (isUnitToken(num)) return _m;
      return buildFractionHtml(num, den.trim());
    }
  );

  return t;
}
