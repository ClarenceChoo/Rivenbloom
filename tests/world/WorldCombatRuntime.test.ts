import { describe, expect, test } from 'vitest';

import { damageTypeId, stableId } from '../../src/game/core/StableId';
import type { AbilityId, CombatantId } from '../../src/game/core/StableId';
import { ACTORS, AI_PROFILES, DROP_TABLES } from '../../src/game/data/actors';
import { ATTACKS } from '../../src/game/data/attacks';
import { PALLID_CANTOR_ENCOUNTER } from '../../src/game/data/bosses/pallidCantor';
import type {
  ActorSpawnDefinition,
  BossEncounterDefinition,
  SurfaceDefinition,
} from '../../src/game/data/types';
import { PlayerController } from '../../src/game/entities/player/PlayerController';
import { InputService } from '../../src/game/input/InputService';
import type { InputDevicePort, InputDeviceSnapshot } from '../../src/game/input/InputService';
import { WorldCombatRuntime } from '../../src/game/world/WorldCombatRuntime';
import { DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';

class MutableInputPort implements InputDevicePort {
  public reads = 0;
  public heldCodes: readonly string[] = [];

  public read(): InputDeviceSnapshot {
    this.reads += 1;
    return {
      focused: true,
      keyboard: {
        heldCodes: this.heldCodes,
        pressed: [],
        released: [],
        activityAtMs: null,
      },
      gamepad: null,
    };
  }

  public clearTransient(): void {}
}

const GROUND: SurfaceDefinition = {
  surfaceId: stableId<'surface'>('runtime-ground'),
  kind: 'solid',
  roomId: stableId<'room'>('runtime-room'),
  bounds: { x: 0, y: 608, width: 2_560, height: 112 },
  materialId: stableId<'material'>('runtime-stone'),
};

function spawn(
  spawnId: string,
  actorId: string,
  x: number,
  encounterId: string | null = 'runtime-encounter',
): ActorSpawnDefinition {
  return {
    spawnId: stableId<'actor-spawn'>(spawnId),
    actorId: stableId<'actor'>(actorId),
    roomId: stableId<'room'>('runtime-room'),
    position: { x, y: 608 },
    facing: 'left',
    encounterId: encounterId === null ? null : stableId<'encounter'>(encounterId),
  };
}

function incomingImpactForEnvironment(targetId: CombatantId) {
  return {
    attackId: stableId<'attack'>('mara-charged-heavy'),
    targetId,
    source: {
      ownerId: stableId<'combatant'>('mara'),
      teamId: stableId<'team'>('player'),
      position: { x: 256, y: 608 },
      facing: 'right' as const,
    },
    occurredAtMs: 0,
    delivery: 'melee' as const,
    damage: {
      baseDamage: 10,
      damageType: damageTypeId('physical'),
      poiseDamage: 0,
      critical: { kind: 'excluded' as const },
    },
    knockback: { x: 0, y: 0 },
    hitStopMs: 50,
    tags: ['blockable' as const],
    projectile: null,
  };
}

type HarnessOptions = Readonly<{
  currentHealth?: number;
  currentMana?: number;
  unlockedAbilityIds?: readonly AbilityId[];
  selectedAbilityId?: AbilityId;
  bossEncounter?: BossEncounterDefinition;
}>;

function harness(spawns: readonly ActorSpawnDefinition[], options: HarnessOptions = {}) {
  const inputPort = new MutableInputPort();
  const runtime = new WorldCombatRuntime({
    spawns,
    actors: ACTORS,
    profiles: AI_PROFILES,
    attacks: ATTACKS,
    dropTables: DROP_TABLES,
    surfaces: [GROUND],
    readCameraBounds: () => ({ x: 0, y: 0, width: 1_280, height: 720 }),
    bossEncounter: options.bossEncounter ?? null,
  });
  const controller = new PlayerController({
    input: new InputService(inputPort),
    position: { x: 256, y: 608 },
    surfaces: [GROUND],
    zones: [],
    combat: {
      currentMana: options.currentMana ?? 40,
      unlockedAbilityIds: options.unlockedAbilityIds ?? [stableId<'ability'>('lumen-bolt')],
      ...(options.selectedAbilityId === undefined
        ? {}
        : { selectedAbilityId: options.selectedAbilityId }),
      initialFacing: 'right',
      settings: DEFAULT_SAVE_SETTINGS,
      targets: () => runtime.targets(),
      receiveImpact: (impact) => runtime.receivePlayerImpact(impact),
    },
    ...(options.currentHealth === undefined
      ? {}
      : {
          vitals: {
            currentHealth: options.currentHealth,
            maxHealth: 100,
            maxPoise: 40,
            armour: 3,
            resistances: {},
          },
        }),
    fixedStepObserver: (frame) => {
      runtime.advance(frame);
    },
  });
  runtime.bindPlayer({
    readSnapshot: () => controller.snapshot(),
    readTarget: () => controller.hurtboxTarget(),
    receiveImpact: (impact) => controller.receiveImpact(impact),
    captureCombatEvents: () => controller.captureFixedStepCombatEvents(),
    requestHitStop: (hitStopMs) => controller.requestSharedHitStop(hitStopMs),
    restoreManaTo: (maximumMana, occurredAtMs) =>
      controller.restoreManaTo(maximumMana, occurredAtMs),
    readMaximumMana: () => 40,
  });
  let renderNowMs = 0;
  return {
    inputPort,
    runtime,
    controller,
    step(count = 1) {
      for (let index = 0; index < count; index += 1) {
        controller.update(renderNowMs, 1 / 60);
        renderNowMs += 17;
      }
    },
  };
}

type GameHarness = ReturnType<typeof harness>;

function advanceUntil(game: GameHarness, predicate: () => boolean, maximumSteps = 120): void {
  for (let step = 0; step < maximumSteps && !predicate(); step += 1) game.step();
  expect(predicate()).toBe(true);
}

function canonicalJournalLabels(game: GameHarness): string[] {
  return game.runtime.drainJournal().flatMap((rawEvent) => {
    const event = rawEvent as unknown as Readonly<{
      kind: string;
      source?: string;
      currentState?: string;
      event?: Readonly<{ kind: string }>;
    }>;
    if (event.kind === 'contact') return [`contact:${event.source}`];
    if (event.kind === 'player-combat') {
      if (
        event.event?.kind === 'mana-changed' ||
        event.event?.kind === 'status-transition' ||
        event.event?.kind === 'vitality-changed' ||
        event.event?.kind === 'incoming-impact' ||
        event.event?.kind === 'feedback-requested'
      ) {
        return [`player-combat:${event.event.kind}`];
      }
      return [];
    }
    if (event.kind === 'player-state') return [`player-state:${event.currentState}`];
    if (event.kind === 'resolution') return [`resolution:${event.source}`];
    if (event.kind === 'attacker-command') return [`attacker-command:${event.source}`];
    if (event.kind === 'feedback') return [`feedback:${event.source}`];
    return [];
  });
}

describe('WorldCombatRuntime', () => {
  test('constructs, advances, routes, journals, resets, and disposes the optional boss', () => {
    const game = harness([], { bossEncounter: PALLID_CANTOR_ENCOUNTER });
    expect(game.runtime.snapshot().boss).toMatchObject({ state: 'intro', stepIndex: 0 });

    game.step(144);
    expect(game.runtime.snapshot().boss).toMatchObject({ state: 'phaseOne', stepIndex: 144 });
    const target = game.runtime
      .targets()
      .find(({ targetId }) => targetId === 'pallid-cantor-at-hollow-choir');
    expect(target).toBeDefined();
    game.runtime.drainJournal();

    const impact = {
      ...incomingImpactForEnvironment(stableId<'combatant'>('pallid-cantor-at-hollow-choir')),
      occurredAtMs: game.runtime.snapshot().simulationTimeMs,
    };
    expect(game.runtime.receivePlayerImpact(impact)).toMatchObject({
      kind: 'resolved',
      remainingHealth: 415,
    });
    expect(
      game.runtime
        .drainJournal()
        .map((event) =>
          event.kind === 'boss-event'
            ? 'boss-event'
            : event.kind === 'contact' || event.kind === 'resolution'
              ? `${event.kind}:${event.source}`
              : event.kind,
        ),
    ).toEqual(['contact:player', 'resolution:player', 'boss-event']);

    game.step();
    expect(game.runtime.resetForRespawn()).toBe(true);
    game.step();
    expect(game.runtime.snapshot().boss).toMatchObject({ state: 'intro', stepIndex: 146 });
    expect(game.runtime.dispose()).toBe(true);
    expect(game.runtime.targets()).toEqual([]);
    expect(game.runtime.snapshot().boss?.disposed).toBe(true);
  });

  test('routes stable environment targets without constructing them as enemy controllers', () => {
    const impacts: string[] = [];
    const environmentTarget = {
      targetId: stableId<'combatant'>('breakable-root'),
      teamId: stableId<'team'>('environment'),
      hurtboxes: [{ x: 300, y: 448, width: 64, height: 160 }],
    };
    const runtime = new WorldCombatRuntime({
      spawns: [],
      actors: ACTORS,
      profiles: AI_PROFILES,
      attacks: ATTACKS,
      dropTables: DROP_TABLES,
      surfaces: [GROUND],
      readCameraBounds: () => ({ x: 0, y: 0, width: 1_280, height: 720 }),
      environment: {
        targets: () => [environmentTarget],
        receiveImpact: (impact) => {
          impacts.push(impact.targetId);
          return {
            kind: 'resolved',
            guard: 'none',
            manaSpent: 0,
            damage: {
              healthDamage: 10,
              poiseDamage: 0,
              remainingPoise: 0,
              staggered: false,
              critical: false,
              parried: false,
            },
            remainingHealth: 0,
            remainingPoise: 0,
            staggered: false,
            defeated: true,
            projectileDisposition: 'continue',
            commands: [],
          };
        },
      },
    });

    expect(runtime.targets()).toEqual([environmentTarget]);
    expect(runtime.snapshot().enemies).toEqual([]);
    expect(
      runtime.receivePlayerImpact({
        ...incomingImpactForEnvironment(environmentTarget.targetId),
      }),
    ).toMatchObject({ kind: 'resolved', defeated: true });
    expect(impacts).toEqual(['breakable-root']);
    expect(runtime.snapshot().enemies).toEqual([]);
  });

  test('continues from an explicit room-transition fixed-clock baseline without catch-up debt', () => {
    const inputPort = new MutableInputPort();
    let runtime = new WorldCombatRuntime({
      spawns: [],
      actors: ACTORS,
      profiles: AI_PROFILES,
      attacks: ATTACKS,
      dropTables: DROP_TABLES,
      surfaces: [GROUND],
      readCameraBounds: () => ({ x: 0, y: 0, width: 1_280, height: 720 }),
    });
    const controller = new PlayerController({
      input: new InputService(inputPort),
      roomId: stableId<'room'>('runtime-room'),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      fixedStepObserver: (frame) => {
        runtime.advance(frame);
      },
    });
    const ports = {
      readSnapshot: () => controller.snapshot(),
      readTarget: () => controller.hurtboxTarget(),
      receiveImpact: (impact: Parameters<PlayerController['receiveImpact']>[0]) =>
        controller.receiveImpact(impact),
      captureCombatEvents: () => controller.captureFixedStepCombatEvents(),
      requestHitStop: (hitStopMs: number) => controller.requestSharedHitStop(hitStopMs),
      restoreManaTo: (maximumMana: number, occurredAtMs: number) =>
        controller.restoreManaTo(maximumMana, occurredAtMs),
      readMaximumMana: () => 40,
    };
    runtime.bindPlayer(ports);
    controller.update(0, 4 / 60);
    const source = runtime.snapshot();

    const replacement = new WorldCombatRuntime({
      spawns: [],
      actors: ACTORS,
      profiles: AI_PROFILES,
      attacks: ATTACKS,
      dropTables: DROP_TABLES,
      surfaces: [GROUND],
      readCameraBounds: () => ({ x: 0, y: 0, width: 1_280, height: 720 }),
      baseline: {
        lastStepIndex: source.stepIndex,
        simulationTimeMs: source.simulationTimeMs,
      },
    });
    replacement.bindPlayer(ports);
    runtime.dispose();
    runtime = replacement;

    controller.update(68, 1 / 60);

    expect(replacement.snapshot()).toMatchObject({
      stepIndex: source.stepIndex + 1,
      simulationTimeMs: controller.snapshot().combatSimulationTimeMs,
    });
  });

  test('routes real player contacts, requests one feedback, and freezes the shared step on hit-stop', () => {
    const game = harness([spawn('runtime-briar', 'briar-scrapper', 330)]);
    game.inputPort.heldCodes = ['KeyJ'];
    game.step();
    game.inputPort.heldCodes = [];
    for (let index = 0; index < 20 && game.runtime.snapshot().counters.feedback === 0; index += 1) {
      game.step();
    }

    const hit = game.runtime.snapshot();
    expect(hit.enemies[0]?.health).toBe(31);
    expect(hit.counters).toMatchObject({ contacts: 1, resolutions: 1, feedback: 1 });
    const stepIndex = hit.stepIndex;
    game.step();
    expect(game.runtime.snapshot().stepIndex).toBe(stepIndex);
    expect(game.inputPort.reads).toBeGreaterThan(1);
    expect(
      canonicalJournalLabels(game).filter(
        (label) => label === 'feedback:player' || label === 'player-combat:feedback-requested',
      ),
    ).toEqual(['feedback:player']);
  });

  test('journals block defender effects before hurt confirmation and feedback', () => {
    const game = harness([spawn('runtime-block-briar', 'briar-scrapper', 330)]);
    game.inputPort.heldCodes = ['KeyL'];
    advanceUntil(
      game,
      () =>
        game.controller.snapshot().combat.guarding &&
        !game.controller.snapshot().combat.parryActive,
    );
    game.runtime.drainJournal();
    game.controller.drainCombatEvents();

    advanceUntil(game, () => game.runtime.snapshot().counters.enemyContacts === 1);

    expect(canonicalJournalLabels(game)).toEqual([
      'contact:enemy',
      'player-combat:mana-changed',
      'player-combat:vitality-changed',
      'player-state:hurt',
      'resolution:enemy',
      'feedback:enemy',
    ]);
    expect(game.controller.drainCombatEvents().map(({ kind }) => kind)).toEqual([
      'mana-changed',
      'vitality-changed',
      'incoming-impact',
    ]);
    expect(game.controller.drainCombatEvents()).toEqual([]);
  });

  test('journals parry confirmation and attacker command without duplicate defender confirmation', () => {
    const game = harness([spawn('runtime-parry-briar', 'briar-scrapper', 330)]);
    advanceUntil(game, () => game.runtime.snapshot().enemies[0]?.attackPhase === 'telegraph');
    game.step(6);
    game.inputPort.heldCodes = ['KeyL'];
    game.step();
    expect(game.controller.snapshot().combat.parryActive).toBe(true);
    game.runtime.drainJournal();
    game.controller.drainCombatEvents();

    advanceUntil(game, () => game.runtime.snapshot().counters.enemyContacts === 1);

    expect(canonicalJournalLabels(game)).toEqual([
      'contact:enemy',
      'resolution:enemy',
      'attacker-command:enemy',
    ]);
    expect(game.runtime.snapshot().lastResolution).toMatchObject({
      source: 'enemy',
      kind: 'parried',
      guard: 'parry',
    });
  });

  test('journals Aegis mana and status consumption before absorbed confirmation', () => {
    const aegis = stableId<'ability'>('aegis-veil');
    const game = harness([spawn('runtime-aegis-scribe', 'spore-scribe', 500)], {
      unlockedAbilityIds: [aegis],
      selectedAbilityId: aegis,
    });
    game.inputPort.heldCodes = ['KeyQ'];
    game.step();
    expect(game.controller.snapshot().combat.aegisActive).toBe(true);
    game.inputPort.heldCodes = ['KeyL'];
    advanceUntil(
      game,
      () =>
        game.controller.snapshot().combat.guarding &&
        !game.controller.snapshot().combat.parryActive,
    );
    game.runtime.drainJournal();
    game.controller.drainCombatEvents();

    advanceUntil(game, () => game.runtime.snapshot().counters.ordnanceContacts === 1);

    expect(canonicalJournalLabels(game)).toEqual([
      'contact:ordnance',
      'player-combat:mana-changed',
      'player-combat:status-transition',
      'resolution:ordnance',
    ]);
    expect(game.runtime.snapshot().lastResolution).toMatchObject({
      source: 'ordnance',
      kind: 'absorbed',
      guard: 'aegis',
    });
  });

  test('journals unguarded vitality and hurt state before damage confirmation and feedback', () => {
    const game = harness([spawn('runtime-damage-briar', 'briar-scrapper', 330)]);

    advanceUntil(game, () => game.runtime.snapshot().counters.enemyContacts === 1);

    expect(canonicalJournalLabels(game)).toEqual([
      'contact:enemy',
      'player-combat:vitality-changed',
      'player-state:hurt',
      'resolution:enemy',
      'feedback:enemy',
    ]);
  });

  test('journals lethal vitality and dead state before death confirmation and feedback', () => {
    const game = harness([spawn('runtime-death-briar', 'briar-scrapper', 330)], {
      currentHealth: 5,
    });

    advanceUntil(game, () => game.runtime.snapshot().counters.enemyContacts === 1);

    expect(canonicalJournalLabels(game)).toEqual([
      'contact:enemy',
      'player-combat:vitality-changed',
      'player-state:dead',
      'resolution:enemy',
      'feedback:enemy',
    ]);
    expect(game.controller.snapshot().state).toBe('dead');
  });

  test('advances directors first, permits close and ranged pressure, and keeps offscreen enemies asleep', () => {
    const game = harness([
      spawn('runtime-scribe', 'spore-scribe', 500),
      spawn('runtime-offscreen', 'briar-scrapper', 2_000, null),
      spawn('runtime-briar', 'briar-scrapper', 330),
    ]);
    game.step(5);

    const snapshot = game.runtime.snapshot();
    expect(snapshot.enemies.map(({ combatantId }) => combatantId)).toEqual([
      'runtime-briar',
      'runtime-offscreen',
      'runtime-scribe',
    ]);
    expect(
      snapshot.enemies.find(({ combatantId }) => combatantId === 'runtime-offscreen'),
    ).toMatchObject({
      state: 'sleep',
      hidden: true,
    });
    expect(
      snapshot.directors.find(({ encounterKey }) => encounterKey === 'runtime-encounter')?.pressure,
    ).toBe(2);
  });

  test('kills synchronously, skips the dead controller, and drains or disposes idempotently', () => {
    const game = harness([spawn('runtime-briar', 'briar-scrapper', 330)]);
    game.step();
    const enemy = game.runtime.snapshot().enemies[0]!;
    game.runtime.receivePlayerImpact({
      attackId: stableId<'attack'>('test-finisher'),
      targetId: enemy.combatantId,
      source: {
        ownerId: stableId<'combatant'>('mara'),
        teamId: stableId<'team'>('player'),
        position: { x: 256, y: 608 },
        facing: 'right',
      },
      occurredAtMs: game.runtime.snapshot().simulationTimeMs,
      delivery: 'melee',
      damage: {
        baseDamage: 100,
        damageType: damageTypeId('physical'),
        poiseDamage: 100,
        critical: { kind: 'excluded' },
      },
      knockback: { x: 0, y: 0 },
      hitStopMs: 50,
      tags: ['blockable'],
      projectile: null,
    });
    expect(game.runtime.snapshot().enemies[0]).toMatchObject({ state: 'dead', health: 0 });
    game.step();
    expect(game.runtime.snapshot().enemies[0]?.state).toBe('dead');
    const journal = game.runtime.drainJournal();
    expect(journal.length).toBeGreaterThan(0);
    expect(Object.isFrozen(journal)).toBe(true);
    expect(game.runtime.drainJournal()).toEqual([]);
    expect(game.runtime.dispose()).toBe(true);
    expect(game.runtime.dispose()).toBe(false);
    expect(game.runtime.targets()).toEqual([]);
  });

  test('exposes an explicit checkpoint-rest reset that clears encounters and ordnance', () => {
    const game = harness([spawn('runtime-rest-scribe', 'spore-scribe', 500)]);
    advanceUntil(game, () => game.runtime.snapshot().counters.ordnancePlanted > 0);
    expect(game.runtime.resetForRest()).toBe(true);
    expect(game.runtime.snapshot()).toMatchObject({
      activeOrdnance: 0,
      counters: { contacts: 0, ordnancePlanted: 0, defeats: 0 },
      enemies: [{ state: 'sleep', hidden: true, health: 38, maxHealth: 38 }],
    });
  });

  test('plants authored pollen, arms it on the shared clock, and consumes its one player hit', () => {
    const game = harness([spawn('runtime-scribe', 'spore-scribe', 500)]);
    for (
      let render = 0;
      render < 100 && game.runtime.snapshot().counters.ordnanceContacts === 0;
      render += 1
    ) {
      game.step();
    }

    const snapshot = game.runtime.snapshot();
    expect(snapshot.counters).toMatchObject({
      ordnancePlanted: 1,
      ordnanceContacts: 1,
      feedback: 1,
    });
    expect(snapshot.activeOrdnance).toBe(0);
    expect(snapshot.playerVitality?.currentHealth).toBe(95);
    expect(snapshot.lastResolution).toMatchObject({
      source: 'ordnance',
      kind: 'resolved',
      healthDamage: 5,
    });
  });
});
