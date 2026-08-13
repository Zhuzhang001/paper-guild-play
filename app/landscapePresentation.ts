type WebkitFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

type FullscreenTarget = {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type LockableScreenOrientation = {
  lock?: (orientation: "landscape") => Promise<void>;
};

type ScreenWithOrientation = {
  orientation?: LockableScreenOrientation;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export type FullscreenCapability = "active" | "available" | "unavailable";

export type LandscapePresentationResult = {
  capability: FullscreenCapability;
  entered: boolean;
  orientationLocked: boolean;
  fullscreenRequested: boolean;
  standalone: boolean;
};

/** Kept as a compatibility name for the existing game-start call site. */
export type FullscreenRequestResult = LandscapePresentationResult;

export type LandscapePresentationEnvironment = {
  document?: Document | null;
  screen?: ScreenWithOrientation | null;
  standalone?: boolean;
};

function currentDocument(environment?: LandscapePresentationEnvironment) {
  return environment?.document ??
    (typeof document === "undefined" ? null : document);
}

function currentScreen(
  environment?: LandscapePresentationEnvironment,
): ScreenWithOrientation | null {
  return environment?.screen ??
    (typeof screen === "undefined"
      ? null
      : (screen as unknown as ScreenWithOrientation));
}

export function getFullscreenCapability(
  doc: Document | null = typeof document === "undefined" ? null : document,
): FullscreenCapability {
  if (!doc) return "unavailable";
  const webkitDocument = doc as WebkitFullscreenDocument;
  if (doc.fullscreenElement || webkitDocument.webkitFullscreenElement) {
    return "active";
  }
  const root = doc.documentElement as unknown as FullscreenTarget;
  return typeof root?.requestFullscreen === "function" ||
    typeof root?.webkitRequestFullscreen === "function"
    ? "available"
    : "unavailable";
}

export function isStandaloneDisplayMode() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const navigatorWithStandalone = navigator as NavigatorWithStandalone;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

/**
 * Requests the strongest landscape presentation available from one user
 * gesture. Installed apps skip redundant Fullscreen API entry, while an
 * already-fullscreen document still retries the independent orientation lock.
 * Capability failures are returned as data and never reject the caller.
 */
export async function requestLandscapePresentation(
  target?: HTMLElement | null,
  environment?: LandscapePresentationEnvironment,
): Promise<LandscapePresentationResult> {
  const doc = currentDocument(environment);
  const standalone = environment?.standalone ?? isStandaloneDisplayMode();
  if (!doc) {
    return {
      capability: "unavailable",
      entered: false,
      orientationLocked: false,
      fullscreenRequested: false,
      standalone,
    };
  }

  const initialCapability = getFullscreenCapability(doc);
  let entered = initialCapability === "active";
  let fullscreenRequested = false;

  if (!standalone && initialCapability === "available") {
    const fullscreenTarget = (target ??
      doc.documentElement) as unknown as FullscreenTarget;
    fullscreenRequested = true;
    try {
      if (fullscreenTarget.requestFullscreen) {
        await fullscreenTarget.requestFullscreen({ navigationUI: "hide" });
      } else if (fullscreenTarget.webkitRequestFullscreen) {
        await fullscreenTarget.webkitRequestFullscreen();
      } else {
        fullscreenRequested = false;
      }
      entered = fullscreenRequested;
    } catch {
      entered = false;
    }
  }

  let orientationLocked = false;
  if (entered || standalone) {
    const orientation = currentScreen(environment)?.orientation;
    if (orientation?.lock) {
      try {
        await orientation.lock("landscape");
        orientationLocked = true;
      } catch {
        // Fullscreen or standalone presentation remains usable without a lock.
      }
    }
  }

  return {
    capability: entered ? "active" : initialCapability,
    entered,
    orientationLocked,
    fullscreenRequested,
    standalone,
  };
}

/** @deprecated Prefer requestLandscapePresentation for new call sites. */
export function requestGameFullscreen(
  target?: HTMLElement | null,
): Promise<FullscreenRequestResult> {
  return requestLandscapePresentation(target);
}
