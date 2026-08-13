import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const text = (relative) =>
  readFile(new URL(`../${relative}`, import.meta.url), "utf8");

async function loadDirectorModule() {
  const source = await text("app/game/assetStreamDirector.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
}

test("asset stream plan exposes deterministic deadlines and dependency ordering", async () => {
  const stream = await loadDirectorModule();
  const plan = stream.STANDARD_ASSET_STREAM_PLAN;
  assert.equal(plan.length, 7);
  assert.deepEqual(
    stream.selectDueAssetStreamGroups(plan, 0).map((group) => group.id),
    ["minimumPlayable"],
  );
  const minimumReady = new Set(["minimumPlayable"]);
  assert.deepEqual(
    stream
      .selectDueAssetStreamGroups(plan, 100, minimumReady)
      .map((group) => group.id),
    ["springFollowup", "summer", "autumn"],
  );
  assert.equal(stream.assetStreamDeadlineState(plan[2], 59), "scheduled");
  assert.equal(stream.assetStreamDeadlineState(plan[2], 60), "urgent");
  assert.equal(stream.assetStreamDeadlineState(plan[2], 75), "late");
  assert.equal(stream.nextAssetStreamWakeSeconds(plan, 100, minimumReady), 195);
});

test("asset stream director deduplicates work and unlocks dependent groups", async () => {
  const stream = await loadDirectorModule();
  const calls = [];
  const director = new stream.AssetStreamDirector(
    async (group) => {
      calls.push(group.id);
      await Promise.resolve();
    },
    stream.STANDARD_ASSET_STREAM_PLAN.slice(0, 3),
    { maxConcurrent: 1 },
  );
  director.advance(100);
  director.advance(100);
  const snapshot = await director.whenIdle();
  assert.deepEqual(calls, ["minimumPlayable", "springFollowup", "summer"]);
  assert.ok(snapshot.groups.every((group) => group.status === "ready"));
  assert.equal(snapshot.activeLoads, 0);
  assert.equal(snapshot.queuedLoads, 0);
});

test("request gate limits actual resource factories, including constrained mode", async () => {
  const stream = await loadDirectorModule();
  const gate = new stream.AssetRequestGate();
  let activeLarge = 0;
  let activeSmall = 0;
  let maxLarge = 0;
  let maxSmall = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const large = () => gate.schedule("large", async () => {
    maxLarge = Math.max(maxLarge, ++activeLarge);
    await barrier;
    activeLarge -= 1;
  });
  const small = () => gate.schedule("small", async () => {
    maxSmall = Math.max(maxSmall, ++activeSmall);
    await barrier;
    activeSmall -= 1;
  });
  const normal = [large(), large(), large(), small(), small()];
  await Promise.resolve();
  assert.equal(gate.snapshot().activeLarge, 2);
  assert.equal(gate.snapshot().activeSmall, 1);
  release();
  await Promise.all(normal);
  assert.equal(maxLarge, 2);
  assert.equal(maxSmall, 1);

  const constrainedGate = new stream.AssetRequestGate();
  constrainedGate.configure({ constrained: true });
  let constrainedActive = 0;
  let constrainedMax = 0;
  const requests = Array.from({ length: 4 }, (_, index) =>
    constrainedGate.schedule(index % 2 ? "small" : "large", async () => {
      constrainedMax = Math.max(constrainedMax, ++constrainedActive);
      await Promise.resolve();
      constrainedActive -= 1;
    }),
  );
  await Promise.all(requests);
  assert.equal(constrainedMax, 1);
});

test("request gate releases slots after rejection, synchronous throw and queued cancellation", async () => {
  const stream = await loadDirectorModule();
  const gate = new stream.AssetRequestGate();
  gate.configure({ constrained: true });
  const calls = [];

  await assert.rejects(
    gate.schedule("large", async () => {
      calls.push("reject");
      throw new Error("network failed");
    }),
    /network failed/,
  );
  await assert.rejects(
    gate.schedule("small", () => {
      calls.push("throw");
      throw new Error("factory failed");
    }),
    /factory failed/,
  );

  let release;
  const blocker = gate.schedule("large", async () => {
    calls.push("blocker");
    await new Promise((resolve) => { release = resolve; });
  });
  const controller = new AbortController();
  const cancelled = gate.schedule("small", async () => {
    calls.push("cancelled-ran");
  }, controller.signal);
  controller.abort();
  await assert.rejects(cancelled, /Abort/);
  assert.equal(gate.snapshot().queued, 0);
  release();
  await blocker;

  await gate.schedule("large", async () => { calls.push("after"); });
  assert.deepEqual(calls, ["reject", "throw", "blocker", "after"]);
  assert.equal(gate.snapshot().activeLarge, 0);
  assert.equal(gate.snapshot().activeSmall, 0);
});

test("art, enemy and visual loaders expose separate minimum and background APIs", async () => {
  const [art, enemies, manifest, visuals] = await Promise.all([
    text("app/game/art.ts"),
    text("app/game/actors/enemySprites.ts"),
    text("app/game/visual/manifest.ts"),
    text("app/game/visual/index.ts"),
  ]);
  assert.match(art, /export async function loadMinimumArtAssets/);
  assert.match(art, /export async function preloadSeasonSceneAssets/);
  assert.match(enemies, /export async function loadMinimumEnemySpriteSheets/);
  assert.match(enemies, /export async function preloadEnemySpriteGroup/);
  assert.match(manifest, /export function minimumVisualAssets/);
  assert.match(visuals, /export async function loadMinimumVisualPack/);
  assert.match(visuals, /export async function preloadVisualGroup/);
  assert.match(visuals, /const visualLoads = new WeakMap/);
  assert.match(visuals, /const retainedVisuals = new WeakMap/);
  assert.match(visuals, /releaseVisualImage\(image\)/);
});

test("service worker installs the playable shell once and times out navigation", async () => {
  const sw = await text("public/sw.js");
  assert.doesNotMatch(sw, /STARTUP_ASSETS|MINIMUM_PLAYABLE_ASSETS/);
  assert.match(sw, /new Set\(discovered\)/);
  assert.doesNotMatch(sw, /cache: "reload"/);
  assert.match(sw, /const INSTALL_FETCH_TIMEOUT_MS = 10_000/);
  assert.match(sw, /fetchWithTimeout\(ROOT, INSTALL_FETCH_TIMEOUT_MS/);
  assert.match(sw, /fetchWithTimeout\(url, INSTALL_FETCH_TIMEOUT_MS/);
  assert.match(sw, /Promise\.all\(\[cacheNext\(\), cacheNext\(\)\]\)/);
  assert.match(sw, /const NAVIGATION_TIMEOUT_MS = 3200/);
  assert.match(sw, /new AbortController\(\)/);
  assert.match(sw, /fetchWithTimeout\(request, NAVIGATION_TIMEOUT_MS\)/);
  assert.match(sw, /runtimeInflight\.get\(key\)/);
  assert.match(sw, /runtimeInflight\.set\(key, pending\)/);
  assert.match(sw, /return \(await pending\)\.clone\(\)/);
  const installBlock = sw.slice(
    sw.indexOf('addEventListener("install"'),
    sw.indexOf('addEventListener("message"'),
  );
  assert.doesNotMatch(installBlock, /skipWaiting/);

  assert.match(sw, /url\.pathname\.includes\("\/_next\/"\)/);
});

test("minimum authored payload leaves enough room for the compressed app shell", async () => {
  const fixedBootAssets = [
    "public/art/season-spring-runtime.webp",
    "public/art-v6/boot-subjects-v63.webp",
    "public/art-v3/hero-directions-v3.webp",
    "public/art-v4/hero-fold-runtime-v4.webp",
  ];
  const sizes = async (paths) =>
    Promise.all(
      paths.map(async (path) => (await stat(new URL(`../${path}`, import.meta.url))).size),
    );
  const fixedBytes = (await sizes(fixedBootAssets)).reduce(
    (sum, value) => sum + value,
    0,
  );
  const worstCaseBytes = fixedBytes;

  // 546.3 KiB of already-compressed WebP leaves more than 680 KiB inside the
  // 1.2 MiB transfer target for HTML, CSS and compressed JavaScript.
  assert.ok(
    worstCaseBytes <= 650 * 1024,
    `minimum authored payload grew to ${worstCaseBytes} bytes`,
  );
  assert.equal(fixedBytes, 559_414);
  assert.equal(worstCaseBytes, 559_414);

  const [manifest, art, enemies, game] = await Promise.all([
    text("app/game/visual/manifest.ts"),
    text("app/game/art.ts"),
    text("app/game/actors/enemySprites.ts"),
    text("app/PaperGuildGame.tsx"),
  ]);
  const minimumVisualBlock = manifest.slice(
    manifest.indexOf("export function minimumVisualAssets"),
    manifest.indexOf("export const CORE_VISUAL_ASSETS"),
  );
  assert.match(minimumVisualBlock, /HERO_ATLASES\.directions/);
  assert.match(minimumVisualBlock, /HERO_ATLASES\.fold/);
  assert.match(minimumVisualBlock, /BOOT_SUBJECT_ATLAS/);
  assert.match(minimumVisualBlock, /WEAPON_ATLASES\[initialWeaponId\]/);
  assert.doesNotMatch(minimumVisualBlock, /EFFECT_ATLASES|FUSION_ATLASES/);
  assert.match(art, /retainedSeasonIndices\.add\(0\)/);
  assert.match(enemies, /attachEnemyBootFallback/);
  assert.doesNotMatch(enemies, /boot-subjects-v63\.webp/);
  assert.match(game, /waitForFonts: false/);
  assert.match(game, /attachEnemyBootFallback\(enemies, getBootSubjectImage\(visuals\)\)/);
});

test("cold readiness has no font, audio, boss, fusion or full weapon blocker", async () => {
  const [game, visual, layout] = await Promise.all([
    text("app/PaperGuildGame.tsx"),
    text("app/game/visual/index.ts"),
    text("app/layout.tsx"),
  ]);
  const bootEffect = game.slice(
    game.indexOf("const initialBootWeapon"),
    game.indexOf("return () =>", game.indexOf("const initialBootWeapon")),
  );
  const readiness = bootEffect.slice(
    0,
    bootEffect.indexOf("let solarTermRequest"),
  );
  assert.match(readiness, /loadMinimumArtAssets/);
  assert.match(readiness, /loadMinimumEnemySpriteSheets/);
  assert.match(readiness, /loadMinimumVisualPack/);
  assert.doesNotMatch(readiness, /document\.fonts|audioRef\.current|Boss|Fusion|FUSION/);

  const minimumLoader = visual.slice(
    visual.indexOf("export async function loadMinimumVisualPack"),
    visual.indexOf("export async function loadVisualPack"),
  );
  assert.match(minimumLoader, /spec\.id !== WEAPON_ATLASES\[initialWeaponId\]\.id/);
  assert.doesNotMatch(minimumLoader, /EFFECT_ATLASES|FUSION_ATLASES/);
  assert.doesNotMatch(layout, /rel=["']preload["']/i);
});
