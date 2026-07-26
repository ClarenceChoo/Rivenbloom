export const PLAYER_STATES = [
  'idle',
  'run',
  'jump',
  'fall',
  'land',
  'attackLight',
  'attackHeavy',
  'airAttack',
  'block',
  'parry',
  'dash',
  'cast',
  'climb',
  'interact',
  'hurt',
  'dead'
] as const;

export type PlayerStateName = (typeof PLAYER_STATES)[number];

export type PlayerStateMachine = {
  readonly value: PlayerStateName;
};

export const createPlayerStateMachine = (value: PlayerStateName = 'idle'): PlayerStateMachine => ({
  value
});

const transitions: Readonly<Record<PlayerStateName, readonly PlayerStateName[]>> = {
  idle: [
    'run',
    'jump',
    'fall',
    'climb',
    'attackLight',
    'attackHeavy',
    'block',
    'parry',
    'dash',
    'cast',
    'interact',
    'hurt',
    'dead'
  ],
  run: [
    'idle',
    'jump',
    'fall',
    'climb',
    'attackLight',
    'attackHeavy',
    'block',
    'parry',
    'dash',
    'cast',
    'interact',
    'hurt',
    'dead'
  ],
  jump: ['fall', 'climb', 'airAttack', 'dash', 'cast', 'hurt', 'dead'],
  fall: ['jump', 'land', 'climb', 'airAttack', 'dash', 'cast', 'hurt', 'dead'],
  land: [
    'idle',
    'run',
    'jump',
    'fall',
    'attackLight',
    'attackHeavy',
    'block',
    'parry',
    'dash',
    'cast',
    'hurt',
    'dead'
  ],
  attackLight: ['idle', 'run', 'jump', 'fall', 'attackHeavy', 'dash', 'cast', 'hurt', 'dead'],
  attackHeavy: ['idle', 'run', 'jump', 'fall', 'dash', 'cast', 'hurt', 'dead'],
  airAttack: ['jump', 'fall', 'land', 'dash', 'cast', 'hurt', 'dead'],
  block: ['idle', 'run', 'fall', 'parry', 'cast', 'hurt', 'dead'],
  parry: ['idle', 'run', 'fall', 'block', 'hurt', 'dead'],
  dash: ['idle', 'run', 'jump', 'fall', 'hurt', 'dead'],
  cast: ['idle', 'run', 'jump', 'fall', 'hurt', 'dead'],
  climb: ['idle', 'fall', 'jump', 'hurt', 'dead'],
  interact: ['idle', 'run', 'fall', 'hurt', 'dead'],
  hurt: ['idle', 'run', 'fall', 'dead'],
  dead: []
};

export const requestPlayerState = (
  machine: PlayerStateMachine,
  next: PlayerStateName
): PlayerStateMachine => {
  return transitions[machine.value].includes(next) ? { value: next } : machine;
};
