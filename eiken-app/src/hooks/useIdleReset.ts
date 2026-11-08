import { useEffect, useRef } from 'react';

/**
 * ===================================================================
 * 一定時間なにも操作されなかったら、指定の処理を呼ぶ（アイドル復帰）
 * ===================================================================
 *
 * ■ 目的
 *   共用の端末やタブを開いたまま放置されたとき、
 *   問題や解説の画面で止まったままにせずホーム画面へ戻す。
 *   （とびら君が話しているホームに戻ることで、
 *     次の人／次の勉強が気持ちよく始められる）
 *
 * ■ 「操作された」と見なすもの
 *   タップ・クリック・キー入力・スクロール・マウス移動・
 *   ホイール・タッチのいずれか。1つでもあればタイマーを振り出しに戻す。
 *
 * ■ バックグラウンドに置かれた場合
 *   スマホでは他アプリに移るとタイマーが止まる（スロットリングされる）ため、
 *   タイマーだけに頼ると「1時間放置したのに戻らない」ことが起きる。
 *   そこで復帰時（visibilitychange）に *経過時間を実測* して、
 *   すでに閾値を超えていればその場で発火させる。
 *
 * ■ 使い方
 *   useIdleReset({
 *     enabled: appState !== 'home',
 *     timeoutMs: 30 * 60 * 1000,
 *     onIdle: () => setAppState('home'),
 *   });
 */
export interface UseIdleResetOptions {
  /** 監視するかどうか（ホーム画面にいるときなど、不要な場面では false にする） */
  enabled: boolean;
  /** 無操作と判定するまでの時間（ミリ秒） */
  timeoutMs: number;
  /** 無操作が続いたときに呼ばれる */
  onIdle: () => void;
}

/** 「操作された」と見なすイベント。passive で登録してスクロール性能を損なわない。 */
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
  'click',
];

export function useIdleReset({ enabled, timeoutMs, onIdle }: UseIdleResetOptions) {
  // onIdle は毎レンダリングで新しい関数になりうるので ref に逃がす。
  // これを依存配列に入れるとタイマーが張り直され、いつまでも発火しない。
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled || timeoutMs <= 0) return;

    let timerId: number | undefined;
    /** 最後に操作された時刻（バックグラウンド復帰時の実測に使う） */
    let lastActivity = Date.now();
    /** 二重発火を防ぐ */
    let fired = false;

    const fire = () => {
      if (fired) return;
      fired = true;
      onIdleRef.current();
    };

    const reset = () => {
      if (fired) return;
      lastActivity = Date.now();
      if (timerId !== undefined) window.clearTimeout(timerId);
      timerId = window.setTimeout(fire, timeoutMs);
    };

    // タブが表に戻ったとき、止まっていた分を実測して判定する
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastActivity >= timeoutMs) {
        fire();
      } else {
        reset();
      }
    };

    ACTIVITY_EVENTS.forEach(type =>
      window.addEventListener(type, reset, { passive: true }),
    );
    document.addEventListener('visibilitychange', handleVisibility);
    reset();

    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      ACTIVITY_EVENTS.forEach(type => window.removeEventListener(type, reset));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, timeoutMs]);
}
