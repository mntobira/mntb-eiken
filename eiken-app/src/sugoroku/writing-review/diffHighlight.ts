export type DiffSegment =
  | { kind: 'equal'; text: string }
  | { kind: 'removed'; text: string }
  | { kind: 'added'; text: string };

function tokenizeForDiff(text: string): string[] {
  // 空白・改行と単語/句読点トークンを保持して自然な英文再構成を可能にする
  return String(text ?? '').match(/\s+|[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*|[^\sA-Za-z0-9]/g) ?? [];
}

/**
 * 生徒の元英文（original）と先生の添削英文（corrected）のトークン単位 LCS 差分を計算する。
 * 外部ライブラリ不要・高速・白黒印刷でも「取り消し線＋太字下線」で明瞭に表示可能。
 */
export function computeEnglishDiff(original: string, corrected: string): DiffSegment[] {
  const a = tokenizeForDiff(original.trim());
  const b = tokenizeForDiff(corrected.trim());

  if (a.length === 0 && b.length === 0) return [];
  if (a.length === 0) return [{ kind: 'added', text: corrected.trim() }];
  if (b.length === 0) return [{ kind: 'removed', text: original.trim() }];

  // 極端に長い入力でのメモリ膨張を防ぐ安全ガード（通常の英検英作文は 600 トークン未満）
  if (a.length * b.length > 360_000) {
    if (original.trim() === corrected.trim()) {
      return [{ kind: 'equal', text: corrected.trim() }];
    }
    return [
      { kind: 'removed', text: original.trim() },
      { kind: 'equal', text: '\n→ ' },
      { kind: 'added', text: corrected.trim() },
    ];
  }

  const m = a.length;
  const n = b.length;
  const dp = new Uint16Array((m + 1) * (n + 1));
  const width = n + 1;

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i * width + j] = dp[(i + 1) * width + (j + 1)] + 1;
      } else {
        const down = dp[(i + 1) * width + j];
        const right = dp[i * width + (j + 1)];
        dp[i * width + j] = down >= right ? down : right;
      }
    }
  }

  const raw: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      raw.push({ kind: 'equal', text: a[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * width + j] >= dp[i * width + (j + 1)]) {
      raw.push({ kind: 'removed', text: a[i] });
      i++;
    } else {
      raw.push({ kind: 'added', text: b[j] });
      j++;
    }
  }
  while (i < m) {
    raw.push({ kind: 'removed', text: a[i++] });
  }
  while (j < n) {
    raw.push({ kind: 'added', text: b[j++] });
  }

  // 連続する同一 kind のセグメントを結合して DOM ノード数を最小化する
  const merged: DiffSegment[] = [];
  for (const seg of raw) {
    const prev = merged[merged.length - 1];
    // 空白だけの added/removed は視覚ノイズになるため equal 側へ寄せる
    if (/^\s+$/.test(seg.text) && seg.kind !== 'equal') {
      if (seg.kind === 'removed') continue;
      const asEqual: DiffSegment = { kind: 'equal', text: seg.text };
      if (prev && prev.kind === 'equal') prev.text += asEqual.text;
      else merged.push(asEqual);
      continue;
    }
    if (prev && prev.kind === seg.kind) {
      prev.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}
