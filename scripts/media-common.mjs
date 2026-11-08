import { createHash } from 'node:crypto'
import { readFile, mkdir, access, rename, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const manifestPath = resolve(root, 'assets/media-manifest.json')
export const digest = value => createHash('sha256').update(value).digest('hex').slice(0, 20)
export const cleanLine = line => String(line).replace(/^[★☆]+\s*/, '').replace(/^[AB]\s*:\s*/, '').replace(/^Question:\s*/i, 'Question. ').trim()

export function makeJobs(sets) {
  const jobs = new Map()
  for (const set of sets) {
    for (const item of set.listening) {
      const source = { set: set.id, section: item.sec, number: item.no }
      let lines = (item.audio || []).map(cleanLine)
      if (item.sec === 'L1') lines.push(...item.choices.map((choice, i) => `${i + 1}. ${choice}`))
      if (item.sec === 'L3') lines = item.choices.map((choice, i) => `${i + 1}. ${choice}`)
      if (item.question && !lines.includes(cleanLine(item.question))) lines.push(cleanLine(item.question))
      const text = lines.join('\n')
      const audioId = `audio-${digest(text)}`
      const audio = jobs.get(audioId) || { id: audioId, kind: 'audio', output: `${audioId}.mp3`, text, sources: [] }
      audio.sources.push(source)
      jobs.set(audioId, audio)
      if (item.sceneJp) {
        const prompt = [
          'Create an original black-and-white line illustration for an English listening practice question.',
          'White background, crisp simple outlines, clear action and objects, suitable for young learners and A4 printing.',
          'No logos, watermark, answer labels, decorative symbols, or explanatory captions. Do not copy any existing exam illustration.',
          'Preserve all exam-relevant quantities, clock times and spatial relationships. Necessary numerals may appear on clocks or signs.',
          `Scene description: ${item.sceneJp}`,
          `The scene must depict this statement: ${item.choices[item.answer]}`,
        ].join('\n')
        const imageId = `image-${digest(prompt)}`
        const image = jobs.get(imageId) || { id: imageId, kind: 'image', output: `${imageId}.png`, prompt, sources: [] }
        image.sources.push(source)
        jobs.set(imageId, image)
      }
    }
  }
  return [...jobs.values()]
}

export function options(args = process.argv.slice(2)) {
  return parseArgs({ args, options: {
    manifest: { type: 'string', default: manifestPath },
    execute: { type: 'boolean', default: false },
    'confirm-cost': { type: 'boolean', default: false },
    only: { type: 'string' },
    limit: { type: 'string', default: '1' },
    force: { type: 'boolean', default: false },
    'output-dir': { type: 'string', default: resolve(root, '.media-output') },
    help: { type: 'boolean', default: false },
  }}).values
}

export async function loadJobs(kind, opts) {
  if (opts.help) {
    console.log(`Generate ${kind}: --manifest PATH --only JOB_ID --limit N --output-dir DIR --force\nDefault: dry-run, at most 1 job. Paid generation requires BOTH --execute --confirm-cost.\nReview the manifest and generated media before publishing. Output is outside public/.`)
    return []
  }
  if (opts.execute && !opts['confirm-cost']) throw new Error('Paid generation refused: add --confirm-cost after reviewing the dry-run.')
  if (!/^\d+$/.test(opts.limit) || Number(opts.limit) < 1) throw new Error('--limit must be a positive integer')
  const data = JSON.parse(await readFile(resolve(opts.manifest), 'utf8'))
  if (data.version !== 1 || !Array.isArray(data.jobs)) throw new Error('Invalid media manifest')
  let jobs = data.jobs.filter(job => job.kind === kind)
  if (opts.only) {
    jobs = jobs.filter(job => job.id === opts.only)
    if (!jobs.length) throw new Error('Unknown job ID for this media type')
  }
  jobs = jobs.slice(0, Number(opts.limit))
  for (const job of jobs) {
    if (!new RegExp(`^${kind}-[a-f0-9]{20}$`).test(job.id)) throw new Error('Unsafe job ID')
    if (job.output !== `${job.id}.${kind === 'audio' ? 'mp3' : 'png'}`) throw new Error('Unsafe output filename')
    const body = kind === 'audio' ? job.text : job.prompt
    if (typeof body !== 'string' || !body.trim()) throw new Error('Missing generation text')
  }
  return jobs
}

export async function targetPath(job, opts) {
  const directory = resolve(opts['output-dir'])
  const target = resolve(directory, job.output)
  if (!opts.execute) return target
  await mkdir(directory, { recursive: true })
  if (!opts.force) {
    try { await access(target); return null } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  return target
}

export async function saveAtomic(target, bytes) {
  const temp = `${target}.part`
  await writeFile(temp, bytes)
  await rename(temp, target)
}
