import { describe, expect, it } from 'vitest';

import {
  abilityId,
  itemId,
  questFlagId,
  questId,
  questStageId,
  stableId,
} from '../../src/game/core/StableId';

describe('stable IDs', () => {
  it('creates distinct serializable ID domains from lowercase kebab-case values', () => {
    const item = itemId('root-key');
    const ability = abilityId('mist-step');

    expect(item).toBe('root-key');
    expect(ability).toBe('mist-step');
    expect(JSON.stringify({ item, ability })).toBe('{"item":"root-key","ability":"mist-step"}');
  });

  it.each(['', 'Root-Key', 'root_key', 'root key', '-root', 'root-', 'root--key'])(
    'rejects an invalid stable ID value of %j',
    (value) => {
      expect(() => stableId<'item'>(value)).toThrow(RangeError);
    },
  );

  it('brands quest IDs, stages, and flags through their dedicated constructors', () => {
    expect(questId('rootglass-reliquary')).toBe('rootglass-reliquary');
    expect(questStageId('find-the-key')).toBe('find-the-key');
    expect(questFlagId('chorus-awakened')).toBe('chorus-awakened');
  });
});
