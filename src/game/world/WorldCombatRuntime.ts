import { EncounterDirector } from '../ai/EncounterDirector';
import type { EncounterDirectorSnapshot } from '../ai/EncounterDirector';
import {
  freezeCombatImpact,
  freezeCombatImpactResolution,
  UNRESOLVED_COMBAT_IMPACT,
} from '../combat/CombatImpact';
import type {
  CombatImpact,
  CombatImpactResolution,
  CombatResolutionCommand,
  CombatVitalitySnapshot,
} from '../combat/CombatImpact';
import type { HurtboxTarget } from '../combat/HitboxSystem';
import type { CombatantId } from '../core/StableId';
import { stableId } from '../core/StableId';
import { deepFreeze, immutableClone } from '../data/immutability';
import type {
  ActorDefinition,
  ActorSpawnDefinition,
  AiProfileDefinition,
  AttackDefinition,
  BossEncounterDefinition,
  DropTableDefinition,
  Rect,
  SurfaceDefinition,
} from '../data/types';
import { PallidCantorController } from '../entities/bosses/PallidCantorController';
import type {
  PallidCantorCommand,
  PallidCantorSnapshot,
  ResonantPulseActivation,
} from '../entities/bosses/PallidCantorController';
import type { PallidCantorEvent } from '../entities/bosses/BossEvents';
import type { PlayerFixedStepFrame } from '../entities/player/PlayerController';
import type { PlayerControllerSnapshot } from '../entities/player/PlayerController';
import type { PlayerCombatRuntimeEvent } from '../entities/player/PlayerCombatRuntime';
import { EnemyFactory } from '../entities/enemies/EnemyFactory';
import type {
  EnemyController,
  EnemyControllerEvent,
  EnemyControllerSnapshot,
} from '../entities/enemies/EnemyController';
import { PlantedOrdnanceSystem } from './PlantedOrdnanceSystem';
import type { PlantedOrdnanceSnapshot } from './PlantedOrdnanceSystem';

export type WorldCombatPlayerPorts = Readonly<{
  readSnapshot(): PlayerControllerSnapshot;
  readTarget(): HurtboxTarget;
  receiveImpact(impact: CombatImpact): CombatImpactResolution;
  captureCombatEvents(): readonly PlayerCombatRuntimeEvent[];
  requestHitStop(hitStopMs: number): void;
  restoreManaTo(maximumMana: number, occurredAtMs: number): boolean;
  readMaximumMana(): number;
}>;

export type WorldCombatRuntimeOptions = Readonly<{
  spawns: readonly ActorSpawnDefinition[];
  actors: readonly ActorDefinition[];
  profiles: readonly AiProfileDefinition[];
  attacks: readonly AttackDefinition[];
  dropTables: readonly DropTableDefinition[];
  surfaces: readonly SurfaceDefinition[];
  readCameraBounds(): Rect;
  ordnanceCapacity?: number;
  baseline?: WorldCombatRuntimeBaseline;
  environment?: WorldCombatEnvironmentPorts;
  bossEncounter?: BossEncounterDefinition | null;
}>;

export type WorldCombatEnvironmentPorts = Readonly<{
  targets(): readonly HurtboxTarget[];
  receiveImpact(impact: CombatImpact): CombatImpactResolution;
}>;

export type WorldCombatRuntimeBaseline = Readonly<{
  lastStepIndex: number;
  simulationTimeMs: number;
}>;

export type WorldCombatContactSource = 'player' | 'enemy' | 'boss' | 'ordnance';

type JournalBase = Readonly<{
  sequence: number;
  stepIndex: number;
  occurredAtMs: number;
}>;

export type WorldCombatJournalEvent =
  | Readonly<
      JournalBase & { kind: 'contact'; source: WorldCombatContactSource; impact: CombatImpact }
    >
  | Readonly<
      JournalBase & {
        kind: 'resolution';
        source: WorldCombatContactSource;
        impact: CombatImpact;
        resolution: CombatImpactResolution;
      }
    >
  | Readonly<
      JournalBase & {
        kind: 'attacker-command';
        source: Exclude<WorldCombatContactSource, 'player'>;
        ownerId: CombatantId;
        command: CombatResolutionCommand;
        applied: boolean;
      }
    >
  | Readonly<
      JournalBase & { kind: 'feedback'; source: WorldCombatContactSource; hitStopMs: number }
    >
  | Readonly<
      JournalBase & {
        kind: 'player-combat';
        event: Exclude<
          PlayerCombatRuntimeEvent,
          Extract<PlayerCombatRuntimeEvent, { kind: 'attack-contact' | 'projectile-contact' }>
        >;
      }
    >
  | Readonly<
      JournalBase & {
        kind: 'player-state';
        previousState: PlayerControllerSnapshot['state'];
        currentState: PlayerControllerSnapshot['state'];
      }
    >
  | Readonly<
      JournalBase & { kind: 'enemy-event'; combatantId: CombatantId; event: EnemyControllerEvent }
    >
  | Readonly<JournalBase & { kind: 'boss-event'; event: PallidCantorEvent }>
  | Readonly<JournalBase & { kind: 'boss-command'; command: PallidCantorCommand }>
  | Readonly<JournalBase & { kind: 'ordnance-planted'; ownerId: CombatantId; instanceId: number }>
  | Readonly<JournalBase & { kind: 'ordnance-expired'; instanceId: number }>;

export type WorldCombatEventCounters = Readonly<{
  contacts: number;
  playerContacts: number;
  enemyContacts: number;
  ordnanceContacts: number;
  resolutions: number;
  feedback: number;
  attackerCommands: number;
  stateChanges: number;
  drops: number;
  ordnancePlanted: number;
  defeats: number;
}>;

export type WorldCombatResolutionSummary = Readonly<{
  source: WorldCombatContactSource;
  targetId: CombatantId;
  kind: CombatImpactResolution['kind'];
  guard: 'none' | 'block' | 'guard-break' | 'parry' | 'aegis' | null;
  healthDamage: number;
  defeated: boolean;
}>;

export type WorldCombatEnemySnapshot = Readonly<{
  combatantId: CombatantId;
  actorId: EnemyControllerSnapshot['actorId'];
  state: EnemyControllerSnapshot['state'];
  position: EnemyControllerSnapshot['position'];
  facing: EnemyControllerSnapshot['facing'];
  health: number;
  maxHealth: number;
  poise: number;
  maxPoise: number;
  activeAttackId: AttackDefinition['attackId'] | null;
  attackPhase: 'telegraph' | 'active' | 'recovery' | null;
  hidden: boolean;
  targetable: boolean;
}>;

export type WorldCombatDirectorSnapshot = Readonly<{
  encounterKey: string;
  pressure: number;
  leases: number;
}>;

export type WorldCombatRuntimeSnapshot = Readonly<{
  disposed: boolean;
  stepIndex: number;
  simulationTimeMs: number;
  enemies: readonly WorldCombatEnemySnapshot[];
  directors: readonly WorldCombatDirectorSnapshot[];
  ordnance: readonly PlantedOrdnanceSnapshot[];
  activeOrdnance: number;
  journalSequence: number;
  counters: WorldCombatEventCounters;
  playerVitality: CombatVitalitySnapshot | null;
  lastResolution: WorldCombatResolutionSummary | null;
  boss: PallidCantorSnapshot | null;
}>;

type DirectorEntry = Readonly<{ key: string; director: EncounterDirector }>;

const EMPTY_COUNTERS: WorldCombatEventCounters = Object.freeze({
  contacts: 0,
  playerContacts: 0,
  enemyContacts: 0,
  ordnanceContacts: 0,
  resolutions: 0,
  feedback: 0,
  attackerCommands: 0,
  stateChanges: 0,
  drops: 0,
  ordnancePlanted: 0,
  defeats: 0,
});

export class WorldCombatRuntime {
  private readonly surfaces: readonly SurfaceDefinition[];
  private readonly readCameraBounds: () => Rect;
  private readonly directors: readonly DirectorEntry[];
  private readonly controllers: readonly EnemyController[];
  private readonly controllersById: ReadonlyMap<CombatantId, EnemyController>;
  private readonly ordnance: PlantedOrdnanceSystem;
  private readonly environment: WorldCombatEnvironmentPorts | null;
  private readonly boss: PallidCantorController | null;
  private player: WorldCombatPlayerPorts | null = null;
  private lastStepIndex = 0;
  private simulationTimeMs = 0;
  private nextJournalSequence = 1;
  private counters: WorldCombatEventCounters = EMPTY_COUNTERS;
  private readonly journal: WorldCombatJournalEvent[] = [];
  private lastResolution: WorldCombatResolutionSummary | null = null;
  private routingActive = true;
  private disposed = false;

  public constructor(options: WorldCombatRuntimeOptions) {
    const baseline = options.baseline ?? { lastStepIndex: 0, simulationTimeMs: 0 };
    if (
      !Number.isSafeInteger(baseline.lastStepIndex) ||
      baseline.lastStepIndex < 0 ||
      !Number.isSafeInteger(baseline.simulationTimeMs) ||
      baseline.simulationTimeMs < 0 ||
      (baseline.lastStepIndex === 0) !== (baseline.simulationTimeMs === 0)
    ) {
      throw new RangeError('World combat fixed-clock baseline is invalid.');
    }
    this.lastStepIndex = baseline.lastStepIndex;
    this.simulationTimeMs = baseline.simulationTimeMs;
    this.environment = options.environment ?? null;
    this.surfaces = immutableClone(options.surfaces);
    this.readCameraBounds = options.readCameraBounds;
    this.ordnance = new PlantedOrdnanceSystem(options.ordnanceCapacity ?? 12);
    const spawns = [...immutableClone(options.spawns)].sort((left, right) =>
      left.spawnId.localeCompare(right.spawnId),
    );
    const directors = new Map<string, EncounterDirector>();
    for (const spawn of spawns) {
      const key = spawn.encounterId ?? `solo:${spawn.spawnId}`;
      if (!directors.has(key)) directors.set(key, new EncounterDirector());
    }
    this.directors = Object.freeze(
      [...directors]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, director]) => Object.freeze({ key, director })),
    );
    const factory = new EnemyFactory({
      actors: options.actors,
      profiles: options.profiles,
      attacks: options.attacks,
      dropTables: options.dropTables,
    });
    const created: EnemyController[] = [];
    for (const spawn of spawns) {
      const encounterKey = spawn.encounterId ?? `solo:${spawn.spawnId}`;
      const director = directors.get(encounterKey);
      if (director === undefined) throw new Error('Encounter director was not constructed.');
      const combatantId = stableId<'combatant'>(spawn.spawnId);
      created.push(
        factory.create(spawn, director, {
          readTarget: () => this.readEnemyTarget(),
          readCameraBounds: () => this.readCamera(),
          readSurfaces: () => this.surfaces,
          receiveTargetImpact: (impact) => this.receiveEnemyImpact(combatantId, impact),
          readRoomOrdnanceCount: () => this.ordnance.snapshot().length,
        }),
      );
    }
    this.controllers = Object.freeze(created);
    this.controllersById = new Map(
      created.map((controller) => [controller.identity().combatantId, controller]),
    );
    this.boss =
      options.bossEncounter === undefined || options.bossEncounter === null
        ? null
        : new PallidCantorController(
            {
              readTarget: () => this.readEnemyTarget(),
              receiveTargetImpact: (impact) => this.receiveBossImpact(impact),
            },
            { stepIndex: this.lastStepIndex, simulationTimeMs: this.simulationTimeMs },
          );
  }

  public bindPlayer(ports: WorldCombatPlayerPorts): () => void {
    if (this.disposed || !this.routingActive) throw new Error('World combat runtime is disposed.');
    if (this.player !== null) throw new Error('World combat player is already bound.');
    this.player = ports;
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (this.player === ports) this.player = null;
    };
  }

  public targets(): readonly HurtboxTarget[] {
    if (!this.routingActive || this.disposed) return Object.freeze([]);
    return Object.freeze(
      [
        ...this.controllers.map((controller) => controller.hurtboxTarget()),
        ...(this.boss === null ? [] : [this.boss.hurtboxTarget()]),
        ...(this.environment?.targets() ?? []),
      ]
        .filter((target) => target.hurtboxes.length > 0)
        .map(freezeTarget)
        .sort((left, right) => left.targetId.localeCompare(right.targetId)),
    );
  }

  public receivePlayerImpact(rawImpact: CombatImpact): CombatImpactResolution {
    const impact = freezeCombatImpact(rawImpact);
    if (!this.routingActive || this.disposed) return UNRESOLVED_COMBAT_IMPACT;
    if (this.boss?.identity().combatantId === impact.targetId) {
      this.append('contact', impact.occurredAtMs, { source: 'player', impact });
      const resolution = freezeCombatImpactResolution(this.boss.receiveImpact(impact));
      this.recordResolution('player', impact, resolution);
      this.drainBossEvents(impact.occurredAtMs);
      return resolution;
    }
    const controller = this.controllersById.get(impact.targetId);
    if (controller === undefined) {
      const environment = this.environment;
      if (
        environment === null ||
        !environment.targets().some(({ targetId }) => targetId === impact.targetId)
      ) {
        return UNRESOLVED_COMBAT_IMPACT;
      }
      this.append('contact', impact.occurredAtMs, { source: 'player', impact });
      const resolution = freezeCombatImpactResolution(environment.receiveImpact(impact));
      this.recordResolution('player', impact, resolution);
      return resolution;
    }
    controller.synchronizeSimulationTime(impact.occurredAtMs);
    this.append('contact', impact.occurredAtMs, { source: 'player', impact });
    const resolution = freezeCombatImpactResolution(controller.receiveImpact(impact));
    this.recordResolution('player', impact, resolution);
    this.drainEnemyEvents(controller, impact.occurredAtMs);
    return resolution;
  }

  public advance(frame: PlayerFixedStepFrame): WorldCombatRuntimeSnapshot {
    this.assertAdvance(frame);
    this.simulationTimeMs = frame.endTimeMs;
    for (const event of frame.combatEvents) this.recordPlayerEvent(event, frame.startTimeMs);
    if (this.boss !== null) {
      const result = this.boss.update({
        stepIndex: frame.stepIndex,
        nowMs: frame.endTimeMs,
        stepMs: frame.stepMs,
        pulses: frame.combatEvents.filter(
          (event): event is Extract<PlayerCombatRuntimeEvent, { kind: 'radial-pulse' }> =>
            event.kind === 'radial-pulse' &&
            event.occurredAtMs >= frame.startTimeMs &&
            event.occurredAtMs < frame.endTimeMs,
        ) as readonly ResonantPulseActivation[],
      });
      for (const command of result.commands) this.handleBossCommand(command, frame.endTimeMs);
      this.drainBossEvents(frame.endTimeMs);
    }
    for (const { director } of this.directors) director.advance(frame.endTimeMs);
    for (const controller of this.controllers) {
      if (controller.snapshot().state !== 'dead') controller.update(frame.endTimeMs, frame.stepMs);
      else controller.synchronizeSimulationTime(frame.endTimeMs);
      this.drainEnemyEvents(controller, frame.endTimeMs);
    }
    this.advanceOrdnance(frame.endTimeMs);
    this.lastStepIndex = frame.stepIndex;
    return this.snapshot();
  }

  public snapshot(): WorldCombatRuntimeSnapshot {
    const playerVitality = this.player?.readSnapshot().vitality ?? null;
    const enemies = this.controllers.map((controller) => enemySnapshot(controller.snapshot()));
    const directorSnapshots = this.directors.map(({ key, director }) =>
      directorSnapshot(key, director.snapshot()),
    );
    const ordnance = this.ordnance.snapshot(this.simulationTimeMs);
    return deepFreeze({
      disposed: this.disposed,
      stepIndex: this.lastStepIndex,
      simulationTimeMs: this.simulationTimeMs,
      enemies,
      directors: directorSnapshots,
      ordnance,
      activeOrdnance: ordnance.length,
      journalSequence: this.nextJournalSequence - 1,
      counters: { ...this.counters },
      playerVitality,
      lastResolution: this.lastResolution,
      boss: this.boss?.snapshot() ?? null,
    });
  }

  public drainJournal(): readonly WorldCombatJournalEvent[] {
    const drained = deepFreeze([...this.journal]);
    this.journal.length = 0;
    return drained;
  }

  public confirmBossDefeatSaved(token: number, savedAtEpochMs: number): boolean {
    return this.boss?.confirmDefeatSaved(token, savedAtEpochMs) ?? false;
  }

  public resetForRespawn(): boolean {
    return this.resetForWorldRestore();
  }

  public resetForRest(): boolean {
    return this.resetForWorldRestore();
  }

  private resetForWorldRestore(): boolean {
    if (this.disposed) return false;
    this.ordnance.clear();
    for (const controller of this.controllers) controller.resetForRespawn();
    this.boss?.resetForRespawn({
      stepIndex: this.lastStepIndex,
      simulationTimeMs: this.simulationTimeMs,
    });
    this.journal.length = 0;
    this.counters = EMPTY_COUNTERS;
    this.lastResolution = null;
    return true;
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.routingActive = false;
    this.player = null;
    this.ordnance.dispose();
    for (const controller of this.controllers) controller.dispose();
    this.boss?.dispose();
    for (const { director } of this.directors) director.dispose();
    this.journal.length = 0;
    this.counters = EMPTY_COUNTERS;
    this.lastResolution = null;
    this.disposed = true;
    return true;
  }

  private receiveEnemyImpact(
    ownerId: CombatantId,
    rawImpact: CombatImpact,
  ): CombatImpactResolution {
    const impact = freezeCombatImpact(rawImpact);
    const player = this.player;
    if (!this.routingActive || this.disposed || player === null) return UNRESOLVED_COMBAT_IMPACT;
    this.append('contact', impact.occurredAtMs, { source: 'enemy', impact });
    const previousPlayerState = player.readSnapshot().state;
    const resolution = freezeCombatImpactResolution(player.receiveImpact(impact));
    this.recordPlayerDefenderEvents(player.captureCombatEvents(), impact.occurredAtMs);
    this.recordPlayerState(previousPlayerState, player.readSnapshot().state, impact.occurredAtMs);
    this.recordResolution('enemy', impact, resolution);
    for (const command of resolution.commands) {
      this.bump('attackerCommands');
      this.append('attacker-command', impact.occurredAtMs, {
        source: 'enemy',
        ownerId,
        command,
        applied: command.kind === 'punish-attacker',
      });
    }
    if (isPositiveResolution(resolution)) {
      player.requestHitStop(impact.hitStopMs);
      this.bump('feedback');
      this.append('feedback', impact.occurredAtMs, {
        source: 'enemy',
        hitStopMs: impact.hitStopMs,
      });
    }
    return resolution;
  }

  private receiveBossImpact(rawImpact: CombatImpact): CombatImpactResolution {
    const impact = freezeCombatImpact(rawImpact);
    const player = this.player;
    const boss = this.boss;
    if (!this.routingActive || this.disposed || player === null || boss === null) {
      return UNRESOLVED_COMBAT_IMPACT;
    }
    this.append('contact', impact.occurredAtMs, { source: 'boss', impact });
    const previousPlayerState = player.readSnapshot().state;
    const resolution = freezeCombatImpactResolution(player.receiveImpact(impact));
    this.recordPlayerDefenderEvents(player.captureCombatEvents(), impact.occurredAtMs);
    this.recordPlayerState(previousPlayerState, player.readSnapshot().state, impact.occurredAtMs);
    this.recordResolution('boss', impact, resolution);
    for (const command of resolution.commands) {
      const applied = boss.applyResolutionCommand(command, impact.occurredAtMs);
      this.bump('attackerCommands');
      this.append('attacker-command', impact.occurredAtMs, {
        source: 'boss',
        ownerId: boss.identity().combatantId,
        command,
        applied,
      });
    }
    if (isPositiveResolution(resolution)) {
      player.requestHitStop(impact.hitStopMs);
      this.bump('feedback');
      this.append('feedback', impact.occurredAtMs, { source: 'boss', hitStopMs: impact.hitStopMs });
    }
    return resolution;
  }

  private handleBossCommand(command: PallidCantorCommand, nowMs: number): void {
    this.append('boss-command', nowMs, { command });
    if (command.kind === 'restore-player-mana-to-maximum') {
      const player = this.player;
      if (player !== null) player.restoreManaTo(player.readMaximumMana(), nowMs);
    }
  }

  private drainBossEvents(nowMs: number): void {
    const boss = this.boss;
    if (boss === null) return;
    for (const event of boss.drainEvents()) this.append('boss-event', nowMs, { event });
  }

  private advanceOrdnance(nowMs: number): void {
    const player = this.player;
    const step = this.ordnance.step(nowMs, player?.readTarget() ?? null);
    for (const instanceId of step.expiredInstanceIds) {
      this.append('ordnance-expired', nowMs, { instanceId });
    }
    if (player === null) return;
    for (const contact of step.impacts) {
      const impact = contact.impact;
      this.append('contact', nowMs, { source: 'ordnance', impact });
      const previousPlayerState = player.readSnapshot().state;
      const resolution = freezeCombatImpactResolution(player.receiveImpact(impact));
      this.recordPlayerDefenderEvents(player.captureCombatEvents(), nowMs);
      this.recordPlayerState(previousPlayerState, player.readSnapshot().state, nowMs);
      this.recordResolution('ordnance', impact, resolution);
      if (resolution.projectileDisposition === 'consume') this.ordnance.consume(contact.instanceId);
      for (const command of resolution.commands) {
        const owner = this.controllersById.get(impact.source.ownerId);
        const applied = owner?.applyResolutionCommand(command, nowMs) ?? false;
        this.bump('attackerCommands');
        this.append('attacker-command', nowMs, {
          source: 'ordnance',
          ownerId: impact.source.ownerId,
          command,
          applied,
        });
      }
      if (isPositiveResolution(resolution)) {
        player.requestHitStop(impact.hitStopMs);
        this.bump('feedback');
        this.append('feedback', nowMs, { source: 'ordnance', hitStopMs: impact.hitStopMs });
      }
    }
  }

  private drainEnemyEvents(controller: EnemyController, nowMs: number): void {
    const combatantId = controller.identity().combatantId;
    for (const event of controller.drainEvents()) {
      if (event.kind === 'ordnance') {
        const instanceId = this.ordnance.plant(event.command);
        if (instanceId !== null) {
          this.bump('ordnancePlanted');
          this.append('ordnance-planted', nowMs, {
            ownerId: event.command.ownerId,
            instanceId,
          });
        }
      }
      if (event.kind === 'state-changed') this.bump('stateChanges');
      if (event.kind === 'drop-request') this.bump('drops');
      this.append('enemy-event', eventTime(event, nowMs), { combatantId, event });
    }
  }

  private recordPlayerDefenderEvents(
    events: readonly PlayerCombatRuntimeEvent[],
    nowMs: number,
  ): void {
    for (const event of events) this.recordPlayerEvent(event, nowMs);
  }

  private recordPlayerState(
    previousState: PlayerControllerSnapshot['state'],
    currentState: PlayerControllerSnapshot['state'],
    nowMs: number,
  ): void {
    if (currentState === previousState) return;
    this.append('player-state', nowMs, { previousState, currentState });
  }

  private recordPlayerEvent(event: PlayerCombatRuntimeEvent, nowMs: number): void {
    if (
      event.kind === 'attack-contact' ||
      event.kind === 'projectile-contact' ||
      event.kind === 'incoming-impact'
    ) {
      return;
    }
    if (event.kind === 'feedback-requested') {
      this.bump('feedback');
      this.append('feedback', nowMs, { source: 'player', hitStopMs: event.hitStopMs });
      return;
    }
    this.append('player-combat', nowMs, { event });
  }

  private recordResolution(
    source: WorldCombatContactSource,
    impact: CombatImpact,
    resolution: CombatImpactResolution,
  ): void {
    this.bump('resolutions');
    if (resolution.kind === 'resolved' && resolution.defeated) this.bump('defeats');
    this.lastResolution = deepFreeze({
      source,
      targetId: impact.targetId,
      kind: resolution.kind,
      guard:
        resolution.kind === 'resolved' ||
        resolution.kind === 'parried' ||
        resolution.kind === 'absorbed'
          ? resolution.guard
          : null,
      healthDamage: resolution.kind === 'resolved' ? resolution.damage.healthDamage : 0,
      defeated: resolution.kind === 'resolved' && resolution.defeated,
    });
    this.append('resolution', impact.occurredAtMs, { source, impact, resolution });
  }

  private readEnemyTarget() {
    const player = this.player;
    if (!this.routingActive || this.disposed || player === null) return null;
    const snapshot = player.readSnapshot();
    if (snapshot.state === 'dead') return null;
    const hurtboxTarget = player.readTarget();
    if (hurtboxTarget.hurtboxes.length === 0) return null;
    return Object.freeze({ position: snapshot.position, hurtboxTarget });
  }

  private readCamera(): Rect {
    const camera = this.readCameraBounds();
    if (
      ![camera.x, camera.y, camera.width, camera.height].every(Number.isFinite) ||
      camera.width <= 0 ||
      camera.height <= 0
    ) {
      throw new RangeError('World combat camera bounds are invalid.');
    }
    return Object.freeze({ ...camera });
  }

  private append<Kind extends WorldCombatJournalEvent['kind']>(
    kind: Kind,
    occurredAtMs: number,
    payload: Omit<Extract<WorldCombatJournalEvent, { kind: Kind }>, keyof JournalBase | 'kind'>,
  ): void {
    const sequence = this.nextJournalSequence;
    this.nextJournalSequence += 1;
    if (!Number.isSafeInteger(this.nextJournalSequence)) {
      throw new RangeError('World combat journal sequence exceeded its safe range.');
    }
    this.journal.push(
      deepFreeze({
        sequence,
        stepIndex: Math.max(1, this.lastStepIndex + 1),
        occurredAtMs,
        kind,
        ...payload,
      }) as unknown as WorldCombatJournalEvent,
    );
    if (kind === 'contact') {
      this.bump('contacts');
      const contact = payload as unknown as Readonly<{ source: WorldCombatContactSource }>;
      this.bump(
        contact.source === 'player'
          ? 'playerContacts'
          : contact.source === 'enemy' || contact.source === 'boss'
            ? 'enemyContacts'
            : 'ordnanceContacts',
      );
    }
  }

  private bump(key: keyof WorldCombatEventCounters): void {
    this.counters = Object.freeze({ ...this.counters, [key]: this.counters[key] + 1 });
  }

  private assertAdvance(frame: PlayerFixedStepFrame): void {
    if (this.disposed) throw new Error('World combat runtime is disposed.');
    if (this.player === null) throw new Error('World combat player is not bound.');
    if (
      frame.stepIndex !== this.lastStepIndex + 1 ||
      frame.startTimeMs !== this.simulationTimeMs ||
      frame.endTimeMs <= frame.startTimeMs ||
      frame.endTimeMs - frame.startTimeMs !== frame.stepMs
    ) {
      throw new RangeError('World combat fixed-step frame is not contiguous.');
    }
  }
}

function enemySnapshot(snapshot: EnemyControllerSnapshot): WorldCombatEnemySnapshot {
  return Object.freeze({
    combatantId: snapshot.combatantId,
    actorId: snapshot.actorId,
    state: snapshot.state,
    position: Object.freeze({ ...snapshot.position }),
    facing: snapshot.facing,
    health: snapshot.vitality.currentHealth,
    maxHealth: snapshot.vitality.maxHealth,
    poise: snapshot.vitality.currentPoise,
    maxPoise: snapshot.vitality.maxPoise,
    activeAttackId: snapshot.attack?.attackId ?? null,
    attackPhase: snapshot.attack?.phase ?? null,
    hidden: snapshot.hidden,
    targetable: snapshot.targetable,
  });
}

function directorSnapshot(
  encounterKey: string,
  snapshot: EncounterDirectorSnapshot,
): WorldCombatDirectorSnapshot {
  return Object.freeze({
    encounterKey,
    pressure: snapshot.pressure,
    leases: snapshot.leases.length,
  });
}

function freezeTarget(target: HurtboxTarget): HurtboxTarget {
  return Object.freeze({
    targetId: target.targetId,
    teamId: target.teamId,
    hurtboxes: Object.freeze(target.hurtboxes.map((hurtbox) => Object.freeze({ ...hurtbox }))),
  });
}

function isPositiveResolution(
  resolution: CombatImpactResolution,
): resolution is Extract<CombatImpactResolution, { kind: 'resolved' }> {
  return resolution.kind === 'resolved' && resolution.damage.healthDamage > 0;
}

function eventTime(event: EnemyControllerEvent, fallback: number): number {
  if (event.kind === 'state-changed') return event.atMs;
  if (event.kind === 'attack-impact' || event.kind === 'incoming-impact') {
    return event.impact.occurredAtMs;
  }
  return fallback;
}
