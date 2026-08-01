import type { EnemyArchetype } from "../art";
import type { EndlessBossId } from "../content/bosses";
import { publicAsset } from "../../publicAsset";

export type EnemyVisualId = EnemyArchetype | EndlessBossId | "bossEffects";

export type EnemyMotionState = "moving" | "attacking" | "hurt" | "dead";

export type EnemySpritePose = {
  type: EnemyArchetype;
  visualId?: EnemyVisualId;
  x: number;
  y: number;
  radius: number;
  heading: number;
  travelled: number;
  state: EnemyMotionState;
  stateProgress: number;
  hitFlash: number;
  elite: boolean;
  boss: boolean;
};

export type EnemySpriteSheets = Partial<Record<EnemyVisualId, HTMLImageElement>>;

const SPRITE_URLS: Record<EnemyVisualId, string> = {
  cup: "/enemies-v3/cup-runtime.webp",
  shoe: "/enemies-v3/shoe-runtime.webp",
  lantern: "/enemies-v3/lantern-runtime.webp",
  fish: "/enemies-v3/fish-runtime.webp",
  abacus: "/enemies-v3/abacus-runtime.webp",
  rib: "/enemies-v3/umbrella-runtime.webp",
  lion: "/enemies-v3/lion-runtime.webp",
  puppet: "/enemies-v3/puppet-runtime.webp",
  taotie: "/enemies-v3/taotie-runtime.webp",
  nian: "/enemies-v3/nian-runtime.webp",
  troupeMaster: "/enemies-v6/boss-opera-master-v6.webp",
  chiefClerk: "/enemies-v6/boss-ledger-clerk-v6.webp",
  nightWatch: "/enemies-v6/boss-night-watchman-v6.webp",
  kilnForeman: "/enemies-v6/boss-kiln-overseer-v6.webp",
  siegeTower: "/enemies-v6/boss-siege-cart-v6.webp",
  bannerCaptain: "/enemies-v6/boss-banner-officer-v6.webp",
  bossEffects: "/enemies-v6/boss-effects-v6.webp",
};

const STRIDE: Record<EnemyArchetype, number> = {
  cup: 17,
  shoe: 22,
  lantern: 19,
  fish: 24,
  abacus: 14,
  rib: 15,
  lion: 27,
  puppet: 24,
  taotie: 30,
  nian: 34,
};

const BOOT_ENEMIES: readonly EnemyArchetype[] = ["cup", "shoe", "fish", "rib"];
const sheetLoads = new WeakMap<
  EnemySpriteSheets,
  Map<EnemyVisualId, Promise<void>>
>();
const retainedSheets = new WeakMap<EnemySpriteSheets, Set<EnemyVisualId>>();

function withBossEffects(types: readonly EnemyVisualId[]) {
  const requested = new Set<EnemyVisualId>(types);
  if (types.some((type) => ENDLESS_BOSS_IDS.has(type))) {
    requested.add("bossEffects");
  }
  return requested;
}

const ENDLESS_BOSS_IDS = new Set<EnemyVisualId>([
  "troupeMaster",
  "chiefClerk",
  "nightWatch",
  "kilnForeman",
  "siegeTower",
  "bannerCaptain",
]);

function releaseSheet(image: HTMLImageElement | undefined) {
  if (!image) return;
  image.removeAttribute("src");
  image.src = "";
}

function loadSheet(sheets: EnemySpriteSheets, type: EnemyVisualId) {
  if (sheets[type]) return Promise.resolve();
  let loads = sheetLoads.get(sheets);
  if (!loads) {
    loads = new Map();
    sheetLoads.set(sheets, loads);
  }
  const pending = loads.get(type);
  if (pending) return pending;
  const request = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (retainedSheets.get(sheets)?.has(type) ?? true) {
        sheets[type] = image;
      } else {
        releaseSheet(image);
      }
      loads?.delete(type);
      resolve();
    };
    image.onerror = () => {
      loads?.delete(type);
      resolve();
    };
    image.src = publicAsset(SPRITE_URLS[type]);
  });
  loads.set(type, request);
  return request;
}

export async function loadEnemySpriteSheets(
  onProgress?: (progress: number) => void,
): Promise<EnemySpriteSheets> {
  const entries = Object.entries(SPRITE_URLS) as Array<[EnemyVisualId, string]>;
  const sheets: EnemySpriteSheets = {};
  const bootEnemySet = new Set<EnemyVisualId>(BOOT_ENEMIES);
  retainedSheets.set(sheets, bootEnemySet);
  const bootEntries = entries.filter(([type]) => bootEnemySet.has(type));
  let complete = 0;
  await Promise.all(bootEntries.map(async ([type]) => {
    await loadSheet(sheets, type);
    complete += 1;
    onProgress?.(complete / bootEntries.length);
  }));
  return sheets;
}

export async function preloadEnemySpriteSheets(
  sheets: EnemySpriteSheets,
  types: readonly EnemyVisualId[],
) {
  const requested = withBossEffects(types);
  const retained = retainedSheets.get(sheets) ?? new Set<EnemyVisualId>();
  requested.forEach((type) => retained.add(type));
  retainedSheets.set(sheets, retained);
  await Promise.all([...requested].map((type) => loadSheet(sheets, type)));
}

/**
 * Atomically retains active archetypes plus the one preselected Boss. Stale
 * in-flight decodes are discarded when they complete.
 */
export async function retainEnemySpriteSheets(
  sheets: EnemySpriteSheets,
  types: readonly EnemyVisualId[],
) {
  const keep = withBossEffects(types);
  retainedSheets.set(sheets, keep);
  for (const type of Object.keys(sheets) as EnemyVisualId[]) {
    if (keep.has(type)) continue;
    releaseSheet(sheets[type]);
    delete sheets[type];
  }
  await Promise.all([...keep].map((type) => loadSheet(sheets, type)));
}

export function releaseEnemySpriteSheets(sheets: EnemySpriteSheets) {
  retainedSheets.set(sheets, new Set());
  for (const type of Object.keys(sheets) as EnemyVisualId[]) {
    releaseSheet(sheets[type]);
    delete sheets[type];
  }
  sheetLoads.get(sheets)?.clear();
}

function normalizeAngle(angle: number) {
  let result = angle;
  while (result <= -Math.PI) result += Math.PI * 2;
  while (result > Math.PI) result -= Math.PI * 2;
  return result;
}

type FacingSample = {
  row: 0 | 1 | 2;
  mirror: boolean;
  rotation: number;
};

/**
 * Authored sheets contain south/east/north views. Diagonals are produced by
 * rotating the closest authored view by at most 45 degrees, while west reuses
 * the east view as a true mirror. The resulting head direction always follows
 * the actor velocity instead of letting the sprite slide sideways.
 */
function facingSample(heading: number): FacingSample {
  const angle = normalizeAngle(heading);
  const sector = Math.round(angle / (Math.PI / 4));
  const wrapped = (sector + 8) % 8;
  const baseBySector: Array<{ row: 0 | 1 | 2; mirror: boolean; angle: number }> = [
    { row: 1, mirror: false, angle: 0 },
    { row: 1, mirror: false, angle: 0 },
    { row: 0, mirror: false, angle: Math.PI / 2 },
    { row: 1, mirror: true, angle: Math.PI },
    { row: 1, mirror: true, angle: Math.PI },
    { row: 1, mirror: true, angle: -Math.PI },
    { row: 2, mirror: false, angle: -Math.PI / 2 },
    { row: 1, mirror: false, angle: 0 },
  ];
  const base = baseBySector[wrapped];
  const target = sector * (Math.PI / 4);
  return {
    row: base.row,
    mirror: base.mirror,
    rotation: normalizeAngle(target - base.angle),
  };
}

function drawFallbackSilhouette(
  ctx: CanvasRenderingContext2D,
  pose: EnemySpritePose,
) {
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.heading + Math.PI / 2);
  ctx.fillStyle = pose.boss ? "#9d4339" : pose.elite ? "#4f6e65" : "#2c2b28";
  ctx.globalAlpha = pose.state === "dead" ? 0.32 : 0.88;
  ctx.beginPath();
  ctx.moveTo(0, -pose.radius * 1.4);
  ctx.bezierCurveTo(
    pose.radius * 0.95,
    -pose.radius,
    pose.radius * 1.05,
    pose.radius * 0.75,
    0,
    pose.radius * 1.1,
  );
  ctx.bezierCurveTo(
    -pose.radius * 1.05,
    pose.radius * 0.75,
    -pose.radius * 0.95,
    -pose.radius,
    0,
    -pose.radius * 1.4,
  );
  ctx.fill();
  ctx.restore();
}

export function drawEnemySprite(
  ctx: CanvasRenderingContext2D,
  sheets: EnemySpriteSheets | null,
  pose: EnemySpritePose,
) {
  const image = sheets?.[pose.visualId ?? pose.type];
  if (!image || !image.complete || image.naturalWidth === 0) {
    drawFallbackSilhouette(ctx, pose);
    return;
  }

  let row: number;
  let column: number;
  let mirror = false;
  let rotation = 0;

  if (pose.state === "dead") {
    row = 3;
    column = 3;
  } else if (pose.state === "attacking") {
    row = 3;
    column = Math.max(0, Math.min(2, Math.floor(pose.stateProgress * 3)));
  } else {
    const sample = facingSample(pose.heading);
    row = sample.row;
    mirror = sample.mirror;
    rotation = sample.rotation;
    column = Math.floor(Math.max(0, pose.travelled) / STRIDE[pose.type]) % 4;
    if (pose.state === "hurt") column = 1;
  }

  const sourceWidth = image.naturalWidth / 4;
  const sourceHeight = image.naturalHeight / 4;
  const sourceInset = 1;
  const scale = pose.boss ? 4.55 : pose.elite ? 4.35 : 4.1;
  const destinationSize = pose.radius * scale;
  const attackScale = pose.state === "attacking"
    ? 1 + Math.sin(Math.min(1, pose.stateProgress) * Math.PI) * 0.08
    : 1;

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(rotation);
  if (mirror) ctx.scale(-1, 1);
  ctx.scale(attackScale, attackScale);
  if (pose.hitFlash > 0 && Math.floor(pose.hitFlash * 90) % 2 === 0) {
    ctx.globalAlpha = 0.46;
    ctx.globalCompositeOperation = "screen";
  }
  if (pose.state === "dead") {
    ctx.globalAlpha *= Math.max(0, 1 - pose.stateProgress);
  }
  ctx.drawImage(
    image,
    column * sourceWidth + sourceInset,
    row * sourceHeight + sourceInset,
    sourceWidth - sourceInset * 2,
    sourceHeight - sourceInset * 2,
    -destinationSize / 2,
    -destinationSize * 0.54,
    destinationSize,
    destinationSize,
  );
  ctx.restore();
}
