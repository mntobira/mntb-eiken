/**
 * すごろく塾ログイン ＆ クラス招待コード承認ゲート UI（SugorokuAuthGate）
 *
 * 要件（『03_AI並列開発指示書』AI 4 タスク1）：
 *   1. Google アカウントログイン必須化（高校1人1台 iPad 等の学校アカウント・個人アカウント双方対応）
 *   2. 学校 iPad Safari 等でポップアップがブロックされた際のリダイレクト方式切替ボタン＆案内
 *   3. 初回「すごろく招待コード（クラス参加コード）」入力・同意画面（保護者・本人同意＋共有範囲の透明表示）
 *   4. 参加完了と同時に Ad-Free（広告完全非表示）を有効化して本編へ遷移
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { FIREBASE_CONFIGURED, USE_EMULATORS } from '../../firebase';
import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import { JOIN_CODE_LENGTH } from '../../utils/classroomCore';
import { isInAppBrowser } from '../../utils/googleAuth';
import { useSignInGuard } from '../../hooks/useSignInGuard';
import { useSuppressBannerAd } from '../../utils/adSuppress';
import { GoogleMark } from '../../components/GoogleLinkBanner';
import {
  isActiveSugorokuStaff,
  isSafariOrIPadBrowser,
  normalizeSugorokuInviteCode,
} from './sugorokuAuthCore';
import {
  redeemSugorokuInviteCode,
  signInSugorokuWithGoogle,
  signOutGoogle,
  triggerGoogleRedirectSignIn,
  type SugorokuSignInResult,
} from './sugorokuAuthService';
import { useSugorokuAuthState } from './useSugorokuAuth';

export interface SugorokuAuthGateProps {
  children: React.ReactNode;
  /** 常にゲートを強制するか（省略時は ?portal=sugoroku|juku のときのみ強制し、通常モードでは素通し） */
  enforce?: boolean;
  /** デモ環境（Firebase未設定時）に試作プレビュー入場を許可するか（既定: true） */
  allowDemoPreviewWhenUnconfigured?: boolean;
}

export function SugorokuAuthGate({
  children,
  enforce = true,
  allowDemoPreviewWhenUnconfigured = true,
}: SugorokuAuthGateProps) {
  const { user, loading, status, refresh } = useSugorokuAuthState();
  const [demoBypassed, setDemoBypassed] = useState(false);

  if (!enforce) {
    return <>{children}</>;
  }

  const onlineReady = FIREBASE_CONFIGURED || USE_EMULATORS;
  if (!onlineReady && demoBypassed && allowDemoPreviewWhenUnconfigured) {
    return <>{children}</>;
  }

  // ログイン済み かつ（すごろく塾クラス在籍済み または 講師/運営ロール）なら本編を表示
  if (user && (status.isEnrolledInJuku || isActiveSugorokuStaff(status.memberDoc))) {
    return <>{children}</>;
  }

  return (
    <SugorokuGateScreen
      user={user}
      loading={loading}
      onlineReady={onlineReady}
      allowDemoBypass={!onlineReady && allowDemoPreviewWhenUnconfigured}
      onDemoBypass={() => setDemoBypassed(true)}
      onEnrolled={async () => {
        await refresh();
      }}
    />
  );
}

interface SugorokuGateScreenProps {
  user: ReturnType<typeof useSugorokuAuthState>['user'];
  loading: boolean;
  onlineReady: boolean;
  allowDemoBypass: boolean;
  onDemoBypass: () => void;
  onEnrolled: () => Promise<void>;
}

export function SugorokuGateScreen({
  user,
  loading,
  onlineReady,
  allowDemoBypass,
  onDemoBypass,
  onEnrolled,
}: SugorokuGateScreenProps) {
  // ゲート画面表示中もバナー広告を確実に抑止
  useSuppressBannerAd();

  const { busy: signing, anyBusy, run: runSignIn } = useSignInGuard();
  const [authError, setAuthError] = useState('');
  const [showRedirectHint, setShowRedirectHint] = useState(() => isSafariOrIPadBrowser());

  // 招待コード入力フォーム状態
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [targetGrade, setTargetGrade] = useState<EikenGrade>('eiken_2');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [joinedNotice, setJoinedNotice] = useState('');

  const inApp = isInAppBrowser();
  const normalizedCode = normalizeSugorokuInviteCode(inviteCode);
  const canSubmitInvite =
    normalizedCode.length === JOIN_CODE_LENGTH && consentAccepted && !submittingCode;

  const handlePopupLogin = async () => {
    setAuthError('');
    const res = (await runSignIn(() =>
      signInSugorokuWithGoogle({ autoRedirectOnBlock: false }),
    )) as SugorokuSignInResult;
    if (res.redirecting) return;
    if (!res.ok && !res.cancelled) {
      setAuthError(res.message || 'Google ログインに失敗しました。');
      if (res.popupBlockedOnSafari || res.canSwitchToRedirect) {
        setShowRedirectHint(true);
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

  const handleRedeemInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');
    setJoinedNotice('');
    setSubmittingCode(true);
    try {
      const res = await redeemSugorokuInviteCode({
        rawCode: inviteCode,
        displayName: displayName || user?.displayName || '',
        targetGrade,
        consentAccepted,
      });
      setJoinedNotice(`「${res.joinResult.classroom.className}」への参加が確認されました。`);
      await onEnrolled();
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : '招待コードの確認に失敗しました。');
    } finally {
      setSubmittingCode(false);
    }
  };

  return (
    <main
      data-testid="sugoroku-auth-gate"
      className="min-h-[100dvh] w-full bg-gradient-to-b from-[#F4F7FA] via-[#FDFBF7] to-[#EEF3F7] px-4 py-6 sm:py-10 flex items-center justify-center"
    >
      <div className="w-full max-w-md rounded-3xl border border-[#D5E1EC] bg-white p-5 sm:p-7 shadow-[0_20px_50px_-24px_rgba(27,38,49,0.28)]">
        {/* ブランドヘッダー */}
        <header className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF3FA] px-3 py-1 text-xs font-bold text-[#1F567D]">
            <Sparkles size={13} aria-hidden="true" />
            オンライン塾「すごろく」専用Web版
          </span>
          <h1 className="mt-3 text-xl sm:text-2xl font-bold text-[#1B2631]">
            マナトビ英検 塾生ゲート
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#5D6D7E]">
            塾クラス参加者限定（広告完全非表示・4技能対応）の学習環境です。
          </p>
        </header>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-sm text-[#5D6D7E]">
            <Loader2 size={22} className="animate-spin text-[#2E86C1]" aria-hidden="true" />
            <span>認証状態を確認しています…</span>
          </div>
        ) : !user ? (
          /* Step 1: Google アカウントログイン誘導 */
          <section className="mt-6 space-y-4" aria-label="Google アカウントログイン">
            <div className="rounded-2xl border border-[#E2ECF4] bg-[#F8FBFD] p-3.5 text-xs leading-relaxed text-[#34495E]">
              <p className="font-bold text-[#1B2631] mb-1">
                ステップ 1／2：Google アカウントでログイン
              </p>
              <p>
                高校配布の iPad アカウント（Google Workspace）または個人の Google アカウントでログインできます。
              </p>
            </div>

            {inApp && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-[#F5B041] bg-[#FEF9E7] p-3.5 text-xs leading-relaxed text-[#7D6608]"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#D68910]" aria-hidden="true" />
                <div>
                  <p className="font-bold">LINE・Instagram 等のアプリ内ブラウザではログインできません</p>
                  <p className="mt-0.5">
                    画面右上のメニューから「ブラウザで開く」を選び、<b>Safari</b> または <b>Chrome</b> で開き直してください。
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              data-testid="sugoroku-google-popup-btn"
              onClick={handlePopupLogin}
              disabled={anyBusy}
              className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-2xl border border-[#DADCE0] bg-white px-4 py-3 text-sm font-bold text-[#1B2631] shadow-sm transition hover:bg-[#F8F9FA] disabled:opacity-50"
            >
              {signing ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  ログイン処理中…
                </>
              ) : (
                <>
                  <GoogleMark size={20} />
                  Google アカウントでログイン
                </>
              )}
            </button>

            {/* 学校 iPad Safari 等でのポップアップブロック対策：リダイレクト切替ボタン */}
            {showRedirectHint && (
              <div className="rounded-2xl border border-[#D6EAF8] bg-[#F4F9FD] p-3.5 space-y-2">
                <p className="text-xs leading-relaxed text-[#2C5270]">
                  <b>iPad / iPhone（Safari）でログイン画面が開かない場合：</b>
                  ポップアップがブロックされている可能性があります。下のボタンから同じタブでのログインに切り替えられます。
                </p>
                <button
                  type="button"
                  data-testid="sugoroku-google-redirect-btn"
                  onClick={handleRedirectLogin}
                  disabled={anyBusy}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#85C1E9] bg-white px-3 py-2 text-xs font-bold text-[#1F618D] transition hover:bg-[#EBF5FB] disabled:opacity-50"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  iPad / Safari 用：画面遷移（リダイレクト）でログインする
                </button>
              </div>
            )}

            {authError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-[#E74C3C]/40 bg-[#FDEDEC] p-3.5 text-xs leading-relaxed text-[#C0392B]"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{authError}</span>
              </div>
            )}

            {allowDemoBypass && (
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-3.5 space-y-2">
                <p className="text-xs leading-relaxed text-[#4B5563]">
                  現在はクラウド未接続の試作プレビュー環境です。実画面確認用にこのまま生徒画面へ進めます。
                </p>
                <button
                  type="button"
                  data-testid="sugoroku-demo-preview-btn"
                  onClick={onDemoBypass}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#1F567D] px-3 py-2 text-xs font-bold text-white hover:bg-[#174362]"
                >
                  試作デモ画面をプレビューする
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </section>
        ) : (
          /* Step 2: 初回「すごろく招待コード（クラス参加コード）」入力・同意画面 */
          <form onSubmit={handleRedeemInvite} className="mt-6 space-y-4" aria-label="すごろく招待コード入力">
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#E2ECF4] bg-[#F8FBFD] px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-[11px] text-[#6B7280]">ログイン中の Google アカウント</p>
                <p className="truncate text-xs font-bold text-[#1B2631]">
                  {user.email || user.displayName || user.uid}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void signOutGoogle()}
                className="shrink-0 inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-[#5D6D7E] hover:bg-gray-50"
              >
                <LogOut size={12} aria-hidden="true" />
                切替
              </button>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sugoroku-invite-input" className="flex items-center gap-1.5 text-xs font-bold text-[#1B2631]">
                <KeyRound size={14} className="text-[#1F567D]" aria-hidden="true" />
                ステップ 2／2：すごろく招待コード（{JOIN_CODE_LENGTH}文字）
              </label>
              <input
                id="sugoroku-invite-input"
                data-testid="sugoroku-invite-input"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(normalizeSugorokuInviteCode(e.target.value))}
                maxLength={16}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="例: AB23CD"
                className="w-full min-h-[48px] rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-2.5 text-center text-base font-bold tracking-[0.25em] text-[#1B2631] uppercase focus:border-[#2E86C1] focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] leading-snug text-[#64748B]">
                先生から案内された{JOIN_CODE_LENGTH}文字の招待コードを入力してください（Oと0、Iと1は自動補正されます）。
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="sugoroku-student-name" className="block text-xs font-bold text-[#1B2631] mb-1">
                  アプリ内ニックネーム
                </label>
                <input
                  id="sugoroku-student-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={24}
                  placeholder="例: たくみ"
                  className="w-full min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#1B2631] focus:border-[#2E86C1] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="sugoroku-target-grade" className="block text-xs font-bold text-[#1B2631] mb-1">
                  目標の英検級
                </label>
                <select
                  id="sugoroku-target-grade"
                  value={targetGrade}
                  onChange={(e) => setTargetGrade(e.target.value as EikenGrade)}
                  className="w-full min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#1B2631] focus:border-[#2E86C1] focus:outline-none"
                >
                  {EIKEN_GRADES.filter((g) => g.available).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* プライバシー保護・情報共有範囲の明示と同意チェック */}
            <div className="rounded-2xl border border-[#D9E4EC] bg-[#F4F7FA] p-3.5 space-y-2 text-xs text-[#334E68]">
              <p className="flex items-center gap-1.5 font-bold text-[#1B2631]">
                <ShieldCheck size={15} className="text-[#1F567D]" aria-hidden="true" />
                プライバシー保護と共有される学習データの確認
              </p>
              <ul className="space-y-1 text-[11px] leading-relaxed">
                <li>・<b>すごろく担当講師に共有される内容：</b>級・技能別の有効学習時間、宿題の進捗・正答数、提出したライティング答案・スピーキング録音</li>
                <li>・<b>実名の保護：</b>公開ランキング等に本名や学校名は一切表示されません（講師専用の管理画面内でのみ名簿名を安全に管理します）。</li>
                <li>・<b>広告完全非表示：</b>塾クラス参加中はアプリ内の広告がすべて非表示（Ad-Free）になります。</li>
              </ul>
              <label className="mt-2 flex items-start gap-2 pt-1.5 border-t border-[#D9E4EC] cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="sugoroku-consent-checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#1F567D]"
                />
                <span className="text-xs font-bold leading-snug text-[#1B2631]">
                  上記の内容（16歳未満の場合は保護者の同意を含む）を確認し、すごろく塾クラスへ参加します
                </span>
              </label>
            </div>

            {codeError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-[#E74C3C]/40 bg-[#FDEDEC] p-3 text-xs leading-relaxed text-[#C0392B]"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{codeError}</span>
              </div>
            )}

            {joinedNotice && (
              <div className="flex items-start gap-2 rounded-2xl border border-[#A9E0D8] bg-[#F5FCFA] p-3 text-xs leading-relaxed text-[#2F7C74]">
                <Check size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{joinedNotice}</span>
              </div>
            )}

            <button
              type="submit"
              data-testid="sugoroku-invite-submit-btn"
              disabled={!canSubmitInvite}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#1F567D] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#174362] disabled:opacity-40"
            >
              {submittingCode ? (
                <>
                  <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                  招待コードを確認中…
                </>
              ) : (
                <>
                  招待コードで参加して学習を始める
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void onEnrolled()}
              className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-[#5D6D7E] hover:bg-gray-100"
            >
              <RefreshCw size={13} aria-hidden="true" />
              すでに参加済みの方：在籍状況を再確認する
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
