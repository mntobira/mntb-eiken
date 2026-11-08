import type { FC } from 'hono/jsx'
import { isListening, type QuizItem, type QuizSet } from '../data/sets'

function renderLine(line: string) {
  const parts = line.split('( ___ )')
  return <p class="q-line" lang="en">{parts.map((part, i) => <>{part}{i < parts.length - 1 && <span class="blank" aria-label="空所" />}</>)}</p>
}
const questionLabel = (item: QuizItem) => `${isListening(item.sec) ? 'L' : 'R'}${item.no}`

const Explanation: FC<{ item: QuizItem; show: boolean }> = ({ item, show }) => (
  <section class="explain" id={`explanation-${item.id}`} hidden={!show} aria-label={`${questionLabel(item)}の解説`}>
    <div class="explain-head"><span class="answer-badge">正解 {item.answer + 1}</span><span class="answer-result" data-result-for={item.id} /></div>
    <h3>答えの決め手</h3><p class="skill-label">{item.skill}</p>
    <blockquote lang="en">{item.evidence}</blockquote><p>{item.reasons[item.answer]}</p>
    <h3>選択肢を比べる</h3><ol class="choice-reasons">{item.reasons.map((reason, i) => <li class={i === item.answer ? 'reason-correct' : ''}><strong lang="en">{item.choices[i]}</strong><p>{reason}</p></li>)}</ol>
    {item.audio && <details class="transcript"><summary>英文を確認する</summary>{item.audio.map(line => <p lang="en">{line}</p>)}</details>}
    {item.translation && <details class="translation"><summary>{item.audio ? '会話・説明の和訳' : '本文の和訳'}</summary>{item.translation.split('\n').map(line => <p>{line}</p>)}</details>}
  </section>
)

const Question: FC<{ item: QuizItem; showAnswers: boolean; index: number }> = ({ item, showAnswers, index }) => (
  <article class="q" id={item.id} data-id={item.id} data-index={index} data-sec={item.sec} data-answer={item.answer} data-listening={isListening(item.sec) ? '1' : '0'}>
    <div class="question-heading"><span class="q-no">{questionLabel(item)}</span><button class="review-flag" type="button" data-flag={item.id} aria-pressed="false" disabled={showAnswers}>あとで見直す</button></div>
    <div class="q-body">
      {item.lines.map(renderLine)}
      {item.question && <h2 class="q-prompt" lang="en">{item.question}</h2>}
      <fieldset class="choice-fieldset"><legend class="visually-hidden">{questionLabel(item)}の解答を一つ選んでください</legend>
        <ul class="choices cols-4">{item.choices.map((choice, i) => <li><label class="choice" data-index={i}><input type="radio" name={`ans-${item.id}`} value={i} disabled={showAnswers} /><span class="choice-num">{i + 1}</span><span lang="en">{choice}</span></label></li>)}</ul>
      </fieldset>
      <Explanation item={item} show={showAnswers} />
    </div>
  </article>
)

function markedPassage(text: string, items: QuizItem[]) {
  const phrases = [...new Set(items.map(item => item.evidence).filter(value => text.includes(value)))].sort((a,b) => b.length-a.length)
  if (!phrases.length) return text
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.split(new RegExp(`(${phrases.map(escape).join('|')})`)).map(part => phrases.includes(part) ? <mark>{part}</mark> : part)
}

const Context: FC<{ item: QuizItem; items: QuizItem[]; groupId: string; index: number; active: boolean }> = ({ item, items, groupId, index, active }) => (
  <section class="study-context" id={groupId} data-context-index={index} hidden={!active}>
    {item.passage ? <article class="reading-passage"><div class="passage-meta"><span>本文</span><span>{item.passage.match(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g)?.length ?? 0}語</span></div><h2>{item.passageTitle}</h2>{item.passage.split('\n').map(line => <p lang="en">{markedPassage(line, items)}</p>)}<p class="context-instruction">この本文に続く2問に答えてください。</p></article>
      : item.audio ? <article class="listening-panel"><span class="section-caption">リスニング</span><h2>{item.passageTitle}</h2><p>会話や説明を聞いて、設問に答えてください。</p><div class="audio-options"><label>速さ<select id={`speed-${item.id}`} data-audio-rate><option value="0.8">ゆっくり</option><option value="1" selected>標準</option><option value="1.15">速め</option></select></label><label>回数<select id={`repeat-${item.id}`} data-audio-repeat><option value="1" selected>1回</option><option value="2">2回</option></select></label></div><div class="audio-tools"><button type="button" class="btn-primary" data-play={item.id}>音声を再生</button><button type="button" class="btn-secondary" data-audio-stop disabled>停止</button></div><p class="audio-status" data-audio-status aria-live="polite">再生できます</p><p class="context-note">ブラウザの読み上げ音声です。再生中は別の問題に移ると停止します。</p></article>
      : <article class="vocabulary-panel"><span class="section-caption">語彙・文法</span><h2>文全体の意味を<br />確かめて選ぶ。</h2><p>空所の前後だけでなく、時を表す語や文のつながりにも注目してください。</p><div class="study-tip"><strong>解き方</strong><ol><li>まず英文を最後まで読む</li><li>選択肢を一つ選ぶ</li><li>迷ったら見直しの印を付ける</li></ol></div></article>}
  </section>
)

const Writing: FC<{ set: QuizSet }> = ({ set }) => set.writing.length ? (
  <section class="writing-section" id="writing-section"><header class="section-title-row"><div><span class="section-caption">書く練習</span><h2>記述問題</h2></div><span>{set.writing.length}題</span></header><p class="section-description">解答例を開く前に、自分の言葉で書いてみましょう。入力は保存・送信されません。</p>
    {set.writing.map((task,index) => <article class="writing-task" id={`writing-${task.id}`}><header><span class="task-number">{index+1}</span><h3>{task.title}</h3></header><p>{task.instruction}</p>{task.source && <blockquote class="writing-source" lang="en">{task.source}</blockquote>}<p class="writing-target">{task.target}</p><label for={`draft-${task.id}`}>あなたの答案</label><textarea id={`draft-${task.id}`} data-writing-input={task.id} rows={8} lang="en" spellcheck={true} aria-describedby={`count-${task.id}`} placeholder="英語で入力してください" /><div class="writing-actions"><p id={`count-${task.id}`} aria-live="polite">語数：<span data-word-count={task.id}>0</span></p><button type="button" class="text-button" data-copy-writing={task.id}>答案をコピー</button></div><fieldset class="writing-checks"><legend>見直しのポイント</legend>{task.checklist.map((point,i) => <label><input type="checkbox" id={`check-${task.id}-${i}`} />{point}</label>)}</fieldset><details class="model-answer"><summary>解答例と解説</summary><p lang="en">{task.model}</p><p>{task.commentary}</p></details></article>)}
  </section>
) : null

export const Exam: FC<{ set: QuizSet; part: 'both' | 'reading' | 'listening'; showAnswers: boolean }> = ({ set, part, showAnswers }) => {
  const all = [...(part !== 'listening' ? set.reading : []), ...(part !== 'reading' ? set.listening : [])]
  const keys = [...new Set(all.map(item => item.passageTitle || item.sec))]
  const contexts = keys.map(key => all.filter(item => (item.passageTitle || item.sec) === key))
  const contextOf = (item: QuizItem) => keys.indexOf(item.passageTitle || item.sec)
  const minutes = part === 'listening' ? Math.max(4, Math.round(set.minutes / 3)) : part === 'reading' ? Math.round(set.minutes*2/3) : set.minutes
  return <div class={`practice-page${showAnswers ? ' is-answer-mode is-graded' : ''}`} data-practice data-answer-mode={showAnswers ? 'true' : 'false'}>
    <header class="practice-header"><nav class="breadcrumb" aria-label="パンくずリスト"><a href={`/grades/${set.grade}`}>{set.gradeLabel}の教材</a><span> / </span><span>{showAnswers ? '解答・解説' : '練習問題'}</span></nav><div class="practice-title"><div><h1>{set.unit.theme}</h1><p>{set.gradeLabel} ・ 選択問題{all.length}問{part !== 'listening' && set.writing.length > 0 ? ` ・ 記述${set.writing.length}題` : ''}</p></div><div class="practice-toolbar"><button class="text-button" type="button" data-print>印刷</button><a class="text-button" href={`/sheet/${set.id}`}>解答用紙</a><label class="font-size-control">文字<select id="reading-font-size"><option value="standard">標準</option><option value="large">大きく</option></select></label></div></div><p class="practice-disclaimer">内容を絞った練習です。本試験1回分の問題数・構成とは異なります。</p></header>
    <div class="practice-workspace" id="paper">
      <aside class="question-sidebar"><div class="sidebar-title">問題一覧<span id="sidebar-progress">0/{all.length}</span></div><nav class="question-index" aria-label="問題の移動">{all.map((item,index) => <button type="button" class={`question-jump${index===0?' is-current':''}`} data-jump={index} data-question-id={item.id} aria-current={index===0?'step':undefined}><span>{questionLabel(item)}</span><span class="jump-state">未解答</span><span class="flag-indicator" aria-hidden="true"></span></button>)}</nav><div class="sidebar-legend"><span><i class="legend-dot answered" />解答済み</span><span><i class="legend-dot flagged" />見直し</span></div><div class="sidebar-timer"><span>残りの目安</span><strong id="timer" data-seconds={minutes*60}>{String(minutes).padStart(2,'0')}:00</strong><button type="button" class="text-button" id="toggle-timer" disabled={showAnswers}>開始</button></div><p class="sidebar-note">解答は自動保存されません。ページを閉じると消えます。</p></aside>
      <div class="context-column" role="region" aria-label="本文・音声。スマートフォンでは本文内をスクロールできます" tabindex={0}>{contexts.map((items,index) => <Context item={items[0]} items={items} groupId={`context-${index}`} index={index} active={index===0} />)}</div>
      <div class="question-column"><div class="question-topline"><span id="question-position">1 / {all.length}</span><span id="session-mode">{showAnswers ? '解答・解説' : '解答中'}</span></div>{all.map((item,index) => <div class="question-step" data-step={index} data-context={contextOf(item)} hidden={index!==0}>{item.passage && all.findIndex(other => other.passageTitle === item.passageTitle) === index && <article class="print-context"><h2>{item.passageTitle}</h2>{item.passage.split('\n').map(line => <p lang="en">{line}</p>)}</article>}{item.audio && <p class="print-context">リスニング：{item.passageTitle}（音声を再生するか、別紙のリスニング原稿を使用してください。）</p>}<Question item={item} showAnswers={showAnswers} index={index} /></div>)}
        <div class="question-controls"><button type="button" class="btn-secondary" id="previous-question" disabled>前の問題</button><button type="button" class="btn-primary" id="next-question">次の問題</button><button type="button" class="btn-primary" id="open-review" hidden={all.length>1}>解答を見直す</button></div>
      </div>
    </div>
    <section class="answer-check" id="answer-check" hidden><header class="section-title-row"><div><span class="section-caption">採点の前に</span><h2>解答を見直す</h2></div><button type="button" class="text-button" id="close-review">問題に戻る</button></header><p id="review-summary" aria-live="polite" /><div class="answer-check-grid" id="answer-check-grid" /><div class="submission-actions"><p>採点すると解答を変更できません。</p><button type="button" class="btn-primary" id="grade-btn">この解答で採点する</button></div></section>
    <section class="result-card" id="result" hidden><header class="result-overview"><div><span class="section-caption">選択問題の結果</span><h2><strong id="score-val">0</strong><span class="score-den"> / {all.length}問</span></h2><p id="verdict" /></div><div class="result-overview-note"><p id="result-note">得点は今回の練習の結果です。公式試験の合否判定には使えません。</p></div></header><div class="sec-scores" id="sec-scores" /><div class="result-actions"><button type="button" class="btn-primary" id="review-wrong">間違えた問題を確認</button><button type="button" class="btn-secondary" id="retry-wrong">間違えた問題だけ解き直す</button><button type="button" class="text-button" id="review-all">全問の解説</button><a class="text-button" href={`/exam/${set.id}${part !== 'both' ? `?part=${part}` : ''}`}>最初からやり直す</a></div><div class="review-table-wrap"><table class="review-table"><thead><tr><th>問題</th><th>分野</th><th>あなたの解答</th><th>正解</th><th>判定</th></tr></thead><tbody id="review-body" /></table></div></section>
    <div class="session-status" role="status" id="session-status" aria-live="polite" />
    {part !== 'listening' && <Writing set={set} />}
    <script type="application/json" id="quiz-key" dangerouslySetInnerHTML={{ __html: JSON.stringify({ total:all.length,set:set.id,part,items:all,showAnswers }).replace(/</g,'\\u003c') }} />
  </div>
}

const BrandLine: FC<{ set: QuizSet; label: string }> = ({ set,label }) => <div class="paper-brand-line"><img src="/static/manatobi-logo-gray.png" alt="マナトビ" width="126" height="40" /><span>{set.gradeLabel}　{label}</span></div>
export const BlankSheet: FC<{ set: QuizSet }> = ({ set }) => <div class="page blank-sheet"><BrandLine set={set} label="解答用紙" /><h1>{set.gradeLabel} 練習問題 解答用紙</h1><p>{set.unit.theme}</p><p class="sheet-name">氏名：____________________________　日付：________________</p><div class="mark-sheet-columns">{[set.reading,set.listening].map((items,index) => <section><h2>{index?'リスニング':'リーディング'}</h2><table class="mark-sheet"><thead><tr><th>問題</th><th>解答欄</th></tr></thead><tbody>{items.map(item => <tr><th>{questionLabel(item)}</th><td>{item.choices.map((_,i) => <span class="mark-bubble">{i+1}</span>)}</td></tr>)}</tbody></table></section>)}</div><div class="paper-tools"><button type="button" class="btn-primary" data-print>印刷 / PDF保存</button><a href={`/exam/${set.id}`} class="btn-secondary">問題へ</a></div></div>
export const AnswerSheet: FC<{ set: QuizSet }> = ({ set }) => <div class="page answer-page"><BrandLine set={set} label="解答・解説" /><h1>{set.gradeLabel} 解答・解説</h1><p>{set.unit.theme}</p>{[...set.reading,...set.listening].map(item => <article class="answer-explanation"><h2>{questionLabel(item)}　{item.skill}</h2><Explanation item={item} show={true} /></article>)}<div class="paper-tools"><button type="button" class="btn-primary" data-print>印刷 / PDF保存</button><a class="btn-secondary" href={`/exam/${set.id}`}>問題へ</a></div></div>
export const Script: FC<{ set: QuizSet }> = ({ set }) => <div class="page script-page"><BrandLine set={set} label="リスニング原稿" /><h1>{set.gradeLabel} リスニング原稿</h1><p>聞き取れなかった箇所を、原稿と和訳で確認してください。</p>{set.listening.map(item => <section class="script-block"><h2>{questionLabel(item)}　{item.passageTitle}</h2>{item.audio?.map(line => <p class="script-item" lang="en">{line}</p>)}<p lang="en">Question: {item.question}</p><ol>{item.choices.map(choice => <li lang="en">{choice}</li>)}</ol><details class="translation"><summary>和訳を読む</summary>{item.translation?.split('\n').map(line => <p>{line}</p>)}</details><details><summary>正解の根拠</summary><p lang="en">{item.evidence}</p><p>{item.reasons[item.answer]}</p></details></section>)}<div class="paper-tools"><button type="button" class="btn-secondary" data-print>印刷 / PDF保存</button><a class="btn-secondary" href={`/exam/${set.id}?part=listening`}>リスニングを解く</a></div></div>
