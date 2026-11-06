import assert from 'node:assert/strict'
import { chromium } from 'playwright'

// Run against a built, running preview: TEST_BASE_URL defaults to port 3000.
const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
for (const id of ['2026-2', '2026-1', '2025-3', 'gen-abc', 'gen-123']) {
  const response = await fetch(`${base}/api/sets/${id}`)
  assert.equal(response.status, 200)
  const set = await response.json()
  for (const [items, sections] of [[set.reading, { R1: 15, R2: 5, R3: 5 }], [set.listening, { L1: 10, L2: 5, L3: 10 }]]) {
    assert.equal(items.length, 25, id)
    assert.deepEqual(items.map(q => q.no), Array.from({ length: 25 }, (_, i) => i + 1))
    assert.deepEqual(items.map(q => q.sec), Object.entries(sections).flatMap(([sec, count]) => Array(count).fill(sec)))
    for (const q of items) {
      assert.equal(q.choices.length, q.sec === 'L1' || q.sec === 'L3' ? 3 : 4)
      assert.ok(q.answer >= 0 && q.answer < q.choices.length)
    }
  }
}
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => d.accept())
  await page.goto(base)
  assert.ok(await page.locator('.manatobi-brand img').evaluate(img => img.complete && img.naturalWidth > 0))
  await page.goto(`${base}/exam/gen-abc`)
  assert.equal(await page.locator('#paper .q').count(), 50)
  await page.evaluate(() => {
    for (const q of document.querySelectorAll('#paper .q')) {
      const input = q.querySelectorAll('input')[Number(q.dataset.answer)]
      input.checked = true
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  assert.equal(await page.locator('#answered-count').innerText(), '50')
  await page.locator('#grade-btn').click()
  assert.equal(await page.locator('#score-val').innerText(), '50')
  await page.emulateMedia({ media: 'print' })
  assert.equal(await page.locator('.paper-tools').isVisible(), false)
  await page.emulateMedia({ media: 'screen' })
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/', '/exam/2026-2?part=reading', '/sheet/2026-2', '/answers/2026-2', '/script/2026-2']) {
    await page.goto(base + path)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path}: mobile overflow`)
  }
  await page.goto(`${base}/sheet/2026-2`)
  assert.equal(await page.locator('.mark-sheet tbody tr').count(), 50)
  assert.deepEqual(errors, [])
  assert.equal((await fetch(`${base}/sheet/not-a-set`)).status, 404)
  console.log('PASS: exam counts/order, scoring, logo, print styles, mobile layout, blank answer sheet, invalid ID')
} finally {
  await browser.close()
}
