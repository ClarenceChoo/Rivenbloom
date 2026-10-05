import { describe, expect, it } from 'vitest';

import {
  captionForCue,
  musicLayerForRoom,
  musicTrackFor,
} from '../../src/game/audio/AudioDirector';

describe('AudioDirector policy', () => {
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
