import { describe, expect, test, vi } from 'vitest';

import { DEFAULT_SAVE_SETTINGS, validateSaveV1 } from '../../src/game/saves/SaveSchema';
import type { SaveReadResult } from '../../src/game/saves/SaveRepository';
import type { SaveSlotId, SaveV1 } from '../../src/game/saves/SaveSchema';
import { CONTENT_REGISTRY, WRENS_REST_AREA } from '../../src/game/data/areas';
import type { ContentRegistry } from '../../src/game/data/types';
import type { AbilityDefinition, QuestContentDefinition } from '../../src/game/data/types';
import { AreaLoader } from '../../src/game/world/AreaLoader';
import { WorldStart } from '../../src/game/world/WorldStart';
import type { WorldStartSavePort } from '../../src/game/world/WorldStart';
import type { TitleTransitionPayload } from '../../src/game/title/TitleController';
import { rawSaveV1 } from '../saves/saveFixtures';
import type { StableId } from '../../src/game/core/StableId';

function validSave(overrides: Partial<SaveV1> = {}): SaveV1 {
  const raw = rawSaveV1();
  const result = validateSaveV1({
    ...raw,
    ...overrides,
    location: {
      ...raw.location,
      safePosition: { x: 256, y: 608 },
      ...(overrides.location ?? {}),
    },
  });
  if (result.kind === 'invalid') throw new Error('World fixture must be a valid save.');
  return result.value;
}

function loaded(save = validSave()): Extract<SaveReadResult, { kind: 'loaded' }> {
  return {
    kind: 'loaded',
    save,
    source: 'current',
    writtenAtEpochMs: 1_700_000_030_000,
    notices: [],
    corruptCopies: [],
  };
}

function payload(mode: 'new' | 'load', settings = DEFAULT_SAVE_SETTINGS): TitleTransitionPayload {
  return { mode, slotId: 'slot-1', settings };
}

function port(
  read: (slotId: SaveSlotId) => Promise<SaveReadResult>,
  options: Readonly<{ dirty?: boolean; saveNow?: WorldStartSavePort['saveNow'] }> = {},
): WorldStartSavePort {
  return {
    read: vi.fn(read),
    saveNow: vi.fn(options.saveNow ?? (async () => undefined)),
    hasDirtySave: vi.fn(() => options.dirty ?? false),
  };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function settleAsync(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
}

describe('WorldStart new journey', () => {
  test('resolves authored content and canonical spawn before awaiting exactly one save', async () => {
    const saving = deferred<void>();
    const saves = port(async () => ({ kind: 'empty' }), { saveNow: () => saving.promise });
    const start = new WorldStart(
      saves,
      new AreaLoader(CONTENT_REGISTRY),
      CONTENT_REGISTRY,
      () => 1_800_000_000_000,
    );
    let settled = false;
    const resultPromise = start
      .start(payload('new', { ...DEFAULT_SAVE_SETTINGS, reducedMotion: true, textScale: 1.25 }))
      .then((result) => {
        settled = true;
        return result;
      });
    await settleAsync();

    expect(saves.read).toHaveBeenCalledWith('slot-1');
    expect(saves.saveNow).toHaveBeenCalledTimes(1);
    expect(saves.hasDirtySave).not.toHaveBeenCalled();
    expect(saves.saveNow).toHaveBeenCalledWith(
      'slot-1',
      expect.objectContaining({
        metadata: expect.objectContaining({ createdAtEpochMs: 1_800_000_000_000 }),
        location: {
          regionId: 'brackenreach',
          areaId: 'wren-rest',
          checkpointId: 'village-well',
          safePosition: { x: 256, y: 608 },
        },
        settings: expect.objectContaining({ reducedMotion: true, textScale: 1.25 }),
      }),
    );
    expect(settled).toBe(false);

    saving.resolve();
    await expect(resultPromise).resolves.toMatchObject({
      kind: 'ready',
      slotId: 'slot-1',
      mode: 'new',
      room: { roomId: 'wren-rest-square' },
      checkpoint: { checkpointId: 'village-well' },
      position: { x: 256, y: 608 },
      positionSource: 'checkpoint-canonical',
      settings: { reducedMotion: true, textScale: 1.25 },
    });
  });

  test('documents the current-instance guarantee by refusing any non-empty slot without writing', async () => {
    for (const existing of [
      loaded(),
      { kind: 'corrupt' as const, corruptCopies: [] },
    ] satisfies readonly SaveReadResult[]) {
      const saves = port(async () => existing);
      const result = await new WorldStart(
        saves,
        new AreaLoader(CONTENT_REGISTRY),
        CONTENT_REGISTRY,
        () => 1,
      ).start(payload('new'));

      expect(result).toMatchObject({ kind: 'failed', reason: 'slot-not-empty' });
      expect(saves.saveNow).not.toHaveBeenCalled();
    }
  });

  test('does not write when critical authored spawn content cannot resolve', async () => {
    const invalidRegistry: ContentRegistry = {
      ...CONTENT_REGISTRY,
      newGame: {
        ...CONTENT_REGISTRY.newGame,
        initialCheckpointId:
          'missing-checkpoint' as typeof CONTENT_REGISTRY.newGame.initialCheckpointId,
      },
    };
    const saves = port(async () => ({ kind: 'empty' }));
    const result = await new WorldStart(
      saves,
      new AreaLoader(invalidRegistry),
      invalidRegistry,
      () => 1,
    ).start(payload('new'));

    expect(result).toMatchObject({ kind: 'failed', reason: 'content-invalid' });
    expect(saves.saveNow).not.toHaveBeenCalled();
  });

  test('sources new-game stats, abilities, and quest snapshot from the registry', async () => {
    const ability: AbilityDefinition = {
      abilityId: 'moth-glimmer' as StableId<'ability'>,
      displayName: 'Moth Glimmer',
      manaCost: 3,
      cooldownMs: 400,
      unlockFactId: null,
      action: { kind: 'restore', resource: 'mana', amount: 2 },
    };
    const quest: QuestContentDefinition = {
      definition: {
        questId: 'homecoming' as StableId<'quest'>,
        displayName: 'Homecoming',
        initialStageId: 'wake' as StableId<'quest-stage'>,
        stages: [
          {
            stageId: 'wake' as StableId<'quest-stage'>,
            title: 'Wake at the Well',
            objective: "Look around Wren's Rest.",
            transitions: [],
          },
        ],
      },
      declaredFacts: [],
    };
    const registry: ContentRegistry = {
      ...CONTENT_REGISTRY,
      abilities: [ability],
      quests: [quest],
      dialogue: [],
      npcs: [],
      shopOffers: [],
      puzzles: [],
      bossEncounters: [],
      areas: [
        {
          ...WRENS_REST_AREA,
          actorSpawns: [WRENS_REST_AREA.actorSpawns[0]!],
          triggers: [WRENS_REST_AREA.triggers[0]!],
          transitions: WRENS_REST_AREA.transitions.filter(({ kind }) => kind === 'room'),
        },
      ],
      newGame: {
        ...CONTENT_REGISTRY.newGame,
        baseStats: { maxHealth: 73, maxMana: 29, attackPower: 8, armour: 2 },
        startingAbilities: [ability.abilityId],
        initialQuests: {
          stages: [{ questId: quest.definition.questId, stageId: quest.definition.initialStageId }],
          flags: [],
        },
      },
    };
    const saves = port(async () => ({ kind: 'empty' }));
    const result = await new WorldStart(saves, new AreaLoader(registry), registry, () => 88).start(
      payload('new'),
    );

    expect(result).toMatchObject({
      kind: 'ready',
      save: {
        player: {
          baseStats: { maxHealth: 73, maxMana: 29, attackPower: 8, armour: 2 },
          unlockedAbilities: ['moth-glimmer'],
        },
        quests: { stages: [{ questId: 'homecoming', stageId: 'wake' }], flags: [] },
      },
    });
    expect(saves.saveNow).toHaveBeenCalledTimes(1);
  });
});

describe('WorldStart loaded journey', () => {
  test('uses the authoritative reread settings and retains a safe saved position', async () => {
    const safeZone = CONTENT_REGISTRY.areas[0]!.checkpoints[0]!.safeZone;
    const save = validSave({
      settings: { ...DEFAULT_SAVE_SETTINGS, reducedMotion: true, textScale: 1.5 },
      location: {
        ...validSave().location,
        safePosition: { x: safeZone.x, y: safeZone.y },
      },
    });
    const saves = port(async () => loaded(save));
    const result = await new WorldStart(
      saves,
      new AreaLoader(CONTENT_REGISTRY),
      CONTENT_REGISTRY,
      () => 1,
    ).start(payload('load', { ...DEFAULT_SAVE_SETTINGS, reducedMotion: false, textScale: 1 }));

    expect(result).toMatchObject({
      kind: 'ready',
      mode: 'load',
      save,
      position: { x: safeZone.x, y: safeZone.y },
      positionSource: 'saved',
      settings: { reducedMotion: true, textScale: 1.5 },
    });
    expect(saves.saveNow).not.toHaveBeenCalled();
  });

  test('repairs an exclusive-edge unsafe position in memory without writing', async () => {
    const safeZone = CONTENT_REGISTRY.areas[0]!.checkpoints[0]!.safeZone;
    const save = validSave({
      location: {
        ...validSave().location,
        safePosition: { x: safeZone.x + safeZone.width, y: safeZone.y },
      },
    });
    const saves = port(async () => loaded(save));
    const result = await new WorldStart(
      saves,
      new AreaLoader(CONTENT_REGISTRY),
      CONTENT_REGISTRY,
      () => 1,
    ).start(payload('load'));

    expect(result).toMatchObject({
      kind: 'ready',
      position: { x: 256, y: 608 },
      positionSource: 'checkpoint-canonical',
      save: { location: { safePosition: { x: 256, y: 608 } } },
    });
    expect(saves.saveNow).not.toHaveBeenCalled();
    if (result.kind !== 'ready') throw new Error('Expected the load to be ready.');
    expect(result.save).toEqual({
      ...save,
      location: {
        ...save.location,
        safePosition: { x: 256, y: 608 },
      },
    });
    expect(save.location.safePosition).toEqual({
      x: safeZone.x + safeZone.width,
      y: safeZone.y,
    });
  });

  test.each([
    ['empty', { kind: 'empty' as const }],
    ['corrupt', { kind: 'corrupt' as const, corruptCopies: [] }],
  ])('fails readably when a load slot is %s', async (_label, readResult) => {
    const saves = port(async () => readResult);
    const result = await new WorldStart(
      saves,
      new AreaLoader(CONTENT_REGISTRY),
      CONTENT_REGISTRY,
      () => 1,
    ).start(payload('load'));

    expect(result).toMatchObject({ kind: 'failed', reason: 'slot-unavailable' });
    expect(saves.saveNow).not.toHaveBeenCalled();
  });

  test('fails unknown critical content without substituting the initial area', async () => {
    const save = validSave({
      location: { ...validSave().location, areaId: 'future-area' as SaveV1['location']['areaId'] },
    });
    const saves = port(async () => loaded(save));
    const result = await new WorldStart(
      saves,
      new AreaLoader(CONTENT_REGISTRY),
      CONTENT_REGISTRY,
      () => 1,
    ).start(payload('load'));

    expect(result).toMatchObject({ kind: 'failed', reason: 'content-invalid' });
    expect(saves.saveNow).not.toHaveBeenCalled();
  });

  test.each([
    [
      'missing checkpoint',
      { checkpointId: 'future-checkpoint' as SaveV1['location']['checkpointId'] },
    ],
    ['region/area mismatch', { regionId: 'future-region' as SaveV1['location']['regionId'] }],
  ])('fails %s as invalid critical content', async (_label, locationPatch) => {
    const save = validSave({
      location: { ...validSave().location, ...locationPatch },
    });
    const saves = port(async () => loaded(save));
    const result = await new WorldStart(
      saves,
      new AreaLoader(CONTENT_REGISTRY),
      CONTENT_REGISTRY,
      () => 1,
    ).start(payload('load'));

    expect(result).toMatchObject({ kind: 'failed', reason: 'content-invalid' });
    expect(saves.saveNow).not.toHaveBeenCalled();
  });
});

describe('WorldStart failures and lifecycle', () => {
  test('distinguishes queued-for-retry from an unconfirmed failed save', async () => {
    for (const [dirty, saveState] of [
      [true, 'queued-for-retry'],
      [false, 'not-confirmed'],
    ] as const) {
      const operations: string[] = [];
      const saves: WorldStartSavePort = {
        read: vi.fn(async (): Promise<SaveReadResult> => {
          operations.push('read:slot-1');
          return { kind: 'empty' };
        }),
        saveNow: vi.fn(async () => {
          operations.push('save:slot-1');
          throw new Error('write failed');
        }),
        hasDirtySave: vi.fn((slotId) => {
          operations.push(`dirty:${slotId}`);
          return dirty;
        }),
      };
      const result = await new WorldStart(
        saves,
        new AreaLoader(CONTENT_REGISTRY),
        CONTENT_REGISTRY,
        () => 1,
      ).start(payload('new'));

      expect(result).toMatchObject({ kind: 'failed', reason: 'save-failed', saveState });
      expect(operations).toEqual(['read:slot-1', 'save:slot-1', 'dirty:slot-1']);
      expect(saves.saveNow).toHaveBeenCalledTimes(1);
      expect(saves.hasDirtySave).toHaveBeenCalledTimes(1);
    }
  });

  test('reports a rejected read as unavailable without writing', async () => {
    const saves = port(async () => {
      throw new Error('read failed');
    });
    const result = await new WorldStart(
      saves,
      new AreaLoader(CONTENT_REGISTRY),
      CONTENT_REGISTRY,
      () => 1,
    ).start(payload('new'));

    expect(result).toMatchObject({ kind: 'failed', reason: 'slot-unavailable' });
    expect(saves.saveNow).not.toHaveBeenCalled();
  });

  test('stopping during a deferred read prevents any save continuation', async () => {
    const reading = deferred<SaveReadResult>();
    const saves = port(() => reading.promise);
    const start = new WorldStart(
      saves,
      new AreaLoader(CONTENT_REGISTRY),
      CONTENT_REGISTRY,
      () => 1,
    );
    const result = start.start(payload('new'));
    start.stop();
    reading.resolve({ kind: 'empty' });

    await expect(result).resolves.toEqual({ kind: 'stopped' });
    expect(saves.saveNow).not.toHaveBeenCalled();
  });

  test('stopping during a deferred save permits no ready continuation or additional write', async () => {
    const saving = deferred<void>();
    const saves = port(async () => ({ kind: 'empty' }), { saveNow: () => saving.promise });
    const start = new WorldStart(
      saves,
      new AreaLoader(CONTENT_REGISTRY),
      CONTENT_REGISTRY,
      () => 1,
    );
    const result = start.start(payload('new'));
    await settleAsync();
    expect(saves.saveNow).toHaveBeenCalledTimes(1);
    start.stop();
    saving.reject(new Error('late write failure'));

    await expect(result).resolves.toEqual({ kind: 'stopped' });
    expect(saves.saveNow).toHaveBeenCalledTimes(1);
    expect(saves.hasDirtySave).not.toHaveBeenCalled();
  });

  test('a newer start invalidates an older deferred read before it can save', async () => {
    const firstRead = deferred<SaveReadResult>();
    let reads = 0;
    const saves = port(async () => {
      reads += 1;
      return reads === 1 ? firstRead.promise : { kind: 'empty' };
    });
    const start = new WorldStart(
      saves,
      new AreaLoader(CONTENT_REGISTRY),
      CONTENT_REGISTRY,
      () => 1,
    );
    const first = start.start(payload('new'));
    const second = start.start({ ...payload('new'), slotId: 'slot-2' });
    await expect(second).resolves.toMatchObject({ kind: 'ready', slotId: 'slot-2' });
    firstRead.resolve({ kind: 'empty' });

    await expect(first).resolves.toEqual({ kind: 'stopped' });
    expect(saves.saveNow).toHaveBeenCalledTimes(1);
    expect(saves.saveNow).toHaveBeenCalledWith('slot-2', expect.any(Object));
  });

  test('a newer start invalidates an older start whose save is still pending', async () => {
    const firstSave = deferred<void>();
    const saves = port(async () => ({ kind: 'empty' }), {
      saveNow: (slotId) => (slotId === 'slot-1' ? firstSave.promise : Promise.resolve()),
    });
    const start = new WorldStart(
      saves,
      new AreaLoader(CONTENT_REGISTRY),
      CONTENT_REGISTRY,
      () => 1,
    );
    const first = start.start(payload('new'));
    await settleAsync();
    expect(saves.saveNow).toHaveBeenCalledWith('slot-1', expect.any(Object));

    const second = start.start({ ...payload('new'), slotId: 'slot-2' });
    await expect(second).resolves.toMatchObject({ kind: 'ready', slotId: 'slot-2' });
    firstSave.resolve();

    await expect(first).resolves.toEqual({ kind: 'stopped' });
    expect(saves.saveNow).toHaveBeenCalledTimes(2);
    expect(saves.hasDirtySave).not.toHaveBeenCalled();
  });
});
