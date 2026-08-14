import { CELESTIAL_INTRUSIONS } from "../content/celestials";
import { DIFFICULTIES, DIFFICULTY_IDS } from "../content/difficulty";
import {
  ENDLESS_PERK_BRANCH_DEFINITIONS,
  ENDLESS_PERK_DEFINITIONS,
  ENDLESS_PERK_PAIR_DEFINITIONS,
} from "../content/endlessPerks";
import { ENEMY_DEFINITIONS } from "../content/enemies";
import { FUSION_DEFINITIONS } from "../content/fusions";
import {
  CELESTIAL_RULES,
  ENDLESS_RULES,
  FORM_RULES,
  PROGRESSION_RULES,
  WEAVE_RULES,
} from "../content/rules";
import { SYNERGY_DEFINITIONS } from "../content/synergies";
import { TRAVEL_NOTE_DEFINITIONS } from "../content/travelNotes";
import type { EffectSpec } from "../content/types";
import { WEAPON_DEFINITIONS } from "../content/weapons";
import { SOLAR_TERMS } from "../world/solarTerms";

export type GuideSectionId =
  | "start"
  | "standard-run"
  | "paper-form"
  | "progression"
  | "weapons"
  | "synergies"
  | "enemies"
  | "seasons"
  | "difficulty"
  | "endless"
  | "fusions"
  | "celestials"
  | "perk-book"
  | "endless-scaling"
  | "glossary";

export type GuideOpenRequest = {
  section: GuideSectionId;
  anchor?: string;
  detail?: "summary" | "exact";
};

export type GuideRow = readonly string[];
export type GuideSection = {
  id: GuideSectionId;
  title: string;
  summary: string;
  paragraphs?: readonly string[];
  exactParagraphs?: readonly string[];
  bullets?: readonly string[];
  table?: { columns: readonly string[]; rows: readonly GuideRow[] };
  tableDetail?: "summary" | "exact";
  details?: readonly { title: string; body: readonly string[] }[];
  diagram?: "upgrade" | "fold" | "weave" | "curve";
  searchText: string;
};
export type GuideDocument = {
  title: string;
  subtitle: string;
  sections: readonly GuideSection[];
  coverage: Record<string, number>;
};

function seconds(value: number) {
  return `${Number(value.toFixed(3))} 秒`;
}

function describeEffect(effect: EffectSpec): string {
  switch (effect.kind) {
    case "projectile":
      return `投射：伤害 ${effect.damage}，间隔 ${seconds(effect.cooldown)}，数量 ${effect.count}，穿透 ${effect.pierce}，速度 ${effect.speed}`;
    case "orbit":
      return `环绕：伤害 ${effect.damage}，数量 ${effect.count}，半径 ${effect.radius}，同目标间隔 ${seconds(effect.hitCooldown)}`;
    case "chain":
      return `连锁：伤害 ${effect.damage}，最多 ${effect.jumps} 跳，跳距 ${effect.range}`;
    case "zone":
      return `区域：每秒伤害 ${effect.damagePerSecond}，半径 ${effect.radius}，持续 ${seconds(effect.duration)}`;
    case "summon":
      return `召唤：数量 ${effect.count}，持续 ${seconds(effect.duration)}，单次伤害 ${effect.attackDamage}，出手间隔 ${seconds(effect.attackCooldown)}`;
    case "delayed":
      return `延迟落点：伤害 ${effect.damage}，延迟 ${seconds(effect.delay)}，半径 ${effect.radius}`;
    case "mark":
      return `留印：持续 ${seconds(effect.duration)}，承伤倍率 ${effect.damageTakenMultiplier}`;
    case "execute":
      return `断裁：普通敌低于 ${(effect.threshold * 100).toFixed(0)}% 时触发，首领阈值 ${(effect.bossThreshold * 100).toFixed(0)}%`;
    case "accumulator":
      return `蓄积：累计 ${effect.required} 次后触发后续动作`;
    case "copy":
      return `照样：重演一次核心攻击，威力倍率 ${effect.damageMultiplier}`;
    case "beam":
      return `光束：伤害 ${effect.damage}，长度 ${effect.length}，宽度 ${effect.width}，持续 ${seconds(effect.duration)}`;
    case "lightning":
      return `落雷：伤害 ${effect.damage}，落点 ${effect.strikes}，半径 ${effect.radius}`;
  }
}

const enemyPresentation: Record<string, readonly string[]> = {
  cup: ["青花茶盏精", "分段跳近；落地震纹出现前离开小圈。"],
  shoe: ["绣鞋灵", "成双侧移后交叉冲过；朱砂路径锁定后不再追踪。"],
  lantern: ["灯笼虫", "保持距离发出慢火；从火珠之间的宽缝穿过。"],
  fish: ["纸鸢锦鲤", "沿弧线掠过后离场；不要追着鱼尾移动。"],
  abacus: ["蟹足算盘精", "侧向绕行，按三珠、五珠节拍排射。"],
  rib: ["残伞骨怪", "短跃撑伞，为附近敌人挡住一个方向。"],
  lion: ["狮头木偶", "直线冲撞后吼叫催促敌群；收势时是反击窗口。"],
  puppet: ["提线伶偶", "先放出可见丝线，越线后才会合拢。"],
};

const weaponDetails = WEAPON_DEFINITIONS.map((weapon) => ({
  title: weapon.name,
  body: [
    weapon.description,
    `基础：${weapon.baseEffects.map(describeEffect).join("；")}`,
    `做细：${weapon.refinedEffects.map(describeEffect).join("；")}`,
    ...weapon.routes.map(
      (route) =>
        `${route.name}：${route.description}。定型可选「${route.masteries[0].name}」或「${route.masteries[1].name}」。`,
    ),
  ],
}));

const sections: GuideSection[] = [
  {
    id: "start",
    title: "三分钟入门",
    summary: "你只需移动。器物自动索敌、攻击与防守；拾取纸结后，从牌面选择下一步做法。",
    bullets: [
      "电脑：WASD 或方向键移动，Esc 暂停；升级牌可按 1–3。",
      "手柄：左摇杆移动，A 确认，B 返回，Menu/Start 暂停。",
      "手机：拖动左下虚拟摇杆；松手即停步。没有攻击、闪避或变形按钮。",
      "经验、升级、搭手与作坊选择都会暂停战场，选完再继续。",
    ],
    searchText: "移动 自动攻击 键盘 手柄 触屏 暂停 摇杆",
  },
  {
    id: "standard-run",
    title: "八分钟一卷",
    summary: "每 20 秒经过一个节气，两分钟换一季。六分钟迎战吞卷饕餮，八分钟迎战岁夜年兽。",
    table: {
      columns: ["时间", "场景", "事件"],
      rows: [
        ["0–2 分", "春", "立春至谷雨；2:00 木狮精英"],
        ["2–4 分", "夏", "立夏至大暑"],
        ["4–6 分", "秋", "立秋至霜降；5:00 提线伶偶"],
        ["6–8 分", "冬", "6:00 饕餮；8:00 年兽"],
      ],
    },
    details: [
      {
        title: "含首领招式：饕餮与年兽",
        body: [
          "饕餮的吞卷冲刺、吸卷和铜纹震圈都会先画出路径或安全缺口；吸卷时从两侧离开正面。",
          "年兽扑跃会先锁定落点；岁星坠有长前摇并保留安全通道，旋身攻击保留不少于一百度的缺口。",
          "首领大招期间普通怪暂停起手，结束后有短暂喘息。受伤解围可以打断首领，但不会额外削去首领生命。",
        ],
      },
    ],
    searchText: "八分钟 四季 饕餮 年兽 木狮 伶偶 时间线 首领",
  },
  {
    id: "paper-form",
    title: "纸人与纸飞机",
    summary: `连续移动 ${FORM_RULES.movingBeforeFold} 秒后，用 ${FORM_RULES.foldDuration} 秒折成纸飞机；停步 ${FORM_RULES.stoppedBeforeUnfold} 秒后，用 ${FORM_RULES.unfoldDuration} 秒展开。`,
    bullets: [
      `转向超过 ${FORM_RULES.sharpTurnDegrees}°、受击、升级或暂停时立即反向展开；急转后至少保持人形 ${FORM_RULES.humanHoldAfterTurn} 秒。`,
      "折叠只改变动画：速度、碰撞体、武器轨道和攻击数值完全相同。",
      "前几条初始纸命受损时会清除敌方弹体与预警并推开敌群；较后的初始纸命触发更强解围。额外纸命触发轻解围。",
      "护盾、格挡和无敌帧挡住伤害时，不消耗纸命，也不触发解围。",
    ],
    diagram: "fold",
    searchText: "折叠 展开 纸飞机 人形 急转 纸命 无敌 解围",
  },
  {
    id: "progression",
    title: "经验、五阶与札记",
    summary: `一局最多持有 ${PROGRESSION_RULES.weaponSlots} 件本命器。每件依次经过拿到、做细、改法、再磨、定型。`,
    bullets: [
      "第 3 阶从三种改法中选一条，第 5 阶从该路线的两种定型中选一种；本局选定后不再更改。",
      "所有本命器定型后，升级改为器用、行路、护身三类行旅札记。每张四阶精通；精通后可单独打开“继续收录”。",
      "续记第五阶获得原单阶一半的收益，之后每阶是上一阶的 75%；精通札记默认不再出现，让未选札记更容易抽到。",
      "全部可选札记精通且未开启续记时，多余经验记为结算页的余页。",
    ],
    diagram: "upgrade",
    details: TRAVEL_NOTE_DEFINITIONS.map((note) => ({
      title: `${note.name}（${note.masteryRank} 阶精通）`,
      body: [note.description, "卡面会同时列出当前值、选择后数值和本次差值；实战与卡面由同一计算函数产生。"],
    })),
    searchText: "经验 升级 札记 精通 续记 余页 拿到 做细 改法 定型",
  },
  {
    id: "weapons",
    title: "十般器物",
    summary: `共有 ${WEAPON_DEFINITIONS.length} 件器物、${WEAPON_DEFINITIONS.reduce((n, w) => n + w.routes.length, 0)} 条改法和 ${WEAPON_DEFINITIONS.reduce((n, w) => n + w.routes.reduce((m, r) => m + r.masteries.length, 0), 0)} 种定型。下列数值均为未计难度、札记与搭手的基础值。`,
    details: weaponDetails,
    searchText: `武器 器物 改法 定型 ${WEAPON_DEFINITIONS.flatMap((w) => [w.name, ...w.routes.map((r) => r.name), ...w.routes.flatMap((r) => r.masteries.map((m) => m.name))]).join(" ")}`,
  },
  {
    id: "synergies",
    title: "搭手",
    summary: `两件组成器物都达到第 3 阶后，搭手自动成立，不占武器槽；标准局最多启用 ${PROGRESSION_RULES.synergySlots} 项。`,
    details: SYNERGY_DEFINITIONS.map((item) => ({
      title: item.name,
      body: [item.description, `组成：${item.weapons.map((id) => WEAPON_DEFINITIONS.find((weapon) => weapon.id === id)?.name ?? id).join(" × ")}`],
    })),
    searchText: `搭手 成立 触发 替换 ${SYNERGY_DEFINITIONS.map((item) => item.name).join(" ")}`,
  },
  {
    id: "enemies",
    title: "敌群、预警与应对",
    summary: "朱砂实线表示沿途有伤害，细线加落点圈表示只在终点受伤。提示锁定后，终点不再追踪人物。",
    details: Object.entries(ENEMY_DEFINITIONS).map(([id, definition]) => ({
      title: enemyPresentation[id]?.[0] ?? id,
      body: [
        enemyPresentation[id]?.[1] ?? "观察预警后离开伤害区。",
        `前摇 ${seconds(definition?.skill.telegraph ?? 0)}，生效 ${seconds(definition?.skill.active ?? 0)}，收势 ${seconds(definition?.skill.recovery ?? 0)}。`,
      ],
    })),
    searchText: `怪物 预警 弹幕 突进 ${Object.values(enemyPresentation).flat().join(" ")}`,
  },
  {
    id: "seasons",
    title: "四时与二十四节气",
    summary: "二十四节气全部在八分钟内依序出现，以边景、天气、环境声和少量出场倾向区分；它们不会增加地形碰撞。",
    table: {
      columns: ["季节", "节气"],
      rows: [0, 1, 2, 3].map((season) => [
        ["春", "夏", "秋", "冬"][season],
        SOLAR_TERMS.slice(season * 6, season * 6 + 6).map((term) => term.name).join("、"),
      ]),
    },
    searchText: `四季 节气 ${SOLAR_TERMS.map((term) => term.name).join(" ")}`,
  },
  {
    id: "difficulty",
    title: "难度与试炼签",
    summary: "普通难度让敌群分批出手；更高难度逐步恢复完整招式、提高敌人强度与首领特性概率。难度需逐档通关解锁。",
    table: {
      columns: ["难度", "纸命", "人物威力", "敌生命", "敌速度", "同时突进"],
      rows: DIFFICULTY_IDS.map((id) => {
        const d = DIFFICULTIES[id];
        return [d.name, String(d.playerLife), `${Math.round(d.playerPower * 100)}%`, `${Math.round(d.enemyHpMultiplier * 100)}%`, `${Math.round(d.enemySpeedMultiplier * 100)}%`, String(d.enemyDashSlots)];
      }),
    },
    bullets: ["一命难度没有恢复或免死，但格挡、护盾与受击无敌仍可阻止伤害。", "试炼签叠加在难度之上；“齐出手”会让普通怪更早使用完整招式。"],
    searchText: "普通 困难 极难 一命 试炼签 恢复 齐出手",
  },
  {
    id: "endless",
    title: "无尽器盘与作坊",
    summary: `器盘最多 ${WEAVE_RULES.maxNodes} 格，其中最多 ${WEAVE_RULES.maxFusions} 件合器。游标顺时针经过节点，完整一圈后按顺序收势。`,
    bullets: [
      `每 ${WEAVE_RULES.forgePeriodSeconds} 秒开炉，获得 ${WEAVE_RULES.firePerForge} 火，最多存 ${WEAVE_RULES.maxFire} 火。`,
      "添器、做细、相邻合器和调位通常耗 1 火；非相邻合法配方归拢后合器耗 2 火。天时炼化免费。",
      "添器和做细会随选择自动排好，只在底栏落锤一次；调位、合器、拆器和替换仍在落锤前核对一次。",
      "器盘顺序不满足交换律：交换两个节点，会改变沿途转换以及最后的收势。",
    ],
    diagram: "weave",
    searchText: "无尽 器盘 作坊 游标 炉火 添器 做细 调位 收势 节点",
  },
  {
    id: "fusions",
    title: "四十五种合器",
    summary: `十件器物任意两两均有一件合器，共 ${FUSION_DEFINITIONS.length} 种。合器占一格并释放相邻的一格。`,
    details: FUSION_DEFINITIONS.map((fusion) => ({
      title: fusion.canonicalName,
      body: [`每 ${fusion.mechanic.cadence} 次${fusion.mechanic.event}触发「${fusion.mechanic.action}」。`, `器盘动作：${fusion.action}；收势类别：${fusion.terminalFamily}`],
    })),
    searchText: `合器 配方 ${FUSION_DEFINITIONS.map((fusion) => fusion.canonicalName).join(" ")}`,
  },
  {
    id: "celestials",
    title: "天变与天时",
    summary: `进入无尽约 ${CELESTIAL_RULES.firstIntrusionSeconds} 秒后迎来首次天变，此后约每 ${CELESTIAL_RULES.repeatSeconds} 秒一次。击败化身后可炼入器盘，也可明确放弃。`,
    details: CELESTIAL_INTRUSIONS.map((item) => ({
      title: `${item.name} → ${item.capturedName}`,
      body: [item.warning, `炼成后：${item.capturedEffects.map(describeEffect).join("；")}。天时占一格并随游标顺序触发。`],
    })),
    searchText: `天变 天时 炼化 放弃 ${CELESTIAL_INTRUSIONS.flatMap((item) => [item.name, item.capturedName]).join(" ")}`,
  },
  {
    id: "perk-book",
    title: "无尽百工谱",
    summary: `百工谱包含 ${ENDLESS_PERK_DEFINITIONS.length} 张新页、${ENDLESS_PERK_BRANCH_DEFINITIONS.length} 条互斥分支和 ${ENDLESS_PERK_PAIR_DEFINITIONS.length} 种合页。`,
    bullets: ["每次开炉为四选一，并恢复一次免费换牌。", "新页到手后开放两条互斥分支；分支锁定后不能改。", "两页满足关系后可另选合页；合页不占器盘，最多启用六项，超出时选择替换。"],
    details: [
      { title: "新页", body: ENDLESS_PERK_DEFINITIONS.map((item) => `${item.name}：${item.description}`) },
      { title: "页上分支", body: ENDLESS_PERK_BRANCH_DEFINITIONS.map((item) => `${item.name}：${item.description}`) },
      { title: "合页", body: ENDLESS_PERK_PAIR_DEFINITIONS.map((item) => `${item.name}：${item.description}`) },
    ],
    searchText: `百工谱 新页 分支 合页 ${ENDLESS_PERK_DEFINITIONS.map((item) => item.name).join(" ")}`,
  },
  {
    id: "endless-scaling",
    title: "无尽后期增长",
    summary: "进入无尽后的分钟数记为 m。高级怪概率先平缓增长，15 分钟后按对数曲线增加；80 分钟达到 98% 后不再提高。",
    paragraphs: [
      `同屏真实敌人约 ${ENDLESS_RULES.entityCap} 封顶，未用威胁最多积压 10 秒。首领同屏上限：0–35 分钟 1 名，35–60 分钟 2 名，60 分钟后 3 名。`,
      `${ENDLESS_RULES.scalingBeginsMinutes}–${ENDLESS_RULES.scalingEndsMinutes} 分钟每 3 分钟加一级：生命每级 +4.5%，速度 +1%，行动速度 +1.8%；到 ${ENDLESS_RULES.frozenAfterMinutes} 分钟后冻结。单次命中最多扣 ${ENDLESS_RULES.maxHitDamage} 命。`,
    ],
    exactParagraphs: [
      "m < 15：p = 0.06 + 0.12m/15。m ≥ 15：p = min(0.98, 0.18 + 0.80×ln(1+(m−15)/18)/ln(1+65/18))。高级判定优先生成可用首领，否则生成精英。",
    ],
    table: {
      columns: ["无尽分钟", "高级怪概率", "说明"],
      rows: [["0", "6%", "刚续卷"], ["15", "18%", "进入对数增长"], ["35", "约57%", "首领上限升至2"], ["45", "约69%", "后期增幅将开始"], ["60", "约84%", "首领上限升至3"], ["80", "98%", "概率与数值冻结"]],
    },
    tableDetail: "exact",
    diagram: "curve",
    searchText: "无尽 增长 概率 对数 首领预算 150 48 78 80 冻结",
  },
  {
    id: "glossary",
    title: "术语、存档与声音",
    summary: "纸命是生命；本命器是标准局四件武器；搭手是两器协同；合器是无尽中两格合成的一件新器物。",
    bullets: [
      "器盘游标：顺时针经过节点的标记；收势：游标完成一圈后的整盘动作。",
      "天变是敌对战场事件；天时是击败化身后炼成的己方节点。",
      "存档只保存在当前浏览器。GitHub Pages 与备用镜像域名不同，存档不会自动互通。",
      "首次成功访问后可使用离线缓存；新版本只在菜单、暂停或结算时提示更新。音乐、音效与环境音可分别调节。",
    ],
    searchText: "术语 存档 离线 音量 镜像 纸命 本命器 搭手 合器 收势",
  },
];

export function buildGuideDocument(): GuideDocument {
  return {
    title: "百工手册",
    subtitle: "从开卷移动到无尽后期，一处查清全部规则。默认先读白描说明，需要时再展开精确数值。",
    sections,
    coverage: {
      weapons: WEAPON_DEFINITIONS.length,
      routes: WEAPON_DEFINITIONS.reduce((n, w) => n + w.routes.length, 0),
      masteries: WEAPON_DEFINITIONS.reduce((n, w) => n + w.routes.reduce((m, r) => m + r.masteries.length, 0), 0),
      synergies: SYNERGY_DEFINITIONS.length,
      fusions: FUSION_DEFINITIONS.length,
      terms: SOLAR_TERMS.length,
      celestials: CELESTIAL_INTRUSIONS.length,
      notes: TRAVEL_NOTE_DEFINITIONS.length,
      perkPages: ENDLESS_PERK_DEFINITIONS.length,
      perkBranches: ENDLESS_PERK_BRANCH_DEFINITIONS.length,
      perkPairs: ENDLESS_PERK_PAIR_DEFINITIONS.length,
    },
  };
}

export const GUIDE_DOCUMENT = buildGuideDocument();
