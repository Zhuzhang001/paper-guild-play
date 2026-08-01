import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-pool-"));
const outfile = join(scratch, "pool.mjs");
const esbuild = fileURLToPath(
  new URL("../node_modules/.bin/esbuild.cmd", import.meta.url),
);
const result = spawnSync(
  esbuild,
  [
    fileURLToPath(new URL("../app/game/runtime/pool.ts", import.meta.url)),
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
const runtime = await import(pathToFileURL(outfile).href);
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

test("bounded object pools hydrate recycled combat actors without growing", () => {
  const pool = new runtime.ObjectPool(
    () => ({ id: 0, hits: new Set(), optional: undefined }),
    (value, seed) => {
      value.id = seed.id;
      value.hits.clear();
      value.optional = seed.optional;
    },
    2,
  );
  const first = pool.acquire({ id: 1, optional: "old" });
  first.hits.add(9);
  pool.release(first);
  const reused = pool.acquire({ id: 2, optional: undefined });
  assert.equal(reused, first);
  assert.equal(reused.id, 2);
  assert.equal(reused.hits.size, 0);
  assert.equal(reused.optional, undefined);

  pool.release(reused);
  pool.release({ id: 3, hits: new Set(), optional: undefined });
  pool.release({ id: 4, hits: new Set(), optional: undefined });
  assert.equal(pool.available, 2);
});

test("recycleRejectedInPlace keeps array identity and returns dead actors", () => {
  const pool = new runtime.ObjectPool(
    () => ({ id: 0, live: false }),
    (value, seed) => Object.assign(value, seed),
  );
  const values = [
    { id: 1, live: true },
    { id: 2, live: false },
    { id: 3, live: true },
  ];
  const same = runtime.recycleRejectedInPlace(values, (value) => value.live, pool);
  assert.equal(same, values);
  assert.deepEqual(values.map((value) => value.id), [1, 3]);
  assert.equal(pool.available, 1);
});

test("over-limit trimming releases oldest actors and runs the reset contract", () => {
  const resetIds = [];
  const pool = new runtime.ObjectPool(
    () => ({ id: 0, hits: new Map() }),
    (value, seed) => {
      value.id = seed.id;
      value.hits.clear();
    },
    8,
    (value) => {
      resetIds.push(value.id);
      value.hits.clear();
    },
  );
  const values = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    hits: new Map([[index, index]]),
  }));
  const identity = values;
  const same = runtime.keepNewestAndRecycleInPlace(values, 2, pool);
  assert.equal(same, identity);
  assert.deepEqual(values.map((value) => value.id), [4, 5]);
  assert.deepEqual(resetIds, [1, 2, 3]);
  assert.equal(pool.available, 3);
  const recycled = pool.acquire({ id: 9 });
  assert.equal(recycled.hits.size, 0);
});
