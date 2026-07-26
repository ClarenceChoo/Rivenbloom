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

export const requestPlayerState = (
  machine: PlayerStateMachine,
  next: PlayerStateName
): PlayerStateMachine => {
  if (machine.value === 'idle' && next === 'run') return { value: next };
  if (machine.value === 'idle' && next === 'jump') return { value: next };
  if (machine.value === 'idle' && next === 'fall') return { value: next };
  if (machine.value === 'idle' && next === 'climb') return { value: next };
  if (machine.value === 'run' && next === 'jump') return { value: next };
  if (machine.value === 'run' && next === 'idle') return { value: next };
  if (machine.value === 'run' && next === 'fall') return { value: next };
  if (machine.value === 'run' && next === 'climb') return { value: next };
  if (machine.value === 'fall' && next === 'jump') return { value: next };
  if (machine.value === 'jump' && next === 'fall') return { value: next };
  if (machine.value === 'jump' && next === 'climb') return { value: next };
  if (machine.value === 'fall' && next === 'land') return { value: next };
  if (machine.value === 'fall' && next === 'climb') return { value: next };
  if (machine.value === 'land' && next === 'jump') return { value: next };
  if (machine.value === 'land' && next === 'fall') return { value: next };
  if (machine.value === 'land' && next === 'run') return { value: next };
  if (machine.value === 'land' && next === 'idle') return { value: next };
  if (machine.value === 'idle' && next === 'hurt') return { value: next };
  if (machine.value === 'run' && next === 'hurt') return { value: next };
  if (machine.value === 'jump' && next === 'hurt') return { value: next };
  if (machine.value === 'fall' && next === 'hurt') return { value: next };
  if (machine.value === 'land' && next === 'hurt') return { value: next };
  if (machine.value === 'climb' && next === 'hurt') return { value: next };
  if (machine.value === 'climb' && next === 'fall') return { value: next };
  if (machine.value === 'hurt' && next === 'idle') return { value: next };
  if (machine.value === 'hurt' && next === 'run') return { value: next };
  if (machine.value === 'hurt' && next === 'fall') return { value: next };
  return machine;
};
