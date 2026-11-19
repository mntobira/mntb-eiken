/**
 * ===================================================================
 * すごろく塾向け機能の共通型（AI 1〜AI 5 共通データ契約）
 * ===================================================================
 *
 * ■ このファイルの位置づけ
 *   『03_AI並列開発指示書』第2章の共同契約を、実コードで1か所に固定する。
 *   各AIはここに定義された名前（フィールド名）に厳密に揃えること。
 *   ★既存に無い項目は「追加」のみ。既存項目の改名・削除は禁止（後方互換）。★
 *
 * ■ 既存資産との関係（重要な読み替え）
 *   指示書の表では classrooms/{classId}/assignments/{assignmentId} と
 *   書かれているが、現行リポジトリの実装は
 *     class_assignments/{assignmentId}（classId フィールドで紐付け）
 *   である。既存の JukuTab / classAssignments / firestore.rules を
 *   壊さないことが最優先なので、本実装は既存形を正とする。
 *   そのうえで「ペース設定」など追加情報だけを別コレクションに重ねる
 *   （重ねられない環境では自動計算で代替する。homework/homeworkPlans.ts）。
 *
 * ■ 学習ログのコレクション名
 *   指示書は users/{uid}/sugoroku_study_logs/{dateKey} だが、
 *   現行ルールでは eiken_users 配下は全面禁止で、サブコレクションの
 *   ルールも存在しない。そこでトップレベルの
 *     eiken_sugoroku_study_logs/{uid}_{dateKey}
 *   を使う（＝本番反映は AI 4 のルール追加とセット）。
 *   ルール案は docs/SUGOROKU_AI2_HOMEWORK_TIMELOG.md に記載している。
 *
 * ■ このファイルは他の src を import しない（葉モジュール）
 *   型だけを置く。値（定数）を足すときも、依存を持たないものに限る。
 */

/** 英検の級ID（既存 eiken/config.ts の EikenGrade と同一の並び） */
export type SugorokuGradeId =
  | 'eiken_5'
  | 'eiken_4'
  | 'eiken_3'
  | 'eiken_pre2'
  | 'eiken_pre2plus'
  | 'eiken_2'
  | 'eiken_pre1'
  | 'eiken_1';

/** 4技能＋語彙。指示書の skillBreakdown（reading/listening/vocab/writing/speaking）に一致 */
export type SugorokuSkill = 'reading' | 'listening' | 'writing' | 'speaking' | 'vocab';

/** 級×技能の内訳キーの形（例 'eiken_2:listening'）。Firestore の map キーに使う */
export type GradeSkillKey = string;

/**
 * 1日ぶんの分野別学習ログ。
 *   eiken_sugoroku_study_logs/{uid}_{dateKey}
 *
 * totalActiveSeconds は「有効学習時間」（前面表示＋1分無操作除外＋音声再生中は加算）。
 * byGradeSkill の合計と一致させる必要はない（級・技能が特定できない画面がある）。
 */
export interface SugorokuStudyLogDoc {
  uid: string;
  /** 'YYYY-MM-DD'（端末のローカル日付） */
  dateKey: string;
  totalActiveSeconds: number;
  byGradeSkill: Record<GradeSkillKey, number>;
  /** その日に解いた大問数（分かる範囲。0 は不明） */
  solvedCount: number;
  /** 最終更新（ms）。Firestore では number で持つ（ルール検証を単純にするため） */
  updatedAt: number;
}

/**
 * 教師が配る「ペースメーカー付き宿題」の追加情報。
 *   eiken_sugoroku_homework_plans/{assignmentId}
 * 既存 class_assignments の1件に対応する（assignmentId をそのまま doc ID にする）。
 * ルール未適用の環境では保存に失敗するので、読み書きは必ず「失敗しても学習を止めない」形にする。
 */
export interface SugorokuHomeworkPlan {
  /** = class_assignments のドキュメントID */
  id: string;
  classId: string;
  teacherUid: string;
  title: string;
  chapterIds: string[];
  /** 締切（ms）。その日の 23:59:59.999 */
  dueAt: number;
  /** 配信開始（ms）。未指定は作成時刻 */
  startAt?: number;
  /** 1日の推奨問数。未指定なら「残り ÷ 残り日数」で自動計算 */
  dailyQuotaProblems?: number;
  /** 技能別の目安（問数ではなく「重み」として使う。合計は自由） */
  skillBreakdown?: Partial<Record<SugorokuSkill, number>>;
  /** 個別配信。未指定はクラス全員 */
  targetStudentUids?: string[];
  /** 適用したプリセット（例 'eiken2-12w'） */
  presetId?: string;
  createdAt?: number;
}

/** 生徒ホームのカードに出す1件ぶんの表示モデル（純粋計算の結果） */
export interface SugorokuHomeworkTask {
  assignmentId: string;
  classId: string;
  className: string;
  title: string;
  chapterIds: string[];
  dueAt: number;
  /** 次に開くべき単元（未完了の先頭） */
  nextChapterId: string;
  total: number;
  solved: number;
  remaining: number;
  percent: number;
  /** 締切までの残り日数（今日を含む。0 は今日まで） */
  daysLeft: number;
  /** 今日やるべき問数 */
  todayQuota: number;
  /** 今日すでに解いた数（締切前から解いた分は含めない近似） */
  todayDone: number;
  todayRemaining: number;
  /** 全体の状態 */
  status: 'done' | 'late' | 'not_started' | 'on_track' | 'behind' | 'ahead';
  overdue: boolean;
  /** 1日に必要な問数（自動計算） */
  perDayNeeded: number;
  /** 生徒への声掛け（1文） */
  message: string;
}
