import type { DifficultyDefinition } from "./difficulty";

export const ENDLESS_ACTOR_CAP = 150;
export const COMMON_THREAT_COST = 1;
export const ELITE_THREAT_COST = 4;
export const BOSS_THREAT_COST = 28;

export type EndlessDifficultySample = {
  minutes: number;
  specialProbability: number;
  nonBossThreatPerSecond: number;
  bossBudgetPerMinute: number;
  bossConcurrency: 1 | 2 | 3;
  post45Step: number;
  hpMultiplier: number;
  speedMultiplier: number;
  actionMultiplier: number;
  contactDamage: 1 | 2 | 3;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function specialProbability(minutes: number): number {
  const m = Math.max(0, minutes);
  if (m < 15) return 0.06 + (0.12 * m) / 15;
  return Math.min(
    0.98,
    0.18 +
      (0.8 * Math.log(1 + (m - 15) / 18)) /
        Math.log(1 + 65 / 18),
  );
}

export function post45Step(minutes: number): number {
  return clamp(Math.floor((Math.max(0, minutes) - 45) / 3), 0, 11);
}

export function bossConcurrency(minutes: number): 1 | 2 | 3 {
  if (minutes < 35) return 1;
  if (minutes < 60) return 2;
  return 3;
}

export function sampleEndlessDifficulty(
  minutes: number,
  difficulty: DifficultyDefinition,
): EndlessDifficultySample {
  const m = Math.max(0, minutes);
  const step = post45Step(m);
  return {
    minutes: m,
    specialProbability: specialProbability(m),
    nonBossThreatPerSecond:
      12 * (1 + 0.0125 * m) * difficulty.threatMultiplier,
    bossBudgetPerMinute:
      (0.25 + 0.0125 * m) * difficulty.bossMultiplier,
    bossConcurrency: bossConcurrency(m),
    post45Step: step,
    hpMultiplier: 1 + 0.045 * step,
    speedMultiplier: 1 + 0.01 * step,
    actionMultiplier: 1 + 0.018 * step,
    contactDamage: Math.min(
      3,
      1 + (step >= 5 ? 1 : 0) + (step >= 9 ? 1 : 0),
    ) as 1 | 2 | 3,
  };
}

