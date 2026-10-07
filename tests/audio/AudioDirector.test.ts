import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  captionForCue,
  AudioDirector,
  musicLayerForRoom,
  musicTrackFor,
} from '../../src/game/audio/AudioDirector';

describe('AudioDirector policy', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reuses music media across returns and releases the bounded cache on disposal', async () => {
    vi.useFakeTimers();
    const listeners = new Map<string, () => void>();
    vi.stubGlobal('addEventListener', (event: string, listener: () => void) =>
      listeners.set(event, listener),
    );
    vi.stubGlobal('removeEventListener', vi.fn());
    const audio: { paused: boolean; load: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal(
      'Audio',
      class {
        public paused = true;
        public loop = false;
        public preload = '';
        public load = vi.fn();
        public constructor() {
          audio.push(this);
        }
        public play() {
          this.paused = false;
          return Promise.resolve();
        }
        public pause() {
          this.paused = true;
        }
        public removeAttribute() {}
      },
    );
    const gain = {
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    };
    const context = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createGain: () => gain,
      createMediaElementSource: () => ({ connect: () => gain, disconnect: vi.fn() }),
      close: () => Promise.resolve(),
    };
    const director = new AudioDirector({
      contextFactory: () => context as unknown as AudioContext,
    });
    listeners.get('keydown')!();
    await Promise.resolve();
    director.setMusicLayer('wren-rest');
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1250);
    expect(audio[0]!.paused).toBe(true);
    expect(audio[0]!.load).not.toHaveBeenCalled();
    director.setMusicLayer('menu');
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1250);
    expect(audio).toHaveLength(2);
    expect(audio[0]!.paused).toBe(false);
    director.setMusicLayer('wren-rest');
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);
    director.setMusicLayer('menu');
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1500);
    expect(audio).toHaveLength(2);
    expect(audio[0]!.paused).toBe(false);
    expect(audio[1]!.paused).toBe(true);
    director.dispose();
    expect(audio[1]!.paused).toBe(true);
    expect(audio[1]!.load).toHaveBeenCalledOnce();
  });

  it('maps semantic boss cues to useful selectable captions', () => {
    expect(captionForCue('cantor-spearfall-tell')).toMatch(/spears/i);
    expect(captionForCue('cantor-lens-awaken')).toMatch(/lens/i);
    expect(captionForCue('cantor-heart-open')).toMatch(/inner note/i);
    expect(captionForCue('cantor-defeat-release')).toMatch(/releases/i);
    expect(captionForCue('footstep')).toBeNull();
  });

  it('selects distinct playable tracks for the route and both boss phases', () => {
    expect(musicTrackFor('wren-rest').file).not.toBe(musicTrackFor('brackenreach').file);
    expect(musicTrackFor('brackenreach').file).not.toBe(musicTrackFor('singing-hollows').file);
    expect(musicTrackFor('singing-hollows').file).not.toBe(
      musicTrackFor('rootglass-reliquary').file,
    );
    expect(musicTrackFor('first-verse').file).not.toBe(musicTrackFor('broken-refrain').file);
    expect(musicTrackFor('release').loop).toBe(false);
  });

  it('brings in the elite cue for the sentinel room, then returns to the area theme', () => {
    expect(musicLayerForRoom('brackenreach', ['thorn-sentinel'])).toBe('thorn-sentinel');
    expect(musicLayerForRoom('brackenreach', ['spore-scribe'])).toBe('brackenreach');
  });
});
