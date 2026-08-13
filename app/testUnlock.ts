export const TEST_UNLOCK_REQUIRED_TAPS = 4;
export const TEST_UNLOCK_MAX_ADJACENT_MS = 900;
export const TEST_UNLOCK_MAX_TOTAL_MS = 2_700;

export const EXPERIENCE_HOLD_DELAY_MS = 350;
export const EXPERIENCE_HOLD_INTERVAL_MS = 100;
export const EXPERIENCE_HOLD_STEP = 100;
export const EXPERIENCE_HOLD_MAX_PER_GESTURE = 5_000;

export type TestUnlockState = Readonly<{
  tapCount: number;
  firstTapAtMs: number | null;
  lastTapAtMs: number | null;
  unlocked: boolean;
}>;

export type TestUnlockResetEvent =
  | { type: "drag" }
  | { type: "cancel" }
  | { type: "pause-exit" }
  | { type: "new-run" };

export type TestUnlockEvent =
  | { type: "tap"; atMs: number; onTarget: boolean }
  | TestUnlockResetEvent;

export type TestUnlockTransition = Readonly<{
  state: TestUnlockState;
  unlockedNow: boolean;
  reset: boolean;
}>;

export type ExperienceHoldProgress = Readonly<{
  repeatCount: number;
  amount: number;
  capped: boolean;
  nextRepeatAtMs: number | null;
}>;

export function createTestUnlockState(): TestUnlockState {
  return {
    tapCount: 0,
    firstTapAtMs: null,
    lastTapAtMs: null,
    unlocked: false,
  };
}

function beginSequence(atMs: number): TestUnlockState {
  return {
    tapCount: 1,
    firstTapAtMs: atMs,
    lastTapAtMs: atMs,
    unlocked: false,
  };
}

/**
 * Advances the hidden-entry gesture without touching clocks or DOM state.
 * A late target tap becomes the first tap of a fresh sequence; every explicit
 * interruption resets immediately.
 */
export function reduceTestUnlockState(
  state: TestUnlockState,
  event: TestUnlockEvent,
): TestUnlockState {
  if (event.type !== "tap" || !event.onTarget) {
    return createTestUnlockState();
  }

  const atMs = event.atMs;
  if (!Number.isFinite(atMs) || atMs < 0) return createTestUnlockState();
  if (state.unlocked) return state;
  if (
    state.tapCount <= 0 ||
    state.firstTapAtMs === null ||
    state.lastTapAtMs === null
  ) {
    return beginSequence(atMs);
  }

  const adjacentMs = atMs - state.lastTapAtMs;
  const totalMs = atMs - state.firstTapAtMs;
  if (
    adjacentMs < 0 ||
    adjacentMs > TEST_UNLOCK_MAX_ADJACENT_MS ||
    totalMs < 0 ||
    totalMs > TEST_UNLOCK_MAX_TOTAL_MS
  ) {
    return beginSequence(atMs);
  }

  const tapCount = state.tapCount + 1;
  return {
    tapCount: Math.min(tapCount, TEST_UNLOCK_REQUIRED_TAPS),
    firstTapAtMs: state.firstTapAtMs,
    lastTapAtMs: atMs,
    unlocked: tapCount >= TEST_UNLOCK_REQUIRED_TAPS,
  };
}

/** Includes edge metadata so UI code does not need to diff two states. */
export function transitionTestUnlock(
  state: TestUnlockState,
  event: TestUnlockEvent,
): TestUnlockTransition {
  const next = reduceTestUnlockState(state, event);
  return {
    state: next,
    unlockedNow: !state.unlocked && next.unlocked,
    reset:
      next.tapCount === 0 &&
      (state.tapCount > 0 || state.unlocked),
  };
}

function normalizedElapsed(elapsedMs: number) {
  return Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
}

/**
 * Computes only the repeated long-press bonus. A normal tap, if desired, is a
 * separate UI action. The first +100 is due exactly at 350ms.
 */
export function calculateExperienceHoldRepeat(
  elapsedMs: number,
): ExperienceHoldProgress {
  const elapsed = normalizedElapsed(elapsedMs);
  const maxRepeats = Math.floor(
    EXPERIENCE_HOLD_MAX_PER_GESTURE / EXPERIENCE_HOLD_STEP,
  );
  const uncappedRepeats = elapsed < EXPERIENCE_HOLD_DELAY_MS
    ? 0
    : Math.floor(
        (elapsed - EXPERIENCE_HOLD_DELAY_MS) /
          EXPERIENCE_HOLD_INTERVAL_MS,
      ) + 1;
  const repeatCount = Math.min(maxRepeats, uncappedRepeats);
  const capped = repeatCount >= maxRepeats;
  return {
    repeatCount,
    amount: repeatCount * EXPERIENCE_HOLD_STEP,
    capped,
    nextRepeatAtMs: capped
      ? null
      : EXPERIENCE_HOLD_DELAY_MS +
        repeatCount * EXPERIENCE_HOLD_INTERVAL_MS,
  };
}

/** Returns the newly earned amount between two timer samples without repeats. */
export function calculateExperienceHoldDelta(
  previousElapsedMs: number,
  elapsedMs: number,
) {
  const previous = calculateExperienceHoldRepeat(previousElapsedMs).amount;
  const current = calculateExperienceHoldRepeat(elapsedMs).amount;
  return Math.max(0, current - previous);
}
