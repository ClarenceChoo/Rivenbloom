import type { SaveSettings } from '../saves/SaveSchema';

export type AudioLayer =
  | 'menu'
  | 'wren-rest'
  | 'brackenreach'
  | 'thorn-sentinel'
  | 'singing-hollows'
  | 'rootglass-reliquary'
  | 'hollow-choir'
  | 'first-verse'
  | 'broken-refrain'
  | 'heart-opening'
  | 'release';

type MusicTrack = Readonly<{
  file: string;
  loop: boolean;
}>;

const MUSIC_TRACKS: Record<AudioLayer, MusicTrack> = {
  menu: { file: '11-where-the-lanterns-wake.mp3', loop: true },
  'wren-rest': { file: '02-lanterns-above-the-rain.mp3', loop: true },
  brackenreach: { file: '11-where-the-lanterns-wake.mp3', loop: true },
  'thorn-sentinel': { file: '06-copper-and-briar.mp3', loop: true },
  'singing-hollows': { file: '04-what-the-roots-remember.mp3', loop: true },
  'rootglass-reliquary': { file: '05-an-archive-under-water.mp3', loop: true },
  'hollow-choir': { file: '07-the-unanswered-note.mp3', loop: true },
  'first-verse': { file: '08-first-verse-of-the-hollow.mp3', loop: true },
  'broken-refrain': { file: '12-a-voice-through-glass.mp3', loop: true },
  'heart-opening': { file: '12-a-voice-through-glass.mp3', loop: true },
  release: { file: '10-the-song-released.mp3', loop: false },
};

type PlayingTrack = {
  file: string;
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  starting: boolean;
  revision: number;
  retirement: ReturnType<typeof globalThis.setTimeout> | null;
};

export function musicTrackFor(layer: AudioLayer): MusicTrack {
  return MUSIC_TRACKS[layer];
}

export function musicLayerForRoom(areaId: string, actorIds: readonly string[]): string {
  return actorIds.includes('thorn-sentinel') ? 'thorn-sentinel' : areaId;
}

export type AudioDirectorOptions = Readonly<{
  contextFactory?: () => AudioContext;
  caption?(copy: string): void;
}>;

export class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private ambience: GainNode | null = null;
  private settings: SaveSettings | null = null;
  private layer: AudioLayer = 'menu';
  private playing: PlayingTrack[] = [];
  private readonly tracks = new Map<string, PlayingTrack>();
  private fadeTimers = new Set<ReturnType<typeof globalThis.setTimeout>>();
  private heartTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private disposed = false;
  private readonly unlock = () => void this.ensureContext();
  private readonly visibility = () => this.applyVisibility();

  public constructor(private readonly options: AudioDirectorOptions = {}) {
    globalThis.addEventListener('keydown', this.unlock, { once: true });
    globalThis.addEventListener('pointerdown', this.unlock, { once: true });
    globalThis.document?.addEventListener('visibilitychange', this.visibility);
  }

  public applySettings(settings: SaveSettings): void {
    this.settings = Object.freeze({ ...settings });
    this.applyGains();
  }

  public setMusicLayer(layer: AudioLayer | string): void {
    if (!isAudioLayer(layer)) return;
    if (this.layer === layer) return;
    this.layer = layer;
    if (this.heartTimer !== null) globalThis.clearTimeout(this.heartTimer);
    this.heartTimer = null;
    if (layer === 'heart-opening') {
      this.heartTimer = globalThis.setTimeout(() => {
        this.heartTimer = null;
        this.applyGains();
      }, 5_000);
    }
    this.applyGains();
    if (this.context !== null) this.transitionMusic();
  }

  public playCue(cueId: string, caption = captionForCue(cueId)): void {
    if (this.disposed) return;
    if (caption !== null && this.settings?.subtitles !== false) this.options.caption?.(caption);
    const context = this.context;
    const destination = this.sfx;
    if (context === null || destination === null) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequency = 180 + (stableHash(cueId) % 520);
    oscillator.type = cueId.includes('cantor') ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.disposed = true;
    globalThis.removeEventListener('keydown', this.unlock);
    globalThis.removeEventListener('pointerdown', this.unlock);
    globalThis.document?.removeEventListener('visibilitychange', this.visibility);
    if (this.heartTimer !== null) globalThis.clearTimeout(this.heartTimer);
    this.heartTimer = null;
    for (const timer of this.fadeTimers) globalThis.clearTimeout(timer);
    this.fadeTimers.clear();
    for (const track of this.tracks.values()) {
      this.stopTrack(track);
      track.audio.removeAttribute('src');
      track.source.disconnect();
      track.gain.disconnect();
      track.audio.load();
    }
    this.tracks.clear();
    this.playing = [];
    void this.context?.close().catch(() => undefined);
    this.context = null;
    return true;
  }

  private async ensureContext(): Promise<void> {
    if (this.disposed) return;
    if (this.context === null) {
      const factory =
        this.options.contextFactory ??
        (() => {
          const Constructor = globalThis.AudioContext;
          if (Constructor === undefined) throw new Error('Web Audio is unavailable.');
          return new Constructor();
        });
      try {
        this.context = factory();
      } catch {
        return;
      }
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.sfx = this.context.createGain();
      this.ambience = this.context.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.ambience.connect(this.master);
      this.master.connect(this.context.destination);
      this.applyGains();
      this.transitionMusic();
    }
    if (this.context.state === 'suspended') await this.context.resume().catch(() => undefined);
    if (this.playing.length === 0 || this.playing.every(({ audio }) => audio.paused))
      this.transitionMusic();
  }

  private transitionMusic(): void {
    const context = this.context;
    const destination = this.music;
    if (this.disposed || context === null || destination === null) return;
    const cue = musicTrackFor(this.layer);
    let incoming = this.tracks.get(cue.file);
    if (
      incoming !== undefined &&
      incoming.retirement === null &&
      (incoming.starting || !incoming.audio.paused)
    )
      return;
    if (incoming === undefined) {
      const audio = new Audio(`/assets/audio/rivenbloom/${cue.file}`);
      audio.loop = cue.loop;
      audio.preload = 'auto';
      const gain = context.createGain();
      gain.gain.value = 0;
      const source = context.createMediaElementSource(audio);
      source.connect(gain).connect(destination);
      incoming = {
        file: cue.file,
        audio,
        source,
        gain,
        starting: false,
        revision: 0,
        retirement: null,
      };
      this.tracks.set(cue.file, incoming);
    }
    const track = incoming;
    if (track.retirement !== null) {
      globalThis.clearTimeout(track.retirement);
      this.fadeTimers.delete(track.retirement);
      track.retirement = null;
    }
    const revision = ++track.revision;
    track.starting = true;
    if (!this.playing.includes(track)) this.playing.push(track);
    const { audio, gain } = track;
    void audio
      .play()
      .then(() => {
        if (this.disposed || track.revision !== revision) return;
        track.starting = false;
        if (musicTrackFor(this.layer).file !== track.file) {
          this.stopTrack(track);
          return;
        }
        const now = context.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(1, now + 1.2);
        for (const old of this.playing.filter((entry) => entry !== track)) {
          if (old.retirement !== null) {
            globalThis.clearTimeout(old.retirement);
            this.fadeTimers.delete(old.retirement);
          }
          old.gain.gain.cancelScheduledValues(now);
          old.gain.gain.setValueAtTime(old.gain.gain.value, now);
          old.gain.gain.linearRampToValueAtTime(0, now + 1.2);
          const timer = globalThis.setTimeout(() => {
            this.fadeTimers.delete(timer);
            this.stopTrack(old);
          }, 1_250);
          this.fadeTimers.add(timer);
          old.retirement = timer;
        }
      })
      .catch(() => {
        if (track.revision === revision) this.stopTrack(track);
      });
  }

  private stopTrack(track: PlayingTrack): void {
    if (track.retirement !== null) {
      globalThis.clearTimeout(track.retirement);
      this.fadeTimers.delete(track.retirement);
    }
    track.audio.pause();
    track.revision += 1;
    track.starting = false;
    track.retirement = null;
    track.gain.gain.cancelScheduledValues(this.context?.currentTime ?? 0);
    track.gain.gain.value = 0;
    this.playing = this.playing.filter((entry) => entry !== track);
  }

  private applyGains(): void {
    const settings = this.settings;
    if (settings === null) return;
    const muted = settings.muteWhenUnfocused && globalThis.document?.hidden === true;
    if (this.master !== null) this.master.gain.value = muted ? 0 : settings.masterVolume;
    if (this.music !== null)
      this.music.gain.value = settings.musicVolume * (this.heartTimer !== null ? 0.45 : 1);
    if (this.sfx !== null) this.sfx.gain.value = settings.sfxVolume;
    if (this.ambience !== null) this.ambience.gain.value = settings.ambienceVolume;
  }

  private applyVisibility(): void {
    this.applyGains();
    if (!globalThis.document?.hidden) void this.ensureContext();
  }
}

export function captionForCue(cueId: string): string | null {
  if (cueId.includes('spear')) return '[Rootglass spears gather overhead]';
  if (cueId.includes('lens')) return '[A resonance lens awakens]';
  if (cueId.includes('heart-open')) return '[The Cantor’s inner note rings clear]';
  if (cueId.includes('defeat') || cueId.includes('release')) return '[The hollow song releases]';
  if (cueId.includes('cantor')) return '[The Pallid Cantor intones]';
  return null;
}

function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

function isAudioLayer(value: string): value is AudioLayer {
  return [
    'menu',
    'wren-rest',
    'brackenreach',
    'thorn-sentinel',
    'singing-hollows',
    'rootglass-reliquary',
    'hollow-choir',
    'first-verse',
    'broken-refrain',
    'heart-opening',
    'release',
  ].includes(value);
}
