import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const sharp = require(
  process.env.PAPER_GUILD_SHARP_MODULE ??
    "../node_modules/.pnpm/node_modules/sharp",
);

const root = process.cwd();
const source = process.argv[2];
if (!source) {
  throw new Error("Usage: node scripts/build-v6-social-preview.mjs <imagegen-source>");
}

const titleFont = path.join(root, "work/fonts/MaShanZheng-Regular.ttf");
const textFont = path.join(root, "work/fonts/LXGWWenKaiGBScreen.ttf");

const escapeMarkup = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

async function textLayer(text, family, size, fontfile, color) {
  return sharp({
    text: {
      text: `<span font_desc="${family} ${size}" foreground="${color}">${escapeMarkup(text)}</span>`,
      font: family,
      fontfile,
      rgba: true,
      dpi: 72,
    },
  }).png().toBuffer();
}

const typography = await Promise.all([
  textLayer("纸上百工", "Ma Shan Zheng", 92, titleFont, "#221f1b"),
  textLayer("水墨剪纸 · 只移动的肉鸽", "LXGW WenKai GB Screen", 27, textFont, "#5e5548"),
  textLayer("十器三改法 · 四十五种合器", "LXGW WenKai GB Screen", 22, textFont, "#37342e"),
  textLayer("二十四节气 · 三层百工谱", "LXGW WenKai GB Screen", 22, textFont, "#37342e"),
  textLayer("第六卷", "LXGW WenKai GB Screen", 19, textFont, "#f7edd9"),
  textLayer("器盘 · 天变 · 随机班主", "LXGW WenKai GB Screen", 18, textFont, "#6d6253"),
]);

const overlay = Buffer.from(`
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="quiet" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#f4eedf" stop-opacity="0.96"/>
        <stop offset="0.72" stop-color="#f4eedf" stop-opacity="0.72"/>
        <stop offset="1" stop-color="#f4eedf" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="520" height="630" fill="url(#quiet)"/>
    <path d="M78 128 L78 412" stroke="#a44636" stroke-width="5" opacity="0.82"/>
    <path d="M111 282 C210 274 300 291 408 278" fill="none" stroke="#766b5d" stroke-width="1.5" opacity="0.48"/>
    <g transform="translate(111 424)">
      <rect width="96" height="38" rx="2" fill="#9c4234" opacity="0.94"/>
    </g>
  </svg>
`);

const layers = [
  { input: overlay, left: 0, top: 0 },
  { input: typography[0], left: 106, top: 120 },
  { input: typography[1], left: 111, top: 222 },
  { input: typography[2], left: 111, top: 306 },
  { input: typography[3], left: 111, top: 347 },
  { input: typography[4], left: 130, top: 432 },
  { input: typography[5], left: 222, top: 430 },
];

await sharp(source)
  .resize(1200, 630, { fit: "cover", position: "centre" })
  .composite(layers)
  .webp({ quality: 89, effort: 6 })
  .toFile(path.join(root, "public/og-v6.webp"));

await sharp(source)
  .resize(1200, 630, { fit: "cover", position: "centre" })
  .composite(layers)
  .png({ compressionLevel: 9, palette: true, quality: 95 })
  .toFile(path.join(root, "public/og.png"));

process.stdout.write("Built public/og.png and public/og-v6.webp\n");
