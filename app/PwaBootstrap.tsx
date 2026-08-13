"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PUBLIC_BASE_PATH, publicAsset } from "./publicAsset";
import {
  getFullscreenCapability,
  isStandaloneDisplayMode,
  requestLandscapePresentation,
  type FullscreenCapability,
} from "./ViewportController";

const SAFE_PHASES = new Set(["menu", "paused", "result"]);

function currentPhase() {
  return document.querySelector<HTMLElement>("[data-game-phase]")?.dataset
    .gamePhase;
}

function useGamePhase() {
  const [phase, setPhase] = useState("");

  useEffect(() => {
    const gameRoot = document.querySelector<HTMLElement>("[data-game-phase]");
    const sync = () => setPhase(currentPhase() ?? "");
    sync();
    if (!gameRoot) return;
    const observer = new MutationObserver(sync);
    observer.observe(gameRoot, {
      attributes: true,
      attributeFilter: ["data-game-phase"],
    });
    return () => observer.disconnect();
  }, []);

  return phase;
}

function FullscreenRecovery({ phase }: { phase: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [capability, setCapability] =
    useState<FullscreenCapability>("unavailable");

  useEffect(() => {
    const sync = () => {
      setTarget(
        phase === "paused"
          ? document.querySelector<HTMLElement>(
              ".pause-panel .button-row.centered",
            )
          : null,
      );
      setCapability(
        isStandaloneDisplayMode() ? "active" : getFullscreenCapability(),
      );
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [phase]);

  if (!target || capability !== "available") return null;
  return createPortal(
    <button
      className="secondary-button fullscreen-retry"
      type="button"
      onClick={() => void requestLandscapePresentation()}
    >
      重新进入全屏
    </button>,
    target,
  );
}

export function PwaBootstrap() {
  const phase = useGamePhase();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (waitingRef.current && SAFE_PHASES.has(phase)) setShowUpdate(true);
  }, [phase, waiting]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let disposed = false;

    const rememberWaitingWorker = (worker: ServiceWorker) => {
      if (disposed) return;
      waitingRef.current = worker;
      setWaiting(worker);
      if (SAFE_PHASES.has(currentPhase() ?? "")) setShowUpdate(true);
    };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          publicAsset("/sw.js"),
          {
            scope: `${PUBLIC_BASE_PATH || ""}/`,
            updateViaCache: "none",
          },
        );
        if (disposed) return;
        if (registration.waiting) {
          rememberWaitingWorker(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              rememberWaitingWorker(installing);
            }
          });
        });
      } catch {
        // Offline support is optional; the browser layout remains playable.
      }
    };

    const onLoad = () => void register();
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      disposed = true;
      window.removeEventListener("load", onLoad);
    };
  }, []);

  const activate = () => {
    if (!waiting) return;
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true },
    );
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <>
      <div className="test-build-badge" aria-label="测试版">
        测试版
      </div>
      {showUpdate ? (
        <aside className="pwa-update" role="status">
          <span>新卷已备好，可在此处安全更新。</span>
          <button type="button" onClick={activate}>
            更新并重开
          </button>
          <button type="button" onClick={() => setShowUpdate(false)}>
            稍后
          </button>
        </aside>
      ) : null}
      <FullscreenRecovery phase={phase} />
    </>
  );
}
