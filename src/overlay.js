// a simple tap-to-close card overlay (memory box, newspaper). Plain DOM, no deps.
let el = null;
export function openCard(html, { wide = false } = {}) {
  closeCard();
  if (!document.getElementById('mcard-css')) { const st = document.createElement('style'); st.id = 'mcard-css'; st.textContent = `
.mcard-bg{position:fixed;inset:0;z-index:60;background:rgba(10,12,20,.55);display:flex;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(2px)}
.mcard{max-width:min(94vw,${wide ? 720 : 560}px);max-height:88vh;overflow:auto;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.45);position:relative;-webkit-overflow-scrolling:touch}
.mcard-x{position:sticky;top:6px;float:right;margin:6px;border:0;border-radius:50%;width:32px;height:32px;font-size:18px;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;z-index:2}
.mem-wrap{background:#5b3d26 linear-gradient(#6b4a30,#4e331f);padding:14px 12px 18px;color:#2a1d12;font-family:Nunito,system-ui,sans-serif}
.mem-h{color:#fbe9cf;font-weight:800;font-size:18px;margin:4px 6px 10px}.mem-sub{color:#e8cfa8;font-size:12px;margin:-6px 6px 10px}
.mem-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:12px}
.pol{background:#fffdf7;padding:8px 8px 10px;box-shadow:0 3px 8px rgba(0,0,0,.35);transform:rotate(var(--r));font-size:13px;line-height:1.3}
.pol .ph{height:84px;margin-bottom:7px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:34px}
.pol .d{font-size:11px;color:#8a7a6a;margin-top:4px}.pol .tg{display:inline-block;font-size:10px;background:#f1e3cf;border-radius:8px;padding:1px 6px;margin-top:4px}
.cork{background:#c79a63;background-image:radial-gradient(rgba(0,0,0,.08) 1px,transparent 1px);background-size:6px 6px;padding:14px 12px;border-radius:8px;margin-top:14px;border:6px solid #7a5432}
.note{background:var(--bg);padding:9px 9px 10px;box-shadow:0 2px 5px rgba(0,0,0,.3);transform:rotate(var(--r));font-size:13px;position:relative;font-family:"Comic Sans MS","Chalkboard SE",Nunito,sans-serif}
.note:before{content:"";position:absolute;top:-5px;left:50%;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:var(--pin);box-shadow:0 1px 2px rgba(0,0,0,.5)}
.empty{color:#fbe9cf;opacity:.8;font-size:13px;padding:8px}
.paper{background:#f4efe2;color:#1d1a16;font-family:Georgia,"Times New Roman",serif;padding:18px 20px 22px}
.paper .mast{text-align:center;border-bottom:3px double #1d1a16;padding-bottom:6px}.paper .mast b{display:block;font-family:"Old English Text MT","UnifrakturCook",Georgia,serif;font-size:clamp(24px,7vw,40px);letter-spacing:.5px}
.paper .meta{display:flex;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1d1a16;padding:4px 0;margin-bottom:10px}
.paper h1{font-size:clamp(22px,6vw,34px);line-height:1.08;margin:6px 0 12px;text-align:center}
.paper .cols{columns:2 210px;column-gap:20px;column-rule:1px solid #bbb}.paper .st{break-inside:avoid;margin-bottom:12px}.paper .st h3{font-size:16px;margin:0 0 4px;line-height:1.2}.paper .st p{margin:0;font-size:13.5px;line-height:1.45}
.paper .lead p:first-letter{float:left;font-size:42px;line-height:.9;padding-right:4px}.paper .foot{border-top:1px solid #1d1a16;margin-top:8px;padding-top:4px;font-size:11px;text-align:center;font-style:italic}
`; document.head.appendChild(st); }
  el = document.createElement('div'); el.className = 'mcard-bg'; el.innerHTML = `<div class="mcard"><button class="mcard-x" aria-label="close">✕</button>${html}</div>`;
  el.addEventListener('click', (e) => { if (e.target === el || e.target.classList.contains('mcard-x')) closeCard(); });
  document.body.appendChild(el); addEventListener('keydown', esc);
  return el;
}
function esc(e) { if (e.key === 'Escape') closeCard(); }
export function closeCard() { if (el) { el.remove(); el = null; removeEventListener('keydown', esc); } }
export const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
