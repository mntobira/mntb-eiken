/**
 * マイページの「カレンダー」タブ（旧「記録」・2026-10-29 B9 で名前を変えた）。
 * 2026-10-28 作り直し・A1②。2026-10-29 B8：日付を押して最大7日をグラフで比べる。
 *   カレンダーだけ。日付を押すとその日の勉強記録が出る。
 *   集計・教材・フレンドのタブと「＋記録」ボタンはなくした（今日の記録と7日の表はマイページのタブへ、
 *   記録を書くのはマイページの「学習を記録」1か所）。自分で記録した行を押すと直す・消すの窓。
 */
import { useEffect, useMemo, useState } from 'react';
import { readStudyTime } from '../../utils/studyTime';
import { type ManualRecord } from './manualLogCore';
import { useManualLog } from './manualLogStore';
import { RecordDialog } from './RecordDialog';
import { CalendarTab } from './CalendarTab';
import './studylog.css';

export function StudyLogPage(_props: { key?: string }) {
  const [store, uid] = useManualLog();
  const [editing, setEditing] = useState<ManualRecord | null>(null);
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);
  const app = useMemo(() => readStudyTime(uid), [uid, store]);
  return (
    <section className="slog" aria-label="勉強のカレンダー" data-study-log>
      <div className="slog-body">
        <CalendarTab store={store} app={app} onEdit={setEditing} />
      </div>
      {editing && <RecordDialog record={editing} onClose={() => setEditing(null)} onSaved={setToast} />}
      {toast && <p className="mt-toast" role="status" data-slog-toast>{toast}</p>}
    </section>
  );
}
