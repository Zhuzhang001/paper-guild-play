import { readFile } from "node:fs/promises";

const files = [
  "app/PaperGuildGame.tsx",
  "app/game/runtime/forgeExit.ts",
  "app/game/help/model.ts",
];
const forbidden = [
  "角色已强制展开",
  "卡死",
  "美工图集",
  "素材补载",
  "自动采用最短",
  "不会替你",
  "写入器盘状态",
];

const failures = [];
for (const file of files) {
  let source = await readFile(file, "utf8");
  if (file.endsWith("PaperGuildGame.tsx")) {
    source = source.replace(
      /\{testPanelUnlocked\s*&&\s*\([\s\S]*?\n\s*\)\}/u,
      "",
    );
  }
  for (const phrase of forbidden) {
    if (source.includes(phrase)) failures.push(`${file}: 玩家文案包含“${phrase}”`);
  }
}
const playerSource = await readFile("app/PaperGuildGame.tsx", "utf8");
for (const phrase of ["精英和 Boss 更坚韧", "Boss更勤", "无尽 Boss 预算提高四成"]) {
  if (playerSource.includes(phrase)) {
    failures.push(`app/PaperGuildGame.tsx: 正常玩家界面请统一使用“首领”（${phrase}）`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`player copy check passed (${files.length} files)`);
}
