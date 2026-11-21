// Stage A extras: photo mode (hide UI, save PNG / 9:16 wallpaper), petting Mochi (hearts + wiggle), tossing him a snack.
import * as THREE from 'three';

const LS = 'mochi.care';
function loadCare() { try { const c = JSON.parse(localStorage.getItem(LS) || '{}'); const today = new Date().toLocaleDateString('en-CA'); if (c.day !== today) { c.day = today; c.petsToday = 0; c.snacksToday = 0; } return { pets: 0, snacks: 0, petsToday: 0, snacksToday: 0, ...c }; } catch (e) { return { pets: 0, snacks: 0, petsToday: 0, snacksToday: 0 }; } }
function emojiTex(ch) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = '52px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 36); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

export function createExtras({ scene, camera, renderer, renderNow, mochi, music, say, feel, onPhoto }) {
  const care = loadCare(); const save = () => { try { localStorage.setItem(LS, JSON.stringify(care)); } catch (e) { /* private mode */ } };
  // ── hearts (6 pooled sprites, one texture) ──
  const heartT = emojiTex('💗'); const hearts = [];
  for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartT, transparent: true, depthWrite: false, opacity: 0 })); s.scale.setScalar(0.32); s.visible = false; scene.add(s); hearts.push(s); }
  let wiggle = 0;
  const PET = ['hehe. again', 'that is the spot', 'purring (kiwis can purr now. i decided)', 'best day', 'ok one more', 'i love it here'];
  function pet() {
    const p = mochi.root.position; hearts.forEach((h, i) => { h.userData = { t: -i * 0.12, x: p.x + (Math.random() - 0.5) * 0.6, y: p.y + 1.2, z: p.z + (Math.random() - 0.5) * 0.6 }; h.visible = true; });
    wiggle = 1.2; mochi.hop(0.4); mochi.flap(0.8); feel.perk = Math.min(1, (feel.perk || 0) + 0.12); mochi.mods.perk = Math.max(mochi.mods.perk || 0, feel.perk);
    care.pets++; care.petsToday++; save(); music?.sfx?.('hop');
    say(care.petsToday === 1 ? 'oh! a pet! hi!' : `${PET[Math.floor(Math.random() * PET.length)]} (pets today: ${care.petsToday})`, 2.6);
  }
  // ── snack toss: a berry or a worm arcs in, he catches it ──
  const berryM = new THREE.MeshStandardMaterial({ color: 0x4a2f7a, roughness: 0.35 }), wormM = new THREE.MeshStandardMaterial({ color: 0xe08a9a, roughness: 0.5 });
  const snack = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), berryM); snack.visible = false; snack.castShadow = true; scene.add(snack);
  let fly = null;
  function toss() {
    if (fly) return; const p = mochi.root.position; const h = mochi.root.rotation.y; const worm = Math.random() < 0.35;
    snack.material = worm ? wormM : berryM; snack.scale.set(worm ? 1.6 : 1, worm ? 0.45 : 1, worm ? 0.45 : 1);
    const beak = new THREE.Vector3(p.x + Math.sin(h) * 0.9, p.y + 0.75, p.z + Math.cos(h) * 0.9);
    const from = camera.position.clone().lerp(beak, 0.55); from.y = Math.max(from.y, beak.y + 0.5);
    fly = { t: 0, from, to: beak, worm }; snack.position.copy(from); snack.visible = true; say(worm ? 'is that... a worm?? for me??' : 'BERRY INCOMING', 1.4);
  }
  function update(dt) {
    for (const s of hearts) if (s.visible) { const d = s.userData; d.t += dt; if (d.t < 0) continue; s.position.set(d.x + Math.sin(d.t * 5 + d.x) * 0.12, d.y + d.t * 0.9, d.z); s.material.opacity = Math.max(0, 1 - d.t * 0.8); if (d.t > 1.25) s.visible = false; }
    if (wiggle > 0) { wiggle -= dt; mochi.pivot.rotation.z = Math.sin(wiggle * 22) * 0.12 * Math.min(1, wiggle); if (wiggle <= 0) mochi.pivot.rotation.z = 0; }
    if (fly) { fly.t += dt / 0.9; const k = Math.min(1, fly.t); snack.position.lerpVectors(fly.from, fly.to, k); snack.position.y += Math.sin(Math.PI * k) * 1.4; snack.rotation.x += dt * 8;
      if (k >= 1) { snack.visible = false; const w = fly.worm; fly = null; mochi.flap(1); mochi.hop(0.35); mochi.pose.peck = 1; setTimeout(() => { mochi.pose.peck = 0; }, 600);
        feel.perk = Math.min(1, (feel.perk || 0) + 0.15); care.snacks++; care.snacksToday++; save(); say(w ? 'CAUGHT IT. protein. 10/10' : 'caught it! huckleberry? 11/10', 2.4); } }
  }

  // ── photo mode ──
  let photo = false; const bar = document.createElement('div'); bar.id = 'photobar'; bar.hidden = true;
  bar.innerHTML = '<button data-a="png">📸 save photo</button><button data-a="wall">📱 9:16 wallpaper</button><button data-a="exit">✕</button>'; document.body.appendChild(bar);
  function setPhoto(on) { photo = on; document.body.classList.toggle('photo', on); bar.hidden = !on; onPhoto?.(on); }
  function grab(wall) {
    try { renderNow(); const src = renderer.domElement; let out = src;
      if (wall) { const W = src.width, H = src.height; let cw = W, ch = H; if (W / H > 9 / 16) cw = Math.round(H * 9 / 16); else ch = Math.round(W * 16 / 9);
        const sc = Math.max(1, 1920 / ch); const c = document.createElement('canvas'); c.width = Math.round(cw * sc); c.height = Math.round(ch * sc); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, (W - cw) / 2, (H - ch) / 2, cw, ch, 0, 0, c.width, c.height); out = c; }
      out.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `mochi-${wall ? 'wallpaper' : 'photo'}-${Date.now()}.png`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }, 'image/png');
    } catch (e) { console.warn('photo save failed', e); }
  }
  bar.addEventListener('click', (e) => { const a = e.target.closest('button')?.dataset.a; if (a === 'png') grab(false); else if (a === 'wall') grab(true); else if (a === 'exit') setPhoto(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && photo) setPhoto(false); });
  // buttons in the top-right tool stack
  const tools = document.querySelector('#ui .tools');
  if (tools) { const slot = document.getElementById('morePop') || tools; const mk = (id, txt, title, fn) => { const b = document.createElement('button'); b.id = id; b.textContent = txt; b.title = title; b.onclick = (e) => { e.currentTarget.blur(); fn(); }; if (slot.id === 'morePop') slot.appendChild(b); else tools.insertBefore(b, tools.querySelector('.hint')); return b; };
    mk('photoBtn', '📷 photo', 'photo mode: hide the UI and save a picture', () => setPhoto(true)); mk('snackBtn', '🫐 snack', 'toss mochi a snack', toss); }
  return { pet, toss, update, setPhoto, grab, care, get photo() { return photo; } };
}
