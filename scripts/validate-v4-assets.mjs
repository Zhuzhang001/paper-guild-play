import { createRequire } from "node:module";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const sharp = (() => {
  try {
    return require("sharp");
  } catch {
    return require("../node_modules/.pnpm/node_modules/sharp");
  }
})();
const root = process.cwd();
const artDir = path.join(root, "public", "art-v4");

const expected = new Map([
  ["hero-fold-runtime-v4.webp", { width: 1440, height: 720 }],
  ...[
    "sword",
    "fan",
    "umbrella",
    "scissors",
    "abacus",
    "crossbow",
    "pipa",
    "inkline",
    "lantern",
    "thunder",
  ].map((id) => [`weapon-${id}-runtime-v4.webp`, { width: 1344, height: 384 }]),
  ...[
    "galeBamboo",
    "hiddenSwordCanopy",
    "twinTailorBlades",
    "inkRuleSword",
    "windRepeater",
    "windStringPass",
    "inkRainBoundary",
    "rainStringCanopy",
    "stringScissor",
    "shadowScissor",
    "pearlInkLine",
    "countedLantern",
    "pearlThunder",
    "thunderBoltRoad",
    "inkScore",
  ].map((id) => [`fusion-${id}-runtime-v4.webp`, { width: 768, height: 768 }]),
]);

const failures = [];
let totalBytes = 0;
for (const [file, dimensions] of expected) {
  const filePath = path.join(artDir, file);
  let metadata;
  try {
    metadata = await sharp(filePath).metadata();
    totalBytes += (await stat(filePath)).size;
  } catch (error) {
    failures.push(`${file}: unreadable (${error.message})`);
    continue;
  }
  if (
    metadata.width !== dimensions.width ||
    metadata.height !== dimensions.height
  ) {
    failures.push(
      `${file}: ${metadata.width}x${metadata.height}, expected ${dimensions.width}x${dimensions.height}`,
    );
  }
  if (!metadata.hasAlpha) failures.push(`${file}: missing alpha channel`);

  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let visible = 0;
  for (let index = 3; index < data.length; index += info.channels) {
    if (data[index] < 8) transparent += 1;
    if (data[index] > 96) visible += 1;
  }
  const pixels = info.width * info.height;
  if (transparent / pixels < 0.08) {
    failures.push(`${file}: transparent area below 8%`);
  }
  if (visible / pixels < 0.01) {
    failures.push(`${file}: visible artwork below 1%`);
  }
}

const anchorPath = path.join(artDir, "hero-fold-v4.anchors.json");
const anchors = JSON.parse(await readFile(anchorPath, "utf8"));
if (
  anchors.columns !== 12 ||
  anchors.rows !== 5 ||
  anchors.frames?.length !== 60
) {
  failures.push("hero fold anchor manifest must contain 12x5 / 60 frames");
}
for (const frame of anchors.frames ?? []) {
  if (!frame.collisionCenter || !frame.feet || !frame.weaponSocket) {
    failures.push(`hero fold anchor missing fields at frame ${frame.frame}`);
    break;
  }
}

const actualWebps = (await readdir(artDir)).filter((file) =>
  file.endsWith(".webp"),
);
const report = {
  checked: expected.size,
  artV4Webps: actualWebps.length,
  totalBytes,
  totalMiB: Number((totalBytes / 1024 / 1024).toFixed(2)),
  failures,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
