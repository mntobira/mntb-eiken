/**
 * すごろく塾 管理者ポータル：『学習ルート・教材』タブ
 * - 武田塾の参考書ルートのように「今どの段階にいて、今週何をどのペース・基準で進め、どのPDFを使い、どの宿題を出すか」を一画面で可視化
 * - 初回15分スタートライン診断（A/B/C判定シミュレーター）＋ 準2級土台 / 準2級プラス橋渡し / 英検2級12週ルート ＋ 他級（5級〜1級）ルート対応
 * - ワンタップでの該当ステージ宿題配信（onAssignRouteStage）＆ 冊子PDF直結プレビュー・保存 ＋ 全教材PDF書庫切替
 */

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Download,
  Eye,
  FileText,
  Headphones,
  Layers,
  PenLine,
  Route,
  Search,
  Sparkles,
  Target,
} from 'lucide-react';
import { GACHA_PRINTS, type GachaPrintDef } from '../../data/gachaPrints.generated';
import { EIKEN_GRADES } from '../../eiken/config';
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
 * `/sugoroku/*.pdf` が `public/` 配下に実在するため、そのまま即座にプレビュー・印刷・保存できる。
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

interface OtherGradeRouteDef {
  gradeId: string;
  gradeLabel: string;
  targetDuration: string;
  paceSummary: string;
  passCriteria: string;
  steps: Array<{
    stepNo: number;
    phase: string;
    title: string;
    goal: string;
    vocabTask: string;
    readingListeningTask: string;
    writingSpeakingTask: string;
    pdfHintSubject: string;
  }>;
}

const OTHER_GRADE_ROUTES: readonly OtherGradeRouteDef[] = [
  {
    gradeId: 'eiken_pre1',
    gradeLabel: '英検準1級 難関突破ルート',
    targetDuration: '標準 12〜16週間（1日45分×週6日）',
    paceSummary: '4日進行＋2日復習調整｜語彙B2〜C1前半＋論理長文＋要約/エッセイ添削',
    passCriteria: '大問1語彙 72%以上 ＆ 英作文2題（要約60-70語・意見120-150語）で8割安定',
    steps: [
      {
        stepNo: 1,
        phase: 'Step 1：語彙幹＆評論文構造（Week 1〜4）',
        title: '出る度A語彙制覇 ＆ 説明文の対比・因果トラッキング',
        goal: '準1級の壁である大問1（短文語彙）の基礎固めと、段落ごとの主張把握を確立する',
        vocabTask: '準1級 単語帳 出る度A・頻出熟語を平日4日で120語ペース反復',
        readingListeningTask: '一次筆記 第1〜4回（大問1・2・3）＋ リスニング Part 1/2 精聴＆シャドーイング',
        writingSpeakingTask: '英文要約（60〜70語）のパラフレーズ型習得 ＋ エッセイ4段落構成',
        pdfHintSubject: 'eiken_pre1',
      },
      {
        stepNo: 2,
        phase: 'Step 2：実戦演習＆Real-Life攻略（Week 5〜8）',
        title: 'リスニング Part 2/3 先読み完成 ＆ エッセイ週1本添削',
        goal: 'Real-Life形式の状況先読みと、時間制限内でのライティング2題完答を定着させる',
        vocabTask: '準1級 出る度B語彙 ＋ 誤答単語リストの周回',
        readingListeningTask: '一次筆記 第5〜10回（時間計測）＋ リスニング Part 2・Part 3 集中演習',
        writingSpeakingTask: '意見論述（120〜150語）提出 → 講師4観点採点＆リライト清書',
        pdfHintSubject: 'eiken_pre1',
      },
      {
        stepNo: 3,
        phase: 'Step 3：本番模試＆S-CBT面接総仕上げ（Week 9〜12）',
        title: '通し模試 素点72%突破 ＆ ナレーション2分スピーチ完成',
        goal: '本番配分で一次・S-CBT 4技能すべての合格ラインを超過達成する',
        vocabTask: '直前総点検・多義語＆句動詞ファイナルチェック',
        readingListeningTask: '一次筆記 第11〜15回 フル模試演習 ＋ 根拠箇所ハイライト復習',
        writingSpeakingTask: 'S-CBT 4コマナレーション録音＆社会性Q&A即答トレーニング',
        pdfHintSubject: 'eiken_pre1',
      },
    ],
  },
  {
    gradeId: 'eiken_3',
    gradeLabel: '英検3級 基礎＆初ライティング合格ルート',
    targetDuration: '標準 8週間（1日15〜20分×週4〜5日）',
    paceSummary: '4日進行＋2日復習調整｜中学基本語彙＋Eメール＆意見英作文テンプレ',
    passCriteria: '単語確認80%突破 ＆ Eメール返信・意見英作文（25〜35語）の型マスター',
    steps: [
      {
        stepNo: 1,
        phase: 'Step 1：中学重要単語＆会話リスニング（Week 1〜3）',
        title: '出る度A単語・熟語 ＆ リスニング第1部・第2部の耳慣らし',
        goal: '英語の基礎語順（誰が・どうする）を固め、毎日の短時間学習リズムを作る',
        vocabTask: '3級 単語帳 出る度A（日常動詞・疑問詞・熟語）を1日15語ずつ確認',
        readingListeningTask: '一次筆記 第1〜4回（大問1・2）＋ リスニング会話応答（音声後に声出し音読）',
        writingSpeakingTask: '意見英作文（I think that ... / First, ... / Second, ... 25〜35語）の型練習',
        pdfHintSubject: 'eiken_3',
      },
      {
        stepNo: 2,
        phase: 'Step 2：長文読解＆新形式Eメール返信（Week 4〜6）',
        title: '掲示・Eメール読解（大問3）＆ ライティング2題提出',
        goal: '設問キーワードから本文の答えを探す練習と、Eメール2質問への返信を完成させる',
        vocabTask: '3級 出る度B ＋ 会話定型表現',
        readingListeningTask: '一次筆記 第5〜10回（大問3含む）＋ リスニング第2部・第3部',
        writingSpeakingTask: 'Eメール問題（15〜25語）＋ 意見英作文のセット提出・添削',
        pdfHintSubject: 'eiken_3',
      },
      {
        stepNo: 3,
        phase: 'Step 3：通し演習＆二次面接音読（Week 7〜8）',
        title: '本番通し模試 ＆ パッセージ音読・イラスト質問応答',
        goal: '時間内に見直しまで終えるペースをつかみ、二次試験／S-CBT面接も一発突破する',
        vocabTask: '間違えた単語・熟語の総復習ゼロ化',
        readingListeningTask: '一次筆記 第11〜15回から厳選模試演習 ＋ リスニング通し30問',
        writingSpeakingTask: '面接カードの音読＆No.1〜No.5質問の即答練習',
        pdfHintSubject: 'eiken_3',
      },
    ],
  },
  {
    gradeId: 'eiken_4',
    gradeLabel: '英検4級 リスニング＆読解入門ルート',
    targetDuration: '標準 6〜8週間（1日15分×週4日）',
    paceSummary: '4日進行＋2日復習調整｜音声と一緒に読む音読中心カリキュラム',
    passCriteria: 'リスニング正答率75%以上 ＆ 語順並べ替え・掲示読解の安定得点',
    steps: [
      {
        stepNo: 1,
        phase: 'Step 1：基本単語＆音声リスニング習慣（Week 1〜3）',
        title: '身の回りの英単語・熟語 ＆ イラスト応答リスニング',
        goal: '毎日15分アプリを開いて音を聞きながら選ぶ習慣を身につける',
        vocabTask: '4級 単語帳 出る度A（動詞・名詞・形容詞・時刻・曜日）',
        readingListeningTask: '一次筆記 第1〜5回（大問1・大問2会話）＋ リスニング第1部・第2部',
        writingSpeakingTask: '大問3 語順並べ替え（疑問文・過去形・助動詞）の声出し確認',
        pdfHintSubject: 'eiken_4',
      },
      {
        stepNo: 2,
        phase: 'Step 2：ポスター・Eメール読解＆模試仕上げ（Week 4〜6）',
        title: '大問4 長文（掲示・メール・物語）＆ 本番通し練習',
        goal: '日時・場所・値段などの情報を素早く見つけ、65%以上の得点を安定させる',
        vocabTask: '4級 出る度B・会話表現総仕上げ',
        readingListeningTask: '一次筆記 第6〜12回（大問4読解）＋ リスニング第3部＆通し模試',
        writingSpeakingTask: '間違えた問題の解説確認と英文音読5回',
        pdfHintSubject: 'eiken_4',
      },
    ],
  },
  {
    gradeId: 'eiken_5',
    gradeLabel: '英検5級 はじめての英語スタートルート',
    targetDuration: '標準 4〜6週間（1日10〜15分×週4日）',
    paceSummary: '音声タッチ＆リズム学習｜英語が好きになるスモールステップ',
    passCriteria: 'リスニング80%得点 ＆ 基本あいさつ・疑問詞・代名詞のマスター',
    steps: [
      {
        stepNo: 1,
        phase: 'Step 1：音と意味をつなぐ基礎単語（Week 1〜3）',
        title: 'あいさつ・数字・身の回りの単語 ＆ リスニング第1部・第2部',
        goal: 'リスニングを最大の得点源にし、英語の音と文字を一致させる',
        vocabTask: '5級 単語帳 出る度Aを音声再生しながら毎日10語ずつ確認',
        readingListeningTask: '一次筆記 第1〜6回（大問1・大問2会話）＋ リスニング演習',
        writingSpeakingTask: '大問3 語順並べ替え（I play ... / Do you ...? / What time ...?）',
        pdfHintSubject: 'eiken_5',
      },
      {
        stepNo: 2,
        phase: 'Step 2：通しチャレンジ＆合格仕上げ（Week 4〜6）',
        title: '25分筆記＋20分リスニングの本番通し練習',
        goal: '最後まで集中して解き切り、自信を持って本番を迎える',
        vocabTask: '5級 頻出会話表現・疑問詞の総復習',
        readingListeningTask: '一次筆記 第7〜12回 ＋ リスニング通し25問',
        writingSpeakingTask: 'スピーキング（録音テスト）の音読チャレンジ',
        pdfHintSubject: 'eiken_5',
      },
    ],
  },
];

export interface SugorokuPdfShelfTabProps {
  onToast?: (message: string, tone?: ToastTone) => void;
  /** 現在選択中のクラスの対象級（初期表示トラックの自動選択に使用） */
  activeSubject?: string;
  /** 現在クラスに配信済みの宿題一覧（「配信中」バッジ＆現在地ハイライト用） */
  assignments?: readonly SugorokuAssignmentDoc[];
  /** ルート上のステージから1タップで今週の宿題として配信するコールバック */
  onAssignRoutePreset?: (payload: SugorokuCompatibleAssignmentPayload) => Promise<void>;
  /** 詳細宿題コンポーザーを開くコールバック */
  onOpenCustomHomework?: () => void;
}

export function SugorokuPdfShelfTab({
  onToast,
  activeSubject = 'eiken_2',
  assignments = [],
  onAssignRoutePreset,
  onOpenCustomHomework,
}: SugorokuPdfShelfTabProps) {
  const [viewMode, setViewMode] = useState<'roadmap' | 'library'>('roadmap');
  const [selectedTrack, setSelectedTrack] = useState<RouteTrackKey>(() => {
    if (activeSubject === 'eiken_pre2plus') return 'eiken_pre2plus';
    if (activeSubject === 'eiken_pre2') return 'eiken_pre2';
    if (
      activeSubject === 'eiken_pre1' ||
      activeSubject === 'eiken_3' ||
      activeSubject === 'eiken_4' ||
      activeSubject === 'eiken_5'
    ) {
      return 'other_grades';
    }
    return 'eiken_2';
  });
  const [otherGradeId, setOtherGradeId] = useState<string>(() =>
    OTHER_GRADE_ROUTES.some((r) => r.gradeId === activeSubject) ? activeSubject : 'eiken_3',
  );
  const [diagnosticScore, setDiagnosticScore] = useState<number>(14); // / 25問（既定56%＝A判定境界付近）
  const [showDiagnosticSim, setShowDiagnosticSim] = useState<boolean>(false);
  const [selectedG2Week, setSelectedG2Week] = useState<number>(1);
  const [selectedBridgeStage, setSelectedBridgeStage] = useState<number>(5);
  const [assigningKey, setAssigningKey] = useState<string | null>(null);

  // PDF書庫用の状態
  const [gradeFilter, setGradeFilter] = useState<string>('eiken_2');
  const [kindFilter, setKindFilter] = useState<MaterialKindFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [sheetPrint, setSheetPrint] = useState<GachaPrintDef | null>(null);

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
    if (!onAssignRoutePreset) {
      onOpenCustomHomework?.();
      return;
    }
    const key = `${mode}_${stepNumber}`;
    setAssigningKey(key);
    try {
      const payload = buildSugorokuWeeklyAssignmentPayload({
        classId: 'current',
        teacherUid: 'current',
        mode,
        stepNumber,
      });
      await onAssignRoutePreset(payload);
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

  const activeOtherRoute = useMemo(
    () => OTHER_GRADE_ROUTES.find((r) => r.gradeId === otherGradeId) ?? OTHER_GRADE_ROUTES[0],
    [otherGradeId],
  );

  return (
    <section
      aria-label="学習ルート・教材PDF"
      className="sg-stagger sg-grid-14"
    >
      {/* 上部ビュー切替：武田塾式の合格ルート可視化 ⇄ 全教材PDF書庫 */}
      <div className="sg-toolbar">
        <div className="sg-chip-group" role="group" aria-label="表示切替">
          <button
            type="button"
            className="sg-chip"
            aria-pressed={viewMode === 'roadmap'}
            onClick={() => setViewMode('roadmap')}
          >
            合格ルート＆今週やること
          </button>
          <button
            type="button"
            className="sg-chip"
            aria-pressed={viewMode === 'library'}
            onClick={() => setViewMode('library')}
          >
            全教材PDF書庫（検索）
          </button>
        </div>

        <div className="sg-chip-group">
          <SecondaryButton
            onClick={() =>
              openPdf(
                '/sugoroku/sugoroku_eiken2_12week_curriculum_route.pdf',
                '英検2級 3か月（12週間）合格モデルカリキュラム＆学習ルート表',
              )
            }
            icon={<FileText size={14} aria-hidden="true" />}
          >
            全体ルート表PDF
          </SecondaryButton>
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
          {/* 初回15分スタートライン診断＆A/B/C分岐シミュレーター */}
          {showDiagnosticSim && (
            <Card className="sg-route-diag-card">
              <div className="sg-toolbar">
                <div>
                  <span className="sg-route-kicker">STEP 0：入塾初回・三者面談用</span>
                  <h2 className="sg-route-h2">
                    初回15分 スタートライン診断（25問）→ 開始ルート自動判定
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

          {/* 武田塾式・全体フロー俯瞰マップ（どこから始めてどう合流・突破するかが一目でわかる） */}
          <Card className="sg-route-overview-card">
            <div className="sg-route-overview-head">
              <div>
                <span className="sg-route-kicker">
                  すごろく標準ペースメーカー（4日進行＋2日復習調整・確認テスト16/20点で次週へ突破）
                </span>
                <h2 className="sg-route-h2">段階別 カリキュラム・参考書ルート全体図</h2>
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
                <strong>① 準2級 土台ルート</strong>
                <small>全4週（Stage 1〜4）・基礎80語＋3文英作</small>
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
                <strong>② 準2級プラス 橋渡し</strong>
                <small>全4週（Stage 5〜8）→ 2級Week 3へ合流</small>
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
                <strong>③ 英検2級 12週間合格ルート</strong>
                <small>Phase 1基礎 → Phase 2実戦 → Phase 3模試</small>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={selectedTrack === 'other_grades'}
                className="sg-route-flow-node"
                data-active={selectedTrack === 'other_grades' || undefined}
                onClick={() => setSelectedTrack('other_grades')}
              >
                <span className="sg-route-node-badge">中学生・難関大別枠</span>
                <strong>準1級 / 3級 / 4級 / 5級</strong>
                <small>級別の標準ペース＆使用教材ルート</small>
              </button>
            </div>
          </Card>

          {/* 1) 英検2級 12週間標準ルート 詳細 */}
          {selectedTrack === 'eiken_2' && (
            <div className="sg-grid-12">
              {/* 3フェーズ × 12週間 すごろくマップ */}
              <Card className="sg-grid-10">
                <div className="sg-toolbar">
                  <div>
                    <strong className="sg-sub-name-strong">
                      英検2級 3か月（12週間）合格ルート — 週を選んで「今週やること」を確認
                    </strong>
                    <p className="sg-sub-meta" style={{ margin: '2px 0 0' }}>
                      緑印はクラスに宿題配信済みの週です。各週の突破基準は「週次単語テスト Form A 16/20点以上（15点以下は Form B 再テスト）」。
                    </p>
                  </div>
                </div>

                <div className="sg-route-week-grid" role="group" aria-label="英検2級 12週間ステップ">
                  {SUGOROKU_GRADE2_12WEEK_PRESETS.map((w) => {
                    const isSelected = w.week === selectedG2Week;
                    const isAssigned = assignedWeekSet.g2.has(w.week);
                    const phaseShort =
                      w.week <= 4 ? 'Phase 1 基礎' : w.week <= 8 ? 'Phase 2 実戦' : 'Phase 3 模試';
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

              {/* 選択中の Week：今何をしたいか・4技能の使用教材・1日のペース・突破基準・PDF直結・宿題配信 */}
              <Card className="sg-route-focus-card" data-testid="sugoroku-route-active-stage">
                <div className="sg-toolbar sg-toolbar-top">
                  <div className="sg-grid-4">
                    <div className="sg-row-head">
                      <span className="sg-route-phase-pill">{activeG2Preset.phase}</span>
                      <span className="sg-grade-tag">{activeG2Preset.calendarHint}</span>
                      {assignedWeekSet.g2.has(activeG2Preset.week) && (
                        <span className="sg-route-assigned-badge">宿題配信済み</span>
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
                        : `Week ${activeG2Preset.week} の宿題を配信`}
                    </PrimaryButton>
                  </div>
                </div>

                {/* 1日のペース＆週次突破チェック */}
                <div className="sg-route-pace-grid">
                  <div className="sg-route-pace-box">
                    <span className="sg-route-box-label">
                      <Sparkles size={13} aria-hidden="true" /> 1日の進め方（4日進行＋2日調整）
                    </span>
                    <p>{activeG2Preset.dailyPace}</p>
                  </div>
                  <div className="sg-route-pace-box" data-check="true">
                    <span className="sg-route-box-label">
                      <ClipboardCheck size={13} aria-hidden="true" /> 週次突破テスト・指導チェック
                    </span>
                    <p>{activeG2Preset.coachingCheck}</p>
                  </div>
                </div>

                {/* 4技能別「今週やるべき教材と範囲」（武田塾ルート表スタイル） */}
                <div className="sg-route-tasks-grid">
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <Target size={13} aria-hidden="true" /> 単語・熟語（基礎重視B1〜B2）
                    </span>
                    <p>{activeG2Preset.vocabTask}</p>
                  </div>
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <BookOpen size={13} aria-hidden="true" /> リーディング（短文・空所・長文）
                    </span>
                    <p>{activeG2Preset.readingTask}</p>
                  </div>
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <Headphones size={13} aria-hidden="true" /> リスニング（先読み＆音読）
                    </span>
                    <p>{activeG2Preset.listeningTask}</p>
                  </div>
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <PenLine size={13} aria-hidden="true" /> 英作文・S-CBTスピーキング
                    </span>
                    <p>{activeG2Preset.writingSpeakingTask}</p>
                  </div>
                </div>

                {/* このWeekで使う直結PDF教材（ワンタップで開く） */}
                <div className="sg-route-pdfs-box">
                  <span className="sg-route-box-label">
                    Week {activeG2Preset.week} で使う配布プリント・確認テストPDF（ワンタップ表示）
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

                    <SecondaryButton
                      onClick={() =>
                        openPdf(
                          '/sugoroku/sugoroku_eiken2_scbt_writing_speaking_handbook.pdf',
                          '英検2級 S-CBT面接・新形式要約・英作文＆大問1消去法 実践ハンドブック',
                        )
                      }
                      icon={<Eye size={14} aria-hidden="true" />}
                    >
                      要約・英作・面接ハンドブック
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

          {/* 2) 準2級土台（Stage 1〜4） / 準2級プラス橋渡し（Stage 5〜8） */}
          {(selectedTrack === 'eiken_pre2' || selectedTrack === 'eiken_pre2plus') && (
            <div className="sg-grid-12">
              <Card className="sg-grid-10">
                <div className="sg-toolbar">
                  <div>
                    <strong className="sg-sub-name-strong">
                      {selectedTrack === 'eiken_pre2'
                        ? '① 英検準2級 土台固めルート（全4週：Stage 1〜4 → 準2級プラスへ昇格）'
                        : '② 英検準2級プラス 橋渡しルート（全4週：Stage 5〜8 → 2級Week 3へ合流）'}
                    </strong>
                    <p className="sg-sub-meta" style={{ margin: '2px 0 0' }}>
                      いきなり2級で挫折させず、4週間で基礎語彙と要約・英作文の型を固めて上級の標準ルートへ合流させます。
                    </p>
                  </div>
                  <SecondaryButton
                    onClick={() =>
                      openPdf(
                        '/sugoroku/sugoroku_pre2plus_bridge_4week_pack.pdf',
                        '準2級・準2級プラス 段階ブリッジ学習ルート＆基礎確認小テスト（全8回・160語）',
                      )
                    }
                    icon={<Eye size={14} aria-hidden="true" />}
                  >
                    ブリッジ冊子PDF（18p）
                  </SecondaryButton>
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
                      <span className="sg-grade-tag">{activeBridgePreset.weekLabel}</span>
                    </div>
                    <h3 className="sg-route-stage-title">
                      今週のゴール：{activeBridgePreset.goal}
                    </h3>
                  </div>

                  <PrimaryButton
                    disabled={assigningKey === `bridge_8stage_${activeBridgePreset.stage}`}
                    onClick={() => void handleAssignStage('bridge_8stage', activeBridgePreset.stage)}
                    icon={<Route size={14} aria-hidden="true" />}
                  >
                    {assigningKey === `bridge_8stage_${activeBridgePreset.stage}`
                      ? '配信中…'
                      : `${activeBridgePreset.weekLabel} の宿題を配信`}
                  </PrimaryButton>
                </div>

                <div className="sg-route-tasks-grid">
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <Target size={13} aria-hidden="true" /> 単語・熟語＆確認小テスト
                    </span>
                    <p>{activeBridgePreset.vocabTask}</p>
                  </div>
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <BookOpen size={13} aria-hidden="true" /> リーディング＆リスニング演習
                    </span>
                    <p>{activeBridgePreset.readingListeningTask}</p>
                  </div>
                  <div className="sg-route-task-card">
                    <span className="sg-route-skill-tag">
                      <PenLine size={13} aria-hidden="true" /> ライティング・音読課題
                    </span>
                    <p>{activeBridgePreset.writingTask}</p>
                  </div>
                </div>

                <div className="sg-route-pdfs-box">
                  <span className="sg-route-box-label">
                    このステージで使うプリント・小テストPDF
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

                    {activeBridgePreset.pdfBooklets.map((pid) => {
                      const def = printById.get(pid);
                      if (!def) return null;
                      return (
                        <SecondaryButton
                          key={pid}
                          onClick={() => openPdf(def.file, def.label)}
                          icon={<FileText size={14} aria-hidden="true" />}
                        >
                          {def.label}
                        </SecondaryButton>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 3) 準1級・3級・4級・5級 標準ルート */}
          {selectedTrack === 'other_grades' && (
            <div className="sg-grid-12">
              <div className="sg-toolbar">
                <div className="sg-chip-group" role="group" aria-label="対象級の選択">
                  {OTHER_GRADE_ROUTES.map((r) => (
                    <button
                      key={r.gradeId}
                      type="button"
                      className="sg-chip"
                      aria-pressed={otherGradeId === r.gradeId}
                      onClick={() => setOtherGradeId(r.gradeId)}
                    >
                      {r.gradeLabel.split(' ')[0]}
                    </button>
                  ))}
                </div>

                <div className="sg-chip-group">
                  {onOpenCustomHomework && (
                    <PrimaryButton
                      onClick={onOpenCustomHomework}
                      icon={<Route size={14} aria-hidden="true" />}
                    >
                      この級の単元から宿題配信
                    </PrimaryButton>
                  )}
                  <SecondaryButton
                    onClick={() => {
                      setGradeFilter(activeOtherRoute.gradeId);
                      setViewMode('library');
                    }}
                    icon={<FileText size={14} aria-hidden="true" />}
                  >
                    この級のPDF一覧を開く
                  </SecondaryButton>
                </div>
              </div>

              <Card className="sg-route-focus-card">
                <div className="sg-grid-4">
                  <span className="sg-route-phase-pill">{activeOtherRoute.targetDuration}</span>
                  <h3 className="sg-route-stage-title">{activeOtherRoute.gradeLabel}</h3>
                  <p className="sg-student-note">
                    <b>進め方：</b>{activeOtherRoute.paceSummary} ／ <b>突破目安：</b>
                    {activeOtherRoute.passCriteria}
                  </p>
                </div>

                <div className="sg-grid-10">
                  {activeOtherRoute.steps.map((step) => (
                    <div key={step.stepNo} className="sg-route-step-block">
                      <div className="sg-row-head">
                        <span className="sg-grade-tag">{step.phase}</span>
                        <strong className="sg-sub-name-strong">{step.title}</strong>
                      </div>
                      <p className="sg-student-note">ゴール：{step.goal}</p>
                      <div className="sg-route-tasks-grid">
                        <div className="sg-route-task-card">
                          <span className="sg-route-skill-tag">単語・熟語</span>
                          <p>{step.vocabTask}</p>
                        </div>
                        <div className="sg-route-task-card">
                          <span className="sg-route-skill-tag">読解・リスニング</span>
                          <p>{step.readingListeningTask}</p>
                        </div>
                        <div className="sg-route-task-card">
                          <span className="sg-route-skill-tag">英作文・スピーキング・復習</span>
                          <p>{step.writingSpeakingTask}</p>
                        </div>
                      </div>
                    </div>
                  ))}
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
