import { accumulator, beam, chain, copy, delayed, lightning, mark, orbit, projectile, summon, zone } from "./effects";
import type {
  EffectSpec,
  SynergyDefinition,
  SynergyRouteVariant,
  WeaponId,
  WeaponRouteKey,
  WeaponState,
} from "./types";

function variant(
  id: string,
  when: Partial<Record<WeaponId, WeaponRouteKey>>,
  nameSuffix: string,
  description: string,
  effects: readonly EffectSpec[],
): SynergyRouteVariant {
  return { id, when, nameSuffix, description, effects };
}

export const SYNERGY_DEFINITIONS = [
  {
    id: "windRain",
    name: "风雨合鸣",
    weapons: ["fan", "umbrella"],
    description: "风浪经过伞面后分裂为一阵雨针。",
    effects: [projectile("synergy-wind-rain", ["wind", "rain"], 18, 1.2, { pattern: "fan", count: 8, spreadDegrees: 74, trigger: "onHit" })],
    routeVariants: [
      variant("windRain-tempest", { fan: "a", umbrella: "b" }, "·骤雨", "广域风浪将雨针散成两层扇面。", [
        projectile("synergy-wind-rain-tempest", ["wind", "rain"], 22, 0.95, { pattern: "fan", count: 14, spreadDegrees: 108 }),
      ]),
      variant("windRain-thunder", { umbrella: "c" }, "·雷雨", "每第三轮雨针引下一道伞雷。", [
        accumulator("synergy-wind-rain-thunder", ["wind", "rain", "lightning"], "windRain", 3, [
          lightning("synergy-wind-rain-strike", ["lightning", "rain"], 74, { strikes: 2, radius: 58 }),
        ]),
      ]),
    ],
    artKey: "synergy/wind-rain",
  },
  {
    id: "fineAccounting",
    name: "精打细算",
    weapons: ["scissors", "abacus"],
    description: "累计命中后，剪刃锁定高生命目标进行清算。",
    effects: [
      accumulator("synergy-fine-accounting", ["craft", "ledger"], "fineAccounting", 20, [
        beam("synergy-fine-accounting-cut", ["craft", "ledger"], 92, { length: 520, width: 34 }),
      ]),
    ],
    routeVariants: [
      variant("fineAccounting-execute", { scissors: "c", abacus: "c" }, "·绝账", "清账会对残血目标追加断裁。", [
        delayed("synergy-fine-accounting-execute", ["craft", "ledger", "execute"], 118, { delay: 0.22, radius: 72 }),
      ]),
      variant("fineAccounting-grid", { scissors: "b", abacus: "b" }, "·珠剪盘", "珠列穿过绞云时沿切线分裂。", [
        projectile("synergy-fine-accounting-grid", ["craft", "ledger"], 28, 0.8, { pattern: "radial", count: 8, pierce: 3 }),
      ]),
    ],
    artKey: "synergy/fine-accounting",
  },
  {
    id: "nearFarAccord",
    name: "远近相济",
    weapons: ["sword", "crossbow"],
    description: "剑印为弩机指示目标，弩矢优先追摄剑印。",
    effects: [mark("synergy-near-far-mark", ["blade", "mechanism", "mark"], { duration: 4.5, damageTakenMultiplier: 1.2 })],
    routeVariants: [
      variant("nearFar-fortress", { sword: "b", crossbow: "b" }, "·剑弩城", "剑阵环绕弩机，弩机获得近身防线。", [
        orbit("synergy-near-far-fortress", ["blade", "mechanism", "guard"], 31, { count: 4, radius: 72 }),
      ]),
      variant("nearFar-fireline", { sword: "c", crossbow: "c" }, "·破军火线", "横斩会沿途点燃所有火种。", [
        delayed("synergy-near-far-fireline", ["blade", "mechanism", "fire"], 84, { trigger: "onMarkedHit", delay: 0.18, radius: 110 }),
      ]),
    ],
    artKey: "synergy/near-far",
  },
  {
    id: "windStrings",
    name: "风弦同调",
    weapons: ["fan", "pipa"],
    description: "音浪借风延伸，命中后产生回旋泛音。",
    effects: [chain("synergy-wind-strings", ["wind", "music"], 34, { jumps: 5, range: 240, falloff: 0.93 })],
    routeVariants: [
      variant("windStrings-field", { fan: "a", pipa: "c" }, "·回风绕梁", "风墙内的余音场扩大并减缓敌人。", [
        zone("synergy-wind-strings-field", ["wind", "music"], 35, { radius: 176, duration: 5.5, slow: 0.28 }),
      ]),
      variant("windStrings-seeker", { fan: "b", pipa: "b" }, "·寻声", "追踪风刃携带可跳跃的泛音。", [
        projectile("synergy-wind-strings-seeker", ["wind", "music"], 42, 0.72, { count: 3, homing: 0.9, pierce: 2 }),
      ]),
    ],
    artKey: "synergy/wind-strings",
  },
  {
    id: "inkMechanism",
    name: "墨规机锋",
    weapons: ["inkline", "crossbow"],
    description: "墨线为弩矢校准，穿线后的弩矢提高穿透。",
    effects: [projectile("synergy-ink-mechanism", ["craft", "mechanism"], 31, 0.68, { count: 3, pierce: 6, speed: 1050 })],
    routeVariants: [
      variant("inkMechanism-turret", { inkline: "c", crossbow: "b" }, "·榫弩台", "构件自动拼合为可移动弩台。", [
        summon("synergy-ink-mechanism-turret", ["craft", "mechanism"], "mortise-ballista", { count: 2, duration: 16, attackDamage: 38 }),
      ]),
      variant("inkMechanism-firegrid", { inkline: "b", crossbow: "c" }, "·伏火墨界", "火种在墨线交点埋伏，越界时引爆。", [
        delayed("synergy-ink-mechanism-firegrid", ["craft", "mechanism", "fire"], 96, { delay: 0.4, radius: 126 }),
      ]),
    ],
    artKey: "synergy/ink-mechanism",
  },
  {
    id: "lanternBlades",
    name: "影剑成行",
    weapons: ["lantern", "sword"],
    description: "走马灯摹写剑势，影卒随剑印冲锋。",
    effects: [summon("synergy-lantern-blades", ["shadow", "blade"], "shadow-swordsman", { count: 3, duration: 12, attackDamage: 29 })],
    routeVariants: [
      variant("lanternBlades-array", { lantern: "a", sword: "b" }, "·剑影列阵", "影卒围成外层剑阵。", [
        orbit("synergy-lantern-blades-array", ["shadow", "blade"], 34, { count: 6, radius: 148 }),
      ]),
      variant("lanternBlades-copy", { lantern: "c", sword: "a" }, "·飞剑留影", "每柄飞剑都生成一次较弱的灯影追击。", [
        copy("synergy-lantern-blades-copy", ["shadow", "blade"], { source: "markedHit", damageMultiplier: 0.58, maxCopies: 3 }),
      ]),
    ],
    artKey: "synergy/lantern-blades",
  },
  {
    id: "canopyThunder",
    name: "承霆化雨",
    weapons: ["umbrella", "thunderSeal"],
    description: "伞面承下雷力，再以带电雨滴洒向四周。",
    effects: [projectile("synergy-canopy-thunder", ["rain", "lightning"], 27, 0.9, { pattern: "radial", count: 12, pierce: 2 })],
    routeVariants: [
      variant("canopyThunder-altar", { umbrella: "a", thunderSeal: "c" }, "·华盖雷坛", "雷坛随护身伞阵移动。", [
        zone("synergy-canopy-thunder-altar", ["rain", "guard", "lightning"], 44, { radius: 156, duration: 5, followsOwner: true }),
      ]),
      variant("canopyThunder-chain", { umbrella: "b", thunderSeal: "b" }, "·雨脉阴雷", "每枚雨针都可能成为阴雷跳点。", [
        chain("synergy-canopy-thunder-chain", ["rain", "lightning"], 39, { jumps: 7, range: 190 }),
      ]),
    ],
    artKey: "synergy/canopy-thunder",
  },
  {
    id: "thunderCadence",
    name: "雷音法鼓",
    weapons: ["pipa", "thunderSeal"],
    description: "雷声按琵琶节拍落下，音浪终点形成雷爆。",
    effects: [lightning("synergy-thunder-cadence", ["music", "lightning"], 72, { strikes: 3, radius: 68, delay: 0.3 })],
    routeVariants: [
      variant("thunderCadence-chain", { pipa: "b", thunderSeal: "b" }, "·滚雷泛音", "雷与泛音共用跳跃链，末跳不衰减。", [
        chain("synergy-thunder-cadence-chain", ["music", "lightning"], 53, { jumps: 10, range: 255, falloff: 0.97 }),
      ]),
      variant("thunderCadence-field", { pipa: "c", thunderSeal: "c" }, "·雷坛余韵", "雷坛与余音场重合时持续共振。", [
        zone("synergy-thunder-cadence-field", ["music", "lightning"], 58, { radius: 172, duration: 6, tickRate: 0.18 }),
      ]),
    ],
    artKey: "synergy/thunder-cadence",
  },
  {
    id: "lanternCanopy",
    name: "灯月伞华",
    weapons: ["lantern", "umbrella"],
    description: "灯影映上伞面，每次开合释放一圈影灯。",
    effects: [orbit("synergy-lantern-canopy", ["shadow", "rain", "guard"], 28, { count: 8, radius: 136, hitCooldown: 0.24 })],
    routeVariants: [
      variant("lanternCanopy-soldiers", { lantern: "a", umbrella: "a" }, "·伞下百戏", "影卒在伞阵内获得护身与攻速。", [
        summon("synergy-lantern-canopy-soldiers", ["shadow", "guard"], "canopy-troupe", { count: 5, duration: 15, attackDamage: 34, attackCooldown: 0.42 }),
      ]),
      variant("lanternCanopy-rain", { lantern: "b", umbrella: "b" }, "·灯雨千点", "雨针带着灯火余辉二次命中。", [
        delayed("synergy-lantern-canopy-rain", ["shadow", "rain", "fire"], 35, { trigger: "onHit", delay: 0.3, radius: 54 }),
      ]),
    ],
    artKey: "synergy/lantern-canopy",
  },
  {
    id: "tailoredWorld",
    name: "量体裁界",
    weapons: ["scissors", "inkline"],
    description: "墨线量出敌阵尺寸，剪刃沿界线完成裁切。",
    effects: [beam("synergy-tailored-world", ["craft", "blade"], 62, { length: 680, width: 32, duration: 0.4 })],
    routeVariants: [
      variant("tailoredWorld-grid", { scissors: "a", inkline: "b" }, "·经纬回剪", "回旋剪每次跨越裁域都会复制一道裁线。", [
        copy("synergy-tailored-world-grid", ["craft", "blade"], { source: "markedHit", damageMultiplier: 0.64, maxCopies: 3 }),
      ]),
      variant("tailoredWorld-execute", { scissors: "c", inkline: "a" }, "·墨绳断命", "被墨线标记的低生命敌人立即遭到断裁。", [
        delayed("synergy-tailored-world-execute", ["craft", "execute"], 138, { trigger: "onMarkedHit", delay: 0.18, radius: 82 }),
      ]),
    ],
    artKey: "synergy/tailored-world",
  },
  {
    id: "pearlRepeater",
    name: "珠机连筹",
    weapons: ["abacus", "crossbow"],
    description: "算珠进入连弩机括，攻击次数与齐射节奏彼此累积。",
    effects: [projectile("synergy-pearl-repeater", ["ledger", "mechanism"], 21, 0.32, { pattern: "burst", count: 5, speed: 940 })],
    routeVariants: [
      variant("pearlRepeater-turret", { abacus: "a", crossbow: "b" }, "·珠雨弩台", "弩台改射高速算珠。", [
        summon("synergy-pearl-repeater-turret", ["ledger", "mechanism"], "pearl-ballista", { count: 3, duration: 15, attackDamage: 28, attackCooldown: 0.3 }),
      ]),
      variant("pearlRepeater-settle", { abacus: "c", crossbow: "c" }, "·火账同清", "清账时引爆场上所有火种。", [
        delayed("synergy-pearl-repeater-settle", ["ledger", "mechanism", "fire"], 112, { delay: 0.24, radius: 128, repeats: 1 }),
      ]),
    ],
    artKey: "synergy/pearl-repeater",
  },
  {
    id: "jadePearlSong",
    name: "拨珠成曲",
    weapons: ["pipa", "abacus"],
    description: "算珠命中成为节拍，满拍后奏出一轮玉珠音曲。",
    effects: [
      accumulator("synergy-jade-pearl-song", ["music", "ledger"], "pearlCadence", 16, [
        projectile("synergy-jade-pearl-release", ["music", "ledger"], 32, 0, { pattern: "radial", count: 16, homing: 0.35 }),
      ]),
    ],
    routeVariants: [
      variant("jadePearlSong-harmonics", { pipa: "b", abacus: "a" }, "·大珠小珠", "高频珠雨持续为泛音增加跳跃次数。", [
        chain("synergy-jade-pearl-song-harmonics", ["music", "ledger"], 41, { jumps: 9, range: 240 }),
      ]),
      variant("jadePearlSong-ledger", { pipa: "c", abacus: "c" }, "·余音清账", "清账爆点留下驻留音场。", [
        zone("synergy-jade-pearl-song-ledger", ["music", "ledger"], 46, { trigger: "onMarkedHit", radius: 132, duration: 5 }),
      ]),
    ],
    artKey: "synergy/jade-pearl-song",
  },
] as const satisfies readonly SynergyDefinition[];

export type ResolvedSynergy = {
  definition: SynergyDefinition;
  variant?: SynergyRouteVariant;
  name: string;
  description: string;
  effects: readonly EffectSpec[];
};

function variantMatches(variantDefinition: SynergyRouteVariant, weaponStates: ReadonlyMap<WeaponId, WeaponState>) {
  return Object.entries(variantDefinition.when).every(([weaponId, routeKey]) => {
    const state = weaponStates.get(weaponId as WeaponId);
    return state?.routeId === `${weaponId}:${routeKey}`;
  });
}

export function resolveActiveSynergies(
  weapons: readonly WeaponState[],
  capacity = 3,
): readonly ResolvedSynergy[] {
  const states = new Map(weapons.map((weaponState) => [weaponState.id, weaponState]));
  const eligible = SYNERGY_DEFINITIONS.filter(({ weapons: pair }) =>
    pair.every((weaponId) => {
      const state = states.get(weaponId);
      return state !== undefined && state.level >= 3;
    }),
  );

  return eligible.slice(0, Math.max(0, capacity)).map((definition) => {
    const matchedVariant = definition.routeVariants.find((candidate) => variantMatches(candidate, states));
    return {
      definition,
      variant: matchedVariant,
      name: matchedVariant ? `${definition.name}${matchedVariant.nameSuffix}` : definition.name,
      description: matchedVariant?.description ?? definition.description,
      effects: matchedVariant ? [...definition.effects, ...matchedVariant.effects] : definition.effects,
    };
  });
}
