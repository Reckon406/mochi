import * as THREE from 'three';
import { rng } from './noise.js';

export function canvasTex(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// Height canvas -> normal map
function heightToNormal(src, strength = 2) {
  const w = src.width, h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const out = g.createImageData(w, h);
  const H = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    let nx = -dx, ny = -dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4; out.data[i] = (nx * 0.5 + 0.5) * 255; out.data[i + 1] = (ny * 0.5 + 0.5) * 255; out.data[i + 2] = (nz * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// Fur: many short soft strokes. Returns {map, normalMap}
export function furTextures() {
  const S = 256, r = rng(11);
  const hc = document.createElement('canvas'); hc.width = hc.height = S;
  const g = hc.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  g.lineCap = 'round';
  for (let i = 0; i < 5200; i++) {
    const x = r() * S, y = r() * S, a = Math.PI / 2 + (r() - 0.5) * 0.9, l = 4 + r() * 9;
    const v = Math.floor(60 + r() * 150); g.strokeStyle = `rgba(${v},${v},${v},0.55)`; g.lineWidth = 0.8 + r() * 1.6;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke(); }
  }
  const normalMap = heightToNormal(hc, 3.2);
  const map = canvasTex(S, S, (cg) => {
    cg.drawImage(hc, 0, 0);
    cg.globalCompositeOperation = 'multiply'; cg.fillStyle = '#d9b28a'; cg.fillRect(0, 0, S, S);
    cg.globalCompositeOperation = 'source-over';
  }, { repeat: [1, 1] });
  return { map, normalMap };
}

export function softDot(color = '#ff7b8a') {
  return canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, color); gr.addColorStop(0.55, color + 'aa'); gr.addColorStop(1, color + '00');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
}

export function stripes(colors, n = 10, vertical = false, w = 128, h = 128) {
  return canvasTex(w, h, (g) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[i % colors.length];
      if (vertical) g.fillRect((i * w) / n, 0, w / n + 1, h); else g.fillRect(0, (i * h) / n, w, h / n + 1);
    }
  }, { repeat: [1, 1] });
}

export function woodTex(base = '#9a6a42', planks = 6, vertical = true) {
  const r = rng(5);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < planks; i++) {
      const s = (i * (vertical ? w : h)) / planks; const shade = (r() - 0.5) * 40;
      g.fillStyle = `rgba(${shade > 0 ? 255 : 0},${shade > 0 ? 220 : 0},${shade > 0 ? 180 : 0},${Math.abs(shade) / 200})`;
      if (vertical) g.fillRect(s, 0, w / planks, h); else g.fillRect(0, s, w, h / planks);
      g.fillStyle = 'rgba(60,35,20,0.55)'; if (vertical) g.fillRect(s, 0, 2, h); else g.fillRect(0, s, w, 2);
    }
    for (let i = 0; i < 140; i++) { g.strokeStyle = `rgba(70,40,20,${0.08 + r() * 0.1})`; g.lineWidth = 1; g.beginPath(); const x = r() * w, y = r() * h; if (vertical) { g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + 20 + r() * 40); } else { g.moveTo(x, y); g.lineTo(x + 20 + r() * 40, y + (r() - 0.5) * 3); } g.stroke(); }
  }, { repeat: [1, 1] });
}

export function thatchTex() {
  const r = rng(9);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c99a4e'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
      for (let i = 0; i < 160; i++) {
        const x = r() * w, y = row * 32 + r() * 6; const v = 150 + r() * 90;
        g.strokeStyle = `rgba(${v},${v * 0.78},${v * 0.42},0.7)`; g.lineWidth = 1 + r() * 1.5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + 30 + r() * 8); g.stroke();
      }
      g.fillStyle = 'rgba(90,60,25,0.35)'; g.fillRect(0, row * 32 + 30, w, 3);
    }
  }, { repeat: [3, 1] });
}

export function signTex(lines, { w = 512, h = 256, bg = '#f3e2c0', fg = '#5a3a22', border = '#8a5a34', font = 'bold 64px "Trebuchet MS", "Comic Sans MS", sans-serif', sizes = null } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = border; roundRect(g, 0, 0, w, h, 30); g.fill();
    g.fillStyle = bg; roundRect(g, 12, 12, w - 24, h - 24, 22); g.fill();
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((l, i) => { g.font = sizes ? `bold ${sizes[i]}px "Trebuchet MS", sans-serif` : font; g.fillText(l, w / 2, h * (i + 0.5) / n + (n === 1 ? 0 : 0)); });
  });
}
export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// Little paintings for the art market, drawn per art.kind
export function artTex(kind, title, price) {
  return canvasTex(256, 320, (g, w, h) => {
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = 130;
    g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
    if (kind === 'pumpkin') {
      g.fillStyle = '#2b1d3a'; g.fillRect(0, 0, w, 250);
      g.fillStyle = '#f08a24'; g.beginPath(); g.ellipse(cx, cy + 20, 80, 62, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#c46410'; for (const dx of [-40, 0, 40]) { g.beginPath(); g.ellipse(cx + dx * 0.6, cy + 20, 26, 60, 0, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#ffe36a'; tri(g, cx - 35, cy, cx - 15, cy, cx - 25, cy - 22); tri(g, cx + 15, cy, cx + 35, cy, cx + 25, cy - 22);
      g.beginPath(); g.moveTo(cx - 45, cy + 35); g.quadraticCurveTo(cx, cy + 70, cx + 45, cy + 35); g.quadraticCurveTo(cx, cy + 50, cx - 45, cy + 35); g.fill();
      g.fillStyle = '#4a7a2a'; g.fillRect(cx - 6, cy - 55, 12, 20);
    } else if (kind === 'muscles') {
      g.fillStyle = '#ffd9e0'; g.fillRect(0, 0, w, 250);
      g.fillStyle = '#8a5a3b'; g.beginPath(); g.arc(cx, cy + 20, 60, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(cx - 85, cy - 5, 34, 24, -0.5, 0, Math.PI * 2); g.ellipse(cx + 85, cy - 5, 34, 24, 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(cx - 20, cy, 9, 0, 7); g.arc(cx + 20, cy, 9, 0, 7); g.fill();
      g.strokeStyle = '#d9b38c'; g.lineWidth = 7; g.beginPath(); g.moveTo(cx, cy + 15); g.quadraticCurveTo(cx + 10, cy + 70, cx + 4, cy + 100); g.stroke();
      g.fillStyle = '#ff6b8a'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('💪 STRONG', cx, 40);
    } else if (kind === 'ocean') {
      const gr = g.createLinearGradient(0, 0, 0, 250); gr.addColorStop(0, '#9ad8ff'); gr.addColorStop(0.5, '#e8f7ff'); gr.addColorStop(0.52, '#2f8fd8'); gr.addColorStop(1, '#155a9a');
      g.fillStyle = gr; g.fillRect(0, 0, w, 250);
      g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(190, 60, 28, 0, 7); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 5; for (let k = 0; k < 4; k++) { g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, 150 + k * 25 + Math.sin(x / 18 + k) * 7); g.stroke(); }
    } else if (kind === 'cap') {
      g.fillStyle = '#e9f0ff'; g.fillRect(0, 0, w, 250);
      g.fillStyle = '#ffcf3a'; for (let a = 0; a < 21; a++) { const t = a / 21 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(t) * 74, cy + Math.sin(t) * 74, 12, 0, 7); g.fill(); }
      g.beginPath(); g.arc(cx, cy, 76, 0, 7); g.fill(); g.fillStyle = '#e0a800'; g.beginPath(); g.arc(cx, cy, 56, 0, 7); g.fill();
      g.fillStyle = '#7a4a00'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('#17', cx, cy);
      g.fillStyle = '#ff6b8a'; g.font = '30px sans-serif'; g.fillText('♥', cx + 70, 40);
    } else {
      g.fillStyle = '#d6f5d0'; g.fillRect(0, 0, w, 250);
      g.strokeStyle = '#9a6a42'; g.lineWidth = 6; g.beginPath(); g.moveTo(10, 230); g.quadraticCurveTo(cx, 120, w - 10, 230); g.stroke();
      g.save(); g.translate(cx, 120); g.rotate(-0.4);
      g.fillStyle = '#ff5a5a'; roundRect(g, -60, 30, 120, 18, 9); g.fill(); g.fillStyle = '#333'; g.beginPath(); g.arc(-38, 56, 9, 0, 7); g.arc(38, 56, 9, 0, 7); g.fill();
      g.fillStyle = '#8a5a3b'; g.beginPath(); g.arc(0, -5, 38, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(14, -12, 6, 0, 7); g.fill();
      g.restore(); g.fillStyle = '#333'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText('KICKFLIP!!', cx, 36);
    }
    g.fillStyle = '#5a3a22'; g.font = 'bold 22px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const t = (title || '').length > 26 ? title.slice(0, 25) + '…' : title || '';
    g.fillText(t, cx, 282); g.fillStyle = '#c0392b'; g.font = 'bold 26px "Trebuchet MS", sans-serif'; g.fillText(`$${Number(price || 0).toFixed(2)}`, cx, 312);
  });
}
function tri(g, a, b, c, d, e, f) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.lineTo(e, f); g.closePath(); g.fill(); }

export function waterNormalNone() { return null; }

export function cloudSprite() {
  return canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
}
