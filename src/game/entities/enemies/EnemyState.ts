export const ENEMY_STATES = [
  'sleep',
  'idle',
  'patrol',
  'suspect',
  'chase',
  'telegraph',
  'attack',
  'recover',
  'retreat',
  'hurt',
  'stagger',
  'dead'
] as const;

export type EnemyStateName = (typeof ENEMY_STATES)[number];

export type EnemyStateMachine = {
  readonly value: EnemyStateName;
};

export const createEnemyStateMachine = (value: EnemyStateName = 'sleep'): EnemyStateMachine => ({
  value
});

const transitions: Readonly<Record<EnemyStateName, readonly EnemyStateName[]>> = {
  sleep: ['idle', 'suspect', 'telegraph', 'hurt', 'stagger', 'dead'],
  idle: ['patrol', 'suspect', 'chase', 'sleep', 'hurt', 'stagger', 'dead'],
  patrol: ['idle', 'suspect', 'chase', 'sleep', 'hurt', 'stagger', 'dead'],
  suspect: ['idle', 'patrol', 'chase', 'hurt', 'stagger', 'dead'],
  chase: ['telegraph', 'retreat', 'suspect', 'idle', 'hurt', 'stagger', 'dead'],
  telegraph: ['attack', 'hurt', 'stagger', 'dead'],
  attack: ['recover', 'stagger', 'dead'],
  recover: ['chase', 'idle', 'retreat', 'hurt', 'stagger', 'dead'],
  retreat: ['idle', 'chase', 'suspect', 'sleep', 'hurt', 'stagger', 'dead'],
  hurt: ['chase', 'idle', 'suspect', 'retreat', 'stagger', 'dead'],
  stagger: ['idle', 'chase', 'retreat', 'hurt', 'dead'],
  dead: []
};

export const requestEnemyState = (
  machine: EnemyStateMachine,
  next: EnemyStateName
): EnemyStateMachine => {
  if (machine.value === next) return machine;
  return transitions[machine.value].includes(next) ? { value: next } : machine;
};
