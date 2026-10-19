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
  // Chapters 6-20 are built by scripts/generate-levels.mjs, which remixes the traps above; each has its own mix.
  { id: 'dejavu', name: 'Déjà Vu', blurb: 'You’ve seen these traps before. They’ve seen you too',
    theme: { air: '#E6F4F1', solid: '#E0634A', ink: '#10201C', door: '#3E8E7E', ui: '#1F4F46' } },
  { id: 'night', name: 'Night Shift', blurb: 'Crushers, blackouts and the long hours',
    theme: { air: '#1B1F3B', solid: '#F2B134', ink: '#F5F3EE', door: '#E85D75', ui: '#C8CDF0', paper: '#F4F1E6', text: '#1B1F3B', accent: '#B37A08' } },
  { id: 'upside', name: 'Upside Downtown', blurb: 'Mirrors, flips and a sky you can walk on',
    theme: { air: '#FFF1D6', solid: '#2D6A4F', ink: '#14110C', door: '#E76F51', ui: '#1B4332' } },
  { id: 'glass', name: 'Glass Floor', blurb: 'Bridges you can’t see and spikes you can’t either',
    theme: { air: '#E8F1FB', solid: '#5B7FA6', ink: '#0E1A2B', door: '#F28C28', ui: '#2E4A6B' } },
  { id: 'rush', name: 'Rush Hour II', blurb: 'Walls that chase, legs that won’t stop',
    theme: { air: '#FDF0E6', solid: '#C2185B', ink: '#1A0A12', door: '#00897B', ui: '#7A0E39' } },
  { id: 'fall', name: 'Trust Fall', blurb: 'Every platform is a promise. Most are broken',
    theme: { air: '#F1F5E9', solid: '#6B8E23', ink: '#141A08', door: '#B5651D', ui: '#3F5414' } },
  { id: 'static', name: 'Static', blurb: 'Lag, glitches and errors that aren’t',
    theme: { air: '#202124', solid: '#9AA0A6', ink: '#F1F3F4', door: '#FBBC04', ui: '#DADCE0', paper: '#F1F3F4', text: '#202124', accent: '#5F6368' } },
  { id: 'haunted', name: 'Haunted', blurb: 'Your past attempts are back. They’re not friendly',
    theme: { air: '#2A2238', solid: '#8C7AA9', ink: '#E9E3F5', door: '#7FE3C4', ui: '#D6CCEA', paper: '#EFEAF7', text: '#2A2238', accent: '#6A5A8C' } },
  { id: 'bodies', name: 'Body Count', blurb: 'Some bridges are built out of you',
    theme: { air: '#F7E6E6', solid: '#8B1E1E', ink: '#1A0505', door: '#5C7C8A', ui: '#5E1414' } },
  { id: 'elevator', name: 'Elevator Music', blurb: 'Pillars, lifts and ferries that change their minds',
    theme: { air: '#FFF8E1', solid: '#8D6E63', ink: '#1E120D', door: '#26A69A', ui: '#5D4037' } },
  { id: 'gaslight', name: 'Gaslight', blurb: 'That door was always there. Wasn’t it?',
    theme: { air: '#FCEFD9', solid: '#E07A1F', ink: '#1C1206', door: '#4A6FA5', ui: '#8A4A0B' } },
  { id: 'freeze', name: 'Brain Freeze', blurb: 'Left, right, lag, mirror. Good luck',
    theme: { air: '#E0F7FA', solid: '#00838F', ink: '#05252A', door: '#FF7043', ui: '#005662' } },
  { id: 'balls', name: 'Ball Pit', blurb: 'It’s raining cannonballs',
    theme: { air: '#FFFDE7', solid: '#F4511E', ink: '#1F0D05', door: '#3949AB', ui: '#A12E0B' } },
  { id: 'exam', name: 'Final Exam', blurb: 'Everything you’ve learned, all at once',
    theme: { air: '#ECEFF1', solid: '#37474F', ink: '#0B1215', door: '#E53935', ui: '#263238' } },
  { id: 'end', name: 'The End?', blurb: 'Is it, though',
    theme: { air: '#0B0B0F', solid: '#F5F5F0', ink: '#FFD23F', door: '#FF3864', ui: '#E6E6E0', paper: '#F5F5F0', text: '#0B0B0F', accent: '#D62F55' } },
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
