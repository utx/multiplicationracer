import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCar } from './car.js';
import { loadTexture, canvasTexture } from './renderer.js';

// Showroom: the title screen and garage backdrop.
export class GarageStage {
  constructor(renderer) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 500);
    this.bloom = 0.45;
    this.bloomThreshold = 0.9;
    this.exposure = 1.0;
    const s = this.scene;
    s.background = new THREE.Color(0x07080d);
    s.fog = new THREE.Fog(0x07080d, 18, 60);
    const pmrem = new THREE.PMREMGenerator(renderer.renderer);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.9;
    pmrem.dispose();

    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshPhysicalMaterial({ color: 0x0d0f15, roughness: 0.22, metalness: 0.5, clearcoat: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    this.turntable = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.25, 64), new THREE.MeshStandardMaterial({ color: 0x1a1d26, metalness: 0.8, roughness: 0.3 }));
    this.turntable.position.y = 0.12;
    this.turntable.receiveShadow = true;
    s.add(this.turntable);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.05, 8, 96), new THREE.MeshBasicMaterial({ color: 0x19c3ff }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.26;
    s.add(ring);
    this.ring = ring;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(7, 0.04, 8, 128), new THREE.MeshBasicMaterial({ color: 0xff3ea5 }));
    ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.02;
    s.add(ring2);

    // Light strips overhead
    for (let i = -2; i <= 2; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      strip.position.set(i * 2.5, 9, 0);
      s.add(strip);
    }
    const key = new THREE.SpotLight(0xffffff, 170, 40, 0.6, 0.5, 1.5);
    key.position.set(5, 12, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    s.add(key);
    const rim = new THREE.SpotLight(0x19c3ff, 110, 40, 0.5, 0.6, 1.5);
    rim.position.set(-8, 6, -8);
    s.add(rim);
    const rim2 = new THREE.SpotLight(0xff3ea5, 90, 40, 0.5, 0.6, 1.5);
    rim2.position.set(8, 5, -6);
    s.add(rim2);
    s.add(new THREE.AmbientLight(0x404660, 0.6));

    this.t = 0;
    this.view = 'title';
    this.camera.position.set(-2.5, 2.6, 13.5);
    this.setCar('gt', 0xe8202a);
  }

  setCar(type, color) {
    if (this.car && this.car.type === type) { this.car.setPaint(color); return; }
    if (this.car) this.turntable.remove(this.car.group);
    this.car = buildCar(type, color, { number: 1 });
    this.car.group.position.y = 0.13;
    this.turntable.add(this.car.group);
  }

  setView(v) { this.view = v; }

  update(dt) {
    this.t += dt;
    this.turntable.rotation.y += dt * 0.35;
    this.car?.update(dt, 0, 0, 0, this.t);
    const garage = this.view === 'garage';
    const target = garage ? new THREE.Vector3(1.5, 2.8, 12.5) : new THREE.Vector3(Math.sin(this.t * 0.1) * 1.5 - 2.5, 2.6, 13.5);
    this.camera.position.lerp(target, 1 - Math.exp(-dt * 2.5));
    this.camera.lookAt(garage ? new THREE.Vector3(4.2, 0.9, 0) : new THREE.Vector3(-4.2, 1.0, 0));
    this.ring.material.color.setHSL((this.t * 0.05) % 1, 0.9, 0.55);
  }

  dispose() {}
}

// World map: a spinning 3D globe with the tour route.
export class GlobeStage {
  constructor(renderer, cities, save) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 1000);
    this.camera.position.set(0, 0, 44);
    this.bloom = 0.55;
    this.bloomThreshold = 0.8;
    this.exposure = 1.1;
    const s = this.scene;
    s.background = new THREE.Color(0x03040a);

    // Stars
    const sg = new THREE.BufferGeometry();
    const sp = new Float32Array(3000 * 3);
    for (let i = 0; i < 3000; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(300 + Math.random() * 200);
      sp.set([v.x, v.y, v.z], i * 3);
    }
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    s.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.2, color: 0xffffff, sizeAttenuation: true })));

    this.tilt = new THREE.Group();
    this.spin = new THREE.Group();
    this.tilt.add(this.spin);
    s.add(this.tilt);
    this.tilt.position.x = 7;

    const R = (this.R = 10);
    const earthTex = loadTexture('earth_atmos_2048', { repeat: 1 });
    earthTex.wrapS = earthTex.wrapT = THREE.ClampToEdgeWrapping;
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.85, metalness: 0.0, color: 0xffffff }));
    this.spin.add(earth);

    // Atmosphere glow
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.08, 64, 32), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vN; void main(){ float i = pow(clamp(0.62 - dot(vN, vec3(0,0,1.0)), 0.0, 1.0), 4.0); gl_FragColor = vec4(0.25, 0.55, 1.0, 1.0) * i * 2.2; }`,
    }));
    this.tilt.add(atmo);

    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-20, 10, 30);
    s.add(sun);
    s.add(new THREE.AmbientLight(0x334466, 1.2));

    this.cities = cities;
    this.markers = [];
    this.routeGroup = new THREE.Group();
    this.spin.add(this.routeGroup);
    this.refresh(save);

    this.target = { x: 0, y: 0 };
    this.t = 0;
    this.focus(Math.max(0, Math.min(save.unlocked - 1, cities.length - 1)), true);
  }

  latLon(lat, lon, r = this.R) {
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon + 180);
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  }

  refresh(save) {
    this.markers.forEach((m) => this.spin.remove(m));
    this.markers = [];
    this.routeGroup.clear();
    this.cities.forEach((c, i) => {
      const unlocked = i < save.unlocked;
      const stars = save.stars[c.id] || 0;
      const color = !unlocked ? 0x667085 : stars > 0 ? 0x4dff88 : 0xffc400;
      const m = new THREE.Group();
      const p = this.latLon(c.lat, c.lon);
      const n = p.clone().normalize();
      m.position.copy(p);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8).translate(0, 0.4, 0), new THREE.MeshBasicMaterial({ color }));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshBasicMaterial({ color }));
      head.position.y = 0.85;
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.4, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      halo.position.y = 0.02;
      m.add(pin, head, halo);
      m.userData = { halo, i };
      this.spin.add(m);
      this.markers.push(m);

      if (i > 0) {
        const a = this.latLon(this.cities[i - 1].lat, this.cities[i - 1].lon);
        const b = p;
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const lift = this.R + a.distanceTo(b) * 0.35;
        mid.normalize().multiplyScalar(lift);
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const geo = new THREE.TubeGeometry(curve, 48, 0.04, 6);
        const done = i < save.unlocked;
        const line = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: done ? 0xffc400 : 0x3a4560, transparent: true, opacity: done ? 0.95 : 0.5 }));
        this.routeGroup.add(line);
      }
    });
  }

  focus(i, instant = false) {
    this.selected = i;
    const c = this.cities[i];
    const v = this.latLon(c.lat, c.lon);
    this.target.y = -Math.atan2(v.x, v.z);
    this.target.x = THREE.MathUtils.degToRad(c.lat) * 0.85;
    if (instant) { this.spin.rotation.y = this.target.y; this.tilt.rotation.x = this.target.x; }
  }

  update(dt) {
    this.t += dt;
    let dy = this.target.y - this.spin.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.spin.rotation.y += dy * (1 - Math.exp(-dt * 3));
    this.tilt.rotation.x += (this.target.x - this.tilt.rotation.x) * (1 - Math.exp(-dt * 3));
    this.markers.forEach((m) => {
      const sel = m.userData.i === this.selected;
      const s = sel ? 1.4 + Math.sin(this.t * 5) * 0.25 : 1;
      m.scale.setScalar(s);
      m.userData.halo.scale.setScalar(1 + ((this.t * 0.8 + m.userData.i * 0.2) % 1) * (sel ? 2.5 : 1));
      m.userData.halo.material.opacity = 0.7 * (1 - ((this.t * 0.8 + m.userData.i * 0.2) % 1));
    });
    this.camera.lookAt(0, 0, 0);
  }

  dispose() {}
}
