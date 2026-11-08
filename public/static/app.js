(() => {
  'use strict';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  function announce(text) { const el = $('#session-status'); if (el) el.textContent = text; }
  $$('[data-print]').forEach(button => button.addEventListener('click', () => window.print()));
  const top = $('#to-top');
  if (top) { top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' })); }
  $$('[data-writing-input]').forEach(input => {
    input.addEventListener('input', () => {
      const words = input.value.match(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g) || [];
      const counter = $(`[data-word-count="${input.dataset.writingInput}"]`);
      if (counter) counter.textContent = String(words.length);
    });
  });
  $$('[data-copy-writing]').forEach(button => button.addEventListener('click', async () => {
    const input = $(`[data-writing-input="${button.dataset.copyWriting}"]`);
    try { await navigator.clipboard.writeText(input.value); button.textContent = 'コピーしました'; }
    catch { input.focus(); input.select(); button.textContent = '選択した答案をコピーしてください'; }
    setTimeout(() => { button.textContent = '答案をコピー'; }, 3000);
  }));

  const root = $('[data-practice]');
  if (!root) return;
  let data;
  try { data = JSON.parse($('#quiz-key').textContent); } catch { announce('問題データを読み込めませんでした。ページを再読み込みしてください。'); return; }
  const items = data.items || [];
  const questions = $$('.q', root);
  const steps = $$('[data-step]', root);
  const jumps = $$('[data-jump]', root);
  const contexts = $$('[data-context-index]', root);
  const flags = new Set();
  const label = item => `${item.sec.startsWith('L') ? 'L' : 'R'}${item.no}`;
  let active = items.map((_, i) => i);
  let current = 0;
  let locked = !!data.showAnswers;
  let lastWrong = [];
  let retrying = false;
  let remaining = Number($('#timer').dataset.seconds);
  let running = false;
  let deadline = 0;
  let interval = null;
  const picked = index => { const input = $('input[type=radio]:checked', questions[index]); return input ? Number(input.value) : -1; };
  const answered = () => active.filter(index => picked(index) >= 0).length;

  const synth = window.speechSynthesis;
  let voice = null;
  let audioToken = 0;
  let audioButton = null;
  let audioContext = null;
  function pickVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    voice = voices.find(item => item.lang === 'en-US') || voices.find(item => item.lang.startsWith('en')) || null;
  }
  if (synth) { pickVoice(); synth.addEventListener('voiceschanged', pickVoice); }
  function stopAudio(message = '停止しました') {
    audioToken++;
    if (synth) synth.cancel();
    if (audioButton) { audioButton.textContent = '音声を再生'; audioButton.classList.remove('is-playing'); audioButton.setAttribute('aria-pressed', 'false'); }
    if (audioContext) {
      $('[data-audio-stop]', audioContext).disabled = true;
      $('[data-audio-status]', audioContext).textContent = message;
    }
    audioButton = null; audioContext = null;
  }
  function playAudio(button) {
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { announce('このブラウザは読み上げに対応していません。リスニング原稿で確認してください。'); return; }
    if (audioButton === button) { stopAudio(); return; }
    stopAudio('');
    const item = items.find(item => item.id === button.dataset.play);
    if (!item?.audio?.length) return;
    const context = button.closest('.study-context');
    const speed = Number($('[data-audio-rate]', context).value);
    const repeat = Number($('[data-audio-repeat]', context).value);
    const lines = item.audio.slice();
    if (item.question && !lines.includes(item.question)) lines.push(`Question. ${item.question}`);
    const token = audioToken;
    audioButton = button; audioContext = context;
    button.textContent = '再生を停止'; button.classList.add('is-playing'); button.setAttribute('aria-pressed', 'true');
    $('[data-audio-stop]', context).disabled = false;
    let round = 0;
    let line = 0;
    function next() {
      if (token !== audioToken) return;
      if (line >= lines.length) { line = 0; round++; }
      if (round >= repeat) { stopAudio('再生が終わりました'); return; }
      $('[data-audio-status]', context).textContent = `${round + 1}回目を再生中`;
      const text = lines[line++].replace(/^[AB]\s*:\s*/, '');
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US'; utterance.rate = speed; if (voice) utterance.voice = voice;
      utterance.onend = () => { if (token === audioToken) setTimeout(next, line === lines.length ? 800 : 260); };
      utterance.onerror = () => { if (token === audioToken) { stopAudio('再生できませんでした。もう一度お試しください。'); } };
      synth.speak(utterance);
    }
    next();
  }
  $$('[data-play]', root).forEach(button => button.addEventListener('click', () => playAudio(button)));
  $$('[data-audio-stop]', root).forEach(button => button.addEventListener('click', () => stopAudio()));
  $$('[data-audio-rate], [data-audio-repeat]', root).forEach(select => select.addEventListener('change', () => stopAudio('設定を変更しました')));
  window.addEventListener('pagehide', () => stopAudio(''));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAudio('停止しました'); });

  function paintTimer() {
    $('#timer').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    $('#timer').classList.toggle('is-low', remaining < 60);
  }
  function pauseTimer() {
    if (running) remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    running = false; clearInterval(interval); paintTimer();
    $('#toggle-timer').textContent = remaining ? '再開' : '終了';
  }
  $('#toggle-timer').addEventListener('click', () => {
    if (locked || !remaining) return;
    if (running) { pauseTimer(); return; }
    running = true; deadline = Date.now() + remaining * 1000; $('#toggle-timer').textContent = '一時停止';
    interval = setInterval(() => {
      remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); paintTimer();
      if (!remaining) { pauseTimer(); announce('目安の時間になりました。解答は続けられます。'); }
    }, 250);
  });

  function updateNavigation() {
    jumps.forEach((button, index) => {
      button.hidden = !active.includes(index);
      button.classList.toggle('is-current', index === current);
      button.classList.toggle('is-answered', picked(index) >= 0);
      button.classList.toggle('is-flagged', flags.has(index));
      const isRight = picked(index) === items[index].answer;
      button.classList.toggle('is-correct', locked && !data.showAnswers && isRight);
      button.classList.toggle('is-incorrect', locked && !data.showAnswers && !isRight);
      if (index === current) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
      $('.jump-state', button).textContent = locked ? data.showAnswers ? '解説' : isRight ? '正解' : picked(index) < 0 ? '未解答' : '不正解' : picked(index) < 0 ? '未解答' : '解答済み';
      button.setAttribute('aria-label', `${label(items[index])}、${$('.jump-state', button).textContent}${flags.has(index) ? '、見直し' : ''}`);
    });
    $('#sidebar-progress').textContent = `${answered()}/${active.length}`;
  }
  function showQuestion(index, moveFocus = true) {
    if (!active.includes(index)) return;
    stopAudio(''); current = index;
    steps.forEach(step => { step.hidden = Number(step.dataset.step) !== index; });
    const context = Number(steps[index].dataset.context);
    const previousContext = contexts.find(section => !section.hidden);
    contexts.forEach(section => { section.hidden = Number(section.dataset.contextIndex) !== context; });
    if (previousContext !== contexts[context]) $('.context-column', root).scrollTop = 0;
    const position = active.indexOf(index);
    $('#question-position').textContent = `${position + 1} / ${active.length}`;
    $('#previous-question').disabled = position === 0;
    $('#next-question').hidden = position === active.length - 1;
    $('#open-review').hidden = position !== active.length - 1;
    $('#open-review').textContent = data.showAnswers ? '最初の解説へ' : locked ? '結果を見る' : '解答を見直す';
    $('#session-mode').textContent = data.showAnswers ? '解答・解説' : locked ? '採点後の見直し' : retrying ? '間違えた問題の解き直し' : '解答中';
    updateNavigation();
    if (moveFocus) { const title = $('.q-prompt, .q-line', questions[index]); if (title) { title.setAttribute('tabindex','-1'); title.focus({preventScroll:true}); } $('#paper').scrollIntoView({behavior:'smooth',block:'start'}); }
  }
  jumps.forEach((button,index) => button.addEventListener('click', () => { $('#answer-check').hidden = true; showQuestion(index); }));
  $('#previous-question').addEventListener('click', () => showQuestion(active[active.indexOf(current)-1]));
  $('#next-question').addEventListener('click', () => showQuestion(active[active.indexOf(current)+1]));
  $('#reading-font-size').addEventListener('change', event => root.classList.toggle('large-reading', event.target.value === 'large'));
  $$('[data-flag]', root).forEach(button => button.addEventListener('click', () => {
    if (locked) return;
    const index = questions.findIndex(q => q.dataset.id === button.dataset.flag);
    if (flags.has(index)) flags.delete(index); else flags.add(index);
    button.setAttribute('aria-pressed', flags.has(index) ? 'true' : 'false');
    button.textContent = flags.has(index) ? '見直しを解除' : 'あとで見直す';
    updateNavigation();
  }));
  questions.forEach((q,index) => q.addEventListener('change', event => {
    if (!event.target.matches('input[type=radio]') || locked) return;
    $$('.choice',q).forEach(choice => choice.classList.toggle('is-selected', $('input',choice).checked));
    updateNavigation(); announce(`${label(items[index])}の解答を選びました。${answered()}問解答済みです。`);
  }));
  function openReview() {
    stopAudio('');
    if (locked) { if (data.showAnswers) { showQuestion(active[0]); return; } $('#result').scrollIntoView({behavior:'smooth'}); return; }
    const missing = active.filter(index => picked(index) < 0).length;
    const marked = active.filter(index => flags.has(index)).length;
    $('#review-summary').textContent = `解答済み ${answered()}問 / ${active.length}問　未解答 ${missing}問　見直し ${marked}問`;
    const grid = $('#answer-check-grid'); grid.replaceChildren();
    active.forEach(index => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'answer-check-item';
      if (picked(index)<0) button.classList.add('is-unanswered');
      const heading = document.createElement('strong'); heading.textContent = label(items[index]);
      const answer = document.createElement('span'); answer.textContent = picked(index)<0 ? '未解答' : `解答 ${picked(index)+1}`;
      const flag = document.createElement('small'); flag.textContent = flags.has(index) ? '見直しあり' : '';
      button.append(heading,answer,flag); button.addEventListener('click', () => { $('#answer-check').hidden = true; showQuestion(index); }); grid.append(button);
    });
    $('#answer-check').hidden = false; $('#answer-check').scrollIntoView({behavior:'smooth'}); $('#grade-btn').focus({preventScroll:true});
  }
  $('#open-review').addEventListener('click',openReview);
  $('#close-review').addEventListener('click', () => { $('#answer-check').hidden = true; showQuestion(current); });

  function applyReview(index) {
    const q = questions[index], item = items[index], choice = picked(index);
    q.classList.add('is-graded');
    $$('.choice',q).forEach((element,i) => {
      $('input',element).disabled = true;
      element.classList.remove('is-selected');
      element.classList.toggle('is-correct',i===item.answer);
      element.classList.toggle('is-wrong',choice===i && i!==item.answer);
    });
    $(`[data-flag="${item.id}"]`,q).disabled = true;
    $('.explain',q).hidden = false;
    $(`[data-result-for="${item.id}"]`,q).textContent = data.showAnswers ? '' : choice<0 ? '未解答' : choice===item.answer ? '正解しました' : `あなたの解答 ${choice+1}`;
  }
  $('#grade-btn').addEventListener('click', () => {
    if (locked) return;
    const missing = active.filter(index => picked(index)<0).length;
    if (missing && !window.confirm(`未解答が${missing}問あります。このまま採点しますか？`)) return;
    stopAudio(''); pauseTimer(); locked = true; root.classList.add('is-graded'); $('#toggle-timer').disabled = true;
    lastWrong = active.filter(index => picked(index)!==items[index].answer);
    active.forEach(applyReview);
    const correct = active.length-lastWrong.length;
    $('#score-val').textContent = String(correct); $('.score-den').textContent = ` / ${active.length}問`;
    $('#verdict').textContent = `正答率 ${Math.round(correct/active.length*100)}%`;
    $('#result-note').textContent = `${retrying ? `解き直した${active.length}問` : '今回の選択問題'}の結果です。公式試験の合否判定には使えません。`;
    const box = $('#sec-scores'); box.replaceChildren();
    for (const section of [...new Set(active.map(index=>items[index].sec))]) {
      const group = active.filter(index=>items[index].sec===section), right=group.filter(index=>picked(index)===items[index].answer).length;
      const card=document.createElement('article'); card.className='section-result'; const title=document.createElement('h3'); title.textContent=section==='R1'?'語彙・文法':section==='R2'?'読解':'リスニング'; const count=document.createElement('p'); count.textContent=`${right} / ${group.length}問`; card.append(title,count); box.append(card);
    }
    const tbody = $('#review-body'); tbody.replaceChildren();
    active.forEach(index => {
      const item=items[index], answer=picked(index), tr=document.createElement('tr');
      const th=document.createElement('th'); th.scope='row'; const jump=document.createElement('button'); jump.type='button'; jump.className='text-button'; jump.textContent=label(item); jump.addEventListener('click',()=>showQuestion(index)); th.append(jump); tr.append(th);
      [item.sec==='R1'?'語彙・文法':item.sec==='R2'?'読解':'リスニング',answer<0?'未解答':`${answer+1}. ${item.choices[answer]}`,`${item.answer+1}. ${item.choices[item.answer]}`,answer===item.answer?'正解':'不正解'].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);}); tbody.append(tr);
    });
    $('#review-wrong').disabled = !lastWrong.length; $('#retry-wrong').disabled = !lastWrong.length;
    $('#answer-check').hidden=true; $('#result').hidden=false; updateNavigation(); showQuestion(current,false); $('#result').scrollIntoView({behavior:'smooth'}); announce(`採点しました。${active.length}問中${correct}問正解です。`);
  });
  $('#review-wrong').addEventListener('click', () => { if(lastWrong.length) showQuestion(lastWrong[0]); });
  $('#review-all').addEventListener('click', () => showQuestion(active[0]));
  $('#retry-wrong').addEventListener('click', () => {
    if(!lastWrong.length) return;
    active=lastWrong.slice(); retrying=true; locked=false; flags.clear(); root.classList.remove('is-graded');
    active.forEach(index=>{
      const q=questions[index]; q.classList.remove('is-graded'); $('.explain',q).hidden=true;
      $$('.choice',q).forEach(choice=>{choice.classList.remove('is-correct','is-wrong','is-selected');const input=$('input',choice);input.checked=false;input.disabled=false;});
      const flag=$('[data-flag]',q);flag.disabled=false;flag.setAttribute('aria-pressed','false');flag.textContent='あとで見直す';
      $$('details',q).forEach(details=>details.open=false);
    });
    $('#result').hidden=true; $('#answer-check').hidden=true; $('#toggle-timer').disabled=false; $('#toggle-timer').textContent='開始'; remaining=Math.max(180,active.length*90); paintTimer(); showQuestion(active[0]); announce(`間違えた${active.length}問を解き直します。正解は再び採点するまで表示しません。`);
  });
  if (locked) { items.forEach((_,index)=>applyReview(index)); $('#open-review').textContent='最初の解説に戻る'; }
  const hash=location.hash;
  const section = hash==='#sec-R1'?'R1':hash==='#sec-R2'?'R2':hash==='#sec-L2'?'L2':null;
  const start = section ? items.findIndex(item=>item.sec===section) : 0;
  showQuestion(start>=0?start:0,false); paintTimer();
})();
