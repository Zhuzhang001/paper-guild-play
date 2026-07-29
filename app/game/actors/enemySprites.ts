import type { EnemyArchetype } from "../art";

export type EnemyMotionState = "moving" | "attacking" | "hurt" | "dead";

export type EnemySpritePose = {
  type: EnemyArchetype;
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

export type EnemySpriteSheets = Partial<Record<EnemyArchetype, HTMLImageElement>>;

const SPRITE_URLS: Record<EnemyArchetype, string> = {
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
const STANDARD_DEFERRED_ENEMIES: readonly EnemyArchetype[] = [
  "lantern",
  "abacus",
  "lion",
  "puppet",
];

function loadSheet(sheets: EnemySpriteSheets, type: EnemyArchetype) {
  if (sheets[type]) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      sheets[type] = image;
      resolve();
    };
    image.onerror = () => resolve();
    image.src = SPRITE_URLS[type];
  });
}

export async function loadEnemySpriteSheets(
  onProgress?: (progress: number) => void,
): Promise<EnemySpriteSheets> {
  const entries = Object.entries(SPRITE_URLS) as Array<[EnemyArchetype, string]>;
  const sheets: EnemySpriteSheets = {};
  const bootEntries = entries.filter(([type]) => BOOT_ENEMIES.includes(type));
  let complete = 0;
  await Promise.all(bootEntries.map(async ([type]) => {
    await loadSheet(sheets, type);
    complete += 1;
    onProgress?.(complete / bootEntries.length);
  }));

  const hydrate = () => {
    void Promise.all(
      STANDARD_DEFERRED_ENEMIES.map((type) => loadSheet(sheets, type)),
    );
  };
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(hydrate, { timeout: 1800 });
  } else if (typeof window !== "undefined") {
    globalThis.setTimeout(hydrate, 0);
  }
  return sheets;
}

export async function preloadEnemySpriteSheets(
  sheets: EnemySpriteSheets,
  types: readonly EnemyArchetype[],
) {
  await Promise.all(types.map((type) => loadSheet(sheets, type)));
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
  const image = sheets?.[pose.type];
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
