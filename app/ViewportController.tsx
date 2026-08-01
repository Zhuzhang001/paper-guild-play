"use client";

import { useEffect, useState } from "react";
import {
  calculateViewportMetrics,
  type ViewportInsets,
  type ViewportMetrics,
} from "./viewport";

type WebkitFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

type FullscreenTarget = {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

export type FullscreenCapability = "active" | "available" | "unavailable";

export type FullscreenRequestResult = {
  capability: FullscreenCapability;
  entered: boolean;
  orientationLocked: boolean;
};

const cssPixels = (value: number) => `${value}px`;

export function getFullscreenCapability(
  doc: Document = document,
): FullscreenCapability {
  const webkitDocument = doc as WebkitFullscreenDocument;
  if (doc.fullscreenElement || webkitDocument.webkitFullscreenElement) {
    return "active";
  }
  const root = doc.documentElement as unknown as FullscreenTarget;
  return typeof root.requestFullscreen === "function" ||
    typeof root.webkitRequestFullscreen === "function"
    ? "available"
    : "unavailable";
}

/**
 * Requests fullscreen without ever rejecting, so callers can start the game in
 * the same user gesture even when a browser does not expose the capability.
 */
export async function requestGameFullscreen(
  target?: HTMLElement | null,
): Promise<FullscreenRequestResult> {
  if (typeof document === "undefined") {
    return {
      capability: "unavailable",
      entered: false,
      orientationLocked: false,
    };
  }

  const capability = getFullscreenCapability(document);
  if (capability === "unavailable") {
    return { capability, entered: false, orientationLocked: false };
  }
  if (capability === "active") {
    return { capability, entered: true, orientationLocked: false };
  }

  const fullscreenTarget = (target ??
    document.documentElement) as unknown as FullscreenTarget;
  try {
    if (fullscreenTarget.requestFullscreen) {
      await fullscreenTarget.requestFullscreen({ navigationUI: "hide" });
    } else if (fullscreenTarget.webkitRequestFullscreen) {
      await fullscreenTarget.webkitRequestFullscreen();
    } else {
      return {
        capability: "unavailable",
        entered: false,
        orientationLocked: false,
      };
    }
  } catch {
    return { capability, entered: false, orientationLocked: false };
  }

  let orientationLocked = false;
  const orientation = screen.orientation as LockableScreenOrientation | undefined;
  if (orientation?.lock) {
    try {
      await orientation.lock("landscape");
      orientationLocked = true;
    } catch {
      // Fullscreen remains useful when orientation locking is unavailable.
    }
  }

  return {
    capability: getFullscreenCapability(document),
    entered: true,
    orientationLocked,
  };
}

export function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

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
  });
}

function writeViewportMetrics(metrics: ViewportMetrics) {
  const root = document.documentElement;
  const { safeInsets } = metrics;
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
  };
  for (const [property, value] of Object.entries(values)) {
    root.style.setProperty(property, cssPixels(value));
  }
  root.dataset.viewportSource = metrics.source;
  root.dataset.viewportCompact = String(metrics.compact);
  root.dataset.viewportTooShort = String(metrics.tooShort);
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
        current === metrics.tooShort ? current : metrics.tooShort,
      );
      if (metrics.tooShort) pauseForUnsafeViewport();
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
    const result = await requestGameFullscreen();
    if (!result.entered) {
      setFullscreenMessage(
        result.capability === "unavailable"
          ? "此浏览器不提供网页全屏，请将游戏添加到主屏幕后再打开。"
          : "浏览器未允许全屏，游戏仍保持暂停；也可添加到主屏幕后打开。",
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
          行旅已暂停。进入全屏，或从浏览器菜单将游戏添加到主屏幕后再继续。
        </span>
        <button type="button" onClick={enterFullscreen}>
          尝试进入全屏
        </button>
        {fullscreenMessage ? <small role="status">{fullscreenMessage}</small> : null}
      </div>
    </aside>
  );
}
