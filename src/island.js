// The floating island: ground, underside, islet, bridge, grass + every zone's props
import * as THREE from 'three';
import { noise, fbm, smoothstep, rng, clamp } from './noise.js';
import { ISLAND_R, islandRadius, topH, isletH, CLIFF, POND, POND_Y, ISLET, LAGOON_Y, WATER_Y, ISLET_D, skirtD as islandSkirtD, skirtY as islandSkirtY, RIVER_ROCKS, BRIDGE, bridgeYt, bridgePoint, ZONES, groundY } from './layout.js';
import { makeWaterMaterial, ENV } from './water.js';
import { woodTex, thatchTex, signTex, artTex, stripes, canvasTex } from './textures.js';
import { TRAPPER_DIR } from './landscape.js';
import { applyArtFile } from './artfiles.js';

const MAT = {};
function mat(color, o = {}) { const k = color + JSON.stringify(o); return MAT[k] || (MAT[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o })); }
function add(parent, geo, material, p = [0, 0, 0], r = [0, 0, 0], s = null, shadow = true) {
  const m = new THREE.Mesh(geo, material); m.position.set(...p); m.rotation.set(...r); if (s) (typeof s === 'number' ? m.scale.setScalar(s) : m.scale.set(...s));
  m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
const at = (x, z, dy = 0) => [x, topH(x, z) + dy, z];

// Generic floating-landmass mesh (top surface + rocky underside), vertex coloured
function landmass({ cx = 0, cz = 0, R, H, skirtD, skirtY, rings = 40, under = 22, seg = 140, topColor, sideColor }) {
  const rowsTop = rings + 1, rows = rowsTop + under, cols = seg + 1;
  const pos = new Float32Array(rows * cols * 3), col = new Float32Array(rows * cols * 3);
  const c = new THREE.Color();
  for (let j = 0; j < cols; j++) {
    const th = (j / seg) * Math.PI * 2; const Rt = R(th); const cs = Math.cos(th), sn = Math.sin(th);
    for (let i = 0; i < rowsTop; i++) {
      const f = Math.pow(i / rings, 0.85); const x = cx + cs * Rt * f, z = cz + sn * Rt * f; const y = H(x, z);
      const k = (i * cols + j) * 3; pos[k] = x; pos[k + 1] = y; pos[k + 2] = z; topColor(x, y, z, f, c); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
    }
    const rimY = H(cx + cs * Rt, cz + sn * Rt); const D = skirtD(th);
    for (let u = 1; u <= under; u++) {
      const t = u / under; const rr = Rt + D * t + 0.25 * noise(th * 6, t * 3) * t;
      const x = cx + cs * rr, z = cz + sn * rr; const y = skirtY(rimY, t, th);
      const k = ((rowsTop + u - 1) * cols + j) * 3; pos[k] = x; pos[k + 1] = y; pos[k + 2] = z; sideColor(x, y, z, t, th, c); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
    }
  }
  const idx = [];
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < seg; j++) { const a = i * cols + j, b = a + 1, d = a + cols, e = d + 1; idx.push(a, b, d, b, e, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildIsland(scene, { snowy = false, mobile = false, state }) {
  const world = new THREE.Group(); scene.add(world);
  const anim = []; // per-frame updaters (t, dt)
  const glow = []; // emissive materials that brighten at night
  const lights = []; // point lights for night
  const R0 = rng(21);
  const snowC = new THREE.Color(0xf3f6ff);

  // ── main island ──
  const grassA = new THREE.Color(0x7dab4a), grassB = new THREE.Color(0xa8b84c), grassC = new THREE.Color(0x5f9440), rock = new THREE.Color(0x9a8774);
  const sandC = new THREE.Color(0xdcc89a), gravelC = new THREE.Color(0xa89a86), cobbleC = new THREE.Color(0x8c8478), wetC = new THREE.Color(0x7a6e58), bedC = new THREE.Color(0x5f5c46);
  const shoreColor = (x, y, z, c) => { // sand above the waterline, cobbles at it, wet gravel/bed below
    const n = noise(x * 0.9, z * 0.9), n2 = noise(x * 3.1 + 4, z * 3.1);
    if (y > WATER_Y + 0.18) c.copy(sandC).lerp(gravelC, clamp(0.5 + n, 0, 1) * 0.7).lerp(cobbleC, smoothstep(0.35, 0.7, n2) * 0.6);
    else if (y > WATER_Y - 0.25) c.copy(gravelC).lerp(wetC, 0.6).lerp(cobbleC, smoothstep(0.2, 0.6, n2) * 0.5);
    else c.copy(wetC).lerp(bedC, smoothstep(WATER_Y - 0.25, WATER_Y - 1.2, y));
    if (snowy && y > WATER_Y + 0.05) c.lerp(snowC, 0.7);
  };
  const g = landmass({
    R: islandRadius, H: topH, skirtD: islandSkirtD, skirtY: islandSkirtY, rings: 48, under: 22, seg: 180,
    topColor: (x, y, z, f, c) => {
      const n = fbm(x * 0.15, z * 0.15, 3);
      c.copy(grassA).lerp(grassB, clamp(0.5 + n, 0, 1)).lerp(grassC, clamp(noise(x * 0.4, z * 0.4) * 0.5, 0, 1));
      const sl = Math.hypot(topH(x + 0.2, z) - topH(x - 0.2, z), topH(x, z + 0.2) - topH(x, z - 0.2)) / 0.4;
      { const rk = rock.clone().lerp(new THREE.Color(0xc2ae94), 0.5 + 0.5 * Math.sin(y * 7 + noise(x, z) * 2)); c.lerp(rk, smoothstep(1.0, 1.6, sl)); }
      const dp = Math.hypot(x - POND.x, z - POND.z); if (dp < POND.r + 0.3) c.lerp(new THREE.Color(0xc9b27a), smoothstep(POND.r + 0.3, POND.r - 0.2, dp));
      const path = smoothstep(0.08, 0.0, Math.abs(noise(x * 0.12 + 9, z * 0.12) * 0.6)) * 0.45; c.lerp(new THREE.Color(0xb59766), path * (1 - smoothstep(0.6, 1.2, sl)));
      if (snowy) c.lerp(snowC, 0.85 * (1 - smoothstep(0.9, 1.6, sl) * 0.5));
      if (y < -0.25) { const sc = new THREE.Color(); shoreColor(x, y, z, sc); c.lerp(sc, smoothstep(-0.25, -0.5, y)); }
    },
    sideColor: (x, y, z, t, th, c) => {
      shoreColor(x, y, z, c);
      if (y > 0.2) { c.copy(rock).lerp(new THREE.Color(0xb09c84), 0.5 + 0.5 * Math.sin(y * 6 + noise(th * 5, 0) * 2)); if (snowy) c.lerp(snowC, 0.4); } // the bluff under the lookout
    },
  });
  const ground = add(world, g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), [0, 0, 0], [0, 0, 0], null, true);
  ground.name = 'ground';

  // ── beach islet ──
  const sand = new THREE.Color(0xf1dca6), wetSand = new THREE.Color(0xcdb07a);
  const ig = landmass({ cx: ISLET.x, cz: ISLET.z, R: (th) => ISLET.r, H: isletH, skirtD: () => ISLET_D, skirtY: (rimY, t) => rimY + (-2.8 - rimY) * Math.pow(t, 1.4), rings: 24, under: 10, seg: 96,
    topColor: (x, y, z, f, c) => { shoreColor(x, y, z, c); if (y > WATER_Y + 0.3 && !snowy) c.lerp(sandC, 0.6); },
    sideColor: (x, y, z, t, th, c) => shoreColor(x, y, z, c),
  });
  add(world, ig, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  // beach umbrella, towel, sandcastle and an aspirational sign
  { const bx = ISLET.x - 2.2, bz = ISLET.z - 1.6; const by = isletH(bx, bz);
    add(world, new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), mat(0xeeeeee), [bx, by + 1.0, bz], [0.12, 0, 0.1]);
    const um = new THREE.ConeGeometry(1.3, 0.5, 12, 1, true); const ut = stripes(['#ff6b6b', '#fff6e0', '#4fb3e8', '#fff6e0'], 12, true, 256, 16);
    add(world, um, new THREE.MeshStandardMaterial({ map: ut, side: THREE.DoubleSide, roughness: 0.8 }), [bx + 0.13, by + 2.15, bz + 0.12], [0.12, 0, 0.1]);
    add(world, new THREE.BoxGeometry(1.0, 0.02, 1.6), new THREE.MeshStandardMaterial({ map: stripes(['#ffd34d', '#ff8a5c'], 8, false, 32, 128), roughness: 0.9 }), [bx + 1.0, isletH(bx + 1, bz + 0.3) + 0.02, bz + 0.3], [0, 0.3, 0]);
    const sx = ISLET.x - 0.4, sz = ISLET.z + 2.3, sy = isletH(sx, sz);
    add(world, new THREE.CylinderGeometry(0.3, 0.38, 0.35, 8), mat(0xe3c48a), [sx, sy + 0.17, sz]); add(world, new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8), mat(0xe3c48a), [sx, sy + 0.5, sz]);
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28; add(world, new THREE.BoxGeometry(0.1, 0.14, 0.1), mat(0xe3c48a), [sx + Math.cos(a) * 0.3, sy + 0.42, sz + Math.sin(a) * 0.3]); }
    sign(world, ['OCEAN', '(practice)'], [ISLET.x - 3.4, isletH(ISLET.x - 3.4, ISLET.z + 1.2), ISLET.z + 1.2], -Math.PI / 2 + 0.5, 0.9);
    // shells
    for (let i = 0; i < 7; i++) { const x = ISLET.x - 2 + R0() * 3, z = ISLET.z - 2 + R0() * 4; add(world, new THREE.SphereGeometry(0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat([0xffc0cb, 0xfff1d6, 0xffd8a8][i % 3]), [x, isletH(x, z) + 0.01, z], [0, R0() * 6, 0], [1, 0.5, 1.3], false); }
  }

  // ── rope bridge ──
  { const n = 22; const plank = new THREE.BoxGeometry(1.15, 0.06, 0.3); const pm = new THREE.MeshStandardMaterial({ map: woodTex('#a77a4c', 3, true), roughness: 0.9 });
    const yaw = Math.atan2(BRIDGE.dx, BRIDGE.dz); const px = -BRIDGE.dz, pz = BRIDGE.dx; // lateral unit vector
    const br = new THREE.Group(); world.add(br);
    for (let i = 0; i <= n; i++) { const t = i / n; const [x, z] = bridgePoint(t); add(br, plank, pm, [x, bridgeYt(t) - 0.03, z], [0, yaw, (R0() - 0.5) * 0.06]); }
    const ropeM = mat(0xc9a66b, { roughness: 1 });
    for (const side of [-0.6, 0.6]) {
      for (const hh of [0.0, 0.72]) {
        const pts = []; for (let i = 0; i <= 30; i++) { const t = -0.03 + (i / 30) * 1.06; const tt = clamp(t, 0, 1); const [x, z] = bridgePoint(t); pts.push(new THREE.Vector3(x + px * side, bridgeYt(tt) + hh + (hh > 0 ? 0.25 * Math.sin(Math.PI * tt) : 0), z + pz * side)); }
        add(br, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.035, 6), ropeM);
      }
      for (const t of [-0.03, 1.03]) { const [x, z] = bridgePoint(t); const y = t < 0.5 ? topH(x, z) : isletH(x, z); add(br, new THREE.CylinderGeometry(0.08, 0.1, 1.4, 8), mat(0x7a5232), [x + px * side, y + 0.5, z + pz * side]); }
      for (let i = 1; i < n; i += 2) { const t = i / n; const [x, z] = bridgePoint(t); add(br, new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), ropeM, [x + px * side, bridgeYt(t) + 0.35 + 0.12 * Math.sin(Math.PI * t), z + pz * side], [0, 0, 0], null, false); }
    }
  }

  // ── pond ──
  const pondMat = makeWaterMaterial({ deep: 0x1f5f7a, shallow: 0x58b6c4, amp: 0.008, freq: 3, opacity: 0.9, sparkle: 1.0, scale: 1.4 });
  const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 0.15, 48).rotateX(-Math.PI / 2), pondMat); pond.position.set(POND.x, POND_Y, POND.z); pond.renderOrder = 2; world.add(pond);
  if (snowy) { pondMat.uniforms.uDeep.value.set(0x9cc6d8); pondMat.uniforms.uShallow.value.set(0xd8eef5); }
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + R0() * 0.3; const rr = POND.r + 0.25 + R0() * 0.3; const x = POND.x + Math.cos(a) * rr, z = POND.z + Math.sin(a) * rr;
    add(world, new THREE.DodecahedronGeometry(0.22 + R0() * 0.22, 1), mat(snowy ? 0xdfe4ea : 0x9a948e), [x, topH(x, z) + 0.05, z], [R0(), R0(), R0()], [1, 0.6, 1]); }
  for (let i = 0; i < 5; i++) { const a = R0() * 6.28, rr = R0() * (POND.r - 0.6); const lp = add(world, new THREE.CircleGeometry(0.28, 16, 0.3, Math.PI * 1.85).rotateX(-Math.PI / 2), mat(0x4f9a3a, { side: THREE.DoubleSide }), [POND.x + Math.cos(a) * rr, POND_Y + 0.02, POND.z + Math.sin(a) * rr], [0, R0() * 6, 0], null, false);
    if (i < 2) add(world, new THREE.SphereGeometry(0.08, 10, 8), mat(0xffb3c8, { emissive: 0xff7aa0, emissiveIntensity: 0.15 }), [lp.position.x, POND_Y + 0.08, lp.position.z], [0, 0, 0], [1, 0.6, 1]); }
  // cattails
  for (let i = 0; i < 9; i++) { const a = 3.6 + R0() * 1.2, rr = POND.r - 0.1; const x = POND.x + Math.cos(a) * rr, z = POND.z + Math.sin(a) * rr; const h = 0.9 + R0() * 0.5;
    const ct = new THREE.Group(); ct.position.set(x, POND_Y, z); world.add(ct); add(ct, new THREE.CylinderGeometry(0.015, 0.02, h, 4), mat(0x6c8a3a), [0, h / 2, 0], [0, 0, 0], null, false); add(ct, new THREE.CapsuleGeometry(0.045, 0.18, 4, 8), mat(0x6b3f22), [0, h, 0]);
    const ph = R0() * 6; anim.push((t) => { ct.rotation.z = Math.sin(t * 1.5 + ph) * 0.06 * (0.5 + ENV.uWind.value * 2); }); }

  // ── hut with nest + ladder ──
  { const [hx, hy, hz] = at(-4.2, -8.0); const hut = new THREE.Group(); hut.position.set(hx, hy - 0.05, hz); hut.rotation.y = 0.5; world.add(hut);
    const wt = woodTex('#a8784a', 14, true); wt.repeat.set(2, 1);
    add(hut, new THREE.CylinderGeometry(1.5, 1.6, 1.8, 28), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.9 }), [0, 0.9, 0]);
    const roofT = thatchTex(); const roofM = new THREE.MeshStandardMaterial({ map: roofT, roughness: 1, color: snowy ? 0xffffff : 0xffffff });
    add(hut, new THREE.ConeGeometry(2.25, 1.7, 28, 3), roofM, [0, 2.55, 0]);
    if (snowy) add(hut, new THREE.ConeGeometry(2.0, 1.1, 28, 1, true), mat(0xf6f8ff), [0, 2.85, 0]);
    add(hut, new THREE.TorusGeometry(2.05, 0.1, 6, 36), mat(0xb0874a), [0, 1.72, 0], [Math.PI / 2, 0, 0]);
    // door
    const doorS = new THREE.Shape(); doorS.moveTo(-0.38, 0); doorS.lineTo(-0.38, 0.75); doorS.absarc(0, 0.75, 0.38, Math.PI, 0, true); doorS.lineTo(0.38, 0); doorS.closePath();
    add(hut, new THREE.ExtrudeGeometry(doorS, { depth: 0.08, bevelEnabled: false }), mat(0x6e4325), [0, 0.02, 1.53], [0, 0, 0]);
    add(hut, new THREE.SphereGeometry(0.05, 8, 6), mat(0xf0c060, { metalness: 0.6, roughness: 0.3 }), [0.24, 0.6, 1.63]);
    // round window that glows at night
    const winM = new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffb04a, emissiveIntensity: 0.0 }); glow.push({ m: winM, day: 0.15, night: 3.2 });
    for (const a of [-0.9, 0.95]) { add(hut, new THREE.CircleGeometry(0.28, 20), winM, [Math.sin(a) * 1.565, 1.15, Math.cos(a) * 1.565], [0, a, 0]); add(hut, new THREE.TorusGeometry(0.29, 0.05, 6, 20), mat(0x6e4325), [Math.sin(a) * 1.57, 1.15, Math.cos(a) * 1.57], [0, a, 0]); }
    const hl = new THREE.PointLight(0xffa850, 0, 7, 1.6); hl.position.set(0, 1.2, 2.0); hut.add(hl); lights.push({ l: hl, night: 6 });
    // nest on the roof
    const nest = new THREE.Group(); nest.position.set(0, 3.32, 0); hut.add(nest);
    const twig = new THREE.MeshStandardMaterial({ map: thatchTex(), color: 0x9a6a3a, roughness: 1 });
    add(nest, new THREE.TorusGeometry(0.55, 0.22, 10, 24), twig, [0, 0.0, 0], [Math.PI / 2, 0, 0]);
    add(nest, new THREE.CylinderGeometry(0.5, 0.4, 0.2, 16), mat(0x6b4524), [0, -0.05, 0]);
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; add(nest, new THREE.CylinderGeometry(0.015, 0.015, 0.5, 3), mat(0x7a5230), [Math.cos(a) * 0.6, 0.12, Math.sin(a) * 0.6], [R0() - 0.5, a, 1.2 + R0() * 0.4], null, false); }
    if (snowy) add(nest, new THREE.TorusGeometry(0.55, 0.12, 6, 24), mat(0xf6f8ff), [0, 0.15, 0], [Math.PI / 2, 0, 0]);
    // little stone chimney with smoke
    add(hut, new THREE.CylinderGeometry(0.18, 0.22, 0.9, 8), mat(0x8c8580), [-0.95, 2.6, -0.45]);
    const smokeM = new THREE.MeshStandardMaterial({ color: 0xdedede, transparent: true, opacity: 0.5, roughness: 1, depthWrite: false });
    const puffs = []; for (let i = 0; i < 6; i++) { const p = add(hut, new THREE.SphereGeometry(0.16, 10, 8), smokeM.clone(), [-0.95, 3.1, -0.45], [0, 0, 0], null, false); puffs.push(p); }
    anim.push((t) => { puffs.forEach((p, i) => { const u = ((t * 0.25 + i / 6) % 1); p.position.set(-0.95 + u * 0.8 * (0.5 + ENV.uWind.value * 2), 3.1 + u * 2.2, -0.45 + Math.sin(u * 6 + i) * 0.15); p.scale.setScalar(0.6 + u * 2.2); p.material.opacity = 0.45 * (1 - u); }); });
    // ladder from ground to roof edge
    const lad = new THREE.Group(); lad.position.set(1.35, 0, -1.05); lad.rotation.y = -0.65; hut.add(lad);
    const lm = mat(0x8a5a32); const L = 3.3, tilt = -0.42;
    for (const s of [-0.28, 0.28]) add(lad, new THREE.CylinderGeometry(0.05, 0.05, L, 6), lm, [s, L / 2 * Math.cos(tilt), -L / 2 * Math.sin(tilt)], [tilt, 0, 0]);
    for (let i = 1; i < 9; i++) { const u = i / 9 * L; add(lad, new THREE.CylinderGeometry(0.035, 0.035, 0.6, 5), lm, [0, u * Math.cos(tilt), -u * Math.sin(tilt)], [0, 0, Math.PI / 2]); }
    // welcome mat + mailbox
    add(hut, new THREE.BoxGeometry(0.9, 0.02, 0.5), mat(0xc0563a), [0, 0.02, 1.95]);
    add(hut, new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), mat(0x6e4325), [1.0, 0.45, 2.1]); add(hut, new THREE.BoxGeometry(0.3, 0.22, 0.4), mat(0x4aa3d8), [1.0, 0.95, 2.1]);
  }

  // ── big autumn tree ──
  const sways = [];
  function tree(x, z, { h = 2.6, r = 1.8, colors = [0xe58a2f, 0xf0b53a, 0xd4652c, 0xc7a03a], seed = 1 } = {}) {
    const rr = rng(seed); const y = topH(x, z); const g = new THREE.Group(); g.position.set(x, y - 0.05, z); world.add(g);
    const trunkG = new THREE.CylinderGeometry(0.22, 0.42, h, 10, 4); { const p = trunkG.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setX(i, p.getX(i) + Math.sin(yy * 1.5) * 0.08); } trunkG.computeVertexNormals(); }
    add(g, trunkG, mat(0x6b4a33), [0, h / 2, 0]);
    for (const a of [0.6, 2.6, 4.4]) add(g, new THREE.CylinderGeometry(0.06, 0.12, 1.1, 6), mat(0x6b4a33), [Math.cos(a) * 0.35, h * 0.75, Math.sin(a) * 0.35], [Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8]);
    const canopy = new THREE.Group(); canopy.position.y = h; g.add(canopy);
    const blobs = [[0, 0.6, 0, 1.1], [0.8, 0.3, 0.2, 0.85], [-0.75, 0.35, -0.1, 0.9], [0.1, 0.35, 0.8, 0.8], [-0.1, 0.4, -0.8, 0.85], [0.2, 1.25, 0.1, 0.8], [0.6, 0.9, -0.5, 0.65], [-0.6, 1.0, 0.45, 0.65]];
    blobs.forEach(([bx, by, bz, br], i) => {
      const geo = new THREE.IcosahedronGeometry(br * r * 0.62, 3); const p = geo.attributes.position; const v = new THREE.Vector3();
      for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k); const n = noise(v.x * 2 + seed, v.y * 2 + v.z * 2) * 0.08 * r; v.multiplyScalar(1 + n); p.setXYZ(k, v.x, v.y, v.z); } geo.computeVertexNormals();
      const c = new THREE.Color(colors[i % colors.length]); if (snowy) c.lerp(snowC, 0.25);
      add(canopy, geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }), [bx * r * 0.62, by * r * 0.62, bz * r * 0.62]);
      if (snowy) add(canopy, new THREE.SphereGeometry(br * r * 0.5, 16, 8, 0, 6.29, 0, 1.0), mat(0xf6f8ff), [bx * r * 0.62, by * r * 0.62 + br * r * 0.2, bz * r * 0.62], [0, 0, 0], null, false);
    });
    const ph = rr() * 6; sways.push((t) => { const w = 0.3 + ENV.uWind.value * 2; canopy.rotation.z = Math.sin(t * 1.1 + ph) * 0.025 * w; canopy.rotation.x = Math.sin(t * 0.8 + ph * 2) * 0.02 * w; });
    return g;
  }
  tree(4.4, -9.0, { h: 2.8, r: 2.1, seed: 3 });
  // swing on the big tree
  { const [x, y, z] = at(4.4, -9.0); const sw = new THREE.Group(); sw.position.set(x + 1.2, y + 2.8, z + 0.3); world.add(sw);
    for (const s of [-0.3, 0.3]) add(sw, new THREE.CylinderGeometry(0.012, 0.012, 2.1, 3), mat(0xc9a66b), [s, -1.05, 0], [0, 0, 0], null, false);
    add(sw, new THREE.BoxGeometry(0.75, 0.06, 0.3), mat(0x8a5a32), [0, -2.1, 0]); anim.push((t) => { sw.rotation.x = Math.sin(t * 1.4) * 0.12 * (0.4 + ENV.uWind.value * 2); }); }
  // falling-leaf pile under it
  for (let i = 0; i < 26; i++) { const a = R0() * 6.28, rr = 0.6 + R0() * 2.2; const x = 4.4 + Math.cos(a) * rr, z = -9 + Math.sin(a) * rr; add(world, new THREE.CircleGeometry(0.09, 5).rotateX(-Math.PI / 2), mat([0xe58a2f, 0xf0b53a, 0xd4652c][i % 3], { side: THREE.DoubleSide }), [x, topH(x, z) + 0.02, z], [0, R0() * 6, 0], null, false); }

  // ── island pines ──
  function pine(x, z, s = 1) { const y = topH(x, z); const g = new THREE.Group(); g.position.set(x, y - 0.05, z); g.scale.setScalar(s); world.add(g);
    add(g, new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6), mat(0x5c3d28), [0, 0.4, 0]);
    const pm = mat(0x2f6b3e); [[1.0, 1.2, 0.9], [0.8, 1.1, 1.55], [0.56, 0.95, 2.15], [0.34, 0.7, 2.65]].forEach(([r, h, yy]) => add(g, new THREE.ConeGeometry(r, h, 9), pm, [0, yy, 0]));
    if (snowy) [[0.85, 0.5, 1.45], [0.6, 0.45, 2.05], [0.4, 0.4, 2.65]].forEach(([r, h, yy]) => add(g, new THREE.ConeGeometry(r, h, 9), mat(0xf6f8ff), [0, yy + 0.15, 0], [0, 0, 0], null, false));
    const ph = R0() * 6; sways.push((t) => { g.rotation.z = Math.sin(t * 1.3 + ph) * 0.015 * (0.3 + ENV.uWind.value * 2); }); }
  [[-9.5, -7.5, 1.2], [-11, -4.5, 0.9], [-7.8, -10.3, 1.0], [12.4, -1.5, 0.8], [-12.5, 7.5, 0.85], [-9.2, 9.6, 1.0], [11.8, 9.0, 0.8], [1.5, 12.8, 0.8], [-13.8, 0.5, 0.75], [-10, 0.8, 0.7]].forEach(([x, z, s]) => pine(x, z, s));

  // ── pumpkins (glowing jack-o-lanterns) + witch hat grave ──
  { const pm = new THREE.MeshStandardMaterial({ color: 0xf07d1f, roughness: 0.55 });
    const faceM = new THREE.MeshStandardMaterial({ color: 0x2a1406, emissive: 0xffa33a, emissiveIntensity: 1 }); glow.push({ m: faceM, day: 0.9, night: 6 });
    const list = [[-7.4, 6.2, 0.62, true, 0.3], [-6.2, 7.1, 0.42, false, 0], [-8.3, 7.4, 0.48, true, -0.6], [-6.6, 5.5, 0.32, false, 0], [-7.9, 5.1, 0.38, true, 0.9], [-5.9, 6.4, 0.25, false, 0]];
    for (const [x, z, s, carved, yaw] of list) {
      const g = new THREE.Group(); g.position.set(x, topH(x, z) + s * 0.72, z); g.rotation.y = yaw + 0.8; world.add(g);
      const geo = new THREE.SphereGeometry(s, 40, 24); const p = geo.attributes.position; const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x); const rib = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * 5)), 0.5); v.x *= rib; v.z *= rib; v.y *= 0.78; if (v.y > s * 0.6) v.y -= (v.y - s * 0.6) * 0.5; p.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals();
      add(g, geo, snowy ? new THREE.MeshStandardMaterial({ color: 0xf07d1f, roughness: 0.55 }) : pm);
      add(g, new THREE.CylinderGeometry(s * 0.06, s * 0.09, s * 0.35, 6), mat(0x5a7a2a), [0, s * 0.78, 0], [0.2, 0, 0.15]);
      if (snowy) add(g, new THREE.SphereGeometry(s * 0.82, 20, 8, 0, 6.29, 0, 0.9), mat(0xf6f8ff), [0, s * 0.02, 0], [0, 0, 0], null, false);
      if (carved) {
        const tri = (w, h) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath(); return new THREE.ShapeGeometry(sh); };
        const zf = s * 0.76;
        for (const sx of [-1, 1]) add(g, tri(s * 0.3, s * 0.26), faceM, [sx * s * 0.28, s * 0.12, zf * 0.95], [0, sx * 0.35, 0], null, false);
        const mouth = new THREE.Shape(); mouth.moveTo(-s * 0.4, 0); for (let i = 0; i <= 6; i++) { const u = i / 6; mouth.lineTo(-s * 0.4 + u * s * 0.8, (i % 2 ? -0.05 : 0.03) * s - Math.sin(u * Math.PI) * s * 0.12); } mouth.lineTo(s * 0.4, 0); mouth.quadraticCurveTo(0, -s * 0.42, -s * 0.4, 0);
        add(g, new THREE.ShapeGeometry(mouth), faceM, [0, -s * 0.12, zf * 0.98], [0, 0, 0], null, false);
      }
    }
    const pl = new THREE.PointLight(0xff8a2a, 0, 6, 1.5); pl.position.set(-7.1, topH(-7.1, 6.3) + 0.9, 6.9); world.add(pl); lights.push({ l: pl, night: 5 });
    // vines
    const vine = new THREE.CatmullRomCurve3([[-8.8, 6.6], [-8, 6.0], [-7.2, 6.8], [-6.4, 6.2], [-5.6, 6.9], [-5.2, 6.1]].map(([x, z]) => new THREE.Vector3(x, topH(x, z) + 0.05, z)));
    add(world, new THREE.TubeGeometry(vine, 40, 0.03, 5), mat(0x4f7a2a), [0, 0, 0], [0, 0, 0], null, false);
    // R.I.P. witch hat (oct 31 – nov 1, 2026)
    const gx = -8.9, gz = 4.7, gy = topH(gx, gz);
    add(world, new THREE.SphereGeometry(0.45, 16, 8, 0, 6.29, 0, 1.3), mat(0x6b4a2e), [gx, gy - 0.12, gz], [0, 0, 0], [1, 0.45, 0.7]);
    const flat = new THREE.Group(); flat.position.set(gx, gy + 0.12, gz); flat.rotation.set(0.05, 0.6, -0.08); world.add(flat);
    add(flat, new THREE.CylinderGeometry(0.4, 0.4, 0.03, 24), mat(0x3b2a5a)); add(flat, new THREE.ConeGeometry(0.2, 0.18, 20), mat(0x3b2a5a), [0.05, 0.09, 0], [0, 0, -0.9], [1, 1, 0.6]);
    add(flat, new THREE.CylinderGeometry(0.205, 0.215, 0.05, 20), mat(0xf2a63d), [0, 0.035, 0]);
    sign(world, ['RIP HAT', 'too powerful'], [gx - 0.6, gy, gz - 0.25], 0.9, 0.55);
  }

  // ── skate ramp (half-pipe) ──
  { const [x, y, z] = at(9.6, 6.0); const ramp = new THREE.Group(); ramp.position.set(x, y - 0.05, z); ramp.rotation.y = -0.55; world.add(ramp);
    const sh = new THREE.Shape(); const W = 1.6, Rr = 1.1, flatW = 1.2; sh.moveTo(-flatW / 2 - Rr - 0.15, 0); sh.lineTo(-flatW / 2 - Rr - 0.15, Rr + 0.1); sh.lineTo(-flatW / 2 - Rr, Rr + 0.1);
    for (let i = 0; i <= 16; i++) { const a = Math.PI + (i / 16) * Math.PI / 2; sh.lineTo(-flatW / 2 + Math.cos(a) * Rr, Rr + Math.sin(a) * Rr); }
    sh.lineTo(flatW / 2, 0);
    for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + (i / 16) * Math.PI / 2; sh.lineTo(flatW / 2 + Math.cos(a) * Rr, Rr + Math.sin(a) * Rr); }
    sh.lineTo(flatW / 2 + Rr + 0.15, Rr + 0.1); sh.lineTo(flatW / 2 + Rr + 0.15, 0); sh.closePath();
    const eg = new THREE.ExtrudeGeometry(sh, { depth: W * 2, bevelEnabled: false, curveSegments: 16 }); eg.translate(0, 0, -W);
    const wt = woodTex('#d0a36b', 10, false); wt.repeat.set(0.4, 0.4);
    add(ramp, eg, new THREE.MeshStandardMaterial({ map: wt, roughness: 0.7, color: snowy ? 0xeef2ff : 0xffffff }));
    for (const sx of [-1, 1]) add(ramp, new THREE.CylinderGeometry(0.06, 0.06, W * 2, 10), mat(0xb8c0c8, { metalness: 0.8, roughness: 0.3 }), [sx * (flatW / 2 + Rr), Rr + 0.1, 0], [Math.PI / 2, 0, 0]);
    // stencilled sign + tiny practice board
    const st = signTex(['KICKFLIP', 'ARC'], { bg: '#2f9be0', fg: '#ffffff', border: '#1a5f8a', w: 256, h: 128, sizes: [44, 44] });
    add(ramp, new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshStandardMaterial({ map: st, roughness: 0.6 }), [0, 0.55, W + 0.005]);
    const board = new THREE.Group(); board.position.set(-0.1, 0.06, 0.4); board.rotation.y = 0.4; ramp.add(board);
    add(board, new THREE.CapsuleGeometry(0.12, 0.45, 4, 10), mat(0xff5a5a), [0, 0.05, 0], [0, 0, Math.PI / 2], [1, 0.18, 1]);
    for (const a of [-0.24, 0.24]) for (const b of [-0.08, 0.08]) add(board, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), mat(0xffee88), [a, 0.0, b], [Math.PI / 2, 0, 0]);
  }

  // ── art market stall + easel ──
  { const [x, y, z] = at(-1.0, 9.9); const st = new THREE.Group(); st.position.set(x, y - 0.05, z); st.rotation.y = Math.PI + 0.05; world.add(st);
    const wm = new THREE.MeshStandardMaterial({ map: woodTex('#b9855a', 6, false), roughness: 0.85 });
    add(st, new THREE.BoxGeometry(2.6, 0.9, 0.8), wm, [0, 0.45, 0.2]);
    add(st, new THREE.BoxGeometry(2.7, 0.06, 0.9), mat(0x8a5a32), [0, 0.92, 0.2]);
    for (const sx of [-1.25, 1.25]) for (const sz of [-0.2, 0.55]) add(st, new THREE.CylinderGeometry(0.05, 0.06, 2.3, 8), mat(0x7a5232), [sx, 1.15, sz]);
    const aw = stripes(['#ff6f6f', '#fff3e0'], 10, true, 256, 32);
    const awn = add(st, new THREE.PlaneGeometry(2.9, 1.2, 10, 1), new THREE.MeshStandardMaterial({ map: aw, side: THREE.DoubleSide, roughness: 0.8, color: snowy ? 0xf3f3ff : 0xffffff }), [0, 2.35, 0.55], [-1.15, 0, 0]);
    // scalloped awning edge
    for (let i = 0; i < 10; i++) add(st, new THREE.CircleGeometry(0.145, 12, Math.PI, Math.PI), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xfff3e0 : 0xff6f6f, side: THREE.DoubleSide }), [-1.305 + i * 0.29, 2.11, 1.05], [0, 0, 0], null, false);
    // sign
    add(st, new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshStandardMaterial({ map: signTex(["MOCHI'S ART", 'original masterpieces'], { w: 512, h: 128, sizes: [56, 30] }) }), [0, 1.95, -0.22]);
    // prints from STATE.art on a back board + counter
    add(st, new THREE.BoxGeometry(2.5, 0.95, 0.05), mat(0x8a5a32), [0, 1.42, -0.2]);
    const art = (state.art || []).slice(-5);
    art.forEach((a, i) => { const n = art.length; const px = (i - (n - 1) / 2) * 0.48; const tex = artTex(a.kind, a.title, a.price);
      add(st, new THREE.BoxGeometry(0.42, 0.52, 0.03), mat(0xf6e7c8), [px, 1.42, -0.16]); const pm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }); add(st, new THREE.PlaneGeometry(0.37, 0.46), pm, [px, 1.42, -0.14], [0, 0, 0], null, false); applyArtFile(a, pm, 0.37 / 0.46); });
    // string lights
    const bulbs = new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffc46b, emissiveIntensity: 0.4 }); glow.push({ m: bulbs, day: 0.4, night: 5 });
    for (let i = 0; i < 11; i++) { const u = i / 10; add(st, new THREE.SphereGeometry(0.045, 8, 6), bulbs, [-1.25 + u * 2.5, 2.05 - Math.sin(u * Math.PI) * 0.18, 1.02], [0, 0, 0], null, false); }
    // easel with work-in-progress
    const ez = new THREE.Group(); ez.position.set(1.85, 0, 1.0); ez.rotation.y = -0.6; st.add(ez); const em = mat(0x8a5a32);
    add(ez, new THREE.CylinderGeometry(0.03, 0.03, 1.8, 5), em, [-0.3, 0.88, 0], [0.12, 0, -0.15]); add(ez, new THREE.CylinderGeometry(0.03, 0.03, 1.8, 5), em, [0.3, 0.88, 0], [0.12, 0, 0.15]); add(ez, new THREE.CylinderGeometry(0.03, 0.03, 1.8, 5), em, [0, 0.85, -0.38], [-0.32, 0, 0]);
    add(ez, new THREE.BoxGeometry(0.7, 0.05, 0.1), em, [0, 0.7, 0.07]);
    const last = (state.art || []).slice(-1)[0] || { kind: 'ocean', title: 'untitled', price: 0 };
    add(ez, new THREE.BoxGeometry(0.72, 0.86, 0.03), mat(0xf6f0e0), [0, 1.17, 0.07], [-0.12, 0, 0]);
    const easelM = new THREE.MeshStandardMaterial({ map: artTex(last.kind, 'work in progress', last.price), roughness: 0.75 });
    add(ez, new THREE.PlaneGeometry(0.66, 0.8), easelM, [0, 1.17, 0.088], [-0.12, 0, 0], null, false); applyArtFile(last, easelM, 0.66 / 0.8);
    // paint palette + brush pots on counter
    add(st, new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16), mat(0xe8c89a), [-0.9, 0.96, 0.4]); [0xff5a5a, 0x4fb3e8, 0xffd34d, 0x5ac26a].forEach((c, i) => add(st, new THREE.SphereGeometry(0.035, 8, 6), mat(c), [-0.98 + i * 0.06, 0.99, 0.36 + (i % 2) * 0.07], [0, 0, 0], [1, 0.4, 1], false));
    add(st, new THREE.CylinderGeometry(0.08, 0.07, 0.18, 10), mat(0x4fb3e8), [0.9, 1.04, 0.4]); for (let i = 0; i < 3; i++) add(st, new THREE.CylinderGeometry(0.012, 0.012, 0.34, 4), mat(0xc9a66b), [0.88 + i * 0.03, 1.2, 0.4], [0, 0, (i - 1) * 0.2], null, false);
  }

  // ── cap museum ──
  const caps = Math.max(0, Math.floor(state.caps || 0));
  { const [x, y, z] = at(-8.5, -3.8); const mu = new THREE.Group(); mu.position.set(x, y - 0.05, z); mu.rotation.y = 0.85; world.add(mu);
    const wm = new THREE.MeshStandardMaterial({ map: woodTex('#9a6a42', 5, true), roughness: 0.85 });
    const W = 2.2, Hh = 2.0, D = 0.5; const rows = Math.max(3, Math.ceil(caps / 9));
    add(mu, new THREE.BoxGeometry(W, Hh, 0.06), wm, [0, Hh / 2, -D / 2]);
    for (const sx of [-1, 1]) add(mu, new THREE.BoxGeometry(0.08, Hh, D), wm, [sx * W / 2, Hh / 2, 0]);
    for (let r2 = 0; r2 <= rows; r2++) add(mu, new THREE.BoxGeometry(W, 0.06, D), wm, [0, 0.15 + r2 * ((Hh - 0.2) / rows), 0]);
    add(mu, new THREE.BoxGeometry(W + 0.3, 0.12, D + 0.2), mat(0x7a4a2a), [0, Hh + 0.05, 0]);
    add(mu, new THREE.PlaneGeometry(1.9, 0.5), new THREE.MeshStandardMaterial({ map: signTex(['CAP MUSEUM', `${caps} shiny caps · est. 2026`], { w: 512, h: 136, sizes: [60, 28], bg: '#fff3c9' }) }), [0, Hh + 0.42, 0.02]);
    add(mu, new THREE.BoxGeometry(0.06, 0.4, 0.06), mat(0x7a4a2a), [-0.6, Hh + 0.25, 0]); add(mu, new THREE.BoxGeometry(0.06, 0.4, 0.06), mat(0x7a4a2a), [0.6, Hh + 0.25, 0]);
    // bottle caps (crimped)
    const capGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.035, 21, 1); { const p = capGeo.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const rr = Math.hypot(p.getX(i), p.getZ(i)); if (rr > 0.05) { const k = 1 + 0.08 * Math.cos(a * 21); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } } capGeo.computeVertexNormals(); }
    const palette = [0xe63946, 0xf4a261, 0x2a9d8f, 0x457b9d, 0xffd166, 0x8ecae6, 0xc0c0c8, 0x06d6a0, 0xef476f, 0x9b5de5];
    const perRow = 9; const capM = palette.map((c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.75, roughness: 0.3 }));
    for (let i = 0; i < caps; i++) { const r2 = Math.floor(i / perRow), c = i % perRow; if (r2 >= rows) break;
      const isSon = i === 16; const cm = isSon ? new THREE.MeshStandardMaterial({ color: 0xffcf3a, metalness: 0.9, roughness: 0.2, emissive: 0x5a3a00, emissiveIntensity: 0.4 }) : capM[(i * 7) % capM.length];
      const cy = 0.15 + r2 * ((Hh - 0.2) / rows) + 0.12; add(mu, capGeo, cm, [-W / 2 + 0.2 + c * ((W - 0.4) / (perRow - 1)), cy, 0.02], [Math.PI / 2 - 0.25, 0, (R0() - 0.5) * 0.4], isSon ? 1.25 : 1, false);
      if (isSon) glow.push({ m: cm, day: 0.4, night: 1.6 }); }
    // pedestal for #17 (his son) in front
    add(mu, new THREE.CylinderGeometry(0.22, 0.26, 0.6, 12), mat(0xf2ead8), [1.45, 0.3, 0.55]);
    const son = add(mu, capGeo, new THREE.MeshStandardMaterial({ color: 0xffcf3a, metalness: 0.9, roughness: 0.2, emissive: 0xffa000, emissiveIntensity: 0.35 }), [1.45, 0.75, 0.55], [Math.PI / 2 - 0.3, 0, 0], 1.8);
    anim.push((t) => { son.rotation.z = t * 0.8; son.position.y = 0.76 + Math.sin(t * 2) * 0.03; });
    add(mu, new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshStandardMaterial({ map: signTex(['#17 · my son'], { w: 256, h: 96, font: 'bold 40px sans-serif' }) }), [1.45, 0.42, 0.79], [0, 0, 0], null, false);
  }

  // ── squirrel's tree ──
  tree(10.0, -4.6, { h: 3.6, r: 1.55, colors: [0xc75a2a, 0xa8432a, 0xe07a34, 0xb8862e], seed: 9 });
  { const [x, y, z] = at(10.0, -4.6); add(world, new THREE.CircleGeometry(0.17, 16), mat(0x2a180c), [x - 0.32, y + 1.6, z + 0.2], [0, -1.1, 0], null, false);
    add(world, new THREE.BoxGeometry(0.9, 0.08, 0.7), mat(0x8a5a32), [x - 0.45, y + 2.55, z + 0.1]); // branch platform
    sign(world, ['NO KIWIS', '(esp. mochi)'], [x - 1.0, y, z + 0.95], -1.2, 0.6);
    for (let i = 0; i < 5; i++) { const a = R0() * 6.28; add(world, new THREE.SphereGeometry(0.06, 8, 6), mat(0x8a5a32), [x + Math.cos(a) * 0.9, topH(x, z) + 0.05, z + Math.sin(a) * 0.9], [0, 0, 0], [1, 1.2, 1], false); }
  }

  // ── garden ──
  { const [x, y, z] = at(5.6, 9.4); const gd = new THREE.Group(); gd.position.set(x, y - 0.05, z); gd.rotation.y = -0.25; world.add(gd);
    const soil = mat(snowy ? 0xe8ecf4 : 0x5a3a24, { roughness: 1 });
    for (const bx of [-0.75, 0.75]) { add(gd, new THREE.BoxGeometry(1.2, 0.3, 2.2), mat(0x8a5a32), [bx, 0.15, 0]); add(gd, new THREE.BoxGeometry(1.05, 0.05, 2.05), soil, [bx, 0.31, 0]);
      for (let k = 0; k < 4; k++) { const pz = -0.75 + k * 0.5;
        if (bx < 0) { const cab = new THREE.Group(); cab.position.set(bx, 0.42, pz); gd.add(cab); add(cab, new THREE.SphereGeometry(0.17, 14, 10), mat(0x8cc56a), [0, 0, 0]); for (let l = 0; l < 5; l++) { const a = l / 5 * 6.28; add(cab, new THREE.SphereGeometry(0.15, 10, 6, 0, 6.29, 0, 1.2), mat(0x6aa84f, { side: THREE.DoubleSide }), [Math.cos(a) * 0.1, -0.03, Math.sin(a) * 0.1], [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9], null, false); } }
        else { for (const dx of [-0.22, 0.22]) { add(gd, new THREE.ConeGeometry(0.05, 0.14, 8), mat(0xf28a2a), [bx + dx, 0.36, pz], [Math.PI, 0, 0]); for (let l = 0; l < 3; l++) add(gd, new THREE.ConeGeometry(0.025, 0.3, 4), mat(0x5aa83a), [bx + dx + (l - 1) * 0.03, 0.5, pz], [0, 0, (l - 1) * 0.3], null, false); } }
      } }
    // sunflowers (late season, a bit droopy)
    for (const [sx, sz] of [[1.7, -0.9], [1.75, 0.0], [1.7, 0.9]]) { const h = 1.4 + R0() * 0.4; const f = new THREE.Group(); f.position.set(sx, 0, sz); gd.add(f);
      add(f, new THREE.CylinderGeometry(0.03, 0.04, h, 5), mat(0x5a8a2a), [0, h / 2, 0]); const head = new THREE.Group(); head.position.set(0, h, 0.08); head.rotation.x = 0.5; f.add(head);
      add(head, new THREE.CylinderGeometry(0.13, 0.13, 0.05, 16), mat(0x5a3a1a), [0, 0, 0], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; add(head, new THREE.SphereGeometry(0.07, 6, 4), mat(0xf6c23a), [Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0], [0, 0, a], [1.6, 0.6, 0.3], false); }
      const ph = R0() * 6; anim.push((t) => { f.rotation.z = Math.sin(t * 1.2 + ph) * 0.05 * (0.4 + ENV.uWind.value * 2); }); }
    // little picket fence
    for (let i = 0; i < 9; i++) add(gd, new THREE.BoxGeometry(0.08, 0.5, 0.04), mat(0xf6efe0), [-1.6 + i * 0.4, 0.25, -1.3]);
    add(gd, new THREE.BoxGeometry(3.4, 0.06, 0.03), mat(0xf6efe0), [0, 0.36, -1.32]);
    add(gd, new THREE.CylinderGeometry(0.12, 0.14, 0.22, 12), mat(0x5aa0c8, { metalness: 0.5, roughness: 0.4 }), [-1.7, 0.11, 1.2]); add(gd, new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6), mat(0x5aa0c8, { metalness: 0.5 }), [-1.55, 0.22, 1.2], [0, 0, -0.9]);
  }

  // ── lookout cliff ──
  { const cx = CLIFF.x - 0.2, cz = CLIFF.z + 0.1, cy = topH(cx, cz);
    const yaw = Math.atan2(TRAPPER_DIR.x, TRAPPER_DIR.y);
    // telescope pointing at Trapper Peak
    const tel = new THREE.Group(); tel.position.set(cx - 0.6, cy, cz - 1.0); tel.rotation.y = yaw; world.add(tel);
    for (const a of [0, 2.1, 4.2]) add(tel, new THREE.CylinderGeometry(0.025, 0.025, 1.0, 5), mat(0x7a5232), [Math.sin(a) * 0.18, 0.47, Math.cos(a) * 0.18], [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]);
    add(tel, new THREE.CylinderGeometry(0.07, 0.1, 0.7, 12), mat(0xc8a040, { metalness: 0.8, roughness: 0.3 }), [0, 1.0, 0.05], [Math.PI / 2 - 0.25, 0, 0]);
    sign(world, ['TRAPPER PK', '10,157 ft →'], [cx + 0.9, cy, cz - 0.8], yaw + Math.PI, 0.7);
    // log bench + boulders
    add(world, new THREE.CylinderGeometry(0.22, 0.22, 1.4, 12), mat(0x7a5232), [cx + 0.6, cy + 0.2, cz + 0.9], [0, yaw, Math.PI / 2]);
    for (let i = 0; i < 6; i++) { const a = R0() * 6.28, rr = 1.2 + R0() * 1.4; const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr; add(world, new THREE.DodecahedronGeometry(0.14 + R0() * 0.22, 1), mat(snowy ? 0xe0e4ea : 0x9a9088), [x, topH(x, z) + 0.05, z], [R0(), R0(), R0()], [1, 0.7, 1]); }
    // tiny flag of conquest
    const flag = new THREE.Group(); flag.position.set(cx + 1.3, topH(cx + 1.3, cz - 1.4), cz - 1.4); world.add(flag);
    add(flag, new THREE.CylinderGeometry(0.02, 0.02, 1.3, 5), mat(0xdddddd), [0, 0.65, 0]);
    const fl = add(flag, new THREE.PlaneGeometry(0.5, 0.3, 6, 1), new THREE.MeshStandardMaterial({ map: signTex(['🥝 MINE'], { w: 256, h: 150, bg: '#ff6b8a', fg: '#fff', border: '#ff6b8a', font: 'bold 64px sans-serif' }), side: THREE.DoubleSide }), [0.25, 1.12, 0], [0, 0, 0], null, false);
    const fp = fl.geometry.attributes.position; const base = Float32Array.from(fp.array);
    anim.push((t) => { for (let i = 0; i < fp.count; i++) { const xx = base[i * 3] + 0.25; fp.setZ(i, Math.sin(t * 6 + xx * 9) * 0.05 * xx * (1 + ENV.uWind.value * 2)); } fp.needsUpdate = true; });
  }

  // ── picnic table + soda cooler ──
  { const [x, y, z] = at(-3.2, 1.6); const pt = new THREE.Group(); pt.position.set(x, y - 0.03, z); pt.rotation.y = 0.3; world.add(pt);
    const wm = new THREE.MeshStandardMaterial({ map: woodTex('#b88a5a', 5, false), roughness: 0.85 });
    add(pt, new THREE.BoxGeometry(1.8, 0.07, 0.9), wm, [0, 0.75, 0]);
    for (const sz of [-0.75, 0.75]) add(pt, new THREE.BoxGeometry(1.8, 0.06, 0.3), wm, [0, 0.42, sz]);
    for (const sx of [-0.7, 0.7]) for (const s of [-1, 1]) add(pt, new THREE.BoxGeometry(0.07, 0.95, 0.07), mat(0x8a5a32), [sx, 0.4, s * 0.35], [s * 0.55, 0, 0]);
    add(pt, new THREE.BoxGeometry(1.0, 0.02, 0.6), new THREE.MeshStandardMaterial({ map: stripes(['#e8463c', '#fff4e0'], 8, true, 64, 64), roughness: 0.9 }), [0.2, 0.795, 0]);
    add(pt, new THREE.CylinderGeometry(0.04, 0.04, 0.16, 10), mat(0x4fb3e8, { metalness: 0.6, roughness: 0.3 }), [0.4, 0.88, 0.1]);
    add(pt, new THREE.BoxGeometry(0.6, 0.42, 0.42), mat(0xe8463c, { roughness: 0.5 }), [1.4, 0.21, 0.6], [0, 0.4, 0]); add(pt, new THREE.BoxGeometry(0.64, 0.08, 0.46), mat(0xf6f6f6, { roughness: 0.5 }), [1.4, 0.46, 0.6], [0, 0.4, 0]);
  }

  // ── wildflowers, mushrooms, rocks scattered ──
  { const fl = [0xffffff, 0xffd6e8, 0xfff07a, 0xc9b6ff, 0xff9aa2]; const stemG = new THREE.CylinderGeometry(0.01, 0.01, 0.25, 3); stemG.translate(0, 0.125, 0); const headG = new THREE.SphereGeometry(0.05, 6, 4);
    const N = snowy ? 0 : 160; const heads = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ roughness: 0.8 }), N); const m4 = new THREE.Matrix4(); const c = new THREE.Color(); let k = 0;
    for (let i = 0; i < N * 4 && k < N; i++) { const a = R0() * 6.28, rr = Math.sqrt(R0()) * 12.5; const x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (blocked(x, z)) continue; m4.makeTranslation(x, topH(x, z) + 0.2, z); heads.setMatrixAt(k, m4); heads.setColorAt(k, c.set(fl[k % fl.length])); k++; }
    heads.count = k; world.add(heads);
    for (let i = 0; i < 6; i++) { const a = R0() * 6.28, rr = 4 + R0() * 8; const x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (blocked(x, z)) continue; const y = topH(x, z);
      add(world, new THREE.CylinderGeometry(0.04, 0.05, 0.15, 6), mat(0xf6efe0), [x, y + 0.07, z]); add(world, new THREE.SphereGeometry(0.11, 12, 6, 0, 6.29, 0, 1.6), mat(0xe8463c), [x, y + 0.14, z], [0, 0, 0], [1, 0.7, 1]); }
  }

  // ── wind-swaying grass (instanced, cheap) ──
  const grass = (() => {
    const N = mobile ? 3500 : 7500; const bg = new THREE.PlaneGeometry(0.06, 0.26, 1, 3); bg.translate(0, 0.13, 0);
    const p = bg.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i) / 0.26; p.setX(i, p.getX(i) * (1 - yy * 0.85)); }
    const nrm = bg.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    const gm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
    gm.onBeforeCompile = (sh) => { sh.uniforms.uTime = ENV.uTime; sh.uniforms.uWind = ENV.uWind;
      sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float hh = uv.y; vec4 ip = instanceMatrix[3];
        float sway = sin(uTime * 2.2 + ip.x * 0.6 + ip.z * 0.4) * 0.5 + sin(uTime * 3.7 + ip.x * 1.3) * 0.25;
        transformed.x += sway * hh * hh * (0.06 + uWind * 0.35);
        transformed.z += cos(uTime * 1.9 + ip.z * 0.7) * hh * hh * (0.03 + uWind * 0.15);`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal);'); };
    const im = new THREE.InstancedMesh(bg, gm, N); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(); const c = new THREE.Color(); let k = 0;
    for (let i = 0; i < N * 5 && k < N; i++) {
      const a = R0() * 6.28, rr = Math.sqrt(R0()) * (ISLAND_R + 1.2); const x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (rr > islandRadius(a) - 0.7) continue; if (blocked(x, z)) continue;
      const sl = Math.hypot(topH(x + 0.2, z) - topH(x - 0.2, z), topH(x, z + 0.2) - topH(x, z - 0.2)) / 0.4; if (sl > 0.7) continue;
      const clump = noise(x * 0.35, z * 0.35); if (R0() > 0.45 + clump * 0.6) continue;
      v.set(x, topH(x, z) - 0.02, z); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, R0() * 6.28); const sc = 0.7 + R0() * 0.9; s.set(sc, sc * (0.8 + R0() * 0.8), sc);
      m4.compose(v, q, s); im.setMatrixAt(k, m4);
      c.set(0x6fa040).lerp(new THREE.Color(0xc0b850), R0() * 0.6 * (0.5 + 0.5 * noise(x * 0.2, z * 0.2))); if (snowy) c.lerp(snowC, 0.75); im.setColorAt(k, c); k++;
    }
    im.count = k; im.receiveShadow = true; world.add(im); return im;
  })();
  function blocked(x, z) {
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.5) return true;
    for (const zn of ZONES) { if (zn.id === 'pond' || zn.id === 'cliff' || zn.id === 'beach') continue; if (Math.hypot(x - zn.pos[0], z - zn.pos[1]) < 1.8) return true; }
    return false;
  }

  // ── river rocks, cobbles on the bars, driftwood, willows on the island banks ──
  for (const [rx, rz, rr] of RIVER_ROCKS) { add(world, new THREE.DodecahedronGeometry(rr, 1), mat(snowy ? 0xd8dde4 : 0x8f8a84), [rx, WATER_Y - 0.55 * rr + 0.3 * rr, rz], [R0(), R0(), R0()], [1.1, 0.7, 0.9]); }
  { const cob = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 260); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(); const cc = new THREE.Color(); let k = 0;
    for (let i = 0; i < 4000 && k < 260; i++) { const a = R0() * 6.28; const R = islandRadius(a); const rr = R + R0() * islandSkirtD(a) * 0.7; const x = Math.cos(a) * rr, z = Math.sin(a) * rr; const y = groundOrShore(x, z); if (y < WATER_Y - 0.1 || y > WATER_Y + 0.6) continue;
      const s0 = 0.06 + R0() * 0.14; v.set(x, y + s0 * 0.3, z); q.setFromEuler(new THREE.Euler(R0() * 3, R0() * 3, R0() * 3)); sc.set(s0 * 1.3, s0 * 0.7, s0); m4.compose(v, q, sc); cob.setMatrixAt(k, m4); cob.setColorAt(k, cc.setHSL(0.08, 0.08 + R0() * 0.1, 0.45 + R0() * 0.3)); k++; }
    cob.count = k; cob.receiveShadow = true; world.add(cob); }
  function groundOrShore(x, z) { const r = Math.hypot(x, z), th = Math.atan2(z, x), R = islandRadius(th); if (r <= R) return topH(x, z); return islandSkirtY(topH(Math.cos(th) * R, Math.sin(th) * R), (r - R) / islandSkirtD(th), th); }
  { // driftwood
    const dw = [[-2.0, -18.5, 0.6], [3.5, 18.4, 2.2], [-15.5, -10, 1.2]];
    for (const [x, z, yaw] of dw) { const y = groundOrShore(x, z); const g = new THREE.Group(); g.position.set(x, y + 0.12, z); g.rotation.y = yaw; world.add(g); add(g, new THREE.CylinderGeometry(0.13, 0.18, 2.4, 8), mat(0xb8a890), [0, 0, 0], [0, 0, Math.PI / 2 + 0.05]); add(g, new THREE.CylinderGeometry(0.05, 0.07, 0.8, 5), mat(0xb8a890), [0.6, 0.15, 0.2], [0.6, 0, 1.0]); }
  }
  function willowTree(x, z, s = 1) { const y = groundOrShore(x, z); const g = new THREE.Group(); g.position.set(x, y - 0.05, z); g.scale.setScalar(s); world.add(g);
    add(g, new THREE.CylinderGeometry(0.12, 0.2, 1.6, 7), mat(0x6e5a48), [0, 0.8, 0], [0.1, 0, 0.08]);
    const dome = new THREE.SphereGeometry(1.25, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62); const ps = dome.attributes.position; for (let i = 0; i < ps.count; i++) { const yy = ps.getY(i); ps.setY(i, yy * 1.35); const k = 1 + 0.06 * Math.sin(Math.atan2(ps.getZ(i), ps.getX(i)) * 14); ps.setX(i, ps.getX(i) * k); ps.setZ(i, ps.getZ(i) * k); } dome.computeVertexNormals();
    const wm = new THREE.MeshStandardMaterial({ color: snowy ? 0xdfe6d8 : [0xb4b24c, 0xa6aa48, 0xc8b450][Math.floor(R0() * 3)], roughness: 0.9, side: THREE.DoubleSide });
    const top = add(g, dome, wm, [0, 1.4, 0]); const ph = R0() * 6; sways.push((t) => { top.rotation.z = Math.sin(t * 1.2 + ph) * 0.03 * (0.4 + ENV.uWind.value * 2); top.rotation.x = Math.cos(t * 0.9 + ph) * 0.02 * (0.4 + ENV.uWind.value * 2); }); }
  [[-6.5, -13.2, 1.0], [-10.5, -11.5, 0.85], [12.6, 4.6, 0.9], [-2, 14.2, 0.95], [9.5, 11.6, 0.8], [-13.8, -6.8, 0.75]].forEach(([x, z, s]) => willowTree(x, z, s));
  // a big cottonwood on the island too, gold in November
  tree(-1.5, -11.8, { h: 3.4, r: 1.9, colors: [0xe8c040, 0xd9a830, 0xf0cc50, 0xc9a838], seed: 17 });

  function update(t, dt, night) {
    for (const f of anim) f(t, dt); for (const f of sways) f(t);
    for (const gl of glow) gl.m.emissiveIntensity = gl.day + (gl.night - gl.day) * night;
    for (const L of lights) L.l.intensity = L.night * night;
  }
  return { world, update, grass, ground, pondMat };
}

function sign(parent, lines, [x, y, z], yaw = 0, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; g.scale.setScalar(s); parent.add(g);
  add(g, new THREE.CylinderGeometry(0.04, 0.05, 1.0, 6), mat(0x7a5232), [0, 0.5, 0]);
  add(g, new THREE.BoxGeometry(1.1, 0.55, 0.06), mat(0x8a5a32), [0, 1.0, 0]);
  const tex = signTex(lines, { w: 512, h: 256, sizes: lines.length > 1 ? [76, 48] : [80] });
  add(g, new THREE.PlaneGeometry(1.02, 0.48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), [0, 1.0, 0.035], [0, 0, 0], null, false);
  add(g, new THREE.PlaneGeometry(1.02, 0.48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), [0, 1.0, -0.035], [0, Math.PI, 0], null, false);
  return g;
}
