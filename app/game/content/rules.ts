export const FORM_RULES = Object.freeze({
  movingBeforeFold: 0.55,
  foldDuration: 0.3,
  stoppedBeforeUnfold: 0.1,
  unfoldDuration: 0.24,
  sharpTurnDegrees: 70,
  humanHoldAfterTurn: 0.35,
});

export const PROGRESSION_RULES = Object.freeze({
  weaponSlots: 4,
  synergySlots: 3,
  weaponStages: 5,
  standardSeconds: 480,
  eliteTimes: [120, 300] as const,
  taotieTime: 360,
  nianTime: 480,
});

export const WEAVE_RULES = Object.freeze({
  maxNodes: 8,
  maxFusions: 4,
  forgePeriodSeconds: 120,
  firePerForge: 2,
  maxFire: 3,
  terminalCadenceSeconds: [6, 12] as const,
});

export const CELESTIAL_RULES = Object.freeze({
  firstIntrusionSeconds: 70,
  repeatSeconds: 120,
  canDismiss: true,
});

export const ENDLESS_RULES = Object.freeze({
  entityCap: 150,
  scalingBeginsMinutes: 48,
  scalingEndsMinutes: 78,
  scalingStepMinutes: 3,
  frozenAfterMinutes: 80,
  maxHitDamage: 3,
});
