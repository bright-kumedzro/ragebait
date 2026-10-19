// Proves every level can be beaten: a search over held inputs, run on the real sim, has to reach the door.
// Also catches map typos. Usage: node scripts/check-levels.mjs [level ids...]   e.g. 1-3 2-10
import { LEVELS, compile } from '../src/levels/index.js';
import { solve, replay, pathOf } from '../src/levels/solver.js';
import { STEP } from '../src/config.js';

const only = process.argv.slice(2);
let failed = 0;
for (const lv of LEVELS) {
  if (only.length && !only.includes(lv.id)) continue;
  const t0 = performance.now();
  try {
    const rows = lv.def.map.split('\n').map(r => r.trim()).filter(Boolean);
    const widths = new Set(rows.map(r => r.length));
    if (widths.size > 1) throw new Error(`rows have different widths: ${[...widths].join(', ')}`);
    const L = compile(lv.def, lv.id);
    // levels whose traps change with the attempt number must be beatable on every version of themselves
    const tries = L.traps.map(t => t.when.tries).filter(t => t !== undefined);
    // every attempt where some trap switches on or off, plus one after the last (odd/even repeats every 2)
    const edges = tries.flatMap(t => (Array.isArray(t) ? [t[0], ...(t[1] !== undefined && t[1] < 50 ? [t[1] + 1] : [])] : [2]));
    const top = Math.max(1, ...edges);
    const attempts = tries.length ? Array.from({ length: top + 1 }, (_, i) => i + 1) : [1];
    let bad = '', stats = '', extra = '';
    // a level built to need a press of its button, or some deaths first (corpses), is checked in that state
    const opts = { ui: lv.def.check?.ui || [], corpses: lv.def.check?.corpses || [] };
    for (const attempt of attempts) {
      const res = solve(L, { attempt, ...opts });
      if (!res.ok) { bad = `no way through found on attempt ${attempt} (${res.nodes} states searched)`; break; }
      if (!replay(L, res.actions, res.chunk, attempt, opts)) { bad = `the route for attempt ${attempt} didn't replay (the sim isn't deterministic)`; break; }
      if (attempt === 1) stats = `solved in ${res.seconds.toFixed(1)} s of play, ${res.nodes} states`;
      // a ghost level: the next attempt, chased by this one, must still be beatable
      if (attempt === 1 && L.ghost) {
        const ghost = { path: pathOf(L, res.actions, res.chunk), delay: Math.round(L.ghost / STEP) };
        const g = solve(L, { attempt: 2, ...opts, ghost });
        if (!g.ok) { bad = `no way through on attempt 2 with the first attempt's ghost chasing (${g.nodes} states searched)`; break; }
        extra += ', and with its own ghost chasing';
      }
    }
    if (opts.corpses.length) extra += `, with ${opts.corpses.length} ${opts.corpses.length === 1 ? 'corpse' : 'corpses'} placed`;
    if (opts.ui.length) extra += `, after pressing ${opts.ui.join(', ')}`;
    const ms = (performance.now() - t0).toFixed(0);
    if (bad) { failed++; console.log(`✗ ${lv.id} ${lv.def.name}: ${bad}, ${ms} ms`); continue; }
    console.log(`✓ ${lv.id} ${lv.def.name.padEnd(24)} ${L.w}×${L.h}  ${stats}${attempts.length > 1 ? ` (and attempts 2-${attempts.length})` : ''}${extra}, ${ms} ms`);
  } catch (e) { failed++; console.log(`✗ ${lv.id}: ${e.message}`); }
}
if (failed) { console.log(`\n${failed} level(s) failed`); process.exit(1); }
console.log('\nall levels can be beaten');
