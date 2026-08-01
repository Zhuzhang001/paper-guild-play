import type {
  EffectTag,
  EndlessPerkAction,
  EndlessPerkCategory,
  EndlessPerkDefinition,
  EndlessPerkBranchId,
  EndlessPerkId,
  EndlessPerkPageId,
  EndlessPerkPairId,
  EndlessPerkRule,
  EndlessPerkTrigger,
} from "./types";

function perk(
  id: EndlessPerkId,
  name: string,
  description: string,
  category: EndlessPerkCategory,
  trigger: EndlessPerkTrigger,
  actions: readonly EndlessPerkAction[],
  tags: readonly EffectTag[] = [],
): EndlessPerkDefinition {
  return {
    id,
    name,
    description,
    category,
    maxRank: 1,
    weight: 1,
    tags,
    rules: [{ trigger, actions }],
    choiceKind: "page",
  };
}

export const ENDLESS_PERK_DEFINITIONS = [
  // 武器手艺：改变某把武器的事件链，不提供同质百分比面板。
  perk(
    "swordMarkReturn",
    "剑印回手",
    "剑标目标死后，剑折返并再索敌一次。",
    "weapon",
    {
      event: "markedTargetKilled",
      weaponId: "sword",
      counterScope: "target",
    },
    [{ kind: "returnAndRetarget", count: 1, target: "nearest" }],
    ["blade", "mark"],
  ),
  perk(
    "windDeflectShot",
    "借风偏箭",
    "友方弹体穿过扇风后，转向高生命敌并加速。",
    "weapon",
    { event: "projectileCrossedWind", requiredWeaponId: "fan" },
    [{ kind: "retargetAndAccelerate", value: 1.35, target: "highestHp" }],
    ["wind", "mechanism"],
  ),
  perk(
    "umbrellaGap",
    "伞下空当",
    "成功格挡后0.6秒推开近敌，并补一层伞护。",
    "weapon",
    { event: "guardSucceeded", weaponId: "umbrella", cooldownSeconds: 0.6 },
    [
      {
        kind: "pushAndGuard",
        radius: 148,
        durationSeconds: 0.6,
        count: 1,
      },
    ],
    ["rain", "guard"],
  ),
  perk(
    "scissorsCross",
    "合口一剪",
    "双剪轨迹相交时，夹击最近的标记敌人。",
    "weapon",
    { event: "scissorPathsCrossed", weaponId: "scissors" },
    [{ kind: "crossCutMarked", target: "nearest" }],
    ["craft", "blade", "mark"],
  ),
  perk(
    "ninePearl",
    "九珠清账",
    "同一目标吃到第九粒算珠时，触发三排珠。",
    "weapon",
    {
      event: "sameTargetPearlHit",
      weaponId: "abacus",
      every: 9,
      counterScope: "target",
    },
    [{ kind: "releasePearlRows", count: 3, target: "firstTarget" }],
    ["ledger"],
  ),
  perk(
    "thirdVolleyTurret",
    "三轮架弩",
    "每第三轮齐射留下一座持续4秒的地面弩台。",
    "weapon",
    {
      event: "crossbowVolleyCompleted",
      weaponId: "crossbow",
      every: 3,
      counterScope: "weapon",
    },
    [{ kind: "placeTemporaryTurret", durationSeconds: 4, count: 1 }],
    ["mechanism"],
  ),
  perk(
    "lastNoteReturn",
    "末音回拨",
    "泛音末跳以60%威力回到首目标一次。",
    "weapon",
    { event: "musicChainCompleted", weaponId: "pipa" },
    [
      {
        kind: "returnChainToFirst",
        value: 0.6,
        count: 1,
        target: "firstTarget",
      },
    ],
    ["music"],
  ),
  perk(
    "inkCrossStay",
    "交线留墨",
    "墨线多留1.5秒，交点同时触发一次墨爆。",
    "weapon",
    { event: "inkLinesCrossed", weaponId: "inkline" },
    [
      {
        kind: "extendInkAndBurstCross",
        durationSeconds: 1.5,
        count: 1,
      },
    ],
    ["craft"],
  ),
  perk(
    "lanternStoredFire",
    "灯灭存火",
    "影人消散时储一格灯火，下次灯格复制一次攻击。",
    "weapon",
    { event: "summonExpired", weaponId: "lantern" },
    [{ kind: "storeLanternFire", count: 1, maxActive: 1 }],
    ["shadow", "fire"],
  ),
  perk(
    "thunderRelay",
    "雷脚接线",
    "雷链末点留下持续3秒的接雷点。",
    "weapon",
    { event: "lightningChainCompleted", weaponId: "thunderSeal" },
    [{ kind: "leaveLightningRelay", durationSeconds: 3, count: 1 }],
    ["lightning", "spirit"],
  ),

  // 器盘走法：只改变游标、节点与收势的行走顺序。
  perk(
    "reverseCycle",
    "倒走一圈",
    "下一圈器盘游标改为反向行走。",
    "weave",
    { event: "weaveCycleStarted" },
    [{ kind: "reverseNextCycle", count: 1 }],
    ["wind"],
  ),
  perk(
    "dualCursor",
    "两头对走",
    "增加一个反向器盘游标；两个游标各保留55%效果。",
    "weave",
    { event: "weaveCycleStarted" },
    [{ kind: "addCounterCursor", count: 1, value: 0.55 }],
    ["spirit"],
  ),
  perk(
    "emptySlotCharge",
    "空位蓄力",
    "器盘游标经过空位时，为下一个节点蓄20%效果。",
    "weave",
    { event: "weaveNodePassed", minValue: 1 },
    [{ kind: "chargeNextNode", value: 0.2, target: "nextNode" }],
    ["mechanism"],
  ),
  perk(
    "everyThirdBack",
    "隔位回头",
    "每经过第三个节点，让前一个节点再执行一次。",
    "weave",
    { event: "weaveNodePassed", every: 3, counterScope: "global" },
    [{ kind: "repeatPreviousNode", count: 1 }],
    ["shadow"],
  ),
  perk(
    "firstNodeTwice",
    "头器再过",
    "每圈首节点执行两次。",
    "weave",
    { event: "weaveCycleStarted" },
    [{ kind: "repeatFirstNode", count: 1 }],
    ["mechanism"],
  ),
  perk(
    "slowHeavyFinish",
    "慢转重收",
    "器盘周期延长40%；收势后0.8秒以55%威力重放。",
    "weave",
    { event: "weaveFinishReleased" },
    [
      { kind: "scaleCycleAndFinish", value: 1.4, secondaryValue: 1 },
      { kind: "replayFinish", value: 0.55, durationSeconds: 0.8, count: 1 },
    ],
    ["guard"],
  ),
  perk(
    "fastLightFinish",
    "快转轻收",
    "器盘周期缩短25%，收势伤害降低20%。",
    "weave",
    { event: "weaveCycleStarted" },
    [{ kind: "scaleCycleAndFinish", value: 0.75, secondaryValue: 0.8 }],
    ["wind"],
  ),
  perk(
    "carryFinish",
    "余劲留盘",
    "收势的30%威力留给下一圈首节点。",
    "weave",
    { event: "weaveFinishReleased" },
    [{ kind: "carryFinishDamage", value: 0.3, target: "nextNode" }],
    ["spirit"],
  ),

  // 四时变化：通过具体掉落、天气和区域事件改变战场。
  perk(
    "springHealingLeaf",
    "新芽拾药",
    "拾取12个高档经验结后生一片恢复叶；20秒内最多存在1片。",
    "season",
    {
      event: "highTierPickupCollected",
      every: 12,
      cooldownSeconds: 20,
      counterScope: "global",
      season: "spring",
    },
    [{ kind: "spawnHealingLeaf", count: 1, maxActive: 1 }],
    ["spirit"],
  ),
  perk(
    "rainMergePearls",
    "雨水并珠",
    "雨时低值经验会更快合并，并更早开始吸附。",
    "season",
    { event: "pickupCreated", maxValue: 2, season: "spring" },
    [{ kind: "acceleratePickupMerge", value: 1.8, radius: 190 }],
    ["rain"],
  ),
  perk(
    "lotusConduct",
    "荷面导电",
    "持续区域命中敌人时，可把雷传给附近1个目标。",
    "season",
    { event: "zoneHit", season: "summer" },
    [{ kind: "conductLightningFromZone", count: 1, target: "nearest" }],
    ["rain", "lightning"],
  ),
  perk(
    "summerWindShot",
    "暑风推弹",
    "弹体穿过暑风后加速，并延长飞行时间。",
    "season",
    { event: "projectileCrossedWeather", season: "summer" },
    [
      {
        kind: "accelerateAndExtendProjectile",
        value: 1.35,
        durationSeconds: 0.6,
      },
    ],
    ["wind"],
  ),
  perk(
    "harvestBundle",
    "稻熟并收",
    "近距离连续击倒一群敌人时，把掉落结成一个高档经验结。",
    "season",
    { event: "multiKill", minValue: 3, season: "autumn" },
    [{ kind: "bundleKillDrops", count: 1, radius: 150 }],
    ["ledger"],
  ),
  perk(
    "autumnSweep",
    "秋风扫场",
    "每15秒把远处掉落扫向玩家。",
    "season",
    { event: "interval", cooldownSeconds: 15, season: "autumn" },
    [{ kind: "sweepDistantPickups", radius: 520 }],
    ["wind"],
  ),
  perk(
    "winterLanternWard",
    "冬灯护纸",
    "走马灯在场时，每20秒获得一次挡伤。",
    "season",
    {
      event: "interval",
      cooldownSeconds: 20,
      requiredWeaponId: "lantern",
      season: "winter",
    },
    [{ kind: "grantLanternGuard", count: 1, maxActive: 1 }],
    ["shadow", "guard"],
  ),
  perk(
    "frostEntrySlow",
    "霜线留步",
    "敌人首次进入墨线或持续区域时短暂减速；每个目标分别计冷却。",
    "season",
    {
      event: "enemyEnteredZone",
      cooldownSeconds: 3,
      counterScope: "target",
      season: "winter",
    },
    [{ kind: "slowFirstZoneEntry", value: 0.35, durationSeconds: 1.2 }],
    ["frost", "craft"],
  ),

  // 行旅自保：围绕拾取、形态与移动状态提供可读的生存窗口。
  perk(
    "highPickupWind",
    "拾珠回风",
    "拾取高档经验结时，发出一阵短风推开近敌。",
    "journey",
    { event: "highTierPickupCollected" },
    [{ kind: "emitPickupWind", radius: 132, durationSeconds: 0.3 }],
    ["wind", "guard"],
  ),
  perk(
    "lastPaperGuard",
    "破纸护命",
    "每90秒可把一次致命伤压到1点生命，并获得1秒无敌。",
    "journey",
    { event: "lethalDamage", cooldownSeconds: 90 },
    [
      {
        kind: "preventLethalDamage",
        value: 1,
        durationSeconds: 1,
      },
    ],
    ["guard"],
  ),
  perk(
    "humanSteady",
    "人形稳手",
    "展开成人形后的0.5秒获得一次受击减免窗口。",
    "journey",
    { event: "formChanged", form: "human" },
    [{ kind: "grantHumanGuard", durationSeconds: 0.5, count: 1 }],
    ["guard"],
  ),
  perk(
    "planeCharge",
    "飞行蓄势",
    "保持纸飞机形态3秒，强化下一次标志攻击。",
    "journey",
    { event: "formDuration", form: "plane", afterSeconds: 3 },
    [{ kind: "empowerNextSignatureAttack", value: 1.35, count: 1 }],
    ["wind", "mark"],
  ),
  perk(
    "sharpTurnPush",
    "急转卸力",
    "急转并展开时推开近敌；该效果有独立冷却。",
    "journey",
    { event: "sharpTurn", cooldownSeconds: 3 },
    [{ kind: "pushOnSharpTurn", radius: 138 }],
    ["wind", "guard"],
  ),
  perk(
    "idleRecovery",
    "止步养息",
    "停步0.8秒后缓慢回复；移动立即中断。",
    "journey",
    { event: "idleDuration", afterSeconds: 0.8, form: "human" },
    [{ kind: "healWhileIdle", value: 0.2 }],
    ["spirit"],
  ),
] as const satisfies readonly EndlessPerkDefinition[];

const BASE_PERKS_BY_ID = Object.freeze(
  Object.fromEntries(
    ENDLESS_PERK_DEFINITIONS.map((definition) => [definition.id, definition]),
  ) as Record<EndlessPerkPageId, EndlessPerkDefinition>,
);

type BranchCopy = {
  pageId: EndlessPerkPageId;
  a: readonly [name: string, description: string];
  b: readonly [name: string, description: string];
};

/**
 * Branch A adds another execution to an existing event relationship. Branch B
 * changes its cadence (or its spatial/duration envelope when no cadence exists).
 * The branch therefore always changes a concrete combat event; it is never a
 * detached damage/attack-speed percentage card.
 */
const BRANCH_COPY: readonly BranchCopy[] = [
  { pageId: "swordMarkReturn", a: ["回剑穿印", "折返剑穿过剑印后，再寻一个近敌。"], b: ["倒敌传印", "剑印目标倒下时，回剑更早接向下一敌。"] },
  { pageId: "windDeflectShot", a: ["偏箭寻敌", "借风后的弹体再校一次方向，追向高生命敌。"], b: ["顺风穿透", "弹体借风后加速更久，穿出风带仍不失势。"] },
  { pageId: "umbrellaGap", a: ["格挡推场", "格挡时再推开一层近敌，给伞下留出空当。"], b: ["格挡出雨", "格挡触发得更勤，并延长伞护留下的窗口。"] },
  { pageId: "scissorsCross", a: ["双刃夹击", "剪路相交时，两次夹向最近的带印敌人。"], b: ["断裁续敌", "一次夹剪收尾后，更快接上下一次断裁。"] },
  { pageId: "ninePearl", a: ["九珠结算", "九珠满账后多拨一排算珠。"], b: ["余数外溢", "清账所需珠数减少，余珠更早外溢成排。"] },
  { pageId: "thirdVolleyTurret", a: ["弩台移位", "架弩时多落一台，分开照看两侧。"], b: ["第三轮钉敌", "更少轮次便落下一台短驻弩台。"] },
  { pageId: "lastNoteReturn", a: ["末音折返", "末音回到首敌后再回拨一次。"], b: ["停声留场", "末音落点的回响留得更久，再接一次回拨。"] },
  { pageId: "inkCrossStay", a: ["交点设机关", "墨线交点同时落下两次墨爆。"], b: ["过线重弹", "交墨留场更久，交点可更快再次起效。"] },
  { pageId: "lanternStoredFire", a: ["灯灭存火", "影人消散时多存一格灯火。"], b: ["灯灭存招", "灯格可多留一份消散时记下的攻击。"] },
  { pageId: "thunderRelay", a: ["走雷连脚", "雷链末脚留下两处相接的雷点。"], b: ["止步放雷", "接雷点停留更久，给下一道雷留路。"] },
  { pageId: "reverseCycle", a: ["隔圈倒走", "倒走后再留一圈反向行程。"], b: ["倒走再过收势", "倒走起圈时更快衔接上一轮收势。"] },
  { pageId: "dualCursor", a: ["双标相撞", "两枚游标相向行走时，再补一次对走。"], b: ["双标交换载荷", "对走游标保留更久，并携带更多节点余劲。"] },
  { pageId: "emptySlotCharge", a: ["空位增幅", "空位同时给下一节点叠两次蓄力。"], b: ["空位催邻", "空位所需经过次数减少，更早催动邻器。"] },
  { pageId: "everyThirdBack", a: ["跳格回补", "回头节点再补走一次。"], b: ["跳格串联", "更少经过一格便回头串起前一节点。"] },
  { pageId: "firstNodeTwice", a: ["头器重过", "每圈头器额外再过一次。"], b: ["头器传尾", "头器重过后把更长的余劲留给圈尾。"] },
  { pageId: "slowHeavyFinish", a: ["慢转加重", "慢转收势再重放一次。"], b: ["逐格留劲", "重收等待缩短，逐格留下的力更快汇拢。"] },
  { pageId: "fastLightFinish", a: ["快转多收", "快转起圈再叠一层轻收。"], b: ["第三圈复收", "快转的复收间隔缩短，更早再结一圈。"] },
  { pageId: "carryFinish", a: ["收势作下圈开头", "收势余劲两次送入下一圈首器。"], b: ["余弹绕盘护身", "余劲保留得更久，下一节点更早接手。"] },
  { pageId: "springHealingLeaf", a: ["溢出成护纸", "新芽生出时多落一片可拾恢复叶。"], b: ["拾药长吸附", "更少高档经验便生新芽，吸附窗口也更宽。"] },
  { pageId: "rainMergePearls", a: ["并珠落雨", "雨中经验结再次加快并拢与吸附。"], b: ["大珠分流", "低值珠出现便更早接入合并关系。"] },
  { pageId: "lotusConduct", a: ["雨面串雷", "水场导雷时再串向一个近敌。"], b: ["水场蓄雷", "区域每次命中都更快续上下一道雷。"] },
  { pageId: "summerWindShot", a: ["暑风改道", "暑风中的弹体再改一次方向并延长行程。"], b: ["暑风清弹", "弹体一入暑风便更快完成加速。"] },
  { pageId: "harvestBundle", a: ["连收成结", "成片击倒时多结一份高档经验。"], b: ["击杀聚珠", "较小的一群敌人也能触发并收。"] },
  { pageId: "autumnSweep", a: ["扫场推敌", "秋扫同时再牵一次远处掉落。"], b: ["扫场聚物", "秋扫间隔缩短，远物更早归拢。"] },
  { pageId: "winterLanternWard", a: ["冬灯挡击", "冬灯来时多留一次挡伤。"], b: ["低血添灯", "冬灯更早补上下一层护纸。"] },
  { pageId: "frostEntrySlow", a: ["止步留霜", "敌人入霜时再叠一段减速。"], b: ["急转划霜", "同一敌人的入霜间隔缩短。"] },
  { pageId: "highPickupWind", a: ["拾珠推敌", "拾到高档经验时再推一层近敌。"], b: ["大珠回吸", "回风范围加宽，把更远的包围让开。"] },
  { pageId: "lastPaperGuard", a: ["破纸保命", "护命触发时再延长一次安全窗口。"], b: ["受击留替身", "护命的间隔缩短，仍只把致命伤压到一命。"] },
  { pageId: "humanSteady", a: ["人形稳准", "展开时再添一层短护。"], b: ["人形催器", "人形稳手持续更久，容许下一器接上。"] },
  { pageId: "planeCharge", a: ["飞行落势", "飞行蓄成后多存一次标志攻击。"], b: ["飞行加程", "较短的滑行也能完成一次蓄势。"] },
  { pageId: "sharpTurnPush", a: ["急转短免", "急转时再推一层近敌。"], b: ["急转改弹", "急转卸力的间隔缩短，更快再次清身。"] },
  { pageId: "idleRecovery", a: ["止步回血", "停步时再进行一次缓慢回复。"], b: ["止步冷却", "更短停步便开始养息。"] },
] as const;

function tuneAction(
  action: EndlessPerkAction,
  factor: number,
): EndlessPerkAction {
  return {
    ...action,
    count:
      action.count === undefined ? undefined : Math.max(1, action.count + 1),
    maxActive:
      action.maxActive === undefined
        ? undefined
        : Math.max(1, action.maxActive + 1),
    radius:
      action.radius === undefined ? undefined : action.radius * factor,
    durationSeconds:
      action.durationSeconds === undefined
        ? undefined
        : action.durationSeconds * factor,
  } as EndlessPerkAction;
}

function branchRules(
  base: EndlessPerkDefinition,
  key: "a" | "b",
): readonly EndlessPerkRule[] {
  if (base.id === "swordMarkReturn") {
    return [{
      trigger: { event: "markedTargetKilled", weaponId: "sword", counterScope: "target" },
      actions: key === "a"
        ? [
            { kind: "returnAndRetarget", count: 1, target: "nearest" },
            { kind: "returnAndRetarget", count: 1, target: "nearest" },
          ]
        : [{ kind: "returnAndRetarget", count: 1, target: "highestHp" }],
    }];
  }
  if (base.id === "windDeflectShot") {
    return [{
      trigger: { event: "projectileCrossedWind", requiredWeaponId: "fan" },
      actions: key === "a"
        ? [
            { kind: "retargetAndAccelerate", value: 1.45, target: "highestHp" },
            { kind: "accelerateAndExtendProjectile", value: 1.18, durationSeconds: 0.35 },
          ]
        : [{ kind: "retargetAndAccelerate", value: 1.62, target: "highestHp" }],
    }];
  }
  if (base.id === "umbrellaGap") {
    return [{
      trigger: { event: "guardSucceeded", weaponId: "umbrella", cooldownSeconds: key === "a" ? 0.6 : 0.42 },
      actions: key === "a"
        ? [{ kind: "pushAndGuard", radius: 196, durationSeconds: 0.65, count: 1 }]
        : [
            { kind: "pushAndGuard", radius: 126, durationSeconds: 0.5, count: 1 },
            { kind: "releaseUmbrellaRain", count: 5, target: "nearest" },
          ],
    }];
  }
  if (base.id === "scissorsCross") {
    return [{
      trigger: { event: "scissorPathsCrossed", weaponId: "scissors" },
      actions: key === "a"
        ? [
            { kind: "crossCutMarked", target: "nearest" },
            { kind: "crossCutMarked", target: "highestHp" },
          ]
        : [{ kind: "crossCutMarked", count: 1, target: "highestHp" }],
    }];
  }
  if (base.id === "ninePearl") {
    return [{
      trigger: {
        event: "sameTargetPearlHit",
        weaponId: "abacus",
        every: key === "a" ? 9 : 6,
        counterScope: "target",
      },
      actions: [{ kind: "releasePearlRows", count: key === "a" ? 4 : 2, target: "firstTarget" }],
    }];
  }
  if (base.id === "thirdVolleyTurret") {
    return [{
      trigger: {
        event: "crossbowVolleyCompleted",
        weaponId: "crossbow",
        every: key === "a" ? 3 : 2,
        counterScope: "weapon",
      },
      actions: [{ kind: "placeTemporaryTurret", durationSeconds: key === "a" ? 3.4 : 3, count: key === "a" ? 2 : 1 }],
    }];
  }
  if (base.id === "lastNoteReturn") {
    return [{
      trigger: { event: "musicChainCompleted", weaponId: "pipa" },
      actions: key === "a"
        ? [
            { kind: "returnChainToFirst", value: 0.62, count: 1, target: "firstTarget" },
            { kind: "returnChainToFirst", value: 0.46, count: 1, target: "firstTarget" },
          ]
        : [
            { kind: "returnChainToFirst", value: 0.5, count: 1, target: "firstTarget" },
            { kind: "leaveEchoField", durationSeconds: 2.6, count: 1 },
          ],
    }];
  }
  if (base.id === "inkCrossStay") {
    return [{
      trigger: { event: "inkLinesCrossed", weaponId: "inkline", cooldownSeconds: key === "a" ? 0 : 0.7 },
      actions: key === "a"
        ? [
            { kind: "extendInkAndBurstCross", durationSeconds: 1.4, count: 1 },
            { kind: "extendInkAndBurstCross", durationSeconds: 1.1, count: 1 },
          ]
        : [{ kind: "extendInkAndBurstCross", durationSeconds: 3.1, count: 1 }],
    }];
  }
  if (base.id === "lanternStoredFire") {
    return [{
      trigger: { event: "summonExpired", weaponId: "lantern" },
      actions: key === "a"
        ? [{ kind: "storeLanternFire", count: 2, maxActive: 2 }]
        : [
            { kind: "storeLanternFire", count: 1, maxActive: 3 },
            { kind: "empowerNextSignatureAttack", value: 1.24, count: 1 },
          ],
    }];
  }
  if (base.id === "thunderRelay" && key === "a") {
    return [{
      trigger: { event: "lightningChainCompleted", weaponId: "thunderSeal" },
      actions: [
        { kind: "leaveLightningRelay", durationSeconds: 3, count: 1 },
        { kind: "leaveLightningRelay", durationSeconds: 2.2, count: 1 },
      ],
    }];
  }
  if (base.id === "thunderRelay" && key === "b") {
    return [{
      trigger: { event: "idleDuration", afterSeconds: 0.8, form: "human", cooldownSeconds: 3 },
      actions: [{ kind: "leaveLightningRelay", durationSeconds: 2.4, count: 1 }],
    }];
  }
  if (base.id === "reverseCycle") {
    return key === "a"
      ? [{ trigger: { event: "weaveCycleStarted", every: 2, counterScope: "global" }, actions: [{ kind: "reverseNextCycle", count: 1 }, { kind: "addCounterCursor", value: 0.36, count: 1 }] }]
      : [{ trigger: { event: "weaveFinishReleased" }, actions: [{ kind: "replayFinish", value: 0.34, durationSeconds: 0.5, count: 1 }] }];
  }
  if (base.id === "dualCursor") {
    return key === "a"
      ? [{ trigger: { event: "weaveCycleStarted" }, actions: [{ kind: "addCounterCursor", count: 1, value: 0.72 }] }]
      : [{ trigger: { event: "weaveNodePassed", every: 2, counterScope: "global" }, actions: [{ kind: "carryFinishDamage", value: 0.16, target: "nextNode" }] }];
  }
  if (base.id === "emptySlotCharge") {
    return key === "a"
      ? [{ trigger: { event: "weaveNodePassed", minValue: 1 }, actions: [{ kind: "chargeNextNode", value: 0.42, target: "nextNode" }] }]
      : [{ trigger: { event: "weaveNodePassed", minValue: 1 }, actions: [{ kind: "chargeNextNode", value: 0.2, target: "nextNode" }, { kind: "repeatPreviousNode", count: 1 }] }];
  }
  if (base.id === "everyThirdBack") {
    return key === "a"
      ? [{ trigger: { event: "weaveNodePassed", every: 3, counterScope: "global" }, actions: [{ kind: "repeatPreviousNode", count: 1 }, { kind: "repeatPreviousNode", count: 1 }] }]
      : [{ trigger: { event: "weaveNodePassed", every: 2, counterScope: "global" }, actions: [{ kind: "repeatPreviousNode", count: 1 }, { kind: "chargeNextNode", value: 0.14, target: "nextNode" }] }];
  }
  if (base.id === "firstNodeTwice") {
    return key === "a"
      ? [{ trigger: { event: "weaveCycleStarted" }, actions: [{ kind: "repeatFirstNode", count: 2 }] }]
      : [{ trigger: { event: "weaveCycleStarted" }, actions: [{ kind: "repeatFirstNode", count: 1 }, { kind: "carryFinishDamage", value: 0.2, target: "nextNode" }] }];
  }
  if (base.id === "slowHeavyFinish") {
    return key === "a"
      ? [{ trigger: { event: "weaveFinishReleased" }, actions: [{ kind: "replayFinish", value: 0.72, durationSeconds: 0.9, count: 1 }] }]
      : [{ trigger: { event: "weaveNodePassed" }, actions: [{ kind: "chargeNextNode", value: 0.08, target: "nextNode" }] }];
  }
  if (base.id === "fastLightFinish") {
    return key === "a"
      ? [{ trigger: { event: "weaveCycleStarted" }, actions: [{ kind: "scaleCycleAndFinish", value: 0.68, secondaryValue: 0.78 }] }]
      : [{ trigger: { event: "weaveFinishReleased", every: 3, counterScope: "global" }, actions: [{ kind: "replayFinish", value: 0.4, durationSeconds: 0.25, count: 1 }] }];
  }
  if (base.id === "carryFinish") {
    return key === "a"
      ? [{ trigger: { event: "weaveFinishReleased" }, actions: [{ kind: "carryFinishDamage", value: 0.52, target: "nextNode" }] }]
      : [{ trigger: { event: "weaveFinishReleased" }, actions: [{ kind: "grantHumanGuard", durationSeconds: 0.55, count: 1 }] }];
  }
  if (base.id === "springHealingLeaf") {
    return [{
      trigger: {
        event: "highTierPickupCollected",
        every: key === "a" ? 12 : 8,
        cooldownSeconds: key === "a" ? 20 : 16,
        counterScope: "global",
        season: "spring",
      },
      actions: key === "a"
        ? [
            { kind: "spawnHealingLeaf", count: 1, maxActive: 2 },
            { kind: "grantHumanGuard", durationSeconds: 0.45, count: 1 },
          ]
        : [{ kind: "spawnHealingLeaf", count: 1, maxActive: 1 }],
    }];
  }
  if (base.id === "rainMergePearls") {
    return [{
      trigger: { event: "pickupCreated", maxValue: key === "a" ? 3 : 2, season: "spring" },
      actions: key === "a"
        ? [
            { kind: "acceleratePickupMerge", value: 1.9, radius: 210 },
            { kind: "acceleratePickupMerge", value: 1.25, radius: 245 },
          ]
        : [{ kind: "acceleratePickupMerge", value: 2.35, radius: 270 }],
    }];
  }
  if (base.id === "lotusConduct") {
    return [{
      trigger: { event: "zoneHit", season: "summer", every: key === "a" ? 1 : 2, counterScope: "target" },
      actions: key === "a"
        ? [
            { kind: "conductLightningFromZone", count: 1, target: "nearest" },
            { kind: "conductLightningFromZone", count: 1, target: "highestHp" },
          ]
        : [
            { kind: "conductLightningFromZone", count: 1, target: "nearest" },
            { kind: "leaveLightningRelay", durationSeconds: 1.8, count: 1 },
          ],
    }];
  }
  if (base.id === "summerWindShot") {
    return [{
      trigger: { event: "projectileCrossedWeather", season: "summer" },
      actions: key === "a"
        ? [
            { kind: "retargetAndAccelerate", value: 1.18, target: "highestHp" },
            { kind: "accelerateAndExtendProjectile", value: 1.28, durationSeconds: 0.8 },
          ]
        : [
            { kind: "accelerateAndExtendProjectile", value: 1.7, durationSeconds: 0.45 },
            { kind: "emitPickupWind", radius: 116, durationSeconds: 0.2 },
          ],
    }];
  }
  if (base.id === "harvestBundle") {
    return [{
      trigger: { event: "multiKill", minValue: key === "a" ? 3 : 2, season: "autumn" },
      actions: key === "a"
        ? [
            { kind: "bundleKillDrops", count: 1, radius: 178 },
            { kind: "sweepDistantPickups", radius: 420 },
          ]
        : [{ kind: "bundleKillDrops", count: 1, radius: 132 }],
    }];
  }
  if (base.id === "autumnSweep") {
    return [{
      trigger: { event: "interval", cooldownSeconds: key === "a" ? 15 : 9, season: "autumn" },
      actions: key === "a"
        ? [
            { kind: "sweepDistantPickups", radius: 570 },
            { kind: "emitPickupWind", radius: 168, durationSeconds: 0.28 },
          ]
        : [{ kind: "sweepDistantPickups", radius: 460 }],
    }];
  }
  if (base.id === "winterLanternWard") {
    return [{
      trigger: {
        event: "interval",
        cooldownSeconds: key === "a" ? 20 : 12,
        requiredWeaponId: "lantern",
        season: "winter",
      },
      actions: [{ kind: "grantLanternGuard", count: key === "a" ? 2 : 1, maxActive: key === "a" ? 2 : 1 }],
    }];
  }
  if (base.id === "frostEntrySlow") {
    return [{
      trigger: {
        event: "enemyEnteredZone",
        cooldownSeconds: key === "a" ? 3 : 1.2,
        counterScope: "target",
        season: "winter",
      },
      actions: key === "a"
        ? [
            { kind: "slowFirstZoneEntry", value: 0.42, durationSeconds: 1.8 },
            { kind: "slowFirstZoneEntry", value: 0.28, durationSeconds: 1.2 },
          ]
        : [{ kind: "slowFirstZoneEntry", value: 0.32, durationSeconds: 1.1 }],
    }];
  }
  if (base.id === "highPickupWind") {
    return [{
      trigger: { event: "highTierPickupCollected" },
      actions: key === "a"
        ? [
            { kind: "emitPickupWind", radius: 148, durationSeconds: 0.32 },
            { kind: "emitPickupWind", radius: 196, durationSeconds: 0.22 },
          ]
        : [
            { kind: "emitPickupWind", radius: 218, durationSeconds: 0.28 },
            { kind: "pullDistantPickups", value: 0.46, radius: 420 },
          ],
    }];
  }
  if (base.id === "lastPaperGuard") {
    return [{
      trigger: { event: "lethalDamage", cooldownSeconds: key === "a" ? 90 : 58 },
      actions: key === "a"
        ? [
            { kind: "preventLethalDamage", value: 1, durationSeconds: 1.35 },
            { kind: "grantHumanGuard", durationSeconds: 0.45, count: 1 },
          ]
        : [{ kind: "preventLethalDamage", value: 1, durationSeconds: 0.8 }],
    }];
  }
  if (base.id === "humanSteady") {
    return [{
      trigger: { event: "formChanged", form: "human" },
      actions: key === "a"
        ? [{ kind: "grantHumanGuard", durationSeconds: 0.62, count: 2 }]
        : [
            { kind: "grantHumanGuard", durationSeconds: 0.42, count: 1 },
            { kind: "empowerNextSignatureAttack", value: 1.2, count: 1 },
          ],
    }];
  }
  if (base.id === "planeCharge") {
    return [{
      trigger: { event: "formDuration", form: "plane", afterSeconds: key === "a" ? 3 : 1.8 },
      actions: [{ kind: "empowerNextSignatureAttack", value: key === "a" ? 1.34 : 1.18, count: key === "a" ? 2 : 1 }],
    }];
  }
  if (base.id === "sharpTurnPush") {
    return [{
      trigger: { event: "sharpTurn", cooldownSeconds: key === "a" ? 3 : 1.6 },
      actions: key === "a"
        ? [
            { kind: "pushOnSharpTurn", radius: 156 },
            { kind: "grantHumanGuard", durationSeconds: 0.3, count: 1 },
          ]
        : [
            { kind: "pushOnSharpTurn", radius: 128 },
            { kind: "empowerNextSignatureAttack", value: 1.16, count: 1 },
          ],
    }];
  }
  if (base.id === "idleRecovery") {
    return [{
      trigger: { event: "idleDuration", afterSeconds: key === "a" ? 0.8 : 0.42, form: "human" },
      actions: key === "a"
        ? [
            { kind: "healWhileIdle", value: 0.32 },
            { kind: "grantHumanGuard", durationSeconds: 0.28, count: 1 },
          ]
        : [
            { kind: "healWhileIdle", value: 0.12 },
            { kind: "empowerNextSignatureAttack", value: 1.12, count: 1 },
          ],
    }];
  }
  if (key === "a") {
    return base.rules.map((rule) => ({
      trigger: { ...rule.trigger },
      actions: rule.actions.flatMap((action) => [
        action,
        tuneAction(action, 1.12),
      ]),
    }));
  }
  return base.rules.map((rule) => {
    const trigger = { ...rule.trigger };
    if (trigger.every !== undefined) {
      trigger.every = Math.max(1, Math.floor(trigger.every * 0.68));
    } else if (trigger.cooldownSeconds !== undefined) {
      trigger.cooldownSeconds = Math.max(0.25, trigger.cooldownSeconds * 0.68);
    } else if (trigger.afterSeconds !== undefined) {
      trigger.afterSeconds = Math.max(0.2, trigger.afterSeconds * 0.68);
    }
    return {
      trigger,
      actions: rule.actions.map((action) => tuneAction(action, 1.32)),
    };
  });
}

export const ENDLESS_PERK_BRANCH_DEFINITIONS = BRANCH_COPY.flatMap((copy) => {
  const base = BASE_PERKS_BY_ID[copy.pageId];
  return (["a", "b"] as const).map((key) => ({
    id: `${copy.pageId}:${key}` as EndlessPerkBranchId,
    name: copy[key][0],
    description: copy[key][1],
    category: base.category,
    maxRank: 1,
    weight: 1,
    tags: base.tags,
    rules: branchRules(base, key),
    choiceKind: "branch" as const,
    parentPageId: copy.pageId,
    branchKey: key,
  }));
}) satisfies readonly EndlessPerkDefinition[];

function pair(
  id: EndlessPerkPairId,
  name: string,
  description: string,
  pages: readonly [EndlessPerkPageId, EndlessPerkPageId],
  rules: readonly EndlessPerkRule[],
  tags: readonly EffectTag[],
): EndlessPerkDefinition {
  return {
    id,
    name,
    description,
    category: BASE_PERKS_BY_ID[pages[0]].category,
    maxRank: 1,
    weight: 1.15,
    tags,
    rules,
    choiceKind: "pair",
    requiredPageIds: pages,
  };
}

export const ENDLESS_PERK_PAIR_DEFINITIONS = [
  pair("pairSwordWind", "剑印借风合页", "剑印倒敌后，回剑两次改向近敌。", ["swordMarkReturn", "windDeflectShot"], [{ trigger: { event: "markedTargetKilled", weaponId: "sword" }, actions: [{ kind: "returnAndRetarget", count: 1 }, { kind: "returnAndRetarget", count: 1 }] }], ["blade", "wind", "mark"]),
  pair("pairUmbrellaThunder", "伞挡走雷合页", "格挡推开近敌，并在近敌脚下留下接雷点。", ["umbrellaGap", "thunderRelay"], [{ trigger: { event: "guardSucceeded", weaponId: "umbrella", cooldownSeconds: 0.5 }, actions: [{ kind: "pushAndGuard", radius: 164, durationSeconds: 0.7, count: 1 }, { kind: "leaveLightningRelay", durationSeconds: 3.5 }] }], ["guard", "rain", "lightning"]),
  pair("pairScissorsLedger", "剪口清账合页", "双剪交口时，夹剪带印敌并拨出一排算珠。", ["scissorsCross", "ninePearl"], [{ trigger: { event: "scissorPathsCrossed", weaponId: "scissors" }, actions: [{ kind: "crossCutMarked" }, { kind: "releasePearlRows", count: 1 }] }], ["blade", "craft", "ledger"]),
  pair("pairCrossbowLantern", "三轮灯火合页", "第三轮齐射落弩台，同时存下一格灯火。", ["thirdVolleyTurret", "lanternStoredFire"], [{ trigger: { event: "crossbowVolleyCompleted", weaponId: "crossbow", every: 3, counterScope: "weapon" }, actions: [{ kind: "placeTemporaryTurret", durationSeconds: 4, count: 1 }, { kind: "storeLanternFire", count: 1, maxActive: 2 }] }], ["mechanism", "shadow", "fire"]),
  pair("pairMusicInk", "末音墨线合页", "末音回拨后，在首敌脚下留下一处墨爆。", ["lastNoteReturn", "inkCrossStay"], [{ trigger: { event: "musicChainCompleted", weaponId: "pipa" }, actions: [{ kind: "returnChainToFirst", value: 0.6, count: 1 }, { kind: "extendInkAndBurstCross", durationSeconds: 1.2 }] }], ["music", "craft"]),
  pair("pairReverseDual", "倒走双标合页", "每圈反向起步，并添一枚对走游标。", ["reverseCycle", "dualCursor"], [{ trigger: { event: "weaveCycleStarted" }, actions: [{ kind: "reverseNextCycle", count: 1 }, { kind: "addCounterCursor", count: 1, value: 0.5 }] }], ["wind", "spirit"]),
  pair("pairEmptyFirst", "空位头器合页", "经过空位时蓄力下一器，并让头器再过一次。", ["emptySlotCharge", "firstNodeTwice"], [{ trigger: { event: "weaveNodePassed", minValue: 1 }, actions: [{ kind: "chargeNextNode", value: 0.24, target: "nextNode" }, { kind: "repeatFirstNode", count: 1 }] }], ["mechanism"]),
  pair("pairBackCarry", "跳格余劲合页", "每第三格回补前器，并把一段余劲送往下一器。", ["everyThirdBack", "carryFinish"], [{ trigger: { event: "weaveNodePassed", every: 3, counterScope: "global" }, actions: [{ kind: "repeatPreviousNode", count: 1 }, { kind: "carryFinishDamage", value: 0.2, target: "nextNode" }] }], ["shadow", "spirit"]),
  pair("pairSlowFrost", "慢转霜线合页", "慢收势重放一次；敌人初入霜域时另受减速。", ["slowHeavyFinish", "frostEntrySlow"], [{ trigger: { event: "weaveFinishReleased" }, actions: [{ kind: "replayFinish", value: 0.48, durationSeconds: 0.65, count: 1 }] }, { trigger: { event: "enemyEnteredZone", cooldownSeconds: 2.5, counterScope: "target" }, actions: [{ kind: "slowFirstZoneEntry", value: 0.35, durationSeconds: 1.35 }] }], ["guard", "frost"]),
  pair("pairFastSummer", "快转暑风合页", "器盘快转；穿过暑风的弹体同时加速并延长行程。", ["fastLightFinish", "summerWindShot"], [{ trigger: { event: "weaveCycleStarted" }, actions: [{ kind: "scaleCycleAndFinish", value: 0.8, secondaryValue: 0.86 }] }, { trigger: { event: "projectileCrossedWeather", season: "summer" }, actions: [{ kind: "accelerateAndExtendProjectile", value: 1.3, durationSeconds: 0.55 }] }], ["wind"]),
  pair("pairSpringRain", "新芽雨水合页", "拾足高档经验生恢复叶；低值经验随雨更快并拢。", ["springHealingLeaf", "rainMergePearls"], [{ trigger: { event: "highTierPickupCollected", every: 10, cooldownSeconds: 18, counterScope: "global", season: "spring" }, actions: [{ kind: "spawnHealingLeaf", count: 1, maxActive: 1 }] }, { trigger: { event: "pickupCreated", maxValue: 2, season: "spring" }, actions: [{ kind: "acceleratePickupMerge", value: 1.9, radius: 205 }] }], ["spirit", "rain"]),
  pair("pairLotusWinter", "荷面冬灯合页", "水场导雷时，也为冬灯添一次短护。", ["lotusConduct", "winterLanternWard"], [{ trigger: { event: "zoneHit", season: "summer" }, actions: [{ kind: "conductLightningFromZone", count: 1, target: "nearest" }, { kind: "grantLanternGuard", count: 1, maxActive: 1 }] }], ["rain", "lightning", "guard"]),
  pair("pairHarvestAutumn", "稻收秋扫合页", "成片击倒后并珠，并把远处掉落扫向收束点。", ["harvestBundle", "autumnSweep"], [{ trigger: { event: "multiKill", minValue: 3, season: "autumn" }, actions: [{ kind: "bundleKillDrops", count: 1, radius: 170 }, { kind: "sweepDistantPickups", radius: 560 }] }], ["ledger", "wind"]),
  pair("pairPickupPlane", "拾珠飞行合页", "拾到高档经验时推开近敌，并存下一次标志攻击。", ["highPickupWind", "planeCharge"], [{ trigger: { event: "highTierPickupCollected" }, actions: [{ kind: "emitPickupWind", radius: 144 }, { kind: "empowerNextSignatureAttack", value: 1.28, count: 1 }] }], ["wind", "guard", "mark"]),
  pair("pairGuardTurn", "护命急转合页", "急转推敌并添短护；致命伤仍由护命页单独判定。", ["lastPaperGuard", "sharpTurnPush"], [{ trigger: { event: "sharpTurn", cooldownSeconds: 2.5 }, actions: [{ kind: "pushOnSharpTurn", radius: 150 }, { kind: "grantHumanGuard", durationSeconds: 0.35, count: 1 }] }], ["guard", "wind"]),
  pair("pairHumanIdle", "人形止步合页", "展开并止步后，一边缓慢回复，一边留下短护。", ["humanSteady", "idleRecovery"], [{ trigger: { event: "idleDuration", afterSeconds: 0.7, form: "human" }, actions: [{ kind: "healWhileIdle", value: 0.18 }, { kind: "grantHumanGuard", durationSeconds: 0.35, count: 1 }] }], ["guard", "spirit"]),
] as const satisfies readonly EndlessPerkDefinition[];

export const ALL_ENDLESS_PERK_DEFINITIONS: readonly EndlessPerkDefinition[] = [
  ...ENDLESS_PERK_DEFINITIONS,
  ...ENDLESS_PERK_BRANCH_DEFINITIONS,
  ...ENDLESS_PERK_PAIR_DEFINITIONS,
];

export const ENDLESS_PERKS_BY_ID: Readonly<
  Record<EndlessPerkId, EndlessPerkDefinition>
> = Object.freeze(
  Object.fromEntries(
    ALL_ENDLESS_PERK_DEFINITIONS.map((definition) => [definition.id, definition]),
  ) as Record<EndlessPerkId, EndlessPerkDefinition>,
);

export function getEndlessPerkDefinition(
  id: EndlessPerkId,
): EndlessPerkDefinition {
  return ENDLESS_PERKS_BY_ID[id];
}
