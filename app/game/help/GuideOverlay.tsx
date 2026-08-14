"use client";

import type { GuideSectionId } from "./model";
import { GUIDE_DOCUMENT } from "./model";
import { GuideView } from "./GuideView";

export default function GuideOverlay({ onExit, section }: { onExit: () => void; section?: GuideSectionId }) {
  return <GuideView document={GUIDE_DOCUMENT} initialSection={section} overlay onExit={onExit} />;
}
