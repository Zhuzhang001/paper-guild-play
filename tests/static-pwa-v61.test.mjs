import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const text = (relative) =>
  readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("v6.1 has a conditional static export and base-path aware public assets", async () => {
  const [config, helper, script] = await Promise.all([
    text("next.config.ts"),
    text("app/publicAsset.ts"),
    text("scripts/build-static.mjs"),
  ]);
  assert.match(config, /PAPER_GUILD_STATIC_EXPORT/);
  assert.match(config, /output:\s*"export"/);
  assert.match(config, /basePath/);
  assert.match(config, /tsconfig\.game\.json/);
  assert.match(helper, /export const publicAsset/);
  assert.match(helper, /NEXT_PUBLIC_BASE_PATH/);
  assert.match(script, /paper-guild-play/);
  assert.match(script, /GITHUB_REPOSITORY/);
  assert.match(script, /NEXT_PUBLIC_BUILD_TARGET/);
  assert.match(script, /\.nojekyll/);
});

test("all runtime asset loaders resolve public paths through the shared helper", async () => {
  const files = await Promise.all([
    text("app/game/art.ts"),
    text("app/game/renderGame.ts"),
    text("app/game/visual/index.ts"),
    text("app/game/actors/enemySprites.ts"),
    text("app/game/world/audio.ts"),
  ]);
  for (const source of files) assert.match(source, /publicAsset/);
  assert.match(files[2], /fetch\(publicAsset\(src\)/);
  assert.match(files[4], /fetch\(publicAsset\(url\)\)/);
});

test("PWA remains landscape, installs locally, and defers activation to an explicit safe update", async () => {
  const [manifestRaw, sw, bootstrap, layout] = await Promise.all([
    text("public/manifest.webmanifest"),
    text("public/sw.js"),
    text("app/PwaBootstrap.tsx"),
    text("app/layout.tsx"),
  ]);
  const manifest = JSON.parse(manifestRaw);
  assert.deepEqual(manifest.display_override, ["fullscreen", "standalone"]);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "landscape");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  assert.match(sw, /SKIP_WAITING/);
  const installBlock = sw.slice(
    sw.indexOf('addEventListener("install"'),
    sw.indexOf('addEventListener("message"'),
  );
  assert.doesNotMatch(installBlock, /skipWaiting/);
  assert.match(bootstrap, /SAFE_PHASES/);
  assert.match(bootstrap, /data-game-phase/);
  assert.match(layout, /index:\s*false/);
  await access(new URL("../public/icon-192.png", import.meta.url));
  await access(new URL("../app/icon.png", import.meta.url));
});

test("build identity is shared by both mirrors", async () => {
  const [versionRaw, helper] = await Promise.all([
    text("public/version.json"),
    text("app/publicAsset.ts"),
  ]);
  const version = JSON.parse(versionRaw);
  assert.equal(version.version, "6.2.0");
  assert.match(helper, /version:\s*"6\.2\.0"/);
  assert.equal(version.contentVersion, 6);
});
