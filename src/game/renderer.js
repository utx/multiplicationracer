import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// One renderer for the whole game. Each screen ("stage") supplies a scene, camera and update().
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const size = this.size();
    this.target = new THREE.WebGLRenderTarget(size.w, size.h, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, this.target);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.w, size.h), 0.5, 0.6, 0.85);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.stage = null;
    this.clock = new THREE.Clock();
    this.quality = 'high';
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  size() { return { w: window.innerWidth, h: window.innerHeight }; }

  setQuality(q) {
    this.quality = q;
    this.renderer.shadowMap.enabled = q === 'high';
    this.resize();
  }

  resize() {
    const { w, h } = this.size();
    const pr = this.quality === 'high' ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    if (this.stage?.camera) {
      this.stage.camera.aspect = w / h;
      this.stage.camera.updateProjectionMatrix();
    }
  }

  setStage(stage) {
    if (this.stage && this.stage !== stage) this.stage.dispose?.();
    this.stage = stage;
    if (!stage) return;
    this.renderPass.scene = stage.scene;
    this.renderPass.camera = stage.camera;
    this.bloom.strength = stage.bloom ?? 0.5;
    this.bloom.threshold = stage.bloomThreshold ?? 0.85;
    this.bloom.radius = stage.bloomRadius ?? 0.6;
    this.renderer.toneMappingExposure = stage.exposure ?? 1;
    this.resize();
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    if (!this.stage) return;
    this.stage.update?.(dt);
    if (this.quality === 'high' && this.stage.bloom > 0) this.composer.render(dt);
    else this.renderer.render(this.stage.scene, this.stage.camera);
  }
}

// ---------------------------------------------------------------- shared helpers

const loader = new THREE.TextureLoader();
const texCache = new Map();

export function loadTexture(name, { repeat = 1, color = true } = {}) {
  const key = `${name}|${repeat}|${color}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = loader.load(`textures/${name}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

/** Gradient sky dome with a glowing sun, optional stars. */
export function makeSky(theme) {
  const sunDir = sunDirection(theme);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(theme.skyTop) },
      horizon: { value: new THREE.Color(theme.skyHorizon) },
      sunColor: { value: new THREE.Color(theme.sunColor) },
      sunDir: { value: sunDir },
      night: { value: theme.time === 'night' ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, horizon, sunColor, sunDir;
      uniform float night;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 col = mix(horizon, top, pow(max(h, 0.0), 0.55));
        col = mix(col, horizon * 0.6, clamp(-h * 4.0, 0.0, 1.0));
        float s = max(dot(vDir, sunDir), 0.0);
        col += sunColor * (pow(s, 900.0) * (night > 0.5 ? 1.2 : 6.0) + pow(s, 12.0) * 0.35 * (1.0 - night * 0.6));
        if (night > 0.5 && vDir.y > 0.05) {
          vec3 cell = floor(vDir * 300.0);
          float st = step(0.9965, hash(cell));
          col += vec3(st) * (0.6 + 0.4 * hash(cell + 1.0)) * smoothstep(0.05, 0.3, vDir.y);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

export function sunDirection(theme) {
  const el = THREE.MathUtils.degToRad(theme.sunElev);
  const az = THREE.MathUtils.degToRad(theme.sunAz);
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
}

/** Bake an environment map from a sky so cars get proper reflections. */
export function bakeEnvironment(renderer, theme) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(makeSky({ ...theme, time: theme.time === 'night' ? 'night-env' : theme.time }));
  // A bright soft "studio strip" so paint pops even at night.
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(3000, 300), new THREE.MeshBasicMaterial({ color: theme.time === 'night' ? 0x6070a0 : 0xffffff, side: THREE.DoubleSide }));
  strip.position.set(0, 1500, 0);
  strip.rotation.x = Math.PI / 2;
  envScene.add(strip);
  const rt = pmrem.fromScene(envScene, 0.02, 1, 5000);
  pmrem.dispose();
  return rt.texture;
}

/** Canvas helper for crisp text textures (gates, banners, signs). */
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
