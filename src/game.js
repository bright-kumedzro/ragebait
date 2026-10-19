// Game flow: menus, starting levels, running the sim at a fixed step, deaths, respawns, wins, challenges and saving.
import { STEP, RESPAWN_DELAY, CHAPTERS, TAUNTS, DEATH_MILESTONES, clearLine, GAME_NAME, CHALLENGE_LEVELS } from './config.js';
import { LEVELS, CHAPTER_LEVELS, getLevel, levelIndex } from './levels/index.js';
import { createState, step, fireExternal } from './sim.js';
import { createRenderer } from './render.js';
import { createStage } from './figure.js';
import { initInput, readInput, clearInput, setSwap } from './input.js';
import { initAudio, applyAudio, suspendAudio, sound, setSong } from './audio.js';
import { save, persist, resetSave, levelSave, isUnlocked, nextUnplayed } from './save.js';
import * as Compete from './compete.js';
import * as Metrics from './metrics.js';
import * as ui from './ui.js';

const $ = id => document.getElementById(id);

let renderer, stage, idx = 0, L = null, s = null;
let spots = []; // where the last few deaths happened, for the same-spot facepalm
let mode = 'menu';          // 'menu' | 'play' | 'pause' | 'done'
let acc = 0, last = 0, clock = 0, deadT = 0;
let runDeaths = 0, runTime = 0, lastTaunt = '';
let chal = null;            // while playing a challenge: { id, rec }
let replaying = null;       // inputs to play instead of the player's (the smoke test uses it)
const routes = {};          // level id -> inputs, played automatically whenever that level starts (smoke test)

// [line, sticker] by how you died; used about half the time, the rest come from TAUNTS
const CAUSE_TAUNTS = {
  bite: [['That’s not a door.', '🚪'], ['It bites.', '🦷'], ['Doors don’t have teeth. Usually.', '🦷'], ['Bro thought it was a door.', '🤦']],
  crush: [['Flat.', '🥞'], ['Pancake.', '🥞'], ['Squish.', '🫓'], ['Emotional damage.', '💔']],
  fall: [['Mind the gap.', '🕳️'], ['Down you go.', '⬇️'], ['Gravity: 1, you: 0.', '🍎'], ['The floor said no.', '🙅'], ['Bro thought he could jump that.', '🤦']],
  spike: [['Caught in 4K.', '📸'], ['Pointy and proud.', '📌'], ['Ouch.', '🩹']],
  ball: [['Bowled over.', '🎳'], ['Strike!', '🎳']],
  trap: [['Nice try.', '😏'], ['Did you really think…', '🤔']],
  fake: [['Just kidding.', '😜'], ['lol no.', '😂'], ['You really thought.', '🤡']],
  fakekey: [['That key had teeth.', '🦷'], ['Not that one.', '🔑'], ['That key was sus.', '🕵️']],
  ghost: [['Beaten by your past self.', '👻'], ['Character development? Not today.', '👻']],
};
// a sticker for the lines traps say when they go off
const TRAP_STICKER = {
  fall: '🕳️', spikes: '😈', door: '🏃', mirror: '🪞', rotate: '🙃', swap: '🎨', lag: '📶', dark: '🔦', reverse: '🔄',
  speed: '💨', flip: '🙃', keymove: '🏃', vanish: '🫥', reveal: '👀', balls: '💣', move: '😈', kill: '💀', say: '😏',
};
let fakesLeft = 0, faking = false, fakeCheckpoint = false; // chapter 4's fake wins and fake checkpoints
let corpses = [], path = [], lastPath = null, crashTimer = 0; // chapter 5: bodies you left, the ghost's route, the fake crash

// What a fresh attempt starts with: which try it is, last try's ghost, and the bodies so far.
const stateOpts = () => ({
  attempt: runDeaths + 1, corpses,
  ghost: L.ghost && lastPath ? { path: lastPath, delay: Math.round(L.ghost / STEP) } : null,
});

export function boot() {
  const canvas = $('stage');
  renderer = createRenderer(canvas);
  stage = createStage($('resReact'));
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
    if (!document.hidden) liveNudge?.(); // coming back refreshes a live challenge view straight away
    Metrics.flush(document.hidden);
  });

  wireButtons();
  loadLevel(nextUnplayed(), true);
  goTitle();
  last = performance.now();
  requestAnimationFrame(frame);
  Metrics.flush();

  const invite = new URLSearchParams(location.search).get('challenge');
  if (invite && Compete.available()) { history.replaceState(null, '', location.pathname); openChallenge(invite); }

  // for the smoke test and debugging
  window.__rb = {
    get state() { return { mode, idx, id: LEVELS[idx].id, status: s.status, deaths: runDeaths, t: s.t, x: s.p.x, y: s.p.y, chal: chal?.id || null, corpses: s.corpses.length, ghost: !!s.gpos, keys: s.got }; },
    play: (i, inputs) => { startLevel(i); replaying = { inputs, at: 0 }; },
    start: i => startLevel(i),
    routes: (map) => Object.assign(routes, map),
    feed: inputs => { replaying = { inputs, at: 0 }; },
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

// c: the challenge being played, if any. Its deaths and time so far on this level carry over, so leaving
// halfway and coming back doesn't wipe the slate.
function startLevel(i, c = null) {
  chal = c;
  loadLevel(i);
  runDeaths = c ? c.rec.cur.deaths : 0; runTime = c ? c.rec.cur.time : 0;
  corpses = []; path = []; lastPath = null; spots = []; hideCrash(); stage.stop();
  s = createState(L, stateOpts());
  fakesLeft = L.fakeWin; faking = false; fakeCheckpoint = false;
  deadT = 0; acc = 0;
  const lv = LEVELS[i];
  replaying = routes[lv.id] ? { inputs: routes[lv.id], at: 0 } : null;
  mode = 'play';
  clearInput();
  for (const id of ['mdlPause', 'mdlResult']) ui.showModal(id, false);
  ui.showScreen(null);
  $('hud').hidden = false;
  document.body.classList.add('playing');
  showButton();
  const label = c ? `Challenge ${c.rec.deaths.length + 1}/${CHALLENGE_LEVELS} · ${lv.def.name}` : lv.def.name;
  ui.hud(lv.id, label, runDeaths);
  ui.hudKeys(0, L.keys.length);
  ui.intro(lv.def.name, c ? `Challenge level ${c.rec.deaths.length + 1} of ${CHALLENGE_LEVELS}. Every death counts.` : lv.def.hint || '');
  if (document.body.classList.contains('touch') && innerHeight > innerWidth && !save.tips.rotate) {
    save.tips.rotate = true; persist();
    ui.toast('Turn your phone sideways for a bigger view.', 3500);
  }
}

function respawn() {
  s = createState(L, stateOpts());
  fakeCheckpoint = false; path = [];
  deadT = 0; acc = 0;
  hideCrash();
  showButton();
  ui.hudKeys(0, L.keys.length);
}

// The corner button: a fake "Skip level" (2-6), or "Don't press" (chapter 5), which you have to press.
function showButton() {
  const b = $('btnFakeSkip');
  b.hidden = !(L.fakeSkip || L.button);
  b.innerHTML = L.button ? ui.esc(L.button) : 'Skip level <span aria-hidden="true">▸▸</span>';
}

function showCrash(seconds = 3.5) {
  $('fakeCrash').hidden = false;
  clearTimeout(crashTimer);
  crashTimer = setTimeout(hideCrash, seconds * 1000);
}
function hideCrash() { clearTimeout(crashTimer); $('fakeCrash').hidden = true; }

function restart() {
  if (mode === 'pause') resume();
  if (mode !== 'play') return;
  respawn();
}

// keeps a challenge's in-progress level on the device (deaths are saved as they happen)
function saveChallengeTime() {
  if (!chal || mode === 'done') return;
  chal.rec.cur.time = runTime;
  persist();
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
        if (L.ghost) path.push(s.p.x, s.p.y);
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
      case 'die': onDeath(ev.cause, ev); break;
      case 'slam': sound.slam(); break;
      case 'pop': sound.pop(); break;
      case 'shoot': sound.shoot(); break;
      case 'bounce': sound.bounce(); break;
      case 'bonk': sound.bonk(); break;
      case 'win': sound.win(); break;
      case 'key':
        sound.check(); ui.hudKeys(s.got, s.keys.length); ui.bumpKeys();
        if (!ev.left) ui.taunt('Unlocked.', '🔓');
        break;
      case 'locked':
        sound.bump();
        ui.taunt(`Locked. ${ev.left} ${ev.left === 1 ? 'key' : 'keys'} to go.`, '🔒');
        break;
      case 'trap':
        if (ev.kind === 'fall') sound.fall();
        else if (ev.kind === 'spikes') { if (!ev.quiet) sound.spike(); }
        else if (ev.kind === 'checkpoint') { sound.check(); fakeCheckpoint = true; ui.taunt('Checkpoint saved!', '🚩'); }
        else if (ev.kind === 'speed' || ev.kind === 'mirror' || ev.kind === 'swap' || ev.kind === 'rotate') sound.flip();
        else if (ev.kind === 'lag' || ev.kind === 'auto') sound.lol();
        else if (ev.kind === 'dark') sound.bump();
        else if (ev.kind === 'crash') { sound.error(); showCrash(L.traps[ev.i].seconds); ui.taunt('This is fine.', '🔥'); }
        else if (ev.kind === 'door') sound.door();
        else if (ev.kind === 'flip') sound.flip();
        else if (ev.kind === 'reverse') sound.lol();
        else if (ev.kind !== 'move' && ev.kind !== 'balls') sound.trap();
        if (ev.say) ui.taunt(ev.say, TRAP_STICKER[ev.kind] || '');
        else if (ev.kind === 'dark' && L.traps[ev.i].radius) ui.taunt('Who turned off the lights? (It was me.)', '🔦');
        break;
    }
  }
  s.events.length = 0;
}

function onDeath(cause, ev) {
  sound.die();
  if (L.corpses && ev && corpses.length < 40) corpses.push([Math.floor(ev.x), Math.floor(ev.y)]);
  if (L.ghost) { lastPath = path; path = []; }
  runDeaths++; save.deaths++;
  levelSave(LEVELS[idx].id).deaths++;
  if (chal) { chal.rec.cur.deaths = runDeaths; chal.rec.cur.time = runTime; }
  persist();
  ui.bumpDeaths(runDeaths);
  if (save.settings.haptics && navigator.vibrate) navigator.vibrate(40);
  ui.hideIntro();
  const pool = cause === 'fake' ? CAUSE_TAUNTS.fake : CAUSE_TAUNTS[cause] && Math.random() < 0.5 ? CAUSE_TAUNTS[cause] : TAUNTS;
  let line;
  do line = pool[Math.floor(Math.random() * pool.length)]; while (line[0] === lastTaunt && pool.length > 1);
  // a few situations get their own line
  if (s.lag && Math.random() < 0.6) line = ['It’s not your Wi-Fi. It’s you.', '📶'];
  if (L.corpses && Math.random() < 0.4) line = ['It’s free real estate.', '🏚️'];
  if (fakeCheckpoint) line = ['What checkpoint?', '🚩'];
  // five deaths in a row in the same spot: the runner facepalms when it comes back
  if (ev) {
    spots = [...spots, [ev.x, ev.y]].slice(-5);
    const mx = spots.reduce((a, q) => a + q[0], 0) / spots.length, my = spots.reduce((a, q) => a + q[1], 0) / spots.length;
    if (spots.length === 5 && spots.every(q => Math.hypot(q[0] - mx, q[1] - my) < 1.6)) {
      line = ['Same spot. Again.', '🤦']; spots = [];
      renderer.react('facepalm', RESPAWN_DELAY + 1.8);
    }
  }
  if (DEATH_MILESTONES[save.deaths]) line = DEATH_MILESTONES[save.deaths];
  lastTaunt = line[0];
  ui.taunt(line[0], line[1]);
}

function finish() {
  mode = 'done'; replaying = null;
  document.body.classList.remove('playing');
  if (fakesLeft > 0) { fakesLeft--; fakeWin(); return; }
  if (chal) { challengeLevelDone(); return; }
  const lv = LEVELS[idx], ls = levelSave(lv.id);
  const firstClear = !ls.cleared;
  ls.cleared = true;
  ls.best = ls.best === null ? runDeaths : Math.min(ls.best, runDeaths);
  ls.time = ls.time === null ? runTime : Math.min(ls.time, runTime);
  save.stats.clears++; save.stats.seconds += runTime;
  persist();

  const chLevels = CHAPTER_LEVELS[lv.ch].length, lastOfChapter = lv.i === chLevels - 1, lastOfGame = idx === LEVELS.length - 1;
  $('resEyebrow').textContent = `Level ${lv.id} cleared`;
  $('resTitle').textContent = lastOfGame ? 'You beat it. Somehow. 🏆' : lastOfChapter ? `${CHAPTERS[lv.ch].name}: done 🎉` : clearLine(runDeaths);
  $('resDeaths').textContent = runDeaths;
  $('resTime').textContent = runTime.toFixed(1);
  let note = '';
  if (lastOfGame) note = `${save.deaths.toLocaleString()} deaths in total. Tell your friends. Or don’t.`;
  else if (lastOfChapter) note = `Next up: ${CHAPTERS[lv.ch + 1].name}. ${CHAPTERS[lv.ch + 1].blurb}.`;
  else if (!firstClear && runDeaths <= ls.best) note = `Your best here: ${ls.best} ${ls.best === 1 ? 'death' : 'deaths'}.`;
  $('resNote').textContent = note;
  $('btnNext').textContent = 'Next level';
  $('btnNext').hidden = lastOfGame;
  $('btnReplay').hidden = false; $('btnResLevels').hidden = false;
  $('btnShare').hidden = !(lastOfChapter || lastOfGame);
  showResult(runDeaths === 0 || lastOfChapter ? 'party' : runDeaths >= 10 ? 'clap' : 'shrug');
}

// Chapter 4: a result card that looks exactly like the real one. Whatever you press, it was a lie, and it counts
// as a death.
function fakeWin() {
  faking = true;
  const lv = LEVELS[idx];
  $('resEyebrow').textContent = chal ? `Challenge · level ${chal.rec.deaths.length + 1} of ${CHALLENGE_LEVELS}` : `Level ${lv.id} cleared`;
  $('resTitle').textContent = clearLine(runDeaths);
  $('resDeaths').textContent = runDeaths;
  $('resTime').textContent = runTime.toFixed(1);
  $('resNote').textContent = '';
  $('btnNext').textContent = 'Next level'; $('btnNext').hidden = false;
  $('btnReplay').hidden = !!chal; $('btnResLevels').hidden = !!chal; $('btnShare').hidden = true;
  showResult('party'); // it's fake, so make it a good one
}

// The result card, with the runner's reaction on its little stage: dancing, shrugging or a slow clap.
function showResult(kind) {
  setTimeout(() => {
    if (mode !== 'done') return;
    ui.showModal('mdlResult');
    const th = CHAPTERS[LEVELS[idx].ch].theme;
    stage.play(kind, { ...th, air: th.paper || th.air });
  }, 650);
}

function unfake() {
  faking = false;
  stage.stop();
  ui.showModal('mdlResult', false);
  mode = 'play'; last = performance.now();
  document.body.classList.add('playing');
  onDeath('fake');
  respawn();
}

// A challenge level is recorded straight away (so closing the game on the result card loses nothing). Beating it
// here doesn't count toward the campaign: it could unlock levels out of order.
function challengeLevelDone() {
  const rec = chal.rec;
  rec.deaths.push(runDeaths);
  rec.times.push(Math.round(runTime * 10) / 10);
  rec.cur = { deaths: 0, time: 0 };
  save.stats.clears++; save.stats.seconds += runTime;
  persist();
  const k = rec.deaths.length, done = Compete.finished(rec);
  const total = rec.deaths.reduce((a, b) => a + b, 0);
  $('resEyebrow').textContent = `Challenge · level ${k} of ${CHALLENGE_LEVELS}`;
  $('resTitle').textContent = done ? (total === 0 ? 'Flawless. Disgusting. 💅' : 'Survived. Barely. 😮‍💨') : clearLine(runDeaths);
  $('resDeaths').textContent = runDeaths;
  $('resTime').textContent = runTime.toFixed(1);
  const nextId = rec.levels[k];
  $('resNote').textContent = done ? `${total} ${total === 1 ? 'death' : 'deaths'} in total. Let’s see who won.`
    : `Next: ${nextId} · ${LEVELS[levelIndex(nextId)].def.name}`;
  $('btnNext').textContent = done ? 'See who won' : 'Next level';
  $('btnNext').hidden = false;
  $('btnReplay').hidden = true; $('btnResLevels').hidden = true; $('btnShare').hidden = true;
  showResult(done && total === 0 || runDeaths === 0 ? 'party' : runDeaths >= 10 ? 'clap' : 'shrug');
}

// ---------- menus ----------
function toMenu() {
  saveChallengeTime();
  mode = 'menu'; chal = null; replaying = null;
  document.body.classList.remove('playing');
  $('hud').hidden = true;
  for (const id of ['mdlPause', 'mdlResult']) ui.showModal(id, false);
  ui.hideIntro();
  chToken++; liveNudge = null; // stops any live challenge refresh
  hideCrash(); stage.stop();
}

function goTitle() {
  toMenu();
  ui.renderTitle();
  Compete.serverReady().then(ok => { $('btnCompete').hidden = !ok; });
  ui.showScreen('scrTitle');
  refreshCompeteBadge();
}

function goLevels() {
  toMenu();
  ui.renderLevels(idx, i => { sound.click(); startLevel(i); });
  ui.showScreen('scrLevels');
}

// byPlayer: the pause button or Esc, rather than the game going to the background
function pause(byPlayer = false) {
  if (mode !== 'play') return;
  if (byPlayer && L.noPause && s.status === 'play') { // the level that kills you for pausing
    fireExternal(L, s, 'pause'); drain();
    if (s.status !== 'play') return;
  }
  saveChallengeTime();
  mode = 'pause';
  clearInput();
  document.body.classList.remove('playing');
  const d = `${runDeaths} ${runDeaths === 1 ? 'death' : 'deaths'} so far`;
  $('pauseSub').textContent = chal ? `Challenge level ${chal.rec.deaths.length + 1} of ${CHALLENGE_LEVELS} · ${d}` : `Level ${LEVELS[idx].id} · ${d}`;
  $('btnPauseLevels').textContent = chal ? 'Leave challenge' : 'All levels';
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
  if (faking) { unfake(); return; }
  if (chal) {
    const c = chal;
    if (Compete.finished(c.rec)) openChallenge(c.id);
    else startLevel(levelIndex(c.rec.levels[c.rec.deaths.length]), c);
    return;
  }
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

// ---------- challenges ----------
let chToken = 0, liveNudge = null, picked = [], creating = false;

// Keeps a challenge view live: re-runs `refresh` (which resolves true when something changed) every few seconds
// while that screen is showing, easing off after a minute without news, and pausing while the game is hidden.
// Navigating away (which bumps chToken) or starting to play (which hides the screen) stops it.
const LIVE_FAST = 4000, LIVE_SLOW = 12000, LIVE_QUIET = 15;
function keepFresh(t, screenId, refresh) {
  let quiet = 0;
  const tick = async () => {
    if (t !== chToken || $(screenId).hidden) return;
    if (!document.hidden) quiet = (await refresh().catch(() => false)) ? 0 : quiet + 1;
    if (t === chToken) setTimeout(tick, quiet > LIVE_QUIET ? LIVE_SLOW : LIVE_FAST);
  };
  setTimeout(tick, LIVE_FAST);
}

const names = list => (list.length <= 2 ? list.join(' and ') : `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`);
function competeList(summaries = []) {
  const byId = Object.fromEntries(summaries.map(x => [x.id, x]));
  return Compete.recent().map(([id, rec]) => {
    const x = byId[id], k = rec.deaths.length;
    const others = !x || x.gone ? '' : x.joined.length ? `${names(x.joined)} joined · ${x.done} finished` : 'Nobody has joined yet';
    const you = !Compete.finished(rec) ? (k || rec.cur.deaths ? `You’re on level ${k + 1} of ${CHALLENGE_LEVELS}` : 'You haven’t played yet')
      : !rec.sent ? 'You finished · score not sent yet'
      : `You died ${Compete.totalDeaths(rec)} times${x?.rank && x.of > 1 ? ` · ${ui.ordinal(x.rank)} of ${x.of}` : ''}`;
    return { id, title: rec.by ? `${rec.by}’s challenge` : 'Your challenge', others, you, fresh: !!x?.fresh };
  });
}

// Badge on the title screen's button when someone has joined or finished one of your challenges.
function refreshCompeteBadge() {
  if (!Compete.available() || !Compete.recent().length) { ui.competeBadge(0); return; }
  const t = ++chToken;
  let lastN = -1;
  const check = async () => {
    const n = (await Compete.fetchSummaries()).filter(x => x.fresh).length;
    if (t !== chToken || n === lastN) return false;
    lastN = n; ui.competeBadge(n);
    return true;
  };
  check().catch(() => {});
  keepFresh(t, 'scrTitle', check);
  liveNudge = () => { if (t === chToken) check().catch(() => {}); };
}

function openCompete() {
  toMenu();
  ui.showScreen('scrCompete');
  const t = ++chToken;
  let stats = null, sums = [], lastKey = '';
  const draw = () => { if (t === chToken) ui.renderCompete(stats, competeList(sums), id => { sound.click(); openChallenge(id); }); };
  const loadStats = () => Compete.fetchStats().then(x => { stats = x; draw(); }, e => { stats = stats || { error: e.message }; draw(); });
  const loadSums = async () => {
    sums = await Compete.fetchSummaries();
    const key = JSON.stringify(sums);
    if (key === lastKey) return false;
    if (lastKey) loadStats(); // someone finished or joined: the record may have moved too
    lastKey = key; draw();
    return true;
  };
  draw();
  loadStats(); loadSums().catch(() => {});
  keepFresh(t, 'scrCompete', loadSums);
  liveNudge = () => { if (t === chToken) loadSums().catch(() => {}); };
}

function needName(fieldId) {
  if (save.player.name.trim()) return false;
  ui.toast('Add your name first');
  $(fieldId)?.focus();
  return true;
}

function openPicker() {
  if (needName('cmpName')) return;
  toMenu();
  picked = [];
  const draw = () => ui.renderPicker(picked, id => {
    sound.click();
    if (picked.includes(id)) picked = picked.filter(x => x !== id);
    else if (picked.length < CHALLENGE_LEVELS) picked.push(id);
    else ui.toast('That’s 3. Tap one to swap it out.');
    draw();
  });
  draw();
  ui.showScreen('scrPick');
}

async function createFromPick() {
  if (creating || picked.length !== CHALLENGE_LEVELS) return;
  creating = true;
  toMenu();
  ui.showScreen('scrChallenge');
  const t = ++chToken;
  ui.renderChallenge({ message: 'Setting the trap…' }, handlers);
  // a new challenge opens on its invite screen: send it now, play your own levels whenever you like
  try { const ch = await Compete.createChallenge(picked); if (t === chToken) showChallenge(ch, t); }
  catch (e) { if (t === chToken) ui.renderChallenge({ error: e.message }, handlers); }
  finally { creating = false; }
}

async function openChallenge(id) {
  toMenu();
  ui.showScreen('scrChallenge');
  const t = ++chToken;
  ui.renderChallenge({ message: 'Loading challenge…' }, handlers);
  try {
    const rec = Compete.progress(id);
    const view = rec && Compete.finished(rec) && !rec.sent ? await Compete.submitScore(id) : await Compete.fetchChallenge(id);
    if (t === chToken) showChallenge(view, t);
  } catch (e) { if (t === chToken) ui.renderChallenge({ error: e.message, id, gone: e.status === 404 }, handlers); }
}

function showChallenge(view, t) {
  let shown = '';
  const draw = v => {
    const key = JSON.stringify([v.players, v.playing]);
    // no news, or the player is typing their name: leave the screen alone (it redraws on the next change)
    if (key === shown || document.querySelector('#chBody input:focus')) return false;
    shown = key;
    ui.renderChallenge({ view: v, local: Compete.progress(v.id), playable: Compete.playable(v), link: Compete.link(v.id) }, handlers);
    Compete.markSeen(v);
    return true;
  };
  draw(view);
  const refresh = async () => { const v = await Compete.fetchChallenge(view.id); return t === chToken && draw(v); };
  keepFresh(t, 'scrChallenge', refresh);
  liveNudge = () => { if (t === chToken) refresh().catch(() => {}); };
}

function playChallenge(view) {
  if (needName('chName')) return;
  const rec = Compete.track(view);
  if (!rec.joined) Compete.joinChallenge(view.id).then(() => { rec.joined = true; persist(); }, () => {}); // tells the creator
  if (Compete.finished(rec)) { openChallenge(view.id); return; }
  startLevel(levelIndex(view.levels[rec.deaths.length]), { id: view.id, rec });
}

async function shareChallenge(view) {
  const r = await Compete.share(view);
  if (r === 'copied') ui.toast('Link copied. Send it to your victim.');
  else if (r === 'failed') ui.toast('Couldn’t share. Copy the link under the button instead.');
}

const handlers = {
  open: openChallenge,
  compete: openCompete,
  newChallenge: () => { sound.click(); openPicker(); },
  play: v => { sound.click(); playChallenge(v); },
  share: v => { sound.click(); shareChallenge(v); },
  setName: v => { save.player.name = v.trim().slice(0, 16); persist(); },
};

// ---------- settings and keys ----------
function onSetting(key) {
  persist();
  if (key === 'sound' || key === 'music') applyAudio();
  if (key === 'swap') setSwap(save.settings.swap);
  sound.click();
}

function onKey(e) {
  if (e.repeat || e.target.closest?.('input, textarea')) return;
  const k = e.code;
  if (mode === 'play') {
    if (k === 'Escape' || k === 'KeyP') pause(true);
    else if (k === 'KeyR') restart();
  } else if (mode === 'pause') {
    if (k === 'Escape' || k === 'KeyP') resume();
  } else if (mode === 'done' && !$('mdlResult').hidden) {
    if (k === 'Enter' || k === 'Space') { e.preventDefault(); if (!$('btnNext').hidden) next(); }
    else if (k === 'KeyR' && !chal) (faking ? unfake() : startLevel(idx));
  } else if (mode === 'menu' && k === 'Escape' && $('scrTitle').hidden) goTitle();
}

// a second tap within a few seconds confirms (no system dialog: they're blocked when the game is embedded)
function twoTap(id, label, armed, fn) {
  let at = 0;
  $(id).addEventListener('click', () => {
    sound.click();
    const b = $(id);
    if (Date.now() - at > 4000) {
      at = Date.now(); b.textContent = armed;
      setTimeout(() => { if (Date.now() - at >= 4000) b.textContent = label; }, 4100);
      return;
    }
    at = 0; b.textContent = label;
    fn();
  });
}

function wireButtons() {
  const on = (id, fn) => $(id).addEventListener('click', () => { sound.click(); fn(); });
  on('btnPlay', () => startLevel(nextUnplayed()));
  on('btnLevels', goLevels);
  on('btnCompete', openCompete);
  on('btnSettings', () => {
    ui.renderSettings(onSetting);
    $('btnForget').hidden = true;
    Compete.serverReady().then(ok => { $('btnForget').hidden = !ok; });
    ui.showScreen('scrSettings');
  });
  for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => { sound.click(); goTitle(); });
  twoTap('btnReset', 'Reset progress', 'Tap again to wipe everything', () => {
    resetSave(); setSwap(false); applyAudio(); ui.renderSettings(onSetting); loadLevel(0, true);
    ui.toast('Fresh start. The levels remember nothing. Unlike you.');
  });
  twoTap('btnForget', 'Delete my challenge data', 'Tap again to delete it from our server', async () => {
    try { await Compete.forgetMe(); ui.toast('Deleted. Your challenge scores are gone from our server.'); }
    catch (e) { ui.toast(e.message); }
  });
  on('btnNewChallenge', openPicker);
  on('btnPickBack', openCompete);
  on('btnCreate', createFromPick);
  on('btnChBack', openCompete);
  $('cmpName').addEventListener('input', e => handlers.setName(e.target.value));
  on('btnPause', () => pause(true));
  on('btnRestart', restart);
  on('btnResume', resume);
  on('btnPauseRestart', () => { resume(); restart(); });
  on('btnPauseLevels', () => (chal ? openChallenge(chal.id) : goLevels()));
  on('btnPauseHome', goTitle);
  on('btnReplay', () => (faking ? unfake() : startLevel(idx)));
  on('btnResLevels', () => (faking ? unfake() : goLevels()));
  on('btnNext', next);
  on('btnShare', share);
  on('btnFakeSkip', () => {
    if (mode !== 'play' || s.status !== 'play') return;
    $('btnFakeSkip').hidden = true;
    fireExternal(L, s, L.button ? 'button' : 'skip');
    drain();
  });
  on('fakeReload', () => {
    hideCrash();
    if (mode === 'play' && s.status === 'play') { fireExternal(L, s, 'reload'); drain(); }
  });
  $('logo').addEventListener('click', () => {
    const el = $('logo');
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    sound.lol();
  });
}
