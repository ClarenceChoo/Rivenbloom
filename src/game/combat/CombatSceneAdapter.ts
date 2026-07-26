import Phaser from 'phaser';
import type { AccessibilitySettingsState } from '../config/accessibility';
import type { GameEvents } from '../core/GameEvents';
import { attackDefinitions } from '../data/attacks';
import type { ProjectileSnapshot } from '../abilities/AbilitySystem';
import type {
  ActorDefinition,
  ActorSpawnDefinition,
  AttackDefinition,
  PointDefinition
} from '../data/types';
import { EffectPool } from '../effects/EffectPool';
import { combatFeedbackFor, impactLeafShapes } from '../effects/ParticleProfiles';
import type { PlayerCombatDirective, PlayerCombatState } from './PlayerCombat';
import type { PlayerProjectileIntercept } from './PlayerCombat';
import { damageTypeId } from './CombatTypes';
import {
  CombatTimeline,
  createProjectileAttackDefinition,
  type ProjectileAttackDefinition
} from './CombatTimeline';
import { HitboxSystem } from './HitboxSystem';
import type { Facing } from '../physics/MovementModel';
import {
  CombatAbilityRuntime,
  type CombatRuntimeOutput,
  type CombatRuntimeTarget
} from './CombatAbilityRuntime';

const FIXED_FRAME_MS = 1_000 / 60;
const MAX_FRAME_MS = 50;
const AMBER = 0xf5c96a;
const CREAM = 0xf0e3c0;
const MINT = 0x9ee7d7;

type SlashSpec = {
  readonly position: PointDefinition;
  readonly facing: Facing;
  readonly stage: number;
};

type ImpactSpec = {
  readonly position: PointDefinition;
  readonly flashAlpha: number;
  readonly particleCount: number;
};

type DamageLabelSpec = {
  readonly position: PointDefinition;
  readonly amount: number;
};

type AbilityVisualSpec = {
  readonly position: PointDefinition;
  readonly kind: 'barrier' | 'pulse';
};

type TimedGraphics = {
  readonly member: Phaser.GameObjects.Graphics;
  remainingFrames: number;
  readonly pool:
    | EffectPool<SlashSpec, Phaser.GameObjects.Graphics>
    | EffectPool<ImpactSpec, Phaser.GameObjects.Graphics>
    | EffectPool<AbilityVisualSpec, Phaser.GameObjects.Graphics>;
  readonly rotationPerFrame?: number;
};

type TimedLabel = {
  readonly member: Phaser.GameObjects.Text;
  remainingFrames: number;
};

export type CombatSceneSnapshot = {
  readonly targetHealth: number;
  readonly targetState: 'sleep' | 'dead';
  readonly targetPosition: PointDefinition;
  readonly activeProjectileCount: number;
  readonly lastAttackId: string | undefined;
  readonly lastAbilityId: string | undefined;
  readonly targetStatusIds: readonly string[];
  readonly lastMechanismRequestId: string | undefined;
};

export type CombatPlayerRuntimePort = {
  readonly interceptProjectile: (projectile: ProjectileSnapshot) => PlayerProjectileIntercept;
};

const drawSlashRibbon = (graphics: Phaser.GameObjects.Graphics): void => {
  graphics
    .clear()
    .fillStyle(AMBER, 0.8)
    .fillPoints(
      [
        { x: -52, y: 8 },
        { x: -28, y: -15 },
        { x: 6, y: -34 },
        { x: 62, y: -10 },
        { x: 13, y: -21 },
        { x: -23, y: -4 }
      ],
      true
    )
    .lineStyle(2, CREAM, 0.9)
    .lineBetween(-42, 3, 50, -11);
};

const drawImpactLeaves = (graphics: Phaser.GameObjects.Graphics, particleCount: number): void => {
  graphics.clear();
  for (const shape of impactLeafShapes(particleCount)) {
    graphics.fillStyle(shape.colour, shape.alpha).fillPoints([...shape.points], true);
  }
};

const drawLumenLeaf = (graphics: Phaser.GameObjects.Graphics): void => {
  graphics
    .clear()
    .fillStyle(MINT, 0.9)
    .fillPoints(
      [
        { x: -18, y: 2 },
        { x: -8, y: -4 },
        { x: 3, y: -9 },
        { x: 21, y: 0 },
        { x: 2, y: 8 },
        { x: -9, y: 6 }
      ],
      true
    )
    .lineStyle(2, CREAM, 0.85)
    .lineBetween(-11, 0, 15, 0);
};

const drawBotanicalGlyph = (graphics: Phaser.GameObjects.Graphics): void => {
  graphics.clear().fillStyle(MINT, 0.32).lineStyle(2, CREAM, 0.8);
  const leaves: { readonly x: number; readonly y: number }[][] = [
    [
      { x: 0, y: -32 },
      { x: 10, y: -16 },
      { x: 0, y: -5 },
      { x: -10, y: -16 }
    ],
    [
      { x: 30, y: -10 },
      { x: 17, y: 1 },
      { x: 5, y: -5 },
      { x: 18, y: -17 }
    ],
    [
      { x: 18, y: 27 },
      { x: 0, y: 17 },
      { x: 2, y: 4 },
      { x: 20, y: 12 }
    ],
    [
      { x: -18, y: 27 },
      { x: -20, y: 12 },
      { x: -2, y: 4 },
      { x: 0, y: 17 }
    ],
    [
      { x: -30, y: -10 },
      { x: -18, y: -17 },
      { x: -5, y: -5 },
      { x: -17, y: 1 }
    ]
  ];
  for (const leaf of leaves) graphics.fillPoints(leaf, true).strokePoints(leaf, true);
};

export class CombatSceneAdapter {
  private readonly hitboxes: HitboxSystem;
  private readonly timeline: CombatTimeline;
  private readonly abilityRuntime: CombatAbilityRuntime;
  private readonly targetImage: Phaser.GameObjects.Image;
  private readonly targetFlashImage: Phaser.GameObjects.Image;
  private readonly slashPool: EffectPool<SlashSpec, Phaser.GameObjects.Graphics>;
  private readonly impactPool: EffectPool<ImpactSpec, Phaser.GameObjects.Graphics>;
  private readonly projectilePool: EffectPool<PointDefinition, Phaser.GameObjects.Graphics>;
  private readonly abilityPool: EffectPool<AbilityVisualSpec, Phaser.GameObjects.Graphics>;
  private readonly labelPool: EffectPool<DamageLabelSpec, Phaser.GameObjects.Text>;
  private readonly ownedObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly activeProjectiles = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly timedGraphics: TimedGraphics[] = [];
  private readonly timedLabels: TimedLabel[] = [];
  private targetHealth: number;
  private targetState: CombatSceneSnapshot['targetState'] = 'sleep';
  private frameRemainderMs = 0;
  private hitStopRemainingMs = 0;
  private targetFlashFrames = 0;
  private shakeOffset = { x: 0, y: 0 };
  private shakeFrames = 0;
  private lastAttackId: string | undefined;
  private lastAbilityId: string | undefined;
  private lastMechanismRequestId: string | undefined;
  private readonly targetPosition: PointDefinition;
  private readonly targetArmor: number;

  public constructor(
    private readonly scene: Phaser.Scene,
    player: ActorDefinition,
    playerPosition: PointDefinition,
    target: ActorDefinition,
    targetSpawn: ActorSpawnDefinition,
    runtimeTargets: readonly CombatRuntimeTarget[],
    private readonly playerRuntime: CombatPlayerRuntimePort,
    private readonly settings: AccessibilitySettingsState,
    private readonly events: GameEvents
  ) {
    this.targetPosition = targetSpawn.position;
    this.targetHealth = target.stats.maxHealth;
    this.targetArmor = target.stats.defence;
    this.hitboxes = new HitboxSystem([
      {
        id: player.id,
        team: 'player',
        position: playerPosition,
        hurtboxes: player.hurtboxes,
        renderMetrics: player.render.size
      },
      {
        id: targetSpawn.id,
        team: 'enemy',
        position: targetSpawn.position,
        hurtboxes: target.hurtboxes,
        renderMetrics: target.render.size
      }
    ]);
    this.timeline = new CombatTimeline(this.hitboxes);
    this.abilityRuntime = new CombatAbilityRuntime(runtimeTargets);
    const texture = scene.textures.get(target.render.assetKey);
    const frameName = `${target.id}-sleep`;
    if (!texture.has(frameName)) {
      const source = target.render.source ?? {
        x: 0,
        y: 0,
        width: texture.getSourceImage().width,
        height: texture.getSourceImage().height
      };
      texture.add(frameName, 0, source.x, source.y, source.width, source.height);
    }
    this.targetImage = scene.add
      .image(targetSpawn.position.x, targetSpawn.position.y, target.render.assetKey, frameName)
      .setOrigin(target.render.origin.x, target.render.origin.y)
      .setDisplaySize(target.render.size.width, target.render.size.height)
      .setFlipX(targetSpawn.facing === 'right')
      .setDepth(target.render.depth)
      .setData('actorId', target.id)
      .setData('actorState', 'sleep');
    this.ownedObjects.push(this.targetImage);
    this.targetFlashImage = scene.add
      .image(targetSpawn.position.x, targetSpawn.position.y, target.render.assetKey, frameName)
      .setOrigin(target.render.origin.x, target.render.origin.y)
      .setDisplaySize(target.render.size.width, target.render.size.height)
      .setFlipX(targetSpawn.facing === 'right')
      .setDepth(target.render.depth + 0.1)
      .setTintFill(CREAM)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.ownedObjects.push(this.targetFlashImage);
    this.slashPool = new EffectPool({
      capacity: 6,
      create: () => {
        const graphics = scene.add.graphics().setDepth(14).setVisible(false);
        drawSlashRibbon(graphics);
        this.ownedObjects.push(graphics);
        return graphics;
      },
      activate: (graphics, spec) => {
        graphics
          .setPosition(spec.position.x + (spec.facing === 'right' ? 52 : -52), spec.position.y - 62)
          .setScale(spec.facing === 'right' ? 1 : -1, 0.82 + spec.stage * 0.08)
          .setAlpha(0.9)
          .setVisible(true);
      },
      deactivate: (graphics) => graphics.setVisible(false)
    });
    this.impactPool = new EffectPool({
      capacity: 10,
      create: () => {
        const graphics = scene.add.graphics().setDepth(16).setVisible(false);
        this.ownedObjects.push(graphics);
        return graphics;
      },
      activate: (graphics, spec) => {
        drawImpactLeaves(graphics, spec.particleCount);
        graphics
          .setPosition(spec.position.x, spec.position.y)
          .setAlpha(Math.max(0.35, spec.flashAlpha))
          .setVisible(true);
      },
      deactivate: (graphics) => graphics.setVisible(false)
    });
    this.projectilePool = new EffectPool({
      capacity: 8,
      create: () => {
        const graphics = scene.add.graphics().setDepth(15).setVisible(false);
        drawLumenLeaf(graphics);
        this.ownedObjects.push(graphics);
        return graphics;
      },
      activate: (graphics, position) =>
        graphics.setPosition(position.x, position.y).setVisible(true).setAlpha(1),
      deactivate: (graphics) => graphics.setVisible(false)
    });
    this.abilityPool = new EffectPool({
      capacity: 4,
      create: () => {
        const graphics = scene.add.graphics().setDepth(15).setVisible(false);
        drawBotanicalGlyph(graphics);
        this.ownedObjects.push(graphics);
        return graphics;
      },
      activate: (graphics, spec) =>
        graphics
          .setPosition(spec.position.x, spec.position.y - 54)
          .setScale(spec.kind === 'barrier' ? 1.45 : 3.2)
          .setRotation(0)
          .setAlpha(spec.kind === 'barrier' ? 0.78 : 0.62)
          .setVisible(true),
      deactivate: (graphics) => graphics.setVisible(false)
    });
    this.labelPool = new EffectPool({
      capacity: 8,
      create: () => {
        const label = scene.add
          .text(0, 0, '', {
            color: '#f0e3c0',
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            fontStyle: 'bold',
            stroke: '#171325',
            strokeThickness: 4
          })
          .setOrigin(0.5)
          .setDepth(18)
          .setVisible(false);
        this.ownedObjects.push(label);
        return label;
      },
      activate: (label, spec) =>
        label
          .setPosition(spec.position.x, spec.position.y)
          .setText(String(spec.amount))
          .setAlpha(1)
          .setVisible(true),
      deactivate: (label) => label.setVisible(false)
    });
  }

  public get snapshot(): CombatSceneSnapshot {
    return {
      targetHealth: this.targetHealth,
      targetState: this.targetState,
      targetPosition: this.targetPosition,
      activeProjectileCount: this.activeProjectiles.size,
      lastAttackId: this.lastAttackId,
      lastAbilityId: this.lastAbilityId,
      targetStatusIds: this.abilityRuntime
        .statusState('arch-briar-scrapper')
        .effects.map(({ definition }) => definition.id),
      lastMechanismRequestId: this.lastMechanismRequestId
    };
  }

  public interceptProjectile(projectile: ProjectileSnapshot): PlayerProjectileIntercept {
    const result = this.playerRuntime.interceptProjectile(projectile);
    if (result.converted) {
      this.events.emit('combat:projectile-converted', {
        actorId: 'mara-vey',
        projectileId: result.projectileId,
        manaRestored: result.manaRestored
      });
    }
    return result;
  }

  public consumeHitStop(deltaMs: number): boolean {
    if (this.hitStopRemainingMs <= 0) return false;
    this.hitStopRemainingMs = Math.max(0, this.hitStopRemainingMs - Math.max(0, deltaMs));
    return true;
  }

  public accept(
    directives: readonly PlayerCombatDirective[],
    playerPosition: PointDefinition,
    facing: Facing,
    combatState: PlayerCombatState
  ): void {
    this.hitboxes.updatePosition('mara-vey', playerPosition);
    const usedAbilities = new Set<string>();
    for (const directive of directives) {
      if (directive.kind === 'activate-attack') {
        const attack = attackDefinitions.find(({ id }) => id === directive.attackId);
        if (attack === undefined) continue;
        this.timeline.activate('mara-vey', attack, facing, directive.activationDelayFrames ?? 0);
        this.lastAttackId = attack.id;
        const stage = attack.id.endsWith('-2') ? 2 : attack.id.endsWith('-3') ? 3 : 1;
        const member = this.slashPool.spawn({ position: playerPosition, facing, stage });
        if (member !== undefined) {
          this.timedGraphics.push({ member, remainingFrames: 12, pool: this.slashPool });
        }
        continue;
      }
      if (directive.kind === 'cue') {
        this.events.emit('combat:cue-requested', {
          cueId: directive.cueId,
          kind: directive.cueId.endsWith('-sound') ? 'sound' : 'effect',
          sourceId: 'mara-vey'
        });
        continue;
      }
      if (directive.effect.kind === 'projectile') {
        this.spawnProjectile(
          directive.effect.attackId,
          playerPosition,
          facing,
          directive.activationDelayFrames ?? 0
        );
        this.lastAbilityId = 'lumen-bolt';
        usedAbilities.add('lumen-bolt');
      } else if (directive.effect.kind === 'dash') {
        this.lastAbilityId = 'wayfinder-dash';
        usedAbilities.add('wayfinder-dash');
      } else if (directive.effect.kind === 'barrier') {
        this.lastAbilityId = 'aegis-veil';
        usedAbilities.add('aegis-veil');
        this.spawnAbilityGlyph(playerPosition, 'barrier', directive.effect.durationFrames);
      } else if (directive.effect.kind === 'area-status') {
        this.lastAbilityId = 'resonant-pulse';
        usedAbilities.add('resonant-pulse');
        this.handleRuntimeOutputs(
          this.abilityRuntime.applyAreaStatus(directive.effect, playerPosition, 'mara-vey')
        );
        this.spawnAbilityGlyph(playerPosition, 'pulse', directive.effect.statusDurationFrames);
      }
    }
    for (const abilityId of usedAbilities) {
      this.events.emit('combat:ability-used', {
        actorId: 'mara-vey',
        abilityId,
        mana: combatState.mana,
        cooldownReadyAt: combatState.cooldownReadyAt[abilityId] ?? 0
      });
    }
  }

  public update(deltaMs: number, playerPosition: PointDefinition): void {
    this.hitboxes.updatePosition('mara-vey', playerPosition);
    this.frameRemainderMs += Math.min(MAX_FRAME_MS, Math.max(0, deltaMs));
    while (this.frameRemainderMs + Number.EPSILON >= FIXED_FRAME_MS) {
      this.advanceFrame();
      this.frameRemainderMs -= FIXED_FRAME_MS;
    }
  }

  public applyCameraFeedback(camera: Phaser.Cameras.Scene2D.Camera): void {
    if (this.shakeFrames <= 0) return;
    camera.setScroll(camera.scrollX + this.shakeOffset.x, camera.scrollY + this.shakeOffset.y);
    this.shakeFrames -= 1;
    this.shakeOffset = {
      x: this.shakeOffset.x * -0.55,
      y: this.shakeOffset.y * -0.55
    };
  }

  public dispose(): void {
    this.activeProjectiles.clear();
    this.timedGraphics.length = 0;
    this.timedLabels.length = 0;
    this.slashPool.dispose();
    this.impactPool.dispose();
    this.projectilePool.dispose();
    this.abilityPool.dispose();
    this.labelPool.dispose();
    for (const object of this.ownedObjects) object.destroy();
    this.ownedObjects.length = 0;
  }

  private spawnProjectile(
    attackId: string,
    playerPosition: PointDefinition,
    facing: Facing,
    activationDelayFrames: number
  ): void {
    const definition = attackDefinitions.find(({ id }) => id === attackId);
    if (definition === undefined) return;
    const projectile = createProjectileAttackDefinition(definition, {
      speedPerFrame: 12,
      lifetimeFrames: 48,
      pierces: false
    });
    this.hitboxes.updatePosition('mara-vey', playerPosition);
    const instance = this.timeline.activate('mara-vey', projectile, facing, activationDelayFrames);
    const visual = this.projectilePool.spawn({
      x: playerPosition.x,
      y: playerPosition.y - 58
    });
    if (visual !== undefined) {
      visual.setVisible(false);
      this.activeProjectiles.set(instance.id, visual);
    }
  }

  private spawnAbilityGlyph(
    position: PointDefinition,
    kind: AbilityVisualSpec['kind'],
    remainingFrames: number
  ): void {
    const glyph = this.abilityPool.spawn({ position, kind });
    if (glyph === undefined) return;
    this.timedGraphics.push({
      member: glyph,
      remainingFrames,
      pool: this.abilityPool,
      rotationPerFrame: this.settings.current.reducedMotion ? 0 : 0.025
    });
  }

  private advanceFrame(): void {
    const timeline = this.timeline.advance();
    for (const advanced of timeline.advances) {
      const projectile = this.activeProjectiles.get(advanced.instance.id);
      if (projectile !== undefined) {
        const attack = advanced.instance.attack as ProjectileAttackDefinition;
        const direction = advanced.instance.facing === 'right' ? 1 : -1;
        const travelFrame = Math.max(0, advanced.instance.frame - attack.anticipationFrames);
        projectile.setPosition(
          advanced.instance.origin.x +
            direction * (30 + travelFrame * attack.projectile.speedPerFrame),
          advanced.instance.origin.y - 58
        );
        projectile.setVisible(advanced.instance.phase === 'active');
      }
      for (const hit of advanced.hits) {
        if (hit.targetId === 'arch-briar-scrapper') {
          this.damageTarget(
            hit.damage,
            advanced.instance.facing,
            projectile === undefined ? 'melee' : 'projectile'
          );
        }
      }
    }
    for (const instanceId of timeline.completedInstanceIds) {
      const projectile = this.activeProjectiles.get(instanceId);
      if (projectile === undefined) continue;
      this.activeProjectiles.delete(instanceId);
      this.projectilePool.release(projectile);
    }
    this.handleRuntimeOutputs(this.abilityRuntime.advance());
    this.advanceTimedEffects();
    if (this.targetFlashFrames > 0) {
      this.targetFlashFrames -= 1;
      if (this.targetFlashFrames === 0) this.targetFlashImage.setVisible(false);
    }
  }

  private damageTarget(
    damage: AttackDefinition['damage'],
    facing: Facing,
    sourceKind: 'melee' | 'projectile' | 'hazard'
  ): void {
    if (this.targetState === 'dead') return;
    const result = this.abilityRuntime.resolveDamage(
      'arch-briar-scrapper',
      {
        kind: sourceKind,
        packet: {
          amount: damage.amount,
          damageType: damageTypeId(damage.type),
          criticalMultiplier: 1,
          poiseDamage: damage.poise,
          knockback: Math.abs(damage.knockback.x)
        }
      },
      {
        armor: this.targetArmor,
        resistances: {},
        guard: { kind: 'none' },
        invulnerable: false
      }
    );
    this.targetHealth = Math.max(0, this.targetHealth - result.healthDamage);
    this.targetState = this.targetHealth === 0 ? 'dead' : 'sleep';
    this.targetImage.setData('actorState', this.targetState);
    if (this.targetState === 'dead') this.targetImage.setAlpha(0.48);
    const feedback = combatFeedbackFor(
      {
        hitStopMs: damage.hitStopMs,
        amount: result.healthDamage,
        direction: facing === 'right' ? 1 : -1
      },
      this.settings.current
    );
    this.hitStopRemainingMs = Math.max(this.hitStopRemainingMs, feedback.hitStopMs);
    this.shakeOffset = feedback.shake;
    this.shakeFrames = feedback.shake.x === 0 && feedback.shake.y === 0 ? 0 : 4;
    this.targetFlashFrames = Math.max(3, feedback.highContrastHoldFrames);
    this.targetFlashImage.setAlpha(feedback.flashAlpha).setVisible(feedback.flashAlpha > 0);
    const impactPosition = {
      x: this.targetImage.x,
      y: this.targetImage.y - this.targetImage.displayHeight * 0.55
    };
    const impact = this.impactPool.spawn({
      position: impactPosition,
      flashAlpha: feedback.flashAlpha,
      particleCount: feedback.particleCount
    });
    if (impact !== undefined) {
      this.timedGraphics.push({
        member: impact,
        remainingFrames: 7 + feedback.highContrastHoldFrames,
        pool: this.impactPool
      });
    }
    if (feedback.showDamageLabel) {
      const label = this.labelPool.spawn({
        position: { x: impactPosition.x, y: impactPosition.y - 34 },
        amount: Math.round(result.healthDamage)
      });
      if (label !== undefined) this.timedLabels.push({ member: label, remainingFrames: 34 });
    }
    this.events.emit('combat:damage-resolved', {
      targetId: 'arch-briar-scrapper',
      sourceId: 'mara-vey',
      amount: result.healthDamage,
      remainingHealth: this.targetHealth,
      critical: false
    });
    if (this.targetState === 'dead') {
      this.events.emit('combat:actor-defeated', {
        actorId: 'arch-briar-scrapper',
        actorKind: 'enemy'
      });
    }
  }

  private handleRuntimeOutputs(outputs: readonly CombatRuntimeOutput[]): void {
    for (const output of outputs) {
      if (output.kind === 'mechanism-requested') {
        this.lastMechanismRequestId = output.targetId;
        this.events.emit('combat:mechanism-requested', {
          mechanismId: output.targetId,
          hookId: output.mechanismHookId,
          sourceId: output.sourceId
        });
        continue;
      }
      this.events.emit('combat:status-changed', {
        targetId: output.targetId,
        statusId: output.statusId,
        state: output.kind === 'status-applied' ? 'applied' : 'expired',
        ...(output.kind === 'status-applied' ? { expiresAtFrame: output.expiresAtFrame } : {})
      });
    }
  }

  private advanceTimedEffects(): void {
    for (let index = this.timedGraphics.length - 1; index >= 0; index -= 1) {
      const effect = this.timedGraphics[index];
      if (effect === undefined) continue;
      effect.remainingFrames -= 1;
      effect.member.rotation += effect.rotationPerFrame ?? 0;
      effect.member.setAlpha(Math.max(0, effect.remainingFrames / 12));
      if (effect.remainingFrames > 0) continue;
      effect.pool.release(effect.member);
      this.timedGraphics.splice(index, 1);
    }
    for (let index = this.timedLabels.length - 1; index >= 0; index -= 1) {
      const effect = this.timedLabels[index];
      if (effect === undefined) continue;
      effect.remainingFrames -= 1;
      effect.member
        .setY(effect.member.y - (this.settings.current.reducedMotion ? 0 : 0.6))
        .setAlpha(Math.min(1, effect.remainingFrames / 8));
      if (effect.remainingFrames > 0) continue;
      this.labelPool.release(effect.member);
      this.timedLabels.splice(index, 1);
    }
  }
}
