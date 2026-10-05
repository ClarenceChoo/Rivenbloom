import { describe, expect, test } from 'vitest';

import {
  createPreloadState,
  preloadProgress,
  preparePreloadRetry,
  recordPreloadOutcome,
  restartPreloadState,
  selectPendingAssets,
} from '../../src/game/loading/PreloadState';
import type { PreloadManifest } from '../../src/game/loading/PreloadState';

const manifest = [
  { key: 'shell', group: 'Interface', kind: 'image', url: '/shell.png' },
  { key: 'title', group: 'Interface', kind: 'image', url: '/title.png' },
  { key: 'arrival', group: 'Wren ambience', kind: 'audio', url: '/arrival.ogg' },
] as const satisfies PreloadManifest;

describe('deterministic preload state', () => {
  test('an empty manifest is immediately complete at 100 percent', () => {
    const state = createPreloadState([]);
    expect(preloadProgress(state)).toEqual({
      completed: 0,
      total: 0,
      percentage: 100,
      currentGroup: null,
      failedGroups: [],
      failedKeys: [],
      complete: true,
      successful: true,
    });
  });

  test('counts each manifest key once even when loader outcomes repeat', () => {
    let state = createPreloadState(manifest);
    state = recordPreloadOutcome(state, 'shell', 'loaded');
    state = recordPreloadOutcome(state, 'shell', 'failed');
    expect(preloadProgress(state)).toMatchObject({ completed: 1, total: 3, percentage: 33 });
  });

  test('orders failures by manifest order rather than event order', () => {
    let state = createPreloadState(manifest);
    state = recordPreloadOutcome(state, 'arrival', 'failed');
    state = recordPreloadOutcome(state, 'shell', 'failed');
    state = recordPreloadOutcome(state, 'title', 'loaded');
    expect(preloadProgress(state)).toMatchObject({
      failedGroups: ['Interface', 'Wren ambience'],
      failedKeys: ['shell', 'arrival'],
      complete: true,
      successful: false,
    });
  });

  test('retry keeps successes and selects only failed or missing unique assets', () => {
    const duplicated = [...manifest, manifest[0]] satisfies PreloadManifest;
    let state = createPreloadState(duplicated);
    state = recordPreloadOutcome(state, 'shell', 'loaded');
    state = recordPreloadOutcome(state, 'title', 'failed');
    expect(selectPendingAssets(duplicated, state).map(({ key }) => key)).toEqual([
      'title',
      'arrival',
    ]);

    const retry = preparePreloadRetry(state);
    expect(preloadProgress(retry)).toMatchObject({ completed: 1, total: 3, percentage: 33 });
    expect(selectPendingAssets(duplicated, retry).map(({ key }) => key)).toEqual([
      'title',
      'arrival',
    ]);
  });

  test('a failed run restarts cleanly and can complete successfully', () => {
    let failed = createPreloadState(manifest);
    failed = recordPreloadOutcome(failed, 'shell', 'failed');
    failed = recordPreloadOutcome(failed, 'title', 'loaded');
    failed = recordPreloadOutcome(failed, 'arrival', 'loaded');
    expect(preloadProgress(failed).successful).toBe(false);

    let restarted = restartPreloadState(manifest);
    for (const { key } of manifest) restarted = recordPreloadOutcome(restarted, key, 'loaded');
    expect(preloadProgress(restarted).successful).toBe(true);
  });

  test('a successful run queues every required asset again after a scene restart', () => {
    let complete = createPreloadState(manifest);
    for (const { key } of manifest) complete = recordPreloadOutcome(complete, key, 'loaded');
    expect(preloadProgress(complete).successful).toBe(true);

    const restarted = restartPreloadState(manifest);
    expect(selectPendingAssets(manifest, restarted).map(({ key }) => key)).toEqual([
      'shell',
      'title',
      'arrival',
    ]);
    expect(preloadProgress(restarted)).toMatchObject({ completed: 0, complete: false });
  });
});
