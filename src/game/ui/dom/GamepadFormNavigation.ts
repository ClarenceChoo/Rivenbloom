import type { InputFrame } from '../../input/InputService';
export function stepRange(
  value: number,
  direction: number,
  min: number,
  max: number,
  step: number,
): number {
  return Math.min(max, Math.max(min, Math.round((value + direction * step) * 1e6) / 1e6));
}
export function repeatDue(now: number, last: number, repeating: boolean): boolean {
  return now - last >= (repeating ? 100 : 350);
}
export class GamepadFormNavigation {
  private readonly held = new Map<string, { last: number; repeating: boolean }>();
  public update(root: HTMLElement, frame: InputFrame): void {
    if (frame.activeDevice !== 'gamepad') {
      this.held.clear();
      return;
    }
    const active = document.activeElement;
    if (
      frame.actions['ui-confirm'].pressed &&
      active instanceof HTMLElement &&
      root.contains(active)
    ) {
      if (
        active instanceof HTMLButtonElement ||
        (active instanceof HTMLInputElement && active.type === 'checkbox')
      )
        active.click();
    }
    for (const action of ['ui-up', 'ui-down', 'ui-left', 'ui-right'] as const) {
      const input = frame.actions[action];
      if (!input.held) {
        this.held.delete(action);
        continue;
      }
      let state = this.held.get(action);
      let fire = input.pressed;
      if (state === undefined) {
        state = { last: frame.sampledAtMs, repeating: false };
        this.held.set(action, state);
      } else if (repeatDue(frame.sampledAtMs, state.last, state.repeating)) {
        fire = true;
        state.last = frame.sampledAtMs;
        state.repeating = true;
      }
      if (!fire) continue;
      const direction = action === 'ui-up' || action === 'ui-left' ? -1 : 1;
      if (
        (action === 'ui-left' || action === 'ui-right') &&
        active instanceof HTMLElement &&
        root.contains(active)
      ) {
        if (active instanceof HTMLInputElement && active.type === 'range') {
          active.value = String(
            stepRange(
              Number(active.value),
              direction,
              Number(active.min),
              Number(active.max),
              Number(active.step) || 1,
            ),
          );
          active.dispatchEvent(new Event('input', { bubbles: true }));
          active.dispatchEvent(new Event('change', { bubbles: true }));
          continue;
        }
        if (active instanceof HTMLSelectElement) {
          active.selectedIndex = Math.min(
            active.options.length - 1,
            Math.max(0, active.selectedIndex + direction),
          );
          active.dispatchEvent(new Event('change', { bubbles: true }));
          continue;
        }
      }
      const controls = [
        ...root.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
        ),
      ].filter((node) => !node.hidden && node.getClientRects().length > 0);
      const index = controls.indexOf(active as HTMLElement);
      controls[(index + direction + controls.length) % controls.length]?.focus();
    }
  }
}
