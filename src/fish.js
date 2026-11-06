// Fish of the Bitterroot River near Darby, MT (Montana FWP, Bitterroot drainage: statewide fisheries management plan 2023–2026).
// Natives: westslope cutthroat, bull trout, mountain whitefish, largescale sucker, northern pikeminnow, slimy sculpin.
// Non-native but common: rainbow + brown trout. Brook trout: present in tributaries, rare in the main river.
import * as THREE from 'three';
import { canvasTex } from './textures.js';

export const FISH = {
  whitefish: { name: 'mountain whitefish', native: true, w: 30, inch: [9, 16], keep: true, body: '#b8c2c8', back: '#6f7f88', belly: '#eef2f2', slim: 0.8 },
  rainbow: { name: 'rainbow trout', native: false, w: 20, inch: [10, 20], keep: true, body: '#b9c4a8', back: '#5a7050', belly: '#f4f0e6', band: '#e86a8a', spots: '#1a1a1a' },
  brown: { name: 'brown trout', native: false, w: 16, inch: [10, 22], keep: true, body: '#c8a050', back: '#6a5228', belly: '#f2dca0', spots: '#2a1a0a', red: '#d0402a' },
  cutthroat: { name: 'westslope cutthroat trout', native: true, w: 14, inch: [9, 18], keep: false, why: 'native + species of concern. back you go, legend', body: '#c8b878', back: '#6a6a3a', belly: '#f0e6c0', spots: '#1a1a1a', slash: '#e0302a', tailSpots: true },
  sucker: { name: 'largescale sucker', native: true, w: 6, inch: [12, 20], keep: false, why: 'native and extremely bony. respect', body: '#9a8a6a', back: '#4a4232', belly: '#e8e0cc', slim: 1.05 },
  pikeminnow: { name: 'northern pikeminnow', native: true, w: 4, inch: [10, 18], keep: false, why: 'native. long face. we are similar', body: '#a8b0a0', back: '#5a6a58', belly: '#eef0e8', slim: 0.85 },
  sculpin: { name: 'slimy sculpin', native: true, w: 4, inch: [2, 4], keep: false, why: 'tiny native gremlin. released with honors', body: '#8a7a5a', back: '#4a3c28', belly: '#d8ccb0', mottled: true, big: true },
  brook: { name: 'brook trout', native: false, w: 3, inch: [7, 12], keep: true, body: '#6a7a4a', back: '#2f3f24', belly: '#f08040', worms: true, spots: '#e8402a' },
  bull: { name: 'bull trout', native: true, w: 3, inch: [14, 28], keep: false, why: 'THREATENED. federally protected. catch + release only, gently', body: '#7a8268', back: '#4a5240', belly: '#f0e8d0', pale: '#f2d080' },
};
export const SPECIES = Object.keys(FISH);
export function rollFish(rand = Math.random) {
  const tot = SPECIES.reduce((a, k) => a + FISH[k].w, 0); let r = rand() * tot;
  for (const k of SPECIES) { r -= FISH[k].w; if (r <= 0) { const f = FISH[k]; return { species: k, inches: Math.round((f.inch[0] + rand() * (f.inch[1] - f.inch[0])) * 2) / 2 }; } }
  return { species: 'whitefish', inches: 11 };
}
export function speciesKey(s = '') { const t = String(s).toLowerCase(); return SPECIES.find((k) => t.includes(k) || t.includes(FISH[k].name)) || (t.includes('cutt') ? 'cutthroat' : t.includes('brookie') ? 'brook' : null); }

const texCache = {};
function fishTex(k) {
  if (texCache[k]) return texCache[k]; const f = FISH[k];
  return (texCache[k] = canvasTex(256, 128, (g, w, h) => { // u = nose->tail, v = back->belly
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, f.back); gr.addColorStop(0.45, f.body); gr.addColorStop(1, f.belly); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const R = (n, fn) => { for (let i = 0; i < n; i++) fn(i, ((Math.sin(i * 91.7 + k.length) + 1) / 2), ((Math.sin(i * 37.3 + 3) + 1) / 2)); };
    if (f.band) { g.fillStyle = f.band; g.globalAlpha = 0.75; g.fillRect(0, h * 0.42, w, h * 0.16); g.globalAlpha = 1; }
    if (f.worms) { g.strokeStyle = '#c8d090'; g.lineWidth = 3; R(26, (i, a, b) => { g.beginPath(); g.moveTo(a * w, b * h * 0.4); g.quadraticCurveTo(a * w + 8, b * h * 0.4 + 10, a * w + 16, b * h * 0.4); g.stroke(); }); }
    if (f.pale) { g.fillStyle = f.pale; R(40, (i, a, b) => { g.beginPath(); g.arc(a * w, 10 + b * h * 0.55, 3.5, 0, 7); g.fill(); }); }
    if (f.mottled) { g.fillStyle = 'rgba(40,30,20,.55)'; R(30, (i, a, b) => { g.beginPath(); g.arc(a * w, b * h * 0.8, 7 + a * 6, 0, 7); g.fill(); }); }
    if (f.spots) { R(f.tailSpots ? 60 : 44, (i, a, b) => { const x = f.tailSpots ? w * (0.35 + 0.65 * Math.sqrt(a)) : a * w; const y = 8 + b * h * 0.6; if (f.worms) { g.fillStyle = '#4a7ae0'; g.beginPath(); g.arc(x, y + 20, 5, 0, 7); g.fill(); } g.fillStyle = f.spots; g.beginPath(); g.arc(x, f.worms ? y + 20 : y, f.worms ? 2.6 : 3.2, 0, 7); g.fill(); }); }
    if (f.red) { R(14, (i, a, b) => { g.fillStyle = '#f0e0c0'; g.beginPath(); g.arc(a * w, 30 + b * 40, 6, 0, 7); g.fill(); g.fillStyle = f.red; g.beginPath(); g.arc(a * w, 30 + b * 40, 3.5, 0, 7); g.fill(); }); }
    if (f.slash) { g.fillStyle = f.slash; g.fillRect(w * 0.06, h * 0.78, w * 0.12, h * 0.1); }
  }));
}
// low-poly fish, nose at +z, ~1 unit long (scale by size)
export function fishMesh(k, cooked = false) {
  const f = FISH[k] || FISH.whitefish; const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.5, 14, 10); const p = geo.attributes.position; const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const u = 0.5 - z; const taper = 1 - 0.55 * Math.max(0, u - 0.4) / 0.6; p.setXYZ(i, x * 0.22 * (f.slim || 1) * taper * (f.big && z > 0.2 ? 1.5 : 1), y * 0.36 * (f.slim || 1) * taper, z); uv.setXY(i, 1 - (z + 0.5), (y + 0.5)); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: fishTex(k), roughness: 0.45, metalness: 0.15, color: cooked ? 0x9a6a3a : 0xffffff });
  const body = new THREE.Mesh(geo, mat); body.castShadow = true; g.add(body);
  const fin = new THREE.MeshStandardMaterial({ color: cooked ? 0x6a4a2a : new THREE.Color(f.back).lerp(new THREE.Color(f.body), 0.5), side: THREE.DoubleSide, roughness: 0.6 });
  const tail = new THREE.Shape(); tail.moveTo(0, 0); tail.lineTo(-0.22, -0.26); tail.quadraticCurveTo(-0.05, -0.2, 0, -0.12); tail.quadraticCurveTo(0.05, -0.2, 0.22, -0.26); tail.closePath();
  const tm = new THREE.Mesh(new THREE.ShapeGeometry(tail), fin); tm.rotation.set(Math.PI / 2, 0, Math.PI / 2); tm.rotation.order = 'YXZ'; tm.position.z = -0.42; tm.rotation.set(-Math.PI / 2, Math.PI / 2, 0); g.add(tm);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 3), fin); dorsal.position.set(0, 0.17, 0.02); dorsal.scale.z = 2; g.add(dorsal);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 4), new THREE.MeshBasicMaterial({ color: cooked ? 0xf0f0f0 : 0x111111 })); for (const s of [-1, 1]) { const e = eye.clone(); e.position.set(s * 0.08, 0.04, 0.36); g.add(e); }
  if (f.worms || k === 'bull') for (const s of [-1, 1]) { const pf = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.12), new THREE.MeshStandardMaterial({ color: k === 'bull' ? 0xd8d0b8 : 0xe8602a, side: THREE.DoubleSide })); pf.position.set(s * 0.1, -0.13, 0.18); pf.rotation.set(0.6, s * 0.4, 0); g.add(pf); }
  g.userData.species = k; return g;
}
