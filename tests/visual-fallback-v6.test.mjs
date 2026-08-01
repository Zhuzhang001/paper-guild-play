import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-visual-v6-"));
const outfile = join(scratch, "visual.mjs");
const esbuild = fileURLToPath(
  new URL("../node_modules/.bin/esbuild.cmd", import.meta.url),
);
const result = spawnSync(
  esbuild,
  [
    fileURLToPath(new URL("../app/game/visual/index.ts", import.meta.url)),
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
const visual = await import(pathToFileURL(outfile).href);
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

function makePack() {
  return {
    images: new Map(),
    derived: new Map(),
    frameBounds: new Map(),
    failed: new Set(),
    pending: new Set(),
  };
}

function makeContext(red = 246, green = 238, blue = 216) {
  const drawCalls = [];
  return {
    drawCalls,
    canvas: { width: 1280, height: 720 },
    globalAlpha: 1,
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    drawImage(...args) {
      drawCalls.push(args);
    },
    getImageData() {
      return { data: new Uint8ClampedArray([red, green, blue, 255]) };
    },
  };
}

test("authored fallback frame selection prefers the requested art then base art", () => {
  assert.equal(
    visual.selectAuthoredStaticFrame([true, true, false, true], 3),
    3,
  );
  assert.equal(
    visual.selectAuthoredStaticFrame([true, true, false, false], 3),
    0,
  );
  assert.equal(
    visual.selectAuthoredStaticFrame([false, false, false, true], 1),
    3,
  );
  assert.equal(
    visual.selectAuthoredStaticFrame([false, false], 1),
    undefined,
  );
});

test("effect fallback draws a static frame from the same weapon or fusion", () => {
  const ctx = makeContext();
  const pack = makePack();
  const weaponImage = { width: 700, height: 200 };
  pack.images.set("weapon.sword", weaponImage);
  const bounds = Array.from({ length: 14 }, () => null);
  bounds[0] = { x: 4, y: 5, width: 42, height: 86 };
  pack.frameBounds.set("weapon.sword", bounds);

  assert.equal(
    visual.drawStaticVisualFallback(ctx, pack, {
      weaponId: "sword",
      level: 5,
      route: "c",
      mastery: "chain",
      x: 100,
      y: 80,
      size: 36,
      rotation: 0.2,
    }),
    true,
  );
  assert.equal(ctx.drawCalls.at(-1)[0], weaponImage);
  assert.equal(ctx.drawCalls.at(-1)[1], 4, "base frame alpha bounds were used");

  const fusionImage = { width: 400, height: 400 };
  pack.images.set("fusion.galeBamboo", fusionImage);
  assert.equal(
    visual.drawStaticVisualFallback(ctx, pack, {
      weaponId: "sword",
      fusionId: "galeBamboo",
      x: 100,
      y: 80,
      size: 48,
    }),
    true,
  );
  assert.equal(ctx.drawCalls.at(-1)[0], fusionImage, "fusion body takes priority");

  const emptyPack = makePack();
  assert.equal(
    visual.drawStaticVisualFallback(ctx, emptyPack, {
      weaponId: "sword",
      x: 0,
      y: 0,
      size: 30,
    }),
    false,
  );
});

test("hero uses a thin ivory-separated authored frame only on dark ground", () => {
  assert.ok(visual.HERO_IVORY_SEPARATION_PX > 0);
  assert.ok(visual.HERO_IVORY_SEPARATION_PX <= 0.75);
  assert.equal(visual.isLowLightHeroBackground(24, 27, 30), true);
  assert.equal(visual.isLowLightHeroBackground(242, 234, 211), false);

  const darkContext = makeContext(24, 27, 30);
  const darkPack = makePack();
  const ivoryHero = { width: 900, height: 900 };
  darkPack.derived.set(
    "derived.hero-outline-ivory.hero.directions",
    ivoryHero,
  );
  visual.drawHeroSprite(darkContext, darkPack, {
    x: 640,
    y: 360,
    size: 98,
    direction: 0,
    formProgress: 0,
    state: "idle",
    time: 1,
    outline: "ink",
  });
  assert.equal(darkContext.drawCalls[0][0], ivoryHero);

  const lightContext = makeContext();
  const lightPack = makePack();
  const inkHero = { width: 900, height: 900 };
  lightPack.derived.set("derived.hero-outline.hero.directions", inkHero);
  visual.drawHeroSprite(lightContext, lightPack, {
    x: 640,
    y: 360,
    size: 98,
    direction: 0,
    formProgress: 0,
    state: "idle",
    time: 1,
    outline: "ink",
  });
  assert.equal(lightContext.drawCalls[0][0], inkHero);
});

test("battlefield fallback branches contain no glyph or coarse subject stand-ins", () => {
  const renderer = readFileSync(
    fileURLToPath(new URL("../app/game/renderGame.ts", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(renderer, /fallbackGlyph|fallbackWeapon|strokeText\s*\(/);
  const effectCap = renderer.slice(
    renderer.indexOf("function drawEffectCap"),
    renderer.indexOf("function drawWaveVisual"),
  );
  assert.doesNotMatch(effectCap, /fillRect\s*\(|strokeRect\s*\(|\.arc\s*\(/);
  assert.match(effectCap, /drawStaticVisualFallback/);
  assert.ok(
    (renderer.match(/drawAuthoredStaticSubject\s*\(/g) ?? []).length >= 7,
    "weapon, projectile, area, strike, beam/chain, weave and generic FX share authored fallback",
  );
  assert.match(renderer, /drawStaticVisualFallback/);
});
