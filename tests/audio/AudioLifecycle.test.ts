import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioDirector } from '../../src/game/audio/AudioDirector';
import { DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function harness(rejectFirst = false) {
  const events = new EventTarget();
  const document = new EventTarget();
  Object.assign(document, { hidden: false });
  vi.stubGlobal('addEventListener', events.addEventListener.bind(events));
  vi.stubGlobal('removeEventListener', events.removeEventListener.bind(events));
  vi.stubGlobal('document', document);
  const tracks: FakeAudio[] = [];
  class FakeAudio {
    paused = true;
    ended = false;
    loop = false;
    preload = '';
    constructor(public src: string) {
      tracks.push(this);
    }
    play() {
      if (rejectFirst) {
        rejectFirst = false;
        return Promise.reject(new Error('autoplay'));
      }
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    removeAttribute() {
      this.src = '';
    }
  }
  vi.stubGlobal('Audio', FakeAudio);
  const gains: { value: number }[] = [];
  const node = () => {
    const gain = {
      value: 1,
      setValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    };
    gains.push(gain);
    return { gain, connect: vi.fn().mockReturnThis(), disconnect: vi.fn() };
  };
  const factory = vi.fn(
    () =>
      ({
        state: 'running',
        currentTime: 0,
        destination: {},
        createGain: node,
        createMediaElementSource: node,
        close: () => Promise.resolve(),
      }) as unknown as AudioContext,
  );
  const director = new AudioDirector({ contextFactory: factory });
  director.applySettings(DEFAULT_SAVE_SETTINGS);
  return { director, tracks, events, document, factory, gains };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('music lifecycle', () => {
  it('does not replay the completed ending music on subsequent input', async () => {
    const { director, events, tracks } = harness();
    director.setMusicLayer('release');
    events.dispatchEvent(new Event('pointerdown'));
    await settle();
    tracks[0]!.paused = true;
    tracks[0]!.ended = true;
    events.dispatchEvent(new Event('keydown'));
    await settle();
    expect(tracks).toHaveLength(1);
    director.dispose();
  });
  it('keeps a returning track alive when its previous fade timeout expires', async () => {
    vi.useFakeTimers();
    const { director, events, tracks } = harness();
    events.dispatchEvent(new Event('pointerdown'));
    await settle();
    director.setMusicLayer('wren-rest');
    await settle();
    director.setMusicLayer('menu');
    await settle();
    vi.advanceTimersByTime(1300);
    expect(tracks.filter((track) => !track.paused).map((track) => track.src)).toEqual([
      '/assets/audio/rivenbloom/01-a-thread-of-amber.mp3',
    ]);
    director.dispose();
  });
  it('retries blocked playback on a later gesture of the same input type', async () => {
    const { director, events, tracks } = harness(true);
    events.dispatchEvent(new Event('pointerdown'));
    await settle();
    events.dispatchEvent(new Event('pointerdown'));
    await settle();
    expect(tracks.some((track) => !track.paused)).toBe(true);
    director.dispose();
  });
  it('does not create an audio context on visibility before a user gesture', () => {
    const { director, document, factory } = harness();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(factory).not.toHaveBeenCalled();
    director.dispose();
  });
  it('mutes while hidden, restores channel settings and releases tracks on disposal', async () => {
    const { director, events, document, tracks, gains } = harness();
    events.dispatchEvent(new Event('keydown'));
    await settle();
    Object.assign(document, { hidden: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(gains[0]!.value).toBe(0);
    Object.assign(document, { hidden: false });
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(gains[0]!.value).toBe(DEFAULT_SAVE_SETTINGS.masterVolume);
    expect(director.dispose()).toBe(true);
    expect(director.dispose()).toBe(false);
    expect(tracks.every((track) => track.paused && track.src === '')).toBe(true);
    events.dispatchEvent(new Event('keydown'));
    await settle();
    expect(tracks).toHaveLength(1);
  });
});
