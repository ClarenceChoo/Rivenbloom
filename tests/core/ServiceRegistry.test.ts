import { describe, expect, it } from 'vitest';

import { ServiceRegistry } from '../../src/game/core/ServiceRegistry';

type TestServices = {
  logger: { entries: string[] };
};

describe('ServiceRegistry', () => {
  it('resolves the exact registered service', () => {
    const services = new ServiceRegistry<TestServices>();
    const logger = { entries: [] as string[] };

    services.register('logger', logger);

    expect(services.get('logger')).toBe(logger);
  });

  it('rejects duplicate registrations', () => {
    const services = new ServiceRegistry<TestServices>();
    services.register('logger', { entries: [] });

    expect(() => services.register('logger', { entries: [] })).toThrow('already registered');
  });

  it('reports missing registrations', () => {
    const services = new ServiceRegistry<TestServices>();

    expect(() => services.get('logger')).toThrow('not registered');
  });
});
