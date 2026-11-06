// Mochi's real (AI-made) art lives in ./art/<file>. Entries without `file` keep the procedural look.
import * as THREE from 'three';
export function artUrl(a) {
  const f = a && typeof a.file === 'string' ? a.file.trim() : '';
  if (!f || f.includes('/') || f.includes('\\') || f.includes('..')) return null; // plain filenames only
  return './art/' + encodeURIComponent(f);
}
const loader = new THREE.TextureLoader();
// Swap `material.map` to the image once it loads, centre-cropped to the frame's aspect (w/h). Keeps the fallback on error.
export function applyArtFile(a, material, aspect) {
  const url = artUrl(a); if (!url) return;
  loader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const ia = tex.image.width / tex.image.height;
    if (ia > aspect) { tex.repeat.set(aspect / ia, 1); tex.offset.set((1 - aspect / ia) / 2, 0); } else { tex.repeat.set(1, ia / aspect); tex.offset.set(0, (1 - ia / aspect) / 2); }
    const old = material.map; material.map = tex; material.needsUpdate = true; if (old) old.dispose();
  }, undefined, () => console.info(`[mochi] art file not found, using painted fallback: ${url}`));
}
