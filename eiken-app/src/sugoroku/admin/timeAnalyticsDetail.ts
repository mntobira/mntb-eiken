/**
 * ===================================================================
 * すごろく塾：生徒別 学習時間の詳細可視化ロジック（純粋関数層）
 * ===================================================================
 * 1分以上の放置時間を自動除外した実学習ログ（SugorokuStudyLogDoc）と
 * 問題解答履歴から、以下の詳細指標を算出する：
 *   - 今日 / 今週(7日) / 直近30日 / 累計 の学習時間・学習日数・1日平均
 *   - 連続学習日数（ストリーク）
 *   - 直近30日間（または14日間）の日別・分野別スタック学習時間推移
 *   - 級×分野（Listening / Reading / 単語・語彙 / Writing / Speaking）別の
 *     時間割合(%)・今週/累計秒数・解答数・正答率
 *   - 全学習日のセッション明細（最終学習時刻・解いた問題数・分野内訳）
 */

import {
  buildRecentDateKeys,
  formatDateKey,
  formatDurationJa,
  getGradeLabel,
  parseGradeSkillKey,
  SKILL_ORDER,
  SKILL_SHORT_LABELS,
  toMinutesRounded,
  type SugorokuStudentOverview,
} from './adminAnalytics';
import { buildCsvText } from '../../utils/studySummaryCsv';
import type { GradeSkillKey, SugorokuSkillKey, SugorokuStudyLogDoc } from '../shared/types';

export interface StudentDailyTimePoint {
  dateKey: string;
  shortDate: string;
  weekdayJa: string;
  totalSeconds: number;
  solvedCount: number;
  accuracyPct: number | null;
  lastUpdatedTimeLabel: string | null;
  bySkillSeconds: Record<SugorokuSkillKey, number>;
  breakdownText: string;
}

export interface StudentSkillShareItem {
  skill: SugorokuSkillKey;
  label: string;
  weeklySeconds: number;
  monthlySeconds: number;
  totalSeconds: number;
  sharePct: number;
  correct: number;
  totalQuestions: number;
  accuracyPct: number | null;
}

export interface StudentDetailedTimeReport {
  uid: string;
  todaySeconds: number;
  weeklySeconds: number;
  monthlySeconds: number;
  totalSeconds: number;
  activeDays7: number;
  activeDays30: number;
  totalActiveDays: number;
  currentStreakDays: number;
  avgDailyMinutes7: number;
  avgSessionMinutes: number;
  weeklySolvedCount: number;
  monthlySolvedCount: number;
  totalSolvedFromLogs: number;
  daily30: StudentDailyTimePoint[];
  skillShares: StudentSkillShareItem[];
  sessionHistory: StudentDailyTimePoint[];
}

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'] as const;

function weekdayOfDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return WEEKDAYS_JA[dt.getDay()] ?? '';
}

function formatClockHm(ts: number | undefined): string | null {
  if (!ts || !Number.isFinite(ts) || ts <= 0) return null;
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function normalizeSkillKey(rawSkill: string): SugorokuSkillKey {
  if (
    rawSkill === 'listening' ||
    rawSkill === 'reading' ||
    rawSkill === 'vocab' ||
    rawSkill === 'writing' ||
    rawSkill === 'speaking'
  ) {
    return rawSkill;
  }
  return 'reading';
}

function buildDayPoint(dateKey: string, doc?: SugorokuStudyLogDoc): StudentDailyTimePoint {
  const [, m, d] = dateKey.split('-');
  const bySkillSeconds: Record<SugorokuSkillKey, number> = {
    listening: 0,
    reading: 0,
    vocab: 0,
    writing: 0,
    speaking: 0,
  };

  const rawByGradeSkill: Record<GradeSkillKey, number> = doc?.byGradeSkill ?? {};
  const parts: string[] = [];

  for (const [gsKey, rawSec] of Object.entries(rawByGradeSkill)) {
    const sec = Math.max(0, Math.floor(Number(rawSec) || 0));
    if (sec <= 0) continue;
    const parsed = parseGradeSkillKey(gsKey);
    const sk = normalizeSkillKey(String(parsed.skill));
    bySkillSeconds[sk] += sec;
    parts.push(`${parsed.label.replace(/^英検/, '')} ${formatDurationJa(sec)}`);
  }

  let dayCorrect = 0;
  let dayTotal = 0;
  for (const acc of Object.values(doc?.accuracyByGradeSkill || {})) {
    dayCorrect += Math.max(0, Number(acc?.correct) || 0);
    dayTotal += Math.max(0, Number(acc?.total) || 0);
  }

  const totalSeconds = Math.max(0, Math.floor(Number(doc?.totalActiveSeconds) || 0));
  const solvedCount = Math.max(0, Math.floor(Number(doc?.solvedCount) || 0));

  return {
    dateKey,
    shortDate: `${Number(m)}/${Number(d)}`,
    weekdayJa: weekdayOfDateKey(dateKey),
    totalSeconds,
    solvedCount,
    accuracyPct: dayTotal > 0 ? Math.round((dayCorrect / dayTotal) * 100) : null,
    lastUpdatedTimeLabel: formatClockHm(doc?.updatedAt),
    bySkillSeconds,
    breakdownText: parts.join(' / ') || (totalSeconds > 0 ? formatDurationJa(totalSeconds) : '学習記録なし'),
  };
}

/**
 * 生徒1人分の学習ログ配列（または SugorokuStudentOverview の14日ログ）から
 * 詳細な学習時間レポートを生成する。
 */
export function buildStudentDetailedTimeReport(params: {
  uid: string;
  logs?: readonly SugorokuStudyLogDoc[];
  overview?: SugorokuStudentOverview;
  nowMs?: number;
}): StudentDetailedTimeReport {
  const nowMs = params.nowMs ?? Date.now();
  const todayKey = formatDateKey(nowMs);
  const keys7 = new Set(buildRecentDateKeys(todayKey, 7));
  const keys30 = buildRecentDateKeys(todayKey, 30);
  const set30 = new Set(keys30);

  // overview しか渡されていない場合でも recentDailyLogs から復元可能にする
  const effectiveLogs: SugorokuStudyLogDoc[] =
    params.logs && params.logs.length > 0
      ? [...params.logs]
      : (params.overview?.recentDailyLogs ?? [])
          .filter((d) => d.totalActiveSeconds > 0 || d.solvedCount > 0)
          .map((d) => ({
            dateKey: d.dateKey,
            totalActiveSeconds: d.totalActiveSeconds,
            byGradeSkill: d.byGradeSkill,
            solvedCount: d.solvedCount,
            updatedAt: 0,
          }));

  const logMap = new Map<string, SugorokuStudyLogDoc>();
  for (const log of effectiveLogs) {
    if (log?.dateKey) {
      logMap.set(log.dateKey, log);
    }
  }

  let todaySeconds = 0;
  let weeklySeconds = 0;
  let monthlySeconds = 0;
  let totalSeconds = 0;
  let activeDays7 = 0;
  let activeDays30 = 0;
  let totalActiveDays = 0;
  let weeklySolvedCount = 0;
  let monthlySolvedCount = 0;
  let totalSolvedFromLogs = 0;

  const skillTotals: Record<
    SugorokuSkillKey,
    { weekly: number; monthly: number; total: number; correct: number; questions: number }
  > = {
    listening: { weekly: 0, monthly: 0, total: 0, correct: 0, questions: 0 },
    reading: { weekly: 0, monthly: 0, total: 0, correct: 0, questions: 0 },
    vocab: { weekly: 0, monthly: 0, total: 0, correct: 0, questions: 0 },
    writing: { weekly: 0, monthly: 0, total: 0, correct: 0, questions: 0 },
    speaking: { weekly: 0, monthly: 0, total: 0, correct: 0, questions: 0 },
  };

  for (const log of logMap.values()) {
    const sec = Math.max(0, Math.floor(Number(log.totalActiveSeconds) || 0));
    const solved = Math.max(0, Math.floor(Number(log.solvedCount) || 0));
    const in7 = keys7.has(log.dateKey);
    const in30 = set30.has(log.dateKey);

    totalSeconds += sec;
    totalSolvedFromLogs += solved;
    if (sec > 0) totalActiveDays += 1;

    if (log.dateKey === todayKey) {
      todaySeconds += sec;
    }
    if (in7) {
      weeklySeconds += sec;
      weeklySolvedCount += solved;
      if (sec > 0) activeDays7 += 1;
    }
    if (in30) {
      monthlySeconds += sec;
      monthlySolvedCount += solved;
      if (sec > 0) activeDays30 += 1;
    }

    for (const [gsKey, rawVal] of Object.entries(log.byGradeSkill || {})) {
      const v = Math.max(0, Math.floor(Number(rawVal) || 0));
      if (!v) continue;
      const sk = normalizeSkillKey(String(parseGradeSkillKey(gsKey).skill));
      skillTotals[sk].total += v;
      if (in7) skillTotals[sk].weekly += v;
      if (in30) skillTotals[sk].monthly += v;
    }

    for (const [gsKey, acc] of Object.entries(log.accuracyByGradeSkill || {})) {
      if (!acc) continue;
      const sk = normalizeSkillKey(String(parseGradeSkillKey(gsKey).skill));
      skillTotals[sk].correct += Math.max(0, Number(acc.correct) || 0);
      skillTotals[sk].questions += Math.max(0, Number(acc.total) || 0);
    }
  }

  // overview 側に累計値があり logs が14日分のみの場合は overview の累計秒数も尊重
  if (params.overview && params.overview.totalActiveSeconds > totalSeconds) {
    totalSeconds = params.overview.totalActiveSeconds;
  }

  const daily30 = keys30.map((dateKey) => buildDayPoint(dateKey, logMap.get(dateKey)));

  // 連続学習日数（今日学習していれば今日から、今日まだ0分なら昨日から遡ってカウント）
  let currentStreakDays = 0;
  for (let i = daily30.length - 1; i >= 0; i -= 1) {
    const pt = daily30[i];
    if (i === daily30.length - 1 && pt.totalSeconds === 0) {
      continue;
    }
    if (pt.totalSeconds > 0) {
      currentStreakDays += 1;
    } else {
      break;
    }
  }

  const skillSumForShare = SKILL_ORDER.reduce((acc, sk) => acc + skillTotals[sk].total, 0);
  const skillShares: StudentSkillShareItem[] = SKILL_ORDER.map((sk) => {
    const row = skillTotals[sk];
    return {
      skill: sk,
      label: SKILL_SHORT_LABELS[sk],
      weeklySeconds: row.weekly,
      monthlySeconds: row.monthly,
      totalSeconds: row.total,
      sharePct: skillSumForShare > 0 ? Math.round((row.total / skillSumForShare) * 100) : 0,
      correct: row.correct,
      totalQuestions: row.questions,
      accuracyPct: row.questions > 0 ? Math.round((row.correct / row.questions) * 100) : null,
    };
  }).sort((a, b) => b.totalSeconds - a.totalSeconds || b.weeklySeconds - a.weeklySeconds);

  const sessionHistory = [...logMap.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((dk) => buildDayPoint(dk, logMap.get(dk)))
    .filter((d) => d.totalSeconds > 0 || d.solvedCount > 0);

  return {
    uid: params.uid,
    todaySeconds,
    weeklySeconds,
    monthlySeconds,
    totalSeconds,
    activeDays7,
    activeDays30,
    totalActiveDays,
    currentStreakDays,
    avgDailyMinutes7: Math.round(weeklySeconds / 7 / 60),
    avgSessionMinutes: totalActiveDays > 0 ? Math.round(totalSeconds / totalActiveDays / 60) : 0,
    weeklySolvedCount,
    monthlySolvedCount,
    totalSolvedFromLogs,
    daily30,
    skillShares,
    sessionHistory,
  };
}

/**
 * 30日間の詳細学習時間ログ CSV（保護者面談・指導記録用）
 */
export function buildStudentDetailedTimeCsv(params: {
  rosterName: string;
  targetGrade: string;
  report: StudentDetailedTimeReport;
  withBom?: boolean;
}): string {
  const headers = [
    '生徒氏名',
    '目標級',
    '日付',
    '曜日',
    '有効学習時間(分)',
    'リスニング(分)',
    'リーディング(分)',
    '単語・語彙(分)',
    'ライティング(分)',
    'スピーキング(分)',
    '解答問数',
    '正答率(%)',
    '最終学習時刻',
  ];

  const rows = [...params.report.daily30].reverse().map((d) => [
    params.rosterName,
    getGradeLabel(params.targetGrade),
    d.dateKey,
    d.weekdayJa,
    toMinutesRounded(d.totalSeconds),
    toMinutesRounded(d.bySkillSeconds.listening),
    toMinutesRounded(d.bySkillSeconds.reading),
    toMinutesRounded(d.bySkillSeconds.vocab),
    toMinutesRounded(d.bySkillSeconds.writing),
    toMinutesRounded(d.bySkillSeconds.speaking),
    d.solvedCount,
    d.accuracyPct !== null ? `${d.accuracyPct}%` : '-',
    d.lastUpdatedTimeLabel ?? '-',
  ]);

  return buildCsvText(headers, rows, params.withBom ?? true);
}
