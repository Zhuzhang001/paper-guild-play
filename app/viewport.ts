export const GAME_ASPECT_RATIO = 16 / 9;
export const COMPACT_VIEWPORT_HEIGHT = 621;
export const MIN_PLAYABLE_VIEWPORT_HEIGHT = 270;

export type ViewportSource = "visual-viewport" | "window";

export type ViewportInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ViewportMeasurement = {
  width: number;
  height: number;
  offsetLeft?: number;
  offsetTop?: number;
  safeInsets?: Partial<ViewportInsets>;
  source?: ViewportSource;
};

export type ViewportMetrics = {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  safeInsets: ViewportInsets;
  safeWidth: number;
  safeHeight: number;
  stageWidth: number;
  stageHeight: number;
  stageLeft: number;
  stageTop: number;
  compact: boolean;
  tooShort: boolean;
  source: ViewportSource;
};

const finiteNonNegative = (value: number | undefined) =>
  Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;

const roundCssPixel = (value: number) => Math.round(value * 1000) / 1000;

function fitOpposingInsets(start: number, end: number, available: number) {
  const total = start + end;
  if (total <= available || total === 0) return [start, end] as const;
  const scale = available / total;
  return [start * scale, end * scale] as const;
}

/**
 * Fits the complete 1280x720 logical stage into the visible safe rectangle.
 * It is deliberately DOM-free so viewport edge cases can be tested directly.
 */
export function calculateViewportMetrics(
  measurement: ViewportMeasurement,
): ViewportMetrics {
  const width = finiteNonNegative(measurement.width);
  const height = finiteNonNegative(measurement.height);
  const offsetLeft = finiteNonNegative(measurement.offsetLeft);
  const offsetTop = finiteNonNegative(measurement.offsetTop);
  const requestedInsets = measurement.safeInsets ?? {};
  const [left, right] = fitOpposingInsets(
    finiteNonNegative(requestedInsets.left),
    finiteNonNegative(requestedInsets.right),
    width,
  );
  const [top, bottom] = fitOpposingInsets(
    finiteNonNegative(requestedInsets.top),
    finiteNonNegative(requestedInsets.bottom),
    height,
  );
  const safeInsets: ViewportInsets = { top, right, bottom, left };
  const safeWidth = Math.max(0, width - safeInsets.left - safeInsets.right);
  const safeHeight = Math.max(0, height - safeInsets.top - safeInsets.bottom);
  const stageWidth = Math.min(safeWidth, safeHeight * GAME_ASPECT_RATIO);
  const stageHeight = stageWidth / GAME_ASPECT_RATIO;

  return {
    width: roundCssPixel(width),
    height: roundCssPixel(height),
    offsetLeft: roundCssPixel(offsetLeft),
    offsetTop: roundCssPixel(offsetTop),
    safeInsets: {
      top: roundCssPixel(safeInsets.top),
      right: roundCssPixel(safeInsets.right),
      bottom: roundCssPixel(safeInsets.bottom),
      left: roundCssPixel(safeInsets.left),
    },
    safeWidth: roundCssPixel(safeWidth),
    safeHeight: roundCssPixel(safeHeight),
    stageWidth: roundCssPixel(stageWidth),
    stageHeight: roundCssPixel(stageHeight),
    stageLeft: roundCssPixel(
      offsetLeft + safeInsets.left + (safeWidth - stageWidth) / 2,
    ),
    stageTop: roundCssPixel(
      offsetTop + safeInsets.top + (safeHeight - stageHeight) / 2,
    ),
    compact: safeHeight < COMPACT_VIEWPORT_HEIGHT,
    tooShort: safeHeight < MIN_PLAYABLE_VIEWPORT_HEIGHT,
    source: measurement.source ?? "window",
  };
}
