import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const grades = ['5', '4', '3', 'pre-2', 'pre-2-plus', '2', 'pre-1']
const removedInterfaceCopy = /MANATOBI\s*\/|INDEPENDENTLY AUTHORED|ORIGINAL FOCUS UNIT|PRACTICE BOOK|GRADE INDEX|LEARNING CYCLE|HOW TO REVIEW|OTHER GRADES|WRITE & REVIEW|ANSWER KEY|ANSWER SHEET|LISTENING SCRIPT|独立執筆|生成用スクリプト|外部専門家|網羅的照合|旧セットURL/
async function checkInterfaceCopy(page) {
  assert.doesNotMatch(await page.locator('body').innerText(), removedInterfaceCopy)
}
async function fillAnswers(page, wrong = [], missing = []) {
  // Set hidden answers deliberately for test setup; navigation is tested separately.
  await page.evaluate(({ wrong, missing }) => {
    document.querySelectorAll('#paper .q').forEach((q, index) => {
      if (missing.includes(index)) return
      const answer = Number(q.dataset.answer)
      const input = q.querySelectorAll('input[type=radio]')[wrong.includes(index) ? (answer + 1) % 4 : answer]
      input.checked = true
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }, { wrong, missing })
}
async function submit(page) {
  await page.locator('[data-jump]:not([hidden])').last().click()
  await page.locator('#open-review').click()
  assert.equal(await page.locator('#answer-check').isVisible(), true)
  await page.locator('#grade-btn').click()
}
const listed = await (await fetch(`${base}/api/sets`)).json()
assert.equal(listed.length, 7)
for (const grade of grades) {
  const set = await (await fetch(`${base}/api/sets/original-${grade}-01`)).json()
  assert.equal(set.grade, grade)
  assert.equal(set.provenance.origin, 'independently-authored')
  assert.equal(set.reading.length, 6)
  assert.equal(set.listening.length, 2)
  assert.equal(set.writing.length, ['5', '4'].includes(grade) ? 0 : 2)
  for (const q of [...set.reading, ...set.listening]) {
    assert.equal(q.choices.length, 4)
    assert.equal(q.reasons.length, 4)
    assert.ok(q.evidence && q.skill && q.reasons.every(Boolean))
    if (q.passage || q.audio) assert.ok(q.translation)
  }
}
for (const legacy of ['2026-2', '2026-1', '2025-3', 'gen-abc']) {
  for (const path of ['exam', 'answers', 'sheet', 'script', 'api/sets']) assert.equal((await fetch(`${base}/${path}/${legacy}`)).status, 410)
}
for (const path of ['/grades/unknown', '/exam/original-unknown-01']) assert.equal((await fetch(base + path)).status, 404)
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('dialog', dialog => dialog.accept())
  await page.goto(base)
  assert.equal(await page.locator('.grade-card').count(), 7)
  await checkInterfaceCopy(page)
  assert.equal(await page.locator('h1').innerText(), '英検の練習問題')
  assert.ok(await page.locator('.manatobi-brand img').evaluate(img => img.complete && img.naturalWidth > 0))
  for (const grade of grades) {
    await page.goto(`${base}/grades/${grade}`)
    assert.equal(await page.locator('.lesson-overview').count(), 1)
    assert.equal(await page.locator('.practice-options>a').count(), 3)
    await checkInterfaceCopy(page)
    assert.equal(await page.locator('.grade-navigation-link[aria-current=page]').count(), 1)
    await page.goto(`${base}/exam/original-${grade}-01`)
    assert.equal(await page.locator('#paper .q').count(), 8)
    assert.equal(await page.locator('.reading-passage').count(), 2, 'shared passages must not repeat')
    assert.equal(await page.locator('[data-step]:visible').count(), 1)
    assert.equal(await page.locator('.study-context:visible').count(), 1)
    assert.equal(await page.locator('.explain:visible').count(), 0)
    assert.equal(await page.locator('#toggle-timer').innerText(), '開始')
    await fillAnswers(page)
    assert.equal(await page.locator('#sidebar-progress').innerText(), '8/8')
    await submit(page)
    assert.equal(await page.locator('#score-val').innerText(), '8')
    assert.equal(await page.locator('#paper input[type=radio]:disabled').count(), 32)
    assert.equal(await page.locator('#paper .explain li').count(), 32)
    assert.equal(await page.locator('#retry-wrong').isDisabled(), true)
    assert.doesNotMatch(await page.locator('#verdict').innerText(), /合格/)
    const writing = page.locator('[data-writing-input]')
    if (await writing.count()) {
      await writing.first().fill('One useful idea is sharing tools.')
      assert.equal(await page.locator('[data-word-count]').first().innerText(), '6')
      assert.equal(await page.locator('.model-answer[open]').count(), 0)
      await page.locator('.model-answer summary').first().click()
      assert.equal(await page.locator('.model-answer[open]').count(), 1)
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
    }
  }

  // Real keyboard/radio interaction, timer, flags and shared-context navigation.
  await page.goto(`${base}/exam/original-4-01?part=reading#sec-R2`)
  assert.equal(await page.locator('#question-position').innerText(), '3 / 6')
  await page.locator('#reading-font-size').selectOption('large')
  assert.equal(await page.locator('[data-practice].large-reading').count(), 1)
  await page.locator('[data-jump="0"]').click()
  await page.locator('[data-step="0"] .choice').first().click()
  assert.equal(await page.locator('[data-step="0"] input:checked').count(), 1)
  await page.locator('[data-step="0"] input').first().focus()
  await page.keyboard.press('ArrowDown')
  assert.equal(await page.locator('[data-step="0"] input:checked').inputValue(), '1')
  await page.locator('[data-step="0"] [data-flag]').click()
  assert.equal(await page.locator('[data-jump="0"].is-flagged').count(), 1)
  await page.locator('#toggle-timer').click()
  assert.equal(await page.locator('#toggle-timer').innerText(), '一時停止')
  await page.locator('#toggle-timer').click()
  assert.equal(await page.locator('#toggle-timer').innerText(), '再開')
  await page.locator('[data-jump="5"]').click()
  await page.locator('#open-review').click()
  assert.match(await page.locator('#review-summary').innerText(), /未解答 5問.*見直し 1問/)
  await page.locator('.answer-check-item').first().click()
  assert.equal(await page.locator('#question-position').innerText(), '1 / 6')
  assert.equal(await page.locator('#answer-check').isVisible(), false)

  // Wrong + unanswered are both retried; correct responses stay locked and excluded.
  await page.goto(`${base}/exam/original-5-01`)
  await fillAnswers(page, [2], [7])
  await submit(page)
  assert.equal(await page.locator('#score-val').innerText(), '6')
  await page.locator('#review-wrong').click()
  assert.equal(await page.locator('[data-step="2"] .explain').isVisible(), true)
  await page.locator('[data-step="2"] .translation summary').click()
  assert.ok((await page.locator('[data-step="2"] .translation').innerText()).includes('紙の船'))
  await page.locator('#retry-wrong').click()
  assert.equal(await page.locator('[data-jump]:visible').count(), 2)
  assert.equal(await page.locator('#sidebar-progress').innerText(), '0/2')
  assert.equal(await page.locator('#paper input[type=radio]:not(:disabled)').count(), 8)
  assert.equal(await page.locator('.explain:visible').count(), 0)
  assert.equal(await page.locator('.reading-passage mark').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)')
  for (const index of [2, 7]) {
    await page.locator(`[data-jump="${index}"]`).click()
    const answer = await page.locator(`[data-step="${index}"] .q`).getAttribute('data-answer')
    await page.locator(`[data-step="${index}"] .choice`).nth(Number(answer)).click()
  }
  await submit(page)
  assert.equal(await page.locator('#score-val').innerText(), '2')
  assert.equal((await page.locator('.score-den').innerText()).trim(), '/ 2問')
  assert.equal(await page.locator('#retry-wrong').isDisabled(), true)
  assert.equal(await page.locator('#paper input[type=radio]:disabled').count(), 32)

  await page.goto(`${base}/exam/original-3-01?show=answers`)
  assert.equal(await page.locator('#paper input[type=radio]:disabled').count(), 32)
  assert.equal(await page.locator('.explain:visible').count(), 1)
  assert.equal(await page.locator('#toggle-timer').isDisabled(), true)
  await page.emulateMedia({ media: 'print' })
  assert.equal(await page.locator('[data-step]:visible').count(), 8)
  assert.equal(await page.locator('.context-column').isVisible(), false)
  assert.equal(await page.locator('article.print-context:visible').count(), 2)
  assert.equal(await page.locator('.practice-toolbar').isVisible(), false)
  await page.emulateMedia({ media: 'screen' })
  await page.setViewportSize({ width: 390, height: 844 })
  for (const grade of grades) for (const path of [`/grades/${grade}`, `/exam/original-${grade}-01`, `/answers/original-${grade}-01`, `/script/original-${grade}-01`, `/sheet/original-${grade}-01`]) {
    await page.goto(base + path)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path}: mobile overflow`)
    await checkInterfaceCopy(page)
  }
  await page.goto(`${base}/sheet/original-4-01`)
  assert.equal(await page.locator('.mark-sheet tbody tr').count(), 8)
  assert.deepEqual(errors, [])
  console.log('PASS: 7 grades, shared passages, keyboard navigation, flags, review, answer lock, wrong-only retry, translations, timer, writing, mobile/print and retired endpoints')

  // Mocked browser speech tests use no paid services or generated media.
  const audioPage = await browser.newPage({ reducedMotion: 'reduce' })
  await audioPage.addInitScript(() => {
    window.spoken = []
    window.cancelCount = 0
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [{ lang: 'en-US' }], addEventListener() {},
      speak(utterance) { window.spoken.push(utterance); window.latestUtterance = utterance },
      cancel() { window.cancelCount++ },
    } })
  })
  audioPage.on('pageerror', error => errors.push(error.message))
  await audioPage.goto(`${base}/exam/original-5-01?part=listening`)
  await audioPage.locator('[data-audio-repeat]').first().selectOption('2')
  await audioPage.locator('[data-audio-rate]').first().selectOption('0.8')
  await audioPage.locator('[data-play]').first().click()
  assert.equal(await audioPage.evaluate(() => spoken[0].rate), 0.8)
  for (let i = 0; i < 6; i++) {
    await audioPage.evaluate(() => latestUtterance.onend())
    await audioPage.waitForTimeout(i % 3 === 2 ? 850 : 300)
  }
  assert.equal(await audioPage.evaluate(() => spoken.length), 6, 'two lines plus question, repeated twice')
  assert.match(await audioPage.locator('[data-audio-status]').first().innerText(), /終わりました/)
  await audioPage.locator('[data-play]').first().click()
  await audioPage.evaluate(() => latestUtterance.onend())
  await audioPage.locator('#next-question').click()
  const stoppedAt = await audioPage.evaluate(() => spoken.length)
  await audioPage.waitForTimeout(900)
  assert.equal(await audioPage.evaluate(() => spoken.length), stoppedAt, 'cancel queued callback on question change')
  await audioPage.locator('[data-play]').nth(1).click()
  await audioPage.evaluate(() => latestUtterance.onerror())
  assert.match(await audioPage.locator('[data-audio-status]').nth(1).innerText(), /再生できません/)
  assert.equal(await audioPage.locator('[data-audio-stop]').nth(1).isDisabled(), true)
  assert.deepEqual(errors, [])
  console.log('PASS: mocked speech speed, repeat, completion, queue cancellation and failure recovery')
} finally {
  await browser.close()
}
