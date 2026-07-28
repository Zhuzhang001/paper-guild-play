import { CELESTIAL_INTRUSIONS } from "./celestials";
import { FUSION_DEFINITIONS } from "./fusions";
import { SYNERGY_DEFINITIONS } from "./synergies";
import type { WeaponId } from "./types";
import { WEAPON_DEFINITIONS } from "./weapons";

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
  if (FUSION_DEFINITIONS.length !== 15) {
    errors.push(`Expected 15 fusions, found ${FUSION_DEFINITIONS.length}`);
  }
  if (CELESTIAL_INTRUSIONS.length !== 6) {
    errors.push(`Expected 6 celestial intrusions, found ${CELESTIAL_INTRUSIONS.length}`);
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
    for (const weaponId of synergy.weapons) {
      if (!weaponIds.has(weaponId)) {
        errors.push(`Synergy ${synergy.id} references unknown weapon ${weaponId}`);
      }
    }
  }

  const fusionPairs = new Set<string>();
  for (const fusion of FUSION_DEFINITIONS) {
    const pair = [...fusion.weapons].sort().join("+");
    if (fusionPairs.has(pair)) {
      errors.push(`Duplicate fusion pair: ${pair}`);
    }
    fusionPairs.add(pair);
    for (const weaponId of fusion.weapons) {
      if (!weaponIds.has(weaponId)) {
        errors.push(`Fusion ${fusion.id} references unknown weapon ${weaponId}`);
      }
    }
  }

  for (const duplicate of duplicateValues([
    ...SYNERGY_DEFINITIONS.map((definition) => definition.id),
    ...FUSION_DEFINITIONS.map((definition) => definition.id),
    ...CELESTIAL_INTRUSIONS.map((definition) => definition.id),
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
