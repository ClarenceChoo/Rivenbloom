import type { StableId } from '../../data/types';

export type EnemyAttackChoice = {
  readonly attackId: StableId;
  readonly kind: 'melee' | 'ranged';
  readonly triggerRange: number;
  readonly cooldownFrames: number;
};

export type EnemyProfile = {
  readonly id: StableId;
  readonly actorId: StableId;
  readonly locomotion: 'ground' | 'air' | 'ambush';
  readonly patrol?: {
    readonly speed: number;
    readonly spanX: number;
    readonly pauseFrames: number;
  };
  readonly chase: {
    readonly speed: number;
    readonly stopGapX: number;
    readonly leashDistance: number;
  };
  readonly attacks: readonly EnemyAttackChoice[];
  readonly kite?: {
    readonly triggerRange: number;
    readonly speed: number;
  };
  readonly guard?: {
    readonly damageMultiplier: number;
    readonly poiseMultiplier: number;
    readonly knockbackMultiplier: number;
  };
  readonly ambush?: {
    readonly emergeRange: number;
  };
  readonly air?: {
    readonly hoverHeight: number;
    readonly bobAmplitude: number;
    readonly bobFramePeriod: number;
    readonly diveSpeedPerFrame: number;
  };
  readonly suspicion: {
    readonly framesToAlert: number;
    readonly decayPerFrame: number;
  };
  readonly staggerPoiseThreshold: number;
  readonly hurtFrames: number;
  readonly staggerFrames: number;
  readonly sightVerticalRange: number;
  readonly rearRange: number;
};
