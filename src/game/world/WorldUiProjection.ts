import { projectRoomMap } from '../ui/RoomMapProjection';
import type { RoomMap } from '../ui/RoomMapProjection';
import { deepFreeze } from '../data/immutability';
import { ITEMS } from '../data/items';
import { PUZZLES } from '../data/areas';
import {
  isRecoveringRootMemory,
  isSeekingWayfinderDash,
  QUESTS,
  ROOT_MEMORY_RECOVERY_OBJECTIVE,
  WAYFINDER_DASH_OBJECTIVE,
} from '../data/quests';
import type { AreaDefinition, CheckpointDefinition, RoomDefinition } from '../data/types';
import type { SaveSettings, SaveV1 } from '../saves/SaveSchema';
import type { RuntimeAutosaveState, RuntimeVitals } from './RuntimeSaveCoordinator';
import type { WorldObjectSnapshot } from './WorldObjectRuntime';
import type { BossHealthEvent } from '../entities/bosses/BossEvents';

export type WorldUiProjection = Readonly<{
  revision: number;
  map?: RoomMap;
  inputDevice?: 'keyboard' | 'gamepad' | null;
  bindingOverrides?: SaveV1['bindingOverrides'];
  settings?: SaveSettings;
  area: Readonly<{ areaId: string; label: string }>;
  room: Readonly<{ roomId: string; label: string }>;
  prompt: string | null;
  puzzleHint?: string | null;
  puzzleHintCompact?: string | null;
  player: Readonly<{
    currentHealth: number;
    maxHealth: number;
    currentMana: number;
    maxMana: number;
    experience: number;
    currency: number;
    weaponLevel: number;
    selectedAbilityId: string | null;
  }>;
  checkpoint: Readonly<{ checkpointId: string; label: string }>;
  world: Readonly<{
    discoveredRoomIds: readonly string[];
    objects: WorldObjectSnapshot;
  }>;
  quests: readonly Readonly<{
    questId: string;
    displayName: string;
    stageId: string;
    title: string;
    objective: string;
    status: 'active' | 'complete';
  }>[];
  inventory: readonly Readonly<{
    itemId: string;
    displayName: string;
    description: string;
    category: 'material' | 'quest' | 'charm' | 'recovery';
    quantity: number;
    equippedSlots: readonly string[];
  }>[];
  autosave: RuntimeAutosaveState;
  boss: BossHealthEvent | null;
}>;

export function projectWorldUi(
  input: Readonly<{
    revision: number;
    inputDevice?: 'keyboard' | 'gamepad' | null;
    save: SaveV1;
    area: AreaDefinition;
    room: RoomDefinition;
    checkpoint: CheckpointDefinition;
    prompt: string | null;
    liveVitals: RuntimeVitals;
    autosave: RuntimeAutosaveState;
    objects: WorldObjectSnapshot;
    selectedAbilityId?: string | null;
    boss?: BossHealthEvent | null;
  }>,
): WorldUiProjection {
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) {
    throw new RangeError('World UI revision must be a non-negative safe integer.');
  }
  const quests = input.save.quests.stages.map(({ questId, stageId }) => {
    const quest = QUESTS.find(({ definition }) => definition.questId === questId)?.definition;
    const stage = quest?.stages.find((candidate) => candidate.stageId === stageId);
    if (quest === undefined || stage === undefined) {
      throw new RangeError('World UI cannot project unknown quest content.');
    }
    return {
      questId,
      displayName: quest.displayName ?? questId,
      stageId,
      title: stage.title ?? quest.displayName ?? questId,
      objective:
        questId === 'the-silent-bloom' && isRecoveringRootMemory(stageId, input.save.quests.flags)
          ? ROOT_MEMORY_RECOVERY_OBJECTIVE
          : questId === 'the-silent-bloom' &&
              isSeekingWayfinderDash(stageId, input.save.quests.flags)
            ? WAYFINDER_DASH_OBJECTIVE
            : (stage.objective ?? ''),
      status: stageId === 'complete' ? ('complete' as const) : ('active' as const),
    };
  });
  const inventory = input.save.inventory.map(({ itemId, quantity }) => {
    const item = ITEMS.find((candidate) => candidate.itemId === itemId);
    if (item === undefined) throw new RangeError('World UI cannot project unknown item content.');
    return {
      itemId,
      displayName: item.displayName,
      description: item.description,
      category: item.category,
      quantity,
      equippedSlots: input.save.equipment
        .filter((equipped) => equipped.itemId === itemId)
        .map(({ slot }) => slot),
    };
  });
  const timedPuzzle = PUZZLES.find(
    ({ roomId, program, puzzleId }) =>
      roomId === input.room.roomId &&
      program.kind === 'timed-set' &&
      !input.save.worldProgress.solvedPuzzles.includes(puzzleId) &&
      !input.objects.puzzles.some(
        (puzzle) => puzzle.puzzleId === puzzleId && puzzle.state === 'solved',
      ),
  );
  let puzzleHint: string | null = null;
  let puzzleHintCompact: string | null = null;
  if (timedPuzzle?.program.kind === 'timed-set') {
    const progress = input.objects.puzzles.find(
      ({ puzzleId }) => puzzleId === timedPuzzle.puzzleId,
    );
    const count = progress?.activatedMechanismIds?.length ?? 0;
    const seconds = progress?.remainingSeconds ?? Math.ceil(timedPuzzle.program.windowMs / 1000);
    puzzleHint = `${timedPuzzle.description} ${count}/${timedPuzzle.program.steps.length} plates · ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`;
    puzzleHintCompact = `Wake ${count}/${timedPuzzle.program.steps.length} plates · ${seconds}s.`;
  }

  return deepFreeze({
    revision: input.revision,
    inputDevice: input.inputDevice ?? null,
    settings: input.save.settings,
    bindingOverrides: input.save.bindingOverrides,
    map: projectRoomMap(input.save, input.room.roomId),
    area: { areaId: input.area.areaId, label: input.area.displayName },
    room: { roomId: input.room.roomId, label: input.room.displayName },
    prompt: input.prompt,
    puzzleHint,
    puzzleHintCompact,
    player: {
      currentHealth: input.liveVitals.currentHealth,
      maxHealth: input.save.player.baseStats.maxHealth,
      currentMana: input.liveVitals.currentMana,
      maxMana: input.save.player.baseStats.maxMana,
      experience: input.save.player.experience,
      currency: input.save.player.currency,
      weaponLevel: input.save.player.weaponLevel,
      selectedAbilityId: input.selectedAbilityId ?? null,
    },
    checkpoint: {
      checkpointId: input.checkpoint.checkpointId,
      label: input.checkpoint.displayName,
    },
    world: {
      discoveredRoomIds: [...input.save.worldProgress.discoveredRooms],
      objects: input.objects,
    },
    quests,
    inventory,
    autosave: input.autosave,
    boss: input.boss ?? null,
  });
}

export type UiSessionProjection = WorldUiProjection;

export function checkpointLabel(checkpointId: string): string {
  if (checkpointId === 'village-well') return 'Village Seed-Lantern';
  return checkpointId;
}
