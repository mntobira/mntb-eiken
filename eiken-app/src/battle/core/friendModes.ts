/**
 * フレンド対戦のモード（部屋の画面で選ぶ）。
 *
 * ★部屋の rules の既存項目だけで表す★（pointsSpeedMax / timeLimitOverride / questionCount）。
 * そのため Firestore のルール・保存形式は変えていない。rules は部屋を作った時点で焼き込まれ、
 * 参加者は変えられない（battleCoreFixed）ので、2人が必ず同じ条件で戦う。
 *
 * 締切の上限（firestore.rules の battleDeadlineSane：60秒未満）を超えない秒数だけを使う。
 */
import type { BattleRule } from './types';

export type FriendModeId = 'standard' | 'speed' | 'careful';

export interface FriendMode {
  id: FriendModeId;
  label: string;
  desc: string;
  /** 部屋の rules に上書きする値 */
  rules: Partial<Pick<BattleRule, 'pointsSpeedMax' | 'timeLimitOverride'>>;
}

export const FRIEND_MODES: readonly FriendMode[] = [
  { id: 'standard', label: 'ふつう', desc: '正解＋速さで点が決まる、いつものルール', rules: {} },
  { id: 'speed', label: 'スピード勝負', desc: '1問15秒。はやく答えるほど大きく加点', rules: { pointsSpeedMax: 480, timeLimitOverride: 15 } },
  { id: 'careful', label: 'じっくり', desc: '1問45秒。速さの点はなし、正解数だけで勝負', rules: { pointsSpeedMax: 0, timeLimitOverride: 45 } },
];

export function friendModeById(id: string | undefined): FriendMode {
  return FRIEND_MODES.find((m) => m.id === id) ?? FRIEND_MODES[0]!;
}

/** 部屋の rules から、どのモードで作られたかを推定する（表示用） */
export function friendModeOfRules(rules: Pick<BattleRule, 'pointsSpeedMax' | 'timeLimitOverride'>): FriendMode {
  for (const m of FRIEND_MODES) {
    if (m.id === 'standard') continue;
    if (rules.timeLimitOverride === m.rules.timeLimitOverride && rules.pointsSpeedMax === m.rules.pointsSpeedMax) return m;
  }
  return FRIEND_MODES[0]!;
}
