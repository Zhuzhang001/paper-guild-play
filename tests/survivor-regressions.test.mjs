import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-survivor-"));
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

const survivor = await bundle("../app/game/survivor.ts", "survivor.mjs");
const runtime = await bundle("../app/game/runtime/index.ts", "runtime.mjs");
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

function quietRun(seed) {
  const run = survivor.createRun(new Set(), seed);
  run.player.life = 999;
  run.player.maxLife = 999;
  run.player.powerMultiplier = 0;
  run.midBossSpawned = true;
  run.finalBossSpawned = true;
  run.endlessBossAt = Number.POSITIVE_INFINITY;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  return run;
}

function stepFor(run, seconds, observe = () => {}) {
  const frames = Math.ceil(seconds * 30);
  for (let frame = 0; frame < frames; frame += 1) {
    const events = survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
    observe(events);
  }
}

function spawnOneTarget(run) {
  run.spawnClock = 0;
  survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
  assert.ok(run.enemies.length > 0, "test setup should spawn one target");
  run.spawnClock = Number.POSITIVE_INFINITY;
  const target = run.enemies[0];
  target.x = run.player.x + 100;
  target.y = run.player.y;
  target.speed = 0;
  target.vx = 0;
  target.vy = 0;
  target.attackCooldown = Number.POSITIVE_INFINITY;
  return target;
}

test("onKill effects do not fire before an enemy is killed", () => {
  const run = quietRun("on-kill-regression");
  run.build.weapons = [{
    id: "lantern",
    level: 5,
    routeId: "lantern:a",
    masteryId: "lantern:a:chain",
  }];
  spawnOneTarget(run);

  stepFor(run, 3);

  assert.equal(run.kills, 0);
  assert.equal(
    run.projectiles.filter((projectile) => projectile.artKey === "projectile/lantern").length,
    0,
    "the 影亡复灯 onKill projectile must not be emitted by the periodic dispatcher",
  );
});

test("beam hits dispatch the pipa harmonic onHit chain", () => {
  const run = quietRun("pipa-beam-on-hit");
  run.build.weapons = [{
    id: "pipa",
    level: 3,
    routeId: "pipa:b",
  }];
  spawnOneTarget(run);

  let sawChain = false;
  stepFor(run, 2.4, () => {
    sawChain ||= run.fx.some((effect) => effect.kind === "chain");
  });

  assert.equal(
    sawChain,
    true,
    "pipa beam damage must enter the same onHit dispatcher used by projectile damage",
  );
});

test("an expired celestial intrusion is removed and a later intrusion can begin", () => {
  const run = quietRun("intrusion-expiry");
  run.elapsed = 480;
  survivor.startEndless(run);
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.endlessBossAt = Number.POSITIVE_INFINITY;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = 525;
  run.weave = runtime.beginCelestialIntrusion(run.weave, "galeTrial", 1, 0);

  survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
  const firstAvatarId = run.intrusionAvatarId;
  assert.ok(firstAvatarId !== undefined, "the first intrusion should create its battlefield avatar");

  stepFor(run, 52);

  assert.equal(
    run.enemies.some((enemy) => enemy.id === firstAvatarId),
    false,
    "an expired intrusion avatar must leave the battlefield",
  );
  assert.ok(
    run.weave.activeIntrusion &&
      (run.weave.activeIntrusion.phase === "warning" || run.weave.activeIntrusion.phase === "active"),
    "the scheduled later intrusion should not be blocked by an expired intrusion object",
  );
});

test("defeating an intrusion avatar does not grant a Boss forge reward", () => {
  const run = quietRun("intrusion-is-not-boss");
  run.elapsed = 500;
  survivor.startEndless(run);
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.endlessBossAt = Number.POSITIVE_INFINITY;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  run.weave = runtime.beginCelestialIntrusion(run.weave, "eclipseTrial", 1, 0);

  survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
  const avatar = run.enemies.find((enemy) => enemy.intrusionAvatar);
  assert.ok(avatar, "the eclipse intrusion should create an avatar");
  avatar.hp = 0;

  const events = survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
  assert.equal(
    events.some((event) => event.type === "forge"),
    false,
    "only the scheduled endless Boss may grant a Boss forge opportunity",
  );
});

test("standard mode remains at Dahan after the 480-second Boss boundary", () => {
  const run = quietRun("standard-dahan-boundary");
  run.elapsed = 479.99;
  run.lastTermIndex = 23;

  const events = survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });

  assert.equal(run.lastTermIndex, 23);
  assert.equal(
    events.some((event) => event.type === "term" && event.name === "立春"),
    false,
    "the Nian fight must not roll the standard run back to the spring cycle",
  );
});

test("one forge opportunity permits only one weave mutation", () => {
  const run = quietRun("single-forge-action");
  run.elapsed = 500;
  survivor.startEndless(run);
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.endlessBossAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  run.forgeAt = run.elapsed;

  const events = survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
  assert.ok(events.some((event) => event.type === "forge"));

  assert.equal(survivor.insertEndlessWeapon(run, "fan"), true);
  assert.equal(
    survivor.insertEndlessWeapon(run, "umbrella"),
    false,
    "a second mutation must wait for the next forge opportunity",
  );
});
