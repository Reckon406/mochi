// 🪧 carved wooden plank signs: one cohesive style for every sign on the island
// hand-lettered Fredoka (Mochi's own notes use Gochi Hand), engraved text with a soft highlight, an icon per place,
// grain + knots + nail heads + gentle weathering, matching posts, a little tilt, faintly lit at night.
import * as THREE from 'three';
import { rng } from './noise.js';
import { barkBump } from './gfx.js';

export async function loadSignFonts() {
  const base = import.meta.env.BASE_URL || './';
  const faces = [new FontFace('Fredoka', `url(${base}fonts/Fredoka.ttf)`, { weight: '300 700' }), new FontFace('Gochi Hand', `url(${base}fonts/GochiHand.ttf)`)];
  await Promise.race([Promise.all(faces.map(async (f) => { try { await f.load(); document.fonts.add(f); } catch (e) { /* fall back to system fonts */ } })), new Promise((r) => setTimeout(r, 2500))]);
}

// v2 sign pass: every sign is drawn once into a shared atlas page (one CanvasTexture + one material per page,
// mipmapped, anisotropic) instead of a 512px texture per sign. Warm planks, beveled + burnt edges, burned-in Fredoka.
const TONES = { oak: ['#d8a468', '#c08848', '#6e4220'], pine: ['#e4b77a', '#cc9a58', '#7a4e26'], walnut: ['#94643c', '#7a4e2c', '#3a2210'] };
TONES.cream = TONES.pine; TONES.blue = TONES.oak;
const SIGN_MATS = [];
export function updateSigns(night) { for (const m of SIGN_MATS) m.emissiveIntensity = 0.05 + night * 0.5; }
let SCALE = 1; export function setSignScale(s) { SCALE = s; }
let BOARD = null; // { im, tint(hex) } — set before any sign is drawn
export function setSignBoard(im) { if (!im) return; const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 8, 8);
  const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const avg = [r / 64, gg / 64, b / 64];
  BOARD = { im, tint: (hex) => { const t = new THREE.Color(hex); const k = (v, a) => Math.min(255, Math.round(255 * (v * 255) / a * 1.05)); return `rgb(${k(t.r, avg[0])},${k(t.g, avg[1])},${k(t.b, avg[2])})`; } }; }

// ── atlas: shelf-packed pages ──
const PAGES = [];
function page() { const S = SCALE < 1 ? 1024 : 2048; const c = document.createElement('canvas'); c.width = c.height = S;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, alphaTest: 0.5, emissive: 0xffe2b0, emissiveMap: tex, emissiveIntensity: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.FrontSide });
  SIGN_MATS.push(mat); const p = { c, g: c.getContext('2d'), S, tex, mat, x: 0, y: 0, rowH: 0 }; PAGES.push(p); return p; }
function slot(w, h) { const pad = 8; let p = PAGES[PAGES.length - 1] || page();
  if (p.x + w + pad > p.S) { p.x = 0; p.y += p.rowH + pad; p.rowH = 0; }
  if (p.y + h + pad > p.S) { p = page(); }
  const r = { p, x: p.x + pad / 2, y: p.y + pad / 2, w, h }; p.x += w + pad; p.rowH = Math.max(p.rowH, h); return r; }
const CACHE = new Map();

function plankShape(g, w, h, r, seed, arrow = 0) { // slightly irregular rounded plank; arrow = +1 point right, -1 point left
  const R = rng(seed); const j = () => (R() - 0.5) * 3; const t = arrow ? h * 0.42 : 0; g.beginPath();
  const L = 4 + (arrow < 0 ? t : 0), Rr = w - 4 - (arrow > 0 ? t : 0);
  if (arrow < 0) { g.moveTo(4, h / 2); g.lineTo(L, 4); } else g.moveTo(L + r, 4 + j());
  g.lineTo(Rr - (arrow > 0 ? 0 : r), 4 + j());
  if (arrow > 0) { g.lineTo(w - 4, h / 2); g.lineTo(Rr, h - 4); } else { g.quadraticCurveTo(w - 4, 4, w - 4, r); g.lineTo(w - 4 + j() * 0.3, h - r); g.quadraticCurveTo(w - 4, h - 4, Rr - r, h - 4); }
  g.lineTo(L + (arrow < 0 ? 0 : r), h - 4 + j());
  if (arrow < 0) g.closePath(); else { g.quadraticCurveTo(4, h - 4, 4, h - r); g.lineTo(4 + j() * 0.3, r); g.quadraticCurveTo(4, 4, L + r, 4); g.closePath(); }
}
// warm planks with grain, bevel, burnt-edge vignette (draws into g at 0,0 size w,h)
function woodPanel(g, w, h, tone, seed, arrow = 0, rad = 22) {
  const R = rng(seed * 13 + 7); const [base, mid, dark] = TONES[tone] || TONES.oak;
  g.save(); plankShape(g, w, h, rad, seed, arrow); g.clip();
  if (BOARD) { // AI sign-board grain (Medium+): a random crop per sign, tinted toward the tone
    const iw = BOARD.im.width, ih = BOARD.im.height; let sw = iw, shh = iw * h / w; if (shh > ih) { shh = ih; sw = ih * w / h; }
    g.drawImage(BOARD.im, R() * (iw - sw), R() * (ih - shh), sw, shh, 0, 0, w, h);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = BOARD.tint(base); g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,240,210,0.08)'); gr.addColorStop(1, 'rgba(60,30,10,0.12)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  } else { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, base); gr.addColorStop(1, mid); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  // board seams (two or three planks)
  if (!BOARD) {
  const nb = h > 200 ? 3 : h > 120 ? 2 : 1; g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = 3; for (let i = 1; i < nb; i++) { const y = (h * i) / nb + (R() - 0.5) * 4; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.strokeStyle = 'rgba(255,230,190,0.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y + 2.5); g.lineTo(w, y + 2.5); g.stroke(); g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = 3; }
  // grain
  g.globalAlpha = 0.16; g.strokeStyle = dark; for (let i = 0; i < Math.round(h / 9); i++) { g.lineWidth = 0.8 + R() * 1.6; g.beginPath(); const y0 = R() * h; g.moveTo(0, y0); for (let x = 0; x <= w; x += 24) g.lineTo(x, y0 + Math.sin(x * 0.012 + i * 1.7) * 4 + (R() - 0.5) * 1.5); g.stroke(); }
  for (let i = 0; i < 2; i++) { const x = 40 + R() * (w - 80), y = 12 + R() * (h - 24); g.globalAlpha = 0.22; g.fillStyle = dark; g.beginPath(); g.ellipse(x, y, 8 + R() * 7, 3 + R() * 3, 0, 0, 6.28); g.fill(); }
  }
  // burnt-edge vignette
  g.globalAlpha = 1; g.shadowColor = 'rgba(50,22,5,0.9)'; g.shadowBlur = 22; g.lineWidth = 14; g.strokeStyle = 'rgba(70,32,8,0.55)'; plankShape(g, w, h, rad, seed, arrow); g.stroke(); g.shadowBlur = 0;
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(50,22,5,0.28)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
  // bevel: light top-left lip, dark bottom-right lip
  g.lineWidth = 4; g.strokeStyle = 'rgba(255,236,200,0.45)'; g.save(); g.translate(2, 2); plankShape(g, w - 4, h - 4, rad, seed, arrow); g.stroke(); g.restore();
  g.restore();
  g.lineWidth = 3; g.strokeStyle = 'rgba(45,20,5,0.85)'; plankShape(g, w, h, rad, seed, arrow); g.stroke();
}
function burnText(g, txt, x, y, font, tone, hand) {
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; const dark = tone === 'walnut';
  g.fillStyle = dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,238,205,0.6)'; g.fillText(txt, x + 1.5, y + 2); // light inset lip
  g.shadowColor = dark ? 'rgba(255,220,160,0.3)' : 'rgba(90,40,8,0.55)'; g.shadowBlur = hand ? 2 : 4; // scorched halo
  g.fillStyle = dark ? '#ffeccc' : '#3b2210'; g.fillText(txt, x, y); g.shadowBlur = 0;
}
const EMOJI = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
// draw a sign into the atlas; returns { p, uv:[u0,v0,u1,v1], aspect }
export function signSlot(lines, { icon = '', tone = 'oak', hand = false, seed = 1, arrow = 0, w = 512, h = null } = {}) {
  const key = JSON.stringify([lines, icon, tone, hand, seed, arrow, w, h, SCALE]); if (CACHE.has(key)) return CACHE.get(key);
  const n = lines.length; h = h || (arrow ? 104 : n > 1 ? 200 : 136);
  const r = slot(Math.round(w * SCALE), Math.round(h * SCALE)); const g = r.p.g; g.save(); g.translate(r.x, r.y); g.scale(SCALE, SCALE);
  woodPanel(g, w, h, tone, seed, arrow, arrow ? 14 : 22);
  const fam = hand ? '"Gochi Hand", "Comic Sans MS", cursive' : 'Fredoka, "Trebuchet MS", sans-serif';
  const inset = arrow ? h * 0.42 : 0; const padL = 26 + (arrow < 0 ? inset : 0), padR = 26 + (arrow > 0 ? inset : 0);
  const iconW = icon ? h * (n > 1 ? 0.4 : 0.56) : 0; const maxW = w - padL - padR - iconW; const tx = padL + iconW + maxW / 2;
  if (icon) { g.font = `${Math.round(iconW * 0.82)}px ${EMOJI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = 0.92; g.fillText(icon, padL + iconW / 2 - 4, h / 2 + 3); g.globalAlpha = 1; }
  const fit = (txt, size, weight) => { let s2 = size; do { g.font = `${weight} ${s2}px ${fam}`; s2 -= 2; } while (g.measureText(txt).width > maxW && s2 > 12); return s2 + 2; };
  lines.forEach((l, i) => { const main = i === 0; const weight = hand ? 400 : main ? 600 : 500;
    const size = fit(String(l), hand ? Math.floor(h / n * 0.62) : main ? (n > 1 ? h * 0.36 : h * 0.5) : h * 0.22, weight);
    const y = n === 1 ? h / 2 + 3 : main ? h * 0.4 : h * (0.4 + 0.33 * i / Math.max(1, n - 1)) + 4;
    burnText(g, String(l), tx, hand ? h * (i + 0.5) / n + 3 : y, `${weight} ${size}px ${fam}`, tone, hand); });
  g.restore(); r.p.tex.needsUpdate = true;
  const out = { p: r.p, uv: [r.x / r.p.S, 1 - (r.y + r.h) / r.p.S, (r.x + r.w) / r.p.S, 1 - r.y / r.p.S], aspect: w / h }; CACHE.set(key, out); return out;
}
// mochi's notice board: wood board with paper slips pinned on, one atlas slot
function boardSlot(title, notes, seed) {
  const w = 768, h = 480; const r = slot(Math.round(w * SCALE), Math.round(h * SCALE)); const g = r.p.g; g.save(); g.translate(r.x, r.y); g.scale(SCALE, SCALE);
  woodPanel(g, w, h, 'oak', seed, 0, 26); burnText(g, title, w / 2, 48, '600 50px Fredoka, "Trebuchet MS", sans-serif', 'oak');
  const R = rng(seed + 5); const cols = ['#fff7e0', '#fdeec4', '#f3f7ff', '#ffe9ec'];
  notes.slice(0, 4).forEach((t, i) => { const cx = 200 + (i % 2) * 370, cy = 175 + Math.floor(i / 2) * 175; g.save(); g.translate(cx, cy); g.rotate((R() - 0.5) * 0.09);
    g.shadowColor = 'rgba(40,20,5,0.45)'; g.shadowBlur = 8; g.shadowOffsetY = 3; g.fillStyle = cols[i % 4]; g.fillRect(-165, -72, 330, 144); g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.fillStyle = '#c8463c'; g.beginPath(); g.arc(0, -60, 7, 0, 6.28); g.fill();
    g.fillStyle = '#3b2a1e'; g.textAlign = 'center'; g.textBaseline = 'middle'; const words = String(t).split(/\s+/); const L = ['']; for (const wd of words) { const tst = (L[L.length - 1] + ' ' + wd).trim(); g.font = '400 30px "Gochi Hand", "Comic Sans MS", cursive'; if (g.measureText(tst).width > 300 && L.length < 3) L.push(wd); else L[L.length - 1] = tst; }
    L.forEach((ln, k) => { let fs = 30; do { g.font = `400 ${fs}px "Gochi Hand", "Comic Sans MS", cursive`; fs -= 2; } while (g.measureText(ln).width > 310 && fs > 14); g.fillText(ln, 0, -18 + k * 34 - (L.length - 1) * 6); });
    g.restore(); });
  g.restore(); r.p.tex.needsUpdate = true;
  return { p: r.p, uv: [r.x / r.p.S, 1 - (r.y + r.h) / r.p.S, (r.x + r.w) / r.p.S, 1 - r.y / r.p.S], aspect: w / h };
}
function face(sl, width, flip = false) {
  const h = width / sl.aspect; const geo = new THREE.PlaneGeometry(width, h); const uv = geo.attributes.uv; const [u0, v0, u1, v1] = sl.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  return new THREE.Mesh(geo, sl.p.mat);
}
const woodM = {}; const postM = () => woodM.post || (woodM.post = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.95, bumpMap: barkBump(), bumpScale: 2 }));
const backM = (tone) => woodM[tone] || (woodM[tone] = new THREE.MeshStandardMaterial({ color: new THREE.Color((TONES[tone] || TONES.oak)[2]).lerp(new THREE.Color((TONES[tone] || TONES.oak)[1]), 0.5), roughness: 0.9 }));
// a plank: thin wood core + atlas face(s). width in world units; height from the slot's aspect.
export function plank(lines, { width = 1.0, icon = '', tone = 'oak', hand = false, seed = 1, thick = 0.045, lit = true, twoSided = false, arrow = 0 } = {}) {
  const sl = signSlot(lines, { icon, tone, hand, seed, arrow }); const h = width / sl.aspect;
  const g = new THREE.Group();
  const coreW = arrow ? width * 0.78 : width * 0.94; const board = new THREE.Mesh(new THREE.BoxGeometry(coreW, h * 0.86, thick), backM(tone)); board.position.x = arrow ? -arrow * width * 0.09 : 0; board.castShadow = true; board.receiveShadow = true; g.add(board);
  const f = face(sl, width); f.position.z = thick / 2 + 0.003; g.add(f);
  if (twoSided) { const sb = arrow ? signSlot(lines, { icon, tone, hand, seed, arrow: -arrow }) : sl; const b = face(sb, width); b.position.z = -(thick / 2 + 0.003); b.rotation.y = Math.PI; g.add(b); }
  g.userData.h = h; return g;
}
export function noticeBoard(parent, title, notes, [x, y, z], yaw = 0, { width = 1.5, seed = 77 } = {}) {
  const sl = boardSlot(title, notes, seed); const h = width / sl.aspect; const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; parent.add(g);
  const top = 0.75 + h; const bd = new THREE.Mesh(new THREE.BoxGeometry(width * 0.98, h * 0.96, 0.06), backM('oak')); bd.position.y = 0.75 + h / 2; bd.castShadow = true; g.add(bd);
  const f = face(sl, width); f.position.set(0, 0.75 + h / 2, 0.034); g.add(f);
  for (const px of [-width * 0.42, width * 0.42]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, top + 0.35, 0.08), postM()); post.position.set(px, (top + 0.35) / 2 - 0.3, -0.07); post.castShadow = true; g.add(post); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.05, 0.3), backM('walnut')); roof.position.set(0, top + 0.07, -0.02); roof.rotation.x = 0.18; roof.castShadow = true; g.add(roof);
  g.userData.notes = notes; return g;
}
// a full signpost: plank on one post (narrow) or two posts (wide). posts sink 0.25 into the ground
export function signpost(parent, lines, [x, y, z], yaw = 0, s = 1, { icon = '', tone = 'oak', hand = false, width = 1.05, height = 1.0, seed = null } = {}) {
  const sd = seed ?? Math.abs(Math.round(x * 31 + z * 17)) + 1; const R = rng(sd);
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw + (R() - 0.5) * 0.08; g.scale.setScalar(s); parent.add(g);
  const p = plank(lines, { width, icon, tone, hand, seed: sd, twoSided: true }); const ph = p.userData.h;
  p.position.y = height; p.rotation.z = (R() - 0.5) * 0.04; g.add(p);
  const two = width > 0.9; const top = height + ph / 2 + 0.05; const sink = 0.25;
  for (const px of two ? [-width * 0.4, width * 0.4] : [0]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.075, top + sink, 0.075), postM()); post.position.set(px, (top + sink) / 2 - sink, -0.065); post.castShadow = true; g.add(post);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.06, 4), postM()); cap.position.set(px, top + 0.03, -0.065); cap.rotation.y = Math.PI / 4; g.add(cap);
  }
  return g;
}

// crossroads: one carved post in the middle of the island with arrow planks pointing at each place (replaces 13 separate zone signposts)
export const CROSS = { x: 0.2, z: 2.8 };
const ARROWS = [['hut', 'NEST', '🏠'], ['tree', 'BIG TREE', '🌳'], ['cliff', 'LOOKOUT', '⛰️'], ['dock', 'DOCK', '🎣'], ['beach', 'BEACH', '🏖️'], ['hottub', 'HOT TUB', '♨️'], ['burrow', 'BURROW', '🐦']];
export function zoneSigns(parent, ZONES, { groundY, BRIDGE }) {
  const g = new THREE.Group(); const y0 = groundY(CROSS.x, CROSS.z); g.position.set(CROSS.x, y0, CROSS.z); parent.add(g);
  const H = 0.9 + ARROWS.length * 0.17 + 0.2; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, H + 0.3, 7), postM()); post.position.y = H / 2 - 0.15; post.castShadow = true; g.add(post);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.14, 7), backM('walnut')); cap.position.y = H + 0.06; g.add(cap);
  ARROWS.forEach(([id, label, icon], i) => { const z = ZONES.find((q) => q.id === id); if (!z) return; const [tx, tz] = id === 'beach' ? [BRIDGE.ax, BRIDGE.az] : z.pos;
    const dx = tx - CROSS.x, dz = tz - CROSS.z; const yaw = Math.atan2(-dz, dx); const p = plank([label], { width: 0.62, icon, tone: i % 3 === 1 ? 'pine' : 'oak', seed: 200 + i, arrow: 1, twoSided: true, thick: 0.035 });
    const arm = new THREE.Group(); arm.rotation.y = yaw; arm.position.y = H - 0.12 - i * 0.17; g.add(arm); p.position.x = 0.36; arm.add(p); });
  return [g];
}
