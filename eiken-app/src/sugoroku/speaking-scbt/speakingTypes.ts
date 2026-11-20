import type { EikenGrade } from '../../eiken/config';
import type { SugorokuSpeakingPartId } from '../shared/types';

/**
 * ============================================================================
 * 英検 S-CBT 方式 スピーキング模擬問題データスキーマ
 * ============================================================================
 * 藤沢様（すごろく側）×マナトビ側で今後オリジナル模擬セットを増設しやすいよう、
 * JSON シリアライズ可能な純粋データ構造として定義。
 * 市販書・過去問からの流用は厳禁（origin: 'manatobi-original' のみ登録可）。
 */

export type ScbtSvgSceneType =
  | 'sports_locker'
  | 'cafeteria_order'
  | 'station_umbrella'
  | 'community_garden'
  | 'cycling_park'
  | 'morning_library'
  | 'school_festival'
  | 'bookshop_gift';

export interface ScbtIllustrationFrame {
  frameLabel: string;
  captionEn?: string;
  sceneDescriptionJp: string;
  svgType: ScbtSvgSceneType;
  frameIndex: number;
}

export interface ScbtSpeakingQuestionSpec {
  partId: Exclude<SugorokuSpeakingPartId, 'reading_aloud'>; // 'q1' | 'q2' | 'q3' | 'q4'
  numberLabel: string;
  questionType:
    | 'passage_comprehension'
    | 'picture_narration_3step'
    | 'picture_action_state'
    | 'personal_opinion'
    | 'social_topic_opinion';
  promptAudioScript: string;
  showPromptOnScreenByDefault: boolean;
  introAudioScript?: string;
  starterSentence?: string;
  prepSeconds: number;
  recordSeconds: number;
  maxScore: number;
  rubricPoints: string[];
  modelAnswer: string;
  modelTranslation: string;
}

export interface ScbtSpeakingSet {
  id: string;
  origin: 'manatobi-original';
  grade: Extract<EikenGrade, 'eiken_2' | 'eiken_pre2' | 'eiken_pre2plus' | 'eiken_3' | 'eiken_pre1'>;
  setNumber: number;
  title: string;
  themeSummaryJp: string;
  cardTitle: string;
  passage: string;
  passageTranslation: string;
  silentReadSeconds: number;
  readAloudSeconds: number;
  readAloudMaxScore: number;
  illustrations: ScbtIllustrationFrame[];
  questions: [
    ScbtSpeakingQuestionSpec,
    ScbtSpeakingQuestionSpec,
    ScbtSpeakingQuestionSpec,
    ScbtSpeakingQuestionSpec,
  ];
}

export const SCBT_PART_ORDER: readonly SugorokuSpeakingPartId[] = [
  'reading_aloud',
  'q1',
  'q2',
  'q3',
  'q4',
] as const;

export const SCBT_PART_LABELS: Readonly<Record<SugorokuSpeakingPartId, string>> = {
  reading_aloud: 'パッセージ音読',
  q1: 'No. 1（本文関連の質問）',
  q2: 'No. 2（イラスト描写）',
  q3: 'No. 3（イラスト状況／意見①）',
  q4: 'No. 4（自分の意見・理由）',
};

export function validateSpeakingSet(set: ScbtSpeakingSet): void {
  if (set.origin !== 'manatobi-original') {
    throw new Error(`${set.id}: origin must be 'manatobi-original'`);
  }
  if (!/^scbt_[a-z0-9_]+$/.test(set.id)) {
    throw new Error(`Invalid speaking set ID: ${set.id}`);
  }
  const passageWords = set.passage.trim().split(/\s+/).filter(Boolean).length;
  if (passageWords < 30 || passageWords > 110) {
    throw new Error(`${set.id}: passage word count (${passageWords}) out of expected range`);
  }
  if (set.silentReadSeconds <= 0 || set.readAloudSeconds <= 0) {
    throw new Error(`${set.id}: invalid reading timers`);
  }
  if (set.questions.length !== 4) {
    throw new Error(`${set.id}: must contain exactly 4 questions (q1..q4)`);
  }
  const expectedIds: Array<'q1' | 'q2' | 'q3' | 'q4'> = ['q1', 'q2', 'q3', 'q4'];
  set.questions.forEach((q, idx) => {
    if (q.partId !== expectedIds[idx]) {
      throw new Error(`${set.id}: question[${idx}] must have partId '${expectedIds[idx]}'`);
    }
    if (!q.promptAudioScript.trim() || !q.modelAnswer.trim() || !q.modelTranslation.trim()) {
      throw new Error(`${set.id}/${q.partId}: prompt, modelAnswer and modelTranslation are required`);
    }
    if (q.prepSeconds <= 0 || q.recordSeconds <= 0) {
      throw new Error(`${set.id}/${q.partId}: prepSeconds and recordSeconds must be > 0`);
    }
  });
}
