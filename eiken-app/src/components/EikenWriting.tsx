import { syncUserData } from '../utils/userDataSync';
import { auth, FIREBASE_CONFIGURED, USE_EMULATORS } from '../firebase';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Save } from 'lucide-react';
import { EIKEN_GRADES, type EikenGrade } from '../eiken/config';
import { EIKEN_UNITS } from '../eiken/questions';
import { bookletWritingTasks } from '../eiken/writtenPractice';
import { emptyWriting, parseWriting, wordCount, writingKey, type WritingDraft, type WritingProgress } from '../eiken/writingProgress';
import { safeLocalStorage } from '../utils/safeLocalStorage';
import { USER_DATA_SYNCED_EVENT } from '../utils/userDataSyncEvent';
import './eiken-writing.css';

const gradeIds = ['eiken_5', 'eiken_4', 'eiken_3', 'eiken_pre2', 'eiken_pre2plus', 'eiken_2', 'eiken_pre1'] as const;
interface UnifiedWritingTask {
  id: string;
  key: string;
  grade: EikenGrade;
  title: string;
  instruction: string;
  source?: string;
  target: string;
  model: string;
  modelTranslation?: string;
  commentary: string;
  checklist: string[];
}
export const EIKEN_WRITING_TASKS: readonly UnifiedWritingTask[] = [
  ...EIKEN_UNITS.flatMap((unit, index) => unit.writing.map(task => ({ ...task, grade: gradeIds[index], key: `${gradeIds[index]}_writing_${task.id}` }))),
  ...bookletWritingTasks(),
];
const tasks = EIKEN_WRITING_TASKS;
const blank: WritingDraft = { text: '', checked: [], reviewed: false, updatedAt: 0 };
function read(uid: string): { data: WritingProgress; error: string } {
  try {
    const store = safeLocalStorage(); if (!store) throw new Error('保存を利用できません。入力内容をコピーして保管してください。');
    return { data: parseWriting(store.getItem(writingKey(uid))), error: '' };
  } catch (error) { return { data: emptyWriting(), error: error instanceof Error ? error.message : '保存記録を読み込めません。' }; }
}
export function EikenWriting({ uid, grade: selectedGrade, onGrade, onBack }: { uid: string; grade: EikenGrade; onGrade: (grade: EikenGrade) => void; onBack: () => void }) {
  const grade = tasks.some(task => task.grade === selectedGrade) ? selectedGrade : 'eiken_3';
  const available = useMemo(() => EIKEN_GRADES.filter(grade => tasks.some(task => task.grade === grade.id)), []);
  const gradeTasks = tasks.filter(task => task.grade === grade);
  const [taskId, setTaskId] = useState(gradeTasks[0].key);
  const task = gradeTasks.find(task => task.key === taskId) ?? gradeTasks[0];
  const [saved, setSaved] = useState(() => read(uid));
  const [message, setMessage] = useState('');
  const [showModel, setShowModel] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const current = saved.data.drafts[task.key] ?? blank;
  useEffect(() => { setShowModel(false); setMessage(''); }, [task.key]);
  useEffect(() => {
    const refresh = () => setSaved(read(uid));
    window.addEventListener(USER_DATA_SYNCED_EVENT, refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(USER_DATA_SYNCED_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, [uid]);
  const save = (patch: Partial<WritingDraft>) => {
    if (saved.error) return;
    try {
      const store = safeLocalStorage(); if (!store) throw new Error('保存できません。入力内容をコピーしてください。');
      const latest = parseWriting(store.getItem(writingKey(uid)));
      const next = { ...latest, drafts: { ...latest.drafts, [task.key]: { ...(latest.drafts[task.key] ?? blank), ...patch, updatedAt: Date.now() } } };
      store.setItem(writingKey(uid), JSON.stringify(next)); setSaved({ data: next, error: '' }); setMessage('この端末に保存済み');
    } catch (error) { setMessage(error instanceof Error ? error.message : '保存に失敗しました。'); }
  };
  return <main className="ew-page" data-writing>
    <header className="ew-header"><button type="button" onClick={onBack}><ArrowLeft size={18} />学習へ</button><h1>英検 ライティング練習</h1></header>
    <nav className="ew-controls" aria-label="英作文の課題">
      <label>級<select aria-label="ライティングの級" value={grade} onChange={event => onGrade(event.target.value as EikenGrade)}>{available.map(grade => <option key={grade.id} value={grade.id}>{grade.label}</option>)}</select></label>
      {gradeTasks.map(item => <button type="button" key={item.key} aria-pressed={item.key === task.key} onClick={() => setTaskId(item.key)}>{item.title}{saved.data.drafts[item.key]?.reviewed ? '（自己点検済み）' : ''}</button>)}
    </nav>
    {saved.error && <p role="alert">{saved.error}</p>}
    <div className="ew-workspace">
      <section className="ew-prompt" aria-labelledby="writing-task-title"><h2 id="writing-task-title">{task.title}</h2><p>{task.instruction}</p>{task.source && <blockquote lang="en">{task.source}</blockquote>}<p className="ew-target">{task.target}</p><p>独自の重点練習です。自動採点・合否判定は行いません。5級・4級の筆記ライティング課題は設けていません。</p></section>
      <section className="ew-answer"><label htmlFor="writing-answer">あなたの英文</label><textarea id="writing-answer" lang="en" value={current.text} maxLength={4000} disabled={!!saved.error} placeholder="Write your answer here." onChange={event => save({ text: event.target.value, checked: [], reviewed: false })} />
        <div className="ew-save"><span data-writing-count>{wordCount(current.text)} words</span><span role="status"><Save size={14} />{message || (current.updatedAt ? '保存した下書きから再開' : '入力はこの端末・アカウントに保存されます')}</span></div>
        <p>クラウド連携が有効なアカウントでは、他の学習記録と同じ同期対象です。「端末に保存済み」はクラウド送信完了の意味ではありません。</p>
        {auth.currentUser && (FIREBASE_CONFIGURED || USE_EMULATORS) && <button type="button" disabled={syncing || !!saved.error} onClick={async () => {
          setSyncing(true); try { await syncUserData('manual'); setMessage('クラウド同期が完了しました'); } catch (error) { setMessage(error instanceof Error ? error.message : '同期に失敗しました。'); } finally { setSyncing(false); }
        }}>{syncing ? '同期中…' : '今すぐクラウドと同期'}</button>}
        <fieldset><legend>書いた後の自己点検</legend>{task.checklist.map((check, index) => <label key={check}><input type="checkbox" checked={current.checked.includes(index)} onChange={event => save({ checked: event.target.checked ? [...current.checked, index] : current.checked.filter(i => i !== index), reviewed: false })} />{check}</label>)}</fieldset>
        <button type="button" disabled={!current.text.trim() || current.checked.length !== task.checklist.length || !!saved.error} onClick={() => save({ reviewed: true })}>自己点検を完了する</button>
        <button type="button" aria-expanded={showModel} onClick={() => setShowModel(value => !value)}><BookOpen size={16} />参考解答・解説{showModel ? 'を閉じる' : 'を見る'}</button>
        {showModel && <aside data-writing-model><h3>参考解答（一例・{wordCount(task.model)} words）</h3><p lang="en">{task.model}</p>{task.modelTranslation && <p>【参考解答の和訳】{task.modelTranslation}</p>}<p style={{ whiteSpace: 'pre-wrap' }}>{task.commentary}</p><p>同じ文章にする必要はありません。課題への応答と内容・構成・表現を確認してください。</p></aside>}
        {!!saved.data.conflicts[task.key]?.length && <details><summary>他の端末で編集した別の下書き（コピーして復元できます）</summary>{saved.data.conflicts[task.key].map((draft, index) => <textarea key={index} aria-label={`別の下書き${index + 1}`} readOnly value={draft.text} />)}</details>}
      </section>
    </div>
  </main>;
}
