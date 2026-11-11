import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
const origin=process.env.EIKEN_TEST_ORIGIN || 'http://localhost:3000';
const engine=process.env.EIKEN_ENGINE==='webkit'?webkit:chromium;
const data=JSON.parse(await readFile('deliverables/written-booklets.json','utf8')).booklets[0];
const browser=await engine.launch({args:engine===chromium?['--no-sandbox']:[]});
try {
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]) {
  const context=await browser.newContext({viewport,serviceWorkers:'block',acceptDownloads:true,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   if(localStorage.getItem('qa:booklets'))return;
   localStorage.setItem('qa:booklets','1');localStorage.setItem('eiken:v1:login_fallback_local_v1','true');
   localStorage.setItem('eiken:v1:bgm_enabled','off');
   localStorage.setItem('eiken:v1:battle_growth_local_v1_guest',JSON.stringify({version:1,progress:{uid:'guest',coins:100,owned:['print_eiken_5_written_01'],equipped:{}},receipts:[],day:''}));
  });
  await page.goto(`${origin}/?screenshot=1`);await page.locator('[data-home-mascot]').waitFor();
  let checked=0;
  for(const [section,label] of [['short','短文の語句空所補充'],['conversation','会話文の空所補充'],['reorder','語句整序']]) {
   await page.locator('[data-home-practice]').click();await page.locator('[data-study-card="eiken_5"]').click();
   await page.getByRole('tab',{name:/語彙・文法/}).first().click();
   await page.locator('.unit-card').filter({hasText:`筆記 第1回｜${label}`}).locator('.unit-card-primary').click();
   for(const item of data.items.filter(item=>item.section===section)) {
    await page.getByRole('button',{name:'解答と解説を見る',exact:true}).waitFor();
    const body=await page.locator('body').innerText();
    if(item.orderTokens)for(const token of item.orderTokens)assert.ok(body.includes(token));
    assert.equal(await page.getByRole('button',{name:'問題をはじめる',exact:true}).count(),0,'Written practice must not open a listening briefing');
    assert.equal(await page.locator('audio[src*="/eiken_audio/"]').count(),0,'Written practice must not request a listening file');
    const choice=page.getByRole('button').filter({hasText:new RegExp(`^${item.answer+1}`)}).first();
    await choice.click();await page.getByRole('button',{name:'解答と解説を見る',exact:true}).click();
    const next=page.getByRole('button',{name:/次の問題|結果を見る/}).first();await next.waitFor();
    if(viewport.width<768){
     const chip=page.getByRole('button',{name:/^問\d+ .*の解答・解説を(?:見る|閉じる)$/});await chip.waitFor();
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     if(await chip.getAttribute('aria-pressed')!=='true')await chip.click();
    }
    const disclosure=page.getByRole('button',{name:'解説',exact:true}).first();await disclosure.waitFor();
    if(await disclosure.getAttribute('aria-expanded')==='false')await disclosure.click();
    await page.waitForFunction(text=>document.body.innerText.includes(text),item.explanation);
    checked++;
    if(checked===21)await page.screenshot({path:`qa-booklet-reorder-${engine.name()}-${viewport.width}.png`,fullPage:true});
    await next.click();
   }
   await page.waitForFunction(()=>localStorage.getItem('eiken:v1:savedAppState')==='explanation');
   await page.evaluate(()=>window.__SET_APP_STATE__('home'));await page.locator('[data-home-practice]').waitFor();
  }
  assert.equal(checked,25);
  await page.getByRole('button',{name:'マイページへ移動',exact:true}).click();await page.locator('[data-tab="prints"]').click();
  for(const [label,suffix] of [['中身を開く','.pdf'],['問題冊子を開く（5ページ）','_questions.pdf'],['解答用紙を開く（1ページ）','_answers.pdf'],['解答・解説を開く（10ページ）','_explanations.pdf']]) {
   await page.locator('.collection-tile').first().click();await page.getByRole('button',{name:label,exact:true}).click();
   const viewer=page.locator('[data-pdf-viewer]');await viewer.waitFor();
   assert.ok((await viewer.locator('iframe').getAttribute('src')).endsWith(`print_eiken_5_written_01${suffix}`));
   assert.equal(await page.locator('[data-collection-detail]').count(),0,'Collection modal must not obscure PDF controls');
   const wait=page.waitForEvent('download');await page.locator('[data-pdf-save]').click();const download=await wait;
   assert.equal((await readFile(await download.path())).subarray(0,5).toString(),'%PDF-');await viewer.waitFor({state:'detached'});
  }
  await page.screenshot({path:`qa-booklet-collection-${engine.name()}-${viewport.width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);console.log(`PASS ${engine.name()} ${viewport.width}: all 25 original questions/explanations, no audio, owned pack + 3 split PDFs downloaded.`);
  await context.close();
 }
} finally {await browser.close();}
