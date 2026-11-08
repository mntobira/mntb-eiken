/**
 * 他の利用者のアイコンURLを表示してよいか判定する。
 *
 * ★なぜ必要か★
 *   photoURL は Firestore に本人が書く文字列で、ルールは「長さ」しか見ていない。
 *   任意のURLを置けると
 *     ・見た人の IP アドレス・閲覧時刻を外部サーバーに送る（トラッキング画像）
 *     ・不適切な画像を全国ランキングに出す（App Store 1.2）
 *   ができてしまう。そこで表示する側で「Google / Apple のアイコン配信元の https」だけを通す。
 *   通らなければ頭文字のアイコンに切り替わる（各画面の既存のフォールバック）。
 */
const ALLOWED_HOSTS = [
  /^lh[0-9]\.googleusercontent\.com$/,
  /^[a-z0-9-]+\.googleusercontent\.com$/,
  /^[a-z0-9-]+\.ggpht\.com$/,
];

export function safeAvatarUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string' || url.length > 512) return '';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return '';
    if (u.username || u.password) return '';
    return ALLOWED_HOSTS.some((re) => re.test(u.hostname)) ? u.toString() : '';
  } catch {
    return '';
  }
}
