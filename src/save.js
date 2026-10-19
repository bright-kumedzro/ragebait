import { LEVELS } from './levels/index.js';

const KEY = 'ragebait.save.v1';

const defaults = () => ({
  levels: {},       // level id -> { cleared, best (fewest deaths in a clearing run), time (fastest clear, s), deaths (all-time) }
  deaths: 0,        // every death, ever
  settings: { sound: true, music: true, haptics: true, swap: false },
  tips: {},         // one-off hints already shown
  stats: { jumps: 0, clears: 0, seconds: 0 },
  // last anonymous report (metrics.js); firstDay is the UTC day this device was first counted, app whether it has
  // been counted as an installed app
  metrics: { counted: false, firstDay: '', day: '', week: '', month: '', sent: { levels: 0, deaths: 0 }, app: false },
  player: { id: '', name: '' }, // anonymous challenge identity, per device
  challenges: {},   // challenge id -> { by, levels, at, deaths: [per level], times: [per level], cur: { deaths, time }, sent, joined, seen }
});

function merge(a, b) {
  for (const k in b) {
    const av = a[k], bv = b[k];
    if (bv && typeof bv === 'object' && !Array.isArray(bv) && av && typeof av === 'object' && !Array.isArray(av)) merge(av, bv);
    else a[k] = bv;
  }
  return a;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(defaults(), JSON.parse(raw));
  } catch { /* storage blocked or corrupt: start fresh */ }
  return defaults();
}

export const save = load();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

// Keeps the challenge identity and progress (they belong to scores on the server, not the campaign), and that this
// device has been counted, so a reset isn't a new player.
export function resetSave() {
  const keep = { player: save.player, challenges: save.challenges, metrics: { ...save.metrics, sent: { levels: 0, deaths: 0 } } };
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, defaults(), keep);
  persist();
}

export const levelSave = id => (save.levels[id] ||= { cleared: false, best: null, time: null, deaths: 0 });
export const isCleared = idx => !!save.levels[LEVELS[idx]?.id]?.cleared;
export const isUnlocked = idx => idx === 0 || isCleared(idx - 1) || isCleared(idx);
export const clearedCount = () => LEVELS.filter((_, i) => isCleared(i)).length;
// the first level not yet beaten (or the last one, once everything is)
export function nextUnplayed() {
  const i = LEVELS.findIndex((_, i) => !isCleared(i));
  return i < 0 ? LEVELS.length - 1 : i;
}
