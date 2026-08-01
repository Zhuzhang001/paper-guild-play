import type {
  EnemySpriteSheets,
  EnemyVisualId,
} from "../actors/enemySprites";
import type { BossTier, EnemyArchetype } from "../art";

export type EnemyAnimationPose = {
  id: number;
  type: EnemyArchetype;
  visualId?: EnemyVisualId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  heading: number;
  travelled: number;
  state: "moving" | "attacking" | "hurt" | "dead";
  stateProgress: number;
  hitFlash: number;
  elite: boolean;
  boss: boolean;
  bossTier: BossTier;
};

const STRIDE: Readonly<Record<EnemyArchetype, number>> = {
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

const FACING_MEMORY = new Map<
  number,
  { sector: number; travelled: number; type: EnemyArchetype }
>();
const DIRECTION_HYSTERESIS = Math.PI / 24;

function normalizeAngle(angle: number) {
  let result = angle;
  while (result <= -Math.PI) result += Math.PI * 2;
  while (result > Math.PI) result -= Math.PI * 2;
  return result;
}

function facingSector(
  id: number,
  type: EnemyArchetype,
  heading: number,
  travelled: number,
) {
  const requested = ((Math.round(heading / (Math.PI / 4)) % 8) + 8) % 8;
  const previous = FACING_MEMORY.get(id);
  if (
    previous === undefined ||
    previous.type !== type ||
    travelled + 0.01 < previous.travelled
  ) {
    if (FACING_MEMORY.size > 1024) FACING_MEMORY.clear();
    FACING_MEMORY.set(id, { sector: requested, travelled, type });
    return requested;
  }
  const previousAngle = previous.sector * (Math.PI / 4);
  const distance = Math.abs(normalizeAngle(heading - previousAngle));
  if (distance > Math.PI / 8 + DIRECTION_HYSTERESIS) {
    FACING_MEMORY.set(id, { sector: requested, travelled, type });
    return requested;
  }
  previous.travelled = travelled;
  return previous.sector;
}

function authoredFacing(sector: number) {
  const samples: ReadonlyArray<{
    row: 0 | 1 | 2;
    mirror: boolean;
    baseAngle: number;
  }> = [
    { row: 1, mirror: false, baseAngle: 0 },
    { row: 1, mirror: false, baseAngle: 0 },
    { row: 0, mirror: false, baseAngle: Math.PI / 2 },
    { row: 1, mirror: true, baseAngle: Math.PI },
    { row: 1, mirror: true, baseAngle: Math.PI },
    { row: 1, mirror: true, baseAngle: -Math.PI },
    { row: 2, mirror: false, baseAngle: -Math.PI / 2 },
    { row: 1, mirror: false, baseAngle: 0 },
  ];
  const sample = samples[sector];
  const target = normalizeAngle(sector * (Math.PI / 4));
  return {
    ...sample,
    rotation: normalizeAngle(target - sample.baseAngle),
  };
}

function gaitTransform(pose: EnemyAnimationPose) {
  const stridePhase =
    (Math.max(0, pose.travelled) / STRIDE[pose.type]) * Math.PI;
  const moving = Math.hypot(pose.vx, pose.vy) > 3 && pose.state === "moving";
  if (!moving) return { lift: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  const wave = Math.sin(stridePhase);
  const absoluteWave = Math.abs(wave);
  switch (pose.type) {
    case "cup":
      return {
        lift: -absoluteWave * pose.radius * 0.08,
        rotation: wave * 0.025,
        scaleX: 1 + absoluteWave * 0.02,
        scaleY: 1 - absoluteWave * 0.025,
      };
    case "shoe":
      return {
        lift: -absoluteWave * pose.radius * 0.1,
        rotation: wave * 0.045,
        scaleX: 1,
        scaleY: 1,
      };
    case "lantern":
      return {
        lift: -absoluteWave * pose.radius * 0.045,
        rotation: wave * 0.035,
        scaleX: 1 - absoluteWave * 0.01,
        scaleY: 1 + absoluteWave * 0.025,
      };
    case "fish":
      return {
        lift: wave * pose.radius * 0.025,
        rotation: wave * 0.055,
        scaleX: 1 + absoluteWave * 0.018,
        scaleY: 1 - absoluteWave * 0.018,
      };
    case "abacus":
      return {
        lift: -absoluteWave * pose.radius * 0.025,
        rotation: 0,
        scaleX: 1 + wave * 0.022,
        scaleY: 1 - wave * 0.012,
      };
    case "rib":
      return {
        lift: -absoluteWave * pose.radius * 0.035,
        rotation: wave * 0.025,
        scaleX: 1 + absoluteWave * 0.025,
        scaleY: 1 - absoluteWave * 0.02,
      };
    default:
      return {
        lift: -absoluteWave * pose.radius * 0.045,
        rotation: wave * 0.018,
        scaleX: 1 + absoluteWave * 0.012,
        scaleY: 1 - absoluteWave * 0.015,
      };
  }
}

function drawFallback(
  ctx: CanvasRenderingContext2D,
  pose: EnemyAnimationPose,
) {
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.heading + Math.PI / 2);
  ctx.globalAlpha = pose.state === "dead" ? 0.28 : 0.86;
  ctx.fillStyle = pose.boss ? "#9d4339" : pose.elite ? "#4f6e65" : "#2c2b28";
  ctx.beginPath();
  ctx.moveTo(0, -pose.radius * 1.35);
  ctx.bezierCurveTo(
    pose.radius,
    -pose.radius,
    pose.radius,
    pose.radius * 0.75,
    0,
    pose.radius * 1.05,
  );
  ctx.bezierCurveTo(
    -pose.radius,
    pose.radius * 0.75,
    -pose.radius,
    -pose.radius,
    0,
    -pose.radius * 1.35,
  );
  ctx.fill();
  ctx.restore();
}

export function drawEnemyAnimation(
  ctx: CanvasRenderingContext2D,
  sheets: EnemySpriteSheets | null,
  pose: EnemyAnimationPose,
) {
  const image = sheets?.[pose.visualId ?? pose.type];
  if (!image?.complete || image.naturalWidth <= 0) {
    drawFallback(ctx, pose);
    return;
  }

  const speed = Math.hypot(pose.vx, pose.vy);
  const motionHeading =
    pose.state === "moving" && speed > 3
      ? Math.atan2(pose.vy, pose.vx)
      : pose.heading;
  const sector = facingSector(
    pose.id,
    pose.type,
    motionHeading,
    pose.travelled,
  );
  const facing = authoredFacing(sector);
  const stateProgress = Math.max(0, Math.min(1, pose.stateProgress));
  const usesEndlessBossAtlas =
    pose.visualId !== undefined && pose.visualId !== pose.type;
  let row: number = facing.row;
  let column =
    speed > 3 && pose.state === "moving"
      ? Math.floor(Math.max(0, pose.travelled) / STRIDE[pose.type]) % 4
      : 0;
  let spriteMirror = facing.mirror;
  let spriteRotation = facing.rotation;

  if (usesEndlessBossAtlas) {
    // The authored v6 Boss sheets devote complete rows to idle, travel,
    // attacks, and hurt/death. Keep these figures upright and mirror the
    // side-facing travel row instead of rotating a painted person as if it
    // were a top-down token.
    spriteMirror = Math.cos(motionHeading) < 0;
    spriteRotation = 0;
    if (pose.state === "dead") {
      row = 3;
      column = Math.min(3, 2 + Math.floor(stateProgress * 2));
    } else if (pose.state === "hurt") {
      row = 3;
      column = Math.min(1, Math.floor(stateProgress * 2));
    } else if (pose.state === "attacking") {
      row = 2;
      column = Math.min(3, Math.floor(stateProgress * 4));
    } else if (speed > 3) {
      row = 1;
      column = Math.floor(Math.max(0, pose.travelled) / STRIDE[pose.type]) % 4;
    } else {
      row = 0;
      column = Math.floor((pose.id + pose.travelled / 24) % 4);
    }
  } else if (pose.state === "attacking") {
    row = 3;
    column = Math.min(2, Math.floor(stateProgress * 3));
  } else if (pose.state === "hurt") {
    column = 1;
  } else if (pose.state === "dead") {
    row = 3;
    column = 3;
  }

  const sourceWidth = image.naturalWidth / 4;
  const sourceHeight = image.naturalHeight / 4;
  const scale = pose.boss ? 4.55 : pose.elite ? 4.35 : 4.1;
  const destinationSize = pose.radius * scale;
  const gait = gaitTransform(pose);
  const attackCurve = Math.sin(stateProgress * Math.PI);
  const attackPush = pose.state === "attacking"
    ? attackCurve * pose.radius * (pose.boss ? 0.16 : 0.1)
    : 0;
  const deathDrop = pose.state === "dead"
    ? stateProgress * pose.radius * 0.18
    : 0;

  ctx.save();
  ctx.translate(
    pose.x + Math.cos(motionHeading) * attackPush,
    pose.y + Math.sin(motionHeading) * attackPush + gait.lift + deathDrop,
  );
  ctx.rotate(
    spriteRotation +
      gait.rotation +
      (pose.state === "dead" ? stateProgress * 0.08 : 0),
  );
  if (spriteMirror) ctx.scale(-1, 1);
  const attackScale =
    pose.state === "attacking" ? 1 + attackCurve * 0.065 : 1;
  ctx.scale(
    gait.scaleX * attackScale,
    gait.scaleY * (2 - attackScale),
  );
  if (pose.state === "hurt") {
    ctx.translate(-Math.cos(motionHeading) * pose.radius * 0.05, 0);
  }
  if (pose.hitFlash > 0 && Math.floor(pose.hitFlash * 90) % 2 === 0) {
    ctx.globalAlpha = 0.5;
    ctx.globalCompositeOperation = "screen";
  }
  if (pose.state === "dead") {
    ctx.globalAlpha *= Math.max(0, 1 - stateProgress);
  }
  ctx.drawImage(
    image,
    column * sourceWidth + 1,
    row * sourceHeight + 1,
    sourceWidth - 2,
    sourceHeight - 2,
    -destinationSize / 2,
    -destinationSize * 0.54,
    destinationSize,
    destinationSize,
  );
  ctx.restore();

  if (pose.state === "dead" && stateProgress >= 0.95) {
    FACING_MEMORY.delete(pose.id);
  }
}
