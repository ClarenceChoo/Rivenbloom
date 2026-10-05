import { describe, expect, test } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { ACTORS, DROP_TABLES } from '../../src/game/data/actors';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
import { AreaLoader } from '../../src/game/world/AreaLoader';
import { EncounterProgressRuntime } from '../../src/game/world/EncounterProgressRuntime';
import type { WorldCombatJournalEvent } from '../../src/game/world/WorldCombatRuntime';
import { applyProgressionTransaction } from '../../src/game/world/WorldProgression';

function save(): SaveV1 {
  const { newGame } = CONTENT_REGISTRY;
  return createNewSave({
    nowEpochMs: 100,
    location: {
      regionId: newGame.initialRegionId,
      areaId: newGame.initialAreaId,
      checkpointId: newGame.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: newGame.baseStats,
    initialQuests: newGame.initialQuests,
    startingAbilities: newGame.startingAbilities,
  });
}

function enemyEvent(
  sequence: number,
  combatantId: string,
  event: Extract<
    Extract<WorldCombatJournalEvent, { kind: 'enemy-event' }>['event'],
    { kind: 'state-changed' | 'drop-request' }
  >,
): WorldCombatJournalEvent {
  return {
    kind: 'enemy-event',
    sequence,
    stepIndex: 1,
    occurredAtMs: 17,
    combatantId: stableId<'combatant'>(combatantId),
    event,
  };
}

describe('EncounterProgressRuntime', () => {
  test('combines the Sentinel drop table and encounter completion fact into one commit proposal', () => {
    const loader = new AreaLoader(CONTENT_REGISTRY);
    const area = loader.load(
      CONTENT_REGISTRY.areas.find(({ areaId }) => areaId === 'brackenreach')!,
    );
    const roomId = stableId<'room'>('reliquary-verge');
    const current = save();
    const runtime = new EncounterProgressRuntime({
      encounters: area.encountersFor(roomId),
      spawns: area.actorsFor(roomId),
      actors: ACTORS,
      dropTables: DROP_TABLES,
      save: current,
    });
    expect(runtime.snapshot().activeSpawnIds).toEqual(['verge-thorn-sentinel']);

    const events = [
      enemyEvent(1, 'verge-thorn-sentinel', {
        kind: 'state-changed',
        from: 'hurt',
        to: 'dead',
        atMs: 17,
      }),
      enemyEvent(2, 'verge-thorn-sentinel', {
        kind: 'drop-request',
        combatantId: stableId<'combatant'>('verge-thorn-sentinel'),
        dropTableId: stableId<'drop-table'>('thorn-sentinel-briar-core'),
        position: { x: 7680, y: 608 },
      }),
    ];
    const proposal = runtime.observe(events);

    expect(proposal).toMatchObject({
      kind: 'progress',
      completedEncounterIds: ['verge-sentinel-gate'],
      commands: [
        { kind: 'grant-item', itemId: 'briar-core', quantity: 1 },
        { kind: 'set-fact', factId: 'briar-core-claimed' },
      ],
    });
    expect(runtime.observe(events)).toEqual(proposal);
    const applied = applyProgressionTransaction(current, { commands: proposal!.commands });
    expect(applied.kind).toBe('accepted');
    if (applied.kind !== 'accepted' || proposal === null) return;
    expect(runtime.commit(proposal.token)).toBe(true);
    expect(runtime.observe(events)).toBeNull();

    const reloaded = new EncounterProgressRuntime({
      encounters: area.encountersFor(roomId),
      spawns: area.actorsFor(roomId),
      actors: ACTORS,
      dropTables: DROP_TABLES,
      save: applied.save,
    });
    expect(reloaded.snapshot().activeSpawnIds).toEqual([]);
  });

  test('completes an ordinary encounter only after its exact authored spawn set is defeated', () => {
    const loader = new AreaLoader(CONTENT_REGISTRY);
    const area = loader.load(
      CONTENT_REGISTRY.areas.find(({ areaId }) => areaId === 'brackenreach')!,
    );
    const roomId = stableId<'room'>('brackenreach-trail');
    const runtime = new EncounterProgressRuntime({
      encounters: area.encountersFor(roomId),
      spawns: area.actorsFor(roomId),
      actors: ACTORS,
      dropTables: DROP_TABLES,
      save: save(),
    });

    expect(
      runtime.observe([
        enemyEvent(1, 'trail-briar-west', {
          kind: 'state-changed',
          from: 'hurt',
          to: 'dead',
          atMs: 17,
        }),
      ]),
    ).toBeNull();
    expect(
      runtime.observe([
        enemyEvent(2, 'trail-briar-east', {
          kind: 'state-changed',
          from: 'hurt',
          to: 'dead',
          atMs: 34,
        }),
      ]),
    ).toMatchObject({
      kind: 'progress',
      completedEncounterIds: ['trail-briar-crossing'],
      commands: [],
    });
  });
});
