// Draws the sim state on a 2D canvas: flat two-colour levels in the chapter's palette, a tiny runner, and the
// particles and screen shake that sell every death. Nothing here changes the sim.
import { PLAYER_W, PLAYER_H } from './config.js';
import { SOLID, SPIKE_U, SPIKE_D, SPIKE_R, SPRING, isSpike, springBase } from './sim.js';
import { pose, drawFigure } from './figure.js';

const MAX_DPR = 2;
const VIEW_W = 34, VIEW_H = 15; // at most this many tiles across and down; bigger levels scroll

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
  let now = 0, doorLaugh = 0, mood = null; // the door cackles until doorLaugh; mood: { kind, until } for the runner
  let haT = 0;
  const springT = new Map();           // when each spring last fired, for its bounce
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
      const px = s ? s.p.x + s.pw / 2 : L.start.x;
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

  // A door's face: 'laugh' (eyes shut, mouth open) while it runs off or you hit it locked, 'grin' on a fake door
  // you're about to touch.
  function drawFace(x, y, kind, t) {
    const lw = Math.max(1.5, scale * 0.06);
    ctx.strokeStyle = theme.ink; ctx.fillStyle = theme.ink; ctx.lineWidth = lw; ctx.lineCap = 'round';
    for (const ex of [0.27, 0.53]) {
      ctx.beginPath();
      if (kind === 'laugh') ctx.arc(X(x + ex), Y(y + 0.42), scale * 0.07, Math.PI * 1.15, Math.PI * 1.85);
      else { ctx.moveTo(X(x + ex - 0.07), Y(y + 0.36)); ctx.lineTo(X(x + ex + 0.07), Y(y + 0.42)); } // sly brows
      ctx.stroke();
      if (kind !== 'laugh') { ctx.beginPath(); ctx.arc(X(x + ex), Y(y + 0.47), Math.max(1, scale * 0.035), 0, Math.PI * 2); ctx.fill(); }
    }
    if (kind === 'laugh') {
      const o = 0.12 + Math.abs(Math.sin(t * 18)) * 0.1;
      ctx.beginPath(); ctx.ellipse(X(x + 0.4), Y(y + 0.74), scale * 0.17, scale * o, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(X(x + 0.4), Y(y + 0.62), scale * 0.17, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    }
  }

  function drawDoor(x, y, moving, t, open = 0, face = '') {
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
    if (face && !open) drawFace(x, y - bob, face, t);
    if (moving) { // little legs
      ctx.strokeStyle = theme.ink; ctx.lineWidth = Math.max(1, scale * 0.07); ctx.lineCap = 'round';
      const ph = Math.sin(t * 22) * 0.12;
      ctx.beginPath();
      ctx.moveTo(X(x + 0.25), Y(y + h - bob)); ctx.lineTo(X(x + 0.25 + ph), Y(y + h + 0.1));
      ctx.moveTo(X(x + 0.55), Y(y + h - bob)); ctx.lineTo(X(x + 0.55 - ph), Y(y + h + 0.1));
      ctx.stroke();
    }
  }

  // a key, bobbing; fake ones look exactly the same
  function drawKey(x, y, t) {
    const b = Math.sin(t * 3 + x) * 0.07, lw = Math.max(1.5, scale * 0.07);
    ctx.save();
    ctx.translate(X(x), Y(y + b));
    ctx.rotate(-0.5);
    ctx.lineWidth = lw; ctx.strokeStyle = theme.ink; ctx.fillStyle = theme.door;
    const r = scale * 0.17;
    ctx.beginPath(); ctx.rect(-scale * 0.02, -scale * 0.05, scale * 0.36, scale * 0.1); ctx.fill(); ctx.stroke(); // shaft
    ctx.beginPath(); ctx.rect(scale * 0.2, scale * 0.04, scale * 0.07, scale * 0.11); ctx.rect(scale * 0.09, scale * 0.04, scale * 0.06, scale * 0.08); ctx.fill(); ctx.stroke(); // teeth
    ctx.beginPath(); ctx.arc(-r, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // bow
    ctx.beginPath(); ctx.arc(-r, 0, r * 0.4, 0, Math.PI * 2); ctx.fillStyle = theme.ink; ctx.fill();
    ctx.restore();
  }

  function drawLock(x, y) {
    const w = 0.32, h = 0.26, lw = Math.max(1.5, scale * 0.06);
    ctx.strokeStyle = theme.ink; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(X(x), Y(y - h / 2), (w / 2.6) * scale, Math.PI, 0); ctx.stroke(); // shackle
    ctx.fillStyle = theme.ink;
    ctx.fillRect(X(x - w / 2), Y(y - h / 2), X(x + w / 2) - X(x - w / 2), Y(y + h / 2) - Y(y - h / 2));
    ctx.fillStyle = theme.door;
    ctx.beginPath(); ctx.arc(X(x), Y(y), Math.max(1, scale * 0.04), 0, Math.PI * 2); ctx.fill();
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
    // standing still while a reaction is on: the posed figure instead of the running one
    const pw = s.pw || PLAYER_W, ph = s.ph || PLAYER_H, k = ph / PLAYER_H; // k: the 'size' trap
    if (mood && t < mood.until && p.ground && Math.abs(p.vx) < 0.4) {
      ctx.save();
      ctx.translate(X(p.x + pw / 2), Y(g > 0 ? p.y + ph : p.y));
      ctx.scale(scale * k * lastFace, scale * k * g);
      drawFigure(ctx, pose(mood.kind, t), theme.ink, theme.air);
      ctx.restore();
      return;
    }
    const face = p.vx > 0.3 ? 1 : p.vx < -0.3 ? -1 : lastFace;
    lastFace = face;
    const fx = p.x + pw / 2, fy = g > 0 ? p.y + ph : p.y;
    const sq = squash; // >0 squashed (landing), <0 stretched (jumping)
    const sx = 1 + sq * 0.35, sy = 1 - sq * 0.35;
    ctx.save();
    ctx.translate(X(fx), Y(fy));
    ctx.scale(scale * k * sx * face, scale * k * sy * g);
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

  // a buzzsaw: a toothed disc, spinning
  function drawSaw(w, t) {
    const n = 12, r = w.r, a0 = t * 14;
    ctx.fillStyle = theme.solid;
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = a0 + (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r : r * 0.8;
      const x = X(w.x + Math.cos(a) * rr), y = Y(w.y + Math.sin(a) * rr);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = theme.air;
    ctx.beginPath(); ctx.arc(X(w.x), Y(w.y), r * 0.22 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = theme.air; ctx.lineWidth = Math.max(1, scale * 0.05);
    ctx.beginPath(); ctx.arc(X(w.x), Y(w.y), r * 0.5 * scale, a0, a0 + 1.4); ctx.stroke();
  }

  // a bounce pad: a plate on a coil, squashed for a moment after it throws you
  function drawSpring(cx, cy, b, t) {
    const since = t - (springT.get(cy * L.w + cx) ?? -9), squash = since < 0.18 ? 0.35 + since * 2 : 1;
    const base = b > 0 ? cy + 1 : cy, dir = -b, h = 0.42 * squash; // dir: which way is "up" from the base
    const yAt = d => Y(base + dir * d);
    ctx.fillStyle = theme.solid;
    ctx.fillRect(X(cx + 0.12), Math.min(yAt(0), yAt(0.08)), X(cx + 0.88) - X(cx + 0.12), Math.abs(yAt(0.08) - yAt(0)));
    ctx.strokeStyle = theme.solid; ctx.lineWidth = Math.max(1.5, scale * 0.07); ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) ctx.lineTo(X(cx + (i % 2 ? 0.7 : 0.3)), yAt(0.08 + (h - 0.08) * (i / 4)));
    ctx.stroke();
    ctx.fillStyle = theme.door;
    ctx.fillRect(X(cx + 0.06), Math.min(yAt(h), yAt(h + 0.12)), X(cx + 0.94) - X(cx + 0.06), Math.abs(yAt(h + 0.12) - yAt(h)));
  }

  function drawCoin(x, y, t) {
    const w = Math.abs(Math.cos(t * 3 + x)) * 0.22 + 0.03, b = Math.sin(t * 4 + x) * 0.05;
    ctx.fillStyle = theme.door; ctx.strokeStyle = theme.ink; ctx.lineWidth = Math.max(1, scale * 0.05);
    ctx.beginPath(); ctx.ellipse(X(x), Y(y + b), w * scale, 0.25 * scale, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  function drawLever(v, on) {
    const bx = v.x + 0.5, by = v.y + 1, a = on ? 0.65 : -0.65;
    ctx.strokeStyle = theme.ink; ctx.lineWidth = Math.max(1.5, scale * 0.08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(X(bx), Y(by - 0.15)); ctx.lineTo(X(bx + Math.sin(a) * 0.6), Y(by - 0.15 - Math.cos(a) * 0.6)); ctx.stroke();
    ctx.fillStyle = theme.door;
    ctx.beginPath(); ctx.arc(X(bx + Math.sin(a) * 0.6), Y(by - 0.15 - Math.cos(a) * 0.6), scale * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = theme.solid;
    ctx.fillRect(X(v.x + 0.2), Y(by - 0.22), X(v.x + 0.8) - X(v.x + 0.2), Y(by) - Y(by - 0.22));
  }

  // both ends of a pair share a colour (door, then ink, then solid), so you can tell which goes where
  function drawPortal(cx, cy, t, pair, end) {
    const x = X(cx + 0.5), y = Y(cy + 0.2), k = pair * 2 + end;
    ctx.lineWidth = Math.max(2, scale * 0.12); ctx.strokeStyle = [theme.door, theme.ink, theme.solid][pair % 3];
    ctx.beginPath(); ctx.ellipse(x, y, scale * 0.38, scale * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = pair % 3 === 1 ? theme.door : theme.ink; ctx.lineWidth = Math.max(1, scale * 0.05);
    for (let i = 0; i < 3; i++) { // swirling dots
      const a = t * (k % 2 ? -3 : 3) + i * 2.1;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * scale * 0.2, y + Math.sin(a) * scale * 0.5, Math.max(1, scale * 0.05), 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawBomb(b, t) {
    const pulse = 1 + Math.max(0, 0.6 - b.t) * Math.abs(Math.sin(t * 30)) * 0.4, r = 0.32 * pulse;
    ctx.fillStyle = theme.ink;
    ctx.beginPath(); ctx.arc(X(b.x), Y(b.y + 0.18), r * scale, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = theme.ink; ctx.lineWidth = Math.max(1, scale * 0.05);
    ctx.beginPath(); ctx.moveTo(X(b.x + 0.15), Y(b.y - 0.08)); ctx.quadraticCurveTo(X(b.x + 0.3), Y(b.y - 0.35), X(b.x + 0.42), Y(b.y - 0.3)); ctx.stroke();
    ctx.fillStyle = theme.door;
    ctx.beginPath(); ctx.arc(X(b.x + 0.42), Y(b.y - 0.3), scale * (0.07 + Math.random() * 0.05), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = theme.ink; ctx.textAlign = 'center';
    ctx.font = `${Math.round(scale * 0.5)}px Bungee, Impact, sans-serif`;
    ctx.fillText(Math.ceil(b.t), X(b.x), Y(b.y - 0.55));
  }

  function drawSign(x, y, text) {
    const fs = Math.max(8, Math.round(scale * 0.3));
    ctx.font = `${fs}px Bungee, Impact, sans-serif`;
    const tw = ctx.measureText(text).width + fs * 0.9, bx = X(x + 0.5) - tw / 2, by = Y(y + 0.05), bh = fs * 1.5;
    ctx.fillStyle = theme.solid;
    ctx.fillRect(X(x + 0.45), by + bh, Math.max(2, X(x + 0.55) - X(x + 0.45)), Y(y + 1) - by - bh);
    ctx.fillStyle = theme.door; ctx.strokeStyle = theme.solid; ctx.lineWidth = Math.max(1, scale * 0.05);
    ctx.beginPath(); ctx.roundRect(bx, by, tw, bh, fs * 0.2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = theme.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, X(x + 0.5), by + bh / 2 + fs * 0.05);
    ctx.textBaseline = 'alphabetic';
  }

  // the lava: the hazard colour, with a glowing, rolling surface and bubbles
  function drawLava(s, t) {
    const top = s.lava, sx0 = camX - 1, sx1 = camX + cw / scale + 1;
    ctx.fillStyle = theme.solid;
    ctx.beginPath(); ctx.moveTo(X(sx0), Y(L.h + 20));
    for (let x = sx0; x <= sx1; x += 0.25) ctx.lineTo(X(x), Y(top + Math.sin(x * 1.7 + t * 3) * 0.08));
    ctx.lineTo(X(sx1), Y(L.h + 20)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = theme.door; ctx.lineWidth = Math.max(2, scale * 0.1);
    ctx.beginPath();
    for (let x = sx0; x <= sx1; x += 0.25) ctx.lineTo(X(x), Y(top + Math.sin(x * 1.7 + t * 3) * 0.08));
    ctx.stroke();
    ctx.fillStyle = theme.door;
    for (let i = 0; i < 6; i++) {
      const bx = Math.floor(camX) + ((i * 7.3 + Math.floor(t * 0.7 + i) * 3.1) % (cw / scale)), ph = (t * 0.7 + i * 0.37) % 1;
      ctx.globalAlpha = 1 - ph;
      ctx.beginPath(); ctx.arc(X(bx), Y(top + 0.5 - ph * 0.7), scale * 0.08, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
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
      case 'key': burst(ev.x, ev.y, 18, theme.door, 7, 0.7, 0.12); break;
      case 'locked': shake = Math.max(shake, 0.1); doorLaugh = now + 1.2; break;
      case 'spring': springT.set(ev.cy * L.w + ev.cx, now); squash = -0.6; burst(ev.x, ev.y, 6, theme.door, 4, 0.35, 0.1); break;
      case 'coin': burst(ev.x, ev.y, 10, theme.door, 5, 0.5, 0.1); break;
      case 'lever': burst(ev.x, ev.y, 8, theme.door, 4, 0.4, 0.1); break;
      case 'warp': burst(ev.x, ev.y, 14, theme.door, 6, 0.5, 0.12); burst(ev.tx, ev.ty, 14, theme.door, 6, 0.5, 0.12); break;
      case 'wrap': burst(ev.x, ev.y + 0.2, 8, theme.solid, 4, 0.4, 0.1); break;
      case 'boom':
        shake = Math.max(shake, 0.7); flash = Math.max(flash, 0.8);
        burst(ev.x, ev.y, 40, theme.solid, 14, 0.9, 0.2); burst(ev.x, ev.y, 24, theme.door, 10, 0.7, 0.16);
        break;
      case 'win': burst(ev.x, ev.y, 30, theme.door, 9, 1, 0.14); burst(ev.x, ev.y, 14, theme.ink, 7, 0.8, 0.1); break;
      case 'trap':
        if (ev.kind === 'fall') shake = Math.max(shake, 0.15);
        if (ev.kind === 'door') doorLaugh = now + 2.2;
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
    now = t;
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
    for (const w of s.saws) drawSaw(w, t); // behind the tiles, so one rising out of the floor is half hidden
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
        else if (c === SPRING) { drawSpring(cx, cy, springBase(L, s.grid, cx, cy), t); ctx.fillStyle = theme.solid; }
      }
    }
    // conveyor belts: chevrons running along the top of the group
    for (const [g, v] of s.belts) {
      if (!v) continue;
      const m = s.movers.find(q => q.g === g && !q.gone), off = ((now * v) % 1 + 1) % 1;
      ctx.fillStyle = theme.air; ctx.globalAlpha = 0.55;
      for (const [cx, cy] of L.groups[g].solid) {
        if (!m && s.grid[cy * L.w + cx] !== SOLID) continue;
        const gx = cx + (m ? m.ox : 0), gy = cy + (m ? m.oy : 0);
        for (const k of [0, 0.5]) {
          const x = gx + ((k + off) % 1), d = Math.sign(v) * 0.12;
          ctx.beginPath(); ctx.moveTo(X(x - d), Y(gy + 0.08)); ctx.lineTo(X(x + d), Y(gy + 0.18)); ctx.lineTo(X(x - d), Y(gy + 0.28)); ctx.closePath(); ctx.fill();
        }
      }
      ctx.globalAlpha = 1; ctx.fillStyle = theme.solid;
    }
    for (const k of s.spikes) if (!k.inv) spikeShape(k.x, k.y, k.dir, k.k);
    if (s.ice) { // a pale glaze along the top of every floor
      ctx.fillStyle = theme.air; ctx.globalAlpha = 0.45;
      for (let cy = Math.max(1, y0); cy <= Math.min(L.h - 1, y1); cy++) {
        for (let cx = Math.max(0, x0); cx <= Math.min(L.w - 1, x1); cx++) {
          if (s.grid[cy * L.w + cx] !== SOLID || s.grid[(cy - 1) * L.w + cx] === SOLID) continue;
          ctx.fillRect(X(cx), Y(cy + 0.06), X(cx + 1) - X(cx), Math.max(1, Y(cy + 0.14) - Y(cy + 0.06)));
          if ((cx * 7 + cy) % 3 === 0) ctx.fillRect(X(cx + 0.3), Y(cy + 0.22), X(cx + 0.55) - X(cx + 0.3), Math.max(1, Y(cy + 0.27) - Y(cy + 0.22)));
        }
      }
      ctx.globalAlpha = 1; ctx.fillStyle = theme.solid;
    }

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
    // signs and levers ride along on the floor under them when it moves or falls (and go with it)
    const carried = (x, y) => {
      const g = y + 1 < L.h ? L.cellGroup[(y + 1) * L.w + x] : '', m = g && s.movers.find(q => q.g === g);
      return !m ? [0, 0] : m.gone ? null : [m.ox, m.oy];
    };
    L.signs.forEach((g, i) => { const o = carried(g.x, g.y); if (o) drawSign(g.x + o[0], g.y + o[1], s.signs[i] ?? g.text); });
    L.portals.forEach(([a, b], k) => { drawPortal(a[0], a[1], t, k, 0); drawPortal(b[0], b[1], t, k, 1); });
    L.levers.forEach((v, i) => { const o = carried(v.x, v.y); if (o) drawLever({ x: v.x + o[0], y: v.y + o[1] }, s.levers[i]); });
    L.coins.forEach((c, i) => { if (!s.coins[i]) drawCoin(c.x, c.y, t); });
    for (const b of s.bombs) drawBomb(b, t);
    // a fake door grins once you're close enough that it's too late
    const pcx = s.p.x + s.pw / 2, pcy = s.p.y + s.ph / 2;
    for (const f of L.fakeDoors) drawDoor(f.x, f.y, false, t, s.cause === 'bite' ? 1 : 0, Math.hypot(f.x + 0.4 - pcx, f.y + 0.7 - pcy) < 1.3 ? 'grin' : '');
    const d = s.door, running = d.x !== d.tx || d.y !== d.ty;
    drawDoor(d.x, d.y, running, t, 0, running || t < doorLaugh ? 'laugh' : '');
    if ((running || t < doorLaugh) && t > haT) { // "HA" floating up from a laughing door
      haT = t + 0.32;
      parts.push({ x: d.x + 0.4 + (Math.random() - 0.5) * 0.6, y: d.y - 0.1, vx: (Math.random() - 0.5) * 1.5, vy: -3.5, life: 0.9, max: 0.9, color: theme.ink, size: 0.34, text: 'HA' });
    }
    if (s.got < s.keys.length) drawLock(d.x + 0.4, d.y + 0.62);
    for (const k of s.keys) if (!k.got) drawKey(k.x, k.y, t);
    for (const f of L.fakeKeys) drawKey(f.x, f.y, t);

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
    if (s.lava < L.h + 1.5) drawLava(s, t);

    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.vy += 30 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5);
      ctx.fillStyle = q.color;
      const sz = q.size * scale;
      if (q.text) { q.vy += -28 * dt; ctx.font = `bold ${Math.round(sz)}px Bungee, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(q.text, X(q.x), Y(q.y)); }
      else ctx.fillRect(X(q.x) - sz / 2, Y(q.y) - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    if (s.wind) { // streaks blowing across the view, faster and denser the stronger the wind
      const n = Math.min(40, 10 + Math.abs(s.wind) * 4), vw = cw / scale, vh = ch / scale, len = 0.6 + Math.abs(s.wind) * 0.12;
      ctx.strokeStyle = theme.ink; ctx.globalAlpha = 0.3; ctx.lineWidth = Math.max(1.5, scale * 0.05);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const sp = 6 + Math.abs(s.wind) * 3 + (i % 5);
        const fx = ((i * 0.618 * vw + now * sp) % (vw + 4)) - 2, wx = s.wind > 0 ? camX + fx : camX + vw - fx;
        const wy = camY + ((i * 0.377 * vh + Math.sin(now * 2 + i) * 0.3) % vh);
        ctx.moveTo(X(wx), Y(wy)); ctx.lineTo(X(wx - Math.sign(s.wind) * len), Y(wy));
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (s.dark) { // lights out: only a circle around the runner
      const cx = X(s.p.x + s.pw / 2), cy = Y(s.p.y + s.ph / 2), r = s.dark * scale;
      const g = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
      g.addColorStop(0, 'rgba(4,4,10,0)'); g.addColorStop(1, 'rgba(4,4,10,0.97)');
      ctx.fillStyle = g;
      ctx.fillRect(-cw, -ch, cw * 3, ch * 3);
    }
    ctx.restore();

    if (s.clock) {
      const left = Math.max(0, s.clock - s.t), fs = Math.round(Math.min(cw, ch) * 0.09);
      ctx.font = `${fs}px Bungee, Impact, sans-serif`; ctx.textAlign = 'center';
      ctx.fillStyle = left < 3 && Math.floor(left * 4) % 2 ? theme.solid : theme.ui || theme.ink;
      ctx.fillText(left.toFixed(1), cw / 2, insets.top * dpr + fs * 1.1);
    }
    if (flash > 0) { ctx.fillStyle = theme.solid; ctx.globalAlpha = flash * 0.18; ctx.fillRect(0, 0, cw, ch); ctx.globalAlpha = 1; }
    camX -= shx; camY -= shy;
  }

  // CSS px position of a point in the level (for placing DOM toasts near things)
  const toScreen = (tx, ty) => [((tx - camX) * scale) / dpr, ((ty - camY) * scale) / dpr];

  return {
    resize, setLevel, draw, onEvent, toScreen,
    setInsets(v) { insets = v; if (L) fit(false); },
    react(kind, seconds) { mood = { kind, until: now + seconds }; },
    clearMarks() { deathMarks = []; },
    get marks() { return deathMarks; },
    set marks(v) { deathMarks = v; },
  };
}
