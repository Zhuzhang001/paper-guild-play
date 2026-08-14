import type { Metadata } from "next";
import { GuideView } from "../game/help/GuideView";
import { GUIDE_DOCUMENT } from "../game/help/model";
import { publicAsset } from "../publicAsset";

export const metadata: Metadata = {
  title: "百工手册｜纸上百工",
  description: "纸上百工测试版的完整玩法、器物、首领与无尽数值手册。",
};

export default function GuidePage() {
  return <GuideView document={GUIDE_DOCUMENT} exitTarget={publicAsset("/")} />;
}
