/**
 * ===================================================================
 * 章 × モードごとの localStorage キー名（解いている途中の状態）
 * ===================================================================
 *
 * ■ なぜこのファイルがあるのか
 *
 * 解いている途中のクイズは、章とモードの組ごとに保存されている。
 *
 *     quiz_answers_<章ID>_<モード>   入力した解答（設問ID → 文字列）
 *     quiz_elim_<章ID>_<モード>      消去法で斜線を引いた選択肢
 *     quiz_idx_<章ID>_<モード>       いま何問目か
 *     quiz_expl_<章ID>_<モード>      解説を開いた状態か
 *     quiz_run_<章ID>_<モード>       採点結果（点数）
 *     quiz_step_<章ID>_<モード>      リスニングの何ステップ目か
 *
 * これが 5ファイル・21か所に手書きされていた。
 *
 *     localStorage.getItem(`quiz_answers_${chapter.id}_${mode}`)
 *     localStorage.removeItem(`quiz_run_${chapterId}_${appMode}`)
 *     ...
 *
 * キー名が1文字でも違うと「途中まで解いた解答が消えた」ことになる。
 * しかも「続きから開く」の判定（ChapterSelection）と、実際に読み込む側
 * （Quiz）と、やり直しで消す側（App）が別ファイルにあり、
 * 3つが同じ文字列を作れていることが前提になっている。
 * 手書きが21か所に散っている状態はその前提を保証できない。
 *
 * ■ モードを必ず含める
 *
 * 同じ章でも小テスト（mini_test）と演習（practice）は別物として保存する。
 * キーからモードが抜けると、小テストで入れた解答が演習に出てしまう。
 * そのため引数は必ず（章ID, モード）の2つにしている。
 *
 * ■ 変えていないこと
 *
 * ・キー名そのもの（既存の「解きかけ」を読めなくしないため、1文字も変えない）
 * ・章IDとモードの決め方（呼び出し側のまま）
 *
 * ■ このファイルは他の src を一切 import しない（葉モジュール）
 */

/** 入力した解答（設問ID → 文字列）の接頭辞 */
export const QUIZ_ANSWERS_KEY_PREFIX = 'quiz_answers_';

/** 消去法で斜線を引いた選択肢（設問ID → 選択肢の配列）の接頭辞 */
export const QUIZ_ELIM_KEY_PREFIX = 'quiz_elim_';

/** いま何問目か（添字）の接頭辞 */
export const QUIZ_INDEX_KEY_PREFIX = 'quiz_idx_';

/** 解説を開いた状態か（'true'）の接頭辞 */
export const QUIZ_EXPL_KEY_PREFIX = 'quiz_expl_';

/** 採点結果（点数）の接頭辞 */
export const QUIZ_RUN_KEY_PREFIX = 'quiz_run_';

/** リスニングの何ステップ目かの接頭辞 */
export const QUIZ_STEP_KEY_PREFIX = 'quiz_step_';

/**
 * 章 × モードの組でキーを作る共通部分。
 * `<接頭辞><章ID>_<モード>` という形は6種類すべて同じ。
 */
function chapterModeKey(prefix: string, chapterId: string, mode: string): string {
  return `${prefix}${chapterId}_${mode}`;
}

/** 入力した解答の保存キー */
export function quizAnswersKey(chapterId: string, mode: string): string {
  return chapterModeKey(QUIZ_ANSWERS_KEY_PREFIX, chapterId, mode);
}

/** 消去法の保存キー */
export function quizElimKey(chapterId: string, mode: string): string {
  return chapterModeKey(QUIZ_ELIM_KEY_PREFIX, chapterId, mode);
}

/** 何問目かの保存キー */
export function quizIndexKey(chapterId: string, mode: string): string {
  return chapterModeKey(QUIZ_INDEX_KEY_PREFIX, chapterId, mode);
}

/** 解説を開いた状態かの保存キー */
export function quizExplKey(chapterId: string, mode: string): string {
  return chapterModeKey(QUIZ_EXPL_KEY_PREFIX, chapterId, mode);
}

/** 採点結果の保存キー */
export function quizRunKey(chapterId: string, mode: string): string {
  return chapterModeKey(QUIZ_RUN_KEY_PREFIX, chapterId, mode);
}

/** リスニングのステップの保存キー */
export function quizStepKey(chapterId: string, mode: string): string {
  return chapterModeKey(QUIZ_STEP_KEY_PREFIX, chapterId, mode);
}
