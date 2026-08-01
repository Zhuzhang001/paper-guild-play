import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [art, enemies, game, css] = await Promise.all([
  readFile(new URL("../app/game/art.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/game/actors/enemySprites.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/PaperGuildGame.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("season plates retain current and adjacent scenes and expose release", () => {
  assert.match(art, /export async function retainSeasonSceneAssets/);
  assert.match(art, /current \+ count - 1/);
  assert.match(art, /current \+ 1/);
  assert.match(art, /export function releaseSeasonSceneAssets/);
  assert.match(game, /seasonLifecycleIndexRef/);
});

test("enemy sheets retain active actors and one preselected Boss", () => {
  assert.match(enemies, /export async function retainEnemySpriteSheets/);
  assert.match(enemies, /export function releaseEnemySpriteSheets/);
  assert.doesNotMatch(enemies, /requestIdleCallback/);
  assert.match(game, /enemy\.endlessBossId \?\? enemy\.type/);
  assert.match(game, /run\.endlessDirector\.nextBossId/);
});

test("short-landscape forge keeps readable text and touch floors", () => {
  const floor = css.slice(css.indexOf("v6 short-landscape floor"));
  assert.match(floor, /max-height: 500px/);
  assert.match(floor, /min-height: 44px !important/);
  assert.match(floor, /font-size: 11px !important/);
  assert.match(css, /forge-workbench\.view-actions/);
  assert.match(css, /forge-workbench\.view-ring/);
});

test("worst retained decode lifecycle remains within 96 MiB", () => {
  const raw = execFileSync(
    process.execPath,
    ["scripts/validate-runtime-budget.mjs"],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  const report = JSON.parse(raw);
  assert.equal(report.pass, true);
  assert.ok(report.estimatedPeakMiB <= 96);
  assert.equal(report.assumptions.retainedSeasonSheets, 3);
  assert.equal(report.assumptions.preselectedNextBossSheets, 1);
});
