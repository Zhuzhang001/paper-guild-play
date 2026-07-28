"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  drawEnemyArt,
  drawPlayerArt,
  drawSeasonParticles,
  drawSeasonScene,
  drawWeaponGlyph,
  loadArtAssets,
  seasonIndex,
  type BossTier,
  type EnemyArchetype,
  type LoadedArt,
} from "./game/art";
import {
  createPlayerForm,
  finishHumanForm,
  forceHumanForm,
  stepPlayerForm,
  type PlayerFormModel,
} from "./game/form";

const W = 1280;
const H = 720;
const RUN_TIME = 8 * 60;

type Mode = "menu" | "playing" | "upgrade" | "paused" | "bossChoice" | "result";
type WeaponId = "sword" | "fan" | "umbrella" | "scissors" | "abacus" | "crossbow";
type Branch = "a" | "b";
type TrialId = "swift" | "crowd" | "elite";

type WeaponState = {
  id: WeaponId;
  level: number;
  branch?: Branch;
};

type EnemyType = EnemyArchetype;

type Enemy = {
  id: number;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  type: EnemyType;
  damage: number;
  hitFlash: number;
  orbitCd: number;
  marked: number;
  elite: boolean;
  boss: boolean;
  bossTier: BossTier;
};

type Projectile = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  life: number;
  color: string;
  pierce: number;
  kind: WeaponId | "harmony";
  homing?: boolean;
  targetId?: number;
  mark?: boolean;
};

type Pickup = { id: number; x: number; y: number; value: number; pulse: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };

type UpgradeOption = {
  key: string;
  weapon?: WeaponId;
  branch?: Branch;
  kind: "new" | "upgrade" | "branch" | "rare";
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  targetLevel: number;
  rare?: "power" | "speed" | "magnet";
};

type Game = {
  elapsed: number;
  endless: boolean;
  environmental: string;
  nextEnvironmentAt: number;
  nextBossAt: number;
  player: PlayerFormModel & {
    x: number;
    y: number;
    life: number;
    maxLife: number;
    xp: number;
    nextXp: number;
    level: number;
    invuln: number;
    power: number;
    speed: number;
    magnet: number;
  };
  weapons: WeaponState[];
  enemies: Enemy[];
  projectiles: Projectile[];
  pickups: Pickup[];
  particles: Particle[];
  cooldowns: Partial<Record<WeaponId, number>>;
  spawnClock: number;
  orbitAngle: number;
  kills: number;
  score: number;
  hitCounter: number;
  midBossSpawned: boolean;
  finalBossSpawned: boolean;
  endlessBossCount: number;
  tutorial: boolean;
  trials: Set<TrialId>;
};

type Snapshot = {
  elapsed: number;
  endless: boolean;
  environmental: string;
  life: number;
  maxLife: number;
  xp: number;
  nextXp: number;
  level: number;
  weapons: WeaponState[];
  resonances: string[];
  kills: number;
  score: number;
};

const weaponInfo: Record<WeaponId, {
  name: string;
  glyph: string;
  color: string;
  base: string;
  branches: Record<Branch, { name: string; description: string }>;
}> = {
  sword: {
    name: "竹剑",
    glyph: "剑",
    color: "#54766b",
    base: "自动刺向最近的敌人。",
    branches: {
      a: { name: "飞剑", description: "剑光穿行更远，并会标记敌人。" },
      b: { name: "剑阵", description: "竹剑化作环身剑阵，持续切割近敌。" },
    },
  },
  fan: {
    name: "折扇",
    glyph: "风",
    color: "#567c86",
    base: "周期性扇出一列风刃。",
    branches: {
      a: { name: "大开大合", description: "风浪更宽，适合清扫密集敌群。" },
      b: { name: "寻风", description: "风刃自动追踪远处的敌人。" },
    },
  },
  umbrella: {
    name: "油纸伞",
    glyph: "伞",
    color: "#a94a3c",
    base: "绕身旋转，阻挡靠近的敌人。",
    branches: {
      a: { name: "伞阵", description: "增加护身伞面，扩大近身防线。" },
      b: { name: "雨针", description: "伞沿周期性向四周射出细针。" },
    },
  },
  scissors: {
    name: "裁衣剪",
    glyph: "裁",
    color: "#9a6b3d",
    base: "两片剪刃往返切割敌群。",
    branches: {
      a: { name: "回旋剪", description: "剪刃飞得更远并穿透更多敌人。" },
      b: { name: "绞云", description: "剪刃环身高速旋转，守住近处。" },
    },
  },
  abacus: {
    name: "算盘",
    glyph: "算",
    color: "#76534b",
    base: "算盘珠成列向前弹射。",
    branches: {
      a: { name: "珠雨", description: "攻击间隔缩短，持续洒出算珠。" },
      b: { name: "贯珠", description: "算珠排列成线，获得强力穿透。" },
    },
  },
  crossbow: {
    name: "连弩",
    glyph: "弩",
    color: "#4a674d",
    base: "稳定射出高速弩箭。",
    branches: {
      a: { name: "齐射", description: "一次发射三支弩箭覆盖扇面。" },
      b: { name: "机关弩", description: "弩箭从身侧机关连续射出。" },
    },
  },
};

const seasonData = [
  { name: "惊蛰 · 春桥", paper: "#eee7d1", wash: "#8ba38b", accent: "#b3655a" },
  { name: "小暑 · 荷塘", paper: "#e8e1c8", wash: "#5c8a7c", accent: "#547b72" },
  { name: "霜降 · 稻埂", paper: "#ebdfc4", wash: "#b1844d", accent: "#a87842" },
  { name: "大寒 · 岁市", paper: "#e5e5de", wash: "#71808b", accent: "#9d4339" },
];

const harmonyPairs: Array<{ ids: [WeaponId, WeaponId]; name: string }> = [
  { ids: ["fan", "umbrella"], name: "风雨合鸣" },
  { ids: ["scissors", "abacus"], name: "精打细算" },
  { ids: ["sword", "crossbow"], name: "远近相济" },
];

const initialSnapshot: Snapshot = {
  elapsed: 0,
  endless: false,
  environmental: "",
  life: 5,
  maxLife: 5,
  xp: 0,
  nextXp: 8,
  level: 1,
  weapons: [{ id: "sword", level: 1 }],
  resonances: [],
  kills: 0,
  score: 0,
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function distSq(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function normalize(x: number, y: number) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

function getSeason(elapsed: number) {
  return seasonIndex(elapsed);
}

function weaponLevel(game: Game, id: WeaponId) {
  return game.weapons.find((weapon) => weapon.id === id)?.level ?? 0;
}

function resonances(game: Game) {
  return harmonyPairs
    .filter((pair) => pair.ids.every((id) => weaponLevel(game, id) >= 3))
    .slice(0, 2)
    .map((pair) => pair.name);
}

function hasHarmony(game: Game, name: string) {
  return resonances(game).includes(name);
}

function createGame(trials: Set<TrialId>): Game {
  const thinLife = 5;
  return {
    elapsed: 0,
    endless: false,
    environmental: "",
    nextEnvironmentAt: RUN_TIME + 120,
    nextBossAt: RUN_TIME,
    player: {
      ...createPlayerForm(),
      x: W / 2,
      y: H / 2,
      life: thinLife,
      maxLife: thinLife,
      xp: 0,
      nextXp: 8,
      level: 1,
      invuln: 0,
      power: 1,
      speed: 1,
      magnet: 1,
    },
    weapons: [{ id: "sword", level: 1 }],
    enemies: [],
    projectiles: [],
    pickups: [],
    particles: [],
    cooldowns: {},
    spawnClock: 0,
    orbitAngle: 0,
    kills: 0,
    score: 0,
    hitCounter: 0,
    midBossSpawned: false,
    finalBossSpawned: false,
    endlessBossCount: 0,
    tutorial: true,
    trials: new Set(trials),
  };
}

function snapshotOf(game: Game): Snapshot {
  return {
    elapsed: game.elapsed,
    endless: game.endless,
    environmental: game.environmental,
    life: game.player.life,
    maxLife: game.player.maxLife,
    xp: game.player.xp,
    nextXp: game.player.nextXp,
    level: game.player.level,
    weapons: game.weapons.map((weapon) => ({ ...weapon })),
    resonances: resonances(game),
    kills: game.kills,
    score: game.score,
  };
}

function makeUpgradeOptions(game: Game): UpgradeOption[] {
  const candidates: UpgradeOption[] = [];
  const owned = new Set(game.weapons.map((weapon) => weapon.id));

  for (const weapon of game.weapons) {
    const info = weaponInfo[weapon.id];
    if (weapon.level === 2 && !weapon.branch) {
      (["a", "b"] as Branch[]).forEach((branch) => {
        candidates.push({
          key: `${weapon.id}-${branch}`,
          weapon: weapon.id,
          branch,
          kind: "branch",
          title: info.branches[branch].name,
          subtitle: `${info.name} · 路线选择`,
          description: info.branches[branch].description,
          accent: info.color,
          targetLevel: 3,
        });
      });
    } else if (weapon.level < 5) {
      const next = weapon.level + 1;
      candidates.push({
        key: `${weapon.id}-up-${next}`,
        weapon: weapon.id,
        kind: "upgrade",
        title: next === 5 ? `${info.name} · 成器` : `精进${info.name}`,
        subtitle: next === 5 ? "最终形态" : `提升至第 ${next} 阶`,
        description: next === 5
          ? `完成${weapon.branch ? info.branches[weapon.branch].name : info.name}，攻击方式与外观全面增强。`
          : `${info.base} 提高伤害、频率与作用范围。`,
        accent: info.color,
        targetLevel: next,
      });
    }
  }

  if (game.weapons.length < 4) {
    (Object.keys(weaponInfo) as WeaponId[])
      .filter((id) => !owned.has(id))
      .forEach((id) => {
        const info = weaponInfo[id];
        candidates.push({
          key: `${id}-new`,
          weapon: id,
          kind: "new",
          title: info.name,
          subtitle: "获得新器物",
          description: info.base,
          accent: info.color,
          targetLevel: 1,
        });
      });
  }

  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const choices: UpgradeOption[] = [];

  const branchGroups = shuffled.filter((option) => option.kind === "branch");
  if (branchGroups.length) choices.push(branchGroups[0]);

  for (const option of shuffled) {
    if (choices.length >= 3) break;
    if (!choices.some((choice) => choice.key === option.key)) choices.push(option);
  }

  const rares = makeRareOptions(game);
  while (choices.length < 3) choices.push(rares[choices.length]);
  return choices.slice(0, 3);
}

function makeRareOptions(game: Game): UpgradeOption[] {
  return [
    {
      key: `rare-power-${game.player.level}`,
      kind: "rare",
      title: "百炼",
      subtitle: "稀有强化",
      description: "所有武器伤害提高 18%。",
      accent: "#a54535",
      targetLevel: 5,
      rare: "power",
    },
    {
      key: `rare-speed-${game.player.level}`,
      kind: "rare",
      title: "轻身",
      subtitle: "稀有强化",
      description: "移动速度提高 12%。",
      accent: "#50766a",
      targetLevel: 5,
      rare: "speed",
    },
    {
      key: `rare-magnet-${game.player.level}`,
      kind: "rare",
      title: "聚物",
      subtitle: "稀有强化",
      description: "拾取范围提高 28%。",
      accent: "#c18b45",
      targetLevel: 5,
      rare: "magnet",
    },
  ];
}

function applyUpgrade(game: Game, option: UpgradeOption) {
  if (option.kind === "rare" && option.rare) {
    if (option.rare === "power") game.player.power *= 1.18;
    if (option.rare === "speed") game.player.speed *= 1.12;
    if (option.rare === "magnet") game.player.magnet *= 1.28;
    return;
  }
  if (!option.weapon) return;
  if (option.kind === "new") {
    game.weapons.push({ id: option.weapon, level: 1 });
    return;
  }
  const weapon = game.weapons.find((item) => item.id === option.weapon);
  if (!weapon) return;
  weapon.level = option.targetLevel;
  if (option.kind === "branch" && option.branch) weapon.branch = option.branch;
}

function nearestEnemy(game: Game, markedOnly = false) {
  let closest: Enemy | undefined;
  let best = Infinity;
  for (const enemy of game.enemies) {
    if (markedOnly && enemy.marked <= 0) continue;
    const distance = distSq(game.player.x, game.player.y, enemy.x, enemy.y);
    if (distance < best) {
      best = distance;
      closest = enemy;
    }
  }
  return closest;
}

function strongestEnemy(game: Game) {
  return game.enemies.reduce<Enemy | undefined>((best, enemy) => (!best || enemy.hp > best.hp ? enemy : best), undefined);
}

let serial = 1;

function addProjectile(
  game: Game,
  weapon: WeaponId | "harmony",
  target: Enemy | undefined,
  speed: number,
  damage: number,
  color: string,
  options: Partial<Projectile> = {},
  angleOffset = 0,
) {
  if (!target) return;
  const baseAngle = Math.atan2(target.y - game.player.y, target.x - game.player.x) + angleOffset;
  game.projectiles.push({
    id: serial++,
    x: game.player.x,
    y: game.player.y,
    vx: Math.cos(baseAngle) * speed,
    vy: Math.sin(baseAngle) * speed,
    r: options.r ?? 7,
    damage: damage * game.player.power,
    life: options.life ?? 2.2,
    color,
    pierce: options.pierce ?? 0,
    kind: weapon,
    homing: options.homing,
    targetId: options.targetId ?? target.id,
    mark: options.mark,
  });
}

function fireWeapons(game: Game, dt: number) {
  for (const weapon of game.weapons) {
    game.cooldowns[weapon.id] = (game.cooldowns[weapon.id] ?? 0) - dt;
    if ((game.cooldowns[weapon.id] ?? 0) > 0) continue;
    const info = weaponInfo[weapon.id];
    const target = weapon.id === "crossbow" && hasHarmony(game, "远近相济")
      ? nearestEnemy(game, true) ?? nearestEnemy(game)
      : nearestEnemy(game);
    if (!target) continue;
    const level = weapon.level;

    if (weapon.id === "sword") {
      if (weapon.branch === "b") {
        game.cooldowns.sword = 0.28;
      } else {
        const count = level >= 5 ? 3 : level >= 4 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          addProjectile(game, "sword", target, 520, 11 + level * 5, info.color, {
            r: 6,
            pierce: weapon.branch === "a" ? 1 + Math.floor(level / 2) : 0,
            mark: hasHarmony(game, "远近相济"),
          }, (i - (count - 1) / 2) * 0.1);
        }
        game.cooldowns.sword = Math.max(0.34, 0.85 - level * 0.07);
      }
    }

    if (weapon.id === "fan") {
      const count = weapon.branch === "a" ? 7 : level >= 4 ? 5 : 3;
      const spread = weapon.branch === "a" ? 0.18 : 0.12;
      for (let i = 0; i < count; i++) {
        addProjectile(game, "fan", target, 290, 6 + level * 3.5, info.color, {
          r: weapon.branch === "a" ? 13 : 9,
          life: 1.45,
          pierce: weapon.branch === "a" ? 2 : 0,
          homing: weapon.branch === "b",
        }, (i - (count - 1) / 2) * spread);
      }
      if (hasHarmony(game, "风雨合鸣")) {
        for (let i = 0; i < 4; i++) {
          addProjectile(game, "harmony", target, 390, 5 + level * 2, "#b24d43", {
            r: 3,
            pierce: 1,
          }, (i - 1.5) * 0.2);
        }
      }
      game.cooldowns.fan = Math.max(0.65, 1.55 - level * 0.1);
    }

    if (weapon.id === "umbrella") {
      if (weapon.branch === "b") {
        const count = level >= 5 ? 12 : 8;
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count;
          const dummy = { ...target, x: game.player.x + Math.cos(angle) * 100, y: game.player.y + Math.sin(angle) * 100 };
          addProjectile(game, "umbrella", dummy, 360, 6 + level * 2.5, info.color, { r: 3, pierce: 1 });
        }
      }
      game.cooldowns.umbrella = weapon.branch === "b" ? Math.max(0.8, 1.7 - level * 0.12) : 0.35;
    }

    if (weapon.id === "scissors") {
      if (weapon.branch !== "b") {
        const count = level >= 5 ? 4 : 2;
        for (let i = 0; i < count; i++) {
          addProjectile(game, "scissors", target, 360, 9 + level * 4, info.color, {
            r: 9,
            pierce: weapon.branch === "a" ? 3 : 1,
            life: 2.4,
          }, (i - (count - 1) / 2) * 0.22);
        }
      }
      game.cooldowns.scissors = Math.max(0.55, 1.35 - level * 0.08);
    }

    if (weapon.id === "abacus") {
      const count = weapon.branch === "a" ? 7 : level >= 4 ? 5 : 3;
      for (let i = 0; i < count; i++) {
        addProjectile(game, "abacus", target, 420, 5 + level * 2.7, info.color, {
          r: 5,
          pierce: weapon.branch === "b" ? 4 : 0,
        }, (i - (count - 1) / 2) * 0.07);
      }
      game.cooldowns.abacus = weapon.branch === "a"
        ? Math.max(0.35, 0.82 - level * 0.06)
        : Math.max(0.62, 1.2 - level * 0.06);
    }

    if (weapon.id === "crossbow") {
      const count = weapon.branch === "a" ? 3 : weapon.level >= 5 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const offset = weapon.branch === "a" ? (i - 1) * 0.09 : (i - (count - 1) / 2) * 0.04;
        addProjectile(game, "crossbow", target, 620, 12 + level * 5, info.color, {
          r: 4,
          pierce: level >= 5 ? 2 : 0,
          mark: false,
        }, offset);
      }
      game.cooldowns.crossbow = weapon.branch === "b"
        ? Math.max(0.26, 0.7 - level * 0.07)
        : Math.max(0.42, 1.05 - level * 0.07);
    }
  }
}

function spawnEnemy(game: Game, forced?: EnemyType) {
  const season = getSeason(game.elapsed);
  const available: EnemyType[][] = [
    ["cup", "shoe", "fish"],
    ["lantern", "fish", "shoe"],
    ["abacus", "cup", "lantern"],
    ["rib", "abacus", "shoe"],
  ];
  const type = forced ?? available[season][Math.floor(Math.random() * available[season].length)];
  const resolvedType = !forced && game.environmental.startsWith("灯火") && Math.random() < 0.48 ? "lantern" : type;
  const edge = Math.floor(Math.random() * 4);
  const margin = 36;
  let x = Math.random() * W;
  let y = Math.random() * H;
  if (edge === 0) { x = -margin; y = Math.random() * H; }
  if (edge === 1) { x = W + margin; y = Math.random() * H; }
  if (edge === 2) { x = Math.random() * W; y = -margin; }
  if (edge === 3) { x = Math.random() * W; y = H + margin; }

  const elite = resolvedType === "lion" || resolvedType === "puppet";
  const boss = resolvedType === "taotie" || resolvedType === "nian";
  const bossTier: BossTier = resolvedType === "taotie" ? "mid" : resolvedType === "nian" ? "final" : null;
  const crowdScale = game.trials.has("crowd") ? 1.18 : 1;
  const eliteScale = game.trials.has("elite") && (elite || boss) ? 1.45 : 1;
  const baseHp = 11 + game.elapsed * 0.055;
  const stats: Record<EnemyType, { r: number; hp: number; speed: number; damage: number }> = {
    cup: { r: 18, hp: 1, speed: 48, damage: 1 },
    shoe: { r: 16, hp: 0.8, speed: 76, damage: 1 },
    lantern: { r: 20, hp: 1.45, speed: 42, damage: 1 },
    fish: { r: 15, hp: 0.72, speed: 66, damage: 1 },
    abacus: { r: 22, hp: 1.8, speed: 36, damage: 1 },
    rib: { r: 20, hp: 1.55, speed: 50, damage: 1 },
    lion: { r: 40, hp: 15, speed: 44, damage: 1 },
    puppet: { r: 36, hp: 12, speed: 54, damage: 1 },
    taotie: { r: 62, hp: 46, speed: 34, damage: 1 },
    nian: { r: 78, hp: 92, speed: 31, damage: 1 },
  };
  const stat = stats[resolvedType];
  const hp = baseHp * stat.hp * eliteScale * (boss && game.endless ? 1 + (game.elapsed - RUN_TIME) / 360 : 1);
  game.enemies.push({
    id: serial++,
    x,
    y,
    r: stat.r,
    hp,
    maxHp: hp,
    speed: stat.speed * (game.trials.has("swift") ? 1.18 : 1) * crowdScale,
    type: resolvedType,
    damage: stat.damage,
    hitFlash: 0,
    orbitCd: 0,
    marked: 0,
    elite,
    boss,
    bossTier,
  });
}

function addBurst(game: Game, x: number, y: number, color: string, count = 7) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 80;
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.35,
      max: 0.8,
      color,
      size: 2 + Math.random() * 5,
    });
  }
}

function damageEnemy(game: Game, enemy: Enemy, amount: number, source: WeaponId | "harmony") {
  enemy.hp -= amount;
  enemy.hitFlash = 0.08;
  if (source === "sword" && hasHarmony(game, "远近相济")) enemy.marked = 2.2;
  if (hasHarmony(game, "精打细算") && (source === "scissors" || source === "abacus")) {
    game.hitCounter += 1;
    if (game.hitCounter >= 12) {
      game.hitCounter = 0;
      const strongest = strongestEnemy(game);
      if (strongest) {
        strongest.hp -= 24 * game.player.power;
        addBurst(game, strongest.x, strongest.y, "#c18b45", 12);
      }
    }
  }
  addBurst(game, enemy.x, enemy.y, source === "harmony" ? "#a54535" : "#2f302b", 3);
}

function updateOrbitWeapons(game: Game, dt: number) {
  game.orbitAngle += dt * 2.2;
  const active: Array<{ id: WeaponId; count: number; radius: number; damage: number; size: number }> = [];
  const sword = game.weapons.find((item) => item.id === "sword" && item.branch === "b");
  if (sword) active.push({ id: "sword", count: sword.level >= 5 ? 5 : 3, radius: 72, damage: 6 + sword.level * 2.4, size: 10 });
  const umbrella = game.weapons.find((item) => item.id === "umbrella");
  if (umbrella) active.push({
    id: "umbrella",
    count: umbrella.branch === "a" ? (umbrella.level >= 5 ? 4 : 3) : 1,
    radius: umbrella.branch === "a" ? 82 : 62,
    damage: 3.5 + umbrella.level * 1.8,
    size: 14,
  });
  const scissors = game.weapons.find((item) => item.id === "scissors" && item.branch === "b");
  if (scissors) active.push({ id: "scissors", count: scissors.level >= 5 ? 4 : 2, radius: 100, damage: 7 + scissors.level * 2.4, size: 11 });

  for (const enemy of game.enemies) {
    enemy.orbitCd -= dt;
    if (enemy.orbitCd > 0) continue;
    for (const orbit of active) {
      let hit = false;
      for (let i = 0; i < orbit.count; i++) {
        const angle = game.orbitAngle * (orbit.id === "scissors" ? 1.45 : 1) + (Math.PI * 2 * i) / orbit.count;
        const x = game.player.x + Math.cos(angle) * orbit.radius;
        const y = game.player.y + Math.sin(angle) * orbit.radius;
        if (distSq(x, y, enemy.x, enemy.y) < (orbit.size + enemy.r) ** 2) {
          damageEnemy(game, enemy, orbit.damage * game.player.power, orbit.id);
          enemy.orbitCd = 0.32;
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
  }
}

function updateProjectiles(game: Game, dt: number) {
  for (const projectile of game.projectiles) {
    projectile.life -= dt;
    if (projectile.homing) {
      const target = game.enemies.find((enemy) => enemy.id === projectile.targetId) ?? nearestEnemy(game);
      if (target) {
        const desired = normalize(target.x - projectile.x, target.y - projectile.y);
        const speed = Math.hypot(projectile.vx, projectile.vy);
        projectile.vx += (desired.x * speed - projectile.vx) * dt * 3.5;
        projectile.vy += (desired.y * speed - projectile.vy) * dt * 3.5;
      }
    }
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;

    for (const enemy of game.enemies) {
      if (enemy.hp <= 0) continue;
      if (distSq(projectile.x, projectile.y, enemy.x, enemy.y) < (projectile.r + enemy.r) ** 2) {
        damageEnemy(game, enemy, projectile.damage, projectile.kind);
        if (projectile.mark) enemy.marked = 2.5;
        projectile.pierce -= 1;
        if (projectile.pierce < 0) {
          projectile.life = 0;
          break;
        }
      }
    }
  }
  game.projectiles = game.projectiles.filter((projectile) =>
    projectile.life > 0 &&
    projectile.x > -100 && projectile.x < W + 100 &&
    projectile.y > -100 && projectile.y < H + 100,
  );
}

function removeDead(game: Game, onBoss: (enemy: Enemy) => void) {
  const living: Enemy[] = [];
  for (const enemy of game.enemies) {
    if (enemy.hp > 0) {
      living.push(enemy);
      continue;
    }
    game.kills += 1;
    game.score += enemy.bossTier === "final" ? 3000 : enemy.bossTier === "mid" ? 1200 : enemy.elite ? 500 : 20;
    addBurst(game, enemy.x, enemy.y, enemy.boss ? "#a54535" : "#3f443d", enemy.boss ? 60 : enemy.elite ? 24 : 9);
    const drops = enemy.boss ? 0 : enemy.elite ? 8 : 1;
    for (let i = 0; i < drops; i++) {
      game.pickups.push({
        id: serial++,
        x: enemy.x + (Math.random() - 0.5) * 30,
        y: enemy.y + (Math.random() - 0.5) * 30,
        value: enemy.elite ? 2 : 1,
        pulse: Math.random() * Math.PI * 2,
      });
    }
    if (enemy.boss) onBoss(enemy);
  }
  game.enemies = living;
}

function drawBackdrop(ctx: CanvasRenderingContext2D, elapsed: number, menu = false, art: LoadedArt | null = null) {
  if (art) {
    drawSeasonScene(ctx, art, elapsed, menu);
    if (!menu) drawSeasonParticles(ctx, elapsed);
    return;
  }
  const index = getSeason(elapsed);
  const season = seasonData[index];
  ctx.fillStyle = season.paper;
  ctx.fillRect(0, 0, W, H);

  const gradient = ctx.createRadialGradient(W * 0.55, H * 0.35, 20, W * 0.55, H * 0.35, W * 0.75);
  gradient.addColorStop(0, "rgba(255,255,247,0.55)");
  gradient.addColorStop(1, "rgba(94,83,61,0.05)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = season.wash;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(170 + i * 250, H - 35 - (i % 2) * 22, 230, 110 + i * 8, -0.08 + i * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#3b4038";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 560);
  ctx.bezierCurveTo(230, 490, 390, 585, 610, 535);
  ctx.bezierCurveTo(840, 480, 1040, 570, W, 505);
  ctx.stroke();

  if (index === 0) {
    ctx.fillStyle = "#b3655a";
    for (let i = 0; i < 22; i++) {
      const x = (i * 97 + elapsed * 7) % W;
      const y = 90 + ((i * 53 + elapsed * 12) % 420);
      ctx.fillRect(x, y, 4, 4);
    }
  }
  if (index === 1) {
    ctx.strokeStyle = "#50766a";
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(120 + i * 170, H - 50, 34 + (i % 3) * 10, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (index === 2) {
    ctx.fillStyle = "#9d6a3f";
    for (let i = 0; i < 18; i++) {
      const x = (i * 83 + elapsed * 18) % W;
      const y = 80 + ((i * 61 + elapsed * 9) % 520);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.7);
      ctx.fillRect(-5, -2, 10, 4);
      ctx.restore();
    }
  }
  if (index === 3) {
    ctx.fillStyle = "#788995";
    for (let i = 0; i < 36; i++) {
      const x = (i * 47 + elapsed * 5) % W;
      const y = (i * 79 + elapsed * 17) % H;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = menu ? 0.26 : 0.1;
  ctx.strokeStyle = "#5e574c";
  for (let i = 0; i < 28; i++) {
    const y = 18 + i * 26;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y + Math.sin(i) * 3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, t: number, art: LoadedArt | null) {
  if (art?.enemies[enemy.type]) {
    drawEnemyArt(ctx, enemy, art, t);
    return;
  }
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const bob = Math.sin(t * 5 + enemy.id) * 2;
  ctx.translate(0, bob);
  ctx.lineWidth = enemy.boss ? 6 : enemy.elite ? 4 : 3;
  ctx.strokeStyle = enemy.hitFlash > 0 ? "#fff6df" : "#302d28";
  ctx.fillStyle = enemy.boss ? "#a54535" : enemy.elite ? "#73594b" : "#e5d8bd";

  if (enemy.type === "cup") {
    ctx.beginPath();
    ctx.moveTo(-14, -12); ctx.lineTo(12, -12); ctx.lineTo(9, 13); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(14, 0, 8, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  } else if (enemy.type === "shoe") {
    ctx.beginPath();
    ctx.moveTo(-15, 7); ctx.quadraticCurveTo(-4, -14, 4, 0); ctx.quadraticCurveTo(12, 4, 16, 11); ctx.lineTo(-14, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (enemy.type === "lantern") {
    ctx.fillStyle = "#b44d3e";
    ctx.beginPath(); ctx.ellipse(0, 0, 15, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, -22); ctx.lineTo(8, -22); ctx.moveTo(0, 21); ctx.lineTo(0, 30); ctx.stroke();
  } else if (enemy.type === "fish") {
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-25, -10); ctx.lineTo(-25, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#302d28"; ctx.beginPath(); ctx.arc(7, -2, 2, 0, Math.PI * 2); ctx.fill();
  } else if (enemy.type === "abacus") {
    ctx.strokeRect(-18, -14, 36, 28);
    for (let row = -7; row <= 7; row += 7) {
      ctx.beginPath(); ctx.moveTo(-14, row); ctx.lineTo(14, row); ctx.stroke();
      for (let x = -8; x <= 8; x += 8) { ctx.beginPath(); ctx.arc(x, row, 3, 0, Math.PI * 2); ctx.fill(); }
    }
  } else if (enemy.type === "rib") {
    ctx.beginPath(); ctx.arc(0, 0, 18, Math.PI, Math.PI * 2); ctx.stroke();
    for (let i = -12; i <= 12; i += 8) { ctx.beginPath(); ctx.moveTo(i, -10); ctx.lineTo(i * 0.75, 16); ctx.stroke(); }
  } else if (enemy.type === "lion") {
    ctx.beginPath(); ctx.arc(0, 0, 31, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const a = (Math.PI * 2 * i) / 9;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 34, Math.sin(a) * 34, 8, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = "#f3dfb9";
    ctx.beginPath(); ctx.arc(-11, -4, 6, 0, Math.PI * 2); ctx.arc(11, -4, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#302d28";
    ctx.beginPath(); ctx.arc(-11, -4, 2, 0, Math.PI * 2); ctx.arc(11, -4, 2, 0, Math.PI * 2); ctx.fill();
  } else if (enemy.type === "puppet") {
    ctx.beginPath(); ctx.arc(0, -17, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillRect(-12, -4, 24, 32); ctx.strokeRect(-12, -4, 24, 32);
    ctx.beginPath(); ctx.moveTo(-12, 3); ctx.lineTo(-28, 18); ctx.moveTo(12, 3); ctx.lineTo(28, 18); ctx.stroke();
  } else {
    ctx.rotate(Math.sin(t * 0.7) * 0.04);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / 12;
      const r = i % 2 === 0 ? 70 : 52;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f3dfb9";
    ctx.beginPath(); ctx.arc(-25, -8, 12, 0, Math.PI * 2); ctx.arc(25, -8, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#29251f";
    ctx.beginPath(); ctx.arc(-25, -8, 5, 0, Math.PI * 2); ctx.arc(25, -8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-30, 28); ctx.quadraticCurveTo(0, 44, 30, 28); ctx.stroke();
  }

  if (enemy.marked > 0) {
    ctx.strokeStyle = "#b64f3d";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, enemy.r + 8 + Math.sin(t * 7) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  if (enemy.elite || enemy.boss) {
    const width = enemy.boss ? 140 : 70;
    ctx.fillStyle = "rgba(38,35,31,0.18)";
    ctx.fillRect(-width / 2, enemy.r + 12, width, 5);
    ctx.fillStyle = enemy.boss ? "#a54535" : "#50766a";
    ctx.fillRect(-width / 2, enemy.r + 12, width * clamp(enemy.hp / enemy.maxHp, 0, 1), 5);
  }
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, game: Game, t: number) {
  drawPlayerArt(ctx, game.player, t);
}

function drawOrbitWeapons(ctx: CanvasRenderingContext2D, game: Game) {
  const drawOrbit = (weapon: WeaponState, count: number, radius: number, speedScale: number) => {
    const info = weaponInfo[weapon.id];
    for (let i = 0; i < count; i++) {
      const angle = game.orbitAngle * speedScale + (Math.PI * 2 * i) / count;
      const x = game.player.x + Math.cos(angle) * radius;
      const y = game.player.y + Math.sin(angle) * radius;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      drawWeaponGlyph(ctx, weapon.id, weapon.level, 0, 0, 0, info.color);
      ctx.restore();
    }
  };

  for (const weapon of game.weapons) {
    if (weapon.id === "umbrella") drawOrbit(weapon, weapon.branch === "a" ? (weapon.level >= 5 ? 4 : 3) : 1, weapon.branch === "a" ? 82 : 62, 1);
    if (weapon.id === "sword" && weapon.branch === "b") drawOrbit(weapon, weapon.level >= 5 ? 5 : 3, 72, 1);
    if (weapon.id === "scissors" && weapon.branch === "b") drawOrbit(weapon, weapon.level >= 5 ? 4 : 2, 100, 1.45);
  }
}

function drawGame(ctx: CanvasRenderingContext2D, game: Game, t: number, joystick: { active: boolean; bx: number; by: number; x: number; y: number }, art: LoadedArt | null) {
  drawBackdrop(ctx, game.elapsed, false, art);
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.strokeStyle = seasonData[getSeason(game.elapsed)].wash;
  ctx.lineWidth = 1;
  for (let x = 80; x < W; x += 160) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.restore();

  for (const pickup of game.pickups) {
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    const size = 5 + Math.sin(pickup.pulse) * 1.5;
    ctx.fillStyle = "#50766a";
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-size, -size, size * 2, size * 2);
    ctx.restore();
  }

  for (const projectile of game.projectiles) {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
    ctx.fillStyle = projectile.color;
    ctx.strokeStyle = "#2b2924";
    ctx.lineWidth = 1.5;
    if (projectile.kind === "fan") {
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-8, -7); ctx.lineTo(-4, 0); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (projectile.kind === "scissors") {
      ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(11, 5); ctx.moveTo(-10, 6); ctx.lineTo(11, -5); ctx.stroke();
    } else if (projectile.kind === "abacus") {
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillRect(-10, -projectile.r / 2, 20, projectile.r);
    }
    ctx.restore();
  }

  for (const enemy of game.enemies) drawEnemy(ctx, enemy, t, art);
  drawOrbitWeapons(ctx, game);
  drawPlayer(ctx, game, t);

  for (const particle of game.particles) {
    ctx.save();
    ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (joystick.active) {
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = "#29251f";
    ctx.beginPath(); ctx.arc(joystick.bx, joystick.by, 48, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f3ead5";
    ctx.beginPath(); ctx.arc(joystick.x, joystick.y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

export function PaperGuildGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const artRef = useRef<LoadedArt | null>(null);
  const modeRef = useRef<Mode>("menu");
  const keysRef = useRef(new Set<string>());
  const joystickRef = useRef({ active: false, pointerId: -1, bx: 0, by: 0, x: 0, y: 0 });
  const lastFrameRef = useRef(0);
  const hudClockRef = useRef(0);
  const [mode, setModeState] = useState<Mode>("menu");
  const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot);
  const [options, setOptions] = useState<UpgradeOption[]>([]);
  const [trials, setTrials] = useState<Set<TrialId>>(new Set());
  const [trialsUnlocked, setTrialsUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("paper-guild-cleared") === "yes";
    } catch {
      return false;
    }
  });
  const [tutorialKey, setTutorialKey] = useState(0);
  const [artProgress, setArtProgress] = useState(0);
  const [artReady, setArtReady] = useState(false);

  const setMode = useCallback((next: Mode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  useEffect(() => {
    let active = true;
    loadArtAssets((progress) => {
      if (active) setArtProgress(progress);
    }).then((art) => {
      if (!active) return;
      artRef.current = art;
      setArtProgress(1);
      setArtReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const openUpgrade = useCallback((game: Game, rareOnly = false) => {
    finishHumanForm(game.player);
    const nextOptions = rareOnly
      ? makeRareOptions(game)
      : makeUpgradeOptions(game);
    setOptions(nextOptions.slice(0, 3));
    setSnapshot(snapshotOf(game));
    setMode("upgrade");
  }, [setMode]);

  const endRun = useCallback((victory: boolean) => {
    const game = gameRef.current;
    if (!game) return;
    if (victory) {
      try { localStorage.setItem("paper-guild-cleared", "yes"); } catch {}
      setTrialsUnlocked(true);
    }
    setSnapshot(snapshotOf(game));
    setMode("result");
  }, [setMode]);

  const onBossDefeated = useCallback((enemy: Enemy) => {
    const game = gameRef.current;
    if (!game) return;
    if (game.endless || enemy.bossTier === "mid") {
      openUpgrade(game, true);
      return;
    }
    setSnapshot(snapshotOf(game));
    setMode("bossChoice");
  }, [openUpgrade, setMode]);

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      keysRef.current.add(key);
      if (key === "escape" && modeRef.current === "playing") {
        if (gameRef.current) finishHumanForm(gameRef.current.player);
        setMode("paused");
      }
      else if (key === "escape" && modeRef.current === "paused") setMode("playing");
    };
    const onUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", onDown, { passive: false });
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [setMode]);

  useEffect(() => {
    let frame = 0;
    const loop = (time: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        frame = requestAnimationFrame(loop);
        return;
      }
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      const rawDt = lastFrameRef.current ? (time - lastFrameRef.current) / 1000 : 0;
      const dt = Math.min(rawDt, 0.033);
      lastFrameRef.current = time;
      const game = gameRef.current;

      if (!game) {
        drawBackdrop(ctx, time / 1000, true, artRef.current);
        const cycle = (time / 1000) % 5;
        const previewProgress = cycle < 1.65
          ? 0
          : cycle < 1.95
            ? (cycle - 1.65) / 0.3
            : cycle < 3.35
              ? 1
              : cycle < 3.65
                ? 1 - (cycle - 3.35) / 0.3
                : 0;
        const previewState = cycle < 1.65 || cycle >= 3.65
          ? "human"
          : cycle < 1.95
            ? "foldingToPlane"
            : cycle < 3.35
              ? "plane"
              : "foldingToHuman";
        ctx.save();
        ctx.translate(1000, 340);
        ctx.scale(2.65, 2.65);
        drawPlayerArt(ctx, {
          x: 0,
          y: 0,
          invuln: 0,
          formProgress: previewProgress,
          formState: previewState,
        }, time / 1000);
        ctx.restore();
        frame = requestAnimationFrame(loop);
        return;
      }

      if (modeRef.current === "playing") {
        game.elapsed += dt;
        game.player.invuln = Math.max(0, game.player.invuln - dt);
        game.orbitAngle += 0;
        game.tutorial = game.elapsed < 8;

        let dx = 0;
        let dy = 0;
        const keys = keysRef.current;
        if (keys.has("w") || keys.has("arrowup")) dy -= 1;
        if (keys.has("s") || keys.has("arrowdown")) dy += 1;
        if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
        if (keys.has("d") || keys.has("arrowright")) dx += 1;

        const pad = navigator.getGamepads?.()[0];
        if (pad && Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0) > 0.2) {
          dx += pad.axes[0] ?? 0;
          dy += pad.axes[1] ?? 0;
        }
        const joy = joystickRef.current;
        if (joy.active) {
          dx += clamp((joy.x - joy.bx) / 44, -1, 1);
          dy += clamp((joy.y - joy.by) / 44, -1, 1);
        }

        const moving = Math.hypot(dx, dy) > 0.08;
        const direction = moving ? normalize(dx, dy) : { x: 0, y: 0 };
        stepPlayerForm(game.player, moving, direction.x, direction.y, dt);
        if (moving) {
          const weatherScale = game.environmental.startsWith("逆风") ? 0.88 : 1;
          const speed = 205 * game.player.speed * weatherScale;
          game.player.x = clamp(game.player.x + direction.x * speed * dt, 34, W - 34);
          game.player.y = clamp(game.player.y + direction.y * speed * dt, 42, H - 38);
        }

        game.spawnClock -= dt;
        const bossAlive = game.enemies.some((enemy) => enemy.boss);
        if (!game.endless) {
          if (game.elapsed >= 360 && !game.midBossSpawned && !bossAlive) {
            spawnEnemy(game, "taotie");
            game.midBossSpawned = true;
          }
          if (game.elapsed >= RUN_TIME && !game.finalBossSpawned && !bossAlive) {
            spawnEnemy(game, "nian");
            game.finalBossSpawned = true;
          }
        } else if (game.elapsed >= game.nextBossAt && !bossAlive) {
          spawnEnemy(game, game.endlessBossCount % 2 === 0 ? "taotie" : "nian");
          game.endlessBossCount += 1;
          game.nextBossAt += 120;
        }
        if (game.spawnClock <= 0 && game.enemies.length < 150) {
          const density = game.trials.has("crowd") ? 1.32 : 1;
          const count = Math.min(4, 1 + Math.floor(game.elapsed / 150));
          for (let i = 0; i < count; i++) spawnEnemy(game);
          game.spawnClock = Math.max(0.2, (0.92 - game.elapsed * 0.0009) / density);
        }
        const eliteTimes = [120, 300];
        for (const eliteTime of eliteTimes) {
          if (game.elapsed >= eliteTime && game.elapsed - dt < eliteTime) spawnEnemy(game, eliteTime === 120 ? "lion" : "puppet");
        }

        if (game.endless && game.elapsed >= game.nextEnvironmentAt) {
          const effects = ["逆风 · 步速稍缓", "灯火 · 灯笼精增多", "落叶障 · 轻敌加速", "精英增援"];
          game.environmental = effects[Math.floor(Math.random() * effects.length)];
          game.nextEnvironmentAt += 120;
          if (game.environmental === "精英增援") {
            spawnEnemy(game, "lion");
            spawnEnemy(game, "puppet");
          }
          openUpgrade(game, true);
        }

        fireWeapons(game, dt);
        updateOrbitWeapons(game, dt);
        updateProjectiles(game, dt);

        for (const enemy of game.enemies) {
          enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
          enemy.marked = Math.max(0, enemy.marked - dt);
          const direction = normalize(game.player.x - enemy.x, game.player.y - enemy.y);
          let speedScale = 1;
          if (game.environmental.startsWith("落叶障") && (enemy.type === "shoe" || enemy.type === "fish")) speedScale = 1.18;
          enemy.x += direction.x * enemy.speed * speedScale * dt;
          enemy.y += direction.y * enemy.speed * speedScale * dt;
          if (distSq(enemy.x, enemy.y, game.player.x, game.player.y) < (enemy.r + 19) ** 2 && game.player.invuln <= 0) {
            game.player.life -= enemy.damage;
            game.player.invuln = 1.25;
            forceHumanForm(game.player);
            addBurst(game, game.player.x, game.player.y, "#a54535", 20);
            if (game.player.life <= 0) {
              endRun(false);
              break;
            }
          }
        }

        removeDead(game, onBossDefeated);

        for (const pickup of game.pickups) {
          pickup.pulse += dt * 5;
          const distance = Math.sqrt(distSq(pickup.x, pickup.y, game.player.x, game.player.y));
          const magnet = 135 * game.player.magnet;
          if (distance < magnet) {
            const direction = normalize(game.player.x - pickup.x, game.player.y - pickup.y);
            const pull = 110 + (magnet - distance) * 3.5;
            pickup.x += direction.x * pull * dt;
            pickup.y += direction.y * pull * dt;
          }
          if (distance < 24) {
            game.player.xp += pickup.value;
            pickup.value = 0;
          }
        }
        game.pickups = game.pickups.filter((pickup) => pickup.value > 0);

        if (game.player.xp >= game.player.nextXp && modeRef.current === "playing") {
          game.player.xp -= game.player.nextXp;
          game.player.level += 1;
          game.player.nextXp = 7 + game.player.level * 5;
          openUpgrade(game);
        }

        for (const particle of game.particles) {
          particle.life -= dt;
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          particle.vx *= 0.97;
          particle.vy *= 0.97;
        }
        game.particles = game.particles.filter((particle) => particle.life > 0).slice(-450);
        game.projectiles = game.projectiles.slice(-320);

        hudClockRef.current += dt;
        if (hudClockRef.current > 0.18) {
          hudClockRef.current = 0;
          setSnapshot(snapshotOf(game));
        }
      }

      drawGame(ctx, game, time / 1000, joystickRef.current, artRef.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [endRun, onBossDefeated, openUpgrade]);

  const startGame = () => {
    if (!artReady) return;
    const game = createGame(trials);
    gameRef.current = game;
    setSnapshot(snapshotOf(game));
    setTutorialKey((value) => value + 1);
    setMode("playing");
  };

  const chooseUpgrade = (option: UpgradeOption) => {
    const game = gameRef.current;
    if (!game) return;
    applyUpgrade(game, option);
    setSnapshot(snapshotOf(game));
    setMode("playing");
  };

  const continueEndless = () => {
    const game = gameRef.current;
    if (!game) return;
    game.endless = true;
    game.environmental = "四时再启";
    game.nextEnvironmentAt = game.elapsed + 120;
    game.nextBossAt = game.elapsed + 120;
    game.endlessBossCount = 0;
    setSnapshot(snapshotOf(game));
    setMode("playing");
  };

  const returnToMenu = () => {
    gameRef.current = null;
    setSnapshot(initialSnapshot);
    setMode("menu");
  };

  const toggleTrial = (trial: TrialId) => {
    if (!trialsUnlocked) return;
    setTrials((current) => {
      const next = new Set(current);
      if (next.has(trial)) next.delete(trial); else next.add(trial);
      return next;
    });
  };

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (modeRef.current !== "playing") return;
    const pos = pointerPosition(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    joystickRef.current = { active: true, pointerId: event.pointerId, bx: pos.x, by: pos.y, x: pos.x, y: pos.y };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const joy = joystickRef.current;
    if (!joy.active || joy.pointerId !== event.pointerId) return;
    const pos = pointerPosition(event);
    const delta = normalize(pos.x - joy.bx, pos.y - joy.by);
    const length = Math.min(48, Math.hypot(pos.x - joy.bx, pos.y - joy.by));
    joy.x = joy.bx + delta.x * length;
    joy.y = joy.by + delta.y * length;
  };

  const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (joystickRef.current.pointerId === event.pointerId) joystickRef.current.active = false;
  };

  const season = seasonData[getSeason(snapshot.elapsed)];
  const elapsedDisplay = snapshot.endless
    ? `无尽 ${formatTime(snapshot.elapsed - RUN_TIME)}`
    : formatTime(snapshot.elapsed);
  const resultVictory = snapshot.life > 0 && snapshot.elapsed >= RUN_TIME;
  const trialLabels: Record<TrialId, string> = { swift: "疾行", crowd: "聚众", elite: "强敌" };
  const rank = snapshot.score >= 8000 ? "甲" : snapshot.score >= 4500 ? "乙" : snapshot.score >= 2200 ? "丙" : "丁";

  return (
    <main className="page">
      <section className="game-shell" aria-label="纸上百工游戏区域">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          aria-label="游戏画面"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        />
        <div className="paper-grain" />

        {mode === "menu" && (
          <div className="overlay menu">
            <div className="menu-panel">
              <p className="kicker"><span className="seal">游</span>四时流转 · 百器自鸣</p>
              <h1 className="title">纸上<span>百工</span></h1>
              <p className="subtitle">
                操控一位会折成纸飞机的旅人，在春夏秋冬中收集器物。你只需移动，武器会替你开路。
              </p>
              <div className="feature-row">
                <span>八分钟一卷</span>
                <span>全自动武器</span>
                <span>双路线成器</span>
                <span>三组合鸣</span>
              </div>
              <button className="primary-button" onClick={startGame} disabled={!artReady}>
                {artReady ? "展开这一卷" : `研墨装裱 ${Math.round(artProgress * 100)}%`}
              </button>
              <div className="trial-area">
                <p className="trial-label">{trialsUnlocked ? "试炼签 · 可叠加" : "首次收卷后解锁试炼签"}</p>
                <div className="trials">
                  {(Object.keys(trialLabels) as TrialId[]).map((trial) => (
                    <button
                      className={`trial ${trials.has(trial) ? "active" : ""}`}
                      disabled={!trialsUnlocked}
                      onClick={() => toggleTrial(trial)}
                      key={trial}
                    >
                      {trialLabels[trial]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {mode !== "menu" && (
          <div className="hud" aria-live="polite">
            <div className="hud-top">
              <div className="status-card">
                <div className="status-line">
                  <span className="hearts">{"◆".repeat(snapshot.life)}{"◇".repeat(Math.max(0, snapshot.maxLife - snapshot.life))}</span>
                  <span>旅人 · {snapshot.level}级</span>
                </div>
                <div className="xp-track"><span style={{ width: `${clamp(snapshot.xp / snapshot.nextXp, 0, 1) * 100}%` }} /></div>
              </div>
              <div className="time-card">
                <span className="season-pill" style={{ borderColor: season.accent }}>{season.name}</span>
                <strong className="timer">{elapsedDisplay}</strong>
                <button
                  className="icon-button"
                  aria-label="暂停游戏"
                  onClick={() => {
                    if (gameRef.current) finishHumanForm(gameRef.current.player);
                    setMode("paused");
                  }}
                >
                  Ⅱ
                </button>
              </div>
            </div>
            <div className="hud-bottom">
              <div className="weapon-bar">
                {snapshot.weapons.map((weapon) => (
                  <span className="weapon-chip" key={weapon.id}>
                    {weaponInfo[weapon.id].glyph} {weaponInfo[weapon.id].name} <strong>{weapon.level}</strong>
                  </span>
                ))}
              </div>
              <div className="resonance-list">
                {snapshot.environmental && <span>{snapshot.environmental}</span>}
                {snapshot.resonances.map((name) => <span key={name}>{name}</span>)}
              </div>
            </div>
          </div>
        )}

        {mode === "playing" && snapshot.elapsed < 8 && (
          <div className="tutorial" key={tutorialKey}>WASD / 方向键 / 拖动屏幕移动 · 武器自动攻击</div>
        )}

        {mode === "upgrade" && (
          <div className="overlay modal-shade">
            <div className="upgrade-panel">
              <h2 className="upgrade-heading">择一器，继续行</h2>
              <p className="upgrade-note">升级期间时间暂停；第三阶将锁定进化路线。</p>
              <div className="upgrade-grid">
                {options.map((option) => (
                  <button
                    className="upgrade-card"
                    style={{ "--accent": option.accent } as React.CSSProperties}
                    onClick={() => chooseUpgrade(option)}
                    key={option.key}
                  >
                    <span className="card-type">{option.subtitle}</span>
                    <h3>{option.title}</h3>
                    <p>{option.description}</p>
                    <span className="level-dots" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((dot) => <i className={dot <= option.targetLevel ? "on" : ""} key={dot} />)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === "paused" && (
          <div className="overlay modal-shade">
            <div className="pause-panel">
              <div className="result-seal">歇</div>
              <h2>暂且搁笔</h2>
              <p className="subtitle">这一卷仍在原处，回来便可继续。</p>
              <div className="button-row" style={{ justifyContent: "center" }}>
                <button className="primary-button" onClick={() => setMode("playing")}>继续行旅</button>
                <button className="secondary-button" onClick={returnToMenu}>返回卷首</button>
              </div>
            </div>
          </div>
        )}

        {mode === "bossChoice" && (
          <div className="overlay modal-shade">
            <div className="result-panel">
              <div className="result-seal">胜</div>
              <h2>岁夜年兽已伏</h2>
              <p className="subtitle">八分钟的四时行旅已经写完。现在收卷，或让四季继续流转。</p>
              <div className="boss-choice">
                <button className="primary-button" onClick={() => endRun(true)}>
                  收卷结算<span className="choice-note">保存战绩并解锁试炼签</span>
                </button>
                <button className="secondary-button" onClick={continueEndless}>
                  续写无尽<span className="choice-note">每两分钟获得天象与稀有强化</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {mode === "result" && (
          <div className="overlay modal-shade">
            <div className="result-panel">
              <div className="result-seal">{resultVictory ? "成" : "止"}</div>
              <h2>{resultVictory ? "此卷已成" : "纸薄路长"}</h2>
              <p className="subtitle">
                {resultVictory ? "百器相鸣，四时归卷。" : "器物已经记住这趟行旅，换一种组合再来一卷。"}
              </p>
              <div className="stats">
                <div><strong>{formatTime(snapshot.elapsed)}</strong><span>行旅时间</span></div>
                <div><strong>{snapshot.kills}</strong><span>驱散精怪</span></div>
                <div><strong>{rank}</strong><span>本卷评级</span></div>
              </div>
              <div className="button-row" style={{ justifyContent: "center" }}>
                <button className="primary-button" onClick={startGame}>再写一卷</button>
                <button className="secondary-button" onClick={returnToMenu}>返回卷首</button>
              </div>
            </div>
          </div>
        )}
      </section>
      <div className="rotate-hint">请将手机横过来<br />让这一卷徐徐展开</div>
    </main>
  );
}
