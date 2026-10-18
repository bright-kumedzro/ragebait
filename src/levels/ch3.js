// Chapter 3: The Basement. Gravity flips, floors leave, bridges hide, and nothing stays put.
// Map key and trap options: README → "Adding a level". Run `npm run check` after editing.
export default [
  {
    name: 'Upside down',
    hint: 'Nothing’s getting past those spikes.',
    // gravity flips to carry you over the spikes, and back
    map: `
      ################################
      ################################
      ...............VV...............
      ................................
      ................................
      ................................
      ................................
      .P.........^^^^^^^^^^^^......D..
      ################################
      ################################`,
    traps: [
      { when: { x: 8 }, do: 'flip', say: 'Up you go.' },
      { when: { x: 24 }, do: 'flip', say: 'And down.' },
    ],
  },
  {
    name: 'Stairway to heaven',
    hint: 'The floor will help. Mostly.',
    // pillars rise into steps as you go; the third keeps going, into the spikes
    map: `
      ################################
      .......VVVVVVVVVVVVVVVVV........
      ................................
      ................................
      .............................D..
      ........................########
      ........................########
      ........................########
      ..P.....................########
      #######.aa..bb..cc..dd..########
      #######.aa..bb..cc..dd..########
      #######.aa..bb..cc..dd..########`,
    traps: [
      { when: { x: 4 }, do: 'move', g: 'a', by: [0, -1], speed: 6 },
      { when: { stand: 'a' }, do: 'move', g: 'b', by: [0, -2], speed: 6 },
      { when: { stand: 'b' }, do: 'move', g: 'c', by: [0, -3], speed: 6 },
      { when: { stand: 'c' }, do: 'move', g: 'd', by: [0, -4], speed: 6 },
      { when: { stand: 'c' }, delay: 0.6, do: 'move', g: 'c', by: [0, -5], speed: 9 },
    ],
  },
  {
    name: 'The floor is leaving',
    hint: 'Take your time.',
    // the floor falls away behind you, one slab at a time; and something rolls in
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      .P...........................D.B
      aaaabbbbccccddddeeeeffffgggg####
      aaaabbbbccccddddeeeeffffgggg####
      aaaabbbbccccddddeeeeffffgggg####
      aaaabbbbccccddddeeeeffffgggg####`,
    traps: [
      { when: { t: 1.2 }, do: 'fall', g: 'a', shake: 0.3 },
      { when: { t: 1.9 }, do: 'fall', g: 'b', shake: 0.3 },
      { when: { t: 2.6 }, do: 'fall', g: 'c', shake: 0.3 },
      { when: { t: 3.3 }, do: 'fall', g: 'd', shake: 0.3 },
      { when: { t: 4.0 }, do: 'fall', g: 'e', shake: 0.3 },
      { when: { t: 4.7 }, do: 'fall', g: 'f', shake: 0.3 },
      { when: { t: 5.4 }, do: 'fall', g: 'g', shake: 0.3 },
      { when: { t: 1.5 }, do: 'balls', from: 'B', v: [-7, 0], n: 1, every: 2 },
    ],
  },
  {
    name: 'Bouncy castle',
    hint: 'Mind the bounce.',
    // bouncing balls lob in from the far corner on a loop
    map: `
      ................................
      ..............................C.
      ................................
      ................................
      ................................
      ................................
      ................................
      ................................
      .P..........................D...
      ################################
      ################################
      ################################`,
    traps: [
      { when: { t: 0.3 }, do: 'balls', from: 'C', v: [-6, -3], bounce: 0.85, n: 1, every: 1.1 },
    ],
  },
  {
    name: 'Flip flop',
    hint: 'Jump.',
    // every jump flips gravity
    map: `
      ################################
      ................VVVVV...........
      ................................
      ................................
      ................................
      ................................
      .P......^^^^^...........^^^..D..
      ################################
      ################################`,
    traps: [
      { when: { jump: true }, do: 'flip', repeat: true },
    ],
  },
  {
    name: 'Blind faith',
    hint: 'Just walk. Trust me.',
    // an invisible bridge, a real gap in it, and a bit of real floor that isn’t
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      ................................
      .P...........................D..
      #########aaaaaa..bbbbbbcc#######
      #########..............cc#######
      #########..............cc#######`,
    traps: [
      { when: { touch: 'a' }, do: 'reveal', g: 'a' },
      { when: { touch: 'b' }, do: 'reveal', g: 'b' },
      { when: { stand: 'c' }, do: 'vanish', g: 'c', say: 'Trust me, I said.' },
    ],
  },
  {
    name: 'Door dash',
    hint: 'It’s right there.',
    // the door hops from platform to platform
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      ..............R.................
      ...........######...............
      .....Q.................S........
      ...######...........######......
      .P...........................D..
      ################################
      ################################`,
    traps: [
      { when: { near: 2.5 }, do: 'door', to: 'Q', say: 'Catch me.' },
      { when: { near: 2.5, after: 0 }, do: 'door', to: 'R' },
      { when: { near: 2.5, after: 1 }, do: 'door', to: 'S', say: 'Last one. Promise.' },
    ],
  },
  {
    name: 'Mixed signals',
    hint: 'Left, right, up, down.',
    // swapped controls, then flipped gravity on top
    map: `
      ################################
      ################################
      ..................VV............
      ................................
      ................................
      ................................
      ................................
      .P........^^.............^^...D.
      ################################
      ################################`,
    traps: [
      { when: { x: 6 }, do: 'reverse', say: 'Left is right.' },
      { when: { x: 14 }, do: 'flip' },
      { when: { x: 22 }, do: 'flip' },
      { when: { x: 22 }, do: 'reverse', say: 'Back to normal. Probably.' },
    ],
  },
  {
    name: 'Crumble',
    hint: 'Light feet.',
    // every block gives way a moment after you land
    map: `
      ################################
      .....VVVVVVVVVVVVVVVVVVVVVV.....
      ................................
      ................................
      ................................
      ..............................D.
      ................d.....f....#####
      .P........b........e.....g.#####
      #####..a.....c.............#####
      #####......................#####
      #####......................#####
      #####......................#####`,
    traps: [
      { when: { stand: 'a' }, do: 'fall', g: 'a', shake: 0.25 },
      { when: { stand: 'b' }, do: 'fall', g: 'b', shake: 0.25 },
      { when: { stand: 'c' }, do: 'fall', g: 'c', shake: 0.25 },
      { when: { stand: 'd' }, do: 'fall', g: 'd', shake: 0.25 },
      { when: { stand: 'e' }, do: 'fall', g: 'e', shake: 0.25 },
      { when: { stand: 'f' }, do: 'fall', g: 'f', shake: 0.25 },
      { when: { stand: 'g' }, do: 'fall', g: 'g', shake: 0.25 },
    ],
  },
  {
    name: 'Rock bottom',
    hint: 'The last door. Probably real.',
    // an invisible bridge, a ceiling walk, crumbling blocks, swapped controls and one last door that bites
    map: `
      ################################################################
      ..................VV............................................
      ................................................................
      ................................................................
      ................................................................
      ................................................................
      ................................................................
      ................................................................
      .P.............^^^^^^^^........c...........^..^^......Q...F...D.
      #####aaaaaaa###############.b.....d..###########################
      #####.......###############..........###########################
      #####.......###############..........###########################`,
    traps: [
      { when: { touch: 'a' }, do: 'reveal', g: 'a' },
      { when: { x: 13 }, do: 'flip', say: 'Again?' },
      { when: { x: 24 }, do: 'flip' },
      { when: { stand: 'b' }, do: 'fall', g: 'b', shake: 0.25 },
      { when: { stand: 'c' }, do: 'fall', g: 'c', shake: 0.25 },
      { when: { stand: 'd' }, do: 'fall', g: 'd', shake: 0.25 },
      { when: { x: 39 }, do: 'reverse', say: 'Of course.' },
      { when: { x: 50 }, do: 'reverse' },
      { when: { near: 2.5 }, do: 'door', to: 'Q', say: 'One more time.' },
    ],
  },
];
