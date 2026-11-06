// Interactive set pieces: garden plots, laptop, weather station, Cap-O-Matic, treehouse, mailbox flag + activity props
import * as THREE from 'three';
import { topH, groundY, mv, CLIFF, ZONES, VEND, DOCK, WATER_Y } from './layout.js';
import { canvasTex, signTex, woodTex } from './textures.js';
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
    add(s, new THREE.PlaneGeometry(0.7, 0.36), new THREE.MeshStandardMaterial({ map: signTex(['MOCHI FARMS', 'montana hardy'], { w: 384, h: 192, sizes: [52, 34] }), side: THREE.DoubleSide }), [0, 0.95, 0]); }
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
    add(ws, new THREE.PlaneGeometry(0.6, 0.14), new THREE.MeshStandardMaterial({ map: signTex(['MOCHI WEATHER STN'], { w: 512, h: 120, sizes: [60] }) }), [0, 1.03, 0.226], [0, 0, 0], null, false);
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

  // ── treehouse in the big tree (ladder on the west side) ──
  { const [tx, tz] = mv(4.4, -9.0); const ty = topH(tx, tz); const th = new THREE.Group(); th.position.set(tx, ty, tz); group.add(th); const H = 2.25;
    const wm = new THREE.MeshStandardMaterial({ map: woodTex('#b98a5a', 6, false), roughness: 0.85 });
    add(th, new THREE.BoxGeometry(2.0, 0.1, 1.7), wm, [-0.55, H, 0]); for (const [x, z] of [[-1.45, -0.75], [-1.45, 0.75]]) add(th, new THREE.CylinderGeometry(0.06, 0.07, H, 6), mat(0x6b4a33), [x, H / 2, z]);
    const cab = new THREE.Group(); cab.position.set(-0.75, H + 0.05, -0.2); th.add(cab); add(cab, new THREE.BoxGeometry(1.1, 0.8, 0.9), mat(0xd0a070), [0, 0.4, 0]); add(cab, new THREE.ConeGeometry(0.85, 0.5, 4), mat(snowyRoof(snowy)), [0, 1.05, 0], [0, Math.PI / 4, 0]);
    add(cab, new THREE.PlaneGeometry(0.34, 0.5), mat(0x5a3a22), [-0.2, 0.3, 0.451], [0, 0, 0], null, false); const wmn = new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffb04a, emissiveIntensity: 0.2 }); glow.push({ m: wmn, day: 0.15, night: 2.6 }); add(cab, new THREE.PlaneGeometry(0.22, 0.22), wmn, [0.28, 0.48, 0.451], [0, 0, 0], null, false);
    for (let i = 0; i < 9; i++) add(th, new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), mat(0xc9a66b), [-1.55, 0.2 + i * 0.25, 0.45], [0, 0, Math.PI / 2], null, false); for (const dz of [0.25, 0.65]) add(th, new THREE.CylinderGeometry(0.015, 0.015, H + 0.2, 4), mat(0xc9a66b), [-1.55, (H + 0.2) / 2, dz - 0.0], [0, 0, 0], null, false);
    add(th, new THREE.PlaneGeometry(0.5, 0.22), new THREE.MeshStandardMaterial({ map: signTex(['NO SQUIRRELS'], { w: 384, h: 140, sizes: [56] }), side: THREE.DoubleSide }), [-1.56, H - 0.3, 0.0], [0, -Math.PI / 2, 0], null, false);
    out.treehouse = { ladder: new THREE.Vector3(tx - 1.85, ty, tz + 0.45), deck: new THREE.Vector3(tx - 0.75, ty + H + 0.05, tz + 0.5), H };
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
  out.props = { rod, line, bobber, bucket, skewer, worm, can, board, pot, stone, rings, puffs, sparks, lineGeo };
  out.update = (t, dt, night) => { for (const f of anim) f(t, dt, night); };
  return out;
}
function snowyRoof(s) { return s ? 0xf3f6ff : 0x7a4a2a; }
