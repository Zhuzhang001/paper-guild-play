import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const spriteSource = readFileSync(
  fileURLToPath(
    new URL("../app/game/actors/enemySprites.ts", import.meta.url),
  ),
  "utf8",
);

const bosses = [
  ["troupeMaster", "boss-opera-master-v6.webp"],
  ["chiefClerk", "boss-ledger-clerk-v6.webp"],
  ["nightWatch", "boss-night-watchman-v6.webp"],
  ["kilnForeman", "boss-kiln-overseer-v6.webp"],
  ["siegeTower", "boss-siege-cart-v6.webp"],
  ["bannerCaptain", "boss-banner-officer-v6.webp"],
];

test("all six endless Bosses use authored v6 sprite sheets", () => {
  for (const [id, filename] of bosses) {
    assert.match(spriteSource, new RegExp(`${id}: ".*${filename}"`));
    const path = fileURLToPath(
      new URL(`../public/enemies-v6/${filename}`, import.meta.url),
    );
    const buffer = readFileSync(path);
    assert.ok(statSync(path).size > 40_000, `${filename} is not a finished atlas`);
    assert.equal(buffer.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(buffer.subarray(8, 12).toString("ascii"), "WEBP");
  }
  assert.match(spriteSource, /bossEffects: "\/enemies-v6\/boss-effects-v6\.webp"/);
  const effectsPath = fileURLToPath(
    new URL(
      "../public/enemies-v6/boss-effects-v6.webp",
      import.meta.url,
    ),
  );
  assert.ok(statSync(effectsPath).size > 80_000);
});

test("endless Boss animation uses the authored four-row action layout", () => {
  const animation = readFileSync(
    fileURLToPath(
      new URL("../app/game/visual/enemyAnimation.ts", import.meta.url),
    ),
    "utf8",
  );
  assert.match(animation, /usesEndlessBossAtlas/);
  assert.match(animation, /row = 1;/);
  assert.match(animation, /row = 2;/);
  assert.match(animation, /row = 3;/);
});

test("the six Boss skill families resolve to authored effect frames", () => {
  const renderer = readFileSync(
    fileURLToPath(new URL("../app/game/renderGame.ts", import.meta.url)),
    "utf8",
  );
  for (const hint of [
    "troupe-master",
    "chief-clerk",
    "night-watch",
    "kiln-foreman",
    "siege-tower",
    "banner-captain",
  ]) {
    assert.match(renderer, new RegExp(hint));
  }
  assert.match(renderer, /drawEndlessBossEffect/);
});
