import assert from 'node:assert/strict'
import { readFile, writeFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { root } from './media-common.mjs'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const words = text => text.toLowerCase().replace(/[’]/g, "'").match(/[a-z]+(?:['-][a-z]+)*/g) || []
const normal = text => words(text).join(' ')
const hash = text => createHash('sha256').update(text).digest('hex').slice(0, 20)
try {
  const legacy = JSON.parse(await readFile(resolve(root, 'assets/legacy-fingerprints.json'), 'utf8'))
  const forbidden = new Set(legacy.hashes)
  const listResponse = await fetch(`${base}/api/sets`)
  assert.equal(listResponse.status, 200)
  const summaries = await listResponse.json()
  const reports = []
  const allQuestionKeys = new Set()
  const allPassages = new Set()
  const allScripts = new Set()
  const collisions = []
  for (const summary of summaries) {
    const set = await (await fetch(`${base}/api/sets/${summary.id}`)).json()
    assert.equal(set.provenance.origin, 'independently-authored')
    const items = [...set.reading, ...set.listening]
    assert.equal(items.length, 8)
    const answers = [0, 0, 0, 0]
    for (const item of items) {
      assert.ok(Number.isInteger(item.answer) && item.answer >= 0 && item.answer < 4)
      answers[item.answer]++
      assert.equal(new Set(item.choices.map(normal)).size, 4, `${item.id}: duplicate choices`)
      assert.equal(item.reasons.length, 4)
      assert.ok(item.reasons.every(reason => reason.length >= 15), `${item.id}: missing distractor rationale`)
      const evidenceSource = item.passage || item.audio?.join(' ') || item.lines.join(' ')
      assert.ok(normal(evidenceSource).includes(normal(item.evidence)), `${item.id}: evidence not found in source`)
      const key = normal((item.passage || item.audio?.join(' ') || '') + ' ' + (item.question || item.lines.join(' ')))
      assert.ok(!allQuestionKeys.has(key), `${item.id}: duplicated question`)
      allQuestionKeys.add(key)
    }
    assert.deepEqual(answers, [2, 2, 2, 2], `${set.id}: imbalanced answer positions`)
    const content = []
    for (const block of set.unit.readings) {
      assert.ok(!allPassages.has(normal(block.text)), `${set.id}: reused passage`)
      allPassages.add(normal(block.text))
      content.push(block.text, ...block.questions.flatMap(q => [q.prompt, ...q.choices]))
    }
    for (const block of set.unit.listenings) {
      const text = block.script.join(' ')
      assert.ok(!allScripts.has(normal(text)), `${set.id}: reused listening script`)
      allScripts.add(normal(text))
      content.push(text, block.question.prompt, ...block.question.choices)
    }
    content.push(...set.unit.vocabulary.flatMap(q => [q.prompt, ...q.choices]))
    const writing = set.writing.map(task => {
      assert.ok(task.model && task.commentary && task.checklist.length === 4)
      const range = task.target.match(/(\d+)〜(\d+)語/)
      assert.ok(range, `${set.id}: missing practice range`)
      const count = words(task.model).length
      assert.ok(count >= Number(range[1]) && count <= Number(range[2]), `${set.id}/${task.id}: model has ${count} words, expected ${range[1]}-${range[2]}`)
      content.push(task.source || '', task.instruction, task.model)
      return { id: task.id, modelWords: count, practiceRange: [Number(range[1]), Number(range[2])] }
    })
    for (const text of content) {
      const tokens = words(text)
      for (let i = 0; i + legacy.ngram <= tokens.length; i++) {
        if (forbidden.has(hash(tokens.slice(i, i + legacy.ngram).join(' ')))) collisions.push({ set: set.id, hash: hash(tokens.slice(i, i + legacy.ngram).join(' ')) })
      }
    }
    reports.push({ id: set.id, grade: set.grade, questions: items.length, choicesPerQuestion: 4, rationaleCount: items.reduce((n, item) => n + item.reasons.length, 0), evidenceLocated: true, answerPositions: answers, passageWords: set.unit.readings.map(block => words(block.text).length), listeningWords: set.unit.listenings.map(block => words(block.script.join(' ')).length), writing })
  }
  assert.equal(reports.length, 7)
  assert.deepEqual(collisions, [], 'Eight-word overlap with retired source detected; review and independently rewrite before release')
  for (const file of ['reading.ts', 'listening.ts', 'generate.ts']) await assert.rejects(access(resolve(root, 'src/data', file)))
  await writeFile(resolve(root, 'assets/content-quality-report.json'), JSON.stringify({ version: 1, status: 'structural-checks-passed', authoredUnits: 7, objectiveQuestions: 56, writingTasks: 10, sourceComparison: { ngram: legacy.ngram, baseline: 'Retired local source literals only', matches: collisions.length, limitation: 'Cannot detect all paraphrases or compare against all published works. Not a plagiarism-clearance certificate.' }, reviewLimits: 'Correct-answer uniqueness and level appropriateness receive author review, not independent expert validation or psychometric calibration.', reports }, null, 2) + '\n')
  console.log('PASS: 56 questions / 224 rationales / 10 model answers, evidence locations, no 8-word matches in local legacy baseline. External review still required.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
