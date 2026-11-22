// Mochi's chubby little bush plane (Piper Cub / floatplane vibe). The procedural model is the
// in-world plane and the fallback; if public/models/plane.glb is present (AI TRELLIS scan) it
// replaces the body. The propeller stays procedural so it can spin. STATE: world.plane =
// { owned, name, color }.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DOCK, WATER_Y, groundY, ISLAND_R, islandSurfH, isletSurfH } from './layout.js';
import { terrainH, riverX, riverW, TRAPPER } from './landscape.js';

const FLOAT_Y = 0.22; // how high the fuselage sits above the floats / waterline
const COLORS = {
  'cream-red': { body: 0xf3e6d0, accent: 0xc42b2b, float: 0xc5c8cc, prop: 0x8a5a32 },
  red: { body: 0xf3e6d0, accent: 0xc42b2b, float: 0xc5c8cc, prop: 0x8a5a32 },
  teal: { body: 0xeef3f1, accent: 0x2a8a86, float: 0xc5c8cc, prop: 0x8a5a32 },
  'cream-teal': { body: 0xeef3f1, accent: 0x2a8a86, float: 0xc5c8cc, prop: 0x8a5a32 },
};

function palette(color) {
  const key = String(color || 'cream-red').toLowerCase().trim();
  if (COLORS[key]) return { ...COLORS[key], key };
  if (/^#?[0-9a-f]{6}$/i.test(key)) {
    const n = parseInt(key.replace('#', ''), 16);
    return { body: 0xf3e6d0, accent: n, float: 0xc5c8cc, prop: 0x8a5a32, key: 'custom' };
  }
  return { ...COLORS['cream-red'], key: 'cream-red' };
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}

export function planeData(state) {
  const c = state?.world && typeof state.world.plane === 'object' && state.world.plane ? state.world.plane : {};
  const owned = c.owned !== false && c.owned !== 0 && c.owned !== 'false';
  const name = String(c.name || 'Tiny Cub').slice(0, 28);
  const color = String(c.color || 'cream-red').slice(0, 24);
  return { owned, name, color };
}

export function createPlane(scene, { state, tier = 2, music, mochi } = {}) {
  const cfg = planeData(state);
  const pal = palette(cfg.color);
  const g = new THREE.Group(); g.name = 'plane'; scene.add(g);
  const craft = new THREE.Group(); g.add(craft); // yaw/pitch/roll live here
  const body = new THREE.Group(); craft.add(body); // procedural or TRELLIS
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.72, metalness: 0.05, ...o });
  const add = (p, geo, m, pos = [0, 0, 0], rot = [0, 0, 0], sc = null) => {
    const x = new THREE.Mesh(geo, m); x.position.set(...pos); x.rotation.set(...rot); if (sc) x.scale.set(...(Array.isArray(sc) ? sc : [sc, sc, sc]));
    x.castShadow = true; x.receiveShadow = true; p.add(x); return x;
  };

  // ── mooring: a short finger pier just south of the fishing dock, out on the river ──
  const sideX = DOCK.dz, sideZ = -DOCK.dx; // along-shore, south-ish of the fishing dock
  const land = { x: DOCK.x0 + sideX * 8.2 - DOCK.dx * 0.6, z: DOCK.z0 + sideZ * 8.2 - DOCK.dz * 0.6 };
  const tip = { x: land.x + DOCK.dx * 5.4, z: land.z + DOCK.dz * 5.4 };
  const pierYaw = Math.atan2(DOCK.dx, DOCK.dz);
  const pier = new THREE.Group(); pier.position.set(land.x, WATER_Y + 0.16, land.z); pier.rotation.y = pierYaw; scene.add(pier);
  const plank = mat(0x8a6238); const dark = mat(0x5a3a1c);
  add(pier, new THREE.BoxGeometry(1.5, 0.1, 5.6), plank, [0, 0, 2.7]);
  for (const z of [0.4, 2.7, 5.0]) for (const x of [-0.62, 0.62]) {
    add(pier, new THREE.CylinderGeometry(0.07, 0.09, 1.1, 6), dark, [x, -0.5, z]);
  }
  // cleat + a little fuel can + windsock pole
  add(pier, new THREE.BoxGeometry(0.22, 0.08, 0.08), mat(0xccccd0), [0.4, 0.09, 5.15]);
  add(pier, new THREE.CylinderGeometry(0.11, 0.11, 0.28, 10), mat(0xc45a1a), [-0.45, 0.2, 1.1]);
  const pole = add(pier, new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), dark, [0.55, 0.85, 0.3]);
  const sock = add(pier, new THREE.ConeGeometry(0.12, 0.45, 8, 1, true), mat(0xc42b2b, { side: THREE.DoubleSide }), [0.55, 1.45, 0.5], [Math.PI / 2, 0, 0]);
  // name sign
  const signTex = canvasTex(256, 64, (q, w, h) => {
    q.fillStyle = '#f3e6d0'; q.fillRect(0, 0, w, h);
    q.strokeStyle = '#c42b2b'; q.lineWidth = 8; q.strokeRect(4, 4, w - 8, h - 8);
    q.fillStyle = '#c42b2b'; q.font = 'bold 28px Nunito, system-ui, sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle';
    q.fillText('✈️ ' + cfg.name, w / 2, h / 2);
  });
  const sign = add(pier, new THREE.PlaneGeometry(1.15, 0.3), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8 }), [0, 0.85, 0.15]);
  sign.castShadow = false;

  // mooring: alongside the tip, nose facing downriver (roughly south, -z) for a long water run
  const moor = { x: tip.x + sideX * 2.6 + DOCK.dx * 0.4, z: tip.z + sideZ * 2.6 + DOCK.dz * 0.4, yaw: Math.PI + 0.15 };
  const boardPt = new THREE.Vector3(tip.x - DOCK.dx * 0.4, 0, tip.z - DOCK.dz * 0.4);

  // ── procedural chubby cub ──
  const cream = mat(pal.body), accent = mat(pal.accent), ali = mat(0xd8dce0), glass = mat(0xd8e8f4, { transparent: true, opacity: 0.45, roughness: 0.15, metalness: 0.1 });
  const proc = new THREE.Group(); body.add(proc);
  // fuselage (chubby capsule, nose +z)
  add(proc, new THREE.CapsuleGeometry(0.42, 2.05, 8, 16), cream, [0, 0.55, 0], [Math.PI / 2, 0, 0]);
  add(proc, new THREE.SphereGeometry(0.42, 14, 10), cream, [0, 0.55, 1.05], [0, 0, 0], [1, 1, 0.85]); // nose
  add(proc, new THREE.SphereGeometry(0.36, 12, 8), cream, [0, 0.55, -1.15], [0, 0, 0], [1, 1, 0.7]);
  // cockpit cutout + seat + windshield
  add(proc, new THREE.SphereGeometry(0.34, 12, 8), mat(0x3a2418), [0, 0.72, 0.15], [0, 0, 0], [0.85, 0.55, 0.9]);
  add(proc, new THREE.BoxGeometry(0.36, 0.08, 0.32), mat(0x5a3822), [0, 0.58, 0.12]);
  const shield = add(proc, new THREE.PlaneGeometry(0.5, 0.32), glass, [0, 0.92, 0.42], [-0.45, 0, 0]); shield.castShadow = false;
  // high wing + struts + red stripe
  add(proc, new THREE.BoxGeometry(4.6, 0.08, 0.95), accent, [0, 1.28, 0.15], [0, 0, 0], [1, 1, 1]);
  add(proc, new THREE.BoxGeometry(0.7, 0.1, 0.55), accent, [0, 1.3, 0.15]); // wing root fairing
  for (const s of [-1, 1]) {
    add(proc, new THREE.CylinderGeometry(0.03, 0.03, 0.85, 5), accent, [s * 0.85, 0.92, 0.28], [0, 0, s * 0.55]);
    add(proc, new THREE.CylinderGeometry(0.03, 0.03, 0.85, 5), accent, [s * 0.85, 0.92, 0.0], [0, 0, s * 0.55]);
  }
  const stripe = add(proc, new THREE.BoxGeometry(0.04, 0.06, 1.7), accent, [0.425, 0.55, 0.05]);
  add(proc, new THREE.BoxGeometry(0.04, 0.06, 1.7), accent, [-0.425, 0.55, 0.05]);
  // tail
  add(proc, new THREE.BoxGeometry(0.08, 0.85, 0.55), accent, [0, 0.95, -1.45], [0.15, 0, 0]);
  add(proc, new THREE.BoxGeometry(1.15, 0.07, 0.42), cream, [0, 0.62, -1.48]);
  const faceTex = canvasTex(64, 64, (q, w, h) => {
    q.fillStyle = '#c42b2b'; q.fillRect(0, 0, w, h);
    q.fillStyle = '#1a1a1a'; q.beginPath(); q.arc(22, 28, 5, 0, Math.PI * 2); q.arc(42, 28, 5, 0, Math.PI * 2); q.fill();
    q.beginPath(); q.arc(32, 38, 10, 0.15, Math.PI - 0.15); q.strokeStyle = '#1a1a1a'; q.lineWidth = 3; q.stroke();
  });
  const smile = add(proc, new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8 }), [0, 1.05, -1.18]);
  smile.castShadow = false;
  // MOCHI decals
  const letter = canvasTex(256, 64, (q, w, h) => {
    q.clearRect(0, 0, w, h);
    q.fillStyle = '#c42b2b'; q.font = 'bold 48px Nunito, system-ui, sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle';
    q.fillText('MOCHI', w / 2, h / 2);
  });
  letter.premultiplyAlpha = true;
  const decalM = () => new THREE.MeshStandardMaterial({ map: letter, transparent: true, roughness: 0.6, metalness: 0, depthWrite: false });
  const d1 = add(proc, new THREE.PlaneGeometry(0.9, 0.22), decalM(), [0.43, 0.62, -0.15], [0, Math.PI / 2, 0]); d1.castShadow = false;
  const d2 = add(proc, new THREE.PlaneGeometry(0.9, 0.22), decalM(), [-0.43, 0.62, -0.15], [0, -Math.PI / 2, 0]); d2.castShadow = false;
  // floats
  for (const s of [-1, 1]) {
    add(proc, new THREE.CapsuleGeometry(0.16, 2.15, 6, 10), ali, [s * 0.62, -0.02, 0.05], [Math.PI / 2, 0, 0]);
    add(proc, new THREE.CylinderGeometry(0.04, 0.04, 0.62, 5), cream, [s * 0.4, 0.28, 0.45], [0.15, 0, s * 0.45]);
    add(proc, new THREE.CylinderGeometry(0.04, 0.04, 0.62, 5), cream, [s * 0.4, 0.28, -0.35], [-0.1, 0, s * 0.45]);
  }
  add(proc, new THREE.CylinderGeometry(0.03, 0.03, 1.15, 5), ali, [0, 0.08, 0.15], [0, 0, Math.PI / 2]);

  // propeller (always procedural, spins around local z)
  const prop = new THREE.Group(); prop.position.set(0, 0.55, 1.48); craft.add(prop);
  add(prop, new THREE.SphereGeometry(0.11, 10, 8), accent, [0, 0, 0.02]);
  const bladeM = mat(pal.prop);
  for (const a of [0, Math.PI]) {
    const b = add(prop, new THREE.BoxGeometry(0.12, 1.15, 0.04), bladeM, [0, 0, 0.02]); b.rotation.z = a; b.rotation.x = 0.12;
  }
  // spinning disc (visible when the engine is up, hides the individual blades)
  const discTex = canvasTex(128, 128, (q, w, h) => {
    const gdt = q.createRadialGradient(64, 64, 8, 64, 64, 62);
    gdt.addColorStop(0, 'rgba(80,50,30,0.15)'); gdt.addColorStop(0.4, 'rgba(90,55,30,0.35)'); gdt.addColorStop(1, 'rgba(90,55,30,0)');
    q.fillStyle = gdt; q.beginPath(); q.arc(64, 64, 62, 0, Math.PI * 2); q.fill();
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), new THREE.MeshBasicMaterial({ map: discTex, transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide }));
  disc.position.z = 0.04; prop.add(disc);

  // seat helper (local to craft): where Mochi sits in the cockpit
  const seatLocal = new THREE.Vector3(0, 0.52, 0.08);

  // TRELLIS swap-in
  let model = null, loaded = false;
  const applyModel = () => { const use = !!model; proc.visible = !use; if (model) model.visible = use; };
  {
    const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
    L.load((import.meta.env?.BASE_URL || '/') + 'models/plane.glb', (glb) => {
      try {
        const sc = glb.scene;
        // the scan's nose points at -Z; yaw 180 so it matches the procedural stand-in (+Z forward)
        sc.rotation.y = Math.PI; sc.updateMatrixWorld(true);
        let bb = new THREE.Box3().setFromObject(sc); const size = new THREE.Vector3(); bb.getSize(size);
        const wantLen = 3.35; const s = wantLen / Math.max(size.z, 0.01);
        sc.scale.setScalar(s); sc.updateMatrixWorld(true);
        bb = new THREE.Box3().setFromObject(sc);
        sc.position.x -= (bb.min.x + bb.max.x) / 2;
        sc.position.z -= (bb.min.z + bb.max.z) / 2;
        sc.position.y -= bb.min.y + 0.16; // sink the floats just into the water
        body.add(sc); sc.updateMatrixWorld(true);
        // bbox in craft-local space (craft may already be yawed at the mooring when this async load finishes)
        const lb = new THREE.Box3(); const cv = new THREE.Vector3();
        sc.traverse((o) => {
          if (!o.isMesh || !o.geometry) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const g = o.geometry.boundingBox;
          for (const x of [g.min.x, g.max.x]) for (const y of [g.min.y, g.max.y]) for (const z of [g.min.z, g.max.z]) {
            cv.set(x, y, z); o.localToWorld(cv); craft.worldToLocal(cv); lb.expandByPoint(cv);
          }
        });
        prop.position.set(0, lb.min.y + (lb.max.y - lb.min.y) * 0.46, lb.max.z + 0.06);
        sc.traverse((o) => { if (o.isMesh) { if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); o.castShadow = true; o.receiveShadow = true; } });
        model = sc; loaded = true; applyModel();
      } catch (e) { console.warn('[plane] model failed', e.message); }
    }, undefined, () => { /* no file yet: keep procedural */ });
  }

  // wake (reuse the boat-style chevron)
  const wakeTex = canvasTex(128, 64, (q, w, h) => {
    q.clearRect(0, 0, w, h); q.strokeStyle = 'rgba(255,255,255,0.8)'; q.lineWidth = 6; q.lineCap = 'round';
    q.beginPath(); q.moveTo(10, 8); q.lineTo(64, 52); q.lineTo(118, 8); q.stroke();
  });
  const wakes = [];
  for (let i = 0; i < (tier >= 2 ? 12 : 7); i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    w.rotation.x = -Math.PI / 2; w.visible = false; w.userData.t = 9; scene.add(w); wakes.push(w);
  }
  let wakeOn = false, wakeT = 0;

  // contrail / puff smoke
  const puffs = [];
  const puffGeo = new THREE.SphereGeometry(0.35, 8, 6);
  for (let i = 0; i < (tier >= 2 ? 18 : 10); i++) {
    const p = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xe8e4dc, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    p.visible = false; p.userData.t = 9; scene.add(p); puffs.push(p);
  }
  let puffT = 0, smokeOn = false;

  // ground/water shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = WATER_Y + 0.04; scene.add(shadow);

  // aviator goggles (clipped onto Mochi's head while he flies)
  const goggles = new THREE.Group(); goggles.name = 'goggles';
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 18), mat(0x3a2a1a)); strap.rotation.x = Math.PI / 2; goggles.add(strap);
  for (const s of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 14), mat(0x3a2a1a)); cup.position.set(s * 0.11, 0.02, 0.2); goggles.add(cup);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), new THREE.MeshStandardMaterial({ color: 0x1a3040, transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.3 }));
    lens.position.set(s * 0.11, 0.02, 0.2); goggles.add(lens);
  }

  // flight state
  let phase = 'moored';
  let piloting = false;
  let rpm = 0, rpmTarget = 0;
  let st = { x: moor.x, y: WATER_Y + FLOAT_Y, z: moor.z, yaw: moor.yaw, pitch: 0, roll: 0 };
  const _seat = new THREE.Vector3();
  const _fwd = new THREE.Vector3();

  const _T = new THREE.Vector3(), _up = new THREE.Vector3(), _right = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _qt = new THREE.Quaternion(), _eu = new THREE.Euler();
  function setPose(x, y, z, yaw, pitch = 0, roll = 0, quat = null) {
    st.x = x; st.y = y; st.z = z; st.yaw = yaw; st.pitch = pitch; st.roll = roll;
    craft.position.set(x, y, z);
    if (quat) craft.quaternion.copy(quat);
    else { craft.rotation.order = 'YXZ'; craft.rotation.set(pitch, yaw, roll); }
  }
  function seatWorld() {
    _seat.copy(seatLocal); craft.localToWorld(_seat); return _seat;
  }
  function fwd() { return _fwd.set(Math.sin(st.yaw), 0, Math.cos(st.yaw)); }

  function placeMoor() {
    phase = 'moored'; rpmTarget = 0; wakeOn = false; smokeOn = false; piloting = false;
    setPose(moor.x, WATER_Y + FLOAT_Y, moor.z, moor.yaw, 0, 0);
  }
  placeMoor();

  // ── scenic path: taxi, takeoff, follow the river, Sapphires, a stunt, Bitterroots, land, taxi home ──
  function lerpYaw(a, b, t) { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; }
  function catmull(pts, u) {
    const n = pts.length - 1; const xx = Math.max(0, Math.min(0.9999, u)) * n; const i = Math.floor(xx), t = xx - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[Math.min(n, i + 1)], p3 = pts[Math.min(n, i + 2)];
    const tt = t * t, ttt = tt * t;
    const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * tt + (-a + 3 * b - 3 * c + d) * ttt);
    const ux = p0.up || { x: 0, y: 1, z: 0 }, uy = p1.up || ux, uz = p2.up || uy, uw = p3.up || uz;
    const upx = f(ux.x, uy.x, uz.x, uw.x), upy = f(ux.y, uy.y, uz.y, uw.y), upz = f(ux.z, uy.z, uz.z, uw.z);
    return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z),
      yaw: lerpYaw(p1.yaw, p2.yaw, t), pitch: (p1.pitch || 0) + ((p2.pitch || 0) - (p1.pitch || 0)) * t,
      roll: (p1.roll || 0) + ((p2.roll || 0) - (p1.roll || 0)) * t, up: { x: upx, y: upy, z: upz }, phase: t < 0.5 ? p1.phase : p2.phase };
  }
  function bankH(x, z) {
    const isl = islandSurfH(x, z), ile = isletSurfH(x, z);
    return Math.max(terrainH(x, z), Number.isFinite(isl) ? isl : -Infinity, Number.isFinite(ile) ? ile : -Infinity);
  }
  function onWater(x, z) { return bankH(x, z) <= WATER_Y + 0.2; }
  // x on the west (or east) side of the river that is actually water, well clear of the island
  function waterX(z, side = -1) {
    const rx = riverX(z), rw = riverW(z);
    for (const k of [0.78, 0.7, 0.62, 0.55, 0.48, 0.4, 0.85, 0.9]) {
      const x = rx + side * rw * k;
      if (onWater(x, z)) return x;
    }
    const x = rx + side * Math.max(ISLAND_R + 12, rw * 0.7);
    return x;
  }

  function mkPath() {
    const pts = [];
    const wy = WATER_Y + FLOAT_Y;
    const UP = { x: 0, y: 1, z: 0 };
    const floor = (x, z) => Math.max(terrainH(x, z), WATER_Y);
    const flyY = (x, z, agl = 30) => floor(x, z) + agl;
    const side0 = Math.sign(moor.x - riverX(moor.z)) || -1;
    const chan = (z) => riverX(z) + side0 * Math.min(16, riverW(z) * 0.4);
    const push = (x, y, z, extra = {}) => {
      const prev = pts[pts.length - 1];
      const yaw = extra.yaw != null ? extra.yaw : (prev ? Math.atan2(x - prev.x, z - prev.z) : moor.yaw);
      let yy = y;
      if (!extra.onWater && !extra.holdY) yy = Math.max(y, flyY(x, z, extra.agl != null ? extra.agl : 30));
      const g = bankH(x, z);
      if (g > WATER_Y + 0.25) yy = Math.max(yy, g + (extra.onWater ? 2.5 : extra.holdY ? 10 : 2.5));
      pts.push({ x, y: yy, z, yaw, pitch: extra.pitch || 0, roll: extra.roll || 0, phase: extra.phase || 'cruise', up: extra.up || UP, onWater: !!extra.onWater });
    };

    push(moor.x, wy, moor.z, { yaw: moor.yaw, phase: 'moored', onWater: true });
    // Outbound taxi: leave the pier into open water south of the island, then north along the west channel.
    // (A straight north run at the mooring's x would cut through the island.)
    {
      const side = Math.sign(moor.x - riverX(moor.z)) || -1;
      const zS = moor.z + 18;
      push((moor.x + waterX(moor.z + 10, side)) * 0.5, wy, moor.z + 10, { phase: 'taxi', onWater: true });
      push(waterX(zS, side), wy, zS, { phase: 'taxi', onWater: true });
      for (const z of [42, 24, 6, -14, -34, -58]) push(waterX(z, side), wy, z, { phase: 'taxi', onWater: true });
    }
    { const z0 = pts[pts.length - 1].z, side = Math.sign(moor.x - riverX(moor.z)) || -1;
      for (let i = 1; i <= 8; i++) {
        const u = i / 8, z = z0 - u * 90, x = waterX(z, side);
        const climb = u * u * (3 - 2 * u);
        const y = wy + (flyY(x, z, 32) - wy) * climb;
        push(x, y, z, { phase: 'takeoff', onWater: u < 0.12, holdY: u >= 0.12, pitch: u < 0.55 ? u * 0.3 : 0.3 * (1 - (u - 0.55) / 0.45) });
      }
    }
    {
      const side = Math.sign(moor.x - riverX(moor.z)) || -1;
      for (const z of [-160, -220, -280, -340]) {
        const x = waterX(z, side);
        push(x, flyY(x, z, 32), z, { phase: 'cruise' });
      }
    }
    for (const [x, z] of [[90, -270], [200, -190], [300, -60], [260, 70], [140, 130]]) push(x, flyY(x, z, 34), z, { phase: 'sapphires' });
    // stay over the valley / river rather than clipping a low cut across the island
    for (const [x, z] of [[50, 70], [waterX(16), 16], [waterX(-24), -24]]) push(x, flyY(x, z, 28), z, { phase: 'valley' });
    { const z0 = -72, x0 = waterX(-72), y0 = flyY(x0, z0, 32);
      for (let i = 1; i <= 10; i++) {
        const u = i / 10, a = u * Math.PI * 2;
        const x = x0 - 5 * u, z = z0 - 24 * u, y = y0 + Math.sin(u * Math.PI) * 5;
        push(x, y, z, { phase: 'stunt', up: { x: Math.sin(a), y: Math.cos(a), z: 0 }, holdY: true, agl: 0 });
      }
      const R = 18, zL = z0 - 30, xL = waterX(zL), yB = flyY(xL, zL, 32), yC = yB + R;
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x = xL, y = yC - R * Math.cos(a), z = zL - R * Math.sin(a);
        push(x, y, z, { phase: 'stunt', up: { x: 0, y: Math.cos(a), z: Math.sin(a) }, holdY: true });
      }
    }
    for (const [x, z] of [[-120, -90], [-240, -30], [-340, 70], [-260, 170], [-120, 190]]) push(x, flyY(x, z, 36), z, { phase: 'bitterroots' });
    // Bitterroots already ends south of the island; arrive from there and descend over water
    // heading north toward the pier, so the final never cuts across the island or reverses.
    {
      const side = Math.sign(moor.x - riverX(moor.z)) || -1;
      const mid = [
        [-80, 155],
        [waterX(120, side), 120],
        [waterX(90, side), 90],
        [waterX(70, side), 70],
      ];
      mid.forEach((p, i) => {
        const u = i / (mid.length - 1);
        const y = flyY(p[0], p[1], 32) * (1 - u * 0.45) + (wy + 12) * (u * 0.45);
        push(p[0], Math.max(y, flyY(p[0], p[1], 16), wy + 8), p[1], { phase: 'approach' });
      });
      const zA = moor.z + 48, zB = moor.z + 18;
      for (let i = 1; i <= 6; i++) {
        const u = i / 6, z = zA + (zB - zA) * u;
        const xw = waterX(z, side);
        let x = xw + (moor.x - xw) * Math.min(1, u * 1.05);
        if (!onWater(x, z)) x = xw;
        const y = (wy + 10) * (1 - u) + (wy + 2.0) * u;
        push(x, Math.max(y, wy + 1.8), z, { phase: 'approach', holdY: true, pitch: -0.1 * (1 - u) });
      }
    }
    {
      const side = Math.sign(moor.x - riverX(moor.z)) || -1;
      for (let i = 1; i <= 5; i++) {
        const u = i / 5, z = (moor.z + 18) + ((moor.z + 3) - (moor.z + 18)) * u;
        const xw = waterX(z, side);
        let x = moor.x + (xw - moor.x) * (1 - u) * 0.25;
        if (!onWater(x, z)) x = onWater(moor.x, z) ? moor.x : xw;
        const y = wy + (1 - u) * (1 - u) * 2.2;
        push(x, y, z, { phase: 'land', onWater: true, holdY: true });
      }
    }
    for (let i = 1; i <= 4; i++) {
      const u = i / 4, z = (moor.z + 3) + (moor.z - (moor.z + 3)) * u;
      let x = moor.x;
      if (!onWater(x, z)) x = waterX(z);
      push(x, wy, z, { phase: 'taxi', onWater: true });
    }
    push(moor.x, wy, moor.z, { yaw: moor.yaw, phase: 'moored', onWater: true });
    return pts;
  }
  const PATH = mkPath();
  // segment ranges (u in 0-1 over the whole path), used by the activity steps
  function span(name) {
    let a = -1, b = -1;
    for (let i = 0; i < PATH.length; i++) if (PATH[i].phase === name) { if (a < 0) a = i; b = i; }
    if (a < 0) return null;
    const n = PATH.length - 1;
    return { u0: a / n, u1: Math.min(1, (b + 0.99) / n) };
  }
  const SEG = {};
  for (const n of ['taxi', 'takeoff', 'cruise', 'sapphires', 'valley', 'stunt', 'bitterroots', 'approach', 'land', 'moored']) {
    const s = span(n); if (s) SEG[n] = s;
  }
  // first taxi is outbound (before takeoff); last taxi is the return — split by index around takeoff
  // span() already takes first..last occurrence; 'taxi' appears twice. Fix by splitting:
  { const idxs = PATH.map((p, i) => (p.phase === 'taxi' ? i : -1)).filter((i) => i >= 0);
    const mid = PATH.findIndex((p) => p.phase === 'takeoff');
    const out = idxs.filter((i) => i < mid), home = idxs.filter((i) => i > mid);
    const n = PATH.length - 1;
    if (out.length) SEG.taxi = { u0: out[0] / n, u1: (out[out.length - 1] + 0.99) / n };
    if (home.length) SEG.return = { u0: home[0] / n, u1: (home[home.length - 1] + 0.99) / n };
  }

  function drive(seg, u) {
    const s = SEG[seg] || SEG.cruise; const t = s.u0 + (s.u1 - s.u0) * Math.max(0, Math.min(1, u));
    const p = catmull(PATH, t);
    const du = 0.35 / PATH.length;
    const pa = catmull(PATH, Math.max(0, t - du)), pb = catmull(PATH, Math.min(1, t + du));
    _T.set(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z);
    if (_T.lengthSq() < 1e-10) _T.set(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    _T.normalize();
    _up.set(p.up?.x || 0, p.up?.y || 1, p.up?.z || 0);
    if (_up.lengthSq() < 0.05) _up.set(0, 1, 0);
    _up.normalize();
    if (Math.abs(_up.dot(_T)) > 0.96) { _up.set(0, 1, 0); if (Math.abs(_up.dot(_T)) > 0.96) _up.set(1, 0, 0); }
    if (p.phase !== 'stunt') {
      const pc = catmull(PATH, Math.min(1, t + du * 2));
      const y1 = Math.atan2(pb.x - pa.x, pb.z - pa.z), y2 = Math.atan2(pc.x - pb.x, pc.z - pb.z);
      let dy = y2 - y1; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      _up.applyAxisAngle(_T, Math.max(-0.7, Math.min(0.7, -dy * 8)));
    }
    _right.crossVectors(_up, _T).normalize();
    _up.crossVectors(_T, _right).normalize();
    _m4.makeBasis(_right, _up, _T);
    _qt.setFromRotationMatrix(_m4);
    _eu.setFromQuaternion(_qt, 'YXZ');
    setPose(p.x, p.y, p.z, _eu.y, _eu.x, _eu.z, _qt);
    phase = seg;
    const onWater = p.y < WATER_Y + FLOAT_Y + 1.6;
    wakeOn = onWater && (seg === 'taxi' || seg === 'takeoff' || seg === 'land' || seg === 'return');
    smokeOn = !onWater;
    rpmTarget = seg === 'moored' ? 0 : onWater ? 0.55 + 0.3 * (seg === 'takeoff' ? u : 0.5) : 0.95;
    piloting = true;
    return p;
  }
  function warp(seg, u = 0) { return drive(seg, u); }

  function followCam() {
    // chase from behind-right, using yaw only so a climb or roll doesn't flip the camera overhead
    const s = seatWorld();
    const sy = Math.sin(st.yaw), cy = Math.cos(st.yaw);
    const back = 9.2, up = 2.6, side = 3.4;
    return [s.x - sy * back + cy * side, s.y + up, s.z - cy * back - sy * side, s.x + sy * 1.4, s.y + 0.35, s.z + cy * 1.4];
  }

  function wearGoggles(on) {
    if (!mochi?.pivot) return;
    if (on) {
      if (!goggles.parent) mochi.pivot.add(goggles);
      const off = mochi.slots?.[mochi.style]?.headOffset || 1.35;
      const head = mochi.slots?.[mochi.style]?.head;
      if (head && Array.isArray(head[0])) goggles.position.set(head[0][0], head[0][1] + 0.22, head[0][2] + 0.15);
      else goggles.position.set(0, off - 0.15, 0.22);
      goggles.rotation.set(-0.15, 0, 0);
      goggles.visible = true;
    } else if (goggles.parent) { goggles.parent.remove(goggles); goggles.visible = false; }
  }

  function startEngine() { rpmTarget = 0.4; music?.engine?.(true, 0.4); }
  function stopEngine() { rpmTarget = 0; music?.engine?.(false); }

  function reset() {
    wearGoggles(false); stopEngine(); placeMoor();
  }

  function update(t, dt) {
    if (!cfg.owned) { g.visible = false; pier.visible = false; shadow.visible = false; return; }
    g.visible = true; pier.visible = true;
    sock.rotation.z = Math.sin(t * 2.2) * 0.35; sock.rotation.y = Math.sin(t * 1.4) * 0.2;
    rpm += (rpmTarget - rpm) * Math.min(1, dt * 2.2);
    prop.rotation.z += dt * (rpm * 42 + (phase === 'moored' ? 0 : 4));
    disc.material.opacity = Math.max(0, (rpm - 0.25) * 1.4);
    prop.children.forEach((c) => { if (c !== disc) c.visible = !loaded && rpm < 0.45; });
    if (music?.engine && rpmTarget > 0) music.engine(true, rpm);
    // bob at rest
    if (phase === 'moored' && !piloting) {
      const bob = Math.sin(t * 1.25) * 0.03;
      craft.position.set(moor.x, WATER_Y + FLOAT_Y + bob, moor.z);
      craft.rotation.order = 'YXZ'; craft.rotation.set(Math.sin(t * 1.05) * 0.02, moor.yaw, Math.sin(t * 0.9) * 0.015);
      st.y = craft.position.y; st.yaw = moor.yaw; st.pitch = craft.rotation.x; st.roll = craft.rotation.z;
    }
    // shadow
    const gy = Math.max(WATER_Y + 0.05, terrainH(st.x, st.z) + 0.04, typeof groundY === 'function' ? groundY(st.x, st.z) : -Infinity);
    shadow.position.set(st.x, gy, st.z);
    const h = Math.max(0.2, st.y - gy); shadow.scale.setScalar(1.1 + h * 0.08); shadow.material.opacity = Math.max(0.06, 0.32 - h * 0.006);
    shadow.visible = true;
    // wake
    if (wakeOn) {
      wakeT -= dt; if (wakeT < 0) {
        wakeT = 0.22; const w = wakes.find((q) => q.userData.t > 1.5);
        if (w) { w.visible = true; w.userData.t = 0; w.position.set(st.x - Math.sin(st.yaw) * -1.4, WATER_Y + 0.04, st.z - Math.cos(st.yaw) * -1.4); w.rotation.z = st.yaw + Math.PI; w.material.opacity = 0.4; }
      }
    }
    for (const w of wakes) if (w.visible) { const u = (w.userData.t += dt); w.scale.set(1 + u * 1.8, 1 + u * 1.0, 1); w.material.opacity = Math.max(0, 0.38 * (1 - u / 1.5)); if (u > 1.5) w.visible = false; }
    // contrail puffs
    if (smokeOn) {
      puffT -= dt; if (puffT < 0) {
        puffT = 0.11; const p = puffs.find((q) => q.userData.t > 1.8);
        if (p) { p.visible = true; p.userData.t = 0; const back = 1.7; p.position.set(st.x - Math.sin(st.yaw) * back, st.y + 0.4, st.z - Math.cos(st.yaw) * back); p.scale.setScalar(0.5); p.material.opacity = 0.45; }
      }
    }
    for (const p of puffs) if (p.visible) { const u = (p.userData.t += dt); p.position.y += dt * 0.25; p.scale.setScalar(0.5 + u * 1.4); p.material.opacity = Math.max(0, 0.4 * (1 - u / 1.8)); if (u > 1.8) p.visible = false; }
  }

  const api = {
    group: g, craft, pier, moor, tip, boardPt, land, seatLocal,
    get owned() { return cfg.owned; }, get name() { return cfg.name; }, get color() { return cfg.color; },
    get phase() { return phase; }, get piloting() { return piloting; }, get loaded() { return loaded; },
    get pose() { return st; }, get rpm() { return rpm; },
    seatWorld, followCam, drive, warp, reset, startEngine, stopEngine, wearGoggles, update,
    wake(on) { wakeOn = on; }, smoke(on) { smokeOn = on; },
    setPiloting(v) { piloting = !!v; },
    rideY() { return seatWorld().y; },
    applyPilot(root, brain) {
      if (!piloting) return false;
      const s = seatWorld(); root.position.set(s.x, s.y, s.z);
      if (brain) brain.heading = st.yaw;
      root.rotation.order = 'YXZ'; root.rotation.set(st.pitch, st.yaw, st.roll);
      return true;
    },
  };
  g.visible = cfg.owned; pier.visible = cfg.owned;
  return api;
}
