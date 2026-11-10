import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const origin = process.env.EIKEN_TEST_ORIGIN || 'http://localhost:3000';
const vocabulary = JSON.parse(readFileSync(new URL('../public/data/listeningVocabulary.json', import.meta.url), 'utf8'));
const grades = [...new Set(vocabulary.words.map(word => word.level))];
const engines = process.env.EIKEN_ENGINE === 'webkit' ? [webkit] : process.env.EIKEN_WEBKIT === '1' ? [chromium, webkit] : [chromium];
let writtenFlows = 0;
for (const engine of engines) {
  const browser = await engine.launch({ args: engine === chromium ? ['--no-sandbox'] : [] });
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }].filter(viewport => !process.env.EIKEN_WIDTH || viewport.width === Number(process.env.EIKEN_WIDTH))) {
      console.log(`Checking ${engine.name()} ${viewport.width}px`);
      const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('eiken:v1:login_fallback_local_v1', 'true'));
      await page.goto(`${origin}/?screenshot=1`);
      await page.locator('[data-home-mascot]').waitFor();
      const art = page.locator('.spin-mascot-front .home-mascot-art');
      await art.evaluate(image => image.decode());
      assert.equal(await art.evaluate(image => image.naturalWidth > 0 && image.getBoundingClientRect().height > 80), true);
      assert.equal(await art.evaluate(image => getComputedStyle(image).opacity), '1');
      // Pixel evidence is deliberately retained outside production assets.
      await page.screenshot({ path: `qa-release-home-${engine.name()}-${viewport.width}.png` });
      await page.getByRole('button', { name: 'ガチャ画面へ移動', exact: true }).click();
      for (const pool of ['kyotsu', 'niji']) {
        await page.locator(`[data-gacha-pool-tab="${pool}"]`).click();
        await page.locator(`[data-gacha-pool="${pool}"] [data-gacha-hero]`).waitFor();
        assert.equal(await page.locator(`[data-gacha-pool="${pool}"] [data-gacha-pickup-item]`).count(), 5);
        assert.doesNotMatch(await page.locator('[data-gacha-featured]').innerText(), /共通テスト|2次試験/);
        await page.locator(`[data-gacha-pool="${pool}"] [data-gacha-pickup-open]`).click();
        const modal = page.locator('[data-gacha-pickup]');
        await modal.waitFor({ state: 'visible' });
        assert.equal(await modal.locator('[data-gacha-pickup-item]').count(), 6);
        await modal.getByRole('button', { name: '閉じる', exact: true }).click();
        await page.locator(`[data-gacha-pool="${pool}"] [data-gacha-hero]`).click();
        await page.locator('[data-gacha-detail]').waitFor({ state: 'visible' });
        assert.match(await page.locator('[data-gacha-detail]').innerText(), /装備できます|マイPDF/);
        await page.locator('[data-gacha-detail]').getByRole('button', { name: '閉じる', exact: true }).click();
      }
      await page.screenshot({ path: `qa-release-gacha-${engine.name()}-${viewport.width}.png` });
      // Start every restored written section from its actual visible tab, not an automation shortcut.
      await page.getByRole('button', { name: 'ホーム画面へ移動', exact: true }).click();
      for (const grade of grades) {
        for (const section of ['リーディング', '語彙・文法']) {
          console.log(`  ${grade} ${section}`);
          await page.locator('[data-home-practice]').click();
          await page.locator(`[data-study-card="${grade}"]`).click();
          await page.getByRole('tab', { name: new RegExp(section) }).first().click();
          await page.locator('.unit-card-primary').first().click();
          await page.getByRole('button', { name: '解答と解説を見る', exact: true }).waitFor();
          assert.equal(await page.getByRole('button', { name: '問題をはじめる', exact: true }).count(), 0, 'Written questions must not have a listening briefing');
          const source = await page.locator('body').innerText();
          assert.match(source, /[a-z]{3,}/i);
          await page.getByRole('button').filter({ hasText: /^[1-4]/ }).first().click();
          await page.getByRole('button', { name: '解答と解説を見る', exact: true }).click();
          await page.getByRole('button', { name: /次の問題|結果を見る/ }).first().waitFor();
          if (viewport.width < 768) {
            const chip = page.getByRole('button', { name: /^問1 .*の解答・解説を(?:見る|閉じる)$/ });
            await chip.waitFor();
            // Allow the screen's first-incorrect auto-selection effect to commit
            // before toggling; otherwise WebKit may select between read and click.
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            if (await chip.getAttribute('aria-pressed') !== 'true') await chip.click();
          }
          const disclosure = page.getByRole('button', { name: '解説', exact: true }).first();
          await disclosure.waitFor().catch(async error => {
            console.error('Explanation state:', grade, section, await page.locator('body').innerText());
            await page.screenshot({ path: 'qa-release-explanation-failure.png' });
            throw error;
          });
          if (await disclosure.getAttribute('aria-expanded') === 'false') await disclosure.click();
          await page.waitForFunction(() => document.body.innerText.includes('根拠'));
          const explanation = await page.locator('body').innerText();
          assert.match(explanation, /根拠/);
          if (section === 'リーディング') assert.match(explanation, /全文和訳/);
          assert.equal(await page.evaluate(() => localStorage.getItem('eiken:v1:savedSelectedChapterId')), `${grade}_${section === 'リーディング' ? 'reading' : 'vocabulary'}_01`);
          // Finish the second actual problem as well, then return from the result screen.
          await page.getByRole('button', { name: /次の問題/ }).first().click();
          await page.getByRole('button', { name: '解答と解説を見る', exact: true }).waitFor();
          await page.getByRole('button').filter({ hasText: /^[1-4]/ }).first().click();
          await page.getByRole('button', { name: '解答と解説を見る', exact: true }).click();
          await page.getByRole('button', { name: '結果を見る', exact: true }).click();
          await page.waitForFunction(() => localStorage.getItem('eiken:v1:savedAppState') === 'explanation');
          await page.evaluate(() => window.__SET_APP_STATE__('home'));
          await page.locator('[data-home-practice]').waitFor();
          writtenFlows++;
        }
      }
      await page.getByRole('button', { name: 'ホーム画面へ移動', exact: true }).click();
      await page.locator('[data-home-practice]').click();
      await page.locator('[data-study-card="english_vocabulary"]').click();
      await page.locator('[data-fd-range]').waitFor();
      for (const grade of grades) {
        await page.locator(`[data-fd-range-pick="${grade}"]`).click();
        await page.locator(`[data-fd-start="${grade}"]`).click();
        assert.equal(await page.locator('.fd-word').count(), 60);
        await page.locator('.fd-word-main').first().click();
        assert.ok((await page.locator('[aria-label="独自例文"]').innerText()).length > 10);
        await page.locator('[data-fd-range-back]').click();
      }
      await page.locator('[data-fd-range-pick="eiken_5"]').click();
      await page.getByRole('button', { name: '4択・間違えた語の復習', exact: true }).click();
      await page.locator('[data-vocab-quiz="pick"]').waitFor();
      assert.doesNotMatch(await page.locator('[data-foundation]').innerText(), /共通テスト|2次試験|志望校/);
      await page.getByRole('radio', { name: '英→日', exact: true }).click();
      await page.locator('[data-vocab-start]').click();
      let firstWord;
      for (let index = 0; index < 10; index++) {
        await page.locator('[data-vocab-quiz="play"]').waitFor();
        const label = (await page.locator('.vq-label').innerText()).trim();
        const word = vocabulary.words.find(word => word.level === 'eiken_5' && word.word === label);
        assert.ok(word, `Missing word ${label}`);
        if (index === 0) firstWord = word;
        const question = word.questions.find(question => question.id.endsWith(':e2j'));
        await page.locator('.vq-options button').nth(index === 0 ? (question.answerIndex + 1) % 4 : question.answerIndex).click();
        await page.locator('.vq-next').click();
      }
      await page.locator('[data-vocab-quiz="done"]').waitFor();
      const record = await page.evaluate(() => JSON.parse(localStorage.getItem('eiken:v1:eiken_vocab_quiz_v2_guest')));
      assert.deepEqual(record.missed, [firstWord.id]);
      assert.equal(record.mastered.length, 9);
      const known = await page.evaluate(() => JSON.parse(localStorage.getItem('eiken:v1:listening_support_v1_guest')).words);
      assert.equal(known.length, 9); assert.equal(known.includes(firstWord.id), false);
      await page.getByRole('button', { name: '間違えた1語だけもう一度', exact: true }).click();
      await page.locator('.vq-options button').nth(firstWord.questions.find(question => question.id.endsWith(':e2j')).answerIndex).click();
      await page.locator('.vq-next').click();
      await page.locator('[data-vocab-quiz="done"]').waitFor();
      const reviewed = await page.evaluate(() => JSON.parse(localStorage.getItem('eiken:v1:eiken_vocab_quiz_v2_guest')));
      assert.deepEqual(reviewed.missed, []);
      assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('eiken:v1:listening_support_v1_guest')).words)).length, 10);
      assert.deepEqual(errors, []);
      await context.close();
    }
    // Corrupt growth must not remove the mascot or overwrite the original record.
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('eiken:v1:login_fallback_local_v1', 'true');
      localStorage.setItem('eiken:v1:battle_growth_local_v1_guest', '{broken record');
    });
    await page.goto(`${origin}/?screenshot=1`);
    await page.locator('[data-home-mascot]').waitFor();
    assert.equal(await page.locator('.spin-mascot-front img.home-mascot-art').evaluate(image => image.decode().then(() => image.naturalWidth > 0)), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('eiken:v1:battle_growth_local_v1_guest')), '{broken record');
    await context.close();
  } finally { await browser.close(); }
}
console.log(`Release checks passed: ${writtenFlows} written section flows, mascot pixels, both gacha pools, all grade wordbooks and corrupt-save fallback.`);
