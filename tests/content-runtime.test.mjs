import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "paper-guild-content-"));
const esbuild = fileURLToPath(new URL("../node_modules/.bin/esbuild.cmd", import.meta.url));

function bundle(relativeEntry, outputName) {
  const outfile = join(scratch, outputName);
  const result = spawnSync(esbuild, [
    fileURLToPath(new URL(relativeEntry, import.meta.url)),
    "--bundle",
    "--format=esm",
    "--platform=node",
    `--outfile=${outfile}`,
  ], {
    shell: true,
    encoding: "utf8",
    env: { ...process.env, PATH: `${dirname(process.execPath)};${process.env.PATH ?? ""}` },
  });
  assert.equal(result.status, 0, result.stderr);
  return import(pathToFileURL(outfile).href);
}

const content = await bundle("../app/game/content/index.ts", "content.mjs");
const runtime = await bundle("../app/game/runtime/index.ts", "runtime.mjs");
const world = await bundle("../app/game/world/solarTerms.ts", "solar-terms.mjs");
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

test("combat catalog contains every promised authored branch", () => {
  assert.deepEqual(content.validateCombatContent(), []);
  assert.equal(content.WEAPON_DEFINITIONS.length, 10);
  assert.equal(content.SYNERGY_DEFINITIONS.length, 12);
  assert.equal(content.FUSION_DEFINITIONS.length, 30);
  assert.equal(content.ENDLESS_PERK_DEFINITIONS.length, 32);
  assert.equal(content.CELESTIAL_INTRUSIONS.length, 6);
  for (const weapon of content.WEAPON_DEFINITIONS) {
    assert.equal(weapon.routes.length, 3);
    for (const route of weapon.routes) assert.equal(route.masteries.length, 2);
  }
  assert.ok(
    content.SYNERGY_DEFINITIONS.every(
      (definition) => definition.eventRules.length > 0,
    ),
  );
  assert.ok(
    content.FUSION_DEFINITIONS.every(
      (definition) =>
        definition.pairLabel.includes(" × ") &&
        definition.action.length > 0 &&
        definition.name === definition.action &&
        definition.canonicalName ===
          `${definition.pairLabel}｜${definition.action}` &&
        definition.mechanic.action.length > 0,
    ),
  );
  assert.deepEqual(
    Object.fromEntries(
      ["weapon", "weave", "season", "journey"].map((category) => [
        category,
        content.ENDLESS_PERK_DEFINITIONS.filter(
          (definition) => definition.category === category,
        ).length,
      ]),
    ),
    { weapon: 10, weave: 8, season: 8, journey: 6 },
  );
  assert.ok(
    content.ENDLESS_PERK_DEFINITIONS.every(
      (definition) =>
        definition.rules.length > 0 &&
        definition.rules.every((rule) => rule.actions.length > 0),
    ),
  );
});

test("the thirty locked fusion pairs use only canonical plain-action names", () => {
  const labels = {
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
  const expected = [
    ["fan", "umbrella", "风过伞骨"],
    ["umbrella", "thunderSeal", "伞骨接雷"],
    ["fan", "inkline", "风走墨格"],
    ["sword", "crossbow", "剑标引箭"],
    ["sword", "lantern", "灯照剑路"],
    ["sword", "pipa", "先弦后剑"],
    ["scissors", "abacus", "量准再剪"],
    ["scissors", "inkline", "墨框合剪"],
    ["scissors", "umbrella", "伞挡剪雨"],
    ["abacus", "pipa", "珠落成拍"],
    ["abacus", "crossbow", "数珠装弩"],
    ["crossbow", "lantern", "灯转弩台"],
    ["crossbow", "inkline", "线头架弩"],
    ["pipa", "thunderSeal", "弦尾落雷"],
    ["umbrella", "lantern", "合伞藏灯"],
    ["sword", "fan", "风送回剑"],
    ["sword", "umbrella", "开伞收剑"],
    ["sword", "scissors", "双刃合口"],
    ["sword", "inkline", "剑拖墨线"],
    ["fan", "crossbow", "顺风排弩"],
    ["fan", "pipa", "扇过三弦"],
    ["umbrella", "inkline", "墨雨封边"],
    ["umbrella", "pipa", "雨敲伞骨"],
    ["scissors", "pipa", "弦过剪口"],
    ["scissors", "lantern", "剪影伤身"],
    ["abacus", "inkline", "珠走墨线"],
    ["abacus", "lantern", "数满一灯"],
    ["abacus", "thunderSeal", "数珠落雷"],
    ["crossbow", "thunderSeal", "雷钉接路"],
    ["pipa", "inkline", "墨线记谱"],
  ];
  assert.equal(expected.length, 30);
  for (const [first, second, action] of expected) {
    const definition = content.findFusionDefinition(first, second);
    assert.ok(definition, `${first} × ${second} must have a locked recipe`);
    assert.equal(definition.pairLabel, `${labels[first]} × ${labels[second]}`);
    assert.equal(definition.name, action);
    assert.equal(definition.action, action);
    assert.equal(
      definition.canonicalName,
      `${definition.pairLabel}｜${action}`,
    );
  }
});

test("endless perks use the locked four-group names", () => {
  const expectedNames = [
    "剑印回手", "借风偏箭", "伞下空当", "合口一剪", "九珠清账",
    "三轮架弩", "末音回拨", "交线留墨", "灯灭存火", "雷脚接线",
    "倒走一圈", "两头对走", "空位蓄力", "隔位回头", "头器再过",
    "慢转重收", "快转轻收", "余劲留盘",
    "新芽拾药", "雨水并珠", "荷面导电", "暑风推弹", "稻熟并收",
    "秋风扫场", "冬灯护纸", "霜线留步",
    "拾珠回风", "破纸护命", "人形稳手", "飞行蓄势", "急转卸力",
    "止步养息",
  ];
  assert.deepEqual(
    content.ENDLESS_PERK_DEFINITIONS.map((definition) => definition.name),
    expectedNames,
  );
});

test("weapon tiers resolve as core patches instead of stacked emitters", () => {
  const refined = runtime.resolveWeaponKit({ id: "sword", level: 2 });
  assert.deepEqual(
    refined.effects.map((effect) => effect.id),
    ["sword-refined"],
  );

  const routed = runtime.resolveWeaponKit({
    id: "sword",
    level: 4,
    routeId: "sword:a",
  });
  assert.equal(
    routed.effects.filter((effect) => effect.kind === "projectile").length,
    1,
  );
  assert.ok(routed.effects.some((effect) => effect.id === "sword-a-refine"));
  assert.ok(routed.effects.some((effect) => effect.kind === "mark"));

  const focused = runtime.resolveWeaponKit({
    id: "sword",
    level: 5,
    routeId: "sword:a",
    masteryId: "sword:a:focus",
  });
  assert.equal(focused.effects[0].kind, "beam");
  assert.equal(
    focused.effects.filter(
      (effect) =>
        effect.trigger === "onAttack" || effect.trigger === "periodic",
    ).length,
    1,
  );
});

test("every route and mastery keeps a real automatic attack root", () => {
  const isAutomatic = (effect) =>
    effect.trigger === "onAttack" || effect.trigger === "periodic";
  for (const weapon of content.WEAPON_DEFINITIONS) {
    const refined = runtime.resolveWeaponEffects({
      id: weapon.id,
      level: 2,
    });
    assert.equal(
      refined.filter(isAutomatic).length,
      1,
      `${weapon.id} refinement must patch its core instead of duplicating it`,
    );
    for (const route of weapon.routes) {
      for (const mastery of route.masteries) {
        const effects = runtime.resolveWeaponEffects({
          id: weapon.id,
          level: 5,
          routeId: route.id,
          masteryId: mastery.id,
        });
        assert.ok(
          effects.some(isAutomatic),
          `${mastery.id} must retain an automatic attack root`,
        );
      }
    }
  }
});

test("route and mastery milestones never mix with ordinary upgrades", () => {
  const base = {
    modifiers: {},
    synergyCapacity: 3,
  };
  const routeResult = runtime.generateUpgradeOptions({
    ...base,
    weapons: [{ id: "sword", level: 2 }],
  }, runtime.createRngState("route"));
  assert.equal(routeResult.milestone, "route");
  assert.equal(routeResult.options.length, 3);
  assert.ok(routeResult.options.every((option) => option.kind === "route"));

  const masteryResult = runtime.generateUpgradeOptions({
    ...base,
    weapons: [{ id: "sword", level: 4, routeId: "sword:a" }],
  }, runtime.createRngState("mastery"));
  assert.equal(masteryResult.milestone, "mastery");
  assert.equal(masteryResult.options.length, 2);
  assert.ok(masteryResult.options.every((option) => option.kind === "mastery"));
});

test("weave terminals are directional and adjacent fusions release a slot", () => {
  const forward = runtime.createWeaveState({
    modifiers: {},
    synergyCapacity: 3,
    weapons: [
      { id: "fan", level: 5, routeId: "fan:a", masteryId: "fan:a:focus" },
      { id: "umbrella", level: 5, routeId: "umbrella:a", masteryId: "umbrella:a:focus" },
      { id: "thunderSeal", level: 5, routeId: "thunderSeal:a", masteryId: "thunderSeal:a:focus" },
    ],
  });
  assert.equal(forward.nodes[0].origin, "core");
  assert.deepEqual(forward.nodes[0].weaponState, {
    id: "fan",
    level: 5,
    routeId: "fan:a",
    masteryId: "fan:a:focus",
  });
  assert.equal(runtime.deriveWeaveTerminal(forward).name, "雨针散开后落雷");
  assert.equal(runtime.deriveWeaveTerminal(forward).effects[0].kind, "lightning");
  const reversed = runtime.swapWeaveNodes(forward, 0, 2);
  assert.equal(runtime.deriveWeaveTerminal(reversed).name, "伞骨蓄雷后送风");
  assert.equal(runtime.deriveWeaveTerminal(reversed).effects[0].kind, "projectile");

  const pair = runtime.createWeaveState({
    modifiers: {},
    synergyCapacity: 3,
    weapons: [
      { id: "sword", level: 3, routeId: "sword:a" },
      { id: "crossbow", level: 3, routeId: "crossbow:a" },
    ],
  });
  const fused = runtime.fuseAdjacentNodes(pair, 0, 1);
  assert.equal(fused.ok, true);
  if (fused.ok) {
    assert.equal(fused.state.nodes.length, 1);
    assert.equal(fused.node.kind, "fusion");
    assert.equal(fused.node.sourceId, "starPiercer");
    assert.equal(fused.node.name, "剑 × 连弩｜剑标引箭");
  }
});

test("overflow nodes preserve authored route and mastery state", () => {
  const base = runtime.createWeaveState({
    modifiers: {},
    synergyCapacity: 3,
    weapons: [{ id: "sword", level: 3, routeId: "sword:a" }],
  });
  const inserted = runtime.insertWeaponNode(base, {
    id: "pipa",
    level: 5,
    routeId: "pipa:c",
    masteryId: "pipa:c:chain",
  });
  assert.equal(inserted.ok, true);
  if (inserted.ok) {
    assert.equal(inserted.node.origin, "overflow");
    assert.equal(inserted.node.weaponState.routeId, "pipa:c");
    assert.equal(inserted.node.weaponState.masteryId, "pipa:c:chain");
  }
});

test("forge and endless perk choices are deterministic four-choice data", () => {
  const weave = runtime.createWeaveState({
    modifiers: {},
    synergyCapacity: 3,
    weapons: [
      { id: "sword", level: 3, routeId: "sword:a" },
      { id: "crossbow", level: 3, routeId: "crossbow:a" },
    ],
  });
  const forgeState = runtime.createForgeState(1);
  const firstForge = runtime.generateForgeOffers(
    weave,
    runtime.createRngState("forge-four"),
    forgeState,
  );
  const repeatedForge = runtime.generateForgeOffers(
    weave,
    runtime.createRngState("forge-four"),
    forgeState,
  );
  assert.equal(firstForge.offers.length, 4);
  assert.deepEqual(firstForge.offers, repeatedForge.offers);
  const refreshedForge = runtime.refreshForgeOffers(
    weave,
    firstForge.rngState,
    firstForge.state,
  );
  assert.ok(refreshedForge);
  assert.equal(refreshedForge.state.refreshesRemaining, 0);
  assert.notDeepEqual(refreshedForge.offers, firstForge.offers);

  const perkState = runtime.createEndlessPerkState(1);
  const firstPerks = runtime.generateEndlessPerkChoices(
    perkState,
    runtime.createRngState("perk-four"),
  );
  const repeatedPerks = runtime.generateEndlessPerkChoices(
    perkState,
    runtime.createRngState("perk-four"),
  );
  assert.equal(firstPerks.choices.length, 4);
  assert.deepEqual(
    firstPerks.choices.slice(0, 3).map((choice) => choice.category),
    ["weapon", "weave", "season"],
  );
  assert.deepEqual(firstPerks.choices, repeatedPerks.choices);
  const refreshedPerks = runtime.refreshEndlessPerkChoices(
    firstPerks.state,
    firstPerks.rngState,
  );
  assert.ok(refreshedPerks);
  assert.equal(refreshedPerks.state.refreshesRemaining, 0);
  assert.notDeepEqual(
    refreshedPerks.choices.map((choice) => choice.id),
    firstPerks.choices.map((choice) => choice.id),
  );

  const contextual = runtime.generateEndlessPerkChoices(
    runtime.createEndlessPerkState(1),
    runtime.createRngState("perk-context"),
    4,
    {
      ownedWeaponIds: ["sword"],
      weaveNodeCount: 8,
      weaveMaxNodes: 8,
    },
  );
  assert.equal(contextual.choices.length, 4);
  assert.ok(
    contextual.choices
      .filter((choice) => choice.category === "weapon")
      .every((choice) => choice.id === "swordMarkReturn"),
  );
  assert.equal(
    contextual.choices.some((choice) => choice.id === "emptySlotCharge"),
    false,
  );
});

test("endless perk rules are directly consumable event data", () => {
  let state = runtime.applyEndlessPerkChoice(
    runtime.createEndlessPerkState(),
    "ninePearl",
  );
  for (let hit = 1; hit < 9; hit += 1) {
    const result = runtime.consumeEndlessPerkEvent(state, {
      type: "sameTargetPearlHit",
      weaponId: "abacus",
      targetId: 17,
    });
    state = result.state;
    assert.equal(result.procs.length, 0);
  }
  const ninth = runtime.consumeEndlessPerkEvent(state, {
    type: "sameTargetPearlHit",
    weaponId: "abacus",
    targetId: 17,
  });
  assert.equal(ninth.procs.length, 1);
  assert.equal(ninth.procs[0].perkName, "九珠清账");
  assert.equal(ninth.procs[0].actions[0].kind, "releasePearlRows");

  let guarded = runtime.applyEndlessPerkChoice(
    runtime.createEndlessPerkState(),
    "lastPaperGuard",
  );
  const firstLethal = runtime.consumeEndlessPerkEvent(guarded, {
    type: "lethalDamage",
  });
  assert.equal(firstLethal.procs[0].actions[0].kind, "preventLethalDamage");
  guarded = firstLethal.state;
  assert.equal(
    runtime.consumeEndlessPerkEvent(guarded, { type: "lethalDamage" }).procs
      .length,
    0,
  );
  guarded = runtime.stepEndlessPerkState(guarded, 90);
  assert.equal(
    runtime.consumeEndlessPerkEvent(guarded, { type: "lethalDamage" }).procs
      .length,
    1,
  );

  const autumnBase = runtime.consumeEndlessPerkEvent(
    runtime.applyEndlessPerkChoice(
      runtime.createEndlessPerkState(),
      "autumnSweep",
    ),
    { type: "interval", season: "summer" },
  );
  assert.equal(autumnBase.procs[0].seasonalMultiplier, 1);
  const autumnDouble = runtime.consumeEndlessPerkEvent(
    runtime.applyEndlessPerkChoice(
      runtime.createEndlessPerkState(),
      "autumnSweep",
    ),
    { type: "interval", season: "autumn" },
  );
  assert.equal(autumnDouble.procs[0].seasonalMultiplier, 2);
});

test("all forty-five weapon pairs conduct qi and preserve order", () => {
  let pairs = 0;
  for (let first = 0; first < content.WEAPON_IDS.length; first += 1) {
    for (let second = first + 1; second < content.WEAPON_IDS.length; second += 1) {
      const firstId = content.WEAPON_IDS[first];
      const secondId = content.WEAPON_IDS[second];
      const build = {
        modifiers: {},
        synergyCapacity: 3,
        weapons: [
          { id: firstId, level: 3, routeId: `${firstId}:a` },
          { id: secondId, level: 3, routeId: `${secondId}:a` },
        ],
      };
      const forward = runtime.createWeaveState(build);
      const reverse = runtime.swapWeaveNodes(forward, 0, 1);
      const forwardTerminal = runtime.deriveWeaveTerminal(forward);
      const reverseTerminal = runtime.deriveWeaveTerminal(reverse);
      assert.equal(forward.nodes.length, 2);
      assert.ok(runtime.advanceWeavePulse(forward, 12).terminal);
      assert.notEqual(forwardTerminal.signature, reverseTerminal.signature);
      assert.notEqual(forwardTerminal.id, reverseTerminal.id);
      pairs += 1;
    }
  }
  assert.equal(pairs, 45);
});

test("eight minutes visits all twenty-four solar terms exactly once", () => {
  assert.equal(world.SOLAR_TERMS.length, 24);
  const visited = new Set();
  for (let second = 0; second < 480; second += 20) {
    visited.add(world.getSolarTermState(second, false).current.id);
  }
  assert.equal(visited.size, 24);
  assert.equal(world.getSolarTermState(0, false).current.name, "立春");
  assert.equal(world.getSolarTermState(479.9, false).current.name, "大寒");
});
