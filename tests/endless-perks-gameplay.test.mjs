import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-perk-gameplay-"));
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

const survivor = await bundle("../app/game/survivor.ts", "survivor.mjs");
const runtime = await bundle("../app/game/runtime/index.ts", "runtime.mjs");
process.on("exit", () =>
  rmSync(scratch, { recursive: true, force: true }),
);

function quietRun(seed = "perk-gameplay") {
  const run = survivor.createRun(new Set(), seed);
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.midBossSpawned = true;
  run.finalBossSpawned = true;
  run.endlessBossAt = Number.POSITIVE_INFINITY;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  return run;
}

function grant(run, perkId) {
  run.endlessPerks = runtime.applyEndlessPerkChoice(
    run.endlessPerks,
    perkId,
  );
}

function targetEnemy(run, id = 100) {
  return {
    id,
    type: "cup",
    x: run.player.x + 360,
    y: run.player.y,
    vx: 0,
    vy: 0,
    heading: Math.PI,
    travelled: 0,
    radius: 19,
    hp: 9999,
    maxHp: 9999,
    speed: 0,
    turnSpeed: 0,
    damage: 1,
    elite: false,
    boss: false,
    bossTier: null,
    hitFlash: 0,
    marked: 0,
    markMultiplier: 1,
    markStacks: 0,
    slow: 0,
    motion: "moving",
    motionTime: 0,
    attackCooldown: 999,
    attackCommitted: false,
    skillIndex: 0,
    intrusionAvatar: false,
  };
}

function addHostileStrike(run) {
  run.strikes.push({
    id: run.serial++,
    owner: "terminal",
    artKey: "test/hostile",
    x: run.player.x,
    y: run.player.y,
    radius: 30,
    damage: 1,
    delay: 0,
    maxDelay: 0,
    hostile: true,
  });
}

test("九珠清账 creates three real projectiles only on the ninth hit", () => {
  const run = quietRun("nine-pearl");
  const target = targetEnemy(run);
  run.enemies.push(target);
  grant(run, "ninePearl");

  for (let hit = 1; hit < 9; hit += 1) {
    survivor.dispatchEndlessPerkEvent(
      run,
      {
        type: "sameTargetPearlHit",
        weaponId: "abacus",
        targetId: target.id,
      },
      { target, firstTarget: target },
    );
  }
  assert.equal(run.projectiles.length, 0);

  survivor.dispatchEndlessPerkEvent(
    run,
    {
      type: "sameTargetPearlHit",
      weaponId: "abacus",
      targetId: target.id,
    },
    { target, firstTarget: target },
  );
  assert.equal(run.projectiles.length, 3);
  assert.ok(run.projectiles.every((projectile) => projectile.owner === "abacus"));

  const unselected = quietRun("nine-pearl-unselected");
  const otherTarget = targetEnemy(unselected, 101);
  unselected.enemies.push(otherTarget);
  for (let hit = 0; hit < 9; hit += 1) {
    survivor.dispatchEndlessPerkEvent(
      unselected,
      {
        type: "sameTargetPearlHit",
        weaponId: "abacus",
        targetId: otherTarget.id,
      },
      { target: otherTarget, firstTarget: otherTarget },
    );
  }
  assert.equal(unselected.projectiles.length, 0);
});

test("破纸护命 keeps one life, locks for 90 seconds, then refreshes", () => {
  const run = quietRun("last-paper");
  grant(run, "lastPaperGuard");
  run.player.life = 1;
  addHostileStrike(run);
  survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
  assert.equal(run.player.life, 1);
  assert.ok(run.player.invulnerability > 0);

  run.player.invulnerability = 0;
  addHostileStrike(run);
  survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
  assert.equal(run.player.life, 0);

  run.player.life = 1;
  run.player.invulnerability = 0;
  run.endlessPerks = runtime.stepEndlessPerkState(
    run.endlessPerks,
    90,
  );
  addHostileStrike(run);
  survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
  assert.equal(run.player.life, 1);
});

test("秋风扫场 moves drops and is twice as strong in autumn", () => {
  function sweptDistance(elapsed, seed) {
    const run = quietRun(seed);
    grant(run, "autumnSweep");
    run.elapsed = elapsed;
    run.pickups.push({
      id: run.serial++,
      x: run.player.x + 450,
      y: run.player.y,
      value: 1,
      age: 0,
      tier: 1,
      kind: "experience",
    });
    survivor.dispatchEndlessPerkEvent(run, { type: "interval" });
    return Math.abs(run.pickups[0].x - run.player.x);
  }

  const springDistance = sweptDistance(0, "spring-sweep");
  const autumnDistance = sweptDistance(240, "autumn-sweep");
  assert.ok(springDistance < 450, "the ordinary effect must move the drop");
  assert.ok(
    autumnDistance < springDistance,
    "the matching autumn effect must move it farther",
  );
});

test("named craft-book branches emit their own rain, echo, and pickup actions", () => {
  const umbrellaRun = quietRun("umbrella-rain-branch");
  const umbrellaTarget = targetEnemy(umbrellaRun, 301);
  umbrellaRun.enemies.push(umbrellaTarget);
  grant(umbrellaRun, "umbrellaGap");
  grant(umbrellaRun, "umbrellaGap:b");
  survivor.dispatchEndlessPerkEvent(
    umbrellaRun,
    { type: "guardSucceeded", weaponId: "umbrella" },
    { target: umbrellaTarget, firstTarget: umbrellaTarget },
  );
  assert.equal(
    umbrellaRun.projectiles.filter((projectile) => projectile.owner === "umbrella").length,
    5,
  );

  const pipaRun = quietRun("pipa-echo-branch");
  const pipaTarget = targetEnemy(pipaRun, 302);
  pipaRun.enemies.push(pipaTarget);
  grant(pipaRun, "lastNoteReturn");
  grant(pipaRun, "lastNoteReturn:b");
  survivor.dispatchEndlessPerkEvent(
    pipaRun,
    { type: "musicChainCompleted", weaponId: "pipa" },
    { target: pipaTarget, firstTarget: pipaTarget },
  );
  assert.ok(
    pipaRun.zones.some(
      (zone) => zone.owner === "pipa" && zone.artKey === "perk/pipa/echo-field",
    ),
  );

  const pickupRun = quietRun("pickup-return-branch");
  pickupRun.pickups.push({
    id: pickupRun.serial++,
    x: pickupRun.player.x + 390,
    y: pickupRun.player.y,
    value: 1,
    age: 0,
    tier: 1,
    kind: "experience",
  });
  grant(pickupRun, "highPickupWind");
  grant(pickupRun, "highPickupWind:b");
  const before = Math.abs(pickupRun.pickups[0].x - pickupRun.player.x);
  survivor.dispatchEndlessPerkEvent(pickupRun, {
    type: "highTierPickupCollected",
    value: 12,
  });
  const after = Math.abs(pickupRun.pickups[0].x - pickupRun.player.x);
  assert.ok(after < before);
  assert.ok((pickupRun.pickups[0].magnetRadius ?? 0) > 0);
});

function weaveRun(perks = [], seed = "weave-perks") {
  const run = quietRun(seed);
  run.build = {
    modifiers: {},
    synergyCapacity: 3,
    weapons: [
      { id: "sword", level: 3, routeId: "sword:a" },
      { id: "fan", level: 3, routeId: "fan:a" },
      { id: "crossbow", level: 3, routeId: "crossbow:a" },
    ],
  };
  for (const perk of perks) grant(run, perk);
  survivor.startEndless(run);
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  run.enemies.push(targetEnemy(run, 200));
  return run;
}

test("器盘手艺 change direction, cursor count, and actual cycle speed", () => {
  const ordinary = weaveRun([], "weave-ordinary");
  ordinary.weave.pulse.nodeProgress = 0.999;
  survivor.stepRun(ordinary, 1 / 30, { x: 0, y: 0 });
  assert.equal(ordinary.weave.pulse.nodeIndex, 1);

  const reversed = weaveRun(["reverseCycle"], "weave-reverse");
  reversed.weave.pulse.nodeProgress = 0.999;
  survivor.stepRun(reversed, 1 / 30, { x: 0, y: 0 });
  assert.equal(reversed.weave.pulse.nodeIndex, 2);

  const dual = weaveRun(["dualCursor"], "weave-dual");
  dual.weave.pulse.nodeProgress = 0.999;
  survivor.stepRun(dual, 1 / 30, { x: 0, y: 0 });
  const weaveOwners = new Set(
    dual.projectiles
      .filter((projectile) => projectile.owner.startsWith("weave:"))
      .map((projectile) => projectile.owner),
  );
  assert.equal(weaveOwners.size, 2);

  const normalSpeed = weaveRun([], "weave-normal-speed");
  const fast = weaveRun(["fastLightFinish"], "weave-fast");
  const slow = weaveRun(["slowHeavyFinish"], "weave-slow");
  survivor.stepRun(normalSpeed, 1 / 30, { x: 0, y: 0 });
  survivor.stepRun(fast, 1 / 30, { x: 0, y: 0 });
  survivor.stepRun(slow, 1 / 30, { x: 0, y: 0 });
  assert.ok(fast.weave.pulse.nodeProgress > normalSpeed.weave.pulse.nodeProgress);
  assert.ok(slow.weave.pulse.nodeProgress < normalSpeed.weave.pulse.nodeProgress);
});
