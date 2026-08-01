"use client";

import { useEffect, useRef, useState } from "react";
import { BUILD_INFO, PUBLIC_BASE_PATH, publicAsset } from "./publicAsset";

const SAFE_PHASES = new Set(["menu", "paused", "result"]);

function currentPhase() {
  return document.querySelector<HTMLElement>("[data-game-phase]")?.dataset
    .gamePhase;
}

export function PwaBootstrap() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let disposed = false;
    let observer: MutationObserver | undefined;

    const revealWhenSafe = () => {
      if (waitingRef.current && SAFE_PHASES.has(currentPhase() ?? "")) {
        setShowUpdate(true);
      }
    };

    const rememberWaitingWorker = (worker: ServiceWorker) => {
      waitingRef.current = worker;
      setWaiting(worker);
      revealWhenSafe();
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
        observer = new MutationObserver(revealWhenSafe);
        const gameRoot = document.querySelector("[data-game-phase]");
        if (gameRoot) {
          observer.observe(gameRoot, {
            attributes: true,
            attributeFilter: ["data-game-phase"],
          });
        }
      } catch {
        // The game remains fully playable when installation is unavailable.
      }
    };

    const onLoad = () => void register();
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      disposed = true;
      observer?.disconnect();
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
      <div className="test-build-badge" aria-label="非商业测试版">
        非商业测试 · v{BUILD_INFO.version}
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
    </>
  );
}
