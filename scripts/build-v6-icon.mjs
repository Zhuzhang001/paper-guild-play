import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const sharp = require(
  process.env.PAPER_GUILD_SHARP_MODULE ??
    "../node_modules/.pnpm/node_modules/sharp",
);

const source = process.argv[2];
if (!source) {
  throw new Error("Usage: node scripts/build-v6-icon.mjs <imagegen-source>");
}

await sharp(source)
  .resize(512, 512, { fit: "cover", position: "centre" })
  .png({ compressionLevel: 9, palette: true, quality: 95 })
  .toFile(path.join(process.cwd(), "app", "icon.png"));

process.stdout.write("Built app/icon.png\n");
