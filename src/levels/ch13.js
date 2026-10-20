// Chapter 13: Black Ice. Floors you can’t stop on, winds that change their minds, and doors right at the edge.
// Map key and trap options: README → "Adding a level". Run `node scripts/check-levels.mjs 13` after editing.
export default [
  {
    name: 'Black ice',
    hint: 'Grippy.',
    // the ground turns to ice over the first pit: land on an island at full speed and you slide straight off the far side.
    // Let go of right in the air, so you land standing
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      ................................
      .P............................D.
      ######...###...###...###...#####
      ######...###...###...###...#####
      ######^^^###^^^###^^^###^^^#####`,
    traps: [
      { when: { x: 7 }, do: 'ice', say: 'Black ice.' },
    ],
  },
  {
    name: 'Cliffhanger',
    hint: 'The door is on the other side.',
    // the runway turns to ice and you can’t stop before the cliff; the door across the pit bites. The real one is tucked
    // under the cliff behind you: drop off and steer back left in the air
    map: `
      ..............................
      ..............................
      ..............................
      ..............................
      .P............................
      ####################..........
      #############.................
      #############.................
      #############.................
      #############....D.........F..
      ####################......###.
      ####################......###.
      ####################......###.
      ####################^^^^^^###^`,
    traps: [
      { when: { x: 6 }, do: 'ice', say: 'No brakes.' },
    ],
  },
  {
    name: 'Tailwind',
    hint: 'The wind is on your side.',
    // a tailwind doubles every jump, so you sail past the little ledges into the spikes: hold left in the air, and
    // hold left to stand still. Then it turns into a headwind for the last gap: jump from the very edge
    map: `
      ........................................
      ........................................
      ........................................
      ........................................
      ........................................
      ........................................
      .P...................................D..
      ######......##.....##.....###...########
      ######......##.....##.....###...########
      ######^^^^^^##^^^^^##^^^^^###^^^########`,
    traps: [
      { when: { x: 4 }, do: 'wind', v: 5, say: 'Tailwind!' },
      { when: { x: 27 }, do: 'wind', v: -1.5, say: 'Wind changed.' },
    ],
  },
  {
    name: 'Stop fighting it',
    hint: 'Just relax.',
    // the door is behind you, and the wind is stronger than your legs. Stop pressing anything and it dies down.
    // It gusts again past the post: lean on the post, let go, wait
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      ................................
      .D..........#.....P.............
      #####...########################
      #####...########################
      #####^^^########################`,
    traps: [
      { when: { t: 0.3 }, do: 'wind', v: 9, say: 'Breezy.' },
      { when: { idle: 0.8, after: 0 }, do: 'wind', v: 0, say: 'Stop fighting it.' },
      { when: { x: 11, left: true, after: 1 }, do: 'wind', v: 9, say: 'Gust!' },
      { when: { idle: 0.8, after: 2 }, do: 'wind', v: 0, say: 'Good. Breathe.' },
    ],
  },
  {
    name: 'Wind tunnel',
    hint: 'Mind the draught.',
    // climb the shaft ledge by ledge; every time you land, the wind swings round to blow you off the ledge you’re on.
    // Lean into it and jump with it
    map: `
      #............#
      #............#
      #.........D..#
      #.......######
      #............#
      ######.......#
      #............#
      #.......######
      #............#
      ######.......#
      #............#
      #.......######
      #............#
      ######.......#
      #............#
      #.......######
      #.P..........#
      ######.......#
      #............#
      #^^^^^^^^^^^^#`,
    traps: [
      { when: { t: 0.4 }, do: 'wind', v: 5, say: 'Mind the draught.' },
      { when: { land: true, zone: [8, 14, 12, 14] }, do: 'wind', v: -5, say: 'Wind change.' },
      { when: { land: true, zone: [1, 12, 5, 12] }, do: 'wind', v: 5 },
      { when: { land: true, zone: [8, 10, 12, 10] }, do: 'wind', v: -5 },
      { when: { land: true, zone: [1, 8, 5, 8] }, do: 'wind', v: 5 },
      { when: { land: true, zone: [8, 6, 12, 6] }, do: 'wind', v: -5 },
      { when: { land: true, zone: [1, 4, 5, 4] }, do: 'wind', v: 5, say: 'Nearly there.' },
    ],
  },
  {
    name: 'Thin ice',
    hint: 'Tread lightly.',
    // every step cracks a moment after you stand on it, and on ice you can’t get going fast enough to walk off in time.
    // Jumping doesn’t care about ice: hop, and keep hopping
    map: `
      ..............................
      ...........................D..
      ....................##########
      ..............................
      ................eee...........
      ..............................
      ............ddd...............
      ..............................
      ........ccc...................
      ..............................
      ....bbb.......................
      .P............................
      aaa...........................
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^`,
    traps: [
      { when: { t: 0 }, do: 'ice' },
      { when: { stand: 'a' }, do: 'fall', g: 'a', shake: 0.35, say: 'Crack.' },
      { when: { stand: 'b' }, do: 'fall', g: 'b', shake: 0.35 },
      { when: { stand: 'c' }, do: 'fall', g: 'c', shake: 0.35 },
      { when: { stand: 'd' }, do: 'fall', g: 'd', shake: 0.35 },
      { when: { stand: 'e' }, do: 'fall', g: 'e', shake: 0.35 },
    ],
  },
  {
    name: 'Skating rink',
    hint: 'Free skate.',
    // three keys around an icy rink with spikes in the middle. Every landing slides: the middle platform and the high
    // ledge are short, so let go in the air before you touch down
    map: `
      #........................#
      #........................#
      #........................#
      #...................*....#
      #................####....#
      #...........*............#
      #..........####..........#
      #........................#
      #......##........##......#
      #D..P..................*.#
      ##########^^^^^^##########
      ##########################`,
    traps: [
      { when: { t: 0 }, do: 'ice', say: 'Rink’s open.' },
    ],
  },
  {
    name: 'Gusts',
    hint: 'Calm conditions all day.',
    // gusts every few seconds, stronger than you can run; one mid-jump blows you back into a pit. Each platform has a
    // post at the back to lean on: cross right after a gust ends, then lean on the next post
    map: `
      ........................................
      ........................................
      ........................................
      ........................................
      ........................................
      .P.......#........#........#.........D..
      #######..#######..#######..#############
      #######..#######..#######..#############
      #######^^#######^^#######^^#############`,
    traps: [
      { when: { t: 2.0 }, do: 'wind', v: -9, say: 'Gust!' },
      { when: { t: 3.2 }, do: 'wind', v: 0 },
      { when: { t: 4.6 }, do: 'wind', v: -9, say: 'Gust!' },
      { when: { t: 5.8 }, do: 'wind', v: 0 },
      { when: { t: 7.2 }, do: 'wind', v: -9, say: 'Gust!' },
      { when: { t: 8.4 }, do: 'wind', v: 0 },
      { when: { t: 9.8 }, do: 'wind', v: -9, say: 'Gust!' },
      { when: { t: 11.0 }, do: 'wind', v: 0 },
      { when: { t: 12.4 }, do: 'wind', v: -9, say: 'Gust!' },
      { when: { t: 13.6 }, do: 'wind', v: 0 },
      { when: { t: 15.0 }, do: 'wind', v: -9, say: 'Gust!' },
      { when: { t: 16.2 }, do: 'wind', v: 0 },
    ],
  },
  {
    name: 'Snowfall',
    hint: 'Watch the forecast.',
    // the door is at the bottom of the shaft: drop through the gaps from icy ledge to icy ledge. Land moving fast and
    // you slide into the spikes on the wall, and a crosswind keeps shoving you toward them. Steer in the air
    map: `
      #..............#
      #..............#
      #.P............#
      ###########....#
      #..............#
      #..............#
      #.............<#
      #....###########
      #..............#
      #..............#
      #>.............#
      ###########....#
      #..............#
      #..............#
      #.............<#
      #....###########
      #..............#
      #..............#
      #..............#
      #.D............#
      #####^^^^^^^^^^#
      ################`,
    traps: [
      { when: { t: 0 }, do: 'ice', say: 'Forecast: icy.' },
      { when: { y: 4 }, do: 'wind', v: 2, say: 'Crosswind.' },
      { when: { y: 8 }, do: 'wind', v: -2 },
      { when: { y: 12 }, do: 'wind', v: 2, say: 'Make up your mind.' },
      { when: { y: 16 }, do: 'wind', v: -2 },
    ],
  },
  {
    name: 'Whiteout',
    hint: 'Visibility: excellent.',
    // the whole chapter: cracking ice to hop off, a tailwind over the big pit onto a small ledge, a wind that quits
    // mid-jump, a headwind you only beat by letting go, and a cliff with the real door tucked underneath
    map: `
      ........................................................
      ........................................................
      ........................................................
      ........................................................
      ........................................................
      ........................................................
      ........................................................
      ........................................................
      .P...................#..................................
      aabb######......###..#####################..............
      ....######......###..###############....................
      ....######......###..###############..............F.....
      ....######......###..###############...D.........###....
      ....######......###..#####################.......###....
      ....######......###..#####################.......###....
      ^^^^######^^^^^^###^^#####################^^^^^^^###^^^^`,
    traps: [
      { when: { t: 0 }, do: 'ice', say: 'Whiteout.' },
      { when: { stand: 'a' }, do: 'fall', g: 'a', shake: 0.3 },
      { when: { stand: 'b' }, do: 'fall', g: 'b', shake: 0.3 },
      { when: { x: 8 }, do: 'wind', v: 5, say: 'Tailwind!' },
      { when: { x: 19.5 }, do: 'wind', v: 0, say: 'Wind’s gone.' },
      { when: { x: 23 }, do: 'wind', v: -9, say: 'Headwind.' },
      { when: { idle: 0.8, after: 5 }, do: 'wind', v: 0, say: 'Stop fighting it.' },
    ],
  },
];
