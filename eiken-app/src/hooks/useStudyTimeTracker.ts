import { useEffect } from 'react';
import { auth } from '../firebase';
import { activeStudySeconds, addStudySeconds } from '../utils/studyTime';
import { toDateKey } from '../utils/studySummary';
import { recordTick, syncPendingLogs } from '../sugoroku/timelog/timelogStore';
import type { StudyContextInput } from '../sugoroku/timelog/timelogCore';

/** 学習時間を足す間隔（ms） */
export const STUDY_TICK_MS = 15_000;

/** 操作とみなすイベント */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];

/**
 * リスニングの音声・読み上げが鳴っているか（鳴っている間は操作ありとみなす）。
 * BGM（loop のついた <audio>）は数えない。
 */
function isStudyMediaPlaying(): boolean {
  const media = [...document.querySelectorAll<HTMLMediaElement>('audio, video')];
  return media.some((m) => !m.loop && !m.paused && !m.ended)
    || (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking);
}

/**
 * ★学習時間（設定のプロフィールカード ＆ すごろく塾 分野別アクティブ学習時間）★
 * active の間だけ、タブが前面にあるときに15秒ごとに足す。
 * 1分間なにも操作がなければ数えない（2026-10-11）。止めるとき（画面を離れたとき）に端数も足す。
 *
 * - 既存の合計（study_time_v1_）は `quiz` / `explanation` / `mock(実行中)` のみ加算し、従来挙動と1ミリも変えない。
 * - 追加の分野別台帳（sugoroku/timelog）は、`writing`（英作文）や `foundation`（語彙・基礎固め）も含め
 *   「どの級の・どの技能（reading / listening / vocab / writing / speaking）を何秒学習したか」を記録する。
 */
export function useStudyTimeTracker(
  active: boolean,
  screenKey: string,
  chapterIdOrContext?: string | null | StudyContextInput,
): void {
  const ctx: StudyContextInput =
    typeof chapterIdOrContext === 'object' && chapterIdOrContext !== null
      ? chapterIdOrContext
      : { chapterId: typeof chapterIdOrContext === 'string' ? chapterIdOrContext : null, screenKey };

  const chapterId = ctx.chapterId ?? null;
  const subjectId = ctx.subjectId ?? null;
  const foundationTab = ctx.foundationTab ?? null;
  const mockKind = ctx.mockKind ?? null;

  // screenKey（画面の名前）や単元が変わるたびに区切って足し直す（演習 → 解説へ移った瞬間にも端数を足す）
  useEffect(() => {
    const sugorokuOnlyScreen = screenKey === 'writing' || screenKey === 'foundation';
    if (!active && !sugorokuOnlyScreen) return;

    let last = Date.now();
    let lastActive = last;
    const markActive = () => {
      lastActive = Date.now();
    };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, markActive, { passive: true, capture: true }));

    const runTick = (flushSync: boolean) => {
      const now = Date.now();
      if (isStudyMediaPlaying()) lastActive = now;
      if (document.visibilityState === 'visible') {
        const uid = auth.currentUser?.uid || 'guest';
        const seconds = activeStudySeconds(last, now, lastActive);
        // 1. 既存の合計（プロフィールカード・StudyRecord）— 従来の active 画面のみで変更なし
        if (active) {
          addStudySeconds(uid, seconds, toDateKey(now));
        }
        // 2. すごろく分野別アクティブ学習時間（級×技能別）
        recordTick({
          uid,
          seconds,
          to: now,
          chapterId: sugorokuOnlyScreen ? null : chapterId,
          screenKey,
          subjectId,
          foundationTab,
          mockKind,
        });
        // 3. Firestore 同期（通常は60秒スロットル、画面離脱時は即時フラッシュ）
        void syncPendingLogs(uid, now, { force: flushSync });
      }
      last = now;
    };

    const tick = () => runTick(false);
    const id = window.setInterval(tick, STUDY_TICK_MS);
    return () => {
      window.clearInterval(id);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, markActive, { capture: true }));
      runTick(true);
    };
  }, [active, screenKey, chapterId, subjectId, foundationTab, mockKind]);
}
