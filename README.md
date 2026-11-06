# Mochi's World (three.js)

A small 3D world for Mochi the kiwi, on a river island in the Bitterroot River at Darby, Montana.

```bash
npm install
npm run dev        # local dev server
npm run build      # static site -> dist/ (relative paths, works on any static host)
node scripts/shoot.mjs http://localhost:4173/   # serve dist/ on :4173 first; screenshots -> shots/
```

## Data
The site fetches `./state.json` at runtime with `cache: no-store`. If the file is missing or broken it shows a default Mochi and a small notice.
To keep the site in sync, write the same STATE object as JSON to `state.json` next to `index.html` whenever the Canvas page's
`// === MOCHI STATE ===` block changes. You don't need to rebuild.

## URL params (handy for previews)
`?weather=heavy snow` · `?hour=17.5` (local hour) · `?location=pond` · `?outfit=witch hat` · `?elk=1` · `?cam=mochi` (follow cam) · `?walk=1` (walk mode)
· `&camyaw=2.4` · `?az=72&el=10&dist=46` (wide camera) · `?rotate=0` · `?stay=1` · `?say=<thought index>` · `?ui=0` · `?state=./other.json` · `?season=winter|spring|summer|fall` · `?act=0` (no activities) · `?event=bear|grizzly|lion|wolf|coyote|fox&at=bank|island|dock` (force a wildlife event)

## Controls
- **Orbit** (default): drag to look around, scroll to zoom, tap Mochi to make him hop, tap a zone to send him there. `🎥 follow` keeps the camera on him.
- **🚶 walk** (desktop): first-person walking. **WASD** or arrows to move, **Shift** to sprint, **Space** to hop. Click the world to lock the mouse for looking around (or click-drag if pointer lock is blocked), and **Esc** to unlock. The button turns into `🛸 orbit` to switch back. You stay on the ground, the island, the bridge, the beach islet, the gravel bars and the river boulders. You can wade up to your ankles but not into the river. You can't walk through the hut, trees, pond or stalls, or climb the sheer cliff face (use the grassy ramp). Arrow keys are left alone while the art lightbox is open. On touch devices the button is hidden and you get orbit only. `?walk=1` starts in walk mode.
- **E** (walk mode): when you're near a spot with something to do, a prompt shows up. Press E and Mochi heads over and does it.

## The island (v2)
The island is about 1.7× bigger than v1 (radius ~24 m, with the beach islet further out over a longer rope bridge). The Bitterroot is wider around it. It has 17 places, all in the legend:

hut, big tree, pond, pumpkin patch, beach islet, skate ramp, art market, cap museum, squirrel's tree, garden, lookout cliff, picnic table, and new in v2: **Art Shop**, **Campfire**, **Wildflower Meadow** (beehive), **Fishing Dock** (rowboat), **Music Corner**.

Gravel paths link the places. `location` strings resolve by keyword: for example "art shop" or "gallery" go to the shop, "campfire" or "marshmallow" to the campfire, "dock" or "fishing" to the dock, "song", "drum" or "guitar" to the music corner, and "bees" or "meadow" to the meadow.

## Where his pictures hang
- **Default:** the newest piece goes on the market **easel**. The next 9 go in the **Art Shop** (3 on the back wall, 2 on each side wall inside, 2 outside by the door). Older pieces go on the **hut** wall, the **museum** side panels, the **market** backboard, the **picnic** signboard and the **dock** board. Spare spots there get prints of his real (`file`) pictures.
- **Moving a piece:** add `"hang"` to an art entry to move it. Use `"easel" | "shop" | "market" | "hut" | "museum" | "picnic" | "dock"`, and optionally `"slot"` (0-based, e.g. `"slot": 0`). The spots are: easel 1, shop 9, market 5, hut 2, museum 2, picnic 1, dock 1. If a spot is full, the piece goes to the shop.
- **Clicking:** clicking any hung picture opens it in the Art tab lightbox.

## STATE.world (things Mochi changes on the island)
```json
"world": {
  "props": [
    { "id": "dock-lantern", "kind": "lantern", "at": "dock", "note": "so the fish can see me" },
    { "id": "rock-1", "kind": "cairn", "x": -3.5, "z": -8.0 },
    { "kind": "sign", "at": "pond", "dx": 1.0, "dz": -0.5, "note": "NO SWIMMING (ducks)" }
  ],
  "marks": [ { "text": "mochi was here", "at": "shop" } ]
}
```
- **`kind`:** one of `lantern` (glows at night), `sign`/`note` (shows `note`), `flowers` (`color` optional), `cairn`/`rocks`, `sockflag`/`flag`, `pumpkin`, `snowman`, `birdhouse`, `cap`, `mushroom` or `rock`. An unknown kind shows up as a little sign with its name.
- **Where it goes:** `at` takes a zone id or a keyword (`dx`/`dz` are optional offsets in metres). Or use `x`/`z` island coordinates: centre 0,0, +x east, −z north, shore at about 22–26 m. `yaw` (radians) is optional.
- **`marks`:** short painted planks with `text`, placed by `at` or `x`/`z`.
- **Limits:** up to 40 props and 16 marks. There is no rebuild: write `state.json` and reload.

**Keep `world` and `music` when copying STATE into `state.json`.** If the Canvas STATE doesn't have them, merge them in.

## The world affects him
Weather and mood nudge Mochi:
- **Cold** (snow or ≤35°F, a little at ≤45°F): he puffs up, hunches, shivers, hops less, and drifts to the campfire or hut.
- **Rain:** he does the odd full-body shake-off and heads for the hut or Art Shop.
- **Wind:** he leans into it.
- **Happy, confident or majestic mood:** bouncy idle and more hops. Sad or sleepy moods slow him down.
- **A song playing:** he sometimes wanders to the Music Corner and bops there, and notes float over the stage.

## Music (STATE.music)
```json
"music": { "songs": [ { "id": "sock-scarf-season", "title": "sock scarf season", "mood": "cozy", "key": "D", "bpm": 90, "notes": "E4 G4 A4 - B4", "file": "2026-11-06-song.mp3" } ], "playing": "sock-scarf-season" }
```
- **How songs are made:** songs are **generated live with Web Audio**. There are no audio files. The `title` seeds the melody and chords, so each song is unique and repeatable.
- **Fields:** `mood` picks the scale, tempo and sound (`happy, chill, sad, spooky, hype, cozy, epic`, plus loose words like "majestic" or "lonely"). `key`, `bpm` and `notes` (a motif like `"C4 E4 G4 - A4"`, where `-` is a rest) are optional.
- **Real tracks:** an optional `file` plays `./music/<file>` (mp3/ogg/wav/m4a) instead.
- **Adding a song to the soundtrack:** append a new entry to `music.songs`. The playlist loops through all songs, starting at `playing`.
- **Playback:** audio starts after the first click or keypress (a browser rule). The now-playing chip (bottom left) skips to the next song. There's also a soft river ambience and little sound effects (hop chirp, footsteps in walk mode).

## ⚙️ Settings
The ⚙️ button (top right) holds settings that are saved in `localStorage` (`mochi.settings.v1`):
- **Live:** quality (pixel ratio and shadow-map size), shadows on/off, bloom on/off, and wildlife density (off / a few / normal / lots).
- **On reload:** quality's anti-aliasing (MSAA) level, rain/snow amount, and grass & flower density.
- **Sound:** master, music, effects and river volume, mute, play songs, and pick a song. The river starts low (30% of the old level) and fades in over about 2.5 s when audio first starts. Saved sliders are kept.
- **Camera:** auto-rotate, walk-mode hint, start camera (orbit / follow / walk), and mouse-look speed.

URL params still win over settings.

## Art files
Mochi's AI pictures go in `public/art/` as `YYYY-MM-DD-short-title.png`. An `art[]` entry in state.json can carry `"file": "2026-11-02-sunset.png"`. The Art tab shows a gallery with thumbnails that open a lightbox. The newest entry's file is painted on the easel, and the last 5 entries appear as market prints. A missing or bad file falls back to the procedural painting or emoji. Vite copies `public/art/` to `dist/art/`.

## Life: activities, inventory, fishing, garden (v3)
Mochi now *does* things, Pino-style. Each zone has a loop with visible props, and the loops chain together. He digs worms in the garden, fishes off the dock with them, cooks the catch at the campfire, then eats it at the picnic table. He also plants, waters and harvests, naps in the hut, reads mail, browses on the laptop, skips stones at the pond, climbs into the treehouse, skates the ramp, dusts the cap museum, trades with the squirrel, yodels by the weather station, collects shells, gathers honey, curates the shop, paints at the market, jams in the music corner, spends caps at the Cap-O-Matic, and visits the pumpkins.
The **🎒 Life** tab shows his bag, fish bucket, garden, fish log, laptop, mail and wishlist. A chip at the top shows what he's doing right now.

Everything below is optional. Missing fields get defaults, and nothing is written back: this is a static site, so his bot owns STATE.

| field | shape | what it does |
|---|---|---|
| `activity` / `location` | string | keywords pick his first activity, e.g. "fishing", "cooking", "planting", "browsing", "napping", "skating", "treehouse" |
| `inventory` | `{worms, fish:{species:n}, cooked:{name:n}, seeds:{crop:n}, crops:{crop:n}, honey, shells, firewood, acorns, trinkets:[]}` | starting bag. `caps` comes from the top-level `caps` |
| `garden.plots` | `[{crop, stage 0-4, planted?: "YYYY-MM-DD"}]` (6 plots) | crops: carrot, potato, pumpkin, huckleberry, garlic, kale. If `planted` is given, the stage is worked out from the date. Growth is slower in fall and much slower in winter/snow |
| `fishLog` | `[{species, inches, kept, date}]` | his catch history (the last 50 are shown) |
| `laptop` | `{site, screen, browsing:[...], last}` | what's on the picnic-table laptop screen |
| `mail` | `[{from, subject, unread:true}]` | the mailbox flag goes up while anything is unread |
| `wishlist` | `[{item, status: "wish"|"building"|"built"}]` | shown in the Life tab |

**Fish are real Bitterroot River species** (checked against the Montana FWP Statewide Fisheries Management Plan, Bitterroot drainage: https://fwp.mt.gov/binaries/content/assets/fwp/conservation/fisheries-management/statewide-fisheries-management-plan-2023-2026/2.08_bitterroot-river-drainage.pdf).
- **Native:** mountain whitefish, westslope cutthroat trout, bull trout, largescale sucker, northern pikeminnow, slimy sculpin.
- **Non-native:** rainbow trout, brown trout, brook trout.

Mochi follows cute versions of the real rules. Bull trout (threatened) are always released. He also releases cutthroat (a species of concern), suckers, pikeminnow and sculpin. He keeps and cooks whitefish, rainbows, browns and brookies.

**Seasons follow the real date** (`?season=` overrides it).
- **Fall:** yellow cottonwoods and falling leaves.
- **Winter (Dec–Feb):** snow on the ground and bare cottonwoods.
- **Spring and summer:** greens.

**More new spots:** a weather station on the cliff (shows the real `weather`), the Cap-O-Matic vending machine (3 caps = 1 trinket), a treehouse in the big tree, and a mailbox by the hut.

**Night critters (no fireflies, since Western Montana doesn't have them):**
- A great horned owl in the big tree (glowing eyes, hoots).
- Bats over the river from dusk on.
- Moths around the lanterns.
- A raccoon that sneaks up to the dock bucket and can steal a fish.

Bats and moths sit out the winter.

## Bitterroot wildlife (v4)
Most animals live on the **other** side of the river: the far banks, the valley floor and the slopes. They walk out of the treeline, drink at the water's edge, then wander off again. Some birds fly overhead or float down the river. Only magpies and Steller's jays hop around the island itself.

**When and where they show up:**
- **Deer:** mostly at dawn and dusk.
- **Owls and bats:** at night (see the night critters above).
- **Eagles and osprey:** soar during the day, and the osprey sometimes dives for a fish.
- **Black bears and grizzlies:** absent Dec–Mar (hibernating).
- **Osprey:** only here Apr–Sep.
- **Skunks:** absent in deep winter.
- **Snowshoe hares:** turn white in winter.
- **Bucks and moose:** grow antlers in fall.
- **Bighorn sheep:** on the slopes.
- **Mountain goats:** up high on the Bitterroot Range side (Trapper Peak). Both are scaled up so you can actually spot them.

**Predators (no gore, just cute):**
1. A black bear (grizzly, rarely), mountain lion or gray wolf first shows up **across the river**. Mochi spots it, puffs up nervously and watches.
2. Usually it wanders off ("watched it from across the river").
3. Sometimes it wades or swims over to the island. Mochi then defends himself in one of these ways:
   - puffs up big and flaps his cape
   - bangs a pot
   - uses a puff of bear spray
   - hides in the hut
   - climbs to the treehouse
4. The predator backs off and swims home, and Mochi feels proud or a bit shaken.

**Fish thieves:** at dusk and night a coyote or red fox may sneak to the dock bucket. Mochi shoos it off, or it gets a fish. The raccoon still raids at night too.

| field | shape | what it does |
|---|---|---|
| `encounters` | `[{animal, at, outcome, date}]` | his encounter history. New ones get added during the session and show in the 🎒 Life tab |
| `courage` | number 0–100 (default 50) | braver Mochi stands his ground more often. Standing firm goes +4, watching +1, hiding/climbing −1 |
| `event` | `{animal: "bear"\|"grizzly"\|"lion"\|"wolf"\|"coyote"\|"fox", at: "bank"\|"island"\|"dock"}` | forces an event about 5 s after load. `at: "island"` means it will cross |

Bird and mammal list, and the sources it was checked against:
- **Mammals:** mule deer, white-tailed deer, moose, bighorn sheep, mountain goat, black bear, grizzly bear (rare: no confirmed resident Bitterroot population, but dispersers can turn up anywhere in western Montana), mountain lion, gray wolf, coyote, red fox, beaver (with a lodge on the west bank), river otter, raccoon, striped skunk, porcupine, snowshoe hare.
- **Birds:** bald eagle, osprey (summer), great blue heron, Canada geese, mallards, great horned owl, black-billed magpie, Steller's jay.
- **Sources:**
  - Bitterroot NF, About the Area: https://www.fs.usda.gov/r01/bitterroot/about-area
  - FWP, Bears in Montana / Bitterroot recovery zone: https://fwp.mt.gov/conservation/wildlife-management/grizzly-bears
  - FWP grizzly occurrence: https://fwp.mt.gov/conservation/wildlife-management/wildlife-migration/tracking/furbearer-carnivore/grizzly-bear
  - FWP wolves: https://fwp.mt.gov/conservation/wildlife-management/wolf
  - Lee Metcalf NWR (Ravalli County: osprey, bald eagle, heron rookery, beaver, otter, porcupine, coyote, raccoon, white-tailed deer, moose, black bear): https://www.fws.gov/refuge/lee-metcalf/about-us and https://visitmt.com/listing/lee-metcalf-national-wildlife-refuge-723
  - Montana Field Guide (raccoon, fox, skunk, porcupine, hare): https://fieldguide.mt.gov/speciesDetail.aspx?elcode=+AMAJE02010
