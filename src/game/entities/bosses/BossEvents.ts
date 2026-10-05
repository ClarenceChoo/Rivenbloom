import type { ItemId, QuestFlagId } from '../../core/StableId';
import type { ActorId, BossPhaseId } from '../../data/types';
import type { BossId, RoomId } from '../../saves/SaveSchema';
import type { PallidCantorState } from './PallidCantorController';

export type BossIntroEvent = Readonly<{
  sequence: number;
  bossId: BossId;
  actorId: ActorId;
  roomId: RoomId;
  displayName: 'The Pallid Cantor';
  currentHealth: 420;
  maxHealth: 420;
  healthBarVisible: false;
}>;

export type BossPhaseReason =
  | 'encounter-start'
  | 'health-threshold'
  | 'transition-complete'
  | 'poise-break'
  | 'parry'
  | 'lenses-awakened'
  | 'stagger-complete'
  | 'lethal';

export type BossPhaseEvent = Readonly<{
  sequence: number;
  bossId: BossId;
  previousState: PallidCantorState;
  state: PallidCantorState;
  phaseId: BossPhaseId | null;
  reason: BossPhaseReason;
  heartExposed: boolean;
}>;

export type BossHealthEvent = Readonly<{
  sequence: number;
  bossId: BossId;
  displayName: 'The Pallid Cantor';
  currentHealth: number;
  maxHealth: 420;
  ratio: number;
  currentPoise: number;
  maxPoise: 84;
  heartExposed: boolean;
  visible: boolean;
  delta: number;
}>;

export type BossDefeatedEvent = Readonly<{
  sequence: number;
  bossId: BossId;
  displayName: 'The Pallid Cantor';
  rewardItemId: ItemId;
  questFactId: QuestFlagId;
  savedAtEpochMs: number;
  currentHealth: 0;
  maxHealth: 420;
  visible: false;
}>;

export type PallidCantorEvent = BossIntroEvent | BossPhaseEvent | BossHealthEvent;
