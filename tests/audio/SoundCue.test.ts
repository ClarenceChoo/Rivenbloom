import { describe, expect, it } from 'vitest';
import { soundVoices } from '../../src/game/audio/SoundCue';

describe('original sound motifs', () => {
  it('keeps impact short and descending, distinct from resonance rewards', () => {
    expect(
      soundVoices('impact').every(
        (voice) => voice.duration < 0.1 && voice.endFrequency < voice.frequency,
      ),
    ).toBe(true);
    const reward = soundVoices('cantor-lens-awaken');
    expect(reward.map((voice) => voice.frequency)).toEqual([392, 587.33, 783.99]);
    expect(reward[2]!.delay).toBeGreaterThan(reward[0]!.delay);
  });
  it('keeps envelopes finite, bounded and long enough for their attack ramp', () => {
    for (const cue of [
      'impact',
      'cantor-spearfall-tell',
      'cantor-lens-awaken',
      'cantor-heart-open',
      'cantor-defeat-release',
    ]) {
      for (const voice of soundVoices(cue)) {
        expect(voice.frequency).toBeGreaterThan(0);
        expect(voice.endFrequency).toBeGreaterThan(0);
        expect(voice.duration).toBeGreaterThan(0.008);
        expect(voice.duration + voice.delay).toBeLessThan(1);
        expect(voice.volume).toBeLessThanOrEqual(0.18);
      }
    }
  });
});
