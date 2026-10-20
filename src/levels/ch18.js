// Chapter 18: Read the Signs. Signposts that lie, tell the truth when you expect a lie, and change their story once you trust them.
// Map key and trap options: README → "Adding a level". Run `node scripts/check-levels.mjs 18` after editing.
export default [
  {
    name: 'Reading is fun',
    hint: 'Do what the signs say.',
    // the first two signs are honest (JUMP the gap, SPIKES are spikes); NO SPIKES pops spikes in your face. Jump them
    map: `
      ................................
      ................................
      ................................
      ................................
      .P...A......B..^^....C..111..D..
      #######...######################
      #######...######################`,
    signs: [['A', 'JUMP'], ['B', 'SPIKES'], ['C', 'NO SPIKES']],
    traps: [
      { when: { x: 22.5 }, do: 'spikes', g: '1', say: 'Signs can lie. Who knew.' },
      { when: { after: 0 }, do: 'sign', i: 2, text: 'SOME SPIKES' },
    ],
  },
  {
    name: 'Safe route',
    hint: 'Pick the safe one.',
    // SAFE → is a bridge that drops into spikes; ← DEATH is a hole down into a corridor that leads to the door
    map: `
      ..............................
      ..............................
      ..............................
      ..............................
      ...A.PB.......................
      #..####aaaaaaaaaaaa#####..####
      #..####............#####..####
      #..####............#####..####
      #..####^^^^^^^^^^^^#####..####
      #..#####################..####
      #.............................
      #.............................
      #.............................
      #..........^^.......^^.....D..
      ##############################`,
    signs: [['A', '← DEATH'], ['B', 'SAFE →']],
    traps: [
      { when: { stand: 'a', x: 10 }, do: 'fall', g: 'a', say: 'Safe for who?' },
      { when: { after: 0 }, do: 'sign', i: 1, text: 'UNSAFE' },
      { when: { zone: [1, 10, 29, 13] }, do: 'sign', i: 0, text: '← MOSTLY FINE' },
    ],
  },
  {
    name: 'This way out',
    hint: 'Follow the arrow.',
    // EXIT → points at a fake door past the spikes; the real door is on a shelf above and behind you. Climb left
    map: `
      ................................
      .D..............................
      ###.............................
      ................................
      .....##.........................
      ................................
      .##.............................
      ................................
      .....##.........................
      ................................
      .##.............................
      ...P.....A.....^.......^.....F..
      ################################`,
    signs: [['A', 'EXIT →']],
    traps: [
      { when: { y: 8, up: true }, do: 'sign', i: 0, text: 'FINE. ↑' },
      { when: { x: 26 }, do: 'say', say: 'Almost out. Promise.' },
    ],
  },
  {
    name: 'Do not jump',
    hint: 'Just this once, it’s true.',
    // the sign is honest: any jump fills the low ceilings with spikes. Drop down the holes (right, left, right) and
    // walk across the "pit" under JUMP!: it has an invisible floor
    map: `
      ########################
      111111111111111111111111
      .P.A....................
      ####################..##
      11111111111111111111..11
      ........................
      ##..####################
      11..11111111111111111111
      ..........B...........D.
      ##############bbbb######
      ##############....######
      ##############....######
      ##############^^^^######`,
    signs: [['A', 'DO NOT JUMP'], ['B', 'JUMP!']],
    traps: [
      { when: { jump: true }, do: 'spikes', g: '1', say: 'It said DO NOT JUMP.' },
      { when: { touch: 'b' }, do: 'reveal', g: 'b', say: 'Still not jumping? Good.' },
      { when: { after: 1 }, do: 'sign', i: 1, text: 'JUMP! (DON’T)' },
    ],
  },
  {
    name: 'Red light, green light',
    hint: 'Obey the traffic lights.',
    // the first light is honest: it turns STOP as its crusher slams, then GO. The second says GO and slams anyway:
    // creep up to it, let it drop in front of you, go when it's back up
    map: `
      ################################
      ........aa..........bb..........
      ........aa..........bb..........
      ................................
      ................................
      ................................
      .P...A...........B...........D..
      ################################`,
    signs: [['A', 'GO'], ['B', 'GO']],
    traps: [
      { when: { x: 4 }, do: 'move', g: 'a', by: [0, 4], speed: 14, back: true, hold: 0.8, slam: true, say: 'Red light.' },
      { when: { after: 0 }, do: 'sign', i: 0, text: 'STOP' },
      { when: { after: 0 }, delay: 1.4, do: 'sign', i: 0, text: 'GO' },
      { when: { x: 18.5 }, do: 'move', g: 'b', by: [0, 4], speed: 16, back: true, hold: 0.8, slam: true, say: 'Psych.' },
      { when: { after: 3 }, do: 'sign', i: 1, text: 'JK' },
      { when: { after: 3 }, delay: 1.35, do: 'sign', i: 1, text: 'GO. REALLY.' },
    ],
  },
  {
    name: 'Trust the fall',
    hint: 'Pits are bad. Everyone knows that.',
    wrap: true,
    // falling out of the bottom drops you in at the top. DOOR → leads to a pit that drops you on spikes;
    // DOOR ↓ is the truth: fall down the pit behind you and you land next to the door
    map: `
      ............................
      ............................
      ..D...........^^^^..........
      .#####........####..........
      ............................
      ............................
      ............................
      ............................
      ............................
      ............................
      ....A...P....B..............
      ##..##########....##########`,
    signs: [['A', 'DOOR ↓'], ['B', 'DOOR →']],
    traps: [
      { when: { x: 6, left: true }, do: 'sign', i: 0, text: 'TRUST ME' },
      { when: { t: 0, tries: [2] }, do: 'sign', i: 1, text: 'DOOR →?' },
    ],
  },
  {
    name: 'Wrong number',
    hint: 'Three portals. Clearly labelled.',
    portals: [['A', 'E'], ['B', 'G'], ['C', 'H']],
    // DOOR sends you over a spike pit, EXIT drops you back at the start, SPIKES takes you next to the door
    // (one small spike on the way). Jump over the first two portals
    map: `
      ..............................
      ..............................
      ..............................
      ....E.......##................
      ............##................
      ............##................
      ^^^^^^^^^^^^##...G.....^....D.
      ##############################
      ..............................
      ..H...........................
      ..............................
      .P.....LA....MC....NB.........
      ##############################`,
    signs: [['L', 'DOOR'], ['M', 'EXIT'], ['N', 'SPIKES']],
    traps: [
      { when: { zone: [14, 0, 29, 6] }, do: 'sign', i: 2, text: 'ONE SPIKE' },
      { when: { zone: [0, 0, 11, 6] }, do: 'say', say: 'Wrong number.' },
    ],
  },
  {
    name: 'Simon says',
    hint: 'Simple rules.',
    // only signs that start with SIMON SAYS are true. Jump the spikes; don't WAIT HERE on the crumbling floor;
    // wait for the saw; ignore EXIT → (a fake door) and climb up to the real one
    map: `
      ................................................
      ................................................
      ........................................D.......
      .......................................###......
      ................................................
      ....................................##..........
      ................................................
      .................................##.............
      .P.A..^^.....B....C...........G............H..F.
      ############aaa#################################
      ############...#################################`,
    signs: [['A', 'SIMON SAYS JUMP'], ['B', 'WAIT HERE'], ['C', 'SIMON SAYS WAIT'], ['G', 'SIMON SAYS ↑'], ['H', 'EXIT →']],
    traps: [
      { when: { stand: 'a' }, do: 'fall', g: 'a', shake: 0.7, say: 'Simon didn’t say.' },
      { when: { x: 19 }, do: 'saw', from: [21.5, 10.6], path: [[21.5, 8.5]], speed: 5, back: true, hold: 0.6, say: 'Simon says wait.' },
    ],
  },
  {
    name: 'Do not pull',
    hint: 'Pull the one that says pull.',
    // PULL ME drops a spiked ceiling on you. DO NOT PULL opens the wall by the door. On the top shelf, PULL ME TOO
    // drops the floor under it: hop over it
    map: `
      ......w...............
      ......w...............
      .D....w..../.B........
      ##########sss####.....
      ......................
      ...................###
      ...................ccc
      ...............###.ccc
      ...........C./........
      ...........###........
      ......................
      .......###............
      .P...............A../.
      ######################`,
    signs: [['A', 'PULL ME'], ['C', 'DO NOT PULL'], ['B', 'PULL ME TOO']],
    traps: [
      { when: { lever: 2 }, delay: 0.1, do: 'move', g: 'c', by: [0, 5], speed: 16, spikes: 'd', slam: true, say: 'It did say pull.' },
      { when: { lever: 1 }, do: 'vanish', g: 'w', say: 'Rebel.' },
      { when: { lever: 1 }, do: 'sign', i: 1, text: 'OK FINE' },
      { when: { lever: 0 }, do: 'fall', g: 's', say: 'You pulled it.' },
      { when: { lever: 0 }, do: 'sign', i: 2, text: 'LOL' },
    ],
  },
  {
    name: 'Read the signs',
    hint: 'Read carefully.',
    // the chapter back to back: DO NOT JUMP is true in the low corridor (and JUMP! hides an invisible floor),
    // SAFE drops, the GO light slams, PULL ME pops spikes, DO NOT PULL builds steps up to NOT A DOOR, and EXIT bites
    map: `
      ................................cc..........................
      ................................cc..........................
      ................................cc..........................
      ................................cc..........................
      ................................cc..........................
      ................................cc....................JD....
      .....................................................####...
      ####################........................................
      11111111111111111111..............................22........
      .P.A.....B...........C.......E.........H33/33..I/.......L.F.
      ############bbbb#######aaa##################################
      ############....#######...##################################
      ############^^^^#######...##################################`,
    signs: [['A', 'DO NOT JUMP'], ['B', 'JUMP!'], ['C', 'SAFE →'], ['E', 'GO'], ['H', 'PULL ME'], ['I', 'DO NOT PULL'], ['J', 'NOT A DOOR'], ['L', 'EXIT →']],
    traps: [
      { when: { jump: true, zone: [0, 0, 19, 12] }, do: 'spikes', g: '1', say: 'It said DO NOT JUMP.' },
      { when: { touch: 'b' }, do: 'reveal', g: 'b' },
      { when: { stand: 'a' }, do: 'fall', g: 'a', say: 'Safe-ish.' },
      { when: { x: 30.5 }, do: 'move', g: 'c', by: [0, 4], speed: 16, back: true, hold: 0.8, slam: true, say: 'Red light.' },
      { when: { after: 3 }, do: 'sign', i: 3, text: 'JK' },
      { when: { after: 3 }, delay: 1.3, do: 'sign', i: 3, text: 'GO' },
      { when: { lever: 0 }, do: 'spikes', g: '3', say: 'You read it. You did it.' },
      { when: { lever: 1 }, do: 'show', g: '2', say: 'Good. Never listen.' },
      { when: { lever: 1 }, do: 'sign', i: 5, text: 'FINE' },
      { when: { near: 2.5 }, do: 'sign', i: 6, text: 'OK IT IS' },
    ],
  },
];
