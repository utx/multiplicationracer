import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture } from './renderer.js';
import { BARRIER } from './track.js';
import { seeded } from '../math/rng.js';
import { buildLandmark } from './landmarks.js';

// Everything around the circuit: trees, buildings, grandstands, mountains, water, sky effects.

const dummy = new THREE.Object3D();

function instanced(geo, mat, transforms, colors) {
  const m = new THREE.InstancedMesh(geo, mat, transforms.length);
  transforms.forEach((t, i) => {
    dummy.position.set(t.x, t.y || 0, t.z);
    dummy.rotation.set(0, t.ry || 0, 0);
    dummy.scale.set(t.sx ?? t.s, t.sy ?? t.s, t.sz ?? t.s);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    if (colors) m.setColorAt(i, new THREE.Color(colors[i]));
  });
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function treeGeometries(type) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: type === 'gum' ? 0xd8cdb8 : 0x6b4a32, roughness: 0.9 });
  if (type === 'pine') {
    const parts = [0, 1, 2].map((i) => new THREE.ConeGeometry(2.6 - i * 0.7, 3.4, 8).translate(0, 3 + i * 2, 0));
    return { trunk: new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6).translate(0, 1.2, 0), canopy: mergeGeometries(parts), trunkMat };
  }
  if (type === 'palm') {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.4, 4, 0), new THREE.Vector3(1.6, 8, 0));
    const trunk = new THREE.TubeGeometry(curve, 10, 0.28, 6);
    const leaves = [];
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.PlaneGeometry(1, 4.2, 1, 4);
      const pos = leaf.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const y = pos.getY(k) + 2.1; // 0..4.2 along leaf
        pos.setZ(k, -0.12 * y * y);
        pos.setY(k, y);
      }
      leaf.rotateX(-Math.PI / 2 + 0.3);
      leaf.rotateY((i / 7) * Math.PI * 2);
      leaf.translate(1.6, 8, 0);
      leaves.push(leaf);
    }
    return { trunk, canopy: mergeGeometries(leaves), trunkMat, doubleSide: true };
  }
  const canopy = new THREE.IcosahedronGeometry(type === 'gum' ? 2.6 : 2.4, 1);
  if (type === 'gum') canopy.scale(1.3, 0.75, 1.1).translate(0, 7.2, 0);
  else canopy.translate(0, 4.6, 0);
  const trunk = new THREE.CylinderGeometry(0.22, 0.34, type === 'gum' ? 6.4 : 3.6, 6).translate(0, type === 'gum' ? 3.2 : 1.8, 0);
  return { trunk, canopy, trunkMat };
}

function windowTexture(night, seed) {
  const r = seeded(seed);
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = night ? '#000' : '#ffffff';
    g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 16) for (let x = 8; x < w - 8; x += 16) {
      if (night) {
        g.fillStyle = r() < 0.55 ? `hsl(${40 + r() * 20}, 90%, ${55 + r() * 25}%)` : '#05070a';
      } else {
        g.fillStyle = `rgba(30,45,70,${0.55 + r() * 0.3})`;
      }
      g.fillRect(x, y, 9, 11);
    }
  });
}

export function buildScenery(track, theme, renderer) {
  const G = new THREE.Group();
  const r = seeded(track.city.seed * 7 + 3);
  const night = theme.time === 'night' || theme.time === 'dusk';
  const bounds = new THREE.Box3();
  for (let i = 0; i < track.S; i++) bounds.expandByPoint(new THREE.Vector3(track.pos[i * 3], 0, track.pos[i * 3 + 2]));

  const clear = (x, z, m) => track.distToRoad(x, z) > m;
  let maxR = 0;
  for (let i = 0; i < track.S; i++) maxR = Math.max(maxR, Math.hypot(track.pos[i * 3], track.pos[i * 3 + 2]));
  // The infield is kept low (trees only) so the landmark in the middle is always visible.
  const inInfield = (x, z) => {
    const a = Math.atan2(z, x);
    let best = 0, bd = Infinity;
    for (let i = 0; i < track.S; i += 8) {
      const px = track.pos[i * 3], pz = track.pos[i * 3 + 2];
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(pz, px) - a), Math.cos(Math.atan2(pz, px) - a)));
      if (da < bd) { bd = da; best = Math.hypot(px, pz); }
    }
    return Math.hypot(x, z) < best;
  };
  const nearTrackPoint = (minOff, maxOff) => {
    const d = r() * track.length;
    const f = track.frameAt(d);
    const side = r() < 0.5 ? -1 : 1;
    const off = side * (minOff + r() * (maxOff - minOff));
    return { x: f.pos.x + f.right.x * off, z: f.pos.z + f.right.z * off, side };
  };

  // Water on one side of the map
  let waterSide = null;
  if (theme.water) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 9000),
      new THREE.MeshPhysicalMaterial({ color: 0x1b5f8c, roughness: 0.06, metalness: 0.2, clearcoat: 1 }),
    );
    water.rotation.x = -Math.PI / 2;
    waterSide = bounds.max.x + 90;
    water.position.set(waterSide + 2000, 0.12, 0);
    water.receiveShadow = true;
    G.add(water);
  }
  const onLand = (x) => waterSide === null || x < waterSide - 15;

  // Trees
  const tg = treeGeometries(theme.trees);
  const trees = [];
  const nTrees = Math.floor(520 * (theme.treeDensity ?? 1));
  for (let i = 0; i < nTrees * 3 && trees.length < nTrees; i++) {
    const p = r() < 0.7 ? nearTrackPoint(BARRIER + 5, 70) : { x: (r() - 0.5) * 1800, z: (r() - 0.5) * 1400 };
    if (!onLand(p.x) || !clear(p.x, p.z, BARRIER + 4) || Math.hypot(p.x, p.z) < 150) continue;
    if (inInfield(p.x, p.z) && r() < 0.5) continue;
    trees.push({ x: p.x, z: p.z, s: 0.8 + r() * 0.7, ry: r() * 6.28 });
  }
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: theme.trees !== 'palm', side: tg.doubleSide ? THREE.DoubleSide : THREE.FrontSide });
  const base = new THREE.Color(theme.treeColor);
  const tColors = trees.map(() => base.clone().offsetHSL((r() - 0.5) * 0.05, (r() - 0.5) * 0.15, (r() - 0.5) * 0.12).getHex());
  G.add(instanced(tg.trunk, tg.trunkMat, trees));
  G.add(instanced(tg.canopy, canopyMat, trees, tColors));
  if (theme.snow && theme.trees === 'pine') {
    const caps = new THREE.ConeGeometry(1.0, 1.4, 8).translate(0, 7.3, 0);
    G.add(instanced(caps, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), trees));
  }

  // Buildings
  const nB = Math.floor(260 * theme.buildings);
  if (nB > 0) {
    const tex = windowTexture(night || theme.neon, track.city.seed);
    const bMat = new THREE.MeshStandardMaterial({
      map: night ? null : tex, roughness: 0.7, metalness: 0.1,
      emissiveMap: night ? tex : null, emissive: night ? 0xffffff : 0x000000, emissiveIntensity: night ? 0.9 : 0,
    });
    const blds = [], cols = [];
    const tall = theme.buildings >= 1 ? 1.8 : 1;
    for (let i = 0; i < nB * 4 && blds.length < nB; i++) {
      const p = r() < 0.75 ? nearTrackPoint(BARRIER + 35, 220) : { x: (r() - 0.5) * 2600, z: (r() - 0.5) * 2000 };
      const w = 12 + r() * 18, d = 12 + r() * 18, h = (10 + r() * r() * 70) * tall;
      if (!onLand(p.x) || !clear(p.x, p.z, BARRIER + 12 + Math.max(w, d) * 0.75) || inInfield(p.x, p.z)) continue;
      blds.push({ x: p.x, y: h / 2, z: p.z, sx: w, sy: h, sz: d, ry: r() * 3.14 });
      cols.push(theme.buildingPalette[Math.floor(r() * theme.buildingPalette.length)]);
    }
    G.add(instanced(new THREE.BoxGeometry(1, 1, 1), bMat, blds, cols));
    if (theme.neon) {
      const neonCols = [0xff2d95, 0x00e5ff, 0xffe600, 0x7b61ff, 0x00ff9c];
      const strips = blds.filter(() => r() < 0.6).map((b) => ({ x: b.x, y: b.sy + 0.4, z: b.z, sx: b.sx + 0.4, sy: 0.8, sz: b.sz + 0.4, ry: b.ry }));
      G.add(instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), strips, strips.map(() => neonCols[Math.floor(r() * neonCols.length)])));
    }
  }

  // Grandstands along the start straight (outside of the track = left side)
  const crowdTex = canvasTexture(256, 32, (g, w, h) => {
    g.fillStyle = '#2a2f3a'; g.fillRect(0, 0, w, h);
    for (let x = 4; x < w; x += 8) {
      const y = 12 + r() * 6;
      g.fillStyle = `hsl(${Math.floor(r() * 12) * 30}, 70%, ${45 + r() * 20}%)`;
      g.fillRect(x - 3, y, 6, h - y);
      g.fillStyle = '#f0c8a0';
      g.beginPath(); g.arc(x, y - 3, 3, 0, Math.PI * 2); g.fill();
    }
  });
  crowdTex.wrapS = THREE.RepeatWrapping;
  crowdTex.repeat.set(6, 1);
  for (const d of [-90, -40, 40]) {
    const f = track.frameAt(d);
    const stand = new THREE.Group();
    const steps = 6;
    for (let s = 0; s < steps; s++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(44, 1.4, 2.6), [
        new THREE.MeshStandardMaterial({ color: 0x3a3f4a }), new THREE.MeshStandardMaterial({ color: 0x3a3f4a }),
        new THREE.MeshStandardMaterial({ map: crowdTex }), new THREE.MeshStandardMaterial({ color: 0x3a3f4a }),
        new THREE.MeshStandardMaterial({ map: crowdTex, emissiveMap: crowdTex, emissive: night ? 0x555555 : 0 }), new THREE.MeshStandardMaterial({ color: 0x3a3f4a }),
      ]);
      m.position.set(0, 0.7 + s * 1.4, -s * 2.4);
      m.castShadow = m.receiveShadow = true;
      stand.add(m);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 18), new THREE.MeshStandardMaterial({ color: theme.barrier, metalness: 0.4, roughness: 0.4 }));
    roof.position.set(0, 13, -6);
    roof.castShadow = true;
    stand.add(roof);
    for (const x of [-21, 21]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, 13, 0.6), new THREE.MeshStandardMaterial({ color: 0x888888 }));
      col.position.set(x, 6.5, -14);
      stand.add(col);
    }
    const off = -(BARRIER + 5);
    stand.position.set(f.pos.x + f.right.x * off, 0, f.pos.z + f.right.z * off);
    stand.rotation.y = Math.atan2(f.right.x, f.right.z); // front faces the road
    G.add(stand);
  }

  // Mountains / dunes on the horizon
  const mGeo = theme.dunes ? new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2) : new THREE.ConeGeometry(1, 1, 7);
  if (!theme.dunes) mGeo.translate(0, 0.5, 0);
  const mMat = new THREE.MeshStandardMaterial({ color: theme.mountains, roughness: 1, flatShading: true });
  const mts = [];
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + r() * 0.1;
    const dist = 1700 + r() * 900;
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    if (waterSide !== null && x > waterSide) continue;
    const s = 200 + r() * 260;
    mts.push(theme.dunes ? { x, z, sx: s * 1.6, sy: s * 0.25, sz: s, ry: r() * 6 } : { x, z, sx: s, sy: s * (0.5 + r() * 0.5), sz: s, ry: r() * 6 });
  }
  const mountains = instanced(mGeo, mMat, mts);
  mountains.castShadow = false;
  G.add(mountains);
  if (theme.snow || theme.ground === 'snow_02') {
    const caps = mts.map((m) => ({ ...m, y: m.sy * 0.62, sx: m.sx * 0.4, sy: m.sy * 0.4, sz: m.sz * 0.4 }));
    const capMesh = instanced(mGeo.clone(), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }), caps);
    capMesh.castShadow = false;
    G.add(capMesh);
  }

  // Clouds
  if (theme.time !== 'night') {
    const cloudTex = canvasTexture(256, 128, (g, w, h) => {
      for (let i = 0; i < 18; i++) {
        const x = w * (0.2 + r() * 0.6), y = h * (0.45 + r() * 0.25), rad = 20 + r() * 30;
        const grd = g.createRadialGradient(x, y, 0, x, y, rad);
        grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
      }
    });
    const cMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, color: theme.time === 'overcast' ? 0xc8ccd2 : 0xffffff, opacity: 0.9 });
    const n = theme.time === 'overcast' ? 60 : 30;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(cMat);
      const a = r() * Math.PI * 2, d = 600 + r() * 1800;
      s.position.set(Math.cos(a) * d, 220 + r() * 300, Math.sin(a) * d);
      s.scale.set(500 + r() * 400, 200 + r() * 120, 1);
      G.add(s);
    }
  }

  // Landmark(s) in the infield
  const lm = buildLandmark(theme.landmark, { night, theme });
  if (lm) { lm.scale.setScalar(1.35); G.add(lm); }

  const animators = [];
  if (lm?.userData.update) animators.push(lm.userData.update);
  if (theme.aurora) { const a = buildAurora(); G.add(a); animators.push(a.userData.update); }
  if (theme.snow) { const s = buildSnow(); G.add(s); animators.push(s.userData.update); }

  G.userData.update = (dt, t, camPos) => animators.forEach((fn) => fn(dt, t, camPos));
  return G;
}

function buildAurora() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float time; varying vec2 vUv;
      void main(){
        float wave = sin(vUv.x * 18.0 + time * 0.6) * 0.5 + sin(vUv.x * 7.0 - time * 0.3) * 0.5;
        float band = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
        float rays = 0.6 + 0.4 * sin(vUv.x * 160.0 + time * 1.5 + wave * 3.0);
        vec3 col = mix(vec3(0.1, 1.0, 0.55), vec3(0.6, 0.2, 1.0), vUv.y);
        float a = band * rays * (0.55 + 0.45 * wave) * smoothstep(0.0, 0.1, vUv.x) * (1.0 - smoothstep(0.9, 1.0, vUv.x));
        gl_FragColor = vec4(col * a * 1.4, a);
      }`,
  });
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const curve = new THREE.CatmullRomCurve3([...Array(7)].map((_, k) => new THREE.Vector3(-1800 + k * 600, 0, -1200 - i * 300 + Math.sin(k * 1.3 + i) * 400)));
    const pts = curve.getPoints(80);
    const verts = [], uvs = [], idx = [];
    pts.forEach((p, k) => {
      verts.push(p.x, 350 + i * 80, p.z, p.x, 900 + i * 120, p.z);
      uvs.push(k / 80, 0, k / 80, 1);
      if (k < 80) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    g.add(m);
  }
  g.userData.update = (dt, t) => { mat.uniforms.time.value = t; };
  return g;
}

function buildSnow() {
  const n = 2500;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 120, Math.random() * 50, (Math.random() - 0.5) * 120], i * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tex = canvasTexture(32, 32, (g) => {
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  });
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.35, map: tex, transparent: true, depthWrite: false, color: 0xffffff }));
  pts.frustumCulled = false;
  pts.userData.update = (dt, t, cam) => {
    if (!cam) return;
    for (let i = 0; i < n; i++) {
      let y = pos[i * 3 + 1] - dt * (3 + (i % 5));
      if (y < 0) y += 50;
      pos[i * 3 + 1] = y;
      // keep flakes wrapped around the camera
      pos[i * 3] = ((((pos[i * 3] - cam.x + 60) % 120) + 120) % 120) - 60 + cam.x;
      pos[i * 3 + 2] = ((((pos[i * 3 + 2] - cam.z + 60) % 120) + 120) % 120) - 60 + cam.z;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}
