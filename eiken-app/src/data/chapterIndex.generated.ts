import { EIKEN_GRADES } from '../eiken/config';
/**
 * ===================================================================
 * 章インデックス（自動生成ファイル・手で編集しないこと）
 * ===================================================================
 *
 * ★このファイルは scripts/gen-chapter-index.mts が生成する。★
 * 手で書き換えても次の生成で消えるので、直したい場合は
 * 教科データ本体（src/data/*.ts）を直してから
 *
 *     npm run gen:index
 *
 * を実行すること。
 *
 * -------------------------------------------------------------------
 * ■ これは何か
 * -------------------------------------------------------------------
 * 教科データから「章ID・章名・その章の大問数」だけを抜いた軽い索引。
 * 問題文・選択肢・解説は含まない。
 *
 * ホーム画面（Home.tsx）は起動直後に必ず出るが、出しているのは
 * 進捗の数字と次の章名だけで、問題文は1文字も表示していない。
 * それにも関わらず教科データ本体を全部読み込んでいたため、
 * 起動時に src/data から 50 ファイル・約 2.6MB を読んでいた。
 * この索引に切り替えると、ホームが読むのはこのファイル1枚だけになる。
 *
 * 問題を増やしてもこのファイルは章の数（現在 162 章）ぶんしか増えない。
 * 「問題数が莫大になっても起動が重くならない」ことがこの索引の目的である。
 *
 * -------------------------------------------------------------------
 * ■ 中身が本体とズレないこと
 * -------------------------------------------------------------------
 * tests/chapterIndex.test.ts が、教科データ本体から数え直した結果と
 * この索引を1件ずつ突き合わせる。問題を足して再生成を忘れると
 * そのテストが落ちるので、古い索引のままリリースされることはない。
 *
 * -------------------------------------------------------------------
 * ■ このファイルは他の src を一切 import しない（葉モジュール）
 * -------------------------------------------------------------------
 * ここから教科データを import してしまうと、索引にした意味が無くなる
 * （結局本体が読み込まれる）。★何も import しないことが仕様である。★
 */

/** 章1つぶんの索引。フィールド名は Home.tsx が元々読んでいたものと同じ。 */
export interface ChapterIndexEntry {
  id: string;
  title?: string;
  abstractTitle?: string;
  /**
   * 教科書上の章名（例「1章 物質の構成」）。
   *
   * 先生ダッシュボードの章名は `abstractTitle || realTitle || id` で決まるため、
   * abstractTitle が無い章のために必要。現在の実データでは全章が
   * abstractTitle を持っているので出番は無いが、無いと将来
   * 章名の代わりに生の章IDが表示される（しかも気づけない）。
   */
  realTitle?: string;
  /** この章の大問数（miniTest ＋ practiceProblems） */
  problemCount: number;
}

/** 教科1つぶんの索引。並び順・表示名も持たせて、画面が SUBJECTS を見ずに済むようにしている。 */
export interface SubjectIndexEntry {
  id: string;
  /** 画面に出す教科名（data/allChapters.ts の SUBJECTS の label と同じ） */
  label: string;
  chapters: readonly ChapterIndexEntry[];
}

/**
 * 教科の索引一覧。
 *
 * ★並び順は data/allChapters.ts の SUBJECTS と同じ★
 * （ホーム画面の教科別進捗はこの順に縦に並ぶため、順序が意味を持つ）。
 * 一致は tests/chapterIndex.test.ts が検査する。
 */
export const SUBJECT_INDEX: readonly SubjectIndexEntry[] = EIKEN_GRADES.map(grade => ({
  id: grade.id, label: grade.label, chapters: grade.available ? [{ id: `${grade.id}_listening_01`, abstractTitle: 'リスニング練習', realTitle: 'リスニング練習', problemCount: 2 }] : [],
}));

/**
 * 指定した教科の章索引を返す。
 *
 * 未知の教科IDのときは空配列ではなく先頭の教科（化学基礎）を返す。
 * これは data/allChapters.ts の getChaptersOfSubject と同じ既定の振る舞いで、
 * 画面が空にならないようにするためのもの。
 */
export function getChapterIndexOfSubject(
  subjectId: string | null | undefined,
): readonly ChapterIndexEntry[] {
  const entry = SUBJECT_INDEX.find((subject) => subject.id === subjectId) ?? SUBJECT_INDEX[0];
  return entry ? entry.chapters : [];
}

/**
 * 科目選択画面（タイトル画面）のカードに出す「収録ボリューム」の数字。
 *
 * -------------------------------------------------------------------
 * ■ なぜここに数字を置くのか
 * -------------------------------------------------------------------
 * 科目選択画面はオンボーディング直後に必ず出る画面だが、
 * 教科データから取っていたのは
 *
 *     「全29単元・演習174問」「配点100点・マーク37個」
 *
 * のような★数字だけ★で、問題文は1文字も表示していない。
 * それにも関わらず6教科ぶんのデータを丸ごと読み込んでいたため、
 * 依存グラフを辿ると 47 ファイル / 2,578,344 バイトになっていた。
 * 問題を増やせばこの数字がそのまま増える場所だった。
 *
 * -------------------------------------------------------------------
 * ■ 数字がズレない仕組み
 * -------------------------------------------------------------------
 * この値は生成時に★本物の集計関数★
 * （getListeningStats / getMathStats / getBiologyStats /
 *   getGrammarStats / countProblemsInChapters）を実際に呼び、
 * その戻り値をそのまま埋め込んだものである。
 * さらに tests/chapterIndex.test.ts が実行時にも本物の関数と
 * 1フィールドずつ突き合わせるので、
 * 問題を足して再生成を忘れるとテストが落ちる。
 *
 * 教科ごとに持っているキーが違うのは意図的で、
 * カードに出す数字の種類が教科ごとに違うため
 * （無理に統一するとカードの文言が変わってしまう）。
 */
export interface SubjectStatsEntry {
  chapters?: number;
  questions?: number;
  sections?: number;
  units?: number;
  points?: number;
  marks?: number;
}

export const SUBJECT_STATS: Readonly<Record<string, SubjectStatsEntry>> = Object.fromEntries(EIKEN_GRADES.map(grade => [grade.id, { chapters: grade.available ? 1 : 0, questions: grade.available ? 2 : 0, marks: grade.available ? 2 : 0, units: grade.available ? 1 : 0 }]));

/**
 * 指定した教科の収録ボリュームを返す。
 *
 * 未知の教科IDでも画面が壊れないよう、空オブジェクトを返す
 * （呼び出し側は数字が undefined のときの表示を持っている）。
 */
export function getSubjectStats(subjectId: string | null | undefined): SubjectStatsEntry {
  return SUBJECT_STATS[String(subjectId)] ?? {};
}
