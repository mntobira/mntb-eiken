/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * viewportControl
 * ------------------------------------------------------------------
 * 解答解説ページ（俯瞰UI＋ピンチアウト前提）用の viewport 制御ユーティリティ。
 *
 * 【背景】
 * meta viewport の書き換えが App / Quiz / Explanation の3箇所に分散して
 * 競合していたことが、初回表示時のみスクロール不能になる等の不安定な挙動の
 * 原因だったため、「俯瞰用 viewport の適用」ロジックをここに一元化する。
 *
 * 【俯瞰UIの仕様】
 * - スマホでも PC 版と同じレイアウト（width=1024 viewport）で描画する。
 * - 初期表示は全体が画面内に収まる縮小表示（initial-scale = 画面幅/1024）。
 * - minimum-scale=fit で俯瞰まで戻れ、maximum-scale=5.0 でピンチ操作により
 *   任意の箇所を自由にズームイン・アウトできる（user-scalable=yes）。
 */

/** 俯瞰UIのレイアウト基準幅（PC版レイアウトの想定幅） */
export const OVERVIEW_LAYOUT_WIDTH = 1024;

/**
 * 俯瞰用 viewport（width=1024 ＋ fit scale ＋ ピンチズーム許可）を適用する。
 *
 * ユーザーがピンチアウトで拡大していた場合も、呼び出すたびに
 * 初期倍率（全体が画面に収まる縮小表示）へ強制リセットされる。
 * 解答解説ページへ遷移する度（次の問題の解説へ移る度）に呼び出すことで、
 * 前のページの拡大状態を引き継がないようにする。
 *
 * 実装メモ:
 * - iOS Safari は同じ width のまま initial-scale を再設定しても無視する
 *   ことがあるため、一度 device-width にリセットしてから width=1024 を
 *   適用する2段階処理にする。この width 変更自体がユーザーのズーム状態を
 *   破棄するトリガーにもなる。
 * - fit scale はリセット後の innerWidth から算出する。（リセット前に読むと、
 *   直前の viewport が width=1024 だった場合に innerWidth≒1024 → scale=1 と
 *   誤算出され、俯瞰の縮小表示にならないため）
 */
export function applyOverviewViewport(): void {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;

  viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
  requestAnimationFrame(() => {
    const deviceWidth = Math.min(
      window.innerWidth || 0,
      (window.screen && window.screen.width) || Infinity
    ) || window.innerWidth;
    const scale = Math.min(1, deviceWidth / OVERVIEW_LAYOUT_WIDTH);
    viewport.setAttribute(
      'content',
      `width=${OVERVIEW_LAYOUT_WIDTH}, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=5.0, user-scalable=yes`
    );
  });
}
