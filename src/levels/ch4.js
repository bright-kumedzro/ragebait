// Chapter 4: Emotional Damage. The levels troll you, not just the runner: fake wins, fake checkpoints, traps
// that change once you've learned them, a mirrored screen, speed traps, invisible spikes and a pause button that kills.
// Map key and trap options: README → "Adding a level". Run `npm run check` after editing.
export default [
  {
    name: 'Free win',
    hint: 'You deserve this one.',
    fakeWin: 1,
    // touching the door shows a fake "cleared" card; next try the door runs off; the try after, it’s real
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      .P..Q.......................D...
      ################################
      ################################
      ################################
      ################################`,
    traps: [
      { when: { near: 2.5, tries: [2, 2] }, do: 'door', to: 'Q', say: 'Again?' },
    ],
  },
  {
    name: 'It learns',
    hint: 'You know this one.',
    // odd tries: the floor drops, so jump. Even tries: the floor stays, and jumping pops spikes where you land
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      .P..............111.........D...
      #############aaa################
      #############aaa################
      #############aaa################
      #############aaa################`,
    traps: [
      { when: { x: 11, tries: 'odd' }, do: 'fall', g: 'a' },
      { when: { jump: true, zone: [8, 0, 14, 9], tries: 'even' }, do: 'spikes', g: '1', say: 'I learn.' },
    ],
  },
  {
    name: 'Checkpoint!',
    hint: 'Halfway there. It saves, don’t worry.',
    // the checkpoint is fake: die after it and you start again from the very beginning
    map: `
      ................................................
      ................................................
      ................................................
      .................................####...........
      ................................................
      .P..................K......11................D.B
      ##########aaa###################################
      ##########aaa###################################
      ##########aaa###################################
      ##########aaa###################################`,
    traps: [
      { when: { x: 8 }, do: 'fall', g: 'a' },
      { when: { x: 20 }, do: 'checkpoint' },
      { when: { x: 25 }, do: 'spikes', g: '1' },
      { when: { x: 30 }, do: 'balls', from: 'B', v: [-10, 0], n: 6, gap: 0.15 },
    ],
  },
  {
    name: 'Patience',
    hint: 'Quick! Run!',
    // move in the first 3 seconds and the floor goes; stand still and the door walks over to you
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      ...P.Q.......................D..
      aa###aaaaaaaaaaaaaaaaaaaaaaaaaaa
      aa###aaaaaaaaaaaaaaaaaaaaaaaaaaa
      aa###aaaaaaaaaaaaaaaaaaaaaaaaaaa
      aa###aaaaaaaaaaaaaaaaaaaaaaaaaaa`,
    traps: [
      { when: { before: 3, x: 4.1 }, do: 'fall', g: 'a', say: 'I said patience.' },
      { when: { before: 3, x: 2.9, left: true }, do: 'fall', g: 'a', say: 'Not that way either.' },
      { when: { t: 3 }, do: 'door', to: 'Q', speed: 9, say: 'Good things come to those who wait.' },
    ],
  },
  {
    name: 'Mirror mirror',
    hint: 'Just keep going right.',
    // the screen flips left to right while right still means right; then flips back; then again
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      .P.........^^....^....^^...^..D.
      ################################
      ################################
      ################################
      ################################`,
    traps: [
      { when: { x: 6 }, do: 'mirror', say: 'Wait, what?' },
      { when: { x: 19 }, do: 'mirror', say: 'Better?' },
      { when: { x: 25 }, do: 'mirror', say: 'lol' },
    ],
  },
  {
    name: 'Zoom',
    hint: 'Take it slow.',
    // double speed over the pits, then half speed right before the last gap
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      .P...................^.......D..
      #########..####...########.#####
      #########..####...########.#####
      #########..####...########.#####
      #########..####...########.#####`,
    traps: [
      { when: { x: 4 }, do: 'speed', factor: 2, say: 'Zoom.' },
      { when: { x: 23 }, do: 'speed', factor: 0.5, say: 'Too fast? Fine.' },
    ],
  },
  {
    name: 'No breaks',
    hint: 'Take a break whenever you need one.',
    // crushers on a loop; and the pause button kills you
    map: `
      ################################
      ################################
      #####aaa###bbb###ccc###ddd######
      ................................
      ................................
      .P............................D.
      ################################
      ################################
      ################################
      ################################`,
    traps: [
      { when: { ui: 'pause' }, do: 'kill', cause: 'trap', say: 'No breaks.' },
      { when: { t: 0 }, do: 'move', g: 'a', by: [0, 3], speed: 9, back: true, loop: true, hold: 0.5, spikes: 'd', slam: true },
      { when: { t: 0.35 }, do: 'move', g: 'b', by: [0, 3], speed: 9, back: true, loop: true, hold: 0.5, spikes: 'd', slam: true },
      { when: { t: 0.7 }, do: 'move', g: 'c', by: [0, 3], speed: 9, back: true, loop: true, hold: 0.5, spikes: 'd', slam: true },
      { when: { t: 1.05 }, do: 'move', g: 'd', by: [0, 3], speed: 9, back: true, loop: true, hold: 0.5, spikes: 'd', slam: true },
    ],
  },
  {
    name: 'Totally safe',
    hint: 'Totally safe. I checked.',
    // invisible spikes, including right where you land after the bump; the x marks where you died are the only map
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      .P......11..#.22......33.....D..
      ################################
      ################################
      ################################
      ################################`,
    traps: [
      { when: { t: 0 }, do: 'spikes', g: '123', invisible: true },
    ],
  },
  {
    name: 'Shortest level ever',
    hint: 'Two steps. Go on.',
    // try 1: the door runs to the far end through popping spikes. Try 2: a spike guards it. Try 3: it gives up
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      .P.1D.......22......33.......Q..
      ################################
      ################################
      ################################
      ################################`,
    traps: [
      { when: { x: 2, tries: [1, 1] }, do: 'door', to: 'Q', say: 'Nope.' },
      { when: { x: 10, tries: [1, 1] }, do: 'spikes', g: '2' },
      { when: { x: 18, tries: [1, 1] }, do: 'spikes', g: '3' },
      { when: { x: 1.9, tries: [2, 2] }, do: 'spikes', g: '1', say: 'Jump?' },
      { when: { t: 0.3, tries: [3] }, do: 'say', say: 'Fine. Just go.' },
    ],
  },
  {
    name: 'Emotional damage',
    hint: 'Last level. Promise.',
    fakeWin: 1,
    // mirror, a fake checkpoint, a floor that learns, invisible spikes, double speed, and a door that lies once
    map: `
      ................................................................
      ................................................................
      ................................................................
      ................................................................
      ................................................................
      .P.......^...^^....K.......111...2....2......................D..
      ########################aaa#################...#################
      ########################aaa#################...#################
      ########################aaa#################...#################
      ########################aaa#################...#################`,
    traps: [
      { when: { x: 5 }, do: 'mirror', say: 'Remember me?' },
      { when: { x: 17 }, do: 'mirror' },
      { when: { x: 19 }, do: 'checkpoint' },
      { when: { x: 22, tries: 'odd' }, do: 'fall', g: 'a' },
      { when: { jump: true, zone: [20, 0, 26, 9], tries: 'even' }, do: 'spikes', g: '1', say: 'I remember.' },
      { when: { t: 0 }, do: 'spikes', g: '2', invisible: true },
      { when: { x: 40 }, do: 'speed', factor: 2, say: 'Zoom.' },
      { when: { x: 50 }, do: 'speed', factor: 1 },
    ],
  },
];
