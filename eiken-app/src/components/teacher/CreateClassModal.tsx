import { useEffect, useMemo, useState } from 'react';
import { X, Sparkles, Clock, CalendarDays, Target, ShieldCheck, Check } from 'lucide-react';
import { type ClassroomDoc } from '../../utils/classroomCore';
import { subjectTheme } from '../../data/subjectTheme';
import {
  CLASSROOM_ALLOWED_SUBJECTS,
  DAILY_GOAL_OPTIONS,
  EXAM_SESSION_OPTIONS,
  FOCUS_SKILL_OPTIONS,
  JUKU_COURSE_PRESETS,
  ORG_TYPE_OPTIONS,
  WEEKLY_DAYS_OPTIONS,
  type ClassOrgType,
  type ExamSessionTarget,
  type JukuClassSettings,
} from '../../sugoroku/admin/classroomSettings';
import type { SugorokuSkillKey } from '../../sugoroku/shared/types';

// ============================================================================
// クラス作成・編集モーダル（塾・英語スクール・学校 対応 / モバイル完全対応）
// ============================================================================

export interface ClassFormValues {
  schoolName: string;
  className: string;
  subject: ClassroomDoc['subject'];
  joinOpen: boolean;
  orgType: ClassOrgType;
  dailyGoalMinutes: number;
  weeklyGoalDays: number;
  examSession: ExamSessionTarget;
  focusSkills: SugorokuSkillKey[];
  coachNote: string;
}

interface ClassFormModalProps {
  mode: 'create' | 'edit';
  initialValues: ClassFormValues;
  submitting: boolean;
  accent: string;
  joinCode?: string;
  isJukuPlanActive?: boolean;
  onClose: () => void;
  onSubmit: (values: ClassFormValues) => void;
}

export function ClassFormModal({
  mode,
  initialValues,
  submitting,
  accent,
  joinCode,
  isJukuPlanActive = true,
  onClose,
  onSubmit,
}: ClassFormModalProps) {
  const [orgType, setOrgType] = useState<ClassOrgType>(initialValues.orgType);
  const [schoolName, setSchoolName] = useState(initialValues.schoolName);
  const [className, setClassName] = useState(initialValues.className);
  const [subject, setSubject] = useState<ClassroomDoc['subject']>(initialValues.subject);
  const [joinOpen, setJoinOpen] = useState(initialValues.joinOpen);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(initialValues.dailyGoalMinutes);
  const [weeklyGoalDays, setWeeklyGoalDays] = useState(initialValues.weeklyGoalDays);
  const [examSession, setExamSession] = useState<ExamSessionTarget>(initialValues.examSession);
  const [focusSkills, setFocusSkills] = useState<SugorokuSkillKey[]>(initialValues.focusSkills);
  const [coachNote, setCoachNote] = useState(initialValues.coachNote);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, submitting]);

  const activeOrgMeta = useMemo(
    () => ORG_TYPE_OPTIONS.find((o) => o.value === orgType) ?? ORG_TYPE_OPTIONS[0],
    [orgType],
  );

  const selectedTheme = subjectTheme(subject);
  const effectiveAccent = selectedTheme.accent || accent;
  const weeklyTotalMinutes = dailyGoalMinutes * weeklyGoalDays;

  const effectiveClassName =
    className.trim() ||
    (mode === 'create' && orgType === 'juku' ? '全級一括コース（英検5級〜1級）' : '');

  const canSubmit =
    schoolName.trim().length > 0 &&
    effectiveClassName.length > 0 &&
    focusSkills.length > 0 &&
    !submitting;

  const applyPreset = (presetId: string) => {
    const preset = JUKU_COURSE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setClassName(preset.className);
    setSubject(preset.subject);
    setDailyGoalMinutes(preset.dailyGoalMinutes);
    setWeeklyGoalDays(preset.weeklyGoalDays);
    setExamSession(preset.examSession);
    setFocusSkills([...preset.focusSkills]);
    if (!coachNote.trim()) {
      setCoachNote(preset.coachNote);
    }
  };

  const toggleSkill = (skill: SugorokuSkillKey) => {
    setFocusSkills((prev) => {
      if (prev.includes(skill)) {
        if (prev.length <= 1) return prev; // 最低1つは残す
        return prev.filter((k) => k !== skill);
      }
      return [...prev, skill];
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      schoolName: schoolName.trim(),
      className: effectiveClassName,
      subject,
      joinOpen,
      orgType,
      dailyGoalMinutes,
      weeklyGoalDays,
      examSession,
      focusSkills,
      coachNote: coachNote.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-[#1B2631]/55 backdrop-blur-[2px] sm:p-4"
      onClick={() => {
        if (!submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="class-modal-title"
    >
      <form
        onSubmit={handleFormSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl max-h-[92dvh] sm:max-h-[88dvh] bg-[#FDFBF7] rounded-t-3xl sm:rounded-3xl border border-[#E0E1DD] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* 固定ヘッダー */}
        <div className="shrink-0 bg-white border-b border-[#ECE9E1] px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="class-modal-title" className="text-lg font-extrabold text-[#1B2631]">
                {mode === 'create' ? '新しいコース・クラスを開設' : 'コース・クラス設定の編集'}
              </h2>
              {isJukuPlanActive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E8F6F4] text-[#236B63] border border-[#B5E2DC]">
                  <ShieldCheck className="w-3 h-3" />
                  塾プラン対応
                </span>
              )}
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {mode === 'create'
                ? '作成後に「招待URL」「6文字コード」「LINE案内文」がすぐ発行されます。設定はいつでも変更できます。'
                : `招待コード ${joinCode || ''} はそのまま維持して、コース名・目標級・学習時間目標を更新できます。`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="閉じる"
            className="shrink-0 w-9 h-9 rounded-full border border-[#E0E1DD] bg-[#FAF8F2] text-[#4B5563] hover:bg-[#F1EFE9] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* スクロール可能な設定ボディ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* 1. 運営形態の選択（塾がデフォルト） */}
          <section>
            <span className="block text-xs font-extrabold text-[#374151] mb-2">
              1. 運営スタイル
            </span>
            <div className="grid grid-cols-3 gap-2">
              {ORG_TYPE_OPTIONS.map((opt) => {
                const active = orgType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOrgType(opt.value)}
                    className={`px-2.5 py-2.5 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-white border-[#3E9C93] ring-2 ring-[#3E9C93]/20 shadow-sm'
                        : 'bg-white/70 border-[#E0E1DD] hover:bg-white text-[#4B5563]'
                    }`}
                  >
                    <span
                      className={`block text-xs font-extrabold leading-snug ${
                        active ? 'text-[#1B2631]' : 'text-[#4B5563]'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[#6B7280] mt-1.5">{activeOrgMeta.description}</p>
          </section>

          {/* クイックコーステンプレート（新規作成時または塾モード時） */}
          {mode === 'create' && orgType !== 'school' && (
            <section className="bg-white rounded-2xl border border-[#E6E3DA] p-3.5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1B2631]">
                  <Sparkles className="w-3.5 h-3.5 text-[#3E9C93]" />
                  ワンタップ定番コース設定（選ぶと自動入力・編集可）
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {JUKU_COURSE_PRESETS.map((preset) => {
                  const active = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-[#F0FAF8] border-[#3E9C93] text-[#1B2631]'
                          : 'bg-[#FAF8F2] border-[#E5E2D9] hover:bg-white text-[#374151]'
                      }`}
                    >
                      <span className="block text-[10px] font-bold text-[#2F7C74]">
                        {preset.badge}
                      </span>
                      <span className="block text-xs font-bold mt-0.5">{preset.label}</span>
                      <span className="block text-[10px] text-[#6B7280] mt-0.5">
                        1日{preset.dailyGoalMinutes}分×週{preset.weeklyGoalDays}日
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 2. 塾・教室名 ＆ コース名 */}
          <section className="bg-white rounded-2xl border border-[#E6E3DA] p-4 space-y-3.5">
            <span className="block text-xs font-extrabold text-[#374151]">
              2. 基本情報（あとからいつでも変更可能）
            </span>
            <label className="block">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#374151]">{activeOrgMeta.orgFieldLabel}</span>
                <span className="text-[11px] text-[#9BA3AE]">{schoolName.length}/40</span>
              </div>
              <input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                maxLength={40}
                placeholder={activeOrgMeta.orgPlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#C9D2DA] bg-[#FDFBF7] focus:bg-white text-sm text-[#1B2631] focus:outline-none focus:border-[#3E9C93] focus:ring-2 focus:ring-[#3E9C93]/15"
              />
              <span className="block text-[11px] text-[#6B7280] mt-1">
                参加した生徒のホーム画面上部にも所属ブランド名として表示されます。
              </span>
            </label>

            <label className="block">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#374151]">
                  {activeOrgMeta.classFieldLabel}
                </span>
                <span className="text-[11px] text-[#9BA3AE]">{className.length}/40</span>
              </div>
              <input
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                maxLength={40}
                placeholder={activeOrgMeta.classPlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#C9D2DA] bg-[#FDFBF7] focus:bg-white text-sm text-[#1B2631] focus:outline-none focus:border-[#3E9C93] focus:ring-2 focus:ring-[#3E9C93]/15"
              />
            </label>
          </section>

          {/* 3. 目標級・ターゲット検定回 */}
          <section className="bg-white rounded-2xl border border-[#E6E3DA] p-4 space-y-3.5">
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#374151]">
              <Target className="w-3.5 h-3.5 text-[#3E9C93]" />
              3. 目標級・ターゲット検定回
            </span>

            <div>
              <span className="block text-xs font-bold text-[#4B5563] mb-2">メイン対象級</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CLASSROOM_ALLOWED_SUBJECTS.map((option) => {
                  const selected = subject === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSubject(option.value)}
                      className={`px-3 py-2 rounded-xl border text-left transition-all ${
                        selected
                          ? 'bg-[#EBF8F6] border-[#3E9C93] ring-1 ring-[#3E9C93]/30'
                          : 'bg-[#FDFBF7] border-[#E0E1DD] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-extrabold ${
                            selected ? 'text-[#1F635B]' : 'text-[#1B2631]'
                          }`}
                        >
                          {option.label}
                        </span>
                        {selected && <Check className="w-3.5 h-3.5 text-[#2F7C74]" />}
                      </div>
                      <span className="block text-[10px] text-[#6B7280] mt-0.5 truncate">
                        {option.shortDesc}
                      </span>
                    </button>
                  );
                })}
              </div>
              <span className="block text-[11px] text-[#6B7280] mt-1.5">
                ※ 生徒ごとに異なる目標級（1級〜5級）を個別設定することも可能です。
              </span>
            </div>

            <div>
              <span className="block text-xs font-bold text-[#4B5563] mb-1.5">
                目標とする検定回・受験方式
              </span>
              <select
                value={examSession}
                onChange={(e) => setExamSession(e.target.value as ExamSessionTarget)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#C9D2DA] bg-[#FDFBF7] text-sm text-[#1B2631] focus:outline-none focus:border-[#3E9C93]"
              >
                {EXAM_SESSION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* 4. 学習ペース目標・重点分野 */}
          <section className="bg-white rounded-2xl border border-[#E6E3DA] p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#374151]">
                <Clock className="w-3.5 h-3.5 text-[#3E9C93]" />
                4. 学習ペース基準・重点スキル
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#F0FAF8] text-[#236B63] border border-[#CBECE7]">
                週目標 {weeklyTotalMinutes}分（{(weeklyTotalMinutes / 60).toFixed(1).replace(/\.0$/, '')}時間）
              </span>
            </div>

            <div>
              <span className="block text-xs font-bold text-[#4B5563] mb-1.5">
                1日あたりの目標学習時間
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {DAILY_GOAL_OPTIONS.map((mins) => {
                  const selected = dailyGoalMinutes === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDailyGoalMinutes(mins)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        selected
                          ? 'bg-[#3E9C93] text-white border-[#3E9C93] shadow-sm'
                          : 'bg-[#FDFBF7] text-[#4B5563] border-[#E0E1DD] hover:bg-white'
                      }`}
                    >
                      {mins}分
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="flex items-center gap-1 text-xs font-bold text-[#4B5563] mb-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-[#6B7280]" />
                週の目標学習日数（まとめ解き防止の基準）
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {WEEKLY_DAYS_OPTIONS.map((days) => {
                  const selected = weeklyGoalDays === days;
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setWeeklyGoalDays(days)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        selected
                          ? 'bg-[#1B2631] text-white border-[#1B2631] shadow-sm'
                          : 'bg-[#FDFBF7] text-[#4B5563] border-[#E0E1DD] hover:bg-white'
                      }`}
                    >
                      {days === 7 ? '毎日' : `週${days}日`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-[#4B5563] mb-1.5">
                重点指導する技能（複数選択）
              </span>
              <div className="flex flex-wrap gap-1.5">
                {FOCUS_SKILL_OPTIONS.map((skill) => {
                  const active = focusSkills.includes(skill.key);
                  return (
                    <button
                      key={skill.key}
                      type="button"
                      onClick={() => toggleSkill(skill.key)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        active
                          ? 'bg-[#EBF8F6] border-[#3E9C93] text-[#1F635B]'
                          : 'bg-[#FDFBF7] border-[#E0E1DD] text-[#6B7280] hover:bg-white'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                      {skill.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#4B5563]">
                  指導メモ・招待メッセージ添え書き（任意）
                </span>
                <span className="text-[11px] text-[#9BA3AE]">{coachNote.length}/200</span>
              </div>
              <textarea
                value={coachNote}
                onChange={(e) => setCoachNote(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="例）毎週金曜の授業までに単語20分＋リスニング10分を進めましょう！"
                className="w-full px-3.5 py-2 rounded-xl border border-[#C9D2DA] bg-[#FDFBF7] focus:bg-white text-xs text-[#1B2631] leading-relaxed focus:outline-none focus:border-[#3E9C93]"
              />
            </label>
          </section>

          {/* 編集モード時：参加受付スイッチ */}
          {mode === 'edit' && (
            <section className="bg-white rounded-2xl border border-[#E6E3DA] p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold text-[#1B2631]">新規生徒の参加受付</p>
                <p className="text-[11px] text-[#6B7280] mt-0.5">
                  オフにすると招待コードからの新規入室を一時停止します（在籍中の生徒はそのまま利用できます）。
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={joinOpen}
                onClick={() => setJoinOpen((v) => !v)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  joinOpen
                    ? 'bg-[#EBF8F6] border-[#3E9C93] text-[#1F635B]'
                    : 'bg-[#F3F4F6] border-[#D1D5DB] text-[#4B5563]'
                }`}
              >
                {joinOpen ? '受付中' : '締切中'}
              </button>
            </section>
          )}
        </div>

        {/* 固定フッター（モバイルのセーフエリア対応・下ナビ非表示と合わせて100%視認可能） */}
        <div className="shrink-0 bg-white border-t border-[#ECE9E1] px-5 pt-3.5 pb-[calc(0.9rem+env(safe-area-inset-bottom,0px))] flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-3 rounded-xl text-sm font-bold border border-[#E0E1DD] text-[#4B5563] hover:bg-[#FAF8F2] transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 px-5 py-3 rounded-xl text-sm font-extrabold text-white shadow-sm transition-transform active:scale-[0.99] disabled:opacity-45"
            style={{ backgroundColor: effectiveAccent }}
          >
            {submitting
              ? mode === 'create'
                ? 'クラスを開設中…'
                : '設定を保存中…'
              : mode === 'create'
                ? 'この設定でクラスを開設する'
                : '設定の変更を保存する'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// 後方互換ラッパー（CreateClassModal）
// ============================================================================

interface CreateClassModalProps {
  schoolName: string;
  className: string;
  subject: ClassroomDoc['subject'];
  creating: boolean;
  accent: string;
  initialSettings?: Omit<JukuClassSettings, 'classId' | 'updatedAt'>;
  onChangeSchool?: (value: string) => void;
  onChangeClass?: (value: string) => void;
  onChangeSubject?: (value: ClassroomDoc['subject']) => void;
  onClose: () => void;
  onSubmit: (values: ClassFormValues) => void;
}

export function CreateClassModal(props: CreateClassModalProps) {
  return (
    <ClassFormModal
      mode="create"
      submitting={props.creating}
      accent={props.accent}
      initialValues={{
        schoolName: props.schoolName,
        className: props.className,
        subject: props.subject,
        joinOpen: true,
        orgType: props.initialSettings?.orgType ?? 'juku',
        dailyGoalMinutes: props.initialSettings?.dailyGoalMinutes ?? 30,
        weeklyGoalDays: props.initialSettings?.weeklyGoalDays ?? 5,
        examSession: props.initialSettings?.examSession ?? 'scbt_monthly',
        focusSkills: props.initialSettings?.focusSkills ?? ['vocab', 'reading', 'listening', 'writing'],
        coachNote: props.initialSettings?.coachNote ?? '',
      }}
      onClose={props.onClose}
      onSubmit={(values) => {
        props.onChangeSchool?.(values.schoolName);
        props.onChangeClass?.(values.className);
        props.onChangeSubject?.(values.subject);
        props.onSubmit(values);
      }}
    />
  );
}
