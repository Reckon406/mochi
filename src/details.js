// Ground clutter + small-scale detail: pebbles, twigs, seasonal leaves, ferns, bushes, mossy rocks, reeds + cattails on the
// shoreline, driftwood, mushrooms, stumps, fence posts, wildflower clusters, worn dirt paths with edge stones, ripples
// around river rocks and sunlit pollen. Everything is instanced; density follows the quality tier × the "Grass & flowers" slider.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { islandRadius, topH, islandSurfH, skirtD, OBSTACLES, POND, ZONES, CLIFF, RIVER_ROCKS, WATER_Y, BRIDGE, BIGTREE, ISLET, isletH, DOCK } from './layout.js';
import { rng } from './noise.js';
import { ENV, } from './water.js';
import { addInstancedSway, rockBump } from './gfx.js';

const TAU = Math.PI * 2;
export function buildDetails(scene, { tier = 2, detail = 1, season = 'fall', snowy = false, mobile = false } = {}) {
  const D = [0.35, 0.6, 1, 1.35][tier] * detail; const R = rng(77); const g = new THREE.Group(); g.name = 'details'; scene.add(g);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const spots = ZONES.map((z) => z.spot || z.pos);
  const clear = (x, z, pad = 0.3, zonePad = 0) => {
    for (const o of OBSTACLES) if (Math.hypot(o.x - x, o.z - z) < o.r + pad) return false;
    if (Math.hypot(POND.x - x, POND.z - z) < POND.r + 0.4) return false;
    if (zonePad) for (const s of spots) if (Math.hypot(s[0] - x, s[1] - z) < zonePad) return false;
    if (Math.hypot(CLIFF.x - x, CLIFF.z - z) < CLIFF.r * 0.9 && topH(x, z) > 1.2) return pad < 0.4; // only tiny bits on the cliff top
    return true; };
  const onLand = (pad = 0.3, zonePad = 0, edge = 0.94) => { for (let k = 0; k < 30; k++) { const th = R() * TAU, r = Math.sqrt(R()) * islandRadius(th) * edge; const x = Math.cos(th) * r, z = Math.sin(th) * r; if (clear(x, z, pad, zonePad)) return [x, topH(x, z), z]; } return null; };
  const inst = (geo, mat, N, place, { shadow = false, color = null } = {}) => { N = Math.max(0, Math.round(N)); if (!N) return null; const im = new THREE.InstancedMesh(geo, mat, N); let n = 0;
    for (let i = 0; i < N * 2 && n < N; i++) { const r = place(n); if (!r) continue; const [p, rot, s, c] = r; e.set(...rot); q.setFromEuler(e); m4.compose(v.set(...p), q, typeof s === 'number' ? sc.setScalar(s) : sc.set(...s)); im.setMatrixAt(n, m4); if (c != null) im.setColorAt(n, col.set(c)); n++; }
    im.count = n; im.castShadow = shadow; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; g.add(im); return im; };
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o });
  const pick = (a) => a[Math.floor(R() * a.length)];

  // pebbles + twigs
  inst(new THREE.IcosahedronGeometry(0.06, 0), M(0xffffff, { flatShading: true }), 520 * D, () => { const p = onLand(0.15); if (!p) return null; const s = 0.5 + R() * 1.4; return [[p[0], p[1] + 0.01, p[2]], [R() * 3, R() * 3, R() * 3], [s, s * 0.6, s * (0.8 + R() * 0.4)], pick([0x9a958c, 0xb4ada0, 0x7f7a72, 0xc9c0ae])]; });
  { const tg = new THREE.CylinderGeometry(0.01, 0.016, 0.4, 4); tg.rotateZ(Math.PI / 2);
    inst(tg, M(0x6b4a33), 180 * D, () => { const p = onLand(0.2); if (!p) return null; return [[p[0], p[1] + 0.015, p[2]], [0, R() * TAU, (R() - 0.5) * 0.1], [0.6 + R() * 0.9, 1, 1]]; }); }
  // fallen leaves (lots in fall, some in summer, few in spring, none under snow)
  if (!snowy) { const lg = new THREE.CircleGeometry(0.06, 5); lg.rotateX(-Math.PI / 2); lg.scale(1, 1, 1.6);
    const n = { fall: 900, summer: 160, spring: 90, winter: 120 }[season] * D; const cols = season === 'fall' ? [0xe58a2f, 0xf0b53a, 0xd4652c, 0xc7a03a, 0xa8432a] : season === 'winter' ? [0x8a6a48, 0x7a5a3a] : [0x6fae48, 0x8a9a40, 0xc7a03a];
    inst(lg, M(0xffffff, { side: THREE.DoubleSide }), n, () => { let p; if (R() < 0.6) { const a = R() * TAU, r = BIGTREE.trunkR + 0.5 + R() * 4; const x = BIGTREE.x + Math.cos(a) * r, z = BIGTREE.z + Math.sin(a) * r; if (!clear(x, z, 0.1)) return null; p = [x, topH(x, z), z]; } else p = onLand(0.1); if (!p) return null;
      return [[p[0], p[1] + 0.02 + R() * 0.01, p[2]], [(R() - 0.5) * 0.3, R() * TAU, (R() - 0.5) * 0.3], 0.7 + R() * 0.6, pick(cols)]; }); }
  // ferns (fronds merged into one geometry) + round bushes, both swaying a little
  if (!snowy || season !== 'winter') { const fr = []; for (let i = 0; i < 7; i++) { const f = new THREE.PlaneGeometry(0.12, 0.6, 1, 3); const p = f.attributes.position; for (let k = 0; k < p.count; k++) { const yy = p.getY(k) + 0.3; p.setX(k, p.getX(k) * (1 - yy / 0.65)); p.setZ(k, -yy * yy * 0.9); p.setY(k, yy); } f.rotateX(-0.5); f.rotateY(i / 7 * TAU); fr.push(f); }
    const fg = mergeGeometries(fr); fg.computeVertexNormals(); const fm = addInstancedSway(M(0xffffff, { side: THREE.DoubleSide }), 0.08, 0.6);
    inst(fg, fm, 90 * D, () => { const p = onLand(0.35, 1.0); if (!p) return null; return [[p[0], p[1], p[2]], [0, R() * TAU, 0], 0.7 + R() * 0.7, season === 'fall' ? pick([0x9a8a3a, 0x6f8a3a, 0xb07a30]) : pick([0x4f8a36, 0x5f9a3e, 0x3f7a30])]; });
    const bg = new THREE.IcosahedronGeometry(0.4, 1); { const p = bg.attributes.position; for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k); v.multiplyScalar(1 + Math.sin(v.x * 9 + v.z * 7) * 0.08); if (v.y < -0.15) v.y = -0.15; p.setXYZ(k, v.x, v.y, v.z); } bg.translate(0, 0.15, 0); bg.computeVertexNormals(); }
    inst(bg, addInstancedSway(M(0xffffff, { flatShading: true }), 0.03, 0.6), 60 * D, () => { const p = onLand(0.6, 1.4); if (!p) return null; const s = 0.6 + R() * 0.9; return [[p[0], p[1], p[2]], [0, R() * TAU, 0], [s, s * (0.7 + R() * 0.3), s], snowy ? 0xdfe6ee : season === 'fall' ? pick([0x8a7a30, 0xa8662a, 0x6f8a3a]) : pick([0x4a7f34, 0x5a8f3c, 0x3f7030])]; }, { shadow: tier >= 2 }); }
  // mossy rocks (rock + moss cap share the same instance matrices)
  { const rg = new THREE.DodecahedronGeometry(0.35, 0); rg.scale(1, 0.65, 0.9); const rm = M(0x8a857c, { flatShading: true, bumpMap: rockBump(), bumpScale: 2 });
    const mg = new THREE.SphereGeometry(0.3, 8, 4, 0, TAU, 0, 1.1); mg.scale(1.05, 0.55, 0.95); mg.translate(0, 0.08, 0);
    const N = Math.round(36 * D); const rocks = inst(rg, rm, N, () => { const p = onLand(0.6, 1.2); if (!p) return null; const s = 0.6 + R() * 1.3; return [[p[0], p[1] + 0.05 * s, p[2]], [0, R() * TAU, (R() - 0.5) * 0.3], s]; }, { shadow: true });
    if (rocks && !snowy) { const moss = new THREE.InstancedMesh(mg, M(season === 'fall' ? 0x7a8a3a : 0x5f8f3a), rocks.count); for (let i = 0; i < rocks.count; i++) { rocks.getMatrixAt(i, m4); moss.setMatrixAt(i, m4); } moss.receiveShadow = true; g.add(moss); } }
  // shoreline: find where the island skirt meets the river and plant reeds + cattails, a little driftwood
  const shore = (th) => { const Rr = islandRadius(th), Dd = skirtD(th); for (let r = Rr - 1; r < Rr + Dd; r += 0.15) { const x = Math.cos(th) * r, z = Math.sin(th) * r; if (islandSurfH(x, z) < WATER_Y + 0.12) return [x, z, r]; } return null; };
  const nearDock = (x, z) => Math.hypot(x - (DOCK.x0 + DOCK.dx * DOCK.len / 2), z - (DOCK.z0 + DOCK.dz * DOCK.len / 2)) < DOCK.len / 2 + 1.2;
  const nearBridge = (x, z) => { for (let t = 0; t <= 1; t += 0.1) if (Math.hypot(x - (BRIDGE.ax + (BRIDGE.bx - BRIDGE.ax) * t), z - (BRIDGE.az + (BRIDGE.bz - BRIDGE.az) * t)) < 1.6) return true; return false; };
  if (season !== 'winter' || !snowy) { const reed = new THREE.ConeGeometry(0.02, 1, 3); reed.translate(0, 0.5, 0); const rm = addInstancedSway(M(0xffffff), 0.18, 1.1);
    const reedSpot = () => { for (let k = 0; k < 10; k++) { const th = R() * TAU; const s = shore(th); if (!s) continue; const off = (R() - 0.65) * 1.2; const x = s[0] + Math.cos(th) * off, z = s[1] + Math.sin(th) * off; if (nearDock(x, z) || nearBridge(x, z)) continue; if (Math.hypot(x - CLIFF.x, z - CLIFF.z) < CLIFF.r + 3) continue; return [x, z]; } return null; };
    // clumps along the shore and around the pond
    const clumps = []; for (let i = 0; i < 46 * D; i++) { const c = reedSpot(); if (c) clumps.push(c); }
    for (let i = 0; i < 14 * D; i++) { const a = R() * TAU; clumps.push([POND.x + Math.cos(a) * (POND.r + 0.05), POND.z + Math.sin(a) * (POND.r + 0.05), 'pond']); }
    const reedCol = season === 'fall' ? [0xb9a05a, 0xa08848, 0x8a8a40] : [0x6f9a3e, 0x5a8a36, 0x88aa4a];
    let ci = 0; const each = (fn) => () => { const c = clumps[ci++ % clumps.length]; if (!c) return null; const x = c[0] + (R() - 0.5) * 0.9, z = c[1] + (R() - 0.5) * 0.9; const y = c[2] === 'pond' ? -0.4 : Math.max(WATER_Y - 0.05, islandSurfH(x, z)); return fn(x, y, z); };
    if (clumps.length) { inst(reed, rm, clumps.length * 9, each((x, y, z) => [[x, y, z], [(R() - 0.5) * 0.25, R() * TAU, (R() - 0.5) * 0.25], [1, 0.6 + R() * 0.9, 1], pick(reedCol)]));
      const cat = mergeGeometries([new THREE.CylinderGeometry(0.008, 0.01, 1.2, 3).translate(0, 0.6, 0), new THREE.CapsuleGeometry(0.035, 0.16, 2, 6).translate(0, 1.15, 0)].map((x) => x.toNonIndexed()));
      { const n = cat.attributes.position.count, c = new Float32Array(n * 3); for (let k = 0; k < n; k++) { const top = cat.attributes.position.getY(k) > 1.04; const cc = top ? [0.36, 0.22, 0.12] : [0.42, 0.55, 0.25]; c.set(cc, k * 3); } cat.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
      inst(cat, addInstancedSway(M(0xffffff, { vertexColors: true }), 0.12, 1.2), clumps.length * 2.5, each((x, y, z) => [[x, y, z], [(R() - 0.5) * 0.2, R() * TAU, (R() - 0.5) * 0.2], [1, 0.7 + R() * 0.5, 1]])); } }
  { const dw = new THREE.CylinderGeometry(0.06, 0.09, 1, 6); dw.rotateZ(Math.PI / 2); const dm = M(0xb8aa98, { bumpMap: rockBump(), bumpScale: 1 });
    inst(dw, dm, 9 + 6 * D, () => { const th = R() * TAU; const s = shore(th); if (!s || nearDock(s[0], s[1]) || nearBridge(s[0], s[1])) return null; const r = s[2] - 0.5; const x = Math.cos(th) * r, z = Math.sin(th) * r; return [[x, islandSurfH(x, z) + 0.04, z], [0, R() * TAU, (R() - 0.5) * 0.2], [1 + R() * 1.2, 1, 1]]; }, { shadow: true }); }
  // mushrooms (stem + cap), little stumps, wildflower clusters
  { const stem = new THREE.CylinderGeometry(0.018, 0.024, 0.08, 6).translate(0, 0.04, 0); const cap = new THREE.SphereGeometry(0.05, 8, 4, 0, TAU, 0, 1.4).translate(0, 0.07, 0);
    const N = Math.round(70 * D); const placed = []; for (let i = 0; i < N; i++) { let p; if (i % 3 === 0) { const a = R() * TAU, r = BIGTREE.trunkR + 0.3 + R() * 1.4; const x = BIGTREE.x + Math.cos(a) * r, z = BIGTREE.z + Math.sin(a) * r; p = clear(x, z, 0.05) ? [x, topH(x, z), z] : null; } else { const c = placed.length && R() < 0.6 ? placed[placed.length - 1] : onLand(0.3); p = c && [c[0] + (R() - 0.5) * 0.3, c[1], c[2] + (R() - 0.5) * 0.3]; } if (p) placed.push(p); }
    const sh = []; const ss = placed.map(() => 0.7 + R() * 0.9); const caps = placed.map(() => pick([0xd8452e, 0xd8452e, 0xc9a06a, 0xf0e2c0]));
    let k = 0; inst(stem, M(0xf2ead8), placed.length, (i) => [placed[i], [0, 0, (R() - 0.5) * 0.3], ss[i]]); inst(cap, M(0xffffff, { roughness: 0.6 }), placed.length, (i) => [placed[i], [0, 0, 0], ss[i], caps[i]]); void sh; void k; }
  { const sg = new THREE.CylinderGeometry(0.22, 0.27, 0.32, 9).translate(0, 0.16, 0); const top = new THREE.CircleGeometry(0.22, 9); top.rotateX(-Math.PI / 2); top.translate(0, 0.321, 0);
    const ring = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#d9b98a'; x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(120,80,40,0.5)'; for (let r = 6; r < 64; r += 7) { x.lineWidth = 2; x.beginPath(); x.arc(64, 64, r, 0, TAU); x.stroke(); } return c; })()); ring.colorSpace = THREE.SRGBColorSpace;
    const pts = []; for (let i = 0; i < 4 + 4 * D; i++) { const p = onLand(0.8, 1.5); if (p) pts.push([p[0], p[1] - 0.03, p[2], 0.8 + R() * 0.7]); }
    inst(sg, M(0x6b4a33, { bumpMap: rockBump(), bumpScale: 1 }), pts.length, (i) => [pts[i].slice(0, 3), [0, R() * TAU, 0], pts[i][3]], { shadow: true }); inst(top, M(0xffffff, { map: ring }), pts.length, (i) => [pts[i].slice(0, 3), [0, R() * TAU, 0], pts[i][3]]); }
  if (!snowy) { const fl = new THREE.IcosahedronGeometry(0.035, 0); const st = new THREE.CylinderGeometry(0.005, 0.005, 0.22, 3).translate(0, 0.11, 0);
    const cols = season === 'fall' ? [0xf0b53a, 0xd4652c, 0xb07ad8, 0xffffff] : [0xff8ab0, 0xffd36b, 0xb07ad8, 0xffffff, 0x6fb0ff, 0xff6b6b];
    const fls = []; for (let c = 0; c < 34 * D; c++) { const p = onLand(0.4, 0.8); if (!p) continue; const cc = pick(cols); for (let i = 0; i < 9; i++) { const x = p[0] + (R() - 0.5) * 1.1, z = p[2] + (R() - 0.5) * 1.1; fls.push([x, topH(x, z), z, R() < 0.75 ? cc : pick(cols), 0.7 + R() * 0.6]); } }
    inst(st, addInstancedSway(M(0x5a8f3c), 0.1, 0.25), fls.length, (i) => [fls[i].slice(0, 3), [0, 0, 0], [1, fls[i][4], 1]]);
    inst(fl, addInstancedSway(M(0xffffff, { emissive: 0x222222, flatShading: true }), 0.1, 0.25), fls.length, (i) => [[fls[i][0], fls[i][1] + 0.22 * fls[i][4], fls[i][2]], [R(), R(), R()], [1.2, 0.6, 1.2], fls[i][3]]); }
  // fence posts (+ two rails) around the pumpkin patch and along the garden
  { const segs = []; for (const id of ['pumpkins', 'garden']) { const z = ZONES.find((q) => q.id === id); if (!z) continue; const [cx, cz] = z.pos; const rr = id === 'pumpkins' ? 2.6 : 2.9; const a0 = Math.atan2(-cz, -cx) + 0.9;
      for (let i = 0; i <= 8; i++) { const a = a0 + i * 0.5; const x = cx + Math.cos(a) * rr, zz = cz + Math.sin(a) * rr; if (!clear(x, zz, 0.15)) { segs.push(null); continue; } segs.push([x, topH(x, zz), zz]); } segs.push(null); }
    const posts = segs.filter(Boolean); inst(new THREE.BoxGeometry(0.09, 0.62, 0.09).translate(0, 0.28, 0), M(0x8a6a4a, { bumpMap: rockBump(), bumpScale: 0.6 }), posts.length, (i) => [posts[i], [0, R(), (R() - 0.5) * 0.12], 1], { shadow: true });
    const rails = []; for (let i = 0; i + 1 < segs.length; i++) if (segs[i] && segs[i + 1]) for (const hh of [0.22, 0.46]) { const a = segs[i], b = segs[i + 1]; const L = Math.hypot(b[0] - a[0], b[2] - a[2]); rails.push([[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + hh, (a[2] + b[2]) / 2], [0, -Math.atan2(b[2] - a[2], b[0] - a[0]), Math.atan2(b[1] - a[1], L)], [L, 1, 1]]); }
    inst(new THREE.BoxGeometry(1, 0.05, 0.04), M(0xa07a52), rails.length, (i) => rails[i]); }
  // worn dirt paths from the hut to the main spots, edged with little stones
  { const hut = ZONES.find((z) => z.id === 'hut'); const from = hut.spot || hut.pos; const dests = ['tree', 'pond', 'market', 'campfire', 'dock', 'shop', 'garden', 'music', 'meadow'].map((id) => ZONES.find((z) => z.id === id)).filter(Boolean).map((z) => z.spot || z.pos);
    dests.push([BRIDGE.ax, BRIDGE.az]); const pathT = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(150,115,75,0)'); gr.addColorStop(0.28, 'rgba(150,115,75,0.75)'); gr.addColorStop(0.5, 'rgba(165,128,85,0.9)'); gr.addColorStop(0.72, 'rgba(150,115,75,0.75)'); gr.addColorStop(1, 'rgba(150,115,75,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 256); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '90,65,40' : '200,170,120'},${0.2 + R() * 0.3})`; x.fillRect(8 + R() * 48, R() * 256, 2, 2); } return c; })());
    pathT.wrapT = THREE.RepeatWrapping; pathT.colorSpace = THREE.SRGBColorSpace; const pm = new THREE.MeshStandardMaterial({ map: pathT, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const edge = []; const W = 0.95;
    for (const d of dests) { const L = Math.hypot(d[0] - from[0], d[1] - from[1]); const n = Math.ceil(L / 0.4); const ux = (d[0] - from[0]) / L, uz = (d[1] - from[1]) / L; const px = -uz, pz = ux; let pos = [], uv = [], idx = [];
      const flush = () => { if (pos.length >= 12) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, pm); m.receiveShadow = true; m.renderOrder = 1; g.add(m); } pos = []; uv = []; idx = []; };
      for (let i = 1; i < n - 1; i++) { const t = i / n; const wob = Math.sin(t * 9 + d[0]) * 0.35; const cx = from[0] + ux * L * t + px * wob, cz = from[1] + uz * L * t + pz * wob; if (!clear(cx, cz, 0.05) || topH(cx, cz) > 1.3) { flush(); continue; }
        const vi = pos.length / 3; for (const s of [-1, 1]) { const x = cx + px * W / 2 * s, z = cz + pz * W / 2 * s; pos.push(x, topH(x, z) + 0.035, z); uv.push(s < 0 ? 0 : 1, t * L / 2.5); }
        if (vi >= 2) idx.push(vi - 2, vi - 1, vi, vi - 1, vi + 1, vi);
        if (R() < 0.55 * Math.min(1, D + 0.2)) { const s = R() < 0.5 ? -1 : 1; const x = cx + px * (W / 2 + 0.05) * s, z = cz + pz * (W / 2 + 0.05) * s; edge.push([x, topH(x, z) + 0.02, z]); } }
      flush(); }
    inst(new THREE.DodecahedronGeometry(0.08, 0), M(0xa8a196, { flatShading: true }), edge.length, (i) => [edge[i], [R() * 3, R() * 3, 0], [1 + R() * 0.6, 0.6, 1 + R() * 0.4], pick([0xa8a196, 0x938c80, 0xbdb5a6])]); }
  // ripple rings where the river runs past rocks (stretched downstream), animated in the shader
  const rippleU = { uTime: ENV.uTime }; { const rocks = RIVER_ROCKS.slice(); const N = rocks.length * 3; const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2); const ph = new Float32Array(N);
    const rm = new THREE.ShaderMaterial({ uniforms: rippleU, transparent: true, depthWrite: false, fog: false,
      vertexShader: `attribute float phase; uniform float uTime; varying vec2 vUv; varying float vA; void main(){ float f = fract(uTime*0.28 + phase); vA = (1.0-f)*smoothstep(0.0,0.15,f); vec3 p = position*(0.55+f*0.9); p.z += f*0.9; vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.0); }`,
      fragmentShader: `varying vec2 vUv; varying float vA; void main(){ float d = length((vUv-0.5)*vec2(1.0,0.75))*2.0; float band = smoothstep(0.12,0.0,abs(d-0.8)); gl_FragColor = vec4(vec3(0.92,0.97,1.0), band*vA*0.42); }` });
    const im = new THREE.InstancedMesh(geo, rm, N); rocks.forEach(([x, z, r], i) => { for (let k = 0; k < 3; k++) { m4.compose(v.set(x, WATER_Y + 0.025, z), q.identity(), sc.set(r * 2.6, 1, r * 3.4)); im.setMatrixAt(i * 3 + k, m4); ph[i * 3 + k] = k / 3 + R() * 0.1; } });
    geo.setAttribute('phase', new THREE.InstancedBufferAttribute(ph, 1)); im.frustumCulled = false; im.renderOrder = 2; g.add(im); }
  // pollen / dust motes drifting in the sunlight (stronger at golden hour, gone at night)
  let motes = null; if (tier >= 1) { const N = Math.round((mobile ? 160 : 380) * D); const p = new Float32Array(N * 3), s = new Float32Array(N); for (let i = 0; i < N; i++) { const a = R() * TAU, r = Math.sqrt(R()) * 26; p.set([Math.cos(a) * r, 0.3 + R() * 4.5, Math.sin(a) * r], i * 3); s[i] = R(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(s, 1));
    const mu = { uTime: ENV.uTime, uAmt: { value: 0.5 }, uCol: { value: new THREE.Color(0xfff0c0) }, uPR: { value: Math.min(2, window.devicePixelRatio || 1) } };
    const mm = new THREE.ShaderMaterial({ uniforms: mu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float seed; uniform float uTime, uPR; varying float vA; void main(){ vec3 p = position; float t = uTime*0.25 + seed*40.0; p += vec3(sin(t*0.9+seed*7.0)*0.8, sin(t*0.6+seed*3.0)*0.4, cos(t*0.7+seed*5.0)*0.8); vec4 mv = modelViewMatrix*vec4(p,1.0); vA = 0.5+0.5*sin(uTime*1.3+seed*20.0); gl_PointSize = uPR*(2.2+seed*2.0)*(14.0/max(1.0,-mv.z)); gl_PointSize = clamp(gl_PointSize, 0.0, 6.0*uPR); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uAmt; uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(uCol, a*vA*uAmt); }` });
    motes = new THREE.Points(geo, mm); motes.frustumCulled = false; g.add(motes); motes.userData.u = mu; }
  return { group: g, update(sky) { if (motes) { const st = sky.state; motes.userData.u.uAmt.value = (1 - st.night) * (0.22 + st.golden * 0.6) * (snowy ? 0.3 : 1); } } };
}
