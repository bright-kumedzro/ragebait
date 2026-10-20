// Menus, HUD text and toasts (DOM). game.js decides when; this file decides how it looks.
import { CHAPTERS, INTRO_HOLD } from './config.js';
import { LEVELS, CHAPTER_LEVELS } from './levels/index.js';
import { save, isCleared, isUnlocked, nextUnplayed } from './save.js';

const $ = id => document.getElementById(id);

const ICONS = {
  pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>',
  restart: '<path d="M12 5a7 7 0 1 1-6.6 4.7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M4 4v6h6z"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  gear: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.4 2.2l-1.9-.3a6.8 6.8 0 0 0-.7-1.7l1.1-1.6-1.9-1.9-1.6 1.1a6.8 6.8 0 0 0-1.7-.7L13.4 3h-2.8l-.3 1.9a6.8 6.8 0 0 0-1.7.7L7 4.5 5.1 6.4l1.1 1.6a6.8 6.8 0 0 0-.7 1.7l-1.9.3v2.8l1.9.3c.2.6.4 1.2.7 1.7L5.1 16.4 7 18.3l1.6-1.1c.5.3 1.1.5 1.7.7l.3 1.9h2.8l.3-1.9c.6-.2 1.2-.4 1.7-.7l1.6 1.1 1.9-1.9-1.1-1.6c.3-.5.5-1.1.7-1.7l1.9-.3z"/>',
  skull: '<path d="M12 2.5c-4.7 0-8 3.2-8 7.6 0 2.5 1.1 4.3 2.7 5.4V19a1 1 0 0 0 1 1h1.6v-2.3h1.4V20h2.6v-2.3h1.4V20h1.6a1 1 0 0 0 1-1v-3.5c1.6-1.1 2.7-2.9 2.7-5.4 0-4.4-3.3-7.6-8-7.6zM8.7 13.6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm6.6 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>',
  left: '<path d="M15 4l-8 8 8 8z"/>',
  right: '<path d="M9 4l8 8-8 8z"/>',
  up: '<path d="M4 16l8-9 8 9z"/>',
  lock: '<path d="M7 10V8a5 5 0 0 1 10 0v2h1v10H6V10zm2.5 0h5V8a2.5 2.5 0 0 0-5 0z"/>',
  check: '<path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>',
  share: '<path d="M12 3l5 5h-3.5v7h-3V8H7zM5 13h2.5v5h9v-5H19v7.5H5z"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  music: '<path d="M9 17.5V6l11-2.5v11.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="15" r="2.8"/>',
  versus: '<path d="M3 5h3.2l2.3 8.6L10.8 5H14l-4 14H7zM20.6 8.2c-.5-.9-1.4-1.4-2.5-1.4-1.3 0-2.2.7-2.2 1.6 0 2.4 5.6 1.4 5.6 6 0 2.3-1.9 3.9-4.4 3.9-1.9 0-3.4-.9-4.1-2.4l2.1-1.2c.4.8 1.1 1.3 2 1.3 1 0 1.7-.6 1.7-1.4 0-2.5-5.6-1.4-5.6-6 0-2.1 1.8-3.7 4.4-3.7 1.7 0 3.1.8 3.9 2.1z"/>',
  key: '<circle cx="7.5" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 10.8h10v2.6h-2.2V17h-2.6v-3.6h-1.8V16h-2.6v-2.6H12z"/>',
  chevron: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export function paintIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    if (el.querySelector(':scope > svg')) continue;
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  }
}

// ---------- palette ----------
export function applyTheme(th) {
  const r = document.documentElement.style;
  // in the menus, --solid is the accent: headings, buttons and borders (the canvas draws from the theme itself)
  r.setProperty('--air', th.air); r.setProperty('--solid', th.accent || th.solid); r.setProperty('--ink', th.ink);
  r.setProperty('--door', th.door); r.setProperty('--ui', th.ui);
  r.setProperty('--paper', th.paper || th.air); r.setProperty('--text', th.text || th.ink);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', th.air);
}

// ---------- screens and modals ----------
const SCREENS = ['scrTitle', 'scrLevels', 'scrSettings', 'scrCompete', 'scrPick', 'scrChallenge'];
export function showScreen(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  if (id && document.body.classList.contains('kb')) $(id).querySelector('button')?.focus({ preventScroll: true });
}
export function showModal(id, on = true) {
  $(id).hidden = !on;
  // focus the main button for keyboard players; on touch a focus ring would just look like a bug
  if (on && document.body.classList.contains('kb')) ($(id).querySelector('.btn:not(.ghost)') || $(id).querySelector('.btn'))?.focus({ preventScroll: true });
}

let toastTimer = 0;
export function toast(text, ms = 2400) {
  const el = $('toast');
  el.textContent = text; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// A line in big type.
export function taunt(text) {
  const el = $('taunt');
  el.innerHTML = `<span>${esc(text)}</span>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

let introTimer = 0;
export function intro(name, hint) {
  $('introName').textContent = name; $('introHint').textContent = hint;
  const el = $('intro');
  el.classList.add('show');
  clearTimeout(introTimer); introTimer = setTimeout(() => el.classList.remove('show'), INTRO_HOLD * 1000);
}
export function hideIntro() { clearTimeout(introTimer); $('intro').classList.remove('show'); }

export function hud(id, name, deaths) {
  $('hudId').textContent = id; $('hudName').textContent = name;
  $('hudDeathCount').textContent = deaths;
}
// the key counter, shown only on levels with keys
export function hudKeys(got, total) {
  const el = $('hudKeys');
  el.hidden = !total;
  if (total) { $('hudKeyCount').textContent = `${got}/${total}`; el.classList.toggle('done', got === total); }
}
export function bumpKeys() {
  const el = $('hudKeys');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

export function bumpDeaths(n) {
  $('hudDeathCount').textContent = n;
  const el = $('hudDeaths');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

// ---------- title ----------
export function renderTitle() {
  const i = nextUnplayed(), lv = LEVELS[i];
  const started = Object.keys(save.levels).length > 0;
  $('playLabel').textContent = started ? 'Continue' : 'Play';
  $('playSub').textContent = `Level ${lv.id} · ${lv.def.name}`;
  const d = save.deaths;
  $('statLine').textContent = d ? `${d.toLocaleString()} ${d === 1 ? 'death' : 'deaths'} so far. Rookie numbers.` : `${LEVELS.length} levels. Every one of them is lying.`;
}

// ---------- level select ----------
export function renderLevels(current, onPick) {
  const list = $('chapterList');
  list.innerHTML = '';
  let n = 0;
  CHAPTER_LEVELS.forEach((levels, c) => {
    const ch = CHAPTERS[c], th = ch.theme;
    const sec = document.createElement('section');
    sec.className = 'chapter';
    sec.style.cssText = `--c-air:${th.air};--c-solid:${th.solid};--c-ink:${th.ink}`;
    sec.innerHTML = `<h3 style="color:${th.accent || th.solid}">${c + 1}. ${ch.name}</h3><p>${ch.blurb}</p><div class="grid"></div>`;
    const grid = sec.querySelector('.grid');
    levels.forEach((def, i) => {
      const idx = n++, lv = LEVELS[idx], ls = save.levels[lv.id];
      const b = document.createElement('button');
      const open = isUnlocked(idx), done = isCleared(idx);
      b.className = 'lvl' + (done ? ' cleared' : '') + (open ? '' : ' locked') + (idx === current ? ' current' : '') + (i === levels.length - 1 ? ' boss' : '');
      b.innerHTML = open
        ? `${i + 1}<small>${done ? `${icon('skull')}${ls.best}` : ls?.deaths ? `${icon('skull')}${ls.deaths}` : ''}</small>`
        : icon('lock');
      b.setAttribute('aria-label', `Level ${lv.id}, ${def.name}${done ? `, cleared with ${ls.best} deaths` : open ? '' : ', locked'}`);
      if (open) b.onclick = () => onPick(idx);
      else b.onclick = () => toast('Beat the level before it first. Nice try though.');
      grid.appendChild(b);
    });
    list.appendChild(sec);
  });
  const cleared = LEVELS.filter((_, i) => isCleared(i)).length;
  $('levelsStat').textContent = `${cleared}/${LEVELS.length}`;
}

// ---------- settings ----------
const SETTINGS = [
  ['sound', 'Sound', 'Effects and music'],
  ['music', 'Music', 'The little chiptune loop'],
  ['haptics', 'Vibration', 'A buzz every time you die'],
  ['swap', 'Jump on the left', 'Move with your right thumb instead'],
];
export function renderSettings(onChange) {
  const list = $('settingsList');
  list.innerHTML = '';
  for (const [key, label, sub] of SETTINGS) {
    const b = document.createElement('button');
    b.className = 'set-row'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(!!save.settings[key]));
    b.innerHTML = `<span class="lbl"><b>${label}</b><span>${sub}</span></span><span class="switch" aria-hidden="true"></span>`;
    b.onclick = () => { save.settings[key] = !save.settings[key]; b.setAttribute('aria-checked', String(save.settings[key])); onChange(key); };
    list.appendChild(b);
  }
}

export function renderPauseQuick(onChange) {
  const q = $('pauseQuick');
  q.innerHTML = '';
  for (const [key, ic, label] of [['sound', 'sound', 'Sound'], ['music', 'music', 'Music']]) {
    const b = document.createElement('button');
    b.className = 'sq-btn'; b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', String(!!save.settings[key]));
    b.innerHTML = icon(ic);
    b.onclick = () => { save.settings[key] = !save.settings[key]; b.setAttribute('aria-pressed', String(save.settings[key])); onChange(key); };
    q.appendChild(b);
  }
}

// ---------- challenges ----------
export const esc = t => String(t).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const deathWord = n => `${n} ${n === 1 ? 'death' : 'deaths'}`;
const clock = t => (t >= 60 ? `${Math.floor(t / 60)}m ${String(Math.round(t % 60)).padStart(2, '0')}s` : `${t.toFixed(1)}s`);
const levelName = id => LEVELS.find(l => l.id === id)?.def.name || id;

export function competeBadge(n) {
  const b = $('competeBadge');
  b.hidden = !n;
  b.textContent = n;
  b.setAttribute('aria-label', `${n} challenge${n === 1 ? '' : 's'} with news`);
}

// stats: null while loading, { error }, or { wins, played, waiting }; list: rows from game.js
export function renderCompete(stats, list, onOpen) {
  if ($('cmpName').value !== save.player.name) $('cmpName').value = save.player.name; // don't jump the caret mid-typing
  const cell = (n, label) => `<div><b>${n}</b><span>${label}</span></div>`;
  const r = $('cmpRecord');
  if (!stats) r.innerHTML = '<p class="rec-note">Loading your record…</p>';
  else if (stats.error) r.innerHTML = `<p class="rec-note">${esc(stats.error)}</p>`;
  else {
    const { wins, played, waiting } = stats;
    r.innerHTML = `<div class="rec-cells">${cell(wins, wins === 1 ? 'Win' : 'Wins')}${cell(played, 'Played')}${cell(played ? `${Math.round((100 * wins) / played)}%` : '–', 'Win rate')}</div>`
      + (waiting ? `<p class="rec-note">${waiting} waiting for someone to play</p>` : '');
  }
  const el = $('cmpList');
  el.innerHTML = list.length ? '' : '<p class="fine">No challenges yet. Start one and send it to someone who deserves it.</p>';
  for (const { id, title, others, you, fresh } of list) {
    const b = document.createElement('button');
    b.className = 'ch-row' + (fresh ? ' fresh' : '');
    b.innerHTML = `<span><strong>${esc(title)}${fresh ? '<em>New</em>' : ''}</strong>${others ? `<small>${esc(others)}</small>` : ''}<small>${esc(you)}</small></span>${icon('chevron')}`;
    b.onclick = () => onOpen(id);
    el.appendChild(b);
  }
}

// The level picker for a new challenge: only levels you've beaten, numbered in the order picked.
export function renderPicker(picked, onToggle) {
  const list = $('pickList');
  list.innerHTML = '';
  let n = 0, cleared = 0;
  CHAPTER_LEVELS.forEach((levels, c) => {
    const th = CHAPTERS[c].theme, sec = document.createElement('section');
    sec.className = 'chapter';
    sec.style.cssText = `--c-air:${th.air};--c-solid:${th.solid};--c-ink:${th.ink}`;
    sec.innerHTML = `<h3 style="color:${th.accent || th.solid}">${c + 1}. ${CHAPTERS[c].name}</h3><div class="grid"></div>`;
    const grid = sec.querySelector('.grid');
    levels.forEach((def, i) => {
      const idx = n++, lv = LEVELS[idx], done = isCleared(idx), order = picked.indexOf(lv.id);
      if (done) cleared++;
      const b = document.createElement('button');
      b.className = 'lvl pick' + (order >= 0 ? ' cleared picked' : '') + (done ? '' : ' locked');
      b.innerHTML = done ? `${i + 1}<small>${esc(def.name)}</small>${order >= 0 ? `<i class="order">${order + 1}</i>` : ''}` : icon('lock');
      b.setAttribute('aria-pressed', String(order >= 0));
      b.setAttribute('aria-label', `Level ${lv.id}, ${def.name}${done ? '' : ', not beaten yet'}`);
      b.onclick = () => (done ? onToggle(lv.id) : toast('Beat it yourself first. Only fair.'));
      grid.appendChild(b);
    });
    list.appendChild(sec);
  });
  $('pickStat').textContent = `${picked.length}/3`;
  $('pickNote').textContent = cleared < 3
    ? `Beat ${3 - cleared} more ${3 - cleared === 1 ? 'level' : 'levels'} first: you can only send levels you’ve survived yourself.`
    : 'Pick the ones you think will hurt most. They’re played in the order you pick them.';
  const btn = $('btnCreate');
  btn.disabled = picked.length !== 3;
  btn.textContent = picked.length === 3 ? 'Create challenge' : `Pick ${3 - picked.length} more`;
}

// st: { message } while loading, { error, id, gone }, or { view, local, playable, link }; h: handlers
export function renderChallenge(st, h) {
  const body = $('chBody');
  if (st.message) { body.innerHTML = `<p class="ch-msg">${esc(st.message)}</p>`; return; }
  if (st.error) {
    // an expired or mistyped link can't be retried; anything else (offline, server hiccup) can
    const retry = st.id && !st.gone;
    body.innerHTML = `<p class="ch-msg">${esc(st.error)}</p>`
      + (retry ? '<button class="btn" id="chRetry">Try again</button>' : '<button class="btn" id="chToCompete">Your challenges</button>');
    if (retry) $('chRetry').onclick = () => h.open(st.id);
    else $('chToCompete').onclick = h.compete;
    return;
  }
  const v = st.view, rec = st.local, me = v.players.findIndex(p => p.you), n = v.players.length;
  const others = [...v.players, ...v.playing].filter(p => !p.you), done = v.players.filter(p => !p.you).length;
  const inviting = v.mine && me < 0; // the creator before finishing: sending the invite comes first
  const rival = v.players.find(p => !p.you);
  let head;
  if (me >= 0 && n > 1) head = me === 0 ? (n === 2 ? `You ragebaited ${esc(rival.name)}` : 'You ragebaited everyone') : `${esc(v.players[0].name)} ragebaited you`;
  else if (me >= 0) head = `You died ${v.players[me].total} ${v.players[me].total === 1 ? 'time' : 'times'}`;
  else if (inviting && !others.length) head = 'Pick your victim';
  else if (n) head = `Deaths to beat: ${v.players[0].total}`;
  else head = 'Be the first to finish';
  // lost to someone: a little salt underneath
  const salt = me > 0 ? ['Mogged.', 'Ratio’d.', 'Emotional damage.'][v.id.charCodeAt(0) % 3] : '';
  const status = others.length ? `${others.length} accepted · ${done} finished` : 'Nobody has accepted yet';
  const chips = v.levels.map((id, i) => `<li><b>${i + 1}</b>${esc(id)} · ${esc(levelName(id))}</li>`).join('');
  const rows = v.players.map((p, i) => `<li class="${p.you ? 'you' : ''}"><span class="rank">${i + 1}</span>`
    + `<span class="who">${esc(p.name)}${p.you ? '<em>you</em>' : ''}<small>${p.deaths.join(' · ')} · ${clock(p.time)}</small></span><b>${icon('skull')}${p.total}</b></li>`).join('')
    + v.playing.map(p => `<li class="playing${p.you ? ' you' : ''}"><span class="rank">·</span>`
    + `<span class="who">${esc(p.name)}${p.you ? '<em>you</em>' : ''}<small>Accepted · still dying</small></span><b>–</b></li>`).join('');
  const share = `<button class="btn" id="chShare" data-icon="share"><span>${me >= 0 ? 'Send to someone else' : 'Send the challenge'}</span></button><p class="ch-link">${esc(st.link)}</p>`;
  let actions;
  if (me >= 0) {
    actions = share + (n < 2 ? '<p class="fine">It counts as a game once someone else finishes it.</p>' : '')
      + '<button class="btn ghost" id="chNew">New challenge</button>';
  } else if (!st.playable) {
    actions = '<p class="fine">One of these levels has changed since this challenge was made, so the scores wouldn’t be fair. Start a new one!</p><button class="btn" id="chNew">New challenge</button>';
  } else {
    const k = rec ? rec.deaths.length : 0, started = rec && (k || rec.cur.deaths || rec.cur.time > 1);
    const label = rec && k >= 3 && !rec.sent ? `Send my score (${deathWord(rec.deaths.reduce((a, b) => a + b, 0))})`
      : started ? `Continue: level ${k + 1} of 3` : `Play ${inviting ? 'your' : 'the'} 3 levels`;
    const play = (save.player.name ? '' : '<label class="name-field"><span>Your name</span><input id="chName" maxlength="16" autocomplete="nickname" enterkeyhint="done" placeholder="Shown on the scoreboard"></label>')
      + `<button class="btn ${inviting ? 'ghost' : 'big'}" id="chPlay">${label}</button>`;
    actions = inviting ? share + play : play;
  }
  body.innerHTML = `<p class="eyebrow">${v.mine ? 'Your challenge' : `${esc(v.by)}’s challenge`} · fewest deaths wins</p><h3 class="ch-head">${head}</h3>`
    + (salt ? `<p class="ch-salt">${salt}</p>` : '')
    + `<ol class="ch-levels">${chips}</ol><p class="ch-status">${status}</p>`
    + (n || v.playing.length ? `<ol class="board">${rows}</ol>` : '') + `<div class="ch-actions">${actions}</div>`;
  paintIcons(body);
  if ($('chName')) $('chName').oninput = e => h.setName(e.target.value);
  if ($('chPlay')) $('chPlay').onclick = () => h.play(v);
  if ($('chShare')) $('chShare').onclick = () => h.share(v);
  if ($('chNew')) $('chNew').onclick = h.newChallenge;
}
