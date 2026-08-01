import type { EnemyArchetype } from "../art";

export type EndlessBossId =
  | "troupeMaster"
  | "chiefClerk"
  | "nightWatch"
  | "kilnForeman"
  | "siegeTower"
  | "bannerCaptain";

export type BossTraitId =
  | "quickRecovery"
  | "reinforcements"
  | "lingeringGround"
  | "delayedRepeat";

export type BossSkillMode = "dash" | "radial" | "volley" | "summon";

export type BossBehaviorId =
  | "maskCrossing"
  | "fanCurtain"
  | "shadowCast"
  | "inkGrid"
  | "fallingSeal"
  | "orderedClosure"
  | "bellRings"
  | "lanternPatrol"
  | "thirdWatchCone"
  | "rollingClay"
  | "kilnFireLanes"
  | "furnaceBlast"
  | "turretVolley"
  | "edgeDeployment"
  | "sweepingArm"
  | "spearPass"
  | "plantFlags"
  | "commandFormation";

export type BossSkillDefinition = {
  id: string;
  mode: BossSkillMode;
  behavior: BossBehaviorId;
  triggerRange: number;
  cooldown: number;
  telegraph: number;
  active: number;
  recovery: number;
  radius: number;
  travelDistance?: number;
  count?: number;
  delay?: number;
  artKey: `boss/${string}`;
};

export type EndlessBossDefinition = {
  id: EndlessBossId;
  name:
    | "百面班主"
    | "墨册主簿"
    | "铜甲更夫"
    | "窑火监工"
    | "机关楼车"
    | "赤旗校尉";
  fallbackArchetype: EnemyArchetype;
  artKey: `boss/endless/${string}`;
  hpFactor: number;
  radius: number;
  speed: number;
  turnSpeed: number;
  weight: number;
  halfHealth: {
    cooldownScale: number;
    telegraphScale: number;
    patternBonus: number;
  };
  skills: readonly [BossSkillDefinition, BossSkillDefinition, BossSkillDefinition];
};

export const BOSS_TRAIT_IDS = [
  "quickRecovery",
  "reinforcements",
  "lingeringGround",
  "delayedRepeat",
] as const satisfies readonly BossTraitId[];

export const ENDLESS_BOSS_IDS = [
  "troupeMaster",
  "chiefClerk",
  "nightWatch",
  "kilnForeman",
  "siegeTower",
  "bannerCaptain",
] as const satisfies readonly EndlessBossId[];

const skill = (
  id: string,
  mode: BossSkillMode,
  behavior: BossBehaviorId,
  overrides: Omit<
    BossSkillDefinition,
    "id" | "mode" | "behavior" | "artKey"
  >,
): BossSkillDefinition => ({
  id,
  mode,
  behavior,
  artKey: `boss/${id}`,
  ...overrides,
});

export const ENDLESS_BOSSES: Readonly<
  Record<EndlessBossId, EndlessBossDefinition>
> = Object.freeze({
  troupeMaster: {
    id: "troupeMaster",
    name: "百面班主",
    fallbackArchetype: "puppet",
    artKey: "boss/endless/troupe-master",
    hpFactor: 46,
    radius: 62,
    speed: 54,
    turnSpeed: 4.1,
    weight: 1,
    halfHealth: { cooldownScale: 0.84, telegraphScale: 0.88, patternBonus: 1 },
    skills: [
      skill("troupe-master-crossing", "dash", "maskCrossing", {
        triggerRange: 620, cooldown: 4.2, telegraph: 0.58, active: 0.5, recovery: 0.54, radius: 96, travelDistance: 420,
      }),
      skill("troupe-master-curtain", "volley", "fanCurtain", {
        triggerRange: 700, cooldown: 4.6, telegraph: 0.64, active: 0.16, recovery: 0.62, radius: 74, count: 7, delay: 0.2,
      }),
      skill("troupe-master-cast", "summon", "shadowCast", {
        triggerRange: 720, cooldown: 5.1, telegraph: 0.72, active: 0.18, recovery: 0.7, radius: 108, count: 3,
      }),
    ],
  },
  chiefClerk: {
    id: "chiefClerk",
    name: "墨册主簿",
    fallbackArchetype: "abacus",
    artKey: "boss/endless/chief-clerk",
    hpFactor: 42,
    radius: 58,
    speed: 46,
    turnSpeed: 4.8,
    weight: 1,
    halfHealth: { cooldownScale: 0.82, telegraphScale: 0.86, patternBonus: 1 },
    skills: [
      skill("chief-clerk-ledger", "volley", "inkGrid", {
        triggerRange: 760, cooldown: 4.1, telegraph: 0.6, active: 0.14, recovery: 0.54, radius: 66, count: 9, delay: 0.18,
      }),
      skill("chief-clerk-seal", "radial", "fallingSeal", {
        triggerRange: 520, cooldown: 4.4, telegraph: 0.68, active: 0.12, recovery: 0.62, radius: 250,
      }),
      skill("chief-clerk-runners", "summon", "orderedClosure", {
        triggerRange: 720, cooldown: 5.4, telegraph: 0.74, active: 0.16, recovery: 0.72, radius: 92, count: 4,
      }),
    ],
  },
  nightWatch: {
    id: "nightWatch",
    name: "铜甲更夫",
    fallbackArchetype: "lantern",
    artKey: "boss/endless/night-watch",
    hpFactor: 52,
    radius: 66,
    speed: 50,
    turnSpeed: 3.8,
    weight: 1,
    halfHealth: { cooldownScale: 0.84, telegraphScale: 0.84, patternBonus: 1 },
    skills: [
      skill("night-watch-bell", "radial", "bellRings", {
        triggerRange: 560, cooldown: 4, telegraph: 0.66, active: 0.12, recovery: 0.58, radius: 285,
      }),
      skill("night-watch-patrol", "dash", "lanternPatrol", {
        triggerRange: 650, cooldown: 4.5, telegraph: 0.5, active: 0.58, recovery: 0.5, radius: 104, travelDistance: 380,
      }),
      skill("night-watch-third-call", "volley", "thirdWatchCone", {
        triggerRange: 740, cooldown: 4.9, telegraph: 0.76, active: 0.18, recovery: 0.68, radius: 84, count: 3, delay: 0.48,
      }),
    ],
  },
  kilnForeman: {
    id: "kilnForeman",
    name: "窑火监工",
    fallbackArchetype: "cup",
    artKey: "boss/endless/kiln-foreman",
    hpFactor: 56,
    radius: 70,
    speed: 45,
    turnSpeed: 3.4,
    weight: 1,
    halfHealth: { cooldownScale: 0.83, telegraphScale: 0.86, patternBonus: 2 },
    skills: [
      skill("kiln-foreman-coals", "volley", "rollingClay", {
        triggerRange: 720, cooldown: 4.2, telegraph: 0.62, active: 0.16, recovery: 0.58, radius: 92, count: 6, delay: 0.24,
      }),
      skill("kiln-foreman-heat", "radial", "kilnFireLanes", {
        triggerRange: 500, cooldown: 4.6, telegraph: 0.72, active: 0.14, recovery: 0.68, radius: 275,
      }),
      skill("kiln-foreman-hammer", "dash", "furnaceBlast", {
        triggerRange: 610, cooldown: 4.8, telegraph: 0.64, active: 0.42, recovery: 0.7, radius: 118, travelDistance: 320,
      }),
    ],
  },
  siegeTower: {
    id: "siegeTower",
    name: "机关楼车",
    fallbackArchetype: "rib",
    artKey: "boss/endless/siege-tower",
    hpFactor: 64,
    radius: 76,
    speed: 34,
    turnSpeed: 2.8,
    weight: 1,
    halfHealth: { cooldownScale: 0.8, telegraphScale: 0.9, patternBonus: 2 },
    skills: [
      skill("siege-tower-bolts", "volley", "turretVolley", {
        triggerRange: 820, cooldown: 3.9, telegraph: 0.56, active: 0.14, recovery: 0.5, radius: 62, count: 11, delay: 0.14,
      }),
      skill("siege-tower-crew", "summon", "edgeDeployment", {
        triggerRange: 740, cooldown: 5.2, telegraph: 0.76, active: 0.16, recovery: 0.7, radius: 100, count: 4,
      }),
      skill("siege-tower-ram", "dash", "sweepingArm", {
        triggerRange: 580, cooldown: 5, telegraph: 0.72, active: 0.62, recovery: 0.78, radius: 132, travelDistance: 285,
      }),
    ],
  },
  bannerCaptain: {
    id: "bannerCaptain",
    name: "赤旗校尉",
    fallbackArchetype: "puppet",
    artKey: "boss/endless/banner-captain",
    hpFactor: 48,
    radius: 64,
    speed: 62,
    turnSpeed: 5.2,
    weight: 1,
    halfHealth: { cooldownScale: 0.8, telegraphScale: 0.84, patternBonus: 2 },
    skills: [
      skill("banner-captain-spear", "dash", "spearPass", {
        triggerRange: 700, cooldown: 3.8, telegraph: 0.48, active: 0.46, recovery: 0.46, radius: 96, travelDistance: 440,
      }),
      skill("banner-captain-rally", "summon", "plantFlags", {
        triggerRange: 760, cooldown: 5, telegraph: 0.68, active: 0.14, recovery: 0.62, radius: 90, count: 5,
      }),
      skill("banner-captain-arrows", "volley", "commandFormation", {
        triggerRange: 800, cooldown: 4.4, telegraph: 0.7, active: 0.16, recovery: 0.58, radius: 70, count: 9, delay: 0.17,
      }),
    ],
  },
});

export function getEndlessBoss(
  id: EndlessBossId,
): EndlessBossDefinition {
  return ENDLESS_BOSSES[id];
}
