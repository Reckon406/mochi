// Night critters of the Bitterroot (no fireflies here!): great horned owl in the big tree, bats over the river at dusk,
// moths around the lights, and a raccoon that sneaks to the dock bucket for Mochi's fish.
import * as THREE from 'three';
import { mv, topH, DOCK, WATER_Y, groundY, islandRadius } from './layout.js';

const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
function add(p, g, mat, pos = [0, 0, 0], rot = [0, 0, 0], sc = null) { const x = new THREE.Mesh(g, mat); x.position.set(...pos); x.rotation.set(...rot); if (sc) x.scale.set(...sc); x.castShadow = true; p.add(x); return x; }

export function createCritters(scene, { lights = [], life, say, music, season }) {
  const group = new THREE.Group(); group.name = 'night-critters'; scene.add(group);
  // ── great horned owl on a branch of the big tree ──
  const [tx, tz] = mv(4.4, -9.0); const owl = new THREE.Group(); owl.position.set(tx + 1.25, topH(tx, tz) + 2.35, tz - 0.55); owl.rotation.y = 0.9; group.add(owl);
  add(group, new THREE.CylinderGeometry(0.05, 0.07, 1.2, 6), m(0x6b4a33), [tx + 0.95, topH(tx, tz) + 2.28, tz - 0.4], [0, 0.9, Math.PI / 2 - 0.15]);
  const fe = m(0x7a6248), pale = m(0xd8c8a8);
  add(owl, new THREE.SphereGeometry(0.2, 14, 10), fe, [0, 0.22, 0], [0, 0, 0], [1, 1.35, 0.95]); add(owl, new THREE.SphereGeometry(0.13, 12, 8), pale, [0, 0.18, 0.1], [0, 0, 0], [1, 1.3, 0.6]);
  const head = new THREE.Group(); head.position.y = 0.5; owl.add(head); add(head, new THREE.SphereGeometry(0.15, 14, 10), fe, [0, 0, 0], [0, 0, 0], [1.1, 0.95, 1]);
  for (const s of [-1, 1]) { add(head, new THREE.ConeGeometry(0.04, 0.13, 4), fe, [s * 0.09, 0.15, 0], [0, 0, -s * 0.3]); add(head, new THREE.CircleGeometry(0.06, 14), pale, [s * 0.06, 0.01, 0.135]); }
  const eyeM = new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xffa000, emissiveIntensity: 0 }); const eyes = [-1, 1].map((s) => add(head, new THREE.SphereGeometry(0.028, 8, 6), eyeM, [s * 0.06, 0.015, 0.15]));
  add(head, new THREE.ConeGeometry(0.02, 0.05, 4), m(0x3a3a3a), [0, -0.04, 0.15], [Math.PI / 2 + 0.4, 0, 0]);
  let hootT = 8;

  // ── bats over the river at dusk / night ──
  const batM = m(0x1a1418); const bats = [];
  for (let i = 0; i < 7; i++) { const b = new THREE.Group(); add(b, new THREE.SphereGeometry(0.06, 6, 4), batM, [0, 0, 0], [0, 0, 0], [1, 0.8, 1.4]); const wings = [-1, 1].map((s) => { const w = new THREE.Group(); b.add(w); add(w, new THREE.PlaneGeometry(0.22, 0.12), m(0x1a1418, { side: THREE.DoubleSide }), [s * 0.12, 0, 0], [-Math.PI / 2, 0, 0]); return w; }); b.userData = { wings, a: i * 0.9, r: 28 + (i % 3) * 6, h: 2.5 + (i % 4) * 0.8, sp: 0.35 + (i % 3) * 0.1, ph: i }; group.add(b); bats.push(b); }

  // ── moths around warm lights ──
  const mothM = new THREE.MeshBasicMaterial({ color: 0xf2ead8, transparent: true, opacity: 0 }); const moths = [];
  const lamps = lights.slice(0, 10); for (const L of lamps) for (let k = 0; k < 3; k++) { const mo = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.04), mothM); mo.userData = { L, ph: Math.random() * 6, r: 0.18 + Math.random() * 0.25 }; group.add(mo); moths.push(mo); }

  // ── raccoon: sneaks from the shore to the dock bucket at night ──
  const rac = new THREE.Group(); group.add(rac); rac.visible = false; const gray = m(0x7a7670), dark = m(0x2a2624), light = m(0xd8d4cc);
  const rb = new THREE.Group(); rac.add(rb); add(rb, new THREE.SphereGeometry(0.2, 12, 8), gray, [0, 0.24, 0], [0, 0, 0], [0.9, 0.8, 1.3]);
  const rh = new THREE.Group(); rh.position.set(0, 0.32, 0.26); rb.add(rh); add(rh, new THREE.SphereGeometry(0.12, 12, 8), gray, [0, 0, 0], [0, 0, 0], [1.1, 0.9, 1]); add(rh, new THREE.ConeGeometry(0.06, 0.12, 8), light, [0, -0.02, 0.12], [Math.PI / 2, 0, 0]);
  add(rh, new THREE.BoxGeometry(0.2, 0.05, 0.02), dark, [0, 0.02, 0.105]); add(rh, new THREE.SphereGeometry(0.02, 6, 4), dark, [0, -0.02, 0.18]); for (const s of [-1, 1]) add(rh, new THREE.ConeGeometry(0.04, 0.07, 4), gray, [s * 0.08, 0.1, 0]);
  const tail = new THREE.Group(); tail.position.set(0, 0.25, -0.24); rb.add(tail); for (let i = 0; i < 5; i++) add(tail, new THREE.CylinderGeometry(0.05, 0.05, 0.07, 8), i % 2 ? dark : gray, [0, 0, -i * 0.07], [Math.PI / 2, 0, 0]);
  const legs = [[-0.1, 0.12], [0.1, 0.12], [-0.1, -0.12], [0.1, -0.12]].map(([x, z]) => add(rb, new THREE.CylinderGeometry(0.03, 0.03, 0.14, 5), dark, [x, 0.07, z]));
  const bucket = new THREE.Vector3(DOCK.x0 + DOCK.dx * 1.0 + DOCK.dz * 0.5, DOCK.y, DOCK.z0 + DOCK.dz * 1.0 - DOCK.dx * 0.5);
  const th = DOCK.th + 0.45, R = islandRadius(th) + 0.5; const start = new THREE.Vector3(Math.cos(th) * R, 0, Math.sin(th) * R);
  let rT = 40 + Math.random() * 40, rk = -1, ru = 0, stole = null;

  function update(t, dt, night, dusk) {
    // owl: eyes glow + head swivels at night, sleepy by day
    const awake = night > 0.4; eyeM.emissiveIntensity = awake ? 1.4 : 0; eyes.forEach((e) => (e.scale.y = awake ? 1 : 0.15)); head.rotation.y = awake ? Math.sin(t * 0.4) * 1.2 + (Math.sin(t * 0.13) > 0.95 ? 1.5 : 0) : 0;
    if (awake) { hootT -= dt; if (hootT < 0) { hootT = 18 + Math.random() * 25; music.sfx('hoot'); } }
    // bats: out from dusk through the night, loop over the river around the island
    const batOn = Math.max(dusk, night) > 0.35 && season !== 'winter'; // they hibernate in winter
    for (const b of bats) { b.visible = batOn; if (!batOn) continue; const u = b.userData; u.a += dt * u.sp * (1 + 0.3 * Math.sin(t + u.ph)); const r = u.r + Math.sin(t * 1.7 + u.ph) * 3; b.position.set(Math.cos(u.a) * r, WATER_Y + u.h + Math.sin(t * 3 + u.ph) * 0.6, Math.sin(u.a) * r); b.rotation.y = -u.a; const f = Math.sin(t * 22 + u.ph) * 0.9; u.wings[0].rotation.z = f; u.wings[1].rotation.z = -f; }
    // moths: only when lights are on and it isn't freezing
    const mothOn = night > 0.4 && season !== 'winter'; mothM.opacity = mothOn ? 0.85 : 0;
    if (mothOn) for (const mo of moths) { const d = mo.userData; const p = new THREE.Vector3(); d.L.l.getWorldPosition(p); const a = t * 3 + d.ph; mo.position.set(p.x + Math.cos(a) * d.r, p.y + Math.sin(a * 1.7) * 0.15, p.z + Math.sin(a * 1.3) * d.r); mo.rotation.set(Math.sin(t * 30 + d.ph), a, 0); }
    // raccoon sneaks in at night
    if (night > 0.55 && rk < 0) { rT -= dt; if (rT < 0) { rk = 0; ru = 0; rac.visible = true; stole = null; } }
    if (rk >= 0) {
      const sp = rk === 2 ? 0.4 : 0.12; ru += dt * sp; const from = rk === 0 ? start : bucket, to = rk === 0 ? bucket : start; const k = Math.min(1, ru);
      if (rk === 1) { if (ru > 0.3 && !stole) { stole = life.steal('raccoon') || 'nothing'; say(stole === 'nothing' ? 'a raccoon checked my bucket. it was empty. ha.' : `HEY. a raccoon just stole my ${stole}`, 3.5); } if (ru > 1) { rk = 2; ru = 0; } }
      else { const x = from.x + (to.x - from.x) * k, z = from.z + (to.z - from.z) * k; rac.position.set(x, Math.max(groundY(x, z), WATER_Y - 0.15), z); rac.rotation.y = Math.atan2(to.x - from.x, to.z - from.z); legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 14 + i * 1.6) * 0.6)); tail.rotation.y = Math.sin(t * 5) * 0.3;
        if (k >= 1) { if (rk === 0) { rk = 1; ru = 0; } else { rk = -1; rac.visible = false; rT = 90 + Math.random() * 120; } } }
    }
  }
  return { group, update, owl, raccoon: rac };
}
