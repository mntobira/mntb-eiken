/**
 * =====================================================================
 * 数式の「書き方のゆれ」を吸収して同じ式かどうかを判定する
 * =====================================================================
 *
 * ■ なにが問題だったか（実測した誤判定）
 *
 *   数学の問題はすべて記述（自分で式を打ち込む）形式で、
 *   どこまで許すかは問題ごとに手書きした別解リストに頼っていた。
 *   そのため人が見れば当然正解にする答えを×にしていた。
 *   実際に測ったのは次の6種類。
 *
 *     正解データ            生徒の入力          これまで
 *     ────────────────────────────────────────────────
 *     x^5/5 + C            x^5/5 + c          ×  積分定数を小文字で書いた
 *     2√x + C              2*√x + C           ×  掛け算の記号を書いた
 *     (2/3)x√x + C         x√x*2/3 + C        ×  掛ける順番を変えた
 *     2x + 3               3 + 2x             ×  足す順番を変えた
 *     sin x + C            sinx + c           ×  関数の後ろの空白＋小文字
 *     1/2                  0.5                ×  分数と小数
 *
 * ■ どう直したか（方針）
 *
 *   式を読み取って「項の集まり」という決まった形に直し、
 *   その形が一致するかで判定する。
 *   足し算・掛け算の順番、掛け算記号の有無、係数が分数か小数か、
 *   係数を前に出すか後ろに置くかは、この形にすると自然に消える。
 *
 * ■ ★やらないこと（ここが一番大事）★
 *
 *   展開と因数分解は「しない」。
 *   数値を入れて一致するかで比べる方法だと実装は簡単だが、
 *   「因数分解せよ」の答えに展開したままの式を、
 *   「展開せよ」の答えに因数分解したままの式を
 *   正解にしてしまう。問題の意図を壊すので採用しない。
 *
 *     (x+1)(x+2)  と  x^2+3x+2   → 別の式として扱う（＝これまで通り）
 *     2(x+1)      と  2x+2       → 別の式として扱う
 *
 *   約分もしない（x/x を 1 にはしない）。
 *   「同じと決めていないものは同じにしない」側に倒してある。
 *
 * ■ ★化学・生物の答えに絶対に触れないための門★
 *
 *   この判定は化学基礎・化学・生物の答えにも通る場所から呼ばれる。
 *   化学式を数式として読むと事故が起きる。
 *
 *     H2O を数式として読むと H×2×O。すると OH2 と同じ式になってしまう。
 *     NaCl も N×a×C×l なので ClNa と同じになってしまう。
 *
 *   そこで「大文字の英字が1つでも入っていたら、数式として扱わない」
 *   という門を置いた。化学式・イオン式・元素記号は必ず大文字で始まるので、
 *   この門だけで化学の答えは全部ここに入ってこない。
 *   単位も mL / L / kJ / mol/L のように大文字を含むものは同じく入らない。
 *
 *   例外はただ1つ、行末の「+ C」（積分定数）だけ。
 *   これは数学でしか出てこない形なので、小文字の c に寄せてから門を通す。
 *   ★「+C」を書き忘れた答えは、項の数が違うので今までどおり不正解★。
 *
 *   さらに、組合せ・順列の記法（5C3 / nP2）は
 *   数式として読むと 5×C×3 になり 3C5 と同じになってしまうため、
 *   数字にはさまれた C・P がある式は入口で断る。
 *
 * ■ このファイルは葉（ほかを一切 import しない）
 *   採点の中心にある純粋な計算なので、画面・通信・教科データから独立させる。
 *   tests/mathExpression.test.ts がこの前提と上の判定を固定している。
 */

// -------------------------------------------------------------------
// 入口の門
// -------------------------------------------------------------------

/** 数式として読み取ってよい文字だけを許す（これ以外が1つでもあれば断る） */
const ALLOWED_CHARS = /^[0-9a-z.+\-*/^()√πθ]+$/;

/** 組合せ・順列の記法（5C3 / ₅C₃ → 5C3 / nP2）。数式として読むと事故るので断る */
const COMBINATION_LIKE = /[0-9a-zA-Z][CP][0-9a-zA-Z]/;

/** 関数名。長いものから試すので長さの降順に並べる */
const FUNCTION_NAMES = [
  'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh',
  'asin', 'acos', 'atan',
  'sqrt', 'log', 'ln', 'exp',
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
];

/**
 * 数式として読み取る前の下ごしらえ。
 * 読み取ってはいけない文字列なら null を返す（＝この判定は使わない）。
 */
function prepare(input: string): string | null {
  let s = String(input ?? '');
  if (!s) return null;

  // 空白はすべて無視（"sin x" と "sinx" を同じ入口に揃える）
  s = s.replace(/[\u3000\s]+/g, '');
  if (!s) return null;

  // Japanese middle dots separate answers (e.g. oxidation numbers
  // +2・+3・+8/3), not multiplication. Never turn that list into 16.
  // Multiplication can still use ×, ⋅, · or *.
  if (s.includes('・')) return null;
  s = s.replace(/[\u00D7\u2715\u2716\u22C5\u00B7\u2027]/g, '*');
  // ÷ → /
  s = s.replace(/\u00F7/g, '/');
  // 2**3 → 2^3
  s = s.replace(/\*\*/g, '^');
  // 各種マイナス様記号 → 半角ハイフン
  s = s.replace(/[\u2212\u2010\u2011\u2013\u2014\u2015]/g, '-');

  // 組合せ・順列の記法は入口で断る（大文字を落とす前に見る）
  if (COMBINATION_LIKE.test(s)) return null;

  // ★唯一の大文字の例外：末尾の積分定数 +C を +c に寄せる★
  //   ・末尾限定なので、式の途中の大文字は救わない
  //   ・「+C」を書き忘れた答えは項が1つ足りないままなので不正解のまま
  s = s.replace(/\+C$/, '+c');

  // ここから先に大文字が残っていたら数式として扱わない（化学式・単位を守る門）
  if (/[A-Z]/.test(s)) return null;

  if (!ALLOWED_CHARS.test(s)) return null;

  // ★英単語の答えを数式として読ませないための門★
  //
  //   小文字だけの答えは英文法や用語でも出てくる。それを数式として読むと
  //   掛け算の順番を無視する性質のせいで、並べ替えた別の語まで正解にしてしまう。
  //
  //     listen を数式として読むと l×i×s×t×e×n。すると silent と同じ式になる。
  //     he と eh、cat/dog と act/god も同じ式になってしまう。
  //
  //   そこで次の2つを満たさないものは数式として扱わない。
  //     ① 数字・演算子・√・π・θ・かっこのいずれかを含む（式の目印がある）
  //     ② 英字が2文字以上続かない（続く場合は関数名として読み切れるときだけ許す）
  //
  //   ②のため「2ab」のような書き方は救えないが、
  //   救えない＝これまでどおりの採点結果になるだけで、
  //   別の答えを正解にする事故は起こらない。安全な側に倒してある。
  if (!MATH_SIGNAL.test(s)) return null;
  if (!letterRunsAreSafe(s)) return null;

  return s;
}

/** 「これは数式だ」と言える目印。単語だけの答えを弾くために使う。 */
const MATH_SIGNAL = /[0-9^√πθ/*()+\-]/;

/**
 * 英字の並びが「1文字の変数」と「関数名」だけで説明できるか。
 * 説明できない2文字以上の並び（英単語）が残ったら false。
 */
function letterRunsAreSafe(s: string): boolean {
  for (const run of s.match(/[a-z]+/g) ?? []) {
    let rest = run;
    while (rest.length > 0) {
      const name = FUNCTION_NAMES.find((fn) => rest.startsWith(fn));
      if (name) {
        rest = rest.slice(name.length);
        continue;
      }
      // 関数名で説明できない部分。1文字の変数なら許す。
      if (rest.length >= 2) return false;
      rest = '';
    }
  }
  return true;
}

// -------------------------------------------------------------------
// 正規形の表し方
// -------------------------------------------------------------------

/**
 * 項ひとつ。
 *   coeff : 数の係数（1/2 と 0.5 はここで同じ値になる）
 *   num   : 分子側の因数（文字・関数・累乗・かっこの中身）を並べたもの
 *   den   : 分母側の因数
 * 因数は並べ替えて比較するので、掛ける順番の違いは消える。
 */
interface Term {
  coeff: number;
  num: string[];
  den: string[];
}

/** 項の集まり（足し算）。並べ替えて比較するので、足す順番の違いは消える。 */
type Sum = Term[];

/** 係数を比較用の文字列にする。2/3 の丸め誤差で別式にならないよう桁を落とす。 */
function formatCoeff(value: number): string {
  if (!Number.isFinite(value)) return 'NaN';
  if (value === 0) return '0';
  return String(Number(value.toPrecision(12)));
}

/** 項の「文字部分だけ」の鍵。同類項をまとめるときに使う。 */
function factorKey(term: Term): string {
  const num = [...term.num].sort().join('*');
  const den = [...term.den].sort().join('*');
  return `${num}|${den}`;
}

function termKey(term: Term): string {
  return `${factorKey(term)}#${formatCoeff(term.coeff)}`;
}

/** 項の集まりを1本の文字列にする。これが比較の対象。 */
function renderSum(sum: Sum): string {
  const merged = mergeLikeTerms(sum);
  return merged.map(termKey).sort().join('+');
}

/** 同類項（文字部分が同じ項）をまとめ、係数0の項を落とす */
function mergeLikeTerms(sum: Sum): Sum {
  const buckets = new Map<string, Term>();
  for (const term of sum) {
    const key = factorKey(term);
    const found = buckets.get(key);
    if (found) {
      found.coeff += term.coeff;
    } else {
      buckets.set(key, { coeff: term.coeff, num: [...term.num], den: [...term.den] });
    }
  }
  const result: Sum = [];
  for (const term of buckets.values()) {
    if (formatCoeff(term.coeff) === '0') continue;
    result.push(term);
  }
  if (result.length === 0) return [{ coeff: 0, num: [], den: [] }];
  return result;
}

function numberSum(value: number): Sum {
  return [{ coeff: value, num: [], den: [] }];
}

function symbolSum(name: string): Sum {
  return [{ coeff: 1, num: [name], den: [] }];
}

function addSum(a: Sum, b: Sum): Sum {
  return mergeLikeTerms([...a, ...b]);
}

function negateSum(a: Sum): Sum {
  return a.map((t) => ({ coeff: -t.coeff, num: [...t.num], den: [...t.den] }));
}

/** 項が1つだけなら中身をそのまま使い、2つ以上なら「かっこごと1つの因数」として扱う */
function asSingleTerm(sum: Sum): Term | null {
  const merged = mergeLikeTerms(sum);
  return merged.length === 1 ? merged[0] : null;
}

function opaqueFactor(sum: Sum): string {
  return `(${renderSum(sum)})`;
}

/** 掛け算。★展開はしない★ */
function mulSum(a: Sum, b: Sum): Sum {
  const left = asSingleTerm(a);
  const right = asSingleTerm(b);
  if (left && right) {
    return [
      {
        coeff: left.coeff * right.coeff,
        num: [...left.num, ...right.num],
        den: [...left.den, ...right.den],
      },
    ];
  }
  if (left) {
    return [{ coeff: left.coeff, num: [...left.num, opaqueFactor(b)], den: [...left.den] }];
  }
  if (right) {
    return [{ coeff: right.coeff, num: [opaqueFactor(a), ...right.num], den: [...right.den] }];
  }
  return [{ coeff: 1, num: [opaqueFactor(a), opaqueFactor(b)], den: [] }];
}

/** 割り算。★約分はしない★ */
function divSum(a: Sum, b: Sum): Sum | null {
  const left = asSingleTerm(a);
  const right = asSingleTerm(b);
  if (right) {
    if (right.coeff === 0) return null; // 0で割る式は判定しない
    if (left) {
      return [
        {
          coeff: left.coeff / right.coeff,
          num: [...left.num, ...right.den],
          den: [...left.den, ...right.num],
        },
      ];
    }
    return [
      {
        coeff: 1 / right.coeff,
        num: [opaqueFactor(a), ...right.den],
        den: [...right.num],
      },
    ];
  }
  if (left) {
    return [{ coeff: left.coeff, num: [...left.num], den: [...left.den, opaqueFactor(b)] }];
  }
  return [{ coeff: 1, num: [opaqueFactor(a)], den: [opaqueFactor(b)] }];
}

/** 累乗。数どうしのときだけ計算し、それ以外は形のまま因数にする */
function powSum(a: Sum, b: Sum): Sum {
  const base = asSingleTerm(a);
  const exp = asSingleTerm(b);
  const baseIsPlainNumber = !!base && base.num.length === 0 && base.den.length === 0;
  const expIsPlainNumber = !!exp && exp.num.length === 0 && exp.den.length === 0;
  if (baseIsPlainNumber && expIsPlainNumber) {
    const value = Math.pow(base.coeff, exp.coeff);
    if (Number.isFinite(value)) return numberSum(value);
  }
  return [{ coeff: 1, num: [`${opaqueFactor(a)}^${opaqueFactor(b)}`], den: [] }];
}

function funcSum(name: string, arg: Sum): Sum {
  return [{ coeff: 1, num: [`${name}(${renderSum(arg)})`], den: [] }];
}

// -------------------------------------------------------------------
// 読み取り（再帰下降）
// -------------------------------------------------------------------

/**
 * ★関数と √ が飲み込む範囲は「直後の1個」だけにする★
 *
 *   sinx*2 を sin(x)*2 と読む（sin(x*2) とは読まない）。
 *   もし「後ろ全部」を飲み込む読み方にすると、
 *   sinx*2 と sin(2x) を同じ式にしてしまい、別の答えを正解にする。
 *   飲み込む範囲を狭くしておけば、間違って正解にすることはなく、
 *   救えない書き方が残るだけ（＝これまで通りの結果）で済む。
 */
class Parser {
  private readonly s: string;
  private i = 0;

  constructor(s: string) {
    this.s = s;
  }

  parse(): Sum | null {
    const value = this.parseExpr();
    if (value === null) return null;
    if (this.i !== this.s.length) return null; // 読み残しがあれば失敗扱い
    return value;
  }

  private peek(): string {
    return this.s[this.i] ?? '';
  }

  private parseExpr(): Sum | null {
    let sign = 1;
    if (this.peek() === '+' || this.peek() === '-') {
      if (this.peek() === '-') sign = -1;
      this.i += 1;
    }
    let left = this.parseTerm();
    if (left === null) return null;
    if (sign === -1) left = negateSum(left);

    for (;;) {
      const ch = this.peek();
      if (ch !== '+' && ch !== '-') break;
      this.i += 1;
      const right = this.parseTerm();
      if (right === null) return null;
      left = addSum(left, ch === '+' ? right : negateSum(right));
    }
    return left;
  }

  private startsFactor(): boolean {
    const ch = this.peek();
    if (!ch) return false;
    return /[0-9a-z.(√πθ]/.test(ch);
  }

  private parseTerm(): Sum | null {
    let left = this.parsePower();
    if (left === null) return null;

    for (;;) {
      const ch = this.peek();
      if (ch === '*') {
        this.i += 1;
        const right = this.parsePower();
        if (right === null) return null;
        left = mulSum(left, right);
        continue;
      }
      if (ch === '/') {
        this.i += 1;
        const right = this.parsePower();
        if (right === null) return null;
        const divided = divSum(left, right);
        if (divided === null) return null;
        left = divided;
        continue;
      }
      // 記号を書かない掛け算（2x、x√x、(2/3)x）
      if (this.startsFactor()) {
        const right = this.parsePower();
        if (right === null) return null;
        left = mulSum(left, right);
        continue;
      }
      break;
    }
    return left;
  }

  private parsePower(): Sum | null {
    const base = this.parseUnary();
    if (base === null) return null;
    if (this.peek() !== '^') return base;
    this.i += 1;
    const exp = this.parsePower(); // 右結合
    if (exp === null) return null;
    return powSum(base, exp);
  }

  private parseUnary(): Sum | null {
    const ch = this.peek();
    if (ch === '-') {
      this.i += 1;
      const inner = this.parseUnary();
      return inner === null ? null : negateSum(inner);
    }
    if (ch === '+') {
      this.i += 1;
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  /**
   * 関数・√ の引数を読む。
   *
   * ★かっこが無い書き方は「引数が1個だと確実に分かる形」だけ受け付ける★
   *
   *   sin(2x) はかっこがあるので迷わない。
   *   では sin2x はどうか。人によって sin(2x) とも sin(2)×x とも読める。
   *   どちらかに決めて読むと、決めた側と逆の意図で書いた生徒の答えを
   *   取り違えて採点する。とくに「別の式を正解にする」方向は最悪。
   *
   *   そこで、かっこが無いときの引数は
   *     ・1文字の変数（√x、sinθ）
   *     ・数字だけ（√2、sin30）
   *   に限り、それ以上続く（√2x、sin2x のような）形は判定を諦めて null を返す。
   *   諦めた場合はこれまでの採点にそのまま任せるので、結果は今と同じ。
   */
  private parseBareArgument(name: string): Sum | null {
    if (this.peek() === '(') {
      const arg = this.parsePrimary();
      return arg === null ? null : funcSum(name, arg);
    }
    const rest = this.s.slice(this.i);

    // 1文字の変数（後ろに英数字・小数点が続かないこと）
    const oneLetter = /^([a-zπθ])(?![0-9a-z.])/.exec(rest);
    if (oneLetter) {
      this.i += 1;
      return funcSum(name, symbolSum(oneLetter[1]));
    }

    // 数字だけ（後ろに英字・かっこ・√ が続かないこと）
    const digits = /^(\d*\.?\d+)(?![0-9a-z.(√])/.exec(rest);
    if (digits) {
      this.i += digits[1].length;
      const value = Number(digits[1]);
      if (!Number.isFinite(value)) return null;
      return funcSum(name, numberSum(value));
    }

    return null; // どう読むか決められない → 判定しない
  }

  private parsePrimary(): Sum | null {
    const ch = this.peek();
    if (!ch) return null;

    if (ch === '(') {
      this.i += 1;
      const inner = this.parseExpr();
      if (inner === null) return null;
      if (this.peek() !== ')') return null;
      this.i += 1;
      return inner;
    }

    if (ch === '√') {
      this.i += 1;
      return this.parseBareArgument('sqrt');
    }

    if (/[0-9.]/.test(ch)) {
      const matched = /^\d*\.?\d+/.exec(this.s.slice(this.i));
      if (!matched) return null;
      this.i += matched[0].length;
      const value = Number(matched[0]);
      if (!Number.isFinite(value)) return null;
      return numberSum(value);
    }

    if (ch === 'π' || ch === 'θ') {
      this.i += 1;
      return symbolSum(ch);
    }

    if (/[a-z]/.test(ch)) {
      const rest = this.s.slice(this.i);
      for (const name of FUNCTION_NAMES) {
        if (!rest.startsWith(name)) continue;
        this.i += name.length;
        return this.parseBareArgument(name);
      }
      this.i += 1;
      return symbolSum(ch);
    }

    return null;
  }
}

// -------------------------------------------------------------------
// 公開する入口
// -------------------------------------------------------------------

/**
 * 式を比較用の決まった形に直す。数式として読めなければ null。
 * null が返る＝この判定は使わない（これまでの採点にそのまま任せる）。
 */
export function canonicalizeMathExpression(input: string): string | null {
  const prepared = prepare(input);
  if (prepared === null) return null;
  let parsed: Sum | null = null;
  try {
    parsed = new Parser(prepared).parse();
  } catch {
    return null;
  }
  if (parsed === null) return null;
  return renderSum(parsed);
}

/**
 * 2つの式が「書き方が違うだけの同じ式」といえるか。
 * 読み取れないものは false（＝これまでの採点の結果を変えない）。
 */
export function isMathematicallyEqual(a: string, b: string): boolean {
  const left = canonicalizeMathExpression(a);
  if (left === null) return false;
  const right = canonicalizeMathExpression(b);
  if (right === null) return false;
  return left === right;
}
