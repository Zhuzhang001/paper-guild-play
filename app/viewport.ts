export const GAME_ASPECT_RATIO = 16 / 9;
export const COMPACT_VIEWPORT_HEIGHT = 621;
export const MIN_PLAYABLE_VIEWPORT_HEIGHT = 270;

export type ViewportSource = "visual-viewport" | "window";
export type ViewportOrientation = "landscape" | "portrait" | "square";
export type ViewportPresentationMode =
  | "native-landscape"
  | "portrait-css-landscape";

export type ViewportInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ViewportPoint = {
  x: number;
  y: number;
};

export type ViewportMeasurement = {
  width: number;
  height: number;
  offsetLeft?: number;
  offsetTop?: number;
  safeInsets?: Partial<ViewportInsets>;
  source?: ViewportSource;
  /** Allows a portrait visual viewport to expose a clockwise CSS landscape. */
  allowPortraitCssPresentation?: boolean;
};

export type ViewportPresentationMetrics = {
  mode: ViewportPresentationMode;
  rotationDegrees: 0 | 90;
  physicalWidth: number;
  physicalHeight: number;
  originLeft: number;
  originTop: number;
  cssTranslateX: number;
  cssTranslateY: number;
  width: number;
  height: number;
  safeInsets: ViewportInsets;
  safeWidth: number;
  safeHeight: number;
  safeAspectRatio: number;
  stageWidth: number;
  stageHeight: number;
  stageLeft: number;
  stageTop: number;
  stageLeftWingWidth: number;
  stageRightWingWidth: number;
  stageTopLetterboxHeight: number;
  stageBottomLetterboxHeight: number;
  hasSeasonWings: boolean;
  compact: boolean;
  tooShort: boolean;
};

export type ViewportMetrics = {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  orientation: ViewportOrientation;
  safeInsets: ViewportInsets;
  safeWidth: number;
  safeHeight: number;
  safeAspectRatio: number;
  stageWidth: number;
  stageHeight: number;
  stageLeft: number;
  stageTop: number;
  stageLeftWingWidth: number;
  stageRightWingWidth: number;
  stageTopLetterboxHeight: number;
  stageBottomLetterboxHeight: number;
  hasSeasonWings: boolean;
  compact: boolean;
  tooShort: boolean;
  source: ViewportSource;
  presentation: ViewportPresentationMetrics;
};

export type LogicalStagePoint = ViewportPoint & {
  inside: boolean;
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

function normalizeInsets(
  requestedInsets: Partial<ViewportInsets>,
  width: number,
  height: number,
): ViewportInsets {
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
  return { top, right, bottom, left };
}

function orientationFor(width: number, height: number): ViewportOrientation {
  if (width > height) return "landscape";
  if (height > width) return "portrait";
  return "square";
}

function rotateInsetsClockwise(insets: ViewportInsets): ViewportInsets {
  return {
    top: insets.right,
    right: insets.bottom,
    bottom: insets.left,
    left: insets.top,
  };
}

function calculateStageGeometry(
  width: number,
  height: number,
  safeInsets: ViewportInsets,
) {
  const safeWidth = Math.max(0, width - safeInsets.left - safeInsets.right);
  const safeHeight = Math.max(0, height - safeInsets.top - safeInsets.bottom);
  const stageWidth = Math.min(safeWidth, safeHeight * GAME_ASPECT_RATIO);
  const stageHeight = stageWidth / GAME_ASPECT_RATIO;
  const stageLeftWingWidth = Math.max(0, (safeWidth - stageWidth) / 2);
  const stageRightWingWidth = Math.max(
    0,
    safeWidth - stageWidth - stageLeftWingWidth,
  );
  const stageTopLetterboxHeight = Math.max(0, (safeHeight - stageHeight) / 2);
  const stageBottomLetterboxHeight = Math.max(
    0,
    safeHeight - stageHeight - stageTopLetterboxHeight,
  );
  return {
    safeWidth,
    safeHeight,
    safeAspectRatio: safeHeight > 0 ? safeWidth / safeHeight : 0,
    stageWidth,
    stageHeight,
    stageLeftWingWidth,
    stageRightWingWidth,
    stageTopLetterboxHeight,
    stageBottomLetterboxHeight,
    hasSeasonWings:
      stageLeftWingWidth > 0.5 || stageRightWingWidth > 0.5,
    compact: safeHeight < COMPACT_VIEWPORT_HEIGHT,
    tooShort: safeHeight < MIN_PLAYABLE_VIEWPORT_HEIGHT,
  };
}

function calculatePresentation(
  width: number,
  height: number,
  offsetLeft: number,
  offsetTop: number,
  safeInsets: ViewportInsets,
  allowPortraitCssPresentation: boolean,
): ViewportPresentationMetrics {
  const rotated = allowPortraitCssPresentation && height > width;
  const presentationWidth = rotated ? height : width;
  const presentationHeight = rotated ? width : height;
  const presentationInsets = rotated
    ? rotateInsetsClockwise(safeInsets)
    : safeInsets;
  const geometry = calculateStageGeometry(
    presentationWidth,
    presentationHeight,
    presentationInsets,
  );

  return {
    mode: rotated ? "portrait-css-landscape" : "native-landscape",
    rotationDegrees: rotated ? 90 : 0,
    physicalWidth: roundCssPixel(width),
    physicalHeight: roundCssPixel(height),
    originLeft: roundCssPixel(offsetLeft),
    originTop: roundCssPixel(offsetTop),
    cssTranslateX: roundCssPixel(rotated ? width : 0),
    cssTranslateY: 0,
    width: roundCssPixel(presentationWidth),
    height: roundCssPixel(presentationHeight),
    safeInsets: {
      top: roundCssPixel(presentationInsets.top),
      right: roundCssPixel(presentationInsets.right),
      bottom: roundCssPixel(presentationInsets.bottom),
      left: roundCssPixel(presentationInsets.left),
    },
    safeWidth: roundCssPixel(geometry.safeWidth),
    safeHeight: roundCssPixel(geometry.safeHeight),
    safeAspectRatio: roundCssPixel(geometry.safeAspectRatio),
    stageWidth: roundCssPixel(geometry.stageWidth),
    stageHeight: roundCssPixel(geometry.stageHeight),
    stageLeft: roundCssPixel(
      presentationInsets.left + geometry.stageLeftWingWidth,
    ),
    stageTop: roundCssPixel(
      presentationInsets.top + geometry.stageTopLetterboxHeight,
    ),
    stageLeftWingWidth: roundCssPixel(geometry.stageLeftWingWidth),
    stageRightWingWidth: roundCssPixel(geometry.stageRightWingWidth),
    stageTopLetterboxHeight: roundCssPixel(
      geometry.stageTopLetterboxHeight,
    ),
    stageBottomLetterboxHeight: roundCssPixel(
      geometry.stageBottomLetterboxHeight,
    ),
    hasSeasonWings: geometry.hasSeasonWings,
    compact: geometry.compact,
    tooShort: geometry.tooShort,
  };
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
  const safeInsets = normalizeInsets(
    measurement.safeInsets ?? {},
    width,
    height,
  );
  const geometry = calculateStageGeometry(width, height, safeInsets);
  const presentation = calculatePresentation(
    width,
    height,
    offsetLeft,
    offsetTop,
    safeInsets,
    measurement.allowPortraitCssPresentation !== false,
  );

  return {
    width: roundCssPixel(width),
    height: roundCssPixel(height),
    offsetLeft: roundCssPixel(offsetLeft),
    offsetTop: roundCssPixel(offsetTop),
    orientation: orientationFor(width, height),
    safeInsets: {
      top: roundCssPixel(safeInsets.top),
      right: roundCssPixel(safeInsets.right),
      bottom: roundCssPixel(safeInsets.bottom),
      left: roundCssPixel(safeInsets.left),
    },
    safeWidth: roundCssPixel(geometry.safeWidth),
    safeHeight: roundCssPixel(geometry.safeHeight),
    safeAspectRatio: roundCssPixel(geometry.safeAspectRatio),
    stageWidth: roundCssPixel(geometry.stageWidth),
    stageHeight: roundCssPixel(geometry.stageHeight),
    stageLeftWingWidth: roundCssPixel(geometry.stageLeftWingWidth),
    stageRightWingWidth: roundCssPixel(geometry.stageRightWingWidth),
    stageTopLetterboxHeight: roundCssPixel(
      geometry.stageTopLetterboxHeight,
    ),
    stageBottomLetterboxHeight: roundCssPixel(
      geometry.stageBottomLetterboxHeight,
    ),
    hasSeasonWings: geometry.hasSeasonWings,
    stageLeft: roundCssPixel(
      offsetLeft + safeInsets.left + geometry.stageLeftWingWidth,
    ),
    stageTop: roundCssPixel(
      offsetTop + safeInsets.top + geometry.stageTopLetterboxHeight,
    ),
    compact: geometry.compact,
    tooShort: geometry.tooShort,
    source: measurement.source ?? "window",
    presentation,
  };
}

/** Inverts the optional clockwise CSS rotation into presentation-local space. */
export function clientPointToPresentationPoint(
  point: ViewportPoint,
  presentation: ViewportPresentationMetrics,
): ViewportPoint {
  const physicalX = point.x - presentation.originLeft;
  const physicalY = point.y - presentation.originTop;
  if (presentation.rotationDegrees === 90) {
    return {
      x: physicalY,
      y: presentation.physicalWidth - physicalX,
    };
  }
  return { x: physicalX, y: physicalY };
}

/** Forward counterpart used by tests and overlay positioning. */
export function presentationPointToClientPoint(
  point: ViewportPoint,
  presentation: ViewportPresentationMetrics,
): ViewportPoint {
  if (presentation.rotationDegrees === 90) {
    return {
      x:
        presentation.originLeft + presentation.physicalWidth - point.y,
      y: presentation.originTop + point.x,
    };
  }
  return {
    x: presentation.originLeft + point.x,
    y: presentation.originTop + point.y,
  };
}

/** Converts a client pointer directly into the 1280x720-style logical stage. */
export function clientPointToLogicalStage(
  point: ViewportPoint,
  presentation: ViewportPresentationMetrics,
  logicalWidth = 1280,
  logicalHeight = 720,
): LogicalStagePoint {
  if (presentation.stageWidth <= 0 || presentation.stageHeight <= 0) {
    return { x: 0, y: 0, inside: false };
  }
  const local = clientPointToPresentationPoint(point, presentation);
  const relativeX = local.x - presentation.stageLeft;
  const relativeY = local.y - presentation.stageTop;
  return {
    x: (relativeX / presentation.stageWidth) * logicalWidth,
    y: (relativeY / presentation.stageHeight) * logicalHeight,
    inside:
      relativeX >= 0 &&
      relativeY >= 0 &&
      relativeX <= presentation.stageWidth &&
      relativeY <= presentation.stageHeight,
  };
}
