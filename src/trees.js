// Bitterroot Valley trees: ponderosa, Douglas fir/spruce, black cottonwood, quaking aspen, willow/alder.
// Hybrid: solid inner canopy volumes (never see-through) + soft alpha leaf/needle cluster cards for detail.
// Far-bank / foothill trees use denser merged LOD geos in InstancedMeshes. Shared canvas textures, no per-frame allocs.
import * as THREE from 'three';
import { rng, noise } from './noise.js';
import { ENV } from './water.js';
import { GREENS, SPRING, BARE } from './season.js';

const TEX = {};
const MATS = {};
const UP = new THREE.Vector3(0, 1, 0);
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

function tex(key, w, h, draw, { srgb = true, wrap = true, mag = THREE.LinearFilter } = {}) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = mag; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
  return (TEX[key] = t);
}
function mat(key, make) { return MATS[key] || (MATS[key] = make()); }

// ── bark ──
export function barkTex(kind = 'pine') {
  return tex('bark-' + kind, 128, 256, (g, w, h) => {
    const r = rng(kind === 'aspen' ? 41 : kind === 'cotton' ? 17 : kind === 'fir' ? 29 : 7);
    if (kind === 'ponderosa') {
      g.fillStyle = '#9a5530'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 80; i++) {
        const x = r() * w, y = r() * h, ww = 14 + r() * 28, hh = 10 + r() * 22;
        g.fillStyle = r() < 0.5 ? '#d07838' : '#b86030'; g.fillRect(x, y, ww, hh);
        g.strokeStyle = 'rgba(50,22,8,0.3)'; g.lineWidth = 1.5; g.strokeRect(x + 1, y + 1, ww - 2, hh - 2);
      }
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(30,12,6,0.22)'; g.fillRect(r() * w, r() * h, 2, 8 + r() * 20); }
    } else if (kind === 'fir') {
      g.fillStyle = '#4a3828'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 3 + r() * 4) { g.strokeStyle = r() < 0.5 ? '#322418' : '#5a4834'; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, 0); for (let y = 0; y < h; y += 8) g.lineTo(x + (r() - 0.5) * 3, y); g.stroke(); }
      for (let i = 0; i < 50; i++) { g.fillStyle = 'rgba(20,12,8,0.35)'; g.fillRect(r() * w, r() * h, 3 + r() * 6, 2); }
    } else if (kind === 'aspen') {
      g.fillStyle = '#ebe6da'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 18; i++) { const y = 10 + r() * (h - 30), x = 20 + r() * (w - 40); g.fillStyle = '#2a2418'; g.beginPath(); g.ellipse(x, y, 5 + r() * 6, 3 + r() * 4, 0, 0, 7); g.fill(); g.fillStyle = '#1a1810'; g.beginPath(); g.ellipse(x - 2, y - 1, 2, 1.5, 0, 0, 7); g.fill(); }
      for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(120,110,90,0.3)'; g.beginPath(); g.moveTo(r() * w, 0); g.lineTo(r() * w, h); g.stroke(); }
      for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(180,60,40,0.12)'; g.fillRect(0, r() * h, w, 4 + r() * 10); }
    } else {
      g.fillStyle = '#6e5c48'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { const x = r() * w; g.strokeStyle = r() < 0.5 ? '#4a3a2a' : '#8a7a68'; g.lineWidth = 2 + r() * 3; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y < h; y += 10) g.lineTo(x + Math.sin(y * 0.1 + i) * 4, y); g.stroke(); }
      for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(30,22,14,0.28)'; g.fillRect(r() * w, r() * h, 4 + r() * 10, 2 + r() * 3); }
    }
  });
}

/** Soft irregular needle-cluster card (filled tuft, not sparse lines). */
function needleCard(kind = 'pine') {
  // Mostly-opaque irregular tuft (alpha stays high so alphaTest keeps a solid silhouette).
  return tex('needle3-' + kind, 96, 96, (g, w, h) => {
    const r = rng(kind === 'fir' ? 255 : 233);
    g.clearRect(0, 0, w, h);
    const base = kind === 'fir' ? [78, 138, 76] : [92, 150, 84];
    const cx = w / 2, cy = h / 2;
    // irregular opaque body
    g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
    g.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rad = 34 + Math.sin(i * 2.7) * 8 + Math.cos(i * 1.3) * 5;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 1.05;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fill();
    // lighter core
    g.fillStyle = `rgba(${base[0] + 35},${base[1] + 40},${base[2] + 25},0.55)`;
    g.beginPath(); g.ellipse(cx - 4, cy - 4, 14, 16, -0.3, 0, 7); g.fill();
    // needle texture strokes (fully opaque)
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2; const len = 12 + r() * 26;
      const shade = 0.7 + r() * 0.5;
      g.strokeStyle = `rgb(${(base[0] * shade) | 0},${(base[1] * shade) | 0},${(base[2] * shade) | 0})`;
      g.lineWidth = kind === 'fir' ? 1.2 : 1.6; g.globalAlpha = 0.85;
      g.beginPath(); g.moveTo(cx + (r() - 0.5) * 12, cy + (r() - 0.5) * 12);
      g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len * (0.75 + r() * 0.35)); g.stroke();
    }
    g.globalAlpha = 1;
  }, { wrap: false });
}

/** Soft multi-leaf cluster card — irregular soft alpha, not a hard square/circle. */
function leafCard(kind, season) {
  // Opaque irregular multi-leaf cluster — silhouette stays above alphaTest.
  const key = `leaf3-${kind}-${season}`;
  return tex(key, 96, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const pal = leafPalette(kind, season);
    const r = rng(kind.length * 19 + season.length * 5 + 11);
    const cx = w / 2, cy = h / 2;
    const col0 = new THREE.Color(pal[0]);
    g.fillStyle = `rgb(${(col0.r * 255) | 0},${(col0.g * 255) | 0},${(col0.b * 255) | 0})`;
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rad = 30 + Math.sin(i * 2.1) * 9 + Math.cos(i * 3.4) * 4;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 0.95;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fill();
    const nLeaves = kind === 'willow' ? 9 : kind === 'aspen' ? 10 : 8;
    for (let i = 0; i < nLeaves; i++) {
      const hex = '#' + new THREE.Color(pal[i % pal.length]).getHexString();
      const lx = cx + (r() - 0.5) * 44, ly = cy + (r() - 0.5) * 44;
      const ang = r() * 6.28; const sx = 8 + r() * 10, sy = 10 + r() * 12;
      g.save(); g.translate(lx, ly); g.rotate(ang); g.fillStyle = hex; g.globalAlpha = 1;
      g.beginPath();
      if (kind === 'willow') {
        g.moveTo(0, -sy); g.quadraticCurveTo(sx * 0.7, 0, 0, sy); g.quadraticCurveTo(-sx * 0.7, 0, 0, -sy);
      } else if (kind === 'aspen') {
        g.ellipse(0, 0, sx * 0.9, sy, 0, 0, 7);
      } else {
        g.moveTo(0, -sy); g.lineTo(sx, sy * 0.15); g.quadraticCurveTo(0, sy * 1.05, -sx, sy * 0.15); g.closePath();
      }
      g.fill(); g.restore();
    }
  }, { wrap: false });
}

function leafPalette(kind, season) {
  if (kind === 'aspen') {
    if (season === 'fall') return [0xf2c848, 0xebac38, 0xffd868, 0xd89828, 0xf8d060];
    if (season === 'winter') return BARE;
    if (season === 'spring') return SPRING;
    return [0x78b850, 0x68a840, 0x88c860, 0x5a9838];
  }
  if (kind === 'willow') {
    if (season === 'fall') return [0xc0bc58, 0xb0b450, 0xd0c060];
    if (season === 'winter') return [0x9a9070, 0x8a8468];
    return [0x92c058, 0x82b04c, 0xa4c868];
  }
  if (season === 'fall') return [0xf0c848, 0xe0a838, 0xf8d458, 0xd0a840, 0xe8bc60];
  if (season === 'winter') return BARE;
  if (season === 'spring') return SPRING;
  return GREENS;
}

function barkMat(kind) {
  return mat('barkM-' + kind, () => new THREE.MeshStandardMaterial({ map: barkTex(kind), roughness: 0.95, color: 0xffffff }));
}
function needleMat(kind, snowy) {
  return mat('needleM2-' + kind + (snowy ? '-s' : ''), () =>
    new THREE.MeshStandardMaterial({
      map: needleCard(kind), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.82,
      color: snowy ? 0xd8e4dc : (kind === 'fir' ? 0xe8ffc8 : 0xf0ffd0),
      emissive: snowy ? 0x000000 : 0x3a5820, emissiveIntensity: 0.28,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
}
function leafMat(kind, season, snowy) {
  return mat(`leafM2-${kind}-${season}${snowy ? '-s' : ''}`, () =>
    new THREE.MeshStandardMaterial({
      map: leafCard(kind, season), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.78,
      color: snowy ? 0xe8eef0 : 0xffffff, emissive: snowy ? 0x000000 : 0x4a3010, emissiveIntensity: season === 'fall' ? 0.22 : 0.1,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
}
function foliageVolMat(kind, season, snowy) {
  return mat(`fvol-${kind}-${season}${snowy ? '-s' : ''}`, () => {
    const pal = kind === 'pine' || kind === 'fir'
      ? (snowy ? [0xb9c8bd] : kind === 'fir' ? [0x2a5a28, 0x326832, 0x244e22] : [0x326830, 0x3a7438, 0x2a5c2a])
      : leafPalette(kind === 'cotton' ? 'cotton' : kind, season).map((h) => {
          const c0 = new THREE.Color(h); c0.multiplyScalar(0.55); return c0.getHex();
        });
    const c = new THREE.Color(pal[Math.floor(pal.length / 2)]);
    if (snowy && kind !== 'pine' && kind !== 'fir') c.lerp(new THREE.Color(0xe8eef0), 0.45);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.88, flatShading: false });
  });
}

function addCyl(parent, matl, rTop, rBot, h, pos, dir, segs = 6) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, matl); m.position.copy(pos);
  m.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function cardGeo() { return mat('_cardGeo', () => new THREE.PlaneGeometry(1, 1)); }

function addFoliageBlob(parent, matl, x, y, z, rx, ry, rz, segs = 7) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  g.scale(rx, ry, rz);
  // nudge verts for irregular silhouette
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i), ny = p.getY(i), nz = p.getZ(i);
    const n = 0.92 + 0.16 * Math.sin(nx * 5.1 + ny * 3.7 + nz * 4.3);
    p.setXYZ(i, nx * n, ny * n, nz * n);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, matl); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

function placeCard(im, k, p, sx, sy, yaw, pitch, roll = 0) {
  _e.set(pitch, yaw, roll); _q.setFromEuler(_e); _s.set(sx, sy, 1); _m4.compose(p, _q, _s); im.setMatrixAt(k, _m4);
}
/** Crossed cluster so cards aren't edge-on. Returns next k. */
function placeCluster(im, k, N, p, s, yaw0, pitch0 = 0) {
  for (let i = 0; i < 3 && k < N; i++) {
    placeCard(im, k++, p, s * (0.75 + (i % 2) * 0.12), s * (0.8 + (i % 3) * 0.08), yaw0 + i * 2.094, pitch0 + (i - 1) * 0.3, (i - 1) * 0.35);
  }
  return k;
}

// ── close-up species ──
export function makePonderosa(opts = {}) {
  const { scale = 1, seed = 1, snowy = false } = opts;
  const r = rng(seed + 100); const g = new THREE.Group(); g.name = 'ponderosa';
  const H = (7 + r() * 3) * scale; const trunkR = (0.22 + r() * 0.08) * scale;
  const bm = barkMat('ponderosa');
  addCyl(g, bm, trunkR * 0.55, trunkR, H * 0.92, new THREE.Vector3(0, 0, 0), UP, 8);

  // solid inner crown volumes (upper 45%)
  const vm = foliageVolMat('pine', 'summer', snowy);
  const crownY0 = H * 0.32;
  const blobs = [
    [0, H * 0.68, 0, 1.85 * scale, 1.7 * scale, 1.85 * scale],
    [0.75 * scale, H * 0.62, 0.25 * scale, 1.2 * scale, 1.05 * scale, 1.15 * scale],
    [-0.7 * scale, H * 0.64, -0.3 * scale, 1.15 * scale, 1.0 * scale, 1.1 * scale],
    [0.2 * scale, H * 0.88, -0.15 * scale, 1.0 * scale, 1.15 * scale, 1.0 * scale],
    [-0.25 * scale, H * 0.5, 0.65 * scale, 1.1 * scale, 0.9 * scale, 1.05 * scale],
    [0.5 * scale, H * 0.52, -0.7 * scale, 1.05 * scale, 0.85 * scale, 1.0 * scale],
    [0.85 * scale, H * 0.78, -0.4 * scale, 0.95 * scale, 0.85 * scale, 0.9 * scale],
    [-0.8 * scale, H * 0.8, 0.35 * scale, 0.95 * scale, 0.85 * scale, 0.9 * scale],
    [0, H * 0.98, 0, 0.7 * scale, 0.85 * scale, 0.7 * scale],
  ];
  for (const b of blobs) addFoliageBlob(g, vm, b[0], b[1], b[2], b[3] * 0.95, b[4] * 0.95, b[5] * 0.95);

  const nm = needleMat('pine', snowy);
  const N = Math.round(480 * scale + 200);
  const im = new THREE.InstancedMesh(cardGeo(), nm, N); let k = 0;
  const nLimbs = 12 + Math.floor(r() * 5);
  for (let i = 0; i < nLimbs; i++) {
    const t = i / nLimbs; const y = crownY0 + t * (H - crownY0) * 0.92; const a = r() * 6.28 + i * 1.7;
    const len = (0.7 + (1 - t) * 1.5) * scale;
    const dir = new THREE.Vector3(Math.cos(a), 0.12 + r() * 0.22, Math.sin(a)).normalize();
    const base = new THREE.Vector3(Math.cos(a) * trunkR * 0.55, y, Math.sin(a) * trunkR * 0.55);
    if (i % 2 === 0) addCyl(g, bm, 0.03 * scale, 0.07 * scale, len, base, dir, 5);
    const tip = base.clone().addScaledVector(dir, len);
    const tufts = 8 + Math.floor(r() * 6);
    for (let j = 0; j < tufts && k < N - 3; j++) {
      const p = tip.clone().add(new THREE.Vector3((r() - 0.5) * 0.85, (r() - 0.5) * 0.6, (r() - 0.5) * 0.85).multiplyScalar(scale));
      if (j < 3) p.copy(base).addScaledVector(dir, len * (0.35 + r() * 0.6)).add(new THREE.Vector3((r() - 0.5) * 0.4, (r() - 0.5) * 0.3, (r() - 0.5) * 0.4).multiplyScalar(scale));
      const s = (0.95 + r() * 0.7) * scale;
      k = placeCluster(im, k, N, p, s, r() * 6.28, (r() - 0.5) * 0.45);
    }
  }
  // fill remaining cards on blob surfaces
  while (k < N - 3) {
    const B = blobs[k % blobs.length];
    const a = r() * 6.28, elev = (r() - 0.35) * Math.PI;
    const p = new THREE.Vector3(B[0] + Math.cos(a) * Math.cos(elev) * B[3] * 1.08, B[1] + Math.sin(elev) * B[4] * 1.08, B[2] + Math.sin(a) * Math.cos(elev) * B[5] * 1.08);
    const s = (0.9 + r() * 0.65) * scale;
    k = placeCluster(im, k, N, p, s, a + Math.PI / 2, elev * 0.45);
  }
  im.count = k; im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.frustumCulled = false; g.add(im);
  const ph = r() * 6;
  g.userData.sway = (t) => { const w = 0.3 + ENV.uWind.value * 2; im.rotation.z = Math.sin(t * 1.15 + ph) * 0.012 * w; im.rotation.x = Math.sin(t * 0.85 + ph * 2) * 0.01 * w; };
  return g;
}

export function makeFir(opts = {}) {
  const { scale = 1, seed = 2, snowy = false } = opts;
  const r = rng(seed + 200); const g = new THREE.Group(); g.name = 'fir';
  const H = (6.5 + r() * 2.5) * scale; const trunkR = (0.16 + r() * 0.05) * scale;
  const bm = barkMat('fir'); addCyl(g, bm, trunkR * 0.4, trunkR, H * 0.95, new THREE.Vector3(), UP, 7);
  const vm = foliageVolMat('fir', 'summer', snowy);

  // layered solid conical masses covering most of trunk height
  const layers = 9 + Math.floor(r() * 2);
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1); const y = H * (0.12 + t * 0.82);
    const rad = (2.05 - t * 1.7) * scale * (0.92 + r() * 0.12);
    addFoliageBlob(g, vm, (r() - 0.5) * 0.12 * scale, y, (r() - 0.5) * 0.12 * scale, rad * 0.95, rad * 0.52, rad * 0.95, 6);
    const a1 = i * 1.7, a2 = a1 + 2.1;
    addFoliageBlob(g, vm, Math.cos(a1) * rad * 0.4, y - 0.08 * scale, Math.sin(a1) * rad * 0.4, rad * 0.62, rad * 0.4, rad * 0.62, 5);
    addFoliageBlob(g, vm, Math.cos(a2) * rad * 0.35, y + 0.05 * scale, Math.sin(a2) * rad * 0.35, rad * 0.55, rad * 0.36, rad * 0.55, 5);
  }

  const nm = needleMat('fir', snowy);
  const N = Math.round(520 * scale + 200);
  const im = new THREE.InstancedMesh(cardGeo(), nm, N); let k = 0;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1); const y = H * (0.16 + t * 0.78); const rad = (1.85 - t * 1.55) * scale;
    const n = Math.max(8, Math.floor(14 * (1 - t * 0.4)));
    for (let j = 0; j < n && k < N; j++) {
      const a = (j / n) * 6.28 + t * 0.7 + r() * 0.25;
      const droop = -0.4 - r() * 0.25; const len = rad * (0.75 + r() * 0.35);
      const base = new THREE.Vector3(Math.cos(a) * trunkR * 0.4, y, Math.sin(a) * trunkR * 0.4);
      const dir = new THREE.Vector3(Math.cos(a), droop, Math.sin(a)).normalize();
      if (i % 2 === 0 && j % 4 === 0) addCyl(g, bm, 0.015 * scale, 0.04 * scale, len * 0.65, base, dir, 4);
      for (let c = 0; c < 3 && k < N - 3; c++) {
        const u = 0.25 + r() * 0.75;
        const p = base.clone().addScaledVector(dir, len * u).add(new THREE.Vector3((r() - 0.5) * 0.35, (r() - 0.5) * 0.22, (r() - 0.5) * 0.35).multiplyScalar(scale));
        const s = (0.85 + r() * 0.55) * scale * (1.1 - t * 0.2);
        k = placeCluster(im, k, N, p, s, a, droop * 0.45);
      }
    }
  }
  while (k < N - 3) {
    const t = r(); const y = H * (0.14 + t * 0.8); const rad = (2.0 - t * 1.65) * scale;
    const a = r() * 6.28; const p = new THREE.Vector3(Math.cos(a) * rad * (0.75 + r() * 0.35), y + (r() - 0.5) * 0.25 * scale, Math.sin(a) * rad * (0.75 + r() * 0.35));
    const s = (0.85 + r() * 0.55) * scale; k = placeCluster(im, k, N, p, s, a, -0.25);
  }
  im.count = k; im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.frustumCulled = false; g.add(im);
  const ph = r() * 6; g.userData.sway = (t) => { const w = 0.3 + ENV.uWind.value * 2; im.rotation.z = Math.sin(t * 1.2 + ph) * 0.01 * w; };
  return g;
}

function deciduousCanopy(g, { scale, r, season, snowy, kind, H, trunkR, bm, limbs, bare }) {
  const vm = foliageVolMat(kind, season, snowy);
  const clusters = [];
  // solid volume blobs at limb tips + crown
  for (const L of limbs) {
    const tip = L.base.clone().addScaledVector(L.dir, L.len * 0.85);
    const rad = (0.85 + r() * 0.45) * scale * (kind === 'aspen' ? 0.85 : 1.15);
    clusters.push({ x: tip.x, y: tip.y, z: tip.z, rx: rad, ry: rad * 0.75, rz: rad });
  }
  // extra crown fill
  const nExtra = kind === 'aspen' ? 7 : 8;
  for (let i = 0; i < nExtra; i++) {
    const a = r() * 6.28; const rad = (1.0 + r() * 0.7) * scale * (kind === 'aspen' ? 0.85 : 1.1);
    clusters.push({
      x: Math.cos(a) * rad * 0.55, y: H * (0.55 + r() * 0.35), z: Math.sin(a) * rad * 0.55,
      rx: rad * (0.85 + r() * 0.35), ry: rad * 0.7, rz: rad * (0.85 + r() * 0.35),
    });
  }
  // central fill so canopy is one solid mass
  clusters.push({ x: 0, y: H * 0.72, z: 0, rx: 1.35 * scale, ry: 1.05 * scale, rz: 1.35 * scale });
  if (!bare) for (const C of clusters) addFoliageBlob(g, vm, C.x, C.y, C.z, C.rx * 1.0, C.ry * 0.9, C.rz * 1.0);

  const lm = leafMat(kind, season, snowy);
  const N = bare ? Math.round(24 * scale) : Math.round((kind === 'aspen' ? 420 : 560) * scale + 160);
  const im = new THREE.InstancedMesh(cardGeo(), lm, N); let k = 0;
  for (let i = 0; i < N && k < N - 3; i++) {
    const C = clusters[i % clusters.length];
    const a = r() * 6.28, elev = (r() - 0.3) * Math.PI;
    const ox = Math.cos(a) * Math.cos(elev), oy = Math.sin(elev), oz = Math.sin(a) * Math.cos(elev);
    const p = new THREE.Vector3(C.x + ox * C.rx * (1.0 + r() * 0.2), C.y + oy * C.ry * (1.0 + r() * 0.2), C.z + oz * C.rz * (1.0 + r() * 0.2));
    const s = (0.85 + r() * 0.65) * scale * (bare ? 0.5 : 1);
    k = placeCluster(im, k, N, p, s, a + Math.PI / 2, elev * 0.5);
  }
  im.count = k; im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.frustumCulled = false; g.add(im);
  return im;
}

export function makeCottonwood(opts = {}) {
  const { scale = 1, seed = 3, season = 'fall', snowy = false, h = null } = opts;
  const r = rng(seed + 300); const g = new THREE.Group(); g.name = 'cottonwood';
  const H = (h || (5.5 + r() * 2.2)) * (h ? 1 : scale); const trunkR = (0.2 + r() * 0.08) * scale;
  const bm = barkMat('cotton'); addCyl(g, bm, trunkR * 0.55, trunkR * 1.15, H * 0.72, new THREE.Vector3(), UP, 8);
  const limbs = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 1.15 + r() * 0.4; const y = H * (0.42 + r() * 0.22); const len = (1.5 + r() * 1.3) * scale;
    const dir = new THREE.Vector3(Math.cos(a), 0.4 + r() * 0.35, Math.sin(a)).normalize();
    const base = new THREE.Vector3(Math.cos(a) * trunkR * 0.5, y, Math.sin(a) * trunkR * 0.5);
    addCyl(g, bm, 0.04 * scale, 0.1 * scale, len, base, dir, 6);
    limbs.push({ base, dir, len });
    const tip = base.clone().addScaledVector(dir, len * 0.65);
    const a2 = a + 1.1; const d2 = new THREE.Vector3(Math.cos(a2), 0.55, Math.sin(a2)).normalize();
    addCyl(g, bm, 0.02 * scale, 0.05 * scale, len * 0.5, tip, d2, 5);
    limbs.push({ base: tip, dir: d2, len: len * 0.5 });
  }
  const bare = season === 'winter';
  const im = deciduousCanopy(g, { scale, r, season, snowy, kind: 'cotton', H, trunkR, bm, limbs, bare });
  const ph = r() * 6; g.userData.sway = (t) => { const w = 0.3 + ENV.uWind.value * 2; im.rotation.z = Math.sin(t * 1.05 + ph) * 0.02 * w; im.rotation.x = Math.sin(t * 0.8 + ph * 2) * 0.015 * w; };
  return g;
}

export function makeAspen(opts = {}) {
  const { scale = 1, seed = 4, season = 'fall', snowy = false } = opts;
  const r = rng(seed + 400); const g = new THREE.Group(); g.name = 'aspen';
  const H = (4.5 + r() * 2) * scale; const trunkR = (0.1 + r() * 0.04) * scale;
  const bm = barkMat('aspen'); addCyl(g, bm, trunkR * 0.7, trunkR, H * 0.88, new THREE.Vector3(), UP, 7);
  const limbs = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.4 + r() * 0.5; const y = H * (0.5 + r() * 0.25); const len = (0.7 + r() * 0.7) * scale;
    const dir = new THREE.Vector3(Math.cos(a), 0.5 + r() * 0.35, Math.sin(a)).normalize();
    const base = new THREE.Vector3(Math.cos(a) * trunkR * 0.5, y, Math.sin(a) * trunkR * 0.5);
    addCyl(g, bm, 0.015 * scale, 0.04 * scale, len, base, dir, 5);
    limbs.push({ base, dir, len });
  }
  // short top limbs so crown isn't a bare pole
  for (let i = 0; i < 3; i++) {
    const a = r() * 6.28; const len = (0.4 + r() * 0.35) * scale;
    const dir = new THREE.Vector3(Math.cos(a), 0.7, Math.sin(a)).normalize();
    const base = new THREE.Vector3(0, H * 0.78, 0);
    limbs.push({ base, dir, len });
  }
  const bare = season === 'winter';
  const im = deciduousCanopy(g, { scale, r, season, snowy, kind: 'aspen', H, trunkR, bm, limbs, bare });
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
  const vm = foliageVolMat('willow', season, snowy);
  if (!bare) {
    addFoliageBlob(g, vm, 0, H * 0.7, 0, 1.35 * scale, 0.9 * scale, 1.35 * scale);
    addFoliageBlob(g, vm, 0.4 * scale, H * 0.55, 0.2 * scale, 0.9 * scale, 0.7 * scale, 0.9 * scale);
    addFoliageBlob(g, vm, -0.35 * scale, H * 0.5, -0.25 * scale, 0.85 * scale, 0.65 * scale, 0.85 * scale);
  }
  const lm = leafMat('willow', season, snowy);
  const N = bare ? 22 : Math.round(360 * scale + 100);
  const im = new THREE.InstancedMesh(cardGeo(), lm, N); let k = 0;
  for (let i = 0; i < N && k < N - 3; i++) {
    const a = r() * 6.28; const rad = (0.5 + r() * 1.4) * scale; const y = H * 0.4 + r() * H * 0.45;
    const droop = rad * 0.4; const p = new THREE.Vector3(Math.cos(a) * rad, y - droop * r(), Math.sin(a) * rad);
    const s = (0.65 + r() * 0.5) * scale; k = placeCluster(im, k, N, p, s, a, 0.5 + r() * 0.4);
  }
  im.count = k; im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.frustumCulled = false; g.add(im);
  const ph = r() * 6; g.userData.sway = (t) => { const w = 0.4 + ENV.uWind.value * 2; im.rotation.z = Math.sin(t * 1.3 + ph) * 0.03 * w; im.rotation.x = Math.cos(t * 1.0 + ph) * 0.02 * w; };
  return g;
}

export function makeBigCottonwood(T, { season = 'fall', snowy = false, seed = 3 } = {}) {
  const r = rng(seed); const g = new THREE.Group(); g.name = 'big-cottonwood';
  const bm = barkMat('cotton');
  const h = T.h; const tg = new THREE.CylinderGeometry(T.topR, T.trunkR, h, 16, 14);
  { const p = tg.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const yy = (v.y + h / 2) / h; const flare = 1 + 0.35 * Math.exp(-yy * 4.5); const lump = 1 + 0.06 * Math.sin(Math.atan2(v.z, v.x) * 5 + yy * 8) + 0.04 * noise(v.x * 2, v.z * 2 + yy * 3); p.setXYZ(i, v.x * flare * lump, v.y, v.z * flare * lump); }
    tg.computeVertexNormals(); }
  const trunk = new THREE.Mesh(tg, bm); trunk.position.y = h / 2; trunk.castShadow = true; trunk.receiveShadow = true; g.add(trunk);
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + 0.4; const rg = new THREE.CylinderGeometry(0.1, 0.42, 1.5, 7); rg.translate(0, 0.75, 0);
    const m = new THREE.Mesh(rg, bm); m.position.set(Math.cos(a) * T.trunkR * 0.7, 0.35, Math.sin(a) * T.trunkR * 0.7);
    m.quaternion.setFromUnitVectors(UP, new THREE.Vector3(Math.cos(a), -0.32, Math.sin(a)).normalize()); m.castShadow = true; g.add(m); }
  T.limbs.forEach((a, i) => {
    const st = T.limbStart(a, i).sub(new THREE.Vector3(T.x, T.y - 0.05, T.z)); const len = 3.0 + (i % 2) * 0.5;
    const lg = new THREE.CylinderGeometry(0.1, 0.24, len, 8); lg.translate(0, len / 2, 0);
    const m = new THREE.Mesh(lg, bm); m.position.copy(st); m.quaternion.setFromUnitVectors(UP, T.limbDir(a)); m.castShadow = true; g.add(m);
    const tw = new THREE.CylinderGeometry(0.04, 0.09, 1.1, 6); tw.translate(0, 0.55, 0);
    const tm = new THREE.Mesh(tw, bm); tm.position.copy(st).addScaledVector(T.limbDir(a), len * 0.7);
    tm.quaternion.setFromUnitVectors(UP, new THREE.Vector3(Math.cos(a + 0.8), 0.9, Math.sin(a + 0.8)).normalize()); tm.castShadow = true; g.add(tm);
  });

  const bare = season === 'winter';
  const canopy = new THREE.Group(); canopy.position.y = h; g.add(canopy);
  const clusters = [[0, 0.55, 0, 2.4], [1.35, 0.25, 0.45, 1.7], [-1.25, 0.3, -0.35, 1.7], [0.25, 0.2, 1.45, 1.55], [-0.35, 0.25, -1.35, 1.55], [0.35, 1.2, 0.15, 1.45],
    [1.0, 0.9, -0.8, 1.2], [-0.9, 0.95, 0.7, 1.2], [0.6, 0.1, 0.2, 1.3]];
  T.limbs.forEach((a, i) => {
    const tip = T.limbStart(a, i).sub(new THREE.Vector3(T.x, T.y - 0.05, T.z)).addScaledVector(T.limbDir(a), 2.6);
    clusters.push([tip.x, tip.y - h + 0.35, tip.z, 1.25]);
  });
  const vm = foliageVolMat('cotton', season, snowy);
  if (!bare) for (const C of clusters) addFoliageBlob(canopy, vm, C[0], C[1], C[2], C[3] * 0.95, C[3] * 0.75, C[3] * 0.95);

  const lm = leafMat('cotton', season, snowy);
  const N = bare ? 120 : 1100;
  const im = new THREE.InstancedMesh(cardGeo(), lm, N); let k = 0;
  for (let i = 0; i < N && k < N - 3; i++) {
    const C = clusters[i % clusters.length];
    const a = r() * 6.28, elev = (r() - 0.3) * Math.PI;
    const ox = Math.cos(a) * Math.cos(elev), oy = Math.sin(elev), oz = Math.sin(a) * Math.cos(elev);
    const p = new THREE.Vector3(C[0] + ox * C[3] * (1.05 + r() * 0.2), C[1] + oy * C[3] * 0.9, C[2] + oz * C[3] * (1.05 + r() * 0.2));
    const s = (0.8 + r() * 0.6) * (bare ? 0.5 : 1);
    k = placeCluster(im, k, N, p, s, a + Math.PI / 2, elev * 0.5);
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

// ── denser LOD geometries (same family as island hybrids: multi-lobe crowns, not lollipops) ──
function mergeGeos(geos, { plain = false } = {}) {
  const pos = [], nor = [], col = [], uv = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0; const p = g.attributes.position; const n = g.attributes.normal || null;
    const u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i)); else nor.push(0, 1, 0);
      if (u) uv.push(u.getX(i), u.getY(i)); else uv.push(0, 0);
      if (plain) col.push(1, 1, 1);
      else if (g0.userData?.trunk) col.push(0.55, 0.36, 0.2);
      else { const y = p.getY(i); const v = 0.78 + 0.22 * Math.min(1, Math.max(0, y / 4)); col.push(v, v, v); }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

function lobedSphere(x, y, z, rx, ry, rz, segs = 7) {
  const s = new THREE.SphereGeometry(1, segs, Math.max(5, segs - 1));
  s.scale(rx, ry, rz);
  const p = s.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i), ny = p.getY(i), nz = p.getZ(i);
    const n = 0.9 + 0.14 * Math.sin(nx * 4.2 + ny * 3.1 + nz * 5.0);
    p.setXYZ(i, nx * n, ny * n, nz * n);
  }
  s.computeVertexNormals(); s.translate(x, y, z); return s;
}

export function lodPineGeo() {
  return mat('_lodPine3', () => {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.12, 0.24, 3.4, 7); trunk.translate(0, 1.7, 0); trunk.userData = { trunk: true }; parts.push(trunk);
    // dense conical stack of flattened lobes (fir habit) covering most of height
    const layers = [
      [1.7, 0.65, 1.15], [1.55, 0.6, 1.6], [1.35, 0.55, 2.05], [1.15, 0.52, 2.5],
      [0.95, 0.5, 2.9], [0.75, 0.48, 3.3], [0.52, 0.45, 3.65], [0.32, 0.42, 3.95], [0.18, 0.4, 4.2],
    ];
    for (const [rad, hh, yy] of layers) {
      parts.push(lobedSphere(0, yy, 0, rad, hh, rad, 8));
      parts.push(lobedSphere(rad * 0.4, yy - 0.1, 0, rad * 0.65, hh * 0.75, rad * 0.65, 6));
      parts.push(lobedSphere(-rad * 0.3, yy - 0.05, rad * 0.35, rad * 0.55, hh * 0.7, rad * 0.55, 6));
      parts.push(lobedSphere(rad * 0.15, yy + 0.08, -rad * 0.35, rad * 0.5, hh * 0.65, rad * 0.5, 6));
    }
    return mergeGeos(parts);
  });
}

export function lodCottonwoodGeo() {
  return mat('_lodCotton3', () => {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.14, 0.28, 3.3, 7); trunk.translate(0, 1.65, 0); trunk.userData = { trunk: true }; parts.push(trunk);
    for (const [a, y, len, ang] of [[0.3, 2.4, 1.55, 0.9], [2.5, 2.65, 1.35, 0.85], [4.4, 2.35, 1.45, 0.95], [1.4, 2.85, 1.15, 1.0], [5.5, 2.7, 1.2, 0.9]]) {
      const b = new THREE.CylinderGeometry(0.05, 0.1, len, 5); b.translate(0, len / 2, 0);
      const m = new THREE.Mesh(b); m.quaternion.setFromUnitVectors(UP, new THREE.Vector3(Math.cos(a), ang * 0.4, Math.sin(a)).normalize());
      m.position.set(Math.cos(a) * 0.15, y, Math.sin(a) * 0.15); m.updateMatrix(); b.applyMatrix4(m.matrix); b.userData = { trunk: true }; parts.push(b);
    }
    const blobs = [
      [0, 3.8, 0, 1.45, 1.15, 1.4], [1.15, 3.45, 0.35, 1.05, 0.85, 1.0], [-1.1, 3.55, -0.3, 1.08, 0.88, 1.02],
      [0.3, 4.55, 0.25, 0.95, 0.8, 0.92], [-0.35, 3.15, 1.15, 0.92, 0.75, 0.88], [0.7, 3.65, -1.05, 0.9, 0.72, 0.86],
      [1.35, 4.05, -0.45, 0.8, 0.65, 0.78], [-1.3, 4.0, 0.5, 0.82, 0.66, 0.8], [0.5, 4.2, 0.9, 0.75, 0.62, 0.72],
      [-0.6, 4.25, -0.7, 0.78, 0.64, 0.74], [0.9, 3.2, 0.8, 0.72, 0.6, 0.7], [-0.85, 3.25, -0.85, 0.72, 0.6, 0.7],
      [0.1, 3.5, -0.1, 1.25, 0.95, 1.2], [0.0, 4.0, 0.0, 1.1, 0.85, 1.05],
      [1.0, 3.7, 0.9, 0.7, 0.58, 0.68], [-0.95, 3.75, -0.85, 0.7, 0.58, 0.68],
    ];
    for (const [x, y, z, rx, ry, rz] of blobs) parts.push(lobedSphere(x, y, z, rx, ry, rz, 8));
    return mergeGeos(parts, { plain: true });
  });
}

export function lodAspenGeo() {
  return mat('_lodAspen3', () => {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.08, 0.13, 3.1, 6); trunk.translate(0, 1.55, 0); trunk.userData = { trunk: true }; parts.push(trunk);
    // denser rounded crown (not a tiny top knot)
    const blobs = [
      [0, 3.45, 0, 0.95, 0.85, 0.95], [0.55, 3.25, 0.2, 0.65, 0.55, 0.62], [-0.52, 3.3, -0.15, 0.62, 0.52, 0.6],
      [0.12, 3.95, 0.12, 0.62, 0.55, 0.62], [0.38, 3.6, -0.4, 0.55, 0.48, 0.52], [-0.35, 3.65, 0.38, 0.55, 0.48, 0.52],
      [0.65, 3.55, 0.4, 0.5, 0.42, 0.48], [-0.6, 3.5, -0.45, 0.5, 0.42, 0.48], [0, 3.1, 0.55, 0.52, 0.45, 0.5],
      [0.2, 3.75, -0.55, 0.48, 0.4, 0.46], [-0.15, 3.8, 0.5, 0.48, 0.4, 0.46],
    ];
    for (const [x, y, z, rx, ry, rz] of blobs) parts.push(lobedSphere(x, y, z, rx, ry, rz, 7));
    return mergeGeos(parts, { plain: true });
  });
}

export function lodWillowGeo() {
  return mat('_lodWillow3', () => {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.1, 0.16, 1.7, 6); trunk.translate(0, 0.85, 0); trunk.userData = { trunk: true }; parts.push(trunk);
    parts.push(lobedSphere(0, 1.85, 0, 1.35, 1.0, 1.35, 10));
    parts.push(lobedSphere(0.45, 1.5, 0.2, 0.9, 0.75, 0.9, 8));
    parts.push(lobedSphere(-0.4, 1.45, -0.25, 0.85, 0.7, 0.85, 8));
    parts.push(lobedSphere(0.15, 1.2, 0.5, 0.7, 0.85, 0.7, 7)); // droop lobe
    return mergeGeos(parts, { plain: true });
  });
}

export function seasonColors(kind, season, snowy) {
  let cols;
  if (kind === 'pine' || kind === 'fir') cols = snowy ? [0xb9c8bd, 0xa8b8ac, 0xc4d0c4] : [0x4a9a58, 0x5aac68, 0x3e8a4a, 0x6aba72, 0x58a060];
  else if (kind === 'aspen') cols = leafPalette('aspen', season).map((c) => c);
  else if (kind === 'willow') cols = leafPalette('willow', season).map((c) => c);
  else cols = leafPalette('cotton', season).map((c) => c);
  return cols;
}

export function bindSway(sways, group) {
  if (group?.userData?.sway) sways.push(group.userData.sway);
}

export const SPECIES = { ponderosa: makePonderosa, fir: makeFir, cottonwood: makeCottonwood, aspen: makeAspen, willow: makeWillow };
