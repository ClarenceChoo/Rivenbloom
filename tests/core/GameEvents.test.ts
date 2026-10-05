import { describe, expect, it } from 'vitest';

import { GameEvents } from '../../src/game/core/GameEvents';

type TestEventMap = {
  relicClaimed: { relicId: string };
  roomEntered: { roomId: string };
};

describe('GameEvents', () => {
  it('delivers a typed payload to listeners and unregisters through the returned cleanup', () => {
    const events = new GameEvents<TestEventMap>();
    const received: string[] = [];
    const unsubscribe = events.on('relicClaimed', ({ relicId }) => received.push(relicId));

    events.emit('relicClaimed', { relicId: 'dawn-needle' });
    unsubscribe();
    events.emit('relicClaimed', { relicId: 'root-key' });

    expect(received).toEqual(['dawn-needle']);
  });

  it('keeps a newer listener registered when an older cleanup runs twice', () => {
    const events = new GameEvents<TestEventMap>();
    const unsubscribeFirst = events.on('relicClaimed', () => undefined);
    const received: string[] = [];

    unsubscribeFirst();
    events.on('relicClaimed', ({ relicId }) => received.push(relicId));
    unsubscribeFirst();
    events.emit('relicClaimed', { relicId: 'root-key' });

    expect(received).toEqual(['root-key']);
  });
});
