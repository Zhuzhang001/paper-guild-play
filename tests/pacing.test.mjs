import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-pacing-"));
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

function preferredUpgrade(run) {
  const options = survivor.getUpgradeChoices(run);
  return (
    options.find((option) => option.kind === "route") ??
    options.find((option) => option.kind === "mastery") ??
    (run.build.weapons.length < 4
      ? options.find((option) => option.kind === "acquire")
      : undefined) ??
    options.find((option) => option.kind !== "utility") ??
    options[0]
  );
}

test("natural eight-minute pacing reaches routes and multiple masteries", () => {
  const run = survivor.createRun(new Set(), "acceptance-pacing");
  run.player.life = 999;
  run.player.maxLife = 999;
  let firstRouteAt = Number.POSITIVE_INFINITY;
  let firstMasteryAt = Number.POSITIVE_INFINITY;
  let defeatedNian = false;

  for (let frame = 0; frame < 30 * 520; frame += 1) {
    const angle = run.elapsed * 0.63;
    const events = survivor.stepRun(run, 1 / 30, {
      x: Math.cos(angle),
      y: Math.sin(angle * 0.83),
    });
    for (const event of events) {
      if (event.type === "upgrade") {
        const option = preferredUpgrade(run);
        if (option) survivor.applyUpgrade(run, option);
      }
      if (event.type === "midBoss") survivor.applyRareChoice(run, "master-now");
      if (event.type === "finalBoss") defeatedNian = true;
    }
    if (run.build.weapons.some((weapon) => weapon.routeId)) {
      firstRouteAt = Math.min(firstRouteAt, run.elapsed);
    }
    if (run.build.weapons.some((weapon) => weapon.masteryId)) {
      firstMasteryAt = Math.min(firstMasteryAt, run.elapsed);
    }
    if (defeatedNian) break;
  }

  assert.ok(firstRouteAt <= 180, `first route arrived at ${firstRouteAt}s`);
  assert.ok(firstMasteryAt <= 330, `first mastery arrived at ${firstMasteryAt}s`);
  assert.ok(
    run.build.weapons.filter((weapon) => weapon.masteryId).length >= 2,
    "the final build should contain at least two completed weapons",
  );
  assert.equal(defeatedNian, true);
});

test("endless weave releases a terminal every six to twelve seconds", () => {
  const run = survivor.createRun(new Set(), "acceptance-weave");
  run.player.life = 999;
  run.player.maxLife = 999;
  run.elapsed = 480;
  survivor.startEndless(run);
  run.spawnClock = Number.POSITIVE_INFINITY;
  run.endlessBossAt = Number.POSITIVE_INFINITY;
  run.forgeAt = Number.POSITIVE_INFINITY;
  run.intrusionAt = Number.POSITIVE_INFINITY;
  let terminals = 0;

  for (let frame = 0; frame < 30 * 120; frame += 1) {
    terminals += survivor
      .stepRun(run, 1 / 30, { x: 0, y: 0 })
      .filter((event) => event.type === "terminal").length;
  }

  assert.ok(terminals >= 10 && terminals <= 20, `released ${terminals} terminals`);
});
