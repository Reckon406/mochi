// 📸 memory box by the hut: a little shelf of framed polaroids (long-term memories) + a corkboard of pinned notes (short-term).
// Tap either to open them as cards. STATE: world.memories = { long: [{ text, date, tag }], short: [{ text, date, tag }] }
// (strings are fine too). Each list is capped at 24, oldest pushed out.
import * as THREE from 'three';
import { topH } from './layout.js';
import { openCard, escHtml } from './overlay.js';

export const MEM = { x: -10.0, z: -11.0 }; MEM.yaw = Math.atan2(-5.5 - MEM.x, -11.5 - MEM.z); // faces the hut's front yard
const CAP = 24;
const TAG_EMO = { fish: '🎣', fishing: '🎣', food: '🍲', friend: '💛', friends: '💛', crush: '💕', love: '💕', adventure: '🗺️', trip: '🗺️', music: '🎵', art: '🎨', garden: '🥕', game: '🎮', gaming: '🎮', weather: '⛈️', snow: '❄️', squirrel: '🐿️', pet: '🐾', corey: '🧢', milestone: '🏆', funny: '😂', sad: '🌧️', home: '🏡' };
const BG = ['#bfe3f5', '#f7d6a8', '#cfe8c0', '#f3c6d3', '#d9cff3', '#fbe7a1'];
function norm(list) { if (!Array.isArray(list)) return []; return list.map((m) => (typeof m === 'string' ? { text: m } : m && typeof m === 'object' ? m : null)).filter((m) => m && m.text).map((m) => ({ text: String(m.text).slice(0, 280), date: m.date ? String(m.date).slice(0, 24) : '', tag: m.tag ? String(m.tag).toLowerCase().slice(0, 20) : '' })).slice(-CAP); }
const emo = (m, i) => TAG_EMO[m.tag] || ['🥝', '🌄', '🌲', '🏞️', '🌙', '⭐'][i % 6];

export function createMemories(scene, { state, tier = 2, crush = null }) {
  const cfg = state.world && typeof state.world.memories === 'object' && state.world.memories ? state.world.memories : {};
  const mem = { long: norm(cfg.long), short: norm(cfg.short) };
  const g = new THREE.Group(); g.name = 'memories'; const y0 = topH(MEM.x, MEM.z); g.position.set(MEM.x, y0, MEM.z); g.rotation.y = MEM.yaw; scene.add(g);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.85 }), dk = new THREE.MeshStandardMaterial({ color: 0x5e3b22, roughness: 0.9 });
  const clickables = [];
  // shelf: two side boards, three shelves, a back panel and a little roof so the photos stay dry
  const shelf = new THREE.Group(); shelf.position.set(-0.75, 0, 0); g.add(shelf);
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; shelf.add(b); clickables.push(b); return b; };
  for (const s of [-1, 1]) box(0.06, 1.3, 0.34, wood, 0.6 * s, 0.65, 0);
  for (const y of [0.08, 0.55, 1.02]) box(1.2, 0.04, 0.34, wood, 0, y, 0);
  box(1.26, 1.3, 0.03, dk, 0, 0.65, -0.17);
  const roof = box(1.42, 0.05, 0.5, dk, 0, 1.36, 0.03); roof.rotation.x = -0.12;
  // polaroids drawn on one canvas atlas (8 slots), newest first
  const PW = 128, PH = 156; const atlas = document.createElement('canvas'); atlas.width = PW * 4; atlas.height = PH * 2; const q = atlas.getContext('2d');
  const shown = mem.long.slice(-8).reverse();
  shown.forEach((m, i) => { const x = (i % 4) * PW, y = Math.floor(i / 4) * PH; q.fillStyle = '#fffdf7'; q.fillRect(x + 4, y + 4, PW - 8, PH - 8); q.fillStyle = BG[i % BG.length]; q.fillRect(x + 12, y + 12, PW - 24, PW - 30);
    q.font = '48px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(emo(m, i), x + PW / 2, y + 12 + (PW - 30) / 2);
    q.fillStyle = '#3a2c20'; q.font = '13px "Comic Sans MS","Chalkboard SE",sans-serif'; q.fillText(m.text.slice(0, 16) + (m.text.length > 16 ? '…' : ''), x + PW / 2, y + PH - 24); });
  const at = new THREE.CanvasTexture(atlas); at.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.MeshStandardMaterial({ map: at, roughness: 0.6 });
  shown.forEach((m, i) => { const geo = new THREE.PlaneGeometry(0.2, 0.244); const u0 = (i % 4) / 4, v1 = 1 - Math.floor(i / 4) / 2, u1 = u0 + 0.25, v0 = v1 - 0.5; const uv = geo.attributes.uv; uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
    const p = new THREE.Mesh(geo, pm); const row = i < 4 ? 1 : 0; p.position.set(-0.42 + (i % 4) * 0.28, (row ? 1.04 : 0.57) + 0.125, -0.06 + (i % 2) * 0.03); p.rotation.set(-0.12, ((i * 37) % 9 - 4) * 0.04, ((i * 53) % 7 - 3) * 0.03); p.castShadow = true; shelf.add(p); clickables.push(p); });
  if (!shown.length) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const k = c.getContext('2d'); k.fillStyle = '#fffdf7'; k.fillRect(0, 0, 256, 64); k.fillStyle = '#5a4a3a'; k.font = 'italic 24px Georgia,serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText('memories go here', 128, 32); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshStandardMaterial({ map: t })); m.position.set(0, 0.8, -0.14); shelf.add(m); clickables.push(m); }
  // keepsake box on the bottom shelf
  const kb = box(0.36, 0.2, 0.24, new THREE.MeshStandardMaterial({ color: 0xc0504d, roughness: 0.6 }), 0.3, 0.2, 0.02); void kb; box(0.38, 0.04, 0.26, new THREE.MeshStandardMaterial({ color: 0xe8c45a, roughness: 0.4, metalness: 0.3 }), 0.3, 0.31, 0.02);
  box(0.3, 0.16, 0.22, new THREE.MeshStandardMaterial({ color: 0x4a7fb0, roughness: 0.6 }), -0.25, 0.18, 0.02);
  // corkboard on two posts with pinned notes (short-term)
  const cork = new THREE.Group(); cork.position.set(0.75, 0, 0.05); g.add(cork);
  const cbox = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; cork.add(b); clickables.push(b); return b; };
  for (const s of [-1, 1]) cbox(0.06, 1.35, 0.06, dk, 0.5 * s, 0.67, -0.03);
  cbox(1.08, 0.78, 0.05, wood, 0, 0.95, 0);
  const CW = 512, CH = 360; const cc = document.createElement('canvas'); cc.width = CW; cc.height = CH; const k = cc.getContext('2d');
  k.fillStyle = '#c79a63'; k.fillRect(0, 0, CW, CH); for (let i = 0; i < 900; i++) { k.fillStyle = `rgba(${Math.random() < 0.5 ? '90,60,30' : '230,200,150'},0.25)`; k.fillRect(Math.random() * CW, Math.random() * CH, 2, 2); }
  const notes = mem.short.slice(-9).reverse(); const NB = ['#fff59d', '#ffcc80', '#b3e5fc', '#c8e6c9', '#f8bbd0'];
  notes.forEach((m, i) => { const x = 18 + (i % 3) * 164, y = 14 + Math.floor(i / 3) * 114; k.save(); k.translate(x + 70, y + 50); k.rotate(((i * 29) % 7 - 3) * 0.035); k.fillStyle = 'rgba(0,0,0,0.25)'; k.fillRect(-66, -44, 140, 100); k.fillStyle = NB[i % NB.length]; k.fillRect(-70, -48, 140, 100);
    k.fillStyle = '#2b2b2b'; k.font = '17px "Comic Sans MS","Chalkboard SE",sans-serif'; k.textAlign = 'left'; k.textBaseline = 'top'; const words = m.text.split(/\s+/); let line = '', ly = -36, n = 0; for (const w of words) { if (k.measureText(line + w).width > 124 && line) { k.fillText(line, -62, ly); ly += 20; line = ''; if (++n > 2) break; } line += w + ' '; } if (n <= 2) k.fillText(line, -62, ly);
    k.fillStyle = ['#e53935', '#1e88e5', '#43a047'][i % 3]; k.beginPath(); k.arc(0, -44, 7, 0, 7); k.fill(); k.restore(); });
  if (!notes.length) { k.fillStyle = '#fff59d'; k.fillRect(170, 120, 170, 110); k.fillStyle = '#333'; k.font = '20px "Comic Sans MS",sans-serif'; k.textAlign = 'center'; k.fillText('nothing yet', 255, 180); }
  if (crush) { const known = crush.discovered.filter((id) => crush.likes.includes(id)); const no = crush.discovered.includes(crush.dislike);
    if (known.length || no) { k.save(); k.translate(CW - 150, CH - 92); k.rotate(0.05); k.fillStyle = 'rgba(0,0,0,0.25)'; k.fillRect(4, 4, 140, 84); k.fillStyle = '#ffe0ec'; k.fillRect(0, 0, 140, 84); k.fillStyle = '#b0306a'; k.font = 'bold 15px "Comic Sans MS",sans-serif'; k.textAlign = 'center'; k.fillText(`${crush.name === '???' ? 'her' : crush.name} ♡`, 70, 20);
      k.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; k.fillText(known.map((id) => crush.interest(id).emoji).join(' ') + (no ? `  🚫${crush.interest(crush.dislike).emoji}` : ''), 70, 58); k.fillStyle = '#e53935'; k.beginPath(); k.arc(70, 2, 6, 0, 7); k.fill(); k.restore(); } }
  const ct = new THREE.CanvasTexture(cc); ct.colorSpace = THREE.SRGBColorSpace; ct.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.95 })); face.position.set(0, 0.95, 0.027); cork.add(face); clickables.push(face);
  // the little sign
  { const c = document.createElement('canvas'); c.width = 256; c.height = 56; const s = c.getContext('2d'); s.fillStyle = '#3d2615'; s.fillRect(0, 0, 256, 56); s.fillStyle = '#fbe9cf'; s.font = 'bold 26px Nunito,sans-serif'; s.textAlign = 'center'; s.textBaseline = 'middle'; s.fillText('📸 memories', 128, 29); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.135), new THREE.MeshBasicMaterial({ map: t })); m.position.set(0, 1.44, 0.03); m.rotation.x = -0.12; shelf.add(m); }

  function herCard() { if (!crush) return ''; const known = crush.discovered.filter((id) => crush.likes.includes(id)); const no = crush.discovered.includes(crush.dislike) ? crush.interest(crush.dislike) : null; const left = crush.likes.length - known.length;
    const chip = (i, bad) => `<span style="display:inline-flex;align-items:center;gap:6px;background:${bad ? '#ffe3e3' : '#fff'};border-radius:99px;padding:5px 11px;margin:3px;font-size:13px;box-shadow:0 1px 3px rgba(0,0,0,.2)">${bad ? '🚫 ' : ''}<b style="font-size:18px">${i.emoji}</b>${escHtml(i.label)}</span>`;
    return `<div style="background:#ffe0ec;border-radius:10px;padding:12px;margin-top:14px;color:#5a2440"><div style="font-weight:800;font-size:15px;margin-bottom:6px">💕 What I know about ${escHtml(crush.name === '???' ? 'her' : crush.name)}</div>
      <div>${known.map((id) => chip(crush.interest(id))).join('') || '<span style="opacity:.7;font-size:13px">nothing yet... she keeps dropping hints though</span>'}</div>${no ? `<div style="margin-top:4px">${chip(no, true)}</div>` : ''}
      <div style="font-size:12px;opacity:.75;margin-top:6px">${left > 0 ? `${left} more thing${left > 1 ? 's' : ''} she loves that I haven't figured out yet` : 'I know all her favourite things ♡'}</div></div>`; }
  function html(which) {
    const rot = (i) => `${((i * 37) % 9 - 4) * 0.8}deg`;
    const pols = mem.long.slice().reverse().map((m, i) => `<div class="pol" style="--r:${rot(i)};--bg:${BG[i % BG.length]}"><div class="ph">${emo(m, i)}</div>${escHtml(m.text)}${m.date ? `<div class="d">${escHtml(m.date)}</div>` : ''}${m.tag ? `<span class="tg">${escHtml(m.tag)}</span>` : ''}</div>`).join('');
    const nts = mem.short.slice().reverse().map((m, i) => `<div class="note" style="--r:${rot(i + 3)};--bg:${NB[i % NB.length]};--pin:${['#e53935', '#1e88e5', '#43a047'][i % 3]}">${escHtml(m.text)}${m.date ? `<div style="font-size:11px;opacity:.6;margin-top:4px">${escHtml(m.date)}</div>` : ''}</div>`).join('');
    return `<div class="mem-wrap"><div class="mem-h">📸 Mochi's memories</div><div class="mem-sub">${mem.long.length} kept forever · ${mem.short.length} on the corkboard</div>
      ${which !== 'short' ? `<div class="mem-grid">${pols || '<div class="empty">no big memories yet. give it time.</div>'}</div>` : ''}
      <div class="cork"><div class="mem-grid">${nts || '<div class="empty" style="color:#3a2a1a">corkboard is empty</div>'}</div></div>${herCard()}</div>`;
  }
  const api = { group: g, mem, clickables, spot: new THREE.Vector3(MEM.x + Math.sin(MEM.yaw) * 1.3, 0, MEM.z + Math.cos(MEM.yaw) * 1.3), faceYaw: MEM.yaw + Math.PI,
    open(which) { return openCard(html(which), { wide: true }); },
    tap(ray) { const h = ray.intersectObjects(clickables, false)[0]; if (!h || h.distance > 30) return false; let o = h.object, short = false; while (o) { if (o === cork) short = true; o = o.parent; } api.open(short ? 'short' : 'long'); return true; } };
  return api;
}
