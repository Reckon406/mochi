// Weather from the STATE.weather string, plus clouds, falling leaves, fireflies
import * as THREE from 'three';
import { rng } from './noise.js';
import { ENV } from './water.js';
import { cloudSprite } from './textures.js';

export function parseWeather(str = '') {
  const s = str.toLowerCase();
  const heavy = /heavy|storm/.test(s);
  const w = {
    raw: str,
    snow: /snow|flurr|blizzard/.test(s),
    rain: /rain|shower|drizzl|sleet|thunder/.test(s),
    cloud: /cloud|overcast|grey|gray/.test(s),
    fog: /fog|mist|haze|smok/.test(s),
    wind: /wind|gust|breez|blizzard/.test(s),
    heavy, thunder: /thunder|storm/.test(s),
    partly: /partly|scattered|few/.test(s),
  };
  w.intensity = heavy ? 1.8 : 1;
  w.cloudiness = w.cloud ? (w.partly ? 0.35 : /overcast/.test(s) ? 0.9 : 0.6) : (w.rain || w.snow ? 0.75 : 0.15);
  if (w.rain || w.snow) w.cloudiness = Math.max(w.cloudiness, 0.7);
  if (heavy) w.cloudiness = Math.min(1, w.cloudiness + 0.25);
  w.windAmt = (w.wind ? 0.6 : 0.12) * (heavy ? 1.6 : 1);
  const t = s.match(/(-?\d+)\s*°?\s*f/); w.tempF = t ? parseInt(t[1]) : null;
  return w;
}

export function createWeather(scene, w, { mobile = false } = {}) {
  const group = new THREE.Group(); scene.add(group);
  const r = rng(99);
  // ── puffy clouds (some below the island for the floating feel) ──
  const clouds = [];
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.18, transparent: true, opacity: 0.96 });
  const nC = Math.round(8 + w.cloudiness * 22);
  for (let i = 0; i < nC; i++) {
    const g = new THREE.Group(); const below = false;
    const a = r() * 6.28, rr = 90 + r() * 260; g.position.set(Math.cos(a) * rr, 48 + r() * 50 + rr * 0.08, Math.sin(a) * rr);
    const sc = 6 + r() * 9; const n = 7 + Math.floor(r() * 6);
    for (let k = 0; k < n; k++) { const u = k / (n - 1) - 0.5; const s = (0.45 + (1 - Math.abs(u) * 1.6) * 0.6 + r() * 0.25) * sc; const p = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 3), cm); p.position.set(u * n * sc * 0.55 + r() * sc * 0.3, (1 - Math.abs(u) * 2) * sc * 0.35 + r() * sc * 0.2, (r() - 0.5) * sc * 0.9); p.scale.y = 0.62; g.add(p); }
    g.userData = { a, rr, y: g.position.y, sp: (0.004 + r() * 0.006) * (0.5 + w.windAmt * 2) * (r() < 0.5 ? 1 : 1), below };
    group.add(g); clouds.push(g);
  }
  // ── precipitation ──
  let snow = null, rain = null;
  const AREA = 46, TOP = 26;
  if (w.snow) {
    const N = Math.round((mobile ? 1800 : 3500) * w.intensity); const pos = new Float32Array(N * 3); const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos.set([(r() - 0.5) * AREA, r() * TOP - 6, (r() - 0.5) * AREA], i * 3); seed[i] = r(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.PointsMaterial({ size: 0.16, map: cloudSprite(), transparent: true, depthWrite: false, color: 0xffffff, opacity: 0.95 });
    snow = new THREE.Points(g, mat); snow.frustumCulled = false; group.add(snow);
  }
  if (w.rain) {
    const N = Math.round((mobile ? 1400 : 2600) * w.intensity); const pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = (r() - 0.5) * AREA, y = r() * TOP - 6, z = (r() - 0.5) * AREA; pos.set([x, y, z, x, y - 0.5, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaac4dd, transparent: true, opacity: 0.55 })); rain.frustumCulled = false; group.add(rain);
  }
  // ── autumn leaves drifting in the wind (skip when snowing) ──
  let leaves = null;
  if (!w.snow) {
    const N = 60; const ls = new THREE.Shape(); ls.moveTo(0, -0.07); ls.quadraticCurveTo(0.06, -0.01, 0, 0.07); ls.quadraticCurveTo(-0.06, -0.01, 0, -0.07); const geo = new THREE.ShapeGeometry(ls, 6); const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 });
    leaves = new THREE.InstancedMesh(geo, mat, N); const c = new THREE.Color(); const cols = [0xe58a2f, 0xf0b53a, 0xd4652c];
    leaves.userData.p = []; for (let i = 0; i < N; i++) { leaves.setColorAt(i, c.set(cols[i % 3])); leaves.userData.p.push({ x: (r() - 0.5) * 30, y: r() * 8, z: (r() - 0.5) * 30, ph: r() * 6, s: 0.5 + r() }); }
    group.add(leaves);
  }
  // ── fireflies at night ──
  const FF = 50; const fp = new Float32Array(FF * 3); const ffBase = [];
  for (let i = 0; i < FF; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * 12; ffBase.push([Math.cos(a) * rr, 0.4 + r() * 1.6, Math.sin(a) * rr, r() * 6]); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const ffMat = new THREE.PointsMaterial({ size: 0.18, map: cloudSprite(), color: new THREE.Color(3, 2.6, 0.9), transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending });
  const fireflies = new THREE.Points(fg, ffMat); fireflies.frustumCulled = false; group.add(fireflies);

  ENV.uWind.value = w.windAmt;
  let flash = 0, nextBolt = 6 + Math.random() * 10;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s3 = new THREE.Vector3();
  function update(t, dt, night, sun, hemi) {
    const wind = w.windAmt;
    for (const c of clouds) { const u = c.userData; u.a += u.sp * dt; c.position.x = Math.cos(u.a) * u.rr; c.position.z = Math.sin(u.a) * u.rr; c.position.y = u.y + Math.sin(t * 0.2 + u.rr) * 0.4; }
    cm.color.setScalar(1 - night * 0.6 - (w.cloudiness > 0.7 ? 0.25 : 0)); cm.emissive.setRGB(1 - night * 0.45, 1 - night * 0.35, 1); cm.emissiveIntensity = 0.18 * (1 - night) + 0.06 * night;
    if (snow) { const p = snow.geometry.attributes.position, sd = snow.geometry.attributes.seed; const fall = 1.1 * (w.heavy ? 1.6 : 1);
      for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * fall * (0.6 + sd.getX(i) * 0.6); let x = p.getX(i) + Math.sin(t * 1.3 + sd.getX(i) * 20) * dt * 0.3 + wind * dt * 2.5; if (y < -6) { y = TOP - 6; } if (x > AREA / 2) x -= AREA; p.setXY(i, x, y); }
      p.needsUpdate = true; }
    if (rain) { const p = rain.geometry.attributes.position; const fall = 18 * (w.heavy ? 1.3 : 1); const slant = wind * 4;
      for (let i = 0; i < p.count; i += 2) { let y = p.getY(i) - dt * fall; let x = p.getX(i) + dt * slant; if (y < -6) { y = TOP - 6; x = (Math.random() - 0.5) * AREA; } if (x > AREA / 2) x -= AREA; p.setXYZ(i, x, y, p.getZ(i)); p.setXYZ(i + 1, x - slant * 0.03, y - 0.55, p.getZ(i)); }
      p.needsUpdate = true; }
    if (leaves) { const P = leaves.userData.p; for (let i = 0; i < P.length; i++) { const L = P[i]; L.y -= dt * 0.35 * L.s; L.x += dt * (0.4 + wind * 3) ; L.z += Math.sin(t + L.ph) * dt * 0.3; if (L.y < -1 || L.x > 18) { L.y = 6 + Math.random() * 4; L.x = -18 + Math.random() * 6; L.z = (Math.random() - 0.5) * 30; }
      v.set(L.x, L.y, L.z); e.set(t * 2 + L.ph, t * 1.3 + L.ph, t * 0.7); q.setFromEuler(e); s3.setScalar(1); m4.compose(v, q, s3); leaves.setMatrixAt(i, m4); } leaves.instanceMatrix.needsUpdate = true; }
    // fireflies
    ffMat.opacity = night * (w.rain || w.snow ? 0.2 : 1);
    if (night > 0.05) { const p = fg.attributes.position; ffBase.forEach(([x, y, z, ph], i) => p.setXYZ(i, x + Math.sin(t * 0.5 + ph) * 0.8, y + Math.sin(t * 1.1 + ph * 2) * 0.3 * (0.5 + 0.5 * Math.sin(t * 3 + ph)), z + Math.cos(t * 0.4 + ph) * 0.8)); p.needsUpdate = true; }
    // thunder flashes
    if (w.thunder) { nextBolt -= dt; if (nextBolt < 0) { flash = 1; nextBolt = 5 + Math.random() * 12; } if (flash > 0) { flash -= dt * 3; hemi.intensity += Math.max(0, flash) * 4 * (Math.sin(t * 60) > 0 ? 1 : 0.3); } }
  }
  return { group, update, clouds };
}
