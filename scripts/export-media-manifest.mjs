import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { makeJobs, manifestPath } from './media-common.mjs'

const { values } = parseArgs({ options: {
  base: { type: 'string', default: 'http://localhost:3000' },
  sets: { type: 'string' },
  output: { type: 'string', default: manifestPath },
}})
try {
  const base = new URL(values.base)
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Expected an HTTP(S) preview URL')
  const sets = []
  const listing = await fetch(new URL('/api/sets', base), { signal: AbortSignal.timeout(15000) })
  if (!listing.ok) throw new Error('Unable to list original units')
  const available = await listing.json()
  const ids = values.sets ? values.sets.split(',').map(s => s.trim()) : available.map(set => set.id)
  for (const id of ids) {
    const response = await fetch(new URL(`/api/sets/${encodeURIComponent(id)}`, base), { signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`Unable to load set ${id}: ${response.status}`)
    const set = await response.json()
    if (set.provenance?.origin !== 'independently-authored') throw new Error('Refusing legacy or unverified source content')
    if (!Array.isArray(set.listening) || set.listening.length === 0) throw new Error(`Set ${id} has no listening questions`)
    sets.push(set)
  }
  const jobs = makeJobs(sets)
  const target = resolve(values.output)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify({ version: 1, origin: 'independently-authored', grades: sets.map(s => s.grade), sets: sets.map(s => s.id), notes: 'Independent original units only. Cover images are decorative, not assessed question diagrams. No media has been generated. Review before use.', jobs }, null, 2) + '\n')
  console.log(`Wrote ${jobs.filter(j => j.kind === 'image').length} image / ${jobs.filter(j => j.kind === 'audio').length} audio jobs to ${target}. No paid calls.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
