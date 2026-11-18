// Rebuilds public/models/{lo,hi}/*.glb from the CC0 sources (see CREDITS.md). Not part of the site build.
// Setup (in a scratch dir, e.g. /tmp/ph):
//   python3 fetch-polyhaven.py tree_small_02 rock_moss_set_01 rock_07 rock_09 stone_01 tree_stump_01 dead_tree_trunk dead_tree_trunk_02 stone_fire_pit wooden_crate_02 wine_barrel_01 wooden_bucket_01
//   Quaternius Stylized Nature MegaKit [Standard] unzipped into ./qt (glTF/ folder) from https://quaternius.itch.io/stylized-nature-megakit
//   npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp
//   node build-models.mjs [trees|rocks|wood|props]   (writes into /workspace/mochi3d/public/models; edit OUT paths if needed)
// Builds Mochi's CC0 model packs: public/models/{lo,hi}/{trees,rocks,wood,props}.glb
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, quantize, meshopt, flatten, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp'; import fs from 'fs';
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
let seed = 7; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function thin(prim, keep, maxScale) {
  const idxA = prim.getIndices(); const idx = idxA.getArray(); const pos = prim.getAttribute('POSITION'); const n = pos.getCount();
  const par = new Int32Array(n).map((_, i) => i); const f = (x) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  for (let i = 0; i < idx.length; i += 3) { const a = f(idx[i]), b = f(idx[i + 1]), c = f(idx[i + 2]); par[b] = a; par[f(c)] = a; }
  const keepC = new Map(); const out = [];
  for (let i = 0; i < idx.length; i += 3) { const c = f(idx[i]); if (!keepC.has(c)) keepC.set(c, R() < keep); if (keepC.get(c)) out.push(idx[i], idx[i + 1], idx[i + 2]); }
  const s = Math.min(maxScale, 1 / Math.sqrt(keep)); const cen = new Map(); const v = [0, 0, 0];
  for (let i = 0; i < n; i++) { const c = f(i); if (!keepC.get(c)) continue; pos.getElement(i, v); const e = cen.get(c) || [0, 0, 0, 0]; e[0] += v[0]; e[1] += v[1]; e[2] += v[2]; e[3]++; cen.set(c, e); }
  for (let i = 0; i < n; i++) { const c = f(i); if (!keepC.get(c)) continue; const e = cen.get(c); pos.getElement(i, v); const cx = e[0] / e[3], cy = e[1] / e[3], cz = e[2] / e[3]; pos.setElement(i, [cx + (v[0] - cx) * s, cy + (v[1] - cy) * s, cz + (v[2] - cz) * s]); }
  idxA.setArray(n > 65535 ? new Uint32Array(out) : new Uint16Array(out));
}
const tris = (doc) => doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices() ? p.getIndices().getCount() / 3 : 0), 0), 0);
async function load(key, src, o) {
  seed = 7; const doc = await io.read(src.endsWith('.gltf') ? src : `${src}/${src}.gltf`);
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) if (o.leafKeep && /leaves|twig/i.test(p.getMaterial()?.getName() || '')) thin(p, o.leafKeep, o.leafMaxScale || 2.4);
  for (const mt of doc.getRoot().listMaterials()) { for (const e of ['KHR_materials_specular', 'KHR_materials_ior']) mt.setExtension(e, null);
    if (/leaves|leaf|twig/i.test(mt.getName()) && mt.getAlphaMode() !== 'OPAQUE') { mt.setAlphaMode('MASK'); mt.setAlphaCutoff(0.45); }
    if (o.dropRough) { mt.setMetallicRoughnessTexture(null); mt.setMetallicFactor(0); mt.setRoughnessFactor(0.9); } }
  const t0 = tris(doc);
  await doc.transform(flatten(), prune(), dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: o.ratio ?? 1, error: o.error ?? 0.002, lockBorder: false }), prune());
  const nodes = doc.getRoot().getDefaultScene().listChildren().filter((n) => n.getMesh());
  nodes.forEach((n, i) => n.setName(o.split ? `${key}_${i}` : nodes.length > 1 ? `${key}#${i}` : key));
  console.log('  ', key, 'tris', t0, '->', tris(doc)); return doc;
}
async function pack(name, tier, list, tex) {
  const base = new Document(); 
  for (const [key, src, o] of list) mergeDocuments(base, await load(key, src, o));
  const scenes = base.getRoot().listScenes(); const s0 = scenes[0];
  for (const s of scenes.slice(1)) { for (const n of s.listChildren()) { s.removeChild(n); s0.addChild(n); } s.dispose(); }
  base.getRoot().setDefaultScene(s0);
  await base.transform(unpartition(), dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 80 }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = `/workspace/mochi3d/public/models/${tier}/${name}.glb`; fs.mkdirSync(`/workspace/mochi3d/public/models/${tier}`, { recursive: true }); await io.write(out, base);
  console.log(name, tier, 'tris', tris(base), (fs.statSync(out).size / 1024).toFixed(0) + 'KB', 'nodes', s0.listChildren().map((n) => n.getName()).join(','));
}
const Q = (n) => `qt/glTF/${n}.gltf`;
const PACKS = {
  trees: (hi) => [...[1, 2, 3, 4, 5].map((i) => [`pine${i}`, Q(`Pine_${i}`), {}]), ...[1, 2, 3, 4, 5].map((i) => [`common${i}`, Q(`CommonTree_${i}`), {}]),
    ['aspen', 'tree_small_02', hi ? { leafKeep: 0.045, leafMaxScale: 3.0, ratio: 0.08, error: 0.02 } : { leafKeep: 0.03, leafMaxScale: 3.2, ratio: 0.05, error: 0.03 }]],
  rocks: (hi) => [['moss', 'rock_moss_set_01', { split: true, ratio: hi ? 0.25 : 0.1, error: hi ? 0.004 : 0.01, dropRough: !hi }], ['rock07', 'rock_07', { ratio: hi ? 0.25 : 0.08, error: hi ? 0.004 : 0.01, dropRough: !hi }],
    ['rock09', 'rock_09', { ratio: hi ? 0.25 : 0.08, error: hi ? 0.004 : 0.01, dropRough: !hi }], ['stone01', 'stone_01', { ratio: hi ? 0.08 : 0.03, error: hi ? 0.004 : 0.01, dropRough: !hi }],
    ['peb7', 'rock_07', { ratio: 0.012, error: 0.05, dropRough: true }], ['peb9', 'rock_09', { ratio: 0.012, error: 0.05, dropRough: true }], ['pebS', 'stone_01', { ratio: 0.004, error: 0.05, dropRough: true }]],
  wood: (hi) => [['stump', 'tree_stump_01', { ratio: hi ? 0.12 : 0.05, error: hi ? 0.004 : 0.01, dropRough: !hi }], ['log', 'dead_tree_trunk', { ratio: hi ? 0.06 : 0.02, error: hi ? 0.004 : 0.01, dropRough: !hi }],
    ['log2', 'dead_tree_trunk_02', { ratio: hi ? 0.05 : 0.02, error: hi ? 0.004 : 0.01, dropRough: !hi }]],
  props: (hi) => [['firepit', 'stone_fire_pit', { ratio: hi ? 1 : 0.5, dropRough: !hi }], ['crate', 'wooden_crate_02', { ratio: hi ? 1 : 0.5, dropRough: !hi }], ['barrel', 'wine_barrel_01', { ratio: hi ? 0.8 : 0.3, dropRough: !hi }], ['bucket', 'wooden_bucket_01', { ratio: hi ? 0.8 : 0.3, dropRough: !hi }]],
};
const TEX = { trees: [512, 1024], rocks: [512, 1024], wood: [256, 512], props: [256, 512] };
const only = process.argv.slice(2);
for (const [name, f] of Object.entries(PACKS)) { if (only.length && !only.includes(name)) continue; await pack(name, 'lo', f(false), TEX[name][0]); await pack(name, 'hi', f(true), TEX[name][1]); }
