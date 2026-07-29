import type { PlayerFormState } from "./form";

export type BossTier = "mid" | "final" | null;

export type EnemyArchetype =
  | "cup"
  | "shoe"
  | "lantern"
  | "fish"
  | "abacus"
  | "rib"
  | "lion"
  | "puppet"
  | "taotie"
  | "nian";

export type SeasonScene = {
  name: string;
  image: string;
  accent: string;
  particle: "petal" | "rain" | "leaf" | "snow";
};

export type ArtAssetManifest = {
  seasons: SeasonScene[];
  enemies: Record<EnemyArchetype, string>;
};

export type LoadedArt = {
  seasons: Array<HTMLImageElement | null>;
  enemies: Partial<Record<EnemyArchetype, HTMLImageElement>>;
};

export const ART_MANIFEST: ArtAssetManifest = {
  seasons: [
    { name: "惊蛰 · 春桥", image: "/art/season-spring-runtime.webp", accent: "#b3655a", particle: "petal" },
    { name: "小暑 · 荷塘", image: "/art/season-summer-runtime.webp", accent: "#547b72", particle: "rain" },
    { name: "霜降 · 稻埂", image: "/art/season-autumn-runtime.webp", accent: "#a87842", particle: "leaf" },
    { name: "大寒 · 岁市", image: "/art/season-winter-runtime.webp", accent: "#9d4339", particle: "snow" },
  ],
  enemies: {
    cup: "/art/enemy-cup.webp",
    shoe: "/art/enemy-shoe.webp",
    lantern: "/art/enemy-lantern.webp",
    fish: "/art/enemy-fish.webp",
    abacus: "/art/enemy-abacus.webp",
    rib: "/art/enemy-umbrella.webp",
    lion: "/art/elite-lion.webp",
    puppet: "/art/elite-puppet.webp",
    taotie: "/art/boss-taotie.webp",
    nian: "/art/boss-nian.webp",
  },
};

export async function loadArtAssets(onProgress: (progress: number) => void): Promise<LoadedArt> {
  const seasonEntries = ART_MANIFEST.seasons.map((season) => season.image);
  const total = seasonEntries.length;
  let loaded = 0;

  const load = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.onload = () => {
        loaded += 1;
        onProgress(loaded / total);
        resolve(image);
      };
      image.onerror = () => {
        loaded += 1;
        onProgress(loaded / total);
        resolve(null);
      };
      image.src = src;
    });

  const seasons = await Promise.all(seasonEntries.map(load));

  return {
    seasons,
    // Directional multi-frame sheets are loaded by enemySprites.ts. Keeping
    // this map empty avoids downloading the retired single-pose cutouts.
    enemies: {},
  };
}

export function seasonIndex(elapsed: number) {
  return Math.floor((elapsed % 480) / 120) % 4;
}

function ease(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x = 0, alpha = 1) {
  const W = 1280;
  const H = 720;
  const scale = Math.max(W / image.naturalWidth, H / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, x + (W - width) / 2, (H - height) / 2, width, height);
  ctx.restore();
}

export function drawSeasonScene(
  ctx: CanvasRenderingContext2D,
  art: LoadedArt | null,
  elapsed: number,
  menu = false,
) {
  const W = 1280;
  const H = 720;
  ctx.fillStyle = "#eee6d4";
  ctx.fillRect(0, 0, W, H);
  const index = seasonIndex(elapsed);
  const current = art?.seasons[index];

  if (current) {
    const sinceBoundary = elapsed % 120;
    const transitioning = elapsed >= 120 && sinceBoundary < 6;
    if (transitioning) {
      const previousIndex = (index + 3) % 4;
      const previous = art?.seasons[previousIndex];
      const p = ease(sinceBoundary / 6);
      if (previous) drawCover(ctx, previous, -p * 90, 1 - p);
      drawCover(ctx, current, (1 - p) * 90, p);
      ctx.save();
      const bleed = ctx.createRadialGradient(W * p, H / 2, 12, W * p, H / 2, 240);
      bleed.addColorStop(0, "rgba(41,39,34,.18)");
      bleed.addColorStop(1, "rgba(41,39,34,0)");
      ctx.fillStyle = bleed;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else {
      drawCover(ctx, current);
    }
  } else {
    const wash = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, W * 0.7);
    wash.addColorStop(0, "#f4eddc");
    wash.addColorStop(1, "#d6cbb5");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.save();
  ctx.globalAlpha = menu ? 0.12 : 0.055;
  ctx.strokeStyle = "#5e574c";
  for (let i = 0; i < 30; i++) {
    const y = 13 + i * 25;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(320, y + 3, 940, y - 4, W, y + 1);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSeasonParticles(ctx: CanvasRenderingContext2D, elapsed: number) {
  const scene = ART_MANIFEST.seasons[seasonIndex(elapsed)];
  const W = 1280;
  const H = 720;
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = scene.accent;
  ctx.fillStyle = scene.accent;
  for (let i = 0; i < 28; i++) {
    const x = (i * 67 + elapsed * (scene.particle === "rain" ? 90 : 13)) % W;
    const y = (i * 103 + elapsed * (scene.particle === "snow" ? 17 : 31)) % H;
    if (scene.particle === "rain") {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y + 24);
      ctx.stroke();
    } else if (scene.particle === "snow") {
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(elapsed + i);
      ctx.beginPath();
      ctx.ellipse(0, 0, scene.particle === "leaf" ? 6 : 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

export type RenderEnemy = {
  id: number;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  type: EnemyArchetype;
  hitFlash: number;
  marked: number;
  elite: boolean;
  boss: boolean;
  bossTier: BossTier;
};

function fallbackEnemy(ctx: CanvasRenderingContext2D, enemy: RenderEnemy) {
  const color = enemy.boss ? "#a84739" : enemy.elite ? "#526b61" : "#e8dcc4";
  ctx.fillStyle = color;
  ctx.strokeStyle = "#292722";
  ctx.lineWidth = enemy.boss ? 5 : 3;
  ctx.beginPath();
  ctx.moveTo(0, -enemy.r);
  ctx.bezierCurveTo(enemy.r * 0.8, -enemy.r * 0.75, enemy.r, enemy.r * 0.3, 0, enemy.r);
  ctx.bezierCurveTo(-enemy.r, enemy.r * 0.3, -enemy.r * 0.8, -enemy.r * 0.75, 0, -enemy.r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f4ead4";
  ctx.beginPath();
  ctx.arc(-enemy.r * 0.28, -enemy.r * 0.1, Math.max(3, enemy.r * 0.12), 0, Math.PI * 2);
  ctx.arc(enemy.r * 0.28, -enemy.r * 0.1, Math.max(3, enemy.r * 0.12), 0, Math.PI * 2);
  ctx.fill();
}

export function drawEnemyArt(
  ctx: CanvasRenderingContext2D,
  enemy: RenderEnemy,
  art: LoadedArt | null,
  time: number,
) {
  const image = art?.enemies[enemy.type];
  const phase = time * 4 + enemy.id;
  let scaleX = 1;
  let scaleY = 1;
  let rotation = 0;
  let lift = Math.sin(phase) * 2;
  if (enemy.type === "shoe") lift = Math.abs(Math.sin(phase * 1.25)) * -8;
  if (enemy.type === "lantern") scaleY = 1 + Math.sin(phase) * 0.045;
  if (enemy.type === "fish") rotation = Math.sin(phase * 0.7) * 0.12;
  if (enemy.type === "abacus") rotation = Math.sin(phase * 1.8) * 0.035;
  if (enemy.type === "rib") rotation = Math.sin(phase) * 0.18;
  if (enemy.boss) {
    scaleX = 1 + Math.sin(phase * 0.35) * 0.018;
    scaleY = 1 - Math.sin(phase * 0.35) * 0.018;
    lift = Math.sin(phase * 0.4) * 3;
  }

  ctx.save();
  ctx.translate(enemy.x, enemy.y + lift);
  ctx.rotate(rotation);
  ctx.scale(scaleX, scaleY);
  if (enemy.hitFlash > 0 && Math.floor(enemy.hitFlash * 80) % 2 === 0) ctx.globalAlpha = 0.46;
  if (image) {
    const size = enemy.r * (enemy.boss ? 2.75 : enemy.elite ? 2.55 : 2.45);
    const ratio = image.naturalWidth / image.naturalHeight;
    const width = ratio >= 1 ? size : size * ratio;
    const height = ratio >= 1 ? size / ratio : size;
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
  } else {
    fallbackEnemy(ctx, enemy);
  }

  if (enemy.marked > 0) {
    ctx.strokeStyle = "#a54535";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.r + 8 + Math.sin(time * 7) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (enemy.elite || enemy.boss) {
    const width = enemy.boss ? 150 : 76;
    ctx.fillStyle = "rgba(38,35,31,.2)";
    ctx.fillRect(-width / 2, enemy.r + 14, width, 5);
    ctx.fillStyle = enemy.bossTier === "final" ? "#a54535" : "#50766a";
    ctx.fillRect(-width / 2, enemy.r + 14, width * Math.max(0, enemy.hp / enemy.maxHp), 5);
  }
  ctx.restore();
}

function lerp(a: number, b: number, p: number) {
  return a + (b - a) * p;
}

function paperPanel(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  fill: string,
  stroke = "#282620",
) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

export function drawPlayerArt(
  ctx: CanvasRenderingContext2D,
  player: {
    x: number;
    y: number;
    invuln: number;
    formProgress: number;
    formState: PlayerFormState;
  },
  time: number,
) {
  const p = ease(player.formProgress);
  const fold = Math.sin(Math.PI * p);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.scale(1 + fold * 0.12, 1 - fold * 0.16);
  if (player.invuln > 0 && Math.floor(player.invuln * 16) % 2 === 0) ctx.globalAlpha = 0.36;

  ctx.save();
  ctx.translate(0, lerp(-5, 0, p));
  paperPanel(ctx, [
    [lerp(-17, -39, p), lerp(-20, -12, p)],
    [lerp(-5, 4, p), lerp(-11, 0, p)],
    [lerp(-18, -25, p), lerp(25, 1, p)],
    [lerp(-29, -42, p), lerp(9, 17, p)],
  ], "#32443f");
  paperPanel(ctx, [
    [lerp(17, 39, p), lerp(-20, -12, p)],
    [lerp(5, 4, p), lerp(-11, 0, p)],
    [lerp(18, 25, p), lerp(25, 1, p)],
    [lerp(29, 42, p), lerp(9, 17, p)],
  ], "#47635b");

  paperPanel(ctx, [
    [lerp(-14, -12, p), lerp(-15, -7, p)],
    [lerp(14, 33, p), lerp(-15, 0, p)],
    [lerp(18, -12, p), lerp(27, 7, p)],
    [lerp(-18, -28, p), lerp(27, 7, p)],
  ], "#eee3ca");

  ctx.globalAlpha = 1 - p;
  paperPanel(ctx, [[-18, -8], [-10, 27], [-19, 42], [-27, 17]], "#24332f");
  paperPanel(ctx, [[18, -8], [10, 27], [19, 42], [27, 17]], "#3e5750");
  ctx.fillStyle = "#a54535";
  ctx.fillRect(-16, -10, 32, 5);

  ctx.save();
  ctx.translate(0, lerp(-32, -2, p));
  ctx.scale(1 - p * 0.82, 1 - p * 0.82);
  ctx.fillStyle = "#eee3ca";
  ctx.strokeStyle = "#282620";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#262722";
  ctx.beginPath();
  ctx.moveTo(-17, -7);
  ctx.quadraticCurveTo(0, -19, 17, -7);
  ctx.quadraticCurveTo(3, -3, -17, -7);
  ctx.fill();
  ctx.restore();

  ctx.globalAlpha = Math.max(0.18, p);
  ctx.strokeStyle = "rgba(78,69,56,.65)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-33 * p, -8 * p);
  ctx.lineTo(5, 0);
  ctx.lineTo(-24 * p, 12 * p);
  ctx.moveTo(33 * p, -8 * p);
  ctx.lineTo(5, 0);
  ctx.lineTo(24 * p, 12 * p);
  ctx.stroke();
  ctx.fillStyle = "#a54535";
  ctx.beginPath();
  ctx.arc(lerp(-11, 3, p), lerp(-5, 0, p), 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (player.formState === "plane") {
    ctx.save();
    ctx.globalAlpha = 0.12 + Math.sin(time * 4) * 0.03;
    ctx.strokeStyle = "#4d6f66";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-52, 8);
    ctx.lineTo(-82, 8);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function drawWeaponGlyph(
  ctx: CanvasRenderingContext2D,
  weapon: string,
  level: number,
  x: number,
  y: number,
  rotation: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = "#292722";
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;

  if (weapon === "umbrella") {
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.quadraticCurveTo(0, -19, 16, 0);
    ctx.quadraticCurveTo(8, -4, 0, 0);
    ctx.quadraticCurveTo(-8, -4, -16, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let i = -8; i <= 8; i += 8) {
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(i, 0);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(0, 17, 7, 17);
    ctx.stroke();
  } else if (weapon === "scissors") {
    ctx.beginPath();
    ctx.ellipse(-7, 9, 5, 7, -0.35, 0, Math.PI * 2);
    ctx.ellipse(7, 9, 5, 7, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.lineTo(9, -16);
    ctx.moveTo(4, 4);
    ctx.lineTo(-9, -16);
    ctx.stroke();
  } else if (weapon === "fan") {
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.quadraticCurveTo(-21, -1, -15, -15);
    ctx.quadraticCurveTo(0, -23, 15, -15);
    ctx.quadraticCurveTo(21, -1, 0, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 13);
      ctx.lineTo(i * 7, -15 + Math.abs(i) * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = level >= 3 ? "#b0483d" : "#5d776d";
    ctx.beginPath();
    ctx.bezierCurveTo(-10, -6, -2, -13, 10, -8);
    ctx.stroke();
  } else if (weapon === "abacus") {
    ctx.fillStyle = "#6d3c2b";
    ctx.beginPath();
    ctx.roundRect(-17, -13, 34, 26, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e4d3ae";
    ctx.fillRect(-13, -9, 26, 18);
    ctx.strokeRect(-13, -9, 26, 18);
    for (let row = -1; row <= 1; row++) {
      const y = row * 6;
      ctx.beginPath();
      ctx.moveTo(-11, y);
      ctx.lineTo(11, y);
      ctx.stroke();
      for (let bead = 0; bead < (level >= 3 ? 4 : 3); bead++) {
        ctx.fillStyle = bead % 2 ? "#b04b3f" : "#263a36";
        ctx.beginPath();
        ctx.ellipse(-8 + bead * 5.5, y, 2.7, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (weapon === "crossbow") {
    ctx.fillStyle = "#815137";
    ctx.beginPath();
    ctx.moveTo(-3, -17);
    ctx.lineTo(4, -17);
    ctx.lineTo(6, 16);
    ctx.lineTo(-2, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#a97948";
    ctx.beginPath();
    ctx.moveTo(-18, -6);
    ctx.quadraticCurveTo(0, 5, 18, -6);
    ctx.lineTo(16, 0);
    ctx.quadraticCurveTo(0, 10, -16, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#c6a568";
    ctx.beginPath();
    ctx.moveTo(-18, -6);
    ctx.lineTo(18, -6);
    ctx.moveTo(0, -19);
    ctx.lineTo(0, 17);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(5, 9);
    ctx.lineTo(0, 17);
    ctx.lineTo(-5, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-7, 9);
    ctx.lineTo(7, 9);
    ctx.stroke();
    for (let i = -8; i < 8; i += 4) {
      ctx.beginPath();
      ctx.moveTo(-3, i);
      ctx.lineTo(3, i + 2);
      ctx.stroke();
    }
  }
  if (level >= 5) {
    ctx.strokeStyle = "#c18b45";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
