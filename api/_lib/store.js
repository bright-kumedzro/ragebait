import { Redis } from '@upstash/redis';
import { createClient } from 'redis';

// Where challenges live. Any of these works, checked in this order:
// - Redis from Vercel's Marketplace (or any Redis server): REDIS_URL
// - Upstash Redis: KV_REST_API_URL + KV_REST_API_TOKEN (Vercel's Upstash integration) or
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (a database made at upstash.com)
// - off Vercel (dev server, smoke test, API tests): an in-memory stand-in with the same few commands, so the API
//   runs with no setup. On Vercel with none set, there's no store and the API says challenges aren't set up.
// Every key the game writes starts with "rb:" (see challenges.js), so a database can be shared with another project.
export function openStore() {
  if (process.env.REDIS_URL) return redisStore(process.env.REDIS_URL);
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new Redis({ url, token, enableAutoPipelining: true });
  return process.env.VERCEL ? null : memory;
}

// A plain Redis connection, kept open between requests while the function stays warm. Upstash's client turns
// hash values into JSON and back by itself; this does the same, so challenges.js works with either.
let client = null;
function redisStore(url) {
  return redisAdapter(() => {
    if (!client) {
      const c = createClient({ url, socket: { connectTimeout: 5000 } });
      c.on('error', () => {}); // a dropped connection reconnects; requests in flight fail and the API reports it
      client = c.connect().then(() => c, e => { client = null; throw e; });
    }
    return client;
  });
}

// conn: resolves to a connected node-redis client (exported so the API tests can run it on a stand-in)
export function redisAdapter(conn) {
  const parse = v => { try { return JSON.parse(v); } catch { return v; } };
  return {
    async hgetall(k) {
      const h = await (await conn()).hGetAll(k);
      const keys = Object.keys(h);
      return keys.length ? Object.fromEntries(keys.map(f => [f, parse(h[f])])) : null;
    },
    async hsetnx(k, f, v) { return (await (await conn()).hSetNX(k, f, JSON.stringify(v))) ? 1 : 0; },
    async hdel(k, ...fs) { return (await conn()).hDel(k, fs); },
    async hincrby(k, f, by) { return (await conn()).hIncrBy(k, f, by); },
    async scan(cursor, { match, count }) {
      const r = await (await conn()).scan(Number(cursor), { MATCH: match, COUNT: count });
      return [String(r.cursor), r.keys];
    },
    async del(k) { return (await conn()).del(k); },
    async expire(k, s) { return (await conn()).expire(k, s); },
    async lpush(k, v) { return (await conn()).lPush(k, v); },
    async ltrim(k, a, b) { return (await conn()).lTrim(k, a, b); },
    async lrange(k, a, b) { return (await conn()).lRange(k, a, b); },
  };
}

const mem = new Map();
const list = k => mem.get(k) || [];
const memory = {
  async hgetall(k) { const h = mem.get(k); return h ? structuredClone(Object.fromEntries(h)) : null; },
  async hsetnx(k, f, v) {
    if (!mem.has(k)) mem.set(k, new Map());
    const h = mem.get(k);
    if (h.has(f)) return 0;
    h.set(f, structuredClone(v));
    return 1;
  },
  async hdel(k, ...fs) { const h = mem.get(k); let n = 0; for (const f of fs) n += h?.delete(f) ? 1 : 0; return n; },
  async hincrby(k, f, by) {
    if (!mem.has(k)) mem.set(k, new Map());
    const h = mem.get(k), v = (Number(h.get(f)) || 0) + by;
    h.set(f, v);
    return v;
  },
  async scan(_, { match }) { // one pass; only trailing-* patterns
    const prefix = match.replace(/\*$/, '');
    return ['0', [...mem.keys()].filter(k => k.startsWith(prefix))];
  },
  async del(k) { return mem.delete(k) ? 1 : 0; },
  async expire() { return 1; },
  async lpush(k, v) { mem.set(k, [v, ...list(k)]); return list(k).length; },
  async ltrim(k, a, b) { mem.set(k, list(k).slice(a, b + 1)); return 'OK'; },
  async lrange(k, a, b) { return list(k).slice(a, b + 1); },
};
