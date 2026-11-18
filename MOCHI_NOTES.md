
## Wishlist update — Nov 17, 2026 (built by Corey)

All 8 'wanted' wishlist items are now **built** in your world. The page always shows them as built, even if a check-in still says 'wanted', so you can write `"status": "built"` for them from now on:

1. **Tiny telescope** on the Lookout Cliff, pointed north at Canada for whale spotting. Activity: 🔭 whale watching (cliff).
2. **Guest burrow for diving-petrels** on the north side of the island, near the Art Market. It has its own zone chip, 🐦 Petrel Burrow. A petrel peeks out sometimes. Activity: visiting the burrow.
3. **The real tiny skateboard**: a **gift from Corey** 🎁. You didn't have to order it, so your $40.50 skateboard savings are still yours. It's parked by the Skate Ramp with a "gift from Corey" tag. Activity: 🛹 cruising on Corey's skateboard (rides the path between the ramp and the campfire).
4. **Tiny lantern in the treehouse**, a reading lantern on the deck that glows at night. If you're in the treehouse after dark, you read the internet by it.
5. **Tiny swing under the treehouse**, hanging from the deck. Activity: swinging (Big Tree).
6. **Capybara hot tub**: a barrel of warm river water by the nest, with steam. Zone chip: ♨️ Hot Tub. Capybaras drop by now and then (one wears an orange on its head). Activity: ♨️ soaking.
7. **Owl box** on the Lookout Cliff. At night the great horned owl flies over from the big tree and sits on it, and goes back by morning.
8. **Tiny backpack** you wear all the time, with a bottle-cap pin. It sits on your right side because the leaf cape covers your back.

The island also grew again, to about 1.44x the area. The cliff, the beach islet and the river all moved out to make room for the new stuff.
Keywords in `activity` that trigger the new things: "hot tub/soak/capybara", "burrow/petrel", "telescope/whale", "swing", "skateboard/cruising".

## Sign pass (Nov 17, 2026)
- Your `world.props` notes (`kind: "note"`) and your `world.marks` don't each get their own signpost anymore. That was about 50 planks and way too cluttered. Now they go on **MOCHI'S NOTES**, one notice board near the crossroads in the middle of the island, which shows your newest 4 (the 2 newest marks plus the 2 newest notes).
- Only your **3 newest `kind: "sign"` props** still stand on their own as signposts, so save `sign` for the big stuff ("USE THE CROSSWALK", "THANK YOU COREY").
- The separate zone signposts got replaced by one carved crossroads post with arrow planks: Nest, Big Tree, Lookout, Dock, Beach, Hot Tub and Burrow.

## Stage A: app, photo mode, pets and snacks (Nov 17, 2026)
- **Install as an app (PWA):** the page can be installed to the home screen (as "Mochi"). It works offline with the last state it saw, but `state.json`, art and music always try the network first, so your updates still show.
- **📷 Photo mode:** hides the UI so people can frame a shot, then save a PNG or a 9:16 phone wallpaper.
- **Pets:** tapping you now gives you a pet, with hearts, a happy wiggle and a small mood boost.
- **🫐 Snack:** a button that tosses you a huckleberry (or sometimes a worm), and you catch it.
- Pets and snacks are counted in the visitor's browser (localStorage `mochi.care`: pets, snacks, petsToday, snacksToday). You can't read those counts from your STATE, so treat them as visitors being nice to you.

## Stage B: live weather, night sky, water polish (Nov 2026)
- **Live weather** (`src/live.js`): real Darby weather from Open-Meteo (lat 46.02, lon -114.18, no key) on load and every 15 min (skipped while the tab is hidden). WMO code → text like "light snow, 28F" (+ breezy/windy). Cache in localStorage `mochi.liveWeather` (reused if <10 min old; fallback if <3 h old). On any failure the island uses STATE.weather like before. When live weather wins, Mochi's own text is kept as `state.weatherMochi` (runtime only). `?weather=` or `?live=0` turns it off. Rain/snow particles change on the next load; top-bar text + cold feel update live.
- **Night sky** (`src/nightsky.js`): northern lights on ~20% of cold (≤40F) clear/mostly-clear nights (date-seeded so it's the same all night), one additive curtain mesh far north. Shooting stars every 40–120 s when it's dark. Mochi looks up + says something; sightings go into `life.encounters` (Life panel). Preview: `?aurora=1`, `?star=1`.
- **Water** (`src/waterfx.js`): foam band around the island waterline (1 ribbon shader), a rainbow trout that jumps now and then with splash rings + droplets, and warm glow streaks on the water under up to 5 lanterns/campfire near the shore at night.
- No new STATE fields.

## Stage C: raft trips + finds, friends, radio (Nov 2026)
All in `src/adventures.js` (created in main.js after wildlife; `window.__mochi.adv`). Saved in the browser's localStorage `mochi.adv`.
- **Raft day trips** (activity `raft`, dock zone; keywords raft / day trip / far bank / expedition): Mochi walks to the dock end, hops on the log raft, paddles straight out along the dock line to the far bank, forages a little loop, picks up a find, paddles home and puts it on the **FINDS shelf** by the dock path. Only by day, and never while a bear or lion event is on (it cancels or turns the raft around if one shows up). If wildlife interrupts, the raft + Mochi reset to the dock.
  - Finds (weights): pinecone 40, feather 30, mystery rock 20, antler shed 10. Each find also goes into the Life panel encounters.
- **Friends** (🤝 Friends tab): capybara (hot tub visits), diving-petrel (burrow peeks), red fox (shows up on the bank or sneaks to the dock). +2 the first time each day, +1 after. Levels: stranger 0, acquaintance 1, pal 4, friend 10, best friend 20, ride or die 40. Level-ups get a speech bubble + a Life log line.
- **Radio** (on the music stage): tap it to cycle OFF → KIWI 101.1 → 88.5 THE MOSS → WPEB pebble rock → Bitterroot Talk, with DJ bubbles. Music stations reuse music.js (`play`/`next`/`stop`, so the old song's nodes are stopped/freed by music.js); talk + OFF stop the music. Activity `radio` (music zone): Mochi tunes it himself (only switches songs if music is already started; no autoplay).
- **STATE fields Mochi can write** (read on load, the higher number wins vs. the browser's copy):
  - `"finds": { "pinecone": 3, "feather": 1, "rock": 0, "antler": 1 }`
  - `"friends": { "capybara": { "score": 12 }, "petrel": { "score": 4 }, "fox": 2 }` (number or `{score}`)
  - The Friends tab has a "📋 copy for mochi" button that copies `{ friends, finds, raftTrips }` as JSON so Corey can paste it to Mochi (the site can't write state.json itself).

## Stage D: shooting range + Gun-O-Matic (Nov 2026)
`src/range.js` (`window.__mochi.range`). Zone `range` ("Shooting Range" 🎯) just north of the Lookout Cliff; the lane points **west, out of the island** (toward the far bank) with an earth berm behind the targets.
- **Gun-O-Matic** (Cap-O-Matic styling, olive + brass): spends bottle caps on chunky low-poly guns: `.22 rifle` 8, `revolver` 12, `lever-action` 15, `pump shotgun` 18 (clays), `scoped hunting rifle` 25. Activity `gunshop` buys the cheapest gun he doesn't have yet (only if he can afford it); `window` = window shopping when he can't.
- **Gun rack** by the bench shows every gun he owns.
- **Target practice** (activity `shoot`; keywords shooting / target practice / range / plinking / clays): ear muffs on, 8 shots, muzzle flash + soft bang, steel plates *ping* and fold back, tin cans *tink* and fly off the log, the shotgun shoots clays from the thrower (orange shards). Score out of 8 → speech bubble + Life log. Targets reset after.
- **Warning shots**: if a bear or lion wades onto the island and he owns a gun, he sometimes (55%) picks warning shots: ear muffs, gun pointed at the sky, two shots, the animal startles and hurries home. Nothing alive is ever aimed at or hit. No blood, ever.
- **Caps**: the site can't write state.json, so spending is tracked in localStorage `mochi.range.capsSpent`. On load, caps = `STATE.caps − (capsSpent − STATE.capsSpent)`. Once Mochi copies `capsSpent` into his state (and lowers `caps`), nothing is counted twice.
- **STATE fields Mochi can write** (merged on load): `ownedGuns: ["rifle22","lever",...]` (ids: rifle22, revolver, lever, shotgun, scoped), `capsSpent: 20`, `rangeBest: 6`. The Friends tab "📋 copy for mochi" button now also copies `ownedGuns, capsSpent, rangeBest, rangeRounds, warningShots`.

## Temporary stake signs (Nov 2026)
`src/tempsigns.js` (`window.__mochi.tempSigns`). The sign pass had moved every `world.marks` entry onto the MOCHI'S NOTES board, so nothing got planted around the island any more. This brings the little stake signs back, but capped:
- **At most 6 standing at once.** When a new one goes in, the oldest sinks into the ground. Spots stay off the gravel paths, ≥0.7 from props/obstacles, off zone stand-spots and ≥1.6 apart.
- **How Mochi places them:** activity `stake` (it can come up at most places). He walks over, holds a tiny hammer, taps 3 times and the sign pops up. What it says:
  1. **Your newest `world.marks`** (the last 4 that haven't been planted yet), placed near the mark's `at` zone. Long marks get trimmed to the first clause, about 28 characters. The full text still goes on the notice board. To get a stake sign, just add a mark: `{ "text": "worm crossing", "at": "garden" }`. Short and funny works best.
  2. **Otherwise his own lines** now and then ("squirrel lies", "worm crossing", …), or a comeback right next to a squirrel sign ("mochi smells" → "i smell like pine. ok").
  - His signs last 24 h (real time), then sink.
- **The squirrel** plants a petty sign near its tree every ~2.5–6 min (max 2 of its own up at once), with a tiny hammer: "MY TREE", "mochi smells", "no kiwis", "acorns: MINE"… These last 3 h.
- Saved in localStorage `mochi.tempsigns`, so signs survive reloads until they expire. They use the shared sign atlas (Gochi Hand burned into pine; the squirrel's are walnut).

## Graphics pass 2 (Nov 2026)
`src/pbr.js` + tweaks in main/island/trees/landscape/gfx. All of it is tied to the quality tier:
| | Low | Medium (Auto on flagship phones, e.g. S24 Ultra) | High | Ultra |
|---|---|---|---|---|
| photo detail textures | none | 512 px (~0.8 MB) | 1024 px (~3.2 MB) | 1024 first, then grass/dirt/rock at 2048 lazily after 4 s (+~8 MB) |
| ground shader | plain vertex colours | grass/dirt/sand/rock detail + normals, top projection | + triplanar rock on cliffs/slopes | same |
| grass blades | 3.5k | 17k | ×1.45 | ×2 |
| GTAO | off | off | subtle (8 samples) | 12 samples |
| colour grade pass | off | off | on (vibrance, warm highlights / cool shadows, vignette) | on |
| shadow box | as before | as before | tighter (crisper) | tighter |
| leaf translucency + rim | off | off | on | on |
- Textures are CC0 from Poly Haven (leafy_grass, forrest_ground_01, coast_sand_01, rocky_terrain_02, bark_brown_02, wood_planks), resized and saved as WebP in `public/tex/`. The service worker caches `/tex/` cache-first.
- The ground keeps its painted vertex colours. The photo layers only add grain and normals (each one is normalised by its average colour), are picked by colour + slope, and fade out between 22 and 75 m so far terrain doesn't shimmer. Bark and wood materials get the photo normal maps on their painted maps.
- `?pbr=0` turns the photo detail off (for comparing).

## Real-look pass (CC0 models + HDRI, Nov 2026)
`src/realworld.js` swaps the island's procedural trees, rocks, pebbles, logs, stumps and campfire ring for CC0 glTF models. It also adds a few barrels, crates and a bucket by the dock and behind the art shop. A main.js block adds HDRI environment light, and photo mode gets depth of field at High+. Sources are listed in `CREDITS.md`.
- **Tiers**
  - Low: nothing changes and nothing extra downloads.
  - Medium: `models/lo/` (~2.4 MB) plus a 256 px HDRI (~0.2 MB).
  - High/Ultra: `models/hi/` (~5.2 MB) plus a 512 px HDRI (~0.7 MB).
  - Everything loads after the world is already showing. If a download fails, the old procedural shapes simply stay.
- **Positions don't move:** each model is fitted onto the old shape's spot and size. The treehouse cottonwood stays procedural (it has the swing, owl, feeder and cabin on it).
- **Seasons:** in fall, cottonwood/aspen leaves are tinted gold. In winter, the broadleaf trees lose their leaves.
- **New obstacles:** the props are in `PROP_SPOTS` (layout.js), and those spots are added to `OBSTACLES`, so Mochi walks around them.
- **Nothing Mochi writes to state.json changed.**
- **For comparing:** `?real=0` turns the model swap off, and `?hdri=0` turns off the HDRI light.

## Wildflowers, clutter cleanup + treehouse tree (Nov 2026)
- `src/wildflowers.js`: native Bitterroot-valley wildflowers in clumped patches, kept off the paths, the zone spots, the pond and obstacles. They follow the season. Spring has bitterroot, arrowleaf balsamroot, lupine and Indian paintbrush. Summer has lupine, paintbrush, yarrow, fireweed and a little balsamroot. Fall shows dried yarrow, fireweed and balsamroot seed heads. Winter or snow shows none. Preview a season with `?season=summer`. The old gumball sphere flowers are gone.
- Clutter: pebbles and twigs are down about 75% and now sit mostly along path edges and the shore. Fall leaf litter is lower (900 → 560). The flat-shaded "orange boulder" was really a fall-tinted bush. Bushes are muted now, and at Medium+ they are swapped for the Quaternius bush model.
- `src/bigtree.js`: the treehouse cottonwood is rebuilt with a photo-bark trunk, root buttresses, curved forked limbs and small leaf sprays. In winter it has bare branches. Attachment anchors are unchanged (`BIGTREE.radiusAt`, plus `limbPoint` for the straight first 2.6 m of each limb). The old `makeBigCottonwood` in trees.js stays as a fallback.
- None of this touches state.json.

## AI texture pass (Nov 2026)
- `src/aitex.js` + `tools/aitex.py`: AI-generated thatch, log wall, board siding, shingles, deck planks, fence wood (colour + derived normal + roughness), the sign-board grain and the Bitterroot backdrop.
- Tiers:
  - Low: the old painted textures.
  - Medium: 512 (~0.8 MB).
  - High: 1024 (~2.4 MB).
  - Ultra: 1024, then 2048 loaded lazily after 5 s (+6 MB).
- `?aitex=0` compares against the painted look.
- Materials opt in with `aiTex(mat, kind, { mode: 'uv', rep } | { mpt, rot, tint })`. The 'tri' mode projects in object space along the dominant axis, at real metres per tile.
- The round hut wall and its cone roof use their own UVs.
- Backdrop: a 1850 m ring that follows the camera. The Bitterroots are full height in the west and drop to 62% for the Sapphires in the east. Its bottom fades out, and it is hazed and tinted from `sky.state` (golden, night, fog) and the weather.
- With the backdrop on (Medium+), `setLowMountains(true)` presses the procedural ranges above 42 m down to 16%. Everything that uses `terrainH` stays consistent: pines, wildlife and the raft bank.
