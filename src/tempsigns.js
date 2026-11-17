// Temporary stake signs: Mochi (from STATE.world.marks + now and then on his own) and the squirrel (petty messages) hammer
// little signs into the ground. They pop in, stay a while, then sink. Max 6 at once; kept off paths and out of props.
// Saved in localStorage `mochi.tempsigns` so they survive a reload until they expire.
import * as THREE from 'three';
import { ZONES, OBSTACLES, groundY, islandRadius } from './layout.js';
import { plank } from './signs.js';

const LS = 'mochi.tempsigns'; const MAX = 6;
const H = 3600e3;
const LIFE = { mochi: 24 * H, mark: 24 * H, squirrel: 3 * H };
const SQUIRREL = ['MY TREE', 'mochi smells', 'no kiwis', 'acorns: MINE', 'kiwi = fake bird', 'this is squirrel land', 'mochi owes me 3 nuts', 'NO BEAKS', 'keep off my grass', 'go back to new zealand', 'i was here first', 'mochi cant read lol'];
const MOCHI = ['squirrel lies', 'kiwis only (and corey)', 'good spot for a nap', 'mochi was here', 'caution: tiny bird', 'it is MY island', 'squirrel: read this', 'no acorn tax', 'snack zone', 'worm crossing'];
const REPLY = { 'mochi smells': 'i smell like pine. ok', 'no kiwis': 'yes kiwis', 'MY TREE': 'our tree', 'mochi cant read lol': 'i can read. rude', 'go back to new zealand': 'i was BORN here (on this island)' };
const now = () => Date.now();
// stake signs are tiny: keep Mochi's marks to the first clause, ~24 chars, whole words
export function shorten(t) { let s = String(t).replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim(); s = s.split(/[.;:!?]\s|,\s(?=\D)/)[0] || s; if (s.length > 28) { const c = s.lastIndexOf(' ', 28); s = s.slice(0, c > 8 ? c : 28); } return s.replace(/[,\s-]+$/, '') || String(t).slice(0, 20); }
function wrap(s) { const w = String(s).slice(0, 34).split(/\s+/); const out = ['']; for (const x of w) { if ((out[out.length - 1] + ' ' + x).trim().length > 13 && out.length < 3) out.push(x); else out[out.length - 1] = (out[out.length - 1] + ' ' + x).trim(); } return out; }

export function createTempSigns(scene, { state, island, life, mochi, say, music, squirrel, squirrelPos }) {
  const group = new THREE.Group(); group.name = 'temp-signs'; scene.add(group);
  let D = {}; try { D = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { D = {}; }
  D.list = (Array.isArray(D.list) ? D.list : []).filter((s) => s && s.text && s.until > now()).slice(-MAX); D.marksDone = Array.isArray(D.marksDone) ? D.marksDone.slice(-60) : [];
  const save = () => { try { localStorage.setItem(LS, JSON.stringify({ list: D.list.map(({ obj, ...s }) => s), marksDone: D.marksDone })); } catch (e) { /* ignore */ } };
  const postM = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.95 });
  const live = []; // { s, g, t, state: 'in'|'up'|'out' }
  const pathD = island?.pathD || (() => 9);
  function okSpot(x, z) {
    const R = islandRadius(Math.atan2(z, x)) - 1.6; if (Math.hypot(x, z) > R) return false;
    if (pathD(x, z) < 1.1) return false;
    for (const o of OBSTACLES) if (Math.hypot(o.x - x, o.z - z) < o.r + 0.7) return false;
    for (const zn of ZONES) if (Math.hypot(zn.spot[0] - x, zn.spot[1] - z) < 0.9) return false;
    for (const l of live) if (Math.hypot(l.s.x - x, l.s.z - z) < 1.6) return false;
    return true;
  }
  function findSpot(cx, cz, r0 = 1.4, r1 = 3.4) { for (let k = 0; k < 40; k++) { const a = Math.random() * 6.283, r = r0 + Math.random() * (r1 - r0); const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (okSpot(x, z)) return [x, z]; } return null; }
  function build(s) {
    const g = new THREE.Group(); g.position.set(s.x, groundY(s.x, s.z), s.z); g.rotation.y = s.yaw; group.add(g);
    const stake = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), postM); stake.position.set(0, 0.25, -0.025); stake.castShadow = true; g.add(stake);
    const sq = s.by === 'squirrel'; const pk = plank(wrap(s.text), { width: sq ? 0.62 : 0.7, hand: true, twoSided: true, tone: sq ? 'walnut' : 'pine', seed: s.text.length * 7 + (sq ? 3 : 1), thick: 0.03 });
    pk.position.set(0, 0.58, 0.01); pk.rotation.set(-0.08, 0, s.tilt); g.add(pk); return g;
  }
  function retire(l) { if (l.state !== 'out') { l.state = 'out'; l.t = 0; } }
  function plant(by, text, x, z, { instant = false } = {}) {
    // cap: the oldest sign sinks to make room
    const up = live.filter((l) => l.state !== 'out'); if (up.length >= MAX) retire(up.sort((a, b) => a.s.at - b.s.at)[0]);
    const s = { by, text: by === 'squirrel' ? String(text).slice(0, 30) : shorten(text), x, z, yaw: Math.atan2(-x, -z) + (Math.random() - 0.5) * 0.7, tilt: (Math.random() - 0.5) * 0.12, at: now(), until: now() + (LIFE[by] || 6 * H) };
    const l = { s, g: build(s), t: instant ? 1 : 0, state: instant ? 'up' : 'in' }; live.push(l); D.list = [...D.list.filter((q) => q.until > now()), s].slice(-MAX); save();
    if (!instant) { l.g.position.y -= 0.6; } return l;
  }
  // restore saved ones (already standing)
  for (const s of D.list) { const l = { s, g: build(s), t: 1, state: 'up' }; live.push(l); }

  // ── Mochi plants one: hammer in his beak, 3 taps, sign pops up ──
  const hammer = new THREE.Group(); { const hm = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.8 }), hh = new THREE.MeshStandardMaterial({ color: 0x55585e, metalness: 0.6, roughness: 0.4 });
    const h1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), hm); h1.rotation.x = Math.PI / 2; h1.position.z = 0.1; hammer.add(h1); const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.06), hh); h2.position.z = 0.25; hammer.add(h2); }
  const C = life.ctl; const M = C.M;
  const pendingMarks = () => { const marks = (Array.isArray(state.world?.marks) ? state.world.marks : []).filter((m) => m && m.text); return marks.slice(-4).filter((m) => !D.marksDone.includes(String(m.text))); };
  const ZID = { nest: 'hut', treehouse: 'tree' };
  life.A.stake = { zone: 'garden', label: '🪧 planting a sign', anyZone: true, steps: [
    { d: 1.6, start() { const m = pendingMarks()[0]; if (m) { this.text = String(m.text); this.mark = true; const zid = ZID[String(m.at || '').toLowerCase()] || String(m.at || '').toLowerCase(); this.zone = ZONES.find((q) => q.id === zid) || ZONES.find((q) => q.keys?.some((k) => String(m.at || '').toLowerCase().includes(k))); }
        else { this.text = MOCHI[Math.floor(Math.random() * MOCHI.length)]; const sq = live.find((l) => l.s.by === 'squirrel' && l.state === 'up' && REPLY[l.s.text]); if (sq && Math.random() < 0.6) { this.text = REPLY[sq.s.text]; this.near = [sq.s.x, sq.s.z]; } }
        const p = M(); const c = this.near || (this.zone && Math.hypot(this.zone.spot[0] - p.x, this.zone.spot[1] - p.z) < 6 ? this.zone.spot : [p.x, p.z]); this.spot = findSpot(c[0], c[1], 1.0, 2.8) || findSpot(p.x, p.z, 1.2, 4);
        if (!this.spot) { this.no = true; return; } const h = Math.atan2(this.spot[0] - p.x, this.spot[1] - p.z); C.go(new THREE.Vector3(this.spot[0] - Math.sin(h) * 0.85, 0, this.spot[1] - Math.cos(h) * 0.85)); } },
    { d: 2.4, start() { if (this.no) return; const p = M(); C.face(Math.atan2(this.spot[0] - p.x, this.spot[1] - p.z)); C.hold(hammer, [0.4, 0, 0], 1); this.l = plant(this.mark ? 'mark' : 'mochi', this.text, this.spot[0], this.spot[1]); this.l.hold = true; if (this.mark) { D.marksDone.push(this.text); save(); } },
      tick(u) { if (this.no) return; const k = Math.min(3, Math.floor(u * 3.5)); const ph = (u * 3.5) % 1; hammer.rotation.x = 0.4 + (ph < 0.5 ? -ph * 2.4 : -(1 - ph) * 2.4); C.pose.peck = ph < 0.5 ? 0.5 : 0.1; if (k !== this.k) { this.k = k; if (k > 0) { music?.sfx?.('thunk'); } } if (this.l) this.l.target = Math.min(1, k / 3); } },
    { d: 1.6, start() { if (this.no) return; this.text = this.l?.s.text || this.text; C.drop(); C.pose.peck = 0; if (this.l) { this.l.hold = false; this.l.target = 1; } mochi.hop(0.5); say(`planted: "${this.text}"`, 2.4); }, end() { C.face(null); } } ] };
  // let him do it anywhere he's standing (not tied to one zone): add it to every zone's options, low weight
  for (const k in life.BY_ZONE) { if (Math.random() < 0.5 || ['garden', 'squirrel', 'beach', 'cliff', 'hut'].includes(k)) life.BY_ZONE[k].push('stake'); }
  life.A.stake.ok = () => { const n = live.filter((l) => l.state !== 'out' && l.s.by !== 'squirrel').length; return pendingMarks().length > 0 ? n < 4 : n < 3 && Math.random() < 0.35; };

  // ── squirrel: every few minutes, plants a petty sign near its tree (hammer taps on its head) ──
  const sqHammer = hammer.clone(); sqHammer.scale.setScalar(0.6); sqHammer.visible = false; squirrel?.root?.add(sqHammer); sqHammer.position.set(0, 0.35, 0.12);
  let sqT = 25 + Math.random() * 60, sqJob = null;
  function squirrelPlant(force) {
    const base = squirrelPos; const spot = findSpot(base[0], base[1], 1.4, 3.6); if (!spot) return false; const text = force || SQUIRREL[Math.floor(Math.random() * SQUIRREL.length)];
    const l = plant('squirrel', text, spot[0], spot[1]); l.hold = true; sqJob = { l, t: 0 }; sqHammer.visible = true; return true;
  }
  function update(t, dt) {
    sqT -= dt; const sqUp = live.filter((l) => l.state !== 'out' && l.s.by === 'squirrel').length;
    if (sqT < 0) { sqT = 150 + Math.random() * 200; if (sqUp < 2) squirrelPlant(); }
    if (sqJob) { sqJob.t += dt; const ph = (sqJob.t * 3) % 1; sqHammer.rotation.x = ph < 0.5 ? -ph * 2 : -(1 - ph) * 2; sqJob.l.target = Math.min(1, Math.floor(sqJob.t * 3) / 3); if (Math.floor(sqJob.t * 3) !== Math.floor((sqJob.t - dt) * 3)) music?.sfx?.('tink');
      if (sqJob.t > 1.2) { sqJob.l.hold = false; sqJob.l.target = 1; sqHammer.visible = false; if (Math.hypot(M().x - sqJob.l.s.x, M().z - sqJob.l.s.z) < 12 && Math.random() < 0.7) say(`the squirrel put up "${sqJob.l.s.text}". unbelievable`, 2.8); sqJob = null; } }
    for (let i = live.length - 1; i >= 0; i--) { const l = live[i]; const gy = groundY(l.s.x, l.s.z);
      if (l.state === 'up' && l.s.until < now()) retire(l);
      if (l.state === 'in') { const tgt = l.hold ? (l.target ?? 0) : 1; l.t += (tgt - l.t) * Math.min(1, dt * 10); const pop = l.hold ? 0 : Math.max(0, Math.sin(Math.min(1, l.pop = (l.pop || 0) + dt * 2.2) * Math.PI)) * 0.06;
        l.g.position.y = gy - 0.6 * (1 - l.t) + pop; l.g.scale.setScalar(0.8 + 0.2 * l.t + pop); if (!l.hold && l.t > 0.995 && l.pop >= 1) { l.state = 'up'; l.g.position.y = gy; l.g.scale.setScalar(1); } }
      else if (l.state === 'out') { l.t += dt / 3; l.g.position.y = gy - 0.75 * Math.min(1, l.t); l.g.rotation.z = Math.min(1, l.t) * 0.25; if (l.t >= 1) { group.remove(l.g); live.splice(i, 1); D.list = D.list.filter((q) => q !== l.s); save(); } }
    }
  }
  return { group, update, plant, squirrelPlant, live, get count() { return live.filter((l) => l.state !== 'out').length; }, okSpot, findSpot, pendingMarks };
}
