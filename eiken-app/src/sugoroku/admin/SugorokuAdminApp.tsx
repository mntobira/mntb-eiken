/**
 * ===================================================================
 * すごろく塾 管理者ポータル（SugorokuAdminApp.tsx — マナトビ純正UI・フルモーション版）
 * ===================================================================
 * マナトビ本体（tokens.css / system.css / motion.css / TobiraBuddy / KineticText / ScoreRing / CountUp）
 * の世界観と手触りに完全統一し、以下すべてのネイティブ級UI/UX機構を搭載：
 *
 *  1. Kinetic Typography … `KineticText` によるタイトル・見出しの1文字立ち上がり＆ポップ演出
 *  2. UI/UX Animation    … `.mt-tabs` スプリング浮上、`.sg-stagger` カード順次入場、MoRipple 波紋連動
 *  3. Infographic Anim   … `ScoreRing` 円弧描画、`CountUp` カウントアップ、`StudyDoorsWeek` 7枚扉回転、
 *                          `SkillRatioStackBar` ＆ `.mt-progress` シャイン光沢バー
 *  4. Pull to Refresh    … 画面上端からの下スワイプ（ゴム減衰＋回転ホイール）で最新ログを再同期
 *  5. Skeleton Screen    … モード切替・再同期中のシマー骨格スクリーン（レイアウトシフトゼロ）
 *  6. Toast              … コピー・CSV保存・更新・名簿保存すべての操作に対するスプリングトースト
 *  7. Bottom Sheet       … 生徒クイックサマリーシート・名簿編集シート・PDF分冊シート（下ドラッグ閉鎖対応）
 *  8. Swipe Action       … 塾生行の左右スワイプで「声掛け文コピー」「クイックシート」「詳細ログ」を即実行
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Download,
  Eye,
  FileEdit,
  LogIn,
  LogOut,
  MessageCircleHeart,
  Mic,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import { auth, FIREBASE_CONFIGURED } from '../../firebase';
import { signInWithGoogle, signOutGoogle } from '../../utils/googleAuth';
import { PdfViewerHost } from '../../components/PdfViewer';
import { TobiraBuddy } from '../../components/TobiraBuddy';
import { CountUp } from '../../components/ui/CountUp';
import {
  BackButton,
  Badge,
  Card,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from '../../components/ui';
import { KineticText, ScoreRing, installRipple } from '../../motion';
import type { ClassroomDoc } from '../../utils/classroomCore';
import type { EikenGrade } from '../../eiken/config';
import type { SugorokuAdminExtensionSlots } from '../shared/types';
import {
  buildStudentOverview,
  buildSugorokuSummaryCsv,
  formatDateKey,
  formatDurationJa,
  getGradeLabel,
  sortStudentsByAlertPriority,
  toMinutesRounded,
  type SugorokuStudentOverview,
} from './adminAnalytics';
import { createSugorokuDemoBundle, type SugorokuDemoBundle } from './demoData';
import {
  fetchManageableClassrooms,
  isEmailPreAuthorizedAdmin,
  loadClassPortalData,
  updateSugorokuStudentProfile,
  type LoadedClassPortalData,
} from './firestoreAdminService';
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
  initialDataMode?: 'auto' | 'demo' | 'firestore';
  extensionSlots?: SugorokuAdminExtensionSlots;
}

export function SugorokuAdminApp({
  onBack,
  initialDataMode = 'auto',
  extensionSlots,
}: SugorokuAdminAppProps) {
  const [user, setUser] = useState(() => auth.currentUser);
  const [dataMode, setDataMode] = useState<'demo' | 'firestore'>(() =>
    initialDataMode === 'firestore' && FIREBASE_CONFIGURED ? 'firestore' : 'demo',
  );
  const [activeTab, setActiveTab] = useState<SugorokuAdminTabId>('students');
  const [selectedStudentUid, setSelectedStudentUid] = useState<string | null>(null);
  const [quickSheetStudentUid, setQuickSheetStudentUid] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  // Skeleton Screen & Pull-to-Refresh 状態
  const [skeletonTransition, setSkeletonTransition] = useState(false);
  const [ptrRefreshing, setPtrRefreshing] = useState(false);

  // Toast フック
  const { toast, showToast, dismissToast } = usePortalToast();

  // デモデータ状態
  const [demoBundle, setDemoBundle] = useState<SugorokuDemoBundle>(() =>
    createSugorokuDemoBundle(),
  );

  // Firestore実データ状態
  const [classrooms, setClassrooms] = useState<ClassroomDoc[]>([]);
  const [activeClassId, setActiveClassId] = useState<string>('');
  const [livePortalData, setLivePortalData] = useState<LoadedClassPortalData | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // マナトビ共通の波紋（MoRipple）を確実に有効化
  useEffect(() => {
    installRipple();
  }, []);

  // Firebase Auth 購読
  useEffect(() => {
    if (!FIREBASE_CONFIGURED) return;
    return onAuthStateChanged(auth, (current) => {
      setUser(current);
    });
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
      setLiveError(e instanceof Error ? e.message : 'Firestoreデータの取得に失敗しました。');
    } finally {
      setLoadingLive(false);
    }
  }, [activeClassId, initialDataMode]);

  useEffect(() => {
    if (user && FIREBASE_CONFIGURED) {
      void reloadLiveClasses();
    }
  }, [user, reloadLiveClasses]);

  /** モード切替時に短時間のSkeleton Screenを挟み、視覚的な切り替わりを滑らかにする */
  const switchDataMode = (nextMode: 'demo' | 'firestore') => {
    if (nextMode === dataMode) return;
    setSelectedStudentUid(null);
    setQuickSheetStudentUid(null);
    setSkeletonTransition(true);
    setDataMode(nextMode);
    window.setTimeout(() => {
      setSkeletonTransition(false);
      showToast(
        nextMode === 'demo'
          ? '試作デモデータ（6名サンプル）に切り替えました'
          : '本番Firestore接続モードに切り替えました',
      );
    }, 320);
  };

  /** Pull to Refresh または更新ボタン押下時 */
  const handlePullRefresh = async () => {
    setPtrRefreshing(true);
    try {
      if (dataMode === 'demo') {
        await new Promise((r) => window.setTimeout(r, 420));
        setDemoBundle((prev) => ({ ...createSugorokuDemoBundle(), members: prev.members }));
        showToast('最新の学習タイムログを集計しました', 'done');
      } else {
        await reloadLiveClasses();
        showToast('Firestoreから最新の塾生ログを同期しました', 'done');
      }
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
      showToast(`「${room.className}」を読み込みました`, 'done');
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'クラスデータの読み込みに失敗しました。');
    } finally {
      setLoadingLive(false);
    }
  };

  const sourceInfo = useMemo(() => {
    if (dataMode === 'demo') {
      return {
        isDemo: true,
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
        classId: '',
        schoolName: 'オンライン個別指導塾 すごろく',
        className: '担当クラス未選択',
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
      classId: livePortalData.classroom.id,
      schoolName: livePortalData.classroom.schoolName || 'オンライン個別指導塾 すごろく',
      className: livePortalData.classroom.className,
      joinCode: livePortalData.classroom.joinCode,
      members: livePortalData.members,
      logsByUid: livePortalData.logsByUid,
      solvedByUid: livePortalData.solvedByUid,
      assignments: livePortalData.assignments,
      writingSubmissions: livePortalData.writingSubmissions,
      speakingSubmissions: livePortalData.speakingSubmissions,
    };
  }, [dataMode, demoBundle, livePortalData]);

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
    const alertStudents = allStudentOverviews.filter((s) => s.alerts.length > 0);
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

    // クラス全体の分野別合計（全体スタックバー用）
    const classSkillMap = new Map<string, { key: string; skill: string; label: string; seconds: number }>();
    for (const s of allStudentOverviews) {
      for (const g of s.gradeSkillBreakdown) {
        const cur = classSkillMap.get(g.skill) ?? {
          key: g.skill,
          skill: g.skill,
          label: g.label.replace(/^英検\S+\s+/, ''),
          seconds: 0,
        };
        cur.seconds += g.weeklySeconds > 0 ? g.weeklySeconds : g.totalSeconds;
        classSkillMap.set(g.skill, cur);
      }
    }

    return {
      count,
      alertCount: alertStudents.length,
      alertStudents,
      avgWeeklySec: count > 0 ? Math.round(totalWeeklySec / count) : 0,
      avgWeeklyMin,
      avgHomeworkPct,
      pendingWriting,
      pendingSpeaking,
      classSkillItems: [...classSkillMap.values()],
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
    a.download = `すごろく塾生学習サマリー_${safeClass}_${formatDateKey(Date.now())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`塾生${filteredStudents.length}名分の学習サマリーCSVを保存しました`, 'done');
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

  const handleCopyJoinCode = async () => {
    if (!sourceInfo.joinCode) return;
    try {
      await navigator.clipboard.writeText(sourceInfo.joinCode);
      showToast(`クラス招待コード「${sourceInfo.joinCode}」をコピーしました`, 'done');
    } catch {
      showToast('招待コードをコピーできませんでした', 'warn');
    }
  };

  const handleCopyStudentLineMessage = async (st: SugorokuStudentOverview) => {
    try {
      await navigator.clipboard.writeText(buildLineEncourageMessage(st));
      showToast(`「${st.rosterName}」への声掛け文をコピーしました！`, 'done');
    } catch {
      showToast('声掛け文のコピーに失敗しました', 'warn');
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setLiveError(null);
    try {
      const outcome = await signInWithGoogle();
      if (!outcome.ok && !outcome.cancelled && !outcome.redirecting) {
        setLiveError(outcome.message || 'Googleログインに失敗しました。');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const isAuthorizedForLive =
    !!user && (classrooms.length > 0 || isEmailPreAuthorizedAdmin(user.email));

  const showSkeleton = skeletonTransition || (dataMode === 'firestore' && loadingLive && !livePortalData);

  // とびら君バディのセリフ（状況に応じて生き生きと変化）
  const buddyLine = useMemo(() => {
    if (dataMode === 'demo') {
      return `すごろく塾 管理者ポータルへようこそ！いま${kpi.alertCount}人の生徒に声掛けチャンスがあるよ。行を左右にスワイプすると声掛け文もすぐコピーできるよ！`;
    }
    if (kpi.alertCount > 0) {
      return `先生おつかれさま！未学習・宿題遅れの子が${kpi.alertCount}人いるよ。上から順番に声を掛けてみよう！`;
    }
    return '全員いいペースで扉を開けているよ！面談用CSVやプリント棚もすぐ使えるよ！';
  }, [dataMode, kpi.alertCount]);

  return (
    <div data-sugoroku-admin-portal="true" className="sg-screen mt-screen">
      {/* アプリ内PDFビューアホスト */}
      <PdfViewerHost />

      {/* ポータル共通トースト */}
      <SugorokuToast toast={toast} onDismiss={dismissToast} />

      {/* 1. 上部スティッキーヘッダー（マナトビ純正丸ゴシック＋KineticText＋セグメントタブ） */}
      <header className="sg-topbar">
        <div className="sg-topbar-inner">
          <div className="sg-brand-row">
            <div className="sg-title-group">
              {onBack && <BackButton label="戻る" onClick={onBack} />}
              <img
                src="/brand/manatobi-logo-gray.png"
                alt="マナトビ"
                width={118}
                height={38}
                style={{ height: 28, width: 'auto', flexShrink: 0 }}
              />
              <div className="sg-title-text">
                <span className="mt-kicker">SUGOROKU JUKU PORTAL</span>
                <h1>
                  <KineticText text="すごろく塾 管理者ポータル" variant="rise" />
                </h1>
              </div>
            </div>

            {/* データモード切替ピル ＋ ログアウト */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <div className="sg-mode-pill" role="group" aria-label="データ表示モード切替">
                <button
                  type="button"
                  aria-pressed={dataMode === 'demo'}
                  onClick={() => switchDataMode('demo')}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  試作デモデータ
                </button>
                <button
                  type="button"
                  data-live="true"
                  aria-pressed={dataMode === 'firestore'}
                  onClick={() => switchDataMode('firestore')}
                >
                  <Database size={14} aria-hidden="true" />
                  本番Firestore接続
                </button>
              </div>

              {FIREBASE_CONFIGURED && user && (
                <SecondaryButton
                  onClick={() => void signOutGoogle()}
                  icon={<LogOut size={15} aria-hidden="true" />}
                  title={user.email || 'ログアウト'}
                >
                  ログアウト
                </SecondaryButton>
              )}
            </div>
          </div>

          {/* 4つのメインタブ（マナトビ純正 .mt-tabs：選択時にスプリングで浮く） */}
          <nav
            aria-label="管理者ポータルメニュー"
            className="mt-tabs sg-nav-tabs"
          >
            <button
              type="button"
              aria-current={activeTab === 'students' ? 'page' : undefined}
              onClick={() => setActiveTab('students')}
            >
              <Users size={16} aria-hidden="true" />
              <span>塾生ログ一覧</span>
              {kpi.alertCount > 0 && (
                <span className="sg-tab-badge" data-tone="danger">
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
              <BookOpen size={16} aria-hidden="true" />
              <span>講師用PDF教材棚</span>
            </button>

            <button
              type="button"
              aria-current={activeTab === 'writing_review' ? 'page' : undefined}
              onClick={() => {
                setSelectedStudentUid(null);
                setActiveTab('writing_review');
              }}
            >
              <FileEdit size={16} aria-hidden="true" />
              <span>英作文添削</span>
              {kpi.pendingWriting > 0 && (
                <span className="sg-tab-badge">{kpi.pendingWriting}</span>
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
              <Mic size={16} aria-hidden="true" />
              <span>スピーキング確認</span>
              {kpi.pendingSpeaking > 0 && (
                <span className="sg-tab-badge" data-tone="done">
                  {kpi.pendingSpeaking}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* 2. Pull to Refresh 対応メインステージ */}
      <PullToRefreshHost onRefresh={handlePullRefresh} refreshing={ptrRefreshing}>
        <main className="sg-main">
          {/* とびら君バディ帯（呼吸・まばたきアニメ付き＋招待コード・手動更新） */}
          <div className="sg-buddy-banner">
            <TobiraBuddy
              size="sm"
              bubble="right"
              input={{
                screen: 'study',
                dueCount: kpi.alertCount,
                streak: 5,
                seed: activeTab.length,
              }}
              line={buddyLine}
            />
            <div className="sg-buddy-actions">
              {sourceInfo.joinCode && (
                <SecondaryButton
                  onClick={() => void handleCopyJoinCode()}
                  icon={<Copy size={15} aria-hidden="true" />}
                >
                  招待コード: {sourceInfo.joinCode}
                </SecondaryButton>
              )}
              <SecondaryButton
                disabled={ptrRefreshing || loadingLive}
                onClick={() => void handlePullRefresh()}
                icon={
                  <RefreshCw
                    size={15}
                    className={ptrRefreshing || loadingLive ? 'animate-spin' : undefined}
                    aria-hidden="true"
                  />
                }
              >
                最新ログ更新
              </SecondaryButton>
            </div>
          </div>

          {/* Skeleton Screen 表示中 */}
          {showSkeleton ? (
            <PortalSkeletonScreen rows={5} />
          ) : dataMode === 'firestore' && !FIREBASE_CONFIGURED ? (
            <Card tone="gold" style={{ textAlign: 'center', padding: '28px 20px', display: 'grid', gap: 12, justifyItems: 'center' }}>
              <ShieldAlert size={36} style={{ color: 'var(--mt-accent-ink)' }} aria-hidden="true" />
              <h2 className="mt-h2" style={{ margin: 0 }}>
                <KineticText text="クラウド同期は環境変数設定後に有効になります" />
              </h2>
              <p className="mt-body" style={{ margin: 0, maxWidth: 520 }}>
                この環境ではまだ <code>VITE_EIKEN_ENABLE_CLOUD=true</code> が未設定です。11/23・11/27の画面レビューは「試作デモデータ」または「講師用PDF教材棚」ですべての動作をご確認いただけます。
              </p>
              <PrimaryButton
                tone="accent"
                onClick={() => switchDataMode('demo')}
                icon={<Sparkles size={16} aria-hidden="true" />}
              >
                試作デモデータ表示へ切り替える
              </PrimaryButton>
            </Card>
          ) : dataMode === 'firestore' && !user ? (
            <Card style={{ textAlign: 'center', padding: '28px 20px', display: 'grid', gap: 12, justifyItems: 'center', maxWidth: 520, margin: '0 auto' }}>
              <ShieldAlert size={38} style={{ color: 'var(--mt-brand)' }} aria-hidden="true" />
              <h2 className="mt-h2" style={{ margin: 0 }}>
                <KineticText text="すごろく講師用 Googleログイン" />
              </h2>
              <p className="mt-body" style={{ margin: 0 }}>
                塾生の実名（名簿名）および学習ログ・提出音声を保護するため、指定された講師アカウント（またはクラス担任）のみアクセスできます。
              </p>
              {liveError && <p className="slog-error">{liveError}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                <PrimaryButton
                  disabled={authBusy}
                  onClick={() => void handleGoogleSignIn()}
                  icon={<LogIn size={16} aria-hidden="true" />}
                >
                  {authBusy ? '認証中…' : '講師Googleアカウントでログイン'}
                </PrimaryButton>
                <SecondaryButton onClick={() => switchDataMode('demo')}>
                  試作デモ画面を見る
                </SecondaryButton>
              </div>
            </Card>
          ) : dataMode === 'firestore' && !loadingLive && !isAuthorizedForLive ? (
            <Card style={{ textAlign: 'center', padding: '24px 18px', display: 'grid', gap: 10, justifyItems: 'center' }}>
              <AlertTriangle size={34} style={{ color: 'var(--mt-danger)' }} aria-hidden="true" />
              <h2 className="mt-h2" style={{ margin: 0 }}>
                担当クラスが見つからないか、講師認可が未登録です
              </h2>
              <p className="mt-body" style={{ margin: 0 }}>
                ログイン中：{user?.email}。先生ダッシュボードでクラスを作成するか、すごろく講師メールアドレス登録をご確認ください。
              </p>
              <SecondaryButton onClick={() => switchDataMode('demo')}>
                試作デモデータで画面を確認する
              </SecondaryButton>
            </Card>
          ) : (
            <>
              {/* Firestore複数クラス切替チップ */}
              {dataMode === 'firestore' && classrooms.length > 0 && (
                <div className="sg-chip-group" role="group" aria-label="担当クラス切替">
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

              {/* タブ別コンテンツ */}
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
                /* 塾生ログ一覧＆停滞アラートメイン画面 */
                <section
                  aria-label="塾生サマリー一覧と停滞アラート"
                  className="sg-stagger"
                  style={{ display: 'grid', gap: 14 }}
                >
                  {/* A. 声掛け優先アラート最上部ステージ（脈動バッジ＋ワンタップ遷移） */}
                  {kpi.alertStudents.length > 0 && (
                    <div
                      role="region"
                      aria-label="声掛け優先アラート"
                      className="sg-alert-stage"
                    >
                      <div className="sg-alert-head">
                        <h2>
                          <span className="sg-alert-pulse" aria-hidden="true">
                            <AlertTriangle size={15} />
                          </span>
                          <KineticText
                            text={`今週の声掛け優先アラート（${kpi.alertStudents.length}名）`}
                            variant="pop"
                          />
                        </h2>
                        <span className="mt-small" style={{ fontWeight: 700 }}>
                          未学習・宿題遅延の生徒を最上部に自動抽出
                        </span>
                      </div>

                      <div className="sg-alert-grid">
                        {kpi.alertStudents.map((st) => (
                          <button
                            key={st.uid}
                            type="button"
                            className="sg-alert-chip"
                            onClick={() => setSelectedStudentUid(st.uid)}
                          >
                            <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                              <strong
                                style={{
                                  font: '800 14px/1.3 var(--mt-font-display)',
                                  color: 'var(--mt-ink-warm)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {st.rosterName}
                              </strong>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {st.alerts.map((al) => (
                                  <Badge
                                    key={al.reason}
                                    tone={al.severity === 'critical' ? 'new' : 'gold'}
                                  >
                                    {al.label}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <ChevronRight
                              size={18}
                              style={{ color: 'var(--mt-danger)', flexShrink: 0 }}
                              aria-hidden="true"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* B. Infographic KPI 4枚カード（CountUp + ScoreRing + 全体比率バー） */}
                  <div className="sg-kpi-grid">
                    <div className="sg-kpi-card" data-tone={kpi.alertCount > 0 ? 'alert' : undefined}>
                      <p className="sg-kpi-label">
                        <Users size={14} aria-hidden="true" />
                        在籍塾生 / 要フォロー
                      </p>
                      <div className="sg-kpi-main">
                        <span className="sg-kpi-num">
                          <CountUp value={kpi.count} fromZero duration={600} />
                          <span className="sg-kpi-unit">名</span>
                        </span>
                        {kpi.alertCount > 0 && (
                          <Badge tone="new">要声掛け {kpi.alertCount}名</Badge>
                        )}
                      </div>
                      <p className="sg-kpi-sub">{sourceInfo.className}</p>
                    </div>

                    <div className="sg-kpi-card" data-tone="sky">
                      <p className="sg-kpi-label">
                        <Clock size={14} aria-hidden="true" />
                        今週の平均有効学習
                      </p>
                      <div className="sg-kpi-main">
                        <span className="sg-kpi-num">
                          <CountUp value={kpi.avgWeeklyMin} fromZero duration={750} />
                          <span className="sg-kpi-unit">分/人</span>
                        </span>
                      </div>
                      <p className="sg-kpi-sub">
                        {formatDurationJa(kpi.avgWeeklySec)}（1分以上無操作除外）
                      </p>
                    </div>

                    <div className="sg-kpi-card" data-tone="gold">
                      <p className="sg-kpi-label">
                        <CheckCircle2 size={14} aria-hidden="true" />
                        クラス平均宿題消化率
                      </p>
                      <div className="sg-kpi-main">
                        <span className="sg-kpi-num">
                          <CountUp value={kpi.avgHomeworkPct} fromZero duration={800} />
                          <span className="sg-kpi-unit">%</span>
                        </span>
                        <ScoreRing
                          rate={kpi.avgHomeworkPct / 100}
                          size={42}
                          stroke={6}
                          tone={kpi.avgHomeworkPct >= 80 ? 'done' : 'brand'}
                        />
                      </div>
                      <SkillRatioStackBar items={kpi.classSkillItems} />
                    </div>

                    <div className="sg-kpi-card">
                      <p className="sg-kpi-label">面談・保護者共有レポート</p>
                      <PrimaryButton
                        block
                        tone="accent"
                        disabled={filteredStudents.length === 0}
                        onClick={handleExportSummaryCsv}
                        icon={<Download size={16} aria-hidden="true" />}
                      >
                        一括CSV出力
                      </PrimaryButton>
                      <p className="sg-kpi-sub">Excel対応（UTF-8 BOM付）</p>
                    </div>
                  </div>

                  {/* C. 絞り込みチップバー＆スワイプガイド */}
                  <div className="sg-filter-bar">
                    <div className="sg-chip-group" role="group" aria-label="目標級フィルタ">
                      {[
                        { id: 'all', label: '全員' },
                        { id: 'eiken_2', label: '英検2級' },
                        { id: 'eiken_pre2plus', label: '準2級プラス' },
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
                        data-tone="accent"
                        aria-pressed={onlyAlerts}
                        onClick={() => setOnlyAlerts((v) => !v)}
                      >
                        <AlertTriangle size={13} aria-hidden="true" />
                        未学習・宿題遅れのみ
                      </button>
                    </div>

                    <span className="mt-small" style={{ fontSize: 12 }}>
                      💡 スマホ・iPadは行を左右スワイプで声掛けコピー・クイック表示
                    </span>
                  </div>

                  {/* D. Swipe Action 対応 塾生カードリスト */}
                  <SectionHeader
                    title={<KineticText text="塾生別タイムログ・宿題進捗" />}
                    aside={`${filteredStudents.length}名表示中`}
                  />

                  {filteredStudents.length === 0 ? (
                    <Card className="slog-empty">条件に一致する塾生がいません。</Card>
                  ) : (
                    <ul className="sg-student-list sg-stagger">
                      {filteredStudents.map((st) => {
                        const alertLevel = st.alerts.some((a) => a.severity === 'critical')
                          ? 'critical'
                          : st.alerts.length > 0
                            ? 'warning'
                            : undefined;
                        const topSkills = st.gradeSkillBreakdown
                          .filter((g) => g.weeklySeconds > 0 || g.totalSeconds > 0)
                          .slice(0, 3);

                        return (
                          <SwipeableRow
                            key={st.uid}
                            leftAction={{
                              id: 'encourage',
                              label: '声掛けコピー',
                              icon: <MessageCircleHeart size={18} aria-hidden="true" />,
                              onTrigger: () => void handleCopyStudentLineMessage(st),
                            }}
                            rightActions={[
                              {
                                id: 'sheet',
                                label: 'クイック',
                                icon: <Eye size={17} aria-hidden="true" />,
                                onTrigger: () => setQuickSheetStudentUid(st.uid),
                              },
                              {
                                id: 'detail',
                                label: '詳細ログ',
                                icon: <ChevronRight size={18} aria-hidden="true" />,
                                onTrigger: () => setSelectedStudentUid(st.uid),
                              },
                            ]}
                          >
                            <article className="sg-student-card" data-alert={alertLevel}>
                              <div className="sg-student-identity">
                                <div className="sg-student-badges">
                                  <Badge>{getGradeLabel(st.targetGrade)}</Badge>
                                  <StudyDoorsWeek recentDailyLogs={st.recentDailyLogs} />
                                  {st.alerts.map((al) => (
                                    <Badge
                                      key={al.reason}
                                      tone={al.severity === 'critical' ? 'new' : 'gold'}
                                    >
                                      {al.label}
                                    </Badge>
                                  ))}
                                </div>

                                <div className="sg-student-name-row">
                                  <h3 className="sg-student-name">{st.rosterName}</h3>
                                </div>

                                {/* 級×技能内訳ピル */}
                                <div className="sg-skill-pills">
                                  {topSkills.length === 0 ? (
                                    <span className="mt-small" style={{ fontSize: 12 }}>
                                      今週の分野別記録はまだありません
                                    </span>
                                  ) : (
                                    topSkills.map((g) => (
                                      <span key={g.key} className="sg-skill-pill">
                                        {g.label}
                                        <b>
                                          {toMinutesRounded(
                                            g.weeklySeconds > 0 ? g.weeklySeconds : g.totalSeconds,
                                          )}
                                          分
                                        </b>
                                        {g.accuracyPct !== null ? `(${g.accuracyPct}%)` : ''}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* 右側：今週/本日時間 ＋ ScoreRing宿題進捗 ＋ クイックシート＆詳細ボタン */}
                              <div className="sg-student-metrics">
                                <div className="sg-metric-col">
                                  <small>今週 / 本日</small>
                                  <strong>
                                    {formatDurationJa(st.weeklyActiveSeconds)}
                                    <span
                                      style={{
                                        marginLeft: 4,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: 'var(--mt-ink-3)',
                                      }}
                                    >
                                      ({formatDurationJa(st.todayActiveSeconds)})
                                    </span>
                                  </strong>
                                  <small>最終: {st.lastStudiedDateKey ?? '未学習'}</small>
                                </div>

                                <div className="sg-ring-stat">
                                  <ScoreRing
                                    rate={st.homework.completionRate / 100}
                                    size={40}
                                    stroke={5}
                                    tone={
                                      st.homework.overdueCount > 0
                                        ? 'warn'
                                        : st.homework.completionRate >= 80
                                          ? 'done'
                                          : 'brand'
                                    }
                                  />
                                  <div className="sg-metric-col">
                                    <small>宿題消化</small>
                                    <strong>{st.homework.completionRate}%</strong>
                                  </div>
                                </div>

                                <div className="sg-card-actions">
                                  <SecondaryButton
                                    onClick={() => setQuickSheetStudentUid(st.uid)}
                                    aria-label={`${st.rosterName}のクイックサマリーを開く`}
                                  >
                                    サマリー
                                  </SecondaryButton>
                                  <PrimaryButton
                                    onClick={() => setSelectedStudentUid(st.uid)}
                                    icon={<ChevronRight size={16} aria-hidden="true" />}
                                  >
                                    詳細ログ
                                  </PrimaryButton>
                                </div>
                              </div>
                            </article>
                          </SwipeableRow>
                        );
                      })}
                    </ul>
                  )}

                  <p className="mt-small" style={{ margin: '2px 2px 0', fontSize: 12 }}>
                    ※プライバシー保護：生徒の実名（名簿名）はこの塾管理者ポータル内でのみ表示され、一般ランキングやフレンド画面には一切公開されません。塾クラス参加生徒の端末では広告が100%非表示（Ad-Free）となります。
                  </p>
                </section>
              )}
            </>
          )}
        </main>
      </PullToRefreshHost>

      {/* 3. Bottom Sheet：一覧から画面遷移せずに覗ける「生徒クイックダイジェスト＆声掛けシート」 */}
      <SugorokuBottomSheet
        open={!!quickSheetStudent}
        kicker="QUICK STUDENT DIGEST"
        title={quickSheetStudent ? quickSheetStudent.rosterName : '生徒ダイジェスト'}
        onClose={() => setQuickSheetStudentUid(null)}
      >
        {quickSheetStudent && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="sg-student-badges">
              <Badge>目標：{getGradeLabel(quickSheetStudent.targetGrade)}</Badge>
              <StudyDoorsWeek recentDailyLogs={quickSheetStudent.recentDailyLogs} />
              {quickSheetStudent.alerts.map((al) => (
                <Badge key={al.reason} tone={al.severity === 'critical' ? 'new' : 'gold'}>
                  {al.label}
                </Badge>
              ))}
            </div>

            {quickSheetStudent.note && (
              <p
                style={{
                  margin: 0,
                  padding: '10px 12px',
                  borderRadius: 'var(--mt-radius-md)',
                  background: 'var(--mt-bg-sunken)',
                  font: '600 13px/1.5 var(--mt-font-body)',
                }}
              >
                {quickSheetStudent.note}
              </p>
            )}

            <div className="slog-sum">
              <div>
                <dt>今週の有効学習</dt>
                <dd>{formatDurationJa(quickSheetStudent.weeklyActiveSeconds)}</dd>
              </div>
              <div>
                <dt>本日の学習</dt>
                <dd>{formatDurationJa(quickSheetStudent.todayActiveSeconds)}</dd>
              </div>
              <div>
                <dt>宿題消化率</dt>
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
                    <strong>{g.label}</strong>
                    <small>
                      {g.accuracyPct !== null
                        ? `正答率 ${g.accuracyPct}%（${g.correct}/${g.totalQuestions}問）`
                        : '記述・録音演習'}
                    </small>
                  </span>
                  <b>{formatDurationJa(g.weeklySeconds > 0 ? g.weeklySeconds : g.totalSeconds)}</b>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <SecondaryButton
                style={{ flex: 1 }}
                onClick={() => void handleCopyStudentLineMessage(quickSheetStudent)}
                icon={<MessageCircleHeart size={16} aria-hidden="true" />}
              >
                LINE声掛け文をコピー
              </SecondaryButton>
              <PrimaryButton
                style={{ flex: 1 }}
                onClick={() => {
                  const uid = quickSheetStudent.uid;
                  setQuickSheetStudentUid(null);
                  setSelectedStudentUid(uid);
                }}
                icon={<ChevronRight size={16} aria-hidden="true" />}
              >
                14日詳細ドリルダウンを開く
              </PrimaryButton>
            </div>
          </div>
        )}
      </SugorokuBottomSheet>
    </div>
  );
}

export default SugorokuAdminApp;
