import * as THREE from 'three';
import { loadTexture, canvasTexture } from './renderer.js';
import { seeded } from '../math/rng.js';

export const LANE_W = 4.6;
export const ROAD_HALF = LANE_W * 1.5 + 0.6;
const CURB_W = 1.3;
export const BARRIER = ROAD_HALF + CURB_W + 3.2;

const UP = new THREE.Vector3(0, 1, 0);

// A closed, flat circuit generated from a seed. Distances are in metres along the racing line.
export class Track {
  constructor(city) {
    this.city = city;
    const r = seeded(city.seed);
    const R = 310;
    const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
    const a2 = 0.14 + r() * 0.06, a3 = 0.08 + r() * 0.06, a5 = 0.03 + r() * 0.03;
    const pts = [];
    const N = 24;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      const rad = R * (1 + a2 * Math.sin(2 * t + ph[0]) + a3 * Math.sin(3 * t + ph[1]) + a5 * Math.sin(5 * t + ph[2]));
      pts.push(new THREE.Vector3(Math.cos(t) * rad * 1.35, 0, Math.sin(t) * rad));
    }
    // Driving direction keeps the infield on the driver's right (right = tangent × up points inward).
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.length = this.curve.getLength();

    const S = (this.S = Math.ceil(this.length / 1.5));
    this.pos = new Float32Array(S * 3);
    this.tan = new Float32Array(S * 3);
    const p = new THREE.Vector3(), t = new THREE.Vector3();
    for (let i = 0; i < S; i++) {
      this.curve.getPointAt(i / S, p);
      this.curve.getTangentAt(i / S, t);
      t.y = 0; t.normalize();
      this.pos.set([p.x, 0, p.z], i * 3);
      this.tan.set([t.x, 0, t.z], i * 3);
    }
    this.buildGrid();
    this.group = new THREE.Group();
  }

  /** Position, forward tangent and right-hand vector at distance d. */
  frameAt(d, out = { pos: new THREE.Vector3(), tan: new THREE.Vector3(), right: new THREE.Vector3() }) {
    const L = this.length, S = this.S;
    const u = ((((d % L) + L) % L) / L) * S;
    const i = Math.floor(u) % S, j = (i + 1) % S, f = u - Math.floor(u);
    const P = this.pos, T = this.tan;
    out.pos.set(
      P[i * 3] + (P[j * 3] - P[i * 3]) * f, 0,
      P[i * 3 + 2] + (P[j * 3 + 2] - P[i * 3 + 2]) * f,
    );
    out.tan.set(T[i * 3] + (T[j * 3] - T[i * 3]) * f, 0, T[i * 3 + 2] + (T[j * 3 + 2] - T[i * 3 + 2]) * f).normalize();
    out.right.crossVectors(out.tan, UP).normalize();
    return out;
  }

  // Spatial hash so scenery can avoid the road.
  buildGrid() {
    this.cell = 40;
    this.grid = new Map();
    for (let i = 0; i < this.S; i += 2) {
      const x = this.pos[i * 3], z = this.pos[i * 3 + 2];
      const k = `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`;
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(x, z);
    }
  }

  distToRoad(x, z) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    let best = Infinity;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const arr = this.grid.get(`${cx + a},${cz + b}`);
      if (!arr) continue;
      for (let i = 0; i < arr.length; i += 2) {
        const dx = arr[i] - x, dz = arr[i + 1] - z;
        const d = dx * dx + dz * dz;
        if (d < best) best = d;
      }
    }
    return Math.sqrt(best);
  }

  /** Ribbon mesh between two lateral offsets. colorFn(dist) gives per-segment vertex colours. */
  ribbon(from, to, y, material, { vScale = 8, uScale = 8, step = 1, colorFn = null, skip = null, height = 0, mirror = false } = {}) {
    const verts = [], uvs = [], cols = [], idx = [];
    const f = { pos: new THREE.Vector3(), tan: new THREE.Vector3(), right: new THREE.Vector3() };
    const f2 = { pos: new THREE.Vector3(), tan: new THREE.Vector3(), right: new THREE.Vector3() };
    const segLen = 1.5 * step;
    const n = Math.ceil(this.length / segLen);
    const col = new THREE.Color();
    for (let s = 0; s < n; s++) {
      const d0 = s * segLen, d1 = Math.min((s + 1) * segLen, this.length + 0.01);
      if (skip && skip(d0)) continue;
      this.frameAt(d0, f); this.frameAt(d1, f2);
      const base = verts.length / 3;
      const pa = (fr, off, yy) => [fr.pos.x + fr.right.x * off, yy, fr.pos.z + fr.right.z * off];
      if (height) {
        verts.push(...pa(f, from, y), ...pa(f, from, y + height), ...pa(f2, from, y), ...pa(f2, from, y + height));
        const m = mirror ? -1 : 1;
        uvs.push((m * d0) / vScale, 0, (m * d0) / vScale, 1, (m * d1) / vScale, 0, (m * d1) / vScale, 1);
      } else {
        verts.push(...pa(f, from, y), ...pa(f, to, y), ...pa(f2, from, y), ...pa(f2, to, y));
        const w = Math.abs(to - from) / uScale;
        uvs.push(0, d0 / vScale, w, d0 / vScale, 0, d1 / vScale, w, d1 / vScale);
      }
      if (colorFn) { col.set(colorFn(d0)); for (let k = 0; k < 4; k++) cols.push(col.r, col.g, col.b); }
      // Winding so flat strips face up (from < to) and walls face outward.
      if (height) idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      else idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    return m;
  }

  build() {
    const th = this.city.theme;
    const G = this.group;

    // Ground
    const groundTex = loadTexture(`${th.ground}_diff_1k`, { repeat: 260 });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 9000),
      new THREE.MeshStandardMaterial({ map: groundTex, color: th.groundTint, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    G.add(ground);

    // Asphalt
    const road = new THREE.MeshStandardMaterial({
      map: loadTexture('asphalt_02_diff_1k'),
      normalMap: loadTexture('asphalt_02_nor_gl_1k', { color: false }),
      roughnessMap: loadTexture('asphalt_02_rough_1k', { color: false }),
      color: th.time === 'night' ? 0x9a9aa8 : 0xb8b8b8,
      roughness: th.time === 'night' ? 0.7 : 1,
    });
    G.add(this.ribbon(-ROAD_HALF, ROAD_HALF, 0.05, road, { uScale: 10, vScale: 10 }));

    // Runoff strips
    const runoff = new THREE.MeshStandardMaterial({ color: th.ground === 'snow_02' ? 0xb8c4cc : 0x6f7a62, roughness: 1 });
    G.add(this.ribbon(ROAD_HALF + CURB_W, BARRIER, 0.03, runoff));
    G.add(this.ribbon(-BARRIER, -(ROAD_HALF + CURB_W), 0.03, runoff));

    // Curbs (red / white)
    const curbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    const curbCol = (d) => (Math.floor(d / 3) % 2 ? 0xffffff : 0xd8262e);
    G.add(this.ribbon(ROAD_HALF, ROAD_HALF + CURB_W, 0.07, curbMat, { colorFn: curbCol, step: 1 }));
    G.add(this.ribbon(-ROAD_HALF - CURB_W, -ROAD_HALF, 0.07, curbMat, { colorFn: curbCol, step: 1 }));

    // Lane markings
    const paint = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5, emissive: 0x222222 });
    const dash = (d) => Math.floor(d / 6) % 2 === 1;
    for (const off of [-LANE_W / 2, LANE_W / 2]) G.add(this.ribbon(off - 0.12, off + 0.12, 0.07, paint, { skip: dash, step: 2 }));
    for (const off of [-ROAD_HALF + 0.35, ROAD_HALF - 0.35]) G.add(this.ribbon(off - 0.15, off + 0.15, 0.07, paint, { step: 2 }));

    // Barriers with banners
    const bannerTex = makeBannerTexture(this.city, th.barrier);
    const barrierMat = new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide, roughness: 0.6, emissiveMap: th.time === 'night' ? bannerTex : null, emissive: th.time === 'night' ? 0x666666 : 0x000000 });
    G.add(this.ribbon(BARRIER, BARRIER, 0, barrierMat, { height: 1.4, vScale: 40, mirror: true }));
    G.add(this.ribbon(-BARRIER, -BARRIER, 0, barrierMat, { height: 1.4, vScale: 40 }));

    this.buildStartLine();
    return G;
  }

  buildStartLine() {
    const G = this.group;
    const f = this.frameAt(0);
    const ang = Math.atan2(f.tan.x, f.tan.z);
    const checker = canvasTexture(256, 32, (g, w, h) => {
      const s = 16;
      for (let x = 0; x < w / s; x++) for (let y = 0; y < h / s; y++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
        g.fillRect(x * s, y * s, s, s);
      }
    });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 2), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.6 }));
    line.rotation.set(-Math.PI / 2, 0, ang);
    line.position.copy(f.pos).setY(0.08);
    G.add(line);

    // Gantry
    const gantry = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a2d35, metalness: 0.7, roughness: 0.35 });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), metal);
      p.position.set(s * (ROAD_HALF + 2.2), 4.5, 0);
      p.castShadow = true;
      gantry.add(p);
    }
    const bannerTex = canvasTexture(2048, 180, (g, w, h) => {
      g.fillStyle = '#10131c'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd400'; g.fillRect(0, h - 14, w, 14); g.fillRect(0, 0, w, 14);
      const text = `${this.city.name.toUpperCase()}  ·  START / FINISH`;
      let size = 110;
      g.font = `bold ${size}px Russo One, Arial Black, sans-serif`;
      while (g.measureText(text).width > w * 0.86 && size > 40) { size -= 4; g.font = `bold ${size}px Russo One, Arial Black, sans-serif`; }
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 4);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 + 5.2, 1.8, 0.7), [metal, metal, metal, metal,
      new THREE.MeshStandardMaterial({ map: bannerTex, emissiveMap: bannerTex, emissive: 0xffffff, emissiveIntensity: 0.6 }),
      new THREE.MeshStandardMaterial({ map: bannerTex, emissiveMap: bannerTex, emissive: 0xffffff, emissiveIntensity: 0.6 })]);
    beam.position.y = 8.6;
    beam.castShadow = true;
    gantry.add(beam);

    // Countdown lights
    this.lights = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0x000000, emissiveIntensity: 3 });
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), m);
      l.position.set((i - 2) * 1.3, 7.2, -0.45);
      gantry.add(l);
      this.lights.push(m);
    }
    const pod = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 0.4), metal);
    pod.position.set(0, 7.2, -0.2);
    gantry.add(pod);

    gantry.position.copy(f.pos);
    gantry.rotation.y = ang;
    G.add(gantry);
  }

  setLights(n, green = false) {
    this.lights?.forEach((m, i) => {
      const on = green || i < n;
      m.emissive.set(green ? 0x00ff55 : on ? 0xff1a1a : 0x000000);
      m.color.set(green ? 0x00ff55 : on ? 0xff2222 : 0x220000);
    });
  }
}

function makeBannerTexture(city, color) {
  const words = ['MULTIPLY!', city.name.toUpperCase(), 'TIMES TABLES', 'TURBO MATHS', '× × ×', 'WORLD TOUR'];
  const t = canvasTexture(2048, 64, (g, w, h) => {
    const c = '#' + new THREE.Color(color).getHexString();
    for (let i = 0; i < words.length; i++) {
      const x0 = (i * w) / words.length, ww = w / words.length;
      g.fillStyle = i % 2 ? '#f5f5f5' : c;
      g.fillRect(x0, 0, ww, h);
      g.fillStyle = i % 2 ? c : '#ffffff';
      g.font = 'bold 40px Russo One, Arial Black, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(words[i], x0 + ww / 2, h / 2 + 2);
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
