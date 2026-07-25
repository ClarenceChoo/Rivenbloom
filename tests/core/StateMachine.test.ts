import { describe, expect, it } from 'vitest';
import { StateMachine } from '../../src/game/core/StateMachine';

type GateState = 'closed' | 'open' | 'locked';

type GateContext = {
  readonly hasKey: boolean;
  readonly lifecycle: string[];
};

describe('StateMachine', () => {
  it('exits the current state before entering an allowed next state', () => {
    const machine = new StateMachine<GateState, GateContext>({
      initial: 'closed',
      states: {
        closed: {
          transitions: { open: {} },
          onExit: (_context, state) => _context.lifecycle.push(`exit:${state}`)
        },
        open: {
          transitions: { closed: {} },
          onEnter: (_context, state) => _context.lifecycle.push(`enter:${state}`)
        },
        locked: { transitions: {} }
      }
    });
    const context: GateContext = { hasKey: false, lifecycle: [] };

    expect(machine.request('open', context)).toBe(true);
    expect(machine.state).toBe('open');
    expect(context.lifecycle).toEqual(['exit:closed', 'enter:open']);
  });

  it('keeps its state when a transition is guarded, absent, or self-referential', () => {
    const machine = new StateMachine<GateState, GateContext>({
      initial: 'closed',
      states: {
        closed: {
          transitions: {
            open: { guard: (context) => context.hasKey }
          }
        },
        open: { transitions: { closed: {} } },
        locked: { transitions: {} }
      }
    });
    const context: GateContext = { hasKey: false, lifecycle: [] };

    expect(machine.request('open', context)).toBe(false);
    expect(machine.request('locked', context)).toBe(false);
    expect(machine.request('closed', context)).toBe(false);
    expect(machine.state).toBe('closed');
  });
});
