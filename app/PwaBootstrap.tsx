"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PUBLIC_BASE_PATH, publicAsset } from "./publicAsset";
import {
  getFullscreenCapability,
  isStandaloneDisplayMode,
  requestGameFullscreen,
  type FullscreenCapability,
} from "./ViewportController";

const SAFE_PHASES = new Set(["menu", "paused", "result"]);

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

function currentPhase() {
  return document.querySelector<HTMLElement>("[data-game-phase]")?.dataset
    .gamePhase;
}

function isIosBrowser() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
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
      setCapability(getFullscreenCapability());
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
      onClick={() => void requestGameFullscreen()}
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
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(() =>
    typeof window === "undefined" ? false : isStandaloneDisplayMode(),
  );
  const [ios] = useState(() =>
    typeof navigator === "undefined" ? false : isIosBrowser(),
  );
  const waitingRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setStandalone(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

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
        // Installation is optional; the browser layout remains fully playable.
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

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const showInstall = phase === "menu" && !standalone && (installPrompt || ios);

  return (
    <>
      <div className="test-build-badge" aria-label="测试版">
        测试版
      </div>
      {showInstall ? (
        <aside className="pwa-install" aria-label="安装到主屏幕">
          {installPrompt ? (
            <button type="button" onClick={() => void install()}>
              安装到主屏幕
            </button>
          ) : (
            <span>Safari：点“分享”，再选“添加到主屏幕”</span>
          )}
        </aside>
      ) : null}
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
