/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * useMediaQuery / useIsMobile / useIsDesktop
 * ------------------------------------------------------------------
 * スマホ/PC のレイアウト分岐を JS 側で行っていた箇所を一元化するための共有フック。
 *
 * 【背景 / C2】
 * 従来は各コンポーネントが個別に `window.innerWidth` を監視しており、
 *  - Explanation: `window.innerWidth < 768` を「スマホ」
 *  - Quiz:        `window.innerWidth >= 1024` を「PC」
 * とブレークポイントがバラバラで、リサイズリスナーも重複実装されていた。
 * さらに初期描画時に一瞬だけ誤った値になる（レイアウトのちらつき）問題があった。
 *
 * このフックは:
 *  - `matchMedia` を使い、初回レンダリング時点で正しい値を返す（ちらつき無し）
 *  - Tailwind と同じブレークポイント（md=768 / lg=1024）を共有定数として一元管理
 *  - SSR / matchMedia 非対応環境でも安全（フォールバック値を返す）
 *  - スマホプレビュー枠など「明示的に上書きしたい」ケースのために override を受け取る
 */

import { useState, useEffect } from 'react';

/** Tailwind のデフォルトブレークポイント（px）と揃える */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/**
 * 任意のメディアクエリにマッチするかを返す SSR セーフなフック。
 * @param query 例: "(min-width: 1024px)"
 * @param defaultState matchMedia 非対応環境（SSR等）でのフォールバック
 */
export function useMediaQuery(query: string, defaultState = false): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return defaultState;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);

    // 初期同期（query 変更時にも即時反映）
    onChange();

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } else {
      // Safari 13 以前の古い API
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, [query]);

  return matches;
}

/**
 * スマホ幅（md=768px 未満）かどうか。
 * @param override 明示的に値を固定したい場合（スマホプレビュー枠など）
 */
export function useIsMobile(override?: boolean): boolean {
  const matches = useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`, false);
  return override !== undefined ? override : matches;
}

/**
 * PC 幅（lg=1024px 以上）かどうか。
 * @param override 明示的に値を固定したい場合（スマホプレビュー枠など）
 */
export function useIsDesktop(override?: boolean): boolean {
  const matches = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`, false);
  return override !== undefined ? override : matches;
}
