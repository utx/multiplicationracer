import * as THREE from 'three';
import { canvasTexture } from './renderer.js';

// Procedural cars, built from extruded side profiles so they have real curves.
// Forward is +Z, up is +Y, ground at y = 0.

const shared = {};
function mats() {
  if (shared.glass) return shared;
  shared.glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0e16, metalness: 0.9, roughness: 0.04, clearcoat: 1 });
  shared.trim = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.55, metalness: 0.3 });
  shared.tyre = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 });
  shared.chrome = new THREE.MeshStandardMaterial({ color: 0xe8e8ee, roughness: 0.18, metalness: 1 });
  shared.head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 2.2 });
  shared.tail = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a1a, emissiveIntensity: 2.4 });
  shared.flame = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  shared.flameCore = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  shared.shadowTex = canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.75)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  shared.shadow = new THREE.MeshBasicMaterial({ map: shared.shadowTex, transparent: true, depthWrite: false });
  return shared;
}

export function paintMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06,
  });
}

function extrude(draw, width, bevel = 0.1) {
  const s = new THREE.Shape();
  draw(s);
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 18,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2); // profile x -> forward z
  g.computeVertexNormals();
  return g;
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function wheel(r, w, m) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 28).rotateZ(Math.PI / 2), m.tyre);
  tyre.castShadow = true;
  g.add(tyre);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, w + 0.02, 24).rotateZ(Math.PI / 2), m.chrome);
  g.add(rim);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, r * 1.2, r * 0.14), m.trim);
    spoke.rotation.x = (i / 5) * Math.PI;
    g.add(spoke);
  }
  return g;
}

function numberDecal(num, color) {
  const tex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#' + new THREE.Color(color).getHexString();
    g.font = 'bold 76px Russo One, Arial Black, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(num), w / 2, h / 2 + 4);
  });
  return new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4 });
}

const BODIES = {
  gt(paint, m, root) {
    const body = new THREE.Mesh(extrude((s) => {
      s.moveTo(-2.15, 0.3); s.lineTo(2.05, 0.3);
      s.quadraticCurveTo(2.32, 0.32, 2.26, 0.56);
      s.quadraticCurveTo(2.15, 0.74, 1.45, 0.8);
      s.lineTo(0.55, 0.9); s.lineTo(-1.5, 0.95);
      s.quadraticCurveTo(-2.1, 0.98, -2.2, 0.85);
      s.lineTo(-2.25, 0.45); s.quadraticCurveTo(-2.25, 0.3, -2.15, 0.3);
    }, 1.9, 0.12), paint);
    const cabin = new THREE.Mesh(extrude((s) => {
      s.moveTo(0.7, 0.86); s.quadraticCurveTo(0.1, 1.3, -0.45, 1.34);
      s.lineTo(-0.95, 1.32); s.quadraticCurveTo(-1.55, 1.18, -1.8, 0.92); s.lineTo(0.7, 0.86);
    }, 1.5, 0.08), m.glass);
    root.add(body, cabin);
    root.add(box(1.75, 0.05, 0.38, paint, 0, 1.18, -1.98));
    root.add(box(0.06, 0.2, 0.18, m.trim, 0.6, 1.06, -1.98), box(0.06, 0.2, 0.18, m.trim, -0.6, 1.06, -1.98));
    root.add(box(1.2, 0.16, 0.1, m.trim, 0, 0.45, 2.3));
    root.add(box(2.0, 0.1, 3.2, m.trim, 0, 0.3, 0));
    root.add(box(0.42, 0.09, 0.05, m.head, 0.62, 0.66, 2.24), box(0.42, 0.09, 0.05, m.head, -0.62, 0.66, 2.24));
    root.add(box(1.5, 0.08, 0.05, m.tail, 0, 0.8, -2.33));
    return { wheels: [[0.92, 0.38, 1.38], [-0.92, 0.38, 1.38], [0.92, 0.38, -1.38], [-0.92, 0.38, -1.38]], r: 0.38, w: 0.3, exhaust: [[0.45, 0.38, -2.3], [-0.45, 0.38, -2.3]] };
  },

  rally(paint, m, root, opts) {
    const body = new THREE.Mesh(extrude((s) => {
      s.moveTo(-1.9, 0.45); s.lineTo(1.8, 0.45);
      s.quadraticCurveTo(2.06, 0.48, 2.0, 0.78);
      s.quadraticCurveTo(1.9, 0.97, 1.2, 1.02);
      s.lineTo(0.6, 1.06); s.lineTo(-1.85, 1.1);
      s.quadraticCurveTo(-2.0, 1.06, -1.96, 0.72); s.lineTo(-1.9, 0.45);
    }, 1.86, 0.12), paint);
    const cabin = new THREE.Mesh(extrude((s) => {
      s.moveTo(0.72, 1.0); s.quadraticCurveTo(0.25, 1.58, -0.3, 1.6);
      s.lineTo(-1.6, 1.6); s.quadraticCurveTo(-1.86, 1.55, -1.86, 1.06); s.lineTo(0.72, 1.0);
    }, 1.62, 0.08), m.glass);
    root.add(body, cabin);
    root.add(box(1.5, 0.07, 1.6, paint, 0, 1.7, -0.8));
    root.add(box(1.1, 0.12, 0.12, m.trim, 0, 1.79, -0.1));
    for (let i = 0; i < 4; i++) root.add(box(0.2, 0.16, 0.06, m.head, -0.45 + i * 0.3, 1.8, -0.04));
    root.add(box(1.85, 0.06, 0.42, paint, 0, 1.75, -1.85));
    root.add(box(2.06, 0.18, 3.6, m.trim, 0, 0.48, 0));
    root.add(box(0.36, 0.1, 0.05, m.head, 0.62, 0.78, 2.04), box(0.36, 0.1, 0.05, m.head, -0.62, 0.78, 2.04));
    root.add(box(0.3, 0.12, 0.05, m.tail, 0.7, 0.9, -1.99), box(0.3, 0.12, 0.05, m.tail, -0.7, 0.9, -1.99));
    root.add(box(0.36, 0.3, 0.03, m.trim, 0.85, 0.3, -1.6), box(0.36, 0.3, 0.03, m.trim, -0.85, 0.3, -1.6));
    const dec = numberDecal(opts.number ?? 7, opts.color);
    const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), dec); d1.position.set(1.06, 0.8, -0.1); d1.rotation.y = Math.PI / 2;
    const d2 = d1.clone(); d2.position.x = -1.06; d2.rotation.y = -Math.PI / 2;
    root.add(d1, d2);
    return { wheels: [[0.95, 0.42, 1.3], [-0.95, 0.42, 1.3], [0.95, 0.42, -1.3], [-0.95, 0.42, -1.3]], r: 0.42, w: 0.34, exhaust: [[0.55, 0.42, -2.0]] };
  },

  formula(paint, m, root, opts) {
    const body = new THREE.Mesh(extrude((s) => {
      s.moveTo(-2.3, 0.2); s.lineTo(2.4, 0.2);
      s.quadraticCurveTo(2.55, 0.24, 2.42, 0.33);
      s.lineTo(0.8, 0.52); s.lineTo(0.15, 0.62); s.lineTo(-0.45, 0.66);
      s.quadraticCurveTo(-0.6, 1.12, -0.95, 1.06);
      s.lineTo(-2.15, 0.58); s.lineTo(-2.3, 0.2);
    }, 0.78, 0.1), paint);
    root.add(body);
    root.add(box(0.46, 0.42, 1.7, paint, 0.6, 0.42, -0.5), box(0.46, 0.42, 1.7, paint, -0.6, 0.42, -0.5));
    root.add(box(2.0, 0.05, 0.5, m.trim, 0, 0.16, 2.35));
    root.add(box(0.04, 0.24, 0.55, paint, 1.0, 0.26, 2.35), box(0.04, 0.24, 0.55, paint, -1.0, 0.26, 2.35));
    root.add(box(1.6, 0.07, 0.42, paint, 0, 1.08, -2.2), box(1.6, 0.05, 0.28, m.trim, 0, 0.92, -2.25));
    root.add(box(0.05, 0.5, 0.6, m.trim, 0.8, 0.9, -2.2), box(0.05, 0.5, 0.6, m.trim, -0.8, 0.9, -2.2));
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 14), new THREE.MeshPhysicalMaterial({ color: opts.helmet ?? 0xffffff, clearcoat: 1, roughness: 0.2 }));
    helmet.position.set(0, 0.78, -0.12); helmet.castShadow = true;
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.215, 20, 8, -0.9, 1.8, 1.2, 0.5), m.glass);
    visor.position.copy(helmet.position);
    root.add(helmet, visor);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 24, Math.PI), m.trim);
    halo.rotation.set(-Math.PI / 2 + 0.25, 0, 0); halo.position.set(0, 0.86, 0.05);
    root.add(halo);
    root.add(box(0.5, 0.08, 0.05, m.tail, 0, 0.98, -2.42));
    return { wheels: [[0.98, 0.42, 1.55], [-0.98, 0.42, 1.55], [0.98, 0.44, -1.45], [-0.98, 0.44, -1.45]], r: 0.43, w: 0.44, exhaust: [[0, 0.5, -2.35]] };
  },

  hyper(paint, m, root) {
    const body = new THREE.Mesh(extrude((s) => {
      s.moveTo(-2.3, 0.25); s.lineTo(2.2, 0.25);
      s.quadraticCurveTo(2.48, 0.27, 2.42, 0.4);
      s.lineTo(1.2, 0.62); s.quadraticCurveTo(0.4, 0.76, -0.2, 0.8);
      s.lineTo(-2.0, 0.8); s.quadraticCurveTo(-2.36, 0.76, -2.36, 0.5); s.lineTo(-2.3, 0.25);
    }, 2.02, 0.12), paint);
    const cabin = new THREE.Mesh(extrude((s) => {
      s.moveTo(0.95, 0.68); s.quadraticCurveTo(0.0, 1.2, -0.8, 1.14);
      s.quadraticCurveTo(-1.45, 1.02, -1.65, 0.78); s.lineTo(0.95, 0.68);
    }, 1.3, 0.08), m.glass);
    root.add(body, cabin);
    root.add(box(2.0, 0.06, 0.5, m.trim, 0, 1.28, -2.05));
    root.add(box(0.07, 0.42, 0.25, m.trim, 0.55, 1.05, -2.0), box(0.07, 0.42, 0.25, m.trim, -0.55, 1.05, -2.0));
    const neon = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    root.add(box(0.05, 0.05, 3.6, neon, 1.08, 0.3, 0), box(0.05, 0.05, 3.6, neon, -1.08, 0.3, 0));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.6), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.03;
    root.add(glow);
    root.add(box(0.6, 0.05, 0.05, m.head, 0.6, 0.45, 2.36), box(0.6, 0.05, 0.05, m.head, -0.6, 0.45, 2.36));
    root.add(box(1.9, 0.05, 0.05, m.tail, 0, 0.66, -2.42));
    root.add(box(1.8, 0.14, 0.3, m.trim, 0, 0.3, -2.3));
    return { wheels: [[0.98, 0.38, 1.45], [-0.98, 0.38, 1.45], [0.98, 0.4, -1.4], [-0.98, 0.4, -1.4]], r: 0.39, w: 0.36, exhaust: [[0.35, 0.42, -2.42], [-0.35, 0.42, -2.42]] };
  },
};

export function buildCar(type = 'gt', color = 0xe8202a, opts = {}) {
  const m = mats();
  const paint = paintMaterial(color);
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);

  const spec = (BODIES[type] || BODIES.gt)(paint, m, pivot, { ...opts, color });
  pivot.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });

  const wheels = spec.wheels.map(([x, y, z], i) => {
    const wg = wheel(spec.r, spec.w, m);
    wg.position.set(x, y, z);
    wg.rotation.order = 'YXZ';
    wg.userData.front = i < 2;
    root.add(wg);
    return wg;
  });

  const flames = spec.exhaust.map(([x, y, z]) => {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.2, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.6), m.flame);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.35), m.flameCore);
    g.add(outer, core);
    g.position.set(x, y, z);
    g.scale.setScalar(0.001);
    pivot.add(g);
    return g;
  });

  const blob = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 5.6), m.shadow);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.04;
  blob.renderOrder = 1;
  root.add(blob);

  let spin = 0;
  return {
    group: root,
    pivot,
    paint,
    type,
    wheels,
    radius: spec.r,
    setPaint(c) { paint.color.set(c); },
    /** speed in units/s, steer -1..1, boost 0..1 */
    update(dt, speed, steer = 0, boost = 0, t = 0) {
      spin += (speed / spec.r) * dt;
      for (const w of wheels) {
        w.rotation.x = spin;
        if (w.userData.front) w.rotation.y = steer * 0.35;
      }
      pivot.rotation.z = -steer * 0.05;
      pivot.rotation.x = -boost * 0.03;
      const s = boost > 0.02 ? boost * (0.85 + Math.sin(t * 60) * 0.15) : 0.001;
      for (const f of flames) f.scale.set(s, s, s * (1 + boost));
    },
  };
}
