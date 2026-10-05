import { describe, expect, it } from 'vitest';

import { StateMachine } from '../../src/game/core/StateMachine';

type TestState = 'idle' | 'running' | 'stopped';

describe('StateMachine', () => {
  it('applies an allowed transition and reports it to the transition callback', () => {
    const transitions = {
      idle: ['running'],
      running: ['stopped'],
      stopped: [],
    } as const satisfies Record<TestState, readonly TestState[]>;
    const received: Array<{ from: TestState; to: TestState; context: { reason: string } }> = [];
    const machine = new StateMachine<TestState, { reason: string }>(
      'idle',
      transitions,
      (transition) => {
        received.push(transition);
      },
    );

    const accepted = machine.request('running', { reason: 'input' });

    expect(accepted).toBe(true);
    expect(machine.state).toBe('running');
    expect(received).toEqual([{ from: 'idle', to: 'running', context: { reason: 'input' } }]);
  });

  it('rejects a transition absent from the explicit transition table', () => {
    const machine = new StateMachine<TestState, undefined>('idle', {
      idle: ['running'],
      running: ['stopped'],
      stopped: [],
    });

    const accepted = machine.request('stopped', undefined);

    expect(accepted).toBe(false);
    expect(machine.state).toBe('idle');
  });
});
