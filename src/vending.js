// 🎰 detailed vending-machine front (Cap-O-Matic + Gun-O-Matic): glass window over a drawn interior (rows of goodies on spiral
// coils, a price tag per slot), lit header, keypad + coin slot panel, pickup tray. Everything is CanvasTexture: nothing downloaded,
// ~7 draw calls per machine, same on every quality tier. Local frame: machine body 0.9 x 1.7 x 0.6 centred at x=0, front face z=0.3.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const TRINKETS = ['tiny rubber duck', 'glow-in-the-dark star', 'googly eye (single)', 'mini compass', 'cursed marble', 'sticker of a moose', 'whistle', 'tiny sunglasses', 'bouncy ball', 'plastic gold coin'];

const FONT = '"Trebuchet MS", "Comic Sans MS", sans-serif';
const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const fit = (g, s, max, px, weight = 'bold') => { let p = px; do { g.font = `${weight} ${p}px ${FONT}`; p--; } while (g.measureText(s).width > max && p > 8); };

// little item drawings, centred at (x, y), size s
function drawItem(g, kind, x, y, s, col, k) {
  g.save(); g.translate(x, y);
  if (kind === 'cap') { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 42; i++) { const a = i / 42 * Math.PI * 2, r = s * (i % 2 ? 0.42 : 0.47); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-s * 0.1, -s * 0.12, s * 0.22, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, s * 0.33, 0, 7); g.stroke(); }
  else if (kind === 'bag') { g.fillStyle = col; rr(g, -s * 0.32, -s * 0.48, s * 0.64, s * 0.92, 6); g.fill(); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(-s * 0.26, -s * 0.12, s * 0.52, s * 0.22);
    g.fillStyle = col; fit(g, ['CHIPS', 'JERKY', 'NUTS', 'GUMMY'][k % 4], s * 0.5, s * 0.17); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['CHIPS', 'JERKY', 'NUTS', 'GUMMY'][k % 4], 0, -s * 0.01);
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (const yy of [-s * 0.48, s * 0.4]) g.fillRect(-s * 0.32, yy, s * 0.64, s * 0.06); }
  else if (kind === 'can') { const gr = g.createLinearGradient(-s * 0.22, 0, s * 0.22, 0); gr.addColorStop(0, col); gr.addColorStop(0.45, '#ffffff'); gr.addColorStop(0.55, col); gr.addColorStop(1, '#222'); g.fillStyle = gr; rr(g, -s * 0.22, -s * 0.42, s * 0.44, s * 0.86, 5); g.fill();
    g.fillStyle = '#c8c8d0'; g.fillRect(-s * 0.2, -s * 0.46, s * 0.4, s * 0.06); g.fillStyle = '#fff'; g.font = `bold ${Math.round(s * 0.16)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['FIZZ', 'POP', 'SODA'][k % 3], 0, 0); }
  else if (kind === 'ball') { const gr = g.createRadialGradient(-s * 0.12, -s * 0.14, s * 0.04, 0, 0, s * 0.4); gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, col); gr.addColorStop(1, '#1a1a1a'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s * 0.36, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-s * 0.36, 0); g.lineTo(s * 0.36, 0); g.stroke(); }
  else if (kind === 'gun') { g.rotate(-0.25); g.fillStyle = '#6b4426'; rr(g, -s * 0.46, -s * 0.06, s * 0.36, s * 0.16, 4); g.fill(); g.fillStyle = '#3a3d44'; g.fillRect(-s * 0.12, -s * 0.07, s * 0.6, s * 0.09); g.fillStyle = col; g.fillRect(-s * 0.12, s * 0.02, s * 0.1, s * 0.14); }
  g.restore();
}

/* opts: { title, sub, items: [{ label, price, kind, color, sold }], cols, rows, accent, header } */
export function vendFront(opts) {
  const { title, sub, items, cols = 4, rows = 4, accent = '#f2c23a', header = '#c62f2f' } = opts;
  const grp = new THREE.Group(); grp.name = 'vend-front';
  // interior: back panel + coils + goods + tags
  const inner = tex(512, 640, (g, W, H) => {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2b2f38'); bg.addColorStop(1, '#14161b'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const cw = W / cols, rh = H / rows;
    for (let r = 0; r < rows; r++) { const y0 = r * rh;
      g.fillStyle = 'rgba(255,240,200,0.06)'; g.fillRect(0, y0 + 4, W, rh * 0.62); // shelf back-light
      for (let c = 0; c < cols; c++) { const i = r * cols + c, it = items[i % items.length], x = c * cw + cw / 2;
        g.strokeStyle = 'rgba(200,205,215,0.55)'; g.lineWidth = 3; for (let t = 0; t < 4; t++) { g.beginPath(); g.ellipse(x - cw * 0.3 + t * cw * 0.2, y0 + rh * 0.6, cw * 0.06, rh * 0.06, 0, 0, 7); g.stroke(); } // spiral coil
        if (!it.sold) drawItem(g, it.kind, x, y0 + rh * 0.34, Math.min(cw, rh) * 0.6, it.color, i);
        else { g.fillStyle = 'rgba(255,255,255,0.18)'; g.font = `bold ${Math.round(rh * 0.14)}px ${FONT}`; g.textAlign = 'center'; g.fillText('SOLD OUT', x, y0 + rh * 0.42); }
        // price tag on the shelf lip
        const tw = cw * 0.92, th = rh * 0.27, tx = x - tw / 2, ty = y0 + rh * 0.71; g.fillStyle = it.sold ? '#9a9a9a' : '#fffbe8'; rr(g, tx, ty, tw, th, 6); g.fill();
        g.fillStyle = '#c62f2f'; g.fillRect(tx, ty, 26, th); g.fillStyle = '#fff'; g.font = `bold ${Math.round(th * 0.55)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String.fromCharCode(65 + r) + (c + 1), tx + 13, ty + th / 2);
        g.fillStyle = '#2a1a10'; fit(g, it.price, tw - 32, Math.round(th * 0.56)); g.fillText(it.price, tx + 26 + (tw - 26) / 2, ty + th * 0.34);
        g.fillStyle = '#6a5a4a'; fit(g, it.label, tw - 32, Math.round(th * 0.32), '600'); g.fillText(it.label, tx + 26 + (tw - 26) / 2, ty + th * 0.76); }
      g.fillStyle = '#9aa0aa'; g.fillRect(0, y0 + rh * 0.69, W, 4); }
    const sh = g.createLinearGradient(0, 0, W, 0); sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(0.12, 'rgba(0,0,0,0)'); sh.addColorStop(0.88, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = sh; g.fillRect(0, 0, W, H); });
  const WX = -0.1, WY = 1.04, WW = 0.6, WH = 0.78; // window
  const back = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), new THREE.MeshStandardMaterial({ map: inner, emissive: 0xffffff, emissiveMap: inner, emissiveIntensity: 0.25, roughness: 0.8 }));
  back.position.set(WX, WY, 0.302); grp.add(back);
  // chrome frame + shelf lips: one merged mesh
  const parts = []; const bx = (w, h, d, x, y, z) => parts.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  bx(WW + 0.06, 0.03, 0.04, WX, WY + WH / 2 + 0.015, 0.31); bx(WW + 0.06, 0.03, 0.04, WX, WY - WH / 2 - 0.015, 0.31); bx(0.03, WH, 0.04, WX - WW / 2 - 0.015, WY, 0.31); bx(0.03, WH, 0.04, WX + WW / 2 + 0.015, WY, 0.31);
  for (let r = 1; r <= rows; r++) bx(WW, 0.012, 0.02, WX, WY + WH / 2 - (r * WH / rows) + WH / rows * 0.31 - 0.006, 0.312);
  const frame = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.75, roughness: 0.32 })); frame.castShadow = false; grp.add(frame);
  // glass: faint tint + a diagonal sheen drawn in
  const sheen = tex(64, 128, (g, W, H) => { g.fillStyle = 'rgba(200,230,255,0.10)'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(W * 0.15, 0); g.lineTo(W * 0.45, 0); g.lineTo(W * 0.05, H * 0.6); g.lineTo(0, H * 0.6); g.lineTo(0, H * 0.35); g.fill(); g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(W * 0.6, 0); g.lineTo(W * 0.7, 0); g.lineTo(W * 0.2, H); g.lineTo(W * 0.1, H); g.fill(); });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), new THREE.MeshStandardMaterial({ map: sheen, transparent: true, roughness: 0.05, metalness: 0.1, depthWrite: false }));
  glass.position.set(WX, WY, 0.326); grp.add(glass);
  // side panel: selection keypad, display, coin slot, "insert caps"
  const panel = tex(128, 320, (g, W, H) => { g.fillStyle = '#23262c'; rr(g, 0, 0, W, H, 10); g.fill();
    g.fillStyle = '#0d2a12'; rr(g, 12, 12, W - 24, 44, 6); g.fill(); g.fillStyle = '#5dff7a'; g.font = `bold 22px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(opts.display || 'A1 ?', W / 2, 35);
    const keys = ['A', 'B', 'C', 'D', '1', '2', '3', '4', 'OK']; keys.forEach((k, i) => { const x = 14 + (i % 3) * 35, y = 70 + Math.floor(i / 3) * 34; g.fillStyle = '#d8dbe0'; rr(g, x, y, 30, 28, 5); g.fill(); g.fillStyle = '#222'; g.font = 'bold 15px sans-serif'; g.fillText(k, x + 15, y + 15); });
    g.fillStyle = '#c8c8d0'; rr(g, 34, 182, 60, 70, 8); g.fill(); g.fillStyle = '#111'; g.fillRect(60, 192, 8, 48); // coin slot plate
    g.fillStyle = accent; g.font = 'bold 14px sans-serif'; g.fillText('INSERT', W / 2, 270); g.fillText('CAPS', W / 2, 288); g.fillStyle = '#ff5050'; g.beginPath(); g.arc(W / 2, 306, 5, 0, 7); g.fill(); });
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.5), new THREE.MeshStandardMaterial({ map: panel, roughness: 0.5, emissive: 0xffffff, emissiveMap: panel, emissiveIntensity: 0.12 })); pm.position.set(0.31, 1.07, 0.302); grp.add(pm);
  // pickup tray: dark recess with a hinged flap
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.04), new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 })); tray.position.set(-0.1, 0.36, 0.29); grp.add(tray);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.012), new THREE.MeshStandardMaterial({ color: 0x3a3d44, metalness: 0.4, roughness: 0.35, transparent: true, opacity: 0.85 })); flap.position.set(-0.1, 0.37, 0.318); flap.rotation.x = -0.25; grp.add(flap);
  const push = tex(128, 32, (g, W, H) => { g.fillStyle = '#3a3d44'; g.fillRect(0, 0, W, H); g.fillStyle = '#e8e8e8'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PUSH', W / 2, H / 2); });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshBasicMaterial({ map: push })); pl.position.set(-0.1, 0.48, 0.302); grp.add(pl);
  // lit header: emissive sign (bright at night via the caller's glow list)
  const head = tex(512, 160, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, header); gr.addColorStop(1, '#5a1010'); g.fillStyle = gr; rr(g, 0, 0, W, H, 18); g.fill();
    g.strokeStyle = accent; g.lineWidth = 6; rr(g, 8, 8, W - 16, H - 16, 14); g.stroke(); for (let i = 0; i < 22; i++) { g.fillStyle = i % 2 ? '#fff6c8' : accent; g.beginPath(); g.arc(22 + i * (W - 44) / 21, 16, 4, 0, 7); g.fill(); g.beginPath(); g.arc(22 + i * (W - 44) / 21, H - 16, 4, 0, 7); g.fill(); }
    g.fillStyle = '#fff6c8'; g.shadowColor = accent; g.shadowBlur = 16; g.textAlign = 'center'; g.textBaseline = 'middle'; fit(g, title, W - 60, 66); g.fillText(title, W / 2, H * 0.43); g.shadowBlur = 0; g.fillStyle = accent; fit(g, sub, W - 80, 28); g.fillText(sub, W / 2, H * 0.76); });
  const glowM = new THREE.MeshStandardMaterial({ map: head, emissive: 0xffffff, emissiveMap: head, emissiveIntensity: 0.6, roughness: 0.4 });
  const hm = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.26), glowM); hm.position.set(0, 1.57, 0.303); grp.add(hm);
  return { group: grp, glowM, backM: back.material };
}
