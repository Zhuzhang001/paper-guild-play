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
    "飞剑留印",
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
      name: "拉直剑线",
      description: "飞剑出手时拉成一道贯穿长线，并同时引爆沿线剑印。",
      effects: [beam("sword-a-focus", ["blade", "mark"], 72, { length: 900, width: 24 })],
    },
    {
      name: "印后分剑",
      description: "飞剑命中带印目标时，分向附近四个敌人继续追击。",
      effects: [chain("sword-a-chain", ["blade", "mark"], 31, { jumps: 4, preferMarked: true })],
    },
  ),
  route(
    "sword",
    "b",
    "护身剑圈",
    "竹节剑分化成环身剑影，持续切开近敌。",
    [orbit("sword-b-ring", ["blade", "guard"], 14, { count: 3, radius: 104, angularSpeed: 2.8 })],
    [orbit("sword-b-refine", ["blade", "guard"], 19, { count: 4, radius: 118, angularSpeed: 3.15 })],
    {
      name: "叠起双圈",
      description: "剑圈转动时叠成内外双圈，并减慢进入外圈的敌人。",
      effects: [
        orbit("sword-b-focus", ["blade", "guard"], 24, { count: 6, radius: 138, hitCooldown: 0.24 }),
        zone("sword-b-slow", ["blade", "guard"], 4, { radius: 148, followsOwner: true, slow: 0.22 }),
      ],
    },
    {
      name: "转满飞剑",
      description: "剑圈完成一轮攻击时，向四周补射四柄可穿透的剑影。",
      effects: [projectile("sword-b-chain", ["blade"], 40, 0.8, { pattern: "radial", count: 4, pierce: 2 })],
    },
  ),
  route(
    "sword",
    "c",
    "横扫",
    "蓄出宽阔横斩，专门切开成列敌群。",
    [beam("sword-c-cleave", ["blade"], 38, { length: 370, width: 74, sweepDegrees: 54 })],
    [beam("sword-c-refine", ["blade"], 54, { length: 440, width: 92, sweepDegrees: 70 })],
    {
      name: "弱时加宽",
      description: "横扫命中低生命目标时扩大斩面，并追加断裁伤害。",
      effects: [beam("sword-c-focus", ["blade", "execute"], 82, { length: 540, width: 120 }), execute("sword-c-execute", ["blade", "execute"])],
    },
    {
      name: "收手再扫",
      description: "横扫命中后等待0.38秒，在目标处再补一次横扫。",
      effects: [delayed("sword-c-chain", ["blade"], 62, { delay: 0.38, radius: 170, repeats: 1 })],
    },
  ),
];

const fanRoutes: WeaponDefinition["routes"] = [
  route(
    "fan",
    "a",
    "铺风",
    "一扇铺开宽阔风面，推削密集敌群。",
    [projectile("fan-a-gale", ["wind"], 13, 0.88, { pattern: "fan", count: 5, spreadDegrees: 68, radius: 18, pierce: 2 })],
    [projectile("fan-a-refine", ["wind"], 18, 0.72, { pattern: "fan", count: 7, spreadDegrees: 84, radius: 21, pierce: 3 })],
    {
      name: "前后铺风",
      description: "折扇出手时向前后和两侧同时铺出十二道风刃。",
      effects: [projectile("fan-a-focus", ["wind"], 24, 0.66, { pattern: "radial", count: 12, pierce: 3 })],
    },
    {
      name: "过处留风",
      description: "铺风结束后留下2.2秒的风场，持续伤害并减慢其中敌人。",
      effects: [zone("fan-a-chain", ["wind"], 18, { duration: 2.2, radius: 92, slow: 0.25 })],
    },
  ),
  route(
    "fan",
    "b",
    "回风",
    "风刃绕开近敌，追向视野内的高危目标。",
    [projectile("fan-b-seeker", ["wind"], 22, 0.7, { count: 2, homing: 0.74, lifetime: 2.4 })],
    [projectile("fan-b-refine", ["wind"], 28, 0.58, { count: 3, homing: 0.86, lifetime: 2.7 })],
    {
      name: "命中折返",
      description: "风刃命中时折返，并依次寻找附近五个目标。",
      effects: [chain("fan-b-focus", ["wind"], 33, { jumps: 5, range: 240, falloff: 0.9 })],
    },
    {
      name: "找印穿过",
      description: "每次出手优先寻找带印目标，并让三道风刃各穿过三个敌人。",
      effects: [projectile("fan-b-chain", ["wind", "mark"], 42, 0.52, { count: 3, homing: 1, pierce: 3 })],
    },
  ),
  route(
    "fan",
    "c",
    "借风",
    "人物每次受击都会计数，累计六次后向四周反卷风刃。",
    [accumulator("fan-c-momentum", ["wind", "guard"], "fanMomentum", 6, [projectile("fan-c-release", ["wind"], 44, 0, { pattern: "radial", count: 10 })], { trigger: "onDamageTaken" })],
    [zone("fan-c-refine", ["wind", "guard"], 17, { trigger: "onDamageTaken", radius: 150, duration: 2.4, slow: 0.3 })],
    {
      name: "受击挡开",
      description: "人物受击时展开五片挡伤风幕，并用风幕反击近敌。",
      effects: [orbit("fan-c-focus", ["wind", "guard"], 28, { trigger: "onDamageTaken", count: 5, blockStrength: 1 })],
    },
    {
      name: "跟着补扇",
      description: "折扇出手时，复制第一把武器的一次攻击并保留52%伤害。",
      effects: [copy("fan-c-chain", ["wind"], { source: "primaryWeapon", damageMultiplier: 0.52, maxCopies: 1 })],
    },
  ),
];

const umbrellaRoutes: WeaponDefinition["routes"] = [
  route(
    "umbrella",
    "a",
    "撑伞护身",
    "油纸伞面环身轮转，抵住贴近的敌人。",
    [orbit("umbrella-a-guard", ["rain", "guard"], 12, { count: 2, radius: 84, hitCooldown: 0.3, blockStrength: 0.6 })],
    [orbit("umbrella-a-refine", ["rain", "guard"], 17, { count: 3, radius: 102, hitCooldown: 0.25, blockStrength: 0.8 })],
    {
      name: "合伞挡伤",
      description: "伞面轮转时合成四片护面，可完整挡下一次接触伤害。",
      effects: [orbit("umbrella-a-focus", ["rain", "guard"], 25, { count: 4, radius: 116, blockStrength: 1 })],
    },
    {
      name: "挡后甩珠",
      description: "人物挡伤或受击时，从伞缘向四周甩出十二颗水珠。",
      effects: [projectile("umbrella-a-chain", ["rain", "guard"], 23, 0.8, { trigger: "onDamageTaken", pattern: "radial", count: 12 })],
    },
  ),
  route(
    "umbrella",
    "b",
    "开伞散雨",
    "伞骨开合，向四周泼出细密雨针。",
    [projectile("umbrella-b-needles", ["rain"], 9, 0.76, { pattern: "radial", count: 10, speed: 680 })],
    [projectile("umbrella-b-refine", ["rain"], 12, 0.6, { pattern: "radial", count: 14, speed: 760, pierce: 1 })],
    {
      name: "加密雨针",
      description: "每次开伞改撒十八枚雨针，并让每枚雨针穿过一个敌人。",
      effects: [projectile("umbrella-b-focus", ["rain"], 15, 0.46, { pattern: "radial", count: 18, pierce: 1 })],
    },
    {
      name: "针落成洼",
      description: "雨针命中时留下2.8秒水洼，持续伤害并减慢其中敌人。",
      effects: [zone("umbrella-b-chain", ["rain"], 16, { trigger: "onHit", duration: 2.8, radius: 62, slow: 0.34 })],
    },
  ),
  route(
    "umbrella",
    "c",
    "伞骨接雷",
    "伞尖定期接雷，并把雷击分落到附近敌人处。",
    [lightning("umbrella-c-thunder", ["rain", "lightning"], 44, { strikes: 2, radius: 48, delay: 0.48 })],
    [lightning("umbrella-c-refine", ["rain", "lightning"], 58, { strikes: 3, radius: 56, delay: 0.36, chainRange: 160 })],
    {
      name: "八骨分雷",
      description: "每轮接雷时由八根伞骨各分一道细雷，覆盖周围敌群。",
      effects: [lightning("umbrella-c-focus", ["rain", "lightning"], 36, { strikes: 8, radius: 44, delay: 0.28 })],
    },
    {
      name: "攒满劈下",
      description: "伞雷累计命中四次后，把存雷集中劈在一处大范围内。",
      effects: [accumulator("umbrella-c-chain", ["rain", "lightning"], "umbrellaCharge", 4, [lightning("umbrella-c-release", ["lightning"], 130, { strikes: 1, radius: 118 })])],
    },
  ),
];

const scissorsRoutes: WeaponDefinition["routes"] = [
  route(
    "scissors",
    "a",
    "双燕回剪",
    "燕尾剪刃飞出后沿弧线回返。",
    [projectile("scissors-a-return", ["craft", "blade"], 24, 0.82, { count: 2, pierce: 3, lifetime: 1.8 })],
    [projectile("scissors-a-refine", ["craft", "blade"], 33, 0.68, { count: 2, pierce: 5, lifetime: 2.2 })],
    {
      name: "来回换敌",
      description: "剪刃命中后改找附近四个敌人，让去程与回程各换目标。",
      effects: [chain("scissors-a-focus", ["craft", "blade"], 38, { jumps: 4, range: 220, falloff: 0.95 })],
    },
    {
      name: "两刃拉线",
      description: "剪刃命中时在两刃之间拉出裁线，持续切割线上的敌人。",
      effects: [beam("scissors-a-chain", ["craft", "blade"], 28, { trigger: "onHit", length: 360, width: 12, duration: 0.5 })],
    },
  ),
  route(
    "scissors",
    "b",
    "贴身绞剪",
    "剪刃在身边高速开合，绞碎近身敌群。",
    [orbit("scissors-b-shear", ["craft", "blade"], 18, { count: 2, radius: 74, angularSpeed: 3.7, hitCooldown: 0.2 })],
    [orbit("scissors-b-refine", ["craft", "blade"], 25, { count: 3, radius: 88, angularSpeed: 4.25, hitCooldown: 0.16 })],
    {
      name: "加刃双绞",
      description: "剪刃转动时增至六片，并在内外两圈交错绞剪。",
      effects: [orbit("scissors-b-focus", ["craft", "blade"], 30, { count: 6, radius: 104, angularSpeed: 4.7, hitCooldown: 0.14 })],
    },
    {
      name: "剪倒分刃",
      description: "贴身剪击败敌人时，从倒下处向四周分出四枚小剪刃。",
      effects: [projectile("scissors-b-chain", ["craft", "blade"], 21, 0, { trigger: "onKill", pattern: "radial", count: 4, pierce: 1 })],
    },
  ),
  route(
    "scissors",
    "c",
    "追弱断裁",
    "剪刃追逐衰弱目标，并施加断裁。",
    [execute("scissors-c-execute", ["craft", "blade", "execute"], { threshold: 0.2, bossThreshold: 0.035, bonusDamage: 28 })],
    [
      mark("scissors-c-mark", ["craft", "execute"], { priority: "lowestHp", duration: 4, damageTakenMultiplier: 1.22 }),
      execute("scissors-c-refine", ["craft", "blade", "execute"], { threshold: 0.25, bossThreshold: 0.055, bonusDamage: 42 }),
    ],
    {
      name: "见弱就断",
      description: "剪刃命中时，直接断裁生命低于32%的普通敌人或8%的Boss。",
      effects: [execute("scissors-c-focus", ["craft", "blade", "execute"], { threshold: 0.32, bossThreshold: 0.08, bonusDamage: 64 })],
    },
    {
      name: "印上补剪",
      description: "剪刃命中带断裁印的目标时，补上一道宽剪光。",
      effects: [beam("scissors-c-chain", ["craft", "blade"], 54, { trigger: "onMarkedHit", length: 280, width: 34 })],
    },
  ),
];

const abacusRoutes: WeaponDefinition["routes"] = [
  route(
    "abacus",
    "a",
    "急拨珠",
    "漆木算珠快速连射，形成持续火力。",
    [projectile("abacus-a-rain", ["ledger"], 10, 0.28, { pattern: "burst", count: 3, speed: 720 })],
    [projectile("abacus-a-refine", ["ledger"], 13, 0.22, { pattern: "burst", count: 4, speed: 780 })],
    {
      name: "十二拨珠",
      description: "算盘累计出手十二次后，向四周泼出十八颗金边算珠。",
      effects: [accumulator("abacus-a-focus", ["ledger"], "pearlRain", 12, [projectile("abacus-a-ring", ["ledger"], 22, 0, { pattern: "radial", count: 18 })], { trigger: "onAttack" })],
    },
    {
      name: "连中快拨",
      description: "每轮改为五珠连拨，并缩短同一目标可再次受击的间隔。",
      effects: [projectile("abacus-a-chain", ["ledger"], 18, 0.16, { pattern: "burst", count: 5, singleTargetHitCooldown: 0.08 })],
    },
  ),
  route(
    "abacus",
    "b",
    "长列珠",
    "算珠排成笔直长列，一次贯通整队敌人。",
    [projectile("abacus-b-line", ["ledger"], 24, 0.74, { pattern: "single", count: 4, pierce: 7, spreadDegrees: 0 })],
    [beam("abacus-b-refine", ["ledger"], 43, { length: 640, width: 22, duration: 0.22 })],
    {
      name: "一列打穿",
      description: "算盘出手时把珠列拉至全场宽度，一次打穿沿线敌人。",
      effects: [beam("abacus-b-focus", ["ledger"], 76, { length: 960, width: 30, duration: 0.28 })],
    },
    {
      name: "横向补列",
      description: "长列命中后等待0.32秒，在目标处补一道横向珠列。",
      effects: [delayed("abacus-b-chain", ["ledger"], 56, { delay: 0.32, radius: 130 })],
    },
  ),
  route(
    "abacus",
    "c",
    "满筹清账",
    "每次命中记一笔，满账后集中清算强敌。",
    [accumulator("abacus-c-ledger", ["ledger", "mark"], "ledgerHits", 18, [mark("abacus-c-mark", ["ledger", "mark"], { duration: 4, damageTakenMultiplier: 1.25 })])],
    [accumulator("abacus-c-refine", ["ledger"], "ledgerHits", 14, [delayed("abacus-c-settle", ["ledger"], 88, { delay: 0.4, radius: 96 })])],
    {
      name: "先清大账",
      description: "清账打中带印目标时，在0.28秒后追加一次高伤范围结算。",
      effects: [delayed("abacus-c-focus", ["ledger", "mark"], 146, { trigger: "onMarkedHit", delay: 0.28, radius: 112 })],
    },
    {
      name: "照账再算",
      description: "算盘出手时复制最近一次打中带印目标的攻击，最多两次并保留62%伤害。",
      effects: [copy("abacus-c-chain", ["ledger"], { source: "markedHit", damageMultiplier: 0.62, maxCopies: 2 })],
    },
  ),
];

const crossbowRoutes: WeaponDefinition["routes"] = [
  route(
    "crossbow",
    "a",
    "排弩齐射",
    "木铜连弩一次铺出整面弩矢。",
    [projectile("crossbow-a-volley", ["mechanism"], 15, 0.72, { pattern: "fan", count: 5, spreadDegrees: 42, speed: 900 })],
    [projectile("crossbow-a-refine", ["mechanism"], 20, 0.6, { pattern: "fan", count: 7, spreadDegrees: 54, speed: 980, pierce: 1 })],
    {
      name: "收拢齐射",
      description: "连弩出手时把九支弩箭收拢成窄扇面，并略微追向带印目标。",
      effects: [projectile("crossbow-a-focus", ["mechanism", "mark"], 29, 0.48, { pattern: "fan", count: 9, spreadDegrees: 24, homing: 0.25 })],
    },
    {
      name: "半拍补射",
      description: "每轮齐射出手0.3秒后，在目标处再补一次范围射击。",
      effects: [delayed("crossbow-a-chain", ["mechanism"], 24, { trigger: "onAttack", delay: 0.3, radius: 118, repeats: 1 })],
    },
  ),
  route(
    "crossbow",
    "b",
    "落架弩台",
    "在场边架设自动寻敌的小弩机。",
    [summon("crossbow-b-turret", ["mechanism"], "crossbow-turret", { count: 1, duration: 10, attackDamage: 17, attackCooldown: 0.55 })],
    [summon("crossbow-b-refine", ["mechanism"], "crossbow-turret", { count: 2, duration: 12, attackDamage: 22, attackCooldown: 0.46 })],
    {
      name: "四角架弩",
      description: "每轮在四个方位架起四台弩机，持续15秒交叉射击。",
      effects: [summon("crossbow-b-focus", ["mechanism"], "corner-ballista", { count: 4, duration: 15, attackDamage: 31, attackCooldown: 0.4 })],
    },
    {
      name: "弩台跟人",
      description: "每轮架起三台可移动弩机，弩机会跟随人物并自行找敌。",
      effects: [summon("crossbow-b-chain", ["mechanism", "mark"], "walking-ballista", { count: 3, duration: 16, attackDamage: 27, moveSpeed: 130 })],
    },
  ),
  route(
    "crossbow",
    "c",
    "埋火弩",
    "弩矢埋入火种，延迟爆开朱砂火花。",
    [delayed("crossbow-c-charge", ["mechanism", "fire"], 38, { delay: 0.7, radius: 76 })],
    [delayed("crossbow-c-refine", ["mechanism", "fire"], 54, { delay: 0.55, radius: 94, repeats: 1 })],
    {
      name: "爆点接火",
      description: "火点命中时引燃附近六个目标，并让每次引燃伤害逐步减弱。",
      effects: [chain("crossbow-c-focus", ["mechanism", "fire"], 62, { jumps: 6, range: 175, falloff: 0.88 })],
    },
    {
      name: "攒火齐爆",
      description: "火点累计命中八次后，等待0.18秒并在一处引发大范围爆炸。",
      effects: [accumulator("crossbow-c-chain", ["mechanism", "fire"], "buriedFire", 8, [delayed("crossbow-c-burst", ["fire"], 128, { delay: 0.18, radius: 156 })])],
    },
  ),
];

const pipaRoutes: WeaponDefinition["routes"] = [
  route(
    "pipa",
    "a",
    "推弦开浪",
    "拨弦推出层叠音浪，覆盖人物前方。",
    [beam("pipa-a-wave", ["music"], 27, { length: 360, width: 112, sweepDegrees: 34 })],
    [beam("pipa-a-refine", ["music"], 39, { length: 440, width: 148, sweepDegrees: 46 })],
    {
      name: "十向推浪",
      description: "琵琶出手时向十个方向同时推出可穿过四个敌人的音珠。",
      effects: [projectile("pipa-a-focus", ["music"], 31, 0.82, { pattern: "radial", count: 10, radius: 24, pierce: 4 })],
    },
    {
      name: "尾后叠浪",
      description: "每道音浪推出0.24秒后，在尾部补上一道较窄的音浪。",
      effects: [delayed("pipa-a-chain", ["music"], 48, { trigger: "onAttack", delay: 0.24, radius: 130, repeats: 1 })],
    },
  ),
  route(
    "pipa",
    "b",
    "跳弦",
    "泛音命中后在敌群之间继续跳跃。",
    [chain("pipa-b-harmonic", ["music"], 20, { jumps: 4, range: 210, falloff: 0.92 })],
    [chain("pipa-b-refine", ["music"], 28, { jumps: 7, range: 235, falloff: 0.95 })],
    {
      name: "跳处分珠",
      description: "泛音每次命中时，向周围分出三颗会追敌的小音珠。",
      effects: [projectile("pipa-b-focus", ["music"], 22, 0, { trigger: "onHit", pattern: "radial", count: 3, homing: 0.6 })],
    },
    {
      name: "多跳旧敌",
      description: "泛音命中后继续跳向最多十一个目标，并保留每次跳跃的伤害。",
      effects: [chain("pipa-b-chain", ["music"], 35, { jumps: 11, range: 260, falloff: 0.97 })],
    },
  ),
  route(
    "pipa",
    "c",
    "留声",
    "弹奏后留下可持续伤敌的水墨音场。",
    [zone("pipa-c-resonance", ["music"], 19, { radius: 105, duration: 4.2, tickRate: 0.3 })],
    [zone("pipa-c-refine", ["music"], 27, { radius: 126, duration: 5.2, tickRate: 0.25, slow: 0.18 })],
    {
      name: "加宽留声",
      description: "每轮弹奏留下半径142的音场，持续7秒并每0.2秒伤害其中敌人。",
      effects: [zone("pipa-c-focus", ["music"], 38, { radius: 142, duration: 7, tickRate: 0.2 })],
    },
    {
      name: "照印留声",
      description: "琵琶出手时复制最近一次打中带印目标的攻击，最多两次并保留48%伤害。",
      effects: [copy("pipa-c-chain", ["music"], { source: "markedHit", damageMultiplier: 0.48, maxCopies: 2 })],
    },
  ),
];

const inklineRoutes: WeaponDefinition["routes"] = [
  route(
    "inkline",
    "a",
    "弹墨线",
    "墨斗弹出笔直墨线，裁开整条路径。",
    [beam("inkline-a-snap", ["craft"], 34, { length: 600, width: 18, duration: 0.16 })],
    [beam("inkline-a-refine", ["craft"], 48, { length: 760, width: 24, duration: 0.22 })],
    {
      name: "拉长墨线",
      description: "墨斗出手时把墨线拉至全场宽度，并为命中目标留印4秒。",
      effects: [beam("inkline-a-focus", ["craft", "mark"], 74, { length: 1100, width: 30 }), mark("inkline-a-mark", ["craft", "mark"], { duration: 4, damageTakenMultiplier: 1.2 })],
    },
    {
      name: "原路再割",
      description: "墨线弹出0.34秒后，沿原路补一次范围切割。",
      effects: [delayed("inkline-a-chain", ["craft"], 61, { trigger: "onAttack", delay: 0.34, radius: 98 })],
    },
  ),
  route(
    "inkline",
    "b",
    "框墨格",
    "两道墨线交叉成界，持续伤害界内敌人。",
    [zone("inkline-b-cross", ["craft"], 24, { radius: 116, duration: 3.8, tickRate: 0.25 })],
    [zone("inkline-b-refine", ["craft"], 33, { radius: 145, duration: 4.8, tickRate: 0.2 })],
    {
      name: "交叉框格",
      description: "每轮把墨格扩大为井字框，持续6秒切割边线与交点内的敌人。",
      effects: [zone("inkline-b-focus", ["craft"], 46, { radius: 184, duration: 6, tickRate: 0.18 })],
    },
    {
      name: "越线补割",
      description: "墨格命中敌人时等待0.22秒，在越线处补一次小范围切割。",
      effects: [delayed("inkline-b-chain", ["craft", "execute"], 68, { trigger: "onHit", delay: 0.22, radius: 48 })],
    },
  ),
  route(
    "inkline",
    "c",
    "搭木件",
    "墨线折成纸木构件，自动拼装攻击机关。",
    [summon("inkline-c-parts", ["craft", "mechanism"], "inkline-frame", { count: 1, duration: 9, attackDamage: 20, attackCooldown: 0.7 })],
    [summon("inkline-c-refine", ["craft", "mechanism"], "inkline-frame", { count: 2, duration: 12, attackDamage: 27, attackCooldown: 0.55 })],
    {
      name: "拼成木轮",
      description: "每轮把木件拼成两只攻城轮，持续16秒自动追敌。",
      effects: [summon("inkline-c-focus", ["craft", "mechanism"], "mortise-wheel", { count: 2, duration: 16, attackDamage: 42, attackCooldown: 0.4 })],
    },
    {
      name: "照前器搭",
      description: "墨斗出手时照前一件武器的攻击搭出两份副本，每份保留58%伤害。",
      effects: [copy("inkline-c-chain", ["craft", "mechanism"], { source: "previousWeaveNode", damageMultiplier: 0.58, maxCopies: 2 })],
    },
  ),
];

const lanternRoutes: WeaponDefinition["routes"] = [
  route(
    "lantern",
    "a",
    "放影人",
    "走马灯投下影卒，在近处自动追敌。",
    [summon("lantern-a-soldier", ["shadow"], "shadow-soldier", { count: 2, duration: 10, attackDamage: 16, attackCooldown: 0.72 })],
    [summon("lantern-a-refine", ["shadow"], "shadow-soldier", { count: 3, duration: 13, attackDamage: 23, attackCooldown: 0.58 })],
    {
      name: "三样列阵",
      description: "每轮放出六个枪、盾、弓影人，持续18秒协同追敌。",
      effects: [summon("lantern-a-focus", ["shadow"], "shadow-troupe", { count: 6, duration: 18, attackDamage: 31, attackCooldown: 0.5 })],
    },
    {
      name: "影散追火",
      description: "影人击败敌人时，从倒下处放出五团会追敌的灯火。",
      effects: [projectile("lantern-a-chain", ["shadow", "fire"], 35, 0, { trigger: "onKill", pattern: "radial", count: 5, homing: 0.75 })],
    },
  ),
  route(
    "lantern",
    "b",
    "转灯影",
    "灯影与火舌组成环身光轮。",
    [orbit("lantern-b-ring", ["shadow", "fire"], 16, { count: 4, radius: 112, angularSpeed: 2.5 })],
    [orbit("lantern-b-refine", ["shadow", "fire"], 22, { count: 6, radius: 132, angularSpeed: 2.85 })],
    {
      name: "双圈转影",
      description: "灯影转动时增至十二幅，并沿内外双圈持续碰击敌人。",
      effects: [orbit("lantern-b-focus", ["shadow", "fire"], 29, { count: 12, radius: 156, angularSpeed: 3.2, hitCooldown: 0.2 })],
    },
    {
      name: "转满冲出",
      description: "灯影完成一轮攻击时，向外冲出一道长距离影马。",
      effects: [beam("lantern-b-chain", ["shadow", "fire"], 57, { trigger: "periodic", length: 520, width: 42, duration: 0.3 })],
    },
  ),
  route(
    "lantern",
    "c",
    "照样",
    "灯影周期描摹当前主武器的一次攻击。",
    [copy("lantern-c-copy", ["shadow"], { source: "primaryWeapon", damageMultiplier: 0.42, maxCopies: 1, internalCooldown: 2.4 })],
    [copy("lantern-c-refine", ["shadow"], { source: "primaryWeapon", damageMultiplier: 0.58, maxCopies: 1, internalCooldown: 1.8 })],
    {
      name: "轮着照样",
      description: "每次照样时复制前一件武器的一次攻击，连放四份且每份保留66%伤害。",
      effects: [copy("lantern-c-focus", ["shadow"], { source: "previousWeaveNode", damageMultiplier: 0.66, maxCopies: 4, internalCooldown: 1.4 })],
    },
    {
      name: "命中留样",
      description: "照样攻击命中时留下一个武器影像，持续5秒自动攻击。",
      effects: [summon("lantern-c-chain", ["shadow"], "copied-weapon-shadow", { trigger: "onHit", count: 1, duration: 5, attackDamage: 38, attackCooldown: 0.65 })],
    },
  ),
];

const thunderRoutes: WeaponDefinition["routes"] = [
  route(
    "thunderSeal",
    "a",
    "点雷",
    "五雷木令点住一名敌人，稍后在落点降下一道雷。",
    [lightning("thunder-a-solar", ["lightning"], 72, { strikes: 1, radius: 54, delay: 0.48 })],
    [lightning("thunder-a-refine", ["lightning"], 104, { strikes: 1, radius: 66, delay: 0.36 })],
    {
      name: "专点强敌",
      description: "点雷命中时，直接处理生命低于10%的普通敌人或3.5%的Boss。",
      effects: [lightning("thunder-a-focus", ["lightning", "execute"], 176, { strikes: 1, radius: 86, delay: 0.3 }), execute("thunder-a-execute", ["lightning", "execute"], { threshold: 0.1, bossThreshold: 0.035, bonusDamage: 88 })],
    },
    {
      name: "点后再劈",
      description: "点雷命中时留印5秒，并从带印目标向附近五个敌人继续劈雷。",
      effects: [mark("thunder-a-mark", ["lightning", "mark"], { duration: 5, damageTakenMultiplier: 1.24 }), chain("thunder-a-chain", ["lightning", "mark"], 64, { jumps: 5, preferMarked: true })],
    },
  ),
  route(
    "thunderSeal",
    "b",
    "串雷",
    "一道雷击在拥挤敌群中连续跳跃。",
    [chain("thunder-b-chain", ["lightning", "spirit"], 31, { jumps: 5, range: 220, falloff: 0.9 })],
    [chain("thunder-b-refine", ["lightning", "spirit"], 43, { jumps: 8, range: 250, falloff: 0.94 })],
    {
      name: "串过留雷",
      description: "串雷每次命中时留下3.5秒雷区，持续伤害并减慢其中敌人。",
      effects: [zone("thunder-b-focus", ["lightning", "spirit"], 42, { trigger: "onHit", radius: 94, duration: 3.5, tickRate: 0.2, slow: 0.2 })],
    },
    {
      name: "串尾重劈",
      description: "串雷命中后等待0.18秒，在最后落点补一道高伤雷击。",
      effects: [lightning("thunder-b-chain-mastery", ["lightning"], 128, { trigger: "onHit", strikes: 1, radius: 72, delay: 0.18 })],
    },
  ),
  route(
    "thunderSeal",
    "c",
    "布雷坛",
    "人物脚下展开雷坛，按节拍降下群雷。",
    [zone("thunder-c-altar", ["lightning", "spirit"], 27, { radius: 132, duration: 4.5, tickRate: 0.4, followsOwner: true })],
    [lightning("thunder-c-refine", ["lightning", "spirit"], 48, { strikes: 5, radius: 52, delay: 0.42 })],
    {
      name: "五处轮劈",
      description: "雷坛每轮在五处依次劈雷，最后在中央补一次合击。",
      effects: [lightning("thunder-c-focus", ["lightning", "spirit"], 72, { strikes: 6, radius: 78, delay: 0.3 })],
    },
    {
      name: "二十拍齐劈",
      description: "雷坛累计运转二十拍后，在周围五处同时释放高伤雷击。",
      effects: [accumulator("thunder-c-chain", ["lightning", "spirit"], "altarSteps", 20, [lightning("thunder-c-release", ["lightning"], 156, { strikes: 5, radius: 96 })], { trigger: "periodic" })],
    },
  ),
];

export const WEAPON_DEFINITIONS = [
  weapon(
    "sword",
    "竹节剑",
    "竹节剑",
    "自动向近敌刺出飞剑；可改为留印穿透、护身剑圈或横扫。",
    "#52776b",
    ["blade", "mark"],
    [projectile("sword-base", ["blade"], 16, 0.72, { speed: 760, pierce: 1 })],
    [projectile("sword-refined", ["blade"], 22, 0.64, { speed: 820, pierce: 2 })],
    swordRoutes,
  ),
  weapon(
    "fan",
    "山水扇",
    "山水扇",
    "自动挥出扇形风刃；可改为铺风、回风或受击借风反击。",
    "#477b83",
    ["wind"],
    [projectile("fan-base", ["wind"], 12, 0.88, { pattern: "fan", count: 3, spreadDegrees: 38, pierce: 1 })],
    [projectile("fan-refined", ["wind"], 16, 0.76, { pattern: "fan", count: 4, spreadDegrees: 46, pierce: 2 })],
    fanRoutes,
  ),
  weapon(
    "umbrella",
    "八骨油纸伞",
    "八骨油纸伞",
    "伞面绕身挡住近敌；可改为护身、散射雨针或接雷。",
    "#aa4b40",
    ["rain", "guard"],
    [orbit("umbrella-base", ["rain", "guard"], 10, { radius: 76, blockStrength: 0.35 })],
    [orbit("umbrella-refined", ["rain", "guard"], 14, { count: 2, radius: 86, blockStrength: 0.5 })],
    umbrellaRoutes,
  ),
  weapon(
    "scissors",
    "燕尾剪",
    "燕尾剪",
    "两片剪刃自动往返切割；可改为回剪、贴身绞剪或追弱断裁。",
    "#a36d3f",
    ["craft", "blade"],
    [projectile("scissors-base", ["craft", "blade"], 18, 0.86, { count: 2, pierce: 2 })],
    [projectile("scissors-refined", ["craft", "blade"], 24, 0.74, { count: 2, pierce: 3 })],
    scissorsRoutes,
  ),
  weapon(
    "abacus",
    "漆木算盘",
    "漆木算盘",
    "连续弹出算珠；可改为急拨、长列贯穿或累计清账。",
    "#795348",
    ["ledger"],
    [projectile("abacus-base", ["ledger"], 9, 0.42, { pattern: "burst", count: 2 })],
    [projectile("abacus-refined", ["ledger"], 12, 0.34, { pattern: "burst", count: 3 })],
    abacusRoutes,
  ),
  weapon(
    "crossbow",
    "木臂连弩",
    "木臂连弩",
    "按固定节奏自动放箭；可改为齐射、架弩台或埋火延爆。",
    "#4f694e",
    ["mechanism"],
    [projectile("crossbow-base", ["mechanism"], 15, 0.65, { speed: 920 })],
    [projectile("crossbow-refined", ["mechanism"], 20, 0.55, { count: 2, speed: 980 })],
    crossbowRoutes,
  ),
  weapon(
    "pipa",
    "月牙琵琶",
    "月牙琵琶",
    "自动推出音浪；可改为十向推浪、跳弦连击或留下持续音场。",
    "#80709a",
    ["music"],
    [beam("pipa-base", ["music"], 20, { length: 290, width: 72, sweepDegrees: 24 })],
    [beam("pipa-refined", ["music"], 27, { length: 330, width: 92, sweepDegrees: 30 })],
    pipaRoutes,
  ),
  weapon(
    "inkline",
    "鲁班墨斗",
    "鲁班墨斗",
    "自动弹出直线墨绳；可改为长墨线、框格持续伤害或搭出木件。",
    "#3d4b48",
    ["craft", "mechanism"],
    [beam("inkline-base", ["craft"], 25, { length: 430, width: 14 })],
    [beam("inkline-refined", ["craft"], 34, { length: 520, width: 18 })],
    inklineRoutes,
  ),
  weapon(
    "lantern",
    "走马灯",
    "走马灯",
    "自动放出攻击影人；可改为更多影人、环身灯影或照样复制武器攻击。",
    "#bd6b3e",
    ["shadow", "fire"],
    [summon("lantern-base", ["shadow"], "lantern-shadow", { count: 1, duration: 8, attackDamage: 13 })],
    [summon("lantern-refined", ["shadow"], "lantern-shadow", { count: 2, duration: 10, attackDamage: 18 })],
    lanternRoutes,
  ),
  weapon(
    "thunderSeal",
    "五雷木令",
    "五雷木令",
    "自动预告落点后劈雷；可改为点雷、串雷或布下周期雷坛。",
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
