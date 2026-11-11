import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
const origin=process.env.EIKEN_TEST_ORIGIN || 'http://localhost:3000';
const engine=process.env.EIKEN_ENGINE==='webkit'?webkit:chromium;
const booklets=JSON.parse(await readFile('deliverables/written-booklets.json','utf8')).booklets;
const audit=JSON.parse(await readFile('deliverables/written-pdf-validation.json','utf8'));
const browser=await engine.launch({args:engine===chromium?['--no-sandbox']:[]});
const labels={short:'短文の語句空所補充',conversation:'会話文の空所補充',reorder:'語句整序',cloze:'長文の語句空所補充',reading:'読解'};
try {
 for(const viewport of [{width:1280,height:900},{width:390,height:844}].filter(v=>!process.env.EIKEN_WIDTH || v.width===Number(process.env.EIKEN_WIDTH))) {
  const context=await browser.newContext({viewport,serviceWorkers:'block',acceptDownloads:true,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(ids=>{
   if(localStorage.getItem('qa:booklets'))return;
   localStorage.setItem('qa:booklets','1');localStorage.setItem('eiken:v1:login_fallback_local_v1','true');
   localStorage.setItem('eiken:v1:bgm_enabled','off');
   localStorage.setItem('eiken:v1:battle_growth_local_v1_guest',JSON.stringify({version:1,progress:{uid:'guest',coins:100,owned:ids,equipped:{}},receipts:[],day:''}));
  },booklets.map(exam=>`print_${exam.id}`));
  await page.goto(`${origin}/?screenshot=1`);await page.locator('[data-home-mascot]').waitFor();
  let checked=0;
  for(const exam of booklets){
   for(const section of [...new Set(exam.items.map(item=>item.section))]) {
    console.log(`${engine.name()} ${viewport.width}: ${exam.grade} ${section}`);
    const items=exam.items.filter(item=>item.section===section);
    const groups=[];
    for(const item of items){
     const group=item.passage && groups.find(group=>group[0].passage?.id===item.passage.id);
     if(group)group.push(item);else groups.push([item]);
    }
    await page.locator('[data-home-practice]').click();await page.locator(`[data-study-card="${exam.grade}"]`).click();
    await page.getByRole('tab',{name:section==='reading'||section==='cloze'?/リーディング/:/語彙・文法/}).first().click();
    await page.locator('.unit-card').filter({hasText:`${exam.scope==='reading'?'リーディング':'筆記'} 第1回｜${labels[section]}`}).locator('.unit-card-primary').click();
    for(const group of groups) {
     await page.getByRole('button',{name:'解答と解説を見る',exact:true}).waitFor();
     const body=await page.locator('body').innerText();
     if(group[0].passage)assert.ok(body.includes(group[0].passage.title));
     for(const item of group)if(item.orderTokens)for(const token of item.orderTokens)assert.ok(body.includes(token));
     assert.equal(await page.getByRole('button',{name:'問題をはじめる',exact:true}).count(),0);
     assert.equal(await page.locator('audio[src*="/eiken_audio/"]').count(),0);
     for(const [index,item] of group.entries()){
      const choice=page.getByRole('button',{name:new RegExp(`^${item.answer+1} .*／`)});
      await choice.nth(viewport.width<768?0:index).click();
      if(viewport.width<768 && index<group.length-1)await page.getByRole('button',{name:'次の解答欄へ',exact:true}).click();
     }
     await page.getByRole('button',{name:'解答と解説を見る',exact:true}).click();
     const next=page.getByRole('button',{name:/次の問題|結果を見る/}).first();await next.waitFor();
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     for(const [index,item] of group.entries()){
      if(viewport.width<768){
       const chip=page.getByRole('button',{name:/^問\d+ .*の解答・解説を(?:見る|閉じる)$/}).nth(index);await chip.waitFor();
       if(await chip.getAttribute('aria-pressed')!=='true')await chip.click();
      }
      const disclosure=page.getByRole('button',{name:'解説',exact:true}).nth(viewport.width<768?0:index);await disclosure.waitFor();
      if(await disclosure.getAttribute('aria-expanded')==='false')await disclosure.click();
      await page.waitForFunction(text=>document.body.innerText.includes(text),item.explanation);checked++;
     }
     await next.click();
    }
    await page.waitForFunction(()=>localStorage.getItem('eiken:v1:savedAppState')==='explanation');
    await page.evaluate(()=>window.__SET_APP_STATE__('home'));await page.locator('[data-home-practice]').waitFor();
   }
  }
  assert.equal(checked,212);
  await page.getByRole('button',{name:'マイページへ移動',exact:true}).click();await page.locator('[data-tab="prints"]').click();
  for(const exam of booklets){
   const report=audit.find(report=>report.id===exam.id);
   const parts=[['中身を開く','.pdf'],[`問題冊子を開く（${report.questionPages.at(-1)}ページ）`,'_questions.pdf'],['解答用紙を開く（1ページ）','_answers.pdf'],[`解答・解説を開く（${report.pages-report.questionPages.at(-1)-1}ページ）`,'_explanations.pdf']];
   const search=page.getByPlaceholder('名前で探す');
   // Isolate the owned tile by its actual registry title, including grade.
   await search.fill(exam.grade==='eiken_5'?'英検5級':exam.grade==='eiken_4'?'英検4級':exam.grade==='eiken_3'?'英検3級':exam.grade==='eiken_pre2'?'英検準2級':exam.grade==='eiken_pre2plus'?'英検準2級プラス':exam.grade==='eiken_2'?'英検2級':'英検準1級');
   for(const [label,suffix] of parts){
    await page.locator('.collection-tile').first().click();await page.getByRole('button',{name:label,exact:true}).click();
    const viewer=page.locator('[data-pdf-viewer]');await viewer.waitFor();
    assert.ok((await viewer.locator('iframe').getAttribute('src')).endsWith(`print_${exam.id}${suffix}`));
    assert.equal(await page.locator('[data-collection-detail]').count(),0);
    const wait=page.waitForEvent('download');await page.locator('[data-pdf-save]').click();const download=await wait;
    assert.equal((await readFile(await download.path())).subarray(0,5).toString(),'%PDF-');await viewer.waitFor({state:'detached'});
   }
  }
  await page.screenshot({path:`qa-booklet-collection-${engine.name()}-${viewport.width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);console.log(`PASS ${engine.name()} ${viewport.width}: 212 answers/explanations, 7 owned packs + 21 split PDFs downloaded.`);
  await context.close();
 }
} finally {await browser.close();}
