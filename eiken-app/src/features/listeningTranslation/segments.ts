/**
 * リスニングのスクリプトを「英文→和訳」の組に分ける単位（2026-10-21）
 *   - 会話（turns あり）… 発言ごと
 *   - 1人の話（turns なし）… 文で区切り、約35語までを1まとまり
 * 生成スクリプト（scripts/listening-translation/make.mjs）と画面が同じ関数を使うので、和訳の数と英文の数が必ずそろう。
 */
export interface SegTrack { subId: string; audioUrl?: string; script: string; turns?: readonly { who: string; text: string }[] }
export interface Segment { who?: string; text: string }

export const trackKey = (t: SegTrack) => `${t.audioUrl ?? ''}|${t.subId}`;

export function segmentsOf(t: SegTrack): Segment[] {
  if (t.turns?.length) return t.turns.map(x => ({ who: x.who, text: x.text.trim() })).filter(x => x.text);
  const sentences = t.script.replace(/\s+/g, ' ').trim().match(/[^.!?。]+(?:[.!?。]+["”’)]?|$)\s*/g)?.map(s => s.trim()).filter(Boolean) ?? [t.script.trim()];
  const out: Segment[] = [];
  let cur = '';
  for (const s of sentences) {
    const n = (cur + ' ' + s).trim().split(/\s+/).length;
    if (cur && n > 35) { out.push({ text: cur }); cur = s; } else cur = (cur + ' ' + s).trim();
  }
  if (cur) out.push({ text: cur });
  return out;
}

/** 短い大問はスクリプトの下に和訳をまとめて、長い大問は英文→和訳を交互に（読みやすさのしきい値） */
export const isLongTrack = (t: SegTrack) => t.script.split(/\s+/).length > 70 || segmentsOf(t).length > 5;

/** 和訳データ（public/data/listeningTranslations.json：{ trackKey: string[] }）を1回だけ読む */
export function loadListeningTranslations(): Promise<Record<string, string[]>> {
  return Promise.resolve({});
}

/**
 * スクリプトの各まとまりの「最後の語」の番号 → そのまとまりの番号
 *   words は読み方データの語（表示順）。lines が会話の発言と1対1ならその行末、
 *   1行にまとまっている独り語りは、文字位置でまとまりの境目を探す。
 */
export function segmentBreaks(t: SegTrack, words: readonly { i: number; text: string; line: number }[], lineCount: number): Map<number, number> {
  const segs = segmentsOf(t);
  const out = new Map<number, number>();
  if (!words.length || !segs.length) return out;
  if (lineCount === segs.length) {
    for (let k = 0; k < words.length; k++) if (k === words.length - 1 || words[k + 1].line !== words[k].line) out.set(words[k].i, words[k].line);
    return out;
  }
  const full = segs.map(s => s.text).join(' ');
  const ends: number[] = []; let acc = 0;
  segs.forEach((s, k) => { acc += s.text.length + (k ? 1 : 0); ends.push(acc); });
  let at = 0; let seg = 0; let last = -1;
  for (const w of words) {
    const p = full.indexOf(w.text, at);
    if (p < 0) continue;
    while (seg < ends.length - 1 && p >= ends[seg]) { if (last >= 0) out.set(last, seg); seg++; }
    at = p + w.text.length; last = w.i;
  }
  if (last >= 0) out.set(last, seg);
  return out;
}
