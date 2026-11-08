/**
 * マイページの「マイページ」タブ＝今日の勉強記録（2026-10-28 作り直し・A1／A3）。
 *   上：とびら君・称号・Lv・マナコイン（もと別カードだったものをここへまとめた）＋名前・志望校・志・編集
 *   中：今日・今週・今月・累計 ／ 連続日数・解いた大問・バッジ・対戦
 *   下：この7日の勉強時間（教材ごとに色分けした棒）と、教材ごとの7日の表（スタディプラスの表記を参考）
 *   ボタンは「学習を記録」だけ。カレンダーは上の「記録」タブ。数字は端末の実際の記録から計算する（ダミーは出さない）。
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Coins, GraduationCap, Pencil, Plus, School } from 'lucide-react';
import { auth } from '../../firebase';
import { equippedTitleLabel } from '../../battle/core/growth';
import { GrowthAvatar, LevelBar } from '../../battle/ui/GrowthParts';
import { useGrowthProgress } from '../../hooks/useGrowthProgress';
import { readStudyTime } from '../../utils/studyTime';
import { profileKey } from '../../utils/userStorageKeys';
import { safeLocalStorage } from '../../utils/safeLocalStorage';
import { normalizeGrade } from '../../utils/publicProfileCore';
import { readOwnPublicStudyProfile } from '../../utils/publicStudyProfile';
import { dayOf, summarize, weekByMaterial, type ManualRecord } from './manualLogCore';
import { useManualLog } from './manualLogStore';
import { RecordDialog } from './RecordDialog';
import { fmtSec } from './ui';
import { CountUp } from '../../components/ui/CountUp';
import './studylog.css';

/** 教材ごとの色（棒と表の点で同じ色）。アプリ内の時間はいつも青 */
const PALETTE = ['#e8a33d', '#4f9d69', '#d9644a', '#7a6bc4', '#3f8fc0', '#c2577d', '#8a6d3b', '#5aa6a0'];
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const fmtShort = (d: string) => { const t = new Date(`${d}T12:00:00`); return `${t.getMonth() + 1}/${t.getDate()}`; };

function readProfile(uid: string) {
  try {
    const p = JSON.parse(safeLocalStorage()?.getItem(profileKey(uid)) || '{}');
    const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    return { name: s(p.name), grade: normalizeGrade(s(p.grade)), school: s(p.targetSchool), motto: s(p.motto), isPublic: p.profilePublic === true };
  } catch { return { name: '', grade: '', school: '', motto: '', isPublic: false }; }
}

/** 表のマス用：「1時間24分」を2行に分けて入れる */
function Cell({ sec }: { sec: number }) {
  const m = Math.floor(sec / 60);
  if (m < 1) return <>{sec > 0 ? '1分未満' : '0分'}</>;
  const h = Math.floor(m / 60);
  return h > 0 ? <>{h}時間{m % 60 ? <><br />{m % 60}分</> : null}</> : <>{m}分</>;
}

export function MyStudyCard({ onEdit }: { onEdit: () => void }) {
  const [store, uid] = useManualLog();
  const { progress } = useGrowthProgress();
  const [recording, setRecording] = useState(false);
  /** D11：表のマス（自分で記録した分）を押したときに直す・消す記録 */
  const [editing, setEditing] = useState<ManualRecord | null>(null);
  /** B10：0＝この7日、-1＝その前の7日 …（最大12週前まで） */
  const [weekOffset, setWeekOffset] = useState(0);
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);
  const profile = useMemo(() => readProfile(uid), [uid]);
  const app = useMemo(() => readStudyTime(uid), [uid, store]);
  const sum = useMemo(() => summarize(store, app), [store, app]);
  const week = useMemo(() => weekByMaterial(store, app, Date.now() + weekOffset * 7 * 86_400_000), [store, app, weekOffset]);
  const today = dayOf(Date.now());
  const name = profile.name || auth.currentUser?.displayName || (auth.currentUser ? 'なまえ未設定' : 'ゲスト');
  const color = (i: number, key: string) => (key === 'app' ? 'var(--mt-brand)' : PALETTE[i % PALETTE.length]);
  // D11（2026-10-30）：マスを押すと、そのマスのいちばん新しい自分の記録を直す・消す（カレンダーと同じ）
  const byId = useMemo(() => new Map(store.records.map(r => [r.id, r])), [store]);
  const editCell = (ids: string[] | undefined) => {
    const recs = (ids ?? []).map(id => byId.get(id)).filter((r): r is ManualRecord => !!r && !r.deleted).sort((a, b) => b.createdAt - a.createdAt);
    if (recs[0]) setEditing(recs[0]);
  };
  const dayTotals = week.days.map((_, d) => week.rows.reduce((n, r) => n + r.seconds[d], 0));
  const peak = Math.max(1800, ...dayTotals);
  const title = progress ? equippedTitleLabel(progress) : '';
  // C4（2026-10-29）：赤い点は「プロフィールを公開」をオンにしていないときだけ。
  //   端末の保存（profilePublic）は古いことがあるので、サーバーの公開状態を見て決める（読めないときは端末の値）
  const [serverPublic, setServerPublic] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    if (auth.currentUser) void readOwnPublicStudyProfile().then(p => { if (alive) setServerPublic(!!p); }).catch(() => { /* 読めなければ端末の値で判断 */ });
    return () => { alive = false; };
  }, [uid]);
  const notPublic = !!auth.currentUser && !(serverPublic ?? profile.isPublic);

  return (
    <section className="mt-card mystudy" aria-label="今日の勉強記録" data-my-study>
      <div className="mystudy-head">
        <div className="mystudy-avatar">{progress && <GrowthAvatar progress={progress} size={56} />}</div>
        <div className="mystudy-who">
          <h2>{name}</h2>
          <p>
            {title && <span className="mystudy-title">{title}</span>}
            <span><Coins size={14} aria-hidden="true" /><b>{progress?.coins.toLocaleString() ?? '—'}</b>マナコイン</span>
          </p>
          {progress && <LevelBar xp={progress.xp} compact />}
        </div>
        {/* B3：ログインしていて非公開なら、赤い点で「公開できていない」と知らせる */}
        <button type="button" className={`mt-btn mt-btn-secondary${notPublic ? ' mystudy-edit-alert' : ''}`} onClick={onEdit} data-my-study-edit data-not-public={notPublic || undefined}
          aria-label={notPublic ? 'プロフィールを編集（まだ公開されていません）' : 'プロフィールを編集'}><Pencil size={15} aria-hidden="true" />編集</button>
      </div>
      {(profile.grade || profile.school || profile.motto) && <p className="mystudy-goal">
        {profile.grade && <span><GraduationCap size={14} aria-hidden="true" />{profile.grade}</span>}
        {profile.school && <span><School size={14} aria-hidden="true" />{profile.school}</span>}
        {profile.motto && <span className="mystudy-motto">「{profile.motto}」</span>}
      </p>}
      <dl className="slog-sum" aria-label="学習時間（アプリで計測＋自分で記録）">
        <div data-today><dt>今日</dt><dd><CountUp value={sum.today.total} fromZero duration={900} delay={120} format={fmtSec} /></dd></div>
        <div><dt>今週</dt><dd><CountUp value={sum.week.total} fromZero duration={900} delay={200} format={fmtSec} /></dd></div>
        <div><dt>今月</dt><dd><CountUp value={sum.month.total} fromZero duration={900} delay={280} format={fmtSec} /></dd></div>
        <div><dt>累計</dt><dd><CountUp value={sum.all.total} fromZero duration={900} delay={360} format={fmtSec} /></dd></div>
      </dl>
      <button type="button" className="mt-btn mt-btn-primary mystudy-record" onClick={() => setRecording(true)} data-my-study-record><Plus size={16} aria-hidden="true" />学習を記録</button>

      <section className="mystudy-week" aria-labelledby="mystudy-week-title" data-my-study-week>
        <div className="mystudy-week-head">
          <button type="button" className="mystudy-week-nav" onClick={() => setWeekOffset(o => Math.max(-12, o - 1))} disabled={weekOffset <= -12} aria-label="前の7日を見る" data-week-prev><ChevronLeft size={18} aria-hidden="true" /></button>
          <h3 id="mystudy-week-title" className="mystudy-week-title" aria-live="polite">
            {weekOffset === 0 ? 'この7日の勉強時間' : `${fmtShort(week.days[0])}〜${fmtShort(week.days[6])}`}
            <small>{weekOffset === 0 ? '今日は枠つき' : `合計 ${fmtSec(dayTotals.reduce((a, b) => a + b, 0))}`}</small>
          </h3>
          <button type="button" className="mystudy-week-nav" onClick={() => setWeekOffset(o => Math.min(0, o + 1))} disabled={weekOffset >= 0} aria-label="次の7日を見る" data-week-next><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
        <ol key={weekOffset} className="mystudy-bars" aria-hidden="true">
          {week.days.map((d, i) => <li key={d} data-today={d === today || undefined} data-best={dayTotals[i] > 0 && dayTotals[i] === peakValue(dayTotals) || undefined}>
            <small>{dayTotals[i] > 0 ? <Cell sec={dayTotals[i]} /> : ''}</small>
            <span className="bar" style={{ height: `${Math.max(3, Math.round((dayTotals[i] / peak) * 100))}%` }}>
              {week.rows.map((r, k) => r.seconds[i] > 0 ? <i key={r.key} style={{ flex: r.seconds[i], background: color(k, r.key) }} /> : null)}
            </span>
          </li>)}
        </ol>
        <ol className="mystudy-days" aria-hidden="true">
          {week.days.map(d => { const t = new Date(`${d}T12:00:00`); return <li key={d} data-today={d === today || undefined}>{d === today ? '今日' : `${t.getMonth() + 1}/${t.getDate()}`}<small>{WD[t.getDay()]}</small></li>; })}
        </ol>
        <div className="mystudy-table slog-scroll" tabIndex={0} aria-label="教材ごとの7日間の勉強時間" data-my-study-table>
          {week.rows.length === 0
            ? <p className="slog-note">{weekOffset === 0 ? 'この7日の記録はまだありません。参考書・学校の課題・塾など、アプリの外の勉強も「学習を記録」で残せます。' : 'この7日の記録はありません。'}</p>
            : week.rows.map((r, k) => <article key={r.key} className="mystudy-row" aria-label={`${r.label}：7日で ${fmtSec(r.total)}`}>
                <h3><i style={{ background: color(k, r.key) }} aria-hidden="true" />{r.label}</h3>
                <ol>{r.seconds.map((s, i) => {
                  const ids = r.recordIds?.[i];
                  const label = `${fmtShort(week.days[i])} ${r.label} ${fmtSec(s)}`;
                  return <li key={i} data-zero={s === 0 || undefined} data-today={week.days[i] === today || undefined} data-editable={ids?.length ? true : undefined}>
                    {ids?.length
                      ? <button type="button" onClick={() => editCell(ids)} aria-label={`${label}（押すと直す・消す）`} data-record-row={ids[0]}><Cell sec={s} /></button>
                      : <span aria-label={label}><Cell sec={s} /></span>}
                  </li>;
                })}</ol>
              </article>)}
        </div>
      </section>
      {recording && <RecordDialog onClose={() => setRecording(false)} onSaved={setToast} />}
      {editing && <RecordDialog record={editing} onClose={() => setEditing(null)} onSaved={setToast} />}
      {toast && <p className="mt-toast" role="status" data-slog-toast>{toast}</p>}
    </section>
  );
}

/** 7日のうち一番長く勉強した日の秒数（0 なら印を付けない） */
function peakValue(totals: number[]): number { return Math.max(0, ...totals); }
