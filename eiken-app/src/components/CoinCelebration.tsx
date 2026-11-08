import { useEffect, useRef, useState } from 'react';
import { Coins } from 'lucide-react';
import { subscribeCoinGain } from '../battle/data/growthStore';
import { CountUp } from './ui/CountUp';
import './coin-celebration.css';

/**
 * ★D10（2026-10-30）マナコインを手に入れたときの演出★
 *   どの画面でも、この端末でコインが増えた瞬間に画面の上へ「＋N マナコイン」を出す。
 *   - 少し（10枚未満：演習の正解など）… 小さな札がぽんと出て、コインが3枚はじける（解いている邪魔をしない）
 *   - たくさん（10枚以上：ミッション・ログイン・リーグ報酬など）… 光の輪＋コインが12枚はじけて、数字が数え上がる
 *   続けて増えたら（0.7秒以内）1つにまとめて数える。使ったとき・同期・別タブでは出さない（growthStore が知らせない）。
 *   動きを減らす設定では、はじける動きを止めて札だけ出す（coin-celebration.css）。
 */
const MERGE_MS = 700;
const SHOW_MS = 2200;
const BIG = 10;

export function CoinCelebration() {
  const [shown, setShown] = useState<{ id: number; amount: number } | null>(null);
  const pending = useRef(0);
  const merge = useRef<number | undefined>(undefined);
  const hide = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  useEffect(() => {
    const off = subscribeCoinGain((gained) => {
      pending.current += gained;
      window.clearTimeout(merge.current);
      merge.current = window.setTimeout(() => {
        const amount = pending.current;
        pending.current = 0;
        if (amount <= 0) return;
        seq.current += 1;
        setShown({ id: seq.current, amount });
        window.clearTimeout(hide.current);
        hide.current = window.setTimeout(() => setShown(null), amount >= BIG ? SHOW_MS + 600 : SHOW_MS);
      }, MERGE_MS);
    });
    return () => { off(); window.clearTimeout(merge.current); window.clearTimeout(hide.current); };
  }, []);

  if (!shown) return null;
  const big = shown.amount >= BIG;
  return (
    <div key={shown.id} className="coin-cele" data-coin-celebration data-size={big ? 'big' : 'small'} role="status" aria-live="polite">
      {big && <span className="coin-cele-ring" aria-hidden="true" />}
      <span className="coin-cele-burst" aria-hidden="true">
        {Array.from({ length: big ? 12 : 3 }, (_, i) => <i key={i} />)}
      </span>
      <span className="coin-cele-pill">
        <Coins size={big ? 22 : 16} aria-hidden="true" />
        <b>＋{big ? <CountUp value={shown.amount} fromZero duration={800} delay={150} /> : shown.amount}</b>
        <span>マナコイン</span>
      </span>
    </div>
  );
}
