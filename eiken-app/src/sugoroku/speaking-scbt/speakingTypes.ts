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

export interface ScbtIllustrationFrame {
  frameLabel: string; // 例: "1コマ目：放課後の体育館前" / "人物A"
  captionEn?: string; // カード内に印字される英語矢印・状況語（2級3コマ目等）
  sceneDescriptionJp: string; // 学習者・講師向けの場面補足（解説時表示）
  svgType:
    | 'sports_locker'
    | 'cafeteria_order'
    | 'cycling_park'
    | 'morning_library';
  frameIndex: number;
}

export interface ScbtSpeakingQuestionSpec {
  partId: Exclude<SugorokuSpeakingPartId, 'reading_aloud'>; // 'q1' | 'q2' | 'q3' | 'q4'
  numberLabel: string; // 例: "No. 1"
  questionType:
    | 'passage_comprehension' // No.1 パッセージに基づく質問
    | 'picture_narration_3step' // 2級 No.2 3コマ展開ナレーション
    | 'picture_action_state' // 準2級 No.2/No.3 イラスト内の人物の行動・状況描写
    | 'personal_opinion' // 受験者自身の考え・理由2つ
    | 'social_topic_opinion'; // 社会テーマへの賛否・意見
  /** S-CBT 画面で面接官音声として読み上げられる英語質問文 */
  promptAudioScript: string;
  /** S-CBT 本番で画面上に質問文が表示されるか（No.4 等や練習サポート切替用） */
  showPromptOnScreenByDefault: boolean;
  /** 導入の前提文（例: "Now, please look at the picture..." / "Some people say that..."） */
  introAudioScript?: string;
  /** No.2 ナレーション等で指定される書き出し文（例: "One day, Ken and his club members..."） */
  starterSentence?: string;
  /** 準備時間（秒）：S-CBT本番準拠 */
  prepSeconds: number;
  /** 録音制限時間（秒）：S-CBT本番準拠 */
  recordSeconds: number;
  /** 満点配点目安（音読5点・各問5点または10点等） */
  maxScore: number;
  /** 講師・自己点検用の評価チェックポイント */
  rubricPoints: string[];
  /** 完全オリジナルの模範解答（1例） */
  modelAnswer: string;
  /** 模範解答の日本語訳 */
  modelTranslation: string;
}

export interface ScbtSpeakingSet {
  id: string; // 例: 'scbt_g2_set01'
  origin: 'manatobi-original';
  grade: Extract<EikenGrade, 'eiken_2' | 'eiken_pre2' | 'eiken_pre2plus' | 'eiken_3' | 'eiken_pre1'>;
  setNumber: number;
  title: string;
  themeSummaryJp: string;
  cardTitle: string; // 問題カードの見出し（英語）
  passage: string; // パッセージ本文（英語）
  passageTranslation: string; // パッセージ和訳（復習・講師確認用）
  silentReadSeconds: number; // 黙読時間（20秒）
  readAloudSeconds: number; // 音読録音時間（40〜45秒）
  readAloudMaxScore: number; // 音読満点（5点）
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

/**
 * 模擬課題セットの整合性バリデーション（問題追加時の事故・流用防止チェック）
 */
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
