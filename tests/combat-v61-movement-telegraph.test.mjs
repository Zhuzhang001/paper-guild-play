import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-combat-v61-"));
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
const renderSource = readFileSync(
  new URL("../app/game/renderGame.ts", import.meta.url),
  "utf8",
);

process.on("exit", () =>
  rmSync(scratch, { recursive: true, force: true }),
);

const DT = 1 / 240;
const STILL = Object.freeze({ x: 0, y: 0 });

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function quietRun(seed, { vulnerable = false } = {}) {
  const run = survivor.createRun(new Set(), seed);
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
  x = run.player.x - 190,
  y = run.player.y,
) {
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

function beginEnemyAction(run, enemy) {
  run.enemies = [enemy];
  survivor.stepRun(run, 1 / 60, STILL);
  assert.equal(enemy.action?.kind, "enemySkill");
  return enemy.action;
}

function stepUntil(run, predicate, maxFrames = 1_200, delta = DT) {
  const events = [];
  for (let frame = 0; frame < maxFrames; frame += 1) {
    events.push(...survivor.stepRun(run, delta, STILL));
    if (predicate()) return { elapsed: (frame + 1) * delta, events };
  }
  assert.fail(`condition was not reached in ${maxFrames} frames`);
}

function assertLockedTelegraph(action, expectedKind, expectedMovementKind) {
  const path = action?.hostileTelegraph;
  assert.ok(path, "the action must carry its renderable path telegraph");
  assert.equal(path.locked, true);
  assert.equal(path.kind, expectedKind);
  assert.equal(path.movementKind, expectedMovementKind);
  assert.equal(path.startX, action.startX);
  assert.equal(path.startY, action.startY);
  assert.equal(path.targetX, action.targetX);
  assert.equal(path.targetY, action.targetY);
  assert.ok(path.radius > 0);
  assert.match(path.artKey, /warning/);
}

test("v6.1 movement definitions preserve authored distance semantics", () => {
  assert.deepEqual(enemies.getEnemyDefinition("cup").skill.movement, {
    kind: "landShort",
    maxTravel: 110,
    minTravel: 64,
    clearance: 8,
    closeFallback: { kind: "stomp" },
  });
  assert.deepEqual(enemies.getEnemyDefinition("shoe").skill.movement, {
    kind: "crossTarget",
    maxTravel: 360,
    overshoot: 88,
    clearance: 8,
    sweptDamage: true,
  });
  assert.deepEqual(enemies.getEnemyDefinition("rib").skill.movement, {
    kind: "landShort",
    maxTravel: 145,
    minTravel: 64,
    clearance: 8,
    closeFallback: { kind: "sideHop", distance: 64 },
  });
  assert.deepEqual(enemies.getEnemyDefinition("fish").skill.movement, {
    kind: "flyby",
    exitMargin: 64,
    arcHeight: 44,
    sweptDamage: true,
  });
});

test("cup travels at most 110 and turns a too-close hop into a landing stomp", () => {
  const farRun = quietRun("v61-cup-far");
  const farCup = enemyActor(
    farRun,
    "cup",
    farRun.player.x - 220,
    farRun.player.y,
  );
  const farAction = beginEnemyAction(farRun, farCup);
  assert.equal(
    distance(
      farAction.startX,
      farAction.startY,
      farAction.targetX,
      farAction.targetY,
    ),
    110,
  );
  assertLockedTelegraph(farAction, "landing", "landShort");

  const closeRun = quietRun("v61-cup-close");
  const closeCup = enemyActor(
    closeRun,
    "cup",
    closeRun.player.x - 50,
    closeRun.player.y,
  );
  const closeAction = beginEnemyAction(closeRun, closeCup);
  assert.equal(
    distance(
      closeAction.startX,
      closeAction.startY,
      closeAction.targetX,
      closeAction.targetY,
    ),
    0,
  );
  assertLockedTelegraph(closeAction, "landing", "landShort");
});

test("shoe crosses 88 past the locked player without exceeding its 360 path", () => {
  const run = quietRun("v61-shoe-cross");
  const shoe = enemyActor(
    run,
    "shoe",
    run.player.x - 190,
    run.player.y,
  );
  const lockedPlayer = { x: run.player.x, y: run.player.y };
  const action = beginEnemyAction(run, shoe);
  const pathLength = distance(
    action.startX,
    action.startY,
    action.targetX,
    action.targetY,
  );
  assert.ok(pathLength <= 360 + 1e-9);
  assert.ok(Math.abs(pathLength - 278) < 1e-9);
  assert.ok(Math.abs(action.targetX - lockedPlayer.x - 88) < 1e-9);
  assert.ok(Math.abs(action.targetY - lockedPlayer.y) < 1e-9);
  assertLockedTelegraph(action, "swept", "crossTarget");

  run.player.x += 140;
  survivor.stepRun(run, 1 / 60, STILL);
  assert.equal(action.targetX, lockedPlayer.x + 88, "the crossing path drifted after lock");
});

test("rib uses its 145 cap but performs a 64-pixel side hop when crowded", () => {
  const farRun = quietRun("v61-rib-far");
  const farRib = enemyActor(
    farRun,
    "rib",
    farRun.player.x - 240,
    farRun.player.y,
  );
  const farAction = beginEnemyAction(farRun, farRib);
  assert.equal(
    distance(
      farAction.startX,
      farAction.startY,
      farAction.targetX,
      farAction.targetY,
    ),
    145,
  );

  const closeRun = quietRun("v61-rib-close");
  const closeRib = enemyActor(
    closeRun,
    "rib",
    closeRun.player.x - 50,
    closeRun.player.y,
  );
  const closeAction = beginEnemyAction(closeRun, closeRib);
  const moveX = closeAction.targetX - closeAction.startX;
  const moveY = closeAction.targetY - closeAction.startY;
  const playerX = closeRun.player.x - closeAction.startX;
  const playerY = closeRun.player.y - closeAction.startY;
  assert.ok(Math.abs(Math.hypot(moveX, moveY) - 64) < 1e-9);
  assert.ok(Math.abs(moveX * playerX + moveY * playerY) < 1e-9);
  assertLockedTelegraph(closeAction, "landing", "landShort");
});

test("fish exits through the first forward boundary plus 64 and follows a 44 arc", () => {
  const run = quietRun("v61-fish-boundary");
  const fish = enemyActor(
    run,
    "fish",
    run.player.x - 190,
    run.player.y,
  );
  const action = beginEnemyAction(run, fish);
  assert.equal(action.targetX, survivor.GAME_WIDTH + 64);
  assert.equal(action.targetY, run.player.y);
  assertLockedTelegraph(action, "swept", "flyby");
  assert.equal(action.hostileTelegraph.arcHeight, 44);

  const dx = action.targetX - action.startX;
  const dy = action.targetY - action.startY;
  const chord = Math.hypot(dx, dy);
  let maximumArc = 0;
  let sawActive = false;
  stepUntil(
    run,
    () => {
      sawActive ||= fish.action?.phase === "active";
      const offset =
        Math.abs(
          dx * (fish.y - action.startY) - dy * (fish.x - action.startX),
        ) / chord;
      maximumArc = Math.max(maximumArc, offset);
      return sawActive && fish.action?.phase !== "active";
    },
  );
  assert.ok(
    maximumArc >= 43.5 && maximumArc <= 44.1,
    `fish arc was ${maximumArc}, expected 44`,
  );
  assert.ok(
    Math.abs(fish.x - action.targetX) < 1e-6 &&
      Math.abs(fish.y - action.targetY) < 1e-6,
  );
});

test("every endless dash keeps at least a 0.48-second locked path telegraph", () => {
  for (const bossId of bosses.ENDLESS_BOSS_IDS) {
    const definition = bosses.getEndlessBoss(bossId);
    const dashIndex = definition.skills.findIndex(
      (skill) => skill.mode === "dash",
    );
    if (dashIndex < 0) continue;
    const dash = definition.skills[dashIndex];
    assert.ok(dash.telegraph >= 0.48, `${bossId}/${dash.id} config is too short`);
    assert.ok(dash.movement, `${bossId}/${dash.id} has no movement contract`);

    const run = quietRun(`v61-boss-path-${bossId}`);
    survivor.startEndless(run);
    run.spawnClock = Number.POSITIVE_INFINITY;
    run.forgeAt = Number.POSITIVE_INFINITY;
    run.intrusionAt = Number.POSITIVE_INFINITY;
    run.endlessDirector.nonBossThreatBudget = Number.NEGATIVE_INFINITY;
    assert.equal(survivor.spawnEndlessBossForTest(run, bossId, []), true);
    const boss = run.enemies.find((enemy) => enemy.endlessBossId === bossId);
    assert.ok(boss);
    boss.x = run.player.x - 500;
    boss.y = run.player.y;
    boss.skillIndex = dashIndex;
    boss.attackCooldown = 0;
    boss.bossPhase = 2;

    survivor.stepRun(run, 1 / 60, STILL);
    const action = boss.action;
    assert.equal(action?.kind, "endlessBossSkill");
    assert.equal(action.skillId, dash.id);
    assertLockedTelegraph(
      action,
      dash.movement.kind === "landShort" ? "landing" : "swept",
      dash.movement.kind,
    );

    const transition = stepUntil(
      run,
      () => boss.action?.phase !== "telegraph",
      300,
    );
    assert.ok(
      transition.elapsed >= 0.48 - DT,
      `${bossId}/${dash.id} only warned for ${transition.elapsed.toFixed(3)}s`,
    );
    assert.equal(boss.action?.phase, "active");
  }
});

function spawnStandardBoss(type) {
  const run = quietRun(`v61-standard-${type}`);
  if (type === "taotie") {
    run.elapsed = 359.99;
    run.midBossSpawned = false;
    run.finalBossSpawned = true;
  } else {
    run.elapsed = survivor.STANDARD_SECONDS - 0.01;
    run.midBossSpawned = true;
    run.finalBossSpawned = false;
  }
  survivor.stepRun(run, 1 / 60, STILL);
  const boss = run.enemies.find((enemy) => enemy.type === type);
  assert.ok(boss, `${type} was not spawned`);
  boss.x = run.player.x - 320;
  boss.y = run.player.y;
  boss.attackCooldown = 0;
  boss.skillIndex = 0;
  boss.motion = "moving";
  boss.motionTime = 0;
  boss.action = undefined;
  survivor.stepRun(run, 1 / 60, STILL);
  return { run, boss };
}

test("Nian landing and Taotie charge expose locked path state through impact", () => {
  for (const [type, expectedKind, expectedMovement, expectedAction] of [
    ["nian", "landing", "landShort", "nianLeap"],
    ["taotie", "swept", "crossTarget", "taotieCharge"],
  ]) {
    const { run, boss } = spawnStandardBoss(type);
    const action = boss.action;
    assert.equal(action?.kind, expectedAction);
    assertLockedTelegraph(action, expectedKind, expectedMovement);
    const target = { x: action.targetX, y: action.targetY };
    run.player.x += 170;
    run.player.y -= 90;
    survivor.stepRun(run, 1 / 60, STILL);
    assert.deepEqual(
      { x: action.targetX, y: action.targetY },
      target,
      `${type} path changed after it was telegraphed`,
    );

    const phases = new Set([action.phase]);
    for (let frame = 0; frame < 600 && boss.action; frame += 1) {
      survivor.stepRun(run, DT, STILL);
      if (boss.action) phases.add(boss.action.phase);
    }
    assert.ok(phases.has("active"), `${type} never entered active travel`);
    assert.ok(phases.has("impact"), `${type} never exposed its impact phase`);
    assert.ok(phases.has("recovery"), `${type} never exposed recovery`);
  }
});

test("hostile path and endpoint warnings render below actors without attack-subject reuse", () => {
  const drawRunStart = renderSource.indexOf("export function drawRun");
  const drawRunBody = renderSource.slice(drawRunStart);
  const pathIndex = drawRunBody.indexOf("drawHostileTelegraphs(ctx, run)");
  const warningIndex = drawRunBody.indexOf('"hostileTelegraph"');
  const enemiesIndex = drawRunBody.indexOf("drawEnemies(ctx, run");
  const playerIndex = drawRunBody.indexOf("drawPlayer(ctx, run");
  assert.ok(pathIndex >= 0 && warningIndex >= 0);
  assert.ok(pathIndex < enemiesIndex && warningIndex < enemiesIndex);
  assert.ok(enemiesIndex < playerIndex);
  assert.match(renderSource, /let drawn = fx\.kind === "warning"/);
  assert.match(
    renderSource,
    /telegraph\.movementKind !== "stationary"/,
  );
});

test("swept paths hurt during travel while landing paths only hurt at impact", () => {
  const sweptRun = quietRun("v61-swept-damage", { vulnerable: true });
  const shoe = enemyActor(
    sweptRun,
    "shoe",
    sweptRun.player.x - 190,
    sweptRun.player.y,
  );
  const sweptAction = beginEnemyAction(sweptRun, shoe);
  sweptRun.player.x = sweptAction.startX + 110;
  sweptRun.player.y = sweptAction.startY;
  const sweptEvents = stepUntil(
    sweptRun,
    () => sweptRun.player.life < sweptRun.player.maxLife,
  ).events;
  assert.ok(sweptEvents.some((event) => event.type === "playerHit"));
  assert.equal(sweptAction.hostileTelegraph.kind, "swept");
  assert.ok(
    distance(
      sweptRun.player.x,
      sweptRun.player.y,
      sweptAction.targetX,
      sweptAction.targetY,
    ) >
      enemies.getEnemyDefinition("shoe").skill.radius + 18,
    "the swept assertion accidentally tested the landing circle",
  );

  const passingRun = quietRun("v61-landing-pass", { vulnerable: true });
  const passingCup = enemyActor(
    passingRun,
    "cup",
    passingRun.player.x - 156,
    passingRun.player.y,
  );
  const landingAction = beginEnemyAction(passingRun, passingCup);
  passingRun.player.x = landingAction.startX + 5;
  passingRun.player.y = landingAction.startY;
  const firstLife = passingRun.player.life;
  const firstEvents = stepUntil(
    passingRun,
    () => passingCup.action?.phase === "recovery",
  ).events;
  assert.equal(passingRun.player.life, firstLife);
  assert.equal(firstEvents.some((event) => event.type === "playerHit"), false);
  assert.equal(landingAction.hostileTelegraph.kind, "landing");

  const impactRun = quietRun("v61-landing-impact", { vulnerable: true });
  const impactCup = enemyActor(
    impactRun,
    "cup",
    impactRun.player.x - 156,
    impactRun.player.y,
  );
  beginEnemyAction(impactRun, impactCup);
  const impactEvents = stepUntil(
    impactRun,
    () => impactRun.player.life < impactRun.player.maxLife,
  ).events;
  assert.ok(impactEvents.some((event) => event.type === "playerHit"));
});
