import { describe, expect, test } from 'vitest';

import { ENEMY_STATES, EnemyStateMachine } from '../../src/game/entities/enemies/EnemyController';
import type { EnemyState } from '../../src/game/entities/enemies/EnemyController';

describe('enemy state machine', () => {
  test('owns exactly the required explicit state vocabulary', () => {
    expect(ENEMY_STATES).toEqual([
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
      'dead',
    ]);
  });

  test.each<[EnemyState, EnemyState]>([
    ['sleep', 'idle'],
    ['idle', 'patrol'],
    ['patrol', 'suspect'],
    ['suspect', 'chase'],
    ['chase', 'telegraph'],
    ['telegraph', 'attack'],
    ['attack', 'recover'],
    ['recover', 'retreat'],
    ['idle', 'retreat'],
    ['retreat', 'idle'],
    ['idle', 'hurt'],
    ['hurt', 'stagger'],
    ['stagger', 'dead'],
  ])('allows the owned legal transition %s -> %s', (from, to) => {
    const machine = new EnemyStateMachine(from);
    expect(machine.request(to)).toBe(true);
    expect(machine.current).toBe(to);
  });

  test('rejects unrelated mutation paths and keeps dead terminal', () => {
    const machine = new EnemyStateMachine('sleep');
    expect(machine.request('attack')).toBe(false);
    expect(machine.current).toBe('sleep');
    expect(new EnemyStateMachine('dead').request('idle')).toBe(false);
  });
});
