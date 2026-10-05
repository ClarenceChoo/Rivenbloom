import { deepFreeze, immutableClone } from '../data/immutability';
import type {
  ActorDefinition,
  ActorSpawnDefinition,
  ActorSpawnId,
  DropTableDefinition,
  EncounterDefinition,
  EncounterId,
} from '../data/types';
import type { SaveV1 } from '../saves/SaveSchema';
import type { WorldCombatJournalEvent } from './WorldCombatRuntime';
import type { ProgressionCommand } from './WorldProgression';
import { matchesWorldPredicate } from './WorldPredicates';

export type EncounterProgressProposal = Readonly<{
  kind: 'progress';
  token: number;
  commands: readonly ProgressionCommand[];
  completedEncounterIds: readonly EncounterId[];
  dropSpawnIds: readonly ActorSpawnId[];
}>;

export type EncounterProgressSnapshot = Readonly<{
  activeSpawnIds: readonly ActorSpawnId[];
  defeatedSpawnIds: readonly ActorSpawnId[];
  completedEncounterIds: readonly EncounterId[];
  pending: EncounterProgressProposal | null;
}>;

export type EncounterProgressRuntimeOptions = Readonly<{
  encounters: readonly EncounterDefinition[];
  spawns: readonly ActorSpawnDefinition[];
  actors: readonly ActorDefinition[];
  dropTables: readonly DropTableDefinition[];
  save: SaveV1;
}>;

export class EncounterProgressRuntime {
  private readonly encounters: readonly EncounterDefinition[];
  private readonly spawns: readonly ActorSpawnDefinition[];
  private readonly actorsById: ReadonlyMap<string, ActorDefinition>;
  private readonly dropTablesById: ReadonlyMap<string, DropTableDefinition>;
  private readonly activeSpawnIds: ReadonlySet<ActorSpawnId>;
  private readonly defeatedSpawnIds = new Set<ActorSpawnId>();
  private readonly completedEncounterIds = new Set<EncounterId>();
  private readonly committedDropSpawnIds = new Set<ActorSpawnId>();
  private pending: EncounterProgressProposal | null = null;
  private nextToken = 1;
  private disposed = false;

  public constructor(options: EncounterProgressRuntimeOptions) {
    this.encounters = immutableClone(
      options.encounters.filter((encounter) =>
        matchesWorldPredicate(encounter.predicate, options.save),
      ),
    );
    const activeEncounterSpawnIds = new Set(this.encounters.flatMap(({ spawnIds }) => spawnIds));
    this.actorsById = new Map(options.actors.map((actor) => [actor.actorId, actor]));
    this.dropTablesById = new Map(options.dropTables.map((table) => [table.dropTableId, table]));
    this.spawns = immutableClone(
      options.spawns.filter((spawn) => {
        const actor = this.actorsById.get(spawn.actorId);
        if (actor?.kind !== 'enemy' && actor?.kind !== 'boss') return false;
        return spawn.encounterId === null || activeEncounterSpawnIds.has(spawn.spawnId);
      }),
    );
    this.activeSpawnIds = new Set(this.spawns.map(({ spawnId }) => spawnId));
  }

  public activeSpawns(): readonly ActorSpawnDefinition[] {
    if (this.disposed) return Object.freeze([]);
    return this.spawns;
  }

  public observe(events: readonly WorldCombatJournalEvent[]): EncounterProgressProposal | null {
    if (this.disposed) return null;
    if (this.pending !== null) return this.pending;
    const requestedDrops: ActorSpawnId[] = [];
    for (const journalEvent of events) {
      if (journalEvent.kind !== 'enemy-event') continue;
      const spawnId = journalEvent.combatantId as unknown as ActorSpawnId;
      if (!this.activeSpawnIds.has(spawnId)) continue;
      if (journalEvent.event.kind === 'state-changed' && journalEvent.event.to === 'dead') {
        this.defeatedSpawnIds.add(spawnId);
      }
      if (
        journalEvent.event.kind === 'drop-request' &&
        journalEvent.event.combatantId === journalEvent.combatantId &&
        !this.committedDropSpawnIds.has(spawnId) &&
        !requestedDrops.includes(spawnId) &&
        this.dropCommands(spawnId, journalEvent.event.dropTableId) !== null
      ) {
        requestedDrops.push(spawnId);
      }
    }

    const completed = this.encounters
      .filter(
        (encounter) =>
          !this.completedEncounterIds.has(encounter.encounterId) &&
          encounter.spawnIds.length > 0 &&
          encounter.spawnIds.every((spawnId) => this.defeatedSpawnIds.has(spawnId)),
      )
      .map(({ encounterId }) => encounterId);
    if (requestedDrops.length === 0 && completed.length === 0) return null;
    const commands = [
      ...requestedDrops.flatMap((spawnId) => {
        const spawn = this.spawns.find((candidate) => candidate.spawnId === spawnId);
        const actor = spawn === undefined ? undefined : this.actorsById.get(spawn.actorId);
        return actor?.dropTableId === null || actor?.dropTableId === undefined
          ? []
          : (this.dropCommands(spawnId, actor.dropTableId) ?? []);
      }),
      ...completed.flatMap(
        (encounterId) =>
          this.encounters.find((encounter) => encounter.encounterId === encounterId)
            ?.completionCommands ?? [],
      ),
    ];
    this.pending = deepFreeze({
      kind: 'progress',
      token: this.nextToken,
      commands,
      completedEncounterIds: completed,
      dropSpawnIds: requestedDrops,
    });
    this.nextToken += 1;
    return this.pending;
  }

  public commit(token: number): boolean {
    if (this.disposed || this.pending?.token !== token) return false;
    for (const spawnId of this.pending.dropSpawnIds) this.committedDropSpawnIds.add(spawnId);
    for (const encounterId of this.pending.completedEncounterIds) {
      this.completedEncounterIds.add(encounterId);
    }
    this.pending = null;
    return true;
  }

  public snapshot(): EncounterProgressSnapshot {
    return deepFreeze({
      activeSpawnIds: [...this.activeSpawnIds].sort(compare),
      defeatedSpawnIds: [...this.defeatedSpawnIds].sort(compare),
      completedEncounterIds: [...this.completedEncounterIds].sort(compare),
      pending: this.pending,
    });
  }

  public resetTransient(): boolean {
    if (this.disposed) return false;
    this.pending = null;
    this.defeatedSpawnIds.clear();
    this.completedEncounterIds.clear();
    this.committedDropSpawnIds.clear();
    return true;
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.pending = null;
    this.defeatedSpawnIds.clear();
    this.completedEncounterIds.clear();
    this.committedDropSpawnIds.clear();
    this.disposed = true;
    return true;
  }

  private dropCommands(
    spawnId: ActorSpawnId,
    dropTableId: DropTableDefinition['dropTableId'],
  ): readonly ProgressionCommand[] | null {
    const spawn = this.spawns.find((candidate) => candidate.spawnId === spawnId);
    const actor = spawn === undefined ? undefined : this.actorsById.get(spawn.actorId);
    const table = this.dropTablesById.get(dropTableId);
    if (actor?.dropTableId !== dropTableId || table?.entries.length !== 1) return null;
    const entry = table.entries[0];
    if (entry === undefined) return null;
    return deepFreeze([{ kind: 'grant-item', itemId: entry.itemId, quantity: entry.quantity }]);
  }
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
