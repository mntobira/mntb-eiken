import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Download,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Flame,
  AlertTriangle,
  BarChart3,
  Target,
  CheckCircle2,
} from 'lucide-react';
import { type ClassroomDoc } from '../../utils/classroomCore';
import type { ThemeShape } from './teacherTheme';
import {
  createDefaultClassSettings,
  type JukuClassSettings,
} from '../../sugoroku/admin/classroomSettings';
import {
  loadClassPortalData,
  updateSugorokuStudentProfile,
  type LoadedClassPortalData,
} from '../../sugoroku/admin/firestoreAdminService';
import {
  buildStudentOverview,
  buildSugorokuSummaryCsv,
  formatDateKey,
  formatDurationJa,
  getGradeLabel,
  sortStudentsByAlertPriority,
  type SugorokuStudentOverview,
} from '../../sugoroku/admin/adminAnalytics';
import {
  buildStudentDetailedTimeCsv,
  buildStudentDetailedTimeReport,
  type StudentDetailedTimeReport,
} from '../../sugoroku/admin/timeAnalyticsDetail';
import { SkillColorOf, SkillRatioStackBar, StudyDoorsWeek } from '../../sugoroku/admin/SugorokuInteractiveUi';
import type { EikenGrade } from '../../eiken/config';

/**
 * 先生ダッシュボード用「学習時間の詳細」タブ
 * クラス在籍生徒全員について、誰が・今日/今週/直近30日/累計で何分やったか・
 * どの分野（リスニング/リーディング/単語/ライティング/スピーキング）に何分使ったか・
 * 日別セッション履歴を一覧＆個人ドリルダウンで可視化する。
 */
export function StudyTimeTab({
  activeClass,
  classSettings,
  theme,
  onOpenEditClass,
}: {
  activeClass: ClassroomDoc | null;
  classSettings?: JukuClassSettings;
  theme: ThemeShape;
  onOpenEditClass?: () => void;
}) {
  const settings = classSettings ?? createDefaultClassSettings(activeClass?.id || '');
  const dailyGoalSec = settings.dailyGoalMinutes * 60;
  const weeklyGoalMinutes = settings.dailyGoalMinutes * settings.weeklyGoalDays;
  const weeklyGoalSec = weeklyGoalMinutes * 60;
  const [portalData, setPortalData] = useState<LoadedClassPortalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'weekly_desc' | 'total_desc' | 'alert_first'>('weekly_desc');
  const [rangeDays, setRangeDays] = useState<14 | 30>(14);

  const load = useCallback(async () => {
    if (!activeClass) {
      setPortalData(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const loaded = await loadClassPortalData(activeClass);
      setPortalData(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : '学習時間データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [activeClass]);

  useEffect(() => {
    setSelectedUid(null);
    void load();
  }, [load]);

  const rows = useMemo(() => {
    if (!portalData) return [] as Array<{
      overview: SugorokuStudentOverview;
      report: StudentDetailedTimeReport;
    }>;

    const built = portalData.members
      .filter((m) => m.role === 'student' && m.active !== false)
      .map((member) => {
        const logs = portalData.logsByUid[member.uid] ?? [];
        const overview = buildStudentOverview({
          member,
          logs,
          assignments: portalData.assignments,
          solvedByChapter: portalData.solvedByUid[member.uid] ?? {},
          writingSubmissions: portalData.writingSubmissions,
          speakingSubmissions: portalData.speakingSubmissions,
        });
        const report = buildStudentDetailedTimeReport({
          uid: member.uid,
          logs,
          overview,
        });
        return { overview, report };
      });

    if (sortBy === 'alert_first') {
      const sortedOverviews = sortStudentsByAlertPriority(built.map((b) => b.overview));
      const byUid = new Map(built.map((b) => [b.overview.uid, b]));
      return sortedOverviews.map((o) => byUid.get(o.uid)!).filter(Boolean);
    }
    if (sortBy === 'total_desc') {
      return [...built].sort(
        (a, b) =>
          b.report.totalSeconds - a.report.totalSeconds ||
          b.report.weeklySeconds - a.report.weeklySeconds,
      );
    }
    return [...built].sort(
      (a, b) =>
        b.report.weeklySeconds - a.report.weeklySeconds ||
        b.report.totalSeconds - a.report.totalSeconds,
    );
  }, [portalData, sortBy]);

  const classStats = useMemo(() => {
    const count = rows.length;
    const totalTodaySec = rows.reduce((s, r) => s + r.report.todaySeconds, 0);
    const totalWeekSec = rows.reduce((s, r) => s + r.report.weeklySeconds, 0);
    const totalMonthSec = rows.reduce((s, r) => s + r.report.monthlySeconds, 0);
    const activeTodayCount = rows.filter((r) => r.report.todaySeconds > 0).length;
    const activeWeekCount = rows.filter((r) => r.report.weeklySeconds > 0).length;
    const goalAchievedCount = rows.filter((r) => r.report.weeklySeconds >= weeklyGoalSec).length;
    return {
      count,
      totalTodaySec,
      totalWeekSec,
      totalMonthSec,
      avgWeekSec: count > 0 ? Math.round(totalWeekSec / count) : 0,
      activeTodayCount,
      activeWeekCount,
      goalAchievedCount,
    };
  }, [rows, weeklyGoalSec]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.overview.uid === selectedUid) ?? null,
    [rows, selectedUid],
  );

  const handleExportSummaryCsv = () => {
    if (rows.length === 0) return;
    const csv = buildSugorokuSummaryCsv(
      rows.map((r) => r.overview),
      true,
    );
    const safeClass = (activeClass?.className || 'クラス').replace(/[\\/:*?"<>|\s]+/g, '_');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `クラス学習時間一覧_${safeClass}_${formatDateKey(Date.now())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportStudentDetailCsv = (
    overview: SugorokuStudentOverview,
    report: StudentDetailedTimeReport,
  ) => {
    const csv = buildStudentDetailedTimeCsv({
      rosterName: overview.rosterName,
      targetGrade: overview.targetGrade,
      report,
      withBom: true,
    });
    const safeName = overview.rosterName.replace(/[\\/:*?"<>|\s]+/g, '_');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `個人別30日学習時間_${safeName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!activeClass) return null;

  if (loading && !portalData) {
    return (
      <div className="py-12 text-center text-sm text-[#6B7280]">
        生徒ごとの学習時間ログを集計しています…
      </div>
    );
  }

  // 個人ドリルダウン表示
  if (selectedRow) {
    const { overview, report } = selectedRow;
    const chartDays = rangeDays === 30 ? report.daily30 : report.daily30.slice(-14);
    const maxSec = Math.max(dailyGoalSec, 1800, ...chartDays.map((d) => d.totalSeconds));
    const todayKey = formatDateKey(Date.now());
    const weeklyPct =
      weeklyGoalSec > 0 ? Math.min(100, Math.round((report.weeklySeconds / weeklyGoalSec) * 100)) : 0;
    const dailyPct =
      dailyGoalSec > 0 ? Math.min(100, Math.round((report.todaySeconds / dailyGoalSec) * 100)) : 0;

    return (
      <div className="space-y-4" data-testid="teacher-student-time-detail">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelectedUid(null)}
            className="inline-flex min-h-[40px] items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E0E1DD] bg-white text-sm font-bold text-[#1B2631] hover:bg-[#FAF8F2]"
          >
            <ArrowLeft className="w-4 h-4" />
            クラスの時間一覧へ戻る
          </button>

          <button
            type="button"
            onClick={() => handleExportStudentDetailCsv(overview, report)}
            className="inline-flex min-h-[40px] items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: theme.accent }}
          >
            <Download className="w-4 h-4" />
            30日詳細CSVを保存
          </button>
        </div>

        {/* 生徒ヘッダー＆4期間カード */}
        <div className="bg-white rounded-2xl border border-[#E0E1DD] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-[#1B2631]">{overview.rosterName}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#F1EFE9] text-xs font-bold text-[#4B5563]">
                  目標: {getGradeLabel(overview.targetGrade)}
                </span>
                {report.currentStreakDays > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF7ED] border border-[#FED7AA] text-xs font-bold text-[#C2410C]">
                    <Flame className="w-3.5 h-3.5" />
                    {report.currentStreakDays}日連続学習中
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B7280] mt-1">
                最終学習日: <strong>{overview.lastStudiedDateKey ?? '未学習'}</strong> · 学習稼働日数: 直近30日で{' '}
                <strong>{report.activeDays30}日</strong>（累計 {report.totalActiveDays}日）
              </p>
            </div>
            <StudyDoorsWeek recentDailyLogs={overview.recentDailyLogs} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-[#FAF8F2] border border-[#E8E4DA] p-3">
              <p className="text-xs text-[#6B7280]">本日の学習時間</p>
              <p className="text-xl font-extrabold text-[#1B2631] mt-0.5">
                {formatDurationJa(report.todaySeconds)}
              </p>
              <p className="text-[11px] text-[#4B5563] mt-0.5">
                目標{settings.dailyGoalMinutes}分の <strong>{dailyPct}%</strong>
              </p>
            </div>
            <div className="rounded-xl bg-[#FAF8F2] border border-[#E8E4DA] p-3">
              <p className="text-xs text-[#6B7280]">今週（直近7日）</p>
              <p className="text-xl font-extrabold text-[#1B2631] mt-0.5">
                {formatDurationJa(report.weeklySeconds)}
              </p>
              <p className="text-[11px] text-[#4B5563] mt-0.5">
                週目標{weeklyGoalMinutes}分の <strong>{weeklyPct}%</strong>
              </p>
            </div>
            <div className="rounded-xl bg-[#FAF8F2] border border-[#E8E4DA] p-3">
              <p className="text-xs text-[#6B7280]">直近30日間</p>
              <p className="text-xl font-extrabold text-[#1B2631] mt-0.5">
                {formatDurationJa(report.monthlySeconds)}
              </p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">{report.monthlySolvedCount}問解答</p>
            </div>
            <div className="rounded-xl bg-[#FAF8F2] border border-[#E8E4DA] p-3">
              <p className="text-xs text-[#6B7280]">累計有効学習時間</p>
              <p className="text-xl font-extrabold mt-0.5" style={{ color: theme.accent }}>
                {formatDurationJa(report.totalSeconds)}
              </p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">学習日平均 {report.avgSessionMinutes}分</p>
            </div>
          </div>
        </div>

        {/* 分野別内訳 */}
        <div className="bg-white rounded-2xl border border-[#E0E1DD] p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-[#1B2631]">分野別の学習時間・時間配分</h3>
          {overview.gradeSkillBreakdown.length === 0 ? (
            <p className="text-sm text-[#6B7280] py-2">まだ分野別の学習時間記録がありません。</p>
          ) : (
            <>
              <SkillRatioStackBar
                items={overview.gradeSkillBreakdown.map((g) => ({
                  key: g.key,
                  skill: g.skill,
                  label: g.label,
                  seconds: g.weeklySeconds > 0 ? g.weeklySeconds : g.totalSeconds,
                }))}
              />
              <div className="space-y-2.5 pt-1">
                {report.skillShares
                  .filter((s) => s.totalSeconds > 0)
                  .map((s) => (
                    <div key={s.skill} className="space-y-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                        <span className="font-bold text-[#1B2631]">
                          {s.label}（全体の {s.sharePct}%）
                        </span>
                        <span className="text-[#4B5563]">
                          今週 <strong>{formatDurationJa(s.weeklySeconds)}</strong> / 30日{' '}
                          <strong>{formatDurationJa(s.monthlySeconds)}</strong> / 累計{' '}
                          <strong>{formatDurationJa(s.totalSeconds)}</strong>
                          {s.accuracyPct !== null ? ` · 正答率 ${s.accuracyPct}%` : ''}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F1EFE9] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(4, s.sharePct)}%`,
                            backgroundColor: SkillColorOf(s.skill),
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>

        {/* 日別推移棒グラフ（14日 / 30日切替） */}
        <div className="bg-white rounded-2xl border border-[#E0E1DD] p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-[#1B2631]">
              日別の学習時間推移（直近{rangeDays}日間）
            </h3>
            <div className="inline-flex p-0.5 rounded-lg bg-[#F1EFE9]">
              <button
                type="button"
                onClick={() => setRangeDays(14)}
                className={`px-3 py-1 rounded-md text-xs font-bold ${
                  rangeDays === 14 ? 'bg-white text-[#1B2631] shadow-sm' : 'text-[#6B7280]'
                }`}
              >
                14日
              </button>
              <button
                type="button"
                onClick={() => setRangeDays(30)}
                className={`px-3 py-1 rounded-md text-xs font-bold ${
                  rangeDays === 30 ? 'bg-white text-[#1B2631] shadow-sm' : 'text-[#6B7280]'
                }`}
              >
                30日
              </button>
            </div>
          </div>

          <div
            className="grid items-end gap-1.5 pt-2"
            style={{
              gridTemplateColumns: `repeat(${rangeDays === 30 ? 15 : 14}, minmax(0, 1fr))`,
            }}
          >
            {chartDays.map((d) => {
              const mins = Math.round(d.totalSeconds / 60);
              const pct =
                d.totalSeconds > 0 ? Math.max(8, Math.round((d.totalSeconds / maxSec) * 100)) : 0;
              const isToday = d.dateKey === todayKey;
              return (
                <div
                  key={d.dateKey}
                  className="flex flex-col items-center gap-1"
                  title={`${d.dateKey} (${d.weekdayJa}): ${formatDurationJa(d.totalSeconds)} / ${d.solvedCount}問`}
                >
                  <span className="text-[10px] font-bold text-[#6B7280] tabular-nums">
                    {mins > 0 ? mins : '·'}
                  </span>
                  <div
                    className={`w-full h-16 rounded-md bg-[#F1EFE9] p-0.5 flex items-end ${
                      isToday ? 'ring-1 ring-[#2458a6]' : ''
                    }`}
                  >
                    {pct > 0 && (
                      <div
                        className="w-full rounded-sm"
                        style={{ height: `${pct}%`, backgroundColor: theme.accent }}
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-[#6B7280] whitespace-nowrap">{d.shortDate}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 日別ログ明細 */}
        <div className="bg-white rounded-2xl border border-[#E0E1DD] p-4 sm:p-5 space-y-2.5">
          <h3 className="text-sm font-extrabold text-[#1B2631]">
            日別の学習ログ明細（{report.sessionHistory.length}日分）
          </h3>
          {report.sessionHistory.length === 0 ? (
            <p className="text-sm text-[#6B7280]">まだ学習時間の記録がありません。</p>
          ) : (
            <div className="divide-y divide-[#EFECE6]">
              {report.sessionHistory.slice(0, 30).map((d) => (
                <div key={d.dateKey} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-[#1B2631]">
                      {d.dateKey}（{d.weekdayJa}）
                      {d.lastUpdatedTimeLabel ? ` · 最終 ${d.lastUpdatedTimeLabel}` : ''}
                    </p>
                    <p className="text-[#6B7280] truncate mt-0.5">
                      {d.breakdownText}
                      {d.solvedCount > 0 ? ` · ${d.solvedCount}問解答` : ''}
                      {d.accuracyPct !== null ? ` · 正答率 ${d.accuracyPct}%` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-[#1B2631] tabular-nums">
                    {formatDurationJa(d.totalSeconds)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="teacher-study-time-tab">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FDECEA] border border-[#F5C6C0] text-sm text-[#96342B]">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* コース目標バー */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-2xl border border-[#E0E1DD] px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 font-extrabold text-[#1F635B] bg-[#EBF8F6] border border-[#BFE6E0] px-2.5 py-1 rounded-full">
            <Target className="w-3.5 h-3.5" />
            コース目標：1日{settings.dailyGoalMinutes}分 × 週{settings.weeklyGoalDays}日（週{weeklyGoalMinutes}分）
          </span>
          <span className="text-[#4B5563]">
            今週の目標達成：<strong>{classStats.goalAchievedCount}</strong> / {classStats.count}名
          </span>
        </div>
        {onOpenEditClass && (
          <button
            type="button"
            onClick={onOpenEditClass}
            className="font-bold text-[#4B5563] hover:text-[#1B2631] underline underline-offset-2"
          >
            目標時間を変更
          </button>
        )}
      </div>

      {/* クラス全体の学習時間サマリー4カード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-[#E0E1DD] p-3.5">
          <p className="text-xs text-[#6B7280] mb-1">クラス本日の合計</p>
          <p className="text-xl font-extrabold" style={{ color: theme.accent }}>
            {formatDurationJa(classStats.totalTodaySec)}
          </p>
          <p className="text-xs text-[#6B7280] mt-0.5">
            本日学習 {classStats.activeTodayCount}/{classStats.count}人
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E0E1DD] p-3.5">
          <p className="text-xs text-[#6B7280] mb-1">今週（7日間）1人平均</p>
          <p className="text-xl font-extrabold" style={{ color: theme.accent }}>
            {formatDurationJa(classStats.avgWeekSec)}
          </p>
          <p className="text-xs text-[#6B7280] mt-0.5">
            週目標 {weeklyGoalMinutes}分 対比{' '}
            {weeklyGoalSec > 0 ? `${Math.round((classStats.avgWeekSec / weeklyGoalSec) * 100)}%` : '-'}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E0E1DD] p-3.5">
          <p className="text-xs text-[#6B7280] mb-1">週目標クリア人数</p>
          <p className="text-xl font-extrabold text-[#1B2631]">
            {classStats.goalAchievedCount}
            <span className="text-sm font-bold text-[#6B7280]"> / {classStats.count}人</span>
          </p>
          <p className="text-xs text-[#6B7280] mt-0.5">
            今週稼働 {classStats.activeWeekCount}人
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E0E1DD] p-3.5">
          <p className="text-xs text-[#6B7280] mb-1">直近30日の総学習時間</p>
          <p className="text-xl font-extrabold text-[#1B2631]">
            {formatDurationJa(classStats.totalMonthSec)}
          </p>
          <p className="text-xs text-[#6B7280] mt-0.5">
            今週計 {formatDurationJa(classStats.totalWeekSec)}
          </p>
        </div>
      </div>

      {/* ツールバー（並び替え・更新・CSV） */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'weekly_desc', label: '今週の時間順' },
              { id: 'total_desc', label: '累計の時間順' },
              { id: 'alert_first', label: '要フォロー優先' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSortBy(opt.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                sortBy === opt.id
                  ? 'bg-[#1B2631] text-white border-[#1B2631]'
                  : 'bg-white text-[#4B5563] border-[#E0E1DD] hover:bg-[#FAF8F2]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-[38px] items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E0E1DD] bg-white text-xs font-bold text-[#4B5563] hover:bg-[#FAF8F2]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            更新
          </button>
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={handleExportSummaryCsv}
            className="inline-flex min-h-[38px] items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: theme.accent }}
          >
            <Download className="w-3.5 h-3.5" />
            学習時間CSV
          </button>
        </div>
      </div>

      {/* 生徒別の学習時間カード一覧 */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E0E1DD] p-7 text-center">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-[#9BA3AE]" />
          <h3 className="text-base font-bold text-[#1B2631] mb-1">まだ在籍生徒がいません</h3>
          <p className="text-sm text-[#4B5563]">
            生徒が参加コードでクラスに入ると、ここに毎日の学習時間と分野別内訳が表示されます。
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(({ overview, report }) => {
            const goalPct =
              weeklyGoalSec > 0
                ? Math.min(100, Math.round((report.weeklySeconds / weeklyGoalSec) * 100))
                : 0;
            const achieved = weeklyGoalSec > 0 && report.weeklySeconds >= weeklyGoalSec;
            return (
              <button
                key={overview.uid}
                type="button"
                onClick={() => setSelectedUid(overview.uid)}
                className="w-full text-left bg-white rounded-2xl border border-[#E0E1DD] hover:border-[#9BA3AE] p-4 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-[#1B2631]">
                        {overview.rosterName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#F1EFE9] text-[11px] font-bold text-[#4B5563]">
                        {getGradeLabel(overview.targetGrade).replace('英検', '')}
                      </span>
                      {achieved && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[11px] font-bold text-[#065F46]">
                          <CheckCircle2 className="w-3 h-3" />
                          週目標達成
                        </span>
                      )}
                      {overview.alerts[0] && (
                        <span className="text-xs font-bold text-[#B91C1C]">
                          {overview.alerts[0].label}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280]">
                      <StudyDoorsWeek recentDailyLogs={overview.recentDailyLogs} />
                      <span>最終: {overview.lastStudiedDateKey ?? '未学習'}</span>
                      <span>週目標達成率: <strong>{goalPct}%</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 ml-auto">
                    <div className="text-right">
                      <span className="block text-[11px] text-[#6B7280]">本日</span>
                      <strong className="text-sm font-extrabold text-[#1B2631] tabular-nums">
                        {formatDurationJa(report.todaySeconds)}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="block text-[11px] text-[#6B7280]">今週 / 目標{weeklyGoalMinutes}分</span>
                      <strong
                        className="text-base font-extrabold tabular-nums"
                        style={{ color: theme.accent }}
                      >
                        {formatDurationJa(report.weeklySeconds)}
                      </strong>
                    </div>
                    <div className="text-right hidden sm:block">
                      <span className="block text-[11px] text-[#6B7280]">累計</span>
                      <strong className="text-sm font-extrabold text-[#1B2631] tabular-nums">
                        {formatDurationJa(report.totalSeconds)}
                      </strong>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#9BA3AE] shrink-0" />
                  </div>
                </div>

                {/* 週目標プログレスバー */}
                <div className="mt-2.5 h-1.5 rounded-full bg-[#F1EFE9] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${goalPct}%`,
                      backgroundColor: achieved ? '#059669' : theme.accent,
                    }}
                  />
                </div>

                {overview.gradeSkillBreakdown.length > 0 && (
                  <div className="mt-2.5">
                    <SkillRatioStackBar
                      items={overview.gradeSkillBreakdown.map((g) => ({
                        key: g.key,
                        skill: g.skill,
                        label: g.label,
                        seconds: g.weeklySeconds > 0 ? g.weeklySeconds : g.totalSeconds,
                      }))}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-[#6B7280] pt-1">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        生徒行をクリックすると、分野別の時間割合・14日/30日グラフ・日別セッション履歴の詳細が開きます。
      </p>
    </div>
  );
}

// 未使用警告防止のため型再公開
export { updateSugorokuStudentProfile };
export type { EikenGrade };
