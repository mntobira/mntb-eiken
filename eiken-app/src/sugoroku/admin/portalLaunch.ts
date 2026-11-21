/**
 * URLクエリ（?portal=admin）または環境変数（VITE_SUGOROKU_PORTAL=admin）から
 * すごろく塾管理者ポータル直起動モードかどうかを判定する軽量リーフモジュール。
 *
 * App.tsx の初期マウント時に同期参照しても、管理者ポータル本体チャンク
 * （SugorokuAdminApp）を一切引き込まないよう独立させている。
 */
export function isSugorokuAdminPortalLaunch(): boolean {
  const envVal = (import.meta.env.VITE_SUGOROKU_PORTAL as string | undefined) || '';
  if (envVal.trim().toLowerCase() === 'admin') return true;
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('portal')?.toLowerCase() === 'admin';
  } catch {
    return false;
  }
}
