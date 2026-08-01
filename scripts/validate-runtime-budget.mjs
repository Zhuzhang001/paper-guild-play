import { createRequire } from "node:module";
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const sharp = (() => {
  try {
    return require(process.env.PAPER_GUILD_SHARP_MODULE ?? "sharp");
  } catch {
    return require("../node_modules/.pnpm/node_modules/sharp");
  }
})();
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
  ...(await readdir(path.join(root, "public", "art-v5")))
    .filter(
      (file) => file.startsWith("fusion-") && file.endsWith("-runtime-v5.webp"),
    )
    .map((file) => `public/art-v5/${file}`),
];

const files = {
  seasons: [
    "public/art/season-spring-runtime.webp",
    "public/art/season-summer-runtime.webp",
    "public/art/season-autumn-runtime.webp",
    "public/art/season-winter-runtime.webp",
  ],
  standardEnemies: [
    "public/enemies-v3/cup-runtime.webp",
    "public/enemies-v3/shoe-runtime.webp",
    "public/enemies-v3/lantern-runtime.webp",
    "public/enemies-v3/fish-runtime.webp",
    "public/enemies-v3/abacus-runtime.webp",
    "public/enemies-v3/umbrella-runtime.webp",
    "public/enemies-v3/lion-runtime.webp",
    "public/enemies-v3/puppet-runtime.webp",
  ],
  standardBosses: [
    "public/enemies-v3/taotie-runtime.webp",
    "public/enemies-v3/nian-runtime.webp",
  ],
  endlessBosses: [
    "public/enemies-v6/boss-opera-master-v6.webp",
    "public/enemies-v6/boss-ledger-clerk-v6.webp",
    "public/enemies-v6/boss-night-watchman-v6.webp",
    "public/enemies-v6/boss-kiln-overseer-v6.webp",
    "public/enemies-v6/boss-siege-cart-v6.webp",
    "public/enemies-v6/boss-banner-officer-v6.webp",
  ],
  bossEffects: ["public/enemies-v6/boss-effects-v6.webp"],
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

async function largest(group, count) {
  return (await Promise.all(group.map(decodedBytes)))
    .sort((a, b) => b - a)
    .slice(0, count)
    .reduce((total, bytes) => total + bytes, 0);
}

const totals = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([group, entries]) => [group, await sum(entries)]),
  ),
);

// Runtime retention mirrors the browser stores: current season plus its two
// neighbours, all currently active ordinary archetypes, and either one
// standard Boss or up to three concurrent endless Bosses plus the preselected
// next Boss. The v6 effect atlas only lives with an endless Boss.
const retainedSeasonBytes = await largest(files.seasons, 3);
const retainedStandardEnemyBytes = totals.standardEnemies;
const standardBossPeakBytes = await largest(files.standardBosses, 1);
const endlessBossPeakBytes = await largest(files.endlessBosses, 4);
const standardActorPeakBytes =
  retainedStandardEnemyBytes + standardBossPeakBytes;
const endlessActorPeakBytes =
  retainedStandardEnemyBytes + endlessBossPeakBytes + totals.bossEffects;
const actorPeakBytes = Math.max(standardActorPeakBytes, endlessActorPeakBytes);
const largestWeaponBytes = await largest(files.weapons, 8);
const largestFusionBytes = await largest(files.fusions, 4);

const peakBytes =
  retainedSeasonBytes +
  actorPeakBytes +
  totals.always +
  largestWeaponBytes +
  largestFusionBytes;
const limitBytes = 96 * 1024 * 1024;
const report = {
  assumptions: {
    retainedSeasonSheets: 3,
    activeOrdinaryEnemySheets: files.standardEnemies.length,
    activeStandardBossSheets: 1,
    maxConcurrentEndlessBossSheets: 3,
    preselectedNextBossSheets: 1,
    authoredBossEffectSheets: files.bossEffects.length,
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
  lifecyclePeaksMiB: {
    seasons: Number((retainedSeasonBytes / 1024 / 1024).toFixed(2)),
    standardActors: Number((standardActorPeakBytes / 1024 / 1024).toFixed(2)),
    endlessActors: Number((endlessActorPeakBytes / 1024 / 1024).toFixed(2)),
    retainedWeapons: Number((largestWeaponBytes / 1024 / 1024).toFixed(2)),
    retainedFusions: Number((largestFusionBytes / 1024 / 1024).toFixed(2)),
  },
  estimatedPeakMiB: Number((peakBytes / 1024 / 1024).toFixed(2)),
  limitMiB: 96,
  pass: peakBytes <= limitBytes,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.pass) process.exitCode = 1;
