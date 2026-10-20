// Chapter 12: Factory Floor. Conveyor belts that change their minds, presses that stamp, a saw on the night shift.
// Map key and trap options: README → "Adding a level". Run `node scripts/check-levels.mjs 12` after editing.
export default [
  {
    name: 'Clocking in',
    hint: 'The belt does the walking.',
    // the first belt carries you to the pit; the belt past it reverses the moment you land, back toward the spikes. Keep running
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      .P..........................D...
      aaaaaaaaaaaa...bbbbbbbbbbbb#####
      ############^^^#################
      ################################`,
    traps: [
      { when: { t: 0 }, do: 'belt', g: 'a', v: 3, say: 'Conveyor belt. Free legs.' },
      { when: { t: 0 }, do: 'belt', g: 'b', v: 3 },
      { when: { stand: 'b' }, do: 'belt', g: 'b', v: -4, say: 'Return to sender.' },
    ],
  },
  {
    name: 'Treadmill',
    hint: 'Walk it off.',
    // the belt runs back at exactly your speed, so walking gets you nowhere: hop along it (the air is belt-free). Then it gets faster
    map: `
      ....................................
      ....................................
      ....................................
      ....................................
      ....................................
      .P........^......^......^........D..
      ####aaaaaaaaaaaaaaaaaaaaaaaaaaa#####
      ####################################
      ####################################`,
    traps: [
      { when: { stand: 'a' }, do: 'belt', g: 'a', v: -6.5, say: 'Cardio day.' },
      { when: { x: 19 }, do: 'belt', g: 'a', v: -8.5, say: 'Leg day.' },
    ],
  },
  {
    name: 'Reverse gear',
    hint: 'Up the stairs. Easy.',
    // every jump flips the belts: odd jumps send them backward, off the step. Jump up, then hop once to flip them back
    map: `
      ..............................
      ..............................
      ..............................
      ............................D.
      ..........................####
      ..............................
      ....................aaaaa.....
      ..............................
      ..............aaaaa...........
      ..............................
      ........aaaaa.................
      .P............................
      ##aaaaa.......................
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^`,
    traps: [
      { when: { t: 0 }, do: 'belt', g: 'a', v: 2 },
      { when: { jumps: 1 }, do: 'belt', g: 'a', v: -6, say: 'Wrong way.' },
      { when: { jumps: 2 }, do: 'belt', g: 'a', v: 2, say: 'Every jump flips it.' },
      { when: { jumps: 3 }, do: 'belt', g: 'a', v: -6 },
      { when: { jumps: 4 }, do: 'belt', g: 'a', v: 2 },
      { when: { jumps: 5 }, do: 'belt', g: 'a', v: -6 },
      { when: { jumps: 6 }, do: 'belt', g: 'a', v: 2 },
      { when: { jumps: 7 }, do: 'belt', g: 'a', v: -6 },
      { when: { jumps: 8 }, do: 'belt', g: 'a', v: 2 },
      { when: { jumps: 9 }, do: 'belt', g: 'a', v: -6 },
      { when: { jumps: 10 }, do: 'belt', g: 'a', v: 2 },
    ],
  },
  {
    name: 'Stamping line',
    hint: 'Mind the machinery.',
    // ride the top belt off its end onto the bottom one, which runs back left under three spiked presses on a loop;
    // the door is under where you started. Time each press, and don’t jump under one
    map: `
      ..............................
      ..............................
      ..............................
      ..............................
      .P..........^.................
      ccccccccccccccccccccccccc.....
      ........dd.....ee.....gg......
      ..............................
      ..............................
      .....hhhhhhhhhhhhhhhhhhhhhhhhh
      ..............................
      ..............................
      .D............................
      ##############################`,
    traps: [
      { when: { t: 0 }, do: 'belt', g: 'c', v: 3, say: 'Please keep moving.' },
      { when: { t: 0 }, do: 'belt', g: 'h', v: -3 },
      { when: { stand: 'h' }, do: 'move', g: 'g', by: [0, 1], speed: 10, back: true, hold: 0.6, loop: true, spikes: 'd', slam: true, say: 'Stand clear of the presses.' },
      { when: { stand: 'h' }, do: 'move', g: 'e', by: [0, 1], speed: 10, back: true, hold: 0.6, loop: true, spikes: 'd', slam: true, delay: 0.45 },
      { when: { stand: 'h' }, do: 'move', g: 'd', by: [0, 1], speed: 10, back: true, hold: 0.6, loop: true, spikes: 'd', slam: true, delay: 0.9 },
    ],
  },
  {
    name: 'Hydraulic lift',
    hint: 'The door is up there. Good luck.',
    // the belt feeds you to a press that slams down the shaft; let it land, hop on its back and ride it up to the door
    map: `
      ............................
      ............................
      ............................
      ............................
      ........................D...
      ................aaa#########
      ...................#########
      ...................#########
      ...................#########
      ...................#########
      ...................#########
      ...................#########
      ...................#########
      .P.................#########
      bbbbbbbbbbbbbbbb############
      ############################`,
    traps: [
      { when: { t: 0 }, do: 'belt', g: 'b', v: 2 },
      { when: { x: 8 }, do: 'move', g: 'a', by: [0, 8], speed: 12, back: true, hold: 1.4, loop: true, spikes: 'd', slam: true, say: 'Hydraulic press.' },
    ],
  },
  {
    name: 'Return to sender',
    hint: 'Same-day delivery.',
    // the belts help you out to the key; grabbing it throws them all into reverse, fast. The pits come at you quicker on the way back
    map: `
      ........................................
      ........................................
      ........................................
      ........................................
      ........................................
      .D.P..................................*.
      #####aaaaaaaaa^^^bbbbbbbbb^^^ccccccccc##
      ########################################
      ########################################`,
    traps: [
      { when: { t: 0 }, do: 'belt', g: 'a', v: 3, say: 'Express delivery.' },
      { when: { t: 0 }, do: 'belt', g: 'b', v: 3 },
      { when: { t: 0 }, do: 'belt', g: 'c', v: 3 },
      { when: { keys: 1 }, do: 'belt', g: 'a', v: -6, say: 'Return to sender.' },
      { when: { keys: 1 }, do: 'belt', g: 'b', v: -6 },
      { when: { keys: 1 }, do: 'belt', g: 'c', v: -6 },
    ],
  },
  {
    name: 'Overtime',
    hint: 'Your shift is nearly over.',
    // the door is above the start: go right, climb, and come back along the catwalk, whose belt runs against you while
    // a saw rolls after you. Walking is too slow: hop
    map: `
      ..................................
      ..................................
      ..................................
      .D................................
      ###bbbbbbbbbbbbbbbbbbbbbbb........
      ..................................
      ............................##....
      ..................................
      ...............................###
      .P................................
      aaaaaaaaaaaaaaaaaaaaaaaaaaaa######
      ##################################`,
    traps: [
      { when: { t: 0 }, do: 'belt', g: 'a', v: 3 },
      { when: { t: 0 }, do: 'belt', g: 'b', v: 4 },
      { when: { stand: 'b' }, do: 'saw', from: [26.5, 4.5], chase: 3.2, say: 'Overtime. The saw insists.' },
    ],
  },
  {
    name: 'Stay in line',
    hint: 'Running is for amateurs.',
    // the presses are timed for passengers: stand still and the belt carries you under each one just after it lifts;
    // run and you arrive mid-stamp. The last press is timed the other way round: that one you sprint
    map: `
      ....................................
      ....................................
      ####################################
      ........a.....b.....c.....d.........
      ....................................
      .P................................D.
      eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee####
      ####################################
      ####################################`,
    traps: [
      { when: { t: 0 }, do: 'belt', g: 'e', v: 3, say: 'Sit back. The line does the work.' },
      { when: { x: 4.5 }, do: 'move', g: 'a', by: [0, 1], speed: 12, back: true, hold: 0.5, spikes: 'd', slam: true, delay: 0.25 },
      { when: { x: 10.5 }, do: 'move', g: 'b', by: [0, 1], speed: 12, back: true, hold: 0.5, spikes: 'd', slam: true, delay: 0.25 },
      { when: { x: 16.5 }, do: 'move', g: 'c', by: [0, 1], speed: 12, back: true, hold: 0.5, spikes: 'd', slam: true, delay: 0.25 },
      { when: { x: 24 }, do: 'move', g: 'd', by: [0, 1], speed: 12, back: true, hold: 1, spikes: 'd', slam: true, delay: 0.55, say: 'Except this one.' },
    ],
  },
  {
    name: 'Crane game',
    hint: 'Insert coin.',
    // the crane carries you over the spikes and up to the door, but its deck is a belt running off the back:
    // keep tapping forward without walking off the front
    map: `
      ..................................
      ..................................
      ..................................
      ...............................D..
      ............................######
      ............................######
      ............................######
      ............................######
      ..................................
      .P................................
      #####ccc..........................
      ..................................
      ..................................
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^`,
    traps: [
      { when: { stand: 'c' }, do: 'move', g: 'c', path: [[20, 0], [0, -6]], speed: 4, say: 'Hold on.' },
      { when: { stand: 'c' }, do: 'belt', g: 'c', v: -2 },
      { when: { x: 16 }, do: 'belt', g: 'c', v: -3.5, say: 'Turbulence.' },
    ],
  },
  {
    name: 'Factory reset',
    hint: 'Last shift. Make it count.',
    // the whole factory: a belt that reverses when you land, a treadmill to hop, presses timed for passengers,
    // the hydraulic lift up to the catwalk, and a saw chasing you along a catwalk that runs the wrong way
    map: `
      ........................................................
      ........................................................
      ........................................................
      ......................................................D.
      ...................................gggkkkkkkkkkkkkkkkk##
      ......................................##################
      ......................................##################
      ......................................##################
      ......................................##################
      ........................########......##################
      ..........................e...f.......##################
      ......................................##################
      .P................^...................##################
      aaaaaaa...bbbbbcccccccchhhhhhhhhhhh#####################
      #######^^^##############################################
      ########################################################`,
    traps: [
      { when: { t: 0 }, do: 'belt', g: 'a', v: 3, say: 'Clock in.' },
      { when: { t: 0 }, do: 'belt', g: 'b', v: 3 },
      { when: { stand: 'b' }, do: 'belt', g: 'b', v: -4, say: 'Return to sender.' },
      { when: { stand: 'c' }, do: 'belt', g: 'c', v: -6.5, say: 'Cardio.' },
      { when: { t: 0 }, do: 'belt', g: 'h', v: 2 },
      { when: { x: 22.5 }, do: 'move', g: 'e', by: [0, 1], speed: 12, back: true, hold: 0.5, spikes: 'd', slam: true, delay: 0.25, say: 'Stay in line.' },
      { when: { x: 26.5 }, do: 'move', g: 'f', by: [0, 1], speed: 12, back: true, hold: 0.5, spikes: 'd', slam: true, delay: 0.25 },
      { when: { x: 31 }, do: 'move', g: 'g', by: [0, 8], speed: 12, back: true, hold: 1.4, loop: true, spikes: 'd', slam: true, say: 'Going up?' },
      { when: { t: 0 }, do: 'belt', g: 'k', v: -4 },
      { when: { stand: 'k' }, do: 'saw', from: [36.5, 4.5], chase: 3, say: 'Overtime.' },
    ],
  },
];
