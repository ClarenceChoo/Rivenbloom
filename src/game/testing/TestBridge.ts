export type TestBridgeActions = {
  readonly unlockAbility: (abilityId: string) => boolean;
};

declare global {
  interface Window {
    __RIVENBLOOM_TEST__?: TestBridgeActions;
  }
}

// Mutation hooks are for Playwright only; production builds must omit them.
export const installTestBridge = (actions: TestBridgeActions): (() => void) => {
  if (!import.meta.env.DEV) return () => {};
  window.__RIVENBLOOM_TEST__ = actions;
  return () => {
    if (window.__RIVENBLOOM_TEST__ === actions) delete window.__RIVENBLOOM_TEST__;
  };
};
