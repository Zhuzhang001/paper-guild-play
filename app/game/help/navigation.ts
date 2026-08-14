import type { GuideSectionId } from "./model";

export type GuideNavigationLevel = "directory" | "section" | "entry";

export type GuideNavigationState = {
  level: GuideNavigationLevel;
  sectionId: GuideSectionId;
  entryId: string | null;
  directoryScrollTop: number;
  contentScrollTop: number;
};

export type GuideBackResult = {
  state: GuideNavigationState;
  shouldExit: boolean;
  focusEntryId: string | null;
};

export function createGuideNavigationState(
  sectionId: GuideSectionId,
): GuideNavigationState {
  return {
    level: "section",
    sectionId,
    entryId: null,
    directoryScrollTop: 0,
    contentScrollTop: 0,
  };
}

export function selectGuideSection(
  state: GuideNavigationState,
  sectionId: GuideSectionId,
  directoryScrollTop = state.directoryScrollTop,
): GuideNavigationState {
  return {
    ...state,
    level: "section",
    sectionId,
    entryId: null,
    directoryScrollTop,
    contentScrollTop: 0,
  };
}

export function toggleGuideEntry(
  state: GuideNavigationState,
  entryId: string,
  contentScrollTop = state.contentScrollTop,
): GuideNavigationState {
  const closing = state.level === "entry" && state.entryId === entryId;
  return {
    ...state,
    level: closing ? "section" : "entry",
    entryId: closing ? null : entryId,
    contentScrollTop,
  };
}

export function navigateGuideBack(
  state: GuideNavigationState,
): GuideBackResult {
  if (state.level === "entry") {
    return {
      state: { ...state, level: "section", entryId: null },
      shouldExit: false,
      focusEntryId: state.entryId,
    };
  }
  if (state.level === "section") {
    return {
      state: { ...state, level: "directory", entryId: null },
      shouldExit: false,
      focusEntryId: null,
    };
  }
  return { state, shouldExit: true, focusEntryId: null };
}
