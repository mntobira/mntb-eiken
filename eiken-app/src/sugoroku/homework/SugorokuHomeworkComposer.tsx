/**
 * ===================================================================
 * 講師用：ペースメーカー型・宿題配信モーダル ＆ プランバッジ群
 * ===================================================================
 *
 * ■ 役割（『03_AI並列開発指示書』AI 2 要件 2）
 *   既存の JukuTab.tsx / classAssignments.ts と 100% 互換を保ちつつ、
 *   1. 『英検2級 / 準2級プラス / 準2級 3か月（12週間）標準ルート』プリセットから
 *      第1週〜第12週をワンタップ選択して自動セットする機能
 *   2. 「今週の範囲（Reading / Listening / 単語・語彙 の自動内訳プレビュー）」と
 *      「1日あたりの推奨問数（日割りペースメーカー：1日まとめ解き＆直前放置防止）」の設定UI
 *   3. クラス全員配信 ⇄ 特定生徒への個別配信（補習・先行進度対応）の切り替え
 *   をマナトビ純正デザイン（丸ゴシック・タップ44px以上・横はみ出しゼロ）で提供する。
 */

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  Flame,
  Headphones,
  Route,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  ASSIGNMENT_MAX_CHAPTERS,
  ASSIGNMENT_TITLE_MAX,
  dueDateToMs,
} from '../../utils/classAssignmentsCore';
import type { StudentRawProgress } from '../../utils/classroom';
import {
  buildWeeklyRoute,
  compactSkillBreakdown,
  countBySkill,
  daysLeftIncludingToday,
  estimateMinutes,
  HOMEWORK_PRESETS,
  parseChapterRef,
  totalProblemsOf,
} from './homeworkCore';
import { DAILY_QUOTA_MAX } from './homeworkStore';
import { allEikenChapterCatalog, chapterIdsOfGrade, chapterTotals } from './chapterTotals';
import type { SugorokuHomeworkPlan, SugorokuSkillBreakdown } from '../shared/types';

function todayPlus(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export interface PacemakerSubmitPayload {
  title: string;
  chapterIds: string[];
  dueDate: string;
  dailyQuotaProblems?: number;
  skillBreakdown?: SugorokuSkillBreakdown;
  targetStudentUids?: string[];
  presetId?: string;
  presetWeek?: number;
  startAt?: number;
}

export function SugorokuHomeworkComposerModal({
  subject,
  catalog,
  students,
  accent,
  onClose,
  onSubmit,
}: {
  subject: string;
  catalog: Array<{ id: string; title: string; totalProblems: number }>;
  students: StudentRawProgress[];
  accent: string;
  onClose: () => void;
  onSubmit: (payload: PacemakerSubmitPayload) => Promise<void>;
}) {
  const [mode, setMode] = useState<'preset' | 'manual'>('preset');
  const defaultPreset = useMemo(
    () => HOMEWORK_PRESETS.find((p) => p.grade === subject)?.id || HOMEWORK_PRESETS[0].id,
    [subject],
  );
  const [presetId, setPresetId] = useState<string>(defaultPreset);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(todayPlus(7));
  const [quotaMode, setQuotaMode] = useState<'auto' | 'custom'>('auto');
  const [customQuota, setCustomQuota] = useState<number>(6);
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [skillFilter, setSkillFilter] = useState<'all' | 'vocab' | 'reading' | 'listening'>('all');
  const [deliveryScope, setDeliveryScope] = useState<'all' | 'selected'>('all');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [appliedPresetTag, setAppliedPresetTag] = useState<{ id: string; week: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !busy) {
        ev.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const allTotals = useMemo(() => {
    const base = { ...chapterTotals() };
    catalog.forEach((c) => {
      if (c.totalProblems > 0) base[c.id] = c.totalProblems;
    });
    return base;
  }, [catalog]);

  const activePreset = useMemo(
    () => HOMEWORK_PRESETS.find((p) => p.id === presetId) || HOMEWORK_PRESETS[0],
    [presetId],
  );

  // プリセットが現在のクラス科目と一致する場合は catalog、別級の場合は索引全体から利用可能単元を取得
  const availableIdsForPreset = useMemo(() => {
    if (activePreset.grade === subject && catalog.length > 0) {
      return catalog.map((c) => c.id);
    }
    return chapterIdsOfGrade(activePreset.grade);
  }, [activePreset.grade, subject, catalog]);

  const weeklyRoutes = useMemo(
    () => buildWeeklyRoute(activePreset.grade, availableIdsForPreset, 12, allTotals),
    [activePreset.grade, availableIdsForPreset, allTotals],
  );

  const currentRoute = weeklyRoutes.find((r) => r.week === selectedWeek) || weeklyRoutes[0];

  const applyRouteWeek = (weekNo: number, targetPresetId = presetId) => {
    const preset = HOMEWORK_PRESETS.find((p) => p.id === targetPresetId) || activePreset;
    const avail =
      preset.grade === subject && catalog.length > 0
        ? catalog.map((c) => c.id)
        : chapterIdsOfGrade(preset.grade);
    const routes = buildWeeklyRoute(preset.grade, avail, 12, allTotals);
    const route = routes.find((r) => r.week === weekNo);
    if (!route) return;
    setSelectedWeek(weekNo);
    const nextTitle = `${preset.shortLabel} ${route.title}`.slice(0, ASSIGNMENT_TITLE_MAX);
    setTitle(nextTitle);
    setPicked(route.chapterIds.slice(0, ASSIGNMENT_MAX_CHAPTERS));
    setQuotaMode('custom');
    setCustomQuota(route.recommendedDailyQuota);
    setAppliedPresetTag({ id: preset.id, week: weekNo });
  };

  const toggleChapter = (id: string) => {
    setAppliedPresetTag(null);
    setPicked((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= ASSIGNMENT_MAX_CHAPTERS
          ? prev
          : [...prev, id],
    );
  };

  const toggleStudent = (uid: string) => {
    setSelectedUids((prev) => (prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]));
  };

  const totalProblems = useMemo(() => totalProblemsOf(picked, allTotals), [picked, allTotals]);
  const skillCounts = useMemo(() => countBySkill(picked, allTotals), [picked, allTotals]);
  const daysCount = useMemo(() => {
    const ms = dueDateToMs(dueDate);
    return Number.isFinite(ms) ? Math.max(1, daysLeftIncludingToday(ms, Date.now())) : 7;
  }, [dueDate]);

  const autoDailyQuota = useMemo(
    () => (totalProblems > 0 ? Math.max(1, Math.min(DAILY_QUOTA_MAX, Math.ceil(totalProblems / daysCount))) : 5),
    [totalProblems, daysCount],
  );
  const effectiveDailyQuota = quotaMode === 'custom' ? Math.max(1, Math.min(DAILY_QUOTA_MAX, customQuota)) : autoDailyQuota;
  const dailyMinutes = estimateMinutes(effectiveDailyQuota);

  const unifiedCatalog = useMemo(() => {
    const allGrades = allEikenChapterCatalog();
    if (allGrades.length > 0) return allGrades;
    return catalog.map((c) => ({ ...c, grade: subject, gradeLabel: '' }));
  }, [catalog, subject]);

  const filteredCatalog = useMemo(() => {
    return unifiedCatalog.filter((c) => {
      if (gradeFilter !== 'all' && c.grade !== gradeFilter) return false;
      if (skillFilter !== 'all' && parseChapterRef(c.id)?.skill !== skillFilter) return false;
      return true;
    });
  }, [unifiedCatalog, gradeFilter, skillFilter]);

  const canSubmit =
    title.trim().length > 0 &&
    picked.length > 0 &&
    (deliveryScope === 'all' || selectedUids.length > 0) &&
    !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        title: title.trim().slice(0, ASSIGNMENT_TITLE_MAX),
        chapterIds: picked.slice(0, ASSIGNMENT_MAX_CHAPTERS),
        dueDate,
        dailyQuotaProblems: effectiveDailyQuota,
        skillBreakdown: compactSkillBreakdown(skillCounts),
        targetStudentUids: deliveryScope === 'selected' ? selectedUids : undefined,
        presetId: appliedPresetTag?.id,
        presetWeek: appliedPresetTag?.week,
        startAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '宿題の配信に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-[#1B2631]/55 backdrop-blur-[2px] sm:p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="ペースメーカー宿題を出す"
      data-testid="sugoroku-homework-composer"
    >
      <div
        className="w-full sm:max-w-xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col bg-[#FFFDF9] rounded-t-3xl sm:rounded-3xl border border-[#E3D9C8] shadow-2xl overflow-hidden"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* ヘッダー */}
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 bg-white border-b border-[#E3D9C8]">
          <div className="min-w-0">
            <span className="block text-xs font-extrabold tracking-wider text-[#2458A6]">
              SUGOROKU PACEMAKER
            </span>
            <h2 className="text-lg font-extrabold text-[#1C2A39] truncate">
              ペースメーカー宿題を配信
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full border border-[#E3D9C8] bg-white text-[#3E4C5B] hover:bg-[#FAF6EE]"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* スクロール本文 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {/* モード切替タブ */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#F2ECE1] border border-[#E3D9C8]" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'preset'}
              onClick={() => setMode('preset')}
              className={`min-h-[44px] px-3 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all ${
                mode === 'preset' ? 'bg-white text-[#1C2A39] shadow-sm' : 'text-[#5A6573]'
              }`}
            >
              <Route className="w-4 h-4 text-[#2458A6] shrink-0" />
              <span>12週標準ルートから選ぶ</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'manual'}
              onClick={() => setMode('manual')}
              className={`min-h-[44px] px-3 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all ${
                mode === 'manual' ? 'bg-white text-[#1C2A39] shadow-sm' : 'text-[#5A6573]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#D97E06] shrink-0" />
              <span>単元を自由に選ぶ</span>
            </button>
          </div>

          {/* プリセット選択パネル */}
          {mode === 'preset' && (
            <section className="rounded-2xl border border-[#D4E2F4] bg-[#F4F8FD] p-3.5 space-y-3">
              <div>
                <span className="block text-xs font-bold text-[#2458A6] mb-1.5">
                  ① ルートテンプレートを選択
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {HOMEWORK_PRESETS.map((preset) => {
                    const active = preset.id === presetId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setPresetId(preset.id);
                          applyRouteWeek(selectedWeek, preset.id);
                        }}
                        className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                          active
                            ? 'bg-[#2458A6] text-white border-[#2458A6]'
                            : 'bg-white text-[#3E4C5B] border-[#C9D8EC] hover:bg-[#EBF2FC]'
                        }`}
                      >
                        {preset.shortLabel}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-[#3E4C5B] leading-relaxed">
                  {activePreset.description}
                </p>
              </div>

              <div>
                <span className="block text-xs font-bold text-[#2458A6] mb-1.5">
                  ② 週を選んでワンタップ反映（全12週）
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {weeklyRoutes.map((r) => {
                    const isPicked = appliedPresetTag?.id === presetId && appliedPresetTag?.week === r.week;
                    const disabled = r.chapterIds.length === 0;
                    return (
                      <button
                        key={r.week}
                        type="button"
                        disabled={disabled}
                        onClick={() => applyRouteWeek(r.week, presetId)}
                        className={`min-h-[44px] px-2.5 py-1.5 rounded-xl border text-left transition-all ${
                          isPicked
                            ? 'bg-[#2458A6] text-white border-[#1C4687] shadow-sm'
                            : 'bg-white text-[#1C2A39] border-[#D4E2F4] hover:border-[#2458A6]'
                        } disabled:opacity-40`}
                      >
                        <span className="flex items-center justify-between text-xs font-extrabold">
                          <span>Week {r.week}</span>
                          {isPicked && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span
                          className={`block text-[12px] truncate ${
                            isPicked ? 'text-blue-100' : 'text-[#5A6573]'
                          }`}
                        >
                          {r.totalProblems > 0 ? `${r.totalProblems}問` : `${r.chapterIds.length}単元`}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {currentRoute && currentRoute.chapterIds.length > 0 && !appliedPresetTag && (
                  <button
                    type="button"
                    onClick={() => applyRouteWeek(currentRoute.week, presetId)}
                    className="mt-2 w-full min-h-[44px] rounded-xl bg-[#2458A6] text-white text-xs font-extrabold hover:bg-[#1C4687] transition-colors"
                  >
                    「{currentRoute.title}」の範囲と推奨ペースをセットする
                  </button>
                )}
              </div>
            </section>
          )}

          {/* 課題タイトル & 締切日 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block sm:col-span-2">
              <span className="block text-xs font-bold text-[#3E4C5B] mb-1">
                宿題タイトル（生徒ホーム最上部に表示）
              </span>
              <input
                value={title}
                maxLength={ASSIGNMENT_TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例）英検2級 第1週 ペースメーカー宿題"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#CBBDA6] bg-white text-sm font-bold text-[#1C2A39] focus:outline-none focus:border-[#2458A6]"
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-1 text-xs font-bold text-[#3E4C5B] mb-1">
                <Calendar className="w-3.5 h-3.5" />
                締切日（あと{daysCount}日）
              </span>
              <input
                type="date"
                value={dueDate}
                min={todayPlus(0)}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#CBBDA6] bg-white text-sm font-bold text-[#1C2A39] focus:outline-none focus:border-[#2458A6]"
              />
            </label>
          </div>

          {/* 1日あたりの推奨ペース設定（ペースメーカーの核） */}
          <section className="rounded-2xl border border-[#E8D5B5] bg-[#FDF6EA] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#8A4B00]">
                <Flame className="w-4 h-4 text-[#D97E06]" />
                1日あたりの推奨ペース（まとめ解き防止）
              </span>
              <div className="inline-flex rounded-lg bg-white border border-[#E3D9C8] p-0.5">
                <button
                  type="button"
                  onClick={() => setQuotaMode('auto')}
                  className={`min-h-[32px] px-2.5 rounded-md text-xs font-bold ${
                    quotaMode === 'auto' ? 'bg-[#2458A6] text-white' : 'text-[#5A6573]'
                  }`}
                >
                  日数から自動
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuotaMode('custom');
                    if (customQuota <= 0) setCustomQuota(autoDailyQuota);
                  }}
                  className={`min-h-[32px] px-2.5 rounded-md text-xs font-bold ${
                    quotaMode === 'custom' ? 'bg-[#2458A6] text-white' : 'text-[#5A6573]'
                  }`}
                >
                  問数を指定
                </button>
              </div>
            </div>

            {quotaMode === 'custom' ? (
              <div className="flex flex-wrap items-center gap-2">
                {[3, 5, 8, 10, 15].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCustomQuota(n)}
                    className={`min-h-[44px] px-3 rounded-xl text-xs font-extrabold border ${
                      customQuota === n
                        ? 'bg-[#D97E06] text-white border-[#B35C00]'
                        : 'bg-white text-[#3E4C5B] border-[#E3D9C8]'
                    }`}
                  >
                    1日 {n}問
                  </button>
                ))}
                <label className="inline-flex items-center gap-1.5 ml-auto text-xs font-bold text-[#3E4C5B]">
                  <span>任意:</span>
                  <input
                    type="number"
                    min={1}
                    max={DAILY_QUOTA_MAX}
                    value={customQuota}
                    onChange={(e) => setCustomQuota(Math.max(1, Math.min(DAILY_QUOTA_MAX, Number(e.target.value) || 1)))}
                    className="w-16 min-h-[40px] px-2 rounded-xl border border-[#CBBDA6] bg-white text-center text-sm font-extrabold text-[#1C2A39]"
                  />
                  <span>問/日</span>
                </label>
              </div>
            ) : (
              <p className="text-xs text-[#5A6573]">
                合計 <strong>{totalProblems}</strong> 問 ÷ 残り <strong>{daysCount}</strong> 日 ＝ 生徒のホーム画面で{' '}
                <strong className="text-[#8A4B00]">1日 {effectiveDailyQuota} 問（目安 {dailyMinutes}分）</strong> ずつ案内します。
              </p>
            )}

            {/* 技能別内訳サマリーバッジ */}
            {picked.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#EFE2CA]">
                <span className="text-xs font-bold text-[#5A6573] mr-1">今週の内訳:</span>
                {skillCounts.vocab > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-[#E3D9C8] text-xs font-bold text-[#1C2A39]">
                    単語・短文語彙 {skillCounts.vocab}問
                  </span>
                )}
                {skillCounts.reading > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-[#E3D9C8] text-xs font-bold text-[#2458A6]">
                    <BookOpen className="w-3 h-3" />
                    リーディング {skillCounts.reading}問
                  </span>
                )}
                {skillCounts.listening > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-[#E3D9C8] text-xs font-bold text-[#1F7A4D]">
                    <Headphones className="w-3 h-3" />
                    リスニング {skillCounts.listening}問
                  </span>
                )}
                <span className="ml-auto text-xs font-extrabold text-[#1C2A39]">
                  計 {totalProblems}問（1日目安 {dailyMinutes}分）
                </span>
              </div>
            )}
          </section>

          {/* 単元選択リスト（全級5級〜1級から自由選択可能） */}
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#3E4C5B]">
                出題単元・全級対応（{picked.length}/{ASSIGNMENT_MAX_CHAPTERS} 単元選択中）
              </span>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'all', label: '全級' },
                    { id: 'eiken_2', label: '2級' },
                    { id: 'eiken_pre2plus', label: '準2+' },
                    { id: 'eiken_pre2', label: '準2級' },
                    { id: 'eiken_3', label: '3級' },
                    { id: 'eiken_4', label: '4級' },
                    { id: 'eiken_5', label: '5級' },
                    { id: 'eiken_pre1', label: '準1級' },
                    { id: 'eiken_1', label: '1級' },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGradeFilter(g.id)}
                    className={`min-h-[28px] px-2 rounded-lg text-xs font-bold border ${
                      gradeFilter === g.id
                        ? 'bg-[#2458A6] text-white border-[#2458A6]'
                        : 'bg-white text-[#5A6573] border-[#E3D9C8]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: 'all', label: 'すべての分野' },
                  { id: 'vocab', label: '語彙・大問1' },
                  { id: 'reading', label: '長文読解' },
                  { id: 'listening', label: 'リスニング' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSkillFilter(f.id)}
                  className={`min-h-[32px] px-2.5 rounded-lg text-xs font-bold border ${
                    skillFilter === f.id
                      ? 'bg-[#1C2A39] text-white border-[#1C2A39]'
                      : 'bg-white text-[#5A6573] border-[#E3D9C8]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="max-h-44 overflow-y-auto rounded-2xl border border-[#E3D9C8] bg-white p-2.5">
              <div className="flex flex-wrap gap-1.5">
                {filteredCatalog.map((c) => {
                  const on = picked.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleChapter(c.id)}
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors text-left ${
                        on
                          ? 'text-white border-transparent shadow-sm'
                          : 'border-[#E3D9C8] bg-[#FAF8F4] text-[#3E4C5B] hover:bg-[#F2ECE1]'
                      }`}
                      style={on ? { backgroundColor: accent } : undefined}
                    >
                      {c.title}
                      <span className={`ml-1 text-[12px] ${on ? 'opacity-90' : 'text-[#5A6573]'}`}>
                        ({c.totalProblems}問)
                      </span>
                    </button>
                  );
                })}
                {filteredCatalog.length === 0 && (
                  <p className="text-xs text-[#5A6573] py-3 px-2">該当する単元がありません。</p>
                )}
              </div>
            </div>
          </section>

          {/* 配信対象（クラス全員 or 個別生徒指定） */}
          {students.length > 0 && (
            <section className="rounded-2xl border border-[#E3D9C8] bg-white p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3E4C5B]">
                  <Users className="w-4 h-4 text-[#2458A6]" />
                  配信対象
                </span>
                <div className="inline-flex rounded-lg bg-[#F2ECE1] p-0.5">
                  <button
                    type="button"
                    onClick={() => setDeliveryScope('all')}
                    className={`min-h-[32px] px-2.5 rounded-md text-xs font-bold ${
                      deliveryScope === 'all' ? 'bg-white text-[#1C2A39] shadow-sm' : 'text-[#5A6573]'
                    }`}
                  >
                    塾生全員（{students.length}名）
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryScope('selected')}
                    className={`min-h-[32px] px-2.5 rounded-md text-xs font-bold ${
                      deliveryScope === 'selected' ? 'bg-white text-[#1C2A39] shadow-sm' : 'text-[#5A6573]'
                    }`}
                  >
                    個別指定
                  </button>
                </div>
              </div>
              {deliveryScope === 'selected' && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {students.map((s) => {
                    const checked = selectedUids.includes(s.uid);
                    return (
                      <button
                        key={s.uid}
                        type="button"
                        aria-pressed={checked}
                        onClick={() => toggleStudent(s.uid)}
                        className={`min-h-[38px] px-3 rounded-xl text-xs font-bold border ${
                          checked
                            ? 'bg-[#2458A6] text-white border-[#2458A6]'
                            : 'bg-[#FAF8F4] text-[#3E4C5B] border-[#E3D9C8]'
                        }`}
                      >
                        {s.displayName}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-[#FDECEA] border border-[#F5C6C0] text-xs font-bold text-[#96342B]">
              {error}
            </div>
          )}
        </div>

        {/* フッターボタン */}
        <footer className="shrink-0 flex items-center gap-2.5 px-5 pt-3.5 pb-[calc(0.9rem+env(safe-area-inset-bottom,0px))] bg-white border-t border-[#E3D9C8]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] px-4 rounded-xl text-sm font-bold border border-[#E3D9C8] text-[#3E4C5B] hover:bg-[#FAF6EE]"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className="flex-1 min-h-[46px] px-5 rounded-xl text-sm font-extrabold text-white shadow-sm transition-transform active:scale-[0.99] disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {busy
              ? '生徒のトップ画面へ配信中…'
              : `このペース（1日${effectiveDailyQuota}問）で宿題を出す`}
          </button>
        </footer>
      </div>
    </div>
  );
}

/** JukuTab の課題一覧カード内に表示するペースメーカー設定バッジ列 */
export function SugorokuPlanBadges({ plan }: { plan: SugorokuHomeworkPlan | null | undefined }) {
  if (!plan) return null;
  const hasInfo =
    Boolean(plan.dailyQuotaProblems) ||
    Boolean(plan.presetId) ||
    Boolean(plan.targetStudentUids && plan.targetStudentUids.length > 0);
  if (!hasInfo) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {typeof plan.dailyQuotaProblems === 'number' && plan.dailyQuotaProblems > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FDF0DB] border border-[#F2D4A7] text-xs font-bold text-[#8A4B00]">
          <Flame className="w-3 h-3 text-[#D97E06]" />
          推奨ペース 1日{plan.dailyQuotaProblems}問
        </span>
      )}
      {plan.presetId && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E7EEF8] border border-[#C6D8F0] text-xs font-bold text-[#2458A6]">
          <Route className="w-3 h-3" />
          12週ルート{plan.presetWeek ? ` W${plan.presetWeek}` : ''}
        </span>
      )}
      {plan.targetStudentUids && plan.targetStudentUids.length > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EEF0F2] border border-[#D5D9DF] text-xs font-bold text-[#3E4C5B]">
          <Users className="w-3 h-3" />
          個別配信（{plan.targetStudentUids.length}名）
        </span>
      )}
    </div>
  );
}
