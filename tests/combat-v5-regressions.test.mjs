import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-combat-v5-"));
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
process.on("exit", () =>
  rmSync(scratch, { recursive: true, force: true }),
);

const WEAPON_IDS = [
  "sword",
  "fan",
  "umbrella",
  "scissors",
  "abacus",
  "crossbow",
  "pipa",
  "inkline",
  "lantern",
  "thunderSeal",
];

function disableDirector(run) {
  run.midBossSpawned = true;
  run.finalBossSpawned = true;
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.endlessBossAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
}

function spawnOrdinaryEnemy(run) {
  run.spawnClock = 0;
  survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  assert.ok(run.enemies.length > 0, "test setup should spawn an enemy");
  run.spawnClock = Number.POSITIVE_INFINITY;
  const enemy = run.enemies[0];
  enemy.x = run.player.x;
  enemy.y = run.player.y;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.speed = 0;
  enemy.hp = 100_000;
  enemy.maxHp = 100_000;
  return enemy;
}

test("createRun honors each requested starting weapon", () => {
  for (const weaponId of WEAPON_IDS) {
    const run = survivor.createRun(new Set(), `start-${weaponId}`, {
      initialWeaponId: weaponId,
      unlockedWeaponIds: WEAPON_IDS,
    });
    assert.equal(
      run.build.weapons[0]?.id,
      weaponId,
      `requested ${weaponId} should be the initial weapon`,
    );
  }
});

test("random starting weapon never escapes the supplied unlocked pool", () => {
  const unlockedWeaponIds = ["fan", "pipa", "lantern"];
  const seen = new Set();
  for (let index = 0; index < 120; index += 1) {
    const run = survivor.createRun(new Set(), `random-start-${index}`, {
      initialWeaponId: "random",
      unlockedWeaponIds,
    });
    const weaponId = run.build.weapons[0]?.id;
    assert.ok(
      unlockedWeaponIds.includes(weaponId),
      `${weaponId} is outside the supplied unlocked pool`,
    );
    seen.add(weaponId);
  }
  assert.deepEqual(
    [...seen].sort(),
    [...unlockedWeaponIds].sort(),
    "the deterministic seed sweep should exercise every unlocked option",
  );
});

test("incomingDamageScale zero prevents repeated contact damage", () => {
  const run = survivor.createRun(new Set(), "invulnerable-contact");
  run.player.powerMultiplier = 0;
  run.testModifiers.incomingDamageScale = 0;
  run.testModifiers.assisted = true;
  disableDirector(run);
  const enemy = spawnOrdinaryEnemy(run);
  enemy.attackCooldown = 0;
  const startingLife = run.player.life;
  let hitEvents = 0;

  for (let frame = 0; frame < 60 * 5; frame += 1) {
    enemy.x = run.player.x;
    enemy.y = run.player.y;
    const events = survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
    hitEvents += events.filter((event) => event.type === "playerHit").length;
  }

  assert.equal(run.player.life, startingLife);
  assert.equal(run.player.invulnerability, 0);
  assert.equal(hitEvents, 0);
});

test("lantern summons occupy distinct world positions and separate while stepping", () => {
  const run = survivor.createRun(new Set(), "lantern-formation", {
    initialWeaponId: "lantern",
    unlockedWeaponIds: ["lantern"],
  });
  disableDirector(run);
  run.player.powerMultiplier = 0;
  run.build.weapons = [
    {
      id: "lantern",
      level: 3,
      routeId: "lantern:a",
    },
  ];
  const enemy = spawnOrdinaryEnemy(run);
  enemy.x = run.player.x + 180;
  enemy.y = run.player.y;
  enemy.attackCooldown = Number.POSITIVE_INFINITY;

  for (let frame = 0; frame < 180 && run.summons.length < 2; frame += 1) {
    survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  }
  assert.ok(run.summons.length >= 2, "the lantern route should create multiple summons");

  const initialPositionKeys = new Set(
    run.summons.map(
      (summon) => `${summon.x.toFixed(4)},${summon.y.toFixed(4)}`,
    ),
  );
  assert.equal(
    initialPositionKeys.size,
    run.summons.length,
    "summons should own independent initial world coordinates",
  );

  for (let frame = 0; frame < 120; frame += 1) {
    survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  }

  let minimumDistance = Number.POSITIVE_INFINITY;
  for (let left = 0; left < run.summons.length; left += 1) {
    for (let right = left + 1; right < run.summons.length; right += 1) {
      minimumDistance = Math.min(
        minimumDistance,
        Math.hypot(
          run.summons[left].x - run.summons[right].x,
          run.summons[left].y - run.summons[right].y,
        ),
      );
    }
  }
  assert.ok(
    minimumDistance >= 27,
    `formation separation fell below the 28px target: ${minimumDistance.toFixed(2)}px`,
  );
  assert.ok(
    run.summons.some(
      (summon) => Math.hypot(summon.vx, summon.vy) > 0.01,
    ),
    "summons should retain independent movement rather than sharing one pasted transform",
  );
});

test("Nian leap is phased, bounded, and survives taking damage", () => {
  const run = survivor.createRun(new Set(), "nian-leap-v5");
  run.player.powerMultiplier = 0;
  // v6.3 hit relief intentionally interrupts every enemy, including Bosses.
  // This regression isolates the opposite direction: taking weapon damage
  // must not cancel Nian's authored leap state.
  run.testModifiers.incomingDamageScale = 0;
  run.midBossSpawned = true;
  run.finalBossSpawned = false;
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.elapsed = 479.99;

  survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  const nian = run.enemies.find((enemy) => enemy.type === "nian");
  assert.ok(nian, "crossing the eight-minute boundary should spawn Nian");

  nian.x = run.player.x - 300;
  nian.y = run.player.y;
  nian.vx = 0;
  nian.vy = 0;
  nian.heading = 0;
  nian.attackCooldown = 0;
  nian.skillIndex = 0;
  nian.motion = "moving";
  nian.motionTime = 0;
  nian.action = undefined;
  nian.hp = 100_000;
  nian.maxHp = 100_000;

  const phases = new Set();
  let previousX = nian.x;
  let previousY = nian.y;
  let maximumDisplacement = 0;
  let damagedDuringLeap = false;
  let damagePreservedAction = false;

  for (let frame = 0; frame < 120; frame += 1) {
    const phaseBefore = nian.action?.phase;
    if (phaseBefore === "active" && !damagedDuringLeap) {
      const hpBefore = nian.hp;
      run.projectiles.push({
        id: run.serial++,
        owner: "sword",
        artKey: "test/nian-hit",
        tags: ["blade"],
        x: nian.x,
        y: nian.y,
        vx: 0,
        vy: 0,
        radius: nian.radius,
        damage: 1,
        life: 0.2,
        pierce: 1,
        homing: 0,
        markSeconds: 0,
        hitCooldown: 0.2,
        hitAt: new Map(),
        canProc: false,
      });
      survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
      damagedDuringLeap = nian.hp < hpBefore;
      damagePreservedAction =
        damagedDuringLeap &&
        nian.action?.kind === "nianLeap" &&
        nian.motion === "attacking";
    } else {
      survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
    }

    if (nian.action?.phase) phases.add(nian.action.phase);
    maximumDisplacement = Math.max(
      maximumDisplacement,
      Math.hypot(nian.x - previousX, nian.y - previousY),
    );
    previousX = nian.x;
    previousY = nian.y;
  }

  assert.deepEqual(
    [...phases],
    ["telegraph", "active", "impact", "recovery"],
  );
  assert.ok(damagedDuringLeap, "the injected projectile should damage Nian");
  assert.ok(
    damagePreservedAction,
    "taking damage must not cancel or replace the leap action state",
  );
  assert.ok(
    maximumDisplacement <= 80,
    `Nian moved ${maximumDisplacement.toFixed(2)}px in one 60Hz step`,
  );
});
