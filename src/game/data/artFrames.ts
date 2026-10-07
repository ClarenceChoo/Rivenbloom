/** Anchors measured in the authored 256px world cells, independent of collision bounds. */
const SURFACE_Y = [116, 132, 130, 137, 127] as const;
const MARA_FEET_Y = [
  330, 331, 324, 301, 323, 340, 298, 296, 307, 306, 312, 312, 300, 302, 307, 301, 305, 303,
] as const;

export const AREA_BACKGROUND_KEYS = [
  'rivenbloom-background-wren-rest',
  'rivenbloom-background-brackenreach',
  'rivenbloom-background-singing-hollows',
  'rivenbloom-background-rootglass-reliquary',
  'rivenbloom-background-hollow-choir',
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

export function coverArtScale(
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number,
): number {
  return Math.max(targetWidth / width, targetHeight / height);
}

export const NPC_ART_FRAMES = {
  'sela-quill': { x: 97, y: 80, width: 399, height: 877, displayHeight: 112 },
  'orin-fen': { x: 576, y: 69, width: 417, height: 891, displayHeight: 118 },
  'piri-moss': { x: 1092, y: 293, width: 392, height: 662, displayHeight: 92 },
} as const;

// Ground anchors include a held airborne stride; scale uses a shared body reference,
// never the bounding height of a crouch or the horizontal death pose.
export const MARA_LOCOMOTION_FRAMES = [
  { x: 16, y: 76, width: 366, height: 400, groundY: 466 },
  { x: 416, y: 80, width: 347, height: 400, groundY: 471 },
  { x: 784, y: 76, width: 368, height: 400, groundY: 468 },
  { x: 1168, y: 80, width: 354, height: 400, groundY: 470 },
  { x: 16, y: 553, width: 393, height: 368, groundY: 944 },
  { x: 418, y: 565, width: 348, height: 346, groundY: 959 },
  { x: 766, y: 803, width: 416, height: 138, groundY: 932 },
  { x: 1189, y: 535, width: 324, height: 421, groundY: 947 },
] as const;
export const MARA_LOCOMOTION_REFERENCE_HEIGHT = 450;
export const MARA_RUN_CYCLE = [0, 1, 4, 2, 3, 5] as const;

export const TERRAIN_ART_FRAMES = [
  { y: 66, height: 137, surfaceY: 93 },
  { y: 257, height: 144, surfaceY: 269 },
  { y: 442, height: 144, surfaceY: 466 },
  { y: 624, height: 151, surfaceY: 641 },
  { y: 809, height: 170, surfaceY: 832 },
] as const;
export const TERRAIN_SOURCE_WIDTH = 1536;
export const TERRAIN_CAP_WIDTH = 24;
export const TERRAIN_FILL_FRAMES = [
  { x: 0, y: 0 },
  { x: 512, y: 0 },
  { x: 1024, y: 0 },
  { x: 0, y: 512 },
  { x: 512, y: 512 },
] as const;
export const TERRAIN_FILL_SIZE = 512;

export function terrainSpan(
  width: number,
  scale: number,
): Readonly<{ capWidth: number; middleWidth: number }> {
  const capWidth = Math.min(width / 2, TERRAIN_CAP_WIDTH * scale);
  return { capWidth, middleWidth: Math.max(0, width - 2 * capWidth) };
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
// Pixel bounds measured on the authored 1161 × 1354 sheet, whose rows are unequal.
export const ENEMY_POSE_Y = [0, 165, 340, 510, 722, 879, 1100, 1354] as const;
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
// Tight per-pose bounds keep adjacent wings, hooks and spear tips out of the crop.
const ENEMY_VISIBLE_BOUNDS = [
  [
    [20, 42, 180, 161],
    [205, 39, 376, 161],
    [387, 49, 556, 161],
    [578, 59, 769, 161],
    [789, 36, 944, 161],
    [963, 91, 1145, 163],
  ],
  [
    [27, 176, 190, 340],
    [199, 176, 377, 340],
    [395, 174, 567, 340],
    [572, 173, 758, 316],
    [783, 186, 948, 340],
    [965, 242, 1140, 331],
  ],
  [
    [32, 355, 164, 506],
    [207, 355, 353, 506],
    [397, 354, 547, 506],
    [576, 354, 772, 506],
    [794, 358, 951, 505],
    [969, 408, 1145, 508],
  ],
  [
    [39, 517, 171, 714],
    [212, 518, 365, 714],
    [386, 518, 554, 714],
    [569, 532, 762, 713],
    [786, 520, 948, 714],
    [938, 622, 1143, 714],
  ],
  [
    [30, 727, 163, 873],
    [191, 741, 362, 873],
    [384, 734, 532, 873],
    [553, 744, 759, 873],
    [782, 738, 947, 873],
    [946, 803, 1132, 881],
  ],
  [
    [33, 886, 158, 1093],
    [195, 888, 338, 1093],
    [384, 886, 510, 1093],
    [544, 889, 783, 1093],
    [789, 890, 942, 1094],
    [947, 978, 1142, 1098],
  ],
  [
    [34, 1108, 181, 1330],
    [208, 1113, 364, 1330],
    [386, 1105, 554, 1329],
    [581, 1102, 765, 1329],
    [791, 1121, 930, 1329],
    [950, 1164, 1142, 1328],
  ],
] as const;
export const ENEMY_ART_FRAMES = ENEMY_VISIBLE_BOUNDS.map((row, rowIndex) =>
  row.map(([left, top, right, bottom], pose) => {
    const x = left - 3;
    const y = top - 3;
    const width = right - left + 6;
    const height = bottom - top + 6;
    const center = (ENEMY_POSE_X[rowIndex]![pose]! + ENEMY_POSE_X[rowIndex]![pose + 1]!) / 2;
    return Object.freeze({
      x,
      y,
      width,
      height,
      originX: (center - x) / width,
      originY: ((rowIndex === 1 ? 340 : bottom) - y) / height,
    });
  }),
);
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
