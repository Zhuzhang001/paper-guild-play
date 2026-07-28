import type { BossTier } from "../art";
import type { SeasonId, SolarTermCue, TermAmbienceCue } from "./solarTerms";

export type AudioBus = "music" | "sfx";

export type AudioCueDefinition = {
  url: string;
  bus: AudioBus;
  loop?: boolean;
  volume: number;
  cooldownMs?: number;
  maxVoices?: number;
  playbackRateVariation?: number;
};

const music = (url: string, volume: number): AudioCueDefinition => ({
  url,
  bus: "music",
  loop: true,
  volume,
  maxVoices: 1,
});

const ambience = (name: TermAmbienceCue, volume = 0.34): AudioCueDefinition => ({
  url: `/audio/ambience-${name}.wav`,
  bus: "sfx",
  volume,
  cooldownMs: 12_000,
  maxVoices: 1,
});

const weapon = (
  id: string,
  kind: "fire" | "hit",
  volume: number,
  cooldownMs: number,
): AudioCueDefinition => ({
  url: `/audio/weapon-${id}-${kind}.wav`,
  bus: "sfx",
  volume,
  cooldownMs,
  maxVoices: kind === "fire" ? 3 : 4,
  playbackRateVariation: 0.035,
});

export const AUDIO_CUES = {
  "music.spring": music("/audio/music-spring.wav", 0.56),
  "music.summer": music("/audio/music-summer.wav", 0.54),
  "music.autumn": music("/audio/music-autumn.wav", 0.55),
  "music.winter": music("/audio/music-winter.wav", 0.52),
  "music.endless": music("/audio/music-endless.wav", 0.44),
  "music.boss.taotie": music("/audio/music-boss-taotie.wav", 0.62),
  "music.boss.nian": music("/audio/music-boss-nian.wav", 0.64),

  "ambience.birds": ambience("birds"),
  "ambience.rain": ambience("rain", 0.3),
  "ambience.thunder": ambience("thunder", 0.42),
  "ambience.insects": ambience("insects", 0.25),
  "ambience.water": ambience("water", 0.28),
  "ambience.harvest": ambience("harvest", 0.3),
  "ambience.wind": ambience("wind", 0.28),
  "ambience.frost": ambience("frost", 0.26),
  "ambience.snow": ambience("snow", 0.22),
  "ambience.bells": ambience("bells", 0.34),

  "weapon.sword.fire": weapon("sword", "fire", 0.32, 74),
  "weapon.sword.hit": weapon("sword", "hit", 0.32, 46),
  "weapon.fan.fire": weapon("fan", "fire", 0.3, 110),
  "weapon.fan.hit": weapon("fan", "hit", 0.28, 62),
  "weapon.umbrella.fire": weapon("umbrella", "fire", 0.28, 130),
  "weapon.umbrella.hit": weapon("umbrella", "hit", 0.3, 70),
  "weapon.scissors.fire": weapon("scissors", "fire", 0.34, 90),
  "weapon.scissors.hit": weapon("scissors", "hit", 0.32, 52),
  "weapon.abacus.fire": weapon("abacus", "fire", 0.25, 58),
  "weapon.abacus.hit": weapon("abacus", "hit", 0.25, 42),
  "weapon.crossbow.fire": weapon("crossbow", "fire", 0.32, 68),
  "weapon.crossbow.hit": weapon("crossbow", "hit", 0.3, 44),
  "weapon.pipa.fire": weapon("pipa", "fire", 0.34, 92),
  "weapon.pipa.hit": weapon("pipa", "hit", 0.3, 58),
  "weapon.inkline.fire": weapon("inkline", "fire", 0.3, 105),
  "weapon.inkline.hit": weapon("inkline", "hit", 0.3, 60),
  "weapon.lantern.fire": weapon("lantern", "fire", 0.3, 120),
  "weapon.lantern.hit": weapon("lantern", "hit", 0.29, 64),
  "weapon.thunder.fire": weapon("thunder", "fire", 0.42, 125),
  "weapon.thunder.hit": weapon("thunder", "hit", 0.4, 80),

  "sfx.fold": { url: "/audio/sfx-fold.wav", bus: "sfx", volume: 0.38, cooldownMs: 180, maxVoices: 1 },
  "sfx.unfold": { url: "/audio/sfx-unfold.wav", bus: "sfx", volume: 0.38, cooldownMs: 180, maxVoices: 1 },
  "sfx.pickup": { url: "/audio/sfx-pickup.wav", bus: "sfx", volume: 0.3, cooldownMs: 34, maxVoices: 3, playbackRateVariation: 0.05 },
  "sfx.upgrade": { url: "/audio/sfx-upgrade.wav", bus: "sfx", volume: 0.48, cooldownMs: 200, maxVoices: 1 },
  "sfx.synergy": { url: "/audio/sfx-synergy.wav", bus: "sfx", volume: 0.5, cooldownMs: 300, maxVoices: 2 },
  "sfx.fusion": { url: "/audio/sfx-fusion.wav", bus: "sfx", volume: 0.58, cooldownMs: 500, maxVoices: 1 },
  "sfx.ultimate": { url: "/audio/sfx-ultimate.wav", bus: "sfx", volume: 0.66, cooldownMs: 900, maxVoices: 1 },
  "sfx.player-hit": { url: "/audio/sfx-player-hit.wav", bus: "sfx", volume: 0.46, cooldownMs: 180, maxVoices: 1 },
  "sfx.enemy-death": { url: "/audio/sfx-enemy-death.wav", bus: "sfx", volume: 0.28, cooldownMs: 45, maxVoices: 4, playbackRateVariation: 0.045 },
  "sfx.ui-confirm": { url: "/audio/sfx-ui-confirm.wav", bus: "sfx", volume: 0.38, cooldownMs: 70, maxVoices: 2 },
  "sfx.ui-back": { url: "/audio/sfx-ui-back.wav", bus: "sfx", volume: 0.32, cooldownMs: 70, maxVoices: 2 },
  "sfx.term-change": { url: "/audio/sfx-term-change.wav", bus: "sfx", volume: 0.34, cooldownMs: 1_000, maxVoices: 1 },
  "sfx.boss-taotie": { url: "/audio/sfx-boss-taotie.wav", bus: "sfx", volume: 0.66, cooldownMs: 4_000, maxVoices: 1 },
  "sfx.boss-nian": { url: "/audio/sfx-boss-nian.wav", bus: "sfx", volume: 0.68, cooldownMs: 4_000, maxVoices: 1 },
} as const satisfies Record<string, AudioCueDefinition>;

export type AudioCueId = keyof typeof AUDIO_CUES;
export type MusicCueId = Extract<AudioCueId, `music.${string}`>;
export type SfxCueId = Exclude<AudioCueId, MusicCueId>;

export type AudioSettings = {
  muted: boolean;
  master: number;
  music: number;
  sfx: number;
};

export type PlaySfxOptions = {
  volume?: number;
  playbackRate?: number;
  pan?: number;
  force?: boolean;
};

export type WorldMusicState = {
  season: SeasonId;
  endless: boolean;
  bossTier?: BossTier;
};

const DEFAULT_SETTINGS: AudioSettings = {
  muted: false,
  master: 0.8,
  music: 0.62,
  sfx: 0.78,
};

const STORAGE_KEY = "paper-guild.audio.v1";
const MUSIC_BY_SEASON: Readonly<Record<SeasonId, MusicCueId>> = {
  spring: "music.spring",
  summer: "music.summer",
  autumn: "music.autumn",
  winter: "music.winter",
};
const AMBIENCE_BY_TERM: Readonly<Record<TermAmbienceCue, SfxCueId>> = {
  birds: "ambience.birds",
  rain: "ambience.rain",
  thunder: "ambience.thunder",
  insects: "ambience.insects",
  water: "ambience.water",
  harvest: "ambience.harvest",
  wind: "ambience.wind",
  frost: "ambience.frost",
  snow: "ambience.snow",
  bells: "ambience.bells",
};

type Voice = {
  cue: AudioCueId;
  source: AudioBufferSourceNode;
  gain: GainNode;
};

type MusicVoice = Voice & {
  cue: MusicCueId;
};

type WebkitWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function readSettings(): AudioSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<AudioSettings>;
    return {
      muted: typeof saved.muted === "boolean" ? saved.muted : DEFAULT_SETTINGS.muted,
      master: clampUnit(saved.master ?? DEFAULT_SETTINGS.master),
      music: clampUnit(saved.music ?? DEFAULT_SETTINGS.music),
      sfx: clampUnit(saved.sfx ?? DEFAULT_SETTINGS.sfx),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function getWorldMusicCue(state: WorldMusicState): MusicCueId {
  if (state.bossTier === "mid") return "music.boss.taotie";
  if (state.bossTier === "final") return "music.boss.nian";
  if (state.endless) return "music.endless";
  return MUSIC_BY_SEASON[state.season];
}

export function getTermAmbienceCue(term: SolarTermCue): SfxCueId {
  return AMBIENCE_BY_TERM[term.ambience];
}

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private buffers = new Map<AudioCueId, AudioBuffer>();
  private loading = new Map<AudioCueId, Promise<AudioBuffer | null>>();
  private voices = new Set<Voice>();
  private lastPlayed = new Map<AudioCueId, number>();
  private musicVoice: MusicVoice | null = null;
  private requestedMusic: MusicCueId | null = null;
  private musicRequest = 0;
  private initialized = false;
  private destroyed = false;
  private pausedByVisibility = false;
  private settings: AudioSettings = readSettings();

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibility);
    }
  }

  get isInitialized() {
    return this.initialized;
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  async initFromGesture(): Promise<boolean> {
    if (this.destroyed || typeof window === "undefined") return false;
    if (!this.context) {
      const AudioContextClass = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!AudioContextClass) return false;
      this.context = new AudioContextClass();
      this.masterGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
      this.applySettings();
    }
    try {
      if (this.context.state !== "running") await this.context.resume();
      this.initialized = this.context.state === "running";
      return this.initialized;
    } catch {
      return false;
    }
  }

  setSettings(update: Partial<AudioSettings>) {
    this.settings = {
      muted: update.muted ?? this.settings.muted,
      master: clampUnit(update.master ?? this.settings.master),
      music: clampUnit(update.music ?? this.settings.music),
      sfx: clampUnit(update.sfx ?? this.settings.sfx),
    };
    this.applySettings();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch {
        // Storage can be unavailable in strict privacy modes; audio remains usable.
      }
    }
  }

  async preload(cues: readonly AudioCueId[]): Promise<void> {
    if (!this.initialized) return;
    await Promise.all(cues.map((cue) => this.load(cue)));
  }

  async playSfx(cue: SfxCueId, options: PlaySfxOptions = {}): Promise<boolean> {
    if (!this.initialized || !this.context || !this.sfxGain || this.settings.muted) return false;
    const definition: AudioCueDefinition = AUDIO_CUES[cue];
    const nowMs = performance.now();
    const lastPlayed = this.lastPlayed.get(cue) ?? Number.NEGATIVE_INFINITY;
    if (!options.force && nowMs - lastPlayed < (definition.cooldownMs ?? 0)) return false;
    const liveForCue = [...this.voices].filter((voice) => voice.cue === cue).length;
    if (!options.force && liveForCue >= (definition.maxVoices ?? 4)) return false;

    const buffer = await this.load(cue);
    if (!buffer || !this.context || !this.sfxGain || this.settings.muted) return false;
    this.lastPlayed.set(cue, performance.now());

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const variation = definition.playbackRateVariation ?? 0;
    const randomVariation = variation ? (Math.random() * 2 - 1) * variation : 0;
    source.buffer = buffer;
    source.playbackRate.value = Math.max(0.25, options.playbackRate ?? 1 + randomVariation);
    gain.gain.value = definition.volume * clampUnit(options.volume ?? 1);

    let destination: AudioNode = this.sfxGain;
    if (typeof this.context.createStereoPanner === "function" && options.pan !== undefined) {
      const panner = this.context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, options.pan));
      gain.connect(panner);
      panner.connect(this.sfxGain);
      destination = panner;
    }
    if (destination === this.sfxGain) gain.connect(this.sfxGain);
    source.connect(gain);

    const voice: Voice = { cue, source, gain };
    this.voices.add(voice);
    source.addEventListener("ended", () => {
      this.voices.delete(voice);
      source.disconnect();
      gain.disconnect();
    }, { once: true });
    source.start();
    return true;
  }

  async playMusic(cue: MusicCueId, fadeSeconds = 0.8): Promise<boolean> {
    this.requestedMusic = cue;
    if (!this.initialized || !this.context || !this.musicGain || this.settings.muted) return false;
    if (this.musicVoice?.cue === cue) return true;
    const request = ++this.musicRequest;
    const buffer = await this.load(cue);
    if (
      !buffer
      || request !== this.musicRequest
      || cue !== this.requestedMusic
      || !this.context
      || !this.musicGain
    ) return false;

    const now = this.context.currentTime;
    const fade = Math.max(0.05, fadeSeconds);
    const definition = AUDIO_CUES[cue];
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = definition.loop ?? true;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, definition.volume), now + fade);
    source.connect(gain);
    gain.connect(this.musicGain);
    source.start();

    const previous = this.musicVoice;
    const voice: MusicVoice = { cue, source, gain };
    this.musicVoice = voice;
    this.voices.add(voice);
    source.addEventListener("ended", () => {
      this.voices.delete(voice);
      if (this.musicVoice === voice) this.musicVoice = null;
      source.disconnect();
      gain.disconnect();
    }, { once: true });

    if (previous && this.context) {
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setValueAtTime(Math.max(0.0001, previous.gain.gain.value), now);
      previous.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      previous.source.stop(now + fade + 0.05);
    }
    return true;
  }

  async syncWorldMusic(state: WorldMusicState, fadeSeconds = 0.8): Promise<boolean> {
    return this.playMusic(getWorldMusicCue(state), fadeSeconds);
  }

  stopMusic(fadeSeconds = 0.35) {
    this.requestedMusic = null;
    this.musicRequest += 1;
    const voice = this.musicVoice;
    if (!voice || !this.context) return;
    this.musicVoice = null;
    const now = this.context.currentTime;
    const fade = Math.max(0.03, fadeSeconds);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    voice.source.stop(now + fade + 0.05);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.requestedMusic = null;
    this.musicRequest += 1;
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibility);
    }
    this.voices.forEach((voice) => {
      try {
        voice.source.stop();
      } catch {
        // A source may have already ended.
      }
    });
    this.voices.clear();
    this.buffers.clear();
    this.loading.clear();
    if (this.context && this.context.state !== "closed") void this.context.close();
    this.context = null;
    this.initialized = false;
  }

  private applySettings() {
    if (!this.context || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.context.currentTime;
    const master = this.settings.muted ? 0 : this.settings.master;
    this.masterGain.gain.setTargetAtTime(master, now, 0.02);
    this.musicGain.gain.setTargetAtTime(this.settings.music, now, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx, now, 0.02);
  }

  private load(cue: AudioCueId): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(cue);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(cue);
    if (pending) return pending;
    if (!this.context) return Promise.resolve(null);

    const context = this.context;
    const promise = fetch(AUDIO_CUES[cue].url)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load audio cue ${cue}: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        if (!this.destroyed) this.buffers.set(cue, buffer);
        return buffer;
      })
      .catch(() => null)
      .finally(() => {
        this.loading.delete(cue);
      });
    this.loading.set(cue, promise);
    return promise;
  }

  private handleVisibility = () => {
    if (!this.context || !this.initialized) return;
    if (document.hidden) {
      this.pausedByVisibility = this.context.state === "running";
      if (this.pausedByVisibility) void this.context.suspend();
    } else if (this.pausedByVisibility) {
      this.pausedByVisibility = false;
      void this.context.resume().catch(() => {
        // Some mobile browsers require a fresh gesture; the next init call retries.
        this.initialized = false;
      });
    }
  };
}
