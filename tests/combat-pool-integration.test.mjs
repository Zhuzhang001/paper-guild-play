import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-combat-pools-"));
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
process.on("exit", () =>
  rmSync(scratch, { recursive: true, force: true }),
);

function quietRun(seed, initialWeaponId) {
  const run = survivor.createRun(new Set(), seed, { initialWeaponId });
  run.midBossSpawned = true;
  run.finalBossSpawned = true;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  run.testModifiers.incomingDamageScale = 0;
  run.player.powerMultiplier = 0.01;
  return run;
}

function createTarget(run) {
  run.spawnClock = 0;
  survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  run.spawnClock = Number.POSITIVE_INFINITY;
  assert.ok(run.enemies.length > 0);
  for (const enemy of run.enemies) {
    enemy.hp = 1_000_000;
    enemy.maxHp = 1_000_000;
  }
}

function stepUntil(run, predicate, frames = 120) {
  for (let frame = 0; frame < frames; frame += 1) {
    survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
    if (predicate()) return true;
  }
  return false;
}

test("projectile pool reuses the actor and clears its hit Map and optionals", () => {
  const run = quietRun("pool-projectile", "sword");
  const arrayIdentity = run.projectiles;
  createTarget(run);
  const first = run.projectiles[0];
  assert.ok(first);
  first.hitAt.set(987_654, 99);
  first.windTouched = true;
  first.weatherTouched = true;
  first.life = 0;
  run.cooldowns.set("weapon-attack:sword", 10);
  survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  assert.equal(run.projectiles, arrayIdentity);
  assert.equal(run.projectiles.includes(first), false);
  assert.equal(survivor.combatPoolStatsForTest(run).projectiles, 1);

  run.cooldowns.set("weapon-attack:sword", 0);
  stepUntil(run, () => run.projectiles.some((projectile) => projectile === first));
  const reused = run.projectiles.find((projectile) => projectile === first);
  assert.ok(reused, "the released projectile should be acquired again");
  assert.equal(reused.hitAt.has(987_654), false);
  assert.equal(reused.windTouched, undefined);
  assert.equal(reused.weatherTouched, undefined);
});

test("zone pool preserves its Set allocation but clears prior occupants", () => {
  const run = quietRun("pool-zone", "pipa");
  run.build = {
    ...run.build,
    weapons: [{ id: "pipa", level: 3, routeId: "pipa:c" }],
  };
  const arrayIdentity = run.zones;
  createTarget(run);
  const first = run.zones.at(-1);
  assert.ok(first);
  const setIdentity = first.enteredEnemyIds;
  first.enteredEnemyIds.add(987_654);
  for (const zone of run.zones) zone.life = 0;
  run.cooldowns.set("weapon-attack:pipa", 10);
  survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  assert.equal(run.zones, arrayIdentity);
  assert.ok(survivor.combatPoolStatsForTest(run).zones >= 1);

  run.cooldowns.set("weapon-attack:pipa", 0);
  for (const key of [...run.cooldowns.keys()]) {
    if (key.startsWith("trigger:") && key.includes(":pipa:")) {
      run.cooldowns.delete(key);
    }
  }
  stepUntil(run, () => run.zones.some((zone) => zone === first));
  const reused = run.zones.find((zone) => zone === first);
  assert.ok(
    reused,
    `the released zone should be acquired again; active=${run.zones.length}, free=${JSON.stringify(survivor.combatPoolStatsForTest(run))}, enemies=${run.enemies.length}, cooldown=${run.cooldowns.get("weapon-attack:pipa")}`,
  );
  assert.equal(reused.enteredEnemyIds, setIdentity);
  assert.equal(reused.enteredEnemyIds.has(987_654), false);
});

test("summon and death-frame wrappers return through their bounded pools", () => {
  const summonRun = quietRun("pool-summon", "crossbow");
  summonRun.build = {
    ...summonRun.build,
    weapons: [{ id: "crossbow", level: 3, routeId: "crossbow:b" }],
  };
  const summonArray = summonRun.summons;
  createTarget(summonRun);
  const firstSummon = summonRun.summons.at(-1);
  assert.ok(firstSummon);
  firstSummon.targetId = 987_654;
  for (const summon of summonRun.summons) summon.life = 0;
  summonRun.cooldowns.set("weapon-attack:crossbow", 10);
  survivor.stepRun(summonRun, 1 / 60, { x: 0, y: 0 });
  assert.equal(summonRun.summons, summonArray);
  assert.ok(survivor.combatPoolStatsForTest(summonRun).summons >= 1);
  summonRun.cooldowns.set("weapon-attack:crossbow", 0);
  for (const key of [...summonRun.cooldowns.keys()]) {
    if (key.startsWith("trigger:") && key.includes(":crossbow:")) {
      summonRun.cooldowns.delete(key);
    }
  }
  stepUntil(
    summonRun,
    () => summonRun.summons.some((summon) => summon === firstSummon),
  );
  assert.ok(
    summonRun.summons.some((summon) => summon === firstSummon),
    `the released summon should be acquired again; active=${summonRun.summons.length}, free=${JSON.stringify(survivor.combatPoolStatsForTest(summonRun))}, enemies=${summonRun.enemies.length}, cooldown=${summonRun.cooldowns.get("weapon-attack:crossbow")}`,
  );

  const deathRun = quietRun("pool-death", "sword");
  const deathArray = deathRun.deaths;
  createTarget(deathRun);
  deathRun.enemies[0].hp = 0;
  survivor.stepRun(deathRun, 1 / 60, { x: 0, y: 0 });
  const firstDeath = deathRun.deaths[0];
  assert.ok(firstDeath);
  firstDeath.life = 0;
  survivor.stepRun(deathRun, 1 / 60, { x: 0, y: 0 });
  assert.equal(deathRun.deaths, deathArray);
  assert.equal(survivor.combatPoolStatsForTest(deathRun).deaths, 1);

  deathRun.spawnClock = 0;
  survivor.stepRun(deathRun, 1 / 60, { x: 0, y: 0 });
  deathRun.spawnClock = Number.POSITIVE_INFINITY;
  const nextEnemy = deathRun.enemies[0];
  assert.ok(nextEnemy);
  nextEnemy.hp = 0;
  survivor.stepRun(deathRun, 1 / 60, { x: 0, y: 0 });
  assert.ok(
    deathRun.deaths.some((actor) => actor === firstDeath),
    "the released death-frame wrapper should be acquired again",
  );
});

function combatDigest(run) {
  const rounded = (value) => Math.round(value * 1e6) / 1e6;
  return {
    snapshot: survivor.snapshotRun(run),
    enemies: run.enemies.map((enemy) => [
      enemy.id,
      enemy.type,
      rounded(enemy.x),
      rounded(enemy.y),
      rounded(enemy.hp),
    ]),
    projectiles: run.projectiles.map((projectile) => [
      projectile.id,
      projectile.owner,
      rounded(projectile.x),
      rounded(projectile.y),
      rounded(projectile.life),
      projectile.pierce,
    ]),
    zones: run.zones.map((zone) => [
      zone.id,
      zone.owner,
      rounded(zone.life),
      [...zone.enteredEnemyIds].sort((a, b) => a - b),
    ]),
    summons: run.summons.map((summon) => [
      summon.id,
      summon.owner,
      rounded(summon.x),
      rounded(summon.y),
      rounded(summon.life),
      summon.targetId,
    ]),
    deaths: run.deaths.map((actor) => [
      actor.enemy.id,
      rounded(actor.life),
    ]),
  };
}

test("interleaved same-seed fixed-step simulations remain bit-for-bit deterministic", () => {
  const first = quietRun("pool-determinism", "crossbow");
  const second = quietRun("pool-determinism", "crossbow");
  first.build = {
    ...first.build,
    weapons: [
      { id: "crossbow", level: 3, routeId: "crossbow:b" },
      { id: "pipa", level: 3, routeId: "pipa:c" },
    ],
  };
  second.build = {
    ...second.build,
    weapons: first.build.weapons.map((weapon) => ({ ...weapon })),
  };
  for (let frame = 0; frame < 720; frame += 1) {
    const input = {
      x: frame % 180 < 90 ? 0.42 : -0.37,
      y: frame % 240 < 120 ? 0.23 : -0.19,
    };
    survivor.stepRun(first, 1 / 60, input);
    survivor.stepRun(second, 1 / 60, input);
  }
  assert.deepEqual(combatDigest(first), combatDigest(second));
});
