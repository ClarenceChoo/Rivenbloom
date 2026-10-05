import type { CombatantId, TeamId } from '../core/StableId';
import type { AttackDefinition, Rect, Vec2 } from '../data/types';
import { immutableClone } from '../data/immutability';
import { freezeCombatImpact } from './CombatImpact';
import type { CombatImpact } from './CombatImpact';

export type Facing = 'left' | 'right';

export type HurtboxTarget = Readonly<{
  targetId: CombatantId;
  teamId: TeamId;
  hurtboxes: readonly Rect[];
}>;

export type AttackHit = CombatImpact;

export type AttackSample = Readonly<{
  phase: 'anticipation' | 'active' | 'recovery' | 'complete';
  activeHitboxes: readonly Rect[];
  hits: readonly AttackHit[];
}>;

export class AttackInstance {
  private readonly hitAtMs = new Map<CombatantId, number>();

  public constructor(
    private readonly ownerId: CombatantId,
    private readonly teamId: TeamId,
    private readonly attack: AttackDefinition,
    private readonly facing: Facing,
  ) {}

  public sample(
    frame: number,
    origin: Vec2,
    targets: readonly HurtboxTarget[],
    nowMs: number,
  ): AttackSample {
    const activeDefinitions = this.attack.hitboxes.filter(
      ({ fromFrame, toFrame }) => frame >= fromFrame && frame <= toFrame,
    );
    const phase = phaseAt(this.attack, frame, activeDefinitions.length > 0);
    const activeHitboxes = Object.freeze(
      activeDefinitions.map(({ bounds }) => Object.freeze(place(bounds, origin, this.facing))),
    );
    const hits: AttackHit[] = [];
    if (phase === 'active') {
      for (const target of targets) {
        if (target.targetId === this.ownerId || target.teamId === this.teamId) continue;
        if (
          !activeHitboxes.some((hitbox) =>
            target.hurtboxes.some((hurtbox) => overlaps(hitbox, hurtbox)),
          )
        ) {
          continue;
        }
        const previousHitAtMs = this.hitAtMs.get(target.targetId);
        if (!eligibleForHit(this.attack, previousHitAtMs, nowMs)) continue;
        this.hitAtMs.set(target.targetId, nowMs);
        hits.push(
          freezeCombatImpact({
            attackId: this.attack.attackId,
            targetId: target.targetId,
            source: {
              ownerId: this.ownerId,
              teamId: this.teamId,
              position: origin,
              facing: this.facing,
            },
            occurredAtMs: nowMs,
            delivery: this.attack.delivery,
            damage: this.attack.damage,
            knockback: {
              x: this.facing === 'right' ? this.attack.knockback.x : -this.attack.knockback.x,
              y: this.attack.knockback.y,
            },
            hitStopMs: this.attack.hitStopMs,
            tags: this.attack.tags,
            projectile: null,
          }),
        );
      }
    }
    return Object.freeze({ phase, activeHitboxes, hits: Object.freeze(hits) });
  }
}

export class HitboxSystem {
  public activate(
    ownerId: CombatantId,
    attackDefinition: AttackDefinition,
    facing: Facing,
    ownerTeam: TeamId,
  ): AttackInstance {
    return new AttackInstance(ownerId, ownerTeam, immutableClone(attackDefinition), facing);
  }
}

function phaseAt(
  attack: AttackDefinition,
  frame: number,
  hasActiveHitbox: boolean,
): AttackSample['phase'] {
  if (frame >= attack.totalFrames) return 'complete';
  if (hasActiveHitbox) return 'active';
  const firstActive = Math.min(...attack.hitboxes.map(({ fromFrame }) => fromFrame));
  return frame < firstActive ? 'anticipation' : 'recovery';
}

function place(bounds: Rect, origin: Vec2, facing: Facing): Rect {
  return {
    x: facing === 'right' ? origin.x + bounds.x : origin.x - bounds.x - bounds.width,
    y: origin.y + bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function overlaps(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function eligibleForHit(
  attack: AttackDefinition,
  previousHitAtMs: number | undefined,
  nowMs: number,
): boolean {
  if (previousHitAtMs === undefined) return true;
  return (
    attack.hitPolicy.kind === 'interval' &&
    nowMs - previousHitAtMs >= attack.hitPolicy.rehitIntervalMs
  );
}
