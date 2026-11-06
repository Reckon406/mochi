// The rival squirrel and the occasional elk
import * as THREE from 'three';
import { topH } from './layout.js';
import { smoothstep } from './noise.js';

const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
function add(p, g, mat, pos = [0, 0, 0], rot = [0, 0, 0], sc = null) { const x = new THREE.Mesh(g, mat); x.position.set(...pos); x.rotation.set(...rot); if (sc) x.scale.set(...sc); x.castShadow = true; p.add(x); return x; }

export function createSquirrel(treePos) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const fur = m(0xb8582a), belly = m(0xf3dcb8), dark = m(0x1a0f0a, { roughness: 0.2 });
  add(body, new THREE.SphereGeometry(0.16, 20, 14), fur, [0, 0.18, 0], [0, 0, 0], [0.9, 1.1, 1.2]);
  add(body, new THREE.SphereGeometry(0.1, 14, 10), belly, [0, 0.16, 0.1], [0, 0, 0], [0.8, 1.1, 0.6]);
  const head = new THREE.Group(); head.position.set(0, 0.36, 0.1); body.add(head);
  add(head, new THREE.SphereGeometry(0.11, 18, 14), fur);
  add(head, new THREE.SphereGeometry(0.05, 10, 8), belly, [0, -0.03, 0.08]);
  for (const s of [-1, 1]) { add(head, new THREE.SphereGeometry(0.025, 10, 8), dark, [s * 0.055, 0.025, 0.085]); add(head, new THREE.ConeGeometry(0.035, 0.09, 8), fur, [s * 0.06, 0.12, -0.01], [0, 0, -s * 0.3]); }
  add(head, new THREE.SphereGeometry(0.015, 8, 6), dark, [0, -0.01, 0.13]);
  // big fluffy S-shaped tail
  const tail = new THREE.Group(); tail.position.set(0, 0.12, -0.16); body.add(tail);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.12, -0.14), new THREE.Vector3(0, 0.34, -0.12), new THREE.Vector3(0, 0.48, 0.0), new THREE.Vector3(0, 0.52, -0.1)]);
  const tg = new THREE.TubeGeometry(curve, 30, 0.1, 12); const tp = tg.attributes.position; const uv = tg.attributes.uv;
  // taper ends, fat middle
  { const v = new THREE.Vector3(); const pts = curve.getSpacedPoints(30); for (let i = 0; i < tp.count; i++) { const u = uv.getX(i); const c = curve.getPointAt(Math.min(1, u)); v.fromBufferAttribute(tp, i).sub(c); const s = 0.55 + 1.1 * Math.sin(Math.PI * Math.min(1, u * 1.05)); v.multiplyScalar(s).add(c); tp.setXYZ(i, v.x, v.y, v.z); } tg.computeVertexNormals(); }
  add(tail, tg, m(0xc8683a));
  const legs = [];
  for (const [x, z] of [[-0.08, 0.08], [0.08, 0.08], [-0.09, -0.08], [0.09, -0.08]]) legs.push(add(body, new THREE.CapsuleGeometry(0.03, 0.06, 4, 6), fur, [x, 0.05, z]));
  // acorn in hand
  const acorn = new THREE.Group(); acorn.position.set(0, 0.26, 0.17); body.add(acorn); add(acorn, new THREE.SphereGeometry(0.035, 10, 8), m(0xa8743a), [0, 0, 0], [0, 0, 0], [1, 1.25, 1]); add(acorn, new THREE.SphereGeometry(0.038, 10, 6, 0, 6.29, 0, 1.4), m(0x6b4524), [0, 0.02, 0]);
  root.scale.setScalar(1.25);

  const [tx, tz] = treePos; const ty = topH(tx, tz);
  const trunkR = 0.45; const climbH = 2.35;
  let t = 0;
  // phases: ground pose (3.5s) -> scamper around (1.5s) -> climb (1.8s) -> perch on branch (4.5s) -> descend (1.6s)
  const P = [3.5, 1.5, 1.8, 4.5, 1.6]; const total = P.reduce((a, b) => a + b);
  function update(dt) {
    t += dt; const u = t % total; let k = 0, acc = 0; while (u > acc + P[k]) { acc += P[k]; k++; } const f = (u - acc) / P[k];
    let ang = 0, y = 0, r = trunkR + 0.22, vertical = 0; let run = 0;
    if (k === 0) { ang = 0.9; r = 0.9; y = 0; }
    else if (k === 1) { ang = 0.9 + f * Math.PI * 1.5; r = 0.9 - f * (0.9 - (trunkR + 0.12)); run = 1; }
    else if (k === 2) { ang = 0.9 + Math.PI * 1.5 + f * Math.PI * 2; r = trunkR + 0.12; y = smoothstep(0, 1, f) * climbH; vertical = 1; run = 1; }
    else if (k === 3) { ang = 0.9 + Math.PI * 3.5; r = trunkR + 0.35; y = climbH + 0.08; }
    else { ang = 0.9 + Math.PI * 3.5 - f * Math.PI * 2; r = trunkR + 0.12; y = (1 - smoothstep(0, 1, f)) * climbH; vertical = -1; run = 1; }
    root.position.set(tx + Math.cos(ang) * r, ty + y, tz + Math.sin(ang) * r);
    const dir = k === 4 ? -1 : 1;
    if (k === 0 || k === 3) { root.rotation.set(0, -ang + Math.PI / 2 + Math.PI + 0.3 * Math.sin(t * 0.7), 0); body.rotation.x = 0; }
    else { root.rotation.set(0, -ang - (dir > 0 ? 0 : Math.PI), 0); body.rotation.x = vertical ? -1.25 * vertical : 0; }
    const hopPh = t * 22; body.position.y = run ? Math.abs(Math.sin(hopPh)) * 0.05 : 0;
    tail.rotation.x = 0.2 * Math.sin(t * (run ? 14 : 3)) + (k === 0 || k === 3 ? 0.15 * Math.max(0, Math.sin(t * 9)) : 0);
    head.rotation.y = k === 0 || k === 3 ? 0.4 * Math.sin(t * 1.7) : 0; head.rotation.x = k === 3 ? 0.1 * Math.sin(t * 13) : 0;
    legs.forEach((l, i) => (l.rotation.x = run ? Math.sin(hopPh + (i < 2 ? 0 : Math.PI)) * 0.8 : 0));
    acorn.visible = k !== 1 && k !== 2 && k !== 4;
  }
  return { root, update };
}

export function createElk() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const coat = m(0x8a5a36), mane = m(0x4a2e1c), rump = m(0xe8d2a8), hoof = m(0x2a1a10), antler = m(0xe8dcc0, { roughness: 0.6 });
  add(body, new THREE.CapsuleGeometry(0.45, 1.1, 6, 16), coat, [0, 1.45, 0], [Math.PI / 2, 0, 0], [1, 1, 0.9]);
  add(body, new THREE.SphereGeometry(0.36, 16, 12), rump, [0, 1.5, -0.72], [0, 0, 0], [1, 1, 0.5]);
  const neck = new THREE.Group(); neck.position.set(0, 1.65, 0.7); body.add(neck);
  add(neck, new THREE.CapsuleGeometry(0.24, 0.6, 6, 12), mane, [0, 0.35, 0.15], [0.6, 0, 0]);
  const head = new THREE.Group(); head.position.set(0, 0.75, 0.42); neck.add(head);
  add(head, new THREE.CapsuleGeometry(0.15, 0.4, 6, 12), coat, [0, -0.05, 0.15], [1.25, 0, 0]);
  add(head, new THREE.SphereGeometry(0.1, 10, 8), m(0x3a2418), [0, -0.12, 0.42]);
  for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.035, 8, 6), m(0x111111, { roughness: 0.2 }), [s * 0.13, 0.05, 0.12]);
    add(head, new THREE.ConeGeometry(0.06, 0.2, 8), coat, [s * 0.15, 0.17, -0.02], [0, 0, -s * 0.9]);
    const a = new THREE.Group(); a.position.set(s * 0.08, 0.15, -0.05); a.rotation.set(-0.5, 0, -s * 0.35); head.add(a);
    add(a, new THREE.CylinderGeometry(0.025, 0.04, 0.9, 6), antler, [0, 0.45, 0]);
    for (const [h, l, ang] of [[0.2, 0.32, 1.0], [0.42, 0.3, 0.9], [0.62, 0.26, 0.8], [0.85, 0.2, 0.6]]) add(a, new THREE.CylinderGeometry(0.015, 0.025, l, 5), antler, [0, h + l * 0.35, l * 0.4], [ang, 0, 0]);
  }
  const legs = [];
  for (const [x, z] of [[-0.25, 0.55], [0.25, 0.55], [-0.25, -0.6], [0.25, -0.6]]) {
    const L = new THREE.Group(); L.position.set(x, 1.2, z); body.add(L);
    add(L, new THREE.CylinderGeometry(0.08, 0.06, 1.1, 8), coat, [0, -0.55, 0]); add(L, new THREE.CylinderGeometry(0.065, 0.07, 0.1, 8), hoof, [0, -1.12, 0]); legs.push(L);
  }
  add(body, new THREE.ConeGeometry(0.06, 0.15, 6), rump, [0, 1.6, -0.95], [-2.2, 0, 0]);
  root.scale.setScalar(0.85); root.visible = false;

  const routes = [[[-15, 11], [13, 11.5]], [[14, -8], [-12, -11]], [[-13, -7], [6, 13.5]], [[-14, 9], [12, -9]]].map((r) => r.map(([x, z]) => [x * 1.7, z * 1.7]));
  let active = false, prog = 0, from = new THREE.Vector2(), to = new THREE.Vector2(), timer = 25 + Math.random() * 30, walkPh = 0, pause = 0, len = 1;
  function start(p0 = 0) { const r = routes[Math.floor(Math.random() * routes.length)]; const flip = Math.random() < 0.5; from.set(...(flip ? r[1] : r[0])); to.set(...(flip ? r[0] : r[1])); len = from.distanceTo(to); prog = p0; active = true; root.visible = true; pause = 0; }
  function update(dt, t) {
    if (!active) { timer -= dt; if (timer < 0) start(); return; }
    const speed = 1.1; let moving = true;
    if (pause > 0) { pause -= dt; moving = false; } else { prog += (speed * dt) / len; if (Math.random() < dt * 0.06) pause = 2.5 + Math.random() * 2; }
    const p = from.clone().lerp(to, Math.min(1, prog)); const y = topH(p.x, p.y);
    root.position.set(p.x, y, p.y);
    root.rotation.y = Math.atan2(to.x - from.x, to.y - from.y);
    const fade = smoothstep(0, 0.08, prog) * (1 - smoothstep(0.92, 1, prog)); root.scale.setScalar(0.85 * (0.001 + fade));
    if (moving) walkPh += dt * 5.5;
    legs.forEach((l, i) => (l.rotation.x = moving ? Math.sin(walkPh + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.4 : 0));
    body.position.y = moving ? Math.abs(Math.sin(walkPh)) * 0.04 : 0;
    neck.rotation.x = moving ? 0.05 * Math.sin(walkPh * 2) : 0.55 + 0.05 * Math.sin(t * 3); // grazes when paused
    if (prog >= 1) { active = false; root.visible = false; timer = 70 + Math.random() * 80; }
  }
  return { root, update, start, get active() { return active; } };
}
