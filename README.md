# マナトビ 英検版

## 対象と配信方針（2026-11-12）

- 対象は `eiken-app/` のReact 19 / TypeScript / Vite SPA。既存Vercel設定を維持し、ルートHonoテンプレートへ置き換えません。
- リポジトリは <https://github.com/mntobira/mntb-eiken> のみ。大学受験版・リスニング本体のリポジトリ／Firebase／配信先へ書き込みません。
- PR #4〜#9はマージ済み。今回の作業ブランチは `feat/eiken-reading-rounds-2-and-3`。PR #6のスマホ横はみ出し修正、#7の1列タブ修正、PR作成コマンドも保全しています。共通ソース579ファイルの同一性を維持。
- PRマージによる既存Vercel連携の自動ビルドと、本番URL・Google認証の実動作確認は別です。Cloudflareへの新規配備は行いません。
- Firebaseルール・索引・Functionsを本番へ配備していません。先のユーザー反映にPR #4の追加ルール差分まで含まれるとは見なしません。

## A2・A7：同一原本 → 分野別練習と印刷冊子

**アプリは分野別のまま維持。全大問の通し試験画面・答案タイマー・通し試験AppStateは導入しません。**

全体目標は公開7級（5・4・3・準2・準2プラス・2・準1級）それぞれ15回分。最新指示に従い、まずリーディングを優先し、リスニングは後回し、ライティングは別管理です。

現在は **公開7級それぞれの第1〜3回、計21セット・636問** を原本・分野別練習・PDF・ガチャへ接続。先行の第1回7セット（212問）に加え、全7級の第2回・第3回（14セット・424問）を独自作問して揃えました。各級3/15、合計21/105、残り84セットであり、15回分完成や一次筆記全体完成とは扱いません。1級は従来どおり準備中です。

### 教材と使い方

- 原本：`src/eiken/materials/written-booklets.ts`、`reading-round-*.ts`、`reading-round-*-more.ts`。本文・選択肢・本文和訳・設問訳・正答・4選択肢の理由を独自作成。
- アプリ：級 → 語彙・文法練習（短文・会話・整序）／リーディング練習（長文空所・読解）→ 第1〜3回の分野別カード（回数ごとの見出し付き）。従来の採点・解説・復習を使用。既存第1回の保存IDも維持。
- 変換：`writtenPractice.ts`。冊子の問題ID・問題番号・正答・解説をそのまま利用。長文は1本文に複数小問をまとめ、本文を重複表示しません。
- ガチャ：`print_eiken_<grade>_written_01`〜`_03` の実在UR21冊。5級〜準2級は `kyotsu`、準2級プラス〜準1級は `niji`。既存語彙ノート7冊と合わせPDF景品28件。各級第1〜3回であり、15回分の完全版ではありません。
- 所有後：マイPDFからセット全体、問題冊子、解答用紙、解答・解説をそれぞれ閲覧・保存。分冊ごとに印刷できます。同じ問題はアプリの分野別練習で無料で解けます。
- 公開静的PDFはアクセス制限済みではありません。ガチャ所有UIと厳密な教材アクセス保護は別です。

### 英検形式に合わせた配置

公式公開資料の**形式・配置だけ**を参照。公式問題本文・選択肢・ロゴ・表紙画像・装飾を転載しません。

- 5級問題用紙：<https://www.eiken.or.jp/eiken/exam/kakomon/2026-2-1ji_5kyu.pdf>
- 5級解答用紙見本：<https://www.eiken.or.jp/eiken/schedule/pdf/5q-hon.pdf>
- 各級の構成確認元：公式 `/solutions.html`（`writtenExamCore.ts` にURLを保持）。

| 級（各級 第1〜3回） | 1回設問 | 3回合計 | 問題 | 解答用紙 | 解説 | セット全体 |
|---|---:|---:|---:|---:|---:|---:|
| 5級 | 25 | 75 | 5p | 1p | 10p | 16p |
| 4級 | 35 | 105 | 11p | 1p | 15p | 27p |
| 3級 | 30 | 90 | 8〜9p | 1p | 13〜14p | 23p |
| 準2級 | 29 | 87 | 9p | 1p | 14p | 24p |
| 準2級プラス | 31 | 93 | 11p | 1p | 15〜16p | 27〜28p |
| 2級 | 31 | 93 | 11p | 1p | 15〜17p | 27〜29p |
| 準1級 | 31 | 93 | 10p | 1p | 15〜17p | 26〜28p |

- 大問・問題番号と各級の選択問題数が一致。短文は横4列、会話は2列×2段。短文ページ割りは5級7/8、4級8/7、3級7/8、準2級10/5、準2級プラス・2級5/5/5/2、準1級8/8/2。
- 整序は①〜④の語句、4枠、「1番目／3番目」。選択肢はアラビア数字、語句の組は丸数字で区別。
- 長文空所は本文と候補を同ページ。読解は必要に応じ本文・設問を別ページにし、掲示・Eメールは枠付き。
- 英文Times系、日本語は埋込Noto Serif JP明朝体（OFL、weight 400静的インスタンス）。ライセンスは `public/fonts/booklet-noto-serif-jp-OFL.txt`。共通書体・既存クレジットは保全。
- 準1級の英文本文10.8pt／行送り15、新設した4級・3級・準2級・準2級プラス・2級は11.5pt／17。5級の承認済み配置は維持。本文が安全領域に収まらなければ生成を拒否。
- A4・白黒・実際のサイズ（100%）。問題・解説は縦、解答用紙は横。分冊で印刷すると向きを指定しやすくなります。結合版にはPDFしおり。
- 3級以上の公式筆記時間はライティングを含むため、リーディングだけの制限時間に流用しません。表紙に対象範囲を明記。
- 新原本の `scope: 'reading'` は選択問題のみを検証。scopeを外した上位級は記述問題不足で拒否。PDF生成も記述問題を拒否し、一次筆記全体の完成と混同しません。
- 全文・選択肢・訳・正答・解説・番号、設問の分断、解答漏洩、安全余白を機械検査。各級の問題・解答用紙・全解説のレンダリング一覧も目視確認。
- **専門家の校閲・難度校正、試行受験、実機プリンターでの印刷は未実施**。機械検査や一覧画像の確認と同一視しません。CSE得点・合否換算はしません。

### 再生成と進捗

```sh
cd /home/user/webapp/eiken-app
npm run generate:materials
npm run generate:booklets
```

オフライン生成にPythonのReportLab／PyMuPDF／Pillowが必要。VercelでPython生成は実行せず、PDF・画像・レジストリをコミットします。

`export-written-booklets.ts` → `deliverables/written-booklets.json`（各級の回数・21/105の進捗台帳）→ `build-written-pdfs.py` / `written_print_layout.py` / `reading_print_layout.py` → PDF・プレビュー・`writtenPrints.generated.ts`。

語彙ノート再生成でも別冊レジストリを統合し、新冊子を消しません。`written-pdf-validation.json` に原本SHA-256・PDF SHA-256・正答・ページ配置を保持。`validateGradeSeries()` は独立した完全な15回分を要求し、ラベル替えの複製を拒否。内部 `review: approved` は執筆・正答整合性確認であり、外部校閲や難度校正済みという意味ではありません。

## 音声：収録用台本を保全、新規作業は後回し

- 現行聞き取り14問、単語420語、例文420文。予定854ファイル、889発話。男女話者を指定したElevenLabs V4収録用原稿をPR #8で保存。
- 男1 M1：会話A、女1 F1：会話B、女2 F2：設問・独話・単語・例文。現行教材に4人会話はありません。
- 音源ID・問題・予定ファイル名・話者・発話本文・`Question. ...` を収録。選択肢は読ませず、2回読みは同じ収録音を再生する方針。
- `deliverables/manatobi_eiken_recording_scripts_current.pdf` は完全版101p。聞き取り分冊、単語・例文分冊、manifest JSON、TSVも保存。`npm run generate:recording` で889発話を照合。
- 105回分の聞き取り台本完成ではありません。有料生成・音声クローンは行わず、BGM／効果音／映像も置換しません。
- パスは予定であり実在音源登録ではありません。新英検単語IDの `vocabAudioUrl()`・例文プレーヤー・録音索引は未接続。音源受領後に検査して接続します。

## A6：コード準備だけ、表には出さない

`server-staged/enrollment.ts` はデフォルト無効の未接続ドメインコード。frontend import・HTTP API・Firebase Trigger・招待画面・本番設定に接続しません。

- 検証済みGoogle ID、同一塾owner/staff、期限付き在籍、160bit乱数・1回利用の招待、HMAC-SHA256保存、原子的消費・席数更新、uid再送の冪等性を準備。
- revoked在籍復活・失効招待・塾無効・人数上限・期限不正を拒否する純粋コードとテスト。
- Admin IDトークン検証・Firestore transactionアダプター、App Check、レート制限、API、退塾運用は未実装。実アクセス制限は有効化していません。
- 厳密な教材保護には公開JS／JSON／PDF／SWキャッシュの配信設計変更が必要。疑似ログインゲートで代用しません。
- 過去のGenspark Hosted確認は `membership_required: plus_or_higher`。設定変更・回避なし。Firebase/Vercel準備とHostedアクセス設定は別です。

## A1：元語彙の級別再編（未完了）

- 参照commit：`ee648b2a961096724afbdc455d7da36a81284f44`。元 `listeningVocabulary.json` は5,713語・熟語。旧lv/ilvは英検級ではなく、一括置換しません。
- 語義・文構造・抽象度で独自判定し、訳・例文も独自作成。元データは複数公開リスト合算で、全項目の出典・権利確認は未完了。市販単語帳や元の訳・例文・選択肢の丸ごと流用は禁止。
- 現在の独自420語・各級60語は全件再編完了版ではありません。未確認モデルを使用したとは称しません。

## 既存機能と保全

- 公開7級の既存読解14本文28問、語彙文法14問、聞き取り14問（56問・42大問・21単元）を保全。冊子21セット636問を加え、**選択問題692問・531大問・90単元**。Writing10課題は別枠。
- 単語帳420語、英日／日英840問。実問題リンク189語。語彙PDF7冊は各5p・30語で、アプリ60語／級とは異なります。
- Writing10課題：入力・語数・保存・再開・自己点検・参考解答・同期。自動採点や合否判定なし。
- 同期キー、同期待ち中のアカウント切替・追加入力、手動同期失敗の成功扱い、同期後の画面更新を修正済み。
- とびらくん・装備・ブランド・動画・BGM・効果音・クレジットを保全。破損保存時は基本画像にfallbackし記録を上書きしません。
- A3：320×568から級カード2列／3列の一画面入口。本文・文字拡大時の必要なスクロールは維持。
- A4：「英検一次」「英検二次A」を明記。目安は2026年度第3回一次2027/1/24・二次A2/28、B3/7。5・4級は二次なし。個人日程選択は未実装。
- A5：初回・設定はGoogleのみ。Apple providerのConsoleは変更なし。iOSネイティブ審査要件は別途確認。
- フレンド対戦開始をホスト・2名・問番号0・サーバー開始時刻へ制限したPR #4ルールはFirebase本番反映が別途必要。全国対戦の代行開始は維持。

## 保存・入口・配信パス

- `/`：AppStateで遷移するSPA入口。`/?screenshot=1` は検証起動。
- `/prints/print_eiken_<grade>_written_01.pdf`〜`_03.pdf`：第1〜3回セット16〜29p。gradeは `5`, `4`, `3`, `pre2`, `pre2plus`, `2`, `pre1`。
- `/prints/print_eiken_<grade>_written_<01..03>_questions.pdf`、`_answers.pdf`、`_explanations.pdf`：分冊（計84 PDF）。
- `/prints/print_eiken_wordbook_<grade>.pdf`、`/data/listeningVocabulary.json?v=eiken-wordbook-20261110b`、既存 `/brand/`・`/mascots/`・`/fonts/`・`/cinematics/`・BGM。
- localStorageは `eiken:v1:` wrapper・uid別キー。名前付きFirebase App `manatobi-eiken`、Firestoreルート `eiken_`。`eiken_user_data/{uid}` の許可済み `s_*` JSONを3-way merge。
- Writingは許可済み `s_reading` を使用し旧値を保護。新フィールドの勝手な追加なし。
- 環境は `VITE_EIKEN_ENABLE_CLOUD` / `VITE_EIKEN_FIREBASE_*`。旧環境はbuild guardで拒否。ローカルpreviewはcloud無効。
- SW世代 `eiken-reading-20261112a`。英検専用キャッシュのみ管理。
- Vercel：Rootはリポジトリ直下、Install `npm ci --prefix eiken-app`、Build `npm --prefix eiken-app run build:vercel`、Output `eiken-app/dist`、Production Branch main、Node22.18以上。
- 本番URLと本番Authの確認は別途。今回新規Cloudflare配備なし。

## 検証と再現

```sh
cd /home/user/webapp/eiken-app
npm test
# 1GB環境ではpreview・ブラウザを止める
node --max-old-space-size=600 --max-semi-space-size=4 node_modules/typescript/bin/tsc --noEmit
GOMAXPROCS=1 GOMEMLIMIT=48MiB GOGC=30 NODE_OPTIONS='--max-old-space-size=620 --max-semi-space-size=4' npm run build:vercel
# PM2でbuild済みSPAをport 3000にpreviewしてから
npm run test:booklets:browser
EIKEN_ENGINE=webkit npm run test:booklets:browser
EIKEN_WIDTH=390 npm run test:release
EIKEN_WIDTH=390 EIKEN_ENGINE=webkit npm run test:release
```

今回：48 Vitest成功、src型検査・production build成功。全636問（21セット）のSubQuestionとの一対一対応、本文group内の小問数、PDF hash、全28景品（筆記・リーディング21冊＋語彙ノート7冊）のpool・実率を照合。Chromium（1280px・390px）にて全7級の新設第2・3回分野別練習フロー、マイPDFからの結合版＋3分冊DL、および `test:release` 全項目を確認。疑似txはテスト用で本番永続化ではありません。

先行PR #8：Chromium／WebKit ×1280／390幅で5級25問とセット＋3分冊を検証。既存7級読解・語彙・単語帳・両pool・破損fallbackを両エンジン390幅で検証。先行PRではWriting10課題、聞き取り14経路、音声PCM・BGM・PWA等も確認。今回全て再実施したという意味ではありません。

Auth／Firestore Emulatorの先行検証は8ルールケース・実Auth2クライアント同期・別uid拒否・対戦transaction等。本番Google／Functions／実機2台とは別です。

## PR作成

ルートでコミット済み作業ブランチから実行。PR本文に「リスニング納品の判断」欄が必須。未コミットを拒否し、現在ブランチをoriginへpushして既存PR更新、なければ作成します。

```sh
npm run pr:create -- --title "変更のタイトル" --body-file /path/to/pr-body.md
```

## 残件と次の開発

次はリーディング各級第4〜15回、**残り84セット**の独自作問・校閲を優先。ライティング冊子・英作文欄、1級教材、外部難度校正、A1全件再編、録音接続、本番Google・Functions・実端末2台同期、物理iPhone／Androidの共有・印刷、旧PWA更新は未完了。リスニングは後回し。ラベル替えや語彙ノートの繰り返しで完成扱いにしません。
