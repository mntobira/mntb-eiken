/**
 * すごろく塾 管理者ポータル認可ガード UI（SugorokuAdminGuard）
 *
 * 『03_AI並列開発指示書』第1章・第3章 AI 4 タスク2:
 *   - sugoroku_members/{uid} の role in ['owner', 'staff'] またはクラス teacherUid のみが
 *     管理者ポータル・生徒実名（rosterName）・提出物を扱える認可ガードを提供する。
 *   - 未ログイン時は Google ログイン（iPad Safari リダイレクト切替対応）を案内し、
 *     生徒アカウント・部外者アカウントでのアクセスは明確に遮断する。
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { FIREBASE_CONFIGURED, USE_EMULATORS } from '../../firebase';
import { useSignInGuard } from '../../hooks/useSignInGuard';
import { GoogleMark } from '../../components/GoogleLinkBanner';
import { useSuppressBannerAd } from '../../utils/adSuppress';
import { isSafariOrIPadBrowser } from './sugorokuAuthCore';
import {
  signInSugorokuWithGoogle,
  signOutGoogle,
  triggerGoogleRedirectSignIn,
  type SugorokuSignInResult,
} from './sugorokuAuthService';
import { useSugorokuAdminGuard } from './useSugorokuAuth';

export interface SugorokuAdminGuardProps {
  children: React.ReactNode;
  onBackToStudentApp?: () => void;
  /** Firebase未設定時の試作デモモードでプレビュー表示を許可するか（既定: true） */
  allowDemoModeWhenUnconfigured?: boolean;
}

export function SugorokuAdminGuard({
  children,
  onBackToStudentApp,
  allowDemoModeWhenUnconfigured = true,
}: SugorokuAdminGuardProps) {
  useSuppressBannerAd();
  const { user, checking, allowed, reason, recheck } = useSugorokuAdminGuard();
  const { busy: signing, anyBusy, run: runSignIn } = useSignInGuard();
  const [authError, setAuthError] = useState('');
  const [showRedirect, setShowRedirect] = useState(() => isSafariOrIPadBrowser());
  const [demoUnlocked, setDemoUnlocked] = useState(false);

  const onlineReady = FIREBASE_CONFIGURED || USE_EMULATORS;

  if (!onlineReady && allowDemoModeWhenUnconfigured && demoUnlocked) {
    return <>{children}</>;
  }

  if (allowed) {
    return <>{children}</>;
  }

  const handleLogin = async () => {
    setAuthError('');
    const res = (await runSignIn(() =>
      signInSugorokuWithGoogle({ autoRedirectOnBlock: false }),
    )) as SugorokuSignInResult;
    if (res.redirecting) return;
    if (res.ok) {
      await recheck();
      return;
    }
    if (!res.cancelled) {
      setAuthError(res.message || 'ログインに失敗しました。');
      if (res.popupBlockedOnSafari || res.canSwitchToRedirect) {
        setShowRedirect(true);
      }
    }
  };

  const handleRedirectLogin = async () => {
    setAuthError('');
    const res = await runSignIn(() => triggerGoogleRedirectSignIn());
    if (res.redirecting) return;
    if (!res.ok) {
      setAuthError(res.message || 'リダイレクトログインを開始できませんでした。');
    }
  };

  return (
    <main
      data-testid="sugoroku-admin-guard"
      className="min-h-[100dvh] w-full bg-[#F4F7FA] px-4 py-8 flex items-center justify-center"
    >
      <div className="w-full max-w-md rounded-3xl border border-[#D5E1EC] bg-white p-6 shadow-sm space-y-4">
        {onBackToStudentApp && (
          <button
            type="button"
            onClick={onBackToStudentApp}
            className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-bold text-[#4B5563] hover:text-[#1B2631]"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            学習画面へ戻る
          </button>
        )}

        <header className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EBF3FA] text-[#1F567D]">
            <Lock size={22} aria-hidden="true" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-[#1B2631]">
            すごろく塾 講師・管理者専用ポータル
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-[#5D6D7E]">
            生徒の実名および提出データの保護のため、登録された講師の Google アカウントのみアクセスできます。
          </p>
        </header>

        {checking ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-sm text-[#5D6D7E]">
            <Loader2 size={20} className="animate-spin text-[#1F567D]" aria-hidden="true" />
            <span>講師権限を確認しています…</span>
          </div>
        ) : !user ? (
          <div className="space-y-3">
            <button
              type="button"
              data-testid="sugoroku-admin-login-btn"
              onClick={handleLogin}
              disabled={anyBusy}
              className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-2xl border border-[#DADCE0] bg-white px-4 py-3 text-sm font-bold text-[#1B2631] shadow-sm hover:bg-[#F8F9FA] disabled:opacity-50"
            >
              {signing ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  認証中…
                </>
              ) : (
                <>
                  <GoogleMark size={20} />
                  講師用 Google アカウントでログイン
                </>
              )}
            </button>

            {showRedirect && (
              <button
                type="button"
                onClick={handleRedirectLogin}
                disabled={anyBusy}
                className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#85C1E9] bg-[#F4F9FD] px-3 py-2 text-xs font-bold text-[#1F618D] hover:bg-[#EBF5FB] disabled:opacity-50"
              >
                <ExternalLink size={14} aria-hidden="true" />
                iPad / Safari 用：リダイレクト方式でログイン
              </button>
            )}

            {authError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-[#E74C3C]/40 bg-[#FDEDEC] p-3 text-xs text-[#C0392B]"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{authError}</span>
              </div>
            )}

            {!onlineReady && allowDemoModeWhenUnconfigured && (
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-3.5 space-y-2">
                <p className="text-xs text-[#4B5563]">
                  クラウド未接続環境のため、試作デモデータモードで管理者ポータルを確認できます。
                </p>
                <button
                  type="button"
                  data-testid="sugoroku-admin-demo-btn"
                  onClick={() => setDemoUnlocked(true)}
                  className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#1F567D] px-3 py-2 text-xs font-bold text-white hover:bg-[#174362]"
                >
                  デモモードで管理者ポータルを開く
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3" role="alert">
            <div className="flex items-start gap-2.5 rounded-2xl border border-[#F5C6C0] bg-[#FDECEA] p-3.5 text-xs leading-relaxed text-[#96342B]">
              <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold">このアカウントには講師・管理者権限がありません</p>
                <p className="mt-1">
                  ログイン中: <b>{user.email || user.uid}</b>（判定コード: {reason}）
                </p>
                <p className="mt-1">
                  すごろく運営にて講師ロール（<code>owner</code> / <code>staff</code>）または担当クラス登録が行われた Google アカウントに切り替えてください。
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void recheck()}
                className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-[#1B2631] hover:bg-gray-50"
              >
                <RefreshCw size={14} aria-hidden="true" />
                再確認
              </button>
              <button
                type="button"
                onClick={() => void signOutGoogle()}
                className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#1F567D] px-3 py-2 text-xs font-bold text-white hover:bg-[#174362]"
              >
                <LogOut size={14} aria-hidden="true" />
                別アカウントへ切替
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
