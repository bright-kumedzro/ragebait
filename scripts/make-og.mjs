// Redraws public/og.png, the 1200×630 link-preview image: the real game, mid-trap on level 1-1, with the logo.
// Usage: npm run build && node scripts/make-og.mjs
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { LEVELS, compile } from '../src/levels/index.js';
import { solve, toSteps } from '../src/levels/solver.js';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = join('dist', decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  try { const body = await readFile(path); res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(4791);

const L = compile(LEVELS[0].def, '1-1'), r = solve(L);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  await page.goto('http://localhost:4791/', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(steps => window.__rb.play(0, steps), toSteps(r.actions, r.chunk));
  await page.evaluate(() => {
    for (const id of ['hud', 'intro', 'pads']) document.getElementById(id).style.visibility = 'hidden';
    const t = document.createElement('div');
    t.innerHTML = '<h1 class="logo" style="font-size:150px">Ragebait</h1><p class="tagline" style="font-size:30px;margin-top:22px">Every level lies. Trust nothing.</p>';
    t.style.cssText = 'position:fixed;left:70px;top:70px;z-index:99;text-align:left';
    document.body.appendChild(t);
  });
  // catch the runner near the top of the jump over the falling floor
  await page.waitForFunction(() => window.__rb.state.t > 1 && window.__rb.state.y < 3.4, { timeout: 8000, polling: 'raf' });
  await page.screenshot({ path: 'public/og.png' });
  console.log('public/og.png');
} finally {
  await browser.close();
  server.closeAllConnections(); server.close();
}
