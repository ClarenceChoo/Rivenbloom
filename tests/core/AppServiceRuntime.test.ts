import { describe, expect, test, vi } from 'vitest';

import {
  AppServiceRuntime,
  createBootSaveServices,
  replaceAppServiceRuntime,
} from '../../src/game/core/AppServiceRuntime';
import { ServiceRegistry } from '../../src/game/core/ServiceRegistry';

describe('boot save fallback', () => {
  test('uses memory storage and publishes a persistent warning when IndexedDB is unavailable', async () => {
    const { saveService } = createBootSaveServices({ indexedDbFactory: undefined });

    await expect(saveService.read('slot-1')).resolves.toEqual({ kind: 'empty' });
    expect(saveService.getNotices()).toContainEqual({
      code: 'storage-fallback',
      persistent: true,
      message: 'Persistent save storage failed; this session is using memory storage.',
    });
  });
});

describe('application service runtime', () => {
  test('replacing a Boot runtime disposes the prior bundle and its listener exactly once', async () => {
    const firstCleanup = vi.fn();
    const secondCleanup = vi.fn();
    const first = new AppServiceRuntime(new ServiceRegistry<object>(), [firstCleanup]);
    const second = new AppServiceRuntime(new ServiceRegistry<object>(), [secondCleanup]);

    expect(replaceAppServiceRuntime(first, second)).toBe(second);
    await first.dispose();
    expect(firstCleanup).toHaveBeenCalledTimes(1);
    expect(secondCleanup).not.toHaveBeenCalled();

    await second.dispose();
    await second.dispose();
    expect(secondCleanup).toHaveBeenCalledTimes(1);
  });
});
