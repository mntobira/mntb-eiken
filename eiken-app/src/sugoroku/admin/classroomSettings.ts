/**
 * ============================================================================
 * クラス運営・塾設定ストア（純粋モデル ＋ Firestore / ローカル永続化）
 * ============================================================================
 *
 * 既存の `eiken_classrooms/{classId}` は厳格なフィールド制約（hasOnly）を持つため、
 * 1. 基本フィールド（schoolName, className, subject, joinOpen, plan）は
 *    `eiken_classrooms/{classId}` 本体で更新する。
 * 2. 塾運営で不可欠な詳細設定（運営形態・1日の目標学習時間・週の目標日数・
 *    目標検定回・重点スキル・生徒への案内メモ）は
 *    `eiken_classrooms/{classId}/sugoroku_settings/config` および
 *    ローカルキャッシュに保存し、オフライン・即時描画にも対応する。
 */

import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from '../../utils/firestoreMetered';
import { db, FIREBASE_CONFIGURED, USE_EMULATORS } from '../../firebase';
import {
  CLASSROOMS_COLLECTION,
  CLASS_CODES_COLLECTION,
  requireUid,
  toFriendlyError,
} from '../../utils/classroomShared';
import {
  validateClassroomInput,
  type ClassroomDoc,
  type ClassroomInput,
} from '../../utils/classroomCore';
import { createClassroom } from '../../utils/classroom';
import { ensureRootInstructorBootstrap } from './firestoreAdminService';
import type { SugorokuSkillKey } from '../shared/types';
import { getGradeLabel } from './adminAnalytics';

export type ClassOrgType = 'juku' | 'tutor' | 'school';

export type ExamSessionTarget =
  | 'scbt_monthly'
  | 'session_1'
  | 'session_2'
  | 'session_3'
  | 'undecided';

export interface JukuClassSettings {
  classId: string;
  /** 運営形態（塾・予備校 / 個別・英会話 / 学校・部活） */
  orgType: ClassOrgType;
  /** 1日の目標学習時間（分）：10〜180 */
  dailyGoalMinutes: number;
  /** 週の目標学習日数（日）：1〜7 */
  weeklyGoalDays: number;
  /** 目標検定回・受験方式 */
  examSession: ExamSessionTarget;
  /** 重点指導スキル（1〜5個） */
  focusSkills: SugorokuSkillKey[];
  /** 指導方針・保護者/生徒案内メモ（最大200文字） */
  coachNote: string;
  updatedAt: number;
}

export interface ClassPreset {
  id: string;
  badge: string;
  label: string;
  className: string;
  subject: ClassroomDoc['subject'];
  dailyGoalMinutes: number;
  weeklyGoalDays: number;
  examSession: ExamSessionTarget;
  focusSkills: SugorokuSkillKey[];
  coachNote: string;
}

export const ORG_TYPE_OPTIONS: Array<{
  value: ClassOrgType;
  label: string;
  orgFieldLabel: string;
  orgPlaceholder: string;
  classFieldLabel: string;
  classPlaceholder: string;
  description: string;
}> = [
  {
    value: 'juku',
    label: '学習塾・オンライン塾',
    orgFieldLabel: '塾・ブランド名',
    orgPlaceholder: '例）オンライン塾 すごろく / ○○進学塾 本校',
    classFieldLabel: 'コース・クラス名',
    classPlaceholder: '例）英検2級 一次＆S-CBT合格コース（火・金）',
    description: '宿題配信・学習時間トラッキング・広告非表示（塾プラン）に最適',
  },
  {
    value: 'tutor',
    label: '個別指導・英語スクール',
    orgFieldLabel: '教室・スクール名',
    orgPlaceholder: '例）○○英語アカデミー / 個別指導○○',
    classFieldLabel: '担当枠・グループ名',
    classPlaceholder: '例）準2級 S-CBT短期集中グループ',
    description: '少人数・マンツーマンの進捗確認やライティング・面接対策向け',
  },
  {
    value: 'school',
    label: '高校・中学校',
    orgFieldLabel: '学校名',
    orgPlaceholder: '例）○○高等学校',
    classFieldLabel: '学年・クラス・講座名',
    classPlaceholder: '例）2年A組 英語コミュニケーションⅡ / 英検課外',
    description: 'クラス単位の朝学習・長期休暇課題・観点別評価CSV出力向け',
  },
];

export const DAILY_GOAL_OPTIONS = [15, 20, 30, 45, 60] as const;
export const WEEKLY_DAYS_OPTIONS = [3, 4, 5, 6, 7] as const;

export const EXAM_SESSION_OPTIONS: Array<{ value: ExamSessionTarget; label: string; shortLabel: string }> = [
  { value: 'scbt_monthly', label: '英検 S-CBT（毎月受験・4技能1日完結）', shortLabel: 'S-CBT受験' },
  { value: 'session_1', label: '第1回 従来型検定（5〜7月）', shortLabel: '第1回検定' },
  { value: 'session_2', label: '第2回 従来型検定（9〜11月）', shortLabel: '第2回検定' },
  { value: 'session_3', label: '第3回 従来型検定（1〜2月）', shortLabel: '第3回検定' },
  { value: 'undecided', label: '通年・基礎固め（受験回を固定しない）', shortLabel: '通年コース' },
];

export const FOCUS_SKILL_OPTIONS: Array<{ key: SugorokuSkillKey; label: string }> = [
  { key: 'vocab', label: '語彙・熟語' },
  { key: 'reading', label: 'リーディング' },
  { key: 'listening', label: 'リスニング' },
  { key: 'writing', label: 'ライティング添削' },
  { key: 'speaking', label: 'スピーキング(S-CBT)' },
];

/**
 * Firestore ルールの `eiken_classrooms` で許可されている英検級一覧（準1級〜5級）。
 * ※ eiken_classrooms のルールは eiken_5〜eiken_pre1 を対象とするため、保存エラーが起きない級のみ提示し、
 *   初期選択は塾で最も需要が高い「英検2級」にする。
 */
export const CLASSROOM_ALLOWED_SUBJECTS: Array<{
  value: ClassroomDoc['subject'];
  label: string;
  shortDesc: string;
}> = [
  { value: 'eiken_2', label: '英検2級', shortDesc: '高校卒業・大学入試標準（最人気）' },
  { value: 'eiken_pre2', label: '英検準2級', shortDesc: '高校中級・高1〜高2主力' },
  { value: 'eiken_pre2plus', label: '英検準2級プラス', shortDesc: '準2級→2級ブリッジ新設級' },
  { value: 'eiken_pre1', label: '英検準1級', shortDesc: '難関私大・国公立二次レベル' },
  { value: 'eiken_3', label: '英検3級', shortDesc: '中学卒業・高校入試レベル' },
  { value: 'eiken_4', label: '英検4級', shortDesc: '中学中級レベル' },
  { value: 'eiken_5', label: '英検5級', shortDesc: '中学初級・英語入門' },
];

export const JUKU_CLASS_SUBJECT_DEFAULT: ClassroomDoc['subject'] = 'eiken_2';

export const JUKU_COURSE_PRESETS: ClassPreset[] = [
  {
    id: 'eiken2_scbt',
    badge: '定番・大学受験',
    label: '英検2級 S-CBT＆一次突破',
    className: '英検2級 一次＆S-CBT合格コース',
    subject: 'eiken_2',
    dailyGoalMinutes: 30,
    weeklyGoalDays: 5,
    examSession: 'scbt_monthly',
    focusSkills: ['vocab', 'reading', 'listening', 'writing', 'speaking'],
    coachNote: '毎日30分の分散学習（語彙＋長文/リスニング）と週1本の英作文提出をペースメーカーにします。',
  },
  {
    id: 'pre2_standard',
    badge: '高1・中3人気',
    label: '英検準2級 4技能標準コース',
    className: '英検準2級 4技能ステップアップ',
    subject: 'eiken_pre2',
    dailyGoalMinutes: 20,
    weeklyGoalDays: 5,
    examSession: 'session_2',
    focusSkills: ['vocab', 'listening', 'reading', 'writing'],
    coachNote: 'まずは1日20分×週5日の習慣化からスタート。まとまった週末ではなく平日のスキマ時間を重視します。',
  },
  {
    id: 'pre2plus_bridge',
    badge: '新設級対策',
    label: '準2級プラス→2級ブリッジ',
    className: '英検準2級プラス 短期攻略クラス',
    subject: 'eiken_pre2plus',
    dailyGoalMinutes: 30,
    weeklyGoalDays: 5,
    examSession: 'scbt_monthly',
    focusSkills: ['vocab', 'reading', 'writing'],
    coachNote: '準2級合格から2級への壁を越えるための語彙強化・要約ライティング重点クラスです。',
  },
  {
    id: 'pre1_intensive',
    badge: '難関大対策',
    label: '英検準1級 難関突破コース',
    className: '英検準1級 ハイレベル演習クラス',
    subject: 'eiken_pre1',
    dailyGoalMinutes: 45,
    weeklyGoalDays: 6,
    examSession: 'scbt_monthly',
    focusSkills: ['vocab', 'reading', 'listening', 'writing', 'speaking'],
    coachNote: '語彙・長文精読とエッセイ添削を中心に、毎日45分の高密度演習を行います。',
  },
  {
    id: 'eiken3_junior',
    badge: '中学生・基礎',
    label: '英検3級 基礎＆二次面接コース',
    className: '英検3級 一次・面接まるごと対策',
    subject: 'eiken_3',
    dailyGoalMinutes: 15,
    weeklyGoalDays: 4,
    examSession: 'session_1',
    focusSkills: ['vocab', 'listening', 'reading'],
    coachNote: '毎日15分の音声リスニングと単語から無理なく継続するクラスです。',
  },
];

const SETTINGS_STORAGE_PREFIX = 'eiken:v1:sugoroku_class_settings_';
const LAST_SCHOOL_NAME_KEY = 'eiken:v1:sugoroku_last_org_name';

export function createDefaultClassSettings(classId = ''): JukuClassSettings {
  return {
    classId,
    orgType: 'juku',
    dailyGoalMinutes: 30,
    weeklyGoalDays: 5,
    examSession: 'scbt_monthly',
    focusSkills: ['vocab', 'reading', 'listening', 'writing'],
    coachNote: '',
    updatedAt: Date.now(),
  };
}

export function normalizeClassSettings(
  raw: Partial<JukuClassSettings> | null | undefined,
  classId = '',
): JukuClassSettings {
  const base = createDefaultClassSettings(classId);
  if (!raw) return base;

  const orgType: ClassOrgType =
    raw.orgType === 'juku' || raw.orgType === 'tutor' || raw.orgType === 'school'
      ? raw.orgType
      : base.orgType;

  const dailyRaw = Number(raw.dailyGoalMinutes);
  const dailyGoalMinutes = Number.isFinite(dailyRaw)
    ? Math.max(10, Math.min(180, Math.round(dailyRaw)))
    : base.dailyGoalMinutes;

  const weeklyRaw = Number(raw.weeklyGoalDays);
  const weeklyGoalDays = Number.isFinite(weeklyRaw)
    ? Math.max(1, Math.min(7, Math.round(weeklyRaw)))
    : base.weeklyGoalDays;

  const examSession: ExamSessionTarget = EXAM_SESSION_OPTIONS.some((o) => o.value === raw.examSession)
    ? (raw.examSession as ExamSessionTarget)
    : base.examSession;

  const validSkillSet = new Set<SugorokuSkillKey>(['vocab', 'reading', 'listening', 'writing', 'speaking']);
  const focusSkills = Array.isArray(raw.focusSkills)
    ? raw.focusSkills.filter((k): k is SugorokuSkillKey => validSkillSet.has(k as SugorokuSkillKey))
    : base.focusSkills;

  const coachNote = typeof raw.coachNote === 'string' ? raw.coachNote.trim().slice(0, 200) : '';

  return {
    classId: classId || raw.classId || '',
    orgType,
    dailyGoalMinutes,
    weeklyGoalDays,
    examSession,
    focusSkills: focusSkills.length > 0 ? focusSkills : base.focusSkills,
    coachNote,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  };
}

export function getExamSessionShortLabel(target: ExamSessionTarget): string {
  return EXAM_SESSION_OPTIONS.find((o) => o.value === target)?.shortLabel ?? '通年コース';
}

export function loadLastOrgName(): string {
  try {
    return localStorage.getItem(LAST_SCHOOL_NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveLastOrgName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(LAST_SCHOOL_NAME_KEY, trimmed);
  } catch {
    // ignore storage quota errors
  }
}

export function loadCachedClassSettings(classId: string): JukuClassSettings {
  if (!classId) return createDefaultClassSettings('');
  try {
    const raw = localStorage.getItem(`${SETTINGS_STORAGE_PREFIX}${classId}`);
    if (!raw) return createDefaultClassSettings(classId);
    return normalizeClassSettings(JSON.parse(raw) as Partial<JukuClassSettings>, classId);
  } catch {
    return createDefaultClassSettings(classId);
  }
}

export function saveCachedClassSettings(settings: JukuClassSettings): void {
  if (!settings.classId) return;
  try {
    localStorage.setItem(`${SETTINGS_STORAGE_PREFIX}${settings.classId}`, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchClassSettings(classId: string): Promise<JukuClassSettings> {
  const cached = loadCachedClassSettings(classId);
  if (!classId || (!FIREBASE_CONFIGURED && !USE_EMULATORS)) {
    return cached;
  }
  try {
    const snap = await getDoc(doc(db, `${CLASSROOMS_COLLECTION}/${classId}/sugoroku_settings`, 'config'));
    if (!snap.exists()) return cached;
    const normalized = normalizeClassSettings(snap.data() as Partial<JukuClassSettings>, classId);
    saveCachedClassSettings(normalized);
    return normalized;
  } catch {
    return cached;
  }
}

export async function saveClassSettings(
  classId: string,
  input: Omit<JukuClassSettings, 'classId' | 'updatedAt'>,
): Promise<JukuClassSettings> {
  const normalized = normalizeClassSettings({ ...input, classId, updatedAt: Date.now() }, classId);
  saveCachedClassSettings(normalized);

  if (classId && (FIREBASE_CONFIGURED || USE_EMULATORS)) {
    try {
      await setDoc(
        doc(db, `${CLASSROOMS_COLLECTION}/${classId}/sugoroku_settings`, 'config'),
        {
          classId,
          orgType: normalized.orgType,
          dailyGoalMinutes: normalized.dailyGoalMinutes,
          weeklyGoalDays: normalized.weeklyGoalDays,
          examSession: normalized.examSession,
          focusSkills: normalized.focusSkills,
          coachNote: normalized.coachNote,
          updatedAt: normalized.updatedAt,
          serverUpdatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch {
      // ルール未反映環境でもローカル設定として保持しブロックしない
    }
  }
  return normalized;
}

/**
 * クラスを作成する（オーナー講師の場合は自動で `plan: 'juku'` を有効化し、
 * 宿題配信・学習時間集計・参加生徒の広告完全非表示を即時解放する）。
 */
export async function createManagedClassroom(params: {
  schoolName: string;
  className: string;
  subject: ClassroomDoc['subject'];
  enableJukuPlan?: boolean;
  settings: Omit<JukuClassSettings, 'classId' | 'updatedAt'>;
}): Promise<{ classroom: ClassroomDoc; settings: JukuClassSettings }> {
  // 事前承認オーナー（mntobira / hirokingz0927）が初回クラス作成前に sugoroku_members/{uid} を自動ブートストラップ
  await ensureRootInstructorBootstrap().catch(() => null);

  const created = await createClassroom({
    schoolName: params.schoolName,
    className: params.className,
    subject: params.subject,
  });

  saveLastOrgName(params.schoolName);

  let finalRoom: ClassroomDoc = created;
  if (params.enableJukuPlan !== false) {
    try {
      await updateDoc(doc(db, CLASSROOMS_COLLECTION, created.id), {
        plan: 'juku',
        updatedAt: serverTimestamp(),
      });
      finalRoom = { ...created, plan: 'juku' };
    } catch {
      // 一般教員アカウント等で plan: 'juku' 権限がない場合は標準クラスとしてそのまま成立させる
      finalRoom = created;
    }
  }

  const savedSettings = await saveClassSettings(created.id, params.settings);
  return { classroom: finalRoom, settings: savedSettings };
}

/**
 * 既存クラスの基本情報（塾名/学校名・クラス名・対象級・受付状態・塾プラン）と
 * 学習目標設定を一括更新する。
 */
export async function updateManagedClassroom(params: {
  room: ClassroomDoc;
  schoolName: string;
  className: string;
  subject: ClassroomDoc['subject'];
  joinOpen: boolean;
  upgradeToJukuPlan?: boolean;
  settings: Omit<JukuClassSettings, 'classId' | 'updatedAt'>;
}): Promise<{ classroom: ClassroomDoc; settings: JukuClassSettings }> {
  requireUid();
  const input: ClassroomInput = {
    schoolName: params.schoolName,
    className: params.className,
    subject: params.subject,
  };
  const validation = validateClassroomInput(input);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const trimmedSchool = params.schoolName.trim();
  const trimmedClass = params.className.trim();
  const nextPlan: ClassroomDoc['plan'] =
    params.upgradeToJukuPlan || params.room.plan === 'juku' ? 'juku' : params.room.plan;

  try {
    await updateDoc(doc(db, CLASSROOMS_COLLECTION, params.room.id), {
      schoolName: trimmedSchool,
      className: trimmedClass,
      subject: params.subject,
      joinOpen: params.joinOpen,
      ...(nextPlan === 'juku' ? { plan: 'juku' } : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    // もし plan: 'juku' 昇格権限のみ不足していた場合は plan を維持して基本項目だけ更新する
    if (params.upgradeToJukuPlan && params.room.plan !== 'juku') {
      try {
        await updateDoc(doc(db, CLASSROOMS_COLLECTION, params.room.id), {
          schoolName: trimmedSchool,
          className: trimmedClass,
          subject: params.subject,
          joinOpen: params.joinOpen,
          updatedAt: serverTimestamp(),
        });
      } catch (innerErr) {
        throw toFriendlyError(innerErr, 'クラス設定の保存に失敗しました。');
      }
    } else {
      throw toFriendlyError(err, 'クラス設定の保存に失敗しました。');
    }
  }

  saveLastOrgName(trimmedSchool);
  const savedSettings = await saveClassSettings(params.room.id, params.settings);
  const updatedRoom: ClassroomDoc = {
    ...params.room,
    schoolName: trimmedSchool,
    className: trimmedClass,
    subject: params.subject,
    joinOpen: params.joinOpen,
    ...(nextPlan === 'juku' ? { plan: 'juku' } : {}),
  };

  return { classroom: updatedRoom, settings: savedSettings };
}

/**
 * 誤って作成したクラスや終了した空クラスを削除し、参加コードも解放する。
 */
export async function deleteManagedClassroom(room: ClassroomDoc): Promise<void> {
  requireUid();
  try {
    if (room.joinCode) {
      await deleteDoc(doc(db, CLASS_CODES_COLLECTION, room.joinCode)).catch(() => undefined);
    }
    await deleteDoc(doc(db, CLASSROOMS_COLLECTION, room.id));
  } catch (err) {
    throw toFriendlyError(err, 'クラスの削除に失敗しました。');
  }
}

/**
 * 生徒ワンタップ参加用の招待URLを生成する（?sugoroku_invite=XXXXXX）。
 * このURLから開くと生徒側でコードが自動入力され、塾生ゲートが立ち上がる。
 */
export function buildClassInviteUrl(joinCode: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://manatobi-eiken.vercel.app');
  return `${base.replace(/\/$/, '')}/?sugoroku_invite=${encodeURIComponent(joinCode.trim())}`;
}

/**
 * LINE・公式LINE・保護者連絡網・Google Classroom にそのまま貼り付けられる招待案内文を生成する。
 */
export function buildClassInviteMessage(params: {
  room: ClassroomDoc;
  settings: JukuClassSettings;
  origin?: string;
}): string {
  const { room, settings, origin } = params;
  const url = buildClassInviteUrl(room.joinCode, origin);
  const gradeLabel = getGradeLabel(room.subject);
  const weeklyTotalMin = settings.dailyGoalMinutes * settings.weeklyGoalDays;
  const sessionLabel = getExamSessionShortLabel(settings.examSession);
  const lines = [
    `【${room.schoolName}】英検学習クラスへのご招待`,
    `コース：${room.className}（対象：${gradeLabel} / ${sessionLabel}）`,
    `学習ペース目安：1日${settings.dailyGoalMinutes}分 × 週${settings.weeklyGoalDays}日（週${weeklyTotalMin}分）`,
    '',
    '▼ 参加方法（約30秒）',
    `1. 下の招待リンクを開き、Googleでログイン`,
    `${url}`,
    `2. 招待コード「${room.joinCode}」を確認して参加完了！`,
    room.plan === 'juku'
      ? '※ 塾生専用モード（広告完全非表示・宿題ペースメーカー対応）が自動で有効になります。'
      : '※ アプリ内の「設定 ＞ クラスに参加」からコード入力でも参加できます。',
  ];
  if (settings.coachNote) {
    lines.push('', `💬 担当より：${settings.coachNote}`);
  }
  return lines.join('\n');
}
