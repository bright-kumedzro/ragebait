// Draws the sim state on a 2D canvas: flat two-colour levels in the chapter's palette, a tiny runner, and the
// particles and screen shake that sell every death. Nothing here changes the sim.
import { PLAYER_W, PLAYER_H } from './config.js';
import { SOLID, SPIKE_U, SPIKE_D, SPIKE_R, isSpike } from './sim.js';

const MAX_DPR = 2;
const VIEW_W = 34, VIEW_H = 20; // at most this many tiles across and down; bigger levels scroll

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let dpr = 1, cw = 0, ch = 0;          // canvas size in device pixels
  let L = null, theme = null;
  let scale = 1, camX = 0, camY = 0;    // device pixels per tile; camera top-left in tiles
  let shake = 0, flash = 0;
  const parts = [];
  let deathMarks = [];
  let squash = 0, lastFace = 1;
  let mirrorK = 1, flagWave = 0;        // mirrorK eases between 1 and -1 so a mirror trap flips the view visibly
  let rotK = 0;                         // 0 upright → 1 upside down, eased the same way
  let insets = { top: 0, bottom: 0 };   // CSS px the HUD and touch controls cover

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    cw = Math.round(canvas.clientWidth * dpr); ch = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    if (L) fit(true);
  }

  // Fits the level (or a VIEW_W × VIEW_H window of it) to the screen, leaving the HUD strip clear when there's room.
  function fit(snap) {
    const top = insets.top * dpr, usableH = ch - top;
    const vw = Math.min(L.w, VIEW_W), vh = Math.min(L.h, VIEW_H);
    scale = Math.min(cw / vw, usableH / vh, ch / (vh + 1.5));
    if (snap) { camX = targetCam().x; camY = targetCam().y; }
  }

  function targetCam(s) {
    const viewW = cw / scale, viewH = ch / scale, top = insets.top * dpr / scale;
    let x, y;
    if (L.w <= viewW) x = (L.w - viewW) / 2;
    else {
      const px = s ? s.p.x + PLAYER_W / 2 : L.start.x;
      x = Math.max(0, Math.min(L.w - viewW, px - viewW / 2));
    }
    // levels sit low on the screen (the sky above is free); taller ones follow the runner
    const roomH = viewH - top;
    if (L.h <= roomH) y = L.h - viewH + Math.max(0, (roomH - L.h) * 0.35);
    else {
      const py = s ? s.p.y : L.start.y;
      y = Math.max(-top, Math.min(L.h - viewH, py - top - roomH * 0.55));
    }
    return { x, y };
  }

  function setLevel(level, th) {
    L = level; theme = th; parts.length = 0; deathMarks = []; shake = 0; flash = 0; mirrorK = 1; rotK = 0;
    fit(true);
  }

  const X = tx => Math.round((tx - camX) * scale);
  const Y = ty => Math.round((ty - camY) * scale);

  function cellAt(s, cx, cy) {
    // outside the level, edge tiles carry on to the screen edge so a level never looks like it floats
    const x = Math.max(0, Math.min(L.w - 1, cx));
    if (cy < 0) return s.grid[x] === SOLID ? SOLID : 0;
    const y = Math.min(L.h - 1, cy), i = y * L.w + x, t = s.grid[i];
    const g = L.cellGroup[i];
    if (t === SOLID && g && L.invisible.includes(g) && !s.revealed.includes(g)) return 0;
    if (cx !== x || cy !== y) return t === SOLID ? SOLID : 0;
    return t;
  }

  function spikeShape(x, y, dir, k = 1) {
    // two teeth per tile, drawn from the base outward; k < 1 while popping up
    const d = 0.6 * k;
    for (let i = 0; i < 2; i++) {
      const a = 0.04 + i * 0.48, b = a + 0.44, m = (a + b) / 2;
      ctx.beginPath();
      if (dir === SPIKE_U) { ctx.moveTo(X(x + a), Y(y + 1)); ctx.lineTo(X(x + m), Y(y + 1 - d)); ctx.lineTo(X(x + b), Y(y + 1)); }
      else if (dir === SPIKE_D) { ctx.moveTo(X(x + a), Y(y)); ctx.lineTo(X(x + m), Y(y + d)); ctx.lineTo(X(x + b), Y(y)); }
      else if (dir === SPIKE_R) { ctx.moveTo(X(x), Y(y + a)); ctx.lineTo(X(x + d), Y(y + m)); ctx.lineTo(X(x), Y(y + b)); }
      else { ctx.moveTo(X(x + 1), Y(y + a)); ctx.lineTo(X(x + 1 - d), Y(y + m)); ctx.lineTo(X(x + 1), Y(y + b)); }
      ctx.closePath(); ctx.fill();
    }
  }

  function drawDoor(x, y, moving, t, open = 0) {
    const w = 0.8, h = 1.4;
    let bob = 0;
    if (moving) bob = Math.abs(Math.sin(t * 22)) * 0.12;
    ctx.fillStyle = theme.solid;
    ctx.fillRect(X(x - 0.06), Y(y - 0.06 - bob), X(x + w + 0.06) - X(x - 0.06), Y(y + h - bob) - Y(y - 0.06 - bob));
    ctx.fillStyle = theme.door;
    ctx.fillRect(X(x + 0.06), Y(y + 0.06 - bob), X(x + w - 0.06) - X(x + 0.06), Y(y + h - bob) - Y(y + 0.06 - bob));
    if (open > 0) { // the fake door's mouth
      ctx.fillStyle = theme.ink;
      ctx.fillRect(X(x + 0.12), Y(y + 0.45), X(x + w - 0.12) - X(x + 0.12), Y(y + 0.45 + 0.6 * open) - Y(y + 0.45));
      ctx.fillStyle = theme.door;
      for (let i = 0; i < 4; i++) {
        const tx = x + 0.14 + i * 0.14;
        ctx.beginPath(); ctx.moveTo(X(tx), Y(y + 0.45)); ctx.lineTo(X(tx + 0.07), Y(y + 0.62)); ctx.lineTo(X(tx + 0.14), Y(y + 0.45)); ctx.fill();
      }
    }
    ctx.fillStyle = theme.solid;
    ctx.beginPath(); ctx.arc(X(x + w - 0.2), Y(y + 0.8 - bob), Math.max(1.5, scale * 0.06), 0, Math.PI * 2); ctx.fill();
    if (moving) { // little legs
      ctx.strokeStyle = theme.ink; ctx.lineWidth = Math.max(1, scale * 0.07); ctx.lineCap = 'round';
      const ph = Math.sin(t * 22) * 0.12;
      ctx.beginPath();
      ctx.moveTo(X(x + 0.25), Y(y + h - bob)); ctx.lineTo(X(x + 0.25 + ph), Y(y + h + 0.1));
      ctx.moveTo(X(x + 0.55), Y(y + h - bob)); ctx.lineTo(X(x + 0.55 - ph), Y(y + h + 0.1));
      ctx.stroke();
    }
  }

  function drawCorpse(cx, cy) {
    const x0 = X(cx + 0.04), y0 = Y(cy + 0.08), w = X(cx + 0.96) - x0, h = Y(cy + 1) - y0;
    ctx.fillStyle = theme.ink;
    ctx.beginPath(); ctx.roundRect(x0, y0, w, h, scale * 0.18); ctx.fill();
    ctx.strokeStyle = theme.air; ctx.lineWidth = Math.max(1, scale * 0.06); ctx.lineCap = 'round';
    for (const ex of [0.32, 0.62]) { // x eyes
      const ex0 = X(cx + ex), ey0 = Y(cy + 0.3), d = scale * 0.08;
      ctx.beginPath(); ctx.moveTo(ex0 - d, ey0 - d); ctx.lineTo(ex0 + d, ey0 + d); ctx.moveTo(ex0 + d, ey0 - d); ctx.lineTo(ex0 - d, ey0 + d); ctx.stroke();
    }
  }

  // the previous attempt, see-through, in the door colour
  function drawGhost(s, t) {
    const face = lastFace, base = theme;
    theme = { ...base, ink: base.door };
    ctx.globalAlpha = 0.5;
    drawPlayer({ p: { x: s.gpos[0], y: s.gpos[1], vx: 6, ground: true, run: t * 7 }, grav: s.grav }, t);
    ctx.globalAlpha = 1; theme = base; lastFace = face;
  }

  // a checkpoint flag on a pole, waving harder for a moment when you pass it
  function drawFlag(x, y, t) {
    const px = x + 0.3, top = y + 1 - 1.7;
    ctx.fillStyle = theme.solid;
    ctx.fillRect(X(px), Y(top), Math.max(2, X(px + 0.09) - X(px)), Y(y + 1) - Y(top));
    const wave = Math.sin(t * (4 + flagWave * 10)) * (0.06 + flagWave * 0.1);
    ctx.fillStyle = theme.door;
    ctx.beginPath();
    ctx.moveTo(X(px + 0.09), Y(top));
    ctx.quadraticCurveTo(X(px + 0.45), Y(top + 0.2 + wave), X(px + 0.85), Y(top + 0.3 + wave));
    ctx.lineTo(X(px + 0.09), Y(top + 0.62));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = theme.solid; ctx.lineWidth = Math.max(1, scale * 0.05); ctx.stroke();
  }

  function drawPlayer(s, t) {
    const p = s.p, g = s.grav;
    const face = p.vx > 0.3 ? 1 : p.vx < -0.3 ? -1 : lastFace;
    lastFace = face;
    const fx = p.x + PLAYER_W / 2, fy = g > 0 ? p.y + PLAYER_H : p.y;
    const sq = squash; // >0 squashed (landing), <0 stretched (jumping)
    const sx = 1 + sq * 0.35, sy = 1 - sq * 0.35;
    ctx.save();
    ctx.translate(X(fx), Y(fy));
    ctx.scale(scale * sx * face, scale * sy * g);
    ctx.fillStyle = theme.ink; ctx.strokeStyle = theme.ink; ctx.lineCap = 'round';
    const run = p.run * 2.6, air = !p.ground;
    // legs
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    if (air) {
      ctx.moveTo(-0.06, -0.26); ctx.lineTo(-0.12, -0.08);
      ctx.moveTo(0.06, -0.26); ctx.lineTo(0.14, -0.1);
    } else {
      const a = Math.sin(run) * 0.13, b = -a;
      ctx.moveTo(-0.05, -0.26); ctx.lineTo(-0.05 + a, -0.03);
      ctx.moveTo(0.05, -0.26); ctx.lineTo(0.05 + b, -0.03);
    }
    ctx.stroke();
    // body
    ctx.beginPath(); ctx.roundRect(-0.14, -0.56, 0.28, 0.34, 0.09); ctx.fill();
    // arms
    ctx.lineWidth = 0.07;
    const sw = air ? -0.18 : Math.sin(run + Math.PI) * 0.1;
    ctx.beginPath();
    ctx.moveTo(-0.1, -0.48); ctx.lineTo(-0.2, air ? -0.62 : -0.3 + sw * 0.3);
    ctx.moveTo(0.1, -0.48); ctx.lineTo(0.22, air ? -0.64 : -0.3 - sw * 0.3);
    ctx.stroke();
    // head and eye
    ctx.beginPath(); ctx.arc(0, -0.68, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = theme.air;
    ctx.beginPath(); ctx.arc(0.07, -0.7, 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function burst(x, y, n, color, speed = 8, life = 0.7, size = 0.12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life, max: life, color, size: size * (0.6 + Math.random() * 0.8) });
    }
  }

  // Turns sim events into effects. Returns nothing; sounds are handled by the game.
  function onEvent(ev, s) {
    switch (ev.e) {
      case 'jump': squash = -0.5; burst(ev.x, ev.y, 4, theme.solid, 3, 0.3, 0.1); break;
      case 'land': squash = Math.min(0.6, ev.v / 30); burst(ev.x, ev.y, 5, theme.solid, 3, 0.3, 0.1); break;
      case 'die':
        burst(ev.x, ev.y, 26, theme.ink, 11, 0.9, 0.14); burst(ev.x, ev.y, 10, theme.solid, 8, 0.7, 0.12);
        shake = 0.5; flash = 1; deathMarks.push([ev.x, ev.y]);
        if (deathMarks.length > 40) deathMarks.shift();
        break;
      case 'slam': shake = Math.max(shake, 0.25); burst(ev.x, ev.y + 0.5, 6, theme.solid, 4, 0.4); break;
      case 'pop': burst(ev.x, ev.y, 10, theme.solid, 6, 0.5); break;
      case 'poof': burst(ev.x, ev.y, 4, theme.solid, 4, 0.4); break;
      case 'bonk': shake = Math.max(shake, 0.12); burst(ev.x, ev.y, 6, theme.solid, 4, 0.4); break;
      case 'bump': squash = 0.25; break;
      case 'doorstop': burst(ev.x, ev.y, 5, theme.solid, 3, 0.35, 0.1); break;
      case 'win': burst(ev.x, ev.y, 30, theme.door, 9, 1, 0.14); burst(ev.x, ev.y, 14, theme.ink, 7, 0.8, 0.1); break;
      case 'trap':
        if (ev.kind === 'fall') shake = Math.max(shake, 0.15);
        if (ev.kind === 'checkpoint') { flagWave = 1; for (const f of L.flags) burst(f.x + 0.5, f.y - 0.4, 14, theme.door, 6, 0.8, 0.12); }
        break;
    }
  }

  function draw(s, dt, t, opts = {}) {
    const base = theme;
    if (s.swap) theme = { ...base, air: base.solid, solid: base.air }; // "which one is the floor?"
    try { drawWorld(s, dt, t, opts); } finally { theme = base; }
  }

  function drawWorld(s, dt, t, opts) {
    const target = targetCam(s);
    const follow = 1 - Math.exp(-dt * 10);
    camX += (target.x - camX) * follow; camY += (target.y - camY) * follow;
    shake = Math.max(0, shake - dt * 1.6); flash = Math.max(0, flash - dt * 5);
    squash *= Math.exp(-dt * 14);

    const shx = shake ? (Math.random() - 0.5) * shake * 0.5 : 0, shy = shake ? (Math.random() - 0.5) * shake * 0.5 : 0;
    camX += shx; camY += shy;

    ctx.fillStyle = theme.air;
    ctx.fillRect(0, 0, cw, ch);
    const mt = s.mirror ? -1 : 1, rt = s.rot ? 1 : 0;
    mirrorK += Math.sign(mt - mirrorK) * Math.min(Math.abs(mt - mirrorK), dt * 8);
    rotK += Math.sign(rt - rotK) * Math.min(Math.abs(rt - rotK), dt * 2.5);
    ctx.save();
    if (mirrorK !== 1 || rotK) {
      ctx.translate(cw / 2, ch / 2);
      if (rotK) ctx.rotate(Math.PI * (rotK * rotK * (3 - 2 * rotK)));
      if (mirrorK !== 1) ctx.scale(Math.abs(mirrorK) < 0.04 ? 0.04 * Math.sign(mirrorK || 1) : mirrorK, 1);
      ctx.translate(-cw / 2, -ch / 2);
    }

    // static tiles, merged into runs per row
    const x0 = Math.floor(camX) - 1, x1 = Math.ceil(camX + cw / scale) + 1;
    const y0 = Math.floor(camY) - 1, y1 = Math.ceil(camY + ch / scale) + 1;
    ctx.fillStyle = theme.solid;
    for (let cy = y0; cy <= y1; cy++) {
      let run = null;
      for (let cx = x0; cx <= x1 + 1; cx++) {
        const solid = cx <= x1 && cellAt(s, cx, cy) === SOLID;
        if (solid && run === null) run = cx;
        if (!solid && run !== null) { ctx.fillRect(X(run), Y(cy), X(cx) - X(run), Y(cy + 1) - Y(cy)); run = null; }
      }
    }
    for (let cy = Math.max(0, y0); cy <= Math.min(L.h - 1, y1); cy++) {
      for (let cx = Math.max(0, x0); cx <= Math.min(L.w - 1, x1); cx++) {
        const c = s.grid[cy * L.w + cx];
        if (isSpike(c)) spikeShape(cx, cy, c);
      }
    }
    for (const k of s.spikes) if (!k.inv) spikeShape(k.x, k.y, k.dir, k.k);

    // moving blocks (and their spikes)
    for (const m of s.movers) {
      if (m.gone) continue;
      let ox = m.ox, oy = m.oy;
      if (m.kind === 'fall' && m.wait > 0) { ox += (Math.random() - 0.5) * 0.12; oy += (Math.random() - 0.5) * 0.06; }
      for (const [cx, cy] of m.cells) ctx.fillRect(X(cx + ox), Y(cy + oy), X(cx + ox + 1) - X(cx + ox), Y(cy + oy + 1) - Y(cy + oy));
      for (const [cx, cy, dir] of m.spikeCells) spikeShape(cx + ox, cy + oy, dir);
    }

    // where you died this level
    ctx.strokeStyle = theme.ink; ctx.globalAlpha = 0.22; ctx.lineWidth = Math.max(1, scale * 0.07);
    for (const [mx, my] of deathMarks) {
      const r = 0.16;
      ctx.beginPath(); ctx.moveTo(X(mx - r), Y(my - r)); ctx.lineTo(X(mx + r), Y(my + r)); ctx.moveTo(X(mx + r), Y(my - r)); ctx.lineTo(X(mx - r), Y(my + r)); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    flagWave = Math.max(0, flagWave - dt * 0.8);
    for (const f of L.flags) drawFlag(f.x, f.y, t);
    for (const f of L.fakeDoors) drawDoor(f.x, f.y, false, t, s.cause === 'bite' ? 1 : 0);
    const d = s.door;
    drawDoor(d.x, d.y, d.x !== d.tx || d.y !== d.ty, t);

    ctx.fillStyle = theme.solid;
    for (const b of s.balls) {
      ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), b.r * scale, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = theme.air; ctx.lineWidth = Math.max(1, scale * 0.06);
    for (const b of s.balls) {
      const a = b.x / b.r; // rolls as it moves
      ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), b.r * scale * 0.55, a, a + 1.2); ctx.stroke();
    }

    // your corpses: the solid blocks where you died, drawn as you, flat out
    for (const [cx, cy] of s.corpses) drawCorpse(cx, cy);
    if (s.gpos) drawGhost(s, t);
    if (s.status !== 'dead' && !opts.hidePlayer) drawPlayer(s, t);

    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.vy += 30 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5);
      ctx.fillStyle = q.color;
      const sz = q.size * scale;
      ctx.fillRect(X(q.x) - sz / 2, Y(q.y) - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    if (s.dark) { // lights out: only a circle around the runner
      const cx = X(s.p.x + PLAYER_W / 2), cy = Y(s.p.y + PLAYER_H / 2), r = s.dark * scale;
      const g = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
      g.addColorStop(0, 'rgba(4,4,10,0)'); g.addColorStop(1, 'rgba(4,4,10,0.97)');
      ctx.fillStyle = g;
      ctx.fillRect(-cw, -ch, cw * 3, ch * 3);
    }
    ctx.restore();

    if (flash > 0) { ctx.fillStyle = theme.solid; ctx.globalAlpha = flash * 0.18; ctx.fillRect(0, 0, cw, ch); ctx.globalAlpha = 1; }
    camX -= shx; camY -= shy;
  }

  // CSS px position of a point in the level (for placing DOM toasts near things)
  const toScreen = (tx, ty) => [((tx - camX) * scale) / dpr, ((ty - camY) * scale) / dpr];

  return {
    resize, setLevel, draw, onEvent, toScreen,
    setInsets(v) { insets = v; if (L) fit(false); },
    clearMarks() { deathMarks = []; },
    get marks() { return deathMarks; },
    set marks(v) { deathMarks = v; },
  };
}
