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
  alpha?: number;
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
  let done = 0;
  const total = specs.length;
  await Promise.all(
    specs.map(async (spec) => {
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
  await loadSpecs(pack, CORE_VISUAL_ASSETS, onProgress);
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

  const count = spec.columns * spec.rows;
  const safeFrame = ((Math.floor(frame) % count) + count) % count;
  const cellWidth = imageWidth / spec.columns;
  const cellHeight = imageHeight / spec.rows;
  const column = safeFrame % spec.columns;
  const row = Math.floor(safeFrame / spec.columns);
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
    alpha = 1,
  } = options;
  const formProgress = clamp01(options.formProgress);
  const bob = state === "move" ? Math.sin(time * 9) * size * 0.018 : 0;
  const hurtJitter = state === "hurt" ? Math.sin(time * 42) * size * 0.025 : 0;
  const groundedY = y - size * 0.14 + bob;

  const facing = directionFrame(direction);
  if (formProgress <= 0.08) {
    return drawFrame(
      ctx,
      pack,
      HERO_ATLASES.directions,
      facing.frame,
      x + hurtJitter,
      groundedY,
      size,
      size,
      0,
      alpha,
      facing.flip,
    );
  }

  const foldFrame = Math.min(11, Math.round(formProgress * 11));
  const crossfade = clamp01((formProgress - 0.08) / 0.18);
  if (crossfade < 1) {
    drawFrame(
      ctx,
      pack,
      HERO_ATLASES.directions,
      facing.frame,
      x + hurtJitter,
      groundedY,
      size * (1 - crossfade * 0.035),
      size * (1 - crossfade * 0.06),
      0,
      alpha * (1 - crossfade),
      facing.flip,
    );
  }
  const squash = 1 - Math.sin(formProgress * Math.PI) * 0.1;
  const foldRotation =
    direction * clamp01((formProgress - 0.62) / 0.34);
  return drawFrame(
    ctx,
    pack,
    HERO_ATLASES.fold,
    foldFrame,
    x + hurtJitter,
    groundedY,
    size * (1 + formProgress * 0.12),
    size * squash,
    foldRotation,
    alpha * Math.max(0.08, crossfade),
  );
}

function weaponFrame(level: number, route?: string) {
  if (level <= 1) return 0;
  if (level === 2) return 1;
  if (level >= 5) return 5;
  if (route === "b") return 3;
  if (route === "c") return 4;
  return 2;
}

export function drawWeaponSprite(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack,
  options: DrawWeaponOptions,
) {
  const spec = WEAPON_ATLASES[options.weaponId];
  if (!spec) return false;
  const frame = weaponFrame(options.level, options.route);
  const masteryPulse =
    options.level >= 5 ? 1 + Math.sin(options.time * 4.2) * 0.045 : 1;
  const chainTilt =
    options.mastery === "chain" ? Math.sin(options.time * 3.1) * 0.07 : 0;
  const drawn = drawFrame(
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
  const routeFrame =
    options.route === "b" ? 3 : options.route === "c" ? 4 : 2;
  if (drawn && options.level === 4) {
    drawFrame(
      ctx,
      pack,
      spec,
      routeFrame,
      options.x + Math.cos(options.rotation) * options.size * 0.24,
      options.y + Math.sin(options.rotation) * options.size * 0.24,
      options.size * 0.38,
      options.size * 0.38,
      options.rotation + 0.74,
      (options.alpha ?? 1) * 0.68,
    );
  }
  if (drawn && options.level >= 5 && options.mastery === "focus") {
    drawFrame(
      ctx,
      pack,
      spec,
      routeFrame,
      options.x + Math.cos(options.rotation) * options.size * 0.31,
      options.y + Math.sin(options.rotation) * options.size * 0.31,
      options.size * 0.34,
      options.size * 0.34,
      options.rotation + Math.PI * 0.52,
      (options.alpha ?? 1) * 0.74,
    );
  }
  if (drawn && options.level >= 5 && options.mastery === "chain") {
    drawFrame(
      ctx,
      pack,
      spec,
      routeFrame,
      options.x - Math.sin(options.rotation) * options.size * 0.24,
      options.y + Math.cos(options.rotation) * options.size * 0.24,
      options.size * 0.58,
      options.size * 0.58,
      options.rotation - 0.32 - chainTilt,
      (options.alpha ?? 1) * 0.76,
    );
  }
  return drawn;
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
  const baseSize = options.size ?? (tier === 3 ? 30 : tier === 2 ? 22 : 16);
  const magnet = clamp01(options.magnetProgress ?? 0);
  const pulse = 1 + Math.sin(options.time * 7.5 + tier) * 0.055 + magnet * 0.12;

  if (magnet > 0.05) {
    for (let index = 3; index >= 1; index -= 1) {
      drawFrame(
        ctx,
        pack,
        EFFECT_ATLASES.pickup,
        atlasFrame,
        options.x - index * (3 + magnet * 4),
        options.y + Math.sin(options.time * 9 + index) * 1.5,
        baseSize * (0.72 - index * 0.1),
        baseSize * (0.72 - index * 0.1),
        -magnet * 0.18,
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
    baseSize * pulse,
    baseSize * pulse,
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
