import * as THREE from 'three';

// Shared environment uniforms (updated by the lighting system each frame)
export const ENV = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 1, 1) },
  uSkyColor: { value: new THREE.Color(0.6, 0.75, 0.9) },
  uHorizon: { value: new THREE.Color(0.8, 0.85, 0.9) },
  uNight: { value: 0 },
  uWind: { value: 0.3 },
};

const vert = /* glsl */`
uniform float uTime; uniform float uAmp; uniform float uFreq;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float w = sin(wp.x * uFreq * 1.0 + uTime * 1.7) * uAmp + sin(wp.z * uFreq * 1.4 - uTime * 1.2 + wp.x * 0.3) * uAmp * 0.5;
  wp.y += w;
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = /* glsl */`
uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSkyColor; uniform vec3 uHorizon; uniform float uNight;
uniform vec3 uDeep; uniform vec3 uShallow; uniform float uOpacity; uniform float uSparkle; uniform float uScale;
uniform float uFoam; uniform vec2 uShoreC; uniform float uShoreX; uniform float uRimR;
varying vec3 vWorld;
#include <fog_pars_fragment>
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec2 p = vWorld.xz * uScale;
  float t = uTime;
  // layered ripple gradients -> normal
  float e = 0.05;
  #define H(q) (vnoise((q)*2.0 + vec2(t*0.35, t*0.22)) * 0.6 + vnoise((q)*4.3 - vec2(t*0.5, -t*0.31)) * 0.3 + vnoise((q)*9.1 + vec2(-t*0.9, t*0.7)) * 0.12)
  float h0 = H(p); float hx = H(p + vec2(e, 0.)); float hz = H(p + vec2(0., e));
  vec3 n = normalize(vec3(-(hx - h0) / e * 0.18, 1.0, -(hz - h0) / e * 0.18));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 col = mix(uDeep, uShallow, 0.35 + 0.3 * h0);
  vec3 refl = mix(uHorizon, uSkyColor, clamp(reflect(-v, n).y * 1.6, 0.0, 1.0));
  col = mix(col, refl, 0.25 + 0.6 * fres);
  float sunUp = smoothstep(-0.05, 0.12, uSunDir.y);
  vec3 hv = normalize(uSunDir + v);
  float spec = pow(max(dot(n, hv), 0.0), 260.0) * 6.0 * uSparkle;
  col += uSunColor * spec * sunUp;
  col *= mix(1.0, 0.35, uNight);
  // moon / night glints
  col += vec3(0.6,0.7,1.0) * pow(max(dot(n, normalize(vec3(-0.3,0.5,0.2) + v)), 0.0), 400.0) * 2.0 * uNight * uSparkle;
  // shore foam (lagoon only)
  if (uFoam > 0.0) {
    float lx = vWorld.x - uShoreC.x;
    float d = lx - uShoreX; // distance from the shoreline (water side > 0)
    float band = sin(d * 5.0 + t * 2.4) * 0.5 + 0.5;
    float f = smoothstep(0.9, 0.0, d) * smoothstep(0.55, 0.95, band + vnoise(vWorld.xz*3.0+t)*0.35);
    f += smoothstep(0.18, 0.0, abs(d - 0.05 - 0.08*sin(t*1.3 + vWorld.z*2.0))) * 0.9;
    float rr = length(vWorld.xz - uShoreC);
    f += smoothstep(uRimR - 0.5, uRimR - 0.1, rr) * 0.8;
    col = mix(col, vec3(1.0) * mix(1.0, 0.4, uNight), clamp(f, 0.0, 1.0) * uFoam);
  }
  gl_FragColor = vec4(col, uOpacity);
  #include <fog_fragment>
}`;

export function makeWaterMaterial({ deep = 0x1f6d8f, shallow = 0x66c9d6, amp = 0.03, freq = 2.0, opacity = 0.9, sparkle = 1, scale = 1, foam = 0, shoreC = [0, 0], shoreX = 0, rimR = 99 } = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uAmp: { value: amp }, uFreq: { value: freq }, uDeep: { value: new THREE.Color(deep) }, uShallow: { value: new THREE.Color(shallow) },
    uOpacity: { value: opacity }, uSparkle: { value: sparkle }, uScale: { value: scale }, uFoam: { value: foam },
    uShoreC: { value: new THREE.Vector2(...shoreC) }, uShoreX: { value: shoreX }, uRimR: { value: rimR },
  }]);
  Object.assign(uniforms, ENV); // shared (by reference) time / sun / sky
  return new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: opacity < 1, fog: true });
}

// ── Bitterroot River: flowing current, depth-tinted shallows, foam on banks/rocks/bars + wakes ──
const riverVert = /* glsl */`
varying vec3 vWorld;
#include <fog_pars_vertex>
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const riverFrag = /* glsl */`
uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSkyColor; uniform vec3 uHorizon; uniform float uNight; uniform float uWind;
uniform sampler2D uDepth; uniform vec3 uRect; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uBed; uniform float uWaterY; uniform float uFloorY; uniform float uBedY; uniform float uIce;
varying vec3 vWorld;
#include <fog_pars_fragment>
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float riverX(float z){ return 30.0*sin(z/240.0) + 12.0*sin(z/83.0); }
float riverXd(float z){ return 30.0/240.0*cos(z/240.0) + 12.0/83.0*cos(z/83.0); }
float riverW(float z){ return 8.0 + 46.0*exp(-pow(z/100.0, 2.0)); }
float bedH(vec2 p){
  float w = riverW(p.y); float adx = abs(p.x - riverX(p.y));
  float h = mix(uFloorY, uBedY, smoothstep(w + 5.0, w - 3.0, adx));
  vec2 uv = (p - uRect.xy) / uRect.z;
  if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) h = max(h, texture2D(uDepth, uv).r * 8.0 - 4.0);
  return h;
}
void main(){
  vec2 p = vWorld.xz; float t = uTime;
  vec2 fd = normalize(vec2(-riverXd(p.y), -1.0)); // the Bitterroot flows north (-z)
  vec2 pr = vec2(-fd.y, fd.x);
  vec2 q = vec2(dot(p, pr), dot(p, fd)); // across, along
  float depth = uWaterY - bedH(p);
  float spd = 1.3 * (0.6 + 0.4 * smoothstep(0.2, 2.0, depth));
  vec2 qa = q - vec2(0.0, t * spd);
  // ripples (stretched along the flow) -> normal
  float e = 0.06;
  #define H(z) (vnoise((z)*vec2(1.2,0.55))*0.55 + vnoise((z)*vec2(2.6,1.1) + 7.0)*0.3 + vnoise((z)*vec2(6.0,3.0) - vec2(0.0, t*0.6))*0.15)
  float h0 = H(qa); float hx = H(qa + vec2(e,0.0)); float hz = H(qa + vec2(0.0,e));
  vec2 g = vec2(hx - h0, hz - h0) / e * 0.16;
  vec2 gw = pr * g.x + fd * g.y;
  vec3 n = normalize(vec3(-gw.x, 1.0, -gw.y));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  float dk = smoothstep(0.0, 1.8, depth);
  vec3 col = mix(mix(uBed, uShallow, 0.55), uShallow, smoothstep(0.0, 0.5, depth));
  col = mix(col, uDeep, dk);
  col *= 0.9 + 0.2 * h0;
  vec3 refl = mix(uHorizon, uSkyColor, clamp(reflect(-v, n).y * 1.5, 0.0, 1.0));
  col = mix(col, refl, 0.08 + 0.5 * fres);
  float sunUp = smoothstep(-0.05, 0.12, uSunDir.y);
  vec3 hv = normalize(uSunDir + v);
  col += uSunColor * pow(max(dot(n, hv), 0.0), 220.0) * 5.0 * sunUp;
  col *= mix(1.0, 0.32, uNight);
  col += vec3(0.6,0.7,1.0) * pow(max(dot(n, normalize(vec3(-0.3,0.5,0.2) + v)), 0.0), 300.0) * 1.5 * uNight;
  // foam: waterline + riffles over shallows + wakes trailing downstream of rocks/bars/the island
  float fn = vnoise(qa * vec2(3.0, 1.2)) * 0.6 + vnoise(qa * vec2(7.0, 2.5) + 3.0) * 0.4;
  float foam = smoothstep(0.16, 0.0, depth) * 0.95;
  foam += smoothstep(0.5, 0.12, depth) * smoothstep(0.6, 0.88, fn) * 0.6;
  float wake = 0.0;
  for (int k = 1; k <= 4; k++) { float fk = float(k); float du = uWaterY - bedH(p - fd * fk * 0.9); wake += smoothstep(0.25, 0.0, du) * (1.0 - fk * 0.2); }
  foam += clamp(wake, 0.0, 1.0) * smoothstep(0.5, 0.8, fn + 0.12) * 0.85;
  foam += smoothstep(0.8, 0.97, vnoise(qa * vec2(0.9, 0.22) + 11.0)) * 0.14 * (0.6 + uWind) * smoothstep(0.3, 1.0, depth); // drifting current streaks
  col = mix(col, vec3(0.95, 0.97, 1.0) * mix(1.0, 0.35, uNight) * (0.7 + 0.3 * sunUp), clamp(foam, 0.0, 0.9));
  // ice shelf along the banks in snowy weather
  col = mix(col, vec3(0.85, 0.92, 0.98) * mix(1.0, 0.4, uNight), uIce * smoothstep(0.5, 0.1, depth) * smoothstep(0.4, 0.6, vnoise(p * 0.8)));
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;
export function makeRiverMaterial({ depthTex, rect, snowy = false }) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uDepth: { value: null }, uRect: { value: new THREE.Vector3(rect.x0, rect.z0, rect.size) },
    uDeep: { value: new THREE.Color(0x2a5e5a) }, uShallow: { value: new THREE.Color(0x6a9e88) }, uBed: { value: new THREE.Color(0xa09068) },
    uWaterY: { value: -0.9 }, uFloorY: { value: 0.5 }, uBedY: { value: -2.8 }, uIce: { value: snowy ? 1 : 0 },
  }]);
  uniforms.uDepth.value = depthTex;
  Object.assign(uniforms, ENV);
  return new THREE.ShaderMaterial({ uniforms, vertexShader: riverVert, fragmentShader: riverFrag, fog: true });
}
