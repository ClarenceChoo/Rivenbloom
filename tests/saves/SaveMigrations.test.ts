import { describe, expect, it } from 'vitest';
import { migrateSaveCandidate } from '../../src/game/saves/migrations';

const validV0 = () => ({
  schemaVersion: 0,
  slotId: 'slot-1',
  savedAt: 123,
  playtimeSeconds: 45,
  areaId: 'singing-hollows',
  position: { x: 12, y: 48 },
  health: 70,
  mana: 20,
  currency: 14
});

describe('migrateSaveCandidate', () => {
  it('migrates a version-zero payload into a validated version-one save', () => {
    const result = migrateSaveCandidate({
      schemaVersion: 0,
      slotId: 'slot-2',
      savedAt: 123,
      playtimeSeconds: 45,
      areaId: 'singing-hollows',
      checkpointId: 'echo-pool',
      position: { x: 12, y: 48 },
      health: 70,
      mana: 20,
      currency: 14
    });

    expect(result).toEqual({
      ok: true,
      migratedFrom: 0,
      save: expect.objectContaining({
        schemaVersion: 1,
        slotId: 'slot-2',
        metadata: expect.objectContaining({
          createdAt: 123,
          updatedAt: 123,
          playtimeSeconds: 45,
          areaId: 'singing-hollows',
          checkpointId: 'echo-pool',
          safePosition: { x: 12, y: 48 }
        }),
        player: expect.objectContaining({ health: 70, mana: 20, currency: 14 })
      })
    });
  });

  it('reports an unsupported future schema without attempting a lossy migration', () => {
    expect(migrateSaveCandidate({ schemaVersion: 99, slotId: 'slot-1' })).toEqual({
      ok: false,
      reason: 'unsupported-version',
      schemaVersion: 99
    });
  });

  it.each([
    ['savedAt', { savedAt: -1 }, 'savedAt'],
    ['savedAt', { savedAt: Number.POSITIVE_INFINITY }, 'savedAt'],
    ['playtimeSeconds', { playtimeSeconds: Number.POSITIVE_INFINITY }, 'playtimeSeconds'],
    ['playtimeSeconds', { playtimeSeconds: -1 }, 'playtimeSeconds'],
    ['currency', { currency: -1 }, 'currency'],
    ['currency', { currency: Number.POSITIVE_INFINITY }, 'currency'],
    ['position', { position: { x: -1, y: 48 } }, 'position.x'],
    ['position', { position: { x: Number.NaN, y: 48 } }, 'position.x'],
    ['health', { health: -1 }, 'health'],
    ['mana', { mana: 'twenty' }, 'mana'],
    ['areaId', { areaId: 'Singing Hollows' }, 'areaId']
  ])('rejects a present malformed V0 %s instead of defaulting it', (_name, override, field) => {
    const result = migrateSaveCandidate({ ...validV0(), ...override });

    expect(result).toMatchObject({ ok: false, reason: 'invalid-save' });
    if (!result.ok) expect(result.errors).toContain(field);
  });

  it('defaults a missing legacy optional field without masking present malformed fields', () => {
    const candidate = validV0();
    delete (candidate as Partial<typeof candidate>).currency;

    expect(migrateSaveCandidate(candidate)).toMatchObject({
      ok: true,
      save: { player: { currency: 0 } }
    });
  });
});
