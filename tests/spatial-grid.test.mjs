import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-grid-"));
const outfile = join(scratch, "grid.mjs");
const esbuild = fileURLToPath(
  new URL("../node_modules/.bin/esbuild.cmd", import.meta.url),
);
const result = spawnSync(
  esbuild,
  [
    fileURLToPath(
      new URL("../app/game/runtime/spatialGrid.ts", import.meta.url),
    ),
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
const { SpatialGrid } = await import(pathToFileURL(outfile).href);
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

test("shared spatial grid deduplicates multi-cell actors and finds nearest", () => {
  const grid = new SpatialGrid(64);
  const actors = [
    { id: 1, x: 64, y: 64, radius: 40, hp: 2 },
    { id: 2, x: 150, y: 64, radius: 12, hp: 2 },
    { id: 3, x: 72, y: 72, radius: 10, hp: 0 },
  ];
  grid.rebuild(actors);
  assert.deepEqual(grid.query(64, 64, 70).map((actor) => actor.id), [1, 2]);
  assert.equal(grid.nearest(140, 64, 120)?.id, 2);
  grid.rebuild([actors[1]]);
  assert.deepEqual(grid.query(64, 64, 32), []);
});
