# すごろく塾 管理者ポータル — Firebase 接続・全部門（AI 1〜AI 5）統合運用ガイド

対象リポジトリ：`mntobira/mntb-eiken`（アプリ本体：`eiken-app/`）  
管理者ポータル URL：`https://<デプロイドメイン>/?portal=admin`

---

## 1. Firebase 接続状態の確認結果と環境変数

リポジトリと各ブランチ（PR #47〜#52）の設定を照合した結果、Firebase 連携基盤は以下の通り整備されています。

| 設定箇所 | 現在の状態 | 備考 |
| :--- | :--- | :--- |
| `firebase.json` | 設定済 | `eiken-app/firestore.rules` / `eiken-app/firestore.indexes.json` / `eiken-app/storage.rules` を参照 |
| `vercel.json` | 設定済 | `npm --prefix eiken-app run build:vercel`（`--mode eiken.production`）で `eiken-app/dist` を出力 |
| `eiken-app/src/firebase.ts` | 設定済 | `VITE_EIKEN_ENABLE_CLOUD=true` かつ `VITE_EIKEN_FIREBASE_PROJECT_ID` が `manatobi-eiken`（または `manatobi-eiken-*`）のとき本番接続を有効化 |
| 事前承認オーナーメール | 共通化済 | **`mntobira@gmail.com`** および **`hirokingz0927@gmail.com`**（AI 1〜AI 4 共通 `SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS`） |

### Vercel Environment Variables（本番環境で確認すべき7項目）
Vercel ダッシュボードの **Settings ＞ Environment Variables** に以下が入っている状態であれば、そのままクラウド接続（`FIREBASE_CONFIGURED === true`）で動作します。

```env
VITE_EIKEN_ENABLE_CLOUD=true
VITE_EIKEN_FIREBASE_API_KEY=AIza...
VITE_EIKEN_FIREBASE_AUTH_DOMAIN=manatobi-eiken.firebaseapp.com
VITE_EIKEN_FIREBASE_PROJECT_ID=manatobi-eiken
VITE_EIKEN_FIREBASE_STORAGE_BUCKET=manatobi-eiken.firebasestorage.app
VITE_EIKEN_FIREBASE_MESSAGING_SENDER_ID=...
VITE_EIKEN_FIREBASE_APP_ID=1:...
```

---

## 2. コンソール手作業ゼロでの初回クラス開設（代表講師）

AI 1（管理者ポータル）と AI 4（認証・セキュリティルール）の連携により、Firebase コンソールを直接触らなくてもポータル画面だけで `plan: 'juku'` のすごろく塾クラスを開設できます。

1. `https://<ドメイン>/?portal=admin` を開き、右上の切替ピルで **「本番」** を選ぶ。
2. **`mntobira@gmail.com`** または **`hirokingz0927@gmail.com`** で Google ログインする。
   - 初回ログインと同時にルート `eiken_sugoroku_members/{uid}` に `role: 'owner', active: true, adFree: true` が自動登録される。
3. クラス未作成の場合は中央の **「最初の塾クラスを作成」** カード（2クラス目以降は上部チップの **「＋ クラス追加」**）から塾名・クラス名・標準対象級を入力して **「クラスを作成」** を押す。
   - 自動で `plan: 'juku'` が付与され、**6文字の参加コード**（例：`SGRK27`）が発行される。

---

## 3. 塾生の招待（自動入力リンク対応）と実名管理

1. **生徒招待リンクの共有**
   - ヘッダー右上の **リンクアイコン（生徒招待URLコピー）** を押すと、`https://<ドメイン>/?sugoroku_invite=<6文字コード>` がコピーされる。
   - LINE 等で生徒へ送ると、6文字コードが最初から自動入力された状態で参加画面が開く（コード単体のコピーも可能）。
   - 参加した塾生は自動的に **広告完全非表示（`adFree: true`）** になり、講師への学習データ共有同意（`eiken_study_access`）が記録される。
2. **実名（名簿名）と目標級の設定**
   - 生徒行をタップ ＞ **「編集」** から本名（例：`高橋 陽斗（高2）`）と個別目標級（2級／準2級プラス／準2級など）を保存する。
   - 実名（`rosterName`）は管理者ポータル内でのみ表示され、一般のランキング等には一切公開されない。

---

## 4. 複数講師（副担任・チューター `staff`）の追加・解除手順

代表講師（`owner`）がポータル上から複数名の講師を追加・管理できます（AI 4 の `eiken_sugoroku_members` セキュリティルールと直結）。

### パターンA：追加したい先生が一度 Google ログインして UID を共有する場合（即時開通・推奨）
1. 追加したい講師に `https://<ドメイン>/?portal=admin` を開いて「本番」から Google ログインしてもらう。
2. 画面に表示される **「自分の講師UIDをコピー」** ボタンを押して、代表講師へ UID を送る。
3. 代表講師がヘッダーの **「講師」** ボタンを開き、**講師名・Googleメール・講師UID** を入力して **「講師を追加」** を押す。
4. 即座に `eiken_sugoroku_members/{staffUid}`（`role: 'staff'`, `classIds: [classId]`）へ登録され、その瞬間から担当クラスの閲覧・添削が可能になる。

### パターンB：すでにアプリ利用履歴がある先生をメールアドレスで追加する場合
1. 代表講師が **「講師」** シートで **講師名・Googleメール** を入力して **「講師を追加」** を押す。
2. `eiken_sugoroku_members` 内に該当メールの登録があれば自動で UID を解決して即時開通（`参加中`）する。未ログインの場合は招待台帳に控えとして記録される。

### 権限の解除（退職・担当変更時）
- 代表講師が **「講師」** シート内のゴミ箱ボタンを押すと、該当クラスIDが `classIds` から除外（0件時は `active: false`）され、即座にアクセスが遮断される。

---

## 5. 全5部門（PR #47〜#52）の連携マップと推奨マージ手順

| 担当 | PR / ブランチ | 主な役割と AI 1 ポータルとの接続点 |
| :--- | :--- | :--- |
| **AI 1** | **PR #47** `feat/ai1-sugoroku-admin-portal` | 管理者ポータル（`?portal=admin`）、生徒一覧・停滞アラート、14日推移、CSV出力、複数講師管理、共通型 `shared/types.ts` 完全統合版 |
| **AI 5** | **PR #48** `feat/ai5-vocab-audit-and-curriculum` | すごろく専用白黒印刷PDF 5冊（`/sugoroku/*.pdf` 計83p）＆12週ルート → ポータル「教材PDF ＞ 塾専用冊子」から直接プレビュー・保存 |
| **AI 2** | **PR #49** `feat/ai2-homework-and-timelog` | 宿題ペースメーカー（3系統保存）＆1分無操作除外タイマー → ポータルが全系統の宿題・日次学習秒数を自動統合して消化率・扉グラフを算出 |
| **AI 4** | **PR #50** `feat/ai4-auth-and-security-rules` | `eiken_firestore.rules` / `storage.rules`、`mntobira` + `hirokingz0927` 自動オーナー化、`?sugoroku_invite=` 参加導線、広告ゼロ保証 |
| **AI 3** | **PR #52** `feat/ai3-writing-and-scbt-speaking` | ライティング提出・添削＆S-CBTスピーキング録音 → ポータル「英作文」「スピーキング」タブおよび `/?portal=review` と双方向連携 |

### 本番反映時の推奨マージ＆デプロイ順序
1. **PR #48（AI 5）** をマージ（共有ファイル変更なし・競合ゼロ）。
2. **PR #50（AI 4）** をマージし、ローカルまたは CI からセキュリティルールのみ先に反映する：
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage --project manatobi-eiken
   ```
3. **PR #47（AI 1：本ブランチ）** をマージ（`shared/types.ts` が AI 1〜AI 4 全型の完全上位互換になっているため、後続PRの型エラーを防ぐ）。
4. **PR #49（AI 2）** および **PR #52（AI 3）** をマージ（`App.tsx` / `appState.ts` の state switch 分岐を両方残す形で統合）。
5. `main` へのマージ完了後、Vercel が自動的に本番ビルドをデプロイする。
