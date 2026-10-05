import type { SaveSettings } from '../../saves/SaveSchema';
export function applyGameSettings(root: HTMLElement, settings: SaveSettings): void {
  root.style.setProperty('--user-text-scale', String(settings.textScale));
  root.dataset.reducedMotion = String(settings.reducedMotion);
  root.dataset.highContrastPrompts = String(settings.highContrastPrompts);
}
