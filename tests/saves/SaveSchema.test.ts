import { describe, expect, it } from 'vitest';
import {
  createDefaultSave,
  createSaveEnvelope,
  validateSave,
  type SaveSlotId
} from '../../src/game/saves/SaveSchema';

const slot = 'slot-1' as SaveSlotId;

describe('SaveSchema', () => {
  it('creates a complete version-one save with deterministic defaults', () => {
    const save = createDefaultSave(slot, 1_700_000_000_000);

    expect(save).toMatchObject({
      schemaVersion: 1,
      slotId: slot,
      metadata: {
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
        playtimeSeconds: 0,
        areaId: 'wrens-rest',
        safePosition: { x: 0, y: 0 }
      },
      player: { health: 100, mana: 50, currency: 0, weaponLevel: 1 },
      inventory: {},
      unlockedAbilities: ['lumen-bolt'],
      openedChestIds: [],
      settings: { reducedMotion: false, textScale: 1, audio: { master: 1 } }
    });
  });

  it('fills omitted optional state with safe defaults', () => {
    const result = validateSave({
      schemaVersion: 1,
      slotId: 'slot-1',
      metadata: {
        createdAt: 10,
        updatedAt: 20,
        playtimeSeconds: 3,
        areaId: 'brackenreach',
        checkpointId: 'listening-arch',
        safePosition: { x: 42, y: 99 }
      },
      player: { health: 76, mana: 31, currency: 8, weaponLevel: 2 }
    });

    expect(result).toMatchObject({
      ok: true,
      save: {
        inventory: {},
        equippedCharms: [],
        unlockedAbilities: [],
        questFlags: [],
        discoveredRoomIds: [],
        settings: { subtitles: true, textScale: 1 }
      }
    });
  });

  it('rejects malformed required save state without coercing it', () => {
    const result = validateSave({
      schemaVersion: 1,
      slotId: 'slot-1',
      metadata: {
        createdAt: 10,
        updatedAt: 20,
        playtimeSeconds: -1,
        areaId: 'Brackenreach',
        safePosition: { x: Number.NaN, y: 0 }
      },
      player: { health: -1, mana: 31, currency: 8, weaponLevel: 2 }
    });

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.errors.map((error) => error.path)).toEqual(
        expect.arrayContaining([
          'metadata.playtimeSeconds',
          'metadata.areaId',
          'metadata.safePosition.x',
          'player.health'
        ])
      );
    }
  });

  it('generates the same envelope checksum for equivalent object key orderings', () => {
    const save = createDefaultSave(slot, 100);
    const reorderedSave = JSON.parse(
      '{"settings":{"audio":{"master":1,"music":1,"effects":1},"textScale":1,"subtitles":true,"reducedMotion":false,"screenShake":1,"screenFlash":1,"damageNumbers":true,"holdToToggle":false,"highContrastPrompts":false},"slotId":"slot-1","schemaVersion":1,"metadata":{"safePosition":{"y":0,"x":0},"areaId":"wrens-rest","playtimeSeconds":0,"updatedAt":100,"createdAt":100},"player":{"spellLevels":{},"weaponLevel":1,"currency":0,"xp":0,"manaUpgrades":0,"healthUpgrades":0,"mana":50,"health":100},"inventory":{},"equippedCharms":[],"unlockedAbilities":["lumen-bolt"],"bindings":{},"questStages":{},"questFlags":[],"defeatedBossIds":[],"openedChestIds":[],"activatedShortcutIds":[],"solvedPuzzleIds":[],"claimedDiscoveryIds":[],"discoveredRoomIds":[]}'
    );

    expect(createSaveEnvelope(save, 200).checksum).toBe(
      createSaveEnvelope(reorderedSave, 200).checksum
    );
  });
});
