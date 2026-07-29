import {
  ENDLESS_PERK_DEFINITIONS,
  getEndlessPerkDefinition,
  type EndlessPerkAction,
  type EndlessPerkDefinition,
  type EndlessPerkEvent,
  type EndlessPerkId,
  type WeaponId,
} from "../content";
import { nextRandom, type RngState } from "./rng";

export type EndlessPerkState = {
  ranks: Readonly<Partial<Record<EndlessPerkId, number>>>;
  refreshesRemaining: number;
  cycle: number;
  offeredIds: readonly EndlessPerkId[];
  counters: Readonly<Record<string, number>>;
  cooldowns: Readonly<Record<string, number>>;
};

export type EndlessPerkChoiceResult = {
  choices: readonly EndlessPerkDefinition[];
  state: EndlessPerkState;
  rngState: RngState;
};

export type EndlessPerkChoiceContext = {
  ownedWeaponIds?: readonly WeaponId[];
  weaveNodeCount?: number;
  weaveMaxNodes?: number;
};

export type EndlessPerkRuntimeEvent = {
  type: EndlessPerkEvent;
  weaponId?: WeaponId;
  targetId?: number | string;
  value?: number;
  season?: "spring" | "summer" | "autumn" | "winter";
  form?: "human" | "plane";
  ownedWeaponIds?: readonly WeaponId[];
};

export type EndlessPerkProc = {
  perkId: EndlessPerkId;
  perkName: string;
  actions: readonly EndlessPerkAction[];
  seasonalMultiplier: 1 | 2;
};

export type EndlessPerkEventResult = {
  state: EndlessPerkState;
  procs: readonly EndlessPerkProc[];
};

export function createEndlessPerkState(refreshes = 1): EndlessPerkState {
  return {
    ranks: {},
    refreshesRemaining: Math.max(0, Math.floor(refreshes)),
    cycle: 0,
    offeredIds: [],
    counters: {},
    cooldowns: {},
  };
}

export function stepEndlessPerkState(
  state: EndlessPerkState,
  deltaSeconds: number,
): EndlessPerkState {
  if (deltaSeconds <= 0) return state;
  const cooldowns: Record<string, number> = {};
  for (const [key, value] of Object.entries(state.cooldowns)) {
    const remaining = Math.max(0, value - deltaSeconds);
    if (remaining > 0) cooldowns[key] = remaining;
  }
  return { ...state, cooldowns };
}

function scopeSuffix(
  scope: "global" | "target" | "weapon" | undefined,
  event: EndlessPerkRuntimeEvent,
): string {
  if (scope === "target") return `target:${event.targetId ?? "none"}`;
  if (scope === "weapon") return `weapon:${event.weaponId ?? "none"}`;
  return "global";
}

export function consumeEndlessPerkEvent(
  state: EndlessPerkState,
  event: EndlessPerkRuntimeEvent,
): EndlessPerkEventResult {
  const counters = { ...state.counters };
  const cooldowns = { ...state.cooldowns };
  const procs: EndlessPerkProc[] = [];
  for (const definition of ENDLESS_PERK_DEFINITIONS) {
    if ((state.ranks[definition.id] ?? 0) <= 0) continue;
    definition.rules.forEach((rule, ruleIndex) => {
      const trigger = rule.trigger;
      if (trigger.event !== event.type) return;
      if (trigger.weaponId && trigger.weaponId !== event.weaponId) return;
      if (
        trigger.requiredWeaponId &&
        !event.ownedWeaponIds?.includes(trigger.requiredWeaponId)
      ) return;
      if (trigger.form && trigger.form !== event.form) return;
      if (
        trigger.minValue !== undefined &&
        (event.value ?? 0) < trigger.minValue
      ) return;
      if (
        trigger.maxValue !== undefined &&
        (event.value ?? 0) > trigger.maxValue
      ) return;
      if (
        trigger.afterSeconds !== undefined &&
        (event.value ?? 0) < trigger.afterSeconds
      ) return;

      const suffix = scopeSuffix(trigger.counterScope, event);
      const key = `${definition.id}:${ruleIndex}:${suffix}`;
      if ((cooldowns[key] ?? 0) > 0) return;

      const required = Math.max(1, trigger.every ?? 1);
      const count = (counters[key] ?? 0) + 1;
      if (count < required) {
        counters[key] = count;
        return;
      }
      counters[key] = count - required;
      if (trigger.cooldownSeconds) {
        cooldowns[key] = trigger.cooldownSeconds;
      }
      procs.push({
        perkId: definition.id,
        perkName: definition.name,
        actions: rule.actions,
        seasonalMultiplier:
          trigger.season !== undefined && trigger.season === event.season
            ? 2
            : 1,
      });
    });
  }
  return {
    state: { ...state, counters, cooldowns },
    procs,
  };
}

function weightedChoices(
  candidates: readonly EndlessPerkDefinition[],
  count: number,
  initialRng: RngState,
): { choices: EndlessPerkDefinition[]; rngState: RngState } {
  const pool = [...candidates];
  const choices: EndlessPerkDefinition[] = [];
  let rngState = initialRng;
  while (pool.length > 0 && choices.length < count) {
    const totalWeight = pool.reduce(
      (sum, definition) => sum + Math.max(0.01, definition.weight),
      0,
    );
    const rolled = nextRandom(rngState);
    rngState = rolled.state;
    let cursor = rolled.value * totalWeight;
    let selected = 0;
    for (let index = 0; index < pool.length; index += 1) {
      cursor -= Math.max(0.01, pool[index].weight);
      if (cursor <= 0) {
        selected = index;
        break;
      }
    }
    choices.push(pool[selected]);
    pool.splice(selected, 1);
  }
  return { choices, rngState };
}

export function generateEndlessPerkChoices(
  state: EndlessPerkState,
  rngState: RngState,
  count = 4,
  context?: EndlessPerkChoiceContext,
): EndlessPerkChoiceResult {
  const available = ENDLESS_PERK_DEFINITIONS.filter(
    (definition) => {
      if ((state.ranks[definition.id] ?? 0) >= definition.maxRank) return false;
      if (
        definition.id === "emptySlotCharge" &&
        context?.weaveNodeCount !== undefined &&
        context.weaveMaxNodes !== undefined &&
        context.weaveNodeCount >= context.weaveMaxNodes
      ) {
        return false;
      }
      if (
        definition.category === "weapon" &&
        context?.ownedWeaponIds !== undefined
      ) {
        const required = definition.rules.flatMap((rule) =>
          [rule.trigger.weaponId, rule.trigger.requiredWeaponId].filter(
            (id): id is WeaponId => id !== undefined,
          ),
        );
        return required.some((weaponId) =>
          context.ownedWeaponIds?.includes(weaponId),
        );
      }
      return true;
    },
  );
  const desiredCount = Math.max(1, Math.floor(count));
  const choices: EndlessPerkDefinition[] = [];
  let nextRng = rngState;
  const takeOne = (
    candidates: readonly EndlessPerkDefinition[],
  ) => {
    const remaining = candidates.filter(
      (definition) =>
        !choices.some((choice) => choice.id === definition.id),
    );
    if (remaining.length === 0) return;
    const fresh = remaining.filter(
      (definition) => !state.offeredIds.includes(definition.id),
    );
    const generated = weightedChoices(
      fresh.length > 0 ? fresh : remaining,
      1,
      nextRng,
    );
    nextRng = generated.rngState;
    if (generated.choices[0]) choices.push(generated.choices[0]);
  };

  // The row remains legible and useful: one held-weapon craft, one board
  // movement, one seasonal relation, then a free fourth card.
  for (const category of ["weapon", "weave", "season"] as const) {
    if (choices.length >= desiredCount) break;
    takeOne(
      available.filter((definition) => definition.category === category),
    );
  }
  while (choices.length < Math.min(desiredCount, available.length)) {
    const before = choices.length;
    takeOne(available);
    if (choices.length === before) break;
  }

  const offeredIds = choices.map((choice) => choice.id);
  return {
    choices,
    rngState: nextRng,
    state: {
      ...state,
      cycle: state.cycle + 1,
      offeredIds,
    },
  };
}

export function refreshEndlessPerkChoices(
  state: EndlessPerkState,
  rngState: RngState,
  count = 4,
  context?: EndlessPerkChoiceContext,
): EndlessPerkChoiceResult | undefined {
  if (state.refreshesRemaining <= 0) return undefined;
  return generateEndlessPerkChoices(
    {
      ...state,
      refreshesRemaining: state.refreshesRemaining - 1,
    },
    rngState,
    count,
    context,
  );
}

export function applyEndlessPerkChoice(
  state: EndlessPerkState,
  perkId: EndlessPerkId,
): EndlessPerkState {
  const definition = getEndlessPerkDefinition(perkId);
  const current = state.ranks[perkId] ?? 0;
  if (current >= definition.maxRank) return state;
  return {
    ...state,
    ranks: {
      ...state.ranks,
      [perkId]: current + 1,
    },
    offeredIds: [],
  };
}

export function grantEndlessPerkRefresh(
  state: EndlessPerkState,
  amount = 1,
): EndlessPerkState {
  return {
    ...state,
    refreshesRemaining:
      state.refreshesRemaining + Math.max(0, Math.floor(amount)),
  };
}
