import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoot = path.join(root, "app");
const textExtensions = new Set([".ts", ".tsx", ".css"]);

async function collectText(directory) {
  let result = "";
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result += await collectText(filePath);
    else if (textExtensions.has(path.extname(entry.name))) {
      result += await readFile(filePath, "utf8");
    }
  }
  return result;
}

const sourceText = await collectText(sourceRoot);
const characters = [...new Set([
  ..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  ..."，。；：！？、（）《》「」『』【】—…·×→｜％℃+-./: ",
  ...sourceText,
])].sort().join("");
const workDir = path.join(root, "work", "fonts");
await mkdir(workDir, { recursive: true });
const textPath = path.join(workDir, "game-glyphs.txt");
await writeFile(textPath, characters, "utf8");

const pyftsubset = process.env.PYFTSUBSET || "pyftsubset";
const jobs = [
  {
    source: path.join(workDir, "LXGWWenKaiGBScreen.ttf"),
    output: path.join(root, "public", "fonts", "LXGWWenKaiScreen-Game.woff2"),
  },
  {
    source: path.join(workDir, "MaShanZheng-Regular.ttf"),
    output: path.join(root, "public", "fonts", "MaShanZheng-Game.woff2"),
  },
];
for (const job of jobs) {
  execFileSync(
    pyftsubset,
    [
      job.source,
      `--text-file=${textPath}`,
      `--output-file=${job.output}`,
      "--flavor=woff2",
      "--layout-features=*",
      "--glyph-names",
      "--symbol-cmap",
      "--legacy-cmap",
      "--notdef-glyph",
      "--recommended-glyphs",
      "--name-IDs=*",
      "--name-languages=*",
    ],
    { stdio: "inherit" },
  );
}
process.stdout.write(`Subset ${characters.length} source characters into two web fonts.\n`);
