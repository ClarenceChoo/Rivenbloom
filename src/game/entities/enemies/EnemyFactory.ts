import { actorDefinitions } from '../../data/actors';
import type { ActorSpawnDefinition } from '../../data/types';
import { EnemyController, type EnemyDirectorPort } from './EnemyController';
import { getEnemyProfile } from './profiles';

export class EnemyFactory {
  public constructor(private readonly director: EnemyDirectorPort) {}

  public create(spawn: ActorSpawnDefinition): EnemyController {
    const actor = actorDefinitions.find(({ id }) => id === spawn.actorId);
    if (actor === undefined) {
      throw new Error(`Unknown enemy actor "${spawn.actorId}" for spawn "${spawn.id}".`);
    }
    if (actor.kind !== 'enemy' && actor.kind !== 'elite') {
      throw new Error(`Actor "${actor.id}" is not an enemy and cannot be spawned as one.`);
    }
    const profile = getEnemyProfile(actor.aiProfileId);
    if (profile === undefined) {
      throw new Error(`Missing AI profile "${actor.aiProfileId}" for actor "${actor.id}".`);
    }
    return new EnemyController(spawn.id, actor, profile, spawn, this.director);
  }
}
