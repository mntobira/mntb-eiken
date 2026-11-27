/**
 * すごろく塾・クラス統合管理ポータル（エッセンシャル設計・全クラス一覧切替＆詳細目標・招待・4技能添削・合格ルート完全統合）
 * - 設定＞クラスを管理アカウントで開くと、所持・担当している全クラスが最上部に一覧表示され即選択できる
 * - 新規クラス作成・目標時間/日数/受験回/参加受付編集・不要クラス削除・生徒招待キット（LINE案内文/URL/6文字コード）を全てこの画面内で完結
 * - 学習ルート・教材タブからワンタップで週次カリキュラム宿題を配信可能
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ChevronRight,
  Copy,
  Download,
  Eye,
  Link2,
  LogIn,
  MessageCircle,
  Plus,
  Printer,
  RefreshCw,
  Settings2,
  Trash2,
  Users,
} from 'lucide-react';
import { auth, FIREBASE_CONFIGURED } from '../../firebase';
import { signInWithGoogle } from '../../utils/googleAuth';
import { PdfViewerHost } from '../../components/PdfViewer';
import { CountUp } from '../../components/ui/CountUp';
import {
  BackButton,
  Card,
  PrimaryButton,
  SecondaryButton,
} from '../../components/ui';
import { ClassFormModal, type ClassFormValues } from '../../components/teacher/CreateClassModal';
import { confirmAction } from '../../utils/dialog';
import { KineticText, ScoreRing, installRipple } from '../../motion';
import type { ClassroomDoc } from '../../utils/classroomCore';
import type { EikenGrade } from '../../eiken/config';
import type {
  SugorokuAdminExtensionSlots,
  SugorokuStaffInviteDoc,
} from '../shared/types';
import {
  buildStudentOverview,
  buildSugorokuSummaryCsv,
  formatDateKey,
  formatDurationJa,
  getGradeLabel,
  sortStudentsByAlertPriority,
  type SugorokuStudentOverview,
} from './adminAnalytics';
import { createSugorokuDemoBundle, type SugorokuDemoBundle } from './demoData';
import {
  buildClassInviteMessage,
  buildClassInviteUrl,
  createDefaultClassSettings,
  createManagedClassroom,
  deleteManagedClassroom,
  fetchClassSettings,
  loadCachedClassSettings,
  loadLastOrgName,
  updateManagedClassroom,
  type JukuClassSettings,
} from './classroomSettings';
import { openClassInviteSheetPrint } from './printClassInviteSheet';
import { createAssignment, deleteAssignment } from '../../utils/classAssignments';
import { dueDateToMs, formatDue } from '../../utils/classAssignmentsCore';
import type { AnswerReasonDoc } from '../../utils/classAssignmentsCore';
import type { ReviewItem } from '../../utils/reviewList';
import type { SolvedMap } from '../../utils/studySyncCore';
import type { StudentRawProgress } from '../../utils/classroom';
import { attachPlanToAssignment, deleteHomeworkPlan } from '../homework/homeworkStore';
import { allEikenChapterCatalog, chapterTitleOf, chapterTotals } from '../homework/chapterTotals';
import {
  buildClassLiveSubmissionFeed,
  buildStudentChapterActivities,
  formatShortTimestampJa,
} from './studentProblemActivity';
import {
  SugorokuHomeworkComposerModal,
  type PacemakerSubmitPayload,
} from '../homework/SugorokuHomeworkComposer';
import {
  buildStaffInviteId,
  fetchManageableClassrooms,
  inviteSugorokuStaff,
  isEmailPreAuthorizedAdmin,
  loadClassPortalData,
  revokeSugorokuStaff,
  updateSugorokuStudentProfile,
  type LoadedClassPortalData,
} from './firestoreAdminService';
import { SugorokuStaffSheet } from './SugorokuStaffSheet';
import {
  SugorokuStudentDetailView,
  buildLineEncourageMessage,
} from './SugorokuStudentDetailView';
import { SugorokuPdfShelfTab } from './SugorokuPdfShelfTab';
import {
  SugorokuSpeakingExtensionSlot,
  SugorokuWritingExtensionSlot,
} from './SugorokuExtensionSlots';
import {
  PortalSkeletonScreen,
  PullToRefreshHost,
  SkillRatioStackBar,
  StudyDoorsWeek,
  SugorokuBottomSheet,
  SugorokuToast,
  SwipeableRow,
  usePortalToast,
} from './SugorokuInteractiveUi';
import {
  ensureDemoChatSeed,
  subscribeClassThreadsForTeacher,
  TeacherClassChatBoard,
  type ClassChatThreadDoc,
} from '../chat';
import './sugoroku-admin.css';

export type SugorokuAdminTabId =
  | 'students'
  | 'chat'
  | 'pdf_shelf'
  | 'writing_review'
  | 'speaking_review';

export interface SugorokuAdminAppProps {
  onBack?: () => void;
  /** 設定＞クラスの「管理しているクラス一覧」から選択されたクラスID */
  initialClassId?: string;
  /** 開いた直後に表示するタブ（新着チャット通知タップ時は 'chat'） */
  initialTab?: SugorokuAdminTabId;
  /** チャットタブで初期選択する生徒UID */
  initialChatStudentUid?: string;
  /** 後方互換のために型のみ保持（現在はポータル内蔵モーダルで完結） */
  onOpenTeacherDashboard?: () => void;
  onOpenCreateClass?: () => void;
  initialDataMode?: 'auto' | 'demo' | 'firestore';
  extensionSlots?: SugorokuAdminExtensionSlots;
}

export function SugorokuAdminApp({
  onBack,
  initialClassId,
  initialTab,
  initialChatStudentUid,
  initialDataMode = 'auto',
  extensionSlots,
}: SugorokuAdminAppProps) {
  const [user, setUser] = useState(() => auth.currentUser);
  const [dataMode, setDataMode] = useState<'demo' | 'firestore'>(() => {
    if (initialDataMode === 'demo') return 'demo';
    if (initialDataMode === 'firestore') return 'firestore';
    return FIREBASE_CONFIGURED ? 'firestore' : 'demo';
  });
  const [activeTab, setActiveTab] = useState<SugorokuAdminTabId>(initialTab ?? 'students');
  const [selectedStudentUid, setSelectedStudentUid] = useState<string | null>(null);
  const [chatStudentUid, setChatStudentUid] = useState<string | null>(
    initialChatStudentUid ?? null,
  );
  const [chatThreadsByUid, setChatThreadsByUid] = useState<Record<string, ClassChatThreadDoc>>({});
  const [quickSheetStudentUid, setQuickSheetStudentUid] = useState<string | null>(null);
  const [staffSheetOpen, setStaffSheetOpen] = useState(false);
  const [homeworkModalOpen, setHomeworkModalOpen] = useState(false);
  const [homeworkTargetStudent, setHomeworkTargetStudent] = useState<{
    uid: string;
    name: string;
  } | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<
    import('../shared/types').SugorokuAssignmentDoc | null
  >(null);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [classFormMode, setClassFormMode] = useState<'create' | 'edit' | null>(null);
  const [savingClassForm, setSavingClassForm] = useState(false);
  const [deletingClass, setDeletingClass] = useState(false);

  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [newJukuSchoolName, setNewJukuSchoolName] = useState(
    () => loadLastOrgName() || 'すごろく学習塾',
  );
  const [creatingJukuRoom, setCreatingJukuRoom] = useState(false);

  const [skeletonTransition] = useState(false);
  const [ptrRefreshing, setPtrRefreshing] = useState(false);
  const { toast, showToast, dismissToast } = usePortalToast();

  const [demoBundle, setDemoBundle] = useState<SugorokuDemoBundle>(() =>
    createSugorokuDemoBundle(),
  );

  const [classrooms, setClassrooms] = useState<ClassroomDoc[]>([]);
  const [classSettingsMap, setClassSettingsMap] = useState<Record<string, JukuClassSettings>>({});
  const [activeClassId, setActiveClassId] = useState<string>(initialClassId || '');
  const [livePortalData, setLivePortalData] = useState<LoadedClassPortalData | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    if (initialClassId) setActiveClassId(initialClassId);
  }, [initialClassId]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialChatStudentUid) setChatStudentUid(initialChatStudentUid);
  }, [initialChatStudentUid]);

  useEffect(() => {
    installRipple();
  }, []);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) return;
    return onAuthStateChanged(auth, (current) => setUser(current));
  }, []);

  const reloadLiveClasses = useCallback(async (preferredClassId?: string) => {
    if (!FIREBASE_CONFIGURED || !auth.currentUser) {
      setClassrooms([]);
      setLivePortalData(null);
      return;
    }
    setLoadingLive(true);
    setLiveError(null);
    try {
      const rooms = await fetchManageableClassrooms();
      setClassrooms(rooms);

      const initialSettings: Record<string, JukuClassSettings> = {};
      for (const r of rooms) {
        initialSettings[r.id] = loadCachedClassSettings(r.id);
      }
      setClassSettingsMap(initialSettings);

      if (rooms.length > 0) {
        const targetId = preferredClassId ?? (activeClassId || initialClassId || '');
        const nextRoom = rooms.find((r) => r.id === targetId) ?? rooms[0];
        setActiveClassId(nextRoom.id);
        const [portal, fetchedEntries] = await Promise.all([
          loadClassPortalData(nextRoom),
          Promise.all(rooms.map(async (r) => [r.id, await fetchClassSettings(r.id)] as const)),
        ]);
        setClassSettingsMap(Object.fromEntries(fetchedEntries));
        setLivePortalData(portal);
        if (initialDataMode === 'auto') {
          setDataMode('firestore');
        }
      } else {
        setActiveClassId('');
        setLivePortalData(null);
      }
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'データの取得に失敗しました');
    } finally {
      setLoadingLive(false);
    }
  }, [activeClassId, initialClassId, initialDataMode]);

  useEffect(() => {
    if (user && FIREBASE_CONFIGURED) {
      void reloadLiveClasses();
    }
  }, [user, reloadLiveClasses]);

  const handlePullRefresh = async () => {
    setPtrRefreshing(true);
    try {
      if (dataMode === 'demo') {
        await new Promise((r) => window.setTimeout(r, 360));
        setDemoBundle((prev) => ({ ...createSugorokuDemoBundle(), members: prev.members }));
      } else {
        await reloadLiveClasses();
      }
      showToast('更新しました', 'done');
    } finally {
      setPtrRefreshing(false);
    }
  };

  const handleSelectLiveClass = async (classId: string) => {
    setActiveClassId(classId);
    setSelectedStudentUid(null);
    const room = classrooms.find((r) => r.id === classId);
    if (!room) return;
    setLoadingLive(true);
    setLiveError(null);
    try {
      const portal = await loadClassPortalData(room);
      setLivePortalData(portal);
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : '読み込みに失敗しました');
    } finally {
      setLoadingLive(false);
    }
  };

  const activeLiveRoom = useMemo(
    () => classrooms.find((r) => r.id === activeClassId) ?? livePortalData?.classroom ?? null,
    [classrooms, activeClassId, livePortalData],
  );

  const activeClassSettings = useMemo(() => {
    if (!activeLiveRoom) return createDefaultClassSettings('');
    return classSettingsMap[activeLiveRoom.id] ?? loadCachedClassSettings(activeLiveRoom.id);
  }, [activeLiveRoom, classSettingsMap]);

  const sourceInfo = useMemo(() => {
    if (dataMode === 'demo') {
      return {
        isDemo: true,
        viewerRole: 'owner' as const,
        teacherUid: 'teacher_sugoroku_nishi',
        ownerName: demoBundle.ownerName,
        ownerEmail: demoBundle.ownerEmail,
        staffInvites: demoBundle.staffInvites.filter((inv) => inv.status !== 'revoked'),
        classId: demoBundle.classId,
        schoolName: demoBundle.schoolName,
        className: demoBundle.className,
        joinCode: demoBundle.joinCode,
        joinOpen: true,
        subject: 'eiken_2' as ClassroomDoc['subject'],
        members: demoBundle.members,
        logsByUid: demoBundle.logsByUid,
        solvedByUid: demoBundle.solvedByUid,
        rawSolvedByUid: demoBundle.rawSolvedByUid,
        reviewItemsByUid: demoBundle.reviewItemsByUid,
        answerReasons: demoBundle.answerReasons,
        assignments: demoBundle.assignments,
        writingSubmissions: demoBundle.writingSubmissions,
        speakingSubmissions: demoBundle.speakingSubmissions,
      };
    }
    if (!livePortalData) {
      return {
        isDemo: false,
        viewerRole: 'owner' as const,
        teacherUid: activeLiveRoom?.teacherUid || user?.uid || '',
        ownerName: user?.displayName || '代表講師',
        ownerEmail: user?.email || undefined,
        staffInvites: [] as SugorokuStaffInviteDoc[],
        classId: activeLiveRoom?.id || '',
        schoolName: activeLiveRoom?.schoolName || '',
        className: activeLiveRoom?.className || '',
        joinCode: activeLiveRoom?.joinCode || '',
        joinOpen: activeLiveRoom?.joinOpen !== false,
        subject: (activeLiveRoom?.subject ?? 'eiken_2') as ClassroomDoc['subject'],
        members: [],
        logsByUid: {},
        solvedByUid: {},
        rawSolvedByUid: {} as Record<string, SolvedMap>,
        reviewItemsByUid: {} as Record<string, ReviewItem[]>,
        answerReasons: [] as AnswerReasonDoc[],
        assignments: [],
        writingSubmissions: [],
        speakingSubmissions: [],
      };
    }
    return {
      isDemo: false,
      viewerRole: livePortalData.viewerRole,
      teacherUid: livePortalData.classroom.teacherUid || user?.uid || '',
      ownerName:
        livePortalData.viewerRole === 'owner'
          ? user?.displayName || '代表講師'
          : `${livePortalData.classroom.schoolName || 'すごろく塾'} 代表`,
      ownerEmail: livePortalData.viewerRole === 'owner' ? user?.email || undefined : undefined,
      staffInvites: livePortalData.staffInvites,
      classId: livePortalData.classroom.id,
      schoolName: livePortalData.classroom.schoolName,
      className: livePortalData.classroom.className,
      joinCode: livePortalData.classroom.joinCode,
      joinOpen: livePortalData.classroom.joinOpen !== false,
      subject: livePortalData.classroom.subject,
      members: livePortalData.members,
      logsByUid: livePortalData.logsByUid,
      solvedByUid: livePortalData.solvedByUid,
      rawSolvedByUid: livePortalData.rawSolvedByUid,
      reviewItemsByUid: livePortalData.reviewItemsByUid,
      answerReasons: livePortalData.answerReasons,
      assignments: livePortalData.assignments,
      writingSubmissions: livePortalData.writingSubmissions,
      speakingSubmissions: livePortalData.speakingSubmissions,
    };
  }, [dataMode, demoBundle, livePortalData, activeLiveRoom, user]);

  // クラスの1対1チャット一覧をリアルタイム購読（デモ時は初期サンプルも自動投入）
  useEffect(() => {
    if (!sourceInfo.classId) {
      setChatThreadsByUid({});
      return;
    }
    if (sourceInfo.isDemo) {
      ensureDemoChatSeed({
        classId: sourceInfo.classId,
        className: sourceInfo.className,
        schoolName: sourceInfo.schoolName,
      });
    }
    return subscribeClassThreadsForTeacher({
      classId: sourceInfo.classId,
      isDemoMode: sourceInfo.isDemo,
      onThreads: setChatThreadsByUid,
    });
  }, [sourceInfo.classId, sourceInfo.className, sourceInfo.schoolName, sourceInfo.isDemo]);

  const allStudentOverviews: SugorokuStudentOverview[] = useMemo(() => {
    const built = sourceInfo.members
      .filter((m) => m.role === 'student' && m.active !== false)
      .map((member) =>
        buildStudentOverview({
          member,
          logs: sourceInfo.logsByUid[member.uid] ?? [],
          assignments: sourceInfo.assignments,
          solvedByChapter: sourceInfo.solvedByUid[member.uid] ?? {},
          writingSubmissions: sourceInfo.writingSubmissions,
          speakingSubmissions: sourceInfo.speakingSubmissions,
        }),
      );
    return sortStudentsByAlertPriority(built);
  }, [sourceInfo]);

  const filteredStudents = useMemo(() => {
    return allStudentOverviews.filter((s) => {
      if (gradeFilter !== 'all') {
        const practicedGrade = s.gradeSkillBreakdown.some((g) => g.grade === gradeFilter);
        if (s.targetGrade !== gradeFilter && !practicedGrade) return false;
      }
      if (onlyAlerts && s.alerts.length === 0) return false;
      return true;
    });
  }, [allStudentOverviews, gradeFilter, onlyAlerts]);

  const selectedStudent = useMemo(
    () => allStudentOverviews.find((s) => s.uid === selectedStudentUid) ?? null,
    [allStudentOverviews, selectedStudentUid],
  );

  const quickSheetStudent = useMemo(
    () => allStudentOverviews.find((s) => s.uid === quickSheetStudentUid) ?? null,
    [allStudentOverviews, quickSheetStudentUid],
  );

  const kpi = useMemo(() => {
    const count = allStudentOverviews.length;
    const alertCount = allStudentOverviews.filter((s) => s.alerts.length > 0).length;
    const totalWeeklySec = allStudentOverviews.reduce((sum, s) => sum + s.weeklyActiveSeconds, 0);
    const avgWeeklyMin = count > 0 ? Math.round(totalWeeklySec / count / 60) : 0;
    const avgHomeworkPct =
      count > 0
        ? Math.round(
            allStudentOverviews.reduce((sum, s) => sum + s.homework.completionRate, 0) / count,
          )
        : 0;
    const pendingWriting = sourceInfo.writingSubmissions.filter(
      (w) => w.status === 'submitted',
    ).length;
    const pendingSpeaking = sourceInfo.speakingSubmissions.filter(
      (sp) => sp.status === 'submitted',
    ).length;
    const unreadChats = Object.values(chatThreadsByUid).reduce(
      (sum, t) => sum + (t.unreadByTeacher || 0),
      0,
    );
    const totalReasons = sourceInfo.answerReasons.length;
    const totalPendingSubmissions = pendingWriting + pendingSpeaking;

    return {
      count,
      alertCount,
      avgWeeklyMin,
      avgHomeworkPct,
      pendingWriting,
      pendingSpeaking,
      totalPendingSubmissions,
      totalReasons,
      unreadChats,
    };
  }, [allStudentOverviews, sourceInfo, chatThreadsByUid]);

  const studentActivitiesByUid = useMemo(() => {
    const out: Record<string, ReturnType<typeof buildStudentChapterActivities>> = {};
    for (const st of allStudentOverviews) {
      out[st.uid] = buildStudentChapterActivities({
        uid: st.uid,
        rawSolved: sourceInfo.rawSolvedByUid[st.uid],
        chapterCountsFallback: sourceInfo.solvedByUid[st.uid],
        reviewItems: sourceInfo.reviewItemsByUid[st.uid],
        answerReasons: sourceInfo.answerReasons,
      });
    }
    return out;
  }, [allStudentOverviews, sourceInfo]);

  const liveSubmissionFeed = useMemo(
    () =>
      buildClassLiveSubmissionFeed({
        members: sourceInfo.members,
        rawSolvedByUid: sourceInfo.rawSolvedByUid,
        solvedByUid: sourceInfo.solvedByUid,
        reviewItemsByUid: sourceInfo.reviewItemsByUid,
        answerReasons: sourceInfo.answerReasons,
        writingSubmissions: sourceInfo.writingSubmissions,
        speakingSubmissions: sourceInfo.speakingSubmissions,
        limit: 14,
      }),
    [sourceInfo],
  );

  const chapterTotalsMap = useMemo(() => chapterTotals(), []);

  const handleExportSummaryCsv = () => {
    if (filteredStudents.length === 0) return;
    const csv = buildSugorokuSummaryCsv(filteredStudents, true);
    const safeClass = (sourceInfo.className || 'すごろく塾').replace(/[\\/:*?"<>|\s]+/g, '_');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `学習サマリー_${safeClass}_${formatDateKey(Date.now())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('CSVを保存しました', 'done');
  };

  const handleSaveStudentProfile = async (params: {
    studentUid: string;
    rosterName: string;
    targetGrade: EikenGrade;
    note: string;
  }) => {
    if (dataMode === 'demo') {
      setDemoBundle((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.uid === params.studentUid
            ? {
                ...m,
                rosterName: params.rosterName,
                targetGrade: params.targetGrade,
                note: params.note,
              }
            : m,
        ),
      }));
      return;
    }
    if (!sourceInfo.classId) return;
    await updateSugorokuStudentProfile({
      classId: sourceInfo.classId,
      ...params,
    });
    await reloadLiveClasses();
  };

  const handleInviteStaff = async (params: {
    email: string;
    staffName: string;
    staffUid?: string;
  }) => {
    if (dataMode === 'demo') {
      const now = Date.now();
      const key = params.email || params.staffUid || `uid_${now}`;
      const next: SugorokuStaffInviteDoc = {
        id: buildStaffInviteId(demoBundle.classId, key),
        classId: demoBundle.classId,
        className: demoBundle.className,
        schoolName: demoBundle.schoolName,
        email: params.email || `UID: ${params.staffUid}`,
        staffName: params.staffName,
        role: 'staff',
        status: params.staffUid ? 'active' : 'invited',
        ...(params.staffUid ? { acceptedUid: params.staffUid } : {}),
        invitedByUid: 'teacher_sugoroku_nishi',
        createdAt: now,
        updatedAt: now,
      };
      setDemoBundle((prev) => ({
        ...prev,
        staffInvites: [...prev.staffInvites.filter((i) => i.id !== next.id), next],
      }));
      return;
    }
    if (!sourceInfo.classId) return;
    await inviteSugorokuStaff({
      classroom: {
        id: sourceInfo.classId,
        className: sourceInfo.className,
        schoolName: sourceInfo.schoolName,
      },
      email: params.email,
      staffName: params.staffName,
      staffUid: params.staffUid,
    });
    await reloadLiveClasses();
  };

  const handleRevokeStaff = async (invite: SugorokuStaffInviteDoc) => {
    if (dataMode === 'demo') {
      setDemoBundle((prev) => ({
        ...prev,
        staffInvites: prev.staffInvites.filter((i) => i.id !== invite.id),
      }));
      return;
    }
    if (!sourceInfo.classId) return;
    await revokeSugorokuStaff({ classId: sourceInfo.classId, invite });
    await reloadLiveClasses();
  };

  const handleCopyJoinCode = async () => {
    if (!sourceInfo.joinCode) return;
    try {
      await navigator.clipboard.writeText(sourceInfo.joinCode);
      showToast(`招待コード ${sourceInfo.joinCode} をコピーしました`, 'done');
    } catch {
      showToast('コピーできませんでした', 'warn');
    }
  };

  const handleCopyInviteUrl = async () => {
    if (!sourceInfo.joinCode) return;
    try {
      await navigator.clipboard.writeText(buildClassInviteUrl(sourceInfo.joinCode));
      showToast('生徒用の参加URLをコピーしました', 'done');
    } catch {
      showToast('コピーできませんでした', 'warn');
    }
  };

  const handleCopyInviteLineTemplate = async () => {
    if (!sourceInfo.joinCode || !sourceInfo.classId) return;
    try {
      const settings = classSettingsMap[sourceInfo.classId] ?? loadCachedClassSettings(sourceInfo.classId);
      const roomDoc: ClassroomDoc = livePortalData?.classroom ?? {
        id: sourceInfo.classId,
        teacherUid: user?.uid || 'owner',
        schoolName: sourceInfo.schoolName,
        className: sourceInfo.className,
        subject: sourceInfo.subject,
        joinCode: sourceInfo.joinCode,
        joinOpen: sourceInfo.joinOpen,
        plan: 'juku',
        createdAt: 0,
      };
      const text = buildClassInviteMessage({
        room: roomDoc,
        settings,
      });
      await navigator.clipboard.writeText(text);
      showToast('LINE・連絡用の案内文をコピーしました', 'done');
    } catch {
      showToast('コピーできませんでした', 'warn');
    }
  };

  const handleCopyStudentLineMessage = async (st: SugorokuStudentOverview) => {
    try {
      await navigator.clipboard.writeText(buildLineEncourageMessage(st));
      showToast('声掛け文をコピーしました', 'done');
    } catch {
      showToast('コピーできませんでした', 'warn');
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setLiveError(null);
    try {
      const outcome = await signInWithGoogle();
      if (!outcome.ok && !outcome.cancelled && !outcome.redirecting) {
        setLiveError(outcome.message || 'ログインに失敗しました');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const isAuthorizedForLive =
    !!user && (classrooms.length > 0 || isEmailPreAuthorizedAdmin(user.email));

  const composerStudents = useMemo<StudentRawProgress[]>(
    () =>
      allStudentOverviews.map((st) => ({
        uid: st.uid,
        displayName: st.rosterName,
        solved: sourceInfo.solvedByUid[st.uid] ?? {},
        reviewItems: [],
      })),
    [allStudentOverviews, sourceInfo.solvedByUid],
  );

  const homeworkCatalog = useMemo(() => allEikenChapterCatalog(), []);

  const handleCreateQuickJukuRoom = async () => {
    const cleanSchool = newJukuSchoolName.trim() || 'すごろく学習塾';
    setCreatingJukuRoom(true);
    setLiveError(null);
    try {
      const baseDefaults = createDefaultClassSettings('');
      const { classroom: created } = await createManagedClassroom({
        schoolName: cleanSchool,
        className: '全級一括コース（英検5級〜1級）',
        subject: 'eiken_2',
        enableJukuPlan: true,
        settings: {
          orgType: 'juku',
          dailyGoalMinutes: baseDefaults.dailyGoalMinutes,
          weeklyGoalDays: baseDefaults.weeklyGoalDays,
          examSession: baseDefaults.examSession,
          focusSkills: baseDefaults.focusSkills,
          coachNote: '英検5級〜1級のどの級を学習しても一括で学習時間・宿題・英作文・スピーキング録音が共有されます。',
        },
      });
      await reloadLiveClasses(created.id);
      showToast(`招待コード ${created.joinCode} でコースを開設しました`, 'done');
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'コースの開設に失敗しました');
    } finally {
      setCreatingJukuRoom(false);
    }
  };

  const handleSaveClassForm = async (values: ClassFormValues) => {
    setSavingClassForm(true);
    setLiveError(null);
    try {
      if (classFormMode === 'create') {
        const { classroom: created } = await createManagedClassroom({
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
        setClassFormMode(null);
        await reloadLiveClasses(created.id);
        showToast(`「${created.className}」（コード ${created.joinCode}）を開設しました`, 'done');
      } else if (classFormMode === 'edit' && activeLiveRoom) {
        const { classroom: updated, settings: savedSettings } = await updateManagedClassroom({
          room: activeLiveRoom,
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
        setClassSettingsMap((prev) => ({ ...prev, [updated.id]: savedSettings }));
        setClassFormMode(null);
        await reloadLiveClasses(updated.id);
        showToast('クラス設定・学習目標を保存しました', 'done');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'クラス設定の保存に失敗しました', 'warn');
    } finally {
      setSavingClassForm(false);
    }
  };

  const handleDeleteCurrentClass = async () => {
    if (!activeLiveRoom) return;
    if (kpi.count > 0) {
      showToast('在籍中の生徒がいるクラスは削除できません（先に参加受付の締切をご利用ください）', 'warn');
      return;
    }
    const ok = confirmAction(
      `「${activeLiveRoom.className}」（招待コード: ${activeLiveRoom.joinCode}）を削除します。\nこの操作は取り消せません。よろしいですか？`,
    );
    if (!ok) return;

    setDeletingClass(true);
    try {
      await deleteManagedClassroom(activeLiveRoom);
      setInviteSheetOpen(false);
      setClassFormMode(null);
      await reloadLiveClasses();
      showToast(`「${activeLiveRoom.className}」を削除しました`, 'done');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'クラスの削除に失敗しました', 'warn');
    } finally {
      setDeletingClass(false);
    }
  };

  const handleSubmitHomework = async (payload: PacemakerSubmitPayload) => {
    if (dataMode === 'demo') {
      const now = Date.now();
      const dueMs = dueDateToMs(payload.dueDate);
      const nextAssignment = {
        id: payload.editingAssignmentId || `demo_assign_${now}`,
        classId: demoBundle.classId,
        teacherUid: 'teacher_sugoroku_nishi',
        title: payload.title,
        chapterIds: payload.chapterIds,
        dueAt: Number.isFinite(dueMs) ? dueMs : now + 7 * 86_400_000,
        startAt: payload.startAt ?? now,
        targetStudentUids: payload.targetStudentUids,
        dailyQuotaProblems: payload.dailyQuotaProblems,
        targetLaps: payload.targetLaps,
        coachInstruction: payload.coachInstruction,
        skillBreakdown: payload.skillBreakdown,
        presetId: payload.presetId,
        presetWeek: payload.presetWeek,
        createdAt: now,
        updatedAt: now,
      };
      setDemoBundle((prev) => ({
        ...prev,
        assignments: payload.editingAssignmentId
          ? prev.assignments.map((a) =>
              a.id === payload.editingAssignmentId ? nextAssignment : a,
            )
          : [nextAssignment, ...prev.assignments],
      }));
      setEditingAssignment(null);
      setHomeworkTargetStudent(null);
      setHomeworkModalOpen(false);
      showToast(
        payload.editingAssignmentId
          ? `課題「${payload.title}」を更新しました`
          : `課題「${payload.title}」を配信しました（生徒のタイトル・ホーム・クラス画面に反映）`,
        'done',
      );
      return;
    }

    if (!sourceInfo.classId) {
      showToast('先に配信先のクラスを作成または選択してください', 'warn');
      return;
    }

    if (payload.editingAssignmentId) {
      await deleteAssignment(payload.editingAssignmentId).catch(() => undefined);
      await deleteHomeworkPlan(payload.editingAssignmentId, sourceInfo.classId).catch(
        () => undefined,
      );
    }

    const created = await createAssignment(sourceInfo.classId, {
      title: payload.title,
      chapterIds: payload.chapterIds,
      dueDate: payload.dueDate,
    });
    await attachPlanToAssignment(created, {
      dailyQuotaProblems: payload.dailyQuotaProblems,
      targetLaps: payload.targetLaps,
      coachInstruction: payload.coachInstruction,
      skillBreakdown: payload.skillBreakdown,
      targetStudentUids: payload.targetStudentUids,
      presetId: payload.presetId,
      presetWeek: payload.presetWeek,
      startAt: payload.startAt,
    });
    await reloadLiveClasses();
    setEditingAssignment(null);
    setHomeworkTargetStudent(null);
    setHomeworkModalOpen(false);
    showToast(
      payload.editingAssignmentId
        ? `課題「${created.title}」を更新しました`
        : `課題「${created.title}」を配信しました（生徒のタイトル・ホーム・クラス画面に反映）`,
      'done',
    );
  };

  const handleDeleteHomework = async (
    target: import('../shared/types').SugorokuAssignmentDoc,
  ) => {
    const ok = confirmAction(`課題「${target.title}」を削除します。よろしいですか？`);
    if (!ok) return;
    if (dataMode === 'demo') {
      setDemoBundle((prev) => ({
        ...prev,
        assignments: prev.assignments.filter((a) => a.id !== target.id),
      }));
      showToast(`課題「${target.title}」を削除しました`, 'done');
      return;
    }
    if (!sourceInfo.classId) return;
    await deleteAssignment(target.id).catch(() => undefined);
    await deleteHomeworkPlan(target.id, sourceInfo.classId).catch(() => undefined);
    await reloadLiveClasses();
    showToast(`課題「${target.title}」を削除しました`, 'done');
  };

  const showSkeleton =
    skeletonTransition || (dataMode === 'firestore' && loadingLive && !livePortalData);

  return (
    <div data-sugoroku-admin-portal="true" className="sg-screen mt-screen">
      <PdfViewerHost />
      <SugorokuToast toast={toast} onDismiss={dismissToast} />

      <header className="sg-topbar">
        <div className="sg-topbar-inner">
          <div className="sg-brand-row">
            <div className="sg-title-group">
              {onBack && <BackButton label="一覧へ" onClick={onBack} />}
              <div className="sg-title-text">
                <h1>
                  <KineticText
                    text={sourceInfo.className || 'すごろく塾 管理'}
                    variant="rise"
                  />
                </h1>
                {sourceInfo.schoolName && sourceInfo.className && (
                  <small>
                    {sourceInfo.schoolName} · すごろく塾 管理
                  </small>
                )}
              </div>
            </div>

            <div className="sg-head-tools">
              {dataMode === 'firestore' && classrooms.length > 1 && (
                <select
                  aria-label="クラス切り替え"
                  className="sg-class-select"
                  value={activeClassId ?? ''}
                  onChange={(e) => void handleSelectLiveClass(e.target.value)}
                >
                  {classrooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.className}（{room.joinCode}）
                    </option>
                  ))}
                </select>
              )}

              {sourceInfo.joinCode && (
                <button
                  type="button"
                  className="sg-code-btn"
                  onClick={() => setInviteSheetOpen(true)}
                  title="生徒招待コード・A4招待シート・クラスの目標設定・新規クラス作成"
                >
                  <Settings2 size={13} aria-hidden="true" />
                  招待・設定（{sourceInfo.joinCode}）
                </button>
              )}

              {sourceInfo.classId && (
                <button
                  type="button"
                  className="sg-code-btn"
                  onClick={() => setStaffSheetOpen(true)}
                  title="講師メンバー管理"
                >
                  <Users size={13} aria-hidden="true" />
                  講師 {1 + sourceInfo.staffInvites.length}
                </button>
              )}

              <button
                type="button"
                className="sg-icon-btn"
                disabled={ptrRefreshing || loadingLive}
                onClick={() => void handlePullRefresh()}
                aria-label="更新"
                title="最新状態に更新"
              >
                <RefreshCw
                  size={15}
                  className={ptrRefreshing || loadingLive ? 'animate-spin' : undefined}
                />
              </button>
            </div>
          </div>

          <nav aria-label="メニュー" className="mt-tabs sg-nav-tabs">
            <button
              type="button"
              aria-current={activeTab === 'students' ? 'page' : undefined}
              onClick={() => setActiveTab('students')}
            >
              <span>生徒・課題</span>
              {kpi.alertCount > 0 && (
                <span className="sg-tab-count" data-alert="true">
                  {kpi.alertCount}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-current={activeTab === 'chat' ? 'page' : undefined}
              onClick={() => {
                setSelectedStudentUid(null);
                if (!chatStudentUid && allStudentOverviews[0]) {
                  setChatStudentUid(allStudentOverviews[0].uid);
                }
                setActiveTab('chat');
              }}
            >
              <span>チャット</span>
              {kpi.unreadChats > 0 && (
                <span className="sg-tab-count" style={{ background: '#06C755', color: '#fff' }}>
                  {kpi.unreadChats}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-current={activeTab === 'pdf_shelf' ? 'page' : undefined}
              onClick={() => {
                setSelectedStudentUid(null);
                setActiveTab('pdf_shelf');
              }}
            >
              <span>教材PDF</span>
            </button>

            <button
              type="button"
              aria-current={activeTab === 'writing_review' ? 'page' : undefined}
              onClick={() => {
                setSelectedStudentUid(null);
                setActiveTab('writing_review');
              }}
            >
              <span>英作文</span>
              {kpi.pendingWriting > 0 && (
                <span className="sg-tab-count">{kpi.pendingWriting}</span>
              )}
            </button>

            <button
              type="button"
              aria-current={activeTab === 'speaking_review' ? 'page' : undefined}
              onClick={() => {
                setSelectedStudentUid(null);
                setActiveTab('speaking_review');
              }}
            >
              <span>スピーキング</span>
              {kpi.pendingSpeaking > 0 && (
                <span className="sg-tab-count">{kpi.pendingSpeaking}</span>
              )}
            </button>
          </nav>
        </div>
      </header>

      <PullToRefreshHost onRefresh={handlePullRefresh} refreshing={ptrRefreshing}>
        <main className="sg-main">
          {showSkeleton ? (
            <PortalSkeletonScreen rows={5} />
          ) : dataMode === 'firestore' && !FIREBASE_CONFIGURED ? (
            <Card className="sg-empty-card">
              <p className="mt-body">クラウド接続が未設定です。</p>
            </Card>
          ) : dataMode === 'firestore' && !user ? (
            <Card className="sg-empty-card sg-login-card">
              <h2 className="mt-h2">管理者ログイン</h2>
              {liveError && <p className="slog-error">{liveError}</p>}
              <div className="sg-chip-group">
                <PrimaryButton
                  disabled={authBusy}
                  onClick={() => void handleGoogleSignIn()}
                  icon={<LogIn size={15} aria-hidden="true" />}
                >
                  {authBusy ? '認証中…' : 'Googleでログイン'}
                </PrimaryButton>
              </div>
            </Card>
          ) : dataMode === 'firestore' && !loadingLive && !isAuthorizedForLive ? (
            <Card className="sg-empty-card">
              <p className="mt-body">管理者権限が確認できませんでした。</p>
            </Card>
          ) : dataMode === 'firestore' && !loadingLive && classrooms.length === 0 && activeTab !== 'pdf_shelf' ? (
            <Card className="sg-create-juku-card" data-testid="sugoroku-create-juku-card">
              <h2 className="mt-h2">塾ルーム・コースを開設（6文字コード＆招待URL発行）</h2>
              <p className="mt-body">
                英検の級ごとにルームを分けず1つで全級（5級〜1級）一括管理することも、学年・コース別に学習目標（1日○分・週○日）を分けて複数開設することもできます。
              </p>
              {liveError && <p className="slog-error">{liveError}</p>}
              <label className="sg-create-juku-field">
                <span>塾名・教室名</span>
                <input
                  type="text"
                  value={newJukuSchoolName}
                  maxLength={40}
                  onChange={(e) => setNewJukuSchoolName(e.target.value)}
                  placeholder="例）オンライン塾 すごろく / ○○進学塾 本校"
                />
              </label>
              <div className="sg-chip-group">
                <PrimaryButton
                  disabled={creatingJukuRoom || !newJukuSchoolName.trim()}
                  onClick={() => void handleCreateQuickJukuRoom()}
                  icon={<Plus size={15} aria-hidden="true" />}
                >
                  {creatingJukuRoom ? '開設中…' : '全級一括コースを即時開設'}
                </PrimaryButton>
                <SecondaryButton onClick={() => setClassFormMode('create')}>
                  クラス名・目標時間を細かく設定して開設
                </SecondaryButton>
                <SecondaryButton onClick={() => setActiveTab('pdf_shelf')}>
                  先に学習ルート・教材を見る
                </SecondaryButton>
              </div>
            </Card>
          ) : (
            <>
              {activeTab === 'chat' ? (
                <section aria-label="生徒とのチャット" className="sg-stagger sg-grid-12">
                  {allStudentOverviews.length === 0 ? (
                    <Card className="slog-empty">
                      まだ在籍している生徒がいません。生徒が6文字コード（{sourceInfo.joinCode || '---'}）で参加すると、ここで1対1チャットができます。
                    </Card>
                  ) : (
                    <TeacherClassChatBoard
                      classId={sourceInfo.classId}
                      className={sourceInfo.className || 'クラス'}
                      schoolName={sourceInfo.schoolName}
                      teacherUid={sourceInfo.teacherUid || user?.uid || 'owner'}
                      teacherName={user?.displayName || sourceInfo.ownerName || '担当先生'}
                      students={allStudentOverviews}
                      threadsByUid={chatThreadsByUid}
                      selectedStudentUid={chatStudentUid}
                      onSelectStudentUid={setChatStudentUid}
                      onIssueHomeworkForStudent={(st) => {
                        setEditingAssignment(null);
                        setHomeworkTargetStudent({
                          uid: st.uid,
                          name: st.rosterName.split('（')[0] || st.rosterName,
                        });
                        setHomeworkModalOpen(true);
                      }}
                      onOpenStudentDetail={(uid) => {
                        setSelectedStudentUid(uid);
                        setActiveTab('students');
                      }}
                      isDemoMode={sourceInfo.isDemo}
                    />
                  )}
                </section>
              ) : activeTab === 'pdf_shelf' ? (
                <SugorokuPdfShelfTab
                  onToast={showToast}
                  activeSubject={sourceInfo.subject}
                />
              ) : activeTab === 'writing_review' ? (
                <SugorokuWritingExtensionSlot
                  classId={sourceInfo.classId}
                  classNameLabel={
                    [sourceInfo.schoolName, sourceInfo.className].filter(Boolean).join(' ') ||
                    undefined
                  }
                  reviewerUid={user?.uid}
                  reviewerName={user?.displayName || sourceInfo.ownerName}
                  isDemoMode={sourceInfo.isDemo}
                  submissions={sourceInfo.writingSubmissions}
                  onToast={showToast}
                  customRender={extensionSlots?.renderWritingReviewTab}
                  onSelectStudent={(uid) => {
                    setSelectedStudentUid(uid);
                    setActiveTab('students');
                  }}
                />
              ) : activeTab === 'speaking_review' ? (
                <SugorokuSpeakingExtensionSlot
                  classId={sourceInfo.classId}
                  classNameLabel={
                    [sourceInfo.schoolName, sourceInfo.className].filter(Boolean).join(' ') ||
                    undefined
                  }
                  reviewerUid={user?.uid}
                  reviewerName={user?.displayName || sourceInfo.ownerName}
                  isDemoMode={sourceInfo.isDemo}
                  submissions={sourceInfo.speakingSubmissions}
                  customRender={extensionSlots?.renderSpeakingReviewTab}
                  onSelectStudent={(uid) => {
                    setSelectedStudentUid(uid);
                    setActiveTab('students');
                  }}
                />
              ) : selectedStudent ? (
                <div className="sg-master-detail" data-testid="sugoroku-student-master-detail">
                  <aside aria-label="在籍生徒リスト" className="sg-student-rail">
                    <div className="sg-rail-head">
                      <button
                        type="button"
                        className="sg-rail-back-btn"
                        onClick={() => setSelectedStudentUid(null)}
                      >
                        ← クラス全体（{allStudentOverviews.length}名）
                      </button>
                      <button
                        type="button"
                        className="sg-rail-back-btn"
                        onClick={() => {
                          setEditingAssignment(null);
                          setHomeworkTargetStudent(null);
                          setHomeworkModalOpen(true);
                        }}
                        title="クラス全体または選択生徒に課題配信"
                      >
                        <Plus size={13} aria-hidden="true" />
                        課題
                      </button>
                    </div>

                    <ul className="sg-rail-list">
                      {allStudentOverviews.map((st) => {
                        const isActive = st.uid === selectedStudent.uid;
                        const unread = chatThreadsByUid[st.uid]?.unreadByTeacher || 0;
                        return (
                          <li key={st.uid}>
                            <button
                              type="button"
                              className="sg-rail-item"
                              aria-current={isActive ? 'true' : undefined}
                              onClick={() => setSelectedStudentUid(st.uid)}
                            >
                              <div className="sg-rail-item-top">
                                <span className="sg-rail-item-name">
                                  {st.rosterName.split('（')[0] || st.rosterName}
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  {unread > 0 && (
                                    <span
                                      style={{
                                        minWidth: 16,
                                        height: 16,
                                        padding: '0 4px',
                                        borderRadius: 999,
                                        background: '#06C755',
                                        color: '#fff',
                                        fontSize: 10,
                                        fontWeight: 800,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {unread}
                                    </span>
                                  )}
                                  {st.alerts.length > 0 && (
                                    <i
                                      className="sg-rail-alert-dot"
                                      title={st.alerts[0]?.label}
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span className="sg-grade-tag" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                                    {getGradeLabel(st.targetGrade)}
                                  </span>
                                </span>
                              </div>
                              <div className="sg-rail-item-meta">
                                <span>今週 {Math.round(st.weeklyActiveSeconds / 60)}分</span>
                                <span>· 宿題 {st.homework.completionRate}%</span>
                                {st.weeklySolvedCount > 0 && (
                                  <span>· {st.weeklySolvedCount}問</span>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </aside>

                  <SugorokuStudentDetailView
                    student={selectedStudent}
                    rawLogs={sourceInfo.logsByUid[selectedStudent.uid] ?? []}
                    assignments={sourceInfo.assignments}
                    solvedByChapter={sourceInfo.solvedByUid[selectedStudent.uid]}
                    rawSolvedMap={sourceInfo.rawSolvedByUid[selectedStudent.uid]}
                    reviewItems={sourceInfo.reviewItemsByUid[selectedStudent.uid]}
                    answerReasons={sourceInfo.answerReasons}
                    classGoalSummary={{
                      dailyGoalMinutes: activeClassSettings.dailyGoalMinutes,
                      weeklyGoalDays: activeClassSettings.weeklyGoalDays,
                    }}
                    unreadChatCount={chatThreadsByUid[selectedStudent.uid]?.unreadByTeacher || 0}
                    isDemoMode={sourceInfo.isDemo}
                    onBack={() => setSelectedStudentUid(null)}
                    onSaveProfile={handleSaveStudentProfile}
                    onCreateHomeworkForStudent={() => {
                      setEditingAssignment(null);
                      setHomeworkTargetStudent({
                        uid: selectedStudent.uid,
                        name: selectedStudent.rosterName.split('（')[0] || selectedStudent.rosterName,
                      });
                      setHomeworkModalOpen(true);
                    }}
                    onEditAssignment={(asg) => {
                      setHomeworkTargetStudent(null);
                      setEditingAssignment(asg);
                      setHomeworkModalOpen(true);
                    }}
                    onDeleteAssignment={(asg) => void handleDeleteHomework(asg)}
                    onOpenChat={() => {
                      setChatStudentUid(selectedStudent.uid);
                      setSelectedStudentUid(null);
                      setActiveTab('chat');
                    }}
                    onToast={showToast}
                    onOpenWritingTab={() => {
                      setSelectedStudentUid(null);
                      setActiveTab('writing_review');
                    }}
                    onOpenSpeakingTab={() => {
                      setSelectedStudentUid(null);
                      setActiveTab('speaking_review');
                    }}
                  />
                </div>
              ) : (
                <section
                  aria-label="生徒一覧"
                  className="sg-stagger sg-grid-14"
                >
                  {/* 0名時：生徒招待キットをその場に提示 */}
                  {!sourceInfo.isDemo && sourceInfo.joinCode && kpi.count === 0 && (
                    <Card className="sg-grid-10">
                      <div className="sg-toolbar">
                        <div>
                          <strong style={{ font: '800 15px/1.3 var(--mt-font-display)', color: 'var(--mt-ink-warm)' }}>
                            {sourceInfo.className || 'コース開設完了'}（招待コード: {sourceInfo.joinCode}）
                          </strong>
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--mt-ink-2)' }}>
                            生徒のアプリ「設定 ＞ クラス」から6文字コード <b>{sourceInfo.joinCode}</b> を入力するか、招待URLを送ると参加と同時にここに表示されます。
                          </p>
                        </div>
                        <div className="sg-chip-group">
                          <PrimaryButton
                            onClick={() => void handleCopyInviteLineTemplate()}
                            icon={<MessageCircle size={14} aria-hidden="true" />}
                          >
                            LINE案内文コピー
                          </PrimaryButton>
                          <SecondaryButton
                            onClick={() => void handleCopyInviteUrl()}
                            icon={<Link2 size={14} aria-hidden="true" />}
                          >
                            招待URLコピー
                          </SecondaryButton>
                          <SecondaryButton
                            onClick={() => void handleCopyJoinCode()}
                            icon={<Copy size={14} aria-hidden="true" />}
                          >
                            コード {sourceInfo.joinCode}
                          </SecondaryButton>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* 1. フルワイド4項目サマリー帯（在籍/遅れ・今週平均・宿題消化・一括提出/添削待ち） */}
                  <div className="sg-summary-strip sg-summary-strip-wide">
                    <div className="sg-stat">
                      <div className="sg-stat-body">
                        <span className="sg-stat-label">在籍 / 要フォロー</span>
                        <span className="sg-stat-val">
                          <CountUp value={kpi.count} fromZero duration={550} />
                          <span className="sg-stat-unit">名</span>
                          {kpi.alertCount > 0 && (
                            <span className="sg-stat-alert-inline">
                              · {kpi.alertCount}名遅れ
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="sg-stat">
                      <div className="sg-stat-body">
                        <span className="sg-stat-label">今週平均</span>
                        <span className="sg-stat-val">
                          <CountUp value={kpi.avgWeeklyMin} fromZero duration={650} />
                          <span className="sg-stat-unit">分</span>
                        </span>
                      </div>
                    </div>

                    <div className="sg-stat sg-stat-between">
                      <div className="sg-stat-body">
                        <span className="sg-stat-label">宿題消化</span>
                        <span className="sg-stat-val">
                          <CountUp value={kpi.avgHomeworkPct} fromZero duration={700} />
                          <span className="sg-stat-unit">%</span>
                        </span>
                      </div>
                      <ScoreRing
                        rate={kpi.avgHomeworkPct / 100}
                        size={36}
                        stroke={5}
                        tone="brand"
                      />
                    </div>

                    <div className="sg-stat">
                      <div className="sg-stat-body">
                        <span className="sg-stat-label">一括提出 / 添削待ち</span>
                        <span className="sg-stat-val" data-alert={kpi.totalPendingSubmissions > 0 || undefined}>
                          <CountUp value={kpi.totalPendingSubmissions} fromZero duration={600} />
                          <span className="sg-stat-unit">件</span>
                          {kpi.totalReasons > 0 && (
                            <span style={{ marginLeft: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--mt-ink-2)' }}>
                              · 理由/振り返り {kpi.totalReasons}件
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. フィルタ・宿題配信・CSV出力 */}
                  <div className="sg-toolbar">
                    <div className="sg-chip-group" role="group" aria-label="絞り込み">
                      {[
                        { id: 'all', label: '全員（全級一括）' },
                        { id: 'eiken_1', label: '1級' },
                        { id: 'eiken_pre1', label: '準1級' },
                        { id: 'eiken_2', label: '2級' },
                        { id: 'eiken_pre2plus', label: '準2級+' },
                        { id: 'eiken_pre2', label: '準2級' },
                        { id: 'eiken_3', label: '3級' },
                        { id: 'eiken_4', label: '4級' },
                        { id: 'eiken_5', label: '5級' },
                      ].map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          className="sg-chip"
                          aria-pressed={gradeFilter === g.id}
                          onClick={() => setGradeFilter(g.id)}
                        >
                          {g.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="sg-chip"
                        aria-pressed={onlyAlerts}
                        onClick={() => setOnlyAlerts((v) => !v)}
                      >
                        要フォローのみ
                      </button>
                    </div>

                    <div className="sg-chip-group">
                      <PrimaryButton
                        onClick={() => {
                          setEditingAssignment(null);
                          setHomeworkTargetStudent(null);
                          setHomeworkModalOpen(true);
                        }}
                        icon={<Plus size={14} aria-hidden="true" />}
                      >
                        クラス全員・指定生徒に課題を出す
                      </PrimaryButton>
                      <SecondaryButton
                        disabled={filteredStudents.length === 0}
                        onClick={handleExportSummaryCsv}
                        icon={<Download size={14} aria-hidden="true" />}
                      >
                        CSV
                      </SecondaryButton>
                    </div>
                  </div>

                  {/* 3. フルワイド1画面2ペイン：左＝生徒一覧（解いた単元・設問数・提出バッジ付き）、右＝一括提出・解いた問題ライブフィード＆配信中課題 */}
                  <div className="sg-wide-workspace" data-testid="sugoroku-wide-workspace">
                    <div className="sg-wide-main">
                      {filteredStudents.length === 0 ? (
                        <Card className="slog-empty">該当する生徒がいません</Card>
                      ) : (
                        <ul className="sg-student-list sg-stagger">
                          {filteredStudents.map((st) => {
                            const alertLevel = st.alerts.some((a) => a.severity === 'critical')
                              ? 'critical'
                              : st.alerts.length > 0
                                ? 'warning'
                                : undefined;
                            const primaryAlert = st.alerts[0] ?? null;

                            const totalCorrect = st.gradeSkillBreakdown.reduce(
                              (sum, g) => sum + g.correct,
                              0,
                            );
                            const totalJudged = st.gradeSkillBreakdown.reduce(
                              (sum, g) => sum + g.totalQuestions,
                              0,
                            );
                            const overallAccuracyPct =
                              totalJudged > 0 ? Math.round((totalCorrect / totalJudged) * 100) : null;

                            const studentChapters = studentActivitiesByUid[st.uid] ?? [];
                            const studentReasonCount = sourceInfo.answerReasons.filter(
                              (r) => r.uid === st.uid,
                            ).length;

                            return (
                              <SwipeableRow
                                key={st.uid}
                                leftAction={{
                                  id: 'encourage',
                                  label: '声掛け',
                                  icon: <MessageCircle size={17} aria-hidden="true" />,
                                  onTrigger: () => void handleCopyStudentLineMessage(st),
                                }}
                                rightActions={[
                                  {
                                    id: 'sheet',
                                    label: '概要',
                                    icon: <Eye size={17} aria-hidden="true" />,
                                    onTrigger: () => setQuickSheetStudentUid(st.uid),
                                  },
                                ]}
                              >
                                <article
                                  className="sg-student-row"
                                  data-alert={alertLevel}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setSelectedStudentUid(st.uid)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setSelectedStudentUid(st.uid);
                                    }
                                  }}
                                >
                                  <div className="sg-row-main">
                                    <div className="sg-row-head">
                                      <h3 className="sg-student-name">{st.rosterName}</h3>
                                      <span className="sg-grade-tag">
                                        {st.gradeSkillBreakdown[0]
                                          ? getGradeLabel(st.gradeSkillBreakdown[0].grade as EikenGrade).replace('英検', '')
                                          : getGradeLabel(st.targetGrade).replace('英検', '')}
                                      </span>
                                      {primaryAlert && (
                                        <span
                                          className="sg-alert-text"
                                          data-warn={primaryAlert.severity === 'warning' || undefined}
                                        >
                                          {primaryAlert.label}
                                        </span>
                                      )}
                                      {(st.pendingWritingCount > 0 || st.pendingSpeakingCount > 0) && (
                                        <span className="sg-pending-sub-pill">
                                          未確認提出 {st.pendingWritingCount + st.pendingSpeakingCount}件
                                        </span>
                                      )}
                                      {studentReasonCount > 0 && (
                                        <span
                                          className="sg-grade-tag"
                                          style={{ background: '#e0f2fe', color: '#075985' }}
                                        >
                                          一括/理由 {studentReasonCount}件
                                        </span>
                                      )}
                                    </div>

                                    <div className="sg-row-sub">
                                      <span>
                                        今週 <b>{formatDurationJa(st.weeklyActiveSeconds)}</b>
                                      </span>
                                      <span>
                                        本日 <b>{formatDurationJa(st.todayActiveSeconds)}</b>
                                      </span>
                                      <span>
                                        宿題 <b>{st.homework.completionRate}%</b>
                                        {st.homework.activeAssignmentTitle
                                          ? `（${st.homework.completedProblems}/${st.homework.totalProblems}問）`
                                          : '（未配信）'}
                                      </span>
                                      {overallAccuracyPct !== null && (
                                        <span>
                                          正答 <b>{overallAccuracyPct}%</b>
                                        </span>
                                      )}
                                    </div>

                                    {studentChapters.length > 0 && (
                                      <div className="sg-row-solved-strip" aria-label="直近で解いた単元">
                                        {studentChapters.slice(0, 3).map((ch) => (
                                          <span
                                            key={ch.chapterId}
                                            className="sg-solved-unit-pill"
                                            data-has-wrong={ch.wrongQuestionCount > 0 ? 'true' : undefined}
                                          >
                                            <span>[{ch.gradeShortLabel}] {ch.chapterTitle}</span>
                                            <b>{ch.solvedCount}/{ch.totalProblems}問</b>
                                            {ch.wrongQuestionCount > 0 && (
                                              <span>(×{ch.wrongQuestionCount})</span>
                                            )}
                                          </span>
                                        ))}
                                        {studentChapters.length > 3 && (
                                          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mt-ink-3)' }}>
                                            +{studentChapters.length - 3}単元
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    <SkillRatioStackBar
                                      items={st.gradeSkillBreakdown.map((g) => ({
                                        key: g.key,
                                        skill: g.skill,
                                        label: g.label,
                                        seconds: g.weeklySeconds > 0 ? g.weeklySeconds : g.totalSeconds,
                                      }))}
                                    />
                                  </div>

                                  <div className="sg-row-right">
                                    <StudyDoorsWeek recentDailyLogs={st.recentDailyLogs} />

                                    <button
                                      type="button"
                                      className="sg-quick-hw-btn"
                                      title={`${st.rosterName}に個別課題を出す`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingAssignment(null);
                                        setHomeworkTargetStudent({
                                          uid: st.uid,
                                          name: st.rosterName.split('（')[0] || st.rosterName,
                                        });
                                        setHomeworkModalOpen(true);
                                      }}
                                    >
                                      <Plus size={13} aria-hidden="true" />
                                      課題
                                    </button>

                                    <button
                                      type="button"
                                      className="sg-icon-btn"
                                      aria-label={`${st.rosterName}とチャット`}
                                      title="1対1チャットを開く"
                                      style={
                                        (chatThreadsByUid[st.uid]?.unreadByTeacher || 0) > 0
                                          ? { background: '#06C755', color: '#fff', borderColor: '#06C755' }
                                          : undefined
                                      }
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setChatStudentUid(st.uid);
                                        setActiveTab('chat');
                                      }}
                                    >
                                      <MessageCircle size={15} />
                                    </button>

                                    <ChevronRight
                                      size={18}
                                      className="sg-row-chevron"
                                      aria-hidden="true"
                                    />
                                  </div>
                                </article>
                              </SwipeableRow>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {/* 右サイド：誰がどの問題を解いたか＆一括提出タイムライン ＋ 現在配信中の課題 */}
                    <aside
                      className="sg-wide-side"
                      aria-label="一括提出・解いた問題フィードと配信中課題"
                      data-testid="sugoroku-live-submission-panel"
                    >
                      <Card className="sg-grid-10">
                        <div className="sg-toolbar">
                          <div>
                            <strong style={{ font: '800 14.5px/1.3 var(--mt-font-display)', color: 'var(--mt-ink-warm)' }}>
                              一括提出 ＆ 解いた問題の最新フィード
                            </strong>
                            <small style={{ display: 'block', fontSize: 11.5, color: 'var(--mt-ink-3)' }}>
                              クリックするとその生徒の設問別（問1 ○/×）または添削画面へ直行
                            </small>
                          </div>
                        </div>

                        {liveSubmissionFeed.length === 0 ? (
                          <p className="sg-student-note">
                            生徒が問題を解くか、筆記・英作文・スピーキングで「一括提出」を行うと、誰が何番の問題に取り組んだかがここにリアルタイム表示されます。
                          </p>
                        ) : (
                          <ul className="sg-feed-list">
                            {liveSubmissionFeed.map((ev) => (
                              <li key={ev.id}>
                                <button
                                  type="button"
                                  className="sg-feed-item"
                                  onClick={() => {
                                    if (ev.kind === 'writing') {
                                      setActiveTab('writing_review');
                                    } else if (ev.kind === 'speaking') {
                                      setActiveTab('speaking_review');
                                    } else {
                                      setSelectedStudentUid(ev.studentUid);
                                    }
                                  }}
                                >
                                  <div className="sg-feed-top">
                                    <span className="sg-feed-badge" data-tone={ev.tone}>
                                      {ev.badgeText}
                                    </span>
                                    <span className="sg-feed-time">
                                      {formatShortTimestampJa(ev.timestampMs)}
                                    </span>
                                  </div>
                                  <div className="sg-feed-student">{ev.studentName}</div>
                                  <div className="sg-feed-title">{ev.title}</div>
                                  <p className="sg-feed-sub">{ev.subtitle}</p>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Card>

                      <Card className="sg-grid-10">
                        <div className="sg-toolbar">
                          <strong style={{ font: '800 14.5px/1.3 var(--mt-font-display)', color: 'var(--mt-ink-warm)' }}>
                            配信中の課題（{sourceInfo.assignments.length}件）
                          </strong>
                          <button
                            type="button"
                            className="sg-quick-hw-btn"
                            onClick={() => {
                              setEditingAssignment(null);
                              setHomeworkTargetStudent(null);
                              setHomeworkModalOpen(true);
                            }}
                          >
                            <Plus size={12} aria-hidden="true" />
                            追加
                          </button>
                        </div>

                        {sourceInfo.assignments.length === 0 ? (
                          <p className="sg-student-note">
                            まだ課題が配信されていません。「＋ 追加」または「教材PDF」タブの合格ルートからワンタップで出題できます。
                          </p>
                        ) : (
                          <div className="sg-grid-8">
                            {sourceInfo.assignments.slice(0, 5).map((asg) => {
                              const isInd =
                                Array.isArray(asg.targetStudentUids) &&
                                asg.targetStudentUids.length > 0;
                              const totalProbs = asg.chapterIds.reduce(
                                (sum, cid) => sum + (chapterTotalsMap[cid] || 0),
                                0,
                              );
                              return (
                                <div
                                  key={asg.id}
                                  style={{
                                    padding: '9px 11px',
                                    borderRadius: 12,
                                    border: '1px solid var(--mt-line)',
                                    background: 'var(--mt-bg-screen)',
                                    display: 'grid',
                                    gap: 4,
                                  }}
                                >
                                  <div className="sg-feed-top">
                                    <span
                                      className="sg-feed-badge"
                                      data-tone={isInd ? 'blue' : 'teal'}
                                    >
                                      {isInd
                                        ? `個別指定 (${asg.targetStudentUids?.length}名)`
                                        : 'クラス全員'}
                                    </span>
                                    <span className="sg-feed-time">
                                      締切 {formatDue(asg.dueAt)}
                                    </span>
                                  </div>
                                  <strong style={{ fontSize: 12.5, color: 'var(--mt-ink-warm)' }}>
                                    {asg.title}
                                  </strong>
                                  <small style={{ fontSize: 11.5, color: 'var(--mt-ink-3)' }}>
                                    {asg.chapterIds.slice(0, 2).map((cid) => chapterTitleOf(cid)).join(' / ')}
                                    {asg.chapterIds.length > 2 ? ` ほか+${asg.chapterIds.length - 2}` : ''}
                                    {totalProbs > 0 ? `（計${totalProbs}問）` : ''}
                                  </small>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Card>
                    </aside>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </PullToRefreshHost>

      {/* Bottom Sheet：概要＆声掛け */}
      <SugorokuBottomSheet
        open={!!quickSheetStudent}
        title={quickSheetStudent ? quickSheetStudent.rosterName : '概要'}
        onClose={() => setQuickSheetStudentUid(null)}
      >
        {quickSheetStudent && (
          <div className="sg-grid-12">
            <div className="slog-sum">
              <div>
                <dt>今週</dt>
                <dd>{formatDurationJa(quickSheetStudent.weeklyActiveSeconds)}</dd>
              </div>
              <div>
                <dt>本日</dt>
                <dd>{formatDurationJa(quickSheetStudent.todayActiveSeconds)}</dd>
              </div>
              <div>
                <dt>宿題</dt>
                <dd>{quickSheetStudent.homework.completionRate}%</dd>
              </div>
            </div>

            <SkillRatioStackBar
              items={quickSheetStudent.gradeSkillBreakdown.map((g) => ({
                key: g.key,
                skill: g.skill,
                label: g.label,
                seconds: g.weeklySeconds > 0 ? g.weeklySeconds : g.totalSeconds,
              }))}
            />

            <div className="slog-rows">
              {quickSheetStudent.gradeSkillBreakdown.slice(0, 4).map((g) => (
                <div key={g.key} className="slog-row">
                  <span>
                    <strong>{g.label.replace(/^英検/, '')}</strong>
                    {g.accuracyPct !== null && <small>正答率 {g.accuracyPct}%</small>}
                  </span>
                  <b>{formatDurationJa(g.weeklySeconds > 0 ? g.weeklySeconds : g.totalSeconds)}</b>
                </div>
              ))}
            </div>

            <div className="sg-flex-gap-8">
              <SecondaryButton
                className="sg-flex-1"
                onClick={() => void handleCopyStudentLineMessage(quickSheetStudent)}
                icon={<MessageCircle size={15} aria-hidden="true" />}
              >
                声掛けコピー
              </SecondaryButton>
              <PrimaryButton
                className="sg-flex-1"
                onClick={() => {
                  const uid = quickSheetStudent.uid;
                  setQuickSheetStudentUid(null);
                  setSelectedStudentUid(uid);
                }}
              >
                詳細を開く
              </PrimaryButton>
            </div>
          </div>
        )}
      </SugorokuBottomSheet>

      {/* Bottom Sheet：生徒招待キット ＆ クラス運営操作（この画面から一歩も出ずに完結） */}
      <SugorokuBottomSheet
        open={inviteSheetOpen}
        title={sourceInfo.className ? `「${sourceInfo.className}」の招待・管理` : '生徒招待キット'}
        onClose={() => setInviteSheetOpen(false)}
      >
        <div className="sg-grid-12">
          <div className="slog-sum">
            <div>
              <dt>6文字招待コード</dt>
              <dd style={{ letterSpacing: '0.08em' }}>{sourceInfo.joinCode || '---'}</dd>
            </div>
            <div>
              <dt>1日目標</dt>
              <dd>{activeClassSettings.dailyGoalMinutes}分</dd>
            </div>
            <div>
              <dt>週目標</dt>
              <dd>週{activeClassSettings.weeklyGoalDays}日</dd>
            </div>
          </div>

          <p className="sg-student-note">
            生徒はログイン後、「設定 ＞ クラス」から上記6文字コードを入力するだけで参加でき、塾生は広告も自動で非表示になります。
          </p>

          <div className="sg-grid-8">
            <PrimaryButton
              onClick={() => void handleCopyInviteLineTemplate()}
              icon={<MessageCircle size={15} aria-hidden="true" />}
            >
              LINE・保護者連絡用の案内文をコピー
            </PrimaryButton>
            <div className="sg-flex-gap-8">
              <SecondaryButton
                className="sg-flex-1"
                onClick={() => void handleCopyInviteUrl()}
                icon={<Link2 size={15} aria-hidden="true" />}
              >
                招待URLコピー
              </SecondaryButton>
              <SecondaryButton
                className="sg-flex-1"
                onClick={() => void handleCopyJoinCode()}
                icon={<Copy size={15} aria-hidden="true" />}
              >
                コード {sourceInfo.joinCode}
              </SecondaryButton>
            </div>
            {sourceInfo.joinCode && (
              <SecondaryButton
                onClick={() => {
                  const roomForPrint: ClassroomDoc = activeLiveRoom ?? {
                    id: sourceInfo.classId || 'demo',
                    schoolName: sourceInfo.schoolName || 'すごろく学習塾',
                    className: sourceInfo.className || '全級一括コース（英検5級〜1級）',
                    subject: sourceInfo.subject || 'eiken_2',
                    joinCode: sourceInfo.joinCode,
                    teacherUid: sourceInfo.teacherUid || 'owner',
                    joinOpen: true,
                    plan: 'juku',
                    createdAt: Date.now(),
                  };
                  openClassInviteSheetPrint({
                    room: roomForPrint,
                    settings: activeClassSettings,
                  });
                }}
                icon={<Printer size={15} aria-hidden="true" />}
              >
                教室配布・画面提示用のA4招待シートを開く
              </SecondaryButton>
            )}
          </div>

          {!sourceInfo.isDemo && activeLiveRoom && (
            <div className="sg-staff-add-form sg-grid-8">
              <SecondaryButton
                onClick={() => {
                  setInviteSheetOpen(false);
                  setClassFormMode('edit');
                }}
                icon={<Settings2 size={15} aria-hidden="true" />}
              >
                クラス名・目標時間・参加受付を変更する
              </SecondaryButton>

              <SecondaryButton
                onClick={() => {
                  setInviteSheetOpen(false);
                  setClassFormMode('create');
                }}
                icon={<Plus size={15} aria-hidden="true" />}
              >
                別の新規クラス・コースを追加開設する
              </SecondaryButton>

              {kpi.count === 0 && sourceInfo.viewerRole === 'owner' && (
                <SecondaryButton
                  disabled={deletingClass}
                  onClick={() => void handleDeleteCurrentClass()}
                  icon={<Trash2 size={15} aria-hidden="true" />}
                >
                  {deletingClass ? '削除中…' : 'この空クラスを削除する'}
                </SecondaryButton>
              )}
            </div>
          )}
        </div>
      </SugorokuBottomSheet>

      {/* Bottom Sheet：複数講師メンバー管理 */}
      <SugorokuStaffSheet
        open={staffSheetOpen}
        onClose={() => setStaffSheetOpen(false)}
        viewerRole={sourceInfo.viewerRole}
        viewerUid={user?.uid}
        ownerName={sourceInfo.ownerName}
        ownerEmail={sourceInfo.ownerEmail}
        staffInvites={sourceInfo.staffInvites}
        onInviteStaff={handleInviteStaff}
        onRevokeStaff={handleRevokeStaff}
        onToast={showToast}
      />

      {/* モーダル：クラスの新規開設 ＆ 既存クラスの目標・受付編集（別画面へ飛ばずその場で完結） */}
      {classFormMode && (
        <ClassFormModal
          mode={classFormMode}
          submitting={savingClassForm}
          accent="#3E9C93"
          joinCode={classFormMode === 'edit' ? activeLiveRoom?.joinCode : undefined}
          isJukuPlanActive
          initialValues={
            classFormMode === 'edit' && activeLiveRoom
              ? {
                  schoolName: activeLiveRoom.schoolName || loadLastOrgName() || 'すごろく学習塾',
                  className: activeLiveRoom.className || '',
                  subject: activeLiveRoom.subject || 'eiken_2',
                  joinOpen: activeLiveRoom.joinOpen !== false,
                  orgType: activeClassSettings.orgType,
                  dailyGoalMinutes: activeClassSettings.dailyGoalMinutes,
                  weeklyGoalDays: activeClassSettings.weeklyGoalDays,
                  examSession: activeClassSettings.examSession,
                  focusSkills: activeClassSettings.focusSkills,
                  coachNote: activeClassSettings.coachNote,
                }
              : {
                  schoolName:
                    activeLiveRoom?.schoolName || loadLastOrgName() || 'すごろく学習塾',
                  className: '',
                  subject: 'eiken_2',
                  joinOpen: true,
                  orgType: 'juku',
                  dailyGoalMinutes: 30,
                  weeklyGoalDays: 5,
                  examSession: 'scbt_monthly',
                  focusSkills: ['vocab', 'reading', 'listening', 'writing', 'speaking'],
                  coachNote: '',
                }
          }
          onClose={() => setClassFormMode(null)}
          onSubmit={(values) => void handleSaveClassForm(values)}
        />
      )}

      {/* モーダル：全級対応・宿題一括/個別配信＆編集 */}
      {homeworkModalOpen && (
        <SugorokuHomeworkComposerModal
          subject={sourceInfo.subject || 'eiken_2'}
          catalog={homeworkCatalog}
          students={composerStudents}
          accent="#1c2a39"
          editingAssignment={editingAssignment}
          defaultTargetStudentUids={
            homeworkTargetStudent ? [homeworkTargetStudent.uid] : undefined
          }
          targetStudentLabel={homeworkTargetStudent?.name}
          onClose={() => {
            setEditingAssignment(null);
            setHomeworkTargetStudent(null);
            setHomeworkModalOpen(false);
          }}
          onSubmit={handleSubmitHomework}
        />
      )}
    </div>
  );
}

export default SugorokuAdminApp;
