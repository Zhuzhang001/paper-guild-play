import { accumulator, beam, chain, lightning, orbit, projectile, summon, zone } from "./effects";
import type {
  FusionDefinition,
  FusionId,
  FusionMechanicDefinition,
  WeaponId,
} from "./types";

const FUSION_BLUEPRINTS = [
  {
    id: "mistCanopy",
    name: "风过伞骨",
    weapons: ["fan", "umbrella"],
    description: "扇风穿过伞面，把伞缘雨滴分成一圈移动雨针。",
    tags: ["wind", "rain", "guard"],
    effects: [
      zone("fusion-mist-canopy", ["wind", "rain"], 48, { radius: 180, duration: 6, followsOwner: true, slow: 0.3 }),
      projectile("fusion-mist-needles", ["wind", "rain"], 24, 0.5, { pattern: "radial", count: 12, homing: 0.35 }),
    ],
    weaveVerb: "风过伞骨",
    artKey: "fusion/mist-canopy",
    terminalArtKey: "terminal/mist-canopy",
  },
  {
    id: "thunderCanopy",
    name: "伞骨接雷",
    weapons: ["umbrella", "thunderSeal"],
    description: "八根伞骨依次接雷；合伞蓄住，开伞便按骨位落下。",
    tags: ["rain", "guard", "lightning", "spirit"],
    effects: [
      orbit("fusion-thunder-canopy", ["rain", "guard", "lightning"], 42, { count: 8, radius: 132, blockStrength: 1 }),
      lightning("fusion-thunder-canopy-strike", ["rain", "lightning"], 92, { strikes: 8, radius: 64, delay: 0.32 }),
    ],
    weaveVerb: "伞骨接雷",
    artKey: "fusion/thunder-canopy",
    terminalArtKey: "terminal/thunder-canopy",
  },
  {
    id: "inkGaleRule",
    name: "风走墨格",
    weapons: ["fan", "inkline"],
    description: "墨线为风量出边界，罡风沿界尺笔直推进。",
    tags: ["wind", "craft"],
    effects: [
      beam("fusion-ink-gale-rule", ["wind", "craft"], 86, { length: 920, width: 46, duration: 0.34 }),
      zone("fusion-ink-gale-boundary", ["wind", "craft"], 34, { radius: 150, duration: 5, slow: 0.26 }),
    ],
    weaveVerb: "风走墨格",
    artKey: "fusion/ink-gale-rule",
    terminalArtKey: "terminal/ink-gale-rule",
  },
  {
    id: "starPiercer",
    name: "剑标引箭",
    weapons: ["sword", "crossbow"],
    description: "竹剑先留标，后续弩矢顺着剑标排成一线。",
    tags: ["blade", "mechanism", "mark"],
    effects: [projectile("fusion-star-piercer", ["blade", "mechanism", "mark"], 96, 0.78, { count: 3, speed: 1200, pierce: 10, markSeconds: 5 })],
    weaveVerb: "剑标引箭",
    artKey: "fusion/star-piercer",
    terminalArtKey: "terminal/star-piercer",
  },
  {
    id: "lanternSword",
    name: "灯照剑路",
    weapons: ["sword", "lantern"],
    description: "灯中剑客轮番出画，踏着剑印冲过敌阵。",
    tags: ["blade", "shadow", "mark"],
    effects: [
      summon("fusion-lantern-sword", ["blade", "shadow"], "lantern-sword-riders", { count: 5, duration: 16, attackDamage: 48, attackCooldown: 0.44 }),
      chain("fusion-lantern-sword-mark", ["blade", "shadow", "mark"], 46, { jumps: 6, preferMarked: true }),
    ],
    weaveVerb: "灯照剑路",
    artKey: "fusion/lantern-sword",
    terminalArtKey: "terminal/lantern-sword",
  },
  {
    id: "swordheartPipa",
    name: "先弦后剑",
    weapons: ["sword", "pipa"],
    description: "剑气随弦音起落，远音标记、近剑收束。",
    tags: ["blade", "music", "mark"],
    effects: [
      beam("fusion-swordheart-pipa", ["blade", "music"], 72, { length: 620, width: 96, sweepDegrees: 46 }),
      chain("fusion-swordheart-echo", ["blade", "music", "mark"], 51, { jumps: 7, range: 260 }),
    ],
    weaveVerb: "先弦后剑",
    artKey: "fusion/swordheart-pipa",
    terminalArtKey: "terminal/swordheart-pipa",
  },
  {
    id: "heavenlyLedger",
    name: "量准再剪",
    weapons: ["scissors", "abacus"],
    description: "算盘先量准目标，满筹后剪刃沿最薄弱的一线合口。",
    tags: ["craft", "ledger", "execute"],
    effects: [
      projectile("fusion-heavenly-ledger-tally", ["craft", "ledger"], 30, 0.52, {
        pattern: "burst",
        count: 3,
        pierce: 2,
      }),
      accumulator("fusion-heavenly-ledger", ["craft", "ledger"], "heavenlyLedger", 12, [
        beam("fusion-heavenly-ledger-cut", ["craft", "ledger", "execute"], 142, { length: 760, width: 54 }),
      ]),
    ],
    weaveVerb: "量准再剪",
    artKey: "fusion/heavenly-ledger",
    terminalArtKey: "terminal/heavenly-ledger",
  },
  {
    id: "worldTailor",
    name: "墨框合剪",
    weapons: ["scissors", "inkline"],
    description: "墨斗织出纵横墨格，燕尾剪沿格线裁开整片战场。",
    tags: ["craft", "blade"],
    effects: [
      zone("fusion-world-tailor", ["craft", "blade"], 62, { radius: 210, duration: 7, tickRate: 0.18 }),
      beam("fusion-world-tailor-cut", ["craft", "blade"], 94, { trigger: "onHit", length: 820, width: 30 }),
    ],
    weaveVerb: "墨框合剪",
    artKey: "fusion/world-tailor",
    terminalArtKey: "terminal/world-tailor",
  },
  {
    id: "raincutCanopy",
    name: "伞挡剪雨",
    weapons: ["scissors", "umbrella"],
    description: "伞面挡住近敌，燕尾剪把伞缘雨滴裁成追踪刃。",
    tags: ["craft", "blade", "rain", "guard"],
    effects: [
      orbit("fusion-raincut-canopy", ["craft", "blade", "rain", "guard"], 44, { count: 6, radius: 146, blockStrength: 0.8 }),
      projectile("fusion-raincut-blades", ["craft", "blade", "rain"], 36, 0.62, { pattern: "radial", count: 8, homing: 0.72, pierce: 2 }),
    ],
    weaveVerb: "伞挡剪雨",
    artKey: "fusion/raincut-canopy",
    terminalArtKey: "terminal/raincut-canopy",
  },
  {
    id: "jadePearlCadence",
    name: "珠落成拍",
    weapons: ["abacus", "pipa"],
    description: "每粒算珠都是一个音符，落盘时奏成连环泛音。",
    tags: ["ledger", "music"],
    effects: [
      projectile("fusion-jade-pearl", ["ledger", "music"], 27, 0.24, { pattern: "burst", count: 5, homing: 0.35 }),
      chain("fusion-jade-pearl-echo", ["ledger", "music"], 38, { jumps: 8, range: 245, falloff: 0.95 }),
    ],
    weaveVerb: "珠落成拍",
    artKey: "fusion/jade-pearl-cadence",
    terminalArtKey: "terminal/jade-pearl-cadence",
  },
  {
    id: "linkedLedgerCase",
    name: "数珠装弩",
    weapons: ["abacus", "crossbow"],
    description: "算筹控制机括，命中越多，机匣齐射越密。",
    tags: ["ledger", "mechanism"],
    effects: [
      projectile("fusion-linked-ledger-feed", ["ledger", "mechanism"], 26, 0.36, {
        pattern: "burst",
        count: 3,
        speed: 980,
      }),
      accumulator("fusion-linked-ledger", ["ledger", "mechanism"], "linkedLedger", 8, [
        projectile("fusion-linked-ledger-volley", ["ledger", "mechanism"], 38, 0, { pattern: "fan", count: 12, spreadDegrees: 52, pierce: 3 }),
      ]),
    ],
    weaveVerb: "数珠装弩",
    artKey: "fusion/linked-ledger-case",
    terminalArtKey: "terminal/linked-ledger-case",
  },
  {
    id: "lanternBallista",
    name: "灯转弩台",
    weapons: ["crossbow", "lantern"],
    description: "走马灯每转一格便照出一座弩台，依次轮番开火。",
    tags: ["mechanism", "shadow", "fire"],
    effects: [
      summon("fusion-lantern-ballista", ["mechanism", "shadow"], "lantern-ballista-city", { count: 4, duration: 18, attackDamage: 43, attackCooldown: 0.36 }),
      projectile("fusion-lantern-ballista-fire", ["mechanism", "shadow", "fire"], 29, 0.52, { pattern: "fan", count: 5, pierce: 2 }),
    ],
    weaveVerb: "灯转弩台",
    artKey: "fusion/lantern-ballista",
    terminalArtKey: "terminal/lantern-ballista",
  },
  {
    id: "inklineRepeater",
    name: "线头架弩",
    weapons: ["crossbow", "inkline"],
    description: "墨线牵动连弩机括，在画出的准绳上自动布防。",
    tags: ["mechanism", "craft"],
    effects: [
      summon("fusion-inkline-repeater", ["mechanism", "craft"], "inkline-repeater", { count: 3, duration: 16, attackDamage: 36, attackCooldown: 0.32 }),
      beam("fusion-inkline-repeater-line", ["mechanism", "craft"], 58, { length: 760, width: 18, duration: 0.26 }),
    ],
    weaveVerb: "线头架弩",
    artKey: "fusion/inkline-repeater",
    terminalArtKey: "terminal/inkline-repeater",
  },
  {
    id: "thunderPipa",
    name: "弦尾落雷",
    weapons: ["pipa", "thunderSeal"],
    description: "四弦各应一方雷部，急拨时雷音滚遍敌阵。",
    tags: ["music", "lightning", "spirit"],
    effects: [
      chain("fusion-thunder-pipa", ["music", "lightning"], 64, { jumps: 10, range: 280, falloff: 0.96 }),
      lightning("fusion-thunder-pipa-cadence", ["music", "lightning", "spirit"], 118, { strikes: 4, radius: 82, delay: 0.28 }),
    ],
    weaveVerb: "弦尾落雷",
    artKey: "fusion/thunder-pipa",
    terminalArtKey: "terminal/thunder-pipa",
  },
  {
    id: "myriadLanternCanopy",
    name: "合伞藏灯",
    weapons: ["umbrella", "lantern"],
    description: "伞下映出万盏灯影，合拢护身、撑开则灯火奔涌。",
    tags: ["rain", "guard", "shadow", "fire"],
    effects: [
      orbit("fusion-myriad-lantern-canopy", ["rain", "guard", "shadow"], 39, { count: 10, radius: 154, blockStrength: 1 }),
      projectile("fusion-myriad-lantern-release", ["rain", "shadow", "fire"], 31, 0.56, { pattern: "radial", count: 16, homing: 0.5 }),
    ],
    weaveVerb: "合伞藏灯",
    artKey: "fusion/myriad-lantern-canopy",
    terminalArtKey: "terminal/myriad-lantern-canopy",
  },
  {
    id: "galeBamboo",
    name: "风送回剑",
    weapons: ["sword", "fan"],
    description: "折扇托住竹剑，使剑锋沿展开的风面折返穿行。",
    tags: ["blade", "wind", "mark"],
    effects: [
      projectile("fusion-gale-bamboo", ["blade", "wind", "mark"], 52, 0.58, {
        pattern: "fan",
        count: 5,
        spreadDegrees: 68,
        homing: 0.52,
        pierce: 4,
        markSeconds: 4,
      }),
    ],
    weaveVerb: "风送回剑",
    artKey: "fusion/gale-bamboo",
    terminalArtKey: "terminal/gale-bamboo",
  },
  {
    id: "hiddenSwordCanopy",
    name: "开伞收剑",
    weapons: ["sword", "umbrella"],
    description: "剑藏伞骨，格挡后沿八瓣伞缘依次出锋。",
    tags: ["blade", "rain", "guard"],
    effects: [
      orbit("fusion-hidden-sword-canopy", ["blade", "rain", "guard"], 39, {
        count: 8,
        radius: 128,
        blockStrength: 1,
      }),
      projectile("fusion-hidden-sword-release", ["blade", "rain"], 44, 0.72, {
        pattern: "radial",
        count: 8,
        pierce: 3,
      }),
    ],
    weaveVerb: "开伞收剑",
    artKey: "fusion/hidden-sword-canopy",
    terminalArtKey: "terminal/hidden-sword-canopy",
  },
  {
    id: "twinTailorBlades",
    name: "双刃合口",
    weapons: ["sword", "scissors"],
    description: "竹剑定中线，燕尾剪沿两侧合拢，裁出交叉锋口。",
    tags: ["blade", "craft", "execute"],
    effects: [
      beam("fusion-twin-tailor-blades", ["blade", "craft"], 92, {
        length: 660,
        width: 38,
        sweepDegrees: 62,
      }),
    ],
    weaveVerb: "双刃合口",
    artKey: "fusion/twin-tailor-blades",
    terminalArtKey: "terminal/twin-tailor-blades",
  },
  {
    id: "windStringPass",
    name: "扇过三弦",
    weapons: ["fan", "pipa"],
    description: "扇风依次扫过三根弦，先推出风面，再让末音在敌群间折返。",
    tags: ["wind", "music"],
    effects: [
      projectile("fusion-wind-string-pass", ["wind", "music"], 32, 0.54, {
        pattern: "fan",
        count: 6,
        spreadDegrees: 78,
        pierce: 3,
      }),
      chain("fusion-wind-string-echo", ["wind", "music"], 46, {
        trigger: "onHit",
        jumps: 6,
        range: 250,
        falloff: 0.94,
      }),
    ],
    weaveVerb: "扇过三弦",
    artKey: "fusion/wind-string-pass",
    terminalArtKey: "terminal/wind-string-pass",
  },
  {
    id: "inkRuleSword",
    name: "剑拖墨线",
    weapons: ["sword", "inkline"],
    description: "墨绳弹出准线，竹剑只沿准线往返，锋路笔直可读。",
    tags: ["blade", "craft", "mark"],
    effects: [
      beam("fusion-ink-rule-sword", ["blade", "craft", "mark"], 104, {
        length: 980,
        width: 26,
        duration: 0.32,
        pierce: 12,
      }),
    ],
    weaveVerb: "剑拖墨线",
    artKey: "fusion/ink-rule-sword",
    terminalArtKey: "terminal/ink-rule-sword",
  },
  {
    id: "inkRainBoundary",
    name: "墨雨封边",
    weapons: ["umbrella", "inkline"],
    description: "墨线先围出边框，伞雨落到边线上便沿框分流，封住越界敌人。",
    tags: ["rain", "guard", "craft"],
    effects: [
      zone("fusion-ink-rain-boundary", ["rain", "craft"], 48, {
        radius: 178,
        duration: 6,
        tickRate: 0.22,
        followsOwner: true,
        slow: 0.28,
      }),
      orbit("fusion-ink-rain-edge", ["rain", "guard", "craft"], 34, {
        count: 8,
        radius: 178,
        blockStrength: 0.8,
      }),
    ],
    weaveVerb: "墨雨封边",
    artKey: "fusion/ink-rain-boundary",
    terminalArtKey: "terminal/ink-rain-boundary",
  },
  {
    id: "windRepeater",
    name: "顺风排弩",
    weapons: ["fan", "crossbow"],
    description: "扇风替机弦复位，弩机按三短一长的节拍连续放矢。",
    tags: ["wind", "mechanism"],
    effects: [
      projectile("fusion-wind-repeater", ["wind", "mechanism"], 28, 0.32, {
        pattern: "burst",
        count: 6,
        speed: 1080,
        pierce: 2,
      }),
    ],
    weaveVerb: "顺风排弩",
    artKey: "fusion/wind-repeater",
    terminalArtKey: "terminal/wind-repeater",
  },
  {
    id: "stringScissor",
    name: "弦过剪口",
    weapons: ["scissors", "pipa"],
    description: "弦音穿过开合剪口，被裁成两道相反方向的窄音锋。",
    tags: ["craft", "blade", "music"],
    effects: [
      beam("fusion-string-scissor", ["craft", "blade", "music"], 84, {
        length: 650,
        width: 46,
        sweepDegrees: 58,
      }),
      chain("fusion-string-scissor-echo", ["blade", "music"], 42, {
        trigger: "onHit",
        jumps: 5,
        range: 230,
      }),
    ],
    weaveVerb: "弦过剪口",
    artKey: "fusion/string-scissor",
    terminalArtKey: "terminal/string-scissor",
  },
  {
    id: "shadowScissor",
    name: "剪影伤身",
    weapons: ["scissors", "lantern"],
    description: "剪刃先裁灯影，影口随后贴回目标本体，再合一次。",
    tags: ["craft", "blade", "shadow"],
    effects: [
      summon("fusion-shadow-scissor", ["craft", "blade", "shadow"], "shadow-scissor", {
        count: 3,
        duration: 14,
        attackDamage: 40,
        attackCooldown: 0.48,
        moveSpeed: 190,
      }),
      beam("fusion-shadow-scissor-close", ["blade", "shadow"], 64, {
        trigger: "onHit",
        length: 430,
        width: 38,
      }),
    ],
    weaveVerb: "剪影伤身",
    artKey: "fusion/shadow-scissor",
    terminalArtKey: "terminal/shadow-scissor",
  },
  {
    id: "pearlInkLine",
    name: "珠走墨线",
    weapons: ["abacus", "inkline"],
    description: "墨斗弹出直线，算珠依次沿线滚过，同一目标按珠序结算。",
    tags: ["ledger", "craft"],
    effects: [
      beam("fusion-pearl-ink-line", ["ledger", "craft"], 58, {
        length: 820,
        width: 24,
        duration: 0.3,
      }),
      projectile("fusion-pearl-ink-beads", ["ledger", "craft"], 24, 0.34, {
        pattern: "burst",
        count: 6,
        pierce: 5,
      }),
    ],
    weaveVerb: "珠走墨线",
    artKey: "fusion/pearl-ink-line",
    terminalArtKey: "terminal/pearl-ink-line",
  },
  {
    id: "countedLantern",
    name: "数满一灯",
    weapons: ["abacus", "lantern"],
    description: "算珠逐格点亮走马灯，数满一轮便放出一队记账影人。",
    tags: ["ledger", "shadow", "fire"],
    effects: [
      projectile("fusion-counted-lantern-beads", ["ledger", "shadow"], 24, 0.38, {
        pattern: "burst",
        count: 4,
        homing: 0.28,
      }),
      accumulator("fusion-counted-lantern", ["ledger", "shadow"], "countedLantern", 8, [
        summon("fusion-counted-lantern-release", ["ledger", "shadow"], "ledger-lantern-men", {
          count: 4,
          duration: 10,
          attackDamage: 38,
          attackCooldown: 0.5,
        }),
      ]),
    ],
    weaveVerb: "数满一灯",
    artKey: "fusion/counted-lantern",
    terminalArtKey: "terminal/counted-lantern",
  },
  {
    id: "pearlThunder",
    name: "数珠落雷",
    weapons: ["abacus", "thunderSeal"],
    description: "每粒算珠记下一个落点，末珠命中后按记录顺序落雷。",
    tags: ["ledger", "lightning", "spirit"],
    effects: [
      projectile("fusion-pearl-thunder-beads", ["ledger", "lightning"], 26, 0.4, {
        pattern: "burst",
        count: 5,
        homing: 0.35,
      }),
      lightning("fusion-pearl-thunder-strike", ["ledger", "lightning"], 86, {
        trigger: "onHit",
        strikes: 3,
        radius: 60,
        delay: 0.28,
        chainRange: 190,
      }),
    ],
    weaveVerb: "数珠落雷",
    artKey: "fusion/pearl-thunder",
    terminalArtKey: "terminal/pearl-thunder",
  },
  {
    id: "rainStringCanopy",
    name: "雨敲伞骨",
    weapons: ["umbrella", "pipa"],
    description: "雨点敲伞成拍，琵琶只在空拍拨弦，余音绕伞檐回旋。",
    tags: ["rain", "guard", "music"],
    effects: [
      zone("fusion-rain-string-canopy", ["rain", "music"], 46, {
        radius: 172,
        duration: 6,
        tickRate: 0.24,
        followsOwner: true,
        slow: 0.22,
      }),
      chain("fusion-rain-string-echo", ["rain", "music"], 48, {
        jumps: 7,
        range: 250,
        falloff: 0.95,
      }),
    ],
    weaveVerb: "雨敲伞骨",
    artKey: "fusion/rain-string-canopy",
    terminalArtKey: "terminal/rain-string-canopy",
  },
  {
    id: "thunderBoltRoad",
    name: "雷钉接路",
    weapons: ["crossbow", "thunderSeal"],
    description: "弩矢把雷钉进地面，后续落雷只沿相邻雷钉接续。",
    tags: ["mechanism", "lightning", "mark"],
    effects: [
      projectile("fusion-thunder-bolt-road", ["mechanism", "lightning", "mark"], 42, 0.48, {
        pattern: "fan",
        count: 4,
        spreadDegrees: 34,
        pierce: 3,
        markSeconds: 4,
      }),
      lightning("fusion-thunder-bolt-road-chain", ["mechanism", "lightning"], 82, {
        trigger: "onMarkedHit",
        strikes: 4,
        radius: 58,
        delay: 0.26,
        chainRange: 175,
      }),
    ],
    weaveVerb: "雷钉接路",
    artKey: "fusion/thunder-bolt-road",
    terminalArtKey: "terminal/thunder-bolt-road",
  },
  {
    id: "inkScore",
    name: "墨线记谱",
    weapons: ["pipa", "inkline"],
    description: "墨线记下每次拨弦的位置，下一段泛音沿谱线逐点重放。",
    tags: ["music", "craft", "mark"],
    effects: [
      beam("fusion-ink-score", ["music", "craft", "mark"], 66, {
        length: 780,
        width: 26,
        duration: 0.34,
        sweepDegrees: 24,
      }),
      chain("fusion-ink-score-replay", ["music", "craft", "mark"], 49, {
        trigger: "onHit",
        jumps: 8,
        range: 245,
        falloff: 0.96,
        preferMarked: true,
      }),
    ],
    weaveVerb: "墨线记谱",
    artKey: "fusion/ink-score",
    terminalArtKey: "terminal/ink-score",
  },
] as const satisfies readonly Omit<
  FusionDefinition,
  "pairLabel" | "canonicalName" | "action" | "mechanic"
>[];

const WEAPON_PAIR_NAME: Readonly<Record<WeaponId, string>> = {
  sword: "剑",
  fan: "扇",
  umbrella: "伞",
  scissors: "剪",
  abacus: "算盘",
  crossbow: "连弩",
  pipa: "琵琶",
  inkline: "墨斗",
  lantern: "走马灯",
  thunderSeal: "五雷令",
};

function canonicalPairLabel(pair: readonly [WeaponId, WeaponId]): string {
  return pair
    .map((weaponId) => WEAPON_PAIR_NAME[weaponId])
    .join(" × ");
}

function deriveMechanic(
  definition: (typeof FUSION_BLUEPRINTS)[number],
): FusionMechanicDefinition {
  const accumulatorEffect = definition.effects.find(
    (effect) => effect.kind === "accumulator",
  );
  return {
    event: (definition.tags as readonly string[]).includes("guard")
      ? "block"
      : definition.effects.some((effect) => effect.trigger === "onHit")
        ? "hit"
        : "attack",
    cadence:
      accumulatorEffect?.kind === "accumulator"
        ? accumulatorEffect.required
        : 1,
    action: definition.weaveVerb,
  };
}

export const FUSION_DEFINITIONS: readonly FusionDefinition[] =
  FUSION_BLUEPRINTS.map((definition) => {
    const pairLabel = canonicalPairLabel(definition.weapons);
    const action = definition.weaveVerb;
    return {
      ...definition,
      pairLabel,
      canonicalName: `${pairLabel}｜${action}`,
      action,
      mechanic: deriveMechanic(definition),
    };
  });

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
