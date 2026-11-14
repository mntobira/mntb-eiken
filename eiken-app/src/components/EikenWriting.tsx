import { syncUserData } from '../utils/userDataSync';
import { auth, FIREBASE_CONFIGURED, USE_EMULATORS } from '../firebase';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, FileText, Mail, MessageSquareQuote, Save } from 'lucide-react';
import { EIKEN_GRADES, type EikenGrade } from '../eiken/config';
import { EIKEN_UNITS } from '../eiken/questions';
import { bookletWritingTasks } from '../eiken/writtenPractice';
import { emptyWriting, parseWriting, wordCount, writingKey, type WritingDraft, type WritingProgress } from '../eiken/writingProgress';
import { safeLocalStorage } from '../utils/safeLocalStorage';
import { USER_DATA_SYNCED_EVENT } from '../utils/userDataSyncEvent';
import './eiken-writing.css';

const gradeIds = ['eiken_5', 'eiken_4', 'eiken_3', 'eiken_pre2', 'eiken_pre2plus', 'eiken_2', 'eiken_pre1'] as const;
export interface UnifiedWritingTask {
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
  round?: number;
  bookletId?: string;
}
export const EIKEN_WRITING_TASKS: readonly UnifiedWritingTask[] = [
  ...EIKEN_UNITS.flatMap((unit, index) =>
    unit.writing.map(task => ({
      ...task,
      grade: gradeIds[index],
      key: `${gradeIds[index]}_writing_${task.id}`,
    })),
  ),
  ...bookletWritingTasks(),
];
const tasks = EIKEN_WRITING_TASKS;
const blank: WritingDraft = { text: '', checked: [], reviewed: false, updatedAt: 0 };

function read(uid: string): { data: WritingProgress; error: string } {
  try {
    const store = safeLocalStorage();
    if (!store) throw new Error('保存を利用できません。入力内容をコピーして保管してください。');
    return { data: parseWriting(store.getItem(writingKey(uid))), error: '' };
  } catch (error) {
    return { data: emptyWriting(), error: error instanceof Error ? error.message : '保存記録を読み込めません。' };
  }
}

function shortTaskKind(item: UnifiedWritingTask): { label: string; kind: 'email' | 'summary' | 'essay' | 'basic' } {
  if (item.id.endsWith('email') || item.title.includes('メール')) return { label: 'Eメール返信', kind: 'email' };
  if (item.id.endsWith('summary') || item.title.includes('要約')) return { label: '英文要約', kind: 'summary' };
  if (item.id.endsWith('essay') || item.title.includes('意見')) return { label: '英作文（意見論述）', kind: 'essay' };
  return { label: item.title, kind: 'basic' };
}

export function EikenWriting({
  uid,
  grade: selectedGrade,
  onGrade,
  onBack,
  initialTaskKey,
}: {
  uid: string;
  grade: EikenGrade;
  onGrade: (grade: EikenGrade) => void;
  onBack: () => void;
  initialTaskKey?: string | null;
}) {
  const grade = tasks.some(task => task.grade === selectedGrade) ? selectedGrade : 'eiken_3';
  const available = useMemo(() => EIKEN_GRADES.filter(g => tasks.some(task => task.grade === g.id)), []);
  const gradeTasks = useMemo(() => tasks.filter(task => task.grade === grade), [grade]);

  // Group into "基礎演習（導入）" (round === undefined) and Round 1..N
  const groups = useMemo(() => {
    const basic = gradeTasks.filter(t => t.round == null);
    const byRound = new Map<number, UnifiedWritingTask[]>();
    for (const t of gradeTasks) {
      if (t.round != null) {
        byRound.set(t.round, [...(byRound.get(t.round) ?? []), t]);
      }
    }
    const list: { id: string; label: string; shortLabel: string; items: UnifiedWritingTask[] }[] = [];
    for (const [r, items] of [...byRound.entries()].sort((a, b) => a[0] - b[0])) {
      list.push({ id: `r${r}`, label: `筆記 第${r}回`, shortLabel: `第${r}回`, items });
    }
    if (basic.length > 0) {
      list.push({ id: 'basic', label: '基礎練習（単元）', shortLabel: '基礎練習', items: basic });
    }
    return list;
  }, [gradeTasks]);

  const [taskId, setTaskId] = useState(() => {
    if (initialTaskKey && gradeTasks.some(t => t.key === initialTaskKey)) return initialTaskKey;
    return groups[0]?.items[0]?.key ?? gradeTasks[0].key;
  });

  useEffect(() => {
    if (initialTaskKey && gradeTasks.some(t => t.key === initialTaskKey)) {
      setTaskId(initialTaskKey);
      return;
    }
    if (!gradeTasks.some(t => t.key === taskId)) {
      setTaskId(groups[0]?.items[0]?.key ?? gradeTasks[0].key);
    }
  }, [grade, gradeTasks, groups, initialTaskKey, taskId]);

  const task = gradeTasks.find(t => t.key === taskId) ?? groups[0]?.items[0] ?? gradeTasks[0];
  const activeGroup = groups.find(g => g.items.some(i => i.key === task.key)) ?? groups[0];

  const [saved, setSaved] = useState(() => read(uid));
  const [message, setMessage] = useState('');
  const [showModel, setShowModel] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const current = saved.data.drafts[task.key] ?? blank;

  useEffect(() => {
    setShowModel(false);
    setMessage('');
  }, [task.key]);

  useEffect(() => {
    const refresh = () => setSaved(read(uid));
    window.addEventListener(USER_DATA_SYNCED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(USER_DATA_SYNCED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [uid]);

  const save = (patch: Partial<WritingDraft>) => {
    if (saved.error) return;
    try {
      const store = safeLocalStorage();
      if (!store) throw new Error('保存できません。入力内容をコピーしてください。');
      const latest = parseWriting(store.getItem(writingKey(uid)));
      const next = {
        ...latest,
        drafts: {
          ...latest.drafts,
          [task.key]: { ...(latest.drafts[task.key] ?? blank), ...patch, updatedAt: Date.now() },
        },
      };
      store.setItem(writingKey(uid), JSON.stringify(next));
      setSaved({ data: next, error: '' });
      setMessage('この端末に保存済み');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存に失敗しました。');
    }
  };

  const reviewedCount = gradeTasks.filter(t => saved.data.drafts[t.key]?.reviewed).length;

  return (
    <main className="ew-page" data-writing>
      <header className="ew-header">
        <button type="button" className="ew-back-btn" onClick={onBack}>
          <ArrowLeft size={18} />学習へ
        </button>
        <div className="ew-header-main">
          <h1>英検 ライティング練習</h1>
          <span className="ew-progress-pill">
            自己点検済み <b>{reviewedCount}</b> / {gradeTasks.length} 課題
          </span>
        </div>
      </header>

      <nav className="ew-picker" aria-label="英作文の課題選択">
        <div className="ew-picker-top">
          <div className="ew-grade-tabs" role="tablist" aria-label="級の切り替えタブ">
            {available.map(g => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={g.id === grade}
                className="ew-grade-tab"
                data-active={g.id === grade || undefined}
                onClick={() => onGrade(g.id)}
              >
                {g.label.replace(/^英検/, '')}
              </button>
            ))}
          </div>

          <label className="ew-select-fallback">
            <span>級</span>
            <select aria-label="ライティングの級" value={grade} onChange={event => onGrade(event.target.value as EikenGrade)}>
              {available.map(g => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="ew-rounds-strip" role="list" aria-label="回を選択">
          {groups.map(group => {
            const isCurrentGroup = group.id === activeGroup.id;
            const doneAll = group.items.every(it => saved.data.drafts[it.key]?.reviewed);
            const hasDraft = group.items.some(it => (saved.data.drafts[it.key]?.text ?? '').trim().length > 0);
            return (
              <button
                key={group.id}
                type="button"
                role="listitem"
                className="ew-round-chip"
                data-active={isCurrentGroup || undefined}
                data-done={doneAll || undefined}
                data-draft={(!doneAll && hasDraft) || undefined}
                onClick={() => setTaskId(group.items[0].key)}
              >
                <span>{group.shortLabel}</span>
                {doneAll && <CheckCircle2 size={14} aria-label="完了" />}
              </button>
            );
          })}
        </div>

        <div className="ew-subtasks" role="group" aria-label={`${activeGroup.label}の課題`}>
          <span className="ew-subtasks-label">{activeGroup.label}：</span>
          <div className="ew-subtasks-buttons">
            {activeGroup.items.map((item, idx) => {
              const info = shortTaskKind(item);
              const draft = saved.data.drafts[item.key];
              const isReviewed = !!draft?.reviewed;
              const wc = draft?.text ? wordCount(draft.text) : 0;
              const Icon = info.kind === 'email' ? Mail : info.kind === 'summary' ? FileText : MessageSquareQuote;
              return (
                <button
                  type="button"
                  key={item.key}
                  className="ew-task-card"
                  aria-pressed={item.key === task.key}
                  onClick={() => setTaskId(item.key)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span className="ew-task-card-text">
                    <strong>{activeGroup.id === 'basic' ? item.title : `課題${idx + 1}：${info.label}`}</strong>
                    <small>
                      {isReviewed ? '自己点検済み' : wc > 0 ? `下書きあり（${wc}語）` : '未着手'}
                    </small>
                  </span>
                  {isReviewed && <CheckCircle2 size={16} className="ew-done-icon" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {saved.error && <p role="alert">{saved.error}</p>}

      <div className="ew-workspace">
        <section className="ew-prompt" aria-labelledby="writing-task-title">
          <h2 id="writing-task-title">{task.title}</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{task.instruction}</p>
          {task.source && <blockquote lang="en">{task.source}</blockquote>}
          <p className="ew-target">{task.target}</p>
          <p className="ew-disclaimer">独自の重点練習です。自動採点・合否判定は行いません。5級・4級の筆記ライティング課題は設けていません。</p>
        </section>

        <section className="ew-answer">
          <label htmlFor="writing-answer">あなたの英文</label>
          <textarea
            id="writing-answer"
            lang="en"
            value={current.text}
            maxLength={4000}
            disabled={!!saved.error}
            placeholder="Write your answer here."
            onChange={event => save({ text: event.target.value, checked: [], reviewed: false })}
          />
          <div className="ew-save">
            <span data-writing-count><strong>{wordCount(current.text)}</strong> words</span>
            <span role="status">
              <Save size={14} />
              {message || (current.updatedAt ? '保存した下書きから再開' : '入力はこの端末・アカウントに保存されます')}
            </span>
          </div>
          <p className="ew-sync-note">クラウド連携が有効なアカウントでは、他の学習記録と同じ同期対象です。「端末に保存済み」はクラウド送信完了の意味ではありません。</p>
          {auth.currentUser && (FIREBASE_CONFIGURED || USE_EMULATORS) && (
            <button
              type="button"
              disabled={syncing || !!saved.error}
              onClick={async () => {
                setSyncing(true);
                try {
                  await syncUserData('manual');
                  setMessage('クラウド同期が完了しました');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : '同期に失敗しました。');
                } finally {
                  setSyncing(false);
                }
              }}
            >
              {syncing ? '同期中…' : '今すぐクラウドと同期'}
            </button>
          )}
          <fieldset>
            <legend>書いた後の自己点検</legend>
            {task.checklist.map((check, index) => (
              <label key={check}>
                <input
                  type="checkbox"
                  checked={current.checked.includes(index)}
                  onChange={event =>
                    save({
                      checked: event.target.checked
                        ? [...current.checked, index]
                        : current.checked.filter(i => i !== index),
                      reviewed: false,
                    })
                  }
                />
                {check}
              </label>
            ))}
          </fieldset>
          <div className="ew-actions">
            <button
              type="button"
              className="ew-primary-btn"
              disabled={!current.text.trim() || current.checked.length !== task.checklist.length || !!saved.error}
              onClick={() => save({ reviewed: true })}
            >
              <CheckCircle2 size={16} />
              {current.reviewed ? '自己点検済み' : '自己点検を完了する'}
            </button>
            <button type="button" aria-expanded={showModel} onClick={() => setShowModel(value => !value)}>
              <BookOpen size={16} />参考解答・解説{showModel ? 'を閉じる' : 'を見る'}
            </button>
          </div>
          {showModel && (
            <aside data-writing-model>
              <h3>参考解答（一例・{wordCount(task.model)} words）</h3>
              <p lang="en">{task.model}</p>
              {task.modelTranslation && <p>【参考解答の和訳】{task.modelTranslation}</p>}
              <p style={{ whiteSpace: 'pre-wrap' }}>{task.commentary}</p>
              <p>同じ文章にする必要はありません。課題への応答と内容・構成・表現を確認してください。</p>
            </aside>
          )}
          {!!saved.data.conflicts[task.key]?.length && (
            <details>
              <summary>他の端末で編集した別の下書き（コピーして復元できます）</summary>
              {saved.data.conflicts[task.key].map((draft, index) => (
                <textarea key={index} aria-label={`別の下書き${index + 1}`} readOnly value={draft.text} />
              ))}
            </details>
          )}
        </section>
      </div>
    </main>
  );
}
