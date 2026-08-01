import type {
  CombatBuild,
  EffectPatch,
  EffectSpec,
  ResolvedWeaponKit,
  RunModifierId,
  TravelNoteCategory,
  TravelNoteDefinition,
  TravelNoteId,
  TravelNoteRankState,
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
  travelNoteContext?: TravelNoteContext;
};

export type TravelNoteContext = {
  oneLife?: boolean;
  recoveryEnabled?: boolean;
};

export type UpgradeGenerationResult = {
  options: readonly UpgradeOption[];
  rngState: RngState;
  milestone: "route" | "mastery" | "normal" | "travelNote" | "complete";
  weaponId?: WeaponId;
};

export const TRAVEL_NOTE_CATEGORIES: readonly TravelNoteCategory[] = [
  "craft",
  "journey",
  "protection",
] as const;

export const TRAVEL_NOTE_DEFINITIONS: readonly TravelNoteDefinition[] = [
  {
    id: "keenEdge",
    name: "砺锋",
    category: "craft",
    maxRank: 4,
    description: "逐阶打磨器锋，提高所有基础伤害。",
    rankEffects: ["基础伤害 +6%", "基础伤害 +12%", "基础伤害 +18%", "基础伤害 +24%"],
    requirements: [],
    artKey: "upgrade/travel-note-keen-edge",
  },
  {
    id: "quickHands",
    name: "顺手",
    category: "craft",
    maxRank: 3,
    description: "收紧现有核心攻击的节拍，不另开攻击计时。",
    rankEffects: ["核心攻击间隔 -5%", "核心攻击间隔 -10%", "核心攻击间隔 -15%"],
    requirements: [],
    artKey: "upgrade/travel-note-quick-hands",
  },
  {
    id: "longReach",
    name: "放远",
    category: "craft",
    maxRank: 2,
    description: "延伸弹体、扫击、光束与区域的作用距离。",
    rankEffects: ["作用距离 +10%", "作用距离 +20%"],
    requirements: [],
    artKey: "upgrade/travel-note-long-reach",
  },
  {
    id: "lastingWork",
    name: "久留",
    category: "craft",
    maxRank: 2,
    description: "让召唤物与驻留区域在场上维持更久。",
    rankEffects: ["召唤物与驻留区域时间 +15%", "召唤物与驻留区域时间 +30%"],
    requirements: ["durationWeapon"],
    artKey: "upgrade/travel-note-lasting-work",
  },
  {
    id: "gatheringWind",
    name: "聚风",
    category: "journey",
    maxRank: 3,
    description: "扩大纸结感应范围，并加快吸附。",
    rankEffects: ["经验吸附范围与速度 +18%", "经验吸附范围与速度 +36%", "经验吸附范围与速度 +54%"],
    requirements: [],
    artKey: "upgrade/travel-note-gathering-wind",
  },
  {
    id: "lightStep",
    name: "轻脚",
    category: "journey",
    maxRank: 2,
    description: "让行路脚步更轻快。",
    rankEffects: ["移动速度 +5%", "移动速度 +10%"],
    requirements: [],
    artKey: "upgrade/travel-note-light-step",
  },
  {
    id: "mergePearls",
    name: "并珠",
    category: "journey",
    maxRank: 2,
    description: "更早归并散落纸结，并加强合并纸结的吸附。",
    rankEffects: ["归并阈值 92 → 72，合并纸结吸附增强", "归并阈值 72 → 56，合并纸结吸附再次增强"],
    requirements: [],
    artKey: "upgrade/travel-note-merge-pearls",
  },
  {
    id: "turningMomentum",
    name: "转身借力",
    category: "journey",
    maxRank: 2,
    description: "急转后令下一次核心攻击重新索敌并补发45%回响。",
    rankEffects: ["回响冷却 6 秒", "回响冷却 6 → 4 秒"],
    requirements: [],
    artKey: "upgrade/travel-note-turning-momentum",
  },
  {
    id: "paperWard",
    name: "护纸",
    category: "protection",
    maxRank: 2,
    description: "增加一命并立即恢复一命。",
    rankEffects: ["生命上限 +1，并恢复 1 命", "生命上限再 +1，并恢复 1 命"],
    requirements: ["notOneLife"],
    artKey: "upgrade/travel-note-paper-ward",
  },
  {
    id: "slowPaper",
    name: "缓纸",
    category: "protection",
    maxRank: 2,
    description: "延长受击后的安全间隙。",
    rankEffects: ["受击无敌时间 +0.15 秒", "受击无敌时间 +0.30 秒"],
    requirements: [],
    artKey: "upgrade/travel-note-slow-paper",
  },
  {
    id: "stepBack",
    name: "退一步",
    category: "protection",
    maxRank: 2,
    description: "受击时推开身边的非Boss敌人。",
    rankEffects: ["推开 100px 内敌人，冷却 8 秒", "推开 140px 内敌人，冷却 6 秒"],
    requirements: [],
    artKey: "upgrade/travel-note-step-back",
  },
  {
    id: "pickupMend",
    name: "拾补",
    category: "protection",
    maxRank: 2,
    description: "拾取足够多的朱砂纸结后生成恢复叶。",
    rankEffects: ["每拾取 8 枚朱砂纸结生成恢复叶", "每拾取 6 枚朱砂纸结生成恢复叶"],
    requirements: ["notOneLife", "recoveryEnabled"],
    artKey: "upgrade/travel-note-pickup-mend",
  },
] as const;

const TRAVEL_NOTE_BY_ID = new Map(
  TRAVEL_NOTE_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function getTravelNoteDefinition(id: TravelNoteId): TravelNoteDefinition {
  const definition = TRAVEL_NOTE_BY_ID.get(id);
  if (!definition) throw new Error(`Unknown travel note ${id}`);
  return definition;
}

export function getTravelNoteRank(
  buildOrRanks: CombatBuild | TravelNoteRankState | undefined,
  id: TravelNoteId,
): number {
  if (!buildOrRanks) return 0;
  const ranks = "weapons" in buildOrRanks
    ? buildOrRanks.travelNotes
    : buildOrRanks;
  return Math.max(0, Math.floor(ranks?.[id] ?? 0));
}

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
    travelNotes: {},
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
    title: definition.name,
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

export function areAllWeaponsMastered(
  build: CombatBuild,
  maxWeapons = 4,
): boolean {
  return (
    build.weapons.length >= maxWeapons &&
    build.weapons.every((weapon) => weapon.level === 5)
  );
}

function hasDurationWeapon(build: CombatBuild): boolean {
  return build.weapons.some((weapon) =>
    resolveWeaponEffects(weapon).some(
      (effect) => effect.kind === "summon" || effect.kind === "zone",
    )
  );
}

export function availableTravelNotes(
  build: CombatBuild,
  context: TravelNoteContext = {},
): readonly TravelNoteDefinition[] {
  const durationWeapon = hasDurationWeapon(build);
  return TRAVEL_NOTE_DEFINITIONS.filter((definition) => {
    if (getTravelNoteRank(build, definition.id) >= definition.maxRank) {
      return false;
    }
    if (
      definition.requirements.includes("durationWeapon") &&
      !durationWeapon
    ) {
      return false;
    }
    if (definition.requirements.includes("notOneLife") && context.oneLife) {
      return false;
    }
    if (
      definition.requirements.includes("recoveryEnabled") &&
      context.recoveryEnabled === false
    ) {
      return false;
    }
    return true;
  });
}

export function hasAvailableTravelNotes(
  build: CombatBuild,
  context: TravelNoteContext = {},
): boolean {
  return availableTravelNotes(build, context).length > 0;
}

function travelNoteOption(
  build: CombatBuild,
  definition: TravelNoteDefinition,
  slotCategory: TravelNoteCategory,
): UpgradeOption {
  const currentRank = getTravelNoteRank(build, definition.id);
  const nextRank = currentRank + 1;
  return {
    id: `travel-note-${definition.id}-${nextRank}`,
    kind: "utility",
    modifierId: definition.id,
    travelNoteId: definition.id,
    travelNoteCategory: definition.category,
    slotCategory,
    currentRank,
    nextRank,
    maxRank: definition.maxRank,
    title: definition.name,
    description: `当前 ${currentRank}/${definition.maxRank} 阶；选择后：${definition.rankEffects[nextRank - 1]}`,
    artKey: definition.artKey,
  };
}

export function generateTravelNoteOptions(
  build: CombatBuild,
  rngState: RngState,
  context: TravelNoteContext = {},
): UpgradeGenerationResult {
  const available = [...availableTravelNotes(build, context)];
  if (available.length === 0) {
    return { options: [], rngState, milestone: "complete" };
  }

  const chosen: TravelNoteDefinition[] = [];
  const options: UpgradeOption[] = [];
  let currentState = rngState;
  for (const slotCategory of TRAVEL_NOTE_CATEGORIES) {
    const unused = available.filter(
      (definition) => !chosen.some((item) => item.id === definition.id),
    );
    if (unused.length === 0) break;
    const matching = unused.filter(
      (definition) => definition.category === slotCategory,
    );
    const picked = takeOne(matching.length > 0 ? matching : unused, currentState);
    currentState = picked.rngState;
    if (!picked.value) continue;
    chosen.push(picked.value);
    options.push(travelNoteOption(build, picked.value, slotCategory));
  }

  return { options, rngState: currentState, milestone: "travelNote" };
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
  if (areAllWeaponsMastered(build, maxWeapons)) {
    return generateTravelNoteOptions(
      build,
      routeMilestone.rngState,
      config.travelNoteContext,
    );
  }
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
    if (option.travelNoteId) {
      const definition = getTravelNoteDefinition(option.travelNoteId);
      const currentRank = getTravelNoteRank(build, option.travelNoteId);
      if (currentRank >= definition.maxRank) {
        throw new Error(`Travel note ${option.travelNoteId} is already complete`);
      }
      return {
        ...build,
        travelNotes: {
          ...build.travelNotes,
          [option.travelNoteId]: currentRank + 1,
        },
      };
    }
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
