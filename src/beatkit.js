// Shared helpers for Mochi Beats (16-step patterns stored by the Worker).
const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const QUALITY = { '': [0, 4, 7], maj: [0, 4, 7], major: [0, 4, 7], m: [0, 3, 7], min: [0, 3, 7], minor: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7] };

export function isBeat(song) { return !!(song && (song.kind === 'beat' || song.drums)); }
export function kitUrl(file) {
  const base = import.meta.env?.BASE_URL || './';
  return (base.endsWith('/') ? base : base + '/') + 'music/kit/' + file;
}
export function steps16(v) {
  let a = [];
  if (Array.isArray(v)) a = v.map((x) => (x && x !== '0' && x !== '-' && x !== '.' ? 1 : 0));
  else if (typeof v === 'string') a = [...String(v).replace(/\s+/g, '').slice(0, 16)].map((ch) => (ch === '1' || ch === 'x' || ch === 'X' ? 1 : 0));
  while (a.length < 16) a.push(0);
  return a.slice(0, 16);
}
function pitch(tok, fallbackOct = 3) {
  if (Number.isFinite(+tok) && +tok > 12) return Math.max(24, Math.min(96, +tok | 0));
  const m = String(tok || '').trim().toLowerCase().match(/^([a-g])([#b]?)(-?\d)?$/);
  if (!m) return null;
  const oct = m[3] != null && m[3] !== '' ? +m[3] : fallbackOct;
  return 12 * (oct + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export function bassNotes(v) {
  if (Array.isArray(v) && v.length) return Array.from({ length: 16 }, (_, i) => { const x = v[i]; if (x == null || x === '' || x === '-' || x === '.') return null; return pitch(x, 2); });
  const toks = String(v || '').trim().split(/[\s,]+/).filter(Boolean);
  return Array.from({ length: 16 }, (_, i) => pitch(toks[i], 2));
}
function chordTok(tok) {
  if (Array.isArray(tok)) return tok.map((n) => pitch(n, 4)).filter((n) => n != null);
  const m = String(tok || '').trim().match(/^([A-Ga-g])([#b]?)(maj7|min7|m7|maj|min|sus2|sus4|dim|aug|major|minor|m|M|7)?$/);
  if (!m) return [];
  const root = 12 * 4 + NOTE[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const q = (m[3] || '').toLowerCase();
  const iv = QUALITY[q] || QUALITY[''];
  return iv.map((d) => root + d);
}
export function chordBars(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(/[\s,]+/).filter(Boolean);
  const ch = list.map(chordTok).filter((c) => c.length);
  if (!ch.length) return [[60, 64, 67], [67, 71, 74], [57, 60, 64], [65, 69, 72]];
  while (ch.length < 4) ch.push(ch[ch.length - 1]);
  return ch.slice(0, 4);
}

export function drawDaw(g, w, h, beat, step = 0) {
  const title = String(beat?.title || 'new beat').slice(0, 28);
  const bpm = Math.max(60, Math.min(160, +beat?.bpm || 96));
  const key = String(beat?.key || 'C').slice(0, 10);
  g.fillStyle = '#12141c'; g.fillRect(0, 0, w, h);
  // title bar
  g.fillStyle = '#1e2433'; g.fillRect(0, 0, w, 52);
  g.fillStyle = '#ff8ad1'; g.fillRect(0, 0, 8, 52);
  g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.fillText('MOCHI BEATS', 20, 34);
  g.fillStyle = '#9ad0ff'; g.font = 'bold 16px sans-serif'; g.textAlign = 'right';
  g.fillText(`${bpm} BPM  ${key}`, w - 16, 34); g.textAlign = 'left';
  g.fillStyle = '#c8d0e0'; g.font = 'bold 15px sans-serif'; g.fillText(title, 20, 70);
  const rows = [
    ['KICK', steps16(beat?.drums?.kick), '#ff6b8a'],
    ['SNARE', steps16(beat?.drums?.snare), '#ffd34d'],
    ['HAT', steps16(beat?.drums?.hat), '#7dff9a'],
    ['CLAP', steps16(beat?.drums?.clap), '#c9b6ff'],
  ];
  const left = 70, top = 86, rh = 38, gap = 6, cell = (w - left - 16) / 16;
  rows.forEach((row, r) => {
    const y = top + r * (rh + gap);
    g.fillStyle = '#8b93a7'; g.font = 'bold 13px sans-serif'; g.fillText(row[0], 12, y + 25);
    for (let i = 0; i < 16; i++) {
      const x = left + i * cell;
      const on = !!row[1][i];
      const play = i === (step & 15);
      g.fillStyle = play ? '#2a3a55' : (Math.floor(i / 4) % 2 ? '#1a1e28' : '#161922');
      g.fillRect(x + 1, y, cell - 3, rh);
      if (on) { g.fillStyle = row[2]; g.globalAlpha = play ? 1 : 0.85; g.fillRect(x + 3, y + 4, cell - 7, rh - 8); g.globalAlpha = 1; }
      if (play) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x + 2, y + 1, cell - 5, rh - 2); }
    }
  });
  // bass / chords strip
  const by = top + 4 * (rh + gap) + 4;
  g.fillStyle = '#1a1e28'; g.fillRect(12, by, w - 24, h - by - 10);
  g.fillStyle = '#8b93a7'; g.font = 'bold 12px sans-serif';
  const bass = bassNotes(beat?.bass);
  const ch = chordBars(beat?.chords);
  const bassTxt = bass.map((n) => (n == null ? '·' : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n % 12])).join(' ');
  g.fillText('BASS  ' + bassTxt.slice(0, 42), 20, by + 18);
  const names = (beat?.chords || []).map((c) => (typeof c === 'string' ? c : '')).filter(Boolean);
  g.fillText('CHORDS  ' + (names.length ? names.join('  ') : ch.map((c) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][c[0] % 12]).join('  ')), 20, by + 36);
}
