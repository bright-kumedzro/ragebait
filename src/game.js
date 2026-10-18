// Game flow: menus, starting levels, running the sim at a fixed step, deaths, respawns, wins and saving.
import { STEP, RESPAWN_DELAY, CHAPTERS, TAUNTS, CLEAR_LINES, GAME_NAME } from './config.js';
import { LEVELS, CHAPTER_LEVELS, getLevel } from './levels/index.js';
import { createState, step, fireExternal } from './sim.js';
import { createRenderer } from './render.js';
import { initInput, readInput, clearInput, setSwap } from './input.js';
import { initAudio, applyAudio, suspendAudio, sound, setSong } from './audio.js';
import { save, persist, resetSave, levelSave, isUnlocked, nextUnplayed } from './save.js';
import * as ui from './ui.js';

const $ = id => document.getElementById(id);

let renderer, idx = 0, L = null, s = null;
let mode = 'menu';          // 'menu' | 'play' | 'pause' | 'done'
let acc = 0, last = 0, clock = 0, deadT = 0;
let runDeaths = 0, runTime = 0, lastTaunt = '';
let replaying = null;       // a list of inputs to play instead of the player's (the smoke test uses it)

const CAUSE_TAUNTS = {
  bite: ['That’s not a door.', 'It bites.', 'Doors don’t have teeth. Usually.'],
  crush: ['Flat.', 'Pancake.', 'Squish.'],
  fall: ['Mind the gap.', 'Down you go.', 'Gravity: 1, you: 0.'],
  ball: ['Bowled over.', 'Strike!'],
  trap: ['Nice try.', 'Did you really think…'],
};

export function boot() {
  const canvas = $('stage');
  renderer = createRenderer(canvas);
  ui.paintIcons();
  initInput(canvas, { onKey, onTouch: () => document.body.classList.add('touch') });
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  setSwap(save.settings.swap);
  window.addEventListener('resize', onResize);
  onResize();

  window.addEventListener('keydown', () => document.body.classList.add('kb'), { capture: true });
  window.addEventListener('pointerdown', () => document.body.classList.remove('kb'), { capture: true });
  const unlock = () => initAudio();
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => {
    suspendAudio(document.hidden);
    if (document.hidden && mode === 'play') pause();
  });

  wireButtons();
  loadLevel(nextUnplayed(), true);
  goTitle();
  last = performance.now();
  requestAnimationFrame(frame);

  // for the smoke test and debugging
  window.__rb = {
    get state() { return { mode, idx, id: LEVELS[idx].id, status: s.status, deaths: runDeaths, t: s.t, x: s.p.x, y: s.p.y }; },
    play: (i, inputs) => { startLevel(i); replaying = { inputs, at: 0 }; },
    start: i => startLevel(i),
  };
}

function onResize() {
  renderer.resize();
  renderer.setInsets({ top: 62 });
}

// ---------- levels ----------
function loadLevel(i, menu = false) {
  idx = i; L = getLevel(i);
  const ch = LEVELS[i].ch, th = CHAPTERS[ch].theme;
  ui.applyTheme(th);
  renderer.setLevel(L, th);
  setSong(ch);
  s = createState(L);
  if (menu) mode = 'menu';
}

function startLevel(i) {
  loadLevel(i);
  runDeaths = 0; runTime = 0; deadT = 0; acc = 0; replaying = null;
  mode = 'play';
  clearInput();
  for (const id of ['mdlPause', 'mdlResult']) ui.showModal(id, false);
  ui.showScreen(null);
  $('hud').hidden = false;
  document.body.classList.add('playing');
  $('btnFakeSkip').hidden = !L.fakeSkip;
  const lv = LEVELS[i];
  ui.hud(lv.id, lv.def.name, 0);
  ui.intro(lv.def.name, lv.def.hint || '');
  if (document.body.classList.contains('touch') && innerHeight > innerWidth && !save.tips.rotate) {
    save.tips.rotate = true; persist();
    ui.toast('Turn your phone sideways for a bigger view.', 3500);
  }
}

function respawn() {
  s = createState(L);
  deadT = 0; acc = 0;
  $('btnFakeSkip').hidden = !L.fakeSkip;
}

function restart() {
  if (mode === 'pause') resume();
  if (mode !== 'play') return;
  respawn();
}

// ---------- the loop ----------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; clock += dt;
  if (mode === 'play') {
    if (s.status === 'play') runTime += dt;
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      if (s.status === 'play') {
        let input = readInput();
        if (replaying) input = replaying.inputs[replaying.at++] || { l: 0, r: 0, j: 0 };
        step(L, s, input);
        drain();
      } else if (s.status === 'dead') {
        deadT += STEP;
        if (deadT >= RESPAWN_DELAY) respawn();
      } else if (s.status === 'won') { finish(); break; }
    }
  }
  renderer.draw(s, dt, clock);
}

function drain() {
  for (const ev of s.events) {
    renderer.onEvent(ev, s);
    switch (ev.e) {
      case 'jump': sound.jump(); save.stats.jumps++; break;
      case 'land': sound.land(); break;
      case 'bump': sound.bump(); break;
      case 'die': onDeath(ev.cause); break;
      case 'slam': sound.slam(); break;
      case 'pop': sound.pop(); break;
      case 'shoot': sound.shoot(); break;
      case 'bounce': sound.bounce(); break;
      case 'pop-spike': break;
      case 'bonk': sound.bonk(); break;
      case 'doorstop': break;
      case 'win': sound.win(); break;
      case 'trap':
        if (ev.kind === 'fall') sound.fall();
        else if (ev.kind === 'spikes') sound.spike();
        else if (ev.kind === 'door') sound.door();
        else if (ev.kind === 'flip') sound.flip();
        else if (ev.kind === 'reverse') sound.lol();
        else if (ev.kind !== 'move' && ev.kind !== 'balls') sound.trap();
        if (ev.say) ui.taunt(ev.say);
        break;
    }
  }
  s.events.length = 0;
}

function onDeath(cause) {
  sound.die();
  runDeaths++; save.deaths++;
  levelSave(LEVELS[idx].id).deaths++;
  persist();
  ui.bumpDeaths(runDeaths);
  if (save.settings.haptics && navigator.vibrate) navigator.vibrate(40);
  ui.hideIntro();
  const pool = CAUSE_TAUNTS[cause] && Math.random() < 0.45 ? CAUSE_TAUNTS[cause] : TAUNTS;
  let line;
  do line = pool[Math.floor(Math.random() * pool.length)]; while (line === lastTaunt && pool.length > 1);
  lastTaunt = line;
  ui.taunt(line);
}

function finish() {
  mode = 'done'; replaying = null;
  const lv = LEVELS[idx], ls = levelSave(lv.id);
  const firstClear = !ls.cleared;
  ls.cleared = true;
  ls.best = ls.best === null ? runDeaths : Math.min(ls.best, runDeaths);
  ls.time = ls.time === null ? runTime : Math.min(ls.time, runTime);
  save.stats.clears++; save.stats.seconds += runTime;
  persist();
  document.body.classList.remove('playing');

  const chLevels = CHAPTER_LEVELS[lv.ch].length, lastOfChapter = lv.i === chLevels - 1, lastOfGame = idx === LEVELS.length - 1;
  $('resEyebrow').textContent = `Level ${lv.id} cleared`;
  $('resTitle').textContent = lastOfGame ? 'You beat it. Somehow.' : lastOfChapter ? `${CHAPTERS[lv.ch].name}: done` : CLEAR_LINES.find(([n]) => runDeaths <= n)[1];
  $('resDeaths').textContent = runDeaths;
  $('resTime').textContent = runTime.toFixed(1);
  let note = '';
  if (lastOfGame) note = `${save.deaths.toLocaleString()} deaths in total. Tell your friends. Or don’t.`;
  else if (lastOfChapter) note = `Next up: ${CHAPTERS[lv.ch + 1].name}. ${CHAPTERS[lv.ch + 1].blurb}.`;
  else if (!firstClear && runDeaths <= ls.best) note = `Your best here: ${ls.best} ${ls.best === 1 ? 'death' : 'deaths'}.`;
  $('resNote').textContent = note;
  $('btnNext').hidden = lastOfGame;
  $('btnShare').hidden = !(lastOfChapter || lastOfGame);
  setTimeout(() => { if (mode === 'done') ui.showModal('mdlResult'); }, 650);
}

// ---------- menus ----------
function goTitle() {
  mode = 'menu';
  document.body.classList.remove('playing');
  $('hud').hidden = true;
  for (const id of ['mdlPause', 'mdlResult']) ui.showModal(id, false);
  ui.renderTitle();
  ui.showScreen('scrTitle');
  ui.hideIntro();
}

function goLevels() {
  mode = 'menu';
  document.body.classList.remove('playing');
  $('hud').hidden = true;
  for (const id of ['mdlPause', 'mdlResult']) ui.showModal(id, false);
  ui.renderLevels(idx, i => { sound.click(); startLevel(i); });
  ui.showScreen('scrLevels');
  ui.hideIntro();
}

function pause() {
  if (mode !== 'play') return;
  mode = 'pause';
  clearInput();
  document.body.classList.remove('playing');
  $('pauseSub').textContent = `Level ${LEVELS[idx].id} · ${runDeaths} ${runDeaths === 1 ? 'death' : 'deaths'} so far`;
  ui.renderPauseQuick(onSetting);
  ui.showModal('mdlPause');
}

function resume() {
  if (mode !== 'pause') return;
  ui.showModal('mdlPause', false);
  mode = 'play'; last = performance.now();
  document.body.classList.add('playing');
}

function next() {
  const n = idx + 1;
  if (n < LEVELS.length && isUnlocked(n)) startLevel(n);
  else goLevels();
}

async function share() {
  const text = `I beat ${GAME_NAME} ${idx === LEVELS.length - 1 ? '' : `chapter ${LEVELS[idx].ch + 1} `}with ${save.deaths.toLocaleString()} deaths. Your turn.`;
  const url = location.protocol.startsWith('http') ? location.origin + location.pathname : '';
  const full = url ? `${text} ${url}` : text;
  if (navigator.share) {
    try { await navigator.share({ title: GAME_NAME, text, url }); return; }
    catch (e) { if (e?.name === 'AbortError') return; } // closed the share sheet; anything else falls back to copying
  }
  try { await navigator.clipboard.writeText(full); ui.toast('Copied. Go ruin someone’s day.'); }
  catch { ui.toast(full, 6000); }
}

function onSetting(key) {
  persist();
  if (key === 'sound' || key === 'music') applyAudio();
  if (key === 'swap') setSwap(save.settings.swap);
  sound.click();
}

function onKey(e) {
  if (e.repeat) return;
  const k = e.code;
  if (mode === 'play') {
    if (k === 'Escape' || k === 'KeyP') pause();
    else if (k === 'KeyR') restart();
  } else if (mode === 'pause') {
    if (k === 'Escape' || k === 'KeyP') resume();
  } else if (mode === 'done' && !$('mdlResult').hidden) {
    if (k === 'Enter' || k === 'Space') { e.preventDefault(); if (!$('btnNext').hidden) next(); }
    else if (k === 'KeyR') startLevel(idx);
  } else if (mode === 'menu' && k === 'Escape' && $('scrTitle').hidden) goTitle();
}

function wireButtons() {
  const on = (id, fn) => $(id).addEventListener('click', () => { sound.click(); fn(); });
  on('btnPlay', () => startLevel(nextUnplayed()));
  on('btnLevels', goLevels);
  on('btnSettings', () => { ui.renderSettings(onSetting); ui.showScreen('scrSettings'); });
  for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => { sound.click(); goTitle(); });
  // a second tap within a few seconds confirms (no system dialog: they're blocked when the game is embedded)
  let resetArmed = 0;
  on('btnReset', () => {
    const b = $('btnReset');
    if (Date.now() - resetArmed > 4000) {
      resetArmed = Date.now(); b.textContent = 'Tap again to wipe everything';
      setTimeout(() => { if (Date.now() - resetArmed >= 4000) b.textContent = 'Reset progress'; }, 4100);
      return;
    }
    resetArmed = 0; b.textContent = 'Reset progress';
    resetSave(); setSwap(false); applyAudio(); ui.renderSettings(onSetting); loadLevel(0, true);
    ui.toast('Fresh start. The levels remember nothing. Unlike you.');
  });
  on('btnPause', pause);
  on('btnRestart', restart);
  on('btnResume', resume);
  on('btnPauseRestart', () => { resume(); restart(); });
  on('btnPauseLevels', goLevels);
  on('btnPauseHome', goTitle);
  on('btnReplay', () => startLevel(idx));
  on('btnResLevels', goLevels);
  on('btnNext', next);
  on('btnShare', share);
  on('btnFakeSkip', () => {
    if (mode !== 'play' || s.status !== 'play') return;
    $('btnFakeSkip').hidden = true;
    fireExternal(L, s, 'skip');
    drain();
  });
  $('logo').addEventListener('click', () => {
    const el = $('logo');
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    sound.lol();
  });
}
