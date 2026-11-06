// 🦌 Bitterroot wildlife pass. Animals mostly live on the far riverbanks, valley floor and slopes: drinking at the
// water's edge, walking the treeline, soaring overhead. Predators show up across the river first. Mochi spots them,
// gets nervous and watches. Only sometimes do they wade or swim over to the island and set off a (cute, no-gore) defense.
// Species are checked against FWP, Bitterroot NF, Lee Metcalf NWR (Ravalli County) and the Montana Field Guide (see README).
import * as THREE from 'three';
import { riverX, riverW, WATER_Y, groundY, islandRadius, ZONES, DOCK, mv } from './layout.js';
import { terrainH } from './landscape.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o });
function add(p, g, m, pos = [0, 0, 0], rot = [0, 0, 0], sc = null) { const x = new THREE.Mesh(g, m); x.position.set(...pos); x.rotation.set(...rot); if (sc) x.scale.set(...sc); x.castShadow = true; p.add(x); return x; }
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const S = { sph: new THREE.IcosahedronGeometry(1, 1), cyl: new THREE.CylinderGeometry(1, 0.8, 1, 6), cone: new THREE.ConeGeometry(1, 1, 5) };

// ── low-poly quadruped ──
function quad(o) {
  const { len = 1, h = 1, body = 0x8a7560, belly = null, head = null, legC = null, neck = 0.35, ears = 'deer', tail = 'short', tailC = null, hump = false, horns = null, beard = false, stripe = null, spines = false, mask = false, lf = 0.55, gf = 0.24, lt = 0.045 } = o;
  const g = new THREE.Group(), B = mat(body), H = head != null ? mat(head) : B, L = legC != null ? mat(legC) : B;
  const legH = h * lf, bodyR = h * gf;
  const torso = new THREE.Group(); torso.position.y = legH + bodyR * 0.6; g.add(torso);
  add(torso, S.sph, B, [0, 0, 0], [0, 0, 0], [bodyR, bodyR * 1.05, len * 0.5]);
  if (belly != null) add(torso, S.sph, mat(belly), [0, -bodyR * 0.35, 0], [0, 0, 0], [bodyR * 0.8, bodyR * 0.7, len * 0.42]);
  if (hump) add(torso, S.sph, B, [0, bodyR * 0.75, len * 0.28], [0, 0, 0], [bodyR * 0.7, bodyR * 0.55, len * 0.22]);
  if (stripe != null) add(torso, S.sph, mat(stripe), [0, bodyR * 0.55, 0], [0, 0, 0], [bodyR * 0.35, bodyR * 0.55, len * 0.5]);
  if (spines) for (let i = 0; i < 22; i++) { const a = rnd(-1.2, 1.2), zz = rnd(-0.45, 0.4) * len; add(torso, S.cone, mat(i % 3 ? 0xcfc0a0 : 0x3a2c22), [Math.sin(a) * bodyR, Math.cos(a) * bodyR * 0.9, zz], [-0.6 + Math.cos(a) * 0.2, 0, -a], [0.03, h * 0.28, 0.03]); }
  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const lp = new THREE.Group(); lp.position.set(sx * bodyR * 0.55, legH, sz * len * 0.32); g.add(lp); add(lp, S.cyl, L, [0, -legH / 2, 0], [0, 0, 0], [h * lt, legH, h * lt]); legs.push(lp); }
  const nk = new THREE.Group(); nk.position.set(0, bodyR * 0.4, len * 0.45); torso.add(nk); nk.rotation.x = -0.5;
  add(nk, S.cyl, B, [0, neck * h * 0.5, 0], [0, 0, 0], [h * 0.09, neck * h, h * 0.09]);
  const hd = new THREE.Group(); hd.position.y = neck * h; nk.add(hd); hd.rotation.x = 0.5;
  add(hd, S.sph, H, [0, 0, h * 0.06], [0, 0, 0], [h * 0.12, h * 0.12, h * 0.17]); add(hd, S.sph, H, [0, -h * 0.03, h * 0.2], [0, 0, 0], [h * 0.07, h * 0.07, h * 0.1]);
  add(hd, S.sph, mat(0x111111), [0, -h * 0.01, h * 0.29], [0, 0, 0], [h * 0.025, h * 0.022, h * 0.02]);
  if (mask) add(hd, S.sph, mat(0x1a1716), [0, h * 0.03, h * 0.12], [0, 0, 0], [h * 0.125, h * 0.04, h * 0.08]);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffe680, emissiveIntensity: 0 });
  for (const s of [-1, 1]) add(hd, S.sph, eyeM, [s * h * 0.07, h * 0.04, h * 0.14], [0, 0, 0], [h * 0.022, h * 0.022, h * 0.022]);
  for (const s of [-1, 1]) {
    if (ears === 'deer') add(hd, S.cone, H, [s * h * 0.1, h * 0.12, 0], [0, 0, -s * 0.9], [h * 0.05, h * 0.14, h * 0.025]);
    else if (ears === 'mule') add(hd, S.cone, H, [s * h * 0.12, h * 0.13, 0], [0, 0, -s * 1.0], [h * 0.08, h * 0.2, h * 0.03]);
    else if (ears === 'round') add(hd, S.sph, H, [s * h * 0.09, h * 0.11, -h * 0.02], [0, 0, 0], [h * 0.04, h * 0.04, h * 0.02]);
    else if (ears === 'pointy') add(hd, S.cone, H, [s * h * 0.07, h * 0.14, 0], [0, 0, -s * 0.15], [h * 0.04, h * 0.1, h * 0.025]);
    else if (ears === 'hare') add(hd, S.cone, H, [s * h * 0.05, h * 0.24, -h * 0.03], [-0.25, 0, -s * 0.12], [h * 0.04, h * 0.32, h * 0.025]);
  }
  if (horns === 'curl') for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(h * 0.09, h * 0.035, 5, 10, 4.6), mat(0xc9b48a)); t.position.set(s * h * 0.1, h * 0.08, 0); t.rotation.set(0, s * 1.4, 0.4); hd.add(t); }
  if (horns === 'goat') for (const s of [-1, 1]) add(hd, S.cone, mat(0x1a1a1a), [s * h * 0.05, h * 0.16, -h * 0.03], [-0.4, 0, 0], [h * 0.02, h * 0.14, h * 0.02]);
  if (horns === 'antler' || horns === 'palm') for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * h * 0.06, h * 0.12, 0); a.rotation.z = -s * 0.5; hd.add(a); const am = mat(0xd8c8a4);
    add(a, S.cyl, am, [0, h * 0.12, 0], [0, 0, 0], [h * 0.015, h * 0.24, h * 0.015]);
    if (horns === 'palm') add(a, S.sph, am, [s * h * 0.14, h * 0.24, 0], [0, 0, 0], [h * 0.18, h * 0.04, h * 0.12]);
    else for (let k = 0; k < 3; k++) add(a, S.cyl, am, [0, h * (0.12 + k * 0.06), h * 0.04], [0.8, 0, 0], [h * 0.012, h * 0.1, h * 0.012]); }
  if (beard) add(hd, S.cone, H, [0, -h * 0.12, h * 0.1], [Math.PI, 0, 0], [h * 0.04, h * 0.12, h * 0.04]);
  if (horns === 'bell') add(hd, S.sph, B, [0, -h * 0.14, h * 0.05], [0, 0, 0], [h * 0.03, h * 0.08, h * 0.03]);
  const tl = new THREE.Group(); tl.position.set(0, bodyR * 0.3, -len * 0.48); torso.add(tl); const TC = tailC != null ? mat(tailC) : B;
  if (tail === 'short') add(tl, S.sph, TC, [0, 0, -h * 0.03], [0, 0, 0], [h * 0.05, h * 0.07, h * 0.04]);
  else if (tail === 'flag') { tl.rotation.x = -0.9; add(tl, S.sph, TC, [0, 0, -h * 0.07], [0, 0, 0], [h * 0.06, h * 0.05, h * 0.1]); }
  else if (tail === 'long') { tl.rotation.x = 0.7; add(tl, S.cyl, B, [0, 0, -len * 0.28], [Math.PI / 2, 0, 0], [h * 0.03, len * 0.55, h * 0.03]); add(tl, S.sph, TC, [0, 0, -len * 0.56], [0, 0, 0], [h * 0.04, h * 0.04, h * 0.06]); }
  else if (tail === 'bushy') { tl.rotation.x = 0.6; add(tl, S.sph, B, [0, 0, -len * 0.22], [0, 0, 0], [h * 0.08, h * 0.08, len * 0.25]); if (tailC != null) add(tl, S.sph, TC, [0, 0, -len * 0.45], [0, 0, 0], [h * 0.06, h * 0.06, h * 0.07]); }
  else if (tail === 'plume') { tl.rotation.x = -1.2; add(tl, S.sph, B, [0, 0, -len * 0.2], [0, 0, 0], [h * 0.14, h * 0.12, len * 0.28]); if (tailC != null) add(tl, S.sph, TC, [0, h * 0.04, -len * 0.2], [0, 0, 0], [h * 0.05, h * 0.13, len * 0.25]); }
  else if (tail === 'flat') { add(tl, S.sph, mat(0x2a2018), [0, -h * 0.05, -len * 0.18], [0, 0, 0], [h * 0.12, h * 0.025, len * 0.2]); }
  g.userData = { legs, torso, nk, hd, tl, eyeM, h, len, legH };
  return g;
}
// ── birds ──
function bird(o) {
  const { s = 1, body = 0x3a2a1a, head = null, belly = null, wing = null, beak = 0xf0c040, tail = 0, crest = null, neck = 0, legs = 0 } = o;
  const g = new THREE.Group(), B = mat(body);
  const core = new THREE.Group(); core.position.y = legs * s; g.add(core);
  add(core, S.sph, B, [0, 0, 0], [0, 0, 0], [s * 0.18, s * 0.17, s * 0.32]);
  if (belly != null) add(core, S.sph, mat(belly), [0, -s * 0.05, s * 0.03], [0, 0, 0], [s * 0.15, s * 0.13, s * 0.27]);
  const hd = new THREE.Group(); hd.position.set(0, s * (0.12 + neck), s * (0.28 + neck * 0.2)); core.add(hd);
  if (neck) add(core, S.cyl, head != null ? mat(head) : B, [0, s * (0.06 + neck / 2), s * 0.28], [0.25, 0, 0], [s * 0.045, s * neck, s * 0.045]);
  add(hd, S.sph, head != null ? mat(head) : B, [0, 0, 0], [0, 0, 0], [s * 0.1, s * 0.1, s * 0.12]);
  add(hd, S.cone, mat(beak), [0, -s * 0.01, s * (0.15 + neck * 0.15)], [Math.PI / 2, 0, 0], [s * 0.035, s * (0.1 + neck * 0.3), s * 0.03]);
  for (const sx of [-1, 1]) add(hd, S.sph, mat(0x111111), [sx * s * 0.06, s * 0.03, s * 0.07], [0, 0, 0], [s * 0.018, s * 0.018, s * 0.018]);
  if (crest != null) add(hd, S.cone, mat(crest), [0, s * 0.12, -s * 0.04], [-0.5, 0, 0], [s * 0.05, s * 0.14, s * 0.04]);
  if (tail) add(core, S.cone, B, [0, s * 0.02, -s * (0.3 + tail * 0.3)], [-Math.PI / 2, 0, 0], [s * 0.06, s * tail * 0.7, s * 0.02]);
  const wings = [-1, 1].map((sx) => { const w = new THREE.Group(); w.position.set(sx * s * 0.12, s * 0.06, 0); core.add(w); add(w, S.sph, mat(wing ?? body), [sx * s * 0.3, 0, -s * 0.03], [0, 0, 0], [s * 0.34, s * 0.025, s * 0.15]); return w; });
  const lg = []; if (legs) for (const sx of [-1, 1]) lg.push(add(g, S.cyl, mat(0x6a6a5a), [sx * s * 0.05, legs * s / 2, 0], [0, 0, 0], [s * 0.015, legs * s, s * 0.015]));
  g.userData = { wings, hd, core, legs: lg, s };
  return g;
}

// species table: habitat, time of day, months present, rarity
const M = (a, b) => (m) => (a <= b ? m >= a && m <= b : m >= a || m <= b);
const ALL = () => true;
export const SPECIES = {
  muledeer: { name: 'mule deer', hab: 'bank', when: ['dawn', 'dusk', 'day'], w: 9, make: (s) => quad({ len: 1.2, h: 1.3, body: 0x8f7a62, belly: 0xd8ccb4, ears: 'mule', tail: 'short', tailC: 0x222222, horns: s.antlers ? 'antler' : null }) },
  whitetail: { name: 'white-tailed deer', hab: 'bank', when: ['dawn', 'dusk', 'day'], w: 11, make: (s) => quad({ len: 1.15, h: 1.25, body: 0x9a6c46, belly: 0xefe6d8, ears: 'deer', tail: 'flag', tailC: 0xf8f4ee, horns: s.antlers ? 'antler' : null }) },
  moose: { name: 'moose', hab: 'bank', when: ['dawn', 'dusk', 'day'], w: 3, make: (s) => quad({ len: 1.8, h: 2.3, body: 0x3a2a1e, legC: 0x8a7a68, ears: 'deer', hump: true, horns: s.antlers ? 'palm' : 'bell', neck: 0.25 }) },
  bighorn: { name: 'bighorn sheep', hab: 'slope', when: ['day', 'dawn', 'dusk'], w: 3, scale: 3.2, make: () => quad({ len: 1.0, h: 1.0, body: 0x8a7660, belly: 0xeee6d6, tail: 'short', tailC: 0xeee6d6, horns: 'curl', ears: 'pointy' }) },
  goat: { name: 'mountain goat (Trapper Peak side)', hab: 'high', when: ['day', 'dawn', 'dusk'], w: 3, scale: 4, make: () => quad({ len: 0.95, h: 1.0, body: 0xf4f2ea, horns: 'goat', beard: true, ears: 'pointy', hump: true }) },
  coyote: { name: 'coyote', hab: 'bank', when: ['dawn', 'dusk', 'night', 'day'], w: 5, make: () => quad({ len: 0.85, h: 0.75, body: 0xa88c68, belly: 0xe2d6c0, legC: 0x9a6e48, ears: 'pointy', tail: 'bushy', tailC: 0x2a241e }) },
  fox: { name: 'red fox', hab: 'bank', when: ['dawn', 'dusk', 'night', 'day'], w: 5, make: () => quad({ len: 0.7, h: 0.55, body: 0xd0602a, belly: 0xf4eee4, legC: 0x241a14, ears: 'pointy', tail: 'bushy', tailC: 0xffffff }) },
  hare: { name: 'snowshoe hare', hab: 'bank', when: ['dawn', 'dusk', 'night'], w: 4, hop: true, make: (s) => quad({ len: 0.38, h: 0.42, body: s.winter ? 0xf6f6f2 : 0x8a6a4a, ears: 'hare', tail: 'short', tailC: 0xffffff, neck: 0.15 }) },
  skunk: { name: 'striped skunk', hab: 'bank', when: ['night', 'dusk'], months: M(2, 10), w: 3, make: () => quad({ len: 0.55, h: 0.4, body: 0x141214, stripe: 0xf4f4f4, ears: 'round', tail: 'plume', tailC: 0xf4f4f4, neck: 0.12, lf: 0.35, gf: 0.32, lt: 0.07 }) },
  porcupine: { name: 'porcupine', hab: 'bank', when: ['night', 'dusk'], w: 3, slow: 0.4, make: () => quad({ len: 0.6, h: 0.5, body: 0x3a2c22, spines: true, ears: 'round', neck: 0.1, lf: 0.3, gf: 0.34, lt: 0.07 }) },
  blackbear: { name: 'black bear', hab: 'bank', when: ['dawn', 'dusk', 'day'], months: M(3, 10), w: 4, make: () => quad({ len: 1.25, h: 1.2, body: Math.random() < 0.25 ? 0x6a4028 : 0x1f1a18, head: null, ears: 'round', tail: 'short', neck: 0.14, lf: 0.36, gf: 0.36, lt: 0.1 }) },
  grizzly: { name: 'grizzly bear', hab: 'bank', when: ['dawn', 'dusk'], months: M(3, 10), w: 0.4, make: () => quad({ len: 1.45, h: 1.4, body: 0x8a6a48, legC: 0x4a3626, ears: 'round', tail: 'short', hump: true, neck: 0.14, lf: 0.36, gf: 0.37, lt: 0.11 }) },
  lion: { name: 'mountain lion', hab: 'bank', when: ['dusk', 'night', 'dawn'], w: 1.5, make: () => quad({ len: 1.35, h: 0.85, body: 0xc49a6a, belly: 0xeadfca, ears: 'round', tail: 'long', tailC: 0x2a221c, neck: 0.14, lf: 0.46, gf: 0.27, lt: 0.07 }) },
  wolf: { name: 'gray wolf', hab: 'bank', when: ['dawn', 'dusk', 'night'], w: 1.2, make: () => quad({ len: 1.05, h: 0.95, body: 0x86827c, belly: 0xd6d2ca, legC: 0x9c968c, ears: 'pointy', tail: 'bushy', tailC: 0x3a3632 }) },
  beaver: { name: 'beaver', hab: 'water', when: ['dusk', 'night', 'dawn'], w: 4, swim: true, make: () => quad({ len: 0.6, h: 0.42, body: 0x5a3a22, ears: 'round', tail: 'flat', neck: 0.1, lf: 0.3, gf: 0.32, lt: 0.08 }) },
  otter: { name: 'river otter', hab: 'water', when: ['day', 'dusk', 'dawn'], w: 4, swim: true, porpoise: true, make: () => quad({ len: 0.8, h: 0.35, body: 0x4a3222, belly: 0x8a6a4a, ears: 'round', tail: 'long', neck: 0.2, lf: 0.3, gf: 0.3, lt: 0.08 }) },
  // birds
  eagle: { name: 'bald eagle', hab: 'sky', when: ['day', 'dawn', 'dusk'], w: 4, bird: true, make: () => bird({ s: 1.6, body: 0x3a2618, head: 0xf8f6f0, beak: 0xf0c020, tail: 0.5 }) },
  osprey: { name: 'osprey', hab: 'sky', when: ['day'], months: M(3, 8), w: 4, bird: true, dive: true, make: () => bird({ s: 1.4, body: 0x4a3a2a, belly: 0xf6f2ea, head: 0xf2eee6, wing: 0x4a3a2a, beak: 0x222222, tail: 0.4 }) },
  heron: { name: 'great blue heron', hab: 'edge', when: ['day', 'dawn', 'dusk'], w: 4, bird: true, wade: true, make: () => bird({ s: 1.5, body: 0x7a8a9c, head: 0xe8ecef, beak: 0xe0b040, neck: 0.5, legs: 0.7, tail: 0.2 }) },
  geese: { name: 'Canada geese', hab: 'float', when: ['day', 'dawn', 'dusk'], w: 5, bird: true, flock: 4, make: () => bird({ s: 1.0, body: 0x8a7a66, head: 0x141414, belly: 0xd8d0c0, beak: 0x141414, neck: 0.3, tail: 0.2 }) },
  mallard: { name: 'mallards', hab: 'float', when: ['day', 'dawn', 'dusk'], w: 5, bird: true, flock: 3, make: (s) => bird({ s: 0.7, body: s.i % 2 ? 0x8a6a48 : 0x9a9a92, head: s.i % 2 ? 0x8a6a48 : 0x1a6a3a, belly: s.i % 2 ? null : 0x7a4a3a, beak: 0xe0c040, tail: 0.15 }) },
  magpie: { name: 'black-billed magpie', hab: 'island', when: ['day', 'dawn', 'dusk'], w: 4, bird: true, hop: true, make: () => bird({ s: 0.55, body: 0x111418, belly: 0xf6f6f6, wing: 0x1a2a4a, beak: 0x111111, tail: 1.3, legs: 0.18 }) },
  jay: { name: "Steller's jay", hab: 'island', when: ['day', 'dawn'], w: 4, bird: true, hop: true, make: () => bird({ s: 0.5, body: 0x1e4a8a, head: 0x14161c, wing: 0x2a5aa0, beak: 0x111111, crest: 0x14161c, tail: 0.7, legs: 0.18 }) },
};
const PRED = { blackbear: 'bear', grizzly: 'bear', lion: 'lion', wolf: 'wolf' };
const SNEAK = { coyote: 1, fox: 1 };
export const DENSITY = { off: 0, few: 3, normal: 6, lots: 11 };

export function createWildlife(scene, { state, mochi, life, features, say, music, sky, brain, go, settings, season, encounters, onChange = () => {} }) {
  const group = new THREE.Group(); group.name = 'wildlife'; scene.add(group);
  const month = (() => { const s = season; const m = new Date().getMonth(); if (s === 'winter' && !(m === 11 || m <= 1)) return 0; if (s === 'summer' && !(m >= 5 && m <= 7)) return 6; if (s === 'spring' && !(m >= 2 && m <= 4)) return 3; if (s === 'fall' && !(m >= 8 && m <= 10)) return 9; return m; })();
  const winter = season === 'winter';
  let courage = Number.isFinite(+state.courage) ? Math.max(0, Math.min(100, +state.courage)) : 50;
  const live = []; let lock = null, spawnT = 2, eventT = rnd(50, 110), ev = null;
  const mpos = () => mochi.root.position;
  const tod = () => { const n = sky.state.night, gl = sky.state.golden; return n > 0.6 ? 'night' : gl > 0.25 || (n > 0.2 && n <= 0.6) ? (isDawnish() ? 'dawn' : 'dusk') : 'day'; };
  const isDawnish = () => { const h = new Date().getHours(); return h < 12; };
  const density = () => DENSITY[settings.get().wildlife] ?? 6;

  // places
  const sideX = (z, side, off) => riverX(z) + side * (riverW(z) + off);
  const bankY = (x, z) => Math.max(terrainH(x, z), WATER_Y);
  function edgePt(side, z) { const x = sideX(z, side, 1.2); return new THREE.Vector3(x, bankY(x, z), z); }
  // beaver lodge on the west bank
  { const z = -14, x = sideX(z, -1, -1.5); const lodge = new THREE.Group(); lodge.position.set(x, WATER_Y - 0.2, z); group.add(lodge); const sm = mat(0x6a4e34);
    for (let i = 0; i < 40; i++) { const a = rnd(0, 6.28), r = rnd(0.2, 1.6); add(lodge, S.cyl, i % 3 ? sm : mat(0x8a6a48), [Math.cos(a) * r, (1.6 - r) * 0.7 + rnd(0, 0.2), Math.sin(a) * r], [rnd(-1, 1), rnd(0, 3), 1.2 + rnd(-0.4, 0.4)], [0.06, rnd(0.8, 1.6), 0.06]); }
    add(lodge, S.sph, mat(0x4a3826), [0, 0.2, 0], [0, 0, 0], [1.7, 1.0, 1.7]); }

  function spawn(key, opts = {}) {
    const sp = SPECIES[key]; const n = sp.flock ? Math.max(1, Math.round(sp.flock * rnd(0.6, 1.3))) : 1; const made = [];
    const side = opts.side ?? (Math.random() < 0.7 ? -1 : 1); const z0 = opts.z ?? rnd(-45, 45);
    for (let i = 0; i < n; i++) {
      const m = sp.make({ antlers: month >= 8 || month <= 0 ? Math.random() < 0.5 : false, winter: winter || month >= 10 || month <= 2, i });
      m.scale.setScalar(sp.scale || 1); group.add(m);
      const a = { key, sp, m, side, t: 0, phase: 'in', life: rnd(40, 80), i, speed: (sp.slow || 1) * rnd(0.9, 1.4), wp: [], idle: 0, pred: PRED[key], vis: 0, ...opts };
      const hab = sp.hab;
      if (hab === 'bank' || hab === 'edge') { const zz = z0 + i * 1.5; const far = new THREE.Vector3(sideX(zz + rnd(-15, 15), side, rnd(18, 34)), 0, zz + rnd(-15, 15)); const edge = edgePt(side, zz + rnd(-3, 3)); a.from = far; a.wp = [edge]; a.edge = edge; m.position.set(far.x, bankY(far.x, far.z), far.z); }
      else if (hab === 'slope' || hab === 'high') { const zz = rnd(-200, 120); const off = hab === 'high' ? rnd(230, 320) : rnd(120, 220); const s2 = hab === 'high' ? -1 : side; const x = sideX(zz, s2, off); a.base = new THREE.Vector3(x, terrainH(x, zz), zz); m.position.copy(a.base); a.wp = [new THREE.Vector3(x + rnd(-14, 14), 0, zz + rnd(-14, 14))]; }
      else if (hab === 'water' || hab === 'float') { const zz = z0 + i * 0.9; const x = riverX(zz) + side * (riverW(zz) - rnd(2, 6)); m.position.set(x, WATER_Y, zz); a.wp = [new THREE.Vector3(x + rnd(-3, 3) + i * 0.6, 0, zz + rnd(18, 34) * (Math.random() < 0.5 ? -1 : 1))]; }
      else if (hab === 'sky') { a.c = new THREE.Vector3(rnd(-40, 40), rnd(16, 28), rnd(-40, 40)); a.r = rnd(14, 26); a.ang = rnd(0, 6.28); }
      else if (hab === 'island') { const zs = ZONES.filter((q) => ['garden', 'picnic', 'hut', 'campfire', 'meadow', 'squirrel'].includes(q.id)); const q = pick(zs); const x = q.pos[0] + rnd(-2.5, 2.5), z = q.pos[1] + rnd(-2.5, 2.5); m.position.set(x, groundY(x, z) + 9, z); a.land = new THREE.Vector3(x, groundY(x, z), z); a.phase = 'fly-in'; }
      m.userData.a = a; live.push(a); made.push(a);
    }
    return made;
  }
  function despawn(a) { group.remove(a.m); live.splice(live.indexOf(a), 1); }

  function eligible(k) { const sp = SPECIES[k]; if (PRED[k]) return false; if (sp.months && !sp.months(month)) return false; if (winter && (k === 'beaver' || k === 'skunk')) return false; const t = tod(); return sp.when.includes(t); }
  function ambientSpawn() {
    const want = density(); const amb = live.filter((a) => !a.event).length; if (amb >= want) return;
    const keys = Object.keys(SPECIES).filter(eligible); if (!keys.length) return; let tot = keys.reduce((s, k) => s + SPECIES[k].w, 0), r = Math.random() * tot; let k = keys[0]; for (const q of keys) { r -= SPECIES[q].w; if (r <= 0) { k = q; break; } }
    if (live.some((a) => a.key === k) && Math.random() < 0.6) return; spawn(k);
  }

  // ── predator events ──
  const LINES = {
    spot: { bear: ['...is that a BEAR. across the river. hi bear. stay there bear', 'bear on the far bank. i am very small and very still', 'big fuzzy guy drinking over there. we are both just thirsty'], lion: ['mountain lion over there. majestic. please keep being majestic OVER THERE', 'a big cat is looking at me. i am not a snack. i am a bird'], wolf: ['a wolf on the bank. pretty. scary. pretty scary', 'wolf. watching. i am also watching. this is a staring contest now'] },
    cross: { bear: ['oh no it is SWIMMING', 'the bear is coming over. ok. plan. i have a plan. (i do not have a plan)'], lion: ['the cat is crossing. cats hate water. this cat does not know that'], wolf: ['wolf is wading over. ok ok ok'] },
    puff: 'I AM VERY BIG. LOOK AT MY CAPE. GO HOME', pot: '*CLANG CLANG CLANG* this is my island!!', spray: '*psssht* bear spray. sorry. please leave', hide: 'nope. hiding in the hut. this is my hut', climb: 'treehouse. up. now.',
    left: ['it left. it LEFT. i am basically a ranger now', 'it backed off. my heart is going 900 bpm', 'and STAY on your side of the river (respectfully)'],
    shaken: ['ok that was a lot. i need a sit', 'i was brave on the outside. inside i was a scrambled egg'],
    watched: ['it wandered off. good. nice. normal day', 'it went back into the trees. i will be telling everyone about this'],
    sneak: { coyote: ['a coyote is sniffing around my fish bucket. SHOO', 'coyote! that is my whitefish'], fox: ['little fox, my fish are not for you', 'a fox wants my fish. no. absolutely not.'] },
  };
  const ago = () => new Date().toLocaleDateString('en-CA');
  function log(animal, at, outcome) { const e = { animal, at, outcome, date: ago() }; encounters.push(e); onChange(e, courage); }
  function startEvent(key, at = 'bank') {
    if (ev) return false; if (!SPECIES[key]) key = key === 'bear' ? (Math.random() < 0.1 ? 'grizzly' : 'blackbear') : key === 'cougar' || key === 'mountain lion' ? 'lion' : key;
    if (!SPECIES[key]) return false;
    const p = mpos(); const side = p.x + 0.0001 < riverX(p.z) ? -1 : 1; const ang = Math.atan2(p.z, p.x); const z = THREE.MathUtils.clamp(p.z + rnd(-8, 8), -40, 40);
    const sideToMochi = Math.abs(ang) > Math.PI / 2 ? -1 : 1;
    if (SNEAK[key] || at === 'dock') { // sneaky fish thief comes over the gravel bar to the dock bucket
      const [a] = spawn(key, { side: -1, z: DOCK.z0 ?? 0, event: true }); const th = DOCK.th + 0.6, R = islandRadius(th) + 1; a.m.position.set(Math.cos(th) * R, WATER_Y, Math.sin(th) * R);
      a.phase = 'sneak'; a.wp = [new THREE.Vector3(DOCK.x0 + DOCK.dx * 0.9, 0, DOCK.z0 + DOCK.dz * 0.9)]; ev = { a, kind: 'sneak', t: 0 }; return true;
    }
    const [a] = spawn(key, { side: sideToMochi, z, event: true }); a.phase = 'in'; a.life = 999;
    ev = { a, kind: PRED[key] || 'bear', t: 0, cross: at === 'island' || Math.random() < 0.3 };
    return true;
  }
  if (state.event && state.event.animal) setTimeout(() => startEvent(String(state.event.animal).toLowerCase(), state.event.at || 'bank'), 5000);

  // spray + pot fx
  const sprayM = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, depthWrite: false }); const spray = []; for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), sprayM.clone()); s.visible = false; group.add(s); spray.push(s); }
  const wakeM = []; for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); group.add(r); wakeM.push(r); } let wakeK = 0, wakeT = 0;
  const pot = features?.props?.pot;

  function defend(a) {
    // pick a response that suits the animal + how brave he's feeling
    const k = ev.kind; const brave = courage / 100; const r = Math.random();
    let how = k === 'bear' ? (r < 0.35 ? 'pot' : r < 0.6 ? 'spray' : r < 0.6 + 0.25 * brave ? 'puff' : 'climb') : k === 'lion' ? (r < 0.55 + 0.2 * brave ? 'puff' : r < 0.85 ? 'pot' : 'hide') : (r < 0.45 ? 'pot' : r < 0.8 ? 'puff' : 'hide');
    if (a.key === 'grizzly' && how === 'climb') how = 'spray'; // grizzlies climb too; spray is the move
    ev.how = how; ev.dt = 0; say(LINES[how], 3.5);
    if (how === 'hide') { lock = null; go('hut'); brain.wait = 25; brain.acted = true; }
    else if (how === 'climb') { lock = null; go('tree', 'treehouse'); }
  }
  function finishEvent(outcome, proud) {
    const a = ev.a; log(SPECIES[a.key].name, ev.where || 'bank', outcome);
    courage = Math.max(0, Math.min(100, courage + (proud ? 4 : outcome.startsWith('watched') ? 1 : -1)));
    lock = null; mochi.pose.puff = 0; if (pot && pot.parent === mochi.hold) mochi.hold.remove(pot); mochi.root.visible = true;
    setTimeout(() => { say(proud ? pick(LINES.left) : outcome.startsWith('watched') ? pick(LINES.watched) : pick(LINES.shaken), 4); if (proud) { mochi.hop(0.9); mochi.flap(1); } }, 1200);
    ev.done = true; brain.wait = Math.min(brain.wait, 3);
  }

  function walkTo(a, tgt, dt, spd, water = false) {
    const p = a.m.position; const dx = tgt.x - p.x, dz = tgt.z - p.z; const d = Math.hypot(dx, dz); if (d < 0.15) return true;
    const st = Math.min(d, spd * dt); p.x += (dx / d) * st; p.z += (dz / d) * st; const want = Math.atan2(dx, dz); let dh = want - a.m.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); a.m.rotation.y += dh * Math.min(1, dt * 5);
    const onIsl = Math.hypot(p.x, p.z) < islandRadius(Math.atan2(p.z, p.x)) + 0.5; const gy = onIsl ? groundY(p.x, p.z) : terrainH(p.x, p.z);
    const swimming = water || gy < WATER_Y - 0.15; a.swim = swimming;
    p.y = swimming ? WATER_Y - (a.m.userData.h || 0.5) * (a.sp.swim ? 0.35 : 0.55) * (a.sp.scale || 1) : gy;
    const L = a.m.userData.legs; if (L && !a.sp.bird) { const f = Math.sin(a.t * spd * 5); L.forEach((l, i) => (l.rotation.x = (i === 0 || i === 3 ? f : -f) * (swimming ? 0.9 : 0.5))); }
    if (a.sp.hop && !a.sp.bird) p.y += Math.abs(Math.sin(a.t * 9)) * 0.15;
    return false;
  }
  function headDown(a, v) { const u = a.m.userData; if (u.nk) u.nk.rotation.x = THREE.MathUtils.lerp(u.nk.rotation.x, v ? 1.2 : -0.5, 0.05); }

  function updateAgent(a, dt, t, night) {
    a.t += dt; const u = a.m.userData; const sp = a.sp;
    if (u.eyeM) u.eyeM.emissiveIntensity = night > 0.5 && (a.pred || a.key === 'coyote' || a.key === 'fox' || a.key === 'lion') ? 1.6 : 0;
    if (sp.hab === 'sky') { // soaring circles; osprey sometimes dives for a fish
      a.ang += dt * (18 / a.r) * 0.25; const p = a.m.position; let y = a.c.y + Math.sin(a.t * 0.3) * 2;
      if (sp.dive && !a.dv && Math.random() < dt * 0.03) a.dv = { t: 0 };
      if (a.dv) { a.dv.t += dt; const k = a.dv.t < 1.6 ? a.dv.t / 1.6 : Math.max(0, 1 - (a.dv.t - 1.6) / 2.5); y = THREE.MathUtils.lerp(y, WATER_Y + 0.4, k * k); if (a.dv.t > 1.55 && a.dv.t < 1.65 && !a.dv.sp) { a.dv.sp = 1; ring(p.x, p.z); } if (a.dv.t > 4.1) a.dv = null; }
      p.set(a.c.x + Math.cos(a.ang) * a.r, y, a.c.z + Math.sin(a.ang) * a.r); a.m.rotation.y = -a.ang; a.m.rotation.z = -0.25;
      const f = a.dv && a.dv.t > 1.6 ? Math.sin(t * 14) * 0.7 : Math.sin(t * 2.2) * 0.12; u.wings[0].rotation.z = f; u.wings[1].rotation.z = -f;
      if (a.t > a.life) { a.c.y += dt * 6; if (a.t > a.life + 10) despawn(a); } return;
    }
    if (sp.hab === 'island') { // magpies/jays drop in, hop around, peck, fly off (and dodge Mochi)
      const p = a.m.position;
      if (a.phase === 'fly-in') { p.lerp(a.land, Math.min(1, dt * 1.6)); const f = Math.sin(t * 20) * 0.8; u.wings[0].rotation.z = f; u.wings[1].rotation.z = -f; if (p.distanceTo(a.land) < 0.08) a.phase = 'hop'; return; }
      if (a.phase === 'hop') { u.wings[0].rotation.z = u.wings[1].rotation.z = 0; a.idle -= dt; if (a.idle < 0) { a.idle = rnd(0.6, 2); a.tgt = new THREE.Vector3(a.land.x + rnd(-1.5, 1.5), 0, a.land.z + rnd(-1.5, 1.5)); }
        if (a.tgt) { const d = a.tgt.clone().sub(p); d.y = 0; if (d.length() > 0.05) { p.addScaledVector(d.normalize(), dt * 0.9); a.m.rotation.y = Math.atan2(d.x, d.z); p.y = groundY(p.x, p.z) + Math.abs(Math.sin(a.t * 12)) * 0.08; } else { u.hd.rotation.x = Math.sin(a.t * 10) > 0.6 ? 0.6 : 0; p.y = groundY(p.x, p.z); } }
        if (p.distanceTo(mpos()) < 1.4 || a.t > a.life) { a.phase = 'fly-out'; a.out = p.clone().add(new THREE.Vector3(rnd(-20, 20), 14, rnd(-20, 20))); } return; }
      if (a.phase === 'fly-out') { p.lerp(a.out, dt * 0.6); const f = Math.sin(t * 20) * 0.8; u.wings[0].rotation.z = f; u.wings[1].rotation.z = -f; if (p.distanceTo(a.out) < 1) despawn(a); } return;
    }
    if (sp.hab === 'float' || sp.hab === 'water') { // drift with the river / swim
      const tgt = a.wp[0]; const done = walkTo(a, tgt, dt, a.sp.swim ? 0.9 : 0.35, true); a.m.position.y = WATER_Y - (sp.bird ? 0.05 : 0.12) + (sp.porpoise ? Math.max(0, Math.sin(a.t * 2.5)) * 0.3 : 0);
      if (sp.porpoise) a.m.rotation.x = Math.cos(a.t * 2.5) * 0.3; if (sp.bird) { u.hd.rotation.x = Math.sin(a.t * 0.7 + a.i) > 0.85 ? 0.9 : 0; }
      if (a.key === 'beaver' && Math.random() < dt * 0.05) { ring(a.m.position.x, a.m.position.z); } // tail slap
      if (done || a.t > a.life) despawn(a); return;
    }
    if (sp.hab === 'slope' || sp.hab === 'high') { const done = walkTo(a, a.wp[0], dt, 0.6 * (sp.scale || 1)); if (done) { a.idle += dt; headDown(a, true); if (a.idle > 6) { a.idle = 0; a.wp[0] = a.base.clone().add(new THREE.Vector3(rnd(-16, 16), 0, rnd(-16, 16))); } } if (a.t > a.life * 2) despawn(a); return; }
    // bank animals: come to the water, drink, look around, go back to the treeline
    if (a.event) return; // handled by the event driver
    const p = a.m.position;
    if (a.phase === 'in') { if (walkTo(a, a.wp[0], dt, 1.1 * a.speed)) { a.phase = sp.wade ? 'wade' : 'drink'; a.idle = rnd(6, 14); } }
    else if (a.phase === 'drink' || a.phase === 'wade') { a.idle -= dt; headDown(a, a.phase === 'drink' ? Math.sin(a.t * 0.5) > -0.4 : Math.sin(a.t * 0.3) > 0.7); if (a.phase === 'wade') { u.core.position.y += 0; if (Math.random() < dt * 0.06) { ring(p.x, p.z); } }
      if (a.idle < 0) { a.phase = 'out'; a.wp = [a.from.clone().add(new THREE.Vector3(0, 0, rnd(-20, 20)))]; } }
    else if (a.phase === 'out') { headDown(a, false); if (walkTo(a, a.wp[0], dt, 1.2 * a.speed)) despawn(a); }
  }
  function ring(x, z) { const r = wakeM[wakeK++ % wakeM.length]; r.position.set(x, WATER_Y + 0.03, z); r.userData.t = 0; r.material.opacity = 0.7; r.scale.setScalar(0.5); }

  function updateEvent(dt, t) {
    const e = ev; const a = e.a; e.t += dt; const p = a.m.position; const mp = mpos();
    const faceM = () => Math.atan2(p.x - mp.x, p.z - mp.z);
    if (e.kind === 'sneak') {
      if (a.phase === 'sneak') { if (walkTo(a, a.wp[0], dt, 0.9)) { a.phase = 'grab'; e.t = 0; say(pick(LINES.sneak[a.key] || LINES.sneak.fox), 3); lock = { face: faceM() }; } }
      else if (a.phase === 'grab') { lock.face = faceM(); if (e.t < 0.1) { mochi.flap(1); mochi.hop(0.7); }
        if (e.t > 2.4) { const has = Object.values(life.inv.fish).some((v) => v > 0); const shoo = !has || Math.random() < 0.45 + courage / 300; if (shoo) { log(SPECIES[a.key].name, 'dock', 'shooed it off the dock'); courage = Math.min(100, courage + 2); say('SHOO. and stay shooed', 2.5); } else { const f = life.steal(a.key); onChange(); say(`it got my ${f || 'fish'}. sigh. it has to eat too i guess`, 3.5); }
          a.phase = 'flee'; const th = Math.atan2(p.z, p.x); a.wp = [new THREE.Vector3(Math.cos(th) * 40, 0, Math.sin(th) * 40)]; lock = null; } }
      else if (a.phase === 'flee') { if (walkTo(a, a.wp[0], dt, 3)) { despawn(a); ev = null; } }
      return;
    }
    if (e.done) { if (walkTo(a, e.home, dt, a.swim ? 1.4 : 2.4)) { despawn(a); ev = null; } return; }
    if (a.phase === 'in') { if (walkTo(a, a.wp[0], dt, 1.2)) { a.phase = 'watch'; e.t = 0; say(pick(LINES.spot[e.kind]), 4); music.sfx('click'); } return; }
    if (a.phase === 'watch') { // across the river: stare-off. he gets nervous and watches.
      headDown(a, Math.sin(e.t * 0.6) > 0.3); lock = { face: faceM() }; mochi.pose.puff = 0.12 + Math.sin(t * 22) * 0.03;
      if (e.t > 9) { if (e.cross) { a.phase = 'cross'; say(pick(LINES.cross[e.kind]), 3.5); const th = Math.atan2(mp.z - p.z, mp.x - p.x) + Math.PI; const ang = Math.atan2(p.z, p.x); const R = islandRadius(ang) - 1.2; a.wp = [new THREE.Vector3(Math.cos(ang) * R, 0, Math.sin(ang) * R)]; e.where = 'island'; void th; }
        else { e.home = a.from.clone(); finishEvent('watched it from across the river', false); } }
      return;
    }
    if (a.phase === 'cross') { lock = { face: faceM() }; mochi.pose.puff = 0.15; wakeT -= dt; if (a.swim && wakeT < 0) { wakeT = 0.5; ring(p.x, p.z); }
      if (walkTo(a, a.wp[0], dt, 1.0)) { a.phase = 'approach'; } return; }
    if (a.phase === 'approach') { const d = p.distanceTo(mp); const tgt = mp.clone().add(p.clone().sub(mp).setY(0).normalize().multiplyScalar(5));
      if (!e.how) { lock = { face: faceM() }; if (d < 9 || walkTo(a, tgt, dt, 0.9)) { a.phase = 'standoff'; e.t = 0; defend(a); } else return; }
      return; }
    if (a.phase === 'standoff') { const how = e.how; e.dt += dt;
      if (how === 'puff') { lock = { face: faceM() }; mochi.pose.puff = Math.min(1, e.dt * 1.5); if (Math.random() < dt * 3) mochi.flap(1); }
      if (how === 'pot') { lock = { face: faceM() }; if (pot && pot.parent !== mochi.hold) { mochi.hold.add(pot); pot.position.set(0, 0.2, 0); pot.rotation.set(0, 0, 0); pot.visible = true; } if (Math.floor(e.dt * 3) !== Math.floor((e.dt - dt) * 3)) { music.sfx('clang'); mochi.hop(0.3); } }
      if (how === 'spray') { lock = { face: faceM() }; if (e.dt > 0.8 && !e.sprayed) { e.sprayed = 1; music.sfx('spray'); const dir = p.clone().sub(mp).setY(0).normalize(); spray.forEach((s, i) => { s.visible = true; s.userData = { t: -i * 0.05, o: mp.clone().add(new THREE.Vector3(0, 0.6, 0)).addScaledVector(dir, 0.6), dir }; }); } }
      if (how === 'hide') { const hz = ZONES.find((q) => q.id === 'hut'); if (Math.hypot(mp.x - hz.spot[0], mp.z - hz.spot[1]) < 0.6) mochi.root.visible = false; }
      if (e.dt > (how === 'hide' || how === 'climb' ? 10 : 4.5)) { // the predator backs off: turns, trots back, swims home
        e.home = a.from.clone(); const proud = how === 'puff' || how === 'pot' || how === 'spray';
        const out = { puff: 'puffed up + flapped my cape; it backed off', pot: 'banged a pot; it backed off', spray: 'bear spray puff; it backed off', hide: 'hid in the hut; it wandered off', climb: 'climbed the treehouse; it wandered off' }[how];
        finishEvent(out, proud);
      }
    }
  }

  function update(t, dt, night) {
    // fx
    for (const r of wakeM) if (r.userData.t != null) { r.userData.t += dt; const u = r.userData.t; r.scale.setScalar(0.5 + u * 2.2); r.material.opacity = Math.max(0, 0.7 * (1 - u / 1.4)); }
    for (const s of spray) if (s.visible) { const d = s.userData; d.t += dt; if (d.t < 0) continue; s.position.copy(d.o).addScaledVector(d.dir, d.t * 3.2).add(new THREE.Vector3(0, d.t * 0.3, 0)); s.scale.setScalar(0.5 + d.t * 3); s.material.opacity = Math.max(0, 0.55 * (1 - d.t / 1.6)); if (d.t > 1.6) s.visible = false; }
    if (density() === 0 && !ev) { for (const a of [...live]) despawn(a); return; }
    spawnT -= dt; if (spawnT < 0) { spawnT = rnd(3, 9); ambientSpawn(); }
    for (const a of [...live]) updateAgent(a, dt, t, night);
    // occasional predator / thief events, scaled by density + time of day
    if (!ev) { eventT -= dt * (density() / 6); if (eventT < 0) { eventT = rnd(150, 300);
      const td = tod(); const ok = Object.keys(PRED).filter((k) => (!SPECIES[k].months || SPECIES[k].months(month)) && SPECIES[k].when.includes(td));
      const fishy = Object.values(life.inv.fish).some((v) => v > 0) && (td !== 'day' || Math.random() < 0.3);
      if (fishy && Math.random() < 0.45) startEvent(Math.random() < 0.5 ? 'coyote' : 'fox', 'dock'); else if (ok.length) { let k = pick(ok); if (k === 'grizzly' && Math.random() < 0.7) k = 'blackbear'; startEvent(k); } } }
    else updateEvent(dt, t);
  }
  return { group, update, startEvent, spawn, get lock() { return lock; }, get courage() { return courage; }, get event() { return ev; }, live };
}
