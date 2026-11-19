/**
 * ===================================================================
 * すごろく塾管理者ポータル（SugorokuAdminApp.tsx）
 * ===================================================================
 * 【AI 1 担当メイン画面 — React.lazy コード分割対応】
 *
 * 1. 塾生サマリー一覧＆停滞アラート（未学習・宿題遅延生徒を最上部にハイライト表示）
 * 2. 個人別ドリルダウン画面（日別カレンダー／棒グラフ＋級×技能別の学習時間・正答率推移）
 * 3. 講師用PDF教材ダイレクト棚（ガチャ不要で全冊子・分冊を即時閲覧・DL）＆保護者面談用CSV出力
 * 4. AI 3 拡張スロット（ライティング添削タブ・S-CBTスピーキング音声確認タブ）
 * 5. 試作デモ用サンプルデータモード ⇄ Firestore実データ接続モードのワンタップ切替
 * 6. スマホ（375px）／iPad（768px）／PC（1280px+）すべてで横はみ出しゼロのレスポンシブ設計
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Download,
  FileEdit,
  LogIn,
  LogOut,
  Mic,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import { auth, FIREBASE_CONFIGURED } from '../../firebase';
import { signInWithGoogle, signOutGoogle } from '../../utils/googleAuth';
import { PdfViewerHost } from '../../components/PdfViewer';
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
import { SugorokuStudentDetailView } from './SugorokuStudentDetailView';
import { SugorokuPdfShelfTab } from './SugorokuPdfShelfTab';
import {
  SugorokuSpeakingExtensionSlot,
  SugorokuWritingExtensionSlot,
} from './SugorokuExtensionSlots';

export type SugorokuAdminTabId =
  | 'students'
  | 'pdf_shelf'
  | 'writing_review'
  | 'speaking_review';

export interface SugorokuAdminAppProps {
  /** 生徒用アプリまたは先生ダッシュボードから開いた場合の戻るコールバック */
  onBack?: () => void;
  /** 初期データソース指定（未指定時はFirestore設定＆担当クラス有無に応じて自動選択） */
  initialDataMode?: 'auto' | 'demo' | 'firestore';
  /** AI 3 のライティング添削・スピーキング確認モジュールを差し込む拡張スロット */
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
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  // デモデータ状態（インライン名簿編集などもその場で反映可能にする）
  const [demoBundle, setDemoBundle] = useState<SugorokuDemoBundle>(() =>
    createSugorokuDemoBundle(),
  );

  // Firestore実データ状態
  const [classrooms, setClassrooms] = useState<ClassroomDoc[]>([]);
  const [activeClassId, setActiveClassId] = useState<string>('');
  const [livePortalData, setLivePortalData] = useState<LoadedClassPortalData | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  // Firebase Auth 購読
  useEffect(() => {
    if (!FIREBASE_CONFIGURED) return;
    return onAuthStateChanged(auth, (current) => {
      setUser(current);
    });
  }, []);

  // Firestore 担当クラスの読み込み
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
      setLiveError(e instanceof Error ? e.message : 'クラスデータの読み込みに失敗しました。');
    } finally {
      setLoadingLive(false);
    }
  };

  // 現在有効なソース（Demo vs Firestore）から塾生一覧サマリーを組み立てる
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

  // クラス全体KPI集計
  const kpi = useMemo(() => {
    const count = allStudentOverviews.length;
    const alertStudents = allStudentOverviews.filter((s) => s.alerts.length > 0);
    const totalWeeklySec = allStudentOverviews.reduce((sum, s) => sum + s.weeklyActiveSeconds, 0);
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
      alertCount: alertStudents.length,
      alertStudents,
      avgWeeklySec: count > 0 ? Math.round(totalWeeklySec / count) : 0,
      totalWeeklySec,
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
    a.download = `すごろく塾生学習サマリー_${safeClass}_${formatDateKey(Date.now())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      setCopiedCode(false);
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

  // Firestore実データモードが選ばれているのに未ログインの場合の認可ゲート表示
  const isAuthorizedForLive =
    !!user && (classrooms.length > 0 || isEmailPreAuthorizedAdmin(user.email));

  return (
    <div
      data-sugoroku-admin-portal="true"
      className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-[#F7F5EF] text-[#1B2631]"
    >
      {/* アプリ内PDFビューアホスト（?portal=admin 直起動時でもPDFプレビュー・印刷が動くように配置） */}
      <PdfViewerHost />

      {/* トップヘッダーバー */}
      <header className="sticky top-0 z-20 border-b border-[#E2DDD2] bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-6xl px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-[#D5D1C8] bg-[#FDFBF7] px-2.5 py-1.5 text-xs font-bold text-[#374151] hover:bg-[#F1EFE9] shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">戻る</span>
              </button>
            )}
            <img
              src="/brand/manatobi-logo-gray.png"
              alt="マナトビ"
              className="h-6 w-auto hidden sm:block shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="rounded-md bg-[#1D58A8] px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                  すごろく塾 管理者ポータル
                </span>
                <span className="text-[11px] font-semibold text-[#6B7280] truncate">
                  {sourceInfo.schoolName}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-[#1B2631] truncate">
                {sourceInfo.className}
              </h1>
            </div>
          </div>

          {/* モード切替（試作デモサンプル ⇄ Firestore実データ）＋アカウント状態 */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-xl bg-[#F1EFE9] p-0.5 border border-[#E2DDD2]"
              role="group"
              aria-label="データ表示モード切替"
            >
              <button
                type="button"
                onClick={() => {
                  setDataMode('demo');
                  setSelectedStudentUid(null);
                }}
                className={`min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                  dataMode === 'demo'
                    ? 'bg-white text-[#1D58A8] shadow-xs'
                    : 'text-[#4B5563] hover:text-[#1B2631]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                試作デモデータ
              </button>
              <button
                type="button"
                onClick={() => {
                  setDataMode('firestore');
                  setSelectedStudentUid(null);
                }}
                className={`min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                  dataMode === 'firestore'
                    ? 'bg-white text-[#16794F] shadow-xs'
                    : 'text-[#4B5563] hover:text-[#1B2631]'
                }`}
              >
                <Database className="w-3.5 h-3.5 shrink-0" />
                本番Firestore接続
              </button>
            </div>

            {FIREBASE_CONFIGURED && user && (
              <button
                type="button"
                onClick={() => void signOutGoogle()}
                className="min-h-[34px] inline-flex items-center gap-1 rounded-xl border border-[#E2DDD2] bg-white px-2.5 py-1 text-xs font-semibold text-[#4B5563] hover:bg-[#FDECEA] hover:text-[#B42318]"
                title={user.email || 'ログアウト'}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline max-w-[140px] truncate">{user.email}</span>
              </button>
            )}
          </div>
        </div>

        {/* メイン機能タブ（スマホ2×2折返し / タブレット・PC 1列タブ、横はみ出しゼロ） */}
        <div className="mx-auto max-w-6xl px-3 sm:px-6 pb-2.5">
          <nav
            aria-label="管理者ポータルメニュー"
            className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-xl bg-[#EFECE4] p-1"
          >
            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs sm:text-sm font-bold transition-colors ${
                activeTab === 'students'
                  ? 'bg-white text-[#1B2631] shadow-xs'
                  : 'text-[#4B5563] hover:text-[#1B2631]'
              }`}
            >
              <Users className="w-4 h-4 shrink-0 text-[#1D58A8]" />
              <span className="truncate">塾生ログ一覧</span>
              {kpi.alertCount > 0 && (
                <span className="rounded-full bg-[#D92D20] px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                  {kpi.alertCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedStudentUid(null);
                setActiveTab('pdf_shelf');
              }}
              className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs sm:text-sm font-bold transition-colors ${
                activeTab === 'pdf_shelf'
                  ? 'bg-white text-[#1B2631] shadow-xs'
                  : 'text-[#4B5563] hover:text-[#1B2631]'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0 text-[#16794F]" />
              <span className="truncate">講師用PDF教材棚</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedStudentUid(null);
                setActiveTab('writing_review');
              }}
              className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs sm:text-sm font-bold transition-colors ${
                activeTab === 'writing_review'
                  ? 'bg-white text-[#1B2631] shadow-xs'
                  : 'text-[#4B5563] hover:text-[#1B2631]'
              }`}
            >
              <FileEdit className="w-4 h-4 shrink-0 text-[#1D58A8]" />
              <span className="truncate">英作文添削</span>
              {kpi.pendingWriting > 0 && (
                <span className="rounded-full bg-[#1D58A8] px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                  {kpi.pendingWriting}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedStudentUid(null);
                setActiveTab('speaking_review');
              }}
              className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs sm:text-sm font-bold transition-colors ${
                activeTab === 'speaking_review'
                  ? 'bg-white text-[#1B2631] shadow-xs'
                  : 'text-[#4B5563] hover:text-[#1B2631]'
              }`}
            >
              <Mic className="w-4 h-4 shrink-0 text-[#16794F]" />
              <span className="truncate">スピーキング確認</span>
              {kpi.pendingSpeaking > 0 && (
                <span className="rounded-full bg-[#16794F] px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                  {kpi.pendingSpeaking}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* メインコンテンツ領域 */}
      <main className="mx-auto max-w-6xl px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        {/* デモモード案内バナー */}
        {dataMode === 'demo' && (
          <div className="rounded-2xl border border-[#B6D4F7] bg-[#EEF5FF] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-[#164788]">
            <p className="leading-relaxed">
              <strong>【試作デモ表示中】</strong>{' '}
              すごろく様の想定塾生6名（運動部所属・英検2級/準2級プラス目標）のサンプルデータで動作しています。生徒をタップすると級×技能別の学習時間・日別カレンダーを確認できます（スクショ提出不要）。
            </p>
            {sourceInfo.joinCode && (
              <button
                type="button"
                onClick={() => void handleCopyJoinCode()}
                className="self-start sm:self-center shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#B6D4F7] px-2.5 py-1 text-xs font-bold text-[#1D58A8]"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedCode ? 'コピー済！' : `招待コード: ${sourceInfo.joinCode}`}
              </button>
            )}
          </div>
        )}

        {/* Firestore実データ接続時の未認証・未構成ガード */}
        {dataMode === 'firestore' && !FIREBASE_CONFIGURED ? (
          <div className="rounded-2xl border border-[#F3D285] bg-[#FEF9EC] p-6 text-center space-y-3">
            <ShieldAlert className="w-9 h-9 mx-auto text-[#945608]" />
            <h2 className="text-base sm:text-lg font-bold text-[#1B2631]">
              この環境ではまだクラウド接続（VITE_EIKEN_ENABLE_CLOUD）が有効化されていません
            </h2>
            <p className="text-xs sm:text-sm text-[#4B5563] max-w-xl mx-auto leading-relaxed">
              英検専用Firebaseの環境変数を設定すると、指定講師Googleアカウントでのログインとリアルタイム同期が有効になります。画面構成の確認は「試作デモデータ」または「講師用PDF教材棚」で行えます。
            </p>
            <button
              type="button"
              onClick={() => setDataMode('demo')}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#1D58A8] px-4 py-2 text-xs sm:text-sm font-bold text-white"
            >
              <Sparkles className="w-4 h-4" />
              試作デモデータ表示へ切り替える
            </button>
          </div>
        ) : dataMode === 'firestore' && !user ? (
          <div className="rounded-2xl border border-[#E2DDD2] bg-white p-6 sm:p-8 text-center space-y-4 max-w-lg mx-auto">
            <ShieldAlert className="w-10 h-10 mx-auto text-[#1D58A8]" />
            <h2 className="text-lg font-bold text-[#1B2631]">
              すごろく講師用 Googleログインが必要です
            </h2>
            <p className="text-xs sm:text-sm text-[#4B5563] leading-relaxed">
              塾生の実名（名簿名）および学習ログ・提出音声を保護するため、指定された講師アカウント（またはクラス作成者）のみ閲覧できます。
            </p>
            {liveError && (
              <p role="alert" className="text-xs font-semibold text-[#B42318]">
                {liveError}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void handleGoogleSignIn()}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#1D58A8] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {authBusy ? '認証処理中…' : '講師Googleアカウントでログイン'}
              </button>
              <button
                type="button"
                onClick={() => setDataMode('demo')}
                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-[#D5D1C8] bg-[#FDFBF7] px-4 py-2.5 text-xs font-bold text-[#374151]"
              >
                デモ画面を見る
              </button>
            </div>
          </div>
        ) : dataMode === 'firestore' && !loadingLive && !isAuthorizedForLive ? (
          <div className="rounded-2xl border border-[#F5C6C0] bg-[#FDECEA] p-6 text-center space-y-3 max-w-lg mx-auto">
            <AlertTriangle className="w-9 h-9 mx-auto text-[#B42318]" />
            <h2 className="text-base font-bold text-[#96342B]">
              担当クラスが見つからないか、管理者権限が未登録です
            </h2>
            <p className="text-xs sm:text-sm text-[#96342B] leading-relaxed">
              ログイン中：{user?.email}。先生ダッシュボードから塾クラスを作成するか、すごろく講師メールアドレスの認可登録を確認してください。
            </p>
            <button
              type="button"
              onClick={() => setDataMode('demo')}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#F5C6C0] px-4 py-2 text-xs font-bold text-[#96342B]"
            >
              試作デモデータで画面を確認する
            </button>
          </div>
        ) : (
          <>
            {/* Firestore複数クラス切替バー */}
            {dataMode === 'firestore' && classrooms.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E2DDD2] bg-white p-3">
                <div className="flex flex-wrap gap-1.5">
                  {classrooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => void handleSelectLiveClass(room.id)}
                      className={`min-h-[36px] rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors ${
                        room.id === activeClassId
                          ? 'bg-[#1B2631] text-white border-[#1B2631]'
                          : 'bg-[#F8F6F1] text-[#4B5563] border-[#E2DDD2]'
                      }`}
                    >
                      {room.className}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={loadingLive}
                  onClick={() => void reloadLiveClasses()}
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-[#D5D1C8] bg-[#FDFBF7] px-3 py-1.5 text-xs font-bold text-[#374151]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLive ? 'animate-spin' : ''}`} />
                  最新ログ取得
                </button>
              </div>
            )}

            {/* タブ別描画 */}
            {activeTab === 'pdf_shelf' ? (
              <SugorokuPdfShelfTab />
            ) : activeTab === 'writing_review' ? (
              <SugorokuWritingExtensionSlot
                classId={sourceInfo.classId}
                isDemoMode={sourceInfo.isDemo}
                submissions={sourceInfo.writingSubmissions}
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
              /* 塾生サマリー一覧＆停滞アラート画面 */
              <section aria-label="塾生サマリー一覧と停滞アラート" className="space-y-4">
                {/* 1. 停滞・宿題遅延アラート最上部ハイライト帯 */}
                {kpi.alertStudents.length > 0 && (
                  <div
                    role="region"
                    aria-label="声掛け優先アラート"
                    className="rounded-2xl border-2 border-[#F0B4AD] bg-[#FFF5F4] p-4 space-y-2.5 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm sm:text-base font-extrabold text-[#96342B] flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-[#D92D20] shrink-0" />
                        今週の声掛け優先アラート（未学習・宿題遅れ {kpi.alertStudents.length}名）
                      </h2>
                      <span className="text-xs font-semibold text-[#96342B]">
                        タップで個人別タイムログ詳細へ
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {kpi.alertStudents.map((st) => (
                        <button
                          key={st.uid}
                          type="button"
                          onClick={() => setSelectedStudentUid(st.uid)}
                          className="text-left rounded-xl border border-[#F5C6C0] bg-white p-3 hover:bg-[#FEF8F7] transition-colors flex items-center justify-between gap-2 min-w-0"
                        >
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-extrabold text-[#1B2631] truncate">
                              {st.rosterName}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {st.alerts.map((al) => (
                                <span
                                  key={al.reason}
                                  className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                                    al.severity === 'critical'
                                      ? 'bg-[#FDECEA] text-[#B42318]'
                                      : 'bg-[#FEF3D6] text-[#945608]'
                                  }`}
                                >
                                  {al.label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[#96342B] shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. クラス全体サマリーKPI（スマホ2×2 / PC 4列） */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div className="rounded-2xl border border-[#E2DDD2] bg-white p-3.5 sm:p-4">
                    <p className="text-xs font-semibold text-[#6B7280]">在籍塾生 / 要フォロー</p>
                    <p className="text-xl font-extrabold text-[#1B2631] mt-1">
                      {kpi.count}名
                      {kpi.alertCount > 0 && (
                        <span className="ml-2 text-xs font-bold text-[#D92D20]">
                          （注意 {kpi.alertCount}名）
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#E2DDD2] bg-white p-3.5 sm:p-4">
                    <p className="text-xs font-semibold text-[#6B7280] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#1D58A8]" />
                      今週の平均有効学習時間
                    </p>
                    <p className="text-xl font-extrabold text-[#1B2631] mt-1">
                      {formatDurationJa(kpi.avgWeeklySec)}
                    </p>
                    <p className="text-[11px] text-[#6B7280]">1分以上無操作は自動除外</p>
                  </div>

                  <div className="rounded-2xl border border-[#E2DDD2] bg-white p-3.5 sm:p-4">
                    <p className="text-xs font-semibold text-[#6B7280] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#16794F]" />
                      平均宿題消化率
                    </p>
                    <p className="text-xl font-extrabold text-[#1B2631] mt-1">
                      {kpi.avgHomeworkPct}%
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#E2DDD2] bg-white p-3.5 sm:p-4 flex flex-col justify-between">
                    <p className="text-xs font-semibold text-[#6B7280]">面談・保護者共有</p>
                    <button
                      type="button"
                      disabled={filteredStudents.length === 0}
                      onClick={handleExportSummaryCsv}
                      className="mt-1.5 min-h-[36px] w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#16794F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#12623F] disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      一括CSV出力
                    </button>
                  </div>
                </div>

                {/* 3. 絞り込みツールバー */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E2DDD2] bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-[#4B5563] mr-1">目標級：</span>
                    {[
                      { id: 'all', label: '全員' },
                      { id: 'eiken_2', label: '英検2級' },
                      { id: 'eiken_pre2plus', label: '準2級プラス' },
                      { id: 'eiken_pre2', label: '準2級' },
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGradeFilter(g.id)}
                        className={`min-h-[32px] rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                          gradeFilter === g.id
                            ? 'bg-[#1D58A8] text-white'
                            : 'bg-[#F1EFE9] text-[#4B5563] hover:bg-[#E5E2D9]'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-bold text-[#374151] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyAlerts}
                      onChange={(e) => setOnlyAlerts(e.target.checked)}
                      className="rounded border-[#D5D1C8]"
                    />
                    未学習・宿題遅れのみ表示
                  </label>
                </div>

                {/* 4. 塾生カード一覧（スマホ・iPad・PCすべて横スクロール不要のレスポンシブ構造） */}
                {filteredStudents.length === 0 ? (
                  <div className="rounded-2xl border border-[#E2DDD2] bg-white p-8 text-center text-sm text-[#6B7280]">
                    該当する塾生がいません。
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredStudents.map((st) => {
                      const hasCritical = st.alerts.some((a) => a.severity === 'critical');
                      const hasWarning = !hasCritical && st.alerts.length > 0;
                      const topSkills = st.gradeSkillBreakdown
                        .filter((g) => g.weeklySeconds > 0 || g.totalSeconds > 0)
                        .slice(0, 3);
                      return (
                        <article
                          key={st.uid}
                          className={`rounded-2xl border p-4 transition-colors shadow-xs ${
                            hasCritical
                              ? 'border-[#F0B4AD] bg-[#FFFBFB]'
                              : hasWarning
                                ? 'border-[#F3D285] bg-[#FFFEFA]'
                                : 'border-[#E2DDD2] bg-white'
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            {/* 左：氏名・目標級・アラート・分野別チップ */}
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-md bg-[#EEF5FF] px-2 py-0.5 text-xs font-bold text-[#1D58A8]">
                                  {getGradeLabel(st.targetGrade)}
                                </span>
                                <h3 className="text-sm sm:text-base font-extrabold text-[#1B2631] break-words">
                                  {st.rosterName}
                                </h3>
                                {st.alerts.map((al) => (
                                  <span
                                    key={al.reason}
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                      al.severity === 'critical'
                                        ? 'bg-[#FDECEA] text-[#B42318]'
                                        : 'bg-[#FEF3D6] text-[#945608]'
                                    }`}
                                  >
                                    {al.label}
                                  </span>
                                ))}
                              </div>

                              {/* 級×技能別の直近内訳ピル（一覧上でも誰が何を何分やったか即把握可能） */}
                              <div className="flex flex-wrap gap-1.5 text-xs">
                                {topSkills.length === 0 ? (
                                  <span className="text-[#9CA3AF]">今週の分野別記録なし</span>
                                ) : (
                                  topSkills.map((g) => (
                                    <span
                                      key={g.key}
                                      className="rounded-lg bg-[#F8F6F1] border border-[#E8E4DA] px-2 py-0.5 text-[#374151]"
                                    >
                                      {g.label}：
                                      <strong className="text-[#1D58A8] ml-0.5">
                                        {toMinutesRounded(
                                          g.weeklySeconds > 0 ? g.weeklySeconds : g.totalSeconds,
                                        )}
                                        分
                                      </strong>
                                      {g.accuracyPct !== null ? ` (${g.accuracyPct}%)` : ''}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* 右：今週/本日時間・宿題進捗バー・詳細ボタン */}
                            <div className="grid grid-cols-3 sm:flex sm:items-center gap-2.5 sm:gap-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#F1EFE9] shrink-0">
                              <div>
                                <p className="text-[11px] text-[#6B7280]">今週 / 本日</p>
                                <p className="text-xs sm:text-sm font-extrabold text-[#1B2631]">
                                  {formatDurationJa(st.weeklyActiveSeconds)}
                                  <span className="text-[11px] font-normal text-[#6B7280] ml-1">
                                    ({formatDurationJa(st.todayActiveSeconds)})
                                  </span>
                                </p>
                              </div>

                              <div className="min-w-[90px]">
                                <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                                  <span>宿題消化</span>
                                  <strong className="text-[#1B2631]">
                                    {st.homework.completionRate}%
                                  </strong>
                                </div>
                                <div className="mt-1 h-2 w-full rounded-full bg-[#EAE6DC] overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      st.homework.overdueCount > 0
                                        ? 'bg-[#D92D20]'
                                        : st.homework.completionRate >= 80
                                          ? 'bg-[#16794F]'
                                          : 'bg-[#1D58A8]'
                                    }`}
                                    style={{ width: `${st.homework.completionRate}%` }}
                                  />
                                </div>
                                <p className="text-[10px] text-[#6B7280] mt-0.5">
                                  最終: {st.lastStudiedDateKey ?? '未学習'}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => setSelectedStudentUid(st.uid)}
                                className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl bg-[#1B2631] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2E3D4F] transition-colors"
                              >
                                詳細ログ
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                <p className="text-[11px] text-[#6B7280] leading-relaxed pt-1">
                  ※プライバシー保護設計：生徒の実名（名簿名）はこの管理者ポータル内でのみ表示され、アプリ内の一般ランキングやフレンド画面には一切公開されません。また、すごろく塾クラス参加生徒の端末では広告が完全非表示（Ad-Free）となります。
                </p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default SugorokuAdminApp;
