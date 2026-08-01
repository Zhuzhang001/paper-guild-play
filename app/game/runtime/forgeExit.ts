/**
 * The single source of truth for leaving the forge.
 *
 * Except for `processing`, every state is an actionable blocker.  Callers
 * should keep the continue button enabled, then present the returned actions
 * when it is pressed.  This makes a blocked exit explain itself instead of
 * looking like a broken button.
 */
export type ForgeExitState =
  | "processing"
  | "needsPerk"
  | "needsPairReplacement"
  | "needsPrimaryWeapon"
  | "unconfirmedPreview"
  | "celestialRewardPending"
  | "ready";

export type ForgeExitActionId =
  | "focusPerkChoice"
  | "focusPairReplacement"
  | "focusPrimaryWeapon"
  | "returnToPreview"
  | "discardPreview"
  | "returnToCelestialReward"
  | "dismissCelestialReward";

export type ForgeExitAction = Readonly<{
  id: ForgeExitActionId;
  label: string;
  emphasis: "primary" | "secondary";
}>;

export type ForgeExitBlocker = Readonly<{
  state: Exclude<ForgeExitState, "ready">;
  title: string;
  description: string;
  actions: readonly ForgeExitAction[];
  /** Only an in-flight confirmation may disable the continue control. */
  disablesContinue: boolean;
}>;

export type ForgeExitContext = Readonly<{
  processing?: boolean;
  perkRequired?: boolean;
  perkChosen?: boolean;
  pairReplacementPending?: boolean;
  primaryWeaponRequired?: boolean;
  primaryWeaponValid?: boolean;
  previewPending?: boolean;
  celestialRewardPending?: boolean;
}>;

/** Ordered from the most specific/urgent exit state to a completed exit. */
export const FORGE_EXIT_PRIORITY = [
  "processing",
  "needsPairReplacement",
  "needsPerk",
  "needsPrimaryWeapon",
  "unconfirmedPreview",
  "celestialRewardPending",
  "ready",
] as const satisfies readonly ForgeExitState[];

const BLOCKERS: Readonly<
  Record<Exclude<ForgeExitState, "ready">, ForgeExitBlocker>
> = {
  processing: {
    state: "processing",
    title: "正在落锤",
    description: "铸器结果正在写入器盘，请稍候。",
    actions: [],
    disablesContinue: true,
  },
  needsPerk: {
    state: "needsPerk",
    title: "尚未选择百工谱",
    description: "本轮须先收下一页百工谱；可以不花炉火，也可以不合器。",
    actions: [
      {
        id: "focusPerkChoice",
        label: "去选百工谱",
        emphasis: "primary",
      },
    ],
    disablesContinue: false,
  },
  needsPairReplacement: {
    state: "needsPairReplacement",
    title: "合页尚未替换",
    description: "合页已满六项，请先选一项旧合页替下，再装订新页。",
    actions: [
      {
        id: "focusPairReplacement",
        label: "去替换合页",
        emphasis: "primary",
      },
    ],
    disablesContinue: false,
  },
  needsPrimaryWeapon: {
    state: "needsPrimaryWeapon",
    title: "照样对象失效",
    description: "走马灯需要一把当前持有的非走马灯武器作为照样对象。",
    actions: [
      {
        id: "focusPrimaryWeapon",
        label: "重选照样对象",
        emphasis: "primary",
      },
    ],
    disablesContinue: false,
  },
  unconfirmedPreview: {
    state: "unconfirmedPreview",
    title: "预览尚未处理",
    description: "这项变化还没有落锤。请返回确认，或放弃本次预览。",
    actions: [
      {
        id: "returnToPreview",
        label: "返回确认",
        emphasis: "primary",
      },
      {
        id: "discardPreview",
        label: "放弃预览",
        emphasis: "secondary",
      },
    ],
    disablesContinue: false,
  },
  celestialRewardPending: {
    state: "celestialRewardPending",
    title: "天时尚未处置",
    description: "本次天时可以炼入器盘，也可以明确放弃后继续行旅。",
    actions: [
      {
        id: "returnToCelestialReward",
        label: "返回炼化",
        emphasis: "primary",
      },
      {
        id: "dismissCelestialReward",
        label: "放弃天时",
        emphasis: "secondary",
      },
    ],
    disablesContinue: false,
  },
};

/**
 * Resolves the highest-priority reason that the forge cannot close.
 *
 * A pending pair replacement is the completion of the perk choice, so it
 * takes precedence over the generic `needsPerk` state.  Likewise, an open
 * preview is handled before the underlying celestial reward: the player must
 * first confirm or discard that preview.
 */
export function getForgeExitState(context: ForgeExitContext): ForgeExitState {
  if (context.processing) return "processing";
  if (context.pairReplacementPending) return "needsPairReplacement";
  if (context.perkRequired && !context.perkChosen) return "needsPerk";
  if (context.primaryWeaponRequired && !context.primaryWeaponValid) {
    return "needsPrimaryWeapon";
  }
  if (context.previewPending) return "unconfirmedPreview";
  if (context.celestialRewardPending) return "celestialRewardPending";
  return "ready";
}

export function getForgeExitBlocker(
  state: ForgeExitState,
): ForgeExitBlocker | undefined {
  return state === "ready" ? undefined : BLOCKERS[state];
}

export type ForgeExitResolution = Readonly<{
  state: ForgeExitState;
  blocker?: ForgeExitBlocker;
}>;

export function resolveForgeExit(
  context: ForgeExitContext,
): ForgeExitResolution {
  const state = getForgeExitState(context);
  const blocker = getForgeExitBlocker(state);
  return blocker ? { state, blocker } : { state };
}

export function forgeExitDisablesContinue(context: ForgeExitContext): boolean {
  return getForgeExitBlocker(getForgeExitState(context))?.disablesContinue ?? false;
}
