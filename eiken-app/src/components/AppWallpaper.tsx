import { useEffect } from 'react';
import { useGrowthProgress } from '../hooks/useGrowthProgress';
import { equippedWallpaper } from '../battle/core/growth';
import { wallpaperOf } from '../battle/core/tobiraParts';

/**
 * ガチャで当てた壁紙をアプリの背景にする（画面には何も描かない）。
 * <html> に CSS 変数と data 属性を付けるだけなので、App.tsx の構造には触れない。
 * 文字の読みやすさのため、壁紙は「背景の地」だけに使い、カードや問題文の白地はそのまま。
 */
export function AppWallpaper() {
  const { progress } = useGrowthProgress();
  const key = progress ? equippedWallpaper(progress) : '';
  useEffect(() => {
    const root = document.documentElement;
    const wp = wallpaperOf(key);
    if (!wp) {
      root.removeAttribute('data-wallpaper');
      root.style.removeProperty('--app-wallpaper');
      return;
    }
    root.setAttribute('data-wallpaper', wp.dark ? 'dark' : 'light');
    root.style.setProperty('--app-wallpaper', wp.css);
    return () => { root.removeAttribute('data-wallpaper'); root.style.removeProperty('--app-wallpaper'); };
  }, [key]);
  return null;
}
