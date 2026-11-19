import type { EikenGrade } from '../../eiken/config';

/**
 * ============================================================================
 * すごろく×マナトビ英検 共通データ契約（AI 1 〜 AI 5 共通インターフェース）
 * ============================================================================
 * 『03_AI並列開発指示書』第2章 Table 3 の Firestore パス・フィールド仕様に厳密準拠。
 * 他AIが拡張する場合も後方互換（optional フィールド追加のみ）を維持すること。
 */

// ----------------------------------------------------------------------------
// 1. 塾クラス・ロール（classrooms/{classId}, sugoroku_members/{uid}）
// ----------------------------------------------------------------------------

export type SugorokuRole = 'owner' | 'staff' | 'student';

export interface SugorokuMemberDoc {
  uid: string;
  role: SugorokuRole;
  targetGrade?: EikenGrade;
  active: boolean;
  adFree: boolean;
  displayName?: string;
  rosterName?: string;
  email?: string;
  classIds?: string[];
  updatedAt?: number;
}

// ----------------------------------------------------------------------------
// 2. 分野別学習時間ログ（users/{uid}/sugoroku_study_logs/{dateKey}）
// ----------------------------------------------------------------------------

export type SugorokuSkill = 'reading' | 'listening' | 'writing' | 'speaking' | 'vocab';

/** キー形式例: 'eiken_2:listening', 'eiken_2:reading', 'eiken_2:vocab' */
export type GradeSkillKey = `${EikenGrade}:${SugorokuSkill}` | string;

export interface SugorokuStudyLogDoc {
  dateKey: string; // 'YYYY-MM-DD'
  totalActiveSeconds: number;
  byGradeSkill: Record<GradeSkillKey, number>;
  solvedCount: number;
  updatedAt: number;
}

// ----------------------------------------------------------------------------
// 3. 日次/週次 宿題（classrooms/{classId}/assignments/{assignmentId}）
// ----------------------------------------------------------------------------

export interface SugorokuSkillBreakdown {
  reading?: number;
  listening?: number;
  vocab?: number;
  writing?: number;
  speaking?: number;
}

export interface SugorokuAssignmentDoc {
  id?: string;
  classId?: string;
  teacherUid?: string;
  title: string;
  chapterIds: string[];
  dueAt: number;
  targetStudentUids?: string[];
  startAt?: number;
  dailyQuotaProblems?: number;
  skillBreakdown?: SugorokuSkillBreakdown;
  createdAt?: number;
}

// ----------------------------------------------------------------------------
// 4. ライティング提出 ＆ 講師添削返却
//    Firestore: classrooms/{classId}/writing_submissions/{submissionId}
// ----------------------------------------------------------------------------

export type SugorokuSubmissionStatus = 'submitted' | 'reviewed';

export interface SugorokuWritingRubricScores {
  content: number; // 内容 (0-4)
  structure: number; // 構成 (0-4)
  vocabulary: number; // 語彙 (0-4)
  grammar: number; // 文法 (0-4)
}

export interface SugorokuWritingReview {
  reviewerUid: string;
  reviewerName?: string;
  score: number; // 合計スコア（例: 0〜16点）
  maxScore?: number; // 既定 16
  rubricScores?: SugorokuWritingRubricScores;
  comment: string;
  correctedText?: string;
  strengths?: string;
  nextActions?: string;
  reviewedAt: number;
}

export interface SugorokuWritingSubmissionDoc {
  id?: string;
  classId?: string;
  studentUid: string;
  studentName: string;
  grade: EikenGrade;
  taskKey: string;
  taskTitle?: string;
  wordCount: number;
  text: string;
  formatWarnings: string[];
  status: SugorokuSubmissionStatus;
  submittedAt: number;
  review?: SugorokuWritingReview;
}

// ----------------------------------------------------------------------------
// 5. S-CBTスピーキング 録音提出・評価
//    Firestore: classrooms/{classId}/speaking_submissions/{submissionId}
//    Storage:   sugoroku_speaking/{classId}/{uid}/{submissionId}/{partId}.{webm|m4a}
// ----------------------------------------------------------------------------

export type SugorokuSpeakingPartId = 'reading_aloud' | 'q1' | 'q2' | 'q3' | 'q4';

export type SugorokuSpeakingAudioExt = 'webm' | 'm4a';

export interface SugorokuSpeakingRecordingItem {
  partId: SugorokuSpeakingPartId;
  storagePath: string;
  mimeType: string;
  durationSec: number;
  sizeBytes?: number;
}

export interface SugorokuSpeakingReview {
  reviewerUid: string;
  reviewerName?: string;
  rubricScores: Record<string, number>;
  comment: string;
  reviewedAt: number;
}

export interface SugorokuSpeakingSubmissionDoc {
  id?: string;
  classId?: string;
  studentUid: string;
  studentName: string;
  grade: EikenGrade;
  setId: string;
  setTitle?: string;
  recordings: SugorokuSpeakingRecordingItem[];
  status: SugorokuSubmissionStatus;
  submittedAt: number;
  review?: SugorokuSpeakingReview;
}

// ----------------------------------------------------------------------------
// 6. AI 1 管理者ポータル ⇔ AI 3 タブ差し込み用共通 Props 契約
// ----------------------------------------------------------------------------

export interface SugorokuAdminReviewTabProps {
  classId: string;
  classNameLabel?: string;
  reviewerUid?: string;
  reviewerName?: string;
  demoMode?: boolean;
}

/**
 * Storage パス契約ヘルパー
 * 形式: sugoroku_speaking/{classId}/{uid}/{submissionId}/{partId}.{webm|m4a}
 */
export function buildSpeakingStoragePath(
  classId: string,
  uid: string,
  submissionId: string,
  partId: SugorokuSpeakingPartId,
  ext: SugorokuSpeakingAudioExt,
): string {
  const safeSeg = (val: string, label: string) => {
    const trimmed = String(val || '').trim();
    if (!trimmed || /[\\/]/.test(trimmed)) {
      throw new Error(`不正なStorageパス要素です (${label})`);
    }
    return trimmed;
  };
  return `sugoroku_speaking/${safeSeg(classId, 'classId')}/${safeSeg(uid, 'uid')}/${safeSeg(
    submissionId,
    'submissionId',
  )}/${partId}.${ext}`;
}
