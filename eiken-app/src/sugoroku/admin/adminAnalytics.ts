/**
 * ===================================================================
 * すごろく塾管理者ポータル：純粋ロジック・集計・停滞アラート・CSV生成
 * ===================================================================
 * ブラウザ／DOM／Firestore に依存しない純粋関数群。Vitest から直接単体テスト可能。
 */

import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import { buildCsvText } from '../../utils/studySummaryCsv';
import type {
  GradeSkillKey,
  SugorokuAssignmentDoc,
  SugorokuMemberDoc,
  SugorokuSkillKey,
  SugorokuSpeakingSubmissionDoc,
  SugorokuStudyLogDoc,
  SugorokuWritingSubmissionDoc,
} from '../shared/types';

/** 技能ラベル定義 */
export const SKILL_LABELS: Record<SugorokuSkillKey, string> = {
  listening: 'リスニング',
  reading: 'リーディング（長文・空所）',
  vocab: '単語・大問1語彙',
  writing: 'ライティング（英作文）',
  speaking: 'スピーキング（S-CBT面接）',
};

export const SKILL_SHORT_LABELS: Record<SugorokuSkillKey, string> = {
  listening: 'リスニング',
  reading: 'リーディング',
  vocab: '単語・語彙',
  writing: 'ライティング',
  speaking: 'スピーキング',
};

export const SKILL_ORDER: readonly SugorokuSkillKey[] = [
  'listening',
  'reading',
  'vocab',
  'writing',
  'speaking',
];

/** 級ラベルを引く */
export function getGradeLabel(grade: string): string {
  return EIKEN_GRADES.find((g) => g.id === grade)?.label ?? grade;
}

export function getGradeShortLabel(grade: string): string {
  return EIKEN_GRADES.find((g) => g.id === grade)?.shortLabel ?? grade;
}

/** 'eiken_2:listening' を { grade, skill, label } に分解 */
export function parseGradeSkillKey(rawKey: GradeSkillKey): {
  grade: EikenGrade | string;
  skill: SugorokuSkillKey | string;
  label: string;
} {
  const [gradePart = 'eiken_2', skillPart = 'reading'] = String(rawKey).split(':');
  const gradeLabel = getGradeLabel(gradePart);
  const skillLabel =
    (SKILL_SHORT_LABELS as Record<string, string>)[skillPart] ?? skillPart;
  return {
    grade: gradePart,
    skill: skillPart,
    label: `${gradeLabel} ${skillLabel}`,
  };
}

/** 秒数を「1時間25分」「45分」「1分未満」「0分」に整形 */
export function formatDurationJa(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  if (safe === 0) return '0分';
  const totalMin = Math.floor(safe / 60);
  if (totalMin === 0) return '1分未満';
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
  }
  return `${mins}分`;
}

/** 秒数を分数（小数第1位または整数分）に変換（CSV用） */
export function toMinutesRounded(seconds: number): number {
  return Math.round((Math.max(0, Number(seconds) || 0) / 60) * 10) / 10;
}

/** ローカルタイム基準または指定msから YYYY-MM-DD を生成 */
export function formatDateKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 基準日 YYYY-MM-DD から N日前の YYYY-MM-DD を返す */
export function shiftDateKey(baseDateKey: string, deltaDays: number): string {
  const [y, m, d] = baseDateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  dt.setDate(dt.getDate() + deltaDays);
  return formatDateKey(dt.getTime());
}

/** 直近N日分の dateKey 配列（古い順→今日）を生成 */
export function buildRecentDateKeys(todayKey: string, days: number): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    keys.push(shiftDateKey(todayKey, -i));
  }
  return keys;
}

/** 停滞・宿題遅延アラート種別 */
export type StudentAlertReason =
  | 'inactive_3days'
  | 'homework_overdue'
  | 'homework_behind_pace'
  | 'never_studied';

export interface StudentAlertBadge {
  reason: StudentAlertReason;
  severity: 'critical' | 'warning';
  label: string;
}

/** 管理者一覧およびドリルダウン用の生徒統合レコード */
export interface SugorokuStudentOverview {
  uid: string;
  /** 塾管理画面内専用の実名（名簿名）。未設定時はニックネーム */
  rosterName: string;
  nickname?: string;
  targetGrade: EikenGrade;
  note?: string;
  adFree: boolean;
  /** 今週（直近7日）の有効学習秒数 */
  weeklyActiveSeconds: number;
  /** 本日の有効学習秒数 */
  todayActiveSeconds: number;
  /** 累計有効学習秒数 */
  totalActiveSeconds: number;
  /** 今週解いた問題数 */
  weeklySolvedCount: number;
  /** 宿題消化状況 */
  homework: {
    completedProblems: number;
    totalProblems: number;
    completionRate: number; // 0..100
    overdueCount: number;
    activeAssignmentTitle: string | null;
    dueAt: number | null;
  };
  /** 最終アクセス（学習）タイムスタンプ */
  lastActiveAt: number | null;
  /** 最終学習日 YYYY-MM-DD */
  lastStudiedDateKey: string | null;
  /** 何日間学習が空いているか（未学習は 999） */
  inactiveDays: number;
  /** 停滞・遅延アラート一覧（重大順） */
  alerts: StudentAlertBadge[];
  /** 級×技能別の累計・直近集計 */
  gradeSkillBreakdown: Array<{
    key: GradeSkillKey;
    grade: string;
    skill: string;
    label: string;
    weeklySeconds: number;
    totalSeconds: number;
    correct: number;
    totalQuestions: number;
    accuracyPct: number | null;
  }>;
  /** 直近14日の日別ログ（古い順→今日） */
  recentDailyLogs: Array<{
    dateKey: string;
    shortDate: string;
    totalActiveSeconds: number;
    solvedCount: number;
    byGradeSkill: Record<GradeSkillKey, number>;
    accuracyPct: number | null;
  }>;
  /** 未添削のライティング・スピーキング件数 */
  pendingWritingCount: number;
  pendingSpeakingCount: number;
}

export interface BuildStudentOverviewInput {
  member: SugorokuMemberDoc;
  logs: SugorokuStudyLogDoc[];
  assignments: SugorokuAssignmentDoc[];
  /** 生徒の solved マップ（`chapterId::problemId` -> timestamp ms）または宿題進捗 */
  solvedByChapter?: Record<string, number>;
  chapterProblemTotals?: Record<string, number>;
  writingSubmissions?: SugorokuWritingSubmissionDoc[];
  speakingSubmissions?: SugorokuSpeakingSubmissionDoc[];
  nowMs?: number;
}

/**
 * 1名の塾生データを集計し、停滞アラート・今週/本日の有効学習時間・級×技能別内訳を算出する
 */
export function buildStudentOverview(input: BuildStudentOverviewInput): SugorokuStudentOverview {
  const nowMs = input.nowMs ?? Date.now();
  const todayKey = formatDateKey(nowMs);
  const recent7Keys = new Set(buildRecentDateKeys(todayKey, 7));
  const recent14Keys = buildRecentDateKeys(todayKey, 14);

  const logMap = new Map<string, SugorokuStudyLogDoc>();
  for (const log of input.logs) {
    if (log && typeof log.dateKey === 'string') {
      logMap.set(log.dateKey, log);
    }
  }

  let totalActiveSeconds = 0;
  let weeklyActiveSeconds = 0;
  let todayActiveSeconds = 0;
  let weeklySolvedCount = 0;
  let lastActiveAt: number | null = null;
  let lastStudiedDateKey: string | null = null;

  const skillTotalSec = new Map<string, number>();
  const skillWeeklySec = new Map<string, number>();
  const skillAcc = new Map<string, { correct: number; total: number }>();

  for (const log of input.logs) {
    const sec = Math.max(0, Math.floor(Number(log.totalActiveSeconds) || 0));
    totalActiveSeconds += sec;
    const isThisWeek = recent7Keys.has(log.dateKey);
    if (isThisWeek) {
      weeklyActiveSeconds += sec;
      weeklySolvedCount += Math.max(0, Math.floor(Number(log.solvedCount) || 0));
    }
    if (log.dateKey === todayKey) {
      todayActiveSeconds += sec;
    }
    if (sec > 0 || (log.solvedCount ?? 0) > 0) {
      if (!lastStudiedDateKey || log.dateKey > lastStudiedDateKey) {
        lastStudiedDateKey = log.dateKey;
      }
      if (typeof log.updatedAt === 'number' && (!lastActiveAt || log.updatedAt > lastActiveAt)) {
        lastActiveAt = log.updatedAt;
      }
    }

    for (const [gsKey, sVal] of Object.entries(log.byGradeSkill || {})) {
      const v = Math.max(0, Math.floor(Number(sVal) || 0));
      if (!v) continue;
      skillTotalSec.set(gsKey, (skillTotalSec.get(gsKey) ?? 0) + v);
      if (isThisWeek) {
        skillWeeklySec.set(gsKey, (skillWeeklySec.get(gsKey) ?? 0) + v);
      }
    }

    for (const [gsKey, acc] of Object.entries(log.accuracyByGradeSkill || {})) {
      if (!acc) continue;
      const cur = skillAcc.get(gsKey) ?? { correct: 0, total: 0 };
      cur.correct += Math.max(0, Number(acc.correct) || 0);
      cur.total += Math.max(0, Number(acc.total) || 0);
      skillAcc.set(gsKey, cur);
    }
  }

  // 何日間学習していないか計算
  let inactiveDays = 999;
  if (lastStudiedDateKey) {
    const [ty, tm, td] = todayKey.split('-').map(Number);
    const [ly, lm, ld] = lastStudiedDateKey.split('-').map(Number);
    const tDate = new Date(ty, tm - 1, td, 12, 0, 0).getTime();
    const lDate = new Date(ly, lm - 1, ld, 12, 0, 0).getTime();
    inactiveDays = Math.max(0, Math.round((tDate - lDate) / (24 * 60 * 60 * 1000)));
  }

  // 対象宿題の抽出（全員対象 または targetStudentUids に自分が含まれる）
  const myAssignments = (input.assignments || []).filter((a) => {
    if (!a.targetStudentUids || a.targetStudentUids.length === 0) return true;
    return a.targetStudentUids.includes(input.member.uid);
  });

  let hwCompleted = 0;
  let hwTotal = 0;
  let overdueCount = 0;
  let activeAssignmentTitle: string | null = null;
  let nearestDueAt: number | null = null;

  for (const a of myAssignments) {
    let aTotal = 0;
    let aSolved = 0;
    if (a.skillBreakdown) {
      const sb = a.skillBreakdown;
      aTotal =
        (sb.reading ?? 0) +
        (sb.listening ?? 0) +
        (sb.vocab ?? 0) +
        (sb.writing ?? 0) +
        (sb.speaking ?? 0);
    }
    if (aTotal === 0 && a.chapterIds.length > 0) {
      for (const cid of a.chapterIds) {
        aTotal += input.chapterProblemTotals?.[cid] ?? 10;
      }
    }
    for (const cid of a.chapterIds) {
      const cSolved = input.solvedByChapter?.[cid] ?? 0;
      aSolved += cSolved;
    }
    aSolved = aTotal > 0 ? Math.min(aSolved, aTotal) : aSolved;
    hwTotal += aTotal;
    hwCompleted += aSolved;

    const isIncomplete = aTotal > 0 && aSolved < aTotal;
    if (isIncomplete && a.dueAt < nowMs) {
      overdueCount += 1;
    }
    if (isIncomplete && (nearestDueAt === null || a.dueAt < nearestDueAt)) {
      nearestDueAt = a.dueAt;
      activeAssignmentTitle = a.title;
    }
  }
  if (!activeAssignmentTitle && myAssignments.length > 0) {
    activeAssignmentTitle = myAssignments[0].title;
    nearestDueAt = myAssignments[0].dueAt;
  }

  const completionRate =
    hwTotal > 0 ? Math.min(100, Math.round((hwCompleted / hwTotal) * 100)) : 100;

  // アラート判定
  const alerts: StudentAlertBadge[] = [];
  if (inactiveDays === 999) {
    alerts.push({
      reason: 'never_studied',
      severity: 'critical',
      label: '初回未学習（声掛け最優先）',
    });
  } else if (inactiveDays >= 3) {
    alerts.push({
      reason: 'inactive_3days',
      severity: 'critical',
      label: `${inactiveDays}日間未学習`,
    });
  }

  if (overdueCount > 0) {
    alerts.push({
      reason: 'homework_overdue',
      severity: 'critical',
      label: `宿題期限超過（${overdueCount}件）`,
    });
  } else if (hwTotal > 0 && completionRate < 50 && nearestDueAt !== null && nearestDueAt - nowMs <= 2 * 86400_000) {
    alerts.push({
      reason: 'homework_behind_pace',
      severity: 'warning',
      label: `宿題ペース遅れ（消化${completionRate}%）`,
    });
  }

  // 級×技能内訳の組み立て（今週秒数・累計秒数の降順）
  const allSkillKeys = new Set<string>([
    ...skillTotalSec.keys(),
    ...skillWeeklySec.keys(),
    ...skillAcc.keys(),
  ]);
  const gradeSkillBreakdown = [...allSkillKeys]
    .map((key) => {
      const parsed = parseGradeSkillKey(key);
      const weeklySeconds = skillWeeklySec.get(key) ?? 0;
      const totalSeconds = skillTotalSec.get(key) ?? 0;
      const acc = skillAcc.get(key) ?? { correct: 0, total: 0 };
      const accuracyPct =
        acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : null;
      return {
        key,
        grade: parsed.grade,
        skill: parsed.skill,
        label: parsed.label,
        weeklySeconds,
        totalSeconds,
        correct: acc.correct,
        totalQuestions: acc.total,
        accuracyPct,
      };
    })
    .sort((a, b) => b.weeklySeconds - a.weeklySeconds || b.totalSeconds - a.totalSeconds);

  // 直近14日カレンダー・棒グラフ用データ
  const recentDailyLogs = recent14Keys.map((dateKey) => {
    const doc = logMap.get(dateKey);
    const [, m, d] = dateKey.split('-');
    let dayCorrect = 0;
    let dayTotal = 0;
    for (const acc of Object.values(doc?.accuracyByGradeSkill || {})) {
      dayCorrect += Number(acc?.correct) || 0;
      dayTotal += Number(acc?.total) || 0;
    }
    return {
      dateKey,
      shortDate: `${Number(m)}/${Number(d)}`,
      totalActiveSeconds: Math.max(0, Math.floor(Number(doc?.totalActiveSeconds) || 0)),
      solvedCount: Math.max(0, Math.floor(Number(doc?.solvedCount) || 0)),
      byGradeSkill: doc?.byGradeSkill ?? {},
      accuracyPct: dayTotal > 0 ? Math.round((dayCorrect / dayTotal) * 100) : null,
    };
  });

  const rosterName =
    (input.member.rosterName || '').trim() ||
    (input.member.displayName || '').trim() ||
    '（実名未設定）';

  const pendingWritingCount = (input.writingSubmissions || []).filter(
    (w) => w.studentUid === input.member.uid && w.status === 'submitted',
  ).length;
  const pendingSpeakingCount = (input.speakingSubmissions || []).filter(
    (s) => s.studentUid === input.member.uid && s.status === 'submitted',
  ).length;

  return {
    uid: input.member.uid,
    rosterName,
    nickname: input.member.displayName,
    targetGrade: input.member.targetGrade ?? 'eiken_2',
    note: input.member.note,
    adFree: input.member.adFree !== false,
    weeklyActiveSeconds,
    todayActiveSeconds,
    totalActiveSeconds,
    weeklySolvedCount,
    homework: {
      completedProblems: hwCompleted,
      totalProblems: hwTotal,
      completionRate,
      overdueCount,
      activeAssignmentTitle,
      dueAt: nearestDueAt,
    },
    lastActiveAt,
    lastStudiedDateKey,
    inactiveDays,
    alerts,
    gradeSkillBreakdown,
    recentDailyLogs,
    pendingWritingCount,
    pendingSpeakingCount,
  };
}

/**
 * 塾生一覧の並び替え：
 * 「未学習・宿題遅延（criticalアラート → warningアラート）」の生徒を最上部にハイライト表示し、
 * 同順位内では未学習日数が長い順 → 宿題消化率が低い順 → 氏名五十音順で並べる。
 */
export function sortStudentsByAlertPriority(
  students: readonly SugorokuStudentOverview[],
): SugorokuStudentOverview[] {
  const rankOf = (s: SugorokuStudentOverview): number => {
    if (s.alerts.some((a) => a.severity === 'critical')) return 0;
    if (s.alerts.some((a) => a.severity === 'warning')) return 1;
    return 2;
  };
  return [...students].sort((a, b) => {
    const ra = rankOf(a);
    const rb = rankOf(b);
    if (ra !== rb) return ra - rb;
    if (ra < 2 && a.inactiveDays !== b.inactiveDays) {
      return b.inactiveDays - a.inactiveDays;
    }
    if (a.homework.completionRate !== b.homework.completionRate) {
      return a.homework.completionRate - b.homework.completionRate;
    }
    return a.rosterName.localeCompare(b.rosterName, 'ja');
  });
}

// ===================================================================
// 面談・保護者報告用 CSV 出力（BOM付きUTF-8 + CSVインジェクション対策済）
// ===================================================================

export const SUGOROKU_SUMMARY_CSV_HEADERS = [
  '生徒氏名（塾名簿）',
  '目標級',
  '注意アラート',
  '今週の有効学習時間(分)',
  '本日の有効学習時間(分)',
  '累計有効学習時間(分)',
  '今週の解答問数',
  '宿題消化率(%)',
  '宿題進捗(完了/総数)',
  '最終学習日',
  '主な学習内訳（級×技能 今週分）',
  '平均正答率(%)',
  '未添削(Writing/Speaking)',
] as const;

export function buildSugorokuSummaryCsv(
  students: readonly SugorokuStudentOverview[],
  withBom = true,
): string {
  const rows = students.map((s) => {
    const topSkills = s.gradeSkillBreakdown
      .filter((g) => g.weeklySeconds > 0 || g.totalSeconds > 0)
      .slice(0, 4)
      .map((g) => `${g.label}:${toMinutesRounded(g.weeklySeconds)}分`)
      .join(' / ');

    let totalCorrect = 0;
    let totalQ = 0;
    for (const g of s.gradeSkillBreakdown) {
      totalCorrect += g.correct;
      totalQ += g.totalQuestions;
    }
    const avgAcc = totalQ > 0 ? `${Math.round((totalCorrect / totalQ) * 100)}%` : '-';

    return [
      s.rosterName,
      getGradeLabel(s.targetGrade),
      s.alerts.length > 0 ? s.alerts.map((a) => a.label).join('・') : '順調',
      toMinutesRounded(s.weeklyActiveSeconds),
      toMinutesRounded(s.todayActiveSeconds),
      toMinutesRounded(s.totalActiveSeconds),
      s.weeklySolvedCount,
      `${s.homework.completionRate}%`,
      `${s.homework.completedProblems}/${s.homework.totalProblems}`,
      s.lastStudiedDateKey ?? '未学習',
      topSkills || '記録なし',
      avgAcc,
      `W:${s.pendingWritingCount} / S:${s.pendingSpeakingCount}`,
    ];
  });

  return buildCsvText(SUGOROKU_SUMMARY_CSV_HEADERS, rows, withBom);
}

export const SUGOROKU_STUDENT_DETAIL_CSV_HEADERS = [
  '生徒氏名',
  '目標級',
  '日付',
  '有効学習時間(分)',
  '解いた問題数',
  '正答率(%)',
  '級×技能別内訳',
] as const;

/** 個人別の面談・保護者共有用14日間詳細CSV */
export function buildSugorokuStudentDetailCsv(
  student: SugorokuStudentOverview,
  withBom = true,
): string {
  const rows = [...student.recentDailyLogs].reverse().map((day) => {
    const breakdownText = Object.entries(day.byGradeSkill)
      .filter(([, sec]) => sec > 0)
      .map(([k, sec]) => `${parseGradeSkillKey(k).label} ${toMinutesRounded(sec)}分`)
      .join(' / ');
    return [
      student.rosterName,
      getGradeLabel(student.targetGrade),
      day.dateKey,
      toMinutesRounded(day.totalActiveSeconds),
      day.solvedCount,
      day.accuracyPct !== null ? `${day.accuracyPct}%` : '-',
      breakdownText || '-',
    ];
  });
  return buildCsvText(SUGOROKU_STUDENT_DETAIL_CSV_HEADERS, rows, withBom);
}

/** URL / 環境変数から管理者ポータル直起動モードかどうかを判定する純粋関数 */
export function detectSugorokuPortalMode(
  search: string,
  envPortalValue?: string,
): boolean {
  if ((envPortalValue || '').trim().toLowerCase() === 'admin') return true;
  try {
    const params = new URLSearchParams(search || '');
    return params.get('portal')?.toLowerCase() === 'admin';
  } catch {
    return false;
  }
}
