# Ragebait

A troll platformer for the browser and phones. Run, jump, reach the door. Every level lies: floors fall, spikes pop up, doors run away or bite, ceilings slam, controls swap and gravity flips. You die in one hit and come back instantly, and each trap is the same every time, so every death teaches you something.

- **210 levels in 21 chapters**, each with its own palette and a longer boss level at number 10. Chapters 1-20 are hand-made, every level built around its own trick: *Trust Issues*, *Cold Feet*, *The Basement*, *Emotional Damage*, *Fourth Wall*, then a chapter per new toy: *Buzzkill* (saws), *Boing* (springs), *The Floor Is Lava*, *Wormhole* (portals), *Pull the Lever*, *Kaboom* (bombs and countdowns), *Factory Floor* (conveyor belts and crushers), *Black Ice* (ice and wind), *Growing Pains* (size and jump power), *Moon Base* (gravity), *Wrap Around* (fall out of the bottom, come back at the top), *Gold Digger* (coins as bait), *Read the Signs* (signs that lie), *Do Nothing* (patience) and *Devil's Remix* (everything, two at a time). Chapter 21, *Lost & Found*, is generated: explore levels built around keys.
- **Explore levels**: chapter 21 is two-storey maps (a tower to climb, a corridor of traps, a basement you drop into and climb out of) with keys spread across the branches and a locked door somewhere you have to travel back to, with twists like lights out, keys that flip the mirror or swap the controls, a key that runs away, a fake key that bites, and a door that runs home once you have them all.
- **Emotional Damage** trolls the player, not just the runner: a fake "Level cleared" card ("Just kidding."), a checkpoint flag that saves nothing ("What checkpoint?"), traps that change once you've learned them (odd and even tries differ), a mirrored screen, speed traps, invisible spikes, a door that gives up after you've died enough, and a pause button that kills you.
- **Fourth Wall** goes after the game itself: input lag ("Ping: 999 ms"), lights out, air and floor swapping colours, a ghost of your last attempt that kills on touch, corpses that stay as solid blocks (the only bridge across one pit is your own body), a "Don't press" button you have to press, a fake crash screen whose Reload kills you, an upside-down camera, and auto-run.
- **Traps**: collapsing and crumbling floors, hidden spikes, ball trains and bouncing cannonballs, slamming ceilings, rising pillars, ferries that sink, spike walls that chase you, runaway doors, fake doors with teeth, invisible blocks you bonk, invisible bridges, swapped controls, flipped gravity, and a "Skip level" button that kills you.
- **How to play**: a card on the home screen (and shown once, the first time you press Play) with the goal, the three rules and the controls for your device: keyboard or touch.
- **Feel**: a death counter that never resets, a meme taunt for every death ("Caught in 4K.", "Gravity: 1, you: 0.", "404: skill not found." at death 404), the runner's own reactions (a dance, a slow clap, a shrug, a facepalm after five deaths in the same spot), a door that laughs at you, faint marks where you died, screen shake, particles, synthesised sound effects and a chiptune loop per chapter.
- **Controls**: arrows or A/D and Space/W/↑ on a keyboard (R restarts, Esc pauses); on phones, thumb zones around on-screen buttons, with an option to put jump on the left. Landscape first; portrait works with a smaller view.
- **Ragebait a friend**: pick 3 levels you've beaten and send the link. You both play the same 3 levels whenever you like; fewest deaths wins, and time breaks ties. Leaving halfway keeps your deaths. The challenge screen updates live (who accepted, who finished, "You ragebaited Kofi"), the title button shows a badge when there's news, and each device keeps a win record. No accounts: players type a nickname and each device has an anonymous ID.
- No tracking. Campaign progress is saved on the device; only challenges touch the server.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, also reachable from a phone on the same Wi-Fi; serves api/ with an in-memory store
npm run build      # production build in dist/ (works offline and installs as a PWA)
npm run preview    # serve dist/ locally
```

## Scripts

| Command | What it does |
| --- | --- |
| `node scripts/generate-levels.mjs` | Builds chapter 21 into `src/levels/ch21.js` (see "Generated chapter" below). Seeded, so a re-run gives the same levels. Overwrites that file. |
| `npm run check` | Proves every level can be beaten: a search over held inputs, run on the real sim, has to reach the door. Also catches map typos (uneven rows, unknown characters, traps naming groups or marks that aren't on the map). Pass level ids or chapter numbers to check only those: `node scripts/check-levels.mjs 2-3 7`. Run it after editing levels. It also warns about any level you can beat by just holding right. All 210 take a while. |
| `node scripts/smoke-test.mjs` | Runs `dist/` in your installed Chrome, headless. It expects Chrome at the default Windows path; elsewhere, set `CHROME_PATH`. Fails on console errors; beats level 1 with the checker's route on a phone, a desktop and a portrait screen; checks the touch buttons steer and jump; opens the pause, level and settings screens; plays a whole challenge between two players with separate saves (create, pick 3 levels, play them, open the invite link, die once, lose, and check both sides see the right result and the win record); and screenshots every level to `artifact/shots/levels/`. Run `npm run build` first. |
| `node scripts/test-api.mjs` | Tests the challenge and stats APIs against the in-memory store (and through the plain-Redis adapter): validation, one score per player, ranking, win records, deleting a player's data, the share page and the play counts. Run it after changing `api/`. |
| `node scripts/stats.mjs [days]` | Prints the live site's play counts: totals, day-1/7/30 retention, and a row per day. |
| `node scripts/make-og.mjs` | Redraws `public/og.png`, the link-preview image, from the real game. Run `npm run build` first. |
| `npm run build:artifact` | Bundles everything into `artifact/ragebait.html`, a single self-contained page for a shareable claude.ai preview. |

## Code map

```
src/
  config.js        tunables (run speed, jump, gravity), chapter palettes, taunts, GAME_NAME
  sim.js           the world: fixed-step, deterministic, no DOM. Player physics, moving blocks, balls, spikes, the door, traps
  levels/
    ch1.js … ch5.js  the hand-made levels, as ASCII maps plus trap lists
    ch6.js … ch20.js more hand-made chapters, one new mechanic each
    ch21.js          generated explore levels, in the same format
    index.js       the level list, and a fingerprint per level for challenges
    compile.js     compiles a level: map characters to tiles, groups and marks; checks traps refer to real things
    solver.js      the search the checker uses (and the smoke test, to play a level in the browser)
    verify.js      the proof a level must pass (attempt-dependent traps, buttons, corpses, ghosts)
  render.js        2D canvas: tiles, spikes, the runner, doors, particles, screen shake, camera
  input.js         keyboard and touch, merged into one { left, right, jump }
  audio.js         WebAudio sound effects and the chiptune loops
  ui.js            menus, HUD, toasts and icons (DOM)
  game.js          game flow: levels, deaths, respawns, wins, challenges, saving
  compete.js       challenge API calls, anonymous player ID, local challenge progress, sharing
  metrics.js       the anonymous play-count report (see "How it's doing")
  analytics.js     Vercel Web Analytics, on the live site only
  periods.js       the UTC day, week and month, shared by the game and the stats API
  about.js         the About page's public play counts
  save.js          localStorage progress
  tokens.css       palette and type shared by the game (style.css) and the pages (page.css)
about.html         /about: how to play, chapters, installing
privacy.html       /privacy: what's stored (only local progress)
404.html           "Fell through the floor" page Vercel serves for unknown addresses
api/               Vercel functions
  challenge.js     create a challenge, join it, post a score, read a scoreboard or a player's win record, delete a player's data
  share.js         /c/<id> share page with Open Graph tags ("Ama is trying to ragebait you"), which forwards to the game
  stats.js         anonymous play counts: a device's report in, public totals and per-day rows out
  _lib/            challenge rules and the Redis store (in-memory when there's no database)
```

## Adding a level

Levels live in `src/levels/ch1.js` to `ch21.js` (chapters 1-20 are hand-made, 21 is generated). A level is a map plus a list of traps:

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
| `K` | a checkpoint flag (decoration; pair it with a `checkpoint` trap) |
| `*` | a key. If a level has any, the door stays locked until the runner has collected them all |
| `&` | a fake key: identical, but it bites |
| `=` | a spring: throws the runner about 6 tiles away from whatever it sits on (walking into one counts) |
| `$` | a coin. Coins do nothing but sit there looking tempting; `coins` conditions make them bait |
| `/` | a lever, pulled by touching it. Numbered in map order for `lever` conditions |
| `a`–`z` | solid tiles in a **group**, so traps can move, drop or hide them together |
| `1`–`9` | hidden tiles in a group: empty until a trap turns them into spikes (`spikes`) or blocks (`show`, `bonk`) |
| `A`–`Z` (not P, D, F, V) | **marks**: named spots for traps to use, such as where the door runs to or where balls come from. A mark's tile is air |

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
| `keys: 2` | the runner holds at least 2 keys |
| `before: 3` | less than 3 seconds into the attempt |
| `tries: [2, 3]` | this is the player's 2nd or 3rd try at the level (`[3]` means 3rd and later; `'odd'` and `'even'` work too). The checker solves every version |
| `ui: 'skip'` | the level's fake Skip button is pressed (set `fakeSkip: true` on the level) |
| `ui: 'pause'` | the player presses pause (not when the game goes to the background) |
| `ui: 'button'` | the player presses the level's corner button (set `button: 'Don’t press'` on the level) |
| `ui: 'reload'` | the player presses Reload on the fake crash screen |
| `idle: 3` | the player hasn't pressed anything for 3 seconds |
| `jumps: 3` | the runner has jumped 3 times this attempt |
| `spring: true` | a spring has just thrown the runner (combine with `x` or `zone`) |
| `coins: 2` | the runner has picked up 2 coins |
| `lever: 0` | lever 0 has been pulled |

| `do` | Effect |
| --- | --- |
| `fall` | group `g` falls away (`shake: 0.3` wobbles first). Works on a group that's already moving, too |
| `move` | group `g` slides `by: [dx, dy]` (or along `path: [[dx, dy], …]`) at `speed` tiles/s. `back: true` returns it after `hold` seconds, `loop: true` repeats forever, `spikes: 'd'` puts spikes on its faces (`u` `d` `l` `r`), `slam: true` shakes the screen when it stops. Anything it pushes into a wall is crushed |
| `vanish` | group `g` disappears |
| `show` | hidden group `g` becomes solid |
| `reveal` | group `g` is solid all along but invisible until this fires |
| `checkpoint` | says "Checkpoint saved!" and saves nothing; the next death taunts "What checkpoint?" |
| `keymove` | key number `k` (counting from 0, in map order) runs `to` a mark |
| `speed` | multiplies run speed by `factor` (2 is double, 1 is back to normal) |
| `mirror` | flips the view left to right (the controls don't change); again to flip back |
| `rotate` | turns the view upside down (gravity and controls don't change); again to turn it back |
| `swap` | swaps the colours of air and floor; again to swap back |
| `dark` | lights out except `radius` tiles around the runner; `radius: 0` turns the lights back on |
| `lag` | delays every input by `seconds`; `seconds: 0` ends it |
| `auto` | the runner keeps running in `dir` (1 right, -1 left, 0 stops it); only jumping is up to the player |
| `crash` | shows a fake crash screen for `seconds`; the level keeps running behind it |
| `spikes` | hidden group `g` pops up as spikes, pointing away from whatever it sits against; with `invisible: true` they're there but never drawn |
| `door` | the door runs `to` a mark |
| `balls` | rolls or lobs balls `from` a mark with velocity `v: [vx, vy]`; `n` at a time, `gap` seconds apart, again every `every` seconds; `bounce: 0.85` makes them bounce |
| `flip` | flips gravity |
| `reverse` | swaps left and right |
| `kill` | kills the runner |
| `say` | just shows `say` |
| `saw` | a buzzsaw appears at mark `from` (its centre is the middle of that tile; `r` is its radius, 0.8 by default). With `path: ['B', 'C']` it travels those marks at `speed` (`loop`, `back`, `hold` as for `move`); with `chase: 4` it rolls along its row after the runner at that speed. `off: [dx, dy]` shifts it (and its path) from the marks. Saws are drawn behind tiles, so one centred in the top floor row looks like it's cutting up through the floor; since a mark's own tile is air, put the mark in the row above the floor and use `off: [0, 1]` rather than marking the floor itself |
| `lava` | lava rises (or sinks) `to` a row number or a mark's row, at `speed` tiles/s. It starts below the map unless the level sets `lava` |
| `bomb` | a lit bomb at mark `at` explodes after `fuse` seconds, (shifted by `off: [dx, dy]` if given) erasing every tile, spike and spring within `radius` tiles and killing the runner if they're closer than most of that |
| `clock` | a countdown of `seconds` appears; the runner dies at zero. `seconds: 0` stops it |
| `jump` | multiplies jump strength by `factor` (0 means no jumping) |
| `gravity` | multiplies gravity by `factor` (0.45 is the moon) |
| `spring` | multiplies every spring's throw by `factor` |
| `wind` | blows the runner `v` tiles/s sideways (negative is left); `v: 0` stops it |
| `ice` | makes the ground slippery; `on: false` ends it |
| `belt` | turns group `g` into a conveyor belt moving `v` tiles/s (0 stops it); standing on it carries the runner along |
| `size` | resizes the runner by `factor` around their feet (2 is double); growing into a wall squashes them |
| `warp` | teleports the runner to stand on mark `to` |
| `sign` | changes sign number `i` (counting from 0) to read `text` |

A level can also set:

- `fakeWin: 1`: the first time the runner reaches the door, a real-looking "Level cleared" card appears, and any button on it counts as a death.
- `ghost: 1.2`: from the second try on, the previous try replays that many seconds behind the runner and kills on touch. The checker also solves the second try with the first try's ghost chasing.
- `corpses: true`: each death leaves a solid body where the runner died (on top of a spike, if it died on one). Pair it with `check: { corpses: [[x, y], …] }`, the bodies the checker should assume, since the level is meant to need some deaths first.
- `button: 'Don’t press'`: a corner button that fires `ui: 'button'` traps. Add `check: { ui: ['button'] }` if the level needs it pressed.
- `portals: [['A', 'B']]`: a pair of portals standing on marks A and B. Walk into one, come out of the other, keeping your speed.
- `signs: [['A', 'SAFE →']]`: a signpost on mark A. Signs are decoration, so they can lie.
- `lava: 12`: lava already filling the map up to that row (or a mark's row) at the start.
- `wrap: true`: falling out of the bottom of the map drops you back in at the top, so pits aren't deaths.

Then run `npm run check` to confirm the level can be beaten. Run speed, jump height and gravity are in `src/config.js`: a held jump rises about 2.9 tiles and carries about 4 tiles at full speed, so a 3-high wall can't be jumped and a 3-wide gap can.

## How it's doing

Three ways to see how the game is doing:

- **The About page** shows public totals: players, deaths across all players, players this week, levels beaten and challenges made.
- **`node scripts/stats.mjs`** prints everything: players, installs, active today, this week and this month, levels beaten, deaths, challenges, **retention** (how many players come back 1, 7 and 30 days after their first day), and a row per day.
- **Vercel Web Analytics** (in the Vercel dashboard, under the project's Analytics tab) shows page visits, where visitors came from, countries and devices. It has to be switched on once in that tab.

The play counts are anonymous: each device sends only "first time ever / today / this week / this month", days since it first played, whether it's installed, and how many levels it beat and deaths it took since its last report. The server adds these to running totals in the same Redis database as challenges (`rb:st:*` keys); nothing identifies a device. `privacy.html` explains this to players. Counting began with this feature, so earlier players aren't included.

## Generated chapter

`scripts/generate-levels.mjs` builds chapter 21.

**Explore levels** come from `buildExplore`: a 20-row, two-storey map with a tower of platforms on the left, an upper corridor to the right, a hole down into a basement and a staircase back up through another, two or three keys spread across those branches, and the door at the start, on the tower or in the basement. Traps from the chapter's mix go along the corridor and the basement, and each level's twist comes from its fixed recipe in `SHOWCASE`. Explore levels have no looping hazards (cannons, looping crushers): anything on a timer makes their long routes too slow to prove.

Every level must pass `verifyLevel` (the same proof as `npm run check`) and must not be beatable by holding right; otherwise it's rebuilt from the next seed. The generated file is an ordinary level file: edit it by hand if you like, but re-running the generator overwrites it.

## Renaming

The name appears in `GAME_NAME` (`src/config.js`), the `<title>`s in the HTML files, `public/manifest.webmanifest` and `scripts/build-artifact.mjs`.

## Deploying

It's live at [playragebait.vercel.app](https://playragebait.vercel.app), deployed by Vercel on every push to `main`. The game itself is static files on Vercel's CDN; only challenges use the two small functions in `api/`, which scale automatically. `vercel.json` sets the Vite build, the `dist/` output and the cache headers (hashed files in `assets/` are cached for a year, `sw.js` and the manifest are checked on every visit).

The service worker loads the page network-first, so players get a new deploy on their next visit, and falls back to the cache when offline. The build stamps the cache name in `dist/sw.js` with a hash of the output (see `vite.config.js`), so each deploy gets a fresh cache and the old one is deleted.

Challenges are stored in Redis. Either kind works (see `api/_lib/store.js`):

- **Redis from Vercel's Marketplace**, or any Redis server: create it from the project's **Storage** tab and connect it to the project, which sets `REDIS_URL`.
- **Upstash Redis**: `KV_REST_API_URL` and `KV_REST_API_TOKEN` (set by Vercel's Upstash integration) or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (a database made at upstash.com).

Without either, the API answers 503 and the rest of the game still works. Every key starts with `rb:`, so the database can be shared with another project. The functions run in Vercel's London region (`lhr1` in `vercel.json`); move it next to wherever the database lives. Challenges and win records expire after a year.

Each challenge stores a fingerprint of its 3 levels (`levelHash` in `src/levels/index.js`). If you change a level, older challenges that use it say so instead of comparing deaths on two different levels.

`/about` and `/privacy` are extra Vite pages (see `build.rollupOptions.input`), served without `.html` by `cleanUrls`. If you change what the game stores, update `privacy.html` and its date.

## Shipping to app stores

Wrap the web build with [Capacitor](https://capacitorjs.com):

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init Ragebait com.yourname.ragebait --web-dir dist
npm run build && npx cap add android && npx cap open android
```

Before release, add PNG app icons (192 and 512 px). The manifest currently ships SVG icons, which Chrome accepts but some launchers don't.

## Credits

Made by [Bright Kumedzro](https://www.linkedin.com/in/bright-kumedzro-46345420b). Inspired by [*Level Devil*](https://store.steampowered.com/app/3242750/Level_Devil) by Unept, and the troll platformers before it, like *Syobon Action* (Cat Mario). The levels, art, sound and music in this repo are original.
