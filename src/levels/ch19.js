// Chapter 19: Do Nothing. Patience and anti-instinct: stand still, count your jumps, ignore the countdown, let go of the controls.
// Map key and trap options: README → "Adding a level". Run `node scripts/check-levels.mjs 19` after editing.
export default [
  {
    name: 'Please wait',
    hint: 'Loading…',
    // stand still and the bridge loads in, one block per half second; it stalls at 99% for a while. Moving resets it
    map: `
      ..............................
      ..............................
      ..............................
      ..............................
      ..............................
      .P..A.....................D...
      ######123456789###############
      ######.........###############
      ######.........###############`,
    signs: [['A', 'LOADING']],
    traps: [
      { when: { idle: 0.5 }, do: 'show', g: '1', say: 'Loading…' },
      { when: { idle: 1 }, do: 'show', g: '2' },
      { when: { idle: 1.5 }, do: 'show', g: '3' },
      { when: { idle: 2 }, do: 'show', g: '4' },
      { when: { idle: 2.5 }, do: 'show', g: '5' },
      { when: { idle: 3 }, do: 'show', g: '6' },
      { when: { idle: 3.5 }, do: 'show', g: '7' },
      { when: { idle: 4 }, do: 'show', g: '8', say: 'Almost there…' },
      { when: { idle: 7 }, do: 'show', g: '9', say: 'Done. Thanks for not touching anything.' },
      { when: { idle: 1 }, do: 'sign', i: 0, text: '20%' },
      { when: { idle: 2.5 }, do: 'sign', i: 0, text: '60%' },
      { when: { idle: 4 }, do: 'sign', i: 0, text: '99%' },
      { when: { idle: 7 }, do: 'sign', i: 0, text: '100%' },
    ],
  },
  {
    name: 'Jump budget',
    hint: 'Jump as much as you like.',
    // you get two jumps and the surface route needs three. Drop down the hole before the wall: the tunnel's
    // spring is free and pops you up past it. Then jump the pit and up to the ledge
    map: `
      ....................................
      ....................................
      ....................................
      ....................................
      ....................................
      ....................................
      .................................D..
      ...........##................#######
      .P.A.......##................#######
      ########..####...#####...###########
      ########..####...#####...###########
      ########.......=.#####...###########
      ######################...###########`,
    signs: [['A', '2 JUMPS']],
    traps: [
      { when: { jumps: 1 }, do: 'sign', i: 0, text: '1 JUMP', say: '1 jump left. Spend it wisely.' },
      { when: { jumps: 2 }, do: 'jump', factor: 0, say: 'Out of jumps.' },
      { when: { jumps: 2 }, do: 'sign', i: 0, text: '0 JUMPS' },
      { when: { spring: true }, do: 'say', say: 'Springs are free.' },
    ],
  },
  {
    name: 'Not too long',
    hint: 'Have a seat.',
    // stand still for 2 seconds and steps appear up to the door. Keep standing on the floor for 4 and it drops into spikes
    map: `
      ..............
      ..............
      ............D.
      ..........####
      ..............
      ........11....
      ..............
      ....11........
      .P.A..........
      ffffffffffffff
      ^^^^^^^^^^^^^^
      ##############`,
    signs: [['A', 'PLEASE WAIT']],
    traps: [
      { when: { idle: 2 }, do: 'show', g: '1', say: 'Thank you for waiting.' },
      { when: { idle: 2 }, do: 'sign', i: 0, text: 'NEXT!' },
      { when: { idle: 4, zone: [0, 8, 13, 8] }, do: 'fall', g: 'f', shake: 0.3, say: 'Not THAT long.' },
    ],
  },
  {
    name: 'Decorative',
    hint: 'Hurry!',
    // a 9-second countdown that you can't beat, and crushers that slam on anyone rushing. Stop before each one,
    // let it slam and rise, then go. The clock stops itself at the last second
    map: `
      ########################################
      ..........aa........bb........cc........
      ..........aa........bb........cc........
      ..........aa........bb........cc........
      ........................................
      ........................................
      ........................................
      .P.............^.........^...........D..
      ########################################`,
    traps: [
      { when: { t: 0 }, do: 'clock', seconds: 9, say: 'HURRY. 9 seconds.' },
      { when: { t: 8.6 }, do: 'clock', seconds: 0, say: 'Relax. It was decorative.' },
      { when: { x: 8 }, delay: 0.2, do: 'move', g: 'a', by: [0, 4], speed: 14, back: true, hold: 0.6, slam: true },
      { when: { x: 18 }, delay: 0.2, do: 'move', g: 'b', by: [0, 4], speed: 14, back: true, hold: 0.6, slam: true },
      { when: { x: 28 }, delay: 0.2, do: 'move', g: 'c', by: [0, 4], speed: 14, back: true, hold: 0.6, slam: true },
    ],
  },
  {
    name: 'Hop scotch',
    hint: 'No jumping on the floor.',
    // the third jump breaks the floor and drops you into the basement. Only the right end of it isn't spikes,
    // so walk over there before your third jump
    map: `
      ....................
      ....................
      ....................
      ....................
      ....................
      .P..A...............
      ffffffffffffffffffff
      ....................
      ....................
      ....................
      ^^^^^^^^^^^^^^...D..
      ####################`,
    signs: [['A', 'NO JUMPING']],
    traps: [
      { when: { jumps: 1 }, do: 'say', say: 'Crack.' },
      { when: { jumps: 2 }, do: 'say', say: 'CRACK.' },
      { when: { jumps: 3 }, do: 'fall', g: 'f', shake: 0.3, say: 'You broke it.' },
    ],
  },
  {
    name: 'Elevator etiquette',
    hint: 'Take the stairs.',
    // the lift only moves while you touch nothing. STAIRS → is a floor that drops into spikes. Halfway down the
    // lift stops and asks you to press any key: don't; pressing anything restarts its wait
    map: `
      ......................
      ......................
      ......................
      .P...A................
      #eee##ssssssss########
      #...##........####..##
      #...##........####..##
      #...##^^^^^^^^####..##
      #...##############..##
      #...##############..##
      #...##############..##
      #...##############..##
      #...##############..##
      #.....................
      #.....................
      #.........D...........
      #...##################
      ######################`,
    signs: [['A', 'STAIRS →']],
    traps: [
      { when: { stand: 's' }, do: 'fall', g: 's', shake: 0.15, say: 'Out of order.' },
      { when: { idle: 1.5 }, do: 'move', g: 'e', by: [0, 4], speed: 2.5, say: 'Going down.' },
      { when: { idle: 1, y: 7.59 }, do: 'move', g: 'e', by: [0, 4], speed: 2.5 },
      { when: { y: 11.59 }, do: 'say', say: 'Press any key to continue.' },
      { when: { idle: 7, y: 11.59 }, do: 'move', g: 'e', by: [0, 4], speed: 2.5, say: 'Thank you for not pressing.' },
    ],
  },
  {
    name: 'Motion sensor',
    hint: 'The lights are automatic.',
    // the lights go out whenever you move into a new part of the tower and come back on once you stand still for a
    // second. Spikes on the ground, on the ledge ends and on the top shelf
    map: `
      ................
      ................
      .........^....D.
      .....###########
      .^..............
      .###............
      ................
      .....###........
      ...........^....
      .........###....
      .......^........
      .....###........
      ................
      .###............
      .P....^^^^^^^^^^
      ################`,
    traps: [
      { when: { zone: [0, 11, 15, 15] }, do: 'dark', radius: 2.2, repeat: true, say: 'Motion detected.' },
      { when: { zone: [0, 6, 15, 10] }, do: 'dark', radius: 2.2, repeat: true },
      { when: { zone: [0, 0, 15, 5] }, do: 'dark', radius: 2.2, repeat: true },
      { when: { idle: 1 }, do: 'dark', radius: 0, repeat: true },
    ],
  },
  {
    name: 'Sleep mode',
    hint: 'Don’t fall asleep.',
    // the wall can't be climbed. Stand still for 4 seconds and the game nods off: gravity flips and you fall up to
    // the ceiling. Hop the ceiling spikes to the door hanging there (stand still too long and you fall back down)
    map: `
      ##############################
      ..........V.........V......D..
      ..............................
      ..............................
      ...............^^.............
      ...............##.............
      ...............##.............
      ...............##.............
      .P.A...........##.............
      ##############################`,
    signs: [['A', 'DO NOT DISTURB']],
    traps: [
      { when: { idle: 4 }, do: 'flip', repeat: true, say: 'zzz' },
      { when: { idle: 2.5 }, do: 'say', say: 'Yawn.' },
    ],
  },
  {
    name: 'Autopilot',
    hint: 'You’re in control.',
    // let go and autopilot runs you right. The bridges and the wall only respond to autopilot: hold a key near them
    // and they stay put. One spike needs one jump, then hands off again
    map: `
      ............................................
      ............................................
      ............................................
      ............................................
      ................w...........................
      ................w...........................
      .P.A............w....^...................D..
      ########11111#################22222#########
      ########.....#################.....#########`,
    signs: [['A', 'HANDS OFF']],
    traps: [
      { when: { idle: 1 }, do: 'auto', dir: 1, say: 'Autopilot engaged.' },
      { when: { x: 6, idle: 0.5 }, do: 'show', g: '1' },
      { when: { x: 14, idle: 0.5 }, do: 'vanish', g: 'w' },
      { when: { x: 18 }, do: 'say', say: 'OK, one jump.' },
      { when: { x: 27, idle: 0.5 }, do: 'show', g: '2' },
    ],
  },
  {
    name: 'Do nothing',
    hint: 'Try harder.',
    // the chapter at once: stand still to load the bridge, ignore the countdown and wait for each crusher, then
    // stand still past the spikes until gravity nods off, and walk the ceiling to the door
    map: `
      ######################################################
      ................aa......bb........V.........V.....D...
      ................aa......bb............................
      ................aa......bb............................
      ................aa......bb............................
      ................aa......bb............................
      ......................................##..............
      ......................................##..............
      ......................................##..............
      .P.A................^............C....##..............
      #####12345############################################
      #####.....############################################`,
    signs: [['A', 'LOADING'], ['C', 'DO NOT DISTURB']],
    traps: [
      { when: { idle: 0.4 }, do: 'show', g: '1' },
      { when: { idle: 0.8 }, do: 'show', g: '2' },
      { when: { idle: 1.2 }, do: 'show', g: '3' },
      { when: { idle: 1.6 }, do: 'show', g: '4' },
      { when: { idle: 2 }, do: 'show', g: '5' },
      { when: { idle: 2 }, do: 'sign', i: 0, text: '100%' },
      { when: { x: 11 }, do: 'clock', seconds: 8, say: '8 seconds. Go go go.' },
      { when: { after: 6 }, delay: 7.5, do: 'clock', seconds: 0, say: 'Kidding. Take your time.' },
      { when: { x: 14 }, delay: 0.2, do: 'move', g: 'a', by: [0, 4], speed: 14, back: true, hold: 0.6, slam: true },
      { when: { x: 22 }, delay: 0.2, do: 'move', g: 'b', by: [0, 4], speed: 14, back: true, hold: 0.6, slam: true },
      { when: { idle: 3, zone: [30, 0, 53, 11] }, do: 'flip', repeat: true, say: 'zzz' },
    ],
  },
];
