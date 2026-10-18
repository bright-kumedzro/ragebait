import { CHALLENGE_LEVELS } from '../../src/config.js';

// Data model (every key starts with "rb:" so the database can be shared): hash rb:ch:<id> holds `meta`, a
// `j:<playerId>` field per player who accepted (started playing) and a `p:<playerId>` field per player who
// finished (both HSETNX, so a player can only post once and simultaneous posts can't overwrite each other).
// List rb:pl:<playerId> holds the challenges that player finished, newest first, for their win record.
// Player ids are anonymous, per device.
const TTL = 60 * 60 * 24 * 365;
const MAX_PLAYERS = 50;
const RECORD_SIZE = 100;
const ID_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const chKey = id => `rb:ch:${id}`, plKey = p => `rb:pl:${p}`;

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new ApiError(status, message); };

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => ID_CHARS[b % ID_CHARS.length]).join('');
export const validId = id => typeof id === 'string' && /^[A-Za-z0-9]{6,12}$/.test(id);
const validPlayer = p => typeof p === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(p);
const validLevel = l => typeof l === 'string' && /^[1-9]-([1-9]|10)$/.test(l);
const validHash = h => typeof h === 'string' && /^[0-9a-f]{8}$/.test(h);
function cleanName(s) {
  const name = String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return name || fail(400, 'Add your name first.');
}

// Fewest deaths first, then the fastest, then whoever finished first.
const ranked = h => Object.entries(h).filter(([k]) => k.startsWith('p:'))
  .map(([k, v]) => ({ ...v, pid: k.slice(2) }))
  .sort((a, b) => a.total - b.total || a.time - b.time || a.at - b.at);

// Accepted but not finished yet, earliest first.
const playing = h => Object.entries(h).filter(([k]) => k.startsWith('j:') && !h[`p:${k.slice(2)}`])
  .map(([k, v]) => ({ ...v, pid: k.slice(2) }))
  .sort((a, b) => a.at - b.at);

function present(id, h, p) {
  const { meta } = h;
  return {
    id, levels: meta.levels, hashes: meta.hashes, by: meta.by, at: meta.at, mine: meta.byP === p,
    players: ranked(h).map(({ pid, name, deaths, times, total, time, at }) => ({ name, deaths, times, total, time, at, you: pid === p })),
    playing: playing(h).map(({ pid, name, at }) => ({ name, at, you: pid === p })),
  };
}

// What the challenge list needs: who else has joined, how many finished, and where you stand.
function summarize(id, h, p) {
  const players = ranked(h), others = [...players, ...playing(h)].filter(x => x.pid !== p);
  const rank = players.findIndex(x => x.pid === p) + 1;
  return {
    id, by: h.meta.by, mine: h.meta.byP === p, levels: h.meta.levels,
    joined: others.map(x => x.name), done: players.filter(x => x.pid !== p).length,
    rank, of: players.length, leader: players[0] ? { name: players[0].name, total: players[0].total } : null,
  };
}

async function load(db, id) {
  if (!validId(id)) fail(404, 'That challenge link isn’t right.');
  const h = await db.hgetall(chKey(id));
  return h?.meta ? h : fail(404, 'That challenge has expired or never existed.');
}

export async function viewChallenge(db, id, p) { return present(id, await load(db, id), p); }

export async function createChallenge(db, { name, p, levels, hashes }) {
  const by = cleanName(name);
  if (!validPlayer(p)) fail(400, 'Bad request');
  if (!Array.isArray(levels) || levels.length !== CHALLENGE_LEVELS || !levels.every(validLevel) || new Set(levels).size !== levels.length) fail(400, 'Pick 3 different levels.');
  if (!Array.isArray(hashes) || hashes.length !== CHALLENGE_LEVELS || !hashes.every(validHash)) fail(400, 'Bad request');
  const meta = { levels, hashes, by, byP: p, at: Date.now() };
  for (let i = 0; i < 3; i++) {
    const id = newId();
    if (await db.hsetnx(chKey(id), 'meta', meta)) {
      await db.expire(chKey(id), TTL);
      return present(id, { meta }, p);
    }
  }
  fail(500, 'Couldn’t create a challenge. Try again.');
}

// Accepting a challenge (tapping Play) tells its creator someone has taken it up.
export async function joinChallenge(db, { id, name, p }) {
  const who = cleanName(name);
  if (!validPlayer(p)) fail(400, 'Bad request');
  const h = await load(db, id);
  if (!h[`j:${p}`] && !h[`p:${p}`]) {
    if (Object.keys(h).filter(k => k.startsWith('j:')).length >= MAX_PLAYERS) fail(409, 'This challenge is full.');
    await db.hsetnx(chKey(id), `j:${p}`, { name: who, at: Date.now() });
  }
  return viewChallenge(db, id, p);
}

export async function summaries(db, ids, p) {
  const list = String(ids || '').split(',').filter(validId).slice(0, 30);
  const all = await Promise.all(list.map(id => db.hgetall(chKey(id))));
  return list.map((id, i) => (all[i]?.meta ? summarize(id, all[i], p) : { id, gone: true }));
}

export async function submitScore(db, { id, name, p, deaths, times }) {
  const who = cleanName(name);
  if (!validPlayer(p)) fail(400, 'Bad request');
  const n = CHALLENGE_LEVELS;
  if (!Array.isArray(deaths) || deaths.length !== n || !deaths.every(d => isInt(d, 0, 9999))) fail(400, 'Bad request');
  if (!Array.isArray(times) || times.length !== n || !times.every(t => typeof t === 'number' && t >= 0.5 && t <= 36000)) fail(400, 'Bad request');
  const key = chKey(id), h = await load(db, id);
  if (!h[`p:${p}`]) {
    if (ranked(h).length >= MAX_PLAYERS) fail(409, 'This challenge is full.');
    const t = times.map(x => Math.round(x * 10) / 10);
    const entry = { name: who, deaths, times: t, total: deaths.reduce((a, b) => a + b, 0), time: Math.round(t.reduce((a, b) => a + b, 0) * 10) / 10, at: Date.now() };
    if (await db.hsetnx(key, `p:${p}`, entry)) {
      await db.lpush(plKey(p), id);
      await db.ltrim(plKey(p), 0, RECORD_SIZE - 1);
      await db.expire(plKey(p), TTL);
    }
  }
  return viewChallenge(db, id, p);
}

// "Delete my challenge data": removes the player's scores and accepts from every challenge they finished (their
// record list) plus any others their device knows about, then the record itself. Challenges they created stay
// for the people who played them, with the creator's name replaced.
export async function forgetPlayer(db, { p, ids }) {
  if (!validPlayer(p)) fail(400, 'Bad request');
  const known = Array.isArray(ids) ? ids.filter(validId).slice(0, 100) : [];
  const all = [...new Set([...(await db.lrange(plKey(p), 0, RECORD_SIZE - 1)), ...known])];
  let removed = 0;
  for (const id of all) {
    const h = await db.hgetall(chKey(id));
    if (!h?.meta) continue;
    removed += await db.hdel(chKey(id), `p:${p}`, `j:${p}`);
    if (h.meta.byP === p) {
      await db.hdel(chKey(id), 'meta');
      await db.hsetnx(chKey(id), 'meta', { ...h.meta, by: 'Someone', byP: '' });
    }
  }
  await db.del(plKey(p));
  return { forgotten: true, removed };
}

// A challenge counts as a game once at least two people have finished it; you win it if you're top.
export async function playerStats(db, p) {
  if (!validPlayer(p)) fail(400, 'Bad request');
  const ids = await db.lrange(plKey(p), 0, RECORD_SIZE - 1);
  const all = await Promise.all(ids.map(id => db.hgetall(chKey(id))));
  let played = 0, wins = 0, waiting = 0;
  for (const h of all) {
    if (!h?.meta) continue;
    const players = ranked(h);
    if (players.length < 2) { waiting++; continue; }
    played++;
    if (players[0].pid === p) wins++;
  }
  return { played, wins, waiting };
}
