// ⚙️ settings: graphics, sound, camera. Saved in localStorage ('mochi.settings.v1').
import { autoQuality } from './gfx.js';
const KEY = 'mochi.settings.v1';
const isCoarse = matchMedia('(pointer: coarse)').matches;
export const DEFAULTS = {
  quality: 'auto', // auto | low | medium | high | ultra : pixel ratio, MSAA, shadow map size, AO
  shadows: true, bloom: true, particles: 1, detail: isCoarse ? 0.6 : 1, // particles/detail apply on reload
  master: 0.7, music: 0.6, sfx: 0.7, river: 0.3, mute: false, musicOn: true,
  autoRotate: true, walkHint: true, startCam: 'orbit', lookSens: 1, wildlife: 'normal',
};
export const QUALITY = { low: { pr: 1, msaa: 0, shadow: 1024, tier: 0 }, medium: { pr: 1.5, msaa: 2, shadow: 2048, tier: 1 }, high: { pr: 2, msaa: 4, shadow: 3072, tier: 2 }, ultra: { pr: 2, msaa: 4, shadow: 4096, tier: 3, ao: true } };
QUALITY.auto = QUALITY[autoQuality()];
export function createSettings() {
  let s = { ...DEFAULTS };
  try { const raw = JSON.parse(localStorage.getItem(KEY) || '{}'); for (const k in DEFAULTS) if (k in raw && typeof raw[k] === typeof DEFAULTS[k]) s[k] = raw[k]; } catch {}
  if (!QUALITY[s.quality]) s.quality = DEFAULTS.quality;
  const subs = [];
  return {
    get: () => s,
    set(patch) { s = { ...s, ...patch }; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} subs.forEach((f) => f(s, patch)); },
    reset() { s = { ...DEFAULTS }; try { localStorage.removeItem(KEY); } catch {} subs.forEach((f) => f(s, { ...DEFAULTS })); },
    on(f) { subs.push(f); },
  };
}

// the panel. lives in #ui, opened by the ⚙️ button
export function buildSettingsPanel(root, settings, { music }) {
  const s = settings.get(); const el = document.createElement('section'); el.className = 'settings'; el.hidden = true;
  const rng = (k, label, min, max, step) => `<label class="srow"><span>${label}</span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"><i data-v="${k}"></i></label>`;
  const chk = (k, label) => `<label class="srow scheck"><span>${label}</span><input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''}></label>`;
  const sel = (k, label, opts) => `<label class="srow"><span>${label}</span><select data-k="${k}">${opts.map(([v, t]) => `<option value="${v}" ${s[k] === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  const songs = music.songs;
  el.innerHTML = `<header><b>⚙️ Settings</b><button class="sclose" aria-label="close">✕</button></header>
    <h4>Graphics</h4>${sel('quality', 'Quality', [['auto', 'Auto (' + autoQuality() + ')'], ['low', 'Low (fast)'], ['medium', 'Medium'], ['high', 'High (pretty)'], ['ultra', 'Ultra (AO, heavy)']])}${chk('shadows', 'Shadows')}${chk('bloom', 'Glow / bloom')}${sel('wildlife', 'Wildlife', [['off', 'Off'], ['few', 'A few'], ['normal', 'Normal'], ['lots', 'Lots']])}
    ${rng('particles', 'Rain / snow amount', 0, 1.5, 0.1)}${rng('detail', 'Grass & flowers', 0.2, 1.5, 0.1)}<p class="snote" data-note hidden>grass + weather amount change after a <a href="#" data-reload>reload</a></p>
    <h4>Sound</h4>${rng('master', 'Master', 0, 1, 0.05)}${rng('music', 'Music', 0, 1, 0.05)}${rng('sfx', 'Effects', 0, 1, 0.05)}${rng('river', 'River', 0, 1, 0.05)}${chk('mute', 'Mute everything')}${chk('musicOn', "Play Mochi's songs")}
    <div class="songs">${songs.length ? songs.map((x, i) => `<button data-song="${i}">🎵 ${x.title.replace(/[<>&]/g, '')}<em>${String(x.mood || '').replace(/[<>&]/g, '')}</em></button>`).join('') : '<p class="muted">no songs yet. he is warming up his beak.</p>'}</div>
    <h4>Camera</h4>${chk('autoRotate', 'Auto-rotate when idle')}${chk('walkHint', 'Show walk-mode hint')}${sel('startCam', 'Start in', [['orbit', 'Orbit'], ['follow', 'Follow Mochi'], ['walk', 'Walk (desktop)']])}${rng('lookSens', 'Mouse look speed', 0.3, 2.5, 0.1)}
    <footer><button class="sreset">reset to defaults</button></footer>`;
  root.appendChild(el);
  const fmt = (k, v) => (k === 'particles' || k === 'detail' || k === 'lookSens' ? `${(+v).toFixed(1)}×` : `${Math.round(v * 100)}%`);
  const refresh = () => { const cur = settings.get(); el.querySelectorAll('[data-k]').forEach((i) => { const k = i.dataset.k; if (i.type === 'checkbox') i.checked = !!cur[k]; else i.value = cur[k]; const v = el.querySelector(`[data-v="${k}"]`); if (v) v.textContent = fmt(k, cur[k]); }); };
  refresh();
  el.addEventListener('input', (e) => { const i = e.target; const k = i.dataset.k; if (!k) return; const v = i.type === 'checkbox' ? i.checked : i.type === 'range' ? parseFloat(i.value) : i.value; settings.set({ [k]: v });
    const vv = el.querySelector(`[data-v="${k}"]`); if (vv) vv.textContent = fmt(k, v); if (k === 'particles' || k === 'detail') el.querySelector('[data-note]').hidden = false; });
  el.querySelector('[data-reload]').onclick = (e) => { e.preventDefault(); location.reload(); };
  el.querySelectorAll('[data-song]').forEach((b) => (b.onclick = () => { settings.set({ musicOn: true }); refresh(); music.play(+b.dataset.song); }));
  el.querySelector('.sclose').onclick = () => (el.hidden = true);
  el.querySelector('.sreset').onclick = () => { settings.reset(); refresh(); el.querySelector('[data-note]').hidden = false; };
  el.addEventListener('keydown', (e) => e.stopPropagation()); // don't walk while fiddling with sliders
  return { el, toggle() { el.hidden = !el.hidden; if (!el.hidden) refresh(); }, get open() { return !el.hidden; } };
}
