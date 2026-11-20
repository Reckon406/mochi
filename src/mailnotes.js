// 📬 notes to Mochi: tap his mailbox (or the 📬 button) to write him a note. It's kept on this device and sent as a
// GitHub issue on Reckon406/mochi (title starts "📬 note to Mochi", label note-to-mochi) so his check-in can read it.
// His letters back come from STATE: world.mail.replies = [{ to, text, date }] and show here + as a speech bubble.
import * as THREE from 'three';
import { openCard, escHtml } from './overlay.js';

const REPO = 'Reckon406/mochi';
const LS = 'mochi.notes', SEEN = 'mochi.mail.seen';
const load = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } };
export function issueUrl(text) {
  const first = text.replace(/\s+/g, ' ').trim().slice(0, 50);
  const body = `${text}\n\n— sent from Mochi's mailbox (${new Date().toLocaleString()})`;
  return `https://github.com/${REPO}/issues/new?labels=note-to-mochi&title=${encodeURIComponent('📬 note to Mochi: ' + first)}&body=${encodeURIComponent(body)}`;
}
export function createMailNotes(scene, { state, mailbox, say = () => {} }) {
  const w = state.world && typeof state.world.mail === 'object' && state.world.mail ? state.world.mail : {};
  const replies = (Array.isArray(w.replies) ? w.replies : []).filter((r) => r && r.text).map((r) => ({ to: String(r.to || 'Corey').slice(0, 40), text: String(r.text).slice(0, 2000), date: String(r.date || '').slice(0, 30) })).slice(-20);
  // invisible tap target around the mailbox
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
  if (mailbox?.pos) { hit.position.copy(mailbox.pos); hit.position.y -= 0.4; scene.add(hit); }
  const latest = replies.length ? replies[replies.length - 1] : null; const key = latest ? latest.date + '|' + latest.text.slice(0, 30) : '';
  let seen = ''; try { seen = localStorage.getItem(SEEN) || ''; } catch {}
  const api = { replies, get notes() { return load(); }, unseen: !!latest && key !== seen,
    open() {
      const notes = load().slice(-8).reverse();
      const letters = replies.slice().reverse().map((r) => `<div style="background:#fffaf0;border-radius:6px;padding:14px 16px;margin-bottom:10px;box-shadow:0 2px 6px rgba(0,0,0,.2);font-family:'Comic Sans MS','Chalkboard SE',Nunito,sans-serif;color:#3a2a1a;transform:rotate(-.6deg)"><div style="font-size:12px;opacity:.6">${escHtml(r.date)}</div><div style="margin:4px 0 6px">Dear ${escHtml(r.to)},</div><div style="white-space:pre-wrap;line-height:1.45">${escHtml(r.text)}</div><div style="text-align:right;margin-top:8px">love, Mochi 🥝</div></div>`).join('');
      const el = openCard(`<div style="background:#c2423a linear-gradient(#c94a40,#a8362f);padding:14px 14px 18px;color:#fff;font-family:Nunito,system-ui,sans-serif">
        <div style="font-weight:800;font-size:18px;margin:2px 4px 10px">📬 Mochi's mailbox</div>
        ${letters ? `<div style="font-weight:700;margin:4px 4px 8px">Letters from Mochi</div>${letters}` : '<div style="opacity:.85;margin:0 4px 10px;font-size:13px">No letters from Mochi yet. Write him one!</div>'}
        <div style="background:#fff;border-radius:10px;padding:12px;color:#333;margin-top:8px"><div style="font-weight:800;margin-bottom:6px">✉️ Write to Mochi</div>
          <textarea id="mnote" rows="4" maxlength="1500" placeholder="hi mochi..." style="width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:8px;padding:8px;font:15px Nunito,system-ui,sans-serif;resize:vertical"></textarea>
          <button id="msend" style="margin-top:8px;border:0;border-radius:99px;background:#c2423a;color:#fff;font:800 14px Nunito,sans-serif;padding:9px 16px;cursor:pointer">Send to Mochi 📮</button>
          <div style="font-size:11.5px;color:#777;margin-top:6px">Opens a GitHub issue on ${REPO} for you to submit (you need to be signed in to GitHub). Mochi reads them at his check-in. A copy stays on this device.</div>
          ${notes.length ? `<div style="font-weight:700;margin-top:10px;font-size:13px">Sent from here</div>${notes.map((n) => `<div style="font-size:13px;border-top:1px solid #eee;padding:5px 0"><span style="color:#999">${escHtml(new Date(n.t).toLocaleDateString())}</span> ${escHtml(n.text)}</div>`).join('')}` : ''}</div></div>`);
      el.querySelector('#msend').addEventListener('click', () => { const ta = el.querySelector('#mnote'); const text = ta.value.trim(); if (!text) { ta.focus(); return; }
        const all = load(); all.push({ text, t: Date.now() }); try { localStorage.setItem(LS, JSON.stringify(all.slice(-50))); } catch {}
        window.open(issueUrl(text), '_blank', 'noopener'); ta.value = ''; el.querySelector('#msend').textContent = 'Sent! (finish it on GitHub) ✓'; });
      if (latest) { try { localStorage.setItem(SEEN, key); } catch {} api.unseen = false; }
      return el;
    },
    tap(ray) { const h = ray.intersectObject(hit, false)[0]; if (!h || h.distance > 30) return false; api.open(); return true; },
    greet() { if (api.unseen) say(`📬 I wrote you back, ${latest.to}! check my mailbox`, 5); } };
  return api;
}
