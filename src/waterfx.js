// Water polish: an animated shore-foam ribbon around the island, fish that jump + splash, and soft fake night
// reflections (glow streaks on the river under lanterns near the water). All cheap: 1 ribbon, 1 fish, pooled rings, a few streaks.
import * as THREE from 'three';
import { islandRadius, islandSurfH, skirtD, WATER_Y, riverX, riverW } from './layout.js';
import { fishMesh } from './fish.js';

export function createWaterFx(scene, { lights = [], mobile = false, music }) {
  const group = new THREE.Group(); group.name = 'water-fx'; scene.add(group); const TAU = Math.PI * 2;
  // ── shore foam ribbon: find the waterline at each angle, lay a strip from just inside to ~1m outside ──
  const N = mobile ? 140 : 220; const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) { const th = (i / N) * TAU; const R = islandRadius(th), D = skirtD(th); let rw = R + D * 0.5;
    for (let r = R - 1; r < R + D; r += 0.12) { if (islandSurfH(Math.cos(th) * r, Math.sin(th) * r) < WATER_Y + 0.02) { rw = r; break; } }
    for (const [o, v] of [[-0.35, 0], [1.3, 1]]) { pos.push(Math.cos(th) * (rw + o), WATER_Y + 0.025, Math.sin(th) * (rw + o)); uv.push(i / N * 60, v); }
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setIndex(idx);
  const FU = { uT: { value: 0 }, uN: { value: 0 } };
  const foam = new THREE.Mesh(fg, new THREE.ShaderMaterial({ uniforms: FU, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; uniform float uN; varying vec2 vUv;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){ float v = vUv.y; float wave = 0.5 + 0.5 * sin(vUv.x * 2.1 + uT * 0.9) * sin(vUv.x * 0.7 - uT * 0.5);
        float front = smoothstep(0.0, 0.12, v) * (1.0 - smoothstep(0.25 + 0.35 * wave, 0.75 + 0.2 * wave, v));
        float bubbles = step(0.55, fract(sin(floor(vUv.x * 9.0) * 12.9 + floor(v * 14.0 - uT * 0.6) * 78.2) * 43758.5)) * (1.0 - v);
        float a = clamp(front * 0.55 + bubbles * 0.12, 0.0, 0.7); gl_FragColor = vec4(mix(vec3(0.95, 0.98, 1.0), vec3(0.55, 0.62, 0.75), uN), a); }` }));
  foam.renderOrder = 2; group.add(foam);
  // ── jumping fish + splash rings + droplets ──
  const fish = fishMesh('rainbow'); fish.scale.setScalar(0.5); fish.visible = false; group.add(fish);
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }); const rings = [];
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 24).rotateX(-Math.PI / 2), ringM.clone()); r.visible = false; group.add(r); rings.push(r); }
  const DN = 12; const dp = new Float32Array(DN * 3); const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); const dv = [];
  const drops = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xeaf6ff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false })); drops.visible = false; drops.frustumCulled = false; group.add(drops);
  let jumpT = 6 + Math.random() * 8, jump = null, splashT = -1, sx = 0, sz = 0;
  function splash(x, z) { sx = x; sz = z; splashT = 0; rings.forEach((r, i) => { r.position.set(x, WATER_Y + 0.03, z); r.userData.t = -i * 0.2; r.visible = true; }); for (let i = 0; i < DN; i++) { const a = Math.random() * TAU, s = 0.6 + Math.random() * 1.2; dv[i] = [Math.cos(a) * s, 2 + Math.random() * 2, Math.sin(a) * s]; dp.set([x, WATER_Y, z], i * 3); } drops.visible = true; }
  function spot() { for (let k = 0; k < 20; k++) { const th = Math.random() * TAU; const r = islandRadius(th) + skirtD(th) + 3 + Math.random() * 10; const x = Math.cos(th) * r, z = Math.sin(th) * r; if (Math.abs(x - riverX(z)) < riverW(z) - 4 && islandSurfH(x, z) < WATER_Y - 0.6) return [x, z, th]; } return null; }
  // ── night reflections: a glow streak on the water for each light that sits near the shore ──
  const streakM = new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float a = (1.0 - abs(vUv.x - 0.5) * 2.0); a = a * a * smoothstep(0.0, 0.85, vUv.y) * (1.0 - smoothstep(0.93, 1.0, vUv.y)); a *= 0.75 + 0.25 * sin(vUv.y * 40.0); gl_FragColor = vec4(vec3(1.0, 0.68, 0.32) * a * uA, 1.0); }' });
  const streaks = []; const tmp = new THREE.Vector3();
  for (const L of lights) { if (streaks.length >= 5) break; const l = L.l || L; if (!l.getWorldPosition) continue; l.getWorldPosition(tmp); const th = Math.atan2(tmp.z, tmp.x); const R = islandRadius(th);
    const r0 = Math.hypot(tmp.x, tmp.z); if (r0 < R - 7) continue; let rw = null; for (let r = Math.max(r0, R - 1); r < R + skirtD(th) + 2; r += 0.2) if (islandSurfH(Math.cos(th) * r, Math.sin(th) * r) < WATER_Y - 0.05) { rw = r; break; } if (rw == null) continue;
    const g = new THREE.PlaneGeometry(0.9, 6).rotateX(-Math.PI / 2).translate(0, 0, 3); const m = new THREE.Mesh(g, streakM); m.position.set(Math.cos(th) * (rw + 0.3), WATER_Y + 0.04, Math.sin(th) * (rw + 0.3)); m.visible = false; m.renderOrder = 3; group.add(m); streaks.push({ m, l }); }
  function update(t, dt, night, camera) {
    FU.uT.value = t; FU.uN.value = night;
    // fish
    jumpT -= dt; if (jumpT < 0 && !jump) { jumpT = 7 + Math.random() * 12; const s = spot(); if (s) { jump = { t: 0, x: s[0], z: s[1], dx: -Math.sin(s[2]) * 1.6, dz: Math.cos(s[2]) * 1.6 }; fish.visible = true; splash(s[0], s[1]); } }
    if (jump) { jump.t += dt / 0.85; const k = jump.t; fish.position.set(jump.x + jump.dx * k, WATER_Y + Math.sin(Math.min(1, k) * Math.PI) * 1.0, jump.z + jump.dz * k); fish.rotation.set(0, Math.atan2(jump.dx, jump.dz) - Math.PI / 2, (0.5 - k) * 2.2);
      if (k >= 1) { splash(jump.x + jump.dx, jump.z + jump.dz); fish.visible = false; jump = null; } }
    for (const r of rings) if (r.visible) { r.userData.t += dt; const u = r.userData.t; if (u < 0) continue; r.scale.setScalar(1 + u * 5); r.material.opacity = Math.max(0, 0.7 * (1 - u / 1.2)); if (u > 1.2) r.visible = false; }
    if (splashT >= 0) { splashT += dt; for (let i = 0; i < DN; i++) { const v = dv[i]; dp[i * 3] = sx + v[0] * splashT; dp[i * 3 + 1] = WATER_Y + v[1] * splashT - 4.9 * splashT * splashT; dp[i * 3 + 2] = sz + v[2] * splashT; } dg.attributes.position.needsUpdate = true; if (splashT > 0.8) { splashT = -1; drops.visible = false; } }
    // streaks: point the glow from the shore toward the camera, fade with night + light flicker
    streakM.uniforms.uA.value = night * (0.3 + 0.08 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.1));
    for (const s of streaks) { const on = night > 0.25 && s.l.intensity > 0.05; s.m.visible = on; if (on && camera) s.m.rotation.y = Math.atan2(camera.position.x - s.m.position.x, camera.position.z - s.m.position.z); }
  }
  return { update, group, splash, streaks };
}
