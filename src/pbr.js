// 🎨 gfx pass 2: CC0 photo detail textures (Poly Haven: leafy_grass, forrest_ground_01, coast_sand_01, rocky_terrain_02,
// bark_brown_02, wood_planks), tiered: Low = none, Medium = 512, High = 1024, Ultra = 1024 then 2048 lazily (ground layers).
// Ground keeps its painted vertex colours; the photo layers only add grain + normals, and fade out with distance.
import * as THREE from 'three';
import { WATER_Y, POND } from './layout.js';

const BASE = (import.meta.env?.BASE_URL || './') + 'tex/';
const loader = new THREE.TextureLoader();
const SETS = ['grass', 'dirt', 'sand', 'rock', 'bark', 'wood'];
const U = { uPbrReady: { value: 0 }, uSunW: { value: new THREE.Vector3(0.3, 0.8, 0.2) }, uSunC: { value: new THREE.Color(1, 0.95, 0.85) } }; // shared uniforms for every patched material
for (const n of ['grass', 'dirt', 'sand', 'rock']) { U[`u_${n}C`] = { value: null }; U[`u_${n}N`] = { value: null }; U[`u_${n}Avg`] = { value: new THREE.Vector3(0.5, 0.5, 0.5) }; }
const blank = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); blank.needsUpdate = true;
const blankC = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); blankC.needsUpdate = true;
for (const n of ['grass', 'dirt', 'sand', 'rock']) { U[`u_${n}C`].value = blankC; U[`u_${n}N`].value = blank; }
U.u_bankC = { value: blankC }; U.u_bankAvg = { value: new THREE.Vector3(0.5, 0.5, 0.5) }; U.uBankReady = { value: 0 };
const TEX = {};
function avgColor(img) { try { const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 8, 8); const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const s = (v) => Math.pow(v / 64 / 255, 2.2); return new THREE.Vector3(s(r), s(gg), s(b)); } catch (e) { return new THREE.Vector3(0.3, 0.3, 0.3); } }
function load(name, kind, size, aniso) {
  return new Promise((res) => loader.load(`${BASE}${name}_${kind}_${size}.webp`, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.colorSpace = kind === 'c' ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.userData.pbr = true; res(t); }, undefined, () => res(null)));
}

const VERT_DECL = 'varying vec3 vPWP; varying vec3 vPWN;\n';
const VERT_BODY = '\n  vPWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vPWN = normalize(mat3(modelMatrix) * objectNormal);';
const FRAG_DECL = `varying vec3 vPWP; varying vec3 vPWN; uniform float uPbrReady;
uniform sampler2D u_bankC; uniform vec3 u_bankAvg; uniform float uBankReady;
uniform sampler2D u_grassC, u_grassN, u_dirtC, u_dirtN, u_sandC, u_sandN, u_rockC, u_rockN; uniform vec3 u_grassAvg, u_dirtAvg, u_sandAvg, u_rockAvg;
vec3 pbrDetail(vec3 d, vec3 avg) { return clamp(d / max(avg, vec3(0.02)), vec3(0.45), vec3(1.7)); }
vec3 topN(sampler2D t, vec2 uv, vec3 wn) { vec3 n = texture2D(t, uv).xyz * 2.0 - 1.0; n = vec3(n.xy + wn.xz, abs(n.z) * wn.y); return n.xzy; }
`;
// weights from the painted colour + slope; returns detail multiplier, writes world normal
const FRAG_COLOR = (mode, hq) => `
  vec3 pwn = normalize(vPWN); float pDist = length(vPWP - cameraPosition); float pFade = uPbrReady * (1.0 - smoothstep(22.0, 75.0, pDist));
  vec3 pbrNW = pwn; vec3 vc = diffuseColor.rgb;
  if (pFade > 0.001) {
    float slope = 1.0 - pwn.y;
    ${mode === 'rock' ? 'float wG = 0.0, wS = 0.0, wR = 1.0;' : `float mxc = max(vc.r, max(vc.g, vc.b)), mnc = min(vc.r, min(vc.g, vc.b)); float sat = (mxc - mnc) / max(mxc, 0.001);
    float wG = smoothstep(0.0, 0.06, vc.g - vc.r * 0.92);
    float wR = max(smoothstep(0.4, 0.75, slope), (1.0 - smoothstep(0.12, 0.3, sat)) * (1.0 - wG));
    float wS = (1.0 - wG) * (1.0 - wR) * smoothstep(0.3, 0.5, mxc);`}
    float wD = max(0.0, 1.0 - wG - wR - wS); float wsum = wG + wR + wS + wD; wG /= wsum; wR /= wsum; wS /= wsum; wD /= wsum;
    vec2 uvT = vPWP.xz * 0.38; vec2 uvT2 = mat2(0.8, -0.6, 0.6, 0.8) * vPWP.xz * 0.071;
    vec3 det = vec3(0.0); vec3 nW = vec3(0.0);
    if (wG > 0.01) { det += wG * pbrDetail(texture2D(u_grassC, uvT).rgb, u_grassAvg); ${hq || mode !== 'rock' ? 'nW += wG * topN(u_grassN, uvT, pwn);' : ''} }
    if (wD > 0.01) { det += wD * pbrDetail(texture2D(u_dirtC, uvT).rgb, u_dirtAvg); nW += wD * topN(u_dirtN, uvT, pwn); }
    if (wS > 0.01) { det += wS * pbrDetail(texture2D(u_sandC, uvT * 1.3).rgb, u_sandAvg); nW += wS * topN(u_sandN, uvT * 1.3, pwn); }
    if (wR > 0.01) {
      ${hq ? `vec3 bw = pow(abs(pwn), vec3(4.0)); bw /= (bw.x + bw.y + bw.z); vec3 p = vPWP * 0.3;
      vec3 rc = texture2D(u_rockC, p.zy).rgb * bw.x + texture2D(u_rockC, p.xz).rgb * bw.y + texture2D(u_rockC, p.xy).rgb * bw.z;
      vec3 tx = texture2D(u_rockN, p.zy).xyz * 2.0 - 1.0, ty = texture2D(u_rockN, p.xz).xyz * 2.0 - 1.0, tz = texture2D(u_rockN, p.xy).xyz * 2.0 - 1.0;
      tx = vec3(tx.xy + pwn.zy, abs(tx.z) * pwn.x); ty = vec3(ty.xy + pwn.xz, abs(ty.z) * pwn.y); tz = vec3(tz.xy + pwn.xy, abs(tz.z) * pwn.z);
      nW += wR * normalize(tx.zyx * bw.x + ty.xzy * bw.y + tz.xyz * bw.z);` : 'vec3 rc = texture2D(u_rockC, vPWP.xz * 0.3 + vPWP.y * 0.21).rgb; nW += wR * pwn;'}
      det += wR * pbrDetail(rc, u_rockAvg); }
    float macro = dot(texture2D(u_dirtC, uvT2).rgb / max(u_dirtAvg, vec3(0.02)), vec3(0.333));
    det *= mix(1.0, clamp(macro, 0.75, 1.25), 0.5);
    diffuseColor.rgb = vc * mix(vec3(1.0), det, ${mode === 'rock' ? '0.75' : '0.62'} * pFade);
    pbrNW = normalize(mix(pwn, normalize(nW + 1e-4), ${hq ? '0.85' : '0.6'} * pFade));
  }
  float pbrWet = 0.0;
  ${mode === 'ground' ? `// far banks / fields (AI riverbank_ground): dry grass + cobbles; finer tiles near, coarser tiles + macro mottling far so it never mips flat
  { float bF = uBankReady * smoothstep(14.0, 40.0, pDist) * (1.0 - smoothstep(600.0, 1200.0, pDist)) * (1.0 - smoothstep(0.55, 0.85, 1.0 - pwn.y));
    if (bF > 0.001) { float d1 = smoothstep(45.0, 200.0, pDist);
      vec3 cA = texture2D(u_bankC, vPWP.xz * 0.16).rgb, cB = texture2D(u_bankC, mat2(0.6, -0.8, 0.8, 0.6) * vPWP.xz * 0.035).rgb, cC = texture2D(u_bankC, mat2(0.8, 0.6, -0.6, 0.8) * vPWP.xz * 0.0095 + 0.21).rgb;
      vec3 bd = mix(mix(pbrDetail(cA, u_bankAvg), pbrDetail(cB, u_bankAvg), 0.35 + 0.4 * d1), pbrDetail(cC, u_bankAvg), 0.45 * d1);
      bd = mix(vec3(1.0), bd, 1.0 + 0.6 * d1); // keep contrast at range (mips average it away)
      float wander = dot(texture2D(u_bankC, vPWP.xz * 0.0045 + 0.37).rgb / max(u_bankAvg, vec3(0.02)), vec3(0.333));
      float m2 = dot(texture2D(u_bankC, vPWP.xz * 0.0017 + 0.71).rgb / max(u_bankAvg, vec3(0.02)), vec3(0.333));
      vec3 dry = vec3(1.1, 0.98, 0.78), lush = vec3(0.84, 1.04, 0.84), sage = vec3(0.9, 0.98, 0.92);
      vec3 tint = mix(lush, dry, smoothstep(0.8, 1.2, wander)); tint = mix(tint, sage, smoothstep(0.95, 1.2, m2) * 0.6); tint *= 0.86 + 0.28 * smoothstep(0.7, 1.3, m2);
      diffuseColor.rgb *= mix(vec3(1.0), bd * tint, 0.85 * bF); } }
  // shoreline (island + both river banks): grey cobble/gravel band above the water, then a dark wet band right at the edge
  { float hy = vPWP.y - ${WATER_Y.toFixed(2)}; float wob = 0.07 * sin(vPWP.x * 0.9 + vPWP.z * 0.6) + 0.05 * sin(vPWP.z * 2.3 - vPWP.x * 1.1);
    float notPond = smoothstep(${(POND.r + 0.8).toFixed(2)}, ${(POND.r + 2.5).toFixed(2)}, length(vPWP.xz - vec2(${POND.x.toFixed(3)}, ${POND.z.toFixed(3)})));
    float farB = smoothstep(48.0, 64.0, length(vPWP.xz)); float sB = smoothstep(mix(0.85, 1.75, farB), 0.3, hy + wob * 1.5) * smoothstep(-1.0, -0.35, hy) * smoothstep(0.35, 0.7, pwn.y) * notPond;
    if (sB > 0.001) { vec3 g1 = texture2D(u_bankC, vPWP.xz * 0.6).rgb; vec3 g2 = texture2D(u_bankC, vPWP.zx * 0.23 + 0.5).rgb;
      float lum = dot((g1 * 0.65 + g2 * 0.35) / max(u_bankAvg, vec3(0.02)), vec3(0.333));
      vec3 cob = mix(vec3(0.42, 0.40, 0.36), vec3(0.55, 0.50, 0.42), g2.r / max(u_bankAvg.r, 0.02) - 0.5) * clamp(lum, 0.45, 1.7);
      diffuseColor.rgb = mix(diffuseColor.rgb, cob, sB * 0.8 * uBankReady); }
    pbrWet = smoothstep(min(mix(0.62, 0.8, farB) + pDist * 0.006, 1.3), 0.04, hy + wob) * smoothstep(-0.6, -0.05, hy) * notPond;
    diffuseColor.rgb *= mix(1.0, 0.5, pbrWet * pbrWet * (3.0 - 2.0 * pbrWet)); }` : ''}`;
const FRAG_NORMAL = `
  if (pFade > 0.001) normal = normalize(mix(normal, normalize((viewMatrix * vec4(pbrNW, 0.0)).xyz), pFade));`;

function patchDetail(material, mode, hq) {
  if (material.userData.pbrPatched) return; material.userData.pbrPatched = true;
  const prev = material.onBeforeCompile; const prevKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (sh, r) => { prev?.call(material, sh, r); Object.assign(sh.uniforms, U);
    sh.vertexShader = VERT_DECL + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>' + VERT_BODY);
    sh.fragmentShader = FRAG_DECL + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>' + FRAG_COLOR(mode, hq)).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + FRAG_NORMAL).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.42, pbrWet);'); };
  material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + `pbr_${mode}_${hq ? 1 : 0}`;
  material.needsUpdate = true;
}

// apply to the world: ground/terrain (marked userData.pbrGround), rocks (bumpMap kind rock), bark + wood (normal maps)
export function applyPBR(scene, { tier = 2, renderer, onLoaded } = {}) {
  if (tier <= 0) return null;
  const size = tier >= 2 ? 1024 : 512; const hq = tier >= 2; const aniso = Math.min(tier >= 2 ? 8 : 4, renderer?.capabilities?.getMaxAnisotropy?.() || 4);
  const mats = { ground: new Set(), rock: new Set(), bark: new Set(), wood: new Set() };
  scene.traverse((o) => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (!m || !m.isMeshStandardMaterial || m.userData.aiTex) continue;
    if (m.userData.pbrGround) mats.ground.add(m);
    const k = m.map?.userData?.kind || m.bumpMap?.userData?.kind; if (k && mats[k]) mats[k].add(m); } });
  for (const m of mats.ground) patchDetail(m, 'ground', hq);
  for (const m of mats.rock) { patchDetail(m, 'rock', hq); m.bumpMap = null; m.needsUpdate = true; }
  const jobs = [];
  for (const n of ['grass', 'dirt', 'sand', 'rock']) jobs.push(Promise.all([load(n, 'c', size, aniso), load(n, 'n', size, aniso)]).then(([c, nn]) => { if (c) { TEX[n + 'C'] = c; U[`u_${n}C`].value = c; U[`u_${n}Avg`].value = avgColor(c.image); } if (nn) { TEX[n + 'N'] = nn; U[`u_${n}N`].value = nn; } }));
  jobs.push(load('ai/riverbank_ground', 'c', size, aniso).then((c) => { if (!c) return; U.u_bankC.value = c; U.u_bankAvg.value = avgColor(c.image); U.uBankReady.value = 1; }));
  // bark + wood: tangent-space normal maps on their existing UVs (painted colour maps stay)
  for (const k of ['bark', 'wood']) if (mats[k].size) jobs.push(load(k, 'n', size >= 1024 ? 1024 : 512, aniso).then((nt) => { if (!nt) return; TEX[k + 'N'] = nt;
    for (const m of mats[k]) { const t = m.map || m.bumpMap; const rep = k === 'bark' ? [1, 2] : [1, 1]; const n2 = nt.clone(); n2.repeat.set(rep[0] * (t?.repeat.x || 1), rep[1] * (t?.repeat.y || 1)); n2.needsUpdate = true; m.normalMap = n2; m.normalScale = new THREE.Vector2(k === 'bark' ? 1.1 : 0.7, k === 'bark' ? 1.1 : 0.7); if (m.bumpMap?.userData?.kind === k) m.bumpMap = null; m.needsUpdate = true; } }));
  return Promise.all(jobs).then(() => { U.uPbrReady.value = 1; onLoaded?.(); // Ultra: swap the ground layers to 2048 once the island is up
    if (tier >= 3) setTimeout(() => { for (const n of ['grass', 'dirt', 'rock']) Promise.all([load(n, 'c', 2048, aniso), load(n, 'n', 2048, aniso)]).then(([c, nn]) => { if (c) { U[`u_${n}C`].value.dispose?.(); U[`u_${n}C`].value = c; } if (nn) { U[`u_${n}N`].value.dispose?.(); U[`u_${n}N`].value = nn; } }); }, 4000);
    return { mats: Object.fromEntries(Object.entries(mats).map(([k, v]) => [k, v.size])), size };
  });
}
export const PBR_UNIFORMS = U;
// High/Ultra: leaves glow a little when the sun is behind them (cheap translucency) + a soft rim, on the island's leaf/needle cards
export function patchFoliage(scene, tier) {
  if (tier < 2) return 0; let n = 0; const seen = new Set();
  scene.traverse((o) => { if (!o.isMesh) return; const m = o.material; if (!m || Array.isArray(m) || !m.userData?.foliage || seen.has(m)) return; seen.add(m); n++;
    const prev = m.onBeforeCompile; const prevKey = m.customProgramCacheKey?.bind(m);
    m.onBeforeCompile = (sh, r) => { prev?.call(m, sh, r); sh.uniforms.uSunW = U.uSunW; sh.uniforms.uSunC = U.uSunC;
      sh.fragmentShader = 'uniform vec3 uSunW; uniform vec3 uSunC;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 sv = normalize((viewMatrix * vec4(uSunW, 0.0)).xyz); vec3 vdir = -normalize(vViewPosition);
          float back = pow(clamp(dot(vdir, sv), 0.0, 1.0), 3.0); float rimL = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);
          totalEmissiveRadiance += diffuseColor.rgb * (uSunC * back * 0.55 + vec3(0.08) * rimL); }`); };
    m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + 'foliage2'; m.needsUpdate = true; });
  return n;
}
