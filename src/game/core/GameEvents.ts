export type GameEventMap = Readonly<Record<string, unknown>>;

type EventName<TEvents extends object> = Extract<keyof TEvents, string>;
type EventListener<TEvents extends object, TEvent extends EventName<TEvents>> = (
  payload: TEvents[TEvent]
) => void;
type UntypedEventListener = (payload: unknown) => void;

export class GameEvents<TEvents extends object = GameEventMap> {
  private readonly listeners = new Map<string, Set<UntypedEventListener>>();

  public subscribe<TEvent extends EventName<TEvents>>(
    event: TEvent,
    listener: EventListener<TEvents, TEvent>
  ): () => void {
    const listeners = this.listeners.get(event) ?? new Set<UntypedEventListener>();
    const untypedListener = listener as unknown as UntypedEventListener;

    listeners.add(untypedListener);
    this.listeners.set(event, listeners);

    return () => this.unsubscribe(event, listener);
  }

  public unsubscribe<TEvent extends EventName<TEvents>>(
    event: TEvent,
    listener: EventListener<TEvents, TEvent>
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

  public emit<TEvent extends EventName<TEvents>>(event: TEvent, payload: TEvents[TEvent]): void {
    const listeners = this.listeners.get(event);
    if (listeners === undefined) {
      return;
    }

    for (const listener of [...listeners]) {
      listener(payload);
    }
  }
}
