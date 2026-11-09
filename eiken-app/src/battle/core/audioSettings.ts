/**
 * ===================================================================
 * audioSettings — 対戦の音の設定（純粋関数・依存ゼロ）
 * ===================================================================
 *
 * ■ 既存の BGM 設定（App.tsx の bgm_enabled / bgm_volume）と分ける理由
 *   既存の BGM は「学習中に流す環境音」で、90秒で自然に消える設計。
 *   対戦の音は試合の進行に合わせて鳴る「ゲームの音」で、目的が違う。
 *   同じスイッチにすると「勉強中は静かにしたいが対戦は音が欲しい」
 *   （またはその逆）ができない。設定は別に持ち、設定画面では並べて出す。
 *
 * ■ 既定値
 *   BGM … OFF。既存の BGM が OFF 既定なのと同じ理由（図書館・電車・自習室）。
 *   効果音 … ON。短い音なので害が小さく、「正解した」「相手が答えた」を
 *            耳で受け取れることが臨場感の要になる。
 *   音量 … 0.6。
 *   ★どれも設定画面から変えられ、端末に保存される。★
 */

export interface BattleAudioSettings {
  bgm: boolean;
  sfx: boolean;
  /** 0〜1 */
  volume: number;
}

export const BATTLE_AUDIO_STORAGE_KEY = 'battle_audio_settings';

export const DEFAULT_BATTLE_AUDIO: BattleAudioSettings = Object.freeze({
  bgm: true,
  sfx: true,
  volume: 0.6,
});

/** 保存文字列 → 設定。壊れていたら既定値（部分的に壊れていれば部分だけ既定に） */
export function parseBattleAudioSettings(raw: string | null | undefined): BattleAudioSettings {
  if (!raw) return { ...DEFAULT_BATTLE_AUDIO };
  try {
    const obj = JSON.parse(raw) as Partial<Record<keyof BattleAudioSettings, unknown>>;
    if (!obj || typeof obj !== 'object') return { ...DEFAULT_BATTLE_AUDIO };
    return {
      bgm: typeof obj.bgm === 'boolean' ? obj.bgm : DEFAULT_BATTLE_AUDIO.bgm,
      sfx: typeof obj.sfx === 'boolean' ? obj.sfx : DEFAULT_BATTLE_AUDIO.sfx,
      volume: clampVolume(obj.volume),
    };
  } catch {
    return { ...DEFAULT_BATTLE_AUDIO };
  }
}

export function serializeBattleAudioSettings(s: BattleAudioSettings): string {
  return JSON.stringify({ bgm: s.bgm, sfx: s.sfx, volume: clampVolume(s.volume) });
}

export function clampVolume(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return DEFAULT_BATTLE_AUDIO.volume;
  return Math.min(1, Math.max(0, n));
}

/**
 * BGM の種類（試合の局面に対応）。
 *   'matching' … 相手さがし・待機（期待感）
 *   'normal'   … 通常対戦（集中を邪魔しないテンポ）
 *   'closing'  … 残り3問（少し緊張）
 *   'final'    … 最終問題（強め）
 *   null       … 止める
 */
export type BattleBgmTrack = 'matching' | 'normal' | 'closing' | 'final' | null;

/**
 * BGM のトラックを局面から決める。
 * BGM が OFF なら常に null。
 */
export function bgmTrackFor(
  settings: Pick<BattleAudioSettings, 'bgm'>,
  state: 'idle' | 'matching' | 'countdown' | 'playing' | 'finished',
  phase: 'normal' | 'closing' | 'final',
): BattleBgmTrack {
  if (!settings.bgm) return null;
  if (state === 'matching' || state === 'countdown') return 'matching';
  if (state === 'playing') return phase;
  return null;
}
