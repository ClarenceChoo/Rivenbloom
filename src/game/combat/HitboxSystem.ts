import type {
  AttackDefinition,
  CollisionBodyDefinition,
  PointDefinition,
  RectDefinition,
  SizeDefinition
} from '../data/types';
import type { Facing } from '../physics/MovementModel';

export type CombatTeam = 'player' | 'enemy' | 'neutral';

export type HurtboxOwner = {
  readonly id: string;
  readonly team: CombatTeam;
  readonly position: PointDefinition;
  readonly hurtboxes: readonly CollisionBodyDefinition[];
  readonly renderMetrics?: SizeDefinition;
};

type ProjectileDefinition = {
  readonly speedPerFrame: number;
  readonly lifetimeFrames: number;
  readonly pierces: boolean;
};

type ProjectileAttackDefinition = AttackDefinition & {
  readonly projectile: ProjectileDefinition;
};

export type AttackPhase = 'anticipation' | 'active' | 'recovery' | 'complete';

export type AttackInstance = {
  readonly id: string;
  readonly ownerId: string;
  readonly ownerTeam: CombatTeam;
  readonly attack: AttackDefinition;
  readonly facing: Facing;
  readonly origin: PointDefinition;
  readonly frame: number;
  readonly phase: AttackPhase;
  readonly hitTargetIds: readonly string[];
};

export type HitboxContact = {
  readonly attackInstanceId: string;
  readonly attackId: string;
  readonly ownerId: string;
  readonly targetId: string;
  readonly hurtboxId: number;
  readonly damage: AttackDefinition['damage'];
};

export type AttackAdvanceResult = {
  readonly instance: AttackInstance;
  readonly hits: readonly HitboxContact[];
  readonly worldHitboxes: readonly RectDefinition[];
};

const isProjectile = (attack: AttackDefinition): attack is ProjectileAttackDefinition => {
  const candidate = attack as AttackDefinition & { readonly projectile?: unknown };
  if (typeof candidate.projectile !== 'object' || candidate.projectile === null) return false;
  const projectile = candidate.projectile as Partial<ProjectileDefinition>;
  return (
    typeof projectile.speedPerFrame === 'number' &&
    Number.isFinite(projectile.speedPerFrame) &&
    typeof projectile.lifetimeFrames === 'number' &&
    Number.isInteger(projectile.lifetimeFrames) &&
    projectile.lifetimeFrames > 0 &&
    typeof projectile.pierces === 'boolean'
  );
};

const phaseAt = (attack: AttackDefinition, frame: number): AttackPhase => {
  if (frame < attack.anticipationFrames) return 'anticipation';
  if (frame < attack.anticipationFrames + attack.activeFrames) return 'active';
  if (frame < attack.anticipationFrames + attack.activeFrames + attack.recoveryFrames) {
    return 'recovery';
  }
  return 'complete';
};

const overlaps = (left: RectDefinition, right: RectDefinition): boolean =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

export class HitboxSystem {
  private readonly owners = new Map<string, HurtboxOwner>();
  private nextInstanceId = 1;

  public constructor(owners: readonly HurtboxOwner[] = []) {
    for (const owner of owners) this.register(owner);
  }

  public register(owner: HurtboxOwner): void {
    this.owners.set(owner.id, owner);
  }

  public unregister(ownerId: string): void {
    this.owners.delete(ownerId);
  }

  public updatePosition(ownerId: string, position: PointDefinition): void {
    const owner = this.owners.get(ownerId);
    if (owner === undefined) return;
    this.owners.set(ownerId, { ...owner, position });
  }

  public activate(ownerId: string, attack: AttackDefinition, facing: Facing): AttackInstance {
    const owner = this.owners.get(ownerId);
    if (owner === undefined)
      throw new Error(`Cannot activate attack for unknown owner "${ownerId}".`);
    return {
      id: `${ownerId}-attack-${this.nextInstanceId++}`,
      ownerId,
      ownerTeam: owner.team,
      attack,
      facing,
      origin: owner.position,
      frame: 0,
      phase: phaseAt(attack, 0),
      hitTargetIds: []
    };
  }

  public advance(instance: AttackInstance, frameCount = 1): AttackAdvanceResult {
    if (instance.phase === 'complete' || frameCount <= 0 || !Number.isFinite(frameCount)) {
      return { instance, hits: [], worldHitboxes: [] };
    }
    const steps = Math.max(0, Math.floor(frameCount));
    let current = instance;
    let finalHitboxes: readonly RectDefinition[] = [];
    const hits: HitboxContact[] = [];
    for (let step = 0; step < steps && current.phase !== 'complete'; step += 1) {
      const frame = current.frame + 1;
      const hitTargetIds = new Set(current.hitTargetIds);
      const worldHitboxes = this.worldHitboxes(current, frame);
      for (const target of this.owners.values()) {
        if (
          target.id === current.ownerId ||
          target.team === current.ownerTeam ||
          hitTargetIds.has(target.id)
        ) {
          continue;
        }
        const hurtboxId = target.hurtboxes.findIndex((hurtbox) =>
          worldHitboxes.some((hitbox) => overlaps(hitbox, this.worldBounds(target, hurtbox)))
        );
        if (hurtboxId < 0) continue;
        hitTargetIds.add(target.id);
        hits.push({
          attackInstanceId: current.id,
          attackId: current.attack.id,
          ownerId: current.ownerId,
          targetId: target.id,
          hurtboxId,
          damage: current.attack.damage
        });
        if (isProjectile(current.attack) && !current.attack.projectile.pierces) break;
      }
      const timedPhase = phaseAt(current.attack, frame);
      const phase =
        isProjectile(current.attack) && frame >= current.attack.projectile.lifetimeFrames
          ? 'complete'
          : timedPhase;
      current = {
        ...current,
        frame,
        phase,
        hitTargetIds: [...hitTargetIds]
      };
      finalHitboxes = worldHitboxes;
    }
    return { instance: current, hits, worldHitboxes: finalHitboxes };
  }

  private worldHitboxes(instance: AttackInstance, frame: number): readonly RectDefinition[] {
    const projectileDistance = isProjectile(instance.attack)
      ? instance.attack.projectile.speedPerFrame * frame
      : 0;
    return instance.attack.hitboxes
      .filter(({ startFrame, endFrame }) => frame >= startFrame && frame <= endFrame)
      .map(({ bounds }) => ({
        x:
          instance.facing === 'right'
            ? instance.origin.x + bounds.offset.x + projectileDistance
            : instance.origin.x - bounds.offset.x - bounds.size.width - projectileDistance,
        y: instance.origin.y + bounds.offset.y,
        width: bounds.size.width,
        height: bounds.size.height
      }));
  }

  private worldBounds(owner: HurtboxOwner, hurtbox: CollisionBodyDefinition): RectDefinition {
    return {
      x: owner.position.x + hurtbox.offset.x,
      y: owner.position.y + hurtbox.offset.y,
      width: hurtbox.size.width,
      height: hurtbox.size.height
    };
  }
}
