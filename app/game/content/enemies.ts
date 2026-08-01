import type { EnemyArchetype } from "../art";
import type { MovementTargetSpec } from "./movement";

export type EnemyRank = "common" | "elite";

export type EnemySkillMode = "hop" | "dash" | "pounce" | "burst" | "volley";

/**
 * `mode` remains the broad animation family. `behavior` is the gameplay
 * contract: two enemies may both dash without sharing targeting, follow-up or
 * recovery rules.
 */
export type EnemyBehaviorId =
  | "cupLandingRipple"
  | "pairedShoeCross"
  | "lanternSlowFire"
  | "fishFlyby"
  | "abacusThreeFive"
  | "umbrellaGuard"
  | "lionChargeRoar"
  | "puppetTripwire";

export type EnemySkillDefinition = {
  id: string;
  mode: EnemySkillMode;
  behavior: EnemyBehaviorId;
  triggerRange: number;
  cooldown: number;
  telegraph: number;
  active: number;
  recovery: number;
  movement?: MovementTargetSpec;
  radius: number;
  strikeCount?: number;
  strikeDelay?: number;
  artKey: `enemy/${string}`;
};

export type EnemyDefinition = {
  id: EnemyArchetype;
  rank: EnemyRank;
  threatCost: 1 | 4;
  skill: EnemySkillDefinition;
};

export const COMMON_ENEMY_IDS = [
  "cup",
  "shoe",
  "lantern",
  "fish",
  "abacus",
  "rib",
] as const satisfies readonly EnemyArchetype[];

export const ELITE_ENEMY_IDS = [
  "lion",
  "puppet",
] as const satisfies readonly EnemyArchetype[];

export const ENEMY_DEFINITIONS: Readonly<
  Partial<Record<EnemyArchetype, EnemyDefinition>>
> = Object.freeze({
  cup: {
    id: "cup",
    rank: "common",
    threatCost: 1,
    skill: {
      id: "cup-hop",
      mode: "hop",
      behavior: "cupLandingRipple",
      triggerRange: 250,
      cooldown: 2.5,
      telegraph: 0.24,
      active: 0.34,
      recovery: 0.28,
      movement: {
        kind: "landShort",
        maxTravel: 110,
        minTravel: 64,
        clearance: 8,
        closeFallback: { kind: "stomp" },
      },
      radius: 64,
      artKey: "enemy/cup/hop",
    },
  },
  shoe: {
    id: "shoe",
    rank: "common",
    threatCost: 1,
    skill: {
      id: "shoe-dash",
      mode: "dash",
      behavior: "pairedShoeCross",
      triggerRange: 270,
      cooldown: 2.15,
      telegraph: 0.3,
      active: 0.32,
      recovery: 0.3,
      movement: {
        kind: "crossTarget",
        maxTravel: 360,
        overshoot: 88,
        clearance: 8,
        sweptDamage: true,
      },
      radius: 48,
      artKey: "enemy/shoe/dash",
    },
  },
  lantern: {
    id: "lantern",
    rank: "common",
    threatCost: 1,
    skill: {
      id: "lantern-burst",
      mode: "burst",
      behavior: "lanternSlowFire",
      triggerRange: 470,
      cooldown: 3.1,
      telegraph: 0.46,
      active: 0.12,
      recovery: 0.42,
      radius: 76,
      strikeCount: 3,
      strikeDelay: 0.36,
      artKey: "enemy/lantern/burst",
    },
  },
  fish: {
    id: "fish",
    rank: "common",
    threatCost: 1,
    skill: {
      id: "fish-arc",
      mode: "dash",
      behavior: "fishFlyby",
      triggerRange: 300,
      cooldown: 2.4,
      telegraph: 0.2,
      active: 0.42,
      recovery: 0.22,
      movement: {
        kind: "flyby",
        exitMargin: 64,
        arcHeight: 44,
        sweptDamage: true,
      },
      radius: 45,
      artKey: "enemy/fish/arc",
    },
  },
  abacus: {
    id: "abacus",
    rank: "common",
    threatCost: 1,
    skill: {
      id: "abacus-broadside",
      mode: "volley",
      behavior: "abacusThreeFive",
      triggerRange: 500,
      cooldown: 3.5,
      telegraph: 0.52,
      active: 0.16,
      recovery: 0.5,
      radius: 58,
      strikeCount: 5,
      strikeDelay: 0.24,
      artKey: "enemy/abacus/broadside",
    },
  },
  rib: {
    id: "rib",
    rank: "common",
    threatCost: 1,
    skill: {
      id: "rib-pounce",
      mode: "pounce",
      behavior: "umbrellaGuard",
      triggerRange: 285,
      cooldown: 2.8,
      telegraph: 0.38,
      active: 0.38,
      recovery: 0.34,
      movement: {
        kind: "landShort",
        maxTravel: 145,
        minTravel: 64,
        clearance: 8,
        closeFallback: { kind: "sideHop", distance: 64 },
      },
      radius: 74,
      artKey: "enemy/rib/pounce",
    },
  },
  lion: {
    id: "lion",
    rank: "elite",
    threatCost: 4,
    skill: {
      id: "lion-charge",
      mode: "dash",
      behavior: "lionChargeRoar",
      triggerRange: 520,
      cooldown: 3.25,
      telegraph: 0.58,
      active: 0.46,
      recovery: 0.58,
      movement: {
        kind: "crossTarget",
        maxTravel: 390,
        overshoot: 78,
        clearance: 8,
        sweptDamage: true,
      },
      radius: 96,
      artKey: "enemy/lion/charge",
    },
  },
  puppet: {
    id: "puppet",
    rank: "elite",
    threatCost: 4,
    skill: {
      id: "puppet-volley",
      mode: "volley",
      behavior: "puppetTripwire",
      triggerRange: 560,
      cooldown: 3.7,
      telegraph: 0.66,
      active: 1.2,
      recovery: 0.62,
      radius: 68,
      strikeCount: 7,
      strikeDelay: 0.22,
      artKey: "enemy/puppet/volley",
    },
  },
});

export function getEnemyDefinition(
  id: EnemyArchetype,
): EnemyDefinition | undefined {
  return ENEMY_DEFINITIONS[id];
}
