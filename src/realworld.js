// 🌲 "real" pass: swaps the island's procedural trees, rocks, logs and stumps for CC0 glTF models (Quaternius Stylized
// Nature MegaKit pines + broadleaf trees, a Poly Haven scanned aspen-like tree, Poly Haven scanned rocks / stumps / logs /
// fire pit / crates / barrels). Medium loads the light `models/lo/` packs, High/Ultra `models/hi/`; Low keeps the procedural
// world (no download). Everything is instanced; the procedural meshes are only hidden once the models are in, so a failed or
// slow download leaves the old world in place. Positions/obstacles are untouched (the models are fitted to the old shapes).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { TREE_SPOTS } from './island.js';
import { PROP_SPOTS, topH } from './layout.js';
import { makePonderosa, makeFir, makeCottonwood, makeAspen, makeWillow } from './trees.js';
import { ENV } from './water.js';
import { patchFoliage } from './pbr.js';
import { bakeImpostor, impostorMesh } from './impostor.js';

const hash = (x, z, k = 0) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
const pickOf = (arr, x, z, k) => arr[Math.floor(hash(x, z, k) * arr.length) % arr.length];
const FALL = { value: 0 };

// leaves: gentle sway (unit-height models → height 1) + autumn gold tint; flagged for the High+ translucency patch
function leafify(m, { sway = 0.012, fall = 0 } = {}) {
  m.userData.foliage = true; const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { prev?.call(m, sh, r); sh.uniforms.uTime = ENV.uTime; sh.uniforms.uWind = ENV.uWind; sh.uniforms.uFall = { value: fall };
    sh.vertexShader = 'uniform float uTime; uniform float uWind; varying float vFallH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vFallH = 0.5;
      #ifdef USE_INSTANCING
        vFallH = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        vec3 ip = instanceMatrix[3].xyz; float hh = clamp(position.y, 0.0, 1.2);
        float sw = sin(uTime * 1.3 + ip.x * 0.15 + ip.z * 0.11) + 0.4 * sin(uTime * 2.7 + ip.x * 0.3 + position.x * 4.0);
        transformed.x += sw * hh * hh * ${sway.toFixed(4)} * (0.4 + uWind * 2.0);
        transformed.z += cos(uTime * 1.1 + ip.z * 0.2 + position.z * 4.0) * hh * hh * ${(sway * 0.5).toFixed(4)} * (0.4 + uWind * 2.0);
      #endif`);
    sh.fragmentShader = 'uniform float uFall; varying float vFallH;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); // per-tree autumn hue: lemon / gold / burnt orange, saturated (linear space)
        vec3 pal = vFallH < 0.33 ? vec3(0.95, 0.62, 0.03) : vFallH < 0.72 ? vec3(1.0, 0.45, 0.02) : vec3(0.98, 0.26, 0.015);
        vec3 gold = pal * clamp(l * 2.6 + 0.22, 0.3, 1.15); diffuseColor.rgb = mix(diffuseColor.rgb, gold, uFall); }`); };
  const pk = m.customProgramCacheKey?.bind(m); m.customProgramCacheKey = () => (pk ? pk() : '') + 'leaf' + sway + '_' + fall; m.needsUpdate = true; return m;
}

// quantized (KHR_mesh_quantization) attributes are normalised ints: bake to float first or applyMatrix4 clamps them to [-1, 1]
function toFloat(geo) {
  const G = ['getX', 'getY', 'getZ', 'getW'];
  for (const k of Object.keys(geo.attributes)) { const a = geo.attributes[k]; if (a.array instanceof Float32Array && !a.normalized && !a.isInterleavedBufferAttribute) continue;
    const n = a.itemSize, f = new Float32Array(a.count * n); for (let i = 0; i < a.count; i++) for (let j = 0; j < n; j++) f[i * n + j] = a[G[j]](i);
    geo.setAttribute(k, new THREE.BufferAttribute(f, n)); }
  return geo;
}
// glTF scene → { key: { parts: [{ geo, mat }], box } }, geometry baked into model space
function protos(root) {
  root.updateMatrixWorld(true); const out = {};
  for (const node of root.children) { const key = node.name.split('#')[0]; const P = out[key] || (out[key] = { parts: [], box: new THREE.Box3() });
    node.traverse((o) => { if (!o.isMesh) return; const geo = toFloat(o.geometry.clone()); geo.applyMatrix4(o.matrixWorld); geo.computeBoundingBox(); P.box.union(geo.boundingBox); P.parts.push({ geo, mat: o.material }); }); }
  return out;
}
// normalise a proto to unit height, trunk base at the origin (trees)
function unitTree(P) {
  const b = P.box, H = b.max.y - b.min.y; let sx = 0, sz = 0, n = 0;
  for (const { geo } of P.parts) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < b.min.y + H * 0.04) { sx += p.getX(i); sz += p.getZ(i); n++; } }
  const cx = n ? sx / n : (b.min.x + b.max.x) / 2, cz = n ? sz / n : (b.min.z + b.max.z) / 2;
  const m = new THREE.Matrix4().makeScale(1 / H, 1 / H, 1 / H).multiply(new THREE.Matrix4().makeTranslation(-cx, -b.min.y, -cz));
  return { parts: P.parts.map(({ geo, mat }) => ({ geo: geo.clone().applyMatrix4(m), mat })), H };
}
function instanced(parts, mats, group, { shadow = true, matFor = (m) => m } = {}) {
  for (const { geo, mat } of parts) { if (!mats.length) continue; const im = new THREE.InstancedMesh(geo, matFor(mat), mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true; im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); group.add(im); }
}
// matrix that fits a model box into a source geometry box (longest axis → longest axis), centred / bottom-aligned
const _v = new THREE.Vector3();
function fit(src, mdl, { bottom = false, iso = 0.6, k = 1 } = {}) {
  const ss = src.getSize(new THREE.Vector3()).toArray(), ms = mdl.getSize(new THREE.Vector3()).toArray();
  const sa = [0, 1, 2].sort((a, b) => ss[b] - ss[a]), ma = [0, 1, 2].sort((a, b) => ms[b] - ms[a]);
  // keep Y as Y unless the source is clearly elongated sideways (logs lying down)
  let map; if (!bottom && ss[sa[0]] > ss[sa[1]] * 1.6 && ms[ma[0]] > ms[ma[1]] * 1.6) { map = [0, 1, 2]; map[ma[0]] = sa[0]; const rs = [0, 1, 2].filter((a) => a !== sa[0]), rm = [0, 1, 2].filter((a) => a !== ma[0]); map[rm[0]] = rs[0]; map[rm[1]] = rs[1]; }
  else map = [0, 1, 2];
  const P = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1); const e = P.elements; // column-major
  for (let a = 0; a < 3; a++) e[a * 4 + map[a]] = 1;
  if (P.determinant() < 0) for (let r = 0; r < 3; r++) e[8 + r] *= -1; // keep it a rotation
  const sc = [0, 0, 0]; for (let a = 0; a < 3; a++) sc[map[a]] = ss[map[a]] / Math.max(1e-4, ms[a]);
  const g = Math.cbrt(sc[0] * sc[1] * sc[2]); const S = sc.map((s) => k * g * Math.pow(s / g, iso));
  const mc = mdl.getCenter(new THREE.Vector3()); if (bottom) mc.y = mdl.min.y;
  const sc0 = src.getCenter(new THREE.Vector3()); if (bottom) sc0.y = src.min.y;
  return new THREE.Matrix4().makeTranslation(sc0.x, sc0.y, sc0.z).multiply(new THREE.Matrix4().makeScale(...S)).multiply(P).multiply(new THREE.Matrix4().makeTranslation(-mc.x, -mc.y, -mc.z));
}

const _lemon = new THREE.Color(1, 1.12, 1.15), _burnt = new THREE.Color(1.05, 0.78, 0.55);
function landTrees(scene, group, { pines, commons, aspen, bare, fallAmt, snowy, tier, renderer, matFor, push, info }) {
  const srcs = []; scene.traverse((o) => { if (o.userData.realLand && o.isInstancedMesh && o.count) srcs.push(o); }); if (!srcs.length) return;
  const strip = (P, fall) => (bare && fall >= 0 ? P.parts.filter((pt) => !(pt.mat.alphaTest > 0 || /lea/i.test(pt.mat.name))) : P.parts);
  const cache = new Map(); const imp = (P, fall) => { const k = P.H + '_' + fall; if (!cache.has(k)) cache.set(k, bakeImpostor(renderer, strip(P, fall), { res: tier >= 2 ? 384 : 256, env: scene.environment, matFor: matFor(fall) })); return cache.get(k); };
  const KIND = { pine: { pool: [pines[0], pines[1], pines[2], pines[3], pines[4]], fall: -1, k: 1.0 }, cotton: { pool: [commons[0], commons[1], commons[4]], fall: fallAmt, k: 1.05 }, aspen: { pool: [commons[2], commons[3]], fall: fallAmt, k: 1.0 }, willow: { pool: [commons[0], commons[1]], fall: fallAmt * 0.85, k: 0.75, squash: 0.8 } };
  const nearN = tier >= 3 ? 600 : tier >= 2 ? 260 : 0; const lists = new Map(); const near = [];
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const snowC = new THREE.Color(0xeef2f8);
  for (const o of srcs) { const K = KIND[o.userData.realLand]; if (!K) continue; if (tier < 2 && o.userData.realLand === 'aspen') continue; /* Medium: pines + bank cottonwoods/willows go to impostors (dock/shore views are low-angle); aspens keep LOD canopies */ if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const gh = o.geometry.boundingBox.max.y - o.geometry.boundingBox.min.y;
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.decompose(p, q, s); const H = gh * s.y * K.k; const P = pickOf(K.pool, p.x, p.z, 7); const fall = K.fall < 0 ? 0 : K.fall;
      const v = 0.82 + hash(p.x, p.z, 9) * 0.26; c.setRGB(v, v * (0.97 + hash(p.x, p.z, 4) * 0.06), v); if (K.fall > 0) { const hh = hash(p.x, p.z, 11); if (hh < 0.33) c.multiply(_lemon); else if (hh < 0.66) c.multiply(_burnt); } if (snowy) c.lerp(snowC, 0.3);
      const tm = new THREE.Matrix4().compose(p.clone().setY(p.y + 0.15), new THREE.Quaternion().setFromAxisAngle(up, hash(p.x, p.z, 2) * 6.283), new THREE.Vector3(H * (K.squash ? 1.3 : 1), H, H * (K.squash ? 1.3 : 1)));
      near.push({ d: Math.hypot(p.x, p.z), P, fall, tm, c: c.clone() }); }
    o.visible = false; o.userData.realHidden = true; }
  near.sort((a, b) => a.d - b.d);
  near.forEach((t, i) => { if (i < nearN) { push(t.P, t.fall, t.tm); info.trees++; return; } const key = cacheKey(t); if (!lists.has(key)) lists.set(key, { t, list: [] }); lists.get(key).list.push({ m4: t.tm, c: t.c }); });
  function cacheKey(t) { return t.P.H + '_' + t.fall; }
  for (const { t, list } of lists.values()) group.add(impostorMesh(imp(t.P, t.fall), list));
  info.impostors = near.length - Math.min(nearN, near.length); info.impostorTex = cache.size;
}

export function upgradeWorld(scene, { tier = 1, season = 'summer', snowy = false, renderer, onDone } = {}) {
  if (tier < 1) return null; const set = tier >= 2 ? 'hi' : 'lo'; const base = (import.meta.env?.BASE_URL || '/') + 'models/' + set + '/';
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); const t0 = performance.now();
  const load = (n) => loader.loadAsync(base + n + '.glb').then((g) => protos(g.scene));
  const group = new THREE.Group(); group.name = 'real-world'; const info = { set, trees: 0, rocks: 0, wood: 0, props: 0, ms: 0 };
  const aniso = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
  const tune = (m) => { for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) m[k].anisotropy = aniso; m.envMapIntensity = 0.8; return m; };

  const doTrees = load('trees').then((T) => {
    const pines = [1, 2, 3, 4, 5].map((i) => unitTree(T['pine' + i])), commons = [1, 2, 3, 4, 5].map((i) => unitTree(T['common' + i])), aspen = unitTree(T.aspen);
    const bare = snowy; const fallAmt = season === 'fall' ? 1 : 0;
    const leafMats = new Map(); const matFor = (fall) => (m) => { tune(m); if (/bark|trunk|branch/i.test(m.name) || !(m.alphaTest > 0 || /lea|twig/i.test(m.name))) return m; const k = m.uuid + fall;
      if (!leafMats.has(k)) leafMats.set(k, leafify(m.clone(), { fall })); return leafMats.get(k); };
    const buckets = new Map(); const push = (proto, fall, m4) => { const k = proto; if (!buckets.has(k)) buckets.set(k, { proto, fall, list: [] }); buckets.get(k).list.push(m4); };
    scene.updateMatrixWorld(true);
    for (const { maker, g } of TREE_SPOTS) { if (!g.parent) continue;
      const box = new THREE.Box3().setFromObject(g); const H = Math.max(1.5, box.max.y - g.position.y); const p = g.position; const yaw = hash(p.x, p.z, 3) * Math.PI * 2;
      let proto, fall = 0, k = 1;
      if (maker === makePonderosa) { proto = pickOf([pines[0], pines[1], pines[4]], p.x, p.z, 1); k = 1.05; }
      else if (maker === makeFir) { proto = pickOf([pines[2], pines[3], pines[1]], p.x, p.z, 1); k = 1.05; }
      else if (maker === makeAspen) { proto = aspen; fall = fallAmt; k = 1.1; }
      else if (maker === makeWillow) { proto = pickOf([commons[2], commons[4]], p.x, p.z, 1); fall = fallAmt * 0.6; k = 0.95; }
      else if (maker === makeCottonwood) { proto = pickOf([commons[0], commons[1], commons[4]], p.x, p.z, 1); fall = fallAmt; k = 1.0; }
      else continue;
      const m4 = new THREE.Matrix4().compose(p.clone(), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3().setScalar(H * k * (0.92 + hash(p.x, p.z, 5) * 0.16)));
      push(proto, fall, m4); g.visible = false; g.userData.realHidden = true; info.trees++; }
    // round shrubs → Quaternius Bush_Common (fitted onto the old flat-shaded domes; kept procedural under snow)
    if (T.bush && !snowy) { const list = []; const im4 = new THREE.Matrix4(), w4 = new THREE.Matrix4();
      scene.traverse((o) => { if (o.userData.real !== 'bush' || !o.isInstancedMesh) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, im4); w4.multiplyMatrices(o.matrixWorld, im4); list.push(w4.clone().multiply(fit(o.geometry.boundingBox, T.bush.box, { bottom: true, iso: 0.7, k: 1.15 }))); }
        o.visible = false; });
      instanced(T.bush.parts, list, group, { shadow: tier >= 2, matFor: matFor(fallAmt * 0.15) }); info.bushes = list.length; }
    // valley trees (foothill pines, bank cottonwoods / aspens): baked impostors far, real instanced models for the nearest at High+
    if (renderer) try { landTrees(scene, group, { pines, commons, aspen, bare, fallAmt, snowy, tier, renderer, matFor, push, info }); } catch (e) { console.warn('[real] impostors', e.message); }
    for (const { proto, fall, list } of buckets.values()) { const parts = bare && fall > 0 ? proto.parts.filter((pt) => !(pt.mat.alphaTest > 0 || /lea/i.test(pt.mat.name))) : proto.parts; instanced(parts, list, group, { matFor: matFor(fall) }); }
  });

  // rocks / logs / stumps / driftwood: fitted onto every tagged procedural mesh or instance
  const KINDS = { pebble: 'rocks', rock: 'rocks', boulder: 'rocks', mossrock: 'rocks', log: 'wood', driftwood: 'wood', stump: 'wood' };
  const POOL = { pebble: ['pebS'], rock: ['rock07', 'rock09', 'stone01', 'moss_1', 'moss_4'], boulder: ['stone01', 'moss_0', 'moss_2', 'moss_3'], mossrock: ['moss_0', 'moss_1', 'moss_2', 'moss_3', 'moss_4', 'moss_5'], log: ['log'], driftwood: ['log', 'log2'], stump: ['stump'] };
  const OPTS = { pebble: { iso: 0.5, k: 0.85 }, rock: { iso: 0.5, k: 1.0 }, boulder: { iso: 0.5, k: 1.05 }, mossrock: { iso: 0.5, k: 1.1 }, log: { iso: 1, k: 1 }, driftwood: { iso: 1, k: 1 }, stump: { bottom: true, iso: 0.8, k: 1.15 } };
  const doFitted = Promise.all([load('rocks'), load('wood')]).then(([R, W]) => {
    const P = { ...R, ...W }; const buckets = new Map(); const hide = [];
    scene.updateMatrixWorld(true); const im4 = new THREE.Matrix4(), w4 = new THREE.Matrix4();
    scene.traverse((o) => { const kind = o.userData.real; if (!kind || !POOL[kind] || !o.isMesh) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const gb = o.geometry.boundingBox;
      const n = o.isInstancedMesh ? o.count : 1;
      for (let i = 0; i < n; i++) { if (o.isInstancedMesh) { o.getMatrixAt(i, im4); w4.multiplyMatrices(o.matrixWorld, im4); } else w4.copy(o.matrixWorld);
        _v.setFromMatrixPosition(w4); const key = pickOf(POOL[kind], _v.x, _v.z, i); const pr = P[key]; if (!pr) continue;
        const m = w4.clone().multiply(fit(gb, pr.box, OPTS[kind])); if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(m); info[KINDS[kind]]++; }
      hide.push(o); });
    for (const [key, list] of buckets) instanced(P[key].parts, list, group, { matFor: tune });
    return hide;
  });

  // fire pit + a few crates / barrels / buckets as set dressing
  const doProps = load('props').then((Pr) => { const hide = []; scene.updateMatrixWorld(true);
    scene.traverse((o) => { if (o.userData.realSpot !== 'firepit' || !Pr.firepit) return; const b = Pr.firepit.box; const s = 1.7 / Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
      const m = o.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(new THREE.Matrix4().makeTranslation(-(b.min.x + b.max.x) / 2, -b.min.y - 0.02 / s, -(b.min.z + b.max.z) / 2));
      instanced(Pr.firepit.parts, [m], group, { matFor: tune }); info.props++; });
    scene.traverse((o) => { if (o.userData.realHide === 'firepit') hide.push(o); });
    const place = (P, x, y, z, yaw, extra = new THREE.Matrix4()) => { if (!P) return; const b = P.box; const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1))
      .multiply(extra).multiply(new THREE.Matrix4().makeTranslation(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2)); instanced(P.parts, [m], group, { matFor: tune }); info.props++; };
    for (const sp of PROP_SPOTS) { const P = Pr[sp.kind]; if (!P) continue; const y = topH(sp.x, sp.z) - 0.02; place(P, sp.x, y, sp.z, sp.yaw);
      if (sp.stack) place(P, sp.x, y + (P.box.max.y - P.box.min.y), sp.z, sp.yaw + 0.35, new THREE.Matrix4().makeScale(0.8, 0.8, 0.8)); }
    return hide;
  });

  const all = Promise.allSettled([doTrees, doFitted, doProps]).then((rs) => {
    const ok = rs.map((r) => r.status === 'fulfilled'); rs.forEach((r) => r.status === 'rejected' && console.warn('[real] pack failed', r.reason?.message || r.reason));
    if (ok[1]) { for (const o of rs[1].value) o.visible = false; scene.traverse((o) => { if (o.userData.realHide && o.userData.realHide !== 'firepit') o.visible = false; }); }
    if (ok[2]) for (const o of rs[2].value) o.visible = false;
    scene.add(group); try { patchFoliage(group, tier); } catch (e) { /* optional */ }
    info.ms = Math.round(performance.now() - t0); info.instMeshes = group.children.length; info.ok = ok; console.log('[real]', JSON.stringify(info)); onDone?.(info); return info;
  });
  return { group, ready: all, info, FALL };
}
