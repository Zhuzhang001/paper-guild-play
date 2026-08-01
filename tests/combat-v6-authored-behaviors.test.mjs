import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-authored-combat-"));
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
const enemies = await bundle(
  "../app/game/content/enemies.ts",
  "enemies.mjs",
);
const bosses = await bundle(
  "../app/game/content/bosses.ts",
  "bosses.mjs",
);
process.on("exit", () =>
  rmSync(scratch, { recursive: true, force: true }),
);

function quietRun(seed) {
  const run = survivor.createRun(new Set(), seed);
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.midBossSpawned = true;
  run.finalBossSpawned = true;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  run.player.powerMultiplier = 0;
  run.testModifiers.incomingDamageScale = 0;
  return run;
}

function enemyActor(run, type, x = run.player.x - 190, y = run.player.y) {
  const elite = type === "lion" || type === "puppet";
  return {
    id: run.serial++,
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    heading: 0,
    travelled: 0,
    radius: elite ? 40 : 20,
    hp: 100_000,
    maxHp: 100_000,
    speed: 50,
    turnSpeed: 5,
    damage: 1,
    elite,
    boss: false,
    bossTier: null,
    hitFlash: 0,
    marked: 0,
    markMultiplier: 1,
    markStacks: 0,
    slow: 0,
    motion: "moving",
    motionTime: 0,
    attackCooldown: 0,
    attackCommitted: false,
    skillIndex: 0,
    intrusionAvatar: false,
    actionSpeed: 1,
  };
}

function stepFrames(run, frames, input = { x: 0, y: 0 }) {
  const events = [];
  for (let frame = 0; frame < frames; frame += 1) {
    events.push(...survivor.stepRun(run, 1 / 60, input));
  }
  return events;
}

test("eight enemy definitions carry eight authored gameplay behaviors", () => {
  const ids = [...enemies.COMMON_ENEMY_IDS, ...enemies.ELITE_ENEMY_IDS];
  const behaviors = ids.map(
    (id) => enemies.getEnemyDefinition(id).skill.behavior,
  );
  assert.equal(new Set(behaviors).size, 8);
  assert.deepEqual(behaviors, [
    "cupLandingRipple",
    "pairedShoeCross",
    "lanternSlowFire",
    "fishFlyby",
    "abacusThreeFive",
    "umbrellaGuard",
    "lionChargeRoar",
    "puppetTripwire",
  ]);
});

test("shoe creates a linked opposite partner and both cross the locked point", () => {
  const run = quietRun("shoe-pair");
  const shoe = enemyActor(run, "shoe");
  run.enemies = [shoe];
  survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  const partner = run.enemies.find((enemy) => enemy.id === shoe.partnerId);
  assert.ok(partner);
  assert.equal(partner.partnerId, shoe.id);
  assert.equal(shoe.action?.skillId, "shoe-dash");
  assert.equal(partner.action?.skillId, "shoe-dash");
  assert.ok(shoe.action.targetX > run.player.x);
  assert.ok(partner.action.targetX < run.player.x);
  stepFrames(run, 45);
  assert.ok(shoe.travelled > 250);
  assert.ok(partner.travelled > 250);
});

test("lantern holds range and releases exactly three moving slow fires", () => {
  const run = quietRun("lantern-fire");
  const lantern = enemyActor(run, "lantern", run.player.x - 180);
  lantern.attackCooldown = 999;
  run.enemies = [lantern];
  stepFrames(run, 45);
  assert.ok(
    lantern.vx < 0,
    `a close lantern should retreat from the player: x=${lantern.x}, vx=${lantern.vx}, heading=${lantern.heading}`,
  );

  lantern.attackCooldown = 0;
  stepFrames(run, 50);
  const fires = run.strikes.filter((strike) =>
    strike.artKey.includes("lantern/burst/slow-fire"),
  );
  assert.equal(fires.length, 3);
  assert.ok(fires.every((strike) => strike.contactOnly));
  assert.ok(fires.every((strike) => Math.hypot(strike.velocityX, strike.velocityY) > 100));
});

test("fish flies beyond the playfield and then steers back in", () => {
  const run = quietRun("fish-flyby");
  const fish = enemyActor(run, "fish", run.player.x - 190, run.player.y);
  run.enemies = [fish];
  stepFrames(run, 45);
  assert.ok(
    fish.x < 0 || fish.x > survivor.GAME_WIDTH || fish.y < 0 || fish.y > survivor.GAME_HEIGHT,
    `fish never left the playfield: ${fish.x}, ${fish.y}`,
  );
  let reentered = false;
  for (let frame = 0; frame < 180; frame += 1) {
    survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
    reentered ||=
      fish.x >= 0 &&
      fish.x <= survivor.GAME_WIDTH &&
      fish.y >= 0 &&
      fish.y <= survivor.GAME_HEIGHT;
  }
  assert.equal(
    reentered,
    true,
    `the flyby actor should re-enter the playfield: x=${fish.x}, y=${fish.y}, heading=${fish.heading}`,
  );
});

test("abacus alternates three- and five-pearl rows", () => {
  const run = quietRun("abacus-rhythm");
  const abacus = enemyActor(run, "abacus");
  run.enemies = [abacus];
  const counts = [];
  for (let turn = 0; turn < 2; turn += 1) {
    run.strikes.length = 0;
    abacus.attackCooldown = 0;
    let peak = 0;
    for (let frame = 0; frame < 100; frame += 1) {
      survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
      peak = Math.max(
        peak,
        run.strikes.filter((strike) =>
          strike.artKey.includes("abacus/broadside/strike"),
        ).length,
      );
      if (!abacus.action && abacus.attackCooldown > 0) break;
    }
    counts.push(peak);
  }
  assert.deepEqual(counts, [3, 5]);
});

test("umbrella guard and lion roar change nearby actors, puppet only closes on crossing", () => {
  const guardRun = quietRun("rib-guard");
  const rib = enemyActor(guardRun, "rib");
  const ward = enemyActor(guardRun, "cup", rib.x + 35, rib.y + 25);
  ward.attackCooldown = 999;
  guardRun.enemies = [rib, ward];
  stepFrames(guardRun, 80);
  assert.ok(ward.guardedUntil > guardRun.elapsed);
  assert.equal(typeof ward.guardFacing, "number");

  const roarRun = quietRun("lion-roar");
  const lion = enemyActor(roarRun, "lion");
  const follower = enemyActor(roarRun, "cup", lion.x + 60, lion.y);
  follower.attackCooldown = 999;
  roarRun.enemies = [lion, follower];
  stepFrames(roarRun, 105);
  assert.ok(follower.ralliedUntil > roarRun.elapsed);

  const wireRun = quietRun("puppet-wire");
  const puppet = enemyActor(wireRun, "puppet");
  wireRun.enemies = [puppet];
  survivor.stepRun(wireRun, 1 / 60, { x: 0, y: 0 });
  const action = puppet.action;
  assert.equal(action?.skillId, "puppet-volley");
  assert.equal(action?.committed, false);
  stepFrames(wireRun, 45);
  const side = action.previousPlayerSide;
  wireRun.player.x = action.lineX1 + (action.lineY2 - action.lineY1) * 0.35;
  wireRun.player.y = action.lineY1 - (action.lineX2 - action.lineX1) * 0.35;
  if (
    Math.sign(
      (action.lineX2 - action.lineX1) * (wireRun.player.y - action.lineY1) -
        (action.lineY2 - action.lineY1) * (wireRun.player.x - action.lineX1),
    ) === Math.sign(side)
  ) {
    wireRun.player.x = action.lineX1 - (action.lineY2 - action.lineY1) * 0.35;
    wireRun.player.y = action.lineY1 + (action.lineX2 - action.lineX1) * 0.35;
  }
  survivor.stepRun(wireRun, 1 / 60, { x: 0, y: 0 });
  assert.equal(action.committed, true);
  assert.ok(
    wireRun.fx.some((fx) => fx.artKey.includes("puppet/volley/close")),
  );
});

test("six Bosses expose eighteen distinct actions and switch at half health", () => {
  const behaviorIds = bosses.ENDLESS_BOSS_IDS.flatMap((id) =>
    bosses.getEndlessBoss(id).skills.map((skill) => skill.behavior),
  );
  assert.equal(behaviorIds.length, 18);
  assert.equal(new Set(behaviorIds).size, 18);

  for (const bossId of bosses.ENDLESS_BOSS_IDS) {
    const run = quietRun(`boss-${bossId}`);
    survivor.startEndless(run);
    run.forgeAt = Number.POSITIVE_INFINITY;
    run.intrusionAt = Number.POSITIVE_INFINITY;
    run.endlessDirector.nonBossThreatBudget = Number.NEGATIVE_INFINITY;
    const events = [];
    assert.equal(survivor.spawnEndlessBossForTest(run, bossId, events), true);
    const boss = run.enemies.find((enemy) => enemy.endlessBossId === bossId);
    assert.ok(boss);
    boss.x = run.player.x - 220;
    boss.y = run.player.y;
    const seenSkills = new Set();
    const seenArt = new Set();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      boss.attackCooldown = 0;
      for (let frame = 0; frame < 180; frame += 1) {
        survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
        if (boss.action?.kind === "endlessBossSkill") {
          seenSkills.add(boss.action.skillId);
        }
        for (const strike of run.strikes) seenArt.add(strike.artKey);
        for (const fx of run.fx) seenArt.add(fx.artKey);
        for (const actor of run.enemies) {
          if (actor.artKey) seenArt.add(actor.artKey);
        }
        if (!boss.action && boss.attackCooldown > 0) break;
      }
    }
    assert.equal(seenSkills.size, 3, `${bossId} did not cycle three skills`);
    for (const skill of bosses.getEndlessBoss(bossId).skills) {
      assert.ok(
        [...seenArt].some(
          (artKey) =>
            artKey.startsWith(skill.artKey) &&
            !artKey.endsWith("/warning") &&
            !artKey.endsWith("/finish"),
        ),
        `${bossId}/${skill.id} emitted no authored visual event`,
      );
    }

    boss.hp = boss.maxHp * 0.49;
    boss.attackCooldown = 5;
    survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
    assert.equal(boss.bossPhase, 2);
    assert.ok(
      run.fx.some((fx) => fx.artKey.endsWith("/half-health")),
      `${bossId} emitted no half-health change cue`,
    );
  }
});

test("six hostile celestial events produce six different battlefield signatures", () => {
  const ids = [
    "thunderTrial",
    "galeTrial",
    "fireTrial",
    "frostTrial",
    "ghostMarch",
    "eclipseTrial",
  ];
  const signatures = [];
  for (const id of ids) {
    const run = quietRun(`celestial-${id}`);
    const cadence = survivor.emitCelestialHazard(run, id);
    const celestialEnemies = run.enemies.filter(
      (enemy) => enemy.celestialSourceId === id,
    );
    signatures.push(
      JSON.stringify({
        strikes: run.strikes.length,
        moving: run.strikes.filter((strike) => strike.contactOnly).length,
        enemies: celestialEnemies.length,
        fx: run.fx.map((fx) => fx.kind),
        cadence,
      }),
    );
  }
  assert.equal(new Set(signatures).size, 6);
  assert.match(signatures[0], /"strikes":4/);
  assert.match(signatures[1], /"moving":3/);
  assert.match(signatures[2], /"strikes":6/);
  assert.match(signatures[3], /"strikes":10/);
  assert.match(signatures[4], /"enemies":5/);
  assert.match(signatures[5], /"strikes":8/);
});

test("difficulty Boss multiplier affects budget, not Boss hit points twice", () => {
  function bossHp(difficultyId) {
    const run = survivor.createRun(new Set(), `boss-hp-${difficultyId}`, {
      difficultyId,
      unlockedDifficultyIds: ["normal", "hard", "extreme", "oneLife"],
    });
    survivor.startEndless(run);
    run.spawnClock = Number.POSITIVE_INFINITY;
    run.forgeAt = Number.POSITIVE_INFINITY;
    run.intrusionAt = Number.POSITIVE_INFINITY;
    survivor.spawnEndlessBossForTest(run, "chiefClerk", []);
    return run.enemies.find((enemy) => enemy.endlessBossId === "chiefClerk")
      .maxHp;
  }
  const normal = bossHp("normal");
  const hard = bossHp("hard");
  assert.ok(Math.abs(hard / normal - 1.22) < 1e-10);
});
