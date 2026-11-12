/**
 * 学習カタログ（B17：データ駆動）2026-10-01
 *
 *   科目（subject） → 学習コンテンツ（contents） → 既存の単元・演習画面
 *
 * 画面（StudyCatalog）はこのデータを読むだけで、科目ごとの分岐を持たない。
 * 新しい科目を足すときは、ここに1件足す（＋そのコンテンツの action を App に1つ用意する）だけでよい。
 * 中身（問題データ・進捗・回答履歴）は既存のものをそのまま使い、ここでは「どの画面を開くか」だけを持つ。
 */
import { getSubjectStats } from './chapterIndex.generated';
import { EIKEN_GRADES } from '../eiken/config';
import { EIKEN_UNITS } from '../eiken/questions';
import { bookletWritingTasks } from '../eiken/writtenPractice';
import { isSubjectEnabled } from '../config/features';
import { VOCABULARY_COUNT } from './listeningVocabularyMeta.generated';

/** コンテンツを押したときに開く既存の画面。App 側で1か所にまとめて解釈する */
export type StudyAction =
  | { kind: 'units'; subject: string }           // 既存の単元一覧（ChapterSelection）
  | { kind: 'foundation'; tab: 'words' | 'grammar' | 'more' } // 既存の固めるページの各タブ
  | { kind: 'vocabQuiz' }                         // 英単語の4択演習（2026-10-01）
  | { kind: 'reading' }
  | { kind: 'writing' };                         // 英文解釈（内容一致の4択）2026-10-21

export type StudyIcon = 'headphones' | 'pen' | 'letters' | 'book' | 'flask' | 'sigma' | 'globe' | 'briefcase';

export interface StudyContent {
  id: string;
  title: string;
  /** 1行の説明（何が学べるか） */
  description: string;
  /** 規模（単元数・問題数など）。データから作る */
  meta: string;
  icon: StudyIcon;
  /** 主役のコンテンツ（カードを少し強調する） */
  primary?: boolean;
  /**
   * 並べる場所（2026-10-01 夜）。
   *   'practice' … 問題を解くもの（リスニング・英文法・英単語の4択）。単元と同じ列に並べる
   *   'memorize' … 覚えるための暗記帳（英単語帳）。問題とは混ぜず、最初から別の枠に置く
   *   'spotlight' … とびら君の吹き出しの右に置く小さな入口（2026-10-28 TOEIC）。カードの列には並べない
   * 省略は 'practice'。
   */
  section?: 'practice' | 'memorize' | 'spotlight';
  /** 進捗の集計に使う科目ID（単元一覧を持つコンテンツだけ） */
  progressSubject?: string;
  /** タイトル横の小さな札（例：'NEW'）。「前回」のほうが優先 */
  badge?: string;
  action: StudyAction;
}

export interface StudySubject {
  id: string;
  label: string;
  /** 科目カードの一言 */
  description: string;
  icon: StudyIcon;
  contents: StudyContent[];
}

/** 共通のカタログUIを使う。大学入試・TOEICの教材への入口は登録しない。 */
export const STUDY_CATALOG: readonly StudySubject[] = [{
  id: 'eiken', label: '英検', description: '級別の読む・聞く・語彙文法', icon: 'headphones',
  contents: [
    ...EIKEN_GRADES.filter(grade => isSubjectEnabled(grade.id)).map((grade): StudyContent => {
      const stats = getSubjectStats(grade.id);
      return {
        id: grade.id, title: grade.label, primary: true, icon: 'headphones',
        description: 'リーディング・リスニング・語彙文法を練習',
        meta: `${stats.chapters}単元・${stats.marks}問`, progressSubject: grade.id,
        action: { kind: 'units', subject: grade.id },
      };
    }),
    { id: 'eiken_writing', title: '英検ライティング', icon: 'pen', description: '3級〜準1級の返信・意見・要約。下書き保存と自己点検', meta: `5級別・${EIKEN_UNITS.reduce((n, unit) => n + unit.writing.length, 0) + bookletWritingTasks().length}課題`, action: { kind: 'writing' } },
    {
      id: 'english_vocabulary', title: '英単語帳（暗記帳）', icon: 'letters', section: 'memorize',
      description: '5級〜準1級の重点語・例文・意味を級別に学ぶ',
      meta: `${VOCABULARY_COUNT.toLocaleString()}語`, action: { kind: 'foundation', tab: 'words' },
    },
  ],
}];

export function findStudySubject(id: string | null | undefined): StudySubject | undefined {
  return STUDY_CATALOG.find(s => s.id === id);
}
