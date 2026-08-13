import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateViewportMetrics,
  MIN_PLAYABLE_VIEWPORT_HEIGHT,
} from "../app/viewport.ts";

const text = (relative) =>
  readFile(new URL(`../${relative}`, import.meta.url), "utf8");

const mobileSizes = [
  [956, 360, 640, 360],
  [852, 320, 568.889, 320],
  [844, 300, 533.333, 300],
  [740, 280, 497.778, 280],
  [667, 280, 497.778, 280],
  [1024, 700, 1024, 576],
];

test("safe stage preserves the complete 16:9 canvas at target mobile sizes", () => {
  for (const [width, height, stageWidth, stageHeight] of mobileSizes) {
    const metrics = calculateViewportMetrics({ width, height });
    assert.equal(metrics.stageWidth, stageWidth);
    assert.equal(metrics.stageHeight, stageHeight);
    assert.ok(metrics.stageLeft >= 0);
    assert.ok(metrics.stageTop >= 0);
    assert.ok(metrics.stageLeft + metrics.stageWidth <= width);
    assert.ok(metrics.stageTop + metrics.stageHeight <= height);
    assert.ok(Math.abs(metrics.stageWidth / metrics.stageHeight - 16 / 9) < 0.001);
  }
});

test("safe insets and VisualViewport offsets are applied before stage fitting", () => {
  const metrics = calculateViewportMetrics({
    width: 852,
    height: 320,
    offsetLeft: 4,
    offsetTop: 7,
    safeInsets: { top: 0, right: 47, bottom: 21, left: 47 },
    source: "visual-viewport",
  });
  assert.equal(metrics.safeWidth, 758);
  assert.equal(metrics.safeHeight, 299);
  assert.equal(metrics.stageWidth, 531.556);
  assert.equal(metrics.stageHeight, 299);
  assert.equal(metrics.stageLeft, 164.222);
  assert.equal(metrics.stageTop, 7);
  assert.equal(metrics.source, "visual-viewport");
});

test("the guard activates only below the 270px supported floor", () => {
  assert.equal(MIN_PLAYABLE_VIEWPORT_HEIGHT, 270);
  assert.equal(calculateViewportMetrics({ width: 640, height: 270 }).tooShort, false);
  assert.equal(calculateViewportMetrics({ width: 640, height: 269 }).tooShort, true);
  assert.equal(
    calculateViewportMetrics({
      width: 640,
      height: 280,
      safeInsets: { bottom: 20 },
    }).tooShort,
    true,
  );
});

test("malformed inset measurements cannot push the stage outside the viewport", () => {
  const metrics = calculateViewportMetrics({
    width: 100,
    height: 80,
    safeInsets: { top: 90, right: 80, bottom: 90, left: 80 },
  });
  assert.equal(metrics.safeWidth, 0);
  assert.equal(metrics.safeHeight, 0);
  assert.ok(metrics.stageLeft >= 0 && metrics.stageLeft <= 100);
  assert.ok(metrics.stageTop >= 0 && metrics.stageTop <= 80);
});

test("controller uses VisualViewport with a window fallback and frame-coalesced listeners", async () => {
  const [controller, presentation] = await Promise.all([
    text("app/ViewportController.tsx"),
    text("app/landscapePresentation.ts"),
  ]);
  assert.match(controller, /window\.visualViewport/);
  assert.match(controller, /window\.innerWidth/);
  assert.match(controller, /window\.innerHeight/);
  assert.match(controller, /requestAnimationFrame/);
  assert.match(controller, /viewport\?\.addEventListener\("resize"/);
  assert.match(controller, /viewport\?\.addEventListener\("scroll"/);
  assert.match(controller, /orientationchange/);
  assert.match(controller, /fullscreenchange/);
  assert.match(controller, /pauseForUnsafeViewport/);
  assert.match(presentation, /navigationUI:\s*"hide"/);
  assert.match(presentation, /orientation\.lock\("landscape"\)/);
  assert.match(controller, /viewportPresentation/);
});

test("the start gesture launches audio and fullscreen without making fullscreen a gate", async () => {
  const game = await text("app/PaperGuildGame.tsx");
  const start = game.slice(
    game.indexOf("const startGame = async"),
    game.indexOf("const chooseUpgrade"),
  );
  assert.match(start, /audioRef\.current\?\.initFromGesture\(\)/);
  assert.match(start, /const landscapeAttempt =[\s\S]*?requestLandscapePresentation\(\)/);
  assert.match(start, /if \(landscapeAttempt\) void landscapeAttempt/);
  assert.doesNotMatch(start, /await landscapeAttempt/);
});

test("shell and forge are sized by the measured stage, not an internal viewport", async () => {
  const css = await text("app/globals.css");
  const forgeCss = css.slice(css.indexOf("v6.1: one forge layout system"));
  assert.match(css, /container-name:\s*game-shell/);
  assert.match(css, /width:\s*var\(--game-presentation-stage-width\)/);
  assert.match(css, /height:\s*var\(--game-presentation-stage-height\)/);
  assert.match(css, /@container game-shell \(max-height: 620px\)/);
  assert.doesNotMatch(forgeCss, /100dvh|100vh/);
  assert.match(forgeCss, /\.forge-panel \{[\s\S]*?height:\s*calc\(100% - 8px\)/);
});

test("PWA and visible build labeling expose only the v6.3 test stage", async () => {
  const [manifestRaw, bootstrap, layout, helper, versionRaw] = await Promise.all([
    text("public/manifest.webmanifest"),
    text("app/PwaBootstrap.tsx"),
    text("app/layout.tsx"),
    text("app/publicAsset.ts"),
    text("public/version.json"),
  ]);
  const manifest = JSON.parse(manifestRaw);
  const version = JSON.parse(versionRaw);
  assert.deepEqual(manifest.display_override, ["fullscreen", "standalone"]);
  assert.equal(manifest.display, "standalone");
  assert.match(bootstrap, /aria-label="测试版">\s*测试版\s*</);
  assert.doesNotMatch(bootstrap, /非商业|non-commercial/);
  assert.doesNotMatch(bootstrap, /addEventListener\("beforeinstallprompt"/);
  assert.doesNotMatch(bootstrap, /className="pwa-install"/);
  assert.match(bootstrap, /重新进入全屏/);
  assert.match(layout, /"paper-guild-stage":\s*"test"/);
  assert.doesNotMatch(layout, /paper-guild-test|non-commercial/);
  assert.match(helper, /version:\s*"6\.3\.0"/);
  assert.equal(version.version, "6.3.0");
});
