// Usage: node scripts/shoot.mjs [baseUrl]  — renders preview screenshots into ./shots
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const base = process.argv[2] || 'http://localhost:4173/';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const shots = [
  { name: 'wide', q: '?rotate=0', w: 1280, h: 800, wait: 6000 },
  { name: 'closeup', q: '?cam=mochi&rotate=0&stay=1&say=24', w: 1280, h: 800, wait: 6000 },
  { name: 'snow', q: '?weather=heavy%20snow%2C%2024F&rotate=0', w: 1280, h: 800, wait: 7000 },
  { name: 'phone', q: '?rotate=0', w: 390, h: 844, dpr: 2, mobile: true, wait: 6000 },
  { name: 'golden', q: '?hour=16.55&rotate=0&elk=1&az=150&el=16', w: 1280, h: 800, wait: 9000 },
  { name: 'night', q: '?hour=21.5&rotate=0&el=9&az=95', w: 1280, h: 800, wait: 6000 },
  { name: 'closeup-back', q: '?cam=mochi&rotate=0&stay=1&camyaw=2.4&say=18', w: 1280, h: 800, wait: 6000 },
  { name: 'closeup-snow', q: '?cam=mochi&rotate=0&stay=1&weather=light%20snow&say=23', w: 1280, h: 800, wait: 6000 },
];
fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
let errors = 0;
for (const s of shots) {
  if (only && !only.includes(s.name)) continue;
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr || 1, isMobile: !!s.mobile, hasTouch: !!s.mobile });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  const t0 = Date.now();
  await page.goto(base + s.q, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__mochiReady === true, null, { timeout: 120000 });
  await page.waitForTimeout(s.wait);
  if (s.after) await page.evaluate(s.after);
  await page.screenshot({ path: `shots/${s.name}.png` });
  const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else r((n / ((performance.now() - t) / 1000)).toFixed(1)); }; requestAnimationFrame(f); }));
  console.log(`${s.name}: ${Date.now() - t0}ms, ~${fps} fps (swiftshader)`, logs.length ? '\n  ' + logs.join('\n  ') : '(no console errors/warnings)');
  errors += logs.filter((l) => !l.startsWith('[warning]')).length;
  await ctx.close();
}
await browser.close();
process.exit(errors ? 1 : 0);
