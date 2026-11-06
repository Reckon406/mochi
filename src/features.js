// Interactive set pieces: garden plots, laptop, weather station, Cap-O-Matic, treehouse, mailbox flag + activity props
import * as THREE from 'three';
import { topH, groundY, mv, CLIFF, ZONES, VEND, DOCK, WATER_Y, BIGTREE } from './layout.js';
import { canvasTex, signTex, woodTex, shingleTex } from './textures.js';
import { plank } from './signs.js';
import { parseWeather } from './weather.js';

const M = {}; const mat = (c, o = {}) => M[c + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
function add(p, g, m, pos = [0, 0, 0], rot = [0, 0, 0], sc = null, shadow = true) { const x = new THREE.Mesh(g, m); x.position.set(...pos); x.rotation.set(...rot); if (sc) (typeof sc === 'number' ? x.scale.setScalar(sc) : x.scale.set(...sc)); x.castShadow = shadow; x.receiveShadow = true; p.add(x); return x; }
const zone = (id) => ZONES.find((z) => z.id === id);
const local = (x, y, z, ry) => (lx, ly, lz) => new THREE.Vector3(x + lx * Math.cos(ry) + lz * Math.sin(ry), y + ly, z - lx * Math.sin(ry) + lz * Math.cos(ry));

export const CROPS = {
  carrot: { emoji: '🥕', days: 70, leaf: 0x5aa83a, fruit: 0xf28a2a },
  potato: { emoji: '🥔', days: 90, leaf: 0x4f8a36, fruit: 0xc8a070 },
  pumpkin: { emoji: '🎃', days: 100, leaf: 0x5a9a3a, fruit: 0xf07d1f },
  huckleberry: { emoji: '🫐', days: 120, leaf: 0x3f7a30, fruit: 0x3a2a6a },
  garlic: { emoji: '🧄', days: 240, leaf: 0x7ab05a, fruit: 0xf2ece0 },
  kale: { emoji: '🥬', days: 55, leaf: 0x2f6a3a, fruit: 0x3f7a4a },
};
export const DEFAULT_PLOTS = [{ crop: 'garlic', stage: 1 }, { crop: 'kale', stage: 3 }, { crop: 'carrot', stage: 4 }, { crop: 'potato', stage: 2 }, { crop: 'pumpkin', stage: 0 }, { crop: 'huckleberry', stage: 3 }];

export function buildFeatures(scene, { state, season, snowy, glow }) {
  const group = new THREE.Group(); group.name = 'features'; scene.add(group); const anim = []; const out = { group, anim };

  // ── garden plots (2 x 3) ──
  const plotsIn = state.garden && Array.isArray(state.garden.plots) ? state.garden.plots.slice(0, 6) : DEFAULT_PLOTS.map((p) => ({ ...p }));
  const slow = season === 'winter' || snowy ? 0.3 : season === 'fall' ? 0.7 : 1;
  const now = Date.now();
  const plots = plotsIn.map((p, i) => {
    const crop = CROPS[String(p.crop || '').toLowerCase()] ? String(p.crop).toLowerCase() : null; let stage = Number.isFinite(+p.stage) ? Math.max(0, Math.min(4, Math.round(+p.stage))) : 0;
    if (crop && !Number.isFinite(+p.stage) && p.planted) { const d = (now - new Date(p.planted).getTime()) / 864e5; if (d > 0) stage = Math.min(4, 1 + Math.floor((d * slow) / CROPS[crop].days * 3)); }
    const x = 5.2 + (i % 3) * 1.05, z = 15.4 + Math.floor(i / 3) * 1.1;
    const g = new THREE.Group(); g.position.set(x, topH(x, z) - 0.02, z); group.add(g);
    add(g, new THREE.BoxGeometry(0.9, 0.16, 0.9), mat(0x8a5a32), [0, 0.06, 0]); add(g, new THREE.BoxGeometry(0.78, 0.04, 0.78), mat(snowy ? 0xe8ecf4 : 0x4a3020, { roughness: 1 }), [0, 0.15, 0]);
    const plant = new THREE.Group(); plant.position.y = 0.17; g.add(plant);
    return { i, crop, stage, x, z, g, plant, grow: 0, watered: 0 };
  });
  function drawPlot(p) {
    p.plant.traverse((o) => { if (!o.isMesh) return; if (o.userData.tag) { o.material?.map?.dispose?.(); o.material?.dispose?.(); o.geometry?.dispose?.(); } });
    p.plant.clear(); const c = CROPS[p.crop]; if (!c || p.stage === 0) { if (p.crop) add(p.plant, new THREE.SphereGeometry(0.2, 10, 6, 0, 6.29, 0, 1.2), mat(0x5a3a24), [0, -0.05, 0], [0, 0, 0], [1, 0.3, 1]); return; }
    if (p.stage === 1) { for (let k = 0; k < 5; k++) add(p.plant, new THREE.SphereGeometry(0.025, 5, 4), mat(0xd8c090), [Math.sin(k * 2.4) * 0.22, 0.01, Math.cos(k * 2.4) * 0.22], [0, 0, 0], null, false); return; }
    const lm = mat(c.leaf); const n = p.stage === 2 ? 3 : 6; const h = p.stage === 2 ? 0.12 : p.crop === 'huckleberry' ? 0.55 : 0.32;
    for (let k = 0; k < n; k++) { const a = k * 2.4; const r = p.stage === 2 ? 0.05 : 0.14; add(p.plant, new THREE.ConeGeometry(0.05 + (p.crop === 'kale' ? 0.06 : 0), h, 4), lm, [Math.sin(a) * r, h / 2, Math.cos(a) * r], [Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4], null, false); }
    if (p.crop === 'huckleberry' && p.stage >= 3) add(p.plant, new THREE.IcosahedronGeometry(0.3, 1), lm, [0, 0.38, 0], [0, 0, 0], [1, 0.8, 1]);
    if (p.stage === 4) { const fm = mat(c.fruit, { roughness: 0.5 });
      if (p.crop === 'carrot') for (let k = 0; k < 4; k++) add(p.plant, new THREE.ConeGeometry(0.05, 0.12, 6), fm, [Math.sin(k * 1.6) * 0.18, 0.02, Math.cos(k * 1.6) * 0.18], [Math.PI, 0, 0]);
      if (p.crop === 'potato') { for (let k = 0; k < 3; k++) add(p.plant, new THREE.DodecahedronGeometry(0.07, 0), fm, [Math.sin(k * 2) * 0.24, 0.0, Math.cos(k * 2) * 0.24]); for (let k = 0; k < 4; k++) add(p.plant, new THREE.SphereGeometry(0.035, 6, 4), mat(0xf6f0ff), [Math.sin(k * 1.7) * 0.12, 0.36, Math.cos(k * 1.7) * 0.12], [0, 0, 0], null, false); }
      if (p.crop === 'pumpkin') add(p.plant, new THREE.SphereGeometry(0.2, 14, 10), fm, [0.12, 0.12, 0.05], [0, 0, 0], [1, 0.75, 1]);
      if (p.crop === 'huckleberry') for (let k = 0; k < 16; k++) add(p.plant, new THREE.SphereGeometry(0.03, 6, 4), fm, [Math.sin(k * 2.4) * 0.28, 0.32 + (k % 4) * 0.06, Math.cos(k * 2.4) * 0.26], [0, 0, 0], null, false);
      if (p.crop === 'garlic') for (let k = 0; k < 3; k++) add(p.plant, new THREE.SphereGeometry(0.06, 8, 6), fm, [Math.sin(k * 2) * 0.15, 0.02, Math.cos(k * 2) * 0.15], [0, 0, 0], [1, 0.8, 1]);
      if (p.crop === 'kale') add(p.plant, new THREE.IcosahedronGeometry(0.2, 1), mat(0x2f6a3a), [0, 0.22, 0], [0, 0, 0], [1, 0.7, 1]);
      const tag = add(p.plant, new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: signTex([c.emoji], { w: 128, h: 128, bg: '#fff3c9', sizes: [80] }), transparent: true }), [0.38, 0.35, 0.38], [0, 0.78, 0], null, false); tag.userData.tag = true; }
  }
  plots.forEach(drawPlot);
  { const s = new THREE.Group(); const [sx, sz] = [4.4, 16.0]; s.position.set(sx, topH(sx, sz), sz); s.rotation.y = 1.2; group.add(s); add(s, new THREE.CylinderGeometry(0.035, 0.04, 0.9, 6), mat(0x7a5232), [0, 0.45, 0]);
    { const pk = plank(['MOCHI FARMS', 'montana hardy'], { width: 0.85, twoSided: true, icon: '🥕', tone: 'pine', seed: 8 }); pk.position.set(0, 0.95, 0); s.add(pk); } }
  out.plots = plots; out.drawPlot = drawPlot; out.growSlow = slow;

  // ── laptop on the picnic table ──
  { const [px, pz] = mv(-3.2, 1.6); const ry = 0.3; const L = local(px, topH(px, pz) - 0.03, pz, ry); const p = L(-0.35, 0.795, -0.05);
    const sp = zone('picnic').spot; const yaw = Math.atan2(sp[0] - p.x, sp[1] - p.z);
    const lp = new THREE.Group(); lp.position.copy(p); lp.rotation.y = yaw; group.add(lp);
    add(lp, new THREE.BoxGeometry(0.46, 0.025, 0.32), mat(0xb8bcc4, { metalness: 0.6, roughness: 0.35 }), [0, 0.012, 0]);
    const lid = new THREE.Group(); lid.position.set(0, 0.025, -0.16); lid.rotation.x = -0.25; lp.add(lid);
    add(lid, new THREE.BoxGeometry(0.46, 0.3, 0.02), mat(0xb8bcc4, { metalness: 0.6, roughness: 0.35 }), [0, 0.15, -0.01]);
    let screenTex = null; const sm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 0.9 });
    const screen = add(lid, new THREE.PlaneGeometry(0.42, 0.26), sm, [0, 0.15, 0.001], [0, 0, 0], null, false); screen.rotation.y = 0;
    add(lid, new THREE.CircleGeometry(0.02, 12), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), [0, 0.15, -0.021], [0, Math.PI, 0], null, false); // logo on the back
    const lt = new THREE.PointLight(0x9ad0ff, 0, 2.2, 1.6); lt.position.set(0, 0.25, 0.25); lp.add(lt);
    const L2 = state.laptop || {}; const list = Array.isArray(L2.browsing) ? L2.browsing : [];
    const lines = () => { const last = list[list.length - 1]; const site = String(L2.site || (last && last.site) || 'mochinet'); const txt = String(L2.screen || (last && (last.title || last.text)) || L2.last || 'loading the entire internet...'); return [site, txt]; };
    function setScreen(lns) { const [site, txt] = lns; screenTex?.dispose(); screenTex = canvasTex(512, 320, (g, w, h) => {
      g.fillStyle = '#eef4ff'; g.fillRect(0, 0, w, h); g.fillStyle = '#3b6fd8'; g.fillRect(0, 0, w, 54); g.fillStyle = '#fff'; g.font = 'bold 28px sans-serif'; g.fillText('🌐 ' + site.slice(0, 26), 16, 37);
      g.fillStyle = '#1f2a3a'; g.font = 'bold 30px sans-serif'; const words = txt.split(/\s+/); let line = '', y = 100; for (const wd of words) { if ((line + ' ' + wd).length > 24) { g.fillText(line, 18, y); y += 40; line = wd; if (y > 290) break; } else line = (line + ' ' + wd).trim(); } if (y <= 290) g.fillText(line, 18, y);
    }); sm.emissiveMap = screenTex; sm.map = screenTex; sm.needsUpdate = true; }
    setScreen(lines());
    out.laptop = { pos: p, yaw, lid, light: lt, setScreen, lines, list };
    anim.push((t, dt, night) => { lt.intensity = 0.4 + night * 1.6; sm.emissiveIntensity = 0.7 + 0.08 * Math.sin(t * 3); });
  }

  // ── weather station on the lookout cliff (reads STATE.weather) ──
  { const x = CLIFF.x + 0.2, z = CLIFF.z + 2.3, y = topH(x, z); const ws = new THREE.Group(); ws.position.set(x, y - 0.03, z); ws.rotation.y = Math.atan2(-x, -z); group.add(ws);
    add(ws, new THREE.CylinderGeometry(0.04, 0.05, 2.2, 8), mat(0xd0d4d8, { metalness: 0.6 }), [0, 1.1, 0]);
    const cups = new THREE.Group(); cups.position.y = 2.25; ws.add(cups); for (let i = 0; i < 3; i++) { const a = i * 2.094; add(cups, new THREE.CylinderGeometry(0.008, 0.008, 0.36, 4), mat(0x888888), [Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18], [0, -a, Math.PI / 2], null, false); add(cups, new THREE.SphereGeometry(0.05, 8, 6, 0, 6.29, 0, 1.6), mat(0xe8463c), [Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36], [0, -a, Math.PI / 2]); }
    const vane = new THREE.Group(); vane.position.y = 1.95; ws.add(vane); add(vane, new THREE.BoxGeometry(0.02, 0.02, 0.5), mat(0x555555), [0, 0, 0], [0, 0, 0], null, false); add(vane, new THREE.ConeGeometry(0.04, 0.1, 6), mat(0x555555), [0, 0, 0.28], [Math.PI / 2, 0, 0], null, false); add(vane, new THREE.PlaneGeometry(0.16, 0.12), mat(0x555555, { side: THREE.DoubleSide }), [0, 0, -0.24], [0, Math.PI / 2, 0], null, false);
    add(ws, new THREE.BoxGeometry(0.42, 0.42, 0.3), mat(0xf6f6f2), [0, 1.2, 0]); for (let i = 0; i < 4; i++) add(ws, new THREE.BoxGeometry(0.44, 0.02, 0.32), mat(0xdcdcd4), [0, 1.04 + i * 0.1, 0], [0, 0, 0], null, false);
    const w = parseWeather(state.weather || ''); const temp = w.tempF != null ? `${w.tempF}°F` : '??°F'; const cond = String(state.weather || 'unknown').replace(/,?\s*-?\d+\s*°?\s*f\b/i, '').trim().slice(0, 22) || 'mystery';
    const panel = new THREE.Group(); panel.position.set(0, 0.75, 0.22); ws.add(panel); add(panel, new THREE.BoxGeometry(0.62, 0.42, 0.05), mat(0x3a3a44), [0, 0, 0]);
    const dm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: signTex([temp, cond], { w: 384, h: 256, bg: '#0f2a1a', fg: '#7dff9a', border: '#0f2a1a', sizes: [96, 40] }) }); dm.map = dm.emissiveMap;
    add(panel, new THREE.PlaneGeometry(0.56, 0.36), dm, [0, 0, 0.026], [0, 0, 0], null, false);
    { const pk = plank(['WEATHER STN'], { width: 0.6, icon: '🌡️', tone: 'cream', seed: 9, thick: 0.02 }); pk.position.set(0, 1.03, 0.235); ws.add(pk); }
    const wind = w.windAmt || 0.12; anim.push((t, dt) => { cups.rotation.y += dt * (2 + wind * 14); vane.rotation.y = Math.sin(t * 0.3) * 0.3 * (0.2 + wind); });
    glow.push({ m: dm, day: 0.8, night: 1.4 }); out.station = { temp, cond, pos: new THREE.Vector3(x, y, z) };
  }

  // ── Cap-O-Matic: spend bottle caps on trinkets ──
  { const v = new THREE.Group(); v.position.set(VEND.x, topH(VEND.x, VEND.z) - 0.03, VEND.z); v.rotation.y = VEND.yaw; group.add(v);
    add(v, new THREE.BoxGeometry(0.9, 1.7, 0.6), mat(0xd23c3c, { roughness: 0.45 }), [0, 0.85, 0]); add(v, new THREE.BoxGeometry(0.96, 0.12, 0.66), mat(0xf2c23a, { metalness: 0.4, roughness: 0.4 }), [0, 1.74, 0]);
    add(v, new THREE.PlaneGeometry(0.6, 0.62), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.35, roughness: 0.1 }), [0, 1.12, 0.302], [0, 0, 0], null, false);
    const caps = [0xff6b8a, 0x4fb3e8, 0xffd34d, 0x5ac26a, 0xc9b6ff, 0xffffff]; for (let i = 0; i < 14; i++) add(v, new THREE.SphereGeometry(0.07, 10, 8), mat(caps[i % caps.length], { roughness: 0.3 }), [-0.22 + (i % 4) * 0.15, 0.9 + Math.floor(i / 4) * 0.13, 0.15], [0, 0, 0], null, false);
    add(v, new THREE.PlaneGeometry(0.78, 0.26), new THREE.MeshStandardMaterial({ map: signTex(['CAP-O-MATIC', '3 caps = 1 trinket'], { w: 512, h: 170, sizes: [70, 38], bg: '#fff3c9' }), emissive: 0x332200 }), [0, 1.57, 0.302], [0, 0, 0], null, false);
    add(v, new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16), mat(0xc8c8d0, { metalness: 0.8, roughness: 0.3 }), [0.3, 0.62, 0.31], [Math.PI / 2, 0, 0]);
    add(v, new THREE.BoxGeometry(0.3, 0.16, 0.1), mat(0x2a2a2a), [-0.12, 0.35, 0.3]);
    const knob = add(v, new THREE.CylinderGeometry(0.06, 0.06, 0.08, 6), mat(0xf2c23a, { metalness: 0.5 }), [0.3, 0.62, 0.36], [Math.PI / 2, 0, 0]);
    const glowM = new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffe08a, emissiveIntensity: 0.5 }); glow.push({ m: glowM, day: 0.4, night: 3 }); add(v, new THREE.BoxGeometry(0.7, 0.04, 0.04), glowM, [0, 1.47, 0.31], [0, 0, 0], null, false);
    const cap = add(v, new THREE.SphereGeometry(0.08, 10, 8), mat(0xff6b8a, { roughness: 0.3 }), [-0.12, 0.38, 0.4], [0, 0, 0], null, false); cap.visible = false;
    out.vend = { group: v, knob, cap };
  }

  // ── staged treehouse in the big tree (STATE.treehouse.stage 0-6, parts[]; default stage 2). The bot advances it, never the browser. ──
  { const T = BIGTREE; const th = new THREE.Group(); th.name = 'treehouse'; th.position.set(T.x, T.y, T.z); group.add(th);
    const tcfg = state.treehouse && typeof state.treehouse === 'object' ? state.treehouse : {}; const stage = Math.max(0, Math.min(6, Math.round(Number.isFinite(+tcfg.stage) ? +tcfg.stage : 2)));
    const parts = new Set((Array.isArray(tcfg.parts) ? tcfg.parts : []).map((p) => String(p).toLowerCase().replace(/[\s_-]+/g, ' ').trim()));
    const H = T.deckH, R = T.deckR; const P = (a, r, h = 0) => [Math.cos(a) * r, h, Math.sin(a) * r];
    const wm = new THREE.MeshStandardMaterial({ map: woodTex('#b98a5a', 6, false), roughness: 0.85 }); const dark = mat(0x6b4a33), rope = mat(0xc9a66b), plankM = mat(0xa87a4c);
    // beams (stage >= 1): two crossing joists bolted to the trunk + diagonal braces
    if (stage >= 1) { for (const a of [T.ladderA, T.ladderA + Math.PI / 2]) add(th, new THREE.BoxGeometry(R * 2.05, 0.14, 0.16), dark, [0, H - 0.12, 0], [0, -a, 0]);
      for (const a of stage >= 2 ? [0.2, 1.77, 3.34, 4.91] : [T.ladderA - 0.3, T.ladderA + 0.3]) { const b = add(th, new THREE.CylinderGeometry(0.06, 0.07, 2.1, 6), dark, P(a, 1.25, H - 0.85)); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(a) * 0.62, 1, Math.sin(a) * 0.62).normalize()); } }
    if (stage === 1) for (let i = 0; i < 4; i++) add(th, new THREE.BoxGeometry(0.34, 0.06, 1.5 - i * 0.12), plankM, P(T.ladderA, R - 0.25 - i * 0.37, H - 0.02 + (i % 2) * 0.01), [0, -T.ladderA, (i - 1.5) * 0.02]);
    if (stage >= 2) { const dk = add(th, new THREE.CylinderGeometry(R, R, 0.12, 8), wm, [0, H, 0], [0, Math.PI / 8, 0]); dk.material.map.repeat.set(2, 2);
      add(th, new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.06, 8, 1, true), dark, [0, H - 0.06, 0], [0, Math.PI / 8, 0]); }
    // railings (stage >= 3): posts at the octagon corners, two rails per side, a gap at the ladder
    const corner = (i) => { const a = i / 8 * Math.PI * 2; return [Math.cos(a) * R * 0.96, Math.sin(a) * R * 0.96]; };
    const sideA = (i) => (i + 0.5) / 8 * Math.PI * 2; const angD = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    if (stage >= 3) for (let i = 0; i < 8; i++) { const [x0, z0] = corner(i), [x1, z1] = corner(i + 1); add(th, new THREE.CylinderGeometry(0.045, 0.05, 0.78, 6), dark, [x0, H + 0.39, z0]);
      if (angD(sideA(i), T.ladderA) < 0.4) continue; const len = Math.hypot(x1 - x0, z1 - z0), mid = [(x0 + x1) / 2, (z0 + z1) / 2], yaw = -Math.atan2(z1 - z0, x1 - x0);
      for (const hh of [0.42, 0.74]) add(th, new THREE.BoxGeometry(len, 0.06, 0.06), plankM, [mid[0], H + hh, mid[1]], [0, yaw, 0]);
      for (let k = 1; k < 4; k++) add(th, new THREE.BoxGeometry(0.04, 0.34, 0.03), plankM, [x0 + (x1 - x0) * k / 4, H + 0.24, z0 + (z1 - z0) * k / 4], [0, yaw, 0], null, false); }
    // cabin (walls stage >= 4; roof, door and window stage >= 5)
    let winM = null; const cab = new THREE.Group(); { const [cx, , cz] = P(T.cabinA, 1.3); cab.position.set(cx, H + 0.06, cz); cab.rotation.y = Math.PI / 2 - T.cabinA; th.add(cab); }
    if (stage >= 4) { const cw = new THREE.MeshStandardMaterial({ map: woodTex('#c99a66', 7, true), roughness: 0.85 }); add(cab, new THREE.BoxGeometry(1.45, 1.05, 1.0), cw, [0, 0.52, 0]);
      for (const x of [-0.72, 0.72]) for (const z of [-0.5, 0.5]) add(cab, new THREE.BoxGeometry(0.08, 1.08, 0.08), dark, [x, 0.54, z], [0, 0, 0], null, false); }
    if (stage >= 5) { const rf = new THREE.MeshStandardMaterial({ map: shingleTex(snowy ? '#e8eef8' : '#9a4b32'), roughness: 0.9 });
      for (const sd of [-1, 1]) add(cab, new THREE.BoxGeometry(1.75, 0.07, 0.78), rf, [0, 1.3, sd * 0.32], [sd * 0.62, 0, 0]);
      const gab = new THREE.Shape(); gab.moveTo(-0.62, 0); gab.lineTo(0.62, 0); gab.lineTo(0, 0.42); gab.closePath(); const gg = new THREE.ShapeGeometry(gab); gg.rotateY(Math.PI / 2);
      for (const x of [-0.72, 0.72]) add(cab, gg, mat(0xc99a66, { side: THREE.DoubleSide }), [x, 1.05, 0], [0, 0, 0], null, false);
      add(cab, new THREE.BoxGeometry(0.4, 0.68, 0.04), mat(0x7a4a2a), [-0.32, 0.36, 0.51], [0, 0, 0], null, false); add(cab, new THREE.SphereGeometry(0.03, 6, 5), mat(0xffd36b, { metalness: 0.6, roughness: 0.3 }), [-0.2, 0.36, 0.54], [0, 0, 0], null, false);
      winM = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, emissive: 0xffb04a, emissiveIntensity: 0.2 }); glow.push({ m: winM, day: 0.15, night: 2.6 });
      add(cab, new THREE.PlaneGeometry(0.34, 0.3), winM, [0.3, 0.55, 0.511], [0, 0, 0], null, false); add(cab, new THREE.BoxGeometry(0.42, 0.04, 0.05), dark, [0.3, 0.38, 0.52], [0, 0, 0], null, false);
      add(cab, new THREE.BoxGeometry(0.04, 0.3, 0.02), dark, [0.3, 0.55, 0.52], [0, 0, 0], null, false); add(cab, new THREE.BoxGeometry(0.34, 0.04, 0.02), dark, [0.3, 0.55, 0.52], [0, 0, 0], null, false); }
    // rope ladder (stage >= 1) down the spot side
    if (stage >= 1) { const lad = new THREE.Group(); const [lx, , lz] = P(T.ladderA, R + 0.05); lad.position.set(lx, 0, lz); lad.rotation.y = Math.PI / 2 - T.ladderA; th.add(lad); lad.rotation.x = 0;
      for (const sx of [-0.24, 0.24]) add(lad, new THREE.CylinderGeometry(0.018, 0.018, H + 0.3, 4), rope, [sx, (H + 0.3) / 2 - 0.15, 0], [0, 0, 0], null, false);
      for (let i = 0; i < Math.floor(H / 0.3); i++) add(lad, new THREE.BoxGeometry(0.52, 0.04, 0.07), plankM, [0, 0.25 + i * 0.3, 0], [0, 0, (i % 2 ? 1 : -1) * 0.03], null, false); }
    // NO SQUIRRELS plank on the trunk by the ladder (always — it's a policy, not a building stage)
    { const pk = plank(['NO SQUIRRELS'], { width: 0.8, icon: '🚫', tone: 'cream', seed: 13 }); const [px, , pz] = P(T.ladderA + 0.45, T.radiusAt(1.5) + 0.22); pk.position.set(px, 1.5, pz); pk.rotation.set(0, Math.PI / 2 - T.ladderA - 0.45, 0.06); th.add(pk); }
    // decorations (stage 6): lantern, sock banner, pulley bucket, flag on the roof
    let lantern = null;
    if (stage >= 6) {
      const lm = new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffc46b, emissiveIntensity: 0.6 }); glow.push({ m: lm, day: 0.5, night: 3.2 });
      lantern = new THREE.Group(); const [qx, , qz] = P(T.cabinA + 0.75, R * 0.9); lantern.position.set(qx, H + 0.95, qz); th.add(lantern);
      add(lantern, new THREE.CylinderGeometry(0.008, 0.008, 0.2, 3), dark, [0, 0.12, 0], [0, 0, 0], null, false); add(lantern, new THREE.BoxGeometry(0.13, 0.17, 0.13), lm, [0, -0.07, 0], [0, 0, 0], null, false); add(lantern, new THREE.ConeGeometry(0.11, 0.08, 4), dark, [0, 0.05, 0], [0, Math.PI / 4, 0], null, false);
      const pl = new THREE.PointLight(0xffb45a, 0, 6, 1.6); pl.position.y = -0.1; lantern.add(pl); out.lanternLight = pl;
      // sock banner: striped sock flying from a rail pole
      const sockT = canvasTex(128, 192, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = ['#ff6b8a', '#fff3c9', '#4aa8ff', '#fff3c9'][i % 4]; g.fillRect(0, i * h / 8, w, h / 8 + 1); } }, {});
      const sk = new THREE.Shape(); sk.moveTo(0, 0); sk.lineTo(0.22, 0); sk.lineTo(0.22, -0.42); sk.quadraticCurveTo(0.26, -0.58, 0.08, -0.58); sk.lineTo(-0.12, -0.58); sk.quadraticCurveTo(-0.2, -0.5, -0.08, -0.42); sk.lineTo(0, -0.42); sk.closePath();
      const sg = new THREE.ShapeGeometry(sk); { const uv = sg.attributes.uv, p = sg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + 0.2) / 0.46, 1 + p.getY(i) / 0.6); }
      const pole = new THREE.Group(); const [sx2, , sz2] = P(T.ladderA + 1.2, R * 0.96); pole.position.set(sx2, H, sz2); th.add(pole); add(pole, new THREE.CylinderGeometry(0.025, 0.025, 1.6, 5), dark, [0, 0.8, 0]);
      const sock = add(pole, sg, new THREE.MeshStandardMaterial({ map: sockT, side: THREE.DoubleSide, roughness: 0.9 }), [0.02, 1.55, 0], [0, 0, 0], null, false); out.sock = sock;
      // pulley bucket: an arm off the railing, rope down to a bucket hanging halfway
      const arm = new THREE.Group(); const [ax2, , az2] = P(T.ladderA - 0.9, R * 0.96); arm.position.set(ax2, H, az2); arm.rotation.y = Math.PI / 2 - (T.ladderA - 0.9); th.add(arm);
      add(arm, new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5), dark, [0, 0.55, 0]); add(arm, new THREE.BoxGeometry(0.06, 0.06, 0.7), dark, [0, 1.08, 0.32]); add(arm, new THREE.TorusGeometry(0.08, 0.02, 5, 10), mat(0x8a8a8a, { metalness: 0.6 }), [0, 1.0, 0.62], [0, Math.PI / 2, 0], null, false);
      add(arm, new THREE.CylinderGeometry(0.008, 0.008, 2.1, 3), rope, [0, -0.05, 0.62], [0, 0, 0], null, false);
      const bk = add(arm, new THREE.CylinderGeometry(0.13, 0.1, 0.2, 9, 1, true), mat(0x8a8a8a, { metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }), [0, -1.1, 0.62]); out.pulley = bk;
      // flag on the cabin roof
      if (stage >= 5) { add(cab, new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), dark, [0.55, 1.6, 0], [0, 0, 0], null, false); const fg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.22, 0), new THREE.Vector3(0.36, -0.11, 0)]); fg.computeVertexNormals();
        out.flag = add(cab, fg, mat(0xffd36b, { side: THREE.DoubleSide }), [0.56, 1.92, 0], [0, 0, 0], null, false); }
    }
    // extra parts from STATE.treehouse.parts
    if (parts.has('telescope') && stage >= 2) { const tg = new THREE.Group(); const [x, , z] = P(T.cabinA + 1.35, 1.55); tg.position.set(x, H + 0.06, z); tg.rotation.y = Math.PI / 2 - (T.cabinA + 1.35); th.add(tg);
      for (let i = 0; i < 3; i++) add(tg, new THREE.CylinderGeometry(0.012, 0.012, 0.6, 3), dark, [Math.cos(i * 2.1) * 0.1, 0.28, Math.sin(i * 2.1) * 0.1], [Math.sin(i * 2.1) * 0.3, 0, -Math.cos(i * 2.1) * 0.3], null, false);
      add(tg, new THREE.CylinderGeometry(0.045, 0.07, 0.62, 10), mat(0xc9a14a, { metalness: 0.7, roughness: 0.3 }), [0, 0.62, 0.12], [1.05, 0, 0]); }
    if (parts.has('hammock')) { const a = T.cabinA + 1.5; const [x1, , z1] = P(a, T.radiusAt(1.2) - 0.05), [x2, , z2] = P(a, 3.9); const y2 = groundY(T.x + x2, T.z + z2) - T.y;
      add(th, new THREE.CylinderGeometry(0.06, 0.07, 1.6, 6), dark, [x2, y2 + 0.8, z2]); const mid = new THREE.Vector3((x1 + x2) / 2, 0.75, (z1 + z2) / 2); const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x1, 1.25, z1), mid.clone().setY(0.35), new THREE.Vector3(x2, y2 + 1.5, z2));
      // fabric sling (flat ribbon), not a blue tube
      { const segs = 28, W = 0.72; const pos = [], uv = [], idx = [], nrm = []; const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), tan = new THREE.Vector3(), p = new THREE.Vector3(), a2 = new THREE.Vector3(), b2 = new THREE.Vector3();
        for (let i = 0; i <= segs; i++) { const u = i / segs; curve.getPoint(u, p); curve.getTangent(u, tan).normalize(); side.crossVectors(tan, up); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize().multiplyScalar(W * 0.5);
          a2.copy(p).add(side); b2.copy(p).sub(side); pos.push(a2.x, a2.y, a2.z, b2.x, b2.y, b2.z); uv.push(0, u, 1, u); nrm.push(0, 1, 0, 0, 1, 0);
          if (i < segs) { const i0 = i * 2; idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); } }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); geo.setIndex(idx); geo.computeVertexNormals();
        const tex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#4aa8ff'; g.fillRect(0, 0, 128, 64); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#3a90e8' : '#6bbcff'; g.fillRect(i * 16, 0, 16, 64); } g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 28, 128, 8); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
        add(th, geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.95, metalness: 0 }), [0, 0, 0], [0, 0, 0], null, false);
        // thin ropes at each end
        add(th, new THREE.CylinderGeometry(0.012, 0.012, 0.35, 4), rope, [x1, 1.35, z1], [0.4, 0, 0], null, false);
        add(th, new THREE.CylinderGeometry(0.012, 0.012, 0.35, 4), rope, [x2, y2 + 1.55, z2], [-0.3, 0, 0], null, false);
      } }
    if (parts.has('zipline') && stage >= 2) { const a = Math.atan2(-T.z, -T.x); const s0 = new THREE.Vector3(...P(a, R * 0.9, H + 1.2)); const ex = T.x + Math.cos(a) * 11, ez = T.z + Math.sin(a) * 11; const e = new THREE.Vector3(ex - T.x, groundY(ex, ez) - T.y + 1.0, ez - T.z);
      add(th, new THREE.CylinderGeometry(0.03, 0.035, 1.25, 5), dark, [s0.x, H + 0.6, s0.z]); add(th, new THREE.CylinderGeometry(0.06, 0.07, 1.3, 6), dark, [e.x, e.y - 0.4, e.z]);
      const d = e.clone().sub(s0); const c = add(th, new THREE.CylinderGeometry(0.008, 0.008, d.length(), 3), mat(0x9a9a9a, { metalness: 0.6 }), s0.clone().addScaledVector(d, 0.5).toArray(), [0, 0, 0], null, false); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      add(th, new THREE.TorusGeometry(0.12, 0.02, 5, 10), mat(0xff6b8a), s0.clone().addScaledVector(d, 0.12).add(new THREE.Vector3(0, -0.18, 0)).toArray(), [0, -a, 0], null, false); }
    if (parts.has('bird feeder')) { const hk = T.limbPoint(T.feederA, 2.2).sub(new THREE.Vector3(T.x, T.y, T.z)); add(th, new THREE.CylinderGeometry(0.006, 0.006, 0.6, 3), rope, [hk.x, hk.y - 0.3, hk.z], [0, 0, 0], null, false);
      const bf = new THREE.Group(); bf.position.set(hk.x, hk.y - 0.75, hk.z); th.add(bf); add(bf, new THREE.BoxGeometry(0.22, 0.2, 0.22), mat(0xd0a070), [0, 0, 0]); add(bf, new THREE.ConeGeometry(0.2, 0.14, 4), mat(0x9a4b32), [0, 0.17, 0], [0, Math.PI / 4, 0]); add(bf, new THREE.BoxGeometry(0.32, 0.03, 0.32), mat(0x8a5a32), [0, -0.11, 0]); add(bf, new THREE.CircleGeometry(0.05, 8), mat(0x2a1a10), [0, 0, 0.111], [0, 0, 0], null, false); }
    // where Mochi goes: ladder foot, top of ladder (on the deck/planks), a standing spot facing the camera side
    const W = (a, r, h) => new THREE.Vector3(T.x + Math.cos(a) * r, T.y + h, T.z + Math.sin(a) * r);
    const foot = W(T.ladderA, R + 0.35, 0); foot.y = groundY(foot.x, foot.z);
    out.treehouse = { group: th, stage, parts: [...parts], H, ladder: foot, top: W(T.ladderA, R - 0.45, H + 0.06), deck: stage >= 2 ? W(T.standA, R - 0.55, H + 0.06) : W(T.ladderA, R - 0.45, H + 0.06), deckY: T.y + H + 0.06, cabin: cab, lantern, max: 6 };
  }


  // ── mailbox flag (red flag up = unread mail) ──
  { const [hx, hz] = mv(-4.2, -8.0); const L = local(hx, topH(hx, hz) - 0.05, hz, 0.5); const p = L(1.17, 0.95, 2.1);
    const f = new THREE.Group(); f.position.copy(p); f.rotation.y = 0.5; group.add(f); add(f, new THREE.BoxGeometry(0.02, 0.24, 0.02), mat(0xe8463c), [0, 0.12, 0]); add(f, new THREE.BoxGeometry(0.02, 0.1, 0.14), mat(0xe8463c), [0, 0.2, 0.07]);
    const mail = Array.isArray(state.mail) ? state.mail : []; const unread = mail.filter((m) => m && (m.unread === true || m.read === false)); f.rotation.z = unread.length ? 0 : -Math.PI / 2;
    out.mailbox = { flag: f, unread, pos: p };
  }

  // ── activity props (moved around by life.js) ──
  const rod = new THREE.Group(); add(rod, new THREE.CylinderGeometry(0.008, 0.016, 1.6, 5), mat(0x3a2a1a), [0, 0.8, 0], [0, 0, 0], null, false); add(rod, new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), mat(0x999999, { metalness: 0.7 }), [0.03, 0.2, 0], [0, 0, Math.PI / 2], null, false); rod.visible = false; group.add(rod);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf6f6f6, transparent: true, opacity: 0.7 })); line.visible = false; line.frustumCulled = false; group.add(line);
  const bobber = new THREE.Group(); add(bobber, new THREE.SphereGeometry(0.07, 10, 8, 0, 6.29, 0, 1.57), mat(0xe8463c), [0, 0, 0], [0, 0, 0], null, false); add(bobber, new THREE.SphereGeometry(0.07, 10, 8, 0, 6.29, 1.57, 1.57), mat(0xffffff), [0, 0, 0], [0, 0, 0], null, false); bobber.visible = false; group.add(bobber);
  const bucket = new THREE.Group(); { const p = new THREE.Vector3(DOCK.x0 + DOCK.dx * 1.0 + DOCK.dz * 0.5, DOCK.y, DOCK.z0 + DOCK.dz * 1.0 - DOCK.dx * 0.5); bucket.position.copy(p); add(bucket, new THREE.CylinderGeometry(0.16, 0.12, 0.26, 12, 1, true), mat(0xb8bcc4, { metalness: 0.5, side: THREE.DoubleSide }), [0, 0.13, 0]); group.add(bucket); }
  const fire = zone('campfire').pos; const skewer = new THREE.Group(); skewer.position.set(fire[0], topH(fire[0], fire[1]) + 0.75, fire[1]); group.add(skewer); skewer.visible = false;
  add(skewer, new THREE.CylinderGeometry(0.01, 0.01, 1.4, 4), mat(0xc9a66b), [0, 0, 0], [0, 0, Math.PI / 2], null, false); for (const s of [-1, 1]) add(skewer, new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4), mat(0x7a5232), [s * 0.66, -0.38, 0], [0, 0, 0], null, false);
  const worm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-0.08, 0, 0], [-0.03, 0.03, 0.02], [0.02, -0.02, 0], [0.08, 0.02, 0.01]].map((v) => new THREE.Vector3(...v))), 12, 0.014, 6), mat(0xe08a9a, { roughness: 0.4 }));
  const can = new THREE.Group(); add(can, new THREE.CylinderGeometry(0.1, 0.12, 0.18, 10), mat(0x5aa0c8, { metalness: 0.5, roughness: 0.4 }), [0, 0, 0]); add(can, new THREE.CylinderGeometry(0.015, 0.02, 0.22, 6), mat(0x5aa0c8, { metalness: 0.5 }), [0, 0.06, 0.15], [1.0, 0, 0]);
  const board = new THREE.Group(); add(board, new THREE.CapsuleGeometry(0.12, 0.45, 4, 10), mat(0xff5a5a), [0, 0.04, 0], [0, 0, Math.PI / 2], [1, 0.18, 1]); for (const a of [-0.24, 0.24]) for (const b of [-0.08, 0.08]) add(board, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), mat(0xffee88), [a, -0.01, b], [Math.PI / 2, 0, 0]); board.rotation.y = Math.PI / 2;
  const pot = new THREE.Group(); add(pot, new THREE.CylinderGeometry(0.12, 0.1, 0.12, 12), mat(0x555a60, { metalness: 0.6, roughness: 0.4 }), [0, 0, 0]); add(pot, new THREE.CylinderGeometry(0.01, 0.01, 0.25, 4), mat(0x333333), [0, 0, 0.17], [Math.PI / 2, 0, 0]);
  const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 0), mat(0x9a948e)); stone.visible = false; group.add(stone);
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }); const rings = []; for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.2, 24).rotateX(-Math.PI / 2), ringM.clone()); r.visible = false; group.add(r); rings.push(r); }
  const puffM = new THREE.MeshStandardMaterial({ color: 0xdedede, transparent: true, opacity: 0, depthWrite: false }); const puffs = []; for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), puffM.clone()); p.visible = false; group.add(p); puffs.push(p); }
  const sparkM = new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0 }); const sparks = []; for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), sparkM.clone()); p.visible = false; group.add(p); sparks.push(p); }
  const plankP = new THREE.Group(); add(plankP, new THREE.BoxGeometry(0.62, 0.05, 0.14), mat(0xd9a86a), [0.18, 0, 0]); plankP.visible = false; scene.add(plankP);
  const hammer = new THREE.Group(); add(hammer, new THREE.CylinderGeometry(0.015, 0.015, 0.26, 5), mat(0x8a5a32), [0, 0.13, 0], [0, 0, 0], null, false); add(hammer, new THREE.BoxGeometry(0.11, 0.05, 0.05), mat(0x777777, { metalness: 0.6, roughness: 0.4 }), [0, 0.26, 0], [0, 0, 0], null, false); hammer.visible = false; scene.add(hammer);
  out.props = { rod, line, bobber, bucket, skewer, worm, can, board, pot, stone, rings, puffs, sparks, lineGeo, plank: plankP, hammer };
  out.update = (t, dt, night) => { for (const f of anim) f(t, dt, night); };
  return out;
}
function snowyRoof(s) { return s ? 0xf3f6ff : 0x7a4a2a; }
