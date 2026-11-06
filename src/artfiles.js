// Mochi's real (AI-made) art lives in ./art/<file>. Entries without `file` keep the procedural look.
import * as THREE from 'three';
export function artUrl(a) {
  const f = a && typeof a.file === 'string' ? a.file.trim() : '';
  if (!f || f.includes('/') || f.includes('\\') || f.includes('..')) return null; // plain filenames only
  return './art/' + encodeURIComponent(f);
}
const loader = new THREE.TextureLoader();
const cache = new Map(); // url -> Promise<Texture> (each image is fetched + uploaded once, frames get cheap clones)
function load(url) {
  if (!cache.has(url)) cache.set(url, new Promise((res, rej) => loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, rej)));
  return cache.get(url);
}
// Swap `material.map` to the image once it loads, centre-cropped to the frame's aspect (w/h). Keeps the fallback on error.
export function applyArtFile(a, material, aspect) {
  const url = artUrl(a); if (!url) return;
  load(url).then((base) => {
    const tex = base.clone(); const ia = base.image.width / base.image.height;
    if (ia > aspect) { tex.repeat.set(aspect / ia, 1); tex.offset.set((1 - aspect / ia) / 2, 0); } else { tex.repeat.set(1, ia / aspect); tex.offset.set(0, (1 - ia / aspect) / 2); }
    tex.needsUpdate = true; const old = material.map; material.map = tex; material.needsUpdate = true; if (old && !old.isCanvasShared) old.dispose();
  }, () => console.info(`[mochi] art file not found, using painted fallback: ${url}`));
}
