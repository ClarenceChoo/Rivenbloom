import { EffectPool } from '../effects/EffectPool';
import type { EffectLease } from '../effects/EffectPool';
import type { AttackId, Rect, Vec2 } from '../data/types';
import type { CombatantId, ProjectileId, TeamId } from '../core/StableId';
import { stableId } from '../core/StableId';
import type { Facing, HurtboxTarget } from './HitboxSystem';
import { freezeCombatImpact } from './CombatImpact';
import type { CombatImpact, ImpactDelivery, ImpactTag } from './CombatImpact';
import type { DamagePacket } from './CombatTypes';

type ProjectilePayload = Readonly<{
  projectileId: ProjectileId;
  attackId: AttackId;
  ownerId: CombatantId;
  teamId: TeamId;
  lifetimeMs: number;
  bounds: Rect;
  delivery: ImpactDelivery;
  damage: DamagePacket;
  knockback: Vec2;
  hitStopMs: number;
  tags: readonly ImpactTag[];
}>;

export type FacingProjectileCommand = ProjectilePayload & Readonly<{ speed: number }>;
export type DirectedProjectileCommand = ProjectilePayload & Readonly<{ velocity: Vec2 }>;
export type ProjectileCommand = FacingProjectileCommand;

type Projectile = {
  instanceId: number;
  projectileId: ProjectileId;
  attackId: AttackId;
  ownerId: CombatantId;
  teamId: TeamId;
  velocity: Vec2;
  lifetimeMs: number;
  bounds: Rect;
  origin: Vec2;
  spawnedAtMs: number;
  facing: Facing;
  delivery: ImpactDelivery;
  damage: DamagePacket;
  knockback: Vec2;
  hitStopMs: number;
  tags: readonly ImpactTag[];
  contactedTargetIds: Set<CombatantId>;
};

type ActiveProjectile = {
  projectile: Projectile;
  lease: EffectLease<Projectile>;
};

export type ProjectileImpact = CombatImpact;

export type ProjectileSnapshot = Readonly<{
  instanceId: number;
  projectileId: ProjectileId;
  position: Vec2;
}>;

export type ProjectileStep = Readonly<{
  active: readonly ProjectileSnapshot[];
  impacts: readonly ProjectileImpact[];
}>;

export class ProjectileSystem {
  private readonly pool: EffectPool<Projectile>;
  private readonly active: ActiveProjectile[] = [];
  private readonly capacity: number;
  private nextInstanceId = 1;
  private lastObservedMs: number | null = null;
  private disposed = false;

  public constructor(capacity: number) {
    this.capacity = capacity;
    this.pool = new EffectPool<Projectile>(capacity, () => ({
      instanceId: 0,
      projectileId: stableId<'projectile'>('pooled-projectile'),
      attackId: stableId<'attack'>('pooled-projectile-impact'),
      ownerId: stableId<'combatant'>('pooled-projectile-owner'),
      teamId: stableId<'team'>('pooled-projectile-team'),
      velocity: { x: 0, y: 0 },
      lifetimeMs: 0,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      origin: { x: 0, y: 0 },
      spawnedAtMs: 0,
      facing: 'right',
      delivery: 'projectile',
      damage: {
        baseDamage: 0,
        damageType: stableId<'damage-type'>('pooled-projectile-damage'),
        poiseDamage: 0,
        critical: { kind: 'excluded' },
      },
      knockback: { x: 0, y: 0 },
      hitStopMs: 0,
      tags: [],
      contactedTargetIds: new Set(),
    }));
  }

  public spawn(
    command: FacingProjectileCommand,
    origin: Vec2,
    facing: Facing,
    nowMs: number,
  ): number | null {
    if (!Number.isFinite(command.speed) || command.speed <= 0)
      throw new RangeError('Invalid speed.');
    const { speed, ...payload } = command;
    return this.spawnDirected(
      { ...payload, velocity: { x: facing === 'right' ? speed : -speed, y: 0 } },
      origin,
      facing,
      nowMs,
    );
  }

  public spawnDirected(
    command: DirectedProjectileCommand,
    origin: Vec2,
    facing: Facing,
    nowMs: number,
  ): number | null {
    this.assertTime(nowMs);
    assertVec(origin, 'Projectile origin');
    assertVec(command.velocity, 'Projectile velocity');
    assertRect(command.bounds);
    if (command.velocity.x === 0 && command.velocity.y === 0) {
      throw new RangeError('Projectile velocity must not be zero.');
    }
    if (!Number.isFinite(command.lifetimeMs) || command.lifetimeMs <= 0) {
      throw new RangeError('Invalid lifetime.');
    }
    if (this.disposed) return null;
    const instanceId = this.nextInstanceId;
    const lease = this.pool.acquire((projectile) => {
      projectile.contactedTargetIds.clear();
      Object.assign(projectile, {
        ...command,
        instanceId,
        velocity: { ...command.velocity },
        origin: { ...origin },
        bounds: mirrorBounds(command.bounds, facing),
        spawnedAtMs: nowMs,
        facing,
        damage: { ...command.damage, critical: { ...command.damage.critical } },
        knockback: { ...command.knockback },
        tags: [...command.tags],
      });
    });
    if (lease === null) return null;
    this.nextInstanceId += 1;
    this.lastObservedMs = nowMs;
    this.active.push({ projectile: lease.value, lease });
    return instanceId;
  }

  public canSpawn(): boolean {
    return !this.disposed && this.active.length < this.capacity;
  }

  public consume(instanceId: number): boolean {
    if (!Number.isSafeInteger(instanceId) || instanceId <= 0) {
      throw new RangeError('Projectile instance ID must be a positive safe integer.');
    }
    const index = this.active.findIndex(({ projectile }) => projectile.instanceId === instanceId);
    if (index < 0) return false;
    const entry = this.active[index]!;
    entry.lease.release();
    this.active.splice(index, 1);
    return true;
  }

  public snapshot(): readonly ProjectileSnapshot[] {
    const nowMs = this.lastObservedMs ?? 0;
    return freezeSnapshots(this.active, nowMs);
  }

  public clear(): boolean {
    if (this.active.length === 0) return false;
    for (const entry of this.active) entry.lease.release();
    this.active.length = 0;
    return true;
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.clear();
    this.disposed = true;
    this.pool.dispose();
    return true;
  }

  public step(nowMs: number, targets: readonly HurtboxTarget[]): ProjectileStep {
    this.assertTime(nowMs);
    this.lastObservedMs = nowMs;
    const impacts: ProjectileImpact[] = [];
    for (let index = this.active.length - 1; index >= 0; index -= 1) {
      const entry = this.active[index]!;
      const projectile = entry.projectile;
      const elapsedMs = nowMs - projectile.spawnedAtMs;
      if (elapsedMs >= projectile.lifetimeMs) {
        entry.lease.release();
        this.active.splice(index, 1);
        continue;
      }
      const bounds = boundsAt(projectile, elapsedMs);
      const target = targets.find(
        (candidate) =>
          candidate.targetId !== projectile.ownerId &&
          candidate.teamId !== projectile.teamId &&
          !projectile.contactedTargetIds.has(candidate.targetId) &&
          candidate.hurtboxes.some((hurtbox) => overlaps(bounds, hurtbox)),
      );
      if (target === undefined) continue;
      projectile.contactedTargetIds.add(target.targetId);
      impacts.push(
        freezeCombatImpact({
          attackId: projectile.attackId,
          targetId: target.targetId,
          source: {
            ownerId: projectile.ownerId,
            teamId: projectile.teamId,
            position: projectile.origin,
            facing: projectile.facing,
          },
          occurredAtMs: nowMs,
          delivery: projectile.delivery,
          damage: projectile.damage,
          knockback: {
            x: projectile.facing === 'right' ? projectile.knockback.x : -projectile.knockback.x,
            y: projectile.knockback.y,
          },
          hitStopMs: projectile.hitStopMs,
          tags: projectile.tags,
          projectile: {
            instanceId: projectile.instanceId,
            projectileId: projectile.projectileId,
          },
        }),
      );
    }
    const active = freezeSnapshots(this.active, nowMs);
    impacts.sort((left, right) => left.projectile!.instanceId - right.projectile!.instanceId);
    return Object.freeze({ active: Object.freeze(active), impacts: Object.freeze(impacts) });
  }

  private assertTime(nowMs: number): void {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new RangeError('Invalid simulation time.');
    if (this.lastObservedMs !== null && nowMs < this.lastObservedMs) {
      throw new RangeError('Simulation time cannot move backwards.');
    }
  }
}

function freezeSnapshots(
  active: readonly ActiveProjectile[],
  nowMs: number,
): readonly ProjectileSnapshot[] {
  return Object.freeze(
    active
      .map(({ projectile }) =>
        Object.freeze({
          instanceId: projectile.instanceId,
          projectileId: projectile.projectileId,
          position: Object.freeze(positionAt(projectile, nowMs - projectile.spawnedAtMs)),
        }),
      )
      .sort((left, right) => left.instanceId - right.instanceId),
  );
}

function positionAt(projectile: Projectile, elapsedMs: number): Vec2 {
  return {
    x: projectile.origin.x + projectile.velocity.x * (elapsedMs / 1000),
    y: projectile.origin.y + projectile.velocity.y * (elapsedMs / 1000),
  };
}

function boundsAt(projectile: Projectile, elapsedMs: number): Rect {
  const position = positionAt(projectile, elapsedMs);
  return {
    x: position.x + projectile.bounds.x,
    y: position.y + projectile.bounds.y,
    width: projectile.bounds.width,
    height: projectile.bounds.height,
  };
}

function mirrorBounds(bounds: Rect, facing: Facing): Rect {
  return facing === 'right'
    ? { ...bounds }
    : { x: -bounds.x - bounds.width, y: bounds.y, width: bounds.width, height: bounds.height };
}

function overlaps(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function assertVec(value: Vec2, label: string): void {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new RangeError(`${label} must be finite.`);
  }
}

function assertRect(bounds: Rect): void {
  assertVec(bounds, 'Projectile bounds');
  if (
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    throw new RangeError('Projectile bounds must have positive finite dimensions.');
  }
}
