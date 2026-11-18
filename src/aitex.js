// 🎨 AI-texture pass (Corey-approved AI-generated sources in ai-tex-src/, processed by tools/aitex.py into public/tex/ai/):
// thatch, log wall, cabin boards, shingles, deck planks, weathered fence wood (+ derived normal + roughness), the sign-board
// grain and the Bitterroot mountain backdrop. Tiers: Low keeps the painted canvas textures; Medium 512, High 1024,
// Ultra 1024 then 2048 lazily. Materials opt in with aiTex(material, kind, opts) where they're built:
//   mode 'uv'  → the mesh's own UVs with `rep` repeats (round hut wall + cone roof)
//   mode 'tri' → object-space planar projection on the dominant axis, `mpt` metres per tile, so boards/planks/shingles have
//                real-world size on any box regardless of its UVs; `rot` turns the grain 90° (planks whose long axis is local x).
import * as THREE from 'three';

const BASE = (import.meta.env?.BASE_URL || './') + 'tex/ai/';
const loader = new THREE.TextureLoader();
const FILE = { thatch: 'hut_thatch', logwall: 'hut_logwall', cabin: 'cabin_boards', shingles: 'roof_shingles', deck: 'deck_planks', fence: 'fence_wood' };
const MPT = { thatch: 1.3, logwall: 3.3, cabin: 1.8, shingles: 1.7, deck: 1.7, fence: 1.2 }; // metres per texture tile
const NS = { thatch: 1.0, logwall: 0.8, cabin: 0.7, shingles: 1.0, deck: 0.8, fence: 1.0 };
let TIER = 0, ANISO = 4; const SETS = {}; const WAIT = []; const USERS = {};
export const AI_INFO = { tier: 0, tagged: 0, applied: 0, size: 0, upgraded: false };

function load(url, srgb) {
  return new Promise((res) => loader.load(url, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; res(t); }, undefined, () => res(null)));
}
function loadSet(kind, s) { const f = FILE[kind]; return Promise.all([load(`${BASE}${f}_c_${s}.webp`, true), load(`${BASE}${f}_n_${s}.webp`, false), load(`${BASE}${f}_r_${s / 2}.webp`, false)]).then(([c, n, r]) => (c ? { c, n, r } : null)); }

export function initAITex(tier, renderer) {
  TIER = tier; AI_INFO.tier = tier; if (tier < 1) return null;
  ANISO = Math.min(tier >= 2 ? 8 : 4, renderer?.capabilities?.getMaxAnisotropy?.() || 4);
  const size = tier >= 2 ? 1024 : 512; AI_INFO.size = size;
  const all = Object.keys(FILE).map((k) => loadSet(k, size).then((set) => { if (!set) return; SETS[k] = set; for (let i = WAIT.length - 1; i >= 0; i--) if (WAIT[i][1] === k) { const [m, , o] = WAIT.splice(i, 1)[0]; apply(m, k, o); } }));
  const done = Promise.all(all);
  if (tier >= 3) done.then(() => setTimeout(() => { for (const k of Object.keys(FILE)) loadSet(k, 2048).then((set) => { if (!set || !SETS[k]) return; // lazily swap every user's textures to 2048
    for (const key of ['c', 'n', 'r']) { if (!set[key]) continue; SETS[k][key].dispose?.(); SETS[k][key] = set[key]; for (const t of USERS[k + key] || []) { t.source = set[key].source; t.needsUpdate = true; } }
    AI_INFO.upgraded = true; }); }, 5000));
  return done;
}

export function aiTex(m, kind, o = {}) {
  if (!m || TIER < 1 || !FILE[kind]) return m; m.userData.aiTex = kind; AI_INFO.tagged++;
  if (SETS[kind]) apply(m, kind, o); else WAIT.push([m, kind, o]); return m;
}
const use = (kind, key, t) => { (USERS[kind + key] ||= []).push(t); return t; };

function apply(m, kind, o) {
  const S = SETS[kind]; AI_INFO.applied++; if (o.tint != null) m.color.set(o.tint); else m.color.set(0xffffff); m.roughness = 1;
  if (o.mode === 'uv') {
    const rep = o.rep || [1, 1]; const cl = (t, key) => { if (!t) return null; const c = use(kind, key, t.clone()); c.repeat.set(rep[0], rep[1]); c.needsUpdate = true; return c; };
    m.map = cl(S.c, 'c'); m.normalMap = cl(S.n, 'n'); m.roughnessMap = cl(S.r, 'r'); const ns = (o.ns ?? NS[kind]); m.normalScale = new THREE.Vector2(ns, ns); m.bumpMap = null; m.needsUpdate = true; return;
  }
  // triplanar-ish: one projection per fragment (dominant object-space axis)
  const U = { tAiC: { value: use(kind, 'c', S.c) }, tAiN: { value: use(kind, 'n', S.n) }, tAiR: { value: use(kind, 'r', S.r) }, uAiS: { value: 1 / (o.mpt ?? MPT[kind]) }, uAiNS: { value: o.ns ?? NS[kind] }, uAiRot: { value: o.rot ? 1 : 0 } };
  m.map = null; m.bumpMap = null; m.normalMap = null; m.roughnessMap = null; m.userData.aiU = U;
  const prev = m.onBeforeCompile; const prevKey = m.customProgramCacheKey?.bind(m);
  m.onBeforeCompile = (sh, r) => { prev?.call(m, sh, r); Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vAiP; varying vec3 vAiN; varying vec3 vAiX; varying vec3 vAiY; varying vec3 vAiZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      { vec3 aiS = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)); mat3 aiI = mat3(1.0);
        #ifdef USE_INSTANCING
          aiI = mat3(instanceMatrix); aiS *= vec3(length(aiI[0]), length(aiI[1]), length(aiI[2]));
        #endif
        vAiP = position * aiS; vAiN = normal; mat3 aiMV = mat3(modelViewMatrix) * aiI;
        vAiX = normalize(aiMV * vec3(1.0, 0.0, 0.0)); vAiY = normalize(aiMV * vec3(0.0, 1.0, 0.0)); vAiZ = normalize(aiMV * vec3(0.0, 0.0, 1.0)); }`);
    sh.fragmentShader = `uniform sampler2D tAiC; uniform sampler2D tAiN; uniform sampler2D tAiR; uniform float uAiS; uniform float uAiNS; uniform float uAiRot;
      varying vec3 vAiP; varying vec3 vAiN; varying vec3 vAiX; varying vec3 vAiY; varying vec3 vAiZ;\n` + sh.fragmentShader
      .replace('#include <map_fragment>', `vec3 aiA = abs(vAiN); vec2 aiUV; vec3 aiT; vec3 aiB;
        if (aiA.y >= aiA.x && aiA.y >= aiA.z) { aiUV = vAiP.xz; aiT = vAiX; aiB = vAiZ; } else if (aiA.x >= aiA.z) { aiUV = vec2(-vAiP.z * sign(vAiN.x), vAiP.y); aiT = -vAiZ * sign(vAiN.x); aiB = vAiY; } else { aiUV = vec2(vAiP.x * sign(vAiN.z), vAiP.y); aiT = vAiX * sign(vAiN.z); aiB = vAiY; }
        if (uAiRot > 0.5) { aiUV = aiUV.yx; vec3 aiTmp = aiT; aiT = aiB; aiB = aiTmp; }
        aiUV *= uAiS; vec4 aiC = texture2D(tAiC, aiUV); diffuseColor.rgb *= aiC.rgb;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * texture2D(tAiR, aiUV).g;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 aiTN = texture2D(tAiN, aiUV).xyz * 2.0 - 1.0; aiTN.xy *= uAiNS; vec3 aiNN = normal; vec3 aiTT = normalize(aiT - aiNN * dot(aiNN, aiT)); vec3 aiBB = normalize(aiB - aiNN * dot(aiNN, aiB) - aiTT * dot(aiTT, aiB));
          normal = normalize(aiTT * aiTN.x + aiBB * aiTN.y + aiNN * aiTN.z); }`); };
  m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + 'aitri'; m.needsUpdate = true;
}

// ── sign boards: AI board grain loaded before the signs are drawn (signs.js draws it under the burnt text) ──
export function loadSignBoard(tier) {
  if (tier < 1) return Promise.resolve(null);
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = `${BASE}sign_board_1024.webp`; setTimeout(() => res(null), 6000); });
}

// ── Bitterroot backdrop: wrapped strip on a far ring behind the far terrain, faded at the bottom, hazed + darkened by sky/weather ──
export function buildBackdrop(scene, { tier = 2, weather = {} } = {}) {
  if (tier < 1) return null;
  const R = 1850, H = 560, SEG = 9; // 9 wraps around the valley; peaks ~9° up from the island
  const geo = new THREE.CylinderGeometry(R, R, H, 128, 1, true); geo.translate(0, H / 2 - 40, 0);
  { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); // Bitterroots (west, -x) tall + jagged; Sapphires (east) lower
    const west = THREE.MathUtils.smoothstep(-x / R, -0.6, 0.6); p.setY(i, -40 + (y + 40) * (0.62 + 0.38 * west)); } }
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * SEG);
  const U = { uLight: { value: new THREE.Color(1, 1, 1) }, uFog: { value: new THREE.Color(0xc6dcec) }, uHaze: { value: 0.3 } };
  const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, fog: false, alphaTest: 0.02 });
  m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U); sh.fragmentShader = 'uniform vec3 uLight; uniform vec3 uFog; uniform float uHaze;\n' + sh.fragmentShader
    .replace('#include <map_fragment>', `#include <map_fragment>
      float bot = smoothstep(0.02, 0.2, vMapUv.y); diffuseColor.a *= bot; // fade into the far terrain / valley haze
      diffuseColor.rgb = mix(diffuseColor.rgb * uLight, uFog, clamp(uHaze + (1.0 - vMapUv.y) * 0.25, 0.0, 1.0));`); };
  m.customProgramCacheKey = () => 'backdrop1';
  const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = -1; mesh.frustumCulled = false; mesh.visible = false; mesh.name = 'bitterroot-backdrop'; scene.add(mesh);
  const w = tier >= 3 ? 2560 : tier >= 2 ? 2560 : 2048;
  loader.load(`${BASE}mountains_${w}.webp`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; m.map = t; m.needsUpdate = true; mesh.visible = true;
    if (tier >= 3) setTimeout(() => loader.load(`${BASE}mountains_4096.webp`, (t2) => { t2.colorSpace = THREE.SRGBColorSpace; t2.wrapS = THREE.RepeatWrapping; t2.anisotropy = 8; m.map = t2; t.dispose(); m.needsUpdate = true; }), 6000); });
  const golden = new THREE.Color(1.0, 0.78, 0.6), nightC = new THREE.Color(0.1, 0.13, 0.22);
  const baseHaze = weather.fog ? 1 : (weather.rain || weather.snow ? (weather.heavy ? 0.85 : 0.65) : 0.14) + (weather.cloudiness || 0) * 0.15;
  return { mesh, update(st, camPos) { if (camPos) mesh.position.set(camPos.x * 0.98, 0, camPos.z * 0.98); // ~fixed to the camera so the ring never parallaxes
      U.uFog.value.copy(st.fogColor); U.uLight.value.setRGB(1, 1, 1).lerp(golden, (st.golden || 0) * 0.45).lerp(nightC, st.night || 0);
      U.uHaze.value = Math.min(1, baseHaze * (1 - 0.5 * (st.night || 0))); } };
}
