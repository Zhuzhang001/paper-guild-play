import type { BossTier } from "../art";
import type { FusionId } from "../content";
import type { SeasonId, SolarTermCue, TermAmbienceCue } from "./solarTerms";

export type AudioBus = "music" | "ambient" | "sfx";
export type AudioLane =
  | "combat-base"
  | "combat-accent"
  | "world"
  | "ui"
  | "priority";

export type SfxCategory =
  | "ambience"
  | "weapon-fire"
  | "weapon-hit"
  | "fusion"
  | "form"
  | "pickup"
  | "death"
  | "ui"
  | "term"
  | "milestone"
  | "player"
  | "boss";

export type AudioCueDefinition = {
  url: string | readonly string[];
  bus: AudioBus;
  loop?: boolean;
  volume: number;
  cooldownMs?: number;
  categoryCooldownMs?: number;
  maxVoices?: number;
  playbackRateVariation?: number;
  priority?: number;
  category?: SfxCategory;
  frameLimit?: number;
  exclusiveGroup?: string;
  duckMusicDb?: number;
  duckSeconds?: number;
  lane?: AudioLane;
};

const music = (url: string, volume = 0.84): AudioCueDefinition => ({
  url,
  bus: "music",
  loop: true,
  volume,
  maxVoices: 1,
});

const ambience = (name: TermAmbienceCue, volume = 0.82): AudioCueDefinition => ({
  url: `/audio/ambience-${name}.m4a`,
  bus: "ambient",
  volume,
  cooldownMs: 18_000,
  maxVoices: 1,
  priority: 8,
  category: "ambience",
  frameLimit: 1,
  lane: "world",
});

const weapon = (
  id: string,
  kind: "fire" | "hit",
  volume: number,
  cooldownMs: number,
): AudioCueDefinition => ({
  url: [1, 2, 3].map(
    (variant) => `/audio/weapon-${id}-${kind}-${variant}.wav`,
  ),
  bus: "sfx",
  volume,
  cooldownMs,
  categoryCooldownMs: kind === "fire" ? 110 : 150,
  maxVoices: kind === "fire" ? 1 : 2,
  playbackRateVariation: kind === "fire" ? 0.004 : 0.006,
  priority: kind === "fire" ? 30 : 25,
  category: kind === "fire" ? "weapon-fire" : "weapon-hit",
  frameLimit: 1,
  lane: "combat-base",
});

const fusion = (id: FusionId, materialBias: number): AudioCueDefinition => ({
  url: `/audio/fusion-${id}.wav`,
  bus: "sfx",
  volume: 0.42,
  cooldownMs: 420,
  categoryCooldownMs: 260,
  maxVoices: 1,
  playbackRateVariation: Math.abs(materialBias) * 0.01,
  priority: 34,
  category: "fusion",
  frameLimit: 1,
  lane: "combat-accent",
});

const sfx = (
  url: string,
  volume: number,
  category: SfxCategory,
  priority: number,
  options: Partial<AudioCueDefinition> = {},
): AudioCueDefinition => ({
  url,
  bus: "sfx",
  volume,
  category,
  priority,
  maxVoices: 1,
  frameLimit: 1,
  lane:
    category === "boss" || category === "player" || category === "milestone"
      ? "priority"
      : category === "term"
        ? "world"
        : "ui",
  ...options,
});

export const AUDIO_CUES = {
  "music.spring": music("/audio/music-spring.m4a"),
  "music.summer": music("/audio/music-summer.m4a", 0.94),
  "music.autumn": music("/audio/music-autumn.m4a", 0.96),
  "music.winter": music("/audio/music-winter.m4a", 0.92),
  "music.endless": music("/audio/music-endless.m4a", 0.94),
  "music.boss.taotie": music("/audio/music-boss-taotie.m4a", 1),
  "music.boss.nian": music("/audio/music-boss-nian.m4a", 1),

  "ambience.birds": ambience("birds", 0.76),
  "ambience.rain": ambience("rain", 0.68),
  "ambience.thunder": ambience("thunder", 0.86),
  "ambience.insects": ambience("insects", 0.7),
  "ambience.water": ambience("water", 0.78),
  "ambience.harvest": ambience("harvest", 0.78),
  "ambience.wind": ambience("wind", 0.76),
  "ambience.frost": ambience("frost", 0.72),
  "ambience.snow": ambience("snow", 0.76),
  "ambience.bells": ambience("bells", 0.74),

  "weapon.sword.fire": weapon("sword", "fire", 0.58, 145),
  "weapon.sword.hit": weapon("sword", "hit", 0.48, 125),
  "weapon.fan.fire": weapon("fan", "fire", 0.54, 165),
  "weapon.fan.hit": weapon("fan", "hit", 0.44, 135),
  "weapon.umbrella.fire": weapon("umbrella", "fire", 0.54, 175),
  "weapon.umbrella.hit": weapon("umbrella", "hit", 0.46, 140),
  "weapon.scissors.fire": weapon("scissors", "fire", 0.56, 150),
  "weapon.scissors.hit": weapon("scissors", "hit", 0.48, 125),
  "weapon.abacus.fire": weapon("abacus", "fire", 0.5, 135),
  "weapon.abacus.hit": weapon("abacus", "hit", 0.42, 120),
  "weapon.crossbow.fire": weapon("crossbow", "fire", 0.56, 140),
  "weapon.crossbow.hit": weapon("crossbow", "hit", 0.44, 120),
  "weapon.pipa.fire": weapon("pipa", "fire", 0.56, 160),
  "weapon.pipa.hit": weapon("pipa", "hit", 0.46, 130),
  "weapon.inkline.fire": weapon("inkline", "fire", 0.54, 165),
  "weapon.inkline.hit": weapon("inkline", "hit", 0.44, 135),
  "weapon.lantern.fire": weapon("lantern", "fire", 0.52, 175),
  "weapon.lantern.hit": weapon("lantern", "hit", 0.44, 140),
  "weapon.thunder.fire": weapon("thunder", "fire", 0.62, 190),
  "weapon.thunder.hit": weapon("thunder", "hit", 0.54, 155),

  "fusion.mistCanopy": fusion("mistCanopy", -0.08),
  "fusion.thunderCanopy": fusion("thunderCanopy", 0.08),
  "fusion.inkGaleRule": fusion("inkGaleRule", -0.05),
  "fusion.starPiercer": fusion("starPiercer", 0.05),
  "fusion.lanternSword": fusion("lanternSword", -0.08),
  "fusion.swordheartPipa": fusion("swordheartPipa", 0.08),
  "fusion.heavenlyLedger": fusion("heavenlyLedger", -0.05),
  "fusion.worldTailor": fusion("worldTailor", 0.05),
  "fusion.raincutCanopy": fusion("raincutCanopy", -0.08),
  "fusion.jadePearlCadence": fusion("jadePearlCadence", 0.08),
  "fusion.linkedLedgerCase": fusion("linkedLedgerCase", -0.05),
  "fusion.lanternBallista": fusion("lanternBallista", 0.05),
  "fusion.inklineRepeater": fusion("inklineRepeater", -0.08),
  "fusion.thunderPipa": fusion("thunderPipa", 0.08),
  "fusion.myriadLanternCanopy": fusion("myriadLanternCanopy", -0.05),
  "fusion.galeBamboo": fusion("galeBamboo", 0.05),
  "fusion.hiddenSwordCanopy": fusion("hiddenSwordCanopy", -0.08),
  "fusion.twinTailorBlades": fusion("twinTailorBlades", 0.08),
  "fusion.inkRuleSword": fusion("inkRuleSword", -0.05),
  "fusion.windRepeater": fusion("windRepeater", 0.05),
  "fusion.rainStringCanopy": fusion("rainStringCanopy", -0.08),
  "fusion.windStringPass": fusion("windStringPass", 0.08),
  "fusion.inkRainBoundary": fusion("inkRainBoundary", -0.05),
  "fusion.stringScissor": fusion("stringScissor", 0.05),
  "fusion.shadowScissor": fusion("shadowScissor", -0.08),
  "fusion.pearlInkLine": fusion("pearlInkLine", 0.08),
  "fusion.countedLantern": fusion("countedLantern", -0.05),
  "fusion.pearlThunder": fusion("pearlThunder", 0.05),
  "fusion.thunderBoltRoad": fusion("thunderBoltRoad", -0.08),
  "fusion.inkScore": fusion("inkScore", 0.08),
  "fusion.countedSword": fusion("countedSword", -0.05),
  "fusion.markedThunderSword": fusion("markedThunderSword", 0.05),
  "fusion.windScissors": fusion("windScissors", -0.08),
  "fusion.windAbacus": fusion("windAbacus", 0.08),
  "fusion.windLantern": fusion("windLantern", -0.05),
  "fusion.windThunder": fusion("windThunder", 0.05),
  "fusion.beadCanopy": fusion("beadCanopy", -0.08),
  "fusion.canopyVolley": fusion("canopyVolley", 0.08),
  "fusion.boltScissors": fusion("boltScissors", -0.05),
  "fusion.thunderScissors": fusion("thunderScissors", 0.05),
  "fusion.stringCrossbow": fusion("stringCrossbow", -0.08),
  "fusion.lanternStrings": fusion("lanternStrings", 0.08),
  "fusion.inkShadow": fusion("inkShadow", -0.05),
  "fusion.inkThunderRoad": fusion("inkThunderRoad", 0.05),
  "fusion.lanternThunder": fusion("lanternThunder", -0.08),

  "sfx.fold": sfx("/audio/sfx-fold.wav", 0.62, "form", 42, {
    cooldownMs: 250,
    categoryCooldownMs: 220,
    exclusiveGroup: "player-form",
  }),
  "sfx.unfold": sfx("/audio/sfx-unfold.wav", 0.62, "form", 42, {
    cooldownMs: 250,
    categoryCooldownMs: 220,
    exclusiveGroup: "player-form",
  }),
  "sfx.pickup": sfx("/audio/sfx-pickup.wav", 0.48, "pickup", 18, {
    cooldownMs: 90,
    maxVoices: 2,
    playbackRateVariation: 0.025,
  }),
  "sfx.upgrade": sfx("/audio/sfx-upgrade.wav", 0.76, "milestone", 66, {
    cooldownMs: 300,
    duckMusicDb: -2.5,
    duckSeconds: 0.8,
  }),
  "sfx.synergy": sfx("/audio/sfx-synergy.wav", 0.78, "milestone", 70, {
    cooldownMs: 450,
    duckMusicDb: -3,
    duckSeconds: 1,
  }),
  "sfx.fusion": sfx("/audio/sfx-fusion.wav", 0.82, "milestone", 78, {
    cooldownMs: 700,
    duckMusicDb: -3.5,
    duckSeconds: 1.2,
  }),
  "sfx.ultimate": sfx("/audio/sfx-ultimate.wav", 0.86, "milestone", 92, {
    cooldownMs: 1_400,
    duckMusicDb: -4,
    duckSeconds: 1.55,
  }),
  "sfx.player-hit": sfx("/audio/sfx-player-hit.wav", 0.72, "player", 88, {
    cooldownMs: 240,
    duckMusicDb: -2.5,
    duckSeconds: 0.55,
  }),
  "sfx.enemy-death": sfx("/audio/sfx-enemy-death.wav", 0.4, "death", 14, {
    cooldownMs: 150,
    maxVoices: 2,
    playbackRateVariation: 0.025,
  }),
  "sfx.ui-confirm": sfx("/audio/sfx-ui-confirm.wav", 0.52, "ui", 45, {
    cooldownMs: 180,
    categoryCooldownMs: 160,
  }),
  "sfx.ui-back": sfx("/audio/sfx-ui-back.wav", 0.48, "ui", 44, {
    cooldownMs: 180,
    categoryCooldownMs: 160,
  }),
  "sfx.term-change": sfx("/audio/sfx-term-change.wav", 0.54, "term", 36, {
    cooldownMs: 1_500,
  }),
  "sfx.boss-taotie": sfx("/audio/sfx-boss-taotie.wav", 0.88, "boss", 98, {
    cooldownMs: 5_000,
    duckMusicDb: -5,
    duckSeconds: 1.8,
  }),
  "sfx.boss-nian": sfx("/audio/sfx-boss-nian.wav", 0.88, "boss", 100, {
    cooldownMs: 5_000,
    duckMusicDb: -5,
    duckSeconds: 1.9,
  }),
} as const satisfies Record<string, AudioCueDefinition>;

export type AudioCueId = keyof typeof AUDIO_CUES;
export type MusicCueId = Extract<AudioCueId, `music.${string}`>;
export type SfxCueId = Exclude<AudioCueId, MusicCueId>;
export type FusionSfxCueId = Extract<SfxCueId, `fusion.${string}`>;

export function getFusionSfxCue(id: FusionId): FusionSfxCueId {
  return `fusion.${id}` as FusionSfxCueId;
}

export type AudioSettings = {
  muted: boolean;
  master: number;
  music: number;
  sfx: number;
  ambient?: number;
};

type ResolvedAudioSettings = Required<AudioSettings>;

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

export type AudioFramePlanEntry = {
  cue: SfxCueId;
  count: number;
  priority: number;
};

const DEFAULT_SETTINGS: ResolvedAudioSettings = {
  muted: false,
  master: 0.68,
  music: 0.5,
  sfx: 0.42,
  ambient: 0.24,
};

const PREVIOUS_DEFAULT_SETTINGS: ResolvedAudioSettings = {
  muted: false,
  master: 0.72,
  music: 0.6,
  sfx: 0.56,
  ambient: 0.4,
};

export const AUDIO_MIX_LIMITS = {
  mobileSfxVoices: 8,
  desktopSfxVoices: 10,
} as const;

const STORAGE_KEY = "paper-guild.audio.v1";
const MIX_REVISION = 3;
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
  priority: number;
  startedAt: number;
  bus: AudioBus;
  cleanup: () => void;
};

type MusicVoice = Voice & {
  cue: MusicCueId;
};

type QueuedSfxRequest = {
  cue: SfxCueId;
  options: PlaySfxOptions;
  resolve: (played: boolean) => void;
};

type WebkitWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function definitionFor(cue: AudioCueId): AudioCueDefinition {
  return AUDIO_CUES[cue] as AudioCueDefinition;
}

function cueUrls(definition: AudioCueDefinition): readonly string[] {
  return typeof definition.url === "string"
    ? [definition.url]
    : definition.url;
}

function readSettings(): ResolvedAudioSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as
      Partial<ResolvedAudioSettings> & { mixRevision?: number };
    const migrateValue = (
      key: "master" | "music" | "sfx" | "ambient",
    ) => {
      const value = saved[key];
      if (typeof value !== "number") return DEFAULT_SETTINGS[key];
      if (
        saved.mixRevision !== MIX_REVISION &&
        Math.abs(value - PREVIOUS_DEFAULT_SETTINGS[key]) < 0.001
      ) {
        return DEFAULT_SETTINGS[key];
      }
      return value;
    };
    return {
      muted: typeof saved.muted === "boolean" ? saved.muted : DEFAULT_SETTINGS.muted,
      master: clampUnit(migrateValue("master")),
      music: clampUnit(migrateValue("music")),
      sfx: clampUnit(migrateValue("sfx")),
      ambient: clampUnit(migrateValue("ambient")),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function nowMilliseconds() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function isAtmosphere(cue: SfxCueId) {
  const category = definitionFor(cue).category;
  return category === "ambience" || category === "term";
}

export function planSfxFrame(
  cues: readonly SfxCueId[],
  suppressAtmosphere = false,
): AudioFramePlanEntry[] {
  const grouped = new Map<SfxCueId, { count: number; lastIndex: number }>();
  cues.forEach((cue, index) => {
    const current = grouped.get(cue);
    grouped.set(cue, {
      count: (current?.count ?? 0) + 1,
      lastIndex: index,
    });
  });

  const bossInFrame = [...grouped.keys()].some((cue) => definitionFor(cue).category === "boss");
  const fusionInFrame = [...grouped.keys()].some(
    (cue) => definitionFor(cue).category === "fusion",
  );
  const candidates = [...grouped.entries()]
    .filter(([cue]) => !(suppressAtmosphere || bossInFrame) || !isAtmosphere(cue))
    .filter(([cue]) => {
      if (!fusionInFrame) return true;
      const category = definitionFor(cue).category;
      return category !== "weapon-fire" && category !== "weapon-hit";
    })
    .map(([cue, meta]) => ({
      cue,
      count: meta.count,
      lastIndex: meta.lastIndex,
      definition: definitionFor(cue),
    }));

  const exclusiveWinners = new Map<string, number>();
  for (const candidate of candidates) {
    const group = candidate.definition.exclusiveGroup;
    if (group) {
      exclusiveWinners.set(group, Math.max(candidate.lastIndex, exclusiveWinners.get(group) ?? -1));
    }
  }

  const byCategory = new Map<SfxCategory, typeof candidates>();
  for (const candidate of candidates) {
    const exclusive = candidate.definition.exclusiveGroup;
    if (exclusive && exclusiveWinners.get(exclusive) !== candidate.lastIndex) continue;
    const category = candidate.definition.category ?? "ui";
    const entries = byCategory.get(category) ?? [];
    entries.push(candidate);
    byCategory.set(category, entries);
  }

  const selected: typeof candidates = [];
  for (const entries of byCategory.values()) {
    entries.sort((left, right) =>
      (right.definition.priority ?? 0) - (left.definition.priority ?? 0)
      || right.count - left.count
      || right.lastIndex - left.lastIndex);
    const limit = Math.max(1, entries[0]?.definition.frameLimit ?? entries.length);
    selected.push(...entries.slice(0, limit));
  }

  return selected
    .sort((left, right) =>
      (right.definition.priority ?? 0) - (left.definition.priority ?? 0)
      || left.lastIndex - right.lastIndex)
    .map(({ cue, count, definition }) => ({
      cue,
      count,
      priority: definition.priority ?? 0,
    }));
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
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private combatBaseGain: GainNode | null = null;
  private combatAccentGain: GainNode | null = null;
  private musicDuckGain: GainNode | null = null;
  private ambientDuckGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private voices = new Set<Voice>();
  private lastPlayed = new Map<AudioCueId, number>();
  private lastCategoryPlayed = new Map<SfxCategory, number>();
  private pendingByCue = new Map<AudioCueId, number>();
  private pendingVoiceCount = 0;
  private pendingFrame: QueuedSfxRequest[] = [];
  private frameScheduled = false;
  private frameRequest = 0;
  private frameTimer: ReturnType<typeof setTimeout> | null = null;
  private musicVoice: MusicVoice | null = null;
  private requestedMusic: MusicCueId | null = null;
  private musicRequest = 0;
  private bossQuietUntil = 0;
  private initialized = false;
  private destroyed = false;
  private pausedByLifecycle = false;
  private settings: ResolvedAudioSettings = readSettings();
  private readonly sfxVoiceLimit: number;

  constructor() {
    const coarsePointer = typeof window !== "undefined"
      && (navigator.maxTouchPoints > 0 || window.matchMedia?.("(pointer: coarse)").matches);
    this.sfxVoiceLimit = coarsePointer
      ? AUDIO_MIX_LIMITS.mobileSfxVoices
      : AUDIO_MIX_LIMITS.desktopSfxVoices;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibility);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", this.handlePageHide);
      window.addEventListener("pageshow", this.handlePageShow);
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
    if (this.context?.state === "closed") this.resetClosedContext();
    if (!this.context) {
      const AudioContextClass = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!AudioContextClass) return false;
      this.context = new AudioContextClass({ latencyHint: "interactive" });
      this.createAudioGraph();
    }
    try {
      if (this.context.state !== "running") await this.context.resume();
      this.initialized = this.context.state === "running";
      if (this.initialized && this.requestedMusic && !this.musicVoice) {
        void this.playMusic(this.requestedMusic, 0.18);
      }
      return this.initialized;
    } catch {
      this.initialized = false;
      return false;
    }
  }

  setSettings(update: Partial<AudioSettings>) {
    this.settings = {
      muted: update.muted ?? this.settings.muted,
      master: clampUnit(update.master ?? this.settings.master),
      music: clampUnit(update.music ?? this.settings.music),
      sfx: clampUnit(update.sfx ?? this.settings.sfx),
      ambient: clampUnit(update.ambient ?? this.settings.ambient),
    };
    this.applySettings();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...this.settings,
          mixRevision: MIX_REVISION,
        }));
      } catch {
        // Audio remains usable when storage is unavailable.
      }
    }
  }

  async preload(cues: readonly AudioCueId[]): Promise<void> {
    if (!this.initialized) return;
    await Promise.all(cues.map((cue) => this.load(cue)));
  }

  playSfx(cue: SfxCueId, options: PlaySfxOptions = {}): Promise<boolean> {
    if (
      !this.initialized
      || !this.context
      || this.context.state !== "running"
      || this.settings.muted
      || this.destroyed
      || (typeof document !== "undefined" && document.hidden)
    ) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      this.pendingFrame.push({ cue, options, resolve });
      this.scheduleFrameFlush();
    });
  }

  async playMusic(cue: MusicCueId, fadeSeconds = 0.8): Promise<boolean> {
    this.requestedMusic = cue;
    if (!this.initialized || !this.context || !this.musicGain || this.settings.muted) return false;
    if (this.musicVoice?.cue === cue) return true;
    const request = ++this.musicRequest;
    const definition = definitionFor(cue);
    const urls = cueUrls(definition);
    const buffer = await this.load(cue, urls[0]);
    if (
      !buffer
      || request !== this.musicRequest
      || cue !== this.requestedMusic
      || !this.context
      || !this.musicGain
      || this.context.state !== "running"
    ) return false;

    const now = this.context.currentTime;
    const fade = Math.max(0.05, fadeSeconds);
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = definition.loop ?? true;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, definition.volume), now + fade);
    source.connect(gain);
    gain.connect(this.musicGain);

    const voice = this.registerVoice({
      cue,
      source,
      gain,
      priority: 0,
      bus: "music",
    }) as MusicVoice;
    this.musicVoice = voice;
    source.start();

    const previous = [...this.voices]
      .filter((candidate): candidate is MusicVoice =>
        candidate.bus === "music" && candidate !== voice)
      .sort((left, right) => right.startedAt - left.startedAt)[0];
    if (previous) {
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
    this.cancelFrameFlush();
    this.rejectPendingFrame();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibility);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", this.handlePageHide);
      window.removeEventListener("pageshow", this.handlePageShow);
    }
    for (const voice of [...this.voices]) {
      try {
        voice.source.stop();
      } catch {
        voice.cleanup();
      }
    }
    this.voices.clear();
    this.buffers.clear();
    this.loading.clear();
    if (this.context && this.context.state !== "closed") void this.context.close();
    this.context = null;
    this.initialized = false;
  }

  private createAudioGraph() {
    if (!this.context) return;
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.ambientGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.combatBaseGain = this.context.createGain();
    this.combatAccentGain = this.context.createGain();
    this.musicDuckGain = this.context.createGain();
    this.ambientDuckGain = this.context.createGain();
    const sfxCompressor = this.context.createDynamicsCompressor();
    const limiter = this.context.createDynamicsCompressor();
    const outputCeiling = this.context.createGain();

    sfxCompressor.threshold.value = -20;
    sfxCompressor.knee.value = 10;
    sfxCompressor.ratio.value = 2.5;
    sfxCompressor.attack.value = 0.008;
    sfxCompressor.release.value = 0.11;
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.09;
    outputCeiling.gain.value = 0.84;

    this.musicGain.connect(this.musicDuckGain);
    this.musicDuckGain.connect(this.masterGain);
    this.ambientGain.connect(this.ambientDuckGain);
    this.ambientDuckGain.connect(this.masterGain);
    this.combatBaseGain.connect(this.sfxGain);
    this.combatAccentGain.connect(this.sfxGain);
    this.sfxGain.connect(sfxCompressor);
    sfxCompressor.connect(this.masterGain);
    this.masterGain.connect(limiter);
    limiter.connect(outputCeiling);
    outputCeiling.connect(this.context.destination);
    this.applySettings();
  }

  private applySettings() {
    if (!this.context || !this.masterGain || !this.musicGain || !this.ambientGain || !this.sfxGain) return;
    const now = this.context.currentTime;
    const master = this.settings.muted ? 0 : this.settings.master;
    this.masterGain.gain.setTargetAtTime(master, now, 0.02);
    this.musicGain.gain.setTargetAtTime(this.settings.music, now, 0.02);
    this.ambientGain.gain.setTargetAtTime(this.settings.ambient, now, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx, now, 0.02);
  }

  private scheduleFrameFlush() {
    if (this.frameScheduled) return;
    this.frameScheduled = true;
    const flush = () => this.flushSfxFrame();
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      this.frameRequest = window.requestAnimationFrame(flush);
      this.frameTimer = setTimeout(flush, 24);
    } else {
      this.frameTimer = setTimeout(flush, 0);
    }
  }

  private cancelFrameFlush() {
    if (this.frameRequest && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.frameRequest);
    }
    if (this.frameTimer !== null) clearTimeout(this.frameTimer);
    this.frameRequest = 0;
    this.frameTimer = null;
    this.frameScheduled = false;
  }

  private flushSfxFrame() {
    if (!this.frameScheduled) return;
    this.cancelFrameFlush();
    const requests = this.pendingFrame.splice(0);
    if (requests.length === 0) return;
    if (!this.initialized || !this.context || this.settings.muted || this.destroyed) {
      requests.forEach(({ resolve }) => resolve(false));
      return;
    }

    const suppressAtmosphere = nowMilliseconds() < this.bossQuietUntil;
    const plan = planSfxFrame(requests.map(({ cue }) => cue), suppressAtmosphere);
    const selected = new Set(plan.map(({ cue }) => cue));
    for (const request of requests) {
      if (!selected.has(request.cue)) request.resolve(false);
    }

    for (const entry of plan) {
      const matching = requests.filter(({ cue }) => cue === entry.cue);
      if (matching.length === 0) continue;
      const definition = definitionFor(entry.cue);
      if (definition.category === "boss") {
        this.bossQuietUntil = nowMilliseconds() + 5_000;
      }
      const options = this.combineOptions(matching, entry.count);
      void this.startSfx(entry.cue, entry.count, options)
        .then((played) => matching.forEach(({ resolve }) => resolve(played)));
    }
  }

  private combineOptions(requests: readonly QueuedSfxRequest[], count: number): PlaySfxOptions {
    const volumes = requests.map(({ options }) => options.volume ?? 1);
    const pans = requests
      .map(({ options }) => options.pan)
      .filter((value): value is number => value !== undefined);
    const explicitRate = [...requests]
      .reverse()
      .find(({ options }) => options.playbackRate !== undefined)?.options.playbackRate;
    const cue = requests[0].cue;
    const category = definitionFor(cue).category;
    let countGain = 1;
    let countPitch = 1;
    if (category === "pickup") {
      countGain = Math.min(1.3, 1 + Math.log2(Math.max(1, count)) * 0.1);
      const pentatonicRatios = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3] as const;
      countPitch =
        pentatonicRatios[Math.min(pentatonicRatios.length - 1, count - 1)];
    } else if (category === "death" || category === "weapon-hit") {
      countGain = Math.min(1.24, 1 + Math.log2(Math.max(1, count)) * 0.065);
    }
    return {
      volume: clampUnit(Math.max(...volumes) * countGain),
      playbackRate: explicitRate === undefined ? countPitch : explicitRate * countPitch,
      pan: pans.length > 0 ? pans.reduce((sum, value) => sum + value, 0) / pans.length : undefined,
      force: requests.some(({ options }) => options.force),
    };
  }

  private async startSfx(
    cue: SfxCueId,
    _count: number,
    options: PlaySfxOptions,
  ): Promise<boolean> {
    if (!this.context || !this.initialized || this.settings.muted || this.destroyed) return false;
    const definition = definitionFor(cue);
    const nowMs = nowMilliseconds();
    const previousCueTime = this.lastPlayed.get(cue);
    const category = definition.category;
    const previousCategoryTime = category ? this.lastCategoryPlayed.get(category) : undefined;

    if (
      !options.force
      && previousCueTime !== undefined
      && nowMs - previousCueTime < (definition.cooldownMs ?? 0)
    ) return false;
    if (
      !options.force
      && category
      && previousCategoryTime !== undefined
      && nowMs - previousCategoryTime < (definition.categoryCooldownMs ?? 0)
    ) return false;

    const liveForCue = [...this.voices].filter((voice) => voice.cue === cue).length;
    const pendingForCue = this.pendingByCue.get(cue) ?? 0;
    if (liveForCue + pendingForCue >= (definition.maxVoices ?? 1)) return false;
    if (!this.reserveGlobalVoice(definition.priority ?? 0, options.force ?? false)) return false;

    this.lastPlayed.set(cue, nowMs);
    if (category) this.lastCategoryPlayed.set(category, nowMs);
    this.pendingByCue.set(cue, pendingForCue + 1);
    this.pendingVoiceCount += 1;

    const releaseReservation = (restoreCooldown: boolean) => {
      const remaining = Math.max(0, (this.pendingByCue.get(cue) ?? 1) - 1);
      if (remaining === 0) this.pendingByCue.delete(cue);
      else this.pendingByCue.set(cue, remaining);
      this.pendingVoiceCount = Math.max(0, this.pendingVoiceCount - 1);
      if (restoreCooldown && this.lastPlayed.get(cue) === nowMs) {
        if (previousCueTime === undefined) this.lastPlayed.delete(cue);
        else this.lastPlayed.set(cue, previousCueTime);
      }
      if (
        restoreCooldown
        && category
        && this.lastCategoryPlayed.get(category) === nowMs
      ) {
        if (previousCategoryTime === undefined) this.lastCategoryPlayed.delete(category);
        else this.lastCategoryPlayed.set(category, previousCategoryTime);
      }
    };

    const urls = cueUrls(definition);
    const selectedUrl =
      urls[Math.floor(Math.random() * urls.length)] ?? urls[0];
    const buffer = await this.load(cue, selectedUrl);
    if (
      !buffer
      || !this.context
      || !this.initialized
      || this.context.state !== "running"
      || this.settings.muted
      || this.destroyed
    ) {
      releaseReservation(true);
      return false;
    }
    releaseReservation(false);

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const variation = definition.playbackRateVariation ?? 0;
    const randomVariation = variation ? (Math.random() * 2 - 1) * variation : 0;
    source.buffer = buffer;
    source.playbackRate.value = Math.max(
      0.5,
      Math.min(1.75, (options.playbackRate ?? 1) + randomVariation),
    );
    gain.gain.value = definition.volume * clampUnit(options.volume ?? 1);

    const destination =
      definition.bus === "ambient"
        ? this.ambientGain
        : definition.lane === "combat-base"
          ? this.combatBaseGain
          : definition.lane === "combat-accent"
            ? this.combatAccentGain
            : this.sfxGain;
    if (!destination) return false;
    source.connect(gain);
    if (typeof this.context.createStereoPanner === "function" && options.pan !== undefined) {
      const panner = this.context.createStereoPanner();
      panner.pan.value = Math.max(-0.8, Math.min(0.8, options.pan));
      gain.connect(panner);
      panner.connect(destination);
    } else {
      gain.connect(destination);
    }

    this.registerVoice({
      cue,
      source,
      gain,
      priority: definition.priority ?? 0,
      bus: definition.bus,
    });
    if (definition.lane === "combat-accent") {
      this.duckCombatBase(0.56, 0.18);
    }
    if (definition.duckMusicDb && definition.duckSeconds) {
      this.duckFor(definition.duckMusicDb, definition.duckSeconds);
    }
    source.start();
    return true;
  }

  private reserveGlobalVoice(priority: number, force: boolean) {
    const sfxVoices = [...this.voices].filter((voice) => voice.bus !== "music");
    if (sfxVoices.length + this.pendingVoiceCount < this.sfxVoiceLimit) return true;
    const lowest = sfxVoices
      .sort((left, right) => left.priority - right.priority || left.startedAt - right.startedAt)[0];
    if (!lowest || (!force && lowest.priority >= priority)) return false;
    this.fadeAndStopVoice(lowest);
    return [...this.voices].filter((voice) => voice.bus !== "music").length
      + this.pendingVoiceCount < this.sfxVoiceLimit;
  }

  private registerVoice(
    voiceData: Omit<Voice, "startedAt" | "cleanup">,
  ): Voice {
    let cleaned = false;
    const voice = {
      ...voiceData,
      startedAt: nowMilliseconds(),
      cleanup: () => {
        if (cleaned) return;
        cleaned = true;
        this.voices.delete(voice);
        if (this.musicVoice === voice) this.musicVoice = null;
        try {
          voice.source.disconnect();
          voice.gain.disconnect();
        } catch {
          // Nodes can already be disconnected after lifecycle teardown.
        }
      },
    } satisfies Voice;
    this.voices.add(voice);
    voice.source.addEventListener("ended", voice.cleanup, { once: true });
    return voice;
  }

  private fadeAndStopVoice(voice: Voice) {
    if (!this.context) return;
    this.voices.delete(voice);
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
    try {
      voice.source.stop(now + 0.02);
    } catch {
      voice.cleanup();
    }
  }

  private duckFor(db: number, seconds: number) {
    if (!this.context || !this.musicDuckGain || !this.ambientDuckGain) return;
    const now = this.context.currentTime;
    const musicFloor = Math.max(0.2, 10 ** (db / 20));
    const ambienceFloor = Math.max(0.18, 10 ** ((db - 1.5) / 20));
    const holdUntil = now + Math.max(0.1, seconds - 0.38);
    for (const [node, floor] of [
      [this.musicDuckGain, musicFloor],
      [this.ambientDuckGain, ambienceFloor],
    ] as const) {
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(Math.max(0.0001, node.gain.value), now);
      node.gain.linearRampToValueAtTime(floor, now + 0.035);
      node.gain.setValueAtTime(floor, holdUntil);
      node.gain.exponentialRampToValueAtTime(1, now + seconds);
    }
  }

  private duckCombatBase(floor: number, seconds: number) {
    if (!this.context || !this.combatBaseGain) return;
    const now = this.context.currentTime;
    const gain = this.combatBaseGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    gain.linearRampToValueAtTime(floor, now + 0.018);
    gain.setValueAtTime(floor, now + Math.max(0.04, seconds - 0.06));
    gain.exponentialRampToValueAtTime(1, now + seconds);
  }

  private load(
    cue: AudioCueId,
    requestedUrl?: string,
  ): Promise<AudioBuffer | null> {
    const url = requestedUrl ?? cueUrls(definitionFor(cue))[0];
    const cacheKey = `${cue}|${url}`;
    const cached = this.buffers.get(cacheKey);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(cacheKey);
    if (pending) return pending;
    if (!this.context) return Promise.resolve(null);

    const context = this.context;
    const promise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load audio cue ${cue}: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        if (!this.destroyed && this.context === context) {
          this.buffers.set(cacheKey, buffer);
        }
        return buffer;
      })
      .catch(() => null)
      .finally(() => {
        this.loading.delete(cacheKey);
      });
    this.loading.set(cacheKey, promise);
    return promise;
  }

  private rejectPendingFrame() {
    const requests = this.pendingFrame.splice(0);
    requests.forEach(({ resolve }) => resolve(false));
  }

  private resetClosedContext() {
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.ambientGain = null;
    this.sfxGain = null;
    this.combatBaseGain = null;
    this.combatAccentGain = null;
    this.musicDuckGain = null;
    this.ambientDuckGain = null;
    this.musicVoice = null;
    this.voices.clear();
    this.buffers.clear();
    this.loading.clear();
    this.initialized = false;
  }

  private suspendForLifecycle() {
    this.cancelFrameFlush();
    this.rejectPendingFrame();
    if (!this.context || !this.initialized) return;
    this.pausedByLifecycle = this.context.state === "running";
    if (this.pausedByLifecycle) void this.context.suspend();
  }

  private resumeFromLifecycle() {
    if (!this.context || !this.pausedByLifecycle) return;
    this.pausedByLifecycle = false;
    if (this.context.state === "closed") {
      this.resetClosedContext();
      return;
    }
    void this.context.resume()
      .then(() => {
        this.initialized = this.context?.state === "running";
        if (this.initialized && this.requestedMusic && !this.musicVoice) {
          void this.playMusic(this.requestedMusic, 0.18);
        }
      })
      .catch(() => {
        // A fresh user gesture will call initFromGesture on restrictive mobile browsers.
        this.initialized = false;
      });
  }

  private handleVisibility = () => {
    if (document.hidden) this.suspendForLifecycle();
    else this.resumeFromLifecycle();
  };

  private handlePageHide = () => {
    this.suspendForLifecycle();
  };

  private handlePageShow = () => {
    this.resumeFromLifecycle();
  };
}
