import type { BossTier, EnemyArchetype } from "./art";
import {
  chooseActiveSynergies as resolveChosenSynergies,
  getSynergyChoices as getEligibleSynergies,
  getWeaponDefinition,
  getWeaponRoute,
  type CombatEventKind,
  type CombatBuild,
  type EndlessPerkAction,
  type EffectSpec,
  type EffectTag,
  type EffectTrigger,
  type UpgradeOption,
  type WeaponId,
  type WeaponState,
  type WeaveNode,
  type WeaveState,
  type WeaveTerminal,
  WEAPON_IDS,
} from "./content";
import {
  applyUpgradeOption,
  beginCelestialIntrusion,
  captureDefeatedIntrusion,
  chooseCelestialIntrusion,
  consumeEndlessPerkEvent,
  createCombatBuild,
  createEndlessPerkState,
  createRngState,
  createWeaveState,
  damageCelestialIntrusion,
  deriveWeaveTerminal,
  fuseAdjacentNodes,
  generateUpgradeOptions,
  insertWeaponNode,
  nextRandom,
  resolveWeaponEffects,
  resolveWeaponKit,
  stepEndlessPerkState,
  stepCelestialIntrusion,
  swapWeaveNodes,
  type EndlessPerkProc,
  type EndlessPerkRuntimeEvent,
  type RngState,
  type EndlessPerkState,
} from "./runtime";
import {
  createPlayerForm,
  forceHumanForm,
  stepPlayerForm,
  type PlayerFormModel,
} from "./form";
import { getSolarTermState } from "./world";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const STANDARD_SECONDS = 480;

export type TrialId = "swift" | "crowd" | "elite";
export type SynergyChoiceOption = {
  id: string;
  name: string;
  description: string;
  weapons: readonly WeaponId[];
};

export type RunEvent =
  | { type: "upgrade" }
  | { type: "midBoss" }
  | { type: "finalBoss" }
  | { type: "defeat" }
  | { type: "forge" }
  | { type: "celestialReady" }
  | { type: "term"; name: string; ambience: string }
  | { type: "fold"; folded: boolean }
  | { type: "synergy"; name: string }
  | {
      type: "synergyChoice";
      choices: readonly SynergyChoiceOption[];
      capacity: number;
      selectedIds: readonly string[];
    }
  | { type: "terminal"; name: string }
  | { type: "bossSpawn"; tier: Exclude<BossTier, null> }
  | { type: "pickup" }
  | { type: "playerHit" };

export type Player = PlayerFormModel & {
  x: number;
  y: number;
  facing: number;
  life: number;
  maxLife: number;
  xp: number;
  nextXp: number;
  level: number;
  invulnerability: number;
  speedMultiplier: number;
  powerMultiplier: number;
  magnetMultiplier: number;
};

export type EnemyMotion = "moving" | "attacking" | "hurt" | "dead";

export type EnemyActionPhase =
  | "telegraph"
  | "travel"
  | "land"
  | "recovery";

export type EnemyActionState = {
  kind: "nianLeap";
  phase: EnemyActionPhase;
  elapsed: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  warningFxId?: number;
};

export type Enemy = {
  id: number;
  type: EnemyArchetype;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  travelled: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  turnSpeed: number;
  damage: number;
  elite: boolean;
  boss: boolean;
  bossTier: BossTier;
  hitFlash: number;
  marked: number;
  markMultiplier: number;
  markStacks: number;
  slow: number;
  motion: EnemyMotion;
  motionTime: number;
  attackCooldown: number;
  attackCommitted: boolean;
  skillIndex: number;
  intrusionAvatar: boolean;
  action?: EnemyActionState;
  lastHitOwner?: ProjectileOwner;
};

export type ProjectileOwner =
  | WeaponId
  | `synergy:${string}`
  | `weave:${string}`
  | `fusion:${string}`
  | "terminal";

export type Projectile = {
  id: number;
  owner: ProjectileOwner;
  artKey: string;
  tags: readonly EffectTag[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  pierce: number;
  homing: number;
  targetId?: number;
  markSeconds: number;
  hitCooldown: number;
  hitAt: Map<number, number>;
  canProc?: boolean;
  spawnDelay?: number;
  windTouched?: boolean;
  weatherTouched?: boolean;
};

export type Pickup = {
  id: number;
  x: number;
  y: number;
  value: number;
  age: number;
  tier: 1 | 2 | 3;
  kind?: "experience" | "healingLeaf";
  mergeMultiplier?: number;
  magnetRadius?: number;
};

export type Zone = {
  id: number;
  owner: ProjectileOwner;
  artKey: string;
  x: number;
  y: number;
  radius: number;
  damagePerSecond: number;
  life: number;
  maxLife: number;
  tick: number;
  tickRate: number;
  followsPlayer: boolean;
  slow: number;
  canProc?: boolean;
  enteredEnemyIds: Set<number>;
};

export type Summon = {
  id: number;
  owner: ProjectileOwner;
  artKey: string;
  angle: number;
  radius: number;
  life: number;
  attackDamage: number;
  attackCooldown: number;
  cooldown: number;
  index: number;
  total: number;
  moveSpeed: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetId?: number;
  formationSlot: number;
  retargetClock: number;
  canProc?: boolean;
};

export type PendingStrike = {
  id: number;
  owner: ProjectileOwner;
  artKey: string;
  x: number;
  y: number;
  radius: number;
  damage: number;
  delay: number;
  maxDelay: number;
  hostile: boolean;
  canProc?: boolean;
};

export type VisualFxKind =
  | "hit"
  | "beam"
  | "wave"
  | "chain"
  | "burst"
  | "ring"
  | "terminal"
  | "warning"
  | "ink";

export type VisualFx = {
  id: number;
  kind: VisualFxKind;
  owner?: ProjectileOwner;
  artKey: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  label?: string;
};

export type DeathActor = {
  enemy: Enemy;
  life: number;
};

export type PendingPerkReplay = {
  delay: number;
  effects: readonly EffectSpec[];
  damageScale: number;
};

export type EndlessPerkCombatState = {
  temporaryGuardCharges: number;
  temporaryGuardUntil: number;
  lanternGuardCharges: number;
  lanternFireCharges: number;
  signatureCharges: number;
  signatureMultiplier: number;
  planeSeconds: number;
  planeTriggered: boolean;
  idleSeconds: number;
  idleHealClock: number;
  weaveCycleInitialized: boolean;
  weaveCycleStartIndex: number;
  weaveDirection: 1 | -1;
  weaveCounterIndex: number;
  weaveCounterScale: number;
  weaveCycleScale: number;
  weaveFinishScale: number;
  weaveRepeatFirst: number;
  weaveFirstPassed: boolean;
  weaveNextNodeScale: number;
  pendingFinishReplays: PendingPerkReplay[];
};

export type RunState = {
  elapsed: number;
  endless: boolean;
  score: number;
  kills: number;
  player: Player;
  build: CombatBuild;
  enemies: Enemy[];
  deaths: DeathActor[];
  projectiles: Projectile[];
  pickups: Pickup[];
  zones: Zone[];
  summons: Summon[];
  strikes: PendingStrike[];
  fx: VisualFx[];
  trials: Set<TrialId>;
  cooldowns: Map<string, number>;
  orbitHits: Map<string, number>;
  accumulators: Map<string, number>;
  synergyCounters: Map<string, number>;
  rng: RngState;
  serial: number;
  spawnClock: number;
  midBossSpawned: boolean;
  finalBossSpawned: boolean;
  currentBoss: BossTier;
  activeSynergyIds: string[];
  pendingSynergyChoiceIds: string[];
  synergyChoiceSignature: string;
  pendingRareChoice: boolean;
  weave?: WeaveState;
  forgeAt: number;
  forgeCredits: number;
  endlessBossAt: number;
  endlessBossCount: number;
  intrusionAt: number;
  intrusionAvatarId?: number;
  celestialHazardClock: number;
  lastTermIndex: number;
  lastFormState: PlayerFormModel["formState"];
  terminalLabel: string;
  terminalLabelLife: number;
  endlessPerks: EndlessPerkState;
  perkCombat: EndlessPerkCombatState;
  testModifiers: TestModifiers;
};

export type TestModifiers = {
  timeScale: 1 | 2 | 4 | 8;
  incomingDamageScale: 0 | 1;
  assisted: boolean;
};

export type CreateRunOptions = {
  initialWeaponId?: WeaponId | "random";
  unlockedWeaponIds?: readonly WeaponId[];
};

export type RunSnapshot = {
  elapsed: number;
  endless: boolean;
  score: number;
  kills: number;
  life: number;
  maxLife: number;
  xp: number;
  nextXp: number;
  level: number;
  weapons: readonly WeaponState[];
  synergies: readonly string[];
  currentBoss: BossTier;
  weave?: WeaveState;
  endlessPerks?: EndlessPerkState;
  terminalLabel: string;
  terminalLabelLife: number;
};

export type MoveInput = {
  x: number;
  y: number;
};

const enemyStats: Record<EnemyArchetype, {
  radius: number;
  hp: number;
  speed: number;
  turn: number;
  damage: number;
}> = {
  cup: { radius: 19, hp: 1, speed: 50, turn: 6.4, damage: 1 },
  shoe: { radius: 17, hp: 0.78, speed: 82, turn: 7.4, damage: 1 },
  lantern: { radius: 21, hp: 1.42, speed: 47, turn: 4.9, damage: 1 },
  fish: { radius: 17, hp: 0.72, speed: 71, turn: 3.8, damage: 1 },
  abacus: { radius: 23, hp: 1.85, speed: 39, turn: 4.8, damage: 1 },
  rib: { radius: 21, hp: 1.56, speed: 55, turn: 5.7, damage: 1 },
  lion: { radius: 42, hp: 15, speed: 48, turn: 3.2, damage: 1 },
  puppet: { radius: 37, hp: 12, speed: 58, turn: 4.6, damage: 1 },
  taotie: { radius: 66, hp: 48, speed: 38, turn: 2.4, damage: 1 },
  nian: { radius: 78, hp: 94, speed: 36, turn: 2.8, damage: 1 },
};

const weaponColor: Record<WeaponId, string> = {
  sword: "#456d62",
  fan: "#527f88",
  umbrella: "#a84b3d",
  scissors: "#a8793f",
  abacus: "#725249",
  crossbow: "#4f694e",
  pipa: "#8270a0",
  inkline: "#374b48",
  lantern: "#c06739",
  thunderSeal: "#5571a0",
};

const minimumWeaponCadence: Readonly<Record<WeaponId, number>> = {
  sword: 0.68,
  fan: 0.76,
  umbrella: 0.78,
  scissors: 0.68,
  abacus: 0.3,
  crossbow: 0.62,
  pipa: 0.82,
  inkline: 0.86,
  lantern: 0.86,
  thunderSeal: 1.05,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function length(x: number, y: number) {
  return Math.hypot(x, y);
}

function distanceSquared(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function normalized(x: number, y: number) {
  const magnitude = Math.hypot(x, y) || 1;
  return { x: x / magnitude, y: y / magnitude };
}

function normalizeAngle(angle: number) {
  let result = angle;
  while (result <= -Math.PI) result += Math.PI * 2;
  while (result > Math.PI) result -= Math.PI * 2;
  return result;
}

function random(run: RunState) {
  const result = nextRandom(run.rng);
  run.rng = result.state;
  return result.value;
}

function randomRange(run: RunState, min: number, max: number) {
  return min + random(run) * (max - min);
}

function nextId(run: RunState) {
  const value = run.serial;
  run.serial += 1;
  return value;
}

function createEndlessPerkCombatState(): EndlessPerkCombatState {
  return {
    temporaryGuardCharges: 0,
    temporaryGuardUntil: 0,
    lanternGuardCharges: 0,
    lanternFireCharges: 0,
    signatureCharges: 0,
    signatureMultiplier: 1,
    planeSeconds: 0,
    planeTriggered: false,
    idleSeconds: 0,
    idleHealClock: 0,
    weaveCycleInitialized: false,
    weaveCycleStartIndex: 0,
    weaveDirection: 1,
    weaveCounterIndex: 0,
    weaveCounterScale: 0,
    weaveCycleScale: 1,
    weaveFinishScale: 1,
    weaveRepeatFirst: 0,
    weaveFirstPassed: false,
    weaveNextNodeScale: 1,
    pendingFinishReplays: [],
  };
}

export function createRun(
  trials: Set<TrialId>,
  seed = Date.now(),
  options: CreateRunOptions = {},
): RunState {
  let rng = createRngState(seed);
  const availableWeapons = (options.unlockedWeaponIds ?? WEAPON_IDS).filter(
    (weaponId): weaponId is WeaponId => WEAPON_IDS.includes(weaponId),
  );
  const requestedWeapon = options.initialWeaponId ?? "sword";
  let initialWeaponId: WeaponId =
    requestedWeapon === "random" ? "sword" : requestedWeapon;
  if (requestedWeapon === "random" && availableWeapons.length > 0) {
    const roll = nextRandom(rng);
    rng = roll.state;
    initialWeaponId =
      availableWeapons[
        Math.min(
          availableWeapons.length - 1,
          Math.floor(roll.value * availableWeapons.length),
        )
      ];
  } else if (!availableWeapons.includes(initialWeaponId)) {
    initialWeaponId = availableWeapons[0] ?? "sword";
  }
  return {
    elapsed: 0,
    endless: false,
    score: 0,
    kills: 0,
    player: {
      ...createPlayerForm(),
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      facing: -Math.PI / 2,
      life: 5,
      maxLife: 5,
      xp: 0,
      nextXp: 7,
      level: 1,
      invulnerability: 0,
      speedMultiplier: 1,
      powerMultiplier: 1,
      magnetMultiplier: 1,
    },
    build: createCombatBuild(initialWeaponId),
    enemies: [],
    deaths: [],
    projectiles: [],
    pickups: [],
    zones: [],
    summons: [],
    strikes: [],
    fx: [],
    trials: new Set(trials),
    cooldowns: new Map(),
    orbitHits: new Map(),
    accumulators: new Map(),
    synergyCounters: new Map(),
    rng,
    serial: 1,
    spawnClock: 0.25,
    midBossSpawned: false,
    finalBossSpawned: false,
    currentBoss: null,
    activeSynergyIds: [],
    pendingSynergyChoiceIds: [],
    synergyChoiceSignature: "",
    pendingRareChoice: false,
    forgeAt: STANDARD_SECONDS + 120,
    forgeCredits: 0,
    endlessBossAt: STANDARD_SECONDS + 240,
    endlessBossCount: 0,
    intrusionAt: STANDARD_SECONDS + 70,
    celestialHazardClock: 0,
    lastTermIndex: 0,
    lastFormState: "human",
    terminalLabel: "",
    terminalLabelLife: 0,
    endlessPerks: createEndlessPerkState(),
    perkCombat: createEndlessPerkCombatState(),
    testModifiers: {
      timeScale: 1,
      incomingDamageScale: 1,
      assisted: false,
    },
  };
}

function synergyChoiceOption(
  synergy: ReturnType<typeof getEligibleSynergies>[number],
): SynergyChoiceOption {
  return {
    id: synergy.definition.id,
    name: synergy.name,
    description: synergy.description,
    weapons: synergy.definition.weapons,
  };
}

function synergyQualificationSignature(run: RunState) {
  const eligibleIds = getEligibleSynergies(run.build.weapons).map(
    (synergy) => synergy.definition.id,
  );
  return `${Math.max(0, Math.floor(run.build.synergyCapacity))}:${eligibleIds.join(",")}`;
}

export function getSynergyChoices(run: RunState): readonly SynergyChoiceOption[] {
  return getEligibleSynergies(run.build.weapons).map(synergyChoiceOption);
}

/**
 * Applies a player's explicit overflow selection. Automatic activation remains
 * authoritative while every qualified pairing fits within capacity.
 */
export function chooseActiveSynergies(
  run: RunState,
  selectedIds: readonly string[],
): boolean {
  const eligible = getEligibleSynergies(run.build.weapons);
  const capacity = Math.max(0, Math.floor(run.build.synergyCapacity));
  if (eligible.length <= capacity) {
    run.activeSynergyIds = eligible.map((synergy) => synergy.definition.id);
    run.pendingSynergyChoiceIds = [];
    run.synergyChoiceSignature = synergyQualificationSignature(run);
    return true;
  }

  const unique = [...new Set(selectedIds)];
  const eligibleIds = new Set(
    eligible.map((synergy) => synergy.definition.id),
  );
  if (
    unique.length !== capacity ||
    unique.some((id) => !eligibleIds.has(id))
  ) {
    return false;
  }

  const previousIds = new Set(run.activeSynergyIds);
  run.activeSynergyIds = unique;
  run.pendingSynergyChoiceIds = [];
  run.synergyChoiceSignature = synergyQualificationSignature(run);
  for (const key of run.synergyCounters.keys()) {
    if (!key.startsWith("synergy:")) continue;
    const synergyId = key.split(":")[1];
    if (!unique.includes(synergyId) || !previousIds.has(synergyId)) {
      run.synergyCounters.delete(key);
    }
  }
  return true;
}

export function snapshotRun(run: RunState): RunSnapshot {
  const synergies = resolveChosenSynergies(
    run.build.weapons,
    run.activeSynergyIds,
    run.build.synergyCapacity,
  );
  return {
    elapsed: run.elapsed,
    endless: run.endless,
    score: run.score,
    kills: run.kills,
    life: run.player.life,
    maxLife: run.player.maxLife,
    xp: run.player.xp,
    nextXp: run.player.nextXp,
    level: run.player.level,
    weapons: run.build.weapons.map((weapon) => ({ ...weapon })),
    synergies: synergies.map((synergy) => synergy.name),
    currentBoss: run.currentBoss,
    weave: run.weave,
    endlessPerks: run.endlessPerks,
    terminalLabel: run.terminalLabel,
    terminalLabelLife: run.terminalLabelLife,
  };
}

export function getUpgradeChoices(run: RunState): readonly UpgradeOption[] {
  const generated = generateUpgradeOptions(run.build, run.rng, {
    maxWeapons: 4,
    optionCount: 3,
  });
  run.rng = generated.rngState;
  return generated.options;
}

export type RareChoice = {
  id: "master-now" | "resonance-slot" | "weapon-soul";
  name: string;
  description: string;
};

export const RARE_CHOICES: readonly RareChoice[] = [
  {
    id: "master-now",
    name: "先做定型",
    description: "将当前最高阶但尚未定型的本命武器直接推进一阶。",
  },
  {
    id: "resonance-slot",
    name: "多留一手",
    description: "搭手容量增加一格，并立即启用所有已满足条件的搭手。",
  },
  {
    id: "weapon-soul",
    name: "记住手法",
    description: "每件本命武器累计命中十八次，便用这门手艺追击强敌并弹射三次。",
  },
] as const;

export function applyUpgrade(run: RunState, option: UpgradeOption): string | undefined {
  const before = new Set(
    resolveChosenSynergies(
      run.build.weapons,
      run.activeSynergyIds,
      run.build.synergyCapacity,
    ).map((item) => item.definition.id),
  );
  run.build = applyUpgradeOption(run.build, option);
  if (option.kind === "utility") {
    if (option.modifierId === "keenEdge") run.player.powerMultiplier *= 1.08;
    if (option.modifierId === "gatheringWind") run.player.magnetMultiplier *= 1.18;
    if (option.modifierId === "paperWard") {
      run.player.maxLife = Math.min(7, run.player.maxLife + 1);
      run.player.life = Math.min(run.player.maxLife, run.player.life + 1);
    }
  }
  const eligible = getEligibleSynergies(run.build.weapons);
  const newlyActive =
    eligible.length <= run.build.synergyCapacity
      ? eligible.find((item) => !before.has(item.definition.id))
      : undefined;
  return newlyActive?.name;
}

export function applyRareChoice(run: RunState, choice: RareChoice["id"]) {
  if (choice === "resonance-slot") {
    run.build = { ...run.build, synergyCapacity: Math.min(5, run.build.synergyCapacity + 1) };
  } else if (choice === "weapon-soul") {
    run.build = {
      ...run.build,
      modifiers: {
        ...run.build.modifiers,
        weaponSoul: (run.build.modifiers.weaponSoul ?? 0) + 1,
      },
    };
  } else {
    const candidate = [...run.build.weapons]
      .filter((weapon) => weapon.level < 5)
      .sort((a, b) => b.level - a.level)[0];
    if (!candidate) {
      run.build = {
        ...run.build,
        modifiers: {
          ...run.build.modifiers,
          weaponSoul: (run.build.modifiers.weaponSoul ?? 0) + 1,
        },
      };
      return;
    }
    if (candidate.level === 1) {
      run.build = applyUpgradeOption(run.build, {
        id: `rare-refine-${candidate.id}`,
        kind: "refine",
        weaponId: candidate.id,
        title: "先声精炼",
        description: "",
        artKey: getWeaponDefinition(candidate.id).artKeys.tier2,
      });
      return;
    }
    if (candidate.level === 2) {
      const routes = getWeaponDefinition(candidate.id).routes;
      const picked = Math.floor(random(run) * routes.length);
      const route = routes[picked];
      run.build = applyUpgradeOption(run.build, {
        id: `rare-route-${route.id}`,
        kind: "route",
        weaponId: candidate.id,
        routeId: route.id,
        title: route.name,
        description: route.description,
        artKey: route.artKeys.tier3,
      });
      return;
    }
    if (candidate.level === 3) {
      const route = candidate.routeId
        ? getWeaponRoute(candidate.routeId)
        : getWeaponDefinition(candidate.id).routes[0];
      run.build = applyUpgradeOption(run.build, {
        id: `rare-enhance-${route.id}`,
        kind: "routeEnhancement",
        weaponId: candidate.id,
        title: `${route.name}·再造`,
        description: "",
        artKey: route.artKeys.tier4,
      });
      return;
    }
    const route = candidate.routeId
      ? getWeaponRoute(candidate.routeId)
      : getWeaponDefinition(candidate.id).routes[0];
    const mastery = route.masteries[Math.floor(random(run) * route.masteries.length)];
    run.build = applyUpgradeOption(run.build, {
      id: `rare-mastery-${mastery.id}`,
      kind: "mastery",
      weaponId: candidate.id,
      routeId: route.id,
      masteryId: mastery.id,
      title: mastery.name,
      description: mastery.description,
      artKey: mastery.artKey,
    });
  }
}

function addFx(
  run: RunState,
  kind: VisualFxKind,
  x: number,
  y: number,
  radius: number,
  life: number,
  color: string,
  artKey: string,
  extra: Partial<VisualFx> = {},
) {
  const fx: VisualFx = {
    id: nextId(run),
    kind,
    artKey,
    x,
    y,
    radius,
    life,
    maxLife: life,
    color,
    ...extra,
  };
  run.fx.push(fx);
  return fx.id;
}

function pickNearest(
  run: RunState,
  x = run.player.x,
  y = run.player.y,
  ignored = new Set<number>(),
) {
  let best: Enemy | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of run.enemies) {
    if (enemy.hp <= 0 || ignored.has(enemy.id)) continue;
    const distance = distanceSquared(x, y, enemy.x, enemy.y);
    if (distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best;
}

function pickStrongest(run: RunState) {
  return run.enemies.reduce<Enemy | undefined>(
    (best, enemy) => enemy.hp > 0 && (!best || enemy.hp > best.hp) ? enemy : best,
    undefined,
  );
}

function ownerColor(owner: ProjectileOwner) {
  if (owner.startsWith("synergy:")) return "#c18b45";
  if (owner.startsWith("weave:") || owner === "terminal") return "#aa4339";
  return weaponColor[owner as WeaponId] ?? "#302d28";
}

function spawnProjectilePattern(
  run: RunState,
  effect: Extract<EffectSpec, { kind: "projectile" }>,
  owner: ProjectileOwner,
  damageScale = 1,
  canProc = true,
) {
  const target = pickNearest(run);
  if (!target) return;
  const baseAngle = Math.atan2(target.y - run.player.y, target.x - run.player.x);
  const count = Math.max(1, effect.count);
  const spread = ((effect.spreadDegrees ?? (effect.pattern === "radial" ? 360 : 18)) * Math.PI) / 180;
  for (let index = 0; index < count; index += 1) {
    let angle = baseAngle;
    if (effect.pattern === "radial") angle = (Math.PI * 2 * index) / count;
    else if (effect.pattern === "fan") {
      angle += count === 1 ? 0 : (index / (count - 1) - 0.5) * spread;
    } else if (effect.pattern === "burst") {
      // Burst is a temporal magazine, not another fan with a different label.
      const side = index === 0 ? 0 : (index % 2 === 0 ? 1 : -1);
      angle += side * Math.min(spread * 0.08, 0.045);
    }
    run.projectiles.push({
      id: nextId(run),
      owner,
      artKey: effect.visualKey ?? `projectile/${owner}`,
      tags: effect.tags,
      x: run.player.x,
      y: run.player.y,
      vx: Math.cos(angle) * effect.speed,
      vy: Math.sin(angle) * effect.speed,
      radius: effect.radius,
      damage: effect.damage * damageScale * run.player.powerMultiplier,
      life: effect.lifetime,
      pierce: effect.pierce,
      homing: effect.homing ?? 0,
      targetId: target.id,
      markSeconds: effect.markSeconds ?? 0,
      hitCooldown: effect.singleTargetHitCooldown ?? 0.16,
      hitAt: new Map(),
      canProc,
      spawnDelay: effect.pattern === "burst" ? index * 0.065 : 0,
    });
  }
}

function damageEnemy(
  run: RunState,
  enemy: Enemy,
  damage: number,
  owner: ProjectileOwner,
  canProc = true,
) {
  if (enemy.hp <= 0) return;
  const markMultiplier = enemy.marked > 0 ? enemy.markMultiplier : 1;
  enemy.hp -= damage * markMultiplier;
  enemy.lastHitOwner = owner;
  enemy.hitFlash = 0.1;
  // Boss actions own their motion timeline. A hit may flash the sprite, but it
  // must never rewind an attack or cancel the Nian's visible leap.
  if (!enemy.boss && enemy.motion !== "attacking") {
    enemy.motion = "hurt";
    enemy.motionTime = 0;
  }
  addFx(run, "hit", enemy.x, enemy.y, enemy.radius * 1.35, 0.22, ownerColor(owner), `hit/${owner}`, {
    owner,
  });
  if (canProc) applyOnHitEffects(run, owner, enemy);
  const sourceWeapon = directWeaponOwner(owner);
  if (canProc && sourceWeapon) {
    dispatchSynergyEvent(run, "weaponHit", sourceWeapon, enemy);
    if (sourceWeapon === "abacus") {
      dispatchEndlessPerkEvent(
        run,
        {
          type: "sameTargetPearlHit",
          weaponId: "abacus",
          targetId: enemy.id,
        },
        { target: enemy, firstTarget: enemy },
      );
    }
  }
}

function effectOwners(run: RunState) {
  const groups = new Map<ProjectileOwner, readonly EffectSpec[]>();
  const soulRank = run.build.modifiers.weaponSoul ?? 0;
  for (const weapon of run.build.weapons) {
    const effects = resolveWeaponEffects(weapon);
    if (soulRank <= 0) {
      groups.set(weapon.id, effects);
      continue;
    }
    groups.set(weapon.id, [
      ...effects,
      {
        id: `rare-weapon-soul:${weapon.id}`,
        kind: "accumulator",
        trigger: "onHit",
        tags: ["spirit", "mark"],
        counter: `weapon-soul:${weapon.id}`,
        required: Math.max(10, 18 - (soulRank - 1) * 3),
        resetOnProc: true,
        procEffects: [
          {
            id: `rare-weapon-soul-chain:${weapon.id}`,
            kind: "chain",
            trigger: "onHit",
            tags: ["spirit", "mark"],
            damage: 34 + soulRank * 8,
            jumps: 3,
            range: 235,
            falloff: 0.82,
            visualKey: "rare/weapon-soul",
          },
        ],
        visualKey: "rare/weapon-soul",
      },
    ]);
  }
  if (run.weave) {
    const held = new Set(run.build.weapons.map((weapon) => weapon.id));
    for (const node of run.weave.nodes) {
      const owner: ProjectileOwner = `weave:${node.instanceId}`;
      if (node.kind === "fusion") {
        groups.set(owner, node.passEffects);
      } else if (node.kind === "weapon" && !held.has(node.sourceId as WeaponId)) {
        groups.set(
          owner,
          resolveWeaponEffects(
            node.weaponState ?? {
              id: node.sourceId as WeaponId,
              level: 1,
            },
          ),
        );
      }
    }
  }
  return groups;
}

function fireChain(
  run: RunState,
  effect: Extract<EffectSpec, { kind: "chain" }>,
  owner: ProjectileOwner,
  start?: Enemy,
  damageScale = 1,
  canProc = true,
) {
  const hit = new Set<number>();
  let current = start ?? pickNearest(run);
  const firstTarget = current;
  let lastTarget = current;
  let damage = effect.damage * damageScale * run.player.powerMultiplier;
  let previousX = run.player.x;
  let previousY = run.player.y;
  for (let jump = 0; jump < effect.jumps && current; jump += 1) {
    lastTarget = current;
    hit.add(current.id);
    damageEnemy(run, current, damage, owner, canProc);
    addFx(run, "chain", previousX, previousY, 18, 0.28, ownerColor(owner), effect.visualKey ?? `chain/${owner}`, {
      owner,
      x2: current.x,
      y2: current.y,
    });
    previousX = current.x;
    previousY = current.y;
    damage *= effect.falloff;
    const candidates = run.enemies.filter((enemy) =>
      enemy.hp > 0 &&
      !hit.has(enemy.id) &&
      distanceSquared(previousX, previousY, enemy.x, enemy.y) <= effect.range ** 2
    );
    current = candidates.sort((a, b) => {
      if (effect.preferMarked) {
        const markOrder = Number(b.marked > 0) - Number(a.marked > 0);
        if (markOrder !== 0) return markOrder;
      }
      return (
        distanceSquared(previousX, previousY, a.x, a.y) -
        distanceSquared(previousX, previousY, b.x, b.y)
      );
    })[0];
  }
  const sourceWeapon = directWeaponOwner(owner);
  if (canProc && sourceWeapon === "pipa" && effect.tags.includes("music")) {
    dispatchEndlessPerkEvent(
      run,
      { type: "musicChainCompleted", weaponId: "pipa" },
      { firstTarget, lastTarget, target: lastTarget },
    );
  }
  if (
    canProc &&
    sourceWeapon === "thunderSeal" &&
    effect.tags.includes("lightning")
  ) {
    dispatchEndlessPerkEvent(
      run,
      { type: "lightningChainCompleted", weaponId: "thunderSeal" },
      { firstTarget, lastTarget, target: lastTarget },
    );
  }
}

function fireBeam(
  run: RunState,
  effect: Extract<EffectSpec, { kind: "beam" }>,
  owner: ProjectileOwner,
  damageScale = 1,
  canProc = true,
) {
  const target = pickNearest(run);
  if (!target) return;
  const baseAngle = Math.atan2(
    target.y - run.player.y,
    target.x - run.player.x,
  );
  const sweepRadians = ((effect.sweepDegrees ?? 0) * Math.PI) / 180;
  const rayCount = sweepRadians > 0.8 ? 5 : sweepRadians > 0 ? 3 : 1;
  const isPipaWave =
    directWeaponOwner(owner) === "pipa" && effect.tags.includes("music");
  const hitIds = new Set<number>();
  const candidates = [...run.enemies].sort((a, b) =>
    distanceSquared(run.player.x, run.player.y, a.x, a.y) -
    distanceSquared(run.player.x, run.player.y, b.x, b.y)
  );
  for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
    const sweepOffset =
      rayCount === 1
        ? 0
        : (rayIndex / (rayCount - 1) - 0.5) * sweepRadians;
    const angle = baseAngle + sweepOffset;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    let pierced = 0;
    for (const enemy of candidates) {
      if (hitIds.has(enemy.id)) continue;
      const relX = enemy.x - run.player.x;
      const relY = enemy.y - run.player.y;
      const along = relX * direction.x + relY * direction.y;
      const across = Math.abs(relX * direction.y - relY * direction.x);
      if (
        along >= 0 &&
        along <= effect.length &&
        across <= effect.width / 2 + enemy.radius
      ) {
        hitIds.add(enemy.id);
        damageEnemy(
          run,
          enemy,
          effect.damage * damageScale * run.player.powerMultiplier,
          owner,
          canProc,
        );
        pierced += 1;
        if (pierced > effect.pierce) break;
      }
    }
    if (!isPipaWave) {
      addFx(
        run,
        "beam",
        run.player.x,
        run.player.y,
        effect.width,
        Math.max(0.2, effect.duration),
        ownerColor(owner),
        effect.visualKey ?? `beam/${owner}`,
        {
          owner,
          x2: run.player.x + direction.x * effect.length,
          y2: run.player.y + direction.y * effect.length,
        },
      );
    }
  }
  if (isPipaWave) {
    addFx(
      run,
      "wave",
      run.player.x,
      run.player.y,
      Math.min(72, effect.width),
      Math.max(0.3, effect.duration),
      ownerColor(owner),
      `wave/${effect.visualKey ?? owner}`,
      {
        owner,
        x2: run.player.x + Math.cos(baseAngle) * effect.length,
        y2: run.player.y + Math.sin(baseAngle) * effect.length,
      },
    );
  }
  if (canProc && directWeaponOwner(owner) === "inkline") {
    dispatchEndlessPerkEvent(
      run,
      { type: "inkLinesCrossed", weaponId: "inkline" },
      { target },
    );
  }
}

function scheduleLightning(
  run: RunState,
  effect: Extract<EffectSpec, { kind: "lightning" }>,
  owner: ProjectileOwner,
  damageScale = 1,
  canProc = true,
) {
  const ignored = new Set<number>();
  let originX = run.player.x;
  let originY = run.player.y;
  for (let index = 0; index < effect.strikes; index += 1) {
    const chained =
      index > 0 && effect.chainRange
        ? pickNearest(run, originX, originY, ignored)
        : undefined;
    const target =
      chained &&
      distanceSquared(originX, originY, chained.x, chained.y) <=
        effect.chainRange! ** 2
        ? chained
        : index === 0
          ? pickNearest(run, run.player.x, run.player.y, ignored) ??
            pickStrongest(run)
          : effect.chainRange
            ? undefined
            : pickNearest(run, run.player.x, run.player.y, ignored);
    if (!target) break;
    ignored.add(target.id);
    originX = target.x;
    originY = target.y;
    run.strikes.push({
      id: nextId(run),
      owner,
      artKey: effect.visualKey ?? "fx/thunder/strike",
      x: target.x,
      y: target.y,
      radius: effect.radius,
      damage: effect.damage * damageScale * run.player.powerMultiplier,
      delay: effect.delay + index * 0.06,
      maxDelay: effect.delay + index * 0.06,
      hostile: false,
      canProc,
    });
  }
}

function spawnZone(
  run: RunState,
  effect: Extract<EffectSpec, { kind: "zone" }>,
  owner: ProjectileOwner,
  damageScale = 1,
  canProc = false,
) {
  const target = effect.followsOwner ? undefined : pickNearest(run);
  run.zones.push({
    id: nextId(run),
    owner,
    artKey: effect.visualKey ?? `zone/${owner}`,
    x: target?.x ?? run.player.x,
    y: target?.y ?? run.player.y,
    radius: effect.radius,
    damagePerSecond: effect.damagePerSecond * damageScale * run.player.powerMultiplier,
    life: effect.duration,
    maxLife: effect.duration,
    tick: 0,
    tickRate: effect.tickRate,
    followsPlayer: effect.followsOwner ?? false,
    slow: effect.slow ?? 0,
    canProc,
    enteredEnemyIds: new Set(),
  });
}

function spawnSummons(
  run: RunState,
  effect: Extract<EffectSpec, { kind: "summon" }>,
  owner: ProjectileOwner,
  damageScale = 1,
  canProc = true,
) {
  const same = run.summons.filter(
    (summon) =>
      summon.owner === owner && summon.artKey === effect.summonKey,
  );
  for (let index = 0; index < same.length; index += 1) {
    const summon = same[index];
    summon.life = Math.max(summon.life, effect.duration);
    summon.attackDamage =
      effect.attackDamage * damageScale * run.player.powerMultiplier;
    summon.attackCooldown = effect.attackCooldown;
    summon.moveSpeed = effect.moveSpeed;
    summon.canProc = canProc;
    summon.index = index;
    summon.formationSlot = index;
    summon.total = effect.count;
  }
  if (same.length >= effect.count) {
    return;
  }
  for (let index = same.length; index < effect.count; index += 1) {
    const angle = (Math.PI * 2 * index) / effect.count;
    const radius = 118 + index * 8;
    run.summons.push({
      id: nextId(run),
      owner,
      artKey: effect.summonKey,
      angle,
      radius,
      life: effect.duration,
      attackDamage: effect.attackDamage * damageScale * run.player.powerMultiplier,
      attackCooldown: effect.attackCooldown,
      cooldown: index * 0.12,
      index,
      total: effect.count,
      moveSpeed: effect.moveSpeed,
      x: run.player.x + Math.cos(angle) * radius,
      y: run.player.y + Math.sin(angle) * radius * 0.64,
      vx: 0,
      vy: 0,
      formationSlot: index,
      retargetClock: index * 0.08,
      canProc,
    });
  }
}

function directWeaponOwner(owner: ProjectileOwner): WeaponId | undefined {
  return WEAPON_IDS.includes(owner as WeaponId)
    ? (owner as WeaponId)
    : undefined;
}

export type EndlessPerkDispatchContext = {
  target?: Enemy;
  firstTarget?: Enemy;
  lastTarget?: Enemy;
  projectile?: Projectile;
  pickup?: Pickup;
  zone?: Zone;
  summon?: Summon;
  node?: WeaveNode;
  nodeIndex?: number;
  terminal?: WeaveTerminal;
  killedEnemies?: readonly Enemy[];
  pickupIds?: readonly number[];
};

function ownedWeaponIds(run: RunState): WeaponId[] {
  const ids = new Set(run.build.weapons.map((weapon) => weapon.id));
  for (const node of run.weave?.nodes ?? []) {
    if (node.kind === "weapon") ids.add(node.sourceId as WeaponId);
  }
  return [...ids];
}

function hasEndlessPerk(run: RunState, id: keyof EndlessPerkState["ranks"]) {
  return (run.endlessPerks.ranks[id] ?? 0) > 0;
}

function pushEnemiesFrom(
  run: RunState,
  x: number,
  y: number,
  radius: number,
  strength = 1,
) {
  for (const enemy of run.enemies) {
    if (enemy.hp <= 0 || enemy.boss) continue;
    const distance = Math.sqrt(distanceSquared(x, y, enemy.x, enemy.y));
    if (distance > radius + enemy.radius) continue;
    const direction = normalized(enemy.x - x, enemy.y - y);
    const push = Math.max(24, (radius - distance) * 0.46) * strength;
    enemy.x = clamp(enemy.x + direction.x * push, 24, GAME_WIDTH - 24);
    enemy.y = clamp(enemy.y + direction.y * push, 28, GAME_HEIGHT - 28);
    enemy.vx += direction.x * push * 2.2;
    enemy.vy += direction.y * push * 2.2;
  }
}

function spawnPerkProjectile(
  run: RunState,
  owner: WeaponId,
  x: number,
  y: number,
  target: Enemy,
  damage: number,
  angleOffset = 0,
  tags: readonly EffectTag[] = [],
) {
  const base = Math.atan2(target.y - y, target.x - x) + angleOffset;
  run.projectiles.push({
    id: nextId(run),
    owner,
    artKey: `perk/${owner}/projectile`,
    tags,
    x,
    y,
    vx: Math.cos(base) * 780,
    vy: Math.sin(base) * 780,
    radius: 9,
    damage,
    life: 1.7,
    pierce: 2,
    homing: 0.24,
    targetId: target.id,
    markSeconds: 0,
    hitCooldown: 0.16,
    hitAt: new Map(),
    canProc: false,
    spawnDelay: 0,
  });
}

function executeEndlessPerkAction(
  run: RunState,
  action: EndlessPerkAction,
  seasonalMultiplier: 1 | 2,
  event: EndlessPerkRuntimeEvent,
  context: EndlessPerkDispatchContext,
) {
  const strength = seasonalMultiplier;
  const target = context.target ?? context.lastTarget ?? context.firstTarget;
  if (action.kind === "returnAndRetarget") {
    const next = pickNearest(
      run,
      target?.x ?? run.player.x,
      target?.y ?? run.player.y,
      target ? new Set([target.id]) : new Set(),
    );
    if (next) {
      spawnPerkProjectile(
        run,
        "sword",
        target?.x ?? run.player.x,
        target?.y ?? run.player.y,
        next,
        46 * strength * run.player.powerMultiplier,
        0,
        ["blade", "mark"],
      );
    }
  } else if (action.kind === "retargetAndAccelerate") {
    const projectile = context.projectile;
    const strongest = pickStrongest(run);
    if (projectile && strongest) {
      const speed =
        Math.hypot(projectile.vx, projectile.vy) *
        (action.value ?? 1.35);
      const direction = normalized(
        strongest.x - projectile.x,
        strongest.y - projectile.y,
      );
      projectile.vx = direction.x * speed;
      projectile.vy = direction.y * speed;
      projectile.targetId = strongest.id;
      projectile.homing = Math.max(projectile.homing, 0.72);
    }
  } else if (action.kind === "pushAndGuard") {
    pushEnemiesFrom(
      run,
      run.player.x,
      run.player.y,
      action.radius ?? 148,
      strength,
    );
    run.perkCombat.temporaryGuardCharges = Math.max(
      run.perkCombat.temporaryGuardCharges,
      (action.count ?? 1) * strength,
    );
    run.perkCombat.temporaryGuardUntil = Math.max(
      run.perkCombat.temporaryGuardUntil,
      run.elapsed + (action.durationSeconds ?? 0.6) * strength,
    );
  } else if (action.kind === "crossCutMarked") {
    const marked = run.enemies
      .filter((enemy) => enemy.hp > 0 && enemy.marked > 0)
      .sort(
        (a, b) =>
          distanceSquared(run.player.x, run.player.y, a.x, a.y) -
          distanceSquared(run.player.x, run.player.y, b.x, b.y),
      )[0];
    if (marked) {
      run.strikes.push({
        id: nextId(run),
        owner: "scissors",
        artKey: "perk/scissors/cross-cut",
        x: marked.x,
        y: marked.y,
        radius: 74,
        damage: 72 * strength * run.player.powerMultiplier,
        delay: 0.08,
        maxDelay: 0.08,
        hostile: false,
        canProc: false,
      });
    }
  } else if (action.kind === "releasePearlRows") {
    const first = context.firstTarget ?? target ?? pickNearest(run);
    if (first) {
      const rows = Math.max(1, action.count ?? 3);
      for (let row = 0; row < rows; row += 1) {
        const offset = (row - (rows - 1) / 2) * 0.13;
        spawnPerkProjectile(
          run,
          "abacus",
          run.player.x,
          run.player.y,
          first,
          28 * strength * run.player.powerMultiplier,
          offset,
          ["ledger"],
        );
      }
    }
  } else if (action.kind === "placeTemporaryTurret") {
    spawnSummons(
      run,
      {
        id: "perk-crossbow-turret",
        kind: "summon",
        trigger: "periodic",
        tags: ["mechanism"],
        summonKey: "perk-crossbow-turret",
        count: action.count ?? 1,
        duration: (action.durationSeconds ?? 4) * strength,
        attackDamage: 24 * run.player.powerMultiplier,
        attackCooldown: 0.48,
        moveSpeed: 80,
      },
      "crossbow",
      1,
      false,
    );
  } else if (action.kind === "returnChainToFirst") {
    const first = context.firstTarget ?? target;
    if (first?.hp && first.hp > 0) {
      run.strikes.push({
        id: nextId(run),
        owner: "pipa",
        artKey: "perk/pipa/return-note",
        x: first.x,
        y: first.y,
        radius: 52,
        damage:
          64 *
          (action.value ?? 0.6) *
          strength *
          run.player.powerMultiplier,
        delay: 0.1,
        maxDelay: 0.1,
        hostile: false,
        canProc: false,
      });
    }
  } else if (action.kind === "extendInkAndBurstCross") {
    const cross = target ?? pickNearest(run);
    const x = cross?.x ?? run.player.x;
    const y = cross?.y ?? run.player.y;
    run.zones.push({
      id: nextId(run),
      owner: "inkline",
      artKey: "perk/inkline/cross-stay",
      x,
      y,
      radius: 88,
      damagePerSecond: 36 * strength * run.player.powerMultiplier,
      life: (action.durationSeconds ?? 1.5) * strength,
      maxLife: (action.durationSeconds ?? 1.5) * strength,
      tick: 0,
      tickRate: 0.25,
      followsPlayer: false,
      slow: 0.16,
      canProc: false,
      enteredEnemyIds: new Set(),
    });
    run.strikes.push({
      id: nextId(run),
      owner: "inkline",
      artKey: "perk/inkline/cross-burst",
      x,
      y,
      radius: 82,
      damage: 54 * strength * run.player.powerMultiplier,
      delay: 0.12,
      maxDelay: 0.12,
      hostile: false,
      canProc: false,
    });
  } else if (action.kind === "storeLanternFire") {
    run.perkCombat.lanternFireCharges = Math.min(
      action.maxActive ?? 1,
      run.perkCombat.lanternFireCharges + (action.count ?? 1),
    );
  } else if (action.kind === "leaveLightningRelay") {
    const relay = context.lastTarget ?? target ?? pickNearest(run);
    if (relay) {
      run.zones.push({
        id: nextId(run),
        owner: "thunderSeal",
        artKey: "perk/thunder/relay",
        x: relay.x,
        y: relay.y,
        radius: 78,
        damagePerSecond: 34 * strength * run.player.powerMultiplier,
        life: (action.durationSeconds ?? 3) * strength,
        maxLife: (action.durationSeconds ?? 3) * strength,
        tick: 0,
        tickRate: 0.3,
        followsPlayer: false,
        slow: 0,
        canProc: false,
        enteredEnemyIds: new Set(),
      });
    }
  } else if (action.kind === "reverseNextCycle") {
    run.perkCombat.weaveDirection = -1;
  } else if (action.kind === "addCounterCursor") {
    run.perkCombat.weaveCounterScale = action.value ?? 0.55;
  } else if (action.kind === "chargeNextNode") {
    run.perkCombat.weaveNextNodeScale += (action.value ?? 0.2) * strength;
  } else if (action.kind === "repeatPreviousNode") {
    if (run.weave && context.nodeIndex !== undefined) {
      const index =
        (context.nodeIndex - run.perkCombat.weaveDirection +
          run.weave.nodes.length) %
        run.weave.nodes.length;
      const previous = run.weave.nodes[index];
      if (previous) fireWeaveNode(run, previous, 1);
    }
  } else if (action.kind === "repeatFirstNode") {
    run.perkCombat.weaveRepeatFirst += action.count ?? 1;
  } else if (action.kind === "scaleCycleAndFinish") {
    if (event.type === "weaveCycleStarted") {
      run.perkCombat.weaveCycleScale *= action.value ?? 1;
      run.perkCombat.weaveFinishScale *= action.secondaryValue ?? 1;
    }
  } else if (action.kind === "replayFinish") {
    if (context.terminal) {
      run.perkCombat.pendingFinishReplays.push({
        delay: action.durationSeconds ?? 0.8,
        effects: context.terminal.effects,
        damageScale: action.value ?? 0.55,
      });
    }
  } else if (action.kind === "carryFinishDamage") {
    run.perkCombat.weaveNextNodeScale += action.value ?? 0.3;
  } else if (action.kind === "spawnHealingLeaf") {
    const active = run.pickups.filter(
      (pickup) => pickup.kind === "healingLeaf" && pickup.value > 0,
    ).length;
    if (active < (action.maxActive ?? 1)) {
      run.pickups.push({
        id: nextId(run),
        x: clamp(run.player.x + randomRange(run, -90, 90), 24, GAME_WIDTH - 24),
        y: clamp(run.player.y + randomRange(run, -70, 70), 28, GAME_HEIGHT - 28),
        value: strength,
        age: 0,
        tier: 2,
        kind: "healingLeaf",
        magnetRadius: 180,
      });
    }
  } else if (action.kind === "acceleratePickupMerge") {
    if (context.pickup) {
      context.pickup.mergeMultiplier =
        1 + ((action.value ?? 1.8) - 1) * strength;
      context.pickup.magnetRadius = (action.radius ?? 190) * strength;
    }
  } else if (action.kind === "conductLightningFromZone") {
    const origin = target ?? pickNearest(run);
    if (origin) {
      const next = pickNearest(run, origin.x, origin.y, new Set([origin.id]));
      if (next) {
        run.strikes.push({
          id: nextId(run),
          owner: context.zone?.owner ?? "thunderSeal",
          artKey: "perk/season/lotus-conduct",
          x: next.x,
          y: next.y,
          radius: 48,
          damage: 30 * strength * run.player.powerMultiplier,
          delay: 0.12,
          maxDelay: 0.12,
          hostile: false,
          canProc: false,
        });
      }
    }
  } else if (action.kind === "accelerateAndExtendProjectile") {
    const projectile = context.projectile;
    if (projectile) {
      const factor = 1 + ((action.value ?? 1.35) - 1) * strength;
      projectile.vx *= factor;
      projectile.vy *= factor;
      projectile.life += (action.durationSeconds ?? 0.6) * strength;
    }
  } else if (action.kind === "bundleKillDrops") {
    const ids = new Set(context.pickupIds ?? []);
    const bundled = run.pickups.filter((pickup) => ids.has(pickup.id));
    if (bundled.length > 0) {
      const total =
        bundled.reduce((sum, pickup) => sum + pickup.value, 0) * strength;
      const x =
        bundled.reduce((sum, pickup) => sum + pickup.x, 0) / bundled.length;
      const y =
        bundled.reduce((sum, pickup) => sum + pickup.y, 0) / bundled.length;
      run.pickups = run.pickups.filter((pickup) => !ids.has(pickup.id));
      addExperiencePickup(run, x, y, total);
    }
  } else if (action.kind === "sweepDistantPickups") {
    const radius = (action.radius ?? 520) * strength;
    for (const pickup of run.pickups) {
      const distance = Math.sqrt(
        distanceSquared(
          pickup.x,
          pickup.y,
          run.player.x,
          run.player.y,
        ),
      );
      if (distance <= 170 || distance > radius) continue;
      const direction = normalized(
        run.player.x - pickup.x,
        run.player.y - pickup.y,
      );
      const sweep = Math.min(distance - 150, 150 * strength);
      pickup.x += direction.x * sweep;
      pickup.y += direction.y * sweep;
    }
  } else if (action.kind === "grantLanternGuard") {
    run.perkCombat.lanternGuardCharges = Math.min(
      (action.maxActive ?? 1) * strength,
      run.perkCombat.lanternGuardCharges + (action.count ?? 1) * strength,
    );
  } else if (action.kind === "slowFirstZoneEntry") {
    if (target) {
      target.slow = Math.max(
        target.slow,
        (action.durationSeconds ?? 1.2) * strength,
      );
    }
  } else if (action.kind === "emitPickupWind") {
    pushEnemiesFrom(
      run,
      run.player.x,
      run.player.y,
      action.radius ?? 132,
      strength,
    );
  } else if (action.kind === "preventLethalDamage") {
    run.player.life = Math.max(action.value ?? 1, 1);
    run.player.invulnerability = Math.max(
      run.player.invulnerability,
      action.durationSeconds ?? 1,
    );
  } else if (action.kind === "grantHumanGuard") {
    run.perkCombat.temporaryGuardCharges = Math.max(
      run.perkCombat.temporaryGuardCharges,
      action.count ?? 1,
    );
    run.perkCombat.temporaryGuardUntil = Math.max(
      run.perkCombat.temporaryGuardUntil,
      run.elapsed + (action.durationSeconds ?? 0.5),
    );
  } else if (action.kind === "empowerNextSignatureAttack") {
    run.perkCombat.signatureCharges = Math.max(
      run.perkCombat.signatureCharges,
      action.count ?? 1,
    );
    run.perkCombat.signatureMultiplier = Math.max(
      run.perkCombat.signatureMultiplier,
      action.value ?? 1.35,
    );
  } else if (action.kind === "pushOnSharpTurn") {
    pushEnemiesFrom(
      run,
      run.player.x,
      run.player.y,
      action.radius ?? 138,
      strength,
    );
  } else if (action.kind === "healWhileIdle") {
    run.player.life = Math.min(
      run.player.maxLife,
      run.player.life + (action.value ?? 0.2) * strength,
    );
  }
}

export function dispatchEndlessPerkEvent(
  run: RunState,
  event: EndlessPerkRuntimeEvent,
  context: EndlessPerkDispatchContext = {},
): readonly EndlessPerkProc[] {
  if (Object.keys(run.endlessPerks.ranks).length === 0) return [];
  const completeEvent: EndlessPerkRuntimeEvent = {
    ...event,
    season: event.season ?? getSolarTermState(run.elapsed, true).season,
    ownedWeaponIds: event.ownedWeaponIds ?? ownedWeaponIds(run),
  };
  const result = consumeEndlessPerkEvent(run.endlessPerks, completeEvent);
  run.endlessPerks = result.state;
  for (const proc of result.procs) {
    for (const action of proc.actions) {
      executeEndlessPerkAction(
        run,
        action,
        proc.seasonalMultiplier,
        completeEvent,
        context,
      );
    }
  }
  return result.procs;
}

function dispatchSynergyEvent(
  run: RunState,
  event: CombatEventKind,
  sourceWeapon?: WeaponId,
  target?: Enemy,
) {
  for (const synergy of resolveChosenSynergies(
    run.build.weapons,
    run.activeSynergyIds,
    run.build.synergyCapacity,
  )) {
    for (const rule of synergy.eventRules) {
      if (rule.event !== event) continue;
      if (rule.sourceWeapon && rule.sourceWeapon !== sourceWeapon) continue;
      if (
        !rule.sourceWeapon &&
        sourceWeapon &&
        !synergy.definition.weapons.includes(sourceWeapon)
      ) continue;
      const key = `synergy:${synergy.definition.id}:${rule.id}`;
      const count = (run.synergyCounters.get(key) ?? 0) + 1;
      const required = Math.max(1, rule.every ?? 1);
      if (count < required) {
        run.synergyCounters.set(key, count);
        continue;
      }
      run.synergyCounters.set(key, count - required);
      const owner: ProjectileOwner = `synergy:${synergy.definition.id}`;
      for (const effect of rule.effects) {
        fireEffect(run, effect, owner, target, 1, false);
      }
    }
  }
}

function copySourceProjectile(
  run: RunState,
  effect: Extract<EffectSpec, { kind: "copy" }>,
  owner: ProjectileOwner,
  target?: Enemy,
): Projectile | undefined {
  const latest = (predicate: (projectile: Projectile) => boolean) =>
    [...run.projectiles].reverse().find(predicate);
  if (effect.source === "primaryWeapon") {
    const primary = run.build.weapons[0]?.id;
    return primary
      ? latest((projectile) => projectile.owner === primary)
      : undefined;
  }
  if (effect.source === "previousWeaveNode") {
    if (owner.startsWith("weave:") && run.weave) {
      const instanceId = owner.slice("weave:".length);
      const index = run.weave.nodes.findIndex(
        (node) => node.instanceId === instanceId,
      );
      if (index >= 0 && run.weave.nodes.length > 1) {
        const previous =
          run.weave.nodes[
            (index - 1 + run.weave.nodes.length) % run.weave.nodes.length
          ];
        const previousOwner: ProjectileOwner = `weave:${previous.instanceId}`;
        const found = latest(
          (projectile) => projectile.owner === previousOwner,
        );
        if (found) return found;
      }
    }
    const direct = directWeaponOwner(owner);
    const index = direct
      ? run.build.weapons.findIndex((weapon) => weapon.id === direct)
      : -1;
    if (index > 0) {
      const previous = run.build.weapons[index - 1].id;
      const found = latest((projectile) => projectile.owner === previous);
      if (found) return found;
    }
    return latest((projectile) => projectile.owner !== owner);
  }
  if (target?.marked) {
    const byTarget = latest(
      (projectile) =>
        projectile.owner !== owner && projectile.targetId === target.id,
    );
    if (byTarget) return byTarget;
  }
  const markedIds = new Set(
    run.enemies
      .filter((enemy) => enemy.marked > 0)
      .map((enemy) => enemy.id),
  );
  return latest(
    (projectile) =>
      projectile.owner !== owner &&
      projectile.targetId !== undefined &&
      markedIds.has(projectile.targetId),
  );
}

function fireEffect(
  run: RunState,
  effect: EffectSpec,
  owner: ProjectileOwner,
  start?: Enemy,
  damageScale = 1,
  canProc = true,
) {
  if (effect.kind === "mark") {
    const target =
      start ??
      (effect.priority === "nearest"
        ? pickNearest(run)
        : effect.priority === "lowestHp"
          ? [...run.enemies].filter((enemy) => enemy.hp > 0).sort((a, b) => a.hp - b.hp)[0]
          : pickStrongest(run));
    if (!target) return;
    const nextStacks =
      target.marked > 0
        ? Math.min(effect.maxStacks ?? 1, target.markStacks + 1)
        : 1;
    target.marked = Math.max(target.marked, effect.duration);
    target.markStacks = nextStacks;
    target.markMultiplier = Math.max(
      target.markMultiplier,
      1 + (effect.damageTakenMultiplier - 1) * nextStacks,
    );
  } else if (effect.kind === "execute") {
    const target = start ?? pickStrongest(run);
    if (!target || target.hp <= 0) return;
    const threshold = target.boss ? effect.bossThreshold : effect.threshold;
    if (target.hp / target.maxHp <= threshold) {
      damageEnemy(
        run,
        target,
        effect.bonusDamage * damageScale * run.player.powerMultiplier,
        owner,
        false,
      );
    }
  } else if (effect.kind === "accumulator") {
    const counterKey = `${owner}:${effect.counter}`;
    const current = (run.accumulators.get(counterKey) ?? 0) + 1;
    if (current >= effect.required) {
      run.accumulators.set(
        counterKey,
        effect.resetOnProc ? 0 : current - effect.required,
      );
      for (const proc of effect.procEffects) {
        fireEffect(run, proc, owner, start, damageScale, canProc);
      }
    } else {
      run.accumulators.set(counterKey, current);
    }
  } else if (effect.kind === "projectile") {
    spawnProjectilePattern(run, effect, owner, damageScale, canProc);
  } else if (effect.kind === "beam") {
    fireBeam(run, effect, owner, damageScale, canProc);
  } else if (effect.kind === "lightning") {
    scheduleLightning(run, effect, owner, damageScale, canProc);
  } else if (effect.kind === "chain") {
    fireChain(run, effect, owner, start, damageScale, canProc);
  } else if (effect.kind === "zone") {
    spawnZone(run, effect, owner, damageScale, canProc);
  } else if (effect.kind === "summon") {
    spawnSummons(run, effect, owner, damageScale, canProc);
  } else if (effect.kind === "orbit") {
    addFx(
      run,
      "ring",
      run.player.x,
      run.player.y,
      effect.radius,
      0.42,
      ownerColor(owner),
      effect.visualKey ?? `orbit/${owner}`,
      { owner },
    );
    for (const enemy of run.enemies) {
      if (
        enemy.hp > 0 &&
        distanceSquared(run.player.x, run.player.y, enemy.x, enemy.y) <=
          (effect.radius + enemy.radius) ** 2
      ) {
        damageEnemy(
          run,
          enemy,
          effect.damage * damageScale * run.player.powerMultiplier,
          owner,
          canProc,
        );
      }
    }
  } else if (effect.kind === "delayed") {
    const target = start ?? pickNearest(run);
    if (!target) return;
    const strikeCount = 1 + Math.max(0, effect.repeats ?? 0);
    for (let index = 0; index < strikeCount; index += 1) {
      const delay = effect.delay * (index + 1);
      run.strikes.push({
        id: nextId(run),
        owner,
        artKey: effect.visualKey ?? `delayed/${owner}`,
        x: target.x,
        y: target.y,
        radius: effect.radius,
        damage: effect.damage * damageScale * run.player.powerMultiplier,
        delay,
        maxDelay: delay,
        hostile: false,
        canProc,
      });
    }
  } else if (effect.kind === "copy") {
    const projectile = copySourceProjectile(run, effect, owner, start);
    if (!projectile) return;
    for (let index = 0; index < effect.maxCopies; index += 1) {
      run.projectiles.push({
        ...projectile,
        id: nextId(run),
        owner,
        damage: projectile.damage * effect.damageMultiplier,
        vx: projectile.vx * Math.cos((index + 1) * 0.12) - projectile.vy * Math.sin((index + 1) * 0.12),
        vy: projectile.vx * Math.sin((index + 1) * 0.12) + projectile.vy * Math.cos((index + 1) * 0.12),
        hitAt: new Map(),
        canProc,
        spawnDelay: 0,
      });
    }
  }
}

function applyOnHitEffects(
  run: RunState,
  owner: ProjectileOwner,
  enemy: Enemy,
) {
  dispatchOwnerTrigger(run, owner, "onHit", enemy);
  if (enemy.marked > 0) {
    dispatchOwnerTrigger(run, owner, "onMarkedHit", enemy);
  }
}

function dispatchEffectTrigger(
  run: RunState,
  owner: ProjectileOwner,
  effect: EffectSpec,
  trigger: EffectTrigger,
  target?: Enemy,
  announceAttack = true,
) {
  if (effect.trigger !== trigger) return false;
  const key = `trigger:${trigger}:${owner}:${effect.id}`;
  if ((run.cooldowns.get(key) ?? 0) > 0) return false;
  const activeTrigger = trigger === "onAttack" || trigger === "periodic";
  const reactiveCooldown =
    trigger === "onHit" || trigger === "onMarkedHit"
      ? effect.internalCooldown ?? 0.12
      : effect.internalCooldown ?? 0;
  const cooldown = activeTrigger ? effectCooldown(effect) : reactiveCooldown;
  if (effect.chance !== undefined && random(run) > effect.chance) {
    if (cooldown > 0) run.cooldowns.set(key, cooldown);
    return false;
  }
  const sourceWeapon = directWeaponOwner(owner);
  let damageScale = 1;
  if (
    activeTrigger &&
    announceAttack &&
    sourceWeapon !== undefined &&
    sourceWeapon === run.build.weapons[0]?.id &&
    run.perkCombat.signatureCharges > 0
  ) {
    damageScale = run.perkCombat.signatureMultiplier;
    run.perkCombat.signatureCharges -= 1;
    if (run.perkCombat.signatureCharges <= 0) {
      run.perkCombat.signatureMultiplier = 1;
    }
  }
  const allowHitProcs = trigger !== "onHit" && trigger !== "onMarkedHit";
  fireEffect(run, effect, owner, target, damageScale, allowHitProcs);
  if (
    activeTrigger &&
    announceAttack &&
    sourceWeapon === "lantern" &&
    run.perkCombat.lanternFireCharges > 0
  ) {
    run.perkCombat.lanternFireCharges -= 1;
    fireEffect(run, effect, owner, target, damageScale * 0.68, false);
  }
  if (sourceWeapon && activeTrigger && announceAttack) {
    dispatchSynergyEvent(run, "weaponAttack", sourceWeapon, target);
    if (sourceWeapon === "crossbow") {
      dispatchEndlessPerkEvent(run, {
        type: "crossbowVolleyCompleted",
        weaponId: "crossbow",
      });
    } else if (sourceWeapon === "scissors") {
      dispatchEndlessPerkEvent(
        run,
        { type: "scissorPathsCrossed", weaponId: "scissors" },
        { target: target ?? pickNearest(run) },
      );
    }
  }
  if (cooldown > 0) run.cooldowns.set(key, cooldown);
  return true;
}

function dispatchOwnerTrigger(
  run: RunState,
  owner: ProjectileOwner,
  trigger: EffectTrigger,
  target?: Enemy,
) {
  const effects = effectOwners(run).get(owner) ?? [];
  for (const effect of effects) {
    dispatchEffectTrigger(run, owner, effect, trigger, target);
  }
}

function dispatchAllOwnersTrigger(
  run: RunState,
  trigger: EffectTrigger,
  target?: Enemy,
) {
  for (const [owner, effects] of effectOwners(run)) {
    for (const effect of effects) {
      dispatchEffectTrigger(run, owner, effect, trigger, target);
    }
  }
}

function effectCooldown(effect: EffectSpec) {
  if (effect.kind === "projectile") return Math.max(0.18, effect.cooldown);
  if (effect.kind === "beam") return effect.internalCooldown ?? 1.05;
  if (effect.kind === "lightning") return effect.internalCooldown ?? 1.75;
  if (effect.kind === "chain") return effect.internalCooldown ?? 1.18;
  if (effect.kind === "zone") return effect.internalCooldown ?? Math.max(1.5, effect.duration * 0.7);
  if (effect.kind === "summon") return effect.internalCooldown ?? Math.max(2, effect.duration * 0.72);
  if (effect.kind === "delayed") return effect.internalCooldown ?? 1.2;
  if (effect.kind === "copy") return effect.internalCooldown ?? 1.1;
  return effect.internalCooldown ?? 0.8;
}

function updateActiveEffects(run: RunState, delta: number) {
  for (const [key, value] of run.cooldowns) {
    if (value <= delta) run.cooldowns.delete(key);
    else run.cooldowns.set(key, value - delta);
  }

  const directOwners = new Set<ProjectileOwner>();
  for (const weaponState of run.build.weapons) {
    const owner: ProjectileOwner = weaponState.id;
    directOwners.add(owner);
    const kit = resolveWeaponKit(weaponState);
    const activeEffects = [
      ...kit.core,
      ...kit.route,
      ...kit.mastery,
    ].filter(
      (effect) =>
        (effect.trigger === "onAttack" ||
          effect.trigger === "periodic") &&
        effect.kind !== "orbit",
    );
    const primary =
      kit.core.find(
        (effect) =>
          (effect.trigger === "onAttack" ||
            effect.trigger === "periodic") &&
          effect.kind !== "orbit",
      ) ?? activeEffects[0];
    if (!primary) continue;
    const attackKey = `weapon-attack:${owner}`;
    if ((run.cooldowns.get(attackKey) ?? 0) > 0) continue;
    const fired = dispatchEffectTrigger(
      run,
      owner,
      primary,
      primary.trigger,
      undefined,
      true,
    );
    run.cooldowns.set(
      attackKey,
      Math.max(
        minimumWeaponCadence[weaponState.id],
        effectCooldown(primary),
      ),
    );
    if (!fired) continue;
    for (const linked of activeEffects) {
      if (linked === primary) continue;
      dispatchEffectTrigger(
        run,
        owner,
        linked,
        linked.trigger,
        undefined,
        false,
      );
    }
  }

  for (const [owner, effects] of effectOwners(run)) {
    if (directOwners.has(owner)) continue;
    for (const effect of effects) {
      if (effect.trigger !== "onAttack" && effect.trigger !== "periodic") continue;
      // Periodic orbit effects are persistent and are resolved by updateOrbits.
      if (effect.kind === "orbit") continue;
      dispatchEffectTrigger(run, owner, effect, effect.trigger);
    }
  }
}

function updateOrbits(run: RunState, delta: number) {
  const groups = effectOwners(run);
  let orbitIndex = 0;
  for (const [owner, effects] of groups) {
    for (const effect of effects) {
      if (
        effect.kind !== "orbit" ||
        (effect.trigger !== "periodic" && effect.trigger !== "onAttack")
      ) continue;
      const baseAngle = run.elapsed * effect.angularSpeed + orbitIndex * 0.51;
      for (let index = 0; index < effect.count; index += 1) {
        const angle = baseAngle + (Math.PI * 2 * index) / effect.count;
        const x = run.player.x + Math.cos(angle) * effect.radius;
        const y = run.player.y + Math.sin(angle) * effect.radius;
        for (const enemy of run.enemies) {
          if (enemy.hp <= 0) continue;
          const key = `${effect.id}:${index}:${enemy.id}`;
          const previous = run.orbitHits.get(key) ?? -999;
          if (
            run.elapsed - previous >= effect.hitCooldown &&
            distanceSquared(x, y, enemy.x, enemy.y) < (14 + enemy.radius) ** 2
          ) {
            run.orbitHits.set(key, run.elapsed);
            damageEnemy(run, enemy, effect.damage * run.player.powerMultiplier, owner);
            if (
              directWeaponOwner(owner) === "scissors" &&
              (run.cooldowns.get("perk:scissors-cross:event") ?? 0) <= 0
            ) {
              run.cooldowns.set("perk:scissors-cross:event", 0.65);
              dispatchEndlessPerkEvent(
                run,
                {
                  type: "scissorPathsCrossed",
                  weaponId: "scissors",
                },
                { target: enemy },
              );
            }
          }
        }
      }
      orbitIndex += 1;
    }
  }
  if (run.orbitHits.size > 1800) {
    for (const [key, at] of run.orbitHits) if (run.elapsed - at > 3) run.orbitHits.delete(key);
  }
  void delta;
}

function spawnEnemy(
  run: RunState,
  forced?: EnemyArchetype,
  options: { intrusion?: boolean; x?: number; y?: number } = {},
) {
  const term = getSolarTermState(run.elapsed, run.endless).current;
  const seasonal: Record<string, EnemyArchetype[]> = {
    spring: ["cup", "shoe", "fish", "rib"],
    summer: ["lantern", "fish", "shoe", "rib"],
    autumn: ["abacus", "cup", "lantern", "puppet"],
    winter: ["rib", "abacus", "shoe", "lantern"],
  };
  let type = forced ?? seasonal[term.season][Math.floor(random(run) * seasonal[term.season].length)];
  if (!forced && term.spawnBias === "lantern-bugs" && random(run) < 0.34) type = "lantern";
  if (!forced && term.spawnBias === "paper-fish" && random(run) < 0.34) type = "fish";
  if (!forced && term.spawnBias === "abacus-spirits" && random(run) < 0.34) type = "abacus";
  if (!forced && term.spawnBias === "umbrella-bones" && random(run) < 0.34) type = "rib";

  const margin = 65;
  const edge = Math.floor(random(run) * 4);
  let x = options.x ?? randomRange(run, 0, GAME_WIDTH);
  let y = options.y ?? randomRange(run, 0, GAME_HEIGHT);
  if (options.x === undefined || options.y === undefined) {
    if (edge === 0) x = -margin;
    if (edge === 1) x = GAME_WIDTH + margin;
    if (edge === 2) y = -margin;
    if (edge === 3) y = GAME_HEIGHT + margin;
  }
  const stat = enemyStats[type];
  const elite = type === "lion" || type === "puppet" || options.intrusion === true;
  const boss =
    options.intrusion !== true && (type === "taotie" || type === "nian");
  const bossTier: BossTier = options.intrusion
    ? null
    : type === "taotie"
      ? "mid"
      : type === "nian"
        ? "final"
        : null;
  const baseHp = 12 + run.elapsed * 0.06;
  const trialHp = run.trials.has("elite") && (elite || boss) ? 1.42 : 1;
  const endlessScale = run.endless ? 1 + Math.max(0, run.elapsed - STANDARD_SECONDS) / 420 : 1;
  const intrusionScale = options.intrusion ? 17 : 1;
  const maxHp = baseHp * stat.hp * trialHp * endlessScale * intrusionScale;
  const towardPlayer = Math.atan2(run.player.y - y, run.player.x - x);
  const enemy: Enemy = {
    id: nextId(run),
    type,
    x,
    y,
    vx: Math.cos(towardPlayer) * stat.speed,
    vy: Math.sin(towardPlayer) * stat.speed,
    heading: towardPlayer,
    travelled: 0,
    radius: stat.radius * (options.intrusion ? 1.38 : 1),
    hp: maxHp,
    maxHp,
    speed: stat.speed * (run.trials.has("swift") ? 1.18 : 1),
    turnSpeed: stat.turn,
    damage: stat.damage,
    elite,
    boss,
    bossTier,
    hitFlash: 0,
    marked: 0,
    markMultiplier: 1,
    markStacks: 0,
    slow: 0,
    motion: "moving",
    motionTime: 0,
    attackCooldown: randomRange(run, 0.2, 0.8),
    attackCommitted: false,
    skillIndex: 0,
    intrusionAvatar: options.intrusion === true,
  };
  run.enemies.push(enemy);
  if (options.intrusion) run.intrusionAvatarId = enemy.id;
  if (bossTier) run.currentBoss = bossTier;
  return enemy;
}

function updateSpawning(run: RunState, delta: number, events: RunEvent[]) {
  const bossAlive = run.enemies.some((enemy) => enemy.boss && enemy.hp > 0);
  if (!run.endless) {
    if (run.elapsed >= 360 && !run.midBossSpawned && !bossAlive) {
      spawnEnemy(run, "taotie");
      run.midBossSpawned = true;
      events.push({ type: "bossSpawn", tier: "mid" });
    }
    if (run.elapsed >= STANDARD_SECONDS && !run.finalBossSpawned && !bossAlive) {
      spawnEnemy(run, "nian");
      run.finalBossSpawned = true;
      events.push({ type: "bossSpawn", tier: "final" });
    }
  } else if (run.elapsed >= run.endlessBossAt && !bossAlive) {
    const type = run.endlessBossCount % 2 === 0 ? "taotie" : "nian";
    spawnEnemy(run, type);
    run.endlessBossCount += 1;
    run.endlessBossAt += 240;
    events.push({ type: "bossSpawn", tier: type === "taotie" ? "mid" : "final" });
  }

  run.spawnClock -= delta;
  if (run.spawnClock <= 0 && run.enemies.length < 145) {
    const density = run.trials.has("crowd") ? 1.3 : 1;
    const count = Math.min(5, 1 + Math.floor(run.elapsed / 115));
    for (let index = 0; index < count; index += 1) spawnEnemy(run);
    run.spawnClock = Math.max(0.18, (0.88 - run.elapsed * 0.00072) / density);
  }
  for (const [at, type] of [[120, "lion"], [300, "puppet"]] as Array<[number, EnemyArchetype]>) {
    if (run.elapsed >= at && run.elapsed - delta < at) spawnEnemy(run, type);
  }
}

function applySeparation(run: RunState, enemy: Enemy) {
  let pushX = 0;
  let pushY = 0;
  for (const other of run.enemies) {
    if (other === enemy || other.hp <= 0) continue;
    const dx = enemy.x - other.x;
    const dy = enemy.y - other.y;
    const safe = (enemy.radius + other.radius) * 0.72;
    const distance = Math.hypot(dx, dy);
    if (distance > 0 && distance < safe) {
      const strength = (safe - distance) / safe;
      pushX += (dx / distance) * strength;
      pushY += (dy / distance) * strength;
    }
  }
  return { x: pushX, y: pushY };
}

function beginNianLeap(run: RunState, enemy: Enemy) {
  const warningFxId = addFx(
    run,
    "warning",
    run.player.x,
    run.player.y,
    150,
    0.68,
    "#a94838",
    "boss/nian/leap-warning",
  );
  enemy.action = {
    kind: "nianLeap",
    phase: "telegraph",
    elapsed: 0,
    startX: enemy.x,
    startY: enemy.y,
    targetX: run.player.x,
    targetY: run.player.y,
    warningFxId,
  };
  enemy.motion = "attacking";
  enemy.motionTime = 0;
  enemy.attackCommitted = true;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.skillIndex += 1;
}

function stepNianLeap(
  run: RunState,
  enemy: Enemy,
  delta: number,
  events: RunEvent[],
) {
  const action = enemy.action;
  if (!action || action.kind !== "nianLeap") return false;
  action.elapsed += delta;
  enemy.vx = 0;
  enemy.vy = 0;

  if (action.phase === "telegraph") {
    const warning = run.fx.find((fx) => fx.id === action.warningFxId);
    if (warning) {
      warning.x = run.player.x;
      warning.y = run.player.y;
    }
    enemy.heading = Math.atan2(
      run.player.y - enemy.y,
      run.player.x - enemy.x,
    );
    if (action.elapsed >= 0.5) {
      const direction = normalized(
        run.player.x - enemy.x,
        run.player.y - enemy.y,
      );
      action.startX = enemy.x;
      action.startY = enemy.y;
      action.targetX = clamp(
        run.player.x - direction.x * 120,
        enemy.radius,
        GAME_WIDTH - enemy.radius,
      );
      action.targetY = clamp(
        run.player.y - direction.y * 120,
        enemy.radius,
        GAME_HEIGHT - enemy.radius,
      );
      if (warning) {
        warning.x = action.targetX;
        warning.y = action.targetY;
      }
      action.phase = "travel";
      action.elapsed = 0;
    }
    return true;
  }

  if (action.phase === "travel") {
    const ratio = clamp(action.elapsed / 0.32, 0, 1);
    const eased = ratio * ratio * (3 - 2 * ratio);
    const previousX = enemy.x;
    const previousY = enemy.y;
    enemy.x = action.startX + (action.targetX - action.startX) * eased;
    enemy.y = action.startY + (action.targetY - action.startY) * eased;
    enemy.heading = Math.atan2(
      action.targetY - action.startY,
      action.targetX - action.startX,
    );
    enemy.travelled += Math.hypot(
      enemy.x - previousX,
      enemy.y - previousY,
    );
    if (ratio >= 1) {
      action.phase = "land";
      action.elapsed = 0;
      addFx(
        run,
        "burst",
        enemy.x,
        enemy.y,
        150,
        0.5,
        "#a94838",
        "boss/nian/leap",
      );
      if (
        distanceSquared(
          enemy.x,
          enemy.y,
          run.player.x,
          run.player.y,
        ) <
          150 ** 2 &&
        hurtPlayer(run)
      ) {
        events.push({ type: "playerHit" });
      }
    }
    return true;
  }

  if (action.phase === "land") {
    if (action.elapsed >= 0.12) {
      action.phase = "recovery";
      action.elapsed = 0;
    }
    return true;
  }

  if (action.elapsed >= 0.35) {
    enemy.action = undefined;
    enemy.motion = "moving";
    enemy.motionTime = 0;
    enemy.attackCooldown = 3.5;
  }
  return true;
}

function executeBossSkill(run: RunState, enemy: Enemy) {
  const ability = enemy.skillIndex % 3;
  const direction = normalized(run.player.x - enemy.x, run.player.y - enemy.y);
  if (enemy.type === "taotie") {
    if (ability === 0) {
      enemy.vx = direction.x * 390;
      enemy.vy = direction.y * 390;
      addFx(run, "ink", enemy.x, enemy.y, 120, 0.55, "#55776e", "boss/taotie/charge");
    } else if (ability === 1) {
      addFx(run, "ring", enemy.x, enemy.y, 205, 0.55, "#708c83", "boss/taotie/shock");
      if (distanceSquared(enemy.x, enemy.y, run.player.x, run.player.y) < 205 ** 2) hurtPlayer(run);
    } else {
      const pull = normalized(enemy.x - run.player.x, enemy.y - run.player.y);
      run.player.x += pull.x * 58;
      run.player.y += pull.y * 58;
      addFx(run, "warning", enemy.x, enemy.y, 235, 0.7, "#3f625e", "boss/taotie/suction");
    }
  } else if (enemy.type === "nian") {
    if (ability === 0) {
      // The leap begins at attack wind-up so it can be shown continuously.
      // This fallback is retained for malformed imported states.
      if (!enemy.action) beginNianLeap(run, enemy);
    } else if (ability === 1) {
      run.strikes.push({
        id: nextId(run),
        owner: "terminal",
        artKey: "boss/nian/lantern-slam",
        x: run.player.x,
        y: run.player.y,
        radius: 112,
        damage: 1,
        delay: 0.65,
        maxDelay: 0.65,
        hostile: true,
      });
    } else {
      addFx(run, "ring", enemy.x, enemy.y, 260, 0.72, "#b74b35", "boss/nian/roar");
      if (distanceSquared(enemy.x, enemy.y, run.player.x, run.player.y) < 260 ** 2) hurtPlayer(run);
    }
  }
}

function hurtPlayer(run: RunState) {
  if (run.player.invulnerability > 0) return false;
  if (run.testModifiers.incomingDamageScale === 0) return false;
  if (
    run.perkCombat.temporaryGuardCharges > 0 &&
    run.elapsed <= run.perkCombat.temporaryGuardUntil
  ) {
    run.perkCombat.temporaryGuardCharges -= 1;
    addFx(
      run,
      "ring",
      run.player.x,
      run.player.y,
      98,
      0.34,
      "#e0d7b4",
      "perk/guard/temporary",
    );
    return false;
  }
  if (run.elapsed > run.perkCombat.temporaryGuardUntil) {
    run.perkCombat.temporaryGuardCharges = 0;
  }
  if (run.perkCombat.lanternGuardCharges > 0) {
    run.perkCombat.lanternGuardCharges -= 1;
    addFx(
      run,
      "ring",
      run.player.x,
      run.player.y,
      106,
      0.4,
      "#c47745",
      "perk/lantern/guard",
    );
    return false;
  }
  const blockKey = "guard:block";
  if ((run.cooldowns.get(blockKey) ?? 0) <= 0) {
    let blockStrength = 0;
    for (const effects of effectOwners(run).values()) {
      for (const effect of effects) {
        if (
          effect.kind === "orbit" &&
          (effect.trigger === "periodic" || effect.trigger === "onAttack")
        ) {
          blockStrength += effect.blockStrength ?? 0;
        }
      }
    }
    if (
      blockStrength > 0 &&
      random(run) < clamp(blockStrength * 0.5, 0, 0.82)
    ) {
      run.cooldowns.set(blockKey, 0.85);
      addFx(
        run,
        "ring",
        run.player.x,
        run.player.y,
        104,
        0.38,
        "#d8c58d",
        "fx/guard-block",
      );
      dispatchSynergyEvent(run, "guardBlock", "umbrella");
      dispatchEndlessPerkEvent(run, {
        type: "guardSucceeded",
        weaponId: "umbrella",
      });
      return false;
    }
  }
  if (run.player.life <= 1) {
    const procs = dispatchEndlessPerkEvent(run, { type: "lethalDamage" });
    if (
      procs.some((proc) =>
        proc.actions.some(
          (action) => action.kind === "preventLethalDamage",
        ),
      )
    ) {
      forceHumanForm(run.player);
      addFx(
        run,
        "burst",
        run.player.x,
        run.player.y,
        92,
        0.6,
        "#d8c58d",
        "perk/journey/last-paper",
      );
      return true;
    }
  }
  run.player.life -= 1;
  run.player.invulnerability = 1.25;
  forceHumanForm(run.player);
  addFx(run, "burst", run.player.x, run.player.y, 76, 0.42, "#a54535", "fx/player-hit");
  dispatchAllOwnersTrigger(run, "onDamageTaken");
  return true;
}

function updateEnemies(run: RunState, delta: number, events: RunEvent[]) {
  for (const enemy of run.enemies) {
    enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
    enemy.marked = Math.max(0, enemy.marked - delta);
    if (enemy.marked === 0) {
      enemy.markMultiplier = 1;
      enemy.markStacks = 0;
    }
    enemy.slow = Math.max(0, enemy.slow - delta);
    enemy.attackCooldown -= delta;
    enemy.motionTime += delta;

    if (stepNianLeap(run, enemy, delta, events)) {
      continue;
    }

    if (enemy.motion === "hurt" && enemy.motionTime > 0.12) {
      enemy.motion = "moving";
      enemy.motionTime = 0;
    }

    const distanceToPlayer = Math.sqrt(distanceSquared(enemy.x, enemy.y, run.player.x, run.player.y));
    const attackRange = enemy.radius + 24;
    const isBossSkill = enemy.boss && enemy.attackCooldown <= 0 && distanceToPlayer < 430;
    const isContactAttack = !enemy.boss && enemy.attackCooldown <= 0 && distanceToPlayer < attackRange + 18;
    if (enemy.motion !== "attacking" && (isBossSkill || isContactAttack)) {
      if (
        enemy.type === "nian" &&
        isBossSkill &&
        enemy.skillIndex % 3 === 0
      ) {
        beginNianLeap(run, enemy);
        continue;
      }
      enemy.motion = "attacking";
      enemy.motionTime = 0;
      enemy.attackCommitted = false;
      enemy.vx *= 0.16;
      enemy.vy *= 0.16;
    }

    if (enemy.motion === "attacking") {
      const commitAt = enemy.boss ? 0.82 : 0.28;
      const finishAt = enemy.boss ? 1.32 : 0.58;
      if (!enemy.attackCommitted && enemy.motionTime >= commitAt) {
        enemy.attackCommitted = true;
        if (enemy.boss) {
          executeBossSkill(run, enemy);
          enemy.skillIndex += 1;
        } else if (distanceToPlayer < attackRange + 24 && hurtPlayer(run)) {
          events.push({ type: "playerHit" });
        }
      }
      if (enemy.motionTime >= finishAt) {
        enemy.motion = "moving";
        enemy.motionTime = 0;
        enemy.attackCooldown = enemy.boss ? 3.5 : 0.85;
      }
      continue;
    }

    const targetAngle = Math.atan2(run.player.y - enemy.y, run.player.x - enemy.x);
    const turnDelta = clamp(normalizeAngle(targetAngle - enemy.heading), -enemy.turnSpeed * delta, enemy.turnSpeed * delta);
    enemy.heading = normalizeAngle(enemy.heading + turnDelta);
    const separation = applySeparation(run, enemy);
    const fishCurve = enemy.type === "fish" ? Math.sin(run.elapsed * 2.6 + enemy.id) * 0.34 : 0;
    const desiredAngle = enemy.heading + fishCurve;
    const slowScale = enemy.slow > 0 ? 0.72 : 1;
    const desiredX = Math.cos(desiredAngle) * enemy.speed * slowScale + separation.x * 42;
    const desiredY = Math.sin(desiredAngle) * enemy.speed * slowScale + separation.y * 42;
    const response = 1 - Math.exp(-delta * (enemy.type === "fish" ? 3.2 : 5.4));
    enemy.vx += (desiredX - enemy.vx) * response;
    enemy.vy += (desiredY - enemy.vy) * response;
    const moveX = enemy.vx * delta;
    const moveY = enemy.vy * delta;
    enemy.x += moveX;
    enemy.y += moveY;
    enemy.travelled += Math.hypot(moveX, moveY);
    if (Math.hypot(enemy.vx, enemy.vy) > 4) enemy.heading = Math.atan2(enemy.vy, enemy.vx);
  }
}

function updateProjectiles(run: RunState, delta: number) {
  for (const projectile of run.projectiles) {
    if ((projectile.spawnDelay ?? 0) > 0) {
      projectile.spawnDelay = Math.max(0, (projectile.spawnDelay ?? 0) - delta);
      continue;
    }
    projectile.life -= delta;
    for (const [enemyId, until] of projectile.hitAt) {
      if (until <= run.elapsed) projectile.hitAt.delete(enemyId);
    }
    if (projectile.homing > 0) {
      const target = run.enemies.find((enemy) => enemy.id === projectile.targetId && enemy.hp > 0) ?? pickNearest(run, projectile.x, projectile.y);
      if (target) {
        projectile.targetId = target.id;
        const desired = normalized(target.x - projectile.x, target.y - projectile.y);
        const speed = Math.hypot(projectile.vx, projectile.vy);
        const blend = clamp(projectile.homing * delta * 5, 0, 1);
        projectile.vx += (desired.x * speed - projectile.vx) * blend;
        projectile.vy += (desired.y * speed - projectile.vy) * blend;
      }
    }
    projectile.x += projectile.vx * delta;
    projectile.y += projectile.vy * delta;
    const travelFromPlayer = Math.sqrt(
      distanceSquared(
        projectile.x,
        projectile.y,
        run.player.x,
        run.player.y,
      ),
    );
    if (
      !projectile.windTouched &&
      travelFromPlayer >= 76 &&
      hasEndlessPerk(run, "windDeflectShot") &&
      ownedWeaponIds(run).includes("fan")
    ) {
      projectile.windTouched = true;
      dispatchEndlessPerkEvent(
        run,
        {
          type: "projectileCrossedWind",
          weaponId: directWeaponOwner(projectile.owner),
        },
        { projectile },
      );
    }
    if (
      !projectile.weatherTouched &&
      travelFromPlayer >= 112 &&
      hasEndlessPerk(run, "summerWindShot")
    ) {
      projectile.weatherTouched = true;
      dispatchEndlessPerkEvent(
        run,
        {
          type: "projectileCrossedWeather",
          weaponId: directWeaponOwner(projectile.owner),
        },
        { projectile },
      );
    }
    for (const enemy of run.enemies) {
      if (enemy.hp <= 0 || projectile.hitAt.has(enemy.id)) continue;
      if (distanceSquared(projectile.x, projectile.y, enemy.x, enemy.y) <= (projectile.radius + enemy.radius) ** 2) {
        if (projectile.markSeconds > 0) enemy.marked = Math.max(enemy.marked, projectile.markSeconds);
        if (projectile.markSeconds > 0) {
          enemy.markMultiplier = Math.max(enemy.markMultiplier, 1.16);
          enemy.markStacks = Math.max(enemy.markStacks, 1);
        }
        damageEnemy(
          run,
          enemy,
          projectile.damage,
          projectile.owner,
          projectile.canProc !== false,
        );
        projectile.hitAt.set(enemy.id, run.elapsed + projectile.hitCooldown);
        projectile.pierce -= 1;
        if (projectile.pierce < 0) {
          projectile.life = 0;
          break;
        }
      }
    }
  }
  run.projectiles = run.projectiles.filter((projectile) =>
    projectile.life > 0 &&
    projectile.x > -140 && projectile.x < GAME_WIDTH + 140 &&
    projectile.y > -140 && projectile.y < GAME_HEIGHT + 140
  ).slice(-460);
}

function updateZones(run: RunState, delta: number) {
  for (const zone of run.zones) {
    zone.life -= delta;
    zone.tick -= delta;
    if (zone.followsPlayer) {
      zone.x = run.player.x;
      zone.y = run.player.y;
    }
    const insideNow = new Set<number>();
    for (const enemy of run.enemies) {
      if (
        enemy.hp > 0 &&
        distanceSquared(zone.x, zone.y, enemy.x, enemy.y) <=
          (zone.radius + enemy.radius) ** 2
      ) {
        insideNow.add(enemy.id);
        if (!zone.enteredEnemyIds.has(enemy.id)) {
          dispatchEndlessPerkEvent(
            run,
            {
              type: "enemyEnteredZone",
              weaponId: directWeaponOwner(zone.owner),
              targetId: enemy.id,
            },
            { target: enemy, zone },
          );
        }
      }
    }
    zone.enteredEnemyIds = insideNow;
    if (zone.tick <= 0) {
      zone.tick += zone.tickRate;
      let firstHit: Enemy | undefined;
      for (const enemy of run.enemies) {
        if (enemy.hp > 0 && distanceSquared(zone.x, zone.y, enemy.x, enemy.y) <= (zone.radius + enemy.radius) ** 2) {
          firstHit ??= enemy;
          damageEnemy(
            run,
            enemy,
            zone.damagePerSecond * zone.tickRate,
            zone.owner,
            zone.canProc === true,
          );
          if (zone.slow > 0) enemy.slow = Math.max(enemy.slow, zone.tickRate * 2);
        }
      }
      if (firstHit) {
        dispatchEndlessPerkEvent(
          run,
          {
            type: "zoneHit",
            weaponId: directWeaponOwner(zone.owner),
            targetId: firstHit.id,
          },
          { target: firstHit, zone },
        );
      }
    }
  }
  run.zones = run.zones.filter((zone) => zone.life > 0).slice(-36);
}

function updateSummons(run: RunState, delta: number) {
  const assignedTargets = new Map<number, number>();
  for (const summon of run.summons) {
    if (summon.targetId === undefined) continue;
    assignedTargets.set(
      summon.targetId,
      (assignedTargets.get(summon.targetId) ?? 0) + 1,
    );
  }

  const chooseTarget = (summon: Summon) => {
    const current =
      summon.targetId === undefined
        ? undefined
        : run.enemies.find(
            (enemy) => enemy.id === summon.targetId && enemy.hp > 0,
          );
    if (current && summon.retargetClock > 0) return current;
    const candidates = run.enemies.filter((enemy) => enemy.hp > 0);
    const selected = candidates.sort((left, right) => {
      const leftLoad = assignedTargets.get(left.id) ?? 0;
      const rightLoad = assignedTargets.get(right.id) ?? 0;
      const leftScore =
        distanceSquared(summon.x, summon.y, left.x, left.y) +
        leftLoad * 160 ** 2;
      const rightScore =
        distanceSquared(summon.x, summon.y, right.x, right.y) +
        rightLoad * 160 ** 2;
      return leftScore - rightScore || left.id - right.id;
    })[0];
    if (summon.targetId !== selected?.id) {
      if (summon.targetId !== undefined) {
        assignedTargets.set(
          summon.targetId,
          Math.max(0, (assignedTargets.get(summon.targetId) ?? 1) - 1),
        );
      }
      summon.targetId = selected?.id;
      if (selected) {
        assignedTargets.set(
          selected.id,
          (assignedTargets.get(selected.id) ?? 0) + 1,
        );
      }
    }
    summon.retargetClock = 0.42 + summon.formationSlot * 0.025;
    return selected;
  };

  for (const summon of run.summons) {
    const beforeLife = summon.life;
    summon.life -= delta;
    if (
      beforeLife > 0 &&
      summon.life <= 0 &&
      directWeaponOwner(summon.owner) === "lantern"
    ) {
      dispatchEndlessPerkEvent(
        run,
        { type: "summonExpired", weaponId: "lantern" },
        { summon },
      );
      continue;
    }
    summon.cooldown -= delta;
    summon.retargetClock -= delta;
    const target = chooseTarget(summon);
    let desiredX: number;
    let desiredY: number;
    if (target) {
      const group = run.summons.filter(
        (candidate) =>
          candidate.owner === summon.owner &&
          candidate.artKey === summon.artKey,
      );
      const slotCount = Math.max(1, group.length);
      const slot =
        group.findIndex((candidate) => candidate.id === summon.id) -
        (slotCount - 1) / 2;
      const facingPlayer = Math.atan2(
        run.player.y - target.y,
        run.player.x - target.x,
      );
      const formationAngle = facingPlayer + slot * 0.62;
      const formationRadius = Math.max(58, target.radius + 44);
      desiredX = target.x + Math.cos(formationAngle) * formationRadius;
      desiredY = target.y + Math.sin(formationAngle) * formationRadius;
    } else {
      const idleAngle =
        run.elapsed * (0.32 + summon.moveSpeed / 300) +
        (Math.PI * 2 * summon.formationSlot) / Math.max(1, summon.total);
      desiredX = run.player.x + Math.cos(idleAngle) * (108 + summon.index * 7);
      desiredY =
        run.player.y + Math.sin(idleAngle) * (74 + summon.index * 4);
    }

    let separationX = 0;
    let separationY = 0;
    for (const other of run.summons) {
      if (other === summon || other.life <= 0) continue;
      const dx = summon.x - other.x;
      const dy = summon.y - other.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance < 28) {
        const strength = (28 - distance) / 28;
        separationX += (dx / distance) * strength * 34;
        separationY += (dy / distance) * strength * 34;
      }
    }
    const toDesiredX = desiredX - summon.x;
    const toDesiredY = desiredY - summon.y;
    const desiredDistance = Math.hypot(toDesiredX, toDesiredY);
    const travel =
      desiredDistance > 0
        ? Math.min(desiredDistance, summon.moveSpeed * delta)
        : 0;
    const targetVx =
      (desiredDistance > 0 ? (toDesiredX / desiredDistance) * travel / Math.max(delta, 0.001) : 0) +
      separationX;
    const targetVy =
      (desiredDistance > 0 ? (toDesiredY / desiredDistance) * travel / Math.max(delta, 0.001) : 0) +
      separationY;
    const response = 1 - Math.exp(-delta * 10);
    summon.vx += (targetVx - summon.vx) * response;
    summon.vy += (targetVy - summon.vy) * response;
    summon.x += summon.vx * delta;
    summon.y += summon.vy * delta;
    summon.angle = Math.atan2(
      summon.y - run.player.y,
      summon.x - run.player.x,
    );
    summon.radius = Math.hypot(
      summon.x - run.player.x,
      summon.y - run.player.y,
    );

    if (summon.cooldown <= 0) {
      if (target) {
        const direction = normalized(
          target.x - summon.x,
          target.y - summon.y,
        );
        run.projectiles.push({
          id: nextId(run),
          owner: summon.owner,
          artKey: `summon-shot/${summon.artKey}`,
          tags: ["shadow"],
          x: summon.x,
          y: summon.y,
          vx: direction.x * 610,
          vy: direction.y * 610,
          radius: 8,
          damage: summon.attackDamage,
          life: 1.8,
          pierce: 1,
          homing: 0.12,
          targetId: target.id,
          markSeconds: 0,
          hitCooldown: 0.18,
          hitAt: new Map(),
          canProc: summon.canProc,
        });
      }
      summon.cooldown += summon.attackCooldown;
    }
  }
  run.summons = run.summons.filter((summon) => summon.life > 0).slice(-24);
}

function updateStrikes(run: RunState, delta: number, events: RunEvent[]) {
  for (const strike of run.strikes) {
    strike.delay -= delta;
    if (strike.delay > 0) continue;
    if (strike.hostile) {
      if (
        distanceSquared(strike.x, strike.y, run.player.x, run.player.y) <=
        (strike.radius + 18) ** 2 &&
        hurtPlayer(run)
      ) events.push({ type: "playerHit" });
    } else {
      for (const enemy of run.enemies) {
        if (enemy.hp > 0 && distanceSquared(strike.x, strike.y, enemy.x, enemy.y) <= (strike.radius + enemy.radius) ** 2) {
          damageEnemy(
            run,
            enemy,
            strike.damage,
            strike.owner,
            strike.canProc !== false,
          );
        }
      }
    }
    addFx(run, "burst", strike.x, strike.y, strike.radius, 0.48, strike.hostile ? "#742f32" : ownerColor(strike.owner), strike.artKey, {
      owner: strike.hostile ? undefined : strike.owner,
    });
  }
  run.strikes = run.strikes.filter((strike) => strike.delay > 0).slice(-80);
}

function experienceTier(value: number): 1 | 2 | 3 {
  return value >= 8 ? 3 : value >= 3 ? 2 : 1;
}

function addExperiencePickup(
  run: RunState,
  x: number,
  y: number,
  value: number,
): Pickup {
  const pickup: Pickup = {
    id: nextId(run),
    x,
    y,
    value,
    age: 0,
    tier: experienceTier(value),
    kind: "experience",
  };
  run.pickups.push(pickup);
  dispatchEndlessPerkEvent(
    run,
    { type: "pickupCreated", value },
    { pickup },
  );
  return pickup;
}

function mergeExperience(run: RunState) {
  const mergeBoost = run.pickups.reduce(
    (best, pickup) => Math.max(best, pickup.mergeMultiplier ?? 1),
    1,
  );
  if (run.pickups.length < Math.ceil(92 / mergeBoost)) return;
  const low = run.pickups
    .filter(
      (pickup) =>
        pickup.kind !== "healingLeaf" && pickup.value <= 2,
    )
    .slice(0, Math.max(8, Math.ceil(18 / mergeBoost)));
  if (low.length < Math.max(4, Math.ceil(8 / mergeBoost))) return;
  const total = low.reduce((sum, pickup) => sum + pickup.value, 0);
  const x = low.reduce((sum, pickup) => sum + pickup.x, 0) / low.length;
  const y = low.reduce((sum, pickup) => sum + pickup.y, 0) / low.length;
  const removed = new Set(low.map((pickup) => pickup.id));
  run.pickups = run.pickups.filter((pickup) => !removed.has(pickup.id));
  addExperiencePickup(run, x, y, total);
}

function removeDead(run: RunState, events: RunEvent[]) {
  const living: Enemy[] = [];
  const killedThisFrame: Enemy[] = [];
  const createdPickupIds: number[] = [];
  for (const enemy of run.enemies) {
    if (enemy.hp > 0) {
      living.push(enemy);
      continue;
    }
    const dead = { ...enemy, motion: "dead" as const, motionTime: 0 };
    run.deaths.push({ enemy: dead, life: 0.72 });
    run.kills += 1;
    killedThisFrame.push(enemy);
    run.score += enemy.bossTier === "final" ? 3200 : enemy.bossTier === "mid" ? 1400 : enemy.elite ? 520 : 20;
    addFx(run, "ink", enemy.x, enemy.y, enemy.radius * 1.7, enemy.boss ? 0.85 : 0.42, enemy.boss ? "#a54535" : "#302f2b", "fx/enemy-death");
    if (enemy.lastHitOwner) {
      dispatchOwnerTrigger(run, enemy.lastHitOwner, "onKill", enemy);
      const sourceWeapon = directWeaponOwner(enemy.lastHitOwner);
      if (sourceWeapon) {
        dispatchSynergyEvent(run, "weaponKill", sourceWeapon, enemy);
        if (sourceWeapon === "sword" && enemy.marked > 0) {
          dispatchEndlessPerkEvent(
            run,
            {
              type: "markedTargetKilled",
              weaponId: "sword",
              targetId: enemy.id,
            },
            { target: enemy },
          );
        }
      }
    }

    if (enemy.intrusionAvatar && run.weave) {
      run.weave = damageCelestialIntrusion(run.weave, Number.MAX_SAFE_INTEGER);
      run.intrusionAvatarId = undefined;
      events.push({ type: "celestialReady" });
    }

    if (!enemy.boss && !enemy.intrusionAvatar) {
      const value = enemy.elite ? 12 : random(run) < 0.13 ? 3 : 1;
      const pickup = addExperiencePickup(
        run,
        enemy.x + randomRange(run, -14, 14),
        enemy.y + randomRange(run, -14, 14),
        value,
      );
      createdPickupIds.push(pickup.id);
    }
    if (enemy.bossTier === "mid") {
      run.currentBoss = null;
      if (run.endless) {
        grantForgeOpportunity(run, events);
      } else {
        run.pendingRareChoice = true;
        events.push({ type: "midBoss" });
      }
    }
    if (enemy.bossTier === "final") {
      run.currentBoss = null;
      if (run.endless) grantForgeOpportunity(run, events);
      else events.push({ type: "finalBoss" });
    }
  }
  run.enemies = living;
  const ordinaryKills = killedThisFrame.filter(
    (enemy) => !enemy.boss && !enemy.intrusionAvatar,
  );
  if (ordinaryKills.length >= 3) {
    dispatchEndlessPerkEvent(
      run,
      { type: "multiKill", value: ordinaryKills.length },
      {
        killedEnemies: ordinaryKills,
        pickupIds: createdPickupIds,
      },
    );
  }
  mergeExperience(run);
}

function updatePickups(run: RunState, delta: number, events: RunEvent[]) {
  for (const pickup of run.pickups) {
    pickup.age += delta;
    const distance = Math.sqrt(distanceSquared(pickup.x, pickup.y, run.player.x, run.player.y));
    const magnet = Math.max(
      150 * run.player.magnetMultiplier,
      pickup.magnetRadius ?? 0,
    );
    if (distance < magnet) {
      const direction = normalized(run.player.x - pickup.x, run.player.y - pickup.y);
      const pull = 150 + (magnet - distance) * 4.6;
      pickup.x += direction.x * pull * delta;
      pickup.y += direction.y * pull * delta;
    }
    if (distance < 25) {
      const collectedValue = pickup.value;
      if (pickup.kind === "healingLeaf") {
        run.player.life = Math.min(
          run.player.maxLife,
          run.player.life + pickup.value,
        );
      } else {
        run.player.xp += pickup.value;
      }
      pickup.value = 0;
      events.push({ type: "pickup" });
      if (pickup.tier === 3 && pickup.kind !== "healingLeaf") {
        dispatchEndlessPerkEvent(run, {
          type: "highTierPickupCollected",
          value: collectedValue,
        });
      }
    }
  }
  run.pickups = run.pickups.filter((pickup) => pickup.value > 0);
}

function updateFx(run: RunState, delta: number) {
  for (const fx of run.fx) fx.life -= delta;
  for (const actor of run.deaths) {
    actor.life -= delta;
    actor.enemy.motionTime += delta;
  }
  run.fx = run.fx.filter((fx) => fx.life > 0).slice(-260);
  run.deaths = run.deaths.filter((actor) => actor.life > 0).slice(-36);
  run.terminalLabelLife = Math.max(0, run.terminalLabelLife - delta);
}

function wrappedNodeIndex(index: number, length: number) {
  return ((index % length) + length) % length;
}

function fireWeaveNode(
  run: RunState,
  node: WeaveNode,
  damageScale = 1,
) {
  const owner: ProjectileOwner = node.kind === "fusion"
    ? `fusion:${node.sourceId}`
    : `weave:${node.instanceId}`;
  for (const effect of node.passEffects) {
    fireEffect(
      run,
      effect,
      owner,
      undefined,
      damageScale,
      false,
    );
  }
}

function beginPerkedWeaveCycle(
  run: RunState,
  preserveNextNodeScale = false,
) {
  if (!run.weave || run.weave.nodes.length === 0) return;
  const combat = run.perkCombat;
  const carriedScale = preserveNextNodeScale
    ? combat.weaveNextNodeScale
    : 1;
  combat.weaveCycleInitialized = true;
  combat.weaveCycleStartIndex = wrappedNodeIndex(
    run.weave.pulse.nodeIndex,
    run.weave.nodes.length,
  );
  combat.weaveDirection = 1;
  combat.weaveCounterScale = 0;
  combat.weaveCycleScale = hasEndlessPerk(run, "slowHeavyFinish")
    ? 1.4
    : 1;
  combat.weaveFinishScale = 1;
  combat.weaveRepeatFirst = 0;
  combat.weaveFirstPassed = false;
  combat.weaveNextNodeScale = carriedScale;
  dispatchEndlessPerkEvent(run, { type: "weaveCycleStarted" });
  combat.weaveCounterIndex = wrappedNodeIndex(
    combat.weaveCycleStartIndex - combat.weaveDirection,
    run.weave.nodes.length,
  );
}

function orderedWeaveForDirection(
  run: RunState,
): readonly WeaveNode[] {
  if (!run.weave) return [];
  const nodes: WeaveNode[] = [];
  for (let offset = 0; offset < run.weave.nodes.length; offset += 1) {
    nodes.push(
      run.weave.nodes[
        wrappedNodeIndex(
          run.perkCombat.weaveCycleStartIndex +
            offset * run.perkCombat.weaveDirection,
          run.weave.nodes.length,
        )
      ],
    );
  }
  return nodes;
}

function stepPendingPerkReplays(run: RunState, delta: number) {
  const pending: PendingPerkReplay[] = [];
  for (const replay of run.perkCombat.pendingFinishReplays) {
    const delay = replay.delay - delta;
    if (delay > 0) {
      pending.push({ ...replay, delay });
      continue;
    }
    for (const effect of replay.effects) {
      fireEffect(
        run,
        effect,
        "terminal",
        undefined,
        replay.damageScale,
        false,
      );
    }
    addFx(
      run,
      "terminal",
      run.player.x,
      run.player.y,
      240,
      0.8,
      "#8f5146",
      "perk/weave/replay-finish",
    );
  }
  run.perkCombat.pendingFinishReplays = pending;
}

function advancePerkedWeave(
  run: RunState,
  delta: number,
  events: RunEvent[],
) {
  if (!run.weave || run.weave.nodes.length === 0) return;
  if (!run.perkCombat.weaveCycleInitialized) {
    beginPerkedWeaveCycle(run);
  }
  const nodeCount = run.weave.nodes.length;
  const baseTerminal = deriveWeaveTerminal(run.weave);
  const secondsPerNode =
    (baseTerminal.chargeSeconds * run.perkCombat.weaveCycleScale) /
    nodeCount;
  let nodeIndex = wrappedNodeIndex(run.weave.pulse.nodeIndex, nodeCount);
  let nodeProgress =
    run.weave.pulse.nodeProgress + delta / Math.max(0.01, secondsPerNode);

  while (nodeProgress >= 1) {
    nodeProgress -= 1;
    const node = run.weave.nodes[nodeIndex];
    const nodeScale = run.perkCombat.weaveNextNodeScale;
    run.perkCombat.weaveNextNodeScale = 1;
    fireWeaveNode(run, node, nodeScale);

    if (!run.perkCombat.weaveFirstPassed) {
      run.perkCombat.weaveFirstPassed = true;
      for (
        let repeat = 0;
        repeat < run.perkCombat.weaveRepeatFirst;
        repeat += 1
      ) {
        fireWeaveNode(run, node, 1);
      }
    }

    if (run.perkCombat.weaveCounterScale > 0 && nodeCount > 1) {
      const counterNode =
        run.weave.nodes[run.perkCombat.weaveCounterIndex];
      fireWeaveNode(
        run,
        counterNode,
        run.perkCombat.weaveCounterScale,
      );
      run.perkCombat.weaveCounterIndex = wrappedNodeIndex(
        run.perkCombat.weaveCounterIndex -
          run.perkCombat.weaveDirection,
        nodeCount,
      );
    }

    dispatchEndlessPerkEvent(
      run,
      {
        type: "weaveNodePassed",
        value: Math.max(0, run.weave.maxNodes - nodeCount),
      },
      { node, nodeIndex },
    );

    const nextIndex = wrappedNodeIndex(
      nodeIndex + run.perkCombat.weaveDirection,
      nodeCount,
    );
    const completed =
      nextIndex === run.perkCombat.weaveCycleStartIndex;
    nodeIndex = nextIndex;
    run.weave = {
      ...run.weave,
      pulse: {
        nodeIndex,
        nodeProgress,
        completedCycles:
          run.weave.pulse.completedCycles + (completed ? 1 : 0),
      },
    };

    if (!completed) continue;
    const directedTerminal = deriveWeaveTerminal({
      ...run.weave,
      nodes: orderedWeaveForDirection(run),
    });
    for (const effect of directedTerminal.effects) {
      fireEffect(
        run,
        effect,
        "terminal",
        undefined,
        run.perkCombat.weaveFinishScale,
        false,
      );
    }
    dispatchEndlessPerkEvent(
      run,
      { type: "weaveFinishReleased" },
      { terminal: directedTerminal },
    );
    run.terminalLabel = directedTerminal.name;
    run.terminalLabelLife = 2.1;
    addFx(
      run,
      "terminal",
      run.player.x,
      run.player.y,
      285,
      1.1,
      "#a44338",
      directedTerminal.artKey,
      { label: directedTerminal.name },
    );
    events.push({ type: "terminal", name: directedTerminal.name });
    beginPerkedWeaveCycle(run, true);
    nodeIndex = run.weave.pulse.nodeIndex;
  }

  if (run.weave) {
    run.weave = {
      ...run.weave,
      pulse: {
        nodeIndex,
        nodeProgress,
        completedCycles: run.weave.pulse.completedCycles,
      },
    };
  }
}

function updateEndless(run: RunState, delta: number, events: RunEvent[]) {
  if (!run.endless || !run.weave) return;

  stepPendingPerkReplays(run, delta);
  advancePerkedWeave(run, delta, events);

  const beforePhase = run.weave.activeIntrusion?.phase;
  run.weave = stepCelestialIntrusion(run.weave, delta);
  let active = run.weave.activeIntrusion;
  if (active?.phase === "expired") {
    const expiredId = active.id;
    if (run.intrusionAvatarId !== undefined) {
      run.enemies = run.enemies.filter(
        (enemy) => enemy.id !== run.intrusionAvatarId,
      );
    }
    run.strikes = run.strikes.filter(
      (strike) =>
        !(
          strike.hostile &&
          strike.artKey.startsWith(`celestial/${expiredId}/`)
        ),
    );
    run.intrusionAvatarId = undefined;
    run.weave = { ...run.weave, activeIntrusion: undefined };
    active = undefined;
  }
  if (beforePhase === "warning" && active?.phase === "active" && run.intrusionAvatarId === undefined) {
    const avatarType: Record<string, EnemyArchetype> = {
      thunderTrial: "lion",
      galeTrial: "rib",
      fireTrial: "lantern",
      frostTrial: "taotie",
      ghostMarch: "puppet",
      eclipseTrial: "nian",
    };
    const avatar = spawnEnemy(run, avatarType[active.id], { intrusion: true });
    run.weave = {
      ...run.weave,
      activeIntrusion: {
        ...active,
        hp: avatar.hp,
        maxHp: avatar.maxHp,
      },
    };
    active = run.weave.activeIntrusion;
  }

  if (run.elapsed >= run.intrusionAt && !run.weave.activeIntrusion) {
    const selected = chooseCelestialIntrusion(run.weave.pulse.completedCycles, run.rng);
    run.rng = selected.rngState;
    run.weave = beginCelestialIntrusion(run.weave, selected.id, 1 + Math.max(0, run.elapsed - STANDARD_SECONDS) / 700, 4.5);
    run.intrusionAt += 120;
    addFx(run, "warning", run.player.x, run.player.y, 230, 1.2, "#6e405d", `celestial/${selected.id}`);
  }

  if (active?.phase === "active") {
    const avatar = run.enemies.find((enemy) => enemy.id === run.intrusionAvatarId);
    if (avatar) {
      run.weave = {
        ...run.weave,
        activeIntrusion: { ...active, hp: avatar.hp, maxHp: avatar.maxHp },
      };
    }
    run.celestialHazardClock -= delta;
    if (run.celestialHazardClock <= 0) {
      run.celestialHazardClock = 2.4;
      run.strikes.push({
        id: nextId(run),
        owner: "terminal",
        artKey: `celestial/${active.id}/hostile`,
        x: clamp(run.player.x + randomRange(run, -130, 130), 60, GAME_WIDTH - 60),
        y: clamp(run.player.y + randomRange(run, -100, 100), 60, GAME_HEIGHT - 60),
        radius: 72,
        damage: 1,
        delay: 1.05,
        maxDelay: 1.05,
        hostile: true,
      });
    }
  }

  if (run.elapsed >= run.forgeAt) {
    run.forgeAt += 120;
    grantForgeOpportunity(run, events);
  }
}

function grantForgeOpportunity(run: RunState, events: RunEvent[]) {
  run.forgeCredits = Math.min(3, run.forgeCredits + 2);
  events.push({ type: "forge" });
}

function resetWeaveCycleRuntime(run: RunState) {
  run.perkCombat.weaveCycleInitialized = false;
  run.perkCombat.weaveNextNodeScale = 1;
  run.perkCombat.weaveRepeatFirst = 0;
  run.perkCombat.weaveFirstPassed = false;
  run.perkCombat.weaveCounterScale = 0;
}

export function startEndless(run: RunState) {
  run.endless = true;
  run.weave = createWeaveState(run.build);
  resetWeaveCycleRuntime(run);
  run.forgeAt = run.elapsed + 120;
  run.forgeCredits = 0;
  run.endlessBossAt = run.elapsed + 240;
  run.endlessBossCount = 0;
  run.intrusionAt = run.elapsed + 70;
  run.terminalLabel = "器盘开始转动";
  run.terminalLabelLife = 2.2;
}

export function insertEndlessWeapon(
  run: RunState,
  weapon: WeaponId | WeaponState,
) {
  if (!run.weave || run.forgeCredits <= 0) return false;
  const result = insertWeaponNode(run.weave, weapon);
  if (!result.ok) return false;
  run.weave = result.state;
  resetWeaveCycleRuntime(run);
  run.forgeCredits -= 1;
  return true;
}

export function swapEndlessNodes(run: RunState, first: number, second: number) {
  if (!run.weave || run.forgeCredits <= 0) return false;
  const swapped = swapWeaveNodes(run.weave, first, second);
  if (swapped === run.weave) return false;
  run.weave = swapped;
  resetWeaveCycleRuntime(run);
  run.forgeCredits -= 1;
  return true;
}

export function fuseEndlessNodesWithName(
  run: RunState,
  first: number,
  second: number,
): string | undefined {
  if (!run.weave || run.forgeCredits <= 0) return;
  const result = fuseAdjacentNodes(run.weave, first, second);
  if (!result.ok) return;
  run.weave = result.state;
  resetWeaveCycleRuntime(run);
  run.forgeCredits -= 1;
  addFx(run, "terminal", run.player.x, run.player.y, 210, 0.9, "#c18b45", `fusion/${result.node.sourceId}`, {
    label: result.node.name,
  });
  return result.node.name;
}

export function captureEndlessCelestial(run: RunState) {
  if (!run.weave) return;
  const result = captureDefeatedIntrusion(run.weave);
  if (!result.ok) return;
  run.weave = result.state;
  resetWeaveCycleRuntime(run);
  return result.node.name;
}

export function availableEndlessWeapons(run: RunState): WeaponId[] {
  if (!run.weave) return [];
  const used = new Set(
    run.weave.nodes
      .filter((node) => node.kind === "weapon")
      .map((node) => node.sourceId as WeaponId),
  );
  return WEAPON_IDS.filter((id) => !used.has(id));
}

function syncSynergySelection(run: RunState, events: RunEvent[]) {
  const eligible = getEligibleSynergies(run.build.weapons);
  const capacity = Math.max(0, Math.floor(run.build.synergyCapacity));
  const signature = synergyQualificationSignature(run);
  if (signature === run.synergyChoiceSignature) return;

  run.synergyChoiceSignature = signature;
  const eligibleIds = eligible.map((synergy) => synergy.definition.id);
  const eligibleIdSet = new Set(eligibleIds);
  const previousActive = new Set(run.activeSynergyIds);

  if (eligible.length <= capacity) {
    run.activeSynergyIds = eligibleIds;
    run.pendingSynergyChoiceIds = [];
    for (const synergy of eligible) {
      if (!previousActive.has(synergy.definition.id)) {
        events.push({ type: "synergy", name: synergy.name });
      }
    }
    return;
  }

  // Keep the player's still-qualified prior picks live while the modal is
  // open. Newly qualified entries never activate by authored array order.
  run.activeSynergyIds = run.activeSynergyIds.filter((id) =>
    eligibleIdSet.has(id)
  );
  run.pendingSynergyChoiceIds = eligibleIds;
  events.push({
    type: "synergyChoice",
    choices: eligible.map(synergyChoiceOption),
    capacity,
    selectedIds: [...run.activeSynergyIds],
  });
}

export function stepRun(run: RunState, deltaSeconds: number, moveInput: MoveInput): RunEvent[] {
  const delta = Math.min(0.034, Math.max(0, deltaSeconds));
  const events: RunEvent[] = [];
  run.elapsed += delta;
  run.player.invulnerability = Math.max(0, run.player.invulnerability - delta);
  run.endlessPerks = stepEndlessPerkState(run.endlessPerks, delta);

  const magnitude = length(moveInput.x, moveInput.y);
  const moving = magnitude > 0.08;
  const direction = moving ? normalized(moveInput.x, moveInput.y) : { x: 0, y: 0 };
  const beforeForm = run.player.formState;
  const beforeProgress = run.player.formProgress;
  const previousMoveX = run.player.lastMoveX;
  const previousMoveY = run.player.lastMoveY;
  const hadPreviousDirection =
    Math.hypot(previousMoveX, previousMoveY) > 0.5;
  const sharpTurn =
    moving &&
    hadPreviousDirection &&
    direction.x * previousMoveX + direction.y * previousMoveY <
      Math.cos((70 * Math.PI) / 180) &&
    beforeProgress > 0.04;
  stepPlayerForm(run.player, moving, direction.x, direction.y, delta);
  if (moving) {
    run.player.facing = Math.atan2(direction.y, direction.x);
    const speed = 205 * run.player.speedMultiplier;
    run.player.x = clamp(run.player.x + direction.x * speed * delta, 34, GAME_WIDTH - 34);
    run.player.y = clamp(run.player.y + direction.y * speed * delta, 42, GAME_HEIGHT - 38);
  }
  if (beforeForm !== run.player.formState) {
    if (run.player.formState === "foldingToPlane") events.push({ type: "fold", folded: true });
    if (run.player.formState === "foldingToHuman") events.push({ type: "fold", folded: false });
    if (run.player.formState === "human") {
      dispatchEndlessPerkEvent(run, {
        type: "formChanged",
        form: "human",
      });
    }
  }
  if (sharpTurn) {
    dispatchEndlessPerkEvent(run, {
      type: "sharpTurn",
      form: "human",
    });
  }
  if (run.player.formState === "plane") {
    run.perkCombat.planeSeconds += delta;
    if (
      run.perkCombat.planeSeconds >= 3 &&
      !run.perkCombat.planeTriggered
    ) {
      run.perkCombat.planeTriggered = true;
      dispatchEndlessPerkEvent(run, {
        type: "formDuration",
        form: "plane",
        value: run.perkCombat.planeSeconds,
      });
    }
  } else {
    run.perkCombat.planeSeconds = 0;
    run.perkCombat.planeTriggered = false;
  }
  if (!moving && run.player.formState === "human") {
    run.perkCombat.idleSeconds += delta;
    if (run.perkCombat.idleSeconds >= 0.8) {
      run.perkCombat.idleHealClock += delta;
      if (run.perkCombat.idleHealClock >= 1) {
        run.perkCombat.idleHealClock -= 1;
        dispatchEndlessPerkEvent(run, {
          type: "idleDuration",
          form: "human",
          value: run.perkCombat.idleSeconds,
        });
      }
    }
  } else {
    run.perkCombat.idleSeconds = 0;
    run.perkCombat.idleHealClock = 0;
  }
  run.lastFormState = run.player.formState;

  const termState = getSolarTermState(run.elapsed, run.endless);
  if (termState.current.index !== run.lastTermIndex) {
    run.lastTermIndex = termState.current.index;
    events.push({ type: "term", name: termState.current.name, ambience: termState.current.ambience });
  }
  dispatchEndlessPerkEvent(run, { type: "interval" });

  updateSpawning(run, delta, events);
  updateActiveEffects(run, delta);
  updateOrbits(run, delta);
  updateProjectiles(run, delta);
  updateZones(run, delta);
  updateSummons(run, delta);
  updateStrikes(run, delta, events);
  updateEnemies(run, delta, events);
  removeDead(run, events);
  updatePickups(run, delta, events);
  updateEndless(run, delta, events);
  updateFx(run, delta);

  syncSynergySelection(run, events);

  if (run.player.xp >= run.player.nextXp) {
    run.player.xp -= run.player.nextXp;
    run.player.level += 1;
    run.player.nextXp = 7 + run.player.level * 4;
    events.push({ type: "upgrade" });
  }
  if (run.player.life <= 0) events.push({ type: "defeat" });
  return events;
}

export function weaponName(id: WeaponId) {
  return getWeaponDefinition(id).name;
}

export type OrbitVisual = {
  owner: ProjectileOwner;
  artKey: string;
  count: number;
  radius: number;
  angularSpeed: number;
  phase: number;
};

export function getOrbitVisuals(run: RunState): OrbitVisual[] {
  const visuals: OrbitVisual[] = [];
  let phase = 0;
  for (const [owner, effects] of effectOwners(run)) {
    for (const effect of effects) {
      if (effect.kind !== "orbit") continue;
      visuals.push({
        owner,
        artKey: effect.visualKey ?? `orbit/${owner}`,
        count: effect.count,
        radius: effect.radius,
        angularSpeed: effect.angularSpeed,
        phase,
      });
      phase += 0.51;
    }
  }
  return visuals;
}
