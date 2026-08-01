# 纸上百工

《纸上百工》是一款横屏、只需移动的水墨剪纸幸存者式肉鸽游戏。标准局在八分钟内走过二十四节气；击败年兽后可进入无尽器盘，继续添器、调位、合器并应对天变。

当前状态：测试版

## 在线游玩

- 主站：[GitHub Pages](https://zhuzhang001.github.io/paper-guild-play/)
- 备用镜像：[Sites](https://paper-guild-zh.akonya635.chatgpt.site/)

无需账号。进度保存在当前浏览器的 `localStorage` 中，不同设备和两个站点之间不会自动同步。

## 操作

- 电脑：WASD、方向键或手柄移动。
- 手机：横屏使用虚拟摇杆；开始时会尝试进入全屏，失败时仍可在普通浏览器中游玩。
- 攻击、格挡、召唤与器盘效果均自动触发。
- 暂停页输入 `BAIGONG` 可打开本局测试工具。

## 本地开发

需要 Node.js 22.13 或更高版本。

```bash
npm ci
npm run dev
```

常用验证命令：

```bash
npm run typecheck:game
npm test
npm run build:static:github
```

GitHub Pages 由 `.github/workflows/pages.yml` 构建，静态资源统一部署在 `/paper-guild-play/` 子路径。字体与声音素材的原始许可见 `public/fonts/` 与 `public/audio/CREDITS.md`。
