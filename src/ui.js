// Menus, HUD text and toasts (DOM). game.js decides when; this file decides how it looks.
import { CHAPTERS } from './config.js';
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
  r.setProperty('--air', th.air); r.setProperty('--solid', th.solid); r.setProperty('--ink', th.ink);
  r.setProperty('--door', th.door); r.setProperty('--ui', th.ui);
  r.setProperty('--paper', th.paper || th.air); r.setProperty('--text', th.text || th.ink);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', th.air);
}

// ---------- screens and modals ----------
const SCREENS = ['scrTitle', 'scrLevels', 'scrSettings'];
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

export function taunt(text) {
  const el = $('taunt');
  el.textContent = text;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

let introTimer = 0;
export function intro(name, hint) {
  $('introName').textContent = name; $('introHint').textContent = hint;
  const el = $('intro');
  el.classList.add('show');
  clearTimeout(introTimer); introTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
export function hideIntro() { clearTimeout(introTimer); $('intro').classList.remove('show'); }

export function hud(id, name, deaths) {
  $('hudId').textContent = id; $('hudName').textContent = name;
  $('hudDeathCount').textContent = deaths;
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
  $('statLine').textContent = d ? `${d.toLocaleString()} ${d === 1 ? 'death' : 'deaths'} so far. Rookie numbers.` : '30 levels. Every one of them is lying.';
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
    sec.innerHTML = `<h3 style="color:${th.solid}">${c + 1}. ${ch.name}</h3><p>${ch.blurb}</p><div class="grid"></div>`;
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
