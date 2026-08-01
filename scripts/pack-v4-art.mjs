import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const DIRECTIONS = ["south", "southeast", "east", "northeast", "north"];
const CELL_WIDTH = 160;
const CELL_HEIGHT = 192;

function sourceCellBounds(size, count, index) {
  const start = Math.round((size * index) / count);
  const end = Math.round((size * (index + 1)) / count);
  return { start, size: end - start };
}

function alphaBounds(raw, width, height, channels) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (raw[(y * width + x) * channels + 3] < 16) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) {
    return { left: 0, top: 0, width: width, height: height };
  }
  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

function removeDetachedIslands(raw, width, height, channels) {
  for (let index = 0; index < width * height; index += 1) {
    const alphaIndex = index * channels + 3;
    if (raw[alphaIndex] < 96) raw[alphaIndex] = 0;
  }
  const visited = new Uint8Array(width * height);
  const components = [];
  const neighbors = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (visited[start] || raw[start * channels + 3] < 24) continue;
      const queue = [start];
      const pixels = [];
      let left = width;
      let right = -1;
      let top = height;
      let bottom = -1;
      visited[start] = 1;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const index = queue[cursor];
        pixels.push(index);
        const px = index % width;
        const py = Math.floor(index / width);
        left = Math.min(left, px);
        right = Math.max(right, px);
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
        for (const [dx, dy] of neighbors) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const next = ny * width + nx;
          if (visited[next] || raw[next * channels + 3] < 24) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
      components.push({ pixels, left, right, top, bottom });
    }
  }
  components.sort((a, b) => b.pixels.length - a.pixels.length);
  const primary = components[0];
  const largest = primary?.pixels.length ?? 0;
  const keep = new Uint8Array(width * height);
  for (const component of components) {
    const substantial = component.pixels.length >= largest * 0.78;
    if (component !== primary && !substantial) {
      continue;
    }
    for (const index of component.pixels) keep[index] = 1;
  }
  for (let index = 0; index < keep.length; index += 1) {
    const x = index % width;
    const y = Math.floor(index / width);
    if (!keep[index] || x < 7 || x >= width - 7 || y < 7 || y >= height - 7) {
      raw[index * channels + 3] = 0;
    }
  }
}

async function renderFrame(input, frameIndex) {
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Cannot read ${input}`);
  }
  const column = frameIndex % 4;
  const row = Math.floor(frameIndex / 4);
  const x = sourceCellBounds(metadata.width, 4, column);
  const y = sourceCellBounds(metadata.height, 3, row);
  const initial = await sharp(input)
    .extract({ left: x.start, top: y.start, width: x.size, height: y.size })
    .resize(CELL_WIDTH, CELL_HEIGHT, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  removeDetachedIslands(
    initial.data,
    initial.info.width,
    initial.info.height,
    initial.info.channels,
  );
  const buffer = await sharp(initial.data, {
    raw: {
      width: initial.info.width,
      height: initial.info.height,
      channels: initial.info.channels,
    },
  }).png().toBuffer();
  const decoded = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    buffer,
    bounds: alphaBounds(
      decoded.data,
      decoded.info.width,
      decoded.info.height,
      decoded.info.channels,
    ),
  };
}

async function packFold(inputDir, outputPath) {
  const frames = [];
  const composites = [];
  for (let directionIndex = 0; directionIndex < DIRECTIONS.length; directionIndex += 1) {
    const direction = DIRECTIONS[directionIndex];
    const input = path.join(inputDir, `${direction}-alpha.png`);
    for (let frameIndex = 0; frameIndex < 12; frameIndex += 1) {
      const frame = await renderFrame(input, frameIndex);
      composites.push({
        input: frame.buffer,
        left: frameIndex * CELL_WIDTH,
        top: directionIndex * CELL_HEIGHT,
      });
      const progress = frameIndex / 11;
      const bottom = frame.bounds.top + frame.bounds.height;
      frames.push({
        direction,
        frame: frameIndex,
        bounds: frame.bounds,
        collisionCenter: { x: CELL_WIDTH / 2, y: Math.min(CELL_HEIGHT - 24, bottom - 28) },
        feet: { x: CELL_WIDTH / 2, y: Math.min(CELL_HEIGHT - 8, bottom) },
        weaponSocket: {
          x: Math.round(104 + progress * 10),
          y: Math.round(92 + progress * 18),
        },
      });
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp({
    create: {
      width: CELL_WIDTH * 12,
      height: CELL_HEIGHT * DIRECTIONS.length,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 90, alphaQuality: 100, smartSubsample: true })
    .toFile(outputPath);

  const manifestPath = outputPath.replace(/\.[^.]+$/, ".anchors.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify({
      version: 4,
      columns: 12,
      rows: DIRECTIONS.length,
      cell: { width: CELL_WIDTH, height: CELL_HEIGHT },
      directions: DIRECTIONS,
      frames,
    }, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`${outputPath}\n${manifestPath}\n`);
}

async function renderGridCell(input, columns, rows, cellIndex, targetSize) {
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Cannot read ${input}`);
  const column = cellIndex % columns;
  const row = Math.floor(cellIndex / columns);
  const x = sourceCellBounds(metadata.width, columns, column);
  const y = sourceCellBounds(metadata.height, rows, row);
  const decoded = await sharp(input)
    .extract({ left: x.start, top: y.start, width: x.size, height: y.size })
    .resize(targetSize, targetSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  removeDetachedIslands(
    decoded.data,
    decoded.info.width,
    decoded.info.height,
    decoded.info.channels,
  );
  return sharp(decoded.data, {
    raw: {
      width: decoded.info.width,
      height: decoded.info.height,
      channels: decoded.info.channels,
    },
  }).png().toBuffer();
}

async function packWeaponSheet(inputPath, outputPath) {
  const columns = 7;
  const rows = 2;
  const targetSize = 256;
  const composites = [];
  for (let index = 0; index < columns * rows; index += 1) {
    composites.push({
      input: await renderGridCell(inputPath, columns, rows, index, targetSize),
      left: (index % columns) * targetSize,
      top: Math.floor(index / columns) * targetSize,
    });
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp({
    create: {
      width: columns * targetSize,
      height: rows * targetSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 88, alphaQuality: 100, smartSubsample: true })
    .toFile(outputPath);
  await writeFile(
    outputPath.replace(/\.[^.]+$/, ".atlas.json"),
    `${JSON.stringify({
      version: 4,
      columns,
      rows,
      cell: { width: targetSize, height: targetSize },
      frames: [
        "base",
        "refined",
        "route-a",
        "route-a-refined",
        "route-a-focus",
        "route-a-trigger",
        "route-b",
        "route-b-refined",
        "route-b-focus",
        "route-b-trigger",
        "route-c",
        "route-c-refined",
        "route-c-focus",
        "route-c-trigger",
      ],
    }, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`${outputPath}\n`);
}

async function renderFusionCell(input, cellIndex, targetSize) {
  const columns = 2;
  const rows = 2;
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Cannot read ${input}`);
  const column = cellIndex % columns;
  const row = Math.floor(cellIndex / columns);
  const x = sourceCellBounds(metadata.width, columns, column);
  const y = sourceCellBounds(metadata.height, rows, row);
  const decoded = await sharp(input)
    .extract({ left: x.start, top: y.start, width: x.size, height: y.size })
    .resize(targetSize, targetSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Fusion attacks intentionally contain several detached beads, blades or
  // sound marks. Preserve those authored pieces and only remove the grid seam
  // plus near-transparent chroma residue at the cell edge.
  const { data, info } = decoded;
  for (let index = 0; index < info.width * info.height; index += 1) {
    const px = index % info.width;
    const py = Math.floor(index / info.width);
    const alphaIndex = index * info.channels + 3;
    if (
      data[alphaIndex] < 40 ||
      px < 9 ||
      px >= info.width - 9 ||
      py < 9 ||
      py >= info.height - 9
    ) {
      data[alphaIndex] = 0;
    }
  }
  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  }).png().toBuffer();
}

async function packFusionSheet(inputPath, outputPath) {
  const columns = 2;
  const rows = 2;
  const targetSize = 512;
  const composites = [];
  for (let index = 0; index < columns * rows; index += 1) {
    composites.push({
      input: await renderFusionCell(inputPath, index, targetSize),
      left: (index % columns) * targetSize,
      top: Math.floor(index / columns) * targetSize,
    });
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp({
    create: {
      width: columns * targetSize,
      height: rows * targetSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 88, alphaQuality: 100, smartSubsample: true })
    .toFile(outputPath);
  await writeFile(
    outputPath.replace(/\.[^.]+$/, ".atlas.json"),
    `${JSON.stringify({
      version: 5,
      columns,
      rows,
      cell: { width: targetSize, height: targetSize },
      frames: ["body", "windup", "attack", "finish"],
    }, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`${outputPath}\n`);
}

const [command, inputDir, outputPath] = process.argv.slice(2);
if (
  !inputDir ||
  !outputPath ||
  !["hero-fold", "weapon-sheet", "fusion-sheet"].includes(command)
) {
  throw new Error(
    "Usage: node scripts/pack-v4-art.mjs <hero-fold|weapon-sheet|fusion-sheet> <input> <output.webp>",
  );
}

if (command === "hero-fold") {
  await packFold(path.resolve(inputDir), path.resolve(outputPath));
} else if (command === "weapon-sheet") {
  await packWeaponSheet(path.resolve(inputDir), path.resolve(outputPath));
} else {
  await packFusionSheet(path.resolve(inputDir), path.resolve(outputPath));
}
