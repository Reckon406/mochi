import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import './style.css';
import { ENV } from './water.js';
import { createSky } from './sky.js';
import { buildLandscape, TRAPPER_DIR, setLowMountains } from './landscape.js';
import { buildIsland } from './island.js';
import { createMochi } from './mochi.js';
import { createGaming } from './gaming.js';
import { createCrush } from './crush.js';
import { createPet } from './pet.js';
import { createMemories } from './memory.js';
import { createPaper } from './paper.js';
import { createSquirrel, createElk } from './creatures.js';
import { parseWeather, createWeather } from './weather.js';
import { ZONES, matchZone, groundY, onIslet, BRIDGE, bridgeParam, OBSTACLES, CLIFF, PROP_SPOTS } from './layout.js';
import { createBlobShadows } from './blobs.js';
import { buildUI } from './ui.js';
import { createWalk } from './controls.js';
import { seasonOf } from './season.js';
import { buildFeatures } from './features.js';
import { buildWishes, applyWishBuilt } from './wishes.js';
import { createExtras } from './extras.js';
import { liveWeather, startLiveWeather } from './live.js';
import { createNightSky } from './nightsky.js';
import { createWaterFx } from './waterfx.js';
import { createAdventures } from './adventures.js';
import { createRange } from './range.js';
import { createTempSigns } from './tempsigns.js';
import { applyPBR, patchFoliage, PBR_UNIFORMS } from './pbr.js';
import { upgradeWorld } from './realworld.js';
import { buildWildflowers } from './wildflowers.js';
import { createLife } from './life.js';
import { createCritters } from './critters.js';
import { createWildlife } from './wildlife.js';
import { installHeightFog, MistFog } from './gfx.js';
import { loadSignFonts, zoneSigns, updateSigns, setSignScale, setSignBoard } from './signs.js';
import { initAITex, loadSignBoard, buildBackdrop, AI_INFO } from './aitex.js';
import { buildDetails } from './details.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
installHeightFog();
import { FISH } from './fish.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
import { buildWorldState } from './worldstate.js';
import { createMusic } from './music.js';
import { createSettings, buildSettingsPanel, QUALITY } from './settings.js';

const params = new URLSearchParams(location.search);
const FALLBACK = {
  name: 'Mochi', mood: 'a little lost but extremely confident', activity: 'looking for his state file', caps: 0, outfit: '', location: 'hut',
  weather: 'clear, crisp', savings: {}, thoughts: ['where did my diary go', 'i am still very cool though'], diary: [], art: [], goals: [],
};

async function loadState() {
  const src = params.get('state') || './state.json';
  try {
    const res = await fetch(src, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const s = await res.json();
    return { state: { ...FALLBACK, ...s }, error: null };
  } catch (e) {
    return { state: { ...FALLBACK }, error: `couldn't load state.json (${e.message || e}). showing default mochi.` };
  }
}

const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
let paused = false;
const audioCtl = { suspend() {}, resume() {} };

async function init() {
  const { state, error } = await loadState();
  // stage B: real Darby weather (Open-Meteo) unless a ?weather= preview is set; Mochi's own text is kept as weatherMochi
  let live = null;
  if (!params.get('weather') && params.get('live') !== '0') { try { live = await liveWeather(); } catch (e) { live = null; } if (live) { state.weatherMochi = state.weather; state.weather = live.text; } }
  if (params.get('weather')) state.weather = params.get('weather');
  if (params.get('location')) state.location = params.get('location');
  if (params.get('treehouse') != null) state.treehouse = { ...(state.treehouse || {}), stage: +params.get('treehouse') }; // preview only, never saved
  if (params.get('thparts')) state.treehouse = { ...(state.treehouse || { stage: 2 }), parts: params.get('thparts').split(',') };
  if (params.get('outfit')) state.outfit = params.get('outfit');
  const hour = params.has('hour') ? parseFloat(params.get('hour')) : null;
  const weather = parseWeather(state.weather);
  const settings = createSettings(); const S0 = settings.get();
  const qName = params.get('quality') || S0.quality || 'auto';
  const Q = QUALITY[qName] || QUALITY.auto;
  const aiOn = params.get('aitex') !== '0'; // ?aitex=0 compares with the painted textures
  { const [, board] = await Promise.all([loadSignFonts(), aiOn ? loadSignBoard(Q.tier ?? 2) : null]); setSignBoard(board); }
  const lite = (Q.tier ?? 2) <= 0; setSignScale(lite ? 0.5 : 1); // Low only — flagship phones on Medium keep fuller trees
  const dprCap = Math.min(Q.pr, isMobile ? 1.5 : Q.pr);

  // ── renderer ──
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // r18x: PCFSoftShadowMap was folded into PCF + shadow.radius (soft Vogel-disk filtering)
  const TM = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping };
  renderer.toneMapping = TM[params.get('tm')] ?? THREE.ACESFilmicToneMapping; // ACES: AgX read hazy / grey on this palette
  const EXPO = renderer.toneMapping === THREE.AgXToneMapping ? 1.25 : 1.0; renderer.toneMappingExposure = EXPO;
  // iOS Safari / memory pressure: don't silently freeze — ask for a tap-reload
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    paused = true;
    try { audioCtl.suspend(); } catch {}
    const l = document.getElementById('loading');
    if (l) { l.classList.remove('gone'); l.innerHTML = `<div class="egg">🥚</div><div>phone got tired (graphics memory). <a href="#" id="mochi-reload" style="color:#9f9">tap to reload</a></div>`;
      l.querySelector('#mochi-reload')?.addEventListener('click', (ev) => { ev.preventDefault(); location.reload(); }); }
  }, false);
  canvas.addEventListener('webglcontextrestored', () => { location.reload(); }, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(isMobile && innerWidth < innerHeight ? 55 : 42, innerWidth / innerHeight, 0.1, 9000);

  // ── world ──
  const sky = createSky(scene, { hour, cloudy: weather.cloudiness, storm: weather.heavy ? 1 : 0, hq: (Q.tier ?? 2) >= 2 });
  const sun = sky.sun;
  const S = lite ? Math.min(512, Q.shadow) : isMobile ? Math.min((Q.tier ?? 0) >= 1 ? 2048 : 1024, Q.shadow) : Q.shadow; // phones: Medium+ get a 2048 camera-fitted map
  sun.shadow.mapSize.set(S, S); sun.shadow.radius = Q.tier >= 2 ? 5 : 3; sun.shadow.blurSamples = Q.tier >= 2 ? 16 : 8; sun.castShadow = S0.shadows;
  Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 160 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;

  const fogBase = weather.fog ? (weather.heavy ? 0.03 : 0.018) : 0.0006 + (weather.rain || weather.snow ? 0.0012 : 0) + weather.cloudiness * 0.0002;
  scene.fog = new MistFog(0xc6dcec, fogBase);
  const season = seasonOf(new Date(), params.get('season'));
  const snowy = weather.snow || season === 'winter';
  if (aiOn) try { initAITex(Q.tier ?? 2, renderer); } catch (e) { console.warn('ai textures failed', e); }
  if (aiOn && (Q.tier ?? 2) >= 1) setLowMountains(true);
  const land = buildLandscape(scene, { snowy, mobile: isMobile, season, lite, hq: (Q.tier ?? 2) >= 2 });
  let backdrop = null; if (aiOn) try { backdrop = buildBackdrop(scene, { tier: Q.tier ?? 2, weather }); } catch (e) { console.warn('backdrop failed', e); }
  try { land.riverMat?.userData.attachRing?.(backdrop); } catch (e) { /* optional */ }
  const island = buildIsland(scene, { snowy, mobile: isMobile, state, tier: Q.tier ?? 2, detail: lite ? Math.min(S0.detail, 0.45) : S0.detail, season, lite });
  const details = buildDetails(scene, { tier: Q.tier ?? 2, detail: S0.detail, season, snowy, mobile: isMobile, pathD: island.pathD });
  let flowers = null; try { flowers = buildWildflowers(scene, { season, snowy, tier: Q.tier ?? 2, pathD: island.pathD }); } catch (e) { console.warn('wildflowers failed', e); }
  const worldState = buildWorldState(scene, state);
  const wx = createWeather(scene, weather, { mobile: isMobile, particles: S0.particles, season });
  const glow = []; const features = buildFeatures(scene, { state, season, snowy, glow }); try { features.gaming = createGaming(scene, { state, glow, tier: Q.tier ?? 2 }); } catch (e) { console.warn('gaming failed', e); }
  try { features.crush = createCrush(scene, { state, tier: Q.tier ?? 2 }); } catch (e) { console.warn('crush failed', e); }
  try { features.pet = createPet(scene, { state, tier: Q.tier ?? 2 }); } catch (e) { console.warn('pet failed', e); }
  try { features.memories = createMemories(scene, { state, tier: Q.tier ?? 2, crush: features.crush }); } catch (e) { console.warn('memories failed', e); }
  try { features.paper = createPaper(scene, { state, tier: Q.tier ?? 2 }); } catch (e) { console.warn('paper failed', e); }
  try { features.wishes = buildWishes(scene, { features, glow, snowy, mobile: isMobile }); } catch (e) { console.warn('wishlist builds failed', e?.stack || e); features.wishes = null; }
  { const zs = new THREE.Group(); zs.name = 'zone-signs'; scene.add(zs); zoneSigns(zs, ZONES, { groundY, OBSTACLES, BRIDGE }); }

  const mochi = createMochi(state.outfit || '', { style: params.get('mochi') || S0.mochiStyle });
  scene.add(mochi.root);
  const squirrelZone = ZONES.find((z) => z.id === 'squirrel');
  const squirrel = createSquirrel(squirrelZone.pos, { style: params.get('squirrel') || S0.squirrelStyle || 'new' }); scene.add(squirrel.root);
  const elk = createElk(); scene.add(elk.root);
  if (params.get('elk') === '1') elk.start(0.35);
  // soft contact/blob shadows (Medium+): grounds Mochi, critters and props where the shadow map is coarse or the sun is behind
  let blobs = null; if ((Q.tier ?? 0) >= 1 && params.get('blobs') !== '0') try { blobs = createBlobShadows(scene, { strength: (Q.tier ?? 0) >= 2 ? 0.75 : 1 });
    blobs.follow(mochi.root, 0.55); blobs.follow(squirrel.root, 0.22, 0.7); blobs.follow(elk.root, 0.95, 0.75); blobs.statics(PROP_SPOTS.map((sp) => ({ x: sp.x, z: sp.z, r: 0.5 }))); } catch (e) { console.warn('blob shadows', e); }

  // ── post ──
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: lite ? THREE.UnsignedByteType : THREE.HalfFloatType, samples: lite ? 0 : (isMobile ? 0 : Q.msaa) });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  let ao = null; if ((Q.ao || (Q.tier ?? 0) >= 2) && !isMobile) { ao = new GTAOPass(scene, camera, innerWidth, innerHeight); ao.blendIntensity = Q.ao ? 0.9 : 0.7; ao.updateGtaoMaterial({ radius: 0.85, distanceExponent: 1.6, thickness: 1.4, scale: 1.0, samples: Q.ao ? 16 : 10 }); composer.addPass(ao); }
  // sanitize HDR before bloom: one NaN/Inf pixel (e.g. a degenerate normal) otherwise gets blurred across the whole screen
  const sanitize = new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); bvec4 bad = bvec4(!(c.r == c.r) || c.r > 6.5e4, !(c.g == c.g) || c.g > 6.5e4, !(c.b == c.b) || c.b > 6.5e4, !(c.a == c.a)); if (any(bad)) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(min(c.rgb, vec3(32.0)), c.a); }' });
  composer.addPass(sanitize); sanitize.enabled = S0.bloom;
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.45, 0.55, 1.0);
  composer.addPass(bloom); bloom.enabled = S0.bloom; bloom.userData = { sanitize };
  // photo mode depth of field (High/Ultra, desktop or phone): focus follows the orbit target (usually Mochi)
  let bokeh = null; if ((Q.tier ?? 0) >= 2) { bokeh = new BokehPass(scene, camera, { focus: 8, aperture: 0.0016, maxblur: 0.006 }); bokeh.enabled = false; composer.addPass(bokeh); }
  // High/Ultra: screen-space god rays — bright sky / sun pixels smeared radially from the sun's screen position (HDR, before tonemapping)
  let rays = null; if ((Q.tier ?? 0) >= 2 && !lite) { rays = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uK: { value: 0 }, uTint: { value: new THREE.Color(1, 0.9, 0.75) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uK; uniform vec3 uTint; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); if (uK < 0.002) { gl_FragColor = c; return; }
        vec2 d = (uSun - vUv) / 28.0; vec2 p = vUv; float acc = 0.0, w = 1.0; float j = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
        p += d * j; for (int i = 0; i < 28; i++) { p += d; vec3 s = texture2D(tDiffuse, clamp(p, 0.001, 0.999)).rgb; acc += smoothstep(1.1, 2.6, dot(s, vec3(0.3, 0.5, 0.2))) * w; w *= 0.955; }
        float fall = 1.0 - smoothstep(0.0, 0.9, length((vUv - uSun) * vec2(1.0, 0.6)));
        gl_FragColor = vec4(c.rgb + uTint * acc / 28.0 * uK * fall * 1.6, c.a); }` }); rays.enabled = false; composer.addPass(rays); }
  composer.addPass(new OutputPass());
  // High/Ultra: gentle colour grade after tonemapping (vibrance, warm highlights / cool shadows, soft vignette). Low/Medium skip it.
  let grade = null; if ((Q.tier ?? 0) >= 2) { grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uVig: { value: 0.22 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb; float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b)); col = mix(vec3(l), col, 1.0 + 0.18 * (1.0 - (mx - mn)));
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.22); // gentle S-curve: deeper shadows, less milky mid-tones
        col += vec3(0.018, 0.008, -0.012) * smoothstep(0.45, 1.0, l) + vec3(-0.01, 0.0, 0.016) * (1.0 - smoothstep(0.0, 0.35, l));
        vec2 d = vUv - 0.5; col *= 1.0 - uVig * smoothstep(0.35, 0.85, length(d * vec2(1.15, 1.0)));
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a); }` }); composer.addPass(grade); }

  // ── controls ──
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.minDistance = 4; controls.maxDistance = 150;
  controls.maxPolarAngle = Math.PI * 0.475; controls.minPolarAngle = 0.15;
  controls.enablePan = true; controls.screenSpacePanning = true; controls.panSpeed = 0.6;
  controls.autoRotateSpeed = 0.35;
  controls.target.set(2.5, 3.0, -3.4);
  const az = (parseFloat(params.get('az') ?? '72') * Math.PI) / 180, el = (parseFloat(params.get('el') ?? (isMobile ? '16' : '10')) * Math.PI) / 180;
  const wideDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)); // az: compass bearing of the camera from the island
  const wideDist = parseFloat(params.get('dist') ?? (isMobile && innerWidth < innerHeight ? 115 : 84));
  camera.position.copy(controls.target).addScaledVector(wideDir, wideDist);
  let lastInteract = performance.now();
  controls.addEventListener('start', () => { lastInteract = performance.now(); controls.autoRotate = false; follow = false; ui.setFollow(false); });
  controls.addEventListener('end', () => { lastInteract = performance.now(); });

  // keep the pan target near the island
  const clampTarget = () => { const t = controls.target; t.x = THREE.MathUtils.clamp(t.x, -46, 48); t.z = THREE.MathUtils.clamp(t.z, -44, 46); t.y = THREE.MathUtils.clamp(t.y, -3, 6); };

  // ── Mochi brain ──
  const favored = matchZone(state.location) || ZONES[0];
  let life = null; // activity engine (created once music/ui exist)
  const brain = { zone: favored, path: [], wait: 3, speed: 2.1, heading: 0, busy: 0 };
  // the world gets to him (Pino-style): weather + mood nudge how he moves and where he goes
  const moodS = String(state.mood || '').toLowerCase();
  const feel = {
    cold: weather.snow || (weather.tempF != null && weather.tempF <= 35) ? 1 : weather.tempF != null && weather.tempF <= 45 ? 0.45 : /cold|freez|chilly/.test(moodS) ? 0.5 : 0,
    wet: weather.rain ? (weather.heavy ? 1 : 0.7) : 0, wind: weather.wind ? (weather.heavy ? 1 : 0.5) : 0,
    perk: /happy|excit|hype|proud|confident|majestic|joy|giddy/.test(moodS) ? 1 : /sad|tired|sleepy|grump|lonely/.test(moodS) ? -0.6 : 0,
  };
  Object.assign(mochi.mods, { cold: feel.cold, wet: feel.wet, wind: feel.wind, perk: Math.max(0, feel.perk), tired: /tired|sleepy|drowsy|exhaust/.test(moodS) ? 1 : 0 });
  brain.speed *= (1 - 0.15 * feel.cold) * (feel.wet > 0.8 ? 1.15 : 1) * (feel.perk < 0 ? 0.8 : 1);
  const hopRate = Math.max(0.03, 0.12 * (1 - 0.6 * feel.cold) * (1 - 0.4 * feel.wet) * (1 + 0.8 * feel.perk));
  const shelter = feel.wet > 0.5 || weather.heavy ? ['hut', 'shop'] : feel.cold > 0.6 ? ['campfire', 'hut'] : null;
  const sp = favored.spot; mochi.root.position.set(sp[0], groundY(sp[0], sp[1]), sp[1]);
  brain.heading = faceFor(favored, mochi.root.position); mochi.root.rotation.y = brain.heading;

  function faceFor(z, p) {
    if (z.id === 'cliff') return Math.atan2(TRAPPER_DIR.x, TRAPPER_DIR.y);
    if (z.id === 'beach') return Math.PI / 2;
    return Math.atan2(z.pos[0] - p.x, z.pos[1] - p.z);
  }
  function avoid(a, b, depth = 0) {
    if (depth > 3) return [b];
    const ab = b.clone().sub(a); const L = ab.length(); if (L < 0.01) return [b]; const d = ab.clone().divideScalar(L);
    let hit = null, hitT = Infinity;
    for (const o of OBSTACLES) { const c = new THREE.Vector2(o.x, o.z); if (c.distanceTo(a) < o.r + 0.2 || c.distanceTo(b) < o.r + 0.2) continue;
      const t = THREE.MathUtils.clamp(c.clone().sub(a).dot(d), 0, L); const closest = a.clone().addScaledVector(d, t); if (closest.distanceTo(c) < o.r + 0.35 && t < hitT) { hit = o; hitT = t; } }
    if (!hit) return [b];
    const c = new THREE.Vector2(hit.x, hit.z); const perp = new THREE.Vector2(-d.y, d.x); const side = c.clone().sub(a).dot(perp) > 0 ? -1 : 1;
    const wp = c.clone().addScaledVector(perp, side * (hit.r + 0.8));
    return [...avoid(a, wp, depth + 1), ...avoid(wp, b, depth + 1)];
  }
  function planTo(zone) {
    const p = mochi.root.position; const from = new THREE.Vector2(p.x, p.z); const to = new THREE.Vector2(zone.spot[0], zone.spot[1]);
    const bA = new THREE.Vector2(BRIDGE.ax - BRIDGE.dx * 0.8, BRIDGE.az - BRIDGE.dz * 0.8), bB = new THREE.Vector2(BRIDGE.bx + BRIDGE.dx * 0.7, BRIDGE.bz + BRIDGE.dz * 0.7);
    const bp = bridgeParam(p.x, p.z); const here = onIslet(p.x, p.z) || (bp.t > 0 && bp.t < 1 && Math.abs(bp.lat) < 1.2); const there = zone.id === 'beach';
    let pts = [];
    if (here && !there) pts = [bB, bA, ...avoid(bA, to)];
    else if (!here && there) pts = [...avoid(from, bA), bB, to];
    else if (here && there) pts = [to];
    else pts = avoid(from, to);
    life?.cancel(); brain.acted = false;
    brain.path = pts; brain.zone = zone; brain.wait = 0; ui.setActiveZone(zone.id);
  }
  function pickNext() {
    const others = ZONES.filter((z) => z !== brain.zone);
    let z = Math.random() < 0.45 && brain.zone !== favored ? favored : others[Math.floor(Math.random() * others.length)];
    const sug = life && life.suggest(); if (sug) { const sz = ZONES.find((q) => q.id === sug); if (sz) z = sz; }
    if (shelter && Math.random() < 0.5) { const sz = ZONES.find((q) => q.id === shelter[Math.floor(Math.random() * shelter.length)]); if (sz && sz !== brain.zone) z = sz; }
    if (music.playing && Math.random() < 0.2 && brain.zone.id !== 'music') z = ZONES.find((q) => q.id === 'music') || z;
    planTo(z);
  }

  // ── speech bubbles ──
  const bubbleEl = document.createElement('div'); bubbleEl.className = 'bubble'; document.getElementById('bubbles').appendChild(bubbleEl);
  const thoughts = (state.thoughts || []).filter(Boolean);
  let bubbleT = 2.0, bubbleShow = 0, lastThought = -1;
  function say(text, dur = 5.5) { bubbleT = Math.max(bubbleT, dur + 2); bubbleEl.textContent = text; bubbleEl.classList.remove('pop'); void bubbleEl.offsetWidth; bubbleEl.classList.add('show', 'pop'); bubbleShow = dur; }
  function randomThought() { if (!thoughts.length) return; let i; do { i = Math.floor(Math.random() * thoughts.length); } while (thoughts.length > 1 && i === lastThought); lastThought = i; say(thoughts[i]); }
  if (params.has('say')) { const i = parseInt(params.get('say')); if (!isNaN(i) && thoughts[i]) { bubbleT = 999; setTimeout(() => say(thoughts[i], 999), 400); } }

  // ── UI ──
  let follow = params.get('cam') === 'mochi';
  const ui = buildUI(state, weather, {
    error,
    onZone: (id) => { const z = ZONES.find((q) => q.id === id); if (z) { planTo(z); say(`omw to the ${z.name.toLowerCase()}`, 2.5); } },
    onFollow: (on) => { if (on && walk.on) walk.set(false); follow = on; if (on) controls.autoRotate = false; },
    onWalk: () => walk.toggle(),
    onSettings: () => setPanel.toggle(),
    onSongClick: () => music.next(),
    canWalk: true,
    favoredId: favored.id,
  });
  // ── music + settings ──
  const music = createMusic(state, settings);
  audioCtl.suspend = () => music.suspend(); audioCtl.resume = () => music.resume();
  music.onChange((song) => { ui.setSong(song); island.music.setPlaying(!!song); });
  const setPanel = buildSettingsPanel(document.getElementById('ui'), settings, { music });
  settings.on((st, patch) => {
    if ('quality' in patch && QUALITY[st.quality]?.ao && !ao && !isMobile) { ao = new GTAOPass(scene, camera, innerWidth, innerHeight); ao.blendIntensity = 0.85; ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 }); composer.insertPass(ao, 1); }
    if ('quality' in patch && ao) ao.enabled = !!QUALITY[st.quality]?.ao;
    if ('quality' in patch) { const q = QUALITY[st.quality]; const cap = Math.min(q.pr, isMobile ? 1.5 : q.pr); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap)); renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio?.(Math.min(window.devicePixelRatio || 1, cap)); composer.setSize(innerWidth, innerHeight);
      const sz = (q.tier ?? 2) <= 0 ? Math.min(512, q.shadow) : isMobile ? Math.min(1024, q.shadow) : q.shadow; if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); sun.shadow.map?.dispose(); sun.shadow.map = null; } }
    if ('mochiStyle' in patch) mochi.setStyle(st.mochiStyle);
    if ('squirrelStyle' in patch) squirrel.setStyle?.(st.squirrelStyle);
    if ('shadows' in patch) sun.castShadow = st.shadows;
    if ('bloom' in patch) { bloom.enabled = st.bloom; bloom.userData.sanitize.enabled = st.bloom; }
    if ('master' in patch || 'music' in patch || 'sfx' in patch || 'river' in patch || 'mute' in patch) music.applyLevels();
    if ('musicOn' in patch) music.setEnabled(st.musicOn);
    if ('autoRotate' in patch && !st.autoRotate) controls.autoRotate = false;
  });
  // ── walk mode (WASD + mouse look); orbit/follow come back when it's off ──
  const walk = createWalk({ camera, dom: renderer.domElement, isOpen: () => !document.getElementById('lightbox')?.hidden,
    sens: () => settings.get().lookSens, showHint: () => settings.get().walkHint, onStep: () => music.sfx('step'), onInteract: () => interactNear(),
    onChange: (on) => {
      ui.setWalk(on); controls.enabled = !on; controls.autoRotate = false; lastInteract = performance.now();
      if (on) { follow = false; ui.setFollow(false); }
      else { const d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = Math.max(d.y, -0.35); controls.target.copy(camera.position).addScaledVector(d.normalize(), 7); clampTarget(); camera.up.set(0, 1, 0); controls.update(); }
    } });
  ui.setActiveZone(favored.id); ui.setFollow(follow);

  // ── life: activities, inventory, garden, fishing, laptop (Pino-style chains) ──
  const EM = { worms: '🪱', honey: '🍯', shells: '🐚', firewood: '🪵', acorns: '🌰', caps: '🧢' };
  const bagText = (inv) => { const f = Object.values(inv.fish).reduce((a, b) => a + b, 0), c = Object.values(inv.cooked).reduce((a, b) => a + b, 0), cr = Object.values(inv.crops).reduce((a, b) => a + b, 0);
    return [inv.worms && `🪱${inv.worms}`, f && `🐟${f}`, c && `🍢${c}`, cr && `🥕${cr}`, inv.caps && `🧢${inv.caps}`, inv.trinkets.length && `🎁${inv.trinkets.length}`].filter(Boolean).join(' '); };
  let lifeDirty = 1;
  life = createLife({ state, mochi, features, say: (s, d) => say(s, d), music, sky, feel, onChange: (inv, log, label) => { if (label !== undefined) ui.setDoing(label, bagText(inv)); else ui.setDoing(life?.label || '', bagText(inv)); lifeDirty = 1; } });
  ui.setDoing('', bagText(life.inv));
  const critters = createCritters(scene, { owlBox: features.wishes?.owlBox, lights: island.lights || [], life, say: (s, d) => say(s, d), music, season });
  if (Array.isArray(state.encounters)) life.encounters.push(...state.encounters.filter((e) => e && e.animal).slice(-30));
  const wild = createWildlife(scene, { state, mochi, life, features, say: (s, d) => say(s, d), music, sky, brain, settings, season, encounters: life.encounters,
    go: (id, act) => { const z = ZONES.find((q) => q.id === id); if (!z) return; planTo(z); if (act) life.interact(id); }, onChange: () => { lifeDirty = 1; } });
  if (params.get('event')) setTimeout(() => wild.startEvent(params.get('event').toLowerCase(), params.get('at') || 'bank'), 4000);
  const wish = applyWishBuilt(Array.isArray(state.wishlist) ? state.wishlist : []);
  function lifeHtml() {
    const inv = life.inv; const kv = (o, fmt = (k) => k) => Object.entries(o).filter(([, v]) => v > 0).map(([k, v]) => `<span>${esc(fmt(k))} ×${v}</span>`).join('') || '<span>—</span>';
    const stg = ['bare', 'sprout', 'leafy', 'budding', 'ripe!'];
    const lap = state.laptop || {}; const mail = Array.isArray(state.mail) ? state.mail : [];
    return `<div class="life"><h5>Bag</h5><div class="chips">${Object.entries(EM).map(([k, e]) => `<span>${e} ${k} ×${inv[k] || 0}</span>`).join('')}</div>
      <h5>Fish bucket</h5><div class="chips">${kv(inv.fish, (k) => FISH[k]?.name || k)}</div><h5>Cooked</h5><div class="chips">${kv(inv.cooked)}</div>
      <h5>Seeds · crops</h5><div class="chips">${kv({ ...Object.fromEntries(Object.entries(inv.seeds).map(([k, v]) => [k + ' seeds', v])), ...inv.crops })}</div>${inv.trinkets.length ? `<h5>Trinkets</h5><div class="chips">${inv.trinkets.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
      <h5>Garden (${esc(season)})</h5>${life.plots.map((p) => `<div class="row2">${esc(p.crop || 'empty')}<em>${p.crop ? stg[Math.min(4, p.stage)] : 'needs seeds'}</em></div>`).join('')}
      <h5>Fish log · Bitterroot</h5>${life.fishLog.slice(-8).reverse().map((f) => `<div class="row2">${esc(FISH[f.species]?.name || f.species)}${f.inches ? ` · ${f.inches}"` : ''}<em>${esc(f.kept ? 'kept' : 'released')}${f.date ? ' · ' + esc(f.date) : ''}</em></div>`).join('') || '<div class="row2">no fish yet<em>worms → dock</em></div>'}
      <h5>Laptop</h5><div class="row2">${esc(lap.site || lap.browsing?.[lap.browsing.length - 1] || 'off')}<em>${esc(lap.screen || lap.last || '')}</em></div>
      <h5>Mail</h5>${mail.slice(-5).reverse().map((m) => `<div class="row2">${m.unread || m.read === false ? '🔴 ' : ''}${esc(m.from || 'someone')}<em>${esc(m.subject || m.text || '')}</em></div>`).join('') || '<div class="row2">mailbox empty<em>flag down</em></div>'}
      <h5>Courage</h5><div class="row2">🦸 ${wild.courage}/100<em>${wild.courage >= 70 ? 'ranger energy' : wild.courage >= 45 ? 'steady' : 'a little shaky'}</em></div>
      <h5>Wildlife encounters</h5>${life.encounters.slice(-6).reverse().map((e) => `<div class="row2">${esc(e.animal)}${e.at ? ' · ' + esc(e.at) : ''}<em>${esc(e.outcome || '')}${e.date ? ' · ' + esc(e.date) : ''}</em></div>`).join('') || '<div class="row2">none yet<em>keep an eye on the far bank</em></div>'}
      ${wish.length ? `<h5>Wishlist</h5>${wish.map((w) => `<div class="row2">${esc(w.item || w.name || w)}<span class="st ${esc(String(w.status || '').split(' ')[0])}">${esc(w.status || 'wish')}${w.note ? ' · ' + esc(w.note) : ''}</span></div>`).join('')}` : ''}</div>`;
  }
  // E key in walk mode: send Mochi to do the nearest thing
  const zoneNear = () => { const c = camera.position; let best = null, bd = 7; for (const z of ZONES) { if (!life.BY_ZONE[z.id]) continue; const d = Math.hypot(z.pos[0] - c.x, z.pos[1] - c.z); if (d < bd) { bd = d; best = z; } } return best; };
  function interactNear() { const z = zoneNear(); if (!z) return; planTo(z); life.interact(z.id); const a = life.A[life.BY_ZONE[z.id][0]]; music.sfx('click'); say(`ooh ok: ${a ? a.label.replace(/^\S+\s/, '') : z.name.toLowerCase()}`, 2.5); }
  addEventListener('keydown', (e) => { if ((e.key === 'e' || e.key === 'E') && walk.on && !e.repeat) interactNear(); });
  let promptT = 0;
  if (life.initialZone && life.initialZone !== favored.id) setTimeout(() => { const z = ZONES.find((q) => q.id === life.initialZone); if (z) planTo(z); }, 1500);
  else brain.wait = 1.2;
  if (params.get('ui') === '0') document.getElementById('ui').style.display = 'none';

  // ── stage C: raft trips + finds, friends, radio ──
  let adv = null;
  try { adv = createAdventures(scene, { life, mochi, say: (s, d) => say(s, d), music, getWild: () => wild, features, ui, state }); } catch (e) { console.warn('adventures failed', e); }
  // ── stage D: shooting range + Gun-O-Matic ──
  let range = null;
  try { range = createRange(scene, { life, mochi, say: (s, d) => say(s, d), music, state, getWild: () => wild }); } catch (e) { console.warn('range failed', e); }
  // ── temporary stake signs (Mochi + the squirrel) ──
  let tempSigns = null;
  try { tempSigns = createTempSigns(scene, { state, island, life, mochi, say: (s, d) => say(s, d), music, squirrel, squirrelPos: squirrelZone.pos }); } catch (e) { console.warn('temp signs failed', e); }
  // ── gfx pass 2: CC0 photo detail (ground/rock triplanar, bark + wood normals), Medium+ only ──
  let pbrInfo = null;
  try { patchFoliage(scene, Q.tier ?? 2); } catch (e) { console.warn('foliage failed', e); }
  // ── HDRI environment light (Poly Haven CC0 pure-sky HDRIs, sun disc clipped; Medium 256px, High+ 512px) ──
  // our own sky dome stays the background; the HDRI only feeds image-based light + reflections, faded with day/night + clouds
  const envMaps = {}; let envInfo = null;
  if ((Q.tier ?? 2) >= 1 && params.get('hdri') !== '0') {
    const res = (Q.tier ?? 2) >= 2 ? 512 : 256; const pm = new THREE.PMREMGenerator(renderer); const hl = new HDRLoader(); const base = import.meta.env.BASE_URL || './';
    Promise.all(['day', 'golden'].map((n) => hl.loadAsync(`${base}hdri/${n}_${res}.hdr`).then((tx) => { envMaps[n] = pm.fromEquirectangular(tx).texture; tx.dispose(); })))
      .then(() => { pm.dispose(); envInfo = { res }; skyTimer = 0; }).catch((e) => console.warn('hdri failed', e));
  }
  function applyEnv() {
    if (!envMaps.day) return; const st = sky.state; const day = 1 - st.night;
    scene.environment = st.golden > 0.45 && envMaps.golden ? envMaps.golden : envMaps.day;
    scene.environmentIntensity = Math.max(0.04, day * (0.62 - weather.cloudiness * 0.22) * (weather.rain || weather.snow ? 0.8 : 1));
    const a = Math.atan2(st.lightDir.z, st.lightDir.x); scene.environmentRotation.y = a - (scene.environment === envMaps.golden ? 0.63 : 0.6);
    sky.hemi.intensity *= 1 - 0.35 * day; // the HDRI now carries part of the sky fill
  }
  // ── real pass: CC0 glTF trees / rocks / logs / fire pit (Medium+, ?real=0 to compare) ──
  let realInfo = null;
  if (params.get('real') !== '0' && (Q.tier ?? 2) >= 1) try { upgradeWorld(scene, { tier: Q.tier ?? 2, season, snowy, renderer, onDone: (i) => { realInfo = i; } }); } catch (e) { console.warn('real pass failed', e); }
  if (params.get('pbr') !== '0') try { applyPBR(scene, { tier: Q.tier ?? 2, renderer })?.then((r) => { pbrInfo = r; }); } catch (e) { console.warn('pbr failed', e); }
  // ── stage B: night sky + water polish + live weather refresh ──
  let nightSky = null, waterFx = null;
  try { nightSky = createNightSky(scene, { weather, season, mochi, say: (s, d) => say(s, d), force: params.get('aurora') === '1' ? 'aurora' : params.get('star') === '1' ? 'star' : null,
    log: (e) => { life.encounters.push({ ...e, date: new Date().toLocaleDateString('en-CA') }); lifeDirty = 1; } }); } catch (e) { console.warn('night sky failed', e); }
  try { waterFx = createWaterFx(scene, { lights: [...(island.lights || []), ...(features.lanternLight ? [{ l: features.lanternLight }] : [])], mobile: isMobile, music }); } catch (e) { console.warn('water fx failed', e); }
  if (!params.get('weather') && params.get('live') !== '0') startLiveWeather((w) => { state.weather = w.text; const el = document.querySelector('#ui .loc span'); if (el) el.textContent = w.text; if (w.tempF != null) { feel.cold = w.tempF <= 35 ? 1 : w.tempF <= 45 ? 0.45 : 0; mochi.mods.cold = feel.cold; } });
  // ── stage A: photo mode, petting, snacks ──
  let extras = null;
  try { extras = createExtras({ scene, camera, renderer, renderNow: () => composer.render(0), mochi, music, say: (s, d) => say(s, d), feel,
    onPhoto: (on) => { if (on) { if (walk.on) walk.set(false); follow = false; ui.setFollow(false); controls.autoRotate = false; } } }); } catch (e) { console.warn('extras failed', e); }
  // ── click / tap Mochi ──
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt) return; const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); const dt = performance.now() - downAt[2]; downAt = null;
    if (moved > 8 || dt > 500) return;
    if (document.pointerLockElement === renderer.domElement) ndc.set(0, 0); else ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(mochi.hit, false).length) { brain.busy = 0.9; if (extras) extras.pet(); else { mochi.hop(0.85); music.sfx('hop'); if (Math.random() < 0.8) randomThought(); } return; }
    if (adv?.tap(ray)) { brain.busy = 0.5; return; }
    if (features.memories?.tap(ray) || features.paper?.tap(ray) || features.mailNotes?.tap(ray)) { if (document.pointerLockElement) document.exitPointerLock(); music.sfx('click'); brain.busy = 0.5; return; }
    // click a hung picture -> open it in the gallery lightbox
    const hit = ray.intersectObjects(island.clickables, false)[0];
    if (hit && hit.distance < 40 && hit.object.userData.artIndex != null) { if (document.pointerLockElement) document.exitPointerLock(); music.sfx('click'); ui.openArt(hit.object.userData.artIndex); }
  });

  // start camera from settings (URL params win)
  if (!params.has('cam') && !params.has('walk')) { if (S0.startCam === 'follow') { follow = true; ui.setFollow(true); } }
  // close-up framing
  if (follow) {
    const p = mochi.root.position; const yaw0 = brain.heading + parseFloat(params.get('camyaw') || '0'); const f = new THREE.Vector3(Math.sin(yaw0), 0, Math.cos(yaw0));
    controls.target.set(p.x, p.y + 0.7, p.z);
    camera.position.copy(controls.target).addScaledVector(f, 4.4).add(new THREE.Vector3(-f.z * 1.9, 1.2, f.x * 1.9));
  }

  // Android Chrome fires resize often when the URL bar shows/hides — only reallocate when size actually changes, debounced.
  let rzW = innerWidth, rzH = innerHeight, rzT = 0;
  function applySize() {
    const w = Math.max(1, innerWidth | 0), h = Math.max(1, innerHeight | 0);
    if (w === rzW && h === rzH) return;
    rzW = w; rzH = h;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; /* rotate portrait <-> landscape: the canvas box has to follow too */
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
  }
  const onRz = () => { clearTimeout(rzT); rzT = setTimeout(applySize, 180); };
  window.addEventListener('resize', onRz);
  try { visualViewport?.addEventListener('resize', onRz); visualViewport?.addEventListener('scroll', onRz); } catch {}

  // ── loop ──
  let lastNow = performance.now(); let t = 0, frames = 0, skyTimer = 0; let raf = 0;
  const head = new THREE.Vector3(); const fogCol = new THREE.Color();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      paused = true;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      try { audioCtl.suspend(); } catch {}
    } else if (paused) {
      paused = false; lastNow = performance.now(); try { audioCtl.resume(); } catch {}
      if (!raf) raf = requestAnimationFrame(frame);
    }
  });
  const debugEl = params.get('debug') === '1' ? Object.assign(document.createElement('div'), { id: 'mochi-debug' }) : null;
  let debugAcc = 0, debugN = 0, debugPeak = 0;
  if (debugEl) { debugEl.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;font:11px/1.35 ui-monospace,Menlo,monospace;background:rgba(0,0,0,.7);color:#9f9;padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre;max-width:46vw'; document.body.appendChild(debugEl); }
  sky.update(0);
  function frame() {
    raf = 0;
    if (paused || document.hidden) { raf = 0; return; }
    try { frameBody(); } catch (e) { console.warn('frame error (skipped)', e); }
    if (!raf && !paused && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const _sunV = new THREE.Vector3(), _sunF = new THREE.Vector3();
  function frameBody() {
    const now = performance.now(); const dt = Math.min((now - lastNow) / 1000, 0.05); lastNow = now; t += dt; ENV.uTime.value = t;
    skyTimer -= dt; if (skyTimer <= 0) { sky.update(t); skyTimer = 2; applyEnv(); }
    if (bokeh) { bokeh.enabled = !!extras?.photo; if (bokeh.enabled) bokeh.uniforms.focus.value = camera.position.distanceTo(follow ? mochi.root.position : controls.target); }
    const night = sky.state.night;
    fogCol.copy(sky.state.fogColor); scene.fog.color.copy(fogCol); backdrop?.update(sky.state, camera.position);
    // dawn/dusk valley mist (more in the morning), a little at night, lots in foggy weather
    scene.fog.mist = sky.state.golden * (new Date().getHours() < 12 || (hour != null && hour < 12) ? 0.75 : 0.45) + night * 0.12 + (weather.fog ? 0.35 : 0);
    renderer.toneMappingExposure = EXPO * (1 + night * 0.3);
    ENV.uRim.value = night; updateSigns(night); details.update(sky);
    if (features.lanternLight) features.lanternLight.intensity = night * 2.4; { const w = 0.4 + ENV.uWind.value * 2; if (features.sock) features.sock.rotation.y = Math.sin(t * 1.7) * 0.45 * w; if (features.flag) features.flag.rotation.y = Math.sin(t * 3.1) * 0.35 * w; if (features.pulley) features.pulley.rotation.z = Math.sin(t * 1.3) * 0.06 * w; }
    // tight shadow box that follows what you're looking at (crisper, softer-edged shadows)
    { const c = walk.on ? camera.position : follow ? mochi.root.position : controls.target; const hiS = (Q.tier ?? 0) >= 2; const span = walk.on || follow ? (hiS ? 13 : 15) : THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * (hiS ? 0.4 : 0.45), hiS ? 13 : 14, 46);
      const sc = sun.shadow.camera; if (sc.right !== span) { sc.left = sc.bottom = -span; sc.right = sc.top = span; sc.updateProjectionMatrix(); }
      const tex = (2 * span) / sun.shadow.mapSize.x;
      // bias + softness scale with the texel size: no acne when the box is wide, no peter-panning when it's tight; ~constant world-space penumbra
      sun.shadow.normalBias = tex * 1.6; sun.shadow.bias = -0.00025; sun.shadow.radius = THREE.MathUtils.clamp((hiS ? 0.05 : 0.07) / tex, 2, hiS ? 9 : 5); const cx = Math.round(c.x / tex) * tex, cz = Math.round(c.z / tex) * tex;
      sun.target.position.set(cx, 0, cz); sun.position.copy(sky.state.lightDir).multiplyScalar(70).add(sun.target.position); sun.target.updateMatrixWorld(); }
    land.winMat.color.setRGB(0.25 + 3.5 * night, 0.18 + 2.4 * night, 0.1 + 1.0 * night);
    bloom.strength = 0.26 + night * 0.54; bloom.threshold = 1.0 + (1 - night) * 0.45; // day: only the sun disc / glints bloom, not the whole bright sky
    if (rays) { const sd = sky.state.sunDir; const sp = _sunV.copy(sd).multiplyScalar(3000).add(camera.position).project(camera); const fwd = camera.getWorldDirection(_sunF).dot(sd);
      const on = fwd > 0.1 && sp.x > -1.4 && sp.x < 1.4 && sp.y > -1.4 && sp.y < 1.4 ? (1 - night) * THREE.MathUtils.smoothstep(sd.y, -0.02, 0.08) * (1 - (weather.cloudiness || 0) * 0.6) * (weather.fog ? 0.3 : 1) : 0;
      rays.enabled = on > 0.01; rays.uniforms.uK.value = on * (0.3 + sky.state.golden * 0.45) * THREE.MathUtils.smoothstep(1.4 - Math.max(Math.abs(sp.x), Math.abs(sp.y)), 0, 0.7); /* fade out as the sun leaves the frame */ rays.uniforms.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5); rays.uniforms.uTint.value.copy(sun.color); }
    PBR_UNIFORMS.uSunW.value.copy(sky.state.lightDir); PBR_UNIFORMS.uSunC.value.copy(sun.color).multiplyScalar(Math.min(1.5, sun.intensity) * (1 - night));

    // brain
    let moving = 0;
    const WL = wild.lock;
    if (WL) { // wildlife standoff: stop, face it, watch nervously
      if (life.current) life.cancel(); brain.path = [];
      let dh = WL.face - brain.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); brain.heading += dh * Math.min(1, dt * 4); brain.wait = Math.max(brain.wait, 4); brain.acted = true;
    }
    else if (brain.busy > 0) brain.busy -= dt;
    else if (life.current) {
      // doing an activity: life moves/poses him; face where it says
      const p0x = mochi.root.position.x, p0z = mochi.root.position.z; life.update(dt, t);
      if (Math.hypot(mochi.root.position.x - p0x, mochi.root.position.z - p0z) > dt * 0.3) moving = 1;
      const want = life.face ?? mochi.root.userData.faceTo ?? brain.heading; let dh = want - brain.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); brain.heading += dh * Math.min(1, dt * 5);
      if (!life.current) { brain.wait = 1.5 + Math.random() * 3; mochi.root.userData.faceTo = null; }
    }
    else if (brain.path.length) {
      const p = mochi.root.position; const tgt = brain.path[0]; const dx = tgt.x - p.x, dz = tgt.y - p.z; const d = Math.hypot(dx, dz);
      if (d < 0.12) { brain.path.shift(); if (!brain.path.length) { brain.wait = 5 + Math.random() * 7; if (brain.zone === favored) brain.wait += 6; if (Math.random() < 0.6) bubbleT = Math.min(bubbleT, 0.8); } }
      else {
        const want = Math.atan2(dx, dz); let dh = want - brain.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); brain.heading += dh * Math.min(1, dt * 7);
        const step = Math.min(d, brain.speed * dt * (Math.abs(dh) > 1.2 ? 0.3 : 1)); p.x += Math.sin(brain.heading) * step; p.z += Math.cos(brain.heading) * step; moving = 1;
      }
    } else {
      if (!brain.acted && params.get('stay') !== '1' && params.get('act') !== '0') { brain.acted = true; if (life.begin(brain.zone.id)) bubbleT = Math.max(bubbleT, 4); }
      brain.wait -= dt;
      const want = faceFor(brain.zone, mochi.root.position) + Math.sin(t * 0.4) * 0.35; let dh = want - brain.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); brain.heading += dh * Math.min(1, dt * 2.5);
      const jam = brain.zone.id === 'music' && music.playing ? 3 : 1;
      if (Math.random() < dt * hopRate * jam) mochi.hop((0.4 + Math.random() * 0.4) * (1 - 0.3 * feel.cold)); else if (Math.random() < dt * 0.1 * (1 - 0.5 * feel.cold)) mochi.flap(0.8);
      if (brain.wait < 0 && params.get('stay') !== '1') pickNext();
    }
    if (!life.current) life.update(dt, t);
    { const ry = life.rideY, mp = mochi.root.position; mp.y = (ry ? ry(mp.x, mp.z) : groundY(mp.x, mp.z)) + life.lift; }
    mochi.root.rotation.y = brain.heading;
    mochi.update(dt, moving); extras?.update(dt); nightSky?.update(t, dt, sky.state.night || 0, camera);
    squirrel.update(dt); elk.update(dt, t); blobs?.update();
    island.update(t, dt, night); worldState.update(night); features.update(t, dt, night); features.gaming?.update(t, dt, night); features.crush?.update(t, dt, night, mochi.root.position); features.pet?.update(t, dt, night, mochi.root.position, moving); features.wishes?.update(t, dt, night); waterFx?.update(t, dt, night, camera); adv?.update(t, dt); range?.update(t, dt, night); tempSigns?.update(t, dt); critters.update(t, dt, night, sky.state.golden || 0); wild.update(t, dt, night);
    for (const g of glow) g.m.emissiveIntensity = g.day + (g.night - g.day) * night;
    if (lifeDirty && document.querySelector('#pane-life')) { lifeDirty = 0; ui.renderLife(lifeHtml()); }
    promptT -= dt; if (promptT < 0) { promptT = 0.25; const z = walk.on ? zoneNear() : null; ui.setPrompt(z ? `E · ${life.A[life.BY_ZONE[z.id][0]]?.label || z.name}` : ''); } wx.update(t, dt, night, sun, sky.hemi);

    // bubble
    bubbleT -= dt; if (bubbleT < 0) { randomThought(); bubbleT = 9 + Math.random() * 7; }
    if (bubbleShow > 0) { bubbleShow -= dt; if (bubbleShow <= 0) bubbleEl.classList.remove('show'); }
    head.copy(mochi.root.position); head.y += mochi.headOffset + mochi.pivot.position.y; head.project(camera);
    const behind = head.z > 1; bubbleEl.style.transform = `translate(${(head.x * 0.5 + 0.5) * innerWidth}px, ${(-head.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
    bubbleEl.style.visibility = behind ? 'hidden' : 'visible';
    { // keep the bubble below the top status chip (desktop) so they never overlap
      const by = (-head.y * 0.5 + 0.5) * innerHeight; const minY = (innerWidth > 640 ? 52 : 70) + bubbleEl.offsetHeight; if (by < minY) bubbleEl.style.transform = `translate(${(head.x * 0.5 + 0.5) * innerWidth}px, ${minY}px) translate(-50%, -100%)`; }

    // camera
    if (walk.on) walk.update(dt);
    else {
      if (follow) { const p = mochi.root.position; controls.target.lerp(new THREE.Vector3(p.x, p.y + 0.7, p.z), Math.min(1, dt * 3)); }
      if (!follow && performance.now() - lastInteract > 9000 && params.get('rotate') !== '0' && settings.get().autoRotate) controls.autoRotate = true;
      clampTarget(); controls.update(dt);
    }
    composer.render(dt);
    frames++;
    if (frames === 3) { document.getElementById('loading').classList.add('gone'); window.__mochiReady = true; if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch((e) => console.info('sw not registered', e?.message)); }
    if (debugEl) {
      debugAcc += dt; debugN++;
      if (debugAcc >= 0.5) {
        const fps = debugN / debugAcc; debugN = 0; debugAcc = 0;
        const mem = renderer.info.memory, ren = renderer.info.render;
        let objs = 0; scene.traverse(() => { objs++; });
        if (objs > debugPeak) debugPeak = objs;
        const heap = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)}MB` : '—';
        debugEl.textContent = `fps ${fps.toFixed(0)}  heap ${heap}\ngeo ${mem.geometries}  tex ${mem.textures}\ncalls ${ren.calls}  tris ${ren.triangles}\nscene ${objs} (peak ${debugPeak})  wild ${wild.live.length}\naudioLive ${music.liveNodes}  song ${music.current?.title || '—'}`;
      }
    }
    raf = requestAnimationFrame(frame);
  }
  if (params.get('walk') === '1' || (!params.has('cam') && !params.has('walk') && S0.startCam === 'walk')) walk.set(true);
  raf = requestAnimationFrame(frame);
  window.__mochi = { flowers, squirrel, AI_INFO, get backdrop() { return backdrop; }, get pbrInfo() { return pbrInfo; }, get realInfo() { return realInfo; }, get envInfo() { return envInfo; }, tempSigns, range, adv, extras, nightSky, waterFx, wild, ui, life, features, critters, season, brain, mochi, planTo, ZONES, say, controls, camera, sky, walk, island, worldState, music, settings, feel, renderer, scene, composer };
}

init().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading'); if (l) l.innerHTML = `<div class="egg">🥚</div><div>mochi tripped over something: ${String(e.message || e)}</div>`;
});
