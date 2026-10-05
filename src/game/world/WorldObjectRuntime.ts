import { stableId } from '../core/StableId';
import type { QuestFlagId } from '../core/StableId';
import { freezeCombatImpactResolution } from '../combat/CombatImpact';
import type { CombatImpact, CombatImpactResolution } from '../combat/CombatImpact';
import type { HurtboxTarget } from '../combat/HitboxSystem';
import { deepFreeze, immutableClone } from '../data/immutability';
import type {
  BreakableDefinition,
  ChestDefinition,
  ContentRegistry,
  DiscoveryDefinition,
  MechanismDefinition,
  MechanismId,
  PuzzleActivation,
  PuzzleDefinition,
  PuzzleStepDefinition,
  Rect,
  TriggerDefinition,
} from '../data/types';
import type { PlayerState } from '../entities/player/PlayerState';
import type { RoomId, SaveV1 } from '../saves/SaveSchema';
import type { LoadedArea } from './AreaLoader';
import { BreakableSystem } from './BreakableSystem';
import { EMPTY_PUZZLE_TRANSIENT, PuzzleSystem } from './PuzzleSystem';
import type { PuzzleTransientSnapshot } from './PuzzleSystem';
import type { ProgressionCommand } from './WorldProgression';
import { matchesWorldPredicate } from './WorldPredicates';

export type WorldObjectProposalKind =
  | 'room-entry'
  | 'chest'
  | 'discovery'
  | 'puzzle-advanced'
  | 'puzzle-completed'
  | 'shortcut'
  | 'story-trigger'
  | 'breakable';

export type WorldObjectProposal = Readonly<{
  kind: WorldObjectProposalKind;
  token: number;
  commands: readonly ProgressionCommand[];
  consumedInteractBufferId: number | null;
  puzzleId?: string;
  chestId?: string;
  discoveryId?: string;
  shortcutId?: string;
  breakableId?: string;
}>;

export type WorldObjectStep = Readonly<{
  prompt: string | null;
  proposal: WorldObjectProposal | null;
}>;

export type WorldObjectSnapshot = Readonly<{
  roomId: RoomId;
  puzzles: readonly Readonly<{
    puzzleId: string;
    state: 'advanced' | 'solved';
    activatedMechanismIds?: readonly string[];
  }>[];
  chests: readonly Readonly<{ chestId: string; state: 'closed' | 'opened' }>[];
  discoveries: readonly Readonly<{ discoveryId: string; state: 'available' | 'claimed' }>[];
  shortcuts: readonly Readonly<{ shortcutId: string; state: 'closed' | 'opened' }>[];
  breakables: readonly Readonly<{ breakableId: string; state: 'closed' | 'opened' }>[];
}>;

export type WorldObjectRuntimeOptions = Readonly<{
  area: LoadedArea;
  roomId: RoomId;
  puzzles: readonly PuzzleDefinition[];
  registry: ContentRegistry;
  save: SaveV1;
}>;

type PendingObjectProposal = Readonly<{
  proposal: WorldObjectProposal;
  prompt: string | null;
  nextTransient: PuzzleTransientSnapshot | null;
  edgeKey: string | null;
}>;

type PuzzleMechanism = Readonly<{
  definition: MechanismDefinition;
  puzzle: PuzzleDefinition;
  step: PuzzleStepDefinition;
}>;

type Candidate = Readonly<{
  actionable?: boolean;
  prompt: string | null;
  kind: WorldObjectProposalKind;
  commands: readonly ProgressionCommand[];
  consumedInteractBufferId: number | null;
  nextTransient?: PuzzleTransientSnapshot;
  edgeKey?: string;
  puzzleId?: string;
  chestId?: string;
  discoveryId?: string;
  shortcutId?: string;
  breakableId?: string;
}>;

export class WorldObjectRuntime {
  private readonly roomId: RoomId;
  private readonly chests: readonly ChestDefinition[];
  private readonly discoveries: readonly DiscoveryDefinition[];
  private readonly mechanisms: readonly MechanismDefinition[];
  private readonly triggers: readonly TriggerDefinition[];
  private readonly breakables: readonly BreakableDefinition[];
  private readonly puzzleDefinitions: readonly PuzzleDefinition[];
  private readonly puzzleMechanisms: readonly PuzzleMechanism[];
  private readonly puzzleSystem: PuzzleSystem;
  private readonly breakableSystem: BreakableSystem;
  private transient: PuzzleTransientSnapshot = EMPTY_PUZZLE_TRANSIENT;
  private readonly insideEdges = new Set<string>();
  private readonly usedInteractBufferIds = new Set<number>();
  private pending: PendingObjectProposal | null = null;
  private nextToken = 1;
  private disposed = false;

  public constructor(options: WorldObjectRuntimeOptions) {
    this.roomId = options.roomId;
    this.chests = immutableClone(options.area.chestsFor(options.roomId));
    this.discoveries = immutableClone(options.area.discoveriesFor(options.roomId));
    this.mechanisms = immutableClone(options.area.mechanismsFor(options.roomId));
    this.triggers = immutableClone(options.area.triggersFor(options.roomId));
    this.breakables = immutableClone(options.area.breakablesFor(options.roomId));
    this.puzzleDefinitions = immutableClone(
      options.puzzles.filter(({ roomId }) => roomId === options.roomId),
    );
    this.puzzleSystem = new PuzzleSystem(this.puzzleDefinitions);
    this.breakableSystem = new BreakableSystem(options.registry);
    this.puzzleMechanisms = Object.freeze(
      this.mechanisms.flatMap((definition) => {
        if (definition.kind !== 'puzzle') return [];
        const puzzle = this.puzzleDefinitions.find(
          ({ puzzleId }) => puzzleId === definition.puzzleId,
        );
        const step =
          puzzle === undefined
            ? undefined
            : stepsFor(puzzle).find(({ mechanismId }) => mechanismId === definition.mechanismId);
        return puzzle === undefined || step === undefined ? [] : [{ definition, puzzle, step }];
      }),
    );
  }

  public prepareRoomEntry(save: SaveV1): WorldObjectProposal | null {
    if (this.disposed) return null;
    if (this.pending !== null) return this.pending.proposal;
    const commands: ProgressionCommand[] = [];
    if (!save.worldProgress.discoveredRooms.includes(this.roomId)) {
      commands.push({ kind: 'discover-room', roomId: this.roomId });
    }
    for (const discovery of this.discoveries) {
      if (
        discovery.activation === 'room-entry' &&
        !save.worldProgress.claimedDiscoveries.includes(discovery.discoveryId) &&
        matchesWorldPredicate(discovery.predicate, save)
      ) {
        commands.push(
          { kind: 'claim-discovery', discoveryId: discovery.discoveryId },
          ...discovery.rewardCommands,
        );
      }
    }
    if (commands.length === 0) return null;
    return this.installPending({
      kind: 'room-entry',
      prompt: null,
      commands,
      consumedInteractBufferId: null,
    });
  }

  public step(
    input: Readonly<{
      playerPosition: Readonly<{ x: number; y: number }>;
      playerState: PlayerState;
      interactBufferId: number | null;
      pulseMechanismIds: readonly MechanismId[];
      nowMs: number;
      save: SaveV1;
    }>,
  ): WorldObjectStep {
    if (this.disposed) return EMPTY_STEP;
    if (this.pending !== null) {
      return deepFreeze({ prompt: this.pending.prompt, proposal: this.pending.proposal });
    }
    const playerBounds = bodyBounds(input.playerPosition);
    const currentInsideEdges = this.currentInsideEdges(playerBounds);
    const acceptsMovement = movementState(input.playerState);
    const candidates =
      acceptsMovement || input.pulseMechanismIds.length > 0
        ? this.candidates(input, playerBounds, !acceptsMovement)
        : [];
    this.insideEdges.clear();
    for (const edge of currentInsideEdges) this.insideEdges.add(edge);
    const prompt = candidates.find(({ prompt: label }) => label !== null)?.prompt ?? null;
    const selected = candidates.find(({ actionable }) => actionable !== false);
    if (selected === undefined) return deepFreeze({ prompt, proposal: null });
    const proposal = this.installPending(selected);
    return deepFreeze({ prompt, proposal });
  }

  public targets(save: SaveV1): readonly HurtboxTarget[] {
    if (this.disposed) return Object.freeze([]);
    return Object.freeze(
      this.breakables
        .filter(({ shortcutId }) => !save.worldProgress.activatedShortcuts.includes(shortcutId))
        .map((breakable) =>
          deepFreeze({
            targetId: stableId<'combatant'>(breakable.breakableId),
            teamId: stableId<'team'>('environment'),
            hurtboxes: [{ ...breakable.bounds }],
          }),
        )
        .sort((left, right) => left.targetId.localeCompare(right.targetId)),
    );
  }

  public receiveImpact(impact: CombatImpact, save: SaveV1): CombatImpactResolution {
    if (this.disposed) return ignored('disposed');
    if (this.pending !== null) return ignored('invalid-target');
    const breakable = this.breakables.find(
      ({ breakableId }) => String(breakableId) === String(impact.targetId),
    );
    if (breakable === undefined) return ignored('invalid-target');
    const result = this.breakableSystem.apply(
      breakable.breakableId,
      {
        teamId: impact.source.teamId,
        attackId: impact.attackId,
        healthDamage: impact.damage.baseDamage,
      },
      save,
    );
    if (result.kind !== 'activated') return ignored('invalid-target');
    this.installPending({
      kind: 'breakable',
      prompt: null,
      commands: result.commands,
      consumedInteractBufferId: null,
      breakableId: breakable.breakableId,
    });
    return freezeCombatImpactResolution({
      kind: 'resolved',
      guard: 'none',
      manaSpent: 0,
      damage: {
        healthDamage: impact.damage.baseDamage,
        poiseDamage: impact.damage.poiseDamage,
        remainingPoise: 0,
        staggered: false,
        critical: false,
        parried: false,
      },
      remainingHealth: 0,
      remainingPoise: 0,
      staggered: false,
      defeated: true,
      projectileDisposition: impact.projectile === null ? 'continue' : 'consume',
      commands: [],
    });
  }

  public pendingProposal(): WorldObjectProposal | null {
    return this.pending?.proposal ?? null;
  }

  public commit(token: number): boolean {
    if (this.disposed || this.pending?.proposal.token !== token) return false;
    if (this.pending.nextTransient !== null) this.transient = this.pending.nextTransient;
    const bufferId = this.pending.proposal.consumedInteractBufferId;
    if (bufferId !== null) this.usedInteractBufferIds.add(bufferId);
    this.pending = null;
    return true;
  }

  public cancel(token: number): boolean {
    if (this.disposed || this.pending?.proposal.token !== token) return false;
    if (this.pending.edgeKey !== null) this.insideEdges.delete(this.pending.edgeKey);
    this.pending = null;
    return true;
  }

  public snapshot(save: SaveV1): WorldObjectSnapshot {
    const transientByPuzzle = new Map(
      this.transient.entries.map((entry) => [entry.puzzleId, entry] as const),
    );
    return deepFreeze({
      roomId: this.roomId,
      puzzles: this.puzzleDefinitions.flatMap<WorldObjectSnapshot['puzzles'][number]>(
        ({ puzzleId }) => {
          if (save.worldProgress.solvedPuzzles.includes(puzzleId)) {
            return [{ puzzleId, state: 'solved' as const }];
          }
          const entry = transientByPuzzle.get(puzzleId);
          return entry === undefined
            ? []
            : [
                {
                  puzzleId,
                  state: 'advanced' as const,
                  activatedMechanismIds: entry.activatedMechanismIds,
                },
              ];
        },
      ),
      chests: this.chests.map(({ chestId }) => ({
        chestId,
        state: save.worldProgress.openedChests.includes(chestId) ? 'opened' : 'closed',
      })),
      discoveries: this.discoveries.map(({ discoveryId }) => ({
        discoveryId,
        state: save.worldProgress.claimedDiscoveries.includes(discoveryId)
          ? 'claimed'
          : 'available',
      })),
      shortcuts: this.mechanisms
        .filter(
          (mechanism): mechanism is Extract<MechanismDefinition, { kind: 'shortcut' }> =>
            mechanism.kind === 'shortcut',
        )
        .map(({ shortcutId }) => ({
          shortcutId,
          state: save.worldProgress.activatedShortcuts.includes(shortcutId) ? 'opened' : 'closed',
        })),
      breakables: this.breakables.map(({ breakableId, shortcutId }) => ({
        breakableId,
        state: save.worldProgress.activatedShortcuts.includes(shortcutId) ? 'opened' : 'closed',
      })),
    });
  }

  public resetTransient(): boolean {
    if (this.disposed) return false;
    this.pending = null;
    this.transient = EMPTY_PUZZLE_TRANSIENT;
    this.insideEdges.clear();
    this.usedInteractBufferIds.clear();
    return true;
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.pending = null;
    this.transient = EMPTY_PUZZLE_TRANSIENT;
    this.insideEdges.clear();
    this.usedInteractBufferIds.clear();
    this.disposed = true;
    return true;
  }

  private candidates(
    input: Readonly<{
      interactBufferId: number | null;
      pulseMechanismIds: readonly MechanismId[];
      nowMs: number;
      save: SaveV1;
    }>,
    playerBounds: Rect,
    pulseOnly: boolean,
  ): Candidate[] {
    const canInteract =
      !pulseOnly &&
      input.interactBufferId !== null &&
      !this.usedInteractBufferIds.has(input.interactBufferId);
    const candidates: Candidate[] = [];
    for (const chest of this.chests) {
      if (
        pulseOnly ||
        (overlaps(chest.bounds, playerBounds) &&
          !input.save.worldProgress.openedChests.includes(chest.chestId) &&
          matchesWorldPredicate(chest.predicate, input.save))
      ) {
        if (canInteract) {
          candidates.push({
            kind: 'chest',
            prompt: chest.prompt,
            commands: [{ kind: 'open-chest', chestId: chest.chestId }, ...chest.rewardCommands],
            consumedInteractBufferId: input.interactBufferId,
            chestId: chest.chestId,
          });
        } else {
          candidates.push(idleCandidate(chest.prompt));
        }
      }
    }
    for (const discovery of this.discoveries) {
      if (
        pulseOnly ||
        discovery.activation !== 'interact' ||
        discovery.bounds === null ||
        !overlaps(discovery.bounds, playerBounds) ||
        input.save.worldProgress.claimedDiscoveries.includes(discovery.discoveryId) ||
        !matchesWorldPredicate(discovery.predicate, input.save)
      ) {
        continue;
      }
      const prompt = `Examine ${discovery.displayName}`;
      if (canInteract) {
        candidates.push({
          kind: 'discovery',
          prompt,
          commands: [
            { kind: 'claim-discovery', discoveryId: discovery.discoveryId },
            ...discovery.rewardCommands,
          ],
          consumedInteractBufferId: input.interactBufferId,
          discoveryId: discovery.discoveryId,
        });
      } else {
        candidates.push(idleCandidate(prompt));
      }
    }
    for (const mechanism of this.mechanisms) {
      if (
        !overlaps(mechanism.bounds, playerBounds) ||
        !mechanismRequirements(mechanism, input.save)
      ) {
        continue;
      }
      if (mechanism.kind === 'shortcut') {
        if (pulseOnly) continue;
        if (input.save.worldProgress.activatedShortcuts.includes(mechanism.shortcutId)) continue;
        const prompt = 'Open shortcut';
        if (canInteract) {
          candidates.push({
            kind: 'shortcut',
            prompt,
            commands: [{ kind: 'activate-shortcut', shortcutId: mechanism.shortcutId }],
            consumedInteractBufferId: input.interactBufferId,
            shortcutId: mechanism.shortcutId,
          });
        } else {
          candidates.push(idleCandidate(prompt));
        }
        continue;
      }
      const match = this.puzzleMechanisms.find(
        ({ definition }) => definition.mechanismId === mechanism.mechanismId,
      );
      if (
        match === undefined ||
        input.save.worldProgress.solvedPuzzles.includes(match.puzzle.puzzleId)
      ) {
        continue;
      }
      const edgeKey = `mechanism:${mechanism.mechanismId}`;
      const activates = pulseOnly
        ? match.step.activation === 'resonant-pulse' &&
          input.pulseMechanismIds.includes(mechanism.mechanismId)
        : (match.step.activation === 'enter' && !this.insideEdges.has(edgeKey)) ||
          (match.step.activation === 'interact' && canInteract) ||
          (match.step.activation === 'resonant-pulse' &&
            input.pulseMechanismIds.includes(mechanism.mechanismId));
      const prompt =
        match.step.activation === 'interact' ? `Use ${match.puzzle.displayName}` : null;
      if (!activates) {
        if (prompt !== null) candidates.push(idleCandidate(prompt));
        continue;
      }
      const result = this.puzzleSystem.apply(
        mechanism.mechanismId,
        { kind: match.step.activation as PuzzleActivation, nowMs: input.nowMs },
        { save: input.save, transient: this.transient },
      );
      if (result.kind === 'rejected' || result.kind === 'unchanged') continue;
      candidates.push({
        kind: result.kind === 'completed' ? 'puzzle-completed' : 'puzzle-advanced',
        prompt,
        commands: result.commands,
        consumedInteractBufferId:
          match.step.activation === 'interact' ? input.interactBufferId : null,
        nextTransient: result.transient,
        edgeKey: match.step.activation === 'enter' ? edgeKey : undefined,
        puzzleId: match.puzzle.puzzleId,
      });
    }
    for (const trigger of this.triggers) {
      if (trigger.action.kind !== 'set-fact' || !overlaps(trigger.bounds, playerBounds)) continue;
      if (input.save.quests.flags.includes(trigger.action.factId)) continue;
      const edgeKey = `trigger:${trigger.triggerId}`;
      const activates =
        (trigger.activation === 'enter' && !this.insideEdges.has(edgeKey)) ||
        (trigger.activation === 'interact' && canInteract);
      const prompt = trigger.activation === 'interact' ? triggerPrompt(trigger) : null;
      if (!activates) {
        if (prompt !== null) candidates.push(idleCandidate(prompt));
        continue;
      }
      candidates.push({
        kind: 'story-trigger',
        prompt,
        commands: [{ kind: 'set-fact', factId: trigger.action.factId }],
        consumedInteractBufferId: trigger.activation === 'interact' ? input.interactBufferId : null,
        edgeKey: trigger.activation === 'enter' ? edgeKey : undefined,
      });
    }
    return candidates;
  }

  private currentInsideEdges(playerBounds: Rect): ReadonlySet<string> {
    const edges = new Set<string>();
    for (const { definition, step } of this.puzzleMechanisms) {
      if (step.activation === 'enter' && overlaps(definition.bounds, playerBounds)) {
        edges.add(`mechanism:${definition.mechanismId}`);
      }
    }
    for (const trigger of this.triggers) {
      if (trigger.activation === 'enter' && overlaps(trigger.bounds, playerBounds)) {
        edges.add(`trigger:${trigger.triggerId}`);
      }
    }
    return edges;
  }

  private installPending(candidate: Candidate): WorldObjectProposal {
    const proposal = deepFreeze({
      kind: candidate.kind,
      token: this.nextToken,
      commands: candidate.commands,
      consumedInteractBufferId: candidate.consumedInteractBufferId,
      ...(candidate.puzzleId === undefined ? {} : { puzzleId: candidate.puzzleId }),
      ...(candidate.chestId === undefined ? {} : { chestId: candidate.chestId }),
      ...(candidate.discoveryId === undefined ? {} : { discoveryId: candidate.discoveryId }),
      ...(candidate.shortcutId === undefined ? {} : { shortcutId: candidate.shortcutId }),
      ...('breakableId' in candidate && candidate.breakableId !== undefined
        ? { breakableId: candidate.breakableId }
        : {}),
    }) as WorldObjectProposal;
    this.nextToken += 1;
    this.pending = Object.freeze({
      proposal,
      prompt: candidate.prompt,
      nextTransient: candidate.nextTransient ?? null,
      edgeKey: candidate.edgeKey ?? null,
    });
    return proposal;
  }
}

const EMPTY_STEP: WorldObjectStep = deepFreeze({ prompt: null, proposal: null });

function bodyBounds(position: Readonly<{ x: number; y: number }>): Rect {
  return Object.freeze({ x: position.x - 24, y: position.y - 96, width: 48, height: 96 });
}

function movementState(state: PlayerState): boolean {
  return ['idle', 'run', 'jump', 'fall', 'land', 'climb'].includes(state);
}

function overlaps(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function stepsFor(puzzle: PuzzleDefinition): readonly PuzzleStepDefinition[] {
  return puzzle.program.kind === 'item-lock' || puzzle.program.kind === 'single'
    ? [puzzle.program.step]
    : puzzle.program.steps;
}

function mechanismRequirements(mechanism: MechanismDefinition, save: SaveV1): boolean {
  return (
    (mechanism.requiredAbilityId === null ||
      save.player.unlockedAbilities.includes(mechanism.requiredAbilityId)) &&
    (mechanism.requiredFactId === null || save.quests.flags.includes(mechanism.requiredFactId))
  );
}

function triggerPrompt(trigger: TriggerDefinition): string {
  const factId = (trigger.action as Readonly<{ factId: QuestFlagId }>).factId;
  if (factId.includes('lantern')) return 'Light memorial lantern';
  if (factId === 'root-memory-recovered') return 'Recover the root memory';
  return 'Listen';
}

function idleCandidate(prompt: string): Candidate {
  return {
    actionable: false,
    kind: 'story-trigger',
    prompt,
    commands: [],
    consumedInteractBufferId: null,
  };
}

function ignored(reason: 'invalid-target' | 'disposed'): CombatImpactResolution {
  return freezeCombatImpactResolution({
    kind: 'ignored',
    reason,
    projectileDisposition: 'continue',
    commands: [],
  });
}
