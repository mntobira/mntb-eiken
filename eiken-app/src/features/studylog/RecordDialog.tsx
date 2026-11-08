/**
 * 学習記録を書く／直す窓（2026-10-27 第2段階）。
 *   必須：学習日・教科・時間（教材は任意。登録した教材から選ぶか、その場で書く）
 *   任意：学習量・コメント（「くわしく」を押したときだけ出す。毎回書かなくてよい）
 *   共有：記録ごとに選ぶ（初期は「自分だけ」）。共有はログイン中だけ。
 * 保存できなかったときは成功と表示しない。共有だけ失敗したら、そのことを出す。
 */
import { useMemo, useState } from 'react';
import { auth } from '../../firebase';
import { profileKey } from '../../utils/userStorageKeys';
import { safeLocalStorage } from '../../utils/safeLocalStorage';
import {
  AMOUNT_UNITS, COMMENT_MAX, MATERIAL_NAME_MAX, RECORD_ISSUE_TEXT, STUDY_SUBJECTS, addDays, dayOf, deleteRecord, liveMaterials,
  recentSubjects, setRecordPost, subjectLabel, upsertRecord, validateRecord, type ManualRecord,
} from './manualLogCore';
import { readManualLog, updateManualLog } from './manualLogStore';
import { checkShareable, shareRecord, unsharePost } from './studyFeed';
import { SlogDialog, fmtMin } from './ui';

const TIME_CHIPS = [15, 30, 60, 90];
const SHARE_PREF = 'manual_log_share_pref_v1';

export function profileName(uid = auth.currentUser?.uid || 'guest'): string {
  try {
    const p = JSON.parse(safeLocalStorage()?.getItem(profileKey(uid)) || '{}');
    if (typeof p.name === 'string' && p.name.trim()) return p.name.trim();
  } catch { /* 名前が無ければ下へ */ }
  return auth.currentUser?.displayName || 'なまえ未設定';
}

export interface RecordDraft { day?: string; subject?: string; materialId?: string }

export function RecordDialog({ record, draft, onClose, onSaved }: {
  record?: ManualRecord; draft?: RecordDraft; onClose: () => void; onSaved?: (msg: string) => void;
}) {
  const store = useMemo(() => readManualLog(), []);
  const today = dayOf(Date.now());
  const recent = recentSubjects(store);
  const chipSubjects = [...new Set([...recent, 'eng', 'math', 'jpn'])].slice(0, 3);
  const signedIn = !!auth.currentUser;
  const [day, setDay] = useState(record?.day ?? draft?.day ?? today);
  const [subject, setSubject] = useState(record?.subject ?? draft?.subject ?? recent[0] ?? '');
  const [materialId, setMaterialId] = useState(record?.materialId ?? draft?.materialId ?? '');
  const [materialName, setMaterialName] = useState(record && !record.materialId ? record.materialName : '');
  const [minutes, setMinutes] = useState(record ? String(record.minutes) : '');
  const [amount, setAmount] = useState(record?.amount != null ? String(record.amount) : '');
  const [unit, setUnit] = useState(record?.amountUnit ?? 'ページ');
  const [comment, setComment] = useState(record?.comment ?? '');
  const [more, setMore] = useState(!!(record?.amount != null || record?.comment));
  const [share, setShare] = useState(() => (record ? record.visibility === 'friends' : signedIn && safeLocalStorage()?.getItem(SHARE_PREF) === '1'));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false);

  // 教材を選んだら教科もそろえる。教科を変えたら、その教科の教材だけ出す
  const mats = liveMaterials(store);
  const subjectMats = mats.filter(m => !subject || m.subject === subject);
  const chosen = mats.find(m => m.id === materialId);
  const input = {
    day, subject, materialId: chosen?.id, materialName: chosen ? chosen.name : materialName, minutes: Number(minutes),
    amount: more && amount.trim() !== '' ? Number(amount) : null, amountUnit: unit, comment: more ? comment : '', visibility: share ? 'friends' as const : 'private' as const,
  };
  const issue = validateRecord(input, store, Date.now(), record?.id);
  const shareIssue = share ? checkShareable({ materialName: input.materialName, comment: input.comment }, profileName()) : null;

  const save = async () => {
    setTried(true);
    if (issue || shareIssue) return;
    setBusy(true); setError('');
    let saved: ManualRecord;
    try {
      let rec!: ManualRecord;
      updateManualLog(s => { const r = upsertRecord(s, input, Date.now(), record?.id); rec = r.record; return r.store; });
      saved = rec;
      safeLocalStorage()?.setItem(SHARE_PREF, share ? '1' : '0');
    } catch {
      setBusy(false); setError('保存できませんでした（端末の空き容量が足りない可能性があります）。'); return;
    }
    // 共有（記録の保存とは別。失敗しても記録は残る）
    let note = '記録しました';
    try {
      if (share && signedIn) {
        const postId = await shareRecord(saved, profileName());
        updateManualLog(s => setRecordPost(s, saved.id, postId));
        note = record?.postId ? '記録を直し、フレンドへの共有も更新しました' : '記録して、フレンドに共有しました';
      } else if (!share && saved.postId) {
        await unsharePost(saved.postId);
        updateManualLog(s => setRecordPost(s, saved.id, undefined));
        note = '記録を直し、共有をやめました';
      }
    } catch (e) {
      setBusy(false);
      setError(`記録は保存しました。ただし${e instanceof Error ? e.message : '共有できませんでした。'}`);
      onSaved?.('記録しました（共有はできませんでした）');
      return;
    }
    setBusy(false);
    onSaved?.(note);
    onClose();
  };

  const remove = async () => {
    if (!record) return;
    setBusy(true); setError('');
    try {
      if (record.postId) await unsharePost(record.postId);
      updateManualLog(s => deleteRecord(s, record.id));
      onSaved?.('記録を削除しました');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除できませんでした。');
    } finally { setBusy(false); }
  };

  const show = (k: string) => tried && issue === k;
  return (
    <SlogDialog title={record ? '記録を直す' : '学習を記録する'} onClose={onClose} data="record">
      <form className="slog-form" onSubmit={e => { e.preventDefault(); void save(); }} noValidate>
        <div className="row">
          <label className="f"><span>学習日</span>
            <input type="date" value={day} max={today} min={addDays(today, -730)} onChange={e => setDay(e.target.value)} aria-invalid={show('day') || show('future') || show('too_old') || undefined} data-record-day />
          </label>
          <label className="f"><span>学習時間（分）</span>
            <input type="number" inputMode="numeric" min={1} max={720} step={1} value={minutes} placeholder="例 45" onChange={e => setMinutes(e.target.value)}
              aria-invalid={show('minutes_low') || show('minutes_high') || show('day_total') || undefined} aria-describedby="record-min-help" data-record-minutes />
          </label>
        </div>
        <div className="slog-chips" role="group" aria-label="学習時間をえらぶ">
          {TIME_CHIPS.map(m => <button type="button" key={m} aria-pressed={Number(minutes) === m} onClick={() => setMinutes(String(m))} aria-label={fmtMin(m)}>{m}分</button>)}
        </div>
        <div className="slog-chips" role="group" aria-label="教科">
          {chipSubjects.map(id => <button type="button" key={id} aria-pressed={subject === id} onClick={() => { setSubject(id); if (chosen && chosen.subject !== id) setMaterialId(''); }} data-record-subject={id}>{subjectLabel(id)}</button>)}
          <label className="f" style={{ flex: '1 1 96px' }}><span className="sr-only">ほかの教科</span>
            <select value={chipSubjects.includes(subject) ? '' : subject} onChange={e => { if (e.target.value) { setSubject(e.target.value); setMaterialId(''); } }} aria-invalid={show('subject') || undefined}>
              <option value="">他教科</option>
              {STUDY_SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <label className="f"><span>教材・内容（任意）</span>
          {subjectMats.length > 0 && <select value={materialId} onChange={e => { const id = e.target.value; setMaterialId(id); const m = mats.find(x => x.id === id); if (m) setSubject(m.subject); }} data-record-material>
            <option value="">{materialName ? '下に書いた内容' : '登録した教材から選ぶ…'}</option>
            {subjectMats.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>}
          {!chosen && <input value={materialName} maxLength={MATERIAL_NAME_MAX} onChange={e => setMaterialName(e.target.value)} placeholder="例 青チャート・学校の課題・塾の授業" aria-invalid={show('material') || undefined} data-record-material-name />}
        </label>
        {more ? <>
          <div className="row">
            <label className="f"><span>学習量（任意）</span><input type="number" inputMode="numeric" min={0} max={99999} value={amount} onChange={e => setAmount(e.target.value)} placeholder="例 12" aria-invalid={show('amount') || undefined} /></label>
            <label className="f"><span>単位</span><select value={unit} onChange={e => setUnit(e.target.value)}>{AMOUNT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></label>
          </div>
          <label className="f"><span>コメント（任意・{[...comment].length}/{COMMENT_MAX}）</span>
            <textarea value={comment} maxLength={COMMENT_MAX} rows={2} onChange={e => setComment(e.target.value)} placeholder="例 二次関数の最大最小を復習" aria-invalid={show('comment') || undefined} />
          </label>
        </> : <button type="button" className="slog-more" onClick={() => setMore(true)}>学習量・コメントも書く</button>}
        <div className="ps-toggle-row">
          <div className="ps-toggle-text"><p>フレンドに共有</p><small>{signedIn ? (share ? '名前・教科・教材・時間・コメントが見えます' : 'いまは自分だけ') : 'Googleログインで使えます'}</small></div>
          <button type="button" role="switch" aria-checked={share} aria-label="この記録をフレンドに共有する" className="ps-switch" disabled={!signedIn} onClick={() => setShare(v => !v)} data-record-share><span /></button>
        </div>
        <p id="record-min-help" className={tried && (issue || shareIssue) ? 'slog-error' : 'slog-note'} role={tried && (issue || shareIssue) ? 'alert' : undefined}>
          {tried && issue ? RECORD_ISSUE_TEXT[issue] : tried && shareIssue ? shareIssue : '自分で記録した時間は「自己申告」として、アプリで計った時間と分けて数えます。'}
        </p>
        {error && <p className="slog-error" role="alert">{error}</p>}
        <div className="slog-actions">
          {record && (confirmDelete
            ? <button type="button" className="mt-btn mt-btn-secondary" data-danger onClick={() => void remove()} disabled={busy} data-record-delete-confirm>本当に削除</button>
            : <button type="button" className="mt-btn mt-btn-secondary" data-danger onClick={() => setConfirmDelete(true)} disabled={busy} data-record-delete>削除</button>)}
          <button type="submit" className="mt-btn mt-btn-primary" disabled={busy} data-record-save>{busy ? '保存中…' : record ? '保存' : '記録する'}</button>
        </div>
      </form>
    </SlogDialog>
  );
}
