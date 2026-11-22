// Normalize Gemini beat JSON into a compact, playable pattern stored in the DO.
const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const QUALITY = { '': [0, 4, 7], maj: [0, 4, 7], major: [0, 4, 7], m: [0, 3, 7], min: [0, 3, 7], minor: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7] };

export function steps16(v, fallback = 0) {
  let a = [];
  if (Array.isArray(v)) a = v.map((x) => (x && x !== '0' && x !== '-' && x !== '.' ? 1 : 0));
  else if (typeof v === 'string') a = [...String(v).replace(/\s+/g, '').slice(0, 16)].map((ch) => (ch === '1' || ch === 'x' || ch === 'X' ? 1 : 0));
  while (a.length < 16) a.push(fallback);
  return a.slice(0, 16);
}

export function parsePitch(tok, fallbackOct = 3) {
  const m = String(tok || '').trim().toLowerCase().match(/^([a-g])([#b]?)(-?\d)?$/);
  if (!m) return null;
  const oct = m[3] != null && m[3] !== '' ? +m[3] : fallbackOct;
  return 12 * (oct + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export function parseBass(v) {
  if (Array.isArray(v)) return Array.from({ length: 16 }, (_, i) => { const x = v[i]; if (x == null || x === '' || x === '-' || x === '.') return null; if (Number.isFinite(+x) && +x > 12) return Math.max(24, Math.min(72, +x | 0)); return parsePitch(x, 2); });
  const toks = String(v || '').trim().split(/[\s,]+/).filter(Boolean);
  return Array.from({ length: 16 }, (_, i) => parsePitch(toks[i], 2));
}

export function parseChordToken(tok) {
  if (Array.isArray(tok)) return tok.map((n) => (Number.isFinite(+n) ? +n : parsePitch(n, 4))).filter((n) => Number.isFinite(n));
  const m = String(tok || '').trim().match(/^([A-Ga-g])([#b]?)(maj7|min7|m7|maj|min|sus2|sus4|dim|aug|major|minor|m|M|7)?$/);
  if (!m) return [];
  const root = 12 * 4 + NOTE[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); // around C4
  const q = (m[3] || '').toLowerCase();
  const iv = QUALITY[q] || (q === 'm' || q === 'min' || q === 'minor' ? QUALITY.m : QUALITY['']);
  return iv.map((d) => root + d);
}

export function parseChords(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(/[\s,]+/).filter(Boolean);
  const ch = list.map(parseChordToken).filter((c) => c.length);
  if (!ch.length) return [parseChordToken('C'), parseChordToken('G'), parseChordToken('Am'), parseChordToken('F')];
  while (ch.length < 4) ch.push(ch[ch.length - 1]);
  return ch.slice(0, 4);
}

export function normalizeBeat(raw, c, existing = []) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 48);
  if (!title) return null;
  const slug = title.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'beat';
  let id = String(raw.id || `beat-${c.date}-${slug}`).replace(/[^a-z0-9._-]/g, '-').slice(0, 48);
  if (existing.some((b) => b && (b.id === id || b.title === title))) id = `${id}-${(Date.now() % 1000)}`;
  const drums = raw.drums && typeof raw.drums === 'object' ? raw.drums : raw;
  const kick = steps16(drums.kick, 0);
  const snare = steps16(drums.snare, 0);
  const hat = steps16(drums.hat, 0);
  const clap = steps16(drums.clap, 0);
  if (![...kick, ...snare, ...hat, ...clap].some(Boolean)) {
    // a totally empty grid is not a beat
    return null;
  }
  return {
    kind: 'beat',
    id,
    title,
    bpm: Math.max(60, Math.min(160, Math.round(+raw.bpm || 96))),
    key: String(raw.key || 'C').slice(0, 16),
    mood: String(raw.mood || '').toLowerCase().slice(0, 80),
    drums: { kick, snare, hat, clap },
    bass: parseBass(raw.bass),
    chords: parseChords(raw.chords),
    date: c.date,
    time: c.time,
  };
}

export function storeBeat(L, beat, c) {
  if (!beat) return null;
  if (!Array.isArray(L.beats)) L.beats = [];
  if (!L.music || typeof L.music !== 'object') L.music = { songs: [] };
  if (!Array.isArray(L.music.songs)) L.music.songs = [];
  if (L.beats.some((b) => b.id === beat.id) || L.music.songs.some((s) => s.id === beat.id)) return beat;
  L.beats.push(beat);
  L.music.songs.push(beat);
  if (L.beats.length > 24) {
    const drop = new Set(L.beats.splice(0, L.beats.length - 24).map((b) => b.id));
    L.music.songs = L.music.songs.filter((s) => !drop.has(s.id));
  }
  L.lastBeatAt = Date.now();
  L._lastBeatTitle = beat.title;
  const prev = L.laptop || {};
  L.laptop = { ...prev, site: 'mochi beats', screen: beat.title, mode: 'daw', beat, last: `${c.date} ${c.time}` };
  return beat;
}
