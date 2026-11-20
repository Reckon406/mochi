// Stage D: shooting range north of the Lookout Cliff (lane points west, away from the island), the Gun-O-Matic (caps → chunky
// low-poly guns), a wall rack for owned guns, target practice (steel plates, tin cans on a log, clays), ear muffs, and warning
// shots into the air when a bear or lion wades onto the island. Nothing alive is ever hit. Saved in localStorage `mochi.range`.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RANGE, topH, WATER_Y } from './layout.js';
import { plank } from './signs.js';
import { vendFront } from './vending.js';

const LS = 'mochi.range';
export const GUNS = {
  rifle22: { name: '.22 rifle', price: 8, hit: 0.62, emoji: '🎯' },
  revolver: { name: 'revolver', price: 12, hit: 0.5, emoji: '🤠' },
  lever: { name: 'lever-action', price: 15, hit: 0.72, emoji: '🐎' },
  shotgun: { name: 'pump shotgun', price: 18, hit: 0.78, emoji: '🥏', clays: true },
  scoped: { name: 'scoped hunting rifle', price: 25, hit: 0.9, emoji: '🔭' },
};
const ORDER = Object.keys(GUNS);
const today = () => new Date().toLocaleDateString('en-CA');
function tint(g, c) { const n = g.attributes.position.count; const a = new Float32Array(n * 3); const col = new THREE.Color(c); for (let i = 0; i < n; i++) col.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
const merge = (gs) => mergeGeometries(gs);
const vcM = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...o });
const B = (w, h, d, x, y, z, c) => tint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);
const Cy = (r, l, x, y, z, c, seg = 8) => tint(new THREE.CylinderGeometry(r, r, l, seg).rotateX(Math.PI / 2).translate(x, y, z), c); // along z

// chunky guns pointing +z, origin near the grip
function gunGeo(id) {
  const W = 0x8a5a32, Wd = 0x6b4426, S = 0x3a3d44, Br = 0xc8a040;
  if (id === 'revolver') return merge([B(0.05, 0.14, 0.07, 0, -0.06, -0.02, W), B(0.05, 0.06, 0.12, 0, 0.03, 0.04, S), Cy(0.04, 0.07, 0, 0.03, 0.08, S, 6), Cy(0.016, 0.18, 0, 0.045, 0.2, S), B(0.012, 0.03, 0.012, 0, 0.07, 0.27, S)]);
  const g = [B(0.06, 0.1, 0.24, 0, -0.03, -0.2, W), B(0.05, 0.07, 0.16, 0, 0.0, 0.0, id === 'lever' ? Br : S), B(0.045, 0.05, 0.22, 0, -0.025, 0.18, Wd)];
  const bl = id === 'shotgun' ? 0.022 : 0.013, L = id === 'scoped' ? 0.62 : 0.55; g.push(Cy(bl, L, 0, 0.02, 0.06 + L / 2, S));
  if (id === 'shotgun') g.push(B(0.06, 0.05, 0.14, 0, -0.02, 0.3, Wd), Cy(0.016, 0.4, 0, -0.005, 0.25, S));
  if (id === 'lever') g.push(tint(new THREE.TorusGeometry(0.04, 0.008, 4, 10).rotateY(Math.PI / 2).translate(0, -0.06, -0.02), Br));
  if (id === 'scoped') g.push(Cy(0.026, 0.3, 0, 0.085, 0.05, 0x22252a), Cy(0.032, 0.03, 0, 0.085, 0.2, 0x22252a), Cy(0.032, 0.03, 0, 0.085, -0.1, 0x22252a), B(0.02, 0.04, 0.02, 0, 0.055, 0.0, S));
  if (id === 'rifle22') g.push(B(0.012, 0.02, 0.012, 0, 0.04, 0.58, S));
  return merge(g);
}

export function createRange(scene, { life, mochi, say, music, state, getWild }) {
  let D = {}; try { D = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { D = {}; }
  D.guns = [...new Set([...(Array.isArray(D.guns) ? D.guns : []), ...(Array.isArray(state.ownedGuns) ? state.ownedGuns : [])].filter((g) => GUNS[g]))];
  D.capsSpent = +D.capsSpent || 0; D.best = Math.max(+D.best || 0, +state.rangeBest || 0); D.rounds = +D.rounds || 0; D.warnings = +D.warnings || 0;
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) { /* ignore */ } };
  // caps already spent here that Mochi hasn't counted yet (STATE.capsSpent catches up when he copies it into state.json)
  const owed = Math.max(0, D.capsSpent - (+state.capsSpent || 0)); life.inv.caps = Math.max(0, life.inv.caps - owed);
  const C = life.ctl, A = life.A, M = C.M;
  const group = new THREE.Group(); group.name = 'range'; scene.add(group);
  const gy = (x, z) => topH(x, z);
  const Z = RANGE.z, XB = RANGE.bench, XT = RANGE.tgt;

  // ── static: fence, bench, berm, log, plate stands, clay thrower, rack board, vending body → one vertex-coloured mesh ──
  const sg = []; const put = (geo, x, z, yo = 0) => sg.push(geo.translate(x, gy(x, z) + yo, z));
  const FW = 0x9c7048, POST = 0x6b4a30;
  const x0 = XT - 1.3, x1 = XB + 1.6, z0 = Z - 3.1, z1 = Z + 3.1;
  for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 7) for (const z of [z0, z1]) { put(B(0.09, 0.85, 0.09, 0, 0.35, 0, POST), x, z); if (x < x1 - 0.1) { const L = (x1 - x0) / 7; for (const h of [0.35, 0.65]) put(B(L, 0.06, 0.04, L / 2, h, 0, FW), x, z); } }
  for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / 4) { put(B(0.09, 0.85, 0.09, 0, 0.35, 0, POST), x0, z); if (z < z1 - 0.1) { const L = (z1 - z0) / 4; for (const h of [0.35, 0.65]) put(B(0.04, 0.06, L, 0, h, L / 2, FW), x0, z); } }
  put(B(0.6, 0.06, 1.7, 0, 0.72, 0, 0xa8794c), XB, Z); for (const dz of [-0.7, 0.7]) put(B(0.5, 0.72, 0.08, 0, 0.36, dz, POST), XB, Z); // shooting table
  put(tint(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 1.15, 3.0), 0x7a6046), XT - 1.0, Z); // earth berm behind the targets
  put(tint(new THREE.CylinderGeometry(0.16, 0.18, 1.5, 8).rotateX(Math.PI / 2), 0x7d5634), XT + 0.1, Z + 1.35, 0.16); // can log
  const plateZ = [Z - 1.5, Z - 0.6, Z + 0.3]; for (const pz of plateZ) put(B(0.06, 0.55, 0.06, 0, 0.27, 0, 0x55585e), XT - 0.12, pz);
  const TX = RANGE.x - 1.6, TZ = Z - 2.2; put(B(0.45, 0.3, 0.45, 0, 0.15, 0, 0x4f6b3a), TX, TZ); put(B(0.1, 0.3, 0.1, 0, 0.42, 0, 0x3a3d44), TX, TZ); put(B(0.5, 0.05, 0.12, -0.2, 0.6, 0, 0x3a3d44), TX, TZ);
  const RX = XB + 0.2, RZ = Z + 2.4; put(B(1.3, 0.9, 0.08, 0, 0.95, 0, 0x8a603a), RX, RZ); for (const dx of [-0.6, 0.6]) put(B(0.09, 1.5, 0.09, dx, 0.65, 0.06, POST), RX, RZ); put(B(1.4, 0.06, 0.18, 0, 1.43, 0, 0x6b4426), RX, RZ);
  for (let i = 0; i < 5; i++) put(B(0.04, 0.04, 0.1, -0.5 + i * 0.25, 0.65, -0.07, 0x3a2a20), RX, RZ);
  const VX = XB + 0.4, VZ = Z - 2.5; // Gun-O-Matic (Cap-O-Matic styling, olive + brass)
  put(B(0.9, 1.7, 0.6, 0, 0.85, 0, 0x4f6b3a), VX, VZ); put(B(0.96, 0.12, 0.66, 0, 1.74, 0, 0xf2c23a), VX, VZ); put(B(0.3, 0.16, 0.1, -0.12, 0.35, 0.3, 0x2a2a2a), VX, VZ);
  for (let i = 0; i < 5; i++) put(B(0.1, 0.04, 0.02, -0.2 + (i % 3) * 0.2, 0.95 + Math.floor(i / 3) * 0.22, 0.2, 0x3a3d44), VX, VZ);
  const stat = new THREE.Mesh(merge(sg), vcM()); stat.castShadow = true; stat.receiveShadow = true; group.add(stat);
  // vending: rotate the face toward the lane entrance (+z faces the bench side) - built facing +z already
  const gunItems = ORDER.map((id, i) => ({ label: GUNS[id].name, price: GUNS[id].price + ' caps', kind: 'gun', color: ['#f2c23a', '#c9b6ff', '#5ac26a', '#ff8a3c', '#4fb3e8'][i % 5], sold: D.guns.includes(id) })).concat([{ label: 'ear muffs', price: 'free', kind: 'bag', color: '#4f6b3a' }]);
  const VF = vendFront({ title: 'GUN-O-MATIC', sub: 'caps for boomsticks', items: gunItems, cols: 3, rows: 2, header: '#4f6b3a', display: (Number.isFinite(+state?.caps) ? +state.caps + ' CAPS' : 'A1 ?') });
  VF.group.position.set(VX, gy(VX, VZ), VZ); group.add(VF.group); const vglowM = VF.glowM;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2c23a, metalness: 0.5, roughness: 0.4 })); knob.position.set(VX + 0.3, gy(VX, VZ) + 0.62, VZ + 0.33); group.add(knob);


  const rsign = plank(['RANGE'], { width: 0.9, icon: '🎯', tone: 'oak', seed: 92 }); rsign.position.set(x1 + 0.05, gy(x1, z1) + 1.15, z1 + 0.05); rsign.rotation.y = Math.PI / 2; group.add(rsign);
  const rules = plank(['ear muffs on', 'only shoot steel'], { width: 0.8, tone: 'pine', hand: true, seed: 93 }); rules.position.set(RX, gy(RX, RZ) + 1.25, RZ - 0.05); rules.rotation.y = Math.PI; group.add(rules);

  // ── guns (rack + held) ──
  const gunM = vcM({ roughness: 0.55, metalness: 0.15 }); const GG = {}; for (const id of ORDER) GG[id] = gunGeo(id);
  const rack = {}; ORDER.forEach((id, i) => { const m = new THREE.Mesh(GG[id], gunM); m.position.set(RX + 0.5 - i * 0.25, gy(RX, RZ) + 0.62, RZ - 0.11); m.rotation.set(-Math.PI / 2 + 0.06, 0, 0); m.scale.setScalar(1.15); m.visible = false; m.castShadow = true; group.add(m); rack[id] = m; });
  const refreshRack = () => { for (const id of ORDER) rack[id].visible = D.guns.includes(id); };
  refreshRack();
  const held = new THREE.Mesh(GG.rifle22, gunM); held.castShadow = true; held.visible = false; held.position.set(0.48, 0.42, 0.42); (mochi.slots?.side || mochi.pivot).add(held);
  const flash = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6).rotateX(Math.PI / 2).translate(0, 0, 0.11), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })); flash.visible = false; held.add(flash);
  let flashT = 0;
  const tipZ = { revolver: 0.3, rifle22: 0.6, lever: 0.62, shotgun: 0.62, scoped: 0.68 };
  function equip(id, pitch = 0) { held.geometry = GG[id]; held.visible = true; held.rotation.set(-pitch, 0, 0); flash.position.set(0, 0.02, tipZ[id]); }
  function unequip() { held.visible = false; flash.visible = false; }
  // ear muffs on the pivot (band over the top + two orange cups)
  const muffs = new THREE.Mesh(merge([tint(new THREE.TorusGeometry(0.56, 0.025, 5, 16, Math.PI).translate(0, 0.6, -0.08), 0x333338),
    tint(new THREE.CylinderGeometry(0.14, 0.14, 0.09, 12).rotateZ(Math.PI / 2).translate(0.56, 0.6, -0.08), 0xe0662a), tint(new THREE.CylinderGeometry(0.14, 0.14, 0.09, 12).rotateZ(Math.PI / 2).translate(-0.56, 0.6, -0.08), 0xe0662a)]), vcM({ roughness: 0.5 }));
  muffs.visible = false; (mochi.slots?.head || mochi.pivot).add(muffs);
  function bang() { flash.visible = true; flashT = 0.07; flash.rotation.z = Math.random() * 3; music?.sfx?.('bang'); }

  // ── targets: 3 steel plates (hinge back), 5 cans on the log, clays from the thrower ──
  const steelM = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.6, roughness: 0.35 });
  const plates = plateZ.map((pz, i) => { const pv = new THREE.Group(); pv.position.set(XT - 0.12, gy(XT, pz) + 0.5, pz); group.add(pv); const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2 - i * 0.03, 0.2 - i * 0.03, 0.03, 16).rotateZ(Math.PI / 2).translate(0.03, 0.22 - i * 0.03, 0), steelM); disc.castShadow = true; pv.add(disc); return { pv, down: 0, a: 0 }; });
  const canM = vcM({ metalness: 0.4, roughness: 0.4 }); const canCols = [0xd23c3c, 0x4fb3e8, 0xf2c23a, 0x5ac26a, 0xd23c3c];
  const canGeo = (c) => merge([tint(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 10), c), tint(new THREE.CylinderGeometry(0.056, 0.056, 0.02, 10).translate(0, 0.06, 0), 0xc8c8d0)]);
  const logTop = gy(XT + 0.1, Z + 1.35) + 0.16 + 0.17 + 0.07;
  const cans = canCols.map((c, i) => { const m = new THREE.Mesh(canGeo(c), canM); const home = new THREE.Vector3(XT + 0.1, logTop, Z + 0.8 + i * 0.27); m.position.copy(home); m.castShadow = true; group.add(m); return { m, home, v: null, t: 0, down: false }; });
  const clayM = new THREE.MeshStandardMaterial({ color: 0xf07a2a, roughness: 0.6 }); const clay = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.035, 12), clayM); clay.visible = false; group.add(clay);
  const shards = []; for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.04, 0), clayM); s.visible = false; group.add(s); shards.push({ m: s, v: new THREE.Vector3(), t: 0 }); }
  let clayFly = null;
  function knock(kind) {
    if (kind === 'plate') { const up = plates.filter((p) => !p.down); if (!up.length) return false; const p = up[Math.floor(Math.random() * up.length)]; p.down = 1; music?.sfx?.('ping'); return true; }
    if (kind === 'can') { const up = cans.filter((c) => !c.down); if (!up.length) return false; const c = up[Math.floor(Math.random() * up.length)]; c.down = true; c.v = new THREE.Vector3(-1.2 - Math.random(), 2.2 + Math.random(), (Math.random() - 0.5) * 1.2); c.t = 0; music?.sfx?.('tink'); return true; }
    return false;
  }
  function throwClay() { clayFly = { t: 0, p: new THREE.Vector3(TX - 0.3, gy(TX, TZ) + 0.6, TZ), v: new THREE.Vector3(-3.2, 4.2, 1.6 + Math.random()) }; clay.position.copy(clayFly.p); clay.visible = true; music?.sfx?.('thunk'); }
  function burstClay() { if (!clayFly) return; const p = clay.position; shards.forEach((s) => { s.m.position.copy(p); s.v.set((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3); s.t = 0; s.m.visible = true; }); clay.visible = false; clayFly = null; music?.sfx?.('clay'); }
  function resetTargets() { plates.forEach((p) => (p.down = 0)); cans.forEach((c) => { c.down = false; c.v = null; c.m.position.copy(c.home); c.m.rotation.set(0, 0, 0); c.m.visible = true; }); }

  // ── activities ──
  const affordable = () => ORDER.filter((id) => !D.guns.includes(id) && GUNS[id].price <= life.inv.caps);
  const benchSpot = () => new THREE.Vector3(XB + 0.62, 0, Z + (Math.random() - 0.5) * 0.6);
  const LANE = -Math.PI / 2; // facing -x, down the lane
  const BUY = { rifle22: 'a .22! tiny gun for a tiny bird. responsible plinking only', revolver: 'a revolver. i feel like a cowboy. a cowbird', lever: 'lever-action. chk-chk. i have wanted to say chk-chk my whole life', shotgun: 'pump shotgun. for clays. CLAYS ONLY. the clays had it coming', scoped: 'a scope. i can see the whales from here. (i cannot)' };
  A.gunshop = { zone: 'range', label: '🔫 Gun-O-Matic', ok: () => affordable().length > 0, steps: [
    { d: 2.0, start() { C.go(new THREE.Vector3(VX, 0, VZ + 0.95)); C.face(Math.PI); } },
    { d: 2.2, start() { const can = affordable(); if (!can.length) { this.no = true; say(`${life.inv.caps} caps. the Gun-O-Matic says no. it says it with lights`, 2.6); return; } this.id = can[0]; const g = GUNS[this.id];
        life.inv.caps -= g.price; D.capsSpent += g.price; save(); say(`${g.price} caps in. ${g.name} please. pleaseplease`, 2.2); }, tick(u, dt) { if (!this.no) { knob.rotation.z += dt * 7; vglowM.emissiveIntensity = 0.6 + Math.sin(u * 40) * 0.5; } } },
    { d: 2.6, start() { if (this.no) return; D.guns.push(this.id); D.log = [...(D.log || []), { gun: this.id, caps: GUNS[this.id].price, date: today() }].slice(-20); save(); refreshRack(); equip(this.id, 0.9); mochi.hop(0.8); mochi.flap(1); say(`GOT: ${BUY[this.id]}`, 3.2);
        life.encounters.push({ animal: GUNS[this.id].name, at: 'Gun-O-Matic', outcome: `bought for ${GUNS[this.id].price} caps`, date: today() }); }, end() { unequip(); vglowM.emissiveIntensity = 0.6; C.face(null); } } ] };
  const SCORE = (s, n) => s === n ? `${s}/${n}. PERFECT. i am a legend. i will be humble about it tomorrow` : s >= n * 0.7 ? `${s}/${n}! steady beak, steady bird` : s >= n * 0.4 ? `${s}/${n}. respectable. the cans are laughing a little` : `${s}/${n}. the targets are safe today. so is everyone. good`;
  A.shoot = { zone: 'range', label: '🎯 target practice', ok: () => D.guns.length > 0, steps: [
    { d: 2.2, start() { C.go(benchSpot()); C.face(LANE); } },
    { d: 1.2, start() { if (!D.guns.length) { this.no = true; return; } this.id = D.guns[Math.floor(Math.random() * D.guns.length)]; muffs.visible = true; equip(this.id, 0.02); resetTargets(); say(`ear muffs on. ${GUNS[this.id].name}. ${GUNS[this.id].clays ? 'PULL!' : 'eyes on the steel'}`, 2.2); } },
    { d: 9.6, start() { this.n = 0; this.hits = 0; this.next = 0.3; this.N = 8; },
      tick(u, dt) { if (this.no) return; C.face(LANE); C.pose.peck = 0.05; this.next -= dt; const g = GUNS[this.id];
        if (g.clays) { if (!clayFly && this.n < this.N && this.next < 0.4 && !this.thrown) { throwClay(); this.thrown = true; } if (clayFly && clayFly.t > 0.45 && this.next < 0) { bang(); this.n++; this.thrown = false; this.next = 1.1; if (Math.random() < g.hit) { burstClay(); this.hits++; } } return; }
        if (this.next < 0 && this.n < this.N) { bang(); this.n++; this.next = 1.05; if (Math.random() < g.hit) { const k = Math.random() < 0.5 ? 'plate' : 'can'; if (knock(k) || knock(k === 'plate' ? 'can' : 'plate')) this.hits++; } } } },
    { d: 2.6, start() { if (this.no) return; unequip(); muffs.visible = false; D.rounds++; const best = this.hits > D.best; if (best) D.best = this.hits; save(); mochi.hop(0.6); say(SCORE(this.hits, this.N) + (best ? ' (new best!)' : ''), 3.2); life.encounters.push({ animal: 'target practice', at: 'range', outcome: `${this.hits}/${this.N} with the ${GUNS[this.id].name}`, date: today() }); },
      end() { C.face(null); C.pose.peck = 0; setTimeout(resetTargets, 2500); } } ],
    onCancel() { unequip(); muffs.visible = false; } };
  A.window = { zone: 'range', label: '🪟 window shopping', ok: () => !D.guns.length && !affordable().length, steps: [
    { d: 2.0, start() { C.go(new THREE.Vector3(VX, 0, VZ + 0.95)); C.face(Math.PI); } },
    { d: 4.0, start() { const c = ORDER.find((id) => !D.guns.includes(id)); say(c ? `the ${GUNS[c].name} is ${GUNS[c].price} caps. i have ${life.inv.caps}. i will just. look at it` : 'i have all of them. i am the gun-o-matic now', 3); }, end() { C.face(null); } } ] };
  life.BY_ZONE.range = ['shoot', 'shoot', 'gunshop', 'window'];
  life.KEYS.unshift([/shooting|target practice|range\b|plinking|clays?\b/, 'shoot'], [/gun-o-matic|buy (a )?gun/, 'gunshop']);

  // ── warning shots (hooked into wildlife defend): gun up, two shots into the sky, the animal startles and leaves ──
  const warn = {
    can: () => D.guns.length > 0,
    start() { const id = D.guns.includes('shotgun') ? 'shotgun' : D.guns.includes('lever') ? 'lever' : D.guns[D.guns.length - 1]; this.id = id; muffs.visible = true; equip(id, 1.05); this.shots = 0; },
    tick(e, dt) { const due = e.dt > 0.9 + this.shots * 1.1 && this.shots < 2; if (due) { this.shots++; bang(); mochi.hop(0.25); return true; } return false; },
    end() { unequip(); muffs.visible = false; D.warnings++; save(); },
  };
  const w = getWild?.(); if (w) w.warnShot = warn;

  function update(t, dt, night) {
    if (flashT > 0) { flashT -= dt; if (flashT <= 0) flash.visible = false; }
    for (const p of plates) { const tgt = p.down ? -1.35 : 0; p.a += (tgt - p.a) * Math.min(1, dt * (p.down ? 12 : 4)); p.pv.rotation.z = -p.a; }
    for (const c of cans) if (c.v) { c.t += dt; c.v.y -= 9.8 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += dt * 9; c.m.rotation.z += dt * 6; const g = gy(c.m.position.x, c.m.position.z) + 0.05; if (c.m.position.y < g) { c.m.position.y = g; c.v = null; c.m.rotation.set(Math.PI / 2, 0, Math.random() * 3); } }
    if (clayFly) { clayFly.t += dt; clayFly.v.y -= 6 * dt; clayFly.p.addScaledVector(clayFly.v, dt); clay.position.copy(clayFly.p); clay.rotation.y += dt * 12; if (clayFly.p.y < WATER_Y || clayFly.t > 2.5) { clay.visible = false; clayFly = null; } }
    for (const s of shards) if (s.m.visible) { s.t += dt; s.v.y -= 9.8 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += dt * 8; if (s.t > 1.2) s.m.visible = false; }
    vglowM.emissiveIntensity = Math.max(vglowM.emissiveIntensity, 0.4 + night * 2);
  }
  function stateFields() { return { ownedGuns: [...D.guns], capsSpent: D.capsSpent, rangeBest: D.best, rangeRounds: D.rounds, warningShots: D.warnings }; }
  return { group, update, data: D, stateFields, warn, plates, cans, throwClay, burstClay, knock, resetTargets, equip, unequip, muffs, held, bang, refreshRack, get caps() { return life.inv.caps; } };
}
