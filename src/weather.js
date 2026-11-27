// Weather from the STATE.weather string, plus clouds + falling leaves
import * as THREE from 'three';
import { rng, fbm, ridged, smoothstep } from './noise.js';
import { ENV } from './water.js';
import { cloudSprite } from './textures.js';

// Soft wispy alpha map (generated once): irregular edges, holes, no hard disc.
let _cloudTex = null;
function wispyCloudTex() {
  if (_cloudTex) return _cloudTex;
  const s = 256, data = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const u = (x + 0.5) / s, v = (y + 0.5) / s;
    const dx = u - 0.5, dy = v - 0.5;
    const rr = Math.sqrt(dx * dx + dy * dy) * 2;
    // long, streaky wisps — avoid closed “cotton stamp” blobs
    const n = 0.5 + 0.5 * fbm(u * 2.1 + 2.1, v * 9.5 - 1.3, 5);
    const n2 = 0.5 + 0.5 * fbm(u * 5.8 + 9.0, v * 16.0 - 4.0, 3);
    let d = Math.pow(Math.max(0, n), 1.35) * (0.55 + 0.45 * n2);
    d *= smoothstep(1.08, 0.22, rr);
    d = Math.max(0, Math.min(1, d));
    const i = (y * s + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(d * 255);
  }
  const t = new THREE.DataTexture(data, s, s, THREE.RGBAFormat);
  t.needsUpdate = true; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 2;
  return (_cloudTex = t);
}

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

export function createWeather(scene, w, opts = {}) { const { mobile = false, tier = 2, season = 'fall' } = opts;
  const group = new THREE.Group(); scene.add(group);
  const r = rng(99);
  ENV.uWet.value = w.rain ? 0.85 : 0;
  ENV.uSnowCover.value = w.snow ? 0.85 : (season === 'winter' ? 0.55 : 0);
  // ── wispy cloud cards (billboarded): translucent, darker cores, silver lining toward the sun/moon ──
  const clouds = [];
  const CU = { uMap: { value: wispyCloudTex() }, uSunDir: ENV.uSunDir, uSunColor: ENV.uSunColor, uMoonDir: ENV.uMoonDir, uNight: ENV.uNight };
  const cm = new THREE.ShaderMaterial({ uniforms: CU, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uSunDir, uSunColor, uMoonDir; uniform float uNight;
      varying vec2 vUv; varying vec3 vW;
      void main(){
        vec2 uv = vUv + vec2(sin(vUv.y * 6.283 + vW.x * 0.02) * 0.025, cos(vUv.x * 6.283 + vW.z * 0.02) * 0.02);
        float dens = texture2D(uMap, uv).a;
        if (dens < 0.02) discard;
        vec3 V = normalize(cameraPosition - vW);
        vec3 L = normalize(mix(uSunDir, uMoonDir, uNight));
        float fwd = pow(max(dot(-V, L), 0.0), 6.0); // looking toward the light: forward scatter / silver lining
        float thin = 1.0 - dens;
        float a = mix(dens * 0.72, pow(dens, 1.35) * 0.18, uNight); // night: stars show through
        // cores stay darker; thin parts transmit and glow
        vec3 dayCore = vec3(0.62, 0.65, 0.70); vec3 dayThin = vec3(0.96, 0.97, 0.99);
        vec3 nightCore = vec3(0.055, 0.07, 0.12); vec3 nightThin = vec3(0.14, 0.18, 0.28);
        vec3 base = mix(mix(dayCore, dayThin, thin), mix(nightCore, nightThin, thin), uNight);
        vec3 lcol = mix(uSunColor, vec3(0.68, 0.76, 1.0), uNight);
        base += lcol * thin * mix(0.22 + 0.55 * fwd, 0.1 + 0.4 * fwd, uNight);
        base += lcol * fwd * thin * mix(0.85, 0.55, uNight);
        gl_FragColor = vec4(base, a);
      }` });
  const cgeo = new THREE.PlaneGeometry(1, 1);
  const nC = Math.round(8 + w.cloudiness * 22);
  for (let i = 0; i < nC; i++) {
    const g = new THREE.Group(); const below = false;
    const a = r() * 6.28, rr = 90 + r() * 260; g.position.set(Math.cos(a) * rr, 48 + r() * 50 + rr * 0.08, Math.sin(a) * rr);
    const sc = 26 + r() * 30; const n = 4 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const p = new THREE.Mesh(cgeo, cm);
      const cw = sc * (0.7 + r() * 0.45), ch = cw * (0.26 + r() * 0.18);
      p.scale.set(cw, ch, 1);
      p.position.set((r() - 0.5) * sc * 0.22, (r() - 0.5) * sc * 0.05, (k - (n - 1) / 2) * 1.2);
      p.rotation.z = (r() - 0.5) * 0.28; p.renderOrder = 2; p.frustumCulled = false; g.add(p);
    }
    g.userData = { a, rr, y: g.position.y, sp: (0.004 + r() * 0.006) * (0.5 + w.windAmt * 2) * (r() < 0.5 ? 1 : 1), below };
    group.add(g); clouds.push(g);
  }
  // ── cheap light shafts through gaps (Medium+): soft additive planes along the sun/moon ──
  let shafts = null;
  if (tier >= 1) {
    const SU = { uA: { value: 0 }, uCol: { value: new THREE.Color(1, 0.92, 0.75) } };
    const sm = new THREE.ShaderMaterial({ uniforms: SU, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uA; uniform vec3 uCol; varying vec2 vUv;
        void main(){ float beam = sin(vUv.x * 3.14159); beam *= beam * beam; float fade = smoothstep(0.0, 0.12, vUv.y) * (1.0 - vUv.y);
          float a = uA * beam * fade; gl_FragColor = vec4(uCol * a, a); }` });
    shafts = new THREE.Group(); group.add(shafts);
    const sgeo = new THREE.PlaneGeometry(7, 140);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(sgeo, sm); m.frustumCulled = false; m.renderOrder = 1; m.userData.ang = (i / 4) * 6.283 + r() * 0.4; shafts.add(m);
    }
    shafts.userData.U = SU;
  }
  // ── morning / fog valley haze (soft cards over the river; Medium+) ──
  let haze = null;
  if (tier >= 1 || w.fog) {
    const HU = { uA: { value: 0 }, uT: { value: 0 } };
    haze = new THREE.Group(); group.add(haze);
    const hm = new THREE.ShaderMaterial({ uniforms: HU, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: `uniform float uA; uniform float uT; varying vec2 vUv; varying vec3 vW;
        float hn(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hn(i),hn(i+vec2(1,0)),f.x), mix(hn(i+vec2(0,1)),hn(i+vec2(1,1)),f.x), f.y); }
        void main(){ float n = vn(vW.xz * 0.015 + vec2(uT * 0.01, 0.0)) * 0.7 + vn(vW.xz * 0.04 + 3.0) * 0.3;
          float edge = sin(vUv.x * 3.14159) * sin(vUv.y * 3.14159);
          float a = uA * edge * (0.35 + 0.65 * n) * 0.55;
          gl_FragColor = vec4(vec3(0.86, 0.90, 0.94), clamp(a, 0.0, 0.55)); }` });
    for (const [z, y, w0, d0] of [[-20, 2.2, 220, 50], [40, 2.8, 200, 55], [-80, 2.0, 180, 45]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w0, d0), hm); m.rotation.x = -Math.PI / 2; m.position.set(0, y, z); m.renderOrder = 4; m.frustumCulled = false; haze.add(m);
    }
    haze.userData.U = HU;
  }
  // ── precipitation ──
  let snow = null, rain = null;
  const AREA = 76, TOP = 26;
  if (w.snow) {
    const N = Math.round((mobile ? 3000 : 6500) * w.intensity * (opts.particles ?? 1)); const pos = new Float32Array(N * 3); const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos.set([(r() - 0.5) * AREA, r() * TOP - 6, (r() - 0.5) * AREA], i * 3); seed[i] = r(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.PointsMaterial({ size: 0.16, map: cloudSprite(), transparent: true, depthWrite: false, color: 0xffffff, opacity: 0.95 });
    snow = new THREE.Points(g, mat); snow.frustumCulled = false; group.add(snow);
  }
  if (w.rain) {
    const N = Math.round((mobile ? 2400 : 4800) * w.intensity * (opts.particles ?? 1)); const pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = (r() - 0.5) * AREA, y = r() * TOP - 6, z = (r() - 0.5) * AREA; pos.set([x, y, z, x, y - 0.5, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaac4dd, transparent: true, opacity: 0.55 })); rain.frustumCulled = false; group.add(rain);
  }
  // ── autumn leaves drifting in the wind (skip when snowing) ──
  let leaves = null;
  if (!w.snow && (opts.season ?? 'fall') === 'fall') {
    const N = 60; const ls = new THREE.Shape(); ls.moveTo(0, -0.07); ls.quadraticCurveTo(0.06, -0.01, 0, 0.07); ls.quadraticCurveTo(-0.06, -0.01, 0, -0.07); const geo = new THREE.ShapeGeometry(ls, 6); const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 });
    leaves = new THREE.InstancedMesh(geo, mat, N); const c = new THREE.Color(); const cols = [0xe58a2f, 0xf0b53a, 0xd4652c];
    leaves.userData.p = []; for (let i = 0; i < N; i++) { leaves.setColorAt(i, c.set(cols[i % 3])); leaves.userData.p.push({ x: (r() - 0.5) * 50, y: r() * 8, z: (r() - 0.5) * 50, ph: r() * 6, s: 0.5 + r() }); }
    group.add(leaves);
  }
  // (no fireflies: western Montana doesn't have them. night critters live in critters.js)
  ENV.uWind.value = w.windAmt;
  let flash = 0, nextBolt = 6 + Math.random() * 10;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s3 = new THREE.Vector3();
  const _shaftY = new THREE.Vector3(0, 1, 0), _shaftL = new THREE.Vector3();
  function update(t, dt, night, sun, hemi, camera) {
    const wind = w.windAmt;
    for (const c of clouds) { const u = c.userData; u.a += u.sp * dt; c.position.x = Math.cos(u.a) * u.rr; c.position.z = Math.sin(u.a) * u.rr; c.position.y = u.y + Math.sin(t * 0.2 + u.rr) * 0.4; if (camera) c.lookAt(camera.position); }
    if (shafts) {
      const lit = night > 0.45; _shaftL.copy(lit ? ENV.uMoonDir.value : ENV.uSunDir.value).normalize();
      const up = _shaftL.y; const show = up > 0.02 ? (1 - Math.max(0, (up - 0.08) / 0.75)) * (w.cloudiness > 0.85 ? 0.3 : 1) : 0;
      const a = show * (lit ? 0.1 : 0.14); shafts.visible = a > 0.012; shafts.userData.U.uA.value = a;
      if (lit) shafts.userData.U.uCol.value.setRGB(0.55, 0.65, 0.95); else shafts.userData.U.uCol.value.copy(ENV.uSunColor.value);
      if (shafts.visible) for (const m of shafts.children) { const ang = m.userData.ang; m.position.set(Math.cos(ang) * 80, 70, Math.sin(ang) * 80); m.quaternion.setFromUnitVectors(_shaftY, _shaftL); }
    }
    if (snow) { const p = snow.geometry.attributes.position, sd = snow.geometry.attributes.seed; const fall = 1.1 * (w.heavy ? 1.6 : 1);
      for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * fall * (0.6 + sd.getX(i) * 0.6); let x = p.getX(i) + Math.sin(t * 1.3 + sd.getX(i) * 20) * dt * 0.3 + wind * dt * 2.5; if (y < -6) { y = TOP - 6; } if (x > AREA / 2) x -= AREA; p.setXY(i, x, y); }
      p.needsUpdate = true; }
    if (rain) { const p = rain.geometry.attributes.position; const fall = 18 * (w.heavy ? 1.3 : 1); const slant = wind * 4;
      for (let i = 0; i < p.count; i += 2) { let y = p.getY(i) - dt * fall; let x = p.getX(i) + dt * slant; if (y < -6) { y = TOP - 6; x = (Math.random() - 0.5) * AREA; } if (x > AREA / 2) x -= AREA; p.setXYZ(i, x, y, p.getZ(i)); p.setXYZ(i + 1, x - slant * 0.03, y - 0.55, p.getZ(i)); }
      p.needsUpdate = true; }
    if (leaves) { const P = leaves.userData.p; for (let i = 0; i < P.length; i++) { const L = P[i]; L.y -= dt * 0.35 * L.s; L.x += dt * (0.4 + wind * 3) ; L.z += Math.sin(t + L.ph) * dt * 0.3; if (L.y < -1 || L.x > 28) { L.y = 6 + Math.random() * 4; L.x = -28 + Math.random() * 6; L.z = (Math.random() - 0.5) * 30; }
      v.set(L.x, L.y, L.z); e.set(t * 2 + L.ph, t * 1.3 + L.ph, t * 0.7); q.setFromEuler(e); s3.setScalar(1); m4.compose(v, q, s3); leaves.setMatrixAt(i, m4); } leaves.instanceMatrix.needsUpdate = true; }
    // rain soaks the ground, snow settles; both dry/melt when the weather clears (winter keeps a base cover)
    if (w.rain) ENV.uWet.value = Math.min(1, ENV.uWet.value + dt * 0.05);
    else ENV.uWet.value = Math.max(0, ENV.uWet.value - dt * 0.04);
    if (w.snow) ENV.uSnowCover.value = Math.min(1, ENV.uSnowCover.value + dt * 0.04);
    else if (season !== 'winter') ENV.uSnowCover.value = Math.max(0, ENV.uSnowCover.value - dt * 0.025);
    if (haze) { const a = Math.max(ENV.uDawnFog.value * 0.85, w.fog ? (w.heavy ? 0.7 : 0.45) : 0); haze.userData.U.uA.value = a; haze.userData.U.uT.value = t; haze.visible = a > 0.02; }
    // thunder flashes
    if (w.thunder) { nextBolt -= dt; if (nextBolt < 0) { flash = 1; nextBolt = 5 + Math.random() * 12; } if (flash > 0) { flash -= dt * 3; hemi.intensity += Math.max(0, flash) * 4 * (Math.sin(t * 60) > 0 ? 1 : 0.3); } }
  }
  return { group, update, clouds };
}
