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

const TONES = { oak: ['#c9945c', '#b07a44', '#8a5a2e'], pine: ['#e2b77a', '#c99a5e', '#9a6e3c'], walnut: ['#9a6a42', '#7e5232', '#5a3820'], cream: ['#f4e3c0', '#e2c99a', '#b8955e'], blue: ['#7fb6d6', '#5f98bc', '#3e6e8e'] };
const SIGN_MATS = [];
export function updateSigns(night) { for (const m of SIGN_MATS) m.emissiveIntensity = 0.06 + night * 0.55; }

function plankShape(g, w, h, r, seed) { // slightly irregular rounded plank
  const R = rng(seed); g.beginPath(); const j = () => (R() - 0.5) * 5;
  g.moveTo(r, 4 + j()); g.lineTo(w - r, 4 + j()); g.quadraticCurveTo(w - 3, 3, w - 4 + j(), r);
  g.lineTo(w - 4 + j(), h - r); g.quadraticCurveTo(w - 3, h - 3, w - r, h - 4 + j()); g.lineTo(r, h - 4 + j());
  g.quadraticCurveTo(3, h - 3, 4 + j(), h - r); g.lineTo(4 + j(), r); g.quadraticCurveTo(3, 3, r, 4 + j()); g.closePath();
}
export function plankTexture(lines, { icon = '', tone = 'oak', hand = false, w = 512, h = null, seed = 1 } = {}) {
  const n = lines.length; h = h || (n > 1 ? 256 : 176);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const R = rng(seed * 13 + 7);
  const [base, mid, dark] = TONES[tone] || TONES.oak;
  plankShape(g, w, h, 26, seed); g.save(); g.clip();
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, base); gr.addColorStop(1, mid); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // grain
  g.globalAlpha = 0.22; g.strokeStyle = dark; for (let i = 0; i < 26; i++) { g.lineWidth = 0.8 + R() * 1.8; g.beginPath(); const y0 = R() * h; g.moveTo(0, y0); for (let x = 0; x <= w; x += 32) g.lineTo(x, y0 + Math.sin(x * 0.01 + i) * 6 + (R() - 0.5) * 3); g.stroke(); }
  // knots
  for (let i = 0; i < 2; i++) { const x = 40 + R() * (w - 80), y = 20 + R() * (h - 40); g.globalAlpha = 0.3; g.fillStyle = dark; g.beginPath(); g.ellipse(x, y, 10 + R() * 8, 5 + R() * 3, 0, 0, 6.28); g.fill(); g.globalAlpha = 0.2; g.strokeStyle = dark; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 20, 9, 0, 0, 6.28); g.stroke(); }
  // weathering: pale worn patches + scratches
  g.globalAlpha = 0.12; g.fillStyle = '#fff6e0'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(R() * w, R() * h, 20 + R() * 50, 6 + R() * 14, R(), 0, 6.28); g.fill(); }
  g.globalAlpha = 0.18; g.strokeStyle = '#3a2412'; g.lineWidth = 1; for (let i = 0; i < 10; i++) { const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 40, y + (R() - 0.5) * 8); g.stroke(); }
  // darker edge
  g.globalAlpha = 1; const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, w * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,20,5,0.35)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
  g.restore();
  g.lineWidth = 6; g.strokeStyle = dark; plankShape(g, w, h, 26, seed); g.stroke();
  // nail heads
  g.fillStyle = '#4a4a4a'; for (const x of [22, w - 22]) for (const y of [22, h - 22]) { g.beginPath(); g.arc(x, y, 5, 0, 6.28); g.fill(); g.fillStyle = '#9a9a9a'; g.beginPath(); g.arc(x - 1.5, y - 1.5, 2, 0, 6.28); g.fill(); g.fillStyle = '#4a4a4a'; }
  // text (engraved: light lip below-right, dark carve on top)
  const fam = hand ? '"Gochi Hand", "Comic Sans MS", cursive' : 'Fredoka, "Trebuchet MS", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const ink = tone === 'blue' ? '#ffffff' : tone === 'walnut' ? '#fff0d0' : '#4a2a12';
  const lip = tone === 'walnut' || tone === 'blue' ? 'rgba(0,0,0,0.45)' : 'rgba(255,240,210,0.75)';
  const fit = (txt, size, weight, maxW) => { let s = size; do { g.font = `${weight} ${s}px ${fam}`; s -= 2; } while (g.measureText(txt).width > maxW && s > 12); return s + 2; };
  const pad = 34; const iconW = icon ? h * (n > 1 ? 0.42 : 0.55) : 0; const tx = w / 2 + iconW / 2; const maxW = w - pad * 2 - iconW;
  if (icon) { g.font = `${Math.round(iconW * 0.9)}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; g.globalAlpha = 0.95; g.fillText(icon, pad + iconW / 2, h / 2 + 4); g.globalAlpha = 1; }
  lines.forEach((l, i) => {
    const main = i === 0 && !(hand && n > 1); const size = fit(String(l), hand && n > 1 ? Math.min(64, Math.floor(h / n * 0.8)) : main ? (n > 1 ? (hand ? 74 : 70) : (hand ? 86 : 80)) : (hand ? 50 : 44), hand ? 400 : main ? 700 : 500, maxW);
    const y = n === 1 ? h / 2 + 4 : hand ? h * (i + 0.5) / n + 4 : main ? h * 0.38 : h * (0.38 + 0.36 * i / Math.max(1, n - 1)) + 4;
    g.font = `${hand ? 400 : main ? 700 : 500} ${size}px ${fam}`;
    g.fillStyle = lip; g.fillText(l, tx + 2, y + 2.5);
    g.fillStyle = ink; g.fillText(l, tx, y);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return { tex: t, aspect: w / h };
}

const woodM = {}; const postM = () => woodM.post || (woodM.post = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.95, bumpMap: barkBump(), bumpScale: 2 }));
const backM = (tone) => woodM[tone] || (woodM[tone] = new THREE.MeshStandardMaterial({ color: new THREE.Color((TONES[tone] || TONES.oak)[1]), roughness: 0.9 }));
// a plank (front textured, back plain wood). width in world units; height from the texture's aspect.
export function plank(lines, { width = 1.0, icon = '', tone = 'oak', hand = false, seed = 1, thick = 0.05, lit = true, twoSided = false } = {}) {
  const { tex, aspect } = plankTexture(lines, { icon, tone, hand, seed });
  const h = width / aspect;
  const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, transparent: true, alphaTest: 0.5, emissive: 0xffe2b0, emissiveMap: tex, emissiveIntensity: 0.06 });
  if (lit) SIGN_MATS.push(front);
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(width * 0.97, h * 0.93, thick), backM(tone)); board.castShadow = true; g.add(board);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, h), front); face.position.z = thick / 2 + 0.002; g.add(face);
  if (twoSided) { const back = face.clone(); back.position.z = -face.position.z; back.rotation.y = Math.PI; g.add(back); }
  g.userData.h = h; return g;
}
// a full signpost: plank on one post (narrow) or two posts (wide), cap tops, slight tilt
export function signpost(parent, lines, [x, y, z], yaw = 0, s = 1, { icon = '', tone = 'oak', hand = false, width = 1.05, height = 1.0, seed = null } = {}) {
  const sd = seed ?? Math.abs(Math.round(x * 31 + z * 17)) + 1; const R = rng(sd);
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw + (R() - 0.5) * 0.12; g.scale.setScalar(s); parent.add(g);
  const p = plank(lines, { width, icon, tone, hand, seed: sd, twoSided: true }); const ph = p.userData.h;
  p.position.y = height; p.rotation.z = (R() - 0.5) * 0.08; p.rotation.x = -0.04; g.add(p);
  const two = width > 0.9; const top = height + ph / 2 + 0.06;
  for (const px of two ? [-width * 0.4, width * 0.4] : [0]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.075, top, 0.075), postM()); post.position.set(px, top / 2 - 0.05, -0.05); post.rotation.z = (R() - 0.5) * 0.05; post.castShadow = true; g.add(post);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.07, 4), postM()); cap.position.set(px, top, -0.05); cap.rotation.y = Math.PI / 4; g.add(cap);
  }
  return g;
}

// zone signposts (for places that don't already have their own big sign), facing the paths in the middle of the island
const ZSIGN = { hut: ["MOCHI'S NEST", 'knock softly', '🏠'], tree: ['BIG TREE', 'treehouse ↑', '🌳'], pond: ['POND', 'frogs only', '🪷'], pumpkins: ['PUMPKIN PATCH', 'est. this fall', '🎃'],
  beach: ['BEACH ISLET', 'over the bridge →', '🏖️'], squirrel: ['SQUIRREL TREE', 'trades only', '🐿️'], cliff: ['LOOKOUT CLIFF', 'best view in MT', '⛰️'], campfire: ['CAMPFIRE', 'no bears pls', '🔥'],
  meadow: ['WILDFLOWER MEADOW', 'bees at work', '🌼'], dock: ['FISHING DOCK', "bull trout: let 'em go", '🎣'], picnic: ['PICNIC TABLE', 'wifi: mochinet', '🧺'] };
export function zoneSigns(parent, ZONES, { groundY, OBSTACLES, BRIDGE }) {
  const out = [];
  for (const z of ZONES) { const d = ZSIGN[z.id]; if (!d) continue;
    let [sx, sz] = z.id === 'beach' ? [BRIDGE.ax - BRIDGE.dx * 1.6, BRIDGE.az - BRIDGE.dz * 1.6] : z.spot;
    const toC = Math.atan2(-sx, -sz); const perp = [Math.cos(toC), -Math.sin(toC)];
    let best = null;
    for (const k of [1.3, -1.3, 1.9, -1.9, 2.5, -2.5]) { const x = sx + perp[0] * k, zz = sz + perp[1] * k; const clear = OBSTACLES.every((o) => Math.hypot(o.x - x, o.z - zz) > o.r + 0.45); if (clear) { best = [x, zz]; break; } }
    if (!best) best = [sx + perp[0] * 1.3, sz + perp[1] * 1.3];
    const yaw = Math.atan2(-best[0], -best[1]);
    out.push(signpost(parent, [d[0], d[1]], [best[0], groundY(best[0], best[1]) - 0.03, best[1]], yaw, 0.62, { icon: d[2], tone: ['oak', 'pine', 'oak', 'walnut'][out.length % 4], width: 1.25, height: 1.15 }));
  }
  return out;
}
