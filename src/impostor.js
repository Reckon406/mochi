// 🌲 runtime impostors: bakes a unit-height glTF tree (front + side view) into two small RGBA render targets, then draws thousands
// of far trees as instanced crossed quads. Used for the foothill pines and river-bank cottonwoods so the far banks match the
// Quaternius trees on the island without paying their triangle cost. Baked once at load; nothing is downloaded.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function bakeImpostor(renderer, parts, { res = 256, env = null, matFor = (m) => m } = {}) {
  const sc = new THREE.Scene(); sc.environment = env; const box = new THREE.Box3();
  for (const { geo, mat } of parts) { const m = new THREE.Mesh(geo, matFor(mat)); sc.add(m); geo.computeBoundingBox(); box.union(geo.boundingBox); }
  sc.add(new THREE.AmbientLight(0xffffff, 0.9)); const d = new THREE.DirectionalLight(0xfff4e0, 1.1); d.position.set(0.4, 1, 0.7); sc.add(d);
  const half = Math.max(0.08, Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)) * 1.04, top = box.max.y * 1.02;
  const cam = new THREE.OrthographicCamera(-half, half, top, 0, 0.01, 20);
  const prevRT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevSM = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false;
  const tex = [[0, 0, 5], [5, 0, 0]].map(([x, y, z]) => {
    const rt = new THREE.WebGLRenderTarget(res / 2, res, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    cam.position.set(x, top / 2, z); cam.lookAt(0, top / 2, 0); cam.updateMatrixWorld();
    renderer.setRenderTarget(rt); renderer.setClearColor(0x2c3a24, 0); renderer.clear(); renderer.render(sc, cam); return rt.texture; });
  renderer.setRenderTarget(prevRT); renderer.setClearColor(prevC, prevA); renderer.shadowMap.autoUpdate = prevSM;
  // crossed quads: XY plane (front view) + ZY plane (side view), normals tipped up so the sun lights them evenly
  const qa = new THREE.PlaneGeometry(half * 2, top).translate(0, top / 2, 0), qb = qa.clone().rotateY(Math.PI / 2);
  for (const q of [qa, qb]) { const n = q.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.35, 0.94, n.getZ(i) * 0.35); }
  const geo = mergeGeometries([qa, qb], true);
  const mats = tex.map((t) => new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.42, side: THREE.DoubleSide }));
  return { geo, mats, top };
}

// instanced impostor field from a list of { m4 (unit-height tree transform), c (Color) }
export function impostorMesh(imp, list) {
  const im = new THREE.InstancedMesh(imp.geo, imp.mats, Math.max(1, list.length)); im.count = list.length;
  list.forEach(({ m4, c }, i) => { im.setMatrixAt(i, m4); im.setColorAt(i, c); });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.castShadow = false; im.receiveShadow = false;
  im.computeBoundingSphere(); im.frustumCulled = false; im.name = 'impostors'; return im;
}
