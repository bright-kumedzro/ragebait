// Builds chapters 6-20 (150 levels) by remixing the game's traps, and writes them to src/levels/ch6.js … ch20.js
// as ordinary level files (ASCII map plus traps), so any of them can be hand-edited afterwards.
//
// A level is a run of segments (a falling floor, popping spikes, a crusher, an invisible bridge, a mirror zone…)
// laid out left to right on one floor, picked from the chapter's own mix, plus sometimes a level-wide twist (a spike
// wall chasing you, auto-run, a ghost of your last try, a fake win, a "Don't press" button). Each level must pass
// the same proof as the hand-made ones (src/levels/verify.js), and must not be beatable by just holding right; if
// not, it's rebuilt from the next seed. Seeds are fixed, so running this again gives the same levels.
// Usage: node scripts/generate-levels.mjs [chapter numbers…] [--keep-linear]   (default: all of 6-21)
// --keep-linear keeps a chapter file's existing linear levels exactly as they are and only rebuilds its explore levels.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { compile } from '../src/levels/compile.js';
import { verifyLevel, holdRightWins } from '../src/levels/verify.js';

const H = 10, F = 6; // level height, and the floor's top row (the runner stands in row 5)

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
const SEG = makeSegs(F, H - 1);

// Zones switch something on before the segments they wrap and off after them.
const ZONE = {
  mirror: { on: { do: 'mirror' }, off: { do: 'mirror' } },
  rotate: { on: { do: 'rotate' }, off: { do: 'rotate' } },
  swap: { on: { do: 'swap' }, off: { do: 'swap' } },
  lag: { on: { do: 'lag', seconds: 0.2 }, off: { do: 'lag', seconds: 0 } },
  dark: { on: { do: 'dark', radius: 3.4 }, off: { do: 'dark', radius: 0 } },
  reverse: { on: { do: 'reverse' }, off: { do: 'reverse' } },
  speed: { on: { do: 'speed', factor: 1.7 }, off: { do: 'speed', factor: 1 } },
};
// Flip is its own segment: a spike field you can only cross on the ceiling (the level gets a ceiling).
function flipSeg(r) {
  const L = r.int(6, 9), roof = L >= 7 && r.chance(0.6);
  return { w: L + 2, ceiling: true,
    draw: (m, x) => { m.fill(x + 1, F - 1, x + L, F - 1, '^'); if (roof) m.fill(x + 3, 1, x + 4, 1, 'V'); },
    traps: x => [{ when: { x }, do: 'flip', ...say(r, 'flip') }, { when: { x: x + L + 1 }, do: 'flip' }] };
}

const say = (r, kind) => (r.chance(0.35) ? { say: r.pick(SAY[kind]) } : {});

// ---------- chapters ----------
// pool: segment kinds and how often they come up; zones: zone kinds that can wrap segments, and how likely; twists:
// level-wide tricks and the chance a level gets one.
const ALL = { gap: 2, spikes: 2, bump: 1, collapse: 2, popspikes: 2, cannon: 1, crusher: 1, stones: 1, crumble: 1, ferry: 1, pillar: 1, bonk: 1, fakedoor: 1, invisbridge: 1, invisspikes: 1, learns: 1, checkpoint: 1, crash: 1, flip: 1 };
const CH = {
  6: { pool: { gap: 3, collapse: 3, popspikes: 3, spikes: 2, bump: 2, cannon: 1 }, twists: { doorrun: 0.3 },
    names: ['Seen it before', 'Same floor, new lies', 'Rerun', 'Familiar territory', 'Again, again', 'Muscle memory', 'Copy paste', 'Sequel', 'Remastered', 'Director’s cut'] },
  7: { sig: { segs: ['crusher'], zones: ['dark'] }, pool: { crusher: 3, popspikes: 2, gap: 2, crumble: 1, spikes: 2 }, zones: { dark: 0.6 },
    names: ['Graveyard shift', 'Night light', 'Lights off, crushers on', 'Overtime', 'Clocking in', 'Insomnia', '3 a.m.', 'Power cut', 'Blackout', 'Last shift'] },
  8: { sig: { segs: ['flip'], zones: ['mirror', 'rotate'] }, pool: { flip: 2, gap: 2, spikes: 2, bump: 1, collapse: 2 }, zones: { mirror: 0.4, rotate: 0.35 },
    names: ['Topsy', 'Turvy', 'Head over heels', 'Ceiling fan', 'Gravity’s day off', 'Looking glass', 'Handstand', 'Flip side', 'Down is up', 'Upside Downtown'] },
  9: { sig: { segs: ['invisbridge', 'invisspikes', 'stones'] }, pool: { invisbridge: 3, invisspikes: 2, stones: 2, popspikes: 2, gap: 1 },
    names: ['See-through', 'Clear as day', 'Window shopping', 'Thin ice', 'Ghost bridge', 'Now you see it', 'Faith-based', 'Invisible ink', 'Glass half empty', 'Hall of glass'] },
  10: { sig: { zones: ['speed'], twists: ['chaser', 'auto'] }, pool: { gap: 3, spikes: 2, popspikes: 2, collapse: 2 }, zones: { speed: 0.4 }, twists: { chaser: 0.5, auto: 0.35 },
    names: ['Late for work', 'Express lane', 'No brakes', 'Tailgater', 'Green light', 'Speed bump', 'Overtake', 'Fast lane', 'Road rage', 'Rush hour (again)'] },
  11: { sig: { segs: ['crumble', 'stones', 'ferry'] }, pool: { crumble: 3, stones: 2, ferry: 2, collapse: 2, gap: 1 },
    names: ['Lean back', 'Catch me', 'Leap year', 'Island hopping', 'The ferryman', 'Don’t look down', 'Brittle', 'Crumbs', 'Free fall', 'Trust fall'] },
  12: { sig: { segs: ['crash'], zones: ['lag', 'swap'] }, pool: { spikes: 2, gap: 2, bump: 1, popspikes: 2, crash: 1 }, zones: { lag: 0.5, swap: 0.45 },
    names: ['Buffering', 'Bad signal', 'Frame drop', 'Packet loss', 'Colour bleed', 'Reboot', 'Blue screen', 'Floor not found', 'Lag spike', 'Total static'] },
  13: { pool: { popspikes: 3, gap: 2, bump: 1, spikes: 2, collapse: 2 }, zones: { dark: 0.4 }, twists: { ghost: 0.9 },
    names: ['Boo', 'Echo', 'Footsteps', 'Shadow', 'Who’s there?', 'Haunted hallway', 'Poltergeist', 'Afterimage', 'Second you', 'The haunting'] },
  14: { pool: { spikes: 2, gap: 2, collapse: 2, popspikes: 2 }, must: 'deadbridge',
    names: ['Spare parts', 'Body double', 'Stand on me', 'Pile-up', 'Human bridge', 'Sacrifice', 'Stack of you', 'Grave mistake', 'RIP', 'Body count'] },
  15: { sig: { segs: ['pillar', 'ferry', 'crusher'] }, pool: { pillar: 3, ferry: 3, crusher: 2, cannon: 1, gap: 1 },
    names: ['Going down', 'Doors opening', 'Mind the doors', 'Basement level', 'Lift off', 'Ding', 'Out of order', 'Stuck between floors', 'Elevator pitch', 'Elevator music'] },
  16: { sig: { segs: ['fakedoor', 'checkpoint', 'learns'], twists: ['fakewin', 'doorrun'] }, pool: { fakedoor: 3, checkpoint: 2, learns: 2, popspikes: 2, gap: 1, collapse: 1 }, twists: { fakewin: 0.35, doorrun: 0.35 },
    names: ['That never happened', 'You’re imagining it', 'Totally a door', 'Saved. Probably.', 'Trust your memory', 'It was always like this', 'Didn’t move', 'Are you sure?', 'You did this', 'Gaslight'] },
  17: { sig: { zones: ['reverse', 'mirror', 'lag'] }, pool: { spikes: 3, gap: 2, bump: 1, collapse: 2, popspikes: 1 }, zones: { reverse: 0.45, mirror: 0.35, lag: 0.3 },
    names: ['Left right left', 'Wrong way', 'Brain lag', 'Backwards day', 'Mirror mind', 'Cross-wired', 'Reverse psychology', 'Mixed up', 'Short circuit', 'Brain freeze'] },
  18: { sig: { segs: ['cannon'] }, pool: { cannon: 5, bump: 2, gap: 2, spikes: 1 },
    names: ['Dodgeball', 'Bowling alley', 'Hailstorm', 'Pinball', 'Bouncy', 'Incoming!', 'Cannon fodder', 'Your court', 'Hot potato', 'Ball pit'] },
  19: { pool: ALL, zones: { mirror: 0.15, swap: 0.15, dark: 0.15, lag: 0.15, reverse: 0.15 }, twists: { ghost: 0.15, chaser: 0.15, fakewin: 0.1 },
    names: ['Pop quiz', 'Show your work', 'Multiple choice', 'Trick question', 'Open book', 'Cheat sheet', 'Extra credit', 'Retake', 'Detention', 'Final exam'] },
  // chapter 21, Lost & Found: every level is an explore level built around one key trick (see SHOWCASE)
  21: { pool: { spikes: 2, popspikes: 2, collapse: 2, bump: 1 },
    names: ['Keys, please', 'Run, key, run', 'Not that one', 'Down under', 'Lights out, keys in', 'Collector’s edition', 'Backtrack', 'Haunted house', 'Topsy-turvy house', 'Lost & Found'] },
  20: { pool: ALL, zones: { mirror: 0.2, swap: 0.2, dark: 0.2, lag: 0.2, reverse: 0.2, rotate: 0.15 }, twists: { ghost: 0.2, chaser: 0.15, fakewin: 0.25, button: 0.25 },
    names: ['Almost there', 'The penultimate', 'Credits roll?', 'Post-credits', 'One more', 'Last lap', 'Epilogue', 'The end (not)', 'Seriously, the end', 'The actual end'] },
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

// segments that need room above the floor, or the runner to stop and wait, don't mix with the chasing wall or auto-run
const NO_CHASE = new Set(['bump', 'pillar', 'crusher', 'ferry', 'flip', 'bonk', 'cannon']);
const NO_AUTO = new Set(['ferry', 'pillar', 'crusher', 'stones', 'crumble', 'invisbridge', 'learns', 'flip', 'bonk', 'cannon', 'deadbridge']);

function weighted(r, pool, banned) {
  const items = Object.entries(pool).filter(([k]) => !banned.has(k));
  const total = items.reduce((n, [, w]) => n + w, 0);
  let x = r.next() * total;
  for (const [k, w] of items) { x -= w; if (x < 0) return k; }
  return items[items.length - 1][0];
}

function buildLevel(n, i, seed, shrink = 0) {
  const spec = CH[n], r = rng32(seed), a = allocators(), boss = i === 9;
  // level-wide twist
  const twists = Object.entries(spec.twists || {}).filter(([, p]) => r.chance(boss ? Math.min(1, p * 1.5) : p)).map(([k]) => k);
  const twist = twists.length ? r.pick(twists) : null;
  const banned = new Set(twist === 'chaser' ? NO_CHASE : twist === 'auto' ? NO_AUTO : []);
  const count = Math.max(2, (boss ? 6 : 2 + Math.floor(i / 3) + (n >= 13 ? 1 : 0)) - shrink);

  // pick the segments, and zones that wrap some of them
  const kinds = [];
  if (spec.must) kinds.push(spec.must);
  while (kinds.length < count) {
    const k = weighted(r, spec.pool, banned);
    if (k === kinds[kinds.length - 1] && r.chance(0.7)) continue; // not the same thing twice in a row, mostly
    if ((k === 'learns' || k === 'crash') && kinds.includes(k)) continue; // once per level
    kinds.push(k);
  }
  if (spec.must) { const k = kinds.shift(); kinds.splice(r.int(0, kinds.length), 0, k); } // put it somewhere
  const zonePicks = [];
  for (const [z, p] of Object.entries(spec.zones || {})) {
    if (twist === 'auto' && z === 'reverse') continue;
    if (r.chance(boss ? Math.min(1, p * 1.4) : p)) zonePicks.push(z);
  }
  // every level shows off its chapter: if nothing so far is one of the chapter's signature tricks, add one
  const sig = spec.sig;
  if (sig && !kinds.some(k => sig.segs?.includes(k)) && !zonePicks.some(z => sig.zones?.includes(z)) && !sig.twists?.includes(twist)) {
    const segOk = (sig.segs || []).filter(k => !banned.has(k));
    if (sig.zones?.length && (!segOk.length || r.chance(0.5))) zonePicks.push(r.pick(sig.zones));
    else if (segOk.length) kinds[r.int(0, kinds.length - 1)] = r.pick(segOk);
  }
  const segs = kinds.map(k => ({ kind: k, ...(k === 'flip' ? flipSeg(r) : SEG[k](r, a, n)) }));
  const zones = [];
  for (const z of zonePicks) {
    for (let tries = 0; tries < 6; tries++) { // a free stretch of segments to wrap (zones don't overlap)
      const from = r.int(0, segs.length - 1), to = Math.min(segs.length - 1, from + r.int(0, 1));
      if (zones.some(q => !(to < q.from || from > q.to))) continue;
      zones.push({ z, from, to });
      break;
    }
  }

  // lay it out: a run-up, then each segment with flat ground before it
  let x = 5;
  const placed = [];
  segs.forEach((s, k) => {
    const zoneStart = zones.find(q => q.from === k);
    x += r.int(3, 4) + (zoneStart ? 2 : 0);
    placed.push({ ...s, x });
    x += s.w;
    if (zones.find(q => q.to === k)) x += 2;
  });
  const button = twist === 'button';
  const W = Math.max(32, x + (button ? 9 : 5));
  const ceiling = segs.some(s => s.ceiling);
  const m = new Map2(W);
  m.fill(0, F, W - 1, H - 1, '#');
  if (ceiling) m.fill(0, 0, W - 1, 0, '#');
  for (const s of placed) s.draw(m, s.x);
  const traps = [];
  for (const s of placed) traps.push(...s.traps(s.x));
  for (const q of zones) {
    const z = ZONE[q.z], x0 = placed[q.from].x - 2, x1 = placed[q.to].x + placed[q.to].w + 1;
    traps.push({ when: { x: x0 }, ...z.on, ...say(r, q.z) }, { when: { x: x1 }, ...z.off });
  }
  const def = { name: '', hint: '', map: '', traps };
  const corpses = placed.flatMap(s => (s.corpses ? s.corpses(s.x) : []));
  if (corpses.length) { def.corpses = true; def.check = { ...(def.check || {}), corpses }; }

  m.put(1, F - 1, 'P');
  m.put(W - 3, F - 1, 'D');
  if (twist === 'doorrun') { const q = a.mark(); m.put(3, F - 1, q); traps.push({ when: { near: 2.5 }, do: 'door', to: q, ...say(r, 'door') }); }
  if (twist === 'chaser') { const g = a.group(); m.fill(0, ceiling ? 1 : 0, 0, F - 1, g); traps.push({ when: { t: 0.8 }, do: 'move', g, by: [W - 7, 0], speed: r.int(36, 42) / 10, spikes: 'r', say: 'Run.' }); }
  if (twist === 'auto') traps.push({ when: { t: 0.6 }, do: 'auto', dir: 1, say: 'Can’t stop.' });
  if (twist === 'ghost') { def.ghost = 1.2; traps.push({ when: { t: 0.2, tries: [2] }, do: 'say', say: 'Is that… you?' }); }
  if (twist === 'fakewin') def.fakeWin = 1;
  if (button) {
    const g = a.group();
    m.fill(W - 6, 0, W - 5, F - 1, g);
    traps.push({ when: { ui: 'button' }, do: 'vanish', g, say: 'You never listen. Good.' });
    def.button = 'Don’t press';
    def.check = { ...(def.check || {}), ui: ['button'] };
  }
  def.map = m.text();
  def.about = [twist && `twist: ${twist}`, kinds.join(', '), zones.length && `zones: ${zones.map(q => q.z).join(', ')}`].filter(Boolean).join('; ');
  return def;
}


// ---------- explore levels ----------
// Two storeys: a tower to climb on the left, a corridor of traps to the right, and a basement you drop into through
// one hole and climb out of through another. Keys are spread across the branches, and the door is locked until
// you have them all, so the level is a trip out and back rather than a run to the right.
const EH = 20, U = 10, LF = 18; // explore map height; the upper floor's top row; the basement floor's top row
const UP = makeSegs(U, U + 1), DOWN = makeSegs(LF, EH - 1);
// (no cannons, looping crushers or ghosts: anything on a timer makes a long out-and-back route far too slow to prove)
const FLAT = ['spikes', 'popspikes', 'collapse', 'bump', 'invisspikes', 'fakedoor', 'bonk'];

// What each chapter adds to its explore levels.
const EXTRA = {
  6: ['surprise'], 7: ['dark'], 8: ['mirrorkeys'], 9: ['invisible'], 10: ['speed'], 11: ['crumbletower'],
  12: ['lagkeys'], 13: ['dim', 'surprise'], 14: ['corpses', 'surprise'], 15: ['crumbletower', 'runaway'], 16: ['fakekey', 'doorrun'],
  17: ['reversekeys'], 18: ['surprise', 'runaway'], 19: ['runaway', 'surprise', 'fakekey'], 20: ['runaway', 'fakekey', 'mirrorkeys', 'doorrun'],
  21: [],
};

function buildExplore(n, i, seed, opts = {}) {
  const r = rng32(seed), a = allocators(), W = opts.w || r.int(50, 58);
  const extras = opts.extras || [...(EXTRA[n] || [])].filter(() => r.chance(0.8));
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

const EXPLORE = [2, 5, 8]; // levels 3, 6 and 9 of chapters 6-20; every level of chapter 21
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
export { buildExplore, buildLevel };
const args = process.argv.slice(2), keepLinear = args.includes('--keep-linear');
const only = process.env.RB_NO_GEN ? [-1] : args.filter(a => !a.startsWith('--')).map(Number);
// a chapter file's level blocks, as text, so kept levels are written back exactly as they were (comments included)
const blocksOf = src => src.slice(src.indexOf('export default [') + 'export default ['.length, src.lastIndexOf('];'))
  .split(/\n(?=  \{\n    name:)/).map(b => b.replace(/^\n/, '').replace(/\n$/, '')).filter(b => b.trim());
const t0 = performance.now();
for (const n of Object.keys(CH).map(Number)) {
  if (only.length && !only.includes(n)) continue;
  const spec = CH[n], r = rng32(n * 7919), hints = [...HINTS].sort(() => r.next() - 0.5);
  const out = [], file = `src/levels/ch${n}.js`;
  const kept = keepLinear && existsSync(file) ? blocksOf(readFileSync(file, 'utf8')) : null;
  for (let i = 0; i < 10; i++) {
    if (kept && n !== 21 && !EXPLORE.includes(i) && kept[i]) { out.push(kept[i]); continue; }
    let def = null, tries = 0, why = '';
    for (let shrink = 0; shrink <= 2 && !def; shrink++) {
      for (let k = 0; k < 25 && !def; k++) {
        tries++;
        let d;
        const seed = n * 100003 + i * 1009 + k * 31 + shrink * 7;
        let L;
        try {
          d = n === 21 ? buildExplore(n, i, seed, SHOWCASE[i]) : EXPLORE.includes(i) ? buildExplore(n, i, seed) : buildLevel(n, i, seed, shrink);
          L = compile(d, `${n}-${i + 1}`);
        } catch (e) { why = e.message; continue; }
        if (holdRightWins(L, d)) { why = 'beatable by holding right'; continue; }
        const v = verifyLevel(L, d, { maxNodes: n === 21 || EXPLORE.includes(i) ? 200000 : 60000 });
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
  const src = `// Chapter ${n}: generated by scripts/generate-levels.mjs (remixing the traps from chapters 1-5). Edit freely, then\n`
    + `// run \`npm run check\`; re-running the generator overwrites this file.\nexport default [\n${out.join('\n')}\n];\n`;
  writeFileSync(file, src);
}
console.log(`done in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
