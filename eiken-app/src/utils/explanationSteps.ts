/**
 * 解説の「解法の思考手順」ブロック（Phase 5 / A3 で explanationFormat.ts から移した）。
 *
 * ■ 中身は1文字も変えていない
 *   explanationFormat.ts の該当範囲をそのまま移し、
 *   ほかのファイルから使う関数にだけ export を付けた。
 *   移す前後で、全教科 373 問の enhanceExplanation の出力が完全に一致することを確かめている。
 *
 * ■ 外からの使い方は変わらない
 *   buildStepsBlock・STEPS_TITLE などは explanationFormat.ts が再エクスポートしているので、
 *   今までどおり `from '../utils/explanationFormat'` で取り出せる。
 */
import type { UnitTeaching } from '../data/teachingTypes';
import { LABEL, circledNumber } from './explanationSupplement';
import type { SubQuestionLike, QuestionLike } from './explanationShapes';

/**
 * 思考手順（①②③）ブロックを組み立てる。
 *
 * 優先順位:
 *   ① 小問ごとに用意された detailedExplanation.steps（問題固有・最も具体的）
 *   ② 単元共通の思考手順テンプレート（unitTeaching.steps）
 * のうち、①があればそれを主、なければ②を使う。
 * ①がある場合でも、単元の型を意識させるため②を「この単元の型」として併記する。
 */
/**
 * 1ステップの文字列を「見出し」と「理由・着眼点」の2段に分ける。
 *
 * フォーマット要件2 は思考手順を
 *   ・太字のステップ見出し
 *   ・その下に理由／着眼点のサブ説明
 * の2段構成にすることを求めている。元データが
 *   「◯◯する：△△だから」「◯◯する。△△に注意」「◯◯する（△△のため）」
 * のように書かれている場合は、機械的に安全に分割できる。
 * 分割できない短い一文はそのまま見出しだけにする
 * （無内容なサブ説明を自動生成して水増しすると、かえって質が落ちるため）。
 */
function splitStepDetail(text: string): { head: string; detail: string } {
  const source = text.trim();

  // ① 「：」区切り（例：「価数を確認する：H₂SO₄は2価」）
  const colon = source.match(/^([^：:]{4,40})[：:]\s*(.+)$/s);
  if (colon && colon[2].trim().length >= 4) {
    return { head: colon[1].trim(), detail: colon[2].trim() };
  }

  // ② 「。」区切り（1文目を見出し、残りを説明に）
  const period = source.match(/^([^。]{4,40})。\s*(.+)$/s);
  if (period && period[2].trim().length >= 4) {
    return { head: period[1].trim(), detail: period[2].trim().replace(/。$/, '') };
  }

  // ③ 末尾の丸括弧を補足とみなす（例：「両辺の H を合わせる（H⁺ を8個加える）」）
  const paren = source.match(/^(.{4,40}?)\s*（([^（）]{6,})）\s*$/s);
  if (paren) {
    return { head: paren[1].trim(), detail: paren[2].trim() };
  }

  return { head: source, detail: '' };
}

/** セクション見出しの文言（画面側と共有するため定数化する） */
export const STEPS_TITLE = '解法の思考手順';
export const DETAIL_TITLE = '詳しい解説';
export const UNIT_KATA_TITLE = 'この単元の思考の型';

/**
 * 小問1つぶんの思考手順を「丸数字の見出し＋理由・着眼点」の2段構成に整形する。
 * （旧 buildStepsBlock の中身をそのまま切り出したもの。出力は1文字も変えない）
 */
export function formatSubSteps(sub: SubQuestionLike, includeHeading = true): string {
  const label = (sub.label || '').trim();
  const theme = sub.detailedExplanation?.theme;
  const heading = `<b>${label || '小問'}</b>${theme ? `　— ${theme}` : ''}`;
  const steps = (sub.detailedExplanation?.steps || []).map((raw, index) => {
    // 元データが「① …」で始まる場合は番号を重複させない
    const text = String(raw).trim();
    const hasCircle = /^[①-⑮]/.test(text);
    const body = hasCircle ? text.replace(/^[①-⑮]\s*/, '') : text;
    // 「見出し＋理由・着眼点」の2段構成にできる書き方なら分割する
    const { head, detail } = splitStepDetail(body);
    const line = `　<b>${circledNumber(index)} ${head}</b>`;
    return detail ? `${line}\n　　└ ${detail}` : line;
  });
  // 小問ごとのセクションでは、直前のカード見出しに同じ「ラベル＋テーマ」を
  // すでに大きく表示している。ここで再掲すると同じ情報が2行続くだけなので、
  // 見出しを省いて手順そのものから始める（要件③：重複表現の整理）。
  // 省くのは *重複しているときだけ* で、情報は1つも失われない。
  if (!includeHeading) return steps.join('\n');
  return `${heading}\n${steps.join('\n')}`;
}

/** 思考手順を持つ小問だけを抜き出す */
export function subsWithSteps(subs: SubQuestionLike[]): SubQuestionLike[] {
  return subs.filter(
    (s) => s?.detailedExplanation?.steps && s.detailedExplanation.steps.length > 0,
  );
}

/** 単元テンプレートの ①②③ 行（ラベルなしの本体だけ） */
function formatTeachingSteps(teaching: UnitTeaching): string {
  return teaching.steps
    .map((step, index) => `<b>${circledNumber(index)} ${step.title}</b>\n　└ ${step.detail}`)
    .join('\n');
}

export function buildStepsBlock(
  question: QuestionLike,
  teaching?: UnitTeaching,
  /** 上位で既に問題固有の思考手順（単位変換ブロック等）を出しているか */
  hasSpecificSteps = false,
  /**
   * 「この単元の思考の型」を含めるか。
   * 単元につき1回だけ画面側で表示する新方式では false を渡す
   * （型そのものは buildUnitKataBlock が同じ内容を出力する）。
   */
  includeUnitKata = true,
): string {
  const parts: string[] = [];

  // --- ① 小問固有の思考手順 ---
  const detailed = subsWithSteps(question.subQuestions || []);

  if (detailed.length > 0) {
    parts.push(
      `${LABEL(STEPS_TITLE)}\n${detailed.map((sub) => formatSubSteps(sub)).join('\n\n')}`,
    );
  }

  // --- ② 単元共通の思考手順テンプレート ---
  if (teaching?.steps?.length) {
    // 問題固有の手順（小問の detailedExplanation／単位変換ブロック）が
    // すでに上にある場合は、こちらは「単元の型」として位置づける。
    const isUnitKata = detailed.length > 0 || hasSpecificSteps;
    if (!isUnitKata) {
      // この問題にとっての「解法の思考手順」そのものなので必ず残す
      parts.push(`${LABEL(STEPS_TITLE)}\n${formatTeachingSteps(teaching)}`);
    } else if (includeUnitKata) {
      parts.push(`${LABEL(UNIT_KATA_TITLE)}\n${formatTeachingSteps(teaching)}`);
    }
  }

  return parts.join('\n\n');
}
