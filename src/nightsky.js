// Rare northern lights (cold, clear nights) + occasional shooting stars. Mochi looks up and logs them.
import * as THREE from 'three';

export function createNightSky(scene, { weather, season, mochi, say, log, force = null }) {
  const group = new THREE.Group(); group.name = 'night-sky'; scene.add(group);
  const cold = (weather.tempF != null ? weather.tempF <= 40 : season === 'winter' || season === 'fall');
  const clear = weather.cloudiness < 0.45 && !weather.rain && !weather.snow && !weather.fog;
  // one roll per calendar night so every visitor sees the same sky that night (~1 in 5 qualifying nights)
  const d = new Date(); const seed = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); const roll = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const auroraTonight = force === 'aurora' || (cold && clear && roll < 0.2);
  // ── aurora: curtains on a long curved strip far to the north, additive shader ──
  const U = { uT: { value: 0 }, uI: { value: 0 } };
  const geo = new THREE.PlaneGeometry(900, 140, 96, 1); { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, -Math.cos(x / 900 * Math.PI) * 160 + Math.sin(x * 0.012) * 30); } }
  const aur = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv; varying float vX; void main(){ vUv = uv; vX = position.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; uniform float uI; varying vec2 vUv; varying float vX;
      void main(){ float x = vX * 0.02; float rays = 0.55 + 0.45 * sin(x * 7.0 + uT * 0.7 + sin(x * 2.3 - uT * 0.4) * 2.0); rays *= 0.82 + 0.18 * sin(x * 17.0 - uT * 1.3 + sin(x * 5.1) * 3.0); rays *= 0.55 + 0.45 * sin(x * 0.9 + uT * 0.15);
        float y = vUv.y; float band = smoothstep(0.0, 0.18, y) * (1.0 - smoothstep(0.35, 1.0, y)); float edge = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x));
        vec3 col = mix(vec3(0.15, 1.0, 0.55), vec3(0.65, 0.3, 1.0), smoothstep(0.3, 0.95, y));
        gl_FragColor = vec4(col * rays * band * edge * uI * 0.7, 1.0); }` }));
  aur.position.set(0, 95, -420); aur.frustumCulled = false; aur.visible = false; aur.renderOrder = -1; group.add(aur);
  // ── shooting star: one streak mesh reused ──
  const sGeo = new THREE.PlaneGeometry(14, 0.35); sGeo.translate(-7, 0, 0);
  const star = new THREE.Mesh(sGeo, new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float a = pow(vUv.x, 3.0) * (1.0 - abs(vUv.y - 0.5) * 2.0); gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * a * uA, 1.0); }' }));
  star.visible = false; star.frustumCulled = false; group.add(star);
  let starT = force === 'star' ? 4 : 25 + Math.random() * 50, starFly = null, seenAurora = false, look = 0;
  const STAR = ['a SHOOTING STAR. wished for the ocean', 'shooting star! wished for a board. wait. i have one. wished for a seal then', 'did you see that?? a star fell. respectfully'];
  function lookUp(text) { look = 2.5; mochi.hop(0.5); mochi.flap(1); say(text, 3.2); }
  function update(t, dt, night, camera) {
    // aurora fades in after dark on its night
    const want = auroraTonight && night > 0.6 ? Math.min(1, (night - 0.6) / 0.3) : 0; U.uI.value += (want - U.uI.value) * Math.min(1, dt * 0.3); U.uT.value = t; aur.visible = U.uI.value > 0.01;
    if (aur.visible && U.uI.value > 0.5 && !seenAurora) { seenAurora = true; lookUp('NORTHERN LIGHTS. over the bitterroot. i am crying (again)'); log?.({ animal: 'northern lights', at: 'sky', outcome: 'saw them!' }); }
    if (night > 0.7 && weather.cloudiness < 0.6) { starT -= dt; if (starT < 0 && !starFly) { starT = 40 + Math.random() * 80;
        const a = Math.random() * 6.28; const p = new THREE.Vector3(Math.cos(a) * 220, 110 + Math.random() * 60, Math.sin(a) * 220); const dir = new THREE.Vector3(Math.cos(a + 1.6), -0.35, Math.sin(a + 1.6)).normalize();
        starFly = { t: 0, p, dir }; star.visible = true; if (Math.random() < 0.6) { lookUp(STAR[Math.floor(Math.random() * STAR.length)]); log?.({ animal: 'shooting star', at: 'sky', outcome: 'made a wish' }); } } }
    if (starFly) { starFly.t += dt; const k = starFly.t / 0.9; star.position.copy(starFly.p).addScaledVector(starFly.dir, k * 60); star.lookAt(star.position.clone().add(starFly.dir)); star.rotateY(-Math.PI / 2); star.material.uniforms.uA.value = Math.sin(Math.min(1, k) * Math.PI); if (k >= 1) { starFly = null; star.visible = false; } }
    if (look > 0) { look -= dt; mochi.pivot.rotation.x -= 0.28 * Math.min(1, look); }
  }
  return { update, group, get aurora() { return auroraTonight; } };
}
