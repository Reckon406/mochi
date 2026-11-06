// STATE.world: things Mochi placed/changed himself. { props: [{ id, kind, x?, z?, at?, dx?, dz?, note?, color? }], marks: [{ text, at | x,z }] }
import * as THREE from 'three';
import { ZONES, groundY, ISLAND_R, islandRadius } from './layout.js';
import { signTex, stripes } from './textures.js';
import { plank } from './signs.js';

const M = {}; const mat = (c, o = {}) => M[c + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
function add(p, g, m, pos = [0, 0, 0], rot = [0, 0, 0], sc = null) { const x = new THREE.Mesh(g, m); x.position.set(...pos); x.rotation.set(...rot); if (sc) x.scale.set(...sc); x.castShadow = true; x.receiveShadow = true; p.add(x); return x; }
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

// where does a prop/mark go? explicit x,z (island coords: centre 0,0, +x east, -z north, radius ~24) or a zone id/keyword + optional dx,dz
export function resolveSpot(o, i = 0) {
  if (Number.isFinite(+o.x) && Number.isFinite(+o.z) && o.x !== '' && o.z !== '') return [+o.x, +o.z];
  const at = String(o.at || '').toLowerCase(); const z = ZONES.find((q) => q.id === at) || ZONES.find((q) => q.keys.some((k) => at.includes(k)));
  if (!z) return null;
  const a = 0.9 + i * 2.39996; const r = 1.6 + (i % 3) * 0.45; // golden-angle spiral so several things at one place don't stack
  let x = z.spot[0] + num(o.dx, Math.cos(a) * r), zz = z.spot[1] + num(o.dz, Math.sin(a) * r);
  const R = islandRadius(Math.atan2(zz, x)) - 1.2, L = Math.hypot(x, zz); if (L > R && z.id !== 'beach' && z.id !== 'dock') { x *= R / L; zz *= R / L; }
  return [x, zz];
}

const BUILD = {
  lantern(g, o, ctx) { add(g, new THREE.CylinderGeometry(0.03, 0.04, 1.1, 6), mat(0x3a2a1a), [0, 0.55, 0]); add(g, new THREE.BoxGeometry(0.4, 0.04, 0.04), mat(0x3a2a1a), [0.15, 1.08, 0]);
    const m = new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: new THREE.Color(o.color || 0xffb04a), emissiveIntensity: 0.4 }); ctx.glow.push(m); add(g, new THREE.BoxGeometry(0.16, 0.22, 0.16), m, [0.3, 0.92, 0]); },
  sign(g, o) { add(g, new THREE.BoxGeometry(0.07, 0.95, 0.07), mat(0x6b4a33), [0, 0.47, -0.04]); const pk = plank(wrap(o.note || o.text || 'hi'), { width: 0.8, hand: true, twoSided: true, tone: 'pine', seed: String(o.note || '').length + 3 }); pk.position.set(0, 0.9, 0); pk.rotation.z = 0.03; g.add(pk); },
  flowers(g, o) { const cols = [0xff9aa2, 0xfff07a, 0xc9b6ff, 0xffffff, 0xffb347]; for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.12 + (i % 3) * 0.12; add(g, new THREE.CylinderGeometry(0.01, 0.01, 0.3, 3), mat(0x5a8a2a), [Math.cos(a) * r, 0.15, Math.sin(a) * r]); add(g, new THREE.SphereGeometry(0.06, 8, 6), mat(o.color ? new THREE.Color(o.color).getHex() : cols[i % 5]), [Math.cos(a) * r, 0.31, Math.sin(a) * r]); } },
  cairn(g) { [0.26, 0.21, 0.17, 0.13, 0.09].reduce((y, r, i) => { add(g, new THREE.DodecahedronGeometry(r, 1), mat([0x9a948e, 0x8a8580, 0xb0a89e][i % 3]), [Math.sin(i) * 0.03, y + r * 0.6, 0], [i, i * 2, 0], [1, 0.62, 1]); return y + r * 1.2; }, 0); },
  sockflag(g) { add(g, new THREE.CylinderGeometry(0.02, 0.02, 1.6, 5), mat(0xdddddd), [0, 0.8, 0]); const t = stripes(['#e8463c', '#fff4e0'], 6, false, 32, 128);
    add(g, new THREE.CapsuleGeometry(0.07, 0.4, 4, 10), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }), [0.26, 1.42, 0], [0, 0, Math.PI / 2 - 0.25]); },
  pumpkin(g) { add(g, new THREE.SphereGeometry(0.3, 18, 12), mat(0xf07d1f, { roughness: 0.55 }), [0, 0.24, 0], [0, 0, 0], [1, 0.8, 1]); add(g, new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6), mat(0x5a7a2a), [0, 0.5, 0]); },
  snowman(g) { add(g, new THREE.SphereGeometry(0.35, 16, 12), mat(0xf6f8ff), [0, 0.3, 0]); add(g, new THREE.SphereGeometry(0.25, 16, 12), mat(0xf6f8ff), [0, 0.78, 0]); add(g, new THREE.SphereGeometry(0.17, 16, 12), mat(0xf6f8ff), [0, 1.14, 0]);
    add(g, new THREE.ConeGeometry(0.035, 0.22, 8), mat(0xf28a2a), [0, 1.14, 0.2], [Math.PI / 2, 0, 0]); for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.025, 6, 4), mat(0x111111), [s * 0.06, 1.2, 0.15]); },
  birdhouse(g) { add(g, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), mat(0x7a5232), [0, 0.6, 0]); add(g, new THREE.BoxGeometry(0.34, 0.32, 0.3), mat(0x4fb3e8), [0, 1.35, 0]); add(g, new THREE.ConeGeometry(0.3, 0.2, 4), mat(0xc0563a), [0, 1.61, 0], [0, Math.PI / 4, 0]); add(g, new THREE.CircleGeometry(0.05, 12), mat(0x1a0f0a), [0, 1.38, 0.151]); },
  cap(g) { add(g, new THREE.CylinderGeometry(0.32, 0.32, 0.1, 21), mat(0xffcf3a, { metalness: 0.85, roughness: 0.25 }), [0, 0.32, 0], [Math.PI / 2 - 0.2, 0, 0]); },
  mushroom(g) { add(g, new THREE.CylinderGeometry(0.07, 0.09, 0.3, 8), mat(0xf6efe0), [0, 0.15, 0]); add(g, new THREE.SphereGeometry(0.22, 14, 8, 0, 6.29, 0, 1.6), mat(0xe8463c), [0, 0.28, 0], [0, 0, 0], [1, 0.7, 1]); },
  rock(g) { add(g, new THREE.DodecahedronGeometry(0.4, 1), mat(0x9a948e), [0, 0.2, 0], [0.3, 0.5, 0], [1.2, 0.7, 1]); },
};
BUILD.flower = BUILD.flowers; BUILD.rocks = BUILD.cairn; BUILD.flag = BUILD.sockflag; BUILD.light = BUILD.lantern; BUILD.note = BUILD.sign;
export const PROP_KINDS = Object.keys(BUILD);
function wrap(s) { const w = String(s).slice(0, 60).split(/\s+/); const out = ['']; for (const x of w) { if ((out[out.length - 1] + ' ' + x).trim().length > 16 && out.length < 3) out.push(x); else out[out.length - 1] = (out[out.length - 1] + ' ' + x).trim(); } return out; }

export function buildWorldState(scene, state) {
  const world = state.world && typeof state.world === 'object' ? state.world : {}; const group = new THREE.Group(); group.name = 'mochi-world-state'; scene.add(group);
  const ctx = { glow: [] }; const placed = [];
  (Array.isArray(world.props) ? world.props : []).slice(0, 40).forEach((o, i) => {
    if (!o || typeof o !== 'object') return; const p = resolveSpot(o, i); if (!p) return; const kind = String(o.kind || '').toLowerCase().replace(/[^a-z]/g, '');
    const g = new THREE.Group(); g.position.set(p[0], groundY(p[0], p[1]) - 0.02, p[1]); g.rotation.y = num(o.yaw, i * 1.3); group.add(g);
    (BUILD[kind] || ((gg) => BUILD.sign(gg, { note: o.note || kind || '?' })))(g, o, ctx);
    if (o.note && kind !== 'sign' && kind !== 'note') g.userData.note = String(o.note);
    placed.push({ id: o.id || `${kind}-${i}`, kind, x: p[0], z: p[1], note: o.note || '' });
  });
  (Array.isArray(world.marks) ? world.marks : []).slice(0, 16).forEach((m, i) => {
    if (!m || !m.text) return; const p = resolveSpot(m, i + 7); if (!p) return;
    const g = new THREE.Group(); g.position.set(p[0], groundY(p[0], p[1]) - 0.02, p[1]); g.rotation.y = Math.atan2(-p[0], -p[1]) + Math.sin(i) * 0.4; group.add(g);
    add(g, new THREE.BoxGeometry(0.07, 0.8, 0.07), mat(0x6b4a33), [0, 0.4, -0.03], [0.15, 0, 0]);
    { const pk = plank(wrap(m.text), { width: 0.75, hand: true, twoSided: true, tone: i % 2 ? 'cream' : 'pine', seed: i + 21 }); pk.position.set(0, 0.74, 0.03); pk.rotation.set(-0.15, 0, Math.sin(i * 1.7) * 0.06); g.add(pk); }
    placed.push({ id: `mark-${i}`, kind: 'mark', x: p[0], z: p[1], note: m.text });
  });
  return { group, placed, update(night) { for (const m of ctx.glow) m.emissiveIntensity = 0.4 + night * 4.5; } };
}
