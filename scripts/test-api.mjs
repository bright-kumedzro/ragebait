// Tests the challenge API against the in-memory store: validation, one score per player, ranking, win records,
// forgetting a player, and the share page. Usage: node scripts/test-api.mjs
import * as api from '../api/challenge.js';
import * as share from '../api/share.js';

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? '✓' : '✗'} ${what}`); if (!cond) failed++; };
const post = async body => { const r = await api.POST(new Request('http://x/api/challenge', { method: 'POST', body: JSON.stringify(body) })); return { status: r.status, ...(await r.json()) }; };
const get = async q => { const r = await api.GET(new Request(`http://x/api/challenge?${q}`)); return { status: r.status, ...(await r.json()) }; };
const A = 'a'.repeat(32), B = 'b'.repeat(32), C = 'c'.repeat(32);
const levels = ['1-4', '2-7', '3-2'], hashes = ['0433dd85', '55362ae0', 'd4ecdde0'];

ok((await post({ action: 'create', name: '', p: A, levels, hashes })).status === 400, 'a name is required');
ok((await post({ action: 'create', name: 'Ama', p: A, levels: ['1-4', '1-4', '3-2'], hashes })).status === 400, 'levels must be different');
ok((await post({ action: 'create', name: 'Ama', p: A, levels: ['1-4', '9-9', '3-2'], hashes })).status === 400, 'levels must exist');
ok((await post({ action: 'create', name: 'Ama', p: A, levels: levels.slice(0, 2), hashes })).status === 400, 'exactly 3 levels');

const ch = await post({ action: 'create', name: '  Ama <b> ', p: A, levels, hashes });
ok(ch.status === 200 && ch.id && ch.mine && ch.by === 'Ama b', 'creates a challenge, cleans the name');
ok((await get(`id=${ch.id}&p=${B}`)).mine === false, 'someone else sees it as not theirs');
ok((await get('id=nope!')).status === 404, 'a bad id is a 404');

const joined = await post({ action: 'join', id: ch.id, name: 'Kofi', p: B });
ok(joined.playing.length === 1 && joined.playing[0].you, 'joining shows you as playing');

ok((await post({ action: 'score', id: ch.id, name: 'Ama', p: A, deaths: [1, 2], times: [3, 4] })).status === 400, 'scores need one entry per level');
ok((await post({ action: 'score', id: ch.id, name: 'Ama', p: A, deaths: [1, -2, 3], times: [3, 4, 5] })).status === 400, 'deaths can’t be negative');
ok((await post({ action: 'score', id: ch.id, name: 'Ama', p: A, deaths: [1, 2, 3], times: [3, 4, 0] })).status === 400, 'times must be real');

await post({ action: 'score', id: ch.id, name: 'Ama', p: A, deaths: [3, 4, 2], times: [10.04, 20, 30] });
const v1 = await post({ action: 'score', id: ch.id, name: 'Ama', p: A, deaths: [0, 0, 0], times: [1, 1, 1] });
ok(v1.players.length === 1 && v1.players[0].total === 9, 'a second score from the same player is ignored');
ok(v1.players[0].times[0] === 10, 'times are rounded to tenths');

await post({ action: 'score', id: ch.id, name: 'Kofi', p: B, deaths: [5, 2, 2], times: [9, 9, 9] });
await post({ action: 'score', id: ch.id, name: 'Esi', p: C, deaths: [1, 1, 1], times: [50, 50, 50] });
const v2 = await get(`id=${ch.id}&p=${B}`);
ok(v2.players.map(p => p.name).join() === 'Esi,Kofi,Ama', 'fewest deaths first, then fastest');
ok(v2.playing.length === 0, 'finishing removes you from "still playing"');

const sa = await get(`stats=${A}`), sc = await get(`stats=${C}`);
ok(sa.played === 1 && sa.wins === 0 && sc.wins === 1, 'win records count games with 2+ finishers');
const sum = await (await api.GET(new Request(`http://x/api/challenge?ids=${ch.id},zzzzzzzz&p=${A}`))).json();
ok(sum.length === 2 && sum[0].rank === 3 && sum[0].of === 3 && sum[0].done === 2 && sum[1].gone, 'summaries show your rank and flag unknown challenges');

const page = await (await share.GET(new Request(`http://x/api/share?id=${ch.id}`))).text();
ok(page.includes('Ama b is trying to ragebait you') && page.includes('Esi leads with 3 deaths'), 'the share page describes the challenge');
ok(page.includes(`/?challenge=${ch.id}`), 'the share page forwards to the game');

const f = await post({ action: 'forget', p: A, ids: [ch.id] });
const v3 = await get(`id=${ch.id}&p=${B}`);
ok(f.forgotten && v3.by === 'Someone' && !v3.players.some(p => p.name === 'Ama'), 'forgetting removes scores and the creator’s name');
ok((await get(`stats=${A}`)).played === 0, 'forgetting clears the win record');

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall API tests passed');
