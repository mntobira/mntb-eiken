/**
 * ===================================================================
 * ユーザーごとの localStorage キー名
 * ===================================================================
 *
 * ■ なぜこのファイルがあるのか
 *
 * 次の4つは「ユーザー1人につき1つ」の値で、uid をキーに含めて保存している。
 *
 *     profile_<uid>      プロフィール（名前・学年・文理）
 *     streak_<uid>       連続学習日数
 *     lastActive_<uid>   最後に学習した日（連続日数の判定に使う）
 *     completed_<uid>    修了した章のID配列
 *
 * これが 8ファイル・23か所に文字列リテラルで手書きされていた。
 *
 *     localStorage.getItem(`profile_${uid}`)
 *     localStorage.setItem(`streak_${uid}`, ...)
 *     ...
 *
 * キー名は「いまユーザーの端末に入っている値の在り処」なので、
 * 1文字でも違うと保存したはずのデータが消えたように見える。
 * 23か所の手書きは、そのまま「23回タイプミスできる場所」でもあった。
 *
 * そこで文字列を作るのはこのファイルだけにした。
 * すでに progress.ts の SOLVED_KEY_PREFIX や
 * tipRotation.ts の SEEN_TIPS_KEY_PREFIX が同じ作法を取っているので、
 * 新しい流儀を持ち込むわけではない。
 *
 * ■ 変えていないこと
 *
 * ・キー名そのもの（既存データを読めなくしないため、1文字も変えない）
 * ・uid の決め方。呼び出し側は `auth.currentUser?.uid || 'guest'` や
 *   `isGuest ? 'guest' : null` のように、**それぞれ違う理由で** 違う
 *   決め方をしている。ここで勝手に 'guest' へ丸めると
 *   「別人の進捗が見える」事故になりうるので、uid は素通しにする。
 *
 * ■ このファイルは他の src を一切 import しない（葉モジュール）
 */

/** プロフィール（名前・学年・文理）の接頭辞 */
export const PROFILE_KEY_PREFIX = 'profile_';

/** 連続学習日数の接頭辞 */
export const STREAK_KEY_PREFIX = 'streak_';

/** 最後に学習した日（`Date.toDateString()` の文字列）の接頭辞 */
export const LAST_ACTIVE_KEY_PREFIX = 'lastActive_';

/** 修了した章のID配列の接頭辞 */
export const COMPLETED_KEY_PREFIX = 'completed_';

/** プロフィールの保存キー */
export function profileKey(uid: string): string {
  return `${PROFILE_KEY_PREFIX}${uid}`;
}

/** 連続学習日数の保存キー */
export function streakKey(uid: string): string {
  return `${STREAK_KEY_PREFIX}${uid}`;
}

/** 最後に学習した日の保存キー */
export function lastActiveKey(uid: string): string {
  return `${LAST_ACTIVE_KEY_PREFIX}${uid}`;
}

/** 修了した章の保存キー */
export function completedKey(uid: string): string {
  return `${COMPLETED_KEY_PREFIX}${uid}`;
}

/**
 * uid ごとの保存キー：接頭辞 + encodeURIComponent(uid)。uid が空ならゲスト用の 'guest'（2026-10-28 リファクタリング A7）
 *   以前は7つのファイルが同じ式をそれぞれ書いていた。計算はそのままなので、保存済みのデータはそのまま読める。
 */
export function perUserKey(prefix: string, uid: string | null | undefined): string {
  return prefix + encodeURIComponent(uid || 'guest');
}
