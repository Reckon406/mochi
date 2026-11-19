// 🌑 soft blob / contact shadows: a dark radial decal under Mochi, the critters and the small props so they sit on the ground
// even where the sun's shadow map is coarse (Medium) or the shadow falls behind them. Cheap: one transparent quad each.
import * as THREE from 'three';
import { groundY } from './layout.js';

let TEX = null;
function blobTex() {
  if (TEX) return TEX; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); TEX = new THREE.CanvasTexture(c); return TEX;
}
const mk = (op) => new THREE.MeshBasicMaterial({ map: blobTex(), color: 0x000000, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true });

export function createBlobShadows(scene, { strength = 1 } = {}) {
  const group = new THREE.Group(); group.name = 'blob-shadows'; scene.add(group);
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); const dyn = []; const v = new THREE.Vector3();
  // follow a moving object: radius in metres, lifted objects fade + shrink
  function follow(obj, r = 0.6, op = 0.85) { if (!obj) return; const m = new THREE.Mesh(geo, mk(op * strength)); m.renderOrder = 1; m.frustumCulled = false; group.add(m); dyn.push({ obj, m, r, op: op * strength }); }
  // static spots [{x, z, r}]
  function statics(list, op = 0.7) { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mk(op * strength), list.length); const m4 = new THREE.Matrix4();
    list.forEach((s, i) => { m4.makeScale(s.r * 2, 1, s.r * 2).setPosition(s.x, groundY(s.x, s.z) + 0.025, s.z); im.setMatrixAt(i, m4); }); im.renderOrder = 1; group.add(im); }
  function update() { for (const d of dyn) { d.obj.getWorldPosition(v); const gy = groundY(v.x, v.z); const lift = Math.max(0, v.y - gy);
    const k = Math.max(0, 1 - lift / 2.5); d.m.visible = d.obj.visible !== false && k > 0.02; d.m.position.set(v.x, gy + 0.03, v.z); const s = d.r * 2 * (0.7 + 0.3 * k); d.m.scale.set(s, 1, s); d.m.material.opacity = d.op * k; } }
  return { group, follow, statics, update };
}
