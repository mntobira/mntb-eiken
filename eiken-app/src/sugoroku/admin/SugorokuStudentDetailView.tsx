/**
 * クラス管理ポータル：生徒別詳細（目標設定・個別課題管理＆反映状況・1対1チャット・学習時間分析の統合画面）
 *
 * ■ A2・A3 ご要望への対応
 * - 「誰に・どの目標を立てて・どの課題を出していて・生徒のどの画面に反映されているか」をこの1画面の上部に集約。
 * - 「＋ この生徒に課題を出す」で最初からその生徒を個別指定した課題モーダルが開き、
 *   出題中の課題の編集・削除・進捗確認もここで迷わず完結。
 * - 「チャットで話す」ボタンからLINE風の1対1トークルームを即座に開ける。
 */

import { useMemo, useState, type CSSProperties } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Flame,
  MessageCircle,
  Plus,
  Repeat,
  Save,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import { formatDue } from '../../utils/classAssignmentsCore';
import { KineticText, ScoreRing } from '../../motion';
import { CountUp } from '../../components/ui/CountUp';
import {
  BackButton,
  Card,
  PrimaryButton,
  SectionHeader,
} from '../../components/ui';
import type { AnswerReasonDoc } from '../../utils/classAssignmentsCore';
import type { ReviewItem } from '../../utils/reviewList';
import type { SolvedMap } from '../../utils/studySyncCore';
import type { SugorokuAssignmentDoc, SugorokuStudyLogDoc } from '../shared/types';
import { chapterTitleOf, chapterTotals } from '../homework/chapterTotals';
import {
  buildStudentChapterActivities,
  formatShortTimestampJa,
} from './studentProblemActivity';
import {
  buildSugorokuStudentDetailCsv,
  formatDateKey,
  formatDurationJa,
  getGradeLabel,
  parseGradeSkillKey,
  toMinutesRounded,
  type SugorokuStudentOverview,
} from './adminAnalytics';
import {
  buildStudentDetailedTimeCsv,
  buildStudentDetailedTimeReport,
} from './timeAnalyticsDetail';
import {
  SkillColorOf,
  SkillRatioStackBar,
  StudyDoorsWeek,
  SugorokuBottomSheet,
  type ToastTone,
} from './SugorokuInteractiveUi';

interface SugorokuStudentDetailViewProps {
  student: SugorokuStudentOverview;
  /** 生の日次ログ配列（渡された場合は30日推移・全履歴・最終学習時刻まで完全表示） */
  rawLogs?: readonly SugorokuStudyLogDoc[];
  /** クラスの全課題一覧（この生徒が対象の課題を抽出して表示） */
  assignments?: readonly SugorokuAssignmentDoc[];
  /** この生徒の既習単元マップ（単元別の消化問数算出用） */
  solvedByChapter?: Record<string, number>;
  /** 設問単位の解答時刻マップ（`章ID::問題ID -> ms`） */
  rawSolvedMap?: SolvedMap;
  /** 誤答・復習リスト（どの番号を何回間違えたか） */
  reviewItems?: readonly ReviewItem[];
  /** 生徒が送った「選んだ理由・一括振り返り」 */
  answerReasons?: readonly AnswerReasonDoc[];
  /** クラス既定の1日目標分・週目標日 */
  classGoalSummary?: { dailyGoalMinutes: number; weeklyGoalDays: number };
  /** 未読チャットメッセージ数 */
  unreadChatCount?: number;
  isDemoMode: boolean;
  onBack: () => void;
  onSaveProfile: (params: {
    studentUid: string;
    rosterName: string;
    targetGrade: EikenGrade;
    note: string;
  }) => Promise<void> | void;
  onCreateHomeworkForStudent?: () => void;
  onEditAssignment?: (assignment: SugorokuAssignmentDoc) => void;
  onDeleteAssignment?: (assignment: SugorokuAssignmentDoc) => void;
  onOpenChat?: () => void;
  onOpenWritingTab?: () => void;
  onOpenSpeakingTab?: () => void;
  onToast?: (message: string, tone?: ToastTone) => void;
}

export function buildLineEncourageMessage(student: SugorokuStudentOverview): string {
  const grade = getGradeLabel(student.targetGrade);
  const weekMin = Math.round(student.weeklyActiveSeconds / 60);
  if (student.inactiveDays >= 3) {
    return `${student.rosterName.split('（')[0]}さん、部活お疲れさま！今週の${grade}対策、まずはリスニング第1部か単語10問（約5分）だけ今日開いてみよう！`;
  }
  return `${student.rosterName.split('（')[0]}さん、今週${weekMin}分も${grade}の演習を進められていて素晴らしいペースです！宿題消化も${student.homework.completionRate}%まで来ているので、この調子で進めよう！`;
}

function countSolvedInChapter(
  solvedMap: Record<string, number> | undefined,
  chapterId: string,
  maxTotal: number,
): number {
  if (!solvedMap) return 0;
  if (typeof solvedMap[chapterId] === 'number') {
    return Math.min(maxTotal, Math.max(0, solvedMap[chapterId]));
  }
  const prefix = `${chapterId}::`;
  let count = 0;
  for (const key of Object.keys(solvedMap)) {
    if (key.startsWith(prefix)) count += 1;
  }
  return maxTotal > 0 ? Math.min(maxTotal, count) : count;
}

export function SugorokuStudentDetailView({
  student,
  rawLogs,
  assignments = [],
  solvedByChapter,
  rawSolvedMap,
  reviewItems,
  answerReasons,
  classGoalSummary,
  unreadChatCount = 0,
  isDemoMode,
  onBack,
  onSaveProfile,
  onCreateHomeworkForStudent,
  onEditAssignment,
  onDeleteAssignment,
  onOpenChat,
  onOpenWritingTab,
  onOpenSpeakingTab,
  onToast,
}: SugorokuStudentDetailViewProps) {
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [rosterName, setRosterName] = useState(student.rosterName);
  const [targetGrade, setTargetGrade] = useState<EikenGrade>(student.targetGrade);
  const [note, setNote] = useState(student.note || '');
  const [saving, setSaving] = useState(false);
  const [rangeDays, setRangeDays] = useState<14 | 30>(14);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [showAllChapters, setShowAllChapters] = useState(false);

  const totalsMap = useMemo(() => chapterTotals(), []);

  const chapterActivities = useMemo(
    () =>
      buildStudentChapterActivities({
        uid: student.uid,
        rawSolved: rawSolvedMap,
        chapterCountsFallback: solvedByChapter,
        reviewItems,
        answerReasons,
      }),
    [student.uid, rawSolvedMap, solvedByChapter, reviewItems, answerReasons],
  );

  // この生徒に配信されている課題一覧（個別指定 または クラス全員向け）
  const studentAssignments = useMemo(() => {
    return assignments
      .filter((a) => {
        if (!a.targetStudentUids || a.targetStudentUids.length === 0) return true;
        return a.targetStudentUids.includes(student.uid);
      })
      .sort((a, b) => a.dueAt - b.dueAt);
  }, [assignments, student.uid]);

  const timeReport = useMemo(
    () =>
      buildStudentDetailedTimeReport({
        uid: student.uid,
        logs: rawLogs,
        overview: student,
      }),
    [student, rawLogs],
  );

  const todayKey = formatDateKey(Date.now());

  const chartDays = useMemo(
    () => (rangeDays === 30 ? timeReport.daily30 : timeReport.daily30.slice(-14)),
    [rangeDays, timeReport.daily30],
  );

  const maxDailySeconds = Math.max(
    1800,
    ...chartDays.map((d) => d.totalSeconds),
  );

  const todayMinutes = Math.round(student.todayActiveSeconds / 60);
  const weeklyMinutes = Math.round(student.weeklyActiveSeconds / 60);
  const monthlyMinutes = Math.round(timeReport.monthlySeconds / 60);
  const totalMinutes = Math.round(timeReport.totalSeconds / 60);

  let totalCorrect = 0;
  let totalQuestions = 0;
  for (const g of student.gradeSkillBreakdown) {
    totalCorrect += g.correct;
    totalQuestions += g.totalQuestions;
  }
  const overallAccuracy =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;

  const selectedDayDetail = useMemo(
    () => chartDays.find((d) => d.dateKey === selectedDateKey) ?? null,
    [chartDays, selectedDateKey],
  );

  const visibleSessions = showAllSessions
    ? timeReport.sessionHistory.slice(0, 30)
    : timeReport.sessionHistory.slice(0, 10);

  const openGoalEditor = () => {
    setRosterName(student.rosterName);
    setTargetGrade(student.targetGrade);
    setNote(student.note || '');
    setEditSheetOpen(true);
  };

  const handleExportStudentCsv = () => {
    const csv =
      rawLogs && rawLogs.length > 0
        ? buildStudentDetailedTimeCsv({
            rosterName: student.rosterName,
            targetGrade: student.targetGrade,
            report: timeReport,
            withBom: true,
          })
        : buildSugorokuStudentDetailCsv(student, true);
    const safeName = student.rosterName.replace(/[\\/:*?"<>|\s]+/g, '_');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `学習時間詳細レポート_${safeName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onToast?.('学習時間詳細CSVを保存しました', 'done');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveProfile({
        studentUid: student.uid,
        rosterName: rosterName.trim() || student.rosterName,
        targetGrade,
        note,
      });
      setEditSheetOpen(false);
      onToast?.('目標級・指導方針を保存しました', 'done');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label={student.rosterName}
      className="sg-stagger sg-detail-shell"
    >
      {/* 1. 生徒プロフィール＆6項目1列KPIリボン（重複していた旧上部ツールバーを撤去し1画面に集約） */}
      <Card className="sg-detail-hero-card">
        <div className="sg-toolbar" style={{ alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: '1 1 320px', minWidth: 0 }}>
            <div className="sg-detail-mobile-back">
              <BackButton label="一覧" onClick={onBack} />
            </div>

            <h2 className="mt-h1" style={{ margin: 0, fontSize: 19 }}>
              <KineticText text={student.rosterName} variant="rise" />
            </h2>

            <span className="sg-grade-tag">
              目標：{getGradeLabel(student.targetGrade)}
            </span>

            {classGoalSummary && (
              <span className="sg-grade-tag" style={{ background: 'var(--mt-bg-sunken)', color: 'var(--mt-ink-2)' }}>
                1日{classGoalSummary.dailyGoalMinutes}分×週{classGoalSummary.weeklyGoalDays}日
              </span>
            )}

            {timeReport.currentStreakDays > 0 && (
              <span className="sg-grade-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#FFF7ED', color: '#C2410C' }}>
                <Flame size={12} aria-hidden="true" />
                {timeReport.currentStreakDays}日連続
              </span>
            )}

            {student.alerts[0] && (
              <span
                className="sg-alert-text"
                data-warn={student.alerts[0].severity !== 'critical' ? 'true' : undefined}
              >
                {student.alerts[0].label}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <StudyDoorsWeek recentDailyLogs={student.recentDailyLogs} />

            {onOpenChat && unreadChatCount > 0 && (
              <button
                type="button"
                className="sg-chip"
                onClick={onOpenChat}
                style={{ background: '#06C755', borderColor: '#06C755', color: '#fff' }}
              >
                <MessageCircle size={13} aria-hidden="true" />
                未読 {unreadChatCount}
              </button>
            )}

            <button
              type="button"
              className="sg-chip"
              onClick={openGoalEditor}
              title="表示名・目標級・指導方針メモを設定"
            >
              <Target size={13} aria-hidden="true" />
              目標・メモ
            </button>

            <button
              type="button"
              className="sg-chip"
              onClick={handleExportStudentCsv}
              title="この生徒の学習時間詳細CSVを保存"
            >
              <Download size={13} aria-hidden="true" />
              CSV
            </button>
          </div>
        </div>

        {/* 個別目標・指導メモ（1行コンパクト帯） */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            borderRadius: 10,
            background: 'var(--mt-bg-sunken)',
            fontSize: 12,
            color: 'var(--mt-ink-2)',
          }}
        >
          <Target size={13} style={{ color: 'var(--mt-brand)', flexShrink: 0 }} aria-hidden="true" />
          <span style={{ flex: 1, minWidth: 180 }}>
            <b>指導メモ：</b>
            {student.note ? student.note : '未設定（「目標・メモ」から受験時期や学習方針を記録できます）'}
          </span>
          <button
            type="button"
            onClick={openGoalEditor}
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--mt-brand)',
              fontWeight: 800,
              fontSize: 11.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 4px',
            }}
          >
            <Edit3 size={11} aria-hidden="true" />
            編集
          </button>
        </div>

        {/* 6項目1列コンパクトKPIリボン（本日・今週・30日・累計・宿題消化・正答率） */}
        <div data-testid="student-time-kpi-grid" className="sg-kpi-ribbon-6">
          <div className="sg-kpi-cell">
            <div className="sg-stat-body">
              <span className="sg-stat-label">本日の学習時間</span>
              <span className="sg-stat-val">
                <CountUp value={todayMinutes} fromZero duration={500} />
                <span className="sg-stat-unit">分</span>
              </span>
              <span className="sg-kpi-sub">{formatDurationJa(student.todayActiveSeconds)}</span>
            </div>
          </div>

          <div className="sg-kpi-cell">
            <div className="sg-stat-body">
              <span className="sg-stat-label">今週（直近7日）</span>
              <span className="sg-stat-val">
                <CountUp value={weeklyMinutes} fromZero duration={600} />
                <span className="sg-stat-unit">分</span>
              </span>
              <span className="sg-kpi-sub">平均 {timeReport.avgDailyMinutes7}分/日</span>
            </div>
          </div>

          <div className="sg-kpi-cell">
            <div className="sg-stat-body">
              <span className="sg-stat-label">直近30日間</span>
              <span className="sg-stat-val">
                <CountUp value={monthlyMinutes} fromZero duration={650} />
                <span className="sg-stat-unit">分</span>
              </span>
              <span className="sg-kpi-sub">{timeReport.activeDays30}日稼働</span>
            </div>
          </div>

          <div className="sg-kpi-cell">
            <div className="sg-stat-body">
              <span className="sg-stat-label">累計有効学習時間</span>
              <span className="sg-stat-val">
                <CountUp value={totalMinutes} fromZero duration={700} />
                <span className="sg-stat-unit">分</span>
              </span>
              <span className="sg-kpi-sub">計 {timeReport.totalActiveDays}日</span>
            </div>
          </div>

          <div className="sg-kpi-cell">
            <div className="sg-stat-body">
              <span className="sg-stat-label">宿題消化</span>
              <span className="sg-stat-val">
                <CountUp value={student.homework.completionRate} fromZero duration={650} />
                <span className="sg-stat-unit">%</span>
              </span>
              <span className="sg-kpi-sub">
                {student.homework.completedProblems}/{student.homework.totalProblems}問
              </span>
            </div>
            <ScoreRing
              rate={student.homework.completionRate / 100}
              size={30}
              stroke={4}
              tone={student.homework.overdueCount > 0 ? 'warn' : 'brand'}
            />
          </div>

          <div className="sg-kpi-cell">
            <div className="sg-stat-body">
              <span className="sg-stat-label">正答率・解答</span>
              <span className="sg-stat-val">
                {overallAccuracy !== null ? (
                  <>
                    <CountUp value={overallAccuracy} fromZero duration={700} />
                    <span className="sg-stat-unit">%</span>
                  </>
                ) : (
                  '—'
                )}
              </span>
              <span className="sg-kpi-sub">今週 {student.weeklySolvedCount}問</span>
            </div>
            {overallAccuracy !== null && (
              <ScoreRing
                rate={overallAccuracy / 100}
                size={30}
                stroke={4}
                tone="brand"
              />
            )}
          </div>
        </div>

        {(student.pendingWritingCount > 0 || student.pendingSpeakingCount > 0) && (
          <div className="sg-chip-group">
            {student.pendingWritingCount > 0 && (
              <button type="button" className="sg-chip" onClick={onOpenWritingTab}>
                英作文 未確認 {student.pendingWritingCount}件を確認
              </button>
            )}
            {student.pendingSpeakingCount > 0 && (
              <button type="button" className="sg-chip" onClick={onOpenSpeakingTab}>
                スピーキング 未確認 {student.pendingSpeakingCount}件を確認
              </button>
            )}
          </div>
        )}
      </Card>

      {/* 2×2 ベントーグリッド：スクロール感なく1画面で「課題・正誤メモ・推移＆配分・日別明細」を俯瞰 */}
      <div className="sg-detail-bento" data-testid="student-detail-bento-grid">
        {/* ベントー左上：この生徒に出している課題・宿題の反映状況 */}
        <Card
          className="sg-bento-card"
          data-testid="student-individual-homework-section"
        >
          <div className="sg-toolbar">
            <SectionHeader
              title={`出している課題（${studentAssignments.length}件）`}
              aside="タイトル・ホーム・クラスに自動反映"
            />

            {onCreateHomeworkForStudent && (
              <PrimaryButton
                onClick={onCreateHomeworkForStudent}
                icon={<Plus size={14} aria-hidden="true" />}
              >
                この生徒に課題を出す
              </PrimaryButton>
            )}
          </div>

          {studentAssignments.length === 0 ? (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'var(--mt-bg-sunken)',
                fontSize: 12.5,
                color: 'var(--mt-ink-2)',
              }}
            >
              現在この生徒に出している課題はありません。右上の「＋ 課題を出す」から級・ペースに合わせた単元を配信できます。
            </div>
          ) : (
            <div className="sg-bento-scroll">
              {studentAssignments.map((asg) => {
                const isIndividual =
                  Array.isArray(asg.targetStudentUids) && asg.targetStudentUids.length > 0;
                let solvedSum = 0;
                let totalSum = 0;
                for (const cid of asg.chapterIds) {
                  const chTotal = totalsMap[cid] || 0;
                  totalSum += chTotal;
                  solvedSum += countSolvedInChapter(solvedByChapter, cid, chTotal);
                }
                const pct =
                  totalSum > 0
                    ? Math.min(100, Math.round((solvedSum / totalSum) * 100))
                    : student.homework.completionRate;
                const dueLabel = formatDue(asg.dueAt);
                const isOverdue = asg.dueAt < Date.now() && pct < 100;

                return (
                  <div
                    key={asg.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid var(--mt-line)',
                      background: 'var(--mt-bg-card)',
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    <div className="sg-toolbar" style={{ alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1 }}>
                        <div className="sg-row-head" style={{ flexWrap: 'wrap', gap: 5 }}>
                          <span
                            className="sg-grade-tag"
                            style={{
                              background: isIndividual ? '#E6F4EC' : '#EDF4FF',
                              color: isIndividual ? '#166534' : '#1E40AF',
                              fontSize: 10.5,
                            }}
                          >
                            {isIndividual ? '個別課題' : '全員課題'}
                          </span>
                          <span
                            className="sg-grade-tag"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              background: '#F0FDF4',
                              color: '#15803D',
                              fontSize: 10.5,
                            }}
                          >
                            <CheckCircle2 size={10} aria-hidden="true" />
                            反映中
                          </span>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: isOverdue ? '#B91C1C' : 'var(--mt-ink-3)',
                            }}
                          >
                            締切：{dueLabel}
                          </span>
                        </div>

                        <strong style={{ fontSize: 13.5, color: 'var(--mt-ink-warm)' }}>
                          {asg.title}
                        </strong>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11.5, color: 'var(--mt-ink-2)' }}>
                          <span>
                            進捗：<b>{pct}%</b>{totalSum > 0 ? `（${solvedSum}/${totalSum}問）` : ''}
                          </span>
                          {asg.dailyQuotaProblems && (
                            <span>· 1日{asg.dailyQuotaProblems}問</span>
                          )}
                          {asg.targetLaps && asg.targetLaps >= 2 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              · <Repeat size={11} /> {asg.targetLaps}周
                            </span>
                          )}
                          {asg.targetStudentUids && asg.targetStudentUids.length > 1 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              · <Users size={11} /> {asg.targetStudentUids.length}名
                            </span>
                          )}
                        </div>

                        {asg.coachInstruction && (
                          <p style={{ margin: 0, fontSize: 11.5, color: '#2458A6', fontWeight: 700 }}>
                            メモ：{asg.coachInstruction}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 4 }}>
                        {onEditAssignment && (
                          <button
                            type="button"
                            className="sg-chip"
                            onClick={() => onEditAssignment(asg)}
                            style={{ minHeight: 30, padding: '0 8px', fontSize: 11.5 }}
                          >
                            <Edit3 size={12} aria-hidden="true" />
                            編集
                          </button>
                        )}
                        {onDeleteAssignment && (
                          <button
                            type="button"
                            className="sg-chip"
                            onClick={() => onDeleteAssignment(asg)}
                            style={{ minHeight: 30, padding: '0 8px', fontSize: 11.5 }}
                          >
                            <Trash2 size={12} aria-hidden="true" />
                            削除
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-meter mt-progress">
                      <i
                        style={{
                          width: `${Math.max(pct > 0 ? 4 : 0, pct)}%`,
                          backgroundColor: pct >= 100 ? '#16A34A' : 'var(--mt-brand)',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {asg.chapterIds.map((cid) => (
                        <span
                          key={cid}
                          style={{
                            padding: '2px 7px',
                            borderRadius: 7,
                            background: 'var(--mt-bg-sunken)',
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: 'var(--mt-ink-2)',
                          }}
                        >
                          {chapterTitleOf(cid)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ベントー右上：解いた単元・設問番号の正誤 ＆ 一括提出メモ */}
        <Card
          className="sg-bento-card"
          data-testid="student-problem-activity-section"
        >
          <div className="sg-toolbar">
            <SectionHeader
              title={`解いた単元・設問正誤（${chapterActivities.length}単元）`}
              aside="問1・問2ごとの○×と一括提出メモ"
            />
            {chapterActivities.length > 4 && (
              <button
                type="button"
                className="sg-chip"
                onClick={() => setShowAllChapters((v) => !v)}
                style={{ minHeight: 30, padding: '0 10px', fontSize: 11.5 }}
              >
                {showAllChapters ? '直近4単元' : `全${chapterActivities.length}単元`}
              </button>
            )}
          </div>

          {chapterActivities.length === 0 ? (
            <p className="slog-empty" style={{ padding: '10px 12px', margin: 0, borderRadius: 12, background: 'var(--mt-bg-sunken)', fontSize: 12.5 }}>
              まだ解答済みの単元・一括提出データがありません。生徒が問題を解くか結果画面で「先生へ結果を一括提出」を押すとここに並びます。
            </p>
          ) : (
            <div className="sg-bento-scroll">
              {(showAllChapters ? chapterActivities : chapterActivities.slice(0, 4)).map((ch) => {
                const pct =
                  ch.totalProblems > 0
                    ? Math.min(100, Math.round((ch.solvedCount / ch.totalProblems) * 100))
                    : 100;
                const timeStr = formatShortTimestampJa(ch.latestAtMs);
                return (
                  <div key={ch.chapterId} className="sg-prob-chapter-card" style={{ padding: '9px 11px', gap: 6 }}>
                    <div className="sg-toolbar" style={{ alignItems: 'center' }}>
                      <div className="sg-row-head" style={{ gap: 5 }}>
                        <span className="sg-grade-tag" style={{ fontSize: 10.5 }}>{ch.gradeShortLabel}</span>
                        <strong style={{ fontSize: 13.5, color: 'var(--mt-ink-warm)' }}>
                          {ch.chapterTitle}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                        <span style={{ fontWeight: 800, color: 'var(--mt-ink-warm)' }}>
                          {ch.solvedCount}/{ch.totalProblems}問（{pct}%）
                        </span>
                        {ch.wrongQuestionCount > 0 && (
                          <span style={{ fontWeight: 800, color: '#B91C1C' }}>
                            要復習 {ch.wrongQuestionCount}問
                          </span>
                        )}
                        {timeStr && (
                          <span style={{ color: 'var(--mt-ink-3)', fontWeight: 600 }}>
                            {timeStr}
                          </span>
                        )}
                      </div>
                    </div>

                    {ch.questions.length > 0 && (
                      <div className="sg-prob-qchips" aria-label={`${ch.chapterTitle}の設問別正誤`}>
                        {ch.questions.map((q) => (
                          <span
                            key={q.questionKey}
                            className="sg-prob-qchip"
                            data-status={q.status}
                            title={
                              q.wrongCount > 0
                                ? `${q.label}: 誤答${q.wrongCount}回 / 正解${q.correctCount}回`
                                : `${q.label}: クリア済み`
                            }
                          >
                            <span>{q.label}</span>
                            <b>
                              {q.status === 'wrong'
                                ? `×${q.wrongCount >= 2 ? `(${q.wrongCount})` : ''}`
                                : q.status === 'reviewed_ok'
                                ? '△→○'
                                : '○'}
                            </b>
                          </span>
                        ))}
                      </div>
                    )}

                    {ch.reasons.length > 0 && (
                      <div className="sg-grid-4">
                        {ch.reasons.map((r, idx) => (
                          <div key={`${r.questionId}_${idx}`} className="sg-reason-note-box">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
                              <strong style={{ color: r.correct === false ? '#991B1B' : '#155E54' }}>
                                {r.reason.startsWith('【一括提出】')
                                  ? '一括提出サマリー'
                                  : `${r.qNo ? `問${r.qNo}` : r.questionId} の振り返り`}
                                {typeof r.correct === 'boolean' ? (r.correct ? '（○）' : '（×）') : ''}
                              </strong>
                              <span style={{ color: 'var(--mt-ink-3)' }}>
                                {formatShortTimestampJa(
                                  typeof r.updatedAt === 'number' ? r.updatedAt : 0,
                                )}
                              </span>
                            </div>
                            <div>{r.reason}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ベントー左下：学習時間推移（14日/30日）＋ 分野別の時間配分を1カードに統合 */}
        <Card className="sg-bento-card">
          <div className="sg-toolbar">
            <SectionHeader
              title={rangeDays === 30 ? '直近30日推移 ＆ 分野別の学習時間・時間配分' : '直近14日推移 ＆ 分野別の学習時間・時間配分'}
              aside="棒タップで内訳表示"
            />
            <div className="sg-mode-pill" role="group" aria-label="表示期間">
              <button
                type="button"
                aria-pressed={rangeDays === 14}
                onClick={() => setRangeDays(14)}
              >
                14日
              </button>
              <button
                type="button"
                aria-pressed={rangeDays === 30}
                onClick={() => setRangeDays(30)}
              >
                30日
              </button>
            </div>
          </div>

          <div
            className="sg-daily-bars"
            role="img"
            aria-label={`直近${rangeDays}日の学習時間`}
            style={
              rangeDays === 30
                ? {
                    gridTemplateColumns: 'repeat(15, minmax(0, 1fr))',
                    rowGap: 8,
                  }
                : undefined
            }
          >
            {chartDays.map((day, idx) => {
              const mins = Math.round(day.totalSeconds / 60);
              const heightPct =
                day.totalSeconds > 0
                  ? Math.max(8, Math.round((day.totalSeconds / maxDailySeconds) * 100))
                  : 0;
              const isToday = day.dateKey === todayKey;
              const isSelected = day.dateKey === selectedDateKey;
              return (
                <button
                  type="button"
                  key={day.dateKey}
                  className="sg-day-col"
                  data-today={isToday ? 'true' : undefined}
                  onClick={() =>
                    setSelectedDateKey((cur) => (cur === day.dateKey ? null : day.dateKey))
                  }
                  title={`${day.dateKey} (${day.weekdayJa}): ${formatDurationJa(day.totalSeconds)} / ${day.solvedCount}問`}
                  style={{
                    border: 0,
                    background: isSelected ? 'var(--mt-bg-sunken)' : 'transparent',
                    padding: '2px 1px',
                    borderRadius: 7,
                  }}
                >
                  <span className="sg-day-min" style={{ fontSize: 11 }}>{mins > 0 ? mins : '·'}</span>
                  <div className="sg-day-track">
                    {heightPct > 0 && (
                      <div
                        className="sg-day-fill"
                        style={
                          {
                            height: `${heightPct}%`,
                            ['--sg-d' as string]: idx % 15,
                          } as CSSProperties
                        }
                      />
                    )}
                  </div>
                  <span className="sg-day-date" style={{ fontSize: 10.5 }}>{day.shortDate}</span>
                </button>
              );
            })}
          </div>

          {selectedDayDetail && (
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 10,
                background: 'var(--mt-bg-sunken)',
                border: '1px solid var(--mt-line)',
                fontSize: 12,
                display: 'grid',
                gap: 2,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                <span>
                  {selectedDayDetail.dateKey}（{selectedDayDetail.weekdayJa}）
                </span>
                <span>
                  {formatDurationJa(selectedDayDetail.totalSeconds)} · {selectedDayDetail.solvedCount}問
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--mt-ink-2)' }}>
                {selectedDayDetail.breakdownText}
              </div>
            </div>
          )}

          {student.gradeSkillBreakdown.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--mt-ink-3)', paddingTop: 2 }}>
              分野別内訳：学習が記録されると語彙・読解・リスニング等の比率が表示されます
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6, paddingTop: 4, borderTop: '1px dashed var(--mt-line)' }}>
              <SkillRatioStackBar
                items={student.gradeSkillBreakdown.map((g) => ({
                  key: g.key,
                  skill: g.skill,
                  label: g.label,
                  seconds: g.weeklySeconds > 0 ? g.weeklySeconds : g.totalSeconds,
                }))}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {timeReport.skillShares
                  .filter((s) => s.totalSeconds > 0)
                  .map((s) => (
                    <span
                      key={s.skill}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'var(--mt-bg-sunken)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--mt-ink-warm)',
                      }}
                    >
                      <i
                        aria-hidden="true"
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          backgroundColor: SkillColorOf(s.skill),
                        }}
                      />
                      <span>{s.label}</span>
                      <span style={{ color: 'var(--mt-brand)' }}>{s.sharePct}%</span>
                      <span style={{ fontWeight: 600, color: 'var(--mt-ink-3)' }}>
                        ({formatDurationJa(s.totalSeconds)})
                      </span>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </Card>

        {/* ベントー右下：日別の学習ログ明細 */}
        <Card className="sg-bento-card">
          <div className="sg-toolbar">
            <SectionHeader
              title="日別の学習ログ明細"
              aside={`記録 ${timeReport.sessionHistory.length}日分（最終: ${student.lastStudiedDateKey ?? '未学習'}）`}
            />
            {timeReport.sessionHistory.length > 10 && (
              <button
                type="button"
                className="sg-chip"
                onClick={() => setShowAllSessions((v) => !v)}
                style={{ minHeight: 30, padding: '0 10px', fontSize: 11.5 }}
              >
                <Calendar size={12} aria-hidden="true" />
                {showAllSessions ? '直近10件' : `全${Math.min(30, timeReport.sessionHistory.length)}件`}
              </button>
            )}
          </div>

          {visibleSessions.length === 0 ? (
            <p className="slog-empty" style={{ padding: '10px 12px', margin: 0, borderRadius: 12, background: 'var(--mt-bg-sunken)', fontSize: 12.5 }}>
              まだ学習時間のログが記録されていません。生徒が演習・リスニングを行うと1分超の放置時間を除外した実学習時間が記録されます。
            </p>
          ) : (
            <div className="sg-bento-scroll">
              {visibleSessions.map((day) => {
                const rawDay = student.recentDailyLogs.find((r) => r.dateKey === day.dateKey);
                const entries = rawDay
                  ? Object.entries(rawDay.byGradeSkill).filter(([, s]) => s > 0)
                  : [];
                const detailStr =
                  entries.length > 0
                    ? entries
                        .map(
                          ([k, sec]) =>
                            `${parseGradeSkillKey(k).label.replace(/^英検/, '')} ${toMinutesRounded(sec)}分`,
                        )
                        .join(' / ')
                    : day.breakdownText;
                return (
                  <div key={day.dateKey} className="slog-row" style={{ padding: '7px 10px' }}>
                    <span>
                      <strong style={{ fontSize: 12.5 }}>
                        {day.dateKey}（{day.weekdayJa}）
                        {day.lastUpdatedTimeLabel ? ` ${day.lastUpdatedTimeLabel}` : ''}
                      </strong>
                      <small style={{ fontSize: 11.5 }}>
                        {detailStr}
                        {day.solvedCount > 0 ? ` · ${day.solvedCount}問` : ''}
                        {day.accuracyPct !== null ? `（${day.accuracyPct}%）` : ''}
                      </small>
                    </span>
                    <b style={{ fontSize: 12.5 }}>{formatDurationJa(day.totalSeconds)}</b>
                  </div>
                );
              })}
            </div>
          )}

          <p style={{ margin: 'auto 0 0', fontSize: 11, color: 'var(--mt-ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} aria-hidden="true" />
            <span>1分以上操作のない放置時間は自動除外しています</span>
          </p>
        </Card>
      </div>

      {/* Bottom Sheet：名簿名・目標級・個別目標メモ設定 */}
      <SugorokuBottomSheet
        open={editSheetOpen}
        title={`${student.rosterName.split('（')[0]}さんの目標・メモ設定`}
        onClose={() => setEditSheetOpen(false)}
      >
        <div className="slog-form">
          <label className="f">
            <span>表示名（先生の管理画面・チャット用）</span>
            <input
              type="text"
              value={rosterName}
              onChange={(e) => setRosterName(e.target.value)}
            />
          </label>

          <label className="f">
            <span>目標の英検級</span>
            <select
              value={targetGrade}
              onChange={(e) => setTargetGrade(e.target.value as EikenGrade)}
            >
              {[...EIKEN_GRADES].reverse().map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>

          <label className="f">
            <span>個別目標・受験予定・指導メモ（例：6月S-CBTで2級合格／平日15分リスニング優先）</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="生徒ごとの目標時期・部活スケジュール・重点分野などを記録"
            />
          </label>

          <PrimaryButton
            block
            disabled={saving}
            onClick={() => void handleSave()}
            icon={<Save size={15} aria-hidden="true" />}
          >
            {saving ? '保存中…' : isDemoMode ? '反映する' : '保存する'}
          </PrimaryButton>
        </div>
      </SugorokuBottomSheet>
    </section>
  );
}
