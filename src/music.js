// Mochi's soundtrack. STATE.music = { songs: [{ id, title, mood, bpm?, key?, notes?, file? }], playing?: id }
// Songs without `file` are generated live with Web Audio from the song itself (title seeds the melody, mood picks scale/tempo/sound),
// so every song he "writes" sounds different but stays the same each time. `file` = ./music/<file> (mp3/ogg) if he ever makes a real track.
//
// IMPORTANT: reuse noise buffers and disconnect nodes on ended. Creating a fresh AudioBuffer + graph per drum hit used to
// pile up for ~one song (~60s) and freeze the tab on real machines.
const MOODS = {
  happy: { scale: [0, 2, 4, 7, 9], bpm: 112, wave: 'triangle', prog: [0, 5, 3, 4], bright: 1 },
  chill: { scale: [0, 2, 3, 5, 7, 9, 10], bpm: 78, wave: 'sine', prog: [0, 3, 6, 4], bright: 0.5 },
  sad: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 70, wave: 'sine', prog: [0, 5, 2, 6], bright: 0.35 },
  spooky: { scale: [0, 1, 3, 5, 6, 8, 10], bpm: 92, wave: 'square', prog: [0, 1, 0, 5], bright: 0.4 },
  hype: { scale: [0, 2, 4, 5, 7, 9, 10], bpm: 132, wave: 'sawtooth', prog: [0, 6, 3, 4], bright: 0.8 },
  cozy: { scale: [0, 2, 4, 5, 7, 9, 11], bpm: 88, wave: 'triangle', prog: [0, 3, 4, 3], bright: 0.55 },
  epic: { scale: [0, 2, 3, 5, 7, 8, 10], bpm: 100, wave: 'sawtooth', prog: [0, 5, 6, 4], bright: 0.7 },
};
const ALIAS = { joy: 'happy', silly: 'happy', confident: 'hype', angry: 'hype', rage: 'hype', majestic: 'epic', brave: 'epic', lonely: 'sad', cold: 'sad', sleepy: 'chill', calm: 'chill', witch: 'spooky', halloween: 'spooky', warm: 'cozy', home: 'cozy' };
export function moodOf(s = '') { const m = String(s).toLowerCase(); for (const k in MOODS) if (m.includes(k)) return k; for (const k in ALIAS) if (m.includes(k)) return ALIAS[k]; return 'chill'; }
const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const KEYS = { c: 48, 'c#': 49, db: 49, d: 50, 'd#': 51, eb: 51, e: 52, f: 53, 'f#': 54, gb: 54, g: 55, 'g#': 56, ab: 56, a: 57, 'a#': 58, bb: 58, b: 59 };
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngOf(seed) { let a = seed || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function parseNotes(str) { // "C4 E4 G4 - A4 ." -> midi or null(rest)
  return String(str || '').trim().split(/[\s,]+/).filter(Boolean).slice(0, 64).map((t) => { const m = t.toLowerCase().match(/^([a-g])([#b]?)(\d)?$/); if (!m) return null; return 12 * ((m[3] ? +m[3] : 4) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); });
}

// a song -> a deterministic 8-bar arrangement
export function compose(song) {
  const mood = MOODS[moodOf(song.mood || song.title)]; const r = rngOf(hash((song.id || '') + '|' + (song.title || '')));
  const root = KEYS[String(song.key || '').toLowerCase()] ?? 48 + Math.floor(r() * 7); const bpm = Math.max(50, Math.min(170, +song.bpm || mood.bpm + Math.round((r() - 0.5) * 12)));
  const sc = mood.scale; const deg = (d, oct = 0) => root + 12 * (oct + Math.floor(d / sc.length)) + sc[((d % sc.length) + sc.length) % sc.length];
  const motif = parseNotes(song.notes);
  const mel = []; let d = Math.floor(r() * 3) + 2;
  for (let i = 0; i < 32; i++) { // 8 bars x 4 beats, eighth-note grid via `half`
    if (motif.length) { mel.push(motif[i % motif.length]); continue; }
    if (r() < 0.22) { mel.push(null); continue; } d += Math.round((r() - 0.5) * 3.2); d = Math.max(0, Math.min(sc.length * 2, d)); mel.push(deg(d, 1));
  }
  const prog = mood.prog.map((p) => (p + Math.floor(r() * 2)) % sc.length);
  return { bpm, root, mood, prog, mel, deg, swing: r() < 0.5 ? 0.08 : 0, drums: mood.bpm > 85 || r() < 0.4 };
}

function mkNoise(ctx, dur) {
  const len = Math.max(1, Math.ceil(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buf;
}
function drop(...nodes) { for (const n of nodes) { try { n.disconnect(); } catch { /* already gone */ } } }

export function createMusic(state, settings) {
  const songs = (state.music && Array.isArray(state.music.songs) ? state.music.songs : []).filter((s) => s && (s.title || s.file));
  let ctx = null, master, musicBus, sfxBus, ambBus, cur = Math.max(0, songs.findIndex((s) => s.id && s.id === state.music?.playing)), timer = null, audioEl = null, onChange = () => {}, started = false;
  let noise = null; // shared one-shot noise buffers (created once per AudioContext)
  let liveNodes = 0; // approx in-flight sources (for ?debug=1)
  function ensure() {
    if (ctx) return ctx; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination); musicBus = ctx.createGain(); sfxBus = ctx.createGain(); ambBus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor(); musicBus.connect(comp); comp.connect(master); sfxBus.connect(master); ambBus.connect(master);
    noise = { hit: mkNoise(ctx, 0.12), tick: mkNoise(ctx, 0.04), short: mkNoise(ctx, 0.05), long: mkNoise(ctx, 0.55), spray: mkNoise(ctx, 0.6) };
    applyLevels(); // river fades in over ~2.5s on first start instead of starting at full volume
    ambBus.gain.cancelScheduledValues(ctx.currentTime); ambBus.gain.setValueAtTime(0, ctx.currentTime); ambBus.gain.linearRampToValueAtTime(ambLevel(), ctx.currentTime + 2.5);
    river(); return ctx;
  }
  function ambLevel() { const s = settings.get(); return s.sfx * (s.river ?? 0.3) * 0.35; } // river default = 30% of the old level
  function applyLevels() { if (!ctx) return; const s = settings.get(); master.gain.value = s.mute ? 0 : s.master; musicBus.gain.value = s.music * 0.55; sfxBus.gain.value = s.sfx; const amb = ambLevel(); ambBus.gain.cancelScheduledValues(ctx.currentTime); ambBus.gain.setTargetAtTime(amb, ctx.currentTime, 0.08); if (audioEl) audioEl.volume = s.mute ? 0 : s.master * s.music; }
  function river() { // soft filtered-noise river ambience (one looping buffer, forever)
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let b = 0; for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 3; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; src.connect(f); f.connect(ambBus); src.start();
  }
  function track(src) {
    liveNodes++;
    const done = () => { liveNodes = Math.max(0, liveNodes - 1); };
    try { src.addEventListener('ended', done); } catch { src.onended = done; }
  }
  function tone(freq, t, dur, { wave = 'triangle', vol = 0.2, bus = musicBus, cutoff = 2400, attack = 0.01 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = wave; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
    track(o); o.onended = () => { drop(o, f, g); liveNodes = Math.max(0, liveNodes - 1); };
  }
  function noiseHit(t, dur, vol, hp, bus = musicBus) {
    const buf = dur <= 0.045 ? noise.tick : dur <= 0.08 ? noise.short : dur <= 0.2 ? noise.hit : dur <= 0.55 ? noise.long : noise.spray;
    const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; const g = ctx.createGain();
    // envelope so reused longer buffers still die on time
    const end = t + dur;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, end);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(end + 0.02);
    track(s); s.onended = () => { drop(s, f, g); liveNodes = Math.max(0, liveNodes - 1); };
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.25);
    track(o); o.onended = () => { drop(o, g); liveNodes = Math.max(0, liveNodes - 1); };
  }

  function playSong(i) {
    stopSong(); if (!songs.length || !ensure()) return; cur = ((i % songs.length) + songs.length) % songs.length; const song = songs[cur];
    const f = typeof song.file === 'string' && /^[\w.-]+\.(mp3|ogg|wav|m4a)$/i.test(song.file) ? song.file : null;
    if (f) { audioEl = new Audio('./music/' + encodeURIComponent(f)); audioEl.onended = () => playSong(cur + 1); audioEl.onerror = () => { audioEl = null; generate(song); }; applyLevels(); audioEl.play().catch(() => generate(song)); }
    else generate(song);
    onChange(song);
  }
  function generate(song) {
    const A = compose(song); const beat = 60 / A.bpm; const loops = 3; let bar = 0; const total = 8 * loops;
    const sched = () => { // schedule one bar ahead
      if (bar >= total) { timer = setTimeout(() => playSong(cur + 1), beat * 1000); return; }
      const t0 = Math.max(ctx.currentTime + 0.05, sched.next || 0); const b8 = bar % 8; const chordDeg = A.prog[Math.floor(b8 / 2) % A.prog.length];
      [0, 2, 4].forEach((k) => tone(mtof(A.deg(chordDeg + k)), t0, beat * 3.8, { wave: 'sine', vol: 0.05, cutoff: 900 + 1200 * A.mood.bright, attack: 0.2 }));
      tone(mtof(A.deg(chordDeg) - 12), t0, beat * 1.8, { wave: 'triangle', vol: 0.14, cutoff: 500 }); tone(mtof(A.deg(chordDeg) - 12), t0 + beat * 2, beat * 1.8, { wave: 'triangle', vol: 0.11, cutoff: 500 });
      for (let k = 0; k < 4; k++) { const n = A.mel[(b8 * 4 + k) % A.mel.length]; const t = t0 + k * beat + (k % 2 ? A.swing * beat : 0); if (n != null && bar >= 1) tone(mtof(n), t, beat * 0.9, { wave: A.mood.wave, vol: A.mood.wave === 'sawtooth' || A.mood.wave === 'square' ? 0.05 : 0.11, cutoff: 1500 + 2500 * A.mood.bright }); }
      if (A.drums && bar >= 2) for (let k = 0; k < 4; k++) { const t = t0 + k * beat; if (k % 2 === 0) kick(t); else noiseHit(t, 0.12, 0.18, 1500); noiseHit(t + beat / 2, 0.04, 0.06, 7000); }
      sched.next = t0 + 4 * beat; bar++; timer = setTimeout(sched, Math.max(10, (sched.next - ctx.currentTime - 0.15) * 1000));
    };
    sched();
  }
  function stopSong() { clearTimeout(timer); timer = null; if (audioEl) { audioEl.pause(); audioEl = null; } }
  // little synth chirps for SFX
  function sfx(kind) { if (!ensure() || settings.get().sfx <= 0) return; const t = ctx.currentTime + 0.01;
    if (kind === 'hop') { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(1500, t + 0.09); o.frequency.exponentialRampToValueAtTime(1100, t + 0.16); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.25); track(o); o.onended = () => { drop(o, g); liveNodes = Math.max(0, liveNodes - 1); }; }
    else if (kind === 'click') tone(1200, t, 0.06, { wave: 'sine', vol: 0.12, bus: sfxBus });
    else if (kind === 'step') noiseHit(t, 0.05, 0.05, 2500, sfxBus);
    else if (kind === 'sizzle') noiseHit(t, 0.5, 0.08, 4000, sfxBus);
    else if (kind === 'hoot') { [0, 0.35, 0.55].forEach((d, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(i ? 360 : 330, t + d); o.frequency.exponentialRampToValueAtTime(300, t + d + 0.25); g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.3); o.connect(g); g.connect(sfxBus); o.start(t + d); o.stop(t + d + 0.35); track(o); o.onended = () => { drop(o, g); liveNodes = Math.max(0, liveNodes - 1); }; }); }
    else if (kind === 'clang') { [880, 1320, 1760].forEach((f) => tone(f, t, 0.5, { wave: 'square', vol: 0.05, bus: sfxBus, cutoff: 5000 })); }
    else if (kind === 'spray') noiseHit(t, 0.6, 0.12, 2000, sfxBus);
    else if (kind === 'thunk') { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.09); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.16); track(o); o.onended = () => { drop(o, g); liveNodes = Math.max(0, liveNodes - 1); }; noiseHit(t, 0.04, 0.06, 1800, sfxBus); }
  }
  // browsers only allow audio after a user gesture
  const kick0 = () => { if (started) return; started = true; if (!ensure()) return; ctx.resume(); if (settings.get().musicOn && songs.length) playSong(cur); };
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => addEventListener(e, kick0, { once: true, passive: true }));
  return {
    songs, get started() { return started; }, get current() { return songs[cur] || null; }, get playing() { return !!(timer || audioEl); },
    get liveNodes() { return liveNodes; },
    next() { started = true; playSong(cur + 1); }, play(i = cur) { started = true; ctx?.resume(); playSong(i); }, stop() { stopSong(); onChange(null); },
    onChange(fn) { onChange = fn; }, applyLevels, sfx,
    setEnabled(on) { if (on && started && !this.playing) playSong(cur); if (!on) { stopSong(); onChange(null); } },
  };
}
