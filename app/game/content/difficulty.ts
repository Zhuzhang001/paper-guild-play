export type DifficultyId = "normal" | "hard" | "extreme" | "oneLife";

export type DifficultyDefinition = {
  id: DifficultyId;
  name: "普通" | "困难" | "极难" | "一命";
  playerLife: 5 | 4 | 3 | 1;
  playerPower: number;
  recoveryMultiplier: 1 | 0.75 | 0.5 | 0;
  enemyHpMultiplier: number;
  enemySpeedMultiplier: number;
  /** Standard-wave cadence and endless non-Boss threat generation. */
  threatMultiplier: number;
  bossMultiplier: number;
  /** Concurrent non-Boss skill groups, including their recovery phase. */
  enemySkillSlots: 3 | 5 | 8 | 10;
  /** Concurrent authored movement-path groups (paired shoes share one group). */
  enemyDashSlots: 1 | 2 | 3 | 4;
  /** Hard ceiling for unresolved hostile strike/projectile actors. */
  hostileAttackCap: 24 | 40 | 60 | 80;
  /** Non-Boss refresh scale while any Boss is performing on the field. */
  bossBackgroundMultiplier: 0.3 | 0.5 | 0.75 | 1;
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
      threatMultiplier: 0.75,
      bossMultiplier: 1,
      enemySkillSlots: 3,
      enemyDashSlots: 1,
      hostileAttackCap: 24,
      bossBackgroundMultiplier: 0.3,
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
      threatMultiplier: 0.9,
      bossMultiplier: 1.2,
      enemySkillSlots: 5,
      enemyDashSlots: 2,
      hostileAttackCap: 40,
      bossBackgroundMultiplier: 0.5,
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
      threatMultiplier: 1,
      bossMultiplier: 1.45,
      enemySkillSlots: 8,
      enemyDashSlots: 3,
      hostileAttackCap: 60,
      bossBackgroundMultiplier: 0.75,
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
      threatMultiplier: 1.1,
      bossMultiplier: 1.7,
      enemySkillSlots: 10,
      enemyDashSlots: 4,
      hostileAttackCap: 80,
      bossBackgroundMultiplier: 1,
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
