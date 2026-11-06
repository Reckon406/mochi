import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';
import { ENV } from './water.js';
import { createSky } from './sky.js';
import { buildLandscape, TRAPPER_DIR } from './landscape.js';
import { buildIsland } from './island.js';
import { createMochi } from './mochi.js';
import { createSquirrel, createElk } from './creatures.js';
import { parseWeather, createWeather } from './weather.js';
import { ZONES, matchZone, groundY, onIslet, BRIDGE, bridgeParam, OBSTACLES, CLIFF } from './layout.js';
import { buildUI } from './ui.js';
import { createWalk } from './controls.js';
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

async function init() {
  const { state, error } = await loadState();
  if (params.get('weather')) state.weather = params.get('weather');
  if (params.get('location')) state.location = params.get('location');
  if (params.get('outfit')) state.outfit = params.get('outfit');
  const hour = params.has('hour') ? parseFloat(params.get('hour')) : null;
  const weather = parseWeather(state.weather);
  const settings = createSettings(); const S0 = settings.get(); const Q = QUALITY[S0.quality];

  // ── renderer ──
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // r18x: PCFSoftShadowMap was folded into PCF + shadow.radius (soft Vogel-disk filtering)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(isMobile && innerWidth < innerHeight ? 55 : 42, innerWidth / innerHeight, 0.1, 9000);

  // ── world ──
  const sky = createSky(scene, { hour, cloudy: weather.cloudiness, storm: weather.heavy ? 1 : 0 });
  const sun = sky.sun;
  const S = isMobile ? Math.min(1024, Q.shadow) : Q.shadow;
  sun.shadow.mapSize.set(S, S); sun.shadow.radius = 4; sun.shadow.blurSamples = 12; sun.castShadow = S0.shadows;
  Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 160 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;

  const fogBase = weather.fog ? (weather.heavy ? 0.03 : 0.018) : 0.0006 + (weather.rain || weather.snow ? 0.0012 : 0) + weather.cloudiness * 0.0002;
  scene.fog = new THREE.FogExp2(0xc6dcec, fogBase);
  const land = buildLandscape(scene, { snowy: weather.snow, mobile: isMobile });
  const island = buildIsland(scene, { snowy: weather.snow, mobile: isMobile, state, detail: S0.detail });
  const worldState = buildWorldState(scene, state);
  const wx = createWeather(scene, weather, { mobile: isMobile, particles: S0.particles });

  const mochi = createMochi(state.outfit || '');
  scene.add(mochi.root);
  const squirrelZone = ZONES.find((z) => z.id === 'squirrel');
  const squirrel = createSquirrel(squirrelZone.pos); scene.add(squirrel.root);
  const elk = createElk(); scene.add(elk.root);
  if (params.get('elk') === '1') elk.start(0.35);

  // ── post ──
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: isMobile ? 0 : Q.msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.45, 0.55, 1.0);
  composer.addPass(bloom); bloom.enabled = S0.bloom;
  composer.addPass(new OutputPass());

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
  const wideDist = parseFloat(params.get('dist') ?? (isMobile && innerWidth < innerHeight ? 100 : 72));
  camera.position.copy(controls.target).addScaledVector(wideDir, wideDist);
  let lastInteract = performance.now();
  controls.addEventListener('start', () => { lastInteract = performance.now(); controls.autoRotate = false; follow = false; ui.setFollow(false); });
  controls.addEventListener('end', () => { lastInteract = performance.now(); });

  // keep the pan target near the island
  const clampTarget = () => { const t = controls.target; t.x = THREE.MathUtils.clamp(t.x, -34, 40); t.z = THREE.MathUtils.clamp(t.z, -36, 34); t.y = THREE.MathUtils.clamp(t.y, -3, 6); };

  // ── Mochi brain ──
  const favored = matchZone(state.location) || ZONES[0];
  const brain = { zone: favored, path: [], wait: 3, speed: 2.1, heading: 0, busy: 0 };
  // the world gets to him (Pino-style): weather + mood nudge how he moves and where he goes
  const moodS = String(state.mood || '').toLowerCase();
  const feel = {
    cold: weather.snow || (weather.tempF != null && weather.tempF <= 35) ? 1 : weather.tempF != null && weather.tempF <= 45 ? 0.45 : /cold|freez|chilly/.test(moodS) ? 0.5 : 0,
    wet: weather.rain ? (weather.heavy ? 1 : 0.7) : 0, wind: weather.wind ? (weather.heavy ? 1 : 0.5) : 0,
    perk: /happy|excit|hype|proud|confident|majestic|joy|giddy/.test(moodS) ? 1 : /sad|tired|sleepy|grump|lonely/.test(moodS) ? -0.6 : 0,
  };
  Object.assign(mochi.mods, { cold: feel.cold, wet: feel.wet, wind: feel.wind, perk: Math.max(0, feel.perk) });
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
    brain.path = pts; brain.zone = zone; brain.wait = 0; ui.setActiveZone(zone.id);
  }
  function pickNext() {
    const others = ZONES.filter((z) => z !== brain.zone);
    let z = Math.random() < 0.45 && brain.zone !== favored ? favored : others[Math.floor(Math.random() * others.length)];
    if (shelter && Math.random() < 0.5) { const sz = ZONES.find((q) => q.id === shelter[Math.floor(Math.random() * shelter.length)]); if (sz && sz !== brain.zone) z = sz; }
    if (music.playing && Math.random() < 0.2 && brain.zone.id !== 'music') z = ZONES.find((q) => q.id === 'music') || z;
    planTo(z);
  }

  // ── speech bubbles ──
  const bubbleEl = document.createElement('div'); bubbleEl.className = 'bubble'; document.getElementById('bubbles').appendChild(bubbleEl);
  const thoughts = (state.thoughts || []).filter(Boolean);
  let bubbleT = 2.0, bubbleShow = 0, lastThought = -1;
  function say(text, dur = 5.5) { bubbleEl.textContent = text; bubbleEl.classList.remove('pop'); void bubbleEl.offsetWidth; bubbleEl.classList.add('show', 'pop'); bubbleShow = dur; }
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
    canWalk: !matchMedia('(pointer: coarse)').matches,
    favoredId: favored.id,
  });
  // ── music + settings ──
  const music = createMusic(state, settings);
  music.onChange((song) => { ui.setSong(song); island.music.setPlaying(!!song); });
  const setPanel = buildSettingsPanel(document.getElementById('ui'), settings, { music });
  settings.on((st, patch) => {
    if ('quality' in patch) { const q = QUALITY[st.quality]; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr)); renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio?.(Math.min(window.devicePixelRatio || 1, q.pr)); composer.setSize(innerWidth, innerHeight);
      const sz = isMobile ? Math.min(1024, q.shadow) : q.shadow; if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); sun.shadow.map?.dispose(); sun.shadow.map = null; } }
    if ('shadows' in patch) sun.castShadow = st.shadows;
    if ('bloom' in patch) bloom.enabled = st.bloom;
    if ('master' in patch || 'music' in patch || 'sfx' in patch || 'mute' in patch) music.applyLevels();
    if ('musicOn' in patch) music.setEnabled(st.musicOn);
    if ('autoRotate' in patch && !st.autoRotate) controls.autoRotate = false;
  });
  // ── walk mode (WASD + mouse look); orbit/follow come back when it's off ──
  const walk = createWalk({ camera, dom: renderer.domElement, isOpen: () => !document.getElementById('lightbox')?.hidden,
    sens: () => settings.get().lookSens, showHint: () => settings.get().walkHint, onStep: () => music.sfx('step'),
    onChange: (on) => {
      ui.setWalk(on); controls.enabled = !on; controls.autoRotate = false; lastInteract = performance.now();
      if (on) { follow = false; ui.setFollow(false); }
      else { const d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = Math.max(d.y, -0.35); controls.target.copy(camera.position).addScaledVector(d.normalize(), 7); clampTarget(); camera.up.set(0, 1, 0); controls.update(); }
    } });
  ui.setActiveZone(favored.id); ui.setFollow(follow);
  if (params.get('ui') === '0') document.getElementById('ui').style.display = 'none';

  // ── click / tap Mochi ──
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt) return; const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); const dt = performance.now() - downAt[2]; downAt = null;
    if (moved > 8 || dt > 500) return;
    if (document.pointerLockElement === renderer.domElement) ndc.set(0, 0); else ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(mochi.hit, false).length) { mochi.hop(0.85); brain.busy = 0.7; music.sfx('hop'); if (Math.random() < 0.8) randomThought(); return; }
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

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  });

  // ── loop ──
  let lastNow = performance.now(); let t = 0, frames = 0, skyTimer = 0; const head = new THREE.Vector3(); const fogCol = new THREE.Color();
  sky.update(0);
  function frame() {
    const now = performance.now(); const dt = Math.min((now - lastNow) / 1000, 0.05); lastNow = now; t += dt; ENV.uTime.value = t;
    skyTimer -= dt; if (skyTimer <= 0) { sky.update(t); skyTimer = 2; }
    const night = sky.state.night;
    fogCol.copy(sky.state.fogColor); scene.fog.color.copy(fogCol);
    land.winMat.color.setRGB(0.25 + 3.5 * night, 0.18 + 2.4 * night, 0.1 + 1.0 * night);
    bloom.strength = 0.35 + night * 0.45;

    // brain
    let moving = 0;
    if (brain.busy > 0) brain.busy -= dt;
    else if (brain.path.length) {
      const p = mochi.root.position; const tgt = brain.path[0]; const dx = tgt.x - p.x, dz = tgt.y - p.z; const d = Math.hypot(dx, dz);
      if (d < 0.12) { brain.path.shift(); if (!brain.path.length) { brain.wait = 5 + Math.random() * 7; if (brain.zone === favored) brain.wait += 6; if (Math.random() < 0.6) bubbleT = Math.min(bubbleT, 0.8); } }
      else {
        const want = Math.atan2(dx, dz); let dh = want - brain.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); brain.heading += dh * Math.min(1, dt * 7);
        const step = Math.min(d, brain.speed * dt * (Math.abs(dh) > 1.2 ? 0.3 : 1)); p.x += Math.sin(brain.heading) * step; p.z += Math.cos(brain.heading) * step; moving = 1;
      }
    } else {
      brain.wait -= dt;
      const want = faceFor(brain.zone, mochi.root.position) + Math.sin(t * 0.4) * 0.35; let dh = want - brain.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); brain.heading += dh * Math.min(1, dt * 2.5);
      const jam = brain.zone.id === 'music' && music.playing ? 3 : 1;
      if (Math.random() < dt * hopRate * jam) mochi.hop((0.4 + Math.random() * 0.4) * (1 - 0.3 * feel.cold)); else if (Math.random() < dt * 0.1 * (1 - 0.5 * feel.cold)) mochi.flap(0.8);
      if (brain.wait < 0 && params.get('stay') !== '1') pickNext();
    }
    mochi.root.position.y = groundY(mochi.root.position.x, mochi.root.position.z);
    mochi.root.rotation.y = brain.heading;
    mochi.update(dt, moving);
    squirrel.update(dt); elk.update(dt, t);
    island.update(t, dt, night); worldState.update(night); wx.update(t, dt, night, sun, sky.hemi);

    // bubble
    bubbleT -= dt; if (bubbleT < 0) { randomThought(); bubbleT = 9 + Math.random() * 7; }
    if (bubbleShow > 0) { bubbleShow -= dt; if (bubbleShow <= 0) bubbleEl.classList.remove('show'); }
    head.copy(mochi.root.position); head.y += mochi.headOffset + mochi.pivot.position.y; head.project(camera);
    const behind = head.z > 1; bubbleEl.style.transform = `translate(${(head.x * 0.5 + 0.5) * innerWidth}px, ${(-head.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
    bubbleEl.style.visibility = behind ? 'hidden' : 'visible';

    // camera
    if (walk.on) walk.update(dt);
    else {
      if (follow) { const p = mochi.root.position; controls.target.lerp(new THREE.Vector3(p.x, p.y + 0.7, p.z), Math.min(1, dt * 3)); }
      if (!follow && performance.now() - lastInteract > 9000 && params.get('rotate') !== '0' && settings.get().autoRotate) controls.autoRotate = true;
      clampTarget(); controls.update(dt);
    }
    composer.render(dt);
    frames++;
    if (frames === 3) { document.getElementById('loading').classList.add('gone'); window.__mochiReady = true; }
    requestAnimationFrame(frame);
  }
  if (params.get('walk') === '1' || (!params.has('cam') && !params.has('walk') && S0.startCam === 'walk' && !matchMedia('(pointer: coarse)').matches)) walk.set(true);
  requestAnimationFrame(frame);
  window.__mochi = { brain, mochi, planTo, ZONES, say, controls, camera, sky, walk, island, worldState, music, settings, feel };
}

init().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading'); if (l) l.innerHTML = `<div class="egg">🥚</div><div>mochi tripped over something: ${String(e.message || e)}</div>`;
});
