import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
const origin = process.env.EIKEN_TEST_ORIGIN || 'http://localhost:3000';
const engine = process.env.EIKEN_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ args: engine === chromium ? ['--no-sandbox'] : [] });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block', acceptDownloads: true, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      if (localStorage.getItem('qa:seeded')) return;
      localStorage.setItem('qa:seeded', '1');
      localStorage.setItem('eiken:v1:login_fallback_local_v1', 'true');
      localStorage.setItem('eiken:v1:bgm_enabled', 'off');
      localStorage.setItem('eiken:v1:battle_growth_local_v1_guest', JSON.stringify({ version: 1, progress: { uid: 'guest', coins: 100, owned: ['print_eiken_wordbook_3'], equipped: {} }, receipts: [], day: '' }));
    });
    // Normal startup matters: screenshot mode previously masked forced BGM ON.
    await page.goto(origin);
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    await page.getByRole('button', { name: 'ログインせずに、この端末だけで続ける', exact: true }).click();
    await page.locator('[data-home-mascot]').waitFor();
    await page.locator('.game-home-logo').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('eiken:v1:bgm_enabled')), 'off');
    await page.getByRole('button', { name: 'BGMを鳴らす', exact: true }).waitFor();
    await page.locator('[data-home-practice]').click();
    await page.locator('[data-study-card="eiken_writing"]').click();
    await page.locator('[data-writing]').waitFor();
    const grade = page.getByRole('combobox', { name: 'ライティングの級' });
    assert.equal(await grade.locator('option').count(), 5);
    let completed = 0;
    for (const id of ['eiken_3', 'eiken_pre2', 'eiken_pre2plus', 'eiken_2', 'eiken_pre1']) {
      await grade.selectOption(id);
      const tasks = page.locator('.ew-controls button');
      assert.equal(await tasks.count(), 2);
      for (let index = 0; index < 2; index++) {
        await tasks.nth(index).click();
        const text = `I enjoy reading books with my friends. This is task ${completed}.`;
        await page.locator('#writing-answer').fill(text);
        assert.match(await page.locator('[data-writing-count]').innerText(), /10 words/);
        for (const label of await page.locator('.ew-answer fieldset label').all()) {
          await label.click();
          assert.equal(await label.locator('input').isChecked(), true);
        }
        await page.getByRole('button', { name: '自己点検を完了する', exact: true }).click();
        await page.getByRole('button', { name: '参考解答・解説を見る', exact: true }).click();
        assert.ok((await page.locator('[data-writing-model]').innerText()).length > 100);
        await page.getByRole('button', { name: '参考解答・解説を閉じる', exact: true }).click();
        // WebKit is tested with one reload after all tasks below: ten full reloads
        // retain video/WebProcess allocations beyond this 985MB sandbox's limit.
        if (engine === chromium) {
          await page.reload();
          await page.getByRole('button', { name: 'はじめる', exact: true }).click();
          await page.locator('[data-writing]').waitFor();
          await page.locator('.ew-controls button').nth(index).click();
        }
        assert.equal(await page.locator('#writing-answer').inputValue(), text);
        completed++;
      }
    }
    assert.equal(completed, 10);
    if (engine === webkit) {
      await page.reload();
      await page.getByRole('button', { name: 'はじめる', exact: true }).click();
      await page.locator('[data-writing]').waitFor();
      await page.locator('.ew-controls button').nth(1).click();
      assert.equal(await page.locator('#writing-answer').inputValue(), 'I enjoy reading books with my friends. This is task 9.');
    }
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('eiken:v1:eiken_writing_v1_guest')));
    assert.equal(Object.keys(stored.drafts).length, 10);
    assert.equal(Object.values(stored.drafts).filter(draft => draft.reviewed).length, 10);
    // A background sync notification must refresh the currently open draft.
    await page.evaluate(() => {
      const key = 'eiken:v1:eiken_writing_v1_guest', data = JSON.parse(localStorage.getItem(key));
      for (const draft of Object.values(data.drafts)) draft.text = 'Changed on another device.';
      localStorage.setItem(key, JSON.stringify(data));
      window.dispatchEvent(new Event('manatobi:user-data-synced'));
    });
    await page.waitForFunction(() => document.querySelector('#writing-answer').value === 'Changed on another device.');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.screenshot({ path: `qa-writing-${engine.name()}-${viewport.width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'ホーム画面へ移動', exact: true }).click();
    await page.getByRole('button', { name: 'マイページへ移動', exact: true }).click();
    await page.locator('[data-tab="prints"]').click();
    await page.locator('.collection-tile').first().click();
    await page.getByRole('button', { name: '中身を開く', exact: true }).click();
    const viewer = page.locator('[data-pdf-viewer]');
    await viewer.waitFor();
    assert.match(await viewer.locator('iframe').getAttribute('src'), /print_eiken_wordbook_3.pdf$/);
    const downloadWait = page.waitForEvent('download');
    await page.locator('[data-pdf-save]').click();
    const download = await downloadWait;
    assert.equal((await readFile(await download.path())).subarray(0, 5).toString(), '%PDF-');
    await viewer.waitFor({ state: 'detached' });
    await page.locator('.collection-tile').first().click();
    await page.getByRole('button', { name: '中身を開く', exact: true }).click();
    await viewer.waitFor();
    await page.locator('[data-pdf-close]').click();
    await viewer.waitFor({ state: 'detached' });
    await page.locator('.collection-tile').first().click();
    await page.getByRole('button', { name: '中身を開く', exact: true }).click();
    await viewer.waitFor();
    await page.goBack();
    await viewer.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine.name()} ${viewport.width}: normal BGM OFF, 10 writing tasks, save/reload/self-check/model/live sync, owned PDF open/download/back`);
    await context.close();
  }
} finally { await browser.close(); }
