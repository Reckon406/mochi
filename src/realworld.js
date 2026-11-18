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

const hash = (x, z, k = 0) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
const pickOf = (arr, x, z, k) => arr[Math.floor(hash(x, z, k) * arr.length) % arr.length];
const FALL = { value: 0 };

// leaves: gentle sway (unit-height models → height 1) + autumn gold tint; flagged for the High+ translucency patch
function leafify(m, { sway = 0.012, fall = 0 } = {}) {
  m.userData.foliage = true; const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { prev?.call(m, sh, r); sh.uniforms.uTime = ENV.uTime; sh.uniforms.uWind = ENV.uWind; sh.uniforms.uFall = { value: fall };
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz; float hh = clamp(position.y, 0.0, 1.2);
        float sw = sin(uTime * 1.3 + ip.x * 0.15 + ip.z * 0.11) + 0.4 * sin(uTime * 2.7 + ip.x * 0.3 + position.x * 4.0);
        transformed.x += sw * hh * hh * ${sway.toFixed(4)} * (0.4 + uWind * 2.0);
        transformed.z += cos(uTime * 1.1 + ip.z * 0.2 + position.z * 4.0) * hh * hh * ${(sway * 0.5).toFixed(4)} * (0.4 + uWind * 2.0);
      #endif`);
    sh.fragmentShader = 'uniform float uFall;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); vec3 gold = vec3(1.0, 0.7, 0.2) * clamp(l * 3.0 + 0.12, 0.0, 1.2); diffuseColor.rgb = mix(diffuseColor.rgb, gold, uFall); }`); };
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
    const leafMats = new Map(); const matFor = (fall) => (m) => { tune(m); if (!(m.alphaTest > 0 || /lea|twig/i.test(m.name))) return m; const k = m.uuid + fall;
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
    for (const { proto, fall, list } of buckets.values()) { const parts = bare && fall > 0 ? proto.parts.filter((pt) => !(pt.mat.alphaTest > 0 || /lea/i.test(pt.mat.name))) : proto.parts; instanced(parts, list, group, { matFor: matFor(fall) }); }
  });

  // rocks / logs / stumps / driftwood: fitted onto every tagged procedural mesh or instance
  const KINDS = { pebble: 'rocks', rock: 'rocks', boulder: 'rocks', mossrock: 'rocks', log: 'wood', driftwood: 'wood', stump: 'wood' };
  const POOL = { pebble: ['peb7', 'peb9', 'pebS'], rock: ['rock07', 'rock09', 'stone01', 'moss_1', 'moss_4'], boulder: ['stone01', 'moss_0', 'moss_2', 'moss_3'], mossrock: ['moss_0', 'moss_1', 'moss_2', 'moss_3', 'moss_4', 'moss_5'], log: ['log'], driftwood: ['log', 'log2'], stump: ['stump'] };
  const OPTS = { pebble: { iso: 0.5, k: 1.0 }, rock: { iso: 0.5, k: 1.0 }, boulder: { iso: 0.5, k: 1.05 }, mossrock: { iso: 0.5, k: 1.1 }, log: { iso: 1, k: 1 }, driftwood: { iso: 1, k: 1 }, stump: { bottom: true, iso: 0.8, k: 1.15 } };
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
