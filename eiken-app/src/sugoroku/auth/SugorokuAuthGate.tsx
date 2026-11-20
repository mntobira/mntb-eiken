/**
 * ===================================================================
 * すごろく塾ログイン ＆ クラス招待コード承認ゲート UI（SugorokuAuthGate）
 * ===================================================================
 * マナトビ純正デザインシステム（tokens.css / system.css / TobiraBuddy / KineticText / MoRipple）
 * に完全準拠した塾生専用エントリーゲート。
 *
 * 要件（『03_AI並列開発指示書』AI 4 タスク1）：
 *   1. Google アカウントログイン必須化（高校1人1台 iPad 等の学校アカウント・個人アカウント双方対応）
 *   2. 学校 iPad Safari 等でポップアップがブロックされた際のリダイレクト方式切替ボタン＆ドラフト状態保持
 *   3. 初回「すごろく招待コード（6文字クラス参加コード）」タクタイル6連スロット入力・全角自動変換・URL自動補完
 *   4. 共有範囲（講師のみ閲覧・一般公開ランキングには実名非表示）の明示と保護者/本人同意チェック
 *   5. 参加完了と同時に Ad-Free（広告完全非表示）を有効化して本編へ遷移（退塾 active===false 時は即時失効）
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { FIREBASE_CONFIGURED, USE_EMULATORS } from '../../firebase';
import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import { JOIN_CODE_LENGTH } from '../../utils/classroomCore';
import { isInAppBrowser } from '../../utils/googleAuth';
import { useSignInGuard } from '../../hooks/useSignInGuard';
import { useSuppressBannerAd } from '../../utils/adSuppress';
import { GoogleMark } from '../../components/GoogleLinkBanner';
import { TobiraBuddy } from '../../components/TobiraBuddy';
import { ListSkeleton } from '../../components/ui';
import { KineticText, installRipple } from '../../motion';
import {
  extractInviteCodeFromSearch,
  hasVerifiedPreAuthorizedInstructorEmail,
  isActiveSugorokuStaff,
  isSafariOrIPadBrowser,
  normalizeSugorokuInviteCode,
} from './sugorokuAuthCore';
import {
  loadSugorokuInviteDraft,
  redeemSugorokuInviteCode,
  saveSugorokuInviteDraft,
  signInSugorokuWithGoogle,
  signOutGoogle,
  triggerGoogleRedirectSignIn,
  type SugorokuSignInResult,
} from './sugorokuAuthService';
import { useBrowserOnline, useSugorokuAuthState } from './useSugorokuAuth';
import './sugoroku-auth.css';

export interface SugorokuAuthGateProps {
  children: React.ReactNode;
  /** 常にゲートを強制するか（省略時は true。App.tsx 側では ?portal=sugoroku|juku のとき true を渡す） */
  enforce?: boolean;
}

export function SugorokuAuthGate({
  children,
  enforce = true,
}: SugorokuAuthGateProps) {
  const { user, loading, status, refresh } = useSugorokuAuthState();

  if (!enforce) {
    return <>{children}</>;
  }

  const onlineReady = FIREBASE_CONFIGURED || USE_EMULATORS;

  // ログイン済み かつ 停止されておらず（すごろく塾クラス在籍済み・講師/運営ロール・または事前承認済み講師メール）なら本編を表示
  const isPreAuthorizedInstructor =
    user != null &&
    hasVerifiedPreAuthorizedInstructorEmail({
      email: user.email,
      emailVerified: user.emailVerified,
      providerIds: (user.providerData || []).map((p) => p.providerId),
    });

  if (
    user &&
    !status.isSuspended &&
    (status.isEnrolledInJuku || isActiveSugorokuStaff(status.memberDoc) || isPreAuthorizedInstructor)
  ) {
    return <>{children}</>;
  }

  return (
    <SugorokuGateScreen
      user={user}
      loading={loading}
      isSuspended={status.isSuspended}
      onlineReady={onlineReady}
      onEnrolled={async () => {
        await refresh();
      }}
    />
  );
}

interface SugorokuGateScreenProps {
  user: ReturnType<typeof useSugorokuAuthState>['user'];
  loading: boolean;
  isSuspended?: boolean;
  onlineReady: boolean;
  onEnrolled: () => Promise<void>;
}

export function SugorokuGateScreen({
  user,
  loading,
  isSuspended = false,
  onEnrolled,
}: SugorokuGateScreenProps) {
  // ゲート画面表示中もバナー広告を 100% 抑止
  useSuppressBannerAd();

  // マナトビ純正の押下リップルを有効化
  useEffect(() => installRipple(), []);

  const browserOnline = useBrowserOnline();
  const { busy: signing, anyBusy, run: runSignIn } = useSignInGuard();
  const [authError, setAuthError] = useState('');
  const [showRedirectHint, setShowRedirectHint] = useState(() => isSafariOrIPadBrowser());
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [codeFocused, setCodeFocused] = useState(false);

  // 初期値：URL クエリ（?invite=XXXXXX）またはリダイレクト前ドラフトから復元
  const initialDraft = useMemo(() => {
    const saved = loadSugorokuInviteDraft();
    const urlCode =
      typeof window !== 'undefined' ? extractInviteCodeFromSearch(window.location.search) : '';
    return {
      inviteCode: urlCode || saved?.inviteCode || '',
      displayName: saved?.displayName || user?.displayName || '',
      targetGrade: saved?.targetGrade || ('eiken_2' as EikenGrade),
      consentAccepted: saved?.consentAccepted ?? false,
    };
  }, [user?.displayName]);

  const [inviteCode, setInviteCode] = useState(initialDraft.inviteCode);
  const [displayName, setDisplayName] = useState(initialDraft.displayName);
  const [targetGrade, setTargetGrade] = useState<EikenGrade>(initialDraft.targetGrade);
  const [consentAccepted, setConsentAccepted] = useState(initialDraft.consentAccepted);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [joinedNotice, setJoinedNotice] = useState('');

  // ログイン後に displayName が空なら Google 表示名を初期補完
  useEffect(() => {
    if (user?.displayName && !displayName) {
      setDisplayName(user.displayName.slice(0, 24));
    }
  }, [user?.displayName, displayName]);

  const inApp = isInAppBrowser();
  const normalizedCode = normalizeSugorokuInviteCode(inviteCode);
  const codeReady = normalizedCode.length === JOIN_CODE_LENGTH;
  const canSubmitInvite = codeReady && consentAccepted && !submittingCode && browserOnline;

  // とびら君の表情と案内メッセージ（状態に応じて生き生きと変化）
  const buddyMessage = useMemo(() => {
    if (!browserOnline) {
      return 'インターネット接続が切れているみたい。Wi-Fi を確かめてね！';
    }
    if (isSuspended) {
      return 'このアカウントの塾在籍ステータスが停止中になっているよ。担当の先生に確認してね。';
    }
    if (loading) {
      return 'すごろく塾の扉を準備しているよ…ちょっと待ってね！';
    }
    if (!user) {
      if (authError) {
        return 'ポップアップが止まったときは、下の「iPad / Safari 用切替」ボタンでそのまま入れるよ！';
      }
      return 'すごろく塾へようこそ！まずは Google アカウントで扉をひらこう！';
    }
    if (joinedNotice) {
      return '参加完了！広告なしの4技能トレーニングへ出発しよう！';
    }
    if (codeError) {
      return 'コードもう一度確かめてみてね。0とO、1とIは自動で直すよ！';
    }
    if (codeReady && !consentAccepted) {
      return '6文字ばっちり！最後に下の共有確認チェックを入れてスタートしよう！';
    }
    if (codeReady && consentAccepted) {
      return '準備完了！「すごろく塾クラスに参加する」を押して始めよう！';
    }
    return '先生から届いた6文字の「すごろく招待コード」を入力してね！';
  }, [
    browserOnline,
    isSuspended,
    loading,
    user,
    authError,
    joinedNotice,
    codeError,
    codeReady,
    consentAccepted,
  ]);

  const persistDraftBeforeAuth = () => {
    saveSugorokuInviteDraft({
      inviteCode: normalizedCode,
      displayName,
      targetGrade,
      consentAccepted,
    });
  };

  const handlePopupLogin = async () => {
    setAuthError('');
    persistDraftBeforeAuth();
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
    persistDraftBeforeAuth();
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
        rawCode: normalizedCode,
        displayName: displayName || user?.displayName || '',
        targetGrade,
        consentAccepted,
      });
      setJoinedNotice(`「${res.joinResult.classroom.className}」への参加が完了しました！`);
      await onEnrolled();
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : '招待コードの確認に失敗しました。');
    } finally {
      setSubmittingCode(false);
    }
  };

  const step1State: 'active' | 'done' = user ? 'done' : 'active';
  const step2State: 'todo' | 'active' | 'done' = !user
    ? 'todo'
    : joinedNotice
      ? 'done'
      : 'active';

  return (
    <main data-testid="sugoroku-auth-gate" className="sga-screen">
      <div className="sga-shell">
        {/* 1. ヘッダー ＆ とびら君案内 */}
        <section className="sga-hero-card sga-stagger-1" aria-label="すごろく塾 案内">
          <div className="sga-hero-top">
            <span className="sga-kicker-pill">
              <Sparkles size={13} aria-hidden="true" />
              すごろく塾 専用Web版
            </span>
          </div>

          <h1 className="sga-hero-title">
            <KineticText text="マナトビ英検 塾生ゲート" variant="rise" />
          </h1>
          <p className="sga-hero-sub">
            iPad・スマホ・PC で学習履歴を同期する塾生専用の4技能学習画面
          </p>

          <div className="sga-perks-row" aria-label="塾生専用仕様">
            <span className="sga-perk-chip">
              <VolumeX size={13} aria-hidden="true" />
              広告 100% 完全非表示
            </span>
            <span className="sga-perk-chip">
              <ShieldCheck size={13} aria-hidden="true" />
              公開面は実名非表示
            </span>
          </div>

          <div className="sga-buddy-wrap">
            <TobiraBuddy
              size="sm"
              bubble="right"
              input={{
                screen: 'home',
                firstVisit: !user,
                isGuest: !user,
                outcome: joinedNotice ? 'win' : authError || codeError ? 'lose' : undefined,
              }}
              line={buddyMessage}
            />
          </div>
        </section>

        {/* 2. 2ステップ進行インジケーター */}
        <nav className="sga-stepper sga-stagger-2" aria-label="参加ステップ">
          <div className="sga-step-item" data-state={step1State}>
            <span className="sga-step-num" aria-hidden="true">
              {step1State === 'done' ? <Check size={15} strokeWidth={3} /> : '1'}
            </span>
            <span className="sga-step-label">
              <strong>Google 認証</strong>
              <small>{user ? 'ログイン済み' : '学校iPad・個人可'}</small>
            </span>
          </div>

          <div className="sga-step-connector" data-done={step1State === 'done'} aria-hidden="true" />

          <div className="sga-step-item" data-state={step2State}>
            <span className="sga-step-num" aria-hidden="true">
              {step2State === 'done' ? <Check size={15} strokeWidth={3} /> : '2'}
            </span>
            <span className="sga-step-label">
              <strong>招待コード参加</strong>
              <small>{JOIN_CODE_LENGTH}文字コード＆同意</small>
            </span>
          </div>
        </nav>

        {/* 3. メイン操作カード */}
        <section className="sga-main-card sga-stagger-3">
          {!browserOnline && (
            <div role="alert" className="sga-warn-box flex items-start gap-2.5">
              <WifiOff size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold">オフライン状態です</p>
                <p className="mt-0.5">
                  校内 Wi-Fi またはご自宅の通信状況をご確認のうえ、オンラインに復帰してからお試しください。
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div aria-busy="true">
              <ListSkeleton rows={3} rowHeight={58} label="認証状態とクラス在籍を確認しています…" />
            </div>
          ) : !user ? (
            /* ==================== Step 1: Google ログイン ==================== */
            <div className="flex flex-col gap-3.5" aria-label="Google アカウントログイン">
              <div className="sga-info-box">
                <p className="font-bold mb-1">ステップ 1：Google アカウントでログイン</p>
                <p>
                  学校配布 iPad の Google Workspace アカウント、または個人の Gmail アカウントのどちらでも利用できます。
                </p>
              </div>

              {normalizedCode && (
                <div className="sga-done-box flex items-center justify-between gap-2">
                  <span>
                    招待コード「<b className="tracking-widest">{normalizedCode}</b>」を受け取りました。ログイン後に自動で入力されます。
                  </span>
                </div>
              )}

              {inApp && (
                <div role="alert" className="sga-warn-box flex items-start gap-2.5">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
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
                disabled={anyBusy || !browserOnline}
                className="sga-google-btn"
              >
                {signing ? (
                  <>
                    <Loader2 size={19} className="animate-spin" aria-hidden="true" />
                    <span>Google 認証を確認中…</span>
                  </>
                ) : (
                  <>
                    <GoogleMark size={20} />
                    <span>Google アカウントでログイン</span>
                  </>
                )}
              </button>

              {/* 学校 iPad Safari 等でのポップアップブロック対策：同一タブリダイレクト切替 */}
              {showRedirectHint && (
                <div className="sga-info-box flex flex-col gap-2.5">
                  <p>
                    <b>iPad / iPhone（Safari）でログイン画面が開かないとき：</b>
                    学校の端末制限等でポップアップが止まっている場合は、下のボタンから同じタブのままでログインできます。
                  </p>
                  <button
                    type="button"
                    data-testid="sugoroku-google-redirect-btn"
                    onClick={handleRedirectLogin}
                    disabled={anyBusy || !browserOnline}
                    className="sga-secondary-btn w-full"
                  >
                    <ExternalLink size={15} aria-hidden="true" />
                    <span>iPad / Safari 用：画面遷移（リダイレクト）でログイン</span>
                  </button>
                </div>
              )}

              {authError && (
                <div role="alert" className="sga-error-box flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{authError}</span>
                </div>
              )}
            </div>
          ) : (
            /* ==================== Step 2: 招待コード＆同意 ==================== */
            <form onSubmit={handleRedeemInvite} className="flex flex-col gap-4" aria-label="すごろく招待コード入力">
              {/* ログイン中アカウントバー */}
              <div className="sga-account-bar">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#5a6573]">ログイン中の Google アカウント</p>
                  <p className="truncate text-sm font-bold text-[#1c2a39]">
                    {user.email || user.displayName || user.uid}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void signOutGoogle()}
                  className="sga-secondary-btn shrink-0"
                >
                  <LogOut size={14} aria-hidden="true" />
                  <span>切替</span>
                </button>
              </div>

              {isSuspended && (
                <div role="alert" className="sga-error-box flex items-start gap-2.5">
                  <Lock size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-bold">現在このアカウントの塾在籍が停止されています</p>
                    <p className="mt-0.5">
                      新しいクラスの招待コードを受け取っている場合は下から再参加するか、担当講師へお問い合わせください。
                    </p>
                  </div>
                </div>
              )}

              {/* 6連タクタイル招待コードスロット */}
              <div className="sga-code-field-wrap">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="sugoroku-invite-input"
                    className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#1c2a39]"
                  >
                    <KeyRound size={16} className="text-[#2458a6]" aria-hidden="true" />
                    <span>すごろく招待コード（{JOIN_CODE_LENGTH}文字）</span>
                  </label>
                  {normalizedCode.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setInviteCode('');
                        setCodeError('');
                        codeInputRef.current?.focus();
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#5a6573] hover:text-[#1c2a39] min-h-[32px] px-2"
                    >
                      <RotateCcw size={12} aria-hidden="true" />
                      クリア
                    </button>
                  )}
                </div>

                <div
                  className="sga-code-stage"
                  onClick={() => codeInputRef.current?.focus()}
                >
                  <div className="sga-code-slots" aria-hidden="true">
                    {Array.from({ length: JOIN_CODE_LENGTH }, (_, idx) => {
                      const ch = normalizedCode[idx] || '';
                      const isCurrentSlot =
                        codeFocused &&
                        (idx === normalizedCode.length ||
                          (normalizedCode.length === JOIN_CODE_LENGTH && idx === JOIN_CODE_LENGTH - 1));
                      return (
                        <div
                          key={idx}
                          className="sga-code-slot"
                          data-filled={Boolean(ch)}
                          data-active={isCurrentSlot}
                        >
                          {ch || '·'}
                        </div>
                      );
                    })}
                  </div>

                  <input
                    ref={codeInputRef}
                    id="sugoroku-invite-input"
                    data-testid="sugoroku-invite-input"
                    type="text"
                    value={normalizedCode}
                    onFocus={() => setCodeFocused(true)}
                    onBlur={() => setCodeFocused(false)}
                    onChange={(e) => {
                      setCodeError('');
                      setInviteCode(normalizeSugorokuInviteCode(e.target.value));
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData?.getData('text') || '';
                      if (pasted) {
                        e.preventDefault();
                        setCodeError('');
                        setInviteCode(normalizeSugorokuInviteCode(pasted));
                      }
                    }}
                    maxLength={20}
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="one-time-code"
                    spellCheck={false}
                    aria-label={`すごろく招待コード ${JOIN_CODE_LENGTH}文字`}
                    placeholder="AB23CD"
                    className="sga-code-native-input"
                  />
                </div>

                <p className="text-xs text-[#5a6573]">
                  先生から配布された{JOIN_CODE_LENGTH}文字を入力（コピー＆ペースト可／全角文字や 0・O、1・I の見間違いは自動で補正します）。
                </p>
              </div>

              {/* ニックネーム＆目標級 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sugoroku-student-name" className="block text-xs font-extrabold text-[#1c2a39] mb-1">
                    アプリ内ニックネーム
                  </label>
                  <input
                    id="sugoroku-student-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={24}
                    placeholder="例: たくみ（本名でなくてOK）"
                    className="sga-input"
                  />
                </div>
                <div>
                  <label htmlFor="sugoroku-target-grade" className="block text-xs font-extrabold text-[#1c2a39] mb-1">
                    現在の目標級
                  </label>
                  <select
                    id="sugoroku-target-grade"
                    value={targetGrade}
                    onChange={(e) => setTargetGrade(e.target.value as EikenGrade)}
                    className="sga-select"
                  >
                    {EIKEN_GRADES.filter((g) => g.available).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 共有範囲の透明表示 ＆ 同意チェック */}
              <div className="sga-consent-card">
                <div className="sga-privacy-grid">
                  <div className="sga-privacy-pill">
                    <strong>担当講師に共有される内容</strong>
                    日々の学習時間・単元別の進捗と正答率・提出した英作文とスピーキング録音
                  </div>
                  <div className="sga-privacy-pill">
                    <strong>プライバシー保護の約束</strong>
                    実名は講師管理画面内のみで扱われ、公開ランキング等に本名は一切表示されません
                  </div>
                </div>

                <label
                  htmlFor="sugoroku-consent-checkbox"
                  className="sga-consent-check"
                  data-checked={consentAccepted}
                >
                  <input
                    id="sugoroku-consent-checkbox"
                    data-testid="sugoroku-consent-checkbox"
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                  />
                  <span className="text-xs font-bold leading-relaxed text-[#1c2a39]">
                    上記の学習記録・提出答案を担当クラスの先生へ共有することに同意します（高校生・中学生の方は保護者の方と一緒にご確認ください）
                  </span>
                </label>
              </div>

              {codeError && (
                <div role="alert" className="sga-error-box flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{codeError}</span>
                </div>
              )}

              {joinedNotice && (
                <div role="status" className="sga-done-box flex items-center gap-2">
                  <Check size={16} className="shrink-0" aria-hidden="true" />
                  <span>{joinedNotice}</span>
                </div>
              )}

              <button
                type="submit"
                data-testid="sugoroku-redeem-submit-btn"
                disabled={!canSubmitInvite}
                className="sga-primary-btn"
              >
                {submittingCode ? (
                  <>
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    <span>招待コードを確認しています…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} aria-hidden="true" />
                    <span>すごろく塾クラスに参加して学習を始める</span>
                  </>
                )}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
