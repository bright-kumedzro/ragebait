// The level list: hand-made chapters 1-5 and generated chapters 6-20 (see scripts/generate-levels.mjs).
import { compile } from './compile.js';
import ch1 from './ch1.js';
import ch2 from './ch2.js';
import ch3 from './ch3.js';
import ch4 from './ch4.js';
import ch5 from './ch5.js';
import ch6 from './ch6.js';
import ch7 from './ch7.js';
import ch8 from './ch8.js';
import ch9 from './ch9.js';
import ch10 from './ch10.js';
import ch11 from './ch11.js';
import ch12 from './ch12.js';
import ch13 from './ch13.js';
import ch14 from './ch14.js';
import ch15 from './ch15.js';
import ch16 from './ch16.js';
import ch17 from './ch17.js';
import ch18 from './ch18.js';
import ch19 from './ch19.js';
import ch20 from './ch20.js';

export const CHAPTER_LEVELS = [ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, ch9, ch10, ch11, ch12, ch13, ch14, ch15, ch16, ch17, ch18, ch19, ch20];
export const LEVELS = CHAPTER_LEVELS.flatMap((list, c) => list.map((def, i) => ({ id: `${c + 1}-${i + 1}`, ch: c, i, def })));
export const levelIndex = id => LEVELS.findIndex(l => l.id === id);

// A fingerprint of a level's layout and traps. Challenges store it, so a challenge made before a level was
// changed is flagged instead of comparing deaths on two different levels.
export function levelHash(idx) {
  const { map, traps, fakeSkip } = LEVELS[idx].def;
  const src = map.replace(/\s+/g, '\n') + JSON.stringify(traps || []) + (fakeSkip ? '!' : '');
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

export { compile, doorAt } from './compile.js';

const cache = new Map();
export function getLevel(idx) {
  if (!cache.has(idx)) cache.set(idx, compile(LEVELS[idx].def, LEVELS[idx].id));
  return cache.get(idx);
}
