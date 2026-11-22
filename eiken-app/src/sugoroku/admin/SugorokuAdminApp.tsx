/**
 * すごろく塾 管理者ポータル（エッセンシャル設計）
 * 説明文・装飾色・重複ウィジェットを排し、必要な数値と操作だけを一瞥で扱う。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ChevronRight,
  Copy,
  Download,
  Eye,
  LogIn,
  LogOut,
  MessageCircle,
  RefreshCw,
  Users,
} from 'lucide-react';
import { auth, FIREBASE_CONFIGURED } from '../../firebase';
import { signInWithGoogle, signOutGoogle } from '../../utils/googleAuth';
import { PdfViewerHost } from '../../components/PdfViewer';
import { CountUp } from '../../components/ui/CountUp';
import {
  BackButton,
  Card,
  PrimaryButton,
  SecondaryButton,
} from '../../components/ui';
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
import './sugoroku-admin.css';

export type SugorokuAdminTabId =
  | 'students'
  | 'pdf_shelf'
  | 'writing_review'
  | 'speaking_review';

export interface SugorokuAdminAppProps {
  onBack?: () => void;
  onOpenTeacherDashboard?: () => void;
  initialDataMode?: 'auto' | 'demo' | 'firestore';
  extensionSlots?: SugorokuAdminExtensionSlots;
}

export function SugorokuAdminApp({
  onBack,
  onOpenTeacherDashboard,
  initialDataMode = 'auto',
  extensionSlots,
}: SugorokuAdminAppProps) {
  const [user, setUser] = useState(() => auth.currentUser);
  const [dataMode, setDataMode] = useState<'demo' | 'firestore'>(() => {
    if (initialDataMode === 'demo') return 'demo';
    if (initialDataMode === 'firestore') return 'firestore';
    return FIREBASE_CONFIGURED ? 'firestore' : 'demo';
  });
  const [activeTab, setActiveTab] = useState<SugorokuAdminTabId>('students');
  const [selectedStudentUid, setSelectedStudentUid] = useState<string | null>(null);
  const [quickSheetStudentUid, setQuickSheetStudentUid] = useState<string | null>(null);
  const [staffSheetOpen, setStaffSheetOpen] = useState(false);
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const [skeletonTransition, setSkeletonTransition] = useState(false);
  const [ptrRefreshing, setPtrRefreshing] = useState(false);
  const { toast, showToast, dismissToast } = usePortalToast();

  const [demoBundle, setDemoBundle] = useState<SugorokuDemoBundle>(() =>
    createSugorokuDemoBundle(),
  );

  const [classrooms, setClassrooms] = useState<ClassroomDoc[]>([]);
  const [activeClassId, setActiveClassId] = useState<string>('');
  const [livePortalData, setLivePortalData] = useState<LoadedClassPortalData | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    installRipple();
  }, []);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) return;
    return onAuthStateChanged(auth, (current) => setUser(current));
  }, []);

  const reloadLiveClasses = useCallback(async () => {
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
      if (rooms.length > 0) {
        const nextRoom = rooms.find((r) => r.id === activeClassId) ?? rooms[0];
        setActiveClassId(nextRoom.id);
        const portal = await loadClassPortalData(nextRoom);
        setLivePortalData(portal);
        if (initialDataMode === 'auto') {
          setDataMode('firestore');
        }
      } else {
        setLivePortalData(null);
      }
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'データの取得に失敗しました');
    } finally {
      setLoadingLive(false);
    }
  }, [activeClassId, initialDataMode]);

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

  const sourceInfo = useMemo(() => {
    if (dataMode === 'demo') {
      return {
        isDemo: true,
        viewerRole: 'owner' as const,
        ownerName: demoBundle.ownerName,
        ownerEmail: demoBundle.ownerEmail,
        staffInvites: demoBundle.staffInvites.filter((inv) => inv.status !== 'revoked'),
        classId: demoBundle.classId,
        schoolName: demoBundle.schoolName,
        className: demoBundle.className,
        joinCode: demoBundle.joinCode,
        members: demoBundle.members,
        logsByUid: demoBundle.logsByUid,
        solvedByUid: demoBundle.solvedByUid,
        assignments: demoBundle.assignments,
        writingSubmissions: demoBundle.writingSubmissions,
        speakingSubmissions: demoBundle.speakingSubmissions,
      };
    }
    if (!livePortalData) {
      return {
        isDemo: false,
        viewerRole: 'owner' as const,
        ownerName: user?.displayName || '代表講師',
        ownerEmail: user?.email || undefined,
        staffInvites: [] as SugorokuStaffInviteDoc[],
        classId: '',
        schoolName: '',
        className: '',
        joinCode: '',
        members: [],
        logsByUid: {},
        solvedByUid: {},
        assignments: [],
        writingSubmissions: [],
        speakingSubmissions: [],
      };
    }
    return {
      isDemo: false,
      viewerRole: livePortalData.viewerRole,
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
      members: livePortalData.members,
      logsByUid: livePortalData.logsByUid,
      solvedByUid: livePortalData.solvedByUid,
      assignments: livePortalData.assignments,
      writingSubmissions: livePortalData.writingSubmissions,
      speakingSubmissions: livePortalData.speakingSubmissions,
    };
  }, [dataMode, demoBundle, livePortalData, user]);

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
      if (gradeFilter !== 'all' && s.targetGrade !== gradeFilter) return false;
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

    return {
      count,
      alertCount,
      avgWeeklyMin,
      avgHomeworkPct,
      pendingWriting,
      pendingSpeaking,
    };
  }, [allStudentOverviews, sourceInfo]);

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

  const handleInviteStaff = async (params: { email: string; staffName: string }) => {
    if (dataMode === 'demo') {
      const now = Date.now();
      const next: SugorokuStaffInviteDoc = {
        id: buildStaffInviteId(demoBundle.classId, params.email),
        classId: demoBundle.classId,
        className: demoBundle.className,
        schoolName: demoBundle.schoolName,
        email: params.email,
        staffName: params.staffName,
        role: 'staff',
        status: 'invited',
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
              {onBack && <BackButton label="戻る" onClick={onBack} />}
              <h1>
                <KineticText text="すごろく塾 管理" variant="rise" />
              </h1>
            </div>

            <div className="sg-head-tools">
              {onOpenTeacherDashboard && (
                <button
                  type="button"
                  className="sg-code-btn"
                  onClick={onOpenTeacherDashboard}
                  title="クラスの作成・設定・宿題配信へ移動"
                >
                  クラス管理・作成
                </button>
              )}

              {sourceInfo.joinCode && (
                <button
                  type="button"
                  className="sg-code-btn"
                  onClick={() => void handleCopyJoinCode()}
                  title="招待コードをコピー"
                >
                  <Copy size={13} aria-hidden="true" />
                  {sourceInfo.joinCode}
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
                title="更新"
              >
                <RefreshCw
                  size={15}
                  className={ptrRefreshing || loadingLive ? 'animate-spin' : undefined}
                />
              </button>

              {FIREBASE_CONFIGURED && user && (
                <button
                  type="button"
                  className="sg-icon-btn"
                  onClick={() => void signOutGoogle()}
                  title="ログアウト"
                  aria-label="ログアウト"
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
          </div>

          <nav aria-label="メニュー" className="mt-tabs sg-nav-tabs">
            <button
              type="button"
              aria-current={activeTab === 'students' ? 'page' : undefined}
              onClick={() => setActiveTab('students')}
            >
              <span>生徒</span>
              {kpi.alertCount > 0 && (
                <span className="sg-tab-count" data-alert="true">
                  {kpi.alertCount}
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
            <Card style={{ textAlign: 'center', padding: '24px 18px', display: 'grid', gap: 12, justifyItems: 'center' }}>
              <p className="mt-body" style={{ margin: 0 }}>クラウド接続が未設定です。</p>
            </Card>
          ) : dataMode === 'firestore' && !user ? (
            <Card style={{ textAlign: 'center', padding: '24px 18px', display: 'grid', gap: 12, justifyItems: 'center', maxWidth: 420, margin: '0 auto' }}>
              <h2 className="mt-h2" style={{ margin: 0 }}>管理者ログイン</h2>
              {liveError && <p className="slog-error">{liveError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
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
            <Card style={{ textAlign: 'center', padding: '24px 18px', display: 'grid', gap: 10, justifyItems: 'center' }}>
              <p className="mt-body" style={{ margin: 0 }}>
                管理者権限が確認できませんでした。
              </p>
            </Card>
          ) : dataMode === 'firestore' && !loadingLive && classrooms.length === 0 && activeTab !== 'pdf_shelf' ? (
            <Card
              style={{
                textAlign: 'center',
                padding: '32px 20px',
                display: 'grid',
                gap: 14,
                justifyItems: 'center',
                maxWidth: 520,
                margin: '16px auto',
              }}
            >
              <h2 className="mt-h2" style={{ margin: 0 }}>
                まずはコース・クラスを開設しましょう
              </h2>
              <p className="mt-body" style={{ margin: 0, maxWidth: 420 }}>
                対象級・1日の目標学習時間・週の目標日数を設定してクラスを開設すると、招待URL・6文字コード・LINE案内文が発行され、生徒の学習時間と4技能添削をここで一括管理できます。
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                {onOpenTeacherDashboard && (
                  <PrimaryButton onClick={onOpenTeacherDashboard}>
                    コース・クラスを開設する
                  </PrimaryButton>
                )}
                <SecondaryButton onClick={() => setActiveTab('pdf_shelf')}>
                  先に教材PDF書庫を見る
                </SecondaryButton>
              </div>
            </Card>
          ) : (
            <>
              {dataMode === 'firestore' && classrooms.length > 1 && (
                <div className="sg-chip-group" role="group" aria-label="クラス">
                  {classrooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      className="sg-chip"
                      aria-pressed={room.id === activeClassId}
                      onClick={() => void handleSelectLiveClass(room.id)}
                    >
                      {room.className}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'pdf_shelf' ? (
                <SugorokuPdfShelfTab onToast={showToast} />
              ) : activeTab === 'writing_review' ? (
                <SugorokuWritingExtensionSlot
                  classId={sourceInfo.classId}
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
                  isDemoMode={sourceInfo.isDemo}
                  submissions={sourceInfo.speakingSubmissions}
                  customRender={extensionSlots?.renderSpeakingReviewTab}
                  onSelectStudent={(uid) => {
                    setSelectedStudentUid(uid);
                    setActiveTab('students');
                  }}
                />
              ) : selectedStudent ? (
                <SugorokuStudentDetailView
                  student={selectedStudent}
                  isDemoMode={sourceInfo.isDemo}
                  onBack={() => setSelectedStudentUid(null)}
                  onSaveProfile={handleSaveStudentProfile}
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
              ) : (
                <section
                  aria-label="生徒一覧"
                  className="sg-stagger"
                  style={{ display: 'grid', gap: 14 }}
                >
                  {/* 1. 静かな3項目サマリー帯 */}
                  <div className="sg-summary-strip">
                    <div className="sg-stat">
                      <div className="sg-stat-body">
                        <span className="sg-stat-label">在籍 / 要フォロー</span>
                        <span className="sg-stat-val">
                          <CountUp value={kpi.count} fromZero duration={550} />
                          <span className="sg-stat-unit">名</span>
                          {kpi.alertCount > 0 && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 13,
                                fontWeight: 800,
                                color: 'var(--mt-danger)',
                              }}
                            >
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

                    <div className="sg-stat" style={{ justifyContent: 'space-between' }}>
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
                  </div>

                  {/* 2. フィルタ＆CSV出力 */}
                  <div className="sg-toolbar">
                    <div className="sg-chip-group" role="group" aria-label="絞り込み">
                      {[
                        { id: 'all', label: '全員' },
                        { id: 'eiken_2', label: '2級' },
                        { id: 'eiken_pre2plus', label: '準2級+' },
                        { id: 'eiken_pre2', label: '準2級' },
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

                    <SecondaryButton
                      disabled={filteredStudents.length === 0}
                      onClick={handleExportSummaryCsv}
                      icon={<Download size={14} aria-hidden="true" />}
                    >
                      CSV
                    </SecondaryButton>
                  </div>

                  {/* 3. 生徒リスト（遅れ・未学習が自動で上位ソート） */}
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
                              {
                                id: 'detail',
                                label: '詳細',
                                icon: <ChevronRight size={17} aria-hidden="true" />,
                                onTrigger: () => setSelectedStudentUid(st.uid),
                              },
                            ]}
                          >
                            <article
                              className="sg-student-row"
                              data-alert={alertLevel}
                              onClick={() => setSelectedStudentUid(st.uid)}
                            >
                              <div className="sg-row-primary">
                                <div className="sg-row-head">
                                  <h3 className="sg-student-name">{st.rosterName}</h3>
                                  <span className="sg-grade-tag">
                                    {getGradeLabel(st.targetGrade).replace('英検', '')}
                                  </span>
                                  {primaryAlert && (
                                    <span
                                      className="sg-alert-text"
                                      data-warn={
                                        primaryAlert.severity !== 'critical' ? 'true' : undefined
                                      }
                                    >
                                      {primaryAlert.label}
                                    </span>
                                  )}
                                </div>

                                <div className="sg-row-sub">
                                  <StudyDoorsWeek recentDailyLogs={st.recentDailyLogs} />
                                  <span>
                                    最終 {st.lastStudiedDateKey ? st.lastStudiedDateKey.slice(5) : '未学習'}
                                  </span>
                                </div>
                              </div>

                              <div className="sg-row-metrics">
                                <div className="sg-num-cell">
                                  <small>今週</small>
                                  <strong>{formatDurationJa(st.weeklyActiveSeconds)}</strong>
                                </div>

                                <div className="sg-ring-cell" title="宿題消化率">
                                  <ScoreRing
                                    rate={st.homework.completionRate / 100}
                                    size={32}
                                    stroke={4.5}
                                    tone={st.homework.overdueCount > 0 ? 'warn' : 'brand'}
                                  />
                                  <strong>{st.homework.completionRate}%</strong>
                                </div>

                                <button
                                  type="button"
                                  className="sg-icon-btn"
                                  aria-label={`${st.rosterName}の概要`}
                                  title="概要シート"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuickSheetStudentUid(st.uid);
                                  }}
                                >
                                  <Eye size={15} />
                                </button>

                                <ChevronRight
                                  size={18}
                                  style={{ color: 'var(--mt-ink-3)', flexShrink: 0 }}
                                  aria-hidden="true"
                                />
                              </div>
                            </article>
                          </SwipeableRow>
                        );
                      })}
                    </ul>
                  )}
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
          <div style={{ display: 'grid', gap: 12 }}>
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

            <div style={{ display: 'flex', gap: 8 }}>
              <SecondaryButton
                style={{ flex: 1 }}
                onClick={() => void handleCopyStudentLineMessage(quickSheetStudent)}
                icon={<MessageCircle size={15} aria-hidden="true" />}
              >
                声掛けコピー
              </SecondaryButton>
              <PrimaryButton
                style={{ flex: 1 }}
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

      {/* Bottom Sheet：複数講師メンバー管理 */}
      <SugorokuStaffSheet
        open={staffSheetOpen}
        onClose={() => setStaffSheetOpen(false)}
        viewerRole={sourceInfo.viewerRole}
        ownerName={sourceInfo.ownerName}
        ownerEmail={sourceInfo.ownerEmail}
        staffInvites={sourceInfo.staffInvites}
        onInviteStaff={handleInviteStaff}
        onRevokeStaff={handleRevokeStaff}
        onToast={showToast}
      />
    </div>
  );
}

export default SugorokuAdminApp;
