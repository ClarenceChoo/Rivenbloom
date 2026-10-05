import type { Locator } from '@playwright/test';

export function computedContrastRatio(locator: Locator): Promise<number> {
  return locator.evaluate((node) => {
    const style = getComputedStyle(node);
    const luminance = (color: string) => {
      const channels = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number);
      const [red, green, blue] = channels.map((channel) => {
        const linear = channel / 255;
        return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
    };
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
}
