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
  SecondaryButton,
  SectionHeader,
} from '../../components/ui';
import type { SugorokuAssignmentDoc, SugorokuStudyLogDoc } from '../shared/types';
import { chapterTitleOf, chapterTotals } from '../homework/chapterTotals';
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

  const totalsMap = useMemo(() => chapterTotals(), []);

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

  const maxSkillSeconds = Math.max(
    900,
    ...student.gradeSkillBreakdown.map((g) => Math.max(g.weeklySeconds, g.totalSeconds)),
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
      className="sg-stagger"
      style={{ display: 'grid', gap: 14 }}
    >
      {/* 上部バー：戻る ＋ チャット ＋ 目標編集 ＋ CSV（役割が明確な3ボタンに整理） */}
      <div className="sg-toolbar">
        <BackButton label="生徒一覧へ戻る" onClick={onBack} />
        <div className="sg-chip-group">
          {onOpenChat && (
            <PrimaryButton
              onClick={onOpenChat}
              icon={<MessageCircle size={15} aria-hidden="true" />}
            >
              チャットで話す
              {unreadChatCount > 0 ? ` (${unreadChatCount})` : ''}
            </PrimaryButton>
          )}
          <SecondaryButton
            onClick={openGoalEditor}
            icon={<Target size={15} aria-hidden="true" />}
          >
            目標・メモ設定
          </SecondaryButton>
          <SecondaryButton
            onClick={handleExportStudentCsv}
            icon={<Download size={15} aria-hidden="true" />}
          >
            CSV保存
          </SecondaryButton>
        </div>
      </div>

      {/* 1. 生徒プロフィール＆個別目標カード */}
      <Card style={{ display: 'grid', gap: 14 }}>
        <div className="sg-toolbar" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="sg-row-head">
              <h2 className="mt-h1" style={{ margin: 0 }}>
                <KineticText text={student.rosterName} variant="rise" />
              </h2>
              <span className="sg-grade-tag">
                目標：{getGradeLabel(student.targetGrade)}
              </span>
              {classGoalSummary && (
                <span className="sg-grade-tag" style={{ background: 'var(--mt-bg-sunken)', color: 'var(--mt-ink-2)' }}>
                  目安：1日{classGoalSummary.dailyGoalMinutes}分 × 週{classGoalSummary.weeklyGoalDays}日
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

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 12,
                background: 'var(--mt-bg-sunken)',
                fontSize: 12.5,
                color: 'var(--mt-ink-2)',
              }}
            >
              <Target size={14} style={{ color: 'var(--mt-brand)', flexShrink: 0 }} aria-hidden="true" />
              <span style={{ flex: 1, minWidth: 180 }}>
                <b>個別目標・指導メモ：</b>
                {student.note ? student.note : '未設定（「目標・メモ設定」から受験時期や学習方針を記録できます）'}
              </span>
              <button
                type="button"
                className="sg-chip"
                onClick={openGoalEditor}
                style={{ fontSize: 11.5 }}
              >
                <Edit3 size={12} aria-hidden="true" />
                変更
              </button>
            </div>
          </div>

          <StudyDoorsWeek recentDailyLogs={student.recentDailyLogs} />
        </div>

        {/* 学習時間の4期間カード（本日・今週7日・直近30日・累計） */}
        <div
          data-testid="student-time-kpi-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 'var(--mt-radius-lg)',
            background: 'var(--mt-bg-sunken)',
          }}
        >
          <div className="sg-stat-body">
            <span className="sg-stat-label">本日の学習時間</span>
            <span className="sg-stat-val">
              <CountUp value={todayMinutes} fromZero duration={500} />
              <span className="sg-stat-unit">分</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--mt-ink-3)' }}>
              {formatDurationJa(student.todayActiveSeconds)}
            </span>
          </div>

          <div className="sg-stat-body">
            <span className="sg-stat-label">今週（直近7日）</span>
            <span className="sg-stat-val">
              <CountUp value={weeklyMinutes} fromZero duration={600} />
              <span className="sg-stat-unit">分</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--mt-ink-3)' }}>
              {formatDurationJa(student.weeklyActiveSeconds)}（平均 {timeReport.avgDailyMinutes7}分/日）
            </span>
          </div>

          <div className="sg-stat-body">
            <span className="sg-stat-label">直近30日間</span>
            <span className="sg-stat-val">
              <CountUp value={monthlyMinutes} fromZero duration={650} />
              <span className="sg-stat-unit">分</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--mt-ink-3)' }}>
              {formatDurationJa(timeReport.monthlySeconds)}（{timeReport.activeDays30}日稼働）
            </span>
          </div>

          <div className="sg-stat-body">
            <span className="sg-stat-label">累計有効学習時間</span>
            <span className="sg-stat-val">
              <CountUp value={totalMinutes} fromZero duration={700} />
              <span className="sg-stat-unit">分</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--mt-ink-3)' }}>
              {formatDurationJa(timeReport.totalSeconds)}（計 {timeReport.totalActiveDays}日）
            </span>
          </div>
        </div>

        {/* 学習ペース・宿題消化率・正答率サブストリップ */}
        <div className="sg-summary-strip" style={{ boxShadow: 'none', background: 'var(--mt-bg-card)' }}>
          <div className="sg-stat">
            <div className="sg-stat-body">
              <span className="sg-stat-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Flame size={13} aria-hidden="true" />
                連続学習 / 1回平均
              </span>
              <span className="sg-stat-val" style={{ fontSize: 18 }}>
                {timeReport.currentStreakDays}
                <span className="sg-stat-unit">日連続</span>
                <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, color: 'var(--mt-ink-2)' }}>
                  · 学習日平均 {timeReport.avgSessionMinutes}分
                </span>
              </span>
            </div>
          </div>

          <div className="sg-stat" style={{ justifyContent: 'space-between' }}>
            <div className="sg-stat-body">
              <span className="sg-stat-label">宿題消化率</span>
              <span className="sg-stat-val" style={{ fontSize: 18 }}>
                <CountUp value={student.homework.completionRate} fromZero duration={650} />
                <span className="sg-stat-unit">%</span>
                <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: 'var(--mt-ink-3)' }}>
                  ({student.homework.completedProblems}/{student.homework.totalProblems}問)
                </span>
              </span>
            </div>
            <ScoreRing
              rate={student.homework.completionRate / 100}
              size={34}
              stroke={5}
              tone={student.homework.overdueCount > 0 ? 'warn' : 'brand'}
            />
          </div>

          <div className="sg-stat" style={{ justifyContent: 'space-between' }}>
            <div className="sg-stat-body">
              <span className="sg-stat-label">正答率・今週解答</span>
              <span className="sg-stat-val" style={{ fontSize: 18 }}>
                {overallAccuracy !== null ? (
                  <>
                    <CountUp value={overallAccuracy} fromZero duration={700} />
                    <span className="sg-stat-unit">%</span>
                  </>
                ) : (
                  '—'
                )}
                <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: 'var(--mt-ink-3)' }}>
                  · 今週 {student.weeklySolvedCount}問
                </span>
              </span>
            </div>
            {overallAccuracy !== null && (
              <ScoreRing
                rate={overallAccuracy / 100}
                size={34}
                stroke={5}
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

      {/* 2. 【A2中核】この生徒に出している課題・宿題の反映状況 ＆ 個別出題 */}
      <Card
        style={{ display: 'grid', gap: 12 }}
        data-testid="student-individual-homework-section"
      >
        <div className="sg-toolbar">
          <div>
            <SectionHeader
              title={`${student.rosterName.split('（')[0]}さんに出している課題（${studentAssignments.length}件）`}
              aside="生徒のタイトル画面・ホーム最上部・設定＞クラスに自動反映"
            />
          </div>

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
              padding: '14px 16px',
              borderRadius: 14,
              background: 'var(--mt-bg-sunken)',
              fontSize: 13,
              color: 'var(--mt-ink-2)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <span>
              現在この生徒に出している課題はありません。右上の「＋ この生徒に課題を出す」から、この生徒の級・ペースに合わせた回数を配信できます。
            </span>
          </div>
        ) : (
          <div className="slog-rows">
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
                    padding: '12px 14px',
                    borderRadius: 14,
                    border: '1px solid var(--mt-line)',
                    background: 'var(--mt-bg-card)',
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div className="sg-toolbar" style={{ alignItems: 'flex-start' }}>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div className="sg-row-head" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <span
                          className="sg-grade-tag"
                          style={{
                            background: isIndividual ? '#E6F4EC' : '#EDF4FF',
                            color: isIndividual ? '#166534' : '#1E40AF',
                          }}
                        >
                          {isIndividual ? '個別課題' : 'クラス全員課題'}
                        </span>
                        <span
                          className="sg-grade-tag"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#F0FDF4',
                            color: '#15803D',
                          }}
                        >
                          <CheckCircle2 size={11} aria-hidden="true" />
                          生徒のタイトル・ホーム・クラス画面に反映中
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

                      <strong style={{ fontSize: 14.5, color: 'var(--mt-ink-warm)' }}>
                        {asg.title}
                      </strong>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--mt-ink-2)' }}>
                        <span>
                          進捗：<b>{pct}%</b>{totalSum > 0 ? `（${solvedSum}/${totalSum}問）` : ''}
                        </span>
                        {asg.dailyQuotaProblems && (
                          <span>· 1日目標 {asg.dailyQuotaProblems}問</span>
                        )}
                        {asg.targetLaps && asg.targetLaps >= 2 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            · <Repeat size={12} /> 目標 {asg.targetLaps}周
                          </span>
                        )}
                        {asg.targetStudentUids && asg.targetStudentUids.length > 1 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            · <Users size={12} /> {asg.targetStudentUids.length}名対象
                          </span>
                        )}
                      </div>

                      {asg.coachInstruction && (
                        <p style={{ margin: 0, fontSize: 12, color: '#2458A6', fontWeight: 700 }}>
                          指示メモ：{asg.coachInstruction}
                        </p>
                      )}
                    </div>

                    <div className="sg-chip-group">
                      {onEditAssignment && (
                        <SecondaryButton
                          onClick={() => onEditAssignment(asg)}
                          icon={<Edit3 size={13} aria-hidden="true" />}
                        >
                          編集
                        </SecondaryButton>
                      )}
                      {onDeleteAssignment && (
                        <SecondaryButton
                          onClick={() => onDeleteAssignment(asg)}
                          icon={<Trash2 size={13} aria-hidden="true" />}
                        >
                          削除
                        </SecondaryButton>
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

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {asg.chapterIds.map((cid) => (
                      <span
                        key={cid}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 8,
                          background: 'var(--mt-bg-sunken)',
                          fontSize: 11,
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

      {/* 3. 分野別の学習時間配分（今週・累計・時間比率・正答率） */}
      <Card style={{ display: 'grid', gap: 12 }}>
        <SectionHeader
          title="分野別の学習時間・時間配分"
          aside={`今週 ${formatDurationJa(student.weeklyActiveSeconds)} / 累計 ${formatDurationJa(timeReport.totalSeconds)}`}
        />

        {student.gradeSkillBreakdown.length === 0 ? (
          <p className="slog-empty" style={{ padding: '8px 0' }}>まだ分野別の学習時間記録がありません</p>
        ) : (
          <>
            <SkillRatioStackBar
              items={student.gradeSkillBreakdown.map((g) => ({
                key: g.key,
                skill: g.skill,
                label: g.label,
                seconds: g.weeklySeconds > 0 ? g.weeklySeconds : g.totalSeconds,
              }))}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {timeReport.skillShares
                .filter((s) => s.totalSeconds > 0)
                .map((s) => (
                  <span
                    key={s.skill}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'var(--mt-bg-sunken)',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--mt-ink-warm)',
                    }}
                  >
                    <i
                      aria-hidden="true"
                      style={{
                        width: 8,
                        height: 8,
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

            <div className="sg-skill-list">
              {student.gradeSkillBreakdown.map((row) => {
                const basisSec = row.weeklySeconds > 0 ? row.weeklySeconds : row.totalSeconds;
                const barPct = Math.min(
                  100,
                  Math.max(4, Math.round((basisSec / maxSkillSeconds) * 100)),
                );
                return (
                  <div key={row.key} className="sg-skill-item">
                    <div className="sg-skill-meta">
                      <span>{row.label.replace(/^英検/, '')}</span>
                      <small>
                        今週 <b>{formatDurationJa(row.weeklySeconds)}</b> / 累計{' '}
                        <b>{formatDurationJa(row.totalSeconds)}</b>
                        {row.accuracyPct !== null
                          ? ` · 正答率 ${row.accuracyPct}% (${row.correct}/${row.totalQuestions}問)`
                          : ''}
                      </small>
                    </div>
                    <div className="mt-meter mt-progress">
                      <i
                        style={{
                          width: `${barPct}%`,
                          backgroundColor: SkillColorOf(row.skill),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* 4. 日別学習時間グラフ（直近14日 / 直近30日 切替 ＆ 日付タップで内訳展開） */}
      <Card style={{ display: 'grid', gap: 12 }}>
        <div className="sg-toolbar">
          <SectionHeader
            title={rangeDays === 30 ? '直近30日間の学習時間推移' : '直近14日間の学習時間推移'}
            aside="棒をタップするとその日の内訳を表示"
          />
          <div className="sg-mode-pill" role="group" aria-label="表示期間">
            <button
              type="button"
              aria-pressed={rangeDays === 14}
              onClick={() => setRangeDays(14)}
            >
              14日間
            </button>
            <button
              type="button"
              aria-pressed={rangeDays === 30}
              onClick={() => setRangeDays(30)}
            >
              30日間
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
                  rowGap: 10,
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
                  padding: '3px 2px',
                  borderRadius: 8,
                }}
              >
                <span className="sg-day-min">{mins > 0 ? mins : '·'}</span>
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
                <span className="sg-day-date">{day.shortDate}</span>
              </button>
            );
          })}
        </div>

        {selectedDayDetail && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--mt-radius-md)',
              background: 'var(--mt-bg-sunken)',
              border: '1px solid var(--mt-line)',
              fontSize: 13,
              display: 'grid',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>
                {selectedDayDetail.dateKey}（{selectedDayDetail.weekdayJa}）
                {selectedDayDetail.lastUpdatedTimeLabel
                  ? ` · 最終記録 ${selectedDayDetail.lastUpdatedTimeLabel}`
                  : ''}
              </span>
              <span>
                {formatDurationJa(selectedDayDetail.totalSeconds)} · {selectedDayDetail.solvedCount}問
                {selectedDayDetail.accuracyPct !== null
                  ? `（正答率 ${selectedDayDetail.accuracyPct}%）`
                  : ''}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--mt-ink-2)' }}>
              内訳: {selectedDayDetail.breakdownText}
            </div>
          </div>
        )}
      </Card>

      {/* 5. 日別学習ログ明細一覧 */}
      <Card style={{ display: 'grid', gap: 12 }}>
        <div className="sg-toolbar">
          <SectionHeader
            title="日別の学習ログ明細"
            aside={`記録のある日 ${timeReport.sessionHistory.length}日分（最終学習: ${student.lastStudiedDateKey ?? '未学習'}）`}
          />
          {timeReport.sessionHistory.length > 10 && (
            <button
              type="button"
              className="sg-chip"
              onClick={() => setShowAllSessions((v) => !v)}
            >
              <Calendar size={13} aria-hidden="true" />
              {showAllSessions ? '直近10件に戻す' : `全${Math.min(30, timeReport.sessionHistory.length)}件を表示`}
            </button>
          )}
        </div>

        {visibleSessions.length === 0 ? (
          <p className="slog-empty" style={{ padding: '8px 0' }}>
            まだ学習時間のログが記録されていません。生徒が問題演習やリスニングを行うと自動で記録されます。
          </p>
        ) : (
          <div className="slog-rows">
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
                <div key={day.dateKey} className="slog-row">
                  <span>
                    <strong>
                      {day.dateKey}（{day.weekdayJa}）
                      {day.lastUpdatedTimeLabel ? ` ${day.lastUpdatedTimeLabel}` : ''}
                    </strong>
                    <small>
                      {detailStr}
                      {day.solvedCount > 0 ? ` · 解答 ${day.solvedCount}問` : ''}
                      {day.accuracyPct !== null ? ` · 正答率 ${day.accuracyPct}%` : ''}
                    </small>
                  </span>
                  <b>{formatDurationJa(day.totalSeconds)}</b>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--mt-ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Clock size={12} aria-hidden="true" />
          <span>※ 1分以上操作がない放置時間は自動除外した実学習時間のみを集計しています。</span>
        </p>
      </Card>

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
