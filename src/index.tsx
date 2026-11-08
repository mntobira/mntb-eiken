import { Hono } from 'hono'
import { renderer } from './renderer'
import { Home } from './views/home'
import { GradePage } from './views/grade'
import { findGrade } from './data/grades'
import { AnswerSheet, BlankSheet, Exam, Script } from './views/exam'
import { getSet, SETS } from './data/sets'

const app = new Hono()

app.use(renderer)

/** 独立執筆した固定ユニットのみを解決。旧プールへのフォールバックは禁止。 */
function resolveSet(id: string) {
  return getSet(id)
}

app.get('/eiken', (c) => c.redirect('/eiken/'))

app.get('/', (c) => c.render(<Home />))

app.get('/grades/:grade', (c) => {
  const grade = findGrade(c.req.param('grade'))
  if (!grade) return c.notFound()
  return c.render(<GradePage grade={grade} />)
})

// Retired legacy sources must not be exposed through any historical entry point.
app.use('*', async (c, next) => {
  const id = c.req.path.split('/').at(-1) ?? ''
  if (/^(?:2026-[12]|2025-3|gen-[0-9a-z]+)$/.test(id)) {
    return c.json({ error: '教材を配信停止しました。過去問由来プールは廃止し、独立執筆ユニットへ移行しています。', replacement: '/' }, 410)
  }
  return next()
})

app.get('/exam/:id', (c) => {
  const set = resolveSet(c.req.param('id'))
  if (!set) return c.notFound()

  const partParam = c.req.query('part')
  const part = partParam === 'reading' || partParam === 'listening' ? partParam : 'both'
  const showAnswers = c.req.query('show') === 'answers'

  return c.render(<Exam set={set} part={part} showAnswers={showAnswers} />)
})

app.get('/sheet/:id', (c) => {
  const set = resolveSet(c.req.param('id'))
  if (!set) return c.notFound()
  return c.render(<BlankSheet set={set} />)
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

// There is no template substitution generator. This legacy shortcut opens an authored unit.
app.get('/new', (c) => {
  const grade = findGrade(c.req.query('grade') ?? '5')
  if (!grade) return c.notFound()
  return c.redirect(`/exam/original-${grade.id}-01`)
})

// 収録セット一覧
app.get('/api/sets', (c) =>
  c.json(
    SETS.map((s) => ({
      id: s.id,
      grade: s.grade,
      origin: s.provenance.origin,
      writing: s.writing.length,
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
