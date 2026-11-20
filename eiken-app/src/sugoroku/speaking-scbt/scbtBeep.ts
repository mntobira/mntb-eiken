/**
 * S-CBT 本番同様の「録音開始ビープ音（ピッ）」および「録音終了チャイム音」を
 * Web Audio API で外部音源ゼロ・超軽量に鳴らすユーティリティ。
 */
export function playScbtBeep(kind: 'start' | 'end' = 'start', muted = false): void {
  if (muted || typeof window === 'undefined') return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = kind === 'start' ? 880 : 587.33;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    const dur = kind === 'start' ? 0.22 : 0.16;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
    osc.onended = () => {
      void ctx.close().catch(() => undefined);
    };
  } catch {
    // Web Audio 非対応・自動再生制限時は無音で安全に続行
  }
}
