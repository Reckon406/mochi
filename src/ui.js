// HTML overlay: status card, progress bars, collapsible diary/art/goals, zone legend
import { ZONES } from './layout.js';
import { artUrl } from './artfiles.js';
import { artTex } from './textures.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
function bar(label, val, max, fmt, cls) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0;
  return `<div class="bar ${cls}"><div class="bar-top"><span>${label}</span><b>${fmt(val)} <i>/ ${fmt(max)}</i></b></div><div class="track"><div class="fill" style="width:${pct.toFixed(1)}%"></div></div></div>`;
}
const ART_EMOJI = { pumpkin: '🎃', muscles: '💪', ocean: '🌊', cap: '🧢', skateboard: '🛹' };

export function buildUI(state, weather, { onZone, onFollow, favoredId, error }) {
  const root = document.getElementById('ui');
  const sv = state.savings || {};
  const savingsBars = Object.entries(sv).map(([k, s]) => bar(`${k === 'ocean' ? '🌊' : k === 'skateboard' ? '🛹' : '💰'} ${esc(s.label || k)}`, s.saved, s.target, money, k)).join('');
  const capsGoal = (() => { const g = (state.goals || []).find((x) => /cap/i.test(x.text)); const m = g && g.text.match(/(\d+)/); return m ? parseInt(m[1]) : 50; })();
  const diary = [...(state.diary || [])].reverse();
  const byDate = {}; diary.forEach((d) => (byDate[d.date] ||= []).push(d));
  const fmtDate = (d) => { const dt = new Date(d + 'T12:00:00'); return isNaN(dt) ? d : dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
  const fmtTime = (t) => { const [h, m] = (t || '').split(':').map(Number); if (isNaN(h)) return t || ''; const ap = h >= 12 ? 'pm' : 'am'; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`; };
  const diaryHtml = Object.entries(byDate).map(([d, items]) => `<div class="day"><div class="date">${esc(fmtDate(d))}</div>${items.map((it) => `<div class="entry"><span class="time">${esc(fmtTime(it.time))}</span><p>${esc(it.text)}</p></div>`).join('')}</div>`).join('') || '<p class="muted">no diary yet. he is busy.</p>';
  // gallery: newest first. real art -> ./art/<file>; otherwise a painted (procedural) thumbnail, emoji if even that fails
  const arts = [...(state.art || [])].map((a, i) => ({ a, i })).reverse();
  const painted = (a) => { try { return artTex(a.kind, a.title, a.price).image.toDataURL('image/png'); } catch { return ''; } };
  const artThumbs = arts.map(({ a, i }) => ({ a, i, src: artUrl(a) || painted(a), real: !!artUrl(a), fallback: painted(a) }));
  const artHtml = artThumbs.length ? `<div class="gallery">${artThumbs.map((t, k) => `<button class="thumb ${t.real ? 'real' : ''}" data-k="${k}" aria-label="${esc(t.a.title)}">
      <span class="frame">${t.src ? `<img loading="lazy" alt="" src="${t.src}" data-fb="${k}">` : ''}<span class="ae">${ART_EMOJI[t.a.kind] || '🖼️'}</span>${t.real ? '<span class="badge">✨ original</span>' : ''}</span>
      <span class="tt">${esc(t.a.title)}</span><span class="ap">${money(t.a.price)}</span></button>`).join('')}</div>` : '<p class="muted">no masterpieces (yet)</p>';
  const goalsHtml = (state.goals || []).map((g) => `<div class="goal ${g.done ? 'done' : ''}"><span class="chk">${g.done ? '✔' : ''}</span><div><div class="gt">${esc(g.text)}</div>${g.meta ? `<div class="gm">${esc(g.meta)}</div>` : ''}</div></div>`).join('');

  root.innerHTML = `
  <section class="card" id="card">
    <header>
      <div class="avatar">🥝</div>
      <div class="hd"><h1>${esc(state.name || 'Mochi')}'s World</h1><div class="loc">📍 Darby, Montana · Bitterroot Valley · <span>${esc(state.weather || '')}</span></div></div>
      <button class="collapse" id="collapse" aria-label="toggle panel">▾</button>
    </header>
    <div class="body" id="cardBody">
      <div class="row mood"><span class="k">mood</span><span class="v">${esc(state.mood)}</span></div>
      <div class="row act"><span class="k">doing</span><span class="v">${esc(state.activity)}</span></div>
      <div class="row out"><span class="k">wearing</span><span class="v">${esc(state.outfit || 'nothing. free bird')}</span></div>
      <div class="bars">
        ${bar('🧢 Bottle caps', state.caps || 0, capsGoal, (n) => String(Math.round(n)), 'caps')}
        ${savingsBars}
      </div>
      <div class="tabs" role="tablist">
        <button data-tab="diary">📔 Diary <i>${(state.diary || []).length}</i></button>
        <button data-tab="art">🎨 Art <i>${(state.art || []).length}</i></button>
        <button data-tab="goals">⭐ Goals <i>${(state.goals || []).filter((g) => g.done).length}/${(state.goals || []).length}</i></button>
      </div>
      <div class="pane" id="pane-diary">${diaryHtml}</div>
      <div class="pane" id="pane-art">${artHtml}</div>
      <div class="pane" id="pane-goals">${goalsHtml}</div>
    </div>
  </section>
  <nav class="legend" id="legend">
    ${ZONES.map((z) => `<button class="zone ${z.id === favoredId ? 'fav' : ''}" data-zone="${z.id}" title="send mochi to the ${esc(z.name.toLowerCase())}"><span>${z.emoji}</span>${esc(z.name)}</button>`).join('')}
  </nav>
  <div class="tools">
    <button id="followBtn" title="camera follows mochi">🎥 follow</button>
    <span class="hint">drag to look around · tap mochi to make him hop · tap a place to send him</span>
  </div>
  ${error ? `<div class="toast">${esc(error)}</div>` : ''}
  <div class="lightbox" id="lightbox" hidden><div class="lb-inner"><button class="lb-close" aria-label="close">✕</button><img alt=""><div class="lb-cap"><b></b><span></span></div>
    <button class="lb-prev" aria-label="previous">‹</button><button class="lb-next" aria-label="next">›</button></div></div>`;

  const card = root.querySelector('#card');
  const small = matchMedia('(max-width: 640px)').matches;
  if (small) card.classList.add('collapsed');
  root.querySelector('#collapse').onclick = () => card.classList.toggle('collapsed');
  root.querySelector('header .hd').onclick = () => { if (small) card.classList.toggle('collapsed'); };
  const tabs = root.querySelectorAll('.tabs button');
  tabs.forEach((b) => (b.onclick = () => {
    const open = !b.classList.contains('on');
    tabs.forEach((x) => x.classList.remove('on')); root.querySelectorAll('.pane').forEach((p) => p.classList.remove('open'));
    if (open) { b.classList.add('on'); root.querySelector('#pane-' + b.dataset.tab).classList.add('open'); }
  }));
  root.querySelectorAll('.zone').forEach((b) => (b.onclick = () => onZone(b.dataset.zone)));
  // gallery images: fall back to the painted version, then to the emoji
  root.querySelectorAll('.gallery img').forEach((img) => { img.onerror = () => { const t = artThumbs[+img.dataset.fb]; if (t.real && img.src !== t.fallback && t.fallback) { t.real = false; t.src = t.fallback; img.src = t.fallback; img.closest('.thumb').classList.remove('real'); img.parentElement.querySelector('.badge')?.remove(); } else img.remove(); }; });
  const lb = root.querySelector('#lightbox'), lbImg = lb.querySelector('img'); let lbK = 0;
  const showLb = (k) => { lbK = (k + artThumbs.length) % artThumbs.length; const t = artThumbs[lbK]; lbImg.src = t.src || t.fallback; lbImg.onerror = () => { if (t.fallback && lbImg.src !== t.fallback) lbImg.src = t.fallback; };
    lb.querySelector('.lb-cap b').textContent = t.a.title || 'untitled'; lb.querySelector('.lb-cap span').textContent = `${money(t.a.price)}${t.real ? ' · original by mochi' : ''}`; lb.hidden = false; };
  root.querySelectorAll('.thumb').forEach((b) => (b.onclick = () => showLb(+b.dataset.k)));
  lb.onclick = (e) => { if (e.target === lb || e.target.classList.contains('lb-close')) lb.hidden = true; };
  lb.querySelector('.lb-prev').onclick = () => showLb(lbK - 1); lb.querySelector('.lb-next').onclick = () => showLb(lbK + 1);
  addEventListener('keydown', (e) => { if (lb.hidden) return; if (e.key === 'Escape') lb.hidden = true; if (e.key === 'ArrowLeft') showLb(lbK - 1); if (e.key === 'ArrowRight') showLb(lbK + 1); });
  let sx = null; lb.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  lb.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) showLb(lbK + (dx < 0 ? 1 : -1)); sx = null; });
  const fb = root.querySelector('#followBtn'); let fol = false;
  fb.onclick = () => { fol = !fol; fb.classList.toggle('on', fol); onFollow(fol); };
  const tst = root.querySelector('.toast'); if (tst) setTimeout(() => tst.classList.add('gone'), 7000);

  return {
    setActiveZone(id) { root.querySelectorAll('.zone').forEach((b) => b.classList.toggle('active', b.dataset.zone === id)); },
    setFollow(on) { fol = on; fb.classList.toggle('on', on); },
    openTab(name) { root.querySelector(`.tabs button[data-tab="${name}"]`)?.click(); },
  };
}
