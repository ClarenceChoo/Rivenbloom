import { describe, expect, it } from 'vitest';
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
});

describe('GameEvents', () => {
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
