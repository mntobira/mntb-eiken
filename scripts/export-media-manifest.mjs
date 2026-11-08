import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { makeJobs, manifestPath } from './media-common.mjs'

const { values } = parseArgs({ options: {
  base: { type: 'string', default: 'http://localhost:3000' },
  sets: { type: 'string', default: '2026-2,2026-1,2025-3' },
  output: { type: 'string', default: manifestPath },
}})
try {
  const base = new URL(values.base)
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Expected an HTTP(S) preview URL')
  const sets = []
  for (const id of values.sets.split(',').map(s => s.trim())) {
    const response = await fetch(new URL(`/api/sets/${encodeURIComponent(id)}`, base), { signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`Unable to load set ${id}: ${response.status}`)
    const set = await response.json()
    if (!Array.isArray(set.listening) || set.listening.length === 0) throw new Error(`Set ${id} has no listening questions`)
    sets.push(set)
  }
  const jobs = makeJobs(sets)
  const target = resolve(values.output)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify({ version: 1, grade: '5', sets: sets.map(s => s.id), notes: 'Generation plans only. No media has been generated. Review prompts, rights, pronunciation, and answer consistency before use.', jobs }, null, 2) + '\n')
  console.log(`Wrote ${jobs.filter(j => j.kind === 'image').length} image / ${jobs.filter(j => j.kind === 'audio').length} audio jobs to ${target}. No paid calls.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
