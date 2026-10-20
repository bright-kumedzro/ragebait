// Chapter 6: Buzzkill. Buzzsaws that cut up out of the floor, drop from the ceiling, chase you and park where you want to stand.
// Map key and trap options: README → "Adding a level". Run `node scripts/check-levels.mjs 6` after editing.
export default [
  {
    name: 'Fresh cut',
    hint: 'Watch your step.',
    // a big saw cuts up out of the floor ahead and rolls at you: jump it. A second one pops up right in front of the door
    map: `
      ................................
      ................................
      ................................
      ................................
      ................................
      .P............................D.
      ################################
      ################################`,
    traps: [
      { when: { x: 7 }, do: 'saw', from: [18.5, 6.5], r: 1.1, path: [[1.5, 6.5]], speed: 5, say: 'Fresh cut.' },
      { when: { x: 24 }, do: 'saw', from: [27.5, 6.5], say: 'Seconds?' },
    ],
  },
  {
    name: 'Hot potato',
    hint: 'Take a breather on each step.',
    // a staircase of single stones down over spikes; a saw cuts up through each stone a moment after you land on it,
    // so never stop: land and hop straight on
    map: `
      ..............................
      ..............................
      .P............................
      #####.........................
      #####..a......................
      #####.....b...................
      #####........c................
      #####...........d.............
      #####..............e..........
      #####......................D..
      #####..................#######
      #####..................#######
      #####^^^^^^^^^^^^^^^^^^#######
      ##############################`,
    traps: [
      { when: { stand: 'a' }, do: 'saw', from: [7.5, 4.5], delay: 0.45, say: 'Hot potato!' },
      { when: { stand: 'b' }, do: 'saw', from: [10.5, 5.5], delay: 0.35 },
      { when: { stand: 'c' }, do: 'saw', from: [13.5, 6.5], delay: 0.35 },
      { when: { stand: 'd' }, do: 'saw', from: [16.5, 7.5], delay: 0.35, say: 'Don’t get comfy.' },
      { when: { stand: 'e' }, do: 'saw', from: [19.5, 8.5], delay: 0.35 },
    ],
  },
  {
    name: 'Elevator pitch',
    hint: 'Take the stairs. No rush.',
    // a giant saw grinds up the shaft from below; climb the zigzag of ledges faster than it does. One ledge drops
    map: `
      ####......D.....####
      ####..#######...####
      ####............####
      ####.......####.####
      ####............####
      ####..####......####
      ####............####
      ####.......####.####
      ####............####
      ####..####......####
      ####............####
      ####.......aaaa.####
      ####............####
      ####..####......####
      ####............####
      ####.......####.####
      ####............####
      ####..####......####
      ####............####
      ####.......####.####
      ####.P..........####
      ####################`,
    traps: [
      { when: { t: 0.6 }, do: 'saw', from: [9.5, 25], r: 2.7, path: [[9.5, -4]], speed: 2.1, say: 'Going up.' },
      { when: { stand: 'a' }, do: 'fall', g: 'a', shake: 0.35, say: 'Out of order.' },
    ],
  },
  {
    name: 'Guillotine',
    hint: 'Just pop down and back up.',
    // drop into the low tunnel: saws drop out of its ceiling as you walk under, so wait for each to go back up; the
    // pair takes turns. The last one doesn’t go back up: it rolls after you, so climb out fast
    map: `
      ....##..............................
      ....##..............................
      ....##..............................
      .P..##...........................D..
      ##..########################...#####
      ##..########################...#####
      ..............................######
      ..............................######
      ####################################
      ####################################`,
    traps: [
      { when: { x: 6 }, do: 'saw', from: [9.5, 5.5], path: [[9.5, 7.35]], back: true, hold: 0.6, speed: 7, say: 'Mind your head.' },
      { when: { x: 12 }, do: 'saw', from: [15.5, 5.5], path: [[15.5, 7.35]], back: true, hold: 1.1, speed: 7 },
      { when: { x: 17 }, do: 'saw', from: [20.5, 5.5], path: [[20.5, 7.35]], back: true, hold: 0.6, speed: 7 },
      { when: { x: 17 }, delay: 1, do: 'saw', from: [24.5, 5.5], path: [[24.5, 7.35]], back: true, hold: 0.8, speed: 7, say: 'Take turns.' },
      { when: { x: 26.5 }, do: 'saw', from: [22.5, 5.5], path: [[22.5, 7.35], [40, 7.35]], speed: 5, say: 'Followed you.' },
    ],
  },
  {
    name: 'Chase scene',
    hint: 'The door is right there.',
    // the door runs back to the start and a saw cuts out of the floor to chase you; as you reach the door it runs
    // back again, so turn round and jump the saw
    map: `
      ..........................
      ..........................
      ..........................
      ..........................
      ..........................
      ..........................
      .A..P.....^.....^....D.B..
      ##########################
      ##########################`,
    traps: [
      { when: { near: 2.5 }, do: 'door', to: 'A', say: 'Nope.' },
      { when: { after: 0 }, do: 'saw', from: [24.5, 7.5], r: 1.1, chase: 3.5, say: 'Run.' },
      { when: { after: 0, near: 2.5 }, do: 'door', to: 'B', say: 'Changed my mind.' },
    ],
  },
  {
    name: 'Duck and cover',
    hint: 'Mind the potholes.',
    // saws fill the low tunnel as they roll through, too tall to jump; drop into the potholes and let them pass
    // overhead. The last one comes from behind
    map: `
      ####################################
      ####################################
      ####################################
      ####################################
      ....................................
      .P................................D.
      ########.#######.########.##########
      ####################################
      ####################################`,
    traps: [
      { when: { x: 4 }, do: 'saw', from: [15.5, 5], r: 0.9, path: [[-2, 5]], speed: 5, say: 'Duck!' },
      { when: { x: 12 }, do: 'saw', from: [28.5, 5], r: 0.9, path: [[-2, 5]], speed: 6 },
      { when: { x: 12 }, delay: 0.5, do: 'saw', from: [28.5, 5], r: 0.9, path: [[-2, 5]], speed: 6, say: 'Two for one.' },
      { when: { x: 22 }, do: 'saw', from: [12.5, 5], r: 0.9, path: [[38, 5]], speed: 7.5, say: 'Behind you.' },
    ],
  },
  {
    name: 'Overhead',
    hint: 'Jump like you mean it.',
    // a saw rides along above you at exactly jump height, so a full jump is fatal; only small hops from here on
    map: `
      ..................................
      ..................................
      ..................................
      ..................................
      ..................................
      ...............................D..
      .P.....^.....^^...........^.######
      ##################..##############
      ##################..##############`,
    traps: [
      { when: { x: 3 }, do: 'saw', from: [3.5, 3.6], chase: 8, say: 'Heads up.' },
    ],
  },
  {
    name: 'Key cutter',
    hint: 'The door is right behind you. Locked, though.',
    // three keys, each on a step of the hill with a saw patrolling it; time your hops over the saws, then a last saw
    // cuts up out of the floor between you and the door
    map: `
      ............................
      ............................
      ............................
      ............................
      ............................
      ............................
      ..............*.............
      ............######..........
      .........*..######.....*....
      ......####################..
      D.P...####################..
      ############################
      ############################`,
    traps: [
      { when: { t: 0 }, do: 'saw', from: [6.5, 9.5], r: 1, path: [[11.5, 9.5]], back: true, loop: true, speed: 3 },
      { when: { t: 0 }, do: 'saw', from: [17.5, 7.5], r: 1, path: [[12.5, 7.5]], back: true, loop: true, speed: 3.5 },
      { when: { t: 0 }, do: 'saw', from: [18.5, 9.5], r: 1, path: [[25.5, 9.5]], back: true, loop: true, speed: 4 },
      { when: { keys: 3 }, do: 'saw', from: [3.5, 11.5], r: 1.1, chase: 3, say: 'One more thing.' },
    ],
  },
  {
    name: 'Valet parking',
    hint: 'There’s a spot reserved for you.',
    // the tunnel is walled off and the lower path has one handy ledge; step down there and a saw bursts out of the
    // tunnel wall and parks on your ledge. Let it, then climb back up and take the tunnel it just opened
    signs: [['S', 'RESERVED']],
    map: `
      ................................
      ................................
      .........#################......
      ........a.......................
      ........a.....................D.
      .........#################...###
      .............................###
      ......###..................#####
      .P....###..................#####
      #########................#######
      #########........S.......#######
      ##############...##...##########
      ##############^^^##^^^##########
      ################################`,
    traps: [
      { when: { zone: [9, 9, 13, 10] }, do: 'saw', from: [17.5, 4], r: 1, path: [[18, 11.5]], speed: 9, say: 'Parking it here.' },
      { when: { after: 0 }, do: 'vanish', g: 'a' },
    ],
  },
  {
    name: 'Sawmill',
    hint: 'Just a quick tour of the mill.',
    // everything at once: a saw rolls at you, stepping stones that sprout saws, a low tunnel with saws dropping from
    // the ceiling, and a door that runs back while a saw cuts up between you and it
    map: `
      ............................................................
      ............................................................
      ............................................................
      ............................................................
      ............................................................
      .........................###############....................
      .........................###############....................
      ............................................................
      .P.......................................................D..
      #############..a..b..c..############################.#######
      #############^^#^^#^^#^^############################.#######
      ############################################################`,
    traps: [
      { when: { x: 4 }, do: 'saw', from: [12.5, 9.5], r: 1.1, path: [[1.5, 9.5]], speed: 5, say: 'Welcome to the mill.' },
      { when: { stand: 'a' }, do: 'saw', from: [15.5, 9.5], delay: 0.35 },
      { when: { stand: 'b' }, do: 'saw', from: [18.5, 9.5], delay: 0.35 },
      { when: { stand: 'c' }, do: 'saw', from: [21.5, 9.5], delay: 0.35 },
      { when: { x: 26 }, do: 'saw', from: [29.5, 6.5], path: [[29.5, 8.35]], back: true, hold: 0.6, speed: 7, say: 'Mind your head.' },
      { when: { x: 31 }, do: 'saw', from: [34.5, 6.5], path: [[34.5, 8.35]], back: true, hold: 0.9, speed: 7 },
      { when: { near: 2.5 }, do: 'door', to: [44, 8], say: 'Forgot something?' },
      { when: { after: 6 }, do: 'saw', from: [48.5, 9.5], r: 1.1, chase: 3.5, say: 'Shift’s not over.' },
    ],
  },
];
