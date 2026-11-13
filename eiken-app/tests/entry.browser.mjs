import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
const origin = process.env.EIKEN_TEST_ORIGIN || 'http://localhost:3000';
const engine = process.env.EIKEN_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ args: engine === chromium ? ['--no-sandbox'] : [] });
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('eiken:v1:bgm_enabled', 'off'));
    await page.goto(origin);
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    await page.getByRole('button', { name: 'Google アカウントで続ける', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Apple/ }).count(), 0);
    await page.getByRole('button', { name: 'ログインせずに、この端末だけで続ける', exact: true }).click();
    await page.locator('[data-home-mascot]').waitFor();
    assert.deepEqual(await page.locator('[data-home-countdown] dt').allTextContents(), ['英検一次', '英検二次A']);
    assert.equal(await page.locator('[data-home-countdown]').evaluate(element => element.getBoundingClientRect().right <= innerWidth), true);
    await page.locator('[data-home-practice]').click();
    const list = page.locator('.sc-eiken-list');
    await list.waitFor();
    const gradeCards = list.locator('[data-content-kind="units"] [data-study-card]');
    assert.equal(await gradeCards.count(), 7);
    const geometry = await list.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight, scrollHeight: element.scrollHeight }));
    assert.ok(geometry.scrollWidth <= geometry.width + 1, JSON.stringify({ viewport, geometry }));
    assert.ok(geometry.scrollHeight <= geometry.height + 1, JSON.stringify({ viewport, geometry }));
    const navTop = await page.locator('[aria-label="メインナビゲーション"]').evaluate(element => element.getBoundingClientRect().top);
    for (const card of await gradeCards.all()) {
      const rect = await card.boundingBox();
      assert.ok(rect && rect.width >= 44 && rect.height >= 44);
      assert.ok(rect.y >= 0 && rect.y + rect.height <= (viewport.width < 1024 ? navTop : viewport.height), `${await card.innerText()}: ${JSON.stringify(rect)}`);
    }
    await page.screenshot({ path: `qa-entry-${engine.name()}-${viewport.width}.png` });
    await list.locator('[data-study-card="eiken_pre1"]').click();
    await page.getByRole('tab', { name: /リスニング練習/ }).click();
    await page.getByRole('button', { name: /第1回演習/ }).first().waitFor();
    await page.getByRole('button', { name: '設定画面へ移動', exact: true }).click();
    await page.getByRole('button', { name: 'Google アカウントで連携', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Apple/ }).count(), 0);
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine.name()} ${viewport.width}x${viewport.height}: all seven grades without scrolling, explicit Eiken countdown, Google-only login/settings`);
    await context.close();
  }
} finally { await browser.close(); }
