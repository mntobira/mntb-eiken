import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { setTitleBgmVolume, unlockTitleBgm } from '../battle/audio/titleMediaAudio';
import { readAudioPreferences } from '../battle/audio/audioPreferences';

export const TITLE_SCREEN_BGM_SRC = '/bgm/title_intro_bgm.mp3';
/**
 * タイトル画面専用BGM（動画④から抽出した15.0秒の1回完結フル尺音源: 実測 -20.5 LUFS / Peak -3.0 dBFS）。
 * ループは行わず（1回のみ再生して自然終止）、OPムービー先頭（0.00s）と同時に再生を開始する。
 */
export const TITLE_SCREEN_BGM_SUBTLE_GAIN = 0.35;
export const TITLE_OP_BGM_GAIN = 0.8;

export function useLaunchTitleBgm(active: boolean, opening = false, muted = false) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [needsSoundGesture, setNeedsSoundGesture] = useState(false);

  const gain = opening ? TITLE_OP_BGM_GAIN : TITLE_SCREEN_BGM_SUBTLE_GAIN;
  const gainRef = useRef(gain);
  gainRef.current = gain;

  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const activeRef = useRef(active);
  activeRef.current = active;

  /** 1回完結再生のライフサイクル管理（一度最後まで鳴り終えたら二度と繰り返さない） */
  const startedFromZeroRef = useRef(false);
  const endedOnceRef = useRef(false);
  const primedRef = useRef(false);

  const targetVolume = useCallback(() => {
    if (mutedRef.current) return 0;
    const pref = readAudioPreferences();
    if (!pref.bgm) return 0;
    return Math.max(0, Math.min(1, pref.volume * gainRef.current));
  }, []);

  /**
   * エンブレム画面タップ等のユーザージェスチャ内で呼び出し、ブラウザの音声再生ロックを事前解除する。
   * 実際の再生開始（0.00s）は OP 遷移時に `startBgmFromBeginning` で行う。
   */
  const primeFromGesture = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || endedOnceRef.current) return;
    unlockTitleBgm(audio, 0);
    if (primedRef.current) return;
    primedRef.current = true;
    try {
      audio.loop = false;
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        void p
          .then(() => {
            if (!activeRef.current) {
              audio.pause();
              try {
                audio.currentTime = 0;
              } catch {
                /* ignore */
              }
            }
          })
          .catch(() => {
            primedRef.current = false;
          });
      }
    } catch {
      primedRef.current = false;
    }
  }, []);

  /**
   * OP 開始時（または自動再生ブロック後の最初のタップ時）に必ず 0.00s から 1 回だけ再生を開始する。
   */
  const startBgmFromBeginning = useCallback(
    async (): Promise<'started' | 'muted' | 'ended' | 'blocked'> => {
      const audio = audioRef.current;
      if (endedOnceRef.current) return 'ended';
      const vol = targetVolume();
      if (!audio || vol <= 0) {
        setNeedsSoundGesture(false);
        return 'muted';
      }
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return 'blocked';
      }
      audio.loop = false;
      try {
        if (!startedFromZeroRef.current || audio.currentTime > 0.08) {
          audio.currentTime = 0;
        }
      } catch {
        /* ignore before metadata */
      }
      unlockTitleBgm(audio, vol);
      try {
        await audio.play();
        startedFromZeroRef.current = true;
        setNeedsSoundGesture(false);
        return 'started';
      } catch {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
        setNeedsSoundGesture(true);
        return 'blocked';
      }
    },
    [targetVolume],
  );

  const markEnded = useCallback(() => {
    endedOnceRef.current = true;
    setNeedsSoundGesture(false);
    const audio = audioRef.current;
    if (audio) {
      audio.loop = false;
      audio.pause();
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = false;
    const onEnded = () => markEnded();
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [markEnded]);

  // OP → タイトル画面への遷移時のゲイン反映 ＆ active === false 時のフェード停止
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = false;
    if (!active) {
      if (!audio.paused) {
        setTitleBgmVolume(audio, 0);
        const t = window.setTimeout(() => audio.pause(), 180);
        return () => window.clearTimeout(t);
      }
      return;
    }
    if (endedOnceRef.current) return;
    if (muted || targetVolume() <= 0) {
      if (!audio.paused) {
        setTitleBgmVolume(audio, 0);
        audio.pause();
      }
      return;
    }
    setTitleBgmVolume(audio, targetVolume());
    if (
      startedFromZeroRef.current &&
      audio.paused &&
      !audio.ended &&
      document.visibilityState !== 'hidden'
    ) {
      unlockTitleBgm(audio, targetVolume());
      void audio.play().catch(() => undefined);
    }
  }, [active, muted, gain, targetVolume]);

  useEffect(() => {
    const onVis = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (document.visibilityState === 'hidden') {
        audio.pause();
      } else if (
        activeRef.current &&
        startedFromZeroRef.current &&
        !endedOnceRef.current &&
        !mutedRef.current &&
        targetVolume() > 0 &&
        !audio.ended
      ) {
        unlockTitleBgm(audio, targetVolume());
        void audio.play().catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [targetVolume]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  const toggleMute = useCallback((next: boolean) => {
    mutedRef.current = next;
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = false;
    if (next) {
      setNeedsSoundGesture(false);
      setTitleBgmVolume(audio, 0);
      audio.pause();
    } else if (activeRef.current && !endedOnceRef.current) {
      if (!startedFromZeroRef.current) {
        try {
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
      const vol = Math.max(0.08, readAudioPreferences().volume * gainRef.current);
      unlockTitleBgm(audio, vol);
      void audio
        .play()
        .then(() => {
          startedFromZeroRef.current = true;
          setNeedsSoundGesture(false);
        })
        .catch(() => undefined);
    }
  }, []);

  const stopTitleBgm = useCallback(() => {
    activeRef.current = false;
    endedOnceRef.current = true;
    setNeedsSoundGesture(false);
    const audio = audioRef.current;
    if (!audio) return;
    setTitleBgmVolume(audio, 0);
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      /* ignore seek before metadata */
    }
  }, []);

  return {
    audioRef,
    muted,
    needsSoundGesture,
    primeFromGesture,
    startBgmFromBeginning,
    markEnded,
    toggleMute,
    stopTitleBgm,
  };
}

export function TitleBgmMuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="launch-bgm-toggle"
      onClick={onToggle}
      aria-pressed={!muted}
      aria-label={muted ? 'タイトルBGMをオンにする' : 'タイトルBGMをミュートする'}
      data-title-bgm-toggle
    >
      {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
      <span>{muted ? 'BGM OFF' : 'BGM ON'}</span>
    </button>
  );
}
