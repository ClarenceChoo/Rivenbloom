import { describe, expect, it } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY, WRENS_REST_AREA } from '../../src/game/data/areas';
import { AreaLoader } from '../../src/game/world/AreaLoader';
import { WorldInteractionRuntime } from '../../src/game/world/WorldInteractionRuntime';

function step(runtime: WorldInteractionRuntime, x: number, interactBufferId: number | null) {
  return runtime.step({
    playerPosition: { x, y: 608 },
    playerState: 'idle',
    interactBufferId,
    facts: [],
    fulfilledTriggerIds: [],
  });
}

describe('WorldInteractionRuntime', () => {
  it('uses the sampled interaction buffer once, halts on an NPC modal, and rearms after release', () => {
    const area = new AreaLoader(CONTENT_REGISTRY).load(WRENS_REST_AREA);
    const runtime = new WorldInteractionRuntime(
      area,
      stableId<'room'>('wren-rest-square'),
      CONTENT_REGISTRY.npcs,
    );

    const accepted = step(runtime, 672, 7);
    expect(accepted).toMatchObject({
      kind: 'accepted',
      consumedInteractBufferId: 7,
      halt: true,
      prompt: 'Speak with Sela',
      action: { kind: 'interact-npc', spawnId: 'sela-at-chart-table' },
    });
    expect(accepted.npcs.find(({ spawnId }) => spawnId === 'sela-at-chart-table')).toMatchObject({
      facing: 'left',
    });

    expect(step(runtime, 672, 7).kind).toBe('idle');
    runtime.cancelAcceptedInteraction();
    expect(step(runtime, 672, 7)).toMatchObject({
      kind: 'accepted',
      consumedInteractBufferId: 7,
    });
    expect(step(runtime, 672, 7).kind).toBe('idle');
    expect(step(runtime, 672, null).kind).toBe('idle');
    expect(step(runtime, 672, 8)).toMatchObject({
      kind: 'accepted',
      consumedInteractBufferId: 8,
    });
  });

  it('resolves the seed-lantern by stable checkpoint ID and exposes authored prompt order', () => {
    const area = new AreaLoader(CONTENT_REGISTRY).load(WRENS_REST_AREA);
    const runtime = new WorldInteractionRuntime(
      area,
      stableId<'room'>('wren-rest-square'),
      CONTENT_REGISTRY.npcs,
    );
    const rest = step(runtime, 256, 1);
    expect(rest).toMatchObject({
      kind: 'accepted',
      halt: true,
      prompt: 'Rest at Village Seed-Lantern',
      action: {
        kind: 'activate-checkpoint',
        areaId: 'wren-rest',
        checkpointId: 'village-well',
      },
    });
    expect(runtime.dispose()).toBe(true);
    expect(runtime.dispose()).toBe(false);
    expect(step(runtime, 256, 2)).toMatchObject({ kind: 'idle', prompt: null });
  });

  it('uses authored checkpoint names in every area prompt', () => {
    const loader = new AreaLoader(CONTENT_REGISTRY);
    for (const definition of CONTENT_REGISTRY.areas) {
      const area = loader.load(definition);
      for (const checkpoint of definition.checkpoints) {
        const runtime = new WorldInteractionRuntime(area, checkpoint.roomId, CONTENT_REGISTRY.npcs);
        const sample = runtime.step({
          playerPosition: checkpoint.interactionPosition,
          playerState: 'idle',
          interactBufferId: null,
          facts: [],
          fulfilledTriggerIds: [],
        });
        expect(sample.prompt, `${definition.areaId}/${checkpoint.checkpointId}`).toBe(
          `Rest at ${checkpoint.displayName}`,
        );
        runtime.dispose();
      }
    }
  });
});
