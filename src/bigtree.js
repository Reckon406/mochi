// 🌳 The treehouse cottonwood, rebuilt to look like a real old black cottonwood: one furrowed photo-bark trunk (Poly Haven
// bark_brown_02, CC0) with root buttresses, curved tapering scaffold limbs that fork twice, and a canopy of many small
// painted leaf sprays on the twig tips (soft spherical normals + inner shading instead of low-poly blobs).
// Every attachment anchor stays put: the trunk follows T.radiusAt(h) (ladder, sign, hammock) and each limb runs dead
// straight along T.limbDir(a) from T.limbStart(a, i) for its first 2.6 m (owl perch, feeder hook), then bends up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, noise } from './noise.js';
import { ENV } from './water.js';
import { GREENS, SPRING } from './season.js';
import { barkTex } from './trees.js';

const UP = new THREE.Vector3(0, 1, 0);
const TEXW = 1.3; // metres of bark per texture repeat
const loader = new THREE.TextureLoader();

// tapered tube along a curve; uv.x around (metres / TEXW), uv.y along
function tube(curve, r0, r1, radial, tubular, { lump = 0, seed = 0, flare = null } = {}) {
  const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false); const p = g.attributes.position, uv = g.attributes.uv;
  const L = curve.getLength(); const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) { const t = i / tubular; curve.getPointAt(t, c); let r = r0 + (r1 - r0) * Math.pow(t, 0.8); if (flare) r = flare(t, r);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(p, k).sub(c); const a = (j / radial) * Math.PI * 2;
      const lm = 1 + lump * (Math.sin(a * 5 + t * 6 + seed) * 0.6 + noise(a * 1.7 + seed, t * 9) * 0.8 - 0.3);
      v.multiplyScalar(r * lm).add(c); p.setXYZ(k, v.x, v.y, v.z);
      uv.setXY(k, (j / radial) * Math.max(1, Math.round((2 * Math.PI * Math.max(r0, 0.05)) / TEXW)), (t * L) / TEXW + seed * 0.37); } }
  g.computeVertexNormals(); return g;
}

// painted cottonwood leaf spray: ~26 deltoid leaves on a little twig, per season palette
function leafTex(season) {
  const W = 256; const c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d'); const r = rng(77 + season.length);
  const pal = season === 'fall' ? [0xf2c440, 0xe8b032, 0xf8d65a, 0xd99a2a, 0xc9b040, 0xe6c24c] : season === 'spring' ? SPRING : [...GREENS, 0x6a9e44];
  g.strokeStyle = '#5a4630'; g.lineWidth = 3; g.beginPath(); g.moveTo(W * 0.5, W * 0.98); g.quadraticCurveTo(W * 0.46, W * 0.6, W * 0.52, W * 0.2); g.stroke();
  for (let i = 0; i < 26; i++) { const t = r(); const bx = W * (0.5 + (r() - 0.5) * 0.12), by = W * (0.92 - t * 0.7); const a = (r() - 0.5) * 2.6 - Math.PI / 2; const s = W * (0.075 + r() * 0.05);
    const lx = bx + Math.cos(a) * s * 1.4, ly = by + Math.sin(a) * s * 1.4; if (lx < s || lx > W - s || ly < s * 1.2 || ly > W - s) continue;
    const col = new THREE.Color(pal[Math.floor(r() * pal.length)]).offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.12);
    g.strokeStyle = '#6a5636'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, by); g.lineTo(lx, ly); g.stroke();
    g.save(); g.translate(lx, ly); g.rotate(a + Math.PI / 2 + (r() - 0.5) * 0.5);
    const grd = g.createLinearGradient(-s, 0, s, 0); const d = col.clone().multiplyScalar(0.78);
    grd.addColorStop(0, '#' + d.getHexString()); grd.addColorStop(0.5, '#' + col.getHexString()); grd.addColorStop(1, '#' + d.getHexString());
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, -s * 1.15); g.quadraticCurveTo(s * 0.95, -s * 0.1, s * 0.8, s * 0.55); g.quadraticCurveTo(0, s * 0.85, -s * 0.8, s * 0.55); g.quadraticCurveTo(-s * 0.95, -s * 0.1, 0, -s * 1.15); g.fill();
    g.strokeStyle = 'rgba(255,250,210,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, s * 0.6); g.lineTo(0, -s); g.stroke(); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function makeBigCottonwood2(T, { season = 'fall', snowy = false, seed = 3, lite = false, tier = 2 } = {}) {
  const r = rng(seed + 900); const g = new THREE.Group(); g.name = 'big-cottonwood'; const O = new THREE.Vector3(T.x, T.y - 0.05, T.z);
  const RAD = lite ? 10 : 14; const geos = []; const tips = []; // tips: [pos, size]
  // trunk: gentle lean + radiusAt profile (flare included), deep lumpy furrows
  { const pts = []; for (let i = 0; i <= 8; i++) { const hh = -0.25 + (T.h + 0.6) * (i / 8); pts.push(new THREE.Vector3(Math.sin(hh * 0.5) * 0.06, hh, Math.cos(hh * 0.4) * 0.05 - 0.05)); }
    const cv = new THREE.CatmullRomCurve3(pts); const H = T.h + 0.85;
    geos.push(tube(cv, 1, 1, lite ? 18 : 28, lite ? 14 : 22, { lump: 0.05, seed: 1, flare: (t) => T.radiusAt(Math.max(0, -0.25 + t * H)) * 1.02 * (1 - 0.6 * THREE.MathUtils.smoothstep(t, 0.82, 1)) })); }
  // root buttresses: curved, sinking into the ground
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + 0.4 + (r() - 0.5) * 0.3; const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); const L = 1.4 + r() * 0.8;
    const cv = new THREE.CatmullRomCurve3([d.clone().multiplyScalar(0.3).setY(1.1), d.clone().multiplyScalar(T.trunkR * 0.95).setY(0.45), d.clone().multiplyScalar(T.trunkR + L * 0.55).setY(0.08), d.clone().multiplyScalar(T.trunkR + L).setY(-0.25)]);
    geos.push(tube(cv, 0.46, 0.07, lite ? 7 : 9, lite ? 6 : 9, { lump: 0.06, seed: i })); }
  // a branch with children: straight first `str` metres along dir, then bends toward `bend`
  const branch = (start, dir, len, r0, r1, depth, str = 0) => {
    const pts = [start.clone().addScaledVector(dir, depth === 0 ? -0.5 : -r0 * 0.6)]; const n = 5; const d = dir.clone(); const p = start.clone(); pts.push(p.clone());
    for (let i = 1; i <= n; i++) { const seg = len / n; const along = i * seg; if (along > str) { d.lerp(UP, 0.18).add(new THREE.Vector3((r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25)).normalize(); } p.addScaledVector(d, seg); pts.push(p.clone()); }
    const cv = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); const rs = Math.max(4, Math.round(RAD * Math.min(1, r0 * 3)));
    const CL = cv.getLength(); const c0 = depth === 0 ? [0.5, 1.5, 0.7] : [0, r0 * 4, 0.35]; // branch collar where it leaves the trunk / parent
    geos.push(tube(cv, r0, r1, rs, Math.max(4, Math.round(len * (lite ? 2 : 3))), { lump: depth === 0 ? 0.04 : 0, seed: r() * 9, flare: (t, rr) => rr * (1 + c0[2] * (1 - THREE.MathUtils.smoothstep(t * CL, c0[0], c0[1]))) }));
    if (depth >= 2 || (lite && depth >= 1 && r() < 0.35)) { tips.push([p.clone(), 0.85 + r() * 0.35]); const m = cv.getPointAt(0.55); tips.push([m, 0.6 + r() * 0.3]); return; }
    const kids = depth === 0 ? 3 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2);
    for (let k = 0; k < kids; k++) { const t = depth === 0 ? Math.max(str / len + 0.05, 0.45) + (k / kids) * (0.95 - Math.max(str / len + 0.05, 0.45)) : 0.4 + r() * 0.55;
      const sp = cv.getPointAt(Math.min(0.98, t)); const tg = cv.getTangentAt(Math.min(0.98, t)); const side = new THREE.Vector3().crossVectors(tg, UP).normalize(); if (side.lengthSq() < 0.01) side.set(1, 0, 0);
      const cd = tg.clone().addScaledVector(side, (k % 2 ? 1 : -1) * (0.6 + r() * 0.5)).addScaledVector(UP, 0.35 + r() * 0.4).normalize();
      const rr = r0 + (r1 - r0) * t; branch(sp, cd, len * (depth === 0 ? 0.55 : 0.6) * (0.8 + r() * 0.4), rr * 0.7, rr * 0.25, depth + 1); }
    tips.push([p.clone(), 1.0 + r() * 0.3]);
  };
  // scaffold limbs at the attachment anchors
  T.limbs.forEach((a, i) => { const st = T.limbStart(a, i).sub(O); branch(st, T.limbDir(a), 4.4 + (i % 2) * 0.6, 0.27, 0.08, 0, 2.7); });
  // leaders out of the top of the trunk, between the limbs
  for (let i = 0; i < (lite ? 3 : 4); i++) { const a = i / 4 * 6.283 + 0.6 + (r() - 0.5) * 0.4; const d = new THREE.Vector3(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55).normalize();
    branch(new THREE.Vector3(Math.cos(a) * 0.2, T.h - 0.4, Math.sin(a) * 0.2), d, 3.2 + r() * 0.8, 0.3, 0.07, 0, 0.6); }
  const barkGeo = mergeGeometries(geos.map((x) => x.index ? x : x)); geos.forEach((x) => x.dispose());
  const painted = barkTex('cotton').clone(); painted.userData = {}; painted.needsUpdate = true; // no `kind`, so pbr.js leaves this one alone
  const bm = new THREE.MeshStandardMaterial({ map: painted, color: 0xd8d2c8, roughness: 0.93 });
  if (tier >= 1) { const sz = tier >= 2 ? 1024 : 512; const aniso = tier >= 2 ? 8 : 4; const base = (import.meta.env?.BASE_URL || './') + 'tex/';
    loader.load(`${base}bark_c_${sz}.webp`, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; bm.map = t; bm.color.set(0xd2cabe); bm.needsUpdate = true; });
    loader.load(`${base}bark_n_${sz}.webp`, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; bm.normalMap = t; bm.normalScale.set(1.4, 1.4); bm.needsUpdate = true; }); }
  const bark = new THREE.Mesh(barkGeo, bm); bark.castShadow = true; bark.receiveShadow = true; g.add(bark);

  const bare = season === 'winter';
  const canopy = new THREE.Group(); canopy.position.y = T.h; g.add(canopy);
  if (!bare) { // leaf sprays: crossed cards around every tip, normals pushed out from the crown centre, darker inside
    const ctr = new THREE.Vector3(); tips.forEach(([p]) => ctr.add(p)); ctr.divideScalar(tips.length); ctr.y += 0.4; let rMax = 0; tips.forEach(([p]) => { rMax = Math.max(rMax, p.distanceTo(ctr)); });
    const per = lite ? 11 : 20; const quad = new THREE.PlaneGeometry(1, 1).toNonIndexed(); quad.deleteAttribute('normal');
    const pos = [], nor = [], uv = [], col = []; const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), V = new THREE.Vector3(), N = new THREE.Vector3();
    const cA = new THREE.Color(), snowC = new THREE.Color(0xeef2f6);
    for (const [tp, sz] of tips) for (let k = 0; k < per; k++) {
      const off = new THREE.Vector3(r() - 0.5, (r() - 0.35) * 0.8, r() - 0.5).normalize().multiplyScalar(r() * 0.75 * sz); const p = tp.clone().add(off).sub(new THREE.Vector3(0, T.h, 0));
      const out = p.clone().add(new THREE.Vector3(0, T.h, 0)).sub(ctr); const depth = Math.min(1, out.length() / (rMax + 0.5)); out.normalize();
      const s = (0.45 + r() * 0.3) * sz; E.set(-0.4 + (r() - 0.5) * 1.2, Math.atan2(out.x, out.z) + (r() - 0.5) * 1.6, (r() - 0.5) * 0.8, 'YXZ'); Q.setFromEuler(E); M.compose(p, Q, S.set(s, s, s));
      const sh = 0.55 + 0.5 * depth; cA.setScalar(sh); if (snowy) cA.lerp(snowC, 0.35);
      N.copy(out).lerp(UP, 0.3).normalize();
      const pa = quad.attributes.position, ua = quad.attributes.uv; for (let v = 0; v < pa.count; v++) { V.fromBufferAttribute(pa, v).applyMatrix4(M); pos.push(V.x, V.y, V.z); nor.push(N.x, N.y, N.z); uv.push(ua.getX(v), ua.getY(v)); col.push(cA.r, cA.g, cA.b); } }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    lg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); lg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); lg.computeBoundingSphere();
    const lm = new THREE.MeshStandardMaterial({ map: leafTex(season), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75, emissive: season === 'fall' ? 0x3a2808 : 0x0e1a06, emissiveIntensity: 0.6, userData: { foliage: true } });
    const leaves = new THREE.Mesh(lg, lm); leaves.castShadow = true; leaves.receiveShadow = true; canopy.add(leaves); g.userData.leafCards = pos.length / 18; }
  g.userData.tips = tips.length;
  const ph = r() * 6; g.userData.sway = (t) => { const w = 0.3 + ENV.uWind.value * 2; canopy.rotation.z = Math.sin(t * 1.05 + ph) * 0.012 * w; canopy.rotation.x = Math.sin(t * 0.8 + ph * 2) * 0.009 * w; };
  return g;
}
