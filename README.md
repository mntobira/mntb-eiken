# マナトビ 英検版

## 現在の公開対象（React/Vite版）

大学入試版のアップロードされたUIを元にした英検専用アプリは `eiken-app/` です。大学版の本番・Firebase・Storageには接続／配備していません。元ZIPと `.reference/university/` は変更せず保存しています。GitHubは `https://github.com/mntobira/mntb-eiken` のみ使用します。

### Vercelの404対策

リポジトリ直下の `vercel.json` が **Cloudflare WorkerではなくReact SPA** をビルド・配信します。コード本体は独立した `eiken-app/` に保持し、公開エントリ設定をリポジトリ直下へ移しています。

VercelプロジェクトはGitHubのステータスで `mntb-eiken0` と確認しました。大学版プロジェクトを選ばないでください。

| 設定 | 値 |
| --- | --- |
| Root Directory | 空欄（リポジトリ直下） |
| Framework Preset | Other |
| Install Command | `npm ci --prefix eiken-app` |
| Build Command | `npm --prefix eiken-app run build:vercel` |
| Output Directory | `eiken-app/dist` |
| Production Branch | `main` |
| Node.js | 22.18以上（Vercelの22.x/24.x） |

Dashboardに旧Build/Output設定のOverrideがあれば上記へ合わせ、最新コミットをRedeployしてください。代替としてRoot Directoryを `eiken-app` にする場合は、同フォルダの `vercel.json` が使われ、出力は `dist` です。**2通りの設定を混在させないでください。** SPA再読込はindex.htmlへ戻し、不明なasset URLは404を返します。ルートHono用の `npm run build` はVercelでは使用しません。

### Firebase接続・環境分離

GitHub上の追加コミットから英検専用プロジェクト `manatobi-eiken` を確認しました。接続情報はソース直書きではなく新しい環境変数を使用します。実値をREADMEや新しいコミットへ書きません。大学版の `VITE_FIREBASE_*` があるとビルドを停止します。

VercelのDevelopment / Preview / Productionを**個別に確認**し、接続する環境だけ次を設定してください。設定後はRedeployが必要です。

```dotenv
VITE_EIKEN_ENABLE_CLOUD=true
VITE_EIKEN_FIREBASE_API_KEY=FirebaseのWebアプリ設定の値
VITE_EIKEN_FIREBASE_AUTH_DOMAIN=manatobi-eiken.firebaseapp.com
VITE_EIKEN_FIREBASE_PROJECT_ID=manatobi-eiken
VITE_EIKEN_FIREBASE_STORAGE_BUCKET=manatobi-eiken.firebasestorage.app
VITE_EIKEN_FIREBASE_MESSAGING_SENDER_ID=FirebaseのWebアプリ設定の値
VITE_EIKEN_FIREBASE_APP_ID=FirebaseのWebアプリ設定の値
VITE_EIKEN_USE_EMULATORS=false
```

未設定時は端末内学習として配信できます。クラウド有効時に設定が不足・不一致ならビルドを停止します。Preview/Developmentは通常 `VITE_EIKEN_ENABLE_CLOUD=false`、Productionだけtrueを推奨します。必要なら別の `manatobi-eiken-*` 検証プロジェクトを使用してください。本番をPreviewのテストデータ保存先にしないでください。

- ローカル開発は `eiken-app/.env.eiken.local`。Vercel向けローカルビルドは `.env.eiken.production` / `.env.eiken.production.local` を読みます。いずれもGit対象外です。
- 任意の `EIKEN_EXPECTED_VERCEL_PROJECT_ID` を指定するとVercelのシステム変数 `VERCEL_PROJECT_ID` と照合します。ローカル `.vercel` リンクがある場合は照合を必須にします。
- Firebase AuthenticationでGoogleを有効にし、**実際の英検版公開ホスト名**をAuthorized domainsへ追加してください。大学版の認証設定は変更しません。
- GitHubへの接続／Web SDK設定追加だけでは、Firestore/Storageルールは自動公開されません。このリポジトリにはルール自動配備Workflowはありません。
- 現在の接続ではGitHub Actions secrets一覧が403のため、管理用認証やVercel環境変数の実設定は確認できません。本番Auth・同期の成功も未確認です。

### Firebase rules（英検専用プロジェクトにだけ適用）

正本は `eiken-app/firestore.rules` と `eiken-app/storage.rules`。直下の `firebase.json` で参照します。Firestore Emulatorの `demo-manatobi-eiken` で、本人の作成・取得・更新、他人／未認証の拒否、uid偽装・追加フィールド・集計不一致・タイムスタンプ偽装の拒否、大学版コレクション・削除・一覧取得の拒否を検証しています。

```sh
# Firebase CLIで英検プロジェクトへの管理権限を取得済みの環境で実行
firebase deploy --config firebase.json --project manatobi-eiken --only firestore:rules,storage
```

**この作業では本番ルールは配備していません。** Firebase Consoleで貼り付ける場合もプロジェクトIDが `manatobi-eiken` であることを確認してください。既存の大学版ルールを置き換えてはいけません。

- `eiken_study_progress/{uid}`：ログイン本人のみget/create/update。uid・型・件数・更新時刻を検査し、許可フィールド以外を拒否。
- その他のFirestore文書：すべて拒否。現行画面は同期にこの1コレクションだけ使用します。ランキング・対戦・プロフィール同期を許可していません。
- Storage：すべて拒否。現在は静的アセットとブラウザ読み上げを使用し、Storage録音音源の公開機能は未実装です。
- `solved` 内の各値／復習項目内の全フィールドまではルールで検証していません。本人記録の保護用であり、公式成績・課金・ランキングの信頼できるサーバースコアには使用できません。

### React版の機能・データ・使い方

- `/`：元UIのホーム、級選択、問題セット、音声プレイヤー、解答、解説、復習・記録、設定（画面切替はSPA内）。Honoの旧APIはVercelでは提供しません。
- 8級のID登録。5級〜準1級は各2問、計14問の独自リスニング教材。1級は準備中。本試験1回分の模試ではありません。
- 級を選ぶ → 第N回演習 → 問題をはじめる → 再生 → 選択 → 解答と解説 → 結果。誤答は復習リストへ登録します。
- `src/eiken/questions.ts` に必須schemaと既存UI用adapter。`examType='eiken'`。大学版教材を級だけ変えて使いません。過去問の流用・言い換えは禁止です。
- ブラウザStorageは `eiken:v1:` 名前空間。大学版の既存キーの読み込み・上書き・削除は行いません。
- ログイン中の解答済み記録・復習リストを英検Firebaseへ同期。ゲスト記録のアカウント移行、連続日数・ゲーム資産の端末間同期は未実装です。
- 元sourceの未使用機能は残っていますが、大学入試・TOEICの問題バンクをruntime bundleへ含めるとビルドを失敗させます。
- 3級のアップロードPDFの内容監査・問題登録、録音音源、全出題形式、1級教材、ゲーム機能の移植は未完了です。画像・音声の有料生成は実行していません。

### 検証コマンド

```sh
npm ci --prefix eiken-app
npm --prefix eiken-app run typecheck
npm --prefix eiken-app test
npm --prefix eiken-app run build:vercel
# Firestore Emulator起動済み（project demo-manatobi-eiken）
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm --prefix eiken-app run test:rules
```

本番公開URLは新しいVercelデプロイ後の確認が必要です。下記は保持している旧Hono英検版の記録で、React版の搭載機能と混同しないでください。

---

# 旧Hono版：マナトビ 英検の練習問題

5級・4級・3級・準2級・準2級プラス・2級・準1級向けの学習アプリ。Hono / TypeScript / Vite、Cloudflare Pages互換です。ユーザー指定の既存の白黒マナトビロゴを使用しています。

**過去問の転載・言い換え・人物名や数字だけの置換は禁止です。** 現行の本文・会話・設問・選択肢・解説は各ユニット用に執筆しています。日本英語検定協会・神戸大学の公式教材ではありません。

## 収録内容

各級1ユニット、選択問題8問（語彙・文法2問、読解2本文×2問、聞き取り2問）。3級以上には記述2課題があります。合計56問・224件の選択肢別理由・記述10課題。読解14本文・音声原稿14本に和訳を付けています。

| 級 | テーマ | 記述 |
| --- | --- | --- |
| 5級 | 小さな工作室の一日 | なし |
| 4級 | 町の小さな活動に参加する | なし |
| 3級 | 町の情報を、伝わる形に変える | メール・意見 |
| 準2級 | 使いやすい仕組みを考える | メール・意見 |
| 準2級プラス | 便利さと参加のしやすさを両立する | 要約・意見 |
| 2級 | 数字の向こうにある利用者の行動 | 要約・意見 |
| 準1級 | 測定・証拠・説明責任 | 要約・意見 |

**本試験1回分の模試ではありません。** 問題数・時間・目安語数は重点演習独自の設定で、全出題形式や最新公式仕様の完全再現ではありません。CSEスコアや合否は推定しません。外部専門家の校閲・受験者による難度測定は未実施です。

## 今回の改修と完成した機能

- 教材一覧・級別案内・演習画面を再構成。装飾的な英語ラベルや架空の学習履歴は表示しません。
- 1問ずつ解く演習画面。読解本文は2問で共有し、毎問繰り返しません。
- 問題一覧からの移動、解答済み表示、「あとで見直す」の印、採点前の解答一覧。
- 採点後はラジオ入力を無効化。根拠・全選択肢の理由・原稿・和訳を確認できます。
- 間違い・未解答だけの再演習。正解を再び隠し、該当問題だけの得点を計算します。
- 開始・一時停止・再開に対応した目安タイマー。時間切れでも強制提出しません。
- 本文の文字サイズ調整。スマホでは本文欄を独立スクロールでき、本文切替時は先頭へ戻ります。
- ブラウザ読み上げの速度・1回/2回再生・停止。問題移動・設定変更・タブ非表示でも停止します。
- 記述の語数カウント、答案コピー、自己点検、折りたたみ式の解答例。
- 印刷時は全問を表示し、共通本文を対応設問の直前に配置。解答用紙・解説・原稿も印刷できます。

## 使い方

1. ホームで級を選び、「問題を解く」を開きます。
2. 本文と設問を見て解答。迷う問題には見直しの印を付けます。タイマーは必要な場合だけ開始します。
3. 最終問題の「解答を見直す」から未解答・印付き問題を確認し、採点します。
4. 結果の問題番号から解説や和訳を確認。「間違えた問題だけ解き直す」で再挑戦します。
5. 記述は書いた後、自己点検と解答例で振り返ります。必要なら答案をコピーしてください。

**解答・作文は保存も送信もされません。ページを閉じる・再読み込みすると失われます。** 記述の自動採点はありません。読み上げ音質・発音・利用可能な英語音声は端末に依存します。

## ページとAPI

| URI | 内容 |
| --- | --- |
| `/` | 教材一覧・学び方・教材の説明 |
| `/grades/:grade` | 級別の教材案内 |
| `/exam/:id` | 全8問＋対象級の記述 |
| `/exam/:id?part=reading` | 語彙・読解6問＋対象級の記述 |
| `/exam/:id?part=reading#sec-R2` | 上記6問を読解から開始 |
| `/exam/:id?part=listening` | 聞き取り2問 |
| `/exam/:id?show=answers` | 1問ずつ解説を読むモード |
| `/exam/:id#writing-section` | 記述欄への移動 |
| `/answers/:id` | 全問の解答・解説 |
| `/script/:id` | 英文原稿・和訳・質問・根拠 |
| `/sheet/:id` | 空欄の解答用紙 |
| `/api/sets` | 現行7ユニットの一覧 |
| `/api/sets/:id` | 設問・解答・記述・制作方針JSON |
| `/new?grade=4` 等 | 該当級の固定ユニットへ転送。自動生成ではありません |

`:grade` は `5`, `4`, `3`, `pre-2`, `pre-2-plus`, `2`, `pre-1`。`:id` は `original-${grade}-01`。

旧ID `2026-2`, `2026-1`, `2025-3`, `gen-*` は問題・解答・原稿・用紙・APIでHTTP 410。その他の未知のIDは404。旧 `reading.ts` / `listening.ts` / `generate.ts` は削除済みです。履歴を改変していないため過去のGitコミットには廃止済みデータが残りますが、現在の配信データには含みません。

## データ構成・保存

- `src/data/original-*.ts`: 教材。各設問の4選択肢・正解・根拠・4つの理由、記述課題・モデル答案。
- `src/data/translations.ts`: 読解・音声原稿の和訳。
- `src/data/sets.ts`: 静的教材を固定IDの演習用配列に変換。
- `src/views/`: Hono JSXの教材一覧・級別案内・演習・印刷用文書。
- `public/static/app.js`: 移動・見直し・採点・再演習・音声・タイマー・記述操作。
- `public/static/style.css`: レスポンシブ表示、フォーカス、印刷スタイル。

DB・外部評価API・永続ストレージは未使用。解答は現在のページのDOM、見直しフラグはページ内のSetのみです。APIとHTMLに正解を含む学習アプリで、不正対策が必要な試験システムではありません。

## 画像・音声生成スクリプト

**有料生成は実行していません。** ローカル/CI専用でWorkers内では動かしません。`assets/media-manifest.json` には装飾用表紙7点と聞き取り14問の入力があります。生成後のWeb配信への自動接続はありません。

```sh
# 課金・生成なし。既定1件のdry-run
npm run media:images
npm run media:audio
# 起動中APIからマニフェストを再作成（生成課金なし）
npm run media:manifest
```

実生成には `--execute --confirm-cost` の両方が必要。`--only ID`, `--limit N`, `--manifest PATH`, `--output-dir DIR` に対応します。

- 画像: 認証済みローカル `gsk` CLI、`nano-banana-2-flash-lite`、4:3、1K。
- 音声: ElevenLabs REST API、`eleven_multilingual_v2`。環境変数 `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` が必要。`.env` 自動読込なし。キーのブラウザ配信・コミットは禁止です。
- 出力 `.media-output/` はGit管理・自動公開対象外。既存出力はスキップ。`--force` は再課金の可能性があります。失敗の自動リトライなし。
- スクリプトは1問1ファイル・1話者。複数話者・2回放送の合成は未実装。ブラウザ内の2回読み上げとは別機能です。

## 起動と検証

Node.js 22以降。作業ディレクトリは `/home/user/webapp`。

```sh
npm ci
npm run typecheck
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000
npm test
npm run test:content
npm run test:media
```

- `npm test`: 全7級、共通本文、キーボード操作、見直し印、採点前確認、解答固定、誤答・未解答の再演習、和訳、タイマー、記述、390px表示、印刷、旧URL20入口の停止。読み上げは無課金のモックで速度・回数・完了・待機処理の停止・失敗復帰を確認します。実音声の発音品質の保証ではありません。
- `npm run test:content`: 56問の構造、224件の理由、根拠、本文・会話重複、和訳欠落、モデル答案の語数を検証し `assets/content-quality-report.json` を更新。
- 旧素材比較は `assets/legacy-fingerprints.json` の125個の8語列ハッシュのみ。一致0件ですが、全出版物との比較・言い換え検出・盗用不存在の証明ではありません。
- `npm run test:media`: サーバー・APIキー不要の安全性テスト。課金・メディア生成なし。
- サーバーの検証先は `TEST_BASE_URL` で変更できます。

## 公開・保存状況

- 本番デプロイ: 未実施。Cloudflare Pages用ビルドとサンドボックスプレビューのみ。
- 一時プレビュー: https://3000-irc138wi1zx9tg0vaoi05-0e616f0a.sandbox.novita.ai
- GitHub: https://github.com/mntobira/mntb-eiken （main）。以前のpushがHTTP 403で拒否されたため、後続の変更はローカル保存のみ。書き込み権限解消後に同期が必要です。

## 未実装と次の優先事項

1. 英語教育専門家による設問・訳文・級別語彙の校閲と、学習者による難度検証。
2. 別テーマの独立執筆ユニット拡充。本試験1回分の模試は別データで設計し、形式だけ公式資料で確認。
3. 人手で発音確認した複数話者の音声を公開接続。
4. GitHub書き込み権限の回復。本番公開先は別途確認。
5. 学習履歴・ログイン・クラウドへの答案保存。必要になった場合はD1等と保存同意を別途設計。

最終更新: 2026-11-08
