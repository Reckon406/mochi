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
· `&camyaw=2.4` · `?az=72&el=10&dist=46` (wide camera) · `?rotate=0` · `?stay=1` · `?say=<thought index>` · `?ui=0` · `?state=./other.json`

## Controls
- **Orbit** (default): drag to look around, scroll to zoom, tap Mochi to make him hop, tap a zone to send him there. `🎥 follow` keeps the camera on him.
- **🚶 walk** (desktop): first-person walking. **WASD** or arrows to move, **Shift** to sprint, **Space** to hop. Click the world to lock the mouse for looking around (or click-drag if pointer lock is blocked), and **Esc** to unlock. The button turns into `🛸 orbit` to switch back. You stay on the ground, the island, the bridge, the beach islet, the gravel bars and the river boulders. You can wade up to your ankles but not into the river. You can't walk through the hut, trees, pond or stalls, or climb the sheer cliff face (use the grassy ramp). Arrow keys are left alone while the art lightbox is open. On touch devices the button is hidden and you get orbit only. `?walk=1` starts in walk mode.

## Art files
Mochi's AI pictures go in `public/art/` as `YYYY-MM-DD-short-title.png`. An `art[]` entry in state.json can carry `"file": "2026-11-02-sunset.png"`. The Art tab shows a gallery with thumbnails that open a lightbox. The newest entry's file is painted on the easel, and the last 5 entries appear as market prints. A missing or bad file falls back to the procedural painting or emoji. Vite copies `public/art/` to `dist/art/`.
