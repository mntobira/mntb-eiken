import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.EIKEN_TEST_ORIGIN || 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('eiken:v1:login_fallback_local_v1', 'true');
    window.__audioProbe = { sources: [], title: null };
    const proto = AudioContext.prototype;
    const originalMedia = proto.createMediaElementSource;
    proto.createMediaElementSource = function (media) {
      const source = originalMedia.call(this, media);
      const analyser = this.createAnalyser(); analyser.fftSize = 2048;
      source.connect(analyser);
      const originalConnect = source.connect.bind(source);
      const probe = { context: this, analyser, media, gain: null };
      source.connect = function (target, ...rest) {
        if (target instanceof GainNode) probe.gain = target;
        return originalConnect(target, ...rest);
      };
      window.__audioProbe.title = probe;
      return source;
    };
    const originalBuffer = proto.createBufferSource;
    proto.createBufferSource = function () {
      const source = originalBuffer.call(this);
      const record = { source, context: this, active: false, stopAt: null };
      window.__audioProbe.sources.push(record);
      const start = source.start.bind(source), stop = source.stop.bind(source);
      source.start = (...args) => { record.active = true; return start(...args); };
      source.stop = (...args) => { record.stopAt = args[0] ?? this.currentTime; return stop(...args); };
      return source;
    };
  });
  await page.goto(`${origin}/?screenshot=1`);
  await page.locator('[data-home-mascot]').waitFor();
  await page.locator('.game-home-logo').click();
  const title = page.locator('audio[src="/tanjou.mp3"]');
  await page.waitForFunction(() => {
    const audio = document.querySelector('audio[src="/tanjou.mp3"]');
    return audio && !audio.paused && audio.currentTime > .2 && !audio.error;
  });
  // Check decoded PCM and a running audio context, not just successful fetches.
  await page.waitForFunction(() => {
    const probe = window.__audioProbe.title;
    if (!probe || probe.context.state !== 'running' || probe.gain?.gain.value <= 0) return false;
    const samples = new Float32Array(probe.analyser.fftSize); probe.analyser.getFloatTimeDomainData(samples);
    return samples.some(value => Math.abs(value) > .00001);
  });
  await page.getByRole('button', { name: 'BGMを止める', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio[src="/tanjou.mp3"]').paused);
  assert.equal(await page.evaluate(() => localStorage.getItem('eiken:v1:bgm_enabled')), 'off');
  await page.reload();
  await page.getByRole('button', { name: 'BGMを鳴らす', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('audio[src="/tanjou.mp3"]').paused);
  await page.getByRole('button', { name: '設定画面へ移動', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'BGM音量', exact: true });
  await slider.fill('0.37');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('eiken:v1:battle_audio_settings')).volume === .37);
  await page.getByRole('button', { name: 'ホーム画面へ移動', exact: true }).click();
  await page.locator('[data-home-practice]').click();
  await page.locator('[data-study-card="english_vocabulary"]').click();
  await page.locator('[data-fd-range]').waitFor();
  await page.waitForFunction(() => document.querySelector('audio[src="/tanjou.mp3"]').paused);
  await page.getByRole('button', { name: 'ホーム画面へ移動', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('audio[src="/tanjou.mp3"]').paused);
  await page.locator('[data-home-battle]').click();
  await page.getByRole('button', { name: /AIと対戦/ }).click();
  await page.waitForFunction(() => window.__audioProbe.sources.some(record => record.source.loop && record.active && record.stopAt === null && record.context.state === 'running'));
  await page.getByRole('button', { name: /^英検5級/ }).click();
  await page.getByRole('button', { name: /リスニング練習/ }).click();
  await page.getByRole('button', { name: /マナボ（見習い）/ }).click();
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.locator('#battle-question .bqa-play').waitFor();
  await page.waitForFunction(() => !window.__audioProbe.sources.some(record => record.source.loop && record.active && (record.stopAt === null || record.stopAt > record.context.currentTime + .01)));
  assert.equal(await title.evaluate(audio => audio.paused), true);
  await page.evaluate(() => window.__SET_APP_STATE__('home'));
  await page.getByRole('button', { name: 'BGMを止める', exact: true }).click();
  await page.reload();
  await page.locator('[data-home-mascot]').waitFor();
  await page.locator('.game-home-logo').click();
  assert.equal(await title.evaluate(audio => audio.paused), true);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('eiken:v1:battle_audio_settings')).volume), .37);
  assert.deepEqual(errors, []);
  console.log('Audio checks passed: actual decoded title PCM, OFF persistence, restart, volume persistence, wordbook silence, lobby music and silent Eiken listening battles.');
  await context.close();
} finally { await browser.close(); }
