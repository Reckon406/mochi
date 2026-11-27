# Credits — third-party assets

Every model, texture and HDRI below is **CC0 1.0 (public domain)**, so no attribution is required. They're credited here anyway, with thanks.
Nothing here was paid for, and no account was needed to download any of it.

## 3D models (`public/models/{lo,hi}/*.glb`)
Rebuilt for the web with `tools/build-models.mjs`. That script thins the leaf cards, simplifies the meshes with meshoptimizer, converts textures to WebP, and applies meshopt compression. `lo` is the Medium tier and `hi` is High/Ultra.

| pack | in Mochi's world | source asset | author(s) | link |
|---|---|---|---|---|
| trees | ponderosa pines + Douglas firs (Pine 1–5) | Stylized Nature MegaKit [Standard] — `Pine_1..5` | Quaternius | https://quaternius.itch.io/stylized-nature-megakit |
| trees | cottonwoods + willows (Common Tree 1–5) | Stylized Nature MegaKit [Standard] — `CommonTree_1..5` | Quaternius | https://quaternius.com/packs/stylizednaturemegakit.html |
| trees | bushes (Medium+) | Stylized Nature MegaKit [Standard] — `Bush_Common_Flowers` | Quaternius | https://quaternius.com/packs/stylizednaturemegakit.html |
| trees | aspens | Tree Small 02 | Rico Cilliers / Poly Haven | https://polyhaven.com/a/tree_small_02 |
| rocks | mossy rocks, boulders | Rock Moss Set 01 | Kless Gyzen / Poly Haven | https://polyhaven.com/a/rock_moss_set_01 |
| rocks | scattered rocks + pebbles | Rock 07, Rock 09 | Jenelle van Heerden / Poly Haven | https://polyhaven.com/a/rock_07 · https://polyhaven.com/a/rock_09 |
| rocks | river boulders, rocks, pebbles | Stone 01 | Dario Barresi, Rico Cilliers / Poly Haven | https://polyhaven.com/a/stone_01 |
| wood | stumps | Tree Stump 01 | Rob Tuytel / Poly Haven | https://polyhaven.com/a/tree_stump_01 |
| wood | log bench, driftwood | Dead Tree Trunk, Dead Tree Trunk 02 | Rob Tuytel; Jenelle van Heerden, Rico Cilliers / Poly Haven | https://polyhaven.com/a/dead_tree_trunk · https://polyhaven.com/a/dead_tree_trunk_02 |
| props | campfire ring | Stone Fire Pit | Sebastian Platen / Poly Haven | https://polyhaven.com/a/stone_fire_pit |
| props | crates | Wooden Crate 02 | James Ray Cock, Jurita Burger / Poly Haven | https://polyhaven.com/a/wooden_crate_02 |
| props | barrels | Wine Barrel 01 | James Ray Cock / Poly Haven | https://polyhaven.com/a/wine_barrel_01 |
| props | dock bucket | Wooden Bucket 01 | James Ray Cock / Poly Haven | https://polyhaven.com/a/wooden_bucket_01 |

## Treehouse cottonwood bark (`public/tex/bark_c_*.webp`, `bark_n_*.webp`)
The colour and normal maps of Bark Brown 02 (Rob Tuytel / Poly Haven, CC0, https://polyhaven.com/a/bark_brown_02), resized to 512 px (Medium) and 1024 px (High/Ultra). The tree's shape and its painted leaf sprays are procedural (`src/bigtree.js`).

## AI-generated textures (`public/tex/ai/`)
These were generated with an AI image model on Corey's request (Nov 2026) for surfaces that CC0 packs didn't cover: hut thatch, the hut's log wall, cabin/shop board siding, roof shingles, deck planks, weathered fence/dock wood, the sign-board grain, the riverbank dry-grass/cobble ground, and the 360° mountain ring (Bitterroot crest, Trapper Peak-like pyramid, Sapphire Range). They aren't from any third-party asset pack. `tools/aitex.py` seam-fixed them, flattened their lighting, and derived the normal and roughness maps. The sources stay on the build box (`ai-tex-src/`, gitignored), and `ai-tex-src/WANTED.md` lists what was asked for.

`public/tex/water_n.webp` (river ripple normal map) was generated procedurally by a script (a sum of periodic sine waves); it is not from any asset pack.

River reflections, ripple rings, morning haze cards, wet-ground puddles and snow cover are procedural shaders in `src/water.js`, `src/sky.js`, `src/weather.js` and `src/pbr.js`. Cloud cards and their wispy alpha map are generated at runtime in `src/weather.js` — no extra third-party assets.

## HDRIs (`public/hdri/*.hdr`)
These were downscaled to 256 px (Medium) and 512 px (High/Ultra), with the sun disc clipped, because the scene keeps its own sun.

| file | source | author(s) | link |
|---|---|---|---|
| `day_*.hdr` | Kloofendal 48d Partly Cloudy (Pure Sky) | Greg Zaal, Jarod Guest / Poly Haven | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky |
| `golden_*.hdr` | Qwantani Late Afternoon (Pure Sky) | Greg Zaal, Jarod Guest / Poly Haven | https://polyhaven.com/a/qwantani_late_afternoon_puresky |

## Ground / bark / wood detail textures (`public/tex/*.webp`, gfx pass 2)
- Leafy Grass (Charlotte Baglioni)
- Forest Ground 01 (Rob Tuytel)
- Coast Sand 01
- Rocky Terrain 02
- Bark Brown 02
- Wood Planks

All of these are from Poly Haven: https://polyhaven.com/textures

## Mochi model
- `public/models/mochi.glb`: AI-generated 3D model of Mochi (image-to-3D with Microsoft TRELLIS, from Corey's Mochi reference), optimized with glTF-Transform (meshopt + WebP). The original procedural Mochi stays in `src/mochi.js` as the Classic style and the fallback.
- `public/models/girlkiwi.glb`: AI-generated 3D model of the girl kiwi across the river (image-to-3D with Microsoft TRELLIS from an AI reference image), optimized with glTF-Transform (meshopt + WebP). Her cottage, nest, rowboat and wake are procedural.
- `public/models/cat.glb`: AI-generated 3D model of Mochi's pet cat (image-to-3D with Microsoft TRELLIS), optimized with glTF-Transform (meshopt + WebP). The other pet kinds (pika, chipmunk, bunny, hedgehog) are procedural.
- `public/models/squirrel.glb`: AI-generated 3D model of the rival squirrel (image-to-3D with Microsoft TRELLIS), simplified and optimized with glTF-Transform (meshopt + WebP, 512px). The original procedural squirrel in `src/creatures.js` is the Classic style (Settings → Squirrel style, or `?squirrel=classic`) and the fallback.
- `public/models/plane.glb`: AI-generated 3D model of Mochi's chubby bush floatplane (image-to-3D with Microsoft TRELLIS from a studio reference), optimized with glTF-Transform (meshopt + WebP). The procedural plane in `src/plane.js` stays as the fallback; the propeller is procedural so it can spin.
- `public/models/wildlife/`: AI-generated 3D models of Bitterroot wildlife (image-to-3D with Microsoft TRELLIS from AI reference images), simplified and optimized with glTF-Transform (meshopt + WebP, 512px). Species with TRELLIS models: coyote, red fox, porcupine, elk, bighorn sheep, mountain goat, beaver, river otter, raccoon, striped skunk, wild turkey, black-billed magpie, Steller's jay, osprey, bald eagle, great blue heron, great horned owl, mountain whitefish, largescale sucker, brook trout, gray wolf, snowshoe hare, Canada goose, mallard, and little brown bat. Procedural stand-ins in `src/wildlife.js`, `src/critters.js`, `src/creatures.js` and `src/fish.js` stay as the Classic style and the fallback. TRELLIS is MIT-licensed.

## Licences
- Poly Haven assets: CC0. See https://polyhaven.com/license
- Quaternius Stylized Nature MegaKit: CC0. See `License_Standard.txt` in the pack.
