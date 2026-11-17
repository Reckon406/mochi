// Mochi's wishlist builds (v3): whale telescope + owl box on the cliff, petrel guest burrow, capybara hot tub,
// Corey's gift skateboard, a tiny swing under the treehouse, a reading lantern up top.
// Static parts are baked into one merged mesh per colour so each spot costs only a few draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WISH, BIGTREE, groundY, topH } from './layout.js';
import { plank } from './signs.js';

const MATS = {};
const mat = (c, o = {}) => (MATS[c + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o }));
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
// collects geometry per material, then one mesh per material
function batch() {
  const by = new Map();
  return {
    add(geo, m, pos = [0, 0, 0], rot = [0, 0, 0], sc = [1, 1, 1]) { const g = (geo.index ? geo.toNonIndexed() : geo); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      _m.compose(new THREE.Vector3(...pos), _q.setFromEuler(_e.set(...rot)), typeof sc === 'number' ? new THREE.Vector3(sc, sc, sc) : new THREE.Vector3(...sc)); g.applyMatrix4(_m); if (!by.has(m)) by.set(m, []); by.get(m).push(g); return this; },
    build(parent, shadow = true) { for (const [m, list] of by) { const g = mergeGeometries(list, false); list.forEach((x) => x.dispose()); if (!g) continue; const mesh = new THREE.Mesh(g, m); mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); } by.clear(); return parent; },
  };
}
const softTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }; })();
function tag(parent, lines, pos, yaw, width = 0.55, seed = 31, tone = 'pine', icon = '') { const pk = plank(lines, { width, tone, seed, icon, twoSided: true }); pk.position.set(...pos); pk.rotation.y = yaw; parent.add(pk); return pk; }

export function buildWishes(scene, { features, glow = [], snowy = false, mobile = false }) {
  const group = new THREE.Group(); group.name = 'wishlist-builds'; scene.add(group);
  const out = { group }; const anim = [];
  const wood = mat(0x8a5a32), dark = mat(0x4a3020), brass = mat(0xd4a84a, { metalness: 0.75, roughness: 0.3 }), iron = mat(0x8a8f96, { metalness: 0.6, roughness: 0.45 });
  const at = (p, dy = 0) => { const g = new THREE.Group(); g.position.set(p.x, groundY(p.x, p.z) + dy, p.z); group.add(g); return g; };

  // ── 1. tiny whale telescope on the lookout cliff, pointed north at canada ──
  { const g = at(WISH.scope, -0.02); const b = batch();
    for (const a of [0, 2.1, 4.2]) b.add(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 5), wood, [Math.sin(a) * 0.12, 0.29, Math.cos(a) * 0.12], [Math.cos(a) * 0.38, 0, -Math.sin(a) * 0.38]);
    b.add(new THREE.SphereGeometry(0.04, 8, 6), iron, [0, 0.6, 0]);
    b.add(new THREE.CylinderGeometry(0.045, 0.06, 0.46, 12), brass, [0, 0.68, -0.05], [-(Math.PI / 2 - 0.22), 0, 0]); // tube tilts up toward the north (-z)
    b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), brass, [0, 0.73, -0.27], [-(Math.PI / 2 - 0.22), 0, 0]);
    b.add(new THREE.CylinderGeometry(0.022, 0.026, 0.08, 8), dark, [0, 0.62, 0.2], [-(Math.PI / 2 - 0.22), 0, 0]);
    b.build(g); tag(g, ['WHALES ↑'], [0.42, 0.42, 0.15], -0.5, 0.42, 41, 'pine');
    { const p = new THREE.Group(); p.position.set(0.42, 0, 0.15); g.add(p); batch().add(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5), dark, [0, 0.2, -0.03]).build(p); }
    out.scope = { pos: g.position.clone(), stand: new THREE.Vector3(g.position.x, 0, g.position.z + 0.72), face: Math.PI };
  }

  // ── 7. owl box on the cliff: post, little house, round door, perch peg. the owl moves in at night (critters.js) ──
  { const g = at(WISH.owlbox, -0.03); const yaw = Math.atan2(0.96, -0.27); g.rotation.y = yaw; // round door faces back over the island (and the camera)
    const b = batch();
    b.add(new THREE.CylinderGeometry(0.06, 0.075, 1.9, 6), dark, [0, 0.95, 0]);
    b.add(new THREE.BoxGeometry(0.44, 0.56, 0.42), mat(0xb98a55), [0, 2.1, 0]);
    b.add(new THREE.BoxGeometry(0.56, 0.05, 0.56), mat(snowy ? 0xf3f6ff : 0x7a4a2a), [0, 2.42, 0.02], [0.12, 0, 0]);
    b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 14), mat(0x140d08), [0, 2.18, 0.212], [Math.PI / 2, 0, 0]);
    b.add(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 5), dark, [0, 2.0, 0.27], [Math.PI / 2, 0, 0]);
    b.build(g); const perch = new THREE.Vector3(0, 2.45, 0.02); g.updateMatrixWorld(true); g.localToWorld(perch);
    out.owlBox = { perch, yaw };
  }

  // ── 2. guest burrow for diving-petrels: grassy mound, dark tunnel mouth, pebble ring, a petrel who peeks out ──
  { const g = at(WISH.burrow, -0.05); const face = Math.atan2(0.9, -1.6); g.rotation.y = face; const b = batch();
    b.add(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(snowy ? 0xe8ecf4 : 0x5f8a3e, { roughness: 1 }), [0, 0, -0.1], [0, 0, 0], [1.05, 0.5, 0.95]);
    b.add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x7a5a3a, { roughness: 1 }), [0, 0.01, 0.55], [0, 0, 0], [0.48, 0.32, 0.4]);
    b.add(new THREE.CircleGeometry(0.2, 14), mat(0x0d0906, { roughness: 1 }), [0, 0.15, 0.93], [-0.25, 0, 0], [1, 0.75, 1]);
    b.add(new THREE.CylinderGeometry(0.045, 0.05, 0.6, 6), dark, [0, 0.33, 0.9], [0.2, 0, Math.PI / 2]); for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.035, 0.04, 0.32, 5), dark, [s * 0.25, 0.16, 0.93], [0, 0, s * 0.15]);
    for (let i = 0; i < 9; i++) { const a = -1.2 + i * 0.3; b.add(new THREE.DodecahedronGeometry(0.06 + (i % 3) * 0.015, 0), mat(0x9a948e), [Math.sin(a) * 0.5, 0.03, 0.55 + Math.cos(a) * 0.45], [i, i * 2, 0]); }
    b.build(g);
    const bird = new THREE.Group(); g.add(bird); const bb = batch(); // diving-petrel: chunky little dark-backed, white-bellied seabird
    bb.add(new THREE.SphereGeometry(0.11, 10, 8), mat(0x2e3440), [0, 0.1, 0], [0, 0, 0], [1, 0.9, 1.2]);
    bb.add(new THREE.SphereGeometry(0.085, 10, 8), mat(0xf2f2ee), [0, 0.07, 0.06], [0, 0, 0], [0.9, 0.8, 1]);
    bb.add(new THREE.SphereGeometry(0.075, 10, 8), mat(0x2e3440), [0, 0.2, 0.08]);
    bb.add(new THREE.ConeGeometry(0.022, 0.07, 5), mat(0x1a1a1a), [0, 0.2, 0.17], [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) bb.add(new THREE.SphereGeometry(0.014, 6, 4), mat(0x050505, { roughness: 0.2 }), [s * 0.04, 0.225, 0.135]);
    bb.build(bird, false);
    bird.position.set(0, 0.04, 0.75); let peek = 0, T = 3;
    anim.push((t, dt, night) => { T -= dt; if (T < 0) { peek = peek ? 0 : 1; T = peek ? 4 + Math.random() * 4 : 6 + Math.random() * 10; }
      const z = 0.62 + (peek ? 0.38 : 0) ; bird.position.z += (z - bird.position.z) * Math.min(1, dt * 3); bird.visible = bird.position.z > 0.68; bird.rotation.y = peek ? Math.sin(t * 1.3) * 0.5 : 0; });
    out.burrow = { pos: g.position.clone(), bird, peek: () => { peek = 1; T = 6; } };
  }

  // ── 6. capybara hot tub: barrel tub of warm river water by the nest, steam, sometimes a capybara ──
  { const g = at(WISH.tub, -0.04); const b = batch(); const R = 0.88, H = 0.58;
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; b.add(new THREE.BoxGeometry(0.3, H, 0.06), i % 2 ? wood : mat(0x7a4c2a), [Math.cos(a) * R, H / 2, Math.sin(a) * R], [0, -a + Math.PI / 2, 0]); }
    for (const y of [0.12, 0.46]) b.add(new THREE.TorusGeometry(R + 0.035, 0.018, 4, 24), iron, [0, y, 0], [Math.PI / 2, 0, 0]);
    b.add(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.06, 16), dark, [0, 0.03, 0]);
    b.add(new THREE.BoxGeometry(0.42, 0.2, 0.26), wood, [0, 0.1, R + 0.22]); // a step for short legs
    b.add(new THREE.BoxGeometry(0.42, 0.06, 0.06), mat(0xf2e6c8), [0.45, H + 0.03, -0.3], [0, 0.6, 0]); // folded towel
    b.build(g);
    const waterM = new THREE.MeshStandardMaterial({ color: 0x7cc8c4, roughness: 0.12, metalness: 0.1, emissive: 0x2a6a66, emissiveIntensity: 0.25 });
    const water = new THREE.Mesh(new THREE.CircleGeometry(R - 0.03, 20).rotateX(-Math.PI / 2), waterM); water.position.y = H - 0.07; water.receiveShadow = true; g.add(water);
    glow.push({ m: waterM, day: 0.2, night: 0.7 });
    // steam: one Points draw call
    const NS = mobile ? 8 : 14, sp = new Float32Array(NS * 3), seeds = []; for (let i = 0; i < NS; i++) seeds.push({ a: Math.random() * 6.28, r: Math.random() * 0.4, ph: Math.random() });
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const steam = new THREE.Points(sg, new THREE.PointsMaterial({ map: softTex(), size: 0.42, transparent: true, opacity: 0.38, depthWrite: false, color: 0xf4f6f8 })); steam.frustumCulled = false; g.add(steam);
    // capybara (visits now and then; always while mochi soaks, half the time)
    const capy = new THREE.Group(); capy.position.set(-0.32, H - 0.32, -0.3); capy.rotation.y = 0.7; capy.scale.setScalar(0.9); g.add(capy); const cb = batch(); const fur = mat(0x9a6a3e, { roughness: 1 }), furD = mat(0x6e4a2a, { roughness: 1 });
    cb.add(new THREE.SphereGeometry(0.3, 12, 8), fur, [0, 0.18, -0.08], [0, 0, 0], [0.9, 0.85, 1.25]);
    cb.add(new THREE.BoxGeometry(0.28, 0.24, 0.34), fur, [0, 0.38, 0.3], [0.15, 0, 0]);
    cb.add(new THREE.BoxGeometry(0.22, 0.18, 0.12), furD, [0, 0.34, 0.5], [0.15, 0, 0]);
    for (const s of [-1, 1]) { cb.add(new THREE.SphereGeometry(0.045, 8, 6), furD, [s * 0.11, 0.53, 0.22], [0, 0, 0], [1, 1, 0.5]); cb.add(new THREE.SphereGeometry(0.025, 8, 6), mat(0x0a0806, { roughness: 0.2 }), [s * 0.14, 0.45, 0.4]); }
    cb.add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10), mat(0xf28a2a), [0, 0.52, 0.32]); // a tiny orange on its head, as is tradition
    cb.build(capy, false); capy.visible = false;
    let visit = 20 + Math.random() * 30, visiting = 0;
    const tub = { pos: g.position.clone(), waterY: g.position.y + H - 0.07, H, capy, soaking: false };
    anim.push((t, dt) => { const pa = sg.attributes.position; const k = tub.soaking ? 1.6 : 1;
      for (let i = 0; i < NS; i++) { const s = seeds[i]; const u = (t * 0.22 * k + s.ph) % 1; pa.setXYZ(i, Math.cos(s.a + u * 2) * (s.r + u * 0.15), H + u * 1.1, Math.sin(s.a + u * 2) * (s.r + u * 0.15)); }
      pa.needsUpdate = true; steam.material.opacity = 0.3 * k;
      visit -= dt; if (visit < 0) { visiting = visiting ? 0 : 1; visit = visiting ? 40 + Math.random() * 40 : 60 + Math.random() * 90; }
      capy.visible = !!visiting || (tub.soaking && tub.capyJoin); if (capy.visible) { capy.position.y = H - 0.32 + Math.sin(t * 0.8) * 0.015; capy.rotation.z = Math.sin(t * 0.5) * 0.04; } });
    out.tub = tub;
  }

  // ── 3. the real tiny skateboard: a gift from Corey, parked by the ramp with a tag ──
  { const g = at(WISH.board, 0.0); g.rotation.y = 0.9; const board = new THREE.Group(); board.position.y = 0.07; g.add(board); const b = batch();
    b.add(new THREE.CapsuleGeometry(0.11, 0.42, 4, 10), mat(0x2f8f7a), [0, 0.03, 0], [Math.PI / 2, 0, 0], [1, 1, 0.16]);
    b.add(new THREE.CapsuleGeometry(0.1, 0.4, 4, 10), mat(0x1b1b1f, { roughness: 1 }), [0, 0.048, 0], [Math.PI / 2, 0, 0], [1, 1, 0.04]); // grip tape
    for (const z of [-0.2, 0.2]) { b.add(new THREE.BoxGeometry(0.16, 0.025, 0.04), iron, [0, -0.005, z]); for (const x of [-0.09, 0.09]) b.add(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10), mat(0xf6e27a), [x, -0.035, z], [0, 0, Math.PI / 2]); }
    b.add(new THREE.BoxGeometry(0.03, 0.002, 0.1), mat(0xff6b8a), [0, 0.056, 0.12]); b.add(new THREE.BoxGeometry(0.1, 0.002, 0.03), mat(0xff6b8a), [0, 0.056, 0.12]); // little pink bow sticker
    b.build(board);
    const tg = tag(g, ['gift from Corey'], [0.42, 0.55, -0.1], -0.4, 0.5, 47, 'pine', '🎁');
    batch().add(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 5), dark, [0.42, 0.27, -0.13]).build(g);
    out.giftBoard = { group: g, board, home: { pos: board.position.clone(), rot: board.rotation.clone() }, tag: tg, note: 'gift from Corey' };
  }

  // ── 5. tiny swing under the treehouse deck + 4. reading lantern up top ──
  { const T = BIGTREE, th = features.treehouse; const a = WISH.swingA; const top = T.ring(a, 1.85, th && th.stage >= 2 ? th.H - 0.06 : 3.0);
    const gy = groundY(top.x, top.z); const seatY = gy + 0.42; const L = top.y - seatY;
    const sw = new THREE.Group(); sw.position.copy(top); sw.rotation.y = -a; group.add(sw); // swings tangentially, clear of the trunk
    const b = batch(); for (const s of [-0.17, 0.17]) b.add(new THREE.CylinderGeometry(0.01, 0.01, L, 3), mat(0xc9a66b), [s, -L / 2, 0]);
    b.add(new THREE.BoxGeometry(0.42, 0.045, 0.24), mat(0xd9824a), [0, -L, 0]); b.build(sw);
    const seat = new THREE.Object3D(); seat.position.set(0, -L + 0.03, 0); sw.add(seat);
    const swing = { group: sw, seat, L, phase: 0, amp: 0.05, riding: false };
    anim.push((t, dt) => { const w = swing.riding ? 0.32 : 0.05 + 0.03 * Math.sin(t * 0.3); swing.amp += (w - swing.amp) * Math.min(1, dt * 0.8); swing.phase += dt * Math.sqrt(9.8 / Math.max(1, L)); sw.rotation.x = Math.sin(swing.phase) * swing.amp; });
    out.swing = swing;
    if (th && th.stage >= 2) { // reading lantern on the deck by the hammock side: emissive only (the stage-6 lantern already carries the one point light)
      const lm = new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffc46b, emissiveIntensity: 0.4 }); glow.push({ m: lm, day: 0.3, night: 3.5 });
      const lg = new THREE.Group(); const p = T.ring(T.standA + 0.55, T.deckR - 0.35, th.H + 0.06); lg.position.copy(p); group.add(lg);
      const lb = batch(); lb.add(new THREE.CylinderGeometry(0.07, 0.08, 0.025, 8), dark, [0, 0.012, 0]); lb.add(new THREE.ConeGeometry(0.075, 0.06, 6), dark, [0, 0.2, 0]); lb.add(new THREE.TorusGeometry(0.04, 0.008, 4, 10), dark, [0, 0.25, 0]);
      for (let i = 0; i < 4; i++) { const q = i * Math.PI / 2 + Math.PI / 4; lb.add(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 3), dark, [Math.cos(q) * 0.055, 0.1, Math.sin(q) * 0.055]); }
      lb.build(lg, false); const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 8), lm); bulb.position.y = 0.095; lg.add(bulb);
      out.readLantern = { group: lg, mat: lm };
    }
  }

  out.update = (t, dt, night) => { for (const f of anim) f(t, dt, night); };
  return out;
}

// wishlist items that now exist in the world. 'built' always wins over whatever status state.json says,
// so a later check-in that still says 'wanted' can't un-build them.
export const WISH_BUILT = [
  { re: /telescope/i, item: 'tiny telescope on the lookout cliff' },
  { re: /burrow|petrel/i, item: 'guest burrow for diving-petrels' },
  { re: /skate ?board/i, item: 'the real tiny skateboard', note: 'gift from Corey' },
  { re: /lantern/i, item: 'tiny lantern in the treehouse' },
  { re: /swing/i, item: 'tiny swing under the treehouse' },
  { re: /hot ?tub|capybara/i, item: 'capybara hot tub' },
  { re: /owl box|owlbox|owl house/i, item: 'owl box on the lookout cliff' },
  { re: /backpack/i, item: 'tiny backpack' },
];
export function applyWishBuilt(list) {
  const out = (Array.isArray(list) ? list : []).map((w) => (w && typeof w === 'object' ? { ...w } : { item: String(w) }));
  for (const b of WISH_BUILT) {
    const hit = out.filter((w) => b.re.test(String(w.item || w.name || '')));
    if (!hit.length) out.push({ item: b.item, status: 'built', note: b.note });
    for (const w of hit) { w.status = 'built'; if (b.note && !String(w.note || '').toLowerCase().includes('corey')) w.note = b.note; }
  }
  return out;
}
