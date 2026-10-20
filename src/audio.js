import { save } from './save.js';

// Everything is synthesised with WebAudio: no audio files to load, and it works offline.
let ac = null, master = null, sfx = null, musicBus = null, noiseBuf = null;

export function initAudio() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.connect(ac.destination);
      sfx = ac.createGain(); sfx.gain.value = 0.8; sfx.connect(master);
      musicBus = ac.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ac = null; return; }
    applyAudio();
  }
  if (ac.state !== 'running') ac.resume();
}

export function applyAudio() {
  // with music off, 'ambient' lets iOS keep the player's own music going under the sound effects
  if (navigator.audioSession) navigator.audioSession.type = save.settings.music ? 'auto' : 'ambient';
  if (!ac) return;
  master.gain.setTargetAtTime(save.settings.sound ? 0.9 : 0, ac.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(save.settings.music ? 0.32 : 0, ac.currentTime, 0.3);
  if (save.settings.music) startMusic(); else stopMusic();
}

export function suspendAudio(hidden) {
  if (!ac) return;
  if (hidden) ac.suspend(); else ac.resume();
}

function tone(freq, dur, { type = 'square', vol = 0.15, slide = null, delay = 0, bus = sfx, attack = 0.005 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.2, freq = 1200, q = 0.8, delay = 0, type = 'lowpass', bus = sfx } = {}) {
  if (!ac) return;
  const t = ac.currentTime + delay, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(bus); src.start(t); src.stop(t + dur + 0.02);
}

export const sound = {
  jump: () => tone(330, 0.12, { slide: 620, vol: 0.08 }),
  land: () => noise(0.06, { vol: 0.12, freq: 500 }),
  bump: () => tone(140, 0.08, { vol: 0.08 }),
  die: () => { noise(0.35, { vol: 0.35, freq: 1800 }); tone(420, 0.4, { type: 'sawtooth', slide: 60, vol: 0.12 }); },
  trap: () => tone(500, 0.28, { type: 'triangle', slide: 240, vol: 0.06, delay: 0.02 }),
  slam: () => { noise(0.25, { vol: 0.35, freq: 300 }); tone(90, 0.2, { type: 'sine', slide: 40, vol: 0.25 }); },
  fall: () => noise(0.4, { vol: 0.18, freq: 400 }),
  pop: () => tone(900, 0.06, { vol: 0.07, slide: 1400 }),
  shoot: () => { tone(180, 0.1, { type: 'sine', slide: 90, vol: 0.18 }); noise(0.08, { vol: 0.12, freq: 800 }); },
  spike: () => tone(1500, 0.05, { type: 'square', vol: 0.05, slide: 2400 }),
  bonk: () => tone(220, 0.15, { type: 'square', vol: 0.1, slide: 110 }),
  door: () => { for (let i = 0; i < 5; i++) tone(700 + i * 120, 0.05, { vol: 0.05, delay: i * 0.05 }); },
  bounce: () => tone(260, 0.06, { type: 'sine', vol: 0.08 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'square', vol: 0.09, delay: i * 0.08 })),
  click: () => tone(660, 0.04, { type: 'square', vol: 0.05 }),
  flip: () => tone(300, 0.3, { type: 'sine', slide: 900, vol: 0.12 }),
  lol: () => [0, 0.09, 0.18].forEach((d, i) => tone(440 - i * 40, 0.08, { type: 'square', vol: 0.06, delay: d })),
  check: () => [784, 1047, 1319].forEach((f, i) => tone(f, 0.14, { type: 'triangle', vol: 0.09, delay: i * 0.07 })),
  error: () => { tone(110, 0.35, { type: 'sawtooth', vol: 0.12 }); tone(116, 0.35, { type: 'square', vol: 0.06 }); },
  spring: () => tone(180, 0.25, { type: 'sine', slide: 720, vol: 0.14 }),
  coin: () => { tone(988, 0.06, { type: 'square', vol: 0.06 }); tone(1319, 0.14, { type: 'square', vol: 0.06, delay: 0.06 }); },
  lever: () => { tone(240, 0.05, { type: 'square', vol: 0.08 }); noise(0.05, { vol: 0.1, freq: 2000, delay: 0.04 }); },
  warp: () => tone(200, 0.3, { type: 'triangle', slide: 1600, vol: 0.1 }),
  boom: () => { noise(0.7, { vol: 0.5, freq: 260 }); tone(70, 0.5, { type: 'sine', slide: 30, vol: 0.3 }); },
  saw: () => noise(0.4, { vol: 0.12, freq: 3200, type: 'bandpass', q: 4 }),
};

// ---------- music: a small chiptune loop per chapter ----------
// Patterns are 16 sixteenth notes; numbers are semitones above the chapter's root, null is a rest.
const SONGS = [
  { root: 57, bpm: 132, wave: 'square',
    bass: [0, null, 0, null, 7, null, 0, null, 5, null, 5, null, 3, null, 7, null],
    lead: [12, null, 15, 12, null, 19, null, 17, 15, null, 12, null, 10, 12, null, null] },
  { root: 55, bpm: 120, wave: 'triangle',
    bass: [0, null, null, 0, 3, null, null, 3, 5, null, null, 5, 7, null, 5, null],
    lead: [null, 12, 14, 15, null, 14, 12, null, 10, null, 12, null, 7, null, null, null] },
  { root: 50, bpm: 100, wave: 'sawtooth',
    bass: [0, null, 0, 1, 0, null, null, null, 0, null, 0, 1, 3, null, 1, null],
    lead: [12, null, null, 13, null, null, 12, null, 15, null, 13, null, 12, null, null, null] },
  { root: 53, bpm: 146, wave: 'square',
    bass: [0, 0, null, 0, 6, null, 0, null, 0, 0, null, 0, 5, null, 6, null],
    lead: [12, 18, null, 17, null, 12, 15, null, 12, 18, null, 19, 18, null, 15, null] },
  { root: 48, bpm: 112, wave: 'square',
    bass: [0, null, 7, null, 0, null, 6, null, 0, null, 7, null, 10, null, 6, null],
    lead: [null, 24, null, 22, 19, null, 18, null, null, 24, null, 25, 24, null, 19, null] },
];
let song = 0, timer = null, nextAt = 0, stepI = 0;
const hz = n => 440 * 2 ** ((n - 69) / 12);

// chapters beyond the fifth reuse the five loops in turn
export function setSong(i) { song = ((i % SONGS.length) + SONGS.length) % SONGS.length; }

function startMusic() {
  if (timer || !ac) return;
  nextAt = ac.currentTime + 0.1; stepI = 0;
  timer = setInterval(schedule, 50);
}
function stopMusic() { clearInterval(timer); timer = null; }

function schedule() {
  if (!ac || ac.state !== 'running') return;
  const sg = SONGS[song], dur = 60 / sg.bpm / 4;
  if (nextAt < ac.currentTime) nextAt = ac.currentTime + 0.05; // after a pause, don't race to catch up
  while (nextAt < ac.currentTime + 0.2) {
    const i = stepI % 16, bar = Math.floor(stepI / 16) % 4;
    const shift = bar === 3 ? 5 : 0; // a little lift on the fourth bar
    const b = sg.bass[i], l = sg.lead[i];
    const delay = Math.max(0, nextAt - ac.currentTime);
    if (b !== null) tone(hz(sg.root - 12 + b + shift), dur * 1.6, { type: 'triangle', vol: 0.22, delay, bus: musicBus });
    if (l !== null && bar % 2 === 1) tone(hz(sg.root + l + shift), dur * 1.4, { type: sg.wave, vol: 0.05, delay, bus: musicBus });
    if (i % 4 === 0) noise(0.04, { vol: 0.05, freq: 6000, type: 'highpass', delay, bus: musicBus });
    nextAt += dur; stepI++;
  }
}
