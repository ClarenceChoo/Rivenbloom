import { describe, expect, it } from 'vitest';

import { SceneScope } from '../../src/game/core/SceneScope';

describe('SceneScope', () => {
  it('runs cleanups in reverse registration order once when disposed repeatedly', () => {
    const scope = new SceneScope();
    const cleanupOrder: string[] = [];
    scope.add(() => cleanupOrder.push('first'));
    scope.add(() => cleanupOrder.push('second'));

    scope.dispose();
    scope.dispose();

    expect(cleanupOrder).toEqual(['second', 'first']);
  });

  it('runs every cleanup before reporting cleanup errors', () => {
    const scope = new SceneScope();
    const cleanupOrder: string[] = [];
    const failure = new Error('release failed');
    scope.add(() => cleanupOrder.push('first'));
    scope.add(() => {
      cleanupOrder.push('second');
      throw failure;
    });
    scope.add(() => cleanupOrder.push('third'));

    expect(() => scope.dispose()).toThrow(AggregateError);
    expect(cleanupOrder).toEqual(['third', 'second', 'first']);
    expect(() => scope.dispose()).not.toThrow();
  });

  it('rejects cleanup registration after disposal', () => {
    const scope = new SceneScope();
    scope.dispose();

    expect(() => scope.add(() => undefined)).toThrow('already been disposed');
  });
});
