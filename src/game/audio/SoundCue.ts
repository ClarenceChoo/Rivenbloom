export type SoundVoice = Readonly<{
  frequency: number;
  endFrequency: number;
  delay: number;
  duration: number;
  volume: number;
  wave: OscillatorType;
}>;

/** Original short motifs: percussive contact, falling danger and rising resonance. */
export function soundVoices(cue: string): readonly SoundVoice[] {
  if (cue === 'impact')
    return [
      {
        frequency: 190,
        endFrequency: 48,
        delay: 0,
        duration: 0.09,
        volume: 0.18,
        wave: 'triangle',
      },
      {
        frequency: 1100,
        endFrequency: 260,
        delay: 0,
        duration: 0.035,
        volume: 0.035,
        wave: 'sine',
      },
    ];
  const resolved = /lens|heart-open|defeat|release/.test(cue);
  const frequencies = resolved ? [392, 587.33, 783.99] : [196, 185];
  return frequencies.map((frequency, index) => ({
    frequency,
    endFrequency: resolved ? frequency : frequency * 0.75,
    delay: index * (resolved ? 0.09 : 0.12),
    duration: resolved ? 0.42 : 0.24,
    volume: resolved ? 0.065 : 0.08,
    wave: 'sine',
  }));
}
