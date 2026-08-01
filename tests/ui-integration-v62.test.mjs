import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../app/PaperGuildGame.tsx", import.meta.url),
  "utf8",
);
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("travel notes have a distinct mastered-weapon screen and visible ranks", () => {
  assert.match(source, /器物均已定型 · 选一张行旅札记/);
  assert.match(source, /三张牌依次照顾器用、行路与护身/);
  assert.match(source, /travel-note-progress/);
  assert.match(source, /snapshot\.surplusPages/);
  assert.match(source, /<span>余页<\/span>/);
});

test("forge continue explains every blocker instead of silently disabling", () => {
  assert.match(source, /role="alertdialog"/);
  assert.match(source, /续战前还差一步/);
  assert.match(source, /disabled=\{forgeConfirming\}/);
  assert.doesNotMatch(source, /disabled=\{!endlessPerkChosen\}/);
  assert.match(source, /handleForgeExitAction\(action\.id\)/);
  assert.match(source, /dismissDefeatedIntrusion\(run\.weave\)/);
  assert.match(source, /本次天时已舍下，残余天变也已散去/);
  assert.match(css, /\.forge-blocker-shade\s*\{[\s\S]*?place-items: center/);
});

test("mobile start invokes audio and fullscreen from the same gesture", () => {
  const start = source.slice(
    source.indexOf("const startGame = async"),
    source.indexOf("const chooseUpgrade", source.indexOf("const startGame = async")),
  );
  const audioIndex = start.indexOf("initFromGesture");
  const fullscreenIndex = start.indexOf("requestGameFullscreen");
  const firstAwaitIndex = start.indexOf("await ");
  assert.ok(audioIndex >= 0 && audioIndex < firstAwaitIndex);
  assert.ok(fullscreenIndex >= 0 && fullscreenIndex < firstAwaitIndex);
});
