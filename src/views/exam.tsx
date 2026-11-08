import type { FC } from 'hono/jsx'
import { SEC_GUIDE, SEC_LABEL, isListening, type QuizItem, type QuizSet, type Sec } from '../data/sets'

function renderLine(line: string) {
  const parts = line.split('( ___ )')
  return <p class="q-line">{parts.map((part, i) => <>{part}{i < parts.length - 1 && <span class="blank" aria-label="空所" />}</>)}</p>
}
const Explanation: FC<{ item: QuizItem }> = ({ item }) => <div class="explain"><div class="explain-head"><span class="badge ok">正解 {item.answer + 1}</span><span>{item.skill}</span></div><p>根拠：{item.evidence}</p><ol>{item.reasons.map(reason => <li>{reason}</li>)}</ol></div>

const Question: FC<{ item: QuizItem; showAnswers: boolean }> = ({ item, showAnswers }) => (
  <article class="q" id={item.id} data-id={item.id} data-sec={item.sec} data-answer={item.answer} data-listening={isListening(item.sec) ? '1' : '0'}>
    <span class="q-no">{isListening(item.sec) ? `L${item.no}` : `R${item.no}`}</span>
    <div class="q-body"><p class="question-skill">{item.skill}</p>
      {item.passage && <section class="reading-passage" aria-label={item.passageTitle}><h3>{item.passageTitle}</h3>{item.passage.split('\n').map(line => <p>{line}</p>)}</section>}
      {item.lines.map(renderLine)}
      {item.question && <p class="q-prompt">{item.question}</p>}
      {isListening(item.sec) && <div class="audio-tools"><button type="button" class="btn-audio" data-play={item.id}>▶ 音声を再生</button><button type="button" class="btn-ghost" data-slow={item.id}>ゆっくり再生</button></div>}
      <ul class="choices cols-4">{item.choices.map((choice, i) => <li><label class="choice" data-index={i}><input type="radio" name={`ans-${item.id}`} value={i} /><span class="choice-num">{i + 1}</span><span>{choice}</span></label></li>)}</ul>
      {showAnswers && <Explanation item={item} />}
    </div>
  </article>
)
const BrandLine: FC<{ set: QuizSet; label: string }> = ({ set, label }) => <div class="paper-brand-line"><img src="/static/manatobi-logo-gray.png" alt="マナトビ" width="126" height="40" /><span>GRADE {set.grade.toUpperCase()} / {label}</span></div>

const Writing: FC<{ set: QuizSet }> = ({ set }) => set.writing.length ? (
  <section class="page writing-section" id="writing-section">
    <div class="book-section-heading"><span>WRITE &amp; REVIEW</span><h2>記述課題 / 自己点検</h2></div>
    <p>選択式の得点には含めません。自動採点は行わず、観点ごとに見直します。入力は保存・送信されず、ページを離れると失われます。</p>
    {set.writing.map(task => <article class="writing-task" id={`writing-${task.id}`}>
      <h3>{task.title}</h3><p>{task.instruction}</p>{task.source && <blockquote class="writing-source" lang="en">{task.source}</blockquote>}
      <p class="writing-target">{task.target}</p><label for={`draft-${task.id}`}>あなたの答案</label><textarea id={`draft-${task.id}`} data-writing-input={task.id} rows={8} lang="en" spellcheck={true} aria-describedby={`count-${task.id}`} placeholder="Write your answer here. 保存・送信はされません。" />
      <p id={`count-${task.id}`} aria-live="polite">語数（参考）：<span data-word-count={task.id}>0</span></p>
      <fieldset class="writing-checks"><legend>自己点検</legend>{task.checklist.map((point, i) => <label><input type="checkbox" id={`check-${task.id}-${i}`} /> {point}</label>)}</fieldset>
      <details class="model-answer"><summary>モデル答案と考え方を見る（唯一の正解ではありません）</summary><p lang="en">{task.model}</p><p>{task.commentary}</p></details>
    </article>)}
  </section>
) : null

export const Exam: FC<{ set: QuizSet; part: 'both' | 'reading' | 'listening'; showAnswers: boolean }> = ({ set, part, showAnswers }) => {
  const all = [...(part !== 'listening' ? set.reading : []), ...(part !== 'reading' ? set.listening : [])]
  const groups = [...new Set(all.map(item => item.sec))]
  const key = Object.fromEntries(all.map(item => [item.id, { a: item.answer, e: item.exp, j: `根拠：${item.evidence}`, c: item.choices, s: SEC_LABEL[item.sec], n: item.no }]))
  const audio = Object.fromEntries(all.filter(item => item.audio).map(item => [item.id, { lines: item.audio, question: item.question }]))
  const minutes = part === 'listening' ? Math.max(4, Math.round(set.minutes / 3)) : part === 'reading' ? Math.round(set.minutes * 2 / 3) : set.minutes
  return <>
    <div class="exam-bar"><div class="exam-bar-inner"><div class="exam-bar-title">{set.gradeLabel} オリジナル重点演習<small>練習時間の目安。公式の制限時間ではありません。</small></div><div class="exam-progress"><span>解答済み</span><span id="answered-count">0</span><span>/ {all.length}</span><span class="progress"><span class="progress-track"><span class="progress-fill" id="answered-bar" /></span></span><span class="timer" id="timer">{String(minutes).padStart(2,'0')}:00</span><button type="button" class="btn-ghost" id="toggle-timer">タイマー停止</button></div></div></div>
    <div class="paper"><header class="paper-head"><BrandLine set={set} label="ORIGINAL FOCUS UNIT" /><p class="book-kicker">独立執筆 / 初版</p><h1>英検{set.gradeLabel} 重点演習</h1><h2>{set.unit.theme}</h2><p>{set.unit.focus}</p><div class="exam-cover-facts"><span>選択式 {all.length}問</span><span>練習目安 {minutes}分</span></div><aside class="cover-instructions"><h3>解き方</h3><ol><li>最も適切な答えを一つ選び、本文や音声の根拠を確かめてください。</li><li>採点後は正解の根拠と全選択肢の理由を確認できます。</li><li>聞き取りは合成音声です。本試験の2回自動放送は再現していません。</li><li>記述課題は選択式の採点とは別の自己点検です。時間の目安には含めません。</li></ol></aside><p class="material-disclaimer">{set.note} 日本英語検定協会の公式教材ではありません。{set.provenance.review}</p><nav class="paper-tools" aria-label="冊子操作"><button type="button" class="btn-secondary" data-print>印刷 / PDF保存</button><a class="btn-secondary" href={`/grades/${set.grade}`}>この級の一覧</a><a class="btn-secondary" href={`/sheet/${set.id}`}>解答用紙</a><a class="btn-secondary" href={`/script/${set.id}`}>放送原稿</a></nav></header>
      <div class="paper-body" id="paper">{groups.map(sec => <section class="section-block" id={`sec-${sec}`}><div class="section-head"><span class="section-no">{SEC_LABEL[sec]}</span><span class="section-guide">{SEC_GUIDE[sec]}</span></div>{all.filter(item => item.sec === sec).map(item => <Question item={item} showAnswers={showAnswers} />)}</section>)}</div>
      <div class="paper-foot"><span class="paper-foot-note">選択式のみ採点。記述の自動評価・合否判定は行いません。</span><span class="spacer" /><a class="btn-secondary" href={`/exam/${set.id}`}>最初から</a><button type="button" class="btn-primary" id="grade-btn">採点する</button></div>
    </div>
    <section class="result-card" id="result" hidden><div class="result-top"><div class="score-ring" id="score-ring"><span class="score-ring-inner"><span class="score-val" id="score-val">0</span><span class="score-den">/ {all.length}</span></span></div><div class="result-summary"><h2>選択式の採点結果</h2><p class="result-verdict" id="verdict" /><p id="result-note" /></div></div><div class="sec-scores" id="sec-scores" /><table class="review-table"><thead><tr><th>問</th><th>分野</th><th>あなたの解答</th><th>正解</th><th>判定</th></tr></thead><tbody id="review-body" /></table><div class="pill-row"><button type="button" class="btn-primary" id="retry-btn">もう一度解く</button><a class="btn-secondary" href={`/exam/${set.id}?show=answers`}>根拠・誤答理由を読む</a></div></section>
    {part !== 'listening' && <Writing set={set} />}
    <script type="application/json" id="quiz-key" dangerouslySetInnerHTML={{ __html: JSON.stringify({ key, audio, total: all.length, set: set.id }).replace(/</g,'\\u003c') }} />
  </>
}
export const BlankSheet: FC<{ set: QuizSet }> = ({ set }) => <div class="page blank-sheet"><BrandLine set={set} label="ANSWER SHEET" /><h1>{set.gradeLabel} 重点演習 解答用紙</h1><p>{set.round}</p><p class="sheet-name">氏名：____________________________　日付：________________</p><div class="mark-sheet-columns">{[set.reading, set.listening].map((items, index) => <section><h2>{index ? '聞き取り' : 'リーディング'}</h2><table class="mark-sheet"><thead><tr><th>問題</th><th>解答欄</th></tr></thead><tbody>{items.map(item => <tr><th>{index ? 'L' : 'R'}{item.no}</th><td>{item.choices.map((_, i) => <span class="mark-bubble">{i+1}</span>)}</td></tr>)}</tbody></table></section>)}</div><p>記述課題は別紙または演習画面で取り組んでください。</p><div class="paper-tools"><button type="button" class="btn-primary" data-print>印刷 / PDF保存</button><a href={`/exam/${set.id}`} class="btn-secondary">問題へ</a></div></div>

export const AnswerSheet: FC<{ set: QuizSet }> = ({ set }) => <div class="page"><BrandLine set={set} label="ANSWER KEY" /><h1>{set.gradeLabel} 正解と根拠</h1><p>独立執筆の重点演習。公式試験の解答ではありません。</p>{[...set.reading,...set.listening].map(item => <section class="answer-explanation"><h2>{isListening(item.sec)?'L':'R'}{item.no} / {item.skill}</h2><p>正解：{item.answer+1}. {item.choices[item.answer]}</p><p>根拠：{item.evidence}</p><ol>{item.reasons.map(reason => <li>{reason}</li>)}</ol></section>)}<div class="paper-tools"><button type="button" class="btn-primary" data-print>印刷 / PDF保存</button><a class="btn-secondary" href={`/exam/${set.id}`}>問題へ</a></div></div>

export const Script: FC<{ set: QuizSet }> = ({ set }) => <div class="page"><BrandLine set={set} label="LISTENING SCRIPT" /><h1>{set.gradeLabel} オリジナル放送原稿</h1><p>英文は新しく執筆しています。画面では各問を手動再生します。2回放送・解答待ち時間は未実装です。</p>{set.listening.map(item => <section class="script-block"><h2>L{item.no} / {item.passageTitle}</h2>{item.audio?.map(line => <p class="script-item" lang="en">{line}</p>)}<p>Question: {item.question}</p><ol>{item.choices.map(choice => <li lang="en">{choice}</li>)}</ol><details><summary>正解の根拠を確認</summary><p>{item.evidence}</p><p>{item.reasons[item.answer]}</p></details></section>)}<div class="paper-tools"><button type="button" class="btn-secondary" data-print>印刷 / PDF保存</button><a class="btn-secondary" href={`/exam/${set.id}?part=listening`}>聞き取り演習</a></div></div>
