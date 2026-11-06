/* =============================================================
   英検5級 演習アプリ — フロントエンド
   - 選択肢の選択状態
   - リスニング音声（Web Speech API / en-US）
   - タイマー / 進捗
   - 採点・解説・分野別スコア
   ============================================================= */
(function () {
  'use strict';

  /* ---------------- トースト通知 ---------------- */
  var toastEl = null;
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2400);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- ページトップへ戻る ---------- */
  var toTop = document.getElementById('to-top');
  if (toTop) {
    toTop.style.transition = 'opacity .18s ease';
    toTop.style.opacity = '0';
    toTop.style.pointerEvents = 'none';
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', function () {
      var on = window.scrollY > 400;
      toTop.style.opacity = on ? '1' : '0';
      toTop.style.pointerEvents = on ? 'auto' : 'none';
    });
  }

  /* ---------- 5級以外のタブ ---------- */
  document.querySelectorAll('.grade-tab, .grade-pill').forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (el.classList.contains('is-current')) return;
      e.preventDefault();
      toast('このアプリは5級のみ収録しています（他の級は準備中です）');
    });
  });

  document.querySelectorAll('[data-print]').forEach(function (button) {
    button.addEventListener('click', function () { window.print(); });
  });

  const paper = document.getElementById('paper');
  if (!paper) return;

  /* ---------- データ ---------- */
  const dataEl = document.getElementById('quiz-key');
  const DATA = dataJson(dataEl);
  const KEY = DATA.key || {};

  function dataJson(el) {
    if (!el) return {};
    try {
      return JSON.parse(el.textContent || '{}');
    } catch (e) {
      return {};
    }
  }

  const questions = Array.from(document.querySelectorAll('#paper .q'));

  /* ---------- 選択状態 ---------- */
  function syncQuestion(q) {
    q.querySelectorAll('.choice').forEach(function (label) {
      const input = label.querySelector('input');
      label.classList.toggle('is-selected', !!(input && input.checked));
    });
  }

  paper.addEventListener('change', function (e) {
    const input = e.target;
    if (!input || input.type !== 'radio') return;
    const q = input.closest('.q');
    if (q) syncQuestion(q);
    updateProgress();
  });

  paper.addEventListener('click', function (e) {
    const label = e.target.closest ? e.target.closest('.choice') : null;
    if (!label) return;
    const q = label.closest('.q');
    if (q && q.classList.contains('is-graded')) return;
    const input = label.querySelector('input');
    if (input && !input.checked) {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  /* ---------- 進捗 ---------- */
  const answeredCountEl = document.getElementById('answered-count');
  const answeredBarEl = document.getElementById('answered-bar');

  function answeredCount() {
    return questions.filter(function (q) {
      return !!q.querySelector('input:checked');
    }).length;
  }

  function updateProgress() {
    const n = answeredCount();
    if (answeredCountEl) answeredCountEl.textContent = String(n);
    if (answeredBarEl) {
      const pct = questions.length ? (n / questions.length) * 100 : 0;
      answeredBarEl.style.width = pct + '%';
    }
  }
  updateProgress();

  /* ---------- タイマー ---------- */
  const timerEl = document.getElementById('timer');
  const timerBtn = document.getElementById('toggle-timer');
  let remaining = 47 * 60;
  let running = true;

  if (timerEl) {
    const m = (timerEl.textContent || '').match(/(\d+):(\d+)/);
    if (m) remaining = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    paintTimer();
  }

  function paintTimer() {
    if (!timerEl) return;
    const mm = Math.floor(remaining / 60);
    const ss = remaining % 60;
    timerEl.textContent = pad(mm) + ':' + pad(ss);
    timerEl.classList.toggle('is-low', remaining <= 60);
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  if (timerEl) {
    setInterval(function () {
      if (!running || remaining <= 0) return;
      remaining -= 1;
      paintTimer();
      if (remaining === 0) toast('時間になりました。採点してみましょう。');
    }, 1000);
  }

  if (timerBtn) {
    timerBtn.addEventListener('click', function () {
      running = !running;
      timerBtn.textContent = running ? 'タイマー停止' : 'タイマー再開';
    });
  }

  /* ---------- 音声読み上げ ---------- */
  const AUDIO = DATA.audio || {};
  const synth = window.speechSynthesis;
  let voice = null;
  let playingBtn = null;

  function pickVoice() {
    if (!synth) return null;
    const voices = synth.getVoices();
    if (!voices.length) return null;
    const preferred = [
      'Google US English',
      'Samantha',
      'Microsoft Aria Online (Natural) - English (United States)',
      'Microsoft Zira',
      'Karen',
      'Alex',
    ];
    for (let i = 0; i < preferred.length; i++) {
      const hit = voices.find(function (v) {
        return v.name === preferred[i] || v.name.indexOf(preferred[i]) === 0;
      });
      if (hit) return hit;
    }
    return (
      voices.find(function (v) { return v.lang === 'en-US'; }) ||
      voices.find(function (v) { return v.lang && v.lang.indexOf('en') === 0; }) ||
      voices[0]
    );
  }

  if (synth) {
    voice = pickVoice();
    synth.onvoiceschanged = function () {
      voice = pickVoice();
    };
  }

  function cleanLine(line) {
    return String(line)
      .replace(/^[★☆]+\s*/, '')
      .replace(/^(\d+)\s+/, '')
      .replace(/^Question:\s*/i, 'Question. ')
      .replace(/^([AB])\s*:\s*/, '')
      .replace(/[“”]/g, '"');
  }

  function speak(lines, rate, btn) {
    if (!synth) {
      toast('このブラウザは音声読み上げに対応していません');
      return;
    }
    synth.cancel();
    if (playingBtn) playingBtn.classList.remove('is-playing');

    playingBtn = btn || null;
    if (playingBtn) playingBtn.classList.add('is-playing');

    lines.forEach(function (raw, index) {
      const u = new SpeechSynthesisUtterance(cleanLine(raw));
      u.lang = 'en-US';
      u.rate = rate;
      u.pitch = 1;
      if (voice) u.voice = voice;
      if (index === lines.length - 1) {
        u.onend = function () {
          if (playingBtn) playingBtn.classList.remove('is-playing');
          playingBtn = null;
        };
      }
      synth.speak(u);
    });
  }

  document.addEventListener('click', function (e) {
    const playBtn = e.target.closest ? e.target.closest('[data-play]') : null;
    const slowBtn = e.target.closest ? e.target.closest('[data-slow]') : null;
    if (!playBtn && !slowBtn) return;
    e.preventDefault();

    const btn = playBtn || slowBtn;
    const id = btn.getAttribute(playBtn ? 'data-play' : 'data-slow');
    const entry = AUDIO[id];
    if (!entry) return;

    if (playBtn && playBtn.classList.contains('is-playing')) {
      synth.cancel();
      playBtn.classList.remove('is-playing');
      playingBtn = null;
      return;
    }

    const lines = (entry.lines || []).slice();
    if (entry.question) lines.push(entry.question);
    speak(lines, slowBtn ? 0.7 : 0.92, btn);
  });

  /* ---------- 採点 ---------- */
  const gradeBtn = document.getElementById('grade-btn');
  const resultCard = document.getElementById('result');

  if (gradeBtn) {
    gradeBtn.addEventListener('click', function () {
      const answered = answeredCount();

      if (answered === 0) {
        toast('まだ解答がありません。選択肢を選んでください。');
        return;
      }
      if (answered < questions.length) {
        const go = window.confirm(
          '未解答が ' + (questions.length - answered) + ' 問あります。このまま採点しますか？'
        );
        if (!go) return;
      }

      running = false;
      if (timerBtn) timerBtn.textContent = 'タイマー再開';

      let correct = 0;
      const perSection = {};
      const rows = [];

      questions.forEach(function (q) {
        const item = KEY[q.getAttribute('data-id')];
        if (!item) return;

        const checked = q.querySelector('input:checked');
        const picked = checked ? parseInt(checked.value, 10) : -1;
        const isRight = picked === item.a;

        q.classList.add('is-graded');
        q.querySelectorAll('.choice').forEach(function (label) {
          const idx = parseInt(label.getAttribute('data-index'), 10);
          label.classList.remove('is-selected');
          if (idx === item.a) label.classList.add('is-correct');
          else if (idx === picked) label.classList.add('is-wrong');
        });

        if (isRight) correct += 1;

        const secName = item.s || 'その他';
        if (!perSection[secName]) perSection[secName] = { right: 0, total: 0 };
        perSection[secName].total += 1;
        if (isRight) perSection[secName].right += 1;

        rows.push({
          no: item.n,
          sec: secName,
          picked: picked,
          answer: item.a,
          right: isRight,
          item: item,
        });

        const old = q.querySelector('.explain');
        if (old) old.remove();

        const box = document.createElement('div');
        box.className = 'explain' + (isRight ? '' : ' is-ng');

        const head = document.createElement('div');
        head.className = 'explain-head';
        head.innerHTML =
          '<span class="badge ' + (isRight ? 'ok' : 'ng') + '">' +
          (isRight ? '正解' : '不正解') +
          '</span><span>正解は ' + (item.a + 1) + '　' + escapeHtml(item.c[item.a]) + '</span>';
        box.appendChild(head);

        if (item.j) {
          const pj = document.createElement('p');
          pj.className = 'explain-en';
          pj.textContent = item.j;
          box.appendChild(pj);
        }

        const pe = document.createElement('p');
        pe.style.margin = '0';
        pe.textContent = item.e || '';
        box.appendChild(pe);

        const qBody = q.querySelector('.q-body');
        if (qBody) qBody.appendChild(box);
      });

      const total = questions.length;
      const pct = total ? Math.round((correct / total) * 100) : 0;
      const pass = pct >= 60;

      const scoreVal = document.getElementById('score-val');
      if (scoreVal) scoreVal.textContent = String(correct);

      const den = document.querySelector('.score-den');
      if (den) den.textContent = '/ ' + total;

      const ring = document.getElementById('score-ring');
      if (ring) ring.style.setProperty('--pct', String(pct));

      const verdict = document.getElementById('verdict');
      if (verdict) {
        verdict.textContent = pass
          ? '合格圏内です（正答率 ' + pct + '%）'
          : 'あと少しです（正答率 ' + pct + '%）';
        verdict.className = 'result-verdict ' + (pass ? 'pass' : 'fail');
      }

      const note = document.getElementById('result-note');
      if (note) {
        note.textContent =
          '正答率 ' + pct + '%　／　5級の一次試験は各技能でおおむね6割前後が合格の目安とされています。' +
          '間違えた問題は解説を読み、音声も聞き直してみましょう。';
      }

      const secBox = document.getElementById('sec-scores');
      if (secBox) {
        secBox.innerHTML = '';
        Object.keys(perSection).forEach(function (name) {
          const s = perSection[name];
          const p = s.total ? Math.round((s.right / s.total) * 100) : 0;
          const card = document.createElement('div');
          card.className = 'sec-score';
          card.innerHTML =
            '<h3>' + escapeHtml(name) + '</h3>' +
            '<div class="sec-score-val">' + s.right +
            '<span> / ' + s.total + '（' + p + '%）</span></div>' +
            '<div class="mini-track"><div class="mini-fill" style="width:' + p + '%"></div></div>';
          secBox.appendChild(card);
        });
      }

      const tbody = document.getElementById('review-body');
      if (tbody) {
        tbody.innerHTML = '';
        rows
          .slice()
          .sort(function (a, b) {
            return a.no - b.no;
          })
          .forEach(function (r) {
          const tr = document.createElement('tr');
          const yourAnswer = r.picked < 0
            ? '未解答'
            : (r.picked + 1) + '. ' + escapeHtml(r.item.c[r.picked]);
          tr.innerHTML =
            '<td class="num">(' + r.no + ')</td>' +
            '<td>' + escapeHtml(r.sec) + '</td>' +
            '<td class="en">' + yourAnswer + '</td>' +
            '<td class="en">' + (r.answer + 1) + '. ' + escapeHtml(r.item.c[r.answer]) + '</td>' +
            '<td class="' + (r.right ? 'ok' : 'ng') + '">' + (r.right ? '○' : '×') + '</td>';
          tbody.appendChild(tr);
        });
      }

      if (resultCard) {
        resultCard.hidden = false;
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      toast('採点しました。解説を確認しましょう。');
    });
  }

  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.location.reload();
    });
  }
})();
