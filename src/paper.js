// 📰 newspaper box by the picnic lawn: the 'Bitterroot Kiwi Gazette'. The front page shows through the box window; tap it to read.
// Mochi can sit and read it (the 'read' activity). STATE: world.paper = { date, headline, stories: [{ title, blurb }] } (all optional).
import * as THREE from 'three';
import { topH } from './layout.js';
import { openCard, escHtml } from './overlay.js';

export const PAPER = { x: -3.5, z: 3.5 }; PAPER.yaw = Math.atan2(-4.4 - PAPER.x, 5.6 - PAPER.z);
const DEFAULT = { headline: 'LOCAL KIWI STILL ROUND, SOURCES CONFIRM', stories: [
  { title: 'Squirrel Denies Everything', blurb: 'The squirrel by the music stage declined to comment on the missing acorns, then ran up a tree.' },
  { title: 'River Remains Wet', blurb: 'Experts on the Bitterroot say the river is "very much still there" and "cold, honestly".' },
  { title: 'Weather: Yes', blurb: 'Expect sky. Possibly clouds. Mochi recommends a scarf regardless.' },
  { title: 'Classifieds', blurb: 'WANTED: one (1) bigger worm. Will trade shiny bottle cap.' }] };

export function paperData(state) {
  const c = state.world && typeof state.world.paper === 'object' && state.world.paper ? state.world.paper : {};
  const stories = Array.isArray(c.stories) ? c.stories.filter((s) => s && (s.title || s.blurb)).slice(0, 8).map((s) => ({ title: String(s.title || '').slice(0, 90), blurb: String(s.blurb || '').slice(0, 600) })) : [];
  const date = c.date ? String(c.date).slice(0, 40) : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return { date, headline: String(c.headline || (stories.length ? stories[0].title : DEFAULT.headline)).slice(0, 120), stories: stories.length ? stories : DEFAULT.stories, isDefault: !c.headline && !stories.length };
}

// the front page as a canvas (box window, the paper Mochi holds)
export function frontPage(P, w = 256, h = 340) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const s = w / 256;
  g.fillStyle = '#f4efe2'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1a16'; g.textAlign = 'center';
  g.font = `bold ${20 * s}px Georgia,serif`; g.fillText('Bitterroot Kiwi Gazette', w / 2, 26 * s); g.fillRect(10 * s, 33 * s, w - 20 * s, 2 * s); g.fillRect(10 * s, 37 * s, w - 20 * s, 1 * s);
  g.font = `${8 * s}px Georgia,serif`; g.fillText(P.date.toUpperCase() + '  ·  ONE BOTTLE CAP', w / 2, 47 * s);
  g.font = `bold ${21 * s}px Georgia,serif`; const words = P.headline.split(/\s+/); let line = '', y = 74 * s; const lines = []; for (const wd of words) { if (g.measureText(line + wd).width > w - 26 * s && line) { lines.push(line); line = ''; } line += wd + ' '; } lines.push(line);
  for (const l of lines.slice(0, 3)) { g.fillText(l.trim(), w / 2, y); y += 23 * s; }
  g.fillStyle = '#b9b2a2'; g.fillRect(14 * s, y - 6 * s, w * 0.48, 80 * s); g.fillStyle = '#7a6a55'; g.beginPath(); g.ellipse(14 * s + w * 0.24, y + 40 * s, 22 * s, 20 * s, 0, 0, 7); g.fill(); // a photo of Mochi, obviously
  g.fillStyle = '#1d1a16'; g.textAlign = 'left'; g.font = `bold ${9 * s}px Georgia,serif`; let sy = y; const cx = w * 0.56;
  for (const st of P.stories.slice(0, 3)) { g.fillText(st.title.slice(0, 24), cx, sy); sy += 11 * s; g.fillStyle = '#6d665a'; for (let i = 0; i < 3; i++) { g.fillRect(cx, sy - 6 * s, (w - cx - 14 * s) * (i === 2 ? 0.6 : 1), 2.5 * s); sy += 6 * s; } g.fillStyle = '#1d1a16'; sy += 5 * s; }
  g.fillStyle = '#6d665a'; for (let r = y + 88 * s; r < h - 14 * s; r += 7 * s) { g.fillRect(14 * s, r, (w - 28 * s) / 2 - 6 * s, 2.5 * s); g.fillRect(w / 2 + 4 * s, r, (w - 28 * s) / 2 - 6 * s, 2.5 * s); }
  return c;
}

export function createPaper(scene, { state, tier = 2 }) {
  const P = paperData(state);
  const g = new THREE.Group(); g.name = 'paperbox'; g.position.set(PAPER.x, topH(PAPER.x, PAPER.z), PAPER.z); g.rotation.y = PAPER.yaw; scene.add(g);
  const blue = new THREE.MeshStandardMaterial({ color: 0x2f6f9f, roughness: 0.45, metalness: 0.35 }), dk = new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.5, metalness: 0.4 });
  const clickables = []; const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); clickables.push(o); return o; };
  add(new THREE.BoxGeometry(0.06, 0.4, 0.06), dk, 0, 0.2, 0);
  add(new THREE.BoxGeometry(0.52, 0.62, 0.44), blue, 0, 0.71, 0);
  const lid = add(new THREE.BoxGeometry(0.56, 0.05, 0.48), blue, 0, 1.045, 0); lid.rotation.x = -0.05;
  const tex = new THREE.CanvasTexture(frontPage(P, tier >= 2 ? 256 : 192, tier >= 2 ? 340 : 255)); tex.colorSpace = THREE.SRGBColorSpace;
  const win = add(new THREE.PlaneGeometry(0.36, 0.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }), 0, 0.78, 0.222);
  add(new THREE.BoxGeometry(0.42, 0.03, 0.02), dk, 0, 0.55, 0.225); // handle
  { const c = document.createElement('canvas'); c.width = 256; c.height = 48; const k = c.getContext('2d'); k.fillStyle = '#f2f2f2'; k.font = 'bold 22px Georgia,serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText('KIWI GAZETTE', 128, 25); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.086), new THREE.MeshBasicMaterial({ map: t, transparent: true })); m.position.set(0, 0.99, 0.222); g.add(m); }
  void win;
  function html() {
    const [lead, ...rest] = P.stories;
    return `<div class="paper"><div class="mast"><b>The Bitterroot Kiwi Gazette</b><div style="font-size:11px;font-style:italic">"All the news that fits in a beak"</div></div>
      <div class="meta"><span>${escHtml(P.date)}</span><span>Vol. I · One bottle cap</span></div><h1>${escHtml(P.headline)}</h1>
      <div class="cols">${lead ? `<div class="st lead"><h3>${escHtml(lead.title)}</h3><p>${escHtml(lead.blurb)}</p></div>` : ''}${rest.map((s) => `<div class="st"><h3>${escHtml(s.title)}</h3><p>${escHtml(s.blurb)}</p></div>`).join('')}</div>
      <div class="foot">Printed on the island by a very small press. Delivered by Mochi, who also wrote it.</div></div>`;
  }
  // a folded copy Mochi can hold and read
  const held = () => { const grp = new THREE.Group(); const t = new THREE.CanvasTexture(frontPage(P, 192, 255)); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), m); pg.position.set(0.14 * s, 0, 0.02); pg.rotation.y = -0.3 * s; grp.add(pg); } return grp; };
  return { group: g, data: P, clickables, held, spot: new THREE.Vector3(-4.4, 0, 4.1), open() { return openCard(html(), { wide: true }); },
    tap(ray) { const h = ray.intersectObjects(clickables, false)[0]; if (!h || h.distance > 30) return false; this.open(); return true; } };
}
