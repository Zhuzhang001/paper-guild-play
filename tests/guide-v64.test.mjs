import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("guide uses one shared model and covers every authored content family", async () => {
  const source = await readFile("app/game/help/model.ts", "utf8");
  const page = await readFile("app/guide/page.tsx", "utf8");
  const overlay = await readFile("app/game/help/GuideOverlay.tsx", "utf8");
  for (const token of ["WEAPON_DEFINITIONS", "SYNERGY_DEFINITIONS", "FUSION_DEFINITIONS", "SOLAR_TERMS", "CELESTIAL_INTRUSIONS", "TRAVEL_NOTE_DEFINITIONS", "ENDLESS_PERK_BRANCH_DEFINITIONS"]) {
    assert.match(source, new RegExp(token));
  }
  assert.match(page, /GUIDE_DOCUMENT/);
  assert.match(overlay, /GUIDE_DOCUMENT/);
  assert.match(source, /weapons: WEAPON_DEFINITIONS\.length/);
  assert.match(source, /fusions: FUSION_DEFINITIONS\.length/);
});

test("menu copy is concise and does not echo implementation requirements", async () => {
  const source = await readFile("app/PaperGuildGame.tsx", "utf8");
  assert.match(source, /一人一卷 · 四时百工/);
  assert.match(source, /只需移动，器物自会寻敌/);
  assert.doesNotMatch(source, /少量道门元素只放在/);
  assert.doesNotMatch(source, /角色已强制展开/);
  assert.doesNotMatch(source, /美工图集装订中/);
});

test("endless Boss skills each select an explicit authored peak frame", async () => {
  const bosses = await readFile("app/game/content/bosses.ts", "utf8");
  const animation = await readFile("app/game/visual/enemyAnimation.ts", "utf8");
  assert.equal((bosses.match(/skill\("/g) ?? []).length, 18);
  assert.equal((bosses.match(/\}, [0-3]\),/g) ?? []).length, 18);
  assert.match(animation, /pose\.bossAttackFrameColumn \?\? 0/);
  assert.doesNotMatch(animation, /Math\.floor\(stateProgress \* 4\)/);
});
