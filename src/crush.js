// 💕 the girl kiwi across the river: her own TRELLIS scan (public/models/girlkiwi.glb), a little cottage + nest on the far bank,
// a rowboat tied up at Mochi's dock (the 'visit' activity rows him over and back, with a wake), and the relationship.
// STATE: world.crush = { name, stage: 'stranger'|'friend'|'crush'|'dating', affection 0-100, gifts: [], lastVisit } (all optional;
// missing = a stranger called '???'). ?crush=<stage> forces a stage (tests). At 'dating' she comes over and sits on the dock with him.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DOCK, WATER_Y, riverX, riverW } from './layout.js';
import { terrainH, girlHome } from './landscape.js';

// 💡 what she might be into: ONLY things that already exist in Mochi's world (zones, items, activities).
// gifts: which visit gifts count for it. Her hints nudge Mochi toward it without saying it outright.
export const INTERESTS = [
  { id: 'fishing', label: 'fishing', emoji: '🎣', gifts: ['fish'], hint: 'i watch you on that dock with the rod sometimes. looks peaceful', ick: 'fish smell. on everything. no thank you' },
  { id: 'trout', label: 'cutthroat trout', emoji: '🐟', gifts: ['fish'], hint: 'there\'s a speckled fish in this river with a red slash under its chin. so pretty', ick: 'slimy. wiggly. NO' },
  { id: 'art', label: 'his paintings', emoji: '🎨', gifts: ['art'], hint: 'do you ever paint? i\'d love something to hang by my door', ick: 'paintings just collect dust, honestly' },
  { id: 'bitterroot', label: 'bitterroot flowers', emoji: '🌸', gifts: ['flowers'], hint: 'the little pink star flowers in the gravel are my favourite. the valley is named after them!', ick: 'flowers make me sneeze' },
  { id: 'balsamroot', label: 'arrowleaf balsamroot', emoji: '🌼', gifts: ['flowers'], hint: 'those big yellow sunflowery ones on the hillside in spring... sigh', ick: 'flowers make me sneeze' },
  { id: 'music', label: 'the music corner', emoji: '🎵', gifts: [], topic: 'music', hint: 'i hear drums from your island at night. who IS that', ick: 'all that drumming. some of us sleep' },
  { id: 'stars', label: 'stargazing / the telescope', emoji: '🔭', gifts: [], topic: 'stars', hint: 'i keep wondering what the stars look like up close...', ick: 'the dark is spooky. stars included' },
  { id: 'garden', label: 'gardening', emoji: '🥕', gifts: ['veggies'], hint: 'my carrots keep getting eaten. what\'s your secret?', ick: 'dirt under my claws. ugh' },
  { id: 'cooking', label: 'campfire cooking', emoji: '🍲', gifts: ['cooked'], hint: 'something smelled AMAZING from your campfire last night', ick: 'smoke in my feathers for a week' },
  { id: 'swing', label: 'the tree swing', emoji: '🌳', gifts: [], topic: 'swing', hint: 'is that a swing in your big tree? i\'ve always wanted to swing over the water', ick: 'heights. nope' },
  { id: 'owls', label: 'the owl box', emoji: '🦉', gifts: [], topic: 'owls', hint: 'someone goes \'hoo\' over there every night. i want to meet them', ick: 'owls stare. it\'s rude' },
  { id: 'skate', label: 'skateboarding', emoji: '🛹', gifts: [], topic: 'skate', hint: 'i saw you do a flip on that ramp. could you teach me?', ick: 'skateboards are so LOUD' },
  { id: 'gaming', label: 'Grand Theft Avocado VI', emoji: '🎮', gifts: [], topic: 'gaming', hint: 'is it true you have a TV? what do you even play on it', ick: 'video games rot your beak' },
  { id: 'hottub', label: 'the hot tub', emoji: '♨️', gifts: [], topic: 'hottub', hint: 'the river is SO cold. i dream about warm water', ick: 'hot water? sweaty. no' },
  { id: 'petrels', label: 'the petrel burrow', emoji: '🐦', gifts: [], topic: 'petrels', hint: 'are there seabirds nesting on your island? i heard little chirps', ick: 'other birds are so noisy' },
  { id: 'worms', label: 'worms & bugs', emoji: '🪱', gifts: ['worms'], hint: 'i dug for an hour and found ONE worm. one!', ick: 'worms? i\'m more of a berries girl' },
  { id: 'weather', label: 'the weather station', emoji: '⛈️', gifts: [], topic: 'weather', hint: 'i love a good storm. do you track the weather over there?', ick: 'storms scare me' },
  { id: 'honey', label: 'honey & the bees', emoji: '🍯', gifts: ['honey'], hint: 'do your bees make honey? i\'ve never tasted it', ick: 'bees. BEES. no' },
  { id: 'shells', label: 'beach shells', emoji: '🐚', gifts: ['shells'], hint: 'i found a tiny shell once and kept it for a whole year', ick: 'shells are just old houses' },
  { id: 'caps', label: 'bottle caps', emoji: '🧢', gifts: ['caps'], hint: 'someone said you have a whole MUSEUM of bottle caps??', ick: 'bottle caps are trash, technically' } ];
const IBY = Object.fromEntries(INTERESTS.map((i) => [i.id, i]));
function seeded(seedStr) { let h = 2166136261; for (const ch of String(seedStr)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
export function pickInterests(cfg) {
  const r = seeded(cfg?.seed ?? cfg?.name ?? 'girl kiwi across the river'); const ids = INTERESTS.map((i) => i.id); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  let likes = Array.isArray(cfg?.likes) ? cfg.likes.map(String).filter((x) => IBY[x]).slice(0, 3) : []; for (const id of ids) { if (likes.length >= 3) break; if (!likes.includes(id)) likes.push(id); }
  let dislike = IBY[cfg?.dislike] && !likes.includes(cfg.dislike) ? cfg.dislike : ids.find((id) => !likes.includes(id) && !(IBY[id].gifts.some((g) => likes.some((l) => IBY[l].gifts.includes(g)))));
  return { likes, dislike };
}

export const STAGES = ['stranger', 'friend', 'crush', 'dating'];
const stageFor = (a) => (a >= 85 ? 'dating' : a >= 60 ? 'crush' : a >= 25 ? 'friend' : 'stranger');
const N = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

function canvasSprite(draw, w = 128, h = 128, sc = 0.5) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false })); s.scale.set(sc * w / h, sc, 1); s.visible = false; return s;
}
const heartPath = (g, cx, cy, r) => { g.beginPath(); g.moveTo(cx, cy + r * 0.9); g.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.6, cy - r * 1.3, cx, cy - r * 0.45); g.bezierCurveTo(cx + r * 0.6, cy - r * 1.3, cx + r * 1.6, cy - r * 0.2, cx, cy + r * 0.9); g.closePath(); };
const heartSprite = (sc = 0.45) => canvasSprite((g, w, h) => { heartPath(g, w / 2, h / 2 + 6, 40); g.fillStyle = '#ff4f86'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(w / 2 - 22, h / 2 - 12, 8, 0, 7); g.fill(); }, 128, 128, sc);

// gift props Mochi carries over in his beak
export function giftMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'flowers') { const stemM = new THREE.MeshStandardMaterial({ color: 0x3f8a3a }); const cols = [0xff6fa8, 0xffd23f, 0xb48cff];
    for (let i = 0; i < 3; i++) { const a = (i - 1) * 0.35; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 5), stemM); st.position.set(Math.sin(a) * 0.05, 0.1, 0); st.rotation.z = -a * 0.6; g.add(st);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.6 })); fl.scale.y = 0.55; fl.position.set(Math.sin(a) * 0.12, 0.23, 0); g.add(fl); } g.rotation.x = 1.2; }
  else if (kind === 'art') { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const q = c.getContext('2d'); q.fillStyle = '#bfe6ff'; q.fillRect(0, 0, 64, 48); q.fillStyle = '#7fc46a'; q.fillRect(0, 32, 64, 16); q.fillStyle = '#8b5a2b'; q.beginPath(); q.ellipse(26, 30, 10, 8, 0, 0, 7); q.fill(); q.fillStyle = '#d9b48a'; q.beginPath(); q.ellipse(40, 31, 8, 7, 0, 0, 7); q.fill(); q.fillStyle = '#ff4f86'; heartPath(q, 33, 14, 6); q.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const fr = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.19, 0.015), new THREE.MeshStandardMaterial({ color: 0xc89a5a })); g.add(fr);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), new THREE.MeshBasicMaterial({ map: t })); pic.position.z = 0.009; g.add(pic); g.rotation.y = Math.PI / 2; }
  else if (kind === 'fish') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0x9fb8c8, metalness: 0.3, roughness: 0.4 })); b.scale.set(1, 0.6, 2.4); g.add(b);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.07, 4), b.material); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.14; g.add(tail); }
  else if (kind === 'honey') { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 10), new THREE.MeshStandardMaterial({ color: 0xf0a020, roughness: 0.2, transparent: true, opacity: 0.9 })); g.add(j); const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0xc0504d })); lid.position.y = 0.055; g.add(lid); }
  else if (kind === 'shells') { const m = new THREE.MeshStandardMaterial({ color: 0xf6d8c8, roughness: 0.5 }); for (let i = 0; i < 2; i++) { const sh = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 7), m); sh.rotation.z = 1.4 + i; sh.position.x = (i - 0.5) * 0.06; g.add(sh); } }
  else if (kind === 'cooked') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc89a5a, side: THREE.DoubleSide })); g.add(b); const soup = new THREE.Mesh(new THREE.CircleGeometry(0.065, 10), new THREE.MeshStandardMaterial({ color: 0xd9732e })); soup.rotation.x = -Math.PI / 2; soup.position.y = -0.01; g.add(soup); }
  else if (kind === 'veggies') { const c = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 7), new THREE.MeshStandardMaterial({ color: 0xf08a24 })); c.rotation.x = Math.PI; g.add(c); const t = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 5), new THREE.MeshStandardMaterial({ color: 0x4f9a3a })); t.position.y = 0.09; g.add(t); g.rotation.z = 1.2; }
  else if (kind === 'caps') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 12), new THREE.MeshStandardMaterial({ color: 0xc0504d, metalness: 0.6, roughness: 0.3 })); c.rotation.x = Math.PI / 2; g.add(c); }
  else { const m = new THREE.MeshStandardMaterial({ color: 0xd98a8a, roughness: 0.7 }); for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 5, 10, Math.PI * 1.3), m); w.position.set((i - 1) * 0.03, 0, i * 0.01); w.rotation.set(0.4 * i, i, 0); g.add(w); } }
  return g;
}

export function createCrush(scene, { state, tier = 2 }) {
  const cfg = state.world && typeof state.world.crush === 'object' && state.world.crush ? state.world.crush : null;
  const force = (globalThis.location?.search || '').match(/[?&]crush=(stranger|friend|crush|dating)/);
  let affection = Math.max(0, Math.min(100, N(cfg?.affection, 0)));
  const baseStage = force ? force[1] : STAGES.includes(cfg?.stage) ? cfg.stage : stageFor(affection);
  if (force) affection = Math.max(affection, { stranger: 5, friend: 35, crush: 65, dating: 90 }[force[1]]);
  const name = cfg && cfg.name ? String(cfg.name).slice(0, 24) : '???';
  const gifts = Array.isArray(cfg?.gifts) ? cfg.gifts.slice(-20).map(String) : [];
  const { likes, dislike } = pickInterests(cfg || {});
  const discovered = new Set((Array.isArray(cfg?.discovered) ? cfg.discovered : []).map(String).filter((x) => IBY[x]));
  try { for (const x of JSON.parse(localStorage.getItem('mochi.crush.discovered') || '[]')) if (IBY[x] && (likes.includes(x) || x === dislike)) discovered.add(x); } catch {}
  const stageNow = () => { const a = STAGES.indexOf(baseStage), b = STAGES.indexOf(stageFor(affection)); return STAGES[Math.max(a, force ? a : b)]; };

  // ── her place on the far bank ──
  const land = girlHome().land;
  const dirx = DOCK.dx, dirz = DOCK.dz; // heading from the island out to her bank
  const home = { x: land.x + dirx * 3.4 - dirz * 2.2, z: land.z + dirz * 3.4 + dirx * 2.2 }; home.y = terrainH(home.x, home.z);
  const homeYaw = Math.atan2(-dirx, -dirz); // she faces back across the river toward Mochi's island
  const place = new THREE.Group(); place.position.set(home.x, home.y, home.z); place.rotation.y = homeYaw; scene.add(place);
  // 🪨 stepping-stone ford from the dock tip to her landing (walkable via crossingH)
  { const ax = DOCK.x1, az = DOCK.z1, bx = land.x, bz = land.z, len = Math.hypot(bx - ax, bz - az) || 1;
    const n = Math.max(6, Math.round(len / 2.6)); const stoneM = new THREE.MeshStandardMaterial({ color: 0x8f8a84, roughness: 1 });
    const ford = new THREE.Group(); ford.name = 'ford'; scene.add(ford);
    for (let i = 1; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const jitter = ((i * 13.7) % 1 - 0.5) * 0.7; const px = -(bz - az) / len * jitter, pz = (bx - ax) / len * jitter;
      const h = terrainH(x + px, z + pz); const y = Math.max(WATER_Y + 0.08, h);
      const r = 0.55 + ((i * 7.3) % 1) * 0.4;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stoneM);
      m.position.set(x + px, y - r * 0.45, z + pz); m.rotation.set(i * 0.7, i * 1.1, i * 0.4);
      m.scale.set(1.15, 0.45, 1.0); m.castShadow = m.receiveShadow = true; ford.add(m);
    }
  }
  const api = { name, gifts, lastVisit: cfg?.lastVisit || null, lastResult: null };
  Object.defineProperties(api, { stage: { get: stageNow }, affection: { get: () => affection } });
  // local frame: +z points across the river at Mochi's island, the waterline/landing is at about (-2.2, 3.4)
  const cY = Math.cos(homeYaw), sY = Math.sin(homeYaw);
  const W = (lx, lz) => ({ x: home.x + lx * cY + lz * sY, z: home.z - lx * sY + lz * cY });
  const gy = (lx, lz) => { const w = W(lx, lz); return terrainH(w.x, w.z) - home.y; };
  const LAND = { x: -2.2, z: 3.4 };
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
  const M = { wall: mat(0xf3e6cf, { roughness: 0.9 }), moss: mat(0x6f8f3a, { roughness: 1 }), wood: mat(0x8a5a36), dark: mat(0x5e3b22), stone: mat(0xa8a39a, { roughness: 1 }), dirt: mat(0x5a3f2a, { roughness: 1 }), leaf: mat(0x4f7d3a, { roughness: 0.9 }), metal: mat(0x3a3f45, { roughness: 0.5, metalness: 0.5 }) };
  const put = (geo, m, lx, lz, dy = 0, rot = null, parent = place) => { const o = new THREE.Mesh(geo, m); o.position.set(lx, gy(lx, lz) + dy, lz); if (rot) o.rotation.set(...rot); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const seg = tier >= 2 ? 18 : 12;
  // instanced bits (flowers, stones, roof blooms, veg) so the whole homestead stays a handful of draw calls
  const inst = (geo, m, list) => { const im = new THREE.InstancedMesh(geo, m, Math.max(1, list.length)); const o = new THREE.Object3D(); list.forEach((q, i) => { o.position.set(q[0], q[1], q[2]); o.rotation.set(q[4] || 0, q[3] || 0, 0); o.scale.setScalar(q[5] || 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.count = list.length; im.castShadow = true; place.add(im); return im; };
  let winGlow, lampGlow, lampM, winM;
  { // 🏡 round cottage: cream walls, a mossy roof with little flowers growing in it, a round door, a warm round window
    const CX = -1.8, CZ = -1.4, cy = gy(CX, CZ);
    put(new THREE.CylinderGeometry(0.85, 0.9, 1.25, seg), M.wall, CX, CZ, 0.62);
    const roof = put(new THREE.ConeGeometry(1.18, 0.95, seg), M.moss, CX, CZ, 1.7); roof.position.y = cy + 1.7;
    put(new THREE.CylinderGeometry(0.1, 0.12, 0.45, 8), M.stone, CX + 0.45, CZ - 0.3, 1.95).position.y = cy + 1.95;
    const bloomG = new THREE.SphereGeometry(0.045, 6, 4); const blooms = [[], [], []];
    for (let i = 0; i < 70; i++) { const a = i * 2.39996, t = 0.1 + (((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1) * 0.8; const r = 1.18 * (1 - t) + 0.06; blooms[i % 3].push([CX + Math.cos(a) * r, cy + 1.7 - 0.475 + t * 0.95, CZ + Math.sin(a) * r]); }
    [0xff8fb8, 0xffffff, 0xffd23f].forEach((c, k) => inst(bloomG, mat(c, { roughness: 0.6 }), blooms[k]));
    const doorZ = CZ + 0.905; const door = put(new THREE.CircleGeometry(0.3, 18), mat(0x7b4a2e), CX, doorZ, 0.34); door.position.y = cy + 0.34; door.castShadow = false;
    const frame = put(new THREE.TorusGeometry(0.31, 0.03, 6, 20), M.dark, CX, doorZ + 0.005, 0.34); frame.position.y = cy + 0.34;
    put(new THREE.SphereGeometry(0.025, 6, 5), mat(0xd9b23a, { metalness: 0.6, roughness: 0.3 }), CX + 0.18, doorZ + 0.03, 0.32).position.y = cy + 0.32;
    winM = mat(0xfff1b0, { emissive: 0xffb050, emissiveIntensity: 0.3 }); const wa = 0.75; const win = put(new THREE.CircleGeometry(0.15, 14), winM, CX + Math.sin(wa) * 0.88, CZ + Math.cos(wa) * 0.88, 0.85, [0, wa, 0]); win.position.y = cy + 0.85; win.castShadow = false;
    put(new THREE.TorusGeometry(0.16, 0.025, 5, 16), M.dark, CX + Math.sin(wa) * 0.89, CZ + Math.cos(wa) * 0.89, 0.85, [0, wa, 0]).position.y = cy + 0.85;
    api.window = win;
    // twig nest by the wall (her porch nap spot)
    put(new THREE.TorusGeometry(0.36, 0.11, 7, 16), mat(0x8a6a3e, { roughness: 1 }), -3.35, -0.5, 0.07, [-Math.PI / 2, 0, 0]).scale.z = 0.7;
  }
  { // 🌸 garden: two raised beds of native Bitterroot flowers + a little veggie patch
    const bed = (lx, lz, w, d) => { const b = put(new THREE.BoxGeometry(w, 0.16, d), M.wood, lx, lz, 0.06); const s = put(new THREE.BoxGeometry(w - 0.1, 0.03, d - 0.1), M.dirt, lx, lz, 0.14); void b; void s; };
    bed(0.9, -0.55, 1.5, 0.7); bed(-0.2, -2.4, 1.1, 0.6);
    const pts = (cx, cz, w, d, n, k0) => { const out = []; for (let i = 0; i < n; i++) { const u = ((i * 0.618 + k0) % 1) - 0.5, v = ((i * 0.381 + k0 * 0.7) % 1) - 0.5; const lx = cx + u * (w - 0.2), lz = cz + v * (d - 0.2); out.push([lx, gy(cx, cz) + 0.16, lz, i * 1.3]); } return out; };
    const A = pts(0.9, -0.55, 1.5, 0.7, 16, 0.1), B = pts(-0.2, -2.4, 1.1, 0.6, 10, 0.4);
    const all = [...A, ...B];
    inst(new THREE.SphereGeometry(0.07, 6, 4), M.leaf, all.map((q) => [q[0], q[1] + 0.02, q[2], 0, 0, 1]));
    const bitter = [], balsam = [], lupine = [], brush = []; all.forEach((q, i) => [bitter, balsam, lupine, brush][i % 4].push(q));
    inst(new THREE.CylinderGeometry(0.06, 0.02, 0.03, 8), mat(0xff8fb8, { roughness: 0.6 }), bitter.map((q) => [q[0], q[1] + 0.08, q[2]])); // bitterroot: low pink stars
    inst(new THREE.CylinderGeometry(0.07, 0.03, 0.025, 10), mat(0xffd23f, { roughness: 0.6 }), balsam.map((q) => [q[0], q[1] + 0.2, q[2]])); // arrowleaf balsamroot: tall yellow
    inst(new THREE.ConeGeometry(0.035, 0.2, 6), mat(0x7a5cd6, { roughness: 0.6 }), lupine.map((q) => [q[0], q[1] + 0.2, q[2]])); // lupine: purple spikes
    inst(new THREE.ConeGeometry(0.03, 0.12, 5), mat(0xe8452c, { roughness: 0.6 }), brush.map((q) => [q[0], q[1] + 0.14, q[2]])); // indian paintbrush: red tips
    // veggie patch: dark soil, three rows of little cabbages + carrot tops
    put(new THREE.BoxGeometry(1.2, 0.06, 1.0), M.dirt, 3.0, 0.3, 0.02);
    const veg = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) veg.push([2.58 + c * 0.28, gy(3.0, 0.3) + 0.09, -0.02 + r * 0.32, c, 0, 0.8 + ((r + c) % 3) * 0.15]);
    inst(new THREE.SphereGeometry(0.075, 7, 5), mat(0x7fb24a, { roughness: 0.8 }), veg);
  }
  { // 🪵 stepping-stone path from her door down to her little dock, with a spur to the bench
    const st = []; const path = [[-1.8, -0.2], [-1.9, 0.5], [-2.0, 1.2], [-2.1, 1.9], [-2.2, 2.55], [-1.3, 1.6], [-0.5, 1.95]];
    path.forEach(([x, z], i) => st.push([x, gy(x, z) + 0.02, z, i * 0.9, 0, 0.9 + (i % 3) * 0.12]));
    const sg = new THREE.CylinderGeometry(0.2, 0.22, 0.05, 9); inst(sg, M.stone, st);
  }
  // ⚓ her tiny dock where Mochi ties up the boat
  const DK = { x: LAND.x, z0: LAND.z - 0.9, z1: LAND.z + 2.0, w: 1.1 }; DK.y = gy(DK.x, DK.z0) + 0.16;
  { const deck = put(new THREE.BoxGeometry(DK.w, 0.07, DK.z1 - DK.z0), mat(0x9a7048), DK.x, (DK.z0 + DK.z1) / 2, 0); deck.position.y = DK.y;
    const pg = new THREE.CylinderGeometry(0.06, 0.06, 2.0, 7); for (const s of [-1, 1]) for (const z of [DK.z0 + 0.3, DK.z1 - 0.1]) { const p = put(pg, M.dark, DK.x + s * (DK.w / 2 - 0.05), z, 0); p.position.y = DK.y - 0.6; } }
  { // 🪑 bench for dates, facing the river
    const BX = 0.4, BZ = 2.35, by = gy(BX, BZ); const bg = new THREE.Group(); bg.position.set(BX, by, BZ); place.add(bg);
    const plank = (w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.wood); o.position.set(x, y, z); o.castShadow = true; bg.add(o); };
    plank(1.3, 0.05, 0.38, 0, 0.42, 0); plank(1.3, 0.3, 0.05, 0, 0.68, -0.18); for (const s of [-1, 1]) plank(0.06, 0.42, 0.34, s * 0.58, 0.21, 0);
  }
  { // 🏮 lantern post by the dock (glows at night)
    const LX = -3.0, LZ = 2.55; put(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6), M.dark, LX, LZ, 0.75);
    lampM = mat(0xfff0c0, { emissive: 0xffb050, emissiveIntensity: 0.2 }); put(new THREE.BoxGeometry(0.2, 0.26, 0.2), lampM, LX, LZ, 1.6); put(new THREE.ConeGeometry(0.17, 0.12, 4), M.dark, LX, LZ, 1.79, [0, Math.PI / 4, 0]);
  }
  { // 📫 mailbox with her name
    const MX = -0.9, MZ = 0.55; put(new THREE.BoxGeometry(0.06, 0.95, 0.06), M.dark, MX, MZ, 0.47);
    const mb = put(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 12, 1, false, 0, Math.PI), mat(0xe98fae, { roughness: 0.5 }), MX, MZ, 0.98, [Math.PI / 2, 0, Math.PI / 2]); void mb;
    put(new THREE.BoxGeometry(0.26, 0.02, 0.4), mat(0xe98fae), MX, MZ, 0.98);
    put(new THREE.BoxGeometry(0.02, 0.12, 0.03), mat(0xe8452c), MX + 0.14, MZ - 0.1, 1.08);
    const c = document.createElement('canvas'); c.width = 128; c.height = 40; const q = c.getContext('2d'); q.fillStyle = '#fff'; q.font = 'bold 24px Nunito,sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(name, 64, 21);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.094), new THREE.MeshBasicMaterial({ map: t, transparent: true })); lb.position.set(MX + 0.135, gy(MX, MZ) + 0.98, MZ); lb.rotation.y = Math.PI / 2; place.add(lb);
  }
  const lines = []; { // 👕 clothesline with three little scarves drying + 🐦 a bird bath
    const P1 = [1.5, -2.6], P2 = [3.6, -2.3]; for (const [x, z] of [P1, P2]) put(new THREE.CylinderGeometry(0.035, 0.04, 1.4, 6), M.dark, x, z, 0.7);
    const y1 = gy(...P1) + 1.32, y2 = gy(...P2) + 1.32; const L = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, L, 4), mat(0xe8e0d0)); rope.position.set((P1[0] + P2[0]) / 2, (y1 + y2) / 2, (P1[1] + P2[1]) / 2); rope.rotation.set(0, -Math.atan2(P2[1] - P1[1], P2[0] - P1[0]), Math.PI / 2); place.add(rope);
    [0x7fc8a9, 0xff8fb8, 0xffd23f].forEach((col, i) => { const f = (i + 1) / 4; const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.38), new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 0.9 })); const g = new THREE.Group(); g.position.set(P1[0] + (P2[0] - P1[0]) * f, y1 + (y2 - y1) * f - 0.02, P1[1] + (P2[1] - P1[1]) * f); g.rotation.y = -Math.atan2(P2[1] - P1[1], P2[0] - P1[0]); cl.position.y = -0.19; g.add(cl); place.add(g); lines.push(g); });
    put(new THREE.CylinderGeometry(0.06, 0.12, 0.55, 8), M.stone, 1.9, 1.2, 0.27); const bowl = put(new THREE.CylinderGeometry(0.28, 0.12, 0.1, 12), M.stone, 1.9, 1.2, 0.6); void bowl;
    put(new THREE.CircleGeometry(0.24, 12), mat(0x8fc8e0, { roughness: 0.15, metalness: 0.1 }), 1.9, 1.2, 0.656, [-Math.PI / 2, 0, 0]);
  }
  // soft glow sprites for night (cheap stand-ins for lights)
  { const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const q = c.getContext('2d'); const gr = q.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,200,120,1)'); gr.addColorStop(1, 'rgba(255,170,80,0)'); q.fillStyle = gr; q.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const gs = (lx, lz, dy, sc) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 })); s.position.set(lx, gy(lx, lz) + dy, lz); s.scale.setScalar(sc); place.add(s); return s; };
    const wa = 0.75; winGlow = gs(-1.8 + Math.sin(wa) * 1.0, -1.4 + Math.cos(wa) * 1.0, 0.85, 1.2); lampGlow = gs(-3.0, 2.55, 1.6, 1.4); }
  // her pottering spots (local): garden, bench, door, bird bath; tagged with what they're about
  const SPOTS = [{ id: 'garden', x: 0.9, z: 0.05, face: Math.PI, tags: ['garden', 'bitterroot', 'balsamroot'] }, { id: 'bench', x: 0.4, z: 2.0, face: 0, sit: true, tags: ['stars'] }, { id: 'door', x: -1.8, z: -0.15, face: 0, tags: [] }, { id: 'birdbath', x: 1.9, z: 1.75, face: Math.PI, tags: ['owls', 'petrels'] }, { id: 'veg', x: 3.0, z: 1.05, face: Math.PI, tags: ['garden', 'cooking'] }];
  const worldSpot = (sp) => { const w = W(sp.x, sp.z); return new THREE.Vector3(w.x, terrainH(w.x, w.z), w.z); };
  const toWorldYaw = (f) => homeYaw + f;
  const dockTipL = W(DK.x, DK.z1 - 0.35), dockRootL = W(DK.x, DK.z0);
  const onHerDock = (x, z) => { const dx = x - home.x, dz = z - home.z; const lx = dx * cY - dz * sY, lz = dx * sY + dz * cY; return Math.abs(lx - DK.x) < DK.w / 2 + 0.05 && lz > DK.z0 - 0.05 && lz < DK.z1 + 0.05; };
  // ── her ──
  const her = new THREE.Group(); her.name = 'girlkiwi'; scene.add(her);
  const pivot = new THREE.Group(); her.add(pivot); const body = new THREE.Group(); pivot.add(body);
  const SC = 1.33 * 0.86; // a touch smaller than Mochi
  api.loaded = false;
  { const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
    L.load((import.meta.env?.BASE_URL || '/') + 'models/girlkiwi.glb', (g) => { try {
      const sc = g.scene; sc.scale.setScalar(SC); sc.rotation.y = Math.PI; sc.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(sc); sc.position.y -= bb.min.y;
      sc.traverse((o) => { if (o.isMesh) { const old = o.material; if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); o.material = new THREE.MeshStandardMaterial({ map: old.map, color: new THREE.Color(1.18, 1.14, 1.1), roughness: 0.85, metalness: 0 }); o.castShadow = true; o.receiveShadow = true; } });
      body.add(sc); api.loaded = true; } catch (e) { console.warn('[crush] model failed', e.message); } }, undefined, (e) => console.warn('[crush] model load failed', e?.message || e)); }
  const herHeart = heartSprite(0.42); scene.add(herHeart);
  const sparkle = canvasSprite((g, w, h) => { g.translate(w / 2, h / 2); g.fillStyle = '#ffe36a'; g.strokeStyle = '#fff'; g.lineWidth = 4; for (const [x, y, r] of [[0, 0, 34], [-36, -26, 14], [34, -30, 16], [30, 34, 12]]) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke(); } }, 128, 128, 0.42); scene.add(sparkle);
  const ick = canvasSprite((g, w, h) => { g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.roundRect(4, 14, w - 8, h - 28, 22); g.fill(); g.fillStyle = '#4a6a3a'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ew 😖', w / 2, h / 2 + 2); }, 256, 96, 0.34); scene.add(ick);
  const shrug = canvasSprite((g, w, h) => { g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.roundRect(4, 14, w - 8, h - 28, 22); g.fill(); g.fillStyle = '#5a4a40'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('¯\\_(ツ)_/¯', w / 2, h / 2 + 2); }, 256, 96, 0.34); scene.add(shrug);
  const tag = canvasSprite((g, w, h) => { g.fillStyle = 'rgba(40,20,30,0.55)'; g.beginPath(); g.roundRect(2, 8, w - 4, h - 16, 18); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, w / 2, h / 2); }, 256, 64, 0.17); tag.visible = true; scene.add(tag);
  // floating hearts for dates
  const hearts = []; for (let i = 0; i < (tier >= 2 ? 8 : 5); i++) { const h = heartSprite(0.22); h.userData.t = 99; scene.add(h); hearts.push(h); }
  let heartsOn = false, heartsAt = new THREE.Vector3(), spawnT = 0;

  // ── the rowboat ──
  const boat = new THREE.Group(); boat.name = 'rowboat'; scene.add(boat);
  { // an open rounded rowboat: a lower half-shell (pointed at the bow), wood inside, white gunwale, a thwart to sit on
    const shell = (r) => { const g = new THREE.SphereGeometry(1, tier >= 2 ? 22 : 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); const t = Math.max(0, z); pa.setXYZ(i, x * 0.62 * r * (1 - 0.72 * t * t), y * 0.42 * r, z * 1.3 * r + (z > 0 ? 0.08 * t : 0)); } g.computeVertexNormals(); return g; };
    const hull = new THREE.Mesh(shell(1), new THREE.MeshStandardMaterial({ color: 0x2f7fb5, roughness: 0.65 })); hull.position.y = 0.32; hull.castShadow = true; boat.add(hull);
    const inner = new THREE.Mesh(shell(0.94), new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.9, side: THREE.BackSide })); inner.position.y = 0.32; boat.add(inner);
    const rimG = new THREE.TorusGeometry(1, 0.045, 6, tier >= 2 ? 40 : 28); rimG.rotateX(Math.PI / 2); { const pa = rimG.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); const t = Math.max(0, z); pa.setX(i, x * 0.6 * (1 - 0.72 * t * t)); pa.setZ(i, z * 1.29 + (z > 0 ? 0.08 * t : 0)); } rimG.computeVertexNormals(); }
    const rim = new THREE.Mesh(rimG, new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.6 })); rim.position.y = 0.33; boat.add(rim);
    const plank = new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.8 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.045, 0.26), plank); seat.position.set(0, 0.24, 0.55); boat.add(seat);
    const seat2 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.045, 0.24), plank); seat2.position.set(0, 0.24, -0.7); boat.add(seat2);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 1.6), plank); floor.position.set(0, 0.03, -0.05); boat.add(floor);
    api.oars = []; for (const s of [-1, 1]) { const o = new THREE.Group(); o.position.set(0.6 * s, 0.36, -0.05); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0xd8b07a })); shaft.rotation.z = Math.PI / 2; shaft.position.x = 0.45 * s; o.add(shaft);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.015, 0.12), shaft.material); blade.position.x = 1.15 * s; o.add(blade); o.rotation.z = -0.35 * s; boat.add(o); api.oars.push(o); }
  }
  const lat = { x: -DOCK.dz, z: DOCK.dx };
  const moor = { x: DOCK.x1 - DOCK.dx * 1.6 + lat.x * (DOCK.w / 2 + 0.75), z: DOCK.z1 - DOCK.dz * 1.6 + lat.z * (DOCK.w / 2 + 0.75) };
  const boardPt = new THREE.Vector3(DOCK.x1 - DOCK.dx * 1.6 + lat.x * 0.35, 0, DOCK.z1 - DOCK.dz * 1.6 + lat.z * 0.35);
  const beach = W(DK.x + 1.05, DK.z1 - 0.45); // the boat ties up alongside her little dock
  const yawOut = Math.atan2(dirx, dirz), yawHome = yawOut + Math.PI;
  const boatState = { x: moor.x, z: moor.z, yaw: yawOut, row: 0, bob: 0 };
  // wake: little V chevrons spawned behind the stern that spread and fade
  const wakeTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const q = c.getContext('2d'); q.strokeStyle = 'rgba(255,255,255,0.75)'; q.lineWidth = 5; q.lineCap = 'round'; q.shadowColor = '#fff'; q.shadowBlur = 8; q.beginPath(); q.moveTo(8, 56); q.lineTo(64, 10); q.lineTo(120, 56); q.stroke(); return new THREE.CanvasTexture(c); })();
  const wakes = []; for (let i = 0; i < (tier >= 2 ? 14 : 9); i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); w.rotation.x = -Math.PI / 2; w.userData.t = 99; w.visible = false; scene.add(w); wakes.push(w); }
  let wakeT = 0, wakeOn = false;

  // where she stands: at home, or (dating) sitting on the dock by the tip
  const dockSeat = new THREE.Vector3(DOCK.x1 - DOCK.dx * 0.55 - lat.x * 0.35, DOCK.y + 0.02, DOCK.z1 - DOCK.dz * 0.55 - lat.z * 0.35);
  const mochiDateSpot = new THREE.Vector3(DOCK.x1 - DOCK.dx * 0.55 + lat.x * 0.4, 0, DOCK.z1 - DOCK.dz * 0.55 + lat.z * 0.4);
  const spot = new THREE.Vector3(); let herYaw = homeYaw, herLook = null;
  const pot = { i: 2, wait: 4, walking: false, tgt: null, perked: false };
  function placeHer() { if (stageNow() === 'dating') { spot.copy(dockSeat); herYaw = yawOut; } else { spot.copy(worldSpot(SPOTS[2])); herYaw = toWorldYaw(SPOTS[2].face); pot.i = 2; pot.wait = 4; } her.position.copy(spot); her.rotation.y = herYaw; }
  const persist = () => { try { localStorage.setItem('mochi.crush.discovered', JSON.stringify([...discovered])); } catch {} };
  const verdictOf = (ids) => { ids = ids.filter(Boolean); const l = ids.find((i) => likes.includes(i)); if (l) return { v: 'like', id: l }; if (ids.includes(dislike)) return { v: 'ick', id: dislike }; return { v: 'meh', id: ids[0] || null }; };
  const bump = (d) => { affection = Math.max(0, Math.min(100, affection + d)); api.lastVisit = new Date().toISOString(); };
  placeHer();
  let peckT = 3, peck = 0, hopT = -1, reactT = 0, reactKind = '';

  Object.assign(api, { her, boat, place, home, beach, moor, boardPt, dockSeat, mochiDateSpot, yawOut, yawHome, boatState, landing: land,
    herFront() { const s = her.position; return new THREE.Vector3(s.x + Math.sin(her.rotation.y) * 0.95, 0, s.z + Math.cos(her.rotation.y) * 0.95); },
    lookAt(p) { herLook = p; }, wake(on) { wakeOn = on; },
    react(kind) { herHeart.visible = shrug.visible = sparkle.visible = ick.visible = false; reactKind = kind; reactT = 0; if (kind === 'heart' || kind === 'sparkle') hopT = 0; ({ heart: herHeart, sparkle, ick, shrug }[kind] || shrug).visible = true; },
    likes, dislike, get discovered() { return [...discovered]; }, interests: INTERESTS, interest: (id) => IBY[id], dockTip: new THREE.Vector3(dockTipL.x, 0, dockTipL.z), dockRoot: new THREE.Vector3(dockRootL.x, 0, dockRootL.z), onHerDock, spots: SPOTS,
    nextGift: typeof cfg?.nextGift === 'string' ? cfg.nextGift : null, nextTopic: IBY[cfg?.nextTopic] ? cfg.nextTopic : null,
    discover(id) { if (!IBY[id] || discovered.has(id)) return false; discovered.add(id); persist(); return true; },
    // a gift: 'about' = which interests it touches (e.g. flowers -> ['bitterroot']). like: big + discovery; meh: small; dislike: minus
    gift(kind, about) { gifts.push(kind); if (gifts.length > 20) gifts.shift(); const r = verdictOf(about); const d = r.v === 'like' ? 15 : r.v === 'ick' ? -8 : 3; bump(d); const fresh = r.v !== 'meh' && api.discover(r.id); api.lastResult = r.v; return { ...r, d, fresh, info: IBY[r.id] }; },
    talk(id) { const r = verdictOf([id]); const d = r.v === 'like' ? 12 : r.v === 'ick' ? -6 : 2; bump(d); const fresh = r.v !== 'meh' && api.discover(r.id); return { ...r, d, fresh, info: IBY[id] }; },
    hint() { const open = likes.filter((l) => !discovered.has(l)); const r = Math.random(); if (open.length && r < 0.6) return IBY[open[Math.floor(Math.random() * open.length)]].hint; if (!discovered.has(dislike) && r < 0.8) return IBY[dislike].ick; return null; },
    pickTopic() { if (api.nextTopic) return api.nextTopic; const tried = new Set(discovered); const pool = INTERESTS.filter((i) => !tried.has(i.id)); return (pool.length ? pool : INTERESTS)[Math.floor(Math.random() * (pool.length || INTERESTS.length))].id; },
    hearts(on, at) { heartsOn = on; if (at) heartsAt.copy(at); },
    give(kind, good) { /* legacy */ gifts.push(kind); if (gifts.length > 20) gifts.shift(); const gain = { flowers: 8, art: 10, worms: 6, fish: 4 }[kind] ?? 3; const d = good ? gain + 3 : Math.max(1, Math.round(gain / 3)); affection = Math.min(100, affection + d); api.lastVisit = new Date().toISOString(); api.lastResult = good ? 'heart' : 'meh'; return d; },
    rideY(x, z) { return onHerDock(x, z) ? home.y + DK.y + 0.035 : terrainH(x, z); },
    update(t, dt, night, mochiPos) {
      // boat: bob at the mooring or wherever the visit put it
      boatState.bob = t; boat.position.set(boatState.x, WATER_Y - 0.13 + Math.sin(t * 1.3) * 0.025, boatState.z); boat.rotation.set(Math.sin(t * 1.1) * 0.02, boatState.yaw, Math.sin(t * 0.9) * 0.03);
      for (const [i, o] of api.oars.entries()) { const s = i ? 1 : -1; const r = boatState.row; o.rotation.set(0, s * (r ? Math.sin(t * 5) * 0.55 : 0.2) * -1, -s * (r ? 0.25 + 0.2 * Math.cos(t * 5) : 0.35)); }
      if (wakeOn) { wakeT -= dt; if (wakeT < 0) { wakeT = 0.28; const w = wakes.find((q) => q.userData.t > 1.6); if (w) { const by = boatState.yaw; w.position.set(boatState.x - Math.sin(by) * 1.25, WATER_Y + 0.03, boatState.z - Math.cos(by) * 1.25); w.rotation.z = by + Math.PI; w.userData.t = 0; w.visible = true; } } }
      for (const w of wakes) if (w.visible) { const u = (w.userData.t += dt); w.scale.set(1 + u * 1.6, 1 + u * 0.9, 1); w.material.opacity = Math.max(0, 0.38 * (1 - u / 1.6)); if (u > 1.6) w.visible = false; }
      // her idle: breathe, pecks at the ground now and then, turns to watch Mochi when he's close
      const near = mochiPos && mochiPos.distanceTo(her.position) < 9;
      // potter between her spots (garden, bench, door, bird bath, veg patch) when Mochi isn't around
      if (stageNow() !== 'dating' && !near && !herLook && !reactKind) {
        if (pot.walking) { const tg = pot.tgt, p = her.position; const dx = tg.x - p.x, dz = tg.z - p.z, d = Math.hypot(dx, dz);
          if (d < 0.08) { pot.walking = false; pot.wait = 6 + Math.random() * 8; herYaw = toWorldYaw(SPOTS[pot.i].face); const tags = SPOTS[pot.i].tags; if (tags.some((x) => likes.includes(x))) api.react('sparkle'); else if (tags.includes(dislike)) api.react('ick'); }
          else { const st = Math.min(d, dt * 0.55); p.x += dx / d * st; p.z += dz / d * st; p.y = terrainH(p.x, p.z); herYaw = Math.atan2(dx, dz); pivot.position.y = Math.abs(Math.sin(t * 9)) * 0.04; } }
        else { pot.wait -= dt; if (pot.wait < 0) { let n = pot.i; while (n === pot.i) n = Math.floor(Math.random() * SPOTS.length); pot.i = n; pot.tgt = worldSpot(SPOTS[n]); pot.walking = true; } } }
      let want = herLook ? Math.atan2(herLook.x - her.position.x, herLook.z - her.position.z) : near && stageNow() !== 'dating' ? Math.atan2(mochiPos.x - her.position.x, mochiPos.z - her.position.z) : herYaw;
      let dh = want - her.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); her.rotation.y += dh * Math.min(1, dt * 3);
      peckT -= dt; if (peckT < 0) { peckT = 3 + Math.random() * 5; if (!near && stageNow() !== 'dating') peck = 1; } peck = Math.max(0, peck - dt * 1.4);
      const pk = Math.sin(Math.min(1, peck) * Math.PI); pivot.rotation.x = pk * 0.55; pivot.position.z = pk * 0.08;
      body.scale.set(1 + Math.sin(t * 2.2) * 0.012, 1 - Math.sin(t * 2.2) * 0.015, 1);
      if (pot.walking && !near) { /* waddle bob set above */ } else if (hopT >= 0) { hopT += dt; const u = hopT / 0.5; if (u < 2) pivot.position.y = Math.abs(Math.sin(u * Math.PI)) * 0.3; else { hopT = -1; pivot.position.y = 0; } } else pivot.position.y = 0;
      if (reactKind === 'ick') pivot.rotation.x = -0.25 * Math.sin(Math.min(1, reactT / 0.4) * Math.PI / 2); /* pulls her beak back */
      if (reactKind === 'shrug') { const u = reactT; pivot.rotation.z = Math.sin(Math.min(1, u / 1.2) * Math.PI) * 0.18; }
      if (reactKind) { reactT += dt; const top = her.position.y + 1.25; const sp = { heart: herHeart, sparkle, ick, shrug }[reactKind] || shrug; sp.position.set(her.position.x, top + Math.min(1, reactT) * 0.35, her.position.z); sp.material.opacity = Math.max(0, 1 - Math.max(0, reactT - 1.6) / 0.6); const k = reactKind === 'heart' ? 0.42 * (1 + 0.25 * Math.sin(Math.min(1, reactT * 3) * Math.PI)) : 0.34; sp.scale.set(k * (sp === shrug || sp === ick ? 256 / 96 : 1), k, 1); if (reactT > 2.2) { herHeart.visible = shrug.visible = sparkle.visible = ick.visible = false; reactKind = ''; pivot.rotation.z = 0; } }
      tag.position.set(her.position.x, her.position.y + 1.3, her.position.z); tag.visible = !reactKind;
      winM.emissiveIntensity = 0.3 + 1.6 * night; lampM.emissiveIntensity = 0.2 + 2.2 * night; winGlow.material.opacity = 0.85 * night; lampGlow.material.opacity = 0.9 * night;
      for (const [i, g] of lines.entries()) g.rotation.x = Math.sin(t * 1.6 + i * 1.3) * 0.18;
      // date hearts drift up between them
      if (heartsOn) { spawnT -= dt; if (spawnT < 0) { spawnT = 0.45; const h = hearts.find((q) => q.userData.t > 3); if (h) { h.userData.t = 0; h.userData.x = heartsAt.x + (Math.random() - 0.5) * 0.6; h.userData.z = heartsAt.z + (Math.random() - 0.5) * 0.6; h.userData.ph = Math.random() * 6; h.visible = true; } } }
      for (const h of hearts) if (h.visible) { const u = (h.userData.t += dt); h.position.set(h.userData.x + Math.sin(u * 2 + h.userData.ph) * 0.12, heartsAt.y + 0.9 + u * 0.45, h.userData.z); h.material.opacity = Math.min(1, u * 3) * Math.max(0, 1 - u / 3); if (u > 3) h.visible = false; }
    } });
  api.replace = placeHer;
  return api;
}
