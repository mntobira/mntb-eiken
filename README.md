# マナトビ 英検版

## 対象と反映状態（2026-11-10）

公開対象は `eiken-app/` のReact 19 / TypeScript / Vite SPAです。既存Vercel構成を維持し、ルートのHonoテンプレートは公開対象にしません。

- リポジトリ：<https://github.com/mntobira/mntb-eiken>
- 先行品質修正：<https://github.com/mntobira/mntb-eiken/pull/4> をmainへマージ済み。
- PR #4：コミット `39dbd4e` / `801c7af`、マージ `0bb9fefdf213041fb3cfbcbc06c5f7352863dfa1`。3つのVercelチェックとPreview Commentsが成功してからマージ。
- 認証は `mntobira`、対象リポジトリADMIN権限へ復旧。書込権限待ちは解消。
- 追加作業ブランチ：`fix/eiken-grade-entry-google`。A3〜A5と関連案内を修正。新規依頼A1〜A7の全完了を意味しません。
- PRマージで既存Vercel連携の自動ビルドは発生します。本番URL・本番Google認証の成功は別途確認が必要です。
- Firebaseルール・索引・Functionsの本番配備は行っていません。ユーザーが先に反映したルールに、PR #4の追加差分が含まれるとは見なしません。
- 大学受験版・リスニング本体のリポジトリ／Firebaseへ書込・配備していません。

## 今回の追加依頼 A1〜A7

### A3：級の入口を一画面へ

- 学習カタログはスマホ2列、広い画面3列。7級と英作文、単語帳への入口をコンパクト化。
- 別の級選択コンポーネントも2列／4列のグリッドへ変更。
- 学習カタログは320×568、375×667、390×844、1280×900のChromium／WebKitで、7級すべてが44px以上の操作領域を持ち、ナビの背後に隠れず、一覧をスクロールしないことを検証。
- 教材本文・文字拡大・キーボード表示時まで無理に一画面へ押し込まず、必要なスクロールは残します。

### A4：英検カウントダウン

- 表示を「英検一次」「英検二次A」に変更。二次の日程区分が分かるようにしています。
- 現在は2026年度第3回・本会場一次2027/1/24、二次A日程2027/2/28の目安。B日程は2027/3/7です。準会場・S-CBTとは異なり、5級・4級に二次試験はありません。
- 公式確認元：<https://www.eiken.or.jp/eiken/schedule/2026-examinee.html>
- 個人の受験日選択や自動日程更新は未実装です。

### A5：Googleのみの認証入口

- 初回ログイン・設定画面のAppleボタンとimportを削除。クランのログイン案内もGoogleに統一。
- Firebase ConsoleのApple provider自体の有効／無効は変更していません。UIを消すことと、サーバーでproviderを拒否することは別です。
- 既存のAppleログイン実装ファイルは参照元の保全のため残っていますが、公開の認証入口からは呼びません。
- iOSネイティブ版をストアへ出す場合は、その時点でAppleの審査要件を別途確認します。

### A1：元語彙の級別再編（未完了）

- 指定のリスニング参照commit：`ee648b2a961096724afbdc455d7da36a81284f44`。
- 実読込した原本：参照repositoryの `public/data/listeningVocabulary.json`。5,713語・熟語、重複見出し語なし。
- 旧 `lv1` 1,185 / `lv2` 962 / `lv3` 653 / `lv4` 1,028 / `ilv1` 1,524 / `ilv2` 301 / `ilv3` 60。これらは英検級ではありません。
- `will` の名詞「遺書」と助動詞のように同一綴りでも必要級が異なり、`well-being` と基本語が同じ旧レベルに同居しています。旧区分の一括置換はしません。
- 元データの出典は「複数の公開語彙リストを合算」とあり、項目ごとの権利確認は未完了。元の訳・例文・問題選択肢・配列を丸ごと転用しません。
- 見出し語を候補として語義・用法・抽象度・文構造から独自判定し、独自の訳・例文を再作成する方針。5,713項目の再判定が済んだとは宣言しません。
- 現在アプリに入っているのは従来の独自420語、各級60語です。A1完了版と混同しません。

### A2・A7：15回分教材と冊子・景品（範囲確認待ち）

ユーザーへ、「全ての大問15回分」が語彙・文法分野15セットなのか、読解・ライティングまで含む一次筆記全体15回分なのか確認中です。勝手に少量の穴埋め問題へ縮小しません。

- 形式・設問数・文長・語彙難度を公式で調査し、その後、本文・状況・設問・選択肢・解説を独自作成します。
- 過去問や市販教材の本文・選択肢の改変量産はしません。「同程度の難度」の実測保証には専門校閲・試行も必要です。
- 準2級プラス公式確認元：<https://www.eiken.or.jp/eiken/exam/grade_p2plus/>。
- アプリ教材を唯一の原本とし、冊子の問題番号・正答・解説を同じデータから生成する計画。冊子は公式発行物と誤認させない独自デザインにします。
- 新たな15回分冊子PDFと大当たり枠はまだ作成・登録していません。既存の7冊の語彙ノートを新冊子と称しません。

### A6：塾限定利用の提案（未実装）

推奨は **Google認証＋個別・期限付き招待コード＋サーバー管理の在籍資格** です。共通の短い合言葉だけで永久解放する方式は避けます。

1. 運営が塾を登録し、担当者だけが招待を発行。生徒ごとの高エントロピー・原則一回限りのコードを使い、有効期限・利用人数・対象塾をサーバー側に保持。
2. 生徒がGoogleログイン後にコードを入力。サーバーでIDトークンを検証し、Firestore transactionでコード消費とuidへの在籍付与を一体処理。コードはHMAC等で保存し、生値や秘密鍵をfrontendへ含めません。
3. 在籍は `tenantId / uid / role / status / expiresAt`。生徒は自分の所属・期限・権限を書換不可。複数塾の相互読取を拒否。
4. 脱退・退塾・契約終了時は在籍を失効。IDトークンの古いcustom claimだけに頼らず、APIとFirestoreルールで現在の在籍・期限を確認。
5. コード試行はApp Check、uid／IP等のレート制限、一般化したエラー、監査記録で保護。管理者にはより強い認証を用意。
6. **教材保護には静的配信の変更が必要**です。今のJS bundle、公開JSON、`/prints/`、SWキャッシュはURLを知れば取得でき、ログイン画面だけでは制限できません。限定教材を保護API／短時間URLで配信し、private cache方針とオフライン許可範囲を決めます。正規利用者による保存・スクリーンショットの完全防止は保証しません。
7. 一般公開版と塾版を分けるか、アプリ全体を塾限定にするか、端末数・オフライン・退塾後保存を認めるかを先に決定します。既存ゲスト記録は勝手に削除しません。

Genspark Hostedアクセス機能は確認時に `membership_required: plus_or_higher` でした。設定は変更しておらず、JavaScriptの疑似ゲートで代用しません。上のFirebase／Vercel案は別構成の設計提案であり、既存アプリにアクセス制限を実装済みという意味ではありません。

## 先行修正で実装済みの内容

- ホームのとびらくんはgrowth破損でも基本画像を表示し、保存記録は保護。装備404・WebKit静止時の描画も対策。
- ガチャの実在する目玉1件・ピックアップ5件・詳細・実抽選に一致する割合。プールID `kyotsu` / `niji` は保存互換のため維持。
- 独自語彙PDF7冊×5ページ＝35ページ。各冊30語・例文・和訳・確認テスト・解答。アプリの60語／級とは異なります。
- 獲得PDFの閲覧・保存・戻る。modalの操作遮断を修正し、保存前に `%PDF-` を確認。
- 公開7級、読解14本文28問、語彙文法14問、聞き取り14問。計56問、42大問、21単元。1級は準備中。
- 独自単語帳420語、英日／日英840問、95語の問題リンク。誤答復習と覚えた印の連携。
- ライティング10課題：入力・語数・端末保存・再開・自己点検・参考解答。自動採点や合否判定なし。
- 同期キー不一致、同期後の画面更新、アカウント切替、手動同期失敗の成功表示、通信中入力の送信漏れを修正。
- BGM OFF／音量保持、実音声再生、学習・英作文・英検聞き取り中の停止。既存素材・クレジットは保全。

## Firebase追加ルール：本番再反映が必要

PR #4の `eiken-app/firestore.rules`、`battleStatusStep()` で、フレンド部屋の開始を部屋主・2名・問題番号0・サーバ開始時刻に限定。旧ルールでゲストが開始できることをEmulatorで再現して修正しました。全国対戦の代行開始は維持しています。

**この差分はGitマージだけではFirebaseへ反映されません。** 英検専用プロジェクトでのレビュー・再反映が必要です。相互フレンド条件や本人限定保存を緩めていません。

## テスト・再現方法

```sh
cd /home/user/webapp/eiken-app
npm test
npm run typecheck
# 1GB環境ではpreviewとブラウザを止めてからbuild
GOMAXPROCS=1 GOMEMLIMIT=64MiB GOGC=50 NODE_OPTIONS='--max-old-space-size=560 --max-semi-space-size=4' npm run build:vercel
# PM2でbuild済みSPAをポート3000にpreviewしてから
node tests/entry.browser.mjs
EIKEN_ENGINE=webkit node tests/entry.browser.mjs
npm run test:release
EIKEN_ENGINE=webkit npm run test:release
npm run test:audio
npm run test:browser
npm run test:integration:browser
EIKEN_ENGINE=webkit npm run test:integration:browser
```

- 最新追加UI：32 Vitest件・型検査0エラー・production-mode build成功。入口テストは2エンジン×4画面で成功。Chromiumの教材28経路、音声、聞き取り14経路・AI・PWA、英作文・PDFも回帰成功。
- 先行PR：上記のChromium／WebKit PC・スマホの教材・英作文・PDF・音声回帰済み。
- Auth／Firestore Emulator：8ルールケースと実Authトークンによる同一uid2クライアント同期、別ユーザー／未認証拒否、対戦transaction・入室・開始・解答・不正更新拒否。
- `tests/sync-controller.test.ts` は通信モックで遅延・失敗・切替を検査。実端末2台の同期全体の検証と混同しません。
- WebKitの連続10回reloadは985MB sandboxでOOMしたため、英作文は全課題保存後1回reloadで10記録と再開を確認。Chromiumは各課題reload。

```sh
cd /home/user/webapp
JAVA_TOOL_OPTIONS=-Xmx320m npm exec --yes --package=firebase-tools@14.27.0 -- \
 firebase emulators:exec --config firebase.json --project demo-manatobi-eiken --only auth,firestore \
 'npm --prefix eiken-app run test:rules && npm --prefix eiken-app run test:sdk'
```

## 保存・教材生成・配信パス

- SPA入口 `/`。URLルーターでなく画面状態で遷移。`/?screenshot=1` は検証起動で、通常起動と別検証。
- `/data/listeningVocabulary.json?v=eiken-wordbook-20261110b`、`/prints/print_eiken_wordbook_<grade>.pdf`、既存 `/brand/`・`/mascots/`・`/fonts/`・`/cinematics/`・BGM、`/manifest.json`・`/sw.js`。
- localStorageは `eiken:v1:` wrapper。新語彙v2、下書き `eiken_writing_v1_<uid>`、成長envelope等をuid別に保存。
- クラウドは名前付きApp `manatobi-eiken`、`eiken_user_data/{uid}` の許可済み `s_*` JSON。下書きは `s_reading`、異形式値は保護。3-way merge・pending baseを使用。
- `VITE_EIKEN_ENABLE_CLOUD` / `VITE_EIKEN_FIREBASE_*`。旧版ID・旧環境変数はbuild guardで拒否。ローカルpreviewはcloud無効。
- 原本：`src/eiken/materials/original-*.ts`、`translations.ts`、`wordbook.tsv`。`npm run generate:materials` でJSON・件数・索引を生成。
- `scripts/build-eiken-rewards.py` はPDF・thumb・previewをオフライン生成。ReportLab／PyMuPDF／Pillow／既存Klee Oneを使用。Vercelでは生成しません。
- 共通ソース579ファイルの同一性を維持。英検固有修正は `tests/listening-baseline.json` に理由を記録。
- Vercel既存設定：Rootリポジトリ直下、Install `npm ci --prefix eiken-app`、Build `npm --prefix eiken-app run build:vercel`、Output `eiken-app/dist`、Production Branch main、Node22.18以上。別のRoot設定と混在させません。

## 公開前に残る確認

A1の全語義再編、A2の範囲確定・独自作問・専門校閲、A7の新冊子／大当たり、A6の運用方針承認とサーバー実装は未完了です。ほかに本番Google Auth・許可ドメイン・実端末2台同期・Functions・フレンド承認・本番対戦、iPhone／Android音声・共有／印刷・旧PWA更新を確認します。

現教材は重点練習であり、全範囲の模試や網羅単語集とは扱いません。PRマージ・ビルド・機械テストだけで公開品質の完成とは判断しません。
