export type AssetStreamGroupId =
  | "minimumPlayable"
  | "springFollowup"
  | "summer"
  | "autumn"
  | "winterMidBoss"
  | "finalBoss"
  | "endlessHandoff";

export type AssetStreamPriority = "blocking" | "urgent" | "background";
export type AssetStreamStatus =
  | "idle"
  | "queued"
  | "loading"
  | "ready"
  | "failed";

export type AssetStreamPayload = {
  readonly seasonIndices?: readonly number[];
  readonly enemyGroups?: readonly (
    | "minimum"
    | "springFollowup"
    | "summer"
    | "autumn"
    | "winterMidBoss"
    | "finalBoss"
    | "nextEndlessBoss"
  )[];
  readonly visualGroups?: readonly (
    | "minimum"
    | "upgradeCandidates"
    | "heldWeapons"
    | "legalFusions"
  )[];
  readonly audioGroups?: readonly (
    | "spring"
    | "summer"
    | "autumn"
    | "winter"
    | "midBoss"
    | "finalBoss"
    | "endless"
  )[];
};

export type AssetStreamGroupDefinition = {
  readonly id: AssetStreamGroupId;
  /** Earliest standard-run time at which this group may use bandwidth. */
  readonly startAtSeconds: number;
  /** The group should be ready by this standard-run time. */
  readonly deadlineSeconds: number;
  readonly priority: AssetStreamPriority;
  readonly dependsOn?: readonly AssetStreamGroupId[];
  readonly payload: AssetStreamPayload;
};

export type AssetStreamGroupState = {
  readonly id: AssetStreamGroupId;
  readonly status: AssetStreamStatus;
  readonly attempts: number;
  readonly startedAtSeconds: number | null;
  readonly finishedAtSeconds: number | null;
  readonly error?: unknown;
};

export type AssetStreamSnapshot = {
  readonly elapsedSeconds: number;
  readonly activeLoads: number;
  readonly queuedLoads: number;
  readonly groups: readonly AssetStreamGroupState[];
};

export type AssetStreamLoader = (
  group: AssetStreamGroupDefinition,
  signal: AbortSignal,
) => Promise<void>;

export type AssetStreamDirectorOptions = {
  maxConcurrent?: number;
  maxAttempts?: number;
  onStateChange?: (snapshot: AssetStreamSnapshot) => void;
};

export type ConnectionProfile = {
  readonly constrained: boolean;
};

export type AssetRequestClass = "large" | "small";

type QueuedAssetRequest = {
  readonly requestClass: AssetRequestClass;
  readonly run: (signal: AbortSignal) => Promise<unknown>;
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason?: unknown) => void;
  readonly signal?: AbortSignal;
  readonly controller: AbortController;
  readonly timeoutMs: number;
  started: boolean;
  settled: boolean;
  timer?: ReturnType<typeof setTimeout>;
  abort?: () => void;
};

/**
 * One page-wide transfer gate shared by scene, actor, atlas, font and audio
 * loaders. Group-level concurrency is not enough: a single group can contain
 * many Promise.all branches. This gate limits the actual request factories.
 */
export class AssetRequestGate {
  private constrained = false;
  private activeLarge = 0;
  private activeSmall = 0;
  private readonly queue: QueuedAssetRequest[] = [];
  private readonly inflightByKey = new Map<string, Promise<unknown>>();

  configure(profile: ConnectionProfile) {
    this.constrained = profile.constrained;
    this.pump();
  }

  schedule<T>(
    requestClass: AssetRequestClass,
    run: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
    timeoutMs = 10_000,
  ) {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
        return;
      }
      const request: QueuedAssetRequest = {
        requestClass,
        run,
        resolve: (value) => resolve(value as T),
        reject,
        signal,
        controller: new AbortController(),
        timeoutMs: Math.max(1, timeoutMs),
        started: false,
        settled: false,
      };
      if (signal) {
        request.abort = () => {
          request.controller.abort(signal.reason);
          this.settleRequest(
            request,
            false,
            signal.reason ?? new DOMException("Aborted", "AbortError"),
          );
        };
        signal.addEventListener("abort", request.abort, { once: true });
      }
      this.queue.push(request);
      this.pump();
    });
  }

  scheduleShared<T>(
    key: string,
    requestClass: AssetRequestClass,
    run: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
    timeoutMs = 10_000,
  ) {
    const existing = this.inflightByKey.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const request = this.schedule(requestClass, run, signal, timeoutMs);
    this.inflightByKey.set(key, request);
    void request.finally(() => {
      if (this.inflightByKey.get(key) === request) this.inflightByKey.delete(key);
    }).catch(() => undefined);
    return request;
  }

  snapshot() {
    return {
      constrained: this.constrained,
      activeLarge: this.activeLarge,
      activeSmall: this.activeSmall,
      queued: this.queue.length,
    };
  }

  private canStart(requestClass: AssetRequestClass) {
    if (this.constrained) {
      return this.activeLarge + this.activeSmall < 1;
    }
    return requestClass === "large"
      ? this.activeLarge < 2
      : this.activeSmall < 1;
  }

  private pump() {
    for (let index = 0; index < this.queue.length; ) {
      const request = this.queue[index];
      if (!this.canStart(request.requestClass)) {
        index += 1;
        continue;
      }
      this.queue.splice(index, 1);
      request.started = true;
      if (request.requestClass === "large") this.activeLarge += 1;
      else this.activeSmall += 1;
      request.timer = setTimeout(() => {
        const error = new DOMException("Asset request timed out", "TimeoutError");
        request.controller.abort(error);
        this.settleRequest(request, false, error);
      }, request.timeoutMs);
      let running: Promise<unknown>;
      try {
        running = Promise.resolve(request.run(request.controller.signal));
      } catch (error) {
        running = Promise.reject(error);
      }
      void running.then(
        (value) => this.settleRequest(request, true, value),
        (error) => this.settleRequest(request, false, error),
      );
    }
  }

  private settleRequest(
    request: QueuedAssetRequest,
    succeeded: boolean,
    result: unknown,
  ) {
    if (request.settled) return;
    request.settled = true;
    if (request.timer) clearTimeout(request.timer);
    if (request.signal && request.abort) {
      request.signal.removeEventListener("abort", request.abort);
    }
    if (request.started) {
      this.releaseRequestSlot(request.requestClass);
    } else {
      const index = this.queue.indexOf(request);
      if (index >= 0) this.queue.splice(index, 1);
    }
    if (succeeded) request.resolve(result);
    else request.reject(result);
    this.pump();
  }

  private releaseRequestSlot(requestClass: AssetRequestClass) {
    if (requestClass === "large") this.activeLarge -= 1;
    else this.activeSmall -= 1;
  }
}

export const assetRequestGate = new AssetRequestGate();

export const STANDARD_ASSET_STREAM_PLAN: readonly AssetStreamGroupDefinition[] =
  [
    {
      id: "minimumPlayable",
      startAtSeconds: 0,
      deadlineSeconds: 0,
      priority: "blocking",
      payload: {
        seasonIndices: [0],
        enemyGroups: ["minimum"],
        visualGroups: ["minimum"],
      },
    },
    {
      id: "springFollowup",
      startAtSeconds: 2,
      deadlineSeconds: 30,
      priority: "background",
      dependsOn: ["minimumPlayable"],
      payload: {
        enemyGroups: ["springFollowup"],
        visualGroups: ["upgradeCandidates"],
        audioGroups: ["spring"],
      },
    },
    {
      id: "summer",
      startAtSeconds: 30,
      deadlineSeconds: 75,
      priority: "background",
      dependsOn: ["minimumPlayable"],
      payload: {
        seasonIndices: [1],
        enemyGroups: ["summer"],
        audioGroups: ["summer"],
      },
    },
    {
      id: "autumn",
      startAtSeconds: 75,
      deadlineSeconds: 195,
      priority: "background",
      dependsOn: ["minimumPlayable"],
      payload: {
        seasonIndices: [2],
        enemyGroups: ["autumn"],
        audioGroups: ["autumn"],
      },
    },
    {
      id: "winterMidBoss",
      startAtSeconds: 195,
      deadlineSeconds: 315,
      priority: "urgent",
      dependsOn: ["minimumPlayable"],
      payload: {
        seasonIndices: [3],
        enemyGroups: ["winterMidBoss"],
        audioGroups: ["winter", "midBoss"],
      },
    },
    {
      id: "finalBoss",
      startAtSeconds: 315,
      deadlineSeconds: 435,
      priority: "urgent",
      dependsOn: ["minimumPlayable"],
      payload: {
        enemyGroups: ["finalBoss"],
        audioGroups: ["finalBoss"],
      },
    },
    {
      id: "endlessHandoff",
      startAtSeconds: 435,
      deadlineSeconds: 480,
      priority: "background",
      dependsOn: ["minimumPlayable"],
      payload: {
        enemyGroups: ["nextEndlessBoss"],
        visualGroups: ["heldWeapons", "legalFusions"],
        audioGroups: ["endless"],
      },
    },
  ];

const PRIORITY_WEIGHT: Readonly<Record<AssetStreamPriority, number>> = {
  blocking: 0,
  urgent: 1,
  background: 2,
};

export function assetStreamDeadlineState(
  group: AssetStreamGroupDefinition,
  elapsedSeconds: number,
) {
  if (elapsedSeconds < group.startAtSeconds) return "notDue" as const;
  if (elapsedSeconds >= group.deadlineSeconds) return "late" as const;
  const remaining = group.deadlineSeconds - elapsedSeconds;
  return remaining <= 15 ? ("urgent" as const) : ("scheduled" as const);
}

export function selectDueAssetStreamGroups(
  plan: readonly AssetStreamGroupDefinition[],
  elapsedSeconds: number,
  completedIds: ReadonlySet<AssetStreamGroupId> = new Set(),
) {
  const elapsed = Math.max(0, elapsedSeconds);
  return plan
    .filter(
      (group) =>
        elapsed >= group.startAtSeconds &&
        !completedIds.has(group.id) &&
        (group.dependsOn ?? []).every((id) => completedIds.has(id)),
    )
    .sort((left, right) => {
      const priority =
        PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority];
      if (priority !== 0) return priority;
      const leftLate = elapsed >= left.deadlineSeconds ? 0 : 1;
      const rightLate = elapsed >= right.deadlineSeconds ? 0 : 1;
      return (
        leftLate - rightLate ||
        left.deadlineSeconds - right.deadlineSeconds ||
        left.startAtSeconds - right.startAtSeconds
      );
    });
}

export function nextAssetStreamWakeSeconds(
  plan: readonly AssetStreamGroupDefinition[],
  elapsedSeconds: number,
  completedIds: ReadonlySet<AssetStreamGroupId> = new Set(),
) {
  const next = plan
    .filter((group) => !completedIds.has(group.id))
    .map((group) => group.startAtSeconds)
    .filter((start) => start > elapsedSeconds)
    .sort((left, right) => left - right)[0];
  return next ?? null;
}

function initialState(id: AssetStreamGroupId): AssetStreamGroupState {
  return {
    id,
    status: "idle",
    attempts: 0,
    startedAtSeconds: null,
    finishedAtSeconds: null,
  };
}

/**
 * Small deadline-driven scheduler. It owns no game resources; the injected
 * loader maps each payload to the art, audio and sprite stores used by a run.
 */
export class AssetStreamDirector {
  private readonly plan: readonly AssetStreamGroupDefinition[];
  private readonly loader: AssetStreamLoader;
  private readonly maxConcurrent: number;
  private readonly maxAttempts: number;
  private readonly onStateChange?: (snapshot: AssetStreamSnapshot) => void;
  private readonly states = new Map<AssetStreamGroupId, AssetStreamGroupState>();
  private readonly queue: AssetStreamGroupDefinition[] = [];
  private readonly controllers = new Map<AssetStreamGroupId, AbortController>();
  private readonly idleWaiters = new Set<() => void>();
  private elapsedSeconds = 0;
  private activeLoads = 0;
  private disposed = false;

  constructor(
    loader: AssetStreamLoader,
    plan: readonly AssetStreamGroupDefinition[] = STANDARD_ASSET_STREAM_PLAN,
    options: AssetStreamDirectorOptions = {},
  ) {
    this.loader = loader;
    this.plan = plan;
    this.maxConcurrent = Math.max(1, Math.floor(options.maxConcurrent ?? 2));
    this.maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 2));
    this.onStateChange = options.onStateChange;
    plan.forEach((group) => this.states.set(group.id, initialState(group.id)));
  }

  advance(elapsedSeconds: number) {
    if (this.disposed) return this.snapshot();
    this.elapsedSeconds = Math.max(this.elapsedSeconds, elapsedSeconds, 0);
    this.enqueueDueGroups();
    this.pump();
    return this.snapshot();
  }

  request(groupId: AssetStreamGroupId) {
    if (this.disposed) return this.snapshot();
    const group = this.plan.find((candidate) => candidate.id === groupId);
    if (group) this.enqueue(group, true);
    this.pump();
    return this.snapshot();
  }

  markReady(groupId: AssetStreamGroupId) {
    if (this.disposed) return this.snapshot();
    const state = this.states.get(groupId);
    if (!state || state.status === "ready") return this.snapshot();
    const queuedIndex = this.queue.findIndex((group) => group.id === groupId);
    if (queuedIndex >= 0) this.queue.splice(queuedIndex, 1);
    this.controllers.get(groupId)?.abort();
    this.controllers.delete(groupId);
    this.states.set(groupId, {
      ...state,
      status: "ready",
      finishedAtSeconds: this.elapsedSeconds,
      error: undefined,
    });
    this.notify();
    this.enqueueDueGroups();
    this.pump();
    return this.snapshot();
  }

  retry(groupId: AssetStreamGroupId) {
    const state = this.states.get(groupId);
    if (!state || state.status !== "failed" || this.disposed) {
      return this.snapshot();
    }
    this.states.set(groupId, { ...state, status: "idle", error: undefined });
    return this.request(groupId);
  }

  snapshot(): AssetStreamSnapshot {
    return {
      elapsedSeconds: this.elapsedSeconds,
      activeLoads: this.activeLoads,
      queuedLoads: this.queue.length,
      groups: this.plan.map(
        (group) => this.states.get(group.id) ?? initialState(group.id),
      ),
    };
  }

  whenIdle() {
    if (this.activeLoads === 0 && this.queue.length === 0) {
      return Promise.resolve(this.snapshot());
    }
    return new Promise<AssetStreamSnapshot>((resolve) => {
      this.idleWaiters.add(() => resolve(this.snapshot()));
    });
  }

  dispose() {
    this.disposed = true;
    this.queue.length = 0;
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
    this.notify();
    this.resolveIdleWaiters();
  }

  private enqueueDueGroups() {
    const completed = new Set<AssetStreamGroupId>();
    this.states.forEach((state, id) => {
      if (state.status === "ready") completed.add(id);
    });
    selectDueAssetStreamGroups(this.plan, this.elapsedSeconds, completed).forEach(
      (group) => this.enqueue(group),
    );
  }

  private enqueue(group: AssetStreamGroupDefinition, forced = false) {
    const state = this.states.get(group.id) ?? initialState(group.id);
    if (
      state.status === "ready" ||
      state.status === "queued" ||
      state.status === "loading" ||
      (!forced && state.status === "failed") ||
      state.attempts >= this.maxAttempts
    ) {
      return;
    }
    this.states.set(group.id, { ...state, status: "queued", error: undefined });
    this.queue.push(group);
    this.queue.sort((left, right) => {
      return (
        PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority] ||
        left.deadlineSeconds - right.deadlineSeconds
      );
    });
    this.notify();
  }

  private pump() {
    if (this.disposed) return;
    while (this.activeLoads < this.maxConcurrent && this.queue.length > 0) {
      const group = this.queue.shift();
      if (!group) break;
      const previous = this.states.get(group.id) ?? initialState(group.id);
      const controller = new AbortController();
      this.controllers.set(group.id, controller);
      this.activeLoads += 1;
      this.states.set(group.id, {
        ...previous,
        status: "loading",
        attempts: previous.attempts + 1,
        startedAtSeconds: this.elapsedSeconds,
        finishedAtSeconds: null,
        error: undefined,
      });
      this.notify();
      void this.loader(group, controller.signal)
        .then(() => {
          const state = this.states.get(group.id) ?? initialState(group.id);
          this.states.set(group.id, {
            ...state,
            status: "ready",
            finishedAtSeconds: this.elapsedSeconds,
          });
        })
        .catch((error: unknown) => {
          const state = this.states.get(group.id) ?? initialState(group.id);
          this.states.set(group.id, {
            ...state,
            status: "failed",
            finishedAtSeconds: this.elapsedSeconds,
            error,
          });
        })
        .finally(() => {
          this.controllers.delete(group.id);
          this.activeLoads -= 1;
          if (!this.disposed) {
            this.enqueueDueGroups();
            this.pump();
          }
          this.notify();
          this.resolveIdleWaiters();
        });
    }
    this.resolveIdleWaiters();
  }

  private notify() {
    this.onStateChange?.(this.snapshot());
  }

  private resolveIdleWaiters() {
    if (this.activeLoads !== 0 || this.queue.length !== 0) return;
    const waiters = [...this.idleWaiters];
    this.idleWaiters.clear();
    waiters.forEach((resolve) => resolve());
  }
}
