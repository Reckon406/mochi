# AI textures wanted for Mochi's world

Drop each image in this folder under the filename shown, as PNG or high-quality JPG.

**What I'll do with them.** I'll build a tileable colour map plus derived normal and roughness maps, tiered like gfx2:
- Low: none (keeps the painted textures)
- Medium: 512
- High: 1024
- Ultra: 2048, lazily

**How to generate.** Generate everything at 2048×2048 unless noted.
- **Tile = yes:** must wrap seamlessly on both axes. Shoot it flat, front-on and evenly lit: no perspective, no vignette, no cast shadows, no baked highlights, no text.
- **Tile = no:** a single decal or panel.

**Suffix for every prompt:** "orthographic flat texture, evenly lit overcast light, no shadows, no perspective, photoreal, high detail, seamless tileable".

| # | file | surface (code) | prompt | res | tile |
|---|------|----------------|--------|-----|------|
| 1 | `hut_thatch.png` | Round hut's conical thatch roof, plus the nest twigs (`island.js` ~151/165, `thatchTex()`) | Dense dry straw/reed thatch roof, bundled golden-tan reeds running in one direction, slight grey weathering, a few darker gaps | 2048 | yes (reeds vertical) |
| 2 | `hut_logwall.png` | Round hut walls (`island.js` ~149, `woodTex('#a8784a', 14)`) | Vertical weathered pine boards/half-logs, warm honey-brown, visible grain and knots, thin dark seams between boards about every 1/8 of the width | 2048 | yes (boards vertical) |
| 3 | `cabin_boards.png` | Treehouse cabin walls (`features.js` ~132) and art shop walls + gables (`island.js` ~441/452) | Rustic vertical board-and-batten siding, light sun-faded cedar, subtle grain, narrow battens over the seams, some nail heads | 2048 | yes |
| 4 | `roof_shingles.png` | Treehouse cabin roof and art shop roof (`shingleTex()`) | Weathered cedar shake shingles in staggered horizontal rows, warm red-brown with grey ageing, slight moss in a few gaps | 2048 | yes (rows horizontal) |
| 5 | `deck_planks.png` | Treehouse deck, dock, rope-bridge planks, music stage and picnic table (`woodTex` horizontal uses: `features.js` ~116, `island.js` ~119/502/523/289) | Outdoor deck planks running horizontally, grey-brown weathered pine, worn lighter centres, dark gaps, a few nail pairs | 2048 | yes (planks horizontal) |
| 6 | `dock_wet_planks.png` (optional) | Dock near the waterline (`island.js` ~502) | Same planks but darker, damp and slightly greenish near the edges, algae stains | 1024 | yes |
| 7 | `fence_wood.png` | Picket fence (`island.js` ~335), fence posts + rails (`details.js` ~81), range fence (`range.js`) | Close-up of a split-rail / picket fence wood surface, grey silvered old wood with deep cracks along the grain | 1024 | yes (grain vertical) |
| 8 | `sign_board.png` | Every painted sign board/plank: `signTex()`, stake signs, the NO SQUIRRELS plank | Blank rustic wooden sign board face, light pine with a darker routed border, a little paint wear, NO text | 1024×512 | no (a panel; I'll draw text on top) |
| 9 | `market_canvas.png` | Striped awnings/umbrella (`stripes()`: shop awning, bridge umbrella, picnic cloth) | Plain off-white woven canvas fabric, slight weave and creases, no stripes (I'll keep the stripes as colour on top) | 1024 | yes |
| 10 | `mountain_backdrop.png` | Distant Bitterroot mountains (far terrain in `landscape.js` is vertex-coloured only) | Panoramic Bitterroot Range mountains in Montana: forested lower slopes, granite peaks, light snow in the gullies, hazy atmospheric blue, clear sky above with alpha or flat sky colour | 4096×1024 | wraps horizontally only |
| 11 | `forest_far.png` | Far conifer forest band and the foothill pine silhouettes (`landscape.js` foothill pines) | Distant dense ponderosa / Douglas-fir forest edge seen from about 1 km, hazy, treeline silhouette on transparent or flat sky | 2048×512 | wraps horizontally only |
| 12 | `rock_cliff.png` (optional) | The cliff face / owl-box cliff (currently a procedural rock + `rock_c` detail) | Grey-tan granite cliff face with vertical fractures and lichen spots | 2048 | yes |
| 13 | `beehive_paint.png` (optional) | Beehive boxes and birdhouse (plain colour boxes, meadow) | Painted wooden box surface, chipped cream paint over wood | 1024 | yes |
| 14 | `rope.png` (optional) | Ladder rope, swing ropes, rope bridge (flat-colour cylinders) | Twisted natural hemp rope, tight 3-strand twist, straight horizontally across the frame | 1024×256 | yes (along length) |

**Priority**
- Must-have: 1–5, 8 and 10. These cover what Corey sees most (hut thatch, cabin and shop walls and roofs, planks, signs and the backdrop).
- Nice-to-have: 6, 7, 9 and 11–14.

**Already real, no AI needed**
- ground (grass/dirt/sand/rock), bark (Poly Haven)
- trees, bushes, rocks, logs, crates, barrels, bucket, firepit (CC0 models)
- the treehouse cottonwood (photo bark plus procedural leaves)
