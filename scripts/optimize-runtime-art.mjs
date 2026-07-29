import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = process.cwd();

async function resizeWebp(sourcePath, outputPath, width, height, quality = 86) {
  const source = path.join(root, sourcePath);
  const output = path.join(root, outputPath);
  await sharp(source)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .webp({ quality, alphaQuality: 100, smartSubsample: true })
    .toFile(output);
}

for (const season of ["spring", "summer", "autumn", "winter"]) {
  await resizeWebp(
    `public/art/season-${season}.webp`,
    `public/art/season-${season}-runtime.webp`,
    1280,
    720,
    86,
  );
}
for (const enemy of [
  "cup",
  "shoe",
  "lantern",
  "fish",
  "abacus",
  "umbrella",
  "lion",
  "puppet",
]) {
  await resizeWebp(
    `public/enemies-v3/${enemy}.webp`,
    `public/enemies-v3/${enemy}-runtime.webp`,
    768,
    768,
    88,
  );
}
for (const boss of ["taotie", "nian"]) {
  await resizeWebp(
    `public/enemies-v3/${boss}.webp`,
    `public/enemies-v3/${boss}-runtime.webp`,
    1024,
    1024,
    89,
  );
}
await resizeWebp(
  "public/terms-v3/solar-terms.webp",
  "public/terms-v3/solar-terms-runtime.webp",
  1152,
  768,
  88,
);
await resizeWebp(
  "public/art-v4/hero-fold-v4.webp",
  "public/art-v4/hero-fold-runtime-v4.webp",
  1440,
  720,
  90,
);

for (const weapon of [
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
]) {
  await resizeWebp(
    `public/art-v4/weapon-${weapon}-v4.webp`,
    `public/art-v4/weapon-${weapon}-runtime-v4.webp`,
    1344,
    384,
    89,
  );
}
for (const fusion of [
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
]) {
  await resizeWebp(
    `public/art-v4/fusion-${fusion}-v4.webp`,
    `public/art-v4/fusion-${fusion}-runtime-v4.webp`,
    768,
    768,
    88,
  );
}

process.stdout.write("Optimized runtime art to its maximum authored display size.\n");
