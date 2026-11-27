import {
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { auth, FIREBASE_CONFIGURED, USE_EMULATORS } from '../firebase';
import { isNativeApp } from '../native/platform';
import { describeAuthError, isInAppBrowser, signInWithGoogle, signOutGoogle } from './googleAuth';
import type { GoogleSignInOutcome } from './authTypes';
import { asErrorLike } from './errorLike';
import { isUserCancel } from './webSignInCore';

/**
 * 毎回アカウント選択画面（select_account）を明示表示する GoogleAuthProvider を生成する。
 */
export function createAccountSelectGoogleProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

/**
 * webSignInCore の 90秒 inFlight ロックを使わず、独立したポップアップとして Google ログインを実行する。
 *
 * 【修正する不具合（設定＞基本設定＞切り替え → ポップアップを×で閉じて「はじめる」を押したときのロック）】
 *   従来の `switchGoogleAccount()` は内部で `signOutGoogle()` の直後に `runWebSignIn()` を呼び、
 *   モジュール全体の `inFlight = 'google'` を最大90秒間ロックしていた。
 *   この状態でタイトル画面へ戻り、Google アカウント選択ポップアップを「×」で閉じてすぐ「はじめる」を押すと、
 *   COOP 環境等でポップアップ終了検知が遅延している間ずっと `Onboarding` の Google ボタンが
 *   `disabled`（押されたままの半透明状態）かつ `login_busy` エラーになり、どのアカウントでもログインできなくなっていた。
 *
 *   本関数はグローバル `inFlight` を一切ロックしないため、タイトル画面でポップアップを×で閉じても
 *   直後の「はじめる」→「Google アカウントで続ける」が100%即座に押せてどのアカウントでもログインできる。
 */
export async function signInWithGoogleFreshPopup(): Promise<GoogleSignInOutcome> {
  if (isNativeApp()) {
    return signInWithGoogle();
  }
  if (!FIREBASE_CONFIGURED && !USE_EMULATORS) {
    return {
      ok: false,
      message: 'オンライン機能は初期設定が必要です。運営者はREADMEに従って専用Firebaseを設定してください。',
    };
  }
  if (isInAppBrowser()) {
    return {
      ok: false,
      message:
        'LINE や Instagram などのアプリ内ブラウザでは Google ログインが利用できません。右上のメニューから「ブラウザで開く」を選び、Safari や Chrome で開き直してください。',
    };
  }

  try {
    const cred = await signInWithPopup(
      auth,
      createAccountSelectGoogleProvider(),
      browserPopupRedirectResolver,
    );
    return { ok: true, user: cred.user as User };
  } catch (error) {
    const code = String(asErrorLike(error)?.code || '');
    if (isUserCancel(code)) {
      return {
        ok: false,
        cancelled: true,
        errorCode: 'login_cancelled',
        message: 'ログインをキャンセルしました。もう一度ボタンを押すとやり直せます。',
      };
    }
    return {
      ok: false,
      errorCode: code || 'login_failed',
      message: describeAuthError(error),
    };
  }
}

/**
 * 設定＞基本設定の「切り替え」ボタン専用：
 * 1) 現在のアカウントからサインアウト（App 側の onAuthStateChanged により即タイトル画面へ戻る）
 * 2) グローバルロックを掛けずにアカウント選択ポップアップを表示
 *    - そのまま別アカウントを選べばログイン完了 → タイトル画面の「はじめる」で即アプリ内へ入れる
 *    - ポップアップを「×」で閉じて「はじめる」を押しても、ログイン画面のボタンは一切ロックされない
 */
export async function switchGoogleAccountNonBlocking(onSignedOut?: () => void): Promise<GoogleSignInOutcome> {
  try {
    await signOutGoogle();
  } catch (error) {
    return { ok: false, message: describeAuthError(error), errorCode: 'logout_failed' };
  }
  onSignedOut?.();
  return signInWithGoogleFreshPopup();
}
