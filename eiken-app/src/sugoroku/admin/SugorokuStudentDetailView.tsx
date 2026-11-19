/**
 * ===================================================================
 * すごろく塾管理者ポータル：個人別ドリルダウン詳細画面（マナトビ純正UI版）
 * ===================================================================
 * ・KineticText による生徒名・セクション見出しの1文字立ち上がり演出
 * ・ScoreRing（宿題達成輪・正答率輪）＋ CountUp（0からの数値カウントアップ）
 * ・SkillRatioStackBar（級×技能構成比スタックバー）＋ `.mt-progress`（光が走る進捗バー）
 * ・StudyDoorsWeek（連続学習の7枚扉）＋ スプリング立ち上がり14日間チャート
 * ・SugorokuBottomSheet（下ドラッグで閉じられる名簿・目標級・メモ編集シート）
 */

import { useState, type CSSProperties } from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileEdit,
  MessageCircleHeart,
  Mic,
  Save,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import { KineticText, ScoreRing } from '../../motion';
import { CountUp } from '../../components/ui/CountUp';
import {
  BackButton,
  Badge,
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
    return `${student.rosterName.split('（')[0]}さん、部活お疲れさま！今週の${grade}対策、まずはリスニング第1部か単語10問（約5分）だけ今日開いてみよう！分からない問題はいつでも聞いてね。`;
  }
  return `${student.rosterName.split('（')[0]}さん、今週もう${weekMin}分も${grade}の演習を進められていて素晴らしいペースです！宿題消化も${student.homework.completionRate}%まで来ているので、この調子で一緒に合格をつかもう！`;
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
  const [targetGrade, setTargetGrade] = useState<EikenGrade>(student.targetGrade);
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
  const todayMinutes = Math.round(student.todayActiveSeconds / 60);

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
    a.download = `すごろく個人学習レポート_${safeName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onToast?.(`「${student.rosterName}」の面談用CSVを書き出しました`, 'done');
  };

  const handleCopyEncourage = async () => {
    const msg = buildLineEncourageMessage(student);
    try {
      await navigator.clipboard.writeText(msg);
      onToast?.('LINE・面談用の声掛けメッセージをコピーしました', 'done');
    } catch {
      onToast?.('コピーできませんでした（ブラウザ権限を確認してください）', 'warn');
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
      onToast?.('名簿氏名・目標級・指導メモを更新しました', 'done');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label={`${student.rosterName}の個人別学習ログ詳細`}
      className="sg-stagger"
      style={{ display: 'grid', gap: 14 }}
    >
      {/* 1. 上部ナビ＋ワンタップアクション */}
      <div className="sg-filter-bar">
        <BackButton label="塾生一覧へ戻る" onClick={onBack} />
        <div className="sg-chip-group">
          <SecondaryButton
            onClick={() => void handleCopyEncourage()}
            icon={<MessageCircleHeart size={16} aria-hidden="true" />}
          >
            声掛け文コピー
          </SecondaryButton>
          <PrimaryButton
            onClick={handleExportStudentCsv}
            icon={<Download size={16} aria-hidden="true" />}
          >
            面談・保護者報告用CSV出力
          </PrimaryButton>
        </div>
      </div>

      {/* 2. 生徒ヒーローカード（KineticText 氏名 ＋ 7枚扉 ＋ Bottom Sheet 編集ボタン） */}
      <Card>
        <div className="sg-student-top">
          <div className="sg-student-identity">
            <div className="sg-student-badges">
              <Badge>
                <Award size={13} aria-hidden="true" />
                目標：{getGradeLabel(student.targetGrade)}
              </Badge>
              {student.adFree && (
                <span className="mt-status" data-status="done">
                  <ShieldCheck size={13} aria-hidden="true" />
                  塾生Ad-Free適用中
                </span>
              )}
              {student.alerts.map((al) => (
                <Badge key={al.reason} tone={al.severity === 'critical' ? 'new' : 'gold'}>
                  {al.label}
                </Badge>
              ))}
              <StudyDoorsWeek recentDailyLogs={student.recentDailyLogs} />
            </div>

            <h2 className="mt-h1" style={{ margin: '2px 0 0' }}>
              <KineticText text={student.rosterName} variant="rise" />
            </h2>

            {student.nickname && (
              <p className="mt-small" style={{ margin: 0 }}>
                アプリ内ニックネーム：<b>{student.nickname}</b>（※本名は塾管理画面のみ表示）
              </p>
            )}

            {student.note && (
              <p
                style={{
                  margin: '6px 0 0',
                  padding: '8px 12px',
                  borderRadius: 'var(--mt-radius-md)',
                  background: 'var(--mt-bg-sunken)',
                  font: '600 13px/1.5 var(--mt-font-body)',
                  color: 'var(--mt-ink-warm)',
                }}
              >
                担任共有メモ：{student.note}
              </p>
            )}
          </div>

          <SecondaryButton
            onClick={() => {
              setRosterName(student.rosterName);
              setTargetGrade(student.targetGrade);
              setNote(student.note || '');
              setEditSheetOpen(true);
            }}
            icon={<Edit3 size={15} aria-hidden="true" />}
          >
            名簿・目標級を編集
          </SecondaryButton>
        </div>

        {/* 4連インフォグラフィックKPI（CountUp + ScoreRing） */}
        <div className="sg-kpi-grid" style={{ marginTop: 12 }}>
          <div className="sg-kpi-card" data-tone="sky">
            <p className="sg-kpi-label">
              <Clock size={14} aria-hidden="true" />
              今週の有効学習時間
            </p>
            <div className="sg-kpi-main">
              <span className="sg-kpi-num">
                <CountUp value={weeklyMinutes} fromZero duration={750} />
                <span className="sg-kpi-unit">分</span>
              </span>
            </div>
            <p className="sg-kpi-sub">
              {formatDurationJa(student.weeklyActiveSeconds)}（1分無操作除外）
            </p>
          </div>

          <div className="sg-kpi-card">
            <p className="sg-kpi-label">本日の学習 / 最終日</p>
            <div className="sg-kpi-main">
              <span className="sg-kpi-num">
                <CountUp value={todayMinutes} fromZero duration={650} />
                <span className="sg-kpi-unit">分</span>
              </span>
            </div>
            <p className="sg-kpi-sub">最終：{student.lastStudiedDateKey ?? '未学習'}</p>
          </div>

          <div className="sg-kpi-card" data-tone="gold">
            <p className="sg-kpi-label">
              <CheckCircle2 size={14} aria-hidden="true" />
              今週の宿題消化率
            </p>
            <div className="sg-kpi-main">
              <span className="sg-kpi-num">
                <CountUp value={student.homework.completionRate} fromZero duration={800} />
                <span className="sg-kpi-unit">%</span>
              </span>
              <ScoreRing
                rate={student.homework.completionRate / 100}
                size={42}
                stroke={6}
                tone={
                  student.homework.overdueCount > 0
                    ? 'warn'
                    : student.homework.completionRate >= 80
                      ? 'done'
                      : 'brand'
                }
              />
            </div>
            <p className="sg-kpi-sub">
              {student.homework.completedProblems} / {student.homework.totalProblems} 問完了
            </p>
          </div>

          <div className="sg-kpi-card">
            <p className="sg-kpi-label">直近正答率 / 提出物</p>
            <div className="sg-kpi-main">
              <span className="sg-kpi-num">
                {overallAccuracy !== null ? (
                  <>
                    <CountUp value={overallAccuracy} fromZero duration={800} />
                    <span className="sg-kpi-unit">%</span>
                  </>
                ) : (
                  '—'
                )}
              </span>
              {overallAccuracy !== null && (
                <ScoreRing
                  rate={overallAccuracy / 100}
                  size={42}
                  stroke={6}
                  tone={overallAccuracy >= 75 ? 'done' : 'brand'}
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="sg-skill-pill"
                onClick={onOpenWritingTab}
              >
                <FileEdit size={12} aria-hidden="true" />
                英作文 <b>{student.pendingWritingCount}</b>
              </button>
              <button
                type="button"
                className="sg-skill-pill"
                onClick={onOpenSpeakingTab}
              >
                <Mic size={12} aria-hidden="true" />
                録音 <b>{student.pendingSpeakingCount}</b>
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. 級×技能別 インフォグラフィック内訳（スクショ提出不要化） */}
      <Card>
        <SectionHeader
          title={<KineticText text="級×技能別の学習時間・正答率" />}
          note="どの級のどの分野に何分使い、何％取れているか"
        />

        {student.gradeSkillBreakdown.length === 0 ? (
          <p className="slog-empty">
            <TrendingUp size={24} aria-hidden="true" />
            まだ分野別学習ログがありません。生徒が演習を開始すると自動集計されます。
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {/* 全体比率スタックバー */}
            <SkillRatioStackBar
              items={student.gradeSkillBreakdown.map((g) => ({
                key: g.key,
                skill: g.skill,
                label: g.label,
                seconds: g.weeklySeconds > 0 ? g.weeklySeconds : g.totalSeconds,
              }))}
            />

            <div style={{ display: 'grid', gap: 10 }}>
              {student.gradeSkillBreakdown.map((row) => {
                const basisSec = row.weeklySeconds > 0 ? row.weeklySeconds : row.totalSeconds;
                const barPct = Math.min(
                  100,
                  Math.max(5, Math.round((basisSec / maxSkillWeeklySeconds) * 100)),
                );
                return (
                  <div
                    key={row.key}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--mt-radius-md)',
                      border: '1px solid var(--mt-line)',
                      background: 'var(--mt-surface)',
                      display: 'grid',
                      gap: 7,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                          font: '800 14px/1.3 var(--mt-font-display)',
                          color: 'var(--mt-ink-warm)',
                        }}
                      >
                        <i
                          aria-hidden="true"
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            backgroundColor: SkillColorOf(row.skill),
                            display: 'inline-block',
                          }}
                        />
                        {row.label}
                      </span>

                      <div
                        style={{
                          display: 'inline-flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ color: 'var(--mt-brand)' }}>
                          今週 <b>{formatDurationJa(row.weeklySeconds)}</b>
                        </span>
                        <span style={{ color: 'var(--mt-ink-3)' }}>
                          （累計 {formatDurationJa(row.totalSeconds)}）
                        </span>
                        {row.accuracyPct !== null && (
                          <span className="mo-rate">
                            <ScoreRing
                              rate={row.accuracyPct / 100}
                              size={24}
                              stroke={4}
                              tone={
                                row.accuracyPct >= 75
                                  ? 'done'
                                  : row.accuracyPct < 55
                                    ? 'warn'
                                    : 'brand'
                              }
                            />
                            <b style={{ color: 'var(--mt-ink-warm)' }}>
                              正答率 {row.accuracyPct}%
                            </b>
                            <span style={{ color: 'var(--mt-ink-3)' }}>
                              ({row.correct}/{row.totalQuestions}問)
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* motion.css の .mt-progress > i（0→幅伸長＋光沢シャイン走査） */}
                    <div
                      className="mt-meter mt-progress"
                      data-status={
                        row.accuracyPct !== null && row.accuracyPct >= 75 ? 'done' : 'doing'
                      }
                    >
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
          </div>
        )}
      </Card>

      {/* 4. 直近14日間の日別タイムログ棒グラフ（スプリング成長アニメ） */}
      <Card>
        <SectionHeader
          title={<KineticText text="直近14日の学習リズム" />}
          note="まとめ解き・放置の偏りを検知"
          aside={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={13} aria-hidden="true" />
              単位：分
            </span>
          }
        />

        <div
          className="sg-daily-bars"
          role="img"
          aria-label="直近14日間の日別学習時間グラフ"
        >
          {student.recentDailyLogs.map((day, idx) => {
            const mins = Math.round(day.totalActiveSeconds / 60);
            const heightPct =
              day.totalActiveSeconds > 0
                ? Math.max(10, Math.round((day.totalActiveSeconds / maxDailySeconds) * 100))
                : 0;
            const isToday = day.dateKey === todayKey;
            return (
              <div
                key={day.dateKey}
                className="sg-day-col"
                data-today={isToday ? 'true' : undefined}
                title={`${day.dateKey}: ${mins}分（${day.solvedCount}問）`}
              >
                <span className="sg-day-min">{mins > 0 ? mins : '·'}</span>
                <div className="sg-day-track">
                  {heightPct > 0 && (
                    <div
                      className="sg-day-fill"
                      data-lv={mins >= 35 ? 'high' : undefined}
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

        {/* 日別ログ明細（StudyLog風 .slog-row） */}
        <div className="slog-rows" style={{ marginTop: 14 }}>
          {[...student.recentDailyLogs]
            .reverse()
            .slice(0, 8)
            .map((day) => {
              const entries = Object.entries(day.byGradeSkill).filter(([, s]) => s > 0);
              return (
                <div key={day.dateKey} className="slog-row" style={{ flexWrap: 'wrap' }}>
                  <span>
                    <strong>
                      {day.dateKey}{' '}
                      {day.accuracyPct !== null ? `・正答率 ${day.accuracyPct}%` : ''}
                    </strong>
                    <small>
                      {entries.length === 0
                        ? 'この日の演習記録はありません'
                        : entries
                            .map(
                              ([k, sec]) =>
                                `${parseGradeSkillKey(k).label} ${toMinutesRounded(sec)}分`,
                            )
                            .join(' ／ ')}
                    </small>
                  </span>
                  <b>
                    {day.totalActiveSeconds > 0
                      ? formatDurationJa(day.totalActiveSeconds)
                      : '0分'}
                  </b>
                </div>
              );
            })}
        </div>
      </Card>

      {/* 5. Bottom Sheet：名簿氏名・目標級・担任共有メモの編集シート */}
      <SugorokuBottomSheet
        open={editSheetOpen}
        kicker="STUDENT ROSTER & GOAL"
        title="名簿・目標級・担任メモの編集"
        onClose={() => setEditSheetOpen(false)}
      >
        <div className="slog-form">
          <label className="f">
            <span>塾名簿の表示氏名（管理画面専用・一般公開されません）</span>
            <input
              type="text"
              value={rosterName}
              onChange={(e) => setRosterName(e.target.value)}
            />
          </label>

          <label className="f">
            <span>目標級（S-CBT・本試験ターゲット）</span>
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
            <span>担任・講師共有メモ（志望大学・部活引退時期・声掛け方針）</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <PrimaryButton
              block
              disabled={saving}
              onClick={() => void handleSave()}
              icon={<Save size={16} aria-hidden="true" />}
            >
              {saving ? '保存中…' : isDemoMode ? 'デモ表示に反映する' : 'Firestoreへ保存する'}
            </PrimaryButton>
          </div>
        </div>
      </SugorokuBottomSheet>
    </section>
  );
}
