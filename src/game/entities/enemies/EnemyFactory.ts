import { stableId } from '../../core/StableId';
import type { EncounterDirector } from '../../ai/EncounterDirector';
import { immutableClone } from '../../data/immutability';
import type {
  ActorDefinition,
  ActorSpawnDefinition,
  AiProfileDefinition,
  AttackDefinition,
  DropTableDefinition,
  EnemyActorDefinition,
} from '../../data/types';
import { EnemyController } from './EnemyController';
import type { EnemyDynamicPorts } from './EnemyController';

export type EnemyFactoryOptions = Readonly<{
  actors: readonly ActorDefinition[];
  profiles: readonly AiProfileDefinition[];
  attacks: readonly AttackDefinition[];
  dropTables: readonly DropTableDefinition[];
}>;

export class EnemyFactory {
  private readonly actors: readonly ActorDefinition[];
  private readonly profiles: readonly AiProfileDefinition[];
  private readonly attacks: readonly AttackDefinition[];
  private readonly dropTables: readonly DropTableDefinition[];
  private readonly spawnedIds = new Set<string>();

  public constructor(options: EnemyFactoryOptions) {
    this.actors = immutableClone(options.actors);
    this.profiles = immutableClone(options.profiles);
    this.attacks = immutableClone(options.attacks);
    this.dropTables = immutableClone(options.dropTables);
  }

  public create(
    rawSpawn: ActorSpawnDefinition,
    director: EncounterDirector,
    ports: EnemyDynamicPorts,
  ): EnemyController {
    const spawn = immutableClone(rawSpawn);
    if (this.spawnedIds.has(spawn.spawnId)) {
      throw new RangeError(`Duplicate enemy spawn ID: ${spawn.spawnId}`);
    }
    const actor = this.actors.find(({ actorId }) => actorId === spawn.actorId);
    if (actor === undefined) throw new RangeError(`Missing enemy actor: ${spawn.actorId}`);
    if (actor.kind !== 'enemy') throw new RangeError(`Actor is not an enemy: ${spawn.actorId}`);
    const enemyActor: EnemyActorDefinition = actor;
    const profile = this.profiles.find(({ aiProfileId }) => aiProfileId === enemyActor.aiProfileId);
    if (profile === undefined || profile.actorId !== enemyActor.actorId) {
      throw new RangeError(`Missing or mismatched enemy profile: ${enemyActor.aiProfileId}`);
    }
    const resolvedAttacks = enemyActor.attackIds.map((attackId) => {
      const attack = this.attacks.find((candidate) => candidate.attackId === attackId);
      if (attack === undefined) throw new RangeError(`Missing enemy attack: ${attackId}`);
      return attack;
    });
    for (const pattern of profile.attacks) {
      if (!resolvedAttacks.some(({ attackId }) => attackId === pattern.attackId)) {
        throw new RangeError(`Missing enemy profile attack: ${pattern.attackId}`);
      }
    }
    const dropTable =
      enemyActor.dropTableId === null
        ? null
        : (this.dropTables.find(({ dropTableId }) => dropTableId === enemyActor.dropTableId) ??
          null);
    if (enemyActor.dropTableId !== null && dropTable === null) {
      throw new RangeError(`Missing enemy drop table: ${enemyActor.dropTableId}`);
    }
    this.spawnedIds.add(spawn.spawnId);
    return new EnemyController({
      combatantId: stableId<'combatant'>(spawn.spawnId),
      teamId: stableId<'team'>('hostile'),
      spawn,
      actor: enemyActor,
      profile,
      attacks: resolvedAttacks,
      dropTable,
      director,
      ports,
    });
  }
}
