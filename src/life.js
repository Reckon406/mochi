// Mochi's day-to-day: inventory + an activity at every place, chained into little quests
// (dig worms in the garden -> fish at the dock -> cook at the campfire -> eat). Reads STATE, simulates the rest live in the page.
import { TRINKETS } from './vending.js';
import * as THREE from 'three';
import { ZONES, groundY, topH, DOCK, WATER_Y, mv, SHOP, WISH } from './layout.js';
import { FISH, rollFish, fishMesh, speciesKey } from './fish.js';
import { CROPS } from './features.js';
import { giftMesh } from './crush.js';

const N = (v) => (Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : 0);
const zone = (id) => ZONES.find((z) => z.id === id);
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
  let rideY = null; let cur = null, lift = 0, liftTarget = 0, face = null, held = null, posTarget = null, last = '';
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
    { d: 8, start() { const st = TH().stage; this.k = 0; if (st < 6) { hold(P.plank, [0, 0.3, 0.2]); say(STAGE_TALK[st], 3); } else say(['treehouse inspection: passed', 'i can see the squirrel from here. he can see me', 'the owl lives upstairs. we do not talk'][Math.floor(Math.random() * 3)], 3); if (sky.state.night > 0.5 && features.wishes?.readLantern) say('reading the internet by my tiny lantern. cozy mode', 3.5); },
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
  // 🎮 gaming nook: sit on the beanbag, pad in his wings, button-mash, flap at the good bits, rage-shiver when he gets PLUCKED
  // 💕 visiting the girl kiwi: row over from the dock (wake behind), hand over a gift, row home. At 'dating' she comes to him instead.
  const CR = () => features.crush;
  const boatY = () => CR().boat.position.y + 0.05;
  const seatAt = () => { const b = CR().boatState; return new THREE.Vector3(b.x - Math.sin(b.yaw) * 0.15, 0, b.z - Math.cos(b.yaw) * 0.15); };
  const sail = (fromF, toF) => ({ d: 11, start() { const C = CR(); this.from = fromF(); this.to = toF(); C.boatState.row = 1; C.wake(true); posTarget = null; },
    tick(u) { const C = CR(), b = C.boatState, from = this.from, to = this.to; const e = u * u * (3 - 2 * u); const want = Math.atan2(to.x - from.x, to.z - from.z); let dh = want - b.yaw; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); b.yaw += dh * Math.min(1, 0.06 + u);
      b.x = from.x + (to.x - from.x) * e; b.z = from.z + (to.z - from.z) * e; const p = M(), s = seatAt(); p.x = s.x; p.z = s.z; face = b.yaw; pose.sway = 0.12; },
    end() { const C = CR(); C.boatState.row = 0; C.wake(false); pose.sway = 0; } });
  const HER = { stranger: ['oh. hi? who are you', 'um. hello, little round stranger', '...do i know you?'], friend: ['MOCHI! hi!!', 'hey you! rowed all the way over?', 'my favourite neighbour'], crush: ['*fluffs feathers* oh. it\'s you. hi', 'you came back!! i mean. cool. hi', 'i was just thinking about you. about. boats.'], dating: ['there you are ♡', 'my favourite rower', 'hi you'] };
  // what he can bring: kind + which of her possible interests it touches. He favours things he KNOWS she likes.
  const FLOWERS = ['bitterroot', 'balsamroot'];
  const giftOptions = () => { const o = [{ kind: 'flowers', about: [FLOWERS[Math.floor(Math.random() * 2)]] }, { kind: 'art', about: ['art'] }];
    if (inv.worms > 0) o.push({ kind: 'worms', about: ['worms'] }); const fk = Object.keys(inv.fish).find((k) => inv.fish[k] > 0); if (fk) o.push({ kind: 'fish', about: ['fishing', /cutthroat/.test(fk) ? 'trout' : null], fk });
    if (inv.honey > 0) o.push({ kind: 'honey', about: ['honey'] }); if (inv.shells > 0) o.push({ kind: 'shells', about: ['shells'] }); if (sum(inv.cooked) > 0) o.push({ kind: 'cooked', about: ['cooking'] });
    if (sum(inv.crops) > 0) o.push({ kind: 'veggies', about: ['garden'] }); if (inv.caps > 0) o.push({ kind: 'caps', about: ['caps'] }); return o; };
  const pickGift = () => { const C = CR(), o = giftOptions(); const want = C.nextGift && o.find((g) => g.kind === C.nextGift || g.about.includes(C.nextGift)); if (want) { if (FLOWERS.includes(C.nextGift)) want.about = [C.nextGift]; return want; }
    const known = o.filter((g) => g.about.some((a) => C.discovered.includes(a) && C.likes.includes(a)) && !g.about.includes(C.dislike)); if (known.length && Math.random() < 0.7) { const g = known[Math.floor(Math.random() * known.length)]; if (g.kind === 'flowers') g.about = [FLOWERS.find((f) => C.likes.includes(f) && C.discovered.includes(f)) || g.about[0]]; return g; }
    const safe = o.filter((g) => !(C.discovered.includes(C.dislike) && g.about.includes(C.dislike))); return safe[Math.floor(Math.random() * safe.length)] || o[0]; };
  const spend = (g) => { if (g.kind === 'worms') inv.worms = Math.max(0, inv.worms - 1); else if (g.kind === 'fish' && g.fk) inv.fish[g.fk]--; else if (g.kind === 'honey') inv.honey--; else if (g.kind === 'shells') inv.shells--; else if (g.kind === 'caps') inv.caps--; else if (g.kind === 'cooked') { const k = Object.keys(inv.cooked).find((q) => inv.cooked[q] > 0); if (k) inv.cooked[k]--; } else if (g.kind === 'veggies') { const k = Object.keys(inv.crops).find((q) => inv.crops[q] > 0); if (k) inv.crops[k]--; } };
  const giftWord = (g) => (g.kind === 'flowers' ? (g.about[0] === 'bitterroot' ? 'bitterroot flowers' : 'balsamroot flowers') : g.kind === 'veggies' ? 'veggies from the garden' : g.kind === 'cooked' ? 'some campfire stew' : g.kind === 'caps' ? 'a shiny bottle cap' : g.kind);
  const nm = () => (CR().name === '???' ? 'the kiwi across the river' : CR().name);
  const reactTo = (C, r, mine) => { if (r.v === 'like') { C.react(mine ? 'heart' : 'sparkle'); mochi.flap(1); } else if (r.v === 'ick') C.react('ick'); else C.react('shrug'); };
  const talkStep = (d = 4.2) => ({ d, start() { const C = CR(); const id = C.pickTopic(), info = C.interest(id); say(`so... do you like ${info.label}? ${info.emoji}`, 2); this.topic = id;
      setTimeout(() => { if (!cur || !['visit', 'date'].includes(cur.id)) return; const r = C.talk(id); reactTo(C, r, false); changed();
        say(r.v === 'like' ? `${C.name}: "YES. how did you know?!" ${r.fresh ? `💡 she loves ${info.label}!` : ''} (+${r.d})` : r.v === 'ick' ? `${C.name}: "...ew. no." ${r.fresh ? '📝 noted: NOT that' : ''} (${r.d})` : `${C.name}: "it's ok i guess" (+${r.d})`, 2.4); }, 1700); } });
  A.visit = { zone: 'dock', label: '⛵ rowing over to visit her', ok: () => !!features.crush && features.crush.stage !== 'dating',
    onCancel() { const C = CR(); if (!C) return; Object.assign(C.boatState, { x: C.moor.x, z: C.moor.z, yaw: C.yawOut, row: 0 }); C.wake(false); C.lookAt(null); rideY = null; const p = M(); p.x = C.boardPt.x; p.z = C.boardPt.z; if (this.gp) this.gp.parent?.remove(this.gp); },
    steps: [
    { d: 1, start() { const C = CR(); this.gift = pickGift(); hold(giftMesh(this.gift.kind), [0, 0, 0], 1.2); walkTo(C.boardPt.clone()); say(this.gift.kind === 'flowers' ? `picked some ${giftWord(this.gift)}. for no reason. for a friend. normal` : `bringing ${nm()} ${giftWord(this.gift)}`, 3); } },
    { d: 0.7, start() { const C = CR(); face = Math.atan2(C.moor.x - M().x, C.moor.z - M().z); mochi.hop(0.5); }, end() { rideY = boatY; const s = seatAt(), p = M(); p.x = s.x; p.z = s.z; } },
    sail(() => CR().moor, () => CR().beach),
    { d: 0.7, start() { mochi.hop(0.5); }, end() { const C = CR(); rideY = C.rideY; const p = M(); p.x = C.dockTip.x; p.z = C.dockTip.z; } },
    { d: 1, start() { const C = CR(); C.lookAt(M()); walkTo(C.herFront()); } },
    { d: 2.2, start() { const C = CR(); const h = C.her.position; face = Math.atan2(h.x - M().x, h.z - M().z); const hint = C.hint(); say(`${C.name}: "${hint || (HER[C.stage] || HER.friend)[Math.floor(Math.random() * 3)]}"`, 2.2); } },
    { d: 4, start() { const C = CR(); const h = C.her.position; spend(this.gift);
        drop(); const gp = giftMesh(this.gift.kind); gp.position.set(h.x + (M().x - h.x) * 0.45, h.y + 0.08, h.z + (M().z - h.z) * 0.45); gp.rotation.set(0, Math.random() * 6, 0); gp.scale.setScalar(1.2); features.group.parent.add(gp); this.gp = gp;
        const r = C.gift(this.gift.kind, this.gift.about); this.r = r; changed(); say(`here. ${giftWord(this.gift)}. for you`, 1.6);
        setTimeout(() => { if (cur?.id !== 'visit') return; reactTo(C, r, true); say(r.v === 'like' ? `${C.name}: "for ME?? ♡" ${r.fresh ? `💡 she loves ${r.info.label}!` : ''} (+${r.d})` : r.v === 'ick' ? `${C.name}: "oh. ${giftWord(this.gift)}. ...ew" ${r.fresh ? '📝 noted' : ''} (${r.d})` : `${C.name}: "oh. thanks i guess" (+${r.d})`, 2.4); }, 1600); } },
    talkStep(),
    { d: 1, start() { const C = CR(); C.lookAt(null); walkTo(C.dockTip.clone()); say(this.r?.v === 'like' ? 'she LIKED it. play it cool. PLAY IT COOL' : this.r?.v === 'ick' ? 'note to self: never again' : 'that went... fine. it went fine', 2.5); } },
    { d: 0.7, start() { mochi.hop(0.5); }, end() { rideY = boatY; const s = seatAt(), p = M(); p.x = s.x; p.z = s.z; } },
    sail(() => CR().beach, () => CR().moor),
    { d: 0.8, start() { mochi.hop(0.5); }, end() { const C = CR(); rideY = null; const p = M(); p.x = C.boardPt.x; p.z = C.boardPt.z; C.boatState.yaw = C.yawOut; if (this.gp) { this.gp.parent?.remove(this.gp); this.gp = null; } } } ] };
  A.date = { zone: 'dock', label: '💞 on a date on the dock', ok: () => !!features.crush && features.crush.stage === 'dating',
    onCancel() { CR()?.hearts(false); CR()?.lookAt(null); },
    steps: [
    { d: 1, start() { const C = CR(); walkTo(C.mochiDateSpot.clone()); say(`${C.name === '???' ? 'she' : C.name} came over!! act normal`, 2.5); } },
    { d: 9, start() { const C = CR(); face = C.yawOut; const a = C.dockSeat, b = M(); C.hearts(true, new THREE.Vector3((a.x + b.x) / 2, a.y, (a.z + b.z) / 2)); this.k = 0; },
      tick(u, dt, t) { const C = CR(); const L = ['nice sunset', 'nice... you', `${C.name}: "you're a good rower"`, `${C.name}: "*leans on him*"`]; if (u > this.k * 0.25 && this.k < L.length) { say(L[this.k], 2.4); this.k++; if (this.k % 2) mochi.flap(0.5); C.lookAt(this.k % 2 ? M() : null); } pose.sway = 0.1 * Math.sin(t * 1.5); } },
    talkStep(4.5),
    { d: 1.5, start() { say('best day', 1.5); }, end() { CR().hearts(false); CR().lookAt(null); pose.sway = 0; face = null; } } ] };
  // 💿 disc hunt: the game disc is lost somewhere on the island (glinting). Walk over, peck it out, carry it home, slot it in.
  const walkTo = (v) => { posTarget = v; const p = M(); cur.steps[cur.k].d = Math.hypot(v.x - p.x, v.z - p.z) / 1.8 + 0.6; };
  A.disc = { zone: 'gaming', label: '💿 hunting for the game disc', ok: () => !!features.gaming && !features.gaming.found, steps: [
    { d: 1, start() { const G = features.gaming; const p = M(); const d = G.discPos.clone().sub(p).setY(0); const n = d.length() || 1; walkTo(G.discPos.clone().addScaledVector(d, -0.38 / n)); say(`no disc in the tray. something shiny near the ${G.discSpot === 'custom' ? 'bushes' : G.discSpot}...`, 3); } },
    { d: 2.2, start() { const G = features.gaming; const p = M(); face = Math.atan2(G.discPos.x - p.x, G.discPos.z - p.z); }, tick(u, dt, t) { pose.peck = 0.6 + 0.4 * Math.sin(t * 9); }, end() { pose.peck = 0; } },
    { d: 2.2, start() { const G = features.gaming; G.glint.visible = false; hold(G.disc, [0.4, 0, 0], 1.3); mochi.flap(1); say(`${G.title.toUpperCase()}?! it was by the ${G.discSpot === 'custom' ? 'bushes' : G.discSpot} the whole time`, 3); } },
    { d: 1, start() { face = null; const G = features.gaming; walkTo(G.seat.clone()); } },
    { d: 2.4, start() { const G = features.gaming; face = G.faceYaw; say('disc in. loading. loading. IT LOADED', 2.4); }, end() { const G = features.gaming; drop(); G.setFound(true); G.setMode('attract'); mochi.flap(0.8); face = null; } } ] };
  A.gaming = { zone: 'gaming', label: '🎮 playing video games', ok: () => !!features.gaming && features.gaming.found, steps: [
    { d: 2.2, start() { const G = features.gaming; posTarget = G.seat.clone(); face = G.faceYaw; say(G.found ? `booting up ${G.title}. nobody perch on me` : 'the TV says insert disc. WHAT disc', 2.5); } },
    { d: 15, start() { const G = features.gaming; liftTarget = 0.14; if (!G.found) { this.nod = true; return; } G.setMode('drive'); G.spare.visible = false; mochi.holdPad?.(G.pad); },
      tick(u, dt, t) { const G = features.gaming; if (this.nod) { pose.peck = 0.1; return; } pose.sway = this.rage > 0 ? 0 : 0.22; pose.peck = 0.06 * Math.abs(Math.sin(t * 22));
        if (this.rage > 0) { this.rage -= dt; if (this.rage <= 0) say('ok. ok. i am calm. respawning', 2); }
        else if (!this.died && u > 0.5 + Math.random() * 0.2) { this.died = true; G.die(); this.rage = 1.4; mochi.rage?.(1.2); say(['PLUCKED?? a PELICAN came out of NOWHERE', 'that was NOT my fault the car is slippery', 'i had 5 stars and a dream'][Math.floor(Math.random() * 3)], 2.6); }
        else if (Math.random() < dt * 0.18) { mochi.flap(0.6); if (Math.random() < 0.4) { G.crash(); say(['WHEEE', 'two stars lets GO', 'drift king of vice beak', 'cash money (caps money)'][Math.floor(Math.random() * 4)], 1.8); } } },
      end() { pose.sway = 0; pose.peck = 0; } },
    { d: 2.2, start() { const G = features.gaming; say(G.found ? 'one more mission. then bed. (this is a lie)' : 'i will FIND that disc', 2.2); }, end() { const G = features.gaming; if (G.found) G.setMode('attract'); G.spare.visible = true; mochi.holdPad?.(null); liftTarget = 0; face = null; } } ] };
  A.pumpkins = { zone: 'pumpkins', label: '🎃 pumpkin check', steps: [{ d: 4, start() { say('checking on the pumpkins. they are being weird again', 2.5); pose.peck = 0.5; }, end() { pose.peck = 0; } }] };

  // ── wishlist builds (v3) ──
  const WS = () => features.wishes || {}; const _v = new THREE.Vector3();
  const WHALE = ['scanning for whales. they are in canada. i am squinting', 'is that a whale or a cloud. it is a cloud', 'canada if you can hear me: send whales', 'whale count: 0. vibe count: high'];
  A.telescope = { zone: 'cliff', label: '🔭 whale watching', steps: [
    { d: 1.8, start() { const sc = WS().scope; if (!sc) return; posTarget = sc.stand.clone(); face = sc.face; } },
    { d: 7, start() { if (!WS().scope) return; say(WHALE[Math.floor(Math.random() * WHALE.length)], 3.2); }, tick(u, dt) { pose.peck = 0.25; if (Math.random() < dt * 0.25) mochi.flap(0.3); } },
    { d: 2.2, start() { pose.peck = 0; say(Math.random() < 0.2 ? 'WAIT. a splash. probably a whale. (it was a duck)' : 'no whales today. maybe tomorrow', 2.4); }, end() { face = null; } } ] };
  A.swing = { zone: 'tree', label: '🌳 swinging under the treehouse', steps: [
    { d: 2.2, start() { const sw = WS().swing; if (!sw) return; sw.seat.getWorldPosition(_v); posTarget = new THREE.Vector3(_v.x, 0, _v.z); } },
    { d: 10, start() { const sw = WS().swing; if (!sw) return; sw.riding = true; mochi.hop(0.45); say(['the fab 4 foxes have swings. now i do too', 'wheeeee (quietly)', 'swing physics: understood'][Math.floor(Math.random() * 3)], 3); },
      tick() { const sw = WS().swing; if (!sw) return; sw.seat.getWorldPosition(_v); posTarget = null; M().x = _v.x; M().z = _v.z; liftTarget = Math.max(0, _v.y - 0.15 - groundY(_v.x, _v.z)); face = -WISHA(); pose.sway = 0.2; },
      end() { const sw = WS().swing; if (sw) sw.riding = false; pose.sway = 0; } },
    { d: 1.0, start() { liftTarget = 0; mochi.hop(0.5); face = null; say('stuck the landing', 1.6); } } ] };
  const WISHA = () => WISH.swingA;
  A.soak = { zone: 'hottub', label: '♨️ soaking in the hot tub', steps: [
    { d: 1.8, start() { const tb = WS().tub; if (!tb) return; posTarget = new THREE.Vector3(tb.pos.x, 0, tb.pos.z + 1.35); face = Math.PI; } },
    { d: 1.0, start() { const tb = WS().tub; if (!tb) return; mochi.hop(0.9); liftTarget = 0.75; posTarget = new THREE.Vector3(tb.pos.x + 0.2, 0, tb.pos.z + 0.18); } },
    { d: 11, start() { const tb = WS().tub; if (!tb) return; tb.soaking = true; tb.capyJoin = Math.random() < 0.6; liftTarget = tb.waterY - 0.68 - groundY(tb.pos.x + 0.2, tb.pos.z + 0.18); face = 2.6;
        say(tb.capy.visible || tb.capyJoin ? 'hot tub with a capybara. this is the peak of my life' : 'warm river water. my feathers are soup. perfect', 3.5); },
      tick(u) { const tb = WS().tub; if (tb) liftTarget = tb.waterY - 0.68 - groundY(M().x, M().z); pose.sleep = Math.min(0.55, u * 1.5); },
      end() { const tb = WS().tub; if (tb) { tb.soaking = false; tb.capyJoin = false; } pose.sleep = 0; } },
    { d: 1.0, start() { const tb = WS().tub; if (!tb) return; liftTarget = 0.75; mochi.hop(0.9); posTarget = new THREE.Vector3(tb.pos.x, 0, tb.pos.z + 1.35); } },
    { d: 1.2, start() { liftTarget = 0; mochi.flap(1); say('shake shake. 10/10 would soak again', 2); }, end() { face = null; } } ] };
  A.burrow = { zone: 'burrow', label: '🐦 visiting the petrel burrow', steps: [
    { d: 1.8, start() { const b = WS().burrow; if (!b) return; const ang = Math.atan2(0.9, -1.6); posTarget = new THREE.Vector3(b.pos.x + Math.sin(ang) * 1.45, 0, b.pos.z + Math.cos(ang) * 1.45); face = ang + Math.PI; } },
    { d: 6, start() { WS().burrow?.peek(); say(['knock knock. any diving-petrels home?', 'guest burrow inspection. towels: no. vibes: yes', 'they nest in the ground. i nest in a tree. we are learning from each other'][Math.floor(Math.random() * 3)], 3.2); }, tick(u, dt) { pose.peck = 0.35; if (Math.random() < dt * 0.3) mochi.hop(0.2); } },
    { d: 2, start() { pose.peck = 0; say(WS().burrow?.bird.visible ? 'a petrel said hi. we are friends now' : 'nobody home. leaving a worm as rent', 2.4); }, end() { face = null; } } ] };
  A.cruise = { zone: 'ramp', label: "🛹 cruising on Corey's skateboard", steps: [
    { d: 1.8, start() { const gb = WS().giftBoard; if (!gb) return; gb.board.getWorldPosition(_v); posTarget = new THREE.Vector3(_v.x, 0, _v.z); } },
    { d: 14, start() { const gb = WS().giftBoard; if (!gb) { this.no = true; return; } this.no = false; mochi.root.add(gb.board); gb.board.position.set(0, 0.06, 0); gb.board.rotation.set(0, 0, 0); mochi.hop(0.35);
        const r = zone('ramp').spot, c = zone('campfire').spot; const p0 = M(); this.pts = [new THREE.Vector2(p0.x, p0.z), new THREE.Vector2(...r), new THREE.Vector2(...c), new THREE.Vector2(...r), new THREE.Vector2(...c), new THREE.Vector2(...r)];
        this.seg = 0; this.s = 0; say('the REAL tiny skateboard. gift from corey. i am crying and rolling', 3.2); },
      tick(u, dt) { if (this.no || !this.pts) return; posTarget = null; let step = dt * 2.3; while (step > 0 && this.seg < this.pts.length - 1) { const a = this.pts[this.seg], b = this.pts[this.seg + 1]; const L = a.distanceTo(b) || 1e-3; const left = L - this.s; if (step < left) { this.s += step; step = 0; } else { step -= left; this.seg++; this.s = 0; } }
        const i = Math.min(this.seg, this.pts.length - 2); const a = this.pts[i], b = this.pts[i + 1]; const k = Math.min(1, this.s / (a.distanceTo(b) || 1)); M().x = a.x + (b.x - a.x) * k; M().z = a.y + (b.y - a.y) * k; face = Math.atan2(b.x - a.x, b.y - a.y); liftTarget = 0.07; pose.sway = 0.25; },
      end() { const gb = WS().giftBoard; if (gb) { gb.group.add(gb.board); gb.board.position.copy(gb.home.pos); gb.board.rotation.copy(gb.home.rot); } liftTarget = 0; pose.sway = 0; face = null; } },
    { d: 1.2, start() { if (!this.no) say('parked. thank you corey 🛹', 2); } } ] };

  const BY_ZONE = { garden: ['dig', 'plant', 'water', 'harvest'], dock: ['fish', 'visit', 'date', 'fly'], campfire: ['cook', 'warm'], hut: ['sleep', 'mail', 'reminisce'], pond: ['skip'], tree: ['treehouse', 'swing'], ramp: ['skate', 'cruise'], hottub: ['soak'], burrow: ['burrow'], museum: ['dust'], squirrel: ['trade'], cliff: ['yodel', 'telescope'], beach: ['shells'], meadow: ['honey'], shop: ['curate'], market: ['paint'], gaming: ['gaming', 'disc'], music: ['jam'], picnic: ['browse', 'eat', 'read'], vending: ['vend'], pumpkins: ['pumpkins'] };
  // which activity makes sense at a zone right now
  A.reminisce = { zone: 'hut', label: '📸 looking at memories', ok: () => !!features.memories, steps: [{ d: 8, start() { const M = features.memories; posTarget = M.spot.clone(); face = M.faceYaw; const l = [...M.mem.long, ...M.mem.short]; const m = l.length ? l[Math.floor(Math.random() * l.length)] : null; say(m ? `remember when... ${m.text.slice(0, 70)}` : 'my memory shelf is empty. go make some memories!', 4.5); }, tick() { pose.peck = 0.12; }, end() { pose.peck = 0; face = null; } }] };
  A.read = { zone: 'picnic', label: '📰 reading the paper', ok: () => !!features.paper, steps: [{ d: 10, start() { const P = features.paper; posTarget = P.spot.clone(); face = Math.atan2(-P.spot.x, -P.spot.z); hold(P.held(), [0, 0, 0], 1); say(`📰 ${P.data.headline.slice(0, 70)}`, 4.5); }, tick(u) { pose.peck = 0.1 + Math.sin(u * 9) * 0.03; if (held) held.rotation.z = Math.sin(u * 5) * 0.05; }, end() { pose.peck = 0; face = null; drop(); } }] };

  A.fly = { zone: 'dock', label: '✈️ flying the bush plane', ok: () => !!(features.plane && features.plane.owned),
    onCancel() { const P = features.plane; if (P) P.reset(); rideY = null; face = null; liftTarget = 0; },
    steps: [
      { d: 2, start() { const P = features.plane; walkTo(P.boardPt.clone()); say(`ok ${P.name || 'little plane'}, let's go flying`, 2.2); } },
      { d: 0.8, start() { const P = features.plane; mochi.hop(0.6); face = Math.atan2(P.moor.x - M().x, P.moor.z - M().z); },
        end() { const P = features.plane; P.wearGoggles(true); P.setPiloting(true); P.startEngine(); rideY = () => P.rideY(); const s = P.seatWorld(); M().x = s.x; M().z = s.z; } },
      { d: 2.4, start() { const P = features.plane; music?.engine?.(true, 0.35); say('contact! ...wait do kiwis say that', 2.3); P.drive('taxi', 0); },
        tick(u) { features.plane.drive('taxi', 0); pose.sway = 0.15; } },
      { d: 7, start() { say('taxiing. water is a runway if you believe', 2.8); }, tick(u) { features.plane.drive('taxi', u); } },
      { d: 6, start() { say('and we are OFF. try not to look down', 2.8); }, tick(u) { features.plane.drive('takeoff', u); } },
      { d: 9, start() { say('following the river. Bitterroot looks tiny from up here', 3); }, tick(u) { features.plane.drive('cruise', u); } },
      { d: 8, start() { say('swinging east — hello Sapphires', 2.6); }, tick(u) { features.plane.drive('sapphires', u); } },
      { d: 5, start() { say('over the island! i can see my hut!!', 2.4); }, tick(u) { features.plane.drive('valley', u); } },
      { d: 7, start() { say('ok one barrel roll. and a loop. for science', 2.8); }, tick(u) { features.plane.drive('stunt', u); } },
      { d: 8, start() { say('west now. Trapper Peak, i see you', 2.6); }, tick(u) { features.plane.drive('bitterroots', u); } },
      { d: 6, start() { say('turning final. flaps... i do not have flaps. it is fine', 2.6); }, tick(u) { features.plane.drive('approach', u); } },
      { d: 5, start() { say('hold on — kissing the water', 2.2); }, tick(u) { features.plane.drive('land', u); } },
      { d: 5, start() { say('nice landing. i am a professional', 2.2); }, tick(u) { const P = features.plane; P.drive('return', u); } },
      { d: 1.2, start() { const P = features.plane; P.drive('return', 1); mochi.hop(0.5); },
        end() { const P = features.plane; P.wearGoggles(false); P.stopEngine(); P.reset(); rideY = null; face = null; const b = P.boardPt; M().x = b.x; M().z = b.z; say('tied up. goggles tan: pending', 2.4); } },
    ] };
  function choose(zid, prefer) {
    if (prefer && A[prefer] && A[prefer].zone === zid && (!A[prefer].ok || A[prefer].ok())) return prefer;
    if (zid === 'garden') { if (plots.some((p) => p.crop && p.stage >= 4)) return 'harvest'; if (plots.some((p) => !p.crop || p.stage === 0) && sum(inv.seeds) > 0 && Math.random() < 0.5) return 'plant'; if (Math.random() < 0.35 && plots.some((p) => p.crop && p.stage > 0 && p.stage < 4)) return 'water'; return 'dig'; }
    if (zid === 'campfire') return sum(inv.fish) > 0 || (Math.random() < 0.4 && ['potato', 'carrot', 'kale'].some((c) => inv.crops[c] > 0)) ? 'cook' : 'warm';
    if (zid === 'hut') return features.mailbox.unread.length ? 'mail' : features.memories && Math.random() < 0.3 ? 'reminisce' : 'sleep';
    if (zid === 'dock' && features.plane?.owned && Math.random() < 0.28) return 'fly';
    if (zid === 'picnic') return (sum(inv.cooked) > 0 || inv.honey > 0) && Math.random() < 0.5 ? 'eat' : features.paper && Math.random() < 0.35 ? 'read' : 'browse';
    const l = (BY_ZONE[zid] || []).filter((id) => A[id] && (!A[id].ok || A[id].ok())); return l.length ? l[Math.floor(Math.random() * l.length)] : null;
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
    if (Math.random() < 0.25) return ['hottub', 'burrow', 'cliff', 'tree', 'ramp'][Math.floor(Math.random() * 5)]; // wishlist spots
    return Math.random() < 0.6 ? 'garden' : null;
  }
  // STATE.activity / location keywords -> first activity
  const KEYS = [[/\bdat(e|ing)\b|girlfriend/, 'date'], [/visit|crush|\bher\b|girl kiwi|row(ing)? (the )?boat|\bsail/, 'visit'], [/\bdisc\b|find(ing)? (the )?game/, 'disc'], [/\bfly\b|flying|take\s?off|floatplane|\bplane\b|pilot|aviation/, 'fly'], [/newspaper|gazette|the paper|reading the news/, 'read'], [/memor|remember|reminisc|polaroid/, 'reminisce'], [/video ?game|\bgam(e|es|ing)\b|ps5|playstation|\bgta\b|grand theft|controller/, 'gaming'], [/fish|angl|cast|rod\b/, 'fish'], [/cook|roast|grill|campfire|s'more/, 'cook'], [/plant|sow|seed/, 'plant'], [/water(ing)? (the )?(garden|plants)/, 'water'], [/harvest|pick(ing)? (carrot|potato|berr)/, 'harvest'], [/dig|worm/, 'dig'],
    [/brows|laptop|internet|online|web|google|reading the news/, 'browse'], [/sleep|nap|bed|snooz/, 'sleep'], [/skateboard|cruis/, 'cruise'], [/skate|kickflip/, 'skate'], [/hot ?tub|soak|capybara/, 'soak'], [/burrow|petrel/, 'burrow'], [/telescope|whale/, 'telescope'], [/swing/, 'swing'], [/treehouse|tree house|climb/, 'treehouse'], [/yodel|weather station/, 'yodel'], [/paint|draw/, 'paint'],
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
  function cancel() { if (!cur) return; const s = cur.steps[cur.k]; try { s?.end?.call(cur.bag); } catch (e) { /* ignore */ } try { cur.def.onCancel?.(cur.bag); } catch (e) { /* ignore */ } drop(); P.line.visible = false; P.bobber.visible = false; mochi.root.remove(P.board);
    for (const c of [...P.skewer.children]) if (c.userData.food) P.skewer.remove(c); P.skewer.visible = false; liftTarget = 0; face = null; pose.peck = pose.sway = pose.sleep = 0; cur = null; posTarget = null; onChange(inv, fishLog, ''); }
  function interact(zid) { const l = BY_ZONE[zid]; if (!l) return false; queued = choose(zid); return true; }
  function steal(by = 'raccoon') { const k = Object.keys(inv.fish).find((s) => inv.fish[s] > 0); if (!k) return null; inv.fish[k]--; changed(); encounters.push({ animal: by, at: 'dock', outcome: 'stole a fish', date: new Date().toLocaleDateString('en-CA') }); return FISH[k].name; }
  return { inv, fishLog, encounters, plots, begin, cancel, update, suggest, interact, steal, fromText, get current() { return cur; }, get label() { return cur ? cur.def.label : ''; }, get lift() { return lift; }, get rideY() { return rideY; }, get face() { return face; }, get initialZone() { return initial ? A[initial].zone : null; }, A, BY_ZONE, KEYS, liftTo(v) { liftTarget = v; },
    ctl: { go(v) { posTarget = v; }, face(f) { face = f; }, lift(v) { liftTarget = v; }, snapLift(v) { liftTarget = lift = v; }, hold, drop, fx, M, pose }, run(id) { const def = A[id]; if (!def) return false; cancel(); queued = id; return begin(def.zone); } };
}
