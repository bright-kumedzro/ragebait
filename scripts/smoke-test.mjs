// Drives the built game in headless Chrome: fails on console errors, beats level 1 with the solver's route, opens
// each menu, plays a whole challenge between two players (in-memory API), and screenshots every level to
// artifact/shots/.
// Usage: npm run build && node scripts/smoke-test.mjs   (set CHROME_PATH if Chrome isn't at the Windows default)
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { LEVELS, compile } from '../src/levels/index.js';
import { solve, toSteps } from '../src/levels/solver.js';
import { createState, step } from '../src/sim.js';
import { apiMiddleware } from './api-dev.mjs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const serveStatic = async (req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]).replace(/^\/(about|privacy)$/, '/$1.html');
  const path = join('dist', clean.replace(/\/$/, '/index.html'));
  try { const body = await readFile(path); res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(body); }
  catch { try { res.writeHead(404, { 'content-type': 'text/html' }); res.end(await readFile(join('dist', '404.html'))); } catch { res.end(); } }
};
const server = createServer((req, res) => apiMiddleware(req, res, () => serveStatic(req, res))).listen(4790);

const only = process.argv.includes('--levels-only');
await mkdir('artifact/shots/levels', { recursive: true });
const errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const routeFor = id => { const i = LEVELS.findIndex(l => l.id === id), r = solve(compile(LEVELS[i].def, id)); return toSteps(r.actions, r.chunk); };
const route = routeFor('1-1');
// holding right on 1-1 runs into the falling floor: these inputs die exactly once, then the winning route follows
const dieOnce = (() => {
  const i = LEVELS.findIndex(l => l.id === '1-1'), L = compile(LEVELS[i].def, '1-1'), st = createState(L), steps = [];
  while (st.status === 'play' && steps.length < 2000) { const inp = { l: 0, r: 1, j: 0 }; steps.push(inp); step(L, st, inp); }
  return st.status === 'dead' ? steps : null;
})();
if (!dieOnce) errors.push('[setup] holding right on 1-1 should die');

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

// a whole challenge: Ama (who has beaten 1-1 to 1-3) creates it and plays; Kofi opens the link, dies once, loses
{
  const save = (name, cleared) => JSON.stringify({ player: { id: '', name }, levels: Object.fromEntries(cleared.map(id => [id, { cleared: true, best: 0, time: 5, deaths: 0 }])) });
  const ctxA = await browser.createBrowserContext(), ctxB = await browser.createBrowserContext();
  const join = async (ctx, name, saved, url = 'http://localhost:4790/') => {
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
    page.on('pageerror', e => errors.push(`[${name}] ${e.message}`));
    if (saved) await page.evaluateOnNewDocument(v => localStorage.setItem('ragebait.save.v1', v), saved);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    return page;
  };
  const playThrough = async (page, name) => {
    for (let k = 0; k < 3; k++) {
      await page.waitForFunction(() => window.__rb.state.mode === 'done' && !document.getElementById('mdlResult').hidden, { timeout: 20000 })
        .catch(() => errors.push(`[${name}] challenge level ${k + 1} was not finished`));
      if (k === 0) await page.screenshot({ path: `artifact/shots/challenge-${name}-level.png` });
      await page.click('#btnNext');
    }
  };
  const A = await join(ctxA, 'ama', save('Ama', ['1-1', '1-2', '1-3']));
  await A.evaluate(r => window.__rb.routes(r), { '1-1': route, '1-2': routeFor('1-2'), '1-3': routeFor('1-3') });
  await A.click('#btnCompete'); await wait(500);
  await A.screenshot({ path: 'artifact/shots/challenge-1-list.png' });
  await A.click('#btnNewChallenge'); await wait(300);
  const pickable = (await A.$$('#pickList .lvl.pick:not(.locked)')).length;
  if (pickable !== 3) errors.push(`[ama] expected 3 pickable levels, got ${pickable}`);
  // the picker redraws after every tap, so find the next unpicked level each time
  for (let i = 0; i < 3; i++) await A.click('#pickList .lvl.pick:not(.locked):not(.picked)');
  const order = await A.$$eval('#pickList .order', els => els.map(e => e.textContent).join(''));
  if (order !== '123') errors.push(`[ama] picked levels should be numbered 1, 2, 3 (got "${order}")`);
  await A.screenshot({ path: 'artifact/shots/challenge-2-pick.png' });
  await A.click('#btnCreate');
  await A.waitForSelector('#chShare', { timeout: 8000 }).catch(() => errors.push('[ama] no invite screen after creating'));
  await A.screenshot({ path: 'artifact/shots/challenge-3-invite.png' });
  const link = await A.$eval('.ch-link', el => el.textContent).catch(() => '');
  const id = link.split('/c/')[1];
  if (!id) errors.push(`[ama] no challenge link (${link})`);
  await A.click('#chPlay');
  await playThrough(A, 'ama');
  await A.waitForSelector('.board', { timeout: 8000 }).catch(() => errors.push('[ama] no scoreboard after finishing'));

  const preview = await (await fetch(`http://localhost:4790/c/${id}`)).text();
  if (!preview.includes('Ama is trying to ragebait you')) errors.push('[share] the /c/ page has no challenge title');
  const B = await join(ctxB, 'kofi', null, `http://localhost:4790/c/${id}`);
  await B.waitForSelector('#chName', { timeout: 8000 }).catch(() => errors.push('[kofi] the invite did not ask for a name'));
  await B.screenshot({ path: 'artifact/shots/challenge-4-invited.png' });
  await B.type('#chName', 'Kofi');
  await B.evaluate(r => window.__rb.routes(r), { '1-1': [...(dieOnce || []), ...route], '1-2': routeFor('1-2'), '1-3': routeFor('1-3') });
  await B.click('#chPlay');
  await playThrough(B, 'kofi');
  await B.waitForFunction(() => /ragebaited you/.test(document.querySelector('.ch-head')?.textContent || ''), { timeout: 8000 })
    .catch(async () => errors.push(`[kofi] expected "Ama ragebaited you", saw "${await B.$eval('.ch-head', el => el.textContent).catch(() => '?')}"`));
  await B.screenshot({ path: 'artifact/shots/challenge-5-result.png' });
  await A.waitForFunction(() => /You ragebaited Kofi/.test(document.querySelector('.ch-head')?.textContent || ''), { timeout: 15000 })
    .catch(async () => errors.push(`[ama] the live view did not update to "You ragebaited Kofi" (saw "${await A.$eval('.ch-head', el => el.textContent).catch(() => '?')}")`));
  await A.screenshot({ path: 'artifact/shots/challenge-6-won.png' });
  await A.click('#btnChBack'); await wait(600);
  await A.screenshot({ path: 'artifact/shots/challenge-7-record.png' });
  const record = await A.$eval('#cmpRecord', el => el.textContent);
  if (!/1\s*Win/.test(record)) errors.push(`[ama] record should show 1 win: "${record}"`);
  await ctxA.close(); await ctxB.close();
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
