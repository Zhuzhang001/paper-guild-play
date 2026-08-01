import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [game, css] = await Promise.all([
  readFile(new URL("../app/PaperGuildGame.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

const forgeCss = css.slice(css.indexOf("v6.1: one forge layout system"));

test("forge shell has a bounded header, workspace, and persistent footer", () => {
  assert.match(
    game,
    /<header className="forge-shell-header">[\s\S]*?<div className={`forge-workbench view-\$\{forgeMobileView\}`}>[\s\S]*?<footer className="forge-footer">/,
  );
  assert.match(forgeCss, /\.forge-panel \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/);
  assert.match(forgeCss, /\.forge-workbench \{[\s\S]*?flex: 1;[\s\S]*?min-height: 0;/);
  assert.match(forgeCss, /\.forge-footer \{[\s\S]*?flex: none;/);
  assert.match(forgeCss, /height:\s*calc\(100% - 8px\)/);
});

test("desktop is the only dual-column forge breakpoint", () => {
  assert.match(forgeCss, /@container game-shell \(min-width: 960px\) and \(min-height: 621px\)/);
  assert.match(forgeCss, /grid-template-columns: minmax\(0, 58fr\) minmax\(360px, 42fr\)/);
  assert.match(forgeCss, /@container game-shell \(max-height: 620px\) or \(max-width: 959px\)/);
  assert.match(forgeCss, /\.forge-view-switch \{[\s\S]*?display: grid;/);
  assert.match(
    forgeCss,
    /\.forge-workbench\.view-actions \.forge-preview-rail,[\s\S]*?\.forge-workbench\.view-ring \.forge-main-column \{[\s\S]*?display: none;/,
  );
});

test("temper content owns one vertical scroll flow and keeps full copy", () => {
  assert.match(game, /className="forge-zone-scroll forge-temper-scroll"/);
  assert.match(game, /className="forge-temper-empty" role="status"/);
  assert.doesNotMatch(game, /forge-disabled-card|forge-progress-preview/);
  assert.match(forgeCss, /\.forge-zone-scroll,[\s\S]*?\.recipe-list \{[\s\S]*?overflow-y: auto;/);
  assert.match(forgeCss, /\.temper-list \{\s*overflow: visible;/);
  assert.doesNotMatch(forgeCss, /-webkit-line-clamp/);
});

test("lantern rule is compact and no longer borrows the expanding guide", () => {
  assert.match(game, /<section className="forge-primary-rule" aria-label="走马灯照样规则">/);
  assert.doesNotMatch(
    game,
    /className="forge-context-guide" aria-label="走马灯照样规则"/,
  );
  assert.match(forgeCss, /\.forge-primary-rule \{[\s\S]*?flex: none;/);
});

test("preview actions stay in the footer and preview switches to the ring page", () => {
  assert.match(
    game,
    /const showForgePreview = \(preview: ForgePreview\) => \{[\s\S]*?setForgeMobileView\("ring"\)/,
  );
  assert.match(
    game,
    /<div className="forge-footer-actions">[\s\S]*?cancelForgePreview[\s\S]*?confirmForgePreview[\s\S]*?closeForge/,
  );
  assert.match(
    game,
    /disabled=\{[\s\S]*?forgeConfirming \|\|[\s\S]*?!forgePreview \|\|[\s\S]*?forgeFire < forgePreview\.cost[\s\S]*?\}/,
  );
});

test("ring orbit is height-aware and reserves a node-safe track", () => {
  assert.match(
    game,
    /<div className="forge-ring-stage">[\s\S]*?<div className="weave-ring-track">[\s\S]*?className="weave-ring-path"/,
  );
  assert.match(forgeCss, /\.forge-ring-stage \{[\s\S]*?container-type: size;[\s\S]*?overflow: clip;/);
  assert.match(forgeCss, /width: min\(100cqw, calc\(100cqh \* 1\.44\), 420px\)/);
  assert.match(forgeCss, /\.weave-ring-track \{[\s\S]*?inset: calc\(var\(--ring-node-size\) \/ 2 \+ 8px\)/);
  assert.match(forgeCss, /\.weave-ring-preview \{[\s\S]*?overflow: clip;/);
});

test("v6.1 forge rules do not add another important override layer", () => {
  assert.doesNotMatch(forgeCss, /!important/);
  assert.equal((css.match(/^\.forge-panel \{/gm) ?? []).length, 1);
});
