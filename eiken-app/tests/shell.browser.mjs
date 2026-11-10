import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run against an already-built local preview. Never signs in or writes to cloud services.
const origin = process.env.EIKEN_TEST_ORIGIN || 'http://localhost:3000';
const grades = ['eiken_5', 'eiken_4', 'eiken_3', 'eiken_pre2', 'eiken_pre2plus', 'eiken_2', 'eiken_pre1'];
const browser = await chromium.launch({ args: ['--no-sandbox'] });
let flows = 0;
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    const externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (!request.url().startsWith(origin) && /^https?:/.test(request.url())) externalRequests.push(request.url());
    });
    await page.addInitScript(() => {
      if (!localStorage.getItem('university_sentinel')) localStorage.setItem('university_sentinel', 'unchanged');
      localStorage.setItem('eiken:v1:login_fallback_local_v1', 'true');
    });
    await page.goto(`${origin}/?screenshot=1`);
    await page.locator('[data-home-practice]').waitFor();
    assert.equal(await page.locator('.game-home-logo').getAttribute('src'), '/brand/manatobi-logo.webp');
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('16px "Inter"')), true);
    for (const grade of grades) {
      await page.locator('[data-home-practice]').click();
      await page.locator('[data-study-card="eiken_3"]').waitFor();
      assert.equal(await page.locator('[data-study-card^="eiken_"]').count(), 7);
      assert.equal(await page.locator('[data-study-card="eiken_1"]').count(), 0);
      await page.locator(`[data-study-card="${grade}"]`).click();
      await page.getByRole('button', { name: /第1回演習/ }).first().waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('eiken:v1:savedSelectedSubject')), grade);
      await page.getByRole('button', { name: /第1回演習/ }).first().click();
      await page.getByRole('button', { name: '問題をはじめる', exact: true }).click();
      await page.getByRole('button', { name: '解答と解説を見る', exact: true }).waitFor();
      // Question ids and range must survive a reload before answering.
      await page.reload();
      await page.getByRole('button', { name: '問題をはじめる', exact: true }).click();
      await page.getByRole('button', { name: '解答と解説を見る', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('eiken:v1:savedSelectedChapterId')), `${grade}_listening_01`);
      const choices = page.getByRole('button').filter({ hasText: /^[1-4]/ });
      assert.ok(await choices.count() >= 3);
      await choices.first().click();
      await page.getByRole('button', { name: '解答と解説を見る', exact: true }).click();
      await page.getByRole('button', { name: '結果を見る', exact: true }).waitFor();
      assert.match(await page.locator('body').innerText(), /和訳/);
      await page.getByRole('button', { name: '結果を見る', exact: true }).click();
      // Finish through the actual UI; automation is used only to return to the next case.
      await page.waitForFunction(() => localStorage.getItem('eiken:v1:savedAppState') === 'explanation');
      await page.evaluate(() => window.__SET_APP_STATE__('home'));
      await page.locator('[data-home-practice]').waitFor();
      flows += 1;
    }
    // The bottom navigation retains the original catalog, now populated with grades.
    await page.getByRole('button', { name: '学習画面へ移動', exact: true }).click();
    await page.locator('[data-study-card="eiken_3"]').waitFor();
    assert.equal(await page.locator('[data-study-card^="eiken_"]').count(), 7);
    assert.equal(await page.locator('[data-study-card="english_listening"]').count(), 0);
    await page.locator('[data-study-card="english_vocabulary"]').click();
    await page.locator('[data-fd-range]').waitFor();
    assert.equal(await page.getByRole('alert').count(), 0);
    // A menu alone is not parity: play the shared AI battle through both real questions.
    await page.getByRole('button', { name: 'ホーム画面へ移動', exact: true }).click();
    await page.locator('[data-home-battle]').click();
    await page.getByRole('button', { name: /AIと対戦/ }).click();
    await page.getByRole('button', { name: /^英検5級/ }).click();
    await page.getByRole('button', { name: /リスニング練習/ }).click();
    await page.getByRole('button', { name: /マナボ（見習い）/ }).click();
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    for (let question = 0; question < 2; question += 1) {
      const prompt = page.locator('#battle-question .arena-question-prompt');
      await prompt.waitFor();
      const before = await prompt.innerText();
      assert.equal(await page.locator('#battle-question .bqa-play').count(), 1);
      const choices = page.locator('#battle-question button').filter({ hasText: /^[A-Za-z]/ });
      assert.equal(await choices.count(), 4);
      await choices.first().click();
      if (question === 0) await page.waitForFunction(previous => {
        const prompt = document.querySelector('#battle-question .arena-question-prompt');
        return prompt && prompt.innerText !== previous;
      }, before);
    }
    await page.getByRole('button', { name: /詳しい結果を確認する/ }).waitFor();
    assert.match(await page.locator('body').innerText(), /AI対戦ではレートは動きません/);
    await page.evaluate(() => window.__SET_APP_STATE__('home'));
    await page.getByRole('button', { name: 'ガチャ画面へ移動', exact: true }).click();
    await page.waitForFunction(() => localStorage.getItem('eiken:v1:savedAppState') === 'growth');
    await page.getByRole('button', { name: '設定画面へ移動', exact: true }).click();
    await page.waitForFunction(() => localStorage.getItem('eiken:v1:savedAppState') === 'settings');
    assert.equal(await page.evaluate(() => localStorage.getItem('university_sentinel')), 'unchanged');
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, [], 'Local-only mode must not contact cloud services');
    await context.close();
  }
  // Registration must not remove or reuse the listening app's caches.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/?screenshot=1`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await caches.open('manatobi-shell-v7');
    await caches.open('manatobi-eiken-shell-stale');
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.unregister();
    await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(async () => !(await caches.keys()).includes('manatobi-eiken-shell-stale'));
  const keys = await page.evaluate(() => caches.keys());
  assert.ok(keys.includes('manatobi-shell-v7'));
  assert.ok(keys.some(key => key.startsWith('manatobi-eiken-shell-')));
  for (const path of ['/tanjou.mp3', '/cinematics/title.mp4', '/manifest.json', '/data/vocabPron.json', '/fonts/shared.css', '/prints/print_level_eiken_howto.pdf']) {
    const response = await page.request.get(origin + path);
    assert.equal(response.status(), 200, path);
    assert.ok(!response.headers()['content-type'].includes('text/html'), path);
  }
  await context.close();
  console.log(`PASS: ${flows} desktop/mobile grade-to-result flows, reload, catalog, vocabulary, storage/network isolation, and PWA caches.`);
} finally {
  await browser.close();
}
