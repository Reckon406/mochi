// Real Darby, MT weather from Open-Meteo (free, no key). Cached in localStorage; any failure falls back to STATE.weather.
const URL_OM = 'https://api.open-meteo.com/v1/forecast?latitude=46.02&longitude=-114.18&current=temperature_2m,weather_code,wind_speed_10m,is_day,cloud_cover&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FDenver';
const LS = 'mochi.liveWeather';
export function describe(cur) {
  const c = +cur.weather_code, t = Math.round(+cur.temperature_2m), w = +cur.wind_speed_10m || 0;
  let s = c === 0 ? 'clear' : c === 1 ? 'mostly clear' : c === 2 ? 'partly cloudy' : c === 3 ? 'overcast clouds' : c === 45 || c === 48 ? 'fog' :
    c >= 51 && c <= 57 ? 'drizzle' : c >= 61 && c <= 67 ? (c === 65 || c === 67 ? 'heavy rain' : 'rain') : c >= 71 && c <= 77 ? (c === 75 ? 'heavy snow' : c === 71 ? 'light snow' : 'snow') :
    c >= 80 && c <= 82 ? (c === 82 ? 'heavy rain showers' : 'rain showers') : c === 85 || c === 86 ? 'snow showers' : c >= 95 ? 'thunderstorm' : 'cloudy';
  if (w >= 18) s += ', windy'; else if (w >= 10) s += ', breezy';
  return `${s}, ${t}F`;
}
async function fetchOnce(timeout = 2500) {
  const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), timeout);
  try { const r = await fetch(URL_OM, { signal: ac.signal, cache: 'no-store' }); if (!r.ok) throw new Error(r.status); const j = await r.json(); if (!j.current || j.current.weather_code == null) throw new Error('no current');
    const out = { text: describe(j.current), tempF: Math.round(j.current.temperature_2m), code: j.current.weather_code, wind: j.current.wind_speed_10m, at: Date.now() }; try { localStorage.setItem(LS, JSON.stringify(out)); } catch (e) { /* ignore */ } return out;
  } finally { clearTimeout(tm); }
}
// on load: a cache under 10 min old (be polite to the free API), else a fresh fetch (short timeout), else a cache under 3h old, else null
export async function liveWeather() {
  try { const c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c && Date.now() - c.at < 10 * 60e3) return { ...c, cached: true }; } catch (e) { /* ignore */ }
  try { return await fetchOnce(); } catch (e) { try { const c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c && Date.now() - c.at < 3 * 3600e3) return { ...c, cached: true }; } catch (e2) { /* ignore */ } return null; }
}
// every ~15 min: refresh the top-bar text + temperature feel. (Rain/snow particle changes take effect on the next load.)
export function startLiveWeather(onUpdate, every = 15 * 60e3) {
  const id = setInterval(async () => { if (document.hidden) return; try { const w = await fetchOnce(6000); onUpdate(w); } catch (e) { /* keep the last one */ } }, every);
  return () => clearInterval(id);
}
