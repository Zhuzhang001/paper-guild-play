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
  drawStaticVisualFallback,
  drawWeaponSprite,
  drawXpPickup,
  resolveEffectVisualFamily,
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
  type VisualFx,
} from "./survivor";
import { getSolarTermState } from "./world";
import {
  FUSION_DEFINITIONS,
  FUSIONS_BY_ID,
  SYNERGY_DEFINITIONS,
  getWeaponDefinition,
  type FusionId,
  type WeaponId,
} from "./content";

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

const WEAPON_IDS = new Set<WeaponId>([
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
]);

const VISUAL_WEAPON_HINTS: readonly [
  WeaponId,
  readonly string[],
][] = [
  ["thunderSeal", ["thunder", "lightning", "celestial", "雷"]],
  ["pipa", ["pipa", "music", "string", "harmonic", "note", "score", "弦", "音"]],
  ["umbrella", ["umbrella", "canopy", "rain", "guard", "伞", "雨"]],
  ["lantern", ["lantern", "shadow", "fire", "灯", "影"]],
  ["inkline", ["inkline", "ink", "rule", "craft", "墨"]],
  ["scissors", ["scissor", "tailor", "cut", "剪"]],
  ["abacus", ["abacus", "ledger", "pearl", "bead", "算", "珠"]],
  ["crossbow", ["crossbow", "bolt", "turret", "mechanism", "弩"]],
  ["fan", ["fan", "wind", "gale", "扇", "风"]],
  ["sword", ["sword", "blade", "剑"]],
];

const FUSION_ART_LOOKUP = new Map<string, FusionId>();
for (const definition of FUSION_DEFINITIONS) {
  FUSION_ART_LOOKUP.set(definition.artKey.toLowerCase(), definition.id);
  FUSION_ART_LOOKUP.set(definition.terminalArtKey.toLowerCase(), definition.id);
}

const SYNERGY_BY_ID = new Map(
  SYNERGY_DEFINITIONS.map((definition) => [definition.id, definition]),
);

type EffectVisualSource = {
  weaponId: WeaponId;
  fusionId?: FusionId;
  visualKey: string;
  tags: readonly string[];
};

function isWeaponId(value: string): value is WeaponId {
  return WEAPON_IDS.has(value as WeaponId);
}

function isFusionId(value: string): value is FusionId {
  return Object.prototype.hasOwnProperty.call(FUSIONS_BY_ID, value);
}

function weaponFromVisualHints(
  visualKey: string,
  tags: readonly string[],
  candidates?: readonly WeaponId[],
) {
  const allowed = candidates?.length ? new Set(candidates) : WEAPON_IDS;
  const keyOnly = visualKey.toLowerCase();
  for (const [weaponId, hints] of VISUAL_WEAPON_HINTS) {
    if (
      allowed.has(weaponId) &&
      hints.some((hint) => keyOnly.includes(hint.toLowerCase()))
    ) {
      return weaponId;
    }
  }
  const tagText = tags.join(" ").toLowerCase();
  for (const [weaponId, hints] of VISUAL_WEAPON_HINTS) {
    if (
      allowed.has(weaponId) &&
      hints.some((hint) => tagText.includes(hint.toLowerCase()))
    ) {
      return weaponId;
    }
  }
  return candidates?.[0] ?? "sword";
}

function fusionIdFromVisual(
  run: RunState,
  owner: ProjectileOwner | undefined,
  visualKey: string,
) {
  if (owner?.startsWith("fusion:")) {
    const id = owner.slice("fusion:".length);
    if (isFusionId(id)) return id;
  }
  if (owner?.startsWith("weave:") && run.weave) {
    const instanceId = owner.slice("weave:".length);
    const node = run.weave.nodes.find(
      (candidate) => candidate.instanceId === instanceId,
    );
    if (node?.kind === "fusion" && isFusionId(node.sourceId)) {
      return node.sourceId;
    }
  }
  const normalizedKey = visualKey.toLowerCase();
  const directMatch = normalizedKey.match(/fusion[/:]([a-z0-9_-]+)/i)?.[1];
  if (directMatch) {
    if (isFusionId(directMatch)) return directMatch;
    const byNormalizedId = FUSION_DEFINITIONS.find(
      (definition) =>
        definition.id.toLowerCase() === directMatch.toLowerCase(),
    );
    if (byNormalizedId) return byNormalizedId.id;
  }
  for (const [artKey, fusionId] of FUSION_ART_LOOKUP) {
    if (normalizedKey.includes(artKey)) return fusionId;
  }
  if (owner === "terminal" && run.weave?.nodes.length) {
    const node =
      run.weave.nodes[
        run.weave.pulse.nodeIndex % run.weave.nodes.length
      ];
    if (node?.kind === "fusion" && isFusionId(node.sourceId)) {
      return node.sourceId;
    }
  }
  return undefined;
}

function resolveEffectVisualSource(
  run: RunState,
  owner: ProjectileOwner | undefined,
  visualKey: string,
  providedTags: readonly string[] = [],
): EffectVisualSource {
  if (owner && isWeaponId(owner)) {
    return {
      weaponId: owner,
      visualKey,
      tags: providedTags,
    };
  }

  const fusionId = fusionIdFromVisual(run, owner, visualKey);
  if (fusionId) {
    const definition = FUSIONS_BY_ID[fusionId];
    const tags = providedTags.length ? providedTags : definition.tags;
    return {
      weaponId: weaponFromVisualHints(
        `${visualKey} ${fusionId}`,
        tags,
        definition.weapons,
      ),
      fusionId,
      visualKey,
      tags,
    };
  }

  if (owner?.startsWith("weave:") && run.weave) {
    const instanceId = owner.slice("weave:".length);
    const node = run.weave.nodes.find(
      (candidate) => candidate.instanceId === instanceId,
    );
    if (node?.kind === "weapon" && isWeaponId(node.sourceId)) {
      return {
        weaponId: node.sourceId,
        visualKey,
        tags: providedTags,
      };
    }
  }

  if (owner?.startsWith("synergy:")) {
    const definition = SYNERGY_BY_ID.get(owner.slice("synergy:".length));
    if (definition) {
      const tags = providedTags.length
        ? providedTags
        : [...new Set(definition.effects.flatMap((effect) => effect.tags))];
      return {
        weaponId: weaponFromVisualHints(
          visualKey,
          tags,
          definition.weapons,
        ),
        visualKey,
        tags,
      };
    }
  }

  const hintedWeapon = weaponFromVisualHints(visualKey, providedTags);
  return {
    weaponId:
      owner && owner !== "terminal"
        ? ownerWeapon(owner, providedTags)
        : hintedWeapon,
    visualKey,
    tags: providedTags,
  };
}

function drawAuthoredStaticSubject(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack | null,
  run: RunState,
  source: Pick<EffectVisualSource, "weaponId" | "fusionId">,
  x: number,
  y: number,
  size: number,
  rotation: number,
  alpha = 1,
) {
  if (!pack) return false;
  const state = run.build.weapons.find(
    (weapon) => weapon.id === source.weaponId,
  );
  return drawStaticVisualFallback(ctx, pack, {
    weaponId: source.weaponId,
    fusionId: source.fusionId,
    level: state?.level ?? 1,
    route: state?.routeId?.split(":")[1],
    mastery: state?.masteryId?.split(":")[2],
    x,
    y,
    size,
    rotation,
    alpha,
  });
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
  if (!drawn) {
    drawAuthoredStaticSubject(
      ctx,
      pack,
      run,
      { weaponId },
      x,
      y,
      size,
      rotation,
      alpha,
    );
  }
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
    const source = resolveEffectVisualSource(
      run,
      zone.owner,
      zone.artKey,
    );
    const visual = weaponVisualProgress(run, source.weaponId);
    const progress = 1 - zone.life / zone.maxLife;
    const alpha = clamp(zone.life / 0.45, 0, 0.58);
    let drawn = false;
    if (pack && source.fusionId) {
      drawn = drawFusionSprite(ctx, pack, {
        fusionId: source.fusionId,
        phase: "attack",
        x: zone.x,
        y: zone.y,
        size: clamp(zone.radius * 0.58, 62, 96),
        rotation: time * 0.12,
        alpha: alpha * 0.48,
      });
    }
    if (!drawn && pack) {
      drawn = drawImpactSprite(ctx, pack, {
        weaponId: source.weaponId,
        ...visual,
        x: zone.x,
        y: zone.y,
        size: clamp(zone.radius * 0.9, 66, 148),
        progress: (time * 0.55 + progress) % 1,
        rotation: time * 0.16,
        alpha,
        visualKey: source.visualKey,
        tags: source.tags,
        fusionId: source.fusionId,
        ornament: false,
      });
    }
    if (!drawn) {
      drawAuthoredStaticSubject(
        ctx,
        pack,
        run,
        source,
        zone.x,
        zone.y,
        clamp(zone.radius * 0.44, 34, 76),
        time * 0.12,
        alpha * 0.66,
      );
    }
    // The dashed line communicates the actual collision boundary; it is not
    // used as a replacement for the authored subject at the zone's centre.
    ctx.save();
    ctx.globalAlpha = 0.2 + Math.sin(time * 2.4 + zone.id) * 0.025;
    ctx.strokeStyle = getWeaponDefinition(source.weaponId).color;
    ctx.lineWidth = clamp(zone.radius * 0.045, 3, 8);
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawStrikes(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  enemySheets: EnemySpriteSheets | null,
  time: number,
) {
  for (const strike of run.strikes) {
    const progress = 1 - strike.delay / strike.maxDelay;
    const source = strike.hostile
      ? {
          weaponId: "thunderSeal" as const,
          visualKey: strike.artKey,
          tags: ["lightning"] as const,
        }
      : resolveEffectVisualSource(run, strike.owner, strike.artKey);
    const visual = weaponVisualProgress(run, source.weaponId);
    let drawn = strike.hostile
      ? drawEndlessBossEffect(
          ctx,
          enemySheets,
          strike.artKey,
          strike.x,
          strike.y,
          strike.radius,
          progress,
          0.82,
        )
      : false;
    if (pack && "fusionId" in source && source.fusionId) {
      drawn = drawFusionSprite(ctx, pack, {
        fusionId: source.fusionId,
        phase: progress < 0.62 ? "charged" : "ultimate",
        x: strike.x,
        y: strike.y,
        size: clamp(strike.radius * 0.86, 52, 118),
        rotation: time * 0.2,
        alpha: 0.5 + progress * 0.34,
      });
    }
    if (!drawn && pack) {
      drawn = drawImpactSprite(ctx, pack, {
        weaponId: source.weaponId,
        ...visual,
        x: strike.x,
        y: strike.y,
        size: clamp(strike.radius * 0.92, 48, 126),
        progress: clamp(progress * 0.82, 0, 0.82),
        rotation: time * 0.25,
        alpha: 0.58 + progress * 0.32,
        visualKey: source.visualKey,
        tags: source.tags,
        fusionId: "fusionId" in source ? source.fusionId : undefined,
      });
    }
    if (!drawn) {
      drawAuthoredStaticSubject(
        ctx,
        pack,
        run,
        source,
        strike.x,
        strike.y,
        clamp(strike.radius * 0.48, 34, 82),
        time * 0.2,
        0.46 + progress * 0.36,
      );
    }
    // A thin telegraph remains visible regardless of asset state, while the
    // strike's visual subject always comes from authored art.
    ctx.save();
    ctx.globalAlpha = 0.24 + progress * 0.3;
    ctx.strokeStyle = strike.hostile ? "#6d2830" : "#536e9c";
    ctx.lineWidth = clamp(2 + progress * 1.8, 2, 4);
    ctx.setLineDash([18, 11]);
    ctx.beginPath();
    ctx.arc(
      strike.x,
      strike.y,
      strike.radius * (0.88 + progress * 0.12),
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
  }
}

const BOSS_EFFECT_FRAMES: readonly [string, number][] = [
  ["troupe-master-crossing", 0],
  ["troupe-master-curtain", 1],
  ["troupe-master-cast", 2],
  ["chief-clerk-ledger", 4],
  ["chief-clerk-seal", 5],
  ["chief-clerk-runners", 6],
  ["night-watch-patrol", 8],
  ["night-watch-bell", 9],
  ["night-watch-third-call", 9],
  ["kiln-foreman-coals", 10],
  ["kiln-foreman-heat", 11],
  ["kiln-foreman-hammer", 10],
  ["siege-tower-bolts", 13],
  ["siege-tower-crew", 12],
  ["siege-tower-ram", 12],
  ["banner-captain-spear", 15],
  ["banner-captain-rally", 14],
  ["banner-captain-arrows", 13],
  ["lingering-ground", 11],
];

function drawEndlessBossEffect(
  ctx: CanvasRenderingContext2D,
  sheets: EnemySpriteSheets | null,
  artKey: string,
  x: number,
  y: number,
  radius: number,
  progress: number,
  alpha: number,
) {
  const frame = BOSS_EFFECT_FRAMES.find(([hint]) => artKey.includes(hint))?.[1];
  const image = sheets?.bossEffects;
  if (frame === undefined || !image?.complete || image.naturalWidth <= 0) {
    return false;
  }
  const sourceWidth = image.naturalWidth / 4;
  const sourceHeight = image.naturalHeight / 4;
  const width = clamp(radius * 1.7, 52, 196);
  const height = width / 1.5;
  const fadeIn = clamp(progress / 0.16, 0, 1);
  const fadeOut = clamp((1 - progress) / 0.24, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha * Math.min(fadeIn, fadeOut);
  ctx.translate(x, y);
  ctx.scale(0.92 + Math.sin(progress * Math.PI) * 0.08, 0.92 + progress * 0.08);
  ctx.drawImage(
    image,
    (frame % 4) * sourceWidth + 1,
    Math.floor(frame / 4) * sourceHeight + 1,
    sourceWidth - 2,
    sourceHeight - 2,
    -width / 2,
    -height / 2,
    width,
    height,
  );
  ctx.restore();
  return true;
}

function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  time: number,
) {
  const fusionAttackDrawn = new Set<FusionId>();
  for (const projectile of run.projectiles) {
    const source = resolveEffectVisualSource(
      run,
      projectile.owner,
      projectile.artKey,
      projectile.tags,
    );
    const visual = weaponVisualProgress(run, source.weaponId);
    const rotation = Math.atan2(projectile.vy, projectile.vx);
    if (
      pack &&
      source.fusionId &&
      !fusionAttackDrawn.has(source.fusionId)
    ) {
      fusionAttackDrawn.add(source.fusionId);
      drawFusionSprite(ctx, pack, {
        fusionId: source.fusionId,
        phase: "attack",
        x: projectile.x - Math.cos(rotation) * 14,
        y: projectile.y - Math.sin(rotation) * 14,
        size: clamp(42 + projectile.radius * 0.35, 42, 54),
        rotation,
        alpha: 0.42,
      });
    }
    const visualSize = clamp(17 + projectile.radius * 0.9, 20, 38);
    const drawn = pack
      ? drawProjectileSprite(ctx, pack, {
          weaponId: source.weaponId,
          ...visual,
          x: projectile.x,
          y: projectile.y,
          size: visualSize,
          rotation,
          time: time + projectile.id * 0.013,
          visualKey: source.visualKey,
          tags: source.tags,
          fusionId: source.fusionId,
        })
      : false;
    if (!drawn) {
      drawAuthoredStaticSubject(
        ctx,
        pack,
        run,
        source,
        projectile.x,
        projectile.y,
        clamp(15 + projectile.radius * 0.65, 17, 30),
        rotation,
        0.9,
      );
    }
  }
}

function drawSummons(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  time: number,
) {
  for (const summon of run.summons) {
    const source = resolveEffectVisualSource(run, summon.owner, summon.artKey);
    const rotation = Math.atan2(summon.vy, summon.vx) + Math.PI / 2;
    const alpha = clamp(summon.life / 0.5, 0, 1);
    const fusionDrawn =
      pack && source.fusionId
        ? drawFusionSprite(ctx, pack, {
            fusionId: source.fusionId,
            phase: "attack",
            x: summon.x,
            y: summon.y,
            size: 60,
            rotation,
            alpha,
          })
        : false;
    const shadowSummon =
      /shadow|player|puppet|lantern|string/i.test(summon.artKey);
    const shadowDrawn =
      !fusionDrawn && shadowSummon && pack
        ? drawProjectileSprite(ctx, pack, {
            weaponId: source.weaponId,
            x: summon.x,
            y: summon.y,
            size: 48,
            rotation,
            time: time + summon.id * 0.03,
            alpha,
            visualKey: source.visualKey,
            tags: source.tags,
          })
        : false;
    if (!fusionDrawn && !shadowDrawn) {
      drawWeaponAt(
        ctx,
        pack,
        run,
        source.weaponId,
        summon.x,
        summon.y,
        60,
        rotation,
        time,
        alpha,
      );
    }
  }
}

function drawOrbits(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  time: number,
) {
  for (const orbit of getOrbitVisuals(run)) {
    const source = resolveEffectVisualSource(run, orbit.owner, orbit.artKey);
    for (let index = 0; index < orbit.count; index += 1) {
      const angle = time * orbit.angularSpeed + orbit.phase + (Math.PI * 2 * index) / orbit.count;
      const x = run.player.x + Math.cos(angle) * orbit.radius;
      const y = run.player.y + Math.sin(angle) * orbit.radius;
      const fusionDrawn =
        index === 0 && pack && source.fusionId
          ? drawFusionSprite(ctx, pack, {
              fusionId: source.fusionId,
              phase: "attack",
              x,
              y,
              size: 52,
              rotation: angle + Math.PI / 2,
              alpha: 0.82,
            })
          : false;
      const atomDrawn =
        !fusionDrawn && source.fusionId && pack
          ? drawProjectileSprite(ctx, pack, {
              weaponId: source.weaponId,
              x,
              y,
              size: 30,
              rotation: angle + Math.PI / 2,
              time: time + index * 0.05,
              visualKey: source.visualKey,
              tags: source.tags,
              fusionId: source.fusionId,
            })
          : false;
      if (!fusionDrawn && !atomDrawn) {
        drawWeaponAt(
          ctx,
          pack,
          run,
          source.weaponId,
          x,
          y,
          60,
          angle + Math.PI / 2,
          time,
        );
      }
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
  const fusionId = node.sourceId as FusionId;
  const drawn = drawFusionSprite(ctx, pack, {
    fusionId,
    phase: run.terminalLabelLife > 1.1 ? "ultimate" : "charged",
    x,
    y,
    size: run.terminalLabelLife > 1.1 ? 104 : 74,
    rotation: angle + Math.PI / 2,
    alpha: 0.94,
  });
  if (!drawn) {
    drawAuthoredStaticSubject(
      ctx,
      pack,
      run,
      {
        weaponId: FUSIONS_BY_ID[fusionId].weapons[0],
        fusionId,
      },
      x,
      y,
      run.terminalLabelLife > 1.1 ? 88 : 68,
      angle + Math.PI / 2,
      0.94,
    );
  }
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
      visualId: actor.enemy.endlessBossId ?? actor.enemy.type,
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
      visualId: enemy.endlessBossId ?? enemy.type,
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
  const bosses = run.enemies
    .filter((enemy) => enemy.boss && enemy.hp > 0)
    .slice(0, 3);
  if (bosses.length === 0) return;
  const traitNames: Record<string, string> = {
    quickRecovery: "快收",
    reinforcements: "带队",
    lingeringGround: "留场",
    delayedRepeat: "复招",
  };
  ctx.save();
  for (let index = 0; index < bosses.length; index += 1) {
    const boss = bosses[index];
    const width = boss.bossTier === "final" ? 460 : bosses.length > 1 ? 330 : 360;
    const x = (GAME_WIDTH - width) / 2;
    const y = 66 + index * 34;
    const traits = (boss.bossTraits ?? [])
      .map((trait) => traitNames[trait] ?? trait)
      .join(" · ");
    ctx.fillStyle = "rgba(29,27,23,.72)";
    ctx.fillRect(x - 2, y - 2, width + 4, 12);
    ctx.fillStyle = boss.bossTier === "final" ? "#ad3d32" : "#4c716a";
    ctx.fillRect(x, y, width * clamp(boss.hp / boss.maxHp, 0, 1), 8);
    ctx.fillStyle = "#f9efd9";
    ctx.font = '700 14px "Paper Guild Text", serif';
    ctx.textAlign = "center";
    ctx.fillText(
      `${boss.bossName ?? (boss.type === "nian" ? "岁夜年兽" : "吞卷饕餮")}${traits ? ` · ${traits}` : ""}`,
      GAME_WIDTH / 2,
      y - 9,
    );
  }
  ctx.restore();
}

function drawEffectCap(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack | null,
  source: EffectVisualSource,
  x: number,
  y: number,
  size: number,
  rotation: number,
  alpha: number,
) {
  if (!pack) return false;
  return drawStaticVisualFallback(ctx, pack, {
    weaponId: source.weaponId,
    fusionId: source.fusionId,
    level: 1,
    x,
    y,
    size: clamp(size, 14, 34),
    rotation,
    alpha,
  });
}

function drawWaveVisual(
  ctx: CanvasRenderingContext2D,
  fx: VisualFx,
  progress: number,
) {
  if (fx.x2 === undefined || fx.y2 === undefined) return;
  const dx = fx.x2 - fx.x;
  const dy = fx.y2 - fx.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return;
  const halfSpan = clamp(18 + fx.radius * 0.22, 22, 36);
  ctx.save();
  ctx.translate(fx.x, fx.y);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.lineCap = "round";
  ctx.strokeStyle = fx.color;
  for (let index = 0; index < 3; index += 1) {
    const localProgress = clamp(progress * 1.28 - index * 0.15, 0, 1);
    if (localProgress <= 0) continue;
    const front = clamp(
      distance * (0.16 + localProgress * 0.78) - index * 13,
      18,
      distance,
    );
    const localHalfSpan = Math.min(36, halfSpan - index * 3);
    const bow = 8 + localProgress * 10 + index * 2;
    ctx.globalAlpha =
      (1 - localProgress) *
      (0.48 - index * 0.075) *
      clamp(fx.life / fx.maxLife + 0.2, 0, 1);
    ctx.lineWidth = Math.min(10, 4.2 + index * 1.15);
    ctx.setLineDash(index === 1 ? [18, 8] : []);
    ctx.beginPath();
    ctx.moveTo(front - 5, -localHalfSpan);
    ctx.quadraticCurveTo(front + bow, 0, front - 5, localHalfSpan);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBeamVisual(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack | null,
  source: EffectVisualSource,
  fx: VisualFx,
  progress: number,
) {
  if (fx.x2 === undefined || fx.y2 === undefined) return;
  const dx = fx.x2 - fx.x;
  const dy = fx.y2 - fx.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return;
  const angle = Math.atan2(dy, dx);
  const middleX = fx.x + dx * 0.5;
  const middleY = fx.y + dy * 0.5;
  const thickness = clamp(4 + fx.radius * 0.16, 4, 24);
  const fade = clamp(fx.life / fx.maxLife, 0, 1);

  ctx.save();
  ctx.globalAlpha = fade * 0.68;
  ctx.lineCap = "round";
  ctx.lineWidth = thickness;
  const gradient = ctx.createLinearGradient(fx.x, fx.y, fx.x2, fx.y2);
  gradient.addColorStop(0, "rgba(255,245,218,.18)");
  gradient.addColorStop(0.2, fx.color);
  gradient.addColorStop(0.82, fx.color);
  gradient.addColorStop(1, "rgba(255,245,218,.28)");
  ctx.strokeStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(fx.x + Math.cos(angle) * 8, fx.y + Math.sin(angle) * 8);
  ctx.quadraticCurveTo(
    middleX - Math.sin(angle) * Math.min(10, thickness * 0.35),
    middleY + Math.cos(angle) * Math.min(10, thickness * 0.35),
    fx.x2,
    fx.y2,
  );
  ctx.stroke();
  ctx.restore();

  let fusionCapsDrawn = false;
  if (pack && source.fusionId) {
    const spriteSize = clamp(32 + thickness * 0.85, 36, 56);
    fusionCapsDrawn = drawFusionSprite(ctx, pack, {
      fusionId: source.fusionId,
      phase: "windup",
      x: fx.x,
      y: fx.y,
      size: spriteSize,
      rotation: angle,
      alpha: fade * 0.52,
    });
    fusionCapsDrawn = drawFusionSprite(ctx, pack, {
      fusionId: source.fusionId,
      phase: "attack",
      x: middleX,
      y: middleY,
      size: spriteSize,
      rotation: angle,
      alpha: fade * 0.46,
    }) || fusionCapsDrawn;
    fusionCapsDrawn = drawFusionSprite(ctx, pack, {
      fusionId: source.fusionId,
      phase: "finish",
      x: fx.x2,
      y: fx.y2,
      size: spriteSize,
      rotation: angle,
      alpha: fade * 0.58,
    }) || fusionCapsDrawn;
    if (fusionCapsDrawn) return;
  }

  drawEffectCap(ctx, pack, source, fx.x, fx.y, thickness * 1.35, angle, fade * 0.58);
  drawEffectCap(
    ctx,
    pack,
    source,
    fx.x2,
    fx.y2,
    thickness * 1.55,
    angle,
    fade * 0.74,
  );
  if (progress > 0.16 && progress < 0.82) {
    drawEffectCap(
      ctx,
      pack,
      source,
      middleX,
      middleY,
      thickness,
      angle,
      fade * 0.38,
    );
  }
}

function drawChainVisual(
  ctx: CanvasRenderingContext2D,
  pack: VisualPack | null,
  source: EffectVisualSource,
  fx: VisualFx,
) {
  if (fx.x2 === undefined || fx.y2 === undefined) return;
  const dx = fx.x2 - fx.x;
  const dy = fx.y2 - fx.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return;
  const angle = Math.atan2(dy, dx);
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const family = resolveEffectVisualFamily({
    weaponId: source.weaponId,
    visualKey: source.visualKey,
    tags: source.tags,
  });
  const amplitude =
    family === "lightning" ? Math.min(12, distance * 0.08) : Math.min(7, distance * 0.045);
  const fade = clamp(fx.life / fx.maxLife, 0, 1);

  ctx.save();
  ctx.globalAlpha = fade * 0.74;
  ctx.strokeStyle = fx.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = family === "lightning" ? 4.2 : family === "music" ? 3.2 : 2.8;
  ctx.beginPath();
  ctx.moveTo(fx.x, fx.y);
  ctx.lineTo(
    fx.x + dx * 0.34 + normalX * amplitude,
    fx.y + dy * 0.34 + normalY * amplitude,
  );
  ctx.lineTo(
    fx.x + dx * 0.68 - normalX * amplitude * 0.7,
    fx.y + dy * 0.68 - normalY * amplitude * 0.7,
  );
  ctx.lineTo(fx.x2, fx.y2);
  ctx.stroke();
  ctx.restore();

  const fusionCapDrawn = pack && source.fusionId
    ? drawFusionSprite(ctx, pack, {
      fusionId: source.fusionId,
      phase: "finish",
      x: fx.x2,
      y: fx.y2,
      size: 28,
      rotation: angle,
      alpha: fade * 0.38,
    })
    : false;
  if (!fusionCapDrawn) {
    drawEffectCap(ctx, pack, source, fx.x2, fx.y2, 18, angle, fade * 0.7);
  }
}

function drawFx(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  pack: VisualPack | null,
  enemySheets: EnemySpriteSheets | null,
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
    const source = resolveEffectVisualSource(
      run,
      fx.owner,
      fx.artKey,
    );
    const visual = weaponVisualProgress(run, source.weaponId);

    if (
      fx.kind === "wave" &&
      fx.x2 !== undefined &&
      fx.y2 !== undefined
    ) {
      drawWaveVisual(ctx, fx, progress);
    } else if (fx.kind === "beam") {
      drawBeamVisual(ctx, pack, source, fx, progress);
    } else if (fx.kind === "chain") {
      drawChainVisual(ctx, pack, source, fx);
    } else {
      let drawn = !friendly
        ? drawEndlessBossEffect(
            ctx,
            enemySheets,
            fx.artKey,
            fx.x,
            fx.y,
            fx.radius,
            progress,
            fx.kind === "warning" ? 0.42 : 0.82,
          )
        : false;
      if (pack && source.fusionId) {
        const phase =
          fx.kind === "warning"
            ? "windup"
            : fx.kind === "terminal"
              ? "finish"
              : fx.kind === "hit" || fx.kind === "burst"
                ? "finish"
                : "attack";
        drawn = drawFusionSprite(ctx, pack, {
          fusionId: source.fusionId,
          phase,
          x: fx.x,
          y: fx.y,
          size:
            fx.kind === "terminal"
              ? 96
              : clamp(28 + fx.radius * 0.42, 34, 78),
          rotation: time * 0.16,
          alpha: clamp(fx.life / Math.min(0.35, fx.maxLife), 0, 0.78),
        });
      }
      if (!drawn && pack) {
        drawn = drawImpactSprite(ctx, pack, {
          weaponId: source.weaponId,
          ...visual,
          x: fx.x,
          y: fx.y,
          size:
            fx.kind === "terminal"
              ? 108
              : clamp(24 + fx.radius * 0.55, 30, 132),
          progress,
          rotation: time * 0.25,
          alpha: clamp(fx.life / Math.min(0.35, fx.maxLife), 0, 1),
          visualKey: source.visualKey,
          tags: source.tags,
          fusionId: source.fusionId,
          ornament: fx.kind !== "warning",
        });
      }
      if (!drawn) {
        drawAuthoredStaticSubject(
          ctx,
          pack,
          run,
          source,
          fx.x,
          fx.y,
          fx.kind === "terminal"
            ? 86
            : clamp(20 + fx.radius * 0.34, 26, 72),
          time * 0.2,
          clamp(fx.life / fx.maxLife, 0, 1) * 0.62,
        );
      }
      if (fx.kind === "warning" || fx.kind === "ring") {
        ctx.save();
        ctx.globalAlpha =
          clamp(fx.life / fx.maxLife, 0, 1) *
          (fx.kind === "warning" ? 0.46 : 0.3);
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = clamp(fx.radius * 0.035, 3, 8);
        ctx.setLineDash(fx.kind === "warning" ? [16, 10] : []);
        ctx.beginPath();
        ctx.arc(
          fx.x,
          fx.y,
          fx.radius * (0.9 + progress * 0.1),
          0,
          Math.PI * 2,
        );
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
        outline: "ink",
      })
    : false;
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
  drawStrikes(ctx, run, assets.visuals, assets.enemies, time);
  drawProjectiles(ctx, run, assets.visuals, time);
  drawFx(ctx, run, assets.visuals, assets.enemies, time, "friendly");
  drawEnemies(ctx, run, assets.enemies);
  drawPickups(ctx, run, assets.visuals, time);
  drawSummons(ctx, run, assets.visuals, time);
  drawOrbits(ctx, run, assets.visuals, time);
  drawActiveWeaveNode(ctx, run, assets.visuals, time);
  drawPlayer(ctx, run, assets.visuals, time);
  drawFx(ctx, run, assets.visuals, assets.enemies, time, "overlay");
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
        outline: "ink",
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
