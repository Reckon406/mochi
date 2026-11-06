// 🎨 graphics helpers: height fog + valley mist, wind sway for instanced trees, night rim light, bark/rock bump maps
import * as THREE from 'three';
import { ENV } from './water.js';
import { rng } from './noise.js';

ENV.uRim = { value: 0 }; // night rim-light strength (animals)

// ── height fog: thicker down in the valley, thinner up the peaks; plus dawn/dusk mist that hugs the river ──
// MistFog is a FogExp2 that also looks like a linear Fog to three's uniform refresh, so `near` carries the
// mist amount and `far` the density (FOG_EXP2 stays defined because isFogExp2 is true).
export class MistFog extends THREE.FogExp2 {
  constructor(color, density) { super(color, density); this.isFog = true; this.mist = 0; }
  get near() { return this.mist; } set near(v) { /* ignore */ }
  get far() { return this.density; } set far(v) { /* ignore */ }
}
let fogInstalled = false;
export function installHeightFog() {
  if (fogInstalled) return; fogInstalled = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth; varying float vFogY;
#endif`;
  C.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogY = dot( viewMatrix[1].xyz, mvPosition.xyz - viewMatrix[3].xyz ); // world-space height
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; varying float vFogDepth; varying float vFogY;
  #ifdef FOG_EXP2
    uniform float fogDensity; uniform float fogNear; uniform float fogFar;
  #else
    uniform float fogNear; uniform float fogFar;
  #endif
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogD = fogFar < 1.0 ? fogFar : fogDensity;
    float hLow = exp( - max( vFogY - 0.2, 0.0 ) / 16.0 );
    float dens = fogD * ( 0.7 + 1.5 * hLow );
    float fogFactor = 1.0 - exp( - dens * dens * vFogDepth * vFogDepth );
    float mistF = fogNear * 0.55 * exp( - max( vFogY + 0.9, 0.0 ) / 2.2 ) * smoothstep( 15.0, 160.0, vFogDepth );
    fogFactor = max( fogFactor, clamp( mistF, 0.0, 0.8 ) );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
}

// ── wind sway for instanced canopies (cottonwoods/willows): the top moves, the base doesn't ──
export function addInstancedSway(material, amount = 0.08, height = 3) {
  material.onBeforeCompile = (sh) => { sh.uniforms.uTime = ENV.uTime; sh.uniforms.uWind = ENV.uWind;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    #ifdef USE_INSTANCING
      vec3 ip = instanceMatrix[3].xyz;
      float hh = clamp(position.y / ${height.toFixed(2)}, 0.0, 1.5);
      float sw = sin(uTime * 1.3 + ip.x * 0.15 + ip.z * 0.11) + 0.4 * sin(uTime * 2.7 + ip.x * 0.3);
      transformed.x += sw * hh * hh * ${amount.toFixed(3)} * (0.4 + uWind * 2.0);
      transformed.z += cos(uTime * 1.1 + ip.z * 0.2) * hh * hh * ${(amount * 0.5).toFixed(3)} * (0.4 + uWind * 2.0);
    #endif`); };
  material.customProgramCacheKey = () => 'sway' + amount + '_' + height;
  return material;
}

// ── faint cool rim light + eye-catching edges at night so far-bank animals read ──
export function addRim(material) {
  if (material.userData.rim) return material; material.userData.rim = true;
  material.onBeforeCompile = (sh) => { sh.uniforms.uRim = ENV.uRim;
    sh.fragmentShader = 'uniform float uRim;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float rimF = pow( 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 ), 2.5 );
      totalEmissiveRadiance += vec3( 0.55, 0.68, 1.0 ) * rimF * uRim + diffuseColor.rgb * 0.18 * uRim;`); };
  material.customProgramCacheKey = () => 'rim';
  return material;
}

// ── bump textures (cute low-poly, just a bit of surface) ──
const cache = {};
function bumpCanvas(key, w, h, draw) {
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; return (cache[key] = t);
}
export function barkBump() {
  return bumpCanvas('bark', 64, 128, (g, w, h) => { const r = rng(5); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const x = r() * w, ww = 1 + r() * 3; g.fillStyle = r() < 0.5 ? '#3a3a3a' : '#5a5a5a'; g.fillRect(x, 0, ww, h); }
    for (let i = 0; i < 60; i++) { g.fillStyle = r() < 0.5 ? '#b0b0b0' : '#4a4a4a'; g.fillRect(r() * w, r() * h, 2 + r() * 6, 1 + r() * 3); } });
}
export function rockBump() {
  return bumpCanvas('rock', 128, 128, (g, w, h) => { const r = rng(9); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const s = 2 + r() * 10, v = Math.floor(90 + r() * 90); g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(r() * w, r() * h, s, 0, 6.28); g.fill(); }
    g.strokeStyle = '#303030'; g.lineWidth = 1.5; for (let i = 0; i < 10; i++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); } });
}

// ── quality tiers (auto picks one for the device) ──
/** Read UNMASKED_RENDERER once (ephemeral context). Empty string if blocked. */
export function gpuRendererString() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl', { powerPreference: 'high-performance' }) || c.getContext('experimental-webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const s = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : String(gl.getParameter(gl.RENDERER) || '');
    try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
    return s;
  } catch { return ''; }
}
/** Adreno 7xx, Mali-G7xx / Immortalis, Apple GPU → flagship-ish for Auto Medium. */
export function isFlagshipGpu(renderer = gpuRendererString()) {
  const g = String(renderer || '').toLowerCase();
  return /adreno[^0-9]*7\d{2}|adreno \(tm\) 7\d{2}|mali-g7\d|immortalis|apple gpu|apple a1[5-9]|apple a[2-9]\d|apple m[1-9]/.test(g);
}
export function autoQuality() {
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4; const small = Math.min(innerWidth, innerHeight) < 700;
  if (coarse || small) return isFlagshipGpu() ? 'medium' : 'low';
  return cores <= 4 ? 'medium' : 'high';
}
