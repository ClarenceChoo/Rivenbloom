import type { AttackDefinition } from '../data/types';
import type { Facing } from '../physics/MovementModel';
import type { AttackInstance, HitboxContact, HitboxSystem } from './HitboxSystem';

export type ProjectileAttackDefinition = AttackDefinition & {
  readonly projectile: {
    readonly speedPerFrame: number;
    readonly lifetimeFrames: number;
    readonly pierces: boolean;
  };
};

export type CombatTimelineResult = {
  readonly advances: readonly {
    readonly instance: AttackInstance;
    readonly hits: readonly HitboxContact[];
  }[];
  readonly hits: readonly HitboxContact[];
  readonly completedInstanceIds: readonly string[];
  readonly activeAttacks: readonly AttackInstance[];
};

export const createProjectileAttackDefinition = (
  attack: AttackDefinition,
  projectile: ProjectileAttackDefinition['projectile']
): ProjectileAttackDefinition => ({
  ...attack,
  activeFrames: projectile.lifetimeFrames,
  recoveryFrames: 0,
  hitboxes: attack.hitboxes.map(({ bounds }) => ({
    startFrame: attack.anticipationFrames,
    endFrame: attack.anticipationFrames + projectile.lifetimeFrames - 1,
    bounds
  })),
  projectile
});

export class CombatTimeline {
  private readonly entries = new Map<
    string,
    { instance: AttackInstance; activationDelayFrames: number }
  >();

  public constructor(private readonly hitboxes: HitboxSystem) {}

  public activate(
    ownerId: string,
    attack: AttackDefinition,
    facing: Facing,
    activationDelayFrames = 0
  ): AttackInstance {
    const instance = this.hitboxes.activate(ownerId, attack, facing);
    this.entries.set(instance.id, {
      instance,
      activationDelayFrames: Math.max(0, Math.floor(activationDelayFrames))
    });
    return instance;
  }

  public advance(frameCount = 1): CombatTimelineResult {
    const advances: CombatTimelineResult['advances'][number][] = [];
    const hits: HitboxContact[] = [];
    const completedInstanceIds: string[] = [];
    const frames = Number.isFinite(frameCount) ? Math.max(0, Math.floor(frameCount)) : 0;
    for (let frame = 0; frame < frames; frame += 1) {
      for (const [instanceId, entry] of [...this.entries]) {
        if (entry.activationDelayFrames > 0) {
          this.entries.set(instanceId, {
            ...entry,
            activationDelayFrames: entry.activationDelayFrames - 1
          });
          continue;
        }
        const advanced = this.hitboxes.advance(entry.instance);
        advances.push({ instance: advanced.instance, hits: advanced.hits });
        hits.push(...advanced.hits);
        if (advanced.instance.phase === 'complete') {
          this.entries.delete(instanceId);
          completedInstanceIds.push(instanceId);
        } else {
          this.entries.set(instanceId, { ...entry, instance: advanced.instance });
        }
      }
    }
    return {
      advances,
      hits,
      completedInstanceIds,
      activeAttacks: [...this.entries.values()].map(({ instance }) => instance)
    };
  }
}
