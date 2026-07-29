import {
  getFusionDefinition,
  getWeaponDefinition,
  type FusionId,
  type WeaponId,
  type WeaponState,
  type WeaveState,
  WEAPON_IDS,
} from "../content";
import { sampleDeterministic, type RngState } from "./rng";
import {
  deriveWeaveTerminal,
  fuseAdjacentNodes,
  insertWeaponNode,
  listAdjacentFusionCandidates,
  swapWeaveNodes,
} from "./weave";

export type ForgeState = {
  cycle: number;
  refreshesRemaining: number;
  offeredIds: readonly string[];
};

export type ForgeOffer =
  | {
      id: string;
      kind: "insert";
      title: string;
      description: string;
      weaponState: WeaponState;
    }
  | {
      id: string;
      kind: "fusion";
      title: string;
      description: string;
      fusionId: FusionId;
      firstIndex: number;
      secondIndex: number;
      pairLabel: string;
      action: string;
    }
  | {
      id: string;
      kind: "swap";
      title: string;
      description: string;
      firstIndex: number;
      secondIndex: number;
      previewTerminalId: string;
    }
  | {
      id: string;
      kind: "temper";
      title: string;
      description: string;
      nodeIndex: number;
      weaponState: WeaponState;
    };

export type ForgeOfferResult = {
  offers: readonly ForgeOffer[];
  state: ForgeState;
  rngState: RngState;
};

export function createForgeState(refreshes = 1): ForgeState {
  return {
    cycle: 0,
    refreshesRemaining: Math.max(0, Math.floor(refreshes)),
    offeredIds: [],
  };
}

function nextTemperedState(
  weaponState: WeaponState,
  cycle: number,
): WeaponState | undefined {
  const definition = getWeaponDefinition(weaponState.id);
  if (weaponState.level === 1) return { ...weaponState, level: 2 };
  if (weaponState.level === 2) {
    const route = definition.routes[cycle % definition.routes.length];
    return { ...weaponState, level: 3, routeId: route.id };
  }
  if (weaponState.level === 3) return { ...weaponState, level: 4 };
  if (weaponState.level === 4 && weaponState.routeId) {
    const route = definition.routes.find(
      (candidate) => candidate.id === weaponState.routeId,
    );
    const mastery = route?.masteries[cycle % 2];
    if (mastery) {
      return { ...weaponState, level: 5, masteryId: mastery.id };
    }
  }
  return undefined;
}

function forgeCandidates(
  weave: WeaveState,
  forgeState: ForgeState,
): ForgeOffer[] {
  const candidates: ForgeOffer[] = [];
  const held = new Set(
    weave.nodes
      .filter((node) => node.kind === "weapon")
      .map((node) => node.sourceId as WeaponId),
  );

  for (const weaponId of WEAPON_IDS) {
    if (held.has(weaponId) || weave.nodes.length >= weave.maxNodes) continue;
    const definition = getWeaponDefinition(weaponId);
    const route = definition.routes[forgeState.cycle % definition.routes.length];
    const weaponState: WeaponState = {
      id: weaponId,
      level: 3,
      routeId: route.id,
    };
    candidates.push({
      id: `insert:${weaponId}:${route.key}`,
      kind: "insert",
      title: `纳入${definition.shortName}`,
      description: `以“${route.name}”路线加入器盘。`,
      weaponState,
    });
  }

  for (const candidate of listAdjacentFusionCandidates(weave)) {
    const definition = getFusionDefinition(candidate.definition.id);
    candidates.push({
      id: `fusion:${candidate.first.instanceId}:${candidate.second.instanceId}:${definition.id}`,
      kind: "fusion",
      title: definition.canonicalName,
      description: definition.description,
      fusionId: definition.id,
      firstIndex: candidate.firstIndex,
      secondIndex: candidate.secondIndex,
      pairLabel: definition.pairLabel,
      action: definition.action,
    });
  }

  for (let firstIndex = 0; firstIndex < weave.nodes.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < weave.nodes.length;
      secondIndex += 1
    ) {
      const preview = deriveWeaveTerminal(
        swapWeaveNodes(weave, firstIndex, secondIndex),
      );
      candidates.push({
        id: `swap:${weave.nodes[firstIndex].instanceId}:${weave.nodes[secondIndex].instanceId}`,
        kind: "swap",
        title: "调换器盘",
        description: `交换${weave.nodes[firstIndex].name}与${weave.nodes[secondIndex].name}，预览收势“${preview.name}”。`,
        firstIndex,
        secondIndex,
        previewTerminalId: preview.id,
      });
    }
  }

  weave.nodes.forEach((node, nodeIndex) => {
    if (node.kind !== "weapon" || !node.weaponState) return;
    const nextState = nextTemperedState(node.weaponState, forgeState.cycle);
    if (!nextState) return;
    candidates.push({
      id: `temper:${node.instanceId}:${nextState.level}:${nextState.routeId ?? "none"}:${nextState.masteryId ?? "none"}`,
      kind: "temper",
      title: `温养${node.name}`,
      description: "保留原器来源与路线，将该节点推进一阶。",
      nodeIndex,
      weaponState: nextState,
    });
  });

  return candidates;
}

export function generateForgeOffers(
  weave: WeaveState,
  rngState: RngState,
  forgeState: ForgeState,
  count = 4,
): ForgeOfferResult {
  const candidates = forgeCandidates(weave, forgeState);
  const fresh = candidates.filter(
    (candidate) => !forgeState.offeredIds.includes(candidate.id),
  );
  const pool =
    fresh.length >= Math.min(count, candidates.length) ? fresh : candidates;
  const sampled = sampleDeterministic(
    pool,
    Math.max(1, Math.floor(count)),
    rngState,
  );
  return {
    offers: sampled.values,
    rngState: sampled.state,
    state: {
      ...forgeState,
      cycle: forgeState.cycle + 1,
      offeredIds: sampled.values.map((offer) => offer.id),
    },
  };
}

export function refreshForgeOffers(
  weave: WeaveState,
  rngState: RngState,
  forgeState: ForgeState,
  count = 4,
): ForgeOfferResult | undefined {
  if (forgeState.refreshesRemaining <= 0) return undefined;
  return generateForgeOffers(
    weave,
    rngState,
    {
      ...forgeState,
      refreshesRemaining: forgeState.refreshesRemaining - 1,
    },
    count,
  );
}

export function applyForgeOffer(
  weave: WeaveState,
  offer: ForgeOffer,
): WeaveState {
  if (offer.kind === "insert") {
    const result = insertWeaponNode(weave, offer.weaponState);
    return result.ok ? result.state : weave;
  }
  if (offer.kind === "fusion") {
    const result = fuseAdjacentNodes(
      weave,
      offer.firstIndex,
      offer.secondIndex,
    );
    return result.ok && result.node.sourceId === offer.fusionId
      ? result.state
      : weave;
  }
  if (offer.kind === "swap") {
    return swapWeaveNodes(weave, offer.firstIndex, offer.secondIndex);
  }
  const node = weave.nodes[offer.nodeIndex];
  if (!node || node.kind !== "weapon" || node.instanceId !== offer.id.split(":")[1]) {
    return weave;
  }
  const nodes = [...weave.nodes];
  nodes[offer.nodeIndex] = {
    ...node,
    weaponState: offer.weaponState,
  };
  return { ...weave, nodes };
}
