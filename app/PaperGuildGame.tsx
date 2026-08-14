"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadMinimumArtAssets,
  preloadSeasonSceneAssets,
  releaseSeasonSceneAssets,
  retainSeasonSceneAssets,
  seasonIndex,
  type EnemyArchetype,
  type LoadedArt,
} from "./game/art";
import {
  loadMinimumEnemySpriteSheets,
  attachEnemyBootFallback,
  preloadEnemySpriteGroup,
  releaseEnemySpriteSheets,
  retainEnemySpriteSheets,
  type EnemySpriteSheets,
  type EnemyVisualId,
} from "./game/actors/enemySprites";
import {
  findFusionDefinition,
  getFusionDefinition,
  DIFFICULTIES,
  DIFFICULTY_IDS,
  ENDLESS_BOSSES,
  ENDLESS_BOSS_IDS,
  getCelestialIntrusion,
  getEndlessPerkDefinition,
  getTravelNoteDefinition,
  getWeaponDefinition,
  type DifficultyId,
  type EndlessBossId,
  type CelestialIntrusionId,
  type EndlessPerkDefinition,
  type EndlessPerkPairId,
  type FusionId,
  type UpgradeOption,
  type TravelNoteId,
  type WeaponId,
  type WeaponRouteId,
  type WeaponState,
  type WeaveNode,
  type WeaveState,
  WEAPON_IDS,
} from "./game/content";
import type { GuideSectionId } from "./game/help/model";
import { finishHumanForm } from "./game/form";

const GuideOverlay = lazy(() => import("./game/help/GuideOverlay"));
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
  getRareAdvanceTargets,
  getRareChoiceAvailability,
  getUpgradeChoices,
  getSynergyChoices as listSynergyChoices,
  jumpEndlessMinutesForTest,
  snapshotRun,
  spawnEndlessBossForTest,
  STANDARD_SECONDS,
  setPrimaryWeapon,
  setTravelNoteRepeatEnabled,
  settleRunProgression,
  startEndless,
  stepRun,
  type RareChoice,
  type RareAdvanceTarget,
  type RareChoiceAvailability,
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
  dismissDefeatedIntrusion,
  fuseAdjacentNodes,
  getForgeExitBlocker,
  getForgeExitState,
  generateEndlessPerkChoices,
  generateForgeOffers,
  insertWeaponNode,
  refreshEndlessPerkChoices,
  removeWeaveNode,
  swapWeaveNodes,
  type ForgeExitActionId,
  type ForgeExitBlocker,
  type ForgeOffer,
} from "./game/runtime";
import {
  loadMinimumVisualPack,
  getBootSubjectImage,
  preloadVisualGroup,
  preloadFusionVisuals,
  preloadWeaponVisuals,
  pruneVisualPack,
  resolveWeaponVisualFrame,
  FUSION_ATLASES,
  EFFECT_ATLASES,
  WEAPON_ATLASES,
  type VisualPack,
} from "./game/visual";
import {
  AssetStreamDirector,
  assetRequestGate,
  type AssetStreamGroupDefinition,
} from "./game/assetStreamDirector";
import {
  AudioManager,
  getFusionSfxCue,
  getSolarTermState,
  getTermAmbienceCue,
  type AudioSettings,
  type AudioCueId,
  type SfxCueId,
} from "./game/world";
import {
  requestLandscapePresentation,
} from "./ViewportController";
import { publicAsset } from "./publicAsset";
import {
  EXPERIENCE_HOLD_MAX_PER_GESTURE,
  calculateExperienceHoldDelta,
  createTestUnlockState,
  transitionTestUnlock,
} from "./testUnlock";

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

type UpgradeOptionUiContract = UpgradeOption & {
  availability?: {
    enabled: boolean;
    reason?: string;
  };
};

type SynergyChoiceUiContract = SynergyChoiceOption & {
  conditionText?: string;
  triggerText?: string;
  effectText?: string;
  routeImpactText?: string;
};

type InitialWeaponChoice = WeaponId | "random";

type SavedProgressV6 = {
  version: 6;
  cleared: boolean;
  unlockedWeapons: readonly WeaponId[];
  preferredInitialWeapon: InitialWeaponChoice;
  unlockedDifficultyIds: readonly DifficultyId[];
  preferredDifficultyId: DifficultyId;
  settings?: Partial<AudioSettings>;
};

type TestPanelState = {
  timeScale: 1 | 2 | 4 | 8;
  incomingDamageScale: 0 | 1;
  assisted: boolean;
};

type DirectorPanelState = {
  minutes: number;
  enemyCount: number;
  sample: NonNullable<RunState["endlessDirector"]>["lastSample"];
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
type ForgeMobileView = "actions" | "ring";

type RingMoveState = {
  sourceId: string;
  targetId: string;
  input: "pointer" | "keyboard";
  pointerId?: number;
  startX?: number;
  startY?: number;
  dragging: boolean;
};

type TestExperienceGesture = {
  pointerId: number;
  startedAt: number;
  repeatedAmount: number;
  totalAmount: number;
  timer: ReturnType<typeof setInterval> | null;
};

type GamepadUiState = {
  direction: -1 | 0 | 1;
  repeatAt: number;
  confirm: boolean;
  cancel: boolean;
  cancelStartedAt: number;
  cancelLongTriggered: boolean;
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
  primaryWeaponValid: false,
  availablePrimaryWeaponIds: ["sword"],
  travelNotes: {},
  travelNoteRepeatEnabled: {},
  primaryWeaponRule:
    "主武器须是当前持有的一把非走马灯武器；走马灯只照样它最近一次完整核心攻击。",
};

const TRIAL_DEFINITIONS: Array<{
  id: TrialId;
  name: string;
  description: string;
}> = [
  { id: "swift", name: "疾行", description: "敌人转向与移动更快" },
  { id: "crowd", name: "聚众", description: "每波敌群数量提高" },
  { id: "elite", name: "强敌", description: "精英和首领更坚韧" },
  { id: "bossRush", name: "首领更勤", description: "无尽中的首领来得更勤" },
  { id: "noRecovery", name: "无恢复", description: "所有生命恢复归零" },
  { id: "thinPower", name: "威力降低", description: "玩家威力降至八成八" },
  {
    id: "allAtOnce",
    name: "齐出手",
    description: "普通怪会更频繁地使出完整招式",
  },
];

const DIFFICULTY_SUMMARY: Readonly<Record<DifficultyId, string>> = {
  normal: "五命，百工原样",
  hard: "四命，敌群更结实",
  extreme: "三命，恢复减半",
  oneLife: "一命，无恢复",
};

const PROGRESS_KEY_V6 = "paper-guild.progress.v6";
const LEGACY_PROGRESS_KEYS = [
  "paper-guild.progress.v5",
  "paper-guild.progress.v4",
  "paper-guild.progress.v3",
  "paper-guild-progress-v3",
] as const;
const LEGACY_CLEAR_KEY = "paper-guild-cleared-v3";
const AUDIO_KEY_V1 = "paper-guild.audio.v1";
const FIXED_STEP = 1 / 60;
const MAX_SIMULATION_STEPS = 32;
const TERM_CHANGE_CHIMES = new Set([
  "惊蛰",
  "清明",
  "夏至",
  "大暑",
  "霜降",
  "冬至",
]);
const SEASON_ENEMY_VISUALS: readonly (readonly EnemyArchetype[])[] = [
  ["cup", "shoe", "fish", "rib"],
  ["lantern", "fish", "shoe", "rib"],
  ["abacus", "cup", "lantern", "puppet"],
  ["rib", "abacus", "shoe", "lantern"],
];
const DEFAULT_TEST_PANEL_STATE: TestPanelState = {
  timeScale: 1,
  incomingDamageScale: 1,
  assisted: false,
};

const SYNERGY_TRIGGER_TEXT: Readonly<Record<string, string>> = {
  windRain: "折扇每出手 2 次",
  fineAccounting: "剪刀或算盘每次命中",
  nearFarAccord: "竹节剑每次命中",
  windStrings: "月牙琵琶每命中 4 次",
  inkMechanism: "连弩每出手 3 次",
  lanternBlades: "竹节剑每出手 4 次",
  canopyThunder: "油纸伞每次成功格挡",
  thunderCadence: "五雷木令每出手 3 次",
  lanternCanopy: "油纸伞每次成功格挡",
  tailoredWorld: "墨斗每出手 4 次",
  pearlRepeater: "算盘每命中 6 次",
  jadePearlSong: "琵琶或算盘每次命中",
};

const CELESTIAL_CAPTURE_TEXT: Readonly<Record<CelestialIntrusionId, string>> = {
  thunderTrial: "游标经过时，在敌群间落下 4 道雷。",
  galeTrial: "游标经过时，向四周送出 12 道穿敌宽风。",
  fireTrial: "游标经过时，在敌群脚下留下延时流火。",
  frostTrial: "游标经过时，铺开持续减速的寒域。",
  ghostMarch: "游标经过时，列出 5 名短驻影兵。",
  eclipseTrial: "游标经过时，让月影在 8 名敌人之间连走。",
};

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
  if (option.kind === "acquire") return "新武器";
  if (option.kind === "utility") {
    const category =
      option.travelNoteCategory === "craft"
        ? "器用"
        : option.travelNoteCategory === "journey"
          ? "行路"
          : option.travelNoteCategory === "protection"
            ? "护身"
            : "行旅";
    return `${category} · 行旅札记`;
  }
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
    backgroundImage: `url("${publicAsset(WEAPON_ATLASES[weaponId].src)}")`,
    backgroundPosition: `${(column / 6) * 100}% ${row * 100}%`,
    backgroundSize: "700% 200%",
  };
}

function fusionThumbStyle(fusionId: FusionId): React.CSSProperties {
  return {
    backgroundImage: `url("${publicAsset(FUSION_ATLASES[fusionId].src)}")`,
    backgroundPosition: "0% 0%",
    backgroundSize: "200% 200%",
  };
}

function weaveNodeThumbStyle(node: WeaveNode): React.CSSProperties | undefined {
  if (node.kind === "weapon") {
    const weapon = node.weaponState;
    return weaponThumbStyle(node.sourceId as WeaponId, {
      level: weapon?.level ?? 3,
      route: weapon?.routeId,
      mastery: weapon?.masteryId,
    });
  }
  if (node.kind === "fusion") {
    return fusionThumbStyle(node.sourceId as FusionId);
  }
  const celestialFrame: Readonly<Record<string, number>> = {
    thunderTrial: 0,
    galeTrial: 1,
    fireTrial: 2,
    frostTrial: 3,
    ghostMarch: 4,
    eclipseTrial: 5,
  };
  const frame = celestialFrame[node.sourceId] ?? 0;
  const column = frame % 3;
  const row = Math.floor(frame / 3);
  return {
    backgroundImage: `url("${publicAsset("/art-v6/celestial-nodes-v63.webp")}")`,
    backgroundPosition: `${(column / 2) * 100}% ${row * 100}%`,
    backgroundSize: "300% 200%",
  };
}

function weaveNodeDisplayName(node: WeaveNode) {
  if (node.kind !== "fusion") return node.name;
  const definition = getFusionDefinition(node.sourceId as FusionId);
  return definition.weapons
    .map((weaponId) => getWeaponDefinition(weaponId).shortName)
    .join("×");
}

function weaveNodeSizeStyle(count: number): React.CSSProperties {
  const size = count <= 4 ? 96 : count <= 6 ? 84 : 72;
  return { "--ring-node-size-base": `${size}px` } as React.CSSProperties;
}

async function waitAtMost(
  promise: Promise<unknown> | undefined,
  timeoutMs = 10_000,
) {
  if (!promise) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const completed = await Promise.race([
    promise.then(() => true, () => false),
    new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
  if (timer) clearTimeout(timer);
  return completed;
}

function weaveNodePosition(index: number, count: number): React.CSSProperties {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, count);
  const radiusX = 41;
  const radiusY = 36;
  return {
    left: `${50 + Math.cos(angle) * radiusX}%`,
    top: `${50 + Math.sin(angle) * radiusY}%`,
  };
}

function weaveNodeKindLabel(node: WeaveNode) {
  if (node.kind === "fusion") return "合器";
  if (node.kind === "celestial") return "天时";
  return node.origin === "core" ? "本命器" : "添器";
}

type StoredProgressShape = Partial<SavedProgressV6> & {
  preferredStartingWeaponId?: unknown;
};

function parseProgress(raw: string | null): StoredProgressShape | undefined {
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as StoredProgressShape;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return;
  }
}

function isInitialWeaponChoice(value: unknown): value is InitialWeaponChoice {
  return (
    value === "random" ||
    (typeof value === "string" && WEAPON_IDS.includes(value as WeaponId))
  );
}

function isDifficultyId(value: unknown): value is DifficultyId {
  return typeof value === "string" && DIFFICULTY_IDS.includes(value as DifficultyId);
}

function readProgress(): SavedProgressV6 {
  const fallback: SavedProgressV6 = {
    version: 6,
    cleared: false,
    unlockedWeapons: WEAPON_IDS,
    preferredInitialWeapon: "random",
    unlockedDifficultyIds: ["normal"],
    preferredDifficultyId: "normal",
  };
  if (typeof window === "undefined") return fallback;
  try {
    const current = parseProgress(localStorage.getItem(PROGRESS_KEY_V6));
    const legacy = LEGACY_PROGRESS_KEYS
      .map((key) => parseProgress(localStorage.getItem(key)))
      .find(Boolean);
    const source = current ?? legacy;
    const unlockedWeapons = Array.isArray(source?.unlockedWeapons)
      ? source.unlockedWeapons.filter((id): id is WeaponId =>
          WEAPON_IDS.includes(id as WeaponId)
        )
      : fallback.unlockedWeapons;
    const storedDifficulties = Array.isArray(source?.unlockedDifficultyIds)
      ? source.unlockedDifficultyIds.filter(isDifficultyId)
      : fallback.unlockedDifficultyIds;
    const unlockedDifficultyIds = DIFFICULTY_IDS.filter(
      (id, index) =>
        index === 0 ||
        storedDifficulties.includes(id) ||
        // Keep unlocks contiguous if an older experimental save only recorded
        // a later tier.
        storedDifficulties.some((stored) => DIFFICULTY_IDS.indexOf(stored) > index),
    );
    const storedInitialWeapon =
      source?.preferredInitialWeapon ?? source?.preferredStartingWeaponId;
    const preferredDifficultyId =
      isDifficultyId(source?.preferredDifficultyId) &&
      unlockedDifficultyIds.includes(source.preferredDifficultyId)
        ? source.preferredDifficultyId
        : "normal";
    return {
      version: 6,
      cleared:
        source?.cleared === true ||
        localStorage.getItem(LEGACY_CLEAR_KEY) === "yes",
      unlockedWeapons:
        unlockedWeapons.length > 0 ? unlockedWeapons : fallback.unlockedWeapons,
      preferredInitialWeapon: isInitialWeaponChoice(storedInitialWeapon)
        ? storedInitialWeapon
        : legacy && !current
          ? "sword"
          : fallback.preferredInitialWeapon,
      unlockedDifficultyIds,
      preferredDifficultyId,
      settings: source?.settings,
    };
  } catch {
    return fallback;
  }
}

function saveProgress(update: Partial<Omit<SavedProgressV6, "version">>) {
  if (typeof window === "undefined") return;
  try {
    const current = readProgress();
    localStorage.setItem(
      PROGRESS_KEY_V6,
      JSON.stringify({ ...current, ...update, version: 6 }),
    );
  } catch {
    // The current run stays playable if private browsing disables storage.
  }
}

function initialAudioSettings(): AudioSettings {
  const fallback: AudioSettings = {
    muted: false,
    master: 0.68,
    music: 0.5,
    sfx: 0.42,
    ambient: 0.24,
  };
  return fallback;
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

function perkChoiceKindLabel(kind: EndlessPerkDefinition["choiceKind"]) {
  return {
    page: "新页",
    branch: "页上分支",
    pair: "可成合页",
  }[kind];
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
  const assetStreamDirectorRef = useRef<AssetStreamDirector | null>(null);
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
  const simulationAccumulatorRef = useRef(0);
  const hudClockRef = useRef(0);
  const testUnlockTapRef = useRef(createTestUnlockState());
  const testUnlockPointerRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    dragged: boolean;
  } | null>(null);
  const testExperienceGestureRef = useRef<TestExperienceGesture | null>(null);
  const queuedModalsRef = useRef<QueuedModal[]>([]);
  const forgeFireRef = useRef(0);
  const forgeCycleRef = useRef(0);
  const forgeConfirmingRef = useRef(false);
  const ringNodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const ringMoveRef = useRef<RingMoveState | null>(null);
  const suppressRingClickRef = useRef(false);
  const guideReturnFocusRef = useRef<HTMLElement | null>(null);
  const gamepadUiRef = useRef<GamepadUiState>({
    direction: 0,
    repeatAt: 0,
    confirm: false,
    cancel: false,
    cancelStartedAt: 0,
    cancelLongTriggered: false,
    pause: false,
  });
  const combatAudioRef = useRef({
    actorIds: new Set<number>(),
    fxIds: new Set<number>(),
    kills: 0,
  });
  const seasonLifecycleIndexRef = useRef(-1);
  const enemyLifecycleSignatureRef = useRef("");

  const [mode, setModeState] = useState<Mode>("menu");
  const [snapshot, setSnapshot] = useState<RunSnapshot>(emptySnapshot);
  const [upgradeOptions, setUpgradeOptions] = useState<readonly UpgradeOption[]>([]);
  const [synergyOptions, setSynergyOptions] = useState<
    readonly SynergyChoiceOption[]
  >([]);
  const [selectedSynergyIds, setSelectedSynergyIds] = useState<string[]>([]);
  const [synergyCapacity, setSynergyCapacity] = useState(3);
  const [rareAdvanceWeaponId, setRareAdvanceWeaponId] =
    useState<WeaponId | null>(null);
  const [rareAdvanceOptionId, setRareAdvanceOptionId] =
    useState<string | null>(null);
  const [rareAdvanceTargets, setRareAdvanceTargets] = useState<
    readonly RareAdvanceTarget[]
  >([]);
  const [rareChoiceAvailability, setRareChoiceAvailability] = useState<
    readonly RareChoiceAvailability[]
  >([]);
  const [trials, setTrials] = useState<Set<TrialId>>(new Set());
  const [preferredInitialWeapon, setPreferredInitialWeapon] =
    useState<InitialWeaponChoice>("random");
  const [preferredDifficultyId, setPreferredDifficultyId] =
    useState<DifficultyId>("normal");
  const [unlockedDifficultyIds, setUnlockedDifficultyIds] = useState<
    DifficultyId[]
  >(["normal"]);
  const [testPanelUnlocked, setTestPanelUnlocked] = useState(false);
  const [testPanelState, setTestPanelState] = useState<TestPanelState>(
    DEFAULT_TEST_PANEL_STATE,
  );
  const [testExperienceAdded, setTestExperienceAdded] = useState(0);
  const [directorPanelState, setDirectorPanelState] =
    useState<DirectorPanelState | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [forgeMessage, setForgeMessage] = useState("先选一项无尽手艺，再用炉火整理器盘。");
  const [forgeFire, setForgeFire] = useState(0);
  const [forgeCycle, setForgeCycle] = useState(0);
  const [forgePurpose, setForgePurpose] =
    useState<ForgePurpose>("cycle");
  const [forgeTab, setForgeTab] = useState<ForgeTab>("recipes");
  const [forgeMobileView, setForgeMobileView] =
    useState<ForgeMobileView>("actions");
  const [forgePreview, setForgePreview] = useState<ForgePreview | null>(null);
  const [forgeConfirming, setForgeConfirming] = useState(false);
  const [forgeExitBlocker, setForgeExitBlocker] =
    useState<ForgeExitBlocker | null>(null);
  const [ringMove, setRingMove] = useState<RingMoveState | null>(null);
  const [ringFocusId, setRingFocusId] = useState<string | null>(null);
  const [insertWeaponId, setInsertWeaponId] = useState<WeaponId | null>(null);
  const [insertRouteId, setInsertRouteId] = useState<WeaponRouteId | null>(null);
  const [insertAfter, setInsertAfter] = useState(-1);
  const [endlessPerkOptions, setEndlessPerkOptions] = useState<
    readonly EndlessPerkDefinition[]
  >([]);
  const [endlessPerkChosen, setEndlessPerkChosen] = useState<string | null>(null);
  const [pendingPairChoice, setPendingPairChoice] =
    useState<EndlessPerkDefinition | null>(null);
  const [perkRefreshAvailable, setPerkRefreshAvailable] = useState(false);
  const [result, setResult] = useState<ResultState>({ victory: false, title: "纸尽人归" });
  const [loading, setLoading] = useState({ season: 0, enemy: 0, visual: 0, terms: 0 });
  const [assetsReady, setAssetsReady] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(initialAudioSettings);
  const [trialsUnlocked, setTrialsUnlocked] = useState(false);
  const [tutorialNonce, setTutorialNonce] = useState(0);
  const [guideSection, setGuideSection] = useState<GuideSectionId | null>(null);

  const setMode = useCallback((next: Mode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  const openGuide = useCallback((section: GuideSectionId) => {
    guideReturnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setGuideSection(section);
  }, []);

  const closeGuide = useCallback(() => {
    setGuideSection(null);
    requestAnimationFrame(() => {
      const target = guideReturnFocusRef.current;
      guideReturnFocusRef.current = null;
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const progress = readProgress();
    saveProgress({});
    const manager = new AudioManager();
    try {
      const legacySettings = progress.settings;
      if (
        window.localStorage.getItem(AUDIO_KEY_V1) === null &&
        legacySettings
      ) {
        manager.setSettings(legacySettings);
      }
    } catch {
      // The manager already carries safe defaults when storage is unavailable.
    }
    audioRef.current = manager;
    queueMicrotask(() => {
      if (!alive) return;
      setPreferredInitialWeapon(progress.preferredInitialWeapon);
      setPreferredDifficultyId(progress.preferredDifficultyId);
      setUnlockedDifficultyIds([...progress.unlockedDifficultyIds]);
      setTrialsUnlocked(progress.cleared);
      setAudioSettings(manager.getSettings());
    });

    const initialBootWeapon =
      progress.preferredInitialWeapon === "random"
        ? "sword"
        : progress.preferredInitialWeapon;
    const bootConnection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    assetRequestGate.configure({
      constrained: Boolean(
        bootConnection?.saveData ||
        bootConnection?.effectiveType === "slow-2g" ||
        bootConnection?.effectiveType === "2g",
      ),
    });
    const seasonPromise = loadMinimumArtAssets((progressValue: number) => {
      if (alive) setLoading((current) => ({ ...current, season: progressValue }));
    });
    const enemyPromise = loadMinimumEnemySpriteSheets((progressValue: number) => {
      if (alive) setLoading((current) => ({ ...current, enemy: progressValue }));
    });
    const visualPromise = loadMinimumVisualPack({
      initialWeaponId: initialBootWeapon,
      waitForFonts: false,
      onProgress: (done: number, total: number) => {
        if (alive) setLoading((current) => ({
          ...current,
          visual: total > 0 ? done / total : 1,
        }));
      },
    });

    Promise.all([seasonPromise, enemyPromise, visualPromise])
      .then(([seasons, enemies, visuals]: [
        LoadedArt,
        EnemySpriteSheets,
        VisualPack,
      ]) => {
        if (!alive) return;
        attachEnemyBootFallback(enemies, getBootSubjectImage(visuals));
        assetsRef.current = { seasons, enemies, visuals, solarTerms: null };
        seasonLifecycleIndexRef.current = 0;
        enemyLifecycleSignatureRef.current = ["cup", "fish", "rib", "shoe"].join(",");
        setLoading({ season: 1, enemy: 1, visual: 1, terms: 0 });

        let solarTermRequest: Promise<HTMLImageElement | null> | null = null;
        const ensureSolarTerms = async () => {
          solarTermRequest ??= assetRequestGate.schedule("large", loadSolarTermAtlas);
          const atlas = await solarTermRequest;
          if (!alive) return;
          assetsRef.current.solarTerms = atlas;
          setLoading((current) => ({ ...current, terms: 1 }));
        };
        const loadStreamGroup = async (
          group: AssetStreamGroupDefinition,
          signal: AbortSignal,
        ) => {
          if (signal.aborted) return;
          const tasks: Promise<unknown>[] = [];
          if (group.payload.seasonIndices?.length) {
            tasks.push(preloadSeasonSceneAssets(seasons, group.payload.seasonIndices));
          }
          for (const enemyGroup of group.payload.enemyGroups ?? []) {
            if (enemyGroup === "minimum" || enemyGroup === "nextEndlessBoss") continue;
            tasks.push(preloadEnemySpriteGroup(enemies, enemyGroup));
          }
          for (const visualGroup of group.payload.visualGroups ?? []) {
            if (visualGroup === "minimum") continue;
            if (visualGroup === "upgradeCandidates") {
              tasks.push(preloadVisualGroup(visuals, {
                specs: Object.values(EFFECT_ATLASES),
              }));
              tasks.push(ensureSolarTerms());
              tasks.push(Promise.all([
                assetRequestGate.schedule("small", () =>
                  document.fonts.load('16px "Paper Guild Text"')
                ),
                assetRequestGate.schedule("small", () =>
                  document.fonts.load('32px "Paper Guild Display"')
                ),
              ]).then(() => {
                  if (alive) document.documentElement.dataset.gameFontsReady = "true";
              }));
            } else {
              const run = runRef.current;
              if (!run) continue;
              const ids = currentVisualIds(run);
              tasks.push(preloadVisualGroup(visuals, {
                weaponIds: ids.weaponIds,
                fusionIds: visualGroup === "legalFusions" ? ids.fusionIds : [],
              }));
            }
          }
          const connection = (navigator as Navigator & {
            connection?: { saveData?: boolean; effectiveType?: string };
          }).connection;
          const constrained = Boolean(
            connection?.saveData ||
            connection?.effectiveType === "slow-2g" ||
            connection?.effectiveType === "2g",
          );
          if (!constrained && group.payload.audioGroups?.length) {
            const cues = new Set<AudioCueId>();
            for (const audioGroup of group.payload.audioGroups) {
              const mapped: Partial<Record<typeof audioGroup, readonly AudioCueId[]>> = {
                spring: ["music.spring"],
                summer: ["music.summer"],
                autumn: ["music.autumn"],
                winter: ["music.winter"],
                midBoss: ["music.boss.taotie"],
                finalBoss: ["music.boss.nian"],
                endless: ["music.endless"],
              };
              mapped[audioGroup]?.forEach((cue) => cues.add(cue));
            }
            if (cues.size) {
              tasks.push(Promise.all([...cues].map((cue) =>
                assetRequestGate.schedule("small", () =>
                  audioRef.current?.preload([cue]) ?? Promise.resolve()
                )
              )));
            }
          }
          await Promise.all(tasks);
        };
        const connection = (navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }).connection;
        const constrained = Boolean(
          connection?.saveData ||
          connection?.effectiveType === "slow-2g" ||
          connection?.effectiveType === "2g",
        );
        const director = new AssetStreamDirector(loadStreamGroup, undefined, {
          maxConcurrent: constrained ? 1 : 2,
        });
        assetStreamDirectorRef.current = director;
        director.markReady("minimumPlayable");
        setAssetsReady(true);
      });

    return () => {
      alive = false;
      assetStreamDirectorRef.current?.dispose();
      assetStreamDirectorRef.current = null;
      if (assetsRef.current.seasons) {
        releaseSeasonSceneAssets(assetsRef.current.seasons);
      }
      if (assetsRef.current.enemies) {
        releaseEnemySpriteSheets(assetsRef.current.enemies);
      }
      manager.destroy();
      audioRef.current = null;
    };
  }, []);

  const refreshSnapshot = useCallback(() => {
    const run = runRef.current;
    if (run) setSnapshot(snapshotRun(run));
  }, []);

  const refreshDirectorPanel = useCallback((run: RunState) => {
    const director = run.endlessDirector;
    setDirectorPanelState(
      director
        ? {
            minutes: Math.max(0, run.elapsed - director.startedAt) / 60,
            enemyCount: run.enemies.length,
            sample: director.lastSample,
          }
        : null,
    );
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

  const syncSceneVisualLifecycle = useCallback(async (
    run: RunState | null,
    sceneElapsed: number,
  ) => {
    const seasonArt = assetsRef.current.seasons;
    const currentSeason = seasonIndex(sceneElapsed);
    if (seasonArt && seasonLifecycleIndexRef.current !== currentSeason) {
      seasonLifecycleIndexRef.current = currentSeason;
      await retainSeasonSceneAssets(seasonArt, sceneElapsed);
    }

    const enemySheets = assetsRef.current.enemies;
    if (!enemySheets) return;
    const retained = new Set<EnemyVisualId>(
      SEASON_ENEMY_VISUALS[currentSeason],
    );
    if (run) {
      for (const enemy of run.enemies) {
        if (enemy.hp <= 0) continue;
        retained.add(enemy.endlessBossId ?? enemy.type);
      }
      if (run.endlessDirector?.nextBossId) {
        retained.add(run.endlessDirector.nextBossId);
      } else if (!run.endless) {
        if (!run.midBossSpawned && run.elapsed >= 348) retained.add("taotie");
        if (
          run.midBossSpawned &&
          !run.finalBossSpawned &&
          run.elapsed >= 468
        ) {
          retained.add("nian");
        }
      }
    }
    const requested = [...retained].sort();
    const signature = requested.join(",");
    if (signature === enemyLifecycleSignatureRef.current) return;
    enemyLifecycleSignatureRef.current = signature;
    await retainEnemySpriteSheets(enemySheets, requested);
  }, []);

  const syncRunVisuals = useCallback(async (run: RunState) => {
    await syncSceneVisualLifecycle(run, run.elapsed);
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
  }, [syncSceneVisualLifecycle]);

  const pauseGame = useCallback(() => {
    const run = runRef.current;
    if (run) {
      finishHumanForm(run.player);
      refreshDirectorPanel(run);
    }
    testUnlockTapRef.current = transitionTestUnlock(
      testUnlockTapRef.current,
      { type: "pause-exit" },
    ).state;
    testUnlockPointerRef.current = null;
    releaseMovementInput();
    setMode("paused");
  }, [refreshDirectorPanel, releaseMovementInput, setMode]);

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
    setForgeMobileView("actions");
    forgeFireRef.current = run.forgeCredits;
    setForgeFire(run.forgeCredits);
    setSelectedNodeIds([]);
    setForgePreview(null);
    forgeConfirmingRef.current = false;
    setForgeConfirming(false);
    setForgeExitBlocker(null);
    setPendingPairChoice(null);
    ringMoveRef.current = null;
    setRingMove(null);
    setRingFocusId(run.weave?.nodes[0]?.instanceId ?? null);
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
    if (!run || endlessPerkChosen || pendingPairChoice) return;
    if (
      choice.choiceKind === "pair" &&
      run.endlessPerks.activePairIds.length >= 6
    ) {
      setPendingPairChoice(choice);
      setForgeMessage("合页已满六项。选一项旧合页替下，再装订新页。");
      return;
    }
    run.endlessPerks = applyEndlessPerkChoice(run.endlessPerks, choice.id);
    setEndlessPerkChosen(choice.name);
    setPerkRefreshAvailable(false);
    setForgeMessage(`已收下无尽手艺「${choice.name}」，炉火仍可继续使用。`);
    setSnapshot(snapshotRun(run));
    play("sfx.upgrade");
  }, [endlessPerkChosen, pendingPairChoice, play]);

  const replaceEndlessPair = useCallback((replacePairId: EndlessPerkPairId) => {
    const run = runRef.current;
    const choice = pendingPairChoice;
    if (!run || !choice || choice.choiceKind !== "pair") return;
    run.endlessPerks = applyEndlessPerkChoice(run.endlessPerks, choice.id, {
      replacePairId,
    });
    setPendingPairChoice(null);
    setEndlessPerkChosen(choice.name);
    setPerkRefreshAvailable(false);
    setForgeMessage(`已用「${choice.name}」替下旧合页，炉火仍可继续使用。`);
    setSnapshot(snapshotRun(run));
    play("sfx.upgrade");
  }, [pendingPairChoice, play]);

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
    if (victory && !run.testModifiers.assisted) {
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
      setRareAdvanceTargets(getRareAdvanceTargets(run));
      setRareChoiceAvailability(getRareChoiceAvailability(run));
      setRareAdvanceWeaponId(null);
      setRareAdvanceOptionId(null);
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
    const progressionEvents = settleRunProgression(run);
    for (const event of progressionEvents) {
      if (event.type === "upgrade") queuedModalsRef.current.push("upgrade");
      if (event.type === "synergy") play("sfx.synergy");
    }
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
        void syncSceneVisualLifecycle(run, run.elapsed);
        play(event.tier === "mid" ? "sfx.boss-taotie" : "sfx.boss-nian");
        syncMusic();
      }
      if (
        event.type === "difficultyClear" &&
        event.unlocks &&
        !run.testModifiers.assisted
      ) {
        const saved = readProgress();
        const nextUnlocked = DIFFICULTY_IDS.filter(
          (id) =>
            saved.unlockedDifficultyIds.includes(id) || id === event.unlocks,
        );
        saveProgress({ unlockedDifficultyIds: nextUnlocked });
        setUnlockedDifficultyIds([...nextUnlocked]);
      }
      if (event.type === "term") {
        if (!run.endless && run.elapsed >= STANDARD_SECONDS) continue;
        const term = getSolarTermState(run.elapsed, run.endless).current;
        if (TERM_CHANGE_CHIMES.has(term.name)) play("sfx.term-change");
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
  }, [endRun, openNextQueuedModal, play, syncMusic, syncSceneVisualLifecycle]);

  const settleAfterBuildChoice = useCallback((run: RunState) => {
    const events = settleRunProgression(run);
    setSnapshot(snapshotRun(run));
    if (events.length === 0) {
      openNextQueuedModal(run);
      return;
    }
    setMode("playing");
    handleEvents(run, events);
  }, [handleEvents, openNextQueuedModal, setMode]);

  const resumePausedRun = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    const events = settleRunProgression(run);
    setSnapshot(snapshotRun(run));
    setMode("playing");
    if (events.length > 0) handleEvents(run, events);
    if (modeRef.current === "playing") syncMusic();
  }, [handleEvents, setMode, syncMusic]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (guideSection) {
        event.preventDefault();
        return;
      }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        event.preventDefault();
      }
      keysRef.current.add(key);
      if (key === "escape" && modeRef.current === "playing") {
        pauseGame();
      } else if (key === "escape" && modeRef.current === "paused") {
        resumePausedRun();
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
            settleAfterBuildChoice(run);
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
    guideSection,
    pauseGame,
    play,
    refreshSnapshot,
    resumePausedRun,
    setMode,
    settleAfterBuildChoice,
    syncRunVisuals,
    synergyOptions,
    toggleSynergyChoice,
    upgradeOptions,
  ]);

  const pollGamepadUi = useCallback((gamepad: Gamepad, time: number) => {
    const state = gamepadUiRef.current;
    const guideModal = document.querySelector<HTMLElement>(".guide-shell.guide-overlay");
    const pausePressed = gamepad.buttons[9]?.pressed ?? false;
    if (pausePressed && !state.pause) {
      if (guideModal) {
        guideModal.querySelector<HTMLButtonElement>("[data-guide-exit]")?.click();
      } else if (modeRef.current === "playing") {
        pauseGame();
      } else if (modeRef.current === "paused") {
        resumePausedRun();
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

    const modal = guideModal ?? document.querySelector<HTMLElement>(
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
    if (guideModal) {
      if (cancelPressed && !state.cancel) {
        state.cancelStartedAt = time;
        state.cancelLongTriggered = false;
      } else if (
        cancelPressed &&
        !state.cancelLongTriggered &&
        time - state.cancelStartedAt >= 650
      ) {
        guideModal.querySelector<HTMLButtonElement>("[data-guide-exit]")?.click();
        state.cancelLongTriggered = true;
      } else if (!cancelPressed && state.cancel && !state.cancelLongTriggered) {
        guideModal.querySelector<HTMLButtonElement>("[data-gamepad-cancel]")?.click();
      }
    } else if (cancelPressed && !state.cancel) {
      modal?.querySelector<HTMLButtonElement>("[data-gamepad-cancel]")?.click();
    }
    state.cancel = cancelPressed;
  }, [pauseGame, play, resumePausedRun]);

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
      const realDelta = Math.min(rawDelta, 0.034);
      lastFrameRef.current = time;
      const run = runRef.current;

      if (!run) {
        void syncSceneVisualLifecycle(null, (time / 1000) * 8);
        drawMenuPreview(context, time / 1000, assetsRef.current);
        frame = requestAnimationFrame(loop);
        return;
      }
      assetStreamDirectorRef.current?.advance(run.elapsed);
      void syncSceneVisualLifecycle(run, run.elapsed);

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
        const timeScale = clamp(run.testModifiers.timeScale, 1, 8);
        simulationAccumulatorRef.current += realDelta * timeScale;
        let simulatedDelta = 0;
        let steps = 0;
        while (
          simulationAccumulatorRef.current >= FIXED_STEP &&
          steps < MAX_SIMULATION_STEPS &&
          modeRef.current === "playing"
        ) {
          const events = stepRun(run, FIXED_STEP, direction);
          simulationAccumulatorRef.current -= FIXED_STEP;
          simulatedDelta += FIXED_STEP;
          steps += 1;
          handleEvents(run, events);
        }
        if (modeRef.current !== "playing") {
          simulationAccumulatorRef.current = 0;
        } else if (steps === MAX_SIMULATION_STEPS) {
          simulationAccumulatorRef.current = Math.min(
            simulationAccumulatorRef.current,
            FIXED_STEP,
          );
        }
        if (steps > 0) consumeCombatAudio(run);

        hudClockRef.current += simulatedDelta;
        if (hudClockRef.current >= 0.12) {
          hudClockRef.current = 0;
          setSnapshot(snapshotRun(run));
        }
      } else {
        simulationAccumulatorRef.current = 0;
      }

      const renderRun = !run.endless && run.elapsed >= STANDARD_SECONDS
        ? { ...run, elapsed: STANDARD_SECONDS - 0.001 }
        : run;
      drawRun(context, renderRun, time / 1000, assetsRef.current, joystickRef.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [consumeCombatAudio, handleEvents, pollGamepadUi, syncSceneVisualLifecycle]);

  const startGame = async () => {
    if (!assetsReady) return;
    // Audio and fullscreen must both begin inside the original pointer gesture.
    // Neither capability is allowed to block a run when the browser declines it.
    const audioInitialization = audioRef.current?.initFromGesture();
    const landscapeAttempt =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches
        ? requestLandscapePresentation()
        : undefined;
    setTestPanelUnlocked(false);
    setTestExperienceAdded(0);
    testUnlockTapRef.current = transitionTestUnlock(
      testUnlockTapRef.current,
      { type: "new-run" },
    ).state;
    const seed = Date.now();
    const run = createRun(trials, seed, {
      initialWeaponId: preferredInitialWeapon,
      unlockedWeaponIds: WEAPON_IDS,
      difficultyId: preferredDifficultyId,
      unlockedDifficultyIds,
    });
    const initialWeaponId = run.build.weapons[0]?.id ?? "sword";
    await waitAtMost(audioInitialization);
    if (landscapeAttempt) void landscapeAttempt;
    if (assetsRef.current.visuals) {
      await waitAtMost(
        preloadWeaponVisuals(assetsRef.current.visuals, [initialWeaponId]),
      );
    }
    void audioRef.current?.preload([
      "music.spring",
      "sfx.fold",
      "sfx.unfold",
      "sfx.pickup",
      "sfx.upgrade",
      "sfx.player-hit",
    ]);
    runRef.current = run;
    assetStreamDirectorRef.current?.advance(0);
    simulationAccumulatorRef.current = 0;
    setTestPanelState(run.testModifiers);
    if (assetsRef.current.visuals) {
      pruneVisualPack(assetsRef.current.visuals, [initialWeaponId], []);
    }
    releaseMovementInput();
    queuedModalsRef.current = [];
    forgeFireRef.current = 0;
    forgeCycleRef.current = 0;
    setForgeFire(0);
    setForgeCycle(0);
    setForgePurpose("cycle");
    setForgeTab("recipes");
    setForgeMobileView("actions");
    setForgePreview(null);
    forgeConfirmingRef.current = false;
    setForgeConfirming(false);
    setForgeExitBlocker(null);
    ringMoveRef.current = null;
    setRingMove(null);
    setRingFocusId(null);
    setEndlessPerkOptions([]);
    setEndlessPerkChosen(null);
    setPendingPairChoice(null);
    setSynergyOptions([]);
    setSelectedSynergyIds([]);
    setSynergyCapacity(3);
    setRareAdvanceTargets([]);
    setRareChoiceAvailability([]);
    setRareAdvanceWeaponId(null);
    setRareAdvanceOptionId(null);
    setDirectorPanelState(null);
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
    settleAfterBuildChoice(run);
  };

  const toggleTravelNoteContinuation = (
    noteId: TravelNoteId,
    enabled: boolean,
  ) => {
    const run = runRef.current;
    if (!run) return;
    setTravelNoteRepeatEnabled(run, noteId, enabled);
    setSnapshot(snapshotRun(run));
  };

  const chooseRare = (choice: RareChoice["id"]) => {
    const run = runRef.current;
    if (!run) return;
    const applied = applyRareChoice(
      run,
      choice,
      choice === "master-now" && rareAdvanceWeaponId
        ? {
            weaponId: rareAdvanceWeaponId,
            upgradeOptionId: rareAdvanceOptionId ?? undefined,
          }
        : undefined,
    );
    if (!applied) return;
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
    simulationAccumulatorRef.current = 0;
    releaseMovementInput();
    queuedModalsRef.current = [];
    forgeFireRef.current = 0;
    forgeCycleRef.current = 0;
    setForgeFire(0);
    setForgeCycle(0);
    setForgePurpose("cycle");
    setForgeTab("recipes");
    setForgePreview(null);
    forgeConfirmingRef.current = false;
    setForgeConfirming(false);
    setForgeExitBlocker(null);
    setEndlessPerkOptions([]);
    setEndlessPerkChosen(null);
    setPendingPairChoice(null);
    setSynergyOptions([]);
    setSelectedSynergyIds([]);
    setSynergyCapacity(3);
    setRareAdvanceWeaponId(null);
    setRareAdvanceOptionId(null);
    setRareAdvanceTargets([]);
    setRareChoiceAvailability([]);
    setDirectorPanelState(null);
    setTestPanelState(DEFAULT_TEST_PANEL_STATE);
    setTestPanelUnlocked(false);
    setTestExperienceAdded(0);
    testUnlockTapRef.current = transitionTestUnlock(
      testUnlockTapRef.current,
      { type: "new-run" },
    ).state;
    setSnapshot(emptySnapshot);
    setSelectedNodeIds([]);
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

  const chooseInitialWeapon = (choice: InitialWeaponChoice) => {
    setPreferredInitialWeapon(choice);
    saveProgress({ preferredInitialWeapon: choice });
    if (choice !== "random" && assetsRef.current.visuals) {
      void preloadWeaponVisuals(assetsRef.current.visuals, [choice]);
    }
  };

  const chooseDifficulty = (difficultyId: DifficultyId) => {
    if (!unlockedDifficultyIds.includes(difficultyId)) return;
    setPreferredDifficultyId(difficultyId);
    saveProgress({ preferredDifficultyId: difficultyId });
  };

  const choosePrimaryWeapon = (weaponId: WeaponId) => {
    const run = runRef.current;
    if (!run || !setPrimaryWeapon(run, weaponId)) return;
    setSnapshot(snapshotRun(run));
    setForgeMessage(
      `走马灯改照「${getWeaponDefinition(weaponId).name}」的最近一次完整核心攻击。`,
    );
    play("sfx.ui-confirm");
  };

  const updateTestModifiers = (
    update: Partial<Pick<TestPanelState, "timeScale" | "incomingDamageScale">>,
  ) => {
    const run = runRef.current;
    if (!run) return;
    run.testModifiers = {
      ...run.testModifiers,
      ...update,
      assisted: true,
    };
    setTestPanelState(run.testModifiers);
    setSnapshot(snapshotRun(run));
  };

  const addTestExperience = (amount = 100) => {
    const run = runRef.current;
    if (!run || amount <= 0) return;
    run.player.xp += amount;
    setTestExperienceAdded((current) => current + amount);
    updateTestModifiers({});
  };

  const stopTestExperienceHold = useCallback(() => {
    const gesture = testExperienceGestureRef.current;
    if (gesture?.timer) clearInterval(gesture.timer);
    testExperienceGestureRef.current = null;
  }, []);

  const startTestExperienceHold = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopTestExperienceHold();
    event.currentTarget.setPointerCapture(event.pointerId);
    const gesture: TestExperienceGesture = {
      pointerId: event.pointerId,
      startedAt: performance.now(),
      repeatedAmount: 0,
      totalAmount: 100,
      timer: null,
    };
    testExperienceGestureRef.current = gesture;
    addTestExperience(100);
    gesture.timer = setInterval(() => {
      const current = testExperienceGestureRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const elapsed = performance.now() - current.startedAt;
      const desiredDelta = calculateExperienceHoldDelta(
        current.repeatedAmount === 0
          ? 0
          : 350 + (current.repeatedAmount / 100 - 1) * 100,
        elapsed,
      );
      const remaining = EXPERIENCE_HOLD_MAX_PER_GESTURE - current.totalAmount;
      const amount = Math.min(desiredDelta, remaining);
      if (amount > 0) {
        current.repeatedAmount += amount;
        current.totalAmount += amount;
        addTestExperience(amount);
      }
      if (current.totalAmount >= EXPERIENCE_HOLD_MAX_PER_GESTURE) {
        stopTestExperienceHold();
      }
    }, 50);
  };

  const finishTestExperienceHold = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (testExperienceGestureRef.current?.pointerId !== event.pointerId) return;
    stopTestExperienceHold();
  };

  const resetTestUnlockSequence = useCallback(() => {
    testUnlockTapRef.current = transitionTestUnlock(
      testUnlockTapRef.current,
      { type: "cancel" },
    ).state;
    testUnlockPointerRef.current = null;
  }, []);

  const beginTestUnlockTap = (event: React.PointerEvent<HTMLElement>) => {
    testUnlockPointerRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragged: false,
    };
  };

  const moveTestUnlockTap = (event: React.PointerEvent<HTMLElement>) => {
    const pointer = testUnlockPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || pointer.dragged) return;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) {
      pointer.dragged = true;
      testUnlockTapRef.current = transitionTestUnlock(
        testUnlockTapRef.current,
        { type: "drag" },
      ).state;
    }
  };

  const cancelTestUnlockTap = () => {
    testUnlockTapRef.current = transitionTestUnlock(
      testUnlockTapRef.current,
      { type: "cancel" },
    ).state;
    testUnlockPointerRef.current = null;
  };

  const completeTestUnlockTap = () => {
    const pointer = testUnlockPointerRef.current;
    testUnlockPointerRef.current = null;
    if (!pointer || pointer.dragged) return;
    const transition = transitionTestUnlock(testUnlockTapRef.current, {
      type: "tap",
      atMs: performance.now(),
      onTarget: true,
    });
    testUnlockTapRef.current = transition.state;
    if (transition.unlockedNow) setTestPanelUnlocked(true);
  };

  useEffect(() => {
    if (mode !== "paused") {
      stopTestExperienceHold();
      testUnlockTapRef.current = transitionTestUnlock(
        testUnlockTapRef.current,
        { type: "pause-exit" },
      ).state;
      testUnlockPointerRef.current = null;
    }
    const stopWhenHidden = () => {
      if (document.hidden) stopTestExperienceHold();
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      stopTestExperienceHold();
    };
  }, [mode, stopTestExperienceHold]);

  const fillTestForgeFire = () => {
    const run = runRef.current;
    if (!run) return;
    run.forgeCredits = 3;
    forgeFireRef.current = 3;
    setForgeFire(3);
    updateTestModifiers({});
  };

  const weakenCurrentBoss = () => {
    const run = runRef.current;
    if (!run) return;
    const boss =
      run.enemies.find(
        (enemy) =>
          enemy.boss &&
          enemy.hp > 0 &&
          (!run.currentBoss || enemy.bossTier === run.currentBoss),
      ) ??
      run.enemies.find((enemy) => enemy.boss && enemy.hp > 0);
    if (!boss) return;
    boss.hp = 1;
    updateTestModifiers({});
  };

  const jumpToEndlessMinute = (minutes: 15 | 35 | 45 | 80) => {
    const run = runRef.current;
    if (!run || !jumpEndlessMinutesForTest(run, minutes)) return;
    queuedModalsRef.current = [];
    setTestPanelState(run.testModifiers);
    void syncRunVisuals(run);
    setSnapshot(snapshotRun(run));
    refreshDirectorPanel(run);
  };

  const summonTestBoss = (bossId: EndlessBossId) => {
    const run = runRef.current;
    if (!run) return;
    const events: RunEvent[] = [];
    if (!spawnEndlessBossForTest(run, bossId, events)) return;
    setTestPanelState(run.testModifiers);
    void syncRunVisuals(run);
    handleEvents(run, events);
    setSnapshot(snapshotRun(run));
    refreshDirectorPanel(run);
  };

  const resetTestMultipliers = () => {
    updateTestModifiers({
      timeScale: 1,
      incomingDamageScale: 1,
    });
  };

  const updateAudio = (update: Partial<AudioSettings>) => {
    audioRef.current?.setSettings(update);
    const settings = audioRef.current?.getSettings() ?? {
      ...audioSettings,
      ...update,
    };
    setAudioSettings(settings);
    if (update.muted === false) {
      void audioRef.current?.initFromGesture().then(() => syncMusic());
    }
  };

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (document.documentElement.dataset.viewportPresentation === "portrait-css-landscape") {
      return {
        x: ((event.clientY - rect.top) / rect.height) * GAME_WIDTH,
        y: ((rect.right - event.clientX) / rect.width) * GAME_HEIGHT,
      };
    }
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

  const showForgePreview = (preview: ForgePreview, openRing = true) => {
    setForgePreview(preview);
    if (openRing) setForgeMobileView("ring");
    ringMoveRef.current = null;
    setRingMove(null);
  };

  const onNodeSelect = (nodeId: string) => {
    setRingFocusId(nodeId);
    setSelectedNodeIds((current) => {
      if (current.includes(nodeId)) {
        return current.filter((value) => value !== nodeId);
      }
      if (current.length >= 2) return [nodeId];
      return [...current, nodeId];
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
    showForgePreview({
      kind: "fusion",
      title: definition.canonicalName,
      description:
        cost === 1
          ? `${definition.pairLabel}相邻，直接合器并空出一格。`
          : `${definition.pairLabel}不相邻，将沿较近位置归拢后合器（共 2 火）。`,
      cost,
      before: deriveWeaveTerminal(weave).name,
      after: deriveWeaveTerminal(result.state).name,
      weave: result.state,
      fusionId: definition.id,
    });
    setForgeMessage("配方已排好，核对收势变化后再落锤。");
  };

  const previewSelectedSwap = (
    sourceId?: string,
    targetId?: string,
  ) => {
    const run = runRef.current;
    if (!run?.weave) return;
    const chosenIds =
      sourceId && targetId ? [sourceId, targetId] : selectedNodeIds;
    if (chosenIds.length !== 2 || chosenIds[0] === chosenIds[1]) return;
    const [first, second] = chosenIds.map((nodeId) =>
      run.weave!.nodes.findIndex((node) => node.instanceId === nodeId),
    );
    if (first < 0 || second < 0) {
      setForgeMessage("器盘已变化，请重新选择要调位的两格。");
      setSelectedNodeIds([]);
      return;
    }
    const swapped = swapWeaveNodes(run.weave, first, second);
    if (swapped === run.weave) return;
    setSelectedNodeIds(chosenIds);
    showForgePreview({
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

  const updateRingMove = (next: RingMoveState | null) => {
    ringMoveRef.current = next;
    setRingMove(next);
  };

  const cancelForgePreview = () => {
    setForgePreview(null);
    updateRingMove(null);
    setForgeMessage("预览已取消，器盘仍保持原样。");
  };

  const nearestRingNodeId = (clientX: number, clientY: number) => {
    let nearestId: string | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const [nodeId, element] of ringNodeRefs.current) {
      if (element.offsetParent === null) continue;
      const bounds = element.getBoundingClientRect();
      const distance = Math.hypot(
        clientX - (bounds.left + bounds.width / 2),
        clientY - (bounds.top + bounds.height / 2),
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = nodeId;
      }
    }
    return nearestId;
  };

  const beginRingPointerMove = (
    event: React.PointerEvent<HTMLButtonElement>,
    nodeId: string,
  ) => {
    if (forgePreview || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    setRingFocusId(nodeId);
    const next: RingMoveState = {
      sourceId: nodeId,
      targetId: nodeId,
      input: "pointer",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    updateRingMove(next);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveRingPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = ringMoveRef.current;
    if (
      !current ||
      current.input !== "pointer" ||
      current.pointerId !== event.pointerId
    ) {
      return;
    }
    const distance = Math.hypot(
      event.clientX - (current.startX ?? event.clientX),
      event.clientY - (current.startY ?? event.clientY),
    );
    const dragging =
      current.dragging ||
      distance >= (event.pointerType === "touch" ? 10 : 6);
    if (!dragging) return;
    event.preventDefault();
    const targetId =
      nearestRingNodeId(event.clientX, event.clientY) ?? current.targetId;
    if (!current.dragging || targetId !== current.targetId) {
      updateRingMove({ ...current, targetId, dragging: true });
    }
  };

  const finishRingPointerMove = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    const current = ringMoveRef.current;
    if (
      !current ||
      current.input !== "pointer" ||
      current.pointerId !== event.pointerId
    ) {
      return;
    }
    const targetId =
      nearestRingNodeId(event.clientX, event.clientY) ?? current.targetId;
    updateRingMove(null);
    if (current.dragging) {
      suppressRingClickRef.current = true;
      window.setTimeout(() => {
        suppressRingClickRef.current = false;
      }, 0);
      if (targetId && targetId !== current.sourceId) {
        previewSelectedSwap(current.sourceId, targetId);
      } else {
        setForgeMessage("调位已取消；把器物放到另一格才会生成预览。");
      }
    }
  };

  const cancelRingPointerMove = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    const current = ringMoveRef.current;
    if (current?.pointerId !== event.pointerId) return;
    updateRingMove(null);
    setForgeMessage("调位已取消，器盘没有变化。");
  };

  const handleRingKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    nodeId: string,
  ) => {
    const nodes = snapshot.weave?.nodes ?? [];
    if (nodes.length === 0) return;
    if (event.key === "Escape") {
      if (ringMoveRef.current?.input === "keyboard") {
        event.preventDefault();
        updateRingMove(null);
        setForgeMessage("键盘调位已取消。");
      }
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const currentIndex = Math.max(
        0,
        nodes.findIndex((node) => node.instanceId === nodeId),
      );
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextNode =
        nodes[(currentIndex + delta + nodes.length) % nodes.length];
      setRingFocusId(nextNode.instanceId);
      ringNodeRefs.current.get(nextNode.instanceId)?.focus();
      const move = ringMoveRef.current;
      if (move?.input === "keyboard") {
        updateRingMove({ ...move, targetId: nextNode.instanceId });
      }
      return;
    }
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      const move = ringMoveRef.current;
      if (!move || move.input !== "keyboard") {
        updateRingMove({
          sourceId: nodeId,
          targetId: nodeId,
          input: "keyboard",
          dragging: true,
        });
        setForgeMessage("已拿起此格；用左右方向键选目标，Enter 或空格预览调位。");
      } else if (move.targetId !== move.sourceId) {
        previewSelectedSwap(move.sourceId, move.targetId);
      } else {
        updateRingMove(null);
      }
      return;
    }
    if (event.key === "Enter") {
      const move = ringMoveRef.current;
      if (move?.input === "keyboard") {
        event.preventDefault();
        if (move.targetId !== move.sourceId) {
          previewSelectedSwap(move.sourceId, move.targetId);
        } else {
          updateRingMove(null);
        }
      }
    }
  };

  const previewInsert = (
    weaponId = insertWeaponId,
    routeId = insertRouteId,
    afterIndex = insertAfter,
  ) => {
    const run = runRef.current;
    if (!run?.weave || !weaponId || !routeId) return;
    const weaponState: WeaponState = {
      id: weaponId,
      level: 3,
      routeId,
    };
    const result = insertWeaponNode(run.weave, weaponState, afterIndex);
    if (!result.ok) {
      setForgeMessage(
        result.reason === "node-capacity"
          ? "器盘已满，先合器释放盘位。"
          : "该武器已经在器盘中。",
      );
      play("sfx.ui-back");
      return;
    }
    const definition = getWeaponDefinition(weaponId);
    const route = definition.routes.find(
      (candidate) => candidate.id === routeId,
    );
    showForgePreview({
      kind: "insert",
      title: `添器 · ${definition.name}`,
      description: `以「${route?.name ?? "既定改法"}」插入${
        afterIndex < 0 ? "盘首" : `「${run.weave.nodes[afterIndex]?.name}」之后`
      }。`,
      cost: 1,
      before: deriveWeaveTerminal(run.weave).name,
      after: deriveWeaveTerminal(result.state).name,
      weave: result.state,
    }, false);
    setForgeMessage("新武器的位置与改法已排好；落锤后消耗一火。");
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
    showForgePreview({
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
    }, false);
    setForgeMessage("下一阶做法已排好；落锤后推进一阶。");
  };

  const previewCelestial = () => {
    const run = runRef.current;
    if (!run?.weave) return;
    let baseWeave = run.weave;
    let celestialInsertAfter = insertAfter;
    let replacedName: string | undefined;
    if (baseWeave.nodes.length >= baseWeave.maxNodes) {
      if (selectedNodeIds.length !== 1) {
        setForgeMessage("器盘已满：先点一格作为替换位，炼化仍然免费。");
        play("sfx.ui-back");
        return;
      }
      const selectedIndex = baseWeave.nodes.findIndex(
        (node) => node.instanceId === selectedNodeIds[0],
      );
      if (selectedIndex < 0) {
        setForgeMessage("器盘已变化，请重新选择要替换的盘位。");
        setSelectedNodeIds([]);
        return;
      }
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
    showForgePreview({
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
    if (!run?.weave || selectedNodeIds.length !== 1) return;
    const nodeIndex = run.weave.nodes.findIndex(
      (candidate) => candidate.instanceId === selectedNodeIds[0],
    );
    if (nodeIndex < 0) {
      setForgeMessage("器盘已变化，请重新选择要拆下的器物。");
      setSelectedNodeIds([]);
      return;
    }
    const node = run.weave.nodes[nodeIndex];
    if (!node || run.weave.nodes.length <= 1) {
      setForgeMessage("器盘至少要留一件器物。");
      play("sfx.ui-back");
      return;
    }
    const nextWeave = removeWeaveNode(run.weave, nodeIndex);
    if (nextWeave === run.weave) return;
    showForgePreview({
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
    if (!run?.weave || !preview || forgeConfirmingRef.current) return;
    if (run.forgeCredits < preview.cost) {
      setForgeMessage(`炉火不足：此操作需要 ${preview.cost} 点。`);
      play("sfx.ui-back");
      return;
    }
    forgeConfirmingRef.current = true;
    setForgeConfirming(true);
    setForgeExitBlocker(null);
    try {
      run.weave = preview.weave;
      run.forgeCredits -= preview.cost;
      forgeFireRef.current = run.forgeCredits;
      setForgeFire(run.forgeCredits);
      setSelectedNodeIds([]);
      setForgePreview(null);
      setInsertWeaponId(null);
      setInsertRouteId(null);
      setSnapshot(snapshotRun(run));
      try {
        await syncRunVisuals(run);
      } catch {
        setForgeMessage("器盘已定，余火仍可留用。");
      }
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
    } finally {
      forgeConfirmingRef.current = false;
      setForgeConfirming(false);
    }
  };

  const finishForgeExit = (run: RunState | null) => {
    setForgeExitBlocker(null);
    setSelectedNodeIds([]);
    setForgePreview(null);
    updateRingMove(null);
    if (run) openNextQueuedModal(run);
    else setMode("playing");
  };

  const dismissCelestialReward = (run: RunState) => {
    const intrusion = run.weave?.activeIntrusion;
    if (!run.weave || intrusion?.phase !== "defeated") return false;
    const intrusionId = intrusion.id;
    run.enemies = run.enemies.filter(
      (enemy) =>
        enemy.id !== run.intrusionAvatarId &&
        enemy.celestialSourceId !== intrusionId,
    );
    run.strikes = run.strikes.filter(
      (strike) =>
        !(
          strike.hostile &&
          strike.artKey.startsWith(`celestial/${intrusionId}/`)
        ),
    );
    run.fx = run.fx.filter(
      (effect) => !effect.artKey.startsWith(`celestial/${intrusionId}/`),
    );
    run.intrusionAvatarId = undefined;
    run.celestialHazardClock = 0;
    run.weave = dismissDefeatedIntrusion(run.weave);
    setSnapshot(snapshotRun(run));
    return true;
  };

  const forgeExitContext = () => {
    const run = runRef.current;
    const heldWeapons = run?.build.weapons ?? [];
    const primaryChoices = snapshot.availablePrimaryWeaponIds;
    return {
      processing: forgeConfirmingRef.current,
      perkRequired: forgePurpose === "cycle",
      perkChosen: Boolean(endlessPerkChosen),
      pairReplacementPending: Boolean(pendingPairChoice),
      primaryWeaponRequired:
        heldWeapons.some((weapon) => weapon.id === "lantern") &&
        primaryChoices.length > 0,
      primaryWeaponValid:
        primaryChoices.length === 0 ||
        snapshot.primaryWeaponValid,
      previewPending: Boolean(forgePreview),
      celestialRewardPending:
        run?.weave?.activeIntrusion?.phase === "defeated",
    };
  };

  const closeForge = () => {
    const run = runRef.current;
    const state = getForgeExitState(forgeExitContext());
    if (state === "ready") {
      finishForgeExit(run);
      return;
    }
    const blocker = getForgeExitBlocker(state);
    if (!blocker) return;
    setForgeExitBlocker(blocker);
    setForgeMessage(blocker.description);
    if (!blocker.disablesContinue) play("sfx.ui-back");
  };

  const focusForgeControl = (selector: string) => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(selector)?.focus();
    });
  };

  const handleForgeExitAction = (actionId: ForgeExitActionId) => {
    const run = runRef.current;
    setForgeExitBlocker(null);
    switch (actionId) {
      case "focusPerkChoice":
        setForgeMobileView("actions");
        focusForgeControl(".forge-perk-card:not(:disabled)");
        return;
      case "focusPairReplacement":
        setForgeMobileView("actions");
        focusForgeControl(".forge-context-guide button:not(:disabled)");
        return;
      case "focusPrimaryWeapon":
        setForgeMobileView("actions");
        focusForgeControl(".forge-primary-picker select");
        return;
      case "returnToPreview":
        confirmForgePreview();
        return;
      case "discardPreview":
        setForgePreview(null);
        updateRingMove(null);
        if (run?.weave?.activeIntrusion?.phase === "defeated") {
          const blocker = getForgeExitBlocker("celestialRewardPending");
          if (blocker) setForgeExitBlocker(blocker);
          return;
        }
        finishForgeExit(run);
        return;
      case "returnToCelestialReward":
        setForgeTab("celestial");
        setForgeMobileView("actions");
        focusForgeControl(".celestial-button:not(:disabled)");
        return;
      case "dismissCelestialReward":
        if (run && dismissCelestialReward(run)) {
          setForgeMessage("本次天时已舍下，残余天变也已散去。");
          play("sfx.ui-confirm");
        }
        finishForgeExit(run);
        return;
    }
  };

  const term = getSolarTermState(snapshot.elapsed, snapshot.endless);
  const loadProgress = Math.round(
    ((loading.season + loading.enemy + loading.visual + loading.terms) / 4) * 100,
  );
  const lanternHeld = snapshot.weapons.some((weapon) => weapon.id === "lantern");
  const primaryWeaponChoices = snapshot.availablePrimaryWeaponIds;
  const primaryWeaponName = snapshot.primaryWeaponId
    ? snapshot.primaryWeaponValid
      ? getWeaponDefinition(snapshot.primaryWeaponId).name
      : `需重选（原为${getWeaponDefinition(snapshot.primaryWeaponId).name}）`
    : "尚未指定";
  const selectedRareAdvance = rareAdvanceTargets.find(
    (target) => target.weaponId === rareAdvanceWeaponId,
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
  const selectedNodeIndices = (snapshot.weave?.nodes ?? [])
    .map((node, index) =>
      selectedNodeIds.includes(node.instanceId) ? index : -1,
    )
    .filter((index) => index >= 0);
  const selectedRecipe =
    selectedNodeIndices.length === 2
      ? fusionRecipes.find(
          (recipe) =>
            recipe.firstIndex === selectedNodeIndices[0] &&
            recipe.secondIndex === selectedNodeIndices[1],
        ) ??
        fusionRecipes.find(
          (recipe) =>
            recipe.firstIndex === selectedNodeIndices[1] &&
            recipe.secondIndex === selectedNodeIndices[0],
        )
      : undefined;
  const previewWeave = forgePreview?.weave ?? snapshot.weave;
  const activeCelestial =
    snapshot.weave?.activeIntrusion?.phase === "defeated"
      ? getCelestialIntrusion(snapshot.weave.activeIntrusion.id)
      : undefined;
  const selectedForgeNode =
    selectedNodeIndices.length === 1
      ? snapshot.weave?.nodes[selectedNodeIndices[0]]
      : undefined;
  const currentTerminalName = snapshot.weave
    ? deriveWeaveTerminal(snapshot.weave).name
    : "";
  const requiredSynergyCount = Math.min(
    synergyCapacity,
    synergyOptions.length,
  );

  return (
    <main className="page" data-game-phase={mode} data-season={term.season}>
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
                  <span>
                    纸命{" "}
                    <b className="hearts">
                      {snapshot.maxLife > 10
                        ? `◆×${Math.max(0, snapshot.life)} / ${snapshot.maxLife}`
                        : `${"◆".repeat(Math.max(0, snapshot.life))}${"◇".repeat(Math.max(0, snapshot.maxLife - snapshot.life))}`}
                    </b>
                  </span>
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
                <span>难度 · {DIFFICULTIES[snapshot.difficultyId ?? "normal"].name}</span>
                {testPanelState.assisted && (
                  <span className="test-run-badge">
                    测试局 · ×{testPanelState.timeScale}
                    {testPanelState.incomingDamageScale === 0 ? " · 无伤" : ""}
                  </span>
                )}
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
                {lanternHeld && (
                  <span title={snapshot.primaryWeaponRule}>
                    走马灯照样 · {primaryWeaponName}
                  </span>
                )}
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
              <p className="kicker"><span className="seal">百工</span> 一人一卷 · 四时百工</p>
              <h1 className="title">纸上<span>百工</span></h1>
              <p className="subtitle">
                只需移动，器物自会寻敌。八分钟走过四时，击退年兽后收卷，或续入无尽。
              </p>
              <label className="initial-weapon-select">
                <span>开卷武器</span>
                <select
                  aria-label="选择初始武器"
                  value={preferredInitialWeapon}
                  onChange={(event) =>
                    chooseInitialWeapon(event.target.value as InitialWeaponChoice)
                  }
                >
                  <option value="random">随机武器</option>
                  {WEAPON_IDS.map((weaponId) => (
                    <option key={weaponId} value={weaponId}>
                      {getWeaponDefinition(weaponId).name}
                    </option>
                  ))}
                </select>
                <small>
                  {preferredInitialWeapon === "random"
                    ? "每次从十把武器中随机一把"
                    : `从「${getWeaponDefinition(preferredInitialWeapon).name}」起手`}
                </small>
              </label>
              <div className="trial-area" aria-label="行旅难度">
                <p className="trial-label">行旅难度 · 逐档收卷后解锁</p>
                <div className="trials">
                  {DIFFICULTY_IDS.map((difficultyId) => {
                    const definition = DIFFICULTIES[difficultyId];
                    const unlocked = unlockedDifficultyIds.includes(difficultyId);
                    return (
                      <button
                        key={difficultyId}
                        className={`trial ${
                          preferredDifficultyId === difficultyId ? "active" : ""
                        }`}
                        aria-pressed={preferredDifficultyId === difficultyId}
                        disabled={!unlocked}
                        onClick={() => chooseDifficulty(difficultyId)}
                        title={
                          unlocked
                            ? DIFFICULTY_SUMMARY[difficultyId]
                            : "先通关上一档难度"
                        }
                      >
                        {unlocked ? definition.name : `未解 · ${definition.name}`}
                      </button>
                    );
                  })}
                </div>
                <small>{DIFFICULTY_SUMMARY[preferredDifficultyId]}</small>
              </div>
              <div className="button-row">
                <button className="primary-button" onClick={startGame} disabled={!assetsReady}>
                  {assetsReady ? "展卷启程" : `卷页装订中 ${loadProgress}%`}
                </button>
                <button className="secondary-button" onClick={() => openGuide("start")}>
                  百工手册
                </button>
                <button
                  className="secondary-button"
                  onClick={() => updateAudio({ muted: !audioSettings.muted })}
                >
                  {audioSettings.muted ? "开启声音" : "声音已开"}
                </button>
              </div>
              <details className="trial-area menu-trials">
                <summary>{trialsUnlocked ? "试炼签（可叠加）" : "首次收卷后解锁试炼签"}</summary>
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
              </details>
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
                    : upgradeOptions[0]?.kind === "utility" &&
                        upgradeOptions[0].travelNoteId
                      ? "器物均已定型 · 选一张行旅札记"
                      : "拾取一页百工谱"}
              </h2>
              <p className="upgrade-note">
                {upgradeOptions[0]?.kind === "utility" &&
                upgradeOptions[0].travelNoteId
                  ? "三张牌依次照顾器用、行路与护身。四阶精通后，可自行决定哪些札记继续收入牌池。"
                  : "武器到3/5时选一种改法，到5/5时从两种定型中择一；本局选定后不再更改。"}
              </p>
              <button
                className="context-guide-link"
                onClick={() => openGuide(
                  upgradeOptions[0]?.kind === "utility" && upgradeOptions[0].travelNoteId
                    ? "progression"
                    : "weapons",
                )}
              >
                查看这一步的规则
              </button>
              {upgradeOptions.some(
                (option) => option.kind === "utility" && Boolean(option.travelNoteId),
              ) && (
                <details className="travel-note-repeat-panel">
                  <summary>已精通札记 · 继续收录</summary>
                  <p>开关只影响后续牌面，不撤销已经获得的效果。未选札记仍会更常出现。</p>
                  <div className="travel-note-repeat-grid">
                    {Object.entries(snapshot.travelNotes)
                      .filter(([, rank]) => Number(rank ?? 0) >= 4)
                      .map(([noteId, rank]) => {
                        const id = noteId as TravelNoteId;
                        return (
                          <label key={id}>
                            <input
                              type="checkbox"
                              checked={Boolean(snapshot.travelNoteRepeatEnabled[id])}
                              onChange={(event) => toggleTravelNoteContinuation(id, event.target.checked)}
                            />
                            <span>{getTravelNoteDefinition(id).name}</span>
                            <small>已精通 · 续记 {Math.max(0, Number(rank) - 4)}</small>
                          </label>
                        );
                      })}
                  </div>
                </details>
              )}
              {lanternHeld && (
                <label className="initial-weapon-select">
                  <span>走马灯照样对象</span>
                  <select
                    aria-label="选择走马灯照样的主武器"
                    value={snapshot.primaryWeaponValid ? snapshot.primaryWeaponId : ""}
                    disabled={primaryWeaponChoices.length === 0}
                    onChange={(event) =>
                      choosePrimaryWeapon(event.target.value as WeaponId)
                    }
                  >
                    {primaryWeaponChoices.length === 0 && (
                      <option value="">先拿到一把其他武器</option>
                    )}
                    {!snapshot.primaryWeaponValid && primaryWeaponChoices.length > 0 && (
                      <option value="" disabled>重新选择照样对象</option>
                    )}
                    {primaryWeaponChoices.map((weaponId) => (
                      <option key={weaponId} value={weaponId}>
                        {getWeaponDefinition(weaponId).name}
                      </option>
                    ))}
                  </select>
                  <small>{snapshot.primaryWeaponRule}</small>
                </label>
              )}
              <div className={`upgrade-grid count-${upgradeOptions.length}`}>
                {upgradeOptions.map((option, index) => {
                  const color = option.kind === "utility"
                    ? option.travelNoteCategory === "craft"
                      ? "#8d5738"
                      : option.travelNoteCategory === "journey"
                        ? "#426b62"
                        : "#76546b"
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
                  const currentLevel =
                    option.kind === "acquire" ? 0 : currentWeapon?.level ?? 0;
                  const requiresCurrentWeapon =
                    option.kind !== "utility" && option.kind !== "acquire";
                  const availability = (option as UpgradeOptionUiContract)
                    .availability;
                  const unavailable =
                    (requiresCurrentWeapon && currentWeapon === undefined) ||
                    availability?.enabled === false;
                  const weaponDefinition =
                    option.kind === "utility"
                      ? undefined
                      : getWeaponDefinition(option.weaponId);
                  return (
                    <button
                      className={`upgrade-card ${unavailable ? "is-unavailable" : ""}`}
                      key={option.id}
                      onClick={() => chooseUpgrade(option)}
                      disabled={unavailable}
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
                      <span className="card-type-row">
                        <span className="card-type">
                          {index + 1} · {optionKind(option)}
                        </span>
                        {requiresCurrentWeapon && (
                          <span className="current-weapon-tag">
                            当前武器 · {weaponDefinition?.name}
                          </span>
                        )}
                      </span>
                      <h3>
                        {option.kind === "acquire"
                          ? weaponDefinition?.name
                          : option.title}
                      </h3>
                      <p>
                        {unavailable
                          ? availability?.reason ??
                            "当前没有这件武器，无法推进；请改选其他百工谱。"
                          : option.description}
                      </p>
                      {option.kind !== "utility" && (
                        <div
                          className="stage-progress"
                          role="img"
                          aria-label={`当前阶段 ${currentLevel}/5，选择后 ${targetLevel}/5`}
                        >
                          <span>当前 {currentLevel}/5</span>
                          <span className="level-dots" aria-hidden="true">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <i
                                key={level}
                                className={
                                  level <= currentLevel
                                    ? "on"
                                    : level <= targetLevel
                                      ? "next"
                                      : ""
                                }
                              />
                            ))}
                          </span>
                          <span>选择后 {targetLevel}/5</span>
                        </div>
                      )}
                      {option.kind === "utility" && option.travelNoteId && (
                        <div
                          className="stage-progress travel-note-progress"
                          role="img"
                          aria-label={`当前 ${option.currentRank ?? 0} 阶，选择后 ${option.nextRank ?? 1} 阶；四阶精通`}
                        >
                          <span>
                            {Number(option.currentRank ?? 0) >= Number(option.masteryRank ?? 4)
                              ? `已精通 · 续记 ${Math.max(0, Number(option.currentRank ?? 0) - Number(option.masteryRank ?? 4))}`
                              : `当前 ${option.currentRank ?? 0}/${option.masteryRank ?? 4}`}
                          </span>
                          <span className="travel-note-arrow" aria-hidden="true">→</span>
                          <span>
                            选择后 {option.nextRank ?? 1} 阶
                          </span>
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
                      <small className="synergy-trigger">
                        成立条件：
                        {(option as SynergyChoiceUiContract).conditionText ??
                          "两把组成武器都达到 3/5"}
                        <br />触发动作：
                        {(option as SynergyChoiceUiContract).triggerText ??
                          SYNERGY_TRIGGER_TEXT[option.id] ??
                          "组成武器完成对应动作时"}
                        <br />实际效果：
                        {(option as SynergyChoiceUiContract).effectText ??
                          option.description}
                        <br />当前改法：
                        {(option as SynergyChoiceUiContract).routeImpactText ??
                          "双方改法都会改变这次搭手"}
                      </small>
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
              <label className="initial-weapon-select">
                <span>推进哪件武器</span>
                <select
                  value={rareAdvanceWeaponId ?? ""}
                  disabled={rareAdvanceTargets.length === 0}
                  onChange={(event) => {
                    const weaponId = event.target.value as WeaponId;
                    const target = rareAdvanceTargets.find(
                      (candidate) => candidate.weaponId === weaponId,
                    );
                    setRareAdvanceWeaponId(weaponId);
                    setRareAdvanceOptionId(
                      target?.options.length === 1 ? target.options[0].id : null,
                    );
                  }}
                >
                  <option value="">
                    {rareAdvanceTargets.length > 0
                      ? "先选择一件武器"
                      : "当前器物均已定型"}
                  </option>
                  {rareAdvanceTargets.map((target) => (
                    <option key={target.weaponId} value={target.weaponId}>
                      {target.weaponName} · 当前 {target.currentLevel}/5 → {target.nextLevel}/5
                    </option>
                  ))}
                </select>
                {selectedRareAdvance?.needsExplicitChoice && (
                  <select
                    aria-label={`${selectedRareAdvance.weaponName}下一阶段做法`}
                    value={rareAdvanceOptionId ?? ""}
                    onChange={(event) => setRareAdvanceOptionId(event.target.value)}
                  >
                    <option value="">再选下一步改法</option>
                    {selectedRareAdvance.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.title} · {option.description}
                      </option>
                    ))}
                  </select>
                )}
                <small>
                  {selectedRareAdvance
                    ? `当前武器·${selectedRareAdvance.weaponName}　当前 ${selectedRareAdvance.currentLevel}/5 → 选择后 ${selectedRareAdvance.nextLevel}/5`
                    : "改法或定型仍由你选定。"}
                </small>
              </label>
              <div className="upgrade-grid">
                {rareChoiceAvailability.map((choice, index) => {
                  const advanceReady =
                    choice.id !== "master-now" ||
                    Boolean(
                      selectedRareAdvance &&
                      (!selectedRareAdvance.needsExplicitChoice || rareAdvanceOptionId),
                    );
                  return (
                  <button
                    key={choice.id}
                    className="upgrade-card rare-card"
                    onClick={() => chooseRare(choice.id)}
                    disabled={!choice.enabled || !advanceReady}
                  >
                    <span className="card-type">{index + 1} · 特别做法</span>
                    <h3>{choice.name}</h3>
                    <p>
                      {!choice.enabled
                        ? choice.reason
                        : choice.id === "master-now" && !advanceReady
                          ? "请先在上方选定武器与下一步。"
                          : choice.description}
                    </p>
                  </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {mode === "forge" && snapshot.weave && (
          <div className="overlay modal-shade">
            <section className="forge-panel">
              <header className="forge-shell-header">
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
              {lanternHeld && (
                <section className="forge-primary-rule" aria-label="走马灯照样规则">
                  <div className="forge-primary-copy">
                    <strong>走马灯照样：{primaryWeaponName}</strong>
                    <span>{snapshot.primaryWeaponRule}</span>
                  </div>
                  <label className="forge-primary-picker">
                    <span>免费改选</span>
                    <select
                      value={snapshot.primaryWeaponValid ? snapshot.primaryWeaponId : ""}
                      disabled={primaryWeaponChoices.length === 0}
                      onChange={(event) =>
                        choosePrimaryWeapon(event.target.value as WeaponId)
                      }
                    >
                      {primaryWeaponChoices.length === 0 && (
                        <option value="">先添一把其他武器</option>
                      )}
                      {!snapshot.primaryWeaponValid && primaryWeaponChoices.length > 0 && (
                        <option value="" disabled>重新选择照样对象</option>
                      )}
                      {primaryWeaponChoices.map((weaponId) => (
                        <option key={weaponId} value={weaponId}>
                          {getWeaponDefinition(weaponId).name}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
              )}

              {forgePurpose === "cycle" && (
              <section className={`forge-perk-section ${endlessPerkChosen ? "chosen" : ""}`}>
                <div className="forge-section-heading">
                  <div>
                    <strong>百工谱 · 四选一</strong>
                    <small>{endlessPerkChosen ? `本轮已取「${endlessPerkChosen}」` : "新页、已有页分支、可成合页与当前处境；键盘可按 1–4"}</small>
                  </div>
                  <button
                    className="forge-refresh"
                    onClick={refreshEndlessPerkRow}
                    disabled={
                      !perkRefreshAvailable ||
                      Boolean(endlessPerkChosen) ||
                      Boolean(pendingPairChoice)
                    }
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
                        disabled={Boolean(endlessPerkChosen || pendingPairChoice)}
                      >
                        <span>
                          {index + 1} · {perkChoiceKindLabel(choice.choiceKind)} · {perkCategoryLabel(choice.category)}
                        </span>
                        <strong>{choice.name}</strong>
                        <small>{choice.description}</small>
                        <em>
                          {choice.choiceKind === "page"
                            ? "拿到后开放两条互斥分支"
                            : choice.choiceKind === "branch" && choice.parentPageId
                              ? `承自「${getEndlessPerkDefinition(choice.parentPageId).name}」· 选后另一支锁定`
                              : choice.requiredPageIds
                                ? `合页：${choice.requiredPageIds.map((id) => getEndlessPerkDefinition(id).name).join(" × ")} · 已启用 ${snapshot.endlessPerks?.activePairIds.length ?? 0}/6`
                                : rank > 0
                                  ? `已有 ${rank}/${choice.maxRank}`
                                  : `上限 ${choice.maxRank}`}
                        </em>
                      </button>
                    );
                  })}
                </div>
                {pendingPairChoice && (
                  <div className="forge-context-guide" aria-label="替换百工谱合页">
                    <strong>装订「{pendingPairChoice.name}」前，替下一项旧合页</strong>
                    <span>合页最多同时启用六项；新页与分支不受影响。</span>
                    <div className="test-action-row">
                      {(snapshot.endlessPerks?.activePairIds ?? []).map((pairId) => (
                        <button
                          key={pairId}
                          onClick={() => replaceEndlessPair(pairId)}
                        >
                          替下 · {getEndlessPerkDefinition(pairId).name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
              )}
              </header>

              <nav className="forge-view-switch" aria-label="窄屏铸器视图">
                <button
                  className={forgeMobileView === "actions" ? "active" : ""}
                  aria-pressed={forgeMobileView === "actions"}
                  onClick={() => setForgeMobileView("actions")}
                >
                  操作
                </button>
                <button
                  className={forgeMobileView === "ring" ? "active" : ""}
                  aria-pressed={forgeMobileView === "ring"}
                  onClick={() => setForgeMobileView("ring")}
                >
                  器盘
                  {forgePreview ? " · 待确认" : ""}
                </button>
              </nav>

              <div className={`forge-workbench view-${forgeMobileView}`}>
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
                        aria-pressed={forgeTab === tab}
                        onClick={() => {
                          setForgeTab(tab);
                          setForgePreview(null);
                          updateRingMove(null);
                          setForgeMobileView("actions");
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
                    <div className="forge-zone-scroll forge-temper-scroll">
                    {availableNodes.length > 0 && (
                      <div className="forge-add-flow">
                        <div className="forge-weapon-picks">
                          {availableNodes.map((weaponId) => {
                            const definition = getWeaponDefinition(weaponId);
                            return (
                              <button
                                key={weaponId}
                                className={`forge-weapon-pick ${insertWeaponId === weaponId ? "active" : ""}`}
                                onClick={() => {
                                  setInsertWeaponId(weaponId);
                                  setInsertRouteId(null);
                                  setForgePreview(null);
                                }}
                              >
                                <i
                                  aria-hidden="true"
                                  style={weaponThumbStyle(weaponId, { level: 1 })}
                                />
                                <span>
                                  <strong>{definition.name}</strong>
                                  <small>{definition.shortName}</small>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {insertWeaponId && (
                          <div className="forge-add-detail">
                            <div className="forge-add-feature">
                              <i
                                aria-hidden="true"
                                style={weaponThumbStyle(insertWeaponId, {
                                  level: insertRouteId ? 3 : 2,
                                  route: insertRouteId ?? undefined,
                                })}
                              />
                              <span>
                                <small>准备添入器盘</small>
                                <strong>{getWeaponDefinition(insertWeaponId).name}</strong>
                                <p>{getWeaponDefinition(insertWeaponId).description}</p>
                              </span>
                            </div>
                            <div className="forge-route-picks">
                              {getWeaponDefinition(insertWeaponId).routes.map((route) => (
                                <button
                                  key={route.id}
                                  className={insertRouteId === route.id ? "active" : ""}
                                  onClick={() => {
                                    setInsertRouteId(route.id);
                                    previewInsert(insertWeaponId, route.id, insertAfter);
                                  }}
                                >
                                  <i
                                    aria-hidden="true"
                                    style={weaponThumbStyle(insertWeaponId, {
                                      level: 3,
                                      route: route.id,
                                    })}
                                  />
                                  <span>
                                    <strong>{route.name}</strong>
                                    <small>{route.description}</small>
                                  </span>
                                </button>
                              ))}
                            </div>
                            <div className="forge-gap-row">
                              <label>
                                插入缝隙
                                <select
                                  value={insertAfter}
                                  onChange={(event) => {
                                    const nextAfter = Number(event.target.value);
                                    setInsertAfter(nextAfter);
                                    previewInsert(insertWeaponId, insertRouteId, nextAfter);
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
                              <div className={`forge-insert-preview ${insertRouteId ? "ready" : ""}`}>
                                {insertRouteId
                                  ? "已自动排好 · 落锤添入 1 火"
                                  : "先选一种改法"}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {availableNodes.length === 0 && (
                      <p className="forge-empty">器盘已满，添器入口已收起；可先完成合器。</p>
                    )}
                    <div className="forge-option-list temper-list">
                      {temperOffers.map((offer) => {
                        const definition = getWeaponDefinition(offer.weaponState.id);
                        return (
                          <button
                            key={offer.id}
                            className="forge-option-card temper-card"
                            onClick={() => previewTemper(offer)}
                          >
                            <i
                              className="temper-card-art"
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
                            <span>第 {offer.nodeIndex + 1} 格 · {definition.name}</span>
                            <strong>{offer.title}</strong>
                            <small>{offer.description}</small>
                            <em>推进至 {offer.weaponState.level}/5 · 1 火</em>
                          </button>
                        );
                      })}
                      {temperOffers.length === 0 && (
                        <div className="forge-temper-empty" role="status">
                          <strong>没有可继续做细的武器</strong>
                          <span>当前器物均已定型；可继续添器、调位、合器或拆器。</span>
                        </div>
                      )}
                    </div>
                    </div>
                  </section>

                  <section className="forge-zone forge-zone-arrange">
                    <div className="forge-zone-title">
                      <strong>调位</strong>
                      <small>拖动可直接预览；也可点选两格后使用下方按钮</small>
                    </div>
                    <div className="forge-zone-scroll">
                    <div className="forge-selection">
                      <div className="forge-selection-summary">
                        {selectedNodeIds.length === 0
                          ? "尚未选节点"
                          : selectedNodeIds
                              .map((nodeId) => {
                                const index = snapshot.weave?.nodes.findIndex(
                                  (node) => node.instanceId === nodeId,
                                ) ?? -1;
                                return `${index + 1}.${snapshot.weave?.nodes[index]?.name}`;
                              })
                              .join(" ＋ ")}
                      </div>
                      <p className="forge-instruction">
                        鼠标或触屏：把一格拖到另一格。键盘：聚焦节点后按空格拿起，
                        左右选目标，再按 Enter；所有方式都只生成预览。
                      </p>
                      <div className="forge-selection-actions">
                        <button
                          onClick={() => previewSelectedSwap()}
                          disabled={selectedNodeIds.length !== 2}
                        >
                          预览调位 · 1 火
                        </button>
                        <button
                          onClick={() => {
                            if (selectedNodeIndices.length === 2) {
                              previewFusion(
                                selectedNodeIndices[0],
                                selectedNodeIndices[1],
                              );
                            }
                          }}
                          disabled={!selectedRecipe}
                        >
                          {selectedRecipe ? `预览${selectedRecipe.title}` : "所选无合器谱"}
                        </button>
                      </div>
                    </div>
                    <div className="forge-context-guide" aria-label="调位说明">
                      <article>
                        <span>顺时针读盘</span>
                        <strong>{currentTerminalName}</strong>
                        <p>游标依次经过每一格，交换位置会改变后续传递与收势。</p>
                      </article>
                      <article>
                        <span>安全预览</span>
                        <strong>松手不会立即改盘</strong>
                        <p>拖动、点选或键盘取放都先生成结果，确认落锤时才扣一火。</p>
                      </article>
                      <article>
                        <span>当前选择</span>
                        <strong>
                          {selectedNodeIds.length > 0
                            ? `${selectedNodeIds.length} 格已选`
                            : "等待选择"}
                        </strong>
                        <p>
                          {selectedNodeIds.length === 2
                            ? "可直接预览调位；若两件本命器有配方，也可在此合器。"
                            : "从右侧器盘选两格，或把一格直接拖到另一格。"}
                        </p>
                      </article>
                    </div>
                    </div>
                  </section>

                  <section className="forge-zone forge-zone-celestial">
                    <div className="forge-zone-title">
                      <strong>天时 / 拆器</strong>
                      <small>天时随器盘游标触发；炼化免费，拆器耗一火</small>
                    </div>
                    <div className="forge-zone-scroll">
                    <div className="celestial-actions">
                      {activeCelestial ? (
                        <article className="celestial-capture-card">
                          <span className="celestial-capture-seal" aria-hidden="true">
                            天
                          </span>
                          <div>
                            <small>已伏 · {activeCelestial.name}</small>
                            <strong>{activeCelestial.capturedName}</strong>
                            <p>{CELESTIAL_CAPTURE_TEXT[activeCelestial.id]}</p>
                            <em>
                              {snapshot.weave.nodes.length >= snapshot.weave.maxNodes
                                ? selectedForgeNode
                                  ? `将替换「${selectedForgeNode.name}」；原器不会自动回盘。`
                                  : "器盘已满：请先在右侧点一格作为替换位。"
                                : "将免费插入所选缝隙，不消耗炉火。"}
                            </em>
                          </div>
                          <button
                            className="celestial-button"
                            onClick={previewCelestial}
                            disabled={
                              snapshot.weave.nodes.length >= snapshot.weave.maxNodes &&
                              selectedNodeIds.length !== 1
                            }
                          >
                            {snapshot.weave.nodes.length >= snapshot.weave.maxNodes
                              ? selectedForgeNode
                                ? `预览替换 ${selectedForgeNode.name}`
                                : "先选替换格"
                              : "预览炼化 · 免费"}
                          </button>
                        </article>
                      ) : (
                        <p className="forge-empty">当前没有已伏的天变化身。</p>
                      )}
                      <button
                        className="dismantle-button"
                        onClick={previewDismantle}
                        disabled={
                          selectedNodeIds.length !== 1 ||
                          snapshot.weave.nodes.length <= 1
                        }
                      >
                        {selectedForgeNode
                          ? `预览拆下 ${selectedForgeNode.name} · 1 火`
                          : "点一格后预览拆器"}
                      </button>
                    </div>
                    <div className="forge-context-guide" aria-label="天时炼化说明">
                      <article>
                        <span>何时生效</span>
                        <strong>游标经过即触发</strong>
                        <p>天时是一格真正的器盘节点，会参与顺序，也会改变盘首与收尾。</p>
                      </article>
                      <article>
                        <span>本次花费</span>
                        <strong>{activeCelestial ? "炼化不耗炉火" : "暂无可炼天时"}</strong>
                        <p>击败天变化身后的炼化独立于两分钟开炉，不占本轮操作次数。</p>
                      </article>
                      <article>
                        <span>当前收势</span>
                        <strong>{currentTerminalName}</strong>
                        <p>
                          {snapshot.weave.nodes.length >= snapshot.weave.maxNodes
                            ? selectedForgeNode
                              ? `确认后将以天时替换「${selectedForgeNode.name}」。`
                              : "器盘已满，先在右侧明确选择要换下的一格。"
                            : "器盘尚有空位，天时将按当前插入缝隙加入。"}
                        </p>
                      </article>
                    </div>
                    </div>
                  </section>
                </div>
                </div>

                <aside className="forge-preview-rail">
                  <div className="preview-ring-label">
                    <strong>{forgePreview ? "落锤后器盘" : "当前器盘"}</strong>
                    <small>
                      {forgePreview
                        ? "确认前不会改动本局器盘"
                        : "可拖动调位；点击用于合器、拆器或替换"}
                    </small>
                  </div>
                  <div className="forge-ring-stage">
                    <div
                      className={`weave-ring-large weave-ring-preview ${ringMove?.dragging ? "is-moving" : ""}`}
                      aria-label="器盘，节点按顺时针排列"
                      data-node-count={previewWeave?.nodes.length ?? 0}
                      style={weaveNodeSizeStyle(previewWeave?.nodes.length ?? 1)}
                    >
                      <div className="weave-ring-track">
                    <svg
                      className="weave-ring-path"
                      aria-hidden="true"
                      viewBox="0 0 100 70"
                      preserveAspectRatio="none"
                    >
                      <ellipse cx="50" cy="35" rx="41" ry="25.2" />
                      <path d="M 78 16 C 85 19, 90 24, 91 29" />
                      <path d="M 91 29 L 88 26 M 91 29 L 88 31" />
                    </svg>
                    {(previewWeave?.nodes ?? []).map((node, index) => (
                      <button
                        key={node.instanceId}
                        ref={(element) => {
                          if (element) {
                            ringNodeRefs.current.set(node.instanceId, element);
                          } else {
                            ringNodeRefs.current.delete(node.instanceId);
                          }
                        }}
                        className={`weave-node ${node.kind} ${!forgePreview && selectedNodeIds.includes(node.instanceId) ? "selected" : ""} ${index === previewWeave?.pulse.nodeIndex ? "pulse" : ""} ${ringMove?.sourceId === node.instanceId ? "move-source" : ""} ${ringMove?.dragging && ringMove.targetId === node.instanceId ? "move-target" : ""}`}
                        onClick={() => {
                          if (suppressRingClickRef.current) {
                            suppressRingClickRef.current = false;
                            return;
                          }
                          if (!forgePreview) onNodeSelect(node.instanceId);
                        }}
                        onPointerDown={(event) =>
                          beginRingPointerMove(event, node.instanceId)
                        }
                        onPointerMove={moveRingPointer}
                        onPointerUp={finishRingPointerMove}
                        onPointerCancel={cancelRingPointerMove}
                        onKeyDown={(event) =>
                          handleRingKeyDown(event, node.instanceId)
                        }
                        onFocus={() => setRingFocusId(node.instanceId)}
                        disabled={Boolean(forgePreview)}
                        aria-pressed={
                          !forgePreview &&
                          selectedNodeIds.includes(node.instanceId)
                        }
                        aria-label={`第 ${index + 1} 格，${node.name}，${weaveNodeKindLabel(node)}`}
                        aria-keyshortcuts="Space ArrowLeft ArrowRight Enter Escape"
                        tabIndex={
                          (ringFocusId
                            ? ringFocusId === node.instanceId
                            : index === 0)
                            ? 0
                            : -1
                        }
                        title={`${index + 1}. ${node.name} · ${weaveNodeKindLabel(node)}`}
                        style={weaveNodePosition(
                          index,
                          previewWeave?.nodes.length ?? 1,
                        )}
                      >
                        <b>{index + 1}</b>
                        <span
                          className={`weave-node-art ${node.kind === "celestial" ? "celestial-node-art" : ""}`}
                          aria-hidden="true"
                          style={weaveNodeThumbStyle(node)}
                        />
                        <span className="weave-node-copy">
                          <strong>{weaveNodeDisplayName(node)}</strong>
                          <small>{weaveNodeKindLabel(node)}</small>
                        </span>
                      </button>
                    ))}
                        <div className="weave-core">
                          <span>器盘游标</span>
                          <strong>{Math.round((previewWeave?.pulse.nodeProgress ?? 0) * 100)}%</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="ring-operation-status" aria-live="polite">
                    {ringMove?.input === "keyboard"
                      ? `已拿起「${snapshot.weave.nodes.find((node) => node.instanceId === ringMove.sourceId)?.name ?? "节点"}」，目标为「${snapshot.weave.nodes.find((node) => node.instanceId === ringMove.targetId)?.name ?? "节点"}」。`
                      : ringMove?.dragging
                        ? `拖到「${snapshot.weave.nodes.find((node) => node.instanceId === ringMove.targetId)?.name ?? "另一格"}」后松手预览。`
                        : "拖到另一格可预览调位；单击可选择两格。"}
                  </p>

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
                      </>
                    ) : (
                      <>
                        <strong>先选一张合法操作</strong>
                        <p>配方、添器、做细、调位和天时都会先显示变化前后；确认时才扣炉火。</p>
                      </>
                    )}
                  </div>
                </aside>
              </div>
              <footer className="forge-footer">
                <div className={`forge-footer-preview ${forgePreview ? "ready" : ""}`} aria-live="polite">
                  <span>{forgePreview ? "改动已排好" : "尚未选择改动"}</span>
                  <strong>{forgePreview?.title ?? "从操作页选择一项做法"}</strong>
                  <small>
                    {forgePreview
                      ? forgePreview.cost === 0
                        ? "本次不耗炉火；落锤后生效。"
                        : `需要 ${forgePreview.cost} 火；落锤后生效。`
                      : "添器与做细会随选择自动排好；其余做法在落锤前核对一次。"}
                  </small>
                </div>
                <div className="forge-footer-actions">
                  <button
                    className="preview-cancel"
                    onClick={cancelForgePreview}
                    disabled={!forgePreview || forgeConfirming}
                  >
                    舍下改动
                  </button>
                  <button
                    className="primary-button compact forge-confirm"
                    onClick={confirmForgePreview}
                    disabled={
                      forgeConfirming ||
                      !forgePreview ||
                      forgeFire < forgePreview.cost
                    }
                  >
                    {forgeConfirming
                      ? "正在落锤"
                      : !forgePreview
                      ? "等待选择"
                      : forgeFire < forgePreview.cost
                        ? "炉火不足"
                        : forgePreview.cost === 0
                          ? "确认炼成"
                          : forgePreview.kind === "insert"
                            ? `添入器盘 · ${forgePreview.cost} 火`
                            : forgePreview.kind === "temper"
                              ? `做细 · ${forgePreview.cost} 火`
                              : "确认落锤"}
                  </button>
                  <button
                    className="secondary-button forge-close"
                    data-gamepad-cancel
                    onClick={closeForge}
                    disabled={forgeConfirming}
                  >
                    {forgePurpose === "celestial"
                      ? "处置天时后续战"
                      : "定盘续战 · 余火保留"}
                  </button>
                </div>
              </footer>
              {forgeExitBlocker && (
                <div
                  className="forge-blocker-shade"
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="forge-blocker-title"
                  aria-describedby="forge-blocker-description"
                >
                  <section className="forge-blocker-card">
                    <span className="forge-blocker-seal" aria-hidden="true">待</span>
                    <div>
                      <p className="kicker">续战前还差一步</p>
                      <h3 id="forge-blocker-title">{forgeExitBlocker.title}</h3>
                      <p id="forge-blocker-description">
                        {forgeExitBlocker.description}
                      </p>
                    </div>
                    {forgeExitBlocker.actions.length > 0 ? (
                      <div className="forge-blocker-actions">
                        {forgeExitBlocker.actions.map((action) => (
                          <button
                            key={action.id}
                            className="forge-blocker-choice"
                            onClick={() => handleForgeExitAction(action.id)}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="forge-blocker-progress" aria-live="polite">
                        正在写入器盘……
                      </div>
                    )}
                    <button
                      className="forge-blocker-guide"
                      onClick={() => openGuide(
                        forgeExitBlocker.state === "celestialRewardPending"
                          ? "celestials"
                          : forgeExitBlocker.state === "needsPerk" || forgeExitBlocker.state === "needsPairReplacement"
                            ? "perk-book"
                            : "endless",
                      )}
                    >
                      查看这条规则
                    </button>
                  </section>
                </div>
              )}
            </section>
          </div>
        )}

        {mode === "paused" && (
          <div
            className="overlay modal-shade"
            onPointerDownCapture={(event) => {
              if (!(event.target as Element).closest("[data-test-unlock]")) {
                resetTestUnlockSequence();
              }
            }}
          >
            <section className="pause-panel">
              <p
                className="kicker pause-secret-trigger"
                data-test-unlock
                onPointerDown={beginTestUnlockTap}
                onPointerMove={moveTestUnlockTap}
                onPointerCancel={cancelTestUnlockTap}
                onClick={completeTestUnlockTap}
              >
                卷轴暂歇
              </p>
              <h2>行旅未完</h2>
              <p>纸偶在卷边稍息，续行时从人形起步。</p>
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
              {testPanelUnlocked ? (
                <section className="test-panel" aria-label="测试工具">
                  <div className="test-panel-heading">
                    <strong>百工试作</strong>
                    <small>仅影响本局；使用后不记录通关</small>
                  </div>
                  <div className="test-modifier-row">
                    <label>
                      <span>时间</span>
                      <select
                        value={testPanelState.timeScale}
                        onChange={(event) =>
                          updateTestModifiers({
                            timeScale: Number(
                              event.target.value,
                            ) as TestPanelState["timeScale"],
                          })
                        }
                      >
                        {[1, 2, 4, 8].map((scale) => (
                          <option key={scale} value={scale}>
                            {scale} 倍
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className={`test-toggle ${
                        testPanelState.incomingDamageScale === 0 ? "active" : ""
                      }`}
                      aria-pressed={testPanelState.incomingDamageScale === 0}
                      onClick={() =>
                        updateTestModifiers({
                          incomingDamageScale:
                            testPanelState.incomingDamageScale === 0 ? 1 : 0,
                        })
                      }
                    >
                      纸命无损
                    </button>
                  </div>
                  <div className="test-action-row">
                    <button
                      className="test-experience-button"
                      onPointerDown={startTestExperienceHold}
                      onPointerUp={finishTestExperienceHold}
                      onPointerCancel={finishTestExperienceHold}
                      onLostPointerCapture={finishTestExperienceHold}
                      onClick={(event) => {
                        if (event.detail === 0) addTestExperience(100);
                      }}
                    >
                      经验 +100
                    </button>
                    <button onClick={fillTestForgeFire}>炉火置 3</button>
                    <button
                      onClick={weakenCurrentBoss}
                      disabled={snapshot.currentBoss === null}
                    >
                      当前 Boss 余 1 血
                    </button>
                    <button onClick={resetTestMultipliers}>恢复倍率</button>
                  </div>
                  <div className="test-action-row" aria-label="跳转无尽时间">
                    {[15, 35, 45, 80].map((minutes) => (
                      <button
                        key={minutes}
                        onClick={() =>
                          jumpToEndlessMinute(minutes as 15 | 35 | 45 | 80)
                        }
                      >
                        无尽 {minutes} 分
                      </button>
                    ))}
                  </div>
                  <div className="test-action-row" aria-label="召唤指定随机Boss">
                    {ENDLESS_BOSS_IDS.map((bossId) => (
                      <button key={bossId} onClick={() => summonTestBoss(bossId)}>
                        召 · {ENDLESS_BOSSES[bossId].name}
                      </button>
                    ))}
                  </div>
                  <output className="test-code-hint" aria-live="polite">
                    {directorPanelState ? (
                      <>
                        导演：无尽 {directorPanelState.minutes.toFixed(1)} 分 · 高级怪概率{" "}
                        {Math.round(directorPanelState.sample.specialProbability * 100)}% ·
                        威胁 {directorPanelState.sample.nonBossThreatPerSecond.toFixed(1)}/秒 ·
                        Boss预算 {directorPanelState.sample.bossBudgetPerMinute.toFixed(2)}/分 ·
                        同屏上限 {directorPanelState.sample.bossConcurrency} ·
                        敌人 {directorPanelState.enemyCount}/150 ·
                        阶段增幅 {directorPanelState.sample.post45Step}/11
                      </>
                    ) : (
                      "导演：尚未进入无尽；跳转或召唤会安全开启无尽并标记测试局。"
                    )}
                  </output>
                  <output className="test-experience-status" aria-live="polite">
                    当前经验 {snapshot.xp}／{snapshot.nextXp} · 本次已加 +{testExperienceAdded}
                  </output>
                </section>
              ) : null}
              <div className="button-row centered">
                <button
                  className="primary-button"
                  data-gamepad-cancel
                  onClick={resumePausedRun}
                >
                  继续行旅
                </button>
                <button className="secondary-button" onClick={() => updateAudio({ muted: !audioSettings.muted })}>
                  {audioSettings.muted ? "取消静音" : "静音"}
                </button>
                <button className="secondary-button" onClick={() => openGuide("start")}>
                  百工手册
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
                  <span className="choice-note">
                    {testPanelState.assisted
                      ? "测试局不记录通关与解锁"
                      : "完成标准局并解锁试炼签"}
                  </span>
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
              <div className={`stats ${(snapshot.surplusPages ?? 0) > 0 ? "has-surplus" : ""}`}>
                <div><strong>{formatTime(snapshot.elapsed)}</strong><span>行旅时间</span></div>
                <div><strong>{snapshot.kills}</strong><span>降服</span></div>
                <div><strong>{snapshot.score}</strong><span>卷分</span></div>
                {(snapshot.surplusPages ?? 0) > 0 && (
                  <div>
                    <strong>{snapshot.surplusPages}</strong>
                    <span>余页</span>
                  </div>
                )}
              </div>
              <div className="button-row centered">
                <button className="primary-button" onClick={startGame}>再展一卷</button>
                <button className="secondary-button" data-gamepad-cancel onClick={returnToMenu}>返回卷首</button>
              </div>
            </section>
          </div>
        )}
        {guideSection && (
          <Suspense fallback={<div className="guide-loading">手册展卷中……</div>}>
            <GuideOverlay section={guideSection} onExit={closeGuide} />
          </Suspense>
        )}
      </section>
      <aside className="rotate-hint">请将手机横置，给四时绘卷留出完整战场。</aside>
    </main>
  );
}
