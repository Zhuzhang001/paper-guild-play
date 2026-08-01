import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-travel-notes-"));
const esbuild = fileURLToPath(
  new URL("../node_modules/.bin/esbuild.cmd", import.meta.url),
);

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
    env: {
      ...process.env,
      PATH: `${dirname(process.execPath)};${process.env.PATH ?? ""}`,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return import(pathToFileURL(outfile).href);
}

const runtime = await bundle("../app/game/runtime/index.ts", "runtime.mjs");
const survivor = await bundle("../app/game/survivor.ts", "survivor.mjs");
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

const MASTERED_NO_DURATION = [
  { id: "sword", level: 5, routeId: "sword:a", masteryId: "sword:a:focus" },
  { id: "umbrella", level: 5, routeId: "umbrella:a", masteryId: "umbrella:a:focus" },
  { id: "scissors", level: 5, routeId: "scissors:a", masteryId: "scissors:a:focus" },
  { id: "abacus", level: 5, routeId: "abacus:a", masteryId: "abacus:a:focus" },
];

const MASTERED_WITH_DURATION = [
  ...MASTERED_NO_DURATION.slice(0, 3),
  { id: "crossbow", level: 5, routeId: "crossbow:b", masteryId: "crossbow:b:focus" },
];

function masteredBuild(weapons = MASTERED_WITH_DURATION, travelNotes = {}) {
  return { weapons, modifiers: {}, travelNotes, synergyCapacity: 3 };
}

function quietRun(seed = "travel-note") {
  const run = survivor.createRun(new Set(), seed);
  run.player.life = 999;
  run.player.maxLife = 999;
  run.midBossSpawned = true;
  run.finalBossSpawned = true;
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.endlessBossAt = Number.POSITIVE_INFINITY;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  return run;
}

function applyNote(run, id) {
  const definition = runtime.getTravelNoteDefinition(id);
  const currentRank = runtime.getTravelNoteRank(run.build, id);
  return survivor.applyUpgrade(run, {
    id: `test-${id}-${currentRank + 1}`,
    kind: "utility",
    modifierId: id,
    travelNoteId: id,
    travelNoteCategory: definition.category,
    slotCategory: definition.category,
    currentRank,
    nextRank: currentRank + 1,
    maxRank: definition.maxRank,
    title: definition.name,
    description: definition.rankEffects[currentRank],
    artKey: definition.artKey,
  });
}

function stepFrames(run, frames, input = { x: 0, y: 0 }, observe = () => {}) {
  for (let frame = 0; frame < frames; frame += 1) {
    const events = survivor.stepRun(run, 1 / 30, input);
    observe(events);
  }
}

function spawnTarget(run) {
  run.spawnClock = 0;
  survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
  run.spawnClock = Number.POSITIVE_INFINITY;
  const enemy = run.enemies[0];
  assert.ok(enemy, "test setup must spawn a target");
  enemy.x = run.player.x + 100;
  enemy.y = run.player.y;
  enemy.speed = 0;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.attackCooldown = Number.POSITIVE_INFINITY;
  run.cooldowns.clear();
  run.projectiles.length = 0;
  run.zones.length = 0;
  run.summons.length = 0;
  return enemy;
}

test("the twelve travel notes have the locked 4/4/4 catalog and rank caps", () => {
  assert.equal(runtime.TRAVEL_NOTE_DEFINITIONS.length, 12);
  assert.equal(
    new Set(runtime.TRAVEL_NOTE_DEFINITIONS.map((note) => note.id)).size,
    12,
  );
  assert.deepEqual(
    Object.fromEntries(runtime.TRAVEL_NOTE_CATEGORIES.map((category) => [
      category,
      runtime.TRAVEL_NOTE_DEFINITIONS.filter(
        (note) => note.category === category,
      ).length,
    ])),
    { craft: 4, journey: 4, protection: 4 },
  );
  assert.deepEqual(
    Object.fromEntries(runtime.TRAVEL_NOTE_DEFINITIONS.map((note) => [
      note.name,
      note.maxRank,
    ])),
    {
      "砺锋": 4,
      "顺手": 3,
      "放远": 2,
      "久留": 2,
      "聚风": 3,
      "轻脚": 2,
      "并珠": 2,
      "转身借力": 2,
      "护纸": 2,
      "缓纸": 2,
      "退一步": 2,
      "拾补": 2,
    },
  );
  assert.ok(
    runtime.TRAVEL_NOTE_DEFINITIONS.every(
      (note) => note.rankEffects.length === note.maxRank,
    ),
  );
});

test("four mastered slots switch to deterministic craft/journey/protection choices", () => {
  const build = masteredBuild();
  const seed = runtime.createRngState("travel-note-slots");
  const first = runtime.generateUpgradeOptions(build, seed, { maxWeapons: 4 });
  const repeated = runtime.generateUpgradeOptions(build, seed, { maxWeapons: 4 });
  assert.equal(first.milestone, "travelNote");
  assert.equal(first.options.length, 3);
  assert.deepEqual(first.options, repeated.options);
  assert.deepEqual(
    first.options.map((option) => option.slotCategory),
    ["craft", "journey", "protection"],
  );
  assert.deepEqual(
    first.options.map((option) => option.travelNoteCategory),
    ["craft", "journey", "protection"],
  );
  assert.ok(first.options.every((option) =>
    option.kind === "utility" &&
    option.currentRank === 0 &&
    option.nextRank === 1 &&
    option.description.includes(`0/${option.maxRank}`)
  ));

  const unfinished = masteredBuild([
    ...MASTERED_WITH_DURATION.slice(0, 3),
    { id: "crossbow", level: 4, routeId: "crossbow:b" },
  ]);
  assert.equal(
    runtime.generateUpgradeOptions(
      unfinished,
      runtime.createRngState("not-yet"),
    ).milestone,
    "mastery",
  );
});

test("context and cap filtering never offer an ineffective travel note", () => {
  const noDuration = runtime.availableTravelNotes(masteredBuild(MASTERED_NO_DURATION));
  assert.equal(noDuration.some((note) => note.id === "lastingWork"), false);

  const oneLife = runtime.availableTravelNotes(masteredBuild(), {
    oneLife: true,
    recoveryEnabled: false,
  });
  assert.equal(oneLife.some((note) => note.id === "paperWard"), false);
  assert.equal(oneLife.some((note) => note.id === "pickupMend"), false);

  const noRecovery = runtime.availableTravelNotes(masteredBuild(), {
    recoveryEnabled: false,
  });
  assert.equal(noRecovery.some((note) => note.id === "pickupMend"), false);
  assert.equal(noRecovery.some((note) => note.id === "paperWard"), true);

  const protectionFull = Object.fromEntries(
    runtime.TRAVEL_NOTE_DEFINITIONS
      .filter((note) => note.category === "protection")
      .map((note) => [note.id, note.maxRank]),
  );
  const filled = runtime.generateTravelNoteOptions(
    masteredBuild(MASTERED_WITH_DURATION, protectionFull),
    runtime.createRngState("fill-empty-category"),
  );
  assert.equal(filled.options.length, 3);
  assert.equal(filled.options[2].slotCategory, "protection");
  assert.notEqual(filled.options[2].travelNoteCategory, "protection");

  const allFull = Object.fromEntries(
    runtime.TRAVEL_NOTE_DEFINITIONS.map((note) => [note.id, note.maxRank]),
  );
  assert.deepEqual(runtime.generateTravelNoteOptions(
    masteredBuild(MASTERED_WITH_DURATION, allFull),
    runtime.createRngState("all-full"),
  ).options, []);
  assert.throws(
    () => runtime.applyUpgradeOption(masteredBuild(MASTERED_WITH_DURATION, allFull), {
      id: "overflow-keen-edge",
      kind: "utility",
      modifierId: "keenEdge",
      travelNoteId: "keenEdge",
      title: "砺锋",
      description: "",
      artKey: "",
    }),
    /already complete/,
  );
});

test("stat travel notes apply exact additive rank totals", () => {
  const run = survivor.createRun(new Set(), "travel-note-stats");
  const baseLife = run.player.maxLife;
  for (let rank = 0; rank < 4; rank += 1) applyNote(run, "keenEdge");
  for (let rank = 0; rank < 3; rank += 1) applyNote(run, "gatheringWind");
  for (let rank = 0; rank < 2; rank += 1) applyNote(run, "lightStep");
  run.player.life = 1;
  applyNote(run, "paperWard");
  applyNote(run, "paperWard");
  assert.ok(Math.abs(run.player.powerMultiplier - 1.24) < 1e-9);
  assert.ok(Math.abs(run.player.magnetMultiplier - 1.54) < 1e-9);
  assert.ok(Math.abs(run.player.speedMultiplier - 1.1) < 1e-9);
  assert.equal(run.player.maxLife, baseLife + 2);
  assert.equal(run.player.life, 3);
});

test("quick hands, long reach, and lasting work change existing emitters only", () => {
  const base = quietRun("travel-emitter-base");
  base.player.powerMultiplier = 0;
  const baseTarget = spawnTarget(base);
  survivor.stepRun(base, 1 / 30, { x: 0, y: 0 });
  const baseCooldown = base.cooldowns.get("weapon-attack:sword");
  const baseLife = base.projectiles[0]?.life;
  assert.ok(baseCooldown > 0 && baseLife > 0);

  const enhanced = quietRun("travel-emitter-enhanced");
  enhanced.player.powerMultiplier = 0;
  enhanced.build.travelNotes = { quickHands: 3, longReach: 2 };
  const enhancedTarget = spawnTarget(enhanced);
  enhancedTarget.x = baseTarget.x;
  survivor.stepRun(enhanced, 1 / 30, { x: 0, y: 0 });
  const enhancedCooldown = enhanced.cooldowns.get("weapon-attack:sword");
  const enhancedLife = enhanced.projectiles[0]?.life;
  assert.ok(Math.abs(enhancedCooldown / baseCooldown - 0.85) < 1e-6);
  assert.ok(Math.abs(enhancedLife / baseLife - 1.2) < 0.02);
  assert.equal(
    [...enhanced.cooldowns.keys()].filter((key) => key === "weapon-attack:sword").length,
    1,
    "顺手 must reuse the existing core attack timer",
  );

  const summonBase = quietRun("travel-duration-base");
  summonBase.build.weapons = [{ id: "lantern", level: 1 }];
  spawnTarget(summonBase);
  survivor.stepRun(summonBase, 1 / 30, { x: 0, y: 0 });
  const baseSummonLife = summonBase.summons[0]?.life;

  const summonLong = quietRun("travel-duration-long");
  summonLong.build.weapons = [{ id: "lantern", level: 1 }];
  summonLong.build.travelNotes = { lastingWork: 2 };
  spawnTarget(summonLong);
  survivor.stepRun(summonLong, 1 / 30, { x: 0, y: 0 });
  assert.ok(baseSummonLife > 0);
  assert.ok(Math.abs(summonLong.summons[0].life / baseSummonLife - 1.3) < 0.02);
});

test("merge pearls lowers 92/72/56 thresholds and strengthens the merged pickup", () => {
  function fill(run, count) {
    run.pickups = Array.from({ length: count }, (_, index) => ({
      id: 10_000 + index,
      x: 30,
      y: 30,
      value: 1,
      age: 0,
      tier: 1,
      kind: "experience",
    }));
  }

  const base = quietRun("merge-base");
  fill(base, 72);
  survivor.stepRun(base, 1 / 30, { x: 0, y: 0 });
  assert.equal(base.pickups.length, 72);

  const first = quietRun("merge-first");
  first.build.travelNotes = { mergePearls: 1 };
  fill(first, 72);
  survivor.stepRun(first, 1 / 30, { x: 0, y: 0 });
  assert.ok(first.pickups.length < 72);
  assert.ok(first.pickups.some((pickup) => (pickup.magnetRadius ?? 0) >= 260));

  const second = quietRun("merge-second");
  second.build.travelNotes = { mergePearls: 2 };
  fill(second, 56);
  survivor.stepRun(second, 1 / 30, { x: 0, y: 0 });
  assert.ok(second.pickups.length < 56);
  assert.ok(second.pickups.some((pickup) => (pickup.magnetRadius ?? 0) >= 340));
});

test("pickup mend creates leaves at 8/6 pickups and respects no-recovery", () => {
  function collect(run, count) {
    run.pickups = Array.from({ length: count }, (_, index) => ({
      id: 20_000 + index,
      x: run.player.x,
      y: run.player.y,
      value: 1,
      age: 0,
      tier: 1,
      kind: "experience",
    }));
    survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
  }

  const first = quietRun("mend-eight");
  first.build.travelNotes = { pickupMend: 1 };
  collect(first, 8);
  assert.ok(first.pickups.some((pickup) => pickup.kind === "healingLeaf"));

  const second = quietRun("mend-six");
  second.build.travelNotes = { pickupMend: 2 };
  collect(second, 6);
  assert.ok(second.pickups.some((pickup) => pickup.kind === "healingLeaf"));

  const blocked = quietRun("mend-blocked");
  blocked.trials.add("noRecovery");
  blocked.build.travelNotes = { pickupMend: 2 };
  collect(blocked, 6);
  assert.equal(blocked.pickups.some((pickup) => pickup.kind === "healingLeaf"), false);
});

test("slow paper and step back extend safety and repel nearby non-bosses", () => {
  const run = quietRun("protection-runtime");
  run.player.life = 10;
  run.player.maxLife = 10;
  run.player.powerMultiplier = 0;
  run.build.travelNotes = { slowPaper: 2, stepBack: 2 };
  const enemy = spawnTarget(run);
  enemy.x = run.player.x + 24;
  enemy.y = run.player.y;
  run.strikes.push({
    id: 90_001,
    owner: "terminal",
    artKey: "test/hostile-strike",
    x: run.player.x,
    y: run.player.y,
    radius: 80,
    damage: 1,
    delay: 0,
    maxDelay: 0,
    hostile: true,
  });
  survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
  assert.equal(run.player.life, 9);
  assert.ok(run.player.invulnerability > 1.54);
  const pushedDistance = Math.hypot(
    enemy.x - run.player.x,
    enemy.y - run.player.y,
  );
  assert.ok(pushedDistance > 140, `pushed distance was ${pushedDistance}`);
  assert.ok((run.cooldowns.get("travel-note:step-back") ?? 0) > 5.9);
});

test("turning momentum emits one proc-safe 45% echo without a copy replay", () => {
  const run = quietRun("turning-momentum-runtime");
  run.build.travelNotes = { turningMomentum: 1 };
  run.build.modifiers = { helpingHand: 3 };
  const target = spawnTarget(run);
  target.hp = target.maxHp = 1_000_000;
  stepFrames(run, 24, { x: 1, y: 0 });
  run.projectiles.length = 0;

  const terminalIds = new Set();
  const terminalDamage = [];
  const weaponDamage = [];
  stepFrames(run, 90, { x: -1, y: 0 }, () => {
    for (const projectile of run.projectiles) {
      if (projectile.owner === "terminal" && !terminalIds.has(projectile.id)) {
        terminalIds.add(projectile.id);
        terminalDamage.push(projectile.damage);
      }
      if (projectile.owner === "sword") weaponDamage.push(projectile.damage);
    }
  });
  assert.ok(terminalIds.size >= 1);
  assert.ok(
    weaponDamage.some(
      (damage) => Math.abs(terminalDamage[0] / damage - 0.45) < 1e-9,
    ),
  );
  assert.ok(
    run.projectiles
      .filter((projectile) => projectile.owner === "terminal")
      .every((projectile) => projectile.canProc === false),
  );
  assert.equal(run.attackReplays.has("terminal"), false);
  assert.ok((run.cooldowns.get("travel-note:turning-momentum:cooldown") ?? 0) > 2.5);
});

test("completed notes convert further levels to surplus pages without modals", () => {
  const run = quietRun("surplus-pages");
  run.build = masteredBuild(
    MASTERED_WITH_DURATION,
    Object.fromEntries(
      runtime.TRAVEL_NOTE_DEFINITIONS.map((note) => [note.id, note.maxRank]),
    ),
  );
  run.player.xp = 100;
  const events = survivor.stepRun(run, 1 / 30, { x: 0, y: 0 });
  assert.equal(events.some((event) => event.type === "upgrade"), false);
  assert.ok(run.surplusPages > 0);
  assert.equal(survivor.getUpgradeChoices(run).length, 0);
  assert.equal(survivor.snapshotRun(run).surplusPages, run.surplusPages);
});
