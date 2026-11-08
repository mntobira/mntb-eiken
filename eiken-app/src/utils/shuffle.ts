/**
 * 配列を並べ替える（フィッシャー–イェーツ）。2026-10-28 リファクタリング A8
 *   以前は vocabQuiz.ts・authoredConvert.ts・reading/index.ts・ManaRush.tsx に同じ処理が1つずつあった。
 *   計算はそのまま移したので、同じ乱数を渡せば並びは以前と1つも変わらない（tests/shuffle.test.ts）。
 *
 *   shuffleWith(items, random) … 乱数を渡す版（seed つきの再現できる並びに使う）。元の配列は変えない
 *   shuffleSecure(items)       … 端末の暗号用の乱数を使う版（毎回ちがう並びでよいとき）
 *
 * このファイルは他の src を import しない（葉モジュール）。
 */

/** random() は 0 以上 1 未満を返す関数。元の配列は変えずに、並べ替えた新しい配列を返す */
export function shuffleWith<T>(items: readonly T[], random: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/** crypto.getRandomValues を使う版。元の配列は変えない */
export function shuffleSecure<T>(items: readonly T[]): T[] {
  const a = items.slice();
  const r = new Uint32Array(a.length);
  crypto.getRandomValues(r);
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = (r[i] as number) % (i + 1);
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}
