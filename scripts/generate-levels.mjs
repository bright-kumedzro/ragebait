// Builds chapter 21, Lost & Found (10 explore levels), and writes it to src/levels/ch21.js as an ordinary level file
// (ASCII map plus traps), so any level can be hand-edited afterwards. Chapters 1-20 are hand-made.
//
// An explore level is a two-storey map with keys spread across its branches (see buildExplore). Each must pass the
// same proof as the hand-made levels (src/levels/verify.js) and must not be beatable by just holding right; if not,
// it's rebuilt from the next seed. Seeds are fixed, so running this again gives the same levels.
// Usage: node scripts/generate-levels.mjs
import { writeFileSync } from 'node:fs';
import { compile } from '../src/levels/compile.js';
import { verifyLevel, holdRightWins } from '../src/levels/verify.js';

// ---------- a seeded random number generator, so runs are repeatable ----------
function rng32(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), pick: list => list[Math.floor(next() * list.length)], chance: p => next() < p };
}

// ---------- the map being drawn ----------
class Map2 {
  constructor(w, h = H) { this.w = w; this.h = h; this.g = Array.from({ length: h }, () => Array(w).fill('.')); }
  fill(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.g[y][x] = c; }
  put(x, y, c) { this.fill(x, y, x, y, c); }
  text() { return this.g.map(r => '      ' + r.join('')).join('\n'); }
}

// names for groups (solid, can move), hidden cells (spikes, blocks), and marks (named spots)
function allocators() {
  const pools = { g: [...'abcdefghijklmnopqrstuvwxyz'], d: [...'123456789'], m: [...'ABCEGHIJLMNOQRSTUWXYZ'] };
  const take = k => { const c = pools[k].shift(); if (!c) throw new Error(`ran out of ${k}`); return c; };
  return { group: () => take('g'), hidden: () => take('d'), mark: () => take('m') };
}

const SAY = {
  fall: ['Gravity works.', 'Floor’s gone.', 'Oops.', 'Mind the gap.'],
  spikes: ['Surprise.', 'Pointy.', 'Saw that coming?', 'Hello.'],
  door: ['Not today.', 'Catch me.', 'Bye!', 'Nope.'],
  mirror: ['Mirror time.', 'Wait, what?'], rotate: ['Upside down.', 'Australia mode.'], swap: ['Which one is the floor?', 'Wait.'],
  lag: ['Ping: 999 ms', 'Buffering…'], dark: ['Lights out.', 'Who turned off the lights?'], reverse: ['Left is right.', 'lol'],
  speed: ['Zoom.', 'Too fast?'], flip: ['Up you go.', 'Gravity’s off.'],
};

// ---------- segments ----------
// makeSegs(F, BOT) gives the segments for a floor whose top row is F and whose slab ends at row BOT (a gap there
// is a pit to the bottom of the map, or, on an upper floor, a hole down to the floor below).
// Each takes (r, a, x) and returns { w, draw(m), traps: [...], flags }. x is the segment's first column; the runner
// arrives from the left on the floor. Traps use group/hidden/mark names from `a`.
function makeSegs(F, BOT) {
  return {
  gap: r => { const w = r.int(2, 3); return { w, draw: (m, x) => m.fill(x, F, x + w - 1, BOT, '.'), traps: () => [] }; },
  spikes: r => { const w = r.int(1, 2); return { w, draw: (m, x) => m.fill(x, F - 1, x + w - 1, F - 1, '^'), traps: () => [] }; },
  bump: r => { const w = r.int(1, 2), h = r.int(1, 2); return { w, solidAbove: true, draw: (m, x) => m.fill(x, F - h, x + w - 1, F - 1, '#'), traps: () => [] }; },
  collapse: (r, a) => {
    const w = r.int(2, 3), g = a.group(), byStand = r.chance(0.4);
    return { w, draw: (m, x) => m.fill(x, F, x + w - 1, BOT, g),
      traps: x => [byStand ? { when: { stand: g }, do: 'fall', g, shake: 0.2 } : { when: { x: x - 2 }, do: 'fall', g, ...say(r, 'fall') }] };
  },
  popspikes: (r, a) => {
    const w = r.int(1, 2), d = a.hidden(), lead = r.int(2, 4);
    return { w, draw: (m, x) => m.fill(x, F - 1, x + w - 1, F - 1, d), traps: x => [{ when: { x: x - lead }, do: 'spikes', g: d, ...say(r, 'spikes') }] };
  },
  invisspikes: (r, a) => {
    const d = a.hidden();
    return { w: 1, draw: (m, x) => m.put(x, F - 1, d), traps: () => [{ when: { t: 0 }, do: 'spikes', g: d, invisible: true }] };
  },
  cannon: (r, a) => {
    const k = a.mark(), every = r.int(14, 18) / 10, t = r.int(2, 10) / 10;
    return { w: 4, draw: (m, x) => m.put(x + 3, F - 5, k), traps: () => [{ when: { t }, do: 'balls', from: k, v: [-5, -2], bounce: 0.85, n: 1, every }] };
  },
  crusher: (r, a) => {
    const g = a.group(), t = r.int(0, 10) / 10;
    return { w: 2, overhead: true, draw: (m, x) => m.fill(x, F - 5, x + 1, F - 4, g),
      traps: () => [{ when: { t }, do: 'move', g, by: [0, 3], speed: 9, back: true, loop: true, hold: 0.55, spikes: 'd', slam: true }] };
  },
  stones: (r, a) => {
    const d = a.hidden();
    return { w: 7, draw: (m, x) => { m.fill(x, F, x + 6, BOT, '.'); m.fill(x + 3, F, x + 4, F, d); },
      traps: x => [{ when: { x: x - 4, jump: true }, do: 'show', g: d }] };
  },
  crumble: (r, a) => {
    const g1 = a.group(), g2 = a.group();
    return { w: 8, draw: (m, x) => { m.fill(x, F, x + 7, BOT, '.'); m.put(x + 2, F, g1); m.put(x + 5, F - 1, g2); },
      traps: () => [{ when: { stand: g1 }, do: 'fall', g: g1, shake: 0.25 }, { when: { stand: g2 }, do: 'fall', g: g2, shake: 0.25 }] };
  },
  ferry: (r, a, ch) => {
    const g = a.group(), sink = ch >= 15 && r.chance(0.6);
    return { w: 9, waits: true, draw: (m, x) => { m.fill(x, F, x + 8, BOT, '.'); m.fill(x, F, x + 2, F, g); },
      traps: () => [{ when: { stand: g }, do: 'move', g, by: [5, 0], speed: 4.5 },
        ...(sink ? [{ when: { stand: g }, delay: 1.3, do: 'fall', g, shake: 0.25, say: 'Last stop.' }] : [])] };
  },
  pillar: (r, a) => {
    const g = a.group();
    return { w: 2, solidAbove: true, waits: true, draw: (m, x) => m.fill(x, F, x + 1, BOT, g),
      traps: x => [{ when: { x: x - 3 }, do: 'move', g, by: [0, -4], speed: 3, back: true, hold: 1.4 }] };
  },
  bonk: (r, a) => {
    const d = a.hidden();
    return { w: 3, draw: (m, x) => { m.fill(x + 1, F - 1, x + 2, F - 1, '^'); m.put(x, F - 2, d); },
      traps: () => [{ when: { bonk: d }, do: 'say', say: 'Bonk.' }] };
  },
  fakedoor: () => ({ w: 1, draw: (m, x) => m.put(x, F - 1, 'F'), traps: () => [] }),
  invisbridge: (r, a) => {
    const g1 = a.group(), g2 = a.group();
    return { w: 7, draw: (m, x) => { m.fill(x, F, x + 6, BOT, '.'); m.fill(x, F, x + 2, F, g1); m.fill(x + 5, F, x + 6, F, g2); },
      traps: () => [{ when: { touch: g1 }, do: 'reveal', g: g1 }, { when: { touch: g2 }, do: 'reveal', g: g2 }] };
  },
  deadbridge: (r, a) => {
    const d = a.hidden();
    return { w: 14, corpses: x => [[x + 4, F - 1], [x + 9, F - 1]],
      draw: (m, x) => { m.fill(x, F, x + 13, BOT, '.'); m.put(x + 4, F, d); m.put(x + 9, F, d); },
      traps: () => [{ when: { t: 0 }, do: 'spikes', g: d }] };
  },
  learns: (r, a) => {
    const g = a.group(), d = a.hidden();
    return { w: 6, once: 'learns', draw: (m, x) => { m.fill(x, F, x + 2, BOT, g); m.fill(x + 3, F - 1, x + 5, F - 1, d); },
      traps: x => [{ when: { x: x - 2, tries: 'odd' }, do: 'fall', g },
        { when: { jump: true, zone: [x - 3, 0, x + 1, BOT], tries: 'even' }, do: 'spikes', g: d, say: 'I learn.' }] };
  },
  checkpoint: () => ({ w: 1, draw: (m, x) => m.put(x, F - 1, 'K'), traps: x => [{ when: { x }, do: 'checkpoint' }] }),
  crash: r => ({ w: 1, once: 'crash', draw: () => {}, traps: x => [{ when: { x }, do: 'crash', seconds: r.int(25, 35) / 10 },
    { when: { ui: 'reload' }, do: 'kill', cause: 'trap', say: 'Did you just try to reload?' }] }),
  };
}
const say = (r, kind) => (r.chance(0.35) ? { say: r.pick(SAY[kind]) } : {});

// ---------- chapters ----------
// pool: segment kinds and how often they come up; zones: zone kinds that can wrap segments, and how likely; twists:
// level-wide tricks and the chance a level gets one.
const CH = {
  // chapter 21, Lost & Found: every level is an explore level built around one key trick (see SHOWCASE)
  21: { pool: { spikes: 2, popspikes: 2, collapse: 2, bump: 1 },
    names: ['Keys, please', 'Run, key, run', 'Not that one', 'Down under', 'Lights out, keys in', 'Collector’s edition', 'Backtrack', 'Haunted house', 'Topsy-turvy house', 'Lost & Found'] },
};

const HINTS = [
  'Easy one.', 'Nothing new here.', 'Just walk.', 'Trust the floor.', 'Straight to the door.', 'You’ve done this before.',
  'Relax.', 'No tricks this time.', 'Promise.', 'Short and sweet.', 'Totally normal level.', 'The door is real. Probably.',
  'Go on, it’s fine.', 'What could go wrong?', 'Keep it simple.', 'Take your time.', 'Stay calm.', 'Breathe.',
  'It’s a warm-up.', 'Free level.', 'Nothing to worry about.', 'Clear path ahead.', 'Just one jump.', 'Don’t overthink it.',
  'Easy money.', 'A walk in the park.', 'Nothing moves here.', 'Just believe.', 'I’d never lie to you.', 'Same as last time.',
  'Trust me on this one.', 'Practice round.', 'This one’s on the house.', 'Child’s play.', 'You’ve got this.',
  'Easier than it looks.', 'Zero traps. Probably.', 'Smooth sailing.', 'Look how calm it is.', 'Honest.',
];
const BOSS_HINTS = ['Everything at once.', 'Last one in this chapter. Probably.', 'The big one.', 'Final boss energy.', 'You’ll love this one.'];

// ---------- explore levels ----------
// Two storeys: a tower to climb on the left, a corridor of traps to the right, and a basement you drop into through
// one hole and climb out of through another. Keys are spread across the branches, and the door is locked until
// you have them all, so the level is a trip out and back rather than a run to the right.
const EH = 20, U = 10, LF = 18; // explore map height; the upper floor's top row; the basement floor's top row
const UP = makeSegs(U, U + 1), DOWN = makeSegs(LF, EH - 1);
// (no cannons, looping crushers or ghosts: anything on a timer makes a long out-and-back route far too slow to prove)
const FLAT = ['spikes', 'popspikes', 'collapse', 'bump', 'invisspikes', 'fakedoor', 'bonk'];

function buildExplore(n, i, seed, opts = {}) {
  const r = rng32(seed), a = allocators(), W = opts.w || r.int(50, 58);
  const extras = opts.extras || [];
  const m = new Map2(W, EH);
  m.fill(0, U, W - 1, U + 1, '#');
  m.fill(0, LF, W - 1, EH - 1, '#');
  const traps = [], def = { name: '', hint: '', map: '', traps };
  const notes = [];

  // the tower: three steps and a ledge
  const tx = r.int(3, 5);
  const plat = (x0, x1, y) => (extras.includes('crumbletower') && y === 6 ? (() => { const g = a.group(); m.fill(x0, y, x1, y, g); traps.push({ when: { stand: g }, do: 'fall', g, shake: 0.3 }); })() : m.fill(x0, y, x1, y, '#'));
  plat(tx, tx + 2, 8); plat(tx + 5, tx + 7, 6); plat(tx, tx + 2, 4); m.fill(tx + 4, 2, tx + 9, 2, '#');

  // the start, the hole down, and the way back up
  const sx = r.int(Math.floor(W / 2) - 2, Math.floor(W / 2) + 3);
  const dh = r.int(tx + 12, sx - 4);
  m.fill(dh, U, dh + 1, U + 1, '.');
  const ch = r.int(sx + 6, W - 15);
  m.fill(ch, U, ch + 3, U + 1, '.');
  m.fill(ch - 3, 16, ch - 2, 17, '#'); m.fill(ch, 14, ch + 1, 14, '#'); m.fill(ch + 2, 12, ch + 3, 12, '#');

  // traps along the upper corridor (either side of the way up) and in the basement
  const pool = Object.keys(CH[n]?.pool || {}).filter(k => FLAT.includes(k));
  const kinds = pool.length ? pool : ['spikes', 'popspikes', 'collapse'];
  const place = (segs, k, x0, x1) => {
    const seg = segs[k](r, a, n);
    if (seg.w + 4 > x1 - x0) return false;
    const x = r.int(x0 + 2, x1 - seg.w - 2);
    seg.draw(m, x); traps.push(...seg.traps(x)); notes.push(k);
    return true;
  };
  const upperSpans = [[sx + 2, ch - 4], [ch + 5, W - 5]];
  for (const [x0, x1] of upperSpans) if (r.chance(0.85)) place(UP, r.pick(kinds), x0, x1);
  const baseKinds = extras.includes('invisible') ? ['invisspikes', 'invisbridge', ...kinds] : [...kinds, 'gap'];
  const baseLeft = r.chance(0.5); // which end of the basement the key is at
  if (baseLeft) place(DOWN, r.pick(baseKinds), 4, dh - 2);
  else place(DOWN, r.pick(baseKinds), ch + 5, W - 4);

  // keys and the door
  const spots = { top: [tx + 8, 1], right: [W - 3, U - 1], base: baseLeft ? [2, LF - 1] : [W - 3, LF - 1] };
  const doorAt = opts.door || r.pick(['ledge', 'start', 'start', 'basement']);
  let keySpots = doorAt === 'ledge' ? ['right', 'base'] : r.chance(i >= 5 || n >= 14 ? 0.75 : 0.3) ? ['top', 'right', 'base'] : r.chance(0.5) ? ['top', 'right'] : ['top', 'base'];
  if (opts.keys) keySpots = opts.keys;
  for (const k of keySpots) m.put(...spots[k], '*');
  const doorSpot = doorAt === 'ledge' ? [tx + 6, 1] : doorAt === 'start' ? [sx - 2, U - 1] : [Math.round((dh + ch) / 2), LF - 1];
  m.put(...doorSpot, 'D');
  m.put(sx, U - 1, 'P');
  notes.unshift(`keys: ${keySpots.join(', ')}; door: ${doorAt}`);

  // the chapter's twist on exploring; extras go on the nearest empty bit of floor, never over a trap
  const keyCount = keySpots.length;
  const putFree = (x, y, c) => {
    for (const dx of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
      const cx = x + dx;
      if (m.g[y]?.[cx] === '.' && m.g[y + 1]?.[cx] === '#') { m.put(cx, y, c); return; }
    }
    throw new Error('no room for an extra');
  };
  if (extras.includes('surprise')) { const d = a.hidden(); putFree(sx + 1, U - 1, d); traps.push({ when: { keys: 1 }, do: 'spikes', g: d, say: 'Surprise.' }); }
  if (extras.includes('dark')) traps.push({ when: { t: 0 }, do: 'dark', radius: 4.4 });
  if (extras.includes('dim')) traps.push({ when: { t: 0 }, do: 'dark', radius: 5.5 });
  if (extras.includes('ghost')) def.ghost = 1.5;
  if (extras.includes('corpses')) def.corpses = true;
  if (extras.includes('speed')) traps.push({ when: { t: 0.5 }, do: 'speed', factor: 1.4, say: 'Zoom.' });
  if (extras.includes('mirrorkeys')) { traps.push({ when: { keys: 1 }, do: 'mirror', say: 'Mirror time.' }); if (keyCount > 2) traps.push({ when: { keys: 2 }, do: 'rotate', say: 'Upside down.' }); }
  if (extras.includes('lagkeys')) { traps.push({ when: { keys: 1 }, do: 'lag', seconds: 0.15, say: 'Ping: 999 ms' }); traps.push({ when: { keys: keyCount }, do: 'swap', say: 'Wait.' }); }
  if (extras.includes('reversekeys')) { traps.push({ when: { keys: 1 }, do: 'reverse', say: 'Left is right.' }); if (keyCount > 2) traps.push({ when: { keys: 2 }, do: 'reverse', say: 'Changed my mind.' }); }
  if (extras.includes('fakekey')) { putFree(sx + 4, U - 1, '&'); notes.push('fake key'); }
  if (extras.includes('runaway') && keySpots.includes('right')) {
    const k = keySpots.indexOf('right'), q = a.mark();
    m.put(baseLeft ? W - 3 : 2, LF - 1, q);
    traps.push({ when: { zone: [W - 6, U - 3, W - 1, U - 1] }, do: 'keymove', k, to: q, speed: 10, say: 'Catch me.' });
    notes.push('runaway key');
  }
  if (extras.includes('doorrun') && doorAt !== 'start') {
    const q = a.mark();
    m.put(sx - 3, U - 1, q);
    traps.push({ when: { keys: keyCount, near: 2.5 }, do: 'door', to: q, say: 'Back where you started.' });
    notes.push('door runs home');
  }
  def.map = m.text();
  def.about = `explore; ${notes.join(', ')}${extras.length ? `; ${extras.join(', ')}` : ''}`;
  return def;
}

// ---------- writing level files ----------
function lit(v) {
  if (Array.isArray(v)) return `[${v.map(lit).join(', ')}]`;
  if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${lit(x)}`).join(', ')} }`;
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return String(v);
}

function levelSource(def) {
  const lines = [`  {`, `    name: ${lit(def.name)},`, `    hint: ${lit(def.hint)},`];
  for (const k of ['fakeWin', 'ghost', 'corpses', 'button', 'check']) if (def[k] !== undefined) lines.push(`    ${k}: ${lit(def[k])},`);
  lines.push(`    // ${def.about}`, `    map: \``, def.map + '`,');
  lines.push(def.traps.length ? `    traps: [\n${def.traps.map(t => `      ${lit(t)},`).join('\n')}\n    ],` : '    traps: [],');
  lines.push('  },');
  return lines.join('\n');
}

const SHOWCASE = [
  { keys: ['top', 'right'], door: 'start', extras: [] },
  { keys: ['right', 'base'], door: 'start', extras: ['runaway'] },
  { keys: ['top', 'right'], door: 'basement', extras: ['fakekey'] },
  { keys: ['base'], door: 'ledge', extras: ['surprise'] },
  { keys: ['top', 'right', 'base'], door: 'start', extras: ['dark'] },
  { keys: ['top', 'right', 'base'], door: 'start', extras: ['surprise', 'mirrorkeys'] },
  { keys: ['right', 'base'], door: 'ledge', extras: ['doorrun', 'surprise'] },
  { keys: ['top', 'right', 'base'], door: 'start', extras: ['dim', 'fakekey'] },
  { keys: ['top', 'right', 'base'], door: 'basement', extras: ['mirrorkeys', 'reversekeys'] },
  { keys: ['top', 'right', 'base'], door: 'ledge', extras: ['runaway', 'fakekey', 'surprise'], w: 58 },
];
export { buildExplore };
const t0 = performance.now();
if (!process.env.RB_NO_GEN) for (const n of Object.keys(CH).map(Number)) {
  const spec = CH[n], r = rng32(n * 7919), hints = [...HINTS].sort(() => r.next() - 0.5);
  const out = [], file = `src/levels/ch${n}.js`;
  for (let i = 0; i < 10; i++) {
    let def = null, tries = 0, why = '';
    for (let shrink = 0; shrink <= 2 && !def; shrink++) {
      for (let k = 0; k < 25 && !def; k++) {
        tries++;
        let d;
        const seed = n * 100003 + i * 1009 + k * 31 + shrink * 7;
        let L;
        try {
          d = buildExplore(n, i, seed, SHOWCASE[i]);
          L = compile(d, `${n}-${i + 1}`);
        } catch (e) { why = e.message; continue; }
        if (holdRightWins(L, d)) { why = 'beatable by holding right'; continue; }
        const v = verifyLevel(L, d, { maxNodes: 200000 });
        if (!v.ok) { why = v.reason; continue; }
        def = d;
      }
    }
    if (!def) throw new Error(`chapter ${n} level ${i + 1}: no good layout after ${tries} tries (last: ${why})`);
    def.name = spec.names[i];
    def.hint = i === 9 ? r.pick(BOSS_HINTS) : hints[i];
    out.push(levelSource(def));
    process.stdout.write(`${n}-${i + 1} ${def.name} (${tries} ${tries === 1 ? 'try' : 'tries'}): ${def.about}\n`);
  }
  const src = `// Chapter ${n}: generated by scripts/generate-levels.mjs (explore levels built around keys). Edit freely, then\n`
    + `// run \`npm run check\`; re-running the generator overwrites this file.\nexport default [\n${out.join('\n')}\n];\n`;
  writeFileSync(file, src);
}
console.log(`done in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
