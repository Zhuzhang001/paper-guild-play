import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require(process.env.PAPER_GUILD_SHARP_MODULE ?? "sharp");

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error("Usage: node scripts/pack-v6-boss-effects.mjs <input> <output.webp>");
}

const source = await sharp(input).ensureAlpha().raw().toBuffer({
  resolveWithObject: true,
});
const pixels = source.data;
for (let offset = 0; offset < pixels.length; offset += 4) {
  const red = pixels[offset];
  const green = pixels[offset + 1];
  const blue = pixels[offset + 2];
  const strongestNonGreen = Math.max(red, blue);
  const dominance = green - strongestNonGreen;
  const greenRatio = green / Math.max(1, strongestNonGreen);
  if (dominance < 9 || greenRatio <= 1.08) continue;

  // The generated plate contains block-compressed green spill several pixels
  // beyond the painted ink edge. Removing all keyed pixels cleanly is better
  // than retaining a translucent square halo; canvas down-sampling supplies a
  // stable one-pixel display edge at the final 32–120 px sizes.
  pixels[offset] = 0;
  pixels[offset + 1] = 0;
  pixels[offset + 2] = 0;
  pixels[offset + 3] = 0;
}

await sharp(pixels, {
  raw: {
    width: source.info.width,
    height: source.info.height,
    channels: 4,
  },
})
  .webp({ quality: 90, alphaQuality: 100, smartSubsample: true })
  .toFile(output);
