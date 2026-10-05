import { deepFreeze, immutableClone } from '../data/immutability';
import { SHOP_OFFERS } from '../data/shops';
import type { ShopOfferDefinition } from '../data/types';
import type { SaveV1 } from '../saves/SaveSchema';
import { applyProgressionTransaction, claimProgressionReward } from '../world/WorldProgression';
import type { ProgressionResult } from '../world/WorldProgression';

export { SHOP_OFFERS } from '../data/shops';

export type ShopQuote =
  | Readonly<{
      kind: 'available';
      offerId: ShopOfferDefinition['offerId'];
      displayName: string;
      description: string;
      price: number;
    }>
  | Readonly<{
      kind: 'unavailable' | 'sold-out' | 'missing-offer';
      offerId: string;
      price: number | null;
      reason: string;
    }>;

export class ShopController {
  private readonly offers = new Map<string, ShopOfferDefinition>();

  public constructor(definitions: readonly ShopOfferDefinition[] = SHOP_OFFERS) {
    for (const definition of definitions) {
      if (this.offers.has(definition.offerId))
        throw new RangeError('Shop offer IDs cannot repeat.');
      if (!Number.isSafeInteger(definition.price) || definition.price < 0) {
        throw new RangeError('Shop offer prices must be non-negative safe integers.');
      }
      this.offers.set(definition.offerId, definition);
    }
  }

  public quote(save: SaveV1, offerId: string): ShopQuote {
    const offer = this.offers.get(offerId);
    if (offer === undefined) {
      return { kind: 'missing-offer', offerId, price: null, reason: 'Unknown shop offer.' };
    }
    if (isSoldOut(save, offer)) {
      return { kind: 'sold-out', offerId, price: offer.price, reason: 'Offer already purchased.' };
    }
    if (!offer.prerequisites.every((factId) => save.quests.flags.includes(factId))) {
      return { kind: 'unavailable', offerId, price: offer.price, reason: 'Prerequisite not met.' };
    }
    const result = evaluate(save, offer);
    if (result.kind !== 'accepted') {
      return {
        kind: result.kind === 'unchanged' ? 'sold-out' : 'unavailable',
        offerId,
        price: offer.price,
        reason: result.kind === 'rejected' ? result.reason : 'Offer makes no change.',
      };
    }
    return deepFreeze({
      kind: 'available',
      offerId: offer.offerId,
      displayName: offer.displayName,
      description: offer.description,
      price: offer.price,
    });
  }

  public purchase(save: SaveV1, offerId: string): ProgressionResult {
    const offer = this.offers.get(offerId);
    if (offer === undefined || isSoldOut(save, offer)) {
      return deepFreeze({
        kind: 'rejected',
        reason: 'invalid-command',
        save: immutableClone(save),
        events: Object.freeze([]),
      });
    }
    if (!offer.prerequisites.every((factId) => save.quests.flags.includes(factId))) {
      return deepFreeze({
        kind: 'rejected',
        reason: 'invalid-command',
        save: immutableClone(save),
        events: Object.freeze([]),
      });
    }
    return evaluate(save, offer);
  }
}

function evaluate(save: SaveV1, offer: ShopOfferDefinition): ProgressionResult {
  if (offer.rewardId !== null) return claimProgressionReward(save, offer.rewardId);
  return applyProgressionTransaction(save, { commands: offer.commands });
}

function isSoldOut(save: SaveV1, offer: ShopOfferDefinition): boolean {
  if (offer.stockPolicy === 'repeatable') return false;
  return offer.soldOutFactId !== null && save.quests.flags.includes(offer.soldOutFactId);
}
