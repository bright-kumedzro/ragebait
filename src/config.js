// Game name lives here so a rename is a one-line change (also update the HTML <title>s and the manifest).
export const GAME_NAME = 'Ragebait';

// Everything is measured in tiles. The sim runs at a fixed step, so a run plays out the same at any frame rate
// (and the level checker can replay it exactly).
export const STEP = 1 / 120;

export const PLAYER_W = 0.5;
export const PLAYER_H = 0.8;
export const RUN = 6.5;          // top speed, tiles per second
export const ACCEL = 70;         // on the ground
export const AIR_ACCEL = 45;
export const DECEL = 80;
export const GRAVITY = 55;
export const JUMP_V = 18;        // a held jump rises about 2.9 tiles and carries about 4 tiles at full speed
export const JUMP_CUT = 7;       // letting go early caps the rise speed here, for short hops
export const MAX_FALL = 22;
export const COYOTE = 0.08;      // seconds after leaving a ledge that a jump still counts
export const BUFFER = 0.1;       // seconds a jump press is remembered before landing

export const FALL_GRAVITY = 50;  // collapsing floors
export const BALL_GRAVITY = 40;
export const BALL_R = 0.4;
export const DOOR_SPEED = 16;    // a door running away
export const SPIKE_POP = 0.06;   // seconds for a hidden spike to come up

export const RESPAWN_DELAY = 0.55;

// Challenges: a friend plays the same levels; fewest deaths wins, then the fastest time.
export const CHALLENGE_LEVELS = 3;

// Each chapter has its own palette. air: open space, solid: walls, floors and every hazard, ink: the runner,
// door: the exit. ui: HUD buttons and text drawn on the air colour. Menus use paper and text (default air and ink),
// with accent for headings and buttons (default solid).
export const CHAPTERS = [
  {
    id: 'trust', name: 'Trust Issues', blurb: 'Floors, doors and spikes that don’t play fair',
    theme: { air: '#F7DFAE', solid: '#D9503F', ink: '#161010', door: '#BDB5AD', ui: '#7A2A20' },
  },
  {
    id: 'cold', name: 'Cold Feet', blurb: 'Walls that move, doors that lie, controls that betray',
    theme: { air: '#D6E8F2', solid: '#2E5C9E', ink: '#0B1220', door: '#F2C14E', ui: '#1D3A66' },
  },
  {
    id: 'basement', name: 'The Basement', blurb: 'Down here, even gravity is in on it',
    theme: { air: '#6E5A5E', solid: '#2A0609', ink: '#050000', door: '#C9B8A6', ui: '#F0E2D8', paper: '#EADBD2', text: '#2A0609' },
  },
  {
    id: 'damage', name: 'Emotional Damage', blurb: 'It knows what you learned, and it uses it against you',
    theme: { air: '#F4E4F1', solid: '#7A2E8E', ink: '#16081C', door: '#F5C542', ui: '#4B1A59' },
  },
  {
    id: 'fourth', name: 'Fourth Wall', blurb: 'The game itself is in on it',
    theme: { air: '#14182B', solid: '#E8E3D3', ink: '#FF4F6D', door: '#46D9FF', ui: '#C9D2F0', paper: '#ECE8DC', text: '#14182B', accent: '#D93A5A' },
  },
];

// Said when you die. Picked at random, never the same twice in a row.
export const TAUNTS = [
  'Gotcha.', 'Skill issue.', 'You trusted it?', 'Predictable.', 'lol', 'Again.', 'Character development.',
  'That one was on you.', 'Nope.', 'So close. (Not really.)', 'Respawn speedrun.', 'Have you tried not dying?',
  'Bold strategy.', 'It wasn’t luck.', 'Classic.', 'The door says hi.', 'Deep breaths.', 'Rage is temporary.',
];

// The result card picks a line by how many deaths the level took.
export const CLEAR_LINES = [
  [0, 'First try? Suspicious.'],
  [1, 'Only one death. Who hurt you?'],
  [4, 'Not bad. Not good either.'],
  [10, 'You got there. Eventually.'],
  [25, 'That was painful to watch.'],
  [Infinity, 'Persistence is a personality.'],
];
