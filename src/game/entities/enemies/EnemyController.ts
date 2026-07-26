import type { AttackGrant, AttackRequest } from '../../ai/EncounterDirector';
import { senseTarget, type PerceptionSample } from '../../ai/Perception';
import {
  damageTypeId,
  type DamagePacket,
  type DamageResult,
  type GuardSnapshot
} from '../../combat/CombatTypes';
import { resolveDamage } from '../../combat/DamageResolver';
import { attackDefinitions } from '../../data/attacks';
import type {
  ActorDefinition,
  ActorSpawnDefinition,
  AttackDefinition,
  PointDefinition,
  RectDefinition
} from '../../data/types';
import type { Facing } from '../../physics/MovementModel';
import type { EnemyAttackChoice, EnemyProfile } from './EnemyProfile';
import {
  createEnemyStateMachine,
  requestEnemyState,
  type EnemyStateMachine,
  type EnemyStateName
} from './EnemyState';

const FRAME_SECONDS = 1 / 60;
const OFFSCREEN_MARGIN = 160;
const ARRIVAL_TOLERANCE = 8;

export type EnemyDirectorPort = {
  readonly register: (enemyId: string) => void;
  readonly requestAttack: (enemyId: string, request: AttackRequest) => AttackGrant;
  readonly releaseAttack: (enemyId: string) => void;
  readonly deactivate: (enemyId: string) => void;
};

export type EnemyWorldContext = {
  readonly player: {
    readonly position: PointDefinition;
    readonly noiseLevel: number;
  };
  readonly obstacles: readonly RectDefinition[];
  readonly cameraBounds: RectDefinition;
  readonly floorAhead: {
    readonly left: boolean;
    readonly right: boolean;
  };
};

export type EnemyFrameOutput = {
  readonly state: EnemyStateName;
  readonly position: PointDefinition;
  readonly facing: Facing;
  readonly activatedAttackId: string | undefined;
  readonly cues: readonly string[];
};

export type EnemyDamageInput = {
  readonly packet: DamagePacket;
  readonly travelDirection: Facing;
};

export type EnemyDamageOutcome = {
  readonly result: DamageResult;
  readonly state: EnemyStateName;
  readonly remainingHealth: number;
  readonly staggered: boolean;
  readonly died: boolean;
  readonly drops: readonly { readonly itemId: string; readonly quantity: number }[];
};

type ActiveAttack = {
  readonly choice: EnemyAttackChoice;
  readonly definition: AttackDefinition;
  readonly lockedTarget: PointDefinition;
};

const attacksById = new Map(attackDefinitions.map((attack) => [attack.id, attack]));

export class EnemyController {
  private machine: EnemyStateMachine;
  private position: PointDefinition;
  private facing: Facing;
  private framesInState = 0;
  private suspicion = 0;
  private poiseBuilt = 0;
  private health: number;
  private patrolDirection: Facing;
  private bobFrame = 0;
  private activeAttack: ActiveAttack | undefined;

  public constructor(
    public readonly id: string,
    private readonly actor: ActorDefinition,
    private readonly profile: EnemyProfile,
    private readonly spawn: ActorSpawnDefinition,
    private readonly director: EnemyDirectorPort
  ) {
    this.machine = createEnemyStateMachine('sleep');
    this.position = { ...spawn.position };
    this.facing = spawn.facing;
    this.patrolDirection = spawn.facing;
    this.health = actor.stats.maxHealth;
    director.register(id);
  }

  public get state(): EnemyStateName {
    return this.machine.value;
  }

  public get currentPosition(): PointDefinition {
    return this.position;
  }

  public get currentFacing(): Facing {
    return this.facing;
  }

  public get remainingHealth(): number {
    return this.health;
  }

  public update(context: EnemyWorldContext): EnemyFrameOutput {
    if (this.machine.value === 'dead') return this.output(undefined, []);
    this.framesInState += 1;
    this.bobFrame += 1;
    const cues: string[] = [];
    const onCamera = this.isOnCamera(context.cameraBounds);
    const sample = this.sense(context);
    this.advanceSuspicion(sample);
    if (!onCamera && this.isDormantState()) {
      this.transition('sleep');
      return this.output(undefined, cues);
    }
    let activatedAttackId: string | undefined;
    switch (this.machine.value) {
      case 'sleep':
        activatedAttackId = this.updateSleep(context, sample, onCamera);
        break;
      case 'idle':
        this.updateIdle(sample);
        break;
      case 'patrol':
        this.updatePatrol(context, sample);
        break;
      case 'suspect':
        this.updateSuspect(context);
        break;
      case 'chase':
        activatedAttackId = this.updateChase(context, sample, onCamera);
        break;
      case 'telegraph':
        this.updateTelegraph();
        break;
      case 'attack':
        this.updateAttack();
        break;
      case 'recover':
        this.updateRecover();
        break;
      case 'retreat':
        this.updateRetreat(context);
        break;
      case 'hurt':
        this.updateTimedInterrupt(this.profile.hurtFrames);
        break;
      case 'stagger':
        this.updateTimedInterrupt(this.profile.staggerFrames);
        break;
    }
    if (activatedAttackId !== undefined) cues.push(`${activatedAttackId}-telegraph`);
    this.applyAirHover();
    return this.output(activatedAttackId, cues);
  }

  public applyDamage(
    input: EnemyDamageInput,
    dropRolls: readonly number[] = []
  ): EnemyDamageOutcome {
    if (this.machine.value === 'dead') {
      return {
        result: {
          healthDamage: 0,
          poiseDamage: 0,
          knockback: 0,
          criticalApplied: false,
          blocked: false,
          parried: false,
          invulnerable: true
        },
        state: 'dead',
        remainingHealth: 0,
        staggered: false,
        died: false,
        drops: []
      };
    }
    const result = resolveDamage(input.packet, {
      armor: this.actor.stats.defence,
      resistances: Object.fromEntries(
        Object.entries(this.actor.resistances).map(([type, value]) => [
          damageTypeId(type),
          value ?? 0
        ])
      ),
      guard: this.guardAgainst(input.travelDirection),
      invulnerable: false
    });
    this.health = Math.max(0, this.health - result.healthDamage);
    this.poiseBuilt += result.poiseDamage;
    this.suspicion = this.profile.suspicion.framesToAlert;
    const died = this.health === 0;
    let staggered = false;
    if (died) {
      this.abandonActiveAttack();
      this.machine = { value: 'dead' };
      this.director.deactivate(this.id);
    } else if (this.poiseBuilt >= this.profile.staggerPoiseThreshold) {
      this.poiseBuilt = 0;
      staggered = true;
      this.abandonActiveAttack();
      this.transition('stagger');
    } else if (result.healthDamage > 0) {
      this.transition('hurt');
    }
    return {
      result,
      state: this.machine.value,
      remainingHealth: this.health,
      staggered,
      died,
      drops: died ? this.rollDrops(dropRolls) : []
    };
  }

  private output(activatedAttackId: string | undefined, cues: readonly string[]): EnemyFrameOutput {
    return {
      state: this.machine.value,
      position: { ...this.position },
      facing: this.facing,
      activatedAttackId,
      cues
    };
  }

  private sense(context: EnemyWorldContext): PerceptionSample {
    const eyeHeight = this.actor.collisionBody.size.height * 0.75;
    return senseTarget(
      {
        position: this.position,
        facing: this.facing,
        eyeHeight,
        sightRange: this.actor.perception.range,
        sightVerticalRange: this.profile.sightVerticalRange,
        rearRange: this.profile.rearRange,
        hearingRange: this.actor.perception.hearingRange
      },
      {
        position: context.player.position,
        eyeHeight: 40,
        noiseLevel: context.player.noiseLevel
      },
      context.obstacles
    );
  }

  private advanceSuspicion(sample: PerceptionSample): void {
    const cap = this.profile.suspicion.framesToAlert;
    if (sample.visible) this.suspicion = Math.min(cap, this.suspicion + 3);
    else if (sample.heard) this.suspicion = Math.min(cap, this.suspicion + 1);
    else this.suspicion = Math.max(0, this.suspicion - this.profile.suspicion.decayPerFrame);
  }

  private isDormantState(): boolean {
    return (
      this.machine.value === 'sleep' ||
      this.machine.value === 'idle' ||
      this.machine.value === 'patrol' ||
      this.machine.value === 'suspect'
    );
  }

  private isOnCamera(cameraBounds: RectDefinition): boolean {
    return (
      this.position.x >= cameraBounds.x - OFFSCREEN_MARGIN &&
      this.position.x <= cameraBounds.x + cameraBounds.width + OFFSCREEN_MARGIN &&
      this.position.y >= cameraBounds.y - OFFSCREEN_MARGIN &&
      this.position.y <= cameraBounds.y + cameraBounds.height + OFFSCREEN_MARGIN
    );
  }

  private updateSleep(
    context: EnemyWorldContext,
    sample: PerceptionSample,
    onCamera: boolean
  ): string | undefined {
    if (this.profile.ambush !== undefined) {
      const distance = Math.hypot(
        context.player.position.x - this.position.x,
        context.player.position.y - this.position.y
      );
      if (distance <= this.profile.ambush.emergeRange) {
        return this.tryStartAttack(context, onCamera, distance);
      }
      return undefined;
    }
    if (onCamera) this.transition('idle');
    else if (sample.visible || this.suspicion >= this.profile.suspicion.framesToAlert) {
      this.transition('idle');
    }
    return undefined;
  }

  private updateIdle(sample: PerceptionSample): void {
    if (this.profile.ambush !== undefined && this.suspicion <= 0) {
      this.transition('sleep');
      return;
    }
    if (this.suspicion >= this.profile.suspicion.framesToAlert) {
      this.transition('chase');
      return;
    }
    if (this.suspicion > 0 && (sample.visible || sample.heard)) {
      this.transition('suspect');
      return;
    }
    const patrol = this.profile.patrol;
    if (patrol !== undefined && this.framesInState > patrol.pauseFrames) {
      this.transition('patrol');
    }
  }

  private updatePatrol(context: EnemyWorldContext, sample: PerceptionSample): void {
    if (this.suspicion >= this.profile.suspicion.framesToAlert) {
      this.transition('chase');
      return;
    }
    if (this.suspicion > 0 && (sample.visible || sample.heard)) {
      this.transition('suspect');
      return;
    }
    const patrol = this.profile.patrol;
    if (patrol === undefined) {
      this.transition('idle');
      return;
    }
    const beyondSpan =
      this.patrolDirection === 'right'
        ? this.position.x - this.spawn.position.x >= patrol.spanX
        : this.spawn.position.x - this.position.x >= patrol.spanX;
    const blocked = !context.floorAhead[this.patrolDirection];
    if (beyondSpan || blocked) {
      this.patrolDirection = this.patrolDirection === 'right' ? 'left' : 'right';
      this.transition('idle');
      return;
    }
    this.facing = this.patrolDirection;
    this.moveHorizontally(patrol.speed, this.patrolDirection, context);
  }

  private updateSuspect(context: EnemyWorldContext): void {
    this.facing = context.player.position.x >= this.position.x ? 'right' : 'left';
    if (this.suspicion >= this.profile.suspicion.framesToAlert) this.transition('chase');
    else if (this.suspicion <= 0) this.transition('idle');
  }

  private updateChase(
    context: EnemyWorldContext,
    sample: PerceptionSample,
    onCamera: boolean
  ): string | undefined {
    if (Math.abs(this.position.x - this.spawn.position.x) > this.profile.chase.leashDistance) {
      this.transition('retreat');
      return undefined;
    }
    if (this.suspicion <= 0) {
      this.transition(this.profile.ambush === undefined ? 'idle' : 'retreat');
      return undefined;
    }
    const deltaX = context.player.position.x - this.position.x;
    this.facing = deltaX >= 0 ? 'right' : 'left';
    const distance = this.profile.locomotion === 'air' ? sample.distance : Math.abs(deltaX);
    const kite = this.profile.kite;
    if (kite !== undefined && distance < kite.triggerRange) {
      const away: Facing = deltaX >= 0 ? 'left' : 'right';
      const leashBound =
        Math.abs(this.position.x + (away === 'right' ? 1 : -1) - this.spawn.position.x) >
        this.profile.chase.leashDistance;
      if (!leashBound && context.floorAhead[away]) {
        this.moveHorizontally(kite.speed, away, context);
      }
    } else if (Math.abs(deltaX) > this.profile.chase.stopGapX) {
      const toward: Facing = deltaX >= 0 ? 'right' : 'left';
      if (this.profile.locomotion === 'air' || context.floorAhead[toward]) {
        this.moveHorizontally(this.profile.chase.speed, toward, context);
      }
    }
    return this.tryStartAttack(context, onCamera, distance);
  }

  private tryStartAttack(
    context: EnemyWorldContext,
    onCamera: boolean,
    distance: number
  ): string | undefined {
    const choice = [...this.profile.attacks]
      .sort((left, right) => left.triggerRange - right.triggerRange)
      .find((candidate) => distance <= candidate.triggerRange);
    if (choice === undefined) return undefined;
    const definition = attacksById.get(choice.attackId);
    if (definition === undefined) return undefined;
    const grant = this.director.requestAttack(this.id, {
      kind: choice.kind,
      cooldownFrames: choice.cooldownFrames,
      onCamera
    });
    if (!grant.granted) return undefined;
    this.activeAttack = {
      choice,
      definition,
      lockedTarget: { ...context.player.position }
    };
    this.facing = context.player.position.x >= this.position.x ? 'right' : 'left';
    this.transition('telegraph');
    return choice.attackId;
  }

  private updateTelegraph(): void {
    const attack = this.activeAttack;
    if (attack === undefined) {
      this.transition('attack');
      this.transition('recover');
      return;
    }
    if (this.framesInState >= attack.definition.anticipationFrames) this.transition('attack');
  }

  private updateAttack(): void {
    const attack = this.activeAttack;
    if (attack === undefined) {
      this.transition('recover');
      return;
    }
    if (this.profile.locomotion === 'air' && this.profile.air !== undefined) {
      const target = attack.lockedTarget;
      const deltaX = target.x - this.position.x;
      const deltaY = target.y - 30 - this.position.y;
      const length = Math.hypot(deltaX, deltaY);
      if (length > 1) {
        const step = Math.min(length, this.profile.air.diveSpeedPerFrame);
        this.position = {
          x: this.position.x + (deltaX / length) * step,
          y: this.position.y + (deltaY / length) * step
        };
      }
    }
    if (this.framesInState >= attack.definition.activeFrames) this.transition('recover');
  }

  private updateRecover(): void {
    const attack = this.activeAttack;
    const recoveryFrames = attack?.definition.recoveryFrames ?? 12;
    if (this.framesInState < recoveryFrames) return;
    this.activeAttack = undefined;
    this.director.releaseAttack(this.id);
    if (this.suspicion > 0) this.transition('chase');
    else this.transition('idle');
  }

  private updateRetreat(context: EnemyWorldContext): void {
    const deltaX = this.spawn.position.x - this.position.x;
    if (Math.abs(deltaX) <= ARRIVAL_TOLERANCE) {
      this.position = { ...this.position, x: this.spawn.position.x };
      this.suspicion = 0;
      this.transition(this.profile.ambush === undefined ? 'idle' : 'sleep');
      return;
    }
    const toward: Facing = deltaX >= 0 ? 'right' : 'left';
    this.facing = toward;
    const speed = this.profile.chase.speed > 0 ? this.profile.chase.speed : 90;
    this.moveHorizontally(speed, toward, context);
  }

  private updateTimedInterrupt(durationFrames: number): void {
    if (this.framesInState < durationFrames) return;
    if (this.suspicion > 0) this.transition('chase');
    else this.transition('idle');
  }

  private applyAirHover(): void {
    const air = this.profile.air;
    if (air === undefined || this.profile.locomotion !== 'air') return;
    if (this.machine.value === 'attack' || this.machine.value === 'dead') return;
    const bob = Math.sin((this.bobFrame / air.bobFramePeriod) * Math.PI * 2) * air.bobAmplitude;
    this.position = {
      x: this.position.x,
      y: this.spawn.position.y - air.hoverHeight + bob
    };
  }

  private moveHorizontally(speed: number, direction: Facing, context: EnemyWorldContext): void {
    const step = speed * FRAME_SECONDS * (direction === 'right' ? 1 : -1);
    const bounded = this.profile.locomotion !== 'air' && !context.floorAhead[direction] ? 0 : step;
    this.position = { x: this.position.x + bounded, y: this.position.y };
  }

  private guardAgainst(travelDirection: Facing): GuardSnapshot {
    const guard = this.profile.guard;
    const guardBroken = this.machine.value === 'stagger' || this.machine.value === 'hurt';
    if (guard === undefined || guardBroken) return { kind: 'none' };
    const attackerInFront =
      (this.facing === 'left' && travelDirection === 'right') ||
      (this.facing === 'right' && travelDirection === 'left');
    if (!attackerInFront) return { kind: 'none' };
    return {
      kind: 'block',
      damageMultiplier: guard.damageMultiplier,
      poiseMultiplier: guard.poiseMultiplier,
      knockbackMultiplier: guard.knockbackMultiplier
    };
  }

  private rollDrops(
    dropRolls: readonly number[]
  ): readonly { readonly itemId: string; readonly quantity: number }[] {
    return this.actor.drops
      .filter((drop, index) => (dropRolls[index] ?? 1) < drop.chance || drop.chance >= 1)
      .map((drop) => ({ itemId: drop.itemId, quantity: drop.quantity }));
  }

  private abandonActiveAttack(): void {
    if (this.activeAttack === undefined) return;
    this.activeAttack = undefined;
    this.director.releaseAttack(this.id);
  }

  private transition(next: EnemyStateName): void {
    const previous = this.machine;
    this.machine = requestEnemyState(this.machine, next);
    if (this.machine !== previous) this.framesInState = 0;
  }
}
