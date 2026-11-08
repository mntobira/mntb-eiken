/** 学習記録の画面で使う小さな部品（既存の窓・メーターの見た目に合わせる） */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { formatStudyTime } from '../../utils/studyTime';
import { noonOf } from './manualLogCore';

const WD = ['日', '月', '火', '水', '木', '金', '土'];
/** '2026-10-28' → 「10月28日（水）」 */
export function fmtDay(day: string, short = false): string {
  const d = new Date(noonOf(day));
  return short ? `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）` : `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`;
}
export const fmtSec = (s: number) => formatStudyTime(Math.max(0, Math.round(s)));
export const fmtMin = (m: number) => formatStudyTime(Math.max(0, m) * 60);

/** 既存の窓（.game-details-dialog.mt-dialog）。document.body に出す */
export function SlogDialog({ title, onClose, children, data }: { title: string; onClose: () => void; children: ReactNode; data?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  return createPortal(
    <dialog ref={ref} className="game-details-dialog mt-dialog slog-dialog" aria-labelledby={id} data-slog-dialog={data}
      onClose={onClose} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}>
      <header><h2 id={id}>{title}</h2><button type="button" onClick={onClose}>閉じる</button></header>
      <div className="game-details-body">{children}</div>
    </dialog>, document.body);
}

/** 進み具合のバー（色だけに頼らないよう、呼ぶ側で文字も出す） */
export function Meter({ ratio, kind, label }: { ratio: number; kind?: 'app' | 'self'; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return <span className="slog-meter" data-k={kind} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></span>;
}
