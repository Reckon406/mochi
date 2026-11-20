// 💕 the girl kiwi across the river: her own TRELLIS scan (public/models/girlkiwi.glb), a little cottage + nest on the far bank,
// a rowboat tied up at Mochi's dock (the 'visit' activity rows him over and back, with a wake), and the relationship.
// STATE: world.crush = { name, stage: 'stranger'|'friend'|'crush'|'dating', affection 0-100, gifts: [], lastVisit } (all optional;
// missing = a stranger called '???'). ?crush=<stage> forces a stage (tests). At 'dating' she comes over and sits on the dock with him.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DOCK, WATER_Y, riverX, riverW } from './layout.js';
import { terrainH } from './landscape.js';

export const STAGES = ['stranger', 'friend', 'crush', 'dating'];
const stageFor = (a) => (a >= 85 ? 'dating' : a >= 60 ? 'crush' : a >= 25 ? 'friend' : 'stranger');
const N = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

// where the boat lands: follow the dock's line out to the far bank, then stop at the waterline
function farBank() {
  let s = 0, x = 0, z = 0; for (s = 4; s < 90; s += 0.25) { x = DOCK.x1 + DOCK.dx * s; z = DOCK.z1 + DOCK.dz * s; if (x < riverX(z) - riverW(z) && terrainH(x, z) > WATER_Y - 0.15) break; }
  return { x, z };
}

function canvasSprite(draw, w = 128, h = 128, sc = 0.5) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false })); s.scale.set(sc * w / h, sc, 1); s.visible = false; return s;
}
const heartPath = (g, cx, cy, r) => { g.beginPath(); g.moveTo(cx, cy + r * 0.9); g.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.6, cy - r * 1.3, cx, cy - r * 0.45); g.bezierCurveTo(cx + r * 0.6, cy - r * 1.3, cx + r * 1.6, cy - r * 0.2, cx, cy + r * 0.9); g.closePath(); };
const heartSprite = (sc = 0.45) => canvasSprite((g, w, h) => { heartPath(g, w / 2, h / 2 + 6, 40); g.fillStyle = '#ff4f86'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(w / 2 - 22, h / 2 - 12, 8, 0, 7); g.fill(); }, 128, 128, sc);

// gift props Mochi carries over in his beak
export function giftMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'flowers') { const stemM = new THREE.MeshStandardMaterial({ color: 0x3f8a3a }); const cols = [0xff6fa8, 0xffd23f, 0xb48cff];
    for (let i = 0; i < 3; i++) { const a = (i - 1) * 0.35; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 5), stemM); st.position.set(Math.sin(a) * 0.05, 0.1, 0); st.rotation.z = -a * 0.6; g.add(st);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.6 })); fl.scale.y = 0.55; fl.position.set(Math.sin(a) * 0.12, 0.23, 0); g.add(fl); } g.rotation.x = 1.2; }
  else if (kind === 'art') { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const q = c.getContext('2d'); q.fillStyle = '#bfe6ff'; q.fillRect(0, 0, 64, 48); q.fillStyle = '#7fc46a'; q.fillRect(0, 32, 64, 16); q.fillStyle = '#8b5a2b'; q.beginPath(); q.ellipse(26, 30, 10, 8, 0, 0, 7); q.fill(); q.fillStyle = '#d9b48a'; q.beginPath(); q.ellipse(40, 31, 8, 7, 0, 0, 7); q.fill(); q.fillStyle = '#ff4f86'; heartPath(q, 33, 14, 6); q.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const fr = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.19, 0.015), new THREE.MeshStandardMaterial({ color: 0xc89a5a })); g.add(fr);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), new THREE.MeshBasicMaterial({ map: t })); pic.position.z = 0.009; g.add(pic); g.rotation.y = Math.PI / 2; }
  else if (kind === 'fish') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0x9fb8c8, metalness: 0.3, roughness: 0.4 })); b.scale.set(1, 0.6, 2.4); g.add(b);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.07, 4), b.material); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.14; g.add(tail); }
  else { const m = new THREE.MeshStandardMaterial({ color: 0xd98a8a, roughness: 0.7 }); for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 5, 10, Math.PI * 1.3), m); w.position.set((i - 1) * 0.03, 0, i * 0.01); w.rotation.set(0.4 * i, i, 0); g.add(w); } }
  return g;
}

export function createCrush(scene, { state, tier = 2 }) {
  const cfg = state.world && typeof state.world.crush === 'object' && state.world.crush ? state.world.crush : null;
  const force = (globalThis.location?.search || '').match(/[?&]crush=(stranger|friend|crush|dating)/);
  let affection = Math.max(0, Math.min(100, N(cfg?.affection, 0)));
  const baseStage = force ? force[1] : STAGES.includes(cfg?.stage) ? cfg.stage : stageFor(affection);
  if (force) affection = Math.max(affection, { stranger: 5, friend: 35, crush: 65, dating: 90 }[force[1]]);
  const name = cfg && cfg.name ? String(cfg.name).slice(0, 24) : '???';
  const gifts = Array.isArray(cfg?.gifts) ? cfg.gifts.slice(-20).map(String) : [];
  const api = { name, gifts, get affection() { return affection; }, lastVisit: cfg?.lastVisit || null, lastResult: null };
  const stageNow = () => { const a = STAGES.indexOf(baseStage), b = STAGES.indexOf(stageFor(affection)); return STAGES[Math.max(a, force ? a : b)]; };
  Object.defineProperty(api, 'stage', { get: stageNow });

  // ── her place on the far bank ──
  const land = farBank();
  const dirx = DOCK.dx, dirz = DOCK.dz; // heading from the island out to her bank
  const home = { x: land.x + dirx * 3.4 - dirz * 2.2, z: land.z + dirz * 3.4 + dirx * 2.2 }; home.y = terrainH(home.x, home.z);
  const homeYaw = Math.atan2(-dirx, -dirz); // she faces back across the river toward Mochi's island
  const place = new THREE.Group(); place.position.set(home.x, home.y, home.z); place.rotation.y = homeYaw; scene.add(place);
  { // cottage: round cream walls, pink cone roof, round door, tiny window, flower bed + twig nest
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 1.25, tier >= 2 ? 18 : 12), new THREE.MeshStandardMaterial({ color: 0xf3e6cf, roughness: 0.9 })); wall.position.set(-1.8, 0.62, -1.4); wall.castShadow = wall.receiveShadow = true; place.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.0, tier >= 2 ? 18 : 12), new THREE.MeshStandardMaterial({ color: 0xe98fae, roughness: 0.8 })); roof.position.set(-1.8, 1.72, -1.4); roof.castShadow = true; place.add(roof);
    const door = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x7b4a2e })); door.position.set(-1.8, 0.02, -1.4 + 0.905); place.add(door);
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffc96a, emissiveIntensity: 0.4 })); win.position.set(-1.8 + 0.55, 0.85, -1.4 + 0.67); win.rotation.y = 0.68; place.add(win); api.window = win;
    const nest = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 8, 18), new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 1 })); nest.rotation.x = -Math.PI / 2; nest.position.set(0.9, 0.08, -0.6); nest.scale.z = 0.7; nest.castShadow = true; place.add(nest);
    const bedM = [0xff6fa8, 0xffd23f, 0xffffff, 0xb48cff].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })); const fg = new THREE.SphereGeometry(0.06, 6, 5);
    for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(fg, bedM[i % 4]); const a = i * 2.4; f.position.set(-0.9 + Math.cos(a) * (0.3 + (i % 3) * 0.12), 0.12, -0.3 + Math.sin(a) * 0.25); place.add(f); }
    for (const m of place.children) { const p = m.position; m.position.y += terrainH(home.x + p.x * Math.cos(homeYaw) + p.z * Math.sin(homeYaw), home.z - p.x * Math.sin(homeYaw) + p.z * Math.cos(homeYaw)) - home.y; }
  }

  // ── her ──
  const her = new THREE.Group(); her.name = 'girlkiwi'; scene.add(her);
  const pivot = new THREE.Group(); her.add(pivot); const body = new THREE.Group(); pivot.add(body);
  const SC = 1.33 * 0.86; // a touch smaller than Mochi
  api.loaded = false;
  { const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
    L.load((import.meta.env?.BASE_URL || '/') + 'models/girlkiwi.glb', (g) => { try {
      const sc = g.scene; sc.scale.setScalar(SC); sc.rotation.y = Math.PI; sc.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(sc); sc.position.y -= bb.min.y;
      sc.traverse((o) => { if (o.isMesh) { const old = o.material; if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); o.material = new THREE.MeshStandardMaterial({ map: old.map, color: new THREE.Color(1.18, 1.14, 1.1), roughness: 0.85, metalness: 0 }); o.castShadow = true; o.receiveShadow = true; } });
      body.add(sc); api.loaded = true; } catch (e) { console.warn('[crush] model failed', e.message); } }, undefined, (e) => console.warn('[crush] model load failed', e?.message || e)); }
  const herHeart = heartSprite(0.42); scene.add(herHeart);
  const shrug = canvasSprite((g, w, h) => { g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.roundRect(4, 14, w - 8, h - 28, 22); g.fill(); g.fillStyle = '#5a4a40'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('¯\\_(ツ)_/¯', w / 2, h / 2 + 2); }, 256, 96, 0.34); scene.add(shrug);
  const tag = canvasSprite((g, w, h) => { g.fillStyle = 'rgba(40,20,30,0.55)'; g.beginPath(); g.roundRect(2, 8, w - 4, h - 16, 18); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, w / 2, h / 2); }, 256, 64, 0.17); tag.visible = true; scene.add(tag);
  // floating hearts for dates
  const hearts = []; for (let i = 0; i < (tier >= 2 ? 8 : 5); i++) { const h = heartSprite(0.22); h.userData.t = 99; scene.add(h); hearts.push(h); }
  let heartsOn = false, heartsAt = new THREE.Vector3(), spawnT = 0;

  // ── the rowboat ──
  const boat = new THREE.Group(); boat.name = 'rowboat'; scene.add(boat);
  { // an open rounded rowboat: a lower half-shell (pointed at the bow), wood inside, white gunwale, a thwart to sit on
    const shell = (r) => { const g = new THREE.SphereGeometry(1, tier >= 2 ? 22 : 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); const t = Math.max(0, z); pa.setXYZ(i, x * 0.62 * r * (1 - 0.72 * t * t), y * 0.42 * r, z * 1.3 * r + (z > 0 ? 0.08 * t : 0)); } g.computeVertexNormals(); return g; };
    const hull = new THREE.Mesh(shell(1), new THREE.MeshStandardMaterial({ color: 0x2f7fb5, roughness: 0.65 })); hull.position.y = 0.32; hull.castShadow = true; boat.add(hull);
    const inner = new THREE.Mesh(shell(0.94), new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.9, side: THREE.BackSide })); inner.position.y = 0.32; boat.add(inner);
    const rimG = new THREE.TorusGeometry(1, 0.045, 6, tier >= 2 ? 40 : 28); rimG.rotateX(Math.PI / 2); { const pa = rimG.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); const t = Math.max(0, z); pa.setX(i, x * 0.6 * (1 - 0.72 * t * t)); pa.setZ(i, z * 1.29 + (z > 0 ? 0.08 * t : 0)); } rimG.computeVertexNormals(); }
    const rim = new THREE.Mesh(rimG, new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.6 })); rim.position.y = 0.33; boat.add(rim);
    const plank = new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.8 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.045, 0.26), plank); seat.position.set(0, 0.24, 0.55); boat.add(seat);
    const seat2 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.045, 0.24), plank); seat2.position.set(0, 0.24, -0.7); boat.add(seat2);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 1.6), plank); floor.position.set(0, 0.03, -0.05); boat.add(floor);
    api.oars = []; for (const s of [-1, 1]) { const o = new THREE.Group(); o.position.set(0.6 * s, 0.36, -0.05); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0xd8b07a })); shaft.rotation.z = Math.PI / 2; shaft.position.x = 0.45 * s; o.add(shaft);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.015, 0.12), shaft.material); blade.position.x = 1.15 * s; o.add(blade); o.rotation.z = -0.35 * s; boat.add(o); api.oars.push(o); }
  }
  const lat = { x: -DOCK.dz, z: DOCK.dx };
  const moor = { x: DOCK.x1 - DOCK.dx * 1.6 + lat.x * (DOCK.w / 2 + 0.75), z: DOCK.z1 - DOCK.dz * 1.6 + lat.z * (DOCK.w / 2 + 0.75) };
  const boardPt = new THREE.Vector3(DOCK.x1 - DOCK.dx * 1.6 + lat.x * 0.35, 0, DOCK.z1 - DOCK.dz * 1.6 + lat.z * 0.35);
  const beach = { x: land.x - dirx * 1.1, z: land.z - dirz * 1.1 };
  const yawOut = Math.atan2(dirx, dirz), yawHome = yawOut + Math.PI;
  const boatState = { x: moor.x, z: moor.z, yaw: yawOut, row: 0, bob: 0 };
  // wake: little V chevrons spawned behind the stern that spread and fade
  const wakeTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const q = c.getContext('2d'); q.strokeStyle = 'rgba(255,255,255,0.75)'; q.lineWidth = 5; q.lineCap = 'round'; q.shadowColor = '#fff'; q.shadowBlur = 8; q.beginPath(); q.moveTo(8, 56); q.lineTo(64, 10); q.lineTo(120, 56); q.stroke(); return new THREE.CanvasTexture(c); })();
  const wakes = []; for (let i = 0; i < (tier >= 2 ? 14 : 9); i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); w.rotation.x = -Math.PI / 2; w.userData.t = 99; w.visible = false; scene.add(w); wakes.push(w); }
  let wakeT = 0, wakeOn = false;

  // where she stands: at home, or (dating) sitting on the dock by the tip
  const dockSeat = new THREE.Vector3(DOCK.x1 - DOCK.dx * 0.55 - lat.x * 0.35, DOCK.y + 0.02, DOCK.z1 - DOCK.dz * 0.55 - lat.z * 0.35);
  const mochiDateSpot = new THREE.Vector3(DOCK.x1 - DOCK.dx * 0.55 + lat.x * 0.4, 0, DOCK.z1 - DOCK.dz * 0.55 + lat.z * 0.4);
  const spot = new THREE.Vector3(); let herYaw = homeYaw, herLook = null;
  function placeHer() { if (stageNow() === 'dating') { spot.copy(dockSeat); herYaw = yawOut; } else { spot.set(home.x + Math.sin(homeYaw) * 0.9, 0, home.z + Math.cos(homeYaw) * 0.9); spot.y = terrainH(spot.x, spot.z); herYaw = homeYaw; } her.position.copy(spot); her.rotation.y = herYaw; }
  placeHer();
  let peckT = 3, peck = 0, hopT = -1, reactT = 0, reactKind = '';

  Object.assign(api, { her, boat, place, home, beach, moor, boardPt, dockSeat, mochiDateSpot, yawOut, yawHome, boatState, landing: land,
    herFront() { const s = her.position; return new THREE.Vector3(s.x + Math.sin(her.rotation.y) * 0.95, 0, s.z + Math.cos(her.rotation.y) * 0.95); },
    lookAt(p) { herLook = p; }, wake(on) { wakeOn = on; },
    react(kind) { reactKind = kind; reactT = 0; if (kind === 'heart') { hopT = 0; herHeart.visible = true; } else { shrug.visible = true; } },
    hearts(on, at) { heartsOn = on; if (at) heartsAt.copy(at); },
    give(kind, good) { gifts.push(kind); if (gifts.length > 20) gifts.shift(); const gain = { flowers: 8, art: 10, worms: 6, fish: 4 }[kind] ?? 3; const d = good ? gain + 3 : Math.max(1, Math.round(gain / 3)); affection = Math.min(100, affection + d); api.lastVisit = new Date().toISOString(); api.lastResult = good ? 'heart' : 'meh'; return d; },
    rideY(x, z) { return terrainH(x, z); },
    update(t, dt, night, mochiPos) {
      // boat: bob at the mooring or wherever the visit put it
      boatState.bob = t; boat.position.set(boatState.x, WATER_Y - 0.13 + Math.sin(t * 1.3) * 0.025, boatState.z); boat.rotation.set(Math.sin(t * 1.1) * 0.02, boatState.yaw, Math.sin(t * 0.9) * 0.03);
      for (const [i, o] of api.oars.entries()) { const s = i ? 1 : -1; const r = boatState.row; o.rotation.set(0, s * (r ? Math.sin(t * 5) * 0.55 : 0.2) * -1, -s * (r ? 0.25 + 0.2 * Math.cos(t * 5) : 0.35)); }
      if (wakeOn) { wakeT -= dt; if (wakeT < 0) { wakeT = 0.28; const w = wakes.find((q) => q.userData.t > 1.6); if (w) { const by = boatState.yaw; w.position.set(boatState.x - Math.sin(by) * 1.25, WATER_Y + 0.03, boatState.z - Math.cos(by) * 1.25); w.rotation.z = by + Math.PI; w.userData.t = 0; w.visible = true; } } }
      for (const w of wakes) if (w.visible) { const u = (w.userData.t += dt); w.scale.set(1 + u * 1.6, 1 + u * 0.9, 1); w.material.opacity = Math.max(0, 0.38 * (1 - u / 1.6)); if (u > 1.6) w.visible = false; }
      // her idle: breathe, pecks at the ground now and then, turns to watch Mochi when he's close
      const near = mochiPos && mochiPos.distanceTo(her.position) < 9;
      let want = herLook ? Math.atan2(herLook.x - her.position.x, herLook.z - her.position.z) : near && stageNow() !== 'dating' ? Math.atan2(mochiPos.x - her.position.x, mochiPos.z - her.position.z) : herYaw;
      let dh = want - her.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); her.rotation.y += dh * Math.min(1, dt * 3);
      peckT -= dt; if (peckT < 0) { peckT = 3 + Math.random() * 5; if (!near && stageNow() !== 'dating') peck = 1; } peck = Math.max(0, peck - dt * 1.4);
      const pk = Math.sin(Math.min(1, peck) * Math.PI); pivot.rotation.x = pk * 0.55; pivot.position.z = pk * 0.08;
      body.scale.set(1 + Math.sin(t * 2.2) * 0.012, 1 - Math.sin(t * 2.2) * 0.015, 1);
      if (hopT >= 0) { hopT += dt; const u = hopT / 0.5; if (u < 2) pivot.position.y = Math.abs(Math.sin(u * Math.PI)) * 0.3; else { hopT = -1; pivot.position.y = 0; } } else pivot.position.y = 0;
      if (reactKind === 'shrug') { const u = reactT; pivot.rotation.z = Math.sin(Math.min(1, u / 1.2) * Math.PI) * 0.18; }
      if (reactKind) { reactT += dt; const top = her.position.y + 1.25; const sp = reactKind === 'heart' ? herHeart : shrug; sp.position.set(her.position.x, top + Math.min(1, reactT) * 0.35, her.position.z); sp.material.opacity = Math.max(0, 1 - Math.max(0, reactT - 1.6) / 0.6); const k = reactKind === 'heart' ? 0.42 * (1 + 0.25 * Math.sin(Math.min(1, reactT * 3) * Math.PI)) : 0.34; sp.scale.set(k * (sp === shrug ? 256 / 96 : 1), k, 1); if (reactT > 2.2) { herHeart.visible = shrug.visible = false; reactKind = ''; pivot.rotation.z = 0; } }
      tag.position.set(her.position.x, her.position.y + 1.3, her.position.z); tag.visible = !reactKind;
      if (api.window) api.window.material.emissiveIntensity = 0.3 + 1.4 * night;
      // date hearts drift up between them
      if (heartsOn) { spawnT -= dt; if (spawnT < 0) { spawnT = 0.45; const h = hearts.find((q) => q.userData.t > 3); if (h) { h.userData.t = 0; h.userData.x = heartsAt.x + (Math.random() - 0.5) * 0.6; h.userData.z = heartsAt.z + (Math.random() - 0.5) * 0.6; h.userData.ph = Math.random() * 6; h.visible = true; } } }
      for (const h of hearts) if (h.visible) { const u = (h.userData.t += dt); h.position.set(h.userData.x + Math.sin(u * 2 + h.userData.ph) * 0.12, heartsAt.y + 0.9 + u * 0.45, h.userData.z); h.material.opacity = Math.min(1, u * 3) * Math.max(0, 1 - u / 3); if (u > 3) h.visible = false; }
    } });
  api.replace = placeHer;
  return api;
}
