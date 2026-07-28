import type { FusionId, WeaponId } from "../content/types";

export type AtlasSpec = {
  readonly id: string;
  readonly src: string;
  readonly columns: number;
  readonly rows: number;
  readonly inset?: number;
};

function atlas(
  id: string,
  src: string,
  columns: number,
  rows: number,
  inset = 1,
): AtlasSpec {
  return { id, src, columns, rows, inset };
}

export const HERO_ATLASES = {
  directions: atlas(
    "hero.directions",
    "/art-v3/hero-directions-v3.webp",
    3,
    3,
    4,
  ),
  fold: atlas("hero.fold", "/art-v3/hero-fold-v3.webp", 4, 3),
} as const;

export const WEAPON_ATLASES: Readonly<Record<WeaponId, AtlasSpec>> = {
  sword: atlas("weapon.sword", "/art-v3/weapon-sword-v3.webp", 3, 2),
  fan: atlas("weapon.fan", "/art-v3/weapon-fan-v3.webp", 3, 2),
  umbrella: atlas(
    "weapon.umbrella",
    "/art-v3/weapon-umbrella-v3.webp",
    3,
    2,
  ),
  scissors: atlas(
    "weapon.scissors",
    "/art-v3/weapon-scissors-v3.webp",
    3,
    2,
  ),
  abacus: atlas("weapon.abacus", "/art-v3/weapon-abacus-v3.webp", 3, 2),
  crossbow: atlas(
    "weapon.crossbow",
    "/art-v3/weapon-crossbow-v3.webp",
    3,
    2,
  ),
  pipa: atlas("weapon.pipa", "/art-v3/weapon-pipa-v3.webp", 3, 2),
  inkline: atlas(
    "weapon.inkline",
    "/art-v3/weapon-inkline-v3.webp",
    3,
    2,
  ),
  lantern: atlas(
    "weapon.lantern",
    "/art-v3/weapon-lantern-v3.webp",
    3,
    2,
  ),
  thunderSeal: atlas(
    "weapon.thunderSeal",
    "/art-v3/weapon-thunder-v3.webp",
    3,
    2,
  ),
};

export const FUSION_ATLASES: Readonly<Record<FusionId, AtlasSpec>> = {
  mistCanopy: atlas(
    "fusion.mistCanopy",
    "/art-v3/fusion-wind-rain-v3.webp",
    2,
    2,
  ),
  thunderCanopy: atlas(
    "fusion.thunderCanopy",
    "/art-v3/fusion-thunder-umbrella-v3.webp",
    2,
    2,
  ),
  inkGaleRule: atlas(
    "fusion.inkGaleRule",
    "/art-v3/fusion-fan-ink-v3.webp",
    2,
    2,
  ),
  starPiercer: atlas(
    "fusion.starPiercer",
    "/art-v3/fusion-sword-crossbow-v3.webp",
    2,
    2,
  ),
  lanternSword: atlas(
    "fusion.lanternSword",
    "/art-v3/fusion-sword-lantern-v3.webp",
    2,
    2,
  ),
  swordheartPipa: atlas(
    "fusion.swordheartPipa",
    "/art-v3/fusion-sword-pipa-v3.webp",
    2,
    2,
  ),
  heavenlyLedger: atlas(
    "fusion.heavenlyLedger",
    "/art-v3/fusion-scissors-abacus-v3.webp",
    2,
    2,
  ),
  worldTailor: atlas(
    "fusion.worldTailor",
    "/art-v3/fusion-scissors-ink-v3.webp",
    2,
    2,
  ),
  raincutCanopy: atlas(
    "fusion.raincutCanopy",
    "/art-v3/fusion-scissors-umbrella-v3.webp",
    2,
    2,
  ),
  jadePearlCadence: atlas(
    "fusion.jadePearlCadence",
    "/art-v3/fusion-abacus-pipa-v3.webp",
    2,
    2,
  ),
  linkedLedgerCase: atlas(
    "fusion.linkedLedgerCase",
    "/art-v3/fusion-abacus-crossbow-v3.webp",
    2,
    2,
  ),
  lanternBallista: atlas(
    "fusion.lanternBallista",
    "/art-v3/fusion-crossbow-lantern-v3.webp",
    2,
    2,
  ),
  inklineRepeater: atlas(
    "fusion.inklineRepeater",
    "/art-v3/fusion-crossbow-ink-v3.webp",
    2,
    2,
  ),
  thunderPipa: atlas(
    "fusion.thunderPipa",
    "/art-v3/fusion-pipa-thunder-v3.webp",
    2,
    2,
  ),
  myriadLanternCanopy: atlas(
    "fusion.myriadLanternCanopy",
    "/art-v3/fusion-umbrella-lantern-v3.webp",
    2,
    2,
  ),
};

export const EFFECT_ATLASES = {
  pickup: atlas(
    "pickup.paperlight",
    "/art-v3/pickup-paperlight-v3.webp",
    6,
    3,
  ),
  projectiles: atlas(
    "effect.projectiles",
    "/art-v3/effect-projectiles-v3.webp",
    5,
    2,
  ),
  impacts: atlas(
    "effect.impacts",
    "/art-v3/effect-impacts-v3.webp",
    4,
    3,
  ),
  supernatural: atlas(
    "effect.supernatural",
    "/art-v3/effect-supernatural-v3.webp",
    4,
    3,
  ),
} as const;

export const CORE_VISUAL_ASSETS: readonly AtlasSpec[] = [
  HERO_ATLASES.directions,
  HERO_ATLASES.fold,
  WEAPON_ATLASES.sword,
  ...Object.values(EFFECT_ATLASES),
];

export const STANDARD_DEFERRED_ASSETS: readonly AtlasSpec[] =
  Object.values(WEAPON_ATLASES).filter((spec) => spec.id !== WEAPON_ATLASES.sword.id);

export const OPTIONAL_VISUAL_ASSETS: readonly AtlasSpec[] = [
  ...STANDARD_DEFERRED_ASSETS,
  ...Object.values(FUSION_ATLASES),
];

export const ALL_VISUAL_ASSETS: readonly AtlasSpec[] = [
  ...CORE_VISUAL_ASSETS,
  ...OPTIONAL_VISUAL_ASSETS,
];
