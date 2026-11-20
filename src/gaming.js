// 🎮 gaming nook by the hut: flat-screen TV on a low console, a generic white/black games console, a pad, a beanbag.
// The TV runs a home-made parody game ("Grand Theft Avian VI": neon beach drive, palms, pink/teal sunset, HUD) on a CanvasTexture.
// STATE: world.gaming = { game, hours, found, discSpot } (all optional). No real game assets or logos anywhere.
import * as THREE from 'three';
import { GAMING, topH, groundY } from './layout.js';

// where the disc can be hiding (behind the hut, under the big tree, by the pond, ...). world.gaming.discSpot = one of these ids or [x, z]
export const DISC_SPOTS = { hut: [-8.7, -15.7], tree: [6.0, -14.4], pond: [2.7, 1.4], museum: [-12.0, -3.6], picnic: [-3.8, 4.8], meadow: [0.5, -5.3], campfire: [10.4, 3.6], hottub: [-8.0, -15.9] };

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const F = '"Trebuchet MS", "Arial Black", sans-serif';

// a little stylised pad (white shell, black middle, two grips); ~0.24 m wide at scale 1
export function makePad() {
  const g = new THREE.Group(); const W = new THREE.MeshStandardMaterial({ color: 0xf2f3f5, roughness: 0.45 }), K = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 10).rotateZ(Math.PI / 2), W); body.scale.set(1, 1, 0.55); g.add(body);
  for (const s of [-1, 1]) { const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.06, 4, 8), W); grip.position.set(0.075 * s, -0.045, 0); grip.rotation.z = 0.35 * s; g.add(grip);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 10).rotateX(Math.PI / 2), K); stick.position.set(0.03 * s, -0.012, 0.03); g.add(stick); }
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.01), K); pad.position.set(0, 0.012, 0.024); g.add(pad);
  const btn = new THREE.MeshStandardMaterial({ color: 0x8fd3ff, emissive: 0x2a6aa0, emissiveIntensity: 0.6 }); const lb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.006), btn); lb.position.set(0, -0.005, 0.03); g.add(lb);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g;
}

export function createGaming(scene, { state, glow, tier = 2 }) {
  const cfg = state.world && typeof state.world.gaming === 'object' && state.world.gaming ? state.world.gaming : {};
  const title = String(cfg.game || 'Grand Theft Avian VI').slice(0, 40);
  const group = new THREE.Group(); group.name = 'gaming'; scene.add(group);
  const y0 = topH(GAMING.x, GAMING.z); group.position.set(GAMING.x, y0, GAMING.z); group.rotation.y = GAMING.yaw;
  // low wooden media console + rug
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: 0.4, metalness: 0.2 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.42), wood); cab.position.y = 0.21; cab.castShadow = cab.receiveShadow = true; group.add(cab);
  for (const s of [-1, 1]) { const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.01), new THREE.MeshStandardMaterial({ color: 0x6f4528, roughness: 0.85 })); door.position.set(0.42 * s, 0.21, 0.215); group.add(door); }
  // TV on a pedestal foot
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.24), dark); foot.position.y = 0.435; group.add(foot);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.05), dark); neck.position.set(0, 0.52, -0.03); group.add(neck);
  const SW = 1.36, SH = 0.78, SY = 0.6 + SH / 2;
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.05, SH + 0.05, 0.05), dark); bezel.position.set(0, SY, -0.04); bezel.castShadow = true; group.add(bezel);
  const cw = tier >= 2 ? 512 : 384, ch = Math.round(cw * 9 / 16); const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const screenM = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenM); screen.position.set(0, SY, -0.012); group.add(screen);
  // console: tall white side shells around a black core, standing on the cabinet
  const C = new THREE.Group(); C.position.set(0.56, 0.42, 0.02); group.add(C);
  const shellG = new THREE.BoxGeometry(0.035, 0.36, 0.22); const white = new THREE.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 0.35 });
  for (const s of [-1, 1]) { const sh = new THREE.Mesh(shellG, white); sh.position.set(0.04 * s, 0.19, 0); sh.scale.set(1, 1, 1); sh.rotation.z = -0.06 * s; sh.castShadow = true; C.add(sh); }
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.2), dark); core.position.y = 0.18; C.add(core);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.25, 0.004), new THREE.MeshBasicMaterial({ color: 0x5ab8ff, toneMapped: false })); led.position.set(0, 0.2, 0.102); C.add(led);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 16), dark); stand.position.y = 0.006; C.add(stand);
  // a spare pad on the cabinet (hidden while Mochi holds the other one)
  const spare = makePad(); spare.position.set(-0.45, 0.445, 0.08); spare.rotation.x = -Math.PI / 2; group.add(spare);
  // beanbag in front of the screen
  const bean = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), new THREE.MeshStandardMaterial({ color: 0x3fb8a8, roughness: 0.9 }));
  { const p = bean.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.05) p.setY(i, 0.05 + (y - 0.05) * 0.35); } bean.geometry.computeVertexNormals(); }
  const bx = GAMING.cx - GAMING.x, bz = GAMING.cz - GAMING.z; const bl = new THREE.Vector3(bx, 0, bz).applyAxisAngle(new THREE.Vector3(0, 1, 0), -GAMING.yaw);
  bean.position.set(bl.x, topH(GAMING.cx, GAMING.cz) - y0 + 0.12, bl.z + 0.05); bean.scale.set(1, 0.8, 1); bean.castShadow = bean.receiveShadow = true; group.add(bean);
  // night glow: coloured light on High+, a soft additive floor wash everywhere
  const washTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const q = c.getContext('2d'); const gr = q.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = gr; q.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
  const washM = new THREE.MeshBasicMaterial({ map: washTex, color: 0xff7ac8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const washG = new THREE.PlaneGeometry(3.4, 3.0, 14, 12); washG.rotateX(-Math.PI / 2); washG.translate(0, 0, 1.3);
  { const pa = washG.attributes.position, cy = Math.cos(GAMING.yaw), sy = Math.sin(GAMING.yaw); for (let i = 0; i < pa.count; i++) { const lx = pa.getX(i), lz = pa.getZ(i); const wx = GAMING.x + lx * cy + lz * sy, wz = GAMING.z - lx * sy + lz * cy; pa.setY(i, topH(wx, wz) - y0 + 0.06); } washG.computeBoundingSphere(); } /* drape the glow over the bumpy ground so no hard edges clip through */
  const wash = new THREE.Mesh(washG, washM); washM.polygonOffset = true; washM.polygonOffsetFactor = -2; washM.polygonOffsetUnits = -2; group.add(wash);
  const light = tier >= 2 ? new THREE.PointLight(0xff8acb, 0, 6, 1.6) : null; if (light) { light.position.set(0, SY, 0.6); group.add(light); }

  // ── the lost disc: a game case lying in the grass with a slow sparkle over it until Mochi finds it ──
  const spotKeys = Object.keys(DISC_SPOTS); const day = Math.floor(Date.now() / 864e5);
  const ds = cfg.discSpot; const discXZ = Array.isArray(ds) && ds.length >= 2 && isFinite(ds[0]) && isFinite(ds[1]) ? [+ds[0], +ds[1]] : DISC_SPOTS[ds] || DISC_SPOTS[spotKeys[day % spotKeys.length]];
  const discSpotName = Array.isArray(ds) ? 'custom' : DISC_SPOTS[ds] ? ds : spotKeys[day % spotKeys.length];
  const coverCv = document.createElement('canvas'); coverCv.width = 96; coverCv.height = 128; { const q = coverCv.getContext('2d'); const gr = q.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#ff5fa2'); gr.addColorStop(0.6, '#ffb36b'); gr.addColorStop(1, '#2ad1c9'); q.fillStyle = gr; q.fillRect(0, 0, 96, 128);
    q.fillStyle = '#1a1030'; q.fillRect(0, 0, 96, 22); q.fillStyle = '#fff'; q.font = 'bold 11px ' + F; q.textAlign = 'center'; q.fillText('GRAND THEFT', 48, 15); q.font = 'bold 34px ' + F; q.fillStyle = '#fff'; q.fillText('VI', 48, 70); q.font = 'bold 10px ' + F; q.fillText('AVIAN', 48, 86);
    q.fillStyle = '#1a1030'; for (let i = 0; i < 6; i++) q.fillRect(8 + i * 14, 100 - (i % 3) * 6, 10, 30); }
  const coverT = new THREE.CanvasTexture(coverCv); coverT.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Group(); { const caseM = new THREE.MeshStandardMaterial({ color: 0x1b4fa8, roughness: 0.4 }); const box = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.016, 0.19), caseM); box.castShadow = true; disc.add(box);
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.135, 0.175), new THREE.MeshStandardMaterial({ map: coverT, roughness: 0.5 })); cover.rotation.x = -Math.PI / 2; cover.position.y = 0.0085; disc.add(cover); }
  disc.position.set(discXZ[0], groundY(discXZ[0], discXZ[1]) + 0.02, discXZ[1]); disc.rotation.set(0.08, day * 1.7, -0.05); scene.add(disc);
  const glintCv = document.createElement('canvas'); glintCv.width = glintCv.height = 64; { const q = glintCv.getContext('2d'); const gr = q.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,250,220,0.8)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); q.fillStyle = gr; q.fillRect(0, 0, 64, 64);
    q.fillStyle = 'rgba(255,255,255,0.95)'; q.fillRect(31, 2, 2, 60); q.fillRect(2, 31, 60, 2); }
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glintCv), color: 0xfff4d0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glint.position.copy(disc.position).add(new THREE.Vector3(0.03, 0.06, 0.02)); scene.add(glint);

  // ── the game ──
  const R = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
  let mode = 'attract', cash = 4200 + Math.floor(R(3) * 900) * 10, wanted = 1, scroll = 0, deadT = 0, lastDraw = -1, found = /[?&]disc=1/.test(globalThis.location?.search || '') || cfg.found === true || cfg.found !== false && (() => { try { return localStorage.getItem('mochi.discFound') === '1'; } catch { return false; } })();
  function sky(t) { const gr = g.createLinearGradient(0, 0, 0, ch * 0.62); gr.addColorStop(0, '#2a1a5e'); gr.addColorStop(0.35, '#d6408f'); gr.addColorStop(0.7, '#ff8a4c'); gr.addColorStop(1, '#ffd36b'); g.fillStyle = gr; g.fillRect(0, 0, cw, ch * 0.62);
    const sx = cw * 0.7, sy = ch * 0.48, sr = ch * 0.2; g.save(); g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.clip(); const sg = g.createLinearGradient(0, sy - sr, 0, sy + sr); sg.addColorStop(0, '#fff3a0'); sg.addColorStop(1, '#ff5f9e'); g.fillStyle = sg; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    g.fillStyle = '#d6408f'; for (let i = 0; i < 5; i++) g.fillRect(sx - sr, sy + i * sr * 0.2 + 2, sr * 2, 2 + i * 1.2); g.restore();
    g.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 4; i++) { const x = ((i * 157 - t * 6) % (cw + 120) + cw + 120) % (cw + 120) - 60; g.beginPath(); g.ellipse(x, ch * (0.1 + 0.06 * i), 40, 7, 0, 0, 7); g.fill(); } }
  function city(t) { const off = (t * 12) % 64; g.fillStyle = '#5b2a7a'; for (let i = -1; i < cw / 32 + 2; i++) { const h = 30 + R(i + Math.floor(t * 12 / 64) * 7) * 50; const x = i * 32 - off; g.fillRect(x, ch * 0.62 - h, 28, h);
      g.fillStyle = 'rgba(255,230,120,0.7)'; for (let w = 0; w < 4; w++) if (R(i * 9 + w) > 0.4) g.fillRect(x + 4 + (w % 2) * 12, ch * 0.62 - h + 8 + Math.floor(w / 2) * 14, 6, 6); g.fillStyle = '#5b2a7a'; } }
  function sea(t) { const gr = g.createLinearGradient(0, ch * 0.62, 0, ch * 0.74); gr.addColorStop(0, '#2fd1c8'); gr.addColorStop(1, '#138f9e'); g.fillStyle = gr; g.fillRect(0, ch * 0.62, cw, ch * 0.12);
    g.fillStyle = 'rgba(255,240,200,0.6)'; for (let i = 0; i < 14; i++) g.fillRect((i * 41 + t * 30) % cw, ch * 0.64 + (i % 4) * 7, 14, 2); }
  function palm(x, y, s) { g.strokeStyle = '#2a1238'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6 * s, y - 30 * s, x + 2 * s, y - 60 * s); g.stroke(); g.fillStyle = '#2a1238';
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.55; g.beginPath(); g.moveTo(x + 2 * s, y - 60 * s); g.quadraticCurveTo(x + 2 * s + Math.cos(a) * 22 * s, y - 60 * s + Math.sin(a) * 22 * s - 8 * s, x + 2 * s + Math.cos(a) * 34 * s, y - 60 * s + Math.sin(a) * 18 * s + 10 * s); g.lineTo(x + 2 * s + Math.cos(a) * 18 * s, y - 60 * s + Math.sin(a) * 10 * s); g.fill(); } }
  function road(t) { g.fillStyle = '#3a3346'; g.fillRect(0, ch * 0.74, cw, ch * 0.26); g.fillStyle = '#ffd34d'; const off = (t * 220) % 60; for (let x = -off; x < cw; x += 60) g.fillRect(x, ch * 0.86, 32, 4);
    g.fillStyle = '#e8d8b0'; g.fillRect(0, ch * 0.74, cw, 4); const po = (t * 160) % 150; for (let x = -po; x < cw + 60; x += 150) palm(x, ch * 0.76, 1.15); }
  function car(t, wob) { const x = cw * 0.32, y = ch * 0.9 + Math.sin(t * 18) * 1.2 * wob; g.fillStyle = '#ff4fa3'; rr(g, x - 46, y - 20, 92, 18, 7); g.fill(); g.fillStyle = '#ff86c2'; rr(g, x - 26, y - 32, 44, 14, 6); g.fill();
    g.fillStyle = '#9ff3ff'; g.fillRect(x - 18, y - 30, 30, 9); g.fillStyle = '#7a5235'; g.beginPath(); g.arc(x - 6, y - 32, 7, 0, 7); g.fill(); g.strokeStyle = '#e9c48a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 32); g.lineTo(x + 12, y - 28); g.stroke(); // kiwi driver + beak
    g.fillStyle = '#16121c'; for (const wx of [-28, 28]) { g.beginPath(); g.arc(x + wx, y - 2, 9, 0, 7); g.fill(); } g.fillStyle = '#ffd34d'; g.fillRect(x + 44, y - 16, 5, 4); }
  function hud(t) { const mm = ch * 0.17, mx = 14 + mm, my = ch - 12 - mm; g.fillStyle = 'rgba(10,10,20,0.6)'; g.beginPath(); g.arc(mx, my, mm, 0, 7); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.stroke();
    g.save(); g.beginPath(); g.arc(mx, my, mm - 2, 0, 7); g.clip(); g.strokeStyle = '#9aa3b5'; g.lineWidth = 4; const mo = (t * 8) % 40; for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(mx - mm, my + i * 20 - mo); g.lineTo(mx + mm, my + i * 20 - mo + 6); g.stroke(); }
    g.strokeStyle = '#ff4fa3'; g.lineWidth = 3; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + mm * 0.7, my - mm * 0.6); g.stroke(); g.restore(); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(mx, my - 7); g.lineTo(mx - 5, my + 5); g.lineTo(mx + 5, my + 5); g.fill();
    g.textAlign = 'right'; g.textBaseline = 'top'; g.font = `bold ${Math.round(ch * 0.085)}px ${F}`; g.lineWidth = 4; g.strokeStyle = '#000'; const c$ = '$' + cash.toLocaleString('en-US'); g.strokeText(c$, cw - 12, 30); g.fillStyle = '#7dff8a'; g.fillText(c$, cw - 12, 30);
    for (let i = 0; i < 5; i++) { const sx = cw - 16 - i * 22, sy = 16, on = i < wanted; g.fillStyle = on ? (Math.floor(t * 4) % 2 && wanted >= 3 ? '#ffffff' : '#ffd34d') : 'rgba(255,255,255,0.25)'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4 : 9; g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } g.fill(); }
    g.textAlign = 'left'; g.font = `bold ${Math.round(ch * 0.05)}px ${F}`; g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillText('VICE BEAK BLVD', 12, 12); }
  function attract(t) { sky(t); city(t * 0.3); sea(t); road(t * 0.2); g.fillStyle = 'rgba(20,0,40,0.35)'; g.fillRect(0, 0, cw, ch);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${Math.round(ch * 0.15)}px ${F}`; g.lineWidth = 8; g.strokeStyle = '#1a0830'; const L1 = title.toUpperCase().replace(/ VI$/, ''); g.strokeText(L1, cw / 2, ch * 0.34); const tg = g.createLinearGradient(0, ch * 0.26, 0, ch * 0.42); tg.addColorStop(0, '#ffe36b'); tg.addColorStop(1, '#ff4fa3'); g.fillStyle = tg; g.fillText(L1, cw / 2, ch * 0.34);
    if (/ VI$/.test(title)) { g.font = `900 ${Math.round(ch * 0.2)}px ${F}`; g.strokeText('VI', cw / 2, ch * 0.55); g.fillStyle = '#5ff3e8'; g.fillText('VI', cw / 2, ch * 0.55); }
    if (Math.floor(t * 2) % 2) { g.font = `bold ${Math.round(ch * 0.06)}px ${F}`; g.fillStyle = '#ffffff'; g.fillText('PRESS ✕ TO START', cw / 2, ch * 0.8); } }
  function drive(t) { sky(t); city(t); sea(t); road(t); car(t, 1); hud(t); }
  function wastedScr(t) { drive(t - deadT * 0); g.fillStyle = 'rgba(120,120,120,0.55)'; g.fillRect(0, 0, cw, ch); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${Math.round(ch * 0.2)}px ${F}`; g.lineWidth = 8; g.strokeStyle = '#000'; g.strokeText('PLUCKED', cw / 2, ch * 0.45); g.fillStyle = '#c8202a'; g.fillText('PLUCKED', cw / 2, ch * 0.45); }
  function noDisc(t) { g.fillStyle = '#0b0d14'; g.fillRect(0, 0, cw, ch); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e8ecf5'; g.font = `bold ${Math.round(ch * 0.07)}px ${F}`; g.fillText('Please insert a game disc.', cw / 2, ch * 0.45);
    g.strokeStyle = '#5ab8ff'; g.lineWidth = 3; g.beginPath(); g.arc(cw / 2, ch * 0.7, ch * 0.08, t * 3, t * 3 + 4.5); g.stroke(); }
  function draw(t) { if (mode === 'nodisc') noDisc(t); else if (mode === 'drive') drive(t); else if (mode === 'wasted') wastedScr(t); else attract(t); tex.needsUpdate = true; }
  let night = 0;
  const api = { group, screen, tex, pad: makePad(), spare, bean, title,
    get mode() { return mode; }, setMode(m) { mode = m; }, get found() { return found; }, setFound(v) { found = !!v; if (!found) mode = 'nodisc'; else if (mode === 'nodisc') mode = 'attract'; disc.visible = glint.visible = !found; if (found) { try { localStorage.setItem('mochi.discFound', '1'); } catch {} } },
    disc, glint, discSpot: discSpotName, discPos: new THREE.Vector3(discXZ[0], disc.position.y, discXZ[1]),
    seat: new THREE.Vector3(GAMING.cx, topH(GAMING.cx, GAMING.cz) + 0.2, GAMING.cz), faceYaw: GAMING.yaw + Math.PI,
    die() { mode = 'wasted'; deadT = 0; wanted = 0; }, crash() { wanted = Math.min(5, wanted + 1); },
    update(t, dt, nt) { night = nt; if (glint.visible) { const ph = (t * 0.45) % 1, k = ph < 0.18 ? Math.sin(ph / 0.18 * Math.PI) : 0; glint.material.opacity = 0.45 + 0.55 * k; glint.scale.setScalar(0.2 + 0.4 * k); glint.material.rotation = t * 0.6; } if (mode === 'drive') { cash += Math.floor(dt * 60 * (1 + wanted)); if (R(Math.floor(t * 0.5)) > 0.85 && wanted < 2) wanted = 2; } if (mode === 'wasted') { deadT += dt; if (deadT > 2.4) { mode = 'drive'; wanted = 1; cash = Math.max(0, cash - 500); } }
      const fps = mode === 'drive' ? 15 : 8; if (t - lastDraw > 1 / fps) { lastDraw = t; draw(t); }
      const k = 0.15 + 0.85 * night; screenM.color.setScalar(1 + 0.5 * night); washM.opacity = 0.35 * k * (mode === 'nodisc' ? 0.2 : 1); washM.color.setHSL(0.88 + 0.08 * Math.sin(t * 0.7), 0.8, 0.6); if (light) { light.intensity = 2.2 * night * (mode === 'nodisc' ? 0.2 : 1); light.color.copy(washM.color); } } };
  if (!found) mode = 'nodisc'; disc.visible = glint.visible = !found; draw(0);
  return api;
}
