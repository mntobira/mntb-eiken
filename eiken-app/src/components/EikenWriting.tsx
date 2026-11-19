import { syncUserData } from '../utils/userDataSync';
import { auth, FIREBASE_CONFIGURED, USE_EMULATORS } from '../firebase';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, FileText, Mail, MessageSquareQuote, PenLine, Save } from 'lucide-react';
import { EIKEN_GRADES, type EikenGrade } from '../eiken/config';
import { EIKEN_UNITS } from '../eiken/questions';
import { bookletWritingTasks } from '../eiken/writtenPractice';
import { emptyWriting, parseWriting, wordCount, writingKey, type WritingDraft, type WritingProgress } from '../eiken/writingProgress';
import { safeLocalStorage } from '../utils/safeLocalStorage';
import { USER_DATA_SYNCED_EVENT } from '../utils/userDataSyncEvent';
import { StudentWritingSubmitPanel } from '../sugoroku/writing-review/StudentWritingSubmitPanel';
import './eiken-writing.css';

const gradeIds = ['eiken_5', 'eiken_4', 'eiken_3', 'eiken_pre2', 'eiken_pre2plus', 'eiken_2', 'eiken_pre1', 'eiken_1'] as const;
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

function parseTargetRange(target: string): [number, number] | null {
  const m = target.match(/(\d+)\s*[〜～-]\s*(\d+)\s*語/);
  if (!m) return null;
  const min = Number(m[1]);
  const max = Number(m[2]);
  return Number.isFinite(min) && Number.isFinite(max) && max > 0 ? [min, max] : null;
}

function structureHintsForKind(kind: 'email' | 'summary' | 'essay' | 'basic'): string[] {
  if (kind === 'email') {
    return [
      '① 相手の質問・提案への回答と理由を1〜2文で明確に書く',
      '② 場面に沿った具体的な質問を2つ（疑問文の語順で）添える',
    ];
  }
  if (kind === 'summary') {
    return [
      '① 第1段落の導入・背景を自分の言葉で1文に圧縮する',
      '② 利点と課題（または対比）を落とさず指定語数内に収める',
    ];
  }
  if (kind === 'essay') {
    return [
      '① 冒頭で自分の立場（賛成／反対）を明確に宣言する',
      '② 互いに重ならない2つの理由（First, ... / Second, ...）と具体例を述べ、結論で締める',
    ];
  }
  return ['課題の条件をすべて満たし、主語・動詞の対応と時制を確認する'];
}

type WritingNote = [phrase: string, meaning: string, use: string];

// Each highlight is an exact excerpt of its own model, not a generic word list.
const gradeOneNotes: Record<string, WritingNote[]> = {
  roundasummary: [
    ['rainfall-independent drinking water', '降雨に依存しない飲料水', '「雨が少なくても供給できる」という利点を、複合形容詞で短くまとめる。'],
    ['relieve pressure on overused rivers and aquifers', '過剰利用されている河川・帯水層の負担を減らす', 'relieve pressure on ～ で、どの資源が守られるのかを具体化する。'],
    ['advise against relying on desalination alone', '淡水化だけに頼らないよう勧める', 'advise against ～ing で、淡水化そのものへの反対ではないことを示す。'],
  ],
  roundaessay: [
    ['undermines shared democratic deliberation', '民主的な公開討議を損なう', 'undermine は制度や信頼を徐々に弱めるときに使う。ここでは公開広告との対比が理由を支える。'],
    ['creates powerful incentives for invasive personal data harvesting', 'プライバシーを侵害する個人データ収集を強く促す', 'create incentives for ～ で、広告の仕組みが望ましくない行動を誘発する因果を示す。'],
    ['levels the civic playing field', '政治参加の条件を公平にする', 'level the playing field は、不公平な競争条件をならすという比喩。'],
  ],
  roundbsummary: [
    ['have prompted industrial groups to propose', '企業団体が提案するきっかけとなった', 'prompt A to do で、鉱物需要と採取提案との関係を一文に収める。'],
    ['may reduce projected metal shortages', '予測される金属不足を和らげる可能性がある', 'may を残し、代替技術で不足が解消すると断定しない。'],
    ['urge an international moratorium', '国際的な一時停止を求める', 'moratorium は恒久的な禁止ではない。until 以下で解除条件を示す。'],
  ],
  roundbessay: [
    ['bear a binding legal obligation', '法的拘束力のある義務を負う', '任意の支援ではなく法的義務という立場を明示する。provided ～ で条件も示せる。'],
    ['despite contributing minimally to global warming', '地球温暖化への寄与がわずかであるにもかかわらず', 'despite ～ing で排出責任と被害の大きさの不均衡を際立たせる。'],
    ['intensify involuntary cross-border displacement', '意思に反する越境移動を深刻化させる', '気候被害が当事国だけにとどまらないことを具体的な影響で示す。'],
  ],
  summary: [
    ['mandate open-access publishing', 'オープンアクセス出版を義務づける', 'mandate は任意の推奨ではなく、助成機関が課す要件を表す。'],
    ['has generated new inequities', '新たな不公平を生んだ', '読み手が払う購読料と、書き手が払う掲載料の違いを押さえる。'],
    ['without pricing out authors', '費用を理由に著者を締め出さずに', 'price out は、価格が高いため参加できなくなることを表す。'],
  ],
  essay: [
    ['rather than relying on optional aid', '任意の援助に頼るのではなく', 'rather than ～ing で比較対象を示し、法的義務を支持する立場を明確にする。'],
    ['predictable statutory funding', '予測可能な、法に基づく資金拠出', 'predictable は金額の大きさでなく、長期計画を立てられる確実性を表す。'],
    ['safeguards global economic and humanitarian security', '世界の経済・人道上の安全を守る', '食料供給や緊急援助の具体例を続け、他国にも利益があると裏づける。'],
  ],
};

function GradeOneModel({ task, kind }: { task: UnifiedWritingTask; kind: string }) {
  const notes = gradeOneNotes[task.id] ?? [];
  const essay = kind === 'essay';
  const labels = essay ? ['序論・立場', '理由 1', '理由 2', '理由 3', '結論'] : ['背景・要点', '対比・課題', '結論・提案'];
  const paragraphs = essay ? task.model.split(/\n+/).filter(Boolean) :
    task.model.split(/ (?=(?:However|Yet|To maintain|Consequently),? )/);
  const [sourceTranslation, explanation] = task.commentary.startsWith('【元文の和訳】')
    ? task.commentary.replace(/^【元文の和訳】\s*/, '').split(/\n\n【構成・表現のポイント】\s*/)
    : ['', task.commentary.replace(/^【構成・表現のポイント】\s*/, '')];
  const highlight = (text: string) => {
    const matches = notes.map(([phrase]) => ({ phrase, at: text.indexOf(phrase) })).filter(x => x.at >= 0).sort((a, b) => a.at - b.at);
    let cursor = 0;
    const parts = matches.map(({ phrase, at }) => {
      const before = text.slice(cursor, at);
      cursor = at + phrase.length;
      return <span key={phrase}>{before}<mark>{phrase}</mark></span>;
    });
    return <>{parts}{text.slice(cursor)}</>;
  };
  return (
    <div data-writing-model>
      <h3>参考解答 <small>一例・{wordCount(task.model)}語</small></h3>
      <ol className="ew-model-steps">
        {paragraphs.map((paragraph, index) => (
          <li key={index}><strong>{labels[index] ?? `段落 ${index + 1}`}</strong><p lang="en">{highlight(paragraph)}</p></li>
        ))}
      </ol>
      <h3>構成・表現のポイント</h3>
      <p className="ew-review-explanation">{explanation}</p>
      <h3>重要語句・使い方</h3>
      <dl className="ew-key-phrases">
        {notes.map(([phrase, meaning, use]) => (
          <div key={phrase}><dt><mark lang="en">{phrase}</mark></dt><dd><b>{meaning}</b><br />{use}</dd></div>
        ))}
      </dl>
      {task.modelTranslation && <details><summary>参考解答の和訳</summary><p>{task.modelTranslation}</p></details>}
      {sourceTranslation && <details><summary>元の英文の和訳</summary><p>{sourceTranslation}</p></details>}
      <p className="ew-disclaimer">参考解答と同じ文章にする必要はありません。{essay ? '理由同士が重ならず、具体例で立場を支えられているか' : '原文の論旨を保ち、細部を自分の言葉で圧縮できているか'}を比べてみましょう。</p>
    </div>
  );
}

export function EikenWriting({
  uid,
  grade: selectedGrade,
  onGrade,
  onBack,
  initialTaskKey,
  onOpenTeacherReview,
}: {
  uid: string;
  grade: EikenGrade;
  onGrade: (grade: EikenGrade) => void;
  onBack: () => void;
  initialTaskKey?: string | null;
  onOpenTeacherReview?: () => void;
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
    setTaskId(previous => gradeTasks.some(t => t.key === previous) ? previous : (groups[0]?.items[0]?.key ?? gradeTasks[0].key));
  }, [gradeTasks, groups, initialTaskKey]);

  const task = gradeTasks.find(t => t.key === taskId) ?? groups[0]?.items[0] ?? gradeTasks[0];
  const activeGroup = groups.find(g => g.items.some(i => i.key === task.key)) ?? groups[0];

  const [saved, setSaved] = useState(() => read(uid));
  const [message, setMessage] = useState('');
  const [showModel, setShowModel] = useState(false);
  const [submitted, setSubmitted] = useState<{ key: string; text: string } | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const [syncing, setSyncing] = useState(false);
  const current = saved.data.drafts[task.key] ?? blank;

  useEffect(() => {
    setShowModel(false);
    setSubmitted(null);
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

  const gradeOne = grade === 'eiken_1';
  const reviewing = gradeOne && submitted?.key === task.key && submitted.text === current.text;
  useEffect(() => {
    if (reviewing) reviewHeading.current?.focus();
  }, [reviewing]);
  const reviewedCount = gradeTasks.filter(t => saved.data.drafts[t.key]?.reviewed).length;
  const currentWords = wordCount(current.text);
  const targetRange = parseTargetRange(task.target);
  const taskKindInfo = shortTaskKind(task);
  const topic = gradeOne ? task.instruction.match(/^TOPIC:\s*(.+)$/m)?.[1] : undefined;
  const instructions = topic ? task.instruction.replace(/^TOPIC:\s*.+$/m, '').trim() : task.instruction;
  const [sourceTitle, ...sourceParagraphs] = task.source && task.bookletId ? task.source.split(/\n\n/) : ['', task.source];
  const structureHints = structureHintsForKind(taskKindInfo.kind);
  const inTargetRange = targetRange ? currentWords >= targetRange[0] && currentWords <= targetRange[1] : false;
  const overTargetRange = targetRange ? currentWords > targetRange[1] : false;
  const gaugePct = targetRange ? Math.min(100, Math.round((currentWords / targetRange[1]) * 100)) : 0;

  return (
    <main className="ew-page" data-grade-one={gradeOne || undefined} data-writing>
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
          {gradeOne && <div className="ew-stage-label"><BookOpen size={15} aria-hidden="true" /> 英検1級 ・ {taskKindInfo.label}</div>}
          <h2 id="writing-task-title">{task.title}</h2>
          <p className="ew-instructions">{gradeOne ? instructions : task.instruction}</p>
          {topic && <div className="ew-topic"><b>TOPIC</b><p lang="en">{topic}</p></div>}
          {gradeOne && <p className="ew-target">{targetRange ? `語数の目安 ${targetRange[0]}〜${targetRange[1]}語` : task.target}</p>}
          {task.source && (gradeOne ? (
            <article className="ew-source" lang="en">
              {sourceTitle && <h3>{sourceTitle}</h3>}
              {sourceParagraphs.join('\n\n').split(/\n\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
            </article>
          ) : <blockquote lang="en">{task.source}</blockquote>)}
          {!gradeOne && <p className="ew-target">{task.target}</p>}
          {!gradeOne && <div className="ew-structure-guide" aria-label="構成のヒント">
            <strong>構成ガイド（{taskKindInfo.label}）</strong>
            <ul>
              {structureHints.map(hint => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </div>}
          {!gradeOne && <p className="ew-disclaimer">独自の重点練習です。自動採点・合否判定は行いません。5級・4級の筆記ライティング課題は設けていません。</p>}
        </section>

        <section className="ew-answer">
          {gradeOne && <div className="ew-stage-label"><PenLine size={15} aria-hidden="true" /> {reviewing ? '02 ・ 答え合わせ' : '01 ・ 解答を書く'}</div>}
          {reviewing ? <>
            <h2 ref={reviewHeading} tabIndex={-1}>自分の解答 <small>{currentWords}語</small></h2>
            <p className="ew-submitted-answer" lang="en">{current.text}</p>
            <button type="button" onClick={() => { setSubmitted(null); requestAnimationFrame(() => editor.current?.focus()); }}>解答を修正する</button>
          </> : <>
          <label htmlFor="writing-answer">あなたの英文</label>
          <textarea
            ref={editor}
            spellCheck={gradeOne ? false : undefined}
            id="writing-answer"
            lang="en"
            value={current.text}
            maxLength={4000}
            disabled={!!saved.error}
            placeholder="Write your answer here."
            onChange={event => save({ text: event.target.value, checked: [], reviewed: false })}
          />
          <div className="ew-save">
            <span data-writing-count>
              <strong>{currentWords}</strong> words
              {targetRange && (
                <em
                  className={`ew-word-badge ${
                    inTargetRange ? 'is-ok' : overTargetRange ? 'is-over' : ''
                  }`}
                >
                  {inTargetRange
                    ? '適正語数クリア'
                    : overTargetRange
                    ? `目安上限 +${currentWords - targetRange[1]}語`
                    : currentWords > 0
                    ? `あと ${targetRange[0] - currentWords}語で目安到達`
                    : `目標 ${targetRange[0]}〜${targetRange[1]}語`}
                </em>
              )}
            </span>
            <span role="status">
              <Save size={14} />
              {message || (current.updatedAt ? '保存した下書きから再開' : '入力はこの端末・アカウントに保存されます')}
            </span>
          </div>
          {targetRange && (
            <div className="ew-word-meter" aria-hidden="true">
              <div
                className={`ew-word-meter-fill ${
                  inTargetRange ? 'is-ok' : overTargetRange ? 'is-over' : ''
                }`}
                style={{ width: `${gaugePct}%` }}
              />
            </div>
          )}
          {gradeOne && <>
            <div className="ew-actions ew-submit">
              <button type="button" className="ew-primary-btn" disabled={!currentWords || !!saved.error}
                onClick={() => setSubmitted({ key: task.key, text: current.text })}>
                <CheckCircle2 size={16} aria-hidden="true" />解答を提出して答え合わせ
              </button>
            </div>
            <p className="ew-disclaimer">提出後に参考解答と自己点検が表示されます。自動採点は行いません。</p>
          </>}
          </>}
          {reviewing && <GradeOneModel task={task} kind={taskKindInfo.kind} />}
          {(!gradeOne || reviewing) && <>
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
            {!gradeOne && <button type="button" aria-expanded={showModel} onClick={() => setShowModel(value => !value)}>
              <BookOpen size={16} />参考解答・解説{showModel ? 'を閉じる' : 'を見る'}
            </button>}
          </div>
          </>}
          {!gradeOne && showModel && (
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
          <StudentWritingSubmitPanel
            uid={uid}
            grade={grade}
            taskKey={task.key}
            taskTitle={task.title}
            taskKind={taskKindInfo.kind}
            instruction={task.instruction}
            targetWordsLabel={task.target}
            targetRange={targetRange}
            text={current.text}
            onOpenTeacherPreview={onOpenTeacherReview}
          />
        </section>
      </div>
    </main>
  );
}
