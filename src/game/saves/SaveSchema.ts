import { isStableId, stableId } from '../core/StableId';
import type { AbilityId, StableId } from '../core/StableId';
import type { EquipmentSnapshot } from '../inventory/EquipmentStore';
import type { InventoryEntry } from '../inventory/InventoryStore';
import type { QuestSnapshot } from '../quests/QuestStore';

export const SAVE_SCHEMA_VERSION = 1 as const;

export type SaveSlotId = 'slot-1' | 'slot-2' | 'slot-3';
export const SAVE_SLOT_IDS: readonly SaveSlotId[] = ['slot-1', 'slot-2', 'slot-3'];

export type RegionId = StableId<'region'>;
export type AreaId = StableId<'area'>;
export type CheckpointId = StableId<'checkpoint'>;
export type BossId = StableId<'boss'>;
export type ChestId = StableId<'chest'>;
export type ShortcutId = StableId<'shortcut'>;
export type PuzzleId = StableId<'puzzle'>;
export type RoomId = StableId<'room'>;
export type DiscoveryId = StableId<'discovery'>;
export type InputActionId = StableId<'input-action'>;

export type SaveValidationIssueCode =
  | 'invalid-json'
  | 'missing-required'
  | 'unknown-field'
  | 'invalid-type'
  | 'out-of-range'
  | 'invalid-stable-id'
  | 'duplicate-id'
  | 'invalid-relation'
  | 'unsupported-version'
  | 'checksum-mismatch';

export type SaveValidationIssue = Readonly<{
  path: string;
  code: SaveValidationIssueCode;
  message: string;
}>;

export type SaveNotice = Readonly<{
  path: string;
  code: 'defaulted-preference' | 'migration-applied' | 'recovered-from-backup';
  message: string;
}>;

export type SaveValidationResult =
  | Readonly<{ kind: 'valid'; value: SaveV1; notices: readonly SaveNotice[] }>
  | Readonly<{ kind: 'invalid'; errors: readonly SaveValidationIssue[] }>;

export type SaveSettings = Readonly<{
  difficulty: 'story' | 'standard' | 'challenging';
  reducedMotion: boolean;
  shakeIntensity: number;
  flashIntensity: number;
  subtitles: boolean;
  textScale: number;
  highContrastPrompts: boolean;
  damageNumbers: boolean;
  sustainedAction: 'hold' | 'toggle';
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  muteWhenUnfocused: boolean;
}>;

export const DEFAULT_SAVE_SETTINGS: SaveSettings = Object.freeze({
  difficulty: 'standard',
  reducedMotion: false,
  shakeIntensity: 1,
  flashIntensity: 1,
  subtitles: true,
  textScale: 1,
  highContrastPrompts: false,
  damageNumbers: true,
  sustainedAction: 'hold',
  masterVolume: 1,
  musicVolume: 1,
  sfxVolume: 1,
  ambienceVolume: 1,
  muteWhenUnfocused: true,
});

const SETTINGS_KEYS = [
  'difficulty',
  'reducedMotion',
  'shakeIntensity',
  'flashIntensity',
  'subtitles',
  'textScale',
  'highContrastPrompts',
  'damageNumbers',
  'sustainedAction',
  'masterVolume',
  'musicVolume',
  'sfxVolume',
  'ambienceVolume',
  'muteWhenUnfocused',
] satisfies readonly (keyof SaveSettings)[];

export type InputBinding =
  | Readonly<{ kind: 'keyboard'; code: string }>
  | Readonly<{ kind: 'gamepad-button'; button: number }>
  | Readonly<{ kind: 'gamepad-axis'; axis: number; direction: -1 | 1 }>;

export type BindingOverride = Readonly<{
  actionId: InputActionId;
  bindings: readonly InputBinding[];
}>;

export type SaveLocation = Readonly<{
  regionId: RegionId;
  areaId: AreaId;
  checkpointId: CheckpointId;
  safePosition: Readonly<{ x: number; y: number }>;
}>;

export type PlayerBaseStats = Readonly<{
  maxHealth: number;
  maxMana: number;
  attackPower: number;
  armour: number;
}>;

export type SavePlayer = Readonly<{
  baseStats: PlayerBaseStats;
  currentHealth: number;
  currentMana: number;
  healthUpgrades: number;
  manaUpgrades: number;
  experience: number;
  currency: number;
  weaponLevel: number;
  spellLevels: readonly Readonly<{ abilityId: AbilityId; level: number }>[];
  unlockedAbilities: readonly AbilityId[];
}>;

export type WorldProgress = Readonly<{
  defeatedBosses: readonly BossId[];
  openedChests: readonly ChestId[];
  activatedShortcuts: readonly ShortcutId[];
  solvedPuzzles: readonly PuzzleId[];
  discoveredRooms: readonly RoomId[];
  claimedDiscoveries: readonly DiscoveryId[];
}>;

export type SaveV1 = Readonly<{
  schemaVersion: 1;
  metadata: Readonly<{
    createdAtEpochMs: number;
    snapshotAtEpochMs: number;
    playTimeMs: number;
  }>;
  location: SaveLocation;
  player: SavePlayer;
  inventory: readonly InventoryEntry[];
  equipment: EquipmentSnapshot;
  quests: QuestSnapshot;
  worldProgress: WorldProgress;
  bindingOverrides: readonly BindingOverride[];
  settings: SaveSettings;
}>;

export type NewSaveInput = Readonly<{
  nowEpochMs: number;
  location: SaveLocation;
  baseStats: PlayerBaseStats;
  initialQuests: QuestSnapshot;
  startingAbilities: readonly AbilityId[];
}>;

export function createNewSave(input: NewSaveInput): SaveV1 {
  const candidate = {
    schemaVersion: 1,
    metadata: {
      createdAtEpochMs: input.nowEpochMs,
      snapshotAtEpochMs: input.nowEpochMs,
      playTimeMs: 0,
    },
    location: input.location,
    player: {
      baseStats: input.baseStats,
      currentHealth: input.baseStats.maxHealth,
      currentMana: input.baseStats.maxMana,
      healthUpgrades: 0,
      manaUpgrades: 0,
      experience: 0,
      currency: 0,
      weaponLevel: 0,
      spellLevels: [],
      unlockedAbilities: [...input.startingAbilities].sort(compareStrings),
    },
    inventory: [],
    equipment: [],
    quests: input.initialQuests,
    worldProgress: {
      defeatedBosses: [],
      openedChests: [],
      activatedShortcuts: [],
      solvedPuzzles: [],
      discoveredRooms: [],
      claimedDiscoveries: [],
    },
    bindingOverrides: [],
    settings: DEFAULT_SAVE_SETTINGS,
  };

  const result = validateSaveV1(candidate);
  if (result.kind === 'invalid') {
    throw new RangeError(`Invalid new-save input at ${result.errors[0]?.path ?? '/'}.`);
  }
  return result.value;
}

export function validateSaveV1(candidate: unknown): SaveValidationResult {
  const errors: SaveValidationIssue[] = [];
  const notices: SaveNotice[] = [];
  const root = requireRecord(candidate, '', errors);
  if (root === null) return { kind: 'invalid', errors };

  rejectUnknownFields(
    root,
    [
      'schemaVersion',
      'metadata',
      'location',
      'player',
      'inventory',
      'equipment',
      'quests',
      'worldProgress',
      'bindingOverrides',
      'settings',
    ],
    '',
    errors,
  );

  if (!hasOwn(root, 'schemaVersion')) {
    missing('/schemaVersion', errors);
  } else if (root.schemaVersion !== 1) {
    issue(errors, '/schemaVersion', 'unsupported-version', 'Save schema version is unsupported.');
  }

  const metadata = decodeMetadata(root.metadata, errors);
  const location = decodeLocation(root.location, errors);
  const player = decodePlayer(root.player, errors);
  const inventory = decodeInventory(root.inventory, errors);
  const equipment = decodeEquipment(root.equipment, errors);
  const quests = decodeQuests(root.quests, errors);
  const worldProgress = decodeWorldProgress(root.worldProgress, errors);
  const bindingOverrides = decodeBindingOverrides(root, errors, notices);
  const settings = decodeSettings(root, errors, notices);

  if (
    metadata === null ||
    location === null ||
    player === null ||
    inventory === null ||
    equipment === null ||
    quests === null ||
    worldProgress === null ||
    bindingOverrides === null ||
    settings === null ||
    errors.length > 0
  ) {
    return { kind: 'invalid', errors };
  }

  return {
    kind: 'valid',
    value: {
      schemaVersion: 1,
      metadata,
      location,
      player,
      inventory,
      equipment,
      quests,
      worldProgress,
      bindingOverrides,
      settings,
    },
    notices,
  };
}

function decodeMetadata(value: unknown, errors: SaveValidationIssue[]): SaveV1['metadata'] | null {
  const record = requiredRecord(value, '/metadata', errors);
  if (record === null) return null;
  rejectUnknownFields(
    record,
    ['createdAtEpochMs', 'snapshotAtEpochMs', 'playTimeMs'],
    '/metadata',
    errors,
  );
  const createdAtEpochMs = nonNegativeInteger(record, 'createdAtEpochMs', '/metadata', errors);
  const snapshotAtEpochMs = nonNegativeInteger(record, 'snapshotAtEpochMs', '/metadata', errors);
  const playTimeMs = nonNegativeInteger(record, 'playTimeMs', '/metadata', errors);
  if (createdAtEpochMs === null || snapshotAtEpochMs === null || playTimeMs === null) return null;
  return { createdAtEpochMs, snapshotAtEpochMs, playTimeMs };
}

function decodeLocation(value: unknown, errors: SaveValidationIssue[]): SaveLocation | null {
  const record = requiredRecord(value, '/location', errors);
  if (record === null) return null;
  rejectUnknownFields(
    record,
    ['regionId', 'areaId', 'checkpointId', 'safePosition'],
    '/location',
    errors,
  );
  const regionId = stable<'region'>(record, 'regionId', '/location', errors);
  const areaId = stable<'area'>(record, 'areaId', '/location', errors);
  const checkpointId = stable<'checkpoint'>(record, 'checkpointId', '/location', errors);
  const position = requiredRecord(record.safePosition, '/location/safePosition', errors);
  let safePosition: SaveLocation['safePosition'] | null = null;
  if (position !== null) {
    rejectUnknownFields(position, ['x', 'y'], '/location/safePosition', errors);
    const x = finiteNumber(position, 'x', '/location/safePosition', errors);
    const y = finiteNumber(position, 'y', '/location/safePosition', errors);
    if (x !== null && y !== null) safePosition = { x, y };
  }
  if (regionId === null || areaId === null || checkpointId === null || safePosition === null)
    return null;
  return { regionId, areaId, checkpointId, safePosition };
}

function decodePlayer(value: unknown, errors: SaveValidationIssue[]): SavePlayer | null {
  const record = requiredRecord(value, '/player', errors);
  if (record === null) return null;
  rejectUnknownFields(
    record,
    [
      'baseStats',
      'currentHealth',
      'currentMana',
      'healthUpgrades',
      'manaUpgrades',
      'experience',
      'currency',
      'weaponLevel',
      'spellLevels',
      'unlockedAbilities',
    ],
    '/player',
    errors,
  );
  const statsRecord = requiredRecord(record.baseStats, '/player/baseStats', errors);
  let baseStats: PlayerBaseStats | null = null;
  if (statsRecord !== null) {
    rejectUnknownFields(
      statsRecord,
      ['maxHealth', 'maxMana', 'attackPower', 'armour'],
      '/player/baseStats',
      errors,
    );
    const maxHealth = positiveInteger(statsRecord, 'maxHealth', '/player/baseStats', errors);
    const maxMana = positiveInteger(statsRecord, 'maxMana', '/player/baseStats', errors);
    const attackPower = positiveInteger(statsRecord, 'attackPower', '/player/baseStats', errors);
    const armour = nonNegativeInteger(statsRecord, 'armour', '/player/baseStats', errors);
    if (maxHealth !== null && maxMana !== null && attackPower !== null && armour !== null) {
      baseStats = { maxHealth, maxMana, attackPower, armour };
    }
  }
  const currentHealth = nonNegativeInteger(record, 'currentHealth', '/player', errors);
  const currentMana = nonNegativeInteger(record, 'currentMana', '/player', errors);
  const healthUpgrades = nonNegativeInteger(record, 'healthUpgrades', '/player', errors);
  const manaUpgrades = nonNegativeInteger(record, 'manaUpgrades', '/player', errors);
  const experience = nonNegativeInteger(record, 'experience', '/player', errors);
  const currency = nonNegativeInteger(record, 'currency', '/player', errors);
  const weaponLevel = nonNegativeInteger(record, 'weaponLevel', '/player', errors);
  const spellLevels = decodeSpellLevels(record.spellLevels, errors);
  const unlockedAbilities = decodeStableIdArray<'ability'>(
    record.unlockedAbilities,
    '/player/unlockedAbilities',
    errors,
  );

  if (baseStats !== null && currentHealth !== null && currentHealth > baseStats.maxHealth) {
    issue(
      errors,
      '/player/currentHealth',
      'invalid-relation',
      'Current health cannot exceed maximum health.',
    );
  }
  if (baseStats !== null && currentMana !== null && currentMana > baseStats.maxMana) {
    issue(
      errors,
      '/player/currentMana',
      'invalid-relation',
      'Current mana cannot exceed maximum mana.',
    );
  }
  if (
    baseStats === null ||
    currentHealth === null ||
    currentMana === null ||
    healthUpgrades === null ||
    manaUpgrades === null ||
    experience === null ||
    currency === null ||
    weaponLevel === null ||
    spellLevels === null ||
    unlockedAbilities === null
  )
    return null;
  return {
    baseStats,
    currentHealth,
    currentMana,
    healthUpgrades,
    manaUpgrades,
    experience,
    currency,
    weaponLevel,
    spellLevels,
    unlockedAbilities,
  };
}

function decodeSpellLevels(
  value: unknown,
  errors: SaveValidationIssue[],
): SavePlayer['spellLevels'] | null {
  const array = requiredArray(value, '/player/spellLevels', errors);
  if (array === null) return null;
  const result: { abilityId: AbilityId; level: number }[] = [];
  const ids = new Set<string>();
  array.forEach((entry, index) => {
    const path = `/player/spellLevels/${index}`;
    const record = requiredRecord(entry, path, errors);
    if (record === null) return;
    rejectUnknownFields(record, ['abilityId', 'level'], path, errors);
    const abilityId = stable<'ability'>(record, 'abilityId', path, errors);
    const level = nonNegativeInteger(record, 'level', path, errors);
    if (abilityId === null || level === null) return;
    if (ids.has(abilityId)) {
      issue(errors, `${path}/abilityId`, 'duplicate-id', 'ID must be unique.');
      return;
    }
    ids.add(abilityId);
    result.push({ abilityId, level });
  });
  validateSorted(
    result.map((entry) => entry.abilityId),
    '/player/spellLevels',
    errors,
  );
  return result;
}

function decodeInventory(
  value: unknown,
  errors: SaveValidationIssue[],
): readonly InventoryEntry[] | null {
  const array = requiredArray(value, '/inventory', errors);
  if (array === null) return null;
  const result: InventoryEntry[] = [];
  const ids = new Set<string>();
  array.forEach((entry, index) => {
    const path = `/inventory/${index}`;
    const record = requiredRecord(entry, path, errors);
    if (record === null) return;
    rejectUnknownFields(record, ['itemId', 'quantity'], path, errors);
    const itemId = stable<'item'>(record, 'itemId', path, errors);
    const quantity = positiveInteger(record, 'quantity', path, errors);
    if (itemId === null || quantity === null) return;
    if (ids.has(itemId)) {
      issue(errors, `${path}/itemId`, 'duplicate-id', 'ID must be unique.');
      return;
    }
    ids.add(itemId);
    result.push({ itemId, quantity });
  });
  validateSorted(
    result.map((entry) => entry.itemId),
    '/inventory',
    errors,
  );
  return result;
}

function decodeEquipment(value: unknown, errors: SaveValidationIssue[]): EquipmentSnapshot | null {
  const array = requiredArray(value, '/equipment', errors);
  if (array === null) return null;
  const result: {
    slot: EquipmentSnapshot[number]['slot'];
    itemId: EquipmentSnapshot[number]['itemId'];
  }[] = [];
  const slots = new Set<string>();
  const items = new Set<string>();
  array.forEach((entry, index) => {
    const path = `/equipment/${index}`;
    const record = requiredRecord(entry, path, errors);
    if (record === null) return;
    rejectUnknownFields(record, ['slot', 'itemId'], path, errors);
    const slot = stable<'equipment-slot'>(record, 'slot', path, errors);
    const itemId = stable<'item'>(record, 'itemId', path, errors);
    if (slot === null || itemId === null) return;
    if (slots.has(slot)) issue(errors, `${path}/slot`, 'duplicate-id', 'ID must be unique.');
    if (items.has(itemId)) issue(errors, `${path}/itemId`, 'duplicate-id', 'ID must be unique.');
    slots.add(slot);
    items.add(itemId);
    result.push({ slot, itemId });
  });
  validateSorted(
    result.map((entry) => entry.slot),
    '/equipment',
    errors,
  );
  return result;
}

function decodeQuests(value: unknown, errors: SaveValidationIssue[]): QuestSnapshot | null {
  const record = requiredRecord(value, '/quests', errors);
  if (record === null) return null;
  rejectUnknownFields(record, ['stages', 'flags'], '/quests', errors);
  const stagesArray = requiredArray(record.stages, '/quests/stages', errors);
  const flags = decodeStableIdArray<'quest-flag'>(record.flags, '/quests/flags', errors);
  if (stagesArray === null || flags === null) return null;
  const stages: {
    questId: QuestSnapshot['stages'][number]['questId'];
    stageId: QuestSnapshot['stages'][number]['stageId'];
  }[] = [];
  const ids = new Set<string>();
  stagesArray.forEach((entry, index) => {
    const path = `/quests/stages/${index}`;
    const stage = requiredRecord(entry, path, errors);
    if (stage === null) return;
    rejectUnknownFields(stage, ['questId', 'stageId'], path, errors);
    const questId = stable<'quest'>(stage, 'questId', path, errors);
    const stageId = stable<'quest-stage'>(stage, 'stageId', path, errors);
    if (questId === null || stageId === null) return;
    if (ids.has(questId)) issue(errors, `${path}/questId`, 'duplicate-id', 'ID must be unique.');
    ids.add(questId);
    stages.push({ questId, stageId });
  });
  validateSorted(
    stages.map((entry) => entry.questId),
    '/quests/stages',
    errors,
  );
  return { stages, flags };
}

function decodeWorldProgress(value: unknown, errors: SaveValidationIssue[]): WorldProgress | null {
  const record = requiredRecord(value, '/worldProgress', errors);
  if (record === null) return null;
  const keys = [
    'defeatedBosses',
    'openedChests',
    'activatedShortcuts',
    'solvedPuzzles',
    'discoveredRooms',
    'claimedDiscoveries',
  ] as const;
  rejectUnknownFields(record, keys, '/worldProgress', errors);
  const defeatedBosses = decodeStableIdArray<'boss'>(
    record.defeatedBosses,
    '/worldProgress/defeatedBosses',
    errors,
  );
  const openedChests = decodeStableIdArray<'chest'>(
    record.openedChests,
    '/worldProgress/openedChests',
    errors,
  );
  const activatedShortcuts = decodeStableIdArray<'shortcut'>(
    record.activatedShortcuts,
    '/worldProgress/activatedShortcuts',
    errors,
  );
  const solvedPuzzles = decodeStableIdArray<'puzzle'>(
    record.solvedPuzzles,
    '/worldProgress/solvedPuzzles',
    errors,
  );
  const discoveredRooms = decodeStableIdArray<'room'>(
    record.discoveredRooms,
    '/worldProgress/discoveredRooms',
    errors,
  );
  const claimedDiscoveries = decodeStableIdArray<'discovery'>(
    record.claimedDiscoveries,
    '/worldProgress/claimedDiscoveries',
    errors,
  );
  if (
    defeatedBosses === null ||
    openedChests === null ||
    activatedShortcuts === null ||
    solvedPuzzles === null ||
    discoveredRooms === null ||
    claimedDiscoveries === null
  )
    return null;
  return {
    defeatedBosses,
    openedChests,
    activatedShortcuts,
    solvedPuzzles,
    discoveredRooms,
    claimedDiscoveries,
  };
}

function decodeBindingOverrides(
  root: Readonly<Record<string, unknown>>,
  errors: SaveValidationIssue[],
  notices: SaveNotice[],
): readonly BindingOverride[] | null {
  if (!hasOwn(root, 'bindingOverrides')) {
    notices.push({
      path: '/bindingOverrides',
      code: 'defaulted-preference',
      message: 'Missing binding overrides defaulted to an empty list.',
    });
    return [];
  }
  const localErrors: SaveValidationIssue[] = [];
  const array = requiredArray(root.bindingOverrides, '/bindingOverrides', localErrors);
  if (array === null) return defaultBindings(notices);
  const result: { actionId: InputActionId; bindings: InputBinding[] }[] = [];
  const ids = new Set<string>();
  array.forEach((entry, index) => {
    const path = `/bindingOverrides/${index}`;
    const record = requiredRecord(entry, path, localErrors);
    if (record === null) return;
    rejectUnknownFields(record, ['actionId', 'bindings'], path, localErrors);
    const actionId = stable<'input-action'>(record, 'actionId', path, localErrors);
    const bindingsArray = requiredArray(record.bindings, `${path}/bindings`, localErrors);
    if (actionId === null || bindingsArray === null) return;
    if (ids.has(actionId))
      issue(localErrors, `${path}/actionId`, 'duplicate-id', 'ID must be unique.');
    ids.add(actionId);
    const bindings: InputBinding[] = [];
    bindingsArray.forEach((binding, bindingIndex) => {
      const decoded = decodeBinding(binding, `${path}/bindings/${bindingIndex}`, localErrors);
      if (decoded !== null) bindings.push(decoded);
    });
    result.push({ actionId, bindings });
  });
  validateSorted(
    result.map((entry) => entry.actionId),
    '/bindingOverrides',
    localErrors,
  );
  if (localErrors.length > 0) {
    errors.push(...localErrors.filter((entry) => entry.code === 'unknown-field'));
    return defaultBindings(notices);
  }
  return result;
}

function defaultBindings(notices: SaveNotice[]): readonly BindingOverride[] {
  notices.push({
    path: '/bindingOverrides',
    code: 'defaulted-preference',
    message: 'Invalid binding overrides defaulted to an empty list.',
  });
  return [];
}

function decodeBinding(
  value: unknown,
  path: string,
  errors: SaveValidationIssue[],
): InputBinding | null {
  const record = requiredRecord(value, path, errors);
  if (record === null) return null;
  if (record.kind === 'keyboard') {
    rejectUnknownFields(record, ['kind', 'code'], path, errors);
    if (!hasOwn(record, 'code')) {
      missing(`${path}/code`, errors);
      return null;
    }
    if (typeof record.code !== 'string' || record.code.length === 0) {
      issue(errors, `${path}/code`, 'invalid-type', 'Keyboard code must be a non-empty string.');
      return null;
    }
    return { kind: 'keyboard', code: record.code };
  }
  if (record.kind === 'gamepad-button') {
    rejectUnknownFields(record, ['kind', 'button'], path, errors);
    const button = nonNegativeInteger(record, 'button', path, errors);
    return button === null ? null : { kind: 'gamepad-button', button };
  }
  if (record.kind === 'gamepad-axis') {
    rejectUnknownFields(record, ['kind', 'axis', 'direction'], path, errors);
    const axis = nonNegativeInteger(record, 'axis', path, errors);
    if (!hasOwn(record, 'direction')) missing(`${path}/direction`, errors);
    else if (record.direction !== -1 && record.direction !== 1)
      issue(errors, `${path}/direction`, 'out-of-range', 'Axis direction must be -1 or 1.');
    if (axis === null || (record.direction !== -1 && record.direction !== 1)) return null;
    return { kind: 'gamepad-axis', axis, direction: record.direction };
  }
  issue(
    errors,
    `${path}/kind`,
    hasOwn(record, 'kind') ? 'invalid-type' : 'missing-required',
    'Binding kind is invalid.',
  );
  return null;
}

function decodeSettings(
  root: Readonly<Record<string, unknown>>,
  errors: SaveValidationIssue[],
  notices: SaveNotice[],
): SaveSettings | null {
  if (!hasOwn(root, 'settings')) {
    notices.push({
      path: '/settings',
      code: 'defaulted-preference',
      message: 'Missing settings defaulted to neutral values.',
    });
    return { ...DEFAULT_SAVE_SETTINGS };
  }
  const record = requireRecord(root.settings, '/settings', []);
  if (record === null) {
    notices.push({
      path: '/settings',
      code: 'defaulted-preference',
      message: 'Invalid settings defaulted to neutral values.',
    });
    return { ...DEFAULT_SAVE_SETTINGS };
  }
  rejectUnknownFields(record, SETTINGS_KEYS, '/settings', errors);
  return {
    difficulty: setting(
      record,
      'difficulty',
      DEFAULT_SAVE_SETTINGS.difficulty,
      isDifficulty,
      notices,
    ),
    reducedMotion: setting(
      record,
      'reducedMotion',
      DEFAULT_SAVE_SETTINGS.reducedMotion,
      isBoolean,
      notices,
    ),
    shakeIntensity: setting(
      record,
      'shakeIntensity',
      DEFAULT_SAVE_SETTINGS.shakeIntensity,
      isUnitInterval,
      notices,
    ),
    flashIntensity: setting(
      record,
      'flashIntensity',
      DEFAULT_SAVE_SETTINGS.flashIntensity,
      isUnitInterval,
      notices,
    ),
    subtitles: setting(record, 'subtitles', DEFAULT_SAVE_SETTINGS.subtitles, isBoolean, notices),
    textScale: setting(record, 'textScale', DEFAULT_SAVE_SETTINGS.textScale, isTextScale, notices),
    highContrastPrompts: setting(
      record,
      'highContrastPrompts',
      DEFAULT_SAVE_SETTINGS.highContrastPrompts,
      isBoolean,
      notices,
    ),
    damageNumbers: setting(
      record,
      'damageNumbers',
      DEFAULT_SAVE_SETTINGS.damageNumbers,
      isBoolean,
      notices,
    ),
    sustainedAction: setting(
      record,
      'sustainedAction',
      DEFAULT_SAVE_SETTINGS.sustainedAction,
      isSustainedAction,
      notices,
    ),
    masterVolume: setting(
      record,
      'masterVolume',
      DEFAULT_SAVE_SETTINGS.masterVolume,
      isUnitInterval,
      notices,
    ),
    musicVolume: setting(
      record,
      'musicVolume',
      DEFAULT_SAVE_SETTINGS.musicVolume,
      isUnitInterval,
      notices,
    ),
    sfxVolume: setting(
      record,
      'sfxVolume',
      DEFAULT_SAVE_SETTINGS.sfxVolume,
      isUnitInterval,
      notices,
    ),
    ambienceVolume: setting(
      record,
      'ambienceVolume',
      DEFAULT_SAVE_SETTINGS.ambienceVolume,
      isUnitInterval,
      notices,
    ),
    muteWhenUnfocused: setting(
      record,
      'muteWhenUnfocused',
      DEFAULT_SAVE_SETTINGS.muteWhenUnfocused,
      isBoolean,
      notices,
    ),
  };
}

function setting<Value>(
  record: Readonly<Record<string, unknown>>,
  key: keyof SaveSettings,
  fallback: Value,
  validate: (value: unknown) => value is Value,
  notices: SaveNotice[],
): Value {
  const candidate = record[key];
  if (validate(candidate)) return candidate;
  notices.push({
    path: `/settings/${key}`,
    code: 'defaulted-preference',
    message: 'Invalid setting defaulted to its neutral value.',
  });
  return fallback;
}

function isDifficulty(value: unknown): value is SaveSettings['difficulty'] {
  return value === 'story' || value === 'standard' || value === 'challenging';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isUnitInterval(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isTextScale(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.75 && value <= 2;
}

function isSustainedAction(value: unknown): value is SaveSettings['sustainedAction'] {
  return value === 'hold' || value === 'toggle';
}

function decodeStableIdArray<Kind extends string>(
  value: unknown,
  path: string,
  errors: SaveValidationIssue[],
): readonly StableId<Kind>[] | null {
  const array = requiredArray(value, path, errors);
  if (array === null) return null;
  const result: StableId<Kind>[] = [];
  const ids = new Set<string>();
  array.forEach((entry, index) => {
    if (!isStableId(entry)) {
      issue(
        errors,
        `${path}/${index}`,
        'invalid-stable-id',
        'Value must be a lowercase kebab-case stable ID.',
      );
      return;
    }
    if (ids.has(entry)) {
      issue(errors, `${path}/${index}`, 'duplicate-id', 'ID must be unique.');
      return;
    }
    ids.add(entry);
    result.push(stableId<Kind>(entry));
  });
  validateSorted(result, path, errors);
  return result;
}

function stable<Kind extends string>(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: SaveValidationIssue[],
): StableId<Kind> | null {
  if (!hasOwn(record, key)) {
    missing(`${path}/${key}`, errors);
    return null;
  }
  const value = record[key];
  if (!isStableId(value)) {
    issue(
      errors,
      `${path}/${key}`,
      'invalid-stable-id',
      'Value must be a lowercase kebab-case stable ID.',
    );
    return null;
  }
  return stableId<Kind>(value);
}

function validateSorted(
  values: readonly string[],
  path: string,
  errors: SaveValidationIssue[],
): void {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous !== undefined && current !== undefined && previous > current) {
      issue(errors, `${path}/${index}`, 'invalid-relation', 'Entries must be sorted by stable ID.');
      return;
    }
  }
}

function positiveInteger(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: SaveValidationIssue[],
): number | null {
  const value = integer(record, key, path, errors);
  if (value !== null && value <= 0) {
    issue(errors, `${path}/${key}`, 'out-of-range', 'Value must be a positive safe integer.');
    return null;
  }
  return value;
}

function nonNegativeInteger(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: SaveValidationIssue[],
): number | null {
  const value = integer(record, key, path, errors);
  if (value !== null && value < 0) {
    issue(errors, `${path}/${key}`, 'out-of-range', 'Value must be a non-negative safe integer.');
    return null;
  }
  return value;
}

function integer(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: SaveValidationIssue[],
): number | null {
  if (!hasOwn(record, key)) {
    missing(`${path}/${key}`, errors);
    return null;
  }
  const value = record[key];
  if (typeof value !== 'number') {
    issue(errors, `${path}/${key}`, 'invalid-type', 'Value must be a number.');
    return null;
  }
  if (!Number.isSafeInteger(value)) {
    issue(errors, `${path}/${key}`, 'out-of-range', 'Value must be a safe integer.');
    return null;
  }
  return value;
}

function finiteNumber(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: SaveValidationIssue[],
): number | null {
  if (!hasOwn(record, key)) {
    missing(`${path}/${key}`, errors);
    return null;
  }
  const value = record[key];
  if (typeof value !== 'number') {
    issue(errors, `${path}/${key}`, 'invalid-type', 'Value must be a number.');
    return null;
  }
  if (!Number.isFinite(value)) {
    issue(errors, `${path}/${key}`, 'out-of-range', 'Value must be finite.');
    return null;
  }
  return value;
}

function requiredRecord(
  value: unknown,
  path: string,
  errors: SaveValidationIssue[],
): Readonly<Record<string, unknown>> | null {
  if (value === undefined) {
    missing(path, errors);
    return null;
  }
  return requireRecord(value, path, errors);
}

function requireRecord(
  value: unknown,
  path: string,
  errors: SaveValidationIssue[],
): Readonly<Record<string, unknown>> | null {
  if (!isPlainRecord(value)) {
    issue(errors, path || '/', 'invalid-type', 'Value must be a plain object.');
    return null;
  }
  return value;
}

function requiredArray(
  value: unknown,
  path: string,
  errors: SaveValidationIssue[],
): readonly unknown[] | null {
  if (value === undefined) {
    missing(path, errors);
    return null;
  }
  if (!Array.isArray(value)) {
    issue(errors, path, 'invalid-type', 'Value must be an array.');
    return null;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      issue(errors, `${path}/${index}`, 'missing-required', 'Array entry is missing.');
    }
  }
  return value;
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rejectUnknownFields(
  record: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  path: string,
  errors: SaveValidationIssue[],
): void {
  const allowedFields = new Set(allowed);
  Object.keys(record)
    .filter((key) => !allowedFields.has(key))
    .sort(compareStrings)
    .forEach((key) => {
      issue(
        errors,
        `${path}/${escapePointer(key)}`,
        'unknown-field',
        'Unknown field is not allowed in this schema version.',
      );
    });
}

function hasOwn(record: Readonly<Record<string, unknown>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function missing(path: string, errors: SaveValidationIssue[]): void {
  issue(errors, path, 'missing-required', 'Required field is missing.');
}

function issue(
  errors: SaveValidationIssue[],
  path: string,
  code: SaveValidationIssueCode,
  message: string,
): void {
  errors.push({ path, code, message });
}

function escapePointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
