// mochi-brain: Mochi's always-on brain. One Durable Object (SQLite-backed, free tier) holds the LIVE layer
// (caps, inventory, activity/mood, crush, gaming hours, plane, pet, memories, purchase/chat/action logs).
// A cron tick lets Gemini pick 1-3 actions from a fixed, server-validated menu. GET /state, POST /chat, POST /event.
import { DurableObject } from 'cloudflare:workers';
import { ACTIONS, menuFor, runAction, applyEvent, normInv, STAGES } from './rules.js';

const ORIGINS = ['https://reckon406.github.io'];
const okOrigin = (o) => !!o && (ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));
const LIVE_WORLD = ['crush', 'gaming', 'plane', 'pet'];
const OFFLINE = ["mochi is napping in the hut rn. zzz. try again in a bit", "brb, my brain is buffering (too many birds talking at once). try later", "the wifi on the island is a squirrel on a wheel and he quit for today. tomorrow!", "mochi went fishing and left his phone on the dock. try again later"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const today = () => new Date().toISOString().slice(0, 10);
const clone = (o) => JSON.parse(JSON.stringify(o ?? null));
const J = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function cors(origin) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', vary: 'Origin' };
  if (okOrigin(origin)) Object.assign(h, { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' });
  return h;
}
const json = (o, status, origin) => new Response(JSON.stringify(o), { status, headers: cors(origin) });

export default {
  async fetch(req, env) {
    const url = new URL(req.url), origin = req.headers.get('origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: okOrigin(origin) ? 204 : 403, headers: cors(origin) });
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'POST' && origin && !okOrigin(origin)) return json({ error: 'origin not allowed' }, 403, origin);
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const fwd = (p, extra = {}) => stub(env).fetch('https://brain' + p, { method: req.method, body: req.method === 'POST' ? req.body : undefined, headers: { 'content-type': 'application/json', 'x-ip': ip, 'x-origin': origin, ...extra } });
    if (path === '/' && req.method === 'GET') return json({ name: 'mochi-brain', hi: 'chirp. try GET /state', endpoints: ['GET /state', 'POST /chat {message}', 'POST /event {type,...}'] }, 200, origin);
    if (path === '/state' && req.method === 'GET') return withCors(await fwd('/state'), origin);
    if (path === '/chat' && req.method === 'POST') return withCors(await fwd('/chat'), origin);
    if (path === '/event' && req.method === 'POST') return withCors(await fwd('/event'), origin);
    if (path === '/tick' && req.method === 'POST') { // manual tick: admin token only
      const tok = req.headers.get('authorization') || ''; if (!env.ADMIN_TOKEN || tok !== 'Bearer ' + env.ADMIN_TOKEN) return json({ error: 'nope' }, 401, origin);
      return withCors(await fwd('/tick' + url.search, { 'x-mochi-internal': '1' }), origin);
    }
    return json({ error: 'not found' }, 404, origin);
  },
  async scheduled(ev, env, ctx) { ctx.waitUntil(stub(env).fetch('https://brain/tick', { method: 'POST', headers: { 'x-mochi-internal': '1', 'x-ip': 'cron' } })); },
};
const stub = (env) => env.BRAIN.get(env.BRAIN.idFromName('mochi'));
async function withCors(res, origin) { const h = cors(origin); return new Response(res.body, { status: res.status, headers: h }); }

export class MochiBrain extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.env = env; this.burst = new Map(); }

  async fetch(req) {
    const url = new URL(req.url), ip = req.headers.get('x-ip') || '?';
    try {
      if (url.pathname === '/state') return this.out({ ...(await this.view()) });
      if (url.pathname === '/tick' && req.headers.get('x-mochi-internal') === '1') return this.out(await this.tick(url.searchParams.get('force')));
      if (url.pathname === '/chat') return await this.chat(req, ip);
      if (url.pathname === '/event') return await this.event(req, ip);
    } catch (e) { console.error('brain error', e?.stack || e); return this.out({ error: 'brain hiccup', reply: pick(OFFLINE) }, 500); }
    return this.out({ error: 'not found' }, 404);
  }
  out(o, status = 200) { return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } }); }

  // ── rate limits: per-IP bursts in memory, per-IP + global daily counters in storage ──
  burstOk(ip, kind, perMin) { const k = kind + ':' + ip, now = Date.now(); const a = (this.burst.get(k) || []).filter((t) => now - t < 60000); if (a.length >= perMin) { this.burst.set(k, a); return false; } a.push(now); this.burst.set(k, a);
    if (this.burst.size > 5000) this.burst.clear(); return true; }
  async day() { let d = await this.ctx.storage.get('day'); if (!d || d.date !== today()) d = { date: today(), gemini: 0, chat: {}, ev: {}, chatActs: 0, chatVend: 0 }; return d; }
  async ipKey(ip) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mochi:' + ip)); return [...new Uint8Array(b)].slice(0, 6).map((x) => x.toString(16).padStart(2, '0')).join(''); }

  // ── state: base = last state.json from Mochi's own bot; live = the layer this brain owns; seen = state.json's live values at last sync ──
  async load() { const [live, base] = await Promise.all([this.ctx.storage.get('live'), this.ctx.storage.get('base')]); return { live, base: base || {} }; }
  async save(L) { const o = { ...L }; for (const k of Object.keys(o)) if (k.startsWith('_')) delete o[k]; for (const k of ['log', 'purchases', 'chat', 'memories', 'fishLog']) o[k] = (o[k] || []).slice(-({ log: 80, purchases: 50, chat: 80, memories: 30, fishLog: 40 }[k])); await this.ctx.storage.put('live', o); }
  liveOf(s) { const w = s.world || {}; return { caps: Math.max(0, Math.floor(+s.caps || 0)), inventory: normInv(s.inventory), activity: String(s.activity || ''), mood: String(s.mood || ''), location: String(s.location || ''),
    world: { crush: { stage: 'stranger', affection: 0, gifts: [], ...(w.crush || {}) }, gaming: { game: 'Grand Theft Avian VI', found: false, hours: 0, ...(w.gaming || {}) }, plane: { owned: true, name: 'kiwi force one', ...(w.plane || {}) }, pet: { kind: 'cat', name: 'biscuit', mood: 'playful', ...(w.pet || {}) } },
    mem: ((w.memories && w.memories.short) || []).map((m) => String(m.text || m)) }; }

  async sync() {
    let fresh = null; try { const r = await fetch(this.env.STATE_URL + '?t=' + Date.now(), { cf: { cacheTtl: 0 } }); if (r.ok) fresh = await r.json(); } catch (e) { console.warn('state.json fetch failed', e?.message); }
    let { live: L, base } = await this.load(); const seen = await this.ctx.storage.get('seen');
    if (fresh && typeof fresh === 'object') { base = fresh; await this.ctx.storage.put('base', base); }
    const S = this.liveOf(base);
    if (!L) { L = { v: 1, ...clone(S), memories: S.mem.map((t) => ({ text: t, tag: 'seed', at: Date.now() })), purchases: [], chat: [], log: [], fishLog: [], seededAt: Date.now(), activityId: null, actionAt: 0 }; delete L.mem; }
    else if (seen && fresh) { // three-way merge: apply only what Mochi's bot changed since we last looked, never clobber the live layer
      const d = S.caps - seen.caps; if (d) L.caps = Math.max(0, L.caps + d);
      for (const k of ['worms', 'honey', 'shells', 'firewood', 'acorns']) { const dd = (S.inventory[k] || 0) - (seen.inventory[k] || 0); if (dd) L.inventory[k] = Math.max(0, (L.inventory[k] || 0) + dd); }
      for (const m of ['fish', 'cooked', 'seeds', 'crops']) for (const k of new Set([...Object.keys(S.inventory[m]), ...Object.keys(seen.inventory[m] || {})])) { const dd = (S.inventory[m][k] || 0) - ((seen.inventory[m] || {})[k] || 0); if (dd) L.inventory[m][k] = Math.max(0, (L.inventory[m][k] || 0) + dd); }
      const old = [...(seen.inventory.trinkets || [])]; for (const t of S.inventory.trinkets) { const i = old.indexOf(t); if (i >= 0) old.splice(i, 1); else L.inventory.trinkets.push(t); }
      for (const k of ['activity', 'mood', 'location']) if (S[k] !== seen[k] && S[k]) { L[k] = S[k]; if (k === 'activity') { L.activityId = null; L.actionAt = Date.now(); } }
      for (const w of LIVE_WORLD) for (const k of Object.keys(S.world[w])) if (!J(S.world[w][k], seen.world?.[w]?.[k])) L.world[w][k] = S.world[w][k];
      for (const t of S.mem) if (!(seen.mem || []).includes(t)) L.memories.push({ text: t, tag: 'bot', at: Date.now() });
    }
    if (fresh || !seen) await this.ctx.storage.put('seen', S);
    L.lastSync = Date.now(); return { L, base };
  }

  async view() {
    let { live: L, base } = await this.load(); if (!L) ({ L, base } = await this.sync()), await this.save(L);
    const bw = base.world || {}, short = [...((bw.memories && bw.memories.short) || [])];
    const have = new Set(short.map((m) => m.text)); for (const m of L.memories) if (!have.has(m.text) && m.tag !== 'seed' && m.tag !== 'chat-private') short.push({ text: m.text, date: new Date(m.at).toISOString().slice(0, 10), tag: m.tag });
    return { ...base, caps: L.caps, inventory: L.inventory, activity: L.activity, mood: L.mood, location: L.location || base.location,
      world: { ...bw, ...clone(L.world), memories: { long: (bw.memories && bw.memories.long) || [], short: short.slice(-20) } },
      fishLog: [...(base.fishLog || []), ...L.fishLog].slice(-30),
      brain: { online: true, model: this.env.MODEL, activityId: L.activityId, actionAt: L.actionAt, lastTick: L.lastTick || null, lastSync: L.lastSync || null,
        log: L.log.slice(-12), purchases: L.purchases.slice(-10) } };
  }

  // ── context for prompts ──
  async ctxNow() {
    const hour = +new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: 'numeric', hourCycle: 'h23' }).format(new Date());
    const when = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date());
    const m = new Date().getUTCMonth(); const season = [11, 0, 1].includes(m) ? 'winter' : [2, 3, 4].includes(m) ? 'spring' : [5, 6, 7].includes(m) ? 'summer' : 'fall';
    let wx = null; try { const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=46.02&longitude=-114.18&current=temperature_2m,weather_code,is_day,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph'); if (r.ok) wx = (await r.json()).current; } catch {}
    const code = wx?.weather_code ?? 2; const tempF = wx ? Math.round(wx.temperature_2m) : null;
    const sky = code === 0 ? 'clear' : code <= 3 ? 'cloudy' : code <= 48 ? 'foggy' : code <= 67 ? 'rainy' : code <= 77 ? 'snowy' : code <= 82 ? 'showers' : code <= 86 ? 'snow showers' : 'thunderstorm';
    const dark = wx ? !wx.is_day : hour < 7 || hour >= 18;
    return { hour, when, season, weather: `${sky}${tempF != null ? `, ${tempF}F` : ''}${wx && wx.wind_speed_10m > 18 ? ', windy' : ''}`, storm: code >= 95 || (wx && wx.wind_speed_10m > 30), dark, freezing: tempF != null && tempF <= 32 };
  }
  persona(L, base, c) {
    const I = L.inventory, sum = (o) => Object.entries(o).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ') || 'none';
    const diary = (base.diary || []).slice(-3).map((d) => `${d.date}: ${String(d.text).slice(0, 220)}`).join('\n');
    const wish = (base.wishlist || []).filter((w) => w.status !== 'built').map((w) => w.item).slice(0, 6).join('; ');
    const goals = (base.goals || []).filter((g) => !g.done).map((g) => g.text).slice(0, 5).join('; ');
    return `you are mochi, a chubby little brown kiwi bird (corey's pet; inspired by pino by @3eyes.iii) living on a river island near darby, montana in the bitterroot valley.
you talk casually in all lowercase, short and cute and a bit goofy. you collect bottle caps (your cap museum; caps are also your in-game money), make ai art and sell prints at your market stall, have a big crush on the girl kiwi across the river, play 'grand theft avian vi' on your ps5, have a pet cat named biscuit, and fly your floatplane 'kiwi force one'.
you are pg and kind. you live in a little 3d world; you never claim to do real-world things (no real purchases, no posting online, no real money). never share personal info, never pretend to be a human.
right now: ${c.when} (mountain time), ${c.season}, weather ${c.weather}${c.dark ? ', dark out' : ''}.
your mood: ${L.mood || 'chill'}. last doing: ${L.activity || 'nothing'}.
caps: ${L.caps}. worms: ${I.worms}. fish: ${sum(I.fish)}. cooked: ${sum(I.cooked)}. crops: ${sum(I.crops)}. shells: ${I.shells}. trinkets: ${I.trinkets.slice(-6).join(', ') || 'none'}.
the girl kiwi: ${L.world.crush.stage} (affection ${L.world.crush.affection}/100). gaming: ${L.world.gaming.found ? `${L.world.gaming.hours}h played` : 'lost the game disc'}. biscuit is ${L.world.pet.mood}.
interests lately: ${(base.interests || []).slice(-8).join(', ')}. wishlist: ${wish}. goals: ${goals}.
recent thoughts: ${(base.thoughts || []).slice(-3).map((t) => String(t).slice(0, 140)).join(' | ')}
recent diary:\n${diary}
recent memories: ${L.memories.slice(-8).map((m) => m.text.slice(0, 120)).join(' | ')}
what you did lately: ${L.log.slice(-6).map((e) => e.text).join(' | ') || 'not much'}`;
  }

  async gemini(prompt, d, maxTokens = 350) {
    if (!this.env.GEMINI_API_KEY) return null;
    const cap = +this.env.GEMINI_DAILY || 300; if (d.gemini >= cap) return null; d.gemini++; await this.ctx.storage.put('day', d);
    const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 20000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.env.MODEL}:generateContent`, { method: 'POST', signal: ac.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': this.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.95, maxOutputTokens: maxTokens },
          safetySettings: ['HARASSMENT', 'HATE_SPEECH', 'SEXUALLY_EXPLICIT', 'DANGEROUS_CONTENT'].map((c) => ({ category: 'HARM_CATEGORY_' + c, threshold: 'BLOCK_LOW_AND_ABOVE' })) }) });
      if (!r.ok) { console.warn('gemini', r.status, (await r.text()).slice(0, 200)); return null; }
      const j = await r.json(); const t = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      const m = t.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null;
    } catch (e) { console.warn('gemini fail', e?.message); return null; } finally { clearTimeout(to); }
  }

  // ── cron tick ──
  async tick(force) {
    const { L, base } = await this.sync(); const c = await this.ctxNow(); const d = await this.day();
    L._today = today(); L._artTitles = (base.art || []).map((a) => a.title).filter(Boolean);
    const menu = menuFor(L, c);
    const out = await this.gemini(`${this.persona(L, base, c)}

it's time to decide what you do for the next half hour. pick 1 to 3 actions from this menu (ids only), fitting the time of day, weather and season (nap or telescope at night, campfire when cold, no flying in storms or the dark). you need caps income sometimes (paint = sell art, caphunt = find caps) and the cap-o-matic (vend) is your favorite treat: with 6+ caps you usually can't resist one pull. don't repeat the exact same thing as last time unless it makes sense.
menu:
${menu}
reply as json: {"actions": ["id", ...], "mood": "a short lowercase mood", "thought": "one short lowercase thought in your voice (max 20 words)"}`, d, 250);
    let ids = Array.isArray(out?.actions) ? out.actions.map(String).filter((k) => ACTIONS[k]).slice(0, 3) : [];
    if (force && ACTIONS[force]) ids = [force, ...ids.filter((k) => k !== force)].slice(0, 3);
    if (!ids.length) { const ok = Object.keys(ACTIONS).filter((k) => !ACTIONS[k].ok || ACTIONS[k].ok(L, c)); ids = [c.dark ? 'sleep' : ok[Math.floor(Math.random() * ok.length)]]; }
    const results = ids.map((k) => runAction(L, k, c, 'tick'));
    if (out?.mood) L.mood = String(out.mood).slice(0, 80).toLowerCase();
    if (out?.thought) L.memories.push({ text: String(out.thought).slice(0, 160).toLowerCase(), tag: 'thought', at: Date.now() });
    const did = results.filter((r) => r.ok); if (did.length) L.memories.push({ text: did.map((r) => r.text).join('; ').slice(0, 220), tag: 'tick', at: Date.now() });
    L.lastTick = { at: Date.now(), ids, results, mood: L.mood, thought: out?.thought || null, gemini: !!out, weather: c.weather };
    await this.save(L); return { ok: true, tick: L.lastTick, caps: L.caps, geminiToday: d.gemini };
  }

  // ── chat ──
  async chat(req, ip) {
    let body; try { body = await req.json(); } catch { return this.out({ error: 'bad json' }, 400); }
    const msg = String(body?.message || '').replace(/\s+/g, ' ').trim().slice(0, 300); if (!msg) return this.out({ error: 'empty' }, 400);
    if (!this.burstOk(ip, 'chat', 6) || !this.burstOk('*', 'chat', 30)) return this.out({ reply: "whoa whoa. one at a time, my tiny brain can only chirp so fast", limited: true }, 429);
    const d = await this.day(), h = await this.ipKey(ip); d.chat[h] = (d.chat[h] || 0) + 1;
    if (d.chat[h] > 60) { await this.ctx.storage.put('day', d); return this.out({ reply: "i've talked SO much today my beak is tired. come back tomorrow?", limited: true }, 429); }
    if (d.gemini >= (+this.env.GEMINI_DAILY || 300) - (+this.env.TICK_RESERVE || 60)) { await this.ctx.storage.put('day', d); return this.out({ reply: pick(OFFLINE), offline: true }, 200); }
    let { live: L, base } = await this.load(); if (!L) ({ L, base } = await this.sync());
    const c = await this.ctxNow(); L._today = today(); L._artTitles = (base.art || []).map((a) => a.title).filter(Boolean);
    const hist = L.chat.filter((x) => x.h === h).slice(-6).map((x) => `visitor: ${x.q}\nmochi: ${x.a}`).join('\n');
    const canAct = d.chatActs < 25; const menu = canAct ? menuFor(L, c) : '';
    const out = await this.gemini(`${this.persona(L, base, c)}

a visitor in your 3d world is chatting with you. reply in character: lowercase, 1-3 short sentences, cute and goofy, no emojis spam (one is ok). stay pg; if they ask for anything inappropriate, mean, or real-world (buying real things, personal info, links) gently dodge in a goofy way. caps are in-game money only.
${canAct ? `only if the visitor clearly asks or suggests you do one of these specific things, you may do ONE action (set "action" to its id), otherwise null. never do vend more than once.\nmenu:\n${menu}` : 'do not take actions right now ("action": null).'}
${hist ? `earlier with this visitor:\n${hist}\n` : ''}visitor: ${msg}
reply as json: {"reply": "what mochi says", "action": "id or null", "mood": "short lowercase mood or null"}`, d, 260);
    if (!out?.reply) { await this.ctx.storage.put('day', d); return this.out({ reply: pick(OFFLINE), offline: true }); }
    let reply = String(out.reply).slice(0, 400), act = null;
    if (canAct && out.action && ACTIONS[out.action] && !(out.action === 'vend' && d.chatVend >= 4)) { act = runAction(L, String(out.action), c, 'chat'); d.chatActs++; if (act.ok && out.action === 'vend') d.chatVend++; if (!act.ok) reply += ` (${act.text})`; }
    if (out.mood) L.mood = String(out.mood).slice(0, 80).toLowerCase();
    L.chat.push({ at: Date.now(), h, q: msg, a: reply, act: act?.ok ? act.id : null });
    L.memories.push({ text: `a visitor said "${msg.slice(0, 70)}" and i said "${reply.slice(0, 70)}"`, tag: 'chat-private', at: Date.now() });
    await this.save(L); await this.ctx.storage.put('day', d);
    return this.out({ reply, action: act?.ok ? { id: act.id, life: act.life, text: act.text } : null, mood: L.mood, caps: L.caps });
  }

  // ── browser-reported events ──
  async event(req, ip) {
    let ev; try { ev = await req.json(); } catch { return this.out({ error: 'bad json' }, 400); }
    if (!this.burstOk(ip, 'ev', 20) || !this.burstOk('*', 'ev', 120)) return this.out({ ok: false, error: 'slow down' }, 429);
    const d = await this.day(), h = await this.ipKey(ip); d.ev[h] = (d.ev[h] || 0) + 1; await this.ctx.storage.put('day', d);
    if (d.ev[h] > 300) return this.out({ ok: false, error: 'daily event limit' }, 429);
    let { live: L } = await this.load(); if (!L) ({ L } = await this.sync()); L._today = today();
    const r = applyEvent(L, ev); if (r.ok) { L.log.push({ at: Date.now(), id: 'event:' + ev.type, src: 'visitor', text: r.text }); await this.save(L); }
    return this.out({ ...r, caps: L.caps, inventory: L.inventory, crush: L.world.crush }, r.ok ? 200 : 422);
  }
}
