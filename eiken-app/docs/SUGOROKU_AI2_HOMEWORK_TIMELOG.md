# AI 2 実装報告 — 宿題エンジン & 分野別学習時間計測

対象: `mntobira/mntb-eiken` / `eiken-app/`
ブランチ: `feat/ai2-homework-and-timelog`
担当: AI 2（日次/週次宿題エンジン・生徒トップ宿題表示・分野別時間計測）

---

## 1. 実装したもの

### 1-1. 分野別・級別アクティブ学習時間計測 (`src/sugoroku/timelog/`)

| ファイル | 役割 |
|---|---|
| `timelogCore.ts` | 純粋ロジック（DOM/Firestore 非依存）。`activeSeconds` / `addSeconds` / `pruneDays` / `sumRecentDays` / `formatDuration` / `labelOfBucket` |
| `timelogStore.ts` | localStorage 台帳＋任意の Firestore 同期。`recordTick` / `readLedger` / `summarize` / `skillTotals` |

**既存挙動は1文字も変えていません。** `src/hooks/useStudyTimeTracker.ts` の
15秒刻み・1分無操作除外・音声再生中アクティブ判定はそのままに、
`addStudySeconds()`（既存の合計）と並べて `recordTick()` を呼ぶだけの追加です。

```
tick() {
  seconds = activeStudySeconds(last, now, lastActive)   // 既存の式をそのまま使用
  addStudySeconds(uid, seconds, toDateKey(now))         // 既存：プロフィールカードの合計
  recordTick({ uid, seconds, to: now, chapterId })      // 追加：級×技能の台帳
  syncToday(uid, now)                                   // 追加：ルール反映後だけ送信
}
```

- 第3引数 `chapterId` は `App.tsx` から `selectedChapterId` を渡しています。
- 保存キー: `localStorage['sugoroku_timelog_v1_<uid>']`
- 課金対策: 15秒ごとに Firestore へは書きません。**端末に貯めて、環境変数で有効化したときだけ送ります。**

### 1-2. ペースメーカー型・宿題配信 (`src/sugoroku/homework/`)

| ファイル | 役割 |
|---|---|
| `homeworkCore.ts` | 純粋ロジック。`buildHomeworkTask` / `computeTodayQuota` / `paceMessage` / `buildWeeklyRoute` / `HOMEWORK_PRESETS` |
| `homeworkStore.ts` | Firestore 層。`eiken_sugoroku_homework_plans` に「1日の推奨問数」等を重ねる |
| `chapterTotals.ts` | 軽量章インデックス（`data/chapterIndex.generated`）だけを参照 |
| `SugorokuTodayHomework.tsx` + `homework.css` | ホーム最上部の「今日の宿題」カード |

### 1-3. 生徒ホーム最上部「今日の宿題」ピン留めカード

`Home.tsx` の `<header>` 直後（`GrowthHomeStrip` より上）に挿入しました。

```
{onStartHomeworkChapter && <SugorokuTodayHomework onStartChapter={onStartHomeworkChapter} />}
```

- `onStartHomeworkChapter` が渡されない場合は**カード自体を描画しません** → 一般（非塾）ユーザーのホームは一切変わりません。
- 内部でも `juku_memberships_v1_<uid>` が空なら `return null`。二重のガードです。
- 表示内容: 進捗バー / 解いた数・のこり・今日あと / 目安分数・締切 / 声掛けメッセージ / 「今すぐ解く」
- 「今すぐ解く」→ `App.tsx` の `handleStartHomeworkChapter` → `subjectOfChapterId()` で科目を解決 → 演習へ直行（設定画面の `onStartClassChapter` と同一手順）。

---

## 2. 指示書との意図的な差分（AI 4 / 全体レビュー用）

| 指示書の記述 | 実装 | 理由 |
|---|---|---|
| `classrooms/{classId}/assignments/{assignmentId}` | 既存の `class_assignments/{assignmentId}`（`classId` フィールド）を**そのまま**使用 | 既存 `JukuTab.tsx` / `classAssignments.ts` / 進捗計算が依存。ルールも `hasOnly([...])` で追加フィールド不可。作り直すと既存資産が壊れる |
| `users/{uid}/sugoroku_study_logs/{dateKey}` | `eiken_sugoroku_study_logs/{uid}_{dateKey}` | `eiken_users` はルールで read/write とも `false`。サブコレクションのルールも存在しない |
| ペース設定を assignment に持たせる | `eiken_sugoroku_homework_plans/{assignmentId}` に分離 | 同上（`hasOnly` 制約）。assignment を1バイトも変えない |

**この3点は `src/sugoroku/shared/types.ts` にも明記しています。**

---

## 3. ★AI 4 への依頼（Firestore ルール）★

以下2コレクションのルール追加が必要です。**AI 2 は本番 Firebase へデプロイしていません**（指示書の禁止事項）。

```javascript
// 宿題のペース設定（先生が書く／クラス生徒が読む）
match /eiken_sugoroku_homework_plans/{assignmentId} {
  allow read: if isSignedIn() && (
    isClassTeacher(resource.data.classId) || isClassMember(resource.data.classId)
  );
  allow create, update: if isSignedIn()
    && request.resource.data.teacherUid == request.auth.uid
    && isClassTeacher(request.resource.data.classId);
  allow delete: if isSignedIn()
    && resource.data.teacherUid == request.auth.uid;
}

// 分野別学習時間（生徒本人のみ）
match /eiken_sugoroku_study_logs/{logId} {
  allow read: if isSignedIn() && resource.data.uid == request.auth.uid;
  allow create, update: if isSignedIn()
    && request.resource.data.uid == request.auth.uid
    && logId == request.auth.uid + '_' + request.resource.data.dateKey;
  allow delete: if false;
}
```

> `isClassTeacher` / `isClassMember` / `isSignedIn` は既存ルール内のヘルパーに合わせて読み替えてください。

---

## 4. ロールアウト手順（本番反映）

1. AI 4 がルールを反映（エミュレータテスト → 承認 → デプロイ手順書どおりに本番投入）
2. Vercel の環境変数に `VITE_EIKEN_SUGOROKU_TIMELOG_SYNC=true` を追加して再デプロイ
3. 先生画面（`JukuTab`）で宿題を作成 → 生徒のホームにカードが出ることを確認
4. 生徒端末で演習 → 教室内で1分放置 → 加算が止まることを確認

> 環境変数を入れない限り Firestore へは一切送信しません（`isSyncEnabled()`）。
> また `permission-denied` を受けたらその起動では送信を停止します（ログ埋め尽くし防止）。

---

## 5. デモ手順（11/23・11/27）

1. 先生アカウントでログイン → 設定 → 先生ダッシュボード → 塾タブ
2. 「英検2級 3か月（12週間）標準ルート」を選択、1日の推奨問数を入力、締切を設定 → 作成
3. 生徒アカウントでログイン → **ホーム最上部に「今日の宿題」カード**
4. 「今すぐ解く」→ 該当章の演習へ直行
5. 数問解いてホームに戻る → 進捗バーと「今日あと◯問」が減る

---

## 6. 検証状況

| 項目 | 結果 |
|---|---|
| `npm --prefix eiken-app run typecheck` | ✅ エラー 0 |
| `npm --prefix eiken-app test` | ⏳ 単体テスト未追加（下記 §7） |
| `npm --prefix eiken-app run build` | ⏳ 未実行 |

## 7. 残タスク（引き継ぎ）

- [ ] `tests/homeworkCore.test.ts` / `tests/timelogCore.test.ts`（純粋関数なので追加は容易）
- [ ] `JukuTab.tsx` へのプリセット選択 UI・推奨問数入力・`deleteHomeworkPlan`
- [ ] `npm --prefix eiken-app run build` 実行
- [ ] PR 作成（本文に「リスニング納品の判断：変更なし」を記載）

---

## 8. 触っていないもの（保護資産）

- `class_assignments` / `classAssignments.ts` / `classAssignmentsCore.ts` — **無変更**
- `utils/studyTime.ts` / `study_time_v1_` の保存形式 — **無変更**
- `StudyRecord.tsx` — **無変更**
- `useJukuAdFree` / `adSuppress` / `nicknamePrivacy.ts` — **無変更**
- `deliverables/listening_retake_minimal/**`（199点）— **無変更**
- 一次筆記105回 / リスニング120回 / 共通ソース579ファイル — **無変更**
- `vercel.json` / デプロイ設定 — **無変更（Cloudflare へは出していません）**

**リスニング納品の判断：変更なし**
