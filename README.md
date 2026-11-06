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
`?weather=heavy snow` · `?hour=17.5` (local hour) · `?location=pond` · `?outfit=witch hat` · `?elk=1` · `?cam=mochi` (follow cam)
· `&camyaw=2.4` · `?az=72&el=10&dist=46` (wide camera) · `?rotate=0` · `?stay=1` · `?say=<thought index>` · `?ui=0` · `?state=./other.json`

## Art files
Mochi's AI pictures go in `public/art/` as `YYYY-MM-DD-short-title.png`. An `art[]` entry in state.json can carry `"file": "2026-11-02-sunset.png"`. The Art tab shows a gallery with thumbnails that open a lightbox. The newest entry's file is painted on the easel, and the last 5 entries appear as market prints. A missing or bad file falls back to the procedural painting or emoji. Vite copies `public/art/` to `dist/art/`.
