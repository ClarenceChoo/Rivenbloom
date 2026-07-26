type BaseGameEventMap = {
  readonly 'scene:transition-requested': {
    readonly target: 'title' | 'world' | 'ui' | 'menu' | 'dialogue' | 'transition';
    readonly reason?: 'area-change' | 'death' | 'respawn' | 'cinematic';
  };
  readonly 'area:transition-requested': {
    readonly areaId: string;
    readonly entranceId?: string;
  };
  readonly 'area:changed': {
    readonly areaId: string;
    readonly previousAreaId?: string;
  };
  readonly 'save:status-changed': {
    readonly slotId: string;
    readonly status: 'idle' | 'saving' | 'saved' | 'error';
    readonly message?: string;
  };
  readonly 'save:loaded': {
    readonly slotId: string;
    readonly areaId: string;
    readonly checkpointId?: string;
  };
  readonly 'input:device-changed': {
    readonly device: 'keyboard' | 'gamepad';
  };
  readonly 'input:binding-changed': {
    readonly actionId: string;
    readonly binding: string;
  };
  readonly 'combat:damage-resolved': {
    readonly targetId: string;
    readonly sourceId?: string;
    readonly amount: number;
    readonly remainingHealth: number;
    readonly critical: boolean;
  };
  readonly 'combat:actor-defeated': {
    readonly actorId: string;
    readonly actorKind: 'player' | 'enemy' | 'boss';
  };
  readonly 'combat:cue-requested': {
    readonly cueId: string;
    readonly kind: 'effect' | 'sound';
    readonly sourceId: string;
  };
  readonly 'combat:ability-used': {
    readonly actorId: string;
    readonly abilityId: string;
    readonly mana: number;
    readonly cooldownReadyAt: number;
  };
  readonly 'combat:projectile-converted': {
    readonly actorId: string;
    readonly projectileId: string;
    readonly manaRestored: number;
  };
  readonly 'combat:status-changed': {
    readonly targetId: string;
    readonly statusId: string;
    readonly state: 'applied' | 'expired';
    readonly expiresAtFrame?: number;
  };
  readonly 'combat:mechanism-requested': {
    readonly mechanismId: string;
    readonly hookId: string;
    readonly sourceId: string;
  };
  readonly 'quest:transition-applied': {
    readonly questId: string;
    readonly fromStage?: string;
    readonly toStage: string;
  };
  readonly 'ui:notification-requested': {
    readonly message: string;
    readonly tone: 'info' | 'success' | 'warning' | 'error';
  };
  readonly 'ui:boss-health-changed': {
    readonly bossId: string;
    readonly current: number;
    readonly maximum: number;
  };
};

export type GameEventMap<TAdditionalEvents extends object = {}> = BaseGameEventMap &
  TAdditionalEvents;

type EventName<TEvents extends object> = Extract<keyof TEvents, string>;
type EventListener<TEvents extends object, TEvent extends EventName<TEvents>> = (
  payload: TEvents[TEvent]
) => void;
type UntypedEventListener = (payload: unknown) => void;

export class GameEvents<TAdditionalEvents extends object = {}> {
  private readonly listeners = new Map<string, Set<UntypedEventListener>>();

  public subscribe<TEvent extends EventName<GameEventMap<TAdditionalEvents>>>(
    event: TEvent,
    listener: EventListener<GameEventMap<TAdditionalEvents>, TEvent>
  ): () => void {
    const listeners = this.listeners.get(event) ?? new Set<UntypedEventListener>();
    const untypedListener = listener as unknown as UntypedEventListener;

    listeners.add(untypedListener);
    this.listeners.set(event, listeners);

    return () => this.unsubscribe(event, listener);
  }

  public unsubscribe<TEvent extends EventName<GameEventMap<TAdditionalEvents>>>(
    event: TEvent,
    listener: EventListener<GameEventMap<TAdditionalEvents>, TEvent>
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners === undefined) {
      return;
    }

    listeners.delete(listener as unknown as UntypedEventListener);
    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  public emit<TEvent extends EventName<GameEventMap<TAdditionalEvents>>>(
    event: TEvent,
    payload: GameEventMap<TAdditionalEvents>[TEvent]
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners === undefined) {
      return;
    }

    for (const listener of [...listeners]) {
      listener(payload);
    }
  }
}
