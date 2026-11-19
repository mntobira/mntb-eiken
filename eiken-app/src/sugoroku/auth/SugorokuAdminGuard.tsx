/**
 * ===================================================================
 * すごろく塾 管理者ポータル認可ガード UI（SugorokuAdminGuard）
 * ===================================================================
 * マナトビ純正デザインシステム（tokens.css / system.css / TobiraBuddy / KineticText / MoRipple）
 * に準拠した講師・管理者専用ゲート。
 *
 * 『03_AI並列開発指示書』第1章・第3章 AI 4 タスク2:
 *   - sugoroku_members/{uid} の role in ['owner', 'staff'] またはクラス teacherUid のみが
 *     管理者ポータル・生徒実名（rosterName）・提出物を扱える認可ガードを提供する。
 *   - 未ログイン時は Google ログイン（iPad Safari リダイレクト切替対応）を案内し、
 *     生徒アカウント・部外者アカウント・停止済みアカウントでのアクセスは明確に遮断する。
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { FIREBASE_CONFIGURED, USE_EMULATORS } from '../../firebase';
import { useSignInGuard } from '../../hooks/useSignInGuard';
import { GoogleMark } from '../../components/GoogleLinkBanner';
import { TobiraBuddy } from '../../components/TobiraBuddy';
import { ListSkeleton, RarityBadge } from '../../components/ui';
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
  /** Firebase未設定時の試作デモモードでプレビュー表示を許可するか（既定: true） */
  allowDemoModeWhenUnconfigured?: boolean;
}

export function SugorokuAdminGuard({
  children,
  onBackToStudentApp,
  allowDemoModeWhenUnconfigured = true,
}: SugorokuAdminGuardProps) {
  useSuppressBannerAd();
  useEffect(() => installRipple(), []);

  const browserOnline = useBrowserOnline();
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

  const buddyLine = checking
    ? '講師アカウントの権限を確かめているよ…'
    : !user
      ? 'ここは先生専用の管理ポータルだよ。登録済みの Google アカウントでログインしてね！'
      : 'このアカウントには講師権限がまだ登録されていないみたい。講師用アカウントに切り替えてね。';

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
              <span>生徒の学習画面へ戻る</span>
            </button>
          </div>
        )}

        <section className="sga-hero-card sga-stagger-1" aria-label="講師専用ポータル案内">
          <div className="sga-hero-top">
            <span className="sga-kicker-pill">
              <Lock size={13} aria-hidden="true" />
              SUGOROKU INSTRUCTOR PORTAL
            </span>
            <RarityBadge rarity="SR" label="講師・管理者専用" />
          </div>

          <h1 className="sga-hero-title">
            <KineticText text="すごろく塾 講師・管理者ポータル" variant="rise" />
          </h1>
          <p className="sga-hero-sub">
            生徒の実名（名簿名）・個別学習ログ・提出英作文・S-CBT録音データを安全に保護するため、認可された講師アカウントのみ入場できます。
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
              <ListSkeleton rows={2} rowHeight={58} label="講師ロールと担当クラスを確認しています…" />
            </div>
          ) : !user ? (
            <div className="flex flex-col gap-3.5">
              <div className="sga-info-box">
                <p className="font-bold mb-1">入場条件</p>
                <p>
                  すごろく運営で <code>owner</code> / <code>staff</code> ロールが付与されているアカウント、または担当クラス（<code>teacherUid</code>）を持つ Google アカウントでログインしてください。
                </p>
              </div>

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
                    <span>講師権限を認証中…</span>
                  </>
                ) : (
                  <>
                    <GoogleMark size={20} />
                    <span>講師用 Google アカウントでログイン</span>
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
                  <span>iPad / Safari 用：画面遷移（リダイレクト）でログイン</span>
                </button>
              )}

              {authError && (
                <div role="alert" className="sga-error-box flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{authError}</span>
                </div>
              )}

              {!onlineReady && allowDemoModeWhenUnconfigured && (
                <div className="pt-2 border-t border-[#e3d9c8] flex flex-col gap-2">
                  <p className="text-xs text-[#5a6573]">
                    現在はクラウド未接続の検証環境のため、サンプル生徒データを用いたデモモードで管理者ポータルを確認できます。
                  </p>
                  <button
                    type="button"
                    data-testid="sugoroku-admin-demo-btn"
                    onClick={() => setDemoUnlocked(true)}
                    className="sga-primary-btn"
                  >
                    <ShieldCheck size={17} aria-hidden="true" />
                    <span>デモデータモードで管理者ポータルを開く</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3.5" role="alert">
              <div className="sga-error-box flex items-start gap-2.5">
                <ShieldAlert size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-extrabold">このアカウントには講師・管理者権限がありません</p>
                  <p className="mt-1">
                    ログイン中: <b>{user.email || user.uid}</b>
                  </p>
                  <p className="mt-1">
                    診断結果: {describeAdminDenyReason(reason)}（判定コード: <code>{reason}</code>）
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => void recheck()}
                  className="sga-secondary-btn w-full"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  <span>権限を再確認する</span>
                </button>
                <button
                  type="button"
                  onClick={() => void signOutGoogle()}
                  className="sga-primary-btn"
                >
                  <LogOut size={15} aria-hidden="true" />
                  <span>別アカウントへ切替</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
