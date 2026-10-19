// Proves a compiled level can be beaten, the way it's actually played: on every attempt where an attempt-dependent
// trap changes, with its button pressed or bodies in place if it's built to need them, and (for ghost levels) on
// the second try with the first try's ghost chasing. Used by scripts/check-levels.mjs and the level generator.
import { createState, step } from '../sim.js';
import { STEP } from '../config.js';
import { solve, replay, pathOf } from './solver.js';

export function verifyLevel(L, def, { maxNodes } = {}) {
  const tries = L.traps.map(t => t.when.tries).filter(t => t !== undefined);
  // every attempt where some trap switches on or off, plus one after the last (odd/even repeats every 2)
  const edges = tries.flatMap(t => (Array.isArray(t) ? [t[0], ...(t[1] !== undefined && t[1] < 50 ? [t[1] + 1] : [])] : [2]));
  const top = Math.max(1, ...edges);
  const attempts = tries.length ? Array.from({ length: top + 1 }, (_, i) => i + 1) : [1];
  const opts = { ui: def.check?.ui || [], corpses: def.check?.corpses || [] };
  const notes = [];
  let first = null, nodes = 0;
  // big maps with keys don't need frame-perfect inputs: searching in bigger steps finds long routes much faster
  const chunks = L.keys.length || L.h > 12 ? [12, 8] : [8, 12];
  const search = o => { let res; for (const chunk of chunks) { res = solve(L, { ...o, chunk, ...(maxNodes ? { maxNodes } : {}) }); if (res.ok) break; } return res; };
  for (const attempt of attempts) {
    const res = search({ attempt, ...opts });
    nodes += res.nodes;
    if (!res.ok) return { ok: false, reason: `no way through found on attempt ${attempt} (${res.nodes} states searched)`, nodes };
    if (!replay(L, res.actions, res.chunk, attempt, opts)) return { ok: false, reason: `the route for attempt ${attempt} didn't replay (the sim isn't deterministic)`, nodes };
    if (attempt === 1) {
      first = res;
      if (L.ghost) {
        const ghost = { path: pathOf(L, res.actions, res.chunk), delay: Math.round(L.ghost / STEP) };
        const g = search({ attempt: 2, ...opts, ghost });
        nodes += g.nodes;
        if (!g.ok) return { ok: false, reason: `no way through on attempt 2 with the first attempt's ghost chasing (${g.nodes} states searched)`, nodes };
        notes.push('and with its own ghost chasing');
      }
    }
  }
  if (attempts.length > 1) notes.unshift(`and attempts 2-${attempts.length}`);
  if (opts.corpses.length) notes.push(`with ${opts.corpses.length} ${opts.corpses.length === 1 ? 'corpse' : 'corpses'} placed`);
  if (opts.ui.length) notes.push(`after pressing ${opts.ui.join(', ')}`);
  return { ok: true, seconds: first.seconds, nodes, notes };
}

// True if just holding right (never jumping) gets through: a level like that has no real trap.
export function holdRightWins(L, def) {
  const s = createState(L, { corpses: def.check?.corpses || [] });
  for (let i = 0; i < 30 / STEP && s.status === 'play'; i++) { step(L, s, { l: 0, r: 1, j: 0 }); s.events.length = 0; }
  return s.status === 'won';
}
