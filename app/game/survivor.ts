import type { BossTier, EnemyArchetype } from "./art";
import {
  getWeaponDefinition,
  getWeaponRoute,
  resolveActiveSynergies,
  type CombatBuild,
  type EffectSpec,
  type EffectTag,
  type EffectTrigger,
  type UpgradeOption,
  type WeaponId,
  type WeaponState,
  type WeaveState,
  WEAPON_IDS,
} from "./content";
import {
  advanceWeavePulse,
  applyUpgradeOption,
  beginCelestialIntrusion,
  captureDefeatedIntrusion,
  chooseCelestialIntrusion,
  createCombatBuild,
  createRngState,
  createWeaveState,
  damageCelestialIntrusion,
  fuseAdjacentNodes,
  generateUpgradeOptions,
  insertWeaponNode,
  nextRandom,
  resolveWeaponEffects,
  stepCelestialIntrusion,
  swapWeaveNodes,
  type RngState,
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
export type RunEvent =
  | { type: "upgrade" }
  | { type: "midBoss" }
  | { type: "finalBoss" }
  | { type: "defeat" }
  | { type: "forge" }
  | { type: "term"; name: string; ambience: string }
  | { type: "fold"; folded: boolean }
  | { type: "synergy"; name: string }
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
  lastHitOwner?: ProjectileOwner;
};

export type ProjectileOwner = WeaponId | `synergy:${string}` | `weave:${string}` | "terminal";

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
};

export type Pickup = {
  id: number;
  x: number;
  y: number;
  value: number;
  age: number;
  tier: 1 | 2 | 3;
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
  rng: RngState;
  serial: number;
  spawnClock: number;
  midBossSpawned: boolean;
  finalBossSpawned: boolean;
  currentBoss: BossTier;
  activeSynergyIds: string[];
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

export function createRun(trials: Set<TrialId>, seed = Date.now()): RunState {
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
    build: createCombatBuild(),
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
    rng: createRngState(seed),
    serial: 1,
    spawnClock: 0.25,
    midBossSpawned: false,
    finalBossSpawned: false,
    currentBoss: null,
    activeSynergyIds: [],
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
  };
}

export function snapshotRun(run: RunState): RunSnapshot {
  const synergies = resolveActiveSynergies(run.build.weapons, run.build.synergyCapacity);
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
    name: "先声成器",
    description: "将当前最高阶但未成器的本命武器直接推进一阶。",
  },
  {
    id: "resonance-slot",
    name: "三器同鸣",
    description: "合鸣容量增加一格，并立即触发全部已满足的合鸣。",
  },
  {
    id: "weapon-soul",
    name: "器魂·照胆",
    description: "每件本命器累计命中十八次，器魂便追索强敌并弹射三次。",
  },
] as const;

export function applyUpgrade(run: RunState, option: UpgradeOption): string | undefined {
  const before = new Set(resolveActiveSynergies(run.build.weapons, run.build.synergyCapacity).map((item) => item.definition.id));
  run.build = applyUpgradeOption(run.build, option);
  if (option.kind === "utility") {
    if (option.modifierId === "keenEdge") run.player.powerMultiplier *= 1.08;
    if (option.modifierId === "gatheringWind") run.player.magnetMultiplier *= 1.18;
    if (option.modifierId === "paperWard") {
      run.player.maxLife = Math.min(7, run.player.maxLife + 1);
      run.player.life = Math.min(run.player.maxLife, run.player.life + 1);
    }
  }
  const newlyActive = resolveActiveSynergies(run.build.weapons, run.build.synergyCapacity)
    .find((item) => !before.has(item.definition.id));
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
  run.fx.push({
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
  });
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
    else if (effect.pattern === "fan" || effect.pattern === "burst") {
      angle += count === 1 ? 0 : (index / (count - 1) - 0.5) * spread;
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
  enemy.motion = "hurt";
  enemy.motionTime = 0;
  addFx(run, "hit", enemy.x, enemy.y, enemy.radius * 1.35, 0.22, ownerColor(owner), `hit/${owner}`, {
    owner,
  });
  if (canProc) applyOnHitEffects(run, owner, enemy);
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
  for (const synergy of resolveActiveSynergies(run.build.weapons, run.build.synergyCapacity)) {
    groups.set(`synergy:${synergy.definition.id}`, synergy.effects);
  }
  if (run.weave) {
    const held = new Set(run.build.weapons.map((weapon) => weapon.id));
    for (const node of run.weave.nodes) {
      const owner: ProjectileOwner = `weave:${node.instanceId}`;
      if (node.kind === "fusion") {
        groups.set(owner, node.passEffects);
      } else if (node.kind === "weapon" && !held.has(node.sourceId as WeaponId)) {
        const definition = getWeaponDefinition(node.sourceId as WeaponId);
        groups.set(
          owner,
          resolveWeaponEffects({
            id: definition.id,
            level: 3,
            routeId: definition.routes[0].id,
          }),
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
  let damage = effect.damage * damageScale * run.player.powerMultiplier;
  let previousX = run.player.x;
  let previousY = run.player.y;
  for (let jump = 0; jump < effect.jumps && current; jump += 1) {
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
    current = candidates.sort((a, b) =>
      distanceSquared(previousX, previousY, a.x, a.y) -
      distanceSquared(previousX, previousY, b.x, b.y)
    )[0];
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
  const direction = normalized(target.x - run.player.x, target.y - run.player.y);
  const endX = run.player.x + direction.x * effect.length;
  const endY = run.player.y + direction.y * effect.length;
  let pierced = 0;
  const candidates = [...run.enemies].sort((a, b) =>
    distanceSquared(run.player.x, run.player.y, a.x, a.y) -
    distanceSquared(run.player.x, run.player.y, b.x, b.y)
  );
  for (const enemy of candidates) {
    const relX = enemy.x - run.player.x;
    const relY = enemy.y - run.player.y;
    const along = relX * direction.x + relY * direction.y;
    const across = Math.abs(relX * direction.y - relY * direction.x);
    if (along >= 0 && along <= effect.length && across <= effect.width / 2 + enemy.radius) {
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
  addFx(run, "beam", run.player.x, run.player.y, effect.width, Math.max(0.2, effect.duration), ownerColor(owner), effect.visualKey ?? `beam/${owner}`, {
    owner,
    x2: endX,
    y2: endY,
  });
}

function scheduleLightning(
  run: RunState,
  effect: Extract<EffectSpec, { kind: "lightning" }>,
  owner: ProjectileOwner,
  damageScale = 1,
  canProc = true,
) {
  const ignored = new Set<number>();
  for (let index = 0; index < effect.strikes; index += 1) {
    const target = pickNearest(run, run.player.x, run.player.y, ignored) ?? pickStrongest(run);
    if (!target) break;
    ignored.add(target.id);
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
  });
}

function spawnSummons(
  run: RunState,
  effect: Extract<EffectSpec, { kind: "summon" }>,
  owner: ProjectileOwner,
  damageScale = 1,
  canProc = true,
) {
  const same = run.summons.filter((summon) => summon.artKey === effect.summonKey);
  if (same.length >= effect.count) {
    for (const summon of same) summon.life = Math.max(summon.life, effect.duration);
    return;
  }
  for (let index = same.length; index < effect.count; index += 1) {
    run.summons.push({
      id: nextId(run),
      owner,
      artKey: effect.summonKey,
      angle: (Math.PI * 2 * index) / effect.count,
      radius: 118 + index * 8,
      life: effect.duration,
      attackDamage: effect.attackDamage * damageScale * run.player.powerMultiplier,
      attackCooldown: effect.attackCooldown,
      cooldown: index * 0.12,
      index,
      total: effect.count,
      canProc,
    });
  }
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
    const projectile = [...run.projectiles].reverse().find((item) => item.owner !== owner);
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
) {
  if (effect.trigger !== trigger) return;
  const key = `trigger:${trigger}:${owner}:${effect.id}`;
  if ((run.cooldowns.get(key) ?? 0) > 0) return;
  const activeTrigger = trigger === "onAttack" || trigger === "periodic";
  const reactiveCooldown =
    trigger === "onHit" || trigger === "onMarkedHit"
      ? effect.internalCooldown ?? 0.12
      : effect.internalCooldown ?? 0;
  const cooldown = activeTrigger ? effectCooldown(effect) : reactiveCooldown;
  if (effect.chance !== undefined && random(run) > effect.chance) {
    if (cooldown > 0) run.cooldowns.set(key, cooldown);
    return;
  }
  const allowHitProcs = trigger !== "onHit" && trigger !== "onMarkedHit";
  fireEffect(run, effect, owner, target, 1, allowHitProcs);
  if (cooldown > 0) run.cooldowns.set(key, cooldown);
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

  for (const [owner, effects] of effectOwners(run)) {
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
      enemy.x = clamp(run.player.x - direction.x * 58, 40, GAME_WIDTH - 40);
      enemy.y = clamp(run.player.y - direction.y * 58, 45, GAME_HEIGHT - 45);
      addFx(run, "burst", enemy.x, enemy.y, 150, 0.5, "#a94838", "boss/nian/leap");
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
      return false;
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

    if (enemy.motion === "hurt" && enemy.motionTime > 0.12) {
      enemy.motion = "moving";
      enemy.motionTime = 0;
    }

    const distanceToPlayer = Math.sqrt(distanceSquared(enemy.x, enemy.y, run.player.x, run.player.y));
    const attackRange = enemy.radius + 24;
    const isBossSkill = enemy.boss && enemy.attackCooldown <= 0 && distanceToPlayer < 430;
    const isContactAttack = !enemy.boss && enemy.attackCooldown <= 0 && distanceToPlayer < attackRange + 18;
    if (enemy.motion !== "attacking" && (isBossSkill || isContactAttack)) {
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
    if (zone.tick <= 0) {
      zone.tick += zone.tickRate;
      for (const enemy of run.enemies) {
        if (enemy.hp > 0 && distanceSquared(zone.x, zone.y, enemy.x, enemy.y) <= (zone.radius + enemy.radius) ** 2) {
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
    }
  }
  run.zones = run.zones.filter((zone) => zone.life > 0).slice(-36);
}

function updateSummons(run: RunState, delta: number) {
  for (const summon of run.summons) {
    summon.life -= delta;
    summon.cooldown -= delta;
    summon.angle += delta * (0.7 + summon.index * 0.04);
    if (summon.cooldown <= 0) {
      const target = pickNearest(run);
      if (target) {
        const x = run.player.x + Math.cos(summon.angle) * summon.radius;
        const y = run.player.y + Math.sin(summon.angle) * summon.radius * 0.58;
        const direction = normalized(target.x - x, target.y - y);
        run.projectiles.push({
          id: nextId(run),
          owner: summon.owner,
          artKey: `summon-shot/${summon.artKey}`,
          tags: ["shadow"],
          x,
          y,
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

function mergeExperience(run: RunState) {
  if (run.pickups.length < 92) return;
  const low = run.pickups.filter((pickup) => pickup.value <= 2).slice(0, 18);
  if (low.length < 8) return;
  const total = low.reduce((sum, pickup) => sum + pickup.value, 0);
  const x = low.reduce((sum, pickup) => sum + pickup.x, 0) / low.length;
  const y = low.reduce((sum, pickup) => sum + pickup.y, 0) / low.length;
  const removed = new Set(low.map((pickup) => pickup.id));
  run.pickups = run.pickups.filter((pickup) => !removed.has(pickup.id));
  run.pickups.push({ id: nextId(run), x, y, value: total, age: 0, tier: experienceTier(total) });
}

function removeDead(run: RunState, events: RunEvent[]) {
  const living: Enemy[] = [];
  for (const enemy of run.enemies) {
    if (enemy.hp > 0) {
      living.push(enemy);
      continue;
    }
    const dead = { ...enemy, motion: "dead" as const, motionTime: 0 };
    run.deaths.push({ enemy: dead, life: 0.72 });
    run.kills += 1;
    run.score += enemy.bossTier === "final" ? 3200 : enemy.bossTier === "mid" ? 1400 : enemy.elite ? 520 : 20;
    addFx(run, "ink", enemy.x, enemy.y, enemy.radius * 1.7, enemy.boss ? 0.85 : 0.42, enemy.boss ? "#a54535" : "#302f2b", "fx/enemy-death");
    if (enemy.lastHitOwner) {
      dispatchOwnerTrigger(run, enemy.lastHitOwner, "onKill", enemy);
    }

    if (enemy.intrusionAvatar && run.weave) {
      run.weave = damageCelestialIntrusion(run.weave, Number.MAX_SAFE_INTEGER);
      run.intrusionAvatarId = undefined;
    }

    if (!enemy.boss && !enemy.intrusionAvatar) {
      const value = enemy.elite ? 12 : random(run) < 0.13 ? 3 : 1;
      run.pickups.push({
        id: nextId(run),
        x: enemy.x + randomRange(run, -14, 14),
        y: enemy.y + randomRange(run, -14, 14),
        value,
        age: 0,
        tier: experienceTier(value),
      });
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
  mergeExperience(run);
}

function updatePickups(run: RunState, delta: number, events: RunEvent[]) {
  for (const pickup of run.pickups) {
    pickup.age += delta;
    const distance = Math.sqrt(distanceSquared(pickup.x, pickup.y, run.player.x, run.player.y));
    const magnet = 150 * run.player.magnetMultiplier;
    if (distance < magnet) {
      const direction = normalized(run.player.x - pickup.x, run.player.y - pickup.y);
      const pull = 150 + (magnet - distance) * 4.6;
      pickup.x += direction.x * pull * delta;
      pickup.y += direction.y * pull * delta;
    }
    if (distance < 25) {
      run.player.xp += pickup.value;
      pickup.value = 0;
      events.push({ type: "pickup" });
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

function updateEndless(run: RunState, delta: number, events: RunEvent[]) {
  if (!run.endless || !run.weave) return;

  const advanced = advanceWeavePulse(run.weave, delta);
  run.weave = advanced.state;
  for (const node of advanced.passedNodes) {
    for (const effect of node.passEffects) fireEffect(run, effect, `weave:${node.instanceId}`);
  }
  if (advanced.terminal) {
    for (const effect of advanced.terminal.effects) fireEffect(run, effect, "terminal");
    run.terminalLabel = advanced.terminal.name;
    run.terminalLabelLife = 2.1;
    addFx(run, "terminal", run.player.x, run.player.y, 285, 1.1, "#a44338", advanced.terminal.artKey, {
      label: advanced.terminal.name,
    });
    events.push({ type: "terminal", name: advanced.terminal.name });
  }

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
  run.forgeCredits = Math.min(1, run.forgeCredits + 1);
  events.push({ type: "forge" });
}

export function startEndless(run: RunState) {
  run.endless = true;
  run.weave = createWeaveState(run.build);
  run.forgeAt = run.elapsed + 120;
  run.forgeCredits = 0;
  run.endlessBossAt = run.elapsed + 240;
  run.endlessBossCount = 0;
  run.intrusionAt = run.elapsed + 70;
  run.terminalLabel = "万器经纬·开盘";
  run.terminalLabelLife = 2.2;
}

export function insertEndlessWeapon(run: RunState, weaponId: WeaponId) {
  if (!run.weave || run.forgeCredits <= 0) return false;
  const result = insertWeaponNode(run.weave, weaponId);
  if (!result.ok) return false;
  run.weave = result.state;
  run.forgeCredits -= 1;
  return true;
}

export function swapEndlessNodes(run: RunState, first: number, second: number) {
  if (!run.weave || run.forgeCredits <= 0) return false;
  const swapped = swapWeaveNodes(run.weave, first, second);
  if (swapped === run.weave) return false;
  run.weave = swapped;
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

export function stepRun(run: RunState, deltaSeconds: number, moveInput: MoveInput): RunEvent[] {
  const delta = Math.min(0.034, Math.max(0, deltaSeconds));
  const events: RunEvent[] = [];
  run.elapsed += delta;
  run.player.invulnerability = Math.max(0, run.player.invulnerability - delta);

  const magnitude = length(moveInput.x, moveInput.y);
  const moving = magnitude > 0.08;
  const direction = moving ? normalized(moveInput.x, moveInput.y) : { x: 0, y: 0 };
  const beforeForm = run.player.formState;
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
  }
  run.lastFormState = run.player.formState;

  const termState = getSolarTermState(run.elapsed, run.endless);
  if (termState.current.index !== run.lastTermIndex) {
    run.lastTermIndex = termState.current.index;
    events.push({ type: "term", name: termState.current.name, ambience: termState.current.ambience });
  }

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

  const synergies = resolveActiveSynergies(run.build.weapons, run.build.synergyCapacity);
  const newSynergy = synergies.find((synergy) => !run.activeSynergyIds.includes(synergy.definition.id));
  if (newSynergy) events.push({ type: "synergy", name: newSynergy.name });
  run.activeSynergyIds = synergies.map((synergy) => synergy.definition.id);

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
