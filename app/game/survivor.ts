import type { BossTier, EnemyArchetype } from "./art";
import {
  BOSS_TRAIT_IDS,
  ENDLESS_BOSS_IDS,
  getEndlessBoss,
  type BossSkillDefinition,
  type BossTraitId,
  type EndlessBossId,
} from "./content/bosses";
import {
  DIFFICULTY_IDS,
  getDifficultyDefinition,
  nextDifficultyId,
  resolveDifficultyId,
  type DifficultyId,
} from "./content/difficulty";
import {
  BOSS_THREAT_COST,
  ENDLESS_ACTOR_CAP,
  ELITE_THREAT_COST,
  sampleEndlessDifficulty,
  type EndlessDifficultySample,
} from "./content/difficultyCurve";
import {
  COMMON_ENEMY_IDS,
  ELITE_ENEMY_IDS,
  getEnemyDefinition,
  type EnemySkillDefinition,
} from "./content/enemies";
import {
  PLAYER_HIT_RADIUS,
  type EnemyActionPhase,
  type HostileTelegraph,
  type MovementTargetSpec,
} from "./content/movement";
import {
  chooseActiveSynergies as resolveChosenSynergies,
  getSynergyChoices as getEligibleSynergies,
  getWeaponDefinition,
  getWeaponRoute,
  type CombatEventKind,
  type CombatBuild,
  type CelestialIntrusionId,
  type EndlessPerkAction,
  type EffectSpec,
  type EffectTag,
  type EffectTrigger,
  type TravelNoteId,
  resolveTravelNoteEffect,
  getTravelNoteRank,
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
  areAllWeaponsMastered,
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
  hasAvailableTravelNotes,
  insertWeaponNode,
  keepNewestAndRecycleInPlace,
  keepNewestInPlace,
  nextRandom,
  ObjectPool,
  recycleRejectedInPlace,
  retainInPlace,
  resolveWeaponEffects,
  resolveWeaponKit,
  stepEndlessPerkState,
  stepCelestialIntrusion,
  swapWeaveNodes,
  SpatialGrid,
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
export const NIAN_LEAP_TELEGRAPH_SECONDS = 0.68;
export const TAOTIE_CHARGE_TELEGRAPH_SECONDS = 0.82;
export const NIAN_METEOR_TELEGRAPH_SECONDS = 1.5;
export const NIAN_METEOR_SAFE_CORRIDOR = 220;
export const NIAN_RING_SAFE_GAP_DEGREES = 100;
export const BOSS_SKILL_BREATHER_SECONDS = 0.5;

export type {
  EnemyActionPhase,
  HostileTelegraph,
  MovementTargetSpec,
} from "./content/movement";

export type TrialId =
  | "swift"
  | "crowd"
  | "elite"
  | "bossRush"
  | "noRecovery"
  | "thinPower"
  | "allAtOnce";
export type SynergyChoiceOption = {
  id: string;
  name: string;
  description: string;
  weapons: readonly WeaponId[];
  /** Two level-three weapons are always the entry condition. */
  conditionText: string;
  /** The authored combat event and cadence that actually releases the effect. */
  triggerText: string;
  /** A plain-language account of what the current resolved effect does. */
  effectText: string;
  /** Explains whether the currently chosen routes alter this pairing. */
  routeImpactText: string;
};

export type PrimaryWeaponSelection = {
  weaponId: WeaponId;
  assignedBy: "startingWeapon" | "firstNonLantern" | "player";
  assignedAt: number;
};

/**
 * One semantic attack captured at the moment it was performed.  The replay is
 * deliberately made from EffectSpec data rather than from whatever sprite or
 * projectile happens to remain on screen, so beams, waves, chains, fields and
 * summons keep their actual behaviour when the lantern copies them.
 */
export type AttackReplayRecord = {
  owner: ProjectileOwner;
  sourceWeaponId?: WeaponId;
  effects: readonly EffectSpec[];
  targetId?: number;
  aimAngle: number;
  capturedAt: number;
  copyDepth: 0 | 1;
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
  | {
      type: "bossSpawn";
      tier: Exclude<BossTier, null>;
      bossId?: EndlessBossId;
    }
  | {
      type: "difficultyClear";
      difficultyId: DifficultyId;
      unlocks?: DifficultyId;
    }
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
  /** Fixed paper-life stack. Damage consumes from the front; healing refills it. */
  lifeSegments: PlayerLifeSegment[];
};

export type LifeSegmentSource = "initial" | "travelNote" | "utility" | "external";
export type HitReliefKind = "light" | "strong";
export type PlayerLifeSegment = {
  source: LifeSegmentSource;
  relief: HitReliefKind;
  value: number;
};

export type EnemyMotion = "moving" | "attacking" | "hurt" | "dead";

export type NianLeapActionState = {
  kind: "nianLeap";
  phase: EnemyActionPhase;
  elapsed: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  warningFxId?: number;
  hostileTelegraph: HostileTelegraph;
};

export type TaotieChargeActionState = {
  kind: "taotieCharge";
  phase: EnemyActionPhase;
  elapsed: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  committed: boolean;
  playerHitCommitted?: boolean;
  warningFxId?: number;
  hostileTelegraph: HostileTelegraph;
};

export type EnemySkillActionState = {
  kind: "enemySkill";
  skillId: string;
  phase: EnemyActionPhase;
  elapsed: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  committed: boolean;
  playerHitCommitted?: boolean;
  warningFxId?: number;
  partnerId?: number;
  lineX1?: number;
  lineY1?: number;
  lineX2?: number;
  lineY2?: number;
  previousPlayerSide?: number;
  followupCommitted?: boolean;
  /** Paired actors share one authored skill/path slot. */
  slotId: number;
  hostileTelegraph: HostileTelegraph;
};

export type EndlessBossActionState = {
  kind: "endlessBossSkill";
  skillId: string;
  phase: EnemyActionPhase;
  elapsed: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  committed: boolean;
  playerHitCommitted?: boolean;
  warningFxId?: number;
  bossPhase: 1 | 2;
  hostileTelegraph: HostileTelegraph;
};

export type EnemyActionState =
  | NianLeapActionState
  | TaotieChargeActionState
  | EnemySkillActionState
  | EndlessBossActionState;

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
  endlessBossId?: EndlessBossId;
  bossName?: string;
  bossTraits?: readonly BossTraitId[];
  bossPhase?: 1 | 2;
  artKey?: string;
  actionSpeed?: number;
  partnerId?: number;
  patternCycle?: number;
  guardedUntil?: number;
  guardFacing?: number;
  ralliedUntil?: number;
  celestialSourceId?: CelestialIntrusionId;
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
  velocityX?: number;
  velocityY?: number;
  contactOnly?: boolean;
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

export type EndlessDirectorState = {
  startedAt: number;
  nonBossThreatBudget: number;
  bossBudget: number;
  totalThreatSpent: number;
  commonSpawned: number;
  eliteSpawned: number;
  bossesSpawned: number;
  recentBossIds: EndlessBossId[];
  nextBossId: EndlessBossId;
  pendingBossSlot: boolean;
  lastSample: EndlessDifficultySample;
};

export type RunState = {
  elapsed: number;
  endless: boolean;
  score: number;
  kills: number;
  /** Experience pages earned after every context-valid travel note is full. */
  surplusPages: number;
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
  difficultyId: DifficultyId;
  difficultyUnlockCandidate?: DifficultyId;
  difficultyClearEligible: boolean;
  endlessDirector?: EndlessDirectorState;
  primaryWeapon?: PrimaryWeaponSelection;
  attackReplays: Map<ProjectileOwner, AttackReplayRecord>;
  /** Ordinary enemies cannot begin a skill until this Boss recovery window ends. */
  enemySkillBreatherUntil: number;
  lastHitRelief?: HitReliefKind;
};

export type TestModifiers = {
  timeScale: 1 | 2 | 4 | 8;
  incomingDamageScale: 0 | 1;
  assisted: boolean;
};

type ProjectileSeed = Omit<Projectile, "hitAt">;
type ZoneSeed = Omit<Zone, "enteredEnemyIds">;
type SummonSeed = Summon;
type DeathActorSeed = DeathActor;

type CombatObjectPools = {
  projectiles: ObjectPool<Projectile, ProjectileSeed>;
  zones: ObjectPool<Zone, ZoneSeed>;
  summons: ObjectPool<Summon, SummonSeed>;
  deaths: ObjectPool<DeathActor, DeathActorSeed>;
};

const RUN_OBJECT_POOLS = new WeakMap<RunState, CombatObjectPools>();
const ZONE_INSIDE_SCRATCH = new Set<number>();

function createCombatObjectPools(): CombatObjectPools {
  const projectiles = new ObjectPool<Projectile, ProjectileSeed>(
    () => ({
      id: 0,
      owner: "terminal",
      artKey: "",
      tags: [],
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 0,
      damage: 0,
      life: 0,
      pierce: 0,
      homing: 0,
      markSeconds: 0,
      hitCooldown: 0,
      hitAt: new Map(),
    }),
    (value, seed) => {
      value.hitAt.clear();
      value.targetId = undefined;
      value.canProc = undefined;
      value.spawnDelay = undefined;
      value.windTouched = undefined;
      value.weatherTouched = undefined;
      Object.assign(value, seed);
    },
    520,
    (value) => {
      value.hitAt.clear();
      value.targetId = undefined;
      value.canProc = undefined;
      value.spawnDelay = undefined;
      value.windTouched = undefined;
      value.weatherTouched = undefined;
    },
  );
  const zones = new ObjectPool<Zone, ZoneSeed>(
    () => ({
      id: 0,
      owner: "terminal",
      artKey: "",
      x: 0,
      y: 0,
      radius: 0,
      damagePerSecond: 0,
      life: 0,
      maxLife: 0,
      tick: 0,
      tickRate: 0,
      followsPlayer: false,
      slow: 0,
      enteredEnemyIds: new Set(),
    }),
    (value, seed) => {
      value.enteredEnemyIds.clear();
      value.canProc = undefined;
      Object.assign(value, seed);
    },
    48,
    (value) => {
      value.enteredEnemyIds.clear();
      value.canProc = undefined;
    },
  );
  const summons = new ObjectPool<Summon, SummonSeed>(
    () => ({
      id: 0,
      owner: "terminal",
      artKey: "",
      angle: 0,
      radius: 0,
      life: 0,
      attackDamage: 0,
      attackCooldown: 0,
      cooldown: 0,
      index: 0,
      total: 0,
      moveSpeed: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      formationSlot: 0,
      retargetClock: 0,
    }),
    (value, seed) => {
      value.targetId = undefined;
      value.canProc = undefined;
      Object.assign(value, seed);
    },
    36,
    (value) => {
      value.targetId = undefined;
      value.canProc = undefined;
    },
  );
  const deaths = new ObjectPool<DeathActor, DeathActorSeed>(
    () => ({ enemy: undefined as unknown as Enemy, life: 0 }),
    (value, seed) => Object.assign(value, seed),
    48,
    (value) => {
      value.enemy = undefined as unknown as Enemy;
      value.life = 0;
    },
  );
  return { projectiles, zones, summons, deaths };
}

function objectPools(run: RunState): CombatObjectPools {
  let pools = RUN_OBJECT_POOLS.get(run);
  if (!pools) {
    pools = createCombatObjectPools();
    RUN_OBJECT_POOLS.set(run, pools);
  }
  return pools;
}

function pushProjectile(run: RunState, seed: ProjectileSeed): Projectile {
  const projectile = objectPools(run).projectiles.acquire(seed);
  run.projectiles.push(projectile);
  return projectile;
}

function pushZone(run: RunState, seed: ZoneSeed): Zone {
  const zone = objectPools(run).zones.acquire(seed);
  run.zones.push(zone);
  return zone;
}

function pushSummon(run: RunState, seed: SummonSeed): Summon {
  const summon = objectPools(run).summons.acquire(seed);
  run.summons.push(summon);
  return summon;
}

function pushDeathActor(run: RunState, seed: DeathActorSeed): DeathActor {
  const actor = objectPools(run).deaths.acquire(seed);
  run.deaths.push(actor);
  return actor;
}

export function combatPoolStatsForTest(run: RunState) {
  const pools = objectPools(run);
  return {
    projectiles: pools.projectiles.available,
    zones: pools.zones.available,
    summons: pools.summons.available,
    deaths: pools.deaths.available,
  };
}

export type CreateRunOptions = {
  initialWeaponId?: WeaponId | "random";
  unlockedWeaponIds?: readonly WeaponId[];
  difficultyId?: DifficultyId;
  unlockedDifficultyIds?: readonly DifficultyId[];
};

export type RunSnapshot = {
  elapsed: number;
  endless: boolean;
  score: number;
  kills: number;
  surplusPages?: number;
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
  difficultyId?: DifficultyId;
  primaryWeaponId?: WeaponId;
  primaryWeaponValid: boolean;
  availablePrimaryWeaponIds: readonly WeaponId[];
  primaryWeaponRule: string;
  travelNotes: Readonly<Partial<Record<TravelNoteId, number>>>;
  travelNoteRepeatEnabled: Readonly<Partial<Record<TravelNoteId, boolean>>>;
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

function difficultyFor(run: Pick<RunState, "difficultyId">) {
  return getDifficultyDefinition(run.difficultyId ?? "normal");
}

function recoveryFor(run: Pick<RunState, "difficultyId" | "trials">) {
  if (run.trials.has("noRecovery")) return 0;
  return difficultyFor(run).recoveryMultiplier;
}

export type CombatPressureProfile = {
  spawnRateMultiplier: number;
  enemySkillSlots: number;
  enemyDashSlots: number;
  hostileAttackCap: number;
  bossBackgroundMultiplier: number;
  behaviorDifficultyId: DifficultyId;
};

/**
 * Resolves only encounter-coordination pressure. `allAtOnce` deliberately does
 * not alter health, damage, rewards, refresh cadence or Boss density.
 */
export function getCombatPressureProfile(
  run: Pick<RunState, "difficultyId" | "trials">,
): CombatPressureProfile {
  const base = difficultyFor(run);
  const baseIndex = DIFFICULTY_IDS.indexOf(run.difficultyId);
  const behaviorDifficultyId = run.trials.has("allAtOnce")
    ? DIFFICULTY_IDS[Math.min(DIFFICULTY_IDS.length - 1, baseIndex + 1)]
    : run.difficultyId;
  const behavior = getDifficultyDefinition(behaviorDifficultyId);
  return {
    spawnRateMultiplier: base.threatMultiplier,
    enemySkillSlots:
      base.enemySkillSlots + (run.trials.has("allAtOnce") ? 2 : 0),
    enemyDashSlots: behavior.enemyDashSlots,
    hostileAttackCap: behavior.hostileAttackCap,
    bossBackgroundMultiplier: base.bossBackgroundMultiplier,
    behaviorDifficultyId,
  };
}

function createInitialLifeSegments(count: number): PlayerLifeSegment[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => ({
    source: "initial" as const,
    relief: index < 3 ? "light" as const : "strong" as const,
    value: 1,
  }));
}

function lifeSegmentValue(player: Player) {
  return player.lifeSegments.reduce(
    (sum, segment) => sum + clamp(segment.value, 0, 1),
    0,
  );
}

/** Keeps test/imported scalar mutations compatible without retyping live segments. */
function reconcileLifeSegments(player: Player) {
  const expectedLength = Math.max(0, Math.floor(player.maxLife));
  while (player.lifeSegments.length < expectedLength) {
    player.lifeSegments.push({
      source: "external",
      relief: "light",
      value: 1,
    });
  }
  if (player.lifeSegments.length > expectedLength) {
    player.lifeSegments.length = expectedLength;
  }
  const target = clamp(player.life, 0, expectedLength);
  if (Math.abs(lifeSegmentValue(player) - target) <= 0.000001) return;
  let remaining = target;
  for (let index = player.lifeSegments.length - 1; index >= 0; index -= 1) {
    const value = Math.min(1, remaining);
    player.lifeSegments[index].value = value;
    remaining -= value;
  }
}

function syncLifeScalars(player: Player) {
  player.maxLife = player.lifeSegments.length;
  player.life = lifeSegmentValue(player);
}

function healPlayer(run: RunState, amount: number) {
  if (amount <= 0) return 0;
  reconcileLifeSegments(run.player);
  let remaining = amount;
  let restored = 0;
  // Lost segments form a prefix. Refill the deepest missing segment first so
  // the next loss follows the original stack order and source type.
  for (
    let index = run.player.lifeSegments.length - 1;
    index >= 0 && remaining > 0;
    index -= 1
  ) {
    const segment = run.player.lifeSegments[index];
    const fill = Math.min(1 - segment.value, remaining);
    if (fill <= 0) continue;
    segment.value += fill;
    restored += fill;
    remaining -= fill;
  }
  syncLifeScalars(run.player);
  return restored;
}

function addPlayerLifeSegment(
  run: RunState,
  source: Exclude<LifeSegmentSource, "initial" | "external">,
  restoredValue: number,
) {
  reconcileLifeSegments(run.player);
  run.player.lifeSegments.unshift({
    source,
    relief: "light",
    value: clamp(restoredValue, 0, 1),
  });
  syncLifeScalars(run.player);
}

function damagePlayerLifeSegments(
  run: RunState,
  amount: number,
): { damage: number; relief?: HitReliefKind } {
  reconcileLifeSegments(run.player);
  let remaining = Math.min(Math.max(0, amount), run.player.life);
  let applied = 0;
  let relief: HitReliefKind | undefined;
  for (const segment of run.player.lifeSegments) {
    if (remaining <= 0) break;
    const taken = Math.min(segment.value, remaining);
    if (taken <= 0) continue;
    segment.value -= taken;
    remaining -= taken;
    applied += taken;
    if (segment.relief === "strong") relief = "strong";
    else relief ??= "light";
  }
  syncLifeScalars(run.player);
  return { damage: applied, relief };
}

function length(x: number, y: number) {
  return Math.hypot(x, y);
}

function distanceSquared(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

const ENEMY_SPATIAL_GRIDS = new WeakMap<RunState, SpatialGrid<Enemy>>();
const ENEMY_SPATIAL_SCRATCH = new WeakMap<RunState, Map<string, Enemy[]>>();

function enemyGrid(run: RunState) {
  let grid = ENEMY_SPATIAL_GRIDS.get(run);
  if (!grid) {
    grid = new SpatialGrid<Enemy>(96);
    ENEMY_SPATIAL_GRIDS.set(run, grid);
  }
  return grid;
}

function rebuildEnemyGrid(run: RunState) {
  enemyGrid(run).rebuild(run.enemies);
}

function nearbyEnemies(
  run: RunState,
  x: number,
  y: number,
  radius: number,
  scratchKey = "default",
) {
  let scratchByPurpose = ENEMY_SPATIAL_SCRATCH.get(run);
  if (!scratchByPurpose) {
    scratchByPurpose = new Map();
    ENEMY_SPATIAL_SCRATCH.set(run, scratchByPurpose);
  }
  let scratch = scratchByPurpose.get(scratchKey);
  if (!scratch) {
    scratch = [];
    scratchByPurpose.set(scratchKey, scratch);
  }
  return enemyGrid(run).query(x, y, radius, scratch);
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

type HostileStrikeSeed = Omit<
  PendingStrike,
  "id" | "owner" | "hostile"
>;

function pushHostileStrike(
  run: RunState,
  seed: HostileStrikeSeed,
  priority: "ordinary" | "boss" = "ordinary",
): PendingStrike | undefined {
  const cap = getCombatPressureProfile(run).hostileAttackCap;
  let activeHostile = run.strikes.reduce(
    (count, strike) => count + (strike.hostile ? 1 : 0),
    0,
  );
  // A saturated ordinary volley must never erase the warning contract of a
  // Boss skill. Cancel one older ordinary hazard to make the replacement
  // visible while keeping the authored difficulty ceiling exact.
  if (activeHostile >= cap && priority === "boss") {
    const replaceIndex = run.strikes.findIndex(
      (strike) => strike.hostile && !strike.artKey.startsWith("boss/"),
    );
    if (replaceIndex >= 0) {
      run.strikes.splice(replaceIndex, 1);
      activeHostile -= 1;
    }
  }
  if (activeHostile >= cap) return undefined;
  const strike: PendingStrike = {
    id: nextId(run),
    owner: "terminal",
    hostile: true,
    ...seed,
  };
  run.strikes.push(strike);
  return strike;
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
  const difficultyId = resolveDifficultyId(
    options.difficultyId,
    options.unlockedDifficultyIds,
  );
  const difficulty = getDifficultyDefinition(difficultyId);
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
  const primaryWeapon: PrimaryWeaponSelection | undefined =
    initialWeaponId === "lantern"
      ? undefined
      : {
          weaponId: initialWeaponId,
          assignedBy: "startingWeapon",
          assignedAt: 0,
        };
  return {
    elapsed: 0,
    endless: false,
    score: 0,
    kills: 0,
    surplusPages: 0,
    player: {
      ...createPlayerForm(),
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      facing: -Math.PI / 2,
      life: difficulty.playerLife,
      maxLife: difficulty.playerLife,
      xp: 0,
      nextXp: 7,
      level: 1,
      invulnerability: 0,
      speedMultiplier: 1,
      powerMultiplier:
        difficulty.playerPower * (trials.has("thinPower") ? 0.88 : 1),
      magnetMultiplier: 1,
      lifeSegments: createInitialLifeSegments(difficulty.playerLife),
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
    difficultyId,
    difficultyUnlockCandidate: nextDifficultyId(difficultyId),
    difficultyClearEligible: true,
    primaryWeapon,
    attackReplays: new Map(),
    enemySkillBreatherUntil: 0,
  };
}

export const PRIMARY_WEAPON_RULE =
  "主武器须是当前持有的一把非走马灯武器；走马灯的“照样”只重放它最近一次完整核心攻击，重放不会再次触发照样或搭手。";

function primaryWeaponIsHeld(run: RunState, weaponId: WeaponId) {
  if (
    weaponId === "lantern" ||
    !run.build.weapons.some((weapon) => weapon.id === weaponId)
  ) {
    return false;
  }
  // In endless mode a fusion or dismantle consumes the source node.  The
  // historical build entry remains for combat bookkeeping, but it is no
  // longer a selectable object on the wheel and therefore cannot be “照样”.
  return !run.weave || run.weave.nodes.some(
    (node) => node.kind === "weapon" && node.sourceId === weaponId,
  );
}

export function setPrimaryWeapon(
  run: RunState,
  weaponId: WeaponId,
): boolean {
  if (!primaryWeaponIsHeld(run, weaponId)) return false;
  run.primaryWeapon = {
    weaponId,
    assignedBy: "player",
    assignedAt: run.elapsed,
  };
  return true;
}

export function setTravelNoteRepeatEnabled(
  run: RunState,
  id: TravelNoteId,
  enabled: boolean,
) {
  run.build = {
    ...run.build,
    travelNoteRepeatEnabled: {
      ...run.build.travelNoteRepeatEnabled,
      [id]: enabled,
    },
  };
}

export function availablePrimaryWeapons(run: RunState): readonly WeaponId[] {
  return run.build.weapons
    .map((weapon) => weapon.id)
    .filter((weaponId) => primaryWeaponIsHeld(run, weaponId));
}

export function getPrimaryWeaponSelection(
  run: RunState,
): PrimaryWeaponSelection | undefined {
  const selection = run.primaryWeapon;
  return selection && primaryWeaponIsHeld(run, selection.weaponId)
    ? selection
    : undefined;
}

function synergyChoiceOption(
  synergy: ReturnType<typeof getEligibleSynergies>[number],
): SynergyChoiceOption {
  const weaponLabel = (weaponId: WeaponId) =>
    getWeaponDefinition(weaponId).name;
  const rule = synergy.eventRules[0];
  const eventLabel: Record<CombatEventKind, string> = {
    weaponAttack: "完成一次核心攻击",
    weaponHit: "攻击命中",
    weaponKill: "击倒目标",
    guardBlock: "成功挡下一击",
  };
  const source = rule.sourceWeapon
    ? weaponLabel(rule.sourceWeapon)
    : synergy.definition.weapons.map(weaponLabel).join("或");
  const cadence = Math.max(1, rule.every ?? 1);
  const triggerText = `${source}${eventLabel[rule.event]}${
    cadence > 1 ? `累计${cadence}次` : "时"
  }触发`;
  const routeImpactText = synergy.variant
    ? `当前改法已改成“${synergy.name}”：${synergy.variant.description}`
    : "当前改法没有额外变体，按基础动作生效。";
  return {
    id: synergy.definition.id,
    name: synergy.name,
    description: synergy.description,
    weapons: synergy.definition.weapons,
    conditionText: `${synergy.definition.weapons.map(weaponLabel).join("＋")}均达到3/5后成立；不占武器槽。`,
    triggerText,
    effectText: synergy.description,
    routeImpactText,
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
    surplusPages: run.surplusPages,
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
    difficultyId: run.difficultyId,
    primaryWeaponId: run.primaryWeapon?.weaponId,
    primaryWeaponValid: getPrimaryWeaponSelection(run) !== undefined,
    availablePrimaryWeaponIds: availablePrimaryWeapons(run),
    primaryWeaponRule: PRIMARY_WEAPON_RULE,
    travelNotes: { ...run.build.travelNotes },
    travelNoteRepeatEnabled: { ...run.build.travelNoteRepeatEnabled },
  };
}

function travelNoteContext(run: RunState) {
  return {
    oneLife: run.difficultyId === "oneLife",
    recoveryEnabled:
      run.difficultyId !== "oneLife" && !run.trials.has("noRecovery"),
  };
}

function travelNoteRank(run: RunState, id: TravelNoteId) {
  return getTravelNoteRank(run.build, id);
}

export function getUpgradeChoices(run: RunState): readonly UpgradeOption[] {
  const generated = generateUpgradeOptions(run.build, run.rng, {
    maxWeapons: 4,
    optionCount: run.difficultyId === "oneLife" ? 4 : 3,
    travelNoteContext: travelNoteContext(run),
  });
  run.rng = generated.rngState;
  return generated.milestone === "travelNote" || generated.milestone === "complete"
    ? generated.options
    : run.difficultyId === "oneLife"
    ? generated.options.filter(
        (option) =>
          option.kind !== "utility" || option.modifierId !== "paperWard",
      ).slice(0, 3)
    : generated.options;
}

export type RareChoice = {
  id: "master-now" | "resonance-slot" | "weapon-soul";
  name: string;
  description: string;
  reason?: string;
};

export const RARE_CHOICES: readonly RareChoice[] = [
  {
    id: "master-now",
    name: "趁热做细",
    description: "先选一件未定型武器，再推进一阶；改法或定型仍由你亲自选。",
  },
  {
    id: "resonance-slot",
    name: "搭手续作",
    description: "仍只启用三项搭手；每累计触发三次，第三次按原动作再做一遍。",
  },
  {
    id: "weapon-soul",
    name: "记住手法",
    description: "每件本命武器累计命中十八次，便用这门手艺追击强敌并弹射三次。",
  },
] as const;

export type RareAdvanceTarget = {
  weaponId: WeaponId;
  weaponName: string;
  currentLevel: number;
  nextLevel: number;
  options: readonly UpgradeOption[];
  needsExplicitChoice: boolean;
};

export type RareChoiceAvailability = RareChoice & {
  enabled: boolean;
  reason?: string;
};

export type RareAdvanceSelection = {
  weaponId: WeaponId;
  upgradeOptionId?: string;
};

function rareAdvanceOptions(weapon: WeaponState): readonly UpgradeOption[] {
  const definition = getWeaponDefinition(weapon.id);
  if (weapon.level === 1) {
    return [{
      id: `rare-refine-${weapon.id}`,
      kind: "refine",
      weaponId: weapon.id,
      title: `${definition.name}·做细`,
      description: "把这件武器由1/5推进到2/5。",
      artKey: definition.artKeys.tier2,
    }];
  }
  if (weapon.level === 2) {
    return definition.routes.map((route) => ({
      id: `rare-route-${route.id}`,
      kind: "route" as const,
      weaponId: weapon.id,
      routeId: route.id,
      title: `${definition.name}·${route.name}`,
      description: route.description,
      artKey: route.artKeys.tier3,
    }));
  }
  if (weapon.level === 3 && weapon.routeId) {
    const route = getWeaponRoute(weapon.routeId);
    return [{
      id: `rare-enhance-${route.id}`,
      kind: "routeEnhancement",
      weaponId: weapon.id,
      title: `${definition.name}·再磨${route.name}`,
      description: `把“${route.name}”由3/5推进到4/5。`,
      artKey: route.artKeys.tier4,
    }];
  }
  if (weapon.level === 4 && weapon.routeId) {
    const route = getWeaponRoute(weapon.routeId);
    return route.masteries.map((mastery) => ({
      id: `rare-mastery-${mastery.id}`,
      kind: "mastery" as const,
      weaponId: weapon.id,
      routeId: route.id,
      masteryId: mastery.id,
      title: `${definition.name}·${mastery.name}`,
      description: mastery.description,
      artKey: mastery.artKey,
    }));
  }
  return [];
}

export function getRareAdvanceTargets(
  run: RunState,
): readonly RareAdvanceTarget[] {
  return run.build.weapons.flatMap((weapon) => {
    const options = rareAdvanceOptions(weapon);
    return options.length === 0
      ? []
      : [{
          weaponId: weapon.id,
          weaponName: getWeaponDefinition(weapon.id).name,
          currentLevel: weapon.level,
          nextLevel: weapon.level + 1,
          options,
          needsExplicitChoice: options.length > 1,
        }];
  });
}

export function getRareChoiceAvailability(
  run: RunState,
): readonly RareChoiceAvailability[] {
  const canAdvance = getRareAdvanceTargets(run).length > 0;
  return RARE_CHOICES.map<RareChoiceAvailability>((choice) =>
    choice.id === "master-now"
      ? {
          ...choice,
          enabled: canAdvance,
          reason: canAdvance ? undefined : "当前器物均已定型",
        }
      : { ...choice, enabled: true },
  );
}

export function applyUpgrade(run: RunState, option: UpgradeOption): string | undefined {
  const before = new Set(
    resolveChosenSynergies(
      run.build.weapons,
      run.activeSynergyIds,
      run.build.synergyCapacity,
    ).map((item) => item.definition.id),
  );
  const previousTravelNoteRank =
    option.kind === "utility" && option.travelNoteId
      ? travelNoteRank(run, option.travelNoteId)
      : 0;
  run.build = applyUpgradeOption(run.build, option);
  if (
    option.kind === "acquire" &&
    option.weaponId !== "lantern" &&
    !getPrimaryWeaponSelection(run)
  ) {
    run.primaryWeapon = {
      weaponId: option.weaponId,
      assignedBy: "firstNonLantern",
      assignedAt: run.elapsed,
    };
  }
  if (option.kind === "utility") {
    if (option.travelNoteId === "keenEdge") {
      const before = resolveTravelNoteEffect("keenEdge", previousTravelNoteRank).damageMultiplier;
      const after = resolveTravelNoteEffect("keenEdge", previousTravelNoteRank + 1).damageMultiplier;
      run.player.powerMultiplier *=
        after / before;
    } else if (option.travelNoteId === "gatheringWind") {
      const before = resolveTravelNoteEffect("gatheringWind", previousTravelNoteRank).magnetMultiplier;
      const after = resolveTravelNoteEffect("gatheringWind", previousTravelNoteRank + 1).magnetMultiplier;
      run.player.magnetMultiplier *=
        after / before;
    } else if (option.travelNoteId === "lightStep") {
      const before = resolveTravelNoteEffect("lightStep", previousTravelNoteRank).speedMultiplier;
      const after = resolveTravelNoteEffect("lightStep", previousTravelNoteRank + 1).speedMultiplier;
      run.player.speedMultiplier *=
        after / before;
    } else if (
      option.travelNoteId === "paperWard" &&
      run.difficultyId !== "oneLife"
    ) {
      addPlayerLifeSegment(run, "travelNote", 1);
    }
  }
  const eligible = getEligibleSynergies(run.build.weapons);
  const newlyActive =
    eligible.length <= run.build.synergyCapacity
      ? eligible.find((item) => !before.has(item.definition.id))
      : undefined;
  return newlyActive?.name;
}

export function applyRareChoice(
  run: RunState,
  choice: RareChoice["id"],
  selection?: RareAdvanceSelection,
): boolean {
  if (choice === "resonance-slot") {
    run.build = {
      ...run.build,
      synergyCapacity: 3,
      modifiers: {
        ...run.build.modifiers,
        helpingHand: (run.build.modifiers.helpingHand ?? 0) + 1,
      },
    };
    return true;
  } else if (choice === "weapon-soul") {
    run.build = {
      ...run.build,
      modifiers: {
        ...run.build.modifiers,
        weaponSoul: (run.build.modifiers.weaponSoul ?? 0) + 1,
      },
    };
    return true;
  } else {
    if (!selection) return false;
    const target = getRareAdvanceTargets(run).find(
      (candidate) => candidate.weaponId === selection.weaponId,
    );
    if (!target) return false;
    const option = selection.upgradeOptionId
      ? target.options.find(
          (candidate) => candidate.id === selection.upgradeOptionId,
        )
      : target.options.length === 1
        ? target.options[0]
        : undefined;
    if (!option) return false;
    run.build = applyUpgradeOption(run.build, option);
    return true;
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
  const grid = ENEMY_SPATIAL_GRIDS.get(run);
  const candidates = grid
    ? nearbyEnemies(
        run,
        x,
        y,
        Math.hypot(GAME_WIDTH, GAME_HEIGHT) + 180,
        "target",
      )
    : run.enemies;
  for (const enemy of candidates) {
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

function travelRangeMultiplier(run: RunState) {
  return resolveTravelNoteEffect("longReach", travelNoteRank(run, "longReach")).rangeMultiplier;
}

function travelDurationMultiplier(run: RunState) {
  return resolveTravelNoteEffect("lastingWork", travelNoteRank(run, "lastingWork")).durationMultiplier;
}

function coreAttackIntervalMultiplier(run: RunState) {
  return resolveTravelNoteEffect("quickHands", travelNoteRank(run, "quickHands")).attackIntervalMultiplier;
}

function spawnProjectilePattern(
  run: RunState,
  effect: Extract<EffectSpec, { kind: "projectile" }>,
  owner: ProjectileOwner,
  damageScale = 1,
  canProc = true,
  targetOverride?: Enemy,
) {
  const target =
    targetOverride?.hp && targetOverride.hp > 0
      ? targetOverride
      : pickNearest(run);
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
    pushProjectile(run, {
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
      life: effect.lifetime * travelRangeMultiplier(run),
      pierce: effect.pierce,
      homing: effect.homing ?? 0,
      targetId: target.id,
      markSeconds: effect.markSeconds ?? 0,
      hitCooldown: effect.singleTargetHitCooldown ?? 0.16,
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
  let guardMultiplier = 1;
  if (
    (enemy.guardedUntil ?? 0) > run.elapsed &&
    enemy.guardFacing !== undefined
  ) {
    const currentPlayerAngle = Math.atan2(
      run.player.y - enemy.y,
      run.player.x - enemy.x,
    );
    if (
      Math.abs(normalizeAngle(currentPlayerAngle - enemy.guardFacing)) <=
      (70 * Math.PI) / 180
    ) {
      guardMultiplier = 0.35;
      const guardFxKey = `enemy-guard:${enemy.id}`;
      if ((run.cooldowns.get(guardFxKey) ?? 0) <= 0) {
        run.cooldowns.set(guardFxKey, 0.16);
        addFx(
          run,
          "ring",
          enemy.x,
          enemy.y,
          enemy.radius * 1.45,
          0.22,
          "#667b72",
          "enemy/rib/guard-block",
        );
      }
    }
  }
  enemy.hp -= damage * markMultiplier * guardMultiplier;
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
  const chainRange = effect.range * travelRangeMultiplier(run);
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
      distanceSquared(previousX, previousY, enemy.x, enemy.y) <= chainRange ** 2
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
  targetOverride?: Enemy,
) {
  const beamLength = effect.length * travelRangeMultiplier(run);
  const target =
    targetOverride?.hp && targetOverride.hp > 0
      ? targetOverride
      : pickNearest(run);
  if (!target) return;
  const baseAngle = Math.atan2(
    target.y - run.player.y,
    target.x - run.player.x,
  );
  const sweepRadians = ((effect.sweepDegrees ?? 0) * Math.PI) / 180;
  const rayCount = sweepRadians > 0.8 ? 5 : sweepRadians > 0 ? 3 : 1;
  // Music is a semantic visual family.  A lantern replay still draws the
  // restrained three-arc wave instead of falling back to a generic beam.
  const isPipaWave = effect.tags.includes("music");
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
        along <= beamLength &&
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
          x2: run.player.x + direction.x * beamLength,
          y2: run.player.y + direction.y * beamLength,
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
        x2: run.player.x + Math.cos(baseAngle) * beamLength,
        y2: run.player.y + Math.sin(baseAngle) * beamLength,
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
  start?: Enemy,
) {
  const rangeMultiplier = travelRangeMultiplier(run);
  const chainRange = effect.chainRange
    ? effect.chainRange * rangeMultiplier
    : undefined;
  const ignored = new Set<number>();
  let originX = run.player.x;
  let originY = run.player.y;
  for (let index = 0; index < effect.strikes; index += 1) {
    const chained =
      index > 0 && chainRange
        ? pickNearest(run, originX, originY, ignored)
        : undefined;
    const target =
      chained &&
      distanceSquared(originX, originY, chained.x, chained.y) <=
        chainRange! ** 2
        ? chained
        : index === 0
          ? (start?.hp && start.hp > 0 ? start : undefined) ??
            pickNearest(run, run.player.x, run.player.y, ignored) ??
            pickStrongest(run)
          : chainRange
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
      radius: effect.radius * rangeMultiplier,
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
  targetOverride?: Enemy,
) {
  const duration = effect.duration * travelDurationMultiplier(run);
  const target = effect.followsOwner
    ? undefined
    : targetOverride?.hp && targetOverride.hp > 0
      ? targetOverride
      : pickNearest(run);
  pushZone(run, {
    id: nextId(run),
    owner,
    artKey: effect.visualKey ?? `zone/${owner}`,
    x: target?.x ?? run.player.x,
    y: target?.y ?? run.player.y,
    radius: effect.radius * travelRangeMultiplier(run),
    damagePerSecond: effect.damagePerSecond * damageScale * run.player.powerMultiplier,
    life: duration,
    maxLife: duration,
    tick: 0,
    tickRate: effect.tickRate,
    followsPlayer: effect.followsOwner ?? false,
    slow: effect.slow ?? 0,
    canProc,
  });
}

function spawnSummons(
  run: RunState,
  effect: Extract<EffectSpec, { kind: "summon" }>,
  owner: ProjectileOwner,
  damageScale = 1,
  canProc = true,
) {
  const duration = effect.duration * travelDurationMultiplier(run);
  const same = run.summons.filter(
    (summon) =>
      summon.owner === owner && summon.artKey === effect.summonKey,
  );
  for (let index = 0; index < same.length; index += 1) {
    const summon = same[index];
    summon.life = Math.max(summon.life, duration);
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
    pushSummon(run, {
      id: nextId(run),
      owner,
      artKey: effect.summonKey,
      angle,
      radius,
      life: duration,
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
  pushProjectile(run, {
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
  } else if (action.kind === "releaseUmbrellaRain") {
    const first = context.firstTarget ?? target ?? pickNearest(run);
    if (first) {
      const needles = Math.max(3, action.count ?? 5);
      for (let index = 0; index < needles; index += 1) {
        const offset =
          needles === 1 ? 0 : (index / (needles - 1) - 0.5) * 0.72;
        spawnPerkProjectile(
          run,
          "umbrella",
          run.player.x,
          run.player.y,
          first,
          24 * strength * run.player.powerMultiplier,
          offset,
          ["rain", "guard"],
        );
      }
    }
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
  } else if (action.kind === "leaveEchoField") {
    const centre = context.firstTarget ?? target ?? pickNearest(run);
    const duration = (action.durationSeconds ?? 2.4) * strength;
    pushZone(run, {
      id: nextId(run),
      owner: "pipa",
      artKey: "perk/pipa/echo-field",
      x: centre?.x ?? run.player.x,
      y: centre?.y ?? run.player.y,
      radius: 108,
      damagePerSecond: 30 * strength * run.player.powerMultiplier,
      life: duration,
      maxLife: duration,
      tick: 0,
      tickRate: 0.3,
      followsPlayer: false,
      slow: 0.08,
      canProc: false,
    });
  } else if (action.kind === "extendInkAndBurstCross") {
    const cross = target ?? pickNearest(run);
    const x = cross?.x ?? run.player.x;
    const y = cross?.y ?? run.player.y;
    pushZone(run, {
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
      pushZone(run, {
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
      retainInPlace(run.pickups, (pickup) => !ids.has(pickup.id));
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
  } else if (action.kind === "pullDistantPickups") {
    const radius = (action.radius ?? 420) * strength;
    const pullRatio = clamp(action.value ?? 0.46, 0.15, 0.82);
    for (const pickup of run.pickups) {
      if (pickup.value <= 0) continue;
      const dx = run.player.x - pickup.x;
      const dy = run.player.y - pickup.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 30 || distance > radius) continue;
      const travel = Math.min(distance - 30, distance * pullRatio);
      pickup.x += (dx / distance) * travel;
      pickup.y += (dy / distance) * travel;
      pickup.magnetRadius = Math.max(
        pickup.magnetRadius ?? 0,
        radius * 0.7,
      );
    }
  } else if (action.kind === "preventLethalDamage") {
    healPlayer(
      run,
      Math.max(0, Math.max(action.value ?? 1, 1) - run.player.life),
    );
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
    healPlayer(
      run,
      (action.value ?? 0.2) * strength * recoveryFor(run),
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
      const helpingHandRank = run.build.modifiers.helpingHand ?? 0;
      if (helpingHandRank > 0) {
        const helpingKey = "rare:helping-hand";
        const helpingCount = (run.synergyCounters.get(helpingKey) ?? 0) + 1;
        if (helpingCount >= 3) {
          run.synergyCounters.set(helpingKey, helpingCount - 3);
          for (const effect of rule.effects) {
            fireEffect(
              run,
              effect,
              owner,
              target,
              Math.min(1, 0.45 + helpingHandRank * 0.1),
              false,
            );
          }
        } else {
          run.synergyCounters.set(helpingKey, helpingCount);
        }
      }
    }
  }
}

function replaySafeEffect(effect: EffectSpec): EffectSpec | undefined {
  if (effect.kind === "copy") return undefined;
  if (effect.kind !== "accumulator") return effect;
  const procEffects = effect.procEffects
    .map(replaySafeEffect)
    .filter((candidate): candidate is EffectSpec => candidate !== undefined);
  return procEffects.length > 0 ? { ...effect, procEffects } : undefined;
}

function captureAttackReplay(
  run: RunState,
  owner: ProjectileOwner,
  effects: readonly EffectSpec[],
  target?: Enemy,
  sourceWeaponId = directWeaponOwner(owner),
) {
  const replayEffects = effects
    .map(replaySafeEffect)
    .filter((candidate): candidate is EffectSpec => candidate !== undefined);
  if (replayEffects.length === 0) {
    run.attackReplays.delete(owner);
    return;
  }
  const aimTarget =
    target?.hp && target.hp > 0 ? target : pickNearest(run);
  run.attackReplays.set(owner, {
    owner,
    sourceWeaponId,
    effects: replayEffects,
    targetId: aimTarget?.id,
    aimAngle: aimTarget
      ? Math.atan2(aimTarget.y - run.player.y, aimTarget.x - run.player.x)
      : run.player.facing,
    capturedAt: run.elapsed,
    copyDepth: 0,
  });
}

function latestAttackReplay(
  run: RunState,
  predicate: (replay: AttackReplayRecord) => boolean,
) {
  let result: AttackReplayRecord | undefined;
  for (const replay of run.attackReplays.values()) {
    if (
      predicate(replay) &&
      (!result || replay.capturedAt > result.capturedAt)
    ) {
      result = replay;
    }
  }
  return result;
}

function copySourceReplay(
  run: RunState,
  effect: Extract<EffectSpec, { kind: "copy" }>,
  owner: ProjectileOwner,
  target?: Enemy,
): AttackReplayRecord | undefined {
  if (effect.source === "primaryWeapon") {
    const primary = getPrimaryWeaponSelection(run)?.weaponId;
    if (!primary) return undefined;
    const replay = run.attackReplays.get(primary);
    return replay?.copyDepth === 0 ? replay : undefined;
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
        const found = run.attackReplays.get(previousOwner);
        if (found) return found;
      }
    }
    const direct = directWeaponOwner(owner);
    const index = direct
      ? run.build.weapons.findIndex((weapon) => weapon.id === direct)
      : -1;
    if (index > 0) {
      const previous = run.build.weapons[index - 1].id;
      const found = run.attackReplays.get(previous);
      if (found) return found;
    }
    return latestAttackReplay(run, (replay) => replay.owner !== owner);
  }
  if (target?.marked) {
    const byTarget = latestAttackReplay(
      run,
      (replay) => replay.owner !== owner && replay.targetId === target.id,
    );
    if (byTarget) return byTarget;
  }
  const markedIds = new Set(
    run.enemies
      .filter((enemy) => enemy.marked > 0)
      .map((enemy) => enemy.id),
  );
  return latestAttackReplay(
    run,
    (replay) =>
      replay.owner !== owner &&
      replay.targetId !== undefined &&
      markedIds.has(replay.targetId),
  );
}

function fireEffect(
  run: RunState,
  effect: EffectSpec,
  owner: ProjectileOwner,
  start?: Enemy,
  damageScale = 1,
  canProc = true,
  copyDepth: 0 | 1 = 0,
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
        fireEffect(run, proc, owner, start, damageScale, canProc, copyDepth);
      }
    } else {
      run.accumulators.set(counterKey, current);
    }
  } else if (effect.kind === "projectile") {
    spawnProjectilePattern(run, effect, owner, damageScale, canProc, start);
  } else if (effect.kind === "beam") {
    fireBeam(run, effect, owner, damageScale, canProc, start);
  } else if (effect.kind === "lightning") {
    scheduleLightning(run, effect, owner, damageScale, canProc, start);
  } else if (effect.kind === "chain") {
    fireChain(run, effect, owner, start, damageScale, canProc);
  } else if (effect.kind === "zone") {
    spawnZone(run, effect, owner, damageScale, canProc, start);
  } else if (effect.kind === "summon") {
    spawnSummons(run, effect, owner, damageScale, canProc);
  } else if (effect.kind === "orbit") {
    const orbitRadius = effect.radius * travelRangeMultiplier(run);
    addFx(
      run,
      "ring",
      run.player.x,
      run.player.y,
      orbitRadius,
      0.42,
      ownerColor(owner),
      effect.visualKey ?? `orbit/${owner}`,
      { owner },
    );
    for (const enemy of nearbyEnemies(
      run,
      run.player.x,
      run.player.y,
      orbitRadius + 90,
      "orbit",
    )) {
      if (
        enemy.hp > 0 &&
        distanceSquared(run.player.x, run.player.y, enemy.x, enemy.y) <=
          (orbitRadius + enemy.radius) ** 2
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
        radius: effect.radius * travelRangeMultiplier(run),
        damage: effect.damage * damageScale * run.player.powerMultiplier,
        delay,
        maxDelay: delay,
        hostile: false,
        canProc,
      });
    }
  } else if (effect.kind === "copy") {
    if (copyDepth >= 1) return;
    const replay = copySourceReplay(run, effect, owner, start);
    if (!replay || replay.copyDepth >= 1) return;
    const replayTarget =
      run.enemies.find(
        (enemy) => enemy.id === replay.targetId && enemy.hp > 0,
      ) ?? start ?? pickNearest(run);
    for (let index = 0; index < effect.maxCopies; index += 1) {
      for (const replayEffect of replay.effects) {
        fireEffect(
          run,
          replayEffect,
          owner,
          replayTarget,
          damageScale * effect.damageMultiplier,
          false,
          1,
        );
      }
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
  const sourceWeapon = directWeaponOwner(owner);
  const reactiveCooldown =
    trigger === "onHit" || trigger === "onMarkedHit"
      ? effect.internalCooldown ?? 0.12
      : effect.internalCooldown ?? 0;
  const cooldown = activeTrigger
    ? effectCooldown(effect) *
      (announceAttack && sourceWeapon
        ? coreAttackIntervalMultiplier(run)
        : 1)
    : reactiveCooldown;
  if (effect.chance !== undefined && random(run) > effect.chance) {
    if (cooldown > 0) run.cooldowns.set(key, cooldown);
    return false;
  }
  let damageScale = 1;
  if (
    activeTrigger &&
    announceAttack &&
    sourceWeapon !== undefined &&
    sourceWeapon === getPrimaryWeaponSelection(run)?.weaponId &&
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

const TURNING_MOMENTUM_ARMED = "travel-note:turning-momentum:armed";
const TURNING_MOMENTUM_COOLDOWN = "travel-note:turning-momentum:cooldown";

function armTurningMomentum(run: RunState) {
  const rank = travelNoteRank(run, "turningMomentum");
  const effect = resolveTravelNoteEffect("turningMomentum", rank);
  if (
    rank <= 0 ||
    (run.cooldowns.get(TURNING_MOMENTUM_COOLDOWN) ?? 0) > 0
  ) {
    return;
  }
  run.accumulators.set(TURNING_MOMENTUM_ARMED, 1);
  run.cooldowns.set(TURNING_MOMENTUM_COOLDOWN, effect.turnEchoCooldown);
}

function releaseTurningMomentumEcho(
  run: RunState,
  primary: EffectSpec,
) {
  if ((run.accumulators.get(TURNING_MOMENTUM_ARMED) ?? 0) <= 0) return;
  const echoEffect = replaySafeEffect(primary);
  if (!echoEffect) return;
  const echoRatio = resolveTravelNoteEffect(
    "turningMomentum",
    travelNoteRank(run, "turningMomentum"),
  ).turnEchoRatio;
  run.accumulators.delete(TURNING_MOMENTUM_ARMED);
  const echoTarget = pickNearest(run);
  const echoEffects = echoEffect.kind === "accumulator"
    ? echoEffect.procEffects
        .map(replaySafeEffect)
        .filter((effect): effect is EffectSpec => effect !== undefined)
    : [echoEffect];
  for (const effect of echoEffects) {
    fireEffect(
      run,
      effect,
      "terminal",
      echoTarget,
      echoRatio,
      false,
      1,
    );
  }
  addFx(
    run,
    "burst",
    run.player.x,
    run.player.y,
    74,
    0.32,
    "#b57b52",
    "travel-note/turning-momentum",
  );
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
    const replayEffects = kit.effects.filter((effect) =>
      effect.trigger === "onAttack" ||
      effect.trigger === "periodic" ||
      effect.trigger === "onHit" ||
      effect.trigger === "onMarkedHit"
    );
    const primary =
      kit.core.find(
        (effect) =>
          (effect.trigger === "onAttack" ||
            effect.trigger === "periodic") &&
          effect.kind !== "orbit",
      ) ?? activeEffects[0];
    const attackKey = `weapon-attack:${owner}`;
    if (!primary) {
      if (
        replayEffects.length > 0 &&
        (run.cooldowns.get(attackKey) ?? 0) <= 0
      ) {
        captureAttackReplay(
          run,
          owner,
          replayEffects,
          pickNearest(run),
          weaponState.id,
        );
        run.cooldowns.set(
          attackKey,
          minimumWeaponCadence[weaponState.id] *
            coreAttackIntervalMultiplier(run),
        );
      }
      continue;
    }
    if ((run.cooldowns.get(attackKey) ?? 0) > 0) continue;
    const attackTarget = pickNearest(run);
    const fired = dispatchEffectTrigger(
      run,
      owner,
      primary,
      primary.trigger,
      attackTarget,
      true,
    );
    run.cooldowns.set(
      attackKey,
      Math.max(
        minimumWeaponCadence[weaponState.id],
        effectCooldown(primary),
      ) * coreAttackIntervalMultiplier(run),
    );
    if (!fired) continue;
    releaseTurningMomentumEcho(run, primary);
    captureAttackReplay(
      run,
      owner,
      // One attack snapshot includes the core cadence plus its on-hit route
      // and mastery emitters. on-kill/defensive effects are deliberately
      // excluded, and replaySafeEffect strips copy nodes, so the replay is a
      // bounded one-layer attack rather than a second proc graph.
      replayEffects,
      attackTarget,
      weaponState.id,
    );
    for (const linked of activeEffects) {
      if (linked === primary) continue;
      dispatchEffectTrigger(
        run,
        owner,
        linked,
        linked.trigger,
        attackTarget,
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
      const orbitRadius = effect.radius * travelRangeMultiplier(run);
      const baseAngle = run.elapsed * effect.angularSpeed + orbitIndex * 0.51;
      for (let index = 0; index < effect.count; index += 1) {
        const angle = baseAngle + (Math.PI * 2 * index) / effect.count;
        const x = run.player.x + Math.cos(angle) * orbitRadius;
        const y = run.player.y + Math.sin(angle) * orbitRadius;
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
  const difficulty = difficultyFor(run);
  const endlessSample = run.endlessDirector?.lastSample;
  const baseHp =
    12 + (run.endless ? STANDARD_SECONDS : run.elapsed) * 0.06;
  const trialHp = run.trials.has("elite") && (elite || boss) ? 1.42 : 1;
  const endlessScale = endlessSample?.hpMultiplier ?? 1;
  const intrusionScale = options.intrusion ? 17 : 1;
  const maxHp =
    baseHp *
    stat.hp *
    trialHp *
    endlessScale *
    intrusionScale *
    difficulty.enemyHpMultiplier;
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
    speed:
      stat.speed *
      (run.trials.has("swift") ? 1.18 : 1) *
      difficulty.enemySpeedMultiplier *
      (endlessSample?.speedMultiplier ?? 1),
    turnSpeed: stat.turn,
    damage: endlessSample?.contactDamage ?? stat.damage,
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
    actionSpeed: endlessSample?.actionMultiplier ?? 1,
  };
  run.enemies.push(enemy);
  if (options.intrusion) run.intrusionAvatarId = enemy.id;
  if (bossTier) run.currentBoss = bossTier;
  return enemy;
}

export function endlessMinutes(run: RunState): number {
  if (!run.endlessDirector) return 0;
  return Math.max(0, run.elapsed - run.endlessDirector.startedAt) / 60;
}

export function getEndlessDifficultySample(
  run: RunState,
): EndlessDifficultySample {
  const sample = sampleEndlessDifficulty(
    endlessMinutes(run),
    difficultyFor(run),
  );
  return run.trials.has("bossRush")
    ? {
        ...sample,
        bossBudgetPerMinute: sample.bossBudgetPerMinute * 1.4,
      }
    : sample;
}

function chooseFrom<T>(run: RunState, values: readonly T[]): T {
  return values[
    Math.min(values.length - 1, Math.floor(random(run) * values.length))
  ];
}

function chooseEndlessCommon(run: RunState): EnemyArchetype {
  const season = getSolarTermState(run.elapsed, true).season;
  const seasonal: Record<string, readonly EnemyArchetype[]> = {
    spring: ["cup", "shoe", "fish", "rib"],
    summer: ["lantern", "fish", "shoe", "rib"],
    autumn: ["abacus", "cup", "lantern", "fish"],
    winter: ["rib", "abacus", "shoe", "lantern"],
  };
  return chooseFrom(run, seasonal[season] ?? COMMON_ENEMY_IDS);
}

function chooseBossTraits(run: RunState): readonly BossTraitId[] {
  const difficulty = difficultyFor(run);
  if (random(run) >= difficulty.firstBossTraitChance) return [];
  const first = chooseFrom(run, BOSS_TRAIT_IDS);
  const result: BossTraitId[] = [first];
  if (
    difficulty.secondBossTraitChance > 0 &&
    random(run) < difficulty.secondBossTraitChance
  ) {
    result.push(
      chooseFrom(
        run,
        BOSS_TRAIT_IDS.filter((trait) => trait !== first),
      ),
    );
  }
  return result;
}

function chooseEndlessBossId(run: RunState): EndlessBossId {
  const recent = new Set(run.endlessDirector?.recentBossIds ?? []);
  const candidates = ENDLESS_BOSS_IDS.filter((id) => !recent.has(id));
  const available = candidates.length > 0 ? candidates : [...ENDLESS_BOSS_IDS];
  const totalWeight = available.reduce(
    (sum, id) => sum + getEndlessBoss(id).weight,
    0,
  );
  let roll = random(run) * totalWeight;
  for (const id of available) {
    roll -= getEndlessBoss(id).weight;
    if (roll <= 0) return id;
  }
  return available.at(-1) ?? "troupeMaster";
}

function spawnEndlessBoss(
  run: RunState,
  events: RunEvent[],
  forcedBossId?: EndlessBossId,
): boolean {
  if (!run.endlessDirector || run.enemies.length >= ENDLESS_ACTOR_CAP) {
    return false;
  }
  const director = run.endlessDirector;
  const bossId = forcedBossId ?? director.nextBossId;
  const definition = getEndlessBoss(bossId);
  const enemy = spawnEnemy(run, definition.fallbackArchetype);
  if (!enemy) return false;
  const sample = director.lastSample;
  const difficulty = difficultyFor(run);
  const maxHp =
    (12 + STANDARD_SECONDS * 0.06) *
    definition.hpFactor *
    difficulty.enemyHpMultiplier *
    sample.hpMultiplier;
  enemy.endlessBossId = bossId;
  enemy.bossName = definition.name;
  enemy.bossTraits = chooseBossTraits(run);
  enemy.bossPhase = 1;
  enemy.artKey = definition.artKey;
  enemy.boss = true;
  enemy.elite = false;
  enemy.bossTier = "mid";
  enemy.radius = definition.radius;
  enemy.maxHp = maxHp;
  enemy.hp = maxHp;
  enemy.speed =
    definition.speed *
    difficulty.enemySpeedMultiplier *
    sample.speedMultiplier;
  enemy.turnSpeed = definition.turnSpeed;
  enemy.damage = sample.contactDamage;
  enemy.actionSpeed = sample.actionMultiplier;
  enemy.attackCooldown = 0.8;
  enemy.skillIndex = 0;
  run.currentBoss = "mid";
  run.endlessBossCount += 1;
  director.bossesSpawned += 1;
  director.totalThreatSpent += BOSS_THREAT_COST;
  director.recentBossIds = [
    ...director.recentBossIds,
    bossId,
  ].slice(-2);
  if (!forcedBossId) director.nextBossId = chooseEndlessBossId(run);
  events.push({ type: "bossSpawn", tier: "mid", bossId });
  return true;
}

function updateEndlessSpawning(
  run: RunState,
  delta: number,
  events: RunEvent[],
) {
  const director = run.endlessDirector;
  if (!director) return;
  const sample = getEndlessDifficultySample(run);
  if (sample.post45Step !== director.lastSample.post45Step) {
    const hpRatio =
      sample.hpMultiplier / director.lastSample.hpMultiplier;
    const speedRatio =
      sample.speedMultiplier / director.lastSample.speedMultiplier;
    for (const enemy of run.enemies) {
      enemy.maxHp *= hpRatio;
      enemy.hp *= hpRatio;
      enemy.speed *= speedRatio;
      enemy.actionSpeed = sample.actionMultiplier;
      enemy.damage = sample.contactDamage;
    }
  }
  director.lastSample = sample;
  const pressure = getCombatPressureProfile(run);
  const bossAlive = run.enemies.some(
    (enemy) => enemy.boss && enemy.hp > 0,
  );
  const backgroundScale = bossAlive
    ? pressure.bossBackgroundMultiplier
    : 1;
  director.nonBossThreatBudget = Math.min(
    sample.nonBossThreatPerSecond * 10,
    director.nonBossThreatBudget +
      sample.nonBossThreatPerSecond * delta * backgroundScale,
  );
  director.bossBudget = Math.min(
    6,
    director.bossBudget +
      (sample.bossBudgetPerMinute * delta) / 60,
  );

  let activeBosses = run.enemies.filter(
    (enemy) => enemy.boss && enemy.hp > 0,
  ).length;
  let spawnedThisStep = 0;
  while (
    director.nonBossThreatBudget >= 1 &&
    run.enemies.length < ENDLESS_ACTOR_CAP &&
    spawnedThisStep < 24
  ) {
    const special =
      director.pendingBossSlot || random(run) < sample.specialProbability;
    const bossAllowed =
      special &&
      director.bossBudget >= 1 &&
      activeBosses < sample.bossConcurrency;
    if (bossAllowed) {
      if (director.nonBossThreatBudget < BOSS_THREAT_COST) {
        director.pendingBossSlot = true;
        break;
      }
      if (!spawnEndlessBoss(run, events)) break;
      director.pendingBossSlot = false;
      director.nonBossThreatBudget -= BOSS_THREAT_COST;
      director.bossBudget -= 1;
      activeBosses += 1;
      spawnedThisStep += 1;
      continue;
    }
    director.pendingBossSlot = false;
    const threatCost = special ? ELITE_THREAT_COST : 1;
    if (director.nonBossThreatBudget < threatCost) break;
    const type = special
      ? chooseFrom(run, ELITE_ENEMY_IDS)
      : chooseEndlessCommon(run);
    spawnEnemy(run, type);
    director.nonBossThreatBudget -= threatCost;
    director.totalThreatSpent += threatCost;
    if (special) director.eliteSpawned += 1;
    else director.commonSpawned += 1;
    spawnedThisStep += 1;
  }

}

function updateSpawning(run: RunState, delta: number, events: RunEvent[]) {
  let bossAlive = run.enemies.some((enemy) => enemy.boss && enemy.hp > 0);
  if (!run.endless) {
    if (
      run.elapsed >= 360 &&
      !run.midBossSpawned &&
      !bossAlive &&
      run.enemies.length < ENDLESS_ACTOR_CAP
    ) {
      spawnEnemy(run, "taotie");
      run.midBossSpawned = true;
      bossAlive = true;
      events.push({ type: "bossSpawn", tier: "mid" });
    }
    if (
      run.elapsed >= STANDARD_SECONDS &&
      !run.finalBossSpawned &&
      !bossAlive &&
      run.enemies.length < ENDLESS_ACTOR_CAP
    ) {
      spawnEnemy(run, "nian");
      run.finalBossSpawned = true;
      bossAlive = true;
      events.push({ type: "bossSpawn", tier: "final" });
    }
  } else {
    updateEndlessSpawning(run, delta, events);
    return;
  }

  run.spawnClock -= delta;
  if (run.spawnClock <= 0 && run.enemies.length < ENDLESS_ACTOR_CAP) {
    const pressure = getCombatPressureProfile(run);
    const density =
      pressure.spawnRateMultiplier *
      (run.trials.has("crowd") ? 1.3 : 1) *
      (bossAlive ? pressure.bossBackgroundMultiplier : 1);
    const count = Math.min(5, 1 + Math.floor(run.elapsed / 115));
    const available = Math.min(
      count,
      ENDLESS_ACTOR_CAP - run.enemies.length,
    );
    for (let index = 0; index < available; index += 1) spawnEnemy(run);
    run.spawnClock = Math.max(
      0.18,
      (0.88 - run.elapsed * 0.00072) / Math.max(0.05, density),
    );
  }
  for (const [at, type] of [[120, "lion"], [300, "puppet"]] as Array<[number, EnemyArchetype]>) {
    if (run.elapsed >= at && run.elapsed - delta < at) spawnEnemy(run, type);
  }
}

function applySeparation(run: RunState, enemy: Enemy) {
  let pushX = 0;
  let pushY = 0;
  for (const other of nearbyEnemies(
    run,
    enemy.x,
    enemy.y,
    enemy.radius + 92,
  )) {
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

type MovementTargetResult = {
  x: number;
  y: number;
  movementKind: HostileTelegraph["movementKind"];
  dangerKind: HostileTelegraph["kind"];
  arcHeight?: number;
};

function clampedActorPoint(enemy: Enemy, x: number, y: number) {
  return {
    x: clamp(x, enemy.radius, GAME_WIDTH - enemy.radius),
    y: clamp(y, enemy.radius, GAME_HEIGHT - enemy.radius),
  };
}

function actionTarget(
  run: RunState,
  enemy: Enemy,
  movement: MovementTargetSpec,
): MovementTargetResult {
  const toPlayer = normalized(
    run.player.x - enemy.x,
    run.player.y - enemy.y,
  );
  const direction =
    Math.hypot(toPlayer.x, toPlayer.y) > 0.01
      ? toPlayer
      : { x: Math.cos(enemy.heading), y: Math.sin(enemy.heading) };
  const distance = Math.hypot(
    run.player.x - enemy.x,
    run.player.y - enemy.y,
  );
  if (movement.kind === "flyby") {
    const candidates: number[] = [];
    if (direction.x > 0.0001) {
      candidates.push((GAME_WIDTH + movement.exitMargin - enemy.x) / direction.x);
    } else if (direction.x < -0.0001) {
      candidates.push((-movement.exitMargin - enemy.x) / direction.x);
    }
    if (direction.y > 0.0001) {
      candidates.push((GAME_HEIGHT + movement.exitMargin - enemy.y) / direction.y);
    } else if (direction.y < -0.0001) {
      candidates.push((-movement.exitMargin - enemy.y) / direction.y);
    }
    const travel = Math.min(...candidates.filter((candidate) => candidate > 0));
    return {
      x: enemy.x + direction.x * travel,
      y: enemy.y + direction.y * travel,
      movementKind: movement.kind,
      dangerKind: "swept",
      arcHeight: movement.arcHeight,
    };
  }

  const safeDistance =
    enemy.radius + PLAYER_HIT_RADIUS + movement.clearance;
  if (movement.kind === "landShort") {
    const desiredTravel = Math.max(0, distance - safeDistance);
    if (desiredTravel < movement.minTravel) {
      if (movement.closeFallback.kind === "stomp") {
        return {
          x: enemy.x,
          y: enemy.y,
          movementKind: movement.kind,
          dangerKind: "landing",
        };
      }
      const perpendicular = { x: -direction.y, y: direction.x };
      const sideHopDistance = movement.closeFallback.distance;
      const alternatives = [-1, 1].map((side) => {
        const point = clampedActorPoint(
          enemy,
          enemy.x + perpendicular.x * sideHopDistance * side,
          enemy.y + perpendicular.y * sideHopDistance * side,
        );
        return {
          ...point,
          score: Math.hypot(point.x - run.player.x, point.y - run.player.y),
        };
      });
      const target = alternatives.sort((left, right) => right.score - left.score)[0];
      return {
        x: target.x,
        y: target.y,
        movementKind: movement.kind,
        dangerKind: "landing",
      };
    }
    const travel = Math.min(movement.maxTravel, desiredTravel);
    const target = clampedActorPoint(
      enemy,
      enemy.x + direction.x * travel,
      enemy.y + direction.y * travel,
    );
    return {
      ...target,
      movementKind: movement.kind,
      dangerKind: "landing",
    };
  }

  const crossGap = Math.max(movement.overshoot, safeDistance);
  const fullCrossTravel = distance + crossGap;
  const travel =
    fullCrossTravel <= movement.maxTravel
      ? fullCrossTravel
      : Math.max(0, Math.min(movement.maxTravel, distance - safeDistance));
  const target = clampedActorPoint(
    enemy,
    enemy.x + direction.x * travel,
    enemy.y + direction.y * travel,
  );
  return {
    ...target,
    movementKind: movement.kind,
    dangerKind: "swept",
  };
}

function scheduleEnemyPattern(
  run: RunState,
  enemy: Enemy,
  skill: EnemySkillDefinition,
  targetX: number,
  targetY: number,
) {
  const count =
    skill.behavior === "abacusThreeFive"
      ? (enemy.patternCycle ?? 1) % 2 === 1
        ? 3
        : 5
      : Math.max(1, skill.strikeCount ?? 1);
  const delayStep = skill.strikeDelay ?? 0.25;
  for (let index = 0; index < count; index += 1) {
    const centered = index - (count - 1) / 2;
    const angle =
      skill.mode === "burst"
        ? (Math.PI * 2 * index) / count
        : enemy.heading + Math.PI / 2;
    const spread =
      skill.mode === "burst"
        ? 72
        : centered * Math.min(42, skill.radius * 0.62);
    const x =
      skill.mode === "burst"
        ? targetX + Math.cos(angle) * spread
        : targetX + Math.cos(angle) * spread;
    const y =
      skill.mode === "burst"
        ? targetY + Math.sin(angle) * spread
        : targetY + Math.sin(angle) * spread;
    const delay =
      (skill.mode === "burst" ? 0.38 : 0.3) +
      index * delayStep;
    pushHostileStrike(run, {
      artKey: `${skill.artKey}/strike`,
      x: clamp(x, 40, GAME_WIDTH - 40),
      y: clamp(y, 40, GAME_HEIGHT - 40),
      radius: skill.radius,
      damage: enemy.damage,
      delay,
      maxDelay: delay,
    });
  }
}

function scheduleSlowHostileVolley(
  run: RunState,
  enemy: Enemy,
  skill: EnemySkillDefinition,
  count: number,
) {
  const baseAngle = Math.atan2(
    run.player.y - enemy.y,
    run.player.x - enemy.x,
  );
  for (let index = 0; index < count; index += 1) {
    const centered = index - (count - 1) / 2;
    const angle = baseAngle + centered * 0.17;
    const life = 2.75 + index * 0.08;
    pushHostileStrike(run, {
      artKey: `${skill.artKey}/slow-fire/${index + 1}`,
      x: enemy.x + Math.cos(angle) * (enemy.radius + 18),
      y: enemy.y + Math.sin(angle) * (enemy.radius + 18),
      radius: 18,
      damage: enemy.damage,
      delay: life,
      maxDelay: life,
      velocityX: Math.cos(angle) * 142,
      velocityY: Math.sin(angle) * 142,
      contactOnly: true,
    });
  }
}

function enemyLineSide(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
  y: number,
) {
  return (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
}

function distanceToSegmentSquared(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
  y: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.0001) return distanceSquared(x1, y1, x, y);
  const t = clamp(((x - x1) * dx + (y - y1) * dy) / lengthSquared, 0, 1);
  return distanceSquared(x1 + dx * t, y1 + dy * t, x, y);
}

function enemySkillUsesDashPath(skill: EnemySkillDefinition) {
  return skill.movement !== undefined;
}

function activeEnemySkillSlotIds(run: RunState, dashOnly = false) {
  const ids = new Set<number>();
  for (const enemy of run.enemies) {
    const action = enemy.action;
    if (!action || action.kind !== "enemySkill") continue;
    if (dashOnly && action.hostileTelegraph.movementKind === "stationary") {
      continue;
    }
    ids.add(action.slotId);
  }
  return ids;
}

function canBeginEnemySkill(
  run: RunState,
  skill: EnemySkillDefinition,
) {
  const pressure = getCombatPressureProfile(run);
  if (activeEnemySkillSlotIds(run).size >= pressure.enemySkillSlots) {
    return false;
  }
  return !enemySkillUsesDashPath(skill) ||
    activeEnemySkillSlotIds(run, true).size < pressure.enemyDashSlots;
}

function beginBossBreather(run: RunState) {
  run.enemySkillBreatherUntil = Math.max(
    run.enemySkillBreatherUntil,
    run.elapsed + BOSS_SKILL_BREATHER_SECONDS,
  );
}

function bossSkillCoordinatorActive(run: RunState, cooldownLookahead = 0) {
  if (run.elapsed < run.enemySkillBreatherUntil) return true;
  return run.enemies.some((enemy) => {
    if (!enemy.boss || enemy.hp <= 0) return false;
    if (enemy.action || enemy.motion === "attacking") return true;
    const cooldownScale = (enemy.ralliedUntil ?? 0) > run.elapsed ? 1.24 : 1;
    if (enemy.attackCooldown > cooldownLookahead * cooldownScale) return false;
    const distance = Math.hypot(
      enemy.x - run.player.x,
      enemy.y - run.player.y,
    );
    if (enemy.endlessBossId) {
      const definition = getEndlessBoss(enemy.endlessBossId);
      const skill = definition.skills[
        enemy.skillIndex % definition.skills.length
      ];
      return distance < skill.triggerRange;
    }
    return distance < 430;
  });
}

function assignEnemySkillAction(
  run: RunState,
  enemy: Enemy,
  skill: EnemySkillDefinition,
  target: MovementTargetResult,
  slotId: number,
  partnerId?: number,
) {
  const warningFxId = addFx(
    run,
    "warning",
    target.x,
    target.y,
    skill.radius,
    skill.telegraph + 0.18,
    enemy.elite ? "#8b573e" : "#73584a",
    `${skill.artKey}/warning`,
  );
  enemy.action = {
    kind: "enemySkill",
    skillId: skill.id,
    phase: "telegraph",
    elapsed: 0,
    startX: enemy.x,
    startY: enemy.y,
    targetX: target.x,
    targetY: target.y,
    committed: false,
    warningFxId,
    partnerId,
    slotId,
    hostileTelegraph: {
      kind: target.dangerKind,
      locked: true,
      startX: enemy.x,
      startY: enemy.y,
      targetX: target.x,
      targetY: target.y,
      radius: skill.radius,
      artKey: `${skill.artKey}/warning`,
      movementKind: target.movementKind,
      arcHeight: target.arcHeight,
    },
  };
  enemy.motion = "attacking";
  enemy.motionTime = 0;
  enemy.vx = 0;
  enemy.vy = 0;
}

function ensureShoePartner(run: RunState, enemy: Enemy): Enemy | undefined {
  const linked = run.enemies.find(
    (candidate) =>
      candidate.id === enemy.partnerId &&
      candidate.type === "shoe" &&
      candidate.hp > 0,
  );
  if (linked) return linked;
  const available = run.enemies.find(
    (candidate) =>
      candidate !== enemy &&
      candidate.type === "shoe" &&
      candidate.hp > 0 &&
      candidate.partnerId === undefined &&
      !candidate.intrusionAvatar,
  );
  if (available) {
    enemy.partnerId = available.id;
    available.partnerId = enemy.id;
    return available;
  }
  if (
    enemy.intrusionAvatar ||
    run.enemies.length >= ENDLESS_ACTOR_CAP ||
    (run.endlessDirector && run.endlessDirector.nonBossThreatBudget < 1)
  ) {
    return undefined;
  }
  const partner = spawnEnemy(run, "shoe", {
    x: clamp(run.player.x * 2 - enemy.x, 32, GAME_WIDTH - 32),
    y: clamp(run.player.y * 2 - enemy.y, 32, GAME_HEIGHT - 32),
  });
  enemy.partnerId = partner.id;
  partner.partnerId = enemy.id;
  partner.attackCooldown = Number.POSITIVE_INFINITY;
  if (run.endlessDirector) {
    run.endlessDirector.nonBossThreatBudget -= 1;
    run.endlessDirector.totalThreatSpent += 1;
    run.endlessDirector.commonSpawned += 1;
  }
  return partner;
}

function beginEnemySkill(
  run: RunState,
  enemy: Enemy,
  skill: EnemySkillDefinition,
) {
  if (skill.behavior === "pairedShoeCross") {
    const partner = ensureShoePartner(run, enemy);
    if (!skill.movement) return;
    const slotId = enemy.id;
    assignEnemySkillAction(
      run,
      enemy,
      skill,
      actionTarget(run, enemy, skill.movement),
      slotId,
      partner?.id,
    );
    if (partner) {
      assignEnemySkillAction(
        run,
        partner,
        skill,
        actionTarget(run, partner, skill.movement),
        slotId,
        enemy.id,
      );
    }
    enemy.patternCycle = (enemy.patternCycle ?? 0) + 1;
    return;
  }

  const target = skill.movement
    ? actionTarget(run, enemy, skill.movement)
    : {
        x: run.player.x,
        y: run.player.y,
        movementKind: "stationary" as const,
        dangerKind: "landing" as const,
      };
  assignEnemySkillAction(run, enemy, skill, target, enemy.id);
  enemy.patternCycle = (enemy.patternCycle ?? 0) + 1;

  if (skill.behavior === "puppetTripwire" && enemy.action?.kind === "enemySkill") {
    const direction = normalized(
      run.player.x - enemy.x,
      run.player.y - enemy.y,
    );
    const centerX = run.player.x - direction.x * 42;
    const centerY = run.player.y - direction.y * 42;
    const perpendicularX = -direction.y;
    const perpendicularY = direction.x;
    const halfLength = 245;
    enemy.action.lineX1 = centerX + perpendicularX * halfLength;
    enemy.action.lineY1 = centerY + perpendicularY * halfLength;
    enemy.action.lineX2 = centerX - perpendicularX * halfLength;
    enemy.action.lineY2 = centerY - perpendicularY * halfLength;
    enemy.action.previousPlayerSide = enemyLineSide(
      enemy.action.lineX1,
      enemy.action.lineY1,
      enemy.action.lineX2,
      enemy.action.lineY2,
      run.player.x,
      run.player.y,
    );
    addFx(
      run,
      "beam",
      enemy.action.lineX1,
      enemy.action.lineY1,
      20,
      skill.telegraph + skill.active,
      "#795363",
      `${skill.artKey}/thread`,
      { x2: enemy.action.lineX2, y2: enemy.action.lineY2 },
    );
    for (const [x, y] of [
      [enemy.action.lineX1, enemy.action.lineY1],
      [enemy.action.lineX2, enemy.action.lineY2],
    ] as const) {
      const life = skill.telegraph + skill.active;
      pushHostileStrike(run, {
        artKey: `${skill.artKey}/thread-anchor`,
        x,
        y,
        radius: 12,
        damage: enemy.damage,
        delay: life,
        maxDelay: life,
        contactOnly: true,
      });
    }
  }
}

function stepEnemySkill(
  run: RunState,
  enemy: Enemy,
  delta: number,
  events: RunEvent[],
): boolean {
  const action = enemy.action;
  if (!action || action.kind !== "enemySkill") return false;
  const definition = getEnemyDefinition(enemy.type);
  const skill =
    definition?.skill.id === action.skillId
      ? definition.skill
      : undefined;
  if (!skill) {
    enemy.action = undefined;
    enemy.motion = "moving";
    return false;
  }
  const haste = (enemy.ralliedUntil ?? 0) > run.elapsed ? 1.24 : 1;
  const scaledDelta = delta * (enemy.actionSpeed ?? 1) * haste;
  action.elapsed += scaledDelta;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.heading = Math.atan2(
    action.targetY - enemy.y,
    action.targetX - enemy.x,
  );

  if (action.phase === "telegraph") {
    if (action.elapsed >= skill.telegraph) {
      action.phase = "active";
      action.elapsed = 0;
    }
    return true;
  }

  if (action.phase === "active") {
    const moving =
      skill.mode === "dash" ||
      skill.mode === "hop" ||
      skill.mode === "pounce";
    if (moving) {
      const ratio = clamp(action.elapsed / skill.active, 0, 1);
      const eased = ratio * ratio * (3 - 2 * ratio);
      const previousX = enemy.x;
      const previousY = enemy.y;
      let x =
        action.startX + (action.targetX - action.startX) * eased;
      let y =
        action.startY + (action.targetY - action.startY) * eased;
      if (
        action.hostileTelegraph.movementKind === "flyby" &&
        action.hostileTelegraph.arcHeight !== undefined
      ) {
        const dx = action.targetX - action.startX;
        const dy = action.targetY - action.startY;
        const distance = Math.hypot(dx, dy) || 1;
        const arc =
          Math.sin(ratio * Math.PI) * action.hostileTelegraph.arcHeight;
        x += (-dy / distance) * arc;
        y += (dx / distance) * arc;
      }
      if (action.hostileTelegraph.movementKind === "flyby") {
        enemy.x = x;
        enemy.y = y;
      } else {
        enemy.x = clamp(x, enemy.radius, GAME_WIDTH - enemy.radius);
        enemy.y = clamp(y, enemy.radius, GAME_HEIGHT - enemy.radius);
      }
      enemy.travelled += Math.hypot(
        enemy.x - previousX,
        enemy.y - previousY,
      );
      const contactDuringTravel =
        action.hostileTelegraph.kind === "swept";
      if (
        contactDuringTravel &&
        !action.playerHitCommitted &&
        distanceSquared(
          enemy.x,
          enemy.y,
          run.player.x,
          run.player.y,
        ) <=
          (skill.radius + PLAYER_HIT_RADIUS) ** 2
      ) {
        action.playerHitCommitted = true;
        if (hurtPlayer(run, enemy.damage)) {
          events.push({ type: "playerHit" });
        }
        if (enemy.action !== action) return true;
      }
      if (ratio >= 1 && !action.committed) {
        action.committed = true;
        addFx(
          run,
          "burst",
          enemy.x,
          enemy.y,
          skill.radius,
          0.42,
          "#7a5544",
          `${skill.artKey}/impact`,
        );
        if (
          !contactDuringTravel &&
          !action.playerHitCommitted &&
          distanceSquared(
            enemy.x,
            enemy.y,
            run.player.x,
            run.player.y,
          ) <=
            (skill.radius + PLAYER_HIT_RADIUS) ** 2 &&
          hurtPlayer(run, enemy.damage)
        ) {
          action.playerHitCommitted = true;
          events.push({ type: "playerHit" });
        }
        if (enemy.action !== action) return true;
      }
      if (
        ratio >= 1 &&
        !action.followupCommitted &&
        skill.behavior === "umbrellaGuard"
      ) {
        action.followupCommitted = true;
        for (const protectedEnemy of nearbyEnemies(
          run,
          enemy.x,
          enemy.y,
          225,
          "umbrella-guard",
        )) {
          if (protectedEnemy.hp <= 0 || protectedEnemy.boss) continue;
          protectedEnemy.guardedUntil = Math.max(
            protectedEnemy.guardedUntil ?? 0,
            run.elapsed + 2.25,
          );
          protectedEnemy.guardFacing = Math.atan2(
            run.player.y - protectedEnemy.y,
            run.player.x - protectedEnemy.x,
          );
        }
        addFx(
          run,
          "wave",
          enemy.x,
          enemy.y,
          225,
          0.55,
          "#60766d",
          `${skill.artKey}/guard`,
        );
      }
      if (
        ratio >= 1 &&
        !action.followupCommitted &&
        skill.behavior === "lionChargeRoar"
      ) {
        action.followupCommitted = true;
        for (const rallied of nearbyEnemies(
          run,
          enemy.x,
          enemy.y,
          320,
          "lion-rally",
        )) {
          if (rallied.hp <= 0 || rallied.boss || rallied === enemy) continue;
          rallied.ralliedUntil = Math.max(
            rallied.ralliedUntil ?? 0,
            run.elapsed + 2.8,
          );
        }
        addFx(
          run,
          "wave",
          enemy.x,
          enemy.y,
          320,
          0.64,
          "#9a5a3d",
          `${skill.artKey}/roar`,
        );
      }
    } else if (!action.committed) {
      if (skill.behavior === "puppetTripwire") {
        const { lineX1, lineY1, lineX2, lineY2 } = action;
        if (
          lineX1 !== undefined &&
          lineY1 !== undefined &&
          lineX2 !== undefined &&
          lineY2 !== undefined
        ) {
          const side = enemyLineSide(
            lineX1,
            lineY1,
            lineX2,
            lineY2,
            run.player.x,
            run.player.y,
          );
          const crossed =
            action.previousPlayerSide !== undefined &&
            side * action.previousPlayerSide < 0;
          const touching =
            distanceToSegmentSquared(
              lineX1,
              lineY1,
              lineX2,
              lineY2,
              run.player.x,
              run.player.y,
            ) <= 20 ** 2;
          if (crossed || touching) {
            action.committed = true;
            addFx(
              run,
              "beam",
              lineX1,
              lineY1,
              28,
              0.35,
              "#9d4550",
              `${skill.artKey}/close`,
              { x2: lineX2, y2: lineY2 },
            );
            if (hurtPlayer(run, enemy.damage)) {
              events.push({ type: "playerHit" });
            }
            if (enemy.action !== action) return true;
          }
          action.previousPlayerSide = side;
        }
      } else {
        action.committed = true;
        if (skill.behavior === "lanternSlowFire") {
          scheduleSlowHostileVolley(run, enemy, skill, 3);
        } else {
          scheduleEnemyPattern(
            run,
            enemy,
            skill,
            action.targetX,
            action.targetY,
          );
        }
        addFx(
          run,
          "burst",
          enemy.x,
          enemy.y,
          skill.radius,
          0.38,
          "#705747",
          `${skill.artKey}/cast`,
        );
      }
    }
    if (action.elapsed >= skill.active) {
      action.phase = "recovery";
      action.elapsed = 0;
    }
    return true;
  }

  if (action.elapsed >= skill.recovery) {
    if (skill.behavior === "fishFlyby") {
      enemy.x = action.targetX;
      enemy.y = action.targetY;
      const returnDirection = normalized(
        run.player.x - enemy.x,
        run.player.y - enemy.y,
      );
      enemy.heading = Math.atan2(returnDirection.y, returnDirection.x);
      enemy.vx = returnDirection.x * enemy.speed;
      enemy.vy = returnDirection.y * enemy.speed;
    }
    enemy.action = undefined;
    enemy.motion = "moving";
    enemy.motionTime = 0;
    enemy.attackCooldown =
      skill.cooldown / Math.max(1, enemy.actionSpeed ?? 1);
    if (enemy.partnerId !== undefined && skill.behavior === "pairedShoeCross") {
      const partner = run.enemies.find(
        (candidate) => candidate.id === enemy.partnerId && candidate.hp > 0,
      );
      if (partner && partner.attackCooldown === Number.POSITIVE_INFINITY) {
        partner.attackCooldown = enemy.attackCooldown;
      }
    }
  }
  return true;
}

function scheduleBossVolley(
  run: RunState,
  enemy: Enemy,
  skill: BossSkillDefinition,
  targetX: number,
  targetY: number,
  delayOffset = 0,
) {
  const phaseBonus =
    enemy.endlessBossId && enemy.bossPhase === 2
      ? getEndlessBoss(enemy.endlessBossId).halfHealth.patternBonus
      : 0;
  const count = Math.max(1, (skill.count ?? 1) + phaseBonus);
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + enemy.heading;
    const band = 42 + (index % 3) * 38;
    const delay =
      delayOffset + 0.48 + index * (skill.delay ?? 0.2);
    pushHostileStrike(run, {
      artKey: `${skill.artKey}/strike`,
      x: clamp(
        targetX + Math.cos(angle) * band,
        45,
        GAME_WIDTH - 45,
      ),
      y: clamp(
        targetY + Math.sin(angle) * band,
        45,
        GAME_HEIGHT - 45,
      ),
      radius: skill.radius,
      damage: enemy.damage,
      delay,
      maxDelay: delay,
    }, "boss");
  }
}

function pushBossStrike(
  run: RunState,
  enemy: Enemy,
  skill: BossSkillDefinition,
  x: number,
  y: number,
  delay: number,
  options: {
    radius?: number;
    velocityX?: number;
    velocityY?: number;
    contactOnly?: boolean;
    suffix?: string;
  } = {},
) {
  pushHostileStrike(run, {
    artKey: `${skill.artKey}/${options.suffix ?? "strike"}`,
    x: clamp(x, -70, GAME_WIDTH + 70),
    y: clamp(y, -70, GAME_HEIGHT + 70),
    radius: options.radius ?? skill.radius,
    damage: enemy.damage,
    delay,
    maxDelay: delay,
    velocityX: options.velocityX,
    velocityY: options.velocityY,
    contactOnly: options.contactOnly,
  }, "boss");
}

function scheduleBossLine(
  run: RunState,
  enemy: Enemy,
  skill: BossSkillDefinition,
  centerX: number,
  centerY: number,
  angle: number,
  count: number,
  spacing: number,
  delayStep = 0.08,
  suffix = "line",
) {
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * spacing;
    pushBossStrike(
      run,
      enemy,
      skill,
      centerX + Math.cos(angle) * offset,
      centerY + Math.sin(angle) * offset,
      0.46 + index * delayStep,
      { suffix },
    );
  }
}

function scheduleBossArc(
  run: RunState,
  enemy: Enemy,
  skill: BossSkillDefinition,
  centerX: number,
  centerY: number,
  facing: number,
  count: number,
  distance: number,
  arc: number,
  suffix = "arc",
) {
  for (let index = 0; index < count; index += 1) {
    const ratio = count <= 1 ? 0.5 : index / (count - 1);
    const angle = facing + (ratio - 0.5) * arc;
    pushBossStrike(
      run,
      enemy,
      skill,
      centerX + Math.cos(angle) * distance,
      centerY + Math.sin(angle) * distance,
      0.42 + index * 0.07,
      { suffix },
    );
  }
}

function spawnBossReinforcements(
  run: RunState,
  enemy: Enemy,
  count: number,
  forcedType?: EnemyArchetype,
) {
  for (
    let index = 0;
    index < count && run.enemies.length < ENDLESS_ACTOR_CAP;
    index += 1
  ) {
    const angle = (Math.PI * 2 * index) / Math.max(1, count);
    spawnEnemy(run, forcedType ?? chooseFrom(run, COMMON_ENEMY_IDS), {
      x: clamp(
        enemy.x + Math.cos(angle) * 105,
        30,
        GAME_WIDTH - 30,
      ),
      y: clamp(
        enemy.y + Math.sin(angle) * 84,
        30,
        GAME_HEIGHT - 30,
      ),
    });
  }
}

function executeEndlessBossBehavior(
  run: RunState,
  enemy: Enemy,
  skill: BossSkillDefinition,
  targetX: number,
  targetY: number,
) {
  const phaseBonus =
    enemy.endlessBossId && enemy.bossPhase === 2
      ? getEndlessBoss(enemy.endlessBossId).halfHealth.patternBonus
      : 0;
  const facing = Math.atan2(targetY - enemy.y, targetX - enemy.x);
  switch (skill.behavior) {
    case "maskCrossing": {
      scheduleBossArc(
        run,
        enemy,
        skill,
        enemy.x,
        enemy.y,
        facing,
        5 + phaseBonus,
        105,
        Math.PI * 0.8,
        "mask-fan",
      );
      break;
    }
    case "fanCurtain": {
      scheduleBossArc(
        run,
        enemy,
        skill,
        targetX,
        targetY,
        facing + Math.PI,
        7 + phaseBonus * 2,
        150,
        Math.PI * 1.15,
        "fan-curtain",
      );
      break;
    }
    case "shadowCast": {
      const before = run.enemies.length;
      spawnBossReinforcements(run, enemy, 3 + phaseBonus, "puppet");
      for (let index = before; index < run.enemies.length; index += 1) {
        run.enemies[index].attackCooldown = 0.45 + (index - before) * 0.2;
        run.enemies[index].artKey = `${skill.artKey}/shadow`;
      }
      break;
    }
    case "inkGrid": {
      const count = 7 + phaseBonus * 2;
      scheduleBossLine(
        run,
        enemy,
        skill,
        targetX,
        targetY,
        0,
        count,
        64,
        0.045,
        "grid-horizontal",
      );
      scheduleBossLine(
        run,
        enemy,
        skill,
        targetX,
        targetY,
        Math.PI / 2,
        count,
        54,
        0.045,
        "grid-vertical",
      );
      break;
    }
    case "fallingSeal": {
      const count = 1 + phaseBonus;
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / Math.max(1, count);
        pushBossStrike(
          run,
          enemy,
          skill,
          targetX + Math.cos(angle) * index * 96,
          targetY + Math.sin(angle) * index * 72,
          0.82 + index * 0.22,
          { radius: skill.radius, suffix: "falling-seal" },
        );
      }
      break;
    }
    case "orderedClosure": {
      const width = 310;
      const height = 210;
      const count = 5 + phaseBonus;
      scheduleBossLine(run, enemy, skill, targetX, targetY - height / 2, 0, count, width / (count - 1), 0.08, "close-top");
      scheduleBossLine(run, enemy, skill, targetX + width / 2, targetY, Math.PI / 2, count, height / (count - 1), 0.08, "close-right");
      scheduleBossLine(run, enemy, skill, targetX, targetY + height / 2, 0, count, width / (count - 1), 0.08, "close-bottom");
      scheduleBossLine(run, enemy, skill, targetX - width / 2, targetY, Math.PI / 2, count, height / (count - 1), 0.08, "close-left");
      break;
    }
    case "bellRings": {
      for (let ring = 0; ring < 2 + phaseBonus; ring += 1) {
        const count = 8 + ring * 2;
        const radius = 92 + ring * 88;
        for (let index = 0; index < count; index += 1) {
          const angle = (Math.PI * 2 * index) / count;
          pushBossStrike(
            run,
            enemy,
            skill,
            enemy.x + Math.cos(angle) * radius,
            enemy.y + Math.sin(angle) * radius,
            0.48 + ring * 0.34,
            { radius: Math.min(44, skill.radius * 0.24), suffix: `bell-ring-${ring + 1}` },
          );
        }
      }
      break;
    }
    case "lanternPatrol": {
      scheduleBossArc(run, enemy, skill, enemy.x, enemy.y, facing, 3 + phaseBonus, 132, Math.PI * 0.45, "lantern-cone");
      break;
    }
    case "thirdWatchCone": {
      const rays = 3 + phaseBonus;
      for (let ray = 0; ray < rays; ray += 1) {
        const rayAngle = facing + (ray - (rays - 1) / 2) * 0.22;
        for (let step = 1; step <= 4; step += 1) {
          pushBossStrike(
            run,
            enemy,
            skill,
            enemy.x + Math.cos(rayAngle) * step * 105,
            enemy.y + Math.sin(rayAngle) * step * 105,
            0.38 + step * 0.12,
            { radius: Math.min(58, skill.radius), suffix: "watch-cone" },
          );
        }
      }
      break;
    }
    case "rollingClay": {
      const count = 3 + phaseBonus;
      for (let index = 0; index < count; index += 1) {
        const angle = facing + (index - (count - 1) / 2) * 0.18;
        const life = 3.4;
        pushBossStrike(run, enemy, skill, enemy.x, enemy.y, life, {
          radius: 26,
          velocityX: Math.cos(angle) * 175,
          velocityY: Math.sin(angle) * 175,
          contactOnly: true,
          suffix: "rolling-clay",
        });
      }
      break;
    }
    case "kilnFireLanes": {
      const lanes = 3 + phaseBonus;
      for (let lane = 0; lane < lanes; lane += 1) {
        const side = (lane - (lanes - 1) / 2) * 82;
        const perpendicular = facing + Math.PI / 2;
        const centerX = targetX + Math.cos(perpendicular) * side;
        const centerY = targetY + Math.sin(perpendicular) * side;
        scheduleBossLine(run, enemy, skill, centerX, centerY, facing, 5, 86, 0.12, "kiln-lane");
      }
      break;
    }
    case "furnaceBlast": {
      scheduleBossArc(run, enemy, skill, enemy.x, enemy.y, facing, 5 + phaseBonus, 142, Math.PI * 0.72, "furnace-blast");
      break;
    }
    case "turretVolley": {
      const count = 7 + phaseBonus * 2;
      for (let index = 0; index < count; index += 1) {
        const angle = facing + (index - (count - 1) / 2) * 0.075;
        const life = 2.4;
        pushBossStrike(run, enemy, skill, enemy.x, enemy.y, life, {
          radius: 16,
          velocityX: Math.cos(angle) * 260,
          velocityY: Math.sin(angle) * 260,
          contactOnly: true,
          suffix: "turret-bolt",
        });
      }
      break;
    }
    case "edgeDeployment": {
      const count = 2 + phaseBonus;
      for (let index = 0; index < count; index += 1) {
        if (run.enemies.length >= ENDLESS_ACTOR_CAP) break;
        const x = index % 2 === 0 ? 44 : GAME_WIDTH - 44;
        const y = clamp(targetY + (index - (count - 1) / 2) * 128, 70, GAME_HEIGHT - 70);
        const deployed = spawnEnemy(run, "abacus", { x, y });
        deployed.attackCooldown = 0.38 + index * 0.16;
        deployed.artKey = `${skill.artKey}/deployed-turret`;
        scheduleBossLine(run, enemy, skill, (x + targetX) / 2, y, 0, 5, Math.abs(targetX - x) / 5, 0.1, "edge-fire");
      }
      break;
    }
    case "sweepingArm": {
      scheduleBossLine(run, enemy, skill, enemy.x, enemy.y, facing + Math.PI / 2, 9 + phaseBonus, 54, 0.045, "sweeping-arm");
      break;
    }
    case "spearPass": {
      scheduleBossLine(run, enemy, skill, enemy.x, enemy.y, facing + Math.PI, 6 + phaseBonus, 58, 0.045, "spear-trail");
      break;
    }
    case "plantFlags": {
      const count = 3 + phaseBonus;
      const before = run.enemies.length;
      spawnBossReinforcements(run, enemy, count, "shoe");
      for (let index = before; index < run.enemies.length; index += 1) {
        run.enemies[index].ralliedUntil = run.elapsed + 4.5;
        run.enemies[index].artKey = `${skill.artKey}/flag-guard`;
      }
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count;
        pushBossStrike(run, enemy, skill, enemy.x + Math.cos(angle) * 165, enemy.y + Math.sin(angle) * 125, 0.7 + index * 0.12, { radius: 48, suffix: "planted-flag" });
      }
      break;
    }
    case "commandFormation": {
      const followers = nearbyEnemies(run, enemy.x, enemy.y, 620, "banner-command")
        .filter((candidate) => !candidate.boss && candidate.hp > 0)
        .slice(0, 8 + phaseBonus * 2);
      for (let index = 0; index < followers.length; index += 1) {
        const follower = followers[index];
        follower.ralliedUntil = run.elapsed + 3.8;
        follower.heading = normalizeAngle(
          facing + (index - (followers.length - 1) / 2) * 0.075,
        );
        follower.attackCooldown = Math.min(follower.attackCooldown, 0.32 + index * 0.05);
      }
      scheduleBossLine(run, enemy, skill, targetX, targetY, facing + Math.PI / 2, 7 + phaseBonus, 68, 0.08, "formation-line");
      break;
    }
  }
}

function applyEndlessBossTraits(
  run: RunState,
  enemy: Enemy,
  definition: ReturnType<typeof getEndlessBoss>,
  skill: BossSkillDefinition,
  targetX: number,
  targetY: number,
) {
  if (enemy.bossTraits?.includes("reinforcements")) {
    spawnBossReinforcements(run, enemy, 2);
  }
  if (enemy.bossTraits?.includes("lingeringGround")) {
    const delay = 0.82;
    pushHostileStrike(run, {
      artKey: `${definition.artKey}/trait/lingering-ground`,
      x: targetX,
      y: targetY,
      radius: Math.max(86, skill.radius * 0.72),
      damage: enemy.damage,
      delay,
      maxDelay: delay,
    }, "boss");
  }
  if (enemy.bossTraits?.includes("delayedRepeat")) {
    scheduleBossVolley(
      run,
      enemy,
      { ...skill, count: Math.min(3, skill.count ?? 1) },
      targetX,
      targetY,
      1.05,
    );
  }
}

function beginEndlessBossSkill(run: RunState, enemy: Enemy) {
  if (!enemy.endlessBossId) return;
  const definition = getEndlessBoss(enemy.endlessBossId);
  const skill =
    definition.skills[enemy.skillIndex % definition.skills.length];
  enemy.skillIndex += 1;
  const target = skill.movement
    ? actionTarget(run, enemy, skill.movement)
    : {
        x: run.player.x,
        y: run.player.y,
        movementKind: "stationary" as const,
        dangerKind: "landing" as const,
      };
  const bossPhase = enemy.bossPhase ?? 1;
  const telegraphScale =
    bossPhase === 2 ? definition.halfHealth.telegraphScale : 1;
  const telegraphDuration =
    skill.mode === "dash"
      ? Math.max(0.48, skill.telegraph * telegraphScale)
      : skill.telegraph * telegraphScale;
  const warningFxId = addFx(
    run,
    "warning",
    target.x,
    target.y,
    skill.radius,
    telegraphDuration + 0.24,
    "#8e4336",
    `${skill.artKey}/warning`,
  );
  enemy.action = {
    kind: "endlessBossSkill",
    skillId: skill.id,
    phase: "telegraph",
    elapsed: 0,
    startX: enemy.x,
    startY: enemy.y,
    targetX: target.x,
    targetY: target.y,
    committed: false,
    warningFxId,
    bossPhase,
    hostileTelegraph: {
      kind: target.dangerKind,
      locked: true,
      startX: enemy.x,
      startY: enemy.y,
      targetX: target.x,
      targetY: target.y,
      radius: skill.radius,
      artKey: `${skill.artKey}/warning`,
      movementKind: target.movementKind,
      arcHeight: target.arcHeight,
    },
  };
  enemy.motion = "attacking";
  enemy.motionTime = 0;
  enemy.vx = 0;
  enemy.vy = 0;
}

function stepEndlessBossSkill(
  run: RunState,
  enemy: Enemy,
  delta: number,
  events: RunEvent[],
): boolean {
  const action = enemy.action;
  if (
    !action ||
    action.kind !== "endlessBossSkill" ||
    !enemy.endlessBossId
  ) {
    return false;
  }
  const definition = getEndlessBoss(enemy.endlessBossId);
  const skill = definition.skills.find(
    (candidate) => candidate.id === action.skillId,
  );
  if (!skill) {
    enemy.action = undefined;
    enemy.motion = "moving";
    return false;
  }
  const scaledDelta = delta * (enemy.actionSpeed ?? 1);
  action.elapsed +=
    action.phase === "telegraph" && skill.mode === "dash"
      ? delta
      : scaledDelta;
  enemy.vx = 0;
  enemy.vy = 0;

  if (action.phase === "telegraph") {
    enemy.heading = Math.atan2(
      action.targetY - enemy.y,
      action.targetX - enemy.x,
    );
    const authoredTelegraph =
      skill.telegraph *
      (action.bossPhase === 2
        ? definition.halfHealth.telegraphScale
        : 1);
    const telegraph =
      skill.mode === "dash"
        ? Math.max(0.48, authoredTelegraph)
        : authoredTelegraph;
    if (action.elapsed >= telegraph) {
      action.phase = "active";
      action.elapsed = 0;
    }
    return true;
  }

  if (action.phase === "active") {
    if (skill.mode === "dash") {
      const ratio = clamp(action.elapsed / skill.active, 0, 1);
      const eased = ratio * ratio * (3 - 2 * ratio);
      const previousX = enemy.x;
      const previousY = enemy.y;
      enemy.x =
        action.startX + (action.targetX - action.startX) * eased;
      enemy.y =
        action.startY + (action.targetY - action.startY) * eased;
      enemy.travelled += Math.hypot(
        enemy.x - previousX,
        enemy.y - previousY,
      );
      if (
        action.hostileTelegraph.kind === "swept" &&
        !action.playerHitCommitted &&
        distanceSquared(
          enemy.x,
          enemy.y,
          run.player.x,
          run.player.y,
        ) <=
          (skill.radius + PLAYER_HIT_RADIUS) ** 2
      ) {
        action.playerHitCommitted = true;
        if (hurtPlayer(run, enemy.damage)) {
          events.push({ type: "playerHit" });
        }
        if (enemy.action !== action) return true;
      }
      if (ratio >= 1 && !action.committed) {
        action.committed = true;
        if (
          action.hostileTelegraph.kind === "landing" &&
          !action.playerHitCommitted &&
          distanceSquared(
            enemy.x,
            enemy.y,
            run.player.x,
            run.player.y,
          ) <=
            (skill.radius + PLAYER_HIT_RADIUS) ** 2 &&
          hurtPlayer(run, enemy.damage)
        ) {
          action.playerHitCommitted = true;
          events.push({ type: "playerHit" });
        }
        if (enemy.action !== action) return true;
        executeEndlessBossBehavior(
          run,
          enemy,
          skill,
          action.targetX,
          action.targetY,
        );
        applyEndlessBossTraits(
          run,
          enemy,
          definition,
          skill,
          enemy.x,
          enemy.y,
        );
      }
    } else if (!action.committed) {
      action.committed = true;
      executeEndlessBossBehavior(
        run,
        enemy,
        skill,
        action.targetX,
        action.targetY,
      );
      applyEndlessBossTraits(
        run,
        enemy,
        definition,
        skill,
        action.targetX,
        action.targetY,
      );
    }
    if (action.elapsed >= skill.active) {
      action.phase = "recovery";
      action.elapsed = 0;
      addFx(
        run,
        "burst",
        enemy.x,
        enemy.y,
        skill.radius,
        0.42,
        "#913f34",
        `${skill.artKey}/finish`,
      );
    }
    return true;
  }

  const recovery = enemy.bossTraits?.includes("quickRecovery")
    ? skill.recovery * 0.7
    : skill.recovery;
  if (action.elapsed >= recovery) {
    enemy.action = undefined;
    enemy.motion = "moving";
    enemy.motionTime = 0;
    const recoveryScale = enemy.bossTraits?.includes("quickRecovery")
      ? 0.78
      : 1;
    const phaseRecoveryScale =
      action.bossPhase === 2 ? definition.halfHealth.cooldownScale : 1;
    enemy.attackCooldown =
      (skill.cooldown * recoveryScale * phaseRecoveryScale) /
      Math.max(1, enemy.actionSpeed ?? 1);
    beginBossBreather(run);
  }
  return true;
}

function beginNianLeap(run: RunState, enemy: Enemy) {
  const target = actionTarget(run, enemy, {
    kind: "landShort",
    maxTravel: 520,
    minTravel: 110,
    clearance: 8,
    closeFallback: { kind: "stomp" },
  });
  const warningFxId = addFx(
    run,
    "warning",
    target.x,
    target.y,
    150,
    NIAN_LEAP_TELEGRAPH_SECONDS + 0.18,
    "#a94838",
    "boss/nian/leap-warning",
  );
  enemy.action = {
    kind: "nianLeap",
    phase: "telegraph",
    elapsed: 0,
    startX: enemy.x,
    startY: enemy.y,
    targetX: target.x,
    targetY: target.y,
    warningFxId,
    hostileTelegraph: {
      kind: "landing",
      locked: true,
      startX: enemy.x,
      startY: enemy.y,
      targetX: target.x,
      targetY: target.y,
      radius: 150,
      artKey: "boss/nian/leap-warning",
      movementKind: target.movementKind,
    },
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
    enemy.heading = Math.atan2(
      action.targetY - enemy.y,
      action.targetX - enemy.x,
    );
    if (action.elapsed >= NIAN_LEAP_TELEGRAPH_SECONDS) {
      action.startX = enemy.x;
      action.startY = enemy.y;
      action.phase = "active";
      action.elapsed = 0;
    }
    return true;
  }

  if (action.phase === "active") {
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
      action.phase = "impact";
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
        hurtPlayer(run, enemy.damage)
      ) {
        events.push({ type: "playerHit" });
      }
      if (enemy.action !== action) return true;
    }
    return true;
  }

  if (action.phase === "impact") {
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
    beginBossBreather(run);
  }
  return true;
}

function beginTaotieCharge(run: RunState, enemy: Enemy) {
  const target = actionTarget(run, enemy, {
    kind: "crossTarget",
    maxTravel: 420,
    overshoot: 84,
    clearance: 8,
    sweptDamage: true,
  });
  const warningFxId = addFx(
    run,
    "warning",
    target.x,
    target.y,
    120,
    TAOTIE_CHARGE_TELEGRAPH_SECONDS + 0.18,
    "#55776e",
    "boss/taotie/charge-warning",
  );
  enemy.action = {
    kind: "taotieCharge",
    phase: "telegraph",
    elapsed: 0,
    startX: enemy.x,
    startY: enemy.y,
    targetX: target.x,
    targetY: target.y,
    committed: false,
    warningFxId,
    hostileTelegraph: {
      kind: "swept",
      locked: true,
      startX: enemy.x,
      startY: enemy.y,
      targetX: target.x,
      targetY: target.y,
      radius: 120,
      artKey: "boss/taotie/charge-warning",
      movementKind: "crossTarget",
    },
  };
  enemy.motion = "attacking";
  enemy.motionTime = 0;
  enemy.attackCommitted = true;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.skillIndex += 1;
}

function stepTaotieCharge(
  run: RunState,
  enemy: Enemy,
  delta: number,
  events: RunEvent[],
) {
  const action = enemy.action;
  if (!action || action.kind !== "taotieCharge") return false;
  action.elapsed += delta;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.heading = Math.atan2(
    action.targetY - enemy.y,
    action.targetX - enemy.x,
  );

  if (action.phase === "telegraph") {
    if (action.elapsed >= TAOTIE_CHARGE_TELEGRAPH_SECONDS) {
      action.phase = "active";
      action.elapsed = 0;
    }
    return true;
  }

  if (action.phase === "active") {
    const ratio = clamp(action.elapsed / 0.46, 0, 1);
    const eased = ratio * ratio * (3 - 2 * ratio);
    const previousX = enemy.x;
    const previousY = enemy.y;
    enemy.x =
      action.startX + (action.targetX - action.startX) * eased;
    enemy.y =
      action.startY + (action.targetY - action.startY) * eased;
    enemy.travelled += Math.hypot(
      enemy.x - previousX,
      enemy.y - previousY,
    );
    if (
      !action.playerHitCommitted &&
      distanceSquared(
        enemy.x,
        enemy.y,
        run.player.x,
        run.player.y,
      ) <=
        (120 + PLAYER_HIT_RADIUS) ** 2
    ) {
      action.playerHitCommitted = true;
      if (hurtPlayer(run, enemy.damage)) {
        events.push({ type: "playerHit" });
      }
      if (enemy.action !== action) return true;
    }
    if (ratio >= 1) {
      action.phase = "impact";
      action.elapsed = 0;
      if (!action.committed) {
        action.committed = true;
        addFx(
          run,
          "ink",
          enemy.x,
          enemy.y,
          120,
          0.55,
          "#55776e",
          "boss/taotie/charge",
        );
      }
    }
    return true;
  }

  if (action.phase === "impact") {
    if (action.elapsed >= 0.12) {
      action.phase = "recovery";
      action.elapsed = 0;
    }
    return true;
  }

  if (action.elapsed >= 0.45) {
    enemy.action = undefined;
    enemy.motion = "moving";
    enemy.motionTime = 0;
    enemy.attackCooldown = 3.5;
    beginBossBreather(run);
  }
  return true;
}

function scheduleNianMeteorPattern(run: RunState) {
  const corridorCenterX = clamp(run.player.x, 250, GAME_WIDTH - 250);
  const radius = 250;
  const offset =
    NIAN_METEOR_SAFE_CORRIDOR / 2 + radius + PLAYER_HIT_RADIUS + 12;
  const zones = [
    { x: corridorCenterX - offset, y: 180 },
    { x: corridorCenterX + offset, y: 360 },
    { x: corridorCenterX - offset, y: 540 },
  ];
  zones.forEach((zone, index) => {
    pushHostileStrike(run, {
      artKey: `boss/nian/meteor-${index + 1}`,
      x: zone.x,
      y: zone.y,
      radius,
      damage: 1,
      delay: NIAN_METEOR_TELEGRAPH_SECONDS,
      maxDelay: NIAN_METEOR_TELEGRAPH_SECONDS,
    }, "boss");
  });
}

function scheduleNianRingWithGap(run: RunState, enemy: Enemy) {
  const safeAngle = Math.atan2(
    run.player.y - enemy.y,
    run.player.x - enemy.x,
  );
  const ringRadius = 220;
  const strikeRadius = 48;
  // The centre gap is wider than the authored 100 degrees so the physical
  // circles cannot nibble into the promised escape sector.
  const excludedHalfAngle = (70 * Math.PI) / 180;
  for (let index = 0; index < 18; index += 1) {
    const angle = (Math.PI * 2 * index) / 18;
    if (Math.abs(normalizeAngle(angle - safeAngle)) <= excludedHalfAngle) {
      continue;
    }
    pushHostileStrike(run, {
      artKey: "boss/nian/ring-spin",
      x: enemy.x + Math.cos(angle) * ringRadius,
      y: enemy.y + Math.sin(angle) * ringRadius,
      radius: strikeRadius,
      damage: enemy.damage,
      delay: 1.05,
      maxDelay: 1.05,
    }, "boss");
  }
}

function scheduleTaotieShock(run: RunState, enemy: Enemy) {
  pushHostileStrike(run, {
    artKey: "boss/taotie/shock",
    x: enemy.x,
    y: enemy.y,
    radius: 205,
    damage: enemy.damage,
    delay: 1,
    maxDelay: 1,
  }, "boss");
}

function scheduleTaotieSuction(run: RunState, enemy: Enemy) {
  const targetX = run.player.x;
  const targetY = run.player.y;
  for (const [index, ratio] of [0.35, 0.65, 0.95].entries()) {
    pushHostileStrike(run, {
      artKey: `boss/taotie/suction-lane-${index + 1}`,
      x: enemy.x + (targetX - enemy.x) * ratio,
      y: enemy.y + (targetY - enemy.y) * ratio,
      radius: 72,
      damage: enemy.damage,
      delay: 1.05,
      maxDelay: 1.05,
    }, "boss");
  }
}

function prepareStandardBossSkill(run: RunState, enemy: Enemy) {
  const ability = enemy.skillIndex % 3;
  if (enemy.type === "nian") {
    if (ability === 1) scheduleNianMeteorPattern(run);
    else if (ability === 2) scheduleNianRingWithGap(run, enemy);
  } else if (enemy.type === "taotie") {
    if (ability === 1) scheduleTaotieShock(run, enemy);
    else if (ability === 2) scheduleTaotieSuction(run, enemy);
  }
}

function stepStandardBossWindup(run: RunState, enemy: Enemy, delta: number) {
  if (
    enemy.type !== "taotie" ||
    enemy.skillIndex % 3 !== 2 ||
    enemy.motion !== "attacking" ||
    enemy.motionTime >= 0.82
  ) {
    return;
  }
  const pull = normalized(enemy.x - run.player.x, enemy.y - run.player.y);
  run.player.x = clamp(
    run.player.x + pull.x * 58 * delta,
    PLAYER_HIT_RADIUS,
    GAME_WIDTH - PLAYER_HIT_RADIUS,
  );
  run.player.y = clamp(
    run.player.y + pull.y * 58 * delta,
    PLAYER_HIT_RADIUS,
    GAME_HEIGHT - PLAYER_HIT_RADIUS,
  );
}

function executeBossSkill(run: RunState, enemy: Enemy) {
  const ability = enemy.skillIndex % 3;
  if (enemy.type === "taotie") {
    if (ability === 0) {
      if (!enemy.action) beginTaotieCharge(run, enemy);
    }
  } else if (enemy.type === "nian") {
    if (ability === 0) {
      // The leap begins at attack wind-up so it can be shown continuously.
      // This fallback is retained for malformed imported states.
      if (!enemy.action) beginNianLeap(run, enemy);
    }
  }
}

function triggerStepBack(run: RunState) {
  const rank = travelNoteRank(run, "stepBack");
  const effect = resolveTravelNoteEffect("stepBack", rank);
  const cooldownKey = "travel-note:step-back";
  if (rank <= 0 || (run.cooldowns.get(cooldownKey) ?? 0) > 0) return;
  const radius = effect.stepBackRadius;
  run.cooldowns.set(cooldownKey, effect.stepBackCooldown);
  for (const enemy of run.enemies) {
    if (enemy.hp <= 0 || enemy.boss) continue;
    const dx = enemy.x - run.player.x;
    const dy = enemy.y - run.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) continue;
    const direction = distance > 0.001
      ? { x: dx / distance, y: dy / distance }
      : { x: Math.cos(run.player.facing), y: Math.sin(run.player.facing) };
    const targetDistance = radius + enemy.radius + 12;
    const push = Math.max(32, targetDistance - distance);
    enemy.x = clamp(enemy.x + direction.x * push, -80, GAME_WIDTH + 80);
    enemy.y = clamp(enemy.y + direction.y * push, -80, GAME_HEIGHT + 80);
  }
  addFx(
    run,
    "ring",
    run.player.x,
    run.player.y,
    radius,
    0.36,
    "#7b8d80",
    "travel-note/step-back",
  );
}

function interruptEnemiesForHitRelief(run: RunState) {
  let interruptedBoss = false;
  for (const enemy of run.enemies) {
    if (enemy.hp <= 0) continue;
    interruptedBoss ||= enemy.boss &&
      (enemy.action !== undefined || enemy.motion === "attacking");
    enemy.action = undefined;
    enemy.attackCommitted = false;
    enemy.motion = "hurt";
    enemy.motionTime = 0;
    enemy.vx *= 0.12;
    enemy.vy *= 0.12;
    const respite = enemy.boss ? 1.1 : 0.85;
    enemy.attackCooldown = Math.max(
      Number.isFinite(enemy.attackCooldown) ? enemy.attackCooldown : 0,
      respite,
    );
  }
  if (interruptedBoss) beginBossBreather(run);
}

function applyHitRelief(run: RunState, relief: HitReliefKind) {
  // Hostile projectiles and delayed warning actors share PendingStrike. Never
  // delete player-owned attacks while opening this recovery window.
  run.strikes = run.strikes.filter((strike) => !strike.hostile);
  run.fx = run.fx.filter((fx) => {
    if (fx.kind === "warning") return false;
    const hostileBeam =
      fx.owner === undefined &&
      fx.kind === "beam" &&
      /^(enemy|boss|celestial)\//.test(fx.artKey);
    return !hostileBeam;
  });
  interruptEnemiesForHitRelief(run);

  if (relief === "strong") {
    for (const enemy of run.enemies) {
      if (
        enemy.hp <= 0 ||
        enemy.boss ||
        distanceSquared(
          enemy.x,
          enemy.y,
          run.player.x,
          run.player.y,
        ) > 520 ** 2
      ) {
        continue;
      }
      if (enemy.elite) {
        enemy.hp = Math.min(
          enemy.hp,
          Math.max(1, enemy.hp - enemy.maxHp * 0.45),
        );
      } else {
        enemy.hp = 0;
      }
    }
  }

  for (const enemy of run.enemies) {
    if (enemy.hp <= 0 || enemy.boss) continue;
    const dx = enemy.x - run.player.x;
    const dy = enemy.y - run.player.y;
    const distance = Math.hypot(dx, dy);
    const direction = distance > 0.001
      ? { x: dx / distance, y: dy / distance }
      : { x: Math.cos(run.player.facing), y: Math.sin(run.player.facing) };
    enemy.x = clamp(
      enemy.x + direction.x * 180,
      -80,
      GAME_WIDTH + 80,
    );
    enemy.y = clamp(
      enemy.y + direction.y * 180,
      -80,
      GAME_HEIGHT + 80,
    );
  }

  addFx(
    run,
    relief === "strong" ? "wave" : "ring",
    run.player.x,
    run.player.y,
    relief === "strong" ? 520 : 180,
    relief === "strong" ? 0.64 : 0.42,
    relief === "strong" ? "#d8c58d" : "#9a7760",
    `fx/player-hit-${relief}-relief`,
  );
}

function hurtPlayer(run: RunState, incomingDamage = 1) {
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
  if (run.difficultyId !== "oneLife" && run.player.life <= 1) {
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
  const damage = clamp(
    incomingDamage * run.testModifiers.incomingDamageScale,
    0,
    3,
  );
  if (damage <= 0) return false;
  const loss = damagePlayerLifeSegments(run, damage);
  if (loss.damage <= 0 || !loss.relief) return false;
  run.lastHitRelief = loss.relief;
  run.player.invulnerability =
    1.25 + resolveTravelNoteEffect(
      "slowPaper",
      travelNoteRank(run, "slowPaper"),
    ).extraInvulnerability;
  forceHumanForm(run.player);
  applyHitRelief(run, loss.relief);
  triggerStepBack(run);
  addFx(run, "burst", run.player.x, run.player.y, 76, 0.42, "#a54535", "fx/player-hit");
  dispatchAllOwnersTrigger(run, "onDamageTaken");
  return true;
}

function updateEnemies(run: RunState, delta: number, events: RunEvent[]) {
  let ordinarySkillStartsBlocked = bossSkillCoordinatorActive(run, delta);
  for (const enemy of run.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
    enemy.marked = Math.max(0, enemy.marked - delta);
    if (enemy.marked === 0) {
      enemy.markMultiplier = 1;
      enemy.markStacks = 0;
    }
    enemy.slow = Math.max(0, enemy.slow - delta);
    const ralliedScale = (enemy.ralliedUntil ?? 0) > run.elapsed ? 1.24 : 1;
    enemy.attackCooldown -= delta * ralliedScale;
    enemy.motionTime += delta;

    if (
      enemy.endlessBossId &&
      (enemy.bossPhase ?? 1) === 1 &&
      enemy.hp > 0 &&
      enemy.hp <= enemy.maxHp * 0.5
    ) {
      enemy.bossPhase = 2;
      enemy.attackCooldown = Math.min(enemy.attackCooldown, 0.28);
      addFx(
        run,
        "ring",
        enemy.x,
        enemy.y,
        enemy.radius * 2.4,
        0.85,
        "#a54337",
        `${getEndlessBoss(enemy.endlessBossId).artKey}/half-health`,
      );
    }

    if (
      stepTaotieCharge(run, enemy, delta, events) ||
      stepNianLeap(run, enemy, delta, events) ||
      stepEnemySkill(run, enemy, delta, events) ||
      stepEndlessBossSkill(run, enemy, delta, events)
    ) {
      continue;
    }

    if (enemy.motion === "hurt" && enemy.motionTime > 0.12) {
      enemy.motion = "moving";
      enemy.motionTime = 0;
    }

    const distanceToPlayer = Math.sqrt(distanceSquared(enemy.x, enemy.y, run.player.x, run.player.y));
    const attackRange = enemy.radius + 24;
    const enemyDefinition = getEnemyDefinition(enemy.type);
    if (
      enemy.endlessBossId &&
      enemy.attackCooldown <= 0
    ) {
      const bossDefinition = getEndlessBoss(enemy.endlessBossId);
      const nextSkill =
        bossDefinition.skills[
          enemy.skillIndex % bossDefinition.skills.length
        ];
      if (distanceToPlayer < nextSkill.triggerRange) {
        ordinarySkillStartsBlocked = true;
        beginEndlessBossSkill(run, enemy);
        continue;
      }
    }
    if (
      !enemy.boss &&
      enemyDefinition &&
      !ordinarySkillStartsBlocked &&
      enemy.attackCooldown <= 0 &&
      distanceToPlayer < enemyDefinition.skill.triggerRange &&
      canBeginEnemySkill(run, enemyDefinition.skill)
    ) {
      beginEnemySkill(run, enemy, enemyDefinition.skill);
      continue;
    }
    const isBossSkill =
      enemy.boss &&
      !enemy.endlessBossId &&
      enemy.attackCooldown <= 0 &&
      distanceToPlayer < 430;
    const isContactAttack =
      !enemy.boss &&
      !enemyDefinition &&
      enemy.attackCooldown <= 0 &&
      distanceToPlayer < attackRange + 18;
    if (enemy.motion !== "attacking" && (isBossSkill || isContactAttack)) {
      if (
        enemy.type === "taotie" &&
        isBossSkill &&
        enemy.skillIndex % 3 === 0
      ) {
        ordinarySkillStartsBlocked = true;
        beginTaotieCharge(run, enemy);
        continue;
      }
      if (
        enemy.type === "nian" &&
        isBossSkill &&
        enemy.skillIndex % 3 === 0
      ) {
        ordinarySkillStartsBlocked = true;
        beginNianLeap(run, enemy);
        continue;
      }
      enemy.motion = "attacking";
      enemy.motionTime = 0;
      enemy.attackCommitted = false;
      enemy.vx *= 0.16;
      enemy.vy *= 0.16;
      if (enemy.boss) {
        ordinarySkillStartsBlocked = true;
        prepareStandardBossSkill(run, enemy);
      }
    }

    if (enemy.motion === "attacking") {
      if (enemy.boss && !enemy.endlessBossId) {
        stepStandardBossWindup(run, enemy, delta);
      }
      const commitAt = enemy.boss ? 0.82 : 0.28;
      const finishAt = enemy.boss ? 1.32 : 0.58;
      if (!enemy.attackCommitted && enemy.motionTime >= commitAt) {
        enemy.attackCommitted = true;
        if (enemy.boss) {
          executeBossSkill(run, enemy);
          if (!enemy.action) enemy.skillIndex += 1;
        } else if (distanceToPlayer < attackRange + 24 && hurtPlayer(run, enemy.damage)) {
          events.push({ type: "playerHit" });
        }
      }
      if (enemy.motionTime >= finishAt) {
        enemy.motion = "moving";
        enemy.motionTime = 0;
        enemy.attackCooldown = enemy.boss ? 3.5 : 0.85;
        if (enemy.boss) beginBossBreather(run);
      }
      continue;
    }

    const playerAngle = Math.atan2(
      run.player.y - enemy.y,
      run.player.x - enemy.x,
    );
    let targetAngle = playerAngle;
    if (enemy.type === "lantern") {
      if (distanceToPlayer < 265) targetAngle = normalizeAngle(playerAngle + Math.PI);
      else if (distanceToPlayer < 390) {
        targetAngle = normalizeAngle(
          playerAngle + (enemy.id % 2 === 0 ? 1 : -1) * Math.PI * 0.48,
        );
      }
    } else if (enemy.type === "abacus" && distanceToPlayer < 360) {
      targetAngle = normalizeAngle(
        playerAngle + (enemy.id % 2 === 0 ? 1 : -1) * Math.PI * 0.42,
      );
    } else if (enemy.type === "shoe" && distanceToPlayer < 300) {
      targetAngle = normalizeAngle(
        playerAngle + (enemy.id % 2 === 0 ? 1 : -1) * 0.42,
      );
    }
    const turnRate =
      enemy.type === "lantern" && distanceToPlayer < 265
        ? enemy.turnSpeed * 3.2
        : enemy.turnSpeed;
    const turnDelta = clamp(
      normalizeAngle(targetAngle - enemy.heading),
      -turnRate * delta,
      turnRate * delta,
    );
    enemy.heading = normalizeAngle(enemy.heading + turnDelta);
    const separation = applySeparation(run, enemy);
    const fishCurve = enemy.type === "fish" ? Math.sin(run.elapsed * 2.6 + enemy.id) * 0.34 : 0;
    const desiredAngle = enemy.heading + fishCurve;
    const slowScale = enemy.slow > 0 ? 0.72 : 1;
    const desiredX = Math.cos(desiredAngle) * enemy.speed * slowScale * ralliedScale + separation.x * 42;
    const desiredY = Math.sin(desiredAngle) * enemy.speed * slowScale * ralliedScale + separation.y * 42;
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
    for (const enemy of nearbyEnemies(
      run,
      projectile.x,
      projectile.y,
      projectile.radius + 90,
      "projectile",
    )) {
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
  const projectilePool = objectPools(run).projectiles;
  recycleRejectedInPlace(
    run.projectiles,
    (projectile) =>
      projectile.life > 0 &&
      projectile.x > -140 &&
      projectile.x < GAME_WIDTH + 140 &&
      projectile.y > -140 &&
      projectile.y < GAME_HEIGHT + 140,
    projectilePool,
  );
  keepNewestAndRecycleInPlace(run.projectiles, 460, projectilePool);
}

function updateZones(run: RunState, delta: number) {
  for (const zone of run.zones) {
    zone.life -= delta;
    zone.tick -= delta;
    if (zone.followsPlayer) {
      zone.x = run.player.x;
      zone.y = run.player.y;
    }
    const zoneCandidates = nearbyEnemies(
      run,
      zone.x,
      zone.y,
      zone.radius + 90,
      "zone",
    );
    ZONE_INSIDE_SCRATCH.clear();
    for (const enemy of zoneCandidates) {
      if (
        enemy.hp > 0 &&
        distanceSquared(zone.x, zone.y, enemy.x, enemy.y) <=
          (zone.radius + enemy.radius) ** 2
      ) {
        ZONE_INSIDE_SCRATCH.add(enemy.id);
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
    zone.enteredEnemyIds.clear();
    for (const enemyId of ZONE_INSIDE_SCRATCH) {
      zone.enteredEnemyIds.add(enemyId);
    }
    if (zone.tick <= 0) {
      zone.tick += zone.tickRate;
      let firstHit: Enemy | undefined;
      for (const enemy of zoneCandidates) {
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
  const zonePool = objectPools(run).zones;
  recycleRejectedInPlace(run.zones, (zone) => zone.life > 0, zonePool);
  keepNewestAndRecycleInPlace(run.zones, 36, zonePool);
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
    let selected: Enemy | undefined;
    let selectedScore = Number.POSITIVE_INFINITY;
    for (const candidate of nearbyEnemies(
      run,
      summon.x,
      summon.y,
      Math.hypot(GAME_WIDTH, GAME_HEIGHT) + 180,
      "summon-target",
    )) {
      if (candidate.hp <= 0) continue;
      const load = assignedTargets.get(candidate.id) ?? 0;
      const score =
        distanceSquared(summon.x, summon.y, candidate.x, candidate.y) +
        load * 160 ** 2;
      if (
        score < selectedScore ||
        (score === selectedScore && candidate.id < (selected?.id ?? Infinity))
      ) {
        selected = candidate;
        selectedScore = score;
      }
    }
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
        pushProjectile(run, {
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
          canProc: summon.canProc,
        });
      }
      summon.cooldown += summon.attackCooldown;
    }
  }
  const summonPool = objectPools(run).summons;
  recycleRejectedInPlace(
    run.summons,
    (summon) => summon.life > 0,
    summonPool,
  );
  keepNewestAndRecycleInPlace(run.summons, 24, summonPool);
}

function updateStrikes(run: RunState, delta: number, events: RunEvent[]) {
  // Hit relief replaces the hostile collection while this pass is active.
  // Iterate a snapshot and stop immediately after relief so cancelled attacks
  // cannot keep resolving from the stale pre-clear array.
  for (const strike of [...run.strikes]) {
    strike.delay -= delta;
    if (strike.velocityX !== undefined || strike.velocityY !== undefined) {
      strike.x += (strike.velocityX ?? 0) * delta;
      strike.y += (strike.velocityY ?? 0) * delta;
      if (
        strike.x < -80 ||
        strike.x > GAME_WIDTH + 80 ||
        strike.y < -80 ||
        strike.y > GAME_HEIGHT + 80
      ) {
        strike.delay = 0;
      }
    }
    if (strike.hostile && strike.contactOnly) {
      const contacted =
        strike.delay > 0 &&
        distanceSquared(
          strike.x,
          strike.y,
          run.player.x,
          run.player.y,
        ) <=
          (strike.radius + 18) ** 2;
      if (contacted) {
        if (hurtPlayer(run, strike.damage)) {
          events.push({ type: "playerHit" });
        }
        if (run.lastHitRelief) break;
        addFx(
          run,
          "burst",
          strike.x,
          strike.y,
          strike.radius * 1.7,
          0.34,
          "#742f32",
          `${strike.artKey}/contact`,
        );
        strike.delay = 0;
      }
      continue;
    }
    if (strike.delay > 0) continue;
    if (strike.hostile) {
      if (
        distanceSquared(strike.x, strike.y, run.player.x, run.player.y) <=
        (strike.radius + 18) ** 2 &&
        hurtPlayer(run, strike.damage)
      ) {
        events.push({ type: "playerHit" });
        if (run.lastHitRelief) break;
      }
    } else {
      for (const enemy of nearbyEnemies(
        run,
        strike.x,
        strike.y,
        strike.radius + 90,
        "strike",
      )) {
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
  retainInPlace(run.strikes, (strike) => strike.delay > 0);
  keepNewestInPlace(run.strikes, 80);
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
  const mergeRank = travelNoteRank(run, "mergePearls");
  const mergeEffect = resolveTravelNoteEffect("mergePearls", mergeRank);
  const baseThreshold = mergeEffect.mergeThreshold;
  const mergeBoost = run.pickups.reduce(
    (best, pickup) => pickup.kind === "healingLeaf"
      ? best
      : Math.max(best, pickup.mergeMultiplier ?? 1),
    1,
  );
  const experiencePickupCount = run.pickups.reduce(
    (count, pickup) => count + Number(pickup.kind !== "healingLeaf"),
    0,
  );
  if (experiencePickupCount < Math.ceil(baseThreshold / mergeBoost)) return;
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
  retainInPlace(run.pickups, (pickup) => !removed.has(pickup.id));
  const merged = addExperiencePickup(run, x, y, total);
  if (mergeRank > 0) {
    merged.magnetRadius = Math.max(
      merged.magnetRadius ?? 0,
      150 * mergeEffect.mergedPearlAttractionMultiplier,
    );
  }
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
    enemy.motion = "dead";
    enemy.motionTime = 0;
    pushDeathActor(run, { enemy, life: 0.72 });
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
      else {
        events.push({ type: "finalBoss" });
        run.difficultyClearEligible = !run.testModifiers.assisted;
        if (run.difficultyClearEligible) {
          events.push({
            type: "difficultyClear",
            difficultyId: run.difficultyId,
            unlocks: run.difficultyUnlockCandidate,
          });
        }
      }
    }
  }
  run.enemies = living;
  run.currentBoss =
    living.find((enemy) => enemy.boss && enemy.hp > 0)?.bossTier ??
    null;
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

function recordPickupMend(run: RunState) {
  const rank = travelNoteRank(run, "pickupMend");
  if (
    rank <= 0 ||
    run.difficultyId === "oneLife" ||
    run.trials.has("noRecovery")
  ) {
    return;
  }
  const required = resolveTravelNoteEffect("pickupMend", rank).pickupMendRequirement;
  const counterKey = "travel-note:pickup-mend";
  const progress = (run.accumulators.get(counterKey) ?? 0) + 1 / required;
  if (progress + 1e-9 < 1) {
    run.accumulators.set(counterKey, progress);
    return;
  }
  run.accumulators.set(counterKey, progress - 1);
  const angle = run.player.facing + Math.PI / 2;
  run.pickups.push({
    id: nextId(run),
    x: run.player.x + Math.cos(angle) * 54,
    y: run.player.y + Math.sin(angle) * 54,
    value: 1,
    age: 0,
    tier: 1,
    kind: "healingLeaf",
  });
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
      const pull =
        (150 + (magnet - distance) * 4.6) * run.player.magnetMultiplier;
      pickup.x += direction.x * pull * delta;
      pickup.y += direction.y * pull * delta;
    }
    if (distance < 25) {
      const collectedValue = pickup.value;
      if (pickup.kind === "healingLeaf") {
        healPlayer(run, pickup.value * recoveryFor(run));
      } else {
        run.player.xp += pickup.value;
        recordPickupMend(run);
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
  retainInPlace(run.pickups, (pickup) => pickup.value > 0);
}

function updateFx(run: RunState, delta: number) {
  for (const fx of run.fx) fx.life -= delta;
  for (const actor of run.deaths) {
    actor.life -= delta;
    actor.enemy.motionTime += delta;
  }
  retainInPlace(run.fx, (fx) => fx.life > 0);
  keepNewestInPlace(run.fx, 260);
  const deathPool = objectPools(run).deaths;
  recycleRejectedInPlace(
    run.deaths,
    (actor) => actor.life > 0,
    deathPool,
  );
  keepNewestAndRecycleInPlace(run.deaths, 36, deathPool);
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
  const target = pickNearest(run);
  captureAttackReplay(
    run,
    owner,
    node.passEffects,
    target,
    node.kind === "weapon" ? (node.sourceId as WeaponId) : undefined,
  );
  for (const effect of node.passEffects) {
    fireEffect(
      run,
      effect,
      owner,
      target,
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

function pushCelestialStrike(
  run: RunState,
  id: CelestialIntrusionId,
  x: number,
  y: number,
  radius: number,
  delay: number,
  suffix: string,
  options: {
    velocityX?: number;
    velocityY?: number;
    contactOnly?: boolean;
  } = {},
) {
  pushHostileStrike(run, {
    artKey: `celestial/${id}/hostile/${suffix}`,
    x,
    y,
    radius,
    damage: 1,
    delay,
    maxDelay: delay,
    velocityX: options.velocityX,
    velocityY: options.velocityY,
    contactOnly: options.contactOnly,
  });
}

/** Returns the authored cadence before this天变 may act again. */
export function emitCelestialHazard(
  run: RunState,
  id: CelestialIntrusionId,
): number {
  switch (id) {
    case "thunderTrial": {
      const offsets = [
        [0, 0],
        [92, 0],
        [-92, 0],
        [0, 92],
      ] as const;
      for (let index = 0; index < offsets.length; index += 1) {
        const [dx, dy] = offsets[index];
        pushCelestialStrike(
          run,
          id,
          clamp(run.player.x + dx, 55, GAME_WIDTH - 55),
          clamp(run.player.y + dy, 55, GAME_HEIGHT - 55),
          58,
          0.72 + index * 0.16,
          `lightning-${index + 1}`,
        );
      }
      return 3.25;
    }
    case "galeTrial": {
      const travelAngle = Math.atan2(
        run.player.y - GAME_HEIGHT / 2,
        run.player.x - GAME_WIDTH / 2,
      );
      const perpendicular = travelAngle + Math.PI / 2;
      for (let lane = -1; lane <= 1; lane += 1) {
        const startX =
          run.player.x - Math.cos(travelAngle) * 760 + Math.cos(perpendicular) * lane * 118;
        const startY =
          run.player.y - Math.sin(travelAngle) * 760 + Math.sin(perpendicular) * lane * 118;
        pushCelestialStrike(run, id, startX, startY, 44, 4.5, `gale-lane-${lane + 2}`, {
          velocityX: Math.cos(travelAngle) * 340,
          velocityY: Math.sin(travelAngle) * 340,
          contactOnly: true,
        });
      }
      addFx(
        run,
        "beam",
        run.player.x - Math.cos(travelAngle) * 700,
        run.player.y - Math.sin(travelAngle) * 700,
        94,
        1.1,
        "#72868a",
        `celestial/${id}/hostile/wind-band`,
        {
          x2: run.player.x + Math.cos(travelAngle) * 700,
          y2: run.player.y + Math.sin(travelAngle) * 700,
        },
      );
      return 4.8;
    }
    case "fireTrial": {
      const centers = [
        [run.player.x, run.player.y],
        [run.player.x + 125, run.player.y - 72],
        [run.player.x - 125, run.player.y + 72],
      ] as const;
      for (let repeat = 0; repeat < 2; repeat += 1) {
        for (let index = 0; index < centers.length; index += 1) {
          const [x, y] = centers[index];
          pushCelestialStrike(
            run,
            id,
            clamp(x, 70, GAME_WIDTH - 70),
            clamp(y, 70, GAME_HEIGHT - 70),
            94,
            1.05 + repeat * 1.15 + index * 0.08,
            `fire-field-${repeat + 1}-${index + 1}`,
          );
        }
      }
      return 5.1;
    }
    case "frostTrial": {
      const x = run.player.x;
      const y = run.player.y;
      for (let pulse = 0; pulse < 10; pulse += 1) {
        pushCelestialStrike(
          run,
          id,
          x,
          y,
          260,
          0.6 + pulse * 0.5,
          `frost-domain-${pulse + 1}`,
        );
      }
      addFx(run, "ring", x, y, 260, 5, "#708798", `celestial/${id}/hostile/frost-domain`);
      return 7.2;
    }
    case "ghostMarch": {
      const side = random(run) < 0.5 ? -1 : 1;
      const x = side < 0 ? -36 : GAME_WIDTH + 36;
      for (let index = 0; index < 5; index += 1) {
        if (run.enemies.length >= ENDLESS_ACTOR_CAP) break;
        const ghost = spawnEnemy(run, "puppet", {
          x,
          y: clamp(
            run.player.y + (index - 2) * 72,
            45,
            GAME_HEIGHT - 45,
          ),
        });
        ghost.celestialSourceId = id;
        ghost.artKey = `celestial/${id}/hostile/ghost-${index + 1}`;
        ghost.heading = side < 0 ? 0 : Math.PI;
        ghost.ralliedUntil = run.elapsed + 12;
        ghost.attackCooldown = 0.55 + index * 0.12;
      }
      return 8.2;
    }
    case "eclipseTrial": {
      const avatar = run.enemies.find(
        (enemy) => enemy.id === run.intrusionAvatarId,
      );
      let x = avatar?.x ?? run.player.x - 210;
      let y = avatar?.y ?? run.player.y;
      for (let jump = 0; jump < 8; jump += 1) {
        const remaining = 8 - jump;
        x += (run.player.x - x) / remaining + (jump % 2 === 0 ? 42 : -42);
        y += (run.player.y - y) / remaining + (jump % 3 - 1) * 34;
        pushCelestialStrike(
          run,
          id,
          clamp(x, 50, GAME_WIDTH - 50),
          clamp(y, 50, GAME_HEIGHT - 50),
          48,
          0.44 + jump * 0.18,
          `eclipse-jump-${jump + 1}`,
        );
      }
      return 4.4;
    }
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
      retainInPlace(
        run.enemies,
        (enemy) => enemy.id !== run.intrusionAvatarId,
      );
    }
    retainInPlace(
      run.enemies,
      (enemy) => enemy.celestialSourceId !== expiredId,
    );
    retainInPlace(
      run.strikes,
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
    run.celestialHazardClock = 0;
    const avatarType: Record<string, EnemyArchetype> = {
      thunderTrial: "lion",
      galeTrial: "rib",
      fireTrial: "lantern",
      frostTrial: "abacus",
      ghostMarch: "puppet",
      eclipseTrial: "shoe",
    };
    if (run.enemies.length >= ENDLESS_ACTOR_CAP) {
      const replaceIndex = run.enemies.findIndex(
        (enemy) => !enemy.boss && !enemy.intrusionAvatar,
      );
      if (replaceIndex >= 0) run.enemies.splice(replaceIndex, 1);
    }
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
      run.celestialHazardClock = emitCelestialHazard(run, active.id);
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
  run.endlessBossAt = Number.POSITIVE_INFINITY;
  run.endlessBossCount = 0;
  run.intrusionAt = run.elapsed + 70;
  run.endlessDirector = {
    startedAt: run.elapsed,
    nonBossThreatBudget: 0,
    bossBudget: 0,
    totalThreatSpent: 0,
    commonSpawned: 0,
    eliteSpawned: 0,
    bossesSpawned: 0,
    recentBossIds: [],
    nextBossId: "troupeMaster",
    pendingBossSlot: false,
    lastSample: sampleEndlessDifficulty(0, difficultyFor(run)),
  };
  run.endlessDirector.lastSample = getEndlessDifficultySample(run);
  run.endlessDirector.nextBossId = chooseEndlessBossId(run);
  run.terminalLabel = "器盘开始转动";
  run.terminalLabelLife = 2.2;
}

/** Safe, non-persistent test jump used by the hidden pause test panel. */
export function jumpEndlessMinutesForTest(
  run: RunState,
  minutes: number,
  events: RunEvent[] = [],
): boolean {
  void events;
  if (run.pendingRareChoice || run.weave?.activeIntrusion?.phase === "defeated") {
    return false;
  }
  run.testModifiers.assisted = true;
  run.difficultyClearEligible = false;
  if (!run.endless || !run.endlessDirector || !run.weave) {
    startEndless(run);
  }
  const director = run.endlessDirector;
  if (!director) return false;
  const safeMinutes = clamp(Number.isFinite(minutes) ? minutes : 0, 0, 80);
  run.elapsed = director.startedAt + safeMinutes * 60;
  director.nonBossThreatBudget = 0;
  director.bossBudget = 0;
  director.pendingBossSlot = false;
  director.lastSample = getEndlessDifficultySample(run);
  // The jump is a debugger seek, not a simulation step.  Put every modal
  // schedule in the future so no upgrade/forge/intrusion is silently crossed.
  run.forgeAt = run.elapsed + 120;
  run.intrusionAt = run.elapsed + 70;
  run.spawnClock = Math.max(run.spawnClock, 0.05);
  run.terminalLabel = `测试：无尽${Math.round(safeMinutes)}分`;
  run.terminalLabelLife = 2.2;
  return true;
}

/** Spawns one authored endless boss through the normal spawn path. */
export function spawnEndlessBossForTest(
  run: RunState,
  bossId: EndlessBossId,
  events: RunEvent[] = [],
): boolean {
  if (!ENDLESS_BOSS_IDS.includes(bossId)) return false;
  run.testModifiers.assisted = true;
  run.difficultyClearEligible = false;
  if (!run.endless || !run.endlessDirector || !run.weave) {
    startEndless(run);
  }
  return spawnEndlessBoss(run, events, bossId);
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

/**
 * Settles only build/experience progression. It advances no clocks, actors,
 * attacks, pickups or encounter directors, so paused/test XP can be drained
 * one player decision at a time without sneaking in a combat frame.
 */
export function settleRunProgression(run: RunState): RunEvent[] {
  const events: RunEvent[] = [];
  syncSynergySelection(run, events);
  if (
    events.some((event) => event.type === "synergyChoice") ||
    run.pendingSynergyChoiceIds.length > 0
  ) {
    return events;
  }
  while (run.player.xp >= run.player.nextXp) {
    run.player.xp -= run.player.nextXp;
    run.player.level += 1;
    run.player.nextXp = 7 + run.player.level * 4;
    const travelNotesComplete =
      areAllWeaponsMastered(run.build, 4) &&
      !hasAvailableTravelNotes(run.build, travelNoteContext(run));
    if (travelNotesComplete) {
      run.surplusPages += 1;
      continue;
    }
    events.push({ type: "upgrade" });
    break;
  }
  return events;
}

export function stepRun(run: RunState, deltaSeconds: number, moveInput: MoveInput): RunEvent[] {
  const delta = Math.min(0.034, Math.max(0, deltaSeconds));
  const events: RunEvent[] = [];
  run.lastHitRelief = undefined;
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
    armTurningMomentum(run);
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
  rebuildEnemyGrid(run);
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

  events.push(...settleRunProgression(run));
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
        radius: effect.radius * travelRangeMultiplier(run),
        angularSpeed: effect.angularSpeed,
        phase,
      });
      phase += 0.51;
    }
  }
  return visuals;
}
