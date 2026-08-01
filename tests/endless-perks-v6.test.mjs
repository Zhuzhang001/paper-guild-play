import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-perks-v6-"));
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
const runtime = await bundle("../app/game/runtime/index.ts", "runtime.mjs");
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

test("v6 craft book has 32 pages, 64 locked branches and 16 pair pages", () => {
  assert.equal(content.ENDLESS_PERK_DEFINITIONS.length, 32);
  assert.equal(content.ENDLESS_PERK_BRANCH_DEFINITIONS.length, 64);
  assert.equal(content.ENDLESS_PERK_PAIR_DEFINITIONS.length, 16);
  assert.equal(content.ALL_ENDLESS_PERK_DEFINITIONS.length, 112);

  for (const page of content.ENDLESS_PERK_DEFINITIONS) {
    const branches = content.ENDLESS_PERK_BRANCH_DEFINITIONS.filter(
      (branch) => branch.parentPageId === page.id,
    );
    assert.deepEqual(
      branches.map((branch) => branch.branchKey).sort(),
      ["a", "b"],
      page.id,
    );
    assert.ok(branches.every((branch) => branch.rules.length > 0), page.id);
    assert.notEqual(
      JSON.stringify(branches[0].rules),
      JSON.stringify(branches[1].rules),
      `${page.id} branches must change different event relationships`,
    );
  }
});

test("later rows favor page, branch, pair and situation cards", () => {
  let state = runtime.createEndlessPerkState();
  state = runtime.applyEndlessPerkChoice(state, "swordMarkReturn");
  state = runtime.applyEndlessPerkChoice(state, "windDeflectShot");
  const result = runtime.generateEndlessPerkChoices(
    state,
    runtime.createRngState("v6-relation-row"),
    4,
    { ownedWeaponIds: ["sword", "fan"], weaveNodeCount: 4, weaveMaxNodes: 8 },
  );
  assert.equal(result.choices.length, 4);
  assert.ok(result.choices.some((choice) => choice.choiceKind === "page"));
  assert.ok(result.choices.some((choice) => choice.choiceKind === "branch"));
  assert.ok(result.choices.some((choice) => choice.choiceKind === "pair"));
  assert.ok(
    result.choices.some(
      (choice) => choice.category === "season" || choice.category === "journey",
    ),
  );
});

test("page branches lock, pair pages cap at six, and explicit replacement works", () => {
  const allPageRanks = Object.fromEntries(
    content.ENDLESS_PERK_DEFINITIONS.map((page) => [page.id, 1]),
  );
  let state = {
    ...runtime.createEndlessPerkState(),
    ranks: allPageRanks,
  };
  state = runtime.applyEndlessPerkChoice(state, "swordMarkReturn:a");
  const locked = runtime.applyEndlessPerkChoice(state, "swordMarkReturn:b");
  assert.equal(locked.branches.swordMarkReturn, "swordMarkReturn:a");
  assert.equal(locked.ranks["swordMarkReturn:b"] ?? 0, 0);

  const pairIds = content.ENDLESS_PERK_PAIR_DEFINITIONS.map((pair) => pair.id);
  for (const pairId of pairIds.slice(0, 6)) {
    state = runtime.applyEndlessPerkChoice(state, pairId);
  }
  assert.equal(state.activePairIds.length, 6);
  const refused = runtime.applyEndlessPerkChoice(state, pairIds[6]);
  assert.deepEqual(refused.activePairIds, state.activePairIds);
  const replaced = runtime.applyEndlessPerkChoice(state, pairIds[6], {
    replacePairId: pairIds[0],
  });
  assert.equal(replaced.activePairIds.length, 6);
  assert.equal(replaced.activePairIds.includes(pairIds[0]), false);
  assert.equal(replaced.activePairIds.includes(pairIds[6]), true);
  assert.equal(replaced.ranks[pairIds[0]] ?? 0, 0);
});

test("owned branch rules enter the same deterministic combat event stream", () => {
  let state = runtime.createEndlessPerkState();
  state = runtime.applyEndlessPerkChoice(state, "swordMarkReturn");
  state = runtime.applyEndlessPerkChoice(state, "swordMarkReturn:a");
  const result = runtime.consumeEndlessPerkEvent(state, {
    type: "markedTargetKilled",
    weaponId: "sword",
    targetId: 9,
  });
  assert.deepEqual(
    result.procs.map((proc) => proc.perkId),
    ["swordMarkReturn", "swordMarkReturn:a"],
  );
  assert.ok(result.procs[1].actions.length > result.procs[0].actions.length);
});
