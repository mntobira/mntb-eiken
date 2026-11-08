/**
 * 単元一覧（章タブの中）を「見出しつきの小分け」にするための共通処理。
 *
 * ■ なぜ必要か
 *   1つのタブの中に性質の違う単元が混ざっている教科がある。
 *     ・数学   … 同じ分野に「基礎〜標準」「網羅」「パターン演習」の教材がある
 *     ・地理   … 「第1問」に「単元演習」と「模試」が混ざる
 *     ・化学   … 問題がまだ入っていない単元が、解ける単元の間にはさまっている
 *   見出しなしで並べると、生徒はどれから解けばよいか分からない。
 *
 * ★問題・単元ID・学習記録は変えない★ 並べ方と見出しだけ。
 */

export interface UnitSection<C> {
  /** 見出し（null なら見出しを出さない） */
  key: string | null;
  label: string | null;
  chapters: C[];
}

type AnyChapter = { id: string; abstractTitle?: string; mathStage?: string; practiceProblems?: unknown[] };

const MATH_STAGE_LABEL: Record<string, string> = {
  basic: '基礎〜標準',
  full: '網羅（全範囲）',
  pattern: 'パターン演習',
};

/** 単元1つの小分けのキー（教科ごと） */
export function unitSectionKey(subject: string, chapter: AnyChapter, questionCount: number): { key: string; label: string } | null {
  if (subject === 'math' && chapter.mathStage) {
    return { key: `math:${chapter.mathStage}`, label: MATH_STAGE_LABEL[chapter.mathStage] ?? chapter.mathStage };
  }
  if (subject === 'geography') {
    const title = chapter.abstractTitle || '';
    if (/（模試）/.test(title)) return { key: 'geo:exam', label: '模試（本番形式・3題セット）' };
    if (/予想問題/.test(title)) return { key: 'geo:exam', label: '模試（本番形式・3題セット）' };
    return { key: 'geo:unit', label: '単元演習' };
  }
  if (questionCount === 0) return { key: 'empty', label: '準備中（問題を追加予定）' };
  return null;
}

/**
 * 単元を小分けにする。
 *   - 同じキーの単元は元の順番のまま1つにまとめる
 *   - 「準備中」は必ず最後に回す（解ける単元を先に見せる）
 *   - 見出しが1種類しかない（＝全部同じ）ときは見出しを出さない
 */
export function buildUnitSections<C extends AnyChapter>(
  subject: string,
  chapters: readonly C[],
  countOf: (chapter: C) => number,
): UnitSection<C>[] {
  const sections: UnitSection<C>[] = [];
  const byKey = new Map<string, UnitSection<C>>();
  const plain: C[] = [];
  for (const chapter of chapters) {
    const k = unitSectionKey(subject, chapter, countOf(chapter));
    if (!k) { plain.push(chapter); continue; }
    let sec = byKey.get(k.key);
    if (!sec) {
      sec = { key: k.key, label: k.label, chapters: [] };
      byKey.set(k.key, sec);
    }
    sec.chapters.push(chapter);
  }
  if (plain.length) sections.push({ key: null, label: null, chapters: plain });
  const keyed = [...byKey.values()].sort((a, b) => Number(a.key === 'empty') - Number(b.key === 'empty'));
  sections.push(...keyed);
  // 見出しが1種類だけ（しかも準備中でない）なら見出しは不要
  if (sections.length === 1 && sections[0].key !== 'empty') return [{ key: null, label: null, chapters: sections[0].chapters }];
  return sections;
}
