# Ragebait

A troll platformer for the browser and phones. Run, jump, reach the door. Every level lies: floors fall, spikes pop up, doors run away or bite, ceilings slam, controls swap and gravity flips. You die in one hit and come back instantly, and each trap is the same every time, so every death teaches you something.

- **30 levels in 3 chapters**, each with its own palette: *Trust Issues* (cream and red), *Cold Feet* (ice blue) and *The Basement* (maroon and grey). Level 10 of each chapter is a longer, scrolling boss level.
- **Traps**: collapsing and crumbling floors, hidden spikes, ball trains and bouncing cannonballs, slamming ceilings, rising pillars, ferries that sink, spike walls that chase you, runaway doors, fake doors with teeth, invisible blocks you bonk, invisible bridges, swapped controls, flipped gravity, and a "Skip level" button that kills you.
- **Feel**: a death counter that never resets, a taunt for every death, faint marks where you died, screen shake, particles, synthesised sound effects and a chiptune loop per chapter.
- **Controls**: arrows or A/D and Space/W/↑ on a keyboard (R restarts, Esc pauses); on phones, thumb zones around on-screen buttons, with an option to put jump on the left. Landscape first; portrait works with a smaller view.
- No accounts, no server, no tracking. Progress is saved on the device.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, also reachable from a phone on the same Wi-Fi
npm run build      # production build in dist/ (works offline and installs as a PWA)
npm run preview    # serve dist/ locally
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run check` | Proves every level can be beaten: a search over held inputs, run on the real sim, has to reach the door. Also catches map typos (uneven rows, unknown characters, traps naming groups or marks that aren't on the map). Pass level ids to check only those: `node scripts/check-levels.mjs 2-3 3-10`. Run it after editing levels. Takes about a minute. |
| `node scripts/smoke-test.mjs` | Runs `dist/` in your installed Chrome, headless. It expects Chrome at the default Windows path; elsewhere, set `CHROME_PATH`. Fails on console errors; beats level 1 with the checker's route on a phone, a desktop and a portrait screen; checks the touch buttons steer and jump; opens the pause, level and settings screens; and screenshots every level to `artifact/shots/levels/`. Run `npm run build` first. |
| `node scripts/make-og.mjs` | Redraws `public/og.png`, the link-preview image, from the real game. Run `npm run build` first. |
| `npm run build:artifact` | Bundles everything into `artifact/ragebait.html`, a single self-contained page for a shareable claude.ai preview. |

## Code map

```
src/
  config.js        tunables (run speed, jump, gravity), chapter palettes, taunts, GAME_NAME
  sim.js           the world: fixed-step, deterministic, no DOM. Player physics, moving blocks, balls, spikes, the door, traps
  levels/
    ch1.js … ch3.js  the levels, as ASCII maps plus trap lists
    index.js       compiles a level: map characters to tiles, groups and marks; checks traps refer to real things
    solver.js      the search the checker uses (and the smoke test, to play a level in the browser)
  render.js        2D canvas: tiles, spikes, the runner, doors, particles, screen shake, camera
  input.js         keyboard and touch, merged into one { left, right, jump }
  audio.js         WebAudio sound effects and the chiptune loops
  ui.js            menus, HUD, toasts and icons (DOM)
  game.js          game flow: levels, deaths, respawns, wins, saving
  save.js          localStorage progress
  tokens.css       palette and type shared by the game (style.css) and the pages (page.css)
about.html         /about: how to play, chapters, installing
privacy.html       /privacy: what's stored (only local progress)
404.html           "Fell through the floor" page Vercel serves for unknown addresses
```

## Adding a level

Levels live in `src/levels/ch1.js`, `ch2.js` and `ch3.js`. A level is a map plus a list of traps:

```js
{
  name: 'Walk to the door',
  hint: 'That’s it. That’s the level.',
  map: `
    ................................
    .P..........................D...
    #############aaa################
    #############aaa################`,
  traps: [{ when: { x: 11 }, do: 'fall', g: 'a' }],
}
```

One character is one tile; x runs right and y runs down, from 0 at the top-left. Rows must all be the same width. Most levels are 32 wide; wider or taller ones scroll.

### Map key

| Character | Meaning |
| --- | --- |
| `.` | air |
| `#` | solid |
| `^` `V` `<` `>` | spikes pointing up, down, left, right |
| `P` | where the runner starts (standing on the bottom of the tile) |
| `D` | the door |
| `F` | a fake door: identical, but it bites |
| `a`–`z` | solid tiles in a **group**, so traps can move, drop or hide them together |
| `1`–`9` | hidden tiles in a group: empty until a trap turns them into spikes (`spikes`) or blocks (`show`, `bonk`) |
| `A`–`Z` (not P, D, F, V) | **marks**: named spots for traps to use, such as where the door runs to or where balls come from |

### Traps

Each trap has a `when` (all its conditions must hold) and a `do`. A trap fires once, unless it has `repeat: true` (then it fires each time its condition starts being true). Add `delay` (seconds) to wait after the condition, and `say` to flash a line on screen.

| `when` | Fires when |
| --- | --- |
| `x: 12` | the runner's centre reaches x = 12 (with `left: true`, goes back left of it). A mark letter works too |
| `y: 5`, `up: true` | the same, for height |
| `zone: [x0, y0, x1, y1]` | the runner is inside that box of tiles |
| `near: 2.5` | the runner is within that many tiles of the door |
| `t: 1.5` | that many seconds into the attempt |
| `jump: true` / `land: true` | the runner jumps / lands (combine with `x` or `zone`) |
| `stand: 'a'` / `touch: 'a'` | the runner stands on / touches group a |
| `bonk: '1'` | the runner's head hits hidden group 1 (which then appears) |
| `after: 3` | trap number 3 (counting from 0) has fired |
| `ui: 'skip'` | the level's fake Skip button is pressed (set `fakeSkip: true` on the level) |

| `do` | Effect |
| --- | --- |
| `fall` | group `g` falls away (`shake: 0.3` wobbles first). Works on a group that's already moving, too |
| `move` | group `g` slides `by: [dx, dy]` (or along `path: [[dx, dy], …]`) at `speed` tiles/s. `back: true` returns it after `hold` seconds, `loop: true` repeats forever, `spikes: 'd'` puts spikes on its faces (`u` `d` `l` `r`), `slam: true` shakes the screen when it stops. Anything it pushes into a wall is crushed |
| `vanish` | group `g` disappears |
| `show` | hidden group `g` becomes solid |
| `reveal` | group `g` is solid all along but invisible until this fires |
| `spikes` | hidden group `g` pops up as spikes, pointing away from whatever it sits against |
| `door` | the door runs `to` a mark |
| `balls` | rolls or lobs balls `from` a mark with velocity `v: [vx, vy]`; `n` at a time, `gap` seconds apart, again every `every` seconds; `bounce: 0.85` makes them bounce |
| `flip` | flips gravity |
| `reverse` | swaps left and right |
| `kill` | kills the runner |
| `say` | just shows `say` |

Then run `npm run check` to confirm the level can be beaten. Run speed, jump height and gravity are in `src/config.js`: a held jump rises about 2.9 tiles and carries about 4 tiles at full speed, so a 3-high wall can't be jumped and a 3-wide gap can.

## Renaming

The name appears in `GAME_NAME` (`src/config.js`), the `<title>`s in the HTML files, `public/manifest.webmanifest` and `scripts/build-artifact.mjs`.

## Deploying

It's live at [playragebait.vercel.app](https://playragebait.vercel.app), deployed by Vercel on every push to `main`. The game is a static site with no backend, so it scales to any number of players. `vercel.json` sets the Vite build, the `dist/` output and the cache headers (hashed files in `assets/` are cached for a year, `sw.js` and the manifest are checked on every visit).

The service worker loads the page network-first, so players get a new deploy on their next visit, and falls back to the cache when offline. The build stamps the cache name in `dist/sw.js` with a hash of the output (see `vite.config.js`), so each deploy gets a fresh cache and the old one is deleted.

`/about` and `/privacy` are extra Vite pages (see `build.rollupOptions.input`), served without `.html` by `cleanUrls`. If you change what the game stores, update `privacy.html` and its date.

## Shipping to app stores

Wrap the web build with [Capacitor](https://capacitorjs.com):

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init Ragebait com.yourname.ragebait --web-dir dist
npm run build && npx cap add android && npx cap open android
```

Before release, add PNG app icons (192 and 512 px). The manifest currently ships SVG icons, which Chrome accepts but some launchers don't.
