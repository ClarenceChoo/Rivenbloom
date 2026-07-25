export type TransitionGuard<S, C> = (context: C, from: S, to: S) => boolean;

export type StateTransition<S, C> = {
  readonly guard?: TransitionGuard<S, C>;
};

export type StateDefinition<S extends PropertyKey, C> = {
  readonly transitions?: Readonly<Partial<Record<S, StateTransition<S, C>>>>;
  readonly onEnter?: (context: C, state: S, previous: S) => void;
  readonly onExit?: (context: C, state: S, next: S) => void;
};

export type StateMachineConfig<S extends PropertyKey, C> = {
  readonly initial: S;
  readonly states: Readonly<Record<S, StateDefinition<S, C>>>;
};

export class StateMachine<S extends PropertyKey, C> {
  private current: S;

  public constructor(private readonly config: StateMachineConfig<S, C>) {
    this.current = config.initial;
  }

  public get state(): S {
    return this.current;
  }

  public request(next: S, context: C): boolean {
    const previous = this.current;

    if (next === previous) {
      return false;
    }

    const transition = this.config.states[previous].transitions?.[next];
    if (transition === undefined || transition.guard?.(context, previous, next) === false) {
      return false;
    }

    this.config.states[previous].onExit?.(context, previous, next);
    this.current = next;
    this.config.states[next].onEnter?.(context, next, previous);
    return true;
  }
}
