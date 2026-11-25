import { useCallback, useEffect, useRef, useState } from 'react';
import { AlphaCinematicClip, ALPHA_CINEMATIC_CLIPS, FULLFRAME_CINEMATIC_MOVIES } from './AlphaCinematicClip';
import { TitleBgmMuteButton, TITLE_SCREEN_BGM_SRC, useLaunchTitleBgm } from './TitleBgmControl';
import { ArrowRight, BookHeart, Headphones, PenLine, Play, Repeat2, Swords } from 'lucide-react';
import { PhilosophyPage } from './PhilosophyPage';
import { useGrowthProgress } from '../hooks/useGrowthProgress';
import { equippedPoseSrc } from '../battle/core/growth';
import { TobiraAccessories } from '../battle/ui/TobiraAccessories';
import { auth, FIREBASE_CONFIGURED } from '../firebase';
import './launch-screen.css';
import { fadeOutLaunchSfx, launchCueSchedule, playLaunchSfx, preloadLaunchSfx, type LaunchSfx } from '../battle/audio/launchSfx';
import { resumeSharedAudio } from '../battle/audio/sharedAudioContext';
import { readAudioPreferences } from '../battle/audio/audioPreferences';
import { SugorokuTitleHomeworkBanner } from '../sugoroku/homework/SugorokuTitleHomeworkBanner';

const EIKEN_DISCLAIMER = '英検®は公益財団法人 日本英語検定協会の登録商標です。本アプリは同協会の承認・推奨を受けたものではありません。問題は独自制作です。';

/**
 * タイトル画面（2026-11-18 英検版：モンスト風フル画面オープニングムービー ＋ ①高精度切り抜きとびら君登場演出 ＋ 0.00s同期・1回完結BGM）。
 *
 * 起動の流れ:
 *   1. gate = 'emblem' : マナトビ起動エンブレム（白→フェードイン→保持→フェードアウト）
 *   2. gate = 'op'     : エンブレムがフェードアウトした直後、画面向き・幅に応じて
 *                        ・横向き／PC（orientation: landscape かつ min-width: 768px）＝ ② title_op_landscape.mp4（15秒フル画面）
 *                        ・縦向き／スマホ（それ以外）＝ ③ title_op_portrait.mp4（15秒フル画面）
 *                        を先頭 0.00s から BGM（1回完結・ループなし）と完全同期で再生。
 *                        ブラウザの音声自動再生制限時は 0.00s で待機し、最初のタップで映像＋BGMを同時に最初から開始する。
 *   3. gate = 'title'  : OP終了（またはスキップ）で既存のタイトル画面へ遷移し、
 *                        とびら君ステージの位置で高精度切り抜きした ①（battle_countdown）のジャンプ登場演出を再生 →
 *                        そのままタイトル画面のとびら君待機ポーズへシームレスに移行する。
 */
type Phase = 'intro' | 'crossfade' | 'done';
type Gate = 'emblem' | 'op' | 'title' | 'philosophy';

const LANDSCAPE_QUERY = '(orientation: landscape) and (min-width: 768px)';

function useLandscapeTitle(): boolean {
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(LANDSCAPE_QUERY).matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(LANDSCAPE_QUERY);
    const onChange = () => setIsLandscape(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isLandscape;
}

export function LaunchScreen({ onStart, onStartHomeworkChapter, bgmEnabled, onBgmToggle, finishingBgm, onBgmFinished, skipIntro = false }: {
  /** 2026-10-19 ゲスト入口は廃止（ログイン必須）。未ログインなら次にログイン画面が出る */
  onStart: (finishBgm: boolean) => void;
  /** タイトル画面の「今日の課題」カードから未完了単元の演習へワンタップ直行 */
  onStartHomeworkChapter?: (chapterId: string, finishBgm: boolean) => void;
  bgmEnabled: boolean;
  onBgmToggle: (enabled: boolean) => void;
  finishingBgm: boolean;
  onBgmFinished: () => void;
  /** ログアウト後や「タイトルへ戻る」遷移時はエンブレム・OP動画を飛ばして即タイトル画面を表示 */
  skipIntro?: boolean;
}) {
  const { progress } = useGrowthProgress();
  const isLandscape = useLandscapeTitle();
  const opMovie = isLandscape ? FULLFRAME_CINEMATIC_MOVIES.titleOpLandscape : FULLFRAME_CINEMATIC_MOVIES.titleOpPortrait;

  const [phase, setPhase] = useState<Phase>(() => (skipIntro ? 'done' : 'intro'));
  const [gate, setGate] = useState<Gate>(() => (skipIntro ? 'title' : 'emblem'));
  const [emblemPhase, setEmblemPhase] = useState<'in' | 'hold' | 'out'>('in');
  const [emblemSkipped, setEmblemSkipped] = useState(false);
  const [opFadingOut, setOpFadingOut] = useState(false);

  const {
    audioRef: titleBgmRef,
    needsSoundGesture,
    primeFromGesture,
    startBgmFromBeginning,
    markEnded,
    toggleMute: toggleTitleBgm,
    stopTitleBgm,
  } = useLaunchTitleBgm(gate === 'op' || gate === 'title' || finishingBgm, gate === 'op', !bgmEnabled);
  const markTitleBgmEnded = useCallback(() => {
    markEnded();
    if (finishingBgm) onBgmFinished();
  }, [finishingBgm, markEnded, onBgmFinished]);
  const toggleBgm = () => {
    const wasMuted = !bgmEnabled;
    toggleTitleBgm(bgmEnabled);
    onBgmToggle(!bgmEnabled);
    if (wasMuted && needsSoundGesture && opVideoRef.current?.paused) {
      try { opVideoRef.current.currentTime = 0; } catch { /* ignore */ }
      void opVideoRef.current.play().catch(() => finishOpToTitle());
    }
  };

  const sfxTimers = useRef<number[]>([]);
  const skipRequested = useRef(false);
  const opDoneRef = useRef(false);
  const opVideoRef = useRef<HTMLVideoElement>(null);

  const cue = (name: LaunchSfx) => {
    const settings = readAudioPreferences();
    if (settings.bgm) playLaunchSfx(name, settings.volume);
  };
  const clearSfxTimers = () => { sfxTimers.current.forEach(t => window.clearTimeout(t)); sfxTimers.current = []; };

  const advancePastEmblem = () => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setGate(g => (g === 'emblem' ? (reduce || saveData ? 'title' : 'op') : g));
  };

  useEffect(() => {
    if (gate !== 'emblem') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const at = reduced ? { hold: 0, out: 900, next: 1100 } : { hold: 700, out: 2500, next: 3400 };
    let alive = true;
    const visualTimers: number[] = [];
    void preloadLaunchSfx().then(() => {
      if (!alive || skipRequested.current) return;
      resumeSharedAudio();
      const t0 = performance.now();
      visualTimers.push(
        window.setTimeout(() => setEmblemPhase(p => (p === 'in' ? 'hold' : p)), at.hold),
        window.setTimeout(() => setEmblemPhase('out'), at.out),
        window.setTimeout(advancePastEmblem, at.next),
      );
      for (const c of launchCueSchedule(at.next)) {
        if (c.name === 'title_bloom') continue;
        const wait = c.at - (performance.now() - t0);
        if (wait < -500) continue;
        sfxTimers.current.push(window.setTimeout(() => cue(c.name), Math.max(0, wait)));
      }
    });
    return () => { alive = false; visualTimers.forEach(t => window.clearTimeout(t)); clearSfxTimers(); };
  }, [gate]);

  const finishOpToTitle = useCallback(() => {
    if (opDoneRef.current) return;
    opDoneRef.current = true;
    opVideoRef.current?.pause();
    setOpFadingOut(true);
    window.setTimeout(() => {
      setGate(g => (g === 'op' ? 'title' : g));
    }, 320);
  }, []);

  /** 自動再生制限で待機中のOP映像とBGMを、ユーザータップで 0.00s から同時に開始する */
  const startSyncedOpFromGesture = useCallback(() => {
    resumeSharedAudio();
    const el = opVideoRef.current;
    if (el) {
      try { el.currentTime = 0; } catch { /* ignore */ }
    }
    void startBgmFromBeginning();
    if (el) {
      el.play().catch(() => finishOpToTitle());
    }
  }, [finishOpToTitle, startBgmFromBeginning]);

  // OPムービー再生ライフサイクル＆0.00s完全同期スタート
  useEffect(() => {
    if (gate !== 'op' || opDoneRef.current) return;
    setOpFadingOut(false);
    const el = opVideoRef.current;
    if (!el) {
      finishOpToTitle();
      return;
    }
    let disposed = false;
    let started = false;
    let loadWatchdog = 0;
    let maxWatchdog = 0;

    const clearWatchdogs = () => {
      if (loadWatchdog) window.clearTimeout(loadWatchdog);
      if (maxWatchdog) window.clearTimeout(maxWatchdog);
      loadWatchdog = 0;
      maxWatchdog = 0;
    };

    const armWatchdogs = () => {
      clearWatchdogs();
      loadWatchdog = window.setTimeout(() => {
        if (!disposed && !started) finishOpToTitle();
      }, 4500);
      maxWatchdog = window.setTimeout(() => {
        if (!disposed) finishOpToTitle();
      }, Math.ceil(opMovie.durationSec * 1000) + 2500);
    };

    const onPlay = () => {
      started = true;
      if (loadWatchdog) {
        window.clearTimeout(loadWatchdog);
        loadWatchdog = 0;
      }
      if (!maxWatchdog) {
        maxWatchdog = window.setTimeout(() => {
          if (!disposed) finishOpToTitle();
        }, Math.ceil(opMovie.durationSec * 1000) + 2500);
      }
    };
    el.addEventListener('playing', onPlay);

    try { el.currentTime = 0; } catch { /* ignore */ }

    void startBgmFromBeginning().then(status => {
      if (disposed) return;
      const isHeadless = typeof navigator !== 'undefined' && navigator.webdriver === true;
      if (status === 'blocked' && !isHeadless) {
        el.pause();
        try { el.currentTime = 0; } catch { /* ignore */ }
        return;
      }
      try { el.currentTime = 0; } catch { /* ignore */ }
      armWatchdogs();
      el.play().catch(() => {
        if (!disposed) finishOpToTitle();
      });
    });

    return () => {
      disposed = true;
      el.removeEventListener('playing', onPlay);
      clearWatchdogs();
      el.pause();
    };
  }, [finishOpToTitle, gate, opMovie.mp4, opMovie.durationSec, startBgmFromBeginning]);

  useEffect(() => {
    if (gate !== 'title') return;
    void startBgmFromBeginning();
  }, [gate, startBgmFromBeginning]);

  useEffect(() => {
    if (gate === 'philosophy') {
      fadeOutLaunchSfx();
      stopTitleBgm();
    }
  }, [gate, stopTitleBgm]);
  useEffect(() => () => {
    fadeOutLaunchSfx();
    stopTitleBgm();
  }, [stopTitleBgm]);

  const skipEmblem = () => {
    if (emblemPhase === 'out') return;
    skipRequested.current = true;
    setEmblemSkipped(true);
    setEmblemPhase('out');
    clearSfxTimers();
    resumeSharedAudio();
    primeFromGesture();
    void preloadLaunchSfx().then(() => {
      resumeSharedAudio();
      window.setTimeout(advancePastEmblem, 420);
    });
  };

  const [played, setPlayed] = useState(false);
  const [walkReady, setWalkReady] = useState(false);
  const equippedSpriteSrc = progress ? equippedPoseSrc(progress) : '/mascots/basic.webp';

  // エンブレム／OP再生中にとびら君の待機スプライト・背景プレート・終了プレートを事前デコードし、
  // ジャンプ着地から待機ポーズへのクロスフェードでデコード遅延によるブラーや一瞬の空白を出さない
  useEffect(() => {
    const urls = [
      '/cinematics/title-plate.webp',
      ALPHA_CINEMATIC_CLIPS.battleCountdown.poster,
      ALPHA_CINEMATIC_CLIPS.battleCountdown.endPlate,
      '/mascots/walking.webp',
      equippedSpriteSrc,
    ];
    urls.forEach((src) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      if (src === '/mascots/walking.webp') {
        img.onload = () => setWalkReady(true);
      }
      // 事前デコード非対応ブラウザや未キャッシュ時の失敗は通常描画へ委ねる
      void img.decode?.().catch(() => { /* ignore decode race */ });
    });
  }, [equippedSpriteSrc]);

  useEffect(() => {
    if (phase !== 'crossfade') return;
    const t = setTimeout(() => setPhase('done'), 380);
    return () => clearTimeout(t);
  }, [phase]);

  const finishIntro = () => setPhase(p => (p === 'intro' ? (played ? 'crossfade' : 'done') : p));
  const walk = phase === 'done' && !played;

  useEffect(() => {
    if (gate !== 'title' || finishingBgm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest('button, a, input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      enter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const enter = () => {
    fadeOutLaunchSfx();
    const audio = titleBgmRef.current;
    // すでに鳴っている一周の残りだけを引き継ぐ。新しい周回や自動再生は始めない。
    const finishBgm = Boolean(bgmEnabled && audio && !audio.paused && audio.currentTime > 0 && Number.isFinite(audio.duration));
    if (!finishBgm) stopTitleBgm();
    onStart(finishBgm);
  };

  const enterHomeworkChapter = (chapterId: string) => {
    fadeOutLaunchSfx();
    const audio = titleBgmRef.current;
    const finishBgm = Boolean(bgmEnabled && audio && !audio.paused && audio.currentTime > 0 && Number.isFinite(audio.duration));
    if (!finishBgm) stopTitleBgm();
    if (onStartHomeworkChapter) {
      onStartHomeworkChapter(chapterId, finishBgm);
    } else {
      onStart(finishBgm);
    }
  };

  useEffect(() => {
    if (!finishingBgm) return;
    // バックグラウンドや音源読み込みの中断で、ホームBGMの開始を待ち続けない。
    const releaseWhenHidden = () => { if (document.hidden) onBgmFinished(); };
    document.addEventListener('visibilitychange', releaseWhenHidden);
    const timer = window.setTimeout(onBgmFinished, 15_000);
    return () => {
      document.removeEventListener('visibilitychange', releaseWhenHidden);
      window.clearTimeout(timer);
    };
  }, [finishingBgm, onBgmFinished]);

  return (
    <>
      <audio
        ref={titleBgmRef}
        src={TITLE_SCREEN_BGM_SRC}
        preload="auto"
        playsInline
        onEnded={markTitleBgmEnded}
        onError={finishingBgm ? onBgmFinished : undefined}
        data-title-screen-bgm=""
      />
      {finishingBgm ? null : gate === 'emblem' ? (
        <main className="launch-emblem" data-phase={emblemPhase} data-skip={emblemSkipped || undefined} aria-label={`マナトビ 起動エンブレム（タップで進む）。${EIKEN_DISCLAIMER}`} role="button" tabIndex={0} onPointerDown={primeFromGesture} onClick={skipEmblem} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skipEmblem(); } }}><div className="launch-emblem-inner"><img className="launch-emblem-applogo" src="/brand/app-icon-logo.webp" alt="マナトビ" width={640} height={640}/><h1>聞いて、解いて、<br/>競って、<em>これ1本</em>で。</h1></div><p className="launch-emblem-disclaimer">{EIKEN_DISCLAIMER}</p></main>
      ) : gate === 'op' ? (
        <main
          className={`launch-op-stage ${opFadingOut ? 'is-fading-out' : ''}`}
          data-launch-op
          data-orientation={isLandscape ? 'landscape' : 'portrait'}
          aria-label={needsSoundGesture ? 'マナトビ オープニングムービー（タップして最初から再生）' : 'マナトビ オープニングムービー（タップでスキップ）'}
          onClick={needsSoundGesture ? startSyncedOpFromGesture : finishOpToTitle}
        >
          <video
            key={opMovie.mp4}
            ref={opVideoRef}
            className="launch-op-video"
            src={opMovie.mp4}
            poster={opMovie.poster}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            onEnded={finishOpToTitle}
            onError={finishOpToTitle}
          />
          <div className="launch-op-hud" onClick={e => e.stopPropagation()}>
            <TitleBgmMuteButton muted={!bgmEnabled} onToggle={toggleBgm} />
          </div>
          {needsSoundGesture && (
            <button
              type="button"
              className="launch-op-sound-start"
              data-op-sound-start
              onClick={e => { e.stopPropagation(); startSyncedOpFromGesture(); }}
            >
              <Play size={18} aria-hidden="true" />
              <span>タップして音ありで再生</span>
            </button>
          )}
          <div className="launch-op-bottom">
            <img className="launch-op-brand" src="/brand/manatobi-logo.webp" width={1008} height={321} alt="マナトビ" draggable={false} />
            <button
              type="button"
              className="launch-op-skip"
              onClick={e => { e.stopPropagation(); finishOpToTitle(); }}
            >
              タップしてスキップ
            </button>
          </div>
        </main>
      ) : gate === 'philosophy' ? (
        <PhilosophyPage onBack={() => setGate('title')} />
      ) : (
        <main className="launch-screen" aria-label="マナトビ タイトル画面" data-launch-screen data-orientation={isLandscape ? 'landscape' : 'portrait'}>
          <TitleBgmMuteButton muted={!bgmEnabled} onToggle={toggleBgm} />
          <div className="launch-content">
            <h1 className="launch-brand"><img src="/brand/manatobi-logo.webp" width={1008} height={321} alt="マナトビ" fetchPriority="high" /></h1>
            <div className="launch-stage" data-phase={phase} aria-label="とびら君の登場演出">
              <div className="launch-box">
                <div className="launch-scene" aria-hidden="true">
                  <img className="launch-plate" src="/cinematics/title-plate.webp" alt="" width={720} height={720} draggable={false} />
                  <div className="launch-sparkles"><i /><i /><i /><i /><i /><i /></div>
                  {phase !== 'intro' && (
                    <div className={`launch-arrival ${walk && walkReady ? 'walk-ready' : ''} ${!walk ? 'is-idle' : ''}`}>
                      <div className="launch-gait">
                        <img className="launch-walking-pose" src="/mascots/walking.webp" alt="" decoding="sync" draggable={false} onLoad={() => setWalkReady(true)} />
                        <img className="launch-equipped-pose" src={equippedSpriteSrc} alt="" decoding="sync" draggable={false} />
                        {progress && <TobiraAccessories progress={progress} />}
                      </div>
                    </div>
                  )}
                </div>
                {phase !== 'done' && (
                  <div className="launch-tobira-cutout-wrap">
                    <img className="launch-plate launch-plate-under-video" src="/cinematics/title-plate.webp" alt="" width={720} height={720} draggable={false} aria-hidden="true" />
                    <AlphaCinematicClip
                      clip={ALPHA_CINEMATIC_CLIPS.battleCountdown}
                      className="launch-tobira-cutout"
                      hold
                      eager
                      fadeInMs={280}
                      label="とびら君の登場動画"
                      onActiveChange={active => { if (active) setPlayed(true); }}
                      onComplete={finishIntro}
                    />
                  </div>
                )}
              </div>
            </div>
            <p className="launch-copy">聞いて、解いて、<br className="launch-copy-break" />競って、<em>これ1本</em>で。</p>
            <p className="launch-lead">英検5級〜1級のリスニング・読解・語彙を級別に練習。<br />単語帳・復習・3級以上の英作文も、ひとつのアプリで。</p>
            <ul className="launch-chips" aria-label="できること">
              <li><PenLine size={16} aria-hidden="true" /><span><b>演習</b><small>級別の独自問題で重点練習</small></span></li>
              <li><Repeat2 size={16} aria-hidden="true" /><span><b>復習</b><small>解説・和訳と間違えた語を確認</small></span></li>
              <li><Swords size={16} aria-hidden="true" /><span><b>オンライン対戦</b><small>友だち・全国・AI と</small></span></li>
            </ul>
            <div className="launch-actions">
              <SugorokuTitleHomeworkBanner onStartChapter={enterHomeworkChapter} />
              <p className="launch-countdown-mini"><Headphones size={16} aria-hidden="true" />英検 <strong>5級〜1級</strong></p>
              <button type="button" className="launch-start mt-btn mt-btn-accent" onClick={() => { fadeOutLaunchSfx(); enter(); }}><Headphones size={20} aria-hidden="true" />はじめる<ArrowRight size={20} aria-hidden="true" /></button>
              <p className="launch-note">{auth.currentUser ? '学習のつづきから始まります' : FIREBASE_CONFIGURED ? 'ログインして記録を同期、または端末で練習できます' : 'この端末に記録を保存して練習できます'}</p>
              <button type="button" className="launch-philosophy" data-open-philosophy onClick={() => setGate('philosophy')}><BookHeart size={16} aria-hidden="true" />学びの扉 ～私達に出来ることを～</button>
              <p className="launch-kbd" aria-hidden="true"><kbd>Enter</kbd> ではじめる</p>
            </div>
          </div>
        </main>
      )}
    </>
  );
}
