// 🌼 Bitterroot-valley wildflowers (replaces the old sphere "gumball" flowers): arrowleaf balsamroot, lupine, Indian
// paintbrush, bitterroot (Montana's state flower), yarrow and fireweed. Hand-painted alpha cards on a single canvas atlas,
// built into one instanced mesh per species (one material, gentle wind sway). Planted in natural patches (one species
// dominating each patch), kept off paths, zone spots, obstacles and the pond. Seasons: spring = bitterroot / balsamroot /
// lupine / paintbrush, summer = lupine / paintbrush / yarrow / fireweed, fall = dried seed heads + browned leaves, winter = none.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { islandRadius, topH, ZONES, OBSTACLES, POND, BRIDGE } from './layout.js';
import { rng, noise } from './noise.js';
import { addInstancedSway } from './gfx.js';

const AW = 1024, AH = 512; // atlas: 8 columns × 2 rows of 128 × 256 cells
const CELL = { balsam: [0, 0], balsamLeaf: [1, 0], lupine: [2, 0], paint: [3, 0], bitter: [4, 0], yarrow: [5, 0], fireweed: [6, 0], stem: [7, 0],
  lupineLeaf: [0, 1], yarrowLeaf: [1, 1], balsamSeed: [2, 1], fireSeed: [3, 1], yarrowDry: [4, 1], leafDry: [5, 1] };
function atlas() {
  const c = document.createElement('canvas'); c.width = AW; c.height = AH; const x = c.getContext('2d'); let s = 1234567;
  const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const cell = (k, fn) => { const [cx, cy] = CELL[k]; x.save(); x.translate(cx * 128, cy * 256); x.beginPath(); x.rect(0, 0, 128, 256); x.clip(); fn(); x.restore(); };
  const stemLine = (x0, y0, x1, y1, w, col = '#4f7a2e') => { x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo((x0 + x1) / 2 + (R() - 0.5) * 6, (y0 + y1) / 2, x1, y1); x.stroke(); };
  const ell = (px, py, rx, ry, rot, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2); x.fill(); };
  // balsamroot head: ~13 broad yellow rays around a golden-brown disc (drawn in the top 128 px, face-on)
  const daisy = (cx, cy, n, len, wid, cols, disc, discR) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + R() * 0.15; ell(cx + Math.cos(a) * len * 0.55, cy + Math.sin(a) * len * 0.55, len * 0.55, wid, a, cols[i % cols.length]); }
    ell(cx, cy, discR, discR, 0, disc); for (let i = 0; i < 40; i++) { const a = R() * 6.28, r = R() * discR * 0.9; ell(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 2, 0, 'rgba(90,55,10,0.55)'); } };
  cell('balsam', () => daisy(64, 64, 13, 56, 11, ['#f7c81e', '#fbd431', '#f2bd12'], '#c98a14', 17));
  cell('balsamSeed', () => { ell(64, 64, 20, 20, 0, '#6b5130'); for (let i = 0; i < 60; i++) { const a = R() * 6.28, r = R() * 19; ell(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 2.5, 2.5, 0, '#3e2c18'); } for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; ell(64 + Math.cos(a) * 28, 64 + Math.sin(a) * 28, 10, 3, a, 'rgba(120,95,60,0.8)'); } });
  // balsamroot leaf: big arrowhead, silvery green, on a petiole
  const arrowLeaf = (col, vein) => { stemLine(64, 256, 64, 150, 6, '#6f8a4a'); x.fillStyle = col; x.beginPath(); x.moveTo(64, 8); x.bezierCurveTo(112, 70, 118, 140, 98, 168); x.lineTo(64, 150); x.lineTo(30, 168); x.bezierCurveTo(10, 140, 16, 70, 64, 8); x.fill();
    x.strokeStyle = vein; x.lineWidth = 2; x.beginPath(); x.moveTo(64, 150); x.lineTo(64, 20); x.stroke(); for (let i = 0; i < 6; i++) { const yy = 40 + i * 18; x.beginPath(); x.moveTo(64, yy + 10); x.lineTo(30 + i * 2, yy - 6); x.moveTo(64, yy + 10); x.lineTo(98 - i * 2, yy - 6); x.stroke(); } };
  cell('balsamLeaf', () => arrowLeaf('#8fa86a', 'rgba(220,230,200,0.5)'));
  cell('leafDry', () => arrowLeaf('#9a7a48', 'rgba(70,50,25,0.5)'));
  // lupine: dense spike of pea flowers in whorls, blue-violet, paler at the tip, buds on top
  cell('lupine', () => { stemLine(64, 256, 64, 10, 5); for (let i = 0; i < 26; i++) { const t = i / 25, yy = 236 - t * 222, w = 30 * (1 - t * 0.75) + 4; const col = t > 0.85 ? '#b9a6e0' : ['#5a4fc0', '#6a5ad0', '#4d47b0', '#7b6ad8'][i % 4];
      for (const sx of [-1, 0, 1]) { if (sx === 0 && i % 2) continue; ell(64 + sx * w * 0.6, yy, 9 * (1 - t * 0.5) + 2, 6 * (1 - t * 0.4) + 2, sx * 0.4, col); if (t < 0.8) ell(64 + sx * w * 0.6, yy - 3, 4, 3, 0, 'rgba(255,255,255,0.75)'); } } });
  // palmate lupine leaf (from above): 7–9 narrow leaflets
  cell('lupineLeaf', () => { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ell(64 + Math.cos(a) * 30, 128 + Math.sin(a) * 30, 30, 8, a, i % 2 ? '#4f7f3a' : '#5c8d44'); } ell(64, 128, 6, 6, 0, '#3e6a2c'); });
  // Indian paintbrush: red-orange bract tips on a leafy green stem
  cell('paint', () => { stemLine(64, 256, 64, 40, 6); for (let i = 0; i < 9; i++) { const yy = 250 - i * 14; ell(64 + (i % 2 ? 12 : -12), yy, 14, 4, i % 2 ? -0.6 : 0.6, '#5d8a3e'); }
    for (let i = 0; i < 34; i++) { const t = i / 33, yy = 120 - t * 108, w = 26 * (1 - t * 0.55); ell(64 + (R() - 0.5) * w * 1.6, yy, 9 - t * 3, 13 - t * 4, (R() - 0.5) * 1.2, ['#e8452a', '#f0602c', '#d93a22', '#f47a35'][i % 4]); }
    for (let i = 0; i < 8; i++) ell(64 + (R() - 0.5) * 30, 118 + R() * 12, 7, 10, R(), '#9ab04a'); });
  // bitterroot: low pink star of many narrow petals, white center (face-on)
  cell('bitter', () => daisy(64, 64, 15, 54, 8, ['#f48cb6', '#f7a3c4', '#ef7aa8', '#fbb9d2'], '#fff1e6', 12));
  // yarrow: flat-topped cluster of tiny white florets (face-on) and a dried brown version
  const umbel = (cols) => { for (let i = 0; i < 70; i++) { const a = R() * 6.28, r = Math.sqrt(R()) * 46; ell(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 5, 5, 0, cols[i % cols.length]); } for (let i = 0; i < 30; i++) { const a = R() * 6.28, r = Math.sqrt(R()) * 44; ell(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1.6, 1.6, 0, 'rgba(200,180,90,0.9)'); } };
  cell('yarrow', () => umbel(['#fbfaf2', '#f2efe2', '#ffffff', '#ece6d6']));
  cell('yarrowDry', () => umbel(['#8a6a40', '#7a5a34', '#9a7a4c']));
  // feathery yarrow leaf
  cell('yarrowLeaf', () => { stemLine(64, 250, 64, 20, 3, '#5a8040'); for (let i = 0; i < 26; i++) { const yy = 240 - i * 8.5; const w = 22 * Math.sin((i / 26) * Math.PI) + 4; for (const sx of [-1, 1]) stemLine(64, yy, 64 + sx * w, yy - 6, 2, '#6a9050'); } });
  // fireweed: magenta four-petal flowers up a tall spike, buds at the top
  cell('fireweed', () => { stemLine(64, 256, 64, 6, 5, '#7a4a52'); for (let i = 0; i < 20; i++) { const t = i / 19, yy = 240 - t * 228, w = 24 * (1 - t * 0.7); const side = i % 2 ? 1 : -1;
      if (t < 0.75) { for (let k = 0; k < 4; k++) ell(64 + side * w + Math.cos(k * 1.57) * 7, yy + Math.sin(k * 1.57) * 7, 7, 5, k * 1.57, ['#d6418f', '#e255a0', '#c93a85'][k % 3]); ell(64 + side * w, yy, 2.5, 2.5, 0, '#f4e0f0'); }
      else ell(64 + side * w * 0.5, yy, 4, 7, 0, '#a8466e'); } });
  cell('fireSeed', () => { stemLine(64, 256, 64, 6, 4, '#8a4a3a'); for (let i = 0; i < 26; i++) { const yy = 240 - i * 8.8; for (const sx of [-1, 1]) { stemLine(64, yy, 64 + sx * (10 + R() * 22), yy - 14 - R() * 10, 2, 'rgba(240,235,225,0.85)'); } } });
  // plain stem with a few narrow leaves
  cell('stem', () => { stemLine(64, 256, 64, 0, 5); for (let i = 0; i < 6; i++) { const yy = 230 - i * 36; ell(64 + (i % 2 ? 14 : -14), yy, 18, 4, i % 2 ? -0.5 : 0.5, '#5a8a3c'); } });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; return t;
}

// ── plant geometry from cards ──
function card(key, w, h, { full = false, y0 = 0 } = {}) { // card standing on its bottom edge, facing +z
  const [cx, cy] = CELL[key]; const u0 = cx * 128 / AW, u1 = (cx + 1) * 128 / AW; const vTop = 1 - cy * 256 / AH, vBot = 1 - (cy + 1) * 256 / AH; const vb = full ? vBot : vTop - 128 / AH; // face-on cells use the top half
  const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2 + y0, 0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? vTop : vb); return g;
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
const place = (g, x, y, z, rx, ry, rz) => { E.set(rx, ry, rz, 'YXZ'); Q.setFromEuler(E); M4.compose(V.set(x, y, z), Q, S); return g.applyMatrix4(M4); };
const crossed = (key, w, h, x, z, y0 = 0, tilt = 0, yaw = 0) => [0, Math.PI / 2].map((a) => place(card(key, w, h, { full: true }), x, y0, z, tilt, yaw + a, 0));
function head(key, d, x, y, z, yaw, tilt) { const g = card(key, d, d); g.translate(0, -d / 2, 0); return place(g, x, y, z, -tilt, yaw, 0); } // face-on disc, tilted up by `tilt`

function plant(kind, r, dry) {
  const parts = []; const n = (a, b) => a + Math.floor(r() * (b - a + 1)); const j = (s) => (r() - 0.5) * s;
  if (kind === 'balsam') { for (let i = 0; i < n(3, 5); i++) { const a = i / 4 * 6.28 + j(0.6); parts.push(place(card(dry ? 'leafDry' : 'balsamLeaf', dry ? 0.1 : 0.16, dry ? 0.18 : 0.3, { full: true }), Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03, dry ? -1.1 - r() * 0.3 : -0.5 - r() * 0.3, -a + Math.PI / 2, 0)); }
    if (!dry || r() < 0.6) for (let i = 0; i < n(2, 4); i++) { const a = r() * 6.28, h = 0.3 + r() * 0.14, ox = Math.cos(a) * 0.05, oz = Math.sin(a) * 0.05;
      parts.push(...crossed('stem', 0.025, h, ox, oz, 0, j(0.2), a)); parts.push(head(dry ? 'balsamSeed' : 'balsam', dry ? 0.07 : 0.13, ox, h + 0.02, oz, a, 0.75 + r() * 0.4)); } }
  if (kind === 'lupine') { for (let i = 0; i < 3; i++) parts.push(head('lupineLeaf', 0.16, j(0.12), 0.1 + r() * 0.06, j(0.12), r() * 6.28, 1.45));
    for (let i = 0; i < n(1, 3); i++) { const x = j(0.12), z = j(0.12), h = 0.18 + r() * 0.1; parts.push(...crossed('stem', 0.03, h, x, z, 0, j(0.15), r() * 3)); parts.push(...crossed('lupine', 0.1, 0.28 + r() * 0.08, x, z, h - 0.02, j(0.15), r() * 3)); } }
  if (kind === 'paint') for (let i = 0; i < n(2, 4); i++) { const x = j(0.14), z = j(0.14); parts.push(...crossed('paint', 0.1, 0.26 + r() * 0.1, x, z, 0, j(0.25), r() * 3)); }
  if (kind === 'bitter') for (let i = 0; i < n(1, 3); i++) parts.push(head('bitter', 0.09 + r() * 0.03, j(0.14), 0.025, j(0.14), r() * 6.28, 1.25 + r() * 0.25));
  if (kind === 'yarrow') { parts.push(...crossed('yarrowLeaf', 0.12, 0.2, 0, 0, 0, 0, r() * 3));
    for (let i = 0; i < n(2, 3); i++) { const x = j(0.1), z = j(0.1), h = 0.32 + r() * 0.16; parts.push(...crossed('stem', 0.025, h, x, z, 0, j(0.15), r() * 3)); parts.push(head(dry ? 'yarrowDry' : 'yarrow', 0.11, x, h + 0.01, z, r() * 6.28, 1.45)); } }
  if (kind === 'fireweed') for (let i = 0; i < n(1, 3); i++) { const x = j(0.14), z = j(0.14); parts.push(...crossed(dry ? 'fireSeed' : 'fireweed', 0.13, 0.55 + r() * 0.2, x, z, 0, j(0.12), r() * 3)); }
  const g = mergeGeometries(parts.map((p) => { p.deleteAttribute('normal'); return p; })); // normals: straight up so cards light like the grass (no dark backsides)
  const nr = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < nr.length; i += 3) nr[i + 1] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); return g;
}

const MIX = { spring: { bitter: 3, balsam: 4, lupine: 3, paint: 2 }, summer: { lupine: 4, paint: 3, yarrow: 3, fireweed: 2, balsam: 1 }, fall: { yarrow: 3, fireweed: 2, balsam: 1 } };

export function buildWildflowers(scene, { season = 'summer', snowy = false, tier = 1, pathD = () => 9 } = {}) {
  const group = new THREE.Group(); group.name = 'wildflowers'; scene.add(group);
  if (snowy || season === 'winter') return { group, count: 0 };
  const mix = MIX[season] || MIX.summer; const dry = season === 'fall'; const R = rng(4242);
  const kinds = Object.keys(mix); const tot = kinds.reduce((a, k) => a + mix[k], 0); const pickKind = () => { let v = R() * tot; for (const k of kinds) { if ((v -= mix[k]) < 0) return k; } return kinds[0]; };
  // the worn dirt paths from the hut (details.js) aren't in pathD: keep flowers off those too
  const hut = ZONES.find((z) => z.id === 'hut'); const from = hut ? (hut.spot || hut.pos) : [0, 0];
  // follow the same wobbly centre-lines details.js draws (0.95 wide), so flowers can sit right up to the trodden edge
  const SEG = ['tree', 'pond', 'market', 'campfire', 'dock', 'shop', 'garden', 'music', 'meadow'].map((id) => ZONES.find((z) => z.id === id)).filter(Boolean).map((z) => z.spot || z.pos);
  SEG.push([BRIDGE.ax, BRIDGE.az]); const PTS = [];
  for (const d of SEG) { const L = Math.hypot(d[0] - from[0], d[1] - from[1]) || 1; const n = Math.ceil(L / 0.4); const ux = (d[0] - from[0]) / L, uz = (d[1] - from[1]) / L;
    for (let i = 0; i <= n; i++) { const t = i / n; const wob = Math.sin(t * 9 + d[0]) * 0.35; PTS.push([from[0] + ux * L * t - uz * wob, from[1] + uz * L * t + ux * wob]); } }
  const segD = (x, z) => { let d = 9; for (const q of PTS) d = Math.min(d, Math.hypot(x - q[0], z - q[1])); return d; };
  const why = (x, z) => { if (segD(x, z) < 0.5) return 'seg'; const th = Math.atan2(z, x); if (Math.hypot(x, z) > islandRadius(th) - 1.2) return 'edge'; if (topH(x, z) > 1.3 || topH(x, z) < -0.3) return 'h';
    if (pathD(x, z) < 0.95) return 'path'; if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.7) return 'pond';
    for (const o of OBSTACLES) if (Math.hypot(x - o.x, z - o.z) < o.r + 0.35) return 'obs';
    for (const zn of ZONES) { const sp = zn.spot || zn.pos; if (Math.hypot(x - sp[0], z - sp[1]) < 1.3) return 'spot:' + zn.id; if (zn.id !== 'meadow' && Math.hypot(x - zn.pos[0], z - zn.pos[1]) < 1.7) return 'zone:' + zn.id; }
    const sl = Math.hypot(topH(x + 0.2, z) - topH(x - 0.2, z), topH(x, z + 0.2) - topH(x, z - 0.2)) / 0.4; return sl < 0.6 ? '' : 'slope'; };
  const ok = (x, z) => !why(x, z);
  // variants: a few geometries per species, instanced
  const tex = atlas(); const mat = addInstancedSway(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }), 0.05, 0.6);
  { const prev = mat.onBeforeCompile; mat.onBeforeCompile = (sh, r) => { prev(sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal);'); };
    const pk = mat.customProgramCacheKey; mat.customProgramCacheKey = () => pk() + 'flowers'; }
  const VAR = {}; for (const k of kinds) VAR[k] = [0, 1, 2].map((i) => { const rr = rng(100 + i * 7 + k.length * 31); return plant(k, rr, dry); });
  const spots = {}; for (const k of kinds) spots[k] = [];
  const patches = Math.round([22, 32, 42, 46][tier] ?? 32) * (dry ? 0.8 : 1); const meadow = ZONES.find((z) => z.id === 'meadow');
  for (let p = 0, tries = 0; p < patches && tries < patches * 30; tries++) {
    let cx, cz; const inMeadow = meadow && p < 14; if (inMeadow) { const a = R() * 6.28, rr = 1.3 + R() * 2.9; cx = meadow.pos[0] + Math.cos(a) * rr; cz = meadow.pos[1] + Math.sin(a) * rr; }
    else { const th = R() * 6.28, r = Math.sqrt(R()) * islandRadius(th) * 0.9; cx = Math.cos(th) * r; cz = Math.sin(th) * r; }
    if (!ok(cx, cz)) continue; p++;
    const main = pickKind(); const N = (inMeadow ? 8 : 5) + Math.floor(R() * 8 * (0.6 + 0.4 * noise(cx * 0.3, cz * 0.3) + 0.4)); const sig = 0.45 + R() * 0.45;
    for (let i = 0; i < N; i++) { const k = R() < 0.8 ? main : pickKind(); const a = R() * 6.28, d = sig * Math.sqrt(-2 * Math.log(Math.max(1e-4, R()))) * 0.7; const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (!ok(x, z)) continue;
      spots[k].push([x, topH(x, z) - 0.01, z, R() * 6.28, 1.05 + R() * 0.5]); }
  }
  const col = new THREE.Color(); let count = 0;
  for (const k of kinds) { const list = spots[k]; if (!list.length) continue; const per = [[], [], []]; list.forEach((s, i) => per[i % 3].push(s));
    per.forEach((ls, vi) => { if (!ls.length) return; const im = new THREE.InstancedMesh(VAR[k][vi], mat, ls.length);
      ls.forEach(([x, y, z, yaw, s], i) => { Q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw); M4.compose(V.set(x, y, z), Q, S.set(s, s * (0.9 + (i % 5) * 0.05), s)); im.setMatrixAt(i, M4);
        im.setColorAt(i, col.setHSL(0, 0, 0.88 + ((i * 37) % 11) / 11 * 0.14)); }); S.set(1, 1, 1);
      im.instanceMatrix.needsUpdate = true; im.receiveShadow = true; im.castShadow = false; im.computeBoundingSphere(); group.add(im); count += ls.length; }); }
  return { group, count, spots, why };
}
