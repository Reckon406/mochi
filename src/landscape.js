// The Bitterroot Valley around Mochi's river island: river, banks, cottonwoods & willows,
// foothills, the Bitterroot Mountains with Trapper Peak, and little Darby
import * as THREE from 'three';
import { addInstancedSway } from './gfx.js';
import { lodPineGeo, lodCottonwoodGeo, lodAspenGeo, lodWillowGeo, seasonColors } from './trees.js';
import { fbm, ridged, noise, smoothstep, rng } from './noise.js';
import { makeRiverMaterial } from './water.js';
import { FLOOR_Y, BED_Y, WATER_Y, islandSurfH, isletSurfH, rockH } from './layout.js';
export { FLOOR_Y };

// Trapper Peak: WSW of Darby (bearing ~247.5deg). North = -z, east = +x.
const BEAR = (247.5 * Math.PI) / 180;
export const TRAPPER = { x: Math.sin(BEAR) * 900, z: -Math.cos(BEAR) * 900 };
export const TRAPPER_DIR = new THREE.Vector2(Math.sin(BEAR), -Math.cos(BEAR));

// must match the GLSL copy in water.js
import { riverX, riverW } from './layout.js';
export { riverX, riverW };

export function terrainH(x, z) {
  const dx = x - riverX(z), adx = Math.abs(dx);
  const west = smoothstep(220, 760, -dx);            // Bitterroot Range (big)
  const east = smoothstep(260, 900, dx);             // Sapphire Mountains (rounder)
  const south = smoothstep(500, 1300, z) * 0.85;
  const north = smoothstep(1300, 1800, -z) * 0.6;
  const m = Math.max(west, east * 0.6, south, north);
  const r = ridged(x * 0.0026 + 11, z * 0.0026 - 4, 5);
  let h = FLOOR_Y + 0.8 * fbm(x * 0.02, z * 0.02, 2) * smoothstep(10, 40, adx - riverW(z));
  h += 18 * smoothstep(100, 320, adx) * (0.55 + 0.45 * fbm(x * 0.006, z * 0.006, 3)); // foothills
  h += m * (18 + 150 * r * r + 22 * fbm(x * 0.008, z * 0.008, 3));
  const td = Math.hypot(x - TRAPPER.x, z - TRAPPER.z);
  h += 200 * Math.exp(-Math.pow(td / 180, 2)) * (0.85 + 0.25 * ridged(x * 0.01, z * 0.01, 3));
  h += 55 * Math.exp(-Math.pow(td / 55, 2));
  // river channel
  const w = riverW(z);
  h += (BED_Y - h) * smoothstep(w + 5, w - 3, adx);
  return h;
}

const C = (h) => new THREE.Color(h);
const PAL = { snow: C(0xf4f7ff), rock: [C(0x8a8490), C(0x6a6474)], forest: [C(0x2c5634), C(0x46703a)],
  fields: [C(0xd2b45e), C(0x86a64c), C(0xb08a5a), C(0x9cb860)], gravel: C(0xb5a58e), sand: C(0xd9c79a), bed: C(0x6d6a4e), bank: C(0x7f9a4e) };
function colorAt(x, z, h, slope, snowy) {
  const n = noise(x * 0.01, z * 0.01); const c = new THREE.Color(); const rel = h - FLOOR_Y;
  const snowLine = (snowy ? 36 : 70) + 22 * n;
  const field = PAL.fields[Math.abs(Math.floor(x * 0.018 + 0.7 * Math.sin(z * 0.01)) * 7 + Math.floor(z * 0.018)) % 4].clone();
  const forest = PAL.forest[0].clone().lerp(PAL.forest[1], 0.5 + 0.5 * n), rock = PAL.rock[0].clone().lerp(PAL.rock[1], 0.5 + 0.5 * n);
  if (rel < 14) c.copy(field).lerp(forest, smoothstep(5, 14, rel) * 0.7);
  else if (rel < 90) c.copy(forest).lerp(rock, smoothstep(50, 95, rel + 30 * slope));
  else c.copy(rock);
  if (slope > 1.1) c.lerp(rock, smoothstep(1.1, 1.8, slope));
  // riverbanks: grassy fringe -> sand/cobble at the waterline -> bed
  const adx = Math.abs(x - riverX(z)) - riverW(z);
  c.lerp(PAL.bank, smoothstep(28, 10, adx) * 0.6);
  if (h < FLOOR_Y + 0.15) { const g = PAL.gravel.clone().lerp(PAL.sand, 0.5 + 0.5 * noise(x * 0.3, z * 0.3)); c.lerp(g, smoothstep(FLOOR_Y + 0.15, FLOOR_Y - 0.4, h)); }
  if (h < WATER_Y) c.lerp(PAL.bed, smoothstep(WATER_Y, WATER_Y - 0.8, h));
  const s = smoothstep(snowLine - 18, snowLine + 10, rel) * (1 - smoothstep(1.9, 3.2, slope) * 0.35);
  c.lerp(PAL.snow, s);
  if (snowy && h > WATER_Y + 0.05) c.lerp(PAL.snow, smoothstep(0, 40, rel) * 0.3 + 0.5);
  return c;
}

function terrainMesh(size, seg, cx, cz, snowy, hFn) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2); geo.translate(cx, 0, cz);
  const pos = geo.attributes.position; const cols = new Float32Array(pos.count * 3); const e = Math.max(1, size / seg);
  for (let i = 0; i < pos.count; i++) pos.setY(i, hFn(pos.getX(i), pos.getZ(i)));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
    const sx = (terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), sz = (terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
    const c = colorAt(x, z, h, Math.hypot(sx, sz), snowy); cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
}

export const NEAR = 170; // half-size of the high-res terrain patch around the island
export function buildLandscape(scene, { snowy = false, mobile = false, season = 'fall', lite = false } = {}) {
  const L = lite || mobile;
  const group = new THREE.Group(); scene.add(group);
  // far terrain (sunk under the near patch so they don't fight)
  const far = terrainMesh(3800, mobile ? 170 : 240, 0, 0, snowy, (x, z) => terrainH(x, z) - (Math.max(Math.abs(x), Math.abs(z)) < NEAR - 12 ? 6 : 0));
  group.add(far);
  const near = terrainMesh(NEAR * 2, mobile ? 170 : 260, 0, 0, snowy, terrainH); near.receiveShadow = true; group.add(near);

  // ── river: one big water plane, shaded with flow + foam (bed/island depth comes from a baked height map) ──
  const RECT = { x0: -64, z0: -64, size: 128 }; const RES = mobile ? 256 : 420;
  const data = new Uint8Array(RES * RES * 4);
  for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
    const x = RECT.x0 + ((i + 0.5) / RES) * RECT.size, z = RECT.z0 + ((j + 0.5) / RES) * RECT.size;
    const h = Math.max(islandSurfH(x, z), isletSurfH(x, z), rockH(x, z), -4);
    const v = Math.round(THREE.MathUtils.clamp((h + 4) / 8, 0, 1) * 255); const k = (j * RES + i) * 4; data[k] = data[k + 1] = data[k + 2] = v; data[k + 3] = 255;
  }
  const depthTex = new THREE.DataTexture(data, RES, RES, THREE.RGBAFormat); depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter; depthTex.needsUpdate = true;
  const riverMat = makeRiverMaterial({ depthTex, rect: RECT, snowy });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3800, 3800, 1, 1).rotateX(-Math.PI / 2), riverMat); water.position.y = WATER_Y; water.receiveShadow = false; group.add(water);

  const r = rng(3); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(); const pc = new THREE.Color();
  // ── foothill pines (LOD ponderosa/fir silhouette, instanced) ──
  const pineGeo = lodPineGeo(L);
  const N = L ? 900 : mobile ? 1800 : 6500;
  const pines = new THREE.InstancedMesh(pineGeo, new THREE.MeshStandardMaterial({ color: snowy ? 0xb9c8bd : 0xffffff, roughness: 1, vertexColors: true }), N);
  let placed = 0, tries = 0;
  while (placed < N && tries < N * 30) {
    tries++; const x = (r() - 0.5) * 2200, z = (r() - 0.5) * 2200; const h = terrainH(x, z); const rel = h - FLOOR_Y;
    if (rel < 6 || rel > 95) continue; if (Math.abs(x - riverX(z)) < 90) continue;
    const dens = smoothstep(-0.3, 0.4, noise(x * 0.012 + 5, z * 0.012)) * (rel < 15 ? 0.4 : 1); if (r() > dens) continue;
    const sc = 2.2 + r() * 2.4; p.set(x, h - 0.5, z); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, r() * 6.28); s.set(sc, sc * (1 + r() * 0.4), sc);
    m4.compose(p, q, s); pines.setMatrixAt(placed, m4); const pineCols = seasonColors('pine', season, snowy); pc.set(pineCols[Math.floor(r() * pineCols.length)]); if (snowy) pc.lerp(PAL.snow, 0.35); pines.setColorAt(placed, pc); placed++;
  }
  pines.count = placed; pines.castShadow = !mobile; group.add(pines);

  // ── bank trees: cottonwoods, aspens, willows (LOD + wind sway on canopies) ──
  const NC = L ? 90 : mobile ? 140 : 380, NA = L ? 50 : mobile ? 80 : 220, NWl = L ? 60 : mobile ? 90 : 260;
  const cwGeo = lodCottonwoodGeo(L), asGeo = lodAspenGeo(L), wlGeo = lodWillowGeo(L);
  const canopyM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, vertexColors: true });
  const aspenM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, vertexColors: true });
  const wlM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide, vertexColors: true });
  addInstancedSway(canopyM, 0.14, 4.5); addInstancedSway(aspenM, 0.18, 3.6); addInstancedSway(wlM, 0.1, 2.6);
  const cw = new THREE.InstancedMesh(cwGeo, canopyM, NC);
  const asp = new THREE.InstancedMesh(asGeo, aspenM, NA);
  const wl = new THREE.InstancedMesh(wlGeo, wlM, NWl);
  const golds = seasonColors('cotton', season, snowy);
  const aspenC = seasonColors('aspen', season, snowy);
  const willowC = seasonColors('willow', season, snowy);
  const placeBank = (mesh, count, cols, minD, maxD, scale, zr, clearR, trunkTint = null) => { let k = 0, tr = 0;
    while (k < count && tr < count * 40) { tr++; const z = (r() - 0.5) * 2 * zr; const side = r() < 0.5 ? -1 : 1; const off = riverW(z) + minD + Math.pow(r(), 1.6) * (maxD - minD); const x = riverX(z) + side * off;
      const h = terrainH(x, z); if (h < FLOOR_Y - 0.25 || h > FLOOR_Y + 14) continue; if (Math.hypot(x, z) < clearR) continue;
      const sc = scale * (0.75 + r() * 0.55); p.set(x, h - 0.2, z); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, r() * 6.28); s.set(sc, sc * (0.9 + r() * 0.35), sc); m4.compose(p, q, s);
      mesh.setMatrixAt(k, m4);
      const hex = cols[Math.floor(r() * cols.length)]; pc.set(hex); if (snowy) pc.lerp(PAL.snow, 0.45); if (r() < 0.1) pc.set(snowy ? 0xe8ecf4 : 0x9a8a70);
      mesh.setColorAt(k, pc); k++; }
    mesh.count = k; };
  placeBank(cw, NC, golds, 2, 70, 2.1, 700, 95);
  placeBank(asp, NA, aspenC, 4, 90, 1.7, 650, 90);
  placeBank(wl, NWl, willowC, -0.5, 14, 1.35, 500, 62);
  cw.castShadow = asp.castShadow = !mobile; group.add(cw, asp, wl);

  // ── tiny Darby, Montana on the east bench, lights on at night ──
  const houseGeo = new THREE.BoxGeometry(1, 1, 1); houseGeo.translate(0, 0.5, 0);
  const roofGeo = new THREE.ConeGeometry(0.85, 0.6, 4); roofGeo.rotateY(Math.PI / 4); roofGeo.translate(0, 1.3, 0);
  const NH = L ? 35 : 70; const houses = new THREE.InstancedMesh(houseGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), NH);
  const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: snowy ? 0xf0f4ff : 0x8a3b2e, roughness: 0.9 }), NH);
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffc46b }); const wins = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.3), winMat, NH);
  let hk = 0;
  for (let i = 0; i < NH * 10 && hk < NH; i++) {
    const z = 140 + (r() - 0.5) * 120, x = riverX(z) + riverW(z) + 45 + r() * 80; const h = terrainH(x, z); if (h > FLOOR_Y + 8) continue;
    const sc = 2.4 + r() * 1.8; const yaw = Math.round(r() * 4) * Math.PI / 2 + (r() - 0.5) * 0.2;
    p.set(x, h, z); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw); s.set(sc * 1.3, sc, sc); m4.compose(p, q, s); houses.setMatrixAt(hk, m4); roofs.setMatrixAt(hk, m4);
    pc.setHSL(0.08 + r() * 0.1, 0.25, 0.6 + r() * 0.25); houses.setColorAt(hk, pc);
    const off = new THREE.Vector3(0, sc * 0.5, sc * 0.51).applyQuaternion(q); m4.compose(p.clone().add(off), q, new THREE.Vector3(sc, sc, sc)); wins.setMatrixAt(hk, m4); hk++;
  }
  houses.count = roofs.count = wins.count = hk; group.add(houses, roofs, wins);
  return { group, river: water, riverMat, winMat, pines };
}

// merge geometries; colour = shading ramp (trunks brown, foliage lighter at top) unless plain=true (white, tinted per instance)
export function mergeSimple(geos, plain = false) {
  const pos = [], nor = [], col = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0; const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      if (plain) { col.push(1, 1, 1); continue; }
      const isTrunk = g0.type === 'CylinderGeometry'; const y = p.getY(i);
      if (isTrunk) col.push(0.35, 0.22, 0.14); else { const v = 0.75 + 0.25 * Math.min(1, y / 3); col.push(v, v, v); }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
