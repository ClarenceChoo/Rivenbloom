export const PLAYER_STATES = [
  'idle',
  'run',
  'jump',
  'fall',
  'land',
  'attackLight',
  'attackHeavy',
  'airAttack',
  'block',
  'parry',
  'dash',
  'cast',
  'climb',
  'interact',
  'hurt',
  'dead',
] as const;

export type PlayerState = (typeof PLAYER_STATES)[number];
export type PlayerStateTransitionSource =
  'movement' | 'combat' | 'interaction' | 'external' | 'respawn';

const MOVEMENT_STATES: ReadonlySet<PlayerState> = new Set([
  'idle',
  'run',
  'jump',
  'fall',
  'land',
  'climb',
]);

const EXTERNAL_STATES: ReadonlySet<PlayerState> = new Set(['hurt', 'dead']);
const COMBAT_STATES: ReadonlySet<PlayerState> = new Set([
  'attackLight',
  'attackHeavy',
  'airAttack',
  'block',
  'parry',
  'dash',
  'cast',
]);

export class PlayerStateMachine {
  private state: PlayerState;

  public constructor(initialState: PlayerState) {
    this.state = initialState;
  }

  public get current(): PlayerState {
    return this.state;
  }

  public request(next: PlayerState, source: PlayerStateTransitionSource): boolean {
    const allowed =
      source === 'movement'
        ? MOVEMENT_STATES.has(this.state) && MOVEMENT_STATES.has(next)
        : source === 'combat'
          ? this.state !== 'hurt' &&
            this.state !== 'dead' &&
            (MOVEMENT_STATES.has(next) || COMBAT_STATES.has(next))
          : source === 'interaction'
            ? (MOVEMENT_STATES.has(this.state) && next === 'interact') ||
              (this.state === 'interact' && MOVEMENT_STATES.has(next))
            : source === 'external'
              ? EXTERNAL_STATES.has(next) && (this.state !== 'dead' || next === 'dead')
              : next === 'idle';
    if (!allowed) return false;
    this.state = next;
    return true;
  }

  public releaseHurt(next: PlayerState): boolean {
    if (this.state !== 'hurt' || !MOVEMENT_STATES.has(next)) return false;
    this.state = next;
    return true;
  }
}
