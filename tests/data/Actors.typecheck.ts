import { ACTORS, MARA_ACTOR } from '../../src/game/data/actors';

function compileTimeReadonlyContract(): void {
  // @ts-expect-error Authored actor arrays are readonly.
  ACTORS.push(MARA_ACTOR);
  // @ts-expect-error Authored nested actor stats are readonly.
  MARA_ACTOR.stats.armour = 99;
  // @ts-expect-error Authored nested movement data is readonly.
  MARA_ACTOR.movement.maxSpeed = 99;
}

void compileTimeReadonlyContract;
