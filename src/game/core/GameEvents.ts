export type GameEventMap = Readonly<Record<never, never>>;

export type GameEventListener<Payload> = (payload: Payload) => void;

export class GameEvents<Events extends object = GameEventMap> {
  private readonly listeners: Partial<{
    -readonly [EventName in keyof Events]: Set<GameEventListener<Events[EventName]>>;
  }> = {};

  public on<EventName extends keyof Events>(
    eventName: EventName,
    listener: GameEventListener<Events[EventName]>,
  ): () => void {
    const existingListeners = this.listeners[eventName];
    const listeners = existingListeners ?? new Set<GameEventListener<Events[EventName]>>();

    if (existingListeners === undefined) {
      this.listeners[eventName] = listeners;
    }

    listeners.add(listener);
    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      listeners.delete(listener);

      if (listeners.size === 0 && this.listeners[eventName] === listeners) {
        delete this.listeners[eventName];
      }
    };
  }

  public emit<EventName extends keyof Events>(
    eventName: EventName,
    payload: Events[EventName],
  ): void {
    this.listeners[eventName]?.forEach((listener) => listener(payload));
  }
}
