// Stage C: raft day trips to the far bank (finds shelf), recurring named visitors (friendship), and a tap-to-tune radio.
// Saved in localStorage `mochi.adv`; STATE.finds / STATE.friends (if Mochi writes them) are merged in (higher count wins).
import * as THREE from 'three';
import { DOCK, WATER_Y, MUSIC, groundY, islandRadius, OBSTACLES } from './layout.js';
import { terrainH } from './landscape.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const mergeSimple = (gs) => mergeGeometries(gs.map((g) => (g.index ? g : g)));
import { plank } from './signs.js';

const LS = 'mochi.adv';
export const FIND_KINDS = { pinecone: { name: 'pinecone', emoji: '🌲', w: 40 }, feather: { name: 'feather', emoji: '🪶', w: 30 }, rock: { name: 'mystery rock', emoji: '🪨', w: 20 }, antler: { name: 'antler shed', emoji: '🦌', w: 10 } };
export const FRIENDS = { capybara: { name: 'Capybara', emoji: '🦫', where: 'hot tub' }, petrel: { name: 'Diving-petrel', emoji: '🐦', where: 'the burrow' }, fox: { name: 'Red fox', emoji: '🦊', where: 'the riverbank' } };
const LEVELS = [[0, 'stranger'], [1, 'acquaintance'], [4, 'pal'], [10, 'friend'], [20, 'best friend'], [40, 'ride or die']];
const level = (n) => { let l = LEVELS[0][1]; for (const [k, v] of LEVELS) if (n >= k) l = v; return l; };
const today = () => new Date().toLocaleDateString('en-CA');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function load(state) {
  let d = {}; try { d = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { d = {}; }
  const out = { finds: {}, findLog: Array.isArray(d.findLog) ? d.findLog.slice(-30) : [], friends: {}, trips: +d.trips || 0, station: +d.station || 0 };
  for (const k in FIND_KINDS) out.finds[k] = Math.max(+d.finds?.[k] || 0, +state.finds?.[k] || +state.finds?.[FIND_KINDS[k].name] || 0);
  for (const k in FRIENDS) { const sf = state.friends?.[k] ?? state.friends?.[FRIENDS[k].name.toLowerCase()]; const ss = typeof sf === 'object' ? +sf?.score || 0 : +sf || 0;
    out.friends[k] = { score: Math.max(+d.friends?.[k]?.score || 0, ss), last: d.friends?.[k]?.last || null }; }
  return out;
}
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
function tint(g, c) { const n = g.attributes.position.count; const a = new Float32Array(n * 3); const col = new THREE.Color(c); for (let i = 0; i < n; i++) col.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
const vcM = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

// little find models (vertex-coloured, merged, one mesh each)
function findGeo(kind) {
  const gs = [];
  if (kind === 'pinecone') { for (let i = 0; i < 4; i++) gs.push(tint(new THREE.ConeGeometry(0.075 - i * 0.014, 0.07, 7).translate(0, 0.03 + i * 0.045, 0), i % 2 ? 0x7a4a26 : 0x8f5a2e)); gs.push(tint(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 5).translate(0, 0.0, 0), 0x5a3a20)); }
  else if (kind === 'feather') { gs.push(tint(new THREE.SphereGeometry(0.05, 8, 6).scale(0.55, 2.6, 0.12).rotateZ(0.5).translate(0, 0.11, 0), 0xeeeae2)); gs.push(tint(new THREE.SphereGeometry(0.03, 6, 4).scale(0.5, 1.4, 0.13).rotateZ(0.5).translate(0.035, 0.17, 0.002), 0x5a6a80)); gs.push(tint(new THREE.CylinderGeometry(0.004, 0.004, 0.26, 4).rotateZ(0.5).translate(-0.004, 0.1, 0.008), 0x8a8070)); }
  else if (kind === 'rock') { gs.push(tint(new THREE.IcosahedronGeometry(0.075, 0).scale(1.2, 0.85, 1).translate(0, 0.06, 0), 0x6a5a8a)); gs.push(tint(new THREE.OctahedronGeometry(0.03, 0).translate(0.04, 0.12, 0.02), 0xb8a6ff)); }
  else { const c = 0xe8dcc0; gs.push(tint(new THREE.CylinderGeometry(0.018, 0.026, 0.3, 6).rotateZ(1.3).translate(0, 0.03, 0), c));
    for (const [x, a, l] of [[-0.06, 0.25, 0.12], [0.03, -0.1, 0.14], [0.1, 0.2, 0.1]]) gs.push(tint(new THREE.CylinderGeometry(0.008, 0.016, l, 5).translate(0, l / 2, 0).rotateZ(a).translate(x, 0.04, 0), c)); }
  return mergeSimple(gs, true);
}

export function createAdventures(scene, { life, mochi, say, music, getWild, features, ui, state }) {
  const D = load(state); const save = () => { try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) { /* private mode */ } };
  const group = new THREE.Group(); group.name = 'adventures'; scene.add(group);
  const C = life.ctl; const A = life.A; const M = C.M;
  const lat = new THREE.Vector2(-DOCK.dz, DOCK.dx);
  const FG = {}; for (const k in FIND_KINDS) FG[k] = findGeo(k); const fM = vcM();

  // ── raft (logs + lashing + paddle, one merged mesh) moored beside the dock end ──
  const rg = [];
  for (let i = -2; i <= 2; i++) rg.push(tint(new THREE.CylinderGeometry(0.13, 0.13, 1.9, 8).rotateX(Math.PI / 2).translate(i * 0.25, 0, 0), i % 2 ? 0x8a6038 : 0x9c6e42));
  for (const z of [-0.6, 0.6]) rg.push(tint(new THREE.CylinderGeometry(0.03, 0.03, 1.32, 6).rotateZ(Math.PI / 2).translate(0, 0.11, z), 0xd8c49a));
  rg.push(tint(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 5).rotateZ(Math.PI / 2).rotateY(0.25).translate(0.1, 0.17, -0.35), 0x6b4a2c)); rg.push(tint(new THREE.BoxGeometry(0.3, 0.025, 0.15).rotateY(0.25).translate(0.72, 0.17, -0.5), 0x6b4a2c));
  const raft = new THREE.Mesh(mergeSimple(rg, true), vcM()); raft.castShadow = true; raft.receiveShadow = true; group.add(raft);
  const home = new THREE.Vector3(DOCK.x1 + lat.x * 1.45 - DOCK.dx * 0.6, WATER_Y + 0.05, DOCK.z1 + lat.y * 1.45 - DOCK.dz * 0.6);
  // far bank along the dock line (first point where the terrain is out of the water)
  let bankD = 22; for (let d = 6; d < 60; d += 0.5) { const x = DOCK.x1 + DOCK.dx * d, z = DOCK.z1 + DOCK.dz * d; if (terrainH(x, z) > 0.3) { bankD = d; break; } }
  const landRaft = new THREE.Vector3(home.x + DOCK.dx * (bankD - 2.4), WATER_Y + 0.05, home.z + DOCK.dz * (bankD - 2.4));
  const shoreP = new THREE.Vector3(landRaft.x + DOCK.dx * 3.4, 0, landRaft.z + DOCK.dz * 3.4);
  const raftYaw = Math.atan2(DOCK.dx, DOCK.dz);
  raft.position.copy(home); raft.rotation.y = raftYaw;
  let raftAt = home.clone(), raftTo = null, raftSp = 1.8, riding = false;

  // ── finds shelf on the shore by the dock: 2 shelves, one slot per kind, plank on top ──
  const r0 = islandRadius(DOCK.th) - 4.4; const sx = Math.cos(DOCK.th) * r0 - lat.x * 2.4, sz = Math.sin(DOCK.th) * r0 - lat.y * 2.4; const sy = groundY(sx, sz);
  const shelf = new THREE.Group(); shelf.position.set(sx, sy, sz); shelf.rotation.y = Math.atan2(-sx, -sz) + Math.PI; group.add(shelf);
  { const sg = []; const W = 1.3; for (const y of [0.45, 0.9]) sg.push(tint(new THREE.BoxGeometry(W, 0.05, 0.36).translate(0, y, 0), 0xa8794c));
    for (const x of [-W / 2, W / 2]) sg.push(tint(new THREE.BoxGeometry(0.07, 1.25, 0.36).translate(x, 0.6, 0), 0x7d5634)); sg.push(tint(new THREE.BoxGeometry(W, 1.0, 0.04).translate(0, 0.6, -0.17), 0x8a603a));
    const m = new THREE.Mesh(mergeSimple(sg, true), vcM()); m.castShadow = true; m.receiveShadow = true; shelf.add(m);
    const p = plank(['FINDS'], { width: 0.9, icon: '🧺', tone: 'pine', seed: 61 }); p.position.set(0, 1.35, 0.02); shelf.add(p); }
  OBSTACLES.push({ x: sx, z: sz, r: 0.8 });
  const slots = {}; Object.keys(FIND_KINDS).forEach((k, i) => { const m = new THREE.Mesh(FG[k], fM); m.position.set(i % 2 ? 0.3 : -0.3, i < 2 ? 0.925 : 0.475, 0.02); m.scale.setScalar(1.6); m.castShadow = true; m.visible = false; shelf.add(m); slots[k] = m; });
  const refreshShelf = () => { for (const k in slots) slots[k].visible = D.finds[k] > 0; };
  refreshShelf();

  // ── radio on the music stage ──
  const radio = new THREE.Group(); { const rx = MUSIC.x - 1.15, rz = MUSIC.z + 0.55; radio.position.set(rx, groundY(rx, rz) + 0.16, rz); radio.rotation.y = Math.atan2(-rx, -rz) + 0.3; group.add(radio); }
  const rgg = [tint(new THREE.BoxGeometry(0.5, 0.3, 0.2).translate(0, 0.15, 0), 0xd2643c), tint(new THREE.BoxGeometry(0.52, 0.04, 0.22).translate(0, 0.31, 0), 0x8a3e22),
    tint(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 14).rotateX(Math.PI / 2).translate(-0.11, 0.15, 0.101), 0x3a2a24), tint(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5).rotateZ(-0.5).translate(0.28, 0.48, -0.05), 0xb0b0b0),
    tint(new THREE.TorusGeometry(0.11, 0.015, 5, 12, Math.PI).translate(0, 0.33, 0), 0x3a2a24), tint(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10).rotateX(Math.PI / 2).translate(0.15, 0.1, 0.11), 0xeee0c0)];
  const radioBody = new THREE.Mesh(mergeSimple(rgg, true), vcM()); radioBody.castShadow = true; radio.add(radioBody);
  const dialM = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffb040, emissiveIntensity: 0 }); const dial = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.01), dialM); dial.position.set(0.13, 0.2, 0.102); radio.add(dial);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.05, 0.012), new THREE.MeshBasicMaterial({ color: 0xc02020 })); needle.position.set(0.07, 0.2, 0.106); radio.add(needle);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.5), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.25; radio.add(hit);
  const STATIONS = [
    { name: 'OFF', dj: ['radio off. the river is the radio now'] },
    { name: 'KIWI 101.1 · bird hits', song: true, dj: ['KIWI 101.1, all bird, all day. this one goes out to the owl', 'you are listening to KIWI one-oh-one. i am the dj. i am also the kiwi', 'caller says play something with flapping. coming right up'] },
    { name: '88.5 THE MOSS · lo-fi for naps', song: true, dj: ['88.5 the moss. lo-fi beats to nap in a hollow log to', 'the moss. slow songs for slow birds. you are welcome', 'shhh. the moss is on. the capybara requested this one'] },
    { name: 'WPEB · pebble rock', song: true, dj: ['WPEB pebble rock! rocks that rock! (i skip them after)', 'turn it UP. not too up. my ears are small', 'pebble rock. it is just rocks clicking. it SLAPS'] },
    { name: 'Bitterroot Talk', dj: ['bitterroot talk. today: is a hot dog a sandwich. squirrel says yes. squirrel is wrong', 'caller from darby asks if fish have feelings. yes. they feel wet', 'weather update: i stuck my head out. it is outside'] },
  ];
  let station = 0; const setStation = (i, { by = 'tap' } = {}) => {
    station = (i + STATIONS.length) % STATIONS.length; D.station = station; save(); const st = STATIONS[station];
    music?.sfx?.('click'); needle.position.x = -0.0 + station * 0.035; dialM.emissiveIntensity = station ? 1.2 : 0; dialM.needsUpdate = false;
    if (by === 'tap') { if (st.song && music?.songs?.length) music.play(Math.floor(Math.random() * music.songs.length)); else music?.stop?.(); }
    else if (music?.started) { if (st.song && music.songs?.length) music.next(); else music.stop(); }
    say(`📻 ${st.name}: ${st.dj[Math.floor(Math.random() * st.dj.length)]}${st.song && !music?.songs?.length ? ' (no songs yet. humming instead)' : ''}`, 3.4);
  };
  needle.position.x = station * 0.035;
  function tap(ray) { if (!ray.intersectObject(hit, false).length) return false; setStation(station + 1); return true; }
  let thump = 0;

  // ── friends ──
  let fDirty = 1;
  function befriend(k, why) {
    const f = D.friends[k]; const before = level(f.score); const first = f.last !== today(); f.score += first ? 2 : 1; f.last = today(); save(); fDirty = 1;
    const after = level(f.score); if (after !== before) { say(`${FRIENDS[k].emoji} ${FRIENDS[k].name.toLowerCase()} is now my ${after}!! (${why})`, 3.4); life.encounters.push({ animal: FRIENDS[k].name.toLowerCase(), at: FRIENDS[k].where, outcome: `now ${after}`, date: today() }); }
  }
  let capyWas = false, petrelWas = false; const foxSeen = new WeakSet(); let pollT = 0;
  function poll() {
    const ws = features.wishes || {}; const cv = !!ws.tub?.capy?.visible; if (cv && !capyWas) befriend('capybara', 'hot tub buddy'); capyWas = cv;
    const pv = !!ws.burrow?.bird?.visible; if (pv && !petrelWas) befriend('petrel', 'said hi from the burrow'); petrelWas = pv;
    const w = getWild?.(); if (w?.live) for (const a of w.live) if (a.key === 'fox' && !foxSeen.has(a)) { foxSeen.add(a); befriend('fox', 'waved from the bank'); }
  }
  function panelHtml() {
    const fr = Object.keys(FRIENDS).map((k) => { const f = D.friends[k], F = FRIENDS[k]; const hearts = Math.min(5, Math.floor(f.score / 4)); return `<li><b>${F.emoji} ${esc(F.name)}</b> <span>${'💗'.repeat(hearts)}${'🤍'.repeat(5 - hearts)}</span><br><small>${esc(level(f.score))} · ${f.score} pts${f.last ? ' · last seen ' + esc(f.last) : ' · not met yet'} · hangs out at ${esc(F.where)}</small></li>`; }).join('');
    const fi = Object.keys(FIND_KINDS).map((k) => `<li>${FIND_KINDS[k].emoji} ${esc(FIND_KINDS[k].name)} <b>×${D.finds[k]}</b></li>`).join('');
    const lastFind = D.findLog[D.findLog.length - 1];
    return `<h4>Friends</h4><ul class="friends">${fr}</ul><h4>Raft finds <small>(${D.trips} trip${D.trips === 1 ? '' : 's'})</small></h4><ul class="finds">${fi}</ul>${lastFind ? `<p><small>latest: ${esc(FIND_KINDS[lastFind.kind]?.name || lastFind.kind)} on ${esc(lastFind.date)}</small></p>` : '<p><small>no trips yet. the raft is at the dock.</small></p>'}
      ${(() => { const R = window.__mochi?.range; if (!R) return ''; const d = R.data; return `<h4>Range <small>(${d.rounds} round${d.rounds === 1 ? '' : 's'}, best ${d.best}/8)</small></h4><p><small>guns: ${d.guns.length ? esc(d.guns.join(', ')) : 'none yet'} · caps spent: ${d.capsSpent} · caps left: ${R.caps} · warning shots: ${d.warnings}</small></p>`; })()}
      <p><button class="copyst" title="copy these as STATE fields for mochi">📋 copy for mochi</button></p>`;
  }
  function stateFields() { const friends = {}; for (const k in D.friends) friends[k] = { score: D.friends[k].score, level: level(D.friends[k].score), last: D.friends[k].last }; return { friends, finds: { ...D.finds }, raftTrips: D.trips, ...(window.__mochi?.range?.stateFields() || {}) }; }
  function renderPanel() { if (!fDirty) return; fDirty = 0; ui.renderFriends?.(panelHtml()); const b = document.querySelector('#pane-friends .copyst'); if (b) b.onclick = () => { navigator.clipboard?.writeText(JSON.stringify(stateFields(), null, 1)).then(() => (b.textContent = '✓ copied'), () => (b.textContent = 'copy failed')); }; }

  // ── danger check (bears / lions anywhere in an event) ──
  const danger = () => { const e = getWild?.()?.event; return !!(e && (e.kind === 'bear' || e.kind === 'lion')); };
  const pickFind = () => { let r = Math.random() * 100; for (const k in FIND_KINDS) { r -= FIND_KINDS[k].w; if (r <= 0) return k; } return 'pinecone'; };
  const carried = new THREE.Mesh(FG.pinecone, fM); carried.castShadow = true;

  // raft position helpers for Mochi riding
  const ride = () => { const p = M(); p.x = raft.position.x; p.z = raft.position.z; C.go(null); C.snapLift(raft.position.y + 0.13 - groundY(p.x, p.z)); };
  const bankY = (x, z) => Math.max(terrainH(x, z), WATER_Y + 0.1);
  const onBank = () => { const p = M(); C.lift(bankY(p.x, p.z) - groundY(p.x, p.z)); };
  function sendRaft(to, sp) { raftTo = to.clone(); raftSp = sp; }
  function resetTrip() { raft.position.copy(home); raftTo = null; riding = false; const p = M(); p.x = DOCK.x0 + DOCK.dx * DOCK.len * 0.8; p.z = DOCK.z0 + DOCK.dz * DOCK.len * 0.8; C.snapLift(0); carried.parent?.remove(carried); }
  const dockEnd = () => new THREE.Vector3(DOCK.x0 + DOCK.dx * DOCK.len * 0.93 + lat.x * 0.45, 0, DOCK.z0 + DOCK.dz * DOCK.len * 0.93 + lat.y * 0.45);
  const LEAVE = ['raft day trip! bringing snacks. bringing courage. mostly snacks', 'captain mochi, setting sail for the far bank', 'adventure time. the river is calm. i am mostly calm'];
  const NOPE = 'bear on the bank. raft trip cancelled. we stay home and are brave from here';
  A.raft = { zone: 'dock', label: '🛶 raft day trip', ok: () => !danger() && (window.__mochi?.sky?.state?.night ?? 0) < 0.55, onCancel() { resetTrip(); },
    steps: [
      { d: 2.2, start() { this.no = danger(); if (this.no) { say(NOPE, 3); return; } C.go(dockEnd()); C.face(raftYaw); } },
      { d: 1.0, start() { if (this.no) return; mochi.hop(0.9); say(LEAVE[Math.floor(Math.random() * LEAVE.length)], 3); }, tick(u) { if (this.no) return; const p = M(), e = dockEnd(); p.x = e.x + (raft.position.x - e.x) * u; p.z = e.z + (raft.position.z - e.z) * u; C.go(null); C.lift(Math.sin(u * Math.PI) * 0.5 + (raft.position.y + 0.13 - groundY(p.x, p.z)) * u); } },
      { d: 13, start() { if (this.no) return; riding = true; sendRaft(landRaft, 1.95); C.face(raftYaw); }, tick() { if (this.no) return; ride(); C.pose.sway = 0.3; if (danger() && !this.back) { this.back = true; say('nope. bear. turning this raft around', 2.6); } },
        end() { C.pose.sway = 0; } },
      { d: 1.0, start() { if (this.no || this.back) return; riding = false; mochi.hop(0.9); }, tick(u) { if (this.no || this.back) return; const p = M(); p.x = raft.position.x + (shoreP.x - raft.position.x) * u; p.z = raft.position.z + (shoreP.z - raft.position.z) * u; C.lift(bankY(p.x, p.z) - groundY(p.x, p.z) + Math.sin(u * Math.PI) * 0.5); } },
      { d: 9, start() { if (this.no || this.back) return; this.k = 0; say(['far bank! smells like pine and mystery', 'new land. i claim it for kiwis. temporarily', 'exploring. stay close, raft'][Math.floor(Math.random() * 3)], 2.6); },
        tick(u, dt) { if (this.no || this.back) return; if (danger()) { this.back = true; say('a bear?! no thank you. back to the raft', 2.4); return; }
          const a = u * Math.PI * 2.2; C.go(new THREE.Vector3(shoreP.x + Math.sin(a) * 1.6 + DOCK.dx * 1.2, 0, shoreP.z + Math.cos(a) * 1.6 + DOCK.dz * 1.2)); onBank(); C.pose.peck = Math.sin(u * 30) > 0.6 ? 0.4 : 0;
          if (u > 0.75 && !this.found) { this.found = pickFind(); carried.geometry = FG[this.found]; C.hold(carried, [0, 0, 0], 1.3); mochi.hop(0.7); mochi.flap(1); say(`found a ${FIND_KINDS[this.found].name}!! ${this.found === 'antler' ? 'RARE. i am shaking' : this.found === 'rock' ? 'it hums? it does not hum. it might hum' : 'into the bag'}`, 2.8); } },
        end() { C.pose.peck = 0; C.go(null); } },
      { d: 1.2, start() { if (this.no) return; if (!this.back) { this.from = M().clone(); mochi.hop(0.9); } }, tick(u) { if (this.no || this.back || !this.from) return; const p = M(); p.x = this.from.x + (raft.position.x - this.from.x) * u; p.z = this.from.z + (raft.position.z - this.from.z) * u; C.lift(Math.sin(u * Math.PI) * 0.5 + (raft.position.y + 0.13 - groundY(p.x, p.z)) * u + (bankY(this.from.x, this.from.z) - groundY(p.x, p.z)) * (1 - u)); } },
      { d: 13, start() { if (this.no) return; riding = true; sendRaft(home, 1.95); C.face(raftYaw + Math.PI); }, tick() { if (this.no) return; ride(); C.pose.sway = 0.3; }, end() { C.pose.sway = 0; } },
      { d: 1.0, start() { if (this.no) return; riding = false; raft.position.copy(home); raftTo = null; mochi.hop(0.9); }, tick(u) { if (this.no) return; const p = M(), e = dockEnd(); p.x = raft.position.x + (e.x - raft.position.x) * u; p.z = raft.position.z + (e.z - raft.position.z) * u; C.lift(Math.sin(u * Math.PI) * 0.5 + (raft.position.y + 0.13 - groundY(p.x, p.z)) * (1 - u)); } },
      { d: 3.5, start() { if (this.no) return; C.lift(0); C.go(new THREE.Vector3(sx + Math.sin(shelf.rotation.y) * 0.9, 0, sz + Math.cos(shelf.rotation.y) * 0.9)); C.face(shelf.rotation.y + Math.PI); } },
      { d: 1.6, start() { if (this.no) return; D.trips++; if (this.found) { D.finds[this.found]++; D.findLog.push({ kind: this.found, date: today() }); D.findLog = D.findLog.slice(-30); life.encounters.push({ animal: FIND_KINDS[this.found].name, at: 'far bank', outcome: 'found on a raft trip', date: today() }); }
        save(); refreshShelf(); fDirty = 1; C.drop(); C.pose.peck = 0.3; say(this.found ? `${FIND_KINDS[this.found].emoji} on the finds shelf. collection: ${Object.values(D.finds).reduce((a, b) => a + b, 0)}` : 'no finds this time. the trip was the find', 2.6); }, end() { C.pose.peck = 0; C.face(null); } } ] };
  const RADIO = ['tuning the radio. tiny knob, tiny bird, big sound', 'scanning the dial. found a station that is just a guy breathing. skip', 'radio time'];
  A.radio = { zone: 'music', label: '📻 tuning the radio', steps: [
    { d: 2.0, start() { const p = radio.position; C.go(new THREE.Vector3(p.x + Math.sin(radio.rotation.y) * 0.8, 0, p.z + Math.cos(radio.rotation.y) * 0.8)); C.face(radio.rotation.y + Math.PI); } },
    { d: 4, start() { say(RADIO[Math.floor(Math.random() * RADIO.length)], 2); }, tick(u) { C.pose.peck = Math.sin(u * 20) > 0 ? 0.3 : 0.1; needle.position.x = (Math.sin(u * 9) * 0.5 + 0.5) * 0.14; } },
    { d: 3, start() { C.pose.peck = 0; setStation(1 + Math.floor(Math.random() * (STATIONS.length - 1)), { by: 'mochi' }); }, end() { C.face(null); } } ] };
  life.BY_ZONE.dock = ['fish', 'fish', 'raft']; life.BY_ZONE.music = ['jam', 'radio'];
  life.KEYS.unshift([/raft|day trip|far bank|expedition/, 'raft'], [/radio|dj\b|station/, 'radio']);

  function update(t, dt) {
    if (raftTo) { const d = raftTo.clone().sub(raft.position); d.y = 0; const L = d.length(); if (L < 0.05) raftTo = null; else raft.position.addScaledVector(d.normalize(), Math.min(L, raftSp * dt)); }
    raft.position.y = WATER_Y + 0.05 + Math.sin(t * 1.3) * 0.03; raft.rotation.z = Math.sin(t * 0.9) * 0.03; raft.rotation.x = Math.sin(t * 1.1 + 1) * 0.02;
    if (station && music?.playing) { thump += dt; radioBody.scale.y = 1 + Math.max(0, Math.sin(thump * 9)) * 0.03; } else radioBody.scale.y = 1;
    pollT -= dt; if (pollT < 0) { pollT = 0.5; poll(); if ((t % 3) < 0.5 && document.querySelector('#pane-friends.open')) fDirty = 1; } renderPanel();
  }
  return { group, update, tap, raft, radio, shelf, data: D, refreshShelf, stateFields, befriend, setStation, get riding() { return riding; } };
}
