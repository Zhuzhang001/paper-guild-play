import {
  drawPlayerArt,
  drawSeasonParticles,
  drawSeasonScene,
  type LoadedArt,
} from "./art";
import {
  type EnemySpriteSheets,
} from "./actors/enemySprites";
import { drawEnemyAnimation } from "./visual/enemyAnimation";
import {
  drawFusionSprite,
  drawHeroSprite,
  drawImpactSprite,
  drawProjectileSprite,
  drawWeaponSprite,
  drawXpPickup,
  resolveHeroWeaponSocket,
  type VisualPack,
} from "./visual";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  getOrbitVisuals,
  STANDARD_SECONDS,
  type ProjectileOwner,
  type RunState,
} from "./survivor";
import { getSolarTermState } from "./world";
import { getWeaponDefinition, type FusionId, type WeaponId } from "./content";

export type RenderAssets = {
  seasons: LoadedArt | null;
  enemies: EnemySpriteSheets | null;
  visuals: VisualPack | null;
  solarTerms: HTMLImageElement | null;
};

export type JoystickVisual = {
  active: boolean;
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
};

const fallbackGlyph: Record<WeaponId, string> = {
  sword: "剑",
  fan: "风",
  umbrella: "伞",
  scissors: "裁",
  abacus: "算",
  crossbow: "弩",
  pipa: "音",
  inkline: "矩",
  lantern: "影",
  thunderSeal: "雷",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export async function loadSolarTermAtlas(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = "/terms-v3/solar-terms-runtime.webp";
  });
}

function drawTermMotif(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
  elapsed: number,
) {
  if (!atlas?.complete || atlas.naturalWidth === 0) return;
  const state = getSolarTermState(elapsed, true);
  const sourceWidth = atlas.naturalWidth / 6;
  const sourceHeight = atlas.naturalHeight / 4;
  const sourceInset = 1;
  const column = state.current.index % 6;
  const row = Math.floor(state.current.index / 6);
  const appear = clamp(state.wetInkProgress, 0, 1);
  const pulse = 1 + Math.sin(elapsed * 0.7) * 0.018;

  ctx.save();
  ctx.globalAlpha = 0.7 * appear;
  ctx.translate(GAME_WIDTH - 150, GAME_HEIGHT - 112);
  ctx.scale(pulse, pulse);
  ctx.drawImage(
    atlas,
    column * sourceWidth + sourceInset,
    row * sourceHeight + sourceInset,
    sourceWidth - sourceInset * 2,
    sourceHeight - sourceInset * 2,
    -142,
    -92,
    284,
    184,
  );
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.22 * appear;
  ctx.translate(130, 134);
  ctx.scale(-0.78, 0.78);
  ctx.drawImage(
    atlas,
    column * sourceWidth + sourceInset,
    row * sourceHeight + sourceInset,
    sourceWidth - sourceInset * 2,
    sourceHeight - sourceInset * 2,
    -142,
    -92,
    284,
    184,
  );
  ctx.restore();

  if (state.wetInkProgress < 1) {
    const fade = 1 - state.wetInkProgress;
    const wash = ctx.createRadialGradient(
      GAME_WIDTH * 0.5,
      GAME_HEIGHT * 0.5,
      20,
      GAME_WIDTH * 0.5,
      GAME_HEIGHT * 0.5,
      GAME_WIDTH * 0.65,
    );
    wash.addColorStop(0, `rgba(43,48,43,${0.04 * fade})`);
    wash.addColorStop(0.65, `rgba(43,48,43,${0.2 * fade})`);
    wash.addColorStop(1, "rgba(43,48,43,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}

function ownerWeapon(owner: ProjectileOwner, tags: readonly string[] = []): WeaponId {
  if (!owner.includes(":") && owner !== "terminal") return owner as WeaponId;
  if (tags.includes("lightning")) return "thunderSeal";
  if (tags.includes("music")) return "pipa";
  if (tags.includes("rain") || tags.includes("guard")) return "umbrella";
  if (tags.includes("shadow") || tags.includes("fire")) return "lantern";
  if (tags.includes("craft")) return "inkline";
  if (tags.includes("ledger")) return "abacus";
  if (tags.includes("wind")) return "fan";
  return "sword";
}

function fallbackWeapon(
  ctx: CanvasRenderingContext2D,
  weaponId: WeaponId,
  x: number,
  y: number,
  size: number,
  rotation: number,
  alpha = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha *= alpha;
  ctx.font = `700 ${Math.max(14, size * 0.62)}px "Paper Guild Text", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.strokeStyle = "#f8f0da";
  ctx.fillStyle = getWeaponDefinition(weaponId).color;
  ctx.strokeText(fallbackGlyph[weaponId], 0, 0);
  ctx.fillText(fallbackGlyph[weaponId], 0, 0);
  ctx.restore();
}

function drawWeaponAt(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack | null,
  run: RunState,
  weaponId: WeaponId,
  x: number,
  y: number,
  size: number,
  rotation: number,
  time: number,
  alpha = 1,
) {
  const state = run.build.weapons.find((weapon) => weapon.id === weaponId);
  const route = state?.routeId?.split(":")[1];
  const mastery = state?.masteryId?.split(":")[2];
  const drawn = pack
    ? drawWeaponSprite(ctx, pack, {
        weaponId,
        level: state?.level ?? 1,
        route,
        mastery,
        x,
        y,
        size,
        rotation,
        time,
        alpha,
      })
    : false;
  if (!drawn) fallbackWeapon(ctx, weaponId, x, y, size, rotation, alpha);
}

function weaponVisualProgress(run: RunState, weaponId: WeaponId) {
  const state = run.build.weapons.find((weapon) => weapon.id === weaponId);
  return {
    route: state?.routeId?.split(":")[1],
    mastery: state?.masteryId?.split(":")[2],
  };
}

function drawPickupGlow(ctx: CanvasRenderingContext2D, run: RunState) {
  for (const pickup of run.pickups) {
    const radius = pickup.tier === 3 ? 38 : pickup.tier === 2 ? 30 : 22;
    const gradient = ctx.createRadialGradient(pickup.x, pickup.y, 1, pickup.x, pickup.y, radius);
    gradient.addColorStop(
      0,
      pickup.tier === 3
        ? "rgba(180,62,46,.72)"
        : pickup.tier === 2
          ? "rgba(224,164,41,.74)"
          : "rgba(255,246,214,.72)",
    );
    gradient.addColorStop(0.45, "rgba(255,248,218,.34)");
    gradient.addColorStop(1, "rgba(255,248,218,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPickups(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  time: number,
) {
  for (const pickup of run.pickups) {
    const distance = Math.hypot(pickup.x - run.player.x, pickup.y - run.player.y);
    const magnetProgress = clamp(1 - distance / (150 * run.player.magnetMultiplier), 0, 1);
    const drawn = pack
      ? drawXpPickup(ctx, pack, {
          x: pickup.x,
          y: pickup.y,
          tier: pickup.tier,
          time: time + pickup.id * 0.07,
          size: pickup.tier === 3 ? 36 : pickup.tier === 2 ? 28 : 18,
          magnetProgress,
          targetX: run.player.x,
          targetY: run.player.y,
        })
      : false;
    if (!drawn) {
      const size = pickup.tier === 3 ? 15 : pickup.tier === 2 ? 11 : 8;
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.rotate(Math.PI / 4 + Math.sin(time * 4 + pickup.id) * 0.08);
      ctx.fillStyle = "#fff9e6";
      ctx.strokeStyle = pickup.tier === 3 ? "#a64235" : "#2c2a25";
      ctx.lineWidth = pickup.tier === 3 ? 4 : 3;
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.strokeRect(-size, -size, size * 2, size * 2);
      ctx.fillStyle = "#c34f3e";
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }
  }
}

function drawZones(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  time: number,
) {
  for (const zone of run.zones) {
    const weaponId = ownerWeapon(zone.owner);
    const visual = weaponVisualProgress(run, weaponId);
    const progress = 1 - zone.life / zone.maxLife;
    const drawn = pack
      ? drawImpactSprite(ctx, pack, {
          weaponId,
          ...visual,
          x: zone.x,
          y: zone.y,
          size: zone.radius * 2.2,
          progress: (time * 0.55 + progress) % 1,
          rotation: time * 0.16,
          alpha: clamp(zone.life / 0.45, 0, 0.74),
        })
      : false;
    if (!drawn) {
      ctx.save();
      ctx.globalAlpha = 0.12 + Math.sin(time * 3 + zone.id) * 0.025;
      ctx.strokeStyle = getWeaponDefinition(weaponId).color;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawStrikes(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  time: number,
) {
  for (const strike of run.strikes) {
    const progress = 1 - strike.delay / strike.maxDelay;
    const weaponId: WeaponId = strike.hostile ? "thunderSeal" : ownerWeapon(strike.owner);
    const visual = weaponVisualProgress(run, weaponId);
    const drawn = pack
      ? drawImpactSprite(ctx, pack, {
          weaponId,
          ...visual,
          x: strike.x,
          y: strike.y,
          size: strike.radius * 2,
          progress: clamp(progress * 0.82, 0, 0.82),
          rotation: time * 0.25,
          alpha: 0.58 + progress * 0.32,
        })
      : false;
    if (!drawn) {
      ctx.save();
      ctx.globalAlpha = 0.34 + progress * 0.45;
      ctx.strokeStyle = strike.hostile ? "#6d2830" : "#536e9c";
      ctx.lineWidth = 3 + progress * 5;
      ctx.setLineDash([18, 11]);
      ctx.beginPath();
      ctx.arc(strike.x, strike.y, strike.radius * (0.88 + progress * 0.12), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  time: number,
) {
  for (const projectile of run.projectiles) {
    const weaponId = ownerWeapon(projectile.owner, projectile.tags);
    const visual = weaponVisualProgress(run, weaponId);
    const rotation = Math.atan2(projectile.vy, projectile.vx);
    const drawn = pack
      ? drawProjectileSprite(ctx, pack, {
          weaponId,
          ...visual,
          x: projectile.x,
          y: projectile.y,
          size: Math.max(20, projectile.radius * 3.4),
          rotation,
          time: time + projectile.id * 0.013,
        })
      : false;
    if (!drawn) fallbackWeapon(ctx, weaponId, projectile.x, projectile.y, Math.max(17, projectile.radius * 2.4), rotation, 0.9);
  }
}

function drawSummons(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  time: number,
) {
  for (const summon of run.summons) {
    const weaponId = ownerWeapon(summon.owner);
    drawWeaponAt(
      ctx,
      pack,
      run,
      weaponId,
      summon.x,
      summon.y,
      60,
      Math.atan2(summon.vy, summon.vx) + Math.PI / 2,
      time,
      clamp(summon.life / 0.5, 0, 1),
    );
  }
}

function drawOrbits(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  time: number,
) {
  for (const orbit of getOrbitVisuals(run)) {
    const weaponId = ownerWeapon(orbit.owner);
    for (let index = 0; index < orbit.count; index += 1) {
      const angle = time * orbit.angularSpeed + orbit.phase + (Math.PI * 2 * index) / orbit.count;
      const x = run.player.x + Math.cos(angle) * orbit.radius;
      const y = run.player.y + Math.sin(angle) * orbit.radius;
      drawWeaponAt(ctx, pack, run, weaponId, x, y, 60, angle + Math.PI / 2, time);
    }
  }
}

function drawActiveWeaveNode(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  time: number,
) {
  if (!pack || !run.weave || run.weave.nodes.length === 0) return;
  const node = run.weave.nodes[run.weave.pulse.nodeIndex % run.weave.nodes.length];
  if (node?.kind !== "fusion") return;
  const angle = time * 0.62 - Math.PI / 2;
  const x = run.player.x + Math.cos(angle) * 142;
  const y = run.player.y + Math.sin(angle) * 92;
  drawFusionSprite(ctx, pack, {
    fusionId: node.sourceId as FusionId,
    phase: run.terminalLabelLife > 1.1 ? "ultimate" : "charged",
    x,
    y,
    size: run.terminalLabelLife > 1.1 ? 104 : 74,
    rotation: angle + Math.PI / 2,
    alpha: 0.94,
  });
}

function drawEnemies(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  sheets: EnemySpriteSheets | null,
) {
  for (const actor of run.deaths) {
    drawEnemyAnimation(ctx, sheets, {
      id: actor.enemy.id,
      type: actor.enemy.type,
      x: actor.enemy.x,
      y: actor.enemy.y,
      vx: actor.enemy.vx,
      vy: actor.enemy.vy,
      radius: actor.enemy.radius,
      heading: actor.enemy.heading,
      travelled: actor.enemy.travelled,
      state: "dead",
      stateProgress: 1 - actor.life / 0.72,
      hitFlash: 0,
      elite: actor.enemy.elite,
      boss: actor.enemy.boss,
      bossTier: actor.enemy.bossTier,
    });
  }
  for (const enemy of run.enemies) {
    const velocity = Math.hypot(enemy.vx, enemy.vy);
    const visualHeading =
      enemy.motion === "moving" && velocity > 3
        ? Math.atan2(enemy.vy, enemy.vx)
        : enemy.heading;
    drawEnemyAnimation(ctx, sheets, {
      id: enemy.id,
      type: enemy.type,
      x: enemy.x,
      y: enemy.y,
      vx: enemy.vx,
      vy: enemy.vy,
      radius: enemy.radius,
      heading: visualHeading,
      travelled: enemy.travelled,
      state: enemy.motion,
      stateProgress: enemy.motion === "attacking"
        ? clamp(enemy.motionTime / (enemy.boss ? 1.32 : 0.58), 0, 1)
        : enemy.motion === "hurt"
          ? clamp(enemy.motionTime / 0.12, 0, 1)
          : 0,
      hitFlash: enemy.hitFlash,
      elite: enemy.elite,
      boss: enemy.boss,
      bossTier: enemy.bossTier,
    });
    if (enemy.marked > 0) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.font = `700 ${enemy.boss ? 28 : 18}px "Paper Guild Text", serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#a33d32";
      ctx.fillText("印", enemy.x, enemy.y - enemy.radius * 1.45);
      ctx.restore();
    }
  }
}

function drawBossBars(ctx: CanvasRenderingContext2D, run: RunState) {
  const boss = run.enemies.find((enemy) => enemy.boss && enemy.hp > 0);
  if (!boss) return;
  const width = boss.bossTier === "final" ? 460 : 360;
  const x = (GAME_WIDTH - width) / 2;
  const y = 66;
  ctx.save();
  ctx.fillStyle = "rgba(29,27,23,.72)";
  ctx.fillRect(x - 2, y - 2, width + 4, 12);
  ctx.fillStyle = boss.bossTier === "final" ? "#ad3d32" : "#4c716a";
  ctx.fillRect(x, y, width * clamp(boss.hp / boss.maxHp, 0, 1), 8);
  ctx.fillStyle = "#f9efd9";
  ctx.font = '700 14px "Paper Guild Text", serif';
  ctx.textAlign = "center";
  ctx.fillText(boss.type === "nian" ? "岁夜年兽" : "吞卷饕餮", GAME_WIDTH / 2, y - 9);
  ctx.restore();
}

function drawFx(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  time: number,
  layer: "friendly" | "overlay",
) {
  for (const fx of run.fx) {
    const friendly = fx.owner !== undefined;
    if (
      (layer === "friendly" && !friendly) ||
      (layer === "overlay" && friendly)
    ) {
      continue;
    }
    const progress = 1 - fx.life / fx.maxLife;
    const weaponId: WeaponId = fx.owner
      ? ownerWeapon(fx.owner)
      : fx.artKey.includes("thunder") || fx.artKey.includes("celestial")
      ? "thunderSeal"
      : fx.artKey.includes("fan")
        ? "fan"
        : fx.artKey.includes("umbrella") || fx.artKey.includes("rain")
          ? "umbrella"
          : fx.artKey.includes("pipa") || fx.artKey.includes("music")
            ? "pipa"
            : fx.artKey.includes("lantern") || fx.artKey.includes("nian")
              ? "lantern"
              : "sword";
    const visual = weaponVisualProgress(run, weaponId);

    if (
      fx.kind === "wave" &&
      fx.x2 !== undefined &&
      fx.y2 !== undefined
    ) {
      const dx = fx.x2 - fx.x;
      const dy = fx.y2 - fx.y;
      const distance = Math.hypot(dx, dy);
      const spread = clamp(fx.radius / 105, 0.34, 0.7);
      ctx.save();
      ctx.translate(fx.x, fx.y);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.lineCap = "round";
      ctx.strokeStyle = fx.color;
      for (let index = 0; index < 3; index += 1) {
        const localProgress = clamp(
          progress * 1.32 - index * 0.16,
          0,
          1,
        );
        if (localProgress <= 0) continue;
        const front = distance * (0.14 + localProgress * 0.82);
        ctx.globalAlpha =
          (1 - localProgress) *
          (0.46 - index * 0.07) *
          clamp(fx.life / fx.maxLife + 0.18, 0, 1);
        ctx.lineWidth = Math.min(10, 4.5 + index * 1.2);
        ctx.setLineDash(index === 1 ? [26, 9] : []);
        ctx.beginPath();
        ctx.arc(0, 0, front, -spread, spread);
        ctx.stroke();
      }
      ctx.restore();
    } else if ((fx.kind === "beam" || fx.kind === "chain") && fx.x2 !== undefined && fx.y2 !== undefined) {
      const dx = fx.x2 - fx.x;
      const dy = fx.y2 - fx.y;
      const distance = Math.hypot(dx, dy);
      const count = Math.max(2, Math.ceil(distance / 38));
      for (let index = 0; index <= count; index += 1) {
        const ratio = index / count;
        const x = fx.x + dx * ratio;
        const y = fx.y + dy * ratio;
        const drawn = pack
          ? drawProjectileSprite(ctx, pack, {
              weaponId,
              ...visual,
              x,
              y,
              size: fx.kind === "beam" ? fx.radius * 1.8 : 26,
              rotation: Math.atan2(dy, dx),
              time: time + index * 0.04,
              alpha: clamp(fx.life / fx.maxLife, 0, 0.82),
            })
          : false;
        if (!drawn && index % 2 === 0) fallbackWeapon(ctx, weaponId, x, y, 18, Math.atan2(dy, dx), 0.54);
      }
    } else {
      const drawn = pack
          ? drawImpactSprite(ctx, pack, {
            weaponId,
            ...visual,
            x: fx.x,
            y: fx.y,
            size: fx.radius * 2,
            progress,
            rotation: time * 0.25,
            alpha: clamp(fx.life / Math.min(0.35, fx.maxLife), 0, 1),
          })
        : false;
      if (!drawn) {
        ctx.save();
        ctx.globalAlpha = clamp(fx.life / fx.maxLife, 0, 1) * 0.45;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = Math.max(3, fx.radius * 0.05);
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius * (0.28 + progress * 0.72), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  time: number,
) {
  const motion = samplePlayerVisualMotion(run, time);
  const alpha = run.player.invulnerability > 0 && Math.floor(run.player.invulnerability * 16) % 2 === 0 ? 0.42 : 1;
  const state =
    run.player.invulnerability > 0
      ? "hurt"
      : motion.speed > 8
        ? "move"
        : "idle";
  const transitionFacing =
    run.player.formState === "foldingToPlane" ||
    run.player.formState === "foldingToHuman"
      ? run.player.formFacing
      : run.player.facing;
  const season = getSolarTermState(run.elapsed, run.endless).season;
  const paperSeparator =
    season === "summer" || season === "winter"
      ? "drop-shadow(2.1px 0 0 rgba(248,241,220,.78)) drop-shadow(-2.1px 0 0 rgba(248,241,220,.78)) drop-shadow(0 2.1px 0 rgba(248,241,220,.78)) drop-shadow(0 -2.1px 0 rgba(248,241,220,.78)) "
      : "";
  ctx.save();
  ctx.filter =
    `${paperSeparator}drop-shadow(1.6px 0 0 #211e1a) drop-shadow(-1.6px 0 0 #211e1a) drop-shadow(0 1.6px 0 #211e1a) drop-shadow(0 -1.6px 0 #211e1a)`;
  const drawn = pack
    ? drawHeroSprite(ctx, pack, {
        x: run.player.x,
        y: run.player.y,
        size: 98,
        direction: transitionFacing,
        formProgress: run.player.formProgress,
        state,
        time,
        travelled: motion.travelled,
        alpha,
      })
    : false;
  ctx.restore();
  if (!drawn) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawPlayerArt(ctx, {
      x: run.player.x,
      y: run.player.y,
      invuln: run.player.invulnerability,
      formProgress: run.player.formProgress,
      formState: run.player.formState,
    }, time);
    ctx.restore();
  }

  const held = run.build.weapons[0];
  if (held) {
    const socket = resolveHeroWeaponSocket(
      run.player.x,
      run.player.y,
      98,
      transitionFacing,
      run.player.formProgress,
    );
    drawWeaponAt(
      ctx,
      pack,
      run,
      held.id,
      socket.x,
      socket.y,
      66,
      socket.rotation,
      time,
    );
  }
}

type PlayerVisualMotion = {
  x: number;
  y: number;
  time: number;
  travelled: number;
  speed: number;
};

const PLAYER_VISUAL_MOTION = new WeakMap<RunState, PlayerVisualMotion>();

function samplePlayerVisualMotion(run: RunState, time: number) {
  const previous = PLAYER_VISUAL_MOTION.get(run);
  if (!previous) {
    const initial = {
      x: run.player.x,
      y: run.player.y,
      time,
      travelled: 0,
      speed: 0,
    };
    PLAYER_VISUAL_MOTION.set(run, initial);
    return initial;
  }
  const distance = Math.hypot(
    run.player.x - previous.x,
    run.player.y - previous.y,
  );
  const elapsed = Math.max(1 / 240, Math.min(0.1, time - previous.time));
  const next = {
    x: run.player.x,
    y: run.player.y,
    time,
    travelled: previous.travelled + distance,
    speed: distance / elapsed,
  };
  PLAYER_VISUAL_MOTION.set(run, next);
  return next;
}

function drawJoystick(ctx: CanvasRenderingContext2D, joystick: JoystickVisual) {
  if (!joystick.active) return;
  ctx.save();
  ctx.globalAlpha = 0.56;
  ctx.fillStyle = "rgba(36,34,29,.76)";
  ctx.strokeStyle = "rgba(251,243,222,.82)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(joystick.baseX, joystick.baseY, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f6edd9";
  ctx.beginPath();
  ctx.arc(joystick.knobX, joystick.knobY, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawRun(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  time: number,
  assets: RenderAssets,
  joystick: JoystickVisual,
) {
  const sceneElapsed = run.endless
    ? run.elapsed
    : Math.min(run.elapsed, STANDARD_SECONDS - 0.001);
  if (assets.seasons) {
    drawSeasonScene(ctx, assets.seasons, sceneElapsed, false);
    drawSeasonParticles(ctx, sceneElapsed);
  } else {
    ctx.fillStyle = "#ece4d0";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
  drawTermMotif(ctx, assets.solarTerms, sceneElapsed);
  drawZones(ctx, run, assets.visuals, time);
  drawPickupGlow(ctx, run);
  drawStrikes(ctx, run, assets.visuals, time);
  drawProjectiles(ctx, run, assets.visuals, time);
  drawFx(ctx, run, assets.visuals, time, "friendly");
  drawEnemies(ctx, run, assets.enemies);
  drawPickups(ctx, run, assets.visuals, time);
  drawSummons(ctx, run, assets.visuals, time);
  drawOrbits(ctx, run, assets.visuals, time);
  drawActiveWeaveNode(ctx, run, assets.visuals, time);
  drawPlayer(ctx, run, assets.visuals, time);
  drawFx(ctx, run, assets.visuals, time, "overlay");
  drawBossBars(ctx, run);
  drawJoystick(ctx, joystick);
}

export function drawMenuPreview(
  ctx: CanvasRenderingContext2D,
  time: number,
  assets: RenderAssets,
) {
  if (assets.seasons) drawSeasonScene(ctx, assets.seasons, time * 8, true);
  else {
    ctx.fillStyle = "#ece4d0";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
  drawTermMotif(ctx, assets.solarTerms, time * 8);
  const cycle = time % 5;
  const progress = cycle < 1.45
    ? 0
    : cycle < 1.78
      ? (cycle - 1.45) / 0.33
      : cycle < 3.25
        ? 1
        : cycle < 3.58
          ? 1 - (cycle - 3.25) / 0.33
          : 0;
  const drawn = assets.visuals
    ? drawHeroSprite(ctx, assets.visuals, {
        x: 985,
        y: 350,
        size: 220,
        direction: -0.16,
        formProgress: progress,
        state: progress > 0.96 ? "move" : "idle",
        time,
      })
    : false;
  if (!drawn) {
    ctx.save();
    ctx.translate(985, 350);
    ctx.scale(2.4, 2.4);
    drawPlayerArt(ctx, {
      x: 0,
      y: 0,
      invuln: 0,
      formProgress: progress,
      formState: progress >= 1 ? "plane" : progress <= 0 ? "human" : "foldingToPlane",
    }, time);
    ctx.restore();
  }
}
