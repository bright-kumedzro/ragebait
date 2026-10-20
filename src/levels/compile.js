// Turns a hand-written or generated level (ASCII map plus traps) into what the sim uses. See README → "Adding a
// level" for the map characters and trap options. Kept apart from index.js so the level generator can use it
// without loading the chapter files it writes.
import { PLAYER_W, PLAYER_H, BALL_R } from '../config.js';
import { SOLID, SPIKE_U, SPIKE_D, SPIKE_L, SPIKE_R, BONK, SPRING } from '../sim.js';

const SPIKES = { '^': SPIKE_U, V: SPIKE_D, '<': SPIKE_L, '>': SPIKE_R };
const DOOR_W = 0.8, DOOR_H = 1.4;
export const doorAt = (cx, cy) => [cx + 0.1, cy + 1 - DOOR_H]; // a door stands on the bottom of its cell

export function compile(def, id = '?') {
  const fail = msg => { throw new Error(`level ${id}: ${msg}`); };
  const rows = def.map.split('\n').map(r => r.trim()).filter(r => r.length);
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const grid = new Uint8Array(w * h), cellGroup = new Array(w * h).fill('');
  const groups = {}, marks = {}, fakeDoors = [], flags = [], keys = [], fakeKeys = [], coins = [], levers = [];
  let start = null, door = null;
  const group = ch => (groups[ch] ||= { solid: [], hidden: [] });

  rows.forEach((row, cy) => {
    for (let cx = 0; cx < w; cx++) {
      const c = row[cx] || '.', i = cy * w + cx;
      if (c === '.') continue;
      if (c === '#') grid[i] = SOLID;
      else if (SPIKES[c]) grid[i] = SPIKES[c];
      else if (c === 'P') start = { x: cx + 0.5 - PLAYER_W / 2, y: cy + 1 - PLAYER_H };
      else if (c === 'D') { const [x, y] = doorAt(cx, cy); door = { x, y }; }
      else if (c === 'F') { const [x, y] = doorAt(cx, cy); fakeDoors.push({ x, y }); }
      else if (c === '*') keys.push({ x: cx + 0.5, y: cy + 0.55 });
      else if (c === '&') fakeKeys.push({ x: cx + 0.5, y: cy + 0.55 });
      else if (c === '=') grid[i] = SPRING;
      else if (c === '$') coins.push({ x: cx + 0.5, y: cy + 0.5 });
      else if (c === '/') levers.push({ x: cx, y: cy });
      else if (c === 'K') { flags.push({ x: cx, y: cy, mark: true }); marks.K ||= [cx, cy]; }
      else if (c >= 'a' && c <= 'z') { grid[i] = SOLID; group(c).solid.push([cx, cy]); cellGroup[i] = c; }
      else if (c >= '1' && c <= '9') { group(c).hidden.push([cx, cy]); cellGroup[i] = c; }
      else if (c >= 'A' && c <= 'Z') { if (marks[c]) fail(`mark ${c} used twice`); marks[c] = [cx, cy]; }
      else fail(`unknown map character "${c}" at ${cx},${cy}`);
    }
  });
  if (!start) fail('no P (start)');
  if (!door) fail('no D (door)');

  const solidAt = (x, y) => x < 0 || x >= w || (y >= 0 && y < h && grid[y * w + x] === SOLID);
  // a hidden spike points away from whatever it's attached to
  for (const g of Object.values(groups)) {
    for (const c of g.hidden) {
      const [x, y] = c;
      c[2] = solidAt(x, y + 1) ? SPIKE_U : solidAt(x, y - 1) ? SPIKE_D : solidAt(x - 1, y) ? SPIKE_R : solidAt(x + 1, y) ? SPIKE_L : SPIKE_U;
    }
  }

  const mark = (v, what) => {
    if (typeof v !== 'string') return v;
    if (!marks[v]) fail(`${what} uses mark ${v}, which isn't on the map`);
    return marks[v];
  };
  const traps = (def.traps || []).map((t, n) => {
    const tr = { ...t, when: { ...(t.when || {}) } };
    const wh = tr.when;
    if (typeof wh.x === 'string') wh.x = mark(wh.x, `trap ${n} when.x`)[0];
    if (typeof wh.y === 'string') wh.y = mark(wh.y, `trap ${n} when.y`)[1];
    for (const k of ['stand', 'touch', 'bonk']) if (wh[k]) for (const ch of wh[k]) if (!groups[ch]) fail(`trap ${n} when.${k} names group ${ch}, which isn't on the map`);
    if (wh.after !== undefined && !(wh.after >= 0 && wh.after < def.traps.length)) fail(`trap ${n} when.after is out of range`);
    if (tr.g) for (const ch of tr.g) if (!groups[ch]) fail(`trap ${n} names group ${ch}, which isn't on the map`);
    if (tr.do === 'door') { const [cx, cy] = mark(tr.to, `trap ${n} to`); tr.to = doorAt(cx, cy); }
    if (tr.do === 'keymove') {
      const [cx, cy] = mark(tr.to, `trap ${n} to`); tr.to = [cx + 0.5, cy + 0.55];
      if (!(tr.k >= 0 && tr.k < keys.length)) fail(`trap ${n} moves key ${tr.k}, but the map has ${keys.length}`);
    }
    const centre = (v, what) => { const [cx, cy] = mark(v, what); return typeof v === 'string' ? [cx + 0.5, cy + 0.5] : [cx, cy]; };
    // off: [dx, dy] shifts a saw or bomb from its marks (a mark's own tile is air, so to have a saw sit in the
    // floor, put the mark in the row above and shift it down)
    const [ox, oy] = t.off || [0, 0], shift = ([x, y]) => [x + ox, y + oy];
    if (tr.do === 'saw') {
      tr.from = shift(centre(t.from, `trap ${n} from`));
      if (t.path) tr.path = t.path.map((q, k) => shift(centre(q, `trap ${n} path ${k}`)));
      if (t.back && tr.path) tr.path = [...tr.path, tr.from];
    }
    if (tr.do === 'bomb') tr.at = shift(centre(t.at, `trap ${n} at`));
    if (tr.do === 'warp') { const [cx, cy] = mark(t.to, `trap ${n} to`); tr.to = typeof t.to === 'string' ? [cx + 0.5, cy + 1] : [cx, cy]; }
    if (tr.do === 'lava') tr.to = typeof t.to === 'string' ? mark(t.to, `trap ${n} to`)[1] : t.to; // the surface: the top of that row
    if (wh.lever !== undefined && !(wh.lever >= 0 && wh.lever < levers.length)) fail(`trap ${n} waits for lever ${wh.lever}, but the map has ${levers.length}`);
    if (tr.do === 'belt' && !groups[tr.g]) fail(`trap ${n} belts group ${tr.g}, which isn't on the map`);
    if (tr.do === 'balls') {
      const f = mark(tr.from, `trap ${n} from`);
      tr.from = typeof t.from === 'string' ? [f[0] + 0.5, f[1] + 1 - (tr.r || BALL_R)] : f;
    }
    if (wh.bonk) for (const ch of wh.bonk) for (const [x, y] of groups[ch].hidden) grid[y * w + x] = BONK;
    return tr;
  });

  const portals = (def.portals || []).map(([a, b], k) => [mark(a, `portal ${k}`), mark(b, `portal ${k}`)]);
  const signs = (def.signs || []).map(([m, text], k) => { const [x, y] = mark(m, `sign ${k}`); return { x, y, text }; });
  const lava = def.lava === undefined ? undefined : typeof def.lava === 'string' ? mark(def.lava, 'lava')[1] : def.lava;

  // groups drawn as empty air until something reveals them (they're solid all along)
  const invisible = traps.filter(t => t.do === 'reveal').map(t => t.g).join('');

  return { id, name: def.name, invisible, flags, keys, fakeKeys, coins, levers, portals, signs, lava, wrap: !!def.wrap, fakeWin: def.fakeWin || 0, corpses: !!def.corpses, ghost: def.ghost || 0, button: def.button || '', noPause: (def.traps || []).some(t => t.when?.ui === 'pause'), hint: def.hint || '', w, h, grid, cellGroup, groups, marks, start, door, fakeDoors, traps, fakeSkip: !!def.fakeSkip, DOOR_W, DOOR_H };
}
