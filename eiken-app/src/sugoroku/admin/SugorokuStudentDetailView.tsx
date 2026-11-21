/**
 * すごろく塾 管理者ポータル：生徒別詳細（学習時間の詳細可視化対応版）
 * 「今日・今週・直近30日・累計の学習時間」「連続学習日数・1日平均」「5技能別の時間割合＆正答率」
 * 「14日/30日切替タイムライン」「日別学習セッション明細」を1画面で詳しく把握できる構成。
 */

import { useMemo, useState, type CSSProperties } from 'react';
import { Calendar, Clock, Download, Edit3, Flame, MessageCircle, Save } from 'lucide-react';
import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import { KineticText, ScoreRing } from '../../motion';
import { CountUp } from '../../components/ui/CountUp';
import {
  BackButton,
  Card,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from '../../components/ui';
import type { SugorokuStudyLogDoc } from '../shared/types';
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
  isDemoMode: boolean;
  onBack: () => void;
  onSaveProfile: (params: {
    studentUid: string;
    rosterName: string;
    targetGrade: EikenGrade;
    note: string;
  }) => Promise<void> | void;
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

export function SugorokuStudentDetailView({
  student,
  rawLogs,
  isDemoMode,
  onBack,
  onSaveProfile,
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

  const handleCopyEncourage = async () => {
    try {
      await navigator.clipboard.writeText(buildLineEncourageMessage(student));
      onToast?.('声掛け文をコピーしました', 'done');
    } catch {
      onToast?.('コピーできませんでした', 'warn');
    }
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
      onToast?.('保存しました', 'done');
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
      {/* 上部バー */}
      <div className="sg-toolbar">
        <BackButton label="一覧" onClick={onBack} />
        <div className="sg-chip-group">
          <SecondaryButton
            onClick={() => void handleCopyEncourage()}
            icon={<MessageCircle size={15} aria-hidden="true" />}
          >
            声掛けコピー
          </SecondaryButton>
          <SecondaryButton
            onClick={() => {
              setRosterName(student.rosterName);
              setTargetGrade(student.targetGrade);
              setNote(student.note || '');
              setEditSheetOpen(true);
            }}
            icon={<Edit3 size={15} aria-hidden="true" />}
          >
            編集
          </SecondaryButton>
          <SecondaryButton
            onClick={handleExportStudentCsv}
            icon={<Download size={15} aria-hidden="true" />}
          >
            詳細CSV
          </SecondaryButton>
        </div>
      </div>

      {/* 1. 生徒プロフィール＆学習時間 4大サマリー（本日 / 今週 / 直近30日 / 累計） */}
      <Card style={{ display: 'grid', gap: 14 }}>
        <div className="sg-toolbar" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="sg-row-head">
              <h2 className="mt-h1" style={{ margin: 0 }}>
                <KineticText text={student.rosterName} variant="rise" />
              </h2>
              <span className="sg-grade-tag">
                {getGradeLabel(student.targetGrade).replace('英検', '')}
              </span>
              {student.alerts[0] && (
                <span
                  className="sg-alert-text"
                  data-warn={student.alerts[0].severity !== 'critical' ? 'true' : undefined}
                >
                  {student.alerts[0].label}
                </span>
              )}
            </div>

            {student.note && (
              <p style={{ margin: 0, font: '500 13px/1.5 var(--mt-font-body)', color: 'var(--mt-ink-2)' }}>
                {student.note}
              </p>
            )}
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

        <p style={{ margin: 0, fontSize: 12, color: 'var(--mt-ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Clock size={13} aria-hidden="true" />
          <span>
            ※ 1分以上操作がない放置時間は自動除外した「実学習時間」のみを集計しています（最終学習日:{' '}
            <b>{student.lastStudiedDateKey ?? '未学習'}</b>）
          </span>
        </p>

        {(student.pendingWritingCount > 0 || student.pendingSpeakingCount > 0) && (
          <div className="sg-chip-group">
            {student.pendingWritingCount > 0 && (
              <button type="button" className="sg-chip" onClick={onOpenWritingTab}>
                英作文 未確認 {student.pendingWritingCount}
              </button>
            )}
            {student.pendingSpeakingCount > 0 && (
              <button type="button" className="sg-chip" onClick={onOpenSpeakingTab}>
                スピーキング 未確認 {student.pendingSpeakingCount}
              </button>
            )}
          </div>
        )}
      </Card>

      {/* 2. 分野別の学習時間配分（今週・累計・時間比率・正答率） */}
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

            {/* 5技能サマリーピル（全体の何%をどの技能に使っているか） */}
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

      {/* 3. 日別学習時間グラフ（直近14日 / 直近30日 切替 ＆ 日付タップで内訳展開） */}
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

      {/* 4. 日別学習ログ明細一覧（いつ・何分・何問・どの分野をやったか） */}
      <Card style={{ display: 'grid', gap: 12 }}>
        <div className="sg-toolbar">
          <SectionHeader
            title="日別の学習ログ明細"
            aside={`記録のある日 ${timeReport.sessionHistory.length}日分`}
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
      </Card>

      {/* Bottom Sheet：名簿・目標級・メモ編集 */}
      <SugorokuBottomSheet
        open={editSheetOpen}
        title="生徒設定"
        onClose={() => setEditSheetOpen(false)}
      >
        <div className="slog-form">
          <label className="f">
            <span>表示名（管理画面のみ）</span>
            <input
              type="text"
              value={rosterName}
              onChange={(e) => setRosterName(e.target.value)}
            />
          </label>

          <label className="f">
            <span>目標級</span>
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
            <span>メモ</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
