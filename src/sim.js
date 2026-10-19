// The game world: a fixed-step, deterministic simulation with no DOM. The browser drives it from game.js and the
// level checker (scripts/check-levels.mjs) drives it from Node, cloning states to search for a way through.
//
// Units are tiles; x runs right, y runs down. A compiled level (L, from levels/index.js) never changes; everything
// that does lives in the state object (s), which is plain data so structuredClone can copy it.
import {
  STEP, PLAYER_W, PLAYER_H, RUN, ACCEL, AIR_ACCEL, DECEL, GRAVITY, JUMP_V, JUMP_CUT, MAX_FALL, COYOTE, BUFFER,
  FALL_GRAVITY, BALL_GRAVITY, BALL_R, DOOR_SPEED, SPIKE_POP,
} from './config.js';

export const AIR = 0, SOLID = 1, SPIKE_U = 2, SPIKE_D = 3, SPIKE_L = 4, SPIKE_R = 5, BONK = 6;
export const isSpike = t => t >= SPIKE_U && t <= SPIKE_R;
const EPS = 1e-6;

// attempt: which try this is (1 = first), for traps that change once you've learned them.
// ghost: the previous attempt's path { path: [x0, y0, x1, y1, …] one point per step, delay: steps }, which chases
// you and kills on touch (levels with `ghost`). corpses: cells where you died before, which become solid blocks
// (levels with `corpses`).
export function createState(L, { attempt = 1, ghost = null, corpses = [] } = {}) {
  const grid = L.grid.slice(), bodies = [];
  if (L.corpses) {
    for (const [cx, cy0] of corpses) {
      // where you died, or just above it when that's taken (dying on a spike leaves you lying on top of it)
      const cy = [cy0, cy0 - 1].find(y => cx >= 0 && cx < L.w && y >= 0 && y < L.h && grid[y * L.w + cx] === AIR);
      if (cy === undefined || overlap(L.start.x, L.start.y, PLAYER_W, PLAYER_H, cx, cy, 1, 1)) continue; // never on the start
      grid[cy * L.w + cx] = SOLID;
      bodies.push([cx, cy]);
    }
  }
  return {
    t: 0,
    n: 0,               // steps taken
    attempt,
    lag: 0,             // inputs arrive this many steps late (the 'lag' trap); inq holds the ones on their way
    inq: [],
    auto: 0,            // forced running direction (the 'auto' trap): 1 right, -1 left, 0 off
    swap: false,        // air and solid colours swapped (drawing only)
    dark: 0,            // only this many tiles around the runner are lit (drawing only); 0 = lights on
    rot: false,         // the view is turned upside down (drawing only)
    ghost: L.ghost ? ghost : null,
    gpos: null,         // where the ghost is now
    corpses: bodies,
    speed: 1,           // run-speed multiplier (the 'speed' trap)
    mirror: false,      // the view is flipped left to right (drawing only; the controls don't change)
    grid,
    p: { x: L.start.x, y: L.start.y, vx: 0, vy: 0, ground: true, coyote: 0, buffer: 0, jHeld: false, face: 1, run: 0, air: 0 },
    grav: 1,            // 1 = down, -1 = up
    rev: false,         // left and right swapped
    door: { x: L.door.x, y: L.door.y, tx: L.door.x, ty: L.door.y, speed: DOOR_SPEED },
    movers: [],
    spikes: [],         // hidden spikes that have come up: { x, y, dir, k } with k going 0 → 1
    balls: [],
    spawners: [],
    fired: L.traps.map(() => 0), // 0 waiting, 1 pending (delay running), 2 done
    held: L.traps.map(() => false), // repeating traps: true while their condition holds, so they fire once per time it starts
    revealed: '',       // invisible groups that have been found
    pending: [],        // { i, at }
    edits: 0,           // bumped whenever the grid changes, so the solver can tell layouts apart cheaply
    status: 'play',     // 'play' | 'dead' | 'won'
    cause: '',
    events: [],         // drained by the renderer each frame: { e, x, y, ... }
  };
}

// A fast copy for the solver (structuredClone works too, but is several times slower). Events aren't copied.
export function cloneState(s) {
  const c = { ...s, grid: s.grid.slice(), p: { ...s.p }, door: { ...s.door }, fired: s.fired.slice(), held: s.held.slice(), inq: s.inq.slice(), events: [] };
  c.movers = s.movers.map(m => ({ ...m, legs: m.legs && m.legs.map(l => l.slice()) }));
  c.spikes = s.spikes.map(k => ({ ...k }));
  c.balls = s.balls.map(b => ({ ...b }));
  c.spawners = s.spawners.map(x => ({ ...x }));
  c.pending = s.pending.map(q => ({ ...q }));
  return c;
}

// ---------- queries ----------
const cell = (L, s, cx, cy) => (cx < 0 || cx >= L.w) ? SOLID : (cy < 0 || cy >= L.h) ? AIR : s.grid[cy * L.w + cx];

function* moverRects(s, skip) {
  for (const m of s.movers) {
    if (m === skip || m.gone) continue;
    for (const [cx, cy] of m.cells) yield { x: cx + m.ox, y: cy + m.oy, m };
  }
}

const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw - EPS && ax + aw > bx + EPS && ay < by + bh - EPS && ay + ah > by + EPS;

// Solid boxes (1×1) touching a rectangle. `up` makes not-yet-found blocks (BONK) solid too: they only stop a head.
function solidsIn(L, s, x, y, w, h, skip, up = false) {
  const out = [];
  const x0 = Math.floor(x + EPS), x1 = Math.floor(x + w - EPS), y0 = Math.floor(y + EPS), y1 = Math.floor(y + h - EPS);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const t = cell(L, s, cx, cy);
    if (t === SOLID || (up && t === BONK)) out.push({ x: cx, y: cy, bonk: t === BONK });
  }
  for (const r of moverRects(s, skip)) if (overlap(x, y, w, h, r.x, r.y, 1, 1)) out.push(r);
  return out;
}
const blocked = (L, s, x, y, w, h, skip) => solidsIn(L, s, x, y, w, h, skip).length > 0;

// ---------- the player ----------
function moveX(L, s, dx, skip) {
  const p = s.p;
  if (!dx) return false;
  let nx = p.x + dx, hit = false;
  for (const r of solidsIn(L, s, nx, p.y, PLAYER_W, PLAYER_H, skip)) {
    hit = true;
    nx = dx > 0 ? Math.min(nx, r.x - PLAYER_W) : Math.max(nx, r.x + 1);
  }
  p.x = nx;
  return hit;
}

// Returns what the player ran into: null, or the box hit.
function moveY(L, s, dy, skip) {
  const p = s.p;
  if (!dy) return null;
  const head = dy * s.grav < 0; // moving against gravity
  let ny = p.y + dy, hit = null;
  for (const r of solidsIn(L, s, p.x, ny, PLAYER_W, PLAYER_H, skip, head)) {
    // a hidden block only counts if it was fully beyond the player's head before this step
    if (r.bonk && (dy < 0 ? r.y + 1 > p.y + EPS : r.y < p.y + PLAYER_H - EPS)) continue;
    hit = r;
    ny = dy > 0 ? Math.min(ny, r.y - PLAYER_H) : Math.max(ny, r.y + 1);
  }
  p.y = ny;
  return hit;
}

function stepPlayer(L, s, input) {
  const p = s.p, dt = STEP;
  let dir = (input.r ? 1 : 0) - (input.l ? 1 : 0);
  if (s.rev) dir = -dir;
  if (s.auto) dir = s.auto;
  const target = dir * RUN * s.speed;
  const a = (!p.ground ? AIR_ACCEL : dir ? ACCEL : DECEL) * Math.max(1, s.speed);
  p.vx = p.vx < target ? Math.min(target, p.vx + a * dt) : Math.max(target, p.vx - a * dt);
  if (dir) p.face = dir;

  if (input.j && !p.jHeld) p.buffer = BUFFER;
  p.jHeld = !!input.j;
  p.coyote = p.ground ? COYOTE : p.coyote - dt;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -JUMP_V * s.grav; p.buffer = 0; p.coyote = 0; p.ground = false;
    s.jumped = true;
    s.events.push({ e: 'jump', x: p.x + PLAYER_W / 2, y: p.y + PLAYER_H });
  }
  p.buffer -= dt;
  if (!input.j && p.vy * s.grav < -JUMP_CUT) p.vy = -JUMP_CUT * s.grav;
  p.vy += GRAVITY * s.grav * dt;
  if (Math.abs(p.vy) > MAX_FALL) p.vy = Math.sign(p.vy) * MAX_FALL;

  if (moveX(L, s, p.vx * dt)) p.vx = 0;
  const wasGround = p.ground, vyBefore = p.vy;
  p.ground = false;
  const hit = moveY(L, s, p.vy * dt);
  if (hit) {
    if (p.vy * s.grav > 0) p.ground = true;
    else if (hit.bonk) bonk(L, s, hit.x, hit.y);
    else s.events.push({ e: 'bump', x: p.x + PLAYER_W / 2, y: p.y });
    p.vy = 0;
  }
  if (p.ground && !wasGround && Math.abs(vyBefore) > 6) s.events.push({ e: 'land', x: p.x + PLAYER_W / 2, y: s.grav > 0 ? p.y + PLAYER_H : p.y, v: Math.abs(vyBefore) });
  p.air = p.ground ? 0 : p.air + dt;
  p.run = p.ground && Math.abs(p.vx) > 0.5 ? p.run + Math.abs(p.vx) * dt : 0;
}

// Which mover (if any) the player is standing on: their feet rest on one of its boxes.
function standingOn(s) {
  const p = s.p;
  if (!p.ground) return null;
  const fy = s.grav > 0 ? p.y + PLAYER_H : p.y;
  for (const r of moverRects(s)) {
    if (p.x + PLAYER_W <= r.x + EPS || p.x >= r.x + 1 - EPS) continue;
    const top = s.grav > 0 ? r.y : r.y + 1;
    if (Math.abs(fy - top) < 0.02) return r.m;
  }
  return null;
}

// ---------- movers: floors that fall, walls that slide, ceilings that slam ----------
function stepMovers(L, s) {
  const dt = STEP, p = s.p;
  for (const m of s.movers) {
    if (m.gone) continue;
    const ox = m.ox, oy = m.oy;
    if (m.kind === 'fall') {
      if (m.wait > 0) { m.wait -= dt; continue; }
      m.vy = Math.min(m.vy + FALL_GRAVITY * dt, 30);
      m.oy += m.vy * dt;
      if (m.oy > L.h + 4) m.gone = true;
    } else if (m.kind === 'move') {
      if (m.wait > 0) { m.wait -= dt; continue; }
      if (m.done) continue;
      const tx = m.legs[m.leg][0], ty = m.legs[m.leg][1];
      const dx = tx - m.ox, dy = ty - m.oy, d = Math.hypot(dx, dy);
      m.v = m.accel ? Math.min(m.speed, m.v + m.accel * dt) : m.speed;
      const stepLen = m.v * dt;
      if (d <= stepLen) {
        m.ox = tx; m.oy = ty; m.v = 0;
        if (m.slam) s.events.push({ e: 'slam', x: m.cells[0][0] + m.ox + 0.5, y: m.cells[0][1] + m.oy + 0.5 });
        if (m.leg + 1 < m.legs.length) { m.leg++; m.wait = m.hold; }
        else if (m.loop) { m.leg = 0; m.wait = m.hold; }
        else m.done = true;
      } else { m.ox += dx / d * stepLen; m.oy += dy / d * stepLen; }
    }
    const mdx = m.ox - ox, mdy = m.oy - oy;
    if (!mdx && !mdy) continue;
    if (s.status !== 'play') continue;
    // carry a rider, then push the player out of the way; pushed into something else means crushed
    m.ox = ox; m.oy = oy;
    const rider = standingOn(s) === m;
    m.ox += mdx; m.oy += mdy;
    if (rider) { moveX(L, s, mdx, m); moveY(L, s, mdy, m); }
    const hits = solidsIn(L, s, p.x, p.y, PLAYER_W, PLAYER_H).filter(r => r.m === m);
    if (hits.length) {
      for (const r of hits) {
        if (Math.abs(mdx) > Math.abs(mdy)) p.x = mdx > 0 ? Math.max(p.x, r.x + 1) : Math.min(p.x, r.x - PLAYER_W);
        else p.y = mdy > 0 ? Math.max(p.y, r.y + 1) : Math.min(p.y, r.y - PLAYER_H);
      }
      if (blocked(L, s, p.x, p.y, PLAYER_W, PLAYER_H)) die(s, 'crush');
    }
  }
}

// ---------- hazards ----------
// Spike hitboxes are the triangle's inner part, so grazing a tip doesn't count.
function spikeBox(x, y, dir, k = 1) {
  const d = 0.55 * k;
  switch (dir) {
    case SPIKE_U: return [x + 0.18, y + 1 - d, 0.64, d];
    case SPIKE_D: return [x + 0.18, y, 0.64, d];
    case SPIKE_R: return [x, y + 0.18, d, 0.64];
    default: return [x + 1 - d, y + 0.18, d, 0.64];
  }
}

function touchesHazard(L, s) {
  const p = s.p, x0 = Math.floor(p.x), x1 = Math.floor(p.x + PLAYER_W), y0 = Math.floor(p.y), y1 = Math.floor(p.y + PLAYER_H);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const t = cell(L, s, cx, cy);
    if (isSpike(t) && overlap(p.x, p.y, PLAYER_W, PLAYER_H, ...spikeBox(cx, cy, t))) return 'spike';
  }
  for (const k of s.spikes) if (k.k > 0.5 && overlap(p.x, p.y, PLAYER_W, PLAYER_H, ...spikeBox(k.x, k.y, k.dir, k.k))) return 'spike';
  for (const m of s.movers) {
    if (m.gone || !m.spikes) continue;
    for (const [cx, cy, dir] of m.spikeCells) if (overlap(p.x, p.y, PLAYER_W, PLAYER_H, ...spikeBox(cx + m.ox, cy + m.oy, dir))) return 'spike';
  }
  for (const b of s.balls) {
    const nx = Math.max(p.x, Math.min(b.x, p.x + PLAYER_W)), ny = Math.max(p.y, Math.min(b.y, p.y + PLAYER_H));
    if ((b.x - nx) ** 2 + (b.y - ny) ** 2 < (b.r - 0.08) ** 2) return 'ball';
  }
  for (const f of L.fakeDoors) if (overlap(p.x, p.y, PLAYER_W, PLAYER_H, f.x + 0.15, f.y + 0.2, 0.7, 1.2)) return 'bite';
  if (s.gpos && overlap(p.x, p.y, PLAYER_W, PLAYER_H, s.gpos[0] + 0.1, s.gpos[1] + 0.12, PLAYER_W - 0.2, PLAYER_H - 0.2)) return 'ghost';
  const out = s.grav > 0 ? p.y > L.h + 1 : p.y + PLAYER_H < -1;
  return out ? 'fall' : '';
}

function die(s, cause) {
  if (s.status !== 'play') return;
  s.status = 'dead'; s.cause = cause;
  s.events.push({ e: 'die', cause, x: s.p.x + PLAYER_W / 2, y: s.p.y + PLAYER_H / 2 });
}

function stepBalls(L, s) {
  const dt = STEP;
  for (const sp of s.spawners) {
    if (sp.done) continue;
    sp.next -= dt;
    while (sp.next <= 0 && !sp.done) {
      s.balls.push({ x: sp.x, y: sp.y, vx: sp.vx, vy: sp.vy, r: sp.r, bounce: sp.bounce, g: sp.g, life: 0 });
      s.events.push({ e: 'shoot', x: sp.x, y: sp.y });
      sp.left--;
      if (sp.left > 0) sp.next += sp.gap;
      else if (sp.every) { sp.left = sp.n; sp.next += sp.every; }
      else sp.done = true;
    }
  }
  for (const b of s.balls) {
    b.life += dt;
    b.vy = Math.min(b.vy + BALL_GRAVITY * b.g * dt, 25);
    const r = b.r * 0.9;
    b.x += b.vx * dt;
    if (solidsIn(L, s, b.x - r, b.y - r, r * 2, r * 2).length) { b.pop = true; continue; }
    b.y += b.vy * dt;
    const hits = solidsIn(L, s, b.x - r, b.y - r, r * 2, r * 2);
    if (hits.length) {
      if (b.vy > 0) b.y = Math.min(...hits.map(h => h.y)) - r; else b.y = Math.max(...hits.map(h => h.y + 1)) + r;
      b.vy = b.bounce && Math.abs(b.vy) > 4 ? -b.vy * b.bounce : 0;
      if (b.vy) s.events.push({ e: 'bounce', x: b.x, y: b.y });
    }
    if (b.y > L.h + 3 || b.y < -12 || b.x < -3 || b.x > L.w + 3 || b.life > 20) b.gone = true;
  }
  for (const b of s.balls) if (b.pop) s.events.push({ e: 'pop', x: b.x, y: b.y });
  s.balls = s.balls.filter(b => !b.pop && !b.gone);
}

function stepDoor(s) {
  const d = s.door, dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy);
  if (!dist) return;
  const st = d.speed * STEP;
  if (dist <= st) { d.x = d.tx; d.y = d.ty; s.events.push({ e: 'doorstop', x: d.x + 0.4, y: d.y + 1.4 }); }
  else { d.x += dx / dist * st; d.y += dy / dist * st; }
}
const doorMoving = s => s.door.x !== s.door.tx || s.door.y !== s.door.ty;

// ---------- traps ----------
const center = s => [s.p.x + PLAYER_W / 2, s.p.y + PLAYER_H / 2];

function groupTouch(L, s, g, pad) {
  const p = s.p;
  for (const ch of g) {
    const grp = L.groups[ch];
    for (const [cx, cy] of grp.solid.concat(grp.hidden)) {
      const m = s.movers.find(m => m.g === ch && !m.gone);
      const ox = m ? m.ox : 0, oy = m ? m.oy : 0;
      if (overlap(p.x - pad, p.y - pad, PLAYER_W + pad * 2, PLAYER_H + pad * 2, cx + ox, cy + oy, 1, 1)) return true;
    }
  }
  return false;
}

function standsOn(L, s, g) {
  const p = s.p;
  if (!p.ground) return false;
  const fy = s.grav > 0 ? p.y + PLAYER_H + 0.05 : p.y - 0.05;
  for (const ch of g) {
    const grp = L.groups[ch], m = s.movers.find(m => m.g === ch && !m.gone);
    const ox = m ? m.ox : 0, oy = m ? m.oy : 0;
    for (const [cx, cy] of grp.solid.concat(grp.hidden)) {
      if (!m && s.grid[cy * L.w + cx] !== SOLID) continue;
      if (p.x + PLAYER_W > cx + ox + EPS && p.x < cx + ox + 1 - EPS && fy > cy + oy && fy < cy + oy + 1) return true;
    }
  }
  return false;
}

function triggered(L, s, w, i) {
  const [cx, cy] = center(s);
  if (w.x !== undefined && !(w.left ? cx <= w.x : cx >= w.x)) return false;
  if (w.y !== undefined && !(w.up ? cy <= w.y : cy >= w.y)) return false;
  if (w.zone && !(cx >= w.zone[0] && cx < w.zone[2] + 1 && cy >= w.zone[1] && cy < w.zone[3] + 1)) return false;
  if (w.near !== undefined) {
    const d = s.door;
    if (Math.hypot(d.x + 0.4 - cx, d.y + 0.7 - cy) > w.near || doorMoving(s)) return false;
  }
  if (w.t !== undefined && s.t < w.t) return false;
  if (w.before !== undefined && s.t >= w.before) return false;
  if (w.tries !== undefined) {
    const a = s.attempt, tr = w.tries;
    if (tr === 'odd' ? a % 2 === 0 : tr === 'even' ? a % 2 === 1 : a < tr[0] || a > (tr[1] ?? Infinity)) return false;
  }
  if (w.after !== undefined && s.fired[w.after] !== 2) return false;
  if (w.jump && !s.jumped) return false;
  if (w.land && !s.landed) return false;
  if (w.stand && !standsOn(L, s, w.stand)) return false;
  if (w.touch && !groupTouch(L, s, w.touch, 0.04)) return false;
  if (w.ground && !s.p.ground) return false;
  if (w.bonk || w.ui) return false; // fired by the physics (see bonk) or by the UI (see fireExternal)
  return true;
}

function fire(L, s, i) {
  const tr = L.traps[i];
  if (tr.delay) { s.fired[i] = 1; s.pending.push({ i, at: s.t + tr.delay }); }
  else apply(L, s, i);
}

function stepTraps(L, s) {
  for (let i = 0; i < L.traps.length; i++) {
    if (L.traps[i].repeat) {
      const on = triggered(L, s, L.traps[i].when, i);
      if (on && !s.held[i]) apply(L, s, i);
      s.held[i] = on;
      continue;
    }
    if (s.fired[i]) continue;
    if (triggered(L, s, L.traps[i].when, i)) fire(L, s, i);
  }
  if (s.pending.length) {
    const due = s.pending.filter(q => q.at <= s.t);
    s.pending = s.pending.filter(q => q.at > s.t);
    for (const q of due) apply(L, s, q.i);
  }
}

function bonk(L, s, cx, cy) {
  const ch = L.cellGroup[cy * L.w + cx];
  for (const c of L.groups[ch].hidden) s.grid[c[1] * L.w + c[0]] = SOLID;
  s.edits++;
  s.events.push({ e: 'bonk', x: cx + 0.5, y: cy + 1 });
  L.traps.forEach((t, i) => { if (!s.fired[i] && t.when.bonk && t.when.bonk.includes(ch)) fire(L, s, i); });
}

function takeCells(L, s, g) {
  const cells = [];
  for (const ch of g) {
    for (const c of L.groups[ch].solid.concat(L.groups[ch].hidden)) {
      if (s.grid[c[1] * L.w + c[0]] !== SOLID) continue;
      s.grid[c[1] * L.w + c[0]] = AIR;
      s.edits++;
      cells.push([c[0], c[1]]);
    }
  }
  return cells;
}

// Spikes on a moving block point out of whichever faces the trap names, where the face isn't against another box.
function moverSpikes(cells, sides) {
  const has = (x, y) => cells.some(c => c[0] === x && c[1] === y), out = [];
  for (const [x, y] of cells) {
    if (sides.includes('d') && !has(x, y + 1)) out.push([x, y + 1, SPIKE_D]);
    if (sides.includes('u') && !has(x, y - 1)) out.push([x, y - 1, SPIKE_U]);
    if (sides.includes('l') && !has(x - 1, y)) out.push([x - 1, y, SPIKE_L]);
    if (sides.includes('r') && !has(x + 1, y)) out.push([x + 1, y, SPIKE_R]);
  }
  return out;
}

function apply(L, s, i) {
  const tr = L.traps[i];
  s.fired[i] = 2;
  s.events.push({ e: 'trap', kind: tr.do, say: tr.say || '', i, quiet: !!tr.invisible });
  switch (tr.do) {
    case 'fall': {
      const moving = s.movers.find(m => m.g === tr.g[0] && !m.gone);
      if (moving) { moving.kind = 'fall'; moving.vy = 0; moving.wait = tr.shake || 0; moving.shake = tr.shake || 0; break; }
      const cells = takeCells(L, s, tr.g);
      if (cells.length) s.movers.push({ g: tr.g[0], kind: 'fall', cells, ox: 0, oy: 0, vy: 0, wait: tr.shake || 0, shake: tr.shake || 0, spikes: '', spikeCells: [] });
      break;
    }
    case 'move': {
      const legs = tr.path || [tr.by], abs = [];
      let x = 0, y = 0;
      for (const [dx, dy] of legs) { x += dx; y += dy; abs.push([x, y]); }
      if (tr.back) abs.push([0, 0]);
      const old = s.movers.find(m => m.g === tr.g[0] && !m.gone && m.kind === 'move');
      if (old) { // move it again, from where it is now
        old.legs = abs.map(([ax, ay]) => [old.ox + ax, old.oy + ay]); old.leg = 0; old.done = false; old.wait = 0; old.v = 0;
        break;
      }
      const cells = takeCells(L, s, tr.g);
      const spikes = tr.spikes || '';
      s.movers.push({
        g: tr.g[0], kind: 'move', cells, ox: 0, oy: 0, legs: abs, leg: 0, v: 0, speed: tr.speed || 6, accel: tr.accel || 0,
        hold: tr.hold ?? 0.5, loop: !!tr.loop, wait: 0, done: false, slam: !!tr.slam, spikes, spikeCells: moverSpikes(cells, spikes),
      });
      break;
    }
    case 'vanish':
      for (const c of takeCells(L, s, tr.g)) s.events.push({ e: 'poof', x: c[0] + 0.5, y: c[1] + 0.5 });
      break;
    case 'show':
      for (const ch of tr.g) for (const c of L.groups[ch].hidden) s.grid[c[1] * L.w + c[0]] = SOLID;
      s.edits++;
      if (blocked(L, s, s.p.x, s.p.y, PLAYER_W, PLAYER_H)) die(s, 'crush');
      break;
    case 'spikes':
      for (const ch of tr.g) for (const c of L.groups[ch].hidden) s.spikes.push({ x: c[0], y: c[1], dir: c[2], k: tr.invisible ? 1 : 0, inv: !!tr.invisible });
      break;
    case 'door': {
      const d = s.door;
      d.tx = tr.to[0]; d.ty = tr.to[1]; d.speed = tr.speed || DOOR_SPEED;
      break;
    }
    case 'balls':
      s.spawners.push({
        x: tr.from[0], y: tr.from[1], vx: tr.v[0], vy: tr.v[1], n: tr.n || 1, left: tr.n || 1, gap: tr.gap || 0.2, every: tr.every || 0,
        next: 0, r: tr.r || BALL_R, bounce: tr.bounce ?? 0, g: tr.grav ?? 1, done: false,
      });
      break;
    case 'reveal': s.revealed += tr.g; break;
    case 'speed': s.speed = tr.factor ?? 1; break;
    case 'lag': s.lag = Math.round((tr.seconds ?? 0) / STEP); if (!s.lag) s.inq.length = 0; break;
    case 'auto': s.auto = tr.dir ?? 0; break;
    case 'swap': s.swap = !s.swap; break;
    case 'dark': s.dark = tr.radius ?? 0; break;
    case 'rotate': s.rot = !s.rot; break;
    case 'crash': break; // the game shows a fake crash screen
    case 'mirror': s.mirror = !s.mirror; break;
    case 'checkpoint': break; // a fake one: the game says "Checkpoint saved!" and then doesn't
    case 'flip': s.grav = -s.grav; s.p.ground = false; break;
    case 'reverse': s.rev = !s.rev; break;
    case 'kill': die(s, tr.cause || 'trap'); break;
    case 'say': break;
    default: throw new Error(`unknown trap: ${tr.do}`);
  }
}

// ---------- one fixed step ----------
// input: { l, r, j } booleans. Returns the state's status.
export function step(L, s, input) {
  if (s.status !== 'play') return s.status;
  s.t += STEP;
  s.jumped = false;
  if (s.lag) { // inputs join a queue and come out `lag` steps later
    s.inq.push((input.l ? 1 : 0) | (input.r ? 2 : 0) | (input.j ? 4 : 0));
    const q = s.inq.length > s.lag ? s.inq.shift() : 0;
    input = { l: q & 1, r: q & 2, j: q & 4 };
  }
  const wasGround = s.p.ground;
  stepMovers(L, s);
  if (s.status === 'play') stepPlayer(L, s, input);
  s.landed = s.p.ground && !wasGround;
  for (const k of s.spikes) if (k.k < 1) { k.k = Math.min(1, k.k + STEP / SPIKE_POP); if (k.k === 1) s.events.push({ e: 'pop-spike', x: k.x + 0.5, y: k.y + 0.5 }); }
  stepBalls(L, s);
  stepDoor(s);
  if (s.ghost) {
    const k = s.n - s.ghost.delay, P = s.ghost.path;
    s.gpos = k >= 0 && k * 2 + 1 < P.length ? [P[k * 2], P[k * 2 + 1]] : null;
  }
  s.n++;
  if (s.status === 'play') stepTraps(L, s);
  if (s.status === 'play') { const c = touchesHazard(L, s); if (c) die(s, c); }
  if (s.status === 'play' && !doorMoving(s)) {
    const d = s.door, p = s.p;
    if (overlap(p.x, p.y, PLAYER_W, PLAYER_H, d.x + 0.15, d.y + 0.25, 0.5, 1.15)) { s.status = 'won'; s.events.push({ e: 'win', x: d.x + 0.4, y: d.y + 0.7 }); }
  }
  return s.status;
}

// Lets the UI trigger a level's own trap (the fake skip button, for one).
export function fireExternal(L, s, name) {
  L.traps.forEach((t, i) => { if (!s.fired[i] && t.when.ui === name) fire(L, s, i); });
}
