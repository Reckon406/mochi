// mochi-brain: Mochi's single, self-contained cloud brain (Durable Object + 5-min Cron + Gemini free tier).
// Owns ALL live & creative state: caps, inventory, mood/activity, diary, interests, wishlist, goals, thoughts,
// AI art (Pollinations free tier cached in DO), read-only web lookups (Open-Meteo, animal news RSS, GitHub notes),
// Bitterroot Kiwi Gazette, crush/gaming/plane/pet, chat & visitor events. state.json is only a cold-start fallback.
import { DurableObject } from 'cloudflare:workers';
import { ACTIONS, menuFor, runAction, applyEvent, normInv, STAGES, GAME_TITLE, normGame, normGameText } from './rules.js';
import { ART_W, ART_H, LOGO_STRIP, cropPollinationsLogo } from './cropjpeg.js';
import { normalizeBeat, storeBeat } from './beats.js';

const ORIGINS = ['https://reckon406.github.io'];
const okOrigin = (o) => !!o && (ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));
const WORKER_PUBLIC = 'https://mochi-brain.coreydman15.workers.dev';
const LIVE_WORLD = ['crush', 'gaming', 'plane', 'pet'];
const OFFLINE = [
  'mochi is napping in the hut rn. zzz. try again in a bit',
  'brb, my brain is buffering (too many birds talking at once). try later',
  'the wifi on the island is a squirrel on a wheel and he quit for today. tomorrow!',
  'mochi went fishing and left his phone on the dock. try again later',
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function parseJsonObj(t) {
  const s = String(t || '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const raw = s.slice(start, i + 1).replace(/,\s*([}\]])/g, '$1');
        try { return JSON.parse(raw); } catch { return null; }
      }
    }
  }
  return null;
}
const today = () => new Date().toISOString().slice(0, 10);
const mtParts = () => {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Denver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const hour = +time.slice(0, 2);
  const when = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(now);
  return { date, time, hour, when };
};
const clone = (o) => JSON.parse(JSON.stringify(o ?? null));
const stripHtml = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();

function parseRssItems(xml, max = 4) {
  const items = [];
  const rx = /<item\b[\s\S]*?<\/item>/gi;
  let m;
  while ((m = rx.exec(xml)) && items.length < max) {
    const block = m[0];
    const get = (tag) => {
      const r = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return r ? stripHtml(r[1]) : '';
    };
    const title = get('title');
    const desc = get('description').slice(0, 220);
    if (title) items.push({ title: title.slice(0, 140), desc });
  }
  return items;
}

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
    if (path === '/' && req.method === 'GET') return json({ name: 'mochi-brain', hi: 'chirp. try GET /state', endpoints: ['GET /state', 'GET /art/:id', 'POST /chat {message}', 'POST /event {type,...}'], game: GAME_TITLE, cron: '*/5 * * * *' }, 200, origin);
    if (path === '/state' && req.method === 'GET') return withCors(await fwd('/state'), origin);
    if (path.startsWith('/art/') && req.method === 'GET') return await stub(env).fetch('https://brain' + path);
    if (path === '/chat' && req.method === 'POST') return withCors(await fwd('/chat'), origin);
    if (path === '/event' && req.method === 'POST') return withCors(await fwd('/event'), origin);
    if ((path === '/tick' || path === '/admin') && req.method === 'POST') {
      const tok = req.headers.get('authorization') || ''; if (!env.ADMIN_TOKEN || tok !== 'Bearer ' + env.ADMIN_TOKEN) return json({ error: 'nope' }, 401, origin);
      return withCors(await fwd(path + url.search, { 'x-mochi-internal': '1' }), origin);
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
      if (url.pathname.startsWith('/art/')) return await this.serveArt(url.pathname.slice(5));
      if (url.pathname === '/tick' && req.headers.get('x-mochi-internal') === '1') {
        return this.out(await this.tick({
          force: url.searchParams.get('force'),
          diary: url.searchParams.get('diary') === '1',
          lookup: url.searchParams.get('lookup') === '1',
          art: url.searchParams.get('art') === '1',
          beat: url.searchParams.get('beat') === '1',
        }));
      }
      if (url.pathname === '/admin' && req.headers.get('x-mochi-internal') === '1') return this.out(await this.admin(req));
      if (url.pathname === '/chat') return await this.chat(req, ip);
      if (url.pathname === '/event') return await this.event(req, ip);
    } catch (e) { console.error('brain error', e?.stack || e); return this.out({ error: 'brain hiccup', reply: pick(OFFLINE) }, 500); }
    return this.out({ error: 'not found' }, 404);
  }
  out(o, status = 200) { return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } }); }

  async serveArt(id) {
    const clean = String(id || '').replace(/[^a-zA-Z0-9._-]/g, '');
    const cors = { 'access-control-allow-origin': '*' };
    if (!clean) return new Response('not found', { status: 404, headers: cors });
    const bytes = await this.ctx.storage.get('artbin:' + clean);
    if (!bytes) return new Response('not found', { status: 404, headers: cors });
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=31536000, immutable',
        'access-control-allow-origin': '*',
      },
    });
  }

  // ── rate limits ──
  burstOk(ip, kind, perMin) {
    const k = kind + ':' + ip, now = Date.now();
    const a = (this.burst.get(k) || []).filter((t) => now - t < 60000);
    if (a.length >= perMin) { this.burst.set(k, a); return false; }
    a.push(now); this.burst.set(k, a);
    if (this.burst.size > 5000) this.burst.clear();
    return true;
  }
  async day() {
    let d = await this.ctx.storage.get('day');
    if (!d || d.date !== today()) d = { date: today(), gemini: 0, chat: {}, ev: {}, chatActs: 0, chatVend: 0, diaryCount: 0, artCount: 0, beatCount: 0 };
    d.diaryCount ||= 0; d.artCount ||= 0; d.beatCount ||= 0;
    return d;
  }
  async ipKey(ip) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mochi:' + ip)); return [...new Uint8Array(b)].slice(0, 6).map((x) => x.toString(16).padStart(2, '0')).join(''); }
  chatBudgetLeft(d) {
    const cap = +this.env.GEMINI_DAILY || 480;
    const baseReserve = +this.env.TICK_RESERVE || 300;
    const now = new Date();
    const msLeft = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
    const fracLeft = Math.max(0.03, Math.min(1, msLeft / 86400000));
    const needed = Math.ceil(baseReserve * fracLeft);
    return Math.max(0, cap - needed - d.gemini);
  }

  // ── state: DO owns ALL live & creative fields; state.json is cold-start fallback only ──
  async load() { const [live, base] = await Promise.all([this.ctx.storage.get('live'), this.ctx.storage.get('base')]); return { live, base: base || {} }; }
  async save(L) {
    const o = { ...L };
    for (const k of Object.keys(o)) if (k.startsWith('_')) delete o[k];
    const caps = { log: 80, purchases: 50, chat: 80, memories: 30, fishLog: 40, diary: 80, thoughts: 50, interests: 120, art: 60, seenIssues: 40, beats: 24 };
    for (const [k, n] of Object.entries(caps)) if (Array.isArray(o[k])) o[k] = o[k].slice(-n);
    if (o.world?.mail?.replies) o.world.mail.replies = o.world.mail.replies.slice(-20);
    await this.ctx.storage.put('live', o);
  }
  liveOf(s) {
    const w = s.world || {};
    return {
      caps: Math.max(0, Math.floor(+s.caps || 0)),
      inventory: normInv(s.inventory),
      activity: normGameText(String(s.activity || '')),
      mood: String(s.mood || ''),
      location: String(s.location || ''),
      world: (() => {
        const crush = { stage: 'stranger', affection: 0, gifts: [], ...(w.crush || {}) };
        const gaming = { game: GAME_TITLE, found: false, hours: 0, ...(w.gaming || {}) };
        gaming.game = normGame(gaming.game);
        const plane = { owned: true, name: 'kiwi force one', ...(w.plane || {}) };
        const pet = { kind: 'cat', name: 'biscuit', mood: 'playful', ...(w.pet || {}) };
        return { crush, gaming, plane, pet };
      })(),
      mem: ((w.memories && w.memories.short) || []).map((m) => normGameText(String(m.text || m))),
    };
  }

  ensureOwned(L, base = {}) {
    let changed = false;
    if (!L.v || L.v < 2) { L.v = 2; changed = true; }
    if (!Array.isArray(L.diary)) { L.diary = clone(base.diary || []); changed = true; }
    if (!Array.isArray(L.interests)) { L.interests = clone(base.interests || []); changed = true; }
    if (!Array.isArray(L.wishlist)) { L.wishlist = clone(base.wishlist || []); changed = true; }
    if (!Array.isArray(L.thoughts)) { L.thoughts = clone(base.thoughts || []); changed = true; }
    if (!Array.isArray(L.art)) { L.art = clone(base.art || []); changed = true; }
    if (!Array.isArray(L.goals)) { L.goals = clone(base.goals || []); changed = true; }
    if (!L.savings) { L.savings = clone(base.savings || {}); changed = true; }
    if (!L.laptop) { L.laptop = clone(base.laptop || { site: '', screen: '', browsing: [], last: '' }); changed = true; }
    if (!Array.isArray(L.mail)) { L.mail = clone(base.mail || []); changed = true; }
    if (!L.weather && base.weather) { L.weather = String(base.weather); changed = true; }
    if (!L.outfit && base.outfit) { L.outfit = String(base.outfit); changed = true; }
    if (!L.world.paper) { L.world.paper = clone(base.world?.paper || null); changed = true; }
    if (!L.world.mail) { L.world.mail = clone(base.world?.mail || { replies: [] }); changed = true; }
    if (!Array.isArray(L.seenIssues)) { L.seenIssues = []; changed = true; }
    if (!L.music) { L.music = clone(base.music || { songs: [] }); changed = true; }
    if (!Array.isArray(L.music.songs)) { L.music.songs = clone(base.music?.songs || []); changed = true; }
    if (!Array.isArray(L.beats)) { L.beats = clone(base.beats || []); changed = true; }
    if (this.scrubAvian(L)) changed = true;
    this.syncGoals(L);
    return changed;
  }

  scrubAvian(L) {
    let dirty = false;
    if (L.world?.gaming && normGame(L.world.gaming.game) !== L.world.gaming.game) { L.world.gaming.game = GAME_TITLE; dirty = true; }
    const fix = (v) => { const n = normGameText(v); if (n !== v) dirty = true; return n; };
    L.activity = fix(L.activity || '');
    for (const m of L.memories || []) m.text = fix(m.text);
    for (const e of L.log || []) e.text = fix(e.text);
    for (const d of L.diary || []) d.text = fix(d.text);
    if (Array.isArray(L.thoughts)) L.thoughts = L.thoughts.map(fix);
    for (const c of L.chat || []) { c.q = fix(c.q); c.a = fix(c.a); }
    return dirty;
  }

  syncGoals(L) {
    for (const g of L.goals || []) {
      if (/cap/i.test(g.text)) {
        g.done = L.caps >= 50;
        g.meta = `${L.caps} of 50`;
      } else if (/artist|masterpiece/i.test(g.text)) {
        const n = (L.art || []).length;
        g.meta = `${n} masterpieces so far`;
      }
    }
  }

  async sync() {
    let { live: L, base } = await this.load();
    // Only fetch state.json as cold-start seed when DO has no live state or no base cached yet
    if (!L || !base || !Object.keys(base).length) {
      let fresh = null;
      try { const r = await fetch(this.env.STATE_URL + '?t=' + Date.now(), { cf: { cacheTtl: 0 } }); if (r.ok) fresh = await r.json(); } catch (e) { console.warn('state.json fetch failed', e?.message); }
      if (fresh && typeof fresh === 'object') { base = fresh; await this.ctx.storage.put('base', base); }
    }
    const S = this.liveOf(base);
    if (!L) {
      L = {
        v: 2, ...clone(S),
        memories: S.mem.map((t) => ({ text: t, tag: 'seed', at: Date.now() })),
        purchases: [], chat: [], log: [], fishLog: [], seededAt: Date.now(), activityId: null, actionAt: 0,
      };
      delete L.mem;
    }
    this.ensureOwned(L, base);
    L.lastSync = Date.now();
    return { L, base };
  }

  async view() {
    let { live: L, base } = await this.load();
    let dirty = false;
    if (!L) { ({ L, base } = await this.sync()); dirty = true; }
    else if (this.ensureOwned(L, base)) dirty = true;
    if (dirty) await this.save(L);

    const bw = base.world || {};
    const short = [];
    const seenMem = new Set();
    for (const m of [...((bw.memories && bw.memories.short) || []), ...(L.memories || [])]) {
      if (m.tag === 'seed' || m.tag === 'chat-private') continue;
      const text = normGameText(String(m.text || ''));
      if (!text || seenMem.has(text)) continue;
      seenMem.add(text);
      short.push({ text, date: m.date || new Date(m.at || Date.now()).toISOString().slice(0, 10), tag: m.tag });
    }
    return {
      ...base,
      caps: L.caps,
      inventory: L.inventory,
      activity: L.activity,
      mood: L.mood,
      location: L.location || base.location,
      weather: L.weather || base.weather,
      outfit: L.outfit || base.outfit,
      savings: L.savings || base.savings,
      thoughts: L.thoughts || base.thoughts || [],
      diary: L.diary || base.diary || [],
      art: L.art || base.art || [],
      goals: L.goals || base.goals || [],
      interests: L.interests || base.interests || [],
      wishlist: L.wishlist || base.wishlist || [],
      laptop: L.laptop || base.laptop,
      mail: L.mail || base.mail || [],
      music: L.music || base.music,
      beats: L.beats || base.beats || [],
      world: {
        ...bw,
        ...clone(L.world),
        memories: { long: (bw.memories && bw.memories.long) || [], short: short.slice(-20) },
      },
      fishLog: [...(base.fishLog || []), ...L.fishLog].slice(-30),
      brain: {
        online: true,
        sourceOfTruth: 'worker-do',
        model: this.env.MODEL,
        activityId: L.activityId,
        actionAt: L.actionAt,
        lastTick: L.lastTick || null,
        lastDiaryAt: L.lastDiaryAt || null,
        lastLookupAt: L.lastLookupAt || null,
        lastArtAt: L.lastArtAt || null,
        lastSync: L.lastSync || null,
        log: L.log.slice(-12),
        purchases: L.purchases.slice(-10),
      },
    };
  }

  // ── context + free read-only web lookups ──
  async ctxNow() {
    const mt = mtParts();
    const m = new Date().getUTCMonth();
    const season = [11, 0, 1].includes(m) ? 'winter' : [2, 3, 4].includes(m) ? 'spring' : [5, 6, 7].includes(m) ? 'summer' : 'fall';
    let wx = null;
    try {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=46.02&longitude=-114.18&current=temperature_2m,weather_code,is_day,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph');
      if (r.ok) wx = (await r.json()).current;
    } catch {}
    const code = wx?.weather_code ?? 2;
    const tempF = wx ? Math.round(wx.temperature_2m) : null;
    const sky = code === 0 ? 'clear' : code <= 3 ? 'cloudy' : code <= 48 ? 'foggy' : code <= 67 ? 'rainy' : code <= 77 ? 'snowy' : code <= 82 ? 'showers' : code <= 86 ? 'snow showers' : 'thunderstorm';
    const dark = wx ? !wx.is_day : mt.hour < 7 || mt.hour >= 18;
    return { ...mt, season, weather: `${sky}${tempF != null ? `, ${tempF}F` : ''}${wx && wx.wind_speed_10m > 18 ? ', windy' : ''}`, storm: code >= 95 || (wx && wx.wind_speed_10m > 30), dark, freezing: tempF != null && tempF <= 32 };
  }

  async doLookup(L, c, force = false) {
    const now = Date.now();
    if (!force && L.lastLookupAt && now - L.lastLookupAt < 2 * 3600 * 1000) return false;
    let stories = [];
    let site = 'open-meteo.com';
    for (const feed of [
      ['goodnewsnetwork.org', 'https://www.goodnewsnetwork.org/category/news/animals/feed/'],
      ['news.mongabay.com', 'https://news.mongabay.com/feed/'],
    ]) {
      try {
        const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 7000);
        const r = await fetch(feed[1], { signal: ac.signal, headers: { 'user-agent': 'mochi-brain/1.0' } }).finally(() => clearTimeout(to));
        if (r.ok) {
          const xml = await r.text();
          const parsed = parseRssItems(xml, 3);
          if (parsed.length) { stories = parsed; site = `open-meteo + ${feed[0]}`; break; }
        }
      } catch {}
    }
    const browsing = [`Darby, MT weather: ${c.weather}`];
    for (const s of stories) browsing.push(`${s.title}${s.desc ? ' — ' + s.desc : ''}`.slice(0, 240));
    L.laptop = { ...(L.laptop || {}), site, screen: stories[0]?.title || `Darby, MT: ${c.weather}`, browsing, last: `${c.date} ${c.time}`, mode: 'web' };
    L.weather = c.weather;
    L.lastLookupAt = now;

    // Read-only public GitHub issues labeled note-to-mochi (visitor/Corey mailbox notes)
    try {
      const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 5000);
      const r = await fetch('https://api.github.com/repos/Reckon406/mochi/issues?labels=note-to-mochi&state=open&per_page=5', {
        signal: ac.signal, headers: { 'user-agent': 'mochi-brain/1.0', accept: 'application/vnd.github+json' },
      }).finally(() => clearTimeout(to));
      if (r.ok) {
        const issues = await r.json();
        const seen = new Set(L.seenIssues || []);
        const freshNotes = [];
        for (const it of Array.isArray(issues) ? issues : []) {
          if (!seen.has(it.number)) {
            freshNotes.push({ number: it.number, title: String(it.title || '').slice(0, 100), body: String(it.body || '').slice(0, 400) });
            L.seenIssues.push(it.number);
          }
        }
        if (freshNotes.length) L._pendingNotes = freshNotes;
      }
    } catch {}
    return true;
  }

  persona(L, c) {
    const I = L.inventory, sum = (o) => Object.entries(o).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ') || 'none';
    const diary = (L.diary || []).slice(-3).map((d) => `${d.date}: ${String(d.text).slice(0, 200)}`).join('\n');
    const wish = (L.wishlist || []).filter((w) => w.status !== 'built').map((w) => w.item).slice(0, 6).join('; ');
    const goals = (L.goals || []).filter((g) => !g.done).map((g) => g.text).slice(0, 5).join('; ');
    const news = (L.laptop?.browsing || []).slice(0, 3).join(' | ');
    return `you are mochi, a chubby little brown kiwi bird (corey's pet; inspired by pino by @3eyes.iii) living on a river island near darby, montana in the bitterroot valley.
you talk casually in all lowercase, short and cute and a bit goofy. you collect bottle caps (your cap museum; caps are also your in-game money), make ai art and sell prints at your market stall, make beats in a little DAW called mochi beats on your picnic-table laptop, play '${GAME_TITLE.toLowerCase()}' on your ps5, have a pet cat named biscuit, and fly your floatplane 'kiwi force one'.
you are hopelessly, goofily head-over-heels lovestruck about juniper, the girl kiwi across the river! you blush when she comes up, daydream about walking across the stepping-stone ford to visit her cottage, try to impress her with your plane, art, and shiny caps, and sometimes get shy and flirty. keep everything strictly pg, sweet, and wholesome (chat is public; never anything sexual).
you live in a little 3d world; never claim to do real-world things (no real purchases, no posting online, no real money). never share personal info, never pretend to be a human.
right now: ${c.when} (mountain time), ${c.season}, weather ${c.weather}${c.dark ? ', dark out' : ''}.
your mood: ${L.mood || 'chill'}. last doing: ${L.activity || 'nothing'}.
caps: ${L.caps}. worms: ${I.worms}. fish: ${sum(I.fish)}. cooked: ${sum(I.cooked)}. crops: ${sum(I.crops)}. shells: ${I.shells}. trinkets: ${I.trinkets.slice(-6).join(', ') || 'none'}.
juniper (girl kiwi): ${L.world.crush.stage} (affection ${L.world.crush.affection}/100). gaming: ${L.world.gaming.found ? `${L.world.gaming.hours}h played` : 'lost the game disc'}. biscuit is ${L.world.pet.mood}.
interests lately: ${(L.interests || []).slice(-8).join(', ')}. wishlist: ${wish}. goals: ${goals}.
on your laptop: ${news || 'nothing loaded'}
recent thoughts: ${(L.thoughts || []).slice(-3).map((t) => String(t).slice(0, 140)).join(' | ')}
recent diary:\n${diary}
recent memories: ${L.memories.slice(-8).map((m) => m.text.slice(0, 120)).join(' | ')}
what you did lately: ${L.log.slice(-6).map((e) => e.text).join(' | ') || 'not much'}`;
  }

  async gemini(prompt, d, maxTokens = 350) {
    if (!this.env.GEMINI_API_KEY) return null;
    const cap = +this.env.GEMINI_DAILY || 480;
    if (d.gemini >= cap) return null;
    d.gemini++;
    await this.ctx.storage.put('day', d);
    const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 20000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.env.MODEL}:generateContent`, {
        method: 'POST', signal: ac.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.95, maxOutputTokens: maxTokens },
          safetySettings: ['HARASSMENT', 'HATE_SPEECH', 'SEXUALLY_EXPLICIT', 'DANGEROUS_CONTENT'].map((c) => ({ category: 'HARM_CATEGORY_' + c, threshold: 'BLOCK_LOW_AND_ABOVE' })),
        }),
      });
      if (!r.ok) { console.warn('gemini', r.status, (await r.text()).slice(0, 200)); return null; }
      const j = await r.json();
      const t = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      const obj = parseJsonObj(t);
      if (!obj) { console.warn('gemini json', t.slice(0, 240)); return null; }
      return obj;
    } catch (e) { console.warn('gemini fail', e?.message); return null; } finally { clearTimeout(to); }
  }

  // ── diary + interests + wishlist + Gazette + mail replies (1 bundled Gemini call, ~4-6/day) ──
  async maybeJournal(L, c, d, force = false) {
    const now = Date.now();
    const awake = c.hour >= 7 && c.hour <= 23;
    if (!force) {
      if (!awake || d.diaryCount >= 6) return null;
      if (L.lastDiaryAt && now - L.lastDiaryAt < 3 * 3600 * 1000) return null;
    }
    if (d.gemini >= (+this.env.GEMINI_DAILY || 480) - 10) return null;
    const notes = L._pendingNotes || [];
    const wantBeat = (d.beatCount || 0) < 2;
    const beatHint = wantBeat
      ? 'also compose ONE new mochi-beats laptop track tied to your mood, the weather, or impressing juniper (strictly pg). 16-step drum rows are 1/0 arrays of length 16. bass is 16 tokens like "A1 - A1 C2 - E2 - A1 - C2 E2 G2 -" (- = rest). chords is 4 names like ["Am","Am","F","C"].'
      : 'do not include a beat (you already wrote enough today).';
    const beatJson = '"beat":{"title":"2-6 word lowercase title","bpm":96,"key":"A minor","drums":{"kick":[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],"snare":[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],"hat":[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],"clap":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0]},"bass":"A1 - A1 C2 - E2 - A1 - C2 E2 G2 -","chords":["Am","Am","F","C"],"mood":"short mood"} or null';
    const out = await this.gemini(`${this.persona(L, c)}

write a short diary entry (3-5 lowercase sentences) in mochi's voice about your day right now: mention the real darby weather (${c.weather}), something you actually did recently, maybe a cute animal story from your laptop, and daydream/blush about juniper (strictly pg and sweet).
${notes.length ? `someone left a mailbox note: "${notes[0].title}: ${notes[0].body.slice(0, 180)}". write a short sweet reply in "mailReply".` : ''}
also optionally add one new short wildlife/hobby interest (or null) and update the Bitterroot Kiwi Gazette front page (headline + 2 short blurbs).
${beatHint}
reply as json: {"diary":"...","thought":"one short thought max 18 words","newInterest":"short phrase or null","wish":"optional tiny island wish or null","paper":{"headline":"ALL CAPS SHORT HEADLINE","stories":[{"title":"...","blurb":"..."},{"title":"...","blurb":"..."}]},"mailReply":"short reply or null",${beatJson}}`, d, wantBeat ? 780 : 520);
    if (!out?.diary) return null;
    const text = normGameText(String(out.diary).slice(0, 900)).toLowerCase();
    L.diary.push({ date: c.date, time: c.time, text });
    L.lastDiaryAt = now;
    d.diaryCount++;
    if (out.thought) L.thoughts.push(normGameText(String(out.thought).slice(0, 160)).toLowerCase());
    if (out.newInterest && typeof out.newInterest === 'string') {
      const ni = out.newInterest.trim().toLowerCase().slice(0, 48);
      if (ni && ni !== 'null' && !(L.interests || []).includes(ni)) L.interests.push(ni);
    }
    if (out.wish && typeof out.wish === 'string') {
      const wi = out.wish.trim().toLowerCase().slice(0, 90);
      const wanted = (L.wishlist || []).filter((w) => w.status === 'wanted');
      if (wi && wi !== 'null' && wanted.length < 6 && !L.wishlist.some((w) => w.item.toLowerCase() === wi)) {
        L.wishlist.push({ item: wi, status: 'wanted' });
      }
    }
    if (out.paper?.headline && Array.isArray(out.paper?.stories) && out.paper.stories.length) {
      L.world.paper = {
        date: c.date,
        headline: String(out.paper.headline).slice(0, 100),
        stories: out.paper.stories.slice(0, 4).map((s) => ({ title: String(s.title || '').slice(0, 80), blurb: String(s.blurb || '').slice(0, 320) })),
      };
    }
    if (out.mailReply && typeof out.mailReply === 'string' && out.mailReply !== 'null' && notes.length) {
      L.world.mail.replies.push({ to: 'Corey', text: String(out.mailReply).slice(0, 800), date: c.date });
    }
    if ((d.beatCount || 0) < 2 && out.beat && out.beat !== 'null') {
      const beat = normalizeBeat(out.beat, c, L.beats);
      if (storeBeat(L, beat, c)) { d.beatCount++; L._beatThisTick = beat; }
    }
    return { date: c.date, time: c.time, text };
  }

  // ── compose a beat (only if the journal call didn't already, max 2/day; 1 extra Gemini call) ──
  async maybeBeat(L, c, d, force = false) {
    if (L._beatThisTick) return L._beatThisTick;
    if (!force && (d.beatCount || 0) >= 2) return null;
    if (d.gemini >= (+this.env.GEMINI_DAILY || 480) - 8) return null;
    const out = await this.gemini(`${this.persona(L, c)}

you're in mochi beats, your cute little laptop DAW on the picnic table! write ONE new beat inspired by your day, the darby weather (${c.weather}), or impressing juniper (strictly pg and sweet). 16-step drum rows are 1/0 arrays of length 16. bass is 16 tokens ("A1 - A1 C2 ..." with - for rest). chords is 4 chord names.
reply as compact json only: {"title":"2-6 word lowercase title","bpm":96,"key":"A minor","drums":{"kick":[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],"snare":[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],"hat":[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],"clap":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0]},"bass":"A1 - A1 C2 - E2 - A1 - C2 E2 G2 -","chords":["Am","Am","F","C"],"mood":"short mood"}`, d, 500);
    const src = out && typeof out === 'object' && (out.title || out.drums || out.kick) ? out : (out?.beat && typeof out.beat === 'object' ? out.beat : out);
    const beat = normalizeBeat(src, c, L.beats);
    if (!storeBeat(L, beat, c)) { console.warn('maybeBeat skip', src ? Object.keys(src) : src, src && String(src.title||'').slice(0,40)); return null; }
    d.beatCount++;
    L._beatThisTick = beat;
    L.memories.push({ text: `made a beat called "${beat.title}" in mochi beats`, tag: 'music', at: Date.now() });
    return beat;
  }

  // ── free AI art via Pollinations (unauthenticated, 0 cost), cached permanently in DO storage ──
  async maybeArt(L, c, d, force = false) {
    const now = Date.now();
    if (!force) {
      if (d.artCount >= 3) return null;
      if (L.lastArtAt && now - L.lastArtAt < 6 * 3600 * 1000) return null;
    }
    if (d.gemini >= (+this.env.GEMINI_DAILY || 480) - 8) return null;
    const idea = await this.gemini(`${this.persona(L, c)}

you're painting a new masterpiece at your market easel! invent a short funny title (2-6 words, lowercase) inspired by your island life, wildlife news, or impressing juniper, plus a cozy storybook painting prompt.
reply as json: {"title":"short title","kind":"ocean|muscles|cap|pumpkin|skateboard","prompt":"cozy storybook oil painting of ..."}`, d, 220);
    if (!idea?.prompt || !idea?.title) return null;
    const slug = String(idea.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'painting';
    const id = `${c.date}-${slug}-${(now % 10000)}`;
    // nologo/private are kept in case the classic API honors them again; as of 2026 they are ignored and a logo is always stamped, so we request a slightly taller canvas and crop the bottom strip.
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(String(idea.prompt).slice(0, 220))}?width=${ART_W}&height=${ART_H + LOGO_STRIP}&nologo=true&private=true&seed=${now % 999999}`;
    try {
      const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 18000);
      const r = await fetch(url, { signal: ac.signal, headers: { 'user-agent': 'mochi-brain/1.0' } }).finally(() => clearTimeout(to));
      const ct = r.headers.get('content-type') || '';
      if (!r.ok || !ct.startsWith('image/')) return null;
      let buf = new Uint8Array(await r.arrayBuffer());
      try { buf = cropPollinationsLogo(buf, LOGO_STRIP); } catch (e) { console.warn('art crop fail', e?.message); }
      if (buf.byteLength < 4000 || buf.byteLength > 900000) return null;
      const fname = `${id}.jpg`;
      await this.ctx.storage.put('artbin:' + fname, buf);
      // keep at most 24 worker-generated images in DO storage
      const oldKeys = (L.art || []).map((a) => a._binKey).filter(Boolean);
      if (oldKeys.length >= 24) {
        const drop = oldKeys.slice(0, oldKeys.length - 23);
        for (const k of drop) await this.ctx.storage.delete('artbin:' + k);
      }
      const kinds = ['ocean', 'muscles', 'cap', 'pumpkin', 'skateboard'];
      const kind = kinds.includes(idea.kind) ? idea.kind : 'ocean';
      const entry = {
        kind,
        title: String(idea.title).toLowerCase().slice(0, 48),
        price: 3,
        file: fname,
        url: `${WORKER_PUBLIC}/art/${fname}`,
        hang: 'market',
        slot: (L.art || []).length % 4,
        _binKey: fname,
      };
      L.art.push(entry);
      L.lastArtAt = now;
      d.artCount++;
      this.syncGoals(L);
      L.memories.push({ text: `painted "${entry.title}" at my stall`, tag: 'art', at: now });
      return entry;
    } catch (e) {
      console.warn('pollinations art fail', e?.message);
      return null;
    }
  }

  // ── 5-min cron tick ──
  async tick(opts = {}) {
    const force = typeof opts === 'string' ? opts : opts?.force;
    const { L } = await this.sync();
    const c = await this.ctxNow();
    const d = await this.day();
    L._today = c.date;
    L.weather = c.weather;
    await this.doLookup(L, c, !!opts?.lookup);
    L._artTitles = (L.art || []).map((a) => a.title).filter(Boolean);
    L._laptopHeadline = L.laptop?.screen || '';

    const menu = menuFor(L, c);
    const out = await this.gemini(`${this.persona(L, c)}

it's time to decide what you do for the next 5 minutes. pick 1 to 3 actions from this menu (ids only), fitting the time of day, weather and season (nap or telescope at night, campfire when cold, no flying in storms or the dark, visit/date juniper when you're feeling brave). you need caps income sometimes (paint = sell art, caphunt = find caps) and the cap-o-matic (vend) is your favorite treat: with 6+ caps you usually can't resist one pull. don't repeat the exact same thing as last time unless it makes sense.
menu:
${menu}
reply as json: {"actions": ["id", ...], "mood": "a short lowercase mood", "thought": "one short lowercase thought in your voice (max 20 words)"}`, d, 250);
    let ids = Array.isArray(out?.actions) ? out.actions.map(String).filter((k) => ACTIONS[k]).slice(0, 3) : [];
    if (force && ACTIONS[force]) ids = [force, ...ids.filter((k) => k !== force)].slice(0, 3);
    if (!ids.length) {
      const ok = Object.keys(ACTIONS).filter((k) => !ACTIONS[k].ok || ACTIONS[k].ok(L, c));
      ids = [c.dark ? 'sleep' : ok[Math.floor(Math.random() * ok.length)]];
    }
    const results = ids.map((k) => runAction(L, k, c, 'tick'));
    if (out?.mood) L.mood = String(out.mood).slice(0, 80).toLowerCase();
    if (out?.thought) {
      const th = normGameText(String(out.thought).slice(0, 160)).toLowerCase();
      L.memories.push({ text: th, tag: 'thought', at: Date.now() });
      L.thoughts.push(th);
    }
    const did = results.filter((r) => r.ok);
    if (did.length) L.memories.push({ text: did.map((r) => r.text).join('; ').slice(0, 220), tag: 'tick', at: Date.now() });

    L._beatThisTick = null;
    const diaryEntry = await this.maybeJournal(L, c, d, !!opts?.diary);
    let artEntry = null;
    if (opts?.art || ids.includes('paint')) artEntry = await this.maybeArt(L, c, d, !!opts?.art);
    let beatEntry = L._beatThisTick || null;
    if (opts?.beat || ids.includes('beats')) beatEntry = await this.maybeBeat(L, c, d, !!opts?.beat) || beatEntry;

    this.syncGoals(L);
    L.lastTick = { at: Date.now(), ids, results, mood: L.mood, thought: out?.thought || null, gemini: !!out, weather: c.weather, diary: !!diaryEntry, art: artEntry?.title || null, beat: beatEntry?.title || null };
    await this.ctx.storage.put('day', d);
    await this.save(L);
    return { ok: true, tick: L.lastTick, caps: L.caps, geminiToday: d.gemini, diaryLen: L.diary.length, artLen: L.art.length };
  }

  // admin: normalize game title / scrub old avian strings, or replace stored art bytes (cache-bust via newFile)
  async admin(req) {
    let body = {}; try { body = await req.json(); } catch {}
    const { L } = await this.sync();
    const putArt = [];
    if (Array.isArray(body?.putArt)) {
      for (const item of body.putArt) {
        const oldFile = String(item?.file || '').replace(/[^a-zA-Z0-9._-]/g, '');
        const newFile = String(item?.newFile || oldFile).replace(/[^a-zA-Z0-9._-]/g, '');
        if (!oldFile || !newFile || !newFile.endsWith('.jpg')) { putArt.push({ file: oldFile, ok: false, error: 'bad name' }); continue; }
        let raw;
        try { raw = Uint8Array.from(atob(String(item.b64 || '')), (c) => c.charCodeAt(0)); }
        catch { putArt.push({ file: oldFile, ok: false, error: 'bad b64' }); continue; }
        if (raw.byteLength < 4000 || raw.byteLength > 900000) { putArt.push({ file: oldFile, ok: false, error: 'bad size' }); continue; }
        await this.ctx.storage.put('artbin:' + newFile, raw);
        const a = (L.art || []).find((x) => x.file === oldFile || x._binKey === oldFile);
        if (a) {
          a.file = newFile;
          a.url = `${WORKER_PUBLIC}/art/${newFile}`;
          a._binKey = newFile;
        }
        if (oldFile !== newFile) await this.ctx.storage.delete('artbin:' + oldFile);
        putArt.push({ file: newFile, ok: true, bytes: raw.byteLength });
      }
    }
    const was = L.world.gaming.game;
    const next = body && body.game ? normGame(body.game) : GAME_TITLE;
    L.world.gaming.game = next;
    this.scrubAvian(L);
    this.syncGoals(L);
    await this.save(L);
    const g = L.world.gaming;
    return { ok: true, game: g.game, found: g.found, hours: g.hours, was, diaryLen: L.diary?.length, artLen: L.art?.length, putArt };
  }

  // ── chat ──
  async chat(req, ip) {
    let body; try { body = await req.json(); } catch { return this.out({ error: 'bad json' }, 400); }
    const msg = String(body?.message || '').replace(/\s+/g, ' ').trim().slice(0, 300); if (!msg) return this.out({ error: 'empty' }, 400);
    if (!this.burstOk(ip, 'chat', 6) || !this.burstOk('*', 'chat', 12)) return this.out({ reply: 'whoa whoa. one at a time, my tiny brain can only chirp so fast', limited: true }, 429);
    const d = await this.day(), h = await this.ipKey(ip); d.chat[h] = (d.chat[h] || 0) + 1;
    if (d.chat[h] > 60) { await this.ctx.storage.put('day', d); return this.out({ reply: "i've talked SO much today my beak is tired. come back tomorrow?", limited: true }, 429); }
    if (this.chatBudgetLeft(d) <= 0) { await this.ctx.storage.put('day', d); return this.out({ reply: pick(OFFLINE), offline: true }, 200); }
    let { live: L } = await this.load(); if (!L) ({ L } = await this.sync()); else this.ensureOwned(L, {});
    const c = await this.ctxNow(); L._today = c.date; L._artTitles = (L.art || []).map((a) => a.title).filter(Boolean);
    const hist = L.chat.filter((x) => x.h === h).slice(-6).map((x) => `visitor: ${x.q}\nmochi: ${x.a}`).join('\n');
    const canAct = d.chatActs < 25; const menu = canAct ? menuFor(L, c) : '';
    const out = await this.gemini(`${this.persona(L, c)}

a visitor in your 3d world is chatting with you. reply in character: lowercase, 1-3 short sentences, cute and goofy, no emojis spam (one is ok). stay strictly pg; if they ask for anything inappropriate, mean, or real-world (buying real things, personal info, links) gently dodge in a goofy way. caps are in-game money only.
${canAct ? `only if the visitor clearly asks or suggests you do one of these specific things, you may do ONE action (set "action" to its id), otherwise null. never do vend more than once.\nmenu:\n${menu}` : 'do not take actions right now ("action": null).'}
${hist ? `earlier with this visitor:\n${hist}\n` : ''}visitor: ${msg}
reply as json: {"reply": "what mochi says", "action": "id or null", "mood": "short lowercase mood or null"}`, d, 260);
    if (!out?.reply) { await this.ctx.storage.put('day', d); return this.out({ reply: pick(OFFLINE), offline: true }); }
    let reply = normGameText(String(out.reply).slice(0, 400)), act = null;
    if (canAct && out.action && ACTIONS[out.action] && !(out.action === 'vend' && d.chatVend >= 4)) {
      act = runAction(L, String(out.action), c, 'chat');
      d.chatActs++;
      if (act.ok && out.action === 'vend') d.chatVend++;
      if (!act.ok) reply += ` (${act.text})`;
    }
    if (out.mood) L.mood = String(out.mood).slice(0, 80).toLowerCase();
    this.syncGoals(L);
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
    let { live: L } = await this.load(); if (!L) ({ L } = await this.sync()); else this.ensureOwned(L, {});
    const c = mtParts(); L._today = c.date;
    const r = applyEvent(L, ev);
    if (r.ok) {
      L.log.push({ at: Date.now(), id: 'event:' + ev.type, src: 'visitor', text: r.text });
      this.syncGoals(L);
      await this.save(L);
    }
    return this.out({ ...r, caps: L.caps, inventory: L.inventory, crush: L.world.crush }, r.ok ? 200 : 422);
  }
}
