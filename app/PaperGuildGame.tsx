"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadArtAssets, type LoadedArt } from "./game/art";
import {
  loadEnemySpriteSheets,
  preloadEnemySpriteSheets,
  type EnemySpriteSheets,
} from "./game/actors/enemySprites";
import {
  findFusionDefinition,
  getWeaponDefinition,
  type EndlessPerkDefinition,
  type FusionId,
  type UpgradeOption,
  type WeaponId,
  type WeaponRouteId,
  type WeaponState,
  type WeaveState,
  WEAPON_IDS,
} from "./game/content";
import { finishHumanForm } from "./game/form";
import {
  drawMenuPreview,
  drawRun,
  loadSolarTermAtlas,
  type RenderAssets,
} from "./game/renderGame";
import {
  applyRareChoice,
  applyUpgrade,
  chooseActiveSynergies as commitSynergyChoice,
  createRun,
  GAME_HEIGHT,
  GAME_WIDTH,
  getUpgradeChoices,
  getSynergyChoices as listSynergyChoices,
  RARE_CHOICES,
  snapshotRun,
  STANDARD_SECONDS,
  startEndless,
  stepRun,
  type RareChoice,
  type RunEvent,
  type RunSnapshot,
  type RunState,
  type SynergyChoiceOption,
  type TrialId,
} from "./game/survivor";
import {
  applyEndlessPerkChoice,
  applyForgeOffer,
  captureDefeatedIntrusion,
  createForgeState,
  createRngState,
  deriveWeaveTerminal,
  fuseAdjacentNodes,
  generateEndlessPerkChoices,
  generateForgeOffers,
  insertWeaponNode,
  refreshEndlessPerkChoices,
  removeWeaveNode,
  swapWeaveNodes,
  type ForgeOffer,
} from "./game/runtime";
import {
  loadVisualPack,
  preloadFusionVisuals,
  preloadWeaponVisuals,
  pruneVisualPack,
  resolveWeaponVisualFrame,
  FUSION_ATLASES,
  WEAPON_ATLASES,
  type VisualPack,
} from "./game/visual";
import {
  AudioManager,
  getFusionSfxCue,
  getSolarTermState,
  getTermAmbienceCue,
  type AudioSettings,
  type SfxCueId,
} from "./game/world";

type Mode =
  | "menu"
  | "playing"
  | "upgrade"
  | "synergy"
  | "rare"
  | "paused"
  | "forge"
  | "bossChoice"
  | "result";

type ResultState = {
  victory: boolean;
  title: string;
};

type ForgePreview = {
  kind:
    | "fusion"
    | "swap"
    | "insert"
    | "temper"
    | "celestial"
    | "dismantle";
  title: string;
  description: string;
  cost: 0 | 1 | 2;
  before: string;
  after: string;
  weave: WeaveState;
  fusionId?: FusionId;
};

type ForgeRecipeCard = {
  id: string;
  firstIndex: number;
  secondIndex: number;
  fusionId: FusionId;
  title: string;
  pairLabel: string;
  description: string;
  cost: 1 | 2;
  firstWeaponId: WeaponId;
  secondWeaponId: WeaponId;
  before: string;
  after: string;
  nodesBefore: number;
  nodesAfter: number;
};

type TemperForgeOffer = Extract<ForgeOffer, { kind: "temper" }>;

type SavedProgressV4 = {
  version: 4;
  cleared: boolean;
  unlockedWeapons: readonly WeaponId[];
  settings?: Partial<AudioSettings>;
};

type QueuedModal =
  | "upgrade"
  | "synergy"
  | "rare"
  | "forge"
  | "celestial"
  | "bossChoice";

type ForgePurpose = "cycle" | "celestial";
type ForgeTab = "recipes" | "temper" | "arrange" | "celestial";

type GamepadUiState = {
  direction: -1 | 0 | 1;
  repeatAt: number;
  confirm: boolean;
  cancel: boolean;
  pause: boolean;
};

const WEAPON_AUDIO: Readonly<Record<WeaponId, {
  fire: SfxCueId;
  hit: SfxCueId;
}>> = {
  sword: { fire: "weapon.sword.fire", hit: "weapon.sword.hit" },
  fan: { fire: "weapon.fan.fire", hit: "weapon.fan.hit" },
  umbrella: { fire: "weapon.umbrella.fire", hit: "weapon.umbrella.hit" },
  scissors: { fire: "weapon.scissors.fire", hit: "weapon.scissors.hit" },
  abacus: { fire: "weapon.abacus.fire", hit: "weapon.abacus.hit" },
  crossbow: { fire: "weapon.crossbow.fire", hit: "weapon.crossbow.hit" },
  pipa: { fire: "weapon.pipa.fire", hit: "weapon.pipa.hit" },
  inkline: { fire: "weapon.inkline.fire", hit: "weapon.inkline.hit" },
  lantern: { fire: "weapon.lantern.fire", hit: "weapon.lantern.hit" },
  thunderSeal: { fire: "weapon.thunder.fire", hit: "weapon.thunder.hit" },
};

const emptySnapshot: RunSnapshot = {
  elapsed: 0,
  endless: false,
  score: 0,
  kills: 0,
  life: 5,
  maxLife: 5,
  xp: 0,
  nextXp: 7,
  level: 1,
  weapons: [{ id: "sword", level: 1 }],
  synergies: [],
  currentBoss: null,
  terminalLabel: "",
  terminalLabelLife: 0,
};

const TRIAL_DEFINITIONS: Array<{
  id: TrialId;
  name: string;
  description: string;
}> = [
  { id: "swift", name: "疾行", description: "敌人转向与移动更快" },
  { id: "crowd", name: "聚众", description: "每波敌群数量提高" },
  { id: "elite", name: "强敌", description: "精英和 Boss 更坚韧" },
];

const PROGRESS_KEY_V4 = "paper-guild.progress.v4";
const PROGRESS_KEYS_V3 = [
  "paper-guild.progress.v3",
  "paper-guild-progress-v3",
] as const;
const LEGACY_CLEAR_KEY = "paper-guild-cleared-v3";
const AUDIO_KEY_V1 = "paper-guild.audio.v1";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalize(x: number, y: number) {
  const magnitude = Math.hypot(x, y) || 1;
  return { x: x / magnitude, y: y / magnitude };
}

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

function optionKind(option: UpgradeOption) {
  if (option.kind === "route") return "改法 · 三选一";
  if (option.kind === "mastery") return "定型 · 二选一";
  if (option.kind === "acquire") return "拿到新器";
  if (option.kind === "utility") return "行旅札记";
  return option.kind === "refine" ? "做细" : "再磨";
}

function weaponSubline(snapshot: RunSnapshot, weaponId: WeaponId) {
  const weapon = snapshot.weapons.find((item) => item.id === weaponId);
  if (!weapon) return "";
  const definition = getWeaponDefinition(weapon.id);
  if (weapon.masteryId) {
    const route = definition.routes.find((candidate) => candidate.id === weapon.routeId);
    const mastery = route?.masteries.find((candidate) => candidate.id === weapon.masteryId);
    return mastery?.name ?? "已定型";
  }
  if (weapon.routeId) {
    return definition.routes.find((candidate) => candidate.id === weapon.routeId)?.name ?? "";
  }
  return weapon.level === 2 ? "待改法" : definition.description;
}

function weaponThumbStyle(
  weaponId: WeaponId,
  selection: {
    level: number;
    route?: string;
    mastery?: string;
  },
): React.CSSProperties {
  const frame = resolveWeaponVisualFrame(selection);
  const column = frame % 7;
  const row = Math.floor(frame / 7);
  return {
    backgroundImage: `url("${WEAPON_ATLASES[weaponId].src}")`,
    backgroundPosition: `${(column / 6) * 100}% ${row * 100}%`,
    backgroundSize: "700% 200%",
  };
}

function fusionThumbStyle(fusionId: FusionId): React.CSSProperties {
  return {
    backgroundImage: `url("${FUSION_ATLASES[fusionId].src}")`,
    backgroundPosition: "0% 0%",
    backgroundSize: "200% 200%",
  };
}

function parseProgress(raw: string | null): Partial<SavedProgressV4> | undefined {
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedProgressV4>;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return;
  }
}

function readProgress(): SavedProgressV4 {
  const fallback: SavedProgressV4 = {
    version: 4,
    cleared: false,
    unlockedWeapons: WEAPON_IDS,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const current = parseProgress(localStorage.getItem(PROGRESS_KEY_V4));
    const legacy = PROGRESS_KEYS_V3
      .map((key) => parseProgress(localStorage.getItem(key)))
      .find(Boolean);
    const source = current ?? legacy;
    const unlockedWeapons = Array.isArray(source?.unlockedWeapons)
      ? source.unlockedWeapons.filter((id): id is WeaponId =>
          WEAPON_IDS.includes(id as WeaponId)
        )
      : fallback.unlockedWeapons;
    return {
      version: 4,
      cleared:
        source?.cleared === true ||
        localStorage.getItem(LEGACY_CLEAR_KEY) === "yes",
      unlockedWeapons:
        unlockedWeapons.length > 0 ? unlockedWeapons : fallback.unlockedWeapons,
      settings: source?.settings,
    };
  } catch {
    return fallback;
  }
}

function saveProgress(update: Partial<Omit<SavedProgressV4, "version">>) {
  if (typeof window === "undefined") return;
  try {
    const current = readProgress();
    localStorage.setItem(
      PROGRESS_KEY_V4,
      JSON.stringify({ ...current, ...update, version: 4 }),
    );
  } catch {
    // The current run stays playable if private browsing disables storage.
  }
}

function initialAudioSettings(): AudioSettings {
  const fallback: AudioSettings = {
    muted: false,
    master: 0.72,
    music: 0.6,
    sfx: 0.56,
    ambient: 0.4,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const progressSettings = readProgress().settings;
    const saved = progressSettings ??
      JSON.parse(localStorage.getItem(AUDIO_KEY_V1) ?? "{}") as Partial<AudioSettings>;
    return {
      muted: typeof saved.muted === "boolean" ? saved.muted : fallback.muted,
      master: clamp(saved.master ?? fallback.master, 0, 1),
      music: clamp(saved.music ?? fallback.music, 0, 1),
      sfx: clamp(saved.sfx ?? fallback.sfx, 0, 1),
      ambient: clamp(saved.ambient ?? fallback.ambient ?? 0.5, 0, 1),
    };
  } catch {
    return fallback;
  }
}

function areRingAdjacent(first: number, second: number, length: number) {
  return (
    length >= 2 &&
    first !== second &&
    ((first + 1) % length === second || (second + 1) % length === first)
  );
}

function circularDistance(first: number, second: number, length: number) {
  const direct = Math.abs(first - second);
  return Math.min(direct, length - direct);
}

function routeAndMasteryForOption(
  option: Exclude<UpgradeOption, { kind: "utility" }>,
  current?: WeaponState,
) {
  return {
    route:
      option.kind === "route" || option.kind === "mastery"
        ? option.routeId
        : current?.routeId,
    mastery: option.kind === "mastery" ? option.masteryId : current?.masteryId,
  };
}

function perkCategoryLabel(category: EndlessPerkDefinition["category"]) {
  return {
    weapon: "器物",
    weave: "器盘",
    season: "天时",
    journey: "行旅",
  }[category];
}

function currentVisualIds(run: RunState) {
  const weaponIds = new Set<WeaponId>(
    run.build.weapons.map((weapon) => weapon.id),
  );
  const fusionIds = new Set<FusionId>();
  for (const node of run.weave?.nodes ?? []) {
    if (node.kind === "weapon") {
      weaponIds.add(node.sourceId as WeaponId);
    } else if (node.kind === "fusion") {
      fusionIds.add(node.sourceId as FusionId);
    }
    node.consumedWeapons?.forEach((weapon) => weaponIds.add(weapon.id));
  }
  return {
    weaponIds: [...weaponIds],
    fusionIds: [...fusionIds],
  };
}

function endlessChoiceContext(run: RunState) {
  const { weaponIds } = currentVisualIds(run);
  return {
    ownedWeaponIds: weaponIds,
    weaveNodeCount: run.weave?.nodes.length ?? 0,
    weaveMaxNodes: run.weave?.maxNodes ?? 0,
  };
}

export function PaperGuildGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<RunState | null>(null);
  const modeRef = useRef<Mode>("menu");
  const assetsRef = useRef<RenderAssets>({
    seasons: null,
    enemies: null,
    visuals: null,
    solarTerms: null,
  });
  const audioRef = useRef<AudioManager | null>(null);
  const keysRef = useRef(new Set<string>());
  const joystickRef = useRef({
    active: false,
    pointerId: -1,
    baseX: 0,
    baseY: 0,
    knobX: 0,
    knobY: 0,
  });
  const lastFrameRef = useRef(0);
  const hudClockRef = useRef(0);
  const queuedModalsRef = useRef<QueuedModal[]>([]);
  const forgeFireRef = useRef(0);
  const forgeCycleRef = useRef(0);
  const gamepadUiRef = useRef<GamepadUiState>({
    direction: 0,
    repeatAt: 0,
    confirm: false,
    cancel: false,
    pause: false,
  });
  const combatAudioRef = useRef({
    actorIds: new Set<number>(),
    fxIds: new Set<number>(),
    kills: 0,
  });
  const bossPreloadRef = useRef({ taotie: false, nian: false });

  const [mode, setModeState] = useState<Mode>("menu");
  const [snapshot, setSnapshot] = useState<RunSnapshot>(emptySnapshot);
  const [upgradeOptions, setUpgradeOptions] = useState<readonly UpgradeOption[]>([]);
  const [synergyOptions, setSynergyOptions] = useState<
    readonly SynergyChoiceOption[]
  >([]);
  const [selectedSynergyIds, setSelectedSynergyIds] = useState<string[]>([]);
  const [synergyCapacity, setSynergyCapacity] = useState(3);
  const [trials, setTrials] = useState<Set<TrialId>>(new Set());
  const [selectedNodes, setSelectedNodes] = useState<number[]>([]);
  const [forgeMessage, setForgeMessage] = useState("先选一项无尽手艺，再用炉火整理器盘。");
  const [forgeFire, setForgeFire] = useState(0);
  const [forgeCycle, setForgeCycle] = useState(0);
  const [forgePurpose, setForgePurpose] =
    useState<ForgePurpose>("cycle");
  const [forgeTab, setForgeTab] = useState<ForgeTab>("recipes");
  const [forgePreview, setForgePreview] = useState<ForgePreview | null>(null);
  const [insertWeaponId, setInsertWeaponId] = useState<WeaponId | null>(null);
  const [insertRouteId, setInsertRouteId] = useState<WeaponRouteId | null>(null);
  const [insertAfter, setInsertAfter] = useState(-1);
  const [endlessPerkOptions, setEndlessPerkOptions] = useState<
    readonly EndlessPerkDefinition[]
  >([]);
  const [endlessPerkChosen, setEndlessPerkChosen] = useState<string | null>(null);
  const [perkRefreshAvailable, setPerkRefreshAvailable] = useState(false);
  const [result, setResult] = useState<ResultState>({ victory: false, title: "纸尽人归" });
  const [loading, setLoading] = useState({ season: 0, enemy: 0, visual: 0, terms: 0 });
  const [assetsReady, setAssetsReady] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(initialAudioSettings);
  const [trialsUnlocked, setTrialsUnlocked] = useState(() => {
    return readProgress().cleared;
  });
  const [tutorialNonce, setTutorialNonce] = useState(0);

  const setMode = useCallback((next: Mode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  useEffect(() => {
    saveProgress({});
    const manager = new AudioManager();
    audioRef.current = manager;

    let alive = true;
    const seasonPromise = loadArtAssets((progress) => {
      if (alive) setLoading((current) => ({ ...current, season: progress }));
    });
    const enemyPromise = loadEnemySpriteSheets((progress) => {
      if (alive) setLoading((current) => ({ ...current, enemy: progress }));
    });
    const visualPromise = loadVisualPack((done, total) => {
      if (alive) setLoading((current) => ({
        ...current,
        visual: total > 0 ? done / total : 1,
      }));
    });
    const termsPromise = loadSolarTermAtlas().then((atlas) => {
      if (alive) setLoading((current) => ({ ...current, terms: 1 }));
      return atlas;
    });

    Promise.all([seasonPromise, enemyPromise, visualPromise, termsPromise])
      .then(([seasons, enemies, visuals, solarTerms]: [
        LoadedArt,
        EnemySpriteSheets,
        VisualPack,
        HTMLImageElement | null,
      ]) => {
        if (!alive) return;
        assetsRef.current = { seasons, enemies, visuals, solarTerms };
        setLoading({ season: 1, enemy: 1, visual: 1, terms: 1 });
        setAssetsReady(true);
      });

    return () => {
      alive = false;
      manager.destroy();
      audioRef.current = null;
    };
  }, []);

  const refreshSnapshot = useCallback(() => {
    const run = runRef.current;
    if (run) setSnapshot(snapshotRun(run));
  }, []);

  const syncMusic = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    const term = getSolarTermState(run.elapsed, run.endless);
    void audioRef.current?.syncWorldMusic({
      season: term.season,
      endless: run.endless,
      bossTier: run.currentBoss ?? undefined,
    });
  }, []);

  const play = useCallback((cue: SfxCueId) => {
    void audioRef.current?.playSfx(cue);
  }, []);

  const releaseMovementInput = useCallback(() => {
    keysRef.current.clear();
    joystickRef.current.active = false;
    joystickRef.current.pointerId = -1;
  }, []);

  const syncRunVisuals = useCallback(async (run: RunState) => {
    const pack = assetsRef.current.visuals;
    if (!pack) return;
    const { weaponIds, fusionIds } = currentVisualIds(run);
    await Promise.all([
      preloadWeaponVisuals(pack, weaponIds),
      fusionIds.length > 0
        ? preloadFusionVisuals(pack, fusionIds)
        : Promise.resolve(),
    ]);
    pruneVisualPack(pack, weaponIds, fusionIds);
  }, []);

  const pauseGame = useCallback(() => {
    const run = runRef.current;
    if (run) finishHumanForm(run.player);
    releaseMovementInput();
    setMode("paused");
  }, [releaseMovementInput, setMode]);

  const openUpgrade = useCallback((run: RunState) => {
    finishHumanForm(run.player);
    releaseMovementInput();
    const options = getUpgradeChoices(run);
    setUpgradeOptions(options);
    const weaponIds = options
      .filter((option) => option.kind !== "utility")
      .map((option) => option.weaponId);
    const visuals = assetsRef.current.visuals;
    if (visuals && weaponIds.length > 0) void preloadWeaponVisuals(visuals, weaponIds);
    setSnapshot(snapshotRun(run));
    setMode("upgrade");
  }, [releaseMovementInput, setMode]);

  const openForge = useCallback((
    run: RunState,
    message?: string,
    purpose: ForgePurpose = "cycle",
  ) => {
    finishHumanForm(run.player);
    releaseMovementInput();
    setForgePurpose(purpose);
    setForgeTab(purpose === "celestial" ? "celestial" : "recipes");
    forgeFireRef.current = run.forgeCredits;
    setForgeFire(run.forgeCredits);
    setSelectedNodes([]);
    setForgePreview(null);
    setInsertWeaponId(null);
    setInsertRouteId(null);
    setInsertAfter(-1);

    if (purpose === "celestial") {
      setForgeMessage(
        message ?? "天变化身已伏。此次炼成天时不耗炉火，也不占铸器周期。",
      );
      setEndlessPerkOptions([]);
      setEndlessPerkChosen("即时炼化");
      setPerkRefreshAvailable(false);
      setSnapshot(snapshotRun(run));
      setMode("forge");
      return;
    }

    const nextCycle = forgeCycleRef.current + 1;
    forgeCycleRef.current = nextCycle;
    setForgeCycle(nextCycle);
    setForgeMessage(
      message ?? "器盘游标暂歇。先取一项无尽手艺，再使用留下的炉火。",
    );
    run.endlessPerks = {
      ...run.endlessPerks,
      refreshesRemaining: 1,
    };
    const perkResult = generateEndlessPerkChoices(
      run.endlessPerks,
      run.rng,
      4,
      endlessChoiceContext(run),
    );
    run.endlessPerks = perkResult.state;
    run.rng = perkResult.rngState;
    setEndlessPerkOptions(perkResult.choices);
    setEndlessPerkChosen(
      perkResult.choices.length === 0 ? "暂无可学手艺" : null,
    );
    setPerkRefreshAvailable(perkResult.choices.length > 0);
    const used = new Set(
      (run.weave?.nodes ?? [])
        .filter((node) => node.kind === "weapon")
        .map((node) => node.sourceId as WeaponId),
    );
    const candidates = WEAPON_IDS.filter((weaponId) => !used.has(weaponId))
      .slice(0, 6);
    const visuals = assetsRef.current.visuals;
    if (visuals && candidates.length > 0) {
      void preloadWeaponVisuals(visuals, candidates);
    }
    setSnapshot(snapshotRun(run));
    setMode("forge");
  }, [releaseMovementInput, setMode]);

  const chooseEndlessPerk = useCallback((choice: EndlessPerkDefinition) => {
    const run = runRef.current;
    if (!run || endlessPerkChosen) return;
    run.endlessPerks = applyEndlessPerkChoice(run.endlessPerks, choice.id);
    setEndlessPerkChosen(choice.name);
    setPerkRefreshAvailable(false);
    setForgeMessage(`已收下无尽手艺「${choice.name}」，炉火仍可继续使用。`);
    setSnapshot(snapshotRun(run));
    play("sfx.upgrade");
  }, [endlessPerkChosen, play]);

  const refreshEndlessPerkRow = useCallback(() => {
    const run = runRef.current;
    if (!run || !perkRefreshAvailable || endlessPerkChosen) return;
    const result = refreshEndlessPerkChoices(
      run.endlessPerks,
      run.rng,
      4,
      endlessChoiceContext(run),
    );
    if (!result) return;
    run.endlessPerks = result.state;
    run.rng = result.rngState;
    setEndlessPerkOptions(result.choices);
    setPerkRefreshAvailable(false);
    setForgeMessage("整行无尽手艺已免费换过一次。");
    setSnapshot(snapshotRun(run));
    play("sfx.ui-confirm");
  }, [endlessPerkChosen, perkRefreshAvailable, play]);

  const endRun = useCallback((victory: boolean, title?: string) => {
    const run = runRef.current;
    if (!run) return;
    queuedModalsRef.current = [];
    finishHumanForm(run.player);
    releaseMovementInput();
    if (victory) {
      saveProgress({ cleared: true });
      setTrialsUnlocked(true);
    }
    setResult({ victory, title: title ?? (victory ? "绘卷已收" : "纸尽人归") });
    setSnapshot(snapshotRun(run));
    setMode("result");
    audioRef.current?.stopMusic(0.45);
  }, [releaseMovementInput, setMode]);

  const openNextQueuedModal = useCallback((run: RunState) => {
    const next = queuedModalsRef.current.shift();
    if (!next) {
      setMode("playing");
      syncMusic();
      return false;
    }
    if (next === "upgrade") {
      openUpgrade(run);
    } else if (next === "synergy") {
      finishHumanForm(run.player);
      releaseMovementInput();
      const choices = listSynergyChoices(run);
      const eligibleIds = new Set(choices.map((choice) => choice.id));
      setSynergyOptions(choices);
      setSynergyCapacity(run.build.synergyCapacity);
      setSelectedSynergyIds(
        run.activeSynergyIds.filter((id) => eligibleIds.has(id)),
      );
      setSnapshot(snapshotRun(run));
      setMode("synergy");
      syncMusic();
    } else if (next === "rare") {
      finishHumanForm(run.player);
      releaseMovementInput();
      setSnapshot(snapshotRun(run));
      setMode("rare");
      syncMusic();
    } else if (next === "forge") {
      openForge(run, "阶段战已毕，器盘添得两点炉火（最多留三点）。");
      syncMusic();
    } else if (next === "celestial") {
      openForge(
        run,
        "天变化身已伏。现在可免费炼成天时，不必等下次开炉。",
        "celestial",
      );
      syncMusic();
    } else {
      finishHumanForm(run.player);
      releaseMovementInput();
      setSnapshot(snapshotRun(run));
      setMode("bossChoice");
      syncMusic();
    }
    return true;
  }, [openForge, openUpgrade, releaseMovementInput, setMode, syncMusic]);

  const toggleSynergyChoice = useCallback((id: string) => {
    const run = runRef.current;
    if (!run) return;
    setSelectedSynergyIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= run.build.synergyCapacity) return current;
      return [...current, id];
    });
    play("sfx.ui-confirm");
  }, [play]);

  const confirmSynergyChoice = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    if (!commitSynergyChoice(run, selectedSynergyIds)) return;
    setSnapshot(snapshotRun(run));
    play("sfx.synergy");
    openNextQueuedModal(run);
  }, [openNextQueuedModal, play, selectedSynergyIds]);

  const handleEvents = useCallback((run: RunState, events: RunEvent[]) => {
    for (const event of events) {
      if (event.type === "pickup") play("sfx.pickup");
      if (event.type === "playerHit") play("sfx.player-hit");
      if (event.type === "fold") play(event.folded ? "sfx.fold" : "sfx.unfold");
      if (event.type === "synergy") play("sfx.synergy");
      if (event.type === "terminal") play("sfx.ultimate");
      if (event.type === "bossSpawn") {
        play(event.tier === "mid" ? "sfx.boss-taotie" : "sfx.boss-nian");
        syncMusic();
      }
      if (event.type === "term") {
        if (!run.endless && run.elapsed >= STANDARD_SECONDS) continue;
        play("sfx.term-change");
        const term = getSolarTermState(run.elapsed, run.endless).current;
        void audioRef.current?.playSfx(getTermAmbienceCue(term));
        syncMusic();
      }
    }

    if (events.some((event) => event.type === "defeat")) {
      queuedModalsRef.current = [];
      endRun(false);
      return;
    }

    const queued: QueuedModal[] = [];
    if (events.some((event) => event.type === "synergyChoice")) {
      queued.push("synergy");
    }
    if (events.some((event) => event.type === "celestialReady")) {
      queued.push("celestial");
    }
    if (events.some((event) => event.type === "finalBoss")) queued.push("bossChoice");
    if (events.some((event) => event.type === "midBoss")) queued.push("rare");
    if (events.some((event) => event.type === "forge")) queued.push("forge");
    for (const event of events) if (event.type === "upgrade") queued.push("upgrade");
    queuedModalsRef.current.push(...queued);
    if (modeRef.current === "playing" && queued.length > 0) openNextQueuedModal(run);
  }, [endRun, openNextQueuedModal, play, syncMusic]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        event.preventDefault();
      }
      keysRef.current.add(key);
      if (key === "escape" && modeRef.current === "playing") {
        pauseGame();
      } else if (key === "escape" && modeRef.current === "paused") {
        setMode("playing");
      }
      if (modeRef.current === "upgrade" && ["1", "2", "3"].includes(key)) {
        const option = upgradeOptions[Number(key) - 1];
        if (option) {
          const run = runRef.current;
          if (run) {
            const synergy = applyUpgrade(run, option);
            if (synergy) play("sfx.synergy");
            else play("sfx.upgrade");
            void syncRunVisuals(run);
            refreshSnapshot();
            openNextQueuedModal(run);
          }
        }
      }
      if (
        modeRef.current === "forge" &&
        !endlessPerkChosen &&
        ["1", "2", "3", "4"].includes(key)
      ) {
        const option = endlessPerkOptions[Number(key) - 1];
        if (option) chooseEndlessPerk(option);
      }
      if (
        modeRef.current === "synergy" &&
        /^[1-9]$/.test(key)
      ) {
        const option = synergyOptions[Number(key) - 1];
        if (option) toggleSynergyChoice(option.id);
      }
      if (modeRef.current === "synergy" && key === "enter") {
        confirmSynergyChoice();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    const onVisibility = () => {
      if (document.hidden && modeRef.current === "playing") {
        pauseGame();
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    chooseEndlessPerk,
    confirmSynergyChoice,
    endlessPerkChosen,
    endlessPerkOptions,
    openNextQueuedModal,
    pauseGame,
    play,
    refreshSnapshot,
    setMode,
    syncRunVisuals,
    synergyOptions,
    toggleSynergyChoice,
    upgradeOptions,
  ]);

  const pollGamepadUi = useCallback((gamepad: Gamepad, time: number) => {
    const state = gamepadUiRef.current;
    const pausePressed = gamepad.buttons[9]?.pressed ?? false;
    if (pausePressed && !state.pause) {
      if (modeRef.current === "playing") {
        pauseGame();
      } else if (modeRef.current === "paused") {
        setMode("playing");
        syncMusic();
      } else if (modeRef.current === "menu" || modeRef.current === "result") {
        document
          .querySelector<HTMLButtonElement>(
            modeRef.current === "menu"
              ? ".menu .primary-button:not(:disabled)"
              : ".result-panel .primary-button:not(:disabled)",
          )
          ?.click();
      }
      state.pause = true;
      return;
    }
    state.pause = pausePressed;
    if (modeRef.current === "playing") {
      state.direction = 0;
      state.confirm = gamepad.buttons[0]?.pressed ?? false;
      state.cancel = gamepad.buttons[1]?.pressed ?? false;
      return;
    }

    const modal = document.querySelector<HTMLElement>(
      modeRef.current === "menu" ? ".overlay.menu" : ".modal-shade",
    );
    const controls = modal
      ? [...modal.querySelectorAll<HTMLElement>("button:not(:disabled)")].filter((element) =>
          element.offsetParent !== null
        )
      : [];
    if (controls.length === 0) return;

    const axisX = gamepad.axes[0] ?? 0;
    const axisY = gamepad.axes[1] ?? 0;
    const previousPressed = (gamepad.buttons[12]?.pressed ?? false) || (gamepad.buttons[14]?.pressed ?? false);
    const nextPressed = (gamepad.buttons[13]?.pressed ?? false) || (gamepad.buttons[15]?.pressed ?? false);
    const direction: -1 | 0 | 1 = previousPressed || axisX < -0.62 || axisY < -0.62
      ? -1
      : nextPressed || axisX > 0.62 || axisY > 0.62
        ? 1
        : 0;

    if (direction === 0) {
      state.direction = 0;
    } else if (direction !== state.direction || time >= state.repeatAt) {
      const focusedIndex = controls.findIndex((element) => element === document.activeElement);
      const nextIndex = focusedIndex < 0
        ? direction > 0 ? 0 : controls.length - 1
        : (focusedIndex + direction + controls.length) % controls.length;
      controls[nextIndex].focus({ preventScroll: false });
      state.repeatAt = time + (direction === state.direction ? 115 : 270);
      state.direction = direction;
      play("sfx.ui-confirm");
    }

    const confirmPressed = gamepad.buttons[0]?.pressed ?? false;
    if (confirmPressed && !state.confirm) {
      const focused = controls.find((element) => element === document.activeElement) ?? controls[0];
      focused.focus({ preventScroll: false });
      focused.click();
    }
    state.confirm = confirmPressed;

    const cancelPressed = gamepad.buttons[1]?.pressed ?? false;
    if (cancelPressed && !state.cancel) {
      modal?.querySelector<HTMLButtonElement>("[data-gamepad-cancel]")?.click();
    }
    state.cancel = cancelPressed;
  }, [pauseGame, play, setMode, syncMusic]);

  const consumeCombatAudio = useCallback((run: RunState) => {
    const previous = combatAudioRef.current;
    const activeActors = [
      ...run.projectiles,
      ...run.zones,
      ...run.summons,
      ...run.strikes.filter((strike) => !strike.hostile),
    ];
    const newOwners = new Set(
      activeActors
        .filter((actor) => !previous.actorIds.has(actor.id))
        .map((actor) => actor.owner),
    );
    const currentFxIds = new Set(run.fx.map((effect) => effect.id));

    for (const effect of run.fx) {
      if (previous.fxIds.has(effect.id)) continue;
      const separator = effect.artKey.lastIndexOf("/");
      const owner =
        effect.owner ??
        (separator >= 0 ? effect.artKey.slice(separator + 1) : "");
      if (WEAPON_IDS.includes(owner as WeaponId)) {
        const weapon = owner as WeaponId;
        if (effect.kind === "hit") play(WEAPON_AUDIO[weapon].hit);
        else if (effect.kind === "beam" || effect.kind === "chain") newOwners.add(weapon);
      }
    }
    for (const owner of newOwners) {
      if (WEAPON_IDS.includes(owner as WeaponId)) play(WEAPON_AUDIO[owner as WeaponId].fire);
      if (owner.startsWith("fusion:")) {
        const fusionId = owner.slice("fusion:".length) as FusionId;
        if (fusionId in FUSION_ATLASES) play(getFusionSfxCue(fusionId));
      }
    }
    if (run.kills > previous.kills) play("sfx.enemy-death");

    combatAudioRef.current = {
      actorIds: new Set(activeActors.map((actor) => actor.id)),
      fxIds: currentFxIds,
      kills: run.kills,
    };
  }, [play]);

  useEffect(() => {
    let frame = 0;
    const loop = (time: number) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) {
        frame = requestAnimationFrame(loop);
        return;
      }
      if (canvas.width !== GAME_WIDTH || canvas.height !== GAME_HEIGHT) {
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
      }
      const rawDelta = lastFrameRef.current ? (time - lastFrameRef.current) / 1000 : 0;
      const delta = Math.min(rawDelta, 0.034);
      lastFrameRef.current = time;
      const run = runRef.current;

      if (!run) {
        drawMenuPreview(context, time / 1000, assetsRef.current);
        frame = requestAnimationFrame(loop);
        return;
      }

      const enemySheets = assetsRef.current.enemies;
      if (enemySheets && !bossPreloadRef.current.taotie && run.elapsed >= 330) {
        bossPreloadRef.current.taotie = true;
        void preloadEnemySpriteSheets(enemySheets, ["taotie"]);
      }
      if (enemySheets && !bossPreloadRef.current.nian && run.elapsed >= 450) {
        bossPreloadRef.current.nian = true;
        void preloadEnemySpriteSheets(enemySheets, ["nian"]);
      }

      const gamepad = navigator.getGamepads?.()[0];
      if (gamepad) pollGamepadUi(gamepad, time);

      if (modeRef.current === "playing") {
        let x = 0;
        let y = 0;
        const keys = keysRef.current;
        if (keys.has("w") || keys.has("arrowup")) y -= 1;
        if (keys.has("s") || keys.has("arrowdown")) y += 1;
        if (keys.has("a") || keys.has("arrowleft")) x -= 1;
        if (keys.has("d") || keys.has("arrowright")) x += 1;

        if (gamepad && Math.hypot(gamepad.axes[0] ?? 0, gamepad.axes[1] ?? 0) > 0.2) {
          x += gamepad.axes[0] ?? 0;
          y += gamepad.axes[1] ?? 0;
        }
        const joystick = joystickRef.current;
        if (joystick.active) {
          x += clamp((joystick.knobX - joystick.baseX) / 46, -1, 1);
          y += clamp((joystick.knobY - joystick.baseY) / 46, -1, 1);
        }
        const direction = Math.hypot(x, y) > 1 ? normalize(x, y) : { x, y };
        const events = stepRun(run, delta, direction);
        consumeCombatAudio(run);
        handleEvents(run, events);

        hudClockRef.current += delta;
        if (hudClockRef.current >= 0.12) {
          hudClockRef.current = 0;
          setSnapshot(snapshotRun(run));
        }
      }

      const renderRun = !run.endless && run.elapsed >= STANDARD_SECONDS
        ? { ...run, elapsed: STANDARD_SECONDS - 0.001 }
        : run;
      drawRun(context, renderRun, time / 1000, assetsRef.current, joystickRef.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [consumeCombatAudio, handleEvents, pollGamepadUi]);

  const startGame = async () => {
    if (!assetsReady) return;
    await audioRef.current?.initFromGesture();
    if (assetsRef.current.visuals) {
      await preloadWeaponVisuals(assetsRef.current.visuals, ["sword"]);
    }
    void audioRef.current?.preload([
      "music.spring",
      "sfx.fold",
      "sfx.unfold",
      "sfx.pickup",
      "sfx.upgrade",
      "sfx.player-hit",
    ]);
    const run = createRun(trials);
    runRef.current = run;
    await syncRunVisuals(run);
    releaseMovementInput();
    queuedModalsRef.current = [];
    forgeFireRef.current = 0;
    forgeCycleRef.current = 0;
    setForgeFire(0);
    setForgeCycle(0);
    setForgePurpose("cycle");
    setForgeTab("recipes");
    setForgePreview(null);
    setEndlessPerkOptions([]);
    setEndlessPerkChosen(null);
    setSynergyOptions([]);
    setSelectedSynergyIds([]);
    setSynergyCapacity(3);
    bossPreloadRef.current = { taotie: false, nian: false };
    combatAudioRef.current = {
      actorIds: new Set(),
      fxIds: new Set(),
      kills: 0,
    };
    setSnapshot(snapshotRun(run));
    setTutorialNonce((value) => value + 1);
    setMode("playing");
    syncMusic();
    play(getTermAmbienceCue(getSolarTermState(0, false).current));
    play("sfx.ui-confirm");
  };

  const chooseUpgrade = (option: UpgradeOption) => {
    const run = runRef.current;
    if (!run) return;
    const synergy = applyUpgrade(run, option);
    play(synergy ? "sfx.synergy" : "sfx.upgrade");
    void syncRunVisuals(run);
    setSnapshot(snapshotRun(run));
    openNextQueuedModal(run);
  };

  const chooseRare = (choice: RareChoice["id"]) => {
    const run = runRef.current;
    if (!run) return;
    applyRareChoice(run, choice);
    run.pendingRareChoice = false;
    play(choice === "resonance-slot" ? "sfx.synergy" : "sfx.upgrade");
    setSnapshot(snapshotRun(run));
    openNextQueuedModal(run);
  };

  const continueEndless = () => {
    const run = runRef.current;
    if (!run) return;
    startEndless(run);
    void syncRunVisuals(run);
    setSnapshot(snapshotRun(run));
    play("sfx.ultimate");
    syncMusic();
    openNextQueuedModal(run);
  };

  const returnToMenu = () => {
    runRef.current = null;
    releaseMovementInput();
    queuedModalsRef.current = [];
    forgeFireRef.current = 0;
    forgeCycleRef.current = 0;
    setForgeFire(0);
    setForgeCycle(0);
    setForgePurpose("cycle");
    setForgeTab("recipes");
    setForgePreview(null);
    setEndlessPerkOptions([]);
    setEndlessPerkChosen(null);
    setSynergyOptions([]);
    setSelectedSynergyIds([]);
    setSynergyCapacity(3);
    setSnapshot(emptySnapshot);
    setSelectedNodes([]);
    const visuals = assetsRef.current.visuals;
    if (visuals) pruneVisualPack(visuals, ["sword"], []);
    setMode("menu");
    audioRef.current?.stopMusic();
  };

  const toggleTrial = (trial: TrialId) => {
    if (!trialsUnlocked) return;
    setTrials((current) => {
      const next = new Set(current);
      if (next.has(trial)) next.delete(trial);
      else next.add(trial);
      return next;
    });
  };

  const updateAudio = (update: Partial<AudioSettings>) => {
    audioRef.current?.setSettings(update);
    const settings = audioRef.current?.getSettings() ?? {
      ...audioSettings,
      ...update,
    };
    setAudioSettings(settings);
    saveProgress({ settings });
    if (update.muted === false) {
      void audioRef.current?.initFromGesture().then(() => syncMusic());
    }
  };

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * GAME_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * GAME_HEIGHT,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (modeRef.current !== "playing") return;
    const point = canvasPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    joystickRef.current = {
      active: true,
      pointerId: event.pointerId,
      baseX: point.x,
      baseY: point.y,
      knobX: point.x,
      knobY: point.y,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const joystick = joystickRef.current;
    if (!joystick.active || joystick.pointerId !== event.pointerId) return;
    const point = canvasPoint(event);
    const dx = point.x - joystick.baseX;
    const dy = point.y - joystick.baseY;
    const distance = Math.hypot(dx, dy);
    const scale = distance > 48 ? 48 / distance : 1;
    joystick.knobX = joystick.baseX + dx * scale;
    joystick.knobY = joystick.baseY + dy * scale;
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (joystickRef.current.pointerId !== event.pointerId) return;
    joystickRef.current.active = false;
    joystickRef.current.pointerId = -1;
  };

  const onNodeSelect = (index: number) => {
    setSelectedNodes((current) => {
      if (current.includes(index)) return current.filter((value) => value !== index);
      if (current.length >= 2) return [index];
      return [...current, index];
    });
    setForgePreview(null);
  };

  const previewFusion = (first: number, second: number) => {
    const run = runRef.current;
    if (!run?.weave) return;
    const weave = run.weave;
    const firstNode = weave.nodes[first];
    const secondNode = weave.nodes[second];
    if (
      !firstNode ||
      !secondNode ||
      firstNode.kind !== "weapon" ||
      secondNode.kind !== "weapon"
    ) {
      setForgeMessage("只有两件本命器可以合器。");
      play("sfx.ui-back");
      return;
    }
    const definition = findFusionDefinition(
      firstNode.sourceId as WeaponId,
      secondNode.sourceId as WeaponId,
    );
    if (!definition) {
      setForgeMessage("所选两器尚无合器谱。请从“可做配方”选择。");
      play("sfx.ui-back");
      return;
    }

    let arranged = weave;
    let fusionSecond = second;
    let cost: 1 | 2 = 1;
    if (!areRingAdjacent(first, second, weave.nodes.length)) {
      const clockwise = (first + 1) % weave.nodes.length;
      const counterClockwise =
        (first - 1 + weave.nodes.length) % weave.nodes.length;
      fusionSecond =
        circularDistance(second, clockwise, weave.nodes.length) <=
        circularDistance(second, counterClockwise, weave.nodes.length)
          ? clockwise
          : counterClockwise;
      arranged = swapWeaveNodes(weave, second, fusionSecond);
      cost = 2;
    }
    const result = fuseAdjacentNodes(arranged, first, fusionSecond);
    if (!result.ok) {
      setForgeMessage("当前器盘无法完成这张配方。");
      play("sfx.ui-back");
      return;
    }
    setForgePreview({
      kind: "fusion",
      title: definition.canonicalName,
      description:
        cost === 1
          ? `${definition.pairLabel}相邻，直接合器并空出一格。`
          : `${definition.pairLabel}不相邻：自动采用最短调位，再完成合器。`,
      cost,
      before: deriveWeaveTerminal(weave).name,
      after: deriveWeaveTerminal(result.state).name,
      weave: result.state,
      fusionId: definition.id,
    });
    setForgeMessage("配方已排好，核对收势变化后再落锤。");
  };

  const previewSelectedSwap = () => {
    const run = runRef.current;
    if (!run?.weave || selectedNodes.length !== 2) return;
    const [first, second] = selectedNodes;
    const swapped = swapWeaveNodes(run.weave, first, second);
    if (swapped === run.weave) return;
    setForgePreview({
      kind: "swap",
      title: "调位",
      description: `交换「${run.weave.nodes[first].name}」与「${run.weave.nodes[second].name}」，器盘顺序会改变收势。`,
      cost: 1,
      before: deriveWeaveTerminal(run.weave).name,
      after: deriveWeaveTerminal(swapped).name,
      weave: swapped,
    });
    setForgeMessage("调位预览已生成；器盘本身只展示落锤后的结果。");
  };

  const previewInsert = () => {
    const run = runRef.current;
    if (!run?.weave || !insertWeaponId || !insertRouteId) return;
    const weaponState: WeaponState = {
      id: insertWeaponId,
      level: 3,
      routeId: insertRouteId,
    };
    const result = insertWeaponNode(run.weave, weaponState, insertAfter);
    if (!result.ok) {
      setForgeMessage(
        result.reason === "node-capacity"
          ? "器盘已满，先合器释放盘位。"
          : "该武器已经在器盘中。",
      );
      play("sfx.ui-back");
      return;
    }
    const definition = getWeaponDefinition(insertWeaponId);
    const route = definition.routes.find(
      (candidate) => candidate.id === insertRouteId,
    );
    setForgePreview({
      kind: "insert",
      title: `添器 · ${definition.name}`,
      description: `以「${route?.name ?? "既定改法"}」插入${
        insertAfter < 0 ? "盘首" : `「${run.weave.nodes[insertAfter]?.name}」之后`
      }。`,
      cost: 1,
      before: deriveWeaveTerminal(run.weave).name,
      after: deriveWeaveTerminal(result.state).name,
      weave: result.state,
    });
    setForgeMessage("新器位置与改法已排好，确认后才会消耗炉火。");
  };

  const previewTemper = (offer: TemperForgeOffer) => {
    const run = runRef.current;
    if (!run?.weave || offer.kind !== "temper") return;
    const nextWeave = applyForgeOffer(run.weave, offer);
    if (nextWeave === run.weave) {
      setForgeMessage("这件器物目前不能继续做细。");
      return;
    }
    const weapon = nextWeave.nodes[offer.nodeIndex]?.weaponState;
    setForgePreview({
      kind: "temper",
      title: offer.title,
      description: `${offer.description}${
        weapon?.level === 3
          ? " 此次将确定改法。"
          : weapon?.level === 5
            ? " 此次将完成定型。"
            : ""
      }`,
      cost: 1,
      before: deriveWeaveTerminal(run.weave).name,
      after: deriveWeaveTerminal(nextWeave).name,
      weave: nextWeave,
    });
    setForgeMessage("做细预览已生成，确认后推进一阶。");
  };

  const previewCelestial = () => {
    const run = runRef.current;
    if (!run?.weave) return;
    let baseWeave = run.weave;
    let celestialInsertAfter = insertAfter;
    let replacedName: string | undefined;
    if (baseWeave.nodes.length >= baseWeave.maxNodes) {
      if (selectedNodes.length !== 1) {
        setForgeMessage("器盘已满：先点一格作为替换位，炼化仍然免费。");
        play("sfx.ui-back");
        return;
      }
      const selectedIndex = selectedNodes[0];
      replacedName = baseWeave.nodes[selectedIndex]?.name;
      baseWeave = removeWeaveNode(baseWeave, selectedIndex);
      celestialInsertAfter = selectedIndex === 0 ? -1 : selectedIndex - 1;
    }
    const result = captureDefeatedIntrusion(
      baseWeave,
      celestialInsertAfter,
    );
    if (!result.ok) {
      setForgeMessage("需先击败敌对天变化身，并确保器盘仍有空位。");
      play("sfx.ui-back");
      return;
    }
    setForgePreview({
      kind: "celestial",
      title: `炼天时 · ${result.node.name}`,
      description: replacedName
        ? `以「${replacedName}」的盘位换入己方天时。`
        : `将已伏天变炼为己方天时，插入${
            celestialInsertAfter < 0
              ? "盘首"
              : `「${baseWeave.nodes[celestialInsertAfter]?.name}」之后`
          }。`,
      cost: 0,
      before: deriveWeaveTerminal(run.weave).name,
      after: deriveWeaveTerminal(result.state).name,
      weave: result.state,
    });
    setForgeMessage("天时已排入预览；此次炼化不耗炉火。");
  };

  const previewDismantle = () => {
    const run = runRef.current;
    if (!run?.weave || selectedNodes.length !== 1) return;
    const nodeIndex = selectedNodes[0];
    const node = run.weave.nodes[nodeIndex];
    if (!node || run.weave.nodes.length <= 1) {
      setForgeMessage("器盘至少要留一件器物。");
      play("sfx.ui-back");
      return;
    }
    const nextWeave = removeWeaveNode(run.weave, nodeIndex);
    if (nextWeave === run.weave) return;
    setForgePreview({
      kind: "dismantle",
      title: `拆下 · ${node.name}`,
      description: "拆下这一格并留出盘位；原器不会自动回到盘中。",
      cost: 1,
      before: deriveWeaveTerminal(run.weave).name,
      after: deriveWeaveTerminal(nextWeave).name,
      weave: nextWeave,
    });
    setForgeMessage("拆器结果已排好，确认后才会扣一火。");
  };

  const confirmForgePreview = async () => {
    const run = runRef.current;
    const preview = forgePreview;
    if (!run?.weave || !preview) return;
    if (run.forgeCredits < preview.cost) {
      setForgeMessage(`炉火不足：此操作需要 ${preview.cost} 点。`);
      play("sfx.ui-back");
      return;
    }
    run.weave = preview.weave;
    run.forgeCredits -= preview.cost;
    forgeFireRef.current = run.forgeCredits;
    setForgeFire(run.forgeCredits);
    await syncRunVisuals(run);
    play(
      preview.kind === "fusion"
        ? "sfx.fusion"
        : preview.kind === "celestial"
          ? "sfx.ultimate"
          : preview.kind === "swap"
            ? "sfx.ui-confirm"
            : "sfx.upgrade",
    );
    setForgeMessage(
      preview.cost === 0
        ? `${preview.title}已完成，炉火不减。`
        : `${preview.title}已完成。余 ${run.forgeCredits} 点炉火，可继续操作。`,
    );
    setSelectedNodes([]);
    setForgePreview(null);
    setInsertWeaponId(null);
    setInsertRouteId(null);
    setSnapshot(snapshotRun(run));
  };

  const closeForge = () => {
    const run = runRef.current;
    if (
      forgePurpose === "celestial" &&
      run?.weave?.activeIntrusion?.phase === "defeated"
    ) {
      setForgeMessage("先把已伏天变炼入器盘；满盘时可点一格免费替换。");
      play("sfx.ui-back");
      return;
    }
    if (!endlessPerkChosen) {
      setForgeMessage("先从四项无尽手艺中取一项，才可定盘续战。");
      play("sfx.ui-back");
      return;
    }
    setSelectedNodes([]);
    setForgePreview(null);
    if (run) openNextQueuedModal(run);
    else setMode("playing");
  };

  const term = getSolarTermState(snapshot.elapsed, snapshot.endless);
  const loadProgress = Math.round(
    ((loading.season + loading.enemy + loading.visual + loading.terms) / 4) * 100,
  );
  const availableNodes = useMemo(() => {
    const used = new Set(
      (snapshot.weave?.nodes ?? [])
        .filter((node) => node.kind === "weapon")
        .map((node) => node.sourceId as WeaponId),
    );
    if (
      !snapshot.weave ||
      snapshot.weave.nodes.length >= snapshot.weave.maxNodes
    ) {
      return [];
    }
    return WEAPON_IDS.filter((weaponId) => !used.has(weaponId));
  }, [snapshot.weave]);

  const fusionRecipes = useMemo<readonly ForgeRecipeCard[]>(() => {
    const weave = snapshot.weave;
    if (!weave) return [];
    if (
      weave.nodes.filter((node) => node.kind === "fusion").length >=
      weave.maxFusions
    ) {
      return [];
    }
    const recipes: ForgeRecipeCard[] = [];
    for (let first = 0; first < weave.nodes.length; first += 1) {
      for (let second = first + 1; second < weave.nodes.length; second += 1) {
        const firstNode = weave.nodes[first];
        const secondNode = weave.nodes[second];
        if (firstNode.kind !== "weapon" || secondNode.kind !== "weapon") continue;
        const definition = findFusionDefinition(
          firstNode.sourceId as WeaponId,
          secondNode.sourceId as WeaponId,
        );
        if (!definition) continue;
        let arranged = weave;
        let fusionSecond = second;
        const adjacent = areRingAdjacent(first, second, weave.nodes.length);
        if (!adjacent) {
          const clockwise = (first + 1) % weave.nodes.length;
          const counterClockwise =
            (first - 1 + weave.nodes.length) % weave.nodes.length;
          fusionSecond =
            circularDistance(second, clockwise, weave.nodes.length) <=
            circularDistance(second, counterClockwise, weave.nodes.length)
              ? clockwise
              : counterClockwise;
          arranged = swapWeaveNodes(weave, second, fusionSecond);
        }
        const result = fuseAdjacentNodes(arranged, first, fusionSecond);
        if (!result.ok) continue;
        recipes.push({
          id: `${firstNode.instanceId}:${secondNode.instanceId}:${definition.id}`,
          firstIndex: first,
          secondIndex: second,
          fusionId: definition.id,
          title: definition.canonicalName,
          pairLabel: definition.pairLabel,
          description: definition.description,
          cost: adjacent ? 1 : 2,
          firstWeaponId: firstNode.sourceId as WeaponId,
          secondWeaponId: secondNode.sourceId as WeaponId,
          before: deriveWeaveTerminal(weave).name,
          after: deriveWeaveTerminal(result.state).name,
          nodesBefore: weave.nodes.length,
          nodesAfter: result.state.nodes.length,
        });
      }
    }
    return recipes;
  }, [snapshot.weave]);

  const temperOffers = useMemo<readonly TemperForgeOffer[]>(() => {
    const weave = snapshot.weave;
    if (!weave) return [];
    const generated = generateForgeOffers(
      weave,
      createRngState(`forge-ui-${forgeCycle}-${weave.nextInstance}`),
      { ...createForgeState(0), cycle: forgeCycle },
      96,
    );
    return generated.offers.filter(
      (offer): offer is TemperForgeOffer => offer.kind === "temper",
    );
  }, [forgeCycle, snapshot.weave]);
  const selectedRecipe =
    selectedNodes.length === 2
      ? fusionRecipes.find(
          (recipe) =>
            recipe.firstIndex === selectedNodes[0] &&
            recipe.secondIndex === selectedNodes[1],
        ) ??
        fusionRecipes.find(
          (recipe) =>
            recipe.firstIndex === selectedNodes[1] &&
            recipe.secondIndex === selectedNodes[0],
        )
      : undefined;
  const previewWeave = forgePreview?.weave ?? snapshot.weave;
  const requiredSynergyCount = Math.min(
    synergyCapacity,
    synergyOptions.length,
  );

  return (
    <main className="page">
      <section className="game-shell" aria-label="纸上百工游戏">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="paper-grain" />

        {mode !== "menu" && (
          <div className="hud" aria-live="polite">
            <div className="hud-top">
              <div className="status-card">
                <div className="status-line">
                  <span>纸命 <b className="hearts">{"◆".repeat(Math.max(0, snapshot.life))}{"◇".repeat(Math.max(0, snapshot.maxLife - snapshot.life))}</b></span>
                  <strong>等级 {snapshot.level}</strong>
                </div>
                <div className="xp-track" aria-label="经验进度">
                  <span style={{ width: `${clamp(snapshot.xp / snapshot.nextXp, 0, 1) * 100}%` }} />
                </div>
              </div>

              <div className="term-stack">
                <span className={`season-mark season-${term.season}`}>{term.current.name}</span>
                <small>下一节气 · {term.next.name}</small>
                <div className="term-progress"><i style={{ width: `${term.termProgress * 100}%` }} /></div>
              </div>

              <div className="time-card">
                <span className="timer">{snapshot.endless ? `续 ${formatTime(snapshot.elapsed - STANDARD_SECONDS)}` : formatTime(snapshot.elapsed)}</span>
                <button className="icon-button" onClick={pauseGame} aria-label="暂停">暂停</button>
              </div>
            </div>

            {snapshot.weave && (
              <div className="weave-hud">
                <span className="weave-title">器盘</span>
                <div className="weave-mini-ring">
                  {snapshot.weave.nodes.map((node, index) => (
                    <i
                      key={node.instanceId}
                      className={`${node.kind} ${index === snapshot.weave?.pulse.nodeIndex ? "active" : ""}`}
                      title={`${index + 1}. ${node.name}`}
                    >
                      {node.name.slice(0, 1)}
                    </i>
                  ))}
                </div>
                <span className="weave-charge">
                  游标 {Math.round(snapshot.weave.pulse.nodeProgress * 100)}%
                </span>
                {snapshot.weave.activeIntrusion && (
                  <span className={`intrusion ${snapshot.weave.activeIntrusion.phase}`}>
                    天变 · {snapshot.weave.activeIntrusion.phase === "warning" ? "将临" : snapshot.weave.activeIntrusion.phase === "defeated" ? "可炼化" : "入阵"}
                  </span>
                )}
              </div>
            )}

            <div className="hud-bottom">
              <div className="weapon-bar">
                {snapshot.weapons.map((weapon) => (
                  <span className="weapon-chip" key={weapon.id}>
                    <i
                      className="weapon-mini-art"
                      aria-hidden="true"
                      style={weaponThumbStyle(
                        weapon.id,
                        {
                          level: weapon.level,
                          route: weapon.routeId,
                          mastery: weapon.masteryId,
                        },
                      )}
                    />
                    <b>{getWeaponDefinition(weapon.id).shortName}</b>
                    <strong> {weapon.level}/5</strong>
                    <em>{weaponSubline(snapshot, weapon.id)}</em>
                  </span>
                ))}
              </div>
              <div className="resonance-list">
                {snapshot.synergies.map((name) => <span key={name}>搭手 · {name}</span>)}
              </div>
            </div>
          </div>
        )}

        {snapshot.terminalLabelLife > 0 && (
          <div className="terminal-callout">
            <span>收势</span>
            <strong>{snapshot.terminalLabel}</strong>
          </div>
        )}

        {mode === "playing" && snapshot.elapsed < 8 && (
          <div className="tutorial" key={tutorialNonce}>
            只需移动 · 武器自动迎敌 · 停下或急转会展开人形
          </div>
        )}

        {mode === "menu" && (
          <div className="overlay menu">
            <div className="menu-panel">
              <p className="kicker"><span className="seal">百工</span> 水墨绘本 · 剪纸肉鸽</p>
              <h1 className="title">纸上<span>百工</span></h1>
              <p className="subtitle">
                清俊纸旅人携十般百工器物走过二十四节气。只需移动，让「拿到、做细、改法、再磨、定型」与器盘自然接成一局。
              </p>
              <div className="feature-row">
                <span>10 把本命器</span>
                <span>30 种改法</span>
                <span>12 套搭手</span>
                <span>30 件合器</span>
                <span>32 项无尽手艺</span>
                <span>二十四节气</span>
              </div>
              <p className="tao-note">
                少量道门元素只放在「五雷木令、伞骨接雷、弦尾落雷、雷部天变与法铃音色」，其余仍是市井百工与岁时行旅。
              </p>
              <div className="button-row">
                <button className="primary-button" onClick={startGame} disabled={!assetsReady}>
                  {assetsReady ? "展卷启程" : `美工图集装订中 ${loadProgress}%`}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => updateAudio({ muted: !audioSettings.muted })}
                >
                  {audioSettings.muted ? "开启声音" : "声音已开"}
                </button>
              </div>
              <div className="trial-area">
                <p className="trial-label">{trialsUnlocked ? "试炼签 · 可叠加" : "首次收卷后解锁试炼签"}</p>
                <div className="trials">
                  {TRIAL_DEFINITIONS.map((trial) => (
                    <button
                      key={trial.id}
                      className={`trial ${trials.has(trial.id) ? "active" : ""}`}
                      onClick={() => toggleTrial(trial.id)}
                      disabled={!trialsUnlocked}
                      title={trial.description}
                    >
                      {trial.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === "upgrade" && (
          <div className="overlay modal-shade">
            <section className="upgrade-panel">
              <p className="kicker">器物自择 · 战局暂停</p>
              <h2 className="upgrade-heading">
                {upgradeOptions[0]?.kind === "route"
                  ? "选定一种改法"
                  : upgradeOptions[0]?.kind === "mastery"
                    ? "给器物定型"
                    : "拾取一页百工谱"}
              </h2>
              <p className="upgrade-note">
                第三阶固定同时展示三种改法，第五阶固定展示两种定型；选择后本局不可反悔。
              </p>
              <div className={`upgrade-grid count-${upgradeOptions.length}`}>
                {upgradeOptions.map((option, index) => {
                  const color = option.kind === "utility"
                    ? "#886b42"
                    : getWeaponDefinition(option.weaponId).color;
                  const currentWeapon = option.kind === "utility"
                    ? undefined
                    : snapshot.weapons.find(
                        (weapon) => weapon.id === option.weaponId,
                      );
                  const targetLevel =
                    option.kind === "acquire"
                      ? 1
                      : option.kind === "refine"
                        ? 2
                        : option.kind === "route"
                          ? 3
                          : option.kind === "routeEnhancement"
                            ? 4
                            : option.kind === "mastery"
                              ? 5
                              : 0;
                  return (
                    <button
                      className="upgrade-card"
                      key={option.id}
                      onClick={() => chooseUpgrade(option)}
                      style={{ "--accent": color } as React.CSSProperties}
                    >
                      {option.kind !== "utility" && (
                        <span
                          className="upgrade-card-art"
                          aria-hidden="true"
                          style={weaponThumbStyle(
                            option.weaponId,
                            {
                              level: targetLevel,
                              ...routeAndMasteryForOption(option, currentWeapon),
                            },
                          )}
                        />
                      )}
                      <span className="card-type">{index + 1} · {optionKind(option)}</span>
                      <h3>{option.title}</h3>
                      <p>{option.description}</p>
                      {option.kind !== "utility" && (
                        <div className="level-dots">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <i key={level} className={level <= (
                              option.kind === "acquire"
                                ? 1
                                : option.kind === "refine"
                                  ? 2
                                  : option.kind === "route"
                                    ? 3
                                    : option.kind === "routeEnhancement"
                                      ? 4
                                      : 5
                            ) ? "on" : ""} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {mode === "synergy" && (
          <div className="overlay modal-shade">
            <section className="upgrade-panel synergy-panel">
              <p className="kicker">搭手已多 · 战局暂停</p>
              <h2 className="upgrade-heading">这回让哪几门手艺搭手</h2>
              <p className="upgrade-note">
                已有 {synergyOptions.length} 种搭法，器位只能留 {requiredSynergyCount} 种。
                点选后按确认；下次新搭法出现时仍可重排。
              </p>
              <div className="synergy-choice-grid">
                {synergyOptions.map((option, index) => {
                  const selected = selectedSynergyIds.includes(option.id);
                  const locked =
                    !selected &&
                    selectedSynergyIds.length >= requiredSynergyCount;
                  return (
                    <button
                      key={option.id}
                      className={`synergy-choice-card ${selected ? "is-selected" : ""}`}
                      aria-pressed={selected}
                      disabled={locked}
                      onClick={() => toggleSynergyChoice(option.id)}
                      style={{
                        "--accent": getWeaponDefinition(option.weapons[0]).color,
                      } as React.CSSProperties}
                    >
                      <span className="card-type">
                        {index + 1} · {option.weapons
                          .map((weaponId) => getWeaponDefinition(weaponId).shortName)
                          .join(" × ")}
                      </span>
                      <span className="synergy-pair-art" aria-hidden="true">
                        {option.weapons.map((weaponId) => (
                          <i
                            key={weaponId}
                            style={weaponThumbStyle(
                              weaponId,
                              (() => {
                                const weapon = snapshot.weapons.find(
                                  (weapon) => weapon.id === weaponId,
                                );
                                return {
                                  level: weapon?.level ?? 3,
                                  route: weapon?.routeId,
                                  mastery: weapon?.masteryId,
                                };
                              })(),
                            )}
                          />
                        ))}
                      </span>
                      <strong>{option.name}</strong>
                      <small>{option.description}</small>
                      <em>{selected ? "已留" : locked ? "先取消一项" : "可选"}</em>
                    </button>
                  );
                })}
              </div>
              <div className="synergy-confirm-row">
                <span>
                  已选 {selectedSynergyIds.length}/{requiredSynergyCount}
                  <small>键盘 1–9 勾选，Enter 确认</small>
                </span>
                <button
                  className="primary-button compact"
                  disabled={
                    selectedSynergyIds.length !== requiredSynergyCount
                  }
                  onClick={confirmSynergyChoice}
                >
                  留下这些搭手
                </button>
              </div>
            </section>
          </div>
        )}

        {mode === "rare" && (
          <div className="overlay modal-shade">
            <section className="upgrade-panel rare-panel">
              <p className="kicker">吞卷饕餮已退 · 特别奖励</p>
              <h2 className="upgrade-heading">从三种做法里选一项</h2>
              <p className="upgrade-note">每项都会直接改变后半程的做法。</p>
              <div className="upgrade-grid">
                {RARE_CHOICES.map((choice, index) => (
                  <button
                    key={choice.id}
                    className="upgrade-card rare-card"
                    onClick={() => chooseRare(choice.id)}
                  >
                    <span className="card-type">{index + 1} · 特别做法</span>
                    <h3>{choice.name}</h3>
                    <p>{choice.description}</p>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {mode === "forge" && snapshot.weave && (
          <div className="overlay modal-shade">
            <section className="forge-panel">
              <div className="forge-heading-row">
                <div>
                  <p className="kicker">
                    {forgePurpose === "celestial"
                      ? "天变化身已伏 · 即刻炼化"
                      : "无尽手艺 · 每两分钟开炉"}
                  </p>
                  <h2 className="upgrade-heading">
                    {forgePurpose === "celestial" ? "炼成天时" : "器盘作坊"}
                  </h2>
                </div>
                <div className="forge-ledger">
                  <span className="forge-fire" aria-label={`剩余${forgeFire}点炉火`}>
                    炉火 {"◆".repeat(forgeFire)}{"◇".repeat(3 - forgeFire)}
                  </span>
                  <span className="capacity">
                    节点 {snapshot.weave.nodes.length}/{snapshot.weave.maxNodes}
                    {" · "}合器 {snapshot.weave.nodes.filter((node) => node.kind === "fusion").length}/{snapshot.weave.maxFusions}
                  </span>
                </div>
              </div>
              <p className="forge-message">{forgeMessage}</p>

              {forgePurpose === "cycle" && (
              <section className={`forge-perk-section ${endlessPerkChosen ? "chosen" : ""}`}>
                <div className="forge-section-heading">
                  <div>
                    <strong>无尽手艺 · 四选一</strong>
                    <small>{endlessPerkChosen ? `已取「${endlessPerkChosen}」` : "键盘可按 1–4；本轮可免费整行换一次"}</small>
                  </div>
                  <button
                    className="forge-refresh"
                    onClick={refreshEndlessPerkRow}
                    disabled={!perkRefreshAvailable || Boolean(endlessPerkChosen)}
                  >
                    免费换一排
                  </button>
                </div>
                <div className="forge-perk-row">
                  {endlessPerkOptions.map((choice, index) => {
                    const rank = snapshot.endlessPerks?.ranks[choice.id] ?? 0;
                    return (
                      <button
                        key={choice.id}
                        className="forge-perk-card"
                        onClick={() => chooseEndlessPerk(choice)}
                        disabled={Boolean(endlessPerkChosen)}
                      >
                        <span>{index + 1} · {perkCategoryLabel(choice.category)}</span>
                        <strong>{choice.name}</strong>
                        <small>{choice.description}</small>
                        <em>{rank > 0 ? `已有 ${rank}/${choice.maxRank}` : `上限 ${choice.maxRank}`}</em>
                      </button>
                    );
                  })}
                </div>
              </section>
              )}

              <div className="forge-workbench">
                <div className="forge-main-column">
                  <nav className="forge-mode-tabs" aria-label="器盘操作">
                    {([
                      ["recipes", "可做配方"],
                      ["temper", "添器 / 做细"],
                      ["arrange", "调位"],
                      ["celestial", "天时 / 拆器"],
                    ] as const).map(([tab, label]) => (
                      <button
                        key={tab}
                        className={forgeTab === tab ? "active" : ""}
                        onClick={() => {
                          setForgeTab(tab);
                          setForgePreview(null);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </nav>
                <div className={`forge-zones tab-${forgeTab}`}>
                  <section className="forge-zone forge-zone-recipes">
                    <div className="forge-zone-title">
                      <strong>可做配方</strong>
                      <small>相邻 1 火；非相邻自动最短调位后合器，共 2 火</small>
                    </div>
                    <div className="forge-option-list recipe-list">
                      {fusionRecipes.map((recipe) => (
                        <button
                          key={recipe.id}
                          className={`forge-option-card recipe-card ${forgeFire < recipe.cost ? "is-insufficient" : ""}`}
                          onClick={() => previewFusion(recipe.firstIndex, recipe.secondIndex)}
                        >
                          <span>{recipe.pairLabel}</span>
                          <span
                            className="recipe-fusion-art"
                            aria-hidden="true"
                            style={fusionThumbStyle(recipe.fusionId)}
                          />
                          <strong>{recipe.title}</strong>
                          <small className="recipe-description">
                            {recipe.description}
                          </small>
                          <small className="recipe-terminal-preview">
                            {recipe.before} → {recipe.after}
                          </small>
                          <em>
                            {recipe.nodesBefore}→{recipe.nodesAfter} 格 ·{" "}
                            {recipe.cost} 火
                          </em>
                        </button>
                      ))}
                      {fusionRecipes.length === 0 && (
                        <p className="forge-empty">当前器盘没有可做配方；可先添器或调位。</p>
                      )}
                    </div>
                  </section>

                  <section className="forge-zone forge-zone-temper">
                    <div className="forge-zone-title">
                      <strong>添器 / 做细</strong>
                      <small>先定改法和插入缝隙，再看收势预览</small>
                    </div>
                    {availableNodes.length > 0 && (
                      <div className="forge-add-flow">
                        <div className="forge-weapon-picks">
                          {availableNodes.map((weaponId) => (
                            <button
                              key={weaponId}
                              className={insertWeaponId === weaponId ? "active" : ""}
                              onClick={() => {
                                setInsertWeaponId(weaponId);
                                setInsertRouteId(null);
                                setForgePreview(null);
                              }}
                            >
                              {getWeaponDefinition(weaponId).shortName}
                            </button>
                          ))}
                        </div>
                        {insertWeaponId && (
                          <div className="forge-route-picks">
                            {getWeaponDefinition(insertWeaponId).routes.map((route) => (
                              <button
                                key={route.id}
                                className={insertRouteId === route.id ? "active" : ""}
                                onClick={() => {
                                  setInsertRouteId(route.id);
                                  setForgePreview(null);
                                }}
                              >
                                <i
                                  aria-hidden="true"
                                  style={weaponThumbStyle(insertWeaponId, {
                                    level: 3,
                                    route: route.id,
                                  })}
                                />
                                <span>{route.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {insertWeaponId && (
                          <div className="forge-gap-row">
                            <label>
                              插入缝隙
                              <select
                                value={insertAfter}
                                onChange={(event) => {
                                  setInsertAfter(Number(event.target.value));
                                  setForgePreview(null);
                                }}
                              >
                                <option value={-1}>盘首</option>
                                {snapshot.weave.nodes.map((node, index) => (
                                  <option key={node.instanceId} value={index}>
                                    {node.name}之后
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              onClick={previewInsert}
                              disabled={!insertRouteId}
                            >
                              预览添器 · 1 火
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {availableNodes.length === 0 && (
                      <p className="forge-empty">器盘已满，添器入口已收起；可先完成合器。</p>
                    )}
                    <div className="forge-option-list temper-list">
                      {temperOffers.map((offer) => (
                        <button
                          key={offer.id}
                          className="forge-option-card temper-card"
                          onClick={() => previewTemper(offer)}
                        >
                          <i
                            aria-hidden="true"
                            style={weaponThumbStyle(
                              offer.weaponState.id,
                              {
                                level: offer.weaponState.level,
                                route: offer.weaponState.routeId,
                                mastery: offer.weaponState.masteryId,
                              },
                            )}
                          />
                          <span>第 {offer.nodeIndex + 1} 格</span>
                          <strong>{offer.title}</strong>
                          <small>{offer.description}</small>
                          <em>1 火</em>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="forge-zone forge-zone-arrange">
                    <div className="forge-zone-title">
                      <strong>调位</strong>
                      <small>点器盘上的两个节点；顺序不同，收势不同</small>
                    </div>
                    <div className="forge-selection">
                      <span>
                        {selectedNodes.length === 0
                          ? "尚未选节点"
                          : selectedNodes
                              .map((index) => `${index + 1}.${snapshot.weave?.nodes[index]?.name}`)
                              .join(" ＋ ")}
                      </span>
                      <div>
                        <button
                          onClick={previewSelectedSwap}
                          disabled={selectedNodes.length !== 2}
                        >
                          预览调位 · 1 火
                        </button>
                        <button
                          onClick={() => {
                            if (selectedNodes.length === 2) {
                              previewFusion(selectedNodes[0], selectedNodes[1]);
                            }
                          }}
                          disabled={!selectedRecipe}
                        >
                          {selectedRecipe ? `预览${selectedRecipe.title}` : "所选无合器谱"}
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="forge-zone forge-zone-celestial">
                    <div className="forge-zone-title">
                      <strong>天时 / 拆器</strong>
                      <small>炼化免费；满盘时点一格替换，普通拆器耗一火</small>
                    </div>
                    <div className="celestial-actions">
                      {snapshot.weave.activeIntrusion?.phase === "defeated" ? (
                        <button className="celestial-button" onClick={previewCelestial}>
                          预览炼化天时 · 免费
                        </button>
                      ) : (
                        <p className="forge-empty">当前没有已伏的天变化身。</p>
                      )}
                      <button
                        className="dismantle-button"
                        onClick={previewDismantle}
                        disabled={
                          selectedNodes.length !== 1 ||
                          snapshot.weave.nodes.length <= 1
                        }
                      >
                        {selectedNodes.length === 1
                          ? `预览拆下 ${snapshot.weave.nodes[selectedNodes[0]]?.name ?? "此格"} · 1 火`
                          : "点一格后预览拆器"}
                      </button>
                    </div>
                  </section>
                </div>
                </div>

                <aside className="forge-preview-rail">
                  <div className="preview-ring-label">
                    <strong>器盘结果预览</strong>
                    <small>点两个节点可用于调位或合器</small>
                  </div>
                  <div className="weave-ring-large weave-ring-preview">
                    {(previewWeave?.nodes ?? []).map((node, index) => (
                      <button
                        key={node.instanceId}
                        className={`weave-node ${node.kind} ${!forgePreview && selectedNodes.includes(index) ? "selected" : ""} ${index === previewWeave?.pulse.nodeIndex ? "pulse" : ""}`}
                        onClick={() => {
                          if (!forgePreview) onNodeSelect(index);
                        }}
                        disabled={Boolean(forgePreview)}
                        style={{ "--node-index": index, "--node-count": previewWeave?.nodes.length ?? 1 } as React.CSSProperties}
                      >
                        <b>{index + 1}</b>
                        <span>{node.name}</span>
                        <small>{node.kind === "fusion" ? "合器" : node.kind === "celestial" ? "天时" : "本命器"}</small>
                      </button>
                    ))}
                    <div className="weave-core">
                      <span>器盘游标</span>
                      <strong>{Math.round((previewWeave?.pulse.nodeProgress ?? 0) * 100)}%</strong>
                    </div>
                  </div>

                  <div className={`forge-preview-card ${forgePreview ? "ready" : ""}`}>
                    {forgePreview ? (
                      <>
                        <span className="forge-cost-badge">
                          {forgePreview.cost === 0
                            ? "不耗炉火"
                            : `${forgePreview.cost} 火`}
                        </span>
                        <strong>{forgePreview.title}</strong>
                        <p>{forgePreview.description}</p>
                        <div className="forge-terminal-change">
                          <span><small>原收势</small>{forgePreview.before}</span>
                          <b>→</b>
                          <span><small>新收势</small>{forgePreview.after}</span>
                        </div>
                        <button
                          className="primary-button compact"
                          onClick={confirmForgePreview}
                          disabled={forgeFire < forgePreview.cost}
                        >
                          {forgeFire < forgePreview.cost
                            ? "炉火不足"
                            : forgePreview.cost === 0
                              ? "确认炼成"
                              : "确认落锤"}
                        </button>
                        <button
                          className="preview-cancel"
                          onClick={() => setForgePreview(null)}
                        >
                          取消预览
                        </button>
                      </>
                    ) : (
                      <>
                        <strong>先选一张合法操作</strong>
                        <p>配方、添器、做细、调位和天时都会先显示变化前后；确认时才扣炉火。</p>
                      </>
                    )}
                  </div>
                  <button
                    className="secondary-button forge-close"
                    data-gamepad-cancel
                    onClick={closeForge}
                    disabled={!endlessPerkChosen}
                  >
                    {forgePurpose === "celestial"
                      ? "炼成后续战"
                      : "定盘续战 · 余火保留"}
                  </button>
                </aside>
              </div>
            </section>
          </div>
        )}

        {mode === "paused" && (
          <div className="overlay modal-shade">
            <section className="pause-panel">
              <p className="kicker">卷轴暂歇</p>
              <h2>行旅未完</h2>
              <p>角色已强制展开成人形，恢复后不会卡在折叠中途。</p>
              <div className="audio-settings">
                <label>
                  <span>音乐</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={audioSettings.music}
                    onChange={(event) => updateAudio({ music: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span>音效</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={audioSettings.sfx}
                    onChange={(event) => updateAudio({ sfx: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span>环境</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={audioSettings.ambient ?? 0.5}
                    onChange={(event) => updateAudio({ ambient: Number(event.target.value) })}
                  />
                </label>
              </div>
              <div className="button-row centered">
                <button className="primary-button" data-gamepad-cancel onClick={() => {
                  setMode("playing");
                  syncMusic();
                }}>继续行旅</button>
                <button className="secondary-button" onClick={() => updateAudio({ muted: !audioSettings.muted })}>
                  {audioSettings.muted ? "取消静音" : "静音"}
                </button>
                <button className="secondary-button" onClick={returnToMenu}>弃卷返回</button>
              </div>
            </section>
          </div>
        )}

        {mode === "bossChoice" && (
          <div className="overlay modal-shade">
            <section className="result-panel">
              <div className="result-seal">岁</div>
              <p className="kicker">岁夜年兽已伏</p>
              <h2>八分钟绘卷完成</h2>
              <div className="stats">
                <div><strong>{snapshot.kills}</strong><span>降服</span></div>
                <div><strong>{snapshot.synergies.length}</strong><span>搭手</span></div>
                <div><strong>{snapshot.score}</strong><span>卷分</span></div>
              </div>
              <div className="boss-choice">
                <button
                  className="primary-button"
                  data-gamepad-cancel
                  onClick={() => endRun(true, "清风收卷")}
                >
                  收卷结算
                  <span className="choice-note">完成标准局并解锁试炼签</span>
                </button>
                <button className="secondary-button" onClick={continueEndless}>
                  续卷 · 器盘无尽
                  <span className="choice-note">开启溢出武器、合器、天变与收势</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {mode === "result" && (
          <div className="overlay modal-shade">
            <section className="result-panel">
              <div className="result-seal">{result.victory ? "成" : "归"}</div>
              <p className="kicker">{result.victory ? "四时已阅" : "纸命已尽"}</p>
              <h2>{result.title}</h2>
              <div className="stats">
                <div><strong>{formatTime(snapshot.elapsed)}</strong><span>行旅时间</span></div>
                <div><strong>{snapshot.kills}</strong><span>降服</span></div>
                <div><strong>{snapshot.score}</strong><span>卷分</span></div>
              </div>
              <div className="button-row centered">
                <button className="primary-button" onClick={startGame}>再展一卷</button>
                <button className="secondary-button" data-gamepad-cancel onClick={returnToMenu}>返回卷首</button>
              </div>
            </section>
          </div>
        )}
      </section>
      <aside className="rotate-hint">请将手机横置，给四时绘卷留出完整战场。</aside>
    </main>
  );
}
