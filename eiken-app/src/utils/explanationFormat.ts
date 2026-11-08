/**
 * ===================================================================
 * 解答・解説の統一フォーマット・エンジン
 * ===================================================================
 *
 * ■ 目的
 * アプリ内すべての問題の「解答・解説」を、次の3つの要件を満たす形に
 * 機械的かつ確実に整形する。手作業の書き換えでは必ず抜け漏れが出るため、
 * 「データ ＋ 単元別の指導テンプレート」から自動生成する方式を採る。
 *
 *   1. 解答の超・強調表示（視認性MAX）
 *      → ピンクの蛍光ペン＋太字。0.1秒で解答を発見できる。
 *      → 蛍光ペンは「文字全体の塗りつぶし」ではなく、まとめプリントと同じ
 *        ★文字の下だけに引くアンダーライン型★（下 40% のグラデーション）にする。
 *      → ★黄色は使用禁止★（フローチャート／ロジックツリーの強調色と衝突するため）
 *         このため、既存解説中の <u> タグ（textFormatter が黄色マーカーへ変換する）は
 *         問題解説に限り「黒い波線」のキーワード強調（KEY）へ置き換える。
 *
 *   2. 解説のプロセス化・体系化（記号の厳格な使い分け）
 *      → 思考手順は必ず ①②③…（丸数字）。各ステップは
 *        「太字の見出し ＋ 理由・着眼点のサブ説明」の2段構成。
 *      → 「STEP」はフローチャート／ロジックツリーの箇所を参照するときのみ使用する。
 *         このエンジンは思考手順に STEP を一切出力しない。
 *
 *   3. 「共通テスト出題傾向」特設ボックス
 *      → 解説の末尾に、視覚的に明確に区別されたボックスを設置する。
 *      → アプリ内の出題傾向データ（trendData.ts）と実際のセンター／共通テストの
 *        傾向を突き合わせた、単元別の分析を載せる（実際の問題文は掲載しない）。
 *
 * ■ なぜ Markdown の引用（>）ではなく <div> なのか
 * このアプリの本文レンダラ（utils/textFormatter.tsx）は Markdown を解釈せず、
 * HTML タグのみをそのまま通す。`>` は文字として表示されてしまうため、
 * 同等以上に「明確にデザインを変えた枠」を inline style の <div> で実現する。
 *
 * ■ 配色を inline style で明示する理由
 * 解説は練習モードではダークテーマ（#0B132B 系）、小テストではライトテーマの
 * 上に描画される。背景色だけ指定して文字色を指定しないと、
 * ダークテーマ側で「白文字 × 薄ピンク背景」となり判読不能になる。
 * そのため、すべてのマーカー／ボックスで文字色を必ず固定する。
 */

// -------------------------------------------------------------------
// 基本パーツ
// -------------------------------------------------------------------

import type {
  TrendInsight,
  UnitTeaching,
  UnitConversionWalk,
} from '../data/teachingTypes';
import {
  ANS,
  ANS_STYLE,
  BOX,
  KEY,
  KEY_STYLE,
  LABEL,
  buildFlowchartSteps,
  circledNumber,
  extractFlowchartSteps,
  type FlowchartStepLike,
} from './explanationSupplement';
import type { SubQuestionLike, QuestionLike } from './explanationShapes';
import { STEPS_TITLE, buildStepsBlock, formatSubSteps, subsWithSteps } from './explanationSteps';
import { buildInterleavedSections, groupDivider, subQuestionCard } from './explanationSections';
import { SQ_MARK, SQ_BODY_MARK, SQ_SHARED_MARK } from './explanationSlices';
export { GROUP_MARK, SQ_MARK, SQ_BODY_MARK, SQ_SHARED_MARK, sliceEnhancedBySubQuestion, sliceEnhancedByQuestion } from './explanationSlices';
export type { SubQuestionSlices, EnhancedSlices } from './explanationSlices';
export { subMarkerCandidates, splitBodyBySubQuestions, questionGroupKey, splitBodyByQuestionGroups, dedupeAgainstSteps } from './explanationMarkers';
export type { BodySegments } from './explanationMarkers';
export {
  ANS,
  ANS_STYLE,
  BOX,
  KEY,
  KEY_STYLE,
  LABEL,
  buildFlowchartSteps,
  circledNumber,
  extractFlowchartSteps,
  type FlowchartStepLike,
};

// 指導テンプレート・単位変換の「データの形」は data/teachingTypes.ts に置いている。
// （実際にその形のデータを持っているのが data 側のため。理由はそのファイルの冒頭コメント）
// これまでどおり `from '../utils/explanationFormat'` でも取り出せるよう再エクスポートする。
export type {
  ThinkingStep,
  TrendInsight,
  UnitTeaching,
  ConversionHop,
  UnitConversionWalk,
} from '../data/teachingTypes';

// -------------------------------------------------------------------
// セクション生成
// -------------------------------------------------------------------

/**
 * すでにこのエンジンで整形済みか（二重適用の防止）
 *
 * リスニング専用エンジン（listeningExplanation.ts）も同じ目印を先頭に付ける。
 * こうしておくと、後から汎用エンジンを通しても isEnhanced() が true を返して
 * 二重に整形されない＝解説が二重に長くならない。
 */
export const ENHANCED_MARK = '<!--fmt-v1-->';

export function isEnhanced(explanation: unknown): boolean {
  return typeof explanation === 'string' && explanation.includes(ENHANCED_MARK);
}

/**
 * 【解答】ブロックを組み立てる。
 *
 * 解答の値は問題データ（subQuestions[].correctAnswer）そのものを使うため、
 * 文章から解答を推測することによる取り違えが原理的に起こらない。
 * 自由記述（descriptive）は「解答例」と明示する。
 */
export function buildAnswerBlock(question: QuestionLike): string {
  const subs = (question.subQuestions || []).filter((s) => s && s.correctAnswer);
  if (subs.length === 0) return '';

  const lines = subs.map((sub) => {
    const label = (sub.label || '').trim();
    const answer = String(sub.correctAnswer).trim();
    const isFree = sub.type === 'descriptive';
    const head = label ? `${label}　` : '';
    return `${head}${ANS(`${isFree ? '【解答例】' : '【解答】'}${answer}`)}`;
  });

  return `${LABEL('解 答')}\n${lines.join('\n')}`;
}

/**
 * 「単位変換で解く」ブロックを組み立てる。
 *
 * ■ なぜ専用ブロックにするのか
 * 物質量（mol）の計算は、公式を4つも5つも覚えると必ずどれかを取り違える。
 * まとめプリントの「単位変換の図」は、mol をハブにした乗り換え路線図として
 *   ・mol へ向かうときは ÷（割る）
 *   ・mol から離れるときは ×（掛ける）
 * という2つのルールだけで全問を貫く。この考え方を、解答の直後・詳しい解説の前に
 * 必ず同じ形で提示することで、生徒が毎回同じ手順を再現できるようにする。
 *
 * ■ 構成
 *   1. 変換ルート（［スタート単位］→ ［mol］→ ［ゴール単位］の一本道）
 *   2. ①②③ の思考手順（各ホップの理由つき）
 *   3. ひと続きの換算式（単位が約分されてゴールの単位だけが残ることを見せる）
 *   4. 検算コメント
 */
export function buildUnitConversionBlock(walk: UnitConversionWalk): string {
  const rows: string[] = [];

  rows.push(LABEL('単位変換で解く'));
  rows.push(
    `まとめプリントの${KEY('単位変換の図')}のとおり、${KEY('まず mol に直す')}→${KEY('次に求めたい単位へ変換する')}の一本道で解きます。`,
  );

  // --- 1. 変換ルート（路線図） ---
  const stations = [`［${walk.startUnit}］`, ...walk.route.map((hop) => `［${hop.to}］`)];
  const arrows = walk.route.map((hop) => hop.arrow);
  const routeLine = stations
    .map((station, index) => (index === 0 ? station : `─（${arrows[index - 1]}）→ ${station}`))
    .join(' ');
  rows.push('');
  rows.push(`<b>■ 変換ルート</b>`);
  rows.push(`　${routeLine}`);
  rows.push(`　スタート：${walk.start}　／　ゴール：${walk.goal}`);

  // --- 2. ①②③ の思考手順 ---
  if (walk.steps.length > 0) {
    rows.push('');
    rows.push('<b>■ ルートのたどり方</b>');
    walk.steps.forEach((step, index) => {
      rows.push(`<b>${circledNumber(index)} ${step.title}</b>`);
      if (step.detail) rows.push(`　└ ${step.detail}`);
    });
  }

  // --- 3. ひと続きの換算式 ---
  if (walk.oneLine && walk.oneLine.length > 0) {
    rows.push('');
    rows.push('<b>■ 一気に書くとこの1行</b>');
    walk.oneLine.forEach((line) => rows.push(`　${line}`));
  }

  // --- 4. 検算 ---
  if (walk.check) {
    rows.push('');
    rows.push(`<b>■ 単位で検算</b>`);
    rows.push(`　${walk.check}`);
  }

  return rows.join('\n');
}

// 「解法の思考手順」ブロックは explanationSteps.ts、
// 小問・大問ごとに区切る処理は explanationSections.ts へ移した（Phase 5 / A3）。
// 外向きの名前は変えない（tests/architectureFitness.test.ts が見張っている）。
export { STEPS_TITLE, DETAIL_TITLE, UNIT_KATA_TITLE, buildStepsBlock } from './explanationSteps';
export { buildQuestionGroupParts } from './explanationSections';
export type { QuestionGroupParts } from './explanationSections';

/**
 * 「共通テスト出題傾向」特設ボックスを組み立てる。
 * 実際の問題文は載せず、出典・問われた要素・ひっかけ・対策のみを記す。
 */
export function buildTrendBox(trend: TrendInsight): string {
  const rows: string[] = [];
  rows.push('<b>💡 【ココが狙われる！共通テスト・センター試験のリアル】</b>');

  if (trend.sources.length > 0) {
    rows.push('');
    rows.push(`<b>■ 出典</b>：${trend.sources.join('／')}`);
  }
  if (trend.asked.length > 0) {
    rows.push('');
    rows.push('<b>■ 過去問では、こういう要素が問われた！</b>');
    trend.asked.forEach((item) => rows.push(`　・${item}`));
  }
  if (trend.traps.length > 0) {
    rows.push('');
    rows.push('<b>■ このパターンのひっかけが多い！</b>');
    trend.traps.forEach((item) => rows.push(`　⚠️ ${item}`));
  }
  if (trend.advice) {
    rows.push('');
    rows.push('<b>■ 実践アドバイス</b>');
    rows.push(`　${trend.advice}`);
  }

  return BOX(rows.join('\n'));
}

// -------------------------------------------------------------------
// 既存解説の整形
// -------------------------------------------------------------------

/**
 * 既存の解説本文を、フォーマット要件に適合するよう整える。
 *
 *  - <u> は textFormatter が「黄色マーカー」に変換する仕様のため、
 *    黄色使用禁止の要件に従いオレンジのキーワード強調へ置換する。
 *  - 行頭の「▼ 解答・解説」のような重複見出しは、
 *    自動生成する【解 答】ラベルと二重になるため取り除く。
 */
export function normalizeLegacyBody(body: string): string {
  return qualifyStepReferences(
    body
      .replace(/<u>([\s\S]*?)<\/u>/g, (_match, inner) => KEY(String(inner)))
      // 「▼ 解答と解説」「▼ 解答・解説」「▼ 解説」など、自動生成する
      // 【解 答】ラベルと二重になる旧見出しを取り除く
      .replace(/^\s*▼\s*(?:解答\s*[・･と]?\s*)?解説\s*\n?/gm, '')
      .trim(),
  );
}

/**
 * 「STEP」はフローチャート（ロジックツリー）の箇所を参照するときだけ使う、という
 * フォーマット要件を満たすための正規化。
 *
 * 本文中に「STEP 1 に戻って…」のように *裸の* STEP 参照があると、
 * 思考手順の番号（①②③）と紛らわしい。直前 30 文字以内に
 * 「フローチャート」「ロジックツリー」が無い STEP 参照には、
 * 明示的に「フローチャートの」を補って、参照先が一目で分かるようにする。
 */
export function qualifyStepReferences(body: string): string {
  return body.replace(/(.{0,30}?)(STEP\s*\d+)/gis, (whole, before: string, step: string) => {
    if (/(?:フローチャート|ロジックツリー)[^。\n<]{0,30}$/.test(before)) return whole;
    return `${before}フローチャートの ${step.replace(/\s+/g, ' ')}`;
  });
}

/**
 * 解説が JSON（ロジックツリー等の構造化データ）かどうか。
 * これらは専用コンポーネントが描画するため、整形の対象外にする。
 */
export function isStructuredExplanation(explanation: string): boolean {
  const head = explanation.trimStart().slice(0, 40);
  return head.startsWith('{') && head.includes('"type"');
}

// -------------------------------------------------------------------
// 総合：1問ぶんの解答・解説を組み立てる
// -------------------------------------------------------------------

/**
 * 1問ぶんの解答・解説を、フォーマット要件を満たす形に再構成する。
 *
 * 構成（上から順に、生徒が見る順序）
 *   1. 【解 答】      … ピンクマーカー。まずここで答え合わせができる
 *   2. （単位変換で解く）… mol計算の道順（該当問題のみ）
 *   3. 問ごとに ［【解法の思考手順】→【詳しい解説】］ を隣接させて反復
 *      → 問1 の解説を読むために画面を大きく送る必要がなくなる（要件②）。
 *      → 2つのブロックは統合も削除もせず、必ず別ブロックとして残す。
 *   4. 💡 出題傾向ボックス … 単元別の実践分析
 *
 * ■「この単元の思考の型」はここには含まれない（要件①）
 * 単元共通の型は、単元につき1回だけ「採点結果の直後」のアコーディオンで
 * 表示する。内容は buildUnitKataBlock() が従来と同一の文字列で生成する。
 *
 * @param question   問題オブジェクト
 * @param teaching   単元別の指導テンプレート（無い単元は省略可）
 * @returns 整形後の解説文字列（対象外なら元の値をそのまま返す）
 */
/**
 * ロジックツリー（logic_thought JSON）の問題向けの「補足ブロック」を組み立てる。
 *
 * これらの問題は explanation 自体がフローチャート描画用の構造化データなので、
 * 文字列を書き換えることができない。そこで【解答】【思考手順】【出題傾向】だけを
 * 別フィールド（explanationSupplement）として用意し、
 * フローチャートの下に並べて表示することで、
 * 全問題が同じフォーマット要件を満たすようにする。
 *
 * この種の問題だけはフローチャートが実在するため、
 * 思考手順の各段階から「STEP n」への参照を張る（要件2の記号の使い分け）。
 */
/**
 * ロジックツリー問題の「小問ごとのセクション」を組み立てる。
 *
 * ■ なぜ必要か（実測にもとづく設計判断）
 * logic_thought 形式の問題は explanation が JSON なので enhanceExplanation を通らず、
 * 表示用の文字列は buildSupplement が作っている。ところが従来の buildSupplement は
 * 「全小問ぶんの思考手順」を1枚の大きなブロックにまとめて出していたため、
 * <!--sq:--> の目印が1つも付かず、採点結果の小問アコーディオンを開いても
 * 中身が空のままだった（実測で 17大問・145小問がこの状態）。
 *
 * ここでは *すでにデータに存在する情報だけ* を小問ごとに並べ替える。
 * 要約・簡略化・削除は一切していない（順番と見出しの付け方を変えているだけ）。
 *
 * 並び順は他の問題と完全にそろえる：
 *   ［カード（どの問い／何を問うか／答え）］ → ［解法の思考手順］
 */
function buildSupplementSubSections(question: QuestionLike): string[] | null {
  const subs = (question.subQuestions || []).filter(Boolean) as SubQuestionLike[];
  if (subs.length < 2) return null;
  // 小問ごとに固有の思考手順があるときだけ、小問単位に分ける意味がある
  if (subsWithSteps(subs).length < 2) return null;

  const sections: string[] = [];
  subs.forEach((sub, index) => {
    const key = String(sub.id || sub.label || '');
    if (!key) return;
    const rows: string[] = [SQ_MARK(key)];
    if (sections.length > 0) rows.push(groupDivider());
    rows.push(subQuestionCard(sub, index));
    rows.push(SQ_BODY_MARK);
    // カード見出しに「ラベル＋テーマ」を出しているので、手順側の見出しは省く
    // （要件③：重複表現の整理。落とすのは重複した見出しだけで、手順は全て残る）
    const steps = formatSubSteps(sub, false);
    if (steps.trim()) rows.push(`${LABEL(STEPS_TITLE)}\n${steps}`);
    sections.push(rows.join('\n'));
  });

  return sections.length >= 2 ? sections : null;
}

export function buildSupplement(
  question: QuestionLike,
  teaching?: UnitTeaching,
  flowchartSteps?: FlowchartStepLike[],
): string {
  const sections: string[] = [];

  const answerBlock = buildAnswerBlock(question);
  if (answerBlock) sections.push(answerBlock);

  // フローチャートがあるなら、それを参照する形の思考手順を最優先で置く
  const flowBlock = flowchartSteps?.length ? buildFlowchartSteps(flowchartSteps) : '';

  // ★要件②④⑤ 小問ごとに完結させる★
  const perSub = buildSupplementSubSections(question);

  if (perSub) {
    // フローチャート由来の手順は大問全体に共通するので「共通部分」に置く。
    // 画面側はこれをすべての小問アコーディオンに添えるため、
    // どの小問を開いても全体の流れが読める（複製されるだけで削られていない）。
    // 見出しが小問ごとの「解法の思考手順」とぶつかって
    // 「同じ見出しが2回続く」ように見えるのを避けるため、
    // 共通側だけ「大問全体の流れ」であることを明記する。
    // ★文言を足しているだけで、手順そのものは1行も削っていない★
    if (flowBlock) {
      sections.push(
        `${SQ_SHARED_MARK}${flowBlock.replace(
          `${LABEL(STEPS_TITLE)}\n`,
          `${LABEL('この大問全体の流れ')}<span style="font-size:max(12px, 0.8em); color:#B03A5B; margin-left:6px;">（フローチャートの読み方）</span>\n`,
        )}`,
      );
    }
    sections.push(...perSub);
  } else {
    if (flowBlock) sections.push(flowBlock);

    // 「この単元の思考の型」は含めない（単元につき1回だけ、
    // 採点結果の直後のアコーディオンで表示する ── 要件①）。
    const stepsBlock = buildStepsBlock(question, teaching, Boolean(flowBlock), false);
    if (stepsBlock) {
      // フローチャート由来の手順を出したときは、見出しが「解法の思考手順」と
      // 重複しないよう、単元テンプレート側は出力しない（上の false で抑止済み）。
      sections.push(stepsBlock);
    }
  }

  if (teaching?.trend) sections.push(buildTrendBox(teaching.trend));

  if (sections.length === 0) return '';
  return `${ENHANCED_MARK}${sections.join('\n\n')}`;
}

export function enhanceExplanation(
  question: QuestionLike,
  teaching?: UnitTeaching,
  /**
   * 物質量（mol）計算問題のための「単位変換の道順」。
   * 渡された場合は、解答の直後に「単位変換で解く」ブロックを挿入し、
   * 単元共通の思考手順テンプレートより優先して表示する
   * （この問題に固有の、より具体的な手順だから）。
   */
  unitConversion?: UnitConversionWalk,
): string {
  const original = typeof question.explanation === 'string' ? question.explanation : '';

  // 二重適用と、構造化データ（ロジックツリー JSON）は触らない
  if (isEnhanced(original) || (original && isStructuredExplanation(original))) return original;

  const sections: string[] = [];

  const answerBlock = buildAnswerBlock(question);
  if (answerBlock) sections.push(answerBlock);

  // 単位変換で解ける問題は、まず「単位変換の図」の道順を提示する。
  if (unitConversion) sections.push(buildUnitConversionBlock(unitConversion));

  // ★要件② 問ごとに ［解法の思考手順 → 詳しい解説］ を隣接させる★
  //
  // 従来は「全問ぶんの思考手順」→「全問ぶんの詳しい解説」という並びだったため、
  // 問1の詳しい解説を読むには画面を大きく下へ送る必要があった。
  // ここで問単位に組み替えて「1問を見ればその場で完結する」構成にする。
  //
  // ★「この単元の思考の型」は含めない★（要件①）
  // 単元につき1回だけ、採点結果の直後にアコーディオンで表示するため、
  // 画面側（Explanation.tsx）が buildUnitKataBlock() で描画する。
  const body = normalizeLegacyBody(original);
  const hasSpecificSteps = Boolean(unitConversion);
  const fallbackSteps = buildStepsBlock(question, teaching, hasSpecificSteps, false)
    .replace(`${LABEL(STEPS_TITLE)}\n`, '');

  if (body) {
    sections.push(
      ...buildInterleavedSections(question, body, fallbackSteps, Boolean(answerBlock)),
    );
  } else if (fallbackSteps) {
    sections.push(`${LABEL(STEPS_TITLE)}\n${fallbackSteps}`);
  }

  if (teaching?.trend) sections.push(buildTrendBox(teaching.trend));

  // 何も生成できなかった場合は元のまま返す（情報を失わせない）
  if (sections.length === 0) return original;

  return `${ENHANCED_MARK}${sections.join('\n\n')}`;
}
