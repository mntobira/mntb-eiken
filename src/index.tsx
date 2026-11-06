import { Hono } from 'hono'
import { renderer } from './renderer'
import { Home } from './views/home'
import { AnswerSheet, Exam, Script } from './views/exam'
import { getGeneratedSet, getSet, SETS } from './data/sets'

const app = new Hono()

app.use(renderer)

/** 過去問ID、または自動生成ID（gen-xxxx）からセットを解決 */
function resolveSet(id: string) {
  return getSet(id) ?? getGeneratedSet(id)
}

app.get('/', (c) => c.render(<Home />))

app.get('/exam/:id', (c) => {
  const set = resolveSet(c.req.param('id'))
  if (!set) return c.notFound()

  const partParam = c.req.query('part')
  const part = partParam === 'reading' || partParam === 'listening' ? partParam : 'both'
  const showAnswers = c.req.query('show') === 'answers'

  return c.render(<Exam set={set} part={part} showAnswers={showAnswers} />)
})

app.get('/answers/:id', (c) => {
  const set = resolveSet(c.req.param('id'))
  if (!set) return c.notFound()
  return c.render(<AnswerSheet set={set} />)
})

app.get('/script/:id', (c) => {
  const set = resolveSet(c.req.param('id'))
  if (!set) return c.notFound()
  return c.render(<Script set={set} />)
})

// 新しいオリジナル問題を作る
app.get('/new', (c) => {
  const seed = Math.floor(Math.random() * 2 ** 31)
  const part = c.req.query('part')
  const qs = part === 'reading' || part === 'listening' ? `?part=${part}` : ''
  return c.redirect(`/exam/gen-${seed.toString(36)}${qs}`)
})

// 収録セット一覧
app.get('/api/sets', (c) =>
  c.json(
    SETS.map((s) => ({
      id: s.id,
      round: s.round,
      date: s.date,
      reading: s.reading.length,
      listening: s.listening.length,
    })),
  ),
)

app.get('/api/sets/:id', (c) => {
  const set = resolveSet(c.req.param('id'))
  if (!set) return c.json({ error: 'not found' }, 404)
  return c.json(set)
})

export default app
