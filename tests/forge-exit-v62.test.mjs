import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-forge-exit-v62-"));
const outfile = join(scratch, "runtime.mjs");
const esbuild = fileURLToPath(
  new URL("../node_modules/.bin/esbuild.cmd", import.meta.url),
);
const bundled = spawnSync(
  esbuild,
  [
    fileURLToPath(new URL("../app/game/runtime/index.ts", import.meta.url)),
    "--bundle",
    "--format=esm",
    "--platform=node",
    `--outfile=${outfile}`,
  ],
  {
    shell: true,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dirname(process.execPath)};${process.env.PATH ?? ""}`,
    },
  },
);
assert.equal(bundled.status, 0, bundled.stderr);
const runtime = await import(pathToFileURL(outfile).href);
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

test("forge exit exposes all seven states", () => {
  assert.deepEqual(runtime.FORGE_EXIT_PRIORITY, [
    "processing",
    "needsPairReplacement",
    "needsPerk",
    "needsPrimaryWeapon",
    "unconfirmedPreview",
    "celestialRewardPending",
    "ready",
  ]);
  assert.equal(runtime.getForgeExitState({ processing: true }), "processing");
  assert.equal(
    runtime.getForgeExitState({ perkRequired: true, perkChosen: false }),
    "needsPerk",
  );
  assert.equal(
    runtime.getForgeExitState({ pairReplacementPending: true }),
    "needsPairReplacement",
  );
  assert.equal(
    runtime.getForgeExitState({
      primaryWeaponRequired: true,
      primaryWeaponValid: false,
    }),
    "needsPrimaryWeapon",
  );
  assert.equal(
    runtime.getForgeExitState({ previewPending: true }),
    "unconfirmedPreview",
  );
  assert.equal(
    runtime.getForgeExitState({ celestialRewardPending: true }),
    "celestialRewardPending",
  );
  assert.equal(runtime.getForgeExitState({}), "ready");
});

test("forge exit priority keeps the most specific actionable blocker", () => {
  const everyBlocker = {
    processing: true,
    perkRequired: true,
    perkChosen: false,
    pairReplacementPending: true,
    primaryWeaponRequired: true,
    primaryWeaponValid: false,
    previewPending: true,
    celestialRewardPending: true,
  };
  assert.equal(runtime.getForgeExitState(everyBlocker), "processing");

  assert.equal(
    runtime.getForgeExitState({ ...everyBlocker, processing: false }),
    "needsPairReplacement",
    "the pending seventh pair must not be hidden by the generic perk requirement",
  );
  assert.equal(
    runtime.getForgeExitState({
      ...everyBlocker,
      processing: false,
      pairReplacementPending: false,
    }),
    "needsPerk",
  );
  assert.equal(
    runtime.getForgeExitState({
      ...everyBlocker,
      processing: false,
      pairReplacementPending: false,
      perkChosen: true,
    }),
    "needsPrimaryWeapon",
  );
  assert.equal(
    runtime.getForgeExitState({
      ...everyBlocker,
      processing: false,
      pairReplacementPending: false,
      perkChosen: true,
      primaryWeaponValid: true,
    }),
    "unconfirmedPreview",
    "a celestial preview must be confirmed or discarded before the reward itself",
  );
});

test("only processing disables continue and actionable blockers explain recovery", () => {
  const states = [
    "processing",
    "needsPerk",
    "needsPairReplacement",
    "needsPrimaryWeapon",
    "unconfirmedPreview",
    "celestialRewardPending",
  ];
  for (const state of states) {
    const blocker = runtime.getForgeExitBlocker(state);
    assert.ok(blocker);
    assert.equal(blocker.state, state);
    assert.ok(blocker.title.length > 0);
    assert.ok(blocker.description.length > 0);
    assert.equal(blocker.disablesContinue, state === "processing");
    if (state !== "processing") assert.ok(blocker.actions.length > 0);
  }

  assert.equal(runtime.getForgeExitBlocker("ready"), undefined);
  assert.equal(
    runtime.forgeExitDisablesContinue({
      previewPending: true,
      celestialRewardPending: true,
    }),
    false,
  );
  assert.deepEqual(
    runtime
      .getForgeExitBlocker("unconfirmedPreview")
      .actions.map((action) => action.id),
    ["returnToPreview", "discardPreview"],
  );
  assert.deepEqual(
    runtime
      .getForgeExitBlocker("celestialRewardPending")
      .actions.map((action) => action.id),
    ["returnToCelestialReward", "dismissCelestialReward"],
  );
});

test("resolveForgeExit omits a blocker only when the forge is ready", () => {
  assert.deepEqual(runtime.resolveForgeExit({}), { state: "ready" });
  const blocked = runtime.resolveForgeExit({
    perkRequired: true,
    perkChosen: false,
  });
  assert.equal(blocked.state, "needsPerk");
  assert.equal(blocked.blocker.actions[0].id, "focusPerkChoice");
});

function weaveWith(activeIntrusion) {
  return {
    nodes: [
      {
        instanceId: "node-1",
        kind: "weapon",
        sourceId: "sword",
        name: "剑",
        tags: [],
        passEffects: [],
        origin: "core",
        weaponState: { id: "sword", level: 1 },
      },
    ],
    maxNodes: 7,
    maxFusions: 3,
    pulse: { nodeIndex: 0, nodeProgress: 0.25, completedCycles: 2 },
    activeIntrusion,
    nextInstance: 2,
  };
}

test("dismissDefeatedIntrusion clears only a defeated reward", () => {
  const defeated = weaveWith({
    id: "galeTrial",
    phase: "defeated",
    timeRemaining: 0,
    hp: 0,
    maxHp: 100,
  });
  const dismissed = runtime.dismissDefeatedIntrusion(defeated);
  assert.notEqual(dismissed, defeated);
  assert.equal(dismissed.activeIntrusion, undefined);
  assert.equal(dismissed.nodes, defeated.nodes);
  assert.equal(dismissed.pulse, defeated.pulse);
  assert.equal(dismissed.nextInstance, defeated.nextInstance);

  for (const phase of ["warning", "active", "expired"]) {
    const state = weaveWith({
      id: "galeTrial",
      phase,
      timeRemaining: 1,
      hp: 1,
      maxHp: 100,
    });
    assert.equal(
      runtime.dismissDefeatedIntrusion(state),
      state,
      `${phase} encounters must not be cancelled by reward dismissal`,
    );
  }

  const absent = weaveWith(undefined);
  assert.equal(runtime.dismissDefeatedIntrusion(absent), absent);
});
