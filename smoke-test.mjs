import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const grades = ['5', '4', '3', 'pre-2', 'pre-2-plus', '2', 'pre-1']
const listed = await (await fetch(`${base}/api/sets`)).json()
assert.equal(listed.length, 7)
assert.ok(listed.every(set => set.origin === 'independently-authored'))
for (const grade of grades) {
  const set = await (await fetch(`${base}/api/sets/original-${grade}-01`)).json()
  assert.equal(set.grade, grade)
  assert.equal(set.reading.length, 6)
  assert.equal(set.listening.length, 2)
  assert.equal(set.writing.length, ['5', '4'].includes(grade) ? 0 : 2)
  const all = [...set.reading, ...set.listening]
  assert.equal(new Set(all.map(q => q.id)).size, 8)
  for (const q of all) {
    assert.equal(q.choices.length, 4)
    assert.equal(q.reasons.length, 4)
    assert.ok(q.evidence && q.skill && q.reasons.every(Boolean))
  }
}
for (const legacy of ['2026-2', '2026-1', '2025-3', 'gen-abc']) {
  for (const path of ['exam', 'answers', 'sheet', 'script', 'api/sets']) assert.equal((await fetch(`${base}/${path}/${legacy}`)).status, 410)
}
assert.equal((await fetch(`${base}/grades/unknown`)).status, 404)
assert.equal((await fetch(`${base}/exam/original-unknown-01`)).status, 404)
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('dialog', dialog => dialog.accept())
  await page.goto(base)
  assert.equal(await page.locator('.grade-card').count(), 7)
  assert.ok(await page.locator('.manatobi-brand img').evaluate(img => img.complete && img.naturalWidth > 0))
  for (const grade of grades) {
    await page.goto(`${base}/grades/${grade}`)
    assert.match(await page.locator('#grade-status-heading').innerText(), /独立執筆/)
    assert.equal(await page.locator('.grade-navigation-link[aria-current=page]').count(), 1)
    await page.goto(`${base}/exam/original-${grade}-01`)
    assert.equal(await page.locator('#paper .q').count(), 8)
    assert.equal(await page.locator('.reading-passage').count(), 4)
    assert.equal(await page.locator('.grade-navigation-link[aria-current=page]').count(), 1)
    await page.evaluate(() => {
      for (const q of document.querySelectorAll('#paper .q')) {
        const input = q.querySelectorAll('input[type=radio]')[Number(q.dataset.answer)]
        input.checked = true
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    assert.equal(await page.locator('#answered-count').innerText(), '8')
    await page.locator('#grade-btn').click()
    assert.equal(await page.locator('#score-val').innerText(), '8')
    assert.equal(await page.locator('#paper .explain li').count(), 32)
    assert.doesNotMatch(await page.locator('#verdict').innerText(), /合格/)
    const writing = page.locator('[data-writing-input]')
    if (await writing.count()) {
      await writing.first().fill('One useful idea is sharing tools.')
      assert.equal(await page.locator('[data-word-count]').first().innerText(), '6')
      assert.equal(await page.locator('#score-val').innerText(), '8')
      assert.equal(await page.locator('.model-answer[open]').count(), 0)
      await page.locator('.model-answer summary').first().click()
      assert.equal(await page.locator('.model-answer[open]').count(), 1)
    }
  }
  await page.goto(`${base}/exam/original-4-01?part=reading`)
  assert.equal(await page.locator('#paper .q').count(), 6)
  await page.goto(`${base}/exam/original-pre-1-01?part=listening`)
  assert.equal(await page.locator('#paper .q').count(), 2)
  assert.equal(await page.locator('.writing-task').count(), 0)
  await page.emulateMedia({ media: 'print' })
  assert.equal(await page.locator('.paper-tools').isVisible(), false)
  await page.emulateMedia({ media: 'screen' })
  await page.setViewportSize({ width: 390, height: 844 })
  for (const grade of grades) for (const path of [`/grades/${grade}`, `/exam/original-${grade}-01`, `/answers/original-${grade}-01`, `/script/original-${grade}-01`, `/sheet/original-${grade}-01`]) {
    await page.goto(base + path)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path}: mobile overflow`)
  }
  await page.goto(`${base}/sheet/original-4-01`)
  assert.equal(await page.locator('.mark-sheet tbody tr').count(), 8)
  assert.deepEqual(errors, [])
  console.log('PASS: all 7 original units, grading, writing self-review, mobile, print, 20 retired endpoints and no browser errors')
} finally {
  await browser.close()
}
