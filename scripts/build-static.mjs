import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const valueAfter = (flag, fallback = "") => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
};
const target = valueAfter("--target", "github-pages");
const baseName = valueAfter(
  "--base",
  target === "github-pages" ? "paper-guild-play" : "",
);
const basePath = baseName ? `/${baseName.replace(/^\/+|\/+$/g, "")}` : "";
const githubOwner =
  process.env.GITHUB_OWNER || process.env.GITHUB_REPOSITORY?.split("/")[0];
const siteOrigin =
  process.env.PAPER_GUILD_SITE_ORIGIN ||
  (target === "github-pages" && githubOwner
    ? `https://${githubOwner}.github.io${basePath}`
    : "https://paper-guild-zh.akonya635.chatgpt.site");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    PAPER_GUILD_STATIC_EXPORT: "1",
    PAPER_GUILD_BASE_PATH: basePath,
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_BUILD_TARGET: target,
    NEXT_PUBLIC_SITE_ORIGIN: siteOrigin,
  },
});

const result = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => resolve({ code, signal }));
});

if (result.signal) {
  throw new Error(`Static build stopped by ${result.signal}.`);
}
if (result.code !== 0) {
  process.exitCode = result.code ?? 1;
} else if (target === "github-pages") {
  // GitHub Pages otherwise lets Jekyll discard Next's `_next` directory.
  await writeFile(path.join(root, "out", ".nojekyll"), "", "utf8");
}
