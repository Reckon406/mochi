// 🧠 link to mochi-brain (Cloudflare Worker + Durable Object): the always-on source of truth for Mochi's LIVE layer
// (caps, inventory, mood/activity, crush, gaming hours, pet, memories). The page reads /state (falls back to state.json),
// polls it so changes show up without a reload, reports visitor-triggered events to /event, and hosts the 💬 chat sheet.
// ?brain=0 (or live=0, used by the tests) keeps the page fully offline on state.json.
export const BRAIN_URL = 'https://mochi-brain.coreydman15.workers.dev';
export const POLL_MS = 45000;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const brainEnabled = (params) => params.get('brain') !== '0' && params.get('live') !== '0' && !params.get('state');
const brainUrl = (params) => params.get('brainUrl') || BRAIN_URL;

async function req(params, path, body, timeout = 8000) {
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(brainUrl(params) + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal } : { cache: 'no-store', signal: ac.signal });
    let j = null; try { j = await r.json(); } catch {} return { ok: r.ok, status: r.status, j };
  } finally { clearTimeout(to); }
}
export async function fetchBrainState(params, timeout = 4000) {
  const r = await req(params, '/state', null, timeout); if (!r.ok || !r.j || typeof r.j !== 'object' || r.j.caps == null) throw new Error('brain ' + r.status); return r.j;
}

// apply a fresh live layer onto the running sim (in place: life.inv is shared by reference across modules)
export function applyLive(inv, s) {
  if (!inv || !s) return;
  inv.caps = Math.max(0, Math.floor(+s.caps || 0));
  const I = s.inventory || {};
  for (const k of ['worms', 'honey', 'shells', 'firewood', 'acorns']) if (I[k] != null) inv[k] = Math.max(0, +I[k] || 0);
  for (const m of ['fish', 'cooked', 'seeds', 'crops']) if (I[m] && typeof I[m] === 'object') { for (const k of Object.keys(inv[m])) delete inv[m][k]; for (const [k, v] of Object.entries(I[m])) if (+v > 0) inv[m][k] = +v; }
  if (Array.isArray(I.trinkets)) inv.trinkets.splice(0, inv.trinkets.length, ...I.trinkets.slice(-30).map(String));
}

export function createBrainLink({ params, initial, getInv, onState = () => {}, onAction = () => {}, say = () => {} }) {
  const on = brainEnabled(params) && !!initial?.brain;
  let lastAction = initial?.brain?.actionAt || 0, online = on, timer = 0;
  async function poll() {
    if (!on || document.hidden) return;
    try { const s = await fetchBrainState(params, 6000); online = true; applyLive(getInv(), s); onState(s);
      const b = s.brain || {}; if (b.actionAt && b.actionAt > lastAction) { lastAction = b.actionAt; onAction({ life: b.activityId, text: s.activity, from: 'tick' }); }
    } catch (e) { online = false; }
  }
  if (on) { timer = setInterval(poll, POLL_MS); document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); }); }
  async function event(type, data) {
    if (!on) return null;
    try { const r = await req(params, '/event', { type, ...data }); if (r.j && r.j.caps != null) { applyLive(getInv(), { caps: r.j.caps, inventory: r.j.inventory }); onState(null); } return r.j; } catch { return null; }
  }
  async function chat(message) {
    if (!brainEnabled(params)) return { reply: "my brain is offline in this mode. but hi!! 👋", offline: true };
    try { const r = await req(params, '/chat', { message }, 25000); const j = r.j || {};
      if (j.caps != null) { getInv().caps = j.caps; onState(null); }
      if (j.action?.life) { lastAction = Date.now(); onAction({ life: j.action.life, text: j.action.text, from: 'chat' }); }
      return j.reply ? j : { reply: 'mochi is napping in the hut rn. zzz. try again in a bit', offline: true };
    } catch { return { reply: "the island wifi is a squirrel on a wheel and he's on break. try again in a sec", offline: true }; }
  }
  return { get on() { return on; }, get online() { return online; }, poll, event, chat, stop() { clearInterval(timer); } };
}

// ── 💬 chat sheet ──
export function buildChat({ link, say, onOpen = () => {} }) {
  const tools = document.getElementById('tools'); if (!tools) return null;
  const btn = document.createElement('button'); btn.id = 'chatBtn'; btn.type = 'button'; btn.title = 'chat with mochi'; btn.innerHTML = '💬<span class="lbl"> chat</span>'; btn.setAttribute('aria-label', 'chat with mochi');
  const walk = document.getElementById('walkBtn'); tools.insertBefore(btn, walk || tools.firstChild);
  const sheet = document.createElement('section'); sheet.className = 'chatSheet'; sheet.id = 'chatSheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'chat with mochi');
  sheet.innerHTML = `<header><span class="ava">🥝</span><div class="t"><b>mochi</b><i id="chatStatus">${link.on ? 'on his island · replies in a few secs' : 'offline mode'}</i></div><button class="x" id="chatClose" aria-label="close chat">✕</button></header>
    <div class="msgs" id="chatMsgs" aria-live="polite"></div>
    <form id="chatForm" autocomplete="off"><input id="chatIn" maxlength="300" placeholder="say hi to mochi…" enterkeyhint="send" /><button id="chatSend" type="submit" aria-label="send">➤</button></form>`;
  document.getElementById('ui').appendChild(sheet);
  const msgs = sheet.querySelector('#chatMsgs'), form = sheet.querySelector('#chatForm'), input = sheet.querySelector('#chatIn'), send = sheet.querySelector('#chatSend');
  let hist = []; try { hist = JSON.parse(sessionStorage.getItem('mochi.chat') || '[]').slice(-30); } catch {}
  const add = (who, text, extra = '') => { const d = document.createElement('div'); d.className = `msg ${who}${extra ? ' ' + extra : ''}`; d.innerHTML = esc(text); msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; };
  const save = () => { try { sessionStorage.setItem('mochi.chat', JSON.stringify(hist.slice(-30))); } catch {} };
  if (!hist.length) add('mochi', 'chirp! hi. ask me anything (or tell me to go fishing) 🧢'); else for (const m of hist) add(m.w, m.t);
  const open = (v) => { sheet.hidden = !v; btn.classList.toggle('on', v); document.body.classList.toggle('chatting', v); if (v) { onOpen(); setTimeout(() => input.focus({ preventScroll: true }), 50); msgs.scrollTop = msgs.scrollHeight; } };
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(sheet.hidden); });
  sheet.querySelector('#chatClose').addEventListener('click', () => open(false));
  sheet.addEventListener('pointerdown', (e) => e.stopPropagation()); sheet.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') open(false); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const q = input.value.trim(); if (!q || send.disabled) return; input.value = ''; add('me', q); hist.push({ w: 'me', t: q }); save();
    send.disabled = true; const typing = add('mochi', '…', 'typing');
    const r = await link.chat(q); typing.remove(); send.disabled = false;
    add('mochi', r.reply, r.offline ? 'off' : ''); hist.push({ w: 'mochi', t: r.reply }); save(); say(r.reply, Math.min(9, 3 + r.reply.length / 22));
    if (r.action?.text) add('sys', `🐾 ${r.action.text}`);
  });
  return { open, el: sheet, btn };
}
