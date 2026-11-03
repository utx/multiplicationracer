import { h, $, $$, hudRoot, ordinal, ordSuffix, fmtTime, esc, scratchPad, uiRoot } from './dom.js';
import { CRUISE } from '../game/race.js';
import { SKILL_INFO } from '../math/questions.js';
import { sfx } from '../game/audio.js';

const LANE_COLORS = ['#19c3ff', '#ff3ea5', '#ffc400'];
const KEYS = ['← / 1', '2', '→ / 3'];

// In-race heads-up display, pit-stop puzzle and pause menu.
export class Hud {
  constructor(race, app) {
    this.race = race;
    this.app = app;
    this.root = hudRoot();
    this.root.classList.remove('hidden');
    this.root.innerHTML = '';
    this.root.appendChild(h(`
      <div>
        <div class="hud-tl">
          <div class="panel hud-box"><div class="hud-label">Position</div><div class="hud-pos" id="h-pos">6<sup>th</sup><small>/6</small></div></div>
          <div class="panel hud-box"><div class="hud-label">Lap</div><div class="hud-val" id="h-lap">1/${race.city.laps}</div><div class="hud-label" style="margin-top:6px">Time</div><div class="hud-val" id="h-time">0:00.0</div></div>
        </div>
        <div class="hud-tr">
          <canvas id="h-map" class="panel" width="380" height="380"></canvas>
          <div class="panel hud-box"><span class="coins" id="h-coins">0</span></div>
        </div>
        <button class="btn small pause-btn" id="h-pause">❚❚ Pause</button>
        <div class="panel hud-q hidden" id="h-q"><div class="qskill" id="h-skill"></div><div class="qtext" id="h-qtext"></div><div class="qbar"><i id="h-qbar"></i></div></div>
        <div class="combo hidden" id="h-combo"></div>
        <div class="answers hidden" id="h-ans">
          ${[0, 1, 2].map((i) => `<div class="ans" data-lane="${i}" style="--c:${LANE_COLORS[i]}"><span class="k">${KEYS[i]}</span><span class="v">–</span></div>`).join('')}
        </div>
        <div class="panel speedo"><div class="hud-label">Speed</div><div class="v" id="h-speed">0<small> km/h</small></div><div class="boostbar"><i id="h-boost"></i></div></div>
        <div class="panel keys">Steer into the right answer!<br><kbd>←</kbd> <kbd>→</kbd> change lane · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> pick lane<br><kbd>↓</kbd> brake for thinking time · <kbd>Esc</kbd> pause</div>
        <div class="touch"><button id="t-left">◀</button><button id="t-right">▶</button></div>
        <div id="h-toasts"></div>
      </div>`));
    this.el = {
      pos: $('#h-pos'), lap: $('#h-lap'), time: $('#h-time'), map: $('#h-map'), coins: $('#h-coins'),
      q: $('#h-q'), qtext: $('#h-qtext'), qbar: $('#h-qbar'), skill: $('#h-skill'), combo: $('#h-combo'),
      ans: $$('.ans'), ansWrap: $('#h-ans'), speed: $('#h-speed'), boost: $('#h-boost'), toasts: $('#h-toasts'),
    };
    this.el.ans.forEach((a) => a.addEventListener('pointerdown', () => race.setLane(+a.dataset.lane)));
    $('#t-left').addEventListener('pointerdown', () => race.steer(-1));
    $('#t-right').addEventListener('pointerdown', () => race.steer(1));
    $('#h-pause').addEventListener('click', () => this.pause());
    this.mapCtx = this.el.map.getContext('2d');
    this.frame = 0;

    race.on('question', (g) => this.onQuestion(g));
    race.on('approach', (f) => { this.el.qbar.style.transform = `scaleX(${f})`; });
    race.on('gateResult', (r) => this.onGate(r));
    race.on('tick', () => this.onTick());
    race.on('count', (n) => this.toast(n > 0 ? String(n) : 'GO!', n > 0 ? 'big' : 'go', 900));
    race.on('lap', (l) => this.toast(l === race.city.laps ? 'FINAL LAP!' : `LAP ${l}`, 'info'));
    race.on('finalSprint', () => { this.el.q.classList.add('hidden'); this.el.ansWrap.classList.add('hidden'); });
    race.on('pit', (d) => this.openPit(d));
    race.on('crossLine', (p) => { this.el.q.classList.add('hidden'); this.el.ansWrap.classList.add('hidden'); this.toast(`FINISHED ${ordinal(p).toUpperCase()}!`, p <= 3 ? 'good' : 'info', 2600); });

    this.onKeyDown = (e) => this.keyDown(e);
    this.onKeyUp = (e) => { if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') race.input.brake = false; };
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
  }

  keyDown(e) {
    if (this.pit) return this.pit.key(e);
    if (this.paused) { if (e.key === 'Escape' || e.key === 'p') this.resume(); return; }
    const r = this.race;
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': r.steer(-1); break;
      case 'ArrowRight': case 'd': case 'D': r.steer(1); break;
      case '1': case '2': case '3': r.setLane(+e.key - 1); break;
      case 'ArrowDown': case 's': case 'S': r.input.brake = true; break;
      case 'Escape': case 'p': case 'P': this.pause(); break;
      default: return;
    }
    e.preventDefault();
  }

  onQuestion(g) {
    const q = g.q;
    this.el.q.classList.remove('hidden', 'pop');
    void this.el.q.offsetWidth;
    this.el.q.classList.add('pop');
    this.el.ansWrap.classList.remove('hidden');
    this.el.skill.textContent = SKILL_INFO[q.skill]?.name || '';
    this.el.qtext.textContent = q.text.includes('=') ? q.text : `${q.text} = ?`;
    g.choices.forEach((v, i) => { this.el.ans[i].querySelector('.v').textContent = v.toLocaleString('en-AU'); });
  }

  onGate(r) {
    if (r.correct) {
      const words = ['TURBO!', 'NICE!', 'BOOM!', 'ZOOM!', 'AWESOME!', 'BRILLIANT!', 'GENIUS!', 'UNSTOPPABLE!'];
      this.toast(words[Math.min(r.combo - 1, words.length - 1)], 'good', 1100, `+${5 + Math.min(r.combo, 10)} coins`);
      this.flash('good');
      document.getElementById('fx-speed').classList.add('on');
      clearTimeout(this.speedT);
      this.speedT = setTimeout(() => document.getElementById('fx-speed').classList.remove('on'), 2200);
    } else {
      this.toast('Oops!', 'bad', 2200, r.q.explain);
      this.flash('bad');
    }
    this.el.combo.classList.toggle('hidden', r.combo < 2);
    this.el.combo.textContent = `🔥 ${r.combo} in a row!`;
    this.el.coins.textContent = r.coins;
    sfx.coin();
  }

  onTick() {
    const r = this.race, p = r.player;
    this.frame++;
    const order = r.positions();
    const pos = r.finalPosition || order.indexOf(p) + 1;
    this.el.pos.innerHTML = `${pos}<sup>${ordSuffix(pos)}</sup><small>/${order.length}</small>`;
    this.el.lap.textContent = `${r.lap || 1}/${r.city.laps}`;
    this.el.time.textContent = fmtTime(r.clock);
    this.el.speed.innerHTML = `${Math.round(p.speed * 3.6)}<small> km/h</small>`;
    this.el.boost.style.width = `${Math.min(100, (p.boostT / 3.5) * 100)}%`;
    const lane = Math.max(0, Math.min(2, p.lane));
    this.el.ans.forEach((a, i) => a.classList.toggle('cur', i === lane));
    if (this.frame % 2 === 0) this.drawMap();
  }

  drawMap() {
    const g = this.mapCtx, m = this.race.minimap();
    const W = this.el.map.width;
    if (!this.mapScale) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < m.S; i++) { const x = m.pts[i * 3], z = m.pts[i * 3 + 2]; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
      const s = (W - 60) / Math.max(maxX - minX, maxZ - minZ);
      this.mapScale = { s, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
    }
    const { s, cx, cz } = this.mapScale;
    const X = (x) => W / 2 + (x - cx) * s, Y = (z) => W / 2 + (z - cz) * s;
    g.clearRect(0, 0, W, W);
    g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i <= m.S; i += 4) { const k = i % m.S; i === 0 ? g.moveTo(X(m.pts[k * 3]), Y(m.pts[k * 3 + 2])) : g.lineTo(X(m.pts[k * 3]), Y(m.pts[k * 3 + 2])); }
    g.closePath();
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 16; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 4; g.stroke();
    // start line
    g.fillStyle = '#ffc400';
    g.fillRect(X(m.pts[0]) - 6, Y(m.pts[2]) - 6, 12, 12);
    for (const c of m.cars.sort((a, b) => a.me - b.me)) {
      g.beginPath();
      g.arc(X(c.x), Y(c.z), c.me ? 11 : 8, 0, Math.PI * 2);
      g.fillStyle = c.color; g.fill();
      if (c.me) { g.lineWidth = 4; g.strokeStyle = '#19c3ff'; g.stroke(); }
    }
  }

  toast(text, cls = 'good', ms = 1300, sub = '') {
    const t = h(`<div class="toast ${cls}">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`);
    t.style.animationDuration = `${ms}ms`;
    this.el.toasts.innerHTML = '';
    this.el.toasts.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  flash(kind) {
    const f = document.getElementById('fx-flash');
    f.className = '';
    void f.offsetWidth;
    f.className = kind === 'good' ? 'go good' : 'go';
  }

  // ---------------------------------------------------------------- pause

  pause() {
    if (this.paused || this.pit || this.race.phase === 'finished') return;
    this.paused = true;
    this.race.paused = true;
    const o = h(`<div class="overlay" id="pause"><div class="panel modal" style="width:min(420px,92vw);text-align:center">
      <h2 style="font-size:40px;margin-bottom:18px">Paused</h2>
      <div class="menu" style="margin:0 auto;align-items:stretch">
        <button class="btn primary" data-a="resume">▶ Resume</button>
        <button class="btn" data-a="restart">↻ Restart race</button>
        <button class="btn" data-a="quit">🌍 Quit to world map</button>
      </div></div></div>`);
    o.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'resume') this.resume();
      if (a === 'restart') { this.destroy(); this.app.startRace(this.app.currentCity); }
      if (a === 'quit') { this.destroy(); this.app.goMap(); }
    });
    uiRoot().appendChild(o);
  }

  resume() {
    this.paused = false;
    this.race.paused = false;
    $('#pause')?.remove();
  }

  // ---------------------------------------------------------------- pit stop

  openPit({ problem, par }) {
    this.el.q.classList.add('hidden');
    this.el.ansWrap.classList.add('hidden');
    const start = performance.now();
    let input = '', wrong = 0, done = false, elapsed = 0;
    const o = h(`<div class="overlay"><div class="panel modal">
      <div class="pit-head"><h2>🔧 PIT STOP!</h2><span class="pit-badge">Multi-step challenge</span></div>
      <div class="pit">
        <div>
          <div class="pit-title">${esc(problem.title)}</div>
          <div class="pit-text">${esc(problem.text)}</div>
          <div id="p-help"></div>
          <div class="scratch"><span class="lbl">Working out</span><canvas id="p-scratch"></canvas><button id="p-clear">Clear</button></div>
        </div>
        <div>
          <div class="pit-timer"><span class="you">⏱ <span id="p-time">0.0</span>s</span><span class="par">Rival crews: ${par}s</span></div>
          <div class="display" id="p-display"><span id="p-val"></span><span class="unit">${esc(problem.unit || '')}</span></div>
          <div class="keypad" id="p-keys">
            ${[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
            <button class="del" data-k="del">⌫</button><button data-k="0">0</button><button class="ok" data-k="ok">✓</button>
          </div>
          <div id="p-after"></div>
        </div>
      </div></div></div>`);
    uiRoot().appendChild(o);
    const pad = scratchPad($('#p-scratch', o));
    $('#p-clear', o).addEventListener('click', () => pad.clear());
    const val = $('#p-val', o), disp = $('#p-display', o), help = $('#p-help', o), after = $('#p-after', o), timeEl = $('#p-time', o);
    const timer = setInterval(() => { if (!done) { elapsed = (performance.now() - start) / 1000; timeEl.textContent = elapsed.toFixed(1); } }, 100);

    const finish = (solved) => {
      done = true;
      clearInterval(timer);
      $('#p-keys', o).style.display = 'none';
      help.innerHTML = `<div class="pit-steps ${solved ? '' : 'bad'}">${solved ? '✅ Correct! ' : '❌ Answer: ' + problem.answer.toLocaleString('en-AU') + '<br>'}${problem.steps.map(esc).join('<br>')}</div>`;
      after.innerHTML = `<button class="btn primary" style="width:100%;margin-top:14px" id="p-go">Back to the race! ▶</button>`;
      const go = () => {
        if (!this.pit) return;
        this.pit = null;
        const res = this.race.finishPit({ time: elapsed, wrong, solved });
        o.remove();
        const g = res.gained;
        this.toast(g >= 0 ? `+${g.toFixed(1)}s on rivals!` : `${g.toFixed(1)}s`, g >= 0 ? 'good' : 'bad', 2200, solved && wrong === 0 ? 'Perfect pit stop — super boost!' : 'Back on track!');
      };
      $('#p-go', o).addEventListener('click', go);
      this.pit.go = go;
    };

    const submit = () => {
      if (done || !input) return;
      if (+input === problem.answer) { sfx.correct(3); finish(true); return; }
      wrong++;
      sfx.wrong();
      disp.classList.remove('shake'); void disp.offsetWidth; disp.classList.add('shake');
      input = ''; val.textContent = '';
      if (wrong === 1) help.innerHTML = `<div class="pit-hint">💡 Hint: ${esc(problem.hint)}</div>`;
      else if (wrong === 2) help.innerHTML = `<div class="pit-hint">💡 Hint: ${esc(problem.hint)}<br>First step: ${esc(problem.steps[0])}</div>`;
      else finish(false);
    };
    const press = (k) => {
      if (done) return;
      sfx.key();
      if (k === 'del') input = input.slice(0, -1);
      else if (k === 'ok') return submit();
      else if (input.length < 7) input += k;
      val.textContent = input ? Number(input).toLocaleString('en-AU') : '';
    };
    $('#p-keys', o).addEventListener('click', (e) => { const k = e.target.closest('[data-k]')?.dataset.k; if (k) press(k); });
    this.pit = {
      key: (e) => {
        if (done) { if (e.key === 'Enter' || e.key === ' ') this.pit?.go?.(); return; }
        if (/^[0-9]$/.test(e.key)) press(e.key);
        else if (e.key === 'Backspace') press('del');
        else if (e.key === 'Enter') press('ok');
        else return;
        e.preventDefault();
      },
    };
  }

  destroy() {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    this.root.innerHTML = '';
    this.root.classList.add('hidden');
    document.getElementById('fx-speed').classList.remove('on');
    uiRoot().innerHTML = '';
  }
}

export { CRUISE };
