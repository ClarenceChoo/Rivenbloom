import type { TitleTransitionPayload } from './TitleController';

export type TransitionActionCallbacks = Readonly<{
  onEnter(payload: TitleTransitionPayload): void;
  onReturn(): void;
}>;

export type TransitionActions = Readonly<{
  enter(): boolean;
  returnToTitle(): boolean;
}>;

export function createTransitionActions(
  payload: TitleTransitionPayload,
  callbacks: TransitionActionCallbacks,
): TransitionActions {
  let active = true;
  const claim = (action: () => void): boolean => {
    if (!active) return false;
    active = false;
    action();
    return true;
  };
  return Object.freeze({
    enter: () => claim(() => callbacks.onEnter(payload)),
    returnToTitle: () => claim(callbacks.onReturn),
  });
}
