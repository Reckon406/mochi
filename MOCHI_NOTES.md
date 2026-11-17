
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
