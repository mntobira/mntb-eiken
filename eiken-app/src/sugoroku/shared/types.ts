/**
 * ===================================================================
 * すごろく×マナトビ英検 共通型定義（契約ファイル）
 * ===================================================================
 * 『03_AI並列開発指示書』第2章B「AI 1〜AI 5 が共通で準拠するディレクトリ＆Firestoreデータ契約」
 * に厳密に準拠したインターフェース定義。
 *
 * 他AI（AI 2〜AI 5）が後方互換で拡張・参照できるよう、すべてのコレクション名・
 * ドキュメント構造・主要フィールド名を仕様どおりに固定する。
 */

import type { EikenGrade } from '../../eiken/config';

/** 英検4技能＋語彙の分野キー */
export type SugorokuSkillKey = 'reading' | 'listening' | 'writing' | 'speaking' | 'vocab';

/** `${EikenGrade}:${SugorokuSkillKey}` 形式の複合キー（例: 'eiken_2:listening'） */
export type GradeSkillKey = `${EikenGrade}:${SugorokuSkillKey}` | string;

/** すごろく塾内のロール */
export type SugorokuRole = 'owner' | 'staff' | 'student';

/**
 * Firestore コレクション・サブコレクション名定数
 * （eiken-app 内の firestoreMetered を通す場合は自動で eiken_ プレフィックスが付与される）
 */
export const SUGOROKU_COLLECTIONS = {
  classrooms: 'classrooms',
  sugorokuMembers: 'sugoroku_members',
  sugorokuStudyLogs: 'sugoroku_study_logs',
  studySummaries: 'study_summaries',
  assignments: 'assignments',
  writingSubmissions: 'writing_submissions',
  speakingSubmissions: 'speaking_submissions',
} as const;

/**
 * 1. 塾クラス・ロール（既存拡張）
 * Path: classrooms/{classId}/sugoroku_members/{uid} または sugoroku_members/{classId}_{uid}
 */
export interface SugorokuMemberDoc {
  uid: string;
  classId?: string;
  role: SugorokuRole;
  /** 講師管理画面内のみで扱う実名（名簿名）。公開ランキング等には絶対に出さない */
  rosterName?: string;
  /** 生徒のニックネーム（フォールバック用） */
  displayName?: string;
  /** 目標級（例: 'eiken_2', 'eiken_pre2plus', 'eiken_pre2'） */
  targetGrade: EikenGrade;
  active: boolean;
  /** 有料塾生は常に true（広告完全非表示） */
  adFree: boolean;
  email?: string;
  note?: string;
  joinedAt?: number;
  updatedAt?: number;
}

/**
 * 2. 分野別学習時間ログ
 * Path: users/{uid}/sugoroku_study_logs/{dateKey} （集計キャッシュ: study_summaries/{uid}）
 */
export interface SugorokuStudyLogDoc {
  /** 'YYYY-MM-DD' */
  dateKey: string;
  /** 1分無操作除外済みの有効学習秒数合計 */
  totalActiveSeconds: number;
  /** 級×技能別の有効学習秒数（例: { 'eiken_2:listening': 1500, 'eiken_2:reading': 900, 'eiken_2:vocab': 600 }） */
  byGradeSkill: Record<GradeSkillKey, number>;
  /** その日に解いた問題数 */
  solvedCount: number;
  /** オプション：級×技能別の正答数・解答数（正答率推移表示用） */
  accuracyByGradeSkill?: Record<GradeSkillKey, { correct: number; total: number }>;
  updatedAt: number;
}

/**
 * 生徒ごとの集計キャッシュ（一覧高速表示用）
 * Path: study_summaries/{uid}
 */
export interface SugorokuStudySummaryDoc {
  uid: string;
  totalActiveSeconds: number;
  weeklyActiveSeconds?: number;
  todayActiveSeconds?: number;
  byGradeSkillTotal?: Record<GradeSkillKey, number>;
  solvedTotal: number;
  lastActiveAt?: number;
  lastDateKey?: string;
  updatedAt: number;
}

/** 技能別ノルマ内訳（問数または語数） */
export interface SugorokuSkillBreakdown {
  reading?: number;
  listening?: number;
  vocab?: number;
  writing?: number;
  speaking?: number;
}

/**
 * 3. 日次/週次 宿題（ペースメーカー）
 * Path: classrooms/{classId}/assignments/{assignmentId}（および既存 class_assignments 互換）
 */
export interface SugorokuAssignmentDoc {
  id: string;
  classId: string;
  teacherUid: string;
  title: string;
  chapterIds: string[];
  /** 締切タイムスタンプ（ms） */
  dueAt: number;
  /** 開始タイムスタンプ（ms） */
  startAt?: number;
  /** 個別配信対象生徒UID配列（未指定または空配列時はクラス全員） */
  targetStudentUids?: string[];
  /** 1日あたりの推奨問数（ペースメーカー用） */
  dailyQuotaProblems?: number;
  /** 技能別の問題数内訳 */
  skillBreakdown?: SugorokuSkillBreakdown;
  createdAt?: number;
  updatedAt?: number;
}

/** ライティング講師添削データ */
export interface SugorokuWritingReview {
  reviewerUid: string;
  reviewerName?: string;
  /** 英検4観点または総合スコア */
  score: number;
  maxScore?: number;
  rubricScores?: {
    content?: number;
    organization?: number;
    vocabulary?: number;
    grammar?: number;
  };
  comment: string;
  correctedText?: string;
  reviewedAt: number;
}

/**
 * 4. ライティング提出＆講師添削返却
 * Path: classrooms/{classId}/writing_submissions/{submissionId}
 */
export interface SugorokuWritingSubmissionDoc {
  id: string;
  classId?: string;
  studentUid: string;
  studentName: string;
  grade: EikenGrade;
  taskKey: string;
  taskTitle?: string;
  promptSummary?: string;
  wordCount: number;
  text: string;
  formatWarnings: string[];
  status: 'submitted' | 'reviewed';
  submittedAt: number;
  review?: SugorokuWritingReview;
}

/** S-CBT スピーキングパート識別子 */
export type SugorokuSpeakingPartId = 'reading_aloud' | 'q1' | 'q2' | 'q3' | 'q4';

/** S-CBT スピーキング個別録音メタデータ */
export interface SugorokuSpeakingRecordingItem {
  partId: SugorokuSpeakingPartId;
  /** Storage path: sugoroku_speaking/{classId}/{uid}/{submissionId}/{partId}.{webm|m4a} */
  storagePath: string;
  /** デモ再生や署名付きURL解決後の再生URL（任意） */
  downloadUrl?: string;
  mimeType: string;
  durationSec: number;
}

/** S-CBT スピーキング講師評価データ */
export interface SugorokuSpeakingReview {
  reviewerUid: string;
  reviewerName?: string;
  rubricScores: {
    readingAloud?: number;
    response?: number;
    pronunciation?: number;
    grammarVocab?: number;
    attitude?: number;
    total?: number;
  };
  comment: string;
  reviewedAt: number;
}

/**
 * 5. S-CBTスピーキング録音提出・評価
 * Firestore: classrooms/{classId}/speaking_submissions/{submissionId}
 * Storage:   sugoroku_speaking/{classId}/{uid}/{submissionId}/{partId}.{webm|m4a}
 */
export interface SugorokuSpeakingSubmissionDoc {
  id: string;
  classId?: string;
  studentUid: string;
  studentName: string;
  grade: EikenGrade;
  setId: string;
  setTitle?: string;
  recordings: SugorokuSpeakingRecordingItem[];
  status: 'submitted' | 'reviewed';
  submittedAt: number;
  review?: SugorokuSpeakingReview;
}

/**
 * AI 3 が実装する「ライティング添削タブ」「スピーキング音声確認タブ」を
 * AI 1 の管理者ポータル（SugorokuAdminApp）へ差し込むための拡張スロットProps契約
 */
export interface SugorokuAdminExtensionSlots {
  /** AI 3 ライティング添削パネルを差し込むカスタムレンダー関数 */
  renderWritingReviewTab?: (ctx: {
    classId: string;
    isDemoMode: boolean;
    submissions: SugorokuWritingSubmissionDoc[];
    onSelectStudent?: (studentUid: string) => void;
  }) => import('react').ReactNode;
  /** AI 3 S-CBTスピーキング音声確認パネルを差し込むカスタムレンダー関数 */
  renderSpeakingReviewTab?: (ctx: {
    classId: string;
    isDemoMode: boolean;
    submissions: SugorokuSpeakingSubmissionDoc[];
    onSelectStudent?: (studentUid: string) => void;
  }) => import('react').ReactNode;
}
