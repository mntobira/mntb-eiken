/**
 * マイページの「カレンダー」タブ（2026-10-29 B8 作り直し・StudyPlus 風）。
 *   日付を押すと黒くなり、その日の勉強時間がすぐ下のグラフに加わる。別の日を押すとその日も並ぶ（最大7日）。
 *   もう一度押すとその日はグラフから消える。7日を超えたら、いちばん前に押した日を外す。
 *   グラフ＝日ごとの積み上げ棒（マイページと同じ「教材ごとの色」）。合計・平均・いちばん長い日も出す。
 *   C5（2026-10-29）：その下に「何を何分」の表（教材ごとの行 × 選んだ日の列）。改訂前の記録リストは削除。
 *   自分で記録したマスを押すと直す・消すの窓。ボタンは増やさない（カレンダーの日付だけで操作）。
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, dayOf, materialsByDays, monthGrid, monthOf, subjectLabel, type ManualLogStore, type ManualRecord } from './manualLogCore';
import { fmtDay, fmtSec } from './ui';

const WD = ['月', '火', '水', '木', '金', '土', '日'];
const WD_SUN = ['日', '月', '火', '水', '木', '金', '土'];
export const PICK_MAX = 7;
const PALETTE = ['#e8a33d', '#4f9d69', '#d9644a', '#7a6bc4', '#3f8fc0', '#c2577d', '#8a6d3b', '#5aa6a0'];
const level = (sec: number) => (sec <= 0 ? 0 : sec < 1800 ? 1 : sec < 3600 ? 2 : sec < 7200 ? 3 : 4);
const short = (d: string) => { const t = new Date(`${d}T12:00:00`); return { md: `${t.getMonth() + 1}/${t.getDate()}`, wd: WD_SUN[t.getDay()] }; };

/** 押した日の並び（押した順）を切りかえる。もう一度押すと外す。7日を超えたら最初に押した日を外す */
export function togglePick(picks: string[], day: string, max = PICK_MAX): string[] {
  if (picks.includes(day)) return picks.filter(d => d !== day);
  const next = [...picks, day];
  return next.length > max ? next.slice(next.length - max) : next;
}

export function CalendarTab({ store, app, onEdit }: {
  store: ManualLogStore; app: { days: Record<string, number> }; onEdit: (r: ManualRecord) => void;
}) {
  const today = dayOf(Date.now());
  const [month, setMonth] = useState(monthOf(today));
  /** 押した順。グラフと表は日付の順に並べる */
  const [picks, setPicks] = useState<string[]>([today]);
  const cells = monthGrid(month);
  const byDay = useMemo(() => {
    const m = new Map<string, ManualRecord[]>();
    for (const r of store.records) if (!r.deleted) m.set(r.day, [...(m.get(r.day) ?? []), r]);
    return m;
  }, [store]);
  const byId = useMemo(() => new Map(store.records.map(r => [r.id, r])), [store]);
  const selfSec = (d: string) => (byDay.get(d) ?? []).reduce((n, r) => n + r.minutes * 60, 0);
  const total = (d: string) => (app.days[d] ?? 0) + selfSec(d);
  const studied = cells.filter((d): d is string => !!d && d <= today && total(d) > 0).length;
  const [y, mo] = month.split('-').map(Number);
  const minMonth = monthOf(dayOf(Date.now() - 730 * 86_400_000));
  const move = (n: number) => setMonth(addMonths(month, n));

  // ── C5（2026-10-29）：マイページのグラフ・表と同じ形（教材ごとの色・何を何分） ──
  const sorted = useMemo(() => picks.slice().sort(), [picks]);
  const rows = useMemo(() => materialsByDays(store, { total: 0, days: app.days }, sorted), [store, app, sorted]);
  const color = (i: number, key: string) => (key === 'app' ? 'var(--mt-brand)' : PALETTE[i % PALETTE.length]);
  const totals = sorted.map(total);
  const sum = totals.reduce((a, b) => a + b, 0);
  const peak = Math.max(1800, ...totals);
  const best = sorted.length > 1 && sum > 0 ? sorted[totals.indexOf(Math.max(...totals))] : null;
  /** 表のマスを押したとき：自分で記録した分なら直す・消すの窓（いちばん新しい記録） */
  const editCell = (ids: string[] | undefined) => {
    const recs = (ids ?? []).map(id => byId.get(id)).filter((r): r is ManualRecord => !!r).sort((a, b) => b.createdAt - a.createdAt);
    if (recs[0]) onEdit(recs[0]);
  };

  return <>
    <div className="slog-month">
      <button type="button" onClick={() => move(-1)} disabled={month <= minMonth} aria-label="前の月"><ChevronLeft size={20} aria-hidden="true" /></button>
      <h3 aria-live="polite">{y}年{mo}月<small>　勉強した日 {studied}日</small></h3>
      <button type="button" onClick={() => move(1)} disabled={month >= monthOf(today)} aria-label="次の月"><ChevronRight size={20} aria-hidden="true" /></button>
    </div>
    <ol className="slog-cal" aria-label={`${y}年${mo}月の勉強カレンダー（日付を押すとグラフに加わる・最大${PICK_MAX}日）`} data-slog-calendar>
      {WD.map(w => <li key={w} aria-hidden="true"><span>{w}</span></li>)}
      {cells.map((d, i) => d
        ? <li key={d}><button type="button" className="slog-cell" disabled={d > today} aria-pressed={picks.includes(d)}
            data-lv={level(total(d)) || undefined} data-today={d === today || undefined} data-self={byDay.has(d) || undefined} data-future={d > today || undefined} data-day={d}
            onClick={() => setPicks(p => togglePick(p, d))}
            aria-label={`${fmtDay(d)} ${total(d) > 0 ? `勉強 ${fmtSec(total(d))}` : '記録なし'}`}>{Number(d.slice(8))}</button></li>
        : <li key={`x${i}`} aria-hidden="true" />)}
    </ol>
    <section className="slog-compare" aria-live="polite" aria-label="選んだ日の勉強時間" data-slog-compare data-count={sorted.length} style={{ ['--cols' as string]: Math.max(1, sorted.length) } as CSSProperties}>
      {sorted.length === 0
        ? <p className="slog-note">カレンダーの日付を押すと、その日に何を何分勉強したかがここに出ます（最大{PICK_MAX}日まで並べて比べられます）。</p>
        : <>
          <header className="slog-compare-head">
            <strong>{sorted.length}日分</strong>
            <span>合計 <b>{fmtSec(sum)}</b></span>
            {sorted.length > 1 && <span>平均 <b>{fmtSec(Math.round(sum / sorted.length))}</b></span>}
            {best && <span>最長 <b>{short(best).md}</b></span>}
          </header>
          {/* 棒グラフ：教材ごとに色を分けて積み上げ（マイページの7日のグラフと同じ色・同じ並び） */}
          <ol className="slog-bars" data-slog-bars aria-hidden="true">
            {sorted.map((d, i) => <li key={d} data-day={d} data-best={d === best || undefined} data-today={d === today || undefined}>
              <em>{totals[i] > 0 ? fmtSec(totals[i]) : '0分'}</em>
              <div className="slog-bar-track">
                {rows.map((r, k) => r.seconds[i] > 0 ? <i key={r.key} style={{ height: `${(r.seconds[i] / peak) * 100}%`, background: color(k, r.key) }} /> : null)}
              </div>
              <span>{d === today ? '今日' : short(d).md}<small>{short(d).wd}</small></span>
            </li>)}
          </ol>
          {/* 何を何分：教材ごとの行 × 選んだ日の列。自分で記録したマスは押すと直す・消す */}
          <div className="slog-what slog-scroll" tabIndex={0} aria-label="教材ごとの勉強時間" data-slog-what>
            {rows.length === 0
              ? <p className="slog-note">{sorted.length === 1 ? 'この日の記録はありません。' : '選んだ日の記録はありません。'}アプリの外の勉強はマイページの「学習を記録」で残せます。</p>
              : rows.map((r, k) => <article key={r.key} className="slog-what-row" aria-label={`${r.label}：${fmtSec(r.total)}`}>
                  <h4><i style={{ background: color(k, r.key) }} aria-hidden="true" /><span>{r.label}</span><small>{r.key === 'app' ? '演習・解説で計った時間' : subjectLabel(r.subject)}</small><b>{fmtSec(r.total)}</b></h4>
                  {sorted.length > 1 && <ol>{r.seconds.map((sec, i) => {
                    const ids = r.recordIds?.[i];
                    const label = `${short(sorted[i]).md} ${r.label} ${sec > 0 ? fmtSec(sec) : '0分'}`;
                    return <li key={i} data-zero={sec === 0 || undefined}>
                      {ids?.length ? <button type="button" onClick={() => editCell(ids)} aria-label={`${label}（押すと直す）`} data-record-row={ids[0]}>{fmtCell(sec)}</button> : <span aria-label={label}>{fmtCell(sec)}</span>}
                    </li>;
                  })}</ol>}
                  {sorted.length === 1 && r.recordIds?.[0]?.length ? <button type="button" className="slog-what-edit" onClick={() => editCell(r.recordIds?.[0])} data-record-row={r.recordIds[0][0]} aria-label={`${r.label} の記録を直す`}>直す</button> : null}
                </article>)}
          </div>
        </>}
    </section>
  </>;
}

/** 表のマス：「1時間24分」→「1h24」、0分は「—」 */
function fmtCell(sec: number): string {
  const m = Math.round(sec / 60);
  if (sec <= 0) return '—';
  if (m < 1) return '1分未満';
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m}分`;
}
