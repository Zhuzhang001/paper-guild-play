import { CELESTIAL_INTRUSIONS } from "./celestials";
import { ENDLESS_PERK_DEFINITIONS } from "./endlessPerks";
import { FUSION_DEFINITIONS } from "./fusions";
import { SYNERGY_DEFINITIONS } from "./synergies";
import type { WeaponId } from "./types";
import { WEAPON_DEFINITIONS } from "./weapons";

const LOCKED_FUSION_RECIPES: readonly (
  readonly [WeaponId, WeaponId, string]
)[] = [
  ["fan", "umbrella", "风过伞骨"],
  ["umbrella", "thunderSeal", "伞骨接雷"],
  ["fan", "inkline", "风走墨格"],
  ["sword", "crossbow", "剑标引箭"],
  ["sword", "lantern", "灯照剑路"],
  ["sword", "pipa", "先弦后剑"],
  ["scissors", "abacus", "量准再剪"],
  ["scissors", "inkline", "墨框合剪"],
  ["scissors", "umbrella", "伞挡剪雨"],
  ["abacus", "pipa", "珠落成拍"],
  ["abacus", "crossbow", "数珠装弩"],
  ["crossbow", "lantern", "灯转弩台"],
  ["crossbow", "inkline", "线头架弩"],
  ["pipa", "thunderSeal", "弦尾落雷"],
  ["umbrella", "lantern", "合伞藏灯"],
  ["sword", "fan", "风送回剑"],
  ["sword", "umbrella", "开伞收剑"],
  ["sword", "scissors", "双刃合口"],
  ["sword", "inkline", "剑拖墨线"],
  ["fan", "crossbow", "顺风排弩"],
  ["fan", "pipa", "扇过三弦"],
  ["umbrella", "inkline", "墨雨封边"],
  ["umbrella", "pipa", "雨敲伞骨"],
  ["scissors", "pipa", "弦过剪口"],
  ["scissors", "lantern", "剪影伤身"],
  ["abacus", "inkline", "珠走墨线"],
  ["abacus", "lantern", "数满一灯"],
  ["abacus", "thunderSeal", "数珠落雷"],
  ["crossbow", "thunderSeal", "雷钉接路"],
  ["pipa", "inkline", "墨线记谱"],
  ["sword", "abacus", "数珠定剑"],
  ["sword", "thunderSeal", "剑印落雷"],
  ["fan", "scissors", "风送双剪"],
  ["fan", "abacus", "风拨算珠"],
  ["fan", "lantern", "风转灯影"],
  ["fan", "thunderSeal", "风停落雷"],
  ["umbrella", "abacus", "珠敲伞骨"],
  ["umbrella", "crossbow", "伞开排弩"],
  ["scissors", "crossbow", "弩钉引剪"],
  ["scissors", "thunderSeal", "雷过剪口"],
  ["crossbow", "pipa", "弦引弩箭"],
  ["pipa", "lantern", "灯影和弦"],
  ["inkline", "lantern", "墨线牵影"],
  ["inkline", "thunderSeal", "雷走墨线"],
  ["lantern", "thunderSeal", "灯亮雷落"],
];

function fusionPairKey(first: WeaponId, second: WeaponId): string {
  return [first, second].sort().join("+");
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates];
}

export function validateCombatContent(): readonly string[] {
  const errors: string[] = [];
  if (WEAPON_DEFINITIONS.length !== 10) {
    errors.push(`Expected 10 weapons, found ${WEAPON_DEFINITIONS.length}`);
  }
  if (SYNERGY_DEFINITIONS.length !== 12) {
    errors.push(`Expected 12 synergies, found ${SYNERGY_DEFINITIONS.length}`);
  }
  const expectedFusionCount =
    (WEAPON_DEFINITIONS.length * (WEAPON_DEFINITIONS.length - 1)) / 2;
  if (FUSION_DEFINITIONS.length !== expectedFusionCount) {
    errors.push(
      `Expected ${expectedFusionCount} fusions, found ${FUSION_DEFINITIONS.length}`,
    );
  }
  if (CELESTIAL_INTRUSIONS.length !== 6) {
    errors.push(`Expected 6 celestial intrusions, found ${CELESTIAL_INTRUSIONS.length}`);
  }
  if (ENDLESS_PERK_DEFINITIONS.length !== 32) {
    errors.push(`Expected 32 endless perks, found ${ENDLESS_PERK_DEFINITIONS.length}`);
  }
  const expectedPerkCategories = {
    weapon: 10,
    weave: 8,
    season: 8,
    journey: 6,
  } as const;
  for (const [category, expected] of Object.entries(expectedPerkCategories)) {
    const found = ENDLESS_PERK_DEFINITIONS.filter(
      (definition) => definition.category === category,
    ).length;
    if (found !== expected) {
      errors.push(
        `Expected ${expected} ${category} endless perks, found ${found}`,
      );
    }
  }
  for (const perk of ENDLESS_PERK_DEFINITIONS) {
    if (perk.rules.length === 0 || perk.rules.some((rule) => rule.actions.length === 0)) {
      errors.push(`Endless perk ${perk.id} has no consumable event rule`);
    }
  }

  const weaponIds = new Set<WeaponId>(
    WEAPON_DEFINITIONS.map((definition) => definition.id),
  );
  for (const duplicate of duplicateValues(
    WEAPON_DEFINITIONS.map((definition) => definition.id),
  )) {
    errors.push(`Duplicate weapon id: ${duplicate}`);
  }

  for (const weapon of WEAPON_DEFINITIONS) {
    if (weapon.routes.length !== 3) {
      errors.push(`Weapon ${weapon.id} must have exactly three routes`);
    }
    for (const route of weapon.routes) {
      if (route.masteries.length !== 2) {
        errors.push(`Route ${route.id} must have exactly two masteries`);
      }
      if (!route.id.startsWith(`${weapon.id}:`)) {
        errors.push(`Route ${route.id} is assigned to the wrong weapon`);
      }
      for (const mastery of route.masteries) {
        if (!mastery.id.startsWith(`${route.id}:`)) {
          errors.push(`Mastery ${mastery.id} is assigned to the wrong route`);
        }
      }
    }
  }

  for (const synergy of SYNERGY_DEFINITIONS) {
    if (synergy.weapons[0] === synergy.weapons[1]) {
      errors.push(`Synergy ${synergy.id} must use two distinct weapons`);
    }
    if (synergy.eventRules.length === 0) {
      errors.push(`Synergy ${synergy.id} must listen to at least one combat event`);
    }
    for (const weaponId of synergy.weapons) {
      if (!weaponIds.has(weaponId)) {
        errors.push(`Synergy ${synergy.id} references unknown weapon ${weaponId}`);
      }
    }
  }

  const fusionPairs = new Set<string>();
  const terminalFamilies = new Set([
    "returningVolley",
    "sweepingLine",
    "echoChain",
    "thunderField",
    "closingField",
    "shadowParade",
    "guardRelease",
    "markedFinish",
  ]);
  for (const fusion of FUSION_DEFINITIONS) {
    const pair = [...fusion.weapons].sort().join("+");
    if (fusionPairs.has(pair)) {
      errors.push(`Duplicate fusion pair: ${pair}`);
    }
    fusionPairs.add(pair);
    if (
      !fusion.effects.some(
        (effect) =>
          effect.trigger === "onAttack" || effect.trigger === "periodic",
      )
    ) {
      errors.push(`Fusion ${fusion.id} has no automatic attack root`);
    }
    if (
      !fusion.pairLabel.includes(" × ") ||
      fusion.action.length === 0 ||
      fusion.name !== fusion.action ||
      fusion.mechanic.action !== fusion.action ||
      fusion.canonicalName !== `${fusion.pairLabel}｜${fusion.action}`
    ) {
      errors.push(`Fusion ${fusion.id} is missing its canonical pair/action`);
    }
    if (!terminalFamilies.has(fusion.terminalFamily)) {
      errors.push(`Fusion ${fusion.id} has an unknown terminal family`);
    }
    const patchValues = Object.entries(fusion.weavePatch)
      .filter(([key]) => key !== "delivery")
      .map(([, value]) => value);
    if (
      !fusion.weavePatch.delivery ||
      patchValues.some(
        (value) => typeof value !== "number" || !Number.isFinite(value),
      )
    ) {
      errors.push(`Fusion ${fusion.id} has an invalid weave patch`);
    }
    for (const weaponId of fusion.weapons) {
      if (!weaponIds.has(weaponId)) {
        errors.push(`Fusion ${fusion.id} references unknown weapon ${weaponId}`);
      }
    }
  }
  for (let first = 0; first < WEAPON_DEFINITIONS.length; first += 1) {
    for (
      let second = first + 1;
      second < WEAPON_DEFINITIONS.length;
      second += 1
    ) {
      const firstId = WEAPON_DEFINITIONS[first].id;
      const secondId = WEAPON_DEFINITIONS[second].id;
      const pair = fusionPairKey(firstId, secondId);
      if (!fusionPairs.has(pair)) {
        errors.push(`Missing complete fusion pair: ${pair}`);
      }
    }
  }
  const actualFusionByPair = new Map(
    FUSION_DEFINITIONS.map((definition) => [
      fusionPairKey(definition.weapons[0], definition.weapons[1]),
      definition,
    ]),
  );
  for (const [first, second, action] of LOCKED_FUSION_RECIPES) {
    const definition = actualFusionByPair.get(fusionPairKey(first, second));
    if (!definition) {
      errors.push(`Missing locked fusion pair: ${first}+${second}`);
    } else if (definition.action !== action) {
      errors.push(
        `Fusion ${first}+${second} must use action ${action}, found ${definition.action}`,
      );
    }
  }

  for (const duplicate of duplicateValues([
    ...SYNERGY_DEFINITIONS.map((definition) => definition.id),
    ...FUSION_DEFINITIONS.map((definition) => definition.id),
    ...CELESTIAL_INTRUSIONS.map((definition) => definition.id),
    ...ENDLESS_PERK_DEFINITIONS.map((definition) => definition.id),
  ])) {
    errors.push(`Duplicate top-level content id: ${duplicate}`);
  }

  return errors;
}

export function assertCombatContentValid(): void {
  const errors = validateCombatContent();
  if (errors.length > 0) {
    throw new Error(`Combat content is invalid:\n${errors.join("\n")}`);
  }
}
