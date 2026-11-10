# マナトビ 英検版

## 対象・配備状態（2026-11-10）

公開対象は **`eiken-app/` のReact 19 / TypeScript / Vite SPA**。ルートのHonoテンプレートは対象外で、既存Vercel構成を維持しています。

- リポジトリ：<https://github.com/mntobira/mntb-eiken>
- 作業ブランチ：`fix/eiken-release-completeness`
- ベース：PR #3のマージ `4f48e62161ac87f25d56b6f96079f0fda6d37e9d`。PR #3だけで公開品質が完成したとは扱いません。
- 最新コードはローカル検証段階。本番配備・mainへのマージは行っていません。
- GitHubの再接続は成功しましたが、現在の認証ユーザー `2525Azarashi` の対象リポジトリ権限は **READ**（`gh repo view --json viewerPermission`）。push／修正PR作成は書込権限の再接続待ちです。別リポジトリ・forkへ勝手に送信しません。
- ユーザーからFirebaseルール本番反映済みとの報告を受領。ただし**本作業で見つかった対戦開始の追加修正はローカルのみ**です。後述のルール差分のレビュー・再反映が必要です。
- 本番URL／Vercelの新コミットpreviewは未確認。アシスタントからFirebaseルール・索引・Functions・Vercel本番を配備していません。

## 実装済みの機能・修正

### ホーム・ガチャ・報酬

- growth保存が破損していても表示専用初期値でとびらくんを表示。破損した記録は上書きしません。装備画像が404なら基本画像へ戻します。
- WebKit静止時の裏面描画対策。ブランド・キャラクター・既存演出は保全。
- 実在アイテムから目玉1件・重複しないピックアップ5件を表示。空レア度を除いた実抽選の正規化割合と一致させます。
- 既存プール保存ID `kyotsu` / `niji` を維持し、表示・景品を英検用に変更。
- 英検5級〜準1級の重点語・例文PDF **7冊×5ページ＝35ページ**。各冊は基礎30語・例文・和訳・確認テスト・解答。アプリ単語帳全60語／級とは収録数が異なります。
- マイPDF→詳細→中身を開く→保存／戻るを接続。PDFを開く際は元のmodal dialogを閉じ、操作を遮らないよう修正。
- 保存前に `%PDF-` ヘッダーを確認し、SPAのHTML fallbackをPDFとして保存しません。

### 級別教材・単語帳

- 公開7級：5級、4級、3級、準2級、準2級プラス、2級、準1級。1級は準備中。
- リーディング **14本文・28設問**、語彙文法 **14設問**、聞き取り **14設問**。共通の問題・解説・採点・復習へ接続。計56設問・42大問・21単元。
- 級内の聞き取り／読解／語彙文法タブ。読解に音声開始画面は出さず、全文和訳・根拠を表示。
- 単語帳は独自編成の **各級60語・計420語**、独自例文・和訳つき。英日／日英 **840問**。95語を実在する英検問題へリンク。
- 級別選択、検索、意味隠し、覚えた印、単語／例文の端末読み上げ、誤答だけの復習。
- 4択結果と単語帳の覚えた印を連携。同期イベント・storageイベントで、開いている画面の記録も再読込。
- 新教材の記録／設定は `eiken_vocab_quiz_v2_<uid>` / `eiken_vocab_quiz_prefs_v2_<uid>`。同期対象も同じキーに修正。旧記録は消しません。

### ライティング

- 共通学習カタログから3級〜準1級、5級別の**独自10課題**へ遷移。
- 課題文、返信／意見／要約、練習語数、英文入力、語数、即時端末保存・再開、4項目の自己点検、参考解答・解説。
- 自動採点・合否判定はありません。5級・4級の筆記ライティング課題は設けていません。
- 保存キー：`eiken_writing_v1_<uid>`。課題ごとにマージし、同時編集は別コピー最大2件を保存。下書きは4000文字上限。
- クラウドは既存ルールで許可済みの `s_reading` を使用。旧読解形式や壊れたクラウド値は形式検証で保護し、黙って上書きしません。
- 端末保存とクラウド送信完了を表示で区別。設定有効・ログイン時には手動同期ボタン。
- CSSリセットでチェックボックスが0pxになる問題を修正し、標準チェックと44px以上のラベル操作領域を確保。

### 音・起動・同期

- 通常起動でBGMを強制ONにする処理を削除し、保存したOFF／音量を尊重。
- 単語学習・英作文・英検聞き取り対戦中はBGMを停止。ホーム・対戦待機では設定に従って再生。
- 英検のフレンド対戦でも短時間モードで聞き取り時間を短縮しない。待機画面の説明も一致。
- 通常起動に残っていたTOEIC商標案内、共通テストの教材説明／日数を英検用へ訂正。使い方案内も実際の級別機能へ変更。既存音源クレジットは保全。
- 手動同期は未認証・キャッシュだけの読込・書込拒否・アカウント切替を成功扱いにしません。
- 同期通信中の追加入力を「送信済み」と誤認しないよう、送信対象のfingerprintを通信前に保持。
- 保存・Firestore・PWAは英検専用名前空間。大学受験版・リスニング版への書込や配備は行いません。

## Firebaseルールの追加差分（要レビュー・本番未反映）

`eiken-app/firestore.rules` の `battleStatusStep()`：フレンド部屋の `waiting → playing` に、部屋主・参加者2名・問題番号0・サーバ開始時刻を要求します。

Auth／Firestore EmulatorのSDKテストで、旧ルールでは入室済みゲストが開始できることを再現してから修正しました。全国対戦の代行開始仕様は維持します。入室の相互フレンド要件や本人限定同期を緩めていません。

**先に本番反映済みのルールにこの変更が含まれるとは見なしません。本ファイルのレビュー後、英検専用Firebaseへのルール再反映が必要です。** エージェントから本番配備はしていません。

## 検証結果

- TypeScript：全src、0エラー。
- Vitest：**32件**成功。教材／実資産／割合／隔離18件、下書き・マージ・ゲスト移行・PDF等10件、同期通信中入力／手動エラー／切替4件（通信をモック）。
- Firebase Emulator：既存ルール8件成功。加えて実Auth Emulatorトークン＋Firestore SDKで、同一ユーザー2クライアントの保存往復、サインアウト、別ユーザー拒否を確認。実アプリのマージ関数を使用しますが、ブラウザの `syncUserData()` 全体を2台実機で実行したものではありません。
- SDK対戦：部屋・合言葉のtransaction作成、相互フレンド入室、部屋主のみ開始、双方の解答、解答差替え／相手欄書換え／第三者の読込・更新拒否。フレンド関係だけテスト管理者で事前投入。Functionsのフレンド承認処理自体の検証ではありません。
- Chromium PC1280／スマホ390：7級×読解／語彙文法の28経路、全級60語、4択→誤答復習→覚えた印、ガチャ両プール、とびらくん表示と破損時保護。
- WebKit：PC／スマホの同じ教材・ガチャ・単語帳経路。スマホ解説の自動選択effectとテスト操作の競合を避け、描画commit後に正誤チップを操作。
- Chromium／WebKit PC／スマホ：通常起動からBGM OFF保持、英作文10課題の入力・自己点検・参考解答、保存・再開、同期イベントで開いた下書きを更新、所有PDF fixtureから閲覧・PDFバイトの保存・画面ボタンと履歴で戻る。
- WebKitは1GB sandboxで連続10回の再起動時にOSがWebProcessをOOM killしたため、全課題保存後に1回再読込して全10下書きと最終課題の再開を確認。Chromiumは各課題ごとに再読込。
- 音声：実デコードPCM、BGM OFF／再開／音量、単語学習中停止、待機曲、英検聞き取り中停止。
- 既存聞き取り14経路、reload、AI対戦完走、PWAキャッシュ、保存・外部通信隔離も成功。
- ブラウザ自動テストは物理iPhone／Android、ネイティブ共有シート、Google本番認証の確認と同一ではありません。

## 開発・再検証

```sh
cd /home/user/webapp/eiken-app
npm run generate:materials
npm test
npm run typecheck
# 1GB環境ではpreviewとブラウザを停止してから実行
GOMAXPROCS=1 GOMEMLIMIT=64MiB GOGC=50 NODE_OPTIONS='--max-old-space-size=560 --max-semi-space-size=4' npm run build:vercel
# build済みSPAをPM2でポート3000にpreviewしてから
npm run test:integration:browser
EIKEN_ENGINE=webkit npm run test:integration:browser
npm run test:release
EIKEN_ENGINE=webkit EIKEN_WIDTH=1280 npm run test:release
EIKEN_ENGINE=webkit EIKEN_WIDTH=390 npm run test:release
npm run test:audio
npm run test:browser
```

ルール／Auth SDKテストはdemoプロジェクトのEmulatorだけを使用し、未設定時は停止します。本番接続しません。

```sh
cd /home/user/webapp
JAVA_TOOL_OPTIONS=-Xmx320m npm exec --yes --package=firebase-tools@14.27.0 -- \
  firebase emulators:exec --config firebase.json --project demo-manatobi-eiken --only auth,firestore \
  'npm --prefix eiken-app run test:rules && npm --prefix eiken-app run test:sdk'
```

## 利用ガイド・配信パス

1. ホーム→演習→級→聞き取り／読解／語彙文法→問題→解説・復習。
2. 学習→英単語帳→級を選択。例文・意味・4択・間違えた語の復習を利用。
3. 学習→英検ライティング→級・課題→英文→自己点検。入力は端末のアカウント別に保存。
4. ガチャ景品・ショップ・きせかえは既存の成長機能。獲得PDFはマイページ→マイPDF。
5. BGMはホームの音ボタン、音量は設定。

- `/`：SPA入口。画面・選択級はアプリ状態で保存（URLルーターではありません）。
- `/?screenshot=1`：画面テスト用起動。通常起動テストとは分けています。
- `/data/listeningVocabulary.json?v=eiken-wordbook-20261110b`：420語の級別JSON。
- `/prints/print_eiken_wordbook_<grade>.pdf`：基礎30語ノート（`5,4,3,pre2,pre2plus,2,pre1`）。
- `/tanjou.mp3`、`/bgm/battle/`、`/sfx/`、`/cinematics/`、`/fonts/`、`/brand/`、`/mascots/`：既存素材。
- `/manifest.json`、`/sw.js`：英検PWA。SW世代 `eiken-integration-20261110b`。

## データ・再生成・構成

- 端末キーはすべて `eiken:v1:` wrapper。uid別の成長envelope、単語帳／4択、下書き、問題記録、復習、設定。
- 同期は名前付きFirebase App `manatobi-eiken`、`eiken_user_data/{uid}` の許可済み `s_*` JSON文字列。本人限定。3-wayマージ・pending baseで再送を扱います。
- `VITE_EIKEN_ENABLE_CLOUD` / `VITE_EIKEN_FIREBASE_*` を使用。大学受験版のIDや旧環境変数をbuild guardで拒否。
- ローカルpreviewはクラウド無効。本番Auth・許可ドメイン・Functionsは別途実環境確認が必要。
- 原本：`src/eiken/materials/original-*.ts`、`translations.ts`、`wordbook.tsv`。
- `npm run generate:materials`：単語JSON・件数・章索引を生成。既存単語IDを保全。
- `python3 scripts/build-eiken-rewards.py`：基礎30語PDF7冊とthumb／previewをオフライン生成。ReportLab・PyMuPDF・Pillow・既存Klee Oneを使用。Vercelでは生成しません。
- `tests/listening-baseline.json`：参照リスニングcommitと同一ファイルの記録。英検固有修正は理由つき例外へ記録。
- Vercel：Rootはリポジトリ直下、Install `npm ci --prefix eiken-app`、Build `npm --prefix eiken-app run build:vercel`、Output `eiken-app/dist`、Production Branch `main`、Node22.18以上。Rootを`eiken-app`にする設定と混在させません。

## 公開前に残る確認

- GitHub対象リポジトリへの書込権限を持つ認証への再接続、push・修正PR・レビュー。本番配備はまだです。
- 上記の追加Firestoreルール差分をレビューし、英検専用本番へ再反映。
- 本番Google／Apple Auth、許可ドメイン、実アカウント2台の同期・切替・ゲスト移行、Functions・フレンド承認・オンラインマッチング全体。
- iPhone／Android実機の端末TTS・消音設定・バックグラウンド復帰・PDF共有／印刷・旧PWA更新。
- 全出題形式や本試験1回分を網羅する模試ではありません。420語も網羅語彙集とは扱いません。1級教材・録音音源・外部専門家の校閲と級別難度確認は未完了。

ビルド成功や機械テストだけで公開品質が完成したとは判断せず、確認前にmainへマージしません。
