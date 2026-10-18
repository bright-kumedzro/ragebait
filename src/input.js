// Keyboard and touch, merged into one { l, r, j } the sim reads each step.
// Touch: the part of the screen around the arrow buttons steers (left of the split moves left, right of it moves
// right; slide your thumb across to switch) and the rest jumps. With "swap", the arrows and jump trade sides.
const keys = new Set();
const touches = new Map(); // pointerId → 'l' | 'r' | 'j'
let swap = false;
const pads = {};

const KEYMAP = {
  ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r',
  Space: 'j', ArrowUp: 'j', KeyW: 'j', KeyZ: 'j', KeyK: 'j',
};

export function initInput(stage, { onKey, onTouch } = {}) {
  pads.l = document.getElementById('padL'); pads.r = document.getElementById('padR'); pads.j = document.getElementById('padJ');
  window.addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea')) return;
    const k = KEYMAP[e.code];
    if (k) { keys.add(k); e.preventDefault(); }
    onKey?.(e);
  });
  window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
  window.addEventListener('blur', () => { keys.clear(); touches.clear(); paint(); });

  // The split between left and right sits halfway between the two arrow buttons; the steering zone reaches a
  // thumb's width past the outer button, and everything beyond it jumps.
  const zone = e => {
    const w = window.innerWidth, x = e.clientX;
    const a = pads.l?.getBoundingClientRect(), b = pads.r?.getBoundingClientRect();
    const mid = a?.width ? (a.left + a.right + b.left + b.right) / 4 : swap ? w - 110 : 110;
    const reach = a?.width ? Math.max(b.right, a.right) - Math.min(a.left, b.left) : 220;
    const half = Math.min(w * 0.25, reach / 2 + 70); // from the split to the zone's inner edge
    if (Math.abs(x - mid) > half && (swap ? x < mid : x > mid)) return 'j';
    return x < mid ? 'l' : 'r';
  };
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    touches.set(e.pointerId, zone(e));
    stage.setPointerCapture?.(e.pointerId);
    onTouch?.(); paint();
    e.preventDefault();
  });
  stage.addEventListener('pointermove', e => {
    if (!touches.has(e.pointerId)) return;
    const was = touches.get(e.pointerId);
    if (was === 'j') return; // a jump thumb that drifts stays a jump
    const now = zone(e);
    if (now !== 'j' && now !== was) { touches.set(e.pointerId, now); paint(); }
  });
  const up = e => { if (touches.delete(e.pointerId)) paint(); };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('contextmenu', e => e.preventDefault());
}

function paint() {
  const on = new Set(touches.values());
  for (const k of ['l', 'r', 'j']) pads[k]?.classList.toggle('on', on.has(k));
}

export function readInput() {
  const t = new Set(touches.values());
  return { l: keys.has('l') || t.has('l'), r: keys.has('r') || t.has('r'), j: keys.has('j') || t.has('j') };
}

export function clearInput() { keys.clear(); touches.clear(); paint(); }
export function setSwap(v) { swap = v; document.body.classList.toggle('swap', v); }
