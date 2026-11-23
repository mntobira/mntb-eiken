import type { EikenGrade } from '../../eiken/config';
import type { ClassroomDoc } from '../../utils/classroomCore';

/**
 * ============================================================================
 * すごろく×マナトビ英検 共通データ契約（AI 1 〜 AI 5 完全統合インターフェース）
 * ============================================================================
 * 『03_AI並列開発指示書』第2章 Table 3 の Firestore パス・フィールド仕様に厳密準拠。
 * AI 1（管理ポータル）・AI 2（宿題/学習時間）・AI 3（ライティング/S-CBTスピーキング）・
 * AI 4（認証/セキュリティルール）・AI 5（語彙/カリキュラム）すべてと 100% 型互換。
 */

export type SugorokuGradeId = EikenGrade;
export type SugorokuSkillKey = 'reading' | 'listening' | 'writing' | 'speaking' | 'vocab';
export type SugorokuSkill = SugorokuSkillKey;
export type GradeSkillKey = `${EikenGrade}:${SugorokuSkillKey}` | string;
export type SugorokuRole = 'owner' | 'staff' | 'student';

export const SUGOROKU_COLLECTIONS = {
  classrooms: 'classrooms',
  sugorokuMembers: 'sugoroku_members',
  sugorokuStaffInvites: 'sugoroku_staff_invites',
  sugorokuStudyLogs: 'sugoroku_study_logs',
  studySummaries: 'study_summaries',
  assignments: 'assignments',
  homeworkPlans: 'sugoroku_homework_plans',
  writingSubmissions: 'writing_submissions',
  speakingSubmissions: 'speaking_submissions',
} as const;

export const SUGOROKU_SPEAKING_STORAGE_PREFIX = 'sugoroku_speaking';
export const SUGOROKU_SPEAKING_MAX_BYTES = 5 * 1024 * 1024;

export const SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS = [
  'mntobira@gmail.com',
  'hirokingz0927@gmail.com',
] as const;

export type SugorokuClassroomDoc = ClassroomDoc & {
  plan?: 'free' | 'juku';
};

export interface SugorokuStaffInviteDoc {
  id: string;
  classId: string;
  className?: string;
  schoolName?: string;
  email: string;
  staffName: string;
  role: 'owner' | 'staff';
  status: 'invited' | 'active' | 'revoked';
  acceptedUid?: string;
  invitedByUid: string;
  createdAt: number;
  updatedAt: number;
}

// ----------------------------------------------------------------------------
// 1. 塾クラス・ロール（classrooms/{classId}, sugoroku_members/{uid}）
// ----------------------------------------------------------------------------

export interface SugorokuMemberDoc {
  uid: string;
  classId?: string;
  classIds?: string[];
  role: SugorokuRole;
  rosterName?: string;
  displayName?: string;
  targetGrade?: EikenGrade;
  active: boolean;
  adFree: boolean;
  email?: string;
  note?: string;
  consentAcceptedAt?: number;
  joinedAt?: number | unknown;
  updatedAt?: number | unknown;
  serverUpdatedAt?: unknown;
}

// ----------------------------------------------------------------------------
// 2. 分野別学習時間ログ（users/{uid}/sugoroku_study_logs/{dateKey}）
// ----------------------------------------------------------------------------

export interface SugorokuStudyLogDoc {
  uid?: string;
  dateKey: string; // 'YYYY-MM-DD'
  totalActiveSeconds: number;
  byGradeSkill: Record<GradeSkillKey, number>;
  solvedCount: number;
  accuracyByGradeSkill?: Record<GradeSkillKey, { correct: number; total: number }>;
  updatedAt: number;
}

export interface SugorokuStudySummaryDoc {
  uid: string;
  totalActiveSeconds: number;
  weeklyActiveSeconds?: number;
  weekActiveSeconds?: number;
  todayActiveSeconds?: number;
  byGradeSkill?: Record<GradeSkillKey, number>;
  byGradeSkillTotal?: Record<GradeSkillKey, number>;
  solvedTotal: number;
  solvedCount?: number;
  lastActiveAt?: number;
  lastDateKey?: string;
  lastActiveDateKey?: string;
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
  id: string;
  classId: string;
  teacherUid: string;
  title: string;
  chapterIds: string[];
  dueAt: number;
  startAt?: number;
  targetStudentUids?: string[];
  dailyQuotaProblems?: number;
  /** 目標周回数（例: 2周・3周。1周＝全大問クリア、2周目以降はアプリ内反復の目安表示） */
  targetLaps?: number;
  /** 講師からの学習メモ・やり方指示（例: 「間違えた問題は解説を読んで音読2回」） */
  coachInstruction?: string;
  skillBreakdown?: SugorokuSkillBreakdown;
  presetId?: string;
  presetWeek?: number;
  createdAt?: number;
  updatedAt?: number;
}

export type SugorokuHomeworkPlan = SugorokuAssignmentDoc;

export interface SugorokuHomeworkTask {
  assignmentId: string;
  classId: string;
  className: string;
  title: string;
  chapterIds: string[];
  dueAt: number;
  startAt?: number;
  nextChapterId: string;
  total: number;
  solved: number;
  remaining: number;
  percent: number;
  daysLeft: number;
  todayQuota: number;
  todayDone: number;
  todayRemaining: number;
  targetLaps?: number;
  coachInstruction?: string;
  overPacedToday?: boolean;
  skillBreakdown?: SugorokuSkillBreakdown;
  status: 'done' | 'late' | 'not_started' | 'on_track' | 'behind' | 'ahead';
  overdue: boolean;
  perDayNeeded: number;
  message: string;
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
  organization?: number; // AI 1 互換エイリアス
}

export interface SugorokuWritingReview {
  reviewerUid: string;
  reviewerName?: string;
  score: number;
  maxScore?: number;
  rubricScores?: Partial<SugorokuWritingRubricScores>;
  comment: string;
  correctedText?: string;
  strengths?: string;
  nextActions?: string;
  reviewedAt: number;
}

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
  downloadUrl?: string;
  mimeType: string;
  durationSec: number;
  sizeBytes?: number;
  /** 録音時間に対する有効発話フレーム率（0〜100%） */
  speechRatio?: number;
  /** 録音中の最長連続無音秒数（沈黙フリーズ検知用） */
  maxSilenceSec?: number;
  /** ブラウザ標準 SpeechRecognition による英語自動書き起こし（任意・API課金ゼロ） */
  transcript?: string;
}

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
    [key: string]: number | undefined;
  };
  comment: string;
  reviewedAt: number;
}

export interface SugorokuSpeakingSubmissionDoc {
  id: string;
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
  onSelectStudent?: (studentUid: string) => void;
}

export interface SugorokuAdminExtensionSlots {
  renderWritingReviewTab?: (ctx: {
    classId: string;
    classNameLabel?: string;
    reviewerUid?: string;
    reviewerName?: string;
    isDemoMode: boolean;
    demoMode?: boolean;
    submissions: SugorokuWritingSubmissionDoc[];
    onSelectStudent?: (studentUid: string) => void;
  }) => import('react').ReactNode;
  renderSpeakingReviewTab?: (ctx: {
    classId: string;
    classNameLabel?: string;
    reviewerUid?: string;
    reviewerName?: string;
    isDemoMode: boolean;
    demoMode?: boolean;
    submissions: SugorokuSpeakingSubmissionDoc[];
    onSelectStudent?: (studentUid: string) => void;
  }) => import('react').ReactNode;
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
  return `${SUGOROKU_SPEAKING_STORAGE_PREFIX}/${safeSeg(classId, 'classId')}/${safeSeg(
    uid,
    'uid',
  )}/${safeSeg(submissionId, 'submissionId')}/${partId}.${ext}`;
}
