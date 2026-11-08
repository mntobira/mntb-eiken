import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdir, mkdtemp, writeFile, rm, access } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { makeJobs, manifestPath, options, loadJobs, root } from './media-common.mjs'

await mkdir(join(root, '.wrangler'), { recursive: true })

const fixture = { id: 'sample', listening: [
  { no: 1, sec: 'L1', audio: ['☆Can you help me?'], choices: ['Yes.', 'Blue.', 'Monday.'], answer: 0 },
  { no: 11, sec: 'L2', audio: ['A: Hello.', 'B: Hi.', 'What does he say?'], question: 'What does he say?', choices: ['Hi.', 'Go.', 'No.', 'Bye.'], answer: 0 },
  { no: 16, sec: 'L3', audio: ['A cat.', 'A dog.', 'A bird.'], sceneJp: '犬が一匹いる', choices: ['A cat.', 'A dog.', 'A bird.'], answer: 1 },
] }

test('plans include numbered response choices, avoid duplicate questions, and omit role markers', () => {
  const jobs = makeJobs([fixture])
  assert.equal(jobs.length, 4)
  assert.match(jobs[0].text, /1\. Yes\.\n2\. Blue\.\n3\. Monday\./)
  assert.doesNotMatch(jobs[0].text, /☆/)
  assert.equal(jobs[1].text.match(/What does he say\?/g).length, 1)
  assert.equal(jobs[2].text, '1. A cat.\n2. A dog.\n3. A bird.')
  assert.match(jobs[3].prompt, /A dog\./)
})

test('content keys are stable and duplicate content is not billed twice', () => {
  const one = makeJobs([fixture])
  const two = makeJobs([fixture, { ...fixture, id: 'other' }])
  assert.deepEqual(one.map(j => j.id), two.map(j => j.id))
  assert.equal(two[0].sources.length, 2)
})

test('snapshot manifest covers all 7 independently authored units', async () => {
  const data = JSON.parse(await readFile(manifestPath, 'utf8'))
  assert.equal(data.version, 1)
  const audio = data.jobs.filter(j => j.kind === 'audio')
  const image = data.jobs.filter(j => j.kind === 'image')
  assert.equal(data.origin, 'independently-authored')
  assert.equal(data.sets.length, 7)
  assert.equal(audio.flatMap(j => j.sources).length, 14)
  assert.equal(image.flatMap(j => j.sources).length, 7)
  assert.ok(image.every(job => job.sources.every(source => source.section === 'cover')))
  assert.equal(new Set(data.jobs.map(j => j.id)).size, data.jobs.length)
})

test('dry-runs require no provider credentials and create no media', async () => {
  const temp = await mkdtemp(join(root, '.wrangler/media-test-'))
  try {
    for (const kind of ['audio', 'images']) {
      const result = spawnSync(process.execPath, [`scripts/generate-${kind}.mjs`, '--output-dir', join(temp, 'not-created')], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: temp } })
      assert.equal(result.status, 0, result.stderr)
      assert.match(result.stdout, /DRY RUN/)
    }
    await assert.rejects(access(join(temp, 'not-created')))
    const blocked = spawnSync(process.execPath, ['scripts/generate-audio.mjs', '--execute'], { cwd: root, encoding: 'utf8' })
    assert.equal(blocked.status, 1)
    assert.match(blocked.stderr, /Paid generation refused/)
  } finally { await rm(temp, { recursive: true, force: true }) }
})

test('unsafe manifest output paths and invalid limits are refused', async () => {
  const temp = await mkdtemp(join(root, '.wrangler/media-test-'))
  try {
    const file = join(temp, 'bad.json')
    await writeFile(file, JSON.stringify({ version: 1, jobs: [{ id: 'audio-' + 'a'.repeat(20), kind: 'audio', output: '../escape.mp3', text: 'Hello' }] }))
    await assert.rejects(loadJobs('audio', options(['--manifest', file])), /Unsafe output filename/)
    await assert.rejects(loadJobs('audio', options(['--limit', 'NaN'])), /positive integer/)
  } finally { await rm(temp, { recursive: true, force: true }) }
})
