/**
 * 章の満点でもらえる称号（C12・2026-10-29 ご要望「第1章 時制が満点取れたら称号ゲット」）。
 *
 * ■ 条件
 *   英文法の章の「全部の回」で、少なくとも1回ずつ満点（5問中5問）をとったとき。
 *   回ごとの最高点は utils/stageRecords.ts の記録（b＝最高の正答率％）を使う。
 *
 * ■ このファイルは何も import しない（葉）
 *   growthBadges.ts（称号の一覧）から読むため。教科データを import すると
 *   起動時に問題データ本体を読むことになる（tests/startupImportGraph.test.ts が見張っている）。
 *   章の並び・章名が教科データとずれていないかは tests/chapterTitles.test.ts が確かめる。
 */
export interface ChapterTitleDef {
  chapterId: string;
  /** 教科データの章名（例：第1章 時制） */
  chapterTitle: string;
  /** 称号の名前（例：時制マスター） */
  label: string;
}

export const CHAPTER_TITLES: readonly ChapterTitleDef[] = [
  { chapterId: 'eg6_1', chapterTitle: '第1章 時制', label: '時制マスター' },
  { chapterId: 'eg6_2', chapterTitle: '第2章 態', label: '態マスター' },
  { chapterId: 'eg6_3', chapterTitle: '第3章 助動詞', label: '助動詞マスター' },
  { chapterId: 'eg6_4', chapterTitle: '第4章 仮定法', label: '仮定法マスター' },
  { chapterId: 'eg6_5', chapterTitle: '第5章 不定詞', label: '不定詞マスター' },
  { chapterId: 'eg6_6', chapterTitle: '第6章 動名詞', label: '動名詞マスター' },
  { chapterId: 'eg6_7', chapterTitle: '第7章 分詞', label: '分詞マスター' },
  { chapterId: 'eg6_8', chapterTitle: '第8章 比較', label: '比較マスター' },
  { chapterId: 'eg6_9', chapterTitle: '第9章 代名詞', label: '代名詞マスター' },
  { chapterId: 'eg6_10', chapterTitle: '第10章 関係詞', label: '関係詞マスター' },
  { chapterId: 'eg6_11', chapterTitle: '第11章 接続詞', label: '接続詞マスター' },
  { chapterId: 'eg6_12', chapterTitle: '第12章 前置詞', label: '前置詞マスター' },
  { chapterId: 'eg6_13', chapterTitle: '第13章 主語と動詞の一致', label: '主語と動詞の一致マスター' },
  { chapterId: 'eg6_14', chapterTitle: '第14章 疑問文と語順', label: '疑問文と語順マスター' },
  { chapterId: 'eg6_15', chapterTitle: '第15章 否定・省略・強調', label: '否定・省略・強調マスター' },
  { chapterId: 'eg6_16', chapterTitle: '第16章 時制の一致と話法', label: '時制の一致と話法マスター' },
  { chapterId: 'eg6_17', chapterTitle: '第17章 動詞の語法', label: '動詞の語法マスター' },
  { chapterId: 'eg6_18', chapterTitle: '第18章 形容詞・副詞の語法', label: '形容詞・副詞の語法マスター' },
  { chapterId: 'eg6_19', chapterTitle: '第19章 名詞の語法', label: '名詞の語法マスター' },
  { chapterId: 'eg6_20', chapterTitle: '第20章 会話表現', label: '会話表現マスター' },
];

/** 称号（バッジ）の ID。例：b_ch_eg6_1 */
export const chapterTitleBadgeId = (chapterId: string): string => `b_ch_${chapterId}`;

export function chapterTitleOf(chapterId: string | null | undefined): ChapterTitleDef | undefined {
  return CHAPTER_TITLES.find((t) => t.chapterId === chapterId);
}
