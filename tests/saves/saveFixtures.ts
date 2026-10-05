export function rawSaveV1() {
  return {
    schemaVersion: 1,
    metadata: {
      createdAtEpochMs: 1_700_000_000_000,
      snapshotAtEpochMs: 1_700_000_030_000,
      playTimeMs: 30_000,
    },
    location: {
      regionId: 'brackenreach',
      areaId: 'wren-rest',
      checkpointId: 'village-well',
      safePosition: { x: 144.5, y: -32 },
    },
    player: {
      baseStats: {
        maxHealth: 100,
        maxMana: 40,
        attackPower: 12,
        armour: 3,
      },
      currentHealth: 87,
      currentMana: 19,
      healthUpgrades: 2,
      manaUpgrades: 1,
      experience: 450,
      currency: 73,
      weaponLevel: 2,
      spellLevels: [
        { abilityId: 'bramble-bolt', level: 1 },
        { abilityId: 'moth-glimmer', level: 3 },
      ],
      unlockedAbilities: ['bramble-bolt', 'moth-glimmer'],
    },
    inventory: [
      { itemId: 'amber-vial', quantity: 2 },
      { itemId: 'rootglass-shard', quantity: 5 },
    ],
    equipment: [
      { slot: 'charm', itemId: 'moth-charm' },
      { slot: 'weapon', itemId: 'thorn-blade' },
    ],
    quests: {
      stages: [
        { questId: 'hollow-song', stageId: 'seek-reliquary' },
        { questId: 'lost-lantern', stageId: 'return-lantern' },
      ],
      flags: ['heard-root-song', 'opened-bracken-gate'],
    },
    worldProgress: {
      defeatedBosses: ['choir-warden'],
      openedChests: ['bracken-cache', 'well-chest'],
      activatedShortcuts: ['hollows-lift'],
      solvedPuzzles: ['rootglass-chimes'],
      discoveredRooms: ['reliquary-antechamber'],
      claimedDiscoveries: ['moth-mural'],
    },
    bindingOverrides: [
      {
        actionId: 'attack-light',
        bindings: [
          { kind: 'keyboard', code: 'KeyJ' },
          { kind: 'gamepad-button', button: 2 },
        ],
      },
      {
        actionId: 'move-left',
        bindings: [{ kind: 'gamepad-axis', axis: 0, direction: -1 }],
      },
    ],
    settings: {
      difficulty: 'standard',
      reducedMotion: false,
      shakeIntensity: 0.75,
      flashIntensity: 0.5,
      subtitles: true,
      textScale: 1.25,
      highContrastPrompts: true,
      damageNumbers: false,
      sustainedAction: 'toggle',
      masterVolume: 0.9,
      musicVolume: 0.8,
      sfxVolume: 0.7,
      ambienceVolume: 0.6,
      muteWhenUnfocused: false,
    },
  };
}

export function rawSaveV0() {
  const current = rawSaveV1();
  const metadata = { ...current.metadata };
  const withoutPreferences = { ...current };
  Reflect.deleteProperty(metadata, 'playTimeMs');
  Reflect.deleteProperty(withoutPreferences, 'bindingOverrides');
  Reflect.deleteProperty(withoutPreferences, 'settings');

  return {
    ...withoutPreferences,
    schemaVersion: 0,
    metadata: {
      ...metadata,
      playTimeSeconds: 30,
    },
  };
}
