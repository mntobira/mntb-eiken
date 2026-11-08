/**
 * 演習画面（Quiz.tsx）の「いまどの問を表示しているか」の計算（Phase 5 / A2 で Quiz.tsx から移した）。
 *
 * ■ 中身は変えていない
 *   Quiz.tsx の描画中に毎回計算していた perStep / listeningSteps / safeStepIndex /
 *   activeStepSubs / activeStepSub / isLastStep / progressPill / canGoPrevious / isLastQuestion を、
 *   同じ式・同じ順番のまま1つの純粋な関数にまとめた。
 *   Quiz.tsx は今までどおり描画のたびにこれを呼ぶ（メモ化はしていない＝以前と同じ）。
 *
 * ■ なぜ分けたか
 *   Quiz.tsx は 950 行あり、state・副作用・描画の間にこの計算が挟まっていて、
 *   「最後の問の判定」や「前へを押せる条件」を確かめるのに画面全体を読む必要があった。
 *   純粋な関数にしたので、tests/quizStepState.test.ts で単体で確かめられる。
 *
 * ■ リスニング：1画面＝1問（ご要望「問1で1つの進捗、問2で1つの進捗」）
 *   perStep が true のときは、大問（回）の中の小問を1問ずつ見せる。
 *   化学など音源を持たない問題は false になり、これまでどおり
 *   大問まるごと1画面（(1)〜(4)を並べて表示）のまま。
 */
import {
  buildListeningSteps,
  buildProgressPill,
  isPerSubQuestionListening,
  stepSubQuestions,
  type ListeningStep,
  type ProgressPill,
} from './listeningSteps';
import type { Problem, SubQuestion } from '../types/curriculum';

export interface QuizStepInput {
  /** いま表示している大問（範囲外なら undefined） */
  currentQuestion: Problem | undefined;
  currentQuestionIndex: number;
  /** state に入っている生のステップ位置（丸める前） */
  stepIndex: number;
  showingExplanation: boolean;
  /** resolveQuizRange の結果 */
  rangeStart: number;
  rangeEnd: number;
  rangeCount: number;
  rangePosition: number;
}

export interface QuizStepState {
  perStep: boolean;
  listeningSteps: ListeningStep[];
  /** 範囲外を指さないよう丸めた、いま表示している問の位置 */
  safeStepIndex: number;
  /**
   * いま表示しているステップの小問一覧（1問ずつモードのときだけ中身が入る）。
   *
   * 第1〜3問は常に1つ。第4問以降は「音声1本に複数の解答欄」なので
   * 2〜5つになる（例：問18〜21）。ステップの位置（index）ではなく
   * ステップが持つ subQuestionIds から引く。以前の「subQuestions[safeStepIndex]」は
   * ステップ数＝小問数のときしか成り立たなかった。
   */
  activeStepSubs: SubQuestion[];
  /** いま表示している小問（先頭）。音源・採点キー・解説の絞り込みはこれをキーにする */
  activeStepSub: SubQuestion | null;
  /** この回の最後の問まで来たか */
  isLastStep: boolean;
  /** 進捗ピルの分子・分母（数え方は utils/listeningSteps.ts の buildProgressPill） */
  progressPill: ProgressPill;
  /**
   * 「前へ」を押せるか。
   *
   * 1問ずつモードでは、回の先頭（問1）にいても
   * まだ前の回が範囲内にあるなら戻れる。逆に範囲の先頭の問1では
   * 戻る先が無いのでボタンを無効にする（押しても何も起きないボタンを
   * 押せる状態にしておくと、壊れているように見えるため）。
   */
  canGoPrevious: boolean;
  /**
   * 「最後の問題か」＝範囲の終わりに来たか。
   * 章の最終問ではなく範囲の終わりで判定することで、
   * 1回分（例：第3回演習）を解き終えた時点でちゃんと結果画面へ進める。
   * 1問ずつモードでは「範囲の最後の回」かつ「その回の最後の問」で完了とする。
   */
  isLastQuestion: boolean;
}

export function deriveQuizStepState(input: QuizStepInput): QuizStepState {
  const {
    currentQuestion, currentQuestionIndex, stepIndex, showingExplanation,
    rangeStart, rangeEnd, rangeCount, rangePosition,
  } = input;

  // 以下は Quiz.tsx にあった式そのまま（currentQuestion が undefined でも以前と同じ値になる）
  const perStep = isPerSubQuestionListening(currentQuestion as Problem);
  const listeningSteps = perStep ? buildListeningSteps(currentQuestion as Problem) : [];
  const safeStepIndex = perStep
    ? Math.min(Math.max(0, stepIndex), Math.max(0, listeningSteps.length - 1))
    : 0;
  const activeStepSubs: SubQuestion[] = perStep
    ? stepSubQuestions(currentQuestion as Problem, listeningSteps[safeStepIndex])
    : [];
  const activeStepSub = perStep ? (activeStepSubs[0] ?? null) : null;
  const isLastStep = !perStep || safeStepIndex >= listeningSteps.length - 1;

  const progressPill = buildProgressPill({
    perStep, steps: listeningSteps, stepIndex: safeStepIndex, rangeCount, rangePosition,
  });

  const canGoPrevious = showingExplanation
    ? false
    : (perStep && safeStepIndex > 0) || currentQuestionIndex > rangeStart;

  const isLastQuestion = currentQuestionIndex >= rangeEnd && isLastStep;

  return {
    perStep, listeningSteps, safeStepIndex, activeStepSubs, activeStepSub,
    isLastStep, progressPill, canGoPrevious, isLastQuestion,
  };
}
