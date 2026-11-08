import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const base = process.env.EIKEN_TEST_URL || 'http://localhost:3000/eiken/';
const questions = JSON.parse(execFileSync('./eiken-app/node_modules/.bin/tsx', ['-e', "import {EIKEN_QUESTIONS} from './eiken-app/src/eiken/questions'; console.log(JSON.stringify(EIKEN_QUESTIONS))"], { encoding: 'utf8' }));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const errors = [];
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('university_safety_sentinel', 'unchanged');
      window.__speechCalls = [];
      class Utterance { constructor(text) { this.text = text; } }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance });
      Object.defineProperty(window, 'speechSynthesis', { value: {
        getVoices: () => [{ name: 'Test English', lang: 'en-US', default: true }],
        addEventListener() {}, removeEventListener() {}, cancel() {}, pause() {}, resume() {},
        speak(u) { window.__speechCalls.push(u.text); setTimeout(() => { u.onstart?.(); u.onend?.(); }, 20); },
      } });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', req => {
      if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== new URL(base).origin) errors.push('Unexpected external request: ' + new URL(req.url()).origin);
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    const scope = mobile ? questions.filter(q => q.grade === 'eiken_3') : questions;
    for (const q of scope) {
      console.log(`Checking ${mobile ? 'mobile' : 'desktop'} ${q.id}`);
      await page.getByRole('button', { name: '級を選ぶ', exact: true }).click();
      assert.equal(await page.locator('[data-eiken-grade]').count(), 8);
      assert.equal(await page.locator('[data-eiken-grade="eiken_1"]').isDisabled(), true);
      await page.locator(`[data-eiken-grade="${q.grade}"]`).click();
      assert.doesNotMatch(await page.locator('body').innerText(), /共通テスト/);
      await page.locator('.round-main').nth(q.questionNumber - 1).click();
      await page.getByRole('button', { name: '問題をはじめる', exact: true }).click();
      await page.getByRole('button', { name: /の音源を再生$/ }).click();
      await page.waitForTimeout(100);
      const wrong = q.grade === 'eiken_3' && q.questionNumber === 1;
      const selected = wrong ? (q.correctAnswer + 1) % q.choices.length : q.correctAnswer;
      await page.getByRole('button', { name: new RegExp(escape(q.choices[selected])) }).click();
      await page.getByRole('button', { name: '解答と解説を見る', exact: true }).click();
      assert.match(await page.locator('body').innerText(), /和訳/);
      await page.getByRole('button', { name: '結果を見る', exact: true }).click();
      await page.waitForTimeout(1600);
      const text = await page.locator('body').innerText();
      assert.match(text, new RegExp(`${wrong ? 0 : 1}\\s*/\\s*1 問 正解`));
      assert.doesNotMatch(text, /\/ 0 問 正解/);
      await page.getByRole('button', { name: '復習・記録', exact: true }).click();
      assert.equal(await page.evaluate(() => localStorage.getItem('university_safety_sentinel')), 'unchanged');
    }
    assert.ok(await page.evaluate(() => window.__speechCalls.length > 0));
    await page.getByRole('button', { name: '設定', exact: true }).click();
    assert.match(await page.locator('body').innerText(), /この端末のみ/);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '級を選ぶ', exact: true }).click();
    await page.screenshot({ path: `.wrangler/eiken-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: all 14 Eiken questions, 7 grades + grade1 placeholder, scoring, translation, mocked speech, review navigation, reload, mobile and university storage isolation.');
} finally { await browser.close(); }
