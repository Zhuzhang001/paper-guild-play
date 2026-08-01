export type DifficultyId = "normal" | "hard" | "extreme" | "oneLife";

export type DifficultyDefinition = {
  id: DifficultyId;
  name: "普通" | "困难" | "极难" | "一命";
  playerLife: 5 | 4 | 3 | 1;
  playerPower: number;
  recoveryMultiplier: 1 | 0.75 | 0.5 | 0;
  enemyHpMultiplier: number;
  enemySpeedMultiplier: number;
  threatMultiplier: number;
  bossMultiplier: number;
  firstBossTraitChance: number;
  secondBossTraitChance: number;
  unlocks?: DifficultyId;
};

export const DIFFICULTY_IDS = [
  "normal",
  "hard",
  "extreme",
  "oneLife",
] as const satisfies readonly DifficultyId[];

export const DIFFICULTIES: Readonly<Record<DifficultyId, DifficultyDefinition>> =
  Object.freeze({
    normal: {
      id: "normal",
      name: "普通",
      playerLife: 5,
      playerPower: 1,
      recoveryMultiplier: 1,
      enemyHpMultiplier: 1,
      enemySpeedMultiplier: 1,
      threatMultiplier: 1,
      bossMultiplier: 1,
      firstBossTraitChance: 0.15,
      secondBossTraitChance: 0,
      unlocks: "hard",
    },
    hard: {
      id: "hard",
      name: "困难",
      playerLife: 4,
      playerPower: 0.94,
      recoveryMultiplier: 0.75,
      enemyHpMultiplier: 1.22,
      enemySpeedMultiplier: 1.06,
      threatMultiplier: 1.15,
      bossMultiplier: 1.2,
      firstBossTraitChance: 0.35,
      secondBossTraitChance: 0,
      unlocks: "extreme",
    },
    extreme: {
      id: "extreme",
      name: "极难",
      playerLife: 3,
      playerPower: 0.88,
      recoveryMultiplier: 0.5,
      enemyHpMultiplier: 1.48,
      enemySpeedMultiplier: 1.12,
      threatMultiplier: 1.32,
      bossMultiplier: 1.45,
      firstBossTraitChance: 0.6,
      secondBossTraitChance: 0.25,
      unlocks: "oneLife",
    },
    oneLife: {
      id: "oneLife",
      name: "一命",
      playerLife: 1,
      playerPower: 0.82,
      recoveryMultiplier: 0,
      enemyHpMultiplier: 1.7,
      enemySpeedMultiplier: 1.16,
      threatMultiplier: 1.5,
      bossMultiplier: 1.7,
      firstBossTraitChance: 0.75,
      secondBossTraitChance: 0.45,
    },
  });

export function getDifficultyDefinition(
  id: DifficultyId,
): DifficultyDefinition {
  return DIFFICULTIES[id];
}

export function resolveDifficultyId(
  requested: DifficultyId | undefined,
  unlocked: readonly DifficultyId[] | undefined,
): DifficultyId {
  const wanted = requested ?? "normal";
  if (unlocked === undefined) return wanted;
  return unlocked.includes(wanted) ? wanted : "normal";
}

export function nextDifficultyId(
  id: DifficultyId,
): DifficultyId | undefined {
  return DIFFICULTIES[id].unlocks;
}

