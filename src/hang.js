// Where Mochi's pictures hang. STATE.art[i].hang = 'easel' | 'shop' | 'market' | 'hut' | 'museum' | 'picnic' | 'dock' (+ optional slot)
// Defaults: newest on the easel, the next few in the Art Shop, older ones (then prints of his real pictures) on the other buildings.
import * as THREE from 'three';
import { artTex } from './textures.js';
import { applyArtFile, artUrl } from './artfiles.js';

export const SLOTS = { easel: 1, shop: 9, market: 5, hut: 2, museum: 2, picnic: 1, dock: 1 };
const SCATTER = ['hut', 'museum', 'market', 'picnic', 'dock', 'market', 'hut', 'museum', 'market', 'market', 'market'];

export function planHangs(art = []) {
  const out = {}; for (const k in SLOTS) out[k] = new Array(SLOTS[k]).fill(null);
  const items = art.map((a, i) => ({ a, i })).filter((x) => x.a && typeof x.a === 'object');
  const newest = [...items].reverse(); const placed = new Set();
  const put = (loc, it, slot) => { const L = out[loc]; let k = Number.isInteger(slot) && slot >= 0 && slot < L.length && !L[slot] ? slot : L.indexOf(null); if (k < 0) return false; L[k] = it; return true; };
  // 1) explicit placements (newest wins a contested slot); a full spot overflows into the shop
  for (const it of newest) { const h = String(it.a.hang || '').toLowerCase(); if (!out[h]) continue; if (put(h, it, it.a.slot) || put('shop', it)) placed.add(it.i); }
  // 2) easel = newest unplaced; shop = next ones
  const rest = newest.filter((it) => !placed.has(it.i));
  if (!out.easel[0] && rest.length) { put('easel', rest[0]); placed.add(rest[0].i); }
  for (const it of rest) { if (placed.has(it.i)) continue; if (!put('shop', it)) break; placed.add(it.i); }
  // 3) older leftovers, then prints (real files first) scattered on the other buildings
  const left = newest.filter((it) => !placed.has(it.i)).reverse();
  const reals = newest.filter((it) => artUrl(it.a)); const prints = reals.length ? reals : newest; let pk = 0;
  for (const loc of SCATTER) { const it = left.length ? left.shift() : prints.length ? { ...prints[pk++ % prints.length], print: true } : null; if (it) put(loc, it); }
  return out;
}

// a framed picture facing +z (local), w x h. Registers the canvas mesh as clickable (userData.artIndex)
const frameMats = [0x6b4325, 0xe9d8b4, 0x2b2b33, 0xc89a4a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: c === 0xc89a4a ? 0.5 : 0 }));
export function framed(parent, it, { w = 0.6, h = 0.75, pos = [0, 0, 0], rot = [0, 0, 0], style = 0, clickables }) {
  const g = new THREE.Group(); g.position.set(...pos); g.rotation.set(...rot); parent.add(g);
  const b = 0.06; const fm = new THREE.Mesh(new THREE.BoxGeometry(w + b * 2, h + b * 2, 0.05), frameMats[style % frameMats.length]); fm.castShadow = true; g.add(fm);
  const a = it.a; const mat = new THREE.MeshStandardMaterial({ map: artTex(a.kind, a.title, a.price), roughness: 0.8 });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); pic.position.z = 0.027; g.add(pic); applyArtFile(a, mat, w / h);
  pic.userData.artIndex = it.i; fm.userData.artIndex = it.i; if (clickables) clickables.push(pic, fm);
  return g;
}
