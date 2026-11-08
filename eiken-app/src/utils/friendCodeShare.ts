import { isNativeApp } from '../native/platform';

export function buildFriendCodeShareText(friendCode: string): string {
  return `マナトビでフレンドになろう！\nフレンドコード：${friendCode}\nアプリの「フレンド」画面でコードを入力して申請してください。`;
}

/** iOS / Android は Capacitor Share、Web は Web Share APIを使う。 */
export async function shareFriendCode(friendCode: string): Promise<'shared' | 'copied'> {
  const title = 'マナトビのフレンドコード';
  const text = buildFriendCodeShareText(friendCode);

  if (isNativeApp()) {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, dialogTitle: 'フレンドコードを共有' });
    return 'shared';
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share({ title, text });
    return 'shared';
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }

  throw new Error('この端末では共有もコピーも利用できません。');
}
