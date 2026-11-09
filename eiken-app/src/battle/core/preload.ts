/**
 * 対戦の音源・絵の先読み。
 *
 * ★なぜ★
 * 以前は問題が出た瞬間に音源・絵を読み始めていたため、電波が悪いと
 * 「制限時間は減っているのに音が鳴らない／絵が出ない」状態になっていた。
 * 市販の対戦ゲームと同じく、カウントダウン中・前の問題の間に次の問題の素材を読んでおく。
 * ブラウザのキャッシュに載るだけで、Firestore の通信は増えない。
 */
const warmed = new Set<string>();
const keep: HTMLMediaElement[] = [];

/** 先読みする URL（重複は除く）。音源は mp3、それ以外は画像とみなす */
export function preloadTargets(questions: readonly { audioUrl?: string; imageUrl?: string }[], from: number, ahead = 2): string[] {
  const out: string[] = [];
  for (let i = Math.max(0, from); i < Math.min(questions.length, from + ahead); i += 1) {
    const q = questions[i];
    if (q?.audioUrl) out.push(q.audioUrl);
    if (q?.imageUrl) out.push(q.imageUrl);
  }
  return [...new Set(out)];
}

export function warmAssets(urls: readonly string[]): void {
  if (typeof window === 'undefined') return;
  for (const url of urls) {
    if (!url || warmed.has(url)) continue;
    warmed.add(url);
    if (/\.(mp3|m4a|wav|ogg)(\?|$)/i.test(url)) {
      try {
        const a = new Audio();
        a.preload = 'auto';
        a.src = url;
        a.load();
        keep.push(a);
        if (keep.length > 8) keep.shift();
      } catch { /* 先読みできなくても対戦は進む */ }
    } else {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }
}
