import { MAX_STAT_UPGRADES, MAX_WEAPON_LEVEL } from '../config/balance';
import { itemDefinitions } from '../data/items';

export type ShopOffer =
  | { readonly id: string; readonly kind: 'item'; readonly itemId: string; readonly price: number }
  | {
      readonly id: string;
      readonly kind: 'blade-upgrade';
      readonly price: number;
      readonly requiredItemId: string;
    }
  | { readonly id: string; readonly kind: 'health-upgrade'; readonly price: number }
  | { readonly id: string; readonly kind: 'mana-upgrade'; readonly price: number };

export type ShopPatronState = {
  readonly currency: number;
  readonly weaponLevel: number;
  readonly healthUpgrades: number;
  readonly manaUpgrades: number;
  readonly inventory: Readonly<Record<string, number>>;
};

export type ShopListing = {
  readonly offer: ShopOffer;
  readonly displayName: string;
  readonly affordable: boolean;
  readonly available: boolean;
};

export type PurchaseResult =
  | { readonly ok: true; readonly state: ShopPatronState; readonly offer: ShopOffer }
  | {
      readonly ok: false;
      readonly reason:
        | 'unknown-offer'
        | 'insufficient-currency'
        | 'missing-material'
        | 'already-owned'
        | 'already-maxed';
    };

/** Piri's Wren's Rest stall plus Orin's forge work, expressed as one price list. */
export const WRENS_REST_OFFERS: readonly ShopOffer[] = [
  { id: 'offer-resin-heart', kind: 'item', itemId: 'resin-heart', price: 160 },
  { id: 'offer-echo-thorn', kind: 'item', itemId: 'echo-thorn', price: 190 },
  { id: 'offer-heart-petal', kind: 'health-upgrade', price: 220 },
  { id: 'offer-wellspring-seed', kind: 'mana-upgrade', price: 220 },
  { id: 'offer-blade-reforge', kind: 'blade-upgrade', price: 140, requiredItemId: 'briar-core' }
];

export class ShopController {
  public constructor(private readonly offers: readonly ShopOffer[] = WRENS_REST_OFFERS) {}

  public listings(state: ShopPatronState): readonly ShopListing[] {
    return this.offers.map((offer) => ({
      offer,
      displayName: this.displayName(offer),
      affordable: state.currency >= offer.price,
      available: this.availability(state, offer) === undefined
    }));
  }

  public purchase(state: ShopPatronState, offerId: string): PurchaseResult {
    const offer = this.offers.find(({ id }) => id === offerId);
    if (offer === undefined) return { ok: false, reason: 'unknown-offer' };
    const unavailable = this.availability(state, offer);
    if (unavailable !== undefined) return { ok: false, reason: unavailable };
    if (state.currency < offer.price) return { ok: false, reason: 'insufficient-currency' };
    const paid = state.currency - offer.price;
    switch (offer.kind) {
      case 'item':
        return {
          ok: true,
          offer,
          state: {
            ...state,
            currency: paid,
            inventory: {
              ...state.inventory,
              [offer.itemId]: (state.inventory[offer.itemId] ?? 0) + 1
            }
          }
        };
      case 'blade-upgrade': {
        const inventory = { ...state.inventory };
        const held = inventory[offer.requiredItemId] ?? 0;
        if (held <= 1) delete inventory[offer.requiredItemId];
        else inventory[offer.requiredItemId] = held - 1;
        return {
          ok: true,
          offer,
          state: { ...state, currency: paid, inventory, weaponLevel: state.weaponLevel + 1 }
        };
      }
      case 'health-upgrade':
        return {
          ok: true,
          offer,
          state: { ...state, currency: paid, healthUpgrades: state.healthUpgrades + 1 }
        };
      case 'mana-upgrade':
        return {
          ok: true,
          offer,
          state: { ...state, currency: paid, manaUpgrades: state.manaUpgrades + 1 }
        };
    }
  }

  private availability(
    state: ShopPatronState,
    offer: ShopOffer
  ): 'already-owned' | 'already-maxed' | 'missing-material' | undefined {
    if (offer.kind === 'item') {
      const item = itemDefinitions.find(({ id }) => id === offer.itemId);
      const owned = state.inventory[offer.itemId] ?? 0;
      if (item !== undefined && owned >= item.maxStack) return 'already-owned';
      return undefined;
    }
    if (offer.kind === 'blade-upgrade') {
      if (state.weaponLevel >= MAX_WEAPON_LEVEL) return 'already-maxed';
      if ((state.inventory[offer.requiredItemId] ?? 0) < 1) return 'missing-material';
      return undefined;
    }
    const upgrades = offer.kind === 'health-upgrade' ? state.healthUpgrades : state.manaUpgrades;
    return upgrades >= MAX_STAT_UPGRADES ? 'already-maxed' : undefined;
  }

  private displayName(offer: ShopOffer): string {
    if (offer.kind === 'item') {
      return itemDefinitions.find(({ id }) => id === offer.itemId)?.displayName ?? offer.itemId;
    }
    if (offer.kind === 'blade-upgrade') return 'Reforge the Surveyor Edge';
    if (offer.kind === 'health-upgrade') return 'Heart Petal Graft';
    return 'Wellspring Seed Draught';
  }
}
