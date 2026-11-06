// Bitterroot Valley trees: ponderosa, Douglas fir/spruce, black cottonwood, quaking aspen, willow/alder.
// Close-up trees use branching trunks + alpha leaf/needle cards. Far-bank / foothill trees use
// merged LOD geometries in InstancedMeshes so thousands stay cheap. Shared canvas textures, no per-frame allocs.
import * as THREE from 'three';
import { rng, noise } from './noise.js';
import { addInstancedSway } from './gfx.js';
import { ENV } from './water.js';
import { GREENS, SPRING, BARE } from './season.js';

const TEX = {};
const MATS = {};
const UP = new THREE.Vector3(0, 1, 0);
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

function tex(key, w, h, draw, { srgb = true, wrap = true, mag = THREE.LinearFilter } = {}) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = mag; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
  return (TEX[key] = t);
}
function mat(key, make) { return MATS[key] || (MATS[key] = make()); }

// ── bark / leaf / needle cards ──
export function barkTex(kind = 'pine') {
  return tex('bark-' + kind, 128, 256, (g, w, h) => {
    const r = rng(kind === 'aspen' ? 41 : kind === 'cotton' ? 17 : kind === 'fir' ? 29 : 7);
    if (kind === 'ponderosa') {
      g.fillStyle = '#8a4a28'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const x = r() * w, y = r() * h, ww = 14 + r() * 28, hh = 10 + r() * 22;
        g.fillStyle = r() < 0.5 ? '#c4682e' : '#a85428'; g.fillRect(x, y, ww, hh);
        g.strokeStyle = 'rgba(40,18,8,0.35)'; g.lineWidth = 1.5; g.strokeRect(x + 1, y + 1, ww - 2, hh - 2);
      }
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(30,12,6,0.25)'; g.fillRect(r() * w, r() * h, 2, 8 + r() * 20); }
    } else if (kind === 'fir') {
      g.fillStyle = '#3a2a20'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 3 + r() * 4) { g.strokeStyle = r() < 0.5 ? '#2a1c14' : '#4a3828'; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, 0); for (let y = 0; y < h; y += 8) g.lineTo(x + (r() - 0.5) * 3, y); g.stroke(); }
      for (let i = 0; i < 50; i++) { g.fillStyle = 'rgba(20,12,8,0.4)'; g.fillRect(r() * w, r() * h, 3 + r() * 6, 2); }
    } else if (kind === 'aspen') {
      g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 18; i++) { const y = 10 + r() * (h - 30), x = 20 + r() * (w - 40); g.fillStyle = '#2a2418'; g.beginPath(); g.ellipse(x, y, 5 + r() * 6, 3 + r() * 4, 0, 0, 7); g.fill(); g.fillStyle = '#1a1810'; g.beginPath(); g.ellipse(x - 2, y - 1, 2, 1.5, 0, 0, 7); g.fill(); }
      for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(120,110,90,0.35)'; g.beginPath(); g.moveTo(r() * w, 0); g.lineTo(r() * w, h); g.stroke(); }
      for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(180,60,40,0.15)'; g.fillRect(0, r() * h, w, 4 + r() * 10); }
    } else { // cottonwood / willow
      g.fillStyle = '#6a5a48'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { const x = r() * w; g.strokeStyle = r() < 0.5 ? '#4a3a2a' : '#8a7a68'; g.lineWidth = 2 + r() * 3; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y < h; y += 10) g.lineTo(x + Math.sin(y * 0.1 + i) * 4, y); g.stroke(); }
      for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(30,22,14,0.3)'; g.fillRect(r() * w, r() * h, 4 + r() * 10, 2 + r() * 3); }
    }
  });
}

function needleCard(kind = 'pine') {
  return tex('needle-' + kind, 64, 128, (g, w, h) => {
    const r = rng(kind === 'fir' ? 55 : 33);
    g.clearRect(0, 0, w, h);
    const base = kind === 'fir' ? [40, 70, 42] : [50, 90, 48];
    for (let i = 0; i < (kind === 'fir' ? 90 : 70); i++) {
      const cx = w * 0.5 + (r() - 0.5) * w * 0.55, top = r() * h * 0.15, bot = h * (0.55 + r() * 0.4);
      const shade = 0.7 + r() * 0.5;
      g.strokeStyle = `rgba(${base[0] * shade | 0},${base[1] * shade | 0},${base[2] * shade | 0},${0.75 + r() * 0.25})`;
      g.lineWidth = kind === 'fir' ? 1.2 : 1.6; g.beginPath(); g.moveTo(cx, top); g.lineTo(cx + (r() - 0.5) * 8, bot); g.stroke();
    }
    // denser tip tuft
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI - Math.PI / 2; g.strokeStyle = `rgb(${base[0]},${base[1] + 20},${base[2]})`; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(w / 2, h * 0.08); g.lineTo(w / 2 + Math.cos(a) * 22, h * 0.08 + Math.sin(a) * 18 + 10); g.stroke();
    }
  }, { wrap: false });
}

function leafCard(kind, season) {
  const key = `leaf-${kind}-${season}`;
  return tex(key, 64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const pal = leafPalette(kind, season);
    const col = pal[Math.floor(pal.length * 0.3)];
    const hex = '#' + new THREE.Color(col).getHexString();
    g.fillStyle = hex;
    g.beginPath();
    if (kind === 'aspen') {
      // round trembling leaf
      g.ellipse(w / 2, h / 2 + 2, 18, 20, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(40,50,20,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(w / 2, h - 6); g.stroke();
    } else if (kind === 'willow') {
      g.moveTo(w / 2, 4); g.quadraticCurveTo(w * 0.85, h * 0.4, w / 2, h - 4); g.quadraticCurveTo(w * 0.15, h * 0.4, w / 2, 4); g.fill();
    } else { // cottonwood — broad deltoid
      g.moveTo(w / 2, 6); g.lineTo(w - 8, h * 0.45); g.quadraticCurveTo(w / 2, h - 2, 8, h * 0.45); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(40,30,10,0.3)'; g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(w / 2, h - 8); g.stroke();
    }
    // slight highlight
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(w * 0.4, h * 0.4, 6, 8, -0.4, 0, 7); g.fill();
  }, { wrap: false });
}

function leafPalette(kind, season) {
  if (kind === 'aspen') {
    if (season === 'fall') return [0xf0c040, 0xe8a830, 0xffd050, 0xd49020];
    if (season === 'winter') return BARE;
    if (season === 'spring') return SPRING;
    return [0x6fb048, 0x5a9a3a, 0x7ec050, 0x4f8a34];
  }
  if (kind === 'willow') {
    if (season === 'fall') return [0xb4b24c, 0xa6aa48, 0xc8b450];
    if (season === 'winter') return [0x9a9070, 0x8a8468];
    return [0x8ab84c, 0x7aa844, 0x9cc058];
  }
  // cottonwood
  if (season === 'fall') return [0xe8c040, 0xd9a830, 0xf0cc50, 0xc9a838, 0xe0b85a];
  if (season === 'winter') return BARE;
  if (season === 'spring') return SPRING;
  return GREENS;
}

function barkMat(kind) {
  return mat('barkM-' + kind, () => new THREE.MeshStandardMaterial({ map: barkTex(kind), roughness: 0.95, color: 0xffffff }));
}
function needleMat(kind, snowy) {
  return mat('needleM-' + kind + (snowy ? '-s' : ''), () => {
    const m = new THREE.MeshStandardMaterial({ map: needleCard(kind), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, color: snowy ? 0xd8e4dc : 0xffffff });
    return m;
  });
}
function leafMat(kind, season, snowy) {
  return mat(`leafM-${kind}-${season}${snowy ? '-s' : ''}`, () => {
    const m = new THREE.MeshStandardMaterial({ map: leafCard(kind, season), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: snowy ? 0xe8eef0 : 0xffffff });
    return m;
  });
}

// ── helpers ──
function addCyl(parent, mat, rTop, rBot, h, pos, dir, segs = 6) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat); m.position.copy(pos);
  m.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function cardGeo() { return mat('_cardGeo', () => new THREE.PlaneGeometry(1, 1)); }

function scatterCards(im, count, placeFn) {
  for (let i = 0; i < count; i++) {
    const { p, s, yaw, pitch } = placeFn(i);
    _e.set(pitch || (Math.random() - 0.5) * 0.8, yaw, (Math.random() - 0.5) * 0.5);
    _q.setFromEuler(_e); _s.set(s, s, s); _m4.compose(p, _q, _s); im.setMatrixAt(i, _m4);
  }
  im.instanceMatrix.needsUpdate = true; im.count = count; im.frustumCulled = false; im.castShadow = true;
}

// ── close-up species builders (island) ──
export function makePonderosa(opts = {}) {
  const { scale = 1, seed = 1, snowy = false } = opts;
  const r = rng(seed + 100); const g = new THREE.Group(); g.name = 'ponderosa';
  const H = (7 + r() * 3) * scale; const trunkR = (0.22 + r() * 0.08) * scale;
  const bm = barkMat('ponderosa');
  addCyl(g, bm, trunkR * 0.55, trunkR, H * 0.92, new THREE.Vector3(0, 0, 0), UP, 8);
  // high crown of needle tufts on short limbs
  const crownY0 = H * 0.42; const nLimbs = 10 + Math.floor(r() * 5);
  const nm = needleMat('pine', snowy); const N = Math.round(140 * scale + 80);
  const im = new THREE.InstancedMesh(cardGeo(), nm, N); let k = 0;
  for (let i = 0; i < nLimbs; i++) {
    const t = i / nLimbs; const y = crownY0 + t * (H - crownY0) * 0.95; const a = r() * 6.28 + i * 1.7;
    const len = (0.6 + (1 - t) * 1.4) * scale; const dir = new THREE.Vector3(Math.cos(a), 0.15 + r() * 0.25, Math.sin(a)).normalize();
    addCyl(g, bm, 0.03 * scale, 0.07 * scale, len, new THREE.Vector3(Math.cos(a) * trunkR * 0.6, y, Math.sin(a) * trunkR * 0.6), dir, 5);
    const tip = new THREE.Vector3(Math.cos(a) * trunkR * 0.6, y, Math.sin(a) * trunkR * 0.6).addScaledVector(dir, len);
    const tufts = 4 + Math.floor(r() * 4);
    for (let j = 0; j < tufts && k < N; j++) {
      const p = tip.clone().add(new THREE.Vector3((r() - 0.5) * 0.4, (r() - 0.5) * 0.35, (r() - 0.5) * 0.4).multiplyScalar(scale));
      const s = (0.28 + r() * 0.32) * scale; _e.set((r() - 0.5) * 1.2, r() * 6.28, (r() - 0.5) * 0.6);
      _q.setFromEuler(_e); _s.set(s * 0.75, s * 1.35, s); _m4.compose(p, _q, _s); im.setMatrixAt(k++, _m4);
    }
  }
  // top candle
  for (let j = 0; j < 8 && k < N; j++) {
    const p = new THREE.Vector3((r() - 0.5) * 0.3 * scale, H - 0.2 * scale + r() * 0.3 * scale, (r() - 0.5) * 0.3 * scale);
    const s = (0.25 + r() * 0.28) * scale; _e.set((r() - 0.5), r() * 6, 0); _q.setFromEuler(_e); _s.set(s * 0.65, s * 1.25, s); _m4.compose(p, _q, _s); im.setMatrixAt(k++, _m4);
  }
  im.count = k; im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.frustumCulled = false; g.add(im);
  const canopy = im; const ph = r() * 6;
  g.userData.sway = (t) => { const w = 0.3 + ENV.uWind.value * 2; canopy.rotation.z = Math.sin(t * 1.15 + ph) * 0.012 * w; canopy.rotation.x = Math.sin(t * 0.85 + ph * 2) * 0.01 * w; };
  return g;
}

export function makeFir(opts = {}) {
  const { scale = 1, seed = 2, snowy = false } = opts;
  const r = rng(seed + 200); const g = new THREE.Group(); g.name = 'fir';
  const H = (6.5 + r() * 2.5) * scale; const trunkR = (0.16 + r() * 0.05) * scale;
  const bm = barkMat('fir'); addCyl(g, bm, trunkR * 0.4, trunkR, H * 0.95, new THREE.Vector3(), UP, 7);
  const nm = needleMat('fir', snowy); const layers = 9 + Math.floor(r() * 3); const N = Math.round(160 * scale + 80);
  const im = new THREE.InstancedMesh(cardGeo(), nm, N); let k = 0;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1); const y = H * (0.18 + t * 0.78); const rad = (1.6 - t * 1.35) * scale * (0.85 + r() * 0.2);
    const n = Math.max(5, Math.floor(10 * (1 - t * 0.5)));
    for (let j = 0; j < n && k < N; j++) {
      const a = (j / n) * 6.28 + t * 0.7 + r() * 0.2;
      const droop = -0.35 - r() * 0.25; const len = rad * (0.7 + r() * 0.4);
      const base = new THREE.Vector3(Math.cos(a) * trunkR * 0.5, y, Math.sin(a) * trunkR * 0.5);
      const dir = new THREE.Vector3(Math.cos(a), droop, Math.sin(a)).normalize();
      if (i % 2 === 0 && j % 3 === 0) addCyl(g, bm, 0.015 * scale, 0.04 * scale, len * 0.7, base, dir, 4);
      const tip = base.clone().addScaledVector(dir, len * 0.85);
      for (let c = 0; c < 3 && k < N; c++) {
        const p = tip.clone().add(new THREE.Vector3((r() - 0.5) * 0.25, (r() - 0.5) * 0.15, (r() - 0.5) * 0.25).multiplyScalar(scale));
        const s = (0.22 + r() * 0.28) * scale * (1.15 - t * 0.25);
        _e.set(droop + (r() - 0.5) * 0.4, a + (r() - 0.5), (r() - 0.5) * 0.5); _q.setFromEuler(_e);
        _s.set(s * 0.9, s * 0.65, s); _m4.compose(p, _q, _s); im.setMatrixAt(k++, _m4);
      }
    }
  }
  im.count = k; im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.frustumCulled = false; g.add(im);
  const ph = r() * 6; g.userData.sway = (t) => { const w = 0.3 + ENV.uWind.value * 2; im.rotation.z = Math.sin(t * 1.2 + ph) * 0.01 * w; };
  return g;
}

export function makeCottonwood(opts = {}) {
  const { scale = 1, seed = 3, season = 'fall', snowy = false, h = null, colors = null } = opts;
  const r = rng(seed + 300); const g = new THREE.Group(); g.name = 'cottonwood';
  const H = (h || (5.5 + r() * 2.2)) * (h ? 1 : scale); const trunkR = (0.2 + r() * 0.08) * scale;
  const bm = barkMat('cotton'); addCyl(g, bm, trunkR * 0.55, trunkR * 1.15, H * 0.72, new THREE.Vector3(), UP, 8);
  // primary limbs
  const limbs = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.35 + r() * 0.4; const y = H * (0.45 + r() * 0.2); const len = (1.4 + r() * 1.2) * scale;
    const dir = new THREE.Vector3(Math.cos(a), 0.45 + r() * 0.3, Math.sin(a)).normalize();
    const base = new THREE.Vector3(Math.cos(a) * trunkR * 0.5, y, Math.sin(a) * trunkR * 0.5);
    addCyl(g, bm, 0.04 * scale, 0.1 * scale, len, base, dir, 6);
    limbs.push({ base, dir, len });
    // secondary
    const tip = base.clone().addScaledVector(dir, len * 0.7);
    const a2 = a + 1.2; const d2 = new THREE.Vector3(Math.cos(a2), 0.6, Math.sin(a2)).normalize();
    addCyl(g, bm, 0.02 * scale, 0.05 * scale, len * 0.45, tip, d2, 5);
    limbs.push({ base: tip, dir: d2, len: len * 0.45 });
  }
  const bare = season === 'winter';
  const lm = leafMat('cotton', season, snowy);
  const N = bare ? Math.round(30 * scale) : Math.round(220 * scale + 80);
  const im = new THREE.InstancedMesh(cardGeo(), lm, N); let k = 0;
  const pal = colors || leafPalette('cotton', season);
  for (let i = 0; i < N; i++) {
    const L = limbs[i % limbs.length];
    const u = 0.35 + r() * 0.7; const p = L.base.clone().addScaledVector(L.dir, L.len * u);
    p.x += (r() - 0.5) * 0.9 * scale; p.y += (r() - 0.5) * 0.7 * scale; p.z += (r() - 0.5) * 0.9 * scale;
    const s = (0.18 + r() * 0.28) * scale * (bare ? 0.55 : 1);
    _e.set((r() - 0.5) * 1.4, r() * 6.28, (r() - 0.5) * 0.8); _q.setFromEuler(_e); _s.set(s, s * 1.15, s); _m4.compose(p, _q, _s); im.setMatrixAt(k++, _m4);
    if (im.instanceColor) { /* skip */ }
  }
  // tint via material color already from texture; optional vertex colors skipped for instancing simplicity
  im.count = k; im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.frustumCulled = false; g.add(im);
  void pal;
  const ph = r() * 6; g.userData.sway = (t) => { const w = 0.3 + ENV.uWind.value * 2; im.rotation.z = Math.sin(t * 1.05 + ph) * 0.02 * w; im.rotation.x = Math.sin(t * 0.8 + ph * 2) * 0.015 * w; };
  return g;
}

export function makeAspen(opts = {}) {
  const { scale = 1, seed = 4, season = 'fall', snowy = false } = opts;
  const r = rng(seed + 400); const g = new THREE.Group(); g.name = 'aspen';
  const H = (4.5 + r() * 2) * scale; const trunkR = (0.1 + r() * 0.04) * scale;
  const bm = barkMat('aspen'); addCyl(g, bm, trunkR * 0.7, trunkR, H * 0.85, new THREE.Vector3(), UP, 7);
  const bare = season === 'winter';
  const lm = leafMat('aspen', season, snowy);
  const N = bare ? 16 : Math.round(140 * scale + 50);
  const im = new THREE.InstancedMesh(cardGeo(), lm, N); let k = 0;
  const crownY = H * 0.55;
  for (let i = 0; i < N; i++) {
    const a = r() * 6.28; const rad = r() * 1.1 * scale; const y = crownY + r() * (H - crownY) * 0.9;
    const p = new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad);
    const s = (0.14 + r() * 0.2) * scale;
    // aspen leaves tremble: slightly more yaw variety
    _e.set((r() - 0.5) * 1.6, r() * 6.28, (r() - 0.5) * 1.2); _q.setFromEuler(_e); _s.set(s, s, s); _m4.compose(p, _q, _s); im.setMatrixAt(k++, _m4);
  }
  im.count = k; im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.frustumCulled = false; g.add(im);
  const ph = r() * 6; g.userData.sway = (t) => { const w = 0.4 + ENV.uWind.value * 2.5; im.rotation.y = Math.sin(t * 4.5 + ph) * 0.04 * w; im.rotation.z = Math.sin(t * 1.3 + ph) * 0.02 * w; };
  return g;
}

export function makeWillow(opts = {}) {
  const { scale = 1, seed = 5, season = 'fall', snowy = false } = opts;
  const r = rng(seed + 500); const g = new THREE.Group(); g.name = 'willow';
  const H = (3.2 + r() * 1.2) * scale; const trunkR = (0.12 + r() * 0.04) * scale;
  const bm = barkMat('cotton');
  addCyl(g, bm, trunkR * 0.7, trunkR, H * 0.55, new THREE.Vector3(), new THREE.Vector3(0.08, 1, 0.05).normalize(), 6);
  const bare = season === 'winter';
  const lm = leafMat('willow', season, snowy);
  const N = bare ? 22 : Math.round(160 * scale + 50);
  const im = new THREE.InstancedMesh(cardGeo(), lm, N); let k = 0;
  for (let i = 0; i < N; i++) {
    const a = r() * 6.28; const rad = (0.4 + r() * 1.3) * scale; const y = H * 0.45 + r() * H * 0.4;
    // drooping: cards hang lower at outer radius
    const droop = rad * 0.35; const p = new THREE.Vector3(Math.cos(a) * rad, y - droop * r(), Math.sin(a) * rad);
    const s = (0.16 + r() * 0.22) * scale; _e.set(0.6 + r() * 0.8, a, (r() - 0.5) * 0.4); _q.setFromEuler(_e); _s.set(s * 0.4, s * 1.5, s); _m4.compose(p, _q, _s); im.setMatrixAt(k++, _m4);
  }
  im.count = k; im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.frustumCulled = false; g.add(im);
  const ph = r() * 6; g.userData.sway = (t) => { const w = 0.4 + ENV.uWind.value * 2; im.rotation.z = Math.sin(t * 1.3 + ph) * 0.03 * w; im.rotation.x = Math.cos(t * 1.0 + ph) * 0.02 * w; };
  return g;
}

// Big treehouse cottonwood: keeps BIGTREE limb anchors (swing/owl/feeder/cabin) and upgrades canopy to leaf cards.
export function makeBigCottonwood(T, { season = 'fall', snowy = false, seed = 3 } = {}) {
  const r = rng(seed); const g = new THREE.Group(); g.name = 'big-cottonwood';
  const bm = barkMat('cotton');
  // flared lumpy trunk (same proportions as before)
  const h = T.h; const tg = new THREE.CylinderGeometry(T.topR, T.trunkR, h, 16, 14);
  { const p = tg.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const yy = (v.y + h / 2) / h; const flare = 1 + 0.35 * Math.exp(-yy * 4.5); const lump = 1 + 0.06 * Math.sin(Math.atan2(v.z, v.x) * 5 + yy * 8) + 0.04 * noise(v.x * 2, v.z * 2 + yy * 3); p.setXYZ(i, v.x * flare * lump, v.y, v.z * flare * lump); }
    tg.computeVertexNormals(); }
  const trunk = new THREE.Mesh(tg, bm); trunk.position.y = h / 2; trunk.castShadow = true; trunk.receiveShadow = true; g.add(trunk);
  // buttress roots
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + 0.4; const rg = new THREE.CylinderGeometry(0.1, 0.42, 1.5, 7); rg.translate(0, 0.75, 0);
    const m = new THREE.Mesh(rg, bm); m.position.set(Math.cos(a) * T.trunkR * 0.7, 0.35, Math.sin(a) * T.trunkR * 0.7);
    m.quaternion.setFromUnitVectors(UP, new THREE.Vector3(Math.cos(a), -0.32, Math.sin(a)).normalize()); m.castShadow = true; g.add(m); }
  // limbs (exact BIGTREE anchors)
  T.limbs.forEach((a, i) => {
    const st = T.limbStart(a, i).sub(new THREE.Vector3(T.x, T.y - 0.05, T.z)); const len = 3.0 + (i % 2) * 0.5;
    const lg = new THREE.CylinderGeometry(0.1, 0.24, len, 8); lg.translate(0, len / 2, 0);
    const m = new THREE.Mesh(lg, bm); m.position.copy(st); m.quaternion.setFromUnitVectors(UP, T.limbDir(a)); m.castShadow = true; g.add(m);
    const tw = new THREE.CylinderGeometry(0.04, 0.09, 1.1, 6); tw.translate(0, 0.55, 0);
    const tm = new THREE.Mesh(tw, bm); tm.position.copy(st).addScaledVector(T.limbDir(a), len * 0.7);
    tm.quaternion.setFromUnitVectors(UP, new THREE.Vector3(Math.cos(a + 0.8), 0.9, Math.sin(a + 0.8)).normalize()); tm.castShadow = true; g.add(tm);
  });

  // leaf canopy as cards (keeps limbs free for treehouse / swing / owl)
  const bare = season === 'winter';
  const lm = leafMat('cotton', season, snowy);
  const N = bare ? 100 : 520;
  const im = new THREE.InstancedMesh(cardGeo(), lm, N); let k = 0;
  const canopy = new THREE.Group(); canopy.position.y = h; g.add(canopy);
  // clusters around crown + above each limb tip
  const clusters = [[0, 0.5, 0, 2.2], [1.2, 0.2, 0.4, 1.5], [-1.1, 0.25, -0.3, 1.5], [0.2, 0.15, 1.3, 1.4], [-0.3, 0.2, -1.2, 1.4], [0.3, 1.1, 0.1, 1.3]];
  T.limbs.forEach((a, i) => {
    const tip = T.limbStart(a, i).sub(new THREE.Vector3(T.x, T.y - 0.05, T.z)).addScaledVector(T.limbDir(a), 2.6);
    clusters.push([tip.x, tip.y - h + 0.3, tip.z, 1.1]);
  });
  for (let i = 0; i < N; i++) {
    const C = clusters[i % clusters.length];
    const p = new THREE.Vector3(C[0] + (r() - 0.5) * C[3], C[1] + (r() - 0.5) * C[3] * 0.7, C[2] + (r() - 0.5) * C[3]);
    const s = (0.16 + r() * 0.26) * (bare ? 0.55 : 1);
    _e.set((r() - 0.5) * 1.5, r() * 6.28, (r() - 0.5) * 0.9); _q.setFromEuler(_e); _s.set(s, s * 1.2, s); _m4.compose(p, _q, _s); im.setMatrixAt(k++, _m4);
  }
  im.count = k; im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.frustumCulled = false; canopy.add(im);
  if (snowy && !bare) {
    const sm = mat('snowcap', () => new THREE.MeshStandardMaterial({ color: 0xf6f8ff, roughness: 1 }));
    for (const C of clusters.slice(0, 6)) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(C[3] * 0.45, 10, 6, 0, 6.29, 0, 1.2), sm);
      m.position.set(C[0], C[1] + 0.35, C[2]); m.scale.set(1, 0.45, 1); canopy.add(m);
    }
  }
  const ph = r() * 6; g.userData.sway = (t) => { const w = 0.3 + ENV.uWind.value * 2; canopy.rotation.z = Math.sin(t * 1.05 + ph) * 0.018 * w; canopy.rotation.x = Math.sin(t * 0.8 + ph * 2) * 0.014 * w; };
  return g;
}

// ── LOD geometries for landscape InstancedMeshes ──
function mergeGeos(geos, { plain = false, trunkBrown = false } = {}) {
  const pos = [], nor = [], col = [], uv = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0; const p = g.attributes.position; const n = g.attributes.normal || null;
    const u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i)); else nor.push(0, 1, 0);
      if (u) uv.push(u.getX(i), u.getY(i)); else uv.push(0, 0);
      if (plain) col.push(1, 1, 1);
      else if (trunkBrown || g0.userData?.trunk) col.push(0.42, 0.28, 0.16);
      else { const y = p.getY(i); const v = 0.72 + 0.28 * Math.min(1, Math.max(0, y / 4)); col.push(v, v, v); }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

/** Better foothill pine LOD: tall ponderosa-ish with layered branch discs + trunk. */
export function lodPineGeo() {
  return mat('_lodPine', () => {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.12, 0.22, 2.4, 6); trunk.translate(0, 1.2, 0); trunk.userData = { trunk: true }; parts.push(trunk);
    // high crown layers (ponderosa habit) + lower skirt for Douglas-fir mix
    const layers = [[0.95, 0.7, 1.9], [0.85, 0.65, 2.35], [0.7, 0.6, 2.8], [0.55, 0.55, 3.2], [0.38, 0.5, 3.55], [0.22, 0.45, 3.85]];
    for (const [rad, hh, yy] of layers) {
      const cone = new THREE.ConeGeometry(rad, hh, 7); cone.translate(0, yy, 0); parts.push(cone);
      // branch stubs
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + yy; const arm = new THREE.CylinderGeometry(0.03, 0.05, rad * 0.85, 4);
        arm.rotateZ(Math.PI / 2 - 0.35); arm.translate(Math.cos(a) * rad * 0.35, yy - 0.15, Math.sin(a) * rad * 0.35);
        arm.userData = { trunk: true }; parts.push(arm);
      }
    }
    return mergeGeos(parts);
  });
}

/** Cottonwood LOD: irregular crown + branched trunk. */
export function lodCottonwoodGeo() {
  return mat('_lodCotton', () => {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.14, 0.26, 3.2, 7); trunk.translate(0, 1.6, 0); trunk.userData = { trunk: true }; parts.push(trunk);
    for (const [a, y, len, ang] of [[0.3, 2.4, 1.5, 0.9], [2.5, 2.6, 1.3, 0.85], [4.4, 2.3, 1.4, 0.95], [1.4, 2.8, 1.1, 1.0]]) {
      const b = new THREE.CylinderGeometry(0.05, 0.1, len, 5); b.translate(0, len / 2, 0);
      const m = new THREE.Mesh(b); m.quaternion.setFromUnitVectors(UP, new THREE.Vector3(Math.cos(a), ang * 0.4, Math.sin(a)).normalize());
      m.position.set(Math.cos(a) * 0.15, y, Math.sin(a) * 0.15); m.updateMatrix(); b.applyMatrix4(m.matrix); b.userData = { trunk: true }; parts.push(b);
    }
    // irregular crown: many slightly flattened blobs for a ragged cottonwood silhouette
    const blobs = [[0, 3.7, 0, 1.0], [0.95, 3.35, 0.25, 0.7], [-0.9, 3.45, -0.2, 0.72], [0.2, 4.35, 0.15, 0.65], [-0.25, 3.15, 0.95, 0.62], [0.55, 3.55, -0.85, 0.58],
      [1.1, 3.9, -0.35, 0.5], [-1.05, 3.85, 0.4, 0.52], [0.35, 4.0, 0.7, 0.48], [-0.5, 4.05, -0.55, 0.5], [0.7, 3.2, 0.6, 0.45], [-0.65, 3.25, -0.65, 0.45]];
    for (const [x, y, z, rad] of blobs) { const s = new THREE.SphereGeometry(rad, 8, 6); s.scale(1.15, 0.75, 1.05); s.translate(x, y, z); parts.push(s); }
    return mergeGeos(parts, { plain: true });
  });
}

export function lodAspenGeo() {
  return mat('_lodAspen', () => {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.08, 0.12, 3.0, 6); trunk.translate(0, 1.5, 0); trunk.userData = { trunk: true }; parts.push(trunk);
    for (const [x, y, z, rad] of [[0, 3.35, 0, 0.55], [0.4, 3.15, 0.12, 0.38], [-0.38, 3.2, -0.1, 0.36], [0.08, 3.75, 0.08, 0.34], [0.25, 3.5, -0.3, 0.3], [-0.22, 3.55, 0.28, 0.3]]) {
      const s = new THREE.SphereGeometry(rad, 7, 5); s.scale(1.1, 0.85, 1.1); s.translate(x, y, z); parts.push(s);
    }
    return mergeGeos(parts, { plain: true });
  });
}

export function lodWillowGeo() {
  return mat('_lodWillow', () => {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.1, 0.16, 1.7, 6); trunk.translate(0, 0.85, 0); trunk.userData = { trunk: true }; parts.push(trunk);
    const dome = new THREE.SphereGeometry(1.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
    const ps = dome.attributes.position; for (let i = 0; i < ps.count; i++) { const y = ps.getY(i); ps.setY(i, y * 1.45 + 0.35 * Math.max(0, 0.25 - y)); }
    dome.computeVertexNormals(); dome.translate(0, 1.5, 0); parts.push(dome);
    return mergeGeos(parts, { plain: true });
  });
}

export function seasonColors(kind, season, snowy) {
  let cols;
  if (kind === 'pine' || kind === 'fir') cols = snowy ? [0xb9c8bd, 0xa8b8ac, 0xc4d0c4] : [0x2f6b3e, 0x3a7a48, 0x285a32, 0x4a8a52];
  else if (kind === 'aspen') cols = leafPalette('aspen', season).map((c) => c);
  else if (kind === 'willow') cols = leafPalette('willow', season).map((c) => c);
  else cols = leafPalette('cotton', season).map((c) => c);
  return cols;
}

/** Register a tree group's sway into the island sways list. */
export function bindSway(sways, group) {
  if (group?.userData?.sway) sways.push(group.userData.sway);
}

export const SPECIES = { ponderosa: makePonderosa, fir: makeFir, cottonwood: makeCottonwood, aspen: makeAspen, willow: makeWillow };
