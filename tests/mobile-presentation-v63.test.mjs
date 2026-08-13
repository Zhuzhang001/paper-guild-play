import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateViewportMetrics,
  clientPointToLogicalStage,
  clientPointToPresentationPoint,
  presentationPointToClientPoint,
} from "../app/viewport.ts";
import {
  requestLandscapePresentation,
} from "../app/landscapePresentation.ts";

const source = (relative) =>
  readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("ultrawide metrics expose symmetric seasonal wings without stretching", () => {
  const metrics = calculateViewportMetrics({ width: 956, height: 360 });
  assert.equal(metrics.stageWidth, 640);
  assert.equal(metrics.stageHeight, 360);
  assert.equal(metrics.stageLeftWingWidth, 158);
  assert.equal(metrics.stageRightWingWidth, 158);
  assert.equal(metrics.hasSeasonWings, true);
  assert.equal(metrics.presentation.hasSeasonWings, true);
});

test("portrait presentation swaps dimensions and safe insets clockwise", () => {
  const metrics = calculateViewportMetrics({
    width: 390,
    height: 844,
    offsetLeft: 3,
    offsetTop: 7,
    safeInsets: { top: 47, right: 5, bottom: 34, left: 2 },
  });
  const presentation = metrics.presentation;
  assert.equal(metrics.orientation, "portrait");
  assert.equal(presentation.mode, "portrait-css-landscape");
  assert.equal(presentation.rotationDegrees, 90);
  assert.equal(presentation.width, 844);
  assert.equal(presentation.height, 390);
  assert.deepEqual(presentation.safeInsets, {
    top: 5,
    right: 34,
    bottom: 2,
    left: 47,
  });
  assert.equal(presentation.originLeft, 3);
  assert.equal(presentation.originTop, 7);
  assert.equal(presentation.cssTranslateX, 390);
  assert.ok(presentation.stageWidth / presentation.stageHeight > 1.777);
  assert.ok(presentation.stageWidth / presentation.stageHeight < 1.779);
});

test("portrait client coordinates round-trip through the inverse CSS transform", () => {
  const presentation = calculateViewportMetrics({
    width: 390,
    height: 844,
    offsetLeft: 3,
    offsetTop: 7,
  }).presentation;
  const samples = [
    { x: 3, y: 7 },
    { x: 393, y: 7 },
    { x: 3, y: 851 },
    { x: 198, y: 429 },
  ];
  for (const client of samples) {
    const local = clientPointToPresentationPoint(client, presentation);
    const roundTrip = presentationPointToClientPoint(local, presentation);
    assert.deepEqual(roundTrip, client);
  }
});

test("client points map into the logical 1280x720 stage after portrait rotation", () => {
  const presentation = calculateViewportMetrics({
    width: 390,
    height: 844,
  }).presentation;
  const stageCenter = {
    x: presentation.stageLeft + presentation.stageWidth / 2,
    y: presentation.stageTop + presentation.stageHeight / 2,
  };
  const clientCenter = presentationPointToClientPoint(
    stageCenter,
    presentation,
  );
  const logical = clientPointToLogicalStage(clientCenter, presentation);
  assert.equal(logical.inside, true);
  assert.ok(Math.abs(logical.x - 640) < 0.01);
  assert.ok(Math.abs(logical.y - 360) < 0.01);

  const outside = clientPointToLogicalStage(
    presentationPointToClientPoint({ x: 0, y: 0 }, presentation),
    presentation,
  );
  assert.equal(outside.inside, false);
});

test("already-fullscreen presentation still retries landscape orientation lock", async () => {
  const calls = [];
  const root = {
    requestFullscreen: async () => calls.push("fullscreen"),
  };
  const result = await requestLandscapePresentation(undefined, {
    document: { fullscreenElement: {}, documentElement: root },
    screen: {
      orientation: {
        lock: async (orientation) => calls.push(`lock:${orientation}`),
      },
    },
    standalone: false,
  });
  assert.deepEqual(calls, ["lock:landscape"]);
  assert.equal(result.entered, true);
  assert.equal(result.fullscreenRequested, false);
  assert.equal(result.orientationLocked, true);
});

test("browser presentation requests fullscreen before locking orientation", async () => {
  const calls = [];
  const root = {
    requestFullscreen: async (options) => {
      calls.push(`fullscreen:${options.navigationUI}`);
    },
  };
  const result = await requestLandscapePresentation(undefined, {
    document: { fullscreenElement: null, documentElement: root },
    screen: {
      orientation: {
        lock: async (orientation) => calls.push(`lock:${orientation}`),
      },
    },
    standalone: false,
  });
  assert.deepEqual(calls, ["fullscreen:hide", "lock:landscape"]);
  assert.equal(result.capability, "active");
  assert.equal(result.entered, true);
  assert.equal(result.fullscreenRequested, true);
  assert.equal(result.orientationLocked, true);
});

test("fullscreen rejection remains nonblocking and does not attempt a tab lock", async () => {
  let lockCalls = 0;
  const result = await requestLandscapePresentation(undefined, {
    document: {
      fullscreenElement: null,
      documentElement: {
        requestFullscreen: async () => {
          throw new Error("denied");
        },
      },
    },
    screen: {
      orientation: {
        lock: async () => {
          lockCalls += 1;
        },
      },
    },
    standalone: false,
  });
  assert.equal(result.entered, false);
  assert.equal(result.orientationLocked, false);
  assert.equal(lockCalls, 0);
});

test("standalone presentation skips redundant fullscreen and attempts lock", async () => {
  const calls = [];
  const result = await requestLandscapePresentation(undefined, {
    document: {
      fullscreenElement: null,
      documentElement: {
        requestFullscreen: async () => calls.push("fullscreen"),
      },
    },
    screen: {
      orientation: {
        lock: async (orientation) => calls.push(`lock:${orientation}`),
      },
    },
    standalone: true,
  });
  assert.deepEqual(calls, ["lock:landscape"]);
  assert.equal(result.entered, false);
  assert.equal(result.fullscreenRequested, false);
  assert.equal(result.orientationLocked, true);
});

test("PWA bootstrap keeps update safety without app-owned install promotion", async () => {
  const [bootstrap, controller] = await Promise.all([
    source("app/PwaBootstrap.tsx"),
    source("app/ViewportController.tsx"),
  ]);
  assert.doesNotMatch(bootstrap, /addEventListener\("beforeinstallprompt"/);
  assert.doesNotMatch(bootstrap, /className="pwa-install"/);
  assert.doesNotMatch(bootstrap, /\.prompt\(\)/);
  assert.match(bootstrap, /SAFE_PHASES/);
  assert.match(bootstrap, /SKIP_WAITING/);
  assert.match(bootstrap, /requestLandscapePresentation/);
  assert.match(controller, /dataSet|dataset\.viewportPresentation/i);
  assert.match(controller, /--game-season-wing-left/);
  assert.match(controller, /--game-presentation-rotation/);
});
