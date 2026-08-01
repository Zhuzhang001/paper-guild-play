import type {
  AccumulatorEffect,
  BeamEffect,
  ChainEffect,
  CopyEffect,
  DelayedEffect,
  EffectTag,
  EffectTrigger,
  ExecuteEffect,
  LightningEffect,
  MarkEffect,
  OrbitEffect,
  ProjectileEffect,
  SummonEffect,
  ZoneEffect,
} from "./types";

type CommonOverrides = {
  trigger?: EffectTrigger;
  visualKey?: string;
  audioKey?: string;
  chance?: number;
  internalCooldown?: number;
};

export function projectile(
  id: string,
  tags: readonly EffectTag[],
  damage: number,
  cooldown: number,
  overrides: Partial<Omit<ProjectileEffect, "id" | "kind" | "tags" | "damage" | "cooldown" | "trigger">> &
    CommonOverrides = {},
): ProjectileEffect {
  return {
    id,
    kind: "projectile",
    trigger: overrides.trigger ?? "onAttack",
    tags,
    damage,
    cooldown,
    pattern: overrides.pattern ?? "single",
    count: overrides.count ?? 1,
    speed: overrides.speed ?? 620,
    lifetime: overrides.lifetime ?? 1.4,
    radius: overrides.radius ?? 9,
    pierce: overrides.pierce ?? 0,
    ...overrides,
  };
}

export function orbit(
  id: string,
  tags: readonly EffectTag[],
  damage: number,
  overrides: Partial<Omit<OrbitEffect, "id" | "kind" | "tags" | "damage" | "trigger">> &
    CommonOverrides = {},
): OrbitEffect {
  return {
    id,
    kind: "orbit",
    trigger: overrides.trigger ?? "periodic",
    tags,
    damage,
    count: overrides.count ?? 1,
    radius: overrides.radius ?? 94,
    angularSpeed: overrides.angularSpeed ?? 2.2,
    hitCooldown: overrides.hitCooldown ?? 0.35,
    ...overrides,
  };
}

export function chain(
  id: string,
  tags: readonly EffectTag[],
  damage: number,
  overrides: Partial<Omit<ChainEffect, "id" | "kind" | "tags" | "damage" | "trigger">> &
    CommonOverrides = {},
): ChainEffect {
  return {
    id,
    kind: "chain",
    trigger: overrides.trigger ?? "onHit",
    tags,
    damage,
    jumps: overrides.jumps ?? 3,
    range: overrides.range ?? 180,
    falloff: overrides.falloff ?? 0.82,
    ...overrides,
  };
}

export function zone(
  id: string,
  tags: readonly EffectTag[],
  damagePerSecond: number,
  overrides: Partial<Omit<ZoneEffect, "id" | "kind" | "tags" | "damagePerSecond" | "trigger">> &
    CommonOverrides = {},
): ZoneEffect {
  return {
    id,
    kind: "zone",
    trigger: overrides.trigger ?? "periodic",
    tags,
    damagePerSecond,
    radius: overrides.radius ?? 110,
    duration: overrides.duration ?? 3,
    tickRate: overrides.tickRate ?? 0.25,
    ...overrides,
  };
}

export function summon(
  id: string,
  tags: readonly EffectTag[],
  summonKey: string,
  overrides: Partial<Omit<SummonEffect, "id" | "kind" | "tags" | "summonKey" | "trigger">> &
    CommonOverrides = {},
): SummonEffect {
  return {
    id,
    kind: "summon",
    trigger: overrides.trigger ?? "periodic",
    tags,
    summonKey,
    count: overrides.count ?? 1,
    duration: overrides.duration ?? 8,
    attackDamage: overrides.attackDamage ?? 14,
    attackCooldown: overrides.attackCooldown ?? 0.8,
    moveSpeed: overrides.moveSpeed ?? 180,
    ...overrides,
  };
}

export function delayed(
  id: string,
  tags: readonly EffectTag[],
  damage: number,
  overrides: Partial<Omit<DelayedEffect, "id" | "kind" | "tags" | "damage" | "trigger">> &
    CommonOverrides = {},
): DelayedEffect {
  return {
    id,
    kind: "delayed",
    trigger: overrides.trigger ?? "onHit",
    tags,
    damage,
    delay: overrides.delay ?? 0.65,
    radius: overrides.radius ?? 72,
    ...overrides,
  };
}

export function mark(
  id: string,
  tags: readonly EffectTag[],
  overrides: Partial<Omit<MarkEffect, "id" | "kind" | "tags" | "trigger">> & CommonOverrides = {},
): MarkEffect {
  return {
    id,
    kind: "mark",
    trigger: overrides.trigger ?? "onHit",
    tags,
    duration: overrides.duration ?? 3,
    damageTakenMultiplier: overrides.damageTakenMultiplier ?? 1.18,
    priority: overrides.priority ?? "highestHp",
    ...overrides,
  };
}

export function execute(
  id: string,
  tags: readonly EffectTag[],
  overrides: Partial<Omit<ExecuteEffect, "id" | "kind" | "tags" | "trigger">> & CommonOverrides = {},
): ExecuteEffect {
  return {
    id,
    kind: "execute",
    trigger: overrides.trigger ?? "onHit",
    tags,
    threshold: overrides.threshold ?? 0.18,
    bossThreshold: overrides.bossThreshold ?? 0.04,
    bonusDamage: overrides.bonusDamage ?? 20,
    ...overrides,
  };
}

export function accumulator(
  id: string,
  tags: readonly EffectTag[],
  counter: string,
  required: number,
  procEffects: AccumulatorEffect["procEffects"],
  overrides: Partial<Omit<AccumulatorEffect, "id" | "kind" | "tags" | "counter" | "required" | "procEffects" | "trigger">> &
    CommonOverrides = {},
): AccumulatorEffect {
  return {
    id,
    kind: "accumulator",
    trigger: overrides.trigger ?? "onHit",
    tags,
    counter,
    required,
    resetOnProc: overrides.resetOnProc ?? true,
    procEffects,
    ...overrides,
  };
}

export function copy(
  id: string,
  tags: readonly EffectTag[],
  overrides: Partial<Omit<CopyEffect, "id" | "kind" | "tags" | "trigger">> & CommonOverrides = {},
): CopyEffect {
  return {
    id,
    kind: "copy",
    trigger: overrides.trigger ?? "onAttack",
    tags,
    source: overrides.source ?? "primaryWeapon",
    damageMultiplier: overrides.damageMultiplier ?? 0.45,
    maxCopies: overrides.maxCopies ?? 1,
    ...overrides,
  };
}

export function beam(
  id: string,
  tags: readonly EffectTag[],
  damage: number,
  overrides: Partial<Omit<BeamEffect, "id" | "kind" | "tags" | "damage" | "trigger">> &
    CommonOverrides = {},
): BeamEffect {
  return {
    id,
    kind: "beam",
    trigger: overrides.trigger ?? "onAttack",
    tags,
    damage,
    length: overrides.length ?? 460,
    width: overrides.width ?? 28,
    duration: overrides.duration ?? 0.18,
    pierce: overrides.pierce ?? 99,
    ...overrides,
  };
}

export function lightning(
  id: string,
  tags: readonly EffectTag[],
  damage: number,
  overrides: Partial<Omit<LightningEffect, "id" | "kind" | "tags" | "damage" | "trigger">> &
    CommonOverrides = {},
): LightningEffect {
  return {
    id,
    kind: "lightning",
    trigger: overrides.trigger ?? "periodic",
    tags,
    damage,
    strikes: overrides.strikes ?? 1,
    radius: overrides.radius ?? 52,
    delay: overrides.delay ?? 0.35,
    ...overrides,
  };
}
