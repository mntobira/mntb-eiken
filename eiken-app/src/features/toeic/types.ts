/**
 * TOEIC® Listening & Reading 拡張：型定義（2026-10-25 たたき台）
 *
 * 方針
 * - 共通テストと同じく「パート（大問）別演習 → 模試（通し）→ 復習 → 対戦・ガチャ」で扱う。
 * - React などに依存しない純粋な型だけ。マナトビの src/ にそのまま置ける。
 * - 1問ずつではなく「セット（共通の写真・音声・本文 + 設問群）」を最小単位にする。
 *   Part 1/2/5 も「設問1つのセット」として同じ形で持つ → 表示・採点・復習の部品を共通化できる。
 *
 * ※ TOEIC is a registered trademark of ETS. This product is not endorsed or approved by ETS.
 */

/* ───────── 基本 ───────── */

export type ToeicSection = 'listening' | 'reading';

/** Part 1〜7 */
export type ToeicPart = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Part 1/3/4/5/6/7 は A〜D、Part 2 は A〜C */
export type ChoiceLabel = 'A' | 'B' | 'C' | 'D';

/** 目標スコア帯（教材の難易度・単語レベルの両方に使う） */
export type ToeicBand = 400 | 500 | 600 | 730 | 860 | 990;

/** TOEIC の音声で使われる4つの発音 */
export type ToeicAccent = 'US' | 'UK' | 'CA' | 'AU';

/** ID 規約：`toeic-p{part}-{連番3桁}`（例 toeic-p3-012）。設問は `{setId}-q{n}` */
export type ToeicSetId = `toeic-p${ToeicPart}-${string}`;
export type ToeicQuestionId = `${ToeicSetId}-q${number}`;

/* ───────── 設問の種類（復習・弱点分析の軸） ───────── */

/** Part 2：最初の発話の型 */
export type Part2Prompt =
  | 'wh-who' | 'wh-what' | 'wh-when' | 'wh-where' | 'wh-why' | 'wh-how' | 'wh-which'
  | 'yes-no' | 'negative' | 'tag' | 'choice' | 'request-offer' | 'statement';

/** Part 3/4/7：設問の型 */
export type ComprehensionSkill =
  | 'main-idea'     // 目的・話題
  | 'detail'        // 詳細
  | 'inference'     // 推測
  | 'next-action'   // 次に何をするか
  | 'speaker-role'  // 話し手は誰か・どこで
  | 'intention'     // 意図問題（"…" と言ったのはなぜか）
  | 'graphic'       // 図表問題
  | 'not-true'      // NOT問題
  | 'vocabulary'    // 同義語問題（Part 7）
  | 'sentence-insert' // 文挿入問題（Part 7）
  | 'cross-reference'; // 複数文書の参照（Part 7）

/** Part 5/6：文法・語彙の分野 */
export type GrammarPoint =
  | 'part-of-speech' | 'verb-form' | 'tense' | 'voice' | 'agreement'
  | 'pronoun' | 'preposition' | 'conjunction' | 'relative' | 'comparison'
  | 'participle' | 'gerund-infinitive' | 'vocabulary' | 'collocation';

/** Part 6 だけの空所の型 */
export type Part6Blank = 'grammar' | 'vocabulary' | 'connector' | 'sentence-insert';

export type ToeicSkillTag = Part2Prompt | ComprehensionSkill | GrammarPoint | Part6Blank;

/* ───────── 素材（写真・音声・本文・図表） ───────── */

/** 画像（Part 1 の写真、Part 3/4 の図表、Part 7 の広告など） */
export interface ToeicImage {
  src: string;          // public/ からのパス
  alt: string;          // 読み上げ・画像が出ないとき用（必須）
  width?: number;
  height?: number;
}

/** 音声台本の1発話 */
export interface ScriptLine {
  speaker: string;          // 'M' | 'W' | 'M2' | 'Narrator' など
  accent: ToeicAccent;
  en: string;
  ja: string;               // 全訳（解説画面で使う）
}

/** 音声：ファイルがない間は TTS で読む（ElevenLabs 収録後に src を埋める） */
export interface ToeicAudio {
  src?: string;
  /** 設問の読み上げ（Part 1/2 は選択肢も音声のみ） */
  script: ScriptLine[];
  durationSec?: number;
}

/** 図表（Part 3/4 の graphic、Part 7 の表）。画像にせず表で持てるものは表で */
export interface ToeicGraphic {
  kind: 'table' | 'schedule' | 'map' | 'price-list' | 'chart' | 'image';
  title?: string;
  rows?: string[][];        // kind が table 系のとき
  image?: ToeicImage;       // kind が map/chart/image のとき
}

/** Part 6/7 の文書 */
export type PassageGenre =
  | 'email' | 'letter' | 'memo' | 'notice' | 'advertisement' | 'article'
  | 'form' | 'invoice' | 'schedule' | 'web-page' | 'review' | 'text-message-chain'
  | 'online-chat' | 'instructions';

export interface ToeicPassage {
  genre: PassageGenre;
  title?: string;
  /** 段落ごと。Part 6 の空所は `[[131]]`、Part 7 の文挿入位置は `[[1]]`〜`[[4]]` */
  paragraphs: string[];
  paragraphsJa: string[];
  /** チャットの発言者・時刻など */
  meta?: { sender?: string; time?: string }[];
  graphic?: ToeicGraphic;
}

/* ───────── 設問 ───────── */

export interface ToeicChoice {
  label: ChoiceLabel;
  /** Part 1/2 は本番では印刷されない → 解説で表示するために持つ */
  en: string;
  ja: string;
}

export interface ToeicQuestion {
  id: ToeicQuestionId;
  /** 本番の問題番号（1〜200）。模試に組んだときに振り直す */
  number?: number;
  /** Part 1/2 は空（音声のみ） */
  stem?: { en: string; ja: string };
  choices: ToeicChoice[];
  answer: ChoiceLabel;
  skill: ToeicSkillTag;
  /** 解説：正解の根拠 + 誤答それぞれのワナ */
  explanation: {
    reason: string;
    /** 根拠になる本文・台本の箇所（強調表示用） */
    evidence?: string[];
    distractors?: Partial<Record<ChoiceLabel, string>>;
  };
  /** 覚えたい語（単語帳・復習に流す） */
  vocabIds?: string[];
}

/* ───────── セット（パート別） ───────── */

interface SetBase<P extends ToeicPart> {
  id: ToeicSetId;
  part: P;
  band: ToeicBand;
  /** 場面（オフィス・空港・店…）。出題の偏りチェックに使う */
  scene?: string;
  questions: ToeicQuestion[];
  /** 制作メモ・出典（自作であること）・確認者 */
  source: { author: string; createdAt: string; reviewedBy?: string };
}

export interface Part1Set extends SetBase<1> { photo: ToeicImage; audio: ToeicAudio }
export interface Part2Set extends SetBase<2> { audio: ToeicAudio }
export interface Part3Set extends SetBase<3> { audio: ToeicAudio; graphic?: ToeicGraphic; speakers: 2 | 3 }
export interface Part4Set extends SetBase<4> {
  audio: ToeicAudio;
  graphic?: ToeicGraphic;
  talkType: 'announcement' | 'telephone-message' | 'radio' | 'meeting' | 'tour' | 'advertisement' | 'speech';
}
export interface Part5Set extends SetBase<5> {}
export interface Part6Set extends SetBase<6> { passage: ToeicPassage }
export interface Part7Set extends SetBase<7> {
  /** 1つ＝シングル、2つ＝ダブル、3つ＝トリプル */
  passages: [ToeicPassage] | [ToeicPassage, ToeicPassage] | [ToeicPassage, ToeicPassage, ToeicPassage];
}

export type ToeicSet = Part1Set | Part2Set | Part3Set | Part4Set | Part5Set | Part6Set | Part7Set;
export type ToeicSetOfPart<P extends ToeicPart> = Extract<ToeicSet, { part: P }>;

/* ───────── 模試（通し 200 問） ───────── */

export interface ToeicMockExam {
  id: `toeic-mock-${string}`;
  title: string;            // 「TOEIC 模試 第1回」
  band: ToeicBand;          // 想定の平均レベル
  /** パートの順にセットIDを並べる（中身は ToeicSet を別に持ち、使い回せる） */
  setIds: Record<ToeicPart, ToeicSetId[]>;
  /** ガチャ景品 PDF と連動するとき */
  printId?: string;
}

/** 演習の始め方（共通テストの「大問別 / 通し」と同じ扱い） */
export type ToeicSessionMode =
  | { kind: 'part'; part: ToeicPart; band?: ToeicBand; count: number }
  | { kind: 'mini'; minutes: 10 | 30 }       // 全パートを少しずつ（通学時間向け）
  | { kind: 'mock'; examId: ToeicMockExam['id']; section?: ToeicSection }
  | { kind: 'review'; source: 'missed' | 'skill'; skill?: ToeicSkillTag };

/* ───────── 記録・スコア ───────── */

export interface ToeicAnswerRecord {
  questionId: ToeicQuestionId;
  setId: ToeicSetId;
  part: ToeicPart;
  skill: ToeicSkillTag;
  picked: ChoiceLabel | null;   // null＝時間切れ・未回答
  correct: boolean;
  timeMs: number;
  answeredAt: number;           // epoch ms
}

export interface ToeicSessionResult {
  mode: ToeicSessionMode;
  startedAt: number;
  finishedAt: number;
  answers: ToeicAnswerRecord[];
  /** 通し模試のときだけ */
  estimate?: ToeicScoreEstimate;
}

/** 素点 → 推定スコア。公式の換算表は非公開なので「目安」と必ず表示する */
export interface ToeicScoreEstimate {
  listeningRaw: number;     // 0〜100
  readingRaw: number;       // 0〜100
  listening: number;        // 5〜495（5点刻み）
  reading: number;          // 5〜495
  total: number;            // 10〜990
  approximate: true;
}

/** ユーザーごとの累積（Firestore の users/{uid}/toeic に同期する想定） */
export interface ToeicProgress {
  targetBand: ToeicBand;
  /** 間違えた設問（復習待ち） */
  missed: ToeicQuestionId[];
  /** 2回連続正解など、卒業した設問 */
  mastered: ToeicQuestionId[];
  /** 分野ごとの正答数 / 回答数（弱点表示） */
  skillStats: Partial<Record<ToeicSkillTag, { correct: number; total: number }>>;
  partStats: Partial<Record<ToeicPart, { correct: number; total: number; avgTimeMs: number }>>;
  mockHistory: { examId: ToeicMockExam['id']; estimate: ToeicScoreEstimate; at: number }[];
  updatedAt: number;
}

/* ───────── TOEIC 単語（既存の英単語クイズに載せる） ───────── */

export interface ToeicWord {
  id: `toeic-w-${string}`;
  en: string;
  ja: string;
  pos: 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | 'preposition' | 'conjunction';
  band: ToeicBand;
  /** ビジネス場面のタグ（人事・経理・出張・会議…） */
  domain: string;
  example: { en: string; ja: string };
  /** Part 5 頻出の派生語（品詞問題用） */
  family?: { pos: ToeicWord['pos']; en: string }[];
  /** 言い換え（Part 3/4/7 のパラフレーズ対策） */
  paraphrases?: string[];
}
