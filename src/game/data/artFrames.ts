/** Anchors measured in the authored 256px world cells, independent of collision bounds. */
const SURFACE_Y = [116, 132, 130, 137, 127] as const;
const MARA_FEET_Y = [
  330, 331, 324, 301, 323, 340, 298, 296, 307, 306, 312, 312, 300, 302, 307, 301, 305, 303,
] as const;

export function anchoredImageTop(worldAnchor: number, sourceAnchor: number, scale: number): number {
  return worldAnchor - sourceAnchor * scale;
}

export function surfaceFrame(index: number): Readonly<{ surfaceY: number }> {
  return { surfaceY: (SURFACE_Y[index] ?? SURFACE_Y[0]) - WORLD_ART_FRAMES[index]!.y };
}

export function maraGroundAnchor(frame: number): number {
  return (MARA_FEET_Y[frame] ?? MARA_FEET_Y[0]) / (frame >= 12 ? 342 : 341);
}

export const ENEMY_POSE_ROWS = [
  'briar-scrapper',
  'duskwing',
  'spore-scribe',
  'barkbound',
  'rootlurker',
  'thorn-sentinel',
  'pallid-cantor',
] as const;
// Pixel bounds measured on the authored 1161 × 1355 sheet, whose rows are unequal.
export const ENEMY_POSE_Y = [0, 165, 340, 510, 722, 879, 1100, 1355] as const;
// Generated poses have unequal widths; cell boundaries prevent adjacent pose fragments.
export const ENEMY_POSE_X = [
  [0, 190, 373, 558, 784, 965, 1161],
  [0, 191, 385, 573, 770, 969, 1161],
  [0, 181, 361, 557, 785, 968, 1161],
  [0, 185, 365, 548, 770, 951, 1161],
  [0, 184, 362, 535, 785, 958, 1161],
  [0, 178, 358, 530, 779, 944, 1161],
  [0, 181, 347, 538, 773, 950, 1161],
] as const;
export function enemyPose(state: string, phase: string | null, simulationTimeMs: number): number {
  if (state === 'dead' || state === 'defeat') return 5;
  if (state === 'hurt' || state === 'stagger') return 4;
  if (phase === 'telegraph' || state === 'transition') return 2;
  if (phase === 'active') return 3;
  if (phase === 'recovery' || state === 'recover') return 4;
  if (['patrol', 'chase', 'retreat', 'phaseOne', 'phaseTwo'].includes(state))
    return Math.floor(simulationTimeMs / 120) % 2;
  return 0;
}

// Tight source bounds exclude adjacent objects and prevent transparent seams between terrain tiles.
export const WORLD_ART_FRAMES = [
  [16, 101, 232, 168],
  [274, 70, 239, 201],
  [530, 67, 234, 200],
  [791, 114, 238, 145],
  [1051, 47, 239, 219],
  [1350, 8, 168, 266],
  [14, 282, 231, 247],
  [273, 338, 232, 181],
  [530, 307, 241, 213],
  [781, 278, 248, 239],
  [1048, 280, 236, 237],
  [1316, 281, 213, 245],
  [11, 586, 239, 180],
  [273, 562, 239, 209],
  [532, 554, 235, 213],
  [789, 543, 231, 228],
  [1048, 545, 234, 233],
  [1308, 536, 228, 237],
  [23, 816, 220, 178],
  [260, 785, 248, 226],
  [528, 799, 237, 212],
  [816, 790, 158, 224],
  [1040, 803, 247, 206],
  [1300, 813, 221, 192],
].map(([x, y, width, height]) => Object.freeze({ x: x!, y: y!, width: width!, height: height! }));
