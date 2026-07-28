import { beam, chain, delayed, lightning, projectile, summon, zone } from "./effects";
import type { CelestialIntrusion, CelestialIntrusionId } from "./types";

export const CELESTIAL_INTRUSIONS = [
  {
    id: "thunderTrial",
    name: "雷劫",
    warning: "云墨聚顶，落点将以蓝白雷纹长时示警。",
    avatarName: "雷部劫眼",
    baseHp: 900,
    duration: 32,
    hostileEffects: [lightning("intrusion-thunder-hostile", ["lightning"], 2, { strikes: 5, radius: 72, delay: 1.15 })],
    capturedName: "天律·霆章",
    capturedTags: ["lightning", "spirit"],
    capturedEffects: [lightning("intrusion-thunder-captured", ["lightning", "spirit"], 86, { trigger: "onWeavePass", strikes: 4, radius: 76 })],
    artKey: "celestial/thunder-trial",
  },
  {
    id: "galeTrial",
    name: "罡风",
    warning: "场边风旗倒伏，数道宽风带将横扫战场。",
    avatarName: "罡风眼",
    baseHp: 820,
    duration: 34,
    hostileEffects: [beam("intrusion-gale-hostile", ["wind"], 1, { length: 1280, width: 94, duration: 1.1, sweepDegrees: 18 })],
    capturedName: "天律·风纪",
    capturedTags: ["wind"],
    capturedEffects: [projectile("intrusion-gale-captured", ["wind"], 34, 0, { trigger: "onWeavePass", pattern: "radial", count: 12, pierce: 3 })],
    artKey: "celestial/gale-trial",
  },
  {
    id: "fireTrial",
    name: "火劫",
    warning: "朱砂火种沿地面显形，稍后依次连燃。",
    avatarName: "赤焰灯魄",
    baseHp: 880,
    duration: 30,
    hostileEffects: [delayed("intrusion-fire-hostile", ["fire"], 2, { delay: 1.2, radius: 105, repeats: 2 })],
    capturedName: "天律·明火",
    capturedTags: ["fire"],
    capturedEffects: [delayed("intrusion-fire-captured", ["fire"], 98, { trigger: "onWeavePass", delay: 0.35, radius: 132, repeats: 1 })],
    artKey: "celestial/fire-trial",
  },
  {
    id: "frostTrial",
    name: "玄霜",
    warning: "地面先结出石青霜花，再缓慢收紧寒域。",
    avatarName: "玄霜魄",
    baseHp: 940,
    duration: 36,
    hostileEffects: [zone("intrusion-frost-hostile", ["frost"], 1, { radius: 260, duration: 5, tickRate: 0.5, slow: 0.38 })],
    capturedName: "天律·霜序",
    capturedTags: ["frost", "guard"],
    capturedEffects: [zone("intrusion-frost-captured", ["frost", "guard"], 42, { trigger: "onWeavePass", radius: 168, duration: 5, slow: 0.32 })],
    artKey: "celestial/frost-trial",
  },
  {
    id: "ghostMarch",
    name: "阴兵",
    warning: "远处法铃轻响，纸影军列从单一方向入场。",
    avatarName: "阴兵旗主",
    baseHp: 1020,
    duration: 38,
    hostileEffects: [summon("intrusion-ghost-hostile", ["spirit", "shadow"], "hostile-ghost-column", { count: 6, duration: 12, attackDamage: 1, attackCooldown: 1 })],
    capturedName: "天律·幽列",
    capturedTags: ["spirit", "shadow"],
    capturedEffects: [summon("intrusion-ghost-captured", ["spirit", "shadow"], "allied-ghost-column", { trigger: "onWeavePass", count: 5, duration: 10, attackDamage: 42, attackCooldown: 0.6 })],
    artKey: "celestial/ghost-march",
  },
  {
    id: "eclipseTrial",
    name: "蚀月",
    warning: "战场边缘逐层暗下，月影缺口将标出安全扇区。",
    avatarName: "蚀月眸",
    baseHp: 1100,
    duration: 34,
    hostileEffects: [zone("intrusion-eclipse-hostile", ["shadow", "spirit"], 2, { radius: 310, duration: 4, tickRate: 0.5 })],
    capturedName: "天律·月蚀",
    capturedTags: ["shadow", "spirit"],
    capturedEffects: [chain("intrusion-eclipse-captured", ["shadow", "spirit"], 58, { trigger: "onWeavePass", jumps: 8, range: 270, falloff: 0.96 })],
    artKey: "celestial/eclipse-trial",
  },
] as const satisfies readonly CelestialIntrusion[];

export const CELESTIALS_BY_ID: Readonly<Record<CelestialIntrusionId, CelestialIntrusion>> =
  Object.freeze(
    Object.fromEntries(CELESTIAL_INTRUSIONS.map((definition) => [definition.id, definition])) as unknown as Record<
      CelestialIntrusionId,
      CelestialIntrusion
    >,
  );

export function getCelestialIntrusion(id: CelestialIntrusionId): CelestialIntrusion {
  return CELESTIALS_BY_ID[id];
}
