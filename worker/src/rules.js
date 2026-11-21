// mochi-brain rules: the action menu, the economy and the validators. Everything that changes the live layer goes
// through here, whether Gemini picked it (tick/chat) or the browser reported it (/event). No negative caps, ever.

export const TRINKETS = ['tiny rubber duck', 'glow-in-the-dark star', 'googly eye (single)', 'mini compass', 'cursed marble', 'sticker of a moose', 'whistle', 'tiny sunglasses', 'bouncy ball', 'plastic gold coin'];
export const VEND_COST = 3;
export const FISH = {
  whitefish: { name: 'mountain whitefish', w: 30, inch: [9, 16], keep: true },
  rainbow: { name: 'rainbow trout', w: 20, inch: [10, 20], keep: true },
  brown: { name: 'brown trout', w: 16, inch: [10, 22], keep: true },
  cutthroat: { name: 'westslope cutthroat trout', w: 14, inch: [9, 18], keep: false },
  sucker: { name: 'largescale sucker', w: 6, inch: [12, 20], keep: false },
  pikeminnow: { name: 'northern pikeminnow', w: 4, inch: [10, 18], keep: false },
  sculpin: { name: 'slimy sculpin', w: 4, inch: [2, 4], keep: false },
  brook: { name: 'brook trout', w: 3, inch: [7, 12], keep: true },
  bull: { name: 'bull trout', w: 3, inch: [14, 28], keep: false },
};
const CROPS = ['carrot', 'potato', 'kale', 'garlic', 'huckleberry'];
export const STAGES = ['stranger', 'friend', 'crush', 'dating'];
const stageFor = (a) => (a >= 85 ? 'dating' : a >= 60 ? 'crush' : a >= 25 ? 'friend' : 'stranger');
const GIFT_KINDS = ['flowers', 'art', 'worms', 'fish', 'honey', 'shells', 'caps', 'cooked', 'veggies'];

const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + (+b || 0), 0);
const N = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const takeOne = (o) => { const k = Object.keys(o).find((q) => o[q] > 0); if (k) o[k]--; return k; };

export function rollFish() {
  const ks = Object.keys(FISH), tot = ks.reduce((a, k) => a + FISH[k].w, 0); let r = Math.random() * tot;
  for (const k of ks) { r -= FISH[k].w; if (r <= 0) { const f = FISH[k]; return { species: k, inches: Math.round(f.inch[0] + Math.random() * (f.inch[1] - f.inch[0])) }; } }
  return { species: 'whitefish', inches: 11 };
}

// normalise whatever shape arrived into the live inventory we keep
export function normInv(i = {}) {
  const map = (o) => { const r = {}; for (const [k, v] of Object.entries(o && typeof o === 'object' ? o : {})) if (N(v) > 0) r[k] = Math.floor(N(v)); return r; };
  return { worms: Math.max(0, Math.floor(N(i.worms, 2))), fish: map(i.fish), cooked: map(i.cooked), seeds: map(i.seeds), crops: map(i.crops), honey: Math.max(0, N(i.honey)), shells: Math.max(0, N(i.shells)),
    firewood: Math.max(0, N(i.firewood, 1)), acorns: Math.max(0, N(i.acorns)), trinkets: Array.isArray(i.trinkets) ? i.trinkets.slice(-40).map((s) => String(s).slice(0, 80)) : [] };
}

// The menu Gemini picks from. `life` = the activity id src/life.js plays in the 3D world. `ok(L, ctx)` gates it.
// `run(L, ctx)` mutates the live layer and returns a short log line in mochi's voice (or { fail } if it couldn't happen).
export const ACTIONS = {
  vend: { life: 'vend', desc: `cap-o-matic vending machine: costs ${VEND_COST} caps, gives a random trinket`, ok: (L) => L.caps >= VEND_COST,
    run(L) { if (L.caps < VEND_COST) return { fail: `only ${L.caps} caps. need ${VEND_COST}. the machine mocks me` }; L.caps -= VEND_COST; const t = pick(TRINKETS); L.inventory.trinkets.push(t); L.purchases.push({ at: Date.now(), item: t, cost: VEND_COST, via: 'cap-o-matic' }); return { text: `put ${VEND_COST} caps in the cap-o-matic. GOT: ${t}!!`, caps: -VEND_COST }; } },
  fish: { life: 'fish', desc: 'fish off the dock (uses a worm if he has one; cutthroat/bull/sucker etc are catch-and-release)',
    run(L) { const bait = L.inventory.worms > 0; if (bait) L.inventory.worms--; if (!bait && Math.random() > 0.35) return { text: 'fished with pure vibes (no worms). nothing. the fish are in a meeting' };
      if (Math.random() < 0.25) return { text: `${bait ? 'worm on, cast, ' : ''}nothing bit. the fish are in a meeting` }; const f = rollFish(), F = FISH[f.species];
      if (F.keep) L.inventory.fish[f.species] = (L.inventory.fish[f.species] || 0) + 1; L.fishLog.push({ species: F.name, inches: f.inches, kept: F.keep, date: L._today });
      return { text: `caught a ${f.inches} inch ${F.name}! ${F.keep ? 'into the bucket' : 'released it, gently. native legend'}` }; } },
  dig: { life: 'dig', desc: 'dig in the garden for worms', run(L) { const n = ri(1, 3); L.inventory.worms = Math.min(30, L.inventory.worms + n); return { text: `dug up ${n} worm${n > 1 ? 's' : ''}. they are my coworkers now` }; } },
  garden: { life: 'water', desc: 'water and tend the garden plots (sometimes a harvest)', ok: (L, c) => !c.freezing || Math.random() < 0.5,
    run(L, c) { if (Math.random() < (c.freezing ? 0.15 : 0.4)) { const k = pick(CROPS); L.inventory.crops[k] = (L.inventory.crops[k] || 0) + 1; return { text: `harvested a ${k}. chunky. respect` }; } return { text: c.freezing ? 'tucked the garden in. it is freezing. the garlic is tough' : 'watered the garden. grow, my children' }; } },
  cook: { life: 'cook', desc: 'cook a fish or veggies at the campfire', ok: (L) => sum(L.inventory.fish) > 0 || ['potato', 'carrot', 'kale'].some((k) => L.inventory.crops[k] > 0),
    run(L) { let k = takeOne(L.inventory.fish), what; if (k) what = `${FISH[k] ? FISH[k].name.split(' ').pop() : 'fish'} skewer`; else { k = ['potato', 'carrot', 'kale'].find((q) => L.inventory.crops[q] > 0); if (!k) return { fail: 'nothing to cook. ate a pretend sandwich' }; L.inventory.crops[k]--; what = `roasted ${k}`; }
      L.inventory.cooked[what] = (L.inventory.cooked[what] || 0) + 1; return { text: `cooked a ${what} at the campfire. smells like victory` }; } },
  eat: { life: 'eat', desc: 'have a snack (cooked food, berries or veggies)', ok: (L) => sum(L.inventory.cooked) + sum(L.inventory.crops) > 0,
    run(L) { const k = takeOne(L.inventory.cooked) || takeOne(L.inventory.crops); if (!k) return { fail: 'no snacks. stared into the void (the pantry)' }; return { text: `ate a ${k}. tummy happy` }; } },
  visit: { life: 'visit', desc: 'row across the river and give the girl kiwi a small gift', ok: (L) => L.world.crush.stage !== 'dating',
    run(L) { const C = L.world.crush; const opts = ['flowers', 'art']; if (sum(L.inventory.cooked)) opts.push('cooked'); if (sum(L.inventory.crops)) opts.push('veggies'); if (L.inventory.shells >= 1) opts.push('shells');
      const g = pick(opts); if (g === 'cooked') takeOne(L.inventory.cooked); if (g === 'veggies') takeOne(L.inventory.crops); if (g === 'shells') L.inventory.shells--;
      const d = ri(2, 7); bumpCrush(L, d, g); return { text: `rowed over and gave her ${g === 'cooked' ? 'some campfire stew' : g === 'veggies' ? 'veggies from the garden' : g}. she smiled (+${d}). i am normal about it` }; } },
  date: { life: 'date', desc: 'hang out on the dock with the girl kiwi (only once they are crushing/dating)', ok: (L) => ['crush', 'dating'].includes(L.world.crush.stage),
    run(L) { const d = ri(1, 4); bumpCrush(L, d, 'date'); return { text: `sat on the dock with her and watched the river. (+${d}) best day` }; } },
  gaming: { life: 'gaming', desc: "play 'grand theft avian vi' on the ps5 (adds hours)", ok: (L) => !!L.world.gaming.found,
    run(L) { const h = Math.round((0.5 + Math.random() * 1.5) * 10) / 10; L.world.gaming.hours = Math.round((N(L.world.gaming.hours) + h) * 10) / 10; return { text: `played grand theft avian vi for ${h}h. drift king of vice beak (${L.world.gaming.hours}h total)` }; } },
  disc: { life: 'disc', desc: 'hunt for the lost game disc', ok: (L) => !L.world.gaming.found,
    run(L) { if (Math.random() < 0.5) { L.world.gaming.found = true; return { text: 'FOUND THE GAME DISC. it was by the tree the whole time' }; } return { text: 'looked for the game disc. found a pinecone. not the same' }; } },
  fly: { life: 'fly', desc: 'fly the floatplane kiwi force one (not in storms or the dark)', ok: (L, c) => !!L.world.plane.owned && !c.storm && !c.dark,
    run(L, c) { if (c.storm || c.dark) return { fail: c.storm ? 'too stormy to fly. kiwi force one stays docked' : 'too dark to fly. i have no headlights' }; L.world.plane.flights = N(L.world.plane.flights) + 1; return { text: `took kiwi force one up over the bitterroot. flight #${L.world.plane.flights}. splashy landing` }; } },
  pet: { life: null, desc: 'pet biscuit the cat', run(L) { const m = pick(['purring', 'happy', 'sleepy', 'playful', 'smug']); L.world.pet.mood = m; return { text: `pet biscuit. biscuit is ${m} now` }; } },
  paint: { life: 'paint', desc: 'make ai art at the market stall and try to sell a print (income: 2-5 caps)',
    run(L) { const sold = Math.random() < 0.6; const title = pick(L._artTitles?.length ? L._artTitles : ['pumpkin that knows what you did']); if (!sold) return { text: `painted a new one. nobody bought "${title}" today. art is pain` };
      const p = ri(2, 5); L.caps += p; return { text: `sold a print of "${title}" for ${p} caps! the art economy is booming`, caps: p }; } },
  caphunt: { life: 'shells', desc: 'search the beach and the squirrel tree for bottle caps (income: sometimes 1 cap)',
    run(L) { if (Math.random() < 0.35) { L.caps += 1; return { text: `found a bottle cap!! cap museum grows. ${L.caps} caps`, caps: 1 }; } return { text: 'searched for caps. found a rock. kept the rock' }; } },
  dust: { life: 'dust', desc: 'dust the bottle cap museum', run() { return { text: 'dusted the cap museum. my son (#17) is so shiny' }; } },
  warm: { life: 'warm', desc: 'warm up at the campfire (uses firewood if any)', run(L) { if (L.inventory.firewood > 0) L.inventory.firewood--; return { text: 'warmed my toes at the campfire. toasty bird' }; } },
  sleep: { life: 'sleep', desc: 'nap in the hut (good at night)', run() { return { text: 'napped in the hut. zzz. dreamed of the ocean' }; } },
  shells: { life: 'shells', desc: 'beachcomb for shells', run(L) { if (Math.random() < 0.6) { L.inventory.shells++; return { text: 'found a shell on the beach. pocketed' }; } return { text: 'beachcombed. found mostly sand' }; } },
  browse: { life: 'browse', desc: 'browse the laptop at the picnic table', run() { return { text: 'browsed the laptop. read about a very chunky badger' }; } },
  jam: { life: 'jam', desc: 'jam on the music stage', run() { return { text: 'jammed on the music stage. the squirrel did not clap' }; } },
  telescope: { life: 'telescope', desc: 'look through the treehouse telescope (best at night)', run() { return { text: 'looked through the telescope. the stars kept the promise' }; } },
  skip: { life: 'skip', desc: 'skip rocks at the pond', run() { const n = ri(1, 6); return { text: `skipped a rock ${n} times. ${n > 4 ? 'LEGEND' : 'the pond is not ready for me'}` }; } },
  treehouse: { life: 'treehouse', desc: 'work on the treehouse', run() { return { text: 'worked on the treehouse. hammered a thing. it held' }; } },
  reminisce: { life: 'reminisce', desc: 'look through old memories in the hut', run() { return { text: 'looked at old memories. got a little misty. its fine' }; } },
};

export function bumpCrush(L, d, gift) {
  const C = L.world.crush; C.affection = Math.max(0, Math.min(100, N(C.affection) + d));
  const s = stageFor(C.affection); if (STAGES.indexOf(s) > STAGES.indexOf(C.stage || 'stranger')) C.stage = s;
  if (gift) { C.gifts = [...(C.gifts || []), gift].slice(-12); } C.lastVisit = L._today;
}

// menu text for prompts: only what's possible right now
export function menuFor(L, ctx) { return Object.entries(ACTIONS).filter(([, a]) => !a.ok || a.ok(L, ctx)).map(([id, a]) => `- ${id}: ${a.desc}`).join('\n'); }

export function runAction(L, id, ctx, src) {
  const a = ACTIONS[id]; if (!a) return { ok: false, id, text: 'not a thing i can do' };
  if (a.ok && !a.ok(L, ctx)) return { ok: false, id, text: id === 'vend' ? `only ${L.caps} caps, need ${VEND_COST}` : `can't ${id} right now` };
  const r = a.run(L, ctx) || {}; if (r.fail) return { ok: false, id, text: r.fail };
  if (L.caps < 0) L.caps = 0; // belt and braces
  const entry = { at: Date.now(), id, src, text: r.text, caps: r.caps || 0 }; L.log.push(entry);
  L.activity = r.text; L.activityId = a.life; L.actionAt = entry.at;
  return { ok: true, id, life: a.life, text: r.text };
}

// browser-reported events (POST /event). Each one is validated against the live layer before it sticks.
export function applyEvent(L, ev) {
  const type = String(ev?.type || '');
  if (type === 'vend') { const item = String(ev.item || ''); if (!TRINKETS.includes(item)) return { ok: false, error: 'unknown item' }; if (L.caps < VEND_COST) return { ok: false, error: `need ${VEND_COST} caps, have ${L.caps}` };
    L.caps -= VEND_COST; L.inventory.trinkets.push(item); L.purchases.push({ at: Date.now(), item, cost: VEND_COST, via: 'cap-o-matic (visitor)' }); return { ok: true, text: `bought a ${item} from the cap-o-matic` }; }
  if (type === 'gift') { const kind = String(ev.kind || ''); if (!GIFT_KINDS.includes(kind)) return { ok: false, error: 'unknown gift' };
    const I = L.inventory; const has = { flowers: true, art: true, worms: I.worms > 0, fish: sum(I.fish) > 0, honey: I.honey > 0, shells: I.shells > 0, caps: L.caps > 0, cooked: sum(I.cooked) > 0, veggies: sum(I.crops) > 0 }[kind];
    if (!has) return { ok: false, error: `no ${kind} to give` };
    if (kind === 'worms') I.worms--; else if (kind === 'fish') takeOne(I.fish); else if (kind === 'honey') I.honey--; else if (kind === 'shells') I.shells--; else if (kind === 'caps') L.caps--; else if (kind === 'cooked') takeOne(I.cooked); else if (kind === 'veggies') takeOne(I.crops);
    const d = Math.max(-5, Math.min(10, Math.round(N(ev.d, 3)))); bumpCrush(L, d, kind); return { ok: true, text: `gave her ${kind} (${d >= 0 ? '+' : ''}${d})` }; }
  if (type === 'fish') { const k = String(ev.species || ''); const F = FISH[k]; const inch = Math.round(N(ev.inches)); if (!F || inch < F.inch[0] - 1 || inch > F.inch[1] + 1) return { ok: false, error: 'fishy fish' };
    if (ev.bait && L.inventory.worms > 0) L.inventory.worms--; if (F.keep) L.inventory.fish[k] = (L.inventory.fish[k] || 0) + 1; L.fishLog.push({ species: F.name, inches: inch, kept: F.keep, date: L._today }); return { ok: true, text: `caught a ${inch} inch ${F.name}` }; }
  if (type === 'disc') { if (L.world.gaming.found) return { ok: false, error: 'already found' }; L.world.gaming.found = true; return { ok: true, text: 'found the game disc!' }; }
  if (type === 'gaming') { if (!L.world.gaming.found) return { ok: false, error: 'no disc' }; const h = Math.max(0, Math.min(1, N(ev.hours, 0.2))); L.world.gaming.hours = Math.round((N(L.world.gaming.hours) + h) * 10) / 10; return { ok: true, text: `played ${h}h` }; }
  if (type === 'worms') { const n = Math.max(0, Math.min(3, Math.round(N(ev.n, 1)))); L.inventory.worms = Math.min(30, L.inventory.worms + n); return { ok: true, text: `dug ${n} worms` }; }
  if (type === 'pet') { L.world.pet.mood = pick(['purring', 'happy', 'smug']); return { ok: true, text: 'pet biscuit' }; }
  return { ok: false, error: 'unknown event' };
}
