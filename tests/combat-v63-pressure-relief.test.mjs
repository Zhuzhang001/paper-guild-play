import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-combat-v63-"));
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
const difficulty = await bundle(
  "../app/game/content/difficulty.ts",
  "difficulty.mjs",
);
const runtime = await bundle("../app/game/runtime/index.ts", "runtime.mjs");

process.on("exit", () =>
  rmSync(scratch, { recursive: true, force: true }),
);

const STILL = Object.freeze({ x: 0, y: 0 });
const DT = 1 / 60;

function quietRun(
  seed,
  { difficultyId = "normal", trials = [], vulnerable = false } = {},
) {
  const run = survivor.createRun(new Set(trials), seed, {
    difficultyId,
    unlockedDifficultyIds: difficulty.DIFFICULTY_IDS,
  });
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.midBossSpawned = true;
  run.finalBossSpawned = true;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  run.player.powerMultiplier = 0;
  run.testModifiers.incomingDamageScale = vulnerable ? 1 : 0;
  return run;
}

function enemyActor(
  run,
  type,
  {
    x = run.player.x - 190,
    y = run.player.y,
    boss = false,
    elite = type === "lion" || type === "puppet",
    hp = 100,
  } = {},
) {
  return {
    id: run.serial++,
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    heading: 0,
    travelled: 0,
    radius: boss ? 72 : elite ? 40 : 20,
    hp,
    maxHp: hp,
    speed: boss ? 34 : 50,
    turnSpeed: 5,
    damage: 1,
    elite,
    boss,
    bossTier: boss ? (type === "nian" ? "final" : "mid") : null,
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

function stepUntil(run, predicate, maxFrames = 600) {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    survivor.stepRun(run, DT, STILL);
    if (predicate()) return frame + 1;
  }
  assert.fail(`condition was not reached in ${maxFrames} frames`);
}

function addHostileStrike(run, overrides = {}) {
  run.strikes.push({
    id: run.serial++,
    owner: "terminal",
    artKey: "enemy/test/strike",
    x: run.player.x,
    y: run.player.y,
    radius: 30,
    damage: 1,
    delay: 0,
    maxDelay: 0,
    hostile: true,
    ...overrides,
  });
}

function activeSlotCount(run, dashOnly = false) {
  return new Set(
    run.enemies
      .map((enemy) => enemy.action)
      .filter(
        (action) =>
          action?.kind === "enemySkill" &&
          (!dashOnly || action.hostileTelegraph.movementKind !== "stationary"),
      )
      .map((action) => action.slotId),
  ).size;
}

function spawnStandardBoss(type, ability) {
  const run = quietRun(`v63-${type}-${ability}`);
  const boss = enemyActor(run, type, {
    boss: true,
    x: run.player.x - 320,
    y: run.player.y,
    hp: 10_000,
  });
  boss.skillIndex = ability;
  const ordinary = enemyActor(run, "lantern", {
    x: run.player.x + 210,
    y: run.player.y,
    hp: 10_000,
  });
  run.enemies = [ordinary, boss];
  survivor.stepRun(run, DT, STILL);
  return { run, boss, ordinary };
}

test("v6.3 pressure profiles lock refresh, skill/path slots, caps, and Boss background", () => {
  const expected = {
    normal: [0.75, 3, 1, 24, 0.3],
    hard: [0.9, 5, 2, 40, 0.5],
    extreme: [1, 8, 3, 60, 0.75],
    oneLife: [1.1, 10, 4, 80, 1],
  };
  for (const [difficultyId, values] of Object.entries(expected)) {
    const run = quietRun(`profile-${difficultyId}`, { difficultyId });
    const profile = survivor.getCombatPressureProfile(run);
    assert.deepEqual(
      [
        profile.spawnRateMultiplier,
        profile.enemySkillSlots,
        profile.enemyDashSlots,
        profile.hostileAttackCap,
        profile.bossBackgroundMultiplier,
      ],
      values,
    );
    assert.equal(profile.behaviorDifficultyId, difficultyId);
  }

  const trial = quietRun("profile-all-at-once", {
    difficultyId: "normal",
    trials: ["allAtOnce"],
  });
  assert.deepEqual(survivor.getCombatPressureProfile(trial), {
    spawnRateMultiplier: 0.75,
    enemySkillSlots: 5,
    enemyDashSlots: 2,
    hostileAttackCap: 40,
    bossBackgroundMultiplier: 0.3,
    behaviorDifficultyId: "hard",
  });

  const topTrial = quietRun("profile-all-at-once-top", {
    difficultyId: "oneLife",
    trials: ["allAtOnce"],
  });
  assert.equal(
    survivor.getCombatPressureProfile(topTrial).behaviorDifficultyId,
    "oneLife",
  );
  assert.equal(survivor.getCombatPressureProfile(topTrial).enemySkillSlots, 12);
});

test("standard refresh cadence and Boss-alive slowdown use the pressure profile", () => {
  for (const difficultyId of difficulty.DIFFICULTY_IDS) {
    const run = quietRun(`spawn-cadence-${difficultyId}`, { difficultyId });
    run.spawnClock = 0;
    survivor.stepRun(run, DT, STILL);
    const profile = survivor.getCombatPressureProfile(run);
    const expected = Math.max(
      0.18,
      (0.88 - run.elapsed * 0.00072) / profile.spawnRateMultiplier,
    );
    assert.ok(Math.abs(run.spawnClock - expected) < 1e-9);
  }

  const withBoss = quietRun("spawn-cadence-boss");
  const boss = enemyActor(withBoss, "nian", { boss: true, hp: 10_000 });
  boss.attackCooldown = Number.POSITIVE_INFINITY;
  withBoss.enemies = [boss];
  withBoss.spawnClock = 0;
  survivor.stepRun(withBoss, DT, STILL);
  const profile = survivor.getCombatPressureProfile(withBoss);
  const expected =
    (0.88 - withBoss.elapsed * 0.00072) /
    (profile.spawnRateMultiplier * profile.bossBackgroundMultiplier);
  assert.ok(Math.abs(withBoss.spawnClock - expected) < 1e-9);

  const spawningBoss = quietRun("spawn-cadence-new-boss");
  spawningBoss.elapsed = survivor.STANDARD_SECONDS - 0.01;
  spawningBoss.finalBossSpawned = false;
  spawningBoss.spawnClock = 0;
  survivor.stepRun(spawningBoss, DT, STILL);
  const spawnedBosses = spawningBoss.enemies.filter((enemy) => enemy.boss);
  assert.deepEqual(spawnedBosses.map((enemy) => enemy.type), ["nian"]);
  const spawnedProfile = survivor.getCombatPressureProfile(spawningBoss);
  const spawnedExpected =
    (0.88 - spawningBoss.elapsed * 0.00072) /
    (spawnedProfile.spawnRateMultiplier *
      spawnedProfile.bossBackgroundMultiplier);
  assert.ok(Math.abs(spawningBoss.spawnClock - spawnedExpected) < 1e-9);
});

test("ordinary skill and authored movement groups stop exactly at each tier cap", () => {
  const tiers = {
    normal: [3, 1],
    hard: [5, 2],
    extreme: [8, 3],
    oneLife: [10, 4],
  };
  for (const [difficultyId, [skillSlots, dashSlots]] of Object.entries(tiers)) {
    const stationary = quietRun(`skill-slots-${difficultyId}`, { difficultyId });
    stationary.enemies = Array.from({ length: 14 }, (_, index) =>
      enemyActor(stationary, "lantern", {
        x: stationary.player.x - 210 + index * 2,
      }),
    );
    survivor.stepRun(stationary, DT, STILL);
    assert.equal(activeSlotCount(stationary), skillSlots);

    const moving = quietRun(`dash-slots-${difficultyId}`, { difficultyId });
    moving.enemies = Array.from({ length: 14 }, (_, index) =>
      enemyActor(moving, "fish", {
        x: moving.player.x - 205 + index * 2,
      }),
    );
    survivor.stepRun(moving, DT, STILL);
    assert.equal(activeSlotCount(moving, true), dashSlots);
  }

  const trial = quietRun("skill-slots-all-at-once", {
    trials: ["allAtOnce"],
  });
  trial.enemies = Array.from({ length: 12 }, (_, index) =>
    enemyActor(trial, "lantern", { x: trial.player.x - 210 + index * 2 }),
  );
  survivor.stepRun(trial, DT, STILL);
  assert.equal(activeSlotCount(trial), 5);
});

test("hostile actors obey the hard cap while Boss warnings replace ordinary saturation", () => {
  for (const difficultyId of difficulty.DIFFICULTY_IDS) {
    const run = quietRun(`attack-cap-${difficultyId}`, { difficultyId });
    const cap = survivor.getCombatPressureProfile(run).hostileAttackCap;
    for (let index = 0; index < cap - 2; index += 1) {
      addHostileStrike(run, {
        x: 20,
        y: 20,
        delay: 999,
        maxDelay: 999,
      });
    }
    run.enemies = [enemyActor(run, "abacus")];
    stepUntil(
      run,
      () => run.strikes.filter((strike) => strike.hostile).length === cap,
      120,
    );
    assert.equal(run.strikes.filter((strike) => strike.hostile).length, cap);
  }

  const saturated = quietRun("boss-warning-priority");
  const cap = survivor.getCombatPressureProfile(saturated).hostileAttackCap;
  for (let index = 0; index < cap; index += 1) {
    addHostileStrike(saturated, {
      x: 20,
      y: 20,
      delay: 999,
      maxDelay: 999,
    });
  }
  const boss = enemyActor(saturated, "nian", {
    boss: true,
    x: saturated.player.x - 320,
    hp: 10_000,
  });
  boss.skillIndex = 1;
  saturated.enemies = [boss];
  survivor.stepRun(saturated, DT, STILL);
  assert.equal(saturated.strikes.filter((strike) => strike.hostile).length, cap);
  assert.equal(
    saturated.strikes.filter((strike) =>
      strike.artKey.startsWith("boss/nian/meteor-"),
    ).length,
    3,
  );
});

test("life segments preserve source and trigger light then strong hit relief", () => {
  const run = quietRun("life-segment-relief", { vulnerable: true });
  assert.deepEqual(
    run.player.lifeSegments.map((segment) => segment.relief),
    ["light", "light", "light", "strong", "strong"],
  );

  const common = enemyActor(run, "cup", { x: run.player.x + 40 });
  const elite = enemyActor(run, "lion", {
    x: run.player.x + 100,
    elite: true,
  });
  const boss = enemyActor(run, "nian", {
    x: run.player.x + 150,
    boss: true,
  });
  common.motion = elite.motion = boss.motion = "attacking";
  common.attackCooldown = elite.attackCooldown = boss.attackCooldown = 0;
  run.enemies = [common, elite, boss];
  run.fx.push({
    id: run.serial++,
    kind: "warning",
    x: run.player.x,
    y: run.player.y,
    radius: 80,
    life: 2,
    color: "#000",
    artKey: "enemy/test/warning",
  });
  run.strikes.push({
    id: run.serial++,
    owner: "sword",
    artKey: "test/player-strike",
    x: 10,
    y: 10,
    radius: 5,
    damage: 0,
    delay: 999,
    maxDelay: 999,
    hostile: false,
  });
  addHostileStrike(run);
  addHostileStrike(run, { artKey: "enemy/test/same-frame-second" });
  survivor.stepRun(run, DT, STILL);
  assert.equal(run.player.life, 4);
  assert.equal(run.lastHitRelief, "light");
  assert.equal(run.strikes.some((strike) => strike.hostile), false);
  assert.equal(run.strikes.some((strike) => !strike.hostile), true);
  assert.equal(run.fx.some((fx) => fx.kind === "warning"), false);
  assert.ok(run.enemies.every((enemy) => enemy.action === undefined));
  assert.ok(Math.hypot(common.x - run.player.x, common.y - run.player.y) > 180);
  assert.equal(common.hp, 100);
  assert.equal(elite.hp, 100);
  assert.equal(boss.hp, 100);

  for (let index = 0; index < 2; index += 1) {
    run.player.invulnerability = 0;
    addHostileStrike(run);
    survivor.stepRun(run, DT, STILL);
    assert.equal(run.lastHitRelief, "light");
  }

  const strongCommon = enemyActor(run, "cup", {
    x: run.player.x + 80,
    hp: 100,
  });
  const strongElite = enemyActor(run, "lion", {
    x: run.player.x + 120,
    elite: true,
    hp: 100,
  });
  const strongBoss = enemyActor(run, "nian", {
    x: run.player.x + 160,
    boss: true,
    hp: 100,
  });
  const fragileElite = enemyActor(run, "puppet", {
    x: run.player.x + 140,
    elite: true,
    hp: 100,
  });
  fragileElite.hp = 0.5;
  run.enemies = [strongCommon, strongElite, fragileElite, strongBoss];
  const killsBefore = run.kills;
  run.player.invulnerability = 0;
  addHostileStrike(run);
  survivor.stepRun(run, DT, STILL);
  assert.equal(run.lastHitRelief, "strong");
  assert.equal(run.kills, killsBefore + 1);
  assert.equal(run.enemies.includes(strongCommon), false);
  assert.equal(strongElite.hp, 55);
  assert.equal(fragileElite.hp, 0.5);
  assert.equal(strongBoss.hp, 100);
  assert.ok(strongElite.hp >= 1);
});

test("guards do not trigger relief, while travel-note life heals as the same light segment", () => {
  const guarded = quietRun("guard-no-relief", { vulnerable: true });
  const caster = enemyActor(guarded, "lantern");
  guarded.enemies = [caster];
  survivor.stepRun(guarded, DT, STILL);
  assert.equal(caster.action?.kind, "enemySkill");
  guarded.testModifiers.incomingDamageScale = 1;
  guarded.perkCombat.temporaryGuardCharges = 1;
  guarded.perkCombat.temporaryGuardUntil = guarded.elapsed + 2;
  addHostileStrike(guarded);
  survivor.stepRun(guarded, DT, STILL);
  assert.equal(guarded.player.life, guarded.player.maxLife);
  assert.equal(guarded.lastHitRelief, undefined);
  assert.equal(caster.action?.kind, "enemySkill");

  const invulnerable = quietRun("invulnerability-no-relief", {
    vulnerable: true,
  });
  const activeEnemy = enemyActor(invulnerable, "lantern");
  invulnerable.enemies = [activeEnemy];
  survivor.stepRun(invulnerable, DT, STILL);
  invulnerable.player.invulnerability = 1;
  addHostileStrike(invulnerable);
  survivor.stepRun(invulnerable, DT, STILL);
  assert.equal(invulnerable.player.life, invulnerable.player.maxLife);
  assert.equal(invulnerable.lastHitRelief, undefined);
  assert.equal(activeEnemy.action?.kind, "enemySkill");

  const noted = quietRun("travel-note-life-source", { vulnerable: true });
  const paperWard = runtime.getTravelNoteDefinition("paperWard");
  survivor.applyUpgrade(noted, {
    id: "v63-paper-ward",
    kind: "utility",
    modifierId: "paperWard",
    travelNoteId: "paperWard",
    travelNoteCategory: paperWard.category,
    slotCategory: paperWard.category,
    currentRank: 0,
    nextRank: 1,
    masteryRank: paperWard.masteryRank,
    title: paperWard.name,
    description: paperWard.description,
    artKey: paperWard.artKey,
  });
  assert.deepEqual(
    {
      source: noted.player.lifeSegments[0].source,
      relief: noted.player.lifeSegments[0].relief,
      value: noted.player.lifeSegments[0].value,
    },
    { source: "travelNote", relief: "light", value: 1 },
  );
  addHostileStrike(noted);
  survivor.stepRun(noted, DT, STILL);
  assert.equal(noted.player.lifeSegments[0].value, 0);
  assert.equal(noted.lastHitRelief, "light");

  noted.pickups.push({
    id: noted.serial++,
    x: noted.player.x,
    y: noted.player.y,
    value: 1,
    age: 0,
    tier: 1,
    kind: "healingLeaf",
  });
  survivor.stepRun(noted, DT, STILL);
  assert.deepEqual(
    {
      source: noted.player.lifeSegments[0].source,
      relief: noted.player.lifeSegments[0].relief,
      value: noted.player.lifeSegments[0].value,
    },
    { source: "travelNote", relief: "light", value: 1 },
  );
});

test("standard Boss secondary skills are fully warned and leave authored escape space", () => {
  const coordinatorRace = quietRun("boss-coordinator-cooldown-crossing");
  const racingOrdinary = enemyActor(coordinatorRace, "lantern", {
    x: coordinatorRace.player.x + 210,
    hp: 10_000,
  });
  const racingBoss = enemyActor(coordinatorRace, "nian", {
    boss: true,
    x: coordinatorRace.player.x - 320,
    hp: 10_000,
  });
  racingBoss.attackCooldown = 0.01;
  coordinatorRace.enemies = [racingOrdinary, racingBoss];
  survivor.stepRun(coordinatorRace, DT, STILL);
  assert.equal(racingOrdinary.action, undefined);
  assert.equal(racingBoss.action?.kind, "nianLeap");

  const meteor = spawnStandardBoss("nian", 1);
  assert.equal(meteor.ordinary.action, undefined);
  const meteors = meteor.run.strikes.filter((strike) =>
    strike.artKey.startsWith("boss/nian/meteor-"),
  );
  assert.equal(meteors.length, 3);
  assert.ok(
    meteors.every(
      (strike) =>
        strike.maxDelay === survivor.NIAN_METEOR_TELEGRAPH_SECONDS,
    ),
  );
  const safeX = meteor.run.player.x;
  assert.ok(
    meteors.every(
      (strike) =>
        Math.abs(strike.x - safeX) - strike.radius - 18 >=
        survivor.NIAN_METEOR_SAFE_CORRIDOR / 2,
    ),
  );

  stepUntil(
    meteor.run,
    () =>
      meteor.boss.motion === "moving" &&
      meteor.run.enemySkillBreatherUntil > meteor.run.elapsed,
  );
  assert.equal(meteor.ordinary.action, undefined);
  while (meteor.run.elapsed + DT < meteor.run.enemySkillBreatherUntil) {
    survivor.stepRun(meteor.run, DT, STILL);
    assert.equal(meteor.ordinary.action, undefined);
  }
  stepUntil(meteor.run, () => meteor.ordinary.action?.kind === "enemySkill", 6);

  const ring = spawnStandardBoss("nian", 2);
  const ringStrikes = ring.run.strikes.filter(
    (strike) => strike.artKey === "boss/nian/ring-spin",
  );
  assert.ok(ringStrikes.length >= 8);
  const safeAngle = Math.atan2(
    ring.run.player.y - ring.boss.y,
    ring.run.player.x - ring.boss.x,
  );
  const wrapped = (angle) =>
    Math.atan2(Math.sin(angle), Math.cos(angle));
  const closestCenter = Math.min(
    ...ringStrikes.map((strike) =>
      Math.abs(
        wrapped(
          Math.atan2(strike.y - ring.boss.y, strike.x - ring.boss.x) -
            safeAngle,
        ),
      ),
    ),
  );
  const physicalHalfWidth = Math.asin(
    ringStrikes[0].radius /
      Math.hypot(
        ringStrikes[0].x - ring.boss.x,
        ringStrikes[0].y - ring.boss.y,
      ),
  );
  const safeGapDegrees =
    (2 * (closestCenter - physicalHalfWidth) * 180) / Math.PI;
  assert.ok(safeGapDegrees >= survivor.NIAN_RING_SAFE_GAP_DEGREES);

  const shock = spawnStandardBoss("taotie", 1);
  const shockStrike = shock.run.strikes.find(
    (strike) => strike.artKey === "boss/taotie/shock",
  );
  assert.ok(shockStrike);
  assert.equal(shockStrike.maxDelay, 1);

  const suction = spawnStandardBoss("taotie", 2);
  const start = {
    x: survivor.GAME_WIDTH / 2,
    y: survivor.GAME_HEIGHT / 2,
  };
  const lanes = suction.run.strikes.filter((strike) =>
    strike.artKey.startsWith("boss/taotie/suction-lane-"),
  );
  assert.equal(lanes.length, 3);
  assert.ok(Math.hypot(suction.run.player.x - start.x, suction.run.player.y - start.y) < 2);
  const dx = suction.run.player.x - suction.boss.x;
  const dy = suction.run.player.y - suction.boss.y;
  const length = Math.hypot(dx, dy);
  const midpoint = {
    x: suction.boss.x + dx * 0.65,
    y: suction.boss.y + dy * 0.65,
  };
  for (const side of [-1, 1]) {
    const escape = {
      x: midpoint.x + (-dy / length) * 170 * side,
      y: midpoint.y + (dx / length) * 170 * side,
    };
    assert.ok(
      lanes.every(
        (strike) =>
          Math.hypot(strike.x - escape.x, strike.y - escape.y) > strike.radius,
      ),
    );
  }
});

test("hit relief interrupts a moving endless Boss before its follow-up is emitted", () => {
  const run = quietRun("endless-boss-hit-interrupt", { vulnerable: true });
  survivor.startEndless(run);
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  run.endlessDirector.nonBossThreatBudget = Number.NEGATIVE_INFINITY;
  run.endlessDirector.bossBudget = 0;
  assert.equal(
    survivor.spawnEndlessBossForTest(run, "troupeMaster", []),
    true,
  );
  const boss = run.enemies.find(
    (enemy) => enemy.endlessBossId === "troupeMaster",
  );
  assert.ok(boss);
  boss.x = run.player.x - 300;
  boss.y = run.player.y;
  boss.attackCooldown = 0;
  boss.skillIndex = 0;
  boss.action = undefined;

  let hit = false;
  for (let frame = 0; frame < 180 && !hit; frame += 1) {
    const events = survivor.stepRun(run, DT, STILL);
    hit ||= events.some((event) => event.type === "playerHit");
  }
  assert.equal(hit, true);
  assert.equal(run.lastHitRelief, "light");
  assert.equal(boss.action, undefined);
  assert.equal(boss.motion, "hurt");
  assert.equal(
    run.strikes.some((strike) => strike.artKey.includes("mask-fan")),
    false,
  );
});

test("settleRunProgression advances no combat state and stops at one player choice", () => {
  const synergyChoice = quietRun("settle-synergy-choice");
  synergyChoice.build = {
    ...synergyChoice.build,
    weapons: [
      { id: "scissors", level: 3, routeId: "scissors:a" },
      { id: "abacus", level: 3, routeId: "abacus:a" },
      { id: "crossbow", level: 3, routeId: "crossbow:a" },
      { id: "inkline", level: 3, routeId: "inkline:a" },
    ],
    synergyCapacity: 3,
  };
  synergyChoice.player.xp = 100;
  const choiceEvents = survivor.settleRunProgression(synergyChoice);
  assert.deepEqual(choiceEvents.map((event) => event.type), ["synergyChoice"]);
  assert.equal(synergyChoice.player.level, 1);
  assert.equal(synergyChoice.player.xp, 100);
  assert.deepEqual(survivor.settleRunProgression(synergyChoice), []);
  assert.equal(synergyChoice.player.level, 1);
  assert.equal(synergyChoice.player.xp, 100);

  const run = quietRun("settle-one-choice");
  const enemy = enemyActor(run, "cup", { hp: 1_000 });
  run.enemies = [enemy];
  addHostileStrike(run, { x: 20, y: 20, delay: 9, maxDelay: 9 });
  run.player.xp = 100;
  const before = {
    elapsed: run.elapsed,
    spawnClock: run.spawnClock,
    enemyX: enemy.x,
    enemyCooldown: enemy.attackCooldown,
    strikeDelay: run.strikes[0].delay,
  };
  const events = survivor.settleRunProgression(run);
  assert.deepEqual(events.map((event) => event.type), ["upgrade"]);
  assert.equal(run.player.level, 2);
  assert.deepEqual(
    {
      elapsed: run.elapsed,
      spawnClock: run.spawnClock,
      enemyX: enemy.x,
      enemyCooldown: enemy.attackCooldown,
      strikeDelay: run.strikes[0].delay,
    },
    before,
  );

  const complete = quietRun("settle-surplus-pages");
  complete.build.weapons = [
    { id: "sword", level: 5, routeId: "sword:a", masteryId: "sword:a:focus" },
    { id: "umbrella", level: 5, routeId: "umbrella:a", masteryId: "umbrella:a:focus" },
    { id: "scissors", level: 5, routeId: "scissors:a", masteryId: "scissors:a:focus" },
    { id: "crossbow", level: 5, routeId: "crossbow:b", masteryId: "crossbow:b:focus" },
  ];
  complete.build.travelNotes = Object.fromEntries(
    runtime.TRAVEL_NOTE_DEFINITIONS.map((note) => [note.id, note.masteryRank]),
  );
  complete.player.xp = 100;
  const surplusEvents = survivor.settleRunProgression(complete);
  assert.equal(surplusEvents.some((event) => event.type === "upgrade"), false);
  assert.ok(complete.surplusPages >= 5);
  assert.ok(complete.player.xp < complete.player.nextXp);
});
