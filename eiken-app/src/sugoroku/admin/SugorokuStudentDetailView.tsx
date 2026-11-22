/**
 * すごろく塾 管理者ポータル：生徒別詳細（エッセンシャル設計）
 * 色味・説明文を排し、数値・推移・分野比率だけを一瞥で把握できる構成。
 */

import { useState, type CSSProperties } from 'react';
import { Download, Edit3, MessageCircle, Save } from 'lucide-react';
import { type EikenGrade } from '../../eiken/config';
import { KineticText, ScoreRing } from '../../motion';
import { CountUp } from '../../components/ui/CountUp';
import {
  BackButton,
  Card,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from '../../components/ui';
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
  SkillColorOf,
  SkillRatioStackBar,
  StudyDoorsWeek,
  SugorokuBottomSheet,
  type ToastTone,
} from './SugorokuInteractiveUi';

interface SugorokuStudentDetailViewProps {
  student: SugorokuStudentOverview;
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
  isDemoMode,
  onBack,
  onSaveProfile,
  onOpenWritingTab,
  onOpenSpeakingTab,
  onToast,
}: SugorokuStudentDetailViewProps) {
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [rosterName, setRosterName] = useState(student.rosterName);
  const targetGrade: EikenGrade = student.targetGrade;
  const [note, setNote] = useState(student.note || '');
  const [saving, setSaving] = useState(false);

  const todayKey = formatDateKey(Date.now());
  const maxDailySeconds = Math.max(
    1800,
    ...student.recentDailyLogs.map((d) => d.totalActiveSeconds),
  );
  const maxSkillWeeklySeconds = Math.max(
    900,
    ...student.gradeSkillBreakdown.map((g) => Math.max(g.weeklySeconds, g.totalSeconds)),
  );

  const weeklyMinutes = Math.round(student.weeklyActiveSeconds / 60);

  let totalCorrect = 0;
  let totalQuestions = 0;
  for (const g of student.gradeSkillBreakdown) {
    totalCorrect += g.correct;
    totalQuestions += g.totalQuestions;
  }
  const overallAccuracy =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;

  const handleExportStudentCsv = () => {
    const csv = buildSugorokuStudentDetailCsv(student, true);
    const safeName = student.rosterName.replace(/[\\/:*?"<>|\s]+/g, '_');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `学習レポート_${safeName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onToast?.('CSVを保存しました', 'done');
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
      className="sg-stagger sg-grid-14"
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
            CSV
          </SecondaryButton>
        </div>
      </div>

      {/* 1. 生徒プロフィール＆主要数値 */}
      <Card className="sg-grid-14">
        <div className="sg-toolbar sg-toolbar-top">
          <div className="sg-grid-6">
            <div className="sg-row-head">
              <h2 className="mt-h1 sg-m0">
                <KineticText text={student.rosterName} variant="rise" />
              </h2>
              {student.gradeSkillBreakdown[0] ? (
                <span className="sg-grade-tag">
                  直近：{getGradeLabel(student.gradeSkillBreakdown[0].grade as EikenGrade).replace('英検', '')}
                </span>
              ) : (
                <span className="sg-grade-tag">全級一括</span>
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

            {student.note && (
              <p className="sg-student-note">
                {student.note}
              </p>
            )}
          </div>

          <StudyDoorsWeek recentDailyLogs={student.recentDailyLogs} />
        </div>

        <div className="sg-summary-strip sg-summary-strip-sunken">
          <div className="sg-stat">
            <div className="sg-stat-body">
              <span className="sg-stat-label">今週</span>
              <span className="sg-stat-val">
                <CountUp value={weeklyMinutes} fromZero duration={600} />
                <span className="sg-stat-unit">分</span>
              </span>
            </div>
          </div>

          <div className="sg-stat sg-stat-between">
            <div className="sg-stat-body">
              <span className="sg-stat-label">宿題</span>
              <span className="sg-stat-val">
                <CountUp value={student.homework.completionRate} fromZero duration={650} />
                <span className="sg-stat-unit">%</span>
              </span>
            </div>
            <ScoreRing
              rate={student.homework.completionRate / 100}
              size={34}
              stroke={5}
              tone={student.homework.overdueCount > 0 ? 'warn' : 'brand'}
            />
          </div>

          <div className="sg-stat sg-stat-between">
            <div className="sg-stat-body">
              <span className="sg-stat-label">正答率</span>
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

      {/* 2. 分野別内訳 */}
      <Card className="sg-grid-12">
        <SectionHeader title="分野別" />

        {student.gradeSkillBreakdown.length === 0 ? (
          <p className="slog-empty sg-empty-compact">記録なし</p>
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

            <div className="sg-skill-list">
              {student.gradeSkillBreakdown.map((row) => {
                const basisSec = row.weeklySeconds > 0 ? row.weeklySeconds : row.totalSeconds;
                const barPct = Math.min(
                  100,
                  Math.max(4, Math.round((basisSec / maxSkillWeeklySeconds) * 100)),
                );
                return (
                  <div key={row.key} className="sg-skill-item">
                    <div className="sg-skill-meta">
                      <span>{row.label.replace(/^英検/, '')}</span>
                      <small>
                        {formatDurationJa(basisSec)}
                        {row.accuracyPct !== null ? ` · ${row.accuracyPct}%` : ''}
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

      {/* 3. 直近14日 */}
      <Card className="sg-grid-12">
        <SectionHeader title="直近14日" aside="分" />

        <div className="sg-daily-bars" role="img" aria-label="直近14日の学習時間">
          {student.recentDailyLogs.map((day, idx) => {
            const mins = Math.round(day.totalActiveSeconds / 60);
            const heightPct =
              day.totalActiveSeconds > 0
                ? Math.max(8, Math.round((day.totalActiveSeconds / maxDailySeconds) * 100))
                : 0;
            const isToday = day.dateKey === todayKey;
            return (
              <div
                key={day.dateKey}
                className="sg-day-col"
                data-today={isToday ? 'true' : undefined}
                title={`${day.dateKey}: ${mins}分`}
              >
                <span className="sg-day-min">{mins > 0 ? mins : '·'}</span>
                <div className="sg-day-track">
                  {heightPct > 0 && (
                    <div
                      className="sg-day-fill"
                      style={
                        {
                          height: `${heightPct}%`,
                          ['--sg-d' as string]: idx,
                        } as CSSProperties
                      }
                    />
                  )}
                </div>
                <span className="sg-day-date">{day.shortDate}</span>
              </div>
            );
          })}
        </div>

        <div className="slog-rows">
          {[...student.recentDailyLogs]
            .reverse()
            .filter((d) => d.totalActiveSeconds > 0)
            .slice(0, 5)
            .map((day) => {
              const entries = Object.entries(day.byGradeSkill).filter(([, s]) => s > 0);
              return (
                <div key={day.dateKey} className="slog-row">
                  <span>
                    <strong>{day.dateKey.slice(5)}</strong>
                    <small>
                      {entries
                        .map(([k, sec]) => `${parseGradeSkillKey(k).label.replace(/^英検/, '')} ${toMinutesRounded(sec)}分`)
                        .join(' / ')}
                    </small>
                  </span>
                  <b>{formatDurationJa(day.totalActiveSeconds)}</b>
                </div>
              );
            })}
        </div>
      </Card>

      {/* Bottom Sheet：名簿名・メモ編集（級ごとの固定分けは不要） */}
      <SugorokuBottomSheet
        open={editSheetOpen}
        title="塾生プロフィール設定"
        onClose={() => setEditSheetOpen(false)}
      >
        <div className="slog-form">
          <label className="f">
            <span>生徒氏名（講師の管理画面のみ表示）</span>
            <input
              type="text"
              value={rosterName}
              onChange={(e) => setRosterName(e.target.value)}
            />
          </label>

          <label className="f">
            <span>指導メモ（志望校・受験回・声掛け履歴など）</span>
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
