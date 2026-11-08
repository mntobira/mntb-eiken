import { options, loadJobs, targetPath, saveAtomic } from './media-common.mjs'

try {
  const opts = options()
  const jobs = await loadJobs('audio', opts)
  if (opts.execute && jobs.length && (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID)) {
    throw new Error('Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in your local environment. Do not commit credentials.')
  }
  for (const job of jobs) {
    const target = await targetPath(job, opts)
    if (!target) { console.log(`SKIP existing ${job.id}`); continue }
    console.log(`${opts.execute ? 'GENERATE' : 'DRY RUN'} ${job.id} -> ${target}\n${job.text}\n`)
    if (!opts.execute) continue
    // One consistent preset narrator; no voice cloning or real-person impersonation.
    // No automatic retries: after a timeout verify provider history to avoid duplicate charges.
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(process.env.ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_128`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: job.text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.6, similarity_boost: 0.75 } }),
      signal: AbortSignal.timeout(120000),
    })
    if (!response.ok) throw new Error(`Audio provider returned HTTP ${response.status} for ${job.id}. No automatic retry.`)
    if (!response.headers.get('content-type')?.includes('audio/')) throw new Error('Provider returned non-audio content')
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length < 64) throw new Error('Audio output is unexpectedly small')
    await saveAtomic(target, bytes)
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
