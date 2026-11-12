# マナトビ英検 一次筆記（リーディング＋ライティング）独自教材 制作仕様書

> **対象読者**: 本リポジトリで英検予想問題・演習教材を制作・改訂するすべての AI エージェント（Claude / GPT / Manus / Gemini 等）および教材執筆者  
> **位置づけ**: 塾の授業・宿題・演習でそのまま使用できる高品質なオリジナル一次筆記教材を、**アプリ内演習（分野別練習・ライティング練習）と印刷用PDF冊子（問題・解答用紙・解答解説）で完全同一原本から生成**するための公式技術仕様書です。

---

## 0. 絶対原則と禁止事項（AI作問時の最重要ガードレール）

1. **著作権・独自性の厳守（過去問流用の絶対禁止）**
   - 日本英語検定協会の公式過去問・公式サンプル・市販問題集の英文・設問・選択肢・固有名詞置換（数値や人名だけ変えた翻案）・公式ロゴ・表紙デザインは一切使用しないこと。
   - すべての問題に `origin: 'manatobi-original'` を付与し、完全オリジナルの場面・文章・設問を書き下ろすこと。
2. **アプリ内は「分野別練習＋ライティング練習」を維持（通し試験タイマー画面は作らない）**
   - 本番形式の通し演習は **PDF印刷冊子** が担い、Webアプリ側は同じ原本（`WRITTEN_BOOKLETS`）から自動変換された分野別チャプター（`bookletPracticeChapters`）およびライティング課題（`bookletWritingTasks`）で学習・復習・クラウド保存を行う。
3. **AI作問で頻発する「NG形式・手抜きパターン」の禁止（`validateWrittenExam` で機械拒否）**
   - ❌ **英語メタ指示の混入禁止**: 短文や会話の `prompt` に `Choose the best answer to complete the sentence:` や `Read the passage and choose...` を入れてはならない。空所は必ず半角スペース5つの `(     )` で表記する（語句整序は `( ____ / ____ / ____ / ____ )`）。
   - ❌ **筆記大問2（会話）の形式混同禁止**: 筆記の会話問題は「会話中の `(     )` に入る発話を選ぶ空所補充」であり、リスニングPart2のような `Question: What will ...?` 形式にしてはならない。また話者表記は `M1:` / `F1:` ではなく **`A:` / `B:`** を用いる。
   - ❌ **下位級レベルの混入禁止**: たとえば英検3級（中3修了程度）の大問1に `Mina (     ) a student.` (`is/am/are`) のような5級最易問題を並べてはならない。必ず `src/eiken/writtenAuthoringSpec.ts` の `GRADE_AUTHORING_SPECS` に定めた該当級の必須文法・語彙水準で出題する。
   - ❌ **テンプレ誤答解説の禁止**: `distractorReasons` に「この文の時制・形・意味に合いません」「本文の情報と一致しない（または本文にない）内容です」「本文にありません」といった汎用コピペ文を書いてはならない。塾教材として、**なぜその選択肢が不適切なのか（品詞・語法・時制・本文のどの記述と矛盾するか）を1肢ずつ個別具体的に日本語で解説**すること。
   - ❌ **ラベル替え水増し禁止**: 同じ問題を別ラウンドに流用してはならない（`validateReleasedBooklets` が全級・全ラウンド横断で重複シグネチャを検出してビルドを停止する）。

---

## 1. 公開7級の出題構成ブループリント（`WRITTEN_BLUEPRINTS`）

| 級 (`EikenGrade`) | 目安時間 | 大問構成（`section` と設問数） | 選択計 | ライティング計 | 解答用紙PDF構成 |
| --- | ---: | --- | ---: | ---: | --- |
| `eiken_5`（5級） | 25分 | `short` 15 + `conversation` 5 + `reorder` 5 | 25問 | なし | 1ページ（A4横マーク） |
| `eiken_4`（4級） | 35分 | `short` 15 + `conversation` 5 + `reorder` 5 + `reading` 10 (掲示2+メール3+長文5) | 35問 | なし | 1ページ（A4横マーク） |
| `eiken_3`（3級） | 65分 | `short` 15 + `conversation` 5 + `reading` 10 (掲示2+メール3+長文5) + `email` 1 + `essay` 1 | 30問 | 2題 | 2ページ（A4横マーク＋A4縦罫線） |
| `eiken_pre2`（準2級） | 80分 | `short` 15 + `conversation` 5 + `cloze` 2 + `reading` 7 (メール3+長文4) + `email` 1 + `essay` 1 | 29問 | 2題 | 2ページ（A4横マーク＋A4縦罫線） |
| `eiken_pre2plus`（準2級プラス） | 85分 | `short` 17 + `cloze` 6 (3+3) + `reading` 8 (メール3+長文5) + `summary` 1 + `essay` 1 | 31問 | 2題 | 2ページ（A4横マーク＋A4縦罫線） |
| `eiken_2`（2級） | 85分 | `short` 17 + `cloze` 6 (3+3) + `reading` 8 (メール3+長文5) + `summary` 1 + `essay` 1 | 31問 | 2題 | 2ページ（A4横マーク＋A4縦罫線） |
| `eiken_pre1`（準1級） | 90分 | `short` 18 + `cloze` 6 (3+3) + `reading` 7 (長文3+長文4) + `summary` 1 + `essay` 1 | 31問 | 2題 | 2ページ（A4横マーク＋A4縦罫線） |

---

## 2. セクション別の執筆・組版ルール

### 2.1 短文の語句空所補充 (`short`)
- 紙面では **4択横1列（4カラム）** に組版されるため、各選択肢は原則 **1〜3語（最大でも約22文字以内）** に収める。
- 問題文（`prompt`）は1〜2文で文脈が確定するように書き、複数の選択肢が正解になり得る曖昧な文を避ける。
- 正答番号 `answer`（`0`〜`3`）は15〜18問の中で `0, 1, 2, 3` が偏らないよう均等（各3〜5回）に配分する。

### 2.2 会話文の空所補充 (`conversation`)
- 紙面では **2カラム×2段** に組版される。`A: ...\nB: (     )` または3ターン `A: ...\nB: (     )\nA: ...` とする。
- 空所の直前だけでなく、直後の発話や状況設定と論理的に1つだけ噛み合う選択肢を設計する。

### 2.3 日本文付き語句整序 (`reorder`：5級・4級)
- `reorder(japanese, prefix, tokens, order, pairs, answer, explanation)` ヘルパーを使用する。
- 4つの語句チャンク `tokens` が紙面1行に収まるよう、4チャンク合計でおよそ45文字以内にする。
- `order` は `[2, 4, 1, 3]` のような1始まりの完成順序で、選択肢 `pairs` は `'2－1'`（全角ハイフン `－`）のように **1番目と3番目** の番号ペア4つを指定する。

### 2.4 長文の語句空所補充 (`cloze`：準2級・準2級プラス・2級・準1級)
- 本文中の空所は必ず通し設問番号と一致する **`(21)` `(22)`**（半角丸括弧＋2桁番号）で記述する。
  - 準2級：`(21)`〜`(22)`（1パッセージ×2問）
  - 準2級プラス・2級：パッセージA `(18)`〜`(20)`、パッセージB `(21)`〜`(23)`（2パッセージ×各3問）
  - 準1級：パッセージA `(19)`〜`(21)`、パッセージB `(22)`〜`(24)`（2パッセージ×各3問）
- PDF生成時に自動で太字＋下線 `<u><b>(21)</b></u>` に変換され、本文と選択肢が1ページに美しく収まるよう検証される（1パッセージ＋3問がA4縦1ページに収まる200〜300語前後が最適）。

### 2.5 長文の内容一致選択 (`reading`：4級〜準1級)
- `passage(key, title, text, translation, format, specs, 'reading')` を使用する。
- `format` は `'notice'`（枠＋見出し帯）、`'email'`（`From:` / `To:` / `Subject:` ヘッダー帯＋枠）、`'article'`（イタリック見出し＋下線）のいずれかを必ず指定する。
- パッセージ語数の目安（`GRADE_AUTHORING_SPECS` 準拠）：
  - **4級**: Notice 70–110語（2問）、Email 120–170語（3問）、Article 190–250語（5問）
  - **3級**: Notice 85–135語（2問）、Email 135–190語（3問）、Article 210–290語（5問）
  - **準2級**: Email 175–240語（3問）、Article 270–350語（4問）
  - **準2級プラス**: Email 190–255語（3問）、Article 300–390語（5問）
  - **2級**: Email 210–280語（3問）、Article 340–440語（5問）
  - **準1級**: Article A 340–430語（3問）、Article B 380–470語（4問）

### 2.6 ライティング (`email` / `summary` / `essay`：3級〜準1級)
- すべてのライティング課題には以下を必須とする（`validateWrittenExam` が自動検証）：
  1. `wordRange`: 公式目安語数（例：3級 email `[15, 25]`, essay `[25, 35]` / 準2級 email `[40, 50]`, essay `[50, 60]` / 準2級プラス summary `[25, 35]`, essay `[50, 60]` / 2級 summary `[45, 55]`, essay `[80, 100]` / 準1級 summary `[60, 70]`, essay `[120, 150]`）
  2. `model`: **`countEnglishWords(model)` が厳密に `wordRange[0]` 以上 `wordRange[1]` 以下** に収まる自然な模範解答英文
  3. `translation`: 模範解答の自然な日本語訳（および `email` / `summary` の場合は元文 `passage.translation` も必須）
  4. `explanation`: 構成・論理展開・表現のポイント解説
  5. `rubric`: 学習者が解答後に自己点検できる **4観点チェックリスト（4項目）**
- **Eメール問題（3級・準2級）の下線部表記**:
  - `emailText` 内で質問対象となる語句を `__the weekend pottery class__` のようにアンダースコア2つ `__...__` で囲むと、問題冊子PDF上で自動的に実線の下線 `<u>...</u>` として組版される（アプリ内表示でも下線対象が明確になる）。
- **意見論述問題（`essay`）の `TOPIC:` 表記**:
  - `prompt` を `日本語指示文\nTOPIC: ...`（2級・準1級では続けて `\nPOINTS:\n・...\n・...`）の形式で書くと、問題冊子PDF上で日本語指示文の直下にグレー背景・太枠の `TOPIC / POINTS` ボックスが自動描画される。

---

## 3. コード追加手順（ステップ・バイ・ステップ）

1. **ラウンドファイルの作成**
   - `eiken-app/src/eiken/materials/` 配下にファイルを新規作成（例：`written-round2-three.ts`）し、`reading-authoring.ts` のオーサリング関数で `WrittenExam` を定義する。
   ```ts
   import { question as q, passage as p, emailWriting, essayWriting, writtenRound } from './reading-authoring';

   export const WRITTEN_3_R2 = writtenRound('eiken_3', 2, [
     // 1..15: q([...], 'short')
     // 16..20: q([...], 'conversation')
     // 21..22: ...p('g3r2-notice', 'Title', text, ja, 'notice', [...])
     // 23..25: ...p('g3r2-email', 'Title', text, ja, 'email', [...])
     // 26..30: ...p('g3r2-article', 'Title', text, ja, 'article', [...])
     // 31: emailWriting(...)
     // 32: essayWriting(...)
   ], 'original-written-YYYYMMDD-rN');
   ```
2. **レジストリ登録**
   - `eiken-app/src/eiken/materials/written-booklets.ts` の `WRITTEN_BOOKLETS` 配列に追加する。
   - 追加するだけで以下が **すべて自動連携** される：
     - アプリ内の「語彙・文法」「長文読解」分野別練習チャプター（`writtenPractice.ts`）
     - アプリ内の「英検 ライティング練習」課題一覧・下書き保存・クラウド3-way同期（`EikenWriting.tsx`）
     - ガチャ排出対象および印刷用PDF4種（セット全体・問題冊子・解答用紙・解答解説）
3. **ビルド＆PDF生成・全自動品質検査の実行**
   ```bash
   cd /home/user/webapp/eiken-app
   npm run generate:materials   # 単語帳・チャプター索引の再生成
   npm run generate:booklets    # JSON検証 → ReportLab/PyMuPDFによる全PDF組版・ロゴ検査・文字重なり検査・WebPプレビュー生成 → ガチャ景品TS生成
   npm test                     # Vitest による原本・PDF整合性テスト
   ```

---

## 4. 表紙ブランド規定と PDF レイアウト仕様

- **表紙ロゴ必須規定**: すべての問題冊子（`_questions.pdf`）およびセット冊子（`.pdf`）の1ページ目（表紙）右上〜上部に、必ずマナトビ公式ロゴ（`eiken-app/public/brand/manatobi-logo-gray.png` または `manatobi-logo.png`）を埋め込むこと（`written_print_layout.py` の `build_cover_pdf` で自動配置し、`build-written-pdfs.py` で表紙画像オブジェクトの存在を機械検証している）。
- **印刷品質検査**:
  - 問題冊子に正答・解説・模範解答が1文字も漏洩していないこと。
  - 全ページでテキスト行同士のバウンディングボックス衝突（文字重なり）がゼロであること（`check_no_line_overlaps`）。
  - 3級〜準1級の解答用紙は **1ページ目＝A4横マークシート、2ページ目＝A4縦ライティング罫線解答用紙** の2ページ構成とすること。

---

## 5. リスニングの部屋（Hub内別プロダクト）との将来統合インターフェース

Hub 内のリスニング制作プロジェクト（`まなとび英検リスニング`）とは、以下の規則で **1対1の回次結合（一次試験フルパッケージ化）** ができるよう設計されている：

- **共通の級ID (`EikenGrade`)**: `eiken_5`, `eiken_4`, `eiken_3`, `eiken_pre2`, `eiken_pre2plus`, `eiken_2`, `eiken_pre1`
- **共通の回次 (`round`)**: `1` 〜 `15` の整数
- **IDの対応規則**（`src/eiken/writtenAuthoringSpec.ts` の `buildPrimaryBundleRef`）：
  - 一次筆記（本リポジトリ）: `${grade}_written_${round02}`（例：`eiken_3_written_02`）
  - リスニング（リスニング部屋）: `${grade}_listening_r${round02}`（例：`eiken_3_listening_r02`）
  - 統合一次試験バンドルID: `${grade}_primary_r${round02}`（例：`eiken_3_primary_r02`）
- `deliverables/written-booklets.json` の各冊子エントリに `primaryBundle` メタデータが自動出力されるため、将来リスニング音源・リスニングPDFを合流させる際は、`grade` と `round` をキーに問題冊子・マークシート（3ページ目にListening解答欄を追加）・解答解説を無改造で結合できる。
