import { useCallback, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { setTitleBgmVolume, unlockTitleBgm } from '../battle/audio/titleMediaAudio';
import { readAudioPreferences } from '../battle/audio/audioPreferences';

export const TITLE_SCREEN_BGM_SRC = '/bgm/title_intro_bgm.mp3';
/**
 * タイトル画面専用BGM（動画④から抽出したループ音源: 実測 -23.0 LUFS / Peak -9.0 dBFS）。
 * 動画中だけ音量を上げる。同じ音源を使い続け、OP→タイトルで再生位置を保持する。
 */
export const TITLE_SCREEN_BGM_SUBTLE_GAIN = 0.35;
export const TITLE_OP_BGM_GAIN = 0.8;

export function useLaunchTitleBgm(active: boolean, opening: boolean, muted: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gain = opening ? TITLE_OP_BGM_GAIN : TITLE_SCREEN_BGM_SUBTLE_GAIN;
  const gainRef = useRef(gain);
  gainRef.current = gain;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const activeRef = useRef(active);
  activeRef.current = active;

  const targetVolume = () => {
    if (mutedRef.current) return 0;
    return readAudioPreferences().volume * gainRef.current;
  };

  useEffect(() => {
    const onGesture = () => {
      const audio = audioRef.current;
      if (!audio || mutedRef.current || document.visibilityState === 'hidden') return;
      if (activeRef.current) {
        unlockTitleBgm(audio, targetVolume());
        if (audio.paused) void audio.play().catch(() => undefined);
      } else {
        // エンブレムへのタップも後続のOP再生に使えるよう、共有AudioContextを先に解錠。
        unlockTitleBgm(audio, 0);
      }
    };
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('click', onGesture);
    window.addEventListener('keydown', onGesture);
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('click', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (active && !muted && document.visibilityState !== 'hidden') {
      unlockTitleBgm(audio, targetVolume());
      if (audio.paused) {
        void audio.play().catch(() => undefined);
      }
    } else if (!audio.paused) {
      audio.pause();
    }
  }, [active, muted, gain]);

  useEffect(() => {
    const onVis = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (document.visibilityState === 'hidden') {
        audio.pause();
      } else if (activeRef.current && !mutedRef.current) {
        unlockTitleBgm(audio, targetVolume());
        void audio.play().catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  const toggleMute = (next: boolean) => {
    mutedRef.current = next;
    const audio = audioRef.current;
    if (!audio) return;
    if (next) {
      setTitleBgmVolume(audio, 0);
      audio.pause();
    } else if (activeRef.current) {
      unlockTitleBgm(audio, targetVolume());
      void audio.play().catch(() => undefined);
    }
  };

  const stopTitleBgm = useCallback(() => {
    activeRef.current = false;
    const audio = audioRef.current;
    if (!audio) return;
    setTitleBgmVolume(audio, 0);
    audio.pause();
  }, []);

  return { audioRef, toggleMute, stopTitleBgm };
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
