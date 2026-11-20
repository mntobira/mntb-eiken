/**
 * すごろく塾 × マナトビ英検：
 * カリキュラムルート・段階ブリッジ判定・基礎重視語彙フィルタ連携ヘルパー（AI 5担当）
 *
 * 【競合ゼロ設計】
 * - `src/sugoroku/curriculum/` 配下に完全独立配置（`App.tsx` / `index.css` / `sugoroku/shared/types.ts` への変更なし）
 * - AI 1（管理者ポータル・講師用PDF棚）および AI 2（週次宿題コンポーザー）から
 *   import するだけで、12週標準ルート・準2級/準2級プラス8週段階ブリッジ・配布PDF一覧・C1言い換え辞書を即時利用可能。
 */

export type SugorokuTargetGradeId = 'eiken_2' | 'eiken_pre2plus' | 'eiken_pre2';

export interface SugorokuPrintablePdfEntry {
  id: string;
  title: string;
  subtitle: string;
  gradeId: SugorokuTargetGradeId;
  category: 'curriculum_route' | 'weekly_vocab_test' | 'stepup_bridge_pack';
  pages: number;
  publicUrl: string;
  deliverablePath: string;
  recommendedTiming: string;
}

export interface SugorokuWeekRoutePreset {
  week: number;
  phase: string;
  calendarHint: string;
  goal: string;
  vocabTask: string;
  readingTask: string;
  listeningTask: string;
  writingSpeakingTask: string;
  dailyPace: string;
  coachingCheck: string;
  chapterIds: readonly string[];
  pdfBooklets: readonly string[];
  weeklyQuizPage: number;
  weeklyAnswerPage: number;
}

export interface SugorokuBridgeStagePreset {
  stage: number;
  gradeId: 'eiken_pre2' | 'eiken_pre2plus';
  gradeLabel: string;
  weekLabel: string;
  goal: string;
  vocabTask: string;
  readingListeningTask: string;
  writingTask: string;
  chapterIds: readonly string[];
  pdfBooklets: readonly string[];
  quizPage: number;
  answerPage: number;
}

export interface SugorokuPlacementRecommendation {
  band: 'A_STANDARD_GRADE2' | 'B_BRIDGE_PRE2PLUS_4W' | 'C_FOUNDATION_PRE2_8W';
  label: string;
  recommendedStartTrack: 'grade2_week1' | 'bridge_stage5_pre2plus' | 'bridge_stage1_pre2';
  mergeIntoGrade2Week: number;
  summaryForCoach: string;
  recommendedPdfIds: readonly string[];
}

/** 講師用PDF教材棚にそのまま追加できるすごろく専用白黒印刷PDF 3冊（計50ページ・文字重なりゼロ検証済） */
export const SUGOROKU_CURRICULUM_PDF_SHELF: readonly SugorokuPrintablePdfEntry[] = [
  {
    id: 'sugoroku_pdf_eiken2_route_12w',
    title: '英検2級 3か月（12週間）合格モデルカリキュラム＆学習ルート表',
    subtitle: 'S-CBT逆算計画・週次日割りルート・4技能CEFR実証データ・生徒用達成チェックシート',
    gradeId: 'eiken_2',
    category: 'curriculum_route',
    pages: 6,
    publicUrl: '/sugoroku/sugoroku_eiken2_12week_curriculum_route.pdf',
    deliverablePath: 'deliverables/sugoroku/sugoroku_eiken2_12week_curriculum_route.pdf',
    recommendedTiming: '入塾初回オリエンテーション・保護者/三者面談・毎週の進捗確認',
  },
  {
    id: 'sugoroku_pdf_eiken2_weekly_vocab_12w',
    title: '英検2級 必須語彙 週次確認小テスト＆解答冊子（全12回・240語）',
    subtitle: 'Part A 意味記述12問 ＋ Part B 本番大問1形式4択空所補充8問（合格基準16/20点・直前60選付）',
    gradeId: 'eiken_2',
    category: 'weekly_vocab_test',
    pages: 26,
    publicUrl: '/sugoroku/sugoroku_eiken2_weekly_vocab_tests_12w.pdf',
    deliverablePath: 'deliverables/sugoroku/sugoroku_eiken2_weekly_vocab_tests_12w.pdf',
    recommendedTiming: '毎週の個別指導冒頭5分（問題p.2〜13／解答p.14〜25／直前総点検p.26）',
  },
  {
    id: 'sugoroku_pdf_pre2plus_bridge_8stages',
    title: '準2級・準2級プラス 段階ブリッジ学習ルート＆基礎確認小テスト（全8回・160語）',
    subtitle: '初回診断55%未満の生徒を挫折させず2級標準ルートWeek 3へ引き上げる先行ステップアップ冊子',
    gradeId: 'eiken_pre2plus',
    category: 'stepup_bridge_pack',
    pages: 18,
    publicUrl: '/sugoroku/sugoroku_pre2plus_bridge_4week_pack.pdf',
    deliverablePath: 'deliverables/sugoroku/sugoroku_pre2plus_bridge_4week_pack.pdf',
    recommendedTiming: '2級初回診断40〜54%はStage 05〜08（4週）、40%未満はStage 01〜08（8週）を先行処方',
  },
] as const;

/** 一般単語プール（listeningVocabularySource.json）のうち、運動部3か月2級ルートで推奨・除外するチャプター定義 */
export const SUGOROKU_VOCAB_POOL_POLICY = {
  recommendedChaptersForGrade2: ['lv1', 'lv2', 'lv3', 'ilv1', 'ilv2'] as const,
  excludedChaptersForGrade2ShortRoute: ['lv4', 'ilv3'] as const,
  recommendedChaptersForPre2Bridge: ['lv1', 'lv2', 'ilv1'] as const,
  cefrCoverageProof: {
    eiken_2: { readingUpToB2Percent: 95.1, listeningUpToB2Percent: 98.4, daimon1CleanPercent: 82.4 },
    eiken_pre2plus: { readingUpToB2Percent: 95.6, listeningUpToB2Percent: 99.0, daimon1CleanPercent: 89.4 },
    eiken_pre2: { readingUpToB2Percent: 96.5, listeningUpToB2Percent: 99.1, daimon1CleanPercent: 99.6 },
  },
} as const;

/** 演習中にC1難語が登場した際、暗記させずに英作文・面接用のB1/B2表現へ転換する指導辞書 */
export const SUGOROKU_C1_TO_B1B2_PARAPHRASE_MAP: Readonly<Record<string, string>> = {
  albeit: 'although / even though（〜ではあるものの）',
  replenish: 'refill / supply again（補充する）',
  depleted: 'used up / reduced（使い果たされた）',
  deplete: 'use up / reduce greatly（枯渇させる）',
  counteract: 'reduce / work against（悪影響を打ち消す）',
  stringent: 'strict / severe（厳格な）',
  irreversible: 'permanent / cannot be undone（元に戻せない）',
  defer: 'put off / postpone（延期する）',
  rectify: 'correct / fix（修正する・改める）',
  cordially: 'warmly / politely（温かく・丁寧に）',
  seamless: 'smooth（継ぎ目のない・円滑な）',
  arid: 'very dry（乾燥した）',
  equilibrium: 'balance（均衡・バランス）',
  mitigate: 'reduce / ease（緩和する・和らげる）',
  scrutiny: 'close examination / careful check（綿密な調査）',
  offset: 'make up for / balance out（相殺する・埋め合わせる）',
  appraisal: 'evaluation / review（評価・査定）',
  inadvertently: 'by accident / unintentionally（うっかり・意図せず）',
};

/** 英検2級 12週間標準ルート（AI 2 の週次宿題ワンクリックプリセットと単元ID完全互換） */
export const SUGOROKU_GRADE2_12WEEK_PRESETS: readonly SugorokuWeekRoutePreset[] = [
  {
    week: 1,
    phase: 'Phase 1：基礎固め＆型習得（Week 1〜4）',
    calendarHint: '2月第1週（開講オリエンテーション）',
    goal: '2級出題形式の全体把握・大問1（短文語彙）とリスニング第1部の毎日ペース確立',
    vocabTask: '2級単語 出る度A No.1〜75 ＋ 重点語・例文ノート①（前半1〜15語）',
    readingTask: '一次筆記 第1回（大問1 短文17問＋大問2 長文空所6問）［print_eiken_2_written_01］',
    listeningTask: 'リスニング 第1回（第1部 会話15問：音声1回読み→スクリプト音読）［r01_part1］',
    writingSpeakingTask: 'ライティング基礎（意見論述の型：主張→理由2つ→結論 80〜100語）',
    dailyPace: '平日4日：単語15語＋大問1を4問＋リスニング3問（計25〜30分/日）／金土：復習調整日',
    coachingCheck: '週次単語小テスト 第1回（記述12＋4択8＝計20問・16点合格）＋ 有効学習時間確認',
    chapterIds: ['eiken_2_written_01_short', 'eiken_2_written_01_cloze', 'eiken_2_listening_r01_part1'],
    pdfBooklets: ['print_eiken_2_written_01', 'print_eiken_wordbook_2', 'print_eiken_strategy_2'],
    weeklyQuizPage: 2,
    weeklyAnswerPage: 14,
  },
  {
    week: 2,
    phase: 'Phase 1：基礎固め＆型習得（Week 1〜4）',
    calendarHint: '2月第2週',
    goal: 'Eメール・説明文読解（大問3）の段落追跡法 ＋ リスニング第2部（説明文）の導入',
    vocabTask: '2級単語 出る度A No.76〜150 ＋ 重点語・例文ノート①（後半16〜30語）',
    readingTask: '一次筆記 第1回（大問3 長文読解8問）＋ 第2回（大問1 短文17問）',
    listeningTask: 'リスニング 第1回（第2部 15問）＋ 第2回（第1部 15問）',
    writingSpeakingTask: '筆記 第1回 意見論述（essay）提出 → 講師添削シート返却',
    dailyPace: '平日4日：単語15語＋読解1パッセージor短文5問＋リスニング6問（約30分/日）',
    coachingCheck: '週次単語小テスト 第2回（16/20点合格）＋ 筆記第1回ライティング添削指導',
    chapterIds: [
      'eiken_2_written_01_reading',
      'eiken_2_written_02_short',
      'eiken_2_listening_r01_part2',
      'eiken_2_listening_r02_part1',
    ],
    pdfBooklets: ['print_eiken_2_written_01', 'print_eiken_2_written_02', 'print_eiken_wordbook_2'],
    weeklyQuizPage: 3,
    weeklyAnswerPage: 15,
  },
  {
    week: 3,
    phase: 'Phase 1：基礎固め＆型習得（Week 1〜4）',
    calendarHint: '2月第3週',
    goal: '新形式「英文要約（45〜55語）」の3段落要約フレーム習得 ＋ 大問1スピード化',
    vocabTask: '2級単語 出る度A No.151〜225 ＋ 必須熟語 No.1〜40',
    readingTask: '一次筆記 第2回（大問2 空所6問＋大問3 読解8問）＋ 第3回（大問1 短文17問）',
    listeningTask: 'リスニング 第2回（第2部 15問）＋ 第3回（第1部 15問）',
    writingSpeakingTask: '筆記 第1回 英文要約（summary：45〜55語）提出 ＋ S-CBT音読練習開始',
    dailyPace: '平日4日：単語20語＋リーディング6問＋リスニング6問（約30分/日）',
    coachingCheck: '週次単語小テスト 第3回 ＋ 要約の語数・パラフレーズ添削（本文丸写し防止）',
    chapterIds: [
      'eiken_2_written_02_cloze',
      'eiken_2_written_02_reading',
      'eiken_2_written_03_short',
      'eiken_2_listening_r02_part2',
      'eiken_2_listening_r03_part1',
    ],
    pdfBooklets: ['print_eiken_2_written_02', 'print_eiken_2_written_03', 'print_eiken_writing_2'],
    weeklyQuizPage: 4,
    weeklyAnswerPage: 16,
  },
  {
    week: 4,
    phase: 'Phase 1：基礎固め＆型習得（Week 1〜4）',
    calendarHint: '2月第4週（1か月目到達確認・S-CBT申込案内）',
    goal: '出る度A一巡完了 ＆ 第3回通し演習で現在地スコア診断（4月S-CBT受験枠の予約）',
    vocabTask: '2級単語 出る度A No.226〜300完遂 ＋ 重点語・例文ノート②（31〜60語）',
    readingTask: '一次筆記 第3回（大問2・大問3）＋ 大問1スピード演習シート（12問・目標8分）',
    listeningTask: 'リスニング 第3回（第2部 15問）＋ 第4回（第1部・第2部 計30問）',
    writingSpeakingTask: '筆記 第2回 ライティング2題（要約＋意見論述）提出・添削返却',
    dailyPace: '平日4日：単語20語＋筆記演習＋リスニング9問（約35分/日）',
    coachingCheck: '週次単語小テスト 第4回 ＋ Phase 1総復習（正答率60%未満の大問を特定）',
    chapterIds: [
      'eiken_2_written_03_cloze',
      'eiken_2_written_03_reading',
      'eiken_2_listening_r03_part2',
      'eiken_2_listening_r04_part1',
      'eiken_2_listening_r04_part2',
    ],
    pdfBooklets: ['print_eiken_2_written_03', 'print_eiken_wordbook2_2', 'print_eiken_drill_short_2'],
    weeklyQuizPage: 5,
    weeklyAnswerPage: 17,
  },
  {
    week: 5,
    phase: 'Phase 2：実戦演習＆4技能統合（Week 5〜8）',
    calendarHint: '3月第1週',
    goal: '出る度B重要語への拡張 ＋ 医療・環境・技術評論文の因果関係把握',
    vocabTask: '2級単語 出る度B No.1〜80 ＋ 必須熟語 No.41〜90',
    readingTask: '一次筆記 第4回（全31問：短文17・空所6・読解8）＋ 第5回（大問1 短文17問）',
    listeningTask: 'リスニング 第5回（全30問）',
    writingSpeakingTask: '筆記 第3回 英文要約（summary）提出 ＋ S-CBT模擬セット①（音読＋No.1〜2録音）',
    dailyPace: '平日4日：単語25語＋筆記10問＋リスニング8問（約35分/日）',
    coachingCheck: '週次単語小テスト 第5回 ＋ S-CBTスピーキング録音①の講師聴取フィードバック',
    chapterIds: [
      'eiken_2_written_04_short',
      'eiken_2_written_04_cloze',
      'eiken_2_written_04_reading',
      'eiken_2_written_05_short',
      'eiken_2_listening_r05_part1',
      'eiken_2_listening_r05_part2',
    ],
    pdfBooklets: ['print_eiken_2_written_04', 'print_eiken_2_written_05'],
    weeklyQuizPage: 6,
    weeklyAnswerPage: 18,
  },
  {
    week: 6,
    phase: 'Phase 2：実戦演習＆4技能統合（Week 5〜8）',
    calendarHint: '3月第2週',
    goal: '時間配分厳守トレーニング（大問1を11分・大問2を12分・大問3を20分）',
    vocabTask: '2級単語 出る度B No.81〜160 ＋ 必須熟語 No.91〜140',
    readingTask: '一次筆記 第5回（大問2・大問3）＋ 第6回（全31問）',
    listeningTask: 'リスニング 第6回（全30問）＋ 第7回（第1部 15問）',
    writingSpeakingTask: '筆記 第3回 意見論述（essay）提出 ＋ S-CBT模擬セット①（No.3〜4意見質問録音）',
    dailyPace: '平日4日：単語25語＋筆記10問＋リスニング10問（約35〜40分/日）',
    coachingCheck: '週次単語小テスト 第6回 ＋ リーディング時間超過パートのフォーム矯正',
    chapterIds: [
      'eiken_2_written_05_cloze',
      'eiken_2_written_05_reading',
      'eiken_2_written_06_short',
      'eiken_2_written_06_cloze',
      'eiken_2_written_06_reading',
      'eiken_2_listening_r06_part1',
      'eiken_2_listening_r06_part2',
      'eiken_2_listening_r07_part1',
    ],
    pdfBooklets: ['print_eiken_2_written_05', 'print_eiken_2_written_06'],
    weeklyQuizPage: 7,
    weeklyAnswerPage: 19,
  },
  {
    week: 7,
    phase: 'Phase 2：実戦演習＆4技能統合（Week 5〜8）',
    calendarHint: '3月第3週（春休み集中期①）',
    goal: '部活遠征・春休み期間でも途切れない日割り演習 ＋ ライティング実戦ワーク完成',
    vocabTask: '2級単語 出る度B No.161〜240完遂 ＋ 必須熟語 No.141〜190',
    readingTask: '一次筆記 第7回（全31問）＋ 第8回（大問1・大問2 計23問）',
    listeningTask: 'リスニング 第7回（第2部 15問）＋ 第8回（全30問）',
    writingSpeakingTask: 'ライティング実戦ワークPDF（独自課題2題：要約18分＋意見論述22分計測）提出',
    dailyPace: '春休み平日：単語25語＋筆記11問＋リスニング10問（約40分/日）',
    coachingCheck: '週次単語小テスト 第7回 ＋ 3日未学習アラートゼロ維持・ライティング4観点採点',
    chapterIds: [
      'eiken_2_written_07_short',
      'eiken_2_written_07_cloze',
      'eiken_2_written_07_reading',
      'eiken_2_written_08_short',
      'eiken_2_written_08_cloze',
      'eiken_2_listening_r07_part2',
      'eiken_2_listening_r08_part1',
      'eiken_2_listening_r08_part2',
    ],
    pdfBooklets: ['print_eiken_2_written_07', 'print_eiken_2_written_08', 'print_eiken_writing_2'],
    weeklyQuizPage: 8,
    weeklyAnswerPage: 20,
  },
  {
    week: 8,
    phase: 'Phase 2：実戦演習＆4技能統合（Week 5〜8）',
    calendarHint: '3月第4週（春休み集中期②・中間模試判定）',
    goal: '中間フル模試（85分筆記＋25分リスニング＋S-CBT面接通し）で合格圏（65%以上）到達確認',
    vocabTask: 'Week 1〜7 間違えた単語の総復習 ＋ 必須熟語 No.191〜240',
    readingTask: '一次筆記 第8回（大問3）＋ 第9回（本番想定通し31問）',
    listeningTask: 'リスニング 第9回（本番想定25分通し30問）',
    writingSpeakingTask: 'S-CBTスピーキング模擬セット②（マイク確認〜音読〜No.1〜4完全通し録音）',
    dailyPace: '模試演習日（110分通し）＋ 平日4日で全誤答の根拠言語化＆音読復習',
    coachingCheck: '週次単語小テスト 第8回 ＋ ★第1回S-CBT受験（4月枠）に向けた弱点処方箋作成',
    chapterIds: [
      'eiken_2_written_08_reading',
      'eiken_2_written_09_short',
      'eiken_2_written_09_cloze',
      'eiken_2_written_09_reading',
      'eiken_2_listening_r09_part1',
      'eiken_2_listening_r09_part2',
    ],
    pdfBooklets: ['print_eiken_2_written_08', 'print_eiken_2_written_09'],
    weeklyQuizPage: 9,
    weeklyAnswerPage: 21,
  },
  {
    week: 9,
    phase: 'Phase 3：本番模試演習＆得点最大化（Week 9〜12）',
    calendarHint: '4月第1週（★S-CBT第1回チャレンジ期）',
    goal: 'リスニング先読みリズム（設問選択肢の10秒縦読み）完成 ＋ 記述の減点ゼロ化',
    vocabTask: '基礎重視フィルタ承認 出る度C厳選語① ＋ 必須熟語 No.241〜280完遂',
    readingTask: '一次筆記 第10回（全31問）＋ 第11回（大問1・大問2 計23問）',
    listeningTask: 'リスニング 第10回（全30問）＋ 第11回（第1部 15問）',
    writingSpeakingTask: 'アプリ基礎ライティング（因果関係を保った要約）時間内提出＋自己点検チェック',
    dailyPace: '平日4日：単語20語＋筆記11問＋リスニング10問（約40分/日）',
    coachingCheck: '週次単語小テスト 第9回 ＋ S-CBT第1回受験生は手応え振り返り＆第2回対策調整',
    chapterIds: [
      'eiken_2_written_10_short',
      'eiken_2_written_10_cloze',
      'eiken_2_written_10_reading',
      'eiken_2_written_11_short',
      'eiken_2_written_11_cloze',
      'eiken_2_listening_r10_part1',
      'eiken_2_listening_r10_part2',
      'eiken_2_listening_r11_part1',
    ],
    pdfBooklets: ['print_eiken_2_written_10', 'print_eiken_2_written_11'],
    weeklyQuizPage: 10,
    weeklyAnswerPage: 22,
  },
  {
    week: 10,
    phase: 'Phase 3：本番模試演習＆得点最大化（Week 9〜12）',
    calendarHint: '4月第2週',
    goal: '選択肢の言い換え（パラフレーズ）見抜き訓練 ＋ 意見論述の汎用理由ストック確立',
    vocabTask: '基礎重視フィルタ承認 出る度C厳選語② ＋ 頻出コロケーション総復習',
    readingTask: '一次筆記 第11回（大問3）＋ 第12回（全31問）＋ 第13回（大問1 短文17問）',
    listeningTask: 'リスニング 第11回（第2部 15問）＋ 第12回（全30問）',
    writingSpeakingTask: 'アプリ基礎ライティング（効率と利用しやすさを論じる）提出 → 添削シートPDF返却',
    dailyPace: '平日4日：単語20語＋筆記11問＋リスニング10問（約40分/日）',
    coachingCheck: '週次単語小テスト 第10回 ＋ スピーキングNo.3/No.4「賛成・反対の即答テンプレ」確認',
    chapterIds: [
      'eiken_2_written_11_reading',
      'eiken_2_written_12_short',
      'eiken_2_written_12_cloze',
      'eiken_2_written_12_reading',
      'eiken_2_written_13_short',
      'eiken_2_listening_r11_part2',
      'eiken_2_listening_r12_part1',
      'eiken_2_listening_r12_part2',
    ],
    pdfBooklets: ['print_eiken_2_written_11', 'print_eiken_2_written_12', 'print_eiken_2_written_13'],
    weeklyQuizPage: 11,
    weeklyAnswerPage: 23,
  },
  {
    week: 11,
    phase: 'Phase 3：本番模試演習＆得点最大化（Week 9〜12）',
    calendarHint: '4月第3週',
    goal: '本番同様マークシート＆ライティング横型解答用紙での時間内完答（素点70%以上安定）',
    vocabTask: '12週小テスト総復習（Week 1〜10の誤答語ピックアップ反復）',
    readingTask: '一次筆記 第13回（大問2・大問3）＋ 第14回（全31問・印刷冊子通し）',
    listeningTask: 'リスニング 第13回（全30問）＋ 第14回（全30問）',
    writingSpeakingTask: '筆記 第2回・第3回ライティングのリライト（添削指摘箇所の完全再現清書）＋ S-CBT録音総仕上げ',
    dailyPace: '平日4日：復習単語30語＋筆記11問＋リスニング12問（約40分/日）',
    coachingCheck: '週次単語小テスト 第11回 ＋ 保護者・担任共有用「学習時間・正答率成長レポート」出力',
    chapterIds: [
      'eiken_2_written_13_cloze',
      'eiken_2_written_13_reading',
      'eiken_2_written_14_short',
      'eiken_2_written_14_cloze',
      'eiken_2_written_14_reading',
      'eiken_2_listening_r13_part1',
      'eiken_2_listening_r13_part2',
      'eiken_2_listening_r14_part1',
      'eiken_2_listening_r14_part2',
    ],
    pdfBooklets: ['print_eiken_2_written_13', 'print_eiken_2_written_14'],
    weeklyQuizPage: 12,
    weeklyAnswerPage: 24,
  },
  {
    week: 12,
    phase: 'Phase 3：本番模試演習＆得点最大化（Week 9〜12）',
    calendarHint: '4月第4週〜5月（★S-CBT本命受験 ＆ 第1回本試験直前）',
    goal: '全15回コンプリート達成・本番シミュレーション完遂 → 7月までの英検2級確実合格へ接続',
    vocabTask: '2級必須240語ファイナルチェック ＋ アプリ忘却曲線「復習リスト」完全ゼロ化',
    readingTask: '一次筆記 第15回（最終卒業模試 全31問）＋ 弱点大問ピンポイント解き直し',
    listeningTask: 'リスニング 第15回（最終卒業模試 全30問）＋ 0.75x/1.0x 聞き取り最終確認',
    writingSpeakingTask: '本番時間配分（要約18分＋英作文22分＋見直し3分）最終演習 ＆ S-CBT本番直前メンタリング',
    dailyPace: '直前調整：新出難語（C1）には一切手を出さず、既習B1〜B2語彙と頻出型の精度100%に集中',
    coachingCheck: '週次単語小テスト 第12回（最終回）＋ S-CBT 5月・6月予備枠／第1回本試験の戦略確定',
    chapterIds: [
      'eiken_2_written_15_short',
      'eiken_2_written_15_cloze',
      'eiken_2_written_15_reading',
      'eiken_2_listening_r15_part1',
      'eiken_2_listening_r15_part2',
    ],
    pdfBooklets: ['print_eiken_2_written_15'],
    weeklyQuizPage: 13,
    weeklyAnswerPage: 25,
  },
] as const;

/** 準2級・準2級プラス 8ステージ段階ブリッジプリセット */
export const SUGOROKU_BRIDGE_8STAGE_PRESETS: readonly SugorokuBridgeStagePreset[] = [
  {
    stage: 1,
    gradeId: 'eiken_pre2',
    gradeLabel: '英検準2級（土台期）',
    weekLabel: '準2級 Week 1',
    goal: '中学〜高1基礎の会話・日常動詞（A2〜B1前半）を固め、英語アレルギーを払拭する',
    vocabTask: '準2級 出る度A（基礎動詞・名詞）＋ 基礎確認小テスト Stage 01（20語）',
    readingListeningTask: '準2級 一次筆記 第1回（大問1・大問2）＋ リスニング 第1回（第1部 会話応答10問）',
    writingTask: '準2級 Eメール返信と意見英作文（50〜60語）の3文構成テンプレ練習',
    chapterIds: ['eiken_pre2_written_01_short', 'eiken_pre2_written_01_cloze', 'eiken_pre2_listening_r01_part1'],
    pdfBooklets: ['print_eiken_pre2_written_01', 'print_eiken_wordbook_pre2'],
    quizPage: 3,
    answerPage: 11,
  },
  {
    stage: 2,
    gradeId: 'eiken_pre2',
    gradeLabel: '英検準2級（土台期）',
    weekLabel: '準2級 Week 2',
    goal: '準2級の説明文（大問3）とリスニング第2部・第3部で「主語と動詞を見失わない」訓練',
    vocabTask: '準2級 出る度A/B（日常形容詞・副詞）＋ 基礎確認小テスト Stage 02（20語）',
    readingListeningTask: '準2級 一次筆記 第1回（大問3）＋ 第2回（大問1）＋ リスニング 第1回（第2部・第3部）',
    writingTask: '準2級 筆記第1回 ライティング提出 → 語順・時制ミス添削',
    chapterIds: ['eiken_pre2_written_01_reading', 'eiken_pre2_written_02_short', 'eiken_pre2_listening_r01_part2'],
    pdfBooklets: ['print_eiken_pre2_written_01', 'print_eiken_pre2_written_02'],
    quizPage: 4,
    answerPage: 12,
  },
  {
    stage: 3,
    gradeId: 'eiken_pre2',
    gradeLabel: '英検準2級（土台期）',
    weekLabel: '準2級 Week 3',
    goal: '接続詞（although / however / therefore）と会話群動詞を習得し、段落の展開を追う',
    vocabTask: '準2級 出る度B・必須熟語① ＋ 基礎確認小テスト Stage 03（20語）',
    readingListeningTask: '準2級 一次筆記 第2回（大問2・大問3）＋ リスニング 第2回（全30問）',
    writingTask: '準2級 筆記第2回 ライティング提出 ＋ S-CBT音読パッセージ声出し練習',
    chapterIds: ['eiken_pre2_written_02_cloze', 'eiken_pre2_written_02_reading', 'eiken_pre2_listening_r02_part1'],
    pdfBooklets: ['print_eiken_pre2_written_02', 'print_eiken_writing_pre2'],
    quizPage: 5,
    answerPage: 13,
  },
  {
    stage: 4,
    gradeId: 'eiken_pre2',
    gradeLabel: '英検準2級（土台期）',
    weekLabel: '準2級 Week 4（昇格判定）',
    goal: '準2級 第3回通し演習で正答率65%以上クリア → 『準2級プラス』橋渡しへ昇格',
    vocabTask: '準2級 総整理＆頻出熟語② ＋ 基礎確認小テスト Stage 04（20語）',
    readingListeningTask: '準2級 一次筆記 第3回（通し37問）＋ リスニング 第3回（通し30問）',
    writingTask: '準2級 第3回英作文完成 ＋ 準2級プラス「英文要約」への導入ガイダンス',
    chapterIds: ['eiken_pre2_written_03_short', 'eiken_pre2_written_03_reading', 'eiken_pre2_listening_r03_part1'],
    pdfBooklets: ['print_eiken_pre2_written_03'],
    quizPage: 6,
    answerPage: 14,
  },
  {
    stage: 5,
    gradeId: 'eiken_pre2plus',
    gradeLabel: '準2級プラス（橋渡し）',
    weekLabel: '準2プラス Week 1',
    goal: '日常話題から社会・科学テーマへの橋渡し語彙（CEFR B1中核）と短文空所に慣れる',
    vocabTask: '準2級プラス 出る度A①（社会基礎動詞・名詞）＋ ブリッジ小テスト Stage 05（20語）',
    readingListeningTask: '準2級プラス 一次筆記 第1回（大問1 短文17問＋大問2 空所6問）＋ リスニング 第1回 第1部',
    writingTask: '準2級プラス 新形式「英文要約（35〜45語）」の骨格抜き出し練習',
    chapterIds: [
      'eiken_pre2plus_written_01_short',
      'eiken_pre2plus_written_01_cloze',
      'eiken_pre2plus_listening_r01_part1',
    ],
    pdfBooklets: ['print_eiken_pre2plus_written_01', 'print_eiken_wordbook_pre2plus'],
    quizPage: 7,
    answerPage: 15,
  },
  {
    stage: 6,
    gradeId: 'eiken_pre2plus',
    gradeLabel: '準2級プラス（橋渡し）',
    weekLabel: '準2プラス Week 2',
    goal: '準2級プラス長文（大問3）で2級と同じ「評論文の対比・因果構造」をつかむ',
    vocabTask: '準2級プラス 出る度A②（因果・変化・評価語彙）＋ ブリッジ小テスト Stage 06（20語）',
    readingListeningTask: '準2級プラス 一次筆記 第1回（大問3）＋ 第2回（大問1・大問2）＋ リスニング 第1回 第2部',
    writingTask: '準2級プラス 第1回 要約＆意見論述（70〜85語）提出 → 添削フィードバック',
    chapterIds: [
      'eiken_pre2plus_written_01_reading',
      'eiken_pre2plus_written_02_short',
      'eiken_pre2plus_listening_r01_part2',
    ],
    pdfBooklets: ['print_eiken_pre2plus_written_01', 'print_eiken_pre2plus_written_02'],
    quizPage: 8,
    answerPage: 16,
  },
  {
    stage: 7,
    gradeId: 'eiken_pre2plus',
    gradeLabel: '準2級プラス（橋渡し）',
    weekLabel: '準2プラス Week 3',
    goal: 'B1後半の抽象名詞・群動詞を定着させ、2級リスニングの語数・速度に耳を慣らす',
    vocabTask: '準2級プラス 出る度B・必須熟語① ＋ ブリッジ小テスト Stage 07（20語）',
    readingListeningTask: '準2級プラス 一次筆記 第2回（大問3）＋ 第3回（全31問）＋ リスニング 第2回（全30問）',
    writingTask: '準2級プラス 第2回 要約（35〜45語）時間内作成 ＋ S-CBT面接イラスト描写練習',
    chapterIds: [
      'eiken_pre2plus_written_02_reading',
      'eiken_pre2plus_written_03_short',
      'eiken_pre2plus_listening_r02_part1',
      'eiken_pre2plus_listening_r02_part2',
    ],
    pdfBooklets: ['print_eiken_pre2plus_written_03', 'print_eiken_writing_pre2plus'],
    quizPage: 9,
    answerPage: 17,
  },
  {
    stage: 8,
    gradeId: 'eiken_pre2plus',
    gradeLabel: '準2級プラス（橋渡し）',
    weekLabel: '準2プラス Week 4（2級合流）',
    goal: '準2級プラス卒業模試（正答率65%突破）→ 英検2級12週標準ルート Week 3へスムーズ合流！',
    vocabTask: '準2級プラス 2級直結総仕上げ ＋ ブリッジ小テスト Stage 08（20語）',
    readingListeningTask: '準2級プラス 一次筆記 第4回（通し31問）＋ リスニング 第3回（通し30問）',
    writingTask: '2級語数（要約45〜55語・英作文80〜100語）への拡張トライアル提出',
    chapterIds: [
      'eiken_pre2plus_written_04_short',
      'eiken_pre2plus_written_04_reading',
      'eiken_pre2plus_listening_r03_part1',
      'eiken_pre2plus_listening_r03_part2',
    ],
    pdfBooklets: ['print_eiken_pre2plus_written_04'],
    quizPage: 10,
    answerPage: 18,
  },
] as const;

/**
 * 入塾初回の英検2級診断正答率（0〜100%）から最適な開始ステージを自動判定する
 */
export function evaluateSugorokuPlacement(grade2DiagnosticPercent: number): SugorokuPlacementRecommendation {
  const clamped = Math.max(0, Math.min(100, Math.round(grade2DiagnosticPercent)));
  if (clamped >= 55) {
    return {
      band: 'A_STANDARD_GRADE2',
      label: 'A判定：英検2級 標準12週ルート直行',
      recommendedStartTrack: 'grade2_week1',
      mergeIntoGrade2Week: 1,
      summaryForCoach:
        '基礎語彙（A2〜B1）は定着しています。『英検2級 12週間標準ルート』Week 1から開始し、4月S-CBT第1回受験を狙います。',
      recommendedPdfIds: ['sugoroku_pdf_eiken2_route_12w', 'sugoroku_pdf_eiken2_weekly_vocab_12w'],
    };
  }
  if (clamped >= 40) {
    return {
      band: 'B_BRIDGE_PRE2PLUS_4W',
      label: 'B判定：準2級プラス 4週間ブリッジ先行 → 2級Week 3合流',
      recommendedStartTrack: 'bridge_stage5_pre2plus',
      mergeIntoGrade2Week: 3,
      summaryForCoach:
        '準2級相当の力はありますが2級評論文の語彙・要約に負荷があります。段階ブリッジ冊子 Stage 05〜08（準2級プラス4週）を挟んでから2級Week 3へ合流します。',
      recommendedPdfIds: [
        'sugoroku_pdf_pre2plus_bridge_8stages',
        'sugoroku_pdf_eiken2_route_12w',
        'sugoroku_pdf_eiken2_weekly_vocab_12w',
      ],
    };
  }
  return {
    band: 'C_FOUNDATION_PRE2_8W',
    label: 'C判定：準2級土台（4週）＋準2級プラス（4週）段階ブリッジ先行',
    recommendedStartTrack: 'bridge_stage1_pre2',
    mergeIntoGrade2Week: 3,
    summaryForCoach:
      'いきなり2級から始めると消化不良になりやすい状態です。段階ブリッジ冊子 Stage 01〜08（準2級→準2級プラス計8週）でA2〜B1を固めてから2級へ進みます。',
    recommendedPdfIds: ['sugoroku_pdf_pre2plus_bridge_8stages', 'sugoroku_pdf_eiken2_route_12w'],
  };
}

export function getSugorokuGrade2WeekPreset(week: number): SugorokuWeekRoutePreset | undefined {
  return SUGOROKU_GRADE2_12WEEK_PRESETS.find(w => w.week === week);
}

export function getSugorokuBridgeStagePreset(stage: number): SugorokuBridgeStagePreset | undefined {
  return SUGOROKU_BRIDGE_8STAGE_PRESETS.find(s => s.stage === stage);
}

export function lookupB1B2ParaphraseHint(word: string): string | null {
  const key = word.trim().toLowerCase();
  return SUGOROKU_C1_TO_B1B2_PARAPHRASE_MAP[key] ?? null;
}
