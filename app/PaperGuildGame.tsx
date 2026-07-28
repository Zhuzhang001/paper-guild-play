"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadArtAssets, type LoadedArt } from "./game/art";
import {
  loadEnemySpriteSheets,
  preloadEnemySpriteSheets,
  type EnemySpriteSheets,
} from "./game/actors/enemySprites";
import {
  getWeaponDefinition,
  type FusionId,
  type UpgradeOption,
  type WeaponId,
  WEAPON_IDS,
} from "./game/content";
import { finishHumanForm } from "./game/form";
import {
  drawMenuPreview,
  drawRun,
  loadSolarTermAtlas,
  type RenderAssets,
} from "./game/renderGame";
import {
  applyRareChoice,
  applyUpgrade,
  captureEndlessCelestial,
  createRun,
  fuseEndlessNodesWithName,
  GAME_HEIGHT,
  GAME_WIDTH,
  getUpgradeChoices,
  insertEndlessWeapon,
  RARE_CHOICES,
  snapshotRun,
  STANDARD_SECONDS,
  startEndless,
  stepRun,
  swapEndlessNodes,
  type RareChoice,
  type RunEvent,
  type RunSnapshot,
  type RunState,
  type TrialId,
} from "./game/survivor";
import {
  loadVisualPack,
  preloadFusionVisuals,
  preloadWeaponVisuals,
  WEAPON_ATLASES,
  type VisualPack,
} from "./game/visual";
import {
  AudioManager,
  getSolarTermState,
  getTermAmbienceCue,
  type AudioSettings,
  type SfxCueId,
} from "./game/world";

type Mode =
  | "menu"
  | "playing"
  | "upgrade"
  | "rare"
  | "paused"
  | "forge"
  | "bossChoice"
  | "result";

type ResultState = {
  victory: boolean;
  title: string;
};

type QueuedModal = "upgrade" | "rare" | "forge" | "bossChoice";

type GamepadUiState = {
  direction: -1 | 0 | 1;
  repeatAt: number;
  confirm: boolean;
  cancel: boolean;
  pause: boolean;
};

const WEAPON_AUDIO: Readonly<Record<WeaponId, {
  fire: SfxCueId;
  hit: SfxCueId;
}>> = {
  sword: { fire: "weapon.sword.fire", hit: "weapon.sword.hit" },
  fan: { fire: "weapon.fan.fire", hit: "weapon.fan.hit" },
  umbrella: { fire: "weapon.umbrella.fire", hit: "weapon.umbrella.hit" },
  scissors: { fire: "weapon.scissors.fire", hit: "weapon.scissors.hit" },
  abacus: { fire: "weapon.abacus.fire", hit: "weapon.abacus.hit" },
  crossbow: { fire: "weapon.crossbow.fire", hit: "weapon.crossbow.hit" },
  pipa: { fire: "weapon.pipa.fire", hit: "weapon.pipa.hit" },
  inkline: { fire: "weapon.inkline.fire", hit: "weapon.inkline.hit" },
  lantern: { fire: "weapon.lantern.fire", hit: "weapon.lantern.hit" },
  thunderSeal: { fire: "weapon.thunder.fire", hit: "weapon.thunder.hit" },
};

const emptySnapshot: RunSnapshot = {
  elapsed: 0,
  endless: false,
  score: 0,
  kills: 0,
  life: 5,
  maxLife: 5,
  xp: 0,
  nextXp: 7,
  level: 1,
  weapons: [{ id: "sword", level: 1 }],
  synergies: [],
  currentBoss: null,
  terminalLabel: "",
  terminalLabelLife: 0,
};

const TRIAL_DEFINITIONS: Array<{
  id: TrialId;
  name: string;
  description: string;
}> = [
  { id: "swift", name: "疾行", description: "敌人转向与移动更快" },
  { id: "crowd", name: "聚众", description: "每波敌群数量提高" },
  { id: "elite", name: "强敌", description: "精英和 Boss 更坚韧" },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalize(x: number, y: number) {
  const magnitude = Math.hypot(x, y) || 1;
  return { x: x / magnitude, y: y / magnitude };
}

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

function optionKind(option: UpgradeOption) {
  if (option.kind === "route") return "择路 · 三选一";
  if (option.kind === "mastery") return "成器刻印 · 二选一";
  if (option.kind === "acquire") return "新器入匣";
  if (option.kind === "utility") return "行旅札记";
  return option.kind === "refine" ? "基础精炼" : "路线再造";
}

function weaponSubline(snapshot: RunSnapshot, weaponId: WeaponId) {
  const weapon = snapshot.weapons.find((item) => item.id === weaponId);
  if (!weapon) return "";
  const definition = getWeaponDefinition(weapon.id);
  if (weapon.masteryId) {
    const route = definition.routes.find((candidate) => candidate.id === weapon.routeId);
    const mastery = route?.masteries.find((candidate) => candidate.id === weapon.masteryId);
    return mastery?.name ?? "已成器";
  }
  if (weapon.routeId) {
    return definition.routes.find((candidate) => candidate.id === weapon.routeId)?.name ?? "";
  }
  return weapon.level === 2 ? "待择路线" : definition.description;
}

function weaponAtlasFrame(level: number, routeId?: string) {
  if (level <= 1) return 0;
  if (level === 2) return 1;
  if (level >= 5) return 5;
  const route = routeId?.split(":")[1];
  return route === "b" ? 3 : route === "c" ? 4 : 2;
}

function weaponThumbStyle(weaponId: WeaponId, frame: number): React.CSSProperties {
  const column = frame % 3;
  const row = Math.floor(frame / 3);
  return {
    backgroundImage: `url("${WEAPON_ATLASES[weaponId].src}")`,
    backgroundPosition: `${column * 50}% ${row * 100}%`,
    backgroundSize: "300% 200%",
  };
}

function initialAudioSettings(): AudioSettings {
  const fallback: AudioSettings = {
    muted: false,
    master: 0.8,
    music: 0.62,
    sfx: 0.78,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const saved = JSON.parse(localStorage.getItem("paper-guild.audio.v1") ?? "{}") as Partial<AudioSettings>;
    return {
      muted: typeof saved.muted === "boolean" ? saved.muted : fallback.muted,
      master: clamp(saved.master ?? fallback.master, 0, 1),
      music: clamp(saved.music ?? fallback.music, 0, 1),
      sfx: clamp(saved.sfx ?? fallback.sfx, 0, 1),
    };
  } catch {
    return fallback;
  }
}

export function PaperGuildGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<RunState | null>(null);
  const modeRef = useRef<Mode>("menu");
  const assetsRef = useRef<RenderAssets>({
    seasons: null,
    enemies: null,
    visuals: null,
    solarTerms: null,
  });
  const audioRef = useRef<AudioManager | null>(null);
  const keysRef = useRef(new Set<string>());
  const joystickRef = useRef({
    active: false,
    pointerId: -1,
    baseX: 0,
    baseY: 0,
    knobX: 0,
    knobY: 0,
  });
  const lastFrameRef = useRef(0);
  const hudClockRef = useRef(0);
  const queuedModalsRef = useRef<QueuedModal[]>([]);
  const forgeConsumedRef = useRef(false);
  const gamepadUiRef = useRef<GamepadUiState>({
    direction: 0,
    repeatAt: 0,
    confirm: false,
    cancel: false,
    pause: false,
  });
  const combatAudioRef = useRef({
    actorIds: new Set<number>(),
    fxIds: new Set<number>(),
    kills: 0,
  });
  const bossPreloadRef = useRef({ taotie: false, nian: false });

  const [mode, setModeState] = useState<Mode>("menu");
  const [snapshot, setSnapshot] = useState<RunSnapshot>(emptySnapshot);
  const [upgradeOptions, setUpgradeOptions] = useState<readonly UpgradeOption[]>([]);
  const [trials, setTrials] = useState<Set<TrialId>>(new Set());
  const [selectedNodes, setSelectedNodes] = useState<number[]>([]);
  const [forgeAction, setForgeAction] = useState<"swap" | "fuse">("fuse");
  const [forgeMessage, setForgeMessage] = useState("点选相邻节点，可合铸为独立新器。");
  const [result, setResult] = useState<ResultState>({ victory: false, title: "纸尽人归" });
  const [loading, setLoading] = useState({ season: 0, enemy: 0, visual: 0, terms: 0 });
  const [assetsReady, setAssetsReady] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(initialAudioSettings);
  const [trialsUnlocked, setTrialsUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("paper-guild-cleared-v3") === "yes";
    } catch {
      return false;
    }
  });
  const [tutorialNonce, setTutorialNonce] = useState(0);

  const setMode = useCallback((next: Mode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  useEffect(() => {
    const manager = new AudioManager();
    audioRef.current = manager;

    let alive = true;
    const seasonPromise = loadArtAssets((progress) => {
      if (alive) setLoading((current) => ({ ...current, season: progress }));
    });
    const enemyPromise = loadEnemySpriteSheets((progress) => {
      if (alive) setLoading((current) => ({ ...current, enemy: progress }));
    });
    const visualPromise = loadVisualPack((done, total) => {
      if (alive) setLoading((current) => ({
        ...current,
        visual: total > 0 ? done / total : 1,
      }));
    });
    const termsPromise = loadSolarTermAtlas().then((atlas) => {
      if (alive) setLoading((current) => ({ ...current, terms: 1 }));
      return atlas;
    });

    Promise.all([seasonPromise, enemyPromise, visualPromise, termsPromise])
      .then(([seasons, enemies, visuals, solarTerms]: [
        LoadedArt,
        EnemySpriteSheets,
        VisualPack,
        HTMLImageElement | null,
      ]) => {
        if (!alive) return;
        assetsRef.current = { seasons, enemies, visuals, solarTerms };
        setLoading({ season: 1, enemy: 1, visual: 1, terms: 1 });
        setAssetsReady(true);
      });

    return () => {
      alive = false;
      manager.destroy();
      audioRef.current = null;
    };
  }, []);

  const refreshSnapshot = useCallback(() => {
    const run = runRef.current;
    if (run) setSnapshot(snapshotRun(run));
  }, []);

  const syncMusic = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    const term = getSolarTermState(run.elapsed, run.endless);
    void audioRef.current?.syncWorldMusic({
      season: term.season,
      endless: run.endless,
      bossTier: run.currentBoss ?? undefined,
    });
  }, []);

  const play = useCallback((cue: SfxCueId) => {
    void audioRef.current?.playSfx(cue);
  }, []);

  const releaseMovementInput = useCallback(() => {
    keysRef.current.clear();
    joystickRef.current.active = false;
    joystickRef.current.pointerId = -1;
  }, []);

  const pauseGame = useCallback(() => {
    const run = runRef.current;
    if (run) finishHumanForm(run.player);
    releaseMovementInput();
    setMode("paused");
  }, [releaseMovementInput, setMode]);

  const openUpgrade = useCallback((run: RunState) => {
    finishHumanForm(run.player);
    releaseMovementInput();
    const options = getUpgradeChoices(run);
    setUpgradeOptions(options);
    const weaponIds = options
      .filter((option) => option.kind !== "utility")
      .map((option) => option.weaponId);
    const visuals = assetsRef.current.visuals;
    if (visuals && weaponIds.length > 0) void preloadWeaponVisuals(visuals, weaponIds);
    setSnapshot(snapshotRun(run));
    setMode("upgrade");
  }, [releaseMovementInput, setMode]);

  const openForge = useCallback((run: RunState, message?: string) => {
    finishHumanForm(run.player);
    releaseMovementInput();
    forgeConsumedRef.current = false;
    setSelectedNodes([]);
    setForgeMessage(message ?? "器息暂歇。添器、换位或将相邻节点合铸。");
    const used = new Set(
      (run.weave?.nodes ?? [])
        .filter((node) => node.kind === "weapon")
        .map((node) => node.sourceId as WeaponId),
    );
    const candidates = WEAPON_IDS.filter((weaponId) => !used.has(weaponId)).slice(0, 6);
    const visuals = assetsRef.current.visuals;
    if (visuals && candidates.length > 0) void preloadWeaponVisuals(visuals, candidates);
    setSnapshot(snapshotRun(run));
    setMode("forge");
  }, [releaseMovementInput, setMode]);

  const endRun = useCallback((victory: boolean, title?: string) => {
    const run = runRef.current;
    if (!run) return;
    queuedModalsRef.current = [];
    finishHumanForm(run.player);
    releaseMovementInput();
    if (victory) {
      try {
        localStorage.setItem("paper-guild-cleared-v3", "yes");
      } catch {
        // Progress still applies for this session when storage is unavailable.
      }
      setTrialsUnlocked(true);
    }
    setResult({ victory, title: title ?? (victory ? "绘卷已收" : "纸尽人归") });
    setSnapshot(snapshotRun(run));
    setMode("result");
    audioRef.current?.stopMusic(0.45);
  }, [releaseMovementInput, setMode]);

  const openNextQueuedModal = useCallback((run: RunState) => {
    const next = queuedModalsRef.current.shift();
    if (!next) {
      setMode("playing");
      syncMusic();
      return false;
    }
    if (next === "upgrade") {
      openUpgrade(run);
    } else if (next === "rare") {
      finishHumanForm(run.player);
      releaseMovementInput();
      setSnapshot(snapshotRun(run));
      setMode("rare");
      syncMusic();
    } else if (next === "forge") {
      openForge(run, "阶段战已毕，万器天盘获得一次铸器机会。");
      syncMusic();
    } else {
      finishHumanForm(run.player);
      releaseMovementInput();
      setSnapshot(snapshotRun(run));
      setMode("bossChoice");
      syncMusic();
    }
    return true;
  }, [openForge, openUpgrade, releaseMovementInput, setMode, syncMusic]);

  const handleEvents = useCallback((run: RunState, events: RunEvent[]) => {
    for (const event of events) {
      if (event.type === "pickup") play("sfx.pickup");
      if (event.type === "playerHit") play("sfx.player-hit");
      if (event.type === "fold") play(event.folded ? "sfx.fold" : "sfx.unfold");
      if (event.type === "synergy") play("sfx.synergy");
      if (event.type === "terminal") play("sfx.ultimate");
      if (event.type === "bossSpawn") {
        play(event.tier === "mid" ? "sfx.boss-taotie" : "sfx.boss-nian");
        syncMusic();
      }
      if (event.type === "term") {
        if (!run.endless && run.elapsed >= STANDARD_SECONDS) continue;
        play("sfx.term-change");
        const term = getSolarTermState(run.elapsed, run.endless).current;
        void audioRef.current?.playSfx(getTermAmbienceCue(term));
        syncMusic();
      }
    }

    if (events.some((event) => event.type === "defeat")) {
      queuedModalsRef.current = [];
      endRun(false);
      return;
    }

    const queued: QueuedModal[] = [];
    if (events.some((event) => event.type === "finalBoss")) queued.push("bossChoice");
    if (events.some((event) => event.type === "midBoss")) queued.push("rare");
    if (events.some((event) => event.type === "forge")) queued.push("forge");
    for (const event of events) if (event.type === "upgrade") queued.push("upgrade");
    queuedModalsRef.current.push(...queued);
    if (modeRef.current === "playing" && queued.length > 0) openNextQueuedModal(run);
  }, [endRun, openNextQueuedModal, play, syncMusic]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        event.preventDefault();
      }
      keysRef.current.add(key);
      if (key === "escape" && modeRef.current === "playing") {
        pauseGame();
      } else if (key === "escape" && modeRef.current === "paused") {
        setMode("playing");
      }
      if (modeRef.current === "upgrade" && ["1", "2", "3"].includes(key)) {
        const option = upgradeOptions[Number(key) - 1];
        if (option) {
          const run = runRef.current;
          if (run) {
            const synergy = applyUpgrade(run, option);
            if (synergy) play("sfx.synergy");
            else play("sfx.upgrade");
            refreshSnapshot();
            openNextQueuedModal(run);
          }
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    const onVisibility = () => {
      if (document.hidden && modeRef.current === "playing") {
        pauseGame();
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [openNextQueuedModal, pauseGame, play, refreshSnapshot, setMode, upgradeOptions]);

  const pollGamepadUi = useCallback((gamepad: Gamepad, time: number) => {
    const state = gamepadUiRef.current;
    const pausePressed = gamepad.buttons[9]?.pressed ?? false;
    if (pausePressed && !state.pause) {
      if (modeRef.current === "playing") {
        pauseGame();
      } else if (modeRef.current === "paused") {
        setMode("playing");
        syncMusic();
      } else if (modeRef.current === "menu" || modeRef.current === "result") {
        document
          .querySelector<HTMLButtonElement>(
            modeRef.current === "menu"
              ? ".menu .primary-button:not(:disabled)"
              : ".result-panel .primary-button:not(:disabled)",
          )
          ?.click();
      }
      state.pause = true;
      return;
    }
    state.pause = pausePressed;
    if (modeRef.current === "playing") {
      state.direction = 0;
      state.confirm = gamepad.buttons[0]?.pressed ?? false;
      state.cancel = gamepad.buttons[1]?.pressed ?? false;
      return;
    }

    const modal = document.querySelector<HTMLElement>(
      modeRef.current === "menu" ? ".overlay.menu" : ".modal-shade",
    );
    const controls = modal
      ? [...modal.querySelectorAll<HTMLElement>("button:not(:disabled)")].filter((element) =>
          element.offsetParent !== null
        )
      : [];
    if (controls.length === 0) return;

    const axisX = gamepad.axes[0] ?? 0;
    const axisY = gamepad.axes[1] ?? 0;
    const previousPressed = (gamepad.buttons[12]?.pressed ?? false) || (gamepad.buttons[14]?.pressed ?? false);
    const nextPressed = (gamepad.buttons[13]?.pressed ?? false) || (gamepad.buttons[15]?.pressed ?? false);
    const direction: -1 | 0 | 1 = previousPressed || axisX < -0.62 || axisY < -0.62
      ? -1
      : nextPressed || axisX > 0.62 || axisY > 0.62
        ? 1
        : 0;

    if (direction === 0) {
      state.direction = 0;
    } else if (direction !== state.direction || time >= state.repeatAt) {
      const focusedIndex = controls.findIndex((element) => element === document.activeElement);
      const nextIndex = focusedIndex < 0
        ? direction > 0 ? 0 : controls.length - 1
        : (focusedIndex + direction + controls.length) % controls.length;
      controls[nextIndex].focus({ preventScroll: false });
      state.repeatAt = time + (direction === state.direction ? 115 : 270);
      state.direction = direction;
      play("sfx.ui-confirm");
    }

    const confirmPressed = gamepad.buttons[0]?.pressed ?? false;
    if (confirmPressed && !state.confirm) {
      const focused = controls.find((element) => element === document.activeElement) ?? controls[0];
      focused.focus({ preventScroll: false });
      focused.click();
    }
    state.confirm = confirmPressed;

    const cancelPressed = gamepad.buttons[1]?.pressed ?? false;
    if (cancelPressed && !state.cancel) {
      modal?.querySelector<HTMLButtonElement>("[data-gamepad-cancel]")?.click();
    }
    state.cancel = cancelPressed;
  }, [pauseGame, play, setMode, syncMusic]);

  const consumeCombatAudio = useCallback((run: RunState) => {
    const previous = combatAudioRef.current;
    const activeActors = [
      ...run.projectiles,
      ...run.zones,
      ...run.summons,
      ...run.strikes.filter((strike) => !strike.hostile),
    ];
    const newOwners = new Set(
      activeActors
        .filter((actor) => !previous.actorIds.has(actor.id))
        .map((actor) => actor.owner),
    );
    const currentFxIds = new Set(run.fx.map((effect) => effect.id));

    for (const effect of run.fx) {
      if (previous.fxIds.has(effect.id)) continue;
      const separator = effect.artKey.lastIndexOf("/");
      const owner =
        effect.owner ??
        (separator >= 0 ? effect.artKey.slice(separator + 1) : "");
      if (WEAPON_IDS.includes(owner as WeaponId)) {
        const weapon = owner as WeaponId;
        if (effect.kind === "hit") play(WEAPON_AUDIO[weapon].hit);
        else if (effect.kind === "beam" || effect.kind === "chain") newOwners.add(weapon);
      }
    }
    for (const owner of newOwners) {
      if (WEAPON_IDS.includes(owner as WeaponId)) play(WEAPON_AUDIO[owner as WeaponId].fire);
    }
    if (run.kills > previous.kills) play("sfx.enemy-death");

    combatAudioRef.current = {
      actorIds: new Set(activeActors.map((actor) => actor.id)),
      fxIds: currentFxIds,
      kills: run.kills,
    };
  }, [play]);

  useEffect(() => {
    let frame = 0;
    const loop = (time: number) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) {
        frame = requestAnimationFrame(loop);
        return;
      }
      if (canvas.width !== GAME_WIDTH || canvas.height !== GAME_HEIGHT) {
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
      }
      const rawDelta = lastFrameRef.current ? (time - lastFrameRef.current) / 1000 : 0;
      const delta = Math.min(rawDelta, 0.034);
      lastFrameRef.current = time;
      const run = runRef.current;

      if (!run) {
        drawMenuPreview(context, time / 1000, assetsRef.current);
        frame = requestAnimationFrame(loop);
        return;
      }

      const enemySheets = assetsRef.current.enemies;
      if (enemySheets && !bossPreloadRef.current.taotie && run.elapsed >= 330) {
        bossPreloadRef.current.taotie = true;
        void preloadEnemySpriteSheets(enemySheets, ["taotie"]);
      }
      if (enemySheets && !bossPreloadRef.current.nian && run.elapsed >= 450) {
        bossPreloadRef.current.nian = true;
        void preloadEnemySpriteSheets(enemySheets, ["nian"]);
      }

      const gamepad = navigator.getGamepads?.()[0];
      if (gamepad) pollGamepadUi(gamepad, time);

      if (modeRef.current === "playing") {
        let x = 0;
        let y = 0;
        const keys = keysRef.current;
        if (keys.has("w") || keys.has("arrowup")) y -= 1;
        if (keys.has("s") || keys.has("arrowdown")) y += 1;
        if (keys.has("a") || keys.has("arrowleft")) x -= 1;
        if (keys.has("d") || keys.has("arrowright")) x += 1;

        if (gamepad && Math.hypot(gamepad.axes[0] ?? 0, gamepad.axes[1] ?? 0) > 0.2) {
          x += gamepad.axes[0] ?? 0;
          y += gamepad.axes[1] ?? 0;
        }
        const joystick = joystickRef.current;
        if (joystick.active) {
          x += clamp((joystick.knobX - joystick.baseX) / 46, -1, 1);
          y += clamp((joystick.knobY - joystick.baseY) / 46, -1, 1);
        }
        const direction = Math.hypot(x, y) > 1 ? normalize(x, y) : { x, y };
        const events = stepRun(run, delta, direction);
        consumeCombatAudio(run);
        handleEvents(run, events);

        hudClockRef.current += delta;
        if (hudClockRef.current >= 0.12) {
          hudClockRef.current = 0;
          setSnapshot(snapshotRun(run));
        }
      }

      const renderRun = !run.endless && run.elapsed >= STANDARD_SECONDS
        ? { ...run, elapsed: STANDARD_SECONDS - 0.001 }
        : run;
      drawRun(context, renderRun, time / 1000, assetsRef.current, joystickRef.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [consumeCombatAudio, handleEvents, pollGamepadUi]);

  const startGame = async () => {
    if (!assetsReady) return;
    await audioRef.current?.initFromGesture();
    if (assetsRef.current.visuals) {
      await preloadWeaponVisuals(assetsRef.current.visuals, ["sword"]);
    }
    void audioRef.current?.preload([
      "music.spring",
      "sfx.fold",
      "sfx.unfold",
      "sfx.pickup",
      "sfx.upgrade",
      "sfx.player-hit",
    ]);
    const run = createRun(trials);
    runRef.current = run;
    releaseMovementInput();
    queuedModalsRef.current = [];
    forgeConsumedRef.current = false;
    bossPreloadRef.current = { taotie: false, nian: false };
    combatAudioRef.current = {
      actorIds: new Set(),
      fxIds: new Set(),
      kills: 0,
    };
    setSnapshot(snapshotRun(run));
    setTutorialNonce((value) => value + 1);
    setMode("playing");
    syncMusic();
    play(getTermAmbienceCue(getSolarTermState(0, false).current));
    play("sfx.ui-confirm");
  };

  const chooseUpgrade = (option: UpgradeOption) => {
    const run = runRef.current;
    if (!run) return;
    const synergy = applyUpgrade(run, option);
    play(synergy ? "sfx.synergy" : "sfx.upgrade");
    setSnapshot(snapshotRun(run));
    openNextQueuedModal(run);
  };

  const chooseRare = (choice: RareChoice["id"]) => {
    const run = runRef.current;
    if (!run) return;
    applyRareChoice(run, choice);
    run.pendingRareChoice = false;
    play(choice === "resonance-slot" ? "sfx.synergy" : "sfx.upgrade");
    setSnapshot(snapshotRun(run));
    openNextQueuedModal(run);
  };

  const continueEndless = () => {
    const run = runRef.current;
    if (!run) return;
    startEndless(run);
    setSnapshot(snapshotRun(run));
    play("sfx.ultimate");
    syncMusic();
    openNextQueuedModal(run);
  };

  const returnToMenu = () => {
    runRef.current = null;
    releaseMovementInput();
    queuedModalsRef.current = [];
    forgeConsumedRef.current = false;
    setSnapshot(emptySnapshot);
    setSelectedNodes([]);
    setMode("menu");
    audioRef.current?.stopMusic();
  };

  const toggleTrial = (trial: TrialId) => {
    if (!trialsUnlocked) return;
    setTrials((current) => {
      const next = new Set(current);
      if (next.has(trial)) next.delete(trial);
      else next.add(trial);
      return next;
    });
  };

  const updateAudio = (update: Partial<AudioSettings>) => {
    audioRef.current?.setSettings(update);
    setAudioSettings(audioRef.current?.getSettings() ?? audioSettings);
    if (update.muted === false) {
      void audioRef.current?.initFromGesture().then(() => syncMusic());
    }
  };

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * GAME_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * GAME_HEIGHT,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (modeRef.current !== "playing") return;
    const point = canvasPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    joystickRef.current = {
      active: true,
      pointerId: event.pointerId,
      baseX: point.x,
      baseY: point.y,
      knobX: point.x,
      knobY: point.y,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const joystick = joystickRef.current;
    if (!joystick.active || joystick.pointerId !== event.pointerId) return;
    const point = canvasPoint(event);
    const dx = point.x - joystick.baseX;
    const dy = point.y - joystick.baseY;
    const distance = Math.hypot(dx, dy);
    const scale = distance > 48 ? 48 / distance : 1;
    joystick.knobX = joystick.baseX + dx * scale;
    joystick.knobY = joystick.baseY + dy * scale;
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (joystickRef.current.pointerId !== event.pointerId) return;
    joystickRef.current.active = false;
    joystickRef.current.pointerId = -1;
  };

  const onNodeSelect = (index: number) => {
    setSelectedNodes((current) => {
      if (current.includes(index)) return current.filter((value) => value !== index);
      if (current.length >= 2) return [index];
      return [...current, index];
    });
  };

  const executeForgeAction = async () => {
    const run = runRef.current;
    if (!run?.weave || selectedNodes.length !== 2 || forgeConsumedRef.current) return;
    const [first, second] = selectedNodes;
    if (forgeAction === "swap") {
      swapEndlessNodes(run, first, second);
      setForgeMessage("节点次序已交换；下一轮终式签名会随之改变。");
      play("sfx.ui-confirm");
      forgeConsumedRef.current = true;
    } else {
      const existingFusions = new Set(
        run.weave.nodes
          .filter((node) => node.kind === "fusion")
          .map((node) => node.sourceId),
      );
      const name = fuseEndlessNodesWithName(run, first, second);
      if (name) {
        const fusion = run.weave.nodes.find((node) =>
          node.kind === "fusion" && !existingFusions.has(node.sourceId)
        );
        const visuals = assetsRef.current.visuals;
        if (visuals && fusion) {
          await preloadFusionVisuals(visuals, [fusion.sourceId as FusionId]);
        }
        setForgeMessage(`合铸完成：${name}。两个节点已归一，并释放一个盘位。`);
        play("sfx.fusion");
        forgeConsumedRef.current = true;
      } else {
        setForgeMessage("这两个节点必须相邻，且属于十五组精选合铸配方之一。");
        play("sfx.ui-back");
      }
    }
    setSelectedNodes([]);
    setSnapshot(snapshotRun(run));
    if (forgeConsumedRef.current) openNextQueuedModal(run);
  };

  const addEndlessWeapon = (weaponId: WeaponId) => {
    const run = runRef.current;
    if (!run || forgeConsumedRef.current) return;
    if (!insertEndlessWeapon(run, weaponId)) {
      setForgeMessage("天盘已满，先合铸相邻节点释放盘位。");
      return;
    }
    forgeConsumedRef.current = true;
    setForgeMessage(`${getWeaponDefinition(weaponId).name}已插入天盘末位。`);
    play("sfx.upgrade");
    setSnapshot(snapshotRun(run));
    openNextQueuedModal(run);
  };

  const captureCelestial = () => {
    const run = runRef.current;
    if (!run || forgeConsumedRef.current) return;
    const name = captureEndlessCelestial(run);
    if (!name) {
      setForgeMessage("需先击败敌对天罚化身，并确保天盘仍有空位。");
      return;
    }
    forgeConsumedRef.current = true;
    setForgeMessage(`${name}已炼入天盘，敌对天罚转为己方天律。`);
    play("sfx.ultimate");
    setSnapshot(snapshotRun(run));
    openNextQueuedModal(run);
  };

  const closeForge = () => {
    const run = runRef.current;
    forgeConsumedRef.current = true;
    setSelectedNodes([]);
    if (run) openNextQueuedModal(run);
    else setMode("playing");
  };

  const term = getSolarTermState(snapshot.elapsed, snapshot.endless);
  const loadProgress = Math.round(
    ((loading.season + loading.enemy + loading.visual + loading.terms) / 4) * 100,
  );
  const availableNodes = useMemo(() => {
    const used = new Set(
      (snapshot.weave?.nodes ?? [])
        .filter((node) => node.kind === "weapon")
        .map((node) => node.sourceId as WeaponId),
    );
    return WEAPON_IDS.filter((weaponId) => !used.has(weaponId)).slice(0, 6);
  }, [snapshot.weave]);

  return (
    <main className="page">
      <section className="game-shell" aria-label="纸上百工游戏">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="paper-grain" />

        {mode !== "menu" && (
          <div className="hud" aria-live="polite">
            <div className="hud-top">
              <div className="status-card">
                <div className="status-line">
                  <span>纸命 <b className="hearts">{"◆".repeat(Math.max(0, snapshot.life))}{"◇".repeat(Math.max(0, snapshot.maxLife - snapshot.life))}</b></span>
                  <strong>第 {snapshot.level} 境</strong>
                </div>
                <div className="xp-track" aria-label="经验进度">
                  <span style={{ width: `${clamp(snapshot.xp / snapshot.nextXp, 0, 1) * 100}%` }} />
                </div>
              </div>

              <div className="term-stack">
                <span className={`season-mark season-${term.season}`}>{term.current.name}</span>
                <small>下一节气 · {term.next.name}</small>
                <div className="term-progress"><i style={{ width: `${term.termProgress * 100}%` }} /></div>
              </div>

              <div className="time-card">
                <span className="timer">{snapshot.endless ? `续 ${formatTime(snapshot.elapsed - STANDARD_SECONDS)}` : formatTime(snapshot.elapsed)}</span>
                <button className="icon-button" onClick={pauseGame} aria-label="暂停">暂停</button>
              </div>
            </div>

            {snapshot.weave && (
              <div className="weave-hud">
                <span className="weave-title">万器经纬</span>
                <div className="weave-mini-ring">
                  {snapshot.weave.nodes.map((node, index) => (
                    <i
                      key={node.instanceId}
                      className={`${node.kind} ${index === snapshot.weave?.pulse.nodeIndex ? "active" : ""}`}
                      title={`${index + 1}. ${node.name}`}
                    >
                      {node.name.slice(0, 1)}
                    </i>
                  ))}
                </div>
                <span className="weave-charge">
                  器息 {Math.round(snapshot.weave.pulse.nodeProgress * 100)}%
                </span>
                {snapshot.weave.activeIntrusion && (
                  <span className={`intrusion ${snapshot.weave.activeIntrusion.phase}`}>
                    天罚 · {snapshot.weave.activeIntrusion.phase === "warning" ? "将临" : snapshot.weave.activeIntrusion.phase === "defeated" ? "可炼化" : "入阵"}
                  </span>
                )}
              </div>
            )}

            <div className="hud-bottom">
              <div className="weapon-bar">
                {snapshot.weapons.map((weapon) => (
                  <span className="weapon-chip" key={weapon.id}>
                    <i
                      className="weapon-mini-art"
                      aria-hidden="true"
                      style={weaponThumbStyle(
                        weapon.id,
                        weaponAtlasFrame(weapon.level, weapon.routeId),
                      )}
                    />
                    <b>{getWeaponDefinition(weapon.id).shortName}</b>
                    <strong> {weapon.level}/5</strong>
                    <em>{weaponSubline(snapshot, weapon.id)}</em>
                  </span>
                ))}
              </div>
              <div className="resonance-list">
                {snapshot.synergies.map((name) => <span key={name}>合鸣 · {name}</span>)}
              </div>
            </div>
          </div>
        )}

        {snapshot.terminalLabelLife > 0 && (
          <div className="terminal-callout">
            <span>终式</span>
            <strong>{snapshot.terminalLabel}</strong>
          </div>
        )}

        {mode === "playing" && snapshot.elapsed < 8 && (
          <div className="tutorial" key={tutorialNonce}>
            只需移动 · 武器自动迎敌 · 停下或急转会展开人形
          </div>
        )}

        {mode === "menu" && (
          <div className="overlay menu">
            <div className="menu-panel">
              <p className="kicker"><span className="seal">百工</span> 水墨绘本 · 剪纸肉鸽</p>
              <h1 className="title">纸上<span>百工</span></h1>
              <p className="subtitle">
                清俊纸旅人携十般百工器物走过二十四节气。只需移动，让三路进化、双刻成器与万器经纬自动写成你的战局。
              </p>
              <div className="feature-row">
                <span>10 把本命器</span>
                <span>30 条路线</span>
                <span>12 套合鸣</span>
                <span>15 件合铸器</span>
                <span>二十四节气</span>
              </div>
              <p className="tao-note">
                少量道门元素位于「五雷令、雷音琵琶、雷部天罚与法铃音色」，其余仍是市井百工与岁时行旅。
              </p>
              <div className="button-row">
                <button className="primary-button" onClick={startGame} disabled={!assetsReady}>
                  {assetsReady ? "展卷启程" : `美工图集装订中 ${loadProgress}%`}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => updateAudio({ muted: !audioSettings.muted })}
                >
                  {audioSettings.muted ? "开启声音" : "声音已开"}
                </button>
              </div>
              <div className="trial-area">
                <p className="trial-label">{trialsUnlocked ? "试炼签 · 可叠加" : "首次收卷后解锁试炼签"}</p>
                <div className="trials">
                  {TRIAL_DEFINITIONS.map((trial) => (
                    <button
                      key={trial.id}
                      className={`trial ${trials.has(trial.id) ? "active" : ""}`}
                      onClick={() => toggleTrial(trial.id)}
                      disabled={!trialsUnlocked}
                      title={trial.description}
                    >
                      {trial.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === "upgrade" && (
          <div className="overlay modal-shade">
            <section className="upgrade-panel">
              <p className="kicker">器物自择 · 战局暂停</p>
              <h2 className="upgrade-heading">
                {upgradeOptions[0]?.kind === "route"
                  ? "择定一条器路"
                  : upgradeOptions[0]?.kind === "mastery"
                    ? "镌下一枚成器刻印"
                    : "拾取一页百工谱"}
              </h2>
              <p className="upgrade-note">
                三级固定同时展示三条路线，五级固定展示两种刻印；选择后本局不可反悔。
              </p>
              <div className={`upgrade-grid count-${upgradeOptions.length}`}>
                {upgradeOptions.map((option, index) => {
                  const color = option.kind === "utility"
                    ? "#886b42"
                    : getWeaponDefinition(option.weaponId).color;
                  const currentRoute =
                    option.kind === "utility"
                      ? undefined
                      : option.kind === "route" || option.kind === "mastery"
                        ? option.routeId
                        : snapshot.weapons.find(
                            (weapon) => weapon.id === option.weaponId,
                          )?.routeId;
                  const targetLevel =
                    option.kind === "acquire"
                      ? 1
                      : option.kind === "refine"
                        ? 2
                        : option.kind === "route"
                          ? 3
                          : option.kind === "routeEnhancement"
                            ? 4
                            : option.kind === "mastery"
                              ? 5
                              : 0;
                  return (
                    <button
                      className="upgrade-card"
                      key={option.id}
                      onClick={() => chooseUpgrade(option)}
                      style={{ "--accent": color } as React.CSSProperties}
                    >
                      {option.kind !== "utility" && (
                        <span
                          className="upgrade-card-art"
                          aria-hidden="true"
                          style={weaponThumbStyle(
                            option.weaponId,
                            weaponAtlasFrame(targetLevel, currentRoute),
                          )}
                        />
                      )}
                      <span className="card-type">{index + 1} · {optionKind(option)}</span>
                      <h3>{option.title}</h3>
                      <p>{option.description}</p>
                      {option.kind !== "utility" && (
                        <div className="level-dots">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <i key={level} className={level <= (
                              option.kind === "acquire"
                                ? 1
                                : option.kind === "refine"
                                  ? 2
                                  : option.kind === "route"
                                    ? 3
                                    : option.kind === "routeEnhancement"
                                      ? 4
                                      : 5
                            ) ? "on" : ""} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {mode === "rare" && (
          <div className="overlay modal-shade">
            <section className="upgrade-panel rare-panel">
              <p className="kicker">饕餮遗珍 · 质变奖励</p>
              <h2 className="upgrade-heading">饕餮遗珍，择一改局</h2>
              <p className="upgrade-note">三件遗珍都会改变后半局的构筑走向。</p>
              <div className="upgrade-grid">
                {RARE_CHOICES.map((choice, index) => (
                  <button
                    key={choice.id}
                    className="upgrade-card rare-card"
                    onClick={() => chooseRare(choice.id)}
                  >
                    <span className="card-type">{index + 1} · 饕餮遗珍</span>
                    <h3>{choice.name}</h3>
                    <p>{choice.description}</p>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {mode === "forge" && snapshot.weave && (
          <div className="overlay modal-shade">
            <section className="forge-panel">
              <div className="forge-heading-row">
                <div>
                  <p className="kicker">无尽铸器 · 每两分钟一次</p>
                  <h2 className="upgrade-heading">万器经纬天盘</h2>
                </div>
                <span className="capacity">节点 {snapshot.weave.nodes.length}/{snapshot.weave.maxNodes} · 合铸 {snapshot.weave.nodes.filter((node) => node.kind === "fusion").length}/{snapshot.weave.maxFusions}</span>
              </div>
              <p className="forge-message">{forgeMessage}</p>
              <div className="forge-layout">
                <div className="weave-ring-large">
                  {snapshot.weave.nodes.map((node, index) => (
                    <button
                      key={node.instanceId}
                      className={`weave-node ${node.kind} ${selectedNodes.includes(index) ? "selected" : ""} ${index === snapshot.weave?.pulse.nodeIndex ? "pulse" : ""}`}
                      onClick={() => onNodeSelect(index)}
                      style={{ "--node-index": index, "--node-count": snapshot.weave?.nodes.length ?? 1 } as React.CSSProperties}
                    >
                      <b>{index + 1}</b>
                      <span>{node.name}</span>
                      <small>{node.kind === "fusion" ? "合铸器" : node.kind === "celestial" ? "天律" : "本命器"}</small>
                    </button>
                  ))}
                  <div className="weave-core">
                    <span>顺时针器息</span>
                    <strong>{Math.round(snapshot.weave.pulse.nodeProgress * 100)}%</strong>
                  </div>
                </div>

                <div className="forge-controls">
                  <div className="forge-tabs">
                    <button className={forgeAction === "fuse" ? "active" : ""} onClick={() => setForgeAction("fuse")}>相邻合铸</button>
                    <button className={forgeAction === "swap" ? "active" : ""} onClick={() => setForgeAction("swap")}>交换次序</button>
                  </div>
                  <button className="primary-button compact" onClick={executeForgeAction} disabled={selectedNodes.length !== 2}>
                    {forgeAction === "fuse" ? "合铸所选节点" : "交换所选节点"}
                  </button>
                  <div className="new-node-list">
                    <p>插入新器节点</p>
                    {availableNodes.map((weaponId) => (
                      <button key={weaponId} onClick={() => addEndlessWeapon(weaponId)}>
                        {getWeaponDefinition(weaponId).name}
                      </button>
                    ))}
                  </div>
                  {snapshot.weave.activeIntrusion?.phase === "defeated" && (
                    <button className="celestial-button" onClick={captureCelestial}>炼化敌方天罚为天律</button>
                  )}
                  <button className="secondary-button" data-gamepad-cancel onClick={closeForge}>定盘续战</button>
                </div>
              </div>
            </section>
          </div>
        )}

        {mode === "paused" && (
          <div className="overlay modal-shade">
            <section className="pause-panel">
              <p className="kicker">卷轴暂歇</p>
              <h2>行旅未完</h2>
              <p>角色已强制展开成人形，恢复后不会卡在折叠中途。</p>
              <div className="audio-settings">
                <label>
                  <span>音乐</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={audioSettings.music}
                    onChange={(event) => updateAudio({ music: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span>音效</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={audioSettings.sfx}
                    onChange={(event) => updateAudio({ sfx: Number(event.target.value) })}
                  />
                </label>
              </div>
              <div className="button-row centered">
                <button className="primary-button" data-gamepad-cancel onClick={() => {
                  setMode("playing");
                  syncMusic();
                }}>继续行旅</button>
                <button className="secondary-button" onClick={() => updateAudio({ muted: !audioSettings.muted })}>
                  {audioSettings.muted ? "取消静音" : "静音"}
                </button>
                <button className="secondary-button" onClick={returnToMenu}>弃卷返回</button>
              </div>
            </section>
          </div>
        )}

        {mode === "bossChoice" && (
          <div className="overlay modal-shade">
            <section className="result-panel">
              <div className="result-seal">岁</div>
              <p className="kicker">岁夜年兽已伏</p>
              <h2>八分钟绘卷完成</h2>
              <div className="stats">
                <div><strong>{snapshot.kills}</strong><span>降服</span></div>
                <div><strong>{snapshot.synergies.length}</strong><span>合鸣</span></div>
                <div><strong>{snapshot.score}</strong><span>卷分</span></div>
              </div>
              <div className="boss-choice">
                <button
                  className="primary-button"
                  data-gamepad-cancel
                  onClick={() => endRun(true, "清风收卷")}
                >
                  收卷结算
                  <span className="choice-note">完成标准局并解锁试炼签</span>
                </button>
                <button className="secondary-button" onClick={continueEndless}>
                  续卷 · 万器经纬
                  <span className="choice-note">开启溢出武器、合铸、天罚与终式</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {mode === "result" && (
          <div className="overlay modal-shade">
            <section className="result-panel">
              <div className="result-seal">{result.victory ? "成" : "归"}</div>
              <p className="kicker">{result.victory ? "四时已阅" : "纸命已尽"}</p>
              <h2>{result.title}</h2>
              <div className="stats">
                <div><strong>{formatTime(snapshot.elapsed)}</strong><span>行旅时间</span></div>
                <div><strong>{snapshot.kills}</strong><span>降服</span></div>
                <div><strong>{snapshot.score}</strong><span>卷分</span></div>
              </div>
              <div className="button-row centered">
                <button className="primary-button" onClick={startGame}>再展一卷</button>
                <button className="secondary-button" data-gamepad-cancel onClick={returnToMenu}>返回卷首</button>
              </div>
            </section>
          </div>
        )}
      </section>
      <aside className="rotate-hint">请将手机横置，给四时绘卷留出完整战场。</aside>
    </main>
  );
}
