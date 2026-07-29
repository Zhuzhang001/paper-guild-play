import { CELESTIAL_INTRUSIONS, getCelestialIntrusion } from "../content/celestials";
import { findFusionDefinition, getFusionDefinition } from "../content/fusions";
import {
  beam,
  chain,
  delayed,
  lightning,
  orbit,
  projectile,
  summon,
  zone,
} from "../content/effects";
import type {
  ActiveCelestialIntrusion,
  CelestialIntrusionId,
  CombatBuild,
  EffectSpec,
  EffectTag,
  FusionDefinition,
  WeaponId,
  WeaponState,
  WeaveNode,
  WeaveState,
  WeaveTerminal,
} from "../content/types";
import { getWeaponDefinition } from "../content/weapons";
import { randomInt, type RngState } from "./rng";

export type WeaveMutationFailure =
  | "node-capacity"
  | "fusion-capacity"
  | "not-adjacent"
  | "not-weapon-nodes"
  | "no-fusion-recipe"
  | "duplicate-weapon"
  | "intrusion-active"
  | "no-defeated-intrusion";

export type WeaveMutationResult =
  | { ok: true; state: WeaveState; node: WeaveNode }
  | { ok: false; state: WeaveState; reason: WeaveMutationFailure };

export type AdjacentFusionCandidate = {
  firstIndex: number;
  secondIndex: number;
  first: WeaveNode;
  second: WeaveNode;
  definition: FusionDefinition;
};

export type WeaveAdvanceResult = {
  state: WeaveState;
  passedNodes: readonly WeaveNode[];
  completedCycles: number;
  terminal?: WeaveTerminal;
};

const WEAPON_PASS_EFFECTS: Readonly<Record<WeaponId, readonly EffectSpec[]>> = {
  sword: [
    projectile("weave-sword-pass", ["blade", "mark"], 42, 0, {
      trigger: "onWeavePass",
      speed: 980,
      pierce: 4,
      markSeconds: 4,
    }),
  ],
  fan: [
    projectile("weave-fan-pass", ["wind"], 28, 0, {
      trigger: "onWeavePass",
      pattern: "fan",
      count: 5,
      spreadDegrees: 76,
      pierce: 2,
    }),
  ],
  umbrella: [
    orbit("weave-umbrella-pass", ["rain", "guard"], 24, {
      trigger: "onWeavePass",
      count: 4,
      radius: 112,
      blockStrength: 0.5,
    }),
  ],
  scissors: [
    beam("weave-scissors-pass", ["craft", "blade"], 48, {
      trigger: "onWeavePass",
      length: 440,
      width: 38,
    }),
  ],
  abacus: [
    projectile("weave-abacus-pass", ["ledger"], 20, 0, {
      trigger: "onWeavePass",
      pattern: "burst",
      count: 5,
      pierce: 3,
    }),
  ],
  crossbow: [
    projectile("weave-crossbow-pass", ["mechanism"], 26, 0, {
      trigger: "onWeavePass",
      pattern: "fan",
      count: 5,
      spreadDegrees: 36,
      speed: 1050,
    }),
  ],
  pipa: [
    chain("weave-pipa-pass", ["music"], 32, {
      trigger: "onWeavePass",
      jumps: 5,
      range: 235,
    }),
  ],
  inkline: [
    beam("weave-inkline-pass", ["craft"], 56, {
      trigger: "onWeavePass",
      length: 680,
      width: 20,
    }),
  ],
  lantern: [
    summon("weave-lantern-pass", ["shadow"], "weave-shadow-soldier", {
      trigger: "onWeavePass",
      count: 2,
      duration: 7,
      attackDamage: 26,
    }),
  ],
  thunderSeal: [
    lightning("weave-thunder-pass", ["lightning", "spirit"], 70, {
      trigger: "onWeavePass",
      strikes: 2,
      radius: 58,
    }),
  ],
};

function weaponNode(
  weaponState: WeaponState,
  instanceId: string,
  origin: "core" | "overflow",
): WeaveNode {
  const definition = getWeaponDefinition(weaponState.id);
  return {
    instanceId,
    kind: "weapon",
    sourceId: weaponState.id,
    name: definition.name,
    tags: definition.tags,
    passEffects: WEAPON_PASS_EFFECTS[weaponState.id],
    origin,
    weaponState: { ...weaponState },
  };
}

function fusionNode(
  definition: FusionDefinition,
  instanceId: string,
  consumedWeapons: readonly WeaponState[],
): WeaveNode {
  return {
    instanceId,
    kind: "fusion",
    sourceId: definition.id,
    name: definition.canonicalName,
    tags: definition.tags,
    passEffects: definition.effects,
    origin: "fusion",
    consumedWeapons,
  };
}

function celestialNode(
  intrusionId: CelestialIntrusionId,
  instanceId: string,
): WeaveNode {
  const definition = getCelestialIntrusion(intrusionId);
  return {
    instanceId,
    kind: "celestial",
    sourceId: intrusionId,
    name: definition.capturedName,
    tags: definition.capturedTags,
    passEffects: definition.capturedEffects,
    origin: "celestial",
  };
}

export function createWeaveState(
  build: CombatBuild,
  options: { maxNodes?: number; maxFusions?: number } = {},
): WeaveState {
  const maxNodes = options.maxNodes ?? 8;
  const nodes = build.weapons.slice(0, maxNodes).map((weaponState, index) =>
    weaponNode(weaponState, `node-${index + 1}`, "core"),
  );
  return {
    nodes,
    maxNodes,
    maxFusions: options.maxFusions ?? 4,
    pulse: {
      nodeIndex: 0,
      nodeProgress: 0,
      completedCycles: 0,
    },
    nextInstance: nodes.length + 1,
  };
}

export function insertWeaponNode(
  state: WeaveState,
  weapon: WeaponId | WeaponState,
  afterIndex = state.nodes.length - 1,
): WeaveMutationResult {
  const weaponState: WeaponState =
    typeof weapon === "string"
      ? {
          id: weapon,
          level: 3,
          routeId: getWeaponDefinition(weapon).routes[0].id,
        }
      : { ...weapon };
  const weaponId = weaponState.id;
  if (state.nodes.length >= state.maxNodes) {
    return { ok: false, state, reason: "node-capacity" };
  }
  if (state.nodes.some((node) => node.kind === "weapon" && node.sourceId === weaponId)) {
    return { ok: false, state, reason: "duplicate-weapon" };
  }
  const node = weaponNode(
    weaponState,
    `node-${state.nextInstance}`,
    "overflow",
  );
  const insertionIndex =
    state.nodes.length === 0
      ? 0
      : Math.min(state.nodes.length, Math.max(0, afterIndex + 1));
  const nodes = [...state.nodes];
  nodes.splice(insertionIndex, 0, node);
  return {
    ok: true,
    node,
    state: {
      ...state,
      nodes,
      nextInstance: state.nextInstance + 1,
      pulse: {
        ...state.pulse,
        nodeIndex: state.nodes.length === 0 ? 0 : state.pulse.nodeIndex,
      },
    },
  };
}

function areAdjacent(firstIndex: number, secondIndex: number, length: number): boolean {
  if (length < 2 || firstIndex === secondIndex) {
    return false;
  }
  return (
    (firstIndex + 1) % length === secondIndex ||
    (secondIndex + 1) % length === firstIndex
  );
}

export function swapWeaveNodes(
  state: WeaveState,
  firstIndex: number,
  secondIndex: number,
): WeaveState {
  if (
    firstIndex === secondIndex ||
    firstIndex < 0 ||
    secondIndex < 0 ||
    firstIndex >= state.nodes.length ||
    secondIndex >= state.nodes.length
  ) {
    return state;
  }
  const nodes = [...state.nodes];
  [nodes[firstIndex], nodes[secondIndex]] = [nodes[secondIndex], nodes[firstIndex]];
  return { ...state, nodes };
}

export function removeWeaveNode(
  state: WeaveState,
  nodeIndex: number,
): WeaveState {
  if (
    state.nodes.length <= 1 ||
    nodeIndex < 0 ||
    nodeIndex >= state.nodes.length
  ) {
    return state;
  }
  const nodes = state.nodes.filter((_, index) => index !== nodeIndex);
  const nextPulseIndex =
    state.pulse.nodeIndex > nodeIndex
      ? state.pulse.nodeIndex - 1
      : state.pulse.nodeIndex === nodeIndex
        ? Math.min(nodeIndex, nodes.length - 1)
        : state.pulse.nodeIndex;
  return {
    ...state,
    nodes,
    pulse: {
      ...state.pulse,
      nodeIndex: Math.max(0, nextPulseIndex) % nodes.length,
      nodeProgress: 0,
    },
  };
}

export function listAdjacentFusionCandidates(
  state: WeaveState,
): readonly AdjacentFusionCandidate[] {
  if (state.nodes.length < 2) {
    return [];
  }
  const candidates: AdjacentFusionCandidate[] = [];
  for (let firstIndex = 0; firstIndex < state.nodes.length; firstIndex += 1) {
    const secondIndex = (firstIndex + 1) % state.nodes.length;
    const first = state.nodes[firstIndex];
    const second = state.nodes[secondIndex];
    if (first.kind !== "weapon" || second.kind !== "weapon") {
      continue;
    }
    const definition = findFusionDefinition(
      first.sourceId as WeaponId,
      second.sourceId as WeaponId,
    );
    if (definition) {
      candidates.push({ firstIndex, secondIndex, first, second, definition });
    }
  }
  return candidates;
}

export function fuseAdjacentNodes(
  state: WeaveState,
  firstIndex: number,
  secondIndex: number,
): WeaveMutationResult {
  if (!areAdjacent(firstIndex, secondIndex, state.nodes.length)) {
    return { ok: false, state, reason: "not-adjacent" };
  }
  if (
    state.nodes.filter((node) => node.kind === "fusion").length >=
    state.maxFusions
  ) {
    return { ok: false, state, reason: "fusion-capacity" };
  }

  const first = state.nodes[firstIndex];
  const second = state.nodes[secondIndex];
  if (first.kind !== "weapon" || second.kind !== "weapon") {
    return { ok: false, state, reason: "not-weapon-nodes" };
  }
  const definition = findFusionDefinition(
    first.sourceId as WeaponId,
    second.sourceId as WeaponId,
  );
  if (!definition) {
    return { ok: false, state, reason: "no-fusion-recipe" };
  }

  const node = fusionNode(
    definition,
    `node-${state.nextInstance}`,
    [first.weaponState, second.weaponState].filter(
      (weaponState): weaponState is WeaponState => weaponState !== undefined,
    ),
  );
  const lower = Math.min(firstIndex, secondIndex);
  const upper = Math.max(firstIndex, secondIndex);
  let nodes: WeaveNode[];
  if (lower === 0 && upper === state.nodes.length - 1) {
    // Fusing the ring seam yields [fusion, ...middle], preserving clockwise travel.
    nodes = [node, ...state.nodes.slice(1, -1)];
  } else {
    nodes = [...state.nodes];
    nodes.splice(lower, 2, node);
  }
  return {
    ok: true,
    node,
    state: {
      ...state,
      nodes,
      nextInstance: state.nextInstance + 1,
      pulse: {
        ...state.pulse,
        nodeIndex: nodes.length === 0 ? 0 : state.pulse.nodeIndex % nodes.length,
        nodeProgress: 0,
      },
    },
  };
}

export function chooseCelestialIntrusion(
  cycleIndex: number,
  rngState: RngState,
  excluded: readonly CelestialIntrusionId[] = [],
): { id: CelestialIntrusionId; rngState: RngState } {
  const allowed = CELESTIAL_INTRUSIONS.filter(
    (definition) => !excluded.includes(definition.id),
  );
  const candidates = allowed.length > 0 ? allowed : CELESTIAL_INTRUSIONS;
  // Cycle offset prevents identical early sequences even when a caller reuses a seed.
  let state = rngState;
  for (let index = 0; index < Math.max(0, cycleIndex); index += 1) {
    state = randomInt(state, candidates.length).state;
  }
  const picked = randomInt(state, candidates.length);
  return { id: candidates[picked.value].id, rngState: picked.state };
}

export function beginCelestialIntrusion(
  state: WeaveState,
  intrusionId: CelestialIntrusionId,
  hpMultiplier = 1,
  warningSeconds = 4,
): WeaveState {
  if (state.activeIntrusion && state.activeIntrusion.phase !== "expired") {
    return state;
  }
  const definition = getCelestialIntrusion(intrusionId);
  const maxHp = Math.round(definition.baseHp * Math.max(0.1, hpMultiplier));
  return {
    ...state,
    activeIntrusion: {
      id: intrusionId,
      phase: "warning",
      timeRemaining: Math.max(0, warningSeconds),
      hp: maxHp,
      maxHp,
    },
  };
}

export function stepCelestialIntrusion(
  state: WeaveState,
  deltaSeconds: number,
): WeaveState {
  const active = state.activeIntrusion;
  if (!active || deltaSeconds <= 0 || active.phase === "defeated" || active.phase === "expired") {
    return state;
  }
  const remaining = active.timeRemaining - deltaSeconds;
  if (active.phase === "warning" && remaining <= 0) {
    return {
      ...state,
      activeIntrusion: {
        ...active,
        phase: "active",
        timeRemaining: getCelestialIntrusion(active.id).duration,
      },
    };
  }
  if (active.phase === "active" && remaining <= 0) {
    return {
      ...state,
      activeIntrusion: {
        ...active,
        phase: "expired",
        timeRemaining: 0,
      },
    };
  }
  return {
    ...state,
    activeIntrusion: { ...active, timeRemaining: Math.max(0, remaining) },
  };
}

export function damageCelestialIntrusion(
  state: WeaveState,
  damage: number,
): WeaveState {
  const active = state.activeIntrusion;
  if (!active || active.phase !== "active" || damage <= 0) {
    return state;
  }
  const hp = Math.max(0, active.hp - damage);
  return {
    ...state,
    activeIntrusion: {
      ...active,
      hp,
      phase: hp === 0 ? "defeated" : "active",
      timeRemaining: hp === 0 ? 0 : active.timeRemaining,
    },
  };
}

export function captureDefeatedIntrusion(
  state: WeaveState,
  afterIndex = state.nodes.length - 1,
): WeaveMutationResult {
  const active = state.activeIntrusion;
  if (!active || active.phase !== "defeated") {
    return { ok: false, state, reason: "no-defeated-intrusion" };
  }
  if (state.nodes.length >= state.maxNodes) {
    return { ok: false, state, reason: "node-capacity" };
  }
  const node = celestialNode(active.id, `node-${state.nextInstance}`);
  const insertionIndex =
    state.nodes.length === 0
      ? 0
      : Math.min(state.nodes.length, Math.max(0, afterIndex + 1));
  const nodes = [...state.nodes];
  nodes.splice(insertionIndex, 0, node);
  return {
    ok: true,
    node,
    state: {
      ...state,
      nodes,
      activeIntrusion: undefined,
      nextInstance: state.nextInstance + 1,
    },
  };
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function includesCyclicSequence(
  sources: readonly string[],
  sequence: readonly string[],
): boolean {
  if (sources.length < sequence.length) {
    return false;
  }
  for (let start = 0; start < sources.length; start += 1) {
    if (
      sequence.every(
        (source, offset) => sources[(start + offset) % sources.length] === source,
      )
    ) {
      return true;
    }
  }
  return false;
}

function terminalName(nodes: readonly WeaveNode[]): string {
  const sources = nodes.map((node) => node.sourceId);
  if (includesCyclicSequence(sources, ["fan", "umbrella", "thunderSeal"])) {
    return "雨针散开后落雷";
  }
  if (includesCyclicSequence(sources, ["thunderSeal", "umbrella", "fan"])) {
    return "伞骨蓄雷后送风";
  }
  if (nodes.length === 0) {
    return "空盘";
  }
  return `${nodes[0].name}起手，${nodes[nodes.length - 1].name}收尾`;
}

export type WeaveDelivery =
  | "projectile"
  | "beam"
  | "chain"
  | "lightning"
  | "zone"
  | "summon";

export type WeaveTransformSnapshot = {
  delivery: WeaveDelivery;
  damage: number;
  count: number;
  pierce: number;
  homing: number;
  spread: number;
  length: number;
  width: number;
  jumps: number;
  range: number;
  radius: number;
  duration: number;
  repeats: number;
  stored: number;
  tags: readonly EffectTag[];
};

export type WeaveTransform = WeaveTransformSnapshot;

function addTags(
  current: readonly EffectTag[],
  added: readonly EffectTag[],
): readonly EffectTag[] {
  return [...new Set([...current, ...added])];
}

function routeKey(node: WeaveNode): "a" | "b" | "c" | undefined {
  const key = node.weaponState?.routeId?.split(":")[1];
  return key === "a" || key === "b" || key === "c" ? key : undefined;
}

function applyWeaponTransform(
  input: WeaveTransformSnapshot,
  node: WeaveNode,
): WeaveTransformSnapshot {
  const output: WeaveTransformSnapshot = {
    ...input,
    tags: addTags(input.tags, node.tags),
  };
  const source = node.sourceId as WeaponId;
  const selectedRoute = routeKey(node);
  const mastered = node.weaponState?.level === 5;
  if (source === "sword") {
    output.damage += 22;
    output.pierce += selectedRoute === "a" ? 4 : 2;
    output.width += selectedRoute === "c" ? 42 : 0;
    output.count += selectedRoute === "b" ? 2 : 0;
  } else if (source === "fan") {
    if (output.delivery === "lightning" || output.delivery === "zone") {
      output.delivery = "projectile";
      output.homing += 0.55;
    }
    output.count = output.count * 2 + 2;
    output.spread += 52;
    output.damage *= 0.78;
  } else if (source === "umbrella") {
    output.stored += output.damage * (selectedRoute === "c" ? 0.58 : 0.42);
    if (output.delivery === "lightning") {
      output.delivery = "projectile";
      output.count += 8;
      output.homing += 0.48;
      output.damage *= 0.82;
    } else {
      output.delivery = "zone";
      output.radius += 62;
      output.duration += 1.4;
    }
  } else if (source === "scissors") {
    output.delivery = "beam";
    output.damage *= selectedRoute === "c" ? 1.48 : 1.3;
    output.width += 30;
    output.length += 150;
    output.pierce += 2;
  } else if (source === "abacus") {
    output.count += 3;
    output.damage += output.count * 2.4;
    output.jumps += selectedRoute === "c" ? 2 : 0;
  } else if (source === "crossbow") {
    if (output.delivery === "zone") output.delivery = "projectile";
    output.count = Math.max(2, output.count * 2);
    output.damage *= 0.76;
    output.pierce += 2;
  } else if (source === "pipa") {
    output.delivery = "chain";
    output.jumps += Math.max(4, Math.ceil(output.count * 0.7));
    output.range += 70;
    output.damage += output.stored * 0.22;
  } else if (source === "inkline") {
    output.delivery = "beam";
    output.length += 360;
    output.width = Math.max(22, output.width * 0.72);
    output.pierce += 6;
  } else if (source === "lantern") {
    if (output.tags.length <= node.tags.length) output.delivery = "summon";
    output.repeats += selectedRoute === "c" ? 2 : 1;
    output.damage *= 0.86;
    output.count += 1;
  } else if (source === "thunderSeal") {
    output.delivery = "lightning";
    output.damage += output.stored + 34;
    output.count = Math.max(2, Math.ceil(output.count * 0.72));
    output.radius += 24;
    output.range += output.jumps * 12;
  }

  if (mastered) {
    if (node.weaponState?.masteryId?.endsWith(":focus")) {
      output.damage *= 1.18;
    } else {
      output.repeats += 1;
    }
  }
  return output;
}

function applyFusionTransform(
  input: WeaveTransformSnapshot,
  node: WeaveNode,
): WeaveTransformSnapshot {
  const definition = getFusionDefinition(
    node.sourceId as FusionDefinition["id"],
  );
  const primary = definition.effects[0];
  const output: WeaveTransformSnapshot = {
    ...input,
    tags: addTags(input.tags, definition.tags),
    damage: input.damage * 1.22 + 34,
    count: input.count + 2,
    stored: input.stored + input.damage * 0.24,
  };
  if (primary.kind === "beam") {
    output.delivery = "beam";
    output.length = Math.max(output.length, primary.length);
    output.width = Math.max(output.width, primary.width);
  } else if (primary.kind === "chain") {
    output.delivery = "chain";
    output.jumps += primary.jumps;
    output.range = Math.max(output.range, primary.range);
  } else if (primary.kind === "lightning") {
    output.delivery = "lightning";
    output.count += primary.strikes;
    output.radius = Math.max(output.radius, primary.radius);
  } else if (primary.kind === "zone" || primary.kind === "orbit") {
    output.delivery = "zone";
    output.radius = Math.max(output.radius, primary.radius);
    output.duration += 1;
  } else if (primary.kind === "summon") {
    output.delivery = "summon";
    output.count += primary.count;
    output.duration = Math.max(output.duration, primary.duration);
  } else if (primary.kind === "projectile") {
    output.delivery = "projectile";
    output.count += primary.count;
    output.pierce += primary.pierce;
    output.homing += primary.homing ?? 0;
  }
  return output;
}

function applyCelestialTransform(
  input: WeaveTransformSnapshot,
  node: WeaveNode,
): WeaveTransformSnapshot {
  const output: WeaveTransformSnapshot = {
    ...input,
    tags: addTags(input.tags, node.tags),
    damage: input.damage * 1.16 + 28,
    radius: input.radius + 34,
  };
  if (node.tags.includes("lightning")) {
    output.delivery = "lightning";
    output.count += 3;
    output.range += 90;
  } else if (node.tags.includes("wind")) {
    output.delivery = "projectile";
    output.count = output.count * 2 + 1;
    output.homing += 0.32;
  } else {
    output.delivery = "zone";
    output.duration += 1.8;
  }
  return output;
}

export function deriveWeaveTransform(
  nodes: readonly WeaveNode[],
): WeaveTransformSnapshot {
  return nodes.reduce<WeaveTransformSnapshot>(
    (current, node) =>
      node.kind === "weapon"
        ? applyWeaponTransform(current, node)
        : node.kind === "fusion"
          ? applyFusionTransform(current, node)
          : applyCelestialTransform(current, node),
    {
      delivery: "projectile",
      damage: 66,
      count: 1,
      pierce: 1,
      homing: 0,
      spread: 18,
      length: 420,
      width: 40,
      jumps: 1,
      range: 190,
      radius: 92,
      duration: 3,
      repeats: 0,
      stored: 0,
      tags: [],
    },
  );
}

function terminalCoreEffect(
  hash: number,
  transform: WeaveTransformSnapshot,
): EffectSpec {
  const id = `terminal-${hash}-core`;
  const common = {
    trigger: "onTerminal" as const,
    visualKey: `terminal/generated/${hash}/core`,
  };
  if (transform.delivery === "beam") {
    return beam(id, transform.tags, transform.damage, {
      ...common,
      length: transform.length,
      width: transform.width,
      pierce: transform.pierce + transform.count,
      sweepDegrees: Math.min(110, transform.spread),
    });
  }
  if (transform.delivery === "chain") {
    return chain(id, transform.tags, transform.damage, {
      ...common,
      jumps: Math.max(4, transform.jumps + transform.count),
      range: transform.range,
      falloff: 0.94,
      preferMarked: transform.tags.includes("mark"),
    });
  }
  if (transform.delivery === "lightning") {
    return lightning(id, transform.tags, transform.damage, {
      ...common,
      strikes: Math.max(2, transform.count + transform.repeats),
      radius: transform.radius,
      delay: 0.3,
      chainRange: transform.range,
    });
  }
  if (transform.delivery === "zone") {
    return zone(id, transform.tags, transform.damage * 0.62, {
      ...common,
      radius: transform.radius,
      duration: transform.duration + transform.repeats * 0.5,
      tickRate: 0.22,
      followsOwner: transform.tags.includes("guard"),
      slow: transform.tags.includes("frost") ? 0.35 : 0.18,
    });
  }
  if (transform.delivery === "summon") {
    return summon(id, transform.tags, "terminal-weave-actor", {
      ...common,
      count: Math.max(2, transform.count + transform.repeats),
      duration: transform.duration + 5,
      attackDamage: transform.damage * 0.48,
      attackCooldown: 0.42,
      moveSpeed: 210,
    });
  }
  return projectile(id, transform.tags, transform.damage, 0, {
    ...common,
    pattern: transform.count > 2 ? "radial" : "burst",
    count: Math.max(2, transform.count + transform.repeats),
    speed: 900,
    pierce: transform.pierce,
    spreadDegrees: transform.spread,
    homing: transform.homing,
    markSeconds: transform.tags.includes("mark") ? 4 : undefined,
  });
}

export function deriveWeaveTerminal(state: WeaveState): WeaveTerminal {
  const signature = state.nodes
    .map(
      (node, index) =>
        `${index}:${node.kind}:${node.sourceId}:${node.weaponState?.routeId ?? "-"}:${node.weaponState?.masteryId ?? "-"}`,
    )
    .join(">");
  const hash = stableHash(signature || "empty-weave");
  const transform = deriveWeaveTransform(state.nodes);
  const effects: EffectSpec[] = [terminalCoreEffect(hash, transform)];
  if (transform.repeats > 0 && transform.delivery !== "summon") {
    effects.push(
      delayed(`terminal-${hash}-echo`, transform.tags, transform.damage * 0.48, {
        trigger: "onTerminal",
        delay: 0.45,
        radius: transform.radius,
        repeats: Math.min(3, transform.repeats - 1),
        visualKey: `terminal/generated/${hash}/echo`,
      }),
    );
  }

  return {
    id: `terminal-${hash.toString(16).padStart(8, "0")}`,
    name: terminalName(state.nodes),
    signature,
    chargeSeconds: Math.min(
      12,
      Math.max(
        6,
        10.4 - state.nodes.length * 0.38 + Math.min(1.6, transform.stored / 180),
      ),
    ),
    effects,
    steps: state.nodes.map((node, index) => ({
      nodeInstanceId: node.instanceId,
      label:
        node.kind === "fusion"
          ? getFusionDefinition(node.sourceId as FusionDefinition["id"]).action
          : node.kind === "celestial"
            ? `收${node.name}入时`
            : `经${node.name}${routeKey(node) ? `·${routeKey(node)}` : ""}`,
      ordinal: index,
      tagsAdded: node.tags,
    })),
    artKey: `terminal/generated/${hash.toString(16).padStart(8, "0")}`,
  };
}

export function advanceWeavePulse(
  state: WeaveState,
  deltaSeconds: number,
): WeaveAdvanceResult {
  if (deltaSeconds <= 0 || state.nodes.length === 0) {
    return { state, passedNodes: [], completedCycles: 0 };
  }
  const terminal = deriveWeaveTerminal(state);
  const secondsPerNode = terminal.chargeSeconds / state.nodes.length;
  let nodeIndex = state.pulse.nodeIndex % state.nodes.length;
  let nodeProgress = state.pulse.nodeProgress + deltaSeconds / secondsPerNode;
  let completedCycles = 0;
  const passedNodes: WeaveNode[] = [];

  while (nodeProgress >= 1) {
    nodeProgress -= 1;
    passedNodes.push(state.nodes[nodeIndex]);
    nodeIndex = (nodeIndex + 1) % state.nodes.length;
    if (nodeIndex === 0) {
      completedCycles += 1;
    }
  }

  const nextState: WeaveState = {
    ...state,
    pulse: {
      nodeIndex,
      nodeProgress,
      completedCycles: state.pulse.completedCycles + completedCycles,
    },
  };
  return {
    state: nextState,
    passedNodes,
    completedCycles,
    terminal: completedCycles > 0 ? terminal : undefined,
  };
}

export function getActiveIntrusionDefinition(
  state: WeaveState,
): ReturnType<typeof getCelestialIntrusion> | undefined {
  return state.activeIntrusion
    ? getCelestialIntrusion(state.activeIntrusion.id)
    : undefined;
}

export function isIntrusionThreatening(
  active: ActiveCelestialIntrusion | undefined,
): boolean {
  return active?.phase === "warning" || active?.phase === "active";
}
