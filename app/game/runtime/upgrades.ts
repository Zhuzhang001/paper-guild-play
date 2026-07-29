import type {
  CombatBuild,
  EffectPatch,
  EffectSpec,
  ResolvedWeaponKit,
  RunModifierId,
  UpgradeOption,
  WeaponId,
  WeaponLevel,
  WeaponState,
} from "../content/types";
import {
  getMasteryDefinition,
  getWeaponDefinition,
  getWeaponRoute,
  WEAPON_IDS,
} from "../content/weapons";
import { randomInt, sampleDeterministic, type RngState } from "./rng";

export type UpgradeGenerationConfig = {
  maxWeapons?: number;
  optionCount?: number;
  unlockedWeaponIds?: readonly WeaponId[];
};

export type UpgradeGenerationResult = {
  options: readonly UpgradeOption[];
  rngState: RngState;
  milestone: "route" | "mastery" | "normal";
  weaponId?: WeaponId;
};

const UTILITY_OPTIONS: readonly UpgradeOption[] = [
  {
    id: "utility-paper-ward",
    kind: "utility",
    modifierId: "paperWard",
    title: "护纸",
    description: "获得一层可叠加的受击缓冲。",
    artKey: "upgrade/utility-paper-ward",
  },
  {
    id: "utility-keen-edge",
    kind: "utility",
    modifierId: "keenEdge",
    title: "砺锋",
    description: "所有武器的基础伤害获得小幅提高。",
    artKey: "upgrade/utility-keen-edge",
  },
  {
    id: "utility-gathering-wind",
    kind: "utility",
    modifierId: "gatheringWind",
    title: "聚风",
    description: "提高经验物吸附距离与吸附速度。",
    artKey: "upgrade/utility-gathering-wind",
  },
];

export function createCombatBuild(initialWeaponId: WeaponId = "sword"): CombatBuild {
  return {
    weapons: [{ id: initialWeaponId, level: 1 }],
    modifiers: {},
    synergyCapacity: 3,
  };
}

function chooseMilestoneWeapon(
  states: readonly WeaponState[],
  level: WeaponLevel,
  rngState: RngState,
): { weapon?: WeaponState; rngState: RngState } {
  const eligible = states.filter((state) => state.level === level);
  if (eligible.length === 0) {
    return { rngState };
  }
  const picked = randomInt(rngState, eligible.length);
  return { weapon: eligible[picked.value], rngState: picked.state };
}

function routeOptions(state: WeaponState): readonly UpgradeOption[] {
  const definition = getWeaponDefinition(state.id);
  return definition.routes.map((routeDefinition) => ({
    id: `route-${routeDefinition.id}`,
    kind: "route" as const,
    weaponId: state.id,
    routeId: routeDefinition.id,
    title: routeDefinition.name,
    description: routeDefinition.description,
    artKey: routeDefinition.artKeys.tier3,
  }));
}

function masteryOptions(state: WeaponState): readonly UpgradeOption[] {
  if (!state.routeId) {
    throw new Error(`Level-four weapon ${state.id} is missing its route`);
  }
  const routeDefinition = getWeaponRoute(state.routeId);
  return routeDefinition.masteries.map((masteryDefinition) => ({
    id: `mastery-${masteryDefinition.id}`,
    kind: "mastery" as const,
    weaponId: state.id,
    routeId: routeDefinition.id,
    masteryId: masteryDefinition.id,
    title: masteryDefinition.name,
    description: masteryDefinition.description,
    artKey: masteryDefinition.artKey,
  }));
}

function progressOption(state: WeaponState): UpgradeOption | undefined {
  const definition = getWeaponDefinition(state.id);
  if (state.level === 1) {
    return {
      id: `refine-${state.id}`,
      kind: "refine",
      weaponId: state.id,
      title: `${definition.name}·精炼`,
      description: "强化基础攻击的节奏、威力与辨识度。",
      artKey: definition.artKeys.tier2,
    };
  }
  if (state.level === 3 && state.routeId) {
    const routeDefinition = getWeaponRoute(state.routeId);
    return {
      id: `route-enhancement-${state.routeId}`,
      kind: "routeEnhancement",
      weaponId: state.id,
      title: `${routeDefinition.name}·再造`,
      description: `继续强化“${routeDefinition.name}”的核心机制。`,
      artKey: routeDefinition.artKeys.tier4,
    };
  }
  return undefined;
}

function acquireOption(weaponId: WeaponId): UpgradeOption {
  const definition = getWeaponDefinition(weaponId);
  return {
    id: `acquire-${weaponId}`,
    kind: "acquire",
    weaponId,
    title: `新器·${definition.name}`,
    description: definition.description,
    artKey: definition.artKeys.tier1,
  };
}

function takeOne<T>(
  values: readonly T[],
  rngState: RngState,
): { value?: T; rngState: RngState } {
  if (values.length === 0) {
    return { rngState };
  }
  const picked = randomInt(rngState, values.length);
  return { value: values[picked.value], rngState: picked.state };
}

export function generateUpgradeOptions(
  build: CombatBuild,
  rngState: RngState,
  config: UpgradeGenerationConfig = {},
): UpgradeGenerationResult {
  const masteryMilestone = chooseMilestoneWeapon(build.weapons, 4, rngState);
  if (masteryMilestone.weapon) {
    return {
      options: masteryOptions(masteryMilestone.weapon),
      rngState: masteryMilestone.rngState,
      milestone: "mastery",
      weaponId: masteryMilestone.weapon.id,
    };
  }

  const routeMilestone = chooseMilestoneWeapon(
    build.weapons,
    2,
    masteryMilestone.rngState,
  );
  if (routeMilestone.weapon) {
    return {
      options: routeOptions(routeMilestone.weapon),
      rngState: routeMilestone.rngState,
      milestone: "route",
      weaponId: routeMilestone.weapon.id,
    };
  }

  const maxWeapons = config.maxWeapons ?? 4;
  const optionCount = Math.max(1, config.optionCount ?? 3);
  const unlocked = config.unlockedWeaponIds ?? WEAPON_IDS;
  const heldIds = new Set(build.weapons.map((state) => state.id));
  const progressCandidates = build.weapons
    .map(progressOption)
    .filter((option): option is UpgradeOption => option !== undefined);
  const acquireCandidates =
    build.weapons.length < maxWeapons
      ? unlocked.filter((weaponId) => !heldIds.has(weaponId)).map(acquireOption)
      : [];

  const guaranteed: UpgradeOption[] = [];
  let currentState = routeMilestone.rngState;

  const progressPick = takeOne(progressCandidates, currentState);
  currentState = progressPick.rngState;
  if (progressPick.value) {
    guaranteed.push(progressPick.value);
  }

  if (guaranteed.length < optionCount) {
    const acquirePick = takeOne(acquireCandidates, currentState);
    currentState = acquirePick.rngState;
    if (acquirePick.value) {
      guaranteed.push(acquirePick.value);
    }
  }

  const used = new Set(guaranteed.map((option) => option.id));
  const remaining = [
    ...progressCandidates,
    ...acquireCandidates,
    ...UTILITY_OPTIONS,
  ].filter((option) => !used.has(option.id));
  const sampled = sampleDeterministic(
    remaining,
    Math.max(0, optionCount - guaranteed.length),
    currentState,
  );

  return {
    options: [...guaranteed, ...sampled.values],
    rngState: sampled.state,
    milestone: "normal",
  };
}

function nextLevel(level: WeaponLevel): WeaponLevel {
  if (level >= 5) {
    throw new Error("A completed weapon cannot be upgraded further");
  }
  return (level + 1) as WeaponLevel;
}

export function applyUpgradeOption(
  build: CombatBuild,
  option: UpgradeOption,
): CombatBuild {
  if (option.kind === "utility") {
    const modifiers = { ...build.modifiers };
    modifiers[option.modifierId] = (modifiers[option.modifierId] ?? 0) + 1;
    return { ...build, modifiers };
  }

  if (option.kind === "acquire") {
    if (build.weapons.some((state) => state.id === option.weaponId)) {
      throw new Error(`Weapon ${option.weaponId} is already held`);
    }
    return {
      ...build,
      weapons: [...build.weapons, { id: option.weaponId, level: 1 }],
    };
  }

  let found = false;
  const weapons = build.weapons.map((state): WeaponState => {
    if (state.id !== option.weaponId) {
      return state;
    }
    found = true;
    if (option.kind === "refine") {
      if (state.level !== 1) {
        throw new Error(`Weapon ${state.id} is not ready for refinement`);
      }
      return { ...state, level: nextLevel(state.level) };
    }
    if (option.kind === "route") {
      if (state.level !== 2 || option.routeId.split(":")[0] !== state.id) {
        throw new Error(`Weapon ${state.id} is not ready for route selection`);
      }
      return { ...state, level: 3, routeId: option.routeId };
    }
    if (option.kind === "routeEnhancement") {
      if (state.level !== 3 || !state.routeId) {
        throw new Error(`Weapon ${state.id} is not ready for route enhancement`);
      }
      return { ...state, level: 4 };
    }
    if (option.kind !== "mastery") {
      throw new Error(`Unsupported upgrade kind for ${state.id}`);
    }
    if (
      state.level !== 4 ||
      state.routeId !== option.routeId ||
      option.masteryId.split(":").slice(0, 2).join(":") !== state.routeId
    ) {
      throw new Error(`Weapon ${state.id} is not ready for mastery`);
    }
    return { ...state, level: 5, masteryId: option.masteryId };
  });

  if (!found) {
    throw new Error(`Weapon ${option.weaponId} is not held`);
  }
  return { ...build, weapons };
}

function stagePatches(
  stageId: string,
  target: EffectPatch["target"],
  current: readonly EffectSpec[],
  authored: readonly EffectSpec[],
  replacePrimary: boolean,
): readonly EffectPatch[] {
  const claimed = new Set<number>();
  return authored.map((effect, authoredIndex): EffectPatch => {
    let matchIndex = current.findIndex(
      (candidate, index) =>
        !claimed.has(index) && candidate.kind === effect.kind,
    );
    const activeEmitter =
      effect.trigger === "onAttack" || effect.trigger === "periodic";
    if (
      matchIndex < 0 &&
      replacePrimary &&
      authoredIndex === 0 &&
      activeEmitter &&
      current.length > 0
    ) {
      matchIndex = 0;
    }
    if (matchIndex >= 0) claimed.add(matchIndex);
    return {
      id: `${stageId}:${authoredIndex}`,
      target,
      mode: matchIndex >= 0 ? "replace" : "append",
      matchKind: matchIndex >= 0 ? current[matchIndex].kind : undefined,
      matchIndex: matchIndex >= 0 ? matchIndex : undefined,
      effect,
    };
  });
}

export function applyEffectPatches(
  effects: readonly EffectSpec[],
  patches: readonly EffectPatch[],
): readonly EffectSpec[] {
  const resolved = [...effects];
  for (const patch of patches) {
    if (patch.mode === "append") {
      resolved.push(patch.effect);
      continue;
    }
    const index =
      patch.matchIndex !== undefined &&
      resolved[patch.matchIndex]?.kind === patch.matchKind
        ? patch.matchIndex
        : resolved.findIndex((effect) => effect.kind === patch.matchKind);
    if (index < 0) resolved.push(patch.effect);
    else resolved[index] = patch.effect;
  }
  return resolved;
}

/**
 * Resolves one weapon as an evolving attack kit. Tier two and tier four replace
 * their logical emitter instead of silently adding another full-rate emitter.
 * A route replaces the core delivery, while a chain mastery adds a new proc.
 */
export function resolveWeaponKit(state: WeaponState): ResolvedWeaponKit {
  const definition = getWeaponDefinition(state.id);
  let core: readonly EffectSpec[] = [...definition.baseEffects];
  if (state.level >= 2) {
    core = applyEffectPatches(
      core,
      stagePatches(
        `${state.id}:refinement`,
        "core",
        core,
        definition.refinedEffects,
        true,
      ),
    );
  }
  let routeEffects: readonly EffectSpec[] = [];
  if (state.level >= 3) {
    if (!state.routeId) {
      throw new Error(`Weapon ${state.id} at level ${state.level} is missing a route`);
    }
    const route = getWeaponRoute(state.routeId);
    const combined = applyEffectPatches(
      core,
      stagePatches(
        `${route.id}:route`,
        "route",
        core,
        route.tier3Effects,
        true,
      ),
    );
    core = combined.slice(0, Math.min(core.length, combined.length));
    routeEffects = combined.slice(core.length);
  }
  if (state.level >= 4 && state.routeId) {
    const route = getWeaponRoute(state.routeId);
    const combined = [...core, ...routeEffects];
    const enhanced = applyEffectPatches(
      combined,
      stagePatches(
        `${route.id}:enhancement`,
        "route",
        combined,
        route.tier4Effects,
        true,
      ),
    );
    core = enhanced.slice(0, Math.min(core.length, enhanced.length));
    routeEffects = enhanced.slice(core.length);
  }
  let masteryEffects: readonly EffectSpec[] = [];
  if (state.level >= 5) {
    if (!state.masteryId) {
      throw new Error(`Weapon ${state.id} at level five is missing a mastery`);
    }
    const mastery = getMasteryDefinition(state.masteryId);
    if (mastery.key === "focus") {
      const combined = [...core, ...routeEffects];
      const mastered = applyEffectPatches(
        combined,
        stagePatches(
          `${mastery.id}:mastery`,
          "route",
          combined,
          mastery.effects,
          true,
        ),
      );
      core = mastered.slice(0, Math.min(core.length, mastered.length));
      routeEffects = mastered.slice(core.length);
    } else {
      masteryEffects = [...mastery.effects];
    }
  }
  return {
    core,
    route: routeEffects,
    mastery: masteryEffects,
    effects: [...core, ...routeEffects, ...masteryEffects],
  };
}

export function resolveWeaponEffects(state: WeaponState): readonly EffectSpec[] {
  return resolveWeaponKit(state).effects;
}

export function incrementModifier(
  build: CombatBuild,
  modifierId: RunModifierId,
): CombatBuild {
  return {
    ...build,
    modifiers: {
      ...build.modifiers,
      [modifierId]: (build.modifiers[modifierId] ?? 0) + 1,
    },
  };
}
