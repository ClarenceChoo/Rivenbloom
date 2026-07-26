export const SAVE_SCHEMA_VERSION = 1 as const;
export const SAVE_SLOT_IDS = ['slot-1', 'slot-2', 'slot-3'] as const;

export type SaveSlotId = (typeof SAVE_SLOT_IDS)[number];

export type SaveMetadata = {
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly playtimeSeconds: number;
  readonly areaId: string;
  readonly checkpointId?: string;
  readonly safePosition: { readonly x: number; readonly y: number };
};

export type SavePlayerState = {
  readonly health: number;
  readonly mana: number;
  readonly healthUpgrades: number;
  readonly manaUpgrades: number;
  readonly xp: number;
  readonly currency: number;
  readonly weaponLevel: number;
  readonly spellLevels: Readonly<Record<string, number>>;
};

export type SaveSettings = {
  readonly subtitles: boolean;
  readonly reducedMotion: boolean;
  readonly textScale: number;
  readonly highContrastPrompts: boolean;
  readonly screenShake: number;
  readonly screenFlash: number;
  readonly damageNumbers: boolean;
  readonly holdToToggle: boolean;
  readonly audio: { readonly master: number; readonly music: number; readonly effects: number };
};

export type SaveV1 = {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  readonly slotId: SaveSlotId;
  readonly metadata: SaveMetadata;
  readonly player: SavePlayerState;
  readonly inventory: Readonly<Record<string, number>>;
  readonly equippedCharms: readonly string[];
  readonly unlockedAbilities: readonly string[];
  readonly bindings: Readonly<Record<string, string>>;
  readonly settings: SaveSettings;
  readonly questStages: Readonly<Record<string, string>>;
  readonly questFlags: readonly string[];
  readonly defeatedBossIds: readonly string[];
  readonly openedChestIds: readonly string[];
  readonly activatedShortcutIds: readonly string[];
  readonly solvedPuzzleIds: readonly string[];
  readonly claimedDiscoveryIds: readonly string[];
  readonly discoveredRoomIds: readonly string[];
};

export type SaveEnvelope = {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  readonly savedAt: number;
  readonly save: SaveV1;
  readonly checksum: string;
};

export type SaveValidationError = { readonly path: string; readonly message: string };

export type SaveValidationResult =
  | { readonly ok: true; readonly save: SaveV1 }
  | { readonly ok: false; readonly errors: readonly SaveValidationError[] };

export type SaveEnvelopeValidationResult =
  | { readonly ok: true; readonly envelope: SaveEnvelope }
  | { readonly ok: false; readonly errors: readonly SaveValidationError[] };

type UnknownRecord = Record<string, unknown>;

const DEFAULT_SETTINGS: SaveSettings = {
  subtitles: true,
  reducedMotion: false,
  textScale: 1,
  highContrastPrompts: false,
  screenShake: 1,
  screenFlash: 1,
  damageNumbers: true,
  holdToToggle: false,
  audio: { master: 1, music: 1, effects: 1 }
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStableId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

const isFiniteNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isFiniteNonNegativeInteger = (value: unknown): value is number =>
  isFiniteNonNegativeNumber(value) && Number.isSafeInteger(value);

const error = (errors: SaveValidationError[], path: string, message: string): void => {
  errors.push({ path, message });
};

const readOptionalBoolean = (
  source: UnknownRecord,
  key: string,
  fallback: boolean,
  errors: SaveValidationError[],
  path: string
): boolean => {
  const value = source[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') error(errors, path, 'must be a boolean');
  return typeof value === 'boolean' ? value : fallback;
};

const readOptionalRatio = (
  source: UnknownRecord,
  key: string,
  fallback: number,
  errors: SaveValidationError[],
  path: string
): number => {
  const value = source[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    error(errors, path, 'must be a finite number from 0 to 1');
    return fallback;
  }
  return value;
};

const readOptionalScale = (
  source: UnknownRecord,
  key: string,
  fallback: number,
  errors: SaveValidationError[],
  path: string
): number => {
  const value = source[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    error(errors, path, 'must be a finite number greater than zero');
    return fallback;
  }
  return value;
};

const readStableIdArray = (
  value: unknown,
  fallback: readonly string[],
  errors: SaveValidationError[],
  path: string
): readonly string[] => {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || !value.every(isStableId)) {
    error(errors, path, 'must be an array of lowercase kebab-case IDs');
    return fallback;
  }
  return [...new Set(value)];
};

const readStringRecord = (
  value: unknown,
  fallback: Readonly<Record<string, string>>,
  errors: SaveValidationError[],
  path: string
): Readonly<Record<string, string>> => {
  if (value === undefined) return fallback;
  if (
    !isRecord(value) ||
    !Object.entries(value).every(([key, entry]) => isStableId(key) && typeof entry === 'string')
  ) {
    error(errors, path, 'must be a record with lowercase kebab-case keys and string values');
    return fallback;
  }
  return { ...value } as Readonly<Record<string, string>>;
};

const readNumberRecord = (
  value: unknown,
  fallback: Readonly<Record<string, number>>,
  errors: SaveValidationError[],
  path: string
): Readonly<Record<string, number>> => {
  if (value === undefined) return fallback;
  if (
    !isRecord(value) ||
    !Object.entries(value).every(
      ([key, entry]) => isStableId(key) && isFiniteNonNegativeInteger(entry)
    )
  ) {
    error(
      errors,
      path,
      'must be a record with lowercase kebab-case keys and non-negative integer values'
    );
    return fallback;
  }
  return { ...value } as Readonly<Record<string, number>>;
};

export const isSaveSlotId = (value: unknown): value is SaveSlotId =>
  typeof value === 'string' && (SAVE_SLOT_IDS as readonly string[]).includes(value);

export function createDefaultSave(slotId: SaveSlotId, now = Date.now()): SaveV1 {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    slotId,
    metadata: {
      createdAt: now,
      updatedAt: now,
      playtimeSeconds: 0,
      areaId: 'wrens-rest',
      safePosition: { x: 0, y: 0 }
    },
    player: {
      health: 100,
      mana: 50,
      healthUpgrades: 0,
      manaUpgrades: 0,
      xp: 0,
      currency: 0,
      weaponLevel: 1,
      spellLevels: {}
    },
    inventory: {},
    equippedCharms: [],
    unlockedAbilities: ['lumen-bolt'],
    bindings: {},
    settings: { ...DEFAULT_SETTINGS, audio: { ...DEFAULT_SETTINGS.audio } },
    questStages: {},
    questFlags: [],
    defeatedBossIds: [],
    openedChestIds: [],
    activatedShortcutIds: [],
    solvedPuzzleIds: [],
    claimedDiscoveryIds: [],
    discoveredRoomIds: []
  };
}

export function validateSave(candidate: unknown): SaveValidationResult {
  const errors: SaveValidationError[] = [];
  if (!isRecord(candidate))
    return { ok: false, errors: [{ path: '$', message: 'must be an object' }] };

  if (candidate.schemaVersion !== SAVE_SCHEMA_VERSION) {
    error(errors, 'schemaVersion', 'must be schema version 1');
  }
  if (!isSaveSlotId(candidate.slotId))
    error(errors, 'slotId', 'must be one of the three save slots');

  const metadata = isRecord(candidate.metadata) ? candidate.metadata : undefined;
  if (metadata === undefined) error(errors, 'metadata', 'must be an object');
  const player = isRecord(candidate.player) ? candidate.player : undefined;
  if (player === undefined) error(errors, 'player', 'must be an object');

  const createdAt = metadata?.createdAt;
  const updatedAt = metadata?.updatedAt;
  const playtimeSeconds = metadata?.playtimeSeconds;
  const areaId = metadata?.areaId;
  const safePosition = isRecord(metadata?.safePosition) ? metadata.safePosition : undefined;
  if (!isFiniteNonNegativeInteger(createdAt))
    error(errors, 'metadata.createdAt', 'must be a non-negative integer');
  if (!isFiniteNonNegativeInteger(updatedAt))
    error(errors, 'metadata.updatedAt', 'must be a non-negative integer');
  if (!isFiniteNonNegativeInteger(playtimeSeconds))
    error(errors, 'metadata.playtimeSeconds', 'must be a non-negative integer');
  if (!isStableId(areaId)) error(errors, 'metadata.areaId', 'must be a lowercase kebab-case ID');
  if (metadata?.checkpointId !== undefined && !isStableId(metadata.checkpointId)) {
    error(errors, 'metadata.checkpointId', 'must be a lowercase kebab-case ID');
  }
  if (safePosition === undefined) error(errors, 'metadata.safePosition', 'must be an object');
  if (!isFiniteNonNegativeNumber(safePosition?.x))
    error(errors, 'metadata.safePosition.x', 'must be a finite non-negative number');
  if (!isFiniteNonNegativeNumber(safePosition?.y))
    error(errors, 'metadata.safePosition.y', 'must be a finite non-negative number');

  const health = player?.health;
  const mana = player?.mana;
  const currency = player?.currency;
  const weaponLevel = player?.weaponLevel;
  if (!isFiniteNonNegativeNumber(health))
    error(errors, 'player.health', 'must be a finite non-negative number');
  if (!isFiniteNonNegativeNumber(mana))
    error(errors, 'player.mana', 'must be a finite non-negative number');
  if (!isFiniteNonNegativeInteger(currency))
    error(errors, 'player.currency', 'must be a non-negative integer');
  if (!isFiniteNonNegativeInteger(weaponLevel) || weaponLevel === 0)
    error(errors, 'player.weaponLevel', 'must be a positive integer');

  const healthUpgrades = player?.healthUpgrades ?? 0;
  const manaUpgrades = player?.manaUpgrades ?? 0;
  const xp = player?.xp ?? 0;
  if (!isFiniteNonNegativeInteger(healthUpgrades))
    error(errors, 'player.healthUpgrades', 'must be a non-negative integer');
  if (!isFiniteNonNegativeInteger(manaUpgrades))
    error(errors, 'player.manaUpgrades', 'must be a non-negative integer');
  if (!isFiniteNonNegativeInteger(xp)) error(errors, 'player.xp', 'must be a non-negative integer');

  const settingsSource = isRecord(candidate.settings) ? candidate.settings : {};
  if (candidate.settings !== undefined && !isRecord(candidate.settings))
    error(errors, 'settings', 'must be an object');
  const audioSource = isRecord(settingsSource.audio) ? settingsSource.audio : {};
  if (settingsSource.audio !== undefined && !isRecord(settingsSource.audio))
    error(errors, 'settings.audio', 'must be an object');
  const settings: SaveSettings = {
    subtitles: readOptionalBoolean(
      settingsSource,
      'subtitles',
      DEFAULT_SETTINGS.subtitles,
      errors,
      'settings.subtitles'
    ),
    reducedMotion: readOptionalBoolean(
      settingsSource,
      'reducedMotion',
      DEFAULT_SETTINGS.reducedMotion,
      errors,
      'settings.reducedMotion'
    ),
    textScale: readOptionalScale(
      settingsSource,
      'textScale',
      DEFAULT_SETTINGS.textScale,
      errors,
      'settings.textScale'
    ),
    highContrastPrompts: readOptionalBoolean(
      settingsSource,
      'highContrastPrompts',
      DEFAULT_SETTINGS.highContrastPrompts,
      errors,
      'settings.highContrastPrompts'
    ),
    screenShake: readOptionalRatio(
      settingsSource,
      'screenShake',
      DEFAULT_SETTINGS.screenShake,
      errors,
      'settings.screenShake'
    ),
    screenFlash: readOptionalRatio(
      settingsSource,
      'screenFlash',
      DEFAULT_SETTINGS.screenFlash,
      errors,
      'settings.screenFlash'
    ),
    damageNumbers: readOptionalBoolean(
      settingsSource,
      'damageNumbers',
      DEFAULT_SETTINGS.damageNumbers,
      errors,
      'settings.damageNumbers'
    ),
    holdToToggle: readOptionalBoolean(
      settingsSource,
      'holdToToggle',
      DEFAULT_SETTINGS.holdToToggle,
      errors,
      'settings.holdToToggle'
    ),
    audio: {
      master: readOptionalRatio(
        audioSource,
        'master',
        DEFAULT_SETTINGS.audio.master,
        errors,
        'settings.audio.master'
      ),
      music: readOptionalRatio(
        audioSource,
        'music',
        DEFAULT_SETTINGS.audio.music,
        errors,
        'settings.audio.music'
      ),
      effects: readOptionalRatio(
        audioSource,
        'effects',
        DEFAULT_SETTINGS.audio.effects,
        errors,
        'settings.audio.effects'
      )
    }
  };

  const inventory = readNumberRecord(candidate.inventory, {}, errors, 'inventory');
  const spellLevels = readNumberRecord(player?.spellLevels, {}, errors, 'player.spellLevels');
  const bindings = readStringRecord(candidate.bindings, {}, errors, 'bindings');
  const questStages = readStringRecord(candidate.questStages, {}, errors, 'questStages');
  const equippedCharms = readStableIdArray(candidate.equippedCharms, [], errors, 'equippedCharms');
  const unlockedAbilities = readStableIdArray(
    candidate.unlockedAbilities,
    [],
    errors,
    'unlockedAbilities'
  );
  const questFlags = readStableIdArray(candidate.questFlags, [], errors, 'questFlags');
  const defeatedBossIds = readStableIdArray(
    candidate.defeatedBossIds,
    [],
    errors,
    'defeatedBossIds'
  );
  const openedChestIds = readStableIdArray(candidate.openedChestIds, [], errors, 'openedChestIds');
  const activatedShortcutIds = readStableIdArray(
    candidate.activatedShortcutIds,
    [],
    errors,
    'activatedShortcutIds'
  );
  const solvedPuzzleIds = readStableIdArray(
    candidate.solvedPuzzleIds,
    [],
    errors,
    'solvedPuzzleIds'
  );
  const claimedDiscoveryIds = readStableIdArray(
    candidate.claimedDiscoveryIds,
    [],
    errors,
    'claimedDiscoveryIds'
  );
  const discoveredRoomIds = readStableIdArray(
    candidate.discoveredRoomIds,
    [],
    errors,
    'discoveredRoomIds'
  );

  if (
    errors.length > 0 ||
    metadata === undefined ||
    player === undefined ||
    safePosition === undefined ||
    !isSaveSlotId(candidate.slotId) ||
    !isStableId(areaId) ||
    !isFiniteNonNegativeInteger(createdAt) ||
    !isFiniteNonNegativeInteger(updatedAt) ||
    !isFiniteNonNegativeInteger(playtimeSeconds) ||
    !isFiniteNonNegativeNumber(safePosition.x) ||
    !isFiniteNonNegativeNumber(safePosition.y) ||
    !isFiniteNonNegativeNumber(health) ||
    !isFiniteNonNegativeNumber(mana) ||
    !isFiniteNonNegativeInteger(currency) ||
    !isFiniteNonNegativeInteger(weaponLevel) ||
    weaponLevel === 0 ||
    !isFiniteNonNegativeInteger(healthUpgrades) ||
    !isFiniteNonNegativeInteger(manaUpgrades) ||
    !isFiniteNonNegativeInteger(xp)
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    save: {
      schemaVersion: SAVE_SCHEMA_VERSION,
      slotId: candidate.slotId,
      metadata: {
        createdAt,
        updatedAt,
        playtimeSeconds,
        areaId,
        ...(isStableId(metadata.checkpointId) ? { checkpointId: metadata.checkpointId } : {}),
        safePosition: { x: safePosition.x, y: safePosition.y }
      },
      player: {
        health,
        mana,
        healthUpgrades,
        manaUpgrades,
        xp,
        currency,
        weaponLevel,
        spellLevels
      },
      inventory,
      equippedCharms,
      unlockedAbilities,
      bindings,
      settings,
      questStages,
      questFlags,
      defeatedBossIds,
      openedChestIds,
      activatedShortcutIds,
      solvedPuzzleIds,
      claimedDiscoveryIds,
      discoveredRoomIds
    }
  };
}

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'number')
    return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(',')}}`;
  }
  throw new TypeError('Save envelopes can contain JSON values only.');
};

const checksum = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const envelopeChecksum = (savedAt: number, save: SaveV1): string =>
  checksum(canonicalize({ schemaVersion: SAVE_SCHEMA_VERSION, savedAt, save }));

export function createSaveEnvelope(save: SaveV1, savedAt = Date.now()): SaveEnvelope {
  const validation = validateSave(save);
  if (!validation.ok)
    throw new TypeError(
      `Cannot envelope invalid save: ${validation.errors[0]?.path ?? 'unknown error'}`
    );
  if (!isFiniteNonNegativeInteger(savedAt))
    throw new RangeError('Save envelope timestamps must be non-negative integers.');
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt,
    save: validation.save,
    checksum: envelopeChecksum(savedAt, validation.save)
  };
}

export function validateSaveEnvelope(candidate: unknown): SaveEnvelopeValidationResult {
  if (!isRecord(candidate))
    return { ok: false, errors: [{ path: '$', message: 'must be an object' }] };
  const errors: SaveValidationError[] = [];
  if (candidate.schemaVersion !== SAVE_SCHEMA_VERSION)
    error(errors, 'schemaVersion', 'must be schema version 1');
  if (!isFiniteNonNegativeInteger(candidate.savedAt))
    error(errors, 'savedAt', 'must be a non-negative integer');
  if (typeof candidate.checksum !== 'string') error(errors, 'checksum', 'must be a string');
  const saveResult = validateSave(candidate.save);
  if (!saveResult.ok)
    errors.push(...saveResult.errors.map((entry) => ({ ...entry, path: `save.${entry.path}` })));
  if (
    errors.length > 0 ||
    !saveResult.ok ||
    !isFiniteNonNegativeInteger(candidate.savedAt) ||
    typeof candidate.checksum !== 'string'
  )
    return { ok: false, errors };
  if (candidate.checksum !== envelopeChecksum(candidate.savedAt, saveResult.save))
    return {
      ok: false,
      errors: [{ path: 'checksum', message: 'does not match the saved payload' }]
    };
  return {
    ok: true,
    envelope: {
      schemaVersion: SAVE_SCHEMA_VERSION,
      savedAt: candidate.savedAt,
      save: saveResult.save,
      checksum: candidate.checksum
    }
  };
}
