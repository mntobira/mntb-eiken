/**
 * ===================================================================
 * 章ID → 大問数（軽い索引から作る）
 * ===================================================================
 *
 * ■ なぜ data/chapterCatalog を使わないのか
 *   chapterCatalog は教科（=級）単位でしか引けず、宿題は複数の級にまたがる。
 *   また Home は「問題データ本体を読まない」方針で作られている
 *   （Home.tsx 冒頭のコメント参照）。宿題カードを Home の最上部に置く以上、
 *   ここから重い教科データを引き込んではならない。
 *
 *   data/chapterIndex.generated.ts は章ID・章名・大問数だけを持つ軽い索引で、
 *   全8級ぶんでも数十KB。大問数は problemCount として既に入っている。
 *
 * ■ 索引が古くないか
 *   tests/chapterIndex.test.ts が索引と本体を突き合わせている。
 *   再生成を忘れればテストが落ちるので、古い分母は本番に出ない。
 *
 * ■ このファイルは索引だけを import する（葉に近い）
 */

import { SUBJECT_INDEX } from '../../data/chapterIndex.generated';

let cache: Record<string, number> | null = null;

/** 章ID → 大問数（0 の章は含めない＝解きようがない章を分母にしない） */
export function chapterTotals(): Record<string, number> {
  if (cache) return cache;
  const out: Record<string, number> = {};
  SUBJECT_INDEX.forEach((subject) => {
    subject.chapters.forEach((chapter) => {
      const count = Math.max(0, Math.floor(chapter.problemCount || 0));
      if (count > 0) out[chapter.id] = count;
    });
  });
  cache = out;
  return out;
}

/** 級（教科ID）に属する章IDの一覧（存在する章だけ） */
export function chapterIdsOfGrade(grade: string): string[] {
  const entry = SUBJECT_INDEX.find((s) => s.id === grade);
  if (!entry) return [];
  return entry.chapters
    .filter((c) => (c.problemCount || 0) > 0)
    .map((c) => c.id);
}

/** 章ID → 表示名（宿題カードの「次に開く単元」に出す） */
export function chapterTitleOf(chapterId: string): string {
  for (const subject of SUBJECT_INDEX) {
    const hit = subject.chapters.find((c) => c.id === chapterId);
    if (hit) return (hit.abstractTitle || hit.realTitle || hit.title || chapterId).trim();
  }
  return chapterId;
}

/** 章ID → 所属する教科ID（例: 'eiken_2'）。見つからなければ null */
export function chapterSubjectOf(chapterId: string): string | null {
  if (!chapterId || !/^[A-Za-z0-9_-]{1,100}$/.test(chapterId)) return null;
  for (const subject of SUBJECT_INDEX) {
    if (subject.chapters.some((c) => c.id === chapterId)) return subject.id;
  }
  return null;
}

/** 添付された章IDが正規の英検カタログ内に実在するかをホワイトリスト検証する */
export function isValidEikenChapterId(chapterId: string | null | undefined): chapterId is string {
  if (!chapterId || typeof chapterId !== 'string') return false;
  return chapterSubjectOf(chapterId) !== null;
}

export interface AllGradesChapterCatalogItem {
  id: string;
  grade: string;
  gradeLabel: string;
  title: string;
  totalProblems: number;
}

/** 塾一括管理用：英検全級（5級〜1級）の全単元カタログを軽量索引から返す */
export function allEikenChapterCatalog(): AllGradesChapterCatalogItem[] {
  const out: AllGradesChapterCatalogItem[] = [];
  for (const subject of SUBJECT_INDEX) {
    if (!subject.id.startsWith('eiken_')) continue;
    const shortGrade = subject.label.replace(/^英検/, '');
    for (const ch of subject.chapters) {
      const count = Math.max(0, Math.floor(ch.problemCount || 0));
      if (count <= 0) continue;
      const rawTitle = (ch.title || ch.realTitle || ch.abstractTitle || ch.id).trim();
      out.push({
        id: ch.id,
        grade: subject.id,
        gradeLabel: shortGrade,
        title: `[${shortGrade}] ${rawTitle}`,
        totalProblems: count,
      });
    }
  }
  return out;
}
