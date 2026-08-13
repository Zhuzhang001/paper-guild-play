import type {
  CombatBuild,
  TravelNoteCategory,
  TravelNoteDefinition,
  TravelNoteId,
  TravelNoteRankState,
} from "./types";

export const TRAVEL_NOTE_MASTERY_RANK = 4 as const;
const CONTINUATION_RATIO = 0.75;

export const TRAVEL_NOTE_CATEGORIES: readonly TravelNoteCategory[] = [
  "craft",
  "journey",
  "protection",
] as const;

export const TRAVEL_NOTE_DEFINITIONS: readonly TravelNoteDefinition[] = [
  { id: "keenEdge", name: "砺锋", category: "craft", masteryRank: 4, description: "逐阶打磨器锋，提高所有基础伤害。", requirements: [], artKey: "upgrade/travel-note-keen-edge" },
  { id: "quickHands", name: "顺手", category: "craft", masteryRank: 4, description: "收紧现有核心攻击的节拍，不另开攻击计时。", requirements: [], artKey: "upgrade/travel-note-quick-hands" },
  { id: "longReach", name: "放远", category: "craft", masteryRank: 4, description: "延伸弹体、扫击、光束与区域的作用距离。", requirements: [], artKey: "upgrade/travel-note-long-reach" },
  { id: "lastingWork", name: "久留", category: "craft", masteryRank: 4, description: "让召唤物与驻留区域在场上维持更久。", requirements: ["durationWeapon"], artKey: "upgrade/travel-note-lasting-work" },
  { id: "gatheringWind", name: "聚风", category: "journey", masteryRank: 4, description: "扩大纸结感应范围，并加快吸附。", requirements: [], artKey: "upgrade/travel-note-gathering-wind" },
  { id: "lightStep", name: "轻脚", category: "journey", masteryRank: 4, description: "让行路脚步更轻快。", requirements: [], artKey: "upgrade/travel-note-light-step" },
  { id: "mergePearls", name: "并珠", category: "journey", masteryRank: 4, description: "更早归并散落纸结，并加强合并纸结的吸附。", requirements: [], artKey: "upgrade/travel-note-merge-pearls" },
  { id: "turningMomentum", name: "转身借力", category: "journey", masteryRank: 4, description: "急转后令下一次核心攻击重新索敌并补发回响。", requirements: [], artKey: "upgrade/travel-note-turning-momentum" },
  { id: "paperWard", name: "护纸", category: "protection", masteryRank: 4, description: "增加一命并立即补足新增纸命。", requirements: ["notOneLife"], artKey: "upgrade/travel-note-paper-ward" },
  { id: "slowPaper", name: "缓纸", category: "protection", masteryRank: 4, description: "延长受击后的安全间隙。", requirements: [], artKey: "upgrade/travel-note-slow-paper" },
  { id: "stepBack", name: "退一步", category: "protection", masteryRank: 4, description: "受击时推开身边的非首领敌人。", requirements: [], artKey: "upgrade/travel-note-step-back" },
  { id: "pickupMend", name: "拾补", category: "protection", masteryRank: 4, description: "拾取足够多的朱砂纸结后生成恢复叶。", requirements: ["notOneLife", "recoveryEnabled"], artKey: "upgrade/travel-note-pickup-mend" },
] as const;

const TRAVEL_NOTE_BY_ID = new Map(
  TRAVEL_NOTE_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function getTravelNoteDefinition(id: TravelNoteId): TravelNoteDefinition {
  const definition = TRAVEL_NOTE_BY_ID.get(id);
  if (!definition) throw new Error(`Unknown travel note ${id}`);
  return definition;
}

export function getTravelNoteRank(
  buildOrRanks: CombatBuild | TravelNoteRankState | undefined,
  id: TravelNoteId,
): number {
  if (!buildOrRanks) return 0;
  const ranks = "weapons" in buildOrRanks ? buildOrRanks.travelNotes : buildOrRanks;
  return Math.max(0, Math.floor(ranks?.[id] ?? 0));
}

/** Four full linear steps, then half a step followed by 75% of the prior gain. */
export function continuedLinearGain(step: number, rank: number): number {
  const safeRank = Math.max(0, Math.floor(rank));
  const linear = Math.min(TRAVEL_NOTE_MASTERY_RANK, safeRank) * step;
  const overflow = Math.max(0, safeRank - TRAVEL_NOTE_MASTERY_RANK);
  if (overflow === 0) return linear;
  return linear + step * 0.5 * (1 - CONTINUATION_RATIO ** overflow) / (1 - CONTINUATION_RATIO);
}

export type TravelNoteEffect = {
  damageMultiplier: number;
  attackIntervalMultiplier: number;
  rangeMultiplier: number;
  durationMultiplier: number;
  magnetMultiplier: number;
  speedMultiplier: number;
  mergeThreshold: number;
  mergedPearlAttractionMultiplier: number;
  turnEchoRatio: number;
  turnEchoCooldown: number;
  extraLife: number;
  extraInvulnerability: number;
  stepBackRadius: number;
  stepBackCooldown: number;
  pickupMendRequirement: number;
};

function stepped(values: readonly number[], rank: number, fallback: number): number {
  if (rank <= 0) return fallback;
  return values[Math.min(values.length, rank) - 1] ?? fallback;
}

export function resolveTravelNoteEffect(
  id: TravelNoteId,
  rank: number,
): TravelNoteEffect {
  const r = Math.max(0, Math.floor(rank));
  const overflow = Math.max(0, r - TRAVEL_NOTE_MASTERY_RANK);
  const continuation = 1 - CONTINUATION_RATIO ** overflow;
  const base: TravelNoteEffect = {
    damageMultiplier: 1,
    attackIntervalMultiplier: 1,
    rangeMultiplier: 1,
    durationMultiplier: 1,
    magnetMultiplier: 1,
    speedMultiplier: 1,
    mergeThreshold: 92,
    mergedPearlAttractionMultiplier: 1,
    turnEchoRatio: 0,
    turnEchoCooldown: Number.POSITIVE_INFINITY,
    extraLife: 0,
    extraInvulnerability: 0,
    stepBackRadius: 0,
    stepBackCooldown: Number.POSITIVE_INFINITY,
    pickupMendRequirement: Number.POSITIVE_INFINITY,
  };
  if (id === "keenEdge") base.damageMultiplier += continuedLinearGain(0.06, r);
  if (id === "quickHands") base.attackIntervalMultiplier -= continuedLinearGain(0.05, r);
  if (id === "longReach") base.rangeMultiplier += continuedLinearGain(0.1, r);
  if (id === "lastingWork") base.durationMultiplier += continuedLinearGain(0.15, r);
  if (id === "gatheringWind") base.magnetMultiplier += continuedLinearGain(0.18, r);
  if (id === "lightStep") base.speedMultiplier += continuedLinearGain(0.05, r);
  if (id === "slowPaper") base.extraInvulnerability = continuedLinearGain(0.15, r);
  if (id === "paperWard") base.extraLife = r;
  if (id === "mergePearls") {
    base.mergeThreshold = r <= 4
      ? stepped([72, 56, 44, 36], r, 92)
      : 36 - 16 * continuation;
    base.mergedPearlAttractionMultiplier = r <= 0
      ? 1
      : (260 + continuedLinearGain(80, r - 1)) / 150;
  }
  if (id === "turningMomentum" && r > 0) {
    base.turnEchoRatio = r <= 4 ? stepped([0.45, 0.45, 0.55, 0.65], r, 0) : 0.65 + 0.2 * continuation;
    base.turnEchoCooldown = r <= 4 ? stepped([6, 4, 4, 4], r, Infinity) : 4 - continuation;
  }
  if (id === "stepBack" && r > 0) {
    base.stepBackRadius = r <= 4 ? stepped([100, 140, 180, 220], r, 0) : 220 + 80 * continuation;
    base.stepBackCooldown = r <= 4 ? stepped([8, 6, 5, 4], r, Infinity) : 4 - 2 * continuation;
  }
  if (id === "pickupMend" && r > 0) {
    base.pickupMendRequirement = r <= 4 ? stepped([8, 6, 4, 2], r, Infinity) : 2 - continuation;
  }
  return base;
}

function compact(value: number, unit = ""): string {
  if (!Number.isFinite(value)) return "未生效";
  const absolute = Math.abs(value);
  const digits = absolute >= 100 ? 1 : absolute >= 10 ? 2 : 3;
  return `${value.toFixed(digits).replace(/\.0+$|(?<=\.[0-9]*)0+$/u, "")}${unit}`;
}

export type TravelNoteStepDescription = {
  current: string;
  next: string;
  delta: string;
  sentence: string;
};

export type TravelNoteDescriptionContext = {
  fastestWeaponName?: string;
  fastestWeaponInterval?: number;
  maxLife?: number;
};

export function describeTravelNoteStep(
  id: TravelNoteId,
  currentRank: number,
  context: TravelNoteDescriptionContext = {},
): TravelNoteStepDescription {
  const before = resolveTravelNoteEffect(id, currentRank);
  const after = resolveTravelNoteEffect(id, currentRank + 1);
  let current = "";
  let next = "";
  let delta = "";
  switch (id) {
    case "keenEdge":
      current = compact(before.damageMultiplier * 100, "%"); next = compact(after.damageMultiplier * 100, "%"); delta = `+${compact((after.damageMultiplier - before.damageMultiplier) * 100, "个百分点")}`; break;
    case "quickHands": {
      const baseInterval = context.fastestWeaponInterval ?? 1;
      const oldInterval = baseInterval * before.attackIntervalMultiplier;
      const newInterval = baseInterval * after.attackIntervalMultiplier;
      current = compact(oldInterval, "秒"); next = compact(newInterval, "秒"); delta = `减少${compact(oldInterval - newInterval, "秒")}`; break;
    }
    case "longReach": current = compact(before.rangeMultiplier * 100, "%"); next = compact(after.rangeMultiplier * 100, "%"); delta = `+${compact((after.rangeMultiplier - before.rangeMultiplier) * 100, "个百分点")}`; break;
    case "lastingWork": current = compact(before.durationMultiplier * 100, "%"); next = compact(after.durationMultiplier * 100, "%"); delta = `+${compact((after.durationMultiplier - before.durationMultiplier) * 100, "个百分点")}`; break;
    case "gatheringWind": current = compact(before.magnetMultiplier * 100, "%"); next = compact(after.magnetMultiplier * 100, "%"); delta = `+${compact((after.magnetMultiplier - before.magnetMultiplier) * 100, "个百分点")}`; break;
    case "lightStep": current = compact(before.speedMultiplier * 100, "%"); next = compact(after.speedMultiplier * 100, "%"); delta = `+${compact((after.speedMultiplier - before.speedMultiplier) * 100, "个百分点")}`; break;
    case "mergePearls": current = `${Math.ceil(before.mergeThreshold)}枚／${compact(before.mergedPearlAttractionMultiplier * 100, "%")}`; next = `${Math.ceil(after.mergeThreshold)}枚／${compact(after.mergedPearlAttractionMultiplier * 100, "%")}`; delta = `归并线与吸附同时改善`; break;
    case "turningMomentum": current = `${compact(before.turnEchoRatio * 100, "%")}／${compact(before.turnEchoCooldown, "秒")}`; next = `${compact(after.turnEchoRatio * 100, "%")}／${compact(after.turnEchoCooldown, "秒")}`; delta = "回响增强，冷却缩短"; break;
    case "paperWard": { const life = context.maxLife ?? before.extraLife; current = `${life}命`; next = `${life + 1}命`; delta = "+1命并补1"; break; }
    case "slowPaper": current = `+${compact(before.extraInvulnerability, "秒")}`; next = `+${compact(after.extraInvulnerability, "秒")}`; delta = `+${compact(after.extraInvulnerability - before.extraInvulnerability, "秒")}`; break;
    case "stepBack": current = `${compact(before.stepBackRadius, "px")}／${compact(before.stepBackCooldown, "秒")}`; next = `${compact(after.stepBackRadius, "px")}／${compact(after.stepBackCooldown, "秒")}`; delta = "范围扩大，冷却缩短"; break;
    case "pickupMend": current = `平均${compact(before.pickupMendRequirement, "枚")}`; next = `平均${compact(after.pickupMendRequirement, "枚")}`; delta = "更快生成恢复叶"; break;
  }
  const subject = id === "quickHands" && context.fastestWeaponName ? `${context.fastestWeaponName} ` : "";
  return { current, next, delta, sentence: `${subject}${current} → ${next}（本次${delta}）` };
}
