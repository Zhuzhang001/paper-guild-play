import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-form-"));
const outfile = join(scratch, "form.mjs");
const esbuild = new URL("../node_modules/.bin/esbuild.cmd", import.meta.url);
const result = spawnSync(fileURLToPath(esbuild), [
  fileURLToPath(new URL("../app/game/form.ts", import.meta.url)),
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
const formModule = await import(pathToFileURL(outfile).href);
const { createPlayerForm, forceHumanForm, stepPlayerForm } = formModule;
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

function stepFor(form, seconds, moving, x = 1, y = 0) {
  const dt = 1 / 120;
  for (let elapsed = 0; elapsed < seconds; elapsed += dt) {
    stepPlayerForm(form, moving, x, y, dt);
  }
}

test("long movement folds once and stopping always restores human form", () => {
  const form = createPlayerForm();
  stepFor(form, 30, true);
  assert.equal(form.formState, "plane");
  assert.equal(form.formProgress, 1);

  stepFor(form, 0.34, false);
  assert.equal(form.formState, "human");
  assert.equal(form.formProgress, 0);
});

test("a sharp reversal unfolds and starts a human-form cooldown", () => {
  const form = createPlayerForm();
  stepFor(form, 1, true);
  stepPlayerForm(form, true, -1, 0, 1 / 120);
  assert.equal(form.formState, "foldingToHuman");

  stepFor(form, 0.25, true, -1, 0);
  assert.equal(form.formState, "human");
  assert.equal(form.formProgress, 0);
  assert.ok(form.formCooldown > 0);
});

test("damage-triggered unfolding is finite from any plane duration", () => {
  const form = createPlayerForm();
  stepFor(form, 120, true);
  forceHumanForm(form);
  stepFor(form, 0.25, true);
  assert.equal(form.formState, "human");
  assert.equal(form.formProgress, 0);
});
