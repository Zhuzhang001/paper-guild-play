import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-combat-v6-"));
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
const curve = await bundle(
  "../app/game/content/difficultyCurve.ts",
  "difficulty-curve.mjs",
);
const enemies = await bundle(
  "../app/game/content/enemies.ts",
  "enemies.mjs",
);
process.on("exit", () =>
  rmSync(scratch, { recursive: true, force: true }),
);

function disableSideDirectors(run) {
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.midBossSpawned = true;
  run.finalBossSpawned = true;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  run.player.powerMultiplier = 0;
  run.testModifiers.incomingDamageScale = 0;
}

function makeEnemy(run, type) {
  const elite = type === "lion" || type === "puppet";
  return {
    id: run.serial++,
    type,
    x: run.player.x - 190,
    y: run.player.y,
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

test("four difficulty definitions and createRun runtime fields use authored values", () => {
  const expected = {
    normal: [5, 1, 1, 1, 1, 0.75, 1, 0.15, 0],
    hard: [4, 0.94, 0.75, 1.22, 1.06, 0.9, 1.2, 0.35, 0],
    extreme: [3, 0.88, 0.5, 1.48, 1.12, 1, 1.45, 0.6, 0.25],
    oneLife: [1, 0.82, 0, 1.7, 1.16, 1.1, 1.7, 0.75, 0.45],
  };
  for (const [id, values] of Object.entries(expected)) {
    const definition = difficulty.getDifficultyDefinition(id);
    assert.deepEqual(
      [
        definition.playerLife,
        definition.playerPower,
        definition.recoveryMultiplier,
        definition.enemyHpMultiplier,
        definition.enemySpeedMultiplier,
        definition.threatMultiplier,
        definition.bossMultiplier,
        definition.firstBossTraitChance,
        definition.secondBossTraitChance,
      ],
      values,
    );
    const run = survivor.createRun(new Set(), `difficulty-${id}`, {
      difficultyId: id,
      unlockedDifficultyIds: difficulty.DIFFICULTY_IDS,
    });
    assert.equal(run.difficultyId, id);
    assert.equal(run.player.life, definition.playerLife);
    assert.equal(run.player.maxLife, definition.playerLife);
    assert.equal(run.player.powerMultiplier, definition.playerPower);
    assert.equal(
      run.difficultyUnlockCandidate,
      definition.unlocks,
    );
  }
});

test("endless curve matches the 15/35/45/60/80 minute boundaries", () => {
  assert.equal(curve.specialProbability(0), 0.06);
  assert.equal(curve.specialProbability(15), 0.18);
  assert.ok(Math.abs(curve.specialProbability(80) - 0.98) < 1e-12);
  assert.equal(curve.bossConcurrency(34.999), 1);
  assert.equal(curve.bossConcurrency(35), 2);
  assert.equal(curve.bossConcurrency(60), 3);
  assert.equal(curve.post45Step(47.999), 0);
  assert.equal(curve.post45Step(48), 1);
  assert.equal(curve.post45Step(78), 11);
  assert.equal(curve.post45Step(200), 11);

  const normal = difficulty.getDifficultyDefinition("normal");
  const at78 = curve.sampleEndlessDifficulty(78, normal);
  assert.equal(at78.hpMultiplier, 1 + 0.045 * 11);
  assert.equal(at78.speedMultiplier, 1 + 0.01 * 11);
  assert.equal(at78.actionMultiplier, 1 + 0.018 * 11);
  assert.equal(at78.contactDamage, 3);

  let previous = 0;
  for (let minute = 0; minute <= 100; minute += 0.25) {
    const value = curve.specialProbability(minute);
    assert.ok(value >= previous - 1e-12);
    assert.ok(value <= 0.98);
    previous = value;
  }
});

test("non-Boss threat integrates per second and actor count is hard-capped at 150", () => {
  const run = survivor.createRun(new Set(), "linear-threat");
  disableSideDirectors(run);
  survivor.startEndless(run);
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;

  for (let frame = 0; frame < 600; frame += 1) {
    survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  }
  const accounted =
    run.endlessDirector.totalThreatSpent +
    run.endlessDirector.nonBossThreatBudget;
  const expected =
    12 * (10 + (0.0125 * 10 * 10) / (2 * 60)) *
    difficulty.getDifficultyDefinition("normal").threatMultiplier;
  assert.ok(
    Math.abs(accounted - expected) < 0.04,
    `threat integration drifted: ${accounted} vs ${expected}`,
  );

  run.endlessDirector.nonBossThreatBudget = 1_000;
  survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  for (let frame = 0; frame < 20; frame += 1) {
    survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  }
  assert.ok(run.enemies.length <= curve.ENDLESS_ACTOR_CAP);
});

test("all eight non-Boss archetypes enter their own authored action", () => {
  const ids = [
    ...enemies.COMMON_ENEMY_IDS,
    ...enemies.ELITE_ENEMY_IDS,
  ];
  assert.equal(ids.length, 8);
  assert.equal(
    new Set(ids.map((id) => enemies.getEnemyDefinition(id).skill.id)).size,
    8,
  );

  for (const type of ids) {
    const run = survivor.createRun(new Set(), `enemy-action-${type}`);
    disableSideDirectors(run);
    const enemy = makeEnemy(run, type);
    run.enemies = [enemy];
    survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
    assert.equal(enemy.action?.kind, "enemySkill", `${type} did not begin its skill`);
    assert.equal(
      enemy.action?.skillId,
      enemies.getEnemyDefinition(type).skill.id,
    );

    const startX = enemy.x;
    const startY = enemy.y;
    let sawAuthoredStrike = false;
    for (let frame = 0; frame < 120; frame += 1) {
      survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
      sawAuthoredStrike ||= run.strikes.some((strike) =>
        strike.artKey.startsWith(
          enemies.getEnemyDefinition(type).skill.artKey,
        ),
      );
    }
    const mode = enemies.getEnemyDefinition(type).skill.mode;
    if (["hop", "dash", "pounce"].includes(mode)) {
      assert.ok(
        Math.hypot(enemy.x - startX, enemy.y - startY) > 20,
        `${type} did not execute its movement action`,
      );
    } else {
      assert.ok(
        sawAuthoredStrike,
        `${type} did not emit its authored hostile pattern`,
      );
    }
  }
});

test("Boss budget supports three concurrent non-beast Bosses and excludes the recent two", () => {
  const run = survivor.createRun(new Set(), "boss-budget", {
    difficultyId: "oneLife",
    unlockedDifficultyIds: difficulty.DIFFICULTY_IDS,
  });
  disableSideDirectors(run);
  survivor.startEndless(run);
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  run.elapsed = run.endlessDirector.startedAt + 60 * 60;
  run.endlessDirector.bossBudget = 3;
  for (let index = 0; index < 3; index += 1) {
    run.endlessDirector.nonBossThreatBudget = curve.BOSS_THREAT_COST;
    run.endlessDirector.pendingBossSlot = true;
    survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  }
  const firstWave = run.enemies.filter((enemy) => enemy.endlessBossId);
  assert.equal(firstWave.length, 3);
  assert.equal(new Set(firstWave.map((enemy) => enemy.endlessBossId)).size, 3);
  assert.equal(
    firstWave.some((enemy) => enemy.type === "taotie" || enemy.type === "nian"),
    false,
  );
  assert.ok(
    firstWave.every(
      (enemy) =>
        (enemy.bossTraits?.length ?? 0) <= 2 &&
        new Set(enemy.bossTraits ?? []).size ===
          (enemy.bossTraits?.length ?? 0),
    ),
  );

  const excluded = new Set(run.endlessDirector.recentBossIds);
  for (const boss of firstWave) boss.hp = 0;
  run.endlessDirector.bossBudget = 1;
  run.endlessDirector.nonBossThreatBudget = curve.BOSS_THREAT_COST;
  run.endlessDirector.pendingBossSlot = true;
  survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  const replacement = run.enemies.find(
    (enemy) =>
      enemy.endlessBossId &&
      !firstWave.some((first) => first.id === enemy.id),
  );
  assert.ok(replacement);
  assert.equal(excluded.has(replacement.endlessBossId), false);
  assert.ok(run.enemies.length <= curve.ENDLESS_ACTOR_CAP);
});

test("a legitimate standard clear emits the next difficulty unlock, assisted clear does not", () => {
  function clearFinalBoss(assisted) {
    const run = survivor.createRun(new Set(), `difficulty-clear-${assisted}`, {
      difficultyId: "extreme",
      unlockedDifficultyIds: difficulty.DIFFICULTY_IDS,
    });
    run.elapsed = 479.99;
    run.midBossSpawned = true;
    run.spawnClock = Number.POSITIVE_INFINITY;
    run.testModifiers.assisted = assisted;
    survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
    const boss = run.enemies.find((enemy) => enemy.type === "nian");
    assert.ok(boss);
    boss.hp = 0;
    return survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  }

  const legitimate = clearFinalBoss(false);
  assert.ok(
    legitimate.some(
      (event) =>
        event.type === "difficultyClear" &&
        event.difficultyId === "extreme" &&
        event.unlocks === "oneLife",
    ),
  );
  assert.equal(
    clearFinalBoss(true).some((event) => event.type === "difficultyClear"),
    false,
  );
});

test("direct challenge slips change only their declared runtime values", () => {
  const plain = survivor.createRun(new Set(), "trial-plain");
  const thin = survivor.createRun(new Set(["thinPower"]), "trial-thin");
  assert.equal(thin.player.powerMultiplier, plain.player.powerMultiplier * 0.88);

  survivor.startEndless(plain);
  const rushed = survivor.createRun(new Set(["bossRush"]), "trial-boss-rush");
  survivor.startEndless(rushed);
  plain.elapsed = plain.endlessDirector.startedAt + 35 * 60;
  rushed.elapsed = rushed.endlessDirector.startedAt + 35 * 60;
  assert.equal(
    survivor.getEndlessDifficultySample(rushed).bossBudgetPerMinute,
    survivor.getEndlessDifficultySample(plain).bossBudgetPerMinute * 1.4,
  );

  const noRecovery = survivor.createRun(
    new Set(["noRecovery"]),
    "trial-no-recovery",
  );
  disableSideDirectors(noRecovery);
  noRecovery.player.life = 2;
  noRecovery.pickups.push({
    id: noRecovery.serial++,
    x: noRecovery.player.x,
    y: noRecovery.player.y,
    value: 2,
    age: 0,
    tier: 2,
    kind: "healingLeaf",
  });
  survivor.stepRun(noRecovery, 1 / 60, { x: 0, y: 0 });
  assert.equal(noRecovery.player.life, 2);
});

test("one-life removes recovery wards and cannot consume a lethal-save page", () => {
  const run = survivor.createRun(new Set(), "one-life-guard", {
    difficultyId: "oneLife",
    unlockedDifficultyIds: difficulty.DIFFICULTY_IDS,
  });
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.midBossSpawned = true;
  run.finalBossSpawned = true;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  run.endlessPerks = {
    ...run.endlessPerks,
    ranks: { ...run.endlessPerks.ranks, lastPaperGuard: 1 },
  };

  for (let index = 0; index < 40; index += 1) {
    assert.equal(
      survivor
        .getUpgradeChoices(run)
        .some(
          (option) =>
            option.kind === "utility" && option.modifierId === "paperWard",
        ),
      false,
    );
  }

  run.strikes.push({
    id: run.serial++,
    owner: "terminal",
    artKey: "test/one-life-lethal",
    x: run.player.x,
    y: run.player.y,
    radius: 30,
    damage: 1,
    delay: 0,
    maxDelay: 0,
    hostile: true,
  });
  survivor.stepRun(run, 1 / 60, { x: 0, y: 0 });
  assert.ok(run.player.life <= 0);
});
