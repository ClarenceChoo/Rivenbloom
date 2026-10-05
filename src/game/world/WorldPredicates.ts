import { isStableId, stableId } from '../core/StableId';
import { ABILITIES } from '../data/abilities';
import { ACTORS } from '../data/actors';
import { ITEMS } from '../data/items';
import { deepFreeze } from '../data/immutability';
import { QUESTS } from '../data/quests';
import type { WorldPredicate } from '../data/types';
import { validateSaveV1 } from '../saves/SaveSchema';
import type { SaveV1 } from '../saves/SaveSchema';

const EMPTY = Object.freeze([]);

export const WORLD_ALWAYS: WorldPredicate = deepFreeze({
  requiresFacts: EMPTY,
  excludesFacts: EMPTY,
  requiresAbilities: EMPTY,
  requiresItems: EMPTY,
  requiresSolvedPuzzles: EMPTY,
  requiresActivatedShortcuts: EMPTY,
  requiresDefeatedBosses: EMPTY,
  excludesDefeatedBosses: EMPTY,
});

const KNOWN_FACTS = new Set(QUESTS.flatMap(({ declaredFacts }) => declaredFacts));
const KNOWN_ABILITIES = new Set(ABILITIES.map(({ abilityId }) => abilityId));
const KNOWN_ITEMS = new Set(ITEMS.map(({ itemId }) => itemId));
const KNOWN_PUZZLES = new Set([
  stableId<'puzzle'>('hollows-dash-circuit'),
  stableId<'puzzle'>('vestibule-index-seal'),
  stableId<'puzzle'>('reliquary-forge-awakening'),
  stableId<'puzzle'>('east-lens-alignment'),
  stableId<'puzzle'>('gallery-choir-seal'),
]);
const KNOWN_SHORTCUTS = new Set([
  stableId<'shortcut'>('listening-arch-homeward-route'),
  stableId<'shortcut'>('split-cedar-root-knot-open'),
  stableId<'shortcut'>('flooded-stacks-silt-wall-open'),
]);
const KNOWN_BOSSES = new Set(
  ACTORS.filter((actor) => actor.kind === 'boss').map(({ bossId }) => bossId),
);

export function matchesWorldPredicate(predicate: WorldPredicate, save: SaveV1): boolean {
  if (!validPredicate(predicate)) return false;
  const validated = validateSaveV1(save);
  if (validated.kind === 'invalid') return false;
  const value = validated.value;
  const flags = new Set(value.quests.flags);
  const abilities = new Set(value.player.unlockedAbilities);
  const solvedPuzzles = new Set(value.worldProgress.solvedPuzzles);
  const shortcuts = new Set(value.worldProgress.activatedShortcuts);
  const bosses = new Set(value.worldProgress.defeatedBosses);

  return (
    predicate.requiresFacts.every((id) => flags.has(id)) &&
    predicate.excludesFacts.every((id) => !flags.has(id)) &&
    predicate.requiresAbilities.every((id) => abilities.has(id)) &&
    predicate.requiresItems.every(
      ({ itemId, quantity }) =>
        (value.inventory.find((entry) => entry.itemId === itemId)?.quantity ?? 0) >= quantity,
    ) &&
    predicate.requiresSolvedPuzzles.every((id) => solvedPuzzles.has(id)) &&
    predicate.requiresActivatedShortcuts.every((id) => shortcuts.has(id)) &&
    predicate.requiresDefeatedBosses.every((id) => bosses.has(id)) &&
    predicate.excludesDefeatedBosses.every((id) => !bosses.has(id))
  );
}

function validPredicate(predicate: WorldPredicate): boolean {
  if (predicate === null || typeof predicate !== 'object') return false;
  if (
    !validIds(predicate.requiresFacts, KNOWN_FACTS) ||
    !validIds(predicate.excludesFacts, KNOWN_FACTS) ||
    !validIds(predicate.requiresAbilities, KNOWN_ABILITIES) ||
    !validIds(predicate.requiresSolvedPuzzles, KNOWN_PUZZLES) ||
    !validIds(predicate.requiresActivatedShortcuts, KNOWN_SHORTCUTS) ||
    !validIds(predicate.requiresDefeatedBosses, KNOWN_BOSSES) ||
    !validIds(predicate.excludesDefeatedBosses, KNOWN_BOSSES) ||
    !Array.isArray(predicate.requiresItems)
  ) {
    return false;
  }
  return predicate.requiresItems.every(
    (requirement) =>
      requirement !== null &&
      typeof requirement === 'object' &&
      isStableId(requirement.itemId) &&
      KNOWN_ITEMS.has(requirement.itemId) &&
      Number.isSafeInteger(requirement.quantity) &&
      requirement.quantity > 0,
  );
}

function validIds(values: readonly string[], known: ReadonlySet<string>): boolean {
  return Array.isArray(values) && values.every((value) => isStableId(value) && known.has(value));
}
