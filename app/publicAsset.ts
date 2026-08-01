export type StaticBuildTarget = "sites" | "github-pages" | "offline";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const PUBLIC_BASE_PATH = rawBasePath
  ? `/${rawBasePath.replace(/^\/+|\/+$/g, "")}`
  : "";

export const STATIC_BUILD_TARGET = (
  process.env.NEXT_PUBLIC_BUILD_TARGET ?? "sites"
) as StaticBuildTarget;

export type PublicAssetResolver = (path: string) => string;

export const publicAsset: PublicAssetResolver = (path) => {
  if (
    !path ||
    path.startsWith("data:") ||
    path.startsWith("blob:") ||
    /^https?:\/\//i.test(path)
  ) {
    return path;
  }
  const normalized = `/${path.replace(/^\/+/, "")}`;
  if (PUBLIC_BASE_PATH && normalized.startsWith(`${PUBLIC_BASE_PATH}/`)) {
    return normalized;
  }
  return `${PUBLIC_BASE_PATH}${normalized}`;
};

export type BuildInfo = {
  version: string;
  contentVersion: 6;
  target: StaticBuildTarget;
  basePath: string;
};

export const BUILD_INFO: BuildInfo = Object.freeze({
  version: "6.2.0",
  contentVersion: 6,
  target: STATIC_BUILD_TARGET,
  basePath: PUBLIC_BASE_PATH,
});
