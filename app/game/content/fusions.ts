import { accumulator, beam, chain, lightning, orbit, projectile, summon, zone } from "./effects";
import type { FusionDefinition, FusionId, WeaponId } from "./types";

export const FUSION_DEFINITIONS = [
  {
    id: "mistCanopy",
    name: "烟雨天罗",
    weapons: ["fan", "umbrella"],
    description: "折扇化风、纸伞化雨，织成会移动的烟雨天罗。",
    tags: ["wind", "rain", "guard"],
    effects: [
      zone("fusion-mist-canopy", ["wind", "rain"], 48, { radius: 180, duration: 6, followsOwner: true, slow: 0.3 }),
      projectile("fusion-mist-needles", ["wind", "rain"], 24, 0.5, { pattern: "radial", count: 12, homing: 0.35 }),
    ],
    weaveVerb: "散作烟雨",
    artKey: "fusion/mist-canopy",
    terminalArtKey: "terminal/mist-canopy",
  },
  {
    id: "thunderCanopy",
    name: "八景雷伞",
    weapons: ["umbrella", "thunderSeal"],
    description: "八根伞骨各镇一方雷景，开合时敕下群霆。",
    tags: ["rain", "guard", "lightning", "spirit"],
    effects: [
      orbit("fusion-thunder-canopy", ["rain", "guard", "lightning"], 42, { count: 8, radius: 132, blockStrength: 1 }),
      lightning("fusion-thunder-canopy-strike", ["rain", "lightning"], 92, { strikes: 8, radius: 64, delay: 0.32 }),
    ],
    weaveVerb: "承霆化雨",
    artKey: "fusion/thunder-canopy",
    terminalArtKey: "terminal/thunder-canopy",
  },
  {
    id: "inkGaleRule",
    name: "墨风界尺",
    weapons: ["fan", "inkline"],
    description: "墨线为风量出边界，罡风沿界尺笔直推进。",
    tags: ["wind", "craft"],
    effects: [
      beam("fusion-ink-gale-rule", ["wind", "craft"], 86, { length: 920, width: 46, duration: 0.34 }),
      zone("fusion-ink-gale-boundary", ["wind", "craft"], 34, { radius: 150, duration: 5, slow: 0.26 }),
    ],
    weaveVerb: "界风定矩",
    artKey: "fusion/ink-gale-rule",
    terminalArtKey: "terminal/ink-gale-rule",
  },
  {
    id: "starPiercer",
    name: "贯星剑弩",
    weapons: ["sword", "crossbow"],
    description: "竹剑充作弩臂，发出贯星般的标记剑矢。",
    tags: ["blade", "mechanism", "mark"],
    effects: [projectile("fusion-star-piercer", ["blade", "mechanism", "mark"], 96, 0.78, { count: 3, speed: 1200, pierce: 10, markSeconds: 5 })],
    weaveVerb: "贯星留印",
    artKey: "fusion/star-piercer",
    terminalArtKey: "terminal/star-piercer",
  },
  {
    id: "lanternSword",
    name: "走马剑影",
    weapons: ["sword", "lantern"],
    description: "灯中剑客轮番出画，踏着剑印冲过敌阵。",
    tags: ["blade", "shadow", "mark"],
    effects: [
      summon("fusion-lantern-sword", ["blade", "shadow"], "lantern-sword-riders", { count: 5, duration: 16, attackDamage: 48, attackCooldown: 0.44 }),
      chain("fusion-lantern-sword-mark", ["blade", "shadow", "mark"], 46, { jumps: 6, preferMarked: true }),
    ],
    weaveVerb: "照影成剑",
    artKey: "fusion/lantern-sword",
    terminalArtKey: "terminal/lantern-sword",
  },
  {
    id: "swordheartPipa",
    name: "剑胆琴心",
    weapons: ["sword", "pipa"],
    description: "剑气随弦音起落，远音标记、近剑收束。",
    tags: ["blade", "music", "mark"],
    effects: [
      beam("fusion-swordheart-pipa", ["blade", "music"], 72, { length: 620, width: 96, sweepDegrees: 46 }),
      chain("fusion-swordheart-echo", ["blade", "music", "mark"], 51, { jumps: 7, range: 260 }),
    ],
    weaveVerb: "以弦行剑",
    artKey: "fusion/swordheart-pipa",
    terminalArtKey: "terminal/swordheart-pipa",
  },
  {
    id: "heavenlyLedger",
    name: "天工算剪",
    weapons: ["scissors", "abacus"],
    description: "算盘量命，裁剪结账，专断敌阵最薄弱的一线。",
    tags: ["craft", "ledger", "execute"],
    effects: [
      accumulator("fusion-heavenly-ledger", ["craft", "ledger"], "heavenlyLedger", 12, [
        beam("fusion-heavenly-ledger-cut", ["craft", "ledger", "execute"], 142, { length: 760, width: 54 }),
      ]),
    ],
    weaveVerb: "量命清账",
    artKey: "fusion/heavenly-ledger",
    terminalArtKey: "terminal/heavenly-ledger",
  },
  {
    id: "worldTailor",
    name: "经纬裁天",
    weapons: ["scissors", "inkline"],
    description: "墨斗织出经纬，燕尾剪沿网格裁开整片战场。",
    tags: ["craft", "blade"],
    effects: [
      zone("fusion-world-tailor", ["craft", "blade"], 62, { radius: 210, duration: 7, tickRate: 0.18 }),
      beam("fusion-world-tailor-cut", ["craft", "blade"], 94, { trigger: "onHit", length: 820, width: 30 }),
    ],
    weaveVerb: "裁界分野",
    artKey: "fusion/world-tailor",
    terminalArtKey: "terminal/world-tailor",
  },
  {
    id: "raincutCanopy",
    name: "剪雨华盖",
    weapons: ["scissors", "umbrella"],
    description: "伞面旋作华盖，燕尾剪将檐雨裁成追踪刃。",
    tags: ["craft", "blade", "rain", "guard"],
    effects: [
      orbit("fusion-raincut-canopy", ["craft", "blade", "rain", "guard"], 44, { count: 6, radius: 146, blockStrength: 0.8 }),
      projectile("fusion-raincut-blades", ["craft", "blade", "rain"], 36, 0.62, { pattern: "radial", count: 8, homing: 0.72, pierce: 2 }),
    ],
    weaveVerb: "裁雨护身",
    artKey: "fusion/raincut-canopy",
    terminalArtKey: "terminal/raincut-canopy",
  },
  {
    id: "jadePearlCadence",
    name: "珠落玉盘",
    weapons: ["abacus", "pipa"],
    description: "每粒算珠都是一个音符，落盘时奏成连环泛音。",
    tags: ["ledger", "music"],
    effects: [
      projectile("fusion-jade-pearl", ["ledger", "music"], 27, 0.24, { pattern: "burst", count: 5, homing: 0.35 }),
      chain("fusion-jade-pearl-echo", ["ledger", "music"], 38, { jumps: 8, range: 245, falloff: 0.95 }),
    ],
    weaveVerb: "拨珠成曲",
    artKey: "fusion/jade-pearl-cadence",
    terminalArtKey: "terminal/jade-pearl-cadence",
  },
  {
    id: "linkedLedgerCase",
    name: "连筹机匣",
    weapons: ["abacus", "crossbow"],
    description: "算筹控制机括，命中越多，机匣齐射越密。",
    tags: ["ledger", "mechanism"],
    effects: [
      accumulator("fusion-linked-ledger", ["ledger", "mechanism"], "linkedLedger", 8, [
        projectile("fusion-linked-ledger-volley", ["ledger", "mechanism"], 38, 0, { pattern: "fan", count: 12, spreadDegrees: 52, pierce: 3 }),
      ]),
    ],
    weaveVerb: "筹满连发",
    artKey: "fusion/linked-ledger-case",
    terminalArtKey: "terminal/linked-ledger-case",
  },
  {
    id: "lanternBallista",
    name: "走马弩城",
    weapons: ["crossbow", "lantern"],
    description: "走马灯轮转出一座影弩城，弩台随灯影轮番开火。",
    tags: ["mechanism", "shadow", "fire"],
    effects: [
      summon("fusion-lantern-ballista", ["mechanism", "shadow"], "lantern-ballista-city", { count: 4, duration: 18, attackDamage: 43, attackCooldown: 0.36 }),
      projectile("fusion-lantern-ballista-fire", ["mechanism", "shadow", "fire"], 29, 0.52, { pattern: "fan", count: 5, pierce: 2 }),
    ],
    weaveVerb: "列城放矢",
    artKey: "fusion/lantern-ballista",
    terminalArtKey: "terminal/lantern-ballista",
  },
  {
    id: "inklineRepeater",
    name: "墨斗连机",
    weapons: ["crossbow", "inkline"],
    description: "墨线牵动连弩机括，在画出的准绳上自动布防。",
    tags: ["mechanism", "craft"],
    effects: [
      summon("fusion-inkline-repeater", ["mechanism", "craft"], "inkline-repeater", { count: 3, duration: 16, attackDamage: 36, attackCooldown: 0.32 }),
      beam("fusion-inkline-repeater-line", ["mechanism", "craft"], 58, { length: 760, width: 18, duration: 0.26 }),
    ],
    weaveVerb: "循墨布机",
    artKey: "fusion/inkline-repeater",
    terminalArtKey: "terminal/inkline-repeater",
  },
  {
    id: "thunderPipa",
    name: "雷音琵琶",
    weapons: ["pipa", "thunderSeal"],
    description: "四弦各应一方雷部，急拨时雷音滚遍敌阵。",
    tags: ["music", "lightning", "spirit"],
    effects: [
      chain("fusion-thunder-pipa", ["music", "lightning"], 64, { jumps: 10, range: 280, falloff: 0.96 }),
      lightning("fusion-thunder-pipa-cadence", ["music", "lightning", "spirit"], 118, { strikes: 4, radius: 82, delay: 0.28 }),
    ],
    weaveVerb: "拨弦敕雷",
    artKey: "fusion/thunder-pipa",
    terminalArtKey: "terminal/thunder-pipa",
  },
  {
    id: "myriadLanternCanopy",
    name: "万灯宝伞",
    weapons: ["umbrella", "lantern"],
    description: "伞下映出万盏灯影，合拢护身、撑开则灯火奔涌。",
    tags: ["rain", "guard", "shadow", "fire"],
    effects: [
      orbit("fusion-myriad-lantern-canopy", ["rain", "guard", "shadow"], 39, { count: 10, radius: 154, blockStrength: 1 }),
      projectile("fusion-myriad-lantern-release", ["rain", "shadow", "fire"], 31, 0.56, { pattern: "radial", count: 16, homing: 0.5 }),
    ],
    weaveVerb: "张伞放灯",
    artKey: "fusion/myriad-lantern-canopy",
    terminalArtKey: "terminal/myriad-lantern-canopy",
  },
] as const satisfies readonly FusionDefinition[];

export const FUSIONS_BY_ID: Readonly<Record<FusionId, FusionDefinition>> = Object.freeze(
  Object.fromEntries(FUSION_DEFINITIONS.map((definition) => [definition.id, definition])) as unknown as Record<
    FusionId,
    FusionDefinition
  >,
);

function pairKey(first: WeaponId, second: WeaponId): string {
  return [first, second].sort().join("+");
}

const FUSIONS_BY_PAIR = new Map(
  FUSION_DEFINITIONS.map((definition) => [
    pairKey(definition.weapons[0], definition.weapons[1]),
    definition,
  ]),
);

export function getFusionDefinition(id: FusionId): FusionDefinition {
  return FUSIONS_BY_ID[id];
}

export function findFusionDefinition(
  first: WeaponId,
  second: WeaponId,
): FusionDefinition | undefined {
  return FUSIONS_BY_PAIR.get(pairKey(first, second));
}
