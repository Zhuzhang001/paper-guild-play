import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-synergy-choice-"));
const esbuild = fileURLToPath(
  new URL("../node_modules/.bin/esbuild.cmd", import.meta.url),
);

function bundle(relativeEntry, outputName) {
  const outfile = join(scratch, outputName);
  const result = spawnSync(
    esbuild,
    [
      fileURLToPath(new URL(relativeEntry, import.meta.url)),
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
  assert.equal(result.status, 0, result.stderr);
  return import(pathToFileURL(outfile).href);
}

const content = await bundle("../app/game/content/index.ts", "content.mjs");
const survivor = await bundle("../app/game/survivor.ts", "survivor.mjs");
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

const overflowWeapons = [
  { id: "scissors", level: 3, routeId: "scissors:a" },
  { id: "abacus", level: 3, routeId: "abacus:a" },
  { id: "crossbow", level: 3, routeId: "crossbow:a" },
  { id: "inkline", level: 3, routeId: "inkline:a" },
];

test("content exposes the full qualified set and never silently truncates it", () => {
  const choices = content.getSynergyChoices(overflowWeapons);
  assert.equal(choices.length, 4);
  assert.deepEqual(
    content.resolveActiveSynergies(overflowWeapons, 3),
    [],
    "overflow without an explicit selection must not use authored array order",
  );

  const pickedIds = choices.slice(1).map((choice) => choice.definition.id);
  const active = content.chooseActiveSynergies(
    overflowWeapons,
    pickedIds,
    3,
  );
  assert.deepEqual(
    active.map((choice) => choice.definition.id),
    pickedIds,
  );

  const fitting = overflowWeapons.slice(0, 3);
  assert.deepEqual(
    content.chooseActiveSynergies(fitting, [], 3),
    content.getSynergyChoices(fitting),
    "all qualified pairings auto-activate when they fit",
  );
});

test("survivor asks once per changed overflow set and preserves prior picks", () => {
  const run = survivor.createRun(new Set(), "synergy-choice-runtime");
  run.player.life = 999;
  run.player.maxLife = 999;
  run.midBossSpawned = true;
  run.finalBossSpawned = true;
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.build = {
    ...run.build,
    weapons: overflowWeapons.slice(0, 3),
    synergyCapacity: 3,
  };

  let events = survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  assert.equal(events.some((event) => event.type === "synergyChoice"), false);
  const priorIds = [...run.activeSynergyIds];
  assert.equal(priorIds.length, 2);

  run.build = { ...run.build, weapons: overflowWeapons };
  events = survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  const choiceEvent = events.find((event) => event.type === "synergyChoice");
  assert.ok(choiceEvent);
  assert.equal(choiceEvent.choices.length, 4);
  assert.equal(choiceEvent.capacity, 3);
  assert.deepEqual(
    run.activeSynergyIds,
    priorIds,
    "newly qualified entries stay inactive until the player chooses",
  );

  events = survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  assert.equal(
    events.some((event) => event.type === "synergyChoice"),
    false,
    "unchanged qualification must not reopen the chooser every frame",
  );

  const pickedIds = choiceEvent.choices
    .slice(1)
    .map((choice) => choice.id);
  assert.equal(survivor.chooseActiveSynergies(run, pickedIds), true);
  assert.deepEqual(run.activeSynergyIds, pickedIds);
  assert.deepEqual(run.pendingSynergyChoiceIds, []);
});

test("capacity changes retrigger only when a choice remains necessary", () => {
  const run = survivor.createRun(new Set(), "synergy-capacity-change");
  run.player.life = 999;
  run.player.maxLife = 999;
  run.midBossSpawned = true;
  run.finalBossSpawned = true;
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.build = {
    ...run.build,
    weapons: overflowWeapons,
    synergyCapacity: 3,
  };

  let events = survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  const first = events.find((event) => event.type === "synergyChoice");
  assert.ok(first);
  assert.equal(
    survivor.chooseActiveSynergies(
      run,
      first.choices.slice(0, 3).map((choice) => choice.id),
    ),
    true,
  );

  run.build = { ...run.build, synergyCapacity: 2 };
  events = survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  const reduced = events.find((event) => event.type === "synergyChoice");
  assert.ok(reduced);
  assert.equal(reduced.capacity, 2);
  assert.equal(
    survivor.chooseActiveSynergies(run, [reduced.choices[0].id]),
    false,
    "an incomplete selection must be rejected",
  );
  assert.equal(
    survivor.chooseActiveSynergies(
      run,
      reduced.choices.slice(0, 2).map((choice) => choice.id),
    ),
    true,
  );

  run.build = { ...run.build, synergyCapacity: 4 };
  events = survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  assert.equal(events.some((event) => event.type === "synergyChoice"), false);
  assert.equal(run.activeSynergyIds.length, 4);
});
