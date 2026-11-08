/**
 * LR リスニング予想問題の音声プレーヤー（所持している回だけ「マイPDF」に出る）。
 *   問題ごとのボタン（44px 以上）を押すとその問題が流れる。もう一度押すと止まる。
 *   1つの <audio> を使い回す（同時に2つ鳴らない）。
 */
import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { kyotsuAudioLabel, kyotsuAudioOf, kyotsuFullAudioOf } from '../../data/kyotsuMockAudio';

export function KyotsuAudioPlayer({ printId }: { printId: string }) {
  const tracks = kyotsuAudioOf(printId);
  const full = kyotsuFullAudioOf(printId);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => () => audio.current?.pause(), []);
  if (!tracks.length) return null;
  const toggle = async (q: string, file: string) => {
    const el = audio.current;
    if (!el) return;
    setError('');
    if (playing === q) {
      el.pause();
      setPlaying(null);
      return;
    }
    el.src = file;
    try {
      await el.play();
      setPlaying(q);
    } catch {
      setPlaying(null);
      setError('音声を再生できませんでした。接続を確認して、もう一度押してください。');
    }
  };
  const parts = [...new Set(tracks.map((tr) => tr.part))];
  return (
    <details className="kyotsu-audio" data-kyotsu-audio={printId}>
      <summary>音声を聞く（{tracks.length}トラック）</summary>
      <audio ref={audio} preload="none" onEnded={() => setPlaying(null)} />
      {/* F8：本番と同じ流れ（日本語の案内つき）で通して聞く */}
      {full && (
        <button type="button" className="kyotsu-audio-full" aria-pressed={playing === 'full'} data-kyotsu-track="full" onClick={() => void toggle('full', full)}>
          {playing === 'full' ? <Square size={14} aria-hidden /> : <Play size={14} aria-hidden />}
          通しで聞く（本番と同じ流れ）
        </button>
      )}
      {parts.map((part) => (
        <section key={part} aria-label={part}>
          <h4>
            {part}
            {tracks.find((tr) => tr.part === part)?.twice ? <small>2回流れます</small> : null}
          </h4>
          <ul>
            {tracks
              .filter((tr) => tr.part === part)
              .map((tr) => (
                <li key={tr.q}>
                  <button
                    type="button"
                    aria-pressed={playing === tr.q}
                    data-kyotsu-track={tr.q}
                    onClick={() => void toggle(tr.q, tr.file)}
                  >
                    {playing === tr.q ? <Square size={14} aria-hidden /> : <Play size={14} aria-hidden />}
                    {kyotsuAudioLabel(tr.q)}
                    <small>{tr.sec}秒</small>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {error && <p role="status">{error}</p>}
    </details>
  );
}
