import { h, $, $$, show, esc, ordinal, fmtTime } from './dom.js';
import { CITIES, CARS, PAINTS } from '../data/cities.js';
import { progress, save, reset, trickyFacts, mathCtx, recordAnswer } from '../math/progress.js';
import { SKILL_INFO, generateSkill, generate, ALL_SKILLS } from '../math/questions.js';
import { generatePitStop } from '../math/pitstops.js';
import { sfx, unlockAudio, setAudio } from '../game/audio.js';

const starStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

// ---------------------------------------------------------------- title

export function titleScreen(app) {
  const s = progress();
  if (!s.name) return nameScreen(app);
  const node = h(`<div class="title-screen">
    <div class="logo"><div class="l1">MULTIPLICATION<br><em>RACER</em></div><div class="l2">WORLD TOUR</div></div>
    <div class="welcome">Driver: <b>${esc(s.name)}</b> <span class="coins">${s.coins}</span> <span>🏆 ${Object.values(s.stars).reduce((a, b) => a + b, 0)}/${CITIES.length * 3}</span></div>
    <div class="menu">
      <button class="btn primary" data-a="tour">🌍 World Tour</button>
      <button class="btn" data-a="garage">🏎️ Garage</button>
      <button class="btn" data-a="train">🧠 Pit Crew Training</button>
      <button class="btn" data-a="settings">⚙️ Settings</button>
    </div></div>`);
  node.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    unlockAudio(); sfx.click();
    if (a === 'tour') app.goMap();
    if (a === 'garage') app.goGarage();
    if (a === 'train') app.goTraining();
    if (a === 'settings') app.goSettings();
  });
  return node;
}

function nameScreen(app) {
  const node = h(`<div class="title-screen">
    <div class="logo"><div class="l1">MULTIPLICATION<br><em>RACER</em></div><div class="l2">WORLD TOUR</div></div>
    <div class="panel name-box">
      <h3 style="font-size:24px">What's your racing name?</h3>
      <input id="nm" maxlength="16" placeholder="e.g. Speedy Sam" autocomplete="off" />
      <button class="btn primary" style="width:100%" id="go">Let's race! 🏁</button>
    </div></div>`);
  const go = () => {
    const v = $('#nm', node).value.trim();
    if (!v) { $('#nm', node).focus(); return; }
    unlockAudio(); sfx.click();
    progress().name = v;
    save();
    app.goTitle();
  };
  $('#go', node).addEventListener('click', go);
  $('#nm', node).addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  setTimeout(() => $('#nm', node)?.focus(), 50);
  return node;
}

// ---------------------------------------------------------------- world map

export function mapScreen(app, globe) {
  const s = progress();
  let sel = globe.selected ?? Math.min(s.unlocked - 1, CITIES.length - 1);
  const node = h(`<div class="map-screen"><div class="panel map-side">
    <div class="map-head"><button class="btn small" data-a="back">← Menu</button><h2 style="font-size:24px">World Tour</h2><span class="coins">${s.coins}</span></div>
    <div class="city-list">${CITIES.map((c, i) => `
      <div class="city ${i >= s.unlocked ? 'locked' : ''}" data-i="${i}">
        <span class="num">${i + 1}</span><span class="flag">${c.flag}</span>
        <div><div class="nm">${esc(c.name)}</div><div class="tg">${esc(c.tagline)}</div></div>
        <span class="st">${i >= s.unlocked ? '🔒' : `<span style="color:var(--yellow)">${starStr(s.stars[c.id] || 0)}</span>`}</span>
      </div>`).join('')}</div>
    <div class="city-detail" id="detail"></div>
  </div></div>`);
  const detail = $('#detail', node);
  const render = () => {
    const c = CITIES[sel];
    const locked = sel >= s.unlocked;
    $$('.city', node).forEach((el) => el.classList.toggle('sel', +el.dataset.i === sel));
    detail.innerHTML = `
      <h2>${c.flag} ${esc(c.name)}</h2>
      <div class="muted">${esc(c.country)} · ${c.laps} laps · ${esc(c.tagline)}</div>
      <div class="skills">🧮 ${esc(c.skills)}<br>🔧 Pit stop: multi-step problem solving</div>
      ${s.best[c.id] ? `<div class="muted" style="margin-bottom:10px">Best finish: ${ordinal(s.best[c.id])}</div>` : ''}
      ${locked ? `<div class="muted">🔒 Finish in the top 3 in ${esc(CITIES[sel - 1]?.name || '')} to unlock.</div>`
        : `<button class="btn primary" style="width:100%" data-a="race">Race in ${esc(c.name)}! 🏁</button>`}`;
    globe.focus(sel);
  };
  node.addEventListener('click', (e) => {
    const city = e.target.closest('.city');
    if (city) { sel = +city.dataset.i; sfx.click(); render(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'back') { sfx.click(); app.goTitle(); }
    if (a === 'race') { sfx.click(); app.startRace(sel); }
  });
  render();
  return node;
}

// ---------------------------------------------------------------- garage

export function garageScreen(app, garage) {
  const s = progress();
  const node = h(`<div class="garage-screen"><div class="panel">
    <div class="map-head"><button class="btn small" data-a="back">← Menu</button><h2 style="font-size:26px">Garage</h2><span class="coins" id="g-coins">${s.coins}</span></div>
    <div><div class="hud-label" style="margin-bottom:8px">Cars</div><div class="car-grid" id="cars"></div></div>
    <div><div class="hud-label" style="margin-bottom:8px">Paint shop (free!)</div><div class="paints" id="paints"></div></div>
    <div class="muted" style="font-size:14px">💡 Earn coins by answering correctly, winning races and nailing pit stops. Better cars get a stronger turbo boost.</div>
  </div></div>`);
  const render = () => {
    $('#g-coins', node).textContent = s.coins;
    $('#cars', node).innerHTML = CARS.map((c) => {
      const owned = s.owned.includes(c.id);
      return `<div class="car-card ${s.car === c.id ? 'sel' : ''}" data-car="${c.id}">
        <div class="nm">${esc(c.name)}</div><div class="ds">${esc(c.desc)}</div>
        <div class="hud-label">Turbo</div><div class="stat-bar"><i style="width:${(c.boost - 0.9) * 500}%"></i></div>
        <div style="margin-top:10px">${owned ? (s.car === c.id ? '<span class="chip">Driving</span>' : '<span class="chip">Owned</span>')
          : `<button class="btn small ${s.coins >= c.cost ? 'primary' : ''}" data-buy="${c.id}" ${s.coins >= c.cost ? '' : 'disabled'}>Buy · ${c.cost}</button>`}</div>
      </div>`;
    }).join('');
    $('#paints', node).innerHTML = PAINTS.map((p) => `<div class="swatch ${s.paint === p.color ? 'sel' : ''}" title="${esc(p.name)}" data-paint="${p.color}" style="background:#${p.color.toString(16).padStart(6, '0')}"></div>`).join('');
    garage.setCar(s.car, s.paint);
  };
  node.addEventListener('click', (e) => {
    const buy = e.target.closest('[data-buy]')?.dataset.buy;
    if (buy) {
      const c = CARS.find((x) => x.id === buy);
      if (s.coins >= c.cost) { s.coins -= c.cost; s.owned.push(c.id); s.car = c.id; save(); sfx.finish(1); render(); }
      return;
    }
    const car = e.target.closest('[data-car]')?.dataset.car;
    if (car) {
      if (s.owned.includes(car)) { s.car = car; save(); sfx.click(); render(); }
      else garage.setCar(car, s.paint); // preview
      return;
    }
    const paint = e.target.closest('[data-paint]')?.dataset.paint;
    if (paint) { s.paint = +paint; save(); sfx.click(); render(); return; }
    if (e.target.closest('[data-a="back"]')) { sfx.click(); app.goTitle(); }
  });
  render();
  return node;
}

// ---------------------------------------------------------------- settings

export function settingsScreen(app) {
  const s = progress();
  const node = h(`<div class="overlay"><div class="panel modal" style="width:min(560px,94vw)">
    <div class="map-head" style="margin-bottom:10px"><button class="btn small" data-a="back">← Back</button><h2 style="font-size:28px">Settings</h2><span></span></div>
    <div class="settings-row"><div><b>Thinking time</b><div class="muted" style="font-size:13px">How far apart the answer gates are</div></div>
      <div class="seg" data-set="thinking">${['relaxed', 'normal', 'pro'].map((v) => `<button data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>
    <div class="settings-row"><div><b>Graphics</b><div class="muted" style="font-size:13px">Use Low on older computers</div></div>
      <div class="seg" data-set="quality">${['high', 'low'].map((v) => `<button data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>
    <div class="settings-row"><b>Sound effects</b><div class="seg" data-set="sound"><button data-v="true">On</button><button data-v="false">Off</button></div></div>
    <div class="settings-row"><b>Music</b><div class="seg" data-set="music"><button data-v="true">On</button><button data-v="false">Off</button></div></div>
    <div class="settings-row"><div><b>Reset progress</b><div class="muted" style="font-size:13px">Start the tour again from scratch</div></div><button class="btn small pink" data-a="reset">Reset</button></div>
  </div></div>`);
  const render = () => $$('.seg', node).forEach((seg) => {
    const k = seg.dataset.set;
    $$('button', seg).forEach((b) => b.classList.toggle('on', String(s.settings[k]) === b.dataset.v));
  });
  node.addEventListener('click', (e) => {
    const seg = e.target.closest('.seg');
    const b = e.target.closest('button');
    if (seg && b) {
      const k = seg.dataset.set;
      let v = b.dataset.v;
      if (v === 'true' || v === 'false') v = v === 'true';
      s.settings[k] = v;
      save();
      app.applySettings();
      sfx.click();
      render();
      return;
    }
    const a = b?.dataset.a;
    if (a === 'back') { sfx.click(); app.goTitle(); }
    if (a === 'reset' && confirm('Really reset all progress, coins and cars?')) { reset(); app.applySettings(); app.goTitle(); }
  });
  render();
  return node;
}

// ---------------------------------------------------------------- results

export function resultsScreen(app, res, cityIndex, outcome) {
  const city = CITIES[cityIndex];
  const next = CITIES[cityIndex + 1];
  const pct = Math.round(res.accuracy * 100);
  const node = h(`<div class="overlay"><div class="panel modal results">
    <div class="muted" style="font-family:var(--display);letter-spacing:3px">${city.flag} ${esc(city.name.toUpperCase())} · RESULTS</div>
    <div class="place p${res.position}">${ordinal(res.position).toUpperCase()}</div>
    <div class="stars">${[0, 1, 2].map((i) => `<span class="${i < res.stars ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.25}s">⭐</span>`).join('')}</div>
    ${outcome.unlocked ? `<div class="chip" style="font-size:16px;padding:6px 14px">🔓 ${esc(next.name)} unlocked!</div>` : ''}
    ${outcome.tourComplete ? `<div class="chip" style="font-size:16px;padding:6px 14px;background:rgba(255,196,0,.2);color:var(--yellow)">🏆 WORLD CHAMPION! You conquered the World Tour!</div>` : ''}
    ${res.position > 3 && !outcome.alreadyUnlocked ? `<div class="muted" style="margin-top:6px">Finish in the top 3 to unlock the next city!</div>` : ''}
    <div class="stat-row">
      <div class="stat"><span class="muted">Accuracy</span><b>${pct}%</b><span class="muted">${res.correct}/${res.total} gates</span></div>
      <div class="stat"><span class="muted">Best streak</span><b>🔥 ${res.bestCombo}</b></div>
      <div class="stat"><span class="muted">Race time</span><b>${fmtTime(res.time)}</b></div>
      <div class="stat"><span class="muted">Coins earned</span><b class="coins">${res.coins}</b><span class="muted">incl. ${res.posBonus} place bonus</span></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;text-align:left" class="res-grid">
      <div><div class="hud-label">Final standings</div><div class="standings">${res.standings.map((c, i) => `<div class="${c.isPlayer ? 'me' : ''}">${i + 1}. ${esc(c.name)}</div>`).join('')}</div></div>
      <div><div class="hud-label">${res.misses.length ? 'Ones to practise' : 'Perfect run!'}</div><div class="misses">${res.misses.length
        ? res.misses.slice(0, 6).map((q) => `<div class="miss"><b>${esc(q.text)}</b> → ${esc(q.explain)}</div>`).join('')
        : '<div class="miss" style="background:rgba(77,255,136,.1)">🎯 Every single gate correct. Legendary!</div>'}</div></div>
    </div>
    <div class="btn-row">
      ${next && (outcome.unlocked || outcome.alreadyUnlocked) ? `<button class="btn primary" data-a="next">Next: ${next.flag} ${esc(next.name)} ▶</button>` : ''}
      <button class="btn ${res.position > 3 ? 'primary' : ''}" data-a="again">↻ Race again</button>
      <button class="btn" data-a="map">🌍 World map</button>
    </div>
  </div></div>`);
  node.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    sfx.click();
    if (a === 'next') app.startRace(cityIndex + 1);
    if (a === 'again') app.startRace(cityIndex);
    if (a === 'map') app.goMap();
  });
  return node;
}

// ---------------------------------------------------------------- training

export function trainingScreen(app) {
  const s = progress();
  const acc = (k) => { const x = s.skills[k]; return x && x.r + x.w ? `${Math.round((x.r / (x.r + x.w)) * 100)}% correct · ${x.r + x.w} answered` : 'Not tried yet'; };
  const tricky = trickyFacts(12);
  const tiles = [
    ...ALL_SKILLS.map((k) => ({ id: k, name: SKILL_INFO[k].name, ds: SKILL_INFO[k].blurb, acc: acc(k) })),
    { id: 'tricky', name: '🎯 My tricky facts', ds: tricky.length ? tricky.slice(0, 5).join(', ') : 'Race first — mistakes show up here', acc: '' },
    { id: 'pit', name: '🔧 Pit-stop puzzles', ds: 'Multi-step word problems', acc: s.pit.r + s.pit.w ? `${s.pit.r}/${s.pit.r + s.pit.w} perfect` : 'Not tried yet' },
  ];
  const node = h(`<div class="overlay"><div class="panel modal">
    <div class="map-head"><button class="btn small" data-a="back">← Menu</button><h2 style="font-size:28px">Pit Crew Training</h2><span class="coins">${s.coins}</span></div>
    <p class="muted">60-second sprints. Type the answer and press Enter. Earn 2 coins for every correct answer!</p>
    <div class="train-grid">${tiles.map((t) => `<div class="train-tile" data-k="${t.id}"><div class="nm">${esc(t.name)}</div><div class="ds">${esc(t.ds)}</div><div class="acc">${esc(t.acc)}</div></div>`).join('')}</div>
  </div></div>`);
  node.addEventListener('click', (e) => {
    if (e.target.closest('[data-a="back"]')) { sfx.click(); app.goTitle(); return; }
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (!k) return;
    sfx.click();
    if (k === 'tricky' && !tricky.length) return;
    show(k === 'pit' ? pitTraining(app) : sprint(app, k, tricky));
  });
  return node;
}

function sprint(app, skill, tricky) {
  const s = progress();
  let q, input = '', correct = 0, total = 0, left = 60, over = false;
  const misses = [];
  const node = h(`<div class="overlay"><div class="panel modal sprint" style="width:min(640px,94vw)">
    <div class="top"><span>⏱ <span id="t">60</span>s</span><span>${esc(skill === 'tricky' ? 'Tricky facts' : SKILL_INFO[skill].name)}</span><span>✅ <span id="c">0</span></span></div>
    <div class="q" id="q"></div>
    <div class="display" id="d" style="text-align:center"></div>
    <div class="keypad">${[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button class="del" data-k="del">⌫</button><button data-k="0">0</button><button class="ok" data-k="ok">✓</button></div>
    <div id="msg" style="min-height:28px;margin-top:10px;font-weight:800"></div>
  </div></div>`);
  const qEl = $('#q', node), d = $('#d', node), msg = $('#msg', node);
  const nextQ = () => {
    if (skill === 'tricky') {
      const [a, b] = tricky[Math.floor(Math.random() * tricky.length)].split('×').map(Number);
      q = Math.random() < 0.5 ? { text: `${a} × ${b}`, answer: a * b, fact: `${a}×${b}`, skill: 'tables', explain: `${a} × ${b} = ${a * b}` } : { text: `${b} × ${a}`, answer: a * b, fact: `${a}×${b}`, skill: 'tables', explain: `${b} × ${a} = ${a * b}` };
    } else q = generateSkill(skill, { level: 2, max: 12 }, mathCtx);
    qEl.textContent = q.text.includes('=') ? q.text : `${q.text} = ?`;
    input = ''; d.textContent = '';
  };
  const answer = () => {
    if (!input || over) return;
    total++;
    const ok = +input === q.answer;
    recordAnswer(q, ok);
    if (ok) { correct++; sfx.correct(Math.min(correct, 8)); msg.innerHTML = '<span style="color:var(--green)">✔ Correct!</span>'; }
    else { sfx.wrong(); misses.push(q); msg.innerHTML = `<span style="color:#ff8080">✘ ${esc(q.explain)}</span>`; }
    $('#c', node).textContent = correct;
    nextQ();
  };
  const press = (k) => {
    if (over) return;
    if (k === 'del') input = input.slice(0, -1);
    else if (k === 'ok') return answer();
    else if (input.length < 7) input += k;
    d.textContent = input;
    if (input === String(q.answer)) answer(); // auto-accept when exactly right
  };
  const onKey = (e) => {
    if (!document.body.contains(node)) { removeEventListener('keydown', onKey); return; }
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') press('ok');
    else if (e.key === 'Escape') { over = true; clearInterval(timer); app.goTraining(); }
  };
  addEventListener('keydown', onKey);
  node.addEventListener('click', (e) => { const k = e.target.closest('[data-k]')?.dataset.k; if (k) press(k); });
  const timer = setInterval(() => {
    left--;
    const t = $('#t', node);
    if (t) t.textContent = left;
    if (left <= 0) {
      clearInterval(timer);
      over = true;
      const coins = correct * 2;
      s.coins += coins;
      s.trainingBest = s.trainingBest || {};
      const best = Math.max(s.trainingBest[skill] || 0, correct);
      const isBest = correct > (s.trainingBest[skill] || 0);
      s.trainingBest[skill] = best;
      save();
      sfx.finish(1);
      node.querySelector('.modal').innerHTML = `<h2 style="font-size:40px">Time's up!</h2>
        <div class="stat-row"><div class="stat"><span class="muted">Correct</span><b>${correct}/${total}</b></div><div class="stat"><span class="muted">Best</span><b>${best}${isBest ? ' 🎉' : ''}</b></div><div class="stat"><span class="muted">Coins</span><b class="coins">${coins}</b></div></div>
        <div class="misses">${misses.slice(0, 8).map((m) => `<div class="miss"><b>${esc(m.text)}</b> → ${esc(m.explain)}</div>`).join('')}</div>
        <div class="btn-row"><button class="btn primary" data-a="again">↻ Again</button><button class="btn" data-a="back">← Training</button></div>`;
      node.querySelector('.modal').addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'again') show(sprint(app, skill, tricky));
        if (a === 'back') app.goTraining();
      });
    }
  }, 1000);
  nextQ();
  return node;
}

function pitTraining(app) {
  const s = progress();
  let p, input = '', wrong = 0, solved = 0, count = 0;
  const node = h(`<div class="overlay"><div class="panel modal" style="width:min(760px,94vw)">
    <div class="map-head"><button class="btn small" data-a="back">← Training</button><h2 style="font-size:24px">Pit-stop puzzles</h2><span>✅ <span id="sv">0</span></span></div>
    <div class="pit" style="margin-top:14px"><div><div class="pit-title" id="pt"></div><div class="pit-text" id="px"></div><div id="ph"></div></div>
    <div><div class="display" id="pd"></div><div class="keypad">${[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button class="del" data-k="del">⌫</button><button data-k="0">0</button><button class="ok" data-k="ok">✓</button></div><div id="pn"></div></div></div>
  </div></div>`);
  const level = Math.min(7, Math.max(2, s.unlocked));
  const nextP = () => {
    p = generatePitStop(level); input = ''; wrong = 0; count++;
    $('#pt', node).textContent = p.title; $('#px', node).textContent = p.text;
    $('#ph', node).innerHTML = ''; $('#pd', node).textContent = ''; $('#pn', node).innerHTML = '';
  };
  const reveal = (ok) => {
    $('#ph', node).innerHTML = `<div class="pit-steps ${ok ? '' : 'bad'}">${ok ? '✅ Correct!' : `Answer: ${p.answer}`}<br>${p.steps.map(esc).join('<br>')}</div>`;
    $('#pn', node).innerHTML = '<button class="btn primary" style="width:100%;margin-top:12px" data-a="next">Next puzzle ▶</button>';
  };
  const press = (k) => {
    if ($('#pn', node).innerHTML) { if (k === 'ok') nextP(); return; }
    if (k === 'del') input = input.slice(0, -1);
    else if (k === 'ok') {
      if (!input) return;
      if (+input === p.answer) { solved++; s.coins += 5; s.pit[wrong ? 'w' : 'r']++; save(); sfx.correct(4); $('#sv', node).textContent = solved; reveal(true); return; }
      wrong++; sfx.wrong(); input = '';
      if (wrong === 1) $('#ph', node).innerHTML = `<div class="pit-hint">💡 ${esc(p.hint)}</div>`;
      else { s.pit.w++; save(); reveal(false); }
    } else if (input.length < 7) input += k;
    $('#pd', node).textContent = input;
  };
  const onKey = (e) => {
    if (!document.body.contains(node)) { removeEventListener('keydown', onKey); return; }
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') press('ok');
  };
  addEventListener('keydown', onKey);
  node.addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (k) return press(k);
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'next') nextP();
    if (a === 'back') app.goTraining();
  });
  nextP();
  return node;
}
