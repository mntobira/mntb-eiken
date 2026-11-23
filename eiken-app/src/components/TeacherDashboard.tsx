import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Users,
  Plus,
  AlertTriangle,
  School,
  BookOpenCheck,
  CheckCircle2,
  X,
  Clock,
  ClipboardCheck,
  BarChart3,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { auth } from '../firebase';
import {
  fetchMyClassrooms,
  fetchClassSummaries,
  fetchClassRawProgress,
  setJoinOpen,
  setRosterName,
  KANTEN_MASTERED_BOX,
} from '../utils/classroom';
import { fetchManageableClassrooms } from '../sugoroku/admin/firestoreAdminService';
import { buildKantenReport, type KantenReport } from '../utils/kantenReport';
import { getChapterCatalog, SUBJECT_LABELS } from '../data/chapterCatalog';
import { aggregateClass, type ClassroomDoc } from '../utils/classroomCore';
import { buildStudentCsv, type StudentSummary, toDateKey } from '../utils/studySummary';
import { subjectTheme } from '../data/subjectTheme';
import { confirmAction } from '../utils/dialog';
import { DEFAULT_CLASS_SUBJECT } from './teacher/teacherSubjects';
import { EmptyState } from './teacher/EmptyState';
import { StudentsTab } from './teacher/StudentsTab';
import { KantenTab } from './teacher/KantenTab';
import { ClassesTab } from './teacher/ClassesTab';
import { ClassFormModal, CreateClassModal, type ClassFormValues } from './teacher/CreateClassModal';
import { JukuTab } from './teacher/JukuTab';
import { StudyTimeTab } from './teacher/StudyTimeTab';
import {
  createDefaultClassSettings,
  createManagedClassroom,
  deleteManagedClassroom,
  fetchClassSettings,
  loadCachedClassSettings,
  loadLastOrgName,
  updateManagedClassroom,
  type JukuClassSettings,
} from '../sugoroku/admin/classroomSettings';

interface TeacherDashboardProps {
  onBack: () => void;
  backLabel?: string;
  initialOpenCreate?: boolean;
  onInitialCreateHandled?: () => void;
  onOpenSugorokuAdmin?: () => void;
}

type Tab = 'students' | 'study_time' | 'kanten' | 'juku' | 'classes';

export function TeacherDashboard({
  onBack,
  backLabel = '戻る',
  initialOpenCreate = false,
  onInitialCreateHandled,
  onOpenSugorokuAdmin,
}: TeacherDashboardProps) {
  const [tab, setTab] = useState<Tab>('students');
  const [classrooms, setClassrooms] = useState<ClassroomDoc[]>([]);
  const [activeClassId, setActiveClassId] = useState<string>('');
  const [settingsMap, setSettingsMap] = useState<Record<string, JukuClassSettings>>({});
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  // クラス新規作成モーダル
  const [showCreate, setShowCreate] = useState(() => initialOpenCreate);

  useEffect(() => {
    if (initialOpenCreate) {
      setShowCreate(true);
      onInitialCreateHandled?.();
    }
  }, [initialOpenCreate, onInitialCreateHandled]);
  const [newSchoolName, setNewSchoolName] = useState(() => loadLastOrgName());
  const [newClassName, setNewClassName] = useState('');
  const [newSubject, setNewSubject] = useState<ClassroomDoc['subject']>(DEFAULT_CLASS_SUBJECT);
  const [creating, setCreating] = useState(false);

  // 既存クラス設定編集モーダル
  const [editingRoom, setEditingRoom] = useState<ClassroomDoc | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // 名簿名のインライン編集
  const [editingUid, setEditingUid] = useState('');
  const [editingName, setEditingName] = useState('');

  // 観点別評価レポート
  const [kantenReports, setKantenReports] = useState<KantenReport[]>([]);
  const [loadingKanten, setLoadingKanten] = useState(false);
  const [kantenLoadedFor, setKantenLoadedFor] = useState('');

  const uid = auth.currentUser?.uid || '';

  const activeClass = useMemo(
    () => classrooms.find((room) => room.id === activeClassId) || null,
    [classrooms, activeClassId],
  );
  const activeSettings = useMemo(
    () =>
      activeClass
        ? settingsMap[activeClass.id] ?? loadCachedClassSettings(activeClass.id)
        : createDefaultClassSettings(''),
    [activeClass, settingsMap],
  );
  const theme = subjectTheme(activeClass?.subject);

  // ---------------------------------------------------------------
  // クラス一覧 ＋ 各クラス設定の読み込み
  // ---------------------------------------------------------------
  const loadClasses = useCallback(async () => {
    if (!uid) {
      setLoadingClasses(false);
      return;
    }
    setLoadingClasses(true);
    setError('');
    try {
      const rooms = await fetchManageableClassrooms().catch(() => fetchMyClassrooms());
      rooms.sort((a, b) => (a.className || '').localeCompare(b.className || '', 'ja'));
      setClassrooms(rooms);

      // まずローカルキャッシュで即時反映し、その後 Firestore 設定を取得
      const initialSettings: Record<string, JukuClassSettings> = {};
      for (const r of rooms) {
        initialSettings[r.id] = loadCachedClassSettings(r.id);
      }
      setSettingsMap(initialSettings);

      if (rooms.length > 0 && !newSchoolName) {
        setNewSchoolName(rooms[0].schoolName || '');
      }

      setActiveClassId((current) => {
        if (current && rooms.some((room) => room.id === current)) return current;
        return rooms.length > 0 ? rooms[0].id : '';
      });

      const fetchedEntries = await Promise.all(
        rooms.map(async (r) => [r.id, await fetchClassSettings(r.id)] as const),
      );
      setSettingsMap(Object.fromEntries(fetchedEntries));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'クラスの読み込みに失敗しました。');
    } finally {
      setLoadingClasses(false);
    }
  }, [uid, newSchoolName]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  // ---------------------------------------------------------------
  // 選択中クラスの生徒サマリー
  // ---------------------------------------------------------------
  const loadStudents = useCallback(async (classId: string) => {
    if (!classId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    setError('');
    try {
      const summaries = await fetchClassSummaries(classId);
      setStudents(summaries);
    } catch (loadError) {
      setStudents([]);
      setError(loadError instanceof Error ? loadError.message : '学習状況の取得に失敗しました。');
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    void loadStudents(activeClassId);
  }, [activeClassId, loadStudents]);

  const aggregate = useMemo(() => aggregateClass(students), [students]);

  // ---------------------------------------------------------------
  // 観点別評価レポートの読み込み
  // ---------------------------------------------------------------
  const loadKanten = useCallback(
    async (classId: string, subject: ClassroomDoc['subject']) => {
      if (!classId) {
        setKantenReports([]);
        return;
      }
      setLoadingKanten(true);
      setError('');
      try {
        const chapters = getChapterCatalog(subject);
        const subjectLabel = SUBJECT_LABELS[subject] || subject;
        const rows = await fetchClassRawProgress(classId);
        setKantenReports(
          rows.map((row) =>
            buildKantenReport({
              uid: row.uid,
              displayName: row.displayName,
              subjectLabel,
              chapters,
              solved: row.solved,
              reviewItems: row.reviewItems,
              masteredBox: KANTEN_MASTERED_BOX,
            }),
          ),
        );
        setKantenLoadedFor(classId);
      } catch (loadError) {
        setKantenReports([]);
        setError(
          loadError instanceof Error ? loadError.message : '観点別評価の材料の取得に失敗しました。',
        );
      } finally {
        setLoadingKanten(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (tab !== 'kanten' || !activeClass) return;
    if (kantenLoadedFor === activeClass.id) return;
    void loadKanten(activeClass.id, activeClass.subject);
  }, [tab, activeClass, kantenLoadedFor, loadKanten]);

  // ---------------------------------------------------------------
  // クラス開設・設定更新・削除
  // ---------------------------------------------------------------
  const handleCreate = async (values: ClassFormValues) => {
    setCreating(true);
    setError('');
    try {
      const { classroom: created, settings: createdSettings } = await createManagedClassroom({
        schoolName: values.schoolName,
        className: values.className,
        subject: values.subject,
        enableJukuPlan: true,
        settings: {
          orgType: values.orgType,
          dailyGoalMinutes: values.dailyGoalMinutes,
          weeklyGoalDays: values.weeklyGoalDays,
          examSession: values.examSession,
          focusSkills: values.focusSkills,
          coachNote: values.coachNote,
        },
      });
      setShowCreate(false);
      setNewSchoolName(values.schoolName);
      setNewClassName('');
      setClassrooms((prev) => [...prev, created]);
      setSettingsMap((prev) => ({ ...prev, [created.id]: createdSettings }));
      setActiveClassId(created.id);
      setTab('students');
      setNotice(
        `「${created.className}」を開設しました（招待コード: ${created.joinCode}）。下のボタンから招待URLまたはLINE案内文をコピーして生徒へ送れます。`,
      );
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'クラスの作成に失敗しました。');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEditRoom = async (values: ClassFormValues) => {
    if (!editingRoom) return;
    setSavingEdit(true);
    setError('');
    try {
      const { classroom: updated, settings: updatedSettings } = await updateManagedClassroom({
        room: editingRoom,
        schoolName: values.schoolName,
        className: values.className,
        subject: values.subject,
        joinOpen: values.joinOpen,
        upgradeToJukuPlan: true,
        settings: {
          orgType: values.orgType,
          dailyGoalMinutes: values.dailyGoalMinutes,
          weeklyGoalDays: values.weeklyGoalDays,
          examSession: values.examSession,
          focusSkills: values.focusSkills,
          coachNote: values.coachNote,
        },
      });
      setClassrooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSettingsMap((prev) => ({ ...prev, [updated.id]: updatedSettings }));
      if (kantenLoadedFor === updated.id && editingRoom.subject !== updated.subject) {
        setKantenLoadedFor('');
      }
      setEditingRoom(null);
      setNotice(`「${updated.className}」の設定を保存しました。`);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : '設定の保存に失敗しました。');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleUpgradeToJuku = async (room: ClassroomDoc) => {
    setError('');
    try {
      const currentSettings = settingsMap[room.id] ?? createDefaultClassSettings(room.id);
      const { classroom: updated } = await updateManagedClassroom({
        room,
        schoolName: room.schoolName,
        className: room.className,
        subject: room.subject,
        joinOpen: room.joinOpen,
        upgradeToJukuPlan: true,
        settings: {
          orgType: currentSettings.orgType,
          dailyGoalMinutes: currentSettings.dailyGoalMinutes,
          weeklyGoalDays: currentSettings.weeklyGoalDays,
          examSession: currentSettings.examSession,
          focusSkills: currentSettings.focusSkills,
          coachNote: currentSettings.coachNote,
        },
      });
      setClassrooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (updated.plan === 'juku') {
        setNotice(`「${updated.className}」を塾プラン（宿題配信・広告完全非表示）に切り替えました。`);
      }
    } catch (upgradeErr) {
      setError(upgradeErr instanceof Error ? upgradeErr.message : '塾プランへの切り替えに失敗しました。');
    }
  };

  const handleDeleteRoom = async (room: ClassroomDoc) => {
    const ok = confirmAction(
      `コース「${room.className}」（招待コード: ${room.joinCode}）を削除します。\n※ 誤作成クラスや終了クラスの整理用です。よろしいですか？`,
    );
    if (!ok) return;
    setError('');
    try {
      await deleteManagedClassroom(room);
      const remaining = classrooms.filter((r) => r.id !== room.id);
      setClassrooms(remaining);
      if (activeClassId === room.id) {
        setActiveClassId(remaining[0]?.id ?? '');
      }
      setNotice(`「${room.className}」を削除しました。`);
    } catch (delError) {
      setError(delError instanceof Error ? delError.message : 'クラスの削除に失敗しました。');
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(''), 1800);
    } catch {
      setError('コードのコピーができませんでした。画面の文字を書き写してください。');
    }
  };

  const handleToggleJoin = async (room: ClassroomDoc) => {
    const next = !room.joinOpen;
    setClassrooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, joinOpen: next } : r)));
    try {
      await setJoinOpen(room.id, next);
    } catch (toggleError) {
      setClassrooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, joinOpen: room.joinOpen } : r)));
      setError(toggleError instanceof Error ? toggleError.message : '参加受付の変更に失敗しました。');
    }
  };

  const handleSaveRosterName = async (studentUid: string) => {
    const trimmed = editingName.trim();
    setEditingUid('');
    if (!activeClassId) return;
    try {
      await setRosterName(activeClassId, studentUid, trimmed);
      setStudents((prev) =>
        prev.map((student) =>
          student.uid === studentUid
            ? { ...student, displayName: trimmed || student.displayName }
            : student,
        ),
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '名前の設定に失敗しました。');
    }
  };

  const handleExportCsv = () => {
    if (students.length === 0) return;
    const csv = buildStudentCsv(students);
    const className = (activeClass?.className || 'クラス').replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `学習状況_${className}_${toDateKey(Date.now())}.csv`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------
  // 未ログイン：先に入口を閉じる
  // ---------------------------------------------------------------
  if (!uid) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] px-5 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#4B5563] hover:text-[#1B2631] transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-bold">{backLabel}</span>
        </button>
        <div className="max-w-md mx-auto bg-white rounded-3xl border border-[#E0E1DD] p-6 text-center shadow-xs">
          <School className="w-10 h-10 mx-auto mb-3 text-[#9BA3AE]" />
          <h2 className="text-lg font-extrabold text-[#1B2631] mb-2">講師・管理者専用の画面です</h2>
          <p className="text-sm text-[#4B5563] leading-relaxed">
            コース・クラスの管理には Google ログインが必要です。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] px-4 sm:px-6 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <div className="max-w-5xl mx-auto">
        {/* トップナビゲーション行 */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-[42px] items-center gap-1.5 text-[#4B5563] hover:text-[#1B2631] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-bold">{backLabel}</span>
          </button>

          {onOpenSugorokuAdmin && (
            <button
              type="button"
              onClick={onOpenSugorokuAdmin}
              className="inline-flex min-h-[40px] items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-white border border-[#D8D5CC] text-[#1B2631] hover:bg-[#FAF8F2] shadow-2xs transition-colors"
            >
              <BookOpenCheck className="w-4 h-4 text-[#3E9C93]" />
              4技能添削・教材PDFポータルへ
            </button>
          )}
        </div>

        {/* メインヘッダー */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#6B7280]">
                {activeClass?.schoolName || '塾・英語コース管理'}
              </span>
              {activeClass?.plan === 'juku' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E8F6F4] text-[#236B63] border border-[#B5E2DC]">
                  <ShieldCheck className="w-3 h-3" />
                  塾プラン稼働中
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1B2631] flex items-center gap-2">
              <Users className="w-6 h-6 shrink-0" style={{ color: theme.accent }} />
              <span>{activeClass ? activeClass.className : 'コース・クラスの学習管理'}</span>
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex min-h-[44px] items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white shadow-xs transition-transform active:scale-95"
            style={{ backgroundColor: theme.accent }}
          >
            <Plus className="w-4 h-4" />
            新しいクラスを開設
          </button>
        </div>

        {/* コース・クラス切り替えピル */}
        {classrooms.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3">
            {classrooms.map((room) => {
              const roomTheme = subjectTheme(room.subject);
              const isSelected = room.id === activeClassId;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setActiveClassId(room.id)}
                  className={`shrink-0 min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm border flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-white border-[#3E9C93] font-extrabold text-[#1B2631] shadow-xs'
                      : 'bg-white/55 border-[#E0E1DD] text-[#4B5563] hover:bg-white'
                  }`}
                >
                  <span>{room.className}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${roomTheme.chipTextClass} ${roomTheme.chipBgClass}`}
                  >
                    {roomTheme.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 機能タブバー（モバイル横スクロール＋アイコン付き高視認デザイン） */}
        {classrooms.length > 0 && (
          <div className="flex gap-1 overflow-x-auto p-1 bg-[#EFECE4] rounded-2xl mb-5 sm:w-fit">
            {(
              [
                { id: 'students' as Tab, label: '生徒・招待', icon: Users },
                { id: 'study_time' as Tab, label: '学習時間', icon: Clock },
                { id: 'juku' as Tab, label: '宿題・根拠', icon: ClipboardCheck },
                { id: 'kanten' as Tab, label: '到達レポート', icon: BarChart3 },
                { id: 'classes' as Tab, label: 'コース設定', icon: Settings2 },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`shrink-0 min-h-[42px] px-3 sm:px-4 rounded-xl text-xs sm:text-sm whitespace-nowrap inline-flex items-center gap-1.5 transition-all ${
                    active
                      ? 'bg-white font-extrabold text-[#1B2631] shadow-xs'
                      : 'font-bold text-[#4B5563] hover:text-[#1B2631]'
                  }`}
                >
                  <Icon
                    className="w-3.5 h-3.5 shrink-0"
                    style={active ? { color: theme.accent } : undefined}
                  />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {/* 完了トーストバナー */}
        {notice && (
          <div className="mb-4 flex items-start justify-between gap-2 p-3.5 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs sm:text-sm text-[#065F46]">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#059669]" />
              <span className="leading-relaxed font-medium">{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice('')}
              aria-label="通知を閉じる"
              className="p-1 rounded-lg hover:bg-[#D1FAE5] text-[#065F46]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* エラーバナー */}
        {error && (
          <div className="mb-4 flex items-start justify-between gap-2 p-3.5 rounded-2xl bg-[#FDECEA] border border-[#F5C6C0] text-xs sm:text-sm text-[#96342B]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              aria-label="エラーを閉じる"
              className="p-1 rounded-lg hover:bg-[#FADBD8]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* メインビュー */}
        {loadingClasses ? (
          <div className="py-16 text-center text-sm text-[#6B7280]">コース情報を読み込んでいます…</div>
        ) : classrooms.length === 0 ? (
          <EmptyState
            onCreate={() => setShowCreate(true)}
            onOpenSugorokuAdmin={onOpenSugorokuAdmin}
            accent={theme.accent}
          />
        ) : tab === 'students' ? (
          <StudentsTab
            students={students}
            aggregate={aggregate}
            loading={loadingStudents}
            theme={theme}
            activeClass={activeClass}
            classSettings={activeSettings}
            copiedCode={copiedCode}
            editingUid={editingUid}
            editingName={editingName}
            onCopyCode={handleCopyCode}
            onRefresh={() => void loadStudents(activeClassId)}
            onExportCsv={handleExportCsv}
            onStartEdit={(student) => {
              setEditingUid(student.uid);
              setEditingName(student.displayName === '（名前未設定）' ? '' : student.displayName);
            }}
            onChangeEditingName={setEditingName}
            onSaveEdit={handleSaveRosterName}
            onCancelEdit={() => setEditingUid('')}
            onOpenStudyTime={() => setTab('study_time')}
            onOpenHomework={() => setTab('juku')}
            onOpenEditClass={() => {
              if (activeClass) setEditingRoom(activeClass);
            }}
          />
        ) : tab === 'study_time' ? (
          <StudyTimeTab
            activeClass={activeClass}
            classSettings={activeSettings}
            theme={theme}
            onOpenEditClass={() => {
              if (activeClass) setEditingRoom(activeClass);
            }}
          />
        ) : tab === 'kanten' ? (
          <KantenTab
            reports={kantenReports}
            loading={loadingKanten}
            theme={theme}
            activeClass={activeClass}
            onRefresh={() => {
              if (activeClass) void loadKanten(activeClass.id, activeClass.subject);
            }}
          />
        ) : tab === 'juku' ? (
          <JukuTab activeClass={activeClass} theme={theme} />
        ) : (
          <ClassesTab
            classrooms={classrooms}
            activeClassId={activeClassId}
            settingsMap={settingsMap}
            theme={theme}
            copiedCode={copiedCode}
            onSelectClass={(id) => {
              setActiveClassId(id);
              setTab('students');
            }}
            onCopyCode={handleCopyCode}
            onToggleJoin={handleToggleJoin}
            onEditRoom={(room) => setEditingRoom(room)}
            onDeleteRoom={handleDeleteRoom}
            onUpgradeToJuku={handleUpgradeToJuku}
          />
        )}
      </div>

      {/* 新規コース・クラス開設モーダル */}
      {showCreate && (
        <CreateClassModal
          schoolName={newSchoolName}
          className={newClassName}
          subject={newSubject}
          creating={creating}
          accent={theme.accent}
          onChangeSchool={setNewSchoolName}
          onChangeClass={setNewClassName}
          onChangeSubject={setNewSubject}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {/* 既存コース・クラス設定編集モーダル */}
      {editingRoom && (
        <ClassFormModal
          mode="edit"
          submitting={savingEdit}
          accent={subjectTheme(editingRoom.subject).accent}
          joinCode={editingRoom.joinCode}
          isJukuPlanActive={editingRoom.plan === 'juku'}
          initialValues={{
            schoolName: editingRoom.schoolName,
            className: editingRoom.className,
            subject: editingRoom.subject,
            joinOpen: editingRoom.joinOpen,
            ...(settingsMap[editingRoom.id] ?? createDefaultClassSettings(editingRoom.id)),
          }}
          onClose={() => setEditingRoom(null)}
          onSubmit={handleSaveEditRoom}
        />
      )}
    </div>
  );
}
