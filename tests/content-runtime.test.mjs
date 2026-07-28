import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-content-"));
const esbuild = fileURLToPath(new URL("../node_modules/.bin/esbuild.cmd", import.meta.url));

function bundle(relativeEntry, outputName) {
  const outfile = join(scratch, outputName);
  const result = spawnSync(esbuild, [
    fileURLToPath(new URL(relativeEntry, import.meta.url)),
    "--bundle",
    "--format=esm",
    "--platform=node",
    `--outfile=${outfile}`,
  ], {
    shell: true,
    encoding: "utf8",
    env: { ...process.env, PATH: `${dirname(process.execPath)};${process.env.PATH ?? ""}` },
  });
  assert.equal(result.status, 0, result.stderr);
  return import(pathToFileURL(outfile).href);
}

const content = await bundle("../app/game/content/index.ts", "content.mjs");
const runtime = await bundle("../app/game/runtime/index.ts", "runtime.mjs");
const world = await bundle("../app/game/world/solarTerms.ts", "solar-terms.mjs");
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

test("combat catalog contains every promised authored branch", () => {
  assert.deepEqual(content.validateCombatContent(), []);
  assert.equal(content.WEAPON_DEFINITIONS.length, 10);
  assert.equal(content.SYNERGY_DEFINITIONS.length, 12);
  assert.equal(content.FUSION_DEFINITIONS.length, 15);
  assert.equal(content.CELESTIAL_INTRUSIONS.length, 6);
  for (const weapon of content.WEAPON_DEFINITIONS) {
    assert.equal(weapon.routes.length, 3);
    for (const route of weapon.routes) assert.equal(route.masteries.length, 2);
  }
});

test("route and mastery milestones never mix with ordinary upgrades", () => {
  const base = {
    modifiers: {},
    synergyCapacity: 3,
  };
  const routeResult = runtime.generateUpgradeOptions({
    ...base,
    weapons: [{ id: "sword", level: 2 }],
  }, runtime.createRngState("route"));
  assert.equal(routeResult.milestone, "route");
  assert.equal(routeResult.options.length, 3);
  assert.ok(routeResult.options.every((option) => option.kind === "route"));

  const masteryResult = runtime.generateUpgradeOptions({
    ...base,
    weapons: [{ id: "sword", level: 4, routeId: "sword:a" }],
  }, runtime.createRngState("mastery"));
  assert.equal(masteryResult.milestone, "mastery");
  assert.equal(masteryResult.options.length, 2);
  assert.ok(masteryResult.options.every((option) => option.kind === "mastery"));
});

test("weave terminals are directional and adjacent fusions release a slot", () => {
  const forward = runtime.createWeaveState({
    modifiers: {},
    synergyCapacity: 3,
    weapons: [
      { id: "fan", level: 5, routeId: "fan:a", masteryId: "fan:a:focus" },
      { id: "umbrella", level: 5, routeId: "umbrella:a", masteryId: "umbrella:a:focus" },
      { id: "thunderSeal", level: 5, routeId: "thunderSeal:a", masteryId: "thunderSeal:a:focus" },
    ],
  });
  assert.equal(runtime.deriveWeaveTerminal(forward).name, "九霄烟雨");
  const reversed = runtime.swapWeaveNodes(forward, 0, 2);
  assert.equal(runtime.deriveWeaveTerminal(reversed).name, "藏霆寻风");

  const pair = runtime.createWeaveState({
    modifiers: {},
    synergyCapacity: 3,
    weapons: [
      { id: "sword", level: 3, routeId: "sword:a" },
      { id: "crossbow", level: 3, routeId: "crossbow:a" },
    ],
  });
  const fused = runtime.fuseAdjacentNodes(pair, 0, 1);
  assert.equal(fused.ok, true);
  if (fused.ok) {
    assert.equal(fused.state.nodes.length, 1);
    assert.equal(fused.node.kind, "fusion");
    assert.equal(fused.node.sourceId, "starPiercer");
  }
});

test("all forty-five weapon pairs conduct qi and preserve order", () => {
  let pairs = 0;
  for (let first = 0; first < content.WEAPON_IDS.length; first += 1) {
    for (let second = first + 1; second < content.WEAPON_IDS.length; second += 1) {
      const firstId = content.WEAPON_IDS[first];
      const secondId = content.WEAPON_IDS[second];
      const build = {
        modifiers: {},
        synergyCapacity: 3,
        weapons: [
          { id: firstId, level: 3, routeId: `${firstId}:a` },
          { id: secondId, level: 3, routeId: `${secondId}:a` },
        ],
      };
      const forward = runtime.createWeaveState(build);
      const reverse = runtime.swapWeaveNodes(forward, 0, 1);
      const forwardTerminal = runtime.deriveWeaveTerminal(forward);
      const reverseTerminal = runtime.deriveWeaveTerminal(reverse);
      assert.equal(forward.nodes.length, 2);
      assert.ok(runtime.advanceWeavePulse(forward, 12).terminal);
      assert.notEqual(forwardTerminal.signature, reverseTerminal.signature);
      assert.notEqual(forwardTerminal.id, reverseTerminal.id);
      pairs += 1;
    }
  }
  assert.equal(pairs, 45);
});

test("eight minutes visits all twenty-four solar terms exactly once", () => {
  assert.equal(world.SOLAR_TERMS.length, 24);
  const visited = new Set();
  for (let second = 0; second < 480; second += 20) {
    visited.add(world.getSolarTermState(second, false).current.id);
  }
  assert.equal(visited.size, 24);
  assert.equal(world.getSolarTermState(0, false).current.name, "立春");
  assert.equal(world.getSolarTermState(479.9, false).current.name, "大寒");
});
