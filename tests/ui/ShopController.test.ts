import { describe, expect, it } from 'vitest';

import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { itemId } from '../../src/game/core/StableId';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import { SHOP_OFFERS, ShopController } from '../../src/game/ui/ShopController';

function save(currency: number) {
  const { newGame } = CONTENT_REGISTRY;
  const result = createNewSave({
    nowEpochMs: 1,
    location: {
      regionId: newGame.initialRegionId,
      areaId: newGame.initialAreaId,
      checkpointId: newGame.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: newGame.baseStats,
    initialQuests: newGame.initialQuests,
    startingAbilities: newGame.startingAbilities,
  });
  return { ...result, player: { ...result.player, currency } };
}

describe('ShopController', () => {
  it('keeps the required briar-core reforge available after all resin is spent', () => {
    const shop = new ShopController(SHOP_OFFERS);
    const before = {
      ...save(0),
      inventory: [{ itemId: itemId('briar-core'), quantity: 1 }],
    };
    expect(shop.quote(before, 'blade-reforge')).toMatchObject({ kind: 'available', price: 0 });
    const result = shop.purchase(before, 'blade-reforge');
    expect(result.kind).toBe('accepted');
    expect(result.save.player).toMatchObject({ currency: 0, weaponLevel: 1 });
    expect(result.save.inventory).toEqual([]);
    expect(result.save.quests.flags).toContain('surveyor-edge-reforged');
    expect(shop.quote(structuredClone(result.save), 'blade-reforge').kind).toBe('sold-out');
  });

  it('uses one validator for quote and purchase and never spends on a rejected full stack', () => {
    const shop = new ShopController(SHOP_OFFERS);
    const before = save(20);
    const quote = shop.quote(before, 'sunmoss-draught');
    expect(quote).toMatchObject({ kind: 'available', price: 8 });
    const purchase = shop.purchase(before, 'sunmoss-draught');
    expect(purchase.kind).toBe('accepted');
    if (purchase.kind !== 'accepted') return;
    expect(purchase.save.player.currency).toBe(12);

    const full = { ...before, inventory: [{ itemId: SHOP_OFFERS[0]!.itemId!, quantity: 5 }] };
    expect(shop.quote(full, 'sunmoss-draught').kind).toBe('unavailable');
    const rejected = shop.purchase(full, 'sunmoss-draught');
    expect(rejected.kind).toBe('rejected');
    expect(rejected.save.player.currency).toBe(20);
  });

  it('enforces repeatable recovery, one-time charm, and reforge prerequisites', () => {
    const shop = new ShopController(SHOP_OFFERS);
    const charm = shop.purchase(save(100), 'resin-heart');
    expect(charm.kind).toBe('accepted');
    if (charm.kind !== 'accepted') return;
    expect(shop.quote(charm.save, 'resin-heart').kind).toBe('sold-out');
    expect(shop.quote(save(100), 'blade-reforge').kind).toBe('unavailable');
    expect(Object.isFrozen(SHOP_OFFERS[0])).toBe(true);
  });

  it.each([
    ['resin-heart', 'resin-heart-purchased'],
    ['echo-thorn', 'echo-thorn-purchased'],
  ] as const)(
    'persists the one-time %s ledger after consume and reload',
    (offerId, soldOutFact) => {
      const shop = new ShopController(SHOP_OFFERS);
      expect(SHOP_OFFERS.find(({ offerId: id }) => id === offerId)?.soldOutFactId).toBe(
        soldOutFact,
      );
      const purchased = shop.purchase(save(100), offerId);
      expect(purchased.kind).toBe('accepted');
      if (purchased.kind !== 'accepted') return;
      expect(purchased.save.quests.flags).toContain(soldOutFact);

      const consumedAndReloaded = structuredClone({
        ...purchased.save,
        inventory: purchased.save.inventory.filter(({ itemId: owned }) => owned !== offerId),
      });
      expect(shop.quote(consumedAndReloaded, offerId).kind).toBe('sold-out');
      const replay = shop.purchase(consumedAndReloaded, offerId);
      expect(replay.kind).toBe('rejected');
      expect(replay.save.player.currency).toBe(100 - (offerId === 'resin-heart' ? 35 : 45));
    },
  );

  it('rolls back charm currency and fact when a missing ledger meets a full stack', () => {
    const shop = new ShopController(SHOP_OFFERS);
    const before = {
      ...save(100),
      inventory: [{ itemId: itemId('resin-heart'), quantity: 1 }],
    };
    const result = shop.purchase(before, 'resin-heart');
    expect(result).toMatchObject({ kind: 'rejected', reason: 'stack-full' });
    expect(result.save.player.currency).toBe(100);
    expect(result.save.quests.flags).not.toContain('resin-heart-purchased');
  });
});
