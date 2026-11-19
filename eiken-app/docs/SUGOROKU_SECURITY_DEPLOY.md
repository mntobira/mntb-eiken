# すごろく塾 認証・セキュリティルール 本番反映手順書（AI 4）

本書は、『マナトビ英検（`mntobira/mntb-eiken`）』のオンライン塾「すごろく」向け拡張において、**Google アカウント限定ゲート・招待コード認可・Firestore / Firebase Storage セキュリティルール・塾生広告完全非表示（Ad-Free）** を本番環境へ安全に反映するための運用手順書です。

> **重要制約（厳守）**
> - 本リポジトリのコード変更・PR マージだけでは、本番 Firebase プロジェクトの `firestore.rules` / `storage.rules` は自動更新されません。
> - 大学受験版・リスニング本体プロジェクト（`mntb-listening` / `mntb-4ef06` 等）には絶対にデプロイしないでください。必ず英検専用プロジェクト（`manatobi-eiken` または `manatobi-eiken-*`）であることを確認してから反映してください。

---

## 1. 今回のセキュリティ実装概要

### 1.1 フロントエンド認可・広告非表示モジュール（`eiken-app/src/sugoroku/auth/`）
| ファイル | 役割 |
|---|---|
| `sugorokuAuthCore.ts` | ポータルモード判定（`?portal=sugoroku` / `?portal=admin` / `VITE_SUGOROKU_PORTAL`）、Google 本人確認・`owner` / `staff` / `teacherUid` 認可判定、Ad-Free 判定、実名（`rosterName`）と公開ニックネームのプライバシー分離、招待コード正規化、iPad/iOS Safari 判定の純粋ロジック |
| `sugorokuAuthService.ts` | Google ポップアップログイン＋iPad Safari 等でのポップアップブロック時リダイレクト切替、招待コード参加承認（`class_members` ＋ `study_access` ＋ `sugoroku_members`）、`useJukuAdFree` / `adFree` との完全連動 |
| `useSugorokuAuth.ts` | `useSugorokuPortalMode` / `useSugorokuAuthState` / `useSugorokuAdminGuard` フック |
| `SugorokuAuthGate.tsx` | 塾生用ログイン＆初回招待コード・保護者/本人同意ゲート画面（`?portal=sugoroku` または `VITE_SUGOROKU_PORTAL=sugoroku` 時に自動強制、通常一般モードでは素通し） |
| `SugorokuAdminGuard.tsx` | 講師・管理者ポータル（`SugorokuAdminApp`）専用の認可ガードコンポーネント |

### 1.2 Firestore セキュリティルール（`eiken-app/firestore.rules`）
すべてのコレクションは英検専用の `eiken_` 名前空間で保護されています。

1. **`eiken_sugoroku_members/{uid}`**
   - 生徒本人は、実在する塾クラス（`plan == 'juku'`）に在籍している場合のみ、`role: 'student'`, `active: true`, `adFree: true` として自身のレコードを作成・更新可能。
   - 生徒による `owner` / `staff` への自己権限昇格、および講師用名簿名（`rosterName`）の改ざんはルールレベルで完全拒否。
   - 新規 `staff` ロールの付与・変更は `active == true` な `owner`（または Firebase コンソール）のみ可能。
2. **`eiken_users/{uid}/sugoroku_study_logs/{dateKey}` ＆ `eiken_study_summaries/{uid}`**
   - 生徒本人のみ自分の有効学習時間ログ・分野別集計を作成・更新・閲覧可能（1日 86,400 秒上限・日付形式検証つき）。
   - 閲覧は本人、`eiken_study_access/{studentUid}_{teacherUid}` の同意を持つ担当講師、担当クラスの active `staff`、または塾 `owner` のみ許可。講師からの学習時間改ざん（書き込み）は不可。
3. **`eiken_classrooms/{classId}/assignments/{assignmentId}`（および `eiken_class_assignments` 拡張互換）**
   - 日次/週次ペースメーカー宿題フィールド（`targetStudentUids`, `startAt`, `dailyQuotaProblems`, `skillBreakdown`）を検証。
   - `plan == 'juku'` クラスの担当講師（`teacherUid`）または担当 `staff` / `owner` のみ作成・更新・削除可能。
   - 在籍生徒は全体宿題または `targetStudentUids` に自身の `uid` が含まれる宿題のみ閲覧可能。
4. **`eiken_classrooms/{classId}/writing_submissions/{submissionId}`**
   - 在籍生徒本人のみ `status: 'submitted'`（`review` なし）で提出・未添削時の再提出・閲覧が可能。
   - 担当講師 / 担当 `staff` / `owner` のみクラス内の提出一覧取得および `review`（スコア・コメント・添削文・`status: 'reviewed'`）の書き込みが可能（生徒本文の改ざんは不可）。
5. **`eiken_classrooms/{classId}/speaking_submissions/{submissionId}`**
   - S-CBT 方式スピーキング録音提出メタデータを保護。`recordings` 配列内の各 `storagePath` が必ず自身の `classId` / `uid` / `submissionId` 配下の許可パート名（`reading_aloud` / `q1`〜`q4`）かつ音声 MIME であることを検証。

### 1.3 Firebase Storage セキュリティルール（`eiken-app/storage.rules`）
- パス：`sugoroku_speaking/{classId}/{uid}/{submissionId}/{partId}.{webm|m4a|mp4}`（および `eiken_sugoroku_speaking/...`）
- **書き込み制限**：在籍塾クラス（`plan == 'juku'`）の生徒本人のみアップロード可。**1ファイル上限 5MB 以下**、MIME タイプは `audio/webm` / `audio/mp4` / `audio/x-m4a` / `audio/m4a` / `audio/aac` / `audio/mpeg` / `video/mp4`（iPad Safari の MediaRecorder 出力互換）のみ許可。
- **読み取り制限**：生徒本人および担当クラス講師（`teacherUid` / `owner` / 担当 `staff`）のみ再生（`get`）可。一覧列挙（`list`）および他生徒・他クラス講師・未認証アクセスは完全拒否。

---

## 2. デプロイ前のローカルエミュレータ検証手順

本番反映前に、必ずローカルエミュレータで全 14 スイートのルール単体テスト（本人・担当講師・他クラス講師・他生徒・未認証・5MB上限・MIME制限）が通過することを確認してください。

```bash
# リポジトリルートで実行（本番プロジェクトには一切接続しません）
npx firebase-tools emulators:exec \
  --only firestore,storage \
  --project demo-manatobi-eiken \
  "npm --prefix eiken-app run test:rules"
```

あわせて型検査・ビルドが通ることを確認します。

```bash
npm --prefix eiken-app run typecheck
npm --prefix eiken-app run build
```

---

## 3. 本番 Firebase への反映手順（運営者作業）

### Step 1: 対象 Firebase プロジェクトの確認
接続先が **必ず英検専用プロジェクト（`manatobi-eiken` 系）** であることを確認します。

```bash
npx firebase-tools login
npx firebase-tools projects:list
```

> ⚠️ `mntb-listening` や `mntb-4ef06`（大学受験版・リスニング本体）は絶対に指定しないでください。

### Step 2: Authentication（Google ログイン＆許可ドメイン）の設定確認
1. Firebase Console > **Authentication** > **Sign-in method** を開く。
2. **Google** プロバイダを「有効」にし、サポートメールを設定する。
3. **Authentication** > **Settings** > **承認済みドメイン（Authorized domains）** に、Vercel の配信ドメイン（生徒用URL・管理者用URL）を登録する。
4. 学校 iPad（Safari）で同一オリジンリダイレクト方式も併用する場合は、`VITE_EIKEN_AUTH_SAME_ORIGIN=true` の設定手順（`/__/auth/*` リライト）を確認する。

### Step 3: Firestore ルール ＆ Storage ルールの本番デプロイ
リポジトリルートの `firebase.json` は `eiken-app/firestore.rules` と `eiken-app/storage.rules` を参照するよう構成されています。

```bash
# <EIKEN_PROJECT_ID> には manatobi-eiken 等の英検専用プロジェクトIDを指定
npx firebase-tools deploy \
  --only firestore:rules,storage \
  --project <EIKEN_PROJECT_ID>
```

### Step 4: すごろく塾オーナー・講師ロールと塾クラス（`plan: 'juku'`）の初期設定
一般教員が勝手に有料塾プランを有効化できないよう、`plan: 'juku'` および最初の `owner` ロールは運営者が Firebase Console（Firestore Database）から設定します。

1. **すごろく代表・統括講師の `owner` / `staff` 登録**
   - コレクション：`eiken_sugoroku_members`
   - ドキュメントID：対象講師の Firebase Auth `uid`（Google ログイン後に確認）
   - フィールド例：
     ```json
     {
       "uid": "<講師のUID>",
       "role": "owner",
       "active": true,
       "adFree": true
     }
     ```
     ※ 特定クラスのみ担当する講師の場合は `"role": "staff"`, `"classIds": ["<対象classId>"]` を設定します（`owner` が登録済みの場合はアプリ側から `staff` を追加することも可能です）。

2. **すごろく用クラスの `plan: 'juku'` 化**
   - 講師アカウントでクラスを作成すると `eiken_classrooms/{classId}` が作成され、6文字の招待コード（`joinCode`）が発行されます。
   - Firebase Console で該当 `eiken_classrooms/{classId}` ドキュメントを開き、フィールド `plan` を `"juku"` に設定します。
   - これにより、招待コードで参加した生徒全員に対して **広告完全非表示（Ad-Free）・宿題配信・ライティング提出・S-CBTスピーキング録音提出** が自動的に有効化されます。

### Step 5: Vercel 環境変数（ポータル出し分け）の設定（任意）
同一リポジトリ（`mntobira/mntb-eiken`）のまま、URL クエリまたは環境変数でモードを切り替えられます。
- **塾生向け専用URLとして配信する場合**：`?portal=sugoroku` を案内するか、Vercel 環境変数に `VITE_SUGOROKU_PORTAL=sugoroku` を設定（未ログイン・招待コード未承認のアクセスをゲート画面でブロック）。
- **講師管理ポータル専用URLとして配信する場合**：`?portal=admin` を案内するか、別 Vercel プロジェクトで `VITE_SUGOROKU_PORTAL=admin` を設定。
