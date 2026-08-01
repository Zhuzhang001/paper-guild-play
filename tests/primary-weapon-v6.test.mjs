import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-primary-v6-"));
const outfile = join(scratch, "survivor.mjs");
const esbuild = fileURLToPath(
  new URL("../node_modules/.bin/esbuild.cmd", import.meta.url),
);
const bundled = spawnSync(
  esbuild,
  [
    fileURLToPath(new URL("../app/game/survivor.ts", import.meta.url)),
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
const survivor = await import(pathToFileURL(outfile).href);
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

test("lantern start waits for the first non-lantern weapon and exposes its rule", () => {
  const run = survivor.createRun(new Set(), 6401, {
    initialWeaponId: "lantern",
  });
  assert.equal(survivor.snapshotRun(run).primaryWeaponId, undefined);
  assert.equal(survivor.snapshotRun(run).primaryWeaponValid, false);
  assert.equal(survivor.setPrimaryWeapon(run, "lantern"), false);

  survivor.applyUpgrade(run, {
    id: "test-acquire-pipa",
    kind: "acquire",
    weaponId: "pipa",
    title: "月牙琵琶",
    description: "",
    artKey: "weapon/pipa/tier1",
  });
  const snapshot = survivor.snapshotRun(run);
  assert.equal(snapshot.primaryWeaponId, "pipa");
  assert.equal(snapshot.primaryWeaponValid, true);
  assert.match(snapshot.primaryWeaponRule, /非走马灯武器/);
});

test("lantern replays a semantic pipa wave instead of copying a leftover sprite", () => {
  const run = survivor.createRun(new Set(), 6402, {
    initialWeaponId: "pipa",
  });
  run.build = {
    ...run.build,
    weapons: [
      { id: "pipa", level: 1 },
      { id: "lantern", level: 3, routeId: "lantern:c" },
    ],
  };
  run.spawnClock = 0;
  survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });

  const replay = run.attackReplays.get("pipa");
  assert.ok(replay);
  assert.deepEqual(replay.effects.map((effect) => effect.kind), ["beam"]);
  assert.equal(replay.copyDepth, 0);
  assert.ok(
    run.fx.some((fx) => fx.owner === "lantern" && fx.kind === "wave"),
    "the copied music attack should keep the wave visual family",
  );
  assert.equal(
    run.attackReplays.has("lantern"),
    false,
    "a copy-only lantern attack must not become a new replay source",
  );
});

test("semantic replay covers projectile, chain, field, summon and lightning cores", () => {
  const cases = [
    {
      weapon: { id: "sword", level: 3, routeId: "sword:a" },
      found: (run) => run.projectiles.some((item) => item.owner === "lantern"),
      label: "projectile",
    },
    {
      weapon: { id: "pipa", level: 3, routeId: "pipa:b" },
      found: (run) => run.fx.some((item) => item.owner === "lantern" && item.kind === "chain"),
      label: "chain",
    },
    {
      weapon: { id: "pipa", level: 3, routeId: "pipa:c" },
      found: (run) => run.zones.some((item) => item.owner === "lantern"),
      label: "field",
    },
    {
      weapon: { id: "umbrella", level: 1 },
      found: (run) => run.fx.some((item) => item.owner === "lantern" && item.kind === "ring"),
      label: "orbit",
    },
    {
      weapon: { id: "crossbow", level: 3, routeId: "crossbow:b" },
      found: (run) => run.summons.some((item) => item.owner === "lantern"),
      label: "summon",
    },
    {
      weapon: { id: "thunderSeal", level: 3, routeId: "thunderSeal:a" },
      found: (run) => run.strikes.some((item) => item.owner === "lantern"),
      label: "lightning",
    },
  ];

  for (const [index, entry] of cases.entries()) {
    const run = survivor.createRun(new Set(), 6500 + index, {
      initialWeaponId: entry.weapon.id,
    });
    run.build = {
      ...run.build,
      weapons: [entry.weapon, { id: "lantern", level: 3, routeId: "lantern:c" }],
    };
    run.player.powerMultiplier = 0.01;
    run.spawnClock = 0;
    survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
    assert.equal(
      entry.found(run),
      true,
      `${entry.label} core was not replayed; record=${JSON.stringify(run.attackReplays.get(entry.weapon.id)?.effects.map((effect) => effect.kind))} fx=${JSON.stringify(run.fx.map((fx) => [fx.owner, fx.kind]))}`,
    );
  }
});

test("rare advancement requires an explicit weapon and route/mastery choice", () => {
  const run = survivor.createRun(new Set(), 6403);
  run.build = {
    ...run.build,
    weapons: [{ id: "sword", level: 2 }],
  };
  assert.equal(survivor.applyRareChoice(run, "master-now"), false);
  assert.equal(run.build.weapons[0].level, 2);

  const target = survivor.getRareAdvanceTargets(run)[0];
  assert.equal(target.needsExplicitChoice, true);
  assert.equal(target.options.length, 3);
  assert.equal(
    survivor.applyRareChoice(run, "master-now", {
      weaponId: "sword",
      upgradeOptionId: target.options[1].id,
    }),
    true,
  );
  assert.equal(run.build.weapons[0].level, 3);
  assert.equal(run.build.weapons[0].routeId, target.options[1].routeId);

  run.build = {
    ...run.build,
    weapons: [{ id: "sword", level: 5, routeId: "sword:a", masteryId: "sword:a:focus" }],
  };
  const availability = survivor
    .getRareChoiceAvailability(run)
    .find((choice) => choice.id === "master-now");
  assert.equal(availability.enabled, false);
  assert.equal(availability.reason, "当前器物均已定型");
});

test("a fused primary source becomes invalid until the player selects a remaining weapon", () => {
  const run = survivor.createRun(new Set(), 6405, {
    initialWeaponId: "sword",
  });
  run.build = {
    ...run.build,
    weapons: [
      { id: "sword", level: 1 },
      { id: "fan", level: 1 },
      { id: "pipa", level: 1 },
    ],
  };
  survivor.startEndless(run);
  run.forgeCredits = 1;
  assert.ok(survivor.fuseEndlessNodesWithName(run, 0, 1));
  assert.equal(survivor.snapshotRun(run).primaryWeaponValid, false);
  assert.deepEqual(survivor.availablePrimaryWeapons(run), ["pipa"]);
  assert.equal(survivor.setPrimaryWeapon(run, "pipa"), true);
  assert.equal(survivor.snapshotRun(run).primaryWeaponId, "pipa");
});

test("test helpers seek safely and spawn the requested authored boss", () => {
  const run = survivor.createRun(new Set(), 6404);
  const events = [];
  assert.equal(survivor.jumpEndlessMinutesForTest(run, 35, events), true);
  assert.equal(Math.round(survivor.endlessMinutes(run)), 35);
  assert.ok(run.forgeAt > run.elapsed);
  assert.ok(run.intrusionAt > run.elapsed);
  assert.equal(run.testModifiers.assisted, true);

  assert.equal(
    survivor.spawnEndlessBossForTest(run, "chiefClerk", events),
    true,
  );
  assert.ok(run.enemies.some((enemy) => enemy.endlessBossId === "chiefClerk"));
  assert.ok(
    events.some(
      (event) => event.type === "bossSpawn" && event.bossId === "chiefClerk",
    ),
  );
});
