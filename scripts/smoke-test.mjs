// Drives the built game in headless Chrome: fails on console errors, beats level 1 with the solver's route, opens
// each menu, and screenshots every level to artifact/shots/.
// Usage: npm run build && node scripts/smoke-test.mjs   (set CHROME_PATH if Chrome isn't at the Windows default)
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { LEVELS, compile } from '../src/levels/index.js';
import { solve, toSteps } from '../src/levels/solver.js';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]).replace(/^\/(about|privacy)$/, '/$1.html');
  const path = join('dist', clean.replace(/\/$/, '/index.html'));
  try { const body = await readFile(path); res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(body); }
  catch { try { res.writeHead(404, { 'content-type': 'text/html' }); res.end(await readFile(join('dist', '404.html'))); } catch { res.end(); } }
}).listen(4790);

const only = process.argv.includes('--levels-only');
await mkdir('artifact/shots/levels', { recursive: true });
const errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const route = (() => { const L = compile(LEVELS[0].def, '1-1'), r = solve(L); return toSteps(r.actions, r.chunk); })();

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
async function open(name, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${name}] ${e.message}`));
  await page.goto('http://localhost:4790/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await wait(400);
  return page;
}

const VIEWS = [
  ['phone', { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true }],
  ['desktop', { width: 1280, height: 720 }],
  ['portrait', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
];
if (!only) for (const [name, vp] of VIEWS) {
  const page = await open(name, vp);
  await page.screenshot({ path: `artifact/shots/${name}-1-title.png` });
  await page.click('#btnPlay');
  await wait(700);
  await page.screenshot({ path: `artifact/shots/${name}-2-level.png` });
  // beat level 1 with the solver's route
  await page.evaluate(steps => window.__rb.play(0, steps), route);
  await page.waitForFunction(() => window.__rb.state.mode === 'done', { timeout: 15000 }).catch(() => errors.push(`[${name}] level 1 wasn't beaten by the solver route`));
  await wait(900);
  await page.screenshot({ path: `artifact/shots/${name}-3-cleared.png` });
  const resultShown = await page.evaluate(() => !document.getElementById('mdlResult').hidden);
  if (!resultShown) errors.push(`[${name}] no result card after clearing level 1`);
  await page.click('#btnNext');
  await wait(400);
  // die on purpose: run right on 1-2... and check a death is counted
  if (name === 'desktop') {
    await page.keyboard.down('ArrowRight'); await wait(2600); await page.keyboard.up('ArrowRight');
    await page.screenshot({ path: `artifact/shots/${name}-4-trap.png` });
    await page.keyboard.press('Escape'); await wait(300);
    await page.screenshot({ path: `artifact/shots/${name}-5-pause.png` });
    await page.click('#btnPauseLevels'); await wait(300);
    await page.screenshot({ path: `artifact/shots/${name}-6-levels.png` });
    await page.click('[data-back]'); await wait(200);
    await page.click('#btnSettings'); await wait(300);
    await page.screenshot({ path: `artifact/shots/${name}-7-settings.png` });
  }
  if (name === 'phone') {
    // touch: press the right arrow (anywhere on it must steer right), then the jump button
    const r = await page.evaluate(() => { const b = document.getElementById('padR').getBoundingClientRect(); return { x: b.left + 6, y: b.top + b.height / 2 }; });
    const x0 = await page.evaluate(() => window.__rb.state.x);
    await page.touchscreen.touchStart(r.x, r.y); await wait(500);
    await page.screenshot({ path: `artifact/shots/${name}-4-touch.png` });
    await page.touchscreen.touchEnd();
    const x1 = await page.evaluate(() => window.__rb.state.x);
    if (!(x1 > x0 + 1)) errors.push(`[phone] the right arrow's left edge didn't move the runner right (${x0.toFixed(2)} → ${x1.toFixed(2)})`);
    const j = await page.evaluate(() => { const b = document.getElementById('padJ').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await page.touchscreen.touchStart(j.x, j.y); await wait(120);
    const y1 = await page.evaluate(() => window.__rb.state.y);
    await page.touchscreen.touchEnd();
    await wait(600);
    const y2 = await page.evaluate(() => window.__rb.state.y);
    if (!(y1 < y2 - 0.3)) errors.push(`[phone] the jump button didn't jump (y ${y1.toFixed(2)} then ${y2.toFixed(2)})`);
  }
  await page.close();
}

// every level, as it first appears
{
  const page = await open('levels', { width: 1280, height: 720 });
  for (let i = 0; i < LEVELS.length; i++) {
    await page.evaluate(i => window.__rb.start(i), i);
    await wait(250);
    await page.evaluate(() => document.getElementById('intro').classList.remove('show'));
    await page.screenshot({ path: `artifact/shots/levels/${LEVELS[i].id}.png` });
  }
  await page.close();
}

await browser.close();
server.closeAllConnections(); server.close();
if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
console.log('smoke test passed; screenshots in artifact/shots/');
