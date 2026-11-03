import * as THREE from 'three';
import { canvasTexture } from './renderer.js';

// Hand-built (procedural) landmarks for each city, placed in the circuit's infield.

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A tapered beam between two points. */
function beam(a, b, rA, rB, mat, seg = 4) {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(rB, rA, len, seg).translate(0, len / 2, 0).rotateX(Math.PI / 2);
  const m = mesh(geo, mat, a.x, a.y, a.z);
  m.lookAt(b);
  return m;
}

function latticeLathe(profile, mat, wireColor, seg = 4) {
  const g = new THREE.Group();
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  geo.rotateY(Math.PI / 4);
  g.add(mesh(geo, mat));
  const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: wireColor, wireframe: true, transparent: true, opacity: 0.5 }));
  wire.scale.setScalar(1.01);
  g.add(wire);
  return g;
}

const BUILDERS = {
  sydney({ night }) {
    const g = new THREE.Group();
    const cream = std(0xe9e1cf);
    g.add(mesh(new THREE.BoxGeometry(90, 6, 50), cream, 0, 3, 0));
    g.add(mesh(new THREE.BoxGeometry(60, 3, 36), std(0xcab89a), 0, 7.5, 0));
    const shellMat = new THREE.MeshPhysicalMaterial({ color: 0xfbfaf5, roughness: 0.25, clearcoat: 0.6, side: THREE.DoubleSide, emissive: night ? 0x222222 : 0 });
    const cluster = (z0, scale) => {
      const sizes = [24, 20, 16, 11];
      sizes.forEach((s, i) => {
        const geo = new THREE.SphereGeometry(s * scale, 32, 16, 0, Math.PI, 0, Math.PI / 2);
        const m = mesh(geo, shellMat);
        m.scale.set(0.42, 1.25, 1);
        m.rotation.set(-0.35, Math.PI / 2, 0);
        m.position.set(-24 + i * 14, 8, z0);
        g.add(m);
        const back = mesh(geo, shellMat);
        back.scale.set(0.42, 1.0, 0.8);
        back.rotation.set(0.35, -Math.PI / 2, 0);
        back.position.set(-20 + i * 14, 8, z0);
        g.add(back);
      });
    };
    cluster(-8, 1); cluster(12, 0.8);
    // Harbour Bridge
    const steel = std(0x6d7580, { metalness: 0.6, roughness: 0.4 });
    const bridge = new THREE.Group();
    const arch = mesh(new THREE.TorusGeometry(70, 2.5, 8, 64, Math.PI), steel);
    arch.scale.set(1, 0.6, 1);
    bridge.add(arch);
    bridge.add(mesh(new THREE.BoxGeometry(170, 2, 10), steel, 0, 20, 0));
    for (let i = -6; i <= 6; i++) {
      const x = i * 10;
      const h = Math.sqrt(Math.max(0, 70 * 70 - x * x)) * 0.6;
      if (h > 21) bridge.add(mesh(new THREE.BoxGeometry(0.8, h - 20, 0.8), steel, x, 20 + (h - 20) / 2, 0));
    }
    for (const x of [-78, 78]) bridge.add(mesh(new THREE.BoxGeometry(12, 34, 14), std(0xbfae8d), x, 17, 0));
    bridge.position.set(10, 0, -110);
    bridge.scale.setScalar(0.8);
    g.add(bridge);
    return g;
  },

  tokyo({ night }) {
    const g = new THREE.Group();
    const red = std(0xff4a1a, { emissive: night ? 0xff3300 : 0, emissiveIntensity: 0.55, metalness: 0.3 });
    const white = std(0xffffff, { emissive: night ? 0xffffff : 0, emissiveIntensity: 0.4 });
    const profile = [];
    for (let i = 0; i <= 20; i++) {
      const y = (i / 20) * 140;
      profile.push([22 * Math.pow(1 - y / 150, 2.2) + 0.8, y]);
    }
    profile.push([0, 140]);
    const tower = latticeLathe(profile, red, 0xffffff);
    g.add(tower);
    g.add(mesh(new THREE.BoxGeometry(16, 6, 16), white, 0, 52, 0));
    g.add(mesh(new THREE.BoxGeometry(8, 4, 8), white, 0, 96, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.8, 30, 6), white, 0, 150, 0));
    // Torii gate
    const torii = new THREE.Group();
    const tr = std(0xe0301e);
    for (const x of [-9, 9]) torii.add(mesh(new THREE.CylinderGeometry(1, 1.1, 18, 12), tr, x, 9, 0));
    torii.add(mesh(new THREE.BoxGeometry(26, 1.8, 2.4), std(0x222222), 0, 18.5, 0));
    torii.add(mesh(new THREE.BoxGeometry(22, 1.2, 1.6), tr, 0, 15, 0));
    torii.position.set(-60, 0, 50);
    torii.rotation.y = 0.6;
    g.add(torii);
    // Mount Fuji on the horizon
    const fuji = new THREE.Group();
    fuji.add(mesh(new THREE.ConeGeometry(700, 480, 32, 1, true), std(0x3c4a6a, { flatShading: true })));
    const cap = mesh(new THREE.ConeGeometry(220, 150, 32), std(0xf4f6ff, { emissive: night ? 0x334466 : 0 }));
    cap.position.y = 166;
    fuji.add(cap);
    fuji.position.set(-900, 240, -2600);
    g.add(fuji);
    return g;
  },

  paris({ night }) {
    const g = new THREE.Group();
    const iron = std(0x6b5640, { metalness: 0.5, roughness: 0.5, emissive: 0x553311, emissiveIntensity: night ? 0.6 : 0.15 });
    const top = V(0, 32, 0);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      g.add(beam(V(x * 30, 0, z * 30), V(x * 11, 32, z * 11), 4, 2.6, iron));
    }
    // Arches between the legs
    for (let i = 0; i < 4; i++) {
      const a = mesh(new THREE.TorusGeometry(16, 1.2, 6, 24, Math.PI), iron);
      a.position.set(0, 6, 0);
      a.rotation.y = (i * Math.PI) / 2;
      a.translateZ(24);
      g.add(a);
    }
    g.add(mesh(new THREE.BoxGeometry(34, 3, 34), iron, top.x, 33, top.z));
    const profile = [[13, 0], [9, 25], [6, 45], [4, 70], [2.6, 95], [1.4, 115], [0.5, 128], [0, 132]];
    const upper = latticeLathe(profile, iron, 0xffcc88);
    upper.position.y = 34;
    g.add(upper);
    g.add(mesh(new THREE.BoxGeometry(14, 2, 14), iron, 0, 70, 0));
    g.add(mesh(new THREE.BoxGeometry(5, 2, 5), iron, 0, 140, 0));
    const beacon = mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), 0, 168, 0);
    g.add(beacon);
    g.userData.update = (dt, t) => { beacon.visible = Math.sin(t * 4) > -0.3; };
    return g;
  },

  london({ night }) {
    const g = new THREE.Group();
    const stone = std(0xc9b07a, { emissive: night ? 0x554422 : 0 });
    const tower = new THREE.Group();
    tower.add(mesh(new THREE.BoxGeometry(12, 76, 12), stone, 0, 38, 0));
    tower.add(mesh(new THREE.BoxGeometry(15, 15, 15), stone, 0, 83, 0));
    const clockTex = canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#c9b07a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f8f3e0'; c.beginPath(); c.arc(128, 128, 110, 0, 7); c.fill();
      c.strokeStyle = '#222'; c.lineWidth = 8; c.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.fillStyle = '#222';
        c.fillRect(128 + Math.sin(a) * 92 - 4, 128 - Math.cos(a) * 92 - 8, 8, 16);
      }
      c.lineCap = 'round';
      c.lineWidth = 10; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + 50, 128 - 30); c.stroke();
      c.lineWidth = 6; c.beginPath(); c.moveTo(128, 128); c.lineTo(128, 40); c.stroke();
    });
    const face = new THREE.MeshStandardMaterial({ map: clockTex, emissiveMap: clockTex, emissive: night ? 0xffffff : 0x333333, emissiveIntensity: night ? 0.8 : 0.3 });
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), face);
      p.position.set(0, 83, 0);
      p.rotation.y = (i * Math.PI) / 2;
      p.translateZ(7.6);
      tower.add(p);
    }
    const roof = mesh(new THREE.ConeGeometry(10.5, 26, 4), std(0x3a4a3c, { metalness: 0.4 }), 0, 104, 0);
    roof.rotation.y = Math.PI / 4;
    tower.add(roof);
    tower.add(mesh(new THREE.CylinderGeometry(0.2, 0.6, 12, 6), std(0xd4af37, { metalness: 1, roughness: 0.3 }), 0, 122, 0));
    tower.position.set(-60, 0, -20);
    g.add(tower);
    // Parliament block
    g.add(mesh(new THREE.BoxGeometry(70, 22, 18), stone, -20, 11, -40));
    // London Eye
    const eye = new THREE.Group();
    const white = std(0xf2f2f2, { metalness: 0.4, roughness: 0.3, emissive: night ? 0x6688ff : 0, emissiveIntensity: 0.5 });
    const wheel = new THREE.Group();
    wheel.add(mesh(new THREE.TorusGeometry(46, 0.9, 8, 72), white));
    wheel.add(mesh(new THREE.TorusGeometry(42, 0.5, 6, 72), white));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      wheel.add(beam(V(0, 0, 0), V(Math.cos(a) * 46, Math.sin(a) * 46, 0), 0.25, 0.25, white));
    }
    const pod = std(0xbfe6ff, { transparent: true, opacity: 0.85, metalness: 0.2, roughness: 0.1 });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const c = mesh(new THREE.CapsuleGeometry(1.2, 2.4, 4, 8), pod, Math.cos(a) * 47.5, Math.sin(a) * 47.5, 0);
      c.rotation.z = Math.PI / 2;
      wheel.add(c);
    }
    wheel.position.y = 52;
    eye.add(wheel);
    eye.add(beam(V(-18, 0, 12), V(0, 52, 0), 1.6, 1, white), beam(V(18, 0, 12), V(0, 52, 0), 1.6, 1, white));
    eye.position.set(60, 0, 20);
    eye.rotation.y = -0.4;
    g.add(eye);
    g.userData.update = (dt) => { wheel.rotation.z += dt * 0.05; };
    return g;
  },

  rio() {
    const g = new THREE.Group();
    const rock = std(0x7c8a72, { flatShading: true, roughness: 0.9 });
    const green = std(0x3f7a45, { flatShading: true });
    const loaf = mesh(new THREE.SphereGeometry(1, 14, 12), rock, 40, 0, -30);
    loaf.scale.set(34, 105, 30);
    g.add(loaf);
    const small = mesh(new THREE.SphereGeometry(1, 12, 10), green, 95, 0, 10);
    small.scale.set(28, 55, 26);
    g.add(small);
    g.add(beam(V(95, 54, 10), V(40, 104, -30), 0.15, 0.15, std(0x222222)));
    // Corcovado hill + statue
    g.add(mesh(new THREE.ConeGeometry(60, 115, 9), green, -60, 57, 30));
    const stoneW = std(0xe9e6dd, { roughness: 0.6 });
    const statue = new THREE.Group();
    statue.add(mesh(new THREE.CylinderGeometry(2.4, 3.6, 20, 10), stoneW, 0, 10, 0));
    statue.add(mesh(new THREE.BoxGeometry(26, 2.4, 2.6), stoneW, 0, 17, 0));
    statue.add(mesh(new THREE.SphereGeometry(2, 12, 10), stoneW, 0, 22, 0));
    statue.add(mesh(new THREE.BoxGeometry(6, 5, 6), std(0xb8b2a6), 0, -2, 0));
    statue.position.set(-60, 116, 30);
    statue.scale.setScalar(1.3);
    g.add(statue);
    return g;
  },

  cairo() {
    const g = new THREE.Group();
    const sand = std(0xd8b36a, { flatShading: true, roughness: 0.95 });
    const pyr = (r, x, z) => {
      const m = mesh(new THREE.ConeGeometry(r, r * 1.27, 4), sand, x, (r * 1.27) / 2, z);
      m.rotation.y = Math.PI / 4 + 0.1;
      g.add(m);
      const cap = mesh(new THREE.ConeGeometry(r * 0.12, r * 0.152, 4), std(0xffe08a, { metalness: 0.8, roughness: 0.3 }), x, r * 1.27 - r * 0.076, z);
      cap.rotation.y = m.rotation.y;
      g.add(cap);
    };
    pyr(62, -40, -30); pyr(48, 70, 30); pyr(28, 40, -100);
    // Sphinx
    const sph = new THREE.Group();
    sph.add(mesh(new THREE.BoxGeometry(10, 8, 34), sand, 0, 4, 0));
    sph.add(mesh(new THREE.BoxGeometry(8, 9, 8), sand, 0, 12, 14));
    sph.add(mesh(new THREE.BoxGeometry(11, 6, 5), std(0x3a6ab8), 0, 14, 12));
    sph.position.set(-70, 0, 70);
    sph.rotation.y = 0.8;
    g.add(sph);
    // Obelisk
    g.add(mesh(new THREE.CylinderGeometry(1.4, 2.6, 34, 4), sand, 30, 17, 90));
    return g;
  },

  newyork({ night }) {
    const g = new THREE.Group();
    const winTex = canvasTexture(64, 256, (c, w, h) => {
      c.fillStyle = night ? '#000' : '#9aa3ad'; c.fillRect(0, 0, w, h);
      for (let y = 4; y < h; y += 8) for (let x = 3; x < w; x += 8) {
        c.fillStyle = night ? (Math.random() < 0.6 ? '#ffd88a' : '#0a0a10') : '#2c3a4f';
        c.fillRect(x, y, 4, 5);
      }
    });
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
    const deco = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, map: night ? null : winTex, emissiveMap: night ? winTex : null, emissive: night ? 0xffffff : 0, roughness: 0.6 });
    const es = new THREE.Group();
    [[30, 110, 30, 0], [22, 40, 22, 110], [14, 22, 14, 150], [8, 12, 8, 172]].forEach(([w, h, d, y]) => es.add(mesh(new THREE.BoxGeometry(w, h, d), deco, 0, y + h / 2, 0)));
    es.add(mesh(new THREE.CylinderGeometry(0.4, 2, 34, 8), std(0xcfd6dd, { metalness: 0.9, roughness: 0.2, emissive: night ? 0x88aaff : 0 }), 0, 201, 0));
    es.position.set(-40, 0, -30);
    g.add(es);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x5f7fa0, metalness: 0.9, roughness: 0.08, emissive: night ? 0x101830 : 0 });
    [[40, -90, 22, 150], [70, -20, 26, 120], [-90, 40, 18, 95], [10, 70, 20, 80], [-110, -60, 24, 130]].forEach(([x, z, w, h]) => g.add(mesh(new THREE.BoxGeometry(w, h, w), glass, x, h / 2, z)));
    // Statue of Liberty
    const lib = new THREE.Group();
    const cu = std(0x6fb39b, { roughness: 0.6 });
    lib.add(mesh(new THREE.BoxGeometry(18, 22, 18), std(0xb9ae98), 0, 11, 0));
    lib.add(mesh(new THREE.CylinderGeometry(3, 6, 30, 12), cu, 0, 37, 0));
    lib.add(mesh(new THREE.SphereGeometry(2.6, 12, 10), cu, 0, 54, 0));
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.35;
      const spike = mesh(new THREE.ConeGeometry(0.4, 3, 6), cu, Math.cos(a) * 2.6, 56.5, Math.sin(a) * 2.6);
      spike.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      lib.add(spike);
    }
    lib.add(beam(V(2.5, 46, 0), V(5, 64, 0), 1.1, 0.9, cu));
    const torch = mesh(new THREE.ConeGeometry(1.4, 3, 10), new THREE.MeshBasicMaterial({ color: 0xffc23d }), 5.2, 66, 0);
    lib.add(torch);
    lib.add(mesh(new THREE.BoxGeometry(3, 4, 1), cu, -3.4, 44, 2));
    lib.position.set(70, 0, 70);
    lib.scale.setScalar(1.4);
    g.add(lib);
    g.userData.update = (dt, t) => { torch.scale.setScalar(1 + Math.sin(t * 9) * 0.08); };
    return g;
  },

  reykjavik({ night }) {
    const g = new THREE.Group();
    const conc = std(0xe4e2dc, { emissive: night ? 0x334455 : 0, emissiveIntensity: 0.5 });
    const ch = new THREE.Group();
    ch.add(mesh(new THREE.BoxGeometry(12, 74, 10), conc, 0, 37, 0));
    const spire = mesh(new THREE.ConeGeometry(7.5, 22, 4), conc, 0, 85, 0);
    spire.rotation.y = Math.PI / 4;
    ch.add(spire);
    ch.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 6), std(0xd4af37), 0, 100, 0));
    for (let i = 1; i <= 6; i++) {
      const h = 66 - i * 8;
      for (const s of [-1, 1]) ch.add(mesh(new THREE.BoxGeometry(4, h, 9), conc, s * (4 + i * 4), h / 2, 0));
    }
    ch.add(mesh(new THREE.BoxGeometry(20, 20, 50), conc, 0, 10, -28));
    const roofMat = std(0x8aa0b0, { metalness: 0.5 });
    const nave = mesh(new THREE.CylinderGeometry(10, 10, 50, 3, 1), roofMat, 0, 22, -28);
    nave.rotation.x = Math.PI / 2;
    ch.add(nave);
    const glow = mesh(new THREE.BoxGeometry(4, 10, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }), 0, 50, 5.2);
    ch.add(glow);
    ch.position.set(-20, 0, -10);
    g.add(ch);
    // Little coloured houses
    const cols = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0xffffff];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, d = 75 + (i % 3) * 14;
      const house = new THREE.Group();
      house.add(mesh(new THREE.BoxGeometry(8, 7, 10), std(cols[i % cols.length]), 0, 3.5, 0));
      const roof = mesh(new THREE.CylinderGeometry(6, 6, 10, 3), std(0x333a40), 0, 8.5, 0);
      roof.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      roof.scale.set(1, 1, 0.5);
      house.add(roof);
      house.add(mesh(new THREE.BoxGeometry(1.6, 2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffd27a }), 2, 3.5, 5.1));
      house.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      house.rotation.y = -a;
      g.add(house);
    }
    return g;
  },
};

export function buildLandmark(id, opts) {
  const b = BUILDERS[id];
  return b ? b(opts) : null;
}
