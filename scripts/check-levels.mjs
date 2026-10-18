// Proves every level can be beaten: a search over held inputs, run on the real sim, has to reach the door.
// Also catches map typos. Usage: node scripts/check-levels.mjs [level ids...]   e.g. 1-3 2-10
import { LEVELS, compile } from '../src/levels/index.js';
import { solve, replay } from '../src/levels/solver.js';

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
    const res = solve(L);
    const ms = (performance.now() - t0).toFixed(0);
    if (!res.ok) { failed++; console.log(`✗ ${lv.id} ${lv.def.name}: no way through found (${res.nodes} states searched, ${ms} ms)`); continue; }
    if (!replay(L, res.actions, res.chunk)) { failed++; console.log(`✗ ${lv.id} ${lv.def.name}: the route didn't replay (the sim isn't deterministic)`); continue; }
    console.log(`✓ ${lv.id} ${lv.def.name.padEnd(24)} ${L.w}×${L.h}  solved in ${res.seconds.toFixed(1)} s of play, ${res.nodes} states, ${ms} ms`);
  } catch (e) { failed++; console.log(`✗ ${lv.id}: ${e.message}`); }
}
if (failed) { console.log(`\n${failed} level(s) failed`); process.exit(1); }
console.log('\nall levels can be beaten');
