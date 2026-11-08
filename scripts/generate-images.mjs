import { spawnSync } from 'node:child_process'
import { readFile, rename, rm } from 'node:fs/promises'
import { options, loadJobs, targetPath } from './media-common.mjs'

try {
  const opts = options()
  const jobs = await loadJobs('image', opts)
  for (const job of jobs) {
    const target = await targetPath(job, opts)
    if (!target) { console.log(`SKIP existing ${job.id}`); continue }
    console.log(`${opts.execute ? 'GENERATE' : 'DRY RUN'} ${job.id} -> ${target}\n${job.prompt}\n`)
    if (!opts.execute) continue
    // CLI auth belongs to the local Genspark installation; never write tokens to this repo.
    // Use argv and stdin, never a shell, so prompt text cannot become a command.
    const temporary = `${target}.part.png`
    try {
      const result = spawnSync('gsk', ['--no-input', 'image_generation', '--args-file', '-', '--output-file', temporary], {
        input: JSON.stringify({ model: 'nano-banana-2-flash-lite', query: job.prompt, aspect_ratio: '4:3', image_size: '1k' }),
        encoding: 'utf8', timeout: 20 * 60 * 1000, maxBuffer: 4 * 1024 * 1024,
      })
      if (result.error || result.status !== 0) throw new Error(`Image generation failed for ${job.id}. Check local gsk authentication, account credits and CLI logs. No automatic retry is performed.`)
      const bytes = await readFile(temporary)
      if (bytes.length < 8 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Expected PNG output; inspect the provider result before retrying.')
      await rename(temporary, target)
    } finally { await rm(temporary, { force: true }) }
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
