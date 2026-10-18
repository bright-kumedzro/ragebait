import { save, persist } from './save.js';
import { CHALLENGE_LEVELS } from './config.js';
import { levelIndex, levelHash } from './levels/index.js';

// Challenges ("Ragebait a friend"): talks to /api/challenge and keeps this device's progress, so leaving
// mid-challenge resumes at the same level with the deaths and time already racked up.
const API = './api/challenge';
const KEEP = 30;

export const available = () => __COMPETE__ && location.protocol.startsWith('http');

// Whether the server has somewhere to keep challenges. Until it does, the game hides the challenge button rather
// than offer something that can only fail. Asked once per visit; a network error counts as "not now".
let ready = null;
export function serverReady() {
  if (!available()) return Promise.resolve(false);
  // the body is read even though only the status matters: an unread response keeps the request open
  ready ||= fetch(`${API}?ping`, { cache: 'no-store' })
    .then(async r => { await r.text().catch(() => ''); return r.ok; }, () => { ready = null; return false; });
  return ready;
}

function playerId() {
  // getRandomValues, unlike randomUUID, also works on plain-http LAN addresses used for phone testing
  if (!save.player.id) { save.player.id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); persist(); }
  return save.player.id;
}

async function call(query, init) {
  let res;
  try { res = await fetch(API + query, init); } catch { throw new Error('Couldn’t reach the server. Check your connection.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Try again.'), { status: res.status });
  return data;
}
const post = body => call('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const fetchChallenge = id => call(`?id=${encodeURIComponent(id)}&p=${playerId()}`);
export const fetchStats = () => call(`?stats=${playerId()}`);

// Playable only while every level is still the one the challenge was made on.
export const playable = ch => ch.levels.every((id, i) => { const k = levelIndex(id); return k >= 0 && levelHash(k) === ch.hashes[i]; });

export async function createChallenge(levels) {
  const ch = await post({ action: 'create', name: save.player.name, p: playerId(), levels, hashes: levels.map(id => levelHash(levelIndex(id))) });
  track(ch);
  return ch;
}

// Called when a player starts their levels, so the creator sees they've accepted.
export const joinChallenge = id => post({ action: 'join', id, name: save.player.name, p: playerId() });

// Who has joined and finished each recent challenge; `fresh` marks news since the player last opened it.
export async function fetchSummaries() {
  const ids = recent().map(([id]) => id);
  if (!ids.length) return [];
  const list = await call(`?ids=${ids.join(',')}&p=${playerId()}`);
  return list.map(s => ({ ...s, fresh: !s.gone && activity(s) !== save.challenges[s.id]?.seen }));
}
const activity = s => `${s.joined.length}:${s.done}`;
export function markSeen(view) {
  const rec = save.challenges[view.id];
  if (!rec) return;
  const others = [...view.players, ...view.playing].filter(x => !x.you);
  rec.seen = `${others.length}:${view.players.filter(x => !x.you).length}`;
  persist();
}

export async function submitScore(id) {
  const rec = save.challenges[id];
  const view = await post({ action: 'score', id, name: save.player.name, p: playerId(), deaths: rec.deaths, times: rec.times.map(t => Math.max(0.5, t)) });
  rec.sent = true; persist();
  return view;
}

// Deletes this player's scores, accepts and record from the server, then starts a fresh anonymous identity.
// The nickname stays on the device for convenience.
export async function forgetMe() {
  if (save.player.id) await post({ action: 'forget', p: save.player.id, ids: Object.keys(save.challenges) });
  save.player.id = ''; save.challenges = {};
  persist();
}

// ---------- local progress ----------
export const progress = id => save.challenges[id];
export function track(ch) {
  if (!save.challenges[ch.id]) {
    save.challenges[ch.id] = { by: ch.mine ? null : ch.by, levels: ch.levels, at: Date.now(), deaths: [], times: [], cur: { deaths: 0, time: 0 }, sent: false, joined: false, seen: '0:0' };
  }
  const ids = Object.keys(save.challenges).sort((a, b) => save.challenges[b].at - save.challenges[a].at);
  for (const id of ids.slice(KEEP)) delete save.challenges[id];
  persist();
  return save.challenges[ch.id];
}
export const finished = rec => rec.deaths.length >= CHALLENGE_LEVELS;
export const totalDeaths = rec => rec.deaths.reduce((a, b) => a + b, 0) + (finished(rec) ? 0 : rec.cur.deaths);
export const recent = () => Object.entries(save.challenges).sort(([, a], [, b]) => b.at - a.at);

// ---------- sharing ----------
export const link = id => `${location.origin}/c/${id}`;
export async function share(view) {
  const me = view.players.find(p => p.you);
  const text = me ? `I died ${me.total} ${me.total === 1 ? 'time' : 'times'} on these ${view.levels.length} Ragebait levels. Think you can do better?`
    : `I’m ragebaiting you: ${view.levels.length} levels, fewest deaths wins.`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Ragebait challenge', text, url: link(view.id) }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  try { await navigator.clipboard.writeText(`${text} ${link(view.id)}`); return 'copied'; } catch { return 'failed'; }
}
