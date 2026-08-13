"use client";

import { useEffect, useState } from "react";
import {
  getFullscreenCapability,
  isStandaloneDisplayMode,
  requestGameFullscreen,
  requestLandscapePresentation,
  type FullscreenCapability,
  type FullscreenRequestResult,
  type LandscapePresentationResult,
} from "./landscapePresentation";
import {
  calculateViewportMetrics,
  type ViewportInsets,
  type ViewportMetrics,
} from "./viewport";

export {
  getFullscreenCapability,
  isStandaloneDisplayMode,
  requestGameFullscreen,
  requestLandscapePresentation,
};
export type {
  FullscreenCapability,
  FullscreenRequestResult,
  LandscapePresentationResult,
};

const cssPixels = (value: number) => `${value}px`;

function createSafeAreaProbe(doc: Document) {
  const probe = doc.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = [
    "position:fixed",
    "inset:0 auto auto 0",
    "visibility:hidden",
    "pointer-events:none",
    "padding-top:env(safe-area-inset-top, 0px)",
    "padding-right:env(safe-area-inset-right, 0px)",
    "padding-bottom:env(safe-area-inset-bottom, 0px)",
    "padding-left:env(safe-area-inset-left, 0px)",
  ].join(";");
  doc.body.appendChild(probe);
  return probe;
}

function readSafeAreaInsets(probe: HTMLElement): ViewportInsets {
  const style = getComputedStyle(probe);
  return {
    top: Number.parseFloat(style.paddingTop) || 0,
    right: Number.parseFloat(style.paddingRight) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
    left: Number.parseFloat(style.paddingLeft) || 0,
  };
}

function readViewportMetrics(probe: HTMLElement): ViewportMetrics {
  const viewport = window.visualViewport;
  return calculateViewportMetrics({
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
    offsetLeft: viewport?.offsetLeft ?? 0,
    offsetTop: viewport?.offsetTop ?? 0,
    safeInsets: readSafeAreaInsets(probe),
    source: viewport ? "visual-viewport" : "window",
    allowPortraitCssPresentation:
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(any-pointer: coarse)").matches,
  });
}

function writeViewportMetrics(metrics: ViewportMetrics) {
  const root = document.documentElement;
  const { presentation, safeInsets } = metrics;
  const values: Record<string, number> = {
    "--viewport-width": metrics.width,
    "--viewport-height": metrics.height,
    "--viewport-offset-left": metrics.offsetLeft,
    "--viewport-offset-top": metrics.offsetTop,
    "--viewport-center-x": metrics.offsetLeft + metrics.width / 2,
    "--safe-area-top": safeInsets.top,
    "--safe-area-right": safeInsets.right,
    "--safe-area-bottom": safeInsets.bottom,
    "--safe-area-left": safeInsets.left,
    "--game-stage-width": metrics.stageWidth,
    "--game-stage-height": metrics.stageHeight,
    "--game-stage-left": metrics.stageLeft,
    "--game-stage-top": metrics.stageTop,
    "--game-season-wing-left": presentation.stageLeftWingWidth,
    "--game-season-wing-right": presentation.stageRightWingWidth,
    "--game-presentation-origin-left": presentation.originLeft,
    "--game-presentation-origin-top": presentation.originTop,
    "--game-presentation-width": presentation.width,
    "--game-presentation-height": presentation.height,
    "--game-presentation-translate-x": presentation.cssTranslateX,
    "--game-presentation-translate-y": presentation.cssTranslateY,
    "--game-presentation-safe-top": presentation.safeInsets.top,
    "--game-presentation-safe-right": presentation.safeInsets.right,
    "--game-presentation-safe-bottom": presentation.safeInsets.bottom,
    "--game-presentation-safe-left": presentation.safeInsets.left,
    "--game-presentation-stage-width": presentation.stageWidth,
    "--game-presentation-stage-height": presentation.stageHeight,
    "--game-presentation-stage-left": presentation.stageLeft,
    "--game-presentation-stage-top": presentation.stageTop,
  };
  for (const [property, value] of Object.entries(values)) {
    root.style.setProperty(property, cssPixels(value));
  }
  root.style.setProperty(
    "--game-presentation-rotation",
    `${presentation.rotationDegrees}deg`,
  );
  root.dataset.viewportSource = metrics.source;
  root.dataset.viewportOrientation = metrics.orientation;
  root.dataset.viewportPresentation = presentation.mode;
  root.dataset.viewportCompact = String(presentation.compact);
  root.dataset.viewportTooShort = String(presentation.tooShort);
  root.dataset.viewportSeasonWings = String(presentation.hasSeasonWings);
}

function pauseForUnsafeViewport() {
  const gameRoot = document.querySelector<HTMLElement>("[data-game-phase]");
  if (gameRoot?.dataset.gamePhase !== "playing") return;
  gameRoot
    .querySelector<HTMLButtonElement>('button[aria-label="暂停"]')
    ?.click();
}

export function ViewportController() {
  const [tooShort, setTooShort] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");

  useEffect(() => {
    const probe = createSafeAreaProbe(document);
    const viewport = window.visualViewport;
    let frame: number | null = null;
    let disposed = false;

    const update = () => {
      frame = null;
      if (disposed) return;
      const metrics = readViewportMetrics(probe);
      writeViewportMetrics(metrics);
      setTooShort((current) =>
        current === metrics.presentation.tooShort
          ? current
          : metrics.presentation.tooShort,
      );
      if (metrics.presentation.tooShort) pauseForUnsafeViewport();
    };

    const scheduleUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(update);
    };

    const gameRoot = document.querySelector<HTMLElement>("[data-game-phase]");
    const phaseObserver = gameRoot
      ? new MutationObserver(scheduleUpdate)
      : null;
    phaseObserver?.observe(gameRoot as HTMLElement, {
      attributes: true,
      attributeFilter: ["data-game-phase"],
    });

    window.addEventListener("resize", scheduleUpdate, { passive: true });
    window.addEventListener("orientationchange", scheduleUpdate, {
      passive: true,
    });
    document.addEventListener("fullscreenchange", scheduleUpdate);
    document.addEventListener("webkitfullscreenchange", scheduleUpdate);
    viewport?.addEventListener("resize", scheduleUpdate, { passive: true });
    viewport?.addEventListener("scroll", scheduleUpdate, { passive: true });
    scheduleUpdate();

    return () => {
      disposed = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      phaseObserver?.disconnect();
      probe.remove();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      document.removeEventListener("fullscreenchange", scheduleUpdate);
      document.removeEventListener("webkitfullscreenchange", scheduleUpdate);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, []);

  if (!tooShort) return null;

  const enterFullscreen = async () => {
    const result = await requestLandscapePresentation();
    if (!result.entered && !result.orientationLocked) {
      setFullscreenMessage(
        result.capability === "unavailable"
          ? "此浏览器不提供网页全屏，请横置设备并收起浏览器工具栏后再继续。"
          : "浏览器未允许全屏，游戏仍保持暂停；请横置设备并扩大可视区域。",
      );
    }
  };

  return (
    <aside
      className="viewport-too-short"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="viewport-too-short-title"
    >
      <div>
        <p>可视区域保护</p>
        <h2 id="viewport-too-short-title">浏览器可用高度不足</h2>
        <span>
          行旅已暂停。请尝试进入全屏，或横置设备并收起浏览器工具栏后再继续。
        </span>
        <button type="button" onClick={enterFullscreen}>
          尝试进入全屏
        </button>
        {fullscreenMessage ? <small role="status">{fullscreenMessage}</small> : null}
      </div>
    </aside>
  );
}
