// Mochi's day-to-day: inventory + an activity at every place, chained into little quests
// (dig worms in the garden -> fish at the dock -> cook at the campfire -> eat). Reads STATE, simulates the rest live in the page.
import * as THREE from 'three';
import { ZONES, groundY, topH, DOCK, WATER_Y, mv, SHOP } from './layout.js';
import { FISH, rollFish, fishMesh, speciesKey } from './fish.js';
import { CROPS } from './features.js';

const N = (v) => (Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : 0);
const zone = (id) => ZONES.find((z) => z.id === id);
const TRINKETS = ['tiny rubber duck', 'glow-in-the-dark star', 'googly eye (single)', 'mini compass', 'cursed marble', 'sticker of a moose', 'whistle', 'tiny sunglasses', 'bouncy ball', 'plastic gold coin'];
const YODEL = ['YODEL-AY-HEE-HOOOO', 'HELLO TRAPPER PEAK', 'ECHOOOO', 'i am the king of this rock'];

export function normInventory(s = {}) {
  const i = s.inventory && typeof s.inventory === 'object' ? s.inventory : {};
  const map = (o) => { const r = {}; if (o && typeof o === 'object') for (const k in o) if (N(o[k])) r[k] = N(o[k]); return r; };
  const fish = {}; for (const k in (i.fish || {})) { const sk = speciesKey(k) || k; if (N(i.fish[k])) fish[sk] = (fish[sk] || 0) + N(i.fish[k]); }
  return { worms: N(i.worms ?? 2), fish, cooked: map(i.cooked), seeds: Object.keys(map(i.seeds)).length ? map(i.seeds) : { carrot: 3, garlic: 2, kale: 2 }, crops: map(i.crops), honey: N(i.honey), shells: N(i.shells), firewood: N(i.firewood ?? 1), acorns: N(i.acorns), caps: N(s.caps), trinkets: Array.isArray(i.trinkets) ? i.trinkets.slice(0, 30).map(String) : [] };
}
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

export function createLife({ state, mochi, features, say, music, sky, feel, onChange = () => {} }) {
  const inv = normInventory(state); const fishLog = (Array.isArray(state.fishLog) ? state.fishLog : []).slice(-50).map((f) => ({ ...f }));
  const encounters = []; const P = features.props; const plots = features.plots;
  let cur = null, lift = 0, liftTarget = 0, face = null, held = null, posTarget = null, last = '';
  const ctx = { t: 0 };
  const changed = () => onChange(inv, fishLog);
  function hold(obj, rot = [0, 0, 0], sc = 1) { drop(); if (!obj) return; held = obj; obj.position.set(0, 0, 0); obj.rotation.set(...rot); obj.scale.setScalar(sc); obj.visible = true; mochi.hold.add(obj); }
  function drop() { if (held) { mochi.hold.remove(held); held = null; } }
  const fx = { // tiny particle helpers
    rings(x, z, y = WATER_Y + 0.02) { P.rings.forEach((r, i) => { r.position.set(x, y, z); r.userData.t = -i * 0.25; r.visible = true; }); },
    puff(x, y, z, col = 0xdedede) { P.puffs.forEach((p, i) => { p.position.set(x, y, z); p.material.color.set(col); p.userData = { t: -i * 0.15, x, y, z }; p.visible = true; }); },
    spark(x, y, z) { P.sparks.forEach((p, i) => { p.userData = { t: 0, x, y, z, a: i * 0.785 }; p.visible = true; }); },
  };
  const M = () => mochi.root.position; const pose = mochi.pose;
  const ahead = (d = 0.9) => { const h = mochi.root.rotation.y; return new THREE.Vector3(M().x + Math.sin(h) * d, 0, M().z + Math.cos(h) * d); };

  // ── activities: name -> { zone, label, steps: [{ d, start(), tick(u, dt, t), end() }] } ──
  const A = {};
  A.dig = { zone: 'garden', label: '🪱 digging for worms', steps: [
    { d: 2.6, start() { say('worm time. kiwis are literally built for this', 2.6); pose.peck = 1; }, tick(u) { if (Math.random() < 0.08) { const p = ahead(0.8); fx.puff(p.x, groundY(p.x, p.z) + 0.05, p.z, 0x6a4a2a); } } },
    { d: 1.8, start() { pose.peck = 0; const n = 1 + Math.floor(Math.random() * 3); inv.worms += n; hold(P.worm.clone(), [0, Math.PI / 2, 0]); say(`+${n} worm${n > 1 ? 's' : ''} 🪱 (sorry guys)`, 2); changed(); } },
    { d: 0.2, start() { drop(); } } ] };
  A.plant = { zone: 'garden', label: '🌱 planting', steps: [
    { d: 3, start() { const p = plots.find((q) => !q.crop || q.stage === 0); const seed = Object.keys(inv.seeds).find((k) => inv.seeds[k] > 0) || 'garlic'; if (p) { posTarget = new THREE.Vector3(p.x, 0, p.z + 0.9); p.crop = seed; p.stage = 1; inv.seeds[seed] = Math.max(0, (inv.seeds[seed] || 1) - 1); this.p = p; say(`planting ${seed}. grow, little guy`, 3); } pose.peck = 1; },
      end() { pose.peck = 0; if (this.p) { features.drawPlot(this.p); fx.spark(this.p.x, topH(this.p.x, this.p.z) + 0.4, this.p.z); } changed(); } } ] };
  A.water = { zone: 'garden', label: '💧 watering the garden', steps: [
    { d: 3.2, start() { const p = plots.filter((q) => q.crop && q.stage > 0 && q.stage < 4).sort((a, b) => a.watered - b.watered)[0]; this.p = p; if (p) posTarget = new THREE.Vector3(p.x, 0, p.z + 0.9); hold(P.can.clone(), [0.3, 0, 0], 0.9); say('hydration station', 2); },
      tick() { pose.sway = 0.6; if (this.p && Math.random() < 0.15) fx.puff(this.p.x, topH(this.p.x, this.p.z) + 0.3, this.p.z, 0x8ac8ff); }, end() { pose.sway = 0; drop(); if (this.p) { this.p.watered = ctx.t; this.p.grow += 0.5; } } } ] };
  A.harvest = { zone: 'garden', label: '🧺 harvesting', steps: [
    { d: 2.4, start() { const p = plots.find((q) => q.crop && q.stage >= 4); this.p = p; if (p) posTarget = new THREE.Vector3(p.x, 0, p.z + 0.9); pose.peck = 1; },
      end() { pose.peck = 0; const p = this.p; if (!p) return; const c = p.crop; const n = c === 'huckleberry' ? 6 : c === 'pumpkin' ? 1 : 3; inv.crops[c] = (inv.crops[c] || 0) + n; inv.seeds[c] = (inv.seeds[c] || 0) + 1;
        if (c === 'huckleberry') p.stage = 3; else { p.stage = 0; p.crop = c; } features.drawPlot(p); say(`harvested ${n} ${c}${n > 1 ? 's' : ''} ${CROPS[c].emoji}  montana grown baby`, 3); fx.spark(p.x, topH(p.x, p.z) + 0.4, p.z); changed(); } } ] };
  const fz = {}; // shared across fishing steps (each step has its own `this`)
  A.fish = { zone: 'dock', label: '🎣 fishing', steps: [
    { d: 1.2, start() { posTarget = new THREE.Vector3(DOCK.x1 - DOCK.dx * 0.7, 0, DOCK.z1 - DOCK.dz * 0.7); face = Math.atan2(DOCK.dx, DOCK.dz); hold(P.rod, [-0.9, 0, 0]); mochi.flap(0.6);
        if (inv.worms > 0) { inv.worms--; fz.bait = true; say('worm on. casting. respectfully', 1.6); } else { fz.bait = false; say('no worms. fishing with pure vibes', 1.6); } changed();
        const d = 3 + Math.random() * 1.5; fz.bob = new THREE.Vector3(DOCK.x1 + DOCK.dx * d, WATER_Y + 0.02, DOCK.z1 + DOCK.dz * d + (Math.random() - 0.5)); P.bobber.position.copy(fz.bob); P.bobber.visible = true; P.line.visible = true; } },
    { d: 4 + Math.random() * 4, tick(u, dt, t) { P.bobber.position.copy(fz.bob).setY(WATER_Y + 0.03 + Math.sin(t * 2.2) * 0.015); pose.sway = 0.3; } },
    { d: 0.9, start() { fz.catch = fz.bait || Math.random() < 0.35 ? rollFish() : null; }, tick(u, dt, t) { P.bobber.position.y = WATER_Y - (fz.catch ? 0.08 * Math.abs(Math.sin(t * 16)) : 0); if (fz.catch && Math.random() < 0.2) fx.rings(fz.bob.x, fz.bob.z); } },
    { d: 1.1, start() { pose.sway = 0; P.bobber.visible = false; if (!fz.catch) { say('nothing. the fish are in a meeting', 2); return; } const f = fz.catch; fz.mesh = fishMesh(f.species); fz.mesh.scale.setScalar(0.25 + f.inches * 0.022); features.group.add(fz.mesh); mochi.flap(1); },
      tick(u) { if (!fz.mesh) return; const a = fz.bob, b = M(); fz.mesh.position.set(a.x + (b.x - a.x) * u, WATER_Y + Math.sin(u * Math.PI) * 1.6 + u * 0.9, a.z + (b.z - a.z) * u); fz.mesh.rotation.set(Math.sin(u * 20) * 0.6, u * 6, 0); } },
    { d: 2.6, start() { P.line.visible = false; if (!fz.mesh) { drop(); return; } features.group.remove(fz.mesh); const f = fz.catch, F = FISH[f.species]; hold(fz.mesh, [0, Math.PI / 2, 0.2], 0.2 + f.inches * 0.016);
        fishLog.push({ species: F.name, inches: f.inches, kept: F.keep, at: 'dock', date: new Date().toLocaleDateString('en-CA') });
        say(`${F.name}! ${f.inches} in. ${F.keep ? 'into the bucket 🪣' : F.why}`, 3.2); changed(); } },
    { d: 1.2, start() { if (!fz.catch) return; const F = FISH[fz.catch.species]; if (F.keep) { inv.fish[fz.catch.species] = (inv.fish[fz.catch.species] || 0) + 1; } else { mochi.flap(0.8); fx.rings(fz.bob.x, fz.bob.z); } drop(); changed(); },
      end() { drop(); face = null; } } ] };
  A.cook = { zone: 'campfire', label: '🔥 cooking', steps: [
    { d: 1.2, start() { const k = Object.keys(inv.fish).find((s) => inv.fish[s] > 0); const crop = !k && Object.keys(inv.crops).find((c) => ['potato', 'carrot', 'kale', 'garlic', 'pumpkin'].includes(c) && inv.crops[c] > 0);
        this.what = k ? { fish: k } : crop ? { crop } : null; if (!this.what) return; if (k) inv.fish[k]--; else inv.crops[crop]--; if (inv.firewood > 0) inv.firewood--;
        this.mesh = k ? fishMesh(k) : new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: CROPS[crop].fruit })); this.mesh.scale.setScalar(k ? 0.42 : 1); this.mesh.rotation.y = Math.PI / 2; this.mesh.userData.food = true; P.skewer.add(this.mesh); P.skewer.visible = true;
        say(k ? `roasting a ${FISH[k].name}. chef mochi is in` : `roasting a ${crop}. campfire cuisine`, 2.5); changed(); } },
    { d: 6, tick(u, dt, t) { if (!this.what) return; P.skewer.rotation.x = t * 2; if (Math.random() < 0.06) fx.puff(P.skewer.position.x, P.skewer.position.y + 0.3, P.skewer.position.z); if (u > 0.5 && this.mesh) this.mesh.traverse((o) => o.material && o.material.color && o.material.color.lerp(new THREE.Color(0x8a5a2a), 0.02)); if (Math.random() < 0.02) music.sfx('sizzle'); pose.sway = 0.4; } },
    { d: 0.3, start() { pose.sway = 0; if (!this.what) return; P.skewer.remove(this.mesh); P.skewer.visible = false; const name = this.what.fish ? `cooked ${FISH[this.what.fish].name}` : `roasted ${this.what.crop}`; inv.cooked[name] = (inv.cooked[name] || 0) + 1; changed(); } },
    { d: 3.2, start() { if (!this.what) return; hold(this.mesh, [0, Math.PI / 2, 0], 0.3); pose.peck = 1; }, end() { pose.peck = 0; drop(); if (!this.what) return; const name = Object.keys(inv.cooked).find((k) => inv.cooked[k] > 0); if (name) inv.cooked[name]--; mochi.mods.perk = 1; say(`ate the ${name || 'snack'}. 10/10. mood +100`, 3); fx.spark(M().x, M().y + 1.4, M().z); changed(); } } ] };
  A.warm = { zone: 'campfire', label: '🔥 warming up', steps: [{ d: 7, start() { say(feel.cold > 0.4 ? 'toasting my little wings. it is COLD' : 'campfire vibes', 3); }, tick(u, dt, t) { pose.sway = 0.5; if (Math.random() < dt * 0.6) mochi.flap(0.4); }, end() { pose.sway = 0; mochi.mods.cold = Math.max(0, mochi.mods.cold - 0.3); } }] };
  A.sleep = { zone: 'hut', label: '😴 napping', steps: [{ d: 12, start() { say('z z z', 12); }, tick() { pose.sleep = Math.min(1, pose.sleep + 0.05); }, end() { pose.sleep = 0; mochi.hop(0.5); say('i was not asleep', 2); } }] };
  A.mail = { zone: 'hut', label: '📬 checking the mail', steps: [{ d: 3.5, start() { const m = features.mailbox.unread[0]; say(m ? `mail from ${m.from || 'someone'}: "${String(m.subject || m.text || '...').slice(0, 50)}"` : 'no mail. not even a bill', 3.5); if (m) { m.unread = false; features.mailbox.unread.shift(); if (!features.mailbox.unread.length) features.mailbox.flag.rotation.z = -Math.PI / 2; } pose.peck = 0.5; }, end() { pose.peck = 0; } }] };
  A.skip = { zone: 'pond', label: '🪨 skipping rocks', steps: [0, 1, 2].map(() => ({ d: 1.8, start() { mochi.flap(0.6); this.a = ahead(0.5); this.b = ahead(2.6 + Math.random()); P.stone.visible = true; }, tick(u) { const a = this.a, b = this.b; const k = Math.min(1, u * 1.3); P.stone.position.set(a.x + (b.x - a.x) * k, -0.3 + Math.abs(Math.sin(k * Math.PI * 3)) * 0.35 * (1 - k) + 0.6 * (1 - k), a.z + (b.z - a.z) * k); if (k > 0.33 && !this.r1) { this.r1 = 1; fx.rings(P.stone.position.x, P.stone.position.z, -0.3); } }, end() { P.stone.visible = false; this.r1 = 0; } }))
    .concat([{ d: 1.5, start() { say(`${3 + Math.floor(Math.random() * 6)} skips. olympic`, 1.8); } }]) };
  // treehouse: climb the rope ladder, stand on the deck; below the top stage Mochi hammers away (STATE.treehouse.stage only changes when the bot sets it)
  const TH = () => features.treehouse; const upY = () => TH().deckY - groundY(M().x, M().z);
  const faceTrunk = () => { const p = TH().ladder, c = TH().group.position; face = Math.atan2(c.x - p.x, c.z - p.z); };
  const STAGE_TALK = ['treehouse: step 0. it is a vibe right now', 'ladder: done. floor: some of it', 'the platform holds a kiwi. tested', 'railings, so nobody falls. mostly me', 'walls going up. very structural', 'roof, door, window. architect energy', 'treehouse: complete. accepting visitors (not squirrels)'];
  A.treehouse = { zone: 'tree', get label() { const st = features.treehouse.stage; return st < 6 ? `🔨 building the treehouse (${st}/6)` : '🌳 hanging in the treehouse'; }, steps: [
    { d: 1.6, start() { posTarget = TH().ladder.clone(); faceTrunk(); } },
    { d: 2.6, tick(u) { if (TH().stage < 1) return; liftTarget = u * (TH().top.y - TH().ladder.y); pose.sway = 0.5; if (Math.random() < 0.04) music?.sfx?.('step'); } },
    { d: 1.4, start() { pose.sway = 0; if (TH().stage < 1) return; posTarget = TH().top.clone(); }, tick() { if (TH().stage >= 1) liftTarget = upY(); } },
    { d: 1.4, start() { if (TH().stage < 2) return; posTarget = TH().deck.clone(); }, tick() { if (TH().stage >= 1) liftTarget = upY(); }, end() { const c = TH().group.position; if (TH().stage >= 2) face = Math.atan2(M().x - c.x, M().z - c.z); } },
    { d: 8, start() { const st = TH().stage; this.k = 0; if (st < 6) { hold(P.plank, [0, 0.3, 0.2]); say(STAGE_TALK[st], 3); } else say(['treehouse inspection: passed', 'i can see the squirrel from here. he can see me', 'the owl lives upstairs. we do not talk'][Math.floor(Math.random() * 3)], 3); },
      tick(u, dt, t) { if (TH().stage >= 1) liftTarget = upY(); if (TH().stage >= 6) { if (Math.random() < dt * 0.3) mochi.hop(0.3); return; }
        pose.peck = 0.5 + 0.5 * Math.sin(t * 9); this.k = (this.k || 0) + dt; if (this.k > 0.45) { this.k = 0; const p = ahead(0.45); fx.puff(p.x, M().y + 0.15, p.z, 0xe8c890); music?.sfx?.('thunk'); } },
      end() { pose.peck = 0; drop(); } },
    { d: 1.4, start() { if (TH().stage < 1) return; posTarget = TH().top.clone(); }, tick() { if (TH().stage >= 1) liftTarget = upY(); } },
    { d: 1.0, start() { if (TH().stage < 1) return; posTarget = TH().ladder.clone(); faceTrunk(); }, tick() { if (TH().stage >= 1) liftTarget = upY(); } },
    { d: 2.2, tick(u) { if (TH().stage < 1) return; liftTarget = (1 - u) * (TH().top.y - TH().ladder.y); pose.sway = 0.5; } } ], end() { liftTarget = 0; face = null; pose.sway = 0; pose.peck = 0; } };
  A.skate = { zone: 'ramp', label: '🛹 skate session', steps: [{ d: 9, start() { const [rx, rz] = mv(9.6, 6.0); this.c = new THREE.Vector3(rx, 0, rz); this.ax = new THREE.Vector3(Math.cos(-0.55), 0, -Math.sin(-0.55)); hold(P.board, [0, 0, 0]); P.board.position.set(0, -0.33, -1.2); P.board.rotation.set(0, 0, 0); mochi.root.add(P.board); held = null; say('KICKFLIP ARC: chapter 1', 2.5); this.base = topH(rx, rz); },
    tick(u, dt, t) { const x = 1.5 * Math.sin(t * 1.8); const p = this.c.clone().addScaledVector(this.ax, x); M().x = p.x; M().z = p.z; posTarget = null; const ex = Math.max(0, Math.abs(x) - 0.6); liftTarget = (ex > 0 ? 1.1 - Math.sqrt(Math.max(0, 1.21 - ex * ex)) : 0) + Math.max(0, this.base - groundY(p.x, p.z)); face = Math.atan2(this.ax.x, this.ax.z) * (Math.cos(t * 1.8) > 0 ? 1 : -1) + (Math.cos(t * 1.8) > 0 ? 0 : Math.PI) * 0; if (Math.abs(x) > 1.45 && Math.random() < 0.1) mochi.hop(0.4); },
    end() { mochi.root.remove(P.board); liftTarget = 0; face = null; say('landed it (mentally)', 2); } }] };
  A.dust = { zone: 'museum', label: '🧢 dusting the caps', steps: [{ d: 5, start() { say('dusting my son (#17). he is so shiny', 3); }, tick(u, dt) { pose.peck = 0.6; if (Math.random() < dt * 1.2) mochi.flap(0.3); if (Math.random() < dt * 0.8) { const p = ahead(0.7); fx.spark(p.x, M().y + 1.0, p.z); } }, end() { pose.peck = 0; } }] };
  A.trade = { zone: 'squirrel', label: '🐿️ trading with the squirrel', steps: [
    { d: 2.5, start() { this.give = inv.worms > 0 ? 'worm' : Object.keys(inv.crops).find((c) => inv.crops[c] > 0) || 'shell'; say(`offering one (1) ${this.give}. diplomacy`, 2.5); } },
    { d: 2.5, start() { const ok = Math.random() < 0.7; if (ok) { if (this.give === 'worm') inv.worms--; else if (inv.crops[this.give]) inv.crops[this.give]--; inv.acorns++; say('he gave me an acorn. the cold war thaws', 2.5); } else say('he said no. RUDE', 2.5); changed(); } } ] };
  A.yodel = { zone: 'cliff', label: '🏔️ yodeling at Trapper Peak', steps: [
    { d: 2.6, start() { mochi.pose.puff = 0.3; say(YODEL[Math.floor(Math.random() * YODEL.length)], 2.6); mochi.flap(1); } },
    { d: 2.2, start() { mochi.pose.puff = 0; say('...hoooo (echo)', 2); } },
    { d: 3, start() { const s = features.station; say(`weather station says ${s.temp}, ${s.cond}`, 3); } } ] };
  A.shells = { zone: 'beach', label: '🐚 shell hunting', steps: [{ d: 5, start() { say('river shells. ocean practice', 2.5); }, tick(u, dt) { pose.peck = 0.8; if (Math.random() < dt * 0.5) { const p = ahead(0.6); fx.puff(p.x, groundY(p.x, p.z) + 0.05, p.z, 0xe8d8a8); } }, end() { pose.peck = 0; const n = 1 + Math.floor(Math.random() * 2); inv.shells += n; say(`+${n} shell${n > 1 ? 's' : ''} 🐚`, 2); changed(); } }] };
  A.honey = { zone: 'meadow', label: '🍯 collecting honey', steps: [{ d: 5, start() { say('asking the bees nicely for honey', 2.5); }, tick(u, dt) { pose.sway = 0.4; if (Math.random() < dt * 0.6) mochi.hop(0.25); }, end() { pose.sway = 0; if (Math.random() < 0.25) say('got stung (lightly). worth it', 2.5); else say('+1 honey 🍯', 2); inv.honey++; changed(); } }] };
  A.curate = { zone: 'shop', label: '🖼️ rearranging the gallery', steps: [{ d: 5, start() { posTarget = new THREE.Vector3(SHOP.x, 0, SHOP.z); say('curating. moving that one 2mm left', 3); }, tick(u, dt) { pose.peck = 0.4; if (Math.random() < dt * 0.6) { fx.spark(M().x + Math.sin(mochi.root.rotation.y) * 0.8, M().y + 1.2, M().z + Math.cos(mochi.root.rotation.y) * 0.8); } }, end() { pose.peck = 0; } }] };
  A.paint = { zone: 'market', label: '🎨 painting', steps: [{ d: 7, start() { say('painting masterpiece #' + ((state.art || []).length + 1) + '. do not look', 3); }, tick(u, dt) { pose.sway = 0.5; if (Math.random() < dt * 1.5) { const p = ahead(0.8); fx.spark(p.x, M().y + 1.1, p.z); } }, end() { pose.sway = 0; } }] };
  A.jam = { zone: 'music', label: '🎸 jamming', steps: [{ d: 10, start() { if (music.started && !music.playing && music.songs.length) music.play(); say(music.songs.length ? `playing "${(music.current || music.songs[0]).title}"` : 'beatboxing (no songs yet)', 3); }, tick(u, dt, t) { pose.sway = 1; if (Math.random() < dt * 1.2) mochi.hop(0.3); }, end() { pose.sway = 0; } }] };
  A.eat = { zone: 'picnic', label: '🧺 snack time', steps: [{ d: 4, start() { const c = Object.keys(inv.cooked).find((k) => inv.cooked[k] > 0) || (inv.honey ? 'honey' : null) || Object.keys(inv.crops).find((k) => inv.crops[k] > 0); this.c = c; if (!c) return say('snack inventory: zero. tragic', 2.5); if (inv.cooked[c]) inv.cooked[c]--; else if (c === 'honey') inv.honey--; else inv.crops[c]--; say(`eating ${c}. ${['delicious', 'elite', 'tastes like montana'][Math.floor(Math.random() * 3)]}`, 3); pose.peck = 1; changed(); }, end() { pose.peck = 0; if (this.c) mochi.mods.perk = 1; } }] };
  A.browse = { zone: 'picnic', label: '💻 browsing the web', steps: [{ d: 9, start() { const L = features.laptop; posTarget = L.pos.clone().add(new THREE.Vector3(Math.sin(L.yaw) * 0.85, 0, Math.cos(L.yaw) * 0.85)); face = L.yaw + Math.PI; const [site, txt] = L.lines(); L.lid.rotation.x = -0.25; say(`reading ${site}: ${txt.slice(0, 60)}`, 4); }, tick(u, dt) { pose.peck = 0.15; }, end() { pose.peck = 0; face = null; } }] };
  A.vend = { zone: 'vending', label: '🎰 Cap-O-Matic', steps: [
    { d: 2, start() { const V = features.vend; if (inv.caps < 3) { this.no = true; say(`${inv.caps} caps. need 3. the machine mocks me`, 2.5); return; } inv.caps -= 3; say('3 caps in. come on come on', 2); changed(); this.V = V; }, tick(u, dt) { if (this.V?.knob) this.V.knob.rotation.z += dt * 6; } },
    { d: 2.5, start() { if (this.no) return; const tr = TRINKETS[Math.floor(Math.random() * TRINKETS.length)]; inv.trinkets.push(tr); if (this.V?.cap) this.V.cap.visible = true; mochi.flap(1); mochi.hop(0.7); say(`GOT: ${tr}!!`, 2.5); changed(); }, end() { if (this.V?.cap) this.V.cap.visible = false; } } ] };
  A.pumpkins = { zone: 'pumpkins', label: '🎃 pumpkin check', steps: [{ d: 4, start() { say('checking on the pumpkins. they are being weird again', 2.5); pose.peck = 0.5; }, end() { pose.peck = 0; } }] };

  const BY_ZONE = { garden: ['dig', 'plant', 'water', 'harvest'], dock: ['fish'], campfire: ['cook', 'warm'], hut: ['sleep', 'mail'], pond: ['skip'], tree: ['treehouse'], ramp: ['skate'], museum: ['dust'], squirrel: ['trade'], cliff: ['yodel'], beach: ['shells'], meadow: ['honey'], shop: ['curate'], market: ['paint'], music: ['jam'], picnic: ['browse', 'eat'], vending: ['vend'], pumpkins: ['pumpkins'] };
  // which activity makes sense at a zone right now
  function choose(zid, prefer) {
    if (prefer && A[prefer] && A[prefer].zone === zid) return prefer;
    if (zid === 'garden') { if (plots.some((p) => p.crop && p.stage >= 4)) return 'harvest'; if (plots.some((p) => !p.crop || p.stage === 0) && sum(inv.seeds) > 0 && Math.random() < 0.5) return 'plant'; if (Math.random() < 0.35 && plots.some((p) => p.crop && p.stage > 0 && p.stage < 4)) return 'water'; return 'dig'; }
    if (zid === 'campfire') return sum(inv.fish) > 0 || (Math.random() < 0.4 && ['potato', 'carrot', 'kale'].some((c) => inv.crops[c] > 0)) ? 'cook' : 'warm';
    if (zid === 'hut') return features.mailbox.unread.length ? 'mail' : 'sleep';
    if (zid === 'picnic') return (sum(inv.cooked) > 0 || inv.honey > 0) && Math.random() < 0.5 ? 'eat' : 'browse';
    const l = BY_ZONE[zid]; return l ? l[Math.floor(Math.random() * l.length)] : null;
  }
  // quest chain: what's the next useful place?
  function suggest() {
    const night = sky.state.night;
    if (night > 0.7 && Math.random() < 0.45) return 'hut';
    if (feel.cold > 0.6 && Math.random() < 0.3) return 'campfire';
    if (Math.random() > 0.6) return null; // free roam
    if (sum(inv.cooked) > 0) return Math.random() < 0.5 ? 'picnic' : 'campfire';
    if (sum(inv.fish) > 0) return 'campfire';
    if (inv.worms > 0) return 'dock';
    if (plots.some((p) => p.crop && p.stage >= 4)) return 'garden';
    if (inv.caps >= 3 && Math.random() < 0.15) return 'vending';
    return Math.random() < 0.6 ? 'garden' : null;
  }
  // STATE.activity / location keywords -> first activity
  const KEYS = [[/fish|angl|cast|rod\b/, 'fish'], [/cook|roast|grill|campfire|s'more/, 'cook'], [/plant|sow|seed/, 'plant'], [/water(ing)? (the )?(garden|plants)/, 'water'], [/harvest|pick(ing)? (carrot|potato|berr)/, 'harvest'], [/dig|worm/, 'dig'],
    [/brows|laptop|internet|online|web|google|reading the news/, 'browse'], [/sleep|nap|bed|snooz/, 'sleep'], [/skate|kickflip/, 'skate'], [/treehouse|tree house|climb/, 'treehouse'], [/yodel|weather station/, 'yodel'], [/paint|draw/, 'paint'],
    [/music|song|jam|drum|guitar|uke/, 'jam'], [/honey|bee/, 'honey'], [/shell/, 'shells'], [/skip(ping)? (rocks|stones)/, 'skip'], [/vending|cap-o-matic|trinket/, 'vend'], [/mail/, 'mail'], [/dust/, 'dust'], [/trade|squirrel/, 'trade'], [/eat|snack|lunch|dinner/, 'eat']];
  function fromText(s) { const t = String(s || '').toLowerCase(); for (const [re, a] of KEYS) if (re.test(t)) return a; return null; }
  const initial = fromText(state.activity);

  let queued = initial;
  function begin(zid) {
    const id = choose(zid, queued); if (id === queued) queued = null; if (!id) return false; const def = A[id];
    cur = { id, def, k: -1, el: 0, steps: def.steps.map((s) => ({ ...s })), bag: {} }; face = null; posTarget = null; last = def.label; next(); onChange(inv, fishLog, def.label); return true;
  }
  function next() { const c = cur; if (c.k >= 0) c.steps[c.k].end?.call(c.bag); c.k++; c.el = 0; if (c.k >= c.steps.length) { c.def.end?.(); drop(); pose.peck = pose.sway = 0; cur = null; posTarget = null; onChange(inv, fishLog, ''); return; } c.steps[c.k].start?.call(c.bag); }
  function update(dt, t) {
    ctx.t = t;
    // garden grows while you watch (slower in the cold)
    for (const p of plots) { if (!p.crop || p.stage >= 4 || p.stage === 0) continue; p.grow += dt / 70 * features.growSlow * (ctx.t - p.watered < 120 ? 1.6 : 1); if (p.grow >= 1) { p.grow = 0; p.stage++; features.drawPlot(p); } }
    // fx
    for (const r of P.rings) if (r.visible) { r.userData.t += dt; const u = r.userData.t; if (u < 0) continue; r.scale.setScalar(1 + u * 4); r.material.opacity = Math.max(0, 0.6 * (1 - u)); if (u > 1) r.visible = false; }
    for (const p of P.puffs) if (p.visible) { p.userData.t += dt; const u = p.userData.t; if (u < 0) continue; p.position.y = p.userData.y + u * 0.8; p.scale.setScalar(0.5 + u * 1.5); p.material.opacity = Math.max(0, 0.45 * (1 - u)); if (u > 1) p.visible = false; }
    for (const s of P.sparks) if (s.visible) { const d = s.userData; d.t += dt; const u = d.t; s.position.set(d.x + Math.cos(d.a) * u * 0.6, d.y + u * 0.5 - u * u * 0.4, d.z + Math.sin(d.a) * u * 0.6); s.rotation.y += dt * 6; s.material.opacity = Math.max(0, 1 - u); if (u > 1) s.visible = false; }
    // rod line
    if (P.line.visible) { const tip = new THREE.Vector3(0, 1.55, 0); P.rod.localToWorld(tip); const pa = P.lineGeo.attributes.position; pa.setXYZ(0, tip.x, tip.y, tip.z); pa.setXYZ(1, P.bobber.position.x, P.bobber.position.y + 0.05, P.bobber.position.z); pa.needsUpdate = true; }
    lift += (liftTarget - lift) * Math.min(1, dt * 4);
    if (posTarget) { const p = M(); const dx = posTarget.x - p.x, dz = posTarget.z - p.z; const d = Math.hypot(dx, dz); if (d > 0.05) { const st = Math.min(d, dt * 1.8); p.x += (dx / d) * st; p.z += (dz / d) * st; if (face == null) mochi.root.userData.faceTo = Math.atan2(dx, dz); } }
    if (!cur) return; try { cur.el += dt; const s = cur.steps[cur.k]; s.tick?.call(cur.bag, Math.min(1, cur.el / s.d), dt, t); if (cur.el >= s.d) next(); } catch (e) { console.warn('activity crashed, cancelling', e); cancel(); } // one broken activity must never stop the render loop
  }
  function cancel() { if (!cur) return; const s = cur.steps[cur.k]; try { s?.end?.call(cur.bag); } catch (e) { /* ignore */ } drop(); P.line.visible = false; P.bobber.visible = false; mochi.root.remove(P.board);
    for (const c of [...P.skewer.children]) if (c.userData.food) P.skewer.remove(c); P.skewer.visible = false; liftTarget = 0; face = null; pose.peck = pose.sway = pose.sleep = 0; cur = null; posTarget = null; onChange(inv, fishLog, ''); }
  function interact(zid) { const l = BY_ZONE[zid]; if (!l) return false; queued = choose(zid); return true; }
  function steal(by = 'raccoon') { const k = Object.keys(inv.fish).find((s) => inv.fish[s] > 0); if (!k) return null; inv.fish[k]--; changed(); encounters.push({ animal: by, at: 'dock', outcome: 'stole a fish', date: new Date().toLocaleDateString('en-CA') }); return FISH[k].name; }
  return { inv, fishLog, encounters, plots, begin, cancel, update, suggest, interact, steal, fromText, get current() { return cur; }, get label() { return cur ? cur.def.label : ''; }, get lift() { return lift; }, get face() { return face; }, get initialZone() { return initial ? A[initial].zone : null; }, A, BY_ZONE, liftTo(v) { liftTarget = v; } };
}
