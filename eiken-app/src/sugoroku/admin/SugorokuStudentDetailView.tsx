/**
 * ===================================================================
 * すごろく塾管理者ポータル：個人別ドリルダウン詳細画面
 * ===================================================================
 * 生徒1名を選択した際に表示される詳細ビュー：
 *   - 実名（rosterName）・目標級・指導メモのインライン編集（デモ/Firestore両対応）
 *   - 直近14日間の日別有効学習時間棒グラフ＆日別カレンダー（1分無操作除外済）
 *   - 「級×技能別（例：英検2級 リスニング 45分、2級 単語・語彙 30分）」の内訳＆正答率推移バー
 *   - 面談・保護者共有用の個人別CSV出力ボタン
 */

import { useState } from 'react';
import {
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Save,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import {
  buildSugorokuStudentDetailCsv,
  formatDurationJa,
  getGradeLabel,
  parseGradeSkillKey,
  toMinutesRounded,
  type SugorokuStudentOverview,
} from './adminAnalytics';

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
}

export function SugorokuStudentDetailView({
  student,
  isDemoMode,
  onBack,
  onSaveProfile,
  onOpenWritingTab,
  onOpenSpeakingTab,
}: SugorokuStudentDetailViewProps) {
  const [editing, setEditing] = useState(false);
  const [rosterName, setRosterName] = useState(student.rosterName);
  const [targetGrade, setTargetGrade] = useState<EikenGrade>(student.targetGrade);
  const [note, setNote] = useState(student.note || '');
  const [saving, setSaving] = useState(false);

  const maxDailySeconds = Math.max(
    1800, // 最低スケール30分
    ...student.recentDailyLogs.map((d) => d.totalActiveSeconds),
  );

  const maxSkillWeeklySeconds = Math.max(
    900,
    ...student.gradeSkillBreakdown.map((g) => g.weeklySeconds),
  );

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
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label={`${student.rosterName}の個人別学習ログ詳細`} className="space-y-4">
      {/* 上部ナビ＋CSV出力 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#D5D1C8] bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-[#1B2631] hover:bg-[#F8F6F1]"
        >
          <ArrowLeft className="w-4 h-4" />
          塾生一覧へ戻る
        </button>

        <button
          type="button"
          onClick={handleExportStudentCsv}
          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#16794F] px-3.5 py-2 text-xs sm:text-sm font-bold text-white hover:bg-[#12623F]"
        >
          <Download className="w-4 h-4 shrink-0" />
          面談・保護者報告用CSV出力
        </button>
      </div>

      {/* 生徒プロフィール＆KPIサマリーカード */}
      <div className="rounded-2xl border border-[#E2DDD2] bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF5FF] px-2.5 py-0.5 text-xs font-bold text-[#1D58A8]">
                <Award className="w-3.5 h-3.5" />
                目標：{getGradeLabel(student.targetGrade)}
              </span>
              {student.adFree && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF7F0] px-2.5 py-0.5 text-[11px] font-bold text-[#16794F]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  塾生Ad-Free適用中
                </span>
              )}
              {student.alerts.map((al) => (
                <span
                  key={al.reason}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    al.severity === 'critical'
                      ? 'bg-[#FDECEA] text-[#B42318] border border-[#F5C6C0]'
                      : 'bg-[#FEF3D6] text-[#945608] border border-[#F3D285]'
                  }`}
                >
                  {al.label}
                </span>
              ))}
            </div>

            {!editing ? (
              <>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#1B2631] break-words">
                  {student.rosterName}
                </h2>
                {student.nickname && (
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    アプリ内公開ニックネーム：{student.nickname}（※本名は塾管理画面のみ表示）
                  </p>
                )}
                {student.note && (
                  <p className="mt-2 rounded-xl bg-[#FDFBF7] border border-[#ECE8DE] px-3 py-2 text-xs sm:text-sm text-[#374151] leading-relaxed">
                    指導メモ：{student.note}
                  </p>
                )}
              </>
            ) : (
              <div className="mt-2 space-y-2.5 rounded-xl bg-[#F8F6F1] p-3 border border-[#E2DDD2]">
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    塾名簿の表示氏名（管理画面専用・公開されません）
                  </label>
                  <input
                    type="text"
                    value={rosterName}
                    onChange={(e) => setRosterName(e.target.value)}
                    className="w-full min-h-[38px] rounded-lg border border-[#D5D1C8] bg-white px-3 py-1.5 text-sm text-[#1B2631]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">目標級</label>
                  <select
                    value={targetGrade}
                    onChange={(e) => setTargetGrade(e.target.value as EikenGrade)}
                    className="w-full sm:w-56 min-h-[38px] rounded-lg border border-[#D5D1C8] bg-white px-3 py-1.5 text-sm text-[#1B2631]"
                  >
                    {[...EIKEN_GRADES].reverse().map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    担任・講師共有メモ（志望校・S-CBT受験予定月・部活引退時期など）
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-lg border border-[#D5D1C8] bg-white px-3 py-1.5 text-xs sm:text-sm text-[#1B2631]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSave()}
                    className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[#1D58A8] px-3.5 py-1.5 text-xs font-bold text-white"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? '保存中…' : isDemoMode ? 'デモ表示に反映' : '保存する'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="min-h-[36px] rounded-lg border border-[#D5D1C8] bg-white px-3 py-1.5 text-xs font-bold text-[#4B5563]"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>

          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="self-start min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-[#D5D1C8] bg-[#FDFBF7] px-3 py-1.5 text-xs font-bold text-[#374151] hover:bg-[#F1EFE9] shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5" />
              名簿・目標級を編集
            </button>
          )}
        </div>

        {/* 4枚の数値サマリー（スマホ2×2 / PC 4列） */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-[#F8F6F1] p-3 border border-[#EAE6DC]">
            <p className="text-[11px] font-semibold text-[#6B7280] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#1D58A8]" />
              今週の有効学習時間
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-[#1B2631] mt-1">
              {formatDurationJa(student.weeklyActiveSeconds)}
            </p>
            <p className="text-[11px] text-[#6B7280]">1分無操作は自動除外済</p>
          </div>

          <div className="rounded-xl bg-[#F8F6F1] p-3 border border-[#EAE6DC]">
            <p className="text-[11px] font-semibold text-[#6B7280]">本日の学習 / 最終学習日</p>
            <p className="text-lg sm:text-xl font-extrabold text-[#1B2631] mt-1">
              {formatDurationJa(student.todayActiveSeconds)}
            </p>
            <p className="text-[11px] text-[#6B7280]">
              最終：{student.lastStudiedDateKey ?? '未学習'}
            </p>
          </div>

          <div className="rounded-xl bg-[#F8F6F1] p-3 border border-[#EAE6DC]">
            <p className="text-[11px] font-semibold text-[#6B7280] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16794F]" />
              今週の宿題消化率
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-[#1B2631] mt-1">
              {student.homework.completionRate}%
            </p>
            <p className="text-[11px] text-[#6B7280]">
              {student.homework.completedProblems} / {student.homework.totalProblems} 問完了
            </p>
          </div>

          <div className="rounded-xl bg-[#F8F6F1] p-3 border border-[#EAE6DC]">
            <p className="text-[11px] font-semibold text-[#6B7280]">提出物の未添削確認</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={onOpenWritingTab}
                className="rounded-lg bg-white border border-[#D5D1C8] px-2 py-1 text-xs font-bold text-[#1D58A8] hover:bg-[#EEF5FF]"
              >
                英作文 {student.pendingWritingCount}件
              </button>
              <button
                type="button"
                onClick={onOpenSpeakingTab}
                className="rounded-lg bg-white border border-[#D5D1C8] px-2 py-1 text-xs font-bold text-[#16794F] hover:bg-[#EAF7F0]"
              >
                面接録音 {student.pendingSpeakingCount}件
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 級×技能別の学習時間・正答率内訳（西様最優先要望：スクショ提出不要化） */}
      <div className="rounded-2xl border border-[#E2DDD2] bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base font-bold text-[#1B2631] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#1D58A8] shrink-0" />
              級×技能別の学習時間・正答率内訳
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              「英検何級の・どの分野（リスニング／リーディング／単語／英作文／スピーキング）に何分使い、何％正解しているか」を自動集計しています。
            </p>
          </div>
        </div>

        {student.gradeSkillBreakdown.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#6B7280]">
            まだ分野別学習ログがありません。生徒が演習を開始すると自動で記録されます。
          </p>
        ) : (
          <div className="space-y-3">
            {student.gradeSkillBreakdown.map((row) => {
              const barPct = Math.min(
                100,
                Math.max(4, Math.round((row.weeklySeconds / maxSkillWeeklySeconds) * 100)),
              );
              return (
                <div
                  key={row.key}
                  className="rounded-xl border border-[#ECE8DE] bg-[#FDFBF7] p-3 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#1B2631]">{row.label}</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-extrabold text-[#1D58A8]">
                        今週 {formatDurationJa(row.weeklySeconds)}
                      </span>
                      <span className="text-[#6B7280]">
                        （直近累計 {formatDurationJa(row.totalSeconds)}）
                      </span>
                      {row.accuracyPct !== null && (
                        <span
                          className={`rounded-md px-2 py-0.5 font-bold ${
                            row.accuracyPct >= 75
                              ? 'bg-[#EAF7F0] text-[#16794F]'
                              : row.accuracyPct >= 55
                                ? 'bg-[#EEF5FF] text-[#1D58A8]'
                                : 'bg-[#FDECEA] text-[#B42318]'
                          }`}
                        >
                          正答率 {row.accuracyPct}%（{row.correct}/{row.totalQuestions}問）
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-[#E8E4DA] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#1D58A8] transition-all"
                      style={{ width: `${row.weeklySeconds > 0 ? barPct : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 直近14日間の日別タイムログ棒グラフ＆日別テーブル */}
      <div className="rounded-2xl border border-[#E2DDD2] bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-[#1B2631] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#16794F] shrink-0" />
            直近14日間の日別学習カレンダー（まとめ解き・放置検知）
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            授業前日のまとめ解きになっていないか、部活日でも10〜15分触れられているかを一目で確認できます。
          </p>
        </div>

        {/* 14日ミニ棒グラフ（スマホでも横スクロール不要の14分割グリッド） */}
        <div
          className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 pt-2 pb-1 items-end"
          role="img"
          aria-label="直近14日間の日別学習時間グラフ"
        >
          {student.recentDailyLogs.map((day) => {
            const mins = Math.round(day.totalActiveSeconds / 60);
            const heightPct =
              day.totalActiveSeconds > 0
                ? Math.max(12, Math.round((day.totalActiveSeconds / maxDailySeconds) * 100))
                : 0;
            return (
              <div
                key={day.dateKey}
                className="flex flex-col items-center gap-1 min-w-0"
                title={`${day.dateKey}: ${mins}分（${day.solvedCount}問）`}
              >
                <span className="text-[10px] font-bold text-[#4B5563]">
                  {mins > 0 ? `${mins}m` : '-'}
                </span>
                <div className="w-full h-20 rounded-lg bg-[#F3F1EC] flex items-end p-0.5 overflow-hidden">
                  {heightPct > 0 && (
                    <div
                      className="w-full rounded-md bg-[#16794F]"
                      style={{ height: `${heightPct}%` }}
                    />
                  )}
                </div>
                <span className="text-[10px] text-[#6B7280] truncate max-w-full">
                  {day.shortDate}
                </span>
              </div>
            );
          })}
        </div>

        {/* 日別内訳リスト（学習があった日を中心に降順表示） */}
        <div className="space-y-2 pt-2 border-t border-[#F1EFE9]">
          {[...student.recentDailyLogs]
            .reverse()
            .slice(0, 10)
            .map((day) => {
              const entries = Object.entries(day.byGradeSkill).filter(([, s]) => s > 0);
              return (
                <div
                  key={day.dateKey}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 rounded-xl bg-[#FDFBF7] border border-[#ECE8DE] px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-[#1B2631]">{day.dateKey}</span>
                    <span
                      className={`font-bold ${
                        day.totalActiveSeconds > 0 ? 'text-[#16794F]' : 'text-[#9CA3AF]'
                      }`}
                    >
                      {day.totalActiveSeconds > 0
                        ? formatDurationJa(day.totalActiveSeconds)
                        : '未学習（0分）'}
                    </span>
                    {day.solvedCount > 0 && (
                      <span className="text-[#4B5563]">{day.solvedCount}問解答</span>
                    )}
                    {day.accuracyPct !== null && (
                      <span className="rounded bg-[#EEF5FF] px-1.5 py-0.5 font-bold text-[#1D58A8]">
                        正答率 {day.accuracyPct}%
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-[#4B5563]">
                    {entries.length === 0 ? (
                      <span className="text-[#9CA3AF]">記録なし</span>
                    ) : (
                      entries.map(([k, sec]) => (
                        <span
                          key={k}
                          className="rounded-md bg-white border border-[#E2DDD2] px-2 py-0.5"
                        >
                          {parseGradeSkillKey(k).label}：{toMinutesRounded(sec)}分
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </section>
  );
}
