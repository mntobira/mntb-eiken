# AI 2 実装完了報告 — 日次/週次「宿題（ペースメーカー）」配信・ホーム最上部表示・分野別学習時間計測

対象リポジトリ: `mntobira/mntb-eiken`（`eiken-app/`）  
作業ブランチ: `feat/ai2-homework-and-timelog`  
担当: AI 2

---

## 1. 実装・品質強化した全機能

### 1-1. 分野別・級別アクティブ学習時間計測 (`src/sugoroku/timelog/`)
- **`timelogCore.ts`（純粋ロジック層）**
  - 既存の `useStudyTimeTracker.ts` / `studyTime.ts`（15秒間隔・1分無操作除外・リスニング音声再生中アクティブ判定）と完全一致する切り詰め計算（`activeSeconds`）を維持。
  - 単元ID（`chapterId`）だけでなく、`writing`（英作文）・`foundation`（語彙・基礎固め）・`mock`（模試）の画面コンテキスト（`resolveStudyBucket`）からも `eiken_2:listening` / `eiken_2:reading` / `eiken_2:vocab` / `eiken_2:writing` へ正確に振り分け。
  - 1 tick 最大90秒・1日最大12時間上限・同一終端時刻の二重加算防止・オフライン未送信日管理（`dirtyDateKeys`）・`study_summaries/{uid}` 集計構築（`buildStudySummaryDoc`）を完備。
- **`timelogStore.ts`（ローカル主台帳 ＋ Firestore 双方向・オフライン復帰再送層）**
  - 第2章B共通契約および AI 1 管理者ポータル（`firestoreAdminService.ts`）が参照する `users/{uid}/sugoroku_study_logs/{dateKey}`（実体: `eiken_users/{uid}/sugoroku_study_logs/{dateKey}`）および `study_summaries/{uid}` へ最短60秒スロットル（画面離脱時は即時フラッシュ）で同期。
  - オフライン時は `dirtyDateKeys` に保持し、`online` イベント復帰時に自動再送。
  - ルール未反映時に `permission-denied` を受け取った場合はセッション内リトライを自動停止し、コンソールエラーや無駄な通信を防止。

### 1-2. ペースメーカー型・宿題配信UI & 12週間標準ルート (`src/sugoroku/homework/` + `JukuTab.tsx`)
- **`SugorokuHomeworkComposer.tsx` & `JukuTab.tsx` 統合**
  - 『英検2級 / 準2級プラス / 準2級 3か月（12週間）標準ルート』プリセットを搭載。Week 1〜Week 12 をワンタップで選ぶだけで、語彙（大問1）・長文読解・リスニング第1部/第2部の単元セット（最大10単元以内）と推奨1日問数が自動入力される。
  - 「日数から自動日割り」と「1日○問を指定（3/5/8/10/15問＋任意数値）」の切り替え、分野別（語彙・読解・リスニング）問題数内訳のリアルタイム表示、クラス全員配信 ⇄ 個別生徒指定配信に対応。
  - 既存の `class_assignments`（`hasOnly` 制約）を1バイトも壊さず、`classrooms/{classId}/assignments/{id}`・`sugoroku_homework_plans/{id}`・ローカルキャッシュの3層フォールバックで確実に保存・削除連動。

### 1-3. 生徒ホーム最上部「今日の宿題」ピン留めカード (`SugorokuTodayHomework.tsx` + `homework.css`)
- **マナトビ純正デザインシステム統合**
  - `KineticText`（見出し立ち上がり）、`ScoreRing`（達成率円弧ストローク描画）、`CountUp`（完了問数・達成率ロールアップ）、`.mt-progress`（光沢シャイン進捗バー）、スプリングトースト通知を統合。
  - 1日で推奨ノルマの2倍以上（かつ12問以上）を一気に解いた場合は「1日まとめ解き抑制（明日以降への分散定着）」の声掛けへ自動切替。
  - 「今日の宿題を今すぐ解く」ボタン1タップで未完了の先頭単元の演習画面へ直行。
  - 今日・今週の分野別有効学習時間ミニストリップも併設し、生徒からの勉強時間スクリーンショット提出を完全に不要化。
  - **一般ユーザーの保護**: 塾クラス未参加ユーザーおよびゲスト時は DOM 出力ゼロ・追加通信ゼロ。

---

## 2. 共通契約（`src/sugoroku/shared/types.ts`）の統一
- AI 1（PR #47）の `SUGOROKU_COLLECTIONS`・`SugorokuMemberDoc`・`SugorokuStudyLogDoc`・`SugorokuStudySummaryDoc`・`SugorokuAssignmentDoc`・`SugorokuWritingSubmissionDoc`・`SugorokuSpeakingSubmissionDoc`・`SugorokuAdminExtensionSlots` をすべて保持した完全上位互換スキーマに統一済み。

---

## 3. 検証結果

| 検証項目 | 結果 |
|---|---|
| `npm --prefix eiken-app run typecheck` | ✅ エラー 0 |
| `npx vitest run tests/sugoroku-homework-timelog.test.ts` | ✅ 9 tests 全件 PASS |
| `npx vitest run tests/listening-exam.test.ts tests/written-exam.test.ts tests/integration.test.ts` | ✅ 24 tests 全件 PASS |
| `npm --prefix eiken-app run build`（<750MB 省メモリ3段階シーケンシャルビルド） | ✅ 正常完走 |

---

## 4. リスニング納品の判断
- **変更なし**：`deliverables/listening_retake_minimal/**`（199件）、一次筆記105回、リスニング120回、`tests/listening-baseline.json` 保護対象の全ファイル、`firestore.rules`、`EikenWriting.tsx`、`StudyRecord.tsx`、`vercel.json` には一切変更を加えていません。
