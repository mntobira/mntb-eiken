import { useMemo } from 'react';
import './result-insight.css';
import { ArrowDownRight, ArrowUpRight, Clock, Minus, Target, Trophy } from 'lucide-react';
import { auth } from '../../firebase';
import { CountUp } from '../ui/CountUp';
import { ScoreRing } from '../../motion';
import { formatResultTime } from './helpers';
import { STAGE_CLEAR_PERFECTS, readStageHistory, readStageRecords, stageKey } from '../../utils/stageRecords';
import type { Problem } from '../../types/curriculum';

/**
 * ★演習の結果（D2・2026-10-30 ご要望）★
 *   「何を伝えたいのか分からない」→ 見るものを3つに絞って、動きのあるグラフで見せる。
 *     1. 今回：大きな正答率の輪（描かれていく）＋ 正解数・時間
 *     2. 前回と比べて：前回の正答率 → 今回（上がった/下がった）、最高、満点の目標（●●○ = あと何回で達成）
 *     3. この単元の回：回ごとの最高正答率の棒グラフ（今回の回は色を変える・目標＝満点の線）
 *   記録は utils/stageRecords（この端末＋ほかの端末の合算）。結果画面に来た時点で今回の挑戦は記録済み。
 *   「この単元にご意見」はここから外した（ご要望）。
 */
export interface ResultInsightProps {
  chapterId: string;
  /** 章の全大問（英文法なら 1大問＝1回） */
  allQuestions: Problem[];
  /** 1回だけを解いたときの、その回の通し番号（単元まるごとなら null） */
  singleIndex: number | null;
  correct: number;
  judgeable: number;
  timeSec: number;
}

const pct = (c: number, j: number) => (j > 0 ? Math.round((c / j) * 100) : 0);
const roundLabel = (q: Problem | undefined, i: number) => {
  const m = /^第(\d+)回/.exec(String(q?.category || q?.title || ''));
  return m ? `第${m[1]}回` : `第${i + 1}回`;
};

export function ResultInsight({ chapterId, allQuestions, singleIndex, correct, judgeable, timeSec }: ResultInsightProps) {
  const rate = pct(correct, judgeable);
  const data = useMemo(() => {
    const uid = auth.currentUser?.uid || 'guest';
    const records = readStageRecords(uid);
    const single = singleIndex != null ? allQuestions[singleIndex] : undefined;
    const key = stageKey(chapterId, single?.id != null ? String(single.id) : undefined);
    const mine = readStageHistory(uid).filter((h) => h.k === key);
    // 結果画面に来た時点で今回の挑戦は履歴の先頭に入っている。同じ点で10分以内なら「今回」とみなして1つ飛ばす
    const head = mine[0];
    const isCurrent = !!head && head.c === correct && head.j === judgeable && Date.now() - head.t < 10 * 60 * 1000;
    const prev = isCurrent ? mine[1] : head;
    const rec = records[key];
    const rounds = single && allQuestions.length > 1
      ? allQuestions.map((q, i) => {
        const r = records[stageKey(chapterId, String(q.id))];
        return { label: roundLabel(q, i), best: r ? r.b : null, cleared: (r?.p ?? 0) >= STAGE_CLEAR_PERFECTS, current: i === singleIndex };
      })
      : [];
    return {
      prevRate: prev ? pct(prev.c, prev.j) : null,
      best: Math.max(rec?.b ?? 0, rate),
      perfects: Math.min(STAGE_CLEAR_PERFECTS, rec?.p ?? 0),
      tries: rec?.n ?? 1,
      rounds,
      title: single ? roundLabel(single, singleIndex ?? 0) : 'この単元',
    };
  }, [chapterId, allQuestions, singleIndex, correct, judgeable, rate]);

  const delta = data.prevRate == null ? null : rate - data.prevRate;
  const left = STAGE_CLEAR_PERFECTS - data.perfects;
  const tone = rate >= 100 ? 'done' : rate >= 60 ? 'good' : rate > 0 ? 'mid' : 'low';

  return (
    <section className="ri" aria-label="演習の結果" data-practice-result data-result-insight data-tone={tone}>
      {/* 1. 今回 */}
      <div className="ri-hero">
        <div className="ri-ring" aria-hidden="true">
          <ScoreRing rate={rate / 100} size={104} stroke={11} tone={rate >= 100 ? 'done' : 'brand'} />
          <span className="ri-ring-label"><b><CountUp value={rate} fromZero duration={1100} delay={300} /></b><small>%</small></span>
        </div>
        <div className="ri-hero-text">
          <p className="ri-kicker">{data.title}の結果</p>
          <p className="ri-score"><b><CountUp value={correct} fromZero duration={900} delay={250} /></b><span>/ {judgeable} 問 正解</span></p>
          <p className="ri-time"><Clock size={14} aria-hidden="true" />{formatResultTime(timeSec)}<span className="ri-tries">{data.tries}回目の挑戦</span></p>
        </div>
      </div>

      {/* 2. 前回と比べて・最高・目標 */}
      <ul className="ri-chips">
        <li className="ri-chip" data-kind="prev" data-delta={delta == null ? 'none' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'}>
          <span className="ri-chip-k">前回から</span>
          {delta == null
            ? <span className="ri-chip-v">はじめて</span>
            : <span className="ri-chip-v">
              {delta > 0 ? <ArrowUpRight size={16} aria-hidden="true" /> : delta < 0 ? <ArrowDownRight size={16} aria-hidden="true" /> : <Minus size={16} aria-hidden="true" />}
              {delta > 0 ? '+' : ''}{delta}<small>pt</small>
            </span>}
          {data.prevRate != null && <span className="ri-chip-sub">{data.prevRate}% → {rate}%</span>}
        </li>
        <li className="ri-chip" data-kind="best">
          <span className="ri-chip-k">自己ベスト</span>
          <span className="ri-chip-v"><Trophy size={15} aria-hidden="true" />{data.best}<small>%</small></span>
          <span className="ri-chip-sub">{rate >= data.best && rate > 0 ? 'ベストタイ以上！' : `あと${data.best - rate}pt`}</span>
        </li>
        <li className="ri-chip" data-kind="goal">
          <span className="ri-chip-k">目標：満点{STAGE_CLEAR_PERFECTS}回</span>
          <span className="ri-goal-dots" aria-label={`満点 ${data.perfects}/${STAGE_CLEAR_PERFECTS}`}>
            {Array.from({ length: STAGE_CLEAR_PERFECTS }, (_, i) => <i key={i} data-on={i < data.perfects || undefined} />)}
          </span>
          <span className="ri-chip-sub">{left <= 0 ? '達成！' : `あと${left}回で達成`}</span>
        </li>
      </ul>

      {/* 3. この単元の回（回ごとの最高正答率） */}
      {data.rounds.length > 1 && (
        <figure className="ri-rounds" aria-label="この単元の回ごとの最高正答率">
          <figcaption><Target size={14} aria-hidden="true" />この単元の回<span>目標＝満点</span></figcaption>
          <div className="ri-rounds-plot">
            <svg className="ri-rounds-svg" viewBox={`0 0 ${data.rounds.length * 10} 100`} preserveAspectRatio="none" aria-hidden="true">
              <line className="ri-goal-line" x1="0" x2={data.rounds.length * 10} y1="1" y2="1" vectorEffect="non-scaling-stroke" />
              <line className="ri-mid-line" x1="0" x2={data.rounds.length * 10} y1="50" y2="50" vectorEffect="non-scaling-stroke" />
              {data.rounds.map((r, i) => {
                const h = r.best == null ? 3 : Math.max(4, r.best);
                return <rect key={i} className="ri-bar" data-current={r.current || undefined} data-cleared={r.cleared || undefined} data-empty={r.best == null || undefined}
                  x={i * 10 + 2.2} width={5.6} y={100 - h} height={h} rx={1.6} />;
              })}
            </svg>
          </div>
          <ol className="ri-rounds-x">
            {data.rounds.map((r, i) => (
              <li key={i} data-current={r.current || undefined}>
                <b>{r.best == null ? '—' : `${r.best}`}</b>
                <span>{r.current ? '今回' : r.label.replace('第', '').replace('回', '')}</span>
              </li>
            ))}
          </ol>
        </figure>
      )}
    </section>
  );
}
