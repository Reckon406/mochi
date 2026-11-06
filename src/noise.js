// Small, dependency-free 2D simplex noise + helpers (seeded).
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const grad = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
export function makeNoise(seed = 1) {
  const p = new Uint8Array(512);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  return function noise2(x, y) {
    const s2 = (x + y) * F2; const i = Math.floor(x + s2), j = Math.floor(y + s2);
    const t = (i + j) * G2; const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt;
    tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { const g = grad[p[ii + p[jj]] & 7]; tt *= tt; n += tt * tt * (g[0] * x0 + g[1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { const g = grad[p[ii + i1 + p[jj + j1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x1 + g[1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { const g = grad[p[ii + 1 + p[jj + 1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x2 + g[1] * y2); }
    return 70 * n; // ~[-1,1]
  };
}
export const noise = makeNoise(7);
export const noiseB = makeNoise(42);
export function fbm(x, y, oct = 4, n = noise) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += a * n(x * f, y * f); norm += a; a *= 0.5; f *= 2.03; }
  return sum / norm;
}
export function ridged(x, y, oct = 5, n = noiseB) {
  let a = 0.5, f = 1, sum = 0, norm = 0, prev = 1;
  for (let i = 0; i < oct; i++) { let v = 1 - Math.abs(n(x * f, y * f)); v *= v; sum += v * a * prev; prev = v; norm += a; a *= 0.5; f *= 2.1; }
  return sum / norm;
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
// seeded rng
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
