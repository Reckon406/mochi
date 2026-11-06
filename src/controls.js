// Walk mode: WASD + mouse look (pointer lock, or click-drag if lock is refused). Orbit stays in main.js.
import * as THREE from 'three';
import { islandSurfH, isletSurfH, rockH, bridgeParam, bridgeYt, OBSTACLES, WATER_Y } from './layout.js';

const EYE = 1.75, SPEED = 4.2, SPRINT = 2.0, BODY_R = 0.35, MAP_R = 40, PITCH_MAX = 1.45, SENS = 0.0022;
const KEYS = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };

// standing height incl. bridge, islet, gravel bars and river boulders; null = water
export function walkH(x, z) {
  if (Math.hypot(x, z) > MAP_R) return null;
  const bp = bridgeParam(x, z);
  if (bp.t > 0 && bp.t < 1 && Math.abs(bp.lat) < 1.0) return bridgeYt(bp.t);
  const surf = Math.max(islandSurfH(x, z), isletSurfH(x, z), rockH(x, z));
  if (surf < WATER_Y + 0.08) return null; // river: wade in up to the ankles, no further
  return surf;
}

export function createWalk({ camera, dom, isOpen = () => false, onChange = () => {} }) {
  const pos = new THREE.Vector3(), held = new Set(); const hint = document.createElement('div'); hint.className = 'walk-hint';
  hint.textContent = 'WASD move · shift sprint · space hop · click look · Esc unlock'; document.getElementById('app').appendChild(hint);
  let on = false, yaw = 0, pitch = 0, vy = 0, air = 0, bob = 0, hintT = 0, drag = null;
  const locked = () => document.pointerLockElement === dom;

  function pushOut(x, z) {
    for (const o of OBSTACLES) { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), m = o.r + BODY_R;
      if (d < m) { if (d < 1e-4) { x += m; continue; } x = o.x + (dx / d) * m; z = o.z + (dz / d) * m; } }
    return [x, z];
  }
  function spawn() {
    const c = camera.position; let x = c.x, z = c.z;
    if (walkH(x, z) == null) { // walk the camera->island-centre line until we hit land, then step 2m further in
      const L = Math.hypot(x, z) || 1; let r = Math.min(L, MAP_R);
      while (r > 0 && walkH((x / L) * r, (z / L) * r) == null) r -= 0.5;
      r = Math.max(0, r - 2); x = (x / L) * r; z = (z / L) * r;
    }
    [x, z] = pushOut(x, z); if (walkH(x, z) == null) { x = -1.5; z = 4.5; }
    pos.set(x, walkH(x, z), z);
    const d = new THREE.Vector3(); camera.getWorldDirection(d); yaw = Math.atan2(-d.x, -d.z); pitch = THREE.MathUtils.clamp(Math.asin(d.y), -0.4, 0.2);
    vy = 0; air = 0;
  }
  function set(v) {
    if (v === on) return; on = v; held.clear(); drag = null;
    if (on) { spawn(); hintT = 6; hint.classList.add('show'); } else { hint.classList.remove('show'); if (locked()) document.exitPointerLock(); }
    document.body.classList.toggle('walking', on); onChange(on);
  }
  const look = (mx, my) => { yaw -= mx * SENS; pitch = THREE.MathUtils.clamp(pitch - my * SENS, -PITCH_MAX, PITCH_MAX); };

  addEventListener('keydown', (e) => {
    if (!on || isOpen() || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (KEYS[e.code]) { held.add(KEYS[e.code]); e.preventDefault(); }
    if (e.code === 'Space') { if (air <= 0) vy = 4.2; e.preventDefault(); }
    if (e.key === 'Shift') held.add('run');
  });
  addEventListener('keyup', (e) => { if (KEYS[e.code]) held.delete(KEYS[e.code]); if (e.key === 'Shift') held.delete('run'); });
  addEventListener('blur', () => held.clear());
  dom.addEventListener('click', () => { if (on && !locked() && dom.requestPointerLock) { try { const p = dom.requestPointerLock(); p?.catch?.(() => {}); } catch {} } });
  dom.addEventListener('pointerdown', (e) => { if (on && !locked()) drag = [e.clientX, e.clientY]; });
  addEventListener('pointerup', () => (drag = null));
  addEventListener('mousemove', (e) => {
    if (!on) return;
    if (locked()) look(e.movementX, e.movementY);
    else if (drag) { look(e.clientX - drag[0], e.clientY - drag[1]); drag = [e.clientX, e.clientY]; }
  });
  document.addEventListener('pointerlockchange', () => { if (on) hint.classList.toggle('show', !locked() || hintT > 0); });

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), mv = new THREE.Vector3();
  function update(dt) {
    if (!on) return;
    if (hintT > 0) { hintT -= dt; if (hintT <= 0 && locked()) hint.classList.remove('show'); }
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(-fwd.z, 0, fwd.x);
    mv.set(0, 0, 0);
    if (held.has('f')) mv.add(fwd); if (held.has('b')) mv.sub(fwd); if (held.has('r')) mv.add(right); if (held.has('l')) mv.sub(right);
    const moving = mv.lengthSq() > 0;
    if (moving) {
      mv.normalize().multiplyScalar(SPEED * (held.has('run') ? SPRINT : 1) * dt);
      const ok = (x, z) => { const h = walkH(x, z); if (h == null) return false; const h0 = walkH(pos.x, pos.z) ?? h; return air > 0.3 || (h - h0) / Math.hypot(x - pos.x, z - pos.z) < 2.2; }; // no scaling sheer cliff faces
      let x = pos.x + mv.x, z = pos.z; if (ok(x, z)) pos.x = x; // per axis = slide along shorelines
      x = pos.x; z = pos.z + mv.z; if (ok(x, z)) pos.z = z;
      [x, z] = pushOut(pos.x, pos.z); if (walkH(x, z) != null) { pos.x = x; pos.z = z; }
      bob += dt * (held.has('run') ? 14 : 9);
    }
    const g = walkH(pos.x, pos.z) ?? pos.y;
    vy -= 12 * dt; air = Math.max(0, air + vy * dt); if (air === 0) vy = Math.max(vy, 0);
    pos.y = THREE.MathUtils.lerp(pos.y, g, Math.min(1, dt * 14)); // smooth over little steps
    const b = moving && air === 0 ? Math.sin(bob) * 0.04 : 0;
    camera.position.set(pos.x, pos.y + EYE + air + b, pos.z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }
  return { get on() { return on; }, set, toggle: () => set(!on), update, get pos() { return pos; } };
}
