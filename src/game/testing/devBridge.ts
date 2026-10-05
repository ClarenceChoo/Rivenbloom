import type { SaveSlotId } from '../saves/SaveSchema';
import type { AreaLoadedEvent } from '../core/AppServices';
import type { PlayerState } from '../entities/player/PlayerState';
import type { PlayerCombatRuntimeSnapshot } from '../entities/player/PlayerCombatRuntime';
import type { WorldCombatRuntimeSnapshot } from '../world/WorldCombatRuntime';
import { deepFreeze } from '../data/immutability';
import type { WorldDomainEvent, WorldModalState } from '../world/WorldModalController';
import type { WorldUiProjection } from '../world/WorldUiProjection';

export type DevSlotStateKind = 'loading' | 'empty' | 'ready' | 'corrupt' | 'error';

export type DevDeathReloadInitial = Readonly<{
  position: Readonly<{ x: number; y: number }>;
  currentHealth: number;
  maxHealth: number;
  currentMana: number;
  maxMana: number;
  projectileCount: number;
  activeOrdnance: number;
  enemiesFresh: boolean;
}>;

export type DevBridgeSnapshot = Readonly<{
  activeScene: string;
  titleReady: boolean;
  slotStates: readonly DevSlotStateKind[];
  transition: Readonly<{ mode: 'new' | 'load'; slotId: SaveSlotId }> | null;
  world: AreaLoadedEvent | null;
  player: Readonly<{
    position: Readonly<{ x: number; y: number }>;
    velocity: Readonly<{ x: number; y: number }>;
    state: PlayerState;
    grounded: boolean;
    animationIntent: string;
  }> | null;
  camera: Readonly<{ scrollX: number; scrollY: number; zoom: number }> | null;
  combat: PlayerCombatRuntimeSnapshot | null;
  encounter: WorldCombatRuntimeSnapshot | null;
  worldUi: WorldUiProjection | null;
  modal: WorldModalState | null;
  lastDomainEvent: WorldDomainEvent | null;
  domainEvents: readonly WorldDomainEvent[];
  runtimeSaveRevision: number | null;
  deathReload: Readonly<{
    slotId: SaveSlotId;
    count: number;
    initial: DevDeathReloadInitial | null;
  }> | null;
}>;

export type DevAction =
  | Readonly<{ kind: 'respawn' }>
  | Readonly<{ kind: 'defeat-enemies'; combatantIds: readonly string[] }>;

type DevBridge = Readonly<{
  read(): DevBridgeSnapshot;
  act(action: DevAction): void;
}>;

let actions: DevAction[] = [];

let snapshot: DevBridgeSnapshot = freezeSnapshot({
  activeScene: 'boot',
  titleReady: false,
  slotStates: ['loading', 'loading', 'loading'],
  transition: null,
  world: null,
  player: null,
  camera: null,
  combat: null,
  encounter: null,
  worldUi: null,
  modal: null,
  lastDomainEvent: null,
  domainEvents: [],
  runtimeSaveRevision: null,
  deathReload: null,
});

export function installDevBridge(): () => void {
  actions = [];
  const bridge: DevBridge = Object.freeze({
    read: () => freezeSnapshot(snapshot),
    act: (action) =>
      actions.push(
        action.kind === 'defeat-enemies'
          ? deepFreeze({ ...action, combatantIds: [...action.combatantIds] })
          : Object.freeze({ ...action }),
      ),
  });
  Object.defineProperty(window, '__RIVENBLOOM_TEST__', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: bridge,
  });
  return () => {
    actions = [];
    Reflect.deleteProperty(window, '__RIVENBLOOM_TEST__');
  };
}

export function updateDevBridge(patch: Partial<DevBridgeSnapshot>): void {
  snapshot = freezeSnapshot({ ...snapshot, ...patch });
}

export function drainDevActions(): readonly DevAction[] {
  const drained = Object.freeze([...actions]);
  actions = [];
  return drained;
}

export function recordDevDeathReload(slotId: SaveSlotId): void {
  snapshot = freezeSnapshot({
    ...snapshot,
    deathReload: {
      slotId,
      count: (snapshot.deathReload?.count ?? 0) + 1,
      initial: null,
    },
  });
}

export function recordDevDeathReloadInitial(
  slotId: SaveSlotId,
  initial: DevDeathReloadInitial,
): void {
  const deathReload = snapshot.deathReload;
  if (deathReload === null || deathReload.slotId !== slotId || deathReload.initial !== null) return;
  snapshot = freezeSnapshot({
    ...snapshot,
    deathReload: {
      ...deathReload,
      initial,
    },
  });
}

function freezeSnapshot(value: DevBridgeSnapshot): DevBridgeSnapshot {
  return deepFreeze({
    ...value,
    slotStates: Object.freeze([...value.slotStates]),
    transition: value.transition === null ? null : Object.freeze({ ...value.transition }),
    world:
      value.world === null
        ? null
        : Object.freeze({
            ...value.world,
            position: Object.freeze({ ...value.world.position }),
          }),
    player:
      value.player === null
        ? null
        : Object.freeze({
            ...value.player,
            position: Object.freeze({ ...value.player.position }),
            velocity: Object.freeze({ ...value.player.velocity }),
          }),
    camera: value.camera === null ? null : Object.freeze({ ...value.camera }),
    combat:
      value.combat === null
        ? null
        : Object.freeze({
            ...value.combat,
            projectiles: Object.freeze(
              value.combat.projectiles.map((projectile) =>
                Object.freeze({
                  ...projectile,
                  position: Object.freeze({ ...projectile.position }),
                }),
              ),
            ),
          }),
    encounter: value.encounter,
  });
}
