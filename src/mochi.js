// Mochi the kiwi: procedural, soft, fluffy, very round
import * as THREE from 'three';
import { furTextures, softDot, stripes, canvasTex } from './textures.js';
import { rng } from './noise.js';

const BODY_R = 0.55;
const BODY_C = new THREE.Vector3(0, 0.6, 0);
const BODY_S = new THREE.Vector3(1.0, 0.9, 1.06);
// point on the body surface in a given direction (body local)
function surf(dir, push = 0) {
  const d = dir.clone().normalize();
  return new THREE.Vector3(d.x * BODY_S.x, d.y * BODY_S.y, d.z * BODY_S.z).multiplyScalar(BODY_R + push).add(BODY_C);
}

export function createMochi(outfit = '') {
  const o = outfit.toLowerCase();
  const root = new THREE.Group(); root.name = 'mochi';
  const pivot = new THREE.Group(); root.add(pivot); // squash/stretch + waddle (origin at feet)
  const fur = furTextures();
  const furMat = new THREE.MeshPhysicalMaterial({ color: 0xf0b884, map: fur.map, normalMap: fur.normalMap, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.92, sheen: 1, sheenColor: new THREE.Color(0xffdcb4), sheenRoughness: 0.5 });
  fur.map.repeat.set(3, 2); fur.normalMap.repeat.set(3, 2);

  const body = new THREE.Mesh(new THREE.SphereGeometry(BODY_R, 64, 48), furMat);
  body.position.copy(BODY_C); body.scale.copy(BODY_S); body.castShadow = true; body.receiveShadow = false; // self-shadowing from wings/beak looked blocky at this shadow resolution body.name = 'mochi-body';
  pivot.add(body);

  // fluffy silhouette: soft tufts over the back + top (not on the face)
  const r = rng(5); const tuftGeo = new THREE.SphereGeometry(1, 16, 12);
  const tufts = new THREE.InstancedMesh(tuftGeo, furMat, 26); let k = 0; const m4 = new THREE.Matrix4();
  for (let i = 0; i < 600 && k < 26; i++) {
    const d = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); if (d.lengthSq() > 1) continue; d.normalize();
    if (d.z > 0.35 && d.y > -0.4) continue; // keep the face clear
    if (d.y < 0.25) continue;
    const p = surf(d, -0.045); const sz = 0.05 + r() * 0.035;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d.x * 0.6, d.y + 0.6, d.z * 0.6).normalize());
    m4.compose(p, q, new THREE.Vector3(sz * 1.3, sz * 1.15, sz * 1.3)); tufts.setMatrixAt(k++, m4);
  }
  tufts.count = 0; // (tried fluff tufts; the smooth sheen body reads cuter)

  // cheeky head tuft (ahoge)
  const tuftCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, 0.12, 0.02), new THREE.Vector3(0.09, 0.2, -0.02), new THREE.Vector3(0.14, 0.17, -0.06)]);
  const ahoge = new THREE.Mesh(new THREE.TubeGeometry(tuftCurve, 16, 0.028, 8), new THREE.MeshStandardMaterial({ color: 0x7a5235, roughness: 0.9 }));
  ahoge.position.copy(surf(new THREE.Vector3(0, 1, 0.35), -0.03)); pivot.add(ahoge);

  // eyes — big, glossy, with two sparkles
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x1b0f0a, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.95, 0.95) });
  const eyes = [];
  for (const sx of [-1, 1]) {
    const dir = new THREE.Vector3(0.4 * sx, 0.3, 0.87);
    const g = new THREE.Group(); g.position.copy(surf(dir, -0.02));
    g.lookAt(g.position.clone().add(new THREE.Vector3(dir.x * 0.6, dir.y * 0.4, 1)));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.135, 32, 24), eyeMat); eye.scale.set(0.92, 1.1, 0.72); g.add(eye);
    const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), sparkMat); s1.position.set(0.03 * sx, 0.045, 0.085); g.add(s1);
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), sparkMat); s2.position.set(-0.035 * sx, -0.04, 0.084); g.add(s2);
    pivot.add(g); eyes.push(g);
  }
  // rosy blush
  const blushMat = new THREE.MeshBasicMaterial({ map: softDot('#ff7f96'), transparent: true, opacity: 0.75, depthWrite: false });
  for (const sx of [-1, 1]) {
    const dir = new THREE.Vector3(0.62 * sx, 0.08, 0.78); const p = surf(dir, 0.006);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.12), blushMat); b.position.copy(p);
    b.lookAt(p.clone().add(new THREE.Vector3(dir.x, dir.y, dir.z * 1.0)));
    pivot.add(b);
  }
  // long thin curved beak
  const BL = 0.82; const beakGeo = new THREE.CylinderGeometry(0.013, 0.058, BL, 18, 24, false); beakGeo.translate(0, BL / 2, 0); beakGeo.rotateX(Math.PI / 2);
  { const p = beakGeo.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); const t = z / BL; p.setY(i, p.getY(i) - 0.22 * t * t); } beakGeo.computeVertexNormals(); }
  const beak = new THREE.Mesh(beakGeo, new THREE.MeshStandardMaterial({ color: 0xd9a77a, roughness: 0.45 }));
  beak.position.copy(surf(new THREE.Vector3(0, 0.02, 1), -0.06)); beak.rotation.x = 0.2; beak.castShadow = true; pivot.add(beak);

  // tiny wings
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Group(); w.position.copy(surf(new THREE.Vector3(sx, 0.15, -0.1), -0.05));
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), furMat); m.scale.set(0.35, 0.8, 1.0); m.position.set(0.03 * sx, -0.06, 0); m.rotation.x = 0.4;
    m.castShadow = true; w.add(m); pivot.add(w); wings.push(w);
  }

  // legs + three-toed feet
  const legMat = new THREE.MeshStandardMaterial({ color: 0xe9a679, roughness: 0.6 });
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0.19 * sx, 0.2, 0.04); root.add(leg);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 4, 10), legMat); shin.position.y = -0.1; leg.add(shin);
    for (const a of [-0.55, 0, 0.55]) {
      const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.12, 4, 8), legMat); toe.rotation.x = Math.PI / 2; toe.rotation.y = a;
      toe.position.set(Math.sin(a) * 0.07, -0.19, Math.cos(a) * 0.07 + 0.02); toe.castShadow = true; leg.add(toe);
    }
    shin.castShadow = true; legs.push(leg);
  }

  // ── outfit ──
  const extras = {};
  if (/sock|scarf/.test(o)) {
    const tex = stripes(['#e8463c', '#fff4e0', '#e8463c', '#fff4e0', '#f2b33d', '#fff4e0'], 12, true, 256, 32); tex.repeat.set(3, 1);
    const smat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide });
    // a snug collar that hugs the body: dips under the beak in front, rides up the back
    const pts = []; for (let i = 0; i < 48; i++) { const ph = (i / 48) * Math.PI * 2; pts.push(surf(new THREE.Vector3(Math.sin(ph), -0.1 - 0.24 * Math.cos(ph), Math.cos(ph)), 0.03)); }
    const scarf = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.062, 12, true), smat);
    tex.repeat.set(4, 1); scarf.castShadow = true; pivot.add(scarf);
    // dangling sock toe
    const tail = new THREE.Group(); tail.position.copy(surf(new THREE.Vector3(0.5, -0.36, 0.8), 0.07));
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), smat); knot.position.copy(surf(new THREE.Vector3(0.45, -0.3, 0.84), 0.06)); knot.scale.set(1.1, 0.85, 0.8); pivot.add(knot); pivot.add(tail);
    const tmat = new THREE.MeshStandardMaterial({ map: stripes(['#e8463c', '#fff4e0'], 6, false, 32, 128), roughness: 0.95 });
    const sock = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 6, 12), tmat); sock.position.y = -0.12; tail.add(sock);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf2b33d, roughness: 0.95 })); toe.position.set(0, -0.26, 0.03); tail.add(toe);
    tail.rotation.z = 0.35; extras.sock = tail;
  }
  if (/cape|leaf/.test(o)) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0.05); sh.bezierCurveTo(0.42, -0.05, 0.46, -0.55, 0, -0.95); sh.bezierCurveTo(-0.46, -0.55, -0.42, -0.05, 0, 0.05);
    const g = new THREE.ShapeGeometry(sh, 24);
    const p = g.attributes.position; const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, 1.5 * x * x + 0.12 * y * y); uv.setXY(i, x / 0.92 + 0.5, -y / 1.0); }
    g.computeVertexNormals();
    const leafTex = canvasTex(256, 256, (cg, w, h) => {
      const gr = cg.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ffb43a'); gr.addColorStop(0.5, '#f07a1e'); gr.addColorStop(1, '#c9461a');
      cg.fillStyle = gr; cg.fillRect(0, 0, w, h);
      cg.strokeStyle = 'rgba(255,220,140,0.85)'; cg.lineWidth = 5; cg.beginPath(); cg.moveTo(w / 2, 0); cg.lineTo(w / 2, h); cg.stroke();
      cg.lineWidth = 2.5; for (let i = 1; i < 7; i++) { const y = i * h / 7.5; for (const s of [-1, 1]) { cg.beginPath(); cg.moveTo(w / 2, y); cg.quadraticCurveTo(w / 2 + s * 40, y + 10, w / 2 + s * 100, y + 34); cg.stroke(); } }
    });
    const cape = new THREE.Group(); cape.position.set(0, 0.92, -0.42); pivot.add(cape);
    const leaf = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.7, side: THREE.DoubleSide }));
    leaf.rotation.x = 0.55; leaf.position.z = -0.04; leaf.scale.setScalar(1.05); leaf.castShadow = true; cape.add(leaf);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.14, 6), new THREE.MeshStandardMaterial({ color: 0x8a4a1a })); stem.position.set(0, 0.08, -0.06); stem.rotation.x = -0.4; cape.add(stem);
    extras.cape = cape; extras.leaf = leaf;
  }
  if (/hat|witch/.test(o)) {
    const hat = new THREE.Group(); hat.position.copy(surf(new THREE.Vector3(0, 1, -0.15), -0.04)); hat.rotation.set(-0.15, 0, 0.18); pivot.add(hat);
    const hm = new THREE.MeshStandardMaterial({ color: 0x3b2a5a, roughness: 0.8 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 32), hm); hat.add(brim);
    const coneGeo = new THREE.ConeGeometry(0.22, 0.55, 24, 8); const cp = coneGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) { const y = cp.getY(i) + 0.275; cp.setX(i, cp.getX(i) - 0.25 * Math.pow(y / 0.55, 2.5)); } coneGeo.computeVertexNormals();
    const cone = new THREE.Mesh(coneGeo, hm); cone.position.y = 0.28; cone.castShadow = true; hat.add(cone);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.215, 0.06, 24), new THREE.MeshStandardMaterial({ color: 0xf2a63d })); band.position.y = 0.05; hat.add(band);
    extras.hat = hat;
  }

  // invisible, generous hit target for clicks/taps
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.6; hit.name = 'mochi-hit'; root.add(hit);

  // ── animation state ──
  const anim = { t: 0, walk: 0, walkPhase: 0, hop: -1, hopDur: 0.62, hopH: 0.7, flap: 0, blinkT: 2, blink: 0, look: 0, lookT: 0 };
  function hop(h = 0.7) { if (anim.hop < 0) { anim.hop = 0; anim.hopH = h; anim.flap = Math.max(anim.flap, 0.7); } }
  function flap(d = 0.9) { anim.flap = Math.max(anim.flap, d); }
  // things held in the beak (worm, fish, rod...) hang off `hold`; pose = activity animation knobs set by main
  const hold = new THREE.Group(); hold.position.set(0, 0.36, 1.22); pivot.add(hold);
  const pose = { peck: 0, sleep: 0, puff: 0, sway: 0 };
  const mods = { cold: 0, wet: 0, wind: 0, perk: 0 }; // set by main from weather + mood: the world gets to him
  let shake = 0;
  function update(dt, speed01 = 0) {
    anim.t += dt; const t = anim.t;
    anim.walk += (speed01 - anim.walk) * Math.min(1, dt * 8);
    anim.walkPhase += dt * 11 * anim.walk;
    const w = anim.walk;
    // idle breathing + bob
    let sy = 1 + 0.025 * Math.sin(t * 2.4) * (1 - w);
    let py = 0, rz = Math.sin(anim.walkPhase) * 0.13 * w, rx = 0.06 * w;
    py += Math.abs(Math.sin(anim.walkPhase)) * 0.06 * w;
    // cold: puffed + hunched + shivering. wet: the occasional full-body shake-off. wind: lean in. good mood: bouncy idle
    const idle = 1 - w;
    sy *= 1 - 0.07 * mods.cold * idle; rz += Math.sin(t * 57) * 0.018 * mods.cold * idle; rx += 0.07 * mods.wind + 0.05 * mods.cold * idle;
    if (mods.wet && shake <= 0 && anim.hop < 0 && Math.random() < dt * 0.09 * mods.wet) shake = 0.7;
    if (shake > 0) { shake -= dt; rz += Math.sin(shake * 45) * 0.16 * Math.min(1, shake * 3); }
    py += 0.035 * mods.perk * idle * Math.max(0, Math.sin(t * 6));
    rx += 0.45 * pose.peck * Math.max(0, Math.sin(t * 9)); sy *= 1 - 0.22 * pose.sleep; rx -= 0.12 * pose.sleep; rz += 0.12 * pose.sway * Math.sin(t * 4);
    const puff = 1 + 0.45 * pose.puff;
    // hop with anticipation / stretch / land squash
    let hopY = 0;
    if (anim.hop >= 0) {
      anim.hop += dt; const u = anim.hop / anim.hopDur;
      if (u < 0.18) { sy *= 1 - 0.22 * Math.sin((u / 0.18) * Math.PI / 2); }
      else if (u < 0.88) { const v = (u - 0.18) / 0.7; hopY = Math.sin(v * Math.PI) * anim.hopH; sy *= 1 + 0.16 * Math.cos(v * Math.PI); rx -= 0.1 * Math.sin(v * Math.PI); }
      else if (u < 1) { sy *= 1 - 0.18 * Math.sin(((u - 0.88) / 0.12) * Math.PI); }
      else anim.hop = -1;
    }
    pivot.scale.set(puff / Math.sqrt(sy), sy * puff, puff / Math.sqrt(sy));
    pivot.position.y = py + hopY; pivot.rotation.z = rz; pivot.rotation.x = rx;
    // legs
    legs[0].rotation.x = Math.sin(anim.walkPhase) * 0.7 * w; legs[1].rotation.x = -Math.sin(anim.walkPhase) * 0.7 * w;
    legs[0].position.y = 0.2 + hopY + Math.max(0, Math.sin(anim.walkPhase)) * 0.06 * w; legs[1].position.y = 0.2 + hopY + Math.max(0, -Math.sin(anim.walkPhase)) * 0.06 * w;
    if (anim.hop >= 0) { const tuck = Math.sin(Math.min(1, anim.hop / anim.hopDur) * Math.PI) * 0.6; legs[0].rotation.x = -tuck; legs[1].rotation.x = -tuck; }
    // wings
    anim.flap = Math.max(0, anim.flap - dt);
    const fa = anim.flap > 0 ? 0.4 + 0.9 * Math.abs(Math.sin(t * 28)) : (0.08 - 0.06 * mods.cold) + 0.05 * Math.sin(t * 3) + 0.15 * w * Math.abs(Math.sin(anim.walkPhase));
    wings[0].rotation.z = -fa; wings[1].rotation.z = fa;
    // blink
    anim.blinkT -= dt; if (anim.blinkT < 0) { anim.blink = 0.14; anim.blinkT = 1.8 + Math.random() * 3.5; if (Math.random() < 0.2) anim.blinkT = 0.25; }
    let ey = 1; if (anim.blink > 0) { anim.blink -= dt; ey = 0.12 + 0.88 * Math.abs((anim.blink / 0.14) * 2 - 1); }
    ey = Math.min(ey, 1 - 0.9 * pose.sleep); eyes.forEach((e) => (e.scale.y = ey));
    // outfit physics-ish
    if (extras.cape) extras.cape.rotation.x = 0.02 + 0.3 * w + 0.3 * Math.sin(Math.min(1, Math.max(0, anim.hop) / anim.hopDur) * Math.PI) + 0.06 * Math.sin(t * 3.1) + 0.04 * Math.sin(t * 7.3) * w;
    if (extras.sock) extras.sock.rotation.z = 0.35 + Math.sin(anim.walkPhase * 0.5) * 0.25 * w + 0.05 * Math.sin(t * 2);
  }
  return { root, pivot, hop, flap, update, anim, hit, mods, hold, pose, headOffset: 1.45 };
}
