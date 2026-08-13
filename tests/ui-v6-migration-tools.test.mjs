import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../app/PaperGuildGame.tsx", import.meta.url),
  "utf8",
);

test("v6 progress preserves v5 as a migration source and records difficulty", () => {
  assert.match(source, /paper-guild\.progress\.v6/);
  assert.match(source, /paper-guild\.progress\.v5/);
  assert.match(source, /unlockedDifficultyIds/);
  assert.match(source, /preferredDifficultyId/);
  assert.match(source, /event\.type === "difficultyClear"/);
  assert.match(source, /difficultyId: preferredDifficultyId/);
});

test("lantern UI names its replay source and rare advancement is explicit", () => {
  assert.match(source, /走马灯照样对象/);
  assert.match(source, /snapshot\.primaryWeaponRule/);
  assert.match(source, /setPrimaryWeapon\(run, weaponId\)/);
  assert.match(source, /推进哪件武器/);
  assert.match(source, /rareAdvanceOptionId/);
});

test("hidden test panel exposes safe director seeks and all authored bosses", () => {
  assert.match(source, /jumpEndlessMinutesForTest/);
  assert.match(source, /spawnEndlessBossForTest/);
  assert.match(source, /\[15, 35, 45, 80\]/);
  assert.match(source, /ENDLESS_BOSS_IDS\.map/);
  assert.match(source, /specialProbability/);
});

test("boss sprite preloading follows the actual endless boss id", () => {
  assert.match(source, /retainEnemySpriteSheets/);
  assert.match(source, /syncSceneVisualLifecycle\(run, run\.elapsed\)/);
  assert.match(source, /enemy\.endlessBossId/);
  assert.match(source, /run\.endlessDirector\?\.nextBossId/);
});

test("forge celestial nodes use authored atlas art instead of a text seal", () => {
  assert.match(source, /celestial-nodes-v63\.webp/);
  assert.match(source, /const celestialFrame/);
  assert.match(source, /publicAsset\("\/art-v6\/celestial-nodes-v63\.webp"\)/);
  assert.match(source, /style=\{weaveNodeThumbStyle\(node\)\}/);
  assert.doesNotMatch(
    source,
    /className="weave-node-art celestial-node-art"[^>]*>[\s\S]{0,40}天[\s\S]{0,20}<\/span>/,
  );
});

test("the three direct challenge slips are visible in the menu", () => {
  assert.match(source, /id: "bossRush", name: "Boss更勤"/);
  assert.match(source, /id: "noRecovery", name: "无恢复"/);
  assert.match(source, /id: "thinPower", name: "威力降低"/);
});
