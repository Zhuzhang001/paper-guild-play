"use client";

import type { GuideSectionId } from "./model";
import { GUIDE_DOCUMENT } from "./model";
import { GuideView } from "./GuideView";

export default function GuideOverlay({ onClose, section }: { onClose: () => void; section?: GuideSectionId }) {
  return <GuideView document={GUIDE_DOCUMENT} initialSection={section} overlay onClose={onClose} />;
}
