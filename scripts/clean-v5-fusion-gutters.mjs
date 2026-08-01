import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

function isBorderWhite(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const brightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  return red >= 228 && green >= 228 && blue >= 228 && brightest - darkest <= 30;
}

async function removeConnectedWhiteGutters(inputPath, outputPath) {
  const decoded = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = decoded;
  const pixelCount = info.width * info.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const canVisit = (index) => {
    const offset = index * info.channels;
    return data[offset + 3] <= 4 || isBorderWhite(data, offset);
  };
  const enqueue = (index) => {
    if (visited[index] || !canVisit(index)) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < info.width; x += 1) {
    enqueue(x);
    enqueue((info.height - 1) * info.width + x);
  }
  for (let y = 1; y < info.height - 1; y += 1) {
    enqueue(y * info.width);
    enqueue(y * info.width + info.width - 1);
  }

  let cleared = 0;
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const offset = index * info.channels;
    if (data[offset + 3] > 4 && isBorderWhite(data, offset)) {
      data[offset + 3] = 0;
      cleared += 1;
    }
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < info.width) enqueue(index + 1);
    if (y > 0) enqueue(index - info.width);
    if (y + 1 < info.height) enqueue(index + info.width);
  }

  const outerBand = Math.ceil(Math.min(info.width, info.height) * 0.018);
  const seamBand = Math.ceil(Math.min(info.width, info.height) * 0.012);
  const centerX = info.width / 2;
  const centerY = info.height / 2;
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * info.channels;
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    const inSafetyBand =
      x < outerBand ||
      x >= info.width - outerBand ||
      y < outerBand ||
      y >= info.height - outerBand ||
      Math.abs(x + 0.5 - centerX) < seamBand ||
      Math.abs(y + 0.5 - centerY) < seamBand;
    if (!inSafetyBand && data[offset + 3] > 4) continue;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toFile(outputPath);
  process.stdout.write(`${path.resolve(outputPath)} cleared=${cleared}\n`);
}

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error(
    "Usage: node scripts/clean-v5-fusion-gutters.mjs <input-alpha.png> <output-alpha.png>",
  );
}

await removeConnectedWhiteGutters(path.resolve(inputPath), path.resolve(outputPath));
