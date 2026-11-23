/**
 * すごろく塾 管理者ポータル：『アプリ内学習ルート・課題管理・教材PDF』タブ
 * - 市販の参考書は一切使わず、マナトビ英検アプリ内の実際の回数（第1回〜第15回）・大問数・周回数で完結する学習ルートを一画面で可視化
 * - 管理者側で「いま配信中の課題一覧（編集・削除）」「回数指定・ルート指定の課題配信」「初回15分診断判定」をそのまま設定・管理可能
 * - 必要に応じた白黒印刷プリント・週次20語確認テストPDF（Form A / Form B）もワンタップ表示
 */

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Compass,
  Download,
  Edit3,
  Eye,
  FileText,
  Flame,
  Headphones,
  Layers,
  PenLine,
  Plus,
  Repeat,
  Route,
  Search,
  Sparkles,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import { GACHA_PRINTS, type GachaPrintDef } from '../../data/gachaPrints.generated';
import { EIKEN_GRADES } from '../../eiken/config';
import { formatDue } from '../../utils/classAssignmentsCore';
import { openPdf } from '../../utils/pdfViewer';
import { savePdf } from '../../utils/pdfShare';
import { Card, PrimaryButton, SecondaryButton } from '../../components/ui';
import {
  SUGOROKU_BRIDGE_8STAGE_PRESETS,
  SUGOROKU_GRADE2_12WEEK_PRESETS,
  buildSugorokuWeeklyAssignmentPayload,
  evaluateSugorokuPlacement,
  type SugorokuBridgeStagePreset,
  type SugorokuCompatibleAssignmentPayload,
  type SugorokuWeekRoutePreset,
} from '../curriculum';
import {
  buildWeeklyRoute,
  chapterIdsOfAppRound,
  totalProblemsOf,
} from '../homework/homeworkCore';
import {
  chapterIdsOfGrade,
  chapterTitleOf,
  chapterTotals,
} from '../homework/chapterTotals';
import type { SugorokuAssignmentDoc } from '../shared/types';
import { SugorokuBottomSheet, type ToastTone } from './SugorokuInteractiveUi';

export type MaterialKindFilter =
  | 'all'
  | 'sugoroku_pack'
  | 'written'
  | 'wordbook'
  | 'drill'
  | 'writing'
  | 'guide';

/**
 * すごろく専用白黒印刷PDF 6冊フルスイート（計89ページ）の共通カタログ定義。
 */
export const SUGOROKU_DEDICATED_PDFS: readonly GachaPrintDef[] = [
  {
    id: 'sugoroku_pdf_eiken2_placement_diagnostic_6p',
    subject: 'eiken_2',
    category: '完全版',
    label: '入塾初回15分 英検2級スタートライン診断テスト＆A/B/C処方箋シート（全25問）',
    file: '/sugoroku/sugoroku_eiken2_placement_diagnostic_test.pdf',
    thumb: '/prints/thumbs/print_eiken_guide_2.webp',
    pages: 6,
    kb: 280,
  },
  {
    id: 'sugoroku_pdf_eiken2_route_12w',
    subject: 'eiken_2',
    category: '完全版',
    label: '英検2級 3か月（12週間）合格モデルカリキュラム＆学習ルート表',
    file: '/sugoroku/sugoroku_eiken2_12week_curriculum_route.pdf',
    thumb: '/prints/thumbs/print_eiken_guide_2.webp',
    pages: 6,
    kb: 320,
  },
  {
    id: 'sugoroku_pdf_eiken2_weekly_vocab_12w',
    subject: 'eiken_2',
    category: '単語テスト',
    label: '英検2級 必須語彙 週次確認小テスト［Form A］＆解答冊子（全12回・240語）',
    file: '/sugoroku/sugoroku_eiken2_weekly_vocab_tests_12w.pdf',
    thumb: '/prints/thumbs/print_eiken_wordbook_2.webp',
    pages: 26,
    kb: 640,
  },
  {
    id: 'sugoroku_pdf_eiken2_weekly_vocab_retest_form_b_12w',
    subject: 'eiken_2',
    category: '単語テスト',
    label: '英検2級 週次語彙テスト『再テスト専用［Form B］』＆解答冊子（全12回）',
    file: '/sugoroku/sugoroku_eiken2_weekly_vocab_retests_formB_12w.pdf',
    thumb: '/prints/thumbs/print_eiken_wordbook2_2.webp',
    pages: 25,
    kb: 620,
  },
  {
    id: 'sugoroku_pdf_pre2plus_bridge_8stages',
    subject: 'eiken_pre2plus',
    category: '完全版',
    label: '準2級・準2級プラス 段階ブリッジ学習ルート＆基礎確認小テスト（全8回・160語）',
    file: '/sugoroku/sugoroku_pre2plus_bridge_4week_pack.pdf',
    thumb: '/prints/thumbs/print_eiken_guide_pre2plus.webp',
    pages: 18,
    kb: 480,
  },
  {
    id: 'sugoroku_pdf_eiken2_scbt_handbook_8p',
    subject: 'eiken_2',
    category: '出題傾向',
    label: '英検2級 S-CBT面接・新形式要約・英作文＆大問1消去法 実践ハンドブック',
    file: '/sugoroku/sugoroku_eiken2_scbt_writing_speaking_handbook.pdf',
    thumb: '/prints/thumbs/print_eiken_writing_2.webp',
    pages: 8,
    kb: 380,
  },
];

export function classifyEikenMaterial(
  print: GachaPrintDef,
): Exclude<MaterialKindFilter, 'all'> | null {
  if (!print.subject.startsWith('eiken_')) return null;
  if (print.id.startsWith('sugoroku_pdf_')) {
    return 'sugoroku_pack';
  }
  if (print.id.includes('_written_')) return 'written';
  if (print.id.startsWith('print_eiken_wordbook')) return 'wordbook';
  if (print.id.startsWith('print_eiken_drill_')) return 'drill';
  if (print.id.startsWith('print_eiken_writing_')) return 'writing';
  if (print.id.startsWith('print_eiken_guide_') || print.category === '出題傾向') return 'guide';
  return 'guide';
}

const KIND_TABS: readonly { id: MaterialKindFilter; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'sugoroku_pack', label: '塾専用冊子' },
  { id: 'written', label: '一次筆記' },
  { id: 'wordbook', label: '単語' },
  { id: 'drill', label: '大問1' },
  { id: 'writing', label: '英作文' },
  { id: 'guide', label: 'ガイド' },
];

type RouteTrackKey =
  | 'eiken_2'
  | 'eiken_pre2plus'
  | 'eiken_pre2'
  | 'other_grades';

interface OtherGradeAppRouteDef {
  gradeId: string;
  gradeLabel: string;
  shortName: string;
  totalRoundsDesc: string;
  paceSummary: string;
  passCriteria: string;
}

const OTHER_GRADE_APP_ROUTES: readonly OtherGradeAppRouteDef[] = [
  {
    gradeId: 'eiken_pre1',
    gradeLabel: '英検準1級 アプリ全15回 突破ルート',
    shortName: '英検準1級',
    totalRoundsDesc: 'アプリ内 一次筆記 全15回（各22大問）＋ リスニング 全15回（第1〜3部）＋ 英作文/面接',
    paceSummary: '4日進行＋2日解き直し調整｜1回分を平日4日で分割演習 → 誤答大問を2周目で100%化',
    passCriteria: 'アプリ各回の大問1短文語彙（18問）で13問以上 ＆ 長文・リスニング正答率72%突破',
  },
  {
    gradeId: 'eiken_3',
    gradeLabel: '英検3級 アプリ全15回 合格ルート',
    shortName: '英検3級',
    totalRoundsDesc: 'アプリ内 一次筆記 全15回（短文15・会話5・長文読解）＋ リスニング 全15回（第1〜3部）',
    paceSummary: '4日進行＋2日解き直し調整｜毎日10〜15分（1日8〜10問）＋ 間違えた問題の音声2回音読',
    passCriteria: 'アプリ各回の正答率75%以上 ＆ アプリ内ライティング（Eメール・意見英作文）提出',
  },
  {
    gradeId: 'eiken_4',
    gradeLabel: '英検4級 アプリ全15回 合格ルート',
    shortName: '英検4級',
    totalRoundsDesc: 'アプリ内 一次筆記 全15回（短文15・会話5・語句整序5・読解）＋ リスニング 全15回',
    paceSummary: '4日進行＋2日解き直し調整｜毎日10分（1日6〜8問）＋ リスニング音声タッチ反復',
    passCriteria: 'アプリ各回のリスニング正答率75%以上 ＆ 語句整序（並べ替え）2周クリア',
  },
  {
    gradeId: 'eiken_5',
    gradeLabel: '英検5級 アプリ全15回 スタートルート',
    shortName: '英検5級',
    totalRoundsDesc: 'アプリ内 一次筆記 全15回（短文15・会話5・語句整序5）＋ リスニング 全15回',
    paceSummary: '毎日10分（1日5〜7問）｜まずは音声を聞いて選ぶ習慣づくり＋2周目で満点チャレンジ',
    passCriteria: 'アプリ各回のリスニング80%得点 ＆ 短文・会話・並べ替え1周完走',
  },
  {
    gradeId: 'eiken_1',
    gradeLabel: '英検1級 アプリ全15回 演習ルート',
    shortName: '英検1級',
    totalRoundsDesc: 'アプリ内 一次筆記 全15回（短文22・長文空所・読解）＋ リスニング 全15回（第1〜4部）',
    paceSummary: '4日進行＋2日精読復習｜アプリ内全15回を2周反復＋エッセイ・要約提出',
    passCriteria: 'アプリ各回の通し正答率72%以上 ＆ 誤答ストックの完全消化',
  },
];

/** アプリ内のチャプターID一覧から「筆記 第N回」「リスニング 第N回」を人間向けに分かりやすく要約 */
function summarizeAppRoundsFromChapters(chapterIds: readonly string[], totals: Record<string, number>): {
  writtenSummary: string;
  listeningSummary: string;
  totalQuestions: number;
  daily4DayQuota: number;
} {
  const writtenParts: string[] = [];
  const listeningParts: string[] = [];
  for (const cid of chapterIds) {
    const title = chapterTitleOf(cid);
    const qCount = totals[cid] || 0;
    const label = qCount > 0 ? `${title}（${qCount}問）` : title;
    if (cid.includes('_listening_')) {
      listeningParts.push(label);
    } else {
      writtenParts.push(label);
    }
  }
  const totalQuestions = totalProblemsOf(chapterIds, totals);
  const daily4DayQuota = Math.max(5, Math.ceil(totalQuestions / 4));
  return {
    writtenSummary: writtenParts.join(' ＋ ') || '（筆記なし）',
    listeningSummary: listeningParts.join(' ＋ ') || '（リスニングなし）',
    totalQuestions,
    daily4DayQuota,
  };
}

export interface CustomQuickAssignmentInput {
  title: string;
  chapterIds: string[];
  dueInDays: number;
  dailyQuotaProblems: number;
  targetLaps?: number;
  coachInstruction?: string;
  presetId?: string;
  presetWeek?: number;
}

export interface SugorokuPdfShelfTabProps {
  onToast?: (message: string, tone?: ToastTone) => void;
  /** 現在選択中のクラスの対象級（初期表示トラックの自動選択に使用） */
  activeSubject?: string;
  /** 現在クラスに配信済みの宿題一覧（「配信中」管理・編集・削除・現在地ハイライト用） */
  assignments?: readonly SugorokuAssignmentDoc[];
  /** ルート上のステージから1タップで今週の宿題として配信するコールバック */
  onAssignRoutePreset?: (payload: SugorokuCompatibleAssignmentPayload) => Promise<void>;
  /** 任意のアプリ内回・週ルートを即配信するコールバック */
  onQuickAssignCustom?: (input: CustomQuickAssignmentInput) => Promise<void>;
  /** 詳細宿題コンポーザーを開く（新規作成） */
  onOpenCustomHomework?: () => void;
  /** 配信済み課題を編集モーダルで開く */
  onEditAssignment?: (assignment: SugorokuAssignmentDoc) => void;
  /** 配信済み課題を削除する */
  onDeleteAssignment?: (assignment: SugorokuAssignmentDoc) => Promise<void>;
}

export function SugorokuPdfShelfTab({
  onToast,
  activeSubject = 'eiken_2',
  assignments = [],
  onAssignRoutePreset,
  onQuickAssignCustom,
  onOpenCustomHomework,
  onEditAssignment,
  onDeleteAssignment,
}: SugorokuPdfShelfTabProps) {
  const [viewMode, setViewMode] = useState<'roadmap' | 'library'>('roadmap');
  const [selectedTrack, setSelectedTrack] = useState<RouteTrackKey>(() => {
    if (activeSubject === 'eiken_pre2plus') return 'eiken_pre2plus';
    if (activeSubject === 'eiken_pre2') return 'eiken_pre2';
    if (
      activeSubject === 'eiken_pre1' ||
      activeSubject === 'eiken_3' ||
      activeSubject === 'eiken_4' ||
      activeSubject === 'eiken_5' ||
      activeSubject === 'eiken_1'
    ) {
      return 'other_grades';
    }
    return 'eiken_2';
  });
  const [otherGradeId, setOtherGradeId] = useState<string>(() =>
    OTHER_GRADE_APP_ROUTES.some((r) => r.gradeId === activeSubject) ? activeSubject : 'eiken_3',
  );
  const [selectedOtherRound, setSelectedOtherRound] = useState<number>(1);
  const [routeTargetLaps, setRouteTargetLaps] = useState<number>(2);
  const [diagnosticScore, setDiagnosticScore] = useState<number>(14);
  const [showDiagnosticSim, setShowDiagnosticSim] = useState<boolean>(false);
  const [selectedG2Week, setSelectedG2Week] = useState<number>(1);
  const [selectedBridgeStage, setSelectedBridgeStage] = useState<number>(5);
  const [assigningKey, setAssigningKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // PDF書庫用の状態
  const [gradeFilter, setGradeFilter] = useState<string>('eiken_2');
  const [kindFilter, setKindFilter] = useState<MaterialKindFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [sheetPrint, setSheetPrint] = useState<GachaPrintDef | null>(null);

  const totals = useMemo(() => chapterTotals(), []);

  const eikenPrints = useMemo(
    () => [
      ...SUGOROKU_DEDICATED_PDFS,
      ...GACHA_PRINTS.filter((p) => p.subject.startsWith('eiken_')),
    ],
    [],
  );

  const printById = useMemo(() => {
    const map = new Map<string, GachaPrintDef>();
    for (const p of eikenPrints) {
      map.set(p.id, p);
    }
    return map;
  }, [eikenPrints]);

  // 配信済み宿題から「いま進行中のWeek/Stage」を自動推定
  const assignedWeekSet = useMemo(() => {
    const g2 = new Set<number>();
    const bridge = new Set<number>();
    for (const a of assignments) {
      if (a.presetId === 'eiken2-12w' && typeof a.presetWeek === 'number') {
        g2.add(a.presetWeek);
      } else if (
        (a.presetId === 'eikenpre2plus-bridge' || a.presetId === 'eikenpre2-foundation') &&
        typeof a.presetWeek === 'number'
      ) {
        bridge.add(a.presetWeek);
      }
    }
    return { g2, bridge };
  }, [assignments]);

  const currentRecommendedG2Week = useMemo(() => {
    if (assignedWeekSet.g2.size === 0) return 1;
    return Math.min(12, Math.max(...assignedWeekSet.g2));
  }, [assignedWeekSet.g2]);

  const activeG2Preset: SugorokuWeekRoutePreset = useMemo(
    () =>
      SUGOROKU_GRADE2_12WEEK_PRESETS.find((w) => w.week === selectedG2Week) ??
      SUGOROKU_GRADE2_12WEEK_PRESETS[0],
    [selectedG2Week],
  );

  const activeG2AppSummary = useMemo(
    () => summarizeAppRoundsFromChapters(activeG2Preset.chapterIds, totals),
    [activeG2Preset.chapterIds, totals],
  );

  const bridgeStagesForTrack: readonly SugorokuBridgeStagePreset[] = useMemo(() => {
    if (selectedTrack === 'eiken_pre2') {
      return SUGOROKU_BRIDGE_8STAGE_PRESETS.filter((s) => s.gradeId === 'eiken_pre2');
    }
    return SUGOROKU_BRIDGE_8STAGE_PRESETS.filter((s) => s.gradeId === 'eiken_pre2plus');
  }, [selectedTrack]);

  const activeBridgePreset: SugorokuBridgeStagePreset = useMemo(() => {
    return (
      bridgeStagesForTrack.find((s) => s.stage === selectedBridgeStage) ?? bridgeStagesForTrack[0]
    );
  }, [bridgeStagesForTrack, selectedBridgeStage]);

  const activeBridgeAppSummary = useMemo(
    () => summarizeAppRoundsFromChapters(activeBridgePreset.chapterIds, totals),
    [activeBridgePreset.chapterIds, totals],
  );

  const diagnosticPlacement = useMemo(() => {
    const pct = Math.round((diagnosticScore / 25) * 100);
    return {
      pct,
      recommendation: evaluateSugorokuPlacement(pct),
    };
  }, [diagnosticScore]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return eikenPrints.filter((p) => {
      if (gradeFilter !== 'all' && p.subject !== gradeFilter) return false;
      const kind = classifyEikenMaterial(p);
      if (!kind) return false;
      if (kindFilter !== 'all' && kind !== kindFilter) return false;
      if (q) {
        const hay = `${p.label} ${p.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [eikenPrints, gradeFilter, kindFilter, keyword]);

  const handleDownload = async (fileUrl: string, label: string) => {
    setDownloadingFile(fileUrl);
    const safeName = `${label.replace(/[\\/:*?"<>|\s]+/g, '_')}.pdf`;
    try {
      await savePdf(fileUrl, safeName, label);
      onToast?.('PDFを保存しました', 'done');
    } catch {
      onToast?.('保存に失敗しました', 'warn');
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleAssignStage = async (
    mode: 'grade2_12w' | 'bridge_8stage',
    stepNumber: number,
  ) => {
    const key = `${mode}_${stepNumber}`;
    setAssigningKey(key);
    try {
      const payload = buildSugorokuWeeklyAssignmentPayload({
        classId: 'current',
        teacherUid: 'current',
        mode,
        stepNumber,
      });
      if (onQuickAssignCustom) {
        const actualTotal = totalProblemsOf(payload.chapterIds, totals);
        const daily = Math.max(5, Math.ceil((actualTotal || 30) / 4));
        const lapLabel = routeTargetLaps >= 2 ? `（${routeTargetLaps}周）` : '';
        await onQuickAssignCustom({
          title: `${payload.title}${lapLabel}`.slice(0, 40),
          chapterIds: payload.chapterIds,
          dueInDays: 7,
          dailyQuotaProblems: daily,
          targetLaps: routeTargetLaps,
          coachInstruction:
            routeTargetLaps >= 2
              ? `平日4日で1周目を解き、金・土の調整日で間違えた問題を${routeTargetLaps}周目として解き直そう！`
              : '毎日コツコツ日割り問数を進めよう！',
          presetId: payload.presetId,
          presetWeek: payload.presetWeek,
        });
        return;
      }
      if (onAssignRoutePreset) {
        await onAssignRoutePreset(payload);
        return;
      }
      onOpenCustomHomework?.();
    } finally {
      setAssigningKey(null);
    }
  };

  const activeOtherRoute = useMemo(
    () => OTHER_GRADE_APP_ROUTES.find((r) => r.gradeId === otherGradeId) ?? OTHER_GRADE_APP_ROUTES[0],
    [otherGradeId],
  );

  const otherRoundChapterIds = useMemo(() => {
    const avail = chapterIdsOfGrade(activeOtherRoute.gradeId);
    const picked = chapterIdsOfAppRound(activeOtherRoute.gradeId, selectedOtherRound, avail);
    if (picked.length > 0) return picked;
    const fallbackRoutes = buildWeeklyRoute(activeOtherRoute.gradeId, avail, 12, totals);
    return fallbackRoutes[(selectedOtherRound - 1) % fallbackRoutes.length]?.chapterIds ?? [];
  }, [activeOtherRoute.gradeId, selectedOtherRound, totals]);

  const otherRoundSummary = useMemo(
    () => summarizeAppRoundsFromChapters(otherRoundChapterIds, totals),
    [otherRoundChapterIds, totals],
  );

  const handleAssignOtherGradeRound = async () => {
    if (otherRoundChapterIds.length === 0) return;
    if (!onQuickAssignCustom) {
      onOpenCustomHomework?.();
      return;
    }
    const key = `other_${activeOtherRoute.gradeId}_r${selectedOtherRound}`;
    setAssigningKey(key);
    try {
      const lapSuffix = routeTargetLaps >= 2 ? `（${routeTargetLaps}周）` : '';
      await onQuickAssignCustom({
        title: `${activeOtherRoute.shortName} アプリ第${selectedOtherRound}回 筆記＋リスニング${lapSuffix}`.slice(
          0,
          40,
        ),
        chapterIds: otherRoundChapterIds,
        dueInDays: 7,
        dailyQuotaProblems: otherRoundSummary.daily4DayQuota,
        targetLaps: routeTargetLaps,
        coachInstruction:
          routeTargetLaps >= 2
            ? `アプリ第${selectedOtherRound}回をまずは1周解き、間違えた問題を解説確認後に${routeTargetLaps}周目まで反復しよう！`
            : `アプリ第${selectedOtherRound}回を1日${otherRoundSummary.daily4DayQuota}問ペースで進めよう！`,
        presetId: `${activeOtherRoute.gradeId}-r15`,
        presetWeek: selectedOtherRound,
      });
    } finally {
      setAssigningKey(null);
    }
  };

  const applyDiagnosticRecommendation = () => {
    const rec = diagnosticPlacement.recommendation;
    if (rec.recommendedStartTrack === 'grade2_week1') {
      setSelectedTrack('eiken_2');
      setSelectedG2Week(1);
    } else if (rec.recommendedStartTrack === 'bridge_stage5_pre2plus') {
      setSelectedTrack('eiken_pre2plus');
      setSelectedBridgeStage(5);
    } else {
      setSelectedTrack('eiken_pre2');
      setSelectedBridgeStage(1);
    }
    setShowDiagnosticSim(false);
    onToast?.(`「${rec.label}」の開始ステージを表示しました`, 'done');
  };

  return (
    <section
      aria-label="アプリ内ルート・課題管理・教材PDF"
      className="sg-stagger sg-grid-14"
    >
      {/* 上部ビュー切替：アプリ完結カリキュラム＆課題設定 ⇄ 全教材PDF書庫 */}
      <div className="sg-toolbar">
        <div className="sg-chip-group" role="group" aria-label="表示切替">
          <button
            type="button"
            className="sg-chip"
            aria-pressed={viewMode === 'roadmap'}
            onClick={() => setViewMode('roadmap')}
          >
            合格ルート＆今週やること（アプリ完結）
          </button>
          <button
            type="button"
            className="sg-chip"
            aria-pressed={viewMode === 'library'}
            onClick={() => setViewMode('library')}
          >
            配布プリント・教材PDF書庫
          </button>
        </div>

        <div className="sg-chip-group">
          {onOpenCustomHomework && (
            <PrimaryButton
              onClick={onOpenCustomHomework}
              icon={<Plus size={14} aria-hidden="true" />}
            >
              回数・単元を選んで課題を作成
            </PrimaryButton>
          )}
          <SecondaryButton
            onClick={() => setShowDiagnosticSim((v) => !v)}
            icon={<Compass size={14} aria-hidden="true" />}
          >
            初回15分診断で開始位置を判定
          </SecondaryButton>
        </div>
      </div>

      {viewMode === 'roadmap' ? (
        <div className="sg-grid-14">
          {/* 管理者用：現在このクラスに配信中の課題一覧（編集・削除・新規追加がすぐできる） */}
          <Card className="sg-grid-10" data-testid="sugoroku-active-assignments-panel">
            <div className="sg-toolbar">
              <div>
                <span className="sg-route-kicker">
                  生徒の「タイトル画面」「クラス画面」「ホーム最上部」に自動表示される課題
                </span>
                <h2 className="sg-route-h2">
                  現在配信中の課題・ペース管理（{assignments.length}件）
                </h2>
              </div>
              {onOpenCustomHomework && (
                <PrimaryButton
                  onClick={onOpenCustomHomework}
                  icon={<Plus size={14} aria-hidden="true" />}
                >
                  新しい課題を設定
                </PrimaryButton>
              )}
            </div>

            {assignments.length === 0 ? (
              <p className="sg-student-note">
                まだ課題が出されていません。下のアプリ内ルートから「ワンタップ配信」するか、「新しい課題を設定」から第1回〜第15回の回数を指定して出題できます。
              </p>
            ) : (
              <div className="slog-rows">
                {assignments.slice(0, 8).map((asg) => {
                  const qTotal = totalProblemsOf(asg.chapterIds, totals);
                  const isPast = asg.dueAt > 0 && asg.dueAt < Date.now();
                  return (
                    <div key={asg.id} className="slog-row" style={{ alignItems: 'flex-start' }}>
                      <div className="sg-grid-4" style={{ minWidth: 0, flex: 1 }}>
                        <div className="sg-row-head">
                          <ClipboardList size={14} aria-hidden="true" />
                          <strong className="sg-sub-name-strong">{asg.title}</strong>
                          {asg.dailyQuotaProblems ? (
                            <span className="sg-grade-tag">
                              1日{asg.dailyQuotaProblems}問ペース
                            </span>
                          ) : null}
                          {asg.targetLaps && asg.targetLaps >= 2 ? (
                            <span className="sg-route-assigned-badge">
                              目標{asg.targetLaps}周
                            </span>
                          ) : null}
                          {asg.targetStudentUids && asg.targetStudentUids.length > 0 ? (
                            <span className="sg-grade-tag">
                              <Users size={11} style={{ display: 'inline', marginRight: 3 }} />
                              個別{asg.targetStudentUids.length}名
                            </span>
                          ) : (
                            <span className="sg-grade-tag">クラス全員</span>
                          )}
                        </div>
                        <small style={{ color: 'var(--mt-ink-2)', fontSize: 12 }}>
                          <Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />
                          <b style={{ color: isPast ? 'var(--mt-danger)' : 'inherit' }}>
                            締切 {formatDue(asg.dueAt)}
                          </b>
                          {' ／ '}
                          全{qTotal}問（{asg.chapterIds.map((id) => chapterTitleOf(id)).join('・')}）
                        </small>
                        {asg.coachInstruction && (
                          <small style={{ color: 'var(--mt-brand-strong)', fontWeight: 700, fontSize: 12 }}>
                            指示メモ：{asg.coachInstruction}
                          </small>
                        )}
                      </div>

                      <div className="slog-row-actions">
                        {onEditAssignment && (
                          <SecondaryButton
                            onClick={() => onEditAssignment(asg)}
                            icon={<Edit3 size={13} aria-hidden="true" />}
                          >
                            変更
                          </SecondaryButton>
                        )}
                        {onDeleteAssignment && (
                          <SecondaryButton
                            disabled={deletingId === asg.id}
                            onClick={async () => {
                              setDeletingId(asg.id);
                              try {
                                await onDeleteAssignment(asg);
                              } finally {
                                setDeletingId(null);
                              }
                            }}
                            icon={<Trash2 size={13} aria-hidden="true" />}
                          >
                            削除
                          </SecondaryButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* 初回15分スタートライン診断＆A/B/C分岐シミュレーター */}
          {showDiagnosticSim && (
            <Card className="sg-route-diag-card">
              <div className="sg-toolbar">
                <div>
                  <span className="sg-route-kicker">STEP 0：入塾初回・三者面談用</span>
                  <h2 className="sg-route-h2">
                    初回15分 スタートライン診断（25問）→ アプリ内開始ステージ自動判定
                  </h2>
                </div>
                <SecondaryButton
                  onClick={() =>
                    openPdf(
                      '/sugoroku/sugoroku_eiken2_placement_diagnostic_test.pdf',
                      '入塾初回15分 英検2級スタートライン診断テスト＆A/B/C処方箋シート（全25問）',
                    )
                  }
                  icon={<Eye size={14} aria-hidden="true" />}
                >
                  診断テストPDF（6p）を開く
                </SecondaryButton>
              </div>

              <div className="sg-route-diag-slider">
                <div className="sg-toolbar">
                  <span className="sg-ink-2" style={{ fontSize: 13, fontWeight: 700 }}>
                    診断テスト得点：<b>{diagnosticScore}</b> / 25問（正答率{' '}
                    <b>{diagnosticPlacement.pct}%</b>）
                  </span>
                  <span className="sg-grade-tag">{diagnosticPlacement.recommendation.label}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  value={diagnosticScore}
                  onChange={(e) => setDiagnosticScore(e.currentTarget.valueAsNumber)}
                  aria-label="初回診断テストの得点（25点満点）"
                />
                <p className="sg-student-note">
                  {diagnosticPlacement.recommendation.summaryForCoach}
                </p>
                <div className="sg-chip-group">
                  <PrimaryButton
                    onClick={applyDiagnosticRecommendation}
                    icon={<ArrowRight size={14} aria-hidden="true" />}
                  >
                    この判定のスタート地点を開く
                  </PrimaryButton>
                </div>
              </div>
            </Card>
          )}

          {/* アプリ完結型・全体フロー俯瞰マップ（市販参考書ゼロ・すべてアプリ内の回と周回数で設計） */}
          <Card className="sg-route-overview-card">
            <div className="sg-route-overview-head">
              <div className="sg-toolbar">
                <div>
                  <span className="sg-route-kicker">
                    市販参考書不要・マナトビ英検アプリ内の全15回＆単語帳だけで合格まで完走（4日進行＋2日解き直し）
                  </span>
                  <h2 className="sg-route-h2">アプリ内完結 段階別カリキュラム・回数ルート全体図</h2>
                </div>

                {/* ルートからワンタップ配信する際の目標周回数プリセット */}
                <div className="sg-chip-group" role="group" aria-label="目標周回数">
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--mt-ink-2)' }}>
                    <Repeat size={12} style={{ display: 'inline', marginRight: 3 }} />
                    配信時の目標周回：
                  </span>
                  {[1, 2, 3].map((laps) => (
                    <button
                      key={laps}
                      type="button"
                      className="sg-chip"
                      aria-pressed={routeTargetLaps === laps}
                      onClick={() => setRouteTargetLaps(laps)}
                    >
                      {laps}周
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sg-route-flow-track" role="tablist" aria-label="ルート段階の選択">
              <button
                type="button"
                role="tab"
                aria-selected={selectedTrack === 'eiken_pre2'}
                className="sg-route-flow-node"
                data-active={selectedTrack === 'eiken_pre2' || undefined}
                onClick={() => {
                  setSelectedTrack('eiken_pre2');
                  setSelectedBridgeStage(1);
                }}
              >
                <span className="sg-route-node-badge">C判定（診断40%未満）</span>
                <strong>① 準2級 アプリ土台ルート</strong>
                <small>全4週（準2級 筆記＆リスニング 第1〜3回）</small>
              </button>

              <span className="sg-route-flow-arrow" aria-hidden="true">
                →
              </span>

              <button
                type="button"
                role="tab"
                aria-selected={selectedTrack === 'eiken_pre2plus'}
                className="sg-route-flow-node"
                data-active={selectedTrack === 'eiken_pre2plus' || undefined}
                onClick={() => {
                  setSelectedTrack('eiken_pre2plus');
                  setSelectedBridgeStage(5);
                }}
              >
                <span className="sg-route-node-badge">B判定（診断40〜54%）</span>
                <strong>② 準2級プラス アプリ橋渡し</strong>
                <small>全4週（準2+ 第1〜4回）→ 2級Week 3合流</small>
              </button>

              <span className="sg-route-flow-arrow" aria-hidden="true">
                →
              </span>

              <button
                type="button"
                role="tab"
                aria-selected={selectedTrack === 'eiken_2'}
                className="sg-route-flow-node"
                data-active={selectedTrack === 'eiken_2' || undefined}
                onClick={() => {
                  setSelectedTrack('eiken_2');
                  setSelectedG2Week(currentRecommendedG2Week);
                }}
              >
                <span className="sg-route-node-badge">A判定・本命（診断55%〜）</span>
                <strong>③ 英検2級 アプリ全15回ルート</strong>
                <small>全12週でアプリ筆記・リスニング第1〜15回完走</small>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={selectedTrack === 'other_grades'}
                className="sg-route-flow-node"
                data-active={selectedTrack === 'other_grades' || undefined}
                onClick={() => setSelectedTrack('other_grades')}
              >
                <span className="sg-route-node-badge">全級アプリ第1〜15回対応</span>
                <strong>準1級 / 1級 / 3級 / 4級 / 5級</strong>
                <small>各級 第1回〜第15回から選んでそのまま配信</small>
              </button>
            </div>
          </Card>

          {/* 1) 英検2級 アプリ全15回・12週間ルート 詳細 */}
          {selectedTrack === 'eiken_2' && (
            <div className="sg-grid-12">
              <Card className="sg-grid-10">
                <div className="sg-toolbar">
                  <div>
                    <strong className="sg-sub-name-strong">
                      英検2級 アプリ全15回（筆記・リスニング）12週間攻略マップ — 週をタップして課題確認＆配信
                    </strong>
                    <p className="sg-sub-meta" style={{ margin: '2px 0 0' }}>
                      緑チェックは配信済みの週です。平日4日で1周目を解き、残り2日で間違えた問題を解き直す（{routeTargetLaps}周定着）サイクルです。
                    </p>
                  </div>
                </div>

                <div className="sg-route-week-grid" role="group" aria-label="英検2級 12週間ステップ">
                  {SUGOROKU_GRADE2_12WEEK_PRESETS.map((w) => {
                    const isSelected = w.week === selectedG2Week;
                    const isAssigned = assignedWeekSet.g2.has(w.week);
                    const phaseShort =
                      w.week <= 4 ? '第1〜4回' : w.week <= 8 ? '第4〜9回' : '第10〜15回';
                    return (
                      <button
                        key={w.week}
                        type="button"
                        className="sg-route-week-pill"
                        data-selected={isSelected || undefined}
                        data-assigned={isAssigned || undefined}
                        onClick={() => setSelectedG2Week(w.week)}
                      >
                        <span className="sg-route-week-top">
                          <small>{phaseShort}</small>
                          {isAssigned && <CheckCircle2 size={13} aria-hidden="true" />}
                        </span>
                        <strong>Week {w.week}</strong>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* 選択中の Week：アプリ内のどの回・何問・何周やるかが一目でわかる */}
              <Card className="sg-route-focus-card" data-testid="sugoroku-route-active-stage">
                <div className="sg-toolbar sg-toolbar-top">
                  <div className="sg-grid-4">
                    <div className="sg-row-head">
                      <span className="sg-route-phase-pill">{activeG2Preset.phase}</span>
                      <span className="sg-grade-tag">
                        アプリ計 {activeG2AppSummary.totalQuestions}問（目標 {routeTargetLaps}周）
                      </span>
                      {assignedWeekSet.g2.has(activeG2Preset.week) && (
                        <span className="sg-route-assigned-badge">配信済み</span>
                      )}
                    </div>
                    <h3 className="sg-route-stage-title">
                      Week {activeG2Preset.week} のゴール：{activeG2Preset.goal}
                    </h3>
                  </div>

                  <div className="sg-chip-group">
                    <PrimaryButton
                      disabled={assigningKey === `grade2_12w_${activeG2Preset.week}`}
                      onClick={() => void handleAssignStage('grade2_12w', activeG2Preset.week)}
                      icon={<Route size={14} aria-hidden="true" />}
                    >
                      {assigningKey === `grade2_12w_${activeG2Preset.week}`
                        ? '配信中…'
                        : `Week ${activeG2Preset.week} の課題を配信（${routeTargetLaps}周）`}
                    </PrimaryButton>
                    {onOpenCustomHomework && (
                      <SecondaryButton
                        onClick={onOpenCustomHomework}
                        icon={<Edit3 size={14} aria-hidden="true" />}
                      >
                        回数・対象生徒を調整して配信
                      </SecondaryButton>
                    )}
                  </div>
                </div>

                {/* アプリ内の実単元バッジ列 */}
                <div className="sg-chip-group" aria-label="今週のアプリ内出題単元">
                  {activeG2Preset.chapterIds.map((cid) => (
                    <span key={cid} className="sg-grade-tag">
                      {chapterTitleOf(cid)}（{totals[cid] || 0}問）
                    </span>
                  ))}
                </div>

                {/* 1日のアプリ演習ペース＆週次突破チェック */}
                <div className="sg-route-pace-grid">
                  <div className="sg-route-pace-box">
                    <span className="sg-route-box-label">
                      <Sparkles size={13} aria-hidden="true" /> 1日のアプリ内ペース（4日進行＋2日解き直し）
                    </span>
                    <p>
                      平日4日：アプリ演習 <b>1日 {activeG2AppSummary.daily4DayQuota}問</b> ＋ アプリ単語カード15〜20語 ／ 残り2日：間違えた問題の2周目解き直し
                    </p>
                  </div>
                  <div className="sg-route-pace-box" data-check="true">
                    <span className="sg-route-box-label">
                      <ClipboardCheck size={13} aria-hidden="true" /> 次週へのクリア基準
                    </span>
                    <p>
                      ① アプリ課題 {activeG2AppSummary.totalQuestions}問の{routeTargetLaps}周完了 ／ ② 週次20語テスト Form A で <b>16/20点以上</b>（15点以下は Form B 再テスト）
                    </p>
                  </div>
                </div>

                {/* 4技能別「今週アプリ内でやること」 */}
                <div className="sg-route-tasks-grid">
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <BookOpen size={13} aria-hidden="true" /> アプリ一次筆記（短文語彙・長文）
                    </span>
                    <p>{activeG2AppSummary.writtenSummary}</p>
                  </div>
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <Headphones size={13} aria-hidden="true" /> アプリリスニング（音声＆スクリプト音読）
                    </span>
                    <p>{activeG2AppSummary.listeningSummary}</p>
                  </div>
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <Target size={13} aria-hidden="true" /> アプリ内「英単語を固める」＆復習ノート
                    </span>
                    <p>
                      2級単語カード 週75語（1日15〜20語）＋ 演習で間違えた問題をアプリ「復習」タブでゼロにする
                    </p>
                  </div>
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <PenLine size={13} aria-hidden="true" /> アプリ内「英作文・S-CBTスピーキング」
                    </span>
                    <p>{activeG2Preset.writingSpeakingTask}</p>
                  </div>
                </div>

                {/* 授業・面談用の補助プリントPDF（必要なときだけワンタップ印刷） */}
                <div className="sg-route-pdfs-box">
                  <span className="sg-route-box-label">
                    授業・確認テスト用の補助プリントPDF（必要な場合のみワンタップ表示）
                  </span>
                  <div className="sg-chip-group">
                    <SecondaryButton
                      onClick={() =>
                        openPdf(
                          '/sugoroku/sugoroku_eiken2_weekly_vocab_tests_12w.pdf',
                          `Week ${activeG2Preset.week} 語彙確認テスト［Form A］（問題 p.${activeG2Preset.weeklyQuizPage} / 解答 p.${activeG2Preset.weeklyAnswerPage}）`,
                        )
                      }
                      icon={<Eye size={14} aria-hidden="true" />}
                    >
                      週次テスト Form A（p.{activeG2Preset.weeklyQuizPage}）
                    </SecondaryButton>

                    <SecondaryButton
                      onClick={() =>
                        openPdf(
                          '/sugoroku/sugoroku_eiken2_weekly_vocab_retests_formB_12w.pdf',
                          `Week ${activeG2Preset.week} 再テスト［Form B］（問題 p.${activeG2Preset.weeklyQuizPage} / 解答 p.${activeG2Preset.weeklyAnswerPage}）`,
                        )
                      }
                      icon={<Eye size={14} aria-hidden="true" />}
                    >
                      不合格時 再テスト Form B
                    </SecondaryButton>

                    {activeG2Preset.pdfBooklets.map((pid) => {
                      const def = printById.get(pid);
                      if (!def) return null;
                      return (
                        <SecondaryButton
                          key={pid}
                          onClick={() => openPdf(def.file, def.label)}
                          icon={<FileText size={14} aria-hidden="true" />}
                        >
                          {def.label.replace(/^英検2級\s*/, '')}
                        </SecondaryButton>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 2) 準2級 アプリ土台（Stage 1〜4） / 準2級プラス アプリ橋渡し（Stage 5〜8） */}
          {(selectedTrack === 'eiken_pre2' || selectedTrack === 'eiken_pre2plus') && (
            <div className="sg-grid-12">
              <Card className="sg-grid-10">
                <div className="sg-toolbar">
                  <div>
                    <strong className="sg-sub-name-strong">
                      {selectedTrack === 'eiken_pre2'
                        ? '① 英検準2級 アプリ土台ルート（全4週：準2級 第1〜3回 → 準2級プラスへ昇格）'
                        : '② 英検準2級プラス アプリ橋渡しルート（全4週：準2+ 第1〜4回 → 2級Week 3へ合流）'}
                    </strong>
                    <p className="sg-sub-meta" style={{ margin: '2px 0 0' }}>
                      アプリ内の準2級・準2級プラス問題を使って4週間で基礎を固め、無理なく上位級のルートへ合流させます。
                    </p>
                  </div>
                </div>

                <div className="sg-route-week-grid" role="group" aria-label="ブリッジステージ選択">
                  {bridgeStagesForTrack.map((st) => {
                    const isSelected = st.stage === activeBridgePreset.stage;
                    const isAssigned = assignedWeekSet.bridge.has(st.stage);
                    return (
                      <button
                        key={st.stage}
                        type="button"
                        className="sg-route-week-pill"
                        data-selected={isSelected || undefined}
                        data-assigned={isAssigned || undefined}
                        onClick={() => setSelectedBridgeStage(st.stage)}
                      >
                        <span className="sg-route-week-top">
                          <small>Stage 0{st.stage}</small>
                          {isAssigned && <CheckCircle2 size={13} aria-hidden="true" />}
                        </span>
                        <strong>{st.weekLabel}</strong>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="sg-route-focus-card" data-testid="sugoroku-route-active-bridge">
                <div className="sg-toolbar sg-toolbar-top">
                  <div className="sg-grid-4">
                    <div className="sg-row-head">
                      <span className="sg-route-phase-pill">{activeBridgePreset.gradeLabel}</span>
                      <span className="sg-grade-tag">
                        アプリ計 {activeBridgeAppSummary.totalQuestions}問（1日{activeBridgeAppSummary.daily4DayQuota}問・目標{routeTargetLaps}周）
                      </span>
                    </div>
                    <h3 className="sg-route-stage-title">
                      今週のゴール：{activeBridgePreset.goal}
                    </h3>
                  </div>

                  <div className="sg-chip-group">
                    <PrimaryButton
                      disabled={assigningKey === `bridge_8stage_${activeBridgePreset.stage}`}
                      onClick={() => void handleAssignStage('bridge_8stage', activeBridgePreset.stage)}
                      icon={<Route size={14} aria-hidden="true" />}
                    >
                      {assigningKey === `bridge_8stage_${activeBridgePreset.stage}`
                        ? '配信中…'
                        : `${activeBridgePreset.weekLabel} の課題を配信（${routeTargetLaps}周）`}
                    </PrimaryButton>
                    {onOpenCustomHomework && (
                      <SecondaryButton
                        onClick={onOpenCustomHomework}
                        icon={<Edit3 size={14} aria-hidden="true" />}
                      >
                        細かく設定
                      </SecondaryButton>
                    )}
                  </div>
                </div>

                <div className="sg-chip-group">
                  {activeBridgePreset.chapterIds.map((cid) => (
                    <span key={cid} className="sg-grade-tag">
                      {chapterTitleOf(cid)}（{totals[cid] || 0}問）
                    </span>
                  ))}
                </div>

                <div className="sg-route-tasks-grid">
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <BookOpen size={13} aria-hidden="true" /> アプリ一次筆記
                    </span>
                    <p>{activeBridgeAppSummary.writtenSummary}</p>
                  </div>
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <Headphones size={13} aria-hidden="true" /> アプリリスニング
                    </span>
                    <p>{activeBridgeAppSummary.listeningSummary}</p>
                  </div>
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <PenLine size={13} aria-hidden="true" /> アプリ単語カード・英作文提出
                    </span>
                    <p>{activeBridgePreset.writingTask}</p>
                  </div>
                </div>

                <div className="sg-route-pdfs-box">
                  <span className="sg-route-box-label">
                    補助確認小テストPDF（任意）
                  </span>
                  <div className="sg-chip-group">
                    <SecondaryButton
                      onClick={() =>
                        openPdf(
                          '/sugoroku/sugoroku_pre2plus_bridge_4week_pack.pdf',
                          `段階ブリッジ小テスト Stage 0${activeBridgePreset.stage}（問題 p.${activeBridgePreset.quizPage} / 解答 p.${activeBridgePreset.answerPage}）`,
                        )
                      }
                      icon={<Eye size={14} aria-hidden="true" />}
                    >
                      小テスト Stage 0{activeBridgePreset.stage}（p.{activeBridgePreset.quizPage}）
                    </SecondaryButton>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 3) 準1級・1級・3級・4級・5級 アプリ全15回 回数指定ルート＆ワンタップ配信 */}
          {selectedTrack === 'other_grades' && (
            <div className="sg-grid-12">
              <div className="sg-toolbar">
                <div className="sg-chip-group" role="group" aria-label="対象級の選択">
                  {OTHER_GRADE_APP_ROUTES.map((r) => (
                    <button
                      key={r.gradeId}
                      type="button"
                      className="sg-chip"
                      aria-pressed={otherGradeId === r.gradeId}
                      onClick={() => setOtherGradeId(r.gradeId)}
                    >
                      {r.shortName}
                    </button>
                  ))}
                </div>

                {onOpenCustomHomework && (
                  <SecondaryButton
                    onClick={onOpenCustomHomework}
                    icon={<Edit3 size={14} aria-hidden="true" />}
                  >
                    複数回・個別生徒を指定して作成
                  </SecondaryButton>
                )}
              </div>

              <Card className="sg-route-focus-card">
                <div className="sg-toolbar sg-toolbar-top">
                  <div className="sg-grid-4">
                    <span className="sg-route-phase-pill">{activeOtherRoute.totalRoundsDesc}</span>
                    <h3 className="sg-route-stage-title">{activeOtherRoute.gradeLabel}</h3>
                    <p className="sg-student-note">
                      <b>進め方：</b>{activeOtherRoute.paceSummary} ／ <b>クリア基準：</b>
                      {activeOtherRoute.passCriteria}
                    </p>
                  </div>

                  <PrimaryButton
                    disabled={
                      assigningKey === `other_${activeOtherRoute.gradeId}_r${selectedOtherRound}` ||
                      otherRoundChapterIds.length === 0
                    }
                    onClick={() => void handleAssignOtherGradeRound()}
                    icon={<Flame size={14} aria-hidden="true" />}
                  >
                    {assigningKey === `other_${activeOtherRoute.gradeId}_r${selectedOtherRound}`
                      ? '配信中…'
                      : `${activeOtherRoute.shortName} 第${selectedOtherRound}回を課題配信（${routeTargetLaps}周）`}
                  </PrimaryButton>
                </div>

                {/* 第1回〜第15回の回数セレクター */}
                <div className="sg-grid-8">
                  <span className="sg-route-box-label">
                    アプリ内の回を選択（第1回〜第15回）— タップするとその回の問題構成が表示されます
                  </span>
                  <div className="sg-route-week-grid" role="group" aria-label="アプリ内回の選択">
                    {Array.from({ length: 15 }, (_, idx) => idx + 1).map((rNo) => (
                      <button
                        key={rNo}
                        type="button"
                        className="sg-route-week-pill"
                        data-selected={selectedOtherRound === rNo || undefined}
                        onClick={() => setSelectedOtherRound(rNo)}
                      >
                        <span className="sg-route-week-top">
                          <small>{activeOtherRoute.shortName}</small>
                        </span>
                        <strong>第{rNo}回</strong>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 選択した第N回のアプリ内内訳 */}
                <div className="sg-route-tasks-grid">
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <BookOpen size={13} aria-hidden="true" /> 第{selectedOtherRound}回 アプリ一次筆記
                    </span>
                    <p>{otherRoundSummary.writtenSummary}</p>
                  </div>
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <Headphones size={13} aria-hidden="true" /> 第{selectedOtherRound}回 アプリリスニング
                    </span>
                    <p>{otherRoundSummary.listeningSummary}</p>
                  </div>
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <Flame size={13} aria-hidden="true" /> 1日のペースメーカー設定値
                    </span>
                    <p>
                      合計 <b>{otherRoundSummary.totalQuestions}問</b> → 平日4日進行で{' '}
                      <b>1日 {otherRoundSummary.daily4DayQuota}問ペース</b>（目標 {routeTargetLaps}周）
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      ) : (
        /* 全教材PDF書庫（一覧・検索） */
        <div className="sg-grid-12">
          <div className="sg-grid-8">
            <div className="sg-chip-group" role="group" aria-label="級">
              <button
                type="button"
                className="sg-chip"
                aria-pressed={gradeFilter === 'all'}
                onClick={() => setGradeFilter('all')}
              >
                全級
              </button>
              {[...EIKEN_GRADES].reverse().map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="sg-chip"
                  aria-pressed={gradeFilter === g.id}
                  onClick={() => setGradeFilter(g.id)}
                >
                  {g.label.replace('英検', '')}
                </button>
              ))}
            </div>

            <div className="sg-toolbar">
              <div className="sg-chip-group" role="group" aria-label="種類">
                {KIND_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="sg-chip"
                    aria-pressed={kindFilter === t.id}
                    onClick={() => setKindFilter(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <label className="sg-search">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="教材名を検索"
                />
              </label>
            </div>
          </div>

          {filtered.length === 0 ? (
            <Card className="slog-empty">該当するPDFがありません</Card>
          ) : (
            <div className="sg-pdf-grid sg-stagger">
              {filtered.map((item) => {
                const gradeLabel =
                  EIKEN_GRADES.find((g) => g.id === item.subject)?.label.replace('英検', '') ??
                  item.subject;
                const isSugorokuPack = classifyEikenMaterial(item) === 'sugoroku_pack';
                return (
                  <article key={item.id} className="sg-pdf-card">
                    <div className="sg-grid-4">
                      <div className="sg-pdf-head-row">
                        <div className="sg-flex-gap-6" style={{ alignItems: 'center' }}>
                          <span className="sg-grade-tag">{gradeLabel}</span>
                          {isSugorokuPack && (
                            <span className="sg-sugoroku-pack-pill">塾専用</span>
                          )}
                        </div>
                        <span className="sg-pdf-pages">{item.pages}p</span>
                      </div>
                      <h3 className="sg-pdf-title">{item.label}</h3>
                    </div>

                    <div className="sg-flex-gap-6">
                      <PrimaryButton
                        className="sg-flex-1"
                        onClick={() => openPdf(item.file, item.label)}
                        icon={<Eye size={14} aria-hidden="true" />}
                      >
                        開く
                      </PrimaryButton>

                      {item.variants && item.variants.length > 0 ? (
                        <SecondaryButton
                          onClick={() => setSheetPrint(item)}
                          icon={<Layers size={14} aria-hidden="true" />}
                        >
                          分冊
                        </SecondaryButton>
                      ) : (
                        <SecondaryButton
                          disabled={downloadingFile === item.file}
                          onClick={() => void handleDownload(item.file, item.label)}
                          icon={<Download size={14} aria-hidden="true" />}
                        >
                          保存
                        </SecondaryButton>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 分冊ボトムシート */}
      <SugorokuBottomSheet
        open={!!sheetPrint}
        title={sheetPrint ? sheetPrint.label : '分冊'}
        onClose={() => setSheetPrint(null)}
      >
        {sheetPrint && (
          <div className="slog-rows">
            <div className="slog-row">
              <span>
                <strong>全ページ結合（{sheetPrint.pages}p）</strong>
              </span>
              <div className="slog-row-actions">
                <SecondaryButton
                  onClick={() => {
                    const target = sheetPrint;
                    setSheetPrint(null);
                    openPdf(target.file, target.label);
                  }}
                >
                  開く
                </SecondaryButton>
                <PrimaryButton
                  disabled={downloadingFile === sheetPrint.file}
                  onClick={() => void handleDownload(sheetPrint.file, sheetPrint.label)}
                >
                  保存
                </PrimaryButton>
              </div>
            </div>

            {(sheetPrint.variants ?? []).map((v) => (
              <div key={v.file} className="slog-row">
                <span>
                  <strong>
                    {v.label}（{v.pages}p）
                  </strong>
                </span>
                <div className="slog-row-actions">
                  <SecondaryButton
                    onClick={() => {
                      const title = `${sheetPrint.label}（${v.label}）`;
                      setSheetPrint(null);
                      openPdf(v.file, title);
                    }}
                  >
                    開く
                  </SecondaryButton>
                  <PrimaryButton
                    disabled={downloadingFile === v.file}
                    onClick={() =>
                      void handleDownload(v.file, `${sheetPrint.label}_${v.label}`)
                    }
                  >
                    保存
                  </PrimaryButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </SugorokuBottomSheet>
    </section>
  );
}
