import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createGuideNavigationState,
  navigateGuideBack,
  selectGuideSection,
  toggleGuideEntry,
} from "../app/game/help/navigation.ts";

test("guide navigation follows entry, section, directory, then exit", () => {
  let state = createGuideNavigationState("weapons");
  state = toggleGuideEntry(state, "weapons:1", 240);
  assert.equal(state.level, "entry");
  assert.equal(state.entryId, "weapons:1");

  state = toggleGuideEntry(state, "weapons:2", 310);
  assert.equal(state.level, "entry");
  assert.equal(state.entryId, "weapons:2", "opening another entry replaces the first");

  const entryBack = navigateGuideBack(state);
  assert.equal(entryBack.state.level, "section");
  assert.equal(entryBack.state.entryId, null);
  assert.equal(entryBack.focusEntryId, "weapons:2");

  const sectionBack = navigateGuideBack(entryBack.state);
  assert.equal(sectionBack.state.level, "directory");
  assert.equal(sectionBack.shouldExit, false);

  const directoryBack = navigateGuideBack(sectionBack.state);
  assert.equal(directoryBack.shouldExit, true);
});

test("changing sections closes the old entry and preserves directory scroll", () => {
  const open = toggleGuideEntry(createGuideNavigationState("weapons"), "weapons:4", 180);
  const changed = selectGuideSection(open, "fusions", 472);
  assert.equal(changed.level, "section");
  assert.equal(changed.sectionId, "fusions");
  assert.equal(changed.entryId, null);
  assert.equal(changed.directoryScrollTop, 472);
  assert.equal(changed.contentScrollTop, 0);
});

test("guide view uses one controlled accordion and independent exact-value disclosure", async () => {
  const view = await readFile("app/game/help/GuideView.tsx", "utf8");
  assert.doesNotMatch(view, /<details\b/);
  assert.doesNotMatch(view, /open=\{exact/);
  assert.match(view, /aria-expanded=\{expanded\}/);
  assert.match(view, /role="region"/);
  assert.match(view, /hidden=\{!expanded\}/);
  assert.match(view, /current\.exactParagraphs/);
  assert.match(view, /data-gamepad-cancel/);
  assert.match(view, /data-guide-exit/);
  assert.match(view, /navigateGuideBack\(navigation\)/);
  assert.match(view, /scrollTop = result\.state\.contentScrollTop/);
  assert.match(view, /guide-overlay/);
  assert.match(view, /guide-standalone/);
  assert.doesNotMatch(view, /overlay \? "overlay" : "page"/);
});

test("guide shell keeps navigation fixed and switches to one pane from its own container", async () => {
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /container-name:\s*guide-shell/);
  assert.match(css, /grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(css, /@container guide-shell \(max-width: 760px\) or \(max-height: 480px\)/);
  assert.match(css, /data-guide-level="directory"[^\n]+guide-content/);
  assert.match(css, /not\(\[data-guide-level="directory"\]\)[^\n]+guide-nav/);
  assert.match(css, /min-height:\s*44px/);
});

test("standalone guide exits through the public asset resolver and game overlay restores focus", async () => {
  const page = await readFile("app/guide/page.tsx", "utf8");
  const game = await readFile("app/PaperGuildGame.tsx", "utf8");
  assert.match(page, /exitTarget=\{publicAsset\("\/"\)\}/);
  assert.match(game, /guideReturnFocusRef/);
  assert.match(game, /document\.activeElement/);
  assert.match(game, /focus\(\{ preventScroll: true \}\)/);
  assert.match(game, /cancelStartedAt/);
  assert.match(game, /cancelLongTriggered/);
});
