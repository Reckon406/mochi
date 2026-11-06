// Stylised gradient sky + sun/moon discs + stars + time-of-day lighting
import * as THREE from 'three';
import { ENV } from './water.js';
import { clamp, smoothstep, lerp, rng } from './noise.js';

const DARBY = { lat: 46.0216, lon: -114.1787 };

// Viewer's local wall-clock time, replayed in Darby (so morning for you = morning on the island)
export function darbyInstant(hourOverride = null) {
  const now = new Date();
  let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  if (hourOverride != null && !isNaN(hourOverride)) { h = Math.floor(hourOverride); m = Math.round((hourOverride - h) * 60); s = 0; }
  const month = now.getMonth(); // rough US DST: mid-Mar..early-Nov
  const dst = month > 2 && month < 10 || (month === 10 && now.getDate() < 1);
  const off = dst ? 6 : 7;
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), h + off, m, s));
}

export function sunPosition(date, lat = DARBY.lat, lon = DARBY.lon) {
  const rad = Math.PI / 180;
  const d = date.getTime() / 86400000 - 10957.5;
  const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  const ha = (gmst * 15 + lon) * rad - ra, la = lat * rad;
  const alt = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha)); // from north, clockwise
  return { alt, az };
}
// az from north clockwise -> world dir (north = -z, east = +x)
export function dirFromAltAz(alt, az) { return new THREE.Vector3(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt)); }

const skyVert = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p; }`;
const skyFrag = `
uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunColor, uMoonDir; uniform float uNight, uCloudy;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.55));
  col = mix(col, uGround, smoothstep(0.0, -0.25, y));
  float sd = max(dot(d, uSunDir), 0.0);
  float glow = pow(sd, 6.0) * 0.55 + pow(sd, 40.0) * 0.6;
  col += uSunColor * glow * (1.0 - uCloudy * 0.6);
  float disc = smoothstep(0.9993, 0.9997, sd);
  col += uSunColor * disc * 14.0 * (1.0 - uCloudy * 0.85);
  // horizon warm haze band
  col += uSunColor * 0.12 * exp(-abs(y) * 9.0) * (1.0 - uNight);
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.95, 0.95, 1.0) * smoothstep(0.99955, 0.99975, md) * 3.0 * uNight;
  col += vec3(0.4, 0.5, 0.8) * pow(md, 60.0) * 0.25 * uNight;
  gl_FragColor = vec4(col, 1.0);
}`;

const KEYS = [ // alt in degrees -> zenith, horizon, sun color, sun intensity, hemi sky, hemi ground, hemi intensity, fog
  { a: -18, zen: 0x050a1c, hor: 0x121a36, sun: 0x000000, si: 0, hs: 0x2a3a6a, hg: 0x0e1018, hi: 0.35, fog: 0x0f1630 },
  { a: -6, zen: 0x101d45, hor: 0x3b3a66, sun: 0x000000, si: 0, hs: 0x37457a, hg: 0x141620, hi: 0.4, fog: 0x2a2f55 },
  { a: -1.5, zen: 0x24407a, hor: 0xe8865a, sun: 0xff6a3a, si: 0.2, hs: 0x6b6aa0, hg: 0x2a2030, hi: 0.5, fog: 0x8a6a78 },
  { a: 4, zen: 0x4a78c0, hor: 0xffbf85, sun: 0xffa860, si: 2.8, hs: 0xc0b8d8, hg: 0x6a4a30, hi: 0.95, fog: 0xeab98e },
  { a: 12, zen: 0x3c7fd0, hor: 0xffe0b8, sun: 0xffd2a0, si: 3.0, hs: 0xb8d2f2, hg: 0x6a5a3a, hi: 0.95, fog: 0xd8dcd8 },
  { a: 30, zen: 0x3a84d8, hor: 0xcfe6f6, sun: 0xfff1de, si: 3.0, hs: 0xc4def8, hg: 0x6b5f40, hi: 1.0, fog: 0xc6dcec },
  { a: 90, zen: 0x2f78d0, hor: 0xc0def4, sun: 0xffffff, si: 3.2, hs: 0xc8e2fa, hg: 0x6b5f40, hi: 1.0, fog: 0xc0daf0 },
];
function sample(altDeg) {
  let i = 0; while (i < KEYS.length - 2 && altDeg > KEYS[i + 1].a) i++;
  const A = KEYS[i], B = KEYS[i + 1]; const t = clamp((altDeg - A.a) / (B.a - A.a), 0, 1);
  const c = (k) => new THREE.Color(A[k]).lerp(new THREE.Color(B[k]), t);
  return { zen: c('zen'), hor: c('hor'), sun: c('sun'), si: lerp(A.si, B.si, t), hs: c('hs'), hg: c('hg'), hi: lerp(A.hi, B.hi, t), fog: c('fog') };
}

export function createSky(scene, { hour = null, cloudy = 0, storm = 0 } = {}) {
  const uniforms = {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color(0x40485a) },
    uSunDir: ENV.uSunDir, uSunColor: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3() }, uNight: ENV.uNight, uCloudy: { value: cloudy },
  };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), new THREE.ShaderMaterial({ uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false }));
  dome.renderOrder = -1; dome.frustumCulled = false; scene.add(dome);

  // stars
  const r = rng(77); const N = 1800; const sp = new Float32Array(N * 3); const sc = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = r() * 2 - 1, th = r() * 6.283; const y = Math.abs(u) * 0.95 + 0.03; const rr = Math.sqrt(1 - y * y);
    sp.set([Math.cos(th) * rr * 3500, y * 3500, Math.sin(th) * rr * 3500], i * 3);
    const b = 0.5 + r() * 1.8; const warm = r(); sc.set([b * (warm > 0.8 ? 1.2 : 0.9), b * 0.95, b * (warm < 0.3 ? 1.3 : 1.0)], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const starMat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(sg, starMat); stars.frustumCulled = false; scene.add(stars);

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  const hemi = new THREE.HemisphereLight(0xc4def8, 0x6b5f40, 1.0);
  scene.add(sun, sun.target, hemi);

  const state = { night: 0, golden: 0, alt: 0, sunDir: new THREE.Vector3(), fogColor: new THREE.Color(), dayLight: 1 };
  function update(time) {
    const date = darbyInstant(hour);
    const { alt, az } = sunPosition(date);
    const altDeg = (alt * 180) / Math.PI;
    const s = sample(altDeg);
    const dir = dirFromAltAz(alt, az);
    ENV.uSunDir.value.copy(dir);
    const moonDir = dirFromAltAz(Math.max(0.35, -alt * 0.8 + 0.2), az + Math.PI * 0.85);
    uniforms.uMoonDir.value.copy(moonDir);
    const night = smoothstep(-2, -10, altDeg);
    ENV.uNight.value = night; state.night = night; state.alt = altDeg;
    state.golden = smoothstep(-3, 2, altDeg) * (1 - smoothstep(8, 18, altDeg));
    // weather greys things out
    const grey = new THREE.Color(0x9aa3ad).multiplyScalar(lerp(1, 0.25, night));
    const cl = clamp(cloudy * 0.75 + storm * 0.25, 0, 0.9);
    uniforms.uZenith.value.copy(s.zen).lerp(grey, cl * 0.8);
    uniforms.uHorizon.value.copy(s.hor).lerp(grey.clone().multiplyScalar(1.1), cl * 0.7);
    uniforms.uGround.value.copy(s.fog).multiplyScalar(0.55);
    uniforms.uSunColor.value.copy(s.sun);
    ENV.uSkyColor.value.copy(uniforms.uZenith.value); ENV.uHorizon.value.copy(uniforms.uHorizon.value);
    ENV.uSunColor.value.copy(s.sun).multiplyScalar(Math.min(1.5, s.si / 2));
    // key light: sun by day, moon by night
    const lightDir = night > 0.5 ? moonDir : dir.clone().setY(Math.max(dir.y, 0.06)).normalize();
    sun.position.copy(lightDir).multiplyScalar(60); sun.target.position.set(3, 0, 0);
    const moonI = 0.55 * night;
    sun.intensity = Math.max(s.si * (1 - cl * 0.55), moonI);
    sun.color.copy(night > 0.5 ? new THREE.Color(0x9fb4ff) : s.sun);
    hemi.color.copy(s.hs).lerp(grey, cl * 0.5); hemi.groundColor.copy(s.hg); hemi.intensity = s.hi * (1 + cl * 0.25);
    starMat.opacity = night * (1 - cl * 0.85);
    state.fogColor.copy(s.fog).lerp(grey, cl * 0.6);
    state.sunDir.copy(dir);
    state.dayLight = 1 - night;
    stars.rotation.y = time * 0.002;
  }
  return { dome, stars, sun, hemi, state, update, uniforms };
}
