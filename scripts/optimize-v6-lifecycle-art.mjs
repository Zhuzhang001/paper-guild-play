import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
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
const ordinary = [
  "cup",
  "shoe",
  "lantern",
  "fish",
  "abacus",
  "umbrella",
  "lion",
  "puppet",
].map((id) => `public/enemies-v3/${id}-runtime.webp`);
const endlessBosses = [
  "boss-opera-master-v6.webp",
  "boss-ledger-clerk-v6.webp",
  "boss-night-watchman-v6.webp",
  "boss-kiln-overseer-v6.webp",
  "boss-siege-cart-v6.webp",
  "boss-banner-officer-v6.webp",
].map((file) => `public/enemies-v6/${file}`);

async function resize(file, width, height) {
  const absolute = path.join(root, file);
  const source = await readFile(absolute);
  const output = await sharp(source)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 91, alphaQuality: 100, effort: 6 })
    .toBuffer();
  await writeFile(absolute, output);
}

await Promise.all(ordinary.map((file) => resize(file, 640, 640)));
await Promise.all(endlessBosses.map((file) => resize(file, 1024, 1024)));
await resize("public/enemies-v6/boss-effects-v6.webp", 1280, 800);

process.stdout.write(
  "Optimized 8 ordinary sheets, 6 endless Boss sheets, and the Boss effect atlas for the v6 decode lifecycle.\n",
);
