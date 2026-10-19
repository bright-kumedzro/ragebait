// Finds a way through a level by searching over held inputs, using the real sim. Used by
// scripts/check-levels.mjs to prove every level can be beaten, and by the smoke test to play one in the browser.
import { createState, step, cloneState, fireExternal } from '../sim.js';
import { STEP, RUN, PLAYER_W, PLAYER_H } from '../config.js';

// Each search move holds one of these for `chunk` steps. j held across two moves is one long jump, not two.
export const ACTIONS = [
  { l: 0, r: 1, j: 0 }, { l: 0, r: 1, j: 1 }, { l: 0, r: 0, j: 0 },
  { l: 0, r: 0, j: 1 }, { l: 1, r: 0, j: 0 }, { l: 1, r: 0, j: 1 },
];

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) {
    const a = this.a; a.push(n);
    for (let i = a.length - 1; i > 0;) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

function key(L, s) {
  const p = s.p, q = v => Math.round(v * 4);
  // time only matters while something is still changing, or a trap that waits for a time hasn't fired yet
  const dynamic = s.pending.length || s.balls.length || s.spawners.some(x => !x.done) || s.door.x !== s.door.tx || s.door.y !== s.door.ty || s.gpos || s.lag
    || s.movers.some(m => !m.gone && !(m.kind === 'move' && m.done)) || L.timedTraps.some(i => !s.fired[i] || L.traps[i].repeat)
    || s.keys.some(k => k.x !== k.tx || k.y !== k.ty);
  return [q(p.x), q(p.y), Math.round(p.vx / 3), Math.round(p.vy / 4), p.ground ? 1 : 0, p.jHeld ? 1 : 0, s.grav, s.rev ? 1 : 0,
    s.fired.join(''), s.revealed, s.keys.map(k => (k.got ? 1 : 0)).join(''), s.lag ? s.inq.join('') : '', s.auto, q(s.door.tx), q(s.door.ty), s.edits, dynamic ? Math.round(s.t * 5) : ''].join(',');
}

// Runs `steps` of one action. Returns the state's status.
function advance(L, s, a, steps) {
  for (let k = 0; k < steps; k++) {
    const st = step(L, s, a);
    s.events.length = 0;
    if (st !== 'play') return st;
  }
  return 'play';
}

// ui: names of the level's UI-fired traps to fire at the start (a button the player is meant to press).
// ghost and corpses: as for createState.
export function solve(L, { chunk = 8, maxNodes = 200000, weight = 3, attempt = 1, ui = [], ghost = null, corpses = [] } = {}) {
  L.timedTraps ??= L.traps.map((t, i) => (t.when.t !== undefined || t.when.before !== undefined ? i : -1)).filter(i => i >= 0);
  const perChunk = RUN * chunk * STEP;
  const h = s => {
    // aim for the nearest key still out there, then the door (where it's going, if it's running)
    let tx = s.door.tx + 0.4, ty = s.door.ty + 0.7, best = Infinity;
    for (const k of s.keys) {
      if (k.got) continue;
      const d = Math.abs(k.tx - (s.p.x + PLAYER_W / 2)) + Math.abs(k.ty - (s.p.y + PLAYER_H / 2)) * 0.6;
      if (d < best) { best = d; tx = k.tx; ty = k.ty; }
    }
    const dx = tx - (s.p.x + PLAYER_W / 2), dy = ty - (s.p.y + PLAYER_H / 2);
    // Traps usually fire as you make progress, and one can send the door far away; without the credit, every
    // state after a trap looks worse than all the states before it and the search drowns in those.
    const fired = s.fired.reduce((n, f) => n + (f === 2), 0);
    return (Math.abs(dx) + Math.abs(dy) * 0.6) / perChunk - fired * 25 - s.got * 40;
  };
  const start = createState(L, { attempt, ghost, corpses });
  for (const name of ui) fireExternal(L, start, name);
  start.events.length = 0;
  const open = new Heap(), seen = new Set([key(L, start)]);
  open.push({ s: start, g: 0, f: h(start), parent: null, a: -1 });
  let nodes = 0;
  while (open.size && nodes < maxNodes) {
    const n = open.pop();
    nodes++;
    for (let ai = 0; ai < ACTIONS.length; ai++) {
      const c = cloneState(n.s);
      const st = advance(L, c, ACTIONS[ai], chunk);
      if (st === 'dead') continue;
      const node = { s: c, g: n.g + 1, parent: n, a: ai };
      if (st === 'won') {
        const actions = [];
        for (let x = node; x.parent; x = x.parent) actions.push(x.a);
        actions.reverse();
        return { ok: true, actions, chunk, nodes, seconds: actions.length * chunk * STEP };
      }
      const k = key(L, c);
      if (seen.has(k)) continue;
      seen.add(k);
      node.f = node.g + weight * h(c);
      open.push(node);
    }
  }
  return { ok: false, nodes };
}

// Plays a found route from a fresh start; true if it still wins (it should: the sim is deterministic).
export function replay(L, actions, chunk, attempt = 1, { ui = [], ghost = null, corpses = [] } = {}) {
  const s = createState(L, { attempt, ghost, corpses });
  for (const name of ui) fireExternal(L, s, name);
  for (const ai of actions) {
    const st = advance(L, s, ACTIONS[ai], chunk);
    if (st !== 'play') return st === 'won';
  }
  return false;
}

// Where the runner is at every step of a route: a ghost path for the next attempt.
export function pathOf(L, actions, chunk, attempt = 1) {
  const s = createState(L, { attempt }), path = [];
  for (const ai of actions) for (let k = 0; k < chunk && s.status === 'play'; k++) { step(L, s, ACTIONS[ai]); s.events.length = 0; path.push(s.p.x, s.p.y); }
  return path;
}

// The route as one input per sim step, for driving the game in a browser.
export const toSteps = (actions, chunk) => actions.flatMap(ai => Array(chunk).fill(ACTIONS[ai]));
