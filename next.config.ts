import type { NextConfig } from "next";

const staticExport = process.env.PAPER_GUILD_STATIC_EXPORT === "1";
const basePath = process.env.PAPER_GUILD_BASE_PATH
  ? `/${process.env.PAPER_GUILD_BASE_PATH.replace(/^\/+|\/+$/g, "")}`
  : "";

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" as const, trailingSlash: true } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  images: { unoptimized: staticExport },
  // The regular Sites build supplies Cloudflare's runtime types through
  // vinext. A plain `next build` for a static mirror has no Worker runtime,
  // so type-check only the client application instead of the unused db/worker
  // entry points. This keeps type checking enabled for everything we export.
  ...(staticExport
    ? { typescript: { tsconfigPath: "tsconfig.game.json" } }
    : {}),
};

export default nextConfig;
