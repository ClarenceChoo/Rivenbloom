import { describe, expect, it } from 'vitest';
import { migrateSaveCandidate } from '../../src/game/saves/migrations';

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
});
