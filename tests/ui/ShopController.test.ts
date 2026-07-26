import { describe, expect, it } from 'vitest';
import { ShopController, type ShopPatronState } from '../../src/game/ui/ShopController';

const patron = (update: Partial<ShopPatronState> = {}): ShopPatronState => ({
  currency: 500,
  weaponLevel: 1,
  healthUpgrades: 0,
  manaUpgrades: 0,
  inventory: {},
  ...update
});

describe('ShopController', () => {
  it('sells a charm once, deducting currency and refusing duplicates', () => {
    const shop = new ShopController();
    const bought = shop.purchase(patron(), 'offer-resin-heart');
    if (!bought.ok) throw new Error('Expected the purchase to succeed.');
    expect(bought.state.currency).toBe(340);
    expect(bought.state.inventory['resin-heart']).toBe(1);

    expect(shop.purchase(bought.state, 'offer-resin-heart')).toEqual({
      ok: false,
      reason: 'already-owned'
    });
  });

  it('refuses purchases the patron cannot afford or that do not exist', () => {
    const shop = new ShopController();
    expect(shop.purchase(patron({ currency: 10 }), 'offer-echo-thorn')).toEqual({
      ok: false,
      reason: 'insufficient-currency'
    });
    expect(shop.purchase(patron(), 'offer-mystery-box')).toEqual({
      ok: false,
      reason: 'unknown-offer'
    });
  });

  it('reforges the blade with a briar core and caps at the maximum level', () => {
    const shop = new ShopController();
    expect(shop.purchase(patron(), 'offer-blade-reforge')).toEqual({
      ok: false,
      reason: 'missing-material'
    });

    const forged = shop.purchase(patron({ inventory: { 'briar-core': 1 } }), 'offer-blade-reforge');
    if (!forged.ok) throw new Error('Expected the reforge to succeed.');
    expect(forged.state.weaponLevel).toBe(2);
    expect(forged.state.inventory['briar-core']).toBeUndefined();
    expect(forged.state.currency).toBe(360);

    const maxed = shop.purchase(
      patron({ weaponLevel: 3, inventory: { 'briar-core': 2 } }),
      'offer-blade-reforge'
    );
    expect(maxed).toEqual({ ok: false, reason: 'already-maxed' });
  });

  it('sells health and mana upgrades up to the shared stat cap', () => {
    const shop = new ShopController();
    const grafted = shop.purchase(patron(), 'offer-heart-petal');
    if (!grafted.ok) throw new Error('Expected the graft to succeed.');
    expect(grafted.state.healthUpgrades).toBe(1);

    expect(shop.purchase(patron({ healthUpgrades: 3 }), 'offer-heart-petal')).toEqual({
      ok: false,
      reason: 'already-maxed'
    });
    expect(shop.purchase(patron({ manaUpgrades: 3 }), 'offer-wellspring-seed')).toEqual({
      ok: false,
      reason: 'already-maxed'
    });
  });

  it('reports affordability and availability on listings for the menu', () => {
    const shop = new ShopController();
    const listings = shop.listings(patron({ currency: 150, weaponLevel: 3 }));
    const byId = new Map(listings.map((listing) => [listing.offer.id, listing]));
    expect(byId.get('offer-resin-heart')).toMatchObject({ affordable: false, available: true });
    expect(byId.get('offer-blade-reforge')).toMatchObject({ available: false });
    expect(byId.get('offer-heart-petal')?.displayName).toBe('Heart Petal Graft');
  });
});
