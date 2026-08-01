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
const artDir = path.join(root, "public", "art-v5");
const fusionIds = [
  "countedSword",
  "markedThunderSword",
  "windScissors",
  "windAbacus",
  "windLantern",
  "windThunder",
  "beadCanopy",
  "canopyVolley",
  "boltScissors",
  "thunderScissors",
  "stringCrossbow",
  "lanternStrings",
  "inkShadow",
  "inkThunderRoad",
  "lanternThunder",
];
const frameNames = ["body", "windup", "attack", "finish"];
const failures = [];
let totalBytes = 0;

for (const id of fusionIds) {
  const basename = `fusion-${id}-runtime-v5`;
  const imagePath = path.join(artDir, `${basename}.webp`);
  const atlasPath = path.join(artDir, `${basename}.atlas.json`);
  let metadata;
  try {
    metadata = await sharp(imagePath).metadata();
    totalBytes += (await stat(imagePath)).size;
  } catch (error) {
    failures.push(`${id}: unreadable image (${error.message})`);
    continue;
  }
  if (metadata.width !== 1024 || metadata.height !== 1024) {
    failures.push(`${id}: expected 1024x1024, got ${metadata.width}x${metadata.height}`);
  }
  if (!metadata.hasAlpha) failures.push(`${id}: missing alpha channel`);

  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let visible = 0;
  let greenEdge = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha < 8) transparent += 1;
    if (alpha > 96) visible += 1;
    if (
      alpha > 20 &&
      alpha < 245 &&
      green > 140 &&
      green > red + 80 &&
      green > blue + 80
    ) {
      greenEdge += 1;
    }
  }
  const pixels = info.width * info.height;
  if (transparent / pixels < 0.25) failures.push(`${id}: transparent area below 25%`);
  if (visible / pixels < 0.02) failures.push(`${id}: visible artwork below 2%`);
  if (greenEdge > 0) failures.push(`${id}: chroma fringe exceeds tolerance`);

  try {
    const atlas = JSON.parse(await readFile(atlasPath, "utf8"));
    if (
      atlas.version !== 5 ||
      atlas.columns !== 2 ||
      atlas.rows !== 2 ||
      JSON.stringify(atlas.frames) !== JSON.stringify(frameNames)
    ) {
      failures.push(`${id}: invalid v5 2x2 frame manifest`);
    }
  } catch (error) {
    failures.push(`${id}: unreadable atlas (${error.message})`);
  }
}

const actualImages = (await readdir(artDir))
  .filter((file) => file.endsWith("-runtime-v5.webp"));
if (actualImages.length !== fusionIds.length) {
  failures.push(`art-v5 contains ${actualImages.length} runtime images, expected ${fusionIds.length}`);
}

const report = {
  checked: fusionIds.length,
  totalMiB: Number((totalBytes / 1024 / 1024).toFixed(2)),
  failures,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
