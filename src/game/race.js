import * as THREE from 'three';
import { Track, LANE_W, ROAD_HALF, BARRIER } from './track.js';
import { buildScenery } from './scenery.js';
import { buildCar } from './car.js';
import { makeSky, bakeEnvironment, sunDirection, canvasTexture } from './renderer.js';
import { generate, makeChoices } from '../math/questions.js';
import { generatePitStop } from '../math/pitstops.js';
import { mathCtx, recordAnswer, progress } from '../math/progress.js';
import { RIVALS, CARS } from '../data/cities.js';
import { sfx } from './audio.js';

export const CRUISE = 52; // m/s at cruising speed (~187 km/h)
const THINK = { relaxed: 1.45, normal: 1.0, pro: 0.75 };
const LANE_COLORS = ['#19c3ff', '#ff3ea5', '#ffc400'];

class Emitter {
  constructor() { this.h = {}; }
  on(e, f) { (this.h[e] ||= []).push(f); return this; }
  emit(e, ...a) { (this.h[e] || []).forEach((f) => f(...a)); }
}

export class RaceStage extends Emitter {
  constructor(renderer, city, cityIndex) {
    super();
    this.r = renderer;
    this.city = city;
    this.cityIndex = cityIndex;
    this.theme = city.theme;
    const save = progress();
    this.settings = save.settings;
    this.carDef = CARS.find((c) => c.id === save.car) || CARS[0];
    this.think = THINK[this.settings.thinking] || 1;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 9000);
    this.bloom = this.theme.bloom;
    this.exposure = this.theme.exposure;
    this.bloomThreshold = this.theme.time === 'night' ? 0.7 : 0.85;

    this.buildWorld();
    this.buildCars(save);

    this.phase = 'intro';
    this.t = 0;
    this.clock = 0;
    this.finishDist = this.track.length * city.laps;
    this.pitLap = city.laps >= 3 ? 2 : 1;
    this.pitDone = false;
    this.answers = [];
    this.combo = 0;
    this.bestCombo = 0;
    this.coins = 0;
    this.gate = null;
    this.oldGates = [];
    this.particles = [];
    this.introT = 0;
    this.camShake = 0;
    this.input = { brake: false };
    this.nextFinish = 0;
  }

  // ------------------------------------------------------------------ world

  buildWorld() {
    const th = this.theme;
    const s = this.scene;
    s.fog = new THREE.FogExp2(th.fog, th.fogDensity);
    s.add(makeSky(th));
    s.environment = bakeEnvironment(this.r.renderer, th);
    s.environmentIntensity = th.time === 'night' ? 0.55 : 0.9;

    const night = th.time === 'night';
    const hemi = new THREE.HemisphereLight(th.skyHorizon, th.groundTint, night ? 0.45 : 0.6);
    s.add(hemi);
    this.sunDir = sunDirection(th);
    const sun = (this.sun = new THREE.DirectionalLight(th.sunColor, night ? 0.9 : th.time === 'overcast' ? 1.6 : 2.6));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 600;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    s.add(sun, sun.target);

    this.track = new Track(this.city);
    s.add(this.track.build());
    this.scenery = buildScenery(this.track, th, this.r.renderer);
    s.add(this.scenery);
    if (night || th.time === 'dusk') this.addStreetLights();
  }

  addStreetLights() {
    const step = 45;
    const n = Math.floor(this.track.length / step);
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.2, 9, 6).translate(0, 4.5, 0), new THREE.MeshStandardMaterial({ color: 0x333740, metalness: 0.6 }), n * 2);
    const lamp = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.3, 0.7), new THREE.MeshBasicMaterial({ color: 0xfff1c8 }), n * 2);
    const pool = new THREE.InstancedMesh(new THREE.CircleGeometry(6, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }), n * 2);
    const d = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i < n; i++) {
      const f = this.track.frameAt(i * step + 10);
      for (const side of [-1, 1]) {
        const off = side * (BARRIER + 1.2);
        d.position.set(f.pos.x + f.right.x * off, 0, f.pos.z + f.right.z * off);
        d.rotation.set(0, Math.atan2(f.right.x, f.right.z), 0);
        d.scale.setScalar(1);
        d.updateMatrix();
        pole.setMatrixAt(k, d.matrix);
        d.position.set(f.pos.x + f.right.x * (off - side * 1.2), 9, f.pos.z + f.right.z * (off - side * 1.2));
        d.updateMatrix();
        lamp.setMatrixAt(k, d.matrix);
        d.position.set(f.pos.x + f.right.x * side * (ROAD_HALF - 2), 0.09, f.pos.z + f.right.z * side * (ROAD_HALF - 2));
        d.updateMatrix();
        pool.setMatrixAt(k, d.matrix);
        k++;
      }
    }
    this.scene.add(pole, lamp, pool);
  }

  buildCars(save) {
    this.player = {
      car: buildCar(save.car, save.paint, { number: 1 }),
      dist: -22, speed: 0, lane: 1, laneX: 0, laneV: 0,
      boost: 0, boostT: 0, spinT: 0, name: save.name || 'You', isPlayer: true,
    };
    this.scene.add(this.player.car.group);

    if (this.theme.time === 'night' || this.theme.time === 'dusk') {
      const head = new THREE.SpotLight(0xfff4dd, 60, 90, 0.5, 0.5, 1.2);
      head.position.set(0, 1.2, 1.8);
      head.target.position.set(0, 0, 30);
      this.player.car.group.add(head, head.target);
    }

    // Grid: 2 rows of 3; player starts on the back row.
    const grid = [[0, -6], [1, -6], [2, -6], [0, -22], [2, -22]];
    this.rivals = RIVALS.map((rv, i) => {
      const [lane, dist] = grid[i];
      const car = buildCar(rv.body, rv.color, { number: i + 2, helmet: 0xffffff });
      this.scene.add(car.group);
      return {
        ...rv, car, dist, lane, laneX: (lane - 1) * LANE_W, laneV: 0, speed: 0,
        pace: this.city.rivalPace[i], phase: Math.random() * 6.28, laneTimer: 2 + Math.random() * 4,
      };
    });
    this.cars = [this.player, ...this.rivals];
    this.cars.forEach((c) => this.placeCar(c, 0));
  }

  placeCar(c, dt) {
    const f = this.track.frameAt(c.dist);
    const g = c.car.group;
    g.position.set(f.pos.x + f.right.x * c.laneX, 0, f.pos.z + f.right.z * c.laneX);
    let yaw = Math.atan2(f.tan.x, f.tan.z) - c.laneV * 0.012;
    if (c.spinT > 0) yaw += Math.sin(c.spinT * 14) * 0.25 * Math.min(1, c.spinT);
    g.rotation.y = yaw;
    c.car.update(dt, c.speed, -c.laneV * 0.08, c.boost, this.t);
  }

  // ------------------------------------------------------------------ gates

  spawnGate(fromDist) {
    const q = generate(this.city.mix, mathCtx);
    const choices = makeChoices(q, 3);
    const gap = Math.max(120, q.time * CRUISE * this.think);
    const dist = fromDist + gap;
    if (dist > this.finishDist - 60) { this.gate = null; this.emit('finalSprint'); return; }
    if (!this.pitDone && dist > this.pitLap * this.track.length - 40 && fromDist < this.pitLap * this.track.length) {
      this.gate = null; // next question comes after the pit stop
      return;
    }
    const mesh = this.buildGateMesh(q, choices);
    const f = this.track.frameAt(dist);
    mesh.position.copy(f.pos);
    mesh.rotation.y = Math.atan2(f.tan.x, f.tan.z);
    this.scene.add(mesh);
    this.gate = { q, choices, dist, mesh, correctLane: choices.indexOf(q.answer), spawnDist: fromDist };
    this.emit('question', this.gate);
  }

  buildGateMesh(q, choices) {
    const g = new THREE.Group();
    const col = this.theme.barrier;
    const frame = new THREE.MeshStandardMaterial({ color: 0x1b1e26, metalness: 0.6, roughness: 0.35 });
    const glow = new THREE.MeshBasicMaterial({ color: col });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 8, 0.9), frame);
      p.position.set(s * (ROAD_HALF + 0.8), 4, 0);
      p.castShadow = true;
      g.add(p);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 7.6, 0.95), glow);
      strip.position.set(s * (ROAD_HALF + 0.8), 4, 0);
      g.add(strip);
    }
    const qTex = canvasTexture(1024, 160, (c, w, h) => {
      c.fillStyle = '#0d1018'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#' + new THREE.Color(col).getHexString(); c.fillRect(0, 0, w, 10); c.fillRect(0, h - 10, w, 10);
      c.fillStyle = '#fff'; c.font = 'bold 96px Russo One, Arial Black, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(q.text.replace('?', '■'), w / 2, h / 2 + 6);
    });
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2 + 2.6, 2.2), new THREE.MeshBasicMaterial({ map: qTex, side: THREE.DoubleSide }));
    beam.position.set(0, 8.6, 0);
    beam.rotation.y = Math.PI;
    g.add(beam);

    g.userData.panels = choices.map((v, i) => {
      const tex = canvasTexture(256, 160, (c, w, h) => {
        c.fillStyle = LANE_COLORS[i]; c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(8, 8, w - 16, h - 16);
        c.fillStyle = '#fff'; c.font = `bold ${String(v).length > 4 ? 64 : 88}px Russo One, Arial Black, sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,0.5)';
        c.strokeText(v.toLocaleString('en-AU'), w / 2, h / 2 + 4);
        c.fillText(v.toLocaleString('en-AU'), w / 2, h / 2 + 4);
      });
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W - 0.5, 2.8), mat);
      // local +x is the driver's left, so lane 0 (left) sits at +x
      p.position.set(-(i - 1) * LANE_W, 6.0, 0);
      p.rotation.y = Math.PI;
      g.add(p);
      // matching coloured arrow on the road
      const arrow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5), new THREE.MeshBasicMaterial({ color: LANE_COLORS[i], transparent: true, opacity: 0.55, depthWrite: false }));
      arrow.rotation.x = -Math.PI / 2;
      arrow.position.set(-(i - 1) * LANE_W, 0.1, -14);
      g.add(arrow);
      return mat;
    });
    return g;
  }

  resolveGate() {
    const gt = this.gate;
    const p = this.player;
    const lane = THREE.MathUtils.clamp(Math.round(p.laneX / LANE_W) + 1, 0, 2);
    const chosen = gt.choices[lane];
    const correct = chosen === gt.q.answer;
    recordAnswer(gt.q, correct);
    this.answers.push({ q: gt.q, chosen, correct });
    gt.mesh.userData.panels.forEach((m, i) => {
      if (i === gt.correctLane) m.color.set(0x7dff9a);
      else if (i === lane) m.color.set(0xff5050);
      else m.opacity = 0.25;
    });
    this.oldGates.push({ mesh: gt.mesh, t: 0 });
    const pos = p.car.group.position.clone().setY(3);
    if (correct) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      p.boostT = 2.0 + Math.min(this.combo, 5) * 0.3;
      const gain = 5 + Math.min(this.combo, 10);
      this.coins += gain;
      this.burst(pos, [0x7dff9a, 0xffe14a, 0x19c3ff], 140);
      sfx.correct(this.combo);
      sfx.boost();
    } else {
      this.combo = 0;
      p.spinT = 1.3;
      p.boostT = 0;
      this.camShake = 0.6;
      this.burst(pos, [0xff4040, 0xffa040], 60);
      sfx.wrong();
    }
    this.emit('gateResult', { correct, q: gt.q, chosen, combo: this.combo, coins: this.coins });
    this.spawnGate(p.dist);
  }

  burst(pos, colors, n) {
    const geo = new THREE.BufferGeometry();
    const P = new Float32Array(n * 3), C = new Float32Array(n * 3), Vv = [];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      P.set([pos.x, pos.y, pos.z], i * 3);
      c.set(colors[i % colors.length]);
      C.set([c.r, c.g, c.b], i * 3);
      Vv.push(new THREE.Vector3((Math.random() - 0.5) * 30, Math.random() * 18, (Math.random() - 0.5) * 30));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(pts);
    this.particles.push({ pts, v: Vv, t: 0 });
  }

  // ------------------------------------------------------------------ control

  steer(dir) {
    if (this.phase !== 'racing' && this.phase !== 'countdown') return;
    const nl = THREE.MathUtils.clamp(this.player.lane + dir, 0, 2);
    if (nl !== this.player.lane) { this.player.lane = nl; sfx.swish(); }
  }
  setLane(l) {
    if (this.phase !== 'racing' && this.phase !== 'countdown') return;
    if (l !== this.player.lane) { this.player.lane = l; sfx.swish(); }
  }

  start() {
    this.phase = 'countdown';
    this.countT = 0;
    this.lastCount = -1;
    this.spawnGate(40);
  }

  // Called by the UI when the pit-stop puzzle is finished.
  finishPit({ time, wrong, solved }) {
    const penalty = wrong * 4 + (solved ? 0 : 6);
    const yourTime = time + penalty;
    const par = this.city.pitPar;
    const delta = THREE.MathUtils.clamp(yourTime - par, -22, 35);
    for (const r of this.rivals) r.dist += delta * CRUISE * r.pace * 0.8;
    this.clock += yourTime;
    this.coins += solved ? (wrong === 0 ? 40 : 20) : 0;
    progress().pit[solved && wrong === 0 ? 'r' : 'w']++;
    this.pitDone = true;
    this.phase = 'racing';
    this.player.speed = CRUISE * 0.4;
    if (solved && wrong === 0) { this.player.boostT = 3.5; sfx.boost(); }
    this.spawnGate(this.player.dist + 20);
    return { yourTime, par, gained: -delta, penalty };
  }

  positions() {
    const order = this.cars.slice().sort((a, b) => {
      if (a.finishOrder != null || b.finishOrder != null) return (a.finishOrder ?? 99) - (b.finishOrder ?? 99);
      return b.dist - a.dist;
    });
    return order;
  }

  // ------------------------------------------------------------------ loop

  update(dt) {
    if (this.paused) return;
    this.t += dt;
    const p = this.player;

    if (this.phase === 'intro') {
      this.introT += dt;
      this.updateCamera(dt, true);
      this.cars.forEach((c) => this.placeCar(c, dt));
      this.scenery.userData.update(dt, this.t, this.camera.position);
      return;
    }

    if (this.phase === 'countdown') {
      this.countT += dt;
      const step = Math.floor(this.countT / 0.7);
      if (step !== this.lastCount && step <= 4) {
        this.lastCount = step;
        this.track.setLights(step + 1);
        if (step >= 2) { this.emit('count', 5 - step); sfx.beep(false); }
      }
      if (this.countT >= 3.6) {
        this.track.setLights(0, true);
        this.phase = 'racing';
        this.emit('count', 0);
        sfx.beep(true);
      }
    }

    const racing = this.phase === 'racing' || this.phase === 'finished';
    if (this.phase === 'pit') {
      this.updateCamera(dt);
      this.scenery.userData.update(dt, this.t, this.camera.position);
      return;
    }

    if (this.phase === 'racing') this.clock += dt;

    // ---- player
    if (racing) {
      p.boostT = Math.max(0, p.boostT - dt);
      p.spinT = Math.max(0, p.spinT - dt);
      let target = CRUISE;
      if (p.boostT > 0) target *= 1.5 * this.carDef.boost;
      if (p.spinT > 0) target *= 0.45;
      if (this.input.brake && this.phase === 'racing') target *= 0.55;
      if (this.phase === 'finished') target = Math.max(0, CRUISE * (1 - this.finishT / 3));
      const k = target > p.speed ? (p.boostT > 0 ? 3 : 1.3) : 2.5;
      p.speed += (target - p.speed) * (1 - Math.exp(-dt * k));
      p.boost += ((p.boostT > 0 ? 1 : 0) - p.boost) * (1 - Math.exp(-dt * 6));
      p.dist += p.speed * dt;
    }
    this.moveLane(p, dt);

    // ---- rivals
    for (const r of this.rivals) {
      if (racing) {
        const gap = r.dist - p.dist;
        let rubber = 1;
        if (gap > 120) rubber = 0.95; else if (gap < -160) rubber = 1.05;
        const target = CRUISE * r.pace * (1 + 0.035 * Math.sin(this.t * 0.6 + r.phase)) * rubber;
        r.speed += (target - r.speed) * (1 - Math.exp(-dt * 1.2));
        r.dist += r.speed * dt;
        if (r.finishOrder == null && r.dist >= this.finishDist) r.finishOrder = this.nextFinish++;
      }
      // lane choice: avoid cars directly ahead/behind
      r.laneTimer -= dt;
      const blocked = (lane) => this.cars.some((o) => o !== r && Math.abs(o.dist - r.dist) < 10 && (o.isPlayer ? o.lane : o.lane) === lane);
      if (blocked(r.lane) || r.laneTimer <= 0) {
        const options = [0, 1, 2].filter((l) => !blocked(l));
        if (options.length) r.lane = options.includes(r.lane) && r.laneTimer > 0 ? r.lane : options[Math.floor(Math.random() * options.length)];
        r.laneTimer = 3 + Math.random() * 5;
      }
      this.moveLane(r, dt);
      r.boost = 0;
    }

    this.cars.forEach((c) => this.placeCar(c, dt));

    // ---- gates
    if (this.phase === 'racing' && this.gate && p.dist >= this.gate.dist) this.resolveGate();
    if (this.gate) this.emit('approach', Math.max(0, (this.gate.dist - p.dist) / (this.gate.dist - this.gate.spawnDist)));

    // ---- pit stop
    if (this.phase === 'racing' && !this.pitDone && p.dist >= this.pitLap * this.track.length) {
      this.phase = 'pit';
      if (this.gate) { this.scene.remove(this.gate.mesh); this.gate = null; }
      p.speed = 0;
      this.emit('pit', { problem: generatePitStop(this.city.pitLevel), par: this.city.pitPar });
      sfx.pit();
    }

    // ---- finish
    if (this.phase === 'racing' && p.dist >= this.finishDist) {
      this.phase = 'finished';
      this.finishT = 0;
      p.finishOrder = this.nextFinish++;
      this.finalPosition = this.positions().indexOf(p) + 1;
      this.emit('crossLine', this.finalPosition);
      sfx.finish(this.finalPosition);
    }
    if (this.phase === 'finished') {
      this.finishT += dt;
      if (this.finishT > 3.2 && !this.reported) {
        this.reported = true;
        this.emit('finish', this.results());
      }
    }

    // ---- lap tracking
    const lap = Math.min(this.city.laps, Math.max(1, Math.floor(p.dist / this.track.length) + 1));
    if (lap !== this.lap) {
      if (this.lap) this.emit('lap', lap);
      this.lap = lap;
    }

    this.updateEffects(dt);
    this.updateCamera(dt);
    this.scenery.userData.update(dt, this.t, this.camera.position);
    this.emit('tick', this);
  }

  moveLane(c, dt) {
    const target = (c.lane - 1) * LANE_W;
    const prev = c.laneX;
    const k = c.isPlayer ? 9 : 4;
    c.laneX += (target - c.laneX) * (1 - Math.exp(-dt * k));
    c.laneV = dt > 0 ? (c.laneX - prev) / dt : 0;
  }

  updateEffects(dt) {
    for (let i = this.oldGates.length - 1; i >= 0; i--) {
      const g = this.oldGates[i];
      g.t += dt;
      if (g.t > 2.5) { this.scene.remove(g.mesh); this.oldGates.splice(i, 1); }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pr = this.particles[i];
      pr.t += dt;
      const pos = pr.pts.geometry.attributes.position;
      pr.v.forEach((v, k) => {
        v.y -= 25 * dt;
        pos.setXYZ(k, pos.getX(k) + v.x * dt, Math.max(0.1, pos.getY(k) + v.y * dt), pos.getZ(k) + v.z * dt);
      });
      pos.needsUpdate = true;
      pr.pts.material.opacity = Math.max(0, 1 - pr.t / 1.4);
      if (pr.t > 1.4) { this.scene.remove(pr.pts); pr.pts.geometry.dispose(); this.particles.splice(i, 1); }
    }
  }

  updateCamera(dt, intro = false) {
    const p = this.player;
    const g = p.car.group;
    const f = this.track.frameAt(p.dist);
    const cam = this.camera;
    let desired, look;
    if (intro) {
      // Sweeping fly-in around the grid
      const a = this.introT * 0.35 + 1.2;
      const rad = 28 - this.introT * 2;
      desired = new THREE.Vector3(g.position.x + Math.cos(a) * rad, 6 + Math.max(0, 8 - this.introT * 2), g.position.z + Math.sin(a) * rad);
      look = g.position.clone().add(new THREE.Vector3(0, 1, 0));
      if (!this.camInit) { cam.position.copy(desired); this.camInit = true; }
      cam.position.lerp(desired, 1 - Math.exp(-dt * 3));
    } else if (this.phase === 'finished' || this.phase === 'pit') {
      const a = this.t * 0.4;
      desired = new THREE.Vector3(g.position.x + Math.cos(a) * 11, 3.5, g.position.z + Math.sin(a) * 11);
      look = g.position.clone().add(new THREE.Vector3(0, 1, 0));
      cam.position.lerp(desired, 1 - Math.exp(-dt * 2));
    } else {
      const back = 10.5 - p.boost * 1.5;
      desired = new THREE.Vector3(
        g.position.x - f.tan.x * back - f.right.x * p.laneX * 0.15,
        4.1 - p.boost * 0.4,
        g.position.z - f.tan.z * back - f.right.z * p.laneX * 0.15,
      );
      look = new THREE.Vector3(g.position.x + f.tan.x * 14, 1.6, g.position.z + f.tan.z * 14);
      cam.position.lerp(desired, 1 - Math.exp(-dt * 7));
    }
    if (this.camShake > 0) {
      this.camShake = Math.max(0, this.camShake - dt);
      cam.position.x += (Math.random() - 0.5) * this.camShake;
      cam.position.y += (Math.random() - 0.5) * this.camShake * 0.6;
    }
    cam.lookAt(look);
    const fov = 62 + p.boost * 12 + Math.max(0, p.speed - CRUISE) * 0.05;
    cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 4));
    cam.updateProjectionMatrix();

    // keep the sun's shadow box centred on the player
    this.sun.position.copy(g.position).addScaledVector(this.sunDir, 250);
    this.sun.target.position.copy(g.position);
    sfx.engine(p.speed / CRUISE, p.boost, this.phase === 'racing' || this.phase === 'countdown');
  }

  results() {
    const correct = this.answers.filter((a) => a.correct).length;
    const total = this.answers.length;
    const pos = this.finalPosition;
    const posBonus = [150, 100, 70, 40, 30, 20][pos - 1];
    const order = this.positions();
    return {
      position: pos,
      correct, total,
      accuracy: total ? correct / total : 0,
      bestCombo: this.bestCombo,
      time: this.clock,
      coins: this.coins + posBonus,
      posBonus,
      stars: pos === 1 ? 3 : pos <= 3 ? 2 : 1,
      misses: [...new Map(this.answers.filter((a) => !a.correct).map((a) => [a.q.text, a.q])).values()],
      standings: order.map((c) => ({ name: c.isPlayer ? c.name : c.name, isPlayer: !!c.isPlayer })),
    };
  }

  minimap() {
    return {
      pts: this.track.pos, S: this.track.S,
      cars: this.cars.map((c) => ({ x: c.car.group.position.x, z: c.car.group.position.z, color: c.isPlayer ? '#ffffff' : '#' + new THREE.Color(c.color).getHexString(), me: !!c.isPlayer })),
    };
  }

  dispose() {
    sfx.engine(0, 0, false);
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose?.(); x.dispose(); });
    });
    this.scene.environment?.dispose();
  }
}
