import { isStableId, questFlagId, stableId } from '../core/StableId';
import type { AbilityId, ItemId, QuestFlagId, StableId } from '../core/StableId';
import { ABILITIES } from '../data/abilities';
import { deepFreeze, immutableClone } from '../data/immutability';
import { ITEMS } from '../data/items';
import { QUESTS } from '../data/quests';
import { QuestStore } from '../quests/QuestStore';
import { validateSaveV1 } from '../saves/SaveSchema';
import type {
  BossId,
  ChestId,
  DiscoveryId,
  PuzzleId,
  RoomId,
  SaveV1,
  ShortcutId,
} from '../saves/SaveSchema';

export type ProgressionCommand =
  | Readonly<{ kind: 'set-fact'; factId: QuestFlagId }>
  | Readonly<{ kind: 'grant-item'; itemId: ItemId; quantity: number }>
  | Readonly<{ kind: 'consume-item'; itemId: ItemId; quantity: number }>
  | Readonly<{ kind: 'grant-currency'; amount: number }>
  | Readonly<{ kind: 'spend-currency'; amount: number }>
  | Readonly<{ kind: 'grant-xp'; amount: number }>
  | Readonly<{ kind: 'unlock-ability'; abilityId: AbilityId }>
  | Readonly<{ kind: 'increase-health'; amount: number }>
  | Readonly<{ kind: 'increase-mana'; amount: number }>
  | Readonly<{ kind: 'upgrade-weapon'; fromLevel: number; toLevel: number }>
  | Readonly<{ kind: 'open-chest'; chestId: ChestId }>
  | Readonly<{ kind: 'activate-shortcut'; shortcutId: ShortcutId }>
  | Readonly<{ kind: 'solve-puzzle'; puzzleId: PuzzleId }>
  | Readonly<{ kind: 'discover-room'; roomId: RoomId }>
  | Readonly<{ kind: 'claim-discovery'; discoveryId: DiscoveryId }>
  | Readonly<{ kind: 'defeat-boss'; bossId: BossId }>
  | Readonly<{ kind: 'rest' }>;

export type ProgressionTransaction = Readonly<{ commands: readonly ProgressionCommand[] }>;

export type ProgressionEvent = Readonly<{
  kind:
    | 'fact-set'
    | 'quest-advanced'
    | 'item-granted'
    | 'item-consumed'
    | 'currency-granted'
    | 'currency-spent'
    | 'xp-granted'
    | 'ability-unlocked'
    | 'health-increased'
    | 'mana-increased'
    | 'weapon-upgraded'
    | 'world-progress-added'
    | 'restored';
  id: string | null;
  amount: number | null;
}>;

export type ProgressionRejectReason =
  | 'invalid-save'
  | 'invalid-command'
  | 'unknown-item'
  | 'unknown-ability'
  | 'unknown-quest-state'
  | 'missing-prerequisite'
  | 'insufficient-item'
  | 'insufficient-currency'
  | 'stack-full'
  | 'weapon-level-mismatch';

export type ProgressionResult =
  | Readonly<{ kind: 'accepted'; save: SaveV1; events: readonly ProgressionEvent[] }>
  | Readonly<{ kind: 'unchanged'; save: SaveV1; events: readonly [] }>
  | Readonly<{
      kind: 'rejected';
      reason: ProgressionRejectReason;
      save: SaveV1;
      events: readonly [];
    }>;

export type ProgressionRewardId =
  | 'aegis-veil'
  | 'lost-folio'
  | 'lanterns-for-the-absent'
  | 'heart-petal'
  | 'wellspring-seed'
  | 'blade-reforge';

const KNOWN_FACTS = QUESTS.flatMap(({ declaredFacts }) => declaredFacts);
const QUEST_DEFINITIONS = QUESTS.map(({ definition }) => definition);
const EMPTY_EVENTS = Object.freeze([]) as readonly [];

export function applyProgressionTransaction(
  original: SaveV1,
  transaction: ProgressionTransaction,
): ProgressionResult {
  const syntactic = validateSaveV1(original);
  if (syntactic.kind === 'invalid') return rejected(original, 'invalid-save');
  if (!Array.isArray(transaction.commands)) return rejected(original, 'invalid-command');

  let questStore: QuestStore;
  try {
    questStore = QuestStore.hydrate(QUEST_DEFINITIONS, syntactic.value.quests, KNOWN_FACTS);
  } catch {
    return rejected(original, 'unknown-quest-state');
  }

  let candidate: SaveV1 = {
    ...syntactic.value,
    quests: questStore.snapshot(),
  };
  const events: ProgressionEvent[] = [];
  let changed = !sameQuestSnapshot(candidate.quests, syntactic.value.quests);

  for (const command of transaction.commands) {
    const outcome = applyCommand(candidate, command, questStore);
    if (outcome.kind === 'rejected') return rejected(original, outcome.reason);
    candidate = outcome.save;
    if (outcome.events.length > 0) {
      changed = true;
      events.push(...outcome.events);
    }
  }

  const finalValidation = validateSaveV1(candidate);
  if (finalValidation.kind === 'invalid') return rejected(original, 'invalid-command');
  if (!changed) return unchanged(original);

  return deepFreeze({
    kind: 'accepted',
    save: immutableClone(finalValidation.value),
    events,
  });
}

export function claimProgressionReward(
  save: SaveV1,
  rewardId: ProgressionRewardId,
): ProgressionResult {
  const prepared = applyProgressionTransaction(save, { commands: [] });
  if (prepared.kind === 'rejected') return prepared;
  const reward = rewardTransaction(rewardId);
  if (prepared.save.quests.flags.includes(reward.ledgerFactId)) {
    return prepared.kind === 'accepted' ? prepared : unchanged(prepared.save);
  }
  if (!reward.requiresFacts.every((factId) => prepared.save.quests.flags.includes(factId))) {
    return rejected(save, 'missing-prerequisite');
  }
  return applyProgressionTransaction(prepared.save, { commands: reward.commands });
}

function rewardTransaction(rewardId: ProgressionRewardId): Readonly<{
  ledgerFactId: QuestFlagId;
  requiresFacts: readonly QuestFlagId[];
  commands: readonly ProgressionCommand[];
}> {
  switch (rewardId) {
    case 'aegis-veil':
      return reward('aegis-veil-learned', [
        { kind: 'unlock-ability', abilityId: stableId<'ability'>('aegis-veil') },
        { kind: 'grant-xp', amount: 40 },
      ]);
    case 'lost-folio':
      return reward('cartographers-folio-returned', [
        { kind: 'set-fact', factId: questFlagId('cartographers-folio-found') },
        { kind: 'consume-item', itemId: stableId<'item'>('cartographers-folio'), quantity: 1 },
        { kind: 'grant-item', itemId: stableId<'item'>('quiet-step'), quantity: 1 },
        { kind: 'grant-xp', amount: 60 },
        { kind: 'grant-currency', amount: 25 },
      ]);
    case 'lanterns-for-the-absent':
      return reward(
        'lanterns-for-the-absent-complete',
        [
          { kind: 'increase-mana', amount: 8 },
          { kind: 'grant-xp', amount: 80 },
        ],
        [
          questFlagId('absent-lantern-trail-lit'),
          questFlagId('absent-lantern-hollows-lit'),
          questFlagId('absent-lantern-reliquary-lit'),
        ],
      );
    case 'heart-petal':
      return reward('heart-petal-claimed', [{ kind: 'increase-health', amount: 20 }]);
    case 'wellspring-seed':
      return reward('wellspring-seed-claimed', [{ kind: 'increase-mana', amount: 8 }]);
    case 'blade-reforge':
      return reward('surveyor-edge-reforged', [
        { kind: 'consume-item', itemId: stableId<'item'>('briar-core'), quantity: 1 },
        { kind: 'upgrade-weapon', fromLevel: 0, toLevel: 1 },
      ]);
  }
}

function reward(
  ledgerFact: string,
  commands: readonly ProgressionCommand[],
  requiresFacts: readonly QuestFlagId[] = [],
): Readonly<{
  ledgerFactId: QuestFlagId;
  requiresFacts: readonly QuestFlagId[];
  commands: readonly ProgressionCommand[];
}> {
  const ledgerFactId = questFlagId(ledgerFact);
  return {
    ledgerFactId,
    requiresFacts,
    commands: [...commands, { kind: 'set-fact', factId: ledgerFactId }],
  };
}

type CommandOutcome =
  | Readonly<{ kind: 'accepted'; save: SaveV1; events: readonly ProgressionEvent[] }>
  | Readonly<{ kind: 'rejected'; reason: ProgressionRejectReason }>;

function applyCommand(
  save: SaveV1,
  command: ProgressionCommand,
  quests: QuestStore,
): CommandOutcome {
  if (command === null || typeof command !== 'object' || !('kind' in command)) {
    return { kind: 'rejected', reason: 'invalid-command' };
  }
  switch (command.kind) {
    case 'set-fact': {
      if (!KNOWN_FACTS.includes(command.factId))
        return { kind: 'rejected', reason: 'invalid-command' };
      if (save.quests.flags.includes(command.factId)) return acceptedCommand(save);
      let transitions;
      try {
        transitions = quests.apply({ factId: command.factId });
      } catch {
        return { kind: 'rejected', reason: 'unknown-quest-state' };
      }
      return acceptedCommand({ ...save, quests: quests.snapshot() }, [
        event('fact-set', command.factId),
        ...transitions.map(({ questId }) => event('quest-advanced', questId)),
      ]);
    }
    case 'grant-item': {
      if (!validPositive(command.quantity) || !isStableId(command.itemId)) return invalid();
      const definition = ITEMS.find(({ itemId }) => itemId === command.itemId);
      if (definition === undefined) return { kind: 'rejected', reason: 'unknown-item' };
      const current = quantityOf(save, command.itemId);
      if (command.quantity > definition.maxStack - current) {
        return { kind: 'rejected', reason: 'stack-full' };
      }
      return acceptedCommand(
        { ...save, inventory: setQuantity(save, command.itemId, current + command.quantity) },
        [event('item-granted', command.itemId, command.quantity)],
      );
    }
    case 'consume-item': {
      if (!validPositive(command.quantity) || !isStableId(command.itemId)) return invalid();
      if (!ITEMS.some(({ itemId }) => itemId === command.itemId)) {
        return { kind: 'rejected', reason: 'unknown-item' };
      }
      const current = quantityOf(save, command.itemId);
      if (current < command.quantity) return { kind: 'rejected', reason: 'insufficient-item' };
      return acceptedCommand(
        { ...save, inventory: setQuantity(save, command.itemId, current - command.quantity) },
        [event('item-consumed', command.itemId, command.quantity)],
      );
    }
    case 'grant-currency':
      return grantPlayerNumber(save, 'currency', command.amount, 'currency-granted');
    case 'spend-currency': {
      if (!validPositive(command.amount)) return invalid();
      if (save.player.currency < command.amount) {
        return { kind: 'rejected', reason: 'insufficient-currency' };
      }
      return acceptedCommand(
        { ...save, player: { ...save.player, currency: save.player.currency - command.amount } },
        [event('currency-spent', null, command.amount)],
      );
    }
    case 'grant-xp':
      return grantPlayerNumber(save, 'experience', command.amount, 'xp-granted');
    case 'unlock-ability': {
      if (!ABILITIES.some(({ abilityId }) => abilityId === command.abilityId)) {
        return { kind: 'rejected', reason: 'unknown-ability' };
      }
      if (save.player.unlockedAbilities.includes(command.abilityId)) return acceptedCommand(save);
      return acceptedCommand(
        {
          ...save,
          player: {
            ...save.player,
            unlockedAbilities: sortedUnique([...save.player.unlockedAbilities, command.abilityId]),
          },
        },
        [event('ability-unlocked', command.abilityId)],
      );
    }
    case 'increase-health':
      return increaseResource(save, 'health', command.amount);
    case 'increase-mana':
      return increaseResource(save, 'mana', command.amount);
    case 'upgrade-weapon': {
      if (
        !validNonNegative(command.fromLevel) ||
        !validNonNegative(command.toLevel) ||
        command.toLevel !== command.fromLevel + 1
      )
        return invalid();
      if (save.player.weaponLevel !== command.fromLevel) {
        return { kind: 'rejected', reason: 'weapon-level-mismatch' };
      }
      return acceptedCommand(
        { ...save, player: { ...save.player, weaponLevel: command.toLevel } },
        [event('weapon-upgraded', null, command.toLevel)],
      );
    }
    case 'open-chest':
      return addWorldId(save, 'openedChests', command.chestId);
    case 'activate-shortcut':
      return addWorldId(save, 'activatedShortcuts', command.shortcutId);
    case 'solve-puzzle':
      return addWorldId(save, 'solvedPuzzles', command.puzzleId);
    case 'discover-room':
      return addWorldId(save, 'discoveredRooms', command.roomId);
    case 'claim-discovery':
      return addWorldId(save, 'claimedDiscoveries', command.discoveryId);
    case 'defeat-boss':
      return addWorldId(save, 'defeatedBosses', command.bossId);
    case 'rest': {
      if (
        save.player.currentHealth === save.player.baseStats.maxHealth &&
        save.player.currentMana === save.player.baseStats.maxMana
      )
        return acceptedCommand(save);
      return acceptedCommand(
        {
          ...save,
          player: {
            ...save.player,
            currentHealth: save.player.baseStats.maxHealth,
            currentMana: save.player.baseStats.maxMana,
          },
        },
        [event('restored', null)],
      );
    }
  }
}

function grantPlayerNumber(
  save: SaveV1,
  key: 'currency' | 'experience',
  amount: number,
  kind: 'currency-granted' | 'xp-granted',
): CommandOutcome {
  if (!validPositive(amount)) return invalid();
  return acceptedCommand(
    { ...save, player: { ...save.player, [key]: safeAdd(save.player[key], amount) } },
    [event(kind, null, amount)],
  );
}

function increaseResource(
  save: SaveV1,
  resource: 'health' | 'mana',
  amount: number,
): CommandOutcome {
  if (!validPositive(amount)) return invalid();
  const maxKey = resource === 'health' ? 'maxHealth' : 'maxMana';
  const currentKey = resource === 'health' ? 'currentHealth' : 'currentMana';
  const upgradesKey = resource === 'health' ? 'healthUpgrades' : 'manaUpgrades';
  const maximum = safeAdd(save.player.baseStats[maxKey], amount);
  return acceptedCommand(
    {
      ...save,
      player: {
        ...save.player,
        baseStats: { ...save.player.baseStats, [maxKey]: maximum },
        [currentKey]: Math.min(maximum, safeAdd(save.player[currentKey], amount)),
        [upgradesKey]: safeAdd(save.player[upgradesKey], 1),
      },
    },
    [event(resource === 'health' ? 'health-increased' : 'mana-increased', null, amount)],
  );
}

type WorldListKey = keyof SaveV1['worldProgress'];

function addWorldId(save: SaveV1, key: WorldListKey, id: StableId<string>): CommandOutcome {
  if (!isStableId(id)) return invalid();
  const existing = save.worldProgress[key];
  if (existing.includes(id as never)) return acceptedCommand(save);
  return acceptedCommand(
    {
      ...save,
      worldProgress: {
        ...save.worldProgress,
        [key]: sortedUnique([...existing, id]),
      },
    } as SaveV1,
    [event('world-progress-added', id)],
  );
}

function acceptedCommand(save: SaveV1, events: readonly ProgressionEvent[] = []): CommandOutcome {
  return { kind: 'accepted', save, events };
}

function invalid(): CommandOutcome {
  return { kind: 'rejected', reason: 'invalid-command' };
}

function rejected(save: SaveV1, reason: ProgressionRejectReason): ProgressionResult {
  return deepFreeze({
    kind: 'rejected',
    reason,
    save: immutableClone(save),
    events: EMPTY_EVENTS,
  });
}

function unchanged(save: SaveV1): ProgressionResult {
  return deepFreeze({
    kind: 'unchanged',
    save: immutableClone(save),
    events: EMPTY_EVENTS,
  });
}

function event(
  kind: ProgressionEvent['kind'],
  id: string | null,
  amount: number | null = null,
): ProgressionEvent {
  return { kind, id, amount };
}

function quantityOf(save: SaveV1, itemId: ItemId): number {
  return save.inventory.find((entry) => entry.itemId === itemId)?.quantity ?? 0;
}

function setQuantity(save: SaveV1, itemId: ItemId, quantity: number): SaveV1['inventory'] {
  return save.inventory
    .filter((entry) => entry.itemId !== itemId)
    .concat(quantity > 0 ? [{ itemId, quantity }] : [])
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function sortedUnique<Value extends string>(values: readonly Value[]): readonly Value[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function safeAdd(left: number, right: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, left + right);
}

function validPositive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validNonNegative(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function sameQuestSnapshot(left: SaveV1['quests'], right: SaveV1['quests']): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
