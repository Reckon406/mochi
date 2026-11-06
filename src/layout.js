// Island layout + walkable ground height
import { fbm, noise, smoothstep, clamp } from './noise.js';

export const ISLAND_R = 14;
export const CLIFF = { x: -11.3, z: 3.2, r: 3.4, h: 2.8 };
export const POND = { x: 2.6, z: -1.2, r: 2.5 };
export const ISLET = { x: 11.6, z: -19.9, r: 4.6, y: -0.55 };
export const BRIDGE = { ax: 0, az: 0, bx: 0, bz: 0, sag: 0.45, len: 1 }; // filled in below
export const POND_Y = -0.32;
export const LAGOON_Y = -0.95;
export const WATER_Y = -0.9;   // Bitterroot River surface
export const BED_Y = -2.8;     // river bed
export const FLOOR_Y = 0.5;    // valley floor / riverbank level

export function islandRadius(theta) {
  const cx = Math.cos(theta), sz = Math.sin(theta);
  let R = ISLAND_R + 1.1 * noise(cx * 1.4 + 3, sz * 1.4 - 2) + 0.45 * Math.sin(theta * 5 + 1.3);
  // bulge to the west for the lookout cliff
  const dCliff = Math.abs(Math.atan2(Math.sin(theta - Math.PI + 0.27), Math.cos(theta - Math.PI + 0.27)));
  R += 2.0 * Math.max(0, 1 - dCliff / 0.45);
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
export function skirtD(th) { return 3.0 + 10 * barAmt(th); }
export function skirtY(rimY, t, th) { const e = 1 + 3.6 * barAmt(th); return rimY + (BED_Y - rimY) * Math.pow(t, e); }
// full island surface incl. sandy/gravel skirt into the river (or -Infinity off the island)
export function islandSurfH(x, z) {
  const r = Math.hypot(x, z), th = Math.atan2(z, x), R = islandRadius(th);
  if (r <= R) return topH(x, z);
  const D = skirtD(th); if (r > R + D) return -Infinity;
  return skirtY(topH(Math.cos(th) * R, Math.sin(th) * R), (r - R) / D, th);
}
export const ISLET_D = 2.6;
export function isletSurfH(x, z) {
  const r = Math.hypot(x - ISLET.x, z - ISLET.z);
  if (r <= ISLET.r) return isletH(x, z);
  if (r > ISLET.r + ISLET_D) return -Infinity;
  const th = Math.atan2(z - ISLET.z, x - ISLET.x); const rimY = isletH(ISLET.x + Math.cos(th) * ISLET.r, ISLET.z + Math.sin(th) * ISLET.r);
  return rimY + (BED_Y - rimY) * Math.pow((r - ISLET.r) / ISLET_D, 1.4);
}
// boulders in the current
export const RIVER_ROCKS = [[-21, -5, 1.0], [-20, 9, 0.75], [-25, 1.5, 0.6], [24, 2, 1.1], [27, 10, 0.8], [21, -9, 0.7], [-10, -27, 0.8], [6, 27, 1.0], [-3, 31, 0.7], [27, -18, 0.9], [-25, 18, 0.7], [16, -31, 0.8], [-16, -18, 0.6], [12, 22, 0.6]];
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
export function groundY(x, z) {
  const bp = bridgeParam(x, z);
  if (bp.t > 0 && bp.t < 1 && Math.abs(bp.lat) < 1.0) return bridgeYt(bp.t);
  if (onIslet(x, z)) return isletH(x, z);
  const h = topH(x, z);
  const dp = Math.hypot(x - POND.x, z - POND.z);
  if (dp < POND.r) return Math.max(h, POND_Y - 0.25);
  return h;
}

// 12 zones. pos = feature centre, spot = where Mochi stands, face = yaw he looks toward (radians, 0 = +z)
export const ZONES = [
  { id: 'hut', name: 'Hut & Nest', emoji: '🛖', pos: [-4.2, -8.0], spot: [-2.6, -5.9], keys: ['hut', 'home', 'house', 'nest', 'roof', 'ladder', 'bed', 'sleep', 'inside', 'door'] },
  { id: 'tree', name: 'Big Tree', emoji: '🌳', pos: [4.4, -9.0], spot: [3.4, -7.0], keys: ['big tree', 'oak', 'tree', 'shade', 'leaves', 'branch'] },
  { id: 'pond', name: 'Pond', emoji: '🪷', pos: [POND.x, POND.z], spot: [POND.x - 1.9, POND.z + 2.2], keys: ['pond', 'duck', 'water', 'lily', 'puddle', 'swim'] },
  { id: 'pumpkins', name: 'Pumpkin Patch', emoji: '🎃', pos: [-7.0, 6.4], spot: [-5.6, 4.9], keys: ['pumpkin', 'patch', 'halloween', 'jack', 'grave', 'hat grave'] },
  { id: 'beach', name: 'Beach Islet', emoji: '🏖️', pos: [ISLET.x, ISLET.z], spot: [ISLET.x - 1.6, ISLET.z + 0.4], keys: ['beach', 'islet', 'sand', 'wave', 'ocean', 'shore', 'bridge', 'lagoon', 'sea'] },
  { id: 'ramp', name: 'Skate Ramp', emoji: '🛹', pos: [9.6, 6.0], spot: [8.0, 4.2], keys: ['skate', 'ramp', 'half-pipe', 'halfpipe', 'kickflip', 'board', 'trick'] },
  { id: 'market', name: 'Art Market', emoji: '🎨', pos: [-1.0, 9.6], spot: [-0.6, 7.6], keys: ['art', 'market', 'stall', 'easel', 'paint', 'draw', 'print', 'sell', 'gallery'] },
  { id: 'museum', name: 'Cap Museum', emoji: '🧢', pos: [-8.2, -3.4], spot: [-6.8, -2.0], keys: ['cap museum', 'museum', 'cap', 'bottle', 'shelf', 'collection', 'son'] },
  { id: 'squirrel', name: "Squirrel's Tree", emoji: '🐿️', pos: [10.0, -4.6], spot: [8.1, -3.4], keys: ['squirrel', 'rival', 'acorn', 'cold war', 'enemy'] },
  { id: 'garden', name: 'Garden', emoji: '🥕', pos: [5.6, 9.0], spot: [4.0, 7.6], keys: ['garden', 'carrot', 'veg', 'plant', 'cabbage', 'grow', 'seed', 'dig'] },
  { id: 'cliff', name: 'Lookout Cliff', emoji: '🏔️', pos: [CLIFF.x, CLIFF.z], spot: [CLIFF.x - 1.2, CLIFF.z + 0.6], keys: ['lookout', 'cliff', 'view', 'peak', 'trapper', 'mountain', 'edge', 'overlook', 'stare'] },
  { id: 'picnic', name: 'Picnic Table', emoji: '🧺', pos: [-3.2, 1.6], spot: [-2.2, 3.0], keys: ['picnic', 'table', 'cooler', 'soda', 'snack', 'lunch', 'quarters'] },
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

// circles Mochi should walk around
export const OBSTACLES = [
  { x: -4.2, z: -8.0, r: 2.1 }, { x: POND.x, z: POND.z, r: POND.r + 0.2 }, { x: 4.4, z: -9.0, r: 1.0 },
  { x: 10.0, z: -4.6, r: 0.9 }, { x: 9.6, z: 6.0, r: 1.9 }, { x: -1.0, z: 9.9, r: 1.6 }, { x: -8.5, z: -3.8, r: 1.3 },
  { x: -3.2, z: 1.6, r: 1.3 }, { x: 5.6, z: 9.4, r: 1.5 }, { x: -7.0, z: 6.6, r: 1.3 },
];
