// Chapter 5: Fourth Wall. The game itself is in on it: lag, lights out, swapped colours, a ghost of your last try,
// corpses you build bridges with, a button you mustn't press, a fake crash, an upside-down camera and auto-run.
// Map key and trap options: README → "Adding a level". Run `npm run check` after editing.
export default [
  {
    name: 'Lag',
    hint: 'Smooth sixty frames per second.',
    // your inputs arrive a quarter of a second late, so press everything early; it clears up near the door
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      .P.......^.....^^.....^......D..
      ################################
      ################################
      ################################
      ################################`,
    traps: [
      { when: { x: 4 }, do: 'lag', seconds: 0.25, say: 'Ping: 999 ms' },
      { when: { x: 25 }, do: 'lag', seconds: 0, say: 'Connection restored.' },
    ],
  },
  {
    name: 'Lights out',
    hint: 'Hop along the platforms.',
    // the lights go out, leaving a small circle around you; the platforms are still there, probably
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      ................................
      ...................##........D..
      ...........##..........##..#####
      .P.....##......##..........#####
      #####......................#####
      #####......................#####
      #####......................#####`,
    traps: [
      { when: { x: 3 }, do: 'dark', radius: 3.2, say: 'Who turned off the lights?' },
    ],
  },
  {
    name: 'Which one is the floor?',
    hint: 'Solid is solid. Air is air.',
    // the colours of air and floor swap, then swap back, then swap again
    map: `
      ################################
      ................................
      ................................
      ...........#####................
      ................................
      .P...........^..........^....D..
      ########..########...###########
      ########..########...###########
      ########..########...###########
      ########..########...###########`,
    traps: [
      { when: { x: 5 }, do: 'swap', say: 'Wait.' },
      { when: { x: 15 }, do: 'swap' },
      { when: { x: 21 }, do: 'swap', say: 'Wait!' },
    ],
  },
  {
    name: 'Past self',
    hint: 'Don’t look back.',
    ghost: 1.2,
    // from your second try on, your previous attempt chases you a second behind; don’t let it catch up
    map: `
      ........................................
      ........................................
      ........................................
      ........................................
      ...........#.............##.............
      .P.........#.....11......##..........D..
      ###############################..#######
      ###############################..#######
      ###############################..#######
      ###############################..#######`,
    traps: [
      { when: { x: 14 }, do: 'spikes', g: '1' },
      { when: { t: 0.2, tries: [2] }, do: 'say', say: 'Is that… you?' },
    ],
  },
  {
    name: 'Over your dead body',
    hint: 'You’ll get there. Eventually.',
    corpses: true,
    check: { corpses: [[11, 5], [16, 5]] },
    // the pit is too wide, but where you die you leave a solid body; land on the floating spikes to build a bridge
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      .P..........................D...
      #######....1....2....###########
      #######..............###########
      #######..............###########
      #######..............###########`,
    traps: [
      { when: { t: 0 }, do: 'spikes', g: '12' },
      { when: { t: 0.3, tries: [2] }, do: 'say', say: 'Some sacrifices are necessary.' },
    ],
  },
  {
    name: 'Don’t press it',
    hint: 'Whatever you do, don’t press the button.',
    button: 'Don’t press',
    check: { ui: ['button'] },
    // there is no way over the wall; the button in the corner that says not to press it removes the wall
    map: `
      ...............aa...............
      ...............aa...............
      ...............aa...............
      ...............aa...............
      ...............aa...............
      .P.............aa...........D...
      ################################
      ################################
      ################################
      ################################`,
    traps: [
      { when: { ui: 'button' }, do: 'vanish', g: 'a', say: 'You never listen. Good.' },
      { when: { touch: 'a' }, do: 'say', say: 'Solid. Like your decision-making.' },
    ],
  },
  {
    name: 'Something went wrong',
    hint: 'Nothing can go wrong here.',
    // a fake crash screen pops up and the level keeps running behind it; its Reload button kills you
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      .P...........^.....^^....^...D..
      ################################
      ################################
      ################################
      ################################`,
    traps: [
      { when: { x: 8 }, do: 'crash', seconds: 3.5 },
      { when: { ui: 'reload' }, do: 'kill', cause: 'trap', say: 'Did you just try to reload?' },
    ],
  },
  {
    name: 'Australia',
    hint: 'Business as usual.',
    // the whole view turns upside down; gravity and the controls don’t
    map: `
      ################################
      ################################
      ..............VV................
      ................................
      ................................
      ................................
      ................................
      .P.......^^............^.....D..
      ##################..############
      ##################..############`,
    traps: [
      { when: { x: 5 }, do: 'rotate', say: 'Australia mode.' },
      { when: { x: 26 }, do: 'rotate', say: 'Back home.' },
    ],
  },
  {
    name: 'Can’t stop',
    hint: 'Take your time.',
    // the runner starts running and won’t stop; you only control jumping
    map: `
      ................................
      ................................
      .....................##.........
      .....................VV.........
      ................................
      .P................^^.........D..
      #######..####..#########..######
      #######..####..#########..######
      #######..####..#########..######
      #######..####..#########..######`,
    traps: [
      { when: { t: 0.6 }, do: 'auto', dir: 1, say: 'Can’t stop. Won’t stop.' },
    ],
  },
  {
    name: 'Fourth wall',
    hint: 'The game is fine. Everything is fine.',
    button: 'Don’t press',
    check: { ui: ['button'] },
    // lag, swapped colours, lights out over stepping stones, a fake crash, and a wall only the button removes
    map: `
      .........................................................aa.....
      .........................................................aa.....
      .........................................................aa.....
      .........................................................aa.....
      .........................................................aa.....
      .........................................................aa.....
      .........................................................aa.....
      ........................###.........##...................aa.....
      .P.......^....^.................##......##......^...^....aa..D..
      ####################...#######..##..##..##..####################
      ####################...#######..............####################
      ####################...#######..............####################`,
    traps: [
      { when: { x: 4 }, do: 'lag', seconds: 0.2, say: 'Ping: 999 ms' },
      { when: { x: 17 }, do: 'lag', seconds: 0 },
      { when: { x: 18 }, do: 'swap', say: 'Which one is the floor?' },
      { when: { x: 28 }, do: 'swap' },
      { when: { x: 29 }, do: 'dark', radius: 3.5, say: 'Lights out.' },
      { when: { x: 44 }, do: 'dark', radius: 0 },
      { when: { x: 46 }, do: 'crash', seconds: 3 },
      { when: { ui: 'reload' }, do: 'kill', cause: 'trap', say: 'Still not a real crash.' },
      { when: { ui: 'button' }, do: 'vanish', g: 'a', say: 'Good.' },
    ],
  },
];
