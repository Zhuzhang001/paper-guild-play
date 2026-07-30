import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-audio-"));
const outfile = join(scratch, "audio.mjs");
const esbuild = fileURLToPath(
  new URL("../node_modules/.bin/esbuild.cmd", import.meta.url),
);
const result = spawnSync(
  esbuild,
  [
    fileURLToPath(new URL("../app/game/world/audio.ts", import.meta.url)),
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
const audio = await import(pathToFileURL(outfile).href);
process.on("exit", () =>
  rmSync(scratch, { recursive: true, force: true }),
);

test("same-frame combat sounds aggregate before voice allocation", () => {
  const plan = audio.planSfxFrame([
    ...Array(24).fill("weapon.abacus.hit"),
    ...Array(16).fill("sfx.pickup"),
    "sfx.player-hit",
  ]);
  assert.equal(
    plan.find((entry) => entry.cue === "weapon.abacus.hit")?.count,
    24,
  );
  assert.equal(plan.find((entry) => entry.cue === "sfx.pickup")?.count, 16);
  assert.equal(plan.find((entry) => entry.cue === "sfx.player-hit")?.count, 1);
});

test("boss entrance wins over solar-term and ambience cues", () => {
  const plan = audio.planSfxFrame([
    "ambience.rain",
    "sfx.term-change",
    "sfx.boss-taotie",
  ]);
  assert.deepEqual(plan.map((entry) => entry.cue), ["sfx.boss-taotie"]);
});

test("fold and unfold share an exclusive player-form lane", () => {
  const plan = audio.planSfxFrame(["sfx.fold", "sfx.unfold"]);
  assert.deepEqual(plan.map((entry) => entry.cue), ["sfx.unfold"]);
});

test("weapon material cues expose three authored variants", () => {
  const weaponCues = Object.entries(audio.AUDIO_CUES).filter(([id]) =>
    id.startsWith("weapon."),
  );
  assert.equal(weaponCues.length, 20);
  for (const [, definition] of weaponCues) {
    assert.ok(Array.isArray(definition.url));
    assert.equal(definition.url.length, 3);
  }
});

test("every crafted weapon has its own restrained attack signature", () => {
  const fusionCues = Object.entries(audio.AUDIO_CUES).filter(([id]) =>
    id.startsWith("fusion."),
  );
  assert.equal(fusionCues.length, 45);
  assert.equal(
    new Set(fusionCues.map(([, definition]) => definition.url)).size,
    45,
  );
  for (const [id, definition] of fusionCues) {
    assert.match(definition.url, /^\/audio\/fusion-.+\.wav$/);
    assert.ok(definition.volume <= 0.42, `${id} should stay beneath the main weapon mix`);
    assert.ok(definition.categoryCooldownMs >= 140);
  }
});

test("mix limits and music priority match mobile and boss rules", () => {
  assert.deepEqual(audio.AUDIO_MIX_LIMITS, {
    mobileSfxVoices: 8,
    desktopSfxVoices: 10,
  });
  assert.equal(
    audio.getWorldMusicCue({
      season: "spring",
      endless: true,
      bossTier: "mid",
    }),
    "music.boss.taotie",
  );
});

test("a crafted attack suppresses its component fire and hit sounds", () => {
  const plan = audio.planSfxFrame([
    "weapon.fan.fire",
    "weapon.umbrella.hit",
    "fusion.mistCanopy",
  ]);
  assert.deepEqual(plan.map((entry) => entry.cue), ["fusion.mistCanopy"]);
});
