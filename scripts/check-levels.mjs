// Proves every level can be beaten: a search over held inputs, run on the real sim, has to reach the door (see
// src/levels/verify.js for the attempt, button, corpse and ghost cases). Also catches map typos.
// Usage: node scripts/check-levels.mjs [level ids or chapter numbers...]   e.g. 1-3 2-10, or 7 for all of chapter 7
import { LEVELS, compile } from '../src/levels/index.js';
import { verifyLevel } from '../src/levels/verify.js';

const only = process.argv.slice(2);
const wanted = lv => !only.length || only.includes(lv.id) || only.includes(String(lv.ch + 1));
let failed = 0, checked = 0;
const t00 = performance.now();
for (const lv of LEVELS) {
  if (!wanted(lv)) continue;
  const t0 = performance.now();
  checked++;
  try {
    const rows = lv.def.map.split('\n').map(r => r.trim()).filter(Boolean);
    const widths = new Set(rows.map(r => r.length));
    if (widths.size > 1) throw new Error(`rows have different widths: ${[...widths].join(', ')}`);
    const L = compile(lv.def, lv.id);
    const res = verifyLevel(L, lv.def);
    const ms = (performance.now() - t0).toFixed(0);
    if (!res.ok) { failed++; console.log(`✗ ${lv.id} ${lv.def.name}: ${res.reason}, ${ms} ms`); continue; }
    const notes = res.notes.length ? ` (${res.notes.join(', ')})` : '';
    console.log(`✓ ${lv.id.padEnd(5)} ${lv.def.name.padEnd(26)} ${L.w}×${L.h}  solved in ${res.seconds.toFixed(1)} s of play, ${res.nodes} states${notes}, ${ms} ms`);
  } catch (e) { failed++; console.log(`✗ ${lv.id}: ${e.message}`); }
}
const total = ((performance.now() - t00) / 1000).toFixed(0);
if (failed) { console.log(`\n${failed} of ${checked} level(s) failed (${total} s)`); process.exit(1); }
console.log(`\nall ${checked} levels can be beaten (${total} s)`);
