import { useEffect, useState } from 'react';

/**
 * D5（2026-10-30）：画面の上に重ねて開くページ（学びの扉など）を開いている間だけ、バナー広告を止める。
 *   学びの扉はホームの上にポータルで開くので、App の appState は 'home' のまま＝今までは広告が下に出ていた。
 *   開いたページが useSuppressBannerAd() を呼ぶと、閉じるまで App が広告の画面名を 'philosophy' にする（adConfig の hiddenOn）。
 */
let count = 0;
const listeners = new Set<(on: boolean) => void>();
const emit = () => listeners.forEach((l) => l(count > 0));

export const adSuppressStore = {
  get: () => count > 0,
  subscribe(l: (on: boolean) => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

/** このページを開いている間、バナー広告を出さない */
export function useSuppressBannerAd(): void {
  useEffect(() => {
    count += 1; emit();
    return () => { count = Math.max(0, count - 1); emit(); };
  }, []);
}

/** App 用：広告を止めるページが開いているか */
export function useBannerAdSuppressed(): boolean {
  const [on, setOn] = useState(adSuppressStore.get);
  useEffect(() => adSuppressStore.subscribe(setOn), []);
  return on;
}
