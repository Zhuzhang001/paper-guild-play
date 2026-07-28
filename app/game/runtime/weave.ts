import { CELESTIAL_INTRUSIONS, getCelestialIntrusion } from "../content/celestials";
import { findFusionDefinition, getFusionDefinition } from "../content/fusions";
import { beam, chain, lightning, orbit, projectile, summon, zone } from "../content/effects";
import type {
  ActiveCelestialIntrusion,
  CelestialIntrusionId,
  CombatBuild,
  EffectSpec,
  EffectTag,
  FusionDefinition,
  WeaponId,
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
  weaponId: WeaponId,
  instanceId: string,
): WeaveNode {
  const definition = getWeaponDefinition(weaponId);
  return {
    instanceId,
    kind: "weapon",
    sourceId: weaponId,
    name: definition.name,
    tags: definition.tags,
    passEffects: WEAPON_PASS_EFFECTS[weaponId],
  };
}

function fusionNode(
  definition: FusionDefinition,
  instanceId: string,
): WeaveNode {
  return {
    instanceId,
    kind: "fusion",
    sourceId: definition.id,
    name: definition.name,
    tags: definition.tags,
    passEffects: definition.effects,
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
  };
}

export function createWeaveState(
  build: CombatBuild,
  options: { maxNodes?: number; maxFusions?: number } = {},
): WeaveState {
  const maxNodes = options.maxNodes ?? 8;
  const nodes = build.weapons.slice(0, maxNodes).map((state, index) =>
    weaponNode(state.id, `node-${index + 1}`),
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
  weaponId: WeaponId,
  afterIndex = state.nodes.length - 1,
): WeaveMutationResult {
  if (state.nodes.length >= state.maxNodes) {
    return { ok: false, state, reason: "node-capacity" };
  }
  if (state.nodes.some((node) => node.kind === "weapon" && node.sourceId === weaponId)) {
    return { ok: false, state, reason: "duplicate-weapon" };
  }
  const node = weaponNode(weaponId, `node-${state.nextInstance}`);
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

  const node = fusionNode(definition, `node-${state.nextInstance}`);
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

function uniqueTags(nodes: readonly WeaveNode[]): EffectTag[] {
  return [...new Set(nodes.flatMap((node) => node.tags))];
}

function terminalName(nodes: readonly WeaveNode[]): string {
  const sources = nodes.map((node) => node.sourceId);
  if (includesCyclicSequence(sources, ["fan", "umbrella", "thunderSeal"])) {
    return "九霄烟雨";
  }
  if (includesCyclicSequence(sources, ["thunderSeal", "umbrella", "fan"])) {
    return "藏霆寻风";
  }
  if (nodes.length === 0) {
    return "空盘";
  }
  return `${nodes[0].name}·${nodes[nodes.length - 1].name}终式`;
}

export function deriveWeaveTerminal(state: WeaveState): WeaveTerminal {
  const signature = state.nodes
    .map((node, index) => `${index}:${node.kind}:${node.sourceId}`)
    .join(">");
  const hash = stableHash(signature || "empty-weave");
  const tags = uniqueTags(state.nodes);
  const baseDamage = 70 + state.nodes.length * 14 + (hash % 19);
  const effects: EffectSpec[] = [
    projectile(`terminal-${hash}-core`, tags, baseDamage, 0, {
      trigger: "onTerminal",
      pattern: "radial",
      count: Math.max(6, state.nodes.length * 3),
      pierce: 4 + (hash % 4),
      homing: (hash % 3) * 0.2,
      visualKey: `terminal/generated/${hash}/core`,
    }),
  ];

  if (tags.includes("lightning")) {
    effects.push(
      lightning(`terminal-${hash}-lightning`, tags, baseDamage * 1.35, {
        trigger: "onTerminal",
        strikes: Math.max(3, state.nodes.length),
        radius: 72 + (hash % 28),
        delay: 0.28,
      }),
    );
  }
  if (tags.includes("music")) {
    effects.push(
      chain(`terminal-${hash}-cadence`, tags, baseDamage * 0.72, {
        trigger: "onTerminal",
        jumps: 5 + state.nodes.length,
        range: 240 + (hash % 50),
        falloff: 0.96,
      }),
    );
  }
  if (tags.includes("guard") || tags.includes("wind")) {
    effects.push(
      zone(`terminal-${hash}-field`, tags, baseDamage * 0.46, {
        trigger: "onTerminal",
        radius: 160 + (hash % 48),
        duration: 4.5,
        tickRate: 0.22,
        followsOwner: tags.includes("guard"),
      }),
    );
  }

  return {
    id: `terminal-${hash.toString(16).padStart(8, "0")}`,
    name: terminalName(state.nodes),
    signature,
    chargeSeconds: Math.min(
      12,
      Math.max(6, 6 + state.nodes.length * 0.55 + (hash % 16) / 10),
    ),
    effects,
    steps: state.nodes.map((node, index) => ({
      nodeInstanceId: node.instanceId,
      label:
        node.kind === "fusion"
          ? getFusionDefinition(node.sourceId as FusionDefinition["id"]).weaveVerb
          : `经${node.name}`,
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
