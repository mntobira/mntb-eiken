/**
 * ===================================================================
 * すごろく塾 管理者ポータル認可ガード UI（SugorokuAdminGuard）
 * ===================================================================
 * マナトビ純正デザインシステム（tokens.css / system.css / TobiraBuddy / KineticText / MoRipple）
 * に準拠した講師・管理者専用ログインゲート。
 *
 * セキュリティ原則：
 *   - 画面上に具体的な管理者メールアドレスや内部ロール名・テーブル名は一切露出しない。
 *   - デモバイパス（未認証入場ボタン）は置かず、正規の Google アカウント認証と権限照合のみを通す。
 */

import React, { useEffect, useState } from 'react';
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
import { useSignInGuard } from '../../hooks/useSignInGuard';
import { GoogleMark } from '../../components/GoogleLinkBanner';
import { TobiraBuddy } from '../../components/TobiraBuddy';
import { ListSkeleton } from '../../components/ui';
import { KineticText, installRipple } from '../../motion';
import { useSuppressBannerAd } from '../../utils/adSuppress';
import {
  describeAdminDenyReason,
  isSafariOrIPadBrowser,
} from './sugorokuAuthCore';
import {
  signInSugorokuWithGoogle,
  signOutGoogle,
  triggerGoogleRedirectSignIn,
  type SugorokuSignInResult,
} from './sugorokuAuthService';
import { useBrowserOnline, useSugorokuAdminGuard } from './useSugorokuAuth';
import './sugoroku-auth.css';

export interface SugorokuAdminGuardProps {
  children: React.ReactNode;
  onBackToStudentApp?: () => void;
}

export function SugorokuAdminGuard({
  children,
  onBackToStudentApp,
}: SugorokuAdminGuardProps) {
  useSuppressBannerAd();
  useEffect(() => installRipple(), []);

  const browserOnline = useBrowserOnline();
  const { user, checking, allowed, reason, recheck } = useSugorokuAdminGuard();
  const { busy: signing, anyBusy, run: runSignIn } = useSignInGuard();
  const [authError, setAuthError] = useState('');
  const [showRedirect, setShowRedirect] = useState(() => isSafariOrIPadBrowser());

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
      setAuthError(res.message || 'ログインを開始できませんでした。');
    }
  };

  const buddyLine = checking
    ? 'アカウントを確認しているよ…'
    : !user
      ? '先生・管理者専用のログイン画面だよ。Google アカウントでログインしてね。'
      : 'このアカウントは管理者として登録されていないみたい。別のアカウントに切り替えてね。';

  return (
    <main data-testid="sugoroku-admin-guard" className="sga-screen">
      <div className="sga-shell">
        {onBackToStudentApp && (
          <div>
            <button
              type="button"
              onClick={onBackToStudentApp}
              className="sga-secondary-btn"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>戻る</span>
            </button>
          </div>
        )}

        <section className="sga-hero-card sga-stagger-1" aria-label="管理者ログイン">
          <div className="sga-hero-top">
            <span className="sga-kicker-pill">
              <Lock size={13} aria-hidden="true" />
              管理者専用
            </span>
          </div>

          <h1 className="sga-hero-title">
            <KineticText text="管理者ログイン" variant="rise" />
          </h1>
          <p className="sga-hero-sub">
            講師・管理者用の Google アカウントでログインしてください。
          </p>

          <div className="sga-buddy-wrap">
            <TobiraBuddy
              size="sm"
              bubble="right"
              input={{
                screen: 'home',
                isGuest: !user,
                outcome: user && !allowed ? 'lose' : undefined,
              }}
              line={buddyLine}
            />
          </div>
        </section>

        <section className="sga-main-card sga-stagger-2">
          {checking ? (
            <div aria-busy="true">
              <ListSkeleton rows={2} rowHeight={58} label="認証情報を確認しています…" />
            </div>
          ) : !user ? (
            <div className="flex flex-col gap-3.5">
              <button
                type="button"
                data-testid="sugoroku-admin-login-btn"
                onClick={handleLogin}
                disabled={anyBusy || !browserOnline}
                className="sga-google-btn"
              >
                {signing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    <span>認証中…</span>
                  </>
                ) : (
                  <>
                    <GoogleMark size={20} />
                    <span>Google アカウントでログイン</span>
                  </>
                )}
              </button>

              {showRedirect && (
                <button
                  type="button"
                  data-testid="sugoroku-admin-redirect-btn"
                  onClick={handleRedirectLogin}
                  disabled={anyBusy || !browserOnline}
                  className="sga-secondary-btn w-full"
                >
                  <ExternalLink size={15} aria-hidden="true" />
                  <span>iPad / Safari で画面が開かないときはこちら</span>
                </button>
              )}

              {authError && (
                <div role="alert" className="sga-error-box flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{authError}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3.5" role="alert">
              <div className="sga-error-box flex items-start gap-2.5">
                <ShieldAlert size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-extrabold">管理者権限が確認できませんでした</p>
                  <p className="mt-1">
                    ログイン中: <b>{user.email || user.displayName || 'Google アカウント'}</b>
                  </p>
                  <p className="mt-1">{describeAdminDenyReason(reason)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => void recheck()}
                  className="sga-secondary-btn w-full"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  <span>再確認する</span>
                </button>
                <button
                  type="button"
                  onClick={() => void signOutGoogle()}
                  className="sga-primary-btn"
                >
                  <LogOut size={15} aria-hidden="true" />
                  <span>別アカウントでログイン</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
