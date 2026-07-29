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
  // v4 contract: 12 fold phases across five authored directions
  // (south, south-east, east, north-east, north).
  fold: atlas(
    "hero.fold",
    "/art-v4/hero-fold-runtime-v4.webp",
    12,
    5,
    0,
  ),
} as const;

const weaponAtlas = (id: string, src: string) =>
  atlas(id, src, 7, 2, 2);

export const WEAPON_ATLASES: Readonly<Record<WeaponId, AtlasSpec>> = {
  sword: weaponAtlas("weapon.sword", "/art-v4/weapon-sword-runtime-v4.webp"),
  fan: weaponAtlas("weapon.fan", "/art-v4/weapon-fan-runtime-v4.webp"),
  umbrella: weaponAtlas(
    "weapon.umbrella",
    "/art-v4/weapon-umbrella-runtime-v4.webp",
  ),
  scissors: weaponAtlas(
    "weapon.scissors",
    "/art-v4/weapon-scissors-runtime-v4.webp",
  ),
  abacus: weaponAtlas("weapon.abacus", "/art-v4/weapon-abacus-runtime-v4.webp"),
  crossbow: weaponAtlas(
    "weapon.crossbow",
    "/art-v4/weapon-crossbow-runtime-v4.webp",
  ),
  pipa: weaponAtlas("weapon.pipa", "/art-v4/weapon-pipa-runtime-v4.webp"),
  inkline: weaponAtlas(
    "weapon.inkline",
    "/art-v4/weapon-inkline-runtime-v4.webp",
  ),
  lantern: weaponAtlas(
    "weapon.lantern",
    "/art-v4/weapon-lantern-runtime-v4.webp",
  ),
  thunderSeal: weaponAtlas(
    "weapon.thunderSeal",
    "/art-v4/weapon-thunder-runtime-v4.webp",
  ),
};

export type FoldAtlasManifest = typeof HERO_ATLASES;
export type WeaponVisualManifest = typeof WEAPON_ATLASES;

const BASE_FUSION_ATLASES = {
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
} as const;

export const FUSION_ATLASES: Readonly<Record<FusionId, AtlasSpec>> = {
  ...BASE_FUSION_ATLASES,
  galeBamboo: atlas(
    "fusion.galeBamboo",
    "/art-v4/fusion-galeBamboo-runtime-v4.webp",
    2,
    2,
  ),
  hiddenSwordCanopy: atlas(
    "fusion.hiddenSwordCanopy",
    "/art-v4/fusion-hiddenSwordCanopy-runtime-v4.webp",
    2,
    2,
  ),
  twinTailorBlades: atlas(
    "fusion.twinTailorBlades",
    "/art-v4/fusion-twinTailorBlades-runtime-v4.webp",
    2,
    2,
  ),
  inkRuleSword: atlas(
    "fusion.inkRuleSword",
    "/art-v4/fusion-inkRuleSword-runtime-v4.webp",
    2,
    2,
  ),
  windRepeater: atlas(
    "fusion.windRepeater",
    "/art-v4/fusion-windRepeater-runtime-v4.webp",
    2,
    2,
  ),
  windStringPass: atlas(
    "fusion.windStringPass",
    "/art-v4/fusion-windStringPass-runtime-v4.webp",
    2,
    2,
  ),
  inkRainBoundary: atlas(
    "fusion.inkRainBoundary",
    "/art-v4/fusion-inkRainBoundary-runtime-v4.webp",
    2,
    2,
  ),
  rainStringCanopy: atlas(
    "fusion.rainStringCanopy",
    "/art-v4/fusion-rainStringCanopy-runtime-v4.webp",
    2,
    2,
  ),
  stringScissor: atlas(
    "fusion.stringScissor",
    "/art-v4/fusion-stringScissor-runtime-v4.webp",
    2,
    2,
  ),
  shadowScissor: atlas(
    "fusion.shadowScissor",
    "/art-v4/fusion-shadowScissor-runtime-v4.webp",
    2,
    2,
  ),
  pearlInkLine: atlas(
    "fusion.pearlInkLine",
    "/art-v4/fusion-pearlInkLine-runtime-v4.webp",
    2,
    2,
  ),
  countedLantern: atlas(
    "fusion.countedLantern",
    "/art-v4/fusion-countedLantern-runtime-v4.webp",
    2,
    2,
  ),
  pearlThunder: atlas(
    "fusion.pearlThunder",
    "/art-v4/fusion-pearlThunder-runtime-v4.webp",
    2,
    2,
  ),
  thunderBoltRoad: atlas(
    "fusion.thunderBoltRoad",
    "/art-v4/fusion-thunderBoltRoad-runtime-v4.webp",
    2,
    2,
  ),
  inkScore: atlas(
    "fusion.inkScore",
    "/art-v4/fusion-inkScore-runtime-v4.webp",
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
