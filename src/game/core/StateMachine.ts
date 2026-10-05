export type StateTransitionTable<S extends string> = Readonly<{
  [State in S]: readonly S[];
}>;

export type StateTransition<S, C> = Readonly<{
  from: S;
  to: S;
  context: C;
}>;

export type StateTransitionListener<S, C> = (transition: StateTransition<S, C>) => void;

export class StateMachine<S extends string, C> {
  private currentState: S;

  public constructor(
    initialState: S,
    private readonly transitions: StateTransitionTable<S>,
    private readonly onTransition?: StateTransitionListener<S, C>,
  ) {
    this.currentState = initialState;
  }

  public get state(): S {
    return this.currentState;
  }

  public request(next: S, context: C): boolean {
    const from = this.currentState;

    if (!this.transitions[from].includes(next)) {
      return false;
    }

    this.currentState = next;
    this.onTransition?.({ from, to: next, context });
    return true;
  }
}
