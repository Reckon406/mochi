# mochi-brain

Mochi's always-on brain: a Cloudflare Worker + one SQLite-backed Durable Object (free tier).
Live at **https://mochi-brain.coreydman15.workers.dev**.

The brain owns the **live layer**: caps, inventory, activity/mood/location, `world.crush`, `world.gaming`,
`world.plane`, `world.pet`, short memories, purchase log, chat log, action log. Everything else (diary, art,
paper, mail, goals, wishlist...) still comes from `https://reckon406.github.io/mochi/state.json`, which is
re-read on every tick and merged in.

## endpoints (CORS: https://reckon406.github.io + http://localhost:*)
- `GET /state` – full merged state (state.json + live layer) plus `brain: { activityId, actionAt, lastTick, log, purchases }`.
- `POST /chat {message}` – in-character reply `{ reply, action, mood, caps }`. May run one validated action.
- `POST /event {type, ...}` – visitor-triggered events from the 3D world, validated server-side:
  `vend {item}` (3 caps, item must be a real Cap-O-Matic trinket), `gift {kind, d}`, `fish {species, inches, bait}`,
  `disc`, `gaming {hours<=1}`, `worms {n<=3}`, `pet`.
- `POST /tick[?force=<action>]` – manual tick, needs `Authorization: Bearer $ADMIN_TOKEN`.

## cron
`*/30 * * * *`: sync state.json -> Gemini picks 1-3 actions from the menu in `src/rules.js` -> validated and applied.
If Gemini is unavailable, the tick falls back to one random allowed action.

## limits
- Gemini (`MODEL`, default `gemini-3.1-flash-lite`): hard cap `GEMINI_DAILY`=300 calls/UTC day; chat stops at
  300 - `TICK_RESERVE`(60) so the 48 daily ticks always fit.
- chat: 6/min per IP, 30/min global, 60/day per IP. events: 20/min per IP, 120/min global, 300/day per IP.
- Over a limit, Mochi answers with a cute offline line instead of erroring.

## merge rules (state.json -> live)
Three-way merge against the state.json values seen at the previous sync: if Mochi's bot changed caps or an
inventory count, the **difference** is applied to the live value (never below 0); new trinkets are appended;
a changed activity/mood/location or world.crush/gaming/plane/pet key is adopted; new short memories are added.
Anything the bot didn't change is left alone, so the live layer is never clobbered.

## deploy
```
cd worker
npx wrangler deploy
tr -d '\n' < ~/.secrets/gemini_api_key | npx wrangler secret put GEMINI_API_KEY
tr -d '\n' < ~/.secrets/mochi_admin_token | npx wrangler secret put ADMIN_TOKEN
```
No secrets live in `wrangler.toml`.
