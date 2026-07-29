import { createRequire } from "node:module";
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = process.cwd();
const fusionFiles = [
  ...(await readdir(path.join(root, "public", "art-v3")))
    .filter((file) => file.startsWith("fusion-") && file.endsWith("-v3.webp"))
    .map((file) => `public/art-v3/${file}`),
  ...(await readdir(path.join(root, "public", "art-v4")))
    .filter(
      (file) => file.startsWith("fusion-") && file.endsWith("-runtime-v4.webp"),
    )
    .map((file) => `public/art-v4/${file}`),
];

const files = {
  seasons: [
    "public/art/season-spring-runtime.webp",
    "public/art/season-summer-runtime.webp",
    "public/art/season-autumn-runtime.webp",
    "public/art/season-winter-runtime.webp",
  ],
  enemies: [
    "public/enemies-v3/cup-runtime.webp",
    "public/enemies-v3/shoe-runtime.webp",
    "public/enemies-v3/lantern-runtime.webp",
    "public/enemies-v3/fish-runtime.webp",
    "public/enemies-v3/abacus-runtime.webp",
    "public/enemies-v3/umbrella-runtime.webp",
    "public/enemies-v3/lion-runtime.webp",
    "public/enemies-v3/puppet-runtime.webp",
    "public/enemies-v3/taotie-runtime.webp",
    "public/enemies-v3/nian-runtime.webp",
  ],
  always: [
    "public/terms-v3/solar-terms-runtime.webp",
    "public/art-v3/hero-directions-v3.webp",
    "public/art-v4/hero-fold-runtime-v4.webp",
    "public/art-v3/pickup-paperlight-v3.webp",
    "public/art-v3/effect-projectiles-v3.webp",
    "public/art-v3/effect-impacts-v3.webp",
    "public/art-v3/effect-supernatural-v3.webp",
  ],
  weapons: [
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
  ].map((id) => `public/art-v4/weapon-${id}-runtime-v4.webp`),
  fusions: fusionFiles,
};

async function decodedBytes(file) {
  const metadata = await sharp(path.join(root, file)).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`${file}: missing dimensions`);
  }
  return metadata.width * metadata.height * 4;
}

async function sum(group) {
  return (
    await Promise.all(group.map(async (file) => [file, await decodedBytes(file)]))
  ).reduce((total, [, bytes]) => total + bytes, 0);
}

const totals = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([group, entries]) => [group, await sum(entries)]),
  ),
);

// All four season plates and every enemy sheet are deliberately included.
// The visual pack is pruned to at most eight held weapon atlases and four
// active fusion atlases; this is stricter than a normal standard-mode frame.
const largestWeaponBytes = (
  await Promise.all(files.weapons.map(decodedBytes))
)
  .sort((a, b) => b - a)
  .slice(0, 8)
  .reduce((total, bytes) => total + bytes, 0);
const largestFusionBytes = (
  await Promise.all(files.fusions.map(decodedBytes))
)
  .sort((a, b) => b - a)
  .slice(0, 4)
  .reduce((total, bytes) => total + bytes, 0);

const peakBytes =
  totals.seasons +
  totals.enemies +
  totals.always +
  largestWeaponBytes +
  largestFusionBytes;
const limitBytes = 96 * 1024 * 1024;
const report = {
  assumptions: {
    seasonSheets: files.seasons.length,
    enemySheets: files.enemies.length,
    heldWeaponAtlases: 8,
    activeFusionAtlases: 4,
    rgbaBytesPerPixel: 4,
  },
  groupsMiB: Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [
      key,
      Number((value / 1024 / 1024).toFixed(2)),
    ]),
  ),
  estimatedPeakMiB: Number((peakBytes / 1024 / 1024).toFixed(2)),
  limitMiB: 96,
  pass: peakBytes <= limitBytes,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.pass) process.exitCode = 1;
