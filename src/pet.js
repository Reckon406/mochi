// 🐾 Mochi's pet. Default: a little grey tabby cat (TRELLIS scan, public/models/cat.glb); other kinds are small stylised critters.
// It wanders up, hangs out near Mochi, naps in sunny spots, and sometimes trots after him. Mochi names it.
// STATE: world.pet = { kind: 'cat'|'pika'|'chipmunk'|'bunny'|'hedgehog', name, mood: 'happy'|'sleepy'|'playful'|'grumpy'|... } (all optional).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { groundY, OBSTACLES, islandRadius, ZONES } from './layout.js';

const KINDS = { pika: { c: 0xb59a7a, ear: 'round', s: 0.75 }, chipmunk: { c: 0xa8683a, ear: 'round', s: 0.75, stripes: true, tail: 'bushy' }, bunny: { c: 0xe8e2d8, ear: 'long', s: 0.95, tail: 'puff' }, hedgehog: { c: 0x8a6a4e, ear: 'round', s: 0.8, spikes: true }, cat: { c: 0x8f9296, ear: 'pointy', s: 1, tail: 'long' } };

function stylised(kind) { // fallback / non-cat pets: a soft round critter
  const K = KINDS[kind] || KINDS.cat; const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: K.c, roughness: 0.9 }), dk = new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.4 }), pk = new THREE.MeshStandardMaterial({ color: 0xf2a0a8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), m); body.scale.set(1, 0.85, 1.25); body.position.y = 0.16; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), m); head.position.set(0, 0.3, 0.17); g.add(head);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), dk); e.position.set(0.045 * s, 0.33, 0.275); g.add(e);
    const ear = K.ear === 'long' ? new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.14, 4, 8), m) : K.ear === 'pointy' ? new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 6), m) : new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), m);
    ear.position.set(0.07 * s, K.ear === 'long' ? 0.47 : 0.41, 0.15); ear.rotation.z = -0.25 * s; g.add(ear); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 5), pk); nose.position.set(0, 0.3, 0.29); g.add(nose);
  if (K.spikes) { const sg = new THREE.ConeGeometry(0.02, 0.08, 4); for (let i = 0; i < 26; i++) { const a = i * 2.4, b = 0.3 + (i % 5) * 0.22; const sp = new THREE.Mesh(sg, dk); const d = new THREE.Vector3(Math.cos(a) * Math.sin(b * 1.4), Math.cos(b * 1.4), -Math.abs(Math.sin(a)) * 0.6 - 0.2).normalize(); sp.position.copy(d).multiply(new THREE.Vector3(0.17, 0.145, 0.21)).add(body.position); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); g.add(sp); } }
  if (K.stripes) for (const s of [-1, 0, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.3), dk); st.position.set(0.06 * s, 0.305, -0.02); g.add(st); }
  if (K.tail) { const t = K.tail === 'puff' ? new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff })) : new THREE.Mesh(new THREE.CapsuleGeometry(K.tail === 'bushy' ? 0.05 : 0.025, 0.22, 4, 8), m); t.position.set(0, 0.22, -0.24); t.rotation.x = K.tail === 'puff' ? 0 : -0.7; g.add(t); }
  g.scale.setScalar(K.s); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g;
}

export function createPet(scene, { state, tier = 2 }) {
  const cfg = state.world && typeof state.world.pet === 'object' && state.world.pet ? state.world.pet : {};
  const kind = KINDS[cfg.kind] ? cfg.kind : 'cat';
  const name = cfg.name ? String(cfg.name).slice(0, 20) : null;
  const mood = String(cfg.mood || 'happy').toLowerCase().slice(0, 16);
  const root = new THREE.Group(); root.name = 'pet'; scene.add(root);
  const hop = new THREE.Group(); root.add(hop); const body = new THREE.Group(); hop.add(body);
  let model = null;
  if (kind === 'cat') { const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
    L.load((import.meta.env?.BASE_URL || '/') + 'models/cat.glb', (g) => { try { const sc = g.scene; sc.scale.setScalar(0.44); sc.rotation.y = 0; /* this scan already faces +z */ sc.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(sc); sc.position.y -= bb.min.y;
      sc.traverse((o) => { if (o.isMesh) { if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); o.material = new THREE.MeshStandardMaterial({ map: o.material.map, color: new THREE.Color(1.5, 1.47, 1.44), roughness: 0.9, metalness: 0 }); o.castShadow = true; o.receiveShadow = true; } });
      if (model) body.remove(model); model = sc; body.add(sc); api.loaded = true; } catch (e) { console.warn('[pet] model failed', e.message); } }, undefined, (e) => console.warn('[pet] model load failed', e?.message || e)); }
  model = stylised(kind); body.add(model); // shows at once; the cat scan replaces it when it lands
  // name tag + nap z's
  const mkSprite = (draw, w, h, sc) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false })); s.scale.set(sc * w / h, sc, 1); return s; };
  const label = name || `new ${kind}`;
  const tag = mkSprite((g, w, h) => { g.fillStyle = 'rgba(30,30,40,0.5)'; g.beginPath(); g.roundRect(2, 8, w - 4, h - 16, 18); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🐾 ' + label, w / 2, h / 2); }, 256, 64, 0.13); scene.add(tag);
  const zz = mkSprite((g, w, h) => { g.fillStyle = '#fff'; g.strokeStyle = 'rgba(40,40,80,0.6)'; g.lineWidth = 4; g.font = 'bold 44px sans-serif'; g.strokeText('z', 10, 70); g.fillText('z', 10, 70); g.font = 'bold 30px sans-serif'; g.strokeText('z', 48, 40); g.fillText('z', 48, 40); }, 96, 96, 0.22); zz.visible = false; scene.add(zz);

  // sunny nap spots: open meadow, the picnic lawn, by the pond, on the dock planks, by the hut door
  const spotOf = (id) => ZONES.find((z) => z.id === id)?.spot; const naps = ['meadow', 'picnic', 'pond', 'hut', 'shop', 'garden'].map(spotOf).filter(Boolean).map((p) => new THREE.Vector3(p[0] + 0.9, 0, p[1] - 0.6));
  const clear = (x, z) => { const r = Math.hypot(x, z); if (r > islandRadius(Math.atan2(z, x)) - 2.5) return false; for (const o of OBSTACLES) if (Math.hypot(x - o.x, z - o.z) < o.r + 0.35) return false; return true; };
  const st = { mode: 'hang', t: 0, tgt: new THREE.Vector3(), speed: 0, yaw: 0, nap: 0, gait: 0, follow: false };
  const W = { happy: { hang: 0.45, follow: 0.3, nap: 0.25 }, playful: { hang: 0.35, follow: 0.5, nap: 0.15 }, sleepy: { hang: 0.25, follow: 0.1, nap: 0.65 }, grumpy: { hang: 0.15, follow: 0.05, nap: 0.4 } }[mood] || { hang: 0.4, follow: 0.3, nap: 0.3 };
  const params = new URLSearchParams(globalThis.location?.search || ''); const forced = params.get('pet'); // ?pet=nap|follow|hang (tests)
  // start somewhere near Mochi
  let placed = false;
  if (forced) st.mode = forced;
  const api = { root, kind, name, mood, loaded: false, get mode() { return st.mode; },
    setMode(m) { st.mode = m; st.t = 0; },
    update(t, dt, night, mochiPos, mochiMoving) {
      if (!placed && mochiPos) { placed = true; let x = mochiPos.x + 2.2, z = mochiPos.z + 1.2; for (let i = 0; i < 12 && !clear(x, z); i++) { x = mochiPos.x + Math.cos(i) * 2.5; z = mochiPos.z + Math.sin(i) * 2.5; } root.position.set(x, groundY(x, z), z); }
      const p = root.position; st.t += dt;
      // decide what to do next
      const dM = mochiPos ? Math.hypot(mochiPos.x - p.x, mochiPos.z - p.z) : 99;
      if (st.t > (st.mode === 'nap' ? 40 : 14) || (st.mode === 'follow' && !mochiMoving && st.t > 6 && dM < 2)) {
        const r = Math.random(); const sleepy = night > 0.6 ? 0.3 : 0;
        st.mode = forced || (r < W.nap + sleepy ? 'nap' : r < W.nap + sleepy + W.follow ? 'follow' : r < W.nap + sleepy + W.follow + W.hang ? 'hang' : 'wander'); st.t = 0; st.tgt.set(NaN, 0, 0);
      }
      if (mochiMoving && dM > 3 && st.mode === 'hang' && Math.random() < dt * 0.4) { st.mode = 'follow'; st.t = 0; }
      // pick a target for the mode
      let want = null, run = 1;
      if (st.mode === 'follow' && mochiPos) { if (dM > 1.3) { want = new THREE.Vector3(mochiPos.x, 0, mochiPos.z); run = dM > 4 ? 1.9 : 1.2; } }
      else if (st.mode === 'hang' && mochiPos) { if (dM > 2.2 || isNaN(st.tgt.x)) { const a = Math.random() * 6.28; const x = mochiPos.x + Math.cos(a) * 1.4, z = mochiPos.z + Math.sin(a) * 1.4; if (clear(x, z)) st.tgt.set(x, 0, z); } if (!isNaN(st.tgt.x)) want = st.tgt; }
      else if (st.mode === 'nap') { if (isNaN(st.tgt.x)) { const q = naps.slice().sort((a, b) => a.distanceTo(p) - b.distanceTo(p))[Math.floor(Math.random() * 2)] || naps[0]; st.tgt.copy(q); } want = st.tgt; }
      else { if (isNaN(st.tgt.x) || Math.hypot(st.tgt.x - p.x, st.tgt.z - p.z) < 0.3) { for (let i = 0; i < 8; i++) { const c = mochiPos || p; const a = Math.random() * 6.28, d = 2 + Math.random() * 5; const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d; if (clear(x, z)) { st.tgt.set(x, 0, z); break; } } } want = st.tgt; run = 0.8; }
      let moving = 0;
      if (want && !isNaN(want.x)) { const dx = want.x - p.x, dz = want.z - p.z, d = Math.hypot(dx, dz); const stop = st.mode === 'follow' ? 1.2 : 0.15;
        if (d > stop) { const sp = Math.min(d - stop, dt * 1.6 * run); const nx = p.x + dx / d * sp, nz = p.z + dz / d * sp; if (clear(nx, nz) || !clear(p.x, p.z)) { p.x = nx; p.z = nz; moving = run; } else { st.tgt.set(NaN, 0, 0); } st.yaw = Math.atan2(dx, dz); } }
      const napping = st.mode === 'nap' && !moving && want && Math.hypot(want.x - p.x, want.z - p.z) < 0.4;
      if (!moving && !napping && mochiPos && dM < 4) st.yaw = Math.atan2(mochiPos.x - p.x, mochiPos.z - p.z);
      let dh = st.yaw - root.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); root.rotation.y += dh * Math.min(1, dt * 6);
      p.y = groundY(p.x, p.z);
      // trot = little bounces; nap = curl down low and breathe slow
      st.gait = moving ? st.gait + dt * (8 + 5 * moving) : 0; st.nap += ((napping ? 1 : 0) - st.nap) * Math.min(1, dt * 2);
      hop.position.y = moving ? Math.abs(Math.sin(st.gait)) * 0.05 : 0; hop.rotation.x = moving ? Math.sin(st.gait * 2) * 0.06 : 0;
      const br = Math.sin(t * (napping ? 1.3 : 2.4)) * (napping ? 0.03 : 0.012);
      body.scale.set(1 + st.nap * 0.18 + br, 1 - st.nap * 0.42 + br, 1 + st.nap * 0.1); body.rotation.z = st.nap * 0.25; body.position.y = 0;
      zz.visible = st.nap > 0.6; if (zz.visible) zz.position.set(p.x + 0.15, p.y + 0.45 + 0.06 * Math.sin(t * 1.5), p.z); zz.material.opacity = st.nap;
      tag.position.set(p.x, p.y + 0.6 - st.nap * 0.2, p.z); tag.visible = !napping;
    } };
  return api;
}
