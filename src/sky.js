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
uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunColor, uMoonDir; uniform float uNight, uCloudy, uTime, uGolden;
varying vec3 vDir;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=0.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  // three-stop gradient: horizon -> soft mid band -> zenith
  vec3 mid = mix(uHorizon, uZenith, 0.55);
  vec3 col = mix(uHorizon, mid, smoothstep(0.0, 0.18, y));
  col = mix(col, uZenith, smoothstep(0.12, 0.75, y));
  col = mix(col, uGround, smoothstep(0.0, -0.25, y));
  float sd = max(dot(d, uSunDir), 0.0);
  vec2 sxz = normalize(uSunDir.xz + 1e-4); float toward = dot(normalize(d.xz + 1e-4), sxz) * 0.5 + 0.5;
  // sunset: warm band on the sun side, pink/violet afterglow above it, cool on the far side
  float band = exp(-max(y, 0.0) * 7.0);
  col += uGolden * band * mix(vec3(-0.04, -0.02, 0.05), vec3(0.32, 0.12, -0.02), pow(toward, 1.5));
  col += uGolden * exp(-abs(y - 0.16) * 9.0) * vec3(0.16, 0.05, 0.14) * toward;
  float glow = pow(sd, 6.0) * 0.45 + pow(sd, 40.0) * 0.5;
  col += uSunColor * glow * (1.0 - uCloudy * 0.6);
  float disc = smoothstep(0.9993, 0.9997, sd);
  col += uSunColor * disc * 10.0 * (1.0 - uCloudy * 0.85);
  col += uSunColor * 0.1 * exp(-abs(y) * 9.0) * (1.0 - uNight);
  // milky way + moon at night
  vec3 mwAxis = normalize(vec3(0.35, 0.55, 0.76));
  float mwd = dot(d, mwAxis);
  float mw = exp(-mwd * mwd * 28.0) * smoothstep(0.0, 0.25, y) * (0.45 + 0.55 * fbm(d.xz * 9.0 / (abs(d.y) + 0.4)));
  col += vec3(0.32, 0.36, 0.55) * mw * 0.22 * uNight * (1.0 - uCloudy);
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.95, 0.95, 1.0) * smoothstep(0.99955, 0.99975, md) * 3.0 * uNight;
  col += vec3(0.4, 0.5, 0.8) * (pow(md, 60.0) * 0.3 + pow(md, 8.0) * 0.06) * uNight;
  // soft drifting clouds (painted, low-poly friendly): lit warm from the sun side at sunset
  if (y > 0.0) {
    vec2 uv = d.xz / (y + 0.12) * 0.7 + vec2(uTime * 0.004, uTime * 0.0015);
    float n = fbm(uv * 1.3);
    float cov = mix(0.6, 0.3, uCloudy);
    float c = smoothstep(cov, cov + 0.22, n) * smoothstep(0.0, 0.12, y);
    vec3 lit = mix(vec3(1.0, 0.99, 0.97), uSunColor * 1.2 + vec3(0.2, 0.1, 0.1), uGolden * 0.8);
    vec3 shade = mix(uHorizon * 0.85, uZenith * 0.6, 0.4);
    vec3 cc = mix(shade, lit, 0.45 + 0.55 * pow(sd, 3.0) + 0.25 * (n - cov));
    cc = mix(cc, vec3(0.1, 0.12, 0.2), uNight * 0.85);
    col = mix(col, cc, c * 0.85);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const KEYS = [ // alt in degrees -> zenith, horizon, sun color, sun intensity, hemi sky, hemi ground, hemi intensity, fog
  { a: -18, zen: 0x060c22, hor: 0x18244a, sun: 0x000000, si: 0, hs: 0x4a5c9a, hg: 0x1a1c2a, hi: 0.6, fog: 0x141c3a },
  { a: -6, zen: 0x14214e, hor: 0x4a3f72, sun: 0x000000, si: 0, hs: 0x4a5890, hg: 0x1c1e2c, hi: 0.6, fog: 0x2e3360 },
  { a: -1.5, zen: 0x2a3f80, hor: 0xf08a58, sun: 0xff6a3a, si: 0.2, hs: 0x7a70a8, hg: 0x2e2232, hi: 0.6, fog: 0x9a7080 },
  { a: 4, zen: 0x4a74c0, hor: 0xffb47a, sun: 0xffa258, si: 2.8, hs: 0xc0b8d8, hg: 0x6a4a30, hi: 0.95, fog: 0xeab98e },
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
    uSunDir: ENV.uSunDir, uSunColor: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3() }, uNight: ENV.uNight, uCloudy: { value: cloudy }, uTime: ENV.uTime, uGolden: { value: 0 },
  };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), new THREE.ShaderMaterial({ uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false }));
  dome.renderOrder = -1; dome.frustumCulled = false; scene.add(dome);

  // stars
  let sg_tw;
  const r = rng(77); const N = 1800; const sp = new Float32Array(N * 3); const sc = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = r() * 2 - 1, th = r() * 6.283; const y = Math.abs(u) * 0.95 + 0.03; const rr = Math.sqrt(1 - y * y);
    sp.set([Math.cos(th) * rr * 3500, y * 3500, Math.sin(th) * rr * 3500], i * 3);
    const b = 0.5 + r() * 1.8; const warm = r(); sc.set([b * (warm > 0.8 ? 1.2 : 0.9), b * 0.95, b * (warm < 0.3 ? 1.3 : 1.0)], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const tw = new Float32Array(N); for (let i = 0; i < N; i++) tw[i] = r() * 6.28; sg_tw = tw;
  const starMat = new THREE.ShaderMaterial({ uniforms: { uTime: ENV.uTime, opacity: { value: 0 } }, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 color; attribute float tw; uniform float uTime; varying vec3 vC; varying float vT; void main(){ vC = color; vT = 0.65 + 0.35 * sin(uTime * (1.5 + fract(tw) * 2.5) + tw * 7.0); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (1.4 + length(color) * 0.9) * ${window.devicePixelRatio > 1.5 ? '1.5' : '1.0'}; }`,
    fragmentShader: `uniform float opacity; varying vec3 vC; varying float vT; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)); gl_FragColor = vec4(vC * vT * a, a * opacity); }` });
  Object.defineProperty(starMat, 'opacity', { get() { return this.uniforms.opacity.value; }, set(v) { if (this.uniforms) this.uniforms.opacity.value = v; } });
  sg.setAttribute('tw', new THREE.BufferAttribute(sg_tw, 1)); const stars = new THREE.Points(sg, starMat); stars.frustumCulled = false; scene.add(stars);

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  const hemi = new THREE.HemisphereLight(0xc4def8, 0x6b5f40, 1.0);
  scene.add(sun, sun.target, hemi);

  const state = { lightDir: new THREE.Vector3(0, 1, 0), night: 0, golden: 0, alt: 0, sunDir: new THREE.Vector3(), fogColor: new THREE.Color(), dayLight: 1 };
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
    uniforms.uGolden.value = smoothstep(-8, 1, altDeg) * (1 - smoothstep(6, 16, altDeg));
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
    state.lightDir.copy(lightDir); sun.position.copy(lightDir).multiplyScalar(60); sun.target.position.set(3, 0, 0);
    const moonI = 0.9 * night;
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
