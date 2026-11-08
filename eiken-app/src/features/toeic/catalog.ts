/**
 * TOEIC を学習カタログ（src/data/studyCatalog.ts）へ差し込むための形（2026-10-25・型だけ）
 *
 * まだ STUDY_CATALOG には足していない（足すと App の openStudyContent に分岐が要るため）。
 * 画面ができたら：
 *   1. StudyAction に ToeicStudyAction を足す
 *   2. STUDY_CATALOG の英語に TOEIC_STUDY_CONTENTS を並べる
 *   3. App の openStudyContent で kind: 'toeic' / 'toeicVocab' を ToeicHome へつなぐ
 */
import type { StudyContent } from '../../data/studyCatalog';
import type { ToeicBand, ToeicPart, ToeicSessionMode } from './types';

/** openStudyContent に足す action */
export type ToeicStudyAction =
  | { kind: 'toeic'; mode?: ToeicSessionMode }   // mode 省略＝TOEIC ホームを開く
  | { kind: 'toeicVocab'; band?: ToeicBand };

/** TOEIC ホーム内のタブ */
export type ToeicTab = 'parts' | 'mock' | 'vocab' | 'review' | 'score';

/** StudyContent と同じ形（action だけ TOEIC 用） */
export type ToeicStudyContent = Omit<StudyContent, 'action'> & { action: ToeicStudyAction };

export const TOEIC_STUDY_CONTENTS: readonly ToeicStudyContent[] = [
  {
    id: 'english_toeic', title: 'TOEIC', icon: 'headphones', badge: 'NEW',
    description: 'Part 1〜7 別の演習・模試・スコアの目安',
    meta: 'L&R 新形式・目標 400〜990',
    action: { kind: 'toeic' },
  },
  {
    id: 'english_toeic_vocab', title: 'TOEIC 単語', icon: 'letters', badge: 'NEW', section: 'memorize',
    description: 'スコア帯別のビジネス英単語・言い換え',
    meta: '目標スコア別',
    action: { kind: 'toeicVocab' },
  },
];

/** パート別演習の初期の出題数（セット数） */
export const DEFAULT_SET_COUNT: Record<ToeicPart, number> = { 1: 6, 2: 10, 3: 3, 4: 3, 5: 10, 6: 2, 7: 3 };
