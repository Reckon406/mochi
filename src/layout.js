import * as THREE from 'three';
// Island layout + walkable ground height
import { fbm, noise, smoothstep, clamp } from './noise.js';

// v2: the island grew ~1.7x. Old hand-placed spots are mapped with K (centres) / mv (clusters keep their shape)
export const K = 1.7;
export const ISLAND_R = 24;
export const CLIFF = { x: -11.3 * K, z: 3.2 * K, r: 4.2, h: 3.4 };
export const POND = { x: 2.6 * K, z: -1.2 * K, r: 3.2 };
export const ISLET = { x: 17.5, z: -30.5, r: 5.2, y: -0.55 };
// old anchor centres (pre-v2 coords); mv(x, z) moves anything near an anchor along with it
const ANCHORS = [[-4.2, -8.0], [4.4, -9.0], [2.6, -1.2], [-7.0, 6.4], [9.6, 6.0], [-1.0, 9.6], [-8.2, -3.4], [10.0, -4.6], [5.6, 9.0], [-11.3, 3.2], [-3.2, 1.6], [-8.9, 4.7]];
export function mv(x, z) { let b = ANCHORS[0], bd = Infinity; for (const a of ANCHORS) { const d = Math.hypot(x - a[0], z - a[1]); if (d < bd) { bd = d; b = a; } } return [x + (K - 1) * b[0], z + (K - 1) * b[1]]; }
export const BRIDGE = { ax: 0, az: 0, bx: 0, bz: 0, sag: 0.45, len: 1 }; // filled in below
export const POND_Y = -0.32;
export const LAGOON_Y = -0.95;
export const WATER_Y = -0.9;   // Bitterroot River surface
export const BED_Y = -2.8;     // river bed
export const FLOOR_Y = 0.5;    // valley floor / riverbank level

export function islandRadius(theta) {
  const cx = Math.cos(theta), sz = Math.sin(theta);
  let R = ISLAND_R + 1.9 * noise(cx * 1.4 + 3, sz * 1.4 - 2) + 0.75 * Math.sin(theta * 5 + 1.3);
  // bulge to the west for the lookout cliff
  const dCliff = Math.abs(Math.atan2(Math.sin(theta - Math.PI + 0.27), Math.cos(theta - Math.PI + 0.27)));
  R += 3.2 * Math.max(0, 1 - dCliff / 0.4);
  return R;
}

export function topH(x, z) {
  let h = 0.22 * fbm(x * 0.09, z * 0.09, 3) + 0.08 * noise(x * 0.4, z * 0.4);
  // cliff: sheer toward the outside, a gentle grassy ramp toward the island centre
  const ux = -CLIFF.x / Math.hypot(CLIFF.x, CLIFF.z), uz = -CLIFF.z / Math.hypot(CLIFF.x, CLIFF.z);
  const qx = x - CLIFF.x, qz = z - CLIFF.z; const along = qx * ux + qz * uz, perp = -qx * uz + qz * ux;
  const dc = Math.hypot(perp, along > 0 ? along * 0.5 : along);
  h += CLIFF.h * smoothstep(CLIFF.r + 0.9, CLIFF.r - 0.7, dc) * (1 + 0.04 * noise(x, z));
  const dp = Math.hypot(x - POND.x, z - POND.z);
  h -= 0.85 * smoothstep(POND.r + 0.5, POND.r - 1.0, dp);
  const r = Math.hypot(x, z), R = islandRadius(Math.atan2(z, x));
  h -= 0.62 * smoothstep(R - 1.8, R, r);
  return h;
}

// gravel bars trail downstream (north-west) and upstream (south) of the island
function lobe(th, c, p) { return Math.pow(Math.max(0, Math.cos(th - c)), p); }
export function barAmt(th) { return lobe(th, -2.05, 10) * 1.0 + lobe(th, 1.45, 12) * 0.75; }
export function skirtD(th) { return 3.5 + 14 * barAmt(th); }
export function skirtY(rimY, t, th) { const e = 1 + 3.6 * barAmt(th); return rimY + (BED_Y - rimY) * Math.pow(t, e); }
// full island surface incl. sandy/gravel skirt into the river (or -Infinity off the island)
export function islandSurfH(x, z) {
  const r = Math.hypot(x, z), th = Math.atan2(z, x), R = islandRadius(th);
  if (r <= R) return topH(x, z);
  const D = skirtD(th); if (r > R + D) return -Infinity;
  return skirtY(topH(Math.cos(th) * R, Math.sin(th) * R), (r - R) / D, th);
}
export const ISLET_D = 3.0;
export function isletSurfH(x, z) {
  const r = Math.hypot(x - ISLET.x, z - ISLET.z);
  if (r <= ISLET.r) return isletH(x, z);
  if (r > ISLET.r + ISLET_D) return -Infinity;
  const th = Math.atan2(z - ISLET.z, x - ISLET.x); const rimY = isletH(ISLET.x + Math.cos(th) * ISLET.r, ISLET.z + Math.sin(th) * ISLET.r);
  return rimY + (BED_Y - rimY) * Math.pow((r - ISLET.r) / ISLET_D, 1.4);
}
// boulders in the current
// the Bitterroot's centreline + half-width (must match the GLSL copy in water.js). Widened in v2 for the bigger island
export function riverX(z) { return 30 * Math.sin(z / 240) + 12 * Math.sin(z / 83); }
export function riverW(z) { return 8 + 46 * Math.exp(-Math.pow(z / 100, 2)); }
export const RIVER_ROCKS = [[-21, -5, 1.0], [-20, 9, 0.75], [-25, 1.5, 0.6], [24, 2, 1.1], [27, 10, 0.8], [21, -9, 0.7], [-10, -27, 0.8], [6, 27, 1.0], [-3, 31, 0.7], [27, -18, 0.9], [-25, 18, 0.7], [16, -31, 0.8], [-16, -18, 0.6], [12, 22, 0.6]].map(([x, z, r]) => [x * K, z * K, r * 1.2]).filter(([x, z]) => Math.abs(x - riverX(z)) < riverW(z) - 6);
export function rockH(x, z) { let h = -Infinity; for (const [rx, rz, rr] of RIVER_ROCKS) { const d = Math.hypot(x - rx, z - rz); if (d < rr) h = Math.max(h, WATER_Y + 0.3 * rr - 1.6 * rr * (d / rr) * (d / rr)); } return h; }

export function isletH(x, z) {
  const r = Math.hypot(x - ISLET.x, z - ISLET.z) / ISLET.r;
  return -0.72 + 0.62 * Math.pow(Math.max(0, 1 - r * r), 0.8) + 0.05 * noise(x * 0.8, z * 0.8);
}

// bridge from the main island rim to the islet, along the line between their centres
{
  const L0 = Math.hypot(ISLET.x, ISLET.z), dx = ISLET.x / L0, dz = ISLET.z / L0;
  const ra = islandRadius(Math.atan2(dz, dx)) - 1.15;
  Object.assign(BRIDGE, { ax: dx * ra, az: dz * ra, bx: ISLET.x - dx * (ISLET.r - 0.7), bz: ISLET.z - dz * (ISLET.r - 0.7), dx, dz });
  BRIDGE.len = Math.hypot(BRIDGE.bx - BRIDGE.ax, BRIDGE.bz - BRIDGE.az);
}
export function bridgeParam(x, z) {
  const px = x - BRIDGE.ax, pz = z - BRIDGE.az; const t = (px * BRIDGE.dx + pz * BRIDGE.dz) / BRIDGE.len; const lat = -px * BRIDGE.dz + pz * BRIDGE.dx; return { t, lat };
}
export function bridgePoint(t) { return [BRIDGE.ax + (BRIDGE.bx - BRIDGE.ax) * t, BRIDGE.az + (BRIDGE.bz - BRIDGE.az) * t]; }
export function bridgeYt(t) {
  t = clamp(t, 0, 1); const a = topH(BRIDGE.ax, BRIDGE.az) + 0.06, b = isletH(BRIDGE.bx, BRIDGE.bz) + 0.06;
  return a + (b - a) * t - BRIDGE.sag * Math.sin(Math.PI * t);
}
export function onIslet(x, z) { return Math.hypot(x - ISLET.x, z - ISLET.z) < ISLET.r - 0.2; }
// fishing dock off the south-west shore
export const DOCK = { th: 2.35, len: 6.5, w: 1.7 };
{ const dx = Math.cos(DOCK.th), dz = Math.sin(DOCK.th), r0 = islandRadius(DOCK.th) - 2.2;
  Object.assign(DOCK, { dx, dz, x0: dx * r0, z0: dz * r0, x1: dx * (r0 + DOCK.len), z1: dz * (r0 + DOCK.len) }); DOCK.y = topH(DOCK.x0, DOCK.z0) + 0.12; }
export function dockParam(x, z) { const px = x - DOCK.x0, pz = z - DOCK.z0; return { t: (px * DOCK.dx + pz * DOCK.dz) / DOCK.len, lat: -px * DOCK.dz + pz * DOCK.dx }; }
export function onDock(x, z) { const d = dockParam(x, z); return d.t > -0.02 && d.t < 1 && Math.abs(d.lat) < DOCK.w / 2; }
export function groundY(x, z) {
  const bp = bridgeParam(x, z);
  if (bp.t > 0 && bp.t < 1 && Math.abs(bp.lat) < 1.0) return bridgeYt(bp.t);
  if (onDock(x, z)) return Math.max(DOCK.y, topH(x, z));
  if (onIslet(x, z)) return isletH(x, z);
  const h = topH(x, z);
  const dp = Math.hypot(x - POND.x, z - POND.z);
  if (dp < POND.r) return Math.max(h, POND_Y - 0.25);
  return h;
}

const Z = (x, z) => [x * K, z * K];
const S = (x, z, ax, az) => [x + (K - 1) * ax, z + (K - 1) * az];
// art shop (front faces the island centre) + music corner
export const SHOP = { x: 3.2, z: 8.6, w: 4.8, d: 3.6, h: 2.7 };
{ const L = Math.hypot(SHOP.x, SHOP.z); SHOP.fx = -SHOP.x / L; SHOP.fz = -SHOP.z / L; SHOP.yaw = Math.atan2(SHOP.fx, SHOP.fz); }
export const MUSIC = { x: 9.0, z: -9.8 };
export const VEND = { x: -6.8, z: 15.8 }; { const L = Math.hypot(VEND.x + 3, VEND.z - 6); VEND.fx = -(VEND.x + 3) / L; VEND.fz = -(VEND.z - 6) / L; VEND.yaw = Math.atan2(VEND.fx, VEND.fz); }
// zones. pos = feature centre, spot = where Mochi stands, face = yaw he looks toward (radians, 0 = +z)
export const ZONES = [
  { id: 'hut', name: 'Hut & Nest', emoji: '🛖', pos: Z(-4.2, -8.0), spot: S(-2.6, -5.9, -4.2, -8.0), keys: ['hut', 'home', 'house', 'nest', 'roof', 'ladder', 'bed', 'sleep', 'inside', 'door'] },
  { id: 'tree', name: 'Big Tree', emoji: '🌳', pos: Z(4.4, -9.0), spot: S(3.4, -7.0, 4.4, -9.0), keys: ['big tree', 'treehouse', 'tree house', 'oak', 'tree', 'shade', 'leaves', 'branch', 'climb', 'owl'] },
  { id: 'pond', name: 'Pond', emoji: '🪷', pos: [POND.x, POND.z], spot: [POND.x - 2.4, POND.z + 2.6], keys: ['pond', 'duck', 'water', 'lily', 'puddle', 'swim'] },
  { id: 'pumpkins', name: 'Pumpkin Patch', emoji: '🎃', pos: Z(-7.0, 6.4), spot: S(-5.6, 4.9, -7.0, 6.4), keys: ['pumpkin', 'patch', 'halloween', 'jack', 'grave', 'hat grave'] },
  { id: 'beach', name: 'Beach Islet', emoji: '🏖️', pos: [ISLET.x, ISLET.z], spot: [ISLET.x - 1.6, ISLET.z + 0.4], keys: ['beach', 'islet', 'sand', 'wave', 'ocean', 'shore', 'bridge', 'lagoon', 'sea'] },
  { id: 'ramp', name: 'Skate Ramp', emoji: '🛹', pos: Z(9.6, 6.0), spot: S(8.0, 4.2, 9.6, 6.0), keys: ['skate', 'ramp', 'half-pipe', 'halfpipe', 'kickflip', 'board', 'trick'] },
  { id: 'market', name: 'Art Market', emoji: '🎨', pos: Z(-1.0, 9.6), spot: S(-0.6, 7.6, -1.0, 9.6), keys: ['art', 'market', 'stall', 'easel', 'paint', 'draw', 'print', 'sell'] },
  { id: 'museum', name: 'Cap Museum', emoji: '🧢', pos: Z(-8.2, -3.4), spot: S(-6.8, -2.0, -8.2, -3.4), keys: ['cap museum', 'museum', 'cap', 'bottle', 'shelf', 'collection', 'son'] },
  { id: 'squirrel', name: "Squirrel's Tree", emoji: '🐿️', pos: Z(10.0, -4.6), spot: S(8.1, -3.4, 10.0, -4.6), keys: ['squirrel', 'rival', 'acorn', 'cold war', 'enemy'] },
  { id: 'garden', name: 'Garden', emoji: '🥕', pos: Z(5.6, 9.0), spot: S(4.0, 7.6, 5.6, 9.0), keys: ['garden', 'carrot', 'veg', 'plant', 'cabbage', 'grow', 'seed', 'dig'] },
  { id: 'cliff', name: 'Lookout Cliff', emoji: '🏔️', pos: [CLIFF.x, CLIFF.z], spot: [CLIFF.x - 1.4, CLIFF.z + 0.8], keys: ['weather station', 'lookout', 'cliff', 'yodel', 'view', 'peak', 'trapper', 'mountain', 'edge', 'overlook', 'stare'] },
  { id: 'shop', name: 'Art Shop', emoji: '🖼️', pos: [SHOP.x, SHOP.z], spot: [SHOP.x + SHOP.fx * 3.4, SHOP.z + SHOP.fz * 3.4], keys: ['art shop', 'shop', 'gallery', 'frame', 'hang', 'exhibit', 'boutique', 'store'] },
  { id: 'campfire', name: 'Campfire', emoji: '🔥', pos: [12.5, 1.5], spot: [11.0, 2.9], keys: ['campfire', 'fire', 'marshmallow', "s'more", 'smore', 'camp', 'warm', 'cozy'] },
  { id: 'meadow', name: 'Wildflower Meadow', emoji: '🌼', pos: [-1.5, -7.5], spot: [-0.2, -6.0], keys: ['meadow', 'flower', 'bee', 'honey', 'wildflower', 'daisy', 'field', 'nap'] },
  { id: 'dock', name: 'Fishing Dock', emoji: '🎣', pos: [DOCK.x0 + DOCK.dx * DOCK.len * 0.5, DOCK.z0 + DOCK.dz * DOCK.len * 0.5], spot: [DOCK.x0 + DOCK.dx * DOCK.len * 0.8, DOCK.z0 + DOCK.dz * DOCK.len * 0.8], keys: ['dock', 'fish', 'pier', 'river', 'rod', 'boat', 'float', 'bitterroot'] },
  { id: 'music', name: 'Music Corner', emoji: '🎸', pos: [MUSIC.x, MUSIC.z], spot: [MUSIC.x + 1.4, MUSIC.z + 1.6], keys: ['music', 'song', 'sing', 'drum', 'guitar', 'uke', 'keys', 'piano', 'band', 'jam', 'concert', 'tune'] },
  { id: 'picnic', name: 'Picnic Table', emoji: '🧺', pos: Z(-3.2, 1.6), spot: S(-2.2, 3.0, -3.2, 1.6), keys: ['picnic', 'table', 'cooler', 'soda', 'snack', 'lunch', 'quarters', 'laptop', 'computer', 'internet', 'browse', 'web', 'online', 'eat'] },
  { id: 'vending', name: 'Cap-O-Matic', emoji: '🎰', pos: [VEND.x, VEND.z], spot: [VEND.x + VEND.fx * 1.6, VEND.z + VEND.fz * 1.6], keys: ['vending', 'cap-o-matic', 'capomatic', 'machine', 'trinket', 'spend', 'gacha', 'capsule'] },
];

export function matchZone(location) {
  const loc = (location || '').toLowerCase();
  let best = null, bestScore = 0;
  for (const z of ZONES) {
    let s = 0;
    for (const k of z.keys) if (loc.includes(k)) s += k.length; // longer keyword = stronger hint
    if (s > bestScore) { bestScore = s; best = z; }
  }
  return best;
}

// circles Mochi (and the walker) go around. mochiOnly = coarse blob for Mochi's planner; WALLS = fine circles only the walker uses
const ob = (x, z, r) => { const [a, b] = mv(x, z); return { x: a, z: b, r }; };
export const OBSTACLES = [
  ob(-4.2, -8.0, 2.1), { x: POND.x, z: POND.z, r: POND.r + 0.2 }, ob(4.4, -9.0, 1.5),
  ob(10.0, -4.6, 0.9), ob(9.6, 6.0, 1.9), ob(-1.0, 9.9, 1.6), ob(-8.5, -3.8, 1.3),
  ob(-3.2, 1.6, 1.3), ob(5.6, 9.4, 1.5), ob(-7.0, 6.6, 1.3),
  { x: 12.5, z: 1.5, r: 0.9 }, { x: -1.5 - 1.2, z: -7.5 - 1.0, r: 0.5 }, { x: MUSIC.x, z: MUSIC.z, r: 1.3 }, { x: VEND.x, z: VEND.z, r: 0.75 },
  { x: SHOP.x, z: SHOP.z, r: Math.hypot(SHOP.w, SHOP.d) / 2 + 0.2, mochiOnly: true },
];
export const WALLS = [];
{ // shop walls: back, sides, and the two front pieces either side of the doorway
  const c = Math.cos(SHOP.yaw), s = Math.sin(SHOP.yaw); const W = (lx, lz) => WALLS.push({ x: SHOP.x + lx * c + lz * s, z: SHOP.z - lx * s + lz * c, r: 0.3 });
  for (let lx = -SHOP.w / 2; lx <= SHOP.w / 2 + 1e-3; lx += 0.4) W(lx, -SHOP.d / 2);
  for (let lz = -SHOP.d / 2; lz <= SHOP.d / 2 + 1e-3; lz += 0.4) { W(-SHOP.w / 2, lz); W(SHOP.w / 2, lz); }
  for (let lx = 1.1; lx <= SHOP.w / 2 + 1e-3; lx += 0.4) { W(lx, SHOP.d / 2); W(-lx, SHOP.d / 2); }
}

// ── the big treehouse tree (shared by island.js trunk/canopy, features.js treehouse, critters.js owl, OBSTACLES) ──
// angles are atan2(dz, dx) around the trunk: cabin faces the default camera (east), ladder faces the zone spot.
export const BIGTREE = (() => { const [x, z] = mv(4.4, -9.0); const y = topH(x, z);
  const T = { x, z, y, h: 6.2, trunkR: 1.0, topR: 0.55, deckH: 3.1, deckR: 2.2, cabinA: -0.32, ladderA: 2.03, standA: 0.75, limbs: [-1.9, 3.64, 0.95, 2.45, -2.75], owlA: 3.64, swingA: -1.9, feederA: 0.95 };
  T.radiusAt = (hh) => T.topR + (T.trunkR - T.topR) * Math.max(0, 1 - hh / T.h) + 0.45 * T.trunkR * Math.exp(-hh * 2.2);
  T.limbStart = (a, i = 0) => new THREE.Vector3(x + Math.cos(a) * T.radiusAt(3.9) * 0.6, y + 3.9 + (i % 3) * 0.35, z + Math.sin(a) * T.radiusAt(3.9) * 0.6);
  T.limbDir = (a) => new THREE.Vector3(Math.cos(a), 0.5, Math.sin(a)).normalize();
  T.limbPoint = (a, t) => { const i = T.limbs.indexOf(a); return T.limbStart(a, Math.max(0, i)).addScaledVector(T.limbDir(a), t); };
  T.ring = (a, r, hh = 0) => new THREE.Vector3(x + Math.cos(a) * r, y + hh, z + Math.sin(a) * r);
  return T; })();
