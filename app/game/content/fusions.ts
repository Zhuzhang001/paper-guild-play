import { accumulator, beam, chain, lightning, orbit, projectile, summon, zone } from "./effects";
import type {
  FusionDefinition,
  FusionId,
  FusionMechanicDefinition,
  FusionWeavePatch,
  TerminalFamily,
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
  {
    id: "countedSword",
    name: "数珠定剑",
    weapons: ["sword", "abacus"],
    description: "算珠给目标逐笔记数，满五珠时竹剑沿原路回收这笔账。",
    tags: ["blade", "ledger", "mark"],
    effects: [
      projectile("fusion-counted-sword-beads", ["ledger", "mark"], 28, 0.38, {
        pattern: "burst",
        count: 5,
        pierce: 2,
        markSeconds: 4,
      }),
      accumulator("fusion-counted-sword-return", ["blade", "ledger", "mark"], "countedSword", 5, [
        projectile("fusion-counted-sword-cut", ["blade", "ledger", "mark"], 96, 0, {
          pattern: "burst",
          count: 3,
          speed: 1120,
          pierce: 8,
          homing: 0.42,
        }),
      ]),
    ],
    weaveVerb: "数珠定剑",
    artKey: "fusion/counted-sword",
    terminalArtKey: "terminal/counted-sword",
  },
  {
    id: "markedThunderSword",
    name: "剑印落雷",
    weapons: ["sword", "thunderSeal"],
    description: "竹剑钉下窄长剑印，第三次击中剑印时沿印位落雷。",
    tags: ["blade", "lightning", "spirit", "mark"],
    effects: [
      projectile("fusion-marked-thunder-sword", ["blade", "lightning", "mark"], 54, 0.52, {
        count: 2,
        speed: 1040,
        pierce: 5,
        markSeconds: 5,
      }),
      lightning("fusion-marked-thunder-sword-strike", ["blade", "lightning", "spirit"], 104, {
        trigger: "onMarkedHit",
        strikes: 3,
        radius: 62,
        delay: 0.24,
        chainRange: 180,
      }),
    ],
    weaveVerb: "剑印落雷",
    artKey: "fusion/marked-thunder-sword",
    terminalArtKey: "terminal/marked-thunder-sword",
  },
  {
    id: "windScissors",
    name: "风送双剪",
    weapons: ["fan", "scissors"],
    description: "扇风把两片剪刃分送两侧，风势一收便沿原路交叉回剪。",
    tags: ["wind", "craft", "blade"],
    effects: [
      projectile("fusion-wind-scissors", ["wind", "craft", "blade"], 44, 0.54, {
        pattern: "fan",
        count: 2,
        spreadDegrees: 74,
        pierce: 5,
        homing: 0.28,
      }),
      beam("fusion-wind-scissors-return", ["wind", "craft", "blade"], 82, {
        trigger: "onHit",
        length: 620,
        width: 42,
        sweepDegrees: 58,
      }),
    ],
    weaveVerb: "风送双剪",
    artKey: "fusion/wind-scissors",
    terminalArtKey: "terminal/wind-scissors",
  },
  {
    id: "windAbacus",
    name: "风拨算珠",
    weapons: ["fan", "abacus"],
    description: "风面拨开整排算珠，珠列在风缘折向并按落点重新分流。",
    tags: ["wind", "ledger"],
    effects: [
      projectile("fusion-wind-abacus", ["wind", "ledger"], 25, 0.34, {
        pattern: "fan",
        count: 9,
        spreadDegrees: 86,
        pierce: 3,
        homing: 0.24,
      }),
      chain("fusion-wind-abacus-recount", ["wind", "ledger"], 42, {
        trigger: "onHit",
        jumps: 6,
        range: 230,
        falloff: 0.94,
      }),
    ],
    weaveVerb: "风拨算珠",
    artKey: "fusion/wind-abacus",
    terminalArtKey: "terminal/wind-abacus",
  },
  {
    id: "windLantern",
    name: "风转灯影",
    weapons: ["fan", "lantern"],
    description: "风推动灯格轮转，每转过一面便错时放出一名追敌影人。",
    tags: ["wind", "shadow", "fire"],
    effects: [
      summon("fusion-wind-lantern", ["wind", "shadow"], "wind-lantern-shadows", {
        count: 4,
        duration: 14,
        attackDamage: 38,
        attackCooldown: 0.58,
        moveSpeed: 220,
      }),
      projectile("fusion-wind-lantern-flare", ["wind", "shadow", "fire"], 31, 0.62, {
        pattern: "radial",
        count: 8,
        homing: 0.5,
      }),
    ],
    weaveVerb: "风转灯影",
    artKey: "fusion/wind-lantern",
    terminalArtKey: "terminal/wind-lantern",
  },
  {
    id: "windThunder",
    name: "风停落雷",
    weapons: ["fan", "thunderSeal"],
    description: "扇风把雷意推到风缘，风面停住时雷沿最后的边线落下。",
    tags: ["wind", "lightning", "spirit"],
    effects: [
      zone("fusion-wind-thunder", ["wind", "lightning"], 38, {
        radius: 188,
        duration: 5,
        tickRate: 0.26,
        slow: 0.2,
      }),
      lightning("fusion-wind-thunder-edge", ["wind", "lightning", "spirit"], 88, {
        trigger: "onHit",
        strikes: 5,
        radius: 58,
        delay: 0.3,
        chainRange: 210,
      }),
    ],
    weaveVerb: "风停落雷",
    artKey: "fusion/wind-thunder",
    terminalArtKey: "terminal/wind-thunder",
  },
  {
    id: "beadCanopy",
    name: "珠敲伞骨",
    weapons: ["umbrella", "abacus"],
    description: "算珠逐根敲过八瓣伞骨，敲满一圈后从伞缘反弹出去。",
    tags: ["rain", "guard", "ledger"],
    effects: [
      orbit("fusion-bead-canopy", ["rain", "guard", "ledger"], 34, {
        count: 8,
        radius: 138,
        blockStrength: 0.75,
      }),
      projectile("fusion-bead-canopy-rebound", ["rain", "ledger"], 29, 0.56, {
        pattern: "radial",
        count: 8,
        pierce: 3,
        homing: 0.3,
      }),
    ],
    weaveVerb: "珠敲伞骨",
    artKey: "fusion/bead-canopy",
    terminalArtKey: "terminal/bead-canopy",
  },
  {
    id: "canopyVolley",
    name: "伞开排弩",
    weapons: ["umbrella", "crossbow"],
    description: "伞面挡击时替排弩装填，下一次开伞把弩矢沿八骨齐放。",
    tags: ["rain", "guard", "mechanism"],
    effects: [
      orbit("fusion-canopy-volley-guard", ["rain", "guard", "mechanism"], 32, {
        count: 8,
        radius: 142,
        blockStrength: 0.9,
      }),
      projectile("fusion-canopy-volley", ["rain", "mechanism"], 35, 0.66, {
        pattern: "radial",
        count: 8,
        speed: 1040,
        pierce: 4,
      }),
    ],
    weaveVerb: "伞开排弩",
    artKey: "fusion/canopy-volley",
    terminalArtKey: "terminal/canopy-volley",
  },
  {
    id: "boltScissors",
    name: "弩钉引剪",
    weapons: ["scissors", "crossbow"],
    description: "两枚弩钉先定住端点，燕尾剪随后沿两点之间合口。",
    tags: ["craft", "blade", "mechanism", "mark"],
    effects: [
      projectile("fusion-bolt-scissors-pins", ["mechanism", "mark"], 34, 0.5, {
        pattern: "fan",
        count: 2,
        spreadDegrees: 42,
        speed: 1080,
        pierce: 4,
        markSeconds: 5,
      }),
      beam("fusion-bolt-scissors-close", ["craft", "blade", "mechanism", "mark"], 102, {
        trigger: "onMarkedHit",
        length: 720,
        width: 44,
        sweepDegrees: 42,
      }),
    ],
    weaveVerb: "弩钉引剪",
    artKey: "fusion/bolt-scissors",
    terminalArtKey: "terminal/bolt-scissors",
  },
  {
    id: "thunderScissors",
    name: "雷过剪口",
    weapons: ["scissors", "thunderSeal"],
    description: "双剪分作两极，雷从张开的剪口穿过并在合口时截断。",
    tags: ["craft", "blade", "lightning", "spirit"],
    effects: [
      orbit("fusion-thunder-scissors", ["craft", "blade", "lightning"], 46, {
        count: 2,
        radius: 126,
        angularSpeed: 2.6,
      }),
      lightning("fusion-thunder-scissors-arc", ["blade", "lightning", "spirit"], 96, {
        strikes: 2,
        radius: 72,
        delay: 0.26,
        chainRange: 230,
      }),
    ],
    weaveVerb: "雷过剪口",
    artKey: "fusion/thunder-scissors",
    terminalArtKey: "terminal/thunder-scissors",
  },
  {
    id: "stringCrossbow",
    name: "弦引弩箭",
    weapons: ["crossbow", "pipa"],
    description: "琵琶按三拍牵动弩机，前两拍列箭，末拍把余箭折返。",
    tags: ["mechanism", "music"],
    effects: [
      projectile("fusion-string-crossbow", ["mechanism", "music"], 31, 0.36, {
        pattern: "burst",
        count: 6,
        speed: 1060,
        pierce: 3,
      }),
      chain("fusion-string-crossbow-return", ["mechanism", "music"], 48, {
        trigger: "onHit",
        jumps: 7,
        range: 255,
        falloff: 0.95,
      }),
    ],
    weaveVerb: "弦引弩箭",
    artKey: "fusion/string-crossbow",
    terminalArtKey: "terminal/string-crossbow",
  },
  {
    id: "lanternStrings",
    name: "灯影和弦",
    weapons: ["pipa", "lantern"],
    description: "每面灯格记下一道弦音，影人按灯格次序错时复奏。",
    tags: ["music", "shadow", "fire"],
    effects: [
      summon("fusion-lantern-strings", ["music", "shadow"], "lantern-string-players", {
        count: 4,
        duration: 15,
        attackDamage: 34,
        attackCooldown: 0.64,
        moveSpeed: 200,
      }),
      chain("fusion-lantern-strings-echo", ["music", "shadow"], 44, {
        trigger: "onHit",
        jumps: 6,
        range: 245,
        falloff: 0.96,
      }),
    ],
    weaveVerb: "灯影和弦",
    artKey: "fusion/lantern-strings",
    terminalArtKey: "terminal/lantern-strings",
  },
  {
    id: "inkShadow",
    name: "墨线牵影",
    weapons: ["inkline", "lantern"],
    description: "墨线给影人分出巡路，影人各守一段并在交点换路。",
    tags: ["craft", "mechanism", "shadow"],
    effects: [
      beam("fusion-ink-shadow-line", ["craft", "mechanism", "shadow"], 58, {
        length: 820,
        width: 24,
        duration: 0.34,
      }),
      summon("fusion-ink-shadow", ["craft", "shadow"], "inkline-shadow-patrol", {
        count: 4,
        duration: 16,
        attackDamage: 36,
        attackCooldown: 0.58,
        moveSpeed: 205,
      }),
    ],
    weaveVerb: "墨线牵影",
    artKey: "fusion/ink-shadow",
    terminalArtKey: "terminal/ink-shadow",
  },
  {
    id: "inkThunderRoad",
    name: "雷走墨线",
    weapons: ["inkline", "thunderSeal"],
    description: "墨斗先弹出导雷直线，落雷只沿线位逐段接续。",
    tags: ["craft", "mechanism", "lightning", "spirit"],
    effects: [
      beam("fusion-ink-thunder-road", ["craft", "mechanism", "lightning"], 68, {
        length: 900,
        width: 26,
        duration: 0.36,
        pierce: 12,
      }),
      lightning("fusion-ink-thunder-road-strike", ["craft", "lightning", "spirit"], 92, {
        trigger: "onHit",
        strikes: 5,
        radius: 54,
        delay: 0.24,
        chainRange: 170,
      }),
    ],
    weaveVerb: "雷走墨线",
    artKey: "fusion/ink-thunder-road",
    terminalArtKey: "terminal/ink-thunder-road",
  },
  {
    id: "lanternThunder",
    name: "灯亮雷落",
    weapons: ["lantern", "thunderSeal"],
    description: "灯格依次存下一道雷，四面全亮后按亮灯顺序落下。",
    tags: ["shadow", "fire", "lightning", "spirit"],
    effects: [
      summon("fusion-lantern-thunder", ["shadow", "lightning"], "lantern-thunder-keepers", {
        count: 4,
        duration: 14,
        attackDamage: 32,
        attackCooldown: 0.62,
        moveSpeed: 190,
      }),
      accumulator("fusion-lantern-thunder-count", ["shadow", "lightning"], "lanternThunder", 4, [
        lightning("fusion-lantern-thunder-release", ["shadow", "fire", "lightning", "spirit"], 108, {
          strikes: 4,
          radius: 68,
          delay: 0.28,
          chainRange: 210,
        }),
      ]),
    ],
    weaveVerb: "灯亮雷落",
    artKey: "fusion/lantern-thunder",
    terminalArtKey: "terminal/lantern-thunder",
  },
] as const satisfies readonly Omit<
  FusionDefinition,
  | "pairLabel"
  | "canonicalName"
  | "action"
  | "mechanic"
  | "weavePatch"
  | "terminalFamily"
>[];

type FusionWeaveProfile = {
  weavePatch: FusionWeavePatch;
  terminalFamily: TerminalFamily;
};

function weavePatch(
  delivery: FusionWeavePatch["delivery"],
  overrides: Partial<Omit<FusionWeavePatch, "delivery">>,
): FusionWeavePatch {
  return {
    delivery,
    damageMultiplier: 1.16,
    flatDamage: 28,
    countDelta: 1,
    pierceDelta: 0,
    homingDelta: 0,
    spreadDelta: 0,
    lengthDelta: 0,
    widthDelta: 0,
    jumpsDelta: 0,
    rangeDelta: 0,
    radiusDelta: 0,
    durationDelta: 0,
    repeatsDelta: 0,
    storedMultiplier: 1,
    storedDamageRatio: 0.12,
    ...overrides,
  };
}

const FUSION_WEAVE_PROFILES = {
  mistCanopy: {
    terminalFamily: "guardRelease",
    weavePatch: weavePatch("zone", {
      damageMultiplier: 1.14, countDelta: 4, homingDelta: 0.32, radiusDelta: 82,
      durationDelta: 1.8, storedDamageRatio: 0.28,
    }),
  },
  thunderCanopy: {
    terminalFamily: "thunderField",
    weavePatch: weavePatch("lightning", {
      damageMultiplier: 1.2, flatDamage: 42, countDelta: 8, rangeDelta: 72,
      radiusDelta: 48, storedMultiplier: 1.12, storedDamageRatio: 0.34,
    }),
  },
  inkGaleRule: {
    terminalFamily: "sweepingLine",
    weavePatch: weavePatch("beam", {
      damageMultiplier: 1.18, flatDamage: 34, pierceDelta: 8, lengthDelta: 430,
      widthDelta: 18, spreadDelta: 24,
    }),
  },
  starPiercer: {
    terminalFamily: "markedFinish",
    weavePatch: weavePatch("projectile", {
      damageMultiplier: 1.24, flatDamage: 38, countDelta: 3, pierceDelta: 10,
      homingDelta: 0.24, lengthDelta: 120,
    }),
  },
  lanternSword: {
    terminalFamily: "shadowParade",
    weavePatch: weavePatch("summon", {
      damageMultiplier: 1.12, flatDamage: 36, countDelta: 5, durationDelta: 6,
      repeatsDelta: 1, storedDamageRatio: 0.2,
    }),
  },
  swordheartPipa: {
    terminalFamily: "echoChain",
    weavePatch: weavePatch("chain", {
      damageMultiplier: 1.22, flatDamage: 32, jumpsDelta: 7, rangeDelta: 110,
      widthDelta: 18, repeatsDelta: 1,
    }),
  },
  heavenlyLedger: {
    terminalFamily: "markedFinish",
    weavePatch: weavePatch("beam", {
      damageMultiplier: 1.3, flatDamage: 48, countDelta: 2, pierceDelta: 6,
      lengthDelta: 260, widthDelta: 26, storedDamageRatio: 0.32,
    }),
  },
  worldTailor: {
    terminalFamily: "closingField",
    weavePatch: weavePatch("zone", {
      damageMultiplier: 1.26, flatDamage: 34, radiusDelta: 108, durationDelta: 2.6,
      widthDelta: 22, storedDamageRatio: 0.18,
    }),
  },
  raincutCanopy: {
    terminalFamily: "guardRelease",
    weavePatch: weavePatch("zone", {
      damageMultiplier: 1.18, flatDamage: 32, countDelta: 6, pierceDelta: 3,
      homingDelta: 0.42, radiusDelta: 68, storedDamageRatio: 0.3,
    }),
  },
  jadePearlCadence: {
    terminalFamily: "echoChain",
    weavePatch: weavePatch("chain", {
      damageMultiplier: 1.12, flatDamage: 28, countDelta: 5, jumpsDelta: 8,
      rangeDelta: 96, repeatsDelta: 1,
    }),
  },
  linkedLedgerCase: {
    terminalFamily: "returningVolley",
    weavePatch: weavePatch("projectile", {
      damageMultiplier: 1.14, flatDamage: 30, countDelta: 9, pierceDelta: 4,
      spreadDelta: 42, storedDamageRatio: 0.22,
    }),
  },
  lanternBallista: {
    terminalFamily: "shadowParade",
    weavePatch: weavePatch("summon", {
      damageMultiplier: 1.15, flatDamage: 34, countDelta: 4, pierceDelta: 2,
      durationDelta: 7, repeatsDelta: 1,
    }),
  },
  inklineRepeater: {
    terminalFamily: "sweepingLine",
    weavePatch: weavePatch("beam", {
      damageMultiplier: 1.16, flatDamage: 32, countDelta: 3, pierceDelta: 8,
      lengthDelta: 360, widthDelta: 12, repeatsDelta: 1,
    }),
  },
  thunderPipa: {
    terminalFamily: "thunderField",
    weavePatch: weavePatch("lightning", {
      damageMultiplier: 1.22, flatDamage: 44, countDelta: 4, jumpsDelta: 8,
      rangeDelta: 120, radiusDelta: 54, repeatsDelta: 1,
    }),
  },
  myriadLanternCanopy: {
    terminalFamily: "guardRelease",
    weavePatch: weavePatch("zone", {
      damageMultiplier: 1.12, flatDamage: 30, countDelta: 10, homingDelta: 0.44,
      radiusDelta: 74, durationDelta: 2, repeatsDelta: 1, storedDamageRatio: 0.3,
    }),
  },
  galeBamboo: {
    terminalFamily: "returningVolley",
    weavePatch: weavePatch("projectile", {
      damageMultiplier: 1.18, flatDamage: 30, countDelta: 5, pierceDelta: 5,
      homingDelta: 0.48, spreadDelta: 64, repeatsDelta: 1,
    }),
  },
  hiddenSwordCanopy: {
    terminalFamily: "guardRelease",
    weavePatch: weavePatch("zone", {
      damageMultiplier: 1.2, flatDamage: 38, countDelta: 8, pierceDelta: 4,
      radiusDelta: 66, storedDamageRatio: 0.34,
    }),
  },
  twinTailorBlades: {
    terminalFamily: "sweepingLine",
    weavePatch: weavePatch("beam", {
      damageMultiplier: 1.32, flatDamage: 36, pierceDelta: 6, spreadDelta: 62,
      lengthDelta: 240, widthDelta: 34,
    }),
  },
  inkRuleSword: {
    terminalFamily: "sweepingLine",
    weavePatch: weavePatch("beam", {
      damageMultiplier: 1.28, flatDamage: 42, pierceDelta: 12, lengthDelta: 520,
      widthDelta: 10,
    }),
  },
  windRepeater: {
    terminalFamily: "returningVolley",
    weavePatch: weavePatch("projectile", {
      damageMultiplier: 1.1, flatDamage: 26, countDelta: 8, pierceDelta: 3,
      homingDelta: 0.26, spreadDelta: 44,
    }),
  },
  rainStringCanopy: {
    terminalFamily: "echoChain",
    weavePatch: weavePatch("chain", {
      damageMultiplier: 1.16, flatDamage: 30, jumpsDelta: 7, rangeDelta: 105,
      radiusDelta: 72, durationDelta: 1.8,
    }),
  },
  windStringPass: {
    terminalFamily: "echoChain",
    weavePatch: weavePatch("chain", {
      damageMultiplier: 1.14, flatDamage: 28, countDelta: 6, jumpsDelta: 6,
      rangeDelta: 92, spreadDelta: 72,
    }),
  },
  inkRainBoundary: {
    terminalFamily: "closingField",
    weavePatch: weavePatch("zone", {
      damageMultiplier: 1.18, flatDamage: 32, radiusDelta: 96, durationDelta: 2.4,
      pierceDelta: 6, storedDamageRatio: 0.24,
    }),
  },
  stringScissor: {
    terminalFamily: "sweepingLine",
    weavePatch: weavePatch("beam", {
      damageMultiplier: 1.26, flatDamage: 36, jumpsDelta: 5, rangeDelta: 72,
      lengthDelta: 250, widthDelta: 32, spreadDelta: 56,
    }),
  },
  shadowScissor: {
    terminalFamily: "shadowParade",
    weavePatch: weavePatch("summon", {
      damageMultiplier: 1.2, flatDamage: 34, countDelta: 3, durationDelta: 6,
      lengthDelta: 180, repeatsDelta: 1,
    }),
  },
  pearlInkLine: {
    terminalFamily: "sweepingLine",
    weavePatch: weavePatch("beam", {
      damageMultiplier: 1.17, flatDamage: 30, countDelta: 6, pierceDelta: 7,
      lengthDelta: 390, widthDelta: 14,
    }),
  },
  countedLantern: {
    terminalFamily: "shadowParade",
    weavePatch: weavePatch("summon", {
      damageMultiplier: 1.13, flatDamage: 30, countDelta: 4, durationDelta: 5,
      repeatsDelta: 2, storedDamageRatio: 0.22,
    }),
  },
  pearlThunder: {
    terminalFamily: "thunderField",
    weavePatch: weavePatch("lightning", {
      damageMultiplier: 1.2, flatDamage: 42, countDelta: 5, jumpsDelta: 3,
      rangeDelta: 88, radiusDelta: 46, storedDamageRatio: 0.26,
    }),
  },
  thunderBoltRoad: {
    terminalFamily: "markedFinish",
    weavePatch: weavePatch("lightning", {
      damageMultiplier: 1.24, flatDamage: 40, countDelta: 4, pierceDelta: 4,
      rangeDelta: 110, radiusDelta: 42,
    }),
  },
  inkScore: {
    terminalFamily: "echoChain",
    weavePatch: weavePatch("chain", {
      damageMultiplier: 1.2, flatDamage: 32, jumpsDelta: 8, rangeDelta: 100,
      lengthDelta: 280, repeatsDelta: 1,
    }),
  },
  countedSword: {
    terminalFamily: "markedFinish",
    weavePatch: weavePatch("projectile", {
      damageMultiplier: 1.26, flatDamage: 38, countDelta: 5, pierceDelta: 8,
      homingDelta: 0.36, storedDamageRatio: 0.3,
    }),
  },
  markedThunderSword: {
    terminalFamily: "markedFinish",
    weavePatch: weavePatch("lightning", {
      damageMultiplier: 1.3, flatDamage: 46, countDelta: 3, pierceDelta: 5,
      rangeDelta: 104, radiusDelta: 48,
    }),
  },
  windScissors: {
    terminalFamily: "returningVolley",
    weavePatch: weavePatch("projectile", {
      damageMultiplier: 1.22, flatDamage: 34, countDelta: 2, pierceDelta: 6,
      homingDelta: 0.28, spreadDelta: 70, repeatsDelta: 1,
    }),
  },
  windAbacus: {
    terminalFamily: "returningVolley",
    weavePatch: weavePatch("projectile", {
      damageMultiplier: 1.1, flatDamage: 26, countDelta: 9, pierceDelta: 4,
      homingDelta: 0.24, spreadDelta: 82,
    }),
  },
  windLantern: {
    terminalFamily: "shadowParade",
    weavePatch: weavePatch("summon", {
      damageMultiplier: 1.12, flatDamage: 30, countDelta: 4, homingDelta: 0.4,
      durationDelta: 6, repeatsDelta: 1,
    }),
  },
  windThunder: {
    terminalFamily: "thunderField",
    weavePatch: weavePatch("lightning", {
      damageMultiplier: 1.18, flatDamage: 40, countDelta: 5, homingDelta: 0.26,
      rangeDelta: 118, radiusDelta: 52, durationDelta: 1.4,
    }),
  },
  beadCanopy: {
    terminalFamily: "guardRelease",
    weavePatch: weavePatch("zone", {
      damageMultiplier: 1.15, flatDamage: 30, countDelta: 8, pierceDelta: 3,
      radiusDelta: 70, storedDamageRatio: 0.28,
    }),
  },
  canopyVolley: {
    terminalFamily: "guardRelease",
    weavePatch: weavePatch("projectile", {
      damageMultiplier: 1.18, flatDamage: 34, countDelta: 8, pierceDelta: 5,
      spreadDelta: 88, storedDamageRatio: 0.32,
    }),
  },
  boltScissors: {
    terminalFamily: "markedFinish",
    weavePatch: weavePatch("beam", {
      damageMultiplier: 1.3, flatDamage: 42, pierceDelta: 7, lengthDelta: 320,
      widthDelta: 30, spreadDelta: 38,
    }),
  },
  thunderScissors: {
    terminalFamily: "thunderField",
    weavePatch: weavePatch("lightning", {
      damageMultiplier: 1.28, flatDamage: 44, countDelta: 2, rangeDelta: 128,
      radiusDelta: 62, widthDelta: 24,
    }),
  },
  stringCrossbow: {
    terminalFamily: "echoChain",
    weavePatch: weavePatch("chain", {
      damageMultiplier: 1.13, flatDamage: 30, countDelta: 6, pierceDelta: 3,
      jumpsDelta: 7, rangeDelta: 100,
    }),
  },
  lanternStrings: {
    terminalFamily: "shadowParade",
    weavePatch: weavePatch("summon", {
      damageMultiplier: 1.14, flatDamage: 32, countDelta: 4, jumpsDelta: 5,
      durationDelta: 6, repeatsDelta: 1,
    }),
  },
  inkShadow: {
    terminalFamily: "shadowParade",
    weavePatch: weavePatch("summon", {
      damageMultiplier: 1.18, flatDamage: 32, countDelta: 4, lengthDelta: 360,
      durationDelta: 7, repeatsDelta: 1,
    }),
  },
  inkThunderRoad: {
    terminalFamily: "thunderField",
    weavePatch: weavePatch("lightning", {
      damageMultiplier: 1.26, flatDamage: 42, countDelta: 5, pierceDelta: 10,
      lengthDelta: 460, rangeDelta: 120, radiusDelta: 44,
    }),
  },
  lanternThunder: {
    terminalFamily: "thunderField",
    weavePatch: weavePatch("lightning", {
      damageMultiplier: 1.22, flatDamage: 44, countDelta: 4, rangeDelta: 110,
      radiusDelta: 56, repeatsDelta: 1, storedDamageRatio: 0.26,
    }),
  },
} as const satisfies Readonly<Record<FusionId, FusionWeaveProfile>>;

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
    const profile = FUSION_WEAVE_PROFILES[definition.id];
    return {
      ...definition,
      ...profile,
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
