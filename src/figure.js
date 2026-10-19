// The runner as a posable figure, for its reactions: dancing, a slow clap, a shrug and a facepalm. Shared by the
// in-game renderer and the little stage on the result card. Coordinates are in the figure's own units: feet at
// (0, 0), up is negative, about 1 tall (the same proportions as the running figure in render.js).
const TAU = Math.PI * 2;

// A pose at time t (seconds): where the hands and feet are, how far the body is lifted, the head's tilt, and
// any effect to draw (clap sparks).
export function pose(kind, t) {
  switch (kind) {
    case 'party': { // jumping on the spot with both arms up, waving
      const hop = Math.abs(Math.sin(t * 5.5)), w = Math.sin(t * 11) * 0.06;
      return { lift: hop * 0.32, tilt: Math.sin(t * 5.5) * 0.12, hands: [[-0.22 + w, -0.98], [0.22 - w, -0.98]], feet: hop > 0.2 ? [[-0.12, -0.08], [0.14, -0.1]] : [[-0.08, 0], [0.08, 0]] };
    }
    case 'clap': { // a slow, deliberate clap, hands meeting in front of the chest
      const open = 0.5 + 0.5 * Math.cos(t * TAU * 0.9), d = 0.03 + 0.24 * open;
      return { lift: 0, tilt: -0.05, hands: [[-d, -0.4], [d, -0.4]], feet: [[-0.07, 0], [0.07, 0]], spark: open < 0.06, clapAt: [0, -0.4] };
    }
    case 'shrug': { // palms up, shoulders bobbing
      const b = 0.03 * Math.sin(t * 4);
      return { lift: 0, tilt: 0.18, shoulders: 0.04 + b, hands: [[-0.3, -0.56 - b], [0.3, -0.56 - b]], feet: [[-0.07, 0], [0.07, 0]] };
    }
    case 'facepalm': { // one hand over the face, the other limp, head down
      return { lift: 0, tilt: 0.28, slump: 0.04, hands: [[0.09, -0.7], [-0.16, -0.28]], feet: [[-0.07, 0], [0.07, 0]] };
    }
    default:
      return { lift: 0, tilt: 0, hands: [[-0.2, -0.3], [0.2, -0.3]], feet: [[-0.06, 0], [0.06, 0]] };
  }
}

// Draws the figure. The canvas transform must already put the feet at (0, 0) in figure units (scale and flip
// before calling). ink: the body colour; eye: the eye colour (usually the background).
export function drawFigure(ctx, p, ink, eye, face = 1) {
  const lift = p.lift || 0, slump = p.slump || 0, sh = p.shoulders || 0;
  ctx.save();
  ctx.scale(face, 1);
  ctx.translate(0, -lift);
  ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // legs: hips to feet
  ctx.lineWidth = 0.09;
  ctx.beginPath();
  ctx.moveTo(-0.05, -0.26); ctx.lineTo(p.feet[0][0], p.feet[0][1] + lift * 0);
  ctx.moveTo(0.05, -0.26); ctx.lineTo(p.feet[1][0], p.feet[1][1]);
  ctx.stroke();
  // body
  ctx.beginPath(); ctx.roundRect(-0.14, -0.56 + slump, 0.28, 0.34 - slump, 0.09); ctx.fill();
  // head, tilted, and the eye (closed and happy when partying)
  ctx.save();
  ctx.translate(0, -0.68 + slump);
  ctx.rotate(p.tilt || 0);
  ctx.beginPath(); ctx.arc(0, 0, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = eye; ctx.strokeStyle = eye; ctx.lineWidth = 0.03;
  if (p.lift > 0.05 || p.spark) { ctx.beginPath(); ctx.arc(0.07, -0.01, 0.035, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(0.07, -0.02, 0.035, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // arms: shoulder, a bent elbow, hand; drawn last with a thin outline in the eye colour, so a hand crossing the
  // body or the face still reads
  for (const [pass, width] of [[eye, 0.13], [ink, 0.07]]) {
    ctx.strokeStyle = pass; ctx.fillStyle = pass; ctx.lineWidth = width;
    for (const [i, sx] of [[0, -0.1], [1, 0.1]]) {
      const [hx, hy] = p.hands[i], shy = -0.49 - sh + slump;
      const ex = (sx + hx) / 2 + (hx < sx ? -0.06 : 0.06), ey = (shy + hy) / 2 + 0.05;
      ctx.beginPath(); ctx.moveTo(sx, shy); ctx.quadraticCurveTo(ex, ey, hx, hy); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hy, width === 0.07 ? 0.05 : 0.08, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (p.spark) { // clap!
    const [cx, cy] = p.clapAt || [0, -0.42];
    for (const [pass, width] of [[eye, 0.07], [ink, 0.035]]) { // out to the sides, outlined like the arms
      ctx.strokeStyle = pass; ctx.lineWidth = width;
      for (const a of [-2, -1.5, -1, 1, 1.5, 2]) {
        ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * 0.13, cy - Math.cos(a) * 0.13); ctx.lineTo(cx + Math.sin(a) * 0.25, cy - Math.cos(a) * 0.25); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// The little stage on the result card: the runner reacting on a strip of floor, with confetti when partying.
export function createStage(canvas) {
  const ctx = canvas.getContext('2d');
  let raf = 0, kind = 'party', theme = null, t0 = 0;
  const bits = [];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(now) {
    const t = (now - t0) / 1000, dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const floor = h - 10, size = h * 0.72;
    ctx.fillStyle = theme.solid; ctx.fillRect(w * 0.2, floor, w * 0.6, 10);
    if (kind === 'party' && !still && Math.random() < 0.5) bits.push({ x: w / 2 + (Math.random() - 0.5) * w * 0.7, y: -6, vx: (Math.random() - 0.5) * 30, vy: 20 + Math.random() * 40, c: [theme.door, theme.solid, theme.ink][Math.floor(Math.random() * 3)], r: Math.random() * 6 });
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]; b.x += b.vx / 60; b.y += b.vy / 60; b.r += 0.1;
      if (b.y > floor) { bits.splice(i, 1); continue; }
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-3, -1.5, 6, 3); ctx.restore();
    }
    ctx.save();
    ctx.translate(w / 2, floor);
    ctx.scale(size, size);
    drawFigure(ctx, pose(kind, still ? 0.4 : t), theme.ink, theme.air);
    ctx.restore();
    if (!still) raf = requestAnimationFrame(frame);
  }
  return {
    play(k, th) { kind = k; theme = th; bits.length = 0; cancelAnimationFrame(raf); t0 = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { cancelAnimationFrame(raf); },
  };
}
