import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPERIENCE_HOLD_MAX_PER_GESTURE,
  TEST_UNLOCK_MAX_ADJACENT_MS,
  TEST_UNLOCK_MAX_TOTAL_MS,
  calculateExperienceHoldDelta,
  calculateExperienceHoldRepeat,
  createTestUnlockState,
  reduceTestUnlockState,
  transitionTestUnlock,
} from "../app/testUnlock.ts";

const tap = (state, atMs, onTarget = true) =>
  reduceTestUnlockState(state, { type: "tap", atMs, onTarget });

test("four target taps unlock at the inclusive timing boundaries", () => {
  assert.equal(TEST_UNLOCK_MAX_ADJACENT_MS, 900);
  assert.equal(TEST_UNLOCK_MAX_TOTAL_MS, 2_700);
  let state = createTestUnlockState();
  state = tap(state, 1_000);
  state = tap(state, 1_900);
  state = tap(state, 2_800);
  const transition = transitionTestUnlock(state, {
    type: "tap",
    atMs: 3_700,
    onTarget: true,
  });
  assert.equal(transition.state.tapCount, 4);
  assert.equal(transition.state.unlocked, true);
  assert.equal(transition.unlockedNow, true);
  assert.equal(transition.reset, false);
});

test("an adjacent timeout restarts with the current target tap", () => {
  let state = tap(createTestUnlockState(), 100);
  state = tap(state, 1_001);
  assert.deepEqual(state, {
    tapCount: 1,
    firstTapAtMs: 1_001,
    lastTapAtMs: 1_001,
    unlocked: false,
  });
});

test("out-of-order and invalid timestamps cannot unlock", () => {
  let state = tap(createTestUnlockState(), 500);
  state = tap(state, 499);
  assert.equal(state.tapCount, 1);
  assert.equal(state.firstTapAtMs, 499);
  state = tap(state, Number.NaN);
  assert.deepEqual(state, createTestUnlockState());
});

test("other positions, drag, cancel, pause exit and a new run reset", () => {
  const interruptions = [
    { type: "tap", atMs: 200, onTarget: false },
    { type: "drag" },
    { type: "cancel" },
    { type: "pause-exit" },
    { type: "new-run" },
  ];
  for (const event of interruptions) {
    let state = tap(createTestUnlockState(), 0);
    state = tap(state, 100);
    const transition = transitionTestUnlock(state, event);
    assert.deepEqual(transition.state, createTestUnlockState());
    assert.equal(transition.reset, true);
    assert.equal(transition.unlockedNow, false);
  }
});

test("an unlocked sequence remains stable until an explicit interruption", () => {
  let state = createTestUnlockState();
  for (const atMs of [0, 100, 200, 300]) state = tap(state, atMs);
  const same = tap(state, 400);
  assert.strictEqual(same, state);
  assert.equal(reduceTestUnlockState(state, { type: "new-run" }).unlocked, false);
});

test("hold repeat starts at 350ms and advances by 100 every 100ms", () => {
  assert.deepEqual(calculateExperienceHoldRepeat(349), {
    repeatCount: 0,
    amount: 0,
    capped: false,
    nextRepeatAtMs: 350,
  });
  assert.equal(calculateExperienceHoldRepeat(350).amount, 100);
  assert.equal(calculateExperienceHoldRepeat(449).amount, 100);
  assert.equal(calculateExperienceHoldRepeat(450).amount, 200);
  assert.equal(calculateExperienceHoldRepeat(1_250).amount, 1_000);
});

test("one hold caps exactly at 5000 and reports no next repeat", () => {
  assert.equal(EXPERIENCE_HOLD_MAX_PER_GESTURE, 5_000);
  assert.equal(calculateExperienceHoldRepeat(5_249).amount, 4_900);
  assert.deepEqual(calculateExperienceHoldRepeat(5_250), {
    repeatCount: 50,
    amount: 5_000,
    capped: true,
    nextRepeatAtMs: null,
  });
  assert.equal(calculateExperienceHoldRepeat(60_000).amount, 5_000);
});

test("hold delta emits each earned step once across timer samples", () => {
  assert.equal(calculateExperienceHoldDelta(0, 349), 0);
  assert.equal(calculateExperienceHoldDelta(349, 350), 100);
  assert.equal(calculateExperienceHoldDelta(350, 749), 300);
  assert.equal(calculateExperienceHoldDelta(5_250, 9_000), 0);
  assert.equal(calculateExperienceHoldDelta(800, 100), 0);
});

test("negative and non-finite hold durations are treated as zero", () => {
  assert.equal(calculateExperienceHoldRepeat(-1).amount, 0);
  assert.equal(calculateExperienceHoldRepeat(Number.NaN).amount, 0);
  assert.equal(calculateExperienceHoldRepeat(Number.POSITIVE_INFINITY).amount, 0);
});
