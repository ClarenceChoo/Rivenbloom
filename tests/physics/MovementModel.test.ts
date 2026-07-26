import { describe, expect, it } from 'vitest';
import {
  createMovementState,
  stepMovement,
  type MovementContacts,
  type MovementInput,
  type MovementTuning
} from '../../src/game/physics/MovementModel';

const tuning: MovementTuning = {
  maxRunSpeed: 240,
  groundAcceleration: 1200,
  groundBraking: 1800,
  groundFriction: 900,
  airAcceleration: 720,
  gravity: 1800,
  jumpSpeed: 600,
  jumpCutSpeed: 240,
  maxFallSpeed: 900,
  coyoteTime: 0.1,
  jumpBufferTime: 0.12,
  landingLockTime: 0.08,
  climbSpeed: 160,
  dropThroughTime: 0.18,
  dropSpeed: 60,
  knockbackLockTime: 0.16,
  fixedStep: 1 / 60,
  maxFrameTime: 0.05
};

const grounded: MovementContacts = {
  grounded: true,
  supportKind: 'solid',
  climbable: false
};

const airborne: MovementContacts = {
  grounded: false,
  climbable: false
};

const neutralInput: MovementInput = {
  moveX: 0,
  moveY: 0,
  jumpPressed: false,
  jumpHeld: false,
  dropPressed: false,
  respawn: false
};

describe('stepMovement', () => {
  it('accelerates toward run speed at the authored ground rate', () => {
    const state = createMovementState({ x: 10, y: 566 }, 'right');

    const result = stepMovement(state, { ...neutralInput, moveX: 1 }, grounded, tuning, 1 / 60);

    expect(result.state.velocity.x).toBeCloseTo(20, 8);
    expect(result.state.position.x).toBeCloseTo(10 + 1 / 3, 8);
    expect(result.state.machine.value).toBe('run');
  });

  it('applies ground friction when directional input is released', () => {
    const state = {
      ...createMovementState({ x: 0, y: 566 }, 'right'),
      velocity: { x: 120, y: 0 },
      machine: { value: 'run' as const }
    };

    const result = stepMovement(state, neutralInput, grounded, tuning, 1 / 60);

    expect(result.state.velocity.x).toBeCloseTo(105, 8);
    expect(result.state.position.x).toBeCloseTo(1.75, 8);
  });

  it('brakes more sharply when reversing direction on the ground', () => {
    const state = {
      ...createMovementState({ x: 0, y: 566 }, 'right'),
      velocity: { x: 120, y: 0 },
      machine: { value: 'run' as const }
    };

    const result = stepMovement(state, { ...neutralInput, moveX: -1 }, grounded, tuning, 1 / 60);

    expect(result.state.velocity.x).toBeCloseTo(90, 8);
    expect(result.state.position.x).toBeCloseTo(1.5, 8);
    expect(result.state.facing).toBe('left');
  });

  it('allows a jump during the coyote window after leaving a ledge', () => {
    const primed = stepMovement(
      createMovementState({ x: 0, y: 400 }, 'right'),
      neutralInput,
      grounded,
      tuning,
      1 / 60
    ).state;
    const offLedge = stepMovement(primed, neutralInput, airborne, tuning, 1 / 60).state;

    const result = stepMovement(
      offLedge,
      { ...neutralInput, jumpPressed: true, jumpHeld: true },
      airborne,
      tuning,
      1 / 60
    );

    expect(offLedge.coyoteRemaining).toBeCloseTo(0.1 - 1 / 60, 8);
    expect(result.state.velocity.y).toBe(-600);
    expect(result.state.machine.value).toBe('jump');
    expect(result.events.jumped).toBe(true);
  });

  it('buffers a jump pressed shortly before landing', () => {
    const falling = {
      ...createMovementState({ x: 0, y: 550 }, 'right'),
      velocity: { x: 0, y: 240 },
      machine: { value: 'fall' as const },
      grounded: false
    };
    const buffered = stepMovement(
      falling,
      { ...neutralInput, jumpPressed: true, jumpHeld: true },
      airborne,
      tuning,
      1 / 60
    ).state;

    const result = stepMovement(buffered, neutralInput, grounded, tuning, 1 / 60);

    expect(buffered.jumpBufferRemaining).toBeCloseTo(0.12, 8);
    expect(result.state.velocity.y).toBe(-600);
    expect(result.state.jumpBufferRemaining).toBe(0);
    expect(result.events.jumped).toBe(true);
  });

  it('cuts upward velocity when jump is released for a variable-height jump', () => {
    const rising = {
      ...createMovementState({ x: 0, y: 480 }, 'right'),
      velocity: { x: 0, y: -500 },
      machine: { value: 'jump' as const },
      grounded: false
    };

    const result = stepMovement(rising, neutralInput, airborne, tuning, 1 / 60);

    expect(result.state.velocity.y).toBeCloseTo(-210, 8);
    expect(result.state.position.y).toBeCloseTo(476.5, 8);
    expect(result.state.machine.value).toBe('jump');
  });

  it('caps downward velocity and enters fall state after the jump apex', () => {
    const descending = {
      ...createMovementState({ x: 0, y: 300 }, 'right'),
      velocity: { x: 0, y: 880 },
      machine: { value: 'jump' as const },
      grounded: false
    };

    const result = stepMovement(
      descending,
      { ...neutralInput, jumpHeld: true },
      airborne,
      tuning,
      1 / 60
    );

    expect(result.state.velocity.y).toBe(900);
    expect(result.state.position.y).toBe(315);
    expect(result.state.machine.value).toBe('fall');
  });

  it('enters a timed land state that briefly locks directional control', () => {
    const falling = {
      ...createMovementState({ x: 0, y: 566 }, 'right'),
      velocity: { x: 60, y: 300 },
      machine: { value: 'fall' as const },
      grounded: false
    };
    const landing = stepMovement(falling, { ...neutralInput, moveX: 1 }, grounded, tuning, 1 / 60);
    const locked = stepMovement(
      landing.state,
      { ...neutralInput, moveX: 1 },
      grounded,
      tuning,
      1 / 60
    );

    expect(landing.events.landed).toBe(true);
    expect(landing.state.machine.value).toBe('land');
    expect(landing.state.landingRemaining).toBeCloseTo(0.08, 8);
    expect(landing.state.velocity).toEqual({ x: 45, y: 0 });
    expect(locked.state.machine.value).toBe('land');
    expect(locked.state.landingRemaining).toBeCloseTo(0.08 - 1 / 60, 8);
    expect(locked.state.velocity.x).toBe(30);
  });

  it('keeps a stationary landing in land state until its lock expires', () => {
    const falling = {
      ...createMovementState({ x: 0, y: 566 }, 'right'),
      velocity: { x: 0, y: 300 },
      machine: { value: 'fall' as const },
      grounded: false
    };
    const landing = stepMovement(falling, neutralInput, grounded, tuning, 1 / 60);

    const locked = stepMovement(landing.state, neutralInput, grounded, tuning, 1 / 60);

    expect(locked.state.machine.value).toBe('land');
    expect(locked.state.landingRemaining).toBeCloseTo(0.08 - 1 / 60, 8);
  });

  it('returns to locomotion when the landing lock expires', () => {
    const landing = {
      ...createMovementState({ x: 0, y: 566 }, 'right'),
      machine: { value: 'land' as const },
      landingRemaining: 0.01
    };

    const result = stepMovement(landing, { ...neutralInput, moveX: 1 }, grounded, tuning, 1 / 60);

    expect(result.state.landingRemaining).toBe(0);
    expect(result.state.machine.value).toBe('run');
    expect(result.state.velocity.x).toBe(20);
  });

  it('moves vertically without gravity while attached to a climb zone', () => {
    const onLadder = {
      ...createMovementState({ x: 1650, y: 500 }, 'right'),
      velocity: { x: 0, y: 120 },
      machine: { value: 'fall' as const },
      grounded: false
    };
    const climbContacts: MovementContacts = {
      grounded: false,
      climbable: true
    };

    const climbing = stepMovement(
      onLadder,
      { ...neutralInput, moveY: -1 },
      climbContacts,
      tuning,
      1 / 60
    );
    const paused = stepMovement(climbing.state, neutralInput, climbContacts, tuning, 1 / 60);

    expect(climbing.state.machine.value).toBe('climb');
    expect(climbing.state.velocity.y).toBe(-160);
    expect(climbing.state.position.y).toBeCloseTo(500 - 8 / 3, 8);
    expect(paused.state.machine.value).toBe('climb');
    expect(paused.state.velocity.y).toBe(0);
  });

  it('starts a timed fall through a one-way support instead of jumping', () => {
    const onPlatform = {
      ...createMovementState({ x: 1600, y: 410 }, 'right'),
      machine: { value: 'idle' as const }
    };
    const oneWay: MovementContacts = {
      grounded: true,
      supportKind: 'one-way',
      climbable: false
    };

    const result = stepMovement(
      onPlatform,
      {
        ...neutralInput,
        moveY: 1,
        jumpPressed: true,
        jumpHeld: true,
        dropPressed: true
      },
      oneWay,
      tuning,
      1 / 60
    );

    expect(result.events.dropThroughStarted).toBe(true);
    expect(result.state.dropThroughRemaining).toBeCloseTo(0.18, 8);
    expect(result.state.velocity.y).toBe(60);
    expect(result.state.grounded).toBe(false);
    expect(result.state.machine.value).toBe('fall');
  });

  it('applies knockback as a locked hurt-state impulse', () => {
    const running = {
      ...createMovementState({ x: 100, y: 566 }, 'right'),
      velocity: { x: 180, y: 0 },
      machine: { value: 'run' as const }
    };

    const result = stepMovement(
      running,
      {
        ...neutralInput,
        moveX: 1,
        knockback: { x: -360, y: -240 }
      },
      grounded,
      tuning,
      1 / 60
    );

    expect(result.state.velocity).toEqual({ x: -360, y: -240 });
    expect(result.state.position).toEqual({ x: 94, y: 562 });
    expect(result.state.knockbackRemaining).toBeCloseTo(0.16, 8);
    expect(result.state.grounded).toBe(false);
    expect(result.state.machine.value).toBe('hurt');
  });

  it.each(['idle', 'jump', 'fall', 'land', 'climb'] as const)(
    'requests hurt when knockback interrupts %s',
    (stateName) => {
      const state = {
        ...createMovementState({ x: 100, y: 500 }, 'right'),
        machine: { value: stateName },
        grounded: stateName === 'idle' || stateName === 'land'
      };

      const result = stepMovement(
        state,
        { ...neutralInput, knockback: { x: -180, y: -120 } },
        state.grounded ? grounded : airborne,
        tuning,
        1 / 60
      );

      expect(result.state.machine.value).toBe('hurt');
    }
  );

  it('retains hurt while the knockback lock remains active at 60 Hz', () => {
    const hurt = {
      ...createMovementState({ x: 100, y: 500 }, 'right'),
      velocity: { x: -120, y: -60 },
      machine: { value: 'hurt' as const },
      grounded: false,
      knockbackRemaining: 0.16
    };

    const result = stepMovement(hurt, neutralInput, airborne, tuning, 1 / 60);

    expect(result.state.knockbackRemaining).toBeCloseTo(0.16 - 1 / 60, 8);
    expect(result.state.machine.value).toBe('hurt');
    expect(result.state.velocity).toEqual({ x: -120, y: -30 });
  });

  it.each([
    { contacts: grounded, input: neutralInput, expected: 'idle' as const },
    {
      contacts: grounded,
      input: { ...neutralInput, moveX: 1 as const },
      expected: 'run' as const
    },
    { contacts: airborne, input: neutralInput, expected: 'fall' as const }
  ])(
    'leaves hurt for $expected when the knockback lock expires',
    ({ contacts, input, expected }) => {
      const hurt = {
        ...createMovementState({ x: 100, y: 500 }, 'right'),
        velocity: { x: 0, y: 0 },
        machine: { value: 'hurt' as const },
        grounded: contacts.grounded,
        knockbackRemaining: 0.01
      };

      const result = stepMovement(hurt, input, contacts, tuning, 1 / 60);

      expect(result.state.knockbackRemaining).toBe(0);
      expect(result.state.machine.value).toBe(expected);
    }
  );

  it('restores the supplied spawn state on respawn reset', () => {
    const initial = createMovementState({ x: 100, y: 566 }, 'right');
    const displaced = {
      ...initial,
      position: { x: 700, y: 900 },
      velocity: { x: -220, y: 900 },
      facing: 'left' as const,
      machine: { value: 'hurt' as const },
      grounded: false,
      coyoteRemaining: 0.04,
      jumpBufferRemaining: 0.08,
      landingRemaining: 0.03,
      dropThroughRemaining: 0.1,
      knockbackRemaining: 0.12
    };

    const result = stepMovement(
      displaced,
      { ...neutralInput, respawn: true },
      airborne,
      tuning,
      1 / 60
    );

    expect(result.state.position).toEqual({ x: 100, y: 566 });
    expect(result.state.velocity).toEqual({ x: 0, y: 0 });
    expect(result.state.facing).toBe('right');
    expect(result.state.machine.value).toBe('idle');
    expect(result.state.grounded).toBe(true);
    expect({
      coyote: result.state.coyoteRemaining,
      jumpBuffer: result.state.jumpBufferRemaining,
      landing: result.state.landingRemaining,
      dropThrough: result.state.dropThroughRemaining,
      knockback: result.state.knockbackRemaining
    }).toEqual({
      coyote: 0,
      jumpBuffer: 0,
      landing: 0,
      dropThrough: 0,
      knockback: 0
    });
    expect(result.events.respawned).toBe(true);
  });

  it('uses the lower authored acceleration rate while airborne', () => {
    const falling = {
      ...createMovementState({ x: 0, y: 300 }, 'right'),
      machine: { value: 'fall' as const },
      grounded: false
    };

    const result = stepMovement(falling, { ...neutralInput, moveX: 1 }, airborne, tuning, 1 / 60);

    expect(result.state.velocity.x).toBe(12);
    expect(result.state.position.x).toBeCloseTo(0.2, 8);
  });

  it('preserves horizontal momentum in the air when input is neutral', () => {
    const falling = {
      ...createMovementState({ x: 0, y: 300 }, 'right'),
      velocity: { x: 120, y: 100 },
      machine: { value: 'fall' as const },
      grounded: false
    };

    const result = stepMovement(falling, neutralInput, airborne, tuning, 1 / 60);

    expect(result.state.velocity.x).toBe(120);
    expect(result.state.position.x).toBe(2);
  });

  it.each(['idle', 'run'] as const)('requests jump from grounded %s locomotion', (stateName) => {
    const state = {
      ...createMovementState({ x: 0, y: 566 }, 'right'),
      machine: { value: stateName }
    };

    const result = stepMovement(
      state,
      { ...neutralInput, jumpPressed: true, jumpHeld: true },
      grounded,
      tuning,
      1 / 60
    );

    expect(result.state.machine.value).toBe('jump');
    expect(result.state.velocity.y).toBe(-600);
  });

  it.each(['run', 'land'] as const)(
    'enters fall when %s locomotion leaves authored support',
    (stateName) => {
      const state = {
        ...createMovementState({ x: 0, y: 566 }, 'right'),
        velocity: { x: 120, y: 0 },
        machine: { value: stateName },
        landingRemaining: stateName === 'land' ? 0.08 : 0
      };

      const result = stepMovement(state, neutralInput, airborne, tuning, 1 / 60);

      expect(result.state.machine.value).toBe('fall');
      expect(result.state.grounded).toBe(false);
    }
  );

  it('enters jump when buffered input interrupts the landing lock', () => {
    const landing = {
      ...createMovementState({ x: 0, y: 566 }, 'right'),
      machine: { value: 'land' as const },
      landingRemaining: 0.08
    };

    const result = stepMovement(
      landing,
      { ...neutralInput, jumpPressed: true, jumpHeld: true },
      grounded,
      tuning,
      1 / 60
    );

    expect(result.state.machine.value).toBe('jump');
    expect(result.state.velocity.y).toBe(-600);
  });

  it('attaches to an authored climb zone while airborne', () => {
    const jumping = {
      ...createMovementState({ x: 220, y: 500 }, 'right'),
      velocity: { x: 0, y: -120 },
      machine: { value: 'jump' as const },
      grounded: false
    };

    const result = stepMovement(
      jumping,
      { ...neutralInput, moveY: -1 },
      { ...airborne, climbable: true },
      tuning,
      1 / 60
    );

    expect(result.state.machine.value).toBe('climb');
    expect(result.state.velocity.y).toBe(-160);
  });

  it.each([
    {
      name: 'run friction',
      state: {
        ...createMovementState({ x: 0, y: 566 }, 'right'),
        velocity: { x: 10, y: 0 },
        machine: { value: 'run' as const }
      }
    },
    {
      name: 'expired landing lock',
      state: {
        ...createMovementState({ x: 0, y: 566 }, 'right'),
        machine: { value: 'land' as const },
        landingRemaining: 0.01
      }
    }
  ])('settles $name into idle', ({ state }) => {
    const result = stepMovement(state, neutralInput, grounded, tuning, 1 / 60);

    expect(result.state.machine.value).toBe('idle');
    expect(result.state.velocity.x).toBe(0);
  });

  it.each(['idle', 'run'] as const)(
    'enters climb from grounded %s locomotion and detaches from support',
    (stateName) => {
      const climbContacts: MovementContacts = {
        grounded: true,
        supportKind: 'solid',
        climbable: true
      };

      const result = stepMovement(
        {
          ...createMovementState({ x: 1650, y: 566 }, 'right'),
          machine: { value: stateName }
        },
        { ...neutralInput, moveY: -1 },
        climbContacts,
        tuning,
        1 / 60
      );

      expect(result.state.machine.value).toBe('climb');
      expect(result.state.velocity.y).toBe(-160);
      expect(result.state.grounded).toBe(false);
    }
  );

  it('falls when the player leaves an authored climb zone', () => {
    const climbing = {
      ...createMovementState({ x: 1650, y: 400 }, 'right'),
      machine: { value: 'climb' as const },
      grounded: false
    };

    const result = stepMovement(climbing, neutralInput, airborne, tuning, 1 / 60);

    expect(result.state.machine.value).toBe('fall');
    expect(result.state.velocity.y).toBe(30);
  });
});
