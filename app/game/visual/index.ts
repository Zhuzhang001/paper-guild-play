import type { FusionId, WeaponId } from "../content/types";
import {
  ALL_VISUAL_ASSETS,
  CORE_VISUAL_ASSETS,
  EFFECT_ATLASES,
  FUSION_ATLASES,
  HERO_ATLASES,
  WEAPON_ATLASES,
  type AtlasSpec,
} from "./manifest";

type VisualImage = HTMLImageElement | ImageBitmap;

export type VisualPack = {
  readonly images: Map<string, VisualImage>;
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
  phase: "idle" | "charged" | "attack" | "ultimate";
  x: number;
  y: number;
  size: number;
  rotation: number;
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
      const response = await fetch(src, { cache: "force-cache" });
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
    image.src = src;
  });
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
        pack.images.set(spec.id, await loadImage(spec.src));
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
) {
  const image = pack.images.get(spec.id);
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

export function drawWeaponSprite(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  options: DrawWeaponOptions,
) {
  const spec = WEAPON_ATLASES[options.weaponId];
  if (!spec) return false;
  const frame = resolveWeaponVisualFrame(options);
  const masteryPulse =
    options.level >= 5 ? 1 + Math.sin(options.time * 4.2) * 0.045 : 1;
  const chainTilt =
    options.mastery === "chain" ? Math.sin(options.time * 3.1) * 0.07 : 0;
  return drawFrame(
    ctx,
    pack,
    spec,
    frame,
    options.x,
    options.y,
    options.size * masteryPulse,
    options.size * masteryPulse,
    options.rotation + chainTilt,
    options.alpha,
  );
}

function weaponIndex(weaponId: WeaponId) {
  return Math.max(0, WEAPON_ORDER.indexOf(weaponId));
}

export function drawProjectileSprite(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  options: DrawProjectileOptions,
) {
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

export function drawImpactSprite(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  options: DrawImpactOptions,
) {
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
  if (drawn && (options.route || options.mastery)) {
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
    charged: 1,
    attack: 2,
    ultimate: 3,
  }[options.phase];
  return drawFrame(
    ctx,
    pack,
    spec,
    frame,
    options.x,
    options.y,
    options.size,
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
