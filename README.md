# マナトビ 英検版

## 対象と配信方針（2026-11-11）

- 対象は `eiken-app/` のReact 19 / TypeScript / Vite SPA。既存Vercel設定を維持し、ルートのHonoテンプレートへ置き換えません。
- リポジトリ：<https://github.com/mntobira/mntb-eiken> のみ。大学受験版・リスニング本体のリポジトリ／Firebase／配信先へ書き込みません。
- ガチャのスマホ横はみ出し修正PR #6と1列タブ修正PR #7も取り込み、CSS・回帰テスト・PR作成コマンドを保全しています。共通ソース579ファイルの同一性を維持。

- 先行PR [#4](https://github.com/mntobira/mntb-eiken/pull/4)、[#5](https://github.com/mntobira/mntb-eiken/pull/5) はマージ済み。今回の追加差分は `feat/eiken-recording-and-staged-enrollment`。
- PRマージによる既存Vercel連携の自動ビルドと、本番URL・Google認証の実動作確認は別です。Cloudflareへの新規配備は行いません。
- Firebaseルール・索引・Functionsの本番配備は行っていません。ユーザーによる先の反映に、PR #4の追加ルール差分まで含まれるとは見なしません。

## A2・A7：同一原本 → 分野別練習と印刷冊子

**アプリは分野別のまま維持します。全大問の通し試験画面・答案タイマー・新しい通し試験AppStateは導入しません。**

目標は公開7級（5・4・3・準2・準2プラス・2・準1級）それぞれ15回分の一次筆記全体です。読解・ライティングを含みます。現在は **5級第1回25問のみ** を原本・分野別練習・PDF・ガチャへ接続しています。他104回分は未作成で、105回分完成とは扱いません。1級は従来どおり準備中です。

### 今回の冊子

- 原本：`src/eiken/materials/written-booklets.ts`。短文15・会話5・語句整序5。本文・選択肢・訳・正答・4選択肢の理由を独自作成。
- アプリ：5級 → 語彙・文法練習の分野タブ → 筆記第1回の短文／会話／語句整序。従来の分野別採点・解説・復習を使用。既存IDは変更しません。
- 変換：`writtenPractice.ts`。冊子の問題ID・問題番号・正答・解説をそのまま利用。
- ガチャ：`print_eiken_5_written_01`、`kyotsu` プールの実在UR。1回分の筆記セットであり、15回分や全級の完全版ではありません。既存7冊の語彙ノートも維持。
- 所有後：マイPDFからセット全体、問題冊子、解答用紙、解答・解説をそれぞれ閲覧・保存可能。分冊ごとに印刷できます。
- 公開静的PDFはアクセス制限済みではありません。ガチャ所有UIと厳密な教材アクセス保護は別です。

### 英検形式に合わせた配置

一般的な教材プリントの「問01＋2列選択肢」から修正しました。参照したのは次の公式公開資料の**形式・配置**だけです。公式本文・ロゴ・表紙・画像・装飾は成果物へ転載していません。

- 問題用紙：<https://www.eiken.or.jp/eiken/exam/kakomon/2026-2-1ji_5kyu.pdf>
- 解答用紙見本：<https://www.eiken.or.jp/eiken/schedule/pdf/5q-hon.pdf>
- 級別構成確認元：各級の公式 `/solutions.html`（`writtenExamCore.ts` にURLを保持）。

| 分冊 | ページ | 配置 |
|---|---:|---|
| 問題冊子 | 5 | 独自表紙＋短文7問／8問＋会話5問＋整序5問 |
| 解答用紙 | 1 | A4横、番号1〜15／16〜25の2列、縦長のマーク欄 |
| 解答・解説 | 10 | 正答一覧、各問の訳・解き方・4選択肢の理由 |
| セット全体 | 16 | 上記3分冊、PDFしおり付き |

- 問題番号は `(1)`〜`(25)`。短文の選択肢は横4列、会話は2列×2段。
- 整序は①〜④の語句を一列で提示し、四つの枠の上に「1番目／3番目」を表示。解答選択肢はアラビア数字、語句の組は丸数字で区別。
- 英文はTimes系、日本語は埋込Noto Serif JP明朝体。Noto Serif JPはGoogle FontsのOFL、weight 400の静的インスタンス。`public/fonts/booklet-noto-serif-jp-OFL.txt` にライセンスを同梱。アプリ共通書体・既存クレジットは変更しません。
- A4・白黒・実際のサイズ（100%）。問題・解説は縦、解答用紙は横。分冊で印刷すると向きを指定しやすくなります。
- 原本とPDFの本文・全選択肢・訳・正答・解説・問題番号、設問途中の改ページ、解答漏洩、文字の安全領域を機械検証。各ページのレンダリングも目視確認。
- 実機プリンターによる印刷、専門家による難度校正、試行受験は未実施です。CSE得点・合否換算はしません。
- 読解や英作文を含む上位級のレイアウトは未実装。未確認の形式をそのまま公開しないよう、生成スクリプトは現在5級以外を拒否します。

### 再生成

```sh
cd /home/user/webapp/eiken-app
npm run generate:materials
npm run generate:booklets
```

オフライン生成にPythonのReportLab／PyMuPDF／Pillowが必要です。VercelではPython生成を実行せず、レビュー済みPDF・画像・レジストリをコミットします。

`export-written-booklets.ts` → `deliverables/written-booklets.json` → `build-written-pdfs.py` / `written_print_layout.py` → PDF・プレビュー・`writtenPrints.generated.ts`。語彙ノートの再生成でも、この別レジストリを明示的に統合するので新冊子は消えません。`written-pdf-validation.json` に原本SHA-256・PDF SHA-256・正答・ページ配置を保持します。

`validateGradeSeries()` は異なる完全な15回分を要求します。同じ原本を15個のIDへ付け替えただけの系列を拒否します。内部 `review: approved` は執筆・正答整合性確認を意味し、外部校閲や難度校正済みという意味ではありません。

## 音声：ElevenLabs V4収録用台本

音声の生成はせず、ユーザーが収録するための原稿を作成しました。

- 現行の聞き取り14問、単語420語、例文420文。完成ファイル予定854、発話889セグメント。
- 男1（M1）：会話A、女1（F1）：会話B、女2（F2）：設問・独話・単語・例文。現行教材には4人会話はありません。
- 音源ID・対応問題・予定ファイル名・話者・発話本文を収録。`Question. ...` も含みます。印刷表示の選択肢は読ませません。2回読みは同じ収録音をアプリで繰り返す方針。
- `deliverables/manatobi_eiken_recording_scripts_current.pdf` は完全版101ページ。聞き取り分冊、単語・例文分冊、manifest JSON、セグメントTSVも生成。
- `npm run generate:recording` で現行原本から再生成・889発話の掲載照合。新たな105回分の聞き取り台本を作成したという意味ではありません。
- BGM／効果音／映像は別の非言語資産として保全。TTS台本で置換しません。音声クローン・有料生成は実行しません。
- ファイルパスは予定であり、実在音源の登録済みという意味ではありません。新英検単語IDに対する `vocabAudioUrl()`・例文プレーヤー・録音索引の接続は未実装。音源受領後に実在性を検査して接続します。

## A6：コード準備だけ、表には出さない

`server-staged/enrollment.ts` はデフォルト無効の未接続ドメインコードです。frontendからimportせず、HTTPルート・Firebase Trigger・招待画面・本番設定には接続しません。

- 検証済みGoogle ID、同一塾owner/staff、期限付き在籍、160bit乱数・1回利用の招待、HMAC-SHA256のみ保存、原子的消費・席数更新、同一uid再送の冪等性を準備。
- revoked在籍の復活、失効招待、塾無効、人数上限、期限不正を拒否する純粋コードとテスト。
- 実際のAdmin IDトークン検証・Firestore transactionアダプター、App Check、レート制限、API、退塾運用一式は未実装。実際のアクセス制限を有効化したとは扱いません。
- 教材の厳密な保護には公開JS／JSON／PDF／SWキャッシュの配信設計変更が必要です。画面に疑似ログインゲートを置くことでは代用しません。
- Genspark Hostedアクセス確認で以前 `membership_required: plus_or_higher`。設定変更・回避なし。この未接続Firebase/Vercelドメイン準備とHostedアクセス設定は別です。

## A1：元語彙の級別再編（未完了）

- リスニング参照commit：`ee648b2a961096724afbdc455d7da36a81284f44`。
- 参照原本 `public/data/listeningVocabulary.json` を実読込：5,713語・熟語。旧lv/ilvは英検級ではなく、一括置換しません。
- 同じ見出しでも語義・用法で級が異なるため、語義・文構造・抽象度を独自判定し、訳・例文も独自作成する方針。
- 元データの出典は複数公開リスト合算。全項目の権利・出典確認は未完了。市販単語帳や元の訳・例文・選択肢を丸ごと流用しません。
- 現在の独自420語・各級60語はA1の全件再編完了版ではありません。特定の未確認モデルを使用したとは称しません。

## 既存機能と保全

- 公開7級。既存の読解14本文28問、語彙文法14問、聞き取り14問（計56問・42大問・21単元）を維持。今回の筆記25問を加え、選択問題81問・67大問・24単元。Writing10課題は別枠。
- 単語帳420語、英日／日英840問。実問題リンクは今回の追加後109語。語彙PDFは7冊×5ページ・各30語で、アプリ60語／級とは異なります。
- Writing10課題：入力・語数・保存・再開・自己点検・参考解答・同期。自動採点や合否判定なし。
- 同期キー、同期待ち中のアカウント切替・追加入力、手動同期失敗の成功扱い、同期後の画面更新を修正済み。
- とびらくん・装備・ブランド画像・動画・BGM・効果音・クレジットを保全。保存破損時も基本画像を表示し、記録は上書きしません。
- A3：320×568から級カードがスクロール不要になる2列／3列入口。本文・文字拡大時の必要なスクロールは維持。
- A4：「英検一次」「英検二次A」。目安は2026年度第3回一次2027/1/24・二次A2/28、B3/7。5・4級は二次なし。個人の日程選択は未実装。
- A5：初回・設定の認証入口はGoogleのみ。Apple providerのConsole設定自体は変更していません。iOSネイティブ審査要件は別途確認。
- フレンド対戦開始をホスト・2名・問題番号0・サーバー開始時刻へ制限したPR #4ルールは、Firebase本番での追加反映が別途必要。全国対戦の代行開始は維持。

## 保存・入口・配信パス

- `/`：SPA入口。URLルーターでなくAppStateで画面遷移。`/?screenshot=1` は検証起動で、通常起動と区別。
- `/prints/print_eiken_5_written_01.pdf`：16ページのセット。
- `/prints/print_eiken_5_written_01_questions.pdf`、`_answers.pdf`、`_explanations.pdf`：分冊。
- `/prints/print_eiken_wordbook_<grade>.pdf`、`/data/listeningVocabulary.json?v=eiken-wordbook-20261110b`、既存 `/brand/`・`/mascots/`・`/fonts/`・`/cinematics/`・BGM。
- localStorageは `eiken:v1:` wrapperとuid別キー。クラウドは名前付きApp `manatobi-eiken`、Firestoreルート `eiken_`。`eiken_user_data/{uid}` の許可済み `s_*` JSONを3-way merge。
- Writingは許可済み `s_reading` を利用し、旧形式の値は保護。Firestoreの新フィールドを勝手に追加しません。
- 環境は `VITE_EIKEN_ENABLE_CLOUD` / `VITE_EIKEN_FIREBASE_*`。旧プロジェクト・環境変数はbuild guardで拒否。ローカルpreviewはcloud無効。
- SW世代は `eiken-booklets-20261111a`。英検専用キャッシュのみ管理。
- Vercel：Rootはリポジトリ直下、Install `npm ci --prefix eiken-app`、Build `npm --prefix eiken-app run build:vercel`、Output `eiken-app/dist`、Production Branch main、Node22.18以上。

## 検証と再現

```sh
cd /home/user/webapp/eiken-app
npm test
# 1GB環境ではpreview・ブラウザを止めて型検査／build
node --max-old-space-size=600 --max-semi-space-size=4 node_modules/typescript/bin/tsc --noEmit
GOMAXPROCS=1 GOMEMLIMIT=48MiB GOGC=30 NODE_OPTIONS='--max-old-space-size=620 --max-semi-space-size=4' npm run build:vercel
# PM2でbuild済みSPAをport 3000にpreviewしてから
npm run test:booklets:browser
EIKEN_ENGINE=webkit npm run test:booklets:browser
EIKEN_WIDTH=390 npm run test:release
EIKEN_WIDTH=390 EIKEN_ENGINE=webkit npm run test:release
```

今回の確認：最新main（PR #6・#7）取込後47 Vitest成功、src全体・staged A6単独の型検査成功、production-mode build成功。Chromium／WebKit ×1280／390幅で新25問の採点・解説と、所有済みセット＋3分冊の閲覧・ダウンロード成功。既存7級の読解・語彙・単語帳・両ガチャプール・保存破損fallbackも両エンジン390幅で回帰成功。単体テストの疑似txはテスト専用で、本番の永続化ではありません。

先行PRでは入口2エンジン×4サイズ、音声PCM・BGM保持、Writing10課題保存再開・同期、PDF、聞き取り14経路・AI・PWAを検証済み。今回それら全てを再実施したという意味ではありません。

Auth／Firestore Emulatorは先行PRで8ルールケース・実Authトークン2クライアント同期・別uid拒否・対戦transaction等を確認。本番Google／Functions／実機2台検証とは別です。

## PR作成

英検リポジトリのルートで、コミット済みの作業ブランチから実行します。PR本文には「リスニング納品の判断」欄を必ず含めてください。コマンドは未コミット変更を拒否し、現在のブランチを `origin` へpushして、既存PRがあれば更新、なければ作成します。

```sh
npm run pr:create -- --title "変更のタイトル" --body-file /path/to/pr-body.md
```


## 残件

各級15回分のうち残り104回の独自作問・校閲・級別レイアウト、読解本文と設問の配置・英作文欄の実装、外部難度校正、A1全件再編、録音音源の実接続、本番Google認証・Functions・実端末2台同期、物理iPhone／Androidの共有・印刷、旧PWA更新が未完了です。ラベル替えや既存語彙ノートの繰り返しで完成扱いにしません。
