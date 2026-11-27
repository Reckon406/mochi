// Procedural posing for static TRELLIS wildlife meshes.
// Drives the bone-free vertex-shader rig in wildmodels.js (leg/part weights).
// Movement speed drives gait. Cute, phone-friendly, a bit calmer on small/coarse screens.
import * as THREE from 'three';

const HOP = new Set(['turkey', 'magpie', 'jay']);
const HEAVY = new Set(['elk', 'bighorn', 'goat']);

function qualityAmp() {
  try {
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    const small = typeof innerWidth === 'number' && Math.min(innerWidth, innerHeight) < 700;
    return (coarse || small) ? 0.85 : 1;
  } catch { return 1; }
}

export function tick(root, dt, t, st = {}) {
  let w = root.userData.wild;
  if (!w) {
    root.traverse((o) => { if (!w && o.userData.wild) w = o.userData.wild; });
    if (!w) return;
  }
  if (!w.u || !w.loaded || (w.model && !w.model.visible)) { poseProc(w, dt, t, st); return; }
  poseRig(w, dt, t, st);
}

function poseProc(w, dt, t, st) {
  const proc = w.proc; if (!proc || !proc.visible) return;
  const speed = Math.max(0, st.speed || 0);
  const swim = !!st.swim || w.kind === 'fish';
  const moving = speed > 0.08;
  w.cyc = (w.cyc || 0) + dt * (st.fly ? 11 : swim ? 7 : moving ? 5 : 1);
  if (w.kind === 'fish' || (swim && w.kind !== 'bird')) {
    const kids = proc.children;
    const amp = (moving || swim ? 1 : 0.35) * 0.16;
    if (kids[0]) kids[0].rotation.y = Math.sin(w.cyc) * amp;
    if (kids[1]) kids[1].rotation.y = Math.sin(w.cyc + 0.6) * amp * 1.6;
  }
}

function poseRig(w, dt, t, st) {
  const kind = w.kind || 'quad';
  const key = w.key || '';
  const speed = Math.max(0, st.speed || 0);
  const moving = speed > 0.08;
  const swim = !!st.swim;
  const fly = !!st.fly;
  const drink = !!st.drink;
  const hop = !!st.hop || (HOP.has(key) && moving && !fly);
  const wade = !!st.wade;
  const owl = key === 'owl';
  const q = qualityAmp();

  const gait = fly ? (key === 'bat' || st.erratic ? 22 : 11)
    : swim ? (key === 'beaver' ? 5.5 : 7)
    : hop ? Math.min(10, 6 + speed * 2)
    : moving ? (HEAVY.has(key) ? Math.min(6, 2.2 + speed * 1.6) : Math.min(8, 3.2 + speed * 2.2))
    : 1;
  w.cyc += dt * gait;
  const cyc = w.cyc;

  // idle look / twitch (owl gets the big theatrical head turns)
  w.lookT -= dt;
  if (w.lookT < 0) {
    w.lookT = (owl ? 1.6 : 2.4) + Math.random() * (owl ? 3 : 4);
    w.lookY0 = w.lookY; w.lookX0 = w.lookX;
    w.lookY = st.headYaw != null ? st.headYaw : (owl ? (Math.random() * 2 - 1) * 1.5 : (Math.random() * 2 - 1) * 0.45);
    w.lookX = st.headPitch != null ? st.headPitch : (Math.random() * 0.25 - 0.08);
    if (Math.random() < 0.35) w.twitch = 1;
  }
  w.twitch = Math.max(0, w.twitch - dt * 3);
  const ease = 1 - Math.exp(-dt * 4);
  w._hy = (w._hy ?? 0) + ((st.headYaw != null ? st.headYaw : w.lookY) - (w._hy ?? 0)) * ease;
  w._hx = (w._hx ?? 0) + ((drink ? 0.55 : (st.headPitch != null ? st.headPitch : w.lookX)) - (w._hx ?? 0)) * ease;

  const u = w.u;
  u.uLegS.value.set(0, 0, 0, 0); u.uLegL.value.set(0, 0, 0, 0);
  u.uHead.value.set(w._hy, w._hx); u.uTail.value.set(0, 0); u.uWing.value.set(0, 0); u.uUnd.value.set(0, 0);

  const breath = Math.sin(t * 2.1 + cyc * 0.2) * 0.01 * q;
  let hopY = 0;

  if (kind === 'fish' || (kind === 'quad' && swim)) {
    const amp = (kind === 'fish' ? 0.05 : (key === 'beaver' ? 0.045 : 0.035)) * (moving || swim ? 1 : 0.35) * q;
    u.uUnd.value.set(t * (5 + Math.min(4, speed)) + cyc, amp);
    const tailAmp = key === 'beaver' ? 0.4 : 0.25;
    u.uTail.value.set(Math.sin(cyc * 1.4) * tailAmp * q, key === 'beaver' ? Math.sin(cyc * 0.7) * 0.12 : 0);
    if (kind === 'quad') {
      const paddle = Math.sin(cyc * 1.6) * (key === 'beaver' ? 0.45 : 0.55) * q;
      u.uLegS.value.set(paddle, -paddle, -paddle * 0.7, paddle * 0.7);
    }
    u.uHead.value.set(w._hy * 0.35, w._hx + Math.sin(cyc) * 0.06);
  } else if (kind === 'bird') {
    if (fly) {
      const erratic = key === 'bat' || !!st.erratic;
      w.glideT -= dt;
      if (w.glideT < 0) { w.gliding = !w.gliding; w.glideT = w.gliding ? 2 + Math.random() * 4 : 1 + Math.random() * 2.2; }
      if (erratic) {
        w.gliding = false;
        const fl = Math.sin(cyc * 2.2) * 0.85 * q;
        u.uWing.value.set(fl, fl * 0.8);
      } else if (st.glide || w.gliding) {
        const hold = 0.42 + Math.sin(t * 0.8 + cyc) * 0.04;
        u.uWing.value.set(hold, hold);
      } else {
        const fl = Math.sin(cyc) * 0.7 * q;
        u.uWing.value.set(fl, fl);
      }
      if (w.model) w.model.rotation.x = THREE.MathUtils.lerp(w.model.rotation.x, erratic ? -0.7 : -0.95, 1 - Math.exp(-dt * 3));
      u.uTail.value.set(Math.sin(t * 1.3 + cyc) * 0.08, 0);
      u.uHead.value.set(w._hy, w._hx - 0.15);
    } else if (swim) {
      if (w.model) w.model.rotation.x = THREE.MathUtils.lerp(w.model.rotation.x, 0, 1 - Math.exp(-dt * 4));
      const paddle = Math.sin(cyc * 1.3) * 0.22 * q;
      u.uLegS.value.set(0, 0, paddle, -paddle);
      u.uWing.value.set(0.04, 0.04);
      u.uHead.value.set(w._hy * 0.4, w._hx + Math.sin(cyc) * 0.06);
      u.uTail.value.set(Math.sin(cyc * 0.9) * 0.08, 0);
      hopY = Math.sin(t * 2.1 + cyc) * 0.012 * q;
    } else {
      if (w.model) w.model.rotation.x = THREE.MathUtils.lerp(w.model.rotation.x, 0, 1 - Math.exp(-dt * 4));
      if (hop) {
        const h = Math.abs(Math.sin(cyc));
        hopY = h * 0.08 * q;
        const tuck = h * 0.35;
        u.uLegS.value.set(0, 0, tuck, tuck);
        u.uLegL.value.set(0, 0, h * 0.03, h * 0.03);
        const flap = Math.sin(cyc * 2) * 0.16 * q;
        u.uWing.value.set(flap, flap);
        u.uHead.value.set(w._hy * 0.4, w._hx + Math.sin(cyc * 2) * 0.12);
        u.uTail.value.set(Math.sin(cyc) * 0.12, 0);
      } else if (moving) {
        const a = Math.sin(cyc), b = Math.sin(cyc + Math.PI);
        const lift = (key === 'heron' ? 0.07 : 0.04) * q;
        const swing = (key === 'heron' ? 0.7 : 0.55) * q;
        u.uLegS.value.set(0, 0, a * swing, b * swing);
        u.uLegL.value.set(0, 0, Math.max(0, Math.cos(cyc)) * lift, Math.max(0, Math.cos(cyc + Math.PI)) * lift);
        u.uHead.value.set(w._hy * 0.5, w._hx + Math.sin(cyc * 2) * (key === 'heron' ? 0.14 : 0.08) + (wade ? 0.15 : 0));
        u.uTail.value.set(Math.sin(cyc + 0.4) * 0.1, 0);
        const settle = Math.sin(t * 1.1 + cyc) * 0.04;
        u.uWing.value.set(settle, settle);
        hopY = Math.max(0, Math.sin(cyc * 2)) * 0.012 * q;
      } else if (wade) {
        u.uHead.value.set(w._hy * 0.3, w._hx + 0.25 + Math.sin(t * 1.4 + cyc) * 0.12);
        const sh = Math.sin(t * 0.8 + cyc) * 0.02;
        u.uLegL.value.set(0, 0, sh, -sh);
        u.uWing.value.set(0.02, 0.02);
        u.uTail.value.set(Math.sin(t * 1.1 + cyc) * 0.06, 0);
      } else {
        const settle = Math.sin(t * 1.1 + cyc) * 0.04 + (w.twitch ? Math.sin(t * 30) * 0.08 : 0);
        u.uWing.value.set(settle, settle);
        u.uTail.value.set(Math.sin(t * 1.3 + cyc) * 0.08, 0);
        u.uHead.value.set(w._hy, w._hx);
      }
    }
  } else if (hop) {
    const hgt = Math.abs(Math.sin(cyc));
    hopY = hgt * 0.14 * q;
    const tuck = hgt * 0.5;
    u.uLegS.value.set(tuck * 0.75, tuck * 0.75, tuck, tuck);
    u.uLegL.value.set(hgt * 0.02, hgt * 0.02, hgt * 0.03, hgt * 0.03);
    u.uHead.value.set(w._hy * 0.3, w._hx + Math.sin(cyc * 2) * 0.1);
    u.uTail.value.set(Math.sin(cyc) * 0.2 * q, 0);
  } else if (moving && !swim) {
    const a = Math.sin(cyc), b = Math.sin(cyc + Math.PI);
    const liftA = Math.max(0, Math.cos(cyc)) * 0.045 * q;
    const liftB = Math.max(0, Math.cos(cyc + Math.PI)) * 0.045 * q;
    const swing = (HEAVY.has(key) ? 0.48 : 0.55) * q;
    u.uLegS.value.set(a * swing, b * swing, b * swing * 0.9, a * swing * 0.9);
    u.uLegL.value.set(liftA, liftB, liftB, liftA);
    u.uHead.value.set(w._hy * 0.5, w._hx + Math.sin(cyc * 2) * 0.08);
    u.uTail.value.set(Math.sin(cyc + 0.5) * 0.4 * q, Math.sin(cyc * 0.5) * 0.08);
    hopY = Math.abs(Math.sin(cyc * 2)) * (HEAVY.has(key) ? 0.02 : 0.012) * q;
    if (w.model) w.model.rotation.z = THREE.MathUtils.lerp(w.model.rotation.z, a * 0.035 * q, 1 - Math.exp(-dt * 6));
  } else {
    u.uTail.value.set(Math.sin(t * 1.4 + cyc) * 0.16 + w.twitch * Math.sin(t * 18) * 0.25, Math.sin(t * 0.9) * 0.05);
    u.uHead.value.set(w._hy, w._hx + Math.sin(t * 1.7) * 0.03);
    const sh = Math.sin(t * 0.6 + cyc) * 0.015;
    u.uLegL.value.set(sh, -sh, -sh, sh);
    if (w.model) w.model.rotation.z = THREE.MathUtils.lerp(w.model.rotation.z, 0, 1 - Math.exp(-dt * 4));
  }

  if (w.model) {
    if (!fly) w.model.position.y = breath + hopY;
    else w.model.position.y = THREE.MathUtils.lerp(w.model.position.y, 0, 1 - Math.exp(-dt * 4));
  }
}
