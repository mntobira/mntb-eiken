/**
 * すごろく塾 × マナトビ英検 共通データ契約（AI 1 〜 AI 5 共通）
 *
 * 『03_AI並列開発指示書』第2章 B の Firestore スキーマ・共有型に厳密準拠。
 * 他 AI との後方互換を保つため、既存フィールドの削除・型破壊は行わず拡張のみ行うこと。
 */

import type { EikenGrade } from '../../eiken/config';
import type { ClassroomDoc } from '../../utils/classroomCore';

/** すごろく塾内のロール */
export type SugorokuRole = 'owner' | 'staff' | 'student';

/** 4技能＋語彙のスキル区分 */
export type SugorokuSkill = 'reading' | 'listening' | 'vocab' | 'writing' | 'speaking';

/**
 * 級×技能キー（例: 'eiken_2:listening', 'eiken_2:reading', 'eiken_2:vocab'）
 */
export type GradeSkillKey = `${EikenGrade}:${SugorokuSkill}` | string;

/**
 * Firestore: sugoroku_members/{uid}（実コレクション: eiken_sugoroku_members/{uid}）
 * 塾ロールおよび有料塾生の広告非表示（adFree: true）状態を保持する。
 */
export interface SugorokuMemberDoc {
  uid: string;
  role: SugorokuRole;
  targetGrade?: EikenGrade;
  active: boolean;
  adFree: true | boolean;
  classIds?: string[];
  displayName?: string;
  rosterName?: string;
  consentAcceptedAt?: number;
  joinedAt?: unknown;
  updatedAt?: unknown;
}

/**
 * 既存 ClassroomDoc（plan: 'juku'）を活用したすごろく塾クラス型
 */
export type SugorokuClassroomDoc = ClassroomDoc & {
  plan?: 'free' | 'juku';
};

/**
 * Firestore: users/{uid}/sugoroku_study_logs/{dateKey}
 * （eiken_ 名前空間では eiken_users/{uid}/sugoroku_study_logs/{dateKey}）
 */
export interface SugorokuStudyLogDoc {
  uid?: string;
  dateKey: string; // 'YYYY-MM-DD'
  totalActiveSeconds: number;
  byGradeSkill: Record<GradeSkillKey, number>;
  solvedCount: number;
  updatedAt: unknown;
}

/**
 * Firestore: study_summaries/{uid}（実コレクション: eiken_study_summaries/{uid}）
 */
export interface SugorokuStudySummaryDoc {
  uid: string;
  totalActiveSeconds: number;
  weekActiveSeconds?: number;
  todayActiveSeconds?: number;
  byGradeSkill: Record<GradeSkillKey, number>;
  solvedCount: number;
  lastActiveDateKey?: string;
  updatedAt: unknown;
}

/**
 * 日次/週次 宿題（ペースメーカー）の技能別問題数内訳
 */
export interface SugorokuSkillBreakdown {
  reading?: number;
  listening?: number;
  vocab?: number;
  writing?: number;
  speaking?: number;
}

/**
 * Firestore: classrooms/{classId}/assignments/{assignmentId}
 * （および既存 class_assignments との後方互換）
 */
export interface SugorokuAssignmentDoc {
  id: string;
  classId: string;
  teacherUid: string;
  title: string;
  chapterIds: string[];
  dueAt: number;
  targetStudentUids?: string[]; // 未指定時はクラス全員
  startAt?: number;
  dailyQuotaProblems?: number; // 1日推奨問数
  skillBreakdown?: SugorokuSkillBreakdown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * ライティング添削結果
 */
export interface SugorokuWritingReview {
  reviewerUid: string;
  score: number;
  comment: string;
  correctedText?: string;
  reviewedAt: unknown;
}

/**
 * Firestore: classrooms/{classId}/writing_submissions/{submissionId}
 */
export interface SugorokuWritingSubmissionDoc {
  id?: string;
  classId?: string;
  studentUid: string;
  studentName: string;
  grade: EikenGrade | string;
  taskKey: string;
  wordCount: number;
  text: string;
  formatWarnings: string[];
  status: 'submitted' | 'reviewed';
  submittedAt: unknown;
  review?: SugorokuWritingReview;
}

/** S-CBT スピーキングの録音パートID */
export type SugorokuSpeakingPartId = 'reading_aloud' | 'q1' | 'q2' | 'q3' | 'q4';

/** S-CBT スピーキングの個別録音メタ情報 */
export interface SugorokuSpeakingRecordingItem {
  partId: SugorokuSpeakingPartId;
  storagePath: string;
  mimeType: string;
  durationSec: number;
}

/** S-CBT スピーキングの講師評価 */
export interface SugorokuSpeakingReview {
  reviewerUid: string;
  rubricScores: Record<string, number>;
  comment: string;
  reviewedAt: unknown;
}

/**
 * Firestore: classrooms/{classId}/speaking_submissions/{submissionId}
 * Storage: sugoroku_speaking/{classId}/{uid}/{submissionId}/{partId}.{webm|m4a}
 */
export interface SugorokuSpeakingSubmissionDoc {
  id?: string;
  classId?: string;
  studentUid: string;
  studentName: string;
  grade: EikenGrade | string;
  setId: string;
  recordings: SugorokuSpeakingRecordingItem[];
  status: 'submitted' | 'reviewed';
  submittedAt: unknown;
  review?: SugorokuSpeakingReview;
}
