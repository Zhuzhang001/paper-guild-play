import type { FusionId, WeaponId } from "../content/types";
import { publicAsset } from "../../publicAsset";
import {
  ALL_VISUAL_ASSETS,
  CORE_VISUAL_ASSETS,
  EFFECT_ATLASES,
  FUSION_ATLASES,
  HERO_ATLASES,
  WEAPON_ATLASES,
  type AtlasSpec,
} from "./manifest";

type VisualImage = HTMLImageElement | ImageBitmap | HTMLCanvasElement;

type OpaqueFrameBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type VisualPack = {
  readonly images: Map<string, VisualImage>;
  /** Cached, one-time processed atlases such as the hero's thin ink outline. */
  readonly derived: Map<string, VisualImage>;
  /** Tight per-frame alpha bounds; keeps authored detail large without scaling collisions. */
  readonly frameBounds: Map<string, readonly (OpaqueFrameBounds | null)[]>;
  readonly failed: Set<string>;
  readonly pending: Set<string>;
};

export type HeroVisualState = "idle" | "move" | "hurt" | "dead";

export type DrawHeroOptions = {
  x: number;
  y: number;
  size: number;
  direction: number;
  formProgress: number;
  state: HeroVisualState;
  time: number;
  /** Distance travelled in canvas pixels; drives gait without idle sliding. */
  travelled?: number;
  alpha?: number;
  outline?: "none" | "ink";
};

export type DrawWeaponOptions = {
  weaponId: WeaponId;
  level: number;
  route?: string;
  mastery?: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  time: number;
  alpha?: number;
};

export type DrawProjectileOptions = {
  weaponId: WeaponId;
  route?: string;
  mastery?: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  time: number;
  alpha?: number;
  visualKey?: string;
  tags?: readonly string[];
  fusionId?: FusionId;
};

export type DrawImpactOptions = {
  weaponId: WeaponId;
  route?: string;
  mastery?: string;
  x: number;
  y: number;
  size: number;
  progress: number;
  rotation?: number;
  alpha?: number;
  visualKey?: string;
  tags?: readonly string[];
  fusionId?: FusionId;
  ornament?: boolean;
};

export type DrawXpOptions = {
  x: number;
  y: number;
  tier: 1 | 2 | 3;
  time: number;
  size?: number;
  magnetProgress?: number;
  targetX?: number;
  targetY?: number;
  alpha?: number;
};

export type WeaponVisualSelection = {
  level: number;
  route?: string;
  mastery?: string;
};

export type HeroWeaponSocket = {
  x: number;
  y: number;
  rotation: number;
};

export type DrawFusionOptions = {
  fusionId: FusionId;
  phase:
    | "idle"
    | "body"
    | "charged"
    | "windup"
    | "attack"
    | "ultimate"
    | "finish";
  x: number;
  y: number;
  size: number;
  rotation: number;
  alpha?: number;
};

/**
 * Last-resort authored subject used when a route/effect frame is unavailable.
 * It deliberately reuses the owning weapon/fusion artwork instead of drawing
 * text or a geometric stand-in into the battlefield.
 */
export type DrawStaticVisualFallbackOptions = {
  weaponId: WeaponId;
  fusionId?: FusionId;
  level?: number;
  route?: string;
  mastery?: string;
  x: number;
  y: number;
  size: number;
  rotation?: number;
  alpha?: number;
};

const WEAPON_ORDER: readonly WeaponId[] = [
  "sword",
  "fan",
  "umbrella",
  "scissors",
  "abacus",
  "crossbow",
  "pipa",
  "inkline",
  "lantern",
  "thunderSeal",
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function dimensions(image: VisualImage) {
  if (
    typeof HTMLImageElement !== "undefined" &&
    image instanceof HTMLImageElement
  ) {
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  }
  return { width: image.width, height: image.height };
}

type AtlasLayout = {
  columns: number;
  rows: number;
};

function atlasLayout(_image: VisualImage, spec: AtlasSpec): AtlasLayout {
  return { columns: spec.columns, rows: spec.rows };
}

export async function ensureCanvasFontsReady() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  await Promise.allSettled([
    document.fonts.load('600 16px "Paper Guild Text"'),
    document.fonts.load('400 28px "Paper Guild Display"'),
  ]);
  await document.fonts.ready;
}

async function loadImage(src: string): Promise<VisualImage> {
  if (typeof createImageBitmap === "function" && typeof fetch === "function") {
    try {
      const response = await fetch(publicAsset(src), { cache: "force-cache" });
      if (!response.ok) {
        throw new Error(`Unable to load ${src}: ${response.status}`);
      }
      return await createImageBitmap(await response.blob(), {
        premultiplyAlpha: "premultiply",
        colorSpaceConversion: "default",
      });
    } catch {
      // Safari/WebView builds can expose createImageBitmap but reject WebP
      // options. The HTMLImageElement path preserves the static-art fallback.
    }
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${src}`));
    image.src = publicAsset(src);
  });
}

const HERO_OUTLINE_PREFIX = "derived.hero-outline.";
const HERO_IVORY_OUTLINE_PREFIX = "derived.hero-outline-ivory.";

/** The visible ivory band outside the ink outline, in 98px hero-space. */
export const HERO_IVORY_SEPARATION_PX = 0.65;
const HERO_INK_OUTLINE_PX = 0.9;
const HERO_DARK_BACKGROUND_LUMINANCE = 0.42;

function createScratchCanvas(width: number, height: number) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function analyzeOpaqueFrameBounds(
  image: VisualImage,
  spec: AtlasSpec,
): readonly (OpaqueFrameBounds | null)[] | null {
  const imageSize = dimensions(image);
  const canvas = createScratchCanvas(imageSize.width, imageSize.height);
  const context = canvas?.getContext("2d", { willReadFrequently: true });
  if (!canvas || !context) return null;
  try {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    ).data;
    const cellWidth = imageSize.width / spec.columns;
    const cellHeight = imageSize.height / spec.rows;
    const inset = spec.inset ?? 0;
    const bounds: (OpaqueFrameBounds | null)[] = [];
    for (let frame = 0; frame < spec.columns * spec.rows; frame += 1) {
      const column = frame % spec.columns;
      const row = Math.floor(frame / spec.columns);
      const startX = Math.floor(column * cellWidth + inset);
      const startY = Math.floor(row * cellHeight + inset);
      const endX = Math.ceil((column + 1) * cellWidth - inset);
      const endY = Math.ceil((row + 1) * cellHeight - inset);
      let minX = endX;
      let minY = endY;
      let maxX = startX - 1;
      let maxY = startY - 1;
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          if (pixels[(y * imageSize.width + x) * 4 + 3] <= 20) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      if (maxX < minX || maxY < minY) {
        bounds.push(null);
        continue;
      }
      const padding = Math.max(
        1,
        Math.round(Math.min(cellWidth, cellHeight) * 0.012),
      );
      const paddedMinX = Math.max(startX, minX - padding);
      const paddedMinY = Math.max(startY, minY - padding);
      const paddedMaxX = Math.min(endX - 1, maxX + padding);
      const paddedMaxY = Math.min(endY - 1, maxY + padding);
      bounds.push({
        x: paddedMinX,
        y: paddedMinY,
        width: paddedMaxX - paddedMinX + 1,
        height: paddedMaxY - paddedMinY + 1,
      });
    }
    return bounds;
  } catch {
    return null;
  }
}

function createOutlineMask(
  image: VisualImage,
  spec: AtlasSpec,
  width: number,
  height: number,
  radius: number,
  color: string,
) {
  const mask = createScratchCanvas(width, height);
  const maskContext = mask?.getContext("2d");
  if (!mask || !maskContext) return null;
  const diagonal = radius * Math.SQRT1_2;
  const offsets = [
    [-radius, 0],
    [radius, 0],
    [0, -radius],
    [0, radius],
    [-diagonal, -diagonal],
    [diagonal, -diagonal],
    [-diagonal, diagonal],
    [diagonal, diagonal],
  ] as const;
  const cellWidth = width / spec.columns;
  const cellHeight = height / spec.rows;
  for (let row = 0; row < spec.rows; row += 1) {
    for (let column = 0; column < spec.columns; column += 1) {
      const sourceX = column * cellWidth;
      const sourceY = row * cellHeight;
      maskContext.save();
      maskContext.beginPath();
      maskContext.rect(sourceX, sourceY, cellWidth, cellHeight);
      maskContext.clip();
      for (const [offsetX, offsetY] of offsets) {
        maskContext.drawImage(
          image,
          sourceX,
          sourceY,
          cellWidth,
          cellHeight,
          sourceX + offsetX,
          sourceY + offsetY,
          cellWidth,
          cellHeight,
        );
      }
      maskContext.restore();
    }
  }
  maskContext.globalCompositeOperation = "source-in";
  maskContext.fillStyle = color;
  maskContext.fillRect(0, 0, width, height);
  return mask;
}

function createHeroOutlinedAtlas(
  image: VisualImage,
  spec: AtlasSpec,
  withIvorySeparation: boolean,
): HTMLCanvasElement | null {
  const imageSize = dimensions(image);
  const canvas = createScratchCanvas(imageSize.width, imageSize.height);
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return null;

  const cellHeight = imageSize.height / spec.rows;
  const sourcePixelsPerHeroPixel = cellHeight / 98;
  const inkRadius = Math.max(1, sourcePixelsPerHeroPixel * HERO_INK_OUTLINE_PX);
  if (withIvorySeparation) {
    const ivoryMask = createOutlineMask(
      image,
      spec,
      imageSize.width,
      imageSize.height,
      inkRadius + sourcePixelsPerHeroPixel * HERO_IVORY_SEPARATION_PX,
      "#f5ecd5",
    );
    if (ivoryMask) {
      context.drawImage(ivoryMask, 0, 0);
      // Release the full-atlas scratch backing store before allocating the
      // ink mask; this keeps the one-time dark-scene conversion peak bounded.
      ivoryMask.width = 1;
      ivoryMask.height = 1;
    }
  }
  const inkMask = createOutlineMask(
    image,
    spec,
    imageSize.width,
    imageSize.height,
    inkRadius,
    "#211e1a",
  );
  if (!inkMask) return null;
  context.drawImage(inkMask, 0, 0);
  context.drawImage(image, 0, 0);
  return canvas;
}

export function relativeLuminance(red: number, green: number, blue: number) {
  const linear = (channel: number) => {
    const value = clamp01(channel / 255);
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  };
  return linear(red) * 0.2126 + linear(green) * 0.7152 + linear(blue) * 0.0722;
}

export function isLowLightHeroBackground(
  red: number,
  green: number,
  blue: number,
) {
  return relativeLuminance(red, green, blue) < HERO_DARK_BACKGROUND_LUMINANCE;
}

type HeroBackgroundSample = {
  x: number;
  y: number;
  time: number;
  lowLight: boolean;
};

const HERO_BACKGROUND_SAMPLES = new WeakMap<
  CanvasRenderingContext2D,
  HeroBackgroundSample
>();

function needsIvoryHeroSeparation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
) {
  const previous = HERO_BACKGROUND_SAMPLES.get(ctx);
  if (
    previous &&
    time - previous.time < 0.12 &&
    Math.hypot(x - previous.x, y - previous.y) < 20
  ) {
    return previous.lowLight;
  }
  let lowLight = false;
  try {
    const canvas = ctx.canvas;
    const sampleX = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
    const sampleY = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
    const pixels = ctx.getImageData(sampleX, sampleY, 1, 1).data;
    const luminance = relativeLuminance(pixels[0], pixels[1], pixels[2]);
    lowLight = previous?.lowLight
      ? luminance < HERO_DARK_BACKGROUND_LUMINANCE + 0.08
      : luminance < HERO_DARK_BACKGROUND_LUMINANCE;
  } catch {
    // A tainted or offscreen canvas must never prevent the hero from drawing.
  }
  HERO_BACKGROUND_SAMPLES.set(ctx, { x, y, time, lowLight });
  return lowLight;
}

function cacheVisualMetadata(
  pack: VisualPack,
  spec: AtlasSpec,
  image: VisualImage,
) {
  // Weapon cells have deliberately generous transparent margins, so inspect
  // them once and size the painted object rather than the atlas cell. Fusion
  // sheets already use the shared safe inset; scanning every possible fusion
  // during endless-mode preload would add a noticeable main-thread spike.
  if (spec.id.startsWith("weapon.")) {
    const bounds = analyzeOpaqueFrameBounds(image, spec);
    if (bounds) pack.frameBounds.set(spec.id, bounds);
  }
  if (spec.id.startsWith("hero.")) {
    const outlined = createHeroOutlinedAtlas(image, spec, false);
    if (outlined) pack.derived.set(`${HERO_OUTLINE_PREFIX}${spec.id}`, outlined);
  }
}

function resolveHeroOutlineImage(
  pack: VisualPack,
  spec: AtlasSpec,
  withIvorySeparation: boolean,
) {
  const prefix = withIvorySeparation
    ? HERO_IVORY_OUTLINE_PREFIX
    : HERO_OUTLINE_PREFIX;
  const key = `${prefix}${spec.id}`;
  const cached = pack.derived.get(key);
  if (cached) return cached;
  const source = pack.images.get(spec.id);
  if (!source) return undefined;
  const outlined = createHeroOutlinedAtlas(
    source,
    spec,
    withIvorySeparation,
  );
  if (!outlined) return undefined;
  // Keep one processed copy per hero atlas. Switching background classes is
  // rare (normally only at a season boundary) and this avoids doubling the
  // decoded hero memory for the whole run.
  const alternatePrefix = withIvorySeparation
    ? HERO_OUTLINE_PREFIX
    : HERO_IVORY_OUTLINE_PREFIX;
  pack.derived.delete(`${alternatePrefix}${spec.id}`);
  pack.derived.set(key, outlined);
  return outlined;
}

async function loadSpecs(
  pack: VisualPack,
  specs: readonly AtlasSpec[],
  onProgress?: (done: number, total: number) => void,
) {
  const uniqueSpecs = [
    ...new Map(specs.map((spec) => [spec.id, spec] as const)).values(),
  ];
  let done = 0;
  const total = uniqueSpecs.length;
  await Promise.all(
    uniqueSpecs.map(async (spec) => {
      if (pack.images.has(spec.id) || pack.failed.has(spec.id)) {
        done += 1;
        onProgress?.(done, total);
        return;
      }
      pack.pending.add(spec.id);
      try {
        const image = await loadImage(spec.src);
        pack.images.set(spec.id, image);
        cacheVisualMetadata(pack, spec, image);
      } catch {
        pack.failed.add(spec.id);
      } finally {
        pack.pending.delete(spec.id);
        done += 1;
        onProgress?.(done, total);
      }
    }),
  );
}

/**
 * Loads only the <5 MiB boot set. Upgrade candidates and fusions are hydrated
 * on demand so mobile browsers never decode the entire catalog at once.
 */
export async function loadVisualPack(
  onProgress?: (done: number, total: number) => void,
): Promise<VisualPack> {
  const pack: VisualPack = {
    images: new Map(),
    derived: new Map(),
    frameBounds: new Map(),
    failed: new Set(),
    pending: new Set(),
  };
  await Promise.all([
    ensureCanvasFontsReady(),
    loadSpecs(pack, CORE_VISUAL_ASSETS, onProgress),
  ]);
  return pack;
}

export async function preloadWeaponVisuals(
  pack: VisualPack,
  weaponIds: readonly WeaponId[],
) {
  await loadSpecs(
    pack,
    [...new Set(weaponIds)].map((id) => WEAPON_ATLASES[id]),
  );
}

export async function preloadFusionVisuals(
  pack: VisualPack,
  fusionIds?: readonly FusionId[],
) {
  const specs = fusionIds?.length
    ? fusionIds.map((id) => FUSION_ATLASES[id])
    : Object.values(FUSION_ATLASES);
  await loadSpecs(pack, specs);
}

/**
 * Releases decoded optional atlases that the current build can no longer use.
 * The boot set is always retained; held weapons and active fusion nodes are
 * passed by the director after upgrade and forge changes.
 */
export function pruneVisualPack(
  pack: VisualPack,
  weaponIds: readonly WeaponId[],
  fusionIds: readonly FusionId[] = [],
) {
  const keep = new Set(CORE_VISUAL_ASSETS.map((spec) => spec.id));
  weaponIds.forEach((id) => keep.add(WEAPON_ATLASES[id].id));
  fusionIds.forEach((id) => keep.add(FUSION_ATLASES[id].id));

  let released = 0;
  for (const [id, image] of pack.images) {
    if (
      (!id.startsWith("weapon.") && !id.startsWith("fusion.")) ||
      keep.has(id)
    ) {
      continue;
    }
    if ("close" in image && typeof image.close === "function") {
      image.close();
    }
    pack.images.delete(id);
    pack.frameBounds.delete(id);
    released += 1;
  }
  return released;
}

export function getVisualLoadStats(pack: VisualPack) {
  return {
    loaded: pack.images.size,
    failed: pack.failed.size,
    pending: pack.pending.size,
    total: ALL_VISUAL_ASSETS.length,
  };
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  spec: AtlasSpec,
  frame: number,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
  alpha = 1,
  flipX = false,
  imageOverride?: VisualImage,
) {
  const image = imageOverride ?? pack.images.get(spec.id);
  if (!image) return false;
  const { width: imageWidth, height: imageHeight } = dimensions(image);
  if (imageWidth <= 0 || imageHeight <= 0) return false;

  const layout = atlasLayout(image, spec);
  const count = layout.columns * layout.rows;
  const safeFrame = ((Math.floor(frame) % count) + count) % count;
  const cellWidth = imageWidth / layout.columns;
  const cellHeight = imageHeight / layout.rows;
  const column = safeFrame % layout.columns;
  const row = Math.floor(safeFrame / layout.columns);
  const inset = spec.inset ?? 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(flipX ? -1 : 1, 1);
  ctx.globalAlpha *= clamp01(alpha);
  ctx.drawImage(
    image,
    column * cellWidth + inset,
    row * cellHeight + inset,
    cellWidth - inset * 2,
    cellHeight - inset * 2,
    -width / 2,
    -height / 2,
    width,
    height,
  );
  ctx.restore();
  return true;
}

function drawTrimmedFrame(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  spec: AtlasSpec,
  frame: number,
  x: number,
  y: number,
  targetLongAxis: number,
  rotation = 0,
  alpha = 1,
  flipX = false,
) {
  const image = pack.images.get(spec.id);
  if (!image) return false;
  const imageSize = dimensions(image);
  const layout = atlasLayout(image, spec);
  const frameCount = layout.columns * layout.rows;
  const safeFrame = ((Math.floor(frame) % frameCount) + frameCount) % frameCount;
  const bounds = pack.frameBounds.get(spec.id)?.[safeFrame];
  if (!bounds) {
    return drawFrame(
      ctx,
      pack,
      spec,
      safeFrame,
      x,
      y,
      targetLongAxis,
      targetLongAxis,
      rotation,
      alpha,
      flipX,
    );
  }
  const sourceAspect = bounds.width / Math.max(1, bounds.height);
  const drawWidth =
    sourceAspect >= 1 ? targetLongAxis : targetLongAxis * sourceAspect;
  const drawHeight =
    sourceAspect >= 1 ? targetLongAxis / sourceAspect : targetLongAxis;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(flipX ? -1 : 1, 1);
  ctx.globalAlpha *= clamp01(alpha);
  ctx.drawImage(
    image,
    bounds.x,
    bounds.y,
    Math.min(bounds.width, imageSize.width - bounds.x),
    Math.min(bounds.height, imageSize.height - bounds.y),
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  );
  ctx.restore();
  return true;
}

function directionFrame(direction: number) {
  const tau = Math.PI * 2;
  const normalized = ((direction % tau) + tau) % tau;
  const octant = Math.round(normalized / (Math.PI / 4)) % 8;
  const frames = [
    { frame: 2, flip: false },
    { frame: 1, flip: false },
    { frame: 0, flip: false },
    { frame: 0, flip: true },
    { frame: 2, flip: true },
    { frame: 3, flip: true },
    { frame: 4, flip: false },
    { frame: 3, flip: false },
  ] as const;
  return frames[octant];
}

type FoldDirectionSample = {
  row: 0 | 1 | 2 | 3 | 4;
  flip: boolean;
};

function foldDirectionSample(direction: number): FoldDirectionSample {
  const tau = Math.PI * 2;
  const normalized = ((direction % tau) + tau) % tau;
  const octant = Math.round(normalized / (Math.PI / 4)) % 8;
  return [
    { row: 2, flip: false }, // east
    { row: 1, flip: false }, // south-east
    { row: 0, flip: false }, // south
    { row: 1, flip: true }, // south-west
    { row: 2, flip: true }, // west
    { row: 3, flip: true }, // north-west
    { row: 4, flip: false }, // north
    { row: 3, flip: false }, // north-east
  ][octant] as FoldDirectionSample;
}

type FoldPoseAnchor = {
  collisionX: number;
  collisionY: number;
  socketX: number;
  socketY: number;
};

const FOLD_CELL_WIDTH = 160;
const FOLD_CELL_HEIGHT = 192;
const FOLD_COLLISION_Y: readonly (readonly number[])[] = [
  [143, 143, 143, 143, 142, 142, 142, 142, 137, 132, 129, 128],
  [133, 134, 134, 133, 130, 129, 129, 125, 120, 111, 100, 95],
  [159, 159, 159, 159, 156, 156, 155, 155, 137, 126, 127, 126],
  [141, 144, 145, 145, 140, 142, 144, 144, 132, 124, 125, 125],
  [159, 159, 159, 159, 159, 159, 159, 159, 150, 141, 140, 140],
] as const;
const FOLD_SOCKET_X = [104, 105, 106, 107, 108, 109, 109, 110, 111, 112, 113, 114] as const;
const FOLD_SOCKET_Y = [92, 94, 95, 97, 99, 100, 102, 103, 105, 107, 108, 110] as const;

function lerpNumber(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function foldPoseAt(
  progress: number,
  directionRow: FoldDirectionSample["row"],
): FoldPoseAnchor {
  const phase = Math.min(11, clamp01(progress) * 12);
  const fromIndex = Math.floor(phase);
  const toIndex = Math.min(11, fromIndex + 1);
  const amount = phase - fromIndex;
  return {
    collisionX: FOLD_CELL_WIDTH / 2,
    collisionY: lerpNumber(
      FOLD_COLLISION_Y[directionRow][fromIndex],
      FOLD_COLLISION_Y[directionRow][toIndex],
      amount,
    ),
    socketX: lerpNumber(
      FOLD_SOCKET_X[fromIndex],
      FOLD_SOCKET_X[toIndex],
      amount,
    ),
    socketY: lerpNumber(
      FOLD_SOCKET_Y[fromIndex],
      FOLD_SOCKET_Y[toIndex],
      amount,
    ),
  };
}

export function resolveHeroWeaponSocket(
  x: number,
  y: number,
  size: number,
  direction: number,
  formProgress: number,
): HeroWeaponSocket {
  const facing = foldDirectionSample(direction);
  const pose = foldPoseAt(formProgress, facing.row);
  const drawWidth = size * (FOLD_CELL_WIDTH / FOLD_CELL_HEIGHT);
  const socketDeltaX =
    ((pose.socketX - pose.collisionX) / FOLD_CELL_WIDTH) *
    drawWidth *
    (facing.flip ? -1 : 1);
  const socketDeltaY =
    ((pose.socketY - pose.collisionY) / FOLD_CELL_HEIGHT) * size;
  return {
    x: x + socketDeltaX,
    y: y + socketDeltaY,
    rotation: direction,
  };
}

export function drawHeroSprite(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  options: DrawHeroOptions,
) {
  const {
    x,
    y,
    size,
    direction,
    state,
    time,
    travelled = 0,
    alpha = 1,
  } = options;
  const formProgress = clamp01(options.formProgress);
  const gaitPhase = travelled / Math.max(8, size * 0.12);
  const bob =
    state === "move" ? Math.sin(gaitPhase * Math.PI) * size * 0.018 : 0;
  const hurtJitter = state === "hurt" ? Math.sin(time * 42) * size * 0.025 : 0;
  const facing = directionFrame(direction);
  const withIvorySeparation =
    options.outline === "ink" && needsIvoryHeroSeparation(ctx, x, y, time);
  const directionImage =
    options.outline === "ink"
      ? resolveHeroOutlineImage(
          pack,
          HERO_ATLASES.directions,
          withIvorySeparation,
        )
      : undefined;
  const foldImage =
    options.outline === "ink"
      ? resolveHeroOutlineImage(
          pack,
          HERO_ATLASES.fold,
          withIvorySeparation,
        )
      : undefined;
  if (formProgress <= 0) {
    return drawFrame(
      ctx,
      pack,
      HERO_ATLASES.directions,
      facing.frame,
      x + hurtJitter,
      y - size * 0.14 + bob,
      size,
      size,
      0,
      alpha,
      facing.flip,
      directionImage,
    );
  }

  const foldPhase = Math.min(11, Math.floor(formProgress * 12));
  const foldDirection = foldDirectionSample(direction);
  const pose = foldPoseAt(formProgress, foldDirection.row);
  const drawWidth = size * (FOLD_CELL_WIDTH / FOLD_CELL_HEIGHT);
  const anchoredX =
    x +
    (0.5 - pose.collisionX / FOLD_CELL_WIDTH) * drawWidth +
    hurtJitter;
  const anchoredY =
    y +
    (0.5 - pose.collisionY / FOLD_CELL_HEIGHT) * size +
    bob;
  const foldFrame = foldDirection.row * 12 + foldPhase;
  return drawFrame(
    ctx,
    pack,
    HERO_ATLASES.fold,
    foldFrame,
    anchoredX,
    anchoredY,
    drawWidth,
    size,
    0,
    alpha,
    foldDirection.flip,
    foldImage,
  );
}

function routeKey(route?: string) {
  return route?.split(":").at(-1);
}

function masteryKey(mastery?: string) {
  return mastery?.split(":").at(-1);
}

/**
 * v4 7x2 weapon contract:
 * 0 base, 1 refined,
 * 2..5 route A (III, IV, focus, chain),
 * 6..9 route B, 10..13 route C.
 */
export function resolveWeaponVisualFrame(
  selection: WeaponVisualSelection,
) {
  const level = Math.max(1, Math.min(5, Math.floor(selection.level)));
  if (level <= 1) return 0;
  if (level === 2) return 1;
  const normalizedRoute = routeKey(selection.route);
  const routeOffset =
    normalizedRoute === "b" ? 6 : normalizedRoute === "c" ? 10 : 2;
  if (level === 3) return routeOffset;
  if (level === 4) return routeOffset + 1;
  return routeOffset + (masteryKey(selection.mastery) === "chain" ? 3 : 2);
}

/**
 * Chooses an authored frame without ever manufacturing a placeholder. The
 * requested route frame wins; an unavailable route falls back to the base or
 * first non-empty frame from the same atlas.
 */
export function selectAuthoredStaticFrame(
  availableFrames: readonly boolean[],
  requestedFrame: number,
) {
  if (availableFrames.length === 0) return undefined;
  const requested =
    ((Math.floor(requestedFrame) % availableFrames.length) +
      availableFrames.length) %
    availableFrames.length;
  if (availableFrames[requested]) return requested;
  if (availableFrames[0]) return 0;
  if (availableFrames[1]) return 1;
  const firstAvailable = availableFrames.findIndex(Boolean);
  return firstAvailable >= 0 ? firstAvailable : undefined;
}

function drawAuthoredWeaponFrame(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  weaponId: WeaponId,
  selection: WeaponVisualSelection,
  x: number,
  y: number,
  size: number,
  rotation: number,
  alpha = 1,
) {
  const spec = WEAPON_ATLASES[weaponId];
  if (!spec || !pack.images.has(spec.id)) return false;
  const requestedFrame = resolveWeaponVisualFrame(selection);
  const bounds = pack.frameBounds.get(spec.id);
  const frame = bounds
    ? selectAuthoredStaticFrame(
        bounds.map((candidate) => candidate !== null),
        requestedFrame,
      )
    : requestedFrame;
  if (frame === undefined) return false;
  return drawTrimmedFrame(
    ctx,
    pack,
    spec,
    frame,
    x,
    y,
    size,
    rotation,
    alpha,
  );
}

export function drawStaticVisualFallback(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  options: DrawStaticVisualFallbackOptions,
) {
  if (options.fusionId) {
    const fusionSpec = FUSION_ATLASES[options.fusionId];
    if (
      fusionSpec &&
      pack.images.has(fusionSpec.id) &&
      drawTrimmedFrame(
        ctx,
        pack,
        fusionSpec,
        0,
        options.x,
        options.y,
        options.size,
        options.rotation ?? 0,
        options.alpha,
      )
    ) {
      return true;
    }
  }
  return drawAuthoredWeaponFrame(
    ctx,
    pack,
    options.weaponId,
    {
      level: options.level ?? 1,
      route: options.route,
      mastery: options.mastery,
    },
    options.x,
    options.y,
    options.size,
    options.rotation ?? 0,
    options.alpha,
  );
}

export function drawWeaponSprite(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  options: DrawWeaponOptions,
) {
  const masteryPulse =
    options.level >= 5 ? 1 + Math.sin(options.time * 4.2) * 0.045 : 1;
  const chainTilt =
    options.mastery === "chain" ? Math.sin(options.time * 3.1) * 0.07 : 0;
  return drawAuthoredWeaponFrame(
    ctx,
    pack,
    options.weaponId,
    options,
    options.x,
    options.y,
    options.size * masteryPulse,
    options.rotation + chainTilt,
    options.alpha,
  );
}

function weaponIndex(weaponId: WeaponId) {
  return Math.max(0, WEAPON_ORDER.indexOf(weaponId));
}

export type EffectVisualFamily =
  | "blade"
  | "wind"
  | "rain"
  | "craft"
  | "ledger"
  | "mechanism"
  | "music"
  | "shadow"
  | "lightning";

const VISUAL_FAMILY_HINTS: readonly [
  EffectVisualFamily,
  readonly string[],
][] = [
  ["lightning", ["lightning", "thunder", "celestial", "雷"]],
  ["music", ["music", "pipa", "string", "harmonic", "note", "score", "弦", "音"]],
  ["rain", ["rain", "umbrella", "canopy", "guard", "雨", "伞"]],
  ["shadow", ["shadow", "lantern", "fire", "影", "灯"]],
  ["craft", ["ink", "craft", "scissor", "tailor", "墨", "剪"]],
  ["ledger", ["ledger", "abacus", "pearl", "bead", "珠", "算"]],
  ["wind", ["wind", "fan", "gale", "风", "扇"]],
  ["mechanism", ["mechanism", "crossbow", "bolt", "turret", "弩"]],
  ["blade", ["blade", "sword", "剑"]],
];

export function resolveEffectVisualFamily(options: {
  weaponId: WeaponId;
  visualKey?: string;
  tags?: readonly string[];
}): EffectVisualFamily {
  const haystack = `${options.visualKey ?? ""} ${(options.tags ?? []).join(" ")}`.toLowerCase();
  for (const [family, hints] of VISUAL_FAMILY_HINTS) {
    if (hints.some((hint) => haystack.includes(hint.toLowerCase()))) {
      return family;
    }
  }
  const familyByWeapon: Record<WeaponId, EffectVisualFamily> = {
    sword: "blade",
    fan: "wind",
    umbrella: "rain",
    scissors: "craft",
    abacus: "ledger",
    crossbow: "mechanism",
    pipa: "music",
    inkline: "craft",
    lantern: "shadow",
    thunderSeal: "lightning",
  };
  return familyByWeapon[options.weaponId];
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function drawMusicProjectile(
  ctx: CanvasRenderingContext2D,
  options: DrawProjectileOptions,
) {
  const size = clampNumber(options.size, 15, 38);
  const route = routeKey(options.route);
  const pulse = 1 + Math.sin(options.time * 10.5) * 0.055;
  ctx.save();
  ctx.translate(options.x, options.y);
  ctx.rotate(options.rotation);
  ctx.scale(pulse, pulse);
  ctx.globalAlpha *= clamp01(options.alpha ?? 1);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#28231f";
  ctx.fillStyle = route === "c" ? "#c08a45" : "#78658b";
  ctx.lineWidth = 1.8;

  if (route === "a") {
    ctx.beginPath();
    ctx.arc(-size * 0.12, 0, size * 0.48, -0.72, 0.72);
    ctx.stroke();
  } else if (route === "c") {
    ctx.globalAlpha *= 0.86;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.38, size * 0.24, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, 0);
    ctx.quadraticCurveTo(0, -size * 0.16, size * 0.48, 0);
    ctx.stroke();
  }

  ctx.rotate(Math.PI / 4);
  const bead = size * (route === "b" ? 0.18 : 0.15);
  ctx.fillRect(-bead, -bead, bead * 2, bead * 2);
  ctx.strokeStyle = "#fff1d2";
  ctx.lineWidth = 1.3;
  ctx.strokeRect(-bead, -bead, bead * 2, bead * 2);
  ctx.restore();
  return true;
}

function drawInkProjectile(
  ctx: CanvasRenderingContext2D,
  options: DrawProjectileOptions,
) {
  const size = clampNumber(options.size, 14, 34);
  ctx.save();
  ctx.translate(options.x, options.y);
  ctx.rotate(options.rotation);
  ctx.globalAlpha *= clamp01(options.alpha ?? 1);
  ctx.strokeStyle = "#242725";
  ctx.fillStyle = "#3f5b57";
  ctx.lineCap = "round";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-size * 0.55, 0);
  ctx.quadraticCurveTo(0, -size * 0.1, size * 0.5, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(size * 0.36, 0, size * 0.13, size * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return true;
}

export function drawProjectileSprite(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  options: DrawProjectileOptions,
) {
  const family = resolveEffectVisualFamily(options);
  if (family === "music") return drawMusicProjectile(ctx, options);
  if (
    family === "craft" &&
    /ink|line|rule|score/i.test(options.visualKey ?? "")
  ) {
    return drawInkProjectile(ctx, options);
  }
  const flutter =
    options.weaponId === "fan" ||
    options.weaponId === "pipa" ||
    options.weaponId === "lantern"
      ? Math.sin(options.time * 12) * 0.08
      : 0;
  const routeTilt =
    options.route === "b" ? -0.11 : options.route === "c" ? 0.11 : 0;
  const drawn = drawFrame(
    ctx,
    pack,
    EFFECT_ATLASES.projectiles,
    weaponIndex(options.weaponId),
    options.x,
    options.y,
    options.size * 1.55,
    options.size,
    options.rotation + flutter + routeTilt,
    options.alpha,
  );
  if (drawn && options.mastery === "chain") {
    drawFrame(
      ctx,
      pack,
      EFFECT_ATLASES.projectiles,
      weaponIndex(options.weaponId),
      options.x - Math.cos(options.rotation) * options.size * 0.42,
      options.y - Math.sin(options.rotation) * options.size * 0.42,
      options.size * 1.05,
      options.size * 0.68,
      options.rotation - flutter - routeTilt,
      (options.alpha ?? 1) * 0.55,
    );
  }
  return drawn;
}

function drawMusicImpact(
  ctx: CanvasRenderingContext2D,
  options: DrawImpactOptions,
) {
  const progress = clamp01(options.progress);
  const size = clampNumber(options.size, 20, 104);
  const appear = clamp01(progress / 0.14);
  const disappear = clamp01((1 - progress) / 0.24);
  const alpha = (options.alpha ?? 1) * Math.min(appear, disappear);
  ctx.save();
  ctx.translate(options.x, options.y);
  ctx.rotate(options.rotation ?? 0);
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = "#77648b";
  ctx.lineCap = "round";
  for (let index = 0; index < 3; index += 1) {
    const radius = size * (0.18 + progress * 0.25 + index * 0.09);
    ctx.globalAlpha = alpha * (0.72 - index * 0.14);
    ctx.lineWidth = Math.min(4.5, 1.8 + index * 0.7);
    ctx.beginPath();
    ctx.arc(0, 0, radius, -0.72, 0.72);
    ctx.stroke();
  }
  ctx.fillStyle = "#b94e3d";
  ctx.globalAlpha = alpha * 0.86;
  ctx.beginPath();
  ctx.arc(size * 0.04, 0, Math.max(2, size * 0.035), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return true;
}

export function drawImpactSprite(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  options: DrawImpactOptions,
) {
  if (resolveEffectVisualFamily(options) === "music") {
    return drawMusicImpact(ctx, options);
  }
  const progress = clamp01(options.progress);
  const frame = weaponIndex(options.weaponId);
  const appear = clamp01(progress / 0.16);
  const disappear = clamp01((1 - progress) / 0.22);
  const scale = 0.56 + Math.sin(progress * Math.PI * 0.82) * 0.5;
  const drawn = drawFrame(
    ctx,
    pack,
    EFFECT_ATLASES.impacts,
    frame,
    options.x,
    options.y,
    options.size * scale,
    options.size * scale,
    options.rotation ?? 0,
    (options.alpha ?? 1) * Math.min(appear, disappear),
  );
  if (
    drawn &&
    options.ornament !== false &&
    (options.route || options.mastery)
  ) {
    const supernaturalFrame =
      (weaponIndex(options.weaponId) +
        (options.route === "b" ? 3 : options.route === "c" ? 7 : 0) +
        (options.mastery === "chain" ? 1 : 0)) %
      (EFFECT_ATLASES.supernatural.columns * EFFECT_ATLASES.supernatural.rows);
    drawFrame(
      ctx,
      pack,
      EFFECT_ATLASES.supernatural,
      supernaturalFrame,
      options.x,
      options.y,
      options.size * (0.72 + progress * 0.5),
      options.size * (0.72 + progress * 0.5),
      (options.rotation ?? 0) - progress * 0.55,
      (options.alpha ?? 1) * Math.min(appear, disappear) * 0.58,
    );
  }
  return drawn;
}

export function drawXpPickup(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  options: DrawXpOptions,
) {
  const frame = Math.floor(options.time * 8) % 6;
  const tier = Math.max(1, Math.min(3, Math.round(options.tier))) as 1 | 2 | 3;
  const atlasFrame = (tier - 1) * 6 + frame;
  const baseSize = options.size ?? (tier === 3 ? 36 : tier === 2 ? 28 : 18);
  const magnet = clamp01(options.magnetProgress ?? 0);
  const pulse = 1 + Math.sin(options.time * 7.5 + tier) * 0.055 + magnet * 0.12;
  const targetDx = (options.targetX ?? options.x + 1) - options.x;
  const targetDy = (options.targetY ?? options.y) - options.y;
  const targetLength = Math.hypot(targetDx, targetDy) || 1;
  const targetX = targetDx / targetLength;
  const targetY = targetDy / targetLength;
  const pickupImage = pack.images.get(EFFECT_ATLASES.pickup.id);
  const pickupDimensions = pickupImage ? dimensions(pickupImage) : null;
  const legacySheet =
    pickupDimensions?.width === 1200 && pickupDimensions.height === 600;
  // The original v3 sheet contained generous empty cell margins. Compensate
  // until the tightly packed v4 pickup atlas is installed.
  const legacyContentScale = tier === 1 ? 2.25 : tier === 2 ? 1.55 : 1.35;
  const atlasSize = baseSize * (legacySheet ? legacyContentScale : 1);

  ctx.save();
  ctx.translate(options.x, options.y);
  ctx.rotate(Math.PI / 4 + Math.sin(options.time * 2.4) * 0.035);
  const haloRadius = baseSize * (0.5 + magnet * 0.04);
  ctx.globalAlpha *= clamp01(options.alpha ?? 1);
  ctx.fillStyle =
    tier === 2 ? "rgba(37,33,27,.96)" : "rgba(42,39,33,.9)";
  ctx.strokeStyle = "#fff4d8";
  ctx.lineWidth = tier === 1 ? 2.4 : 3;
  ctx.beginPath();
  ctx.rect(-haloRadius, -haloRadius, haloRadius * 2, haloRadius * 2);
  ctx.fill();
  ctx.stroke();
  if (tier === 2) {
    ctx.strokeStyle = "#e0a429";
    ctx.lineWidth = 3.2;
    ctx.strokeRect(
      -haloRadius * 0.78,
      -haloRadius * 0.78,
      haloRadius * 1.56,
      haloRadius * 1.56,
    );
  } else if (tier === 3) {
    ctx.strokeStyle = "#ba4537";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      -haloRadius * 0.76,
      -haloRadius * 0.76,
      haloRadius * 1.52,
      haloRadius * 1.52,
    );
  }
  ctx.restore();

  if (magnet > 0.05) {
    for (let index = 3; index >= 1; index -= 1) {
      const trailDistance = index * (4 + magnet * 5);
      drawFrame(
        ctx,
        pack,
        EFFECT_ATLASES.pickup,
        atlasFrame,
        options.x -
          targetX * trailDistance -
          targetY * Math.sin(options.time * 9 + index) * 1.5,
        options.y -
          targetY * trailDistance +
          targetX * Math.sin(options.time * 9 + index) * 1.5,
        atlasSize * (0.72 - index * 0.1),
        atlasSize * (0.72 - index * 0.1),
        Math.atan2(targetY, targetX) - magnet * 0.18,
        (options.alpha ?? 1) * magnet * (0.2 - index * 0.035),
      );
    }
  }

  return drawFrame(
    ctx,
    pack,
    EFFECT_ATLASES.pickup,
    atlasFrame,
    options.x,
    options.y,
    atlasSize * pulse,
    atlasSize * pulse,
    Math.sin(options.time * 2.4) * 0.045,
    options.alpha,
  );
}

export function drawFusionSprite(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  options: DrawFusionOptions,
) {
  const spec = FUSION_ATLASES[options.fusionId];
  if (!spec) return false;
  const frame = {
    idle: 0,
    body: 0,
    charged: 1,
    windup: 1,
    attack: 2,
    ultimate: 3,
    finish: 3,
  }[options.phase];
  return drawTrimmedFrame(
    ctx,
    pack,
    spec,
    frame,
    options.x,
    options.y,
    options.size,
    options.rotation,
    options.alpha,
  );
}

export {
  ALL_VISUAL_ASSETS,
  EFFECT_ATLASES,
  FUSION_ATLASES,
  HERO_ATLASES,
  WEAPON_ATLASES,
};
