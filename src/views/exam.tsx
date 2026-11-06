import type { FC } from 'hono/jsx'
import { GRADES } from '../renderer'
import { SEC_GUIDE, SEC_LABEL, isListening, type QuizItem, type QuizSet, type Sec } from '../data/sets'

/** 問題文の ( ___ ) を下線の空所に置き換えて描画 */
function renderLine(line: string) {
  const parts = line.split('( ___ )')
  if (parts.length === 1) return <p class="q-line">{line}</p>
  return (
    <p class="q-line">
      {parts.map((part, i) => (
        <>
          {part}
          {i < parts.length - 1 && <span class="blank" aria-label="空所" />}
        </>
      ))}
    </p>
  )
}

const Chooser: FC<{ item: QuizItem }> = ({ item }) => {
  const cols = item.choices.length === 3 ? 3 : 4
  return (
    <ul class={`choices cols-${cols}`}>
      {item.choices.map((c, i) => (
        <li>
          <label class="choice" data-index={i}>
            <input type="radio" name={`ans-${item.id}`} value={i} />
            <span class="choice-num">{i + 1}</span>
            <span>{c}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}

const Question: FC<{ item: QuizItem; showAnswers: boolean }> = ({ item, showAnswers }) => {
  const listening = isListening(item.sec)

  return (
    <article
      class="q"
      id={item.id}
      data-id={item.id}
      data-sec={item.sec}
      data-answer={item.answer}
      data-listening={listening ? '1' : '0'}
    >
      <span class="q-no">{listening ? `No. ${item.no}` : `(${item.no})`}</span>

      <div class="q-body">
        {item.sec === 'R3' && (
          <>
            <p class="order-jp">{item.jp}</p>
            <div class="chunk-box">
              {item.chunks?.map((c, i) => (
                <span class="chunk">
                  <span class="chunk-mark">{'①②③④'[i]}</span>
                  {c}
                </span>
              ))}
            </div>
            <p class="order-sentence">
              {item.prefix ? `${item.prefix} ` : ''}
              <span class="slot" aria-hidden="true" />
              <span class="slot" aria-hidden="true" />
              <span class="slot" aria-hidden="true" />
              <span class="slot" aria-hidden="true" />
              {item.suffix ? ` ${item.suffix}` : ''}
            </p>
            <div class="order-marks">
              <span>1 番目</span>
              <span>3 番目</span>
            </div>
          </>
        )}

        {item.sec !== 'R3' && !listening && item.lines.map((l) => renderLine(l))}

        {item.scene && (
          <div class="scene-card">
            <span class="scene-emoji" aria-hidden="true">
              {item.scene}
            </span>
            <span class="scene-desc">
              <strong>イラストの内容</strong>
              {item.sceneJp}
              <br />
              <span style="font-size:11px">
                （音声を聞いて、絵を最もよく表す英文を選んでください）
              </span>
            </span>
          </div>
        )}

        {item.question && <p class="q-prompt">Question: {item.question}</p>}

        {listening && (
          <div class="audio-tools">
            <button type="button" class="btn-audio" data-play={item.id}>
              <span aria-hidden="true">▶</span>
              音声を再生
              {item.sec === 'L2' ? '（対話＋質問）' : ''}
            </button>
            <button type="button" class="btn-ghost" data-slow={item.id}>
              ゆっくり再生
            </button>
          </div>
        )}

        <Chooser item={item} />

        {showAnswers && (
          <div class="explain">
            <div class="explain-head">
              <span class="badge ok">正解 {item.answer + 1}</span>
              <span>解説</span>
            </div>
            {item.jpFull && <p class="explain-en">{item.jpFull}</p>}
            <p style="margin:0">{item.exp}</p>
          </div>
        )}
      </div>
    </article>
  )
}

const sectionNumber = (sec: Sec) => (sec === 'R1' ? '1' : sec === 'R2' ? '2' : sec === 'R3' ? '3' : sec === 'L1' ? '1' : sec === 'L2' ? '2' : '3')

const SectionBlock: FC<{ sec: Sec; items: QuizItem[]; showAnswers: boolean }> = ({
  sec,
  items,
  showAnswers,
}) => {
  if (items.length === 0) return null
  const n = sectionNumber(sec)

  return (
    <section class="section-block" id={`sec-${sec}`}>
      <div class="section-head">
        <span class="section-no">{isListening(sec) ? `第${n}部` : `大問${n}`}</span>
        <span class="section-guide">{SEC_GUIDE[sec]}</span>
      </div>
      {items.map((item) => (
        <Question item={item} showAnswers={showAnswers} />
      ))}
    </section>
  )
}

export const Exam: FC<{
  set: QuizSet
  part: 'both' | 'reading' | 'listening'
  showAnswers: boolean
}> = ({ set, part, showAnswers }) => {
  const groups: Sec[] =
    part === 'reading'
      ? ['R1', 'R2', 'R3']
      : part === 'listening'
        ? ['L1', 'L2', 'L3']
        : ['R1', 'R2', 'R3', 'L1', 'L2', 'L3']

  const pick = (sec: Sec) => (isListening(sec) ? set.listening : set.reading).filter((i) => i.sec === sec)
  const total = groups.reduce((n, s) => n + pick(s).length, 0)

  const visible = [...set.reading, ...set.listening].filter((i) => groups.includes(i.sec))

  const key = Object.fromEntries(
    visible.map((i) => [i.id, { a: i.answer, e: i.exp, j: i.jpFull, c: i.choices, s: SEC_LABEL[i.sec], n: i.no }]),
  )
  const audio = Object.fromEntries(
    visible
      .filter((i) => i.audio)
      .map((i) => [i.id, { lines: i.audio, question: i.question ?? null }]),
  )

  const title =
    part === 'reading'
      ? 'リーディングテスト'
      : part === 'listening'
        ? 'リスニングテスト'
        : '一次試験（リーディング・リスニング）'

  const minutes = part === 'listening' ? 22 : part === 'reading' ? 25 : 47

  return (
    <>
      <div class="exam-bar">
        <div class="exam-bar-inner">
          <div class="exam-bar-title">
            {title}
            <small>
              {set.round}／{set.date}
            </small>
          </div>
          <div class="exam-progress">
            <span>解答済み</span>
            <span id="answered-count">0</span>
            <span>/ {total}</span>
            <span class="progress">
              <span class="progress-track">
                <span class="progress-fill" id="answered-bar" />
              </span>
            </span>
            <span class="timer" id="timer">
              {String(minutes).padStart(2, '0')}:00
            </span>
            <button type="button" class="btn-ghost" id="toggle-timer">
              タイマー停止
            </button>
          </div>
        </div>
      </div>

      <div class="paper">
        <header class="paper-head">
          <div class="paper-brand-line"><img src="/static/manatobi-logo-gray.png" alt="マナトビ" width="126" height="40" /><span>GRADE 5 / PRACTICE BOOK</span></div>
          <p class="book-kicker">学習用演習教材 / {set.id.startsWith('gen-') ? '組み替え演習' : set.round}</p>
          <h1>英検5級 演習問題</h1>
          <h2>{title}</h2>
          <p>{set.round}／{set.date}　全{total}問</p>
          <div class="exam-cover-facts"><span>リーディング 25分</span><span>リスニング 約22分</span></div>
          <aside class="cover-instructions"><h3>取り組み方</h3><ol><li>各問の選択肢から、最も適切な答えを一つ選んでください。</li><li>リーディングは4択。並べかえは1番目と3番目の組合せを選びます。</li><li>リスニングは各問の再生ボタンから聞けます。公式音源ではなく合成音声です。</li><li>画面では選択肢をクリックして解答し、最後に「採点する」を押してください。</li></ol></aside>
          <p class="material-disclaimer">日本英語検定協会の公式教材ではありません。{set.note}　本試験とは音声・図版・進行方法が異なります。</p>
          <nav class="paper-tools" aria-label="冊子操作"><button type="button" class="btn-secondary" data-print>印刷 / PDF保存</button><a class="btn-secondary" href={`/sheet/${set.id}`}>解答用紙</a><a class="btn-secondary" href={`/answers/${set.id}`}>解答一覧</a><a class="btn-secondary" href={`/script/${set.id}`}>放送原稿</a></nav>
        </header>

        <div class="paper-body" id="paper">
          {groups.map((sec) => (
            <SectionBlock sec={sec} items={pick(sec)} showAnswers={showAnswers} />
          ))}
        </div>

        <div class="paper-foot">
          <span class="paper-foot-note" id="foot-note">
            解答はマークシートの代わりに、各問の選択肢をクリックして選んでください。
          </span>
          <span class="spacer" />
          <a class="btn-secondary" href={`/exam/${set.id}`}>
            最初から
          </a>
          <button type="button" class="btn-primary" id="grade-btn">
            採点する
          </button>
        </div>
      </div>

      <section class="result-card" id="result" hidden>
        <div class="result-top">
          <div class="score-ring" id="score-ring">
            <span class="score-ring-inner">
              <span class="score-val" id="score-val">
                0
              </span>
              <span class="score-den">/ {total}</span>
            </span>
          </div>
          <div class="result-summary">
            <h2>採点結果</h2>
            <p class="result-verdict" id="verdict" />
            <p id="result-note" />
          </div>
        </div>
        <div class="sec-scores" id="sec-scores" />
        <table class="review-table">
          <thead>
            <tr>
              <th>問</th>
              <th>分野</th>
              <th>あなたの解答</th>
              <th>正解</th>
              <th>判定</th>
            </tr>
          </thead>
          <tbody id="review-body" />
        </table>
        <div class="pill-row" style="margin-top:20px">
          <button type="button" class="btn-primary" id="retry-btn">
            もう一度解く
          </button>
          <a class="btn-secondary" href={`/exam/${set.id}?show=answers`}>
            解答・解説を見る
          </a>
          <a class="btn-secondary" href="/">
            過去問一覧へ戻る
          </a>
        </div>
      </section>

      <script
        type="application/json"
        id="quiz-key"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ key, audio, total, set: set.id }) }}
      />
    </>
  )
}

export const BlankSheet: FC<{ set: QuizSet }> = ({ set }) => (
  <div class="page blank-sheet">
    <div class="paper-brand-line"><img src="/static/manatobi-logo-gray.png" alt="マナトビ" width="126" height="40" /><span>GRADE 5 / ANSWER SHEET</span></div>
    <h1>英検5級 演習 解答用紙</h1><p>{set.round} / セットID：{set.id}</p>
    <p class="sheet-name">氏名：________________________________　日付：________________</p>
    <p>各問の答えを一つ選び、番号の丸をぬりつぶしてください。</p>
    <div class="mark-sheet-columns">{(['reading', 'listening'] as const).map((part) => (
      <section><h2>{part === 'reading' ? 'リーディング' : 'リスニング'}</h2>
        <table class="mark-sheet"><thead><tr><th>問題番号</th><th>解答欄</th></tr></thead><tbody>{set[part].map((item) => (
          <tr><th>{item.no}</th><td>{item.choices.map((_, i) => <span class="mark-bubble">{i + 1}</span>)}</td></tr>
        ))}</tbody></table>
      </section>
    ))}</div>
    <div class="paper-tools"><button type="button" class="btn-primary" data-print>印刷 / PDF保存</button><a class="btn-secondary" href={`/exam/${set.id}`}>問題冊子へ</a></div>
  </div>
)

export const AnswerSheet: FC<{ set: QuizSet }> = ({ set }) => {
  const rows = (items: QuizItem[]) => (
    <table class="review-table">
      <thead>
        <tr>
          <th>問</th>
          <th>正解</th>
          <th>分野</th>
          <th>問題（冒頭）</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => (
          <tr>
            <td class="num">({i.no})</td>
            <td class="ok">{i.answer + 1}</td>
            <td>{SEC_LABEL[i.sec]}</td>
            <td style="font-family:var(--font-en)">
              {i.sec === 'R3'
                ? i.jp
                : (i.lines[0] ?? i.sceneJp ?? i.question ?? '').replace('( ___ )', '（　）').slice(0, 64)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div class="page">
      <nav class="breadcrumb" aria-label="パンくずリスト">
        <a href="/">ホーム</a>
        <span class="sep">›</span>
        <a href="/">過去問・試験内容</a>
        <span class="sep">›</span>
        <a href="/">5級の過去問・試験内容</a>
        <span class="sep">›</span>
        <span>解答</span>
      </nav>

      <h1 class="page-title">5級 解答（{set.round}）</h1>
      <p class="lead">
        {set.date}実施　{set.note}
      </p>

      <div class="answer-row" style="margin-bottom:26px"><button type="button" class="btn-secondary" data-print>印刷 / PDF保存</button>
        {GRADES.map((g) => (
          <a class={g === '5級' ? 'grade-pill is-current' : 'grade-pill'} href="/">
            {g}
            <span class="tab-chev" aria-hidden="true">
              ›
            </span>
          </a>
        ))}
      </div>

      <section class="panel">
        <h2 class="panel-heading">リーディング</h2>
        {rows(set.reading)}
      </section>

      <section class="panel">
        <h2 class="panel-heading">リスニング</h2>
        {rows(set.listening)}
      </section>

      <div class="pill-row">
        <a class="pill" href={`/exam/${set.id}`}>
          問題を解く
        </a>
        <a class="pill" href={`/script/${set.id}`}>
          リスニング原稿
        </a>
      </div>
    </div>
  )
}

export const Script: FC<{ set: QuizSet }> = ({ set }) => {
  return (
    <div class="page">
      <nav class="breadcrumb" aria-label="パンくずリスト">
        <a href="/">ホーム</a>
        <span class="sep">›</span>
        <a href="/">過去問・試験内容</a>
        <span class="sep">›</span>
        <a href="/">5級の過去問・試験内容</a>
        <span class="sep">›</span>
        <span>リスニング原稿</span>
      </nav>

      <h1 class="page-title">「5級リスニングテスト」原稿</h1>
      <p class="lead">
        {set.round}（{set.date}）の演習用原稿です。画面では各問を手動再生します。本試験の2回放送・例題は再現していません。
      </p>

      <button type="button" class="btn-secondary" data-print>印刷 / PDF保存</button>
      {(['L1', 'L2', 'L3'] as Sec[]).map((sec) => {
        const items = set.listening.filter((i) => i.sec === sec)
        if (items.length === 0) return null
        return (
          <section class="script-block">
            <h2>{SEC_LABEL[sec]}</h2>
            {items.map((i) => (
              <div class="script-item">
                <span class="script-no">No. {i.no}</span>
                {(i.audio ?? []).map((line) => {
                  const m = line.match(/^([AB])\s*:\s*(.*)$/)
                  const isQ = /^Question:/i.test(line)
                  return (
                    <div>
                      {m ? (
                        <>
                          <span class="script-role">{m[1]}</span>
                          {m[2]}
                        </>
                      ) : (
                        <>
                          <span class="script-role">{isQ ? 'Q' : '☆'}</span>
                          {isQ ? line.replace(/^Question:\s*/i, '') : line}
                        </>
                      )}
                    </div>
                  )
                })}
                <div class="script-jp">{i.jpFull}</div>
              </div>
            ))}
          </section>
        )
      })}

      <div class="pill-row">
        <a class="pill" href={`/exam/${set.id}?part=listening`}>
          リスニングを解く
        </a>
        <a class="pill" href={`/exam/${set.id}?show=answers`}>
          解答を見る
        </a>
      </div>
    </div>
  )
}
