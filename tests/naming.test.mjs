import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-naming-"));
const esbuild = fileURLToPath(
  new URL("../node_modules/.bin/esbuild.cmd", import.meta.url),
);

function bundle(relativeEntry, outputName) {
  const outfile = join(scratch, outputName);
  const result = spawnSync(
    esbuild,
    [
      fileURLToPath(new URL(relativeEntry, import.meta.url)),
      "--bundle",
      "--format=esm",
      "--platform=node",
      `--outfile=${outfile}`,
    ],
    {
      shell: true,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${dirname(process.execPath)};${process.env.PATH ?? ""}`,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return import(pathToFileURL(outfile).href);
}

const content = await bundle("../app/game/content/index.ts", "content.mjs");
const survivor = await bundle("../app/game/survivor.ts", "survivor.mjs");
process.on("exit", () =>
  rmSync(scratch, { recursive: true, force: true }),
);

const expectedWeapons = [
  ["竹节剑", ["飞剑留印", "护身剑圈", "横扫"]],
  ["山水扇", ["铺风", "回风", "借风"]],
  ["八骨油纸伞", ["撑伞护身", "开伞散雨", "伞骨接雷"]],
  ["燕尾剪", ["双燕回剪", "贴身绞剪", "追弱断裁"]],
  ["漆木算盘", ["急拨珠", "长列珠", "满筹清账"]],
  ["木臂连弩", ["排弩齐射", "落架弩台", "埋火弩"]],
  ["月牙琵琶", ["推弦开浪", "跳弦", "留声"]],
  ["鲁班墨斗", ["弹墨线", "框墨格", "搭木件"]],
  ["走马灯", ["放影人", "转灯影", "照样"]],
  ["五雷木令", ["点雷", "串雷", "布雷坛"]],
];

const expectedMasteries = [
  "拉直剑线", "印后分剑", "叠起双圈", "转满飞剑", "弱时加宽", "收手再扫",
  "前后铺风", "过处留风", "命中折返", "找印穿过", "受击挡开", "跟着补扇",
  "合伞挡伤", "挡后甩珠", "加密雨针", "针落成洼", "八骨分雷", "攒满劈下",
  "来回换敌", "两刃拉线", "加刃双绞", "剪倒分刃", "见弱就断", "印上补剪",
  "十二拨珠", "连中快拨", "一列打穿", "横向补列", "先清大账", "照账再算",
  "收拢齐射", "半拍补射", "四角架弩", "弩台跟人", "爆点接火", "攒火齐爆",
  "十向推浪", "尾后叠浪", "跳处分珠", "多跳旧敌", "加宽留声", "照印留声",
  "拉长墨线", "原路再割", "交叉框格", "越线补割", "拼成木轮", "照前器搭",
  "三样列阵", "影散追火", "双圈转影", "转满冲出", "轮着照样", "命中留样",
  "专点强敌", "点后再劈", "串过留雷", "串尾重劈", "五处轮劈", "二十拍齐劈",
];

test("weapon and tier-three route names match the plain-language lock", () => {
  assert.deepEqual(
    content.WEAPON_DEFINITIONS.map((weapon) => [
      weapon.name,
      weapon.routes.map((route) => route.name),
    ]),
    expectedWeapons,
  );
  assert.deepEqual(
    content.WEAPON_DEFINITIONS.map((weapon) => weapon.shortName),
    expectedWeapons.map(([name]) => name),
  );
});

test("all sixty mastery names are short concrete actions without template words", () => {
  const masteries = content.WEAPON_DEFINITIONS.flatMap((weapon) =>
    weapon.routes.flatMap((route) => route.masteries),
  );
  assert.equal(masteries.length, 60);
  assert.deepEqual(
    masteries.map((mastery) => mastery.name),
    expectedMasteries,
  );

  const forbidden =
    /神霄|玄坛|九宫|万象|天机|太虚|无极|追命|成器|器魂|终式/u;
  const allNames = content.WEAPON_DEFINITIONS.flatMap((weapon) => [
    weapon.name,
    weapon.shortName,
    ...weapon.routes.flatMap((route) => [
      route.name,
      ...route.masteries.map((mastery) => mastery.name),
    ]),
  ]);
  for (const name of allNames) {
    assert.doesNotMatch(name, forbidden);
  }
  for (const mastery of masteries) {
    const length = Array.from(mastery.name).length;
    assert.ok(
      length >= 2 && length <= 5,
      `${mastery.id} must use a 2–5 character action name`,
    );
  }
});

test("rare choices and endless cursor descriptions use the locked plain terms", () => {
  assert.deepEqual(survivor.RARE_CHOICES, [
    {
      id: "master-now",
      name: "趁热做细",
      description: "先选一件未定型武器，再推进一阶；改法或定型仍由你亲自选。",
    },
    {
      id: "resonance-slot",
      name: "搭手续作",
      description: "仍只启用三项搭手；每累计触发三次，第三次按原动作再做一遍。",
    },
    {
      id: "weapon-soul",
      name: "记住手法",
      description: "每件本命武器累计命中十八次，便用这门手艺追击强敌并弹射三次。",
    },
  ]);
  assert.ok(
    content.ENDLESS_PERK_DEFINITIONS.every(
      (definition) => !definition.description.includes("器息"),
    ),
  );
  assert.equal(
    content.ENDLESS_PERK_DEFINITIONS.filter((definition) =>
      definition.description.includes("器盘游标"),
    ).length,
    3,
  );
});
