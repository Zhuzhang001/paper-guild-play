import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [component, styles] = await Promise.all([
  readFile(new URL("../app/PaperGuildGame.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("v5 progress migrates v4 data and remembers the initial weapon choice", () => {
  assert.match(component, /paper-guild\.progress\.v5/);
  assert.match(component, /paper-guild\.progress\.v4/);
  assert.match(component, /preferredInitialWeapon:\s*"random"/);
  assert.match(component, /legacy && !current[\s\S]*?\? "sword"/);
  assert.match(
    component,
    /useState<InitialWeaponChoice>\("random"\)/,
  );
  assert.match(
    component,
    /createRun\(trials,\s*seed,\s*\{[\s\S]*?initialWeaponId:\s*preferredInitialWeapon/,
  );
});

test("upgrade cards reserve a real art column and keep level dots in flow", () => {
  const cardRule = styles.match(/\.upgrade-card\s*\{([^}]*)\}/s)?.[1] ?? "";
  const artRule = styles.match(/\.upgrade-card-art\s*\{([^}]*)\}/s)?.[1] ?? "";
  const dotRule = styles.match(/\.level-dots\s*\{([^}]*)\}/s)?.[1] ?? "";

  assert.match(cardRule, /grid-template-rows:\s*auto auto minmax\(0,\s*1fr\) auto/);
  assert.match(artRule, /grid-column:\s*2/);
  assert.match(artRule, /grid-row:\s*1\s*\/\s*-1/);
  assert.match(dotRule, /grid-row:\s*4/);
  assert.doesNotMatch(dotRule, /position:\s*absolute/);
  assert.match(component, /if \(option\.kind === "acquire"\) return "新武器"/);
  assert.doesNotMatch(component, /return "拿到新器"/);
});

test("assisted controls use fixed substeps and cannot persist a clear", () => {
  assert.doesNotMatch(component, /BAIGONG|const TEST_CODE/);
  assert.match(component, /transitionTestUnlock/);
  assert.match(component, /type: "tap"/);
  assert.match(component, /stepRun\(run,\s*FIXED_STEP,\s*direction\)/);
  assert.match(
    component,
    /modeRef\.current === "playing"[\s\S]*?stepRun\(run,\s*FIXED_STEP/,
  );
  assert.match(component, /victory && !run\.testModifiers\.assisted/);
  assert.match(component, /当前 Boss 余 1 血/);
  assert.match(component, /炉火置 3/);
  assert.match(component, /经验 \+100/);
});
