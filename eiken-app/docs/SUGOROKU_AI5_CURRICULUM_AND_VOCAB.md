# すごろく塾 × マナトビ英検：AI 5（語彙CEFR監査・12週/段階ブリッジカリキュラム・印刷PDF全6冊・オンライン小テスト部品）連携ガイド（v4）

本書は、`03_AI並列開発指示書` における **AI 5 担当領域** の成果物一覧および、**AI 1（管理者ポータル）・AI 2（宿題＆時間ログ）・AI 3（ライティング＆S-CBTスピーキング添削）** から 1 行で呼び出せる TypeScript 連携インターフェースの公式仕様書です。

---

## 1. 競合ゼロ設計・既存資産保護の保証

- **独立名前空間**：フロントエンド連携コードはすべて `eiken-app/src/sugoroku/curriculum/` 配下に完全分離しており、`App.tsx` / `index.css` / `src/sugoroku/shared/types.ts` を一切編集していません（PR #47 / #49 / #50 / #52 とコンフリクトゼロでマージ可能）。
- **既存資産の不変保護**：既存の `wordbook.tsv`（6,600語）、一次筆記冊子（105冊）、リスニング冊子（120冊）、`deliverables/listening_retake_minimal/**`（199件）への変更は **0バイト** です。
- **メモリ制約クリア**：自動生成データ `vocabQuizData.ts` は TypeScript AST を肥大化させない `JSON.parse` 方式を採用しており、`tsc --noEmit`（`--max-old-space-size=680`）および `vite build`（750MB上限）を余裕で通過します。

---

## 2. すごろく塾専用 白黒印刷PDF フルスイート（全6冊・計89ページ）

すべての PDF は `eiken-app/deliverables/sugoroku/` と `eiken-app/public/sugoroku/` の双方に配置済みで、本番 Web アプリからは `/sugoroku/<filename>.pdf` でそのまま配信・ダウンロード可能です（PyMuPDF により全89ページの **文字重なり 0件・はみ出し 0件・純粋グレースケール R=G=B** を自動検証済み）。

| # | 公開パス（`publicUrl`） | 頁数 | 用途・配布タイミング |
| :---: | :--- | :---: | :--- |
| 1 | `/sugoroku/sugoroku_eiken2_placement_diagnostic_test.pdf` | 6p | **入塾初回15分 スタートライン診断テスト（全25問）＆三者面談用A/B/C処方箋・初週ルーティン表** |
| 2 | `/sugoroku/sugoroku_eiken2_12week_curriculum_route.pdf` | 6p | **英検2級 3か月（12週間）合格モデルカリキュラム表・4技能CEFR実証（長文95.1%/聴解98.4%）・達成シート** |
| 3 | `/sugoroku/sugoroku_eiken2_weekly_vocab_tests_12w.pdf` | 26p | **英検2級 週次確認小テスト［本試験 Form A］全12回（240語：記述12＋全文掲載4択8）＆解答＋直前60選** |
| 4 | `/sugoroku/sugoroku_eiken2_weekly_vocab_retests_formB_12w.pdf` | 25p | **15点以下不合格者用『再テスト専用 別フォーム［Form B］』全12回（記述⇔4択クロス入替＋新選択肢）** |
| 5 | `/sugoroku/sugoroku_pre2plus_bridge_4week_pack.pdf` | 18p | **準2級・準2級プラス 段階ブリッジ学習ルート＆基礎確認小テスト全8回（160語）＆解答冊子** |
| 6 | `/sugoroku/sugoroku_eiken2_scbt_writing_speaking_handbook.pdf` | 8p | **英検2級 S-CBT面接No.1〜4黄金型・45-55語要約3文骨格・英作文6大理由＆大問1 C1全45問消去法ハンドブック** |

---

## 3. AI 1・AI 2・AI 3 からのワンライン連携スニペット

### A. AI 1（管理者ポータル `SugorokuAdminApp` / 生徒詳細カルテ）からの利用

```tsx
import {
  SUGOROKU_CURRICULUM_PDF_SHELF,
  SugorokuWeeklyVocabQuizWidget,
} from '../curriculum';

// 1) 講師用PDF教材棚タブに全6冊（89ページ）を一覧表示
// SUGOROKU_CURRICULUM_PDF_SHELF.map(pdf => <a href={pdf.publicUrl} target="_blank">{pdf.title}</a>)

// 2) 生徒詳細モーダルや体験授業画面に「初回25問診断＆週次20問テスト（Form A/B自動切替）」を埋め込み
<SugorokuWeeklyVocabQuizWidget
  initialTrack="placementDiagnostic25"
  studentName="山田 太郎"
  classId={currentClassId}
  teacherUid={currentTeacherUid}
  onAssignRecommendedHomework={payload => saveAssignmentToFirestore(payload)}
  onRegisterMissedWordIds={wordIds => registerWordsToReviewList(wordIds)}
/>
```

### B. AI 2（週次宿題コンポーザー＆「基礎重視」単語帳モード）からの利用

```ts
import {
  buildSugorokuWeeklyAssignmentPayload,
  isSugorokuFoundationApprovedWordId,
  SUGOROKU_VOCAB_POOL_POLICY,
} from '../curriculum';

// 1) 「4日進行＋2日調整」ペースメーカー計算済みの SugorokuAssignmentDoc 互換オブジェクトを即生成
const week1Plan = buildSugorokuWeeklyAssignmentPayload({
  classId: 'class_sugoroku_01',
  teacherUid: coachUid,
  mode: 'grade2_12w', // または 'bridge_8stage' (stepNumber: 1..8)
  stepNumber: 1,      // Week 1..12
});
// -> week1Plan.dailyQuotaProblems (1日目安問数), week1Plan.chapterIds, week1Plan.skillBreakdown が自動算出済み

// 2) 単語帳・ガチャ演習で C1低ROI難語（2級143語等）とメタデータ不良項目を O(1) で除外
const approvedWords = allGrade2Words.filter(w =>
  isSugorokuFoundationApprovedWordId('eiken_2', w.id),
);
```

### C. AI 3（ライティング添削・S-CBTスピーキング指導）からの利用

```ts
import { lookupB1B2ParaphraseHint } from '../curriculum';

// 生徒が無理に準1級（C1）難語を使おうとした際、減点リスクのないB1/B2平易表現をサジェスト
const hint = lookupB1B2ParaphraseHint('mitigate');
// -> "reduce / ease（緩和する・和らげる）"
```

---

## 4. 再生成コマンド（再現手順）

```bash
# 1. 全技能CEFR語彙監査（単語帳6,600語・大問1 735問・長文173本文・聴解1,350音源）＋全665問テストバンク＆TSデータ生成
cd eiken-app && npx tsx scripts/sugoroku-vocab-audit.ts

# 2. 白黒印刷最適化PDF 全6冊（89ページ）生成 ＋ PyMuPDFレイアウト・グレースケール機械検証 ＋ public/sugoroku 同期
cd eiken-app && python3 scripts/build-sugoroku-curriculum-pdf.py && cp deliverables/sugoroku/*.pdf public/sugoroku/
```
