import {
  accumulator,
  beam,
  chain,
  copy,
  delayed,
  execute,
  lightning,
  mark,
  orbit,
  projectile,
  summon,
  zone,
} from "./effects";
import type {
  EffectSpec,
  EffectTag,
  MasteryDefinition,
  MasteryId,
  WeaponDefinition,
  WeaponId,
  WeaponRoute,
  WeaponRouteId,
  WeaponRouteKey,
} from "./types";

type MasteryInput = {
  name: string;
  description: string;
  effects: readonly EffectSpec[];
};

function route(
  weaponId: WeaponId,
  key: WeaponRouteKey,
  name: string,
  description: string,
  tier3Effects: readonly EffectSpec[],
  tier4Effects: readonly EffectSpec[],
  focus: MasteryInput,
  chained: MasteryInput,
): WeaponRoute {
  const routeId = `${weaponId}:${key}` as WeaponRouteId;
  const makeMastery = (masteryKey: "focus" | "chain", input: MasteryInput): MasteryDefinition => ({
    id: `${routeId}:${masteryKey}` as MasteryId,
    key: masteryKey,
    name: input.name,
    description: input.description,
    effects: input.effects,
    artKey: `weapon/${weaponId}/${key}/mastery-${masteryKey}`,
  });

  return {
    id: routeId,
    key,
    name,
    description,
    tier3Effects,
    tier4Effects,
    masteries: [makeMastery("focus", focus), makeMastery("chain", chained)],
    artKeys: {
      tier3: `weapon/${weaponId}/${key}/tier-3`,
      tier4: `weapon/${weaponId}/${key}/tier-4`,
    },
  };
}

function weapon(
  id: WeaponId,
  name: string,
  shortName: string,
  description: string,
  color: string,
  tags: readonly EffectTag[],
  baseEffects: readonly EffectSpec[],
  refinedEffects: readonly EffectSpec[],
  routes: readonly [WeaponRoute, WeaponRoute, WeaponRoute],
): WeaponDefinition {
  return {
    id,
    name,
    shortName,
    description,
    color,
    tags,
    baseEffects,
    refinedEffects,
    routes,
    artKeys: {
      icon: `weapon/${id}/icon`,
      tier1: `weapon/${id}/tier-1`,
      tier2: `weapon/${id}/tier-2`,
    },
    audioKey: `weapon.${id}`,
  };
}

const swordRoutes: WeaponDefinition["routes"] = [
  route(
    "sword",
    "a",
    "御剑穿标",
    "飞剑贯穿敌阵并为强敌留下剑印。",
    [
      projectile("sword-a-flight", ["blade", "mark"], 20, 0.72, {
        pierce: 3,
        speed: 780,
        markSeconds: 3,
        visualKey: "fx/sword/flying-mark",
      }),
      mark("sword-a-mark", ["blade", "mark"], { duration: 3, damageTakenMultiplier: 1.16 }),
    ],
    [projectile("sword-a-refine", ["blade", "mark"], 28, 0.62, { pierce: 5, speed: 860, homing: 0.18 })],
    {
      name: "一线天",
      description: "飞剑改为一道贯通画面的剑光，剑印被同时引爆。",
      effects: [beam("sword-a-focus", ["blade", "mark"], 72, { length: 900, width: 24 })],
    },
    {
      name: "剑符追命",
      description: "命中剑印目标后分出追命小剑。",
      effects: [chain("sword-a-chain", ["blade", "mark"], 31, { jumps: 4, preferMarked: true })],
    },
  ),
  route(
    "sword",
    "b",
    "环身剑阵",
    "竹剑分化成环身剑影，持续切开近敌。",
    [orbit("sword-b-ring", ["blade", "guard"], 14, { count: 3, radius: 104, angularSpeed: 2.8 })],
    [orbit("sword-b-refine", ["blade", "guard"], 19, { count: 4, radius: 118, angularSpeed: 3.15 })],
    {
      name: "九宫卫",
      description: "剑阵扩为内外双环，靠近时减缓敌人。",
      effects: [
        orbit("sword-b-focus", ["blade", "guard"], 24, { count: 6, radius: 138, hitCooldown: 0.24 }),
        zone("sword-b-slow", ["blade", "guard"], 4, { radius: 148, followsOwner: true, slow: 0.22 }),
      ],
    },
    {
      name: "离阵飞芒",
      description: "每轮旋转都有一柄剑影离阵飞射。",
      effects: [projectile("sword-b-chain", ["blade"], 40, 0.8, { pattern: "radial", count: 4, pierce: 2 })],
    },
  ),
  route(
    "sword",
    "c",
    "破军斩列",
    "蓄出宽阔横斩，专门切开成列敌群。",
    [beam("sword-c-cleave", ["blade"], 38, { length: 370, width: 74, sweepDegrees: 54 })],
    [beam("sword-c-refine", ["blade"], 54, { length: 440, width: 92, sweepDegrees: 70 })],
    {
      name: "开山",
      description: "横斩更宽，并对低生命目标施加斩决。",
      effects: [beam("sword-c-focus", ["blade", "execute"], 82, { length: 540, width: 120 }), execute("sword-c-execute", ["blade", "execute"])],
    },
    {
      name: "回锋",
      description: "横斩收势后沿反方向再斩一次。",
      effects: [delayed("sword-c-chain", ["blade"], 62, { delay: 0.38, radius: 170, repeats: 1 })],
    },
  ),
];

const fanRoutes: WeaponDefinition["routes"] = [
  route(
    "fan",
    "a",
    "广域罡风",
    "一扇铺开宽阔风面，推削密集敌群。",
    [projectile("fan-a-gale", ["wind"], 13, 0.88, { pattern: "fan", count: 5, spreadDegrees: 68, radius: 18, pierce: 2 })],
    [projectile("fan-a-refine", ["wind"], 18, 0.72, { pattern: "fan", count: 7, spreadDegrees: 84, radius: 21, pierce: 3 })],
    {
      name: "八面来风",
      description: "罡风从前后两面同时展开。",
      effects: [projectile("fan-a-focus", ["wind"], 24, 0.66, { pattern: "radial", count: 12, pierce: 3 })],
    },
    {
      name: "风墙留痕",
      description: "风浪经过之处留下短暂风墙。",
      effects: [zone("fan-a-chain", ["wind"], 18, { duration: 2.2, radius: 92, slow: 0.25 })],
    },
  ),
  route(
    "fan",
    "b",
    "追踪寻风",
    "风刃绕开近敌，追向视野内的高危目标。",
    [projectile("fan-b-seeker", ["wind"], 22, 0.7, { count: 2, homing: 0.74, lifetime: 2.4 })],
    [projectile("fan-b-refine", ["wind"], 28, 0.58, { count: 3, homing: 0.86, lifetime: 2.7 })],
    {
      name: "回风认主",
      description: "风刃命中后折返，再寻找另一个目标。",
      effects: [chain("fan-b-focus", ["wind"], 33, { jumps: 5, range: 240, falloff: 0.9 })],
    },
    {
      name: "穿林寻隙",
      description: "风刃优先寻找已被标记的目标并穿透。",
      effects: [projectile("fan-b-chain", ["wind", "mark"], 42, 0.52, { count: 3, homing: 1, pierce: 3 })],
    },
  ),
  route(
    "fan",
    "c",
    "借势转化",
    "将受击与近身压力积成风势，自动反卷。",
    [accumulator("fan-c-momentum", ["wind", "guard"], "fanMomentum", 6, [projectile("fan-c-release", ["wind"], 44, 0, { pattern: "radial", count: 10 })], { trigger: "onDamageTaken" })],
    [zone("fan-c-refine", ["wind", "guard"], 17, { trigger: "onDamageTaken", radius: 150, duration: 2.4, slow: 0.3 })],
    {
      name: "四两拨潮",
      description: "受击风势转为短暂无敌风幕与反击。",
      effects: [orbit("fan-c-focus", ["wind", "guard"], 28, { trigger: "onDamageTaken", count: 5, blockStrength: 1 })],
    },
    {
      name: "借器生风",
      description: "主武器施放时，折扇复制其部分威力。",
      effects: [copy("fan-c-chain", ["wind"], { source: "primaryWeapon", damageMultiplier: 0.52, maxCopies: 1 })],
    },
  ),
];

const umbrellaRoutes: WeaponDefinition["routes"] = [
  route(
    "umbrella",
    "a",
    "护身伞阵",
    "八瓣伞面环身轮转，抵住贴近的敌人。",
    [orbit("umbrella-a-guard", ["rain", "guard"], 12, { count: 2, radius: 84, hitCooldown: 0.3, blockStrength: 0.6 })],
    [orbit("umbrella-a-refine", ["rain", "guard"], 17, { count: 3, radius: 102, hitCooldown: 0.25, blockStrength: 0.8 })],
    {
      name: "华盖不移",
      description: "伞阵合成完整华盖，周期抵消一次接触伤害。",
      effects: [orbit("umbrella-a-focus", ["rain", "guard"], 25, { count: 4, radius: 116, blockStrength: 1 })],
    },
    {
      name: "伞缘飞瀑",
      description: "每次格挡都从伞缘甩出一圈水珠。",
      effects: [projectile("umbrella-a-chain", ["rain", "guard"], 23, 0.8, { trigger: "onDamageTaken", pattern: "radial", count: 12 })],
    },
  ),
  route(
    "umbrella",
    "b",
    "暴雨飞针",
    "伞骨开合，向四周泼出细密雨针。",
    [projectile("umbrella-b-needles", ["rain"], 9, 0.76, { pattern: "radial", count: 10, speed: 680 })],
    [projectile("umbrella-b-refine", ["rain"], 12, 0.6, { pattern: "radial", count: 14, speed: 760, pierce: 1 })],
    {
      name: "骤雨连檐",
      description: "连续落下三轮错位雨针。",
      effects: [projectile("umbrella-b-focus", ["rain"], 15, 0.46, { pattern: "radial", count: 18, pierce: 1 })],
    },
    {
      name: "雨脚留池",
      description: "雨针消失处留下减速水洼。",
      effects: [zone("umbrella-b-chain", ["rain"], 16, { trigger: "onHit", duration: 2.8, radius: 62, slow: 0.34 })],
    },
  ),
  route(
    "umbrella",
    "c",
    "引雷承霆",
    "伞尖承接天雷，定期劈向高生命敌人。",
    [lightning("umbrella-c-thunder", ["rain", "lightning"], 44, { strikes: 2, radius: 48, delay: 0.48 })],
    [lightning("umbrella-c-refine", ["rain", "lightning"], 58, { strikes: 3, radius: 56, delay: 0.36, chainRange: 160 })],
    {
      name: "八骨分霆",
      description: "八根伞骨各引一道细雷，覆盖周围敌群。",
      effects: [lightning("umbrella-c-focus", ["rain", "lightning"], 36, { strikes: 8, radius: 44, delay: 0.28 })],
    },
    {
      name: "蓄雷归檐",
      description: "未命中的雷力储存在伞面，下一次集中释放。",
      effects: [accumulator("umbrella-c-chain", ["rain", "lightning"], "umbrellaCharge", 4, [lightning("umbrella-c-release", ["lightning"], 130, { strikes: 1, radius: 118 })])],
    },
  ),
];

const scissorsRoutes: WeaponDefinition["routes"] = [
  route(
    "scissors",
    "a",
    "远程回旋",
    "燕尾剪刃飞出后沿弧线回返。",
    [projectile("scissors-a-return", ["craft", "blade"], 24, 0.82, { count: 2, pierce: 3, lifetime: 1.8 })],
    [projectile("scissors-a-refine", ["craft", "blade"], 33, 0.68, { count: 2, pierce: 5, lifetime: 2.2 })],
    {
      name: "双燕归梁",
      description: "去程与回程各自锁定不同目标。",
      effects: [chain("scissors-a-focus", ["craft", "blade"], 38, { jumps: 4, range: 220, falloff: 0.95 })],
    },
    {
      name: "裁风留线",
      description: "剪刃之间牵出一条持续切割的裁线。",
      effects: [beam("scissors-a-chain", ["craft", "blade"], 28, { trigger: "onHit", length: 360, width: 12, duration: 0.5 })],
    },
  ),
  route(
    "scissors",
    "b",
    "近身绞云",
    "剪刃在身边高速开合，绞碎近身敌群。",
    [orbit("scissors-b-shear", ["craft", "blade"], 18, { count: 2, radius: 74, angularSpeed: 3.7, hitCooldown: 0.2 })],
    [orbit("scissors-b-refine", ["craft", "blade"], 25, { count: 3, radius: 88, angularSpeed: 4.25, hitCooldown: 0.16 })],
    {
      name: "云锦万剪",
      description: "剪刃数量翻倍，并在内环交错旋转。",
      effects: [orbit("scissors-b-focus", ["craft", "blade"], 30, { count: 6, radius: 104, angularSpeed: 4.7, hitCooldown: 0.14 })],
    },
    {
      name: "断线飞花",
      description: "被绞云击败的敌人炸开为四枚小剪刃。",
      effects: [projectile("scissors-b-chain", ["craft", "blade"], 21, 0, { trigger: "onKill", pattern: "radial", count: 4, pierce: 1 })],
    },
  ),
  route(
    "scissors",
    "c",
    "残血断裁",
    "剪刃追逐衰弱目标，并施加断裁。",
    [execute("scissors-c-execute", ["craft", "blade", "execute"], { threshold: 0.2, bossThreshold: 0.035, bonusDamage: 28 })],
    [
      mark("scissors-c-mark", ["craft", "execute"], { priority: "lowestHp", duration: 4, damageTakenMultiplier: 1.22 }),
      execute("scissors-c-refine", ["craft", "blade", "execute"], { threshold: 0.25, bossThreshold: 0.055, bonusDamage: 42 }),
    ],
    {
      name: "一剪两断",
      description: "断裁阈值提高，成功斩决会立刻寻找下一个目标。",
      effects: [execute("scissors-c-focus", ["craft", "blade", "execute"], { threshold: 0.32, bossThreshold: 0.08, bonusDamage: 64 })],
    },
    {
      name: "量命裁衣",
      description: "对高生命目标造成等比例额外伤害。",
      effects: [beam("scissors-c-chain", ["craft", "blade"], 54, { trigger: "onMarkedHit", length: 280, width: 34 })],
    },
  ),
];

const abacusRoutes: WeaponDefinition["routes"] = [
  route(
    "abacus",
    "a",
    "高频珠雨",
    "漆木算珠快速连射，形成持续火力。",
    [projectile("abacus-a-rain", ["ledger"], 10, 0.28, { pattern: "burst", count: 3, speed: 720 })],
    [projectile("abacus-a-refine", ["ledger"], 13, 0.22, { pattern: "burst", count: 4, speed: 780 })],
    {
      name: "万珠落盘",
      description: "每十二次攻击泼出一圈金边算珠。",
      effects: [accumulator("abacus-a-focus", ["ledger"], "pearlRain", 12, [projectile("abacus-a-ring", ["ledger"], 22, 0, { pattern: "radial", count: 18 })], { trigger: "onAttack" })],
    },
    {
      name: "快账不息",
      description: "命中同一目标会逐步加快下一轮珠雨。",
      effects: [projectile("abacus-a-chain", ["ledger"], 18, 0.16, { pattern: "burst", count: 5, singleTargetHitCooldown: 0.08 })],
    },
  ),
  route(
    "abacus",
    "b",
    "贯穿珠列",
    "算珠排成笔直长列，一次贯通整队敌人。",
    [projectile("abacus-b-line", ["ledger"], 24, 0.74, { pattern: "single", count: 4, pierce: 7, spreadDegrees: 0 })],
    [beam("abacus-b-refine", ["ledger"], 43, { length: 640, width: 22, duration: 0.22 })],
    {
      name: "一笔通账",
      description: "珠列贯穿全场，并按穿透数提高末端伤害。",
      effects: [beam("abacus-b-focus", ["ledger"], 76, { length: 960, width: 30, duration: 0.28 })],
    },
    {
      name: "横竖成筹",
      description: "纵列命中后追加一道横向珠列。",
      effects: [delayed("abacus-b-chain", ["ledger"], 56, { delay: 0.32, radius: 130 })],
    },
  ),
  route(
    "abacus",
    "c",
    "累计清账",
    "每次命中记一笔，满账后集中清算强敌。",
    [accumulator("abacus-c-ledger", ["ledger", "mark"], "ledgerHits", 18, [mark("abacus-c-mark", ["ledger", "mark"], { duration: 4, damageTakenMultiplier: 1.25 })])],
    [accumulator("abacus-c-refine", ["ledger"], "ledgerHits", 14, [delayed("abacus-c-settle", ["ledger"], 88, { delay: 0.4, radius: 96 })])],
    {
      name: "铁算盘",
      description: "清账优先结算最高生命目标，伤害不再衰减。",
      effects: [delayed("abacus-c-focus", ["ledger", "mark"], 146, { trigger: "onMarkedHit", delay: 0.28, radius: 112 })],
    },
    {
      name: "滚账生息",
      description: "每次清账保留一半计数，并复制上一次结算。",
      effects: [copy("abacus-c-chain", ["ledger"], { source: "markedHit", damageMultiplier: 0.62, maxCopies: 2 })],
    },
  ),
];

const crossbowRoutes: WeaponDefinition["routes"] = [
  route(
    "crossbow",
    "a",
    "扇面齐射",
    "木铜连弩一次铺出整面弩矢。",
    [projectile("crossbow-a-volley", ["mechanism"], 15, 0.72, { pattern: "fan", count: 5, spreadDegrees: 42, speed: 900 })],
    [projectile("crossbow-a-refine", ["mechanism"], 20, 0.6, { pattern: "fan", count: 7, spreadDegrees: 54, speed: 980, pierce: 1 })],
    {
      name: "百步攒射",
      description: "齐射收束为远程密集箭簇，优先攻击标记目标。",
      effects: [projectile("crossbow-a-focus", ["mechanism", "mark"], 29, 0.48, { pattern: "fan", count: 9, spreadDegrees: 24, homing: 0.25 })],
    },
    {
      name: "弦回二发",
      description: "齐射后半拍从两侧再补一轮交叉弩矢。",
      effects: [delayed("crossbow-a-chain", ["mechanism"], 24, { trigger: "onAttack", delay: 0.3, radius: 118, repeats: 1 })],
    },
  ),
  route(
    "crossbow",
    "b",
    "实体弩机",
    "在场边架设自动寻敌的小弩机。",
    [summon("crossbow-b-turret", ["mechanism"], "crossbow-turret", { count: 1, duration: 10, attackDamage: 17, attackCooldown: 0.55 })],
    [summon("crossbow-b-refine", ["mechanism"], "crossbow-turret", { count: 2, duration: 12, attackDamage: 22, attackCooldown: 0.46 })],
    {
      name: "四隅弩城",
      description: "四台弩机固定阵角，交叉覆盖战场。",
      effects: [summon("crossbow-b-focus", ["mechanism"], "corner-ballista", { count: 4, duration: 15, attackDamage: 31, attackCooldown: 0.4 })],
    },
    {
      name: "机关移营",
      description: "弩机会缓慢跟随玩家，并复制标记目标。",
      effects: [summon("crossbow-b-chain", ["mechanism", "mark"], "walking-ballista", { count: 3, duration: 16, attackDamage: 27, moveSpeed: 130 })],
    },
  ),
  route(
    "crossbow",
    "c",
    "火种埋爆",
    "弩矢埋入火种，延迟爆开朱砂火花。",
    [delayed("crossbow-c-charge", ["mechanism", "fire"], 38, { delay: 0.7, radius: 76 })],
    [delayed("crossbow-c-refine", ["mechanism", "fire"], 54, { delay: 0.55, radius: 94, repeats: 1 })],
    {
      name: "连营火",
      description: "爆点彼此引燃，形成方向明确的连爆。",
      effects: [chain("crossbow-c-focus", ["mechanism", "fire"], 62, { jumps: 6, range: 175, falloff: 0.88 })],
    },
    {
      name: "伏火待岁",
      description: "未触发的火种累积，强敌靠近时一并引爆。",
      effects: [accumulator("crossbow-c-chain", ["mechanism", "fire"], "buriedFire", 8, [delayed("crossbow-c-burst", ["fire"], 128, { delay: 0.18, radius: 156 })])],
    },
  ),
];

const pipaRoutes: WeaponDefinition["routes"] = [
  route(
    "pipa",
    "a",
    "锥形音浪",
    "拨弦推出层叠音浪，覆盖人物前方。",
    [beam("pipa-a-wave", ["music"], 27, { length: 360, width: 112, sweepDegrees: 34 })],
    [beam("pipa-a-refine", ["music"], 39, { length: 440, width: 148, sweepDegrees: 46 })],
    {
      name: "十面声场",
      description: "音浪向十个方向同时展开。",
      effects: [projectile("pipa-a-focus", ["music"], 31, 0.82, { pattern: "radial", count: 10, radius: 24, pierce: 4 })],
    },
    {
      name: "推弦叠浪",
      description: "每道音浪尾部跟随一道较窄的高音浪。",
      effects: [delayed("pipa-a-chain", ["music"], 48, { trigger: "onAttack", delay: 0.24, radius: 130, repeats: 1 })],
    },
  ),
  route(
    "pipa",
    "b",
    "跳跃泛音",
    "泛音在敌群之间跳跃，越跳越清亮。",
    [chain("pipa-b-harmonic", ["music"], 20, { jumps: 4, range: 210, falloff: 0.92 })],
    [chain("pipa-b-refine", ["music"], 28, { jumps: 7, range: 235, falloff: 0.95 })],
    {
      name: "大珠小珠",
      description: "每次跳跃分出一枚反向小音珠。",
      effects: [projectile("pipa-b-focus", ["music"], 22, 0, { trigger: "onHit", pattern: "radial", count: 3, homing: 0.6 })],
    },
    {
      name: "余韵寻声",
      description: "泛音能再次跳回旧目标，但保留单体命中间隔。",
      effects: [chain("pipa-b-chain", ["music"], 35, { jumps: 11, range: 260, falloff: 0.97 })],
    },
  ),
  route(
    "pipa",
    "c",
    "驻留余音",
    "弹奏后留下可持续伤敌的水墨音场。",
    [zone("pipa-c-resonance", ["music"], 19, { radius: 105, duration: 4.2, tickRate: 0.3 })],
    [zone("pipa-c-refine", ["music"], 27, { radius: 126, duration: 5.2, tickRate: 0.25, slow: 0.18 })],
    {
      name: "绕梁三日",
      description: "音场可同时保留三处，重叠处产生共振。",
      effects: [zone("pipa-c-focus", ["music"], 38, { radius: 142, duration: 7, tickRate: 0.2 })],
    },
    {
      name: "弦外有声",
      description: "其他武器命中音场中的敌人时复制一段余音。",
      effects: [copy("pipa-c-chain", ["music"], { source: "markedHit", damageMultiplier: 0.48, maxCopies: 2 })],
    },
  ),
];

const inklineRoutes: WeaponDefinition["routes"] = [
  route(
    "inkline",
    "a",
    "弹墨直线",
    "墨斗弹出笔直墨线，裁开整条路径。",
    [beam("inkline-a-snap", ["craft"], 34, { length: 600, width: 18, duration: 0.16 })],
    [beam("inkline-a-refine", ["craft"], 48, { length: 760, width: 24, duration: 0.22 })],
    {
      name: "百丈准绳",
      description: "墨线贯穿全场，并为命中目标留下规矩印。",
      effects: [beam("inkline-a-focus", ["craft", "mark"], 74, { length: 1100, width: 30 }), mark("inkline-a-mark", ["craft", "mark"], { duration: 4, damageTakenMultiplier: 1.2 })],
    },
    {
      name: "弹线回墨",
      description: "墨线弹回时沿原路再次切割。",
      effects: [delayed("inkline-a-chain", ["craft"], 61, { trigger: "onAttack", delay: 0.34, radius: 98 })],
    },
  ),
  route(
    "inkline",
    "b",
    "交叉裁域",
    "两道墨线交叉成界，持续伤害界内敌人。",
    [zone("inkline-b-cross", ["craft"], 24, { radius: 116, duration: 3.8, tickRate: 0.25 })],
    [zone("inkline-b-refine", ["craft"], 33, { radius: 145, duration: 4.8, tickRate: 0.2 })],
    {
      name: "井字天规",
      description: "裁域扩为井字格，边线与交点各自造成伤害。",
      effects: [zone("inkline-b-focus", ["craft"], 46, { radius: 184, duration: 6, tickRate: 0.18 })],
    },
    {
      name: "越界加刑",
      description: "敌人穿过边线时受到一次延迟裁决。",
      effects: [delayed("inkline-b-chain", ["craft", "execute"], 68, { trigger: "onHit", delay: 0.22, radius: 48 })],
    },
  ),
  route(
    "inkline",
    "c",
    "机关构件",
    "墨线折成纸木构件，自动拼装攻击机关。",
    [summon("inkline-c-parts", ["craft", "mechanism"], "inkline-frame", { count: 1, duration: 9, attackDamage: 20, attackCooldown: 0.7 })],
    [summon("inkline-c-refine", ["craft", "mechanism"], "inkline-frame", { count: 2, duration: 12, attackDamage: 27, attackCooldown: 0.55 })],
    {
      name: "榫卯自成",
      description: "构件自行拼成持续旋转的攻城轮。",
      effects: [summon("inkline-c-focus", ["craft", "mechanism"], "mortise-wheel", { count: 2, duration: 16, attackDamage: 42, attackCooldown: 0.4 })],
    },
    {
      name: "借器搭台",
      description: "构件模仿前一件武器的攻击标签。",
      effects: [copy("inkline-c-chain", ["craft", "mechanism"], { source: "previousWeaveNode", damageMultiplier: 0.58, maxCopies: 2 })],
    },
  ),
];

const lanternRoutes: WeaponDefinition["routes"] = [
  route(
    "lantern",
    "a",
    "影卒召唤",
    "走马灯投下影卒，在近处自动追敌。",
    [summon("lantern-a-soldier", ["shadow"], "shadow-soldier", { count: 2, duration: 10, attackDamage: 16, attackCooldown: 0.72 })],
    [summon("lantern-a-refine", ["shadow"], "shadow-soldier", { count: 3, duration: 13, attackDamage: 23, attackCooldown: 0.58 })],
    {
      name: "百戏列阵",
      description: "影卒分为枪、盾、弓三种，并协同列阵。",
      effects: [summon("lantern-a-focus", ["shadow"], "shadow-troupe", { count: 6, duration: 18, attackDamage: 31, attackCooldown: 0.5 })],
    },
    {
      name: "影亡复灯",
      description: "影卒消散时化为追踪灯火。",
      effects: [projectile("lantern-a-chain", ["shadow", "fire"], 35, 0, { trigger: "onKill", pattern: "radial", count: 5, homing: 0.75 })],
    },
  ),
  route(
    "lantern",
    "b",
    "旋灯火环",
    "灯影与火舌组成环身光轮。",
    [orbit("lantern-b-ring", ["shadow", "fire"], 16, { count: 4, radius: 112, angularSpeed: 2.5 })],
    [orbit("lantern-b-refine", ["shadow", "fire"], 22, { count: 6, radius: 132, angularSpeed: 2.85 })],
    {
      name: "十二走马",
      description: "十二幅灯影沿双层轨道奔行。",
      effects: [orbit("lantern-b-focus", ["shadow", "fire"], 29, { count: 12, radius: 156, angularSpeed: 3.2, hitCooldown: 0.2 })],
    },
    {
      name: "灯影离轮",
      description: "每转一圈就有一匹影马冲向强敌。",
      effects: [beam("lantern-b-chain", ["shadow", "fire"], 57, { trigger: "periodic", length: 520, width: 42, duration: 0.3 })],
    },
  ),
  route(
    "lantern",
    "c",
    "摹写主器",
    "灯影周期描摹当前主武器的一次攻击。",
    [copy("lantern-c-copy", ["shadow"], { source: "primaryWeapon", damageMultiplier: 0.42, maxCopies: 1, internalCooldown: 2.4 })],
    [copy("lantern-c-refine", ["shadow"], { source: "primaryWeapon", damageMultiplier: 0.58, maxCopies: 1, internalCooldown: 1.8 })],
    {
      name: "一灯千面",
      description: "按顺序摹写已持有的全部武器。",
      effects: [copy("lantern-c-focus", ["shadow"], { source: "previousWeaveNode", damageMultiplier: 0.66, maxCopies: 4, internalCooldown: 1.4 })],
    },
    {
      name: "照影成真",
      description: "摹写命中后留下一个短暂实体影像。",
      effects: [summon("lantern-c-chain", ["shadow"], "copied-weapon-shadow", { trigger: "onHit", count: 1, duration: 5, attackDamage: 38, attackCooldown: 0.65 })],
    },
  ),
];

const thunderRoutes: WeaponDefinition["routes"] = [
  route(
    "thunderSeal",
    "a",
    "阳雷点杀",
    "五雷令点名最高生命敌人，降下一道阳雷。",
    [lightning("thunder-a-solar", ["lightning"], 72, { strikes: 1, radius: 54, delay: 0.48 })],
    [lightning("thunder-a-refine", ["lightning"], 104, { strikes: 1, radius: 66, delay: 0.36 })],
    {
      name: "神霄一令",
      description: "阳雷对精英与Boss获得额外斩击。",
      effects: [lightning("thunder-a-focus", ["lightning", "execute"], 176, { strikes: 1, radius: 86, delay: 0.3 }), execute("thunder-a-execute", ["lightning", "execute"], { threshold: 0.1, bossThreshold: 0.035, bonusDamage: 88 })],
    },
    {
      name: "雷印追摄",
      description: "阳雷留下雷印，下一击会追摄周围敌人。",
      effects: [mark("thunder-a-mark", ["lightning", "mark"], { duration: 5, damageTakenMultiplier: 1.24 }), chain("thunder-a-chain", ["lightning", "mark"], 64, { jumps: 5, preferMarked: true })],
    },
  ),
  route(
    "thunderSeal",
    "b",
    "阴雷连锁",
    "一道低鸣阴雷在拥挤敌群中连续跳跃。",
    [chain("thunder-b-chain", ["lightning", "spirit"], 31, { jumps: 5, range: 220, falloff: 0.9 })],
    [chain("thunder-b-refine", ["lightning", "spirit"], 43, { jumps: 8, range: 250, falloff: 0.94 })],
    {
      name: "玄坛雷网",
      description: "连锁经过的路径短暂组成雷网。",
      effects: [zone("thunder-b-focus", ["lightning", "spirit"], 42, { trigger: "onHit", radius: 94, duration: 3.5, tickRate: 0.2, slow: 0.2 })],
    },
    {
      name: "阴阳递转",
      description: "最后一次跳跃转为高伤阳雷。",
      effects: [lightning("thunder-b-chain-mastery", ["lightning"], 128, { trigger: "onHit", strikes: 1, radius: 72, delay: 0.18 })],
    },
  ),
  route(
    "thunderSeal",
    "c",
    "周期雷坛",
    "人物脚下展开雷坛，按节拍降下群雷。",
    [zone("thunder-c-altar", ["lightning", "spirit"], 27, { radius: 132, duration: 4.5, tickRate: 0.4, followsOwner: true })],
    [lightning("thunder-c-refine", ["lightning", "spirit"], 48, { strikes: 5, radius: 52, delay: 0.42 })],
    {
      name: "五方雷坛",
      description: "雷坛在五个方位依次敕雷，完成后中央合击。",
      effects: [lightning("thunder-c-focus", ["lightning", "spirit"], 72, { strikes: 6, radius: 78, delay: 0.3 })],
    },
    {
      name: "步罡踏斗",
      description: "持续移动为雷坛蓄势，停下时集中释放。",
      effects: [accumulator("thunder-c-chain", ["lightning", "spirit"], "altarSteps", 20, [lightning("thunder-c-release", ["lightning"], 156, { strikes: 5, radius: 96 })], { trigger: "periodic" })],
    },
  ),
];

export const WEAPON_DEFINITIONS = [
  weapon(
    "sword",
    "青篁竹剑",
    "竹剑",
    "竹节剑身自动刺向近敌，进退皆有清俊剑意。",
    "#52776b",
    ["blade", "mark"],
    [projectile("sword-base", ["blade"], 16, 0.72, { speed: 760, pierce: 1 })],
    [projectile("sword-refined", ["blade"], 22, 0.64, { speed: 820, pierce: 2 })],
    swordRoutes,
  ),
  weapon(
    "fan",
    "山水折扇",
    "折扇",
    "山水扇面自动挥出风浪，擅长塑造攻击范围。",
    "#477b83",
    ["wind"],
    [projectile("fan-base", ["wind"], 12, 0.88, { pattern: "fan", count: 3, spreadDegrees: 38, pierce: 1 })],
    [projectile("fan-refined", ["wind"], 16, 0.76, { pattern: "fan", count: 4, spreadDegrees: 46, pierce: 2 })],
    fanRoutes,
  ),
  weapon(
    "umbrella",
    "八瓣油纸伞",
    "纸伞",
    "朱砂伞面绕身开合，兼具守势与远程变化。",
    "#aa4b40",
    ["rain", "guard"],
    [orbit("umbrella-base", ["rain", "guard"], 10, { radius: 76, blockStrength: 0.35 })],
    [orbit("umbrella-refined", ["rain", "guard"], 14, { count: 2, radius: 86, blockStrength: 0.5 })],
    umbrellaRoutes,
  ),
  weapon(
    "scissors",
    "燕尾裁衣剪",
    "裁剪",
    "燕尾剪刃往返开合，善于追击与断裁。",
    "#a36d3f",
    ["craft", "blade"],
    [projectile("scissors-base", ["craft", "blade"], 18, 0.86, { count: 2, pierce: 2 })],
    [projectile("scissors-refined", ["craft", "blade"], 24, 0.74, { count: 2, pierce: 3 })],
    scissorsRoutes,
  ),
  weapon(
    "abacus",
    "漆木铁算盘",
    "算盘",
    "算珠成排弹射，以命中次数和排列制造收益。",
    "#795348",
    ["ledger"],
    [projectile("abacus-base", ["ledger"], 9, 0.42, { pattern: "burst", count: 2 })],
    [projectile("abacus-refined", ["ledger"], 12, 0.34, { pattern: "burst", count: 3 })],
    abacusRoutes,
  ),
  weapon(
    "crossbow",
    "木铜连弩",
    "连弩",
    "木铜机括按稳定节奏放矢，适合持续压制。",
    "#4f694e",
    ["mechanism"],
    [projectile("crossbow-base", ["mechanism"], 15, 0.65, { speed: 920 })],
    [projectile("crossbow-refined", ["mechanism"], 20, 0.55, { count: 2, speed: 980 })],
    crossbowRoutes,
  ),
  weapon(
    "pipa",
    "月白琵琶",
    "琵琶",
    "弦音化成音浪、泛音与余韵，擅长跨目标传播。",
    "#80709a",
    ["music"],
    [beam("pipa-base", ["music"], 20, { length: 290, width: 72, sweepDegrees: 24 })],
    [beam("pipa-refined", ["music"], 27, { length: 330, width: 92, sweepDegrees: 30 })],
    pipaRoutes,
  ),
  weapon(
    "inkline",
    "鲁班墨斗",
    "墨斗",
    "墨线校直、划界并拼合机关，是百工的规矩。",
    "#3d4b48",
    ["craft", "mechanism"],
    [beam("inkline-base", ["craft"], 25, { length: 430, width: 14 })],
    [beam("inkline-refined", ["craft"], 34, { length: 520, width: 18 })],
    inklineRoutes,
  ),
  weapon(
    "lantern",
    "百戏走马灯",
    "走马灯",
    "灯影召出百戏影形，也能摹写其他武器。",
    "#bd6b3e",
    ["shadow", "fire"],
    [summon("lantern-base", ["shadow"], "lantern-shadow", { count: 1, duration: 8, attackDamage: 13 })],
    [summon("lantern-refined", ["shadow"], "lantern-shadow", { count: 2, duration: 10, attackDamage: 18 })],
    lanternRoutes,
  ),
  weapon(
    "thunderSeal",
    "五雷号令",
    "五雷令",
    "少量道门雷法以令牌为引，长预警后敕落雷霆。",
    "#596d91",
    ["lightning", "spirit"],
    [lightning("thunder-base", ["lightning"], 48, { strikes: 1, radius: 44, delay: 0.55 })],
    [lightning("thunder-refined", ["lightning"], 64, { strikes: 2, radius: 48, delay: 0.46 })],
    thunderRoutes,
  ),
] as const satisfies readonly WeaponDefinition[];

export const WEAPON_IDS = WEAPON_DEFINITIONS.map((weaponDefinition) => weaponDefinition.id);

export const WEAPONS_BY_ID: Readonly<Record<WeaponId, WeaponDefinition>> = Object.freeze(
  Object.fromEntries(WEAPON_DEFINITIONS.map((definition) => [definition.id, definition])) as Record<
    WeaponId,
    WeaponDefinition
  >,
);

export function getWeaponDefinition(id: WeaponId): WeaponDefinition {
  return WEAPONS_BY_ID[id];
}

export function getWeaponRoute(routeId: WeaponRouteId): WeaponRoute {
  const [weaponId] = routeId.split(":") as [WeaponId, WeaponRouteKey];
  const found = WEAPONS_BY_ID[weaponId].routes.find((candidate) => candidate.id === routeId);
  if (!found) {
    throw new Error(`Unknown weapon route: ${routeId}`);
  }
  return found;
}

export function getMasteryDefinition(masteryId: MasteryId): MasteryDefinition {
  const [weaponId, routeKey] = masteryId.split(":") as [WeaponId, WeaponRouteKey, string];
  const routeDefinition = WEAPONS_BY_ID[weaponId].routes.find((candidate) => candidate.key === routeKey);
  const found = routeDefinition?.masteries.find((candidate) => candidate.id === masteryId);
  if (!found) {
    throw new Error(`Unknown weapon mastery: ${masteryId}`);
  }
  return found;
}
