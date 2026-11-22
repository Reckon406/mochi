// Lazy TRELLIS wildlife scans + a vertex-shader rig (same idea as Mochi's wings/legs:
// one fused mesh, position-painted feathered weights, seams stretch instead of tearing).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const FIT = {
  coyote: { file: 'coyote', kind: 'quad', height: 0.62, yaw: Math.PI },
  beaver: { file: 'beaver', kind: 'quad', height: 0.4, yaw: Math.PI },
  otter: { file: 'river_otter', kind: 'quad', height: 0.28, length: 0.95, yaw: Math.PI, swim: true },
  raccoon: { file: 'raccoon', kind: 'quad', height: 0.36, yaw: Math.PI },
  skunk: { file: 'skunk', kind: 'quad', height: 0.32, yaw: Math.PI },
  eagle: { file: 'bald_eagle', kind: 'bird', height: 0.56, yaw: Math.PI },
  owl: { file: 'great_horned_owl', kind: 'bird', height: 0.48, yaw: Math.PI },
  whitefish: { file: 'mountain_whitefish', kind: 'fish', length: 1, yaw: Math.PI },
  sucker: { file: 'largescale_sucker', kind: 'fish', length: 1, yaw: Math.PI },
  fox: { file: 'red_fox', kind: 'quad', height: 0.55, yaw: Math.PI },
  porcupine: { file: 'porcupine', kind: 'quad', height: 0.5, yaw: Math.PI },
  bighorn: { file: 'bighorn_sheep', kind: 'quad', height: 1.0, yaw: Math.PI },
  goat: { file: 'mountain_goat', kind: 'quad', height: 1.0, yaw: Math.PI },
  turkey: { file: 'wild_turkey', kind: 'bird', height: 0.65, yaw: Math.PI },
  magpie: { file: 'magpie', kind: 'bird', height: 0.28, yaw: Math.PI },
  jay: { file: 'stellers_jay', kind: 'bird', height: 0.26, yaw: Math.PI },
  osprey: { file: 'osprey', kind: 'bird', height: 0.5, yaw: Math.PI },
  heron: { file: 'great_blue_heron', kind: 'bird', height: 0.85, yaw: Math.PI },
  brook: { file: 'brook_trout', kind: 'fish', length: 0.95, yaw: Math.PI },
  elk: { file: 'elk', kind: 'quad', height: 2.05, yaw: Math.PI },
};

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const urlOf = (file) => (import.meta.env?.BASE_URL || '/') + 'models/wildlife/' + file + '.glb';

const cache = new Map(); // key -> Promise<template>
const dressed = new Set();
let style = 'new';
const dbgRig = typeof location !== 'undefined' && /[?&]rigdbg=1/.test(location.search || '');

export function setStyle(s) {
  style = s === 'classic' ? 'classic' : 'new';
  for (const r of dressed) applyOne(r);
}
export function getStyle() { return style; }
function wantNew() { return style === 'new'; }
function applyOne(root) {
  const w = root.userData.wild; if (!w) return;
  const use = wantNew() && w.loaded;
  if (w.proc) w.proc.visible = !use;
  if (w.model) w.model.visible = !!use;
}

function makeU() {
  return {
    uLegS: { value: new THREE.Vector4() }, uLegL: { value: new THREE.Vector4() },
    uHead: { value: new THREE.Vector2() }, uTail: { value: new THREE.Vector2() },
    uWing: { value: new THREE.Vector2() }, uUnd: { value: new THREE.Vector2() },
    uPFL: { value: new THREE.Vector3() }, uPFR: { value: new THREE.Vector3() },
    uPHL: { value: new THREE.Vector3() }, uPHR: { value: new THREE.Vector3() },
    uPH: { value: new THREE.Vector3() }, uPT: { value: new THREE.Vector3() },
    uPWL: { value: new THREE.Vector3() }, uPWR: { value: new THREE.Vector3() },
  };
}

const RIG_GLSL = `attribute vec4 aLeg; attribute vec4 aPart;
uniform vec4 uLegS; uniform vec4 uLegL; uniform vec2 uHead; uniform vec2 uTail; uniform vec2 uWing; uniform vec2 uUnd;
uniform vec3 uPFL; uniform vec3 uPFR; uniform vec3 uPHL; uniform vec3 uPHR; uniform vec3 uPH; uniform vec3 uPT; uniform vec3 uPWL; uniform vec3 uPWR;
vec3 rX(vec3 p, vec3 c, float a) { p -= c; float s = sin(a), k = cos(a); return vec3(p.x, p.y * k - p.z * s, p.y * s + p.z * k) + c; }
vec3 rY(vec3 p, vec3 c, float a) { p -= c; float s = sin(a), k = cos(a); return vec3(p.x * k + p.z * s, p.y, -p.x * s + p.z * k) + c; }
vec3 rZ(vec3 p, vec3 c, float a) { p -= c; float s = sin(a), k = cos(a); return vec3(p.x * k - p.y * s, p.x * s + p.y * k, p.z) + c; }
vec3 rigP(vec3 p) {
  vec3 q = p;
  float und = sin(uUnd.x + p.z * 5.5) * uUnd.y;
  q.x += und * max(aPart.y, aPart.x * 0.12);
  q = mix(q, rY(q, uPT, und * 1.6 + uTail.x), aPart.y);
  q = mix(q, rZ(q, uPT, uTail.y), aPart.y);
  q = mix(q, rY(rX(q, uPH, uHead.y), uPH, uHead.x), aPart.x);
  q = mix(q, rZ(q, uPWL, uWing.x), aPart.z);
  q = mix(q, rZ(q, uPWR, -uWing.y), aPart.w);
  q = mix(q, rX(q, uPFL, uLegS.x) + vec3(0.0, uLegL.x, 0.0), aLeg.x);
  q = mix(q, rX(q, uPFR, uLegS.y) + vec3(0.0, uLegL.y, 0.0), aLeg.y);
  q = mix(q, rX(q, uPHL, uLegS.z) + vec3(0.0, uLegL.z, 0.0), aLeg.z);
  q = mix(q, rX(q, uPHR, uLegS.w) + vec3(0.0, uLegL.w, 0.0), aLeg.w);
  return q;
}
vec3 rigN(vec3 n) {
  vec3 q = n;
  q = mix(q, rY(q, vec3(0.0), uTail.x), aPart.y);
  q = mix(q, rZ(q, vec3(0.0), uTail.y), aPart.y);
  q = mix(q, rY(rX(q, vec3(0.0), uHead.y), vec3(0.0), uHead.x), aPart.x);
  q = mix(q, rZ(q, vec3(0.0), uWing.x), aPart.z);
  q = mix(q, rZ(q, vec3(0.0), -uWing.y), aPart.w);
  q = mix(q, rX(q, vec3(0.0), uLegS.x), aLeg.x);
  q = mix(q, rX(q, vec3(0.0), uLegS.y), aLeg.y);
  q = mix(q, rX(q, vec3(0.0), uLegS.z), aLeg.z);
  q = mix(q, rX(q, vec3(0.0), uLegS.w), aLeg.w);
  return normalize(q);
}
`;

function patchRig(mat, u, normals = true, key = 'wildRig') {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = RIG_GLSL + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed = rigP(transformed);');
    if (normals) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n objectNormal = rigN(objectNormal);');
    if (dbgRig) {
      sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\n vDbg = vec4(aLeg.x + aLeg.y, aLeg.z + aLeg.w, aPart.x + aPart.z + aPart.w, aPart.y);').replace('void main() {', 'varying vec4 vDbg;\nvoid main() {');
      sh.fragmentShader = 'varying vec4 vDbg;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.15, 0.2), vDbg.x); gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.15, 0.4, 1.0), vDbg.y); gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.9, 0.15), vDbg.z); gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.2, 1.0, 0.4), vDbg.w);');
    }
  };
  mat.customProgramCacheKey = () => key + (normals ? '1' : '0') + (dbgRig ? 'd' : '');
  return mat;
}

function paint(geo, kind) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox, min = bb.min, size = new THREE.Vector3().subVectors(bb.max, min);
  const w = Math.max(1e-4, size.x), h = Math.max(1e-4, size.y), len = Math.max(1e-4, size.z);
  const P = geo.attributes.position;
  const aLeg = new Float32Array(P.count * 4), aPart = new Float32Array(P.count * 4);
  const acc = Array.from({ length: 8 }, () => ({ x: 0, y: 0, z: 0, w: 0, maxY: -1e9, minY: 1e9, maxZ: -1e9, minZ: 1e9, ax: 0 }));
  const add = (k, wt, x, y, z) => {
    if (wt <= 0.02) return;
    const a = acc[k]; a.x += x * wt; a.y += y * wt; a.z += z * wt; a.w += wt;
    a.maxY = Math.max(a.maxY, y); a.minY = Math.min(a.minY, y);
    a.maxZ = Math.max(a.maxZ, z); a.minZ = Math.min(a.minZ, z); a.ax += Math.abs(x) * wt;
  };
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const xn = (x - min.x) / w, yn = (y - min.y) / h, zn = (z - min.z) / len;
    const ax = Math.abs(x) / (w * 0.5);
    let head, tail, wingL, wingR, FL, FR, HL, HR;
    if (kind === 'fish') {
      head = ss(0.62, 0.78, zn);
      tail = 1 - ss(0.28, 0.48, zn);
      wingL = wingR = FL = FR = HL = HR = 0;
    } else if (kind === 'bird') {
      head = ss(0.55, 0.72, yn) * ss(0.62, 0.78, zn);
      tail = (1 - ss(0.18, 0.36, zn)) * (1 - head);
      const wing = ss(0.22, 0.40, yn) * (1 - ss(0.82, 0.95, yn)) * ss(0.42, 0.68, ax) * (1 - head * 0.8);
      wingL = x < 0 ? wing : 0; wingR = x > 0 ? wing : 0;
      const leg = (1 - ss(0.12, 0.28, yn)) * ss(0.35, 0.55, zn) * (1 - head);
      const right = ss(-0.01, 0.01, x);
      FL = FR = 0; HL = leg * (1 - right); HR = leg * right;
    } else {
      const leg = (1 - ss(0.28, 0.48, yn)) * (1 - ss(0.82, 0.95, yn));
      const front = ss(0.48, 0.62, zn);
      const back = 1 - ss(0.38, 0.52, zn);
      const right = ss(-0.02, 0.02, x);
      const left = 1 - right;
      FL = leg * front * left; FR = leg * front * right;
      HL = leg * back * left; HR = leg * back * right;
      head = ss(0.48, 0.68, yn) * ss(0.68, 0.84, zn);
      tail = (1 - ss(0.10, 0.28, zn)) * ss(0.18, 0.38, yn) * (1 - head);
      wingL = wingR = 0;
    }
    const parts = [FL, FR, HL, HR, head, tail, wingL, wingR];
    // keep weights from stacking too hard on seams
    let sum = 0; for (const v of parts) sum += v;
    const nrm = sum > 1.15 ? 1.15 / sum : 1;
    aLeg[i * 4] = FL * nrm; aLeg[i * 4 + 1] = FR * nrm; aLeg[i * 4 + 2] = HL * nrm; aLeg[i * 4 + 3] = HR * nrm;
    aPart[i * 4] = head * nrm; aPart[i * 4 + 1] = tail * nrm; aPart[i * 4 + 2] = wingL * nrm; aPart[i * 4 + 3] = wingR * nrm;
    for (let k = 0; k < 8; k++) add(k, parts[k] * nrm, x, y, z);
  }
  geo.setAttribute('aLeg', new THREE.BufferAttribute(aLeg, 4));
  geo.setAttribute('aPart', new THREE.BufferAttribute(aPart, 4));
  const piv = (k, fallback, mode) => {
    const a = acc[k];
    if (a.w < 1e-4) return fallback.clone();
    const c = new THREE.Vector3(a.x / a.w, a.y / a.w, a.z / a.w);
    if (mode === 'hip') c.y = a.maxY * 0.82 + c.y * 0.18; // rotate from the top of the leg
    if (mode === 'neck') { c.z = a.minZ * 0.6 + c.z * 0.4; c.y = a.minY * 0.4 + c.y * 0.6; }
    if (mode === 'tail') c.z = a.maxZ * 0.7 + c.z * 0.3;
    if (mode === 'shoulder') { const s = Math.sign(c.x) || 1; c.x = s * (a.ax / a.w) * 0.35; }
    return c;
  };
  const midY = min.y + h * 0.4, midZ = min.z + len * 0.5;
  return {
    FL: piv(0, new THREE.Vector3(-w * 0.15, h * 0.32, min.z + len * 0.7), 'hip'),
    FR: piv(1, new THREE.Vector3(w * 0.15, h * 0.32, min.z + len * 0.7), 'hip'),
    HL: piv(2, new THREE.Vector3(-w * 0.15, h * 0.32, min.z + len * 0.3), 'hip'),
    HR: piv(3, new THREE.Vector3(w * 0.15, h * 0.32, min.z + len * 0.3), 'hip'),
    H: piv(4, new THREE.Vector3(0, h * 0.7, min.z + len * 0.78), 'neck'),
    T: piv(5, new THREE.Vector3(0, midY, min.z + len * 0.18), 'tail'),
    WL: piv(6, new THREE.Vector3(-w * 0.12, h * 0.62, midZ), 'shoulder'),
    WR: piv(7, new THREE.Vector3(w * 0.12, h * 0.62, midZ), 'shoulder'),
    size: { w, h, len, min: min.clone() },
  };
}

function bakeTemplate(scene, cfg) {
  scene.updateMatrixWorld(true);
  scene.rotation.y = cfg.yaw || 0;
  scene.updateMatrixWorld(true);
  const bb0 = new THREE.Box3().setFromObject(scene);
  const size0 = new THREE.Vector3(); bb0.getSize(size0); const c0 = new THREE.Vector3(); bb0.getCenter(c0);
  let s = 1;
  if (cfg.length && cfg.height) s = Math.min(cfg.length / Math.max(1e-4, size0.z), cfg.height / Math.max(1e-4, size0.y));
  else if (cfg.length) s = cfg.length / Math.max(1e-4, size0.z);
  else if (cfg.height) s = cfg.height / Math.max(1e-4, size0.y);
  scene.scale.setScalar(s);
  scene.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(scene); const c = new THREE.Vector3(); bb.getCenter(c);
  if (cfg.kind === 'fish') scene.position.set(scene.position.x - c.x, scene.position.y - c.y, scene.position.z - c.z);
  else scene.position.set(scene.position.x - c.x, scene.position.y - bb.min.y, scene.position.z - c.z);
  scene.updateMatrixWorld(true);
  const meshes = []; scene.traverse((m) => { if (m.isMesh) meshes.push(m); });
  let piv = null;
  for (const m of meshes) {
    const g = m.geometry, pa = g.attributes.position;
    // bake into WORLD space (includes the scene's scale + feet/center offset), then the scene itself is reset to identity
    const M = m.matrixWorld.clone();
    const f = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) { f[i * 3] = pa.getX(i); f[i * 3 + 1] = pa.getY(i); f[i * 3 + 2] = pa.getZ(i); }
    g.setAttribute('position', new THREE.BufferAttribute(f, 3));
    g.applyMatrix4(M); g.deleteAttribute('normal'); g.computeVertexNormals();
    piv = paint(g, cfg.kind);
    const old = m.material;
    if (old?.map) { old.map.colorSpace = THREE.SRGBColorSpace; old.map.anisotropy = 4; }
    // keep the original material on the template (instances clone + patch)
    if (old) { old.roughness = old.roughness ?? 0.85; old.metalness = old.metalness ?? 0; }
    m.matrix.identity(); m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1); m.updateMatrix();
    if (m.parent !== scene) scene.add(m);
    m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
    m.userData.keepGeo = true;
  }
  scene.position.set(0, 0, 0); scene.rotation.set(0, 0, 0); scene.scale.set(1, 1, 1); scene.updateMatrixWorld(true);
  scene.userData.piv = piv; scene.userData.kind = cfg.kind; scene.userData.cfg = cfg;
  if (dbgRig && piv) console.log('[wildmodels] baked', cfg.file, 'kind', cfg.kind, 'headZ', +piv.H.z.toFixed(3), 'tailZ', +piv.T.z.toFixed(3), 'size', [+piv.size.w.toFixed(2), +piv.size.h.toFixed(2), +piv.size.len.toFixed(2)]);
  return scene;
}

function loadTemplate(key) {
  const cfg = FIT[key]; if (!cfg) return Promise.reject(new Error('unknown wildlife ' + key));
  if (cache.has(key)) return cache.get(key);
  const p = new Promise((resolve, reject) => {
    const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
    L.load(urlOf(cfg.file), (g) => {
      try { resolve(bakeTemplate(g.scene, cfg)); }
      catch (e) { console.warn('[wildmodels]', key, 'bake failed', e); reject(e); }
    }, undefined, (e) => { console.warn('[wildmodels]', key, 'load failed', e?.message || e); reject(e); });
  });
  cache.set(key, p);
  return p;
}

function attachInstance(root, template, w) {
  const sc = template.clone(true);
  const u = makeU();
  const piv = template.userData.piv;
  if (piv) {
    u.uPFL.value.copy(piv.FL); u.uPFR.value.copy(piv.FR);
    u.uPHL.value.copy(piv.HL); u.uPHR.value.copy(piv.HR);
    u.uPH.value.copy(piv.H); u.uPT.value.copy(piv.T);
    u.uPWL.value.copy(piv.WL); u.uPWR.value.copy(piv.WR);
  }
  sc.traverse((m) => {
    if (!m.isMesh) return;
    const old = m.material;
    const mat = old.clone();
    if (mat.color) mat.color.multiplyScalar(1.12);
    m.material = patchRig(mat, u, true);
    m.customDepthMaterial = patchRig(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), u, false);
    m.userData.keepGeo = true; m.castShadow = true; m.frustumCulled = false;
  });
  sc.visible = wantNew();
  root.add(sc);
  w.model = sc; w.u = u; w.loaded = true; w.kind = template.userData.kind;
  if (w.proc) w.proc.visible = !wantNew();
}

export function dress(root, key, extra = {}) {
  const cfg = { ...(FIT[key] || {}), ...extra };
  if (!FIT[key] && !cfg.file) return root;
  const w = root.userData.wild || (root.userData.wild = { key, kind: cfg.kind, loaded: false, proc: null, model: null, u: null, phase: 0, cyc: Math.random() * 10, lookT: 1 + Math.random() * 3, lookY: 0, lookX: 0, lookY0: 0, lookX0: 0, twitch: 0, glideT: 4 + Math.random() * 6, gliding: false, shift: 0 });
  if (!w.proc) {
    const proc = new THREE.Group(); proc.name = 'proc';
    const kids = [...root.children];
    for (const c of kids) proc.add(c);
    root.add(proc); w.proc = proc;
  }
  dressed.add(root);
  if (!wantNew()) return root;
  if (w.loaded || w.loading) return root;
  w.loading = true;
  loadTemplate(key).then((tmpl) => {
    if (w.loaded) return;
    try { attachInstance(root, tmpl, w); }
    catch (e) { console.warn('[wildmodels] attach', key, e); if (w.proc) w.proc.visible = true; }
    finally { w.loading = false; }
  }).catch(() => { w.loading = false; if (w.proc) w.proc.visible = true; });
  return root;
}

export function undress(root) { dressed.delete(root); }

export function tick(root, dt, t, st = {}) {
  let w = root.userData.wild;
  if (!w) {
    root.traverse((o) => { if (!w && o.userData.wild) w = o.userData.wild; });
    if (!w) return;
  }
  if (!w.u || !w.loaded || (w.model && !w.model.visible)) return;
  const kind = w.kind || 'quad';
  const speed = Math.max(0, st.speed || 0);
  const moving = speed > 0.08;
  const swim = !!st.swim;
  const fly = !!st.fly;
  const drink = !!st.drink;
  w.cyc += dt * (fly ? 11 : swim ? 7 : moving ? Math.min(8, 3.2 + speed * 2.2) : 1);
  const cyc = w.cyc;

  // idle look / twitch
  w.lookT -= dt;
  if (w.lookT < 0) {
    w.lookT = (kind === 'owl' ? 1.6 : 2.4) + Math.random() * (kind === 'owl' ? 3 : 4);
    w.lookY0 = w.lookY; w.lookX0 = w.lookX;
    w.lookY = st.headYaw != null ? st.headYaw : (kind === 'owl' ? (Math.random() * 2 - 1) * 1.5 : (Math.random() * 2 - 1) * 0.45);
    w.lookX = st.headPitch != null ? st.headPitch : (Math.random() * 0.25 - 0.08);
    if (Math.random() < 0.35) w.twitch = 1;
  }
  w.twitch = Math.max(0, w.twitch - dt * 3);
  const ease = 1 - Math.exp(-dt * 4);
  w._hy = (w._hy ?? 0) + ((st.headYaw != null ? st.headYaw : w.lookY) - (w._hy ?? 0)) * ease;
  w._hx = (w._hx ?? 0) + ((drink ? 0.55 : (st.headPitch != null ? st.headPitch : w.lookX)) - (w._hx ?? 0)) * ease;

  const u = w.u;
  u.uLegS.value.set(0, 0, 0, 0); u.uLegL.value.set(0, 0, 0, 0);
  u.uHead.value.set(w._hy, w._hx); u.uTail.value.set(0, 0); u.uWing.value.set(0, 0); u.uUnd.value.set(0, 0);

  if (kind === 'fish' || (kind === 'quad' && swim && FIT[w.key]?.swim)) {
    const amp = (kind === 'fish' ? 0.05 : 0.035) * (moving || swim ? 1 : 0.35);
    u.uUnd.value.set(t * (5 + Math.min(4, speed)) + cyc, amp);
    u.uTail.value.set(Math.sin(cyc * 1.4) * 0.25, 0);
    if (kind === 'quad') {
      const paddle = Math.sin(cyc * 1.6) * 0.55;
      u.uLegS.value.set(paddle, -paddle, -paddle * 0.7, paddle * 0.7);
    }
  } else if (kind === 'bird') {
    if (fly) {
      w.glideT -= dt;
      if (w.glideT < 0) { w.gliding = !w.gliding; w.glideT = w.gliding ? 2 + Math.random() * 4 : 1 + Math.random() * 2.2; }
      if (st.glide || w.gliding) {
        const hold = 0.42 + Math.sin(t * 0.8 + cyc) * 0.04;
        u.uWing.value.set(hold, hold);
      } else {
        const fl = Math.sin(cyc) * 0.7;
        u.uWing.value.set(fl, fl);
      }
      if (w.model) w.model.rotation.x = THREE.MathUtils.lerp(w.model.rotation.x, -0.95, 1 - Math.exp(-dt * 3));
    } else {
      if (w.model) w.model.rotation.x = THREE.MathUtils.lerp(w.model.rotation.x, 0, 1 - Math.exp(-dt * 4));
      const settle = Math.sin(t * 1.1 + cyc) * 0.04 + (w.twitch ? Math.sin(t * 30) * 0.08 : 0);
      u.uWing.value.set(settle, settle);
    }
    u.uTail.value.set(Math.sin(t * 1.3 + cyc) * 0.08, 0);
    u.uHead.value.set(w._hy, w._hx + (fly ? -0.15 : 0));
  } else {
    // quadruped walk / idle
    if (moving && !swim) {
      const a = Math.sin(cyc), b = Math.sin(cyc + Math.PI);
      const liftA = Math.max(0, Math.cos(cyc)) * 0.045;
      const liftB = Math.max(0, Math.cos(cyc + Math.PI)) * 0.045;
      const swing = 0.55;
      u.uLegS.value.set(a * swing, b * swing, b * swing * 0.9, a * swing * 0.9);
      u.uLegL.value.set(liftA, liftB, liftB, liftA);
      u.uHead.value.set(w._hy * 0.5, w._hx + Math.sin(cyc * 2) * 0.08);
      u.uTail.value.set(Math.sin(cyc + 0.5) * 0.4, Math.sin(cyc * 0.5) * 0.08);
    } else {
      u.uTail.value.set(Math.sin(t * 1.4 + cyc) * 0.16 + w.twitch * Math.sin(t * 18) * 0.25, Math.sin(t * 0.9) * 0.05);
      u.uHead.value.set(w._hy, w._hx + Math.sin(t * 1.7) * 0.03);
      const sh = Math.sin(t * 0.6 + cyc) * 0.015;
      u.uLegL.value.set(sh, -sh, -sh, sh);
    }
  }
}

export function preload(keys = Object.keys(FIT)) { return Promise.all(keys.map((k) => loadTemplate(k).catch(() => null))); }
