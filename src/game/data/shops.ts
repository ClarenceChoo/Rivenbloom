import { itemId, questFlagId, stableId } from '../core/StableId';
import { deepFreeze } from './immutability';
import type { ShopOfferDefinition } from './types';

const authoredOffers = [
  recovery('piri-remedies', 'sunmoss-draught', 'Sunmoss Draught', 'Restores health when used.', 8),
  recovery('piri-remedies', 'wellspring-tonic', 'Wellspring Tonic', 'Restores mana when used.', 10),
  charm(
    'piri-remedies',
    'resin-heart',
    'resin-heart-purchased',
    'Resin Heart',
    'A one-time charm from Piri’s amber stock.',
    35,
  ),
  charm(
    'piri-remedies',
    'echo-thorn',
    'echo-thorn-purchased',
    'Echo Thorn',
    'A one-time charm tuned for decisive guards.',
    45,
  ),
  {
    offerId: stableId<'shop-offer'>('blade-reforge'),
    shopId: stableId<'shop'>('orin-forge'),
    soldOutFactId: questFlagId('surveyor-edge-reforged'),
    displayName: 'Reforge Surveyor Edge',
    description: 'Orin tempers the blade with one briar core.',
    price: 50,
    itemId: null,
    prerequisites: [],
    stockPolicy: 'one-time',
    commands: [],
    rewardId: 'blade-reforge',
  },
] satisfies readonly ShopOfferDefinition[];

export const SHOP_OFFERS: readonly ShopOfferDefinition[] = deepFreeze(authoredOffers);

function recovery(
  shop: string,
  id: string,
  displayName: string,
  description: string,
  price: number,
): ShopOfferDefinition {
  const ownedItemId = itemId(id);
  return {
    offerId: stableId<'shop-offer'>(id),
    shopId: stableId<'shop'>(shop),
    soldOutFactId: null,
    displayName,
    description,
    price,
    itemId: ownedItemId,
    prerequisites: [],
    stockPolicy: 'repeatable',
    commands: [
      { kind: 'spend-currency', amount: price },
      { kind: 'grant-item', itemId: ownedItemId, quantity: 1 },
    ],
    rewardId: null,
  };
}

function charm(
  shop: string,
  id: string,
  soldOutFact: string,
  displayName: string,
  description: string,
  price: number,
): ShopOfferDefinition {
  const offer = recovery(shop, id, displayName, description, price);
  const soldOutFactId = questFlagId(soldOutFact);
  return {
    ...offer,
    soldOutFactId,
    stockPolicy: 'one-time',
    commands: [...offer.commands, { kind: 'set-fact', factId: soldOutFactId }],
  };
}
