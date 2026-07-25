import { describe, expect, expectTypeOf, it } from 'vitest';
import { GameEvents } from '../../src/game/core/GameEvents';
import { createServiceToken, ServiceRegistry } from '../../src/game/core/ServiceRegistry';
import { SceneScope } from '../../src/game/core/SceneScope';

describe('SceneScope', () => {
  it('disposes cleanups once in reverse registration order, including a cleanup added during disposal', () => {
    const scope = new SceneScope();
    const lifecycle: string[] = [];

    scope.add(() => lifecycle.push('first'));
    scope.add(() => {
      lifecycle.push('second');
      scope.add(() => lifecycle.push('late'));
    });

    scope.dispose();
    scope.dispose();

    expect(lifecycle).toEqual(['second', 'late', 'first']);
  });

  it('runs cleanup registered after disposal immediately', () => {
    const scope = new SceneScope();
    const lifecycle: string[] = [];

    scope.dispose();
    scope.add(() => lifecycle.push('late'));

    expect(lifecycle).toEqual(['late']);
  });

  it('runs every cleanup and aggregates failures before reporting them', () => {
    const scope = new SceneScope();
    const lifecycle: string[] = [];
    const olderFailure = new Error('older cleanup failed');
    const newerFailure = new Error('newer cleanup failed');

    scope.add(() => {
      lifecycle.push('older');
      throw olderFailure;
    });
    scope.add(() => {
      lifecycle.push('newer');
      throw newerFailure;
    });

    let thrown: unknown;
    try {
      scope.dispose();
    } catch (error) {
      thrown = error;
    }

    if (!(thrown instanceof AggregateError)) {
      throw new Error('Expected disposal failures to be aggregated');
    }

    expect(lifecycle).toEqual(['newer', 'older']);
    expect(thrown.errors).toEqual([newerFailure, olderFailure]);
    expect(() => scope.dispose()).not.toThrow();
  });

  it('surfaces an error from a cleanup registered after disposal immediately', () => {
    const scope = new SceneScope();
    const failure = new Error('late cleanup failed');

    scope.dispose();

    expect(() =>
      scope.add(() => {
        throw failure;
      })
    ).toThrow(failure);
  });
});

describe('GameEvents', () => {
  it('provides a closed default event contract with typed payloads', () => {
    const events = new GameEvents();

    events.subscribe('save:status-changed', (payload) => {
      expectTypeOf(payload).toEqualTypeOf<{
        readonly slotId: string;
        readonly status: 'idle' | 'saving' | 'saved' | 'error';
        readonly message?: string;
      }>();
    });
    events.emit('ui:notification-requested', {
      message: "Saved at Wren's Rest",
      tone: 'success'
    });

    // @ts-expect-error Event names must come from the base map or an explicit extension.
    events.emit('ui:notifictaion-requested', { message: 'Typo', tone: 'info' });
    // @ts-expect-error The save status payload must use a supported status value.
    events.emit('save:status-changed', { slotId: 'slot-1', status: 'complete' });
  });

  it('emits typed payloads to subscribers until they unsubscribe', () => {
    const events = new GameEvents<{ 'health:changed': { current: number } }>();
    const received: number[] = [];
    const unsubscribe = events.subscribe('health:changed', ({ current }) => received.push(current));

    events.emit('health:changed', { current: 7 });
    unsubscribe();
    events.emit('health:changed', { current: 4 });

    expect(received).toEqual([7]);
  });
});

describe('ServiceRegistry', () => {
  it('retrieves a service using its typed token and reports missing services clearly', () => {
    const registry = new ServiceRegistry();
    const clock = createServiceToken<{ now(): number }>('clock');
    const missing = createServiceToken<{ now(): number }>('missing-clock');
    const service = { now: () => 42 };

    registry.register(clock, service);

    expect(registry.get(clock)).toBe(service);
    expect(() => registry.get(missing)).toThrow('Service not registered: missing-clock');
  });
});
